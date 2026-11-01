'use strict';
/* ============ jaringan, login, sinkron ============ */
const API_SET = () => [window.JPOS_API, ...(window.JPOS_API_ALT || [])].filter(Boolean).map((x) => String(x).replace(/\/$/, ''));
const apiCustom = () => { const c = String(LS.get('jpos:api', '') || '').replace(/\/$/, ''); return c && !API_SET().includes(c) ? c : ''; };
function initApi() {
  const auto = String(LS.get('jpos:apiAuto', '') || ''); AP = apiCustom() || (API_SET().includes(auto) ? auto : '') || String(window.JPOS_API || '').replace(/\/$/, '');
  if (!AP && /^https?:$/.test(location.protocol) && !(location.hostname == 'localhost' && !location.port)) AP = location.origin;
}
// pindah otomatis ke alamat server lain yang aktif (alamat utama / cadangan)
let apiSw = 0;
async function apiSwitch() {
  if (apiCustom() || Date.now() - apiSw < 20000) return false; apiSw = Date.now();
  for (const u of API_SET()) { if (u == AP) continue; try { const r = await fetch(u + '/api/ping', { signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined }); const j = await r.json(); if (r.ok && j.ok) { AP = u; LS.set('jpos:apiAuto', u); return true; } } catch (e) { } }
  return false;
}
async function api(path, opt = {}, token, again) {
  const h = { 'Content-Type': 'application/json' }, tk = token === undefined ? TK() : token;
  if (tk) h.Authorization = 'Bearer ' + tk;
  let r;
  try { r = await fetch(AP + path, { ...opt, headers: h, signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined }); }
  catch (e) { if (!again && navigator.onLine !== false && (await apiSwitch())) return api(path, opt, token, 1); const er = new Error('Tidak bisa terhubung ke server'); er.net = true; throw er; }
  const ct = r.headers.get('content-type') || '';
  if (r.status == 404 && !/json/.test(ct) && !again && (await apiSwitch())) return api(path, opt, token, 1);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const er = new Error(j.e || (r.status == 404 ? 'Server belum aktif (404)' : 'Error ' + r.status)); er.status = r.status; er.body = j; throw er; }
  return j;
}
const post = (p, b, t) => api(p, { method: 'POST', body: JSON.stringify(b) }, t);
const canNet = () => !!AP && navigator.onLine;

