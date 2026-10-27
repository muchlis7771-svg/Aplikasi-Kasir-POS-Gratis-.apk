// J-POS API v3 — Cloudflare Worker + D1 (SQLite)
// Multi-tenant: 1 toko = 1 tenant. Semua data bisnis disimpan sebagai LOG KEJADIAN (tabel ev) yang
// diputar ulang oleh tiap perangkat (offline-first). Server memeriksa peran, bukan isi akuntansi.
const E = new TextEncoder(), D = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', E.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, E.encode(data)));
}
const same = async (a, c) => (await hmac('cmp', String(a))) === (await hmac('cmp', String(c))); // banding waktu-konstan
async function sign(env, payload) { const b = b64(E.encode(JSON.stringify(payload))); return b + '.' + (await hmac(env.SECRET, b)); }
async function verify(env, token) {
  const [b, s] = String(token || '').split('.');
  if (!b || !s || s !== (await hmac(env.SECRET, b))) return null;
  try { const p = JSON.parse(D.decode(ub64(b))); return p.exp > Date.now() ? p : null; } catch { return null; }
}
async function hashPin(pin, salt) {
  const k = await crypto.subtle.importKey('raw', E.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: E.encode(salt), iterations: 20000 }, k, 256));
}
const hp = (pin, sid, name) => hashPin(String(pin), sid + ':' + name.toLowerCase());
const PIN = /^\d{4,8}$/, SID = /^[a-z0-9]{6,20}$/, NO = /^[A-Za-z0-9_-]{3,40}$/, NAME = /^[\p{L}\p{N} ._-]{2,40}$/u;
const ROLES = ['admin', 'akuntan', 'kasir', 'sales'];
const KINDS = new Set(['sale', 'pay', 'retur', 'stk', 'apay', 'opn', 'exp', 'cap', 'jm', 'pu', 'cu', 'set', 'in', 'out', 'visit']);
// Peran yang dibatasi hanya boleh mengirim jenis kejadian tertentu (admin/akuntan: semua).
const ALLOW = { admin: null, akuntan: null, kasir: ['sale', 'pay', 'in', 'out'], sales: ['sale', 'pay', 'in', 'out', 'visit', 'cu'] };

