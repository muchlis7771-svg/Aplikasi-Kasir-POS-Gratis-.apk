import { socialPublic, socialBuyer, socialShop, logAct, voucherDisc, PSEL, PJOIN, pfix } from './social.js';
// J-POS Pasar Online: akun pembeli, katalog semua toko, pesanan, tawar harga, ongkir per jarak,
// kredit pembeli (ACC toko) + skor kelayakan, chat pembeli <-> toko.
const DAY = 864e5;
export const MSCHEMA = [
  'CREATE TABLE IF NOT EXISTS buyers(id INTEGER PRIMARY KEY AUTOINCREMENT,phone TEXT UNIQUE,name TEXT,pin_hash TEXT,addr TEXT,lat REAL,lng REAL,status TEXT DEFAULT \'active\',created INTEGER)',
  'CREATE TABLE IF NOT EXISTS shop(store_id TEXT PRIMARY KEY,open INTEGER DEFAULT 0,lat REAL,lng REAL,addr TEXT,bank TEXT,wa TEXT,cod INTEGER DEFAULT 1,credit INTEGER DEFAULT 0,descr TEXT,minorder INTEGER DEFAULT 0,ships TEXT,upd INTEGER)',
  'CREATE TABLE IF NOT EXISTS catalog(store_id TEXT NOT NULL,pid TEXT NOT NULL,n TEXT,c TEXT,pr INTEGER,opr INTEGER,st INTEGER,img TEXT,sku TEXT,unit TEXT,upd INTEGER,PRIMARY KEY(store_id,pid))',
  'CREATE INDEX IF NOT EXISTS catalog_n ON catalog(n)',
  'CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,buyer_id INTEGER NOT NULL,items TEXT,sub INTEGER,ship INTEGER,tot INTEGER,status TEXT,pay TEXT,method TEXT,dist INTEGER,addr TEXT,lat REAL,lng REAL,courier TEXT,resi TEXT,note TEXT,days INTEGER,due INTEGER,paid INTEGER DEFAULT 0,paid_t INTEGER,sale_no TEXT,hist TEXT,t INTEGER,upd INTEGER)',
  'CREATE INDEX IF NOT EXISTS orders_store ON orders(store_id,upd)', 'CREATE INDEX IF NOT EXISTS orders_buyer ON orders(buyer_id,upd)',
  'CREATE TABLE IF NOT EXISTS bcredit(store_id TEXT NOT NULL,buyer_id INTEGER NOT NULL,lim INTEGER,days INTEGER,t INTEGER,PRIMARY KEY(store_id,buyer_id))',
];
export const METHODS = { ambil: ['Ambil sendiri', 'none'], kurir: ['Kurir toko', 'instant'], gosend: ['GoSend', 'instant'], grab: ['GrabExpress', 'instant'], jnt: ['J&T Express', 'exp'], jne: ['JNE', 'exp'], sicepat: ['SiCepat', 'exp'] };
const hav = (a, b, c, d) => { const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(h)); };
const okLL = (a, b) => Number.isFinite(+a) && Number.isFinite(+b) && Math.abs(+a) <= 90 && Math.abs(+b) <= 180 && !(+a == 0 && +b == 0);
export function shipCfg(c) {
  return { base: +(c.ship_base ?? 5000), per_m: +(c.ship_per_m ?? 2.5), road: +(c.ship_road ?? 1.3), min: +(c.ship_min ?? 8000), max_km: +(c.ship_max_km ?? 30), round: +(c.ship_round ?? 500) };
}
// ongkir instan: (tarif dasar + jarak jalan (m) x tarif per meter), minimal, dibulatkan
export function shipFee(cfg, meters) {
  const road = meters * cfg.road; if (road / 1000 > cfg.max_km) return null;
  const f = Math.max(cfg.min, cfg.base + road * cfg.per_m); return Math.ceil(f / cfg.round) * cfg.round;
}
// skor kelayakan kredit pembeli (seluruh toko di platform)
export async function creditScore(env, bid) {
  const now = Date.now(), b = await env.DB.prepare('SELECT created FROM buyers WHERE id=?').bind(bid).first();
  const r = (await env.DB.prepare("SELECT status,tot,pay,due,paid,paid_t FROM orders WHERE buyer_id=?").bind(bid).all()).results;
  const done = r.filter((o) => o.status == 'selesai'), cr = r.filter((o) => o.pay == 'kredit' && ['diproses', 'dikirim', 'selesai'].includes(o.status));
  const ontime = cr.filter((o) => o.paid && o.paid_t <= o.due).length, late = cr.filter((o) => o.paid && o.paid_t > o.due).length;
  const overdue = cr.filter((o) => !o.paid && o.due && o.due < now), owing = cr.filter((o) => !o.paid).reduce((a, o) => a + o.tot, 0);
  const cancel = r.filter((o) => o.status == 'batal').length, age = b ? Math.floor((now - b.created) / DAY) : 0;
  const val = done.reduce((a, o) => a + o.tot, 0), avg = done.length ? val / done.length : 0;
  let s = 30 + Math.min(25, done.length * 2.5) + Math.min(15, age / 12) + (cr.length ? (20 * ontime) / cr.length : 8) - 15 * overdue.length - 5 * late - 2 * cancel;
  s = Math.max(0, Math.min(100, Math.round(s)));
  const g = s >= 75 ? 'A' : s >= 55 ? 'B' : s >= 35 ? 'C' : 'D', mult = { A: 3, B: 1.5, C: 0.5, D: 0 }[g];
  const rec = done.length < 2 ? Math.min(500000, Math.round((avg * mult) / 1000) * 1000) : Math.round((avg * mult) / 50000) * 50000;
  const why = [`${done.length} pesanan selesai (nilai ${val.toLocaleString('id-ID')})`, `akun ${age} hari`, cr.length ? `${ontime}/${cr.length} kredit lunas tepat waktu` : 'belum pernah kredit', ...(late ? [`${late} kali telat bayar`] : []), ...(overdue.length ? [`${overdue.length} tagihan lewat jatuh tempo`] : []), ...(cancel ? [`${cancel} pesanan dibatalkan`] : [])];
  return { score: s, grade: g, label: { A: 'Layak kredit', B: 'Layak (limit terbatas)', C: 'Hati-hati', D: 'Tidak disarankan' }[g], rec, owing, overdue: overdue.length, done: done.length, why };
}
const addSold = (env, o) => env.DB.batch(JSON.parse(o.items).map((i) => env.DB.prepare('UPDATE catalog SET sold=COALESCE(sold,0)+? WHERE store_id=? AND pid=?').bind(i.q, o.store_id, i.pid)));
const bOut = (o) => ({ ...o, items: JSON.parse(o.items || '[]'), hist: JSON.parse(o.hist || '[]') });
const push = (o, who, txt) => { const h = JSON.parse(o.hist || '[]'); h.push({ t: Date.now(), who, txt }); return JSON.stringify(h.slice(-40)); };
async function owing(env, sid, bid) { return (await env.DB.prepare("SELECT COALESCE(SUM(tot),0) v FROM orders WHERE store_id=? AND buyer_id=? AND pay='kredit' AND paid=0 AND status IN('diproses','dikirim','selesai')").bind(sid, bid).first()).v; }
// harga grosir bertingkat (beli >= min dapat diskon d, mis. "5" atau "5+2" %)
const cfacS = (d) => String(d || '').split('+').map((x) => parseFloat(String(x).replace(',', '.')) || 0).reduce((a, v) => a * (1 - Math.min(100, Math.max(0, v)) / 100), 1);
const tierJs = (t) => { const L = (Array.isArray(t) ? t : []).map((x) => ({ min: Math.round(+x.min), d: String(x.d || '').slice(0, 12) })).filter((x) => x.min >= 2 && cfacS(x.d) < 1).slice(0, 8); return L.length ? JSON.stringify(L) : null; };
export const tierPrice = (base, tiers, q) => { let best = 1; try { for (const x of JSON.parse(tiers || '[]')) if (q >= x.min) best = Math.min(best, cfacS(x.d)); } catch (e) { } return Math.round(base * best); };
const shopOpen = "s.status='active' AND (s.exp IS NULL OR s.exp>?) AND sh.open=1";

