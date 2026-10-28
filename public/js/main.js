'use strict';
/* ============ shell, navigasi, layar awal, boot ============ */
const PAGES = {
  dash: ['🏠', 'Beranda', 'Ringkasan hari ini'], pos: ['🛒', 'Kasir', 'Jual & cetak struk'], his: ['🧾', 'Riwayat', 'Transaksi & pelunasan'],
  prod: ['📦', 'Produk', 'Stok, harga, barcode'], outlet: ['📍', 'Outlet', 'Pelanggan, peta, kredit'], lap: ['📊', 'Laporan', 'Penjualan & keuangan'],
  keu: ['💰', 'Keuangan', 'Kas, piutang, utang'], jur: ['📒', 'Jurnal', 'Biaya & jurnal manual'], abs: ['🕒', 'Absensi', 'Masuk / pulang'],
  chat: ['💬', 'Chat', 'Tim & antar toko'], onl: ['🛍️', 'Toko Online', 'Pesanan pembeli online'], ana: ['🎯', 'Analisa', 'Saran order & kredit'], usr: ['👥', 'Pengguna', 'Karyawan & PIN'], set: ['⚙️', 'Pengaturan', 'Toko, akun, data'],
};
const ORDER = ['dash', 'pos', 'onl', 'his', 'prod', 'outlet', 'ana', 'lap', 'keu', 'jur', 'abs', 'chat', 'usr', 'set'];
const TABS = { owner: ['dash', 'pos', 'onl', 'prod'], admin: ['dash', 'pos', 'onl', 'prod'], akuntan: ['dash', 'keu', 'lap', 'jur'], kasir: ['pos', 'dash', 'his', 'abs'], sales: ['dash', 'outlet', 'ana', 'pos'] };
const pages = () => ORDER.filter((k) => can(k));
const pgName = (k) => (k == 'pos' && U && U.r == 'sales' ? 'Order' : PAGES[k][1]);
let MODE = 'home', SRV = '';
function go(v) { const m = $('.md.menu'); if (m) m.close(); V = v; R(); window.scrollTo(0, 0); }
function mode(m) { MODE = m; R(); }
const expTxt = () => { const d = daysLeft(); return d == null ? '-' : (S.plan == 'trial' ? 'Masa coba · ' : (S.plan ? S.plan + ' · ' : '')) + (d < 0 ? '<b class="rd">habis ' + dstr(S.exp) + '</b>' : 's/d ' + dstr(S.exp) + ' (' + d + ' hari)'); };

function expBanner() {
  if (!S.exp) return '';
  const d = daysLeft(), info = LS.get('jpos:info', {}) || {}, boss = U.r == 'owner' || U.r == 'admin';
  const wa = info.wa ? `<a class="gh a" target="_blank" href="${esc(waLink(info.wa, 'Halo, saya ingin perpanjang J-POS untuk toko ' + S.name + ' (kode ' + SID + ').'))}">💬 Hubungi via WhatsApp</a>` : '';
  if (isExp()) return `<div class="cd warn"><b>⛔ Masa aktif toko sudah habis</b><br><small>Data tetap aman dan bisa dilihat, tetapi transaksi baru dikunci sampai diperpanjang oleh pemilik aplikasi.${info.price ? '<br>' + esc(info.price) : ''}</small><div class="wrap" style="margin-top:8px">${wa}<button class="gh" onclick="sync().then(R)">Cek ulang</button></div></div>`;
  if (boss && (d <= 7 || (S.plan == 'trial' && V == 'dash'))) return `<div class="cd ${d <= 7 ? 'warn' : 'info'}"><b>${S.plan == 'trial' ? '🎁 Masa coba gratis' : '⏳ Masa aktif'}: ${d} hari lagi</b> <small class="mu">(s/d ${dstr(S.exp)})</small>${d <= 7 ? `<br><small>Perpanjang sekarang agar transaksi tidak terhenti.${info.price ? ' ' + esc(info.price) : ''}</small><div class="wrap" style="margin-top:6px">${wa}</div>` : ''}</div>`;
  return '';
}