async function limited(env, key, max, win) {
  const now = Date.now();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rl WHERE t<?').bind(now - 36e5).run();
  const r = await env.DB.prepare('SELECT COUNT(*) c FROM rl WHERE k=? AND t>?').bind(key, now - win).first();
  if (r.c >= max) return true;
  await env.DB.prepare('INSERT INTO rl(k,t) VALUES(?,?)').bind(key, now).run();
  return false;
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname, M = req.method, ip = req.headers.get('CF-Connecting-IP') || 'x';
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    const cors = { 'Access-Control-Allow-Origin': env.ORIGIN || '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (M == 'OPTIONS') return new Response(null, { headers: cors });
    if (!env.SECRET) return J({ e: 'SECRET belum diatur di server' }, 500);
    let b = {};
    if (M == 'POST' || M == 'PUT' || M == 'PATCH') { try { b = await req.json(); } catch { } }
    const bearer = (req.headers.get('Authorization') || '').slice(7);
    try {
      // ---------- publik ----------
      if (p == '/api/ping') return J({ ok: 1 });
      if (p == '/api/register' && M == 'POST') {
        if (await limited(env, 'reg:' + ip, 5, 36e5)) return J({ e: 'Terlalu banyak pendaftaran, coba lagi nanti' }, 429);
        const id = String(b.id || ''), store = String(b.store || '').trim().slice(0, 60), owner = String(b.owner || '').trim();
        const email = String(b.email || '').trim().toLowerCase(), pin = String(b.pin || '');
        if (!SID.test(id) || !store || !NAME.test(owner) || (email && !/^\S+@\S+\.\S+$/.test(email)) || !PIN.test(pin)) return J({ e: 'Data tidak valid (nama pemilik, email, atau PIN 4-8 angka)' }, 400);
        try {
          await env.DB.batch([
            env.DB.prepare('INSERT INTO stores(id,name,owner,email,created) VALUES(?,?,?,?,?)').bind(id, store, owner, email || null, Date.now()),
            env.DB.prepare('INSERT INTO staff(store_id,name,role,pin_hash,created) VALUES(?,?,?,?,?)').bind(id, owner, 'admin', await hp(pin, id, owner), Date.now()),
          ]);
        } catch { return J({ e: 'Email atau kode toko sudah terdaftar' }, 409); }
        return J({ token: await sign(env, { sid: id, name: owner, exp: Date.now() + 2592e6 }), role: 'admin', name: owner, sn: store });
      }
      if (p == '/api/login' && M == 'POST') {
        const id = String(b.id || '').toLowerCase(), name = String(b.name || '').trim();
        if ((await limited(env, 'login:' + ip, 40, 6e5)) || (await limited(env, 'login:' + id + ':' + name.toLowerCase(), 8, 6e5))) return J({ e: 'Terlalu banyak percobaan, coba lagi 10 menit' }, 429);
        const r = await env.DB.prepare('SELECT st.name,st.role,st.pin_hash,s.status,s.name sn FROM staff st JOIN stores s ON s.id=st.store_id WHERE st.store_id=? AND st.name=?').bind(id, name).first();
        if (!r || r.pin_hash !== (await hp(b.pin || '', id, r.name))) return J({ e: 'Kode toko, nama, atau PIN salah' }, 401);
        if (r.status != 'active') return J({ e: 'Toko disuspend oleh developer' }, 403);
        return J({ token: await sign(env, { sid: id, name: r.name, exp: Date.now() + 2592e6 }), role: r.role, name: r.name, sn: r.sn });
      }

      // ---------- Head Admin (developer) ----------
      if (p == '/api/admin/login' && M == 'POST') {
        if (await limited(env, 'adm:' + ip, 6, 9e5)) return J({ e: 'Terlalu banyak percobaan, coba lagi 15 menit' }, 429);
        const okU = env.ADMIN_USER && (await same(b.user || '', env.ADMIN_USER)), okP = env.ADMIN_PASS && (await same(b.pass || '', env.ADMIN_PASS));
        if (!okU || !okP) return J({ e: 'User atau password salah' }, 401);
        return J({ token: await sign(env, { role: 'super', exp: Date.now() + 432e5 }) });
      }
      if (p.startsWith('/api/admin/')) {
        const a = await verify(env, bearer);
        if (!a || a.role != 'super') return J({ e: 'Unauthorized' }, 401);
        if (p == '/api/admin/stores' && M == 'GET') {
          const r = await env.DB.prepare(`SELECT s.id,s.name,s.owner,s.email,s.status,s.created,
              (SELECT COUNT(*) FROM staff WHERE store_id=s.id) users, COALESCE(e.n,0) tx, COALESCE(e.o,0) omzet, e.last
            FROM stores s LEFT JOIN (SELECT store_id,SUM(CASE WHEN k='sale' THEN 1 ELSE 0 END) n,SUM(tot) o,MAX(t) last FROM ev GROUP BY store_id) e ON e.store_id=s.id
            ORDER BY s.created DESC LIMIT 1000`).all();
          return J({ stores: r.results });
        }
        if (p == '/api/admin/stats' && M == 'GET') {
          const tz = (+u.searchParams.get('tz') || 0) * 60, since = Date.now() - 14 * 864e5, m30 = Date.now() - 30 * 864e5;
          const [tt, dd, ns, top] = await Promise.all([
            env.DB.prepare(`SELECT (SELECT COUNT(*) FROM stores) stores,(SELECT COUNT(*) FROM stores WHERE status='active') active,(SELECT COUNT(*) FROM staff) users,
              COALESCE((SELECT SUM(tot) FROM ev),0) omzet,(SELECT COUNT(*) FROM ev WHERE k='sale') tx`).first(),
            env.DB.prepare(`SELECT strftime('%Y-%m-%d',(t/1000)+?,'unixepoch') d,SUM(tot) v FROM ev WHERE k IN('sale','retur') AND t>? GROUP BY d ORDER BY d`).bind(tz, since).all(),
            env.DB.prepare(`SELECT strftime('%Y-%m-%d',(created/1000)+?,'unixepoch') d,COUNT(*) v FROM stores WHERE created>? GROUP BY d ORDER BY d`).bind(tz, since).all(),
            env.DB.prepare(`SELECT s.name,SUM(e.tot) v FROM ev e JOIN stores s ON s.id=e.store_id WHERE e.t>? GROUP BY e.store_id ORDER BY v DESC LIMIT 5`).bind(m30).all(),
          ]);
          return J({ totals: tt, daily: dd.results, signups: ns.results, top: top.results });
        }
        let m = p.match(/^\/api\/admin\/stores\/([a-z0-9]+)(?:\/(staff|resetpin))?$/);
        if (m) {
          const id = m[1];
          if (!m[2] && M == 'PATCH' && ['active', 'suspended'].includes(b.status)) { await env.DB.prepare('UPDATE stores SET status=? WHERE id=?').bind(b.status, id).run(); return J({ ok: 1 }); }
          if (!m[2] && M == 'DELETE') {
            await env.DB.batch([env.DB.prepare('DELETE FROM ev WHERE store_id=?').bind(id), env.DB.prepare('DELETE FROM staff WHERE store_id=?').bind(id), env.DB.prepare('DELETE FROM chat WHERE sid=?').bind(id), env.DB.prepare('DELETE FROM stores WHERE id=?').bind(id)]);
            return J({ ok: 1 });
          }
          if (m[2] == 'staff' && M == 'GET') return J({ staff: (await env.DB.prepare('SELECT name,role,created FROM staff WHERE store_id=?').bind(id).all()).results });
          if (m[2] == 'resetpin' && M == 'POST') {
            if (!PIN.test(String(b.pin || ''))) return J({ e: 'PIN 4-8 angka' }, 400);
            const s = b.name ? await env.DB.prepare('SELECT name FROM staff WHERE store_id=? AND name=?').bind(id, String(b.name)).first()
              : await env.DB.prepare("SELECT name FROM staff WHERE store_id=? AND role='admin' ORDER BY created LIMIT 1").bind(id).first();
            if (!s) return J({ e: 'Pengguna tidak ditemukan' }, 404);
            await env.DB.prepare('UPDATE staff SET pin_hash=? WHERE store_id=? AND name=?').bind(await hp(b.pin, id, s.name), id, s.name).run();
            return J({ ok: 1, name: s.name });
          }
        }
        if (p == '/api/admin/announce' && M == 'POST') {
          const tx = String(b.text || '').trim().slice(0, 500);
          if (!tx) return J({ e: 'Pesan kosong' }, 400);
          await env.DB.prepare('INSERT INTO chat(room,sid,sn,un,tx,t) VALUES(?,?,?,?,?,?)').bind('net', 'hq', 'Head Admin', 'Developer', tx, Date.now()).run();
          return J({ ok: 1 });
        }
        return J({ e: 'Not found' }, 404);
      }

      // ---------- terautentikasi (staf toko) ----------
      const t = await verify(env, bearer);
      if (!t || !t.sid) return J({ e: 'Unauthorized' }, 401);
      const me = await env.DB.prepare('SELECT s.status,s.name sn,st.role FROM stores s JOIN staff st ON st.store_id=s.id AND st.name=? WHERE s.id=?').bind(t.name, t.sid).first();
      if (!me) return J({ e: 'Akun tidak ditemukan' }, 401);
      if (me.status != 'active') return J({ e: 'Toko disuspend oleh developer' }, 403);
      const sid = t.sid, uname = t.name, role = me.role;

      if (p == '/api/me') return J({ sid, name: uname, role, sn: me.sn });

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
          const allow = ALLOW[role], done = [], rej = [], st = [];
          for (const x of (Array.isArray(b.items) ? b.items : []).slice(0, 100)) {
            if (!x || typeof x != 'object' || !NO.test(x.no || '') || !KINDS.has(x.k) || !Number.isFinite(x.t)) { rej.push({ no: x && x.no, e: 'format' }); if (x && x.no) done.push(x.no); continue; }
            done.push(x.no);
            if (allow && !allow.includes(x.k)) { rej.push({ no: x.no, e: 'peran ' + role + ' tidak boleh ' + x.k }); continue; }
            const ev = { ...x, u: uname, r: role }, d = JSON.stringify(ev);
            if (d.length > 30000) { rej.push({ no: x.no, e: 'terlalu besar' }); continue; }
            const tot = x.k == 'sale' ? Math.round(+x.tot) || 0 : x.k == 'retur' ? -Math.abs(Math.round(+x.tot) || 0) : 0;
            st.push(env.DB.prepare('INSERT OR IGNORE INTO ev(store_id,no,k,t,tot,data) VALUES(?,?,?,?,?,?)').bind(sid, x.no, x.k, Math.round(x.t), tot, d));
          }
          if (st.length) await env.DB.batch(st);
          return J({ done, rej });
        }
        if (M == 'GET') {
          const since = +u.searchParams.get('since') || 0;
          const r = await env.DB.prepare('SELECT seq,data FROM ev WHERE store_id=? AND seq>? ORDER BY seq LIMIT 500').bind(sid, since).all();
          const items = r.results.map((x) => { const o = JSON.parse(x.data); o.seq = x.seq; return o; });
          return J({ items, cur: items.length ? items[items.length - 1].seq : since, more: items.length == 500 });
        }
      }

      const sm = p.match(/^\/api\/staff(?:\/(.+))?$/);
      if (sm) {
        if (role != 'admin') return J({ e: 'Khusus admin toko' }, 403);
        const nm = sm[1] ? decodeURIComponent(sm[1]) : '';
        if (M == 'GET') return J({ staff: (await env.DB.prepare('SELECT name,role FROM staff WHERE store_id=? ORDER BY created').bind(sid).all()).results });
        if (M == 'POST') {
          const n = String(b.name || '').trim();
          if (!NAME.test(n) || !ROLES.includes(b.role) || !PIN.test(String(b.pin || ''))) return J({ e: 'Data tidak valid (PIN 4-8 angka)' }, 400);
          try { await env.DB.prepare('INSERT INTO staff(store_id,name,role,pin_hash,created) VALUES(?,?,?,?,?)').bind(sid, n, b.role, await hp(b.pin, sid, n), Date.now()).run(); } catch { return J({ e: 'Nama sudah dipakai' }, 409); }
          return J({ ok: 1 });
        }
        if (M == 'PATCH' && nm) {
          if (b.pin != null && !PIN.test(String(b.pin))) return J({ e: 'PIN 4-8 angka' }, 400);
          if (b.role != null && (!ROLES.includes(b.role) || nm.toLowerCase() == uname.toLowerCase())) return J({ e: 'Peran tidak valid / tidak bisa mengubah peran sendiri' }, 400);
          const row = await env.DB.prepare('SELECT name FROM staff WHERE store_id=? AND name=?').bind(sid, nm).first();
          if (!row) return J({ e: 'Pengguna tidak ditemukan' }, 404);
          if (b.pin != null) await env.DB.prepare('UPDATE staff SET pin_hash=? WHERE store_id=? AND name=?').bind(await hp(b.pin, sid, row.name), sid, row.name).run();
          if (b.role != null) await env.DB.prepare('UPDATE staff SET role=? WHERE store_id=? AND name=?').bind(b.role, sid, row.name).run();
          return J({ ok: 1 });
        }
        if (M == 'DELETE' && nm) {
          if (nm.toLowerCase() == uname.toLowerCase()) return J({ e: 'Tidak bisa menghapus akun sendiri' }, 400);
          await env.DB.prepare('DELETE FROM staff WHERE store_id=? AND name=?').bind(sid, nm).run();
          return J({ ok: 1 });
        }
      }

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
