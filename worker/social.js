// J-POS Marketplace sosial (ala TikTok Shop): beranda, flash sale, voucher, feed konten toko, like, follow,
// favorit, ulasan & rating, statistik Seller Center, serta log aktivitas & pengunjung untuk Head Admin.
const DAY = 864e5;
export const SSCHEMA = [
  'CREATE TABLE IF NOT EXISTS views(t INTEGER,store_id TEXT,pid TEXT,bid INTEGER,kind TEXT)', 'CREATE INDEX IF NOT EXISTS views_s ON views(store_id,t)',
  'CREATE TABLE IF NOT EXISTS act(id INTEGER PRIMARY KEY AUTOINCREMENT,t INTEGER,typ TEXT,uid TEXT,name TEXT,sid TEXT,act TEXT,det TEXT)', 'CREATE INDEX IF NOT EXISTS act_t ON act(t)',
  'CREATE TABLE IF NOT EXISTS presence(k TEXT PRIMARY KEY,typ TEXT,name TEXT,sid TEXT,role TEXT,page TEXT,dev TEXT,t INTEGER)',
  'CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,store_id TEXT,pid TEXT,bid INTEGER,bn TEXT,stars INTEGER,txt TEXT,reply TEXT,t INTEGER,UNIQUE(order_id,pid))', 'CREATE INDEX IF NOT EXISTS rev_sp ON reviews(store_id,pid)',
  'CREATE TABLE IF NOT EXISTS follows(store_id TEXT,bid INTEGER,t INTEGER,PRIMARY KEY(store_id,bid))',
  'CREATE TABLE IF NOT EXISTS favs(bid INTEGER,store_id TEXT,pid TEXT,t INTEGER,PRIMARY KEY(bid,store_id,pid))',
  'CREATE TABLE IF NOT EXISTS vouchers(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT,code TEXT,typ TEXT,val INTEGER,min INTEGER,maxd INTEGER,quota INTEGER,used INTEGER DEFAULT 0,exp INTEGER,active INTEGER DEFAULT 1,UNIQUE(store_id,code))',
  'CREATE TABLE IF NOT EXISTS flash(store_id TEXT,pid TEXT,price INTEGER,end INTEGER,PRIMARY KEY(store_id,pid))',
  'CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT,img TEXT,txt TEXT,pid TEXT,likes INTEGER DEFAULT 0,t INTEGER)',
  'CREATE TABLE IF NOT EXISTS plikes(post_id INTEGER,bid INTEGER,PRIMARY KEY(post_id,bid))',
];
export const SALTER = ['catalog ADD COLUMN sold INTEGER DEFAULT 0', 'orders ADD COLUMN disc INTEGER DEFAULT 0', 'orders ADD COLUMN vcode TEXT', 'shop ADD COLUMN banner TEXT'];
export async function logAct(env, typ, uid, name, sid, act, det) {
  try {
    await env.DB.prepare('INSERT INTO act(t,typ,uid,name,sid,act,det) VALUES(?,?,?,?,?,?,?)').bind(Date.now(), typ, String(uid || ''), String(name || '').slice(0, 60), sid || null, String(act).slice(0, 60), det ? String(det).slice(0, 200) : null).run();
    if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM act WHERE t<?').bind(Date.now() - 60 * DAY).run();
  } catch (e) { }
}
// voucher toko: hitung potongan
export async function voucherDisc(env, sid, code, sub) {
  code = String(code || '').trim().toUpperCase(); if (!code) return { disc: 0 };
  const v = await env.DB.prepare('SELECT * FROM vouchers WHERE store_id=? AND code=? AND active=1').bind(sid, code).first();
  if (!v) return { e: 'Kode voucher tidak ditemukan' };
  if (v.exp && v.exp < Date.now()) return { e: 'Voucher sudah berakhir' };
  if (v.quota && v.used >= v.quota) return { e: 'Kuota voucher habis' };
  if (sub < (v.min || 0)) return { e: 'Minimal belanja Rp' + (v.min || 0).toLocaleString('id-ID') + ' untuk voucher ini' };
  let d = v.typ == 'pct' ? Math.round((sub * v.val) / 100) : v.val; if (v.maxd) d = Math.min(d, v.maxd);
  return { disc: Math.min(d, sub), code, v };
}
// harga produk efektif (flash sale aktif > harga online > harga toko)
export const PSEL = (now) => `c.store_id sid,s.name sn,c.pid,c.n,c.c,c.pr,c.opr,c.st,c.img,c.unit,COALESCE(c.sold,0) sold,sh.lat,sh.lng,
  CASE WHEN f.end>${+now} THEN f.price ELSE NULL END fsp, CASE WHEN f.end>${+now} THEN f.end ELSE NULL END fse,
  (SELECT ROUND(AVG(stars),1) FROM reviews r WHERE r.store_id=c.store_id AND r.pid=c.pid) rt,(SELECT COUNT(*) FROM reviews r WHERE r.store_id=c.store_id AND r.pid=c.pid) rc`;