function R() {
  const app = $('#app'); if (!app) return;
  document.body.classList.toggle('in', MODE == 'buyer' || !!(U && S && !(HT && MODE == 'ha')));
  if (HT && MODE == 'ha') { app.innerHTML = haShell(); return; }
  if (MODE == 'buyer') { app.innerHTML = buyerShell(); bAfter(); return; }
  if (!U || !S) { app.innerHTML = homeView(); if (MODE == 'home') checkSrv(); return; }
  if (!can(V) || !VW[V]) V = can('dash') ? 'dash' : pages()[0];
  let body;
  try { body = VW[V](); } catch (e) { console.error(e); body = `<div class="cd"><h3>Terjadi kesalahan</h3><p class="rd">${esc(e.message)}</p></div>`; }
  const banner = S.locked ? `<div class="cd warn"><b>⛔ ${esc(S.locked)}</b><br><small>Hubungi pemilik aplikasi. Data di perangkat ini tetap aman.</small></div>` : S.reauth ? `<div class="cd info"><b>Sesi sinkron berakhir.</b> <button class="gh a" onclick="reauth()">Masuk ulang</button></div>` : '';
  const tabs = TABS[U.r].filter((k) => can(k));
  app.innerHTML = `<header><button class="av" onclick="acctMenu()">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : esc((S.name || '?')[0].toUpperCase())}</button><div class="hn"><b>${esc(S.name)}</b><small>${esc(U.n)} · ${esc(ROLE[U.r])}</small></div><span class="sp"></span><span id="sy" class="bd" onclick="sync().then(R)"></span></header>
<main><div class="pt"><span>${PAGES[V][0]}</span><h2>${esc(pgName(V))}</h2></div>${banner}${expBanner()}${body}</main>
<nav class="bn">${tabs.map((k) => `<button class="${V == k ? 'a' : ''}" onclick="go('${k}')"><i>${PAGES[k][0]}</i><span>${esc(pgName(k))}</span>${k == 'chat' ? '<em id="nb-chat"></em>' : k == 'onl' ? '<em id="nb-onl"></em>' : ''}</button>`).join('')}<button class="${tabs.includes(V) ? '' : 'a'}" onclick="menuSheet()"><i>☰</i><span>Menu</span><em id="nb-menu"></em></button></nav>`;
  updBadge();
  const f = VW[V].after; if (f) try { f(); } catch (e) { console.error(e); }
  if (S.srv && can('onl')) onlBadge();
  if (typeof CH != 'undefined' && CH.unread && V != 'chat') { const nb = $('#nb-chat') || $('#nb-menu'); if (nb) { nb.textContent = CH.unread; nb.style.display = 'grid'; } }
}
function menuSheet() {
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">Semua menu</h3><button class="gh" id="mx">✕</button></div><div class="mg">${pages().map((k) => `<button class="${V == k ? 'a' : ''}" onclick="go('${k}')"><i>${PAGES[k][0]}</i><b>${esc(pgName(k))}</b><small>${esc(PAGES[k][2])}</small>${k == 'chat' && CH.unread ? `<em>${CH.unread}</em>` : ''}</button>`).join('')}</div><div class="wrap"><button class="gh" onclick="changeMyPin()">🔑 Ubah PIN</button><button class="gh" onclick="sync().then(()=>{toast('Sinkron selesai');R()})">⟳ Sinkron</button><button class="gh d" onclick="$('.md.menu').close();logout()">Keluar</button></div>`, 'w');
  m.classList.add('menu'); $('#mx', m).onclick = () => m.close();
}
function acctMenu() {
  const m = modal(`<h3>${esc(U.n)}</h3><small class="mu">${esc(ROLE[U.r])} · ${esc(S.name)} (kode <b>${esc(SID)}</b>)</small>${row('Mode', S.srv ? 'Online + offline' : 'Lokal')}${S.exp ? row('Masa aktif', expTxt()) : ''}${row('Antrian belum terkirim', (S.eq || []).length)}<div class="wrap"><button class="gh" id="a1">🔑 Ubah PIN</button><button class="gh" id="a2">⚙️ Pengaturan</button><button class="gh d" id="a3">Keluar</button></div>`);
  $('#a1', m).onclick = () => { m.close(); changeMyPin(); }; $('#a2', m).onclick = () => { m.close(); go('set'); }; $('#a3', m).onclick = () => { m.close(); logout(); };
}

