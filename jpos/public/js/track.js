'use strict';
/* ============ PANTAU LOKASI LATAR (foreground service Android) ============
   Agar pemilik bisa memantau sales / kanvas / dropping walau aplikasi tidak sedang dibuka di layar.
   PENTING — ini dibuat TRANSPARAN & dengan izin karyawan, bukan mata-mata tersembunyi:
   • Berjalan sebagai foreground service dengan NOTIFIKASI yang selalu tampil di HP karyawan ("J-POS berbagi lokasi").
   • Karyawan menyetujui izin lokasi "Izinkan sepanjang waktu" dan notifikasi.
   • Berjalan hanya untuk peran lapangan saat sudah absen masuk / jam kerja, dan berhenti saat absen pulang / keluar.
   Android tidak mengizinkan aplikasi yang tak bisa dimatikan atau tak bisa di-uninstall; itu di luar kendali aplikasi. */
const BGEO = () => plug('BackgroundGeolocation');
let TRKID = null, TRKlast = 0, TRKon = false;
async function trackSync() {
  if (!isNative() || !BGEO()) return;
  const want = !!U && S && S.srv && GPSR.includes(U.r) && !isExp() && (LS.get('jpos:sharing', '1') != '0' || LOCMUST()) && (typeof clockedIn != 'function' || clockedIn());
  if (want && !TRKon) return trackStart();
  if (!want && TRKon) return trackStop();
}
async function trackStart() {
  const B = BGEO(); if (!B || TRKon) return; TRKon = true;
  try {
    TRKID = await B.addWatcher({
      backgroundTitle: 'J-POS • berbagi lokasi kerja',
      backgroundMessage: 'Lokasi Anda dibagikan ke pemilik toko selama jam kerja. Berhenti otomatis saat absen pulang / keluar aplikasi.',
      requestPermissions: true, stale: false, distanceFilter: 20,
    }, (loc, err) => {
      if (err) { if (err.code === 'NOT_AUTHORIZED') LS.set('jpos:bgdenied', 1); return; }
      if (!loc || !U) return; const now = Date.now();
      if (now - TRKlast < 45000) return; TRKlast = now; // kirim maks ~tiap 45 detik
      try {
        LOCG = { t: now, lat: loc.latitude, lng: loc.longitude };
        emit('loc', { lat: +loc.latitude.toFixed(6), lng: +loc.longitude.toFixed(6), acc: loc.accuracy ? Math.round(loc.accuracy) : null, pg: 'bg' });
        if (canNet()) sync().catch(() => { });
      } catch (e) { }
    });
  } catch (e) { TRKon = false; console.warn('track start', e && e.message); }
}
async function trackStop() { const B = BGEO(); if (!B || !TRKID) { TRKon = false; return; } try { await B.removeWatcher({ id: TRKID }); } catch (e) { } TRKID = null; TRKon = false; }
// jadikan izin "sepanjang waktu" jelas bagi karyawan (dipanggil dari banner)
function trackAsk() {
  const B = BGEO(); if (!B) return toast('Pantau lokasi latar hanya tersedia di aplikasi Android (APK)');
  if (B.openSettings && LS.get('jpos:bgdenied', 0)) { if (confirm('Agar lokasi tetap terkirim saat aplikasi ditutup, izinkan lokasi "Sepanjang waktu" di pengaturan aplikasi. Buka pengaturan sekarang?')) B.openSettings(); return; }
  trackStart();
}
// cek berkala & saat aplikasi kembali dibuka
setInterval(() => { try { trackSync(); } catch (e) { } }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState == 'visible') { try { trackSync(); } catch (e) { } } });
setTimeout(() => { try { trackSync(); } catch (e) { } }, 8000);
