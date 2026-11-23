// ================================================================ FITUR TAMBAHAN (server)
// Role & hak akses, meja + QR, pesanan pelanggan, chat Head Admin, struk publik, update APK, promo.

const DEFAULT_ADMIN_WA = '628134064173'; // 0813-4064-173 (Head Admin)
const APP_NAME = 'JCOFFE POS';
const APK_VERSION = 3;
const APK_GITHUB_URL = 'https://github.com/muchlis7771-svg/Aplikasi-Kasir-POS-Gratis-.apk/raw/jcoffe-pos/apk/JCOFFE-POS.apk';
const APK_NOTES = 'Logo JCOFFE baru, pesanan QR meja dengan alarm, cetak struk Bluetooth (RawBT), role & hak akses.';

const PERM_LIST = [
  ['kasir', 'Kasir / transaksi'], ['pesanan', 'Pesanan QR meja'], ['trx_all', 'Lihat semua transaksi'], ['trx_void', 'Batalkan transaksi'],
  ['laporan', 'Laporan & ekspor'], ['menu', 'Kelola menu & resep'], ['stok', 'Kelola bahan / stok'], ['stok_adjust', 'Catat stok masuk / keluar'],
  ['promo', 'Kelola promo'], ['meja', 'Kelola meja & QR'], ['users', 'Kelola pengguna'], ['toko', 'Profil toko & struk'], ['telegram', 'Bot Telegram'],
];
const ALL_PERMS = PERM_LIST.map((p) => p[0]);
const ROLES = [['om', 'Operational Manager'], ['admin', 'Admin'], ['spv', 'Supervisor'], ['kasir', 'Kasir / Barista']];
const ROLE_LABEL = { owner: 'Owner', om: 'Operational Manager', admin: 'Admin', spv: 'Supervisor', kasir: 'Kasir / Barista', headadmin: 'Head Admin' };
const ROLE_DESC = {
  om: 'Mengatur operasional harian: menu, stok, promo, meja, laporan, dan tim.',
  admin: 'Back office: kelola menu, resep, stok, promo, meja & QR, profil struk, lihat laporan.',
  spv: 'Pimpin shift: kasir, pesanan meja, lihat semua transaksi, batalkan transaksi, catat stok masuk, laporan.',
  kasir: 'Layani pelanggan: transaksi kasir dan pesanan dari QR meja.',
};
const DEFAULT_PERMS = {
  om: ALL_PERMS.filter((p) => p !== 'telegram'),
  admin: ['kasir', 'pesanan', 'trx_all', 'laporan', 'menu', 'stok', 'stok_adjust', 'promo', 'meja', 'toko'],
  spv: ['kasir', 'pesanan', 'trx_all', 'trx_void', 'laporan', 'stok_adjust'],
  kasir: ['kasir', 'pesanan'],
};

async function permsFor(env, store, role) {
  if (role === 'owner') return [...ALL_PERMS];
  const r = await env.DB.prepare(`SELECT perms FROM jd_role_perms WHERE store_id = ? AND role = ?`).bind(store.id, role).first();
  if (r) { try { return JSON.parse(r.perms).filter((p) => ALL_PERMS.includes(p)); } catch { /* pakai default */ } }
  return [...(DEFAULT_PERMS[role] || [])];
}
function requireStoreSoft(auth) {
  if (auth.store && !auth.access.ok && auth.access.label === 'expired' && !auth.store.is_demo) { auth.limited = true; auth.perms = auth.perms.filter((p) => LIMITED_PERMS.includes(p)); }
}
async function apkInfo(env) {
  return {
    version: int(await getSetting(env, 'apk_version'), 0) || APK_VERSION,
    url: (await getSetting(env, 'apk_url')) || APK_GITHUB_URL,
    notes: (await getSetting(env, 'apk_notes')) || APK_NOTES,
  };
}
async function signKey(env) {
  let k = await getSetting(env, 'sign_key');
  if (!k) { k = randToken(40); await setSetting(env, 'sign_key', k); }
  return k;
}
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig).slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function receiptUrl(env, origin, trxId) { return `${origin}/r/${trxId}/${await hmacHex(await signKey(env), 'r' + trxId)}`; }
async function storeQrKey(env, store) {
  if (store.qr_key) return store.qr_key;
  const k = randCode(12).toLowerCase();
  await env.DB.prepare(`UPDATE jd_stores SET qr_key = ? WHERE id = ?`).bind(k, store.id).run();
  return k;
}
const tableToken = () => randCode(10).toLowerCase();