/* ---------- layar awal ---------- */
async function checkSrv() {
  if (!AP) { SRV = 'none'; return; } if (checkSrv.t && Date.now() - checkSrv.t < 15000) return; checkSrv.t = Date.now();
  try { const r = await fetch(AP + '/api/ping', { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }); SRV = r.ok ? 'ok' : 'down'; if (r.ok) appInfo(); } catch (e) { SRV = navigator.onLine ? 'down' : 'off'; }
  const el = $('#srvst'); if (el) el.innerHTML = srvTxt();
}
const srvTxt = () => ({ ok: '<span class="gr">● Server online</span>', down: '<span class="rd">● Server belum aktif / tidak bisa dihubungi</span> — toko yang pernah dibuka tetap bisa dipakai offline', off: '<span class="or">● Offline</span> — toko yang pernah dibuka tetap bisa dipakai', none: '○ Mode lokal (server belum diatur)' }[SRV] || '○ Memeriksa server…');
function homeView() {
  const reg = REG(), last = LS.get('jpos:last', null), info = LS.get('jpos:info', {}) || {};
  const head = `<div class="lo"><div class="logo">🛒</div><h1 class="lg1">J-POS</h1><small class="mu">Kasir, stok & akuntansi untuk toko grosir / distributor<br>bisa online & offline</small>`;
  const back = `<button class="gh big" onclick="mode('home')">← Kembali</button>`;
  if (MODE == 'login') return head + `<div class="cd fm" style="text-align:left"><h3>Masuk ke toko</h3><label><small class="mu">Kode toko (dari pemilik toko)</small><input id="lid" placeholder="mis. tokomaju" autocapitalize="none" autocomplete="off" value="${esc(last ? last.id : '')}"></label><label><small class="mu">Nama pengguna</small><input id="lnm" placeholder="Nama Anda" autocomplete="off" value="${esc(last ? last.name : '')}"></label><label><small class="mu">PIN</small><input id="lpn" type="password" inputmode="numeric" placeholder="••••" onkeydown="if(event.key=='Enter')doLoginUi()"></label><button class="pr" onclick="doLoginUi()">Masuk</button>${back}<small class="mu">Login pertama di HP baru butuh internet. Setelah itu bisa dipakai offline.</small></div></div>`;
  if (MODE == 'reg') return head + `<div class="cd fm" style="text-align:left"><h3>Daftarkan toko baru</h3><div class="info cd" style="padding:10px"><b>🎁 Gratis ${info.trial || 30} hari</b><br><small>Setelah masa coba, perpanjang langganan lewat pemilik aplikasi.</small></div><input id="rn" placeholder="Nama toko / distributor *"><input id="ro" placeholder="Nama Anda (pemilik) *"><input id="rh" type="tel" inputmode="tel" placeholder="No. WhatsApp (untuk info perpanjangan)"><input id="re" type="email" placeholder="Email (opsional)"><input id="rp" type="password" inputmode="numeric" maxlength="8" placeholder="Buat PIN 4–8 angka *"><input id="rc" placeholder="Kode toko (opsional, 6–20 huruf/angka)" autocapitalize="none"><button class="pr" onclick="doRegUi()">Daftar & mulai</button>${back}</div></div>`;
  if (MODE == 'ha') return head + `<div class="cd fm" style="text-align:left"><h3>🛠 Head Admin (pemilik aplikasi)</h3><input id="hu" placeholder="Username" autocapitalize="none" autocomplete="off"><input id="hp" type="password" placeholder="Password" onkeydown="if(event.key=='Enter')doHaUi()"><button class="pr" onclick="doHaUi()">Masuk</button>${back}<small class="mu" id="srvst">${srvTxt()}</small></div></div>`;
  if (MODE == 'srv') return head + `<div class="cd fm" style="text-align:left"><h3>Alamat server</h3><input id="sv" placeholder="https://jpos-api.akun.workers.dev" value="${esc(AP)}" autocapitalize="none"><button class="pr" onclick="saveApi().then(()=>{checkSrv.t=0;R()})">Simpan & tes koneksi</button><small class="mu">Biasanya tidak perlu diubah.</small>${back}</div></div>`;
  return head + `<div class="fm" style="text-align:left">${reg.length ? '<small class="mu">Toko di HP ini — ketuk untuk masuk</small>' : ''}${reg.map((r) => `<button class="us2" onclick="quickLogin('${esc(r.id)}')"><em>${esc((r.n || '?')[0].toUpperCase())}</em><span>${esc(r.n)}<br><small class="mu">${esc(r.id)}${r.demo ? ' · demo' : ''}</small></span><span class="sp"></span>›</button>`).join('')}
<button class="pr shop" onclick="startBuyer()">🛍️ Belanja (pembeli)<br><small>Cari & pesan produk dari semua toko</small></button><small class="mu" style="margin-top:6px">Untuk pemilik & karyawan toko:</small><button class="pr" onclick="mode('login')">Masuk toko</button><button class="gh big" onclick="mode('reg')">+ Daftarkan toko baru (gratis ${info.trial || 30} hari)</button><button class="gh big" onclick="startDemo()">▶ Coba toko demo</button></div>
<small class="mu" id="srvst">${srvTxt()}</small><div class="lnk"><button class="gh" onclick="mode('srv')">⚙ Server</button><button class="gh" onclick="mode('ha')">🛠 Head Admin</button></div></div>`;
}
function quickLogin(id) { const l = LS.get('jpos:last', {}) || {}; LS.set('jpos:last', { id, name: l.id == id ? l.name : '' }); MODE = 'login'; R(); setTimeout(() => { const n = $('#lnm'); if (!n) return; const e = n.value ? $('#lpn') : n; if (e) e.focus(); }, 50); }
async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Memproses…'; try { await fn(); } catch (e) { toast(e.message || 'Gagal', 5000); } finally { btn.disabled = false; btn.textContent = t; } }
function doLoginUi() { busy(event.target.closest('button') || $('.pr'), async () => { await doLogin($('#lid').value, $('#lnm').value, $('#lpn').value); MODE = 'home'; }); }
function doRegUi() {
  const n = $('#rn').value.trim(), o = $('#ro').value.trim(); if (n.length < 3 || !/^[\p{L}\p{N} ._-]{2,40}$/u.test(o)) return toast('Isi nama toko (min 3 huruf) dan nama pemilik');
  busy(event.target, async () => { await registerStore(n, o, $('#re').value.trim(), $('#rp').value, $('#rc').value, $('#rh').value.trim()); MODE = 'home'; });
}
function doHaUi() { busy(event.target, async () => { await haLogin($('#hu').value.trim(), $('#hp').value); MODE = 'ha'; HA.d = null; R(); haLoad(); }); }
async function startDemo() {
  toast('Menyiapkan data demo…', 1500); await new Promise((r) => setTimeout(r, 50));
  try { await makeDemo(); } catch (e) { console.error(e); return toast('Gagal membuat demo: ' + e.message); }
  quickLogin('demo'); $('#lnm').value = 'Owner'; $('#lpn').value = '1234'; toast('Demo siap. Login: Owner/1234 · Admin/5555 · Kasir/1111 · Akuntan/2222 · Sales/3333', 8000);
}
function haShell() {
  return `<div class="ha"><div class="row"><h2 class="lg1">🛠 Head Admin</h2><span class="wrap"><button class="gh" onclick="haLoad()">⟳</button><button class="gh d" onclick="haOut();MODE='home';R()">Keluar</button></span></div>${haView()}</div>`;
}

/* ---------- boot ---------- */
window.addEventListener('error', (e) => console.error('JS error:', e.message));
window.addEventListener('unhandledrejection', (e) => { console.error('Promise error:', e.reason); });
(function boot() {
  initApi(); applyTheme();
  if (HT) { MODE = 'ha'; R(); haLoad(); } else R();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) navigator.serviceWorker.register('sw.js').catch(() => { });
  // tombol kembali Android: tutup dialog dulu, lalu kembali ke beranda
  document.addEventListener('backbutton', (e) => { const m = $$('.md').pop(); if (m) { e.preventDefault(); m.close(); } });
  try { const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (A) A.addListener('backButton', () => { const m = $$('.md').pop(); if (m) m.close(); else if (U && V != 'dash' && can('dash')) go('dash'); else if (!U && MODE != 'home') mode('home'); else A.exitApp(); }); } catch (e) { }
})();
