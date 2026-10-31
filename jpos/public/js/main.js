'use strict';
/* ============ shell, navigasi, layar awal, boot ============ */
const PAGES = {
  dash: ['🏠', 'Beranda', 'Ringkasan hari ini'], pos: ['🛒', 'Kasir', 'Jual & cetak struk'], his: ['🧾', 'Riwayat', 'Transaksi & pelunasan'],
  prod: ['📦', 'Produk', 'Stok, harga, barcode'], outlet: ['📍', 'Outlet', 'Pelanggan, peta, kredit'], lap: ['📊', 'Laporan', 'Penjualan & keuangan'],
  keu: ['💰', 'Keuangan', 'Kas, piutang, utang'], jur: ['📒', 'Jurnal', 'Biaya & jurnal manual'], abs: ['🕒', 'Absensi', 'Masuk / pulang'],
  chat: ['💬', 'Chat', 'Tim & antar toko'], onl: ['🛍️', 'Toko Online', 'Pesanan pembeli online'], ana: ['🎯', 'Analisa', 'Saran order & kredit'], usr: ['👥', 'Pengguna', 'Karyawan & PIN'], set: ['⚙️', 'Pengaturan', 'Toko, akun, data'],
  beli: ['📥', 'Pembelian', 'PO ke supplier & pabrik'], kas: ['📘', 'Buku Kas', 'Uang masuk & keluar'], kirim: ['🚚', 'Pengantaran', 'Antar order & tagih'], perm: ['🔐', 'Hak Akses', 'Peran, paket, keamanan'], aud: ['🛡️', 'Audit', 'Check-in, jam & lokasi'], retur: ['↩️', 'Retur Outlet', 'Expired, rusak, kelebihan order'], tgt: ['🏆', 'Target & Insentif', 'Pencapaian bulanan'], gps: ['🛰️', 'Pantau GPS', 'Posisi tim lapangan langsung'], gaji: ['💼', 'Gaji & Lembur', 'Gaji, potongan absen, lembur'], kiosMap: ['🗺️', 'Peta Kios', 'Kios terdaftar di sekitar'], dnet: ['🤝', 'Jaringan Mitra', 'Stok & SKU toko mitra'], kanvas: ['🚚', 'Kanvas', 'Muat, jual & balik barang'], shiftSet: ['🔐', 'Shift & Jadwal', 'Jadwal per minggu, tugas SPG, closing kasir'],
};
const ORDER = ['dash', 'kanvas', 'kirim', 'pos', 'onl', 'his', 'retur', 'prod', 'beli', 'outlet', 'gps', 'kiosMap', 'dnet', 'ana', 'tgt', 'lap', 'keu', 'kas', 'jur', 'aud', 'abs', 'shiftSet', 'gaji', 'chat', 'usr', 'perm', 'set'];
const TABS = { owner: ['dash', 'pos', 'onl', 'prod'], admin: ['dash', 'pos', 'onl', 'prod'], akuntan: ['dash', 'keu', 'lap', 'jur'], kasir: ['pos', 'dash', 'his', 'abs'], spg: ['dash', 'pos', 'tgt', 'abs'], kanvas: ['dash', 'kanvas', 'pos', 'outlet'], sales: ['dash', 'outlet', 'ana', 'pos'], dropping: ['dash', 'abs', 'chat'] };
const pages = () => ORDER.filter((k) => can(k));
const pgName = (k) => (k == 'pos' && U && U.r == 'sales' ? 'Order' : k == 'pos' && U && U.r == 'kanvas' ? 'Jual' : PAGES[k][1]);
let MODE = 'home', SRV = '', SRVOK = false;
// kunci alamat server: hanya pemilik toko (diverifikasi PIN) yang bisa mengganti; kembali ke server bawaan selalu boleh
async function ownerCheck(id, name, pin) {
  id = String(id || '').trim().toLowerCase(); name = String(name || '').trim(); if (!id || !name || !pin) throw new Error('Isi kode toko, nama pemilik, dan PIN');
  const s = LS.get('jpos:s:' + id, null), u = s && (s.users || []).find((x) => x.r == 'owner' && x.n.toLowerCase() == name.toLowerCase());
  if (u && (u.pin ? u.pin == pin : u.h == (await sha(id + ':' + u.n.toLowerCase() + ':' + pin)))) return true;
  if (s && !s.srv) throw new Error('Nama atau PIN pemilik salah');
  const r = await post('/api/login', { id, name, pin }, ''); if (r.role != 'owner') throw new Error('Hanya pemilik toko yang bisa mengubah alamat server'); return true;
}
async function srvUnlock() { try { await ownerCheck($('#ovi').value, $('#ovn').value, $('#ovp').value); SRVOK = true; toast('Kunci dibuka — silakan ubah alamat server'); R(); } catch (e) { toast(e.message || 'Gagal memverifikasi pemilik', 4000); } }
function srvReset() { LS.set('jpos:api', ''); LS.set('jpos:apiAuto', ''); initApi(); checkSrv.t = 0; toast('Kembali ke server bawaan ✓'); R(); }
function go(v) { SRVOK = false; if (v != V && typeof PQ != 'undefined') PQ = null; if (v != V && typeof SHD != 'undefined') SHD = null; const m = $('.md.menu'); if (m) m.close(); V = v; R(); window.scrollTo(0, 0); hb(v); }
// laporan kehadiran ke server (dipantau Head Admin): halaman aktif tiap pengguna
function hb(page) {
  try {
    const tk = MODE == 'buyer' ? BY.tk : HT && MODE == 'ha' ? HT : U && S && S.srv ? TK() : '';
    if (!tk || !canNet()) return; api('/api/hb', { method: 'POST', body: JSON.stringify({ page: page || (MODE == 'buyer' ? 'b:' + BY.pg : MODE == 'ha' ? 'ha' : V) }) }, tk).catch(() => { });
  } catch (e) { }
}
setInterval(() => hb(), 60000);
/* ---- berbagi lokasi karyawan di lapangan (sales/kasir) ke pemilik toko, selama jam kerja & aplikasi dibuka ---- */
let LOCG = { t: 0, lat: 0, lng: 0 };
const LOCMUST = () => !!U && ['sales', 'kanvas', 'dropping'].includes(U.r);
function clockedIn() { try { const td = (typeof myToday == 'function' ? myToday() : []); const last = td[td.length - 1]; return !!(last && last.k == 'in'); } catch (e) { return false; } }
async function locPing(force) {
  try {
    if (!U || !S || !S.srv || MODE == 'buyer' || (HT && MODE == 'ha') || !canNet() || isExp()) return;
    if (!['sales', 'kanvas', 'kasir', 'spg', 'admin', 'dropping'].includes(U.r)) return;
    if (!LOCMUST() && LS.get('jpos:sharing', '1') == '0') return; // sales & dropping wajib; peran lain boleh menonaktifkan
    if (!force && !clockedIn()) return;                     // hanya saat sudah absen masuk
    if (!force && Date.now() - LOCG.t < (LOCMUST() ? 55000 : 285000)) return; // sales / kanvas / dropping: ±1 menit (pantauan langsung); peran lain ±5 menit
    const p = await getPos(); if (!p) return;
    const moved = LOCG.t && haversine(LOCG.lat, LOCG.lng, p.lat, p.lng) < 60;
    if (!force && moved && Date.now() - LOCG.t < (LOCMUST() ? 3e5 : 9e5)) return; // diam di tempat: cukup tiap 5 mnt (lapangan) / 15 mnt
    LOCG = { t: Date.now(), lat: p.lat, lng: p.lng };
    emit('loc', { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), acc: p.acc ? Math.round(p.acc) : null, pg: V });
  } catch (e) { }
}
setInterval(() => locPing(), 60000);
function mode(m) { if (m != 'srv') SRVOK = false; MODE = m; R(); }
const expTxt = () => { const d = daysLeft(); return d == null ? '-' : (S.plan == 'trial' ? 'Masa coba · ' : (S.plan ? S.plan + ' · ' : '')) + (d < 0 ? '<b class="rd">habis ' + dstr(S.exp) + '</b>' : 's/d ' + dstr(S.exp) + ' (' + (d == 0 ? 'berakhir hari ini' : d + ' hari lagi') + ')'); };

