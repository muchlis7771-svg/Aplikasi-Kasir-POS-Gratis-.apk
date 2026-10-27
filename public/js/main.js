'use strict';
/* ============ shell, layar awal, boot ============ */
const NAV = {
  admin: [['dash', 'Beranda'], ['pos', 'Kasir'], ['his', 'Riwayat'], ['prod', 'Produk'], ['outlet', 'Outlet'], ['lap', 'Laporan'], ['keu', 'Akuntansi'], ['jur', 'Jurnal'], ['abs', 'Absensi'], ['chat', 'Chat'], ['usr', 'Pengguna'], ['set', 'Pengaturan']],
  akuntan: [['dash', 'Beranda'], ['his', 'Riwayat'], ['prod', 'Produk'], ['outlet', 'Outlet'], ['lap', 'Laporan'], ['keu', 'Akuntansi'], ['jur', 'Jurnal'], ['abs', 'Absensi'], ['chat', 'Chat'], ['set', 'Pengaturan']],
  kasir: [['pos', 'Kasir'], ['dash', 'Beranda'], ['his', 'Riwayat'], ['abs', 'Absensi'], ['chat', 'Chat'], ['set', 'Pengaturan']],
  sales: [['dash', 'Beranda'], ['outlet', 'Outlet'], ['pos', 'Order'], ['his', 'Riwayat'], ['abs', 'Absensi'], ['chat', 'Chat'], ['set', 'Pengaturan']],
};
let MODE = 'home';
function go(v) { V = v; R(); window.scrollTo(0, 0); }
function mode(m) { MODE = m; R(); }

function R() {
  const app = $('#app'); if (!app) return;
  if (HT && MODE == 'ha') { app.innerHTML = haShell(); return; }
  if (!U || !S) { app.innerHTML = homeView(); return; }
  if (!NAV[U.r].some((n) => n[0] == V)) V = defView(U.r);
  let body;
  try { body = (VW[V] || (() => '<p>Halaman tidak ditemukan</p>'))(); } catch (e) { console.error(e); body = `<div class="cd"><h3>Terjadi kesalahan</h3><p class="rd">${esc(e.message)}</p></div>`; }
  const banner = S.locked ? `<div class="cd" style="border-color:var(--rd)"><b class="rd">⛔ ${esc(S.locked)}</b><br><small class="mu">Hubungi pengembang aplikasi. Data di perangkat ini tetap aman.</small></div>` : S.reauth ? `<div class="cd" style="border-color:var(--or)"><b>Sesi sinkron berakhir.</b> <button class="gh a" onclick="reauth()">Masuk ulang</button></div>` : '';
  app.innerHTML = `<header>${S.logo ? `<img src="${esc(S.logo)}" alt="">` : ''}<span class="lg1">${esc(S.name)}</span><span class="sp"></span><span id="sy" class="bd"></span><div class="us"><b>${esc(U.n)}</b>${esc(ROLE[U.r])}</div></header>
<nav>${NAV[U.r].map((n) => `<button class="${V == n[0] ? 'a' : ''}" onclick="go('${n[0]}')">${n[1]}${n[0] == 'chat' ? '<i id="nb-chat" style="display:none"></i>' : ''}</button>`).join('')}</nav><main>${banner}${body}</main>`;
  updBadge();
  const f = VW[V] && VW[V].after; if (f) try { f(); } catch (e) { console.error(e); }
  const nb = $('#nb-chat'); if (nb && typeof CH != 'undefined' && CH.unread && V != 'chat') { nb.textContent = CH.unread; nb.style.display = 'grid'; }
}

