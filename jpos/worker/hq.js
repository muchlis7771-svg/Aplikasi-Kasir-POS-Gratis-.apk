// ============ PUSAT (HEAD ADMIN): PERPANJANGAN OTOMATIS & KOMPLAIN ============
// Perpanjangan: pemilik toko memilih paket & lama → tagihan dengan KODE UNIK (nominal + 1–999 rupiah).
// Begitu transfer masuk ke rekening Head Admin, layanan cek mutasi (Moota / sejenis) memanggil webhook → nominal cocok
// → masa aktif & paket toko diperpanjang otomatis. Tanpa layanan mutasi, Head Admin cukup menekan "Tandai lunas".
export const HSCHEMA = [
  'CREATE TABLE IF NOT EXISTS trkoff(sid TEXT NOT NULL,u TEXT NOT NULL,t INTEGER,PRIMARY KEY(sid,u))',
  'CREATE TABLE IF NOT EXISTS wmedia(id TEXT PRIMARY KEY,kind TEXT,name TEXT,type TEXT,size INTEGER,sha TEXT,n INTEGER,cap TEXT,t INTEGER)',
  'CREATE TABLE IF NOT EXISTS wmediac(id TEXT NOT NULL,i INTEGER NOT NULL,d TEXT NOT NULL,t INTEGER,PRIMARY KEY(id,i))',
  "CREATE TABLE IF NOT EXISTS wchat(id INTEGER PRIMARY KEY AUTOINCREMENT,cid TEXT NOT NULL,who TEXT NOT NULL,name TEXT,txt TEXT,t INTEGER,rd INTEGER DEFAULT 0)", 'CREATE INDEX IF NOT EXISTS wchat_c ON wchat(cid,id)',
  "CREATE TABLE IF NOT EXISTS wulasan(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,store TEXT,stars INTEGER,txt TEXT,t INTEGER,ok INTEGER DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS inv(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,tier TEXT,months INTEGER,base INTEGER,code INTEGER,amount INTEGER,status TEXT DEFAULT 'tunggu',t INTEGER,paid_t INTEGER,via TEXT,ref TEXT,by TEXT)",
  'CREATE INDEX IF NOT EXISTS inv_s ON inv(store_id,t)', 'CREATE INDEX IF NOT EXISTS inv_a ON inv(status,amount)',
  "CREATE TABLE IF NOT EXISTS tiket(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,sname TEXT,by TEXT,role TEXT,cat TEXT,sub TEXT,st TEXT DEFAULT 'baru',t INTEGER,upd INTEGER,uh INTEGER DEFAULT 1,us INTEGER DEFAULT 0,msgs TEXT)",
  'CREATE INDEX IF NOT EXISTS tiket_s ON tiket(store_id,upd)', 'CREATE INDEX IF NOT EXISTS tiket_u ON tiket(upd)',
  'CREATE TABLE IF NOT EXISTS trail(sid TEXT NOT NULL,u TEXT NOT NULL,t INTEGER NOT NULL,lat REAL,lng REAL,k TEXT NOT NULL DEFAULT \'\')', 'CREATE UNIQUE INDEX IF NOT EXISTS trail_k ON trail(sid,u,t,k)', 'CREATE INDEX IF NOT EXISTS trail_t ON trail(t)',
  'CREATE TABLE IF NOT EXISTS apkc(up TEXT NOT NULL,i INTEGER NOT NULL,d TEXT NOT NULL,t INTEGER,PRIMARY KEY(up,i))',
  'CREATE TABLE IF NOT EXISTS sitehits(k TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0)',
  "CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,store TEXT,phone TEXT,city TEXT,tier TEXT,months INTEGER,note TEXT,src TEXT,st TEXT DEFAULT 'baru',hnote TEXT,t INTEGER,upd INTEGER)", 'CREATE INDEX IF NOT EXISTS leads_t ON leads(st,t)',
  // lisensi "sekali beli": satu kode (dibuat Head Admin) boleh dipakai sejumlah `acts` aktivasi (toko/perangkat); harga bebas ditentukan Head Admin per kode
  "CREATE TABLE IF NOT EXISTS serials(sn TEXT PRIMARY KEY,tier TEXT DEFAULT 'high',acts INTEGER DEFAULT 1,used INTEGER DEFAULT 0,price INTEGER DEFAULT 0,note TEXT,active INTEGER DEFAULT 1,created INTEGER,by TEXT)",
  'CREATE TABLE IF NOT EXISTS activations(id INTEGER PRIMARY KEY AUTOINCREMENT,sn TEXT NOT NULL,store_id TEXT NOT NULL,t INTEGER)', 'CREATE UNIQUE INDEX IF NOT EXISTS act_u ON activations(sn,store_id)', 'CREATE INDEX IF NOT EXISTS act_sn ON activations(sn)',
];
const VIS_DAYS = 31, DAY = 864e5, INV_TTL = 3 * DAY, MONTHS = [1, 3, 6, 12];
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
    env.DB.prepare('INSERT INTO wchat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind('tk:' + v.store_id, 'hq', 'Pemilik Aplikasi', 'Head Admin', `✅ Pembayaran Rp${v.amount.toLocaleString('id-ID')} diterima. Paket diperpanjang ${v.months} bulan s/d ${new Date(exp + 8 * 36e5).toISOString().slice(0, 10)}. Terima kasih!`, now),
  ]);
  return { ...v, exp };
}
const LIFETIME_YRS = 100; // "sekali bayar": masa aktif diset jauh ke depan agar kode lama (expired()/isExp()) tetap berfungsi tanpa perlu diubah
const SNCHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I agar tidak tertukar saat dibacakan/diketik ulang
const genSN = () => { const r = crypto.getRandomValues(new Uint8Array(12)); let s = 'JPOS'; for (let g = 0; g < 3; g++) { s += '-'; for (let i = 0; i < 4; i++) s += SNCHARS[r[g * 4 + i] % SNCHARS.length]; } return s; };
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
  const { env, p, M, b, J, sid, uname, role, C, pkgAll, sname, limited, stInfo } = x, now = Date.now();
  if (p == '/api/activate' && M == 'POST') {
    if (role != 'owner') return J({ e: 'Hanya pemilik toko yang bisa mengaktifkan kode lisensi' }, 403);
    if (await limited(env, 'act:' + sid, 10, DAY)) return J({ e: 'Terlalu banyak percobaan aktivasi hari ini, coba lagi besok' }, 429);
    const sn = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!sn) return J({ e: 'Masukkan kode lisensi' }, 400);
    const v = await env.DB.prepare('SELECT * FROM serials WHERE sn=?').bind(sn).first();
    if (!v || !v.active) return J({ e: 'Kode lisensi tidak ditemukan atau sudah tidak aktif' }, 404);
    const already = await env.DB.prepare('SELECT 1 FROM activations WHERE sn=? AND store_id=?').bind(sn, sid).first();
    if (!already && v.used >= v.acts) return J({ e: `Kode ini sudah mencapai batas ${v.acts} aktivasi` }, 400);
    const st = [];
    if (!already) { st.push(env.DB.prepare('INSERT INTO activations(sn,store_id,t) VALUES(?,?,?)').bind(sn, sid, now)); st.push(env.DB.prepare('UPDATE serials SET used=used+1 WHERE sn=?').bind(sn)); }
    st.push(env.DB.prepare("UPDATE stores SET plan='lifetime',tier=?,exp=?,status='active' WHERE id=?").bind(v.tier || 'high', now + LIFETIME_YRS * 365 * DAY, sid));
    await env.DB.batch(st);
    const s2 = await env.DB.prepare('SELECT exp,plan,status,name,tier,perm FROM stores WHERE id=?').bind(sid).first();
    return J({ ok: 1, ...stInfo(s2) });
  }
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
  { const ar = (await apkAdmin(x)) || (await siteAdmin(x)) || (await chatAdmin(x)) || (await mediaAdmin(x)); if (ar) return ar; }
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
  // kode lisensi "sekali beli": Head Admin menentukan paket, jumlah aktivasi (toko/perangkat) & harga bebas per kode
  if (p == '/api/admin/serial' && M == 'GET') return J({ list: (await env.DB.prepare('SELECT * FROM serials ORDER BY created DESC LIMIT 500').all()).results });
  if (p == '/api/admin/serial' && M == 'POST') {
    const tier = ['biasa', 'standar', 'high'].includes(b.tier) ? b.tier : 'high', acts = Math.max(1, Math.min(9999, Math.round(+b.acts) || 1)), price = Math.max(0, Math.round(+b.price) || 0), note = clip(b.note, 200).trim();
    let sn = null; for (let i = 0; i < 8 && !sn; i++) { const c = genSN(); if (!(await env.DB.prepare('SELECT 1 FROM serials WHERE sn=?').bind(c).first())) sn = c; }
    if (!sn) return J({ e: 'Gagal membuat kode, coba lagi' }, 503);
    await env.DB.prepare('INSERT INTO serials(sn,tier,acts,used,price,note,active,created,by) VALUES(?,?,?,0,?,?,1,?,?)').bind(sn, tier, acts, price, note, now, 'headadmin').run();
    return J({ ok: 1, sn });
  }
  m = p.match(/^\/api\/admin\/serial\/([A-Z0-9-]+)$/);
  if (m && M == 'PATCH') {
    const sn = m[1]; if (!(await env.DB.prepare('SELECT 1 FROM serials WHERE sn=?').bind(sn).first())) return J({ e: 'Kode tidak ditemukan' }, 404);
    const st = [];
    if (b.active != null) st.push(env.DB.prepare('UPDATE serials SET active=? WHERE sn=?').bind(b.active ? 1 : 0, sn));
    if (b.acts != null) st.push(env.DB.prepare('UPDATE serials SET acts=? WHERE sn=?').bind(Math.max(1, Math.min(9999, Math.round(+b.acts) || 1)), sn));
    if (b.price != null) st.push(env.DB.prepare('UPDATE serials SET price=? WHERE sn=?').bind(Math.max(0, Math.round(+b.price) || 0), sn));
    if (b.note != null) st.push(env.DB.prepare('UPDATE serials SET note=? WHERE sn=?').bind(clip(b.note, 200).trim(), sn));
    if (st.length) await env.DB.batch(st);
    return J({ ok: 1 });
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
export async function pruneTrail(env, now) { await pruneApk(env, now).catch(() => { }); const c = now - TRAIL_DAYS * DAY; await env.DB.batch([env.DB.prepare('DELETE FROM trail WHERE t<?').bind(c), env.DB.prepare("DELETE FROM ev WHERE k='loc' AND t<?").bind(now - 3 * DAY), env.DB.prepare("DELETE FROM ev WHERE k IN ('visit','vout') AND t<?").bind(now - VIS_DAYS * DAY)]); }
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
// aplikasi dibuka tapi belum login (layar Masuk/Daftar) — dipantau Head Admin di tab Aktivitas
export async function appHit(env, ip, J, limited) {
  if (await limited(env, 'apphit:' + ip, 20, 36e5)) return J({ ok: 1 });
  await env.DB.prepare("INSERT INTO sitehits(k,n) VALUES(?,1) ON CONFLICT(k) DO UPDATE SET n=n+1").bind('a:' + new Date(Date.now() + 288e5).toISOString().slice(0, 10)).run(); return J({ ok: 1 });
}
// ringkasan cepat hari ini untuk lencana (badge) tab Aktivitas Head Admin: kunjungan website, buka app tanpa login, & login (karyawan/pemilik/admin)
export async function adminPulse(env, J) {
  const day = new Date(Date.now() + 288e5).toISOString().slice(0, 10), since = new Date(day + 'T00:00:00+08:00').getTime();
  const [hits, login] = await Promise.all([
    env.DB.prepare("SELECT k,n FROM sitehits WHERE k=? OR k=?").bind('v:' + day, 'a:' + day).all(),
    env.DB.prepare("SELECT COUNT(*) n FROM act WHERE t>? AND act LIKE 'login%'").bind(since).first(),
  ]);
  const mp = {}; for (const x of hits.results) mp[x.k] = x.n;
  return J({ visit: mp['v:' + day] || 0, app: mp['a:' + day] || 0, login: (login && login.n) || 0 });
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
export async function pruneApk(env, now) { await env.DB.prepare('DELETE FROM wmediac WHERE t<? AND id NOT IN (SELECT id FROM wmedia)').bind(now - 864e5).run(); await env.DB.prepare('DELETE FROM wchat WHERE t<?').bind(now - 60 * 864e5).run(); await env.DB.prepare('DELETE FROM apkc WHERE t<? AND up NOT IN (SELECT json_extract(v,\'$.up\') FROM cfg WHERE k=\'apk_meta\' AND v!=\'\')').bind(now - 864e5).run(); }

/* ============ KONTROL WEBSITE PROMO (diatur dari dashboard Head Admin) ============ */
export const SITE_DEF = {
  eyebrow: 'Kasir · Stok · Grosir · Distributor', title: 'Kelola toko & distribusi Anda', gold: 'dalam satu aplikasi',
  lead: 'Kasir yang tetap jalan tanpa internet, stok yang terpantau, sales lapangan dengan GPS, pengantaran, absensi, gaji, sampai laporan keuangan. Untuk kios, toko grosir, dan distributor.',
  cta: 'Pesan sekarang', wa: '', gsv: '', foot: '', banner: { on: false, text: '', link: '' },
  show: { fitur: true, tampilan: true, paket: true, langkah: true, tanya: true, pesan: true, apk: true, aman: true, ulasan: true, video: true, chat: true, galeri: true },
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
    const r = (await env.DB.prepare("SELECT k,n FROM sitehits WHERE k>=? ").bind('d:' + days[0]).all()).results, r2 = (await env.DB.prepare("SELECT k,n FROM sitehits WHERE k>=? AND k<'w'").bind('v:' + days[0]).all()).results, r3 = (await env.DB.prepare("SELECT k,n FROM sitehits WHERE k>=? AND k<'b'").bind('a:' + days[0]).all()).results, mp = {}; for (const x2 of [...r, ...r2, ...r3]) mp[x2.k] = x2.n;
    const L = (await env.DB.prepare("SELECT strftime('%Y-%m-%d',(t/1000)+28800,'unixepoch') d,COUNT(*) n FROM leads WHERE t>? GROUP BY d").bind(Date.now() - 15 * DAY).all()).results, lm = {}; for (const y of L) lm[y.d] = y.n;
    const srcs = {}; for (const x2 of r) if (x2.k.startsWith('s:') && x2.k.slice(-10) >= days[0]) { const n2 = x2.k.slice(2, -11); srcs[n2] = (srcs[n2] || 0) + x2.n; }
    return J({ src: srcs, days: days.map((d) => ({ d, v: mp['v:' + d] || 0, a: mp['a:' + d] || 0, dl: mp['d:' + d] || 0, o: lm[d] || 0 })) });
  }
  return null;
}


/* ============ CHAT LANGSUNG & ULASAN DI WEBSITE PROMO ============ */
const CID = /^[a-f0-9]{16}$/, wClean = (v, n) => clip(String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' '), n).trim();
const CARA = 'Cara memakai J-POS:\n1) Pesan paket atau coba demo di website ini.\n2) Daftarkan toko: buat toko, tambah produk (bisa impor Excel) dan karyawan.\n3) Pasang aplikasi di HP Android, atau buka lewat browser di laptop.\n4) Jualan lewat menu Kasir — tetap jalan tanpa internet, data terkirim otomatis saat sinyal kembali.\nAdmin akan membalas jika ada yang ingin ditanyakan lebih lanjut.';
function botReply(txt, first, pk) {
  const t = txt.toLowerCase();
  if (/cara (pakai|guna|menggunakan|mulai)|panduan|tutorial/.test(t)) return CARA;
  if (/harga|paket|biaya|tarif|berapa/.test(t)) { try { return 'Paket J-POS (per bulan):\n' + Object.values(pk()).map((x) => '• ' + x.n + ' — Rp' + Number(x.pr).toLocaleString('id-ID') + ' (hingga ' + x.max + ' pengguna)').join('\n') + '\nAda masa coba gratis. Admin akan membalas untuk detail.'; } catch (e) { } }
  if (/pesan|beli|order|daftar|langganan/.test(t)) return 'Untuk memesan, isi formulir di bagian “Pemesanan” pada halaman ini (nama & nomor WhatsApp), atau tulis nama dan nomor WhatsApp Anda di chat ini. Admin akan menghubungi untuk aktivasi.';
  if (first) return 'Terima kasih, pesan Anda sudah masuk. Ini balasan otomatis; admin akan membalas secepatnya di chat ini. Ketik “cara pakai”, “harga”, atau “cara pesan” untuk jawaban cepat.';
  return '';
}
export async function webPublic(x) {
  const { env, p, M, b, u, ip, J, limited, pkgAll } = x;
  if (p == '/api/chat/send' && M == 'POST') {
    const cid = String(b.cid || ''), txt = wClean(b.text, 500); if (b.website) return J({ ok: 1 });
    if (!CID.test(cid) || !txt) return J({ e: 'Pesan kosong' }, 400);
    if (await limited(env, 'chs:' + ip, 40, 36e5) || await limited(env, 'chc:' + cid, 30, 36e5)) return J({ e: 'Terlalu banyak pesan. Coba lagi nanti atau hubungi lewat WhatsApp.' }, 429);
    const now = Date.now(), first = !(await env.DB.prepare('SELECT 1 x FROM wchat WHERE cid=? LIMIT 1').bind(cid).first()), rep = botReply(txt, first, pkgAll);
    const st = [env.DB.prepare('INSERT INTO wchat(cid,who,name,txt,t,rd) VALUES(?,?,?,?,?,0)').bind(cid, 'v', wClean(b.name, 40), txt, now)];
    if (rep) st.push(env.DB.prepare("INSERT INTO wchat(cid,who,name,txt,t,rd) VALUES(?,'b','',?,?,1)").bind(cid, rep, now + 1));
    await env.DB.batch(st); return J({ ok: 1 });
  }
  if (p == '/api/chat/poll' && M == 'GET') {
    const cid = u.searchParams.get('cid') || ''; if (!CID.test(cid)) return J({ m: [] });
    if (await limited(env, 'chp:' + ip, 1500, 36e5)) return J({ e: 'Terlalu sering' }, 429);
    const r = (await env.DB.prepare('SELECT id,who,txt,t FROM wchat WHERE cid=? AND id>? ORDER BY id LIMIT 60').bind(cid, +u.searchParams.get('after') || 0).all()).results; return J({ m: r });
  }
  if (p == '/api/ulasan' && M == 'GET') { const r = (await env.DB.prepare('SELECT name,store,stars,txt,t FROM wulasan WHERE ok=1 ORDER BY t DESC LIMIT 12').all()).results; return J({ list: r }); }
  if (p == '/api/ulasan' && M == 'POST') {
    if (b.website) return J({ ok: 1 }); if (await limited(env, 'ul:' + ip, 3, 864e5)) return J({ e: 'Terlalu banyak ulasan dari jaringan ini. Coba lagi besok.' }, 429);
    const name = wClean(b.name, 40), store = wClean(b.store, 60), txt = wClean(b.text, 300), stars = Math.round(+b.stars);
    if (name.length < 2) return J({ e: 'Isi nama Anda' }, 400); if (!(stars >= 1 && stars <= 5)) return J({ e: 'Pilih bintang 1–5' }, 400); if (txt.length < 10) return J({ e: 'Tulis ulasan minimal 10 huruf' }, 400);
    await env.DB.prepare('INSERT INTO wulasan(name,store,stars,txt,t,ok) VALUES(?,?,?,?,?,0)').bind(name, store, stars, txt, Date.now()).run(); return J({ ok: 1, msg: 'Terima kasih! Ulasan tampil setelah disetujui admin.' });
  }
  return null;
}
async function chatAdmin(x) {
  const { env, p, M, b, J, u } = x;
  if (p == '/api/admin/chat') {
    const cid = u.searchParams.get('cid') || '';
    if (M == 'GET' && !cid) {
      const r = (await env.DB.prepare("SELECT c.cid, MAX(c.id) lid, MAX(c.t) t, SUM(CASE WHEN c.who='v' AND c.rd=0 THEN 1 ELSE 0 END) un, (SELECT n.name FROM wchat n WHERE n.cid=c.cid AND n.who='v' AND n.name!='' ORDER BY n.id DESC LIMIT 1) name, (SELECT l.txt FROM wchat l WHERE l.cid=c.cid ORDER BY l.id DESC LIMIT 1) last FROM wchat c GROUP BY c.cid ORDER BY lid DESC LIMIT 60").all()).results;
      return J({ list: r, unread: r.reduce((a, x2) => a + (x2.un || 0), 0) });
    }
    if (!CID.test(cid)) return J({ e: 'cid tidak valid' }, 400);
    if (M == 'GET') { const r = (await env.DB.prepare('SELECT id,who,name,txt,t FROM wchat WHERE cid=? ORDER BY id DESC LIMIT 200').bind(cid).all()).results.reverse(); await env.DB.prepare("UPDATE wchat SET rd=1 WHERE cid=? AND who='v' AND rd=0").bind(cid).run(); return J({ m: r }); }
    if (M == 'POST') { const txt = wClean(b.text, 800); if (!txt) return J({ e: 'Pesan kosong' }, 400); await env.DB.prepare("INSERT INTO wchat(cid,who,name,txt,t,rd) VALUES(?,'a','',?,?,1)").bind(cid, txt, Date.now()).run(); return J({ ok: 1 }); }
    if (M == 'DELETE') { await env.DB.prepare('DELETE FROM wchat WHERE cid=?').bind(cid).run(); return J({ ok: 1 }); }
  }
  if (p == '/api/admin/ulasan') {
    if (M == 'POST') { const id = +b.id | 0; if (b.act == 'del') await env.DB.prepare('DELETE FROM wulasan WHERE id=?').bind(id).run(); else await env.DB.prepare('UPDATE wulasan SET ok=? WHERE id=?').bind(b.act == 'ok' ? 1 : 0, id).run(); return J({ ok: 1 }); }
    return J({ list: (await env.DB.prepare('SELECT id,name,store,stars,txt,t,ok FROM wulasan ORDER BY ok,t DESC LIMIT 100').all()).results });
  }
  return null;
}

