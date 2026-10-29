import { MSCHEMA, buyerRoutes, shopRoutes, shipCfg } from './market.js';
import { SSCHEMA, SALTER, logAct, heartbeat, adminActivity } from './social.js';
// J-POS API v4 — Cloudflare Worker + D1 (SQLite)
// Multi-tenant: 1 toko = 1 tenant. Data bisnis = LOG KEJADIAN (tabel ev) yang diputar ulang tiap perangkat (offline-first).
// v4: peran owner/admin/akuntan/kasir/sales, masa aktif toko (trial 30 hari + perpanjangan oleh Head Admin),
//     kredensial Head Admin dari hash (tanpa secret wajib), kunci token dibuat otomatis di D1.
const E = new TextEncoder(), D = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', E.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, E.encode(data)));
}
const same = async (a, c) => (await hmac('cmp', String(a))) === (await hmac('cmp', String(c))); // banding waktu-konstan
async function pbkdf2(pass, salt, it) {
  const k = await crypto.subtle.importKey('raw', E.encode(pass), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: E.encode(salt), iterations: it }, k, 256));
}
const hp = (pin, sid, name) => pbkdf2(String(pin), sid + ':' + name.toLowerCase(), 20000);
const PIN = /^\d{4,8}$/, SID = /^[a-z0-9]{6,20}$/, NO = /^[A-Za-z0-9_-]{3,40}$/, NAME = /^[\p{L}\p{N} ._-]{2,40}$/u;
const ROLES = ['owner', 'admin', 'akuntan', 'kasir', 'sales', 'dropping'];
const KINDS = new Set(['sale', 'pay', 'retur', 'stk', 'apay', 'opn', 'exp', 'cap', 'jm', 'pu', 'cu', 'set', 'in', 'out', 'visit', 'loc', 'vout', 'sup', 'po', 'rcv', 'dlv', 'kas', 'sec']);
// ---- Hak akses: tiap kejadian butuh salah satu FITUR; fitur ditentukan paket toko (Head Admin) & matrix peran (Owner) ----
const ALWAYS = 'dash set';
const DEFPERM = {
  admin: 'dash pos his hisAll prod prodEdit outlet onl ana lap keu jur abs absAll chat usr retur backup set beli xls kas',
  akuntan: 'dash his hisAll prod ana lap keu jur abs absAll chat set kas xls',
  kasir: 'dash pos his abs chat set',
  sales: 'dash pos his outlet ana abs chat set cek',
  dropping: 'dash kirim cek terima abs chat set',
};
const PKG0 = {
  // BIASA: toko eceran kecil — kasir, stok dasar, absen, chat
  biasa: { n: 'Biasa', max: 3, f: 'dash pos his prod prodEdit outlet abs chat set usr' },
  // STANDAR: + laporan, keuangan, buku kas, pembelian, Excel, toko online, backup, retur, hak akses
  standar: { n: 'Standar', max: 10, f: 'dash pos his hisAll prod prodEdit outlet abs absAll chat set usr retur lap keu kas beli xls onl backup perm' },
  // HIGH: + analisa, jurnal akuntansi, pengantaran/dropping, check-in outlet, anti-curang, audit
  high: { n: 'High', max: 100, f: 'dash pos his hisAll prod prodEdit outlet abs absAll chat set usr retur lap keu kas beli xls onl backup perm ana jur kirim cek terima anti aud' },
};
const ALLF = [...new Set(Object.values(PKG0).flatMap((x) => x.f.split(' ')).concat('terima'))];
const KNEED = { sale: ['pos'], pay: ['pos', 'keu', 'terima'], retur: ['retur'], stk: ['prodEdit', 'beli'], apay: ['keu', 'beli'], opn: ['prodEdit', 'keu'], exp: ['jur', 'keu'], jm: ['jur'], pu: ['prodEdit'], cu: ['outlet'], visit: ['outlet', 'cek'], vout: ['cek'], sup: ['beli'], po: ['beli'], rcv: ['beli'], dlv: ['kirim'], kas: ['kas'], sec: null, in: null, out: null, loc: null, cap: 'owner', set: 'owner' };
const pkgAll = () => { let o = null; try { o = CFG && CFG.pkg_feat ? JSON.parse(CFG.pkg_feat) : null; } catch (e) { } const r = {}; for (const t of Object.keys(PKG0)) r[t] = { ...PKG0[t], ...((o && o[t]) || {}) }; return r; };
const pkgOf = (tier) => { const a = pkgAll(); return a[tier] || a.high; };
const permObj = (s) => { try { const o = s.perm ? JSON.parse(s.perm) : null; return o && typeof o == 'object' ? o : {}; } catch (e) { return {}; } };
function featsOf(s, role) {
  const pf = new Set((pkgOf(s.tier).f + ' ' + ALWAYS).split(' ').filter(Boolean));
  if (role == 'owner') return [...pf];
  const ov = permObj(s), rf = (typeof ov[role] == 'string' ? ov[role] : DEFPERM[role] || '').split(' ').filter(Boolean);
  return rf.filter((f) => pf.has(f));
}
function kindOk(feats, role, k) { const n = KNEED[k]; if (n === undefined) return false; if (n === null) return true; if (n == 'owner') return role == 'owner'; return n.some((f) => feats.includes(f)); }
const DAY = 864e5;

