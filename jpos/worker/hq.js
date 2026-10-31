// ============ PUSAT (HEAD ADMIN): PERPANJANGAN OTOMATIS & KOMPLAIN ============
// Perpanjangan: pemilik toko memilih paket & lama → tagihan dengan KODE UNIK (nominal + 1–999 rupiah).
// Begitu transfer masuk ke rekening Head Admin, layanan cek mutasi (Moota / sejenis) memanggil webhook → nominal cocok
// → masa aktif & paket toko diperpanjang otomatis. Tanpa layanan mutasi, Head Admin cukup menekan "Tandai lunas".
export const HSCHEMA = [
  "CREATE TABLE IF NOT EXISTS inv(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,tier TEXT,months INTEGER,base INTEGER,code INTEGER,amount INTEGER,status TEXT DEFAULT 'tunggu',t INTEGER,paid_t INTEGER,via TEXT,ref TEXT,by TEXT)",
  'CREATE INDEX IF NOT EXISTS inv_s ON inv(store_id,t)', 'CREATE INDEX IF NOT EXISTS inv_a ON inv(status,amount)',
  "CREATE TABLE IF NOT EXISTS tiket(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,sname TEXT,by TEXT,role TEXT,cat TEXT,sub TEXT,st TEXT DEFAULT 'baru',t INTEGER,upd INTEGER,uh INTEGER DEFAULT 1,us INTEGER DEFAULT 0,msgs TEXT)",
  'CREATE INDEX IF NOT EXISTS tiket_s ON tiket(store_id,upd)', 'CREATE INDEX IF NOT EXISTS tiket_u ON tiket(upd)',
];
const DAY = 864e5, INV_TTL = 3 * DAY, MONTHS = [1, 3, 6, 12];
const pj = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const CATS = { bug: 'Error / aplikasi bermasalah', pakai: 'Cara pakai', data: 'Data / sinkron', bayar: 'Pembayaran & paket', saran: 'Saran fitur', lain: 'Lainnya' };
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const imgOk = (s) => typeof s == 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 260000;

async function expireOld(env) { await env.DB.prepare("UPDATE inv SET status='kedaluwarsa' WHERE status='tunggu' AND t<?").bind(Date.now() - INV_TTL).run(); }
// lunasi tagihan → perpanjang toko (dipakai webhook & tombol Head Admin)
export async function invPay(env, id, via, ref) {
  const v = await env.DB.prepare("SELECT * FROM inv WHERE id=? AND status='tunggu'").bind(id).first(); if (!v) return null;
  const s = await env.DB.prepare('SELECT exp,tier FROM stores WHERE id=?').bind(v.store_id).first(); if (!s) return null;
  const now = Date.now(), exp = Math.max(now, s.exp || 0) + v.months * 30 * DAY;
  await env.DB.batch([
    env.DB.prepare("UPDATE inv SET status='lunas',paid_t=?,via=?,ref=? WHERE id=? AND status='tunggu'").bind(now, clip(via, 30), clip(ref, 80), id),
    env.DB.prepare("UPDATE stores SET exp=?,plan=?,tier=?,status='active' WHERE id=?").bind(exp, 'Langganan ' + v.months + ' bln', v.tier || s.tier || 'high', v.store_id),
    env.DB.prepare('INSERT INTO chat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind('tk:' + v.store_id, 'hq', 'Pemilik Aplikasi', 'Head Admin', `✅ Pembayaran Rp${v.amount.toLocaleString('id-ID')} diterima. Paket diperpanjang ${v.months} bulan s/d ${new Date(exp + 8 * 36e5).toISOString().slice(0, 10)}. Terima kasih!`, now),
  ]);
  return { ...v, exp };
}
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(key, txt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(txt))); }
const safeEq = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length != b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r == 0; };

// POST /api/pay/hook?key=…  (body mentah; Moota: header Signature = HMAC-SHA256(secret, body))
export async function payHook(env, req, u, J, C) {
  const raw = await req.text(), sig = req.headers.get('Signature') || req.headers.get('X-Signature') || '';
  const okKey = C.pay_key && safeEq(u.searchParams.get('key'), C.pay_key), okSig = C.pay_moota && sig && safeEq(sig.toLowerCase(), await hmac(C.pay_moota, raw));
  if (!okKey && !okSig) return J({ e: 'unauthorized' }, 401);
  await expireOld(env);
  let d = pj(raw, null); if (d && !Array.isArray(d)) d = Array.isArray(d.data) ? d.data : Array.isArray(d.mutations) ? d.mutations : [d];
  const res = [];
  for (const m of (d || []).slice(0, 200)) {
    const ty = String(m.type || m.tipe || 'CR').toUpperCase(), amt = Math.round(+String(m.amount ?? m.nominal ?? m.jumlah ?? 0).replace(/[^\d.]/g, ''));
    if (!(amt > 0) || !/^(CR|C|CREDIT|IN|MASUK|K|KREDIT)$/.test(ty)) continue;
    const ref = clip(m.mutation_id || m.id || m.reference || (m.date || '') + ':' + amt, 80);
    if (await env.DB.prepare('SELECT 1 FROM inv WHERE ref=?').bind(ref).first()) { res.push({ amt, dup: 1 }); continue; }
    const L = (await env.DB.prepare("SELECT id FROM inv WHERE status='tunggu' AND amount=?").bind(amt).all()).results;
    if (L.length == 1) { const r = await invPay(env, L[0].id, okSig ? 'moota' : 'webhook', ref); res.push({ amt, inv: L[0].id, ok: !!r }); } else res.push({ amt, match: L.length });
  }
  return J({ ok: 1, res });
}

