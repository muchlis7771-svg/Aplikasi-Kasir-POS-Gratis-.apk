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
    db.prepare("CREATE TABLE IF NOT EXISTS perms(kind TEXT NOT NULL, name TEXT NOT NULL, data TEXT, updated INTEGER, PRIMARY KEY(kind, name))"),
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
  // ---- HAK AKSES FITUR: dibaca tiap pengguna (token harus valid) ----
  if (url.pathname === "/usage/perm") {
    const v = await authPost("/api/verify", { token: s(b.token), device_id: s(b.device_id) });
    if (!v.ok || v.j.valid === false) return J({ ok: false, error: "sesi tidak valid" }, 401);
    const rows = (await db.prepare("SELECT kind,name,data FROM perms WHERE (kind='role' AND name=?) OR (kind='user' AND name=?)").bind(s(b.role) || "sales", s(b.username)).all()).results || [];
    let role = {}, user = {};
    for (const r of rows) { let d = {}; try { d = JSON.parse(r.data || "{}"); } catch (e) {} if (r.kind === "role") role = d; else user = d; }
    return J({ perms: { ...role, ...user }, role_default: role, user });
  }
  // ---- khusus admin ----
  if (!(await isAdmin(s(b.token)))) return J({ error: "khusus admin" }, 403);
  if (url.pathname === "/admin/perm-list") {
    const rows = (await db.prepare("SELECT kind,name,data FROM perms").all()).results || [];
    return J({ rows: rows.map(r => { let d = {}; try { d = JSON.parse(r.data || "{}"); } catch (e) {} return { kind: r.kind, name: r.name, perms: d }; }) });
  }
  if (url.pathname === "/admin/perm-set") {
    const kind = s(b.kind), name = s(b.name).trim();
    if (!["role", "user"].includes(kind) || !name) return J({ error: "kind/name tidak valid" }, 400);
    if (b.perms == null) await db.prepare("DELETE FROM perms WHERE kind=? AND name=?").bind(kind, name).run();
    else {
      const clean = {}; for (const k of Object.keys(b.perms)) clean[String(k).slice(0, 40)] = !!b.perms[k];
      await db.prepare("INSERT OR REPLACE INTO perms VALUES(?,?,?,?)").bind(kind, name, JSON.stringify(clean), Date.now()).run();
    }
    return J({ ok: true });
  }
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

