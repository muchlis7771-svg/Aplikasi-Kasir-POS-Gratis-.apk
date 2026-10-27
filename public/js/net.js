'use strict';
/* ============ jaringan, login, sinkron ============ */
function initApi() {
  AP = String(LS.get('jpos:api', '') || window.JPOS_API || '').replace(/\/$/, '');
  if (!AP && /^https?:$/.test(location.protocol) && !(location.hostname == 'localhost' && !location.port)) AP = location.origin;
}
async function api(path, opt = {}, token) {
  const h = { 'Content-Type': 'application/json' }, tk = token === undefined ? TK() : token;
  if (tk) h.Authorization = 'Bearer ' + tk;
  let r;
  try { r = await fetch(AP + path, { ...opt, headers: h, signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined }); }
  catch (e) { const er = new Error('Tidak bisa terhubung ke server'); er.net = true; throw er; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const er = new Error(j.e || 'Error ' + r.status); er.status = r.status; throw er; }
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
    while (S.eq.length) {
      const batch = S.eq.slice(0, 100), r = await post('/api/ev', { items: batch }), dn = new Set(r.done);
      S.eq = S.eq.filter((e) => !dn.has(e.no));
      if (r.rej && r.rej.length) toast('Server menolak sebagian data: ' + r.rej[0].e, 5000);
      if (!dn.size) break;
    }
    for (let more = true; more;) {
      const r = await api('/api/ev?since=' + S.ec);
      for (const e of r.items) if (apply(e)) n++;
      S.ec = r.cur; more = r.more;
    }
    await chatFlush();
    SY.state = 'ok'; SY.last = Date.now(); S.reauth = false; save();
  } catch (e) {
    SY.state = e.net ? 'off' : 'err'; SY.err = e.message;
    if (e.status == 401) { S.reauth = true; }
    else if (e.status == 403 && /suspend/i.test(e.message)) { S.locked = e.message; save(); }
  } finally { syncing = false; updBadge(); if (n) afterPull(); if (S.locked) R(); }
}
const LIVE = new Set(['dash', 'his', 'keu', 'abs', 'outlet', 'prod']);
function afterPull() { if (U && LIVE.has(V) && !$('.md') && !$('.scan') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) R(); }
function updBadge() {
  const b = $('#sy'); if (!b || !S) return;
  const q = S.eq.length;
  let t = 'Lokal', c = 'wa';
  if (S.srv) {
    if (S.reauth) { t = 'Masuk ulang'; c = 'off'; }
    else if (!navigator.onLine || SY.state == 'off') { t = 'Offline' + (q ? ' · ' + q + ' antrian' : ''); c = 'off'; }
    else if (SY.state == 'sync') { t = 'Menyinkron…'; c = 'wa'; }
    else if (SY.state == 'err') { t = 'Gagal sinkron'; c = 'wa'; }
    else { t = q ? q + ' antrian' : 'Online'; c = q ? 'wa' : 'on'; }
  }
  b.className = 'bd ' + c; b.textContent = t;
}
setInterval(() => { if (U) sync(); }, 25000);
addEventListener('online', () => { updBadge(); kick(); if (typeof R == 'function' && U) toast('Kembali online — menyinkron'); });
addEventListener('offline', () => { updBadge(); if (U) toast('Mode offline: transaksi tetap tersimpan'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && U) kick(); });

/* ---------- login & pendaftaran ---------- */
async function enterStore(id, r, pin) {
  if (!loadStore(id)) { SID = id; S = newStore(id, r.sn, '', true); }
  S.srv = true; S.name = r.sn || S.name; S.locked = ''; S.reauth = false;
  LS.set('jpos:tk:' + id, r.token); setReg(id, S.name);
  const h = await sha(id + ':' + r.name.toLowerCase() + ':' + pin);
  S.users = S.users.filter((u) => u.n.toLowerCase() != r.name.toLowerCase()); S.users.push({ n: r.name, r: r.role, h });
  U = { n: r.name, r: r.role }; LS.set('jpos:last', { id, name: r.name }); save();
  V = defView(U.r);
  if (!S.ec) { R(); $('#app').insertAdjacentHTML('afterbegin', '<div class="lo cd"><h3>Mengunduh data toko…</h3><small class="mu">Pertama kali di perangkat ini</small></div>'); }
  await sync(); R(); chatPoll(true);
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
async function registerStore(name, owner, email, pin, code) {
  let id = String(code || '').trim().toLowerCase();
  if (id && !/^[a-z0-9]{6,20}$/.test(id)) throw new Error('Kode toko: 6–20 huruf kecil/angka');
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4–8 angka');
  if (AP && navigator.onLine) {
    let down = false;
    for (let i = 0; i < 4; i++) {
      const cid = id || Math.random().toString(36).slice(2, 8).padEnd(6, 'x');
      try { const r = await post('/api/register', { id: cid, store: name, owner, email, pin }, ''); await enterStore(cid, r, pin); toast('Toko dibuat. Kode toko: ' + cid, 9000); return; }
      catch (e) { if (e.status == 409 && !id && /kode/i.test(e.message)) continue; if (e.net || e.status == 404 || e.status >= 500) { toast('Server belum aktif — toko dibuat dalam mode lokal di HP ini', 6000); down = true; break; } throw e; }
    }
    if (!down) throw new Error('Gagal membuat kode toko, coba lagi');
  }
  id = id || 'lokal' + Math.random().toString(36).slice(2, 6); // tanpa server: toko lokal
  SID = id; S = newStore(id, name, email, false);
  S.users.push({ n: owner, r: 'admin', h: await sha(id + ':' + owner.toLowerCase() + ':' + pin) });
  setReg(id, name); U = { n: owner, r: 'admin' }; V = 'dash'; save(); flushSave(); R(); toast('Toko lokal dibuat (belum terhubung server). Kode: ' + id, 7000);
}
function logout() { flushSave(); stopChat(); U = null; S = null; SID = null; V = 'dash'; R(); }
async function reauth() {
  const m = modal(`<h3>Masuk ulang</h3><small class="mu">Sesi berakhir. Masukkan PIN untuk melanjutkan sinkron.</small><input id="rp" type="password" inputmode="numeric" placeholder="PIN" autocomplete="off"><button class="pr" id="rg">Masuk</button>`);
  $('#rg', m).onclick = async () => { try { const r = await post('/api/login', { id: SID, name: U.n, pin: $('#rp', m).value }, ''); LS.set('jpos:tk:' + SID, r.token); U.r = r.role; S.reauth = false; m.close(); kick(); toast('Tersambung'); } catch (e) { toast(e.message); } };
}
const defView = (r) => (r == 'kasir' ? 'pos' : r == 'sales' ? 'dash' : 'dash');

/* ---------- Head Admin (developer) ---------- */
let HT = sessionStorage.getItem('jpos:ht') || '';
async function haLogin(user, pass) { const r = await post('/api/admin/login', { user, pass }, ''); HT = r.token; sessionStorage.setItem('jpos:ht', HT); }
const haApi = (p, o) => api(p, o || {}, HT);