// Tabel dibuat otomatis saat server pertama kali dipakai (tidak perlu menjalankan schema.sql manual).
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS stores(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner TEXT,email TEXT UNIQUE,phone TEXT,status TEXT DEFAULT 'active',created INTEGER,exp INTEGER,plan TEXT DEFAULT 'trial',note TEXT)",
  'CREATE TABLE IF NOT EXISTS staff(store_id TEXT NOT NULL,name TEXT COLLATE NOCASE,role TEXT NOT NULL,pin_hash TEXT NOT NULL,created INTEGER,PRIMARY KEY(store_id,name))',
  'CREATE TABLE IF NOT EXISTS ev(seq INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT NOT NULL,no TEXT NOT NULL,k TEXT NOT NULL,t INTEGER,tot INTEGER DEFAULT 0,data TEXT NOT NULL,UNIQUE(store_id,no))',
  'CREATE INDEX IF NOT EXISTS ev_store ON ev(store_id,seq)', 'CREATE INDEX IF NOT EXISTS ev_time ON ev(t)',
  'CREATE TABLE IF NOT EXISTS chat(seq INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,sid TEXT,sn TEXT,un TEXT,tx TEXT NOT NULL,t INTEGER)', 'CREATE INDEX IF NOT EXISTS chat_room ON chat(room,seq)',
  'CREATE TABLE IF NOT EXISTS rl(k TEXT NOT NULL,t INTEGER NOT NULL)', 'CREATE INDEX IF NOT EXISTS rl_k ON rl(k,t)',
  'CREATE TABLE IF NOT EXISTS cfg(k TEXT PRIMARY KEY,v TEXT)',
];
let READY = null;
function ready(env) {
  if (!READY) READY = (async () => {
    await env.DB.batch([...SCHEMA, ...MSCHEMA, ...SSCHEMA].map((q) => env.DB.prepare(q)));
    for (const c of SALTER) { try { await env.DB.prepare('ALTER TABLE ' + c).run(); } catch (e) { } }
    for (const c of ['phone TEXT', 'exp INTEGER', "plan TEXT DEFAULT 'trial'", 'note TEXT', "tier TEXT DEFAULT 'high'", 'perm TEXT']) { try { await env.DB.prepare('ALTER TABLE stores ADD COLUMN ' + c).run(); } catch (e) { } }
  })().catch((e) => { READY = null; throw e; });
  return READY;
}

