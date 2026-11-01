'use strict';
/* ============ PANTAU LOKASI LATAR (foreground service Android) ============
   Agar pemilik bisa memantau sales / kanvas / dropping (yang memegang uang & barang usaha) walau:
   aplikasi ditutup, karyawan sudah keluar akun (logout), atau belum absen masuk.
   TRANSPARAN & dengan persetujuan karyawan, bukan mata-mata tersembunyi:
   • Persetujuan tertulis tampil sekali di HP karyawan sebelum pelacakan aktif.
   • Berjalan sebagai foreground service dengan NOTIFIKASI yang selalu tampil ("J-POS berbagi lokasi").
   • Hanya pada JAM KERJA yang diatur pemilik (bawaan 06.00–21.00), tidak 24 jam.
   • Memakai token pelacak khusus yang hanya bisa mengirim titik lokasi (tidak bisa membuka data toko).
   • Pemilik bisa menghentikan pelacakan per karyawan; karyawan juga bisa mencabut izin lokasi di pengaturan HP.
   Android tidak mengizinkan aplikasi yang tak bisa dimatikan atau tak bisa di-uninstall; itu di luar kendali aplikasi. */
const BGEO = () => plug('BackgroundGeolocation');
const TRKK = 'jpos:trk', TRKQ = 'jpos:trkq', TRKOKK = 'jpos:trkok';
let TRKID = null, TRKlast = 0, TRKon = false, TRKask = false;
const trkRec = () => LS.get(TRKK, null);
const trkHrs = () => { const r = trkRec(), s = (S && S.set) || {}, f = Number.isFinite(+s.trkFrom) && s.trkFrom !== '' && s.trkFrom != null ? +s.trkFrom : r && Number.isFinite(+r.from) ? +r.from : 6, t = Number.isFinite(+s.trkTo) && s.trkTo !== '' && s.trkTo != null ? +s.trkTo : r && Number.isFinite(+r.to) ? +r.to : 21; return [Math.max(0, Math.min(23, f)), Math.max(1, Math.min(24, t))]; };
const trkInHours = () => { const [f, t] = trkHrs(), h = new Date().getHours(); return f < t ? h >= f && h < t : h >= f || h < t; };
// token pelacak khusus (berlaku 90 hari; diperbarui otomatis tiap login)
async function trkIssue() {
  if (!U || !GPSR.includes(U.r) || !S || !S.srv || !canNet()) return;
  const cur = trkRec(), [f, t] = trkHrs();
  if (cur && cur.sid == SID && cur.u == U.n && !cur.stop && cur.exp - Date.now() > 30 * 864e5) { if (cur.from != f || cur.to != t) LS.set(TRKK, { ...cur, from: f, to: t }); return; }
  try { const r = await api('/api/trk/issue', { method: 'POST', body: '{}' }); LS.set(TRKK, { tok: r.trk, exp: r.exp, u: U.n, r: U.r, sid: SID, ap: AP, from: f, to: t }); } catch (e) { }
}
// persetujuan karyawan (pengungkapan jelas sebelum pelacakan latar aktif)
function trkConsent() {
  if (LS.get(TRKOKK, 0)) return true; if (TRKask || !U) return false; TRKask = true; const [f, t] = trkHrs();
  const m = modal(`<h3>📍 Persetujuan berbagi lokasi kerja</h3><div style="font-size:14px;line-height:1.6"><p>Karena Anda memegang uang dan barang usaha, aplikasi ini akan mengirim <b>lokasi HP Anda ke pemilik / admin toko</b>:</p><ul style="margin:6px 0 6px 18px"><li>pada <b>jam kerja ${String(f).padStart(2, '0')}.00–${String(t).padStart(2, '0')}.00</b> saja,</li><li><b>walau aplikasi ditutup, Anda keluar akun, atau belum absen</b>,</li><li>dengan <b>notifikasi tetap</b> di HP selama lokasi dibagikan,</li><li>riwayat perjalanan & lama singgah disimpan <b>30 hari</b> lalu dihapus otomatis.</li></ul><p class="mu" style="font-size:13px">Data hanya untuk memantau pekerjaan dan keamanan aset usaha, tidak dijual dan tidak dipakai untuk iklan (lihat kebijakan privasi). Anda bisa mencabut izin lokasi kapan saja di pengaturan HP, namun pemilik toko akan melihat HP Anda tidak terdeteksi.</p></div><div class="wrap" style="margin-top:12px"><button class="pr" id="trkY">Saya setuju & aktifkan</button><button class="gh" id="trkN">Nanti</button></div>`, 'w');
  $('#trkY', m).onclick = () => { LS.set(TRKOKK, 1); m.close(); TRKask = false; trackSync(); trackAsk(); };
  $('#trkN', m).onclick = () => { m.close(); setTimeout(() => { TRKask = false; }, 6 * 36e5); };
  return false;
}
async function trackSync() {
  if (!isNative() || !BGEO()) return;
  let want;
  if (U) {
    want = !!(S && S.srv && GPSR.includes(U.r) && !isExp() && (LS.get('jpos:sharing', '1') != '0' || LOCMUST())); if (want) { await trkIssue(); want = trkConsent(); }
  } else { const r = trkRec(); want = !!(r && !r.stop && r.exp > Date.now() && LS.get(TRKOKK, 0)); } // keluar akun: tetap melacak dengan token pelacak
  want = want && trkInHours();
  if (want && !TRKon) return trackStart();
  if (!want && TRKon) return trackStop();
}
// antrean titik (saat tanpa sinyal) → kirim ke /api/trk/loc
function trkQueue(p) { const q = LS.get(TRKQ, []); q.push(p); LS.set(TRKQ, q.slice(-300)); }
let TRKbusy = false;
async function trkFlush() {
  const r = trkRec(); if (!r || TRKbusy) return; let q = LS.get(TRKQ, []); if (!q.length) return; TRKbusy = true;
  try {
    while (q.length) {
      const part = q.slice(0, 20), res = await fetch((r.ap || AP) + '/api/trk/loc', { method: 'POST', headers: { Authorization: 'Bearer ' + r.tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: part }) });
      if (res.ok) { q = q.slice(part.length); LS.set(TRKQ, q); continue; }
      const j = await res.json().catch(() => ({})); if (j.stop || res.status == 401 || res.status == 403) { LS.set(TRKK, { ...r, stop: 1 }); LS.del(TRKQ); trackStop(); }
      break;
    }
  } catch (e) { } TRKbusy = false;
}
async function trackStart() {
  const B = BGEO(); if (!B || TRKon) return; TRKon = true;
  try {
    TRKID = await B.addWatcher({
      backgroundTitle: 'J-POS • berbagi lokasi kerja',
      backgroundMessage: 'Lokasi dibagikan ke pemilik toko pada jam kerja. Hubungi pemilik untuk menghentikan.',
      requestPermissions: true, stale: false, distanceFilter: 20,
    }, (loc, err) => {
      if (err) { if (err.code === 'NOT_AUTHORIZED') LS.set('jpos:bgdenied', 1); return; }
      if (!loc) return; const now = Date.now();
      if (now - TRKlast < 45000) return; TRKlast = now; // kirim maks ~tiap 45 detik
      if (!trkInHours()) { trackSync(); return; }
      try {
        const rec = trkRec(), la = +loc.latitude.toFixed(6), ln = +loc.longitude.toFixed(6), ac = loc.accuracy ? Math.round(loc.accuracy) : null;
        if (U && GPSR.includes(U.r)) { LOCG = { t: now, lat: loc.latitude, lng: loc.longitude }; emit('loc', { lat: la, lng: ln, acc: ac, pg: 'bg' }); if (canNet()) sync().catch(() => { }); }
        else if (rec && !rec.stop) { trkQueue({ t: now, lat: la, lng: ln, acc: ac }); trkFlush(); }
      } catch (e) { }
    });
  } catch (e) { TRKon = false; console.warn('track start', e && e.message); }
}
async function trackStop() { const B = BGEO(); if (!B || !TRKID) { TRKon = false; return; } try { await B.removeWatcher({ id: TRKID }); } catch (e) { } TRKID = null; TRKon = false; }
// jadikan izin "sepanjang waktu" jelas bagi karyawan (dipanggil dari banner)
function trackAsk() {
  const B = BGEO(); if (!B) return toast('Pantau lokasi latar hanya tersedia di aplikasi Android (APK)');
  if (B.openSettings && LS.get('jpos:bgdenied', 0)) { if (confirm('Agar lokasi tetap terkirim saat aplikasi ditutup, izinkan lokasi "Sepanjang waktu" di pengaturan aplikasi. Buka pengaturan sekarang?')) B.openSettings(); return; }
  if (U && !trkConsent()) return; trackStart();
}
// cek berkala & saat aplikasi kembali dibuka (juga saat belum login)
setInterval(() => { try { trackSync(); trkFlush(); } catch (e) { } }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState == 'visible') { try { trackSync(); trkFlush(); } catch (e) { } } });
setTimeout(() => { try { trackSync(); trkFlush(); } catch (e) { } }, 4000);
