// ============ JARINGAN MITRA DISTRIBUTOR ============
// Toko (kios / grosir) yang SETUJU berbagi data dengan distributor tertentu. Pemilik toko memilih apa yang dibagi:
// stok, SKU fast moving (jumlah terjual), harga jual, harga beli (HPP). Tanpa persetujuan, data toko tidak pernah terlihat.
export const MSCH2 = [
  "CREATE TABLE IF NOT EXISTS dlink(dist_id TEXT NOT NULL,store_id TEXT NOT NULL,status TEXT NOT NULL,scope TEXT,by TEXT,t INTEGER,PRIMARY KEY(dist_id,store_id))",
  'CREATE INDEX IF NOT EXISTS dlink_s ON dlink(store_id)',
  'CREATE TABLE IF NOT EXISTS dsnap(store_id TEXT PRIMARY KEY,t INTEGER,data TEXT)',
];
const SC = (o) => ({ st: o && o.st ? 1 : 0, fm: o && o.fm ? 1 : 0, pj: o && o.pj ? 1 : 0, pb: o && o.pb ? 1 : 0 });
const pj = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };

export async function mitraRoutes(x) {
  const { env, p, M, b, J, sid, uname, role, feats, limited } = x;
  const now = Date.now();
  // ---- sisi TOKO: permintaan masuk, persetujuan & cabut ----
  if (p == '/api/mitra') {
    if (M == 'POST') {
      if (role != 'owner') return J({ e: 'Hanya pemilik toko yang bisa mengatur berbagi data' }, 403);
      const dist = String(b.dist || '').trim().toLowerCase();
      if (!/^[a-z0-9]{6,20}$/.test(dist) || dist == sid) return J({ e: 'Kode distributor tidak valid' }, 400);
      const d = await env.DB.prepare('SELECT id,name,tier FROM stores WHERE id=?').bind(dist).first();
      if (!d) return J({ e: 'Kode distributor tidak ditemukan' }, 404);
      if (b.op == 'off') await env.DB.prepare("UPDATE dlink SET status='off',t=? WHERE dist_id=? AND store_id=?").bind(now, dist, sid).run();
      else await env.DB.prepare("INSERT INTO dlink(dist_id,store_id,status,scope,by,t) VALUES(?,?,'ok',?,?,?) ON CONFLICT(dist_id,store_id) DO UPDATE SET status='ok',scope=excluded.scope,by=excluded.by,t=excluded.t").bind(dist, sid, JSON.stringify(SC(b.scope)), uname, now).run();
    }
    const r = (await env.DB.prepare('SELECT l.dist_id,l.status,l.scope,l.t,s.name FROM dlink l JOIN stores s ON s.id=l.dist_id WHERE l.store_id=? ORDER BY l.t DESC').bind(sid).all()).results;
    return J({ links: r.map((y) => ({ ...y, scope: pj(y.scope) })) });
  }
  if (p == '/api/dsnap' && M == 'POST') { // HP toko mengirim data SKU bila punya mitra aktif
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM dlink WHERE store_id=? AND status='ok'").bind(sid).first();
    if (!n || !n.n) return J({ ok: 0, none: 1 });
    const d = JSON.stringify(b.d || {}); if (d.length > 400000) return J({ e: 'terlalu besar' }, 400);
    await env.DB.prepare('INSERT INTO dsnap(store_id,t,data) VALUES(?,?,?) ON CONFLICT(store_id) DO UPDATE SET t=excluded.t,data=excluded.data').bind(sid, now, d).run();
    return J({ ok: 1 });
  }
  // ---- sisi DISTRIBUTOR ----
  if (!p.startsWith('/api/dnet')) return null;
  if (!feats.includes('dnet')) return J({ e: 'Jaringan mitra butuh paket High · Distributor dan hak akses Jaringan Mitra' }, 403);
  if (p == '/api/dnet/req' && M == 'POST') { // ajak toko jadi mitra (toko harus menyetujui)
    if (await limited(env, 'dreq:' + sid, 60, 864e5)) return J({ e: 'Terlalu banyak ajakan hari ini' }, 429);
    const st = String(b.store || '').trim().toLowerCase(); if (!/^[a-z0-9]{6,20}$/.test(st) || st == sid) return J({ e: 'Kode toko tidak valid' }, 400);
    const s = await env.DB.prepare('SELECT id,name FROM stores WHERE id=?').bind(st).first(); if (!s) return J({ e: 'Kode toko tidak ditemukan' }, 404);
    const ex = await env.DB.prepare('SELECT status FROM dlink WHERE dist_id=? AND store_id=?').bind(sid, st).first();
    if (ex && ex.status == 'ok') return J({ ok: 1, already: 1, name: s.name });
    await env.DB.prepare("INSERT INTO dlink(dist_id,store_id,status,scope,by,t) VALUES(?,?,'req',?,?,?) ON CONFLICT(dist_id,store_id) DO UPDATE SET status='req',by=excluded.by,t=excluded.t").bind(sid, st, JSON.stringify(SC({ st: 1, fm: 1, pj: 1 })), uname, now).run();
    return J({ ok: 1, name: s.name });
  }
  if (p == '/api/dnet' && M == 'GET') {
    const r = (await env.DB.prepare('SELECT l.store_id,l.status,l.scope,l.t,s.name,s.tier,sh.lat,sh.lng,sh.addr,d.t snapt,length(d.data) sz FROM dlink l JOIN stores s ON s.id=l.store_id LEFT JOIN shop sh ON sh.store_id=l.store_id LEFT JOIN dsnap d ON d.store_id=l.store_id WHERE l.dist_id=? ORDER BY l.status,s.name').bind(sid).all()).results;
    return J({ stores: r.map((y) => ({ ...y, scope: pj(y.scope) })) });
  }
  const m = p.match(/^\/api\/dnet\/([a-z0-9]{6,20})$/);
  if (m && M == 'GET') {
    const l = await env.DB.prepare("SELECT scope FROM dlink WHERE dist_id=? AND store_id=? AND status='ok'").bind(sid, m[1]).first();
    if (!l) return J({ e: 'Toko ini belum menyetujui berbagi data' }, 403);
    const sc = pj(l.scope), d = await env.DB.prepare('SELECT t,data FROM dsnap WHERE store_id=?').bind(m[1]).first(), D = d ? pj(d.data) : {};
    const items = (D.items || []).map((i) => ({ n: i.n, sku: i.sku, kd: i.kd, c: i.c, b: i.b, u: i.u, ...(sc.st ? { st: i.st } : {}), ...(sc.fm ? { q7: i.q7, q30: i.q30 } : {}), ...(sc.pj ? { pr: i.pr } : {}), ...(sc.pb ? { co: i.co } : {}) }));
    return J({ t: d ? d.t : 0, scope: sc, items });
  }
  return null;
}