export const PJOIN = 'FROM catalog c JOIN stores s ON s.id=c.store_id JOIN shop sh ON sh.store_id=c.store_id LEFT JOIN flash f ON f.store_id=c.store_id AND f.pid=c.pid';
export const pfix = (x, hav, lat, lng, hasLL) => { x.orig = x.opr || x.pr; x.price = x.fsp || x.orig; x.dist = hasLL && x.lat != null ? Math.round(hav(lat, lng, x.lat, x.lng)) : null; delete x.lat; delete x.lng; return x; };

// ---------- pembeli: publik (boleh tanpa login) ----------
export async function socialPublic(x, bid) {
  const { env, p, M, u, J, hav, lat, lng, hasLL, shopOpen } = x, now = Date.now(), lite = (r) => r.map((y) => pfix(y, hav, lat, lng, hasLL));
  if (p == '/api/b/home' && M == 'GET') {
    const W = `WHERE ${shopOpen} AND c.st>0`;
    const [fs, best, fresh, cats, posts] = await Promise.all([
      env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} ${W} AND f.end>? ORDER BY (c.opr+c.pr-f.price) DESC LIMIT 20`).bind(now, now).all(),
      env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} ${W} ORDER BY COALESCE(c.sold,0) DESC, c.upd DESC LIMIT 20`).bind(now).all(),
      env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} ${W} ORDER BY c.upd DESC LIMIT 40`).bind(now).all(),
      env.DB.prepare(`SELECT c.c,COUNT(*) n,MAX(c.img) img FROM catalog c JOIN stores s ON s.id=c.store_id JOIN shop sh ON sh.store_id=c.store_id ${W} GROUP BY c.c ORDER BY n DESC LIMIT 16`).bind(now).all(),
      env.DB.prepare(`SELECT po.id,po.store_id sid,s.name sn,po.img,po.txt,po.pid,po.likes,po.t FROM posts po JOIN stores s ON s.id=po.store_id JOIN shop sh ON sh.store_id=po.store_id WHERE ${shopOpen} AND po.img!='' ORDER BY po.id DESC LIMIT 6`).bind(now).all(),
    ]);
    return J({ flash: lite(fs.results), best: lite(best.results), fresh: lite(fresh.results), cats: cats.results, banners: posts.results });
  }
  if (p == '/api/b/product' && M == 'GET') {
    const sid = String(u.searchParams.get('s') || ''), pid = String(u.searchParams.get('p') || '');
    const it = await env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} WHERE c.store_id=? AND c.pid=?`).bind(sid, pid).first();
    if (!it) return J({ e: 'Produk tidak ditemukan' }, 404);
    pfix(it, hav, lat, lng, hasLL);
    const [rev, shop, fol, fav, more] = await Promise.all([
      env.DB.prepare('SELECT bn,stars,txt,reply,t FROM reviews WHERE store_id=? AND pid=? ORDER BY id DESC LIMIT 20').bind(sid, pid).all(),
      env.DB.prepare(`SELECT s.id,s.name,sh.addr,sh.cod,sh.credit,sh.ships,sh.minorder,(SELECT COUNT(*) FROM follows WHERE store_id=s.id) followers,(SELECT ROUND(AVG(stars),1) FROM reviews WHERE store_id=s.id) rt,(SELECT COUNT(*) FROM catalog WHERE store_id=s.id AND st>0) np FROM stores s JOIN shop sh ON sh.store_id=s.id WHERE s.id=?`).bind(sid).first(),
      bid ? env.DB.prepare('SELECT 1 x FROM follows WHERE store_id=? AND bid=?').bind(sid, bid).first() : null,
      bid ? env.DB.prepare('SELECT 1 x FROM favs WHERE bid=? AND store_id=? AND pid=?').bind(bid, sid, pid).first() : null,
      env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} WHERE ${shopOpen} AND c.store_id=? AND c.pid!=? AND c.st>0 ORDER BY COALESCE(c.sold,0) DESC LIMIT 10`).bind(now, sid, pid).all(),
    ]);
    await env.DB.prepare('INSERT INTO views(t,store_id,pid,bid,kind) VALUES(?,?,?,?,?)').bind(now, sid, pid, bid || null, 'p').run();
    if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM views WHERE t<?').bind(now - 90 * DAY).run();
    return J({ item: it, reviews: rev.results, shop, followed: !!fol, fav: !!fav, more: lite(more.results), vouchers: (await env.DB.prepare('SELECT code,typ,val,min,maxd,exp FROM vouchers WHERE store_id=? AND active=1 AND (exp IS NULL OR exp>?) AND (quota=0 OR used<quota) LIMIT 5').bind(sid, now).all()).results });
  }
  if (p == '/api/b/shop' && M == 'GET') {
    const sid = String(u.searchParams.get('s') || '');
    const shop = await env.DB.prepare(`SELECT s.id,s.name,sh.addr,sh.descr,sh.cod,sh.credit,sh.ships,sh.minorder,sh.lat,sh.lng,(SELECT COUNT(*) FROM follows WHERE store_id=s.id) followers,(SELECT ROUND(AVG(stars),1) FROM reviews WHERE store_id=s.id) rt,(SELECT COUNT(*) FROM reviews WHERE store_id=s.id) rc FROM stores s JOIN shop sh ON sh.store_id=s.id WHERE s.id=? AND ${shopOpen}`).bind(sid, now).first();
    if (!shop) return J({ e: 'Toko tidak ditemukan / sedang tutup' }, 404);
    shop.dist = hasLL && shop.lat != null ? Math.round(hav(lat, lng, shop.lat, shop.lng)) : null;
    const items = (await env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} WHERE c.store_id=? AND c.st>0 ORDER BY COALESCE(c.sold,0) DESC LIMIT 300`).bind(sid).all()).results;
    await env.DB.prepare('INSERT INTO views(t,store_id,pid,bid,kind) VALUES(?,?,?,?,?)').bind(now, sid, null, bid || null, 's').run();
    return J({ shop, items: lite(items), followed: bid ? !!(await env.DB.prepare('SELECT 1 x FROM follows WHERE store_id=? AND bid=?').bind(sid, bid).first()) : false, posts: (await env.DB.prepare('SELECT id,img,txt,pid,likes,t FROM posts WHERE store_id=? ORDER BY id DESC LIMIT 20').bind(sid).all()).results, vouchers: (await env.DB.prepare('SELECT code,typ,val,min,maxd,exp FROM vouchers WHERE store_id=? AND active=1 AND (exp IS NULL OR exp>?) AND (quota=0 OR used<quota)').bind(sid, now).all()).results });
  }
  if (p == '/api/b/feed' && M == 'GET') {
    const r = (await env.DB.prepare(`SELECT po.id,po.store_id sid,s.name sn,po.img,po.txt,po.pid,po.likes,po.t,c.n pn,COALESCE(CASE WHEN f.end>? THEN f.price END,c.opr,c.pr) price,c.st ${bid ? ',(SELECT 1 FROM plikes pl WHERE pl.post_id=po.id AND pl.bid=' + (+bid) + ') liked' : ''}
      FROM posts po JOIN stores s ON s.id=po.store_id JOIN shop sh ON sh.store_id=po.store_id LEFT JOIN catalog c ON c.store_id=po.store_id AND c.pid=po.pid LEFT JOIN flash f ON f.store_id=po.store_id AND f.pid=po.pid WHERE ${shopOpen} ORDER BY po.id DESC LIMIT 60`).bind(now, now).all()).results;
    return J({ posts: r });
  }
  return null;
}
// ---------- pembeli: perlu login ----------
export async function socialBuyer(x, bid, me) {
  const { env, p, M, b, J, hav, lat, lng, hasLL } = x, now = Date.now();
  if (p == '/api/b/follow' && M == 'POST') {
    const sid = String(b.store || ''), ex = await env.DB.prepare('SELECT 1 x FROM follows WHERE store_id=? AND bid=?').bind(sid, bid).first();
    if (ex) await env.DB.prepare('DELETE FROM follows WHERE store_id=? AND bid=?').bind(sid, bid).run(); else await env.DB.prepare('INSERT INTO follows(store_id,bid,t) VALUES(?,?,?)').bind(sid, bid, now).run();
    return J({ followed: !ex });
  }
  if (p == '/api/b/fav' && M == 'POST') {
    const sid = String(b.store || ''), pid = String(b.pid || ''), ex = await env.DB.prepare('SELECT 1 x FROM favs WHERE bid=? AND store_id=? AND pid=?').bind(bid, sid, pid).first();
    if (ex) await env.DB.prepare('DELETE FROM favs WHERE bid=? AND store_id=? AND pid=?').bind(bid, sid, pid).run(); else await env.DB.prepare('INSERT INTO favs(bid,store_id,pid,t) VALUES(?,?,?,?)').bind(bid, sid, pid, now).run();
    return J({ fav: !ex });
  }
  if (p == '/api/b/favs' && M == 'GET') {
    const items = (await env.DB.prepare(`SELECT ${PSEL(now)} ${PJOIN} JOIN favs fv ON fv.store_id=c.store_id AND fv.pid=c.pid WHERE fv.bid=? ORDER BY fv.t DESC LIMIT 100`).bind(bid).all()).results.map((y) => pfix(y, hav, lat, lng, hasLL));
    const stores = (await env.DB.prepare('SELECT s.id,s.name FROM follows fo JOIN stores s ON s.id=fo.store_id WHERE fo.bid=? ORDER BY fo.t DESC').bind(bid).all()).results;
    return J({ items, stores });
  }
  if (p == '/api/b/like' && M == 'POST') {
    const id = +b.post, ex = await env.DB.prepare('SELECT 1 x FROM plikes WHERE post_id=? AND bid=?').bind(id, bid).first();
    await env.DB.batch(ex ? [env.DB.prepare('DELETE FROM plikes WHERE post_id=? AND bid=?').bind(id, bid), env.DB.prepare('UPDATE posts SET likes=MAX(0,likes-1) WHERE id=?').bind(id)] : [env.DB.prepare('INSERT INTO plikes(post_id,bid) VALUES(?,?)').bind(id, bid), env.DB.prepare('UPDATE posts SET likes=likes+1 WHERE id=?').bind(id)]);
    return J({ liked: !ex });
  }
  if (p == '/api/b/voucher' && M == 'POST') { const r = await voucherDisc(env, String(b.store || ''), b.code, Math.round(+b.sub) || 0); return r.e ? J({ e: r.e }, 400) : J({ disc: r.disc, code: r.code }); }
  if (p == '/api/b/review' && M == 'POST') {
    const o = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND buyer_id=? AND status='selesai'").bind(+b.order, bid).first();
    if (!o) return J({ e: 'Ulasan hanya untuk pesanan yang sudah selesai' }, 400);
    const stars = Math.max(1, Math.min(5, Math.round(+b.stars) || 5)), txt = String(b.txt || '').trim().slice(0, 300);
    const st = JSON.parse(o.items).map((i) => env.DB.prepare('INSERT INTO reviews(order_id,store_id,pid,bid,bn,stars,txt,t) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(order_id,pid) DO UPDATE SET stars=excluded.stars,txt=excluded.txt,t=excluded.t').bind(o.id, o.store_id, i.pid, bid, me.name, stars, txt, now));
    await env.DB.batch(st); await logAct(env, 'buyer', bid, me.name, o.store_id, 'ulasan', stars + '★ pesanan #' + o.id);
    return J({ ok: 1 });
  }
  if (p == '/api/b/reviewed' && M == 'GET') return J({ ids: (await env.DB.prepare('SELECT DISTINCT order_id FROM reviews WHERE bid=?').bind(bid).all()).results.map((r) => r.order_id) });
  return null;
}
// ---------- Seller Center (toko) ----------
export async function socialShop(x) {
  const { env, p, M, b, u, J, sid, role } = x, now = Date.now(), boss = ['owner', 'admin'].includes(role);
  if (p == '/api/shop/stats' && M == 'GET') {
    const d7 = now - 7 * DAY, d30 = now - 30 * DAY;
    const [v, o, f, rt, topv, tops, daily] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) views,COUNT(DISTINCT bid) uniq,SUM(CASE WHEN kind='s' THEN 1 ELSE 0 END) sv FROM views WHERE store_id=? AND t>?").bind(sid, d7).first(),
      env.DB.prepare("SELECT COUNT(*) n,COUNT(DISTINCT buyer_id) buyers,SUM(CASE WHEN status='selesai' THEN sub-COALESCE(disc,0) ELSE 0 END) omz,SUM(CASE WHEN status IN('batal','ditolak') THEN 1 ELSE 0 END) x FROM orders WHERE store_id=? AND t>?").bind(sid, d30).first(),
      env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE store_id=?').bind(sid).first(),
      env.DB.prepare('SELECT ROUND(AVG(stars),1) rt,COUNT(*) rc FROM reviews WHERE store_id=?').bind(sid).first(),
      env.DB.prepare("SELECT v.pid,c.n,COUNT(*) cnt FROM views v JOIN catalog c ON c.store_id=v.store_id AND c.pid=v.pid WHERE v.store_id=? AND v.t>? AND v.kind='p' GROUP BY v.pid ORDER BY cnt DESC LIMIT 8").bind(sid, d30).all(),
      env.DB.prepare('SELECT pid,n,COALESCE(sold,0) sold FROM catalog WHERE store_id=? ORDER BY sold DESC LIMIT 8').bind(sid).all(),
      env.DB.prepare("SELECT strftime('%Y-%m-%d',(t/1000)+28800,'unixepoch') d,COUNT(*) v,COUNT(DISTINCT bid) u FROM views WHERE store_id=? AND t>? GROUP BY d ORDER BY d").bind(sid, now - 14 * DAY).all(),
    ]);
    const buyers7 = (await env.DB.prepare('SELECT COUNT(DISTINCT buyer_id) n FROM orders WHERE store_id=? AND t>?').bind(sid, d7).first()).n;
    return J({ views: v.views || 0, uniq: v.uniq || 0, shopViews: v.sv || 0, orders: o.n || 0, buyers: o.buyers || 0, omz: o.omz || 0, cancel: o.x || 0, followers: f.n, rt: rt.rt, rc: rt.rc, conv: v.uniq ? Math.round((buyers7 / v.uniq) * 1000) / 10 : 0, topViews: topv.results, topSold: tops.results, daily: daily.results });
  }
  if (p == '/api/shop/vouchers') {
    if (M == 'POST') {
      if (!boss) return J({ e: 'Khusus owner/admin' }, 403);
      const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15), typ = b.typ == 'pct' ? 'pct' : 'amt', val = Math.max(1, Math.round(+b.val) || 0);
      if (code.length < 3 || (typ == 'pct' && val > 90)) return J({ e: 'Kode min. 3 huruf/angka; diskon persen maks 90%' }, 400);
      try { await env.DB.prepare('INSERT INTO vouchers(store_id,code,typ,val,min,maxd,quota,exp,active) VALUES(?,?,?,?,?,?,?,?,1)').bind(sid, code, typ, val, Math.max(0, Math.round(+b.min) || 0), Math.max(0, Math.round(+b.maxd) || 0), Math.max(0, Math.round(+b.quota) || 0), +b.exp || null).run(); } catch { return J({ e: 'Kode voucher sudah ada' }, 409); }
    }
    if (M == 'DELETE' && boss) await env.DB.prepare('DELETE FROM vouchers WHERE store_id=? AND id=?').bind(sid, +u.searchParams.get('id')).run();
    return J({ vouchers: (await env.DB.prepare('SELECT * FROM vouchers WHERE store_id=? ORDER BY id DESC').bind(sid).all()).results });
  }
  if (p == '/api/shop/flash') {
    if (M == 'POST') {
      if (!boss) return J({ e: 'Khusus owner/admin' }, 403);
      const c = await env.DB.prepare('SELECT pr,opr FROM catalog WHERE store_id=? AND pid=?').bind(sid, String(b.pid || '')).first();
      if (!c) return J({ e: 'Produk belum tampil di pasar online' }, 400);
      const price = Math.round(+b.price) || 0, end = +b.end || 0;
      if (price <= 0 || price >= (c.opr || c.pr)) return J({ e: 'Harga flash sale harus di bawah harga normal ' + (c.opr || c.pr).toLocaleString('id-ID') }, 400);
      if (end <= now) return J({ e: 'Waktu berakhir harus di masa depan' }, 400);
      await env.DB.prepare('INSERT INTO flash(store_id,pid,price,end) VALUES(?,?,?,?) ON CONFLICT(store_id,pid) DO UPDATE SET price=excluded.price,end=excluded.end').bind(sid, String(b.pid), price, end).run();
    }
    if (M == 'DELETE' && boss) await env.DB.prepare('DELETE FROM flash WHERE store_id=? AND pid=?').bind(sid, String(u.searchParams.get('pid') || '')).run();
    return J({ flash: (await env.DB.prepare('SELECT f.*,c.n,c.pr,c.opr FROM flash f LEFT JOIN catalog c ON c.store_id=f.store_id AND c.pid=f.pid WHERE f.store_id=? ORDER BY f.end DESC').bind(sid).all()).results });
  }
  if (p == '/api/shop/posts') {
    if (M == 'POST') {
      if (!boss) return J({ e: 'Khusus owner/admin' }, 403);
      const img = String(b.img || ''), txt = String(b.txt || '').trim().slice(0, 500);
      if (!txt && !img) return J({ e: 'Isi foto atau teks' }, 400);
      if (img && (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || img.length > 400000)) return J({ e: 'Foto tidak valid / terlalu besar' }, 400);
      await env.DB.prepare('INSERT INTO posts(store_id,img,txt,pid,likes,t) VALUES(?,?,?,?,0,?)').bind(sid, img, txt, String(b.pid || '') || null, now).run();
    }
    if (M == 'DELETE' && boss) await env.DB.prepare('DELETE FROM posts WHERE store_id=? AND id=?').bind(sid, +u.searchParams.get('id')).run();
    return J({ posts: (await env.DB.prepare('SELECT id,img,txt,pid,likes,t FROM posts WHERE store_id=? ORDER BY id DESC LIMIT 50').bind(sid).all()).results });
  }
  if (p == '/api/shop/reviews') {
    if (M == 'POST' && boss) await env.DB.prepare('UPDATE reviews SET reply=? WHERE store_id=? AND id=?').bind(String(b.reply || '').slice(0, 300), sid, +b.id).run();
    return J({ reviews: (await env.DB.prepare('SELECT r.id,r.pid,c.n,r.bn,r.stars,r.txt,r.reply,r.t FROM reviews r LEFT JOIN catalog c ON c.store_id=r.store_id AND c.pid=r.pid WHERE r.store_id=? ORDER BY r.id DESC LIMIT 100').bind(sid).all()).results });
  }
  return null;
}
// ---------- kehadiran (online) & aktivitas untuk Head Admin ----------
export async function heartbeat(env, who, page, dev) {
  await env.DB.prepare('INSERT INTO presence(k,typ,name,sid,role,page,dev,t) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(k) DO UPDATE SET name=excluded.name,role=excluded.role,page=excluded.page,dev=excluded.dev,t=excluded.t')
    .bind(who.k, who.typ, who.name, who.sid || null, who.role || null, String(page || '').slice(0, 30), String(dev || '').slice(0, 60), Date.now()).run();
}
export async function adminActivity(env, u) {
  const now = Date.now(), typ = u.searchParams.get('typ') || '', q = String(u.searchParams.get('q') || '').trim(), d0 = now - DAY;
  let sql = 'SELECT a.*,s.name sn FROM act a LEFT JOIN stores s ON s.id=a.sid WHERE 1=1'; const a = [];
  if (typ) { sql += ' AND a.typ=?'; a.push(typ); }
  if (q) { sql += ' AND (a.name LIKE ? OR a.act LIKE ? OR a.det LIKE ? OR s.name LIKE ?)'; a.push(...Array(4).fill('%' + q + '%')); }
  const [log, online, today, hourly] = await Promise.all([
    env.DB.prepare(sql + ' ORDER BY a.id DESC LIMIT 300').bind(...a).all(),
    env.DB.prepare('SELECT p.*,s.name sn FROM presence p LEFT JOIN stores s ON s.id=p.sid WHERE p.t>? ORDER BY p.t DESC LIMIT 300').bind(now - 5 * 6e4).all(),
    env.DB.prepare("SELECT typ,role,COUNT(DISTINCT k) n FROM presence WHERE t>? GROUP BY typ,role").bind(d0).all(),
    env.DB.prepare("SELECT strftime('%H',(t/1000)+28800,'unixepoch') h,COUNT(*) n FROM act WHERE t>? GROUP BY h ORDER BY h").bind(d0).all(),
  ]);
  return { log: log.results, online: online.results, today: today.results, hourly: hourly.results };
}