// rute toko (sudah login). Berjalan walau masa aktif habis, agar bisa perpanjang & komplain.
export async function hqStore(x) {
  const { env, p, M, b, J, sid, uname, role, C, pkgAll, sname, limited } = x, now = Date.now();
  if (p == '/api/renew') {
    await expireOld(env); const pk = pkgAll(), pr = {}; for (const t of Object.keys(pk)) pr[t] = { n: pk[t].n, pr: pk[t].pr || 0, max: pk[t].max };
    if (M == 'POST') {
      if (role != 'owner') return J({ e: 'Hanya pemilik toko yang bisa memperpanjang paket' }, 403);
      if (await limited(env, 'inv:' + sid, 12, DAY)) return J({ e: 'Terlalu banyak tagihan dibuat hari ini' }, 429);
      if (b.cancel) { await env.DB.prepare("UPDATE inv SET status='batal' WHERE id=? AND store_id=? AND status='tunggu'").bind(+b.cancel, sid).run(); }
      else {
        const tier = pr[b.tier] ? b.tier : null, mo = MONTHS.includes(+b.months) ? +b.months : 0;
        if (!tier || !mo || !(pr[tier].pr > 0)) return J({ e: 'Pilih paket & lama langganan' }, 400);
        if (!C.pay_bank) return J({ e: 'Rekening pembayaran belum diatur pemilik aplikasi. Hubungi Head Admin.' }, 400);
        await env.DB.prepare("UPDATE inv SET status='batal' WHERE store_id=? AND status='tunggu'").bind(sid).run();
        const base = pr[tier].pr * mo, used = new Set((await env.DB.prepare("SELECT code FROM inv WHERE status='tunggu' AND base=?").bind(base).all()).results.map((r) => r.code));
        let code = 0; for (let i = 0; i < 60 && !code; i++) { const c = 1 + Math.floor(Math.random() * 999); if (!used.has(c)) code = c; } if (!code) return J({ e: 'Coba lagi sebentar' }, 503);
        await env.DB.prepare('INSERT INTO inv(store_id,tier,months,base,code,amount,status,t,by) VALUES(?,?,?,?,?,?,?,?,?)').bind(sid, tier, mo, base, code, base + code, 'tunggu', now, uname).run();
      }
    }
    const inv = (await env.DB.prepare('SELECT id,tier,months,base,code,amount,status,t,paid_t FROM inv WHERE store_id=? ORDER BY id DESC LIMIT 10').bind(sid).all()).results;
    return J({ pkg: pr, months: MONTHS, bank: C.pay_bank || '', auto: !!(C.pay_moota || C.pay_key), wa: C.wa || '', inv, ttl: INV_TTL });
  }
  if (p == '/api/tiket' || p.startsWith('/api/tiket/')) {
    if (role != 'owner' && role != 'admin') return J({ e: 'Komplain ke pengembang hanya untuk pemilik / admin toko' }, 403);
    const m = p.match(/^\/api\/tiket\/(\d+)$/);
    if (p == '/api/tiket' && M == 'POST') {
      if (await limited(env, 'tk:' + sid, 15, DAY)) return J({ e: 'Batas komplain hari ini tercapai' }, 429);
      const tx = clip(b.tx, 2000).trim(); if (tx.length < 5) return J({ e: 'Tulis keluhan minimal 5 huruf' }, 400);
      const msg = [{ f: 's', n: uname, tx, t: now, img: imgOk(b.img) ? b.img : undefined, dev: clip(b.dev, 160) }];
      await env.DB.prepare("INSERT INTO tiket(store_id,sname,by,role,cat,sub,st,t,upd,uh,us,msgs) VALUES(?,?,?,?,?,?,'baru',?,?,1,0,?)").bind(sid, sname, uname, role, CATS[b.cat] ? b.cat : 'lain', clip(b.sub, 90).trim() || clip(tx, 60), now, now, JSON.stringify(msg)).run();
    }
    if (m && M == 'POST') {
      const k = await env.DB.prepare('SELECT msgs,st FROM tiket WHERE id=? AND store_id=?').bind(+m[1], sid).first(); if (!k) return J({ e: 'Tidak ditemukan' }, 404);
      if (b.read) await env.DB.prepare('UPDATE tiket SET us=0 WHERE id=?').bind(+m[1]).run();
      else {
        const tx = clip(b.tx, 2000).trim(); if (!tx && !imgOk(b.img)) return J({ e: 'Pesan kosong' }, 400);
        const L = pj(k.msgs, []); L.push({ f: 's', n: uname, tx, t: now, img: imgOk(b.img) ? b.img : undefined }); if (L.length > 80) return J({ e: 'Percakapan terlalu panjang, buat komplain baru' }, 400);
        await env.DB.prepare("UPDATE tiket SET msgs=?,upd=?,uh=1,us=0,st=CASE WHEN st='selesai' THEN 'baru' ELSE st END WHERE id=?").bind(JSON.stringify(L), now, +m[1]).run();
      }
    }
    const L = (await env.DB.prepare('SELECT id,by,cat,sub,st,t,upd,us,msgs FROM tiket WHERE store_id=? ORDER BY upd DESC LIMIT 40').bind(sid).all()).results;
    return J({ list: L.map((r) => ({ ...r, msgs: pj(r.msgs, []) })), cats: CATS });
  }
  return null;
}

