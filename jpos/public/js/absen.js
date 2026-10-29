'use strict';
/* ============ WAJIB ABSEN + ALARM PENGINGAT ============ */
const ABSROLES = ['admin', 'akuntan', 'kasir', 'sales', 'dropping'];
const gNow = () => (typeof trustNow == 'function' && trustNow()) || Date.now();     // jam tepercaya (server) bila ada, agar tanggal HP tidak bisa dipakai mengakali
const absReq = () => !!(U && S && !S.locked && S.set.absReq !== false && (ABSROLES.includes(U.r) || (U.r == 'owner' && S.set.absOwn === true)));
const absDone = () => S.att.some((a) => a.u == U.n && a.k == 'in' && dkey(a.t) == dkey(gNow()));
const absGate = () => absReq() && !absDone();
const almTime = () => /^\d\d:\d\d$/.test(S.set.alm || '') ? S.set.alm : '07:30';
const almOn = () => absReq() && S.set.almOn !== false && LS.get('jpos:alm', '1') != '0';

/* ---------- layar "absen dulu" ---------- */
function absGateView() {
  const anti = antiOn(), off = S.srv && !canNet(), blockOff = anti && !S.set.aoff && off;
  return `<header><button class="av">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : esc((S.name || '?')[0].toUpperCase())}</button><div class="hn"><b>${esc(S.name)}</b><small>${esc(U.n)} · ${esc(ROLE[U.r])}</small></div><span class="sp"></span><span id="sy" class="bd"></span></header>
<main class="gate"><div class="gc"><small class="gh1">${esc(greet())}, ${esc(U.n)} 👋</small><div class="gclk" id="gclk">${hm(gNow())}</div><div class="gdt">${todayLong()}</div>
<div class="gmsg"><b>Absen masuk dulu untuk mulai bekerja</b><small>Fitur aplikasi terbuka setelah Anda absen hari ini. Jam masuk ${esc(S.set.jin || '08:00')} (toleransi 10 menit).</small></div>
<input id="an" placeholder="Catatan (opsional)">
<button class="gbtn" onclick="clock('in')" ${blockOff ? 'disabled' : ''}><i>🕒</i> Absen masuk sekarang</button>
${blockOff ? '<small class="rd">Perangkat sedang offline. Absen butuh internet agar jam diverifikasi server — sambungkan internet lalu coba lagi.</small>' : ''}
<div class="gchk"><span>${anti ? '📸 Selfie' : '📍 Lokasi'}</span><span>${anti ? '📍 GPS' : '⏱ Jam'}</span><span>⏱ Jam server</span></div>
<div class="wrap" style="justify-content:center;margin-top:14px"><button class="gh" onclick="sync().then(()=>{if(!absGate())R();else toast('Belum ada absen hari ini')})">⟳ Cek ulang</button><button class="gh" onclick="almToggleDev()">${LS.get('jpos:alm', '1') != '0' ? '🔔 Alarm aktif' : '🔕 Alarm mati'}</button><button class="gh d" onclick="logout()">Keluar</button></div></div></main>`;
}
let gclkT = null;
function absGateAfter() {
  clearInterval(gclkT); gclkT = setInterval(() => { const e = $('#gclk'); if (!e) return clearInterval(gclkT); e.textContent = hm(gNow()); }, 15000);
  if (S.srv && canNet() && !absGateAfter.ld) { absGateAfter.ld = 1; sync().then(() => { if (U && !absGate() && !$('.md')) R(); }).catch(() => { }).finally(() => setTimeout(() => (absGateAfter.ld = 0), 20000)); }
}

/* ---------- pengaturan owner ---------- */
function absSetCard() {
  const sw = (id, lb, on, hint) => `<label class="row" style="margin:6px 0"><span>${lb}${hint ? '<br><small class="mu">' + hint + '</small>' : ''}</span><input type="checkbox" id="${id}" style="width:24px;height:24px" ${on ? 'checked' : ''}></label>`;
  return `<div class="cd"><h3>🕒 Wajib absen & alarm</h3>${sw('ab1', 'Wajib absen masuk sebelum memakai aplikasi', S.set.absReq !== false, 'Admin, akuntan, kasir, sales, dan dropping baru bisa beraktivitas setelah absen hari itu')}${sw('ab2', 'Berlaku juga untuk pemilik', S.set.absOwn === true)}${sw('ab6', 'Verifikasi wajah saat absen', S.set.fv !== false, 'Selfie dicocokkan dengan wajah acuan karyawan (absen pertama = pendaftaran wajah). Tidak cocok = absen ditolak')}${sw('ab3', 'Alarm pengingat absen di HP karyawan', S.set.almOn !== false, 'Berbunyi keras di HP yang terpasang aplikasi, 3× (jam alarm, +5 mnt, +10 mnt) selama belum absen')}
<div class="fm2"><label><small class="mu">Jam alarm</small><input id="ab4" type="time" value="${esc(almTime())}"></label><label class="row" style="margin:0;align-self:end"><span>Termasuk hari Minggu</span><input type="checkbox" id="ab5" style="width:24px;height:24px" ${S.set.almMg !== false ? 'checked' : ''}></label></div>
<button class="gh a" style="margin-top:8px" onclick="absSave()">Simpan</button><small class="mu">Catatan: alarm mengikuti volume & mode HP (Android tidak mengizinkan aplikasi menembus mode senyap/Jangan Ganggu). Pastikan izin Notifikasi dan “Alarm & pengingat” diizinkan.</small></div>`;
}
function absSave() { emit('set', { set: { absReq: $('#ab1').checked, absOwn: $('#ab2').checked, almOn: $('#ab3').checked, alm: $('#ab4').value || '07:30', almMg: $('#ab5').checked, fv: $('#ab6').checked } }); toast('Pengaturan absen disimpan'); R(); }
function almToggleDev() { const on = LS.get('jpos:alm', '1') != '0'; LS.set('jpos:alm', on ? '0' : '1'); toast(on ? 'Alarm di HP ini dimatikan' : 'Alarm di HP ini diaktifkan'); almSig = ''; R(); }

