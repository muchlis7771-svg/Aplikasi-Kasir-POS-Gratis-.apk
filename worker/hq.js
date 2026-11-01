// ============ PUSAT (HEAD ADMIN): PERPANJANGAN OTOMATIS & KOMPLAIN ============
// Perpanjangan: pemilik toko memilih paket & lama → tagihan dengan KODE UNIK (nominal + 1–999 rupiah).
// Begitu transfer masuk ke rekening Head Admin, layanan cek mutasi (Moota / sejenis) memanggil webhook → nominal cocok
// → masa aktif & paket toko diperpanjang otomatis. Tanpa layanan mutasi, Head Admin cukup menekan "Tandai lunas".
export const HSCHEMA = [
  "CREATE TABLE IF NOT EXISTS inv(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,tier TEXT,months INTEGER,base INTEGER,code INTEGER,amount INTEGER,status TEXT DEFAULT 'tunggu',t INTEGER,paid_t INTEGER,via TEXT,ref TEXT,by TEXT)",
  'CREATE INDEX IF NOT EXISTS inv_s ON inv(store_id,t)', 'CREATE INDEX IF NOT EXISTS inv_a ON inv(status,amount)',
  "CREATE TABLE IF NOT EXISTS tiket(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,sname TEXT,by TEXT,role TEXT,cat TEXT,sub TEXT,st TEXT DEFAULT 'baru',t INTEGER,upd INTEGER,uh INTEGER DEFAULT 1,us INTEGER DEFAULT 0,msgs TEXT)",
  'CREATE INDEX IF NOT EXISTS tiket_s ON tiket(store_id,upd)', 'CREATE INDEX IF NOT EXISTS tiket_u ON tiket(upd)',
  'CREATE TABLE IF NOT EXISTS trail(sid TEXT NOT NULL,u TEXT NOT NULL,t INTEGER NOT NULL,lat REAL,lng REAL,k TEXT NOT NULL DEFAULT \'\')', 'CREATE UNIQUE INDEX IF NOT EXISTS trail_k ON trail(sid,u,t,k)', 'CREATE INDEX IF NOT EXISTS trail_t ON trail(t)',
  'CREATE TABLE IF NOT EXISTS apkc(up TEXT NOT NULL,i INTEGER NOT NULL,d TEXT NOT NULL,t INTEGER,PRIMARY KEY(up,i))',
  'CREATE TABLE IF NOT EXISTS sitehits(k TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0)',
  "CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,store TEXT,phone TEXT,city TEXT,tier TEXT,months INTEGER,note TEXT,src TEXT,st TEXT DEFAULT 'baru',hnote TEXT,t INTEGER,upd INTEGER)", 'CREATE INDEX IF NOT EXISTS leads_t ON leads(st,t)',
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

// POST /api/pesan — pemesanan dari website promo (publik, dibatasi per IP, ada perangkap bot)
export async function leadPost(env, b, ip, J, C, pkgAll, limited) {
  if (b.website) return J({ ok: 1 }); // kolom jebakan terisi = bot; pura-pura sukses
  if (await limited(env, 'lead:' + ip, 4, 36e5)) return J({ e: 'Terlalu banyak pesanan dari jaringan ini. Coba lagi nanti atau hubungi lewat WhatsApp.' }, 429);
  const clean = (v, n) => clip(String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' '), n).trim();
  const name = clean(b.name, 60), store = clean(b.store, 80), city = clean(b.city, 60), note = clean(b.note, 300), phone = String(b.phone || '').replace(/[^\d+]/g, '').replace(/^\+?62/, '0').slice(0, 16), pk = pkgAll();
  if (name.length < 2) return J({ e: 'Isi nama Anda' }, 400);
  if (!/^0\d{8,14}$/.test(phone)) return J({ e: 'Isi nomor WhatsApp yang benar (mis. 0812…)' }, 400);
  const tier = pk[b.tier] ? b.tier : 'standar', mo = MONTHS.includes(+b.months) ? +b.months : 1, now = Date.now();
  const dup = await env.DB.prepare("SELECT id FROM leads WHERE phone=? AND tier=? AND t>? AND st='baru'").bind(phone, tier, now - 864e5).first();
  const id = dup ? dup.id : (await env.DB.prepare('INSERT INTO leads(name,store,phone,city,tier,months,note,src,st,t,upd) VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(name, store, phone, city, tier, mo, note, clean(b.src, 20) || 'web', 'baru', now, now).first()).id;
  return J({ ok: 1, id, wa: C.wa || '', total: (pk[tier].pr || 0) * mo, tn: pk[tier].n });
}

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
  { const ar = (await apkAdmin(x)) || (await siteAdmin(x)); if (ar) return ar; }
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
  if (p == '/api/admin/tunnel') {
    if (M == 'POST' && b.renew || !C.tunnel_key) { const k = hex(crypto.getRandomValues(new Uint8Array(16))); await cfgSet(env, 'tunnel_key', k); C.tunnel_key = k; }
    const fresh = C.tunnel_url && now - (+C.tunnel_t || 0) < 6 * 6e4;
    return J({ key: C.tunnel_key, url: C.tunnel_url || '', t: +C.tunnel_t || 0, live: !!fresh, link: origin + '/termux' });
  }
  if (p == '/api/admin/leads') {
    const L = (await env.DB.prepare('SELECT * FROM leads ORDER BY CASE st WHEN \'baru\' THEN 0 WHEN \'dihubungi\' THEN 1 ELSE 2 END, id DESC LIMIT 300').all()).results, n = await env.DB.prepare("SELECT SUM(CASE WHEN st='baru' THEN 1 ELSE 0 END) baru,SUM(CASE WHEN st='dihubungi' THEN 1 ELSE 0 END) proses,SUM(CASE WHEN st='deal' THEN 1 ELSE 0 END) deal FROM leads").first();
    return J({ list: L, baru: n.baru || 0, proses: n.proses || 0, deal: n.deal || 0 });
  }
  m = p.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (m && M == 'POST') {
    const st = ['baru', 'dihubungi', 'deal', 'batal'].includes(b.st) ? b.st : null;
    await env.DB.prepare('UPDATE leads SET st=COALESCE(?,st),hnote=COALESCE(?,hnote),upd=? WHERE id=?').bind(st, b.hnote != null ? clip(b.hnote, 300) : null, now, +m[1]).run();
    return J({ ok: 1 });
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

/* ============ RIWAYAT PERJALANAN (jejak GPS) — disimpan 30 hari, lebih lama dihapus otomatis ============ */
export const TRAIL_DAYS = 30;
const okLL = (a, b) => Number.isFinite(+a) && Number.isFinite(+b) && Math.abs(+a) <= 90 && Math.abs(+b) <= 180 && !(Math.abs(+a) < 0.01 && Math.abs(+b) < 0.01);
// pernyataan INSERT untuk satu kejadian (loc / absen / kunjungan) — kembali null bila tidak punya titik valid
export function trailStmt(env, sid, uname, x, now) {
  const kk = { loc: '', in: 'in', out: 'out', visit: 'visit', vout: 'vout' }[x.k]; if (kk === undefined || !okLL(x.lat, x.lng)) return null;
  const t = Math.round(x.t); if (!(t < now + 6e5 && t > now - TRAIL_DAYS * DAY)) return null;
  return env.DB.prepare('INSERT OR IGNORE INTO trail(sid,u,t,lat,lng,k) VALUES(?,?,?,?,?,?)').bind(sid, String(uname).slice(0, 40), t, +(+x.lat).toFixed(6), +(+x.lng).toFixed(6), kk);
}
export async function pruneTrail(env, now) { await pruneApk(env, now).catch(() => { }); const c = now - TRAIL_DAYS * DAY; await env.DB.batch([env.DB.prepare('DELETE FROM trail WHERE t<?').bind(c), env.DB.prepare("DELETE FROM ev WHERE k='loc' AND t<?").bind(now - 3 * DAY)]); }
const rad = Math.PI / 180, dm = (a, b, c, d) => { const x = (d - b) * rad * Math.cos((a + c) / 2 * rad), y = (c - a) * rad; return 6371000 * Math.sqrt(x * x + y * y); };
// GET /api/trail?user=NAMA&days=N → titik jejak (ditipiskan: ±150 detik atau ≥25 m) untuk pemilik / admin
export async function trailGet(env, sid, u, J) {
  const user = String(u.searchParams.get('user') || '').slice(0, 40), days = Math.max(1, Math.min(TRAIL_DAYS, Math.round(+u.searchParams.get('days') || 1))), now = Date.now();
  if (!user) return J({ e: 'Pilih karyawan' }, 400);
  if (Math.random() < 0.02) pruneTrail(env, now).catch(() => { });
  const from = now - days * DAY, r = (await env.DB.prepare('SELECT t,lat,lng,k FROM trail WHERE sid=? AND u=? COLLATE NOCASE AND t>=? ORDER BY t LIMIT 60000').bind(sid, user, from).all()).results, pts = [];
  let last = null;
  for (let i = 0; i < r.length; i++) { const p = r[i]; if (!last || p.k || p.t - last.t >= 150000 || dm(last.lat, last.lng, p.lat, p.lng) >= 25 || i == r.length - 1) { pts.push([p.t, p.lat, p.lng, p.k]); last = p; } }
  return J({ user, days, from, n: r.length, pts, keep: TRAIL_DAYS });
}

/* ============ LINK TETAP KE SERVER TERMUX ============
   Termux melaporkan alamat tunnel-nya (berubah tiap restart) ke sini tiap ±2 menit dengan kunci rahasia.
   Alamat tetap  /termux  lalu mengarahkan pengunjung ke alamat Termux terbaru; bila Termux mati → ke halaman promo di server ini. */
export async function tunnelPost(env, b, ip, J, C, cfgSet, limited) {
  if (await limited(env, 'tun:' + ip, 90, 36e5)) return J({ e: 'terlalu sering' }, 429);
  const key = String(b.key || ''), url = String(b.url || '').replace(/\/$/, '');
  if (!C.tunnel_key || !safeEq(key, C.tunnel_key)) return J({ e: 'kunci salah' }, 401);
  if (!/^https:\/\/[a-z0-9-]{4,60}\.trycloudflare\.com$/.test(url)) return J({ e: 'alamat tunnel tidak valid' }, 400);
  await cfgSet(env, 'tunnel_url', url); await cfgSet(env, 'tunnel_t', Date.now());
  return J({ ok: 1 });
}
export async function tunnelRedirect(env, C, req) {
  const fresh = C.tunnel_url && Date.now() - (+C.tunnel_t || 0) < 6 * 6e4;
  return Response.redirect(fresh ? C.tunnel_url + '/' : new URL('/promo/', req.url).href, 302);
}

/* ============ APK DI WEBSITE (diunggah Head Admin) ============
   File dipecah jadi potongan ±360 KB (base64) di D1 — tanpa R2 / biaya tambahan. Pengunjung mengunduh potongan satu per satu lalu
   browser merakit & memeriksa SHA-256. Hanya satu versi aktif; unggahan lama otomatis dibersihkan. */
const APK_CHUNK = 360 * 1024, APK_MAX_CHUNKS = 340, UPID = /^[a-f0-9]{16}$/;
const apkMetaOf = (C) => { try { const m = JSON.parse(C.apk_meta || 'null'); return m && m.up ? m : null; } catch (e) { return null; } };
const apkPub = (m) => (m ? { has: 1, up: m.up, n: m.n, size: m.size, sha: m.sha, name: m.name, note: m.note || '', t: m.t, chunk: APK_CHUNK } : { has: 0 });
export const apkPubOf = (C) => apkPub(apkMetaOf(C));
export async function apkPublic(C, J) { return J(apkPubOf(C)); }
export async function apkChunkGet(env, u, ip, J, C, limited) {
  const m = apkMetaOf(C), up = String(u.searchParams.get('up') || ''), i = Math.round(+u.searchParams.get('i'));
  if (!m || up != m.up || !(i >= 0 && i < m.n)) return J({ e: 'tidak ada' }, 404);
  if (await limited(env, 'apk:' + ip, 900, 36e5)) return J({ e: 'terlalu sering' }, 429);
  const r = await env.DB.prepare('SELECT d FROM apkc WHERE up=? AND i=?').bind(up, i).first(); if (!r) return J({ e: 'potongan hilang' }, 404);
  return new Response(r.d, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400, immutable', 'Access-Control-Allow-Origin': '*' } });
}
export async function apkDlCount(env, ip, J, limited) {
  if (await limited(env, 'apkdl:' + ip, 20, 36e5)) return J({ ok: 1 });
  await env.DB.prepare("INSERT INTO sitehits(k,n) VALUES(?,1) ON CONFLICT(k) DO UPDATE SET n=n+1").bind('d:' + new Date(Date.now() + 288e5).toISOString().slice(0, 10)).run(); return J({ ok: 1 });
}
// ----- Head Admin -----
async function apkAdmin(x) {
  const { env, p, M, b, J, C, cfgSet, req, u } = x, now = Date.now();
  if (p == '/api/admin/apk/chunk' && M == 'PUT') {
    const up = String(u.searchParams.get('up') || ''), i = Math.round(+u.searchParams.get('i')); if (!UPID.test(up) || !(i >= 0 && i < APK_MAX_CHUNKS)) return J({ e: 'parameter salah' }, 400);
    const d = await req.text(); if (!d || d.length > 520000 || !/^[A-Za-z0-9+/=]+$/.test(d)) return J({ e: 'potongan tidak valid' }, 400);
    if (i == 0 && !d.startsWith('UEsD')) return J({ e: 'File ini bukan APK (format ZIP tidak dikenali)' }, 400);
    await env.DB.prepare('INSERT INTO apkc(up,i,d,t) VALUES(?,?,?,?) ON CONFLICT(up,i) DO UPDATE SET d=excluded.d,t=excluded.t').bind(up, i, d, now).run(); return J({ ok: 1, i });
  }
  if (p == '/api/admin/apk/commit' && M == 'POST') {
    const up = String(b.up || ''), n = Math.round(+b.n), size = Math.round(+b.size), sha = String(b.sha || '').toLowerCase();
    if (!UPID.test(up) || !(n >= 1 && n <= APK_MAX_CHUNKS) || !(size > 100000 && size <= n * APK_CHUNK) || !/^[a-f0-9]{64}$/.test(sha)) return J({ e: 'data unggahan tidak valid' }, 400);
    const got = await env.DB.prepare('SELECT COUNT(*) c,MIN(i) a,MAX(i) z FROM apkc WHERE up=?').bind(up).first();
    if (got.c != n || got.a != 0 || got.z != n - 1) return J({ e: 'potongan belum lengkap (' + got.c + ' dari ' + n + '), ulangi unggah' }, 400);
    const meta = { up, n, size, sha, name: clip(String(b.name || 'J-POS.apk').replace(/[^\w.\- ()]/g, ''), 60) || 'J-POS.apk', note: clip(String(b.note || '').replace(/[\u0000-\u001f<>]/g, ' '), 200).trim(), t: now };
    await cfgSet(env, 'apk_meta', JSON.stringify(meta)); await env.DB.prepare('DELETE FROM apkc WHERE up!=?').bind(up).run(); return J({ ok: 1, ...apkPub(meta) });
  }
  if (p == '/api/admin/apk' && M == 'DELETE') { await cfgSet(env, 'apk_meta', ''); await env.DB.prepare('DELETE FROM apkc').run(); return J({ ok: 1 }); }
  if (p == '/api/admin/apk' && M == 'GET') return J(apkPub(apkMetaOf(C)));
  return null;
}
export async function pruneApk(env, now) { await env.DB.prepare('DELETE FROM apkc WHERE t<? AND up NOT IN (SELECT json_extract(v,\'$.up\') FROM cfg WHERE k=\'apk_meta\' AND v!=\'\')').bind(now - 864e5).run(); }

/* ============ KONTROL WEBSITE PROMO (diatur dari dashboard Head Admin) ============ */
export const SITE_DEF = {
  eyebrow: 'Kasir · Stok · Grosir · Distributor', title: 'Kelola toko & distribusi Anda', gold: 'dalam satu aplikasi',
  lead: 'Kasir yang tetap jalan tanpa internet, stok yang terpantau, sales lapangan dengan GPS, pengantaran, absensi, gaji, sampai laporan keuangan. Untuk kios, toko grosir, dan distributor.',
  cta: 'Pesan sekarang', wa: '', gsv: '', foot: '', banner: { on: false, text: '', link: '' },
  show: { fitur: true, tampilan: true, paket: true, langkah: true, tanya: true, pesan: true, apk: true },
  order: { open: true, closedMsg: 'Pemesanan sedang ditutup sementara. Silakan hubungi kami lewat WhatsApp.' },
  maint: { on: false, msg: 'Website sedang dalam pemeliharaan. Silakan kembali sebentar lagi.' }, faq: [],
};
const sTxt = (v, n, d) => (typeof v == 'string' ? clip(v.replace(/[\u0000-\u001f<>]/g, ' '), n).trim() : d);
export function siteClean(raw, base) {
  const r = raw && typeof raw == 'object' ? raw : {}, d = base || SITE_DEF, o = JSON.parse(JSON.stringify(d)), bo = (v, x) => (typeof v == 'boolean' ? v : x);
  for (const [k, n] of [['eyebrow', 60], ['title', 90], ['gold', 90], ['lead', 320], ['cta', 30], ['foot', 160]]) o[k] = sTxt(r[k], n, o[k]);
  o.gsv = typeof r.gsv == 'string' ? (r.gsv.trim().toLowerCase().replace(/^google|\.html$/g, '').match(/^[a-f0-9]{16}$/) || [''])[0] : o.gsv;
  o.wa = typeof r.wa == 'string' ? r.wa.replace(/[^\d+]/g, '').slice(0, 16) : o.wa;
  const bn = r.banner || {}; o.banner = { on: bo(bn.on, o.banner.on), text: sTxt(bn.text, 160, o.banner.text), link: typeof bn.link == 'string' && /^(https:\/\/[^\s<>"']{4,200}|#[\w-]{1,30})?$/.test(bn.link.trim()) ? bn.link.trim() : o.banner.link };
  for (const k of Object.keys(o.show)) o.show[k] = bo((r.show || {})[k], o.show[k]);
  o.order = { open: bo((r.order || {}).open, o.order.open), closedMsg: sTxt((r.order || {}).closedMsg, 200, o.order.closedMsg) };
  o.maint = { on: bo((r.maint || {}).on, o.maint.on), msg: sTxt((r.maint || {}).msg, 200, o.maint.msg) };
  if (Array.isArray(r.faq)) o.faq = r.faq.slice(0, 12).map((f) => ({ q: sTxt(f && f.q, 140, ''), a: sTxt(f && f.a, 600, '') })).filter((f) => f.q && f.a);
  return o;
}
export const siteOf = (C) => { try { return siteClean(JSON.parse(C.site || 'null'), SITE_DEF); } catch (e) { return siteClean(null, SITE_DEF); } };
export async function siteHit(env, ip, J, limited, b) {
  if (await limited(env, 'hit:' + ip, 40, 36e5)) return J({ ok: 1 });
  const day = new Date(Date.now() + 288e5).toISOString().slice(0, 10), src = b && typeof b.src == 'string' && /^[a-z0-9]{1,12}$/.test(b.src) ? b.src : '', ins = "INSERT INTO sitehits(k,n) VALUES(?,1) ON CONFLICT(k) DO UPDATE SET n=n+1";
  const st = [env.DB.prepare(ins).bind('v:' + day)]; if (src) st.push(env.DB.prepare(ins).bind('s:' + src + ':' + day));
  await env.DB.batch(st); return J({ ok: 1 });
}
async function siteAdmin(x) {
  const { env, p, M, b, J, C, cfgSet } = x;
  if (p == '/api/admin/site') {
    if (M == 'PUT') { const o = siteClean(b, siteOf(C)); await cfgSet(env, 'site', JSON.stringify(o)); return J({ ok: 1, site: o }); }
    if (M == 'DELETE') { await cfgSet(env, 'site', ''); return J({ ok: 1, site: siteClean(null, SITE_DEF) }); }
    return J({ site: siteOf(C), def: SITE_DEF });
  }
  if (p == '/api/admin/site/stats') {
    const days = []; for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() + 288e5 - i * DAY).toISOString().slice(0, 10));
    const r = (await env.DB.prepare("SELECT k,n FROM sitehits WHERE k>=? ").bind('d:' + days[0]).all()).results, r2 = (await env.DB.prepare("SELECT k,n FROM sitehits WHERE k>=? AND k<'w'").bind('v:' + days[0]).all()).results, mp = {}; for (const x2 of [...r, ...r2]) mp[x2.k] = x2.n;
    const L = (await env.DB.prepare("SELECT strftime('%Y-%m-%d',(t/1000)+28800,'unixepoch') d,COUNT(*) n FROM leads WHERE t>? GROUP BY d").bind(Date.now() - 15 * DAY).all()).results, lm = {}; for (const y of L) lm[y.d] = y.n;
    const srcs = {}; for (const x2 of r) if (x2.k.startsWith('s:') && x2.k.slice(-10) >= days[0]) { const n2 = x2.k.slice(2, -11); srcs[n2] = (srcs[n2] || 0) + x2.n; }
    return J({ src: srcs, days: days.map((d) => ({ d, v: mp['v:' + d] || 0, dl: mp['d:' + d] || 0, o: lm[d] || 0 })) });
  }
  return null;
}