/* ---------- layar awal ---------- */
function homeView() {
  const reg = REG(), last = LS.get('jpos:last', null);
  const head = `<div class="lo"><div style="font-size:54px">🛒</div><h1 class="lg1">J-POS</h1><small class="mu">Kasir & akuntansi untuk toko grosir / distributor — online & offline</small>`;
  const srv = `<div class="lnk"><button class="gh" onclick="mode('srv')">⚙ Server</button><button class="gh" onclick="mode('ha')">🛠 Head Admin</button></div></div>`;
  if (MODE == 'login') return head + `<div class="cd fm" style="text-align:left"><h3>Masuk ke toko</h3><input id="lid" placeholder="Kode toko" autocapitalize="none" autocomplete="off" value="${esc(last ? last.id : '')}"><input id="lnm" placeholder="Nama pengguna" autocomplete="off" value="${esc(last ? last.name : '')}"><input id="lpn" type="password" inputmode="numeric" placeholder="PIN" onkeydown="if(event.key=='Enter')doLoginUi()"><button class="pr" onclick="doLoginUi()">Masuk</button><button class="gh" onclick="mode('home')">← Kembali</button></div></div>`;
  if (MODE == 'reg') return head + `<div class="cd fm" style="text-align:left"><h3>Daftarkan toko baru</h3><input id="rn" placeholder="Nama toko / distributor"><input id="ro" placeholder="Nama pemilik (jadi admin)"><input id="re" type="email" placeholder="Email (opsional)"><input id="rp" type="password" inputmode="numeric" maxlength="8" placeholder="PIN 4–8 angka"><input id="rc" placeholder="Kode toko (opsional, 6–20 huruf/angka)" autocapitalize="none"><button class="pr" onclick="doRegUi()">Daftar & mulai</button><small class="mu">${AP ? 'Toko akan terdaftar di server dan bisa dipakai banyak perangkat.' : 'Server belum diatur: toko dibuat lokal di perangkat ini.'}</small><button class="gh" onclick="mode('home')">← Kembali</button></div></div>`;
  if (MODE == 'ha') return head + `<div class="cd fm" style="text-align:left"><h3>Head Admin (Developer)</h3><input id="hu" placeholder="Username" autocapitalize="none" autocomplete="off"><input id="hp" type="password" placeholder="Password" onkeydown="if(event.key=='Enter')doHaUi()"><button class="pr" onclick="doHaUi()">Masuk backend</button><button class="gh" onclick="mode('home')">← Kembali</button></div></div>`;
  if (MODE == 'srv') return head + `<div class="cd fm" style="text-align:left"><h3>Alamat server</h3><input id="sv" placeholder="https://jpos-api.akun.workers.dev" value="${esc(AP)}" autocapitalize="none"><button class="pr" onclick="saveApi().then(()=>R())">Simpan & tes koneksi</button><small class="mu">Kosongkan untuk memakai mode lokal saja.</small><button class="gh" onclick="mode('home')">← Kembali</button></div></div>`;
  return head + `<div class="fm" style="text-align:left">${reg.map((r) => `<button class="us2" onclick="quickLogin('${esc(r.id)}')"><em>${esc((r.n || '?')[0].toUpperCase())}</em><span>${esc(r.n)}<br><small class="mu">${esc(r.id)}${r.demo ? ' · demo' : ''}</small></span></button>`).join('')}
<button class="pr" onclick="mode('login')">Masuk toko</button><button class="gh" style="padding:12px" onclick="mode('reg')">+ Daftarkan toko baru</button><button class="gh" style="padding:12px" onclick="startDemo()">Coba toko demo</button></div>
<small class="mu">${AP ? (navigator.onLine ? '● Server terhubung' : '○ Offline — toko yang pernah dibuka tetap bisa masuk') : '○ Mode lokal (server belum diatur)'}</small>${srv}`;
}
function quickLogin(id) { LS.set('jpos:last', { id, name: (LS.get('jpos:last', {}) || {}).id == id ? LS.get('jpos:last').name : '' }); MODE = 'login'; R(); setTimeout(() => $(($('#lnm').value ? '#lpn' : '#lnm')).focus(), 50); }
async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Memproses…'; try { await fn(); } catch (e) { toast(e.message || 'Gagal'); } finally { btn.disabled = false; btn.textContent = t; } }
function doLoginUi() { busy(event.target.closest('button') || $('.pr'), async () => { await doLogin($('#lid').value, $('#lnm').value, $('#lpn').value); MODE = 'home'; }); }
function doRegUi() {
  const n = $('#rn').value.trim(), o = $('#ro').value.trim(); if (n.length < 3 || !/^[\p{L}\p{N} ._-]{2,40}$/u.test(o)) return toast('Isi nama toko (min 3) dan nama pemilik');
  busy(event.target, async () => { await registerStore(n, o, $('#re').value.trim(), $('#rp').value, $('#rc').value); MODE = 'home'; });
}
function doHaUi() { busy(event.target, async () => { await haLogin($('#hu').value.trim(), $('#hp').value); MODE = 'ha'; HA.d = null; R(); haLoad(); }); }
async function startDemo() {
  toast('Menyiapkan data demo…', 1500); await new Promise((r) => setTimeout(r, 50));
  try { await makeDemo(); } catch (e) { console.error(e); return toast('Gagal membuat demo: ' + e.message); }
  quickLogin('demo'); $('#lnm').value = 'Admin'; $('#lpn').value = '1234'; toast('Demo siap. Login: Admin/1234 · Kasir/1111 · Akuntan/2222 · Sales/3333', 7000);
}
function haShell() {
  return `<div class="ha"><div class="row"><h2 class="lg1">J-POS · Head Admin</h2><span class="wrap"><button class="gh" onclick="haLoad()">⟳ Muat ulang</button><button class="gh d" onclick="haOut();MODE='home';R()">Keluar</button></span></div>${haView()}</div>`;
}

/* ---------- boot ---------- */
window.addEventListener('error', (e) => console.error('JS error:', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('Promise error:', e.reason));
(function boot() {
  initApi(); applyTheme();
  if (HT) { MODE = 'ha'; R(); haLoad(); } else R();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
