// J-DATA Sync: simpan riwayat penjualan, RO, dan target di Cloudflare D1.
// Auth: header "Authorization: Bearer <SYNC_TOKEN>" (secret Worker). Data dipisah per "profile".
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
const CHUNK = 80; // statement per batch D1

async function batch(db, stmts) {
  for (let i = 0; i < stmts.length; i += CHUNK) await db.batch(stmts.slice(i, i + CHUNK));
}
const s = (v) => (v == null ? "" : String(v));
const n = (v) => (Number.isFinite(+v) ? +v : 0);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST" } });
    if (url.pathname === "/health") return J({ ok: true });
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
