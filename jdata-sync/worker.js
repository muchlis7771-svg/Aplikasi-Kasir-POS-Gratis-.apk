// J-DATA Sync: simpan riwayat penjualan, RO, dan target di Cloudflare D1.
// Auth: header "Authorization: Bearer <SYNC_TOKEN>" (secret Worker). Data dipisah per "profile".
const DASH_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>J-DATA Dashboard</title>
<style>
:root{--bg:#f6f8fb;--card:#fff;--ink:#16222b;--mut:#5b6b79;--pri:#0b3c6b;--ok:#1b8a4b;--bad:#c62828;--line:#e3e9f0}
*{box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif;background:var(--bg);color:var(--ink)}
header{background:var(--pri);color:#fff;padding:14px 16px}h1{margin:0;font-size:18px}
main{max-width:1100px;margin:0 auto;padding:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;overflow-x:auto}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
select,input,button{font:inherit;padding:8px 10px;border:1px solid #c7d0da;border-radius:8px;background:#fff}
button{background:var(--pri);color:#fff;border:0;cursor:pointer}button.alt{background:#fff;color:var(--pri);border:1px solid var(--pri)}
button.on{background:var(--pri);color:#fff}
table{border-collapse:collapse;width:100%;min-width:560px}th,td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}th{background:#1565c0;color:#fff;position:sticky;top:0}
tr.tot td{background:#dce9f6;font-weight:700}
.bar{height:8px;background:#e8edf3;border-radius:4px;min-width:80px}.bar i{display:block;height:8px;border-radius:4px;background:#1565c0}
.kpis{display:flex;gap:10px;flex-wrap:wrap}.kpi{flex:1;min-width:140px;background:#0b3c6b;color:#fff;border-radius:12px;padding:12px}.kpi b{display:block;font-size:20px}
.neg{color:var(--bad)}.pos{color:var(--ok)}.mut{color:var(--mut);font-size:12px}
</style></head><body>
<header><h1>J-DATA Dashboard</h1></header>
<main>
<div class="card" id="login"><div class="row"><input id="tok" type="password" placeholder="Token (SYNC_TOKEN)" style="flex:1;min-width:220px"><button onclick="saveTok()">Masuk</button></div><div class="mut">Token hanya disimpan di browser ini.</div></div>
<div id="app" style="display:none">
<div class="card"><div class="row">
<select id="prof" onchange="load()"></select>
<input id="from" type="date" onchange="load()"><span>s/d</span><input id="to" type="date" onchange="load()">
<button class="alt" onclick="setMonth(0)">Bulan ini</button><button class="alt" onclick="setMonth(-1)">Bulan lalu</button>
<button id="uRp" class="on" onclick="setUnit('rp')">Rp</button><button id="uKrt" class="alt" onclick="setUnit('krt')">Karton</button>
</div></div>
<div class="kpis" id="kpis"></div>
<div class="card"><b>Target vs Actual per Salesman</b><div class="mut" id="note"></div><div id="tSales"></div></div>
<div class="card"><b>Program Promo</b><div id="tProg"></div></div>
<div class="card"><b>Top SKU</b><div id="tSku"></div></div>
</div></main>
<script>
let T=localStorage.getItem('jd_tok')||'',D=null,U='rp';
const $=i=>document.getElementById(i);
const nf=new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}),nf1=new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
const fmt=v=>U==='rp'?nf.format(Math.round(v)):nf1.format(v);
async function api(p){const r=await fetch(p,{headers:{authorization:'Bearer '+T}});if(r.status==401){localStorage.removeItem('jd_tok');location.reload();}return r.json();}
function saveTok(){T=$('tok').value.trim();localStorage.setItem('jd_tok',T);init();}
function iso(d){return d.toISOString().slice(0,10)}
function setMonth(k){const n=new Date();const a=new Date(Date.UTC(n.getFullYear(),n.getMonth()+k,1)),b=new Date(Date.UTC(n.getFullYear(),n.getMonth()+k+1,0));$('from').value=iso(a);$('to').value=iso(b);load();}
function setUnit(u){U=u;$('uRp').className=u==='rp'?'on':'alt';$('uKrt').className=u==='krt'?'on':'alt';render();}
async function init(){if(!T)return;$('login').style.display='none';$('app').style.display='block';
 const r=await api('/sync/profiles');const ps=(r.profiles||[]).sort();$('prof').innerHTML=ps.map(p=>\`<option>\${p}</option>\`).join('');setMonth(0);}
async function load(){if(!$('prof').value)return;D=await api(\`/dash/data?profile=\${encodeURIComponent($('prof').value)}&from=\${$('from').value}&to=\${$('to').value}\`);render();}
function nm(x){return String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function tgt(n){const k=nm(n);if(!k)return{};const e=Object.entries(D.targets);let m=e.find(([a])=>nm(a)===k)||e.find(([a])=>{const x=nm(a);return x&&(x.includes(k)||k.includes(x))});return m?m[1]:{}}
function pct(a,t){return t>0?Math.round(a/t*100)+'%':'-'}
function cls(v){return v>=0?'pos':'neg'}
function render(){if(!D||D.error){if(D&&D.error)$('tSales').textContent=D.error;return}
 const days=Math.max(1,(Date.parse($('to').value)-Date.parse($('from').value))/864e5+1),f=days/30;
 const sv=s=>U==='rp'?s.omset:s.qty;
 let tt=0,ta=0,ao=0,aoT=0;
 const rows=D.sales.map(s=>{const t=tgt(s.salesman),tg=(U==='rp'?t.omset:t.qty||0)*f||0;tt+=tg;ta+=sv(s);ao+=s.ao;aoT+=t.ao||0;return{s,tg,a:sv(s),aoT:t.ao||0}});
 $('kpis').innerHTML=\`<div class="kpi">Actual<b>\${U==='rp'?'Rp ':''}\${fmt(ta)}\${U==='rp'?'':' krt'}</b></div><div class="kpi">Target<b>\${fmt(tt)}</b></div><div class="kpi">% Capai<b>\${pct(ta,tt)}</b></div><div class="kpi">AO<b>\${ao}\${aoT?' / '+aoT:''}</b></div>\`;
 $('note').textContent=\`Target bulanan x \${nf1.format(f)} bulan. AO = outlet unik yang order.\`;
 $('tSales').innerHTML=\`<table><tr><th>Salesman</th><th>Target</th><th>Actual</th><th>%</th><th>Gap</th><th></th><th>AO Tgt</th><th>AO</th><th>%AO</th></tr>\`+rows.map(r=>\`<tr><td>\${r.s.salesman||'-'}</td><td>\${r.tg?fmt(r.tg):'-'}</td><td>\${fmt(r.a)}</td><td>\${pct(r.a,r.tg)}</td><td class="\${cls(r.a-r.tg)}">\${r.tg?(r.a-r.tg>=0?'+':'-')+fmt(Math.abs(r.a-r.tg)):'-'}</td><td><div class="bar"><i style="width:\${Math.min(100,r.tg?r.a/r.tg*100:0)}%"></i></div></td><td>\${r.aoT||'-'}</td><td>\${r.s.ao}</td><td>\${pct(r.s.ao,r.aoT)}</td></tr>\`).join('')+\`<tr class="tot"><td>TOTAL</td><td>\${fmt(tt)}</td><td>\${fmt(ta)}</td><td>\${pct(ta,tt)}</td><td class="\${cls(ta-tt)}">\${(ta-tt>=0?'+':'-')+fmt(Math.abs(ta-tt))}</td><td></td><td>\${aoT||'-'}</td><td>\${ao}</td><td>\${pct(ao,aoT)}</td></tr></table>\`;
 $('tProg').innerHTML=D.programs.length?\`<table><tr><th>Program</th><th>Periode</th><th>Target</th><th>Actual</th><th>%</th><th>Outlet tercapai</th></tr>\`+D.programs.map(p=>{const q=(p.unit==='KRT');const F=v=>q?nf1.format(v)+' krt':'Rp '+nf.format(Math.round(v));return\`<tr><td>\${p.name}</td><td>\${p.from_d} s/d \${p.to_d}</td><td>\${F(p.target)}</td><td>\${F(p.actual)}</td><td>\${pct(p.actual,p.target)}</td><td>\${p.achieved}/\${p.outlets}</td></tr>\`}).join('')+\`</table>\`:'<div class="mut">Belum ada program.</div>';
 $('tSku').innerHTML=\`<table><tr><th>SKU</th><th>Actual</th><th>Outlet (AO)</th></tr>\`+D.skus.map(k=>\`<tr><td>\${k.sku||'-'}</td><td>\${fmt(U==='rp'?k.omset:k.qty)}</td><td>\${k.ao}</td></tr>\`).join('')+\`</table>\`;}
init();
</script></body></html>`;
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
    db.prepare("CREATE TABLE IF NOT EXISTS programs(profile TEXT NOT NULL, id TEXT NOT NULL, name TEXT, type TEXT, from_d TEXT, to_d TEXT, sku TEXT, outlets INTEGER DEFAULT 0, target REAL DEFAULT 0, actual REAL DEFAULT 0, achieved INTEGER DEFAULT 0, def TEXT, daily TEXT, updated INTEGER, PRIMARY KEY(profile, id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock(profile TEXT PRIMARY KEY, data TEXT, updated INTEGER)"),
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
    if (url.pathname === "/dash" && req.method === "GET") return new Response(DASH_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
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
        // (ringkasan daily_outlet dimatikan: belum dipakai app & boros baca baris D1)
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
      // ---- PROGRAM (trade promo dll): definisi, target, actual total & harian ----
      if (url.pathname === "/sync/programs" && req.method === "POST") {
        await ensureTables(db);
        const b = await req.json(); const p = s(b.profile), list = Array.isArray(b.programs) ? b.programs : [];
        if (!p) return J({ error: "profile wajib" }, 400);
        const now = Date.now();
        const st = [db.prepare("DELETE FROM programs WHERE profile=?").bind(p)];
        for (const g of list) st.push(db.prepare("INSERT OR REPLACE INTO programs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(p, s(g.id), s(g.name), s(g.type), s(g.from), s(g.to), s(g.sku), n(g.outlets), n(g.target), n(g.actual), n(g.achieved), s(g.def), s(g.daily), now));
        await batch(db, st);
        return J({ ok: true, saved: list.length });
      }
      if (url.pathname === "/sync/programs" && req.method === "GET") {
        await ensureTables(db);
        const r = await db.prepare("SELECT id,name,type,from_d,to_d,sku,outlets,target,actual,achieved,def,daily,updated FROM programs WHERE profile=?").bind(profile).all();
        return J({ programs: r.results || [] });
      }
      // ---- GANTI NAMA SALESMAN / GABUNG SKU langsung di cloud (tanpa kirim ulang baris) ----
      if (url.pathname === "/sync/rename" && req.method === "POST") {
        await ensureTables(db);
        const b = await req.json(); const p = s(b.profile);
        if (!p) return J({ error: "profile wajib" }, 400);
        const st = [];
        if (b.kind === "salesman") {
          const to = s(b.to).trim();
          for (const f of (Array.isArray(b.froms) ? b.froms : [])) {
            const fu = s(f).trim().toUpperCase().replace(/\s+/g, " ");
            if (!fu || !to) continue;
            for (const t of ["sales", "ro"]) st.push(db.prepare("UPDATE " + t + " SET salesman=? WHERE profile=? AND UPPER(TRIM(salesman))=?").bind(to, p, fu));
            st.push(db.prepare("DELETE FROM targets WHERE profile=? AND UPPER(TRIM(salesman))=? AND EXISTS(SELECT 1 FROM targets x WHERE x.profile=? AND UPPER(TRIM(x.salesman))=?)").bind(p, fu, p, to.toUpperCase()));
            st.push(db.prepare("UPDATE targets SET salesman=? WHERE profile=? AND UPPER(TRIM(salesman))=?").bind(to, p, fu));
          }
        } else if (b.kind === "sku") {
          for (const it of (Array.isArray(b.items) ? b.items : []))
            st.push(db.prepare("UPDATE sales SET sku_code=?, sku_name=? WHERE profile=? AND sku_code=? AND sku_name=?").bind(s(it.tc), s(it.tn), p, s(it.fc), s(it.fn)));
        } else return J({ error: "kind tidak dikenal" }, 400);
        await batch(db, st);
        return J({ ok: true, ops: st.length });
      }
      // ---- STOK SKU ----
      if (url.pathname === "/sync/stock" && req.method === "POST") {
        await ensureTables(db);
        const b = await req.json(); const p = s(b.profile);
        if (!p) return J({ error: "profile wajib" }, 400);
        await db.prepare("INSERT OR REPLACE INTO stock VALUES(?,?,?)").bind(p, JSON.stringify(Array.isArray(b.items) ? b.items : []), Date.now()).run();
        return J({ ok: true });
      }
      if (url.pathname === "/sync/stock" && req.method === "GET") {
        await ensureTables(db);
        const r = await db.prepare("SELECT data FROM stock WHERE profile=?").bind(profile).first();
        let items = []; try { items = JSON.parse((r && r.data) || "[]"); } catch (e) {}
        return J({ items });
      }
      if (url.pathname === "/sync/profiles") {
        const r = await db.prepare("SELECT profile FROM sales UNION SELECT profile FROM ro").all();
        return J({ profiles: (r.results || []).map((x) => x.profile) });
      }
      // ---- DASHBOARD WEB (read-only, tanpa baca baris mentah ke klien) ----
      if (url.pathname === "/dash/data") {
        const from = url.searchParams.get("from") || "0000-01-01", to = url.searchParams.get("to") || "9999-12-31";
        const [sa, sk, tg, pg] = await Promise.all([
          db.prepare("SELECT salesman, SUM(omset) omset, SUM(qty_karton) qty, COUNT(DISTINCT outlet_key) ao FROM sales WHERE profile=? AND tanggal>=? AND tanggal<=? AND ordered=1 GROUP BY salesman ORDER BY omset DESC").bind(profile, from, to).all(),
          db.prepare("SELECT COALESCE(NULLIF(sku_name,''),sku_code) sku, SUM(omset) omset, SUM(qty_karton) qty, COUNT(DISTINCT outlet_key) ao FROM sales WHERE profile=? AND tanggal>=? AND tanggal<=? AND ordered=1 GROUP BY 1 ORDER BY omset DESC LIMIT 30").bind(profile, from, to).all(),
          db.prepare("SELECT salesman,omset,ao,qty FROM targets WHERE profile=?").bind(profile).all(),
          db.prepare("SELECT id,name,type,from_d,to_d,sku,outlets,target,actual,achieved,def FROM programs WHERE profile=? AND from_d<=? AND to_d>=? ORDER BY name").bind(profile, to, from).all(),
        ]);
        const targets = {}; for (const t of tg.results || []) targets[t.salesman] = { omset: t.omset, ao: t.ao, qty: t.qty };
        const programs = (pg.results || []).map((p) => { let unit = "RP"; try { unit = JSON.parse(p.def || "{}").u || "RP"; } catch (e) {} return { ...p, unit, def: undefined }; });
        return J({ sales: sa.results || [], skus: sk.results || [], targets, programs });
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
