
// ================================================================ LISENSI SERIAL NUMBER (SN) + LYNK.ID
// Alur: Head Admin generate SN → dijual di Lynk.id → pembeli dapat SN (otomatis via webhook / klaim / kirim manual)
//       → owner masukkan SN di aplikasi → toko aktif sesuai masa SN (default 3 bulan = 90 hari).
const LICENSE_DAYS = 90;
const LIC_STATUS = ['baru', 'dipost', 'terjual', 'terpakai', 'dicabut']; // dipost = diposting manual di Lynk.id (tidak diambil webhook)

function licFormat(raw) {
  let s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('JCF')) s = s.slice(3);
  if (s.length !== 12) return null;
  return 'JCF-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
}
const licNew = () => 'JCF-' + randCode(4) + '-' + randCode(4) + '-' + randCode(4);
const digits = (p) => String(p || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
const daysLabel = (d) => (d % 365 === 0 ? d / 365 + ' tahun' : d % 30 === 0 ? d / 30 + ' bulan' : d + ' hari');

// percobaan gagal (anti tebak SN), disimpan di jd_settings
async function hitLimit(env, key, max, windowMs) {
  const v = await getSetting(env, key, ''); const [n, t] = v.split('|').map(Number);
  const now = Date.now(); const fresh = !t || now - t > windowMs;
  return { blocked: !fresh && n >= max, add: async () => setSetting(env, key, (fresh ? 1 : n + 1) + '|' + (fresh ? now : t)) };
}

async function activateLicense(env, store, rawCode, byName) {
  if (store.is_demo) fail(400, 'Toko demo tidak bisa diaktivasi. Daftar toko dulu.');
  if (store.status === 'blocked') fail(403, 'Toko diblokir. Hubungi Head Admin.');
  const lim = await hitLimit(env, 'licfail:' + store.id, 8, 3600000);
  if (lim.blocked) fail(429, 'Terlalu banyak percobaan salah. Coba lagi 1 jam lagi atau hubungi Head Admin.');
  const code = licFormat(rawCode);
  const now = nowIso();
  const lic = code && await env.DB.prepare(
    `UPDATE jd_licenses SET status='terpakai', store_id=?, store_name=?, used_by=?, used_at=? WHERE code=? AND status IN ('baru','dipost','terjual') RETURNING id, code, days`
  ).bind(store.id, store.name, byName, now, code).first();
  if (!lic) {
    await lim.add();
    const ex = code && await env.DB.prepare(`SELECT status, store_name FROM jd_licenses WHERE code=?`).bind(code).first();
    if (ex?.status === 'terpakai') fail(400, 'Serial number ini sudah dipakai' + (ex.store_name ? ' oleh toko "' + ex.store_name + '"' : '') + '.');
    if (ex?.status === 'dicabut') fail(400, 'Serial number ini sudah dinonaktifkan. Hubungi Head Admin.');
    fail(400, 'Serial number tidak valid. Periksa lagi penulisannya (format JCF-XXXX-XXXX-XXXX).');
  }
  // sisa trial / langganan tidak hangus: ditambahkan dari tanggal berakhir terakhir
  const base = Math.max(Date.now(), store.trial_end ? Date.parse(store.trial_end) : 0, store.paid_until ? Date.parse(store.paid_until) : 0);
  const until = new Date(base + lic.days * DAY).toISOString();
  await env.DB.prepare(`UPDATE jd_stores SET paid_until=?, status='active' WHERE id=?`).bind(until, store.id).run();
  const msg = `🔑 <b>Lisensi diaktifkan</b>\n🏪 ${escHtml(store.name)}\n🎫 ${lic.code} (${daysLabel(lic.days)})\n📅 Aktif s/d ${localDate(new Date(until))}`;
  await Promise.allSettled([notifyAdmin(env, msg), store.tg_chat_id ? sendTG(env, store.tg_chat_id, msg) : null]);
  return { ok: true, code: lic.code, days: lic.days, paid_until: until, note: `Lisensi ${daysLabel(lic.days)} aktif s/d ${localDate(new Date(until))}` };
}

// ---------------------------------------------------------------- API toko (owner / OM / admin), tetap bisa walau trial habis
async function licenseStoreApi(req, env, auth, path, method) {
  if (!path.startsWith('/api/license')) return null;
  if (!auth || !auth.store) fail(401, 'Silakan login');
  if (!['owner', 'om', 'admin'].includes(auth.user.role)) fail(403, 'Aktivasi lisensi hanya oleh Owner / OM / Admin');
  if (path === '/api/license' && method === 'GET') {
    const r = await env.DB.prepare(`SELECT code, days, used_by, used_at FROM jd_licenses WHERE store_id=? ORDER BY used_at DESC LIMIT 50`).bind(auth.store.id).all();
    return json({ history: r.results.map((x) => ({ ...x, code: x.code.slice(0, 8) + '-••••-••••' })), buy_url: await getSetting(env, 'lynk_url', '') });
  }
  if (path === '/api/license/activate' && method === 'POST') {
    const b = await body(req);
    return json(await activateLicense(env, auth.store, b.code, auth.user.name || auth.user.username));
  }
  fail(404, 'Endpoint tidak ditemukan');
}

// ---------------------------------------------------------------- API Head Admin
async function licenseAdmin(req, env, path, method) {
  const DB = env.DB; let m;
  if (path === '/api/admin/licenses' && method === 'GET') {
    const u = new URL(req.url); const st = u.searchParams.get('status') || ''; const q = str(u.searchParams.get('q'), 60);
    const where = []; const args = [];
    if (LIC_STATUS.includes(st)) { where.push('status=?'); args.push(st); }
    if (q) { where.push('(code LIKE ? OR buyer_name LIKE ? OR buyer_email LIKE ? OR buyer_phone LIKE ? OR store_name LIKE ? OR batch LIKE ? OR order_ref LIKE ?)'); for (let i = 0; i < 7; i++) args.push('%' + q + '%'); }
    const rows = (await DB.prepare(`SELECT * FROM jd_licenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 1000`).bind(...args).all()).results;
    const c = (await DB.prepare(`SELECT status, COUNT(*) n FROM jd_licenses GROUP BY status`).all()).results;
    const counts = Object.fromEntries(c.map((x) => [x.status, x.n]));
    if (u.searchParams.get('format') === 'csv') {
      const cols = ['code', 'days', 'status', 'batch', 'buyer_name', 'buyer_email', 'buyer_phone', 'order_ref', 'sold_at', 'store_name', 'used_at', 'created_at'];
      const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const csv = '﻿' + cols.join(',') + '\n' + rows.map((r) => cols.map((k) => esc(r[k])).join(',')).join('\n');
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lisensi-jcoffe-${st || 'semua'}-${localDate()}.csv"`, 'cache-control': 'no-store' } });
    }
    return json({ licenses: rows, counts });
  }
  if (path === '/api/admin/licenses' && method === 'POST') {
    const b = await body(req);
    const n = Math.min(500, Math.max(1, int(b.count, 1))); const days = Math.min(3650, Math.max(1, int(b.days, LICENSE_DAYS)));
    const batch = str(b.batch, 40) || (b.mode === 'stok' ? 'Stok ' : 'Lynk ') + localDate(); const now = nowIso(); const codes = new Set();
    const status = b.mode === 'stok' ? 'baru' : 'dipost';
    while (codes.size < n) codes.add(licNew());
    const list = [...codes];
    for (let i = 0; i < list.length; i += 50) {
      await DB.batch(list.slice(i, i + 50).map((c) => DB.prepare(`INSERT OR IGNORE INTO jd_licenses (code, days, batch, status, created_at) VALUES (?, ?, ?, ?, ?)`).bind(c, days, batch, status, now)));
    }
    return json({ ok: true, codes: list, days, batch, status });
  }
  if ((m = path.match(/^\/api\/admin\/licenses\/(\d+)$/)) && method === 'PUT') {
    const id = int(m[1]); const b = await body(req);
    const l = await DB.prepare(`SELECT * FROM jd_licenses WHERE id=?`).bind(id).first();
    if (!l) fail(404, 'SN tidak ditemukan');
    if (b.action === 'sell') {
      if (!['baru', 'dipost', 'terjual'].includes(l.status)) fail(400, 'SN ini sudah ' + l.status);
      const name = str(b.buyer_name, 80); const phone = str(b.buyer_phone, 30); const email = str(b.buyer_email, 120).toLowerCase();
      await DB.prepare(`UPDATE jd_licenses SET status='terjual', buyer_name=?, buyer_phone=?, buyer_email=?, order_ref=COALESCE(NULLIF(?, ''), order_ref), sold_at=? WHERE id=?`).bind(name, phone, email, str(b.order_ref, 80), nowIso(), id).run();
      const origin = new URL(req.url).origin;
      return json({ ok: true, wa_link: phone ? `https://wa.me/${digits(phone)}?text=${encodeURIComponent(buyerMessage(origin, l.code, l.days, name))}` : null, message: buyerMessage(origin, l.code, l.days, name) });
    }
    if (b.action === 'unsell') { if (l.status !== 'terjual') fail(400, 'Hanya SN berstatus terjual'); await DB.prepare(`UPDATE jd_licenses SET status='baru', buyer_name=NULL, buyer_phone=NULL, buyer_email=NULL, order_ref=NULL, sold_at=NULL WHERE id=?`).bind(id).run(); return json({ ok: true }); }
    if (b.action === 'revoke') { if (l.status === 'terpakai') fail(400, 'SN sudah dipakai toko. Untuk menghentikan, pakai menu toko → Hentikan masa aktif.'); await DB.prepare(`UPDATE jd_licenses SET status='dicabut' WHERE id=?`).bind(id).run(); return json({ ok: true }); }
    if (b.action === 'restore') { if (l.status !== 'dicabut') fail(400, 'SN tidak dicabut'); await DB.prepare(`UPDATE jd_licenses SET status=CASE WHEN sold_at IS NOT NULL THEN 'terjual' WHEN batch LIKE 'Lynk %' THEN 'dipost' ELSE 'baru' END WHERE id=?`).bind(id).run(); return json({ ok: true }); }
    fail(400, 'Aksi tidak dikenal');
  }
  if (path === '/api/admin/lynk' && method === 'GET') {
    let token = await getSetting(env, 'lynk_token', '');
    if (!token) { token = randToken(24); await setSetting(env, 'lynk_token', token); }
    const logs = (await DB.prepare(`SELECT id, ref, event, result, created_at FROM jd_lynk_log ORDER BY id DESC LIMIT 20`).all()).results;
    return json({ webhook_url: new URL(req.url).origin + '/lynk/webhook/' + token, claim_url: new URL(req.url).origin + '/klaim', buy_short: new URL(req.url).origin + '/beli',
      lynk_url: await getSetting(env, 'lynk_url', ''), keyword: await getSetting(env, 'lynk_keyword', ''), days: int(await getSetting(env, 'lynk_days', ''), LICENSE_DAYS), logs });
  }
  if (path === '/api/admin/lynk' && method === 'PUT') {
    const b = await body(req);
    const url = str(b.lynk_url, 300); if (url && !/^https:\/\//.test(url)) fail(400, 'Link Lynk harus diawali https://');
    await setSetting(env, 'lynk_url', url); await setSetting(env, 'lynk_keyword', str(b.keyword, 60)); await setSetting(env, 'lynk_days', Math.max(1, int(b.days, LICENSE_DAYS)));
    return json({ ok: true });
  }
  if (path === '/api/admin/lynk/token' && method === 'POST') { await setSetting(env, 'lynk_token', randToken(24)); return json({ ok: true }); }
  if ((m = path.match(/^\/api\/admin\/lynk\/log\/(\d+)$/)) && method === 'GET') { return json(await DB.prepare(`SELECT * FROM jd_lynk_log WHERE id=?`).bind(int(m[1])).first() || {}); }
  return null;
}

function buyerMessage(origin, code, days, name) {
  return `Halo${name ? ' ' + name : ''}, terima kasih sudah membeli lisensi JCOFFE POS 🙏\n\n🔑 Serial number kamu:\n${code}\n(masa aktif ${daysLabel(days)})\n\nCara aktivasi:\n1. Unduh / buka aplikasi: ${origin}/download\n2. Daftar toko (atau login jika sudah punya)\n3. Tap badge Trial di kanan atas (atau menu Lainnya → Lisensi)\n4. Masukkan serial number → Aktifkan\n\nSisa trial tidak hangus, langsung ditambahkan. Butuh bantuan? Balas pesan ini.`;
}

// ---------------------------------------------------------------- webhook Lynk.id + halaman klaim publik
function lynkParse(p) {
  const d = p?.data || {}; const md = d.message_data || d.data || d || {};
  const c = md.customer || md.buyer || d.customer || {};
  const items = Array.isArray(md.items) ? md.items : Array.isArray(md.products) ? md.products : Array.isArray(md.orders) ? md.orders : [];
  return {
    event: String(p?.event || p?.type || ''), action: String(d.message_action || d.status || md.status || ''),
    ref: String(md.refId || md.ref_id || md.order_id || md.orderId || md.invoice || md.id || p?.id || ''),
    name: String(c.name || c.full_name || md.customer_name || ''), email: String(c.email || md.customer_email || md.email || '').toLowerCase(),
    phone: String(c.phone || c.phone_number || c.whatsapp || md.customer_phone || md.phone || ''),
    items: (items.length ? items : [{ title: md.product_name || md.title || md.product?.title || '', qty: 1 }]).map((it) => ({
      title: String(it.title || it.name || it.product_name || it.product?.title || ''), qty: Math.max(1, int(it.qty ?? it.quantity ?? it.amount_item, 1)),
    })),
  };
}
function titleDays(title, def) {
  const t = title.toLowerCase(); let m;
  if ((m = t.match(/(\d+)\s*(tahun|thn|year)/))) return int(m[1]) * 365;
  if ((m = t.match(/(\d+)\s*(bulan|bln|month)/))) return int(m[1]) * 30;
  if ((m = t.match(/(\d+)\s*(hari|day)/))) return int(m[1]);
  return def;
}

async function lynkWebhook(req, env, ctx, tokenIn) {
  const token = await getSetting(env, 'lynk_token', '');
  if (!token || tokenIn.length !== token.length || (await hmacHex('x', tokenIn)) !== (await hmacHex('x', token))) return json({ error: 'forbidden' }, 403);
  const raw = (await req.text()).slice(0, 20000); let p = {};
  try { p = JSON.parse(raw); } catch { /* bukan JSON */ }
  const o = lynkParse(p); const DB = env.DB; const now = nowIso();
  const log = async (result) => { await DB.prepare(`INSERT INTO jd_lynk_log (ref, event, result, payload, created_at) VALUES (?, ?, ?, ?, ?)`).bind(o.ref, o.event, result, raw.slice(0, 8000), now).run(); await DB.prepare(`DELETE FROM jd_lynk_log WHERE id NOT IN (SELECT id FROM jd_lynk_log ORDER BY id DESC LIMIT 200)`).run(); };
  const paid = /payment|paid|success|complete|settle/i.test(o.event + ' ' + o.action) && !/fail|cancel|expire|refund|pending/i.test(o.action);
  if (!paid || !o.ref) { await log(o.ref ? 'diabaikan (bukan pembayaran sukses)' : 'diabaikan (tanpa refId / tes)'); return json({ ok: true, ignored: true }); }
  const kw = (await getSetting(env, 'lynk_keyword', '')).toLowerCase(); const defDays = int(await getSetting(env, 'lynk_days', ''), LICENSE_DAYS);
  const wanted = o.items.filter((it) => !kw || it.title.toLowerCase().includes(kw));
  if (!wanted.length) { await log('diabaikan (produk bukan lisensi)'); return json({ ok: true, ignored: true }); }
  const dup = await DB.prepare(`INSERT OR IGNORE INTO jd_lynk_orders (ref, created_at) VALUES (?, ?)`).bind(o.ref, now).run();
  if (!dup.meta.changes) { await log('duplikat (sudah diproses)'); return json({ ok: true, duplicate: true }); }
  const codes = [];
  for (const it of wanted) {
    const days = titleDays(it.title, defDays);
    for (let i = 0; i < Math.min(it.qty, 20) && codes.length < 20; i++) {
      // ambil SN stok (status baru) dengan masa yang sama; kalau habis, buat otomatis
      let r = await DB.prepare(`UPDATE jd_licenses SET status='terjual', buyer_name=?, buyer_email=?, buyer_phone=?, order_ref=?, sold_at=? WHERE id=(SELECT id FROM jd_licenses WHERE status='baru' AND days=? ORDER BY id LIMIT 1) RETURNING code, days`)
        .bind(o.name, o.email, o.phone, o.ref, now, days).first();
      if (!r) { const c = licNew(); await DB.prepare(`INSERT INTO jd_licenses (code, days, batch, status, buyer_name, buyer_email, buyer_phone, order_ref, sold_at, created_at) VALUES (?, ?, 'Otomatis Lynk', 'terjual', ?, ?, ?, ?, ?, ?)`).bind(c, days, o.name, o.email, o.phone, o.ref, now, now).run(); r = { code: c, days }; }
      codes.push(r);
    }
  }
  await log('SN terkirim: ' + codes.map((c) => c.code).join(', '));
  const origin = new URL(req.url).origin;
  const wa = o.phone ? `https://wa.me/${digits(o.phone)}?text=${encodeURIComponent(buyerMessage(origin, codes.map((c) => c.code).join('\n'), codes[0].days, o.name))}` : '';
  ctx.waitUntil(notifyAdmin(env, `🛒 <b>Penjualan Lynk.id</b>\n👤 ${escHtml(o.name || '-')} · ${escHtml(o.phone || '-')}\n✉️ ${escHtml(o.email || '-')}\n🧾 ${escHtml(o.ref)}\n🔑 ${codes.map((c) => `<code>${c.code}</code> (${daysLabel(c.days)})`).join('\n')}` + (wa ? `\n\n<a href="${escHtml(wa)}">📲 Kirim SN ke WhatsApp pembeli</a>` : '')));
  return json({ ok: true, codes: codes.length });
}

async function licensePublic(req, env, ctx, path, method) {
  let m;
  if ((m = path.match(/^\/lynk\/webhook\/([A-Za-z0-9]{10,64})$/)) && method === 'POST') return lynkWebhook(req, env, ctx, m[1]);
  if (path === '/lynk/webhook' && method === 'POST') return lynkWebhook(req, env, ctx, new URL(req.url).searchParams.get('token') || '');
  if (path === '/beli') { const u = await getSetting(env, 'lynk_url', ''); return redirect(u || '/promo'); }
  if (path === '/klaim' && method === 'GET') return html(CLAIM_HTML);
  if (path === '/api/public/klaim' && method === 'POST') {
    const ip = req.headers.get('cf-connecting-ip') || 'x';
    const lim = await hitLimit(env, 'klaim:' + ip, 10, 3600000);
    if (lim.blocked) fail(429, 'Terlalu banyak percobaan. Coba lagi 1 jam lagi atau chat admin.');
    const b = await body(req); const email = str(b.email, 120).toLowerCase(); const ph = digits(b.phone);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || ph.length < 9) fail(400, 'Isi email dan nomor WhatsApp yang dipakai saat membeli di Lynk.id');
    const rows = (await env.DB.prepare(`SELECT code, days, status, buyer_phone, sold_at FROM jd_licenses WHERE lower(buyer_email)=? AND status IN ('terjual','terpakai') ORDER BY id DESC LIMIT 20`).bind(email).all()).results
      .filter((r) => { const p = digits(r.buyer_phone); return !p || p.slice(-7) === ph.slice(-7); });
    if (!rows.length) { await lim.add(); fail(404, 'Belum ada serial number untuk email & nomor ini. Jika baru bayar, tunggu 1–2 menit lalu coba lagi. Masih kosong? Chat admin.'); }
    return json({ licenses: rows.map((r) => ({ code: r.code, days: r.days, label: daysLabel(r.days), used: r.status === 'terpakai', sold_at: r.sold_at })) });
  }
  return null;
}
