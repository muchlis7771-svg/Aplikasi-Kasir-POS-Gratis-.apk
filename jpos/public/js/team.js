'use strict';
/* ============ PENGGUNA ============ */
const newRoles = () => (U.r == 'owner' ? ['kasir', 'spg', 'sales', 'kanvas', 'dropping', 'akuntan', 'admin'] : ['kasir', 'spg', 'sales', 'kanvas', 'dropping']);
const canEditUser = (u) => u.name == U.n || (u.role != 'owner' && (U.r == 'owner' || ['kasir', 'spg', 'sales', 'kanvas', 'dropping'].includes(u.role)));
const ROLEDESC = { owner: 'Semua fitur, atur kredit outlet, modal, profil toko', admin: 'Kasir, produk & stok, outlet, laporan, kelola kasir/sales', akuntan: 'Keuangan, jurnal, laporan (tanpa transaksi jual)', kasir: 'Transaksi kasir, riwayat sendiri, absensi', spg: 'Penjaga toko: jual produk, tugas kebersihan harian, target omzet & item fokus, insentif', kanvas: 'Muat barang ke mobil, jual tunai/kredit langsung ke outlet, balik barang, rekap & setor', sales: 'Order ke outlet, check-in kunjungan & peta, absensi', dropping: 'Pengantaran barang order sales, tagih saat tiba, check-in/out outlet' };
const rolesOpt = (sel) => (newRoles().includes(sel) ? newRoles() : [sel, ...newRoles()]).map((r) => `<option value="${r}" ${sel == r ? 'selected' : ''}>${ROLE[r]}</option>`).join('');
const staffList = () => (S.srv ? S.staff : S.users.map((u) => ({ name: u.n, role: u.r })));
async function loadStaff() { if (!S.srv || !canNet()) return; try { S.staff = (await api('/api/staff')).staff; save(); const el = $('#stf'); if (el) el.innerHTML = stfH(); } catch (e) { toast(e.message); } }
const stfH = () => `<table><tr><th>Nama<th>Peran<th></tr>${staffList().map((u, i) => `<tr><td>${esc(u.name)}${u.name == U.n ? ' <span class="chip">Anda</span>' : ''}<td>${S.srv && u.name != U.n && canEditUser(u) ? `<select onchange="setRole(${i},this.value)">${rolesOpt(u.role)}</select>` : `<span class="chip">${esc(ROLE[u.role] || u.role)}</span>`}<td class="n">${canEditUser(u) ? `<button class="gh" onclick="resetPin(${i})">Ubah PIN</button>${u.name != U.n ? ` <button class="gh d" onclick="delUser(${i})">Hapus</button>` : ''}` : ''}</tr>`).join('')}</table>`;
VW.usr = () => `<div class="cd"><h3>Kode toko</h3><div class="row"><b style="font-size:22px;letter-spacing:2px">${esc(SID)}</b><button class="gh" onclick="shareText('Kode toko','Kode toko ${esc(SID)} — buka aplikasi J-POS, pilih Masuk, lalu isi kode toko, nama, dan PIN Anda.')">Bagikan</button></div><small class="mu">Staf masuk dengan kode ini + nama + PIN yang Anda buat di bawah.${S.srv ? '' : ' (Toko lokal: data hanya di perangkat ini.)'}</small></div>
<div class="cd"><h3>Tambah pengguna</h3>${S.srv && S.lim ? `<small class="mu">Paket ${esc(S.tn || '')}: ${staffList().length} dari ${S.lim} pengguna terpakai.</small>` : ''}<div class="fm"><input id="un" placeholder="Nama (untuk login)" autocomplete="off"><select id="ux">${rolesOpt('kasir')}</select><input id="up" type="password" inputmode="numeric" maxlength="8" placeholder="PIN 4–8 angka" autocomplete="off"><button class="pr" onclick="addUser()">Tambah</button></div><div style="margin-top:8px">${['owner', 'admin', 'akuntan', 'kasir', 'sales', 'dropping'].map((r) => `<div class="row"><span class="chip">${ROLE[r]}</span><small class="mu" style="text-align:right">${ROLEDESC[r]}</small></div>`).join('')}</div></div>
<div class="cd"><h3>Pengguna ${S.srv ? '<button class="gh" onclick="loadStaff()" style="float:right">⟳</button>' : ''}</h3><div class="ov" id="stf">${stfH()}</div></div>`;
VW.usr.after = loadStaff;
async function addUser() {
  const n = $('#un').value.trim(), p = $('#up').value, r = $('#ux').value;
  if (!/^[\p{L}\p{N} ._-]{2,40}$/u.test(n)) return toast('Nama 2–40 karakter (huruf/angka)'); if (!/^\d{4,8}$/.test(p)) return toast('PIN harus 4–8 angka');
  if (staffList().some((u) => u.name.toLowerCase() == n.toLowerCase())) return toast('Nama sudah dipakai');
  try { if (S.srv) await post('/api/staff', { name: n, role: r, pin: p }); else S.users.push({ n, r, h: await sha(SID + ':' + n.toLowerCase() + ':' + p) }); } catch (e) { return toast(e.message); }
  toast('Pengguna ditambahkan'); save(); S.srv ? await loadStaff() : R(); $('#un').value = ''; $('#up').value = '';
}
async function resetPin(i) {
  const u = staffList()[i], p = prompt('PIN baru untuk ' + u.name + ' (4–8 angka):'); if (p == null) return; if (!/^\d{4,8}$/.test(p)) return toast('PIN harus 4–8 angka');
  try { if (S.srv) await api('/api/staff/' + encodeURIComponent(u.name), { method: 'PATCH', body: JSON.stringify({ pin: p }) }); else { const x = S.users.find((y) => y.n == u.name); x.h = await sha(SID + ':' + x.n.toLowerCase() + ':' + p); save(); } toast('PIN diubah'); } catch (e) { toast(e.message); }
}
async function setRole(i, r) { const u = staffList()[i]; try { await api('/api/staff/' + encodeURIComponent(u.name), { method: 'PATCH', body: JSON.stringify({ role: r }) }); toast('Peran diubah'); loadStaff(); } catch (e) { toast(e.message); loadStaff(); } }
async function delUser(i) {
  const u = staffList()[i]; if (!confirm('Hapus pengguna ' + u.name + '?')) return;
  try { if (S.srv) await api('/api/staff/' + encodeURIComponent(u.name), { method: 'DELETE' }); else S.users = S.users.filter((x) => x.n != u.name); toast('Dihapus'); save(); S.srv ? loadStaff() : R(); } catch (e) { toast(e.message); }
}
function changeMyPin() {
  const m = modal(`<h3>Ubah PIN saya</h3><input id="p0" type="password" inputmode="numeric" placeholder="PIN lama"><input id="p1" type="password" inputmode="numeric" maxlength="8" placeholder="PIN baru (4–8 angka)"><button class="pr" id="ok">Simpan</button>`);
  $('#ok', m).onclick = async () => {
    const a = $('#p0', m).value, b = $('#p1', m).value; if (!/^\d{4,8}$/.test(b)) return toast('PIN baru harus 4–8 angka');
    try {
      if (S.srv) { if (!canNet()) return toast('Butuh internet untuk mengubah PIN'); await post('/api/me/pin', { old: a, pin: b }); }
      const u = S.users.find((x) => x.n == U.n);
      if (!S.srv) { if (u.pin ? u.pin != a : u.h != (await sha(SID + ':' + u.n.toLowerCase() + ':' + a))) return toast('PIN lama salah'); }
      if (u) { delete u.pin; u.h = await sha(SID + ':' + U.n.toLowerCase() + ':' + b); } save(); m.close(); toast('PIN diubah');
    } catch (e) { toast(e.message); }
  };
}