let CFG = null, CFGT = 0;
async function cfgAll(env) {
  if (CFG && Date.now() - CFGT < 15000) return CFG;
  const r = await env.DB.prepare('SELECT k,v FROM cfg').all(); CFG = {}; for (const x of r.results) CFG[x.k] = x.v; CFGT = Date.now(); return CFG;
}
async function cfgSet(env, k, v) { await env.DB.prepare('INSERT INTO cfg(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, String(v)).run(); CFG = null; }
async function secret(env) {
  if (env.SECRET) return env.SECRET;
  const c = await cfgAll(env); if (c.secret) return c.secret;
  const s = b64(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT OR IGNORE INTO cfg(k,v) VALUES(?,?)').bind('secret', s).run(); CFG = null;
  return (await cfgAll(env)).secret;
}
async function sign(env, payload) { const b = b64(E.encode(JSON.stringify(payload))); return b + '.' + (await hmac(await secret(env), b)); }
async function verify(env, token) {
  const [b, s] = String(token || '').split('.');
  if (!b || !s || s !== (await hmac(await secret(env), b))) return null;
  try { const p = JSON.parse(D.decode(ub64(b))); return p.exp > Date.now() ? p : null; } catch { return null; }
}
async function adminOk(env, user, pass) {
  const c = await cfgAll(env), U = c.admin_user || env.ADMIN_USER || 'headadmin', H = c.admin_hash || env.ADMIN_PASS_HASH;
  if (!(await same(String(user || '').toLowerCase(), U.toLowerCase()))) return false;
  if (H) { const [, it, salt, h] = H.split('$'); return same(await pbkdf2(String(pass || ''), salt, +it), h); }
  return !!env.ADMIN_PASS && same(pass || '', env.ADMIN_PASS);
}
async function limited(env, key, max, win) {
  const now = Date.now();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rl WHERE t<?').bind(now - 36e5).run();
  const r = await env.DB.prepare('SELECT COUNT(*) c FROM rl WHERE k=? AND t>?').bind(key, now - win).first();
  if (r.c >= max) return true;
  await env.DB.prepare('INSERT INTO rl(k,t) VALUES(?,?)').bind(key, now).run();
  return false;
}
const expired = (s) => !!s.exp && s.exp < Date.now();
const stInfo = (s) => { const pk = pkgOf(s.tier); return { exp: s.exp || 0, plan: s.plan || 'trial', status: s.status, sn: s.sn || s.name, tier: s.tier || 'high', tn: pk.n, pf: pk.f + ' ' + ALWAYS, lim: pk.max, pm: permObj(s) }; };

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname, M = req.method, ip = req.headers.get('CF-Connecting-IP') || 'x';
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    const cors = { 'Access-Control-Allow-Origin': env.ORIGIN || '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (M == 'OPTIONS') return new Response(null, { headers: cors });
    let b = {};
    if (M == 'POST' || M == 'PUT' || M == 'PATCH') { try { b = await req.json(); } catch { } }
    const bearer = (req.headers.get('Authorization') || '').slice(7);
    try {
      if (!env.DB) return J({ e: 'Database D1 belum terhubung ke Worker (binding DB)' }, 500);
      await ready(env); await cfgAll(env);
      // ---------- publik ----------
      if (p == '/api/ping') return J({ ok: 1, v: 5 });
      if (p == '/api/time') return J({ t: Date.now() });
      if (p == '/api/info') { const c = await cfgAll(env); const pk = pkgAll(), pkg = {}; for (const t of Object.keys(pk)) pkg[t] = { n: pk[t].n, max: pk[t].max, f: pk[t].f }; return J({ wa: c.wa || '', price: c.price || '', trial: +(c.trial_days || 30), app: c.app_name || 'J-POS', pkg }); }
      if (p == '/api/register' && M == 'POST') {
        if (await limited(env, 'reg:' + ip, 5, 36e5)) return J({ e: 'Terlalu banyak pendaftaran, coba lagi nanti' }, 429);
        const id = String(b.id || ''), store = String(b.store || '').trim().slice(0, 60), owner = String(b.owner || '').trim();
        const email = String(b.email || '').trim().toLowerCase(), pin = String(b.pin || ''), phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
        if (!SID.test(id) || !store || !NAME.test(owner) || (email && !/^\S+@\S+\.\S+$/.test(email)) || !PIN.test(pin)) return J({ e: 'Data tidak valid (nama pemilik, email, atau PIN 4-8 angka)' }, 400);
        const c = await cfgAll(env), now = Date.now(), exp = now + (+(c.trial_days || 30)) * DAY, tier = ['biasa', 'standar', 'high'].includes(b.tier) ? b.tier : c.trial_tier || 'high';
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT INTO stores(id,name,owner,email,phone,created,exp,plan,tier) VALUES(?,?,?,?,?,?,?,'trial',?)").bind(id, store, owner, email || null, phone, now, exp, tier),
            env.DB.prepare('INSERT INTO staff(store_id,name,role,pin_hash,created) VALUES(?,?,?,?,?)').bind(id, owner, 'owner', await hp(pin, id, owner), now),
          ]);
        } catch { return J({ e: 'Email atau kode toko sudah terdaftar' }, 409); }
        await logAct(env, 'staff', owner, owner, id, 'daftar toko baru', store);
        return J({ token: await sign(env, { sid: id, name: owner, exp: now + 30 * DAY }), role: 'owner', name: owner, sn: store, exp, plan: 'trial', status: 'active', ...stInfo({ exp, plan: 'trial', status: 'active', name: store, tier }) });
      }
      if (p == '/api/login' && M == 'POST') {
        const id = String(b.id || '').toLowerCase(), name = String(b.name || '').trim();
        if ((await limited(env, 'login:' + ip, 40, 6e5)) || (await limited(env, 'login:' + id + ':' + name.toLowerCase(), 8, 6e5))) return J({ e: 'Terlalu banyak percobaan, coba lagi 10 menit' }, 429);
        const r = await env.DB.prepare('SELECT st.name,st.role,st.pin_hash,s.status,s.name sn,s.exp,s.plan,s.tier,s.perm FROM staff st JOIN stores s ON s.id=st.store_id WHERE st.store_id=? AND st.name=?').bind(id, name).first();
        if (!r || !(await same(r.pin_hash, await hp(b.pin || '', id, r.name)))) return J({ e: 'Kode toko, nama, atau PIN salah' }, 401);
        if (r.status != 'active') return J({ e: 'Toko disuspend oleh pemilik aplikasi' }, 403);
        await logAct(env, 'staff', r.name, r.name, id, 'login ' + r.role, null);
        return J({ token: await sign(env, { sid: id, name: r.name, exp: Date.now() + 30 * DAY }), role: r.role, name: r.name, ...stInfo(r) });
      }

      // ---------- kehadiran (siapa sedang online) ----------
      if (p == '/api/hb' && M == 'POST') {
        const tk = await verify(env, bearer); if (!tk) return J({ ok: 0 });
        let who;
        if (tk.role == 'buyer') { const r = await env.DB.prepare('SELECT name FROM buyers WHERE id=?').bind(tk.bid).first(); if (!r) return J({ ok: 0 }); who = { k: 'b' + tk.bid, typ: 'buyer', name: r.name, role: 'pembeli' }; }
        else if (tk.role == 'super') who = { k: 'hq', typ: 'admin', name: 'Head Admin', role: 'head admin' };
        else if (tk.sid) { const r = await env.DB.prepare('SELECT role FROM staff WHERE store_id=? AND name=?').bind(tk.sid, tk.name).first(); if (!r) return J({ ok: 0 }); who = { k: 's:' + tk.sid + ':' + tk.name.toLowerCase(), typ: 'staff', name: tk.name, sid: tk.sid, role: r.role }; }
        else return J({ ok: 0 });
        await heartbeat(env, who, b.page, (req.headers.get('User-Agent') || '').replace(/^.*\((.*?)\).*$/, '$1'));
        return J({ ok: 1 });
      }

      // ---------- pasar online: pembeli ----------
      if (p.startsWith('/api/b/')) return await buyerRoutes({ env, p, M, b, u, J, ip, bearer, limited, cfgAll, same, sign: (o) => sign(env, o), verify: (tk) => verify(env, tk), pbk: (pin, salt) => pbkdf2(pin, salt, 20000) });

      // ---------- Head Admin (pemilik aplikasi) ----------
      if (p == '/api/admin/login' && M == 'POST') {
        if (await limited(env, 'adm:' + ip, 8, 9e5)) return J({ e: 'Terlalu banyak percobaan, coba lagi 15 menit' }, 429);
        if (!(await adminOk(env, b.user, b.pass))) return J({ e: 'Username atau password salah' }, 401);
        await logAct(env, 'admin', 'hq', 'Head Admin', null, 'login head admin', ip);
        return J({ token: await sign(env, { role: 'super', exp: Date.now() + 12 * 36e5 }) });
      }
      if (p.startsWith('/api/admin/')) {
        const a = await verify(env, bearer);
        if (!a || a.role != 'super') return J({ e: 'Unauthorized' }, 401);
        if (p == '/api/admin/activity' && M == 'GET') return J(await adminActivity(env, u));
        if (p == '/api/admin/stores' && M == 'GET') {
          const r = await env.DB.prepare(`SELECT s.id,s.name,s.owner,s.email,s.phone,s.status,s.created,s.exp,s.plan,s.tier,s.note,
              (SELECT COUNT(*) FROM staff WHERE store_id=s.id) users, COALESCE(e.n,0) tx, COALESCE(e.o,0) omzet, e.last
            FROM stores s LEFT JOIN (SELECT store_id,SUM(CASE WHEN k='sale' THEN 1 ELSE 0 END) n,SUM(tot) o,MAX(t) last FROM ev GROUP BY store_id) e ON e.store_id=s.id
            ORDER BY s.created DESC LIMIT 2000`).all();
          return J({ stores: r.results, now: Date.now() });
        }
        if (p == '/api/admin/stats' && M == 'GET') {
          const tz = (+u.searchParams.get('tz') || 0) * 60, now = Date.now(), since = now - 14 * DAY, m30 = now - 30 * DAY;
          const [tt, dd, ns, top] = await Promise.all([
            env.DB.prepare(`SELECT (SELECT COUNT(*) FROM stores) stores,(SELECT COUNT(*) FROM stores WHERE status='active') active,(SELECT COUNT(*) FROM staff) users,
              (SELECT COUNT(*) FROM stores WHERE exp<?1) expired,(SELECT COUNT(*) FROM stores WHERE exp>=?1 AND exp<?2) soon,(SELECT COUNT(*) FROM stores WHERE plan='trial' AND exp>=?1) trial,
              (SELECT COUNT(*) FROM stores WHERE plan!='trial' AND exp>=?1) paid,
              COALESCE((SELECT SUM(tot) FROM ev),0) omzet,(SELECT COUNT(*) FROM ev WHERE k='sale') tx,
              (SELECT COUNT(*) FROM buyers) buyers,(SELECT COUNT(*) FROM orders) orders,COALESCE((SELECT SUM(tot) FROM orders WHERE status='selesai'),0) gmv,(SELECT COUNT(*) FROM shop WHERE open=1) shops`).bind(now, now + 7 * DAY).first(),
            env.DB.prepare(`SELECT strftime('%Y-%m-%d',(t/1000)+?,'unixepoch') d,SUM(tot) v FROM ev WHERE k IN('sale','retur') AND t>? GROUP BY d ORDER BY d`).bind(tz, since).all(),
            env.DB.prepare(`SELECT strftime('%Y-%m-%d',(created/1000)+?,'unixepoch') d,COUNT(*) v FROM stores WHERE created>? GROUP BY d ORDER BY d`).bind(tz, since).all(),
            env.DB.prepare(`SELECT s.name,SUM(e.tot) v FROM ev e JOIN stores s ON s.id=e.store_id WHERE e.t>? GROUP BY e.store_id ORDER BY v DESC LIMIT 5`).bind(m30).all(),
          ]);
          return J({ totals: tt, daily: dd.results, signups: ns.results, top: top.results });
        }
        if (p == '/api/admin/cfg') {
          if (M == 'PUT') {
            if (b.wa != null) await cfgSet(env, 'wa', String(b.wa).replace(/[^\d]/g, '').slice(0, 20));
            if (b.price != null) await cfgSet(env, 'price', String(b.price).slice(0, 300));
            if (b.trial_days != null) await cfgSet(env, 'trial_days', Math.max(1, Math.min(365, Math.round(+b.trial_days) || 30)));
            if (b.pkg_reset) await cfgSet(env, 'pkg_feat', '');
            if (b.pkg && typeof b.pkg == 'object') { const cur = pkgAll(), o = {}; for (const t of Object.keys(PKG0)) { const x = b.pkg[t] || {}; o[t] = { n: String(x.n || cur[t].n).slice(0, 20), max: Math.max(1, Math.min(9999, Math.round(+x.max) || cur[t].max)), f: String(x.f != null ? x.f : cur[t].f).split(' ').filter((f) => ALLF.includes(f)).join(' ') }; } await cfgSet(env, 'pkg_feat', JSON.stringify(o)); }
            if (['biasa', 'standar', 'high'].includes(b.trial_tier)) await cfgSet(env, 'trial_tier', b.trial_tier);
            for (const k of ['ship_base', 'ship_per_m', 'ship_road', 'ship_min', 'ship_max_km', 'ship_round']) if (b[k] != null && Number.isFinite(+b[k]) && +b[k] >= 0) await cfgSet(env, k, +b[k]);
          }
          const c = await cfgAll(env); return J({ wa: c.wa || '', price: c.price || '', trial_days: +(c.trial_days || 30), user: c.admin_user || env.ADMIN_USER || 'headadmin', ship: shipCfg(c), pkg: pkgAll(), allf: ALLF, trial_tier: c.trial_tier || 'high' });
        }
        if (p == '/api/admin/password' && M == 'POST') {
          const c = await cfgAll(env);
          if (!(await adminOk(env, c.admin_user || env.ADMIN_USER || 'headadmin', b.old))) return J({ e: 'Password lama salah' }, 400);
          const nu = String(b.user || '').trim().toLowerCase(), np = String(b.pass || '');
          if (nu && !/^[a-z0-9._-]{3,30}$/.test(nu)) return J({ e: 'Username 3-30 huruf kecil/angka' }, 400);
          if (np.length < 10) return J({ e: 'Password baru minimal 10 karakter' }, 400);
          const salt = b64(crypto.getRandomValues(new Uint8Array(12)));
          await cfgSet(env, 'admin_hash', `pbkdf2$100000$${salt}$${await pbkdf2(np, salt, 100000)}`);
          if (nu) await cfgSet(env, 'admin_user', nu);
          return J({ ok: 1 });
        }
        let m = p.match(/^\/api\/admin\/stores\/([a-z0-9]+)(?:\/(staff|resetpin))?$/);
        if (m) {
          const id = m[1];
          if (!m[2] && M == 'PATCH') {
            const s = await env.DB.prepare('SELECT exp FROM stores WHERE id=?').bind(id).first();
            if (!s) return J({ e: 'Toko tidak ditemukan' }, 404);
            const st = [];
            if (['active', 'suspended'].includes(b.status)) st.push(env.DB.prepare('UPDATE stores SET status=? WHERE id=?').bind(b.status, id));
            if (b.add_days != null) { const d = Math.round(+b.add_days) || 0; st.push(env.DB.prepare('UPDATE stores SET exp=? WHERE id=?').bind(Math.max(Date.now(), s.exp || 0) + d * DAY, id)); }
            else if (b.exp != null && Number.isFinite(+b.exp)) st.push(env.DB.prepare('UPDATE stores SET exp=? WHERE id=?').bind(Math.round(+b.exp), id));
            if (b.plan != null) st.push(env.DB.prepare('UPDATE stores SET plan=? WHERE id=?').bind(String(b.plan).slice(0, 30) || 'trial', id));
            if (['biasa', 'standar', 'high'].includes(b.tier)) st.push(env.DB.prepare('UPDATE stores SET tier=? WHERE id=?').bind(b.tier, id));
            if (b.note != null) st.push(env.DB.prepare('UPDATE stores SET note=? WHERE id=?').bind(String(b.note).slice(0, 300), id));
            if (st.length) await env.DB.batch(st);
            return J({ ok: 1, store: await env.DB.prepare('SELECT id,status,exp,plan,tier,note FROM stores WHERE id=?').bind(id).first() });
          }
          if (!m[2] && M == 'DELETE') {
            await env.DB.batch([env.DB.prepare('DELETE FROM ev WHERE store_id=?').bind(id), env.DB.prepare('DELETE FROM staff WHERE store_id=?').bind(id), env.DB.prepare('DELETE FROM chat WHERE sid=?').bind(id), env.DB.prepare('DELETE FROM stores WHERE id=?').bind(id)]);
            return J({ ok: 1 });
          }
          if (m[2] == 'staff' && M == 'GET') return J({ staff: (await env.DB.prepare('SELECT name,role,created FROM staff WHERE store_id=? ORDER BY created').bind(id).all()).results });
          if (m[2] == 'resetpin' && M == 'POST') {
            if (!PIN.test(String(b.pin || ''))) return J({ e: 'PIN 4-8 angka' }, 400);
            const s = b.name ? await env.DB.prepare('SELECT name FROM staff WHERE store_id=? AND name=?').bind(id, String(b.name)).first()
              : await env.DB.prepare("SELECT name FROM staff WHERE store_id=? AND role='owner' ORDER BY created LIMIT 1").bind(id).first();
            if (!s) return J({ e: 'Pengguna tidak ditemukan' }, 404);
            await env.DB.prepare('UPDATE staff SET pin_hash=? WHERE store_id=? AND name=?').bind(await hp(b.pin, id, s.name), id, s.name).run();
            return J({ ok: 1, name: s.name });
          }
        }
        if (p == '/api/admin/announce' && M == 'POST') {
          const tx = String(b.text || '').trim().slice(0, 500);
          if (!tx) return J({ e: 'Pesan kosong' }, 400);
          await env.DB.prepare('INSERT INTO chat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind('net', 'hq', 'Pemilik Aplikasi', 'Head Admin', tx, Date.now()).run();
          return J({ ok: 1 });
        }
        return J({ e: 'Not found' }, 404);
      }

      // ---------- terautentikasi (staf toko) ----------
      const t = await verify(env, bearer);
      if (!t || !t.sid) return J({ e: 'Unauthorized' }, 401);
      const me = await env.DB.prepare('SELECT s.status,s.name sn,s.exp,s.plan,s.tier,s.perm,st.role FROM stores s JOIN staff st ON st.store_id=s.id AND st.name=? WHERE s.id=?').bind(t.name, t.sid).first();
      if (!me) return J({ e: 'Akun tidak ditemukan' }, 401);
      if (me.status != 'active') return J({ e: 'Toko disuspend oleh pemilik aplikasi' }, 403);
      const sid = t.sid, uname = t.name, role = me.role, EXP = expired(me);
      const RO = () => J({ e: 'Masa aktif toko habis. Hubungi pemilik aplikasi untuk perpanjangan.', expired: 1, ...stInfo(me) }, 402);

      if (p == '/api/me') return J({ sid, name: uname, role, ...stInfo(me) });

      if (p == '/api/me/pin' && M == 'POST') {
        if (!PIN.test(String(b.pin || ''))) return J({ e: 'PIN baru harus 4-8 angka' }, 400);
        if (await limited(env, 'pin:' + sid + ':' + uname.toLowerCase(), 6, 6e5)) return J({ e: 'Terlalu banyak percobaan, coba lagi nanti' }, 429);
        const cur = await env.DB.prepare('SELECT pin_hash FROM staff WHERE store_id=? AND name=?').bind(sid, uname).first();
        if (!cur || !(await same(cur.pin_hash, await hp(String(b.old || ''), sid, uname)))) return J({ e: 'PIN lama salah' }, 400);
        await env.DB.prepare('UPDATE staff SET pin_hash=? WHERE store_id=? AND name=?').bind(await hp(b.pin, sid, uname), sid, uname).run();
        return J({ ok: 1 });
      }

      if (p == '/api/ev') {
        if (M == 'POST') {
          if (EXP) return RO();
          const feats = featsOf(me, role), done = [], rej = [], st = [], rt = Date.now();
          for (const x of (Array.isArray(b.items) ? b.items : []).slice(0, 100)) {
            if (!x || typeof x != 'object' || !NO.test(x.no || '') || !KINDS.has(x.k) || !Number.isFinite(x.t)) { rej.push({ no: x && x.no, e: 'format' }); if (x && x.no) done.push(x.no); continue; }
            done.push(x.no);
            if (!kindOk(feats, role, x.k)) { rej.push({ no: x.no, e: 'peran ' + role + ' tidak boleh ' + x.k + ' (hak akses / paket)' }); continue; }
            const ev = { ...x, u: uname, r: role, rt }; if (x.t > rt + 3e5 || (x.on && Math.abs(x.t - rt) > 3e5)) ev.fl = 'jam';
            const d = JSON.stringify(ev);
            if (d.length > 150000) { rej.push({ no: x.no, e: 'terlalu besar' }); continue; }
            const tot = x.k == 'sale' ? Math.round(+x.tot) || 0 : x.k == 'retur' ? -Math.abs(Math.round(+x.tot) || 0) : 0;
            st.push(env.DB.prepare('INSERT OR IGNORE INTO ev(store_id,no,k,t,tot,data) VALUES(?,?,?,?,?,?)').bind(sid, x.no, x.k, Math.round(x.t), tot, d));
          }
          if (st.length) { await env.DB.batch(st); const kinds = {}; for (const x of b.items || []) if (x && x.k) kinds[x.k] = (kinds[x.k] || 0) + 1; if (kinds.loc) { try { await env.DB.prepare("DELETE FROM ev WHERE store_id=? AND k='loc' AND json_extract(data,'$.u')=? AND seq < (SELECT MAX(seq) FROM ev WHERE store_id=? AND k='loc' AND json_extract(data,'$.u')=?)").bind(sid, uname, sid, uname).run(); } catch (e) { } } await logAct(env, 'staff', uname, uname, sid, 'sinkron data', Object.entries(kinds).map(([k, n]) => k + '×' + n).join(', ')); }
          return J({ done, rej, st: stInfo(me) });
        }
        if (M == 'GET') {
          const since = +u.searchParams.get('since') || 0;
          const r = await env.DB.prepare('SELECT seq,data FROM ev WHERE store_id=? AND seq>? ORDER BY seq LIMIT 500').bind(sid, since).all();
          const items = r.results.map((x) => { const o = JSON.parse(x.data); o.seq = x.seq; return o; });
          return J({ items, cur: items.length ? items[items.length - 1].seq : since, more: items.length == 500, st: stInfo(me), role });
        }
      }

      if (p == '/api/perm') {
        if (M == 'GET') return J({ pm: permObj(me), def: DEFPERM, pf: stInfo(me).pf, all: ALLF });
        if (role != 'owner') return J({ e: 'Khusus pemilik' }, 403);
        if (EXP) return RO();
        if (M == 'PUT') {
          if (!featsOf(me, 'owner').includes('perm')) return J({ e: 'Pengaturan hak akses tersedia di paket Standar / High' }, 403);
          const o = {}; for (const r of ROLES) { if (r == 'owner') continue; if (typeof (b.pm || {})[r] == 'string') o[r] = b.pm[r].split(' ').filter((f) => ALLF.includes(f)).join(' '); }
          await env.DB.prepare('UPDATE stores SET perm=? WHERE id=?').bind(JSON.stringify(o), sid).run();
          return J({ ok: 1, pm: o });
        }
      }

      const sm = p.match(/^\/api\/staff(?:\/(.+))?$/);
      if (sm) {
        if (role != 'owner' && role != 'admin') return J({ e: 'Khusus pemilik / admin toko' }, 403);
        const LOW = ['kasir', 'sales', 'dropping'], nm = sm[1] ? decodeURIComponent(sm[1]) : '';
        if (M == 'GET') return J({ staff: (await env.DB.prepare('SELECT name,role FROM staff WHERE store_id=? ORDER BY created').bind(sid).all()).results });
        if (EXP) return RO();
        const NEWR = role == 'owner' ? ['admin', 'akuntan', 'kasir', 'sales', 'dropping'] : LOW;
        if (M == 'POST') {
          const n = String(b.name || '').trim();
          if (!NAME.test(n) || !PIN.test(String(b.pin || ''))) return J({ e: 'Data tidak valid (nama 2-40 huruf, PIN 4-8 angka)' }, 400);
          if (!NEWR.includes(b.role)) return J({ e: 'Anda tidak boleh membuat pengguna dengan peran itu' }, 403);
          { const cnt = (await env.DB.prepare('SELECT COUNT(*) c FROM staff WHERE store_id=?').bind(sid).first()).c, pk = pkgOf(me.tier); if (cnt >= pk.max) return J({ e: 'Paket ' + pk.n + ' maksimal ' + pk.max + ' pengguna. Hubungi pemilik aplikasi untuk naik paket.' }, 403); }
          try { await env.DB.prepare('INSERT INTO staff(store_id,name,role,pin_hash,created) VALUES(?,?,?,?,?)').bind(sid, n, b.role, await hp(b.pin, sid, n), Date.now()).run(); } catch { return J({ e: 'Nama sudah dipakai' }, 409); }
          return J({ ok: 1 });
        }
        const row = nm && (await env.DB.prepare('SELECT name,role FROM staff WHERE store_id=? AND name=?').bind(sid, nm).first());
        if (nm && !row) return J({ e: 'Pengguna tidak ditemukan' }, 404);
        const self = row && row.name.toLowerCase() == uname.toLowerCase();
        if (row && !self && (row.role == 'owner' || (role == 'admin' && !LOW.includes(row.role)))) return J({ e: 'Anda tidak boleh mengubah pengguna ini' }, 403);
        if (M == 'PATCH' && row) {
          if (b.pin != null && !PIN.test(String(b.pin))) return J({ e: 'PIN 4-8 angka' }, 400);
          if (b.role != null && (self || !NEWR.includes(b.role))) return J({ e: 'Peran tidak valid / tidak bisa mengubah peran sendiri' }, 400);
          if (b.pin != null) await env.DB.prepare('UPDATE staff SET pin_hash=? WHERE store_id=? AND name=?').bind(await hp(b.pin, sid, row.name), sid, row.name).run();
          if (b.role != null) await env.DB.prepare('UPDATE staff SET role=? WHERE store_id=? AND name=?').bind(b.role, sid, row.name).run();
          return J({ ok: 1 });
        }
        if (M == 'DELETE' && row) {
          if (self) return J({ e: 'Tidak bisa menghapus akun sendiri' }, 400);
          await env.DB.prepare('DELETE FROM staff WHERE store_id=? AND name=?').bind(sid, row.name).run();
          return J({ ok: 1 });
        }
      }

      if (p.startsWith('/api/shop/')) { if (!stInfo(me).pf.split(' ').includes('onl')) return J({ e: 'Fitur Toko Online tidak termasuk paket ' + pkgOf(me.tier).n }, 403); const r = await shopRoutes({ env, p, M, b, u, J, sid, role, uname, EXP }); if (r) return r; }

      if (p == '/api/chat/rooms' && M == 'GET') {
        const r = await env.DB.prepare(`SELECT room,MAX(seq) last FROM chat WHERE room LIKE ? OR room LIKE ? GROUP BY room ORDER BY last DESC LIMIT 30`).bind('dm:' + sid + ':%', 'dm:%:' + sid).all();
        const out = [];
        for (const x of r.results) {
          const other = x.room.split(':').slice(1).find((i) => i != sid) || sid;
          const s = await env.DB.prepare('SELECT name FROM stores WHERE id=?').bind(other).first();
          out.push({ room: 'dm:' + other, name: s ? s.name : other, last: x.last });
        }
        return J({ rooms: out });
      }
      if (p == '/api/chat') {
        const rm = String(M == 'POST' ? b.room || 'tk' : u.searchParams.get('room') || 'tk');
        let key, peer = null;
        if (rm == 'tk') key = 'tk:' + sid; else if (rm == 'net') key = 'net';
        else if (/^dm:[a-z0-9]{6,20}$/.test(rm)) {
          const o = rm.slice(3), s = await env.DB.prepare('SELECT name FROM stores WHERE id=?').bind(o).first();
          if (!s || o == sid) return J({ e: 'Kode toko tujuan tidak ditemukan' }, 404);
          key = 'dm:' + [sid, o].sort().join(':'); peer = { id: o, name: s.name };
        } else return J({ e: 'Ruang tidak valid' }, 400);
        if (M == 'POST') {
          if (EXP) return RO();
          const tx = String(b.text || '').trim().slice(0, 500);
          if (!tx) return J({ e: 'Pesan kosong' }, 400);
          if (await limited(env, 'chat:' + sid + ':' + uname, 20, 3e4)) return J({ e: 'Terlalu cepat, tunggu sebentar' }, 429);
          await env.DB.prepare('INSERT INTO chat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind(key, sid, me.sn, uname, tx, Date.now()).run();
          return J({ ok: 1 });
        }
        const since = +u.searchParams.get('since') || 0;
        const r = since ? await env.DB.prepare('SELECT seq,sid,sn,un,tx,t FROM chat WHERE room=? AND seq>? ORDER BY seq LIMIT 100').bind(key, since).all()
          : await env.DB.prepare('SELECT seq,sid,sn,un,tx,t FROM (SELECT * FROM chat WHERE room=? ORDER BY seq DESC LIMIT 50) ORDER BY seq').bind(key).all();
        return J({ m: r.results, peer });
      }
      return J({ e: 'Not found' }, 404);
    } catch (x) { console.error(x && x.stack || x); return J({ e: 'Server error' }, 500); }
  },
};