// ==REPORT_HTML_BEGIN==
const REPORT_HTML = "<!doctype html>\n<html lang=\"id\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>J-DATA Report Web</title>\n<style>\n*{box-sizing:border-box}body{margin:0;font:14px/1.4 system-ui,Segoe UI,Roboto,sans-serif;background:#f3f6fb;color:#1b2a3a}\nheader{background:#0d3b6e;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;position:sticky;top:0;z-index:20}\nheader h1{font-size:17px;margin:0;flex:1}select,input,button{font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #b8c4d6}\nbutton{background:#1565c0;color:#fff;border:0;cursor:pointer}button.sec{background:#e3ebf6;color:#0d3b6e}button:disabled{opacity:.5}\nnav{display:flex;gap:6px;padding:10px 16px;overflow-x:auto;background:#fff;border-bottom:1px solid #dbe3ee;position:sticky;top:50px;z-index:15}\nnav button{background:#e3ebf6;color:#0d3b6e;white-space:nowrap}nav button.on{background:#1565c0;color:#fff}\nmain{padding:16px;max-width:1400px;margin:auto}.card{background:#fff;border-radius:12px;padding:14px;margin-bottom:14px;box-shadow:0 1px 3px #0001}\n.mut{color:#64748b;font-size:12px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}\ntable{border-collapse:collapse;width:100%}th{background:#1565c0;color:#fff;text-align:left;padding:7px 8px;cursor:pointer;white-space:nowrap;position:sticky;top:0}\ntd{padding:6px 8px;border-bottom:1px solid #edf1f7;vertical-align:top}tr:nth-child(even) td{background:#f6f8fc}tr.click{cursor:pointer}tr.click:hover td{background:#e6f0ff}\n.r{text-align:right;white-space:nowrap}.red{color:#c62828}.grn{color:#2e7d32}.wrap{overflow:auto;max-height:70vh;border-radius:8px}\n#menu{position:fixed;background:#fff;border:1px solid #9fb3cf;border-radius:10px;padding:10px;z-index:100;box-shadow:0 6px 24px #0004;width:260px;max-height:70vh;overflow:auto}\n#modal{position:fixed;inset:0;background:#0006;z-index:50;display:none;overflow:auto}#modal>div{background:#f3f6fb;margin:20px auto;max-width:1300px;border-radius:14px;padding:16px;min-height:60vh}\n.grp{border-bottom:1px solid #e1e8f2;padding:8px 0}.grp label{display:block;padding:2px 0}.tag{background:#fff3cd;border-radius:6px;padding:0 6px;font-size:11px}\n</style></head><body>\n<header><h1>J-DATA Report Web</h1><select id=\"prof\"></select><button id=\"reload\" class=\"sec\">Muat ulang</button><button id=\"cfg\" class=\"sec\">Pengaturan</button></header>\n<nav id=\"nav\"></nav><main id=\"main\"><div class=\"card\">Memuat…</div></main><div id=\"modal\"><div id=\"mbody\"></div></div><div id=\"menu\" style=\"display:none\"></div>\n<script>\nconst $=id=>document.getElementById(id);\nconst nf=new Intl.NumberFormat('id-ID',{maximumFractionDigits:0});const PCS=24;\nconst MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];\nconst DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];\nconst canon=s=>(s||'').trim().toUpperCase().replace(/\\s+/g,' ');\nconst esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\nlet CFG=JSON.parse(localStorage.getItem('jdr_cfg')||'{}');if(!CFG.url)CFG.url=location.hostname.includes('jdata-sync')?location.origin:'https://jdata-sync.muchlis7771.workers.dev';\nlet D={rows:[],ro:[],targets:[],stock:[]},tab='gap',profile='';\nasync function api(method,path,body){\n  const r=await fetch(CFG.url+path,{method,headers:{'authorization':'Bearer '+(CFG.token||''),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});\n  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}\nfunction settings(){const u=prompt('URL Worker jdata-sync:',CFG.url);if(u===null)return;const t=prompt('Token sinkron (sama dengan di aplikasi):',CFG.token||'');if(t===null)return;\n  CFG={url:u.trim().replace(/\\/$/,''),token:t.trim()};localStorage.setItem('jdr_cfg',JSON.stringify(CFG));init();}\n$('cfg').onclick=settings;$('reload').onclick=()=>loadData();\nasync function init(){\n  if(!CFG.token){$('main').innerHTML='<div class=\"card\">Isi URL & token dulu di tombol <b>Pengaturan</b> (token sama dengan yang dipakai aplikasi Android di menu Sinkron Cloud).</div>';return;}\n  try{const r=await api('GET','/sync/profiles');const ps=(r.profiles||[]).sort();$('prof').innerHTML=ps.map(p=>`<option>${esc(p)}</option>`).join('');\n    profile=localStorage.getItem('jdr_prof')||ps[0]||'';if(ps.includes(profile))$('prof').value=profile;else profile=ps[0]||'';\n    if(!profile){$('main').innerHTML='<div class=\"card\">Belum ada data di cloud. Sinkron dari aplikasi dulu.</div>';return;}await loadData();}\n  catch(e){$('main').innerHTML='<div class=\"card red\">Gagal terhubung: '+esc(e.message)+'. Cek token/URL di Pengaturan.</div>';}}\n$('prof').onchange=e=>{profile=e.target.value;localStorage.setItem('jdr_prof',profile);loadData();};\nasync function loadData(){\n  $('main').innerHTML='<div class=\"card\">Memuat data cloud… <span id=\"pg\" class=\"mut\"></span></div>';\n  const k=encodeURIComponent(profile);const d=new Date();d.setMonth(d.getMonth()-6);const from=d.toISOString().slice(0,10);\n  let rows=[],after=0;\n  for(;;){const r=await api('GET',`/sync/history?profile=${k}&from=${from}&after=${after}`);\n    for(const x of r.rows)rows.push({d:x.tanggal,ok:x.outlet_key,oid:x.outlet_id,on:x.outlet_name,s:x.salesman||'',sc:x.sku_code||'',sn:x.sku_name||'',om:+x.omset||0,q:+x.qty_karton||0,ordered:x.ordered==1});\n    $('pg')&&($('pg').textContent=rows.length+' baris');if(r.next==null)break;after=r.next;}\n  const ro=(await api('GET','/sync/ro?profile='+k)).outlets||[];\n  const tg=(await api('GET','/sync/targets?profile='+k)).targets||[];\n  let st=[];try{st=(await api('GET','/sync/stock?profile='+k)).items||[];}catch(e){}\n  D={rows,ro:ro.map(o=>({key:o.outlet_key,id:o.outlet_id,name:o.outlet_name,s:o.salesman||'',extra:safeJ(o.extra)})),targets:tg,stock:st};\n  prep();render();}\nfunction safeJ(s){try{return JSON.parse(s||'{}')}catch(e){return{}}}\nlet X={};\nfunction prep(){\n  const latest=D.rows.reduce((m,r)=>r.d>m?r.d:m,'');X.latest=latest;\n  const ym=latest.slice(0,7);const [y,m]=ym.split('-').map(Number);\n  X.months=[2,1,0].map(i=>{let mm=m-i,yy=y;while(mm<1){mm+=12;yy--}return yy+'-'+String(mm).padStart(2,'0');});\n  X.cur=X.months[2];X.mlab=X.months.map(s=>MON[+s.slice(5)-1]);\n  const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');\n  X.roByKey=new Map(D.ro.map(o=>[o.key,o]));X.roByName=new Map(D.ro.map(o=>[norm(o.name),o]));\n  for(const r of D.rows){const o=X.roByKey.get(r.ok)||X.roByName.get(norm(r.on));r.ro=o?o.key:null;r.m=r.d.slice(0,7);}\n}\nfunction wk(o){const e=o.extra||{};return e['Hari Kunjungan']||e['hari']||e['Hari']||e.visitDay||e['__hari']||'';}\nconst tabs=[['gap','Target vs Actual'],['ro','Outlet RO'],['belum','RO Belum Beli'],['sales','Nama Salesman'],['sku','Nama SKU']];\nfunction render(){\n  $('nav').innerHTML=tabs.map(([k,t])=>`<button class=\"${k===tab?'on':''}\" onclick=\"tab='${k}';render()\">${t}</button>`).join('');\n  ({gap:vGap,ro:vRo,belum:vBelum,sales:vSales,sku:vSku})[tab]();}\n/* ---------- tabel dengan filter ala Excel ---------- */\nfunction ft(el,head,rows,o={}){\n  const st={sort:-1,asc:true,ex:{},tx:{}};const left=new Set(o.left||[]);\n  function view(){let l=rows.map((r,i)=>[i,r]).filter(([i,r])=>Object.entries(st.tx).every(([c,v])=>!v||String(r[c]).toLowerCase().includes(v.toLowerCase()))&&Object.entries(st.ex).every(([c,s])=>!s.has(String(r[c]))));\n    if(st.sort>=0){const c=st.sort,n=s=>{const x=parseFloat(String(s).replace(/\\./g,'').replace(',','.'));return isNaN(x)?null:x};\n      l.sort((a,b)=>{const x=n(a[1][c]),y=n(b[1][c]);return x!=null&&y!=null?x-y:String(a[1][c]).localeCompare(String(b[1][c]))});if(!st.asc)l.reverse();}\n    if(head[0]==='No')l=l.map(([i,r],n)=>[i,[n+1,...r.slice(1)]]);return l;}\n  function draw(){const l=view();const act=st.sort>=0||Object.values(st.ex).some(s=>s.size)||Object.values(st.tx).some(v=>v);\n    let tr='';if(o.totals){const nn=s=>{const x=parseFloat(String(s).replace(/\\./g,'').replace(',','.'));return isNaN(x)||!/^[\\d.,-]+$/.test(String(s))?null:x};\n      tr='<tr>'+head.map((h,c)=>{if(c===0)return'<td><b>TOTAL</b></td>';if(h==='No'||h==='Kode')return'<td></td>';const vs=l.map(x=>x[1][c]).filter(v=>v!==''&&v!=='-');const ns=vs.map(nn);\n        return'<td class=\"r\"><b>'+(vs.length&&ns.every(v=>v!==null)?nf.format(ns.reduce((a,b)=>a+b,0)):'')+'</b></td>'}).join('')+'</tr>';}\n    el.innerHTML=`<div class=\"mut\">${l.length} dari ${rows.length} baris${act?' (filter aktif)':''} - klik judul kolom untuk filter</div><div class=\"wrap\"><table><tr>${head.map((h,i)=>`<th data-c=\"${i}\">${esc(h)} ${st.ex[i]?.size||st.tx[i]?'●':'▾'}</th>`).join('')}</tr>${tr.replace(/<td/g,'<td style=\"background:#fff3c4\"')}${l.slice(0,500).map(([i,r])=>`<tr class=\"${o.onRow?'click':''}\" data-i=\"${i}\">${r.map((v,c)=>`<td class=\"${left.has(head[c])?'':'r'} ${v==='Belum TRX'?'red':''}\">${esc(v)}</td>`).join('')}</tr>`).join('')}</table></div>${l.length>500?'<div class=\"mut\">Menampilkan 500 baris pertama; persempit dengan filter.</div>':''}<div class=\"row\"><button class=\"sec\" data-csv>Download CSV</button></div>`;\n    el.querySelectorAll('th').forEach(th=>th.onclick=e=>{e.stopPropagation();menu(th,+th.dataset.c)});\n    if(o.onRow)el.querySelectorAll('tr.click').forEach(tr=>tr.onclick=()=>o.onRow(+tr.dataset.i));\n    el.querySelector('[data-csv]').onclick=()=>{const csv=[head,...view().map(x=>x[1])].map(r=>r.map(v=>'\"'+String(v).replace(/\"/g,'\"\"')+'\"').join(',')).join('\\n');\n      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'}));a.download=(o.title||'tabel')+'.csv';a.click();};}\n  function menu(th,c){const m=$('menu');const vals=[...new Set(rows.map(r=>String(r[c])))];const exs=st.ex[c]||new Set();const chk=vals.length>=2&&vals.length<=40;\n    m.innerHTML=`<div class=\"row\"><button class=\"sec\" id=\"ma\">Urut A→Z / kecil→besar</button><button class=\"sec\" id=\"md\">Urut Z→A / besar→kecil</button></div>`+\n      (chk?vals.sort().map(v=>`<label><input type=\"checkbox\" data-v=\"${esc(v)}\" ${exs.has(v)?'':'checked'}> ${esc(v)||'(kosong)'}</label>`).join(''):`<input id=\"mt\" placeholder=\"Cari teks…\" value=\"${esc(st.tx[c]||'')}\" style=\"width:100%\">`)+\n      `<div class=\"row\"><button id=\"mo\">OK</button><button class=\"sec\" id=\"mr\">Reset</button></div>`;\n    const b=th.getBoundingClientRect();m.style.display='block';m.style.left=Math.min(b.left,innerWidth-280)+'px';m.style.top=Math.min(b.bottom,innerHeight-200)+'px';\n    $('ma').onclick=()=>{st.sort=c;st.asc=true;m.style.display='none';draw()};$('md').onclick=()=>{st.sort=c;st.asc=false;m.style.display='none';draw()};\n    $('mr').onclick=()=>{delete st.ex[c];delete st.tx[c];if(st.sort===c)st.sort=-1;m.style.display='none';draw()};\n    $('mo').onclick=()=>{if(chk){const s=new Set();m.querySelectorAll('input[data-v]').forEach(i=>{if(!i.checked)s.add(i.dataset.v)});st.ex[c]=s;}else st.tx[c]=$('mt').value;m.style.display='none';draw()};}\n  draw();}\ndocument.addEventListener('click',e=>{if(!e.target.closest('#menu')&&!e.target.closest('th'))$('menu').style.display='none'});\nconst closeM=()=>{$('modal').style.display='none'};\nfunction modal(html){$('mbody').innerHTML=`<div class=\"row\"><button class=\"sec\" onclick=\"closeM()\">← Kembali</button></div>`+html;$('modal').style.display='block';}\n/* ---------- Target vs Actual ---------- */\nfunction vGap(){\n  const months=[...new Set(D.rows.map(r=>r.m))].sort().reverse();\n  const sel=X.gm||months[0];X.gm=sel;\n  const by=new Map();\n  for(const r of D.rows){if(r.m!==sel)continue;const k=canon(r.s)||'(TANPA SALESMAN)';let e=by.get(k);if(!e)by.set(k,e={n:r.s||'(tanpa salesman)',om:0,ao:new Set()});e.om+=r.om;if(r.om!==0)e.ao.add(r.ok)}\n  const tg=new Map(D.targets.map(t=>[canon(t.salesman),t]));const roC=new Map();for(const o of D.ro)roC.set(canon(o.s),(roC.get(canon(o.s))||0)+1);\n  const names=new Set([...by.keys(),...tg.keys()]);\n  const rows=[...names].map(k=>{const e=by.get(k)||{n:tg.get(k)?.salesman||k,om:0,ao:new Set()};const t=tg.get(k);const T=t?+t.omset:0;\n    return [e.n,t?nf.format(T):'-',nf.format(e.om),T?Math.round(e.om/T*100)+'%':'-',T?nf.format(e.om-T):'-',t?nf.format(+t.ao):'-',e.ao.size,roC.get(k)||0];}).sort((a,b)=>a[0].localeCompare(b[0]));\n  $('main').innerHTML=`<div class=\"card\"><div class=\"row\"><b>Target vs Actual</b><select id=\"gm\">${months.map(m=>`<option ${m===sel?'selected':''}>${m}</option>`).join('')}</select></div><div id=\"t\"></div><div class=\"mut\">Data s/d ${X.latest}. Nama ganda (mis. HUSAIN / HUSEIN) bisa digabung di tab Nama Salesman.</div></div>`;\n  $('gm').onchange=e=>{X.gm=e.target.value;vGap()};\n  ft($('t'),['Salesman','Target Omset','Actual','%','Gap','Target AO','AO','RO'],rows,{left:['Salesman'],title:'target-vs-actual'});}\n/* ---------- Outlet RO + potensi order ---------- */\nfunction vRo(){\n  const sold=new Set(D.rows.filter(r=>r.m===X.cur&&r.om!==0&&r.ro).map(r=>r.ro));\n  const list=D.ro.filter(o=>o.extra.__baru!=='1');\n  const rows=list.map(o=>[o.s||'-',o.id||o.key,o.name,wk(o)||'-',sold.has(o.key)?'Sudah TRX':'Belum TRX']);\n  $('main').innerHTML=`<div class=\"card\"><b>Outlet RO - bulan ${X.cur}</b><div class=\"mut\">Klik outlet untuk melihat SKU potensi order.</div><div id=\"t\"></div></div>`;\n  ft($('t'),['Salesman','Kode','Nama Outlet','Hari','Status'],rows,{left:['Salesman','Kode','Nama Outlet','Hari','Status'],title:'outlet-ro',onRow:i=>ideas(list[i])});}\nfunction agg(rows){ // net per (sku,bulan,outlet)\n  const m=new Map();for(const r of rows){const sk=r.sc||r.sn.toLowerCase();const k=sk+'|'+r.m;let e=m.get(k);if(!e)m.set(k,e={q:0,o:0,n:r.sn||r.sc,c:r.sc,last:''});e.q+=r.q;e.o+=r.om;if((r.om!==0||r.q!==0)&&r.d>e.last)e.last=r.d;}return m;}\nfunction ideas(o){\n  const hist=D.rows.filter(r=>r.ro===o.key);const mi=X.months;\n  const fastMap=new Map();for(const r of D.rows){if(!mi.includes(r.m))continue;const sk=r.sc||r.sn.toLowerCase();let e=fastMap.get(sk);if(!e)fastMap.set(sk,e={n:r.sn||r.sc,c:r.sc,q:0,per:new Map()});e.q+=r.q;\n    const pk=r.ok+'|'+r.m;e.per.set(pk,(e.per.get(pk)||0)+r.q);}\n  const fast=[...fastMap.entries()].sort((a,b)=>b[1].q-a[1].q).slice(0,20).map(x=>x[0]);\n  const own=new Map();for(const r of hist){const sk=r.sc||r.sn.toLowerCase();let e=own.get(sk);if(!e)own.set(sk,e={n:r.sn||r.sc,c:r.sc,q:{},o:{},last:''});\n    e.q[r.m]=(e.q[r.m]||0)+r.q;e.o[r.m]=(e.o[r.m]||0)+r.om;if((r.om!==0||r.q!==0)&&r.d>e.last)e.last=r.d;}\n  const today=new Date(X.latest);const gap=d=>d?Math.floor((today-new Date(d))/864e5):-1;\n  const keys=[...fast];for(const [k,e] of own){if(!keys.includes(k)&&e.last&&gap(e.last)>=60)keys.push(k);}\n  const stockOf=(c,n)=>{const f=D.stock.find(s=>(c&&s.c===c)||(s.n||'').toLowerCase()===(n||'').toLowerCase());return f?+f.q:null;};\n  const rows=keys.map((k,i)=>{const e=own.get(k),fm=fastMap.get(k);const name=e?.n||fm?.n,code=e?.c||fm?.c;\n    const q=mi.map(m=>Math.max(0,(e?.q[m]||0))*PCS),om=mi.map(m=>Math.max(0,e?.o[m]||0));const q3=q.reduce((a,b)=>a+b,0),o3=om.reduce((a,b)=>a+b,0);\n    const last=e?.last||'';const ket=last&&gap(last)<60?'Sudah TRX':'Belum TRX';const st=stockOf(code,name);\n    return [i+1,name,ket,...q.map(x=>nf.format(Math.round(x))),nf.format(Math.round(q3)),nf.format(Math.round(q3/3)),...om.map(x=>nf.format(Math.round(x))),nf.format(Math.round(o3)),nf.format(Math.round(o3/3)),last||'-',st==null?'-':nf.format(st)];});\n  const head=['No','SKU','Ket',...X.mlab.map(m=>'Qty '+m),'Qty 3 bln','AVG Qty L3M',...X.mlab.map(m=>'Omset '+m),'Omset 3 bln','AVG Omset L3M','Terakhir','Stok'];\n  modal(`<div class=\"card\"><h3 style=\"margin:0\">${esc(o.name)}</h3><div class=\"mut\">${esc(o.id||o.key)} - ${esc(o.s)} - ${esc(wk(o))} | data s/d ${X.latest}</div><div class=\"mut\">20 SKU terlaris 3 bulan terakhir (semua outlet) + SKU outlet ini yang sudah ≥2 bulan tidak transaksi. Qty dalam pcs (1 karton = 24 pcs). Sudah TRX = beli dalam 2 bulan terakhir.</div><div id=\"t2\"></div></div>`);\n  ft($('t2'),head,rows,{left:['No','SKU','Ket','Terakhir','Stok'],title:'potensi-'+o.name,totals:true});}\n/* ---------- RO belum beli ---------- */\nfunction vBelum(){\n  const sm=[...new Set(D.ro.map(o=>o.s).filter(Boolean))].sort();const skuMap=new Map();\n  for(const r of D.rows){if(!X.months.includes(r.m))continue;const k=r.sc||r.sn.toLowerCase();let e=skuMap.get(k);if(!e)skuMap.set(k,e={k,n:r.sn||r.sc,q:0});e.q+=r.q;}\n  const skus=[...skuMap.values()].sort((a,b)=>b.q-a.q);\n  X.bs=X.bs||sm[0]||'';X.bk=X.bk||skus[0]?.k||'';\n  $('main').innerHTML=`<div class=\"card\"><div class=\"row\"><b>RO belum beli di bulan ${X.cur}</b><select id=\"bs\">${sm.map(s=>`<option ${s===X.bs?'selected':''}>${esc(s)}</option>`).join('')}</select><select id=\"bk\">${skus.map(s=>`<option value=\"${esc(s.k)}\" ${s.k===X.bk?'selected':''}>${esc(s.n)}</option>`).join('')}</select></div><div id=\"t\"></div></div>`;\n  $('bs').onchange=e=>{X.bs=e.target.value;vBelum()};$('bk').onchange=e=>{X.bk=e.target.value;vBelum()};\n  const outs=D.ro.filter(o=>canon(o.s)===canon(X.bs)&&o.extra.__baru!=='1');const per=new Map();\n  for(const r of D.rows){if(!r.ro||(r.sc||r.sn.toLowerCase())!==X.bk)continue;let e=per.get(r.ro);if(!e)per.set(r.ro,e={q:{},last:''});e.q[r.m]=(e.q[r.m]||0)+r.q;if((r.om!==0||r.q!==0)&&r.d>e.last)e.last=r.d;}\n  const rows=outs.map(o=>{const e=per.get(o.key)||{q:{},last:''};const q=X.months.map(m=>Math.max(0,e.q[m]||0)*PCS);return{o,q,last:e.last};})\n    .filter(x=>x.q[2]<=0).sort((a,b)=>b.q.reduce((s,v)=>s+v,0)-a.q.reduce((s,v)=>s+v,0))\n    .map(x=>[x.o.id||x.o.key,x.o.name,wk(x.o)||'-',...x.q.map(v=>nf.format(Math.round(v))),nf.format(Math.round(x.q.reduce((s,v)=>s+v,0))),x.last||'-']);\n  ft($('t'),['Kode','Nama Outlet','Hari',...X.mlab.map(m=>'Qty '+m+' (pcs)'),'Qty 3 bln','Terakhir beli'],rows,{left:['Kode','Nama Outlet','Hari','Terakhir beli'],title:'ro-belum-beli',totals:true});\n  $('t').insertAdjacentHTML('beforebegin',`<div class=\"mut\">${rows.length} dari ${outs.length} outlet RO ${esc(X.bs)} belum membeli SKU ini di bulan ${X.cur}.</div>`);}\n/* ---------- gabung nama (salesman & SKU) ---------- */\nconst lev=(a,b)=>{const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]};\nfunction groupBy(items,sim,order){const p=items.map((_,i)=>i);const f=x=>{while(p[x]!==x){p[x]=p[p[x]];x=p[x]}return x};\n  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(sim(items[i],items[j]))p[f(i)]=f(j);\n  const g=new Map();items.forEach((it,i)=>{const r=f(i);(g.get(r)||g.set(r,[]).get(r)).push(it)});return[...g.values()].filter(a=>a.length>1).map(a=>a.sort(order));}\nfunction salStats(){const m=new Map();for(const r of D.rows){const k=canon(r.s);if(!k)continue;let e=m.get(k);if(!e)m.set(k,e={name:r.s.trim(),rows:0,om:0,ro:0});e.rows++;e.om+=r.om;}\n  for(const o of D.ro){const k=canon(o.s);if(!k)continue;let e=m.get(k);if(!e)m.set(k,e={name:o.s.trim(),rows:0,om:0,ro:0});e.ro++;}\n  for(const t of D.targets){const k=canon(t.salesman);if(k&&!m.has(k))m.set(k,{name:t.salesman.trim(),rows:0,om:0,ro:0});}return[...m.values()].sort((a,b)=>b.om-a.om);}\nfunction salSim(a,b){const ta=canon(a.name).split(' '),tb=canon(b.name).split(' ');if(ta[0]===tb[0])return true;const A=canon(a.name),B=canon(b.name);\n  if(A.startsWith(B)||B.startsWith(A))return true;return ta[0].length>=4&&tb[0].length>=4&&lev(ta[0],tb[0])<=1;}\nfunction vSales(){const st=salStats();const gr=groupBy(st,salSim,(a,b)=>b.om-a.om);\n  $('main').innerHTML=`<div class=\"card\"><b>Kemungkinan nama salesman ganda (${gr.length})</b><div class=\"mut\">Pilih nama final, lalu Gabungkan. Mengubah riwayat penjualan, RO, dan target langsung di cloud. Di aplikasi Android, lakukan Sinkron Cloud (pulihkan) agar HP ikut.</div>\n  ${gr.map((g,gi)=>`<div class=\"grp\">${g.map((n,i)=>`<label><input type=\"radio\" name=\"g${gi}\" value=\"${i}\" ${i===0?'checked':''}> <b>${esc(n.name)}</b> <span class=\"mut\">${nf.format(n.rows)} baris - Rp ${nf.format(n.om)} - ${n.ro} RO</span></label>`).join('')}<button onclick=\"mergeSal(${gi})\">Gabungkan</button></div>`).join('')||'<div class=\"mut\">Tidak ada nama mirip.</div>'}</div>\n  <div class=\"card\"><b>Pilih manual</b><div class=\"mut\">Centang 2+ nama.</div>${st.map((n,i)=>`<label style=\"display:block\"><input type=\"checkbox\" class=\"ms\" value=\"${i}\"> ${esc(n.name)} <span class=\"mut\">Rp ${nf.format(n.om)} - ${n.ro} RO</span></label>`).join('')}<div class=\"row\"><input id=\"mname\" placeholder=\"Nama final\"><button onclick=\"mergeSalManual()\">Gabungkan yang dicentang</button></div></div>`;\n  X.sg=gr;X.sst=st;}\nasync function doSal(froms,to){if(!froms.length||!to)return;if(!confirm('Gabungkan '+froms.join(', ')+' menjadi '+to+'? Berlaku di cloud.'))return;\n  try{await api('POST','/sync/rename',{profile,kind:'salesman',to,froms});alert('Selesai.');await loadData();}catch(e){alert('Gagal: '+e.message+' (pastikan Worker jdata-sync sudah di-deploy versi terbaru)')}}\nfunction mergeSal(gi){const g=X.sg[gi];const sel=+document.querySelector(`input[name=g${gi}]:checked`).value;doSal(g.filter((_,i)=>i!==sel).map(n=>n.name),g[sel].name);}\nfunction mergeSalManual(){const ch=[...document.querySelectorAll('.ms:checked')].map(i=>X.sst[+i.value]);const to=$('mname').value.trim()||ch[0]?.name;if(ch.length<2)return alert('Pilih minimal 2 nama.');doSal(ch.filter(n=>canon(n.name)!==canon(to)).map(n=>n.name),to);}\nfunction skuToks(n){let s=(n||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();s=s.replace(/(\\d+)\\s+(ml|gr|g|l|kg|pcs|pc|cc)\\b/g,'$1$2').replace(/(\\d+)gr\\b/g,'$1g').replace(/(\\d+)pc\\b/g,'$1pcs');return s.split(' ').filter(Boolean)}\nfunction skuSim(a,b){if(a.code&&a.code.trim().toLowerCase()===b.code.trim().toLowerCase())return true;const ta=skuToks(a.name),tb=skuToks(b.name);if(!ta.length||!tb.length)return false;\n  const na=ta.filter(x=>/\\d/.test(x)).sort().join(),nb=tb.filter(x=>/\\d/.test(x)).sort().join();if(na!==nb)return false;\n  const wa=new Set(ta.filter(x=>!/\\d/.test(x))),wb=new Set(tb.filter(x=>!/\\d/.test(x)));const i=[...wa].filter(x=>wb.has(x)).length,u=new Set([...wa,...wb]).size;\n  if(u&&i/u>=.75)return true;const ja=[...ta].sort().join(''),jb=[...tb].sort().join('');return Math.min(ja.length,jb.length)>=8&&lev(ja,jb)<=Math.max(2,Math.floor(Math.max(ja.length,jb.length)*.12));}\nfunction skuStats(){const m=new Map();for(const r of D.rows){const k=r.sc+'|'+r.sn;let e=m.get(k);if(!e)m.set(k,e={code:r.sc,name:r.sn,rows:0,om:0,last:''});e.rows++;e.om+=r.om;if((r.om!==0||r.q!==0)&&r.d>e.last)e.last=r.d;}return[...m.values()].sort((a,b)=>b.om-a.om);}\nfunction vSku(){const st=skuStats();const gr=groupBy(st,skuSim,(a,b)=>b.last.localeCompare(a.last)||b.om-a.om);\n  $('main').innerHTML=`<div class=\"card\"><b>Kemungkinan SKU ganda (${gr.length})</b><div class=\"mut\">Saran SKU utama = yang paling baru terjual. Penggabungan mengubah riwayat penjualan & stok di cloud dan tidak bisa dipisah lagi.</div>\n  ${gr.map((g,gi)=>`<div class=\"grp\">${g.map((n,i)=>`<label><input type=\"radio\" name=\"k${gi}\" value=\"${i}\" ${i===0?'checked':''}> <b>${esc(n.name)}</b> ${i===0?'<span class=\"tag\">SARAN</span>':''} <span class=\"mut\">${n.code?'kode '+esc(n.code):'tanpa kode'} - ${nf.format(n.rows)} baris - Rp ${nf.format(n.om)} - terakhir ${n.last||'-'}</span></label>`).join('')}<button onclick=\"mergeSku(${gi})\">Satukan</button></div>`).join('')||'<div class=\"mut\">Tidak ada SKU mirip.</div>'}</div>`;X.kg=gr;}\nasync function mergeSku(gi){const g=X.kg[gi];const sel=+document.querySelector(`input[name=k${gi}]:checked`).value;const to=g[sel],froms=g.filter((_,i)=>i!==sel);\n  if(!confirm('Satukan '+froms.map(f=>f.name).join(', ')+' menjadi '+to.name+'? Tidak bisa dipisah lagi.'))return;\n  try{await api('POST','/sync/rename',{profile,kind:'sku',items:froms.map(f=>({fc:f.code,fn:f.name,tc:to.code,tn:to.name}))});\n    if(D.stock.length){const ids=new Set(froms.map(f=>f.code+'|'+f.name.toLowerCase()));const tid=to.code+'|'+to.name.toLowerCase();let sum=0,moved=0,has=false;const keep=[];\n      for(const s of D.stock){const id=(s.c||'')+'|'+(s.n||'').toLowerCase();if(ids.has(id)){sum+=+s.q;moved++}else if(id===tid){sum+=+s.q;has=true;keep.push(s)}else keep.push(s)}\n      if(moved){const out=has?keep.map(s=>((s.c||'')+'|'+(s.n||'').toLowerCase())===tid?{...s,q:sum}:s):[...keep,{c:to.code,n:to.name,q:sum}];await api('POST','/sync/stock',{profile,items:out});}}\n    alert('Selesai.');await loadData();}catch(e){alert('Gagal: '+e.message+' (pastikan Worker jdata-sync sudah di-deploy versi terbaru)')}}\ninit();\n</script></body></html>\n";
// ==REPORT_HTML_END==

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type,x-auth-token,x-device-id", "access-control-allow-methods": "GET,POST" } });
    if (url.pathname === "/health") return J({ ok: true });
    if ((url.pathname === "/report" || url.pathname === "/report/") && req.method === "GET") return new Response(REPORT_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/dash" && req.method === "GET") return new Response(DASH_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (req.method === "POST" && (url.pathname.startsWith("/usage/") || url.pathname.startsWith("/admin/"))) {
      try { return await usageRoutes(url, req, env); } catch (e) { return J({ error: String(e && e.message || e) }, 500); }
    }
    // Akun tim (sales/supervisor): baca-saja lewat sesi login yang valid (data milik admin).
    let teamOk = false;
    const xt = req.headers.get("x-auth-token");
    if (xt && req.method === "GET" && url.pathname.startsWith("/sync/") && url.pathname !== "/sync/status") {
      const v = await authPost("/api/verify", { token: xt, device_id: req.headers.get("x-device-id") || "" });
      teamOk = v.ok && v.j.valid !== false;
    }
    if (!teamOk) {
      if (!env.SYNC_TOKEN) return J({ error: "SYNC_TOKEN belum diatur di Worker" }, 500);
      if (req.headers.get("authorization") !== "Bearer " + env.SYNC_TOKEN) return J({ error: "unauthorized" }, 401);
    }
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