/* ============ ABSENSI ============ */
function attRecap(f, t) {
  const m = {}, jn = String(S.set.jin || '08:00').split(':'), lim = +jn[0] * 60 + +jn[1] + 10;
  for (const a of S.att) {
    if (a.t < f || a.t > t) continue; const u = m[a.u] || (m[a.u] = { u: a.u, d: {}, visits: 0 });
    if (a.k == 'vout') continue; if (a.k == 'visit') { u.visits++; continue; }
    const d = u.d[dkey(a.t)] || (u.d[dkey(a.t)] = { in: 0, out: 0 });
    if (a.k == 'in' && (!d.in || a.t < d.in)) d.in = a.t; if (a.k == 'out' && a.t > d.out) d.out = a.t;
  }
  return Object.values(m).map((u) => { let days = 0, late = 0, hours = 0; for (const d of Object.values(u.d)) { if (!d.in) continue; days++; const dt = new Date(d.in); const jj = String(typeof jinOf == 'function' ? jinOf(u.u, d.in) : S.set.jin || '08:00').split(':'); if (dt.getHours() * 60 + dt.getMinutes() > +jj[0] * 60 + +jj[1] + 10) late++; if (d.out > d.in) hours += (d.out - d.in) / 36e5; } return { u: u.u, days, late, hours, visits: u.visits }; }).sort((a, b) => a.u.localeCompare(b.u));
}
const myToday = () => S.att.filter((a) => a.u == U.n && (a.k == 'in' || a.k == 'out') && dkey(a.t) == dkey(Date.now())).sort((a, b) => a.t - b.t);
async function clock(kind) {
  const td = myToday(), last = td[td.length - 1];
  if (kind == 'in' && last && last.k == 'in') return toast('Anda sudah absen masuk ' + hm(last.t));
  if (kind == 'out' && (!last || last.k == 'out')) return toast('Belum absen masuk');
  const anti = antiOn(), geo = S.set.glat != null && ['kasir', 'akuntan', 'admin'].includes(U.r);
  toast('Memverifikasi jam & lokasi…', 2500);
  const pr = await proof({ selfie: true, needPos: anti }); if (pr.err) return alertBox(pr.err, 'Absen ditolak'); // selfie WAJIB: kamera langsung, tidak bisa dari galeri
  const fc = await faceCheck(pr.ph); if (!fc.ok) return alertBox(fc.err, 'Absen ditolak');
  const fx = pr.fx.slice(); if (fc.baru) fx.push('wajah-baru');
  if (geo && pr.lat != null) { const d = haversine(pr.lat, pr.lng, S.set.glat, S.set.glng); if (d > (S.set.grad || 200)) { if (anti) return alertBox('Anda ' + distStr(d) + ' dari lokasi toko (batas ' + distStr(S.set.grad || 200) + '). Absen hanya bisa di toko.', 'Absen ditolak'); if (!confirm('Anda ' + distStr(d) + ' dari lokasi toko. Tetap absen?')) return; fx.push('lokasi'); } }
  emit(kind, { lat: pr.lat, lng: pr.lng, acc: pr.acc, on: pr.on, sk: pr.sk, fx: fxs(fx), ph: pr.ph || undefined, fm: fc.fm, note: ($('#an') || {}).value ? $('#an').value.trim() : pr.lat != null ? '' : 'tanpa GPS' }, pr.t);
  toast((fc.baru ? 'Wajah Anda terdaftar · ' : fc.fm != null ? 'Wajah cocok ✓ · ' : '') + (kind == 'in' ? 'Absen masuk ' + hm(pr.t) + (lateMin() > 0 ? ' (terlambat)' : '') : 'Absen pulang ' + hm(pr.t))); R();
}
const lateMin = () => { const jn = String(typeof jinOf == 'function' ? jinOf(U.n) : S.set.jin || '08:00').split(':'), n = new Date(); return n.getHours() * 60 + n.getMinutes() - (+jn[0] * 60 + +jn[1] + 10); };
VW.abs = () => {
  const td = myToday(), last = td[td.length - 1], inn = last && last.k == 'in', mgr = MGR(U.r);
  const names = [...new Set([...staffList().map((u) => u.name), ...S.att.map((a) => a.u)])].sort();
  const board = names.map((n) => { const t = S.att.filter((a) => a.u == n && (a.k == 'in' || a.k == 'out') && dkey(a.t) == dkey(Date.now())).sort((a, b) => a.t - b.t), i = t.find((x) => x.k == 'in'), o = [...t].reverse().find((x) => x.k == 'out'); return [n, i, o && (!i || o.t > i.t) ? o : null]; });
  const mine = Object.entries(S.att.filter((a) => a.u == U.n && (a.k == 'in' || a.k == 'out')).reduce((g, a) => { (g[dkey(a.t)] = g[dkey(a.t)] || []).push(a); return g; }, {})).sort().reverse().slice(0, 14);
  return (typeof myCal == 'function' ? myCal() : '') + `<div class="cd"><h3>Absensi saya · ${dstr(Date.now())}</h3><div class="row"><span>Status</span><b class="${inn ? 'gr' : 'mu'}">${inn ? 'Masuk ' + hm(last.t) : last ? 'Pulang ' + hm(last.t) : 'Belum absen'}</b></div><input id="an" placeholder="Catatan (opsional)"><div class="fm2" style="margin-top:8px"><button class="pr" ${inn ? 'disabled' : ''} onclick="clock('in')">Absen masuk</button><button class="pr" style="background:linear-gradient(135deg,#ff9f43,#ff5d73)" ${inn ? '' : 'disabled'} onclick="clock('out')">Absen pulang</button></div><small class="mu">Jam masuk ${esc(S.set.jin || '08:00')} (toleransi 10 menit). Lokasi GPS dicatat saat absen.</small></div>
${mgr ? `<div class="cd"><h3>Kehadiran hari ini</h3><table>${board.map((r) => `<tr><td>${esc(r[0])}<td>${r[1] ? '<span class="chip g">Masuk ' + hm(r[1].t) + '</span>' + (r[1].ph ? ` <img src="${r[1].ph}" alt="" style="width:30px;border-radius:6px;vertical-align:middle">` : '') + (fxTxt(r[1]).length ? ' <span class="chip o" title="' + esc(fxTxt(r[1]).join(', ')) + '">⚠</span>' : '') : '<span class="chip r">Belum hadir</span>'}<td>${r[2] ? 'Pulang ' + hm(r[2].t) : ''}<td><button class="gh" style="padding:4px 8px" onclick="faceView('${esc(r[0])}')">${(S.face || {})[r[0]] ? '🙂 Wajah' : '— belum'}</button></tr>`).join('') || '<tr><td class="mu">Belum ada karyawan</tr>'}</table></div>${perBar()}${secH(RPT.absen(PF, PT)[0])}<div class="cd"><div class="wrap"><button class="gh" onclick="RT='absen';expXlsx('cur')">⬇ Rekap Excel</button><button class="gh" onclick="RT='absen';expPdf('cur')">Rekap PDF</button></div></div>` : ''}
<div class="cd"><h3>Riwayat saya</h3><table>${mine.map(([k, a]) => { const i = a.find((x) => x.k == 'in'), o = [...a].reverse().find((x) => x.k == 'out'); return `<tr><td>${k.split('-').reverse().join('/')}<td>${i ? hm(i.t) : '-'}<td>${o ? hm(o.t) : '-'}<td class="n">${i && o && o.t > i.t ? ((o.t - i.t) / 36e5).toFixed(1) + ' jam' : ''}</tr>`; }).join('') || '<tr><td class="mu">Belum ada riwayat</tr>'}</table></div>`;
};