function expBanner() {
  if (!S.exp) return '';
  const d = daysLeft(), info = LS.get('jpos:info', {}) || {}, boss = U.r == 'owner' || U.r == 'admin';
  const wa = info.wa ? `<a class="gh a" target="_blank" href="${esc(waLink(info.wa, 'Halo, saya ingin perpanjang J-POS untuk toko ' + S.name + ' (kode ' + SID + ').'))}">💬 Hubungi via WhatsApp</a>` : '';
  if (isExp()) return `<div class="cd warn"><b>⛔ Masa aktif toko sudah habis</b><br><small>Data tetap aman dan bisa dilihat, tetapi transaksi baru dikunci sampai diperpanjang oleh pemilik aplikasi.${info.price ? '<br>' + esc(info.price) : ''}</small><div class="wrap" style="margin-top:8px">${U.r == 'owner' && S.srv ? '<button class="gh pri" onclick="renewOpen()">💳 Perpanjang sekarang</button>' : ''}${wa}<button class="gh" onclick="sync().then(R)">Cek ulang</button></div></div>`;
  if (boss && (d <= 7 || (S.plan == 'trial' && V == 'dash'))) return `<div class="cd ${d <= 7 ? 'warn' : 'info'}"><b>${S.plan == 'trial' ? '🎁 Masa coba gratis' : '⏳ Masa aktif'}: ${d == 0 ? 'berakhir hari ini' : d + ' hari lagi'}</b> <small class="mu">(s/d ${dstr(S.exp)})</small>${U.r == 'owner' && S.srv ? ' <button class="gh pri" onclick="renewOpen()">💳 Perpanjang</button>' : ''}${d <= 7 ? `<br><small>Perpanjang sekarang agar transaksi tidak terhenti.${info.price ? ' ' + esc(info.price) : ''}</small><div class="wrap" style="margin-top:6px">${wa}</div>` : ''}</div>`;
  return '';
}