/* ---------- sinkron: kirim antrian, tarik kejadian baru ---------- */
const SY = { state: 'idle', last: 0, err: '' };
let syncing = false, kt = null;
function kick() { clearTimeout(kt); kt = setTimeout(sync, 700); }
async function sync() {
  if (syncing || !S || !S.srv || !canNet() || !TK() || S.locked) return;
  syncing = true; SY.state = 'sync'; updBadge(); let n = 0;
  try {
    while (S.eq.length && !isExp()) {
      const batch = S.eq.slice(0, 100), r = await post('/api/ev', { items: batch }), dn = new Set(r.done); stApply(r.st);
      S.eq = S.eq.filter((e) => !dn.has(e.no));
      if (r.rej && r.rej.length) toast('Server menolak sebagian data: ' + r.rej[0].e, 5000);
      if (!dn.size) break;
    }
    for (let more = true; more;) {
      const r = await api('/api/ev?since=' + S.ec);
      for (const e of r.items) if (apply(e)) n++;
      S.ec = r.cur; more = r.more; stApply(r.st);
      if (r.role && U && r.role != U.r) { U.r = r.role; const me = S.users.find((x) => x.n == U.n); if (me) me.r = r.role; n++; }
    }
    await chatFlush();
    SY.state = 'ok'; SY.last = Date.now(); S.reauth = false; save();
    if (typeof publishCatalog == 'function') publishCatalog();
  } catch (e) {
    SY.state = e.net ? 'off' : 'err'; SY.err = e.message;
    if (e.status == 401) { S.reauth = true; }
    else if (e.status == 402) { stApply(e.body); SY.state = 'exp'; }
    else if (e.status == 403 && /suspend/i.test(e.message)) { S.locked = e.message; save(); }
  } finally { syncing = false; updBadge(); if (n) afterPull(); if (S && S.locked) R(); }
}
const LIVE = new Set(['dash', 'his', 'keu', 'abs', 'outlet', 'prod', 'kirim', 'kas', 'beli', 'aud']);
function afterPull() { if (U && LIVE.has(V) && !$('.md') && !$('.scan') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) R(); }
function updBadge() {
  const b = $('#sy'); if (!b || !S) return;
  const q = S.eq.length;
  let t = 'Lokal', c = 'wa';
  if (S.srv) {
    if (S.reauth) { t = 'Masuk ulang'; c = 'off'; }
    else if (!navigator.onLine || SY.state == 'off') { t = 'Offline' + (q ? ' · ' + q + ' antrian' : ''); c = 'off'; }
    else if (SY.state == 'sync') { t = 'Menyinkron…'; c = 'wa'; }
    else if (isExp() || SY.state == 'exp') { t = 'Masa aktif habis'; c = 'off'; }
    else if (SY.state == 'err') { t = 'Gagal sinkron'; c = 'wa'; }
    else { t = q ? q + ' antrian' : 'Online'; c = q ? 'wa' : 'on'; }
  }
  b.className = 'bd ' + c; b.textContent = t;
}
setInterval(() => { if (U) sync(); }, 25000);
addEventListener('online', () => { updBadge(); kick(); if (typeof R == 'function' && U) toast('Kembali online — menyinkron'); });
addEventListener('offline', () => { updBadge(); if (U) toast('Mode offline: transaksi tetap tersimpan'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && U) kick(); });

// status toko dari server: masa aktif, paket, nama
function stApply(st) { if (!st || !S) return; const was = isExp(); if (st.exp != null) S.exp = +st.exp || 0; if (st.plan) S.plan = st.plan; if (st.sn) S.name = st.sn; if (st.tier) { S.tier = st.tier; S.tn = st.tn; S.pf = st.pf; S.lim = st.lim; S.pm = st.pm || {}; } save(); if (U && was != isExp()) setTimeout(R, 0); }
// info pemilik aplikasi (WA & harga) — disimpan agar tampil juga saat offline
async function appInfo() { try { const r = await api('/api/info', {}, ''); LS.set('jpos:info', r); return r; } catch (e) { return LS.get('jpos:info', { wa: '', price: '', trial: 30 }); } }