/* ============ CHAT (antar pengguna, antar toko) ============ */
const CH = { room: 'tk', msgs: [], last: 0, unread: 0, peer: null, timer: null, bg: null, dms: [] };
const roomKey = () => CH.room;
function stopChat() { clearInterval(CH.timer); clearInterval(CH.bg); CH.timer = CH.bg = null; CH.unread = 0; }
async function chatFlush() { // kirim pesan yang tertunda saat offline
  while (S.cq && S.cq.length) { const m = S.cq[0]; try { await post('/api/chat', { room: m.room, text: m.text }); S.cq.shift(); } catch (e) { if (e.net) return; S.cq.shift(); } }
}
function chatPoll(start) {
  if (!S || !S.srv) return; if (start && !CH.bg) CH.bg = setInterval(() => chatPoll(), 20000);
  if (!canNet() || !TK()) return;
  Promise.all(['tk', 'net'].map((r) => api('/api/chat?room=' + r + '&since=' + (S.cs[r] || 0)).then((x) => x.m.filter((m) => !(m.sid == SID && m.un == U.n)).length).catch(() => 0))).then(([a, b]) => { CH.unread = (CH.room == 'tk' && V == 'chat' ? 0 : a) + (CH.room == 'net' && V == 'chat' ? 0 : b); const el = $('#nb-chat'); if (el) { el.textContent = CH.unread; el.style.display = CH.unread ? 'grid' : 'none'; } });
}
const bubH = (m) => { const me = m.sid == SID && m.un == U.n, hq = m.sid == 'hq'; return `<div class="bub ${me ? 'me' : ''} ${hq ? 'hq' : ''}"><small>${me ? 'Saya' : esc(m.un) + (m.sid != SID ? ' · ' + esc(m.sn) : '')} · ${hm(m.t)}${m.pending ? ' ⏳' : ''}</small>${esc(m.tx)}</div>`; };
VW.chat = () => {
  if (!S.srv) return `<div class="cd"><h3>Chat</h3><p class="mu">Chat memerlukan toko yang terdaftar di server. Daftarkan toko dengan koneksi internet.</p></div>`;
  return `<div class="cd"><div class="seg" style="margin-top:0"><button class="${CH.room == 'tk' ? 'a' : ''}" onclick="chatRoom('tk')">Tim toko</button><button class="${CH.room == 'net' ? 'a' : ''}" onclick="chatRoom('net')">Semua toko</button><button class="${CH.room.startsWith('dm:') ? 'a' : ''}" onclick="chatDm()">Pesan toko lain</button></div>
<small class="mu" id="chh"></small><div class="chat" id="chm"></div><div class="cin"><input id="chi" placeholder="Tulis pesan…" maxlength="500" onkeydown="if(event.key=='Enter')chatSend()"><button onclick="chatSend()">Kirim</button></div></div>`;
};
VW.chat.after = () => { if (!S.srv) return; chatLoad(true); clearInterval(CH.timer); CH.timer = setInterval(() => { if (V == 'chat') chatLoad(false); else clearInterval(CH.timer); }, 4000); };
function chatRoom(r) { CH.room = r; CH.msgs = []; CH.last = 0; CH.peer = null; R(); }
async function chatDm() {
  let dms = []; try { dms = (await api('/api/chat/rooms')).rooms; } catch (e) { }
  const m = modal(`<h3>Pesan ke toko lain</h3>${dms.map((d) => `<button class="gh" style="text-align:left" data-r="${esc(d.room)}">💬 ${esc(d.name)}</button>`).join('')}<input id="dc" placeholder="Kode toko tujuan"><button class="pr" id="ok">Buka percakapan</button><small class="mu">Minta kode toko dari pemilik toko lain (menu Pengguna → Kode toko).</small>`);
  const go = (r) => { m.close(); CH.room = r; CH.msgs = []; CH.last = 0; R(); };
  $$('[data-r]', m).forEach((b) => (b.onclick = () => go(b.dataset.r))); $('#ok', m).onclick = () => { const c = $('#dc', m).value.trim().toLowerCase(); if (!/^[a-z0-9]{6,20}$/.test(c)) return toast('Kode toko tidak valid'); go('dm:' + c); };
}
async function chatLoad(first) {
  if (!canNet()) { const h = $('#chh'); if (h) h.textContent = 'Offline — pesan akan terkirim saat online'; return; }
  const room = CH.room;
  try {
    const r = await api('/api/chat?room=' + encodeURIComponent(room) + '&since=' + (first ? 0 : CH.last)); if (room != CH.room || V != 'chat') return;
    if (first) CH.msgs = []; r.m.forEach((m) => { CH.msgs.push(m); CH.last = Math.max(CH.last, m.seq); }); if (r.peer) CH.peer = r.peer;
    const el = $('#chm'); if (!el) return; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (first || r.m.length) { el.innerHTML = CH.msgs.map(bubH).join('') + (S.cq || []).filter((x) => x.room == room).map((x) => bubH({ sid: SID, un: U.n, sn: S.name, t: x.t, tx: x.text, pending: 1 })).join('') || '<small class="mu">Belum ada pesan. Mulai percakapan!</small>'; if (first || near) el.scrollTop = el.scrollHeight; }
    const h = $('#chh'); if (h) h.textContent = room == 'tk' ? 'Percakapan tim ' + (S.name || '') : room == 'net' ? 'Percakapan terbuka seluruh toko pengguna J-POS — jaga etika, jangan bagikan data rahasia' : 'Percakapan pribadi dengan ' + (CH.peer ? CH.peer.name : room.slice(3));
    if (CH.last) { S.cs[room] = CH.last; save(); } chatPoll();
  } catch (e) { const h = $('#chh'); if (h) h.textContent = e.message; }
}
async function chatSend() {
  const i = $('#chi'), tx = i.value.trim(); if (!tx) return; i.value = '';
  if (!canNet()) { S.cq.push({ room: CH.room, text: tx, t: Date.now() }); save(); toast('Offline: pesan dikirim saat online'); return chatLoad(true); }
  try { await post('/api/chat', { room: CH.room, text: tx }); await chatLoad(false); const el = $('#chm'); if (el) el.scrollTop = el.scrollHeight; } catch (e) { i.value = tx; toast(e.message); }
}