// ================= PEMBELI =================
export async function buyerRoutes(x) {
  const { env, p, M, b, u, J, ip, sign, verify, limited, cfgAll, pbk, same, bearer } = x;
  const now = Date.now();
  if (p == '/api/b/register' && M == 'POST') {
    if (await limited(env, 'breg:' + ip, 8, 36e5)) return J({ e: 'Terlalu banyak pendaftaran, coba lagi nanti' }, 429);
    const phone = String(b.phone || '').replace(/\D/g, '').replace(/^62/, '0'), name = String(b.name || '').trim().slice(0, 50), pin = String(b.pin || '');
    if (!/^0\d{8,13}$/.test(phone) || name.length < 2 || !/^\d{4,8}$/.test(pin)) return J({ e: 'Isi nomor HP (08…), nama, dan PIN 4–8 angka' }, 400);
    const kios = b.kind == 'kios', kname = String(b.kname || '').trim().slice(0, 60);
    if (kios && (kname.length < 2 || !okLL(b.lat, b.lng))) return J({ e: 'Kios wajib mengisi nama kios dan titik lokasi GPS' }, 400);
    try {
      const r = await env.DB.prepare('INSERT INTO buyers(phone,name,pin_hash,addr,lat,lng,created,kind,kname,kvis) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(phone, name, await pbk(pin, 'b:' + phone), String(b.addr || '').slice(0, 200), okLL(b.lat, b.lng) ? +b.lat : null, okLL(b.lat, b.lng) ? +b.lng : null, now, kios ? 'kios' : null, kios ? kname : null, kios && b.kvis ? 1 : 0).run();
      const id = r.meta.last_row_id; await logAct(env, 'buyer', id, name, null, kios ? 'daftar kios' : 'daftar pembeli', phone); return J({ token: await sign({ bid: id, role: 'buyer', exp: now + 90 * DAY }), me: { id, phone, name, addr: b.addr || '', lat: b.lat, lng: b.lng, kind: kios ? 'kios' : null, kname: kios ? kname : null, kvis: kios && b.kvis ? 1 : 0 } });
    } catch { return J({ e: 'Nomor HP sudah terdaftar, silakan masuk' }, 409); }
  }
  if (p == '/api/b/login' && M == 'POST') {
    const phone = String(b.phone || '').replace(/\D/g, '').replace(/^62/, '0');
    if ((await limited(env, 'blog:' + ip, 30, 6e5)) || (await limited(env, 'blog:' + phone, 8, 6e5))) return J({ e: 'Terlalu banyak percobaan, coba lagi 10 menit' }, 429);
    const r = await env.DB.prepare('SELECT * FROM buyers WHERE phone=?').bind(phone).first();
    if (!r || !(await same(r.pin_hash, await pbk(String(b.pin || ''), 'b:' + phone)))) return J({ e: 'Nomor HP atau PIN salah' }, 401);
    if (r.status != 'active') return J({ e: 'Akun pembeli diblokir' }, 403);
    await logAct(env, 'buyer', r.id, r.name, null, 'login pembeli', null);
    return J({ token: await sign({ bid: r.id, role: 'buyer', exp: now + 90 * DAY }), me: { id: r.id, phone: r.phone, name: r.name, addr: r.addr, lat: r.lat, lng: r.lng, kind: r.kind, kname: r.kname, kvis: r.kvis } });
  }
  // katalog publik (tanpa login pun bisa melihat)
  const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lng'), hasLL = okLL(lat, lng);
  const ob = bearer ? await verify(bearer) : null, obid = ob && ob.role == 'buyer' ? ob.bid : null;
  const sp = await socialPublic({ ...x, hav, lat, lng, hasLL, shopOpen }, obid); if (sp) return sp;
  if (p == '/api/b/stores' && M == 'GET') {
    const r = (await env.DB.prepare(`SELECT s.id,s.name,s.tier,sh.lat,sh.lng,sh.addr,sh.descr,sh.cod,sh.credit,sh.minorder,sh.ships,(SELECT COUNT(*) FROM catalog c WHERE c.store_id=s.id AND c.st>0) np FROM stores s JOIN shop sh ON sh.store_id=s.id WHERE ${shopOpen} LIMIT 500`).bind(now).all()).results;
    r.forEach((s) => (s.dist = hasLL && s.lat != null ? Math.round(hav(lat, lng, s.lat, s.lng)) : null)); r.sort((a, c) => (a.dist ?? 9e9) - (c.dist ?? 9e9));
    return J({ stores: r });
  }
  if (p == '/api/b/products' && M == 'GET') {
    const q = String(u.searchParams.get('q') || '').trim().slice(0, 50), cat = String(u.searchParams.get('cat') || ''), st = String(u.searchParams.get('store') || '');
    let sql = `SELECT ${PSEL(now)} ${PJOIN} WHERE ${shopOpen} AND c.st>0`; const a = [now];
    if (q) { sql += ' AND (c.n LIKE ? OR c.c LIKE ? OR c.sku=?)'; a.push('%' + q + '%', '%' + q + '%', q); }
    if (cat) { sql += ' AND c.c=?'; a.push(cat); }
    if (st) { sql += ' AND c.store_id=?'; a.push(st); }
    const r = (await env.DB.prepare(sql + ' LIMIT 600').bind(...a).all()).results;
    r.forEach((y) => pfix(y, hav, lat, lng, hasLL));
    const so = u.searchParams.get('sort') || 'near', S = { near: (x, y) => (x.dist ?? 9e9) - (y.dist ?? 9e9) || x.price - y.price, cheap: (x, y) => x.price - y.price, sold: (x, y) => y.sold - x.sold, rating: (x, y) => (y.rt || 0) - (x.rt || 0) || y.rc - x.rc, promo: (x, y) => (y.fsp ? 1 : 0) - (x.fsp ? 1 : 0) };
    r.sort(S[so] || S.near);
    const cats = st ? [] : (await env.DB.prepare(`SELECT c.c,COUNT(*) n FROM catalog c JOIN stores s ON s.id=c.store_id JOIN shop sh ON sh.store_id=c.store_id WHERE ${shopOpen} AND c.st>0 GROUP BY c.c ORDER BY n DESC LIMIT 20`).bind(now).all()).results;
    return J({ items: r.slice(0, 300), cats });
  }
  if (p == '/api/b/quote' && M == 'POST') {
    const sh = await env.DB.prepare('SELECT lat,lng FROM shop WHERE store_id=?').bind(String(b.store || '')).first();
    return J(await quote(env, cfgAll, sh, b.lat, b.lng));
  }
  if (p == '/api/b/info') { const c = shipCfg(await cfgAll(env)); return J({ ship: c, methods: METHODS }); }

  // ---- perlu login pembeli ----
  const t = await verify(bearer);
  if (!t || t.role != 'buyer') return J({ e: 'Silakan masuk sebagai pembeli' }, 401);
  const bid = t.bid, me = await env.DB.prepare('SELECT * FROM buyers WHERE id=?').bind(bid).first();
  if (!me || me.status != 'active') return J({ e: 'Akun pembeli tidak aktif' }, 403);
  const sb = await socialBuyer({ ...x, hav, lat, lng, hasLL }, bid, me); if (sb) return sb;
  if (p == '/api/b/me') {
    if (M == 'PUT') {
      const nm = String(b.name ?? me.name).trim().slice(0, 50), ad = String(b.addr ?? me.addr ?? '').slice(0, 200), ll = okLL(b.lat, b.lng);
      await env.DB.prepare('UPDATE buyers SET name=?,addr=?,lat=?,lng=? WHERE id=?').bind(nm || me.name, ad, ll ? +b.lat : me.lat, ll ? +b.lng : me.lng, bid).run();
      if (b.kind !== undefined || b.kname !== undefined || b.kvis !== undefined) { const k = b.kind === undefined ? me.kind : b.kind == 'kios' ? 'kios' : null; await env.DB.prepare('UPDATE buyers SET kind=?,kname=?,kvis=? WHERE id=?').bind(k, k ? String(b.kname ?? me.kname ?? nm).trim().slice(0, 60) : null, k && (b.kvis ?? me.kvis) ? 1 : 0, bid).run(); }
      if (Array.isArray(b.addrs)) await env.DB.prepare('UPDATE buyers SET addrs=? WHERE id=?').bind(JSON.stringify(b.addrs.slice(0, 10).map((x) => ({ label: String(x.label || '').slice(0, 30), name: String(x.name || '').slice(0, 50), phone: String(x.phone || '').slice(0, 20), addr: String(x.addr || '').slice(0, 200), lat: okLL(x.lat, x.lng) ? +x.lat : null, lng: okLL(x.lat, x.lng) ? +x.lng : null, main: !!x.main }))), bid).run();
      if (b.pin) { if (!/^\d{4,8}$/.test(String(b.pin)) || !(await same(me.pin_hash, await pbk(String(b.old || ''), 'b:' + me.phone)))) return J({ e: 'PIN lama salah / PIN baru 4–8 angka' }, 400); await env.DB.prepare('UPDATE buyers SET pin_hash=? WHERE id=?').bind(await pbk(String(b.pin), 'b:' + me.phone), bid).run(); }
    }
    const r = await env.DB.prepare('SELECT id,phone,name,addr,lat,lng,created,addrs,kind,kname,kvis FROM buyers WHERE id=?').bind(bid).first(); r.addrs = JSON.parse(r.addrs || '[]');
    return J({ me: r, credit: await creditScore(env, bid), lim: (await env.DB.prepare('SELECT bc.store_id,s.name,bc.lim,bc.days FROM bcredit bc JOIN stores s ON s.id=bc.store_id WHERE bc.buyer_id=?').bind(bid).all()).results });
  }
  if (p == '/api/b/orders' && M == 'POST') {
    if (await limited(env, 'bord:' + bid, 20, 36e5)) return J({ e: 'Terlalu banyak pesanan, coba lagi nanti' }, 429);
    const sid = String(b.store || ''), sh = await env.DB.prepare(`SELECT sh.*,s.name FROM shop sh JOIN stores s ON s.id=sh.store_id WHERE sh.store_id=? AND ${shopOpen}`).bind(sid, now).first();
    if (!sh) return J({ e: 'Toko sedang tidak menerima pesanan online' }, 400);
    const L = (Array.isArray(b.items) ? b.items : []).slice(0, 50), items = []; let sub = 0, nego = false;
    for (const it of L) {
      const q = Math.round(+it.q); if (!(q > 0)) continue;
      const c = await env.DB.prepare('SELECT c.*,CASE WHEN f.end>? THEN f.price END fsp FROM catalog c LEFT JOIN flash f ON f.store_id=c.store_id AND f.pid=c.pid WHERE c.store_id=? AND c.pid=?').bind(now, sid, String(it.pid)).first();
      if (!c) return J({ e: 'Produk tidak ditemukan / sudah tidak dijual' }, 400);
      if (c.st < q) return J({ e: 'Stok ' + c.n + ' tidak cukup (sisa ' + c.st + ')' }, 400);
      const price = c.fsp || tierPrice(c.opr || c.pr, c.tiers, q), offer = Math.round(+it.offer) || 0; // flash sale, atau harga grosir sesuai jumlah
      if (offer && offer < price) nego = true;
      items.push({ pid: c.pid, n: c.n, q, price, offer: offer && offer < price ? offer : 0, unit: c.unit || '' }); sub += price * q;
    }
    if (!items.length) return J({ e: 'Keranjang kosong' }, 400);
    if (sh.minorder && sub < sh.minorder) return J({ e: 'Minimal belanja di toko ini Rp' + sh.minorder.toLocaleString('id-ID') }, 400);
    const method = METHODS[b.method] ? b.method : 'ambil', ships = String(sh.ships || 'ambil,kurir');
    if (!ships.split(',').includes(method)) return J({ e: 'Toko tidak melayani pengiriman ' + METHODS[method][0] }, 400);
    const ll = okLL(b.lat, b.lng) ? [+b.lat, +b.lng] : [me.lat, me.lng];
    let ship = 0, dist = null;
    if (METHODS[method][1] != 'none') {
      if (ll[0] == null || sh.lat == null) return J({ e: 'Lokasi pengiriman / lokasi toko belum diatur' }, 400);
      const qv = await quote(env, cfgAll, sh, ll[0], ll[1]); dist = qv.dist;
      if (METHODS[method][1] == 'instant') { if (qv.fee == null) return J({ e: 'Jarak terlalu jauh untuk kurir instan (' + (dist / 1000).toFixed(1) + ' km)' }, 400); ship = qv.fee; }
    }
    const vd = await voucherDisc(env, sid, b.voucher, sub); if (vd.e) return J({ e: vd.e }, 400); const disc = vd.disc || 0;
    const pay = ['cod', 'transfer', 'kredit'].includes(b.pay) ? b.pay : 'transfer';
    if (pay == 'cod' && !sh.cod) return J({ e: 'Toko tidak menerima COD' }, 400);
    if (pay == 'kredit' && !sh.credit) return J({ e: 'Toko tidak menerima pembayaran kredit' }, 400);
    const days = pay == 'kredit' ? Math.max(1, Math.min(90, Math.round(+b.days) || 14)) : 0;
    const status = nego ? 'nego' : pay == 'kredit' ? 'acc_kredit' : 'baru';
    const hist = JSON.stringify([{ t: now, who: 'pembeli', txt: nego ? 'Pesanan dibuat dengan penawaran harga' : 'Pesanan dibuat' }]);
    const r = await env.DB.prepare('INSERT INTO orders(store_id,buyer_id,items,sub,ship,tot,status,pay,method,dist,addr,lat,lng,note,days,hist,t,upd,disc,vcode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(sid, bid, JSON.stringify(items), sub, ship, sub - disc + ship, status, pay, method, dist, String(b.addr || me.addr || '').slice(0, 200), ll[0], ll[1], String(b.note || '').slice(0, 300), days, hist, now, now, disc, vd.code || null).run();
    if (vd.v) await env.DB.prepare('UPDATE vouchers SET used=used+1 WHERE id=?').bind(vd.v.id).run();
    await logAct(env, 'buyer', bid, me.name, sid, 'buat pesanan', '#' + r.meta.last_row_id + ' · ' + (sub - disc + ship).toLocaleString('id-ID') + ' · ' + pay);
    return J({ ok: 1, id: r.meta.last_row_id, status });
  }
  if (p == '/api/b/orders' && M == 'GET') {
    const r = (await env.DB.prepare('SELECT o.*,s.name sn,sh.bank,sh.wa FROM orders o JOIN stores s ON s.id=o.store_id LEFT JOIN shop sh ON sh.store_id=o.store_id WHERE o.buyer_id=? ORDER BY o.id DESC LIMIT 100').bind(bid).all()).results;
    return J({ orders: r.map(bOut) });
  }
  let m = p.match(/^\/api\/b\/orders\/(\d+)\/act$/);
  if (m && M == 'POST') {
    const o = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND buyer_id=?').bind(+m[1], bid).first();
    if (!o) return J({ e: 'Pesanan tidak ditemukan' }, 404);
    await logAct(env, 'buyer', bid, me.name, o.store_id, 'pesanan ' + b.act, '#' + o.id);
    const set = async (st, txt, extra = '') => { await env.DB.prepare(`UPDATE orders SET status=?,hist=?,upd=?${extra} WHERE id=?`).bind(st, push(o, 'pembeli', txt), Date.now(), o.id).run(); return J({ ok: 1 }); };
    if (b.act == 'cancel' && ['nego', 'nego_toko', 'baru', 'acc_kredit'].includes(o.status)) return set('batal', 'Dibatalkan pembeli');
    if (b.act == 'accept_counter' && o.status == 'nego_toko') { const items = JSON.parse(o.items).map((i) => ({ ...i, price: i.counter || i.price, offer: 0 })); const sub = items.reduce((a, i) => a + i.price * i.q, 0); await env.DB.prepare('UPDATE orders SET items=?,sub=?,tot=?+ship-COALESCE(disc,0) WHERE id=?').bind(JSON.stringify(items), sub, sub, o.id).run(); return set(o.pay == 'kredit' ? 'acc_kredit' : 'baru', 'Pembeli setuju harga tawaran toko'); }
    if (b.act == 'received' && o.status == 'dikirim') { await addSold(env, o); return set('selesai', 'Pesanan diterima pembeli'); }
    if (b.act == 'paid_claim' && !o.paid) { await env.DB.prepare('UPDATE orders SET hist=?,upd=? WHERE id=?').bind(push(o, 'pembeli', 'Pembeli menyatakan sudah transfer' + (b.note ? ': ' + String(b.note).slice(0, 100) : '')), Date.now(), o.id).run(); return J({ ok: 1 }); }
    return J({ e: 'Aksi tidak bisa dilakukan pada status ini' }, 400);
  }
  if (p == '/api/b/chats' && M == 'GET') {
    const r = (await env.DB.prepare("SELECT c.room,MAX(c.seq) last,s.name FROM chat c JOIN stores s ON s.id=substr(c.room,length(?)+1) WHERE c.room LIKE ? GROUP BY c.room ORDER BY last DESC LIMIT 50").bind('bs:' + bid + ':', 'bs:' + bid + ':%').all()).results;
    return J({ rooms: r.map((x) => ({ store: x.room.split(':')[2], name: x.name, last: x.last })) });
  }
  if (p == '/api/b/chat') {
    const sid = String((M == 'POST' ? b.store : u.searchParams.get('store')) || ''), s = await env.DB.prepare('SELECT name FROM stores WHERE id=?').bind(sid).first();
    if (!s) return J({ e: 'Toko tidak ditemukan' }, 404);
    const key = 'bs:' + bid + ':' + sid;
    if (M == 'POST') {
      const tx = String(b.text || '').trim().slice(0, 500); if (!tx) return J({ e: 'Pesan kosong' }, 400);
      if (await limited(env, 'bchat:' + bid, 20, 3e4)) return J({ e: 'Terlalu cepat' }, 429);
      await env.DB.prepare('INSERT INTO chat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind(key, 'b' + bid, 'Pembeli', me.name, tx, now).run(); return J({ ok: 1 });
    }
    const since = +u.searchParams.get('since') || 0;
    return J({ m: (await env.DB.prepare('SELECT seq,sid,sn,un,tx,t FROM chat WHERE room=? AND seq>? ORDER BY seq LIMIT 200').bind(key, since).all()).results, store: { id: sid, name: s.name } });
  }
  return J({ e: 'Not found' }, 404);
}
async function quote(env, cfgAll, sh, la, ln) {
  if (!sh || sh.lat == null || !okLL(la, ln)) return { dist: null, fee: null, e: 'Lokasi belum lengkap' };
  const c = shipCfg(await cfgAll(env)), d = Math.round(hav(+la, +ln, sh.lat, sh.lng));
  return { dist: d, road: Math.round(d * c.road), fee: shipFee(c, d), cfg: c };
}

// ================= TOKO (staf owner/admin) =================
export async function shopRoutes(x) {
  const { env, p, M, b, u, J, sid, role, uname, EXP } = x;
  const now = Date.now(), boss = role == 'owner' || role == 'admin';
  const ss = await socialShop(x); if (ss) return ss;
  if (p == '/api/shop/profile') {
    if (M == 'PUT') {
      if (!boss) return J({ e: 'Khusus owner/admin' }, 403);
      const ll = okLL(b.lat, b.lng), ships = String(b.ships || 'ambil,kurir').split(',').filter((k) => METHODS[k]).join(',') || 'ambil';
      await env.DB.prepare(`INSERT INTO shop(store_id,open,lat,lng,addr,bank,wa,cod,credit,descr,minorder,ships,upd) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(store_id) DO UPDATE SET open=excluded.open,lat=excluded.lat,lng=excluded.lng,addr=excluded.addr,bank=excluded.bank,wa=excluded.wa,cod=excluded.cod,credit=excluded.credit,descr=excluded.descr,minorder=excluded.minorder,ships=excluded.ships,upd=excluded.upd`)
        .bind(sid, b.open ? 1 : 0, ll ? +b.lat : null, ll ? +b.lng : null, String(b.addr || '').slice(0, 200), String(b.bank || '').slice(0, 200), String(b.wa || '').replace(/\D/g, '').slice(0, 20), b.cod ? 1 : 0, role == 'owner' ? (b.credit ? 1 : 0) : 0, String(b.descr || '').slice(0, 300), Math.max(0, Math.round(+b.minorder) || 0), ships, now).run();
      if (role != 'owner') await env.DB.prepare('UPDATE shop SET credit=(SELECT credit FROM shop WHERE store_id=?) WHERE store_id=?').bind(sid, sid).run();
    }
    const sh = await env.DB.prepare('SELECT * FROM shop WHERE store_id=?').bind(sid).first();
    return J({ shop: sh || { open: 0, cod: 1, credit: 0, ships: 'ambil,kurir' }, n: (await env.DB.prepare('SELECT COUNT(*) n FROM catalog WHERE store_id=?').bind(sid).first()).n, methods: METHODS });
  }
  if (p == '/api/shop/catalog' && M == 'POST') {
    if (!['owner', 'admin', 'akuntan'].includes(role)) return J({ e: 'Khusus owner/admin' }, 403);
    const L = (Array.isArray(b.items) ? b.items : []).slice(0, 3000), st = [];
    // toko otomatis tampil di pasar saat pertama kali mengirim katalog (bisa ditutup di pengaturan)
    const sh0 = b.shop || {}; await env.DB.prepare('INSERT OR IGNORE INTO shop(store_id,open,lat,lng,addr,cod,credit,ships,upd) VALUES(?,1,?,?,?,1,0,?,?)').bind(sid, okLL(sh0.lat, sh0.lng) ? +sh0.lat : null, okLL(sh0.lat, sh0.lng) ? +sh0.lng : null, String(sh0.addr || '').slice(0, 200), 'ambil,kurir', now).run();
    if (okLL(sh0.lat, sh0.lng)) await env.DB.prepare('UPDATE shop SET lat=?,lng=? WHERE store_id=? AND lat IS NULL').bind(+sh0.lat, +sh0.lng, sid).run();
    for (const it of L) {
      if (!/^[\w-]{1,40}$/.test(String(it.id)) || !it.n) continue;
      st.push(env.DB.prepare('INSERT INTO catalog(store_id,pid,n,c,pr,opr,st,img,sku,unit,upd,tiers,kd,br) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(store_id,pid) DO UPDATE SET n=excluded.n,c=excluded.c,pr=excluded.pr,opr=excluded.opr,st=excluded.st,img=excluded.img,sku=excluded.sku,unit=excluded.unit,upd=excluded.upd,tiers=excluded.tiers,kd=excluded.kd,br=excluded.br').bind(sid, String(it.id), String(it.n).slice(0, 80), String(it.c || 'Umum').slice(0, 40), Math.max(0, Math.round(+it.pr) || 0), Math.max(0, Math.round(+it.opr) || 0), Math.max(0, Math.round(+it.st) || 0), String(it.img || '').slice(0, 150000), String(it.sku || '').slice(0, 40), String(it.u || '').slice(0, 15), now, tierJs(it.t), String(it.kd || '').slice(0, 30), String(it.b || '').slice(0, 40)));
    }
    for (let i = 0; i < st.length; i += 90) await env.DB.batch(st.slice(i, i + 90));
    await env.DB.prepare('DELETE FROM catalog WHERE store_id=? AND upd<?').bind(sid, now).run();
    return J({ ok: 1, n: st.length, open: (await env.DB.prepare('SELECT open FROM shop WHERE store_id=?').bind(sid).first()).open });
  }
  if (p == '/api/shop/orders' && M == 'GET') {
    const since = +u.searchParams.get('since') || 0;
    const r = (await env.DB.prepare('SELECT o.*,b.name bn,b.phone bp FROM orders o JOIN buyers b ON b.id=o.buyer_id WHERE o.store_id=? AND o.upd>? ORDER BY o.id DESC LIMIT 200').bind(sid, since).all()).results;
    return J({ orders: r.map(bOut), now });
  }
  let m = p.match(/^\/api\/shop\/orders\/(\d+)\/act$/);
  if (m && M == 'POST') {
    if (EXP) return J({ e: 'Masa aktif toko habis', expired: 1 }, 402);
    const o = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND store_id=?').bind(+m[1], sid).first();
    if (!o) return J({ e: 'Pesanan tidak ditemukan' }, 404);
    const who = uname + ' (toko)', act = b.act; await logAct(env, 'staff', uname, uname, sid, 'pesanan online ' + act, '#' + o.id);
    const set = async (st, txt, sql = '', ...v) => { await env.DB.prepare(`UPDATE orders SET status=?,hist=?,upd=?${sql} WHERE id=?`).bind(st, push(o, who, txt), Date.now(), ...v, o.id).run(); return J({ ok: 1 }); };
    const shipFeeIn = Math.max(0, Math.round(+b.ship) || 0);
    if (act == 'reject' && !['selesai', 'batal', 'ditolak'].includes(o.status)) return set('ditolak', 'Ditolak toko' + (b.reason ? ': ' + String(b.reason).slice(0, 150) : ''));
    if (act == 'counter' && ['nego', 'baru', 'acc_kredit'].includes(o.status)) {
      const cp = b.prices || {}, items = JSON.parse(o.items).map((i) => ({ ...i, counter: Math.max(1, Math.round(+cp[i.pid]) || i.offer || i.price) }));
      await env.DB.prepare('UPDATE orders SET items=? WHERE id=?').bind(JSON.stringify(items), o.id).run(); return set('nego_toko', 'Toko memberi harga: ' + items.map((i) => i.n + ' @' + i.counter.toLocaleString('id-ID')).join(', '));
    }
    if (act == 'accept_offer' && o.status == 'nego') {
      const items = JSON.parse(o.items).map((i) => ({ ...i, price: i.offer || i.price, offer: 0 })), sub = items.reduce((a, i) => a + i.price * i.q, 0);
      await env.DB.prepare('UPDATE orders SET items=?,sub=?,tot=?+ship-COALESCE(disc,0) WHERE id=?').bind(JSON.stringify(items), sub, sub, o.id).run();
      return set(o.pay == 'kredit' ? 'acc_kredit' : 'baru', 'Toko menyetujui harga tawaran');
    }
    if (act == 'acc_credit' && o.status == 'acc_kredit') {
      if (role != 'owner') return J({ e: 'ACC kredit hanya oleh pemilik toko (owner)' }, 403);
      const lim = Math.round(+b.lim) || o.tot, days = Math.max(1, Math.min(90, Math.round(+b.days) || o.days || 14)), cur = await owing(env, sid, o.buyer_id);
      if (cur + o.tot > lim) return J({ e: `Limit kurang: piutang pembeli ${cur.toLocaleString('id-ID')} + pesanan ${o.tot.toLocaleString('id-ID')} > limit ${lim.toLocaleString('id-ID')}` }, 400);
      await env.DB.prepare('INSERT INTO bcredit(store_id,buyer_id,lim,days,t) VALUES(?,?,?,?,?) ON CONFLICT(store_id,buyer_id) DO UPDATE SET lim=excluded.lim,days=excluded.days,t=excluded.t').bind(sid, o.buyer_id, lim, days, now).run();
      return set('diproses', `Kredit di-ACC: tempo ${days} hari, limit ${lim.toLocaleString('id-ID')}`, ',days=?,due=?', days, now + days * DAY);
    }
    if (act == 'accept' && o.status == 'baru') return set('diproses', 'Pesanan diterima & diproses toko' + (shipFeeIn && o.ship == 0 ? ' · ongkir ' + shipFeeIn.toLocaleString('id-ID') : ''), ',ship=CASE WHEN ship=0 THEN ? ELSE ship END,tot=sub-COALESCE(disc,0)+CASE WHEN ship=0 THEN ? ELSE ship END', shipFeeIn, shipFeeIn);
    if (act == 'ship' && o.status == 'diproses') {
      const cour = METHODS[b.courier] ? b.courier : o.method, resi = String(b.resi || '').slice(0, 60);
      return set('dikirim', (o.method == 'ambil' ? 'Siap diambil' : 'Dikirim via ' + METHODS[cour][0]) + (resi ? ' · resi ' + resi : ''), ',courier=?,resi=?,ship=CASE WHEN ?>0 THEN ? ELSE ship END,tot=sub-COALESCE(disc,0)+CASE WHEN ?>0 THEN ? ELSE ship END', cour, resi, shipFeeIn, shipFeeIn, shipFeeIn, shipFeeIn);
    }
    if (act == 'done' && ['dikirim', 'diproses'].includes(o.status)) { await addSold(env, o); return set('selesai', 'Pesanan selesai'); }
    if (act == 'paid' && !o.paid) { await env.DB.prepare('UPDATE orders SET paid=1,paid_t=?,hist=?,upd=? WHERE id=?').bind(now, push(o, who, 'Pembayaran diterima toko'), now, o.id).run(); return J({ ok: 1 }); }
    if (act == 'sale' && b.no) { await env.DB.prepare('UPDATE orders SET sale_no=? WHERE id=?').bind(String(b.no).slice(0, 40), o.id).run(); return J({ ok: 1 }); }
    return J({ e: 'Aksi tidak bisa dilakukan pada status ini' }, 400);
  }
  m = p.match(/^\/api\/shop\/buyer\/(\d+)$/);
  if (m && M == 'GET') {
    const bid = +m[1], by = await env.DB.prepare('SELECT id,name,phone,addr,lat,lng,created FROM buyers WHERE id=?').bind(bid).first();
    if (!by) return J({ e: 'Pembeli tidak ditemukan' }, 404);
    return J({ buyer: by, credit: await creditScore(env, bid), lim: await env.DB.prepare('SELECT lim,days FROM bcredit WHERE store_id=? AND buyer_id=?').bind(sid, bid).first(), owing: await owing(env, sid, bid) });
  }
  if (p == '/api/shop/chats' && M == 'GET') {
    const r = (await env.DB.prepare("SELECT c.room,MAX(c.seq) last,b.name FROM chat c JOIN buyers b ON b.id=CAST(substr(c.room,4,instr(substr(c.room,4),':')-1) AS INTEGER) WHERE c.room LIKE ? GROUP BY c.room ORDER BY last DESC LIMIT 100").bind('bs:%:' + sid).all()).results;
    return J({ rooms: r.map((x) => ({ buyer: +x.room.split(':')[1], name: x.name, last: x.last })) });
  }
  if (p == '/api/shop/chat') {
    const bid = +((M == 'POST' ? b.buyer : u.searchParams.get('buyer')) || 0), by = await env.DB.prepare('SELECT name FROM buyers WHERE id=?').bind(bid).first();
    if (!by) return J({ e: 'Pembeli tidak ditemukan' }, 404);
    const key = 'bs:' + bid + ':' + sid;
    if (M == 'POST') {
      const tx = String(b.text || '').trim().slice(0, 500); if (!tx) return J({ e: 'Pesan kosong' }, 400);
      const sn = (await env.DB.prepare('SELECT name FROM stores WHERE id=?').bind(sid).first()).name;
      await env.DB.prepare('INSERT INTO chat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind(key, sid, sn, uname, tx, now).run(); return J({ ok: 1 });
    }
    const since = +u.searchParams.get('since') || 0;
    return J({ m: (await env.DB.prepare('SELECT seq,sid,sn,un,tx,t FROM chat WHERE room=? AND seq>? ORDER BY seq LIMIT 200').bind(key, since).all()).results, buyer: { id: bid, name: by.name } });
  }
  return null;
}