function R() {
  const app = $('#app'); if (!app) return;
  if (typeof mapsDrop == 'function') mapsDrop();
  document.body.classList.toggle('in', MODE == 'buyer' || !!(U && S && !(HT && MODE == 'ha')));
  if (MODE != 'buyer') document.body.classList.remove('buyer');
  if (HT && MODE == 'ha') { app.innerHTML = haShell(); return; }
  if (MODE == 'buyer') { app.innerHTML = buyerShell(); bAfter(); return; }
  if (typeof applyUiTheme == 'function') applyUiTheme();
  if (!U || !S) { app.innerHTML = homeView(); if (MODE == 'home') checkSrv(); return; }
  if (!isNative() && ['sales', 'kanvas', 'dropping'].includes(U.r) && LS.get('jpos:dev', '') != '1') { app.innerHTML = `<main class="gate"><div class="gc"><div style="font-size:60px">📱</div><h2 style="margin:8px 0">Gunakan aplikasi Android</h2><div class="gmsg"><small>Peran ${esc(ROLE[U.r])} memakai GPS, check-in outlet, dan selfie, sehingga hanya bisa dijalankan dari aplikasi J-POS di HP Android. Versi laptop / browser untuk pemilik, admin, akuntan, kasir, dan Head Admin.</small></div><button class="gbtn" onclick="logout()">Keluar</button></div></main>`; return; }
  if (typeof workGate == 'function' && workGate()) { app.innerHTML = workGateView(); return; }
  if (typeof absGate == 'function' && absGate()) { app.innerHTML = absGateView(); absGateAfter(); almSync(); return; }
  if (!can(V) || !VW[V]) V = can('dash') ? 'dash' : pages()[0];
  let body;
  try { body = VW[V](); } catch (e) { console.error(e); body = `<div class="cd"><h3>Terjadi kesalahan</h3><p class="rd">${esc(e.message)}</p></div>`; }
  const banner = S.locked ? `<div class="cd warn"><b>⛔ ${esc(S.locked)}</b><br><small>Hubungi pemilik aplikasi. Data di perangkat ini tetap aman.</small></div>` : S.reauth ? `<div class="cd info"><b>Sesi sinkron berakhir.</b> <button class="gh a" onclick="reauth()">Masuk ulang</button></div>` : '';
  const tabs = TABS[U.r].filter((k) => can(k));
  app.innerHTML = `<header><button class="av" onclick="acctMenu()">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : esc((S.name || '?')[0].toUpperCase())}</button><div class="hn"><b>${esc(S.name)}</b><small>${esc(U.n)} · ${esc(ROLE[U.r])}</small></div><span class="sp"></span><span id="sy" class="bd" onclick="sync().then(R)"></span></header>
<aside class="sb"><div class="sbh"><b>J-POS</b><small>${esc(S.name)}</small></div>${pages().map((k) => `<button class="${V == k ? 'a' : ''}" onclick="go('${k}')"><i>${pIco(k)}</i><span>${esc(pgName(k))}</span>${k == 'chat' ? '<em id="nb-chat2"></em>' : ''}</button>`).join('')}<span class="sp"></span><button onclick="logout()"><i>${ico('out')}</i><span>Keluar</span></button></aside>
<main><div class="pt"><span style="--c:${pCol(V)}">${pIco(V)}</span><h2>${esc(pgName(V))}</h2></div>${banner}${expBanner()}${body}</main>
<nav class="bn">${tabs.map((k) => `<button class="${V == k ? 'a' : ''}" onclick="go('${k}')"><i style="--c:${pCol(k)}">${pIco(k)}</i><span>${esc(pgName(k))}</span>${k == 'chat' ? '<em id="nb-chat"></em>' : k == 'onl' ? '<em id="nb-onl"></em>' : ''}</button>`).join('')}<button class="${tabs.includes(V) ? '' : 'a'}" onclick="menuSheet()"><i>${ico('menu')}</i><span>Menu</span><em id="nb-menu"></em></button></nav>`;
  updBadge(); if (typeof almSync == 'function') almSync();
  const f = VW[V].after; if (f) try { f(); } catch (e) { console.error(e); }
  if (S.srv && can('onl')) onlBadge();
  if (typeof CH != 'undefined' && CH.unread && V != 'chat') { const nb = $('#nb-chat') || $('#nb-menu'); if (nb) { nb.textContent = CH.unread; nb.style.display = 'grid'; } }
}
function menuSheet() {
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">Semua menu</h3><button class="gh" id="mx">✕</button></div><div class="mg">${pages().map((k) => `<button class="${V == k ? 'a' : ''}" onclick="go('${k}')"><i style="--c:${pCol(k)}">${pIco(k)}</i><b>${esc(pgName(k))}</b>${k == 'chat' && CH.unread ? `<em>${CH.unread}</em>` : ''}</button>`).join('')}</div><div class="wrap">${U.r == 'owner' && S.srv ? '<button class="gh pri" onclick="renewOpen()">💳 Perpanjang paket</button>' : ''}${['owner', 'admin'].includes(U.r) && S.srv ? '<button class="gh" onclick="tiketOpen()">🛟 Bantuan & komplain</button>' : ''}<button class="gh" onclick="changeMyPin()">🔑 Ubah PIN</button><button class="gh" onclick="sync().then(()=>{toast('Sinkron selesai');R()})">⟳ Sinkron</button><button class="gh d" onclick="$('.md.menu').close();logout()">Keluar</button></div>`, 'w');
  m.classList.add('menu'); $('#mx', m).onclick = () => m.close();
}
function acctMenu() {
  const m = modal(`<h3>${esc(U.n)}</h3><small class="mu">${esc(ROLE[U.r])} · ${esc(S.name)} (kode <b>${esc(SID)}</b>)</small>${row('Mode', S.srv ? 'Online + offline' : 'Lokal')}${S.exp ? row('Masa aktif', expTxt()) : ''}${row('Antrian belum terkirim', (S.eq || []).length)}<div class="wrap">${U.r == 'owner' && S.srv ? '<button class="gh pri" id="a4">💳 Perpanjang paket</button>' : ''}${['owner', 'admin'].includes(U.r) && S.srv ? '<button class="gh" id="a5">🛟 Bantuan & komplain</button>' : ''}<button class="gh" id="a1">🔑 Ubah PIN</button><button class="gh" id="a2">⚙️ Pengaturan</button><button class="gh d" id="a3">Keluar</button></div>`);
  const a4 = $('#a4', m), a5 = $('#a5', m); if (a4) a4.onclick = () => { m.close(); renewOpen(); }; if (a5) a5.onclick = () => { m.close(); tiketOpen(); };
  $('#a1', m).onclick = () => { m.close(); changeMyPin(); }; $('#a2', m).onclick = () => { m.close(); go('set'); }; $('#a3', m).onclick = () => { m.close(); logout(); };
}