// ---------------------------------------------------------------- API toko (dipanggil dari storeApi)
async function featureApi(req, env, ctx, auth, path, method, need, has) {
  const DB = env.DB; const sid = auth.store.id; const origin = new URL(req.url).origin; let m;

  // ---- role & hak akses (khusus owner)
  if (path === '/api/roles') {
    if (auth.user.role !== 'owner') fail(403, 'Hanya owner yang bisa mengatur hak akses');
    if (method === 'GET') {
      const rows = (await DB.prepare(`SELECT role, perms FROM jd_role_perms WHERE store_id = ?`).bind(sid).all()).results;
      const roles = {};
      for (const [r] of ROLES) { const row = rows.find((x) => x.role === r); roles[r] = row ? JSON.parse(row.perms) : DEFAULT_PERMS[r]; }
      return json({ perm_list: PERM_LIST, roles: ROLES.map(([k, l]) => ({ key: k, label: l, desc: ROLE_DESC[k], perms: roles[k], defaults: DEFAULT_PERMS[k] })) });
    }
    if (method === 'PUT') {
      if (auth.store.is_demo) fail(400, 'Tidak tersedia di mode demo');
      const b = await body(req);
      if (!ROLES.some((r) => r[0] === b.role)) fail(400, 'Role tidak dikenal');
      const perms = (Array.isArray(b.perms) ? b.perms : []).filter((p) => ALL_PERMS.includes(p));
      if (b.reset) await DB.prepare(`DELETE FROM jd_role_perms WHERE store_id = ? AND role = ?`).bind(sid, b.role).run();
      else await DB.prepare(`INSERT INTO jd_role_perms (store_id, role, perms) VALUES (?, ?, ?) ON CONFLICT(store_id, role) DO UPDATE SET perms = excluded.perms`).bind(sid, b.role, JSON.stringify(perms)).run();
      return json({ ok: true });
    }
  }

  // ---- meja & QR
  if (path === '/api/tables' && method === 'GET') {
    need('meja', 'pesanan');
    const tables = (await DB.prepare(`SELECT * FROM jd_tables WHERE store_id = ? ORDER BY id`).bind(sid).all()).results;
    for (const t of tables) t.url = `${origin}/m/${t.token}`;
    return json({ tables, print_url: `${origin}/qr/${await storeQrKey(env, auth.store)}` });
  }
  if (path === '/api/tables' && method === 'POST') {
    need('meja'); const b = await body(req);
    let names = [];
    if (int(b.count) > 0) { const start = Math.max(1, int(b.start, 1)); const pre = str(b.prefix, 30) || 'Meja'; for (let i = 0; i < Math.min(int(b.count), 60); i++) names.push(`${pre} ${start + i}`); }
    else if (str(b.name)) names = [str(b.name, 40)];
    if (!names.length) fail(400, 'Isi nama meja atau jumlah meja');
    const cnt = await DB.prepare(`SELECT COUNT(*) n FROM jd_tables WHERE store_id = ?`).bind(sid).first();
    if (cnt.n + names.length > 200) fail(400, 'Maksimal 200 meja per toko');
    await DB.batch(names.map((n) => DB.prepare(`INSERT INTO jd_tables (store_id, name, token, active, created_at) VALUES (?, ?, ?, 1, ?)`).bind(sid, n, tableToken(), nowIso())));
    return json({ ok: true, added: names.length });
  }
  if ((m = path.match(/^\/api\/tables\/(\d+)$/))) {
    need('meja'); const id = int(m[1]);
    if (method === 'PUT') {
      const b = await body(req);
      if (b.regen) await DB.prepare(`UPDATE jd_tables SET token = ? WHERE id = ? AND store_id = ?`).bind(tableToken(), id, sid).run();
      if (str(b.name)) await DB.prepare(`UPDATE jd_tables SET name = ? WHERE id = ? AND store_id = ?`).bind(str(b.name, 40), id, sid).run();
      if ('active' in b) await DB.prepare(`UPDATE jd_tables SET active = ? WHERE id = ? AND store_id = ?`).bind(b.active ? 1 : 0, id, sid).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') { await DB.prepare(`DELETE FROM jd_tables WHERE id = ? AND store_id = ?`).bind(id, sid).run(); return json({ ok: true }); }
  }

  // ---- pesanan dari QR meja
  if (path === '/api/orders/poll' && method === 'GET') {
    need('pesanan');
    const r = await DB.prepare(`SELECT COUNT(*) n, COALESCE(MAX(id),0) max_id FROM jd_orders WHERE store_id = ? AND status = 'baru'`).bind(sid).first();
    const last = await DB.prepare(`SELECT id, table_name, customer, total FROM jd_orders WHERE store_id = ? AND status = 'baru' ORDER BY id DESC LIMIT 1`).bind(sid).first();
    return json({ pending: r.n, max_id: r.max_id, latest: last || null });
  }
  if (path === '/api/orders' && method === 'GET') {
    need('pesanan');
    const since = new Date(Date.now() - 2 * DAY).toISOString();
    const orders = (await DB.prepare(`SELECT * FROM jd_orders WHERE store_id = ? AND (status IN ('baru','diproses') OR created_at > ?) ORDER BY CASE status WHEN 'baru' THEN 0 WHEN 'diproses' THEN 1 ELSE 2 END, id DESC LIMIT 100`).bind(sid, since).all()).results;
    for (const o of orders) { try { o.items = JSON.parse(o.items); } catch { o.items = []; } }
    return json({ orders });
  }
  if ((m = path.match(/^\/api\/orders\/(\d+)$/)) && method === 'PUT') {
    need('pesanan'); const b = await body(req);
    const st = { accept: 'diproses', reject: 'ditolak', done: 'selesai' }[b.action];
    if (!st) fail(400, 'Aksi tidak dikenal');
    await DB.prepare(`UPDATE jd_orders SET status = ?, updated_at = ? WHERE id = ? AND store_id = ?`).bind(st, nowIso(), int(m[1]), sid).run();
    return json({ ok: true, status: st });
  }

  // ---- link struk publik (untuk cetak di browser / kirim ke pelanggan)
  if ((m = path.match(/^\/api\/receipt-link\/(\d+)$/)) && method === 'GET') {
    const t = await DB.prepare(`SELECT id FROM jd_transactions WHERE id = ? AND store_id = ?`).bind(int(m[1]), sid).first();
    if (!t) fail(404, 'Transaksi tidak ditemukan');
    return json({ url: await receiptUrl(env, origin, t.id) });
  }
  return null;
}

// ---------------------------------------------------------------- chat / keluhan ke Head Admin
async function supportPost(req, env, ctx, auth) {
  if (!auth || !auth.store) fail(401, 'Silakan login');
  const b = await body(req);
  const cat = str(b.category, 40) || 'Lainnya'; const msg = str(b.message, 1000);
  if (!msg) fail(400, 'Tulis pesannya dulu');
  await env.DB.prepare(`INSERT INTO jd_support (store_id, user_id, store_name, user_name, category, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(auth.store.id, auth.user.id, auth.store.name, auth.user.name || auth.user.username, cat, msg, nowIso()).run();
  ctx.waitUntil(notifyAdmin(env, `📨 <b>Pesan dari toko</b>\n🏪 ${escHtml(auth.store.name)} — ${escHtml(auth.user.name || auth.user.username)} (${escHtml(ROLE_LABEL[auth.user.role] || '')})\n🏷️ ${escHtml(cat)}\n\n${escHtml(msg)}`));
  const wa = (await getSetting(env, 'admin_wa', '')) || DEFAULT_ADMIN_WA;
  const text = `Halo Head Admin JCOFFE,\n[${cat}]\nToko: ${auth.store.name}\nDari: ${auth.user.name || auth.user.username} (${ROLE_LABEL[auth.user.role] || auth.user.role})\n\n${msg}`;
  return json({ ok: true, wa_link: `https://wa.me/${wa}?text=${encodeURIComponent(text)}` });
}

async function adminExtra(req, env, path, method) {
  if (path === '/api/admin/support' && method === 'GET') {
    const r = await env.DB.prepare(`SELECT * FROM jd_support ORDER BY id DESC LIMIT 200`).all();
    const unread = await env.DB.prepare(`SELECT COUNT(*) n FROM jd_support WHERE is_read = 0`).first();
    return json({ messages: r.results, unread: unread.n });
  }
  const m = path.match(/^\/api\/admin\/support\/(\d+)$/);
  if (m && method === 'PUT') { await env.DB.prepare(`UPDATE jd_support SET is_read = 1 WHERE id = ?`).bind(int(m[1])).run(); return json({ ok: true }); }
  if (path === '/api/admin/support/read-all' && method === 'POST') { await env.DB.prepare(`UPDATE jd_support SET is_read = 1`).run(); return json({ ok: true }); }
  return null;
}

// ---------------------------------------------------------------- halaman & API publik (tanpa login)
async function publicRoutes(req, env, ctx, path, method) {
  const DB = env.DB; let m;
  if (path === '/api/app-version') return json(await apkInfo(env));

  // halaman pesan dari QR meja
  if ((m = path.match(/^\/m\/([a-z0-9]{6,20})$/)) && method === 'GET') return html(ORDER_HTML);
  if (path === '/api/public/menu' && method === 'GET') {
    const t = await publicTable(env, new URL(req.url).searchParams.get('t'));
    const menu = (await DB.prepare(`SELECT id, name, category, price FROM jd_menu WHERE store_id = ? AND active = 1 ORDER BY category, name`).bind(t.store.id).all()).results;
    return json({ store: { name: t.store.name, address: t.store.address || '' }, table: { name: t.table.name }, menu });
  }
  if (path === '/api/public/order' && method === 'POST') {
    const b = await body(req);
    const t = await publicTable(env, b.t);
    const recent = await DB.prepare(`SELECT COUNT(*) n FROM jd_orders WHERE table_id = ? AND created_at > ?`).bind(t.table.id, new Date(Date.now() - 15000).toISOString()).first();
    if (recent.n) fail(429, 'Pesanan baru saja dikirim. Tunggu sebentar sebelum mengirim lagi.');
    const lines = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map((x) => ({ id: int(x.menu_id), qty: Math.min(50, int(x.qty)) })).filter((x) => x.qty > 0);
    if (!lines.length) fail(400, 'Pilih menu dulu');
    const ids = [...new Set(lines.map((l) => l.id))];
    const menus = (await DB.prepare(`SELECT id, name, price FROM jd_menu WHERE store_id = ? AND active = 1 AND id IN (${ids.map(() => '?').join(',')})`).bind(t.store.id, ...ids).all()).results;
    const items = []; let total = 0;
    for (const l of lines) { const mm = menus.find((x) => x.id === l.id); if (!mm) continue; items.push({ menu_id: mm.id, name: mm.name, qty: l.qty, price: mm.price }); total += mm.price * l.qty; }
    if (!items.length) fail(400, 'Menu tidak tersedia');
    const now = nowIso();
    const o = await DB.prepare(`INSERT INTO jd_orders (store_id, table_id, table_name, customer, note, items, total, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'baru', ?, ?) RETURNING id`)
      .bind(t.store.id, t.table.id, t.table.name, str(b.customer, 40) || 'Tamu', str(b.note, 200), JSON.stringify(items), total, now, now).first();
    if (t.store.tg_chat_id) ctx.waitUntil(sendTG(env, t.store.tg_chat_id, `🛎️ <b>PESANAN BARU — ${escHtml(t.table.name)}</b>\n👤 ${escHtml(str(b.customer, 40) || 'Tamu')}\n` + items.map((i) => `• ${escHtml(i.name)} x${i.qty}`).join('\n') + `\n<b>Total: ${rp(total)}</b>` + (str(b.note) ? `\n📝 ${escHtml(str(b.note, 200))}` : '')));
    return json({ ok: true, id: o.id });
  }
  if (path === '/api/public/order' && method === 'GET') {
    const u = new URL(req.url); const t = await publicTable(env, u.searchParams.get('t'));
    const o = await DB.prepare(`SELECT id, status, items, total, table_name, customer, created_at FROM jd_orders WHERE id = ? AND table_id = ?`).bind(int(u.searchParams.get('id')), t.table.id).first();
    if (!o) fail(404, 'Pesanan tidak ditemukan');
    o.items = JSON.parse(o.items || '[]');
    return json({ order: o });
  }

  // lembar cetak QR semua meja
  if ((m = path.match(/^\/qr\/([a-z0-9]{8,20})$/)) && method === 'GET') {
    const s = await DB.prepare(`SELECT id, name FROM jd_stores WHERE qr_key = ?`).bind(m[1]).first();
    if (!s) return html(page('QR', `<div class="p-10 text-center">Link QR tidak valid.</div>`), 404);
    const origin = new URL(req.url).origin;
    const tables = (await DB.prepare(`SELECT name, token FROM jd_tables WHERE store_id = ? AND active = 1 ORDER BY id`).bind(s.id).all()).results.map((t) => ({ name: t.name, url: `${origin}/m/${t.token}` }));
    return html(QR_PRINT_HTML.replace('__QR_DATA__', JSON.stringify({ store: s.name, tables }).replace(/</g, '\\u003c')));
  }

  // struk publik (dibuka dari link WA / untuk dicetak di browser)
  if ((m = path.match(/^\/r\/(\d+)\/([a-f0-9]{20})$/)) && method === 'GET') {
    if ((await hmacHex(await signKey(env), 'r' + m[1])) !== m[2]) return html(page('Struk', `<div class="p-10 text-center">Struk tidak ditemukan.</div>`), 404);
    const t = await DB.prepare(`SELECT * FROM jd_transactions WHERE id = ?`).bind(int(m[1])).first();
    if (!t) return html(page('Struk', `<div class="p-10 text-center">Struk tidak ditemukan.</div>`), 404);
    const s = await DB.prepare(`SELECT name, address, phone, receipt_note FROM jd_stores WHERE id = ?`).bind(t.store_id).first();
    t.items = (await DB.prepare(`SELECT name, qty, price, subtotal FROM jd_transaction_items WHERE trx_id = ?`).bind(t.id).all()).results;
    return html(RECEIPT_HTML.replace('__RCPT__', JSON.stringify({ store: s, trx: t }).replace(/</g, '\\u003c')));
  }

  // promo & unduh aplikasi
  if (path === '/promo' || path === '/download' || path === '/unduh') return html(PROMO_HTML, 200, { 'cache-control': 'public, max-age=300' });
  return null;
}
async function publicTable(env, token) {
  token = String(token || '').toLowerCase();
  if (!/^[a-z0-9]{6,20}$/.test(token)) fail(404, 'QR meja tidak valid');
  const table = await env.DB.prepare(`SELECT * FROM jd_tables WHERE token = ? AND active = 1`).bind(token).first();
  if (!table) fail(404, 'QR meja tidak valid atau sudah diganti. Minta QR baru ke kasir.');
  const store = await env.DB.prepare(`SELECT * FROM jd_stores WHERE id = ?`).bind(table.store_id).first();
  if (!store || store.status === 'blocked') fail(403, 'Toko sedang tidak menerima pesanan online');
  return { table, store };
}

function staticRoutes(path) {
  if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /promo\nAllow: /$\nDisallow: /api/\nDisallow: /app\nDisallow: /admin\nDisallow: /m/\nDisallow: /r/\nDisallow: /qr/\n', { headers: { 'content-type': 'text/plain' } });
  if (path === '/qr.js') return new Response(QR_JS, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
  if (path === '/jcoffe-pos.apk' || path === '/JCOFFE-POS.apk') return new Response(b64d(APK_B64), { headers: { 'content-type': 'application/vnd.android.package-archive', 'content-disposition': 'attachment; filename="JCOFFE-POS.apk"', 'cache-control': 'public, max-age=600' } });
  return null;
}
