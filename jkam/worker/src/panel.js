// Panel web JKam (dipakai APK Head Admin & APK Owner lewat WebView, juga bisa dibuka di browser)
export const PANEL_HTML = String.raw`<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF">
<link rel="icon" href="/logo.svg">
<title>JKam</title>
<style>
:root{
  --bg:#F4F6FB;--card:#FFFFFF;--soft:#F8FAFC;--line:#E5E8F0;--tx:#0F172A;--tx2:#334155;--mut:#64748B;
  --pri:#6D28D9;--pri-50:#F3EEFF;--pri-100:#E6DBFF;--ok:#059669;--warn:#B45309;--bad:#E11D48;
  --grad:linear-gradient(135deg,#FF8A1F 0%,#F43F72 52%,#7C3AED 100%);
  --sh:0 1px 2px rgba(15,23,42,.04),0 6px 20px rgba(15,23,42,.06);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 Inter,"Segoe UI",Roboto,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
body{min-height:100vh;padding-bottom:78px}
button,input,select{font:inherit;color:inherit}
.ico{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:middle}
.wrap{max-width:980px;margin:auto;padding:18px 16px}
.top{display:flex;align-items:center;gap:12px;padding:12px 16px;position:sticky;top:0;z-index:8;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.top img{width:36px;height:36px;border-radius:10px}
.top .t b{font-size:17px;letter-spacing:.2px}.top .t span{display:block;font-size:12px;color:var(--mut);margin-top:-3px}
.top .sp{flex:1}
.badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:5px 10px;border-radius:99px;background:var(--pri-50);color:var(--pri);letter-spacing:.3px;text-transform:uppercase}
.badge .ico{width:14px;height:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:var(--sh)}
.hero{background:var(--grad);border:none;color:#fff;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(124,58,237,.25)}
.hero:after{content:"";position:absolute;right:-50px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.14)}
.hero .lbl{font-size:13px;opacity:.9;display:flex;align-items:center;gap:6px}.hero .lbl .ico{width:16px;height:16px}
.hero .big{font-size:26px;font-weight:800;margin:4px 0 2px;letter-spacing:-.3px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(min-width:680px){.grid.g4{grid-template-columns:repeat(4,1fr)}.grid.g3{grid-template-columns:repeat(3,1fr)}}
.stat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--sh)}
.stat .v{font-size:22px;font-weight:800;letter-spacing:-.3px;margin-top:10px}.stat .l{font-size:12.5px;color:var(--mut)}
.stat .v .mut{font-size:14px;font-weight:600}
.ib{width:40px;height:40px;border-radius:12px;display:grid;place-items:center}
.c-v{background:#F3EEFF;color:#6D28D9}.c-g{background:#E7F8F1;color:#059669}.c-a{background:#FEF3E2;color:#B45309}
.c-b{background:#E8F1FE;color:#2563EB}.c-r{background:#FFE9EE;color:#E11D48}.c-s{background:#EEF2F6;color:#475569}.c-p{background:#FDEBF5;color:#DB2777}
h2{font-size:17px;margin:4px 0 12px;letter-spacing:-.2px}h3{font-size:15px;margin:0}
.sec{display:flex;align-items:center;gap:10px;margin:6px 0 12px}.sec h2{margin:0;flex:1}
.mut{color:var(--mut);font-size:13px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:none;border-radius:11px;padding:11px 16px;font-weight:650;cursor:pointer;background:var(--pri);color:#fff;transition:filter .15s,transform .05s}
.btn:active{transform:scale(.98)}.btn:hover{filter:brightness(1.06)}
.btn .ico{width:18px;height:18px}
.btn.s{padding:8px 12px;font-size:13px;border-radius:10px}
.btn.o{background:#fff;border:1px solid var(--line);color:var(--tx2)}
.btn.r{background:#FFE9EE;color:var(--bad)}.btn.k{background:#E7F8F1;color:var(--ok)}
.btn.w{width:100%}
.ic-btn{background:#fff;border:1px solid var(--line);border-radius:10px;width:38px;height:38px;display:grid;place-items:center;cursor:pointer;text-decoration:none;color:var(--tx2);flex:none}
.ic-btn .ico{width:18px;height:18px}.ic-btn.d{color:var(--bad)}
input,select{width:100%;background:#fff;border:1px solid var(--line);border-radius:11px;padding:12px 13px;outline:none;transition:border-color .15s,box-shadow .15s}
input:focus,select:focus{border-color:var(--pri);box-shadow:0 0 0 3px var(--pri-100)}
label.f{display:block;margin-bottom:12px}label.f span{display:block;font-size:12.5px;font-weight:600;color:var(--tx2);margin-bottom:6px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.row>.fx{flex:1;min-width:140px}
.list>.it{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.list>.it:first-child{border-top:none;padding-top:2px}
.av{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:14px;background:var(--pri-50);color:var(--pri);flex:none;position:relative}
.av .dot{position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;background:#CBD5E1}
.dot.on{background:#10B981}.dot.rec{background:var(--bad);animation:pulse 1.2s infinite}
@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(225,29,72,.18)}}
.it .m{flex:1;min-width:0}.it .m b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:650}
.pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:6px;letter-spacing:.3px;vertical-align:middle}
.pill .ico{width:12px;height:12px}
.p-ok{background:#E7F8F1;color:var(--ok)}.p-warn{background:#FEF3E2;color:var(--warn)}.p-bad{background:#FFE9EE;color:var(--bad)}
.bar{height:8px;border-radius:9px;background:#EEF1F6;overflow:hidden;margin:6px 0 2px}.bar i{display:block;height:100%;background:var(--grad);border-radius:9px}
.nav{position:fixed;left:0;right:0;bottom:0;display:flex;background:#fff;border-top:1px solid var(--line);padding:6px 6px calc(6px + env(safe-area-inset-bottom));z-index:9;box-shadow:0 -4px 20px rgba(15,23,42,.05)}
.nav button{flex:1;background:none;border:none;color:var(--mut);padding:6px 2px;font-size:11px;font-weight:600;cursor:pointer;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:2px}
.nav button .ico{width:22px;height:22px}
.nav button.on{color:var(--pri);background:var(--pri-50)}
@media(min-width:920px){
  body{padding-bottom:0;padding-left:232px}
  .top{margin-left:-232px;padding-left:20px}
  .nav{top:61px;right:auto;width:232px;flex-direction:column;border-top:none;border-right:1px solid var(--line);padding:14px 12px;gap:4px;box-shadow:none}
  .nav button{flex:none;flex-direction:row;gap:12px;font-size:14px;padding:11px 14px;justify-content:flex-start}
}
.pk{border:1.5px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;background:#fff;transition:border-color .15s,box-shadow .15s}
.pk:hover{border-color:var(--pri-100)}
.pk.sel{border-color:var(--pri);background:var(--pri-50);box-shadow:0 0 0 3px var(--pri-100)}
.pk .pr{font-size:20px;font-weight:800;color:var(--tx);margin:2px 0}
.pk.sm{padding:10px 12px;border-radius:12px}
.pk.sm b{font-size:13px;color:var(--mut);font-weight:700}
.pk.sm .pr{font-size:16px;margin:1px 0}
.pk.sm .d{font-size:11px;color:var(--mut);line-height:1.35}
.pkrow{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sess{margin-top:12px;border-top:1px solid var(--line);padding-top:6px}.sess .rec{display:flex;align-items:center;gap:8px;padding:6px 0}
.rec .tm{width:46px;font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums;font-weight:600}
audio{flex:1;min-width:0;height:38px}
.login{min-height:100vh;display:grid;place-items:center;padding:20px;background:
  radial-gradient(520px 320px at 100% 0,rgba(124,58,237,.12),transparent 70%),radial-gradient(420px 280px at 0 100%,rgba(244,63,114,.10),transparent 70%),var(--bg)}
.login .box{width:100%;max-width:410px}
.login .logo{width:84px;height:84px;border-radius:24px;display:block;margin:0 auto 14px;box-shadow:0 14px 40px rgba(124,58,237,.30)}
.login h1{text-align:center;margin:0;font-size:28px;letter-spacing:-.4px}
.login .sub{text-align:center;color:var(--mut);margin:2px 0 22px}
.tabs{display:flex;background:#EEF1F6;border-radius:12px;padding:4px;margin-bottom:16px}
.tabs button{flex:1;border:none;background:none;padding:9px;border-radius:9px;font-weight:650;color:var(--mut);cursor:pointer}
.tabs button.on{background:#fff;color:var(--tx);box-shadow:0 1px 3px rgba(15,23,42,.12)}
.modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:20;backdrop-filter:blur(2px)}
.modal .sheet{background:#fff;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:520px;max-height:90vh;overflow:auto;box-shadow:0 -10px 40px rgba(15,23,42,.2)}
@media(min-width:620px){.modal{align-items:center}.modal .sheet{border-radius:20px}}
.menu{display:flex;flex-direction:column;margin:4px -6px 10px}
.menu button{display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;padding:12px 10px;border-radius:12px;font-weight:600;color:var(--tx2);cursor:pointer;text-align:left}
.menu button:hover{background:var(--soft)}.menu button.d{color:var(--bad)}.menu button.k{color:var(--ok)}
.menu button .ib{width:36px;height:36px;border-radius:10px}
.toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);background:var(--tx);color:#fff;padding:10px 16px;border-radius:12px;z-index:30;box-shadow:0 10px 30px rgba(15,23,42,.25);font-weight:600;font-size:14px}
.empty{text-align:center;padding:28px 10px;color:var(--mut)}
.empty .e{width:56px;height:56px;border-radius:16px;margin:0 auto 10px;display:grid;place-items:center;background:var(--pri-50);color:var(--pri)}
.empty .e .ico{width:26px;height:26px}
.spin{width:28px;height:28px;border:3px solid var(--pri-100);border-top-color:var(--pri);border-radius:50%;margin:auto;animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
a.lnk{color:var(--pri);font-weight:650;text-decoration:none}
.hide{display:none!important}
</style></head><body>
<div id="app"></div>
<script>
const Q = new URLSearchParams(location.search);
const APP = Q.get("app") || "";                 // "headadmin" | "owner" | ""
const TK = "jkam_token_" + (APP || "web");
let TOKEN = localStorage.getItem(TK) || "";
let ME = null, TAB = "", PACKAGES = [];
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const gb = (b) => b >= 1e9 ? (b / 1e9).toFixed(2) + " GB" : (b / 1e6).toFixed(1) + " MB";
const dur = (ms) => { const s = Math.round((ms || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + " jam " + m + " mnt" : s < 60 ? s + " dtk" : m + " mnt"; };
const TZ = { timeZone: "Asia/Makassar" };
const dt = (ms) => ms ? new Date(ms).toLocaleString("id-ID", { ...TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const dshort = (ms) => ms ? new Date(ms).toLocaleDateString("id-ID", { ...TZ, day: "2-digit", month: "short", year: "numeric" }) : "-";
const hm = (ms) => new Date(ms).toLocaleTimeString("id-ID", { ...TZ, hour: "2-digit", minute: "2-digit" });
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const ago = (ms) => { if (!ms) return "belum pernah"; const m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? "baru saja" : m < 60 ? m + " mnt lalu" : m < 1440 ? Math.floor(m / 60) + " jam lalu" : Math.floor(m / 1440) + " hari lalu"; };
const daysLeft = (ms) => Math.ceil((ms - Date.now()) / 86400000);
const initials = (n) => esc(String(n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase());


// ---------- ikon garis (gaya Lucide) ----------
const IC = {
  dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  ticket:'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  building:'<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  pkg:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12M7.5 4.2l9 5.2"/>',
  mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  user:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.7V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.7"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  db:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
  live:'<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.5M7.8 16.2a6 6 0 0 1 0-8.5M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
  check:'<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  hour:'<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
  dl:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  ban:'<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  ok:'<path d="M20 6 9 17l-5-5"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  store:'<path d="m2 7 1.5-4h17L22 7M2 7h20v3a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2zM4 12v9h16v-9M9 21v-5h6v5"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  phone:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  trend:'<path d="M22 7 13.5 15.5l-5-5L2 17M16 7h6v6"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  play:'<path d="m6 3 14 9-14 9z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
};
const ic = (n, cls) => '<svg class="ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || "") + '</svg>';
const ib = (n, c) => '<div class="ib ' + c + '">' + ic(n) + '</div>';
const emptyBox = (n, t) => '<div class="empty"><div class="e">' + ic(n) + '</div>' + t + '</div>';
function actionSheet(title, items, onPick) {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = '<div class="sheet"><h2>' + esc(title) + '</h2><div class="menu">' + items.map((it) =>
    '<button data-a="' + it[0] + '" class="' + (it[3] || "") + '">' + ib(it[1], it[4] || "c-s") + '<span>' + it[2] + '</span></button>').join("") +
    '</div><button class="btn o w" data-x>Tutup</button></div>';
  m.onclick = (e) => { if (e.target === m || e.target.closest("[data-x]")) return m.remove(); const b = e.target.closest("[data-a]"); if (b) { m.remove(); onPick(b.dataset.a); } };
  document.body.appendChild(m);
}

function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
async function api(path, opt = {}) {
  const r = await fetch(path, { ...opt, headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && TOKEN) { logout(true); throw new Error(d.error); }
  if (!r.ok) { toast(d.error || "Gagal"); throw new Error(d.error); }
  return d;
}
function logout(silent) { if (TOKEN && !silent) fetch("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + TOKEN } }); TOKEN = ""; localStorage.removeItem(TK); ME = null; renderLogin(); }

function modal(title, fields, submitText, onSubmit) {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = '<div class="sheet"><h2>' + esc(title) + '</h2><form>' + fields.map((f) =>
    f.html ? f.html : '<label class="f"><span>' + esc(f.label) + '</span>' + (f.options
      ? '<select name="' + f.name + '">' + f.options.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.value) ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>'
      : '<input name="' + f.name + '" type="' + (f.type || "text") + '" value="' + esc(f.value ?? "") + '" placeholder="' + esc(f.ph || "") + '"' + (f.req === false ? "" : " required") + '>') + '</label>').join("") +
    '<div class="row" style="margin-top:6px"><button type="button" class="btn o fx" data-x>Batal</button><button class="btn fx">' + esc(submitText) + '</button></div></form></div>';
  m.onclick = (e) => { if (e.target === m || e.target.hasAttribute("data-x")) m.remove(); };
  $("form", m).onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); try { await onSubmit(v); m.remove(); } catch (_) {} };
  document.body.appendChild(m);
}
const confirmBox = (t) => window.confirm(t);

// ===================== LOGIN / DAFTAR =====================
function shell(inner) { $("#app").innerHTML = inner; }
function renderLogin(mode) {
  mode = mode || "login";
  const role = APP || (localStorage.getItem("jkam_last_role") || "owner");
  const roleName = { headadmin: "Head Admin", owner: "Owner" };
  shell('<div class="login"><div class="box">' +
    '<img class="logo" src="/logo.svg" alt="JKam"><h1>JKam</h1>' +
    '<div class="sub">' + (APP === "headadmin" ? "Panel Head Admin" : APP === "owner" ? "Panel Owner · kelola perekam Anda" : "Rekaman suara jernih 24 jam") + '</div>' +
    (!APP ? '<div class="tabs" id="rt"><button data-r="owner">Owner</button><button data-r="headadmin">Head Admin</button></div>' : "") +
    '<div class="card" id="lc"></div></div></div>');
  let cur = role;
  const draw = () => {
    if ($("#rt")) [...$("#rt").children].forEach((b) => b.classList.toggle("on", b.dataset.r === cur));
    if (mode === "register" && cur === "owner") return drawRegister();
    $("#lc").innerHTML = '<form id="lf"><label class="f"><span>Username</span><input name="username" autocomplete="username" required></label>' +
      '<label class="f"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn w">Masuk sebagai ' + roleName[cur] + '</button></form>' +
      (cur === "owner" ? '<p class="mut" style="text-align:center;margin:14px 0 0">Belum punya akun? <a href="#" id="toReg" class="lnk">Daftar & pilih paket</a></p>' : "");
    $("#lf").onsubmit = async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
      const d = await api("/api/auth/login", { method: "POST", body: { ...v, app: cur } }).catch(() => null);
      if (d) { TOKEN = d.token; localStorage.setItem(TK, TOKEN); localStorage.setItem("jkam_last_role", cur); boot(); }
    };
    const tr = $("#toReg"); if (tr) tr.onclick = (e) => { e.preventDefault(); mode = "register"; draw(); };
  };
  const drawRegister = async () => {
    if (!PACKAGES.length) PACKAGES = (await api("/api/packages")).packages;
    let pick = PACKAGES[0] && PACKAGES[0].id;
    $("#lc").innerHTML = '<h2>Daftar Owner</h2><form id="rf">' +
      '<label class="f"><span>Nama usaha / nama lengkap</span><input name="name" required></label>' +
      '<label class="f"><span>No. WhatsApp</span><input name="phone" type="tel" placeholder="08xxxxxxxxxx"></label>' +
      '<label class="f"><span>Username</span><input name="username" required placeholder="huruf kecil, tanpa spasi"></label>' +
      '<label class="f"><span>Password</span><input name="password" type="password" required minlength="6"></label>' +
      '<span class="mut">Pilih paket</span><div class="grid" id="pks" style="margin:6px 0 14px"></div>' +
      '<button class="btn w">Daftar & ajukan lisensi</button></form>' +
      '<p class="mut" style="text-align:center;margin:14px 0 0"><a href="#" id="toLog" class="lnk">Sudah punya akun? Masuk</a></p>';
    const drawPk = () => $("#pks").innerHTML = PACKAGES.map((p) => '<div class="pk' + (p.id === pick ? " sel" : "") + '" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><div class="pr">' + rp(p.price) + '</div><div class="mut">' + p.max_users + ' user · ' + p.storage_gb + ' GB · ' + p.duration_days + ' hari</div></div>').join("");
    drawPk();
    $("#pks").onclick = (e) => { const c = e.target.closest(".pk"); if (c) { pick = +c.dataset.id; drawPk(); } };
    $("#toLog").onclick = (e) => { e.preventDefault(); mode = "login"; draw(); };
    $("#rf").onsubmit = async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
      const d = await api("/api/auth/register", { method: "POST", body: { ...v, package_id: pick } }).catch(() => null);
      if (d) { TOKEN = d.token; localStorage.setItem(TK, TOKEN); toast("Pendaftaran berhasil! Menunggu aktivasi Head Admin"); boot(); }
    };
  };
  if ($("#rt")) $("#rt").onclick = (e) => { const b = e.target.closest("button"); if (b) { cur = b.dataset.r; mode = "login"; draw(); } };
  draw();
}

// ===================== LAYOUT =====================
function layout(tabs, render) {
  const roleLabel = ME.role === "headadmin" ? "Head Admin" : "Owner";
  shell('<div class="top"><img src="/logo.svg" alt=""><div class="t"><b>JKam</b><span>' + esc(ME.name || ME.username) + '</span></div><div class="sp"></div>' +
    '<button class="ic-btn" id="rf" title="Perbarui">' + ic("refresh") + '</button><span class="badge">' + ic(ME.role === "headadmin" ? "shield" : "store") + roleLabel + '</span></div>' +
    '<div class="wrap" id="pg"></div><nav class="nav">' + tabs.map((t) => '<button data-t="' + t[0] + '">' + ic(t[1]) + '<span>' + t[2] + '</span></button>').join("") + '</nav>');
  const go = (t) => { TAB = t; $("#pg").onclick = null; [...document.querySelectorAll(".nav button")].forEach((b) => b.classList.toggle("on", b.dataset.t === t)); $("#pg").innerHTML = '<div class="empty"><div class="spin"></div></div>'; render(t).catch(() => {}); scrollTo(0, 0); };
  $(".nav").onclick = (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.t); };
  window.reload = () => go(TAB);
  // Tombol perbarui manual (dengan animasi putar)
  $("#rf").onclick = () => { const s = $("#rf .ico"); s.style.transition = "transform .6s"; s.style.transform = "rotate(360deg)"; setTimeout(() => { s.style.transition = ""; s.style.transform = ""; }, 600); go(TAB); };
  // Perbarui otomatis tiap 30 dtk untuk tab ringkasan/langsung — dilewati saat ada dialog terbuka
  const autoTabs = { dash: 1, home: 1 };
  clearInterval(window._jkTimer);
  window._jkTimer = setInterval(() => { if (autoTabs[TAB] && !document.querySelector(".modal") && document.visibilityState === "visible") go(TAB); }, 30000);
  go(TAB && tabs.some((t) => t[0] === TAB) ? TAB : tabs[0][0]);
}

// ===================== REKAMAN (dipakai owner & admin) =====================
async function recordingsView(base, filters) {
  const pg = $("#pg");
  pg.innerHTML = '<div class="card"><div class="row">' + filters + '<input type="date" id="fd" class="fx" value="' + (window._fd || today()) + '"></div>' +
    '<label class="mut" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="ap" checked style="width:auto"> Putar berurutan otomatis</label></div><div id="rl"></div>';
  const load = async () => {
    window._fd = $("#fd").value;
    const q = new URLSearchParams({ date: $("#fd").value });
    pg.querySelectorAll("[data-f]").forEach((s) => s.value && q.set(s.dataset.f, s.value));
    const { recordings } = await api(base + "?" + q);
    const groups = {};
    recordings.slice().reverse().forEach((r) => { const k = r.user_id + "|" + r.session_id; (groups[k] = groups[k] || []).push(r); });
    const arr = Object.values(groups).sort((a, b) => b[0].started_at - a[0].started_at);
    if (!arr.length) { $("#rl").innerHTML = '<div class="card">' + emptyBox("mic", "Belum ada rekaman di tanggal ini") + '</div>'; return; }
    $("#rl").innerHTML = arr.map((g) => {
      const tot = g.reduce((a, r) => a + r.duration_ms, 0);
      return '<div class="card"><div class="row"><div class="av">' + initials(g[0].user_name) + '</div><div class="fx"><h3>' + esc(g[0].user_name || g[0].user_username || "User") + '</h3><div class="mut">' +
        (ME.role === "headadmin" ? esc(g[0].owner_name) + " · " : "") + hm(g[0].started_at) + ' – ' + hm(g[g.length - 1].started_at + g[g.length - 1].duration_ms) + ' · ' + dur(tot) + ' · ' + g.length + ' potongan</div></div></div><div class="sess">' +
        g.map((r) => { const src = "/api/rec/" + r.id + "/audio?token=" + encodeURIComponent(TOKEN);
          return '<div class="rec"><span class="tm">' + hm(r.started_at) + '</span><audio controls preload="none" src="' + src + '"></audio><a class="ic-btn" href="' + src + '" download="JKam-' + r.id + '.m4a" title="Unduh">' + ic("dl") + '</a><button class="ic-btn d" data-del="' + r.id + '" title="Hapus">' + ic("trash") + '</button></div>'; }).join("") +
        '</div></div>';
    }).join("");
    const auds = [...document.querySelectorAll("#rl audio")];
    auds.forEach((a, i) => { a.onplay = () => auds.forEach((b) => b !== a && b.pause()); a.onended = () => { if ($("#ap").checked && auds[i + 1]) auds[i + 1].play(); }; });
  };
  $("#rl").onclick = async (e) => { const b = e.target.closest("[data-del]"); if (b && confirmBox("Hapus potongan rekaman ini?")) { await api("/api/rec/" + b.dataset.del, { method: "DELETE" }); b.parentElement.remove(); toast("Dihapus"); } };
  pg.querySelectorAll("select,input[type=date]").forEach((s) => s.onchange = load);
  await load();
}

// ===================== OWNER =====================
async function ownerTab(t) {
  const pg = $("#pg");
  if (t === "home") {
    const s = await api("/api/owner/summary");
    if (!PACKAGES.length) PACKAGES = (await api("/api/packages")).packages;
    const L = s.license;
    const left = L ? daysLeft(L.expires_at) : 0;
    pg.innerHTML =
      '<div class="card hero"><div class="lbl">' + ic("shield") + 'Status Lisensi</div>' +
      (L ? '<div class="big">Paket ' + esc(L.package_name) + '</div><div>Aktif sampai <b>' + dshort(L.expires_at) + '</b> · sisa ' + left + ' hari</div>'
         : '<div class="big">Belum aktif</div><div>' + (s.pending ? "Pengajuan paket " + esc(s.pending.package_name) + " sedang menunggu persetujuan Head Admin." : "Ajukan paket untuk mulai merekam.") + '</div>') + '</div>' +
      (s.pending && L ? '<div class="card"><span class="pill p-warn">MENUNGGU</span> Pengajuan perpanjangan paket <b>' + esc(s.pending.package_name) + '</b> (' + rp(s.pending.price) + ') sedang diproses.</div>' : "") +
      '<div class="grid g4">' +
      '<div class="stat">' + ib("users", "c-v") + '<div class=\"v\">' + (s.users.total || 0) + (L ? '<span class="mut">/' + L.max_users + '</span>' : "") + '</div><div class="l">User perekam</div></div>' +
      '<div class="stat">' + ib("live", "c-r") + '<div class=\"v\">' + (s.users.recording || 0) + '</div><div class="l">Sedang merekam</div></div>' +
      '<div class="stat">' + ib("clock", "c-b") + '<div class=\"v\">' + dur(s.usage.ms) + '</div><div class="l">Total durasi</div></div>' +
      '<div class="stat">' + ib("db", "c-a") + '<div class=\"v\">' + gb(s.usage.bytes) + '</div><div class="l">Terpakai</div></div></div>' +
      (L ? '<div class="card" style="margin-top:14px"><div class="row"><span class="fx">Penyimpanan</span><span class="mut">' + gb(s.usage.bytes) + ' / ' + L.storage_gb + ' GB</span></div><div class="bar"><i style="width:' + Math.min(100, s.usage.bytes / (L.storage_gb * 1e7)).toFixed(1) + '%"></i></div>' +
        '<div class="row" style="margin-top:10px"><span class="fx">User</span><span class="mut">' + s.users.total + ' / ' + L.max_users + '</span></div><div class="bar"><i style="width:' + Math.min(100, s.users.total * 100 / L.max_users) + '%"></i></div></div>' : "") +
      '<div class="card" style="margin-top:14px"><div class="sec">' + ib("pkg", "c-v") + '<h2>' + (L ? "Perpanjang / Upgrade Paket" : "Pilih Paket") + '</h2></div><div class="pkrow" id="pks">' +
      PACKAGES.map((p) => '<div class="pk sm" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><div class="pr">' + rp(p.price) + '</div><div class="d">' + p.max_users + ' user · ' + p.storage_gb + ' GB · ' + p.duration_days + ' hari</div></div>').join("") +
      '</div><p class="mut" style="margin:10px 0 0">Setelah mengajukan, lakukan pembayaran & hubungi Head Admin untuk aktivasi.</p></div>' +
      '<div class="card"><div class="sec">' + ib("ticket", "c-s") + '<h2>Riwayat Lisensi</h2></div><div class="list">' + (s.history.map((h) => '<div class="it"><div class="m"><b>' + esc(h.package_name) + ' · ' + rp(h.price) + '</b><span class="mut">' + dt(h.requested_at) + (h.expires_at ? " · s/d " + dshort(h.expires_at) : "") + '</span></div>' + statusPill(h) + '</div>').join("") || '<div class="mut">-</div>') + '</div></div>';
    $("#pks").onclick = async (e) => { const c = e.target.closest(".pk"); if (!c) return; const p = PACKAGES.find((x) => x.id == c.dataset.id);
      if (confirmBox("Ajukan paket " + p.name + " (" + rp(p.price) + ")?")) { await api("/api/owner/license", { method: "POST", body: { package_id: p.id } }); toast("Pengajuan terkirim"); reload(); } };
  }
  if (t === "users") {
    const { users } = await api("/api/owner/users");
    pg.innerHTML = '<div class="row" style="margin-bottom:14px"><h2 class="fx" style="margin:0">User Perekam</h2><button class="btn s" id="add">' + ic("plus") + 'Tambah User</button></div>' +
      '<div class="card"><div class="list">' + (users.length ? users.map(userRow).join("") : '' + emptyBox("users", "Belum ada user. Tambahkan user, lalu login di aplikasi JKam User.") + '') + '</div></div>';
    $("#add").onclick = () => modal("Tambah User Perekam", [
      { label: "Nama (mis. Kasir Toko 1)", name: "name" }, { label: "Username", name: "username", ph: "huruf kecil tanpa spasi" },
      { label: "Password", name: "password", type: "text", ph: "min. 6 karakter" }], "Simpan",
      async (v) => { await api("/api/owner/users", { method: "POST", body: v }); toast("User dibuat. Login di APK JKam User: " + v.username); reload(); });
    bindUserActions("/api/owner/users/");
  }
  if (t === "rec") {
    const { users } = await api("/api/owner/users");
    await recordingsView("/api/owner/recordings", '<select data-f="user_id" class="fx"><option value="">Semua user</option>' + users.map((u) => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join("") + '</select>');
  }
  if (t === "acc") accountTab();
}
function statusPill(l) {
  if (l.status === "pending") return '<span class="pill p-warn">MENUNGGU</span>';
  if (l.status === "rejected") return '<span class="pill p-bad">DITOLAK</span>';
  return l.expires_at > Date.now() ? '<span class="pill p-ok">AKTIF</span>' : '<span class="pill p-bad">HABIS</span>';
}
function userRow(u) {
  const online = u.last_seen && Date.now() - u.last_seen < 10 * 60000;
  const rec = online && u.is_recording;
  return '<div class="it"><div class="av">' + initials(u.name) + '<span class="dot ' + (rec ? "rec" : online ? "on" : "") + '"></span></div><div class="m"><b>' + esc(u.name) +
    (u.status === "suspended" ? '<span class="pill p-bad">NONAKTIF</span>' : rec ? '<span class="pill p-bad">' + ic("live", "") + 'REKAM</span>' : "") + '</b><span class="mut">@' + esc(u.username) + ' · ' + ago(u.last_seen) + ' · ' + dur(u.ms) + (u.device_info ? " · " + esc(u.device_info) : "") + '</span></div>' +
    '<button class="btn o s" data-u="' + u.id + '" data-st="' + u.status + '" data-n="' + esc(u.name) + '">' + ic("more") + '</button></div>';
}
function bindUserActions(base) {
  $("#pg").onclick = (e) => {
    const b = e.target.closest("[data-u]"); if (!b) return;
    const id = b.dataset.u, act = b.dataset.st === "active";
    actionSheet(b.dataset.n, [["start", "mic", "Minta mulai rekam", "", "c-p"], ["stop", "x", "Minta stop rekam", "", "c-a"], ["pw", "key", "Reset password", "", "c-v"], ["st", act ? "ban" : "check", act ? "Nonaktifkan user" : "Aktifkan user", act ? "d" : "k", act ? "c-r" : "c-g"], ["del", "trash", "Hapus user", "d", "c-r"]], async (a) => {
      if (a === "start") { await api(base + id + "/command", { method: "POST", body: { action: "start" } }); toast("Permintaan mulai dikirim ke HP user"); }
      if (a === "stop") { await api(base + id + "/command", { method: "POST", body: { action: "stop" } }); toast("Permintaan stop dikirim ke HP user"); }
      if (a === "pw") modal("Reset Password", [{ label: "Password baru", name: "password", ph: "min. 6 karakter" }], "Simpan", async (v) => { await api(base + id, { method: "PATCH", body: v }); toast("Password diubah"); });
      if (a === "st") { await api(base + id, { method: "PATCH", body: { status: act ? "suspended" : "active" } }); reload(); }
      if (a === "del" && confirmBox("Hapus user ini? Rekamannya tetap tersimpan.")) { await api(base + id, { method: "DELETE" }); reload(); }
    });
  };
}
function accountTab() {
  $("#pg").innerHTML = '<div class="card" style="text-align:center"><img src="/logo.svg" style="width:68px;border-radius:18px"><h2 style="margin:10px 0 0">' + esc(ME.name) + '</h2><div class="mut">@' + esc(ME.username) + '</div></div>' +
    '<div class="card"><div class="sec">' + ib("lock", "c-v") + '<h2>Ubah Password</h2></div><form id="pf"><label class="f"><span>Password lama</span><input name="old_password" type="password" required></label><label class="f"><span>Password baru</span><input name="new_password" type="password" minlength="6" required></label><button class="btn w">Simpan</button></form></div>' +
    '<button class="btn r w" id="lo">' + ic("out") + 'Keluar</button>';
  $("#pf").onsubmit = async (e) => { e.preventDefault(); await api("/api/auth/password", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }).then(() => { toast("Password diubah"); e.target.reset(); }).catch(() => {}); };
  $("#lo").onclick = () => confirmBox("Keluar dari JKam?") && logout();
}

// ===================== HEAD ADMIN =====================
async function adminTab(t) {
  const pg = $("#pg");
  if (t === "dash") {
    const s = await api("/api/admin/summary");
    pg.innerHTML = '<div class="card hero"><div class="lbl">' + ic("wallet") + 'Pendapatan lisensi 30 hari</div><div class="big">' + rp(s.revenue_30d) + '</div><div>' + s.active_owners + ' owner aktif dari ' + s.owners + ' terdaftar</div></div>' +
      '<div class="grid g3">' +
      stat("building", s.owners, "Owner terdaftar", "c-v") + stat("check", s.active_owners, "Lisensi aktif", "c-g") + stat("hour", s.pending, "Menunggu aktivasi", "c-a") +
      stat("users", s.users, "User perekam", "c-b") + stat("live", s.recording_now, "Sedang merekam", "c-r") + stat("db", gb(s.recordings.bytes), "Penyimpanan", "c-s") +
      stat("mic", s.recordings.files, "Potongan rekaman", "c-p") + stat("clock", dur(s.recordings.ms), "Total durasi", "c-b") + stat("trend", s.owners ? Math.round(s.active_owners * 100 / s.owners) + "%" : "0%", "Rasio owner aktif", "c-g") + '</div>' +
      (s.pending ? '<button class="btn w" style="margin-top:14px" onclick="document.querySelector(\'[data-t=lic]\').click()">' + ic("ticket") + 'Proses ' + s.pending + ' pengajuan lisensi</button>' : "");
  }
  if (t === "lic") {
    const [{ licenses: pend }, { licenses: all }] = await Promise.all([api("/api/admin/licenses?status=pending"), api("/api/admin/licenses")]);
    pg.innerHTML = '<div class="sec">' + ib("hour", "c-a") + '<h2>Menunggu Aktivasi</h2></div><div class="card"><div class="list">' + (pend.length ? pend.map((l) =>
      '<div class="it"><div class="av">' + initials(l.owner_name) + '</div><div class="m"><b>' + esc(l.owner_name) + '</b><span class="mut">@' + esc(l.owner_username) + (l.owner_phone ? " · " + esc(l.owner_phone) : "") + '<br>Paket ' + esc(l.package_name) + ' · ' + rp(l.price) + ' · ' + l.duration_days + ' hari · ' + dt(l.requested_at) + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn k s" data-ap="' + l.id + '" data-d="' + l.duration_days + '">' + ic("ok") + 'Setujui</button><button class="btn r s" data-rj="' + l.id + '">' + ic("x") + 'Tolak</button></div></div>').join("") : '' + emptyBox("check", "Tidak ada pengajuan baru") + '') + '</div></div>' +
      '<div class="sec">' + ib("ticket", "c-s") + '<h2>Riwayat Lisensi</h2></div><div class="card"><div class="list">' + all.filter((l) => l.status !== "pending").map((l) =>
      '<div class="it"><div class="m"><b>' + esc(l.owner_name) + ' · ' + esc(l.package_name) + '</b><span class="mut">' + rp(l.price) + (l.expires_at ? " · " + dshort(l.starts_at) + " – " + dshort(l.expires_at) : "") + (l.note ? " · " + esc(l.note) : "") + '</span></div>' + statusPill(l) + '</div>').join("") + '</div></div>';
    pg.onclick = async (e) => {
      const a = e.target.closest("[data-ap]"), r = e.target.closest("[data-rj]");
      if (a) modal("Setujui Lisensi", [{ label: "Masa aktif (hari)", name: "days", type: "number", value: a.dataset.d }, { label: "Catatan (opsional)", name: "note", req: false, ph: "mis. lunas transfer BCA" }], "Aktifkan",
        async (v) => { await api("/api/admin/licenses/" + a.dataset.ap + "/approve", { method: "POST", body: { days: +v.days, note: v.note } }); toast("Lisensi aktif"); reload(); });
      if (r) modal("Tolak Lisensi", [{ label: "Alasan", name: "note", req: false }], "Tolak",
        async (v) => { await api("/api/admin/licenses/" + r.dataset.rj + "/reject", { method: "POST", body: v }); reload(); });
    };
  }
  if (t === "own") {
    const { owners } = await api("/api/admin/owners");
    if (!PACKAGES.length) PACKAGES = (await api("/api/admin/packages")).packages;
    pg.innerHTML = '<div class="row" style="margin-bottom:12px"><h2 class="fx" style="margin:0">Semua Owner</h2><input id="q" placeholder="Cari…" style="max-width:180px"></div><div class="card"><div class="list" id="ol">' +
      (owners.length ? owners.map((o) => {
        const act = o.expires_at && o.expires_at > Date.now();
        return '<div class="it" data-s="' + esc((o.name + " " + o.username).toLowerCase()) + '"><div class="av">' + initials(o.name) + '<span class="dot ' + (o.recording_now ? "rec" : act ? "on" : "") + '"></span></div><div class="m"><b>' + esc(o.name) +
          (o.status === "suspended" ? '<span class="pill p-bad">SUSPEND</span>' : act ? '<span class="pill p-ok">' + esc(o.package_name) + '</span>' : '<span class="pill p-warn">' + (o.pending ? "MENUNGGU" : "TIDAK AKTIF") + '</span>') + '</b>' +
          '<span class="mut">@' + esc(o.username) + (o.phone ? " · " + esc(o.phone) : "") + '<br>' + o.user_count + ' user · ' + (o.recording_now ? o.recording_now + " merekam · " : "") + gb(o.bytes) + (o.expires_at ? " · s/d " + dshort(o.expires_at) : "") + '</span></div>' +
          '<button class="btn o s" data-o="' + o.id + '" data-st="' + o.status + '" data-n="' + esc(o.name) + '">' + ic("more") + '</button></div>';
      }).join("") : '' + emptyBox("building", "Belum ada owner terdaftar") + '') + '</div></div><div id="ou"></div>';
    $("#q").oninput = (e) => document.querySelectorAll("#ol .it").forEach((r) => r.classList.toggle("hide", !r.dataset.s.includes(e.target.value.toLowerCase())));
    $("#ol").onclick = (e) => {
      const b = e.target.closest("[data-o]"); if (!b) return;
      const id = b.dataset.o, act = b.dataset.st === "active";
      actionSheet(b.dataset.n, [["grant", "cal", "Beri / perpanjang lisensi", "", "c-v"], ["users", "users", "Lihat user perekam", "", "c-b"], ["rec", "mic", "Lihat rekaman", "", "c-p"], ["pw", "key", "Reset password", "", "c-s"],
        ["st", act ? "ban" : "check", act ? "Suspend owner" : "Aktifkan owner", act ? "d" : "k", act ? "c-r" : "c-g"], ["del", "trash", "Hapus owner & semua datanya", "d", "c-r"]], async (a) => {
          if (a === "grant") modal("Beri Lisensi", [{ label: "Paket", name: "package_id", options: PACKAGES.map((p) => [p.id, p.name + " · " + rp(p.price)]) }, { label: "Masa aktif (hari)", name: "days", type: "number", value: 30 }], "Aktifkan",
            async (v) => { await api("/api/admin/owners/" + id + "/grant", { method: "POST", body: { package_id: +v.package_id, days: +v.days } }); toast("Lisensi diberikan"); reload(); });
          if (a === "pw") modal("Reset Password Owner", [{ label: "Password baru", name: "password" }], "Simpan", async (v) => { await api("/api/admin/owners/" + id, { method: "PATCH", body: v }); toast("Password diubah"); });
          if (a === "st") { await api("/api/admin/owners/" + id, { method: "PATCH", body: { status: act ? "suspended" : "active" } }); reload(); }
          if (a === "del" && confirmBox("HAPUS owner beserta semua user & rekamannya? Tidak bisa dibatalkan.")) { await api("/api/admin/owners/" + id, { method: "DELETE" }); toast("Owner dihapus"); reload(); }
          if (a === "users") { const { users } = await api("/api/admin/owners/" + id + "/users"); $("#ou").innerHTML = '<h2>User milik ' + esc(b.dataset.n) + '</h2><div class="card"><div class="list">' + (users.map(userRow).join("") || '<div class="mut">Belum ada user</div>') + '</div></div>'; $("#ou").scrollIntoView({ behavior: "smooth" }); }
          if (a === "rec") { window._ow = id; document.querySelector("[data-t=rec]").click(); }
      });
    };
    bindUserActions("/api/admin/users/");
  }
  if (t === "pkg") {
    const { packages } = await api("/api/admin/packages"); PACKAGES = packages;
    pg.innerHTML = '<div class="row" style="margin-bottom:12px"><h2 class="fx" style="margin:0">Paket & Harga</h2><button class="btn s" id="np">' + ic("plus") + 'Paket</button></div>' +
      '<div class="grid">' + packages.map((p) => '<div class="pk" data-p="' + p.id + '" style="' + (p.active ? "" : "opacity:.5") + '"><b>' + esc(p.name) + (p.active ? "" : " (nonaktif)") + '</b><div class="pr">' + rp(p.price) + '</div><div class="mut">' + p.max_users + ' user · ' + p.storage_gb + ' GB · ' + p.duration_days + ' hari</div><div class="mut">' + esc(p.description) + '</div></div>').join("") + '</div>';
    const form = (p = {}) => [{ label: "Nama paket", name: "name", value: p.name }, { label: "Harga (Rp)", name: "price", type: "number", value: p.price ?? 0 },
      { label: "Maks. user perekam", name: "max_users", type: "number", value: p.max_users ?? 3 }, { label: "Penyimpanan (GB)", name: "storage_gb", type: "number", value: p.storage_gb ?? 10 },
      { label: "Masa aktif (hari)", name: "duration_days", type: "number", value: p.duration_days ?? 30 }, { label: "Keterangan", name: "description", value: p.description, req: false },
      { label: "Status", name: "active", options: [[1, "Aktif (tampil untuk owner)"], [0, "Nonaktif"]], value: p.active ?? 1 }];
    const num = (v) => ({ ...v, price: +v.price, max_users: +v.max_users, storage_gb: +v.storage_gb, duration_days: +v.duration_days, active: +v.active });
    $("#np").onclick = () => modal("Paket Baru", form(), "Simpan", async (v) => { await api("/api/admin/packages", { method: "POST", body: num(v) }); reload(); });
    pg.querySelectorAll("[data-p]").forEach((c) => c.onclick = () => { const p = packages.find((x) => x.id == c.dataset.p); modal("Edit " + p.name, form(p), "Simpan", async (v) => { await api("/api/admin/packages/" + p.id, { method: "PATCH", body: num(v) }); reload(); }); });
  }
  if (t === "rec") {
    const { owners } = await api("/api/admin/owners");
    await recordingsView("/api/admin/recordings", '<select data-f="owner_id" class="fx"><option value="">Semua owner</option>' + owners.map((o) => '<option value="' + o.id + '"' + (window._ow == o.id ? " selected" : "") + '>' + esc(o.name) + '</option>').join("") + '</select>');
    window._ow = null;
  }
  if (t === "acc") accountTab();
}
const stat = (i, v, l, c) => '<div class="stat">' + ib(i, c || "c-v") + '<div class="v">' + v + '</div><div class="l">' + l + '</div></div>';

// ===================== BOOT =====================
async function boot() {
  if (!TOKEN) return renderLogin();
  try { ME = (await api("/api/me")).account; } catch (_) { return; }
  if (APP && ME.role !== APP) return logout(true);
  if (ME.role === "headadmin") layout([["dash", "dash", "Dashboard"], ["lic", "ticket", "Lisensi"], ["own", "building", "Owner"], ["pkg", "pkg", "Paket"], ["rec", "mic", "Rekaman"], ["acc", "user", "Akun"]], adminTab);
  else if (ME.role === "owner") layout([["home", "home", "Beranda"], ["users", "users", "User"], ["rec", "mic", "Rekaman"], ["acc", "user", "Akun"]], ownerTab);
  else { shell('<div class="login"><div class="box" style="text-align:center"><img class="logo" src="/logo.svg"><h1>JKam User</h1><p class="sub">Akun user dipakai di aplikasi <b>JKam User</b> untuk merekam.</p><button class="btn" onclick="logout()">Keluar</button></div></div>'); }
}
boot();
</script></body></html>`;