/* ---------- login & pendaftaran ---------- */
async function enterStore(id, r, pin) {
  if (!loadStore(id)) { SID = id; S = newStore(id, r.sn, '', true); }
  S.srv = true; S.name = r.sn || S.name; S.locked = ''; S.reauth = false; stApply(r);
  LS.set('jpos:tk:' + id, r.token); setReg(id, S.name);
  const h = await sha(id + ':' + r.name.toLowerCase() + ':' + pin);
  S.users = S.users.filter((u) => u.n.toLowerCase() != r.name.toLowerCase()); S.users.push({ n: r.name, r: r.role, h });
  U = { n: r.name, r: r.role }; LS.set('jpos:last', { id, name: r.name }); save();
  V = defView(U.r);
  if (!S.ec) { R(); $('#app').insertAdjacentHTML('afterbegin', '<div class="lo cd"><h3>Mengunduh data toko…</h3><small class="mu">Pertama kali di perangkat ini</small></div>'); }
  await sync(); R(); window.scrollTo(0, 0); chatPoll(true); hb('login'); setTimeout(() => { try { rptLoad(); snapPost(true); if (U.r == 'owner') mitLoad().then(() => dsnapPost(true)); else dsnapPost(); } catch (e) { } }, 2500); if (typeof pollOrders == 'function') { ONL.seen = -1; pollOrders(); }
}
async function loginOnline(id, name, pin) { const r = await post('/api/login', { id, name, pin }, ''); await enterStore(id, r, pin); }
async function loginLocal(id, name, pin) {
  if (!loadStore(id)) throw new Error('Toko belum pernah dibuka di perangkat ini. Login pertama butuh internet.');
  const u = S.users.find((x) => x.n.toLowerCase() == name.toLowerCase());
  const ok = u && (u.pin ? u.pin == pin : u.h == (await sha(id + ':' + u.n.toLowerCase() + ':' + pin)));
  if (!ok) throw new Error('Nama atau PIN salah');
  U = { n: u.n, r: u.r }; V = defView(U.r); LS.set('jpos:last', { id, name: u.n }); R(); chatPoll(true);
}
async function doLogin(id, name, pin) {
  id = String(id || '').trim().toLowerCase(); name = String(name || '').trim();
  if (!id || !name || !pin) throw new Error('Isi kode toko, nama, dan PIN');
  const known = LS.get('jpos:s:' + id, null), local = known && !known.srv; // toko lokal/demo tidak lewat server
  if (!local && canNet()) {
    try { return await loginOnline(id, name, pin); } catch (e) { if (!e.net) throw e; if (!known) throw e; }
  }
  return loginLocal(id, name, pin);
}
async function registerStore(name, owner, email, pin, code, phone) {
  let id = String(code || '').trim().toLowerCase();
  if (id && !/^[a-z0-9]{6,20}$/.test(id)) throw new Error('Kode toko: 6–20 huruf kecil/angka');
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4–8 angka');
  if (AP && navigator.onLine) {
    let down = false;
    for (let i = 0; i < 4; i++) {
      const cid = id || Math.random().toString(36).slice(2, 8).padEnd(6, 'x');
      try { const r = await post('/api/register', { id: cid, store: name, owner, email, pin, phone, tier: typeof regTier != 'undefined' ? regTier : undefined }, ''); await enterStore(cid, r, pin); toast('Toko dibuat. Kode toko: ' + cid, 9000); return; }
      catch (e) { if (e.status == 409 && !id && /kode/i.test(e.message)) continue; if (e.net || e.status == 404 || e.status >= 500) { toast('Server belum aktif — toko dibuat dalam mode lokal di HP ini', 6000); down = true; break; } throw e; }
    }
    if (!down) throw new Error('Gagal membuat kode toko, coba lagi');
  }
  id = id || 'lokal' + Math.random().toString(36).slice(2, 6); // tanpa server: toko lokal
  SID = id; S = newStore(id, name, email, false);
  S.users.push({ n: owner, r: 'owner', h: await sha(id + ':' + owner.toLowerCase() + ':' + pin) }); S.exp = Date.now() + 30 * 864e5; S.plan = 'trial';
  setReg(id, name); U = { n: owner, r: 'owner' }; V = 'dash'; save(); flushSave(); R(); toast('Toko lokal dibuat (belum terhubung server). Kode: ' + id, 7000);
}
function logout() { flushSave(); stopChat(); U = null; S = null; SID = null; V = 'dash'; R(); }
async function reauth() {
  const m = modal(`<h3>Masuk ulang</h3><small class="mu">Sesi berakhir. Masukkan PIN untuk melanjutkan sinkron.</small><input id="rp" type="password" inputmode="numeric" placeholder="PIN" autocomplete="off"><button class="pr" id="rg">Masuk</button>`);
  $('#rg', m).onclick = async () => { try { const r = await post('/api/login', { id: SID, name: U.n, pin: $('#rp', m).value }, ''); LS.set('jpos:tk:' + SID, r.token); U.r = r.role; S.reauth = false; m.close(); kick(); toast('Tersambung'); } catch (e) { toast(e.message); } };
}
const defView = (r) => 'dash';

/* ---------- Head Admin (developer) ---------- */
let HT = sessionStorage.getItem('jpos:ht') || '';
async function haLogin(user, pass) { const r = await post('/api/admin/login', { user, pass }, ''); HT = r.token; sessionStorage.setItem('jpos:ht', HT); }
const haApi = (p, o) => api(p, o || {}, HT);