/* ============ PENGATURAN ============ */
VW.set = () => {
  const adm = U.r == 'owner', th = LS.get('jpos:theme', 'auto');
  if (!adm) return `<div class="cd"><h3>Akun</h3>${row('Toko', esc(S.name))}${row('Pengguna', esc(U.n) + ' · ' + ROLE[U.r])}${row('Kode toko', '<b>' + esc(SID) + '</b>')}${row('Mode', S.srv ? 'Online + offline (sinkron)' : 'Lokal')}<div class="wrap" style="margin-top:8px"><button class="gh" onclick="changeMyPin()">Ubah PIN saya</button>${typeof BIOP == 'function' && BIOP() ? (bioHas(SID, U.n) ? `<button class="gh" onclick="bioDisable(SID,U.n).then(()=>{toast('Login sidik jari dimatikan');R()})">👆 Matikan sidik jari</button>` : `<button class="gh a" onclick="bioSetup()">👆 Aktifkan login sidik jari</button>`) : ''}<button class="gh" onclick="sync().then(()=>{toast('Sinkron selesai');R()})">Sinkron sekarang</button><button class="gh d" onclick="logout()">Keluar</button></div></div>
${['kasir', 'admin'].includes(U.r) ? `<div class="cd"><div class="row" style="margin:0"><span><b>🖨️ Printer struk</b><br><small class="mu">${esc({ rawbt: 'Thermal RawBT', ble: 'Thermal BLE', a4: 'Faktur A4', a5: 'Faktur A5', text: 'Teks' }[PRN.mode])} · ${PRN.paper} mm</small></span><button class="gh a" onclick="printerSettings()">Atur</button></div></div>` : ''}
<div class="cd"><h3>Tampilan</h3><div class="seg"><button class="${th == 'auto' ? 'a' : ''}" onclick="setTheme('auto')">Otomatis</button><button class="${th == 'light' ? 'a' : ''}" onclick="setTheme('light')">Terang</button><button class="${th == 'dark' ? 'a' : ''}" onclick="setTheme('dark')">Gelap</button></div></div>
<div class="cd info"><b>🔒 Pengaturan toko dikunci</b><br><small>Pengaturan toko, server, data, dan keamanan hanya bisa diubah oleh pemilik toko.</small></div>`;
  return `<div class="cd"><h3>Akun</h3>${row('Toko', esc(S.name))}${row('Pengguna', esc(U.n) + ' · ' + ROLE[U.r])}${row('Kode toko', '<b>' + esc(SID) + '</b>')}${row('Mode', S.srv ? 'Online + offline (sinkron)' : 'Lokal (tanpa server)')}${row('Antrian kirim', (S.eq || []).length + ' kejadian')}${S.exp ? row('Masa aktif', expTxt()) : ''}<div class="wrap" style="margin-top:8px"><button class="gh" onclick="changeMyPin()">Ubah PIN saya</button>${typeof BIOP == 'function' && BIOP() ? (bioHas(SID, U.n) ? `<button class="gh" onclick="bioDisable(SID,U.n).then(()=>{toast('Login sidik jari dimatikan');R()})">👆 Matikan sidik jari</button>` : `<button class="gh a" onclick="bioSetup()">👆 Aktifkan login sidik jari</button>`) : ''}<button class="gh" onclick="sync().then(()=>{toast('Sinkron selesai');R()})">Sinkron sekarang</button><button class="gh d" onclick="logout()">Keluar</button></div></div>
<div class="cd"><div class="row" style="margin:0"><span><b>🖨️ Printer struk</b><br><small class="mu">${esc({ rawbt: 'Thermal RawBT', ble: 'Thermal BLE', a4: 'Faktur A4', a5: 'Faktur A5', text: 'Teks' }[PRN.mode])} · ${PRN.paper} mm${PRN.auto ? ' · otomatis' : ''}</small></span><button class="gh a" onclick="printerSettings()">Atur</button></div></div>
<div class="cd"><h3>Tampilan</h3><div class="seg"><button class="${th == 'auto' ? 'a' : ''}" onclick="setTheme('auto')">Otomatis</button><button class="${th == 'light' ? 'a' : ''}" onclick="setTheme('light')">Terang</button><button class="${th == 'dark' ? 'a' : ''}" onclick="setTheme('dark')">Gelap</button></div></div>
${adm ? rptCard() + mitraCard() + payCard() + uiOrgCard() + absSetCard() : ''}${adm ? `<div class="cd"><h3>Profil & pajak toko</h3><div class="fm"><input id="sn" placeholder="Nama toko" value="${esc(S.name)}"><input id="sa" placeholder="Alamat (tampil di struk)" value="${esc(S.set.addr || '')}"><input id="st" placeholder="Telepon" value="${esc(S.set.tel || '')}"><div class="fm2"><input id="sp" type="number" min="0" max="100" step="0.5" placeholder="PPN %" value="${S.set.ppn ?? 11}"><input id="sd" type="number" placeholder="Tempo kredit bawaan (hari)" value="${S.set.tempo || 30}"></div><div class="fm2"><input id="sj" type="time" value="${esc(S.set.jin || '08:00')}"><label class="row" style="margin:0"><span>Blokir kredit jika ada tagihan jatuh tempo</span><input type="checkbox" id="so" ${S.set.od ? 'checked' : ''}></label></div><label class="gh">Logo toko<input type="file" accept="image/*" onchange="setLogo(this)"></label><button class="gh" onclick="setGeo()">📍 Set lokasi toko untuk absensi (${S.set.glat != null ? 'sudah diatur' : 'belum'})</button><button class="pr" onclick="saveSet()">Simpan pengaturan</button></div></div>` : ''}
<div class="cd"><h3>Server</h3><div class="fm"><input id="sv" placeholder="https://jpos-api.<akun>.workers.dev" value="${esc(AP)}"><button class="gh" onclick="if(confirm('Ubah alamat server? Alamat yang salah membuat HP ini tidak bisa sinkron.'))saveApi()">Simpan & tes koneksi</button>${apiCustom() ? '<button class="gh" onclick="srvReset()">↺ Kembalikan ke server bawaan</button>' : ''}</div><small class="mu">🔒 Hanya pemilik yang bisa mengubah. Karyawan tidak bisa mengubah alamat server, baik di dalam aplikasi maupun di layar awal.</small></div>
${can('backup') ? `<div class="cd"><h3>Data</h3><div class="wrap"><button class="gh" onclick="expBackup()">⬇ Backup JSON</button>${S.srv ? '' : '<label class="gh">Pulihkan backup<input type="file" accept=".json" onchange="restoreBackup(this)"></label>'}<button class="gh" onclick="expXlsx('all')">⬇ Laporan lengkap Excel</button></div><small class="mu">${S.srv ? 'Data toko online tersimpan aman di server; backup ini hanya salinan.' : 'Toko lokal: backup berkala sangat disarankan.'}</small></div>` : ''}`;
};
function setTheme(t) { LS.set('jpos:theme', t); applyTheme(); R(); }
function applyTheme() { const t = LS.get('jpos:theme', 'auto'); if (t == 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
function saveSet() {
  const set = { addr: $('#sa').value.trim(), tel: $('#st').value.trim(), ppn: Math.max(0, Math.min(100, parseFloat($('#sp').value) || 0)), tempo: num($('#sd').value) || 30, jin: $('#sj').value || '08:00', od: $('#so').checked };
  emit('set', { set, name: $('#sn').value.trim() || S.name }); toast('Pengaturan disimpan'); R();
}
async function setLogo(el) { const f = el.files[0]; if (!f) return; emit('set', { set: {}, logo: await imgData(f, 96) }); R(); }
async function setGeo() { toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) return toast('Lokasi tidak tersedia'); emit('set', { set: { glat: p.lat, glng: p.lng, grad: 200 } }); toast('Lokasi toko tersimpan (radius 200 m untuk kasir/akuntan)'); R(); }
async function saveApi() {
  if (!SRVOK && !(U && S && U.r == 'owner')) return toast('Alamat server hanya bisa diubah pemilik toko');
  const v = $('#sv').value.trim().replace(/\/$/, ''); LS.set('jpos:api', v); AP = v || AP;
  if (!v) { AP = ''; return toast('Mode lokal'); }
  try { await fetch(v + '/api/ping').then((r) => { if (!r.ok) throw 0; }); toast('Terhubung ke server ✓'); kick(); } catch (e) { toast('Tidak bisa terhubung ke server'); }
}

function bioSetup() { const m = modal(`<h3>👆 Login sidik jari</h3><small class="mu">Masukkan PIN Anda sekali untuk mengaktifkan.</small><input id="bp" type="password" inputmode="numeric" placeholder="PIN"><button class="pr" id="ok">Lanjut</button>`); $('#ok', m).onclick = async () => { const pin = $('#bp', m).value; const u = S.users.find((x) => x.n == U.n); if (u && u.h && u.h != (await sha(SID + ':' + U.n.toLowerCase() + ':' + pin))) return toast('PIN salah'); m.close(); if (await bioEnable(SID, U.n, pin)) R(); }; }