/* ============ MEDIA IKLAN (gambar & video) untuk website — disimpan per potongan base64 di D1, dirakit di browser ============ */
const MID = /^[a-f0-9]{16}$/, MMAGIC = { image: [['/9j/', 'image/jpeg'], ['iVBOR', 'image/png'], ['UklGR', 'image/webp']], video: [['AAAA', 'video/mp4'], ['GkXfo', 'video/webm']] };
const MAX_MEDIA = 24, MAX_MCHUNKS = { image: 24, video: 120 };
const mPub = (r) => ({ id: r.id, kind: r.kind, name: r.name, type: r.type, size: r.size, sha: r.sha, n: r.n, cap: r.cap || '', t: r.t });
export async function mediaPublic(x) {
  const { env, p, M, u, ip, J, limited } = x;
  if (p == '/api/media' && M == 'GET') return J({ list: (await env.DB.prepare('SELECT * FROM wmedia ORDER BY t DESC LIMIT 24').all()).results.map(mPub) });
  if (p == '/api/media/chunk' && M == 'GET') {
    const id = u.searchParams.get('id') || '', i = Math.round(+u.searchParams.get('i')); if (!MID.test(id) || !(i >= 0)) return J({ e: 'tidak ada' }, 404);
    if (await limited(env, 'med:' + ip, 1500, 36e5)) return J({ e: 'terlalu sering' }, 429);
    const r = await env.DB.prepare('SELECT d FROM wmediac WHERE id=? AND i=?').bind(id, i).first(); if (!r) return J({ e: 'tidak ada' }, 404);
    return new Response(r.d, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400, immutable', 'Access-Control-Allow-Origin': '*' } });
  }
  return null;
}
async function mediaAdmin(x) {
  const { env, p, M, b, J, req, u } = x, now = Date.now();
  if (p == '/api/admin/media/chunk' && M == 'PUT') {
    const id = String(u.searchParams.get('id') || ''), i = Math.round(+u.searchParams.get('i')), kind = u.searchParams.get('k') == 'video' ? 'video' : 'image';
    if (!MID.test(id) || !(i >= 0 && i < MAX_MCHUNKS[kind])) return J({ e: 'parameter salah' }, 400);
    const d = await req.text(); if (!d || d.length > 520000 || !/^[A-Za-z0-9+/=]+$/.test(d)) return J({ e: 'potongan tidak valid' }, 400);
    if (i == 0 && !MMAGIC[kind].some(([m]) => d.startsWith(m))) return J({ e: kind == 'video' ? 'Video harus berformat MP4 atau WebM' : 'Gambar harus JPG, PNG, atau WebP' }, 400);
    if (!(await env.DB.prepare('SELECT 1 x FROM wmedia WHERE id=?').bind(id).first()) && (await env.DB.prepare('SELECT COUNT(*) n FROM wmedia').first()).n >= MAX_MEDIA) return J({ e: 'Maksimal ' + MAX_MEDIA + ' file. Hapus yang lama dulu.' }, 400);
    await env.DB.prepare('INSERT OR REPLACE INTO wmediac(id,i,d,t) VALUES(?,?,?,?)').bind(id, i, d, now).run(); return J({ ok: 1 });
  }
  if (p == '/api/admin/media/commit' && M == 'POST') {
    const id = String(b.id || ''), n = Math.round(+b.n), size = Math.round(+b.size), kind = b.kind == 'video' ? 'video' : 'image', sha = String(b.sha || '');
    if (!MID.test(id) || !(n >= 1 && n <= MAX_MCHUNKS[kind]) || !(size > 0 && size <= n * 360 * 1024) || !/^[a-f0-9]{64}$/.test(sha)) return J({ e: 'data tidak valid' }, 400);
    const have = (await env.DB.prepare('SELECT COUNT(*) c, MIN(i) mn, MAX(i) mx FROM wmediac WHERE id=?').bind(id).first());
    if (have.c != n || have.mn != 0 || have.mx != n - 1) return J({ e: 'Potongan belum lengkap (' + have.c + ' dari ' + n + '). Ulangi unggah.' }, 400);
    const first = (await env.DB.prepare('SELECT d FROM wmediac WHERE id=? AND i=0').bind(id).first()).d, type = (MMAGIC[kind].find(([m]) => first.startsWith(m)) || [0, ''])[1];
    const row = { id, kind, name: wClean(b.name, 80) || 'file', type, size, sha, n, cap: wClean(b.cap, 120), t: now };
    await env.DB.prepare('INSERT OR REPLACE INTO wmedia(id,kind,name,type,size,sha,n,cap,t) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, kind, row.name, type, size, sha, n, row.cap, now).run(); return J({ ok: 1, item: mPub(row) });
  }
  if (p == '/api/admin/media' && M == 'GET') return J({ list: (await env.DB.prepare('SELECT * FROM wmedia ORDER BY t DESC LIMIT 24').all()).results.map(mPub) });
  if (p == '/api/admin/media' && M == 'POST') { const id = String(b.id || ''); if (!MID.test(id)) return J({ e: 'id salah' }, 400); await env.DB.prepare('UPDATE wmedia SET cap=? WHERE id=?').bind(wClean(b.cap, 120), id).run(); return J({ ok: 1 }); }
  if (p == '/api/admin/media' && M == 'DELETE') { const id = String(u.searchParams.get('id') || ''); if (!MID.test(id)) return J({ e: 'id salah' }, 400); await env.DB.batch([env.DB.prepare('DELETE FROM wmedia WHERE id=?').bind(id), env.DB.prepare('DELETE FROM wmediac WHERE id=?').bind(id)]); return J({ ok: 1 }); }
  return null;
}
// Cadangan semua data website ke server Termux (dilindungi kunci tunnel yang sama)
export async function webExport(env, u, ip, J, C, limited) {
  if (await limited(env, 'exp:' + ip, 40, 36e5)) return J({ e: 'terlalu sering' }, 429);
  if (!C.tunnel_key || !safeEq(String(u.searchParams.get('key') || ''), C.tunnel_key)) return J({ e: 'kunci salah' }, 401);
  const q = async (sql) => (await env.DB.prepare(sql).all()).results;
  return J({ t: Date.now(), site: siteOf(C), apk: apkPubOf(C), media: (await q('SELECT * FROM wmedia ORDER BY t DESC')).map(mPub), ulasan: await q('SELECT * FROM wulasan ORDER BY t DESC LIMIT 500'), leads: await q('SELECT * FROM leads ORDER BY t DESC LIMIT 1000'), chat: await q('SELECT * FROM wchat ORDER BY id DESC LIMIT 3000') });
}


/* ============ PELACAK HP LAPANGAN (tetap jalan tanpa login & absen, pada jam kerja, dengan persetujuan karyawan) ============
   Token pelacak KHUSUS (typ 'trk', tanpa field sid) hanya boleh mengirim titik lokasi — tidak bisa membaca/menulis data toko lain. */
const GPSR_ = ['sales', 'kanvas', 'dropping'];
export async function trkIssue({ env, sid, uname, role, J, sign }) {
  if (!GPSR_.includes(role)) return J({ e: 'Hanya untuk sales / kanvas / dropping' }, 403);
  const exp = Date.now() + 90 * DAY; return J({ trk: await sign({ typ: 'trk', ts: sid, name: uname, exp }), exp });
}
export async function trkOff({ env, p, M, b, sid, role, J }) {
  if (role != 'owner') return J({ e: 'Khusus pemilik' }, 403);
  if (M == 'POST') { const u = String(b.user || '').slice(0, 40); if (!u) return J({ e: 'Pilih karyawan' }, 400); if (b.off) await env.DB.prepare('INSERT OR REPLACE INTO trkoff(sid,u,t) VALUES(?,?,?)').bind(sid, u, Date.now()).run(); else await env.DB.prepare('DELETE FROM trkoff WHERE sid=? AND u=?').bind(sid, u).run(); return J({ ok: 1 }); }
  return J({ off: (await env.DB.prepare('SELECT u FROM trkoff WHERE sid=?').bind(sid).all()).results.map((x) => x.u) });
}
export async function trkLoc(env, b, bearer, ip, J, verify, limited) {
  const tk = await verify(bearer); if (!tk || tk.typ != 'trk' || !tk.ts || !tk.name) return J({ e: 'Unauthorized', stop: 1 }, 401);
  if (await limited(env, 'trk:' + tk.ts + ':' + tk.name, 300, 36e5)) return J({ e: 'terlalu sering' }, 429);
  const me = await env.DB.prepare('SELECT s.status,s.exp,st.role FROM stores s JOIN staff st ON st.store_id=s.id AND st.name=? WHERE s.id=?').bind(tk.name, tk.ts).first();
  if (!me || me.status != 'active' || (me.exp && me.exp < Date.now()) || !GPSR_.includes(me.role)) return J({ e: 'Akun / toko tidak aktif', stop: 1 }, 401);
  if (await env.DB.prepare('SELECT 1 x FROM trkoff WHERE sid=? AND u=?').bind(tk.ts, tk.name).first()) return J({ e: 'Pelacakan dihentikan oleh pemilik', stop: 1 }, 403);
  const now = Date.now(), st = []; let n = 0;
  for (const x of (Array.isArray(b.items) ? b.items : []).slice(0, 20)) {
    const t = Math.round(+x.t); if (!okLL(x.lat, x.lng) || !(t < now + 3e5 && t > now - 6 * 36e5)) continue;
    const no = 'loc-k' + t.toString(36) + hex(crypto.getRandomValues(new Uint8Array(3))), ev = { no, k: 'loc', t, lat: +(+x.lat).toFixed(6), lng: +(+x.lng).toFixed(6), acc: x.acc != null ? Math.round(+x.acc) || null : null, pg: 'bg', via: 'trk', u: tk.name, r: me.role, rt: now };
    st.push(env.DB.prepare('INSERT OR IGNORE INTO ev(store_id,no,k,t,tot,data) VALUES(?,?,?,?,0,?)').bind(tk.ts, no, 'loc', t, JSON.stringify(ev)));
    const ts = trailStmt(env, tk.ts, tk.name, ev, now); if (ts) st.push(ts); n++;
  }
  if (st.length) { await env.DB.batch(st); try { await env.DB.prepare("DELETE FROM ev WHERE store_id=? AND k='loc' AND json_extract(data,'$.u')=? AND seq < (SELECT MAX(seq) FROM ev WHERE store_id=? AND k='loc' AND json_extract(data,'$.u')=?)").bind(tk.ts, tk.name, tk.ts, tk.name).run(); } catch (e) { } }
  return J({ ok: 1, n });
}