/* ---------- alarm di HP (notifikasi terjadwal, tetap berbunyi walau aplikasi ditutup) ---------- */
let almSig = '';
async function almSync(force) {
  const LN = typeof plug == 'function' && isNative() && plug('LocalNotifications'); if (!LN) return;
  const on = !!(U && S && almOn()), sig = on ? [U.n, almTime(), S.set.almMg !== false, absDone(), dkey(gNow())].join('|') : 'off';
  if (!force && sig == almSig) return; almSig = sig;
  try {
    const pend = await LN.getPending(), mine = (pend.notifications || []).filter((n) => n.id >= 7000 && n.id < 7300);
    if (mine.length) await LN.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
    if (!on) return;
    const pm = await LN.requestPermissions(); if (pm.display != 'granted') { toast('Izinkan notifikasi agar alarm absen berbunyi', 5000); return; }
    try { await LN.createChannel({ id: 'absen', name: 'Alarm absen', description: 'Pengingat absen masuk', importance: 5, visibility: 1, vibration: true, lights: true }); } catch (e) { }
    const [h, m] = almTime().split(':').map(Number), now = Date.now(), done = absDone(), list = [], T = ['⏰ Waktunya absen masuk!', '⏰ Anda belum absen', '⏰ Segera absen — sudah terlambat'];
    for (let d = 0; d < 30; d++) {
      const day = new Date(); day.setDate(day.getDate() + d); day.setHours(h, m, 0, 0);
      if (day.getDay() == 0 && S.set.almMg === false) continue; if (d == 0 && done) continue;
      for (let k = 0; k < 3; k++) { const at = new Date(day.getTime() + k * 300000); if (at.getTime() <= now) continue; list.push({ id: 7000 + d * 3 + k, title: T[k], body: (S.name || 'J-POS') + ' · buka J-POS lalu tekan “Absen masuk”.', schedule: { at, allowWhileIdle: true }, channelId: 'absen', autoCancel: true }); }
    }
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.warn('alarm', e); almSig = ''; }
}

/* ---------- alarm saat aplikasi sedang terbuka ---------- */
let ringCtx = null, ringT = null, ringVib = null;
function ringStop() { clearInterval(ringT); clearInterval(ringVib); ringT = ringVib = null; try { ringCtx && ringCtx.close(); } catch (e) { } ringCtx = null; const e = $('#almring'); if (e) e.remove(); }
function ringStart() {
  if ($('#almring') || $('.md,.scan')) return;   // jangan menutupi kamera selfie / dialog yang sedang dipakai
  const el = document.createElement('div'); el.id = 'almring';
  el.innerHTML = `<div class="rg"><div class="rb">⏰</div><h2>Waktunya absen masuk!</h2><p>${hm(gNow())} · ${esc(U.n)}</p><button class="gbtn" onclick="ringStop();clock('in')">Absen sekarang</button><button class="gh" onclick="ringSnooze()">Tunda 5 menit</button><button class="gh d" onclick="ringOff()">Matikan alarm hari ini</button></div>`;
  document.body.appendChild(el);
  try { const AC = window.AudioContext || window.webkitAudioContext; ringCtx = new AC(); let f = 0; const beep = () => { const o = ringCtx.createOscillator(), g = ringCtx.createGain(); o.type = 'square'; o.frequency.value = f++ % 2 ? 660 : 990; g.gain.value = 1; o.connect(g); g.connect(ringCtx.destination); o.start(); o.stop(ringCtx.currentTime + 0.22); }; ringCtx.resume && ringCtx.resume(); beep(); ringT = setInterval(beep, 450); } catch (e) { }
  try { navigator.vibrate && (navigator.vibrate([500, 200, 500, 200, 500]), ringVib = setInterval(() => navigator.vibrate([500, 200, 500, 200, 500]), 2500)); } catch (e) { }
}
function ringSnooze() { LS.set('jpos:almSn', gNow() + 300000); ringStop(); }
function ringOff() { LS.set('jpos:almOff', dkey(gNow())); ringStop(); }
function almTick() {
  try {
    if (!U || !S || !almOn()) return ringStop();
    if (absDone()) return ringStop();
    const [h, m] = almTime().split(':').map(Number), n = new Date(gNow()), mins = n.getHours() * 60 + n.getMinutes(), st = h * 60 + m;
    if (n.getDay() == 0 && S.set.almMg === false) return;
    if (mins < st || mins > st + 30) return; if (LS.get('jpos:almOff', '') == dkey(gNow())) return; if (LS.get('jpos:almSn', 0) > gNow()) return;
    ringStart();
  } catch (e) { }
}
setInterval(almTick, 15000); setTimeout(almTick, 3000);