// rute Head Admin
export async function hqAdmin(x) {
  const { env, p, M, b, J, C, cfgSet, origin } = x, now = Date.now();
  if (p == '/api/admin/pay') {
    if (M == 'PUT') {
      if (b.bank != null) await cfgSet(env, 'pay_bank', clip(b.bank, 400).trim());
      if (b.moota != null && String(b.moota).trim() !== '') await cfgSet(env, 'pay_moota', String(b.moota).trim() == '-' ? '' : clip(b.moota, 200).trim());
      if (b.newkey) await cfgSet(env, 'pay_key', hex(crypto.getRandomValues(new Uint8Array(18))));
    }
    const c = M == 'PUT' ? Object.fromEntries((await env.DB.prepare('SELECT k,v FROM cfg').all()).results.map((r) => [r.k, r.v])) : C; return J({ bank: c.pay_bank || '', moota: !!c.pay_moota, hook: c.pay_key ? origin + '/api/pay/hook?key=' + c.pay_key : '', hookSig: origin + '/api/pay/hook' });
  }
  if (p == '/api/admin/inv') {
    await expireOld(env);
    const L = (await env.DB.prepare("SELECT i.*,s.name sname FROM inv i LEFT JOIN stores s ON s.id=i.store_id WHERE i.t>? ORDER BY CASE WHEN i.status='tunggu' THEN 0 ELSE 1 END, i.id DESC LIMIT 200").bind(now - 120 * DAY).all()).results;
    return J({ list: L });
  }
  let m = p.match(/^\/api\/admin\/inv\/(\d+)$/);
  if (m && M == 'POST') {
    if (b.op == 'lunas') { const r = await invPay(env, +m[1], 'manual', 'manual:' + m[1] + ':' + now); if (!r) return J({ e: 'Tagihan tidak ditemukan / sudah diproses' }, 400); return J({ ok: 1, exp: r.exp }); }
    if (b.op == 'batal') { await env.DB.prepare("UPDATE inv SET status='batal' WHERE id=? AND status='tunggu'").bind(+m[1]).run(); return J({ ok: 1 }); }
  }
  if (p == '/api/admin/tiket') {
    const st = ['baru', 'proses', 'selesai'].includes(x.u.searchParams.get('st')) ? x.u.searchParams.get('st') : '';
    const L = (await env.DB.prepare(`SELECT k.id,k.store_id,k.sname,k.by,k.role,k.cat,k.sub,k.st,k.t,k.upd,k.uh,k.msgs,s.tier,s.phone FROM tiket k LEFT JOIN stores s ON s.id=k.store_id ${st ? 'WHERE k.st=?' : ''} ORDER BY k.uh DESC,k.upd DESC LIMIT 150`).bind(...(st ? [st] : [])).all()).results;
    const n = await env.DB.prepare("SELECT SUM(CASE WHEN uh=1 THEN 1 ELSE 0 END) unread,SUM(CASE WHEN st!='selesai' THEN 1 ELSE 0 END) open FROM tiket").first();
    return J({ list: L.map((r) => ({ ...r, msgs: pj(r.msgs, []) })), unread: n.unread || 0, open: n.open || 0, cats: CATS });
  }
  m = p.match(/^\/api\/admin\/tiket\/(\d+)$/);
  if (m && M == 'POST') {
    const k = await env.DB.prepare('SELECT msgs,st FROM tiket WHERE id=?').bind(+m[1]).first(); if (!k) return J({ e: 'Tidak ditemukan' }, 404);
    const L = pj(k.msgs, []), tx = clip(b.tx, 2000).trim(), st = ['baru', 'proses', 'selesai'].includes(b.st) ? b.st : (tx ? (k.st == 'baru' ? 'proses' : k.st) : k.st);
    if (tx) L.push({ f: 'h', n: 'Tim J-POS', tx, t: now });
    await env.DB.prepare('UPDATE tiket SET msgs=?,st=?,upd=?,uh=0,us=CASE WHEN ? THEN 1 ELSE us END WHERE id=?').bind(JSON.stringify(L), st, tx ? now : now, tx ? 1 : 0, +m[1]).run();
    return J({ ok: 1 });
  }
  return null;
}