/* ---------- layar awal ---------- */
async function checkSrv() {
  if (!AP) { SRV = 'none'; return; } if (checkSrv.t && Date.now() - checkSrv.t < 15000) return; checkSrv.t = Date.now();
  try { let r = await fetch(AP + '/api/ping', { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }).catch(() => null); if ((!r || !r.ok) && (await apiSwitch())) r = await fetch(AP + '/api/ping'); SRV = r && r.ok ? 'ok' : navigator.onLine ? 'down' : 'off'; if (r && r.ok) appInfo(); } catch (e) { SRV = navigator.onLine ? 'down' : 'off'; }
  const el = $('#srvst'); if (el) el.innerHTML = srvTxt();
}
const srvTxt = () => ({ ok: '<span class="gr">● Server online</span>', down: '<span class="rd">● Server belum aktif / tidak bisa dihubungi</span> — toko yang pernah dibuka tetap bisa dipakai offline', off: '<span class="or">● Offline</span> — toko yang pernah dibuka tetap bisa dipakai', none: '○ Mode lokal (server belum diatur)' }[SRV] || '○ Memeriksa server…');
function homeView() {
  const reg = REG(), last = LS.get('jpos:last', null), info = LS.get('jpos:info', {}) || {};
  const splash = `<div class="splash lx"><div class="lxlogo"><img src="icons/icon-512.png" alt="J-POS" width="84" height="84"></div><h1>J-POS</h1><span class="lxrule"></span><span class="tag">Kasir · Stok · Grosir · Distributor</span></div>`;
  const head = `<div class="lo">${splash}`;
  const back = `<button class="gh big" onclick="mode('home')">← Kembali</button>`;
  if (MODE == 'login') return head + `<div class="cd fm" style="text-align:left"><h3>Masuk ke toko</h3><label><small class="mu">Kode toko (dari pemilik toko)</small><input id="lid" placeholder="mis. tokomaju" autocapitalize="none" autocomplete="off" value="${esc(last ? last.id : '')}"></label><label><small class="mu">Nama pengguna</small><input id="lnm" placeholder="Nama Anda" autocomplete="off" value="${esc(last ? last.name : '')}"></label><label><small class="mu">PIN</small><input id="lpn" type="password" inputmode="numeric" placeholder="••••" onkeydown="if(event.key=='Enter')doLoginUi()"></label><button class="pr" onclick="doLoginUi()">Masuk</button>${last && typeof bioBtn == 'function' ? bioBtn(last.id, last.name) : ''}${back}<small class="mu">Login pertama di HP baru butuh internet. Setelah itu bisa dipakai offline.</small></div></div>`;
  if (MODE == 'reg') return head + `<div class="cd fm" style="text-align:left"><h3>Daftarkan toko baru</h3><div class="info cd" style="padding:10px"><b>🎁 Gratis ${info.trial || 30} hari</b><br><small>Setelah masa coba, perpanjang langganan lewat pemilik aplikasi.</small></div><input id="rn" placeholder="Nama toko / distributor *"><input id="ro" placeholder="Nama Anda (pemilik) *"><input id="rh" type="tel" inputmode="tel" placeholder="No. WhatsApp (untuk info perpanjangan)"><input id="re" type="email" placeholder="Email (opsional)"><input id="rp" type="password" inputmode="numeric" maxlength="8" placeholder="Buat PIN 4–8 angka *"><input id="rc" placeholder="Kode toko (opsional, 6–20 huruf/angka)" autocapitalize="none"><h3 style="margin:8px 0 0">Pilih paket</h3><div class="tiers" id="tiers">${tierCards()}</div><button class="pr" onclick="doRegUi()">Daftar & mulai</button>${back}</div></div>`;
  if (MODE == 'ha') return head + `<div class="cd fm" style="text-align:left"><h3>🛠 Head Admin (pemilik aplikasi)</h3><input id="hu" placeholder="Username" autocapitalize="none" autocomplete="off"><input id="hp" type="password" placeholder="Password" onkeydown="if(event.key=='Enter')doHaUi()"><button class="pr" onclick="doHaUi()">Masuk</button>${back}<small class="mu" id="srvst">${srvTxt()}</small></div></div>`;
  if (MODE == 'srv') return head + `<div class="cd fm" style="text-align:left"><h3>🔒 Alamat server</h3><small class="mu">Server aktif:</small><b style="overflow-wrap:anywhere">${esc(AP || '(lokal)')}</b>${apiCustom() ? '<small class="or">Memakai alamat khusus yang diatur pemilik toko.</small>' : '<small class="gr">Memakai server bawaan aplikasi.</small>'}
${SRVOK ? `<input id="sv" placeholder="https://…workers.dev" value="${esc(AP)}" autocapitalize="none"><button class="pr" onclick="saveApi().then(()=>{checkSrv.t=0;R()})">Simpan & tes koneksi</button>` : `<small class="mu">Alamat server dikunci. Hanya <b>pemilik toko</b> yang bisa mengubahnya — masukkan data pemilik:</small><input id="ovi" placeholder="Kode toko" autocapitalize="none" autocomplete="off" value="${esc((LS.get('jpos:last', null) || {}).id || '')}"><input id="ovn" placeholder="Nama pemilik" autocomplete="off"><input id="ovp" type="password" inputmode="numeric" placeholder="PIN pemilik"><button class="pr" onclick="srvUnlock()">Buka kunci</button>`}
${apiCustom() || LS.get('jpos:apiAuto', '') ? '<button class="gh" onclick="srvReset()">↺ Kembalikan ke server bawaan</button>' : ''}${back}</div></div>`;
  return head + `<div class="fm" style="text-align:left">${reg.length ? '<small class="mu">Toko di HP ini — ketuk untuk masuk</small>' : ''}${typeof bioList == 'function' && BIOP() ? bioList().filter((b) => reg.some((r) => r.id == b.id)).map((b) => `<button class="pr bio" onclick="bioLogin('${esc(b.id)}','${esc(b.n)}')">👆 ${esc(b.n)} · ${esc((reg.find((r) => r.id == b.id) || {}).n || b.id)}</button>`).join('') : ''}${reg.map((r) => `<button class="us2" onclick="quickLogin('${esc(r.id)}')"><em>${esc((r.n || '?')[0].toUpperCase())}</em><span>${esc(r.n)}<br><small class="mu">${esc(r.id)}${r.demo ? ' · demo' : ''}</small></span><span class="sp"></span>›</button>`).join('')}
<div class="lxbtn"><button class="pr lxmain" onclick="mode('login')"><span>${ico('key')}</span><b>Masuk toko<small>Pemilik &amp; karyawan</small></b>›</button>
<button class="pr shop lxalt" onclick="startBuyer()"><span>${ico('bag')}</span><b>Belanja<small>Untuk kios &amp; pembeli</small></b>›</button></div>
<div class="lxsub"><button onclick="mode('reg')">${ico('plus')}<b>Daftarkan toko</b><small>gratis ${info.trial || 30} hari</small></button><button onclick="startDemo()">${ico('play')}<b>Coba demo</b><small>tanpa daftar</small></button></div></div>
<div class="lxfoot"><span class="srvpill" id="srvst">${srvTxt()}</span><div class="lnk"><button class="gh" onclick="mode('srv')">${ico('srv')}Server</button><button class="gh" onclick="mode('ha')">${ico('crown')}Head Admin</button><a class="gh" href="privasi" target="_blank" rel="noopener">${ico('lock')}Privasi</a></div><small>© J-POS · Kasir &amp; distribusi</small></div></div>`;
}
/* ---------- pilihan paket saat daftar ---------- */
const PKGDEF = { biasa: { n: 'Standar · Kios', max: 3, pr: 25000, f: 'dash pos his prod prodEdit outlet abs chat set usr retur kas lap xls backup shiftSet gaji' }, standar: { n: 'Medium · Grosir', max: 15, pr: 50000, f: 'dash pos his hisAll prod prodEdit outlet abs absAll chat set usr retur lap keu kas beli xls onl backup perm ana cek kirim terima tgt tgtAll tgtSet shiftSet kiosMap kanvas gaji gps' }, high: { n: 'High · Distributor', max: 100, pr: 100000, f: 'dash pos his hisAll prod prodEdit outlet abs absAll chat set usr retur lap keu kas beli xls onl backup perm ana jur kirim cek terima anti aud tgt tgtAll tgtSet shiftSet kiosMap dnet kanvas gaji gps' } };
let regTier = 'standar';
const TIERUI = { biasa: ['🏪', 'Kios & toko kecil', '#10b981'], standar: ['🚀', 'Toko grosir yang punya sales', '#33508f'], high: ['👑', 'Distributor & trader — fitur paling lengkap', '#f59e0b'] };
function tierCards() {
  const pk = (LS.get('jpos:info', {}) || {}).pkg || PKGDEF, T = ['biasa', 'standar', 'high'];
  return T.map((t, i) => { const x = pk[t] || PKGDEF[t], fs = x.f.split(' ').filter((f) => FEAT[f] && f != 'dash' && f != 'set'), prev = i ? new Set((pk[T[i - 1]] || PKGDEF[T[i - 1]]).f.split(' ')) : null, hi = prev ? fs.filter((f) => !prev.has(f)) : fs, u = TIERUI[t];
    return `<button type="button" class="tier ${regTier == t ? 'on' : ''}" style="--tc:${u[2]}" onclick="regTier='${t}';$('#tiers').innerHTML=tierCards()">${t == 'standar' ? '<em>Populer</em>' : ''}<span class="ti">${u[0]}</span><b>${esc(x.n)}</b><small>${u[1]}</small>${(() => { const pr = x.pr ?? PKGDEF[t].pr; return pr ? `<span class="tpr"><b>Rp${(pr / 1000).toLocaleString('id-ID')}rb</b><small>/bulan</small></span>` : ''; })()}<span class="tu">👥 maks ${x.max} pengguna · ${fs.length} fitur</span><ul>${prev ? '<li class="pl">Semua fitur ' + esc((pk[T[i - 1]] || PKGDEF[T[i - 1]]).n) + ', plus:</li>' : ''}${hi.slice(0, 7).map((f) => '<li>✓ ' + esc(FEAT[f]) + '</li>').join('')}${hi.length > 7 ? '<li class="pl">+' + (hi.length - 7) + ' lainnya</li>' : ''}</ul><i class="rd2">${regTier == t ? '● Dipilih' : '○ Pilih'}</i></button>`; }).join('');
}
function quickLogin(id) { const l = LS.get('jpos:last', {}) || {}; LS.set('jpos:last', { id, name: l.id == id ? l.name : '' }); MODE = 'login'; R(); setTimeout(() => { const n = $('#lnm'); if (!n) return; const e = n.value ? $('#lpn') : n; if (e) e.focus(); }, 50); }
async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Memproses…'; try { await fn(); } catch (e) { toast(e.message || 'Gagal', 5000); } finally { btn.disabled = false; btn.textContent = t; } }
function doLoginUi() { busy(event.target.closest('button') || $('.pr'), async () => { const id = $('#lid').value.trim().toLowerCase(), nm = $('#lnm').value.trim(), pn = $('#lpn').value; await doLogin(id, nm, pn); MODE = 'home'; if (typeof bioOffer == 'function' && U) bioOffer(id, U.n, pn); }); }
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
  const t = HA.tab || 'dash';
  if (t == 'act') { clearInterval(HAA.t); HAA.t = setInterval(() => { if (MODE == 'ha' && HA.tab == 'act') haAct(); else clearInterval(HAA.t); }, 20000); if (!HAA.d) haAct(); }
  return `<div class="ha"><div class="row"><h2 class="lg1">🛠 Head Admin</h2><span class="wrap"><button class="gh" onclick="${t == 'act' ? 'haAct()' : 'haLoad()'}">⟳</button><button class="gh d" onclick="haOut();MODE='home';R()">Keluar</button></span></div><div class="seg" style="margin:0">${[['dash', '📊 Toko'], ['bayar', '💳 Pembayaran'], ['tiket', '🛟 Komplain <em id="hatkb" class="hbdg" style="display:none"></em>'], ['act', '👁️ Aktivitas']].map((x) => `<button class="${t == x[0] ? 'a' : ''}" onclick="HA.tab='${x[0]}';R()">${x[1]}</button>`).join('')}</div>${t == 'act' ? haActView() : t == 'bayar' ? haPayView() : t == 'tiket' ? haTkView() : haView()}</div>`;
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
