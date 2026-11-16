// J-DATA Sync: simpan riwayat penjualan, RO, dan target di Cloudflare D1.
// Auth: header "Authorization: Bearer <SYNC_TOKEN>" (secret Worker). Data dipisah per "profile".
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
const CHUNK = 80; // statement per batch D1

async function batch(db, stmts) {
  for (let i = 0; i < stmts.length; i += CHUNK) await db.batch(stmts.slice(i, i + CHUNK));
}
const s = (v) => (v == null ? "" : String(v));
const n = (v) => (Number.isFinite(+v) ? +v : 0);


// ---- LISENSI & MONITORING PENGGUNA (identitas diverifikasi ke Worker login jdata-report-auth) ----
const AUTH_URL = "https://jdata-report-auth.muchlis7771.workers.dev";
const DAY = 86400000;
async function authPost(path, body, token) {
  const r = await fetch(AUTH_URL + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-auth-token": token } : {}) }, body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, j };
}
let ready = false;
async function ensureTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS app_users(username TEXT PRIMARY KEY, role TEXT, first_seen INTEGER, last_seen INTEGER, opens INTEGER DEFAULT 0, app_version TEXT, model TEXT, last_event TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS app_devices(username TEXT, device_id TEXT, model TEXT, first_seen INTEGER, last_seen INTEGER, PRIMARY KEY(username, device_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS licenses(username TEXT PRIMARY KEY, type TEXT DEFAULT 'trial', trial_start INTEGER, trial_days INTEGER DEFAULT 30, seats INTEGER DEFAULT 1, paid_until TEXT, note TEXT)"),
  ]);
  ready = true;
}
const todayStr = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
// Hitung status lisensi satu user. type: trial | paid | free
function licStatus(l, activeUntil, deviceRank) {
  const out = { type: l.type, trial_days: l.trial_days, seats: l.seats, paid_until: l.paid_until || null, days_left: null, status: "ok", code: null, message: null };
  const today = todayStr();
  if (l.type === "free") return out;
  if (l.type === "paid") {
    if (l.paid_until) { out.days_left = Math.ceil((Date.parse(l.paid_until) - Date.parse(today)) / DAY); if (l.paid_until < today) { out.status = "expired"; out.code = "EXPIRED"; out.message = "Lisensi berakhir " + l.paid_until + ". Hubungi admin untuk perpanjang."; } }
  } else {
    // trial: bila langganan di server login masih aktif, anggap berbayar
    if (activeUntil && activeUntil >= today) { out.type = "paid"; out.paid_until = activeUntil; out.days_left = Math.ceil((Date.parse(activeUntil) - Date.parse(today)) / DAY); }
    else {
      out.days_left = Math.ceil(((l.trial_start || Date.now()) + l.trial_days * DAY - Date.now()) / DAY);
      if (out.days_left <= 0) { out.days_left = 0; out.status = "expired"; out.code = "TRIAL_EXPIRED"; out.message = "Masa trial " + l.trial_days + " hari sudah habis. Hubungi admin untuk membeli lisensi."; }
    }
  }
  if (out.status === "ok" && deviceRank >= l.seats) { out.status = "blocked"; out.code = "SEATS"; out.message = "Jumlah pengguna/perangkat melebihi paket (" + l.seats + "). Hubungi admin untuk menambah paket."; }
  return out;
}
async function isAdmin(token) { if (!token) return false; const r = await authPost("/api/admin/users", {}, token); return r.ok; }

async function usageRoutes(url, req, env) {
  const db = env.DB; const b = await req.json().catch(() => ({}));
  await ensureTables(db);
  if (url.pathname === "/usage/ping") {
    const v = await authPost("/api/verify", { token: s(b.token), device_id: s(b.device_id) });
    if (!v.ok || v.j.valid === false) return J({ ok: false, error: "sesi tidak valid" }, 401);
    const u = s(b.username).slice(0, 60), dev = s(b.device_id).slice(0, 80), now = Date.now();
    if (!u || !dev) return J({ error: "username & device_id wajib" }, 400);
    const role = s(b.role) || "sales";
    await db.batch([
      db.prepare("INSERT INTO app_users(username,role,first_seen,last_seen,opens,app_version,model,last_event) VALUES(?,?,?,?,1,?,?,?) ON CONFLICT(username) DO UPDATE SET role=excluded.role,last_seen=excluded.last_seen,opens=opens+?,app_version=excluded.app_version,model=excluded.model,last_event=excluded.last_event")
        .bind(u, role, now, now, s(b.version), s(b.model), s(b.event), b.event === "open" || b.event === "login" ? 1 : 0),
      db.prepare("INSERT INTO app_devices(username,device_id,model,first_seen,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(username,device_id) DO UPDATE SET last_seen=excluded.last_seen,model=excluded.model").bind(u, dev, s(b.model), now, now),
      db.prepare("INSERT OR IGNORE INTO licenses(username,type,trial_start,trial_days,seats) VALUES(?,?,?,30,1)").bind(u, role === "admin" ? "free" : "trial", now),
    ]);
    const l = await db.prepare("SELECT * FROM licenses WHERE username=?").bind(u).first();
    const devs = (await db.prepare("SELECT device_id FROM app_devices WHERE username=? ORDER BY first_seen").bind(u).all()).results || [];
    const rank = devs.findIndex((d) => d.device_id === dev);
    const st = licStatus(l, s(b.active_until), rank < 0 ? 0 : rank);
    st.devices = devs.length;
    return J({ ok: true, ...st });
  }
  // ---- khusus admin ----
  if (!(await isAdmin(s(b.token)))) return J({ error: "khusus admin" }, 403);
  if (url.pathname === "/admin/overview") {
    const us = (await db.prepare("SELECT u.*, l.type, l.trial_start, l.trial_days, l.seats, l.paid_until, l.note, (SELECT COUNT(*) FROM app_devices d WHERE d.username=u.username) AS devices FROM app_users u LEFT JOIN licenses l ON l.username=u.username ORDER BY u.last_seen DESC").all()).results || [];
    return J({ now: Date.now(), users: us });
  }
  if (url.pathname === "/admin/devices") {
    const r = (await db.prepare("SELECT * FROM app_devices WHERE username=? ORDER BY first_seen").bind(s(b.username)).all()).results || [];
    return J({ devices: r });
  }
  if (url.pathname === "/admin/license") {
    const u = s(b.username); if (!u) return J({ error: "username wajib" }, 400);
    await db.prepare("INSERT OR IGNORE INTO licenses(username,type,trial_start,trial_days,seats) VALUES(?,?,?,30,1)").bind(u, "trial", Date.now()).run();
    const sets = [], vals = [];
    if (b.type && ["trial", "paid", "free"].includes(b.type)) { sets.push("type=?"); vals.push(b.type); }
    if (b.trial_days != null) { sets.push("trial_days=?"); vals.push(Math.max(0, n(b.trial_days))); }
    if (b.seats != null) { sets.push("seats=?"); vals.push(Math.max(1, n(b.seats))); }
    if (b.paid_until != null) { sets.push("paid_until=?"); vals.push(s(b.paid_until) === "none" ? null : s(b.paid_until)); }
    if (b.reset_trial) { sets.push("trial_start=?"); vals.push(Date.now()); }
    if (b.note != null) { sets.push("note=?"); vals.push(s(b.note)); }
    if (sets.length) await db.prepare("UPDATE licenses SET " + sets.join(",") + " WHERE username=?").bind(...vals, u).run();
    if (b.reset_devices) await db.prepare("DELETE FROM app_devices WHERE username=?").bind(u).run();
    return J({ ok: true });
  }
  return J({ error: "not found" }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST" } });
    if (url.pathname === "/health") return J({ ok: true });
    if (req.method === "POST" && (url.pathname.startsWith("/usage/") || url.pathname.startsWith("/admin/"))) {
      try { return await usageRoutes(url, req, env); } catch (e) { return J({ error: String(e && e.message || e) }, 500); }
    }
    if (!env.SYNC_TOKEN) return J({ error: "SYNC_TOKEN belum diatur di Worker" }, 500);
    if (req.headers.get("authorization") !== "Bearer " + env.SYNC_TOKEN) return J({ error: "unauthorized" }, 401);
    const db = env.DB;
    const profile = url.searchParams.get("profile") || "";
    try {
      // ---- RIWAYAT PENJUALAN ----
      if (url.pathname === "/sync/history" && req.method === "POST") {
        const b = await req.json();
        const p = s(b.profile), rows = Array.isArray(b.rows) ? b.rows : [];
        if (!p || !rows.length) return J({ error: "profile & rows wajib" }, 400);
        const now = Date.now(), del = [], ins = [];
        const seen = new Set(), days = new Set();
        for (const r of rows) {
          if (r.faktur) {
            const k = r.faktur + "|" + s(r.skuCode) + "|" + s(r.skuName);
            if (!seen.has(k)) { seen.add(k); del.push(db.prepare("DELETE FROM sales WHERE profile=? AND faktur=? AND sku_code=? AND sku_name=?").bind(p, s(r.faktur), s(r.skuCode), s(r.skuName))); }
          } else days.add(s(r.tanggal));
        }
        for (const d of days) del.push(db.prepare("DELETE FROM sales WHERE profile=? AND tanggal=? AND faktur=''").bind(p, d));
        for (const r of rows) ins.push(db.prepare("INSERT INTO sales(profile,tanggal,outlet_key,outlet_id,outlet_name,salesman,sku_code,sku_name,omset,qty_karton,ordered,visited,faktur,channel,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(p, s(r.tanggal), s(r.outletKey), s(r.outletId), s(r.outletName), s(r.salesman), s(r.skuCode), s(r.skuName), n(r.omset), n(r.qtyKarton), r.ordered ? 1 : 0, r.visited ? 1 : 0, s(r.faktur), s(r.channel), now));
        await batch(db, del); await batch(db, ins);
        // ringkasan harian untuk tanggal yang tersentuh
        const touched = [...new Set(rows.map((r) => s(r.tanggal)))];
        const ds = [];
        for (const d of touched) {
          ds.push(db.prepare("DELETE FROM daily_outlet WHERE profile=? AND tanggal=?").bind(p, d));
          ds.push(db.prepare("INSERT INTO daily_outlet SELECT profile,tanggal,outlet_key,MAX(salesman),SUM(omset),SUM(qty_karton),COUNT(DISTINCT sku_code||sku_name) FROM sales WHERE profile=? AND tanggal=? AND ordered=1 GROUP BY outlet_key").bind(p, d));
        }
        await batch(db, ds);
        return J({ ok: true, saved: rows.length });
      }
      if (url.pathname === "/sync/history" && req.method === "GET") {
        const from = url.searchParams.get("from") || "0000", to = url.searchParams.get("to") || "9999";
        const after = +(url.searchParams.get("after") || 0);
        const r = await db.prepare("SELECT rowid AS id,* FROM sales WHERE profile=? AND tanggal>=? AND tanggal<=? AND rowid>? ORDER BY rowid LIMIT 2000").bind(profile, from, to, after).all();
        const rows = r.results || [];
        return J({ rows, next: rows.length === 2000 ? rows[rows.length - 1].id : null });
      }
      // ---- DATA RO ----
      if (url.pathname === "/sync/ro" && req.method === "POST") {
        const b = await req.json(); const p = s(b.profile), list = Array.isArray(b.outlets) ? b.outlets : [];
        if (!p) return J({ error: "profile wajib" }, 400);
        const now = Date.now();
        const st = b.append ? [] : [db.prepare("DELETE FROM ro WHERE profile=?").bind(p)];
        for (const o of list) st.push(db.prepare("INSERT OR REPLACE INTO ro VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(p, s(o.outletKey), s(o.outletId), s(o.outletName), s(o.salesman), s(o.channel), s(o.cluster), s(o.kecamatan), s(o.kabupaten), JSON.stringify(o.extra || {}), now));
        await batch(db, st);
        return J({ ok: true, saved: list.length });
      }
      if (url.pathname === "/sync/ro" && req.method === "GET") {
        const r = await db.prepare("SELECT * FROM ro WHERE profile=?").bind(profile).all();
        return J({ outlets: r.results || [] });
      }
      // ---- TARGET ----
      if (url.pathname === "/sync/targets" && req.method === "POST") {
        const b = await req.json(); const p = s(b.profile), list = Array.isArray(b.targets) ? b.targets : [];
        if (!p) return J({ error: "profile wajib" }, 400);
        const st = [db.prepare("DELETE FROM targets WHERE profile=?").bind(p)];
        for (const t of list) st.push(db.prepare("INSERT OR REPLACE INTO targets VALUES(?,?,?,?,?,?)").bind(p, s(t.salesman), n(t.omset), n(t.ao), n(t.qty), Date.now()));
        await batch(db, st);
        return J({ ok: true, saved: list.length });
      }
      if (url.pathname === "/sync/targets" && req.method === "GET") {
        const r = await db.prepare("SELECT salesman,omset,ao,qty FROM targets WHERE profile=?").bind(profile).all();
        return J({ targets: r.results || [] });
      }
      if (url.pathname === "/sync/profiles") {
        const r = await db.prepare("SELECT profile FROM sales UNION SELECT profile FROM ro").all();
        return J({ profiles: (r.results || []).map((x) => x.profile) });
      }
      // ---- STATUS ----
      if (url.pathname === "/sync/status") {
        const a = await db.prepare("SELECT COUNT(*) c, MIN(tanggal) a, MAX(tanggal) b FROM sales WHERE profile=?").bind(profile).first();
        const o = await db.prepare("SELECT COUNT(*) c FROM ro WHERE profile=?").bind(profile).first();
        return J({ salesRows: a.c, dari: a.a, sampai: a.b, roOutlets: o.c });
      }
      return J({ error: "not found" }, 404);
    } catch (e) {
      return J({ error: String(e && e.message || e) }, 500);
    }
  },
};
