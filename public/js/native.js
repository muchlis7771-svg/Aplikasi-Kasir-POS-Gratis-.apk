'use strict';
/* ============ jembatan Android (Capacitor) + fallback web ============ */
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plug = (n) => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n];

const toB64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob); });
// Simpan/bagikan berkas: di APK lewat lembar "Bagikan" Android (simpan ke Drive/WhatsApp/dll), di web lewat unduhan biasa.
async function saveFile(name, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  if (isNative() && plug('Filesystem')) {
    try {
      const w = await plug('Filesystem').writeFile({ path: name, data: await toB64(blob), directory: 'CACHE' });
      if (plug('Share')) { await plug('Share').share({ title: name, url: w.uri, dialogTitle: 'Simpan / bagikan ' + name }); return; }
      toast('Tersimpan: ' + w.uri, 5000); return;
    } catch (e) { if (/cancel/i.test(String(e && e.message))) return; console.error(e); toast('Gagal menyimpan berkas'); return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function shareText(title, text) {
  if (isNative() && plug('Share')) { try { await plug('Share').share({ title, text }); } catch (e) { } return; }
  if (navigator.share) { try { await navigator.share({ title, text }); } catch (e) { } return; }
  try { await navigator.clipboard.writeText(text); toast('Teks disalin'); } catch (e) { toast('Tidak bisa membagikan'); }
}

// Lokasi GPS: {lat,lng,acc} atau null. Koordinat tidak valid (0,0 / di luar jangkauan) ditolak —
// beberapa HP Android sesaat memberi 0,0 saat GPS belum "fix", yang membuat jarak terbaca ribuan km.
const posOk = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(Math.abs(p.lat) < 0.01 && Math.abs(p.lng) < 0.01);
async function getPos1(fresh) {
  const G = plug('Geolocation');
  if (isNative() && G) {
    try { if (G.requestPermissions) await G.requestPermissions(); const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: fresh ? 0 : 10000 }); const r = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; if (posOk(r)) return r; } catch (e) { console.warn(e); }
  }
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => { const r = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; ok(posOk(r) ? r : null); }, () => ok(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: fresh ? 0 : 20000 });
  });
}
async function getPos(fresh) { for (let i = 0; i < 3; i++) { const p = await getPos1(fresh || i > 0); if (p) return p; await new Promise((r) => setTimeout(r, 1200)); } return null; }
// Titik paling akurat: pantau GPS sampai akurasi ≤ target meter (atau batas waktu), ambil rata-rata dari pembacaan terbaik.
async function precisePos(target = 15, maxMs = 20000, onUpd) {
  const fixes = [], t0 = Date.now(); let best = null;
  while (Date.now() - t0 < maxMs) {
    const p = await getPos1(true); if (p) { fixes.push(p); if (!best || (p.acc || 1e9) < (best.acc || 1e9)) best = p; onUpd && onUpd(best, fixes.length); if ((best.acc || 1e9) <= target && fixes.length >= 2) break; }
    await new Promise((r) => setTimeout(r, 900));
  }
  if (!best) return null;
  const good = fixes.filter((f) => (f.acc || 1e9) <= Math.max(10, (best.acc || 0) * 1.5)), w = good.reduce((a, f) => a + 1 / Math.max(1, f.acc || 1) ** 2, 0);
  const lat = good.reduce((a, f) => a + f.lat / Math.max(1, f.acc || 1) ** 2, 0) / w, lng = good.reduce((a, f) => a + f.lng / Math.max(1, f.acc || 1) ** 2, 0) / w;
  return { lat, lng, acc: best.acc, n: fixes.length };
}

/* ============ scan barcode ============ */
// Urutan: ML Kit native (APK) -> BarcodeDetector -> ZXing JS. Input manual & scanner Bluetooth (mode keyboard) selalu bisa.
// anti scan dobel: kode yang sama dalam jeda singkat (mis. kamera belum sempat digeser) tidak dihitung dua kali, qty tidak bertambah ganda.
let SCANLAST = '', SCANLASTT = 0;
const scanDup = (v) => { const n = Date.now(); if (v == SCANLAST && n - SCANLASTT < 2000) return true; SCANLAST = v; SCANLASTT = n; return false; };
async function scanCode(onCode, opt = {}) {
  // onCode mengembalikan false bila kode tidak dikenal → scan beruntun berhenti agar pengguna bisa menambah produk
  const N = plug('BarcodeScanner');
  if (isNative() && N && N.scan) {
    try {
      if (N.isGoogleBarcodeScannerModuleAvailable) { const a = await N.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: true })); if (a && a.available === false) { toast('Menyiapkan pemindai Google… (sekali saja, butuh internet)', 4000); try { await N.installGoogleBarcodeScannerModule(); } catch (e) { } throw new Error('modul belum siap'); } }
      const r = await N.scan();
      const v = r && r.barcodes && r.barcodes[0] && (r.barcodes[0].rawValue || r.barcodes[0].displayValue);
      if (v) {
        const vv = String(v).trim();
        if (scanDup(vv)) { if (opt.multi) setTimeout(() => scanCode(onCode, opt), 350); return; } // kode sama dalam 2 detik — abaikan, jangan tambah qty lagi
        if (navigator.vibrate) navigator.vibrate(60);
        const ok = onCode(vv);
        // onCode boleh mengembalikan teks (bukan cuma true/false) berisi nama+qty hasil scan — ditampilkan jelas supaya kasir tahu pasti sudah tercatat & tidak scan dobel (pemindai OS tidak punya overlay di dalam app)
        if (typeof ok == 'string') toast('✓ ' + ok, 2200);
        if (opt.multi && ok !== false) setTimeout(() => scanCode(onCode, opt), 350);
      } else {
        // sesi scan selesai tapi tidak ada kode terbaca (bukan dibatalkan user — itu masuk ke catch di bawah sebagai "cancel").
        // sebelumnya ini diam saja tanpa kabar apa pun ke kasir, terasa seperti "barcode tidak terbaca" tanpa penjelasan.
        toast('Barcode tidak terbaca. Pastikan kode tidak buram/terlalu dekat & cahaya cukup, lalu coba lagi — atau ketik kodenya di kolom "Cari nama / SKU".', 5000);
      }
      return;
    } catch (e) { if (/cancel/i.test(String(e && (e.message || e.code)))) return; console.warn('ML Kit gagal, pakai kamera aplikasi', e); }
  }
  openWebScanner(onCode, opt);
}

/* ============ scanner barcode eksternal (mesin USB / Bluetooth) ============ */
// Hampir SEMUA mesin scan barcode (USB maupun Bluetooth, segala merek) punya mode bawaan "HID keyboard wedge": begitu
// memindai, kodenya langsung "diketik" + Enter ke kolom yang sedang aktif — persis seperti keyboard. Karena itu kolom
// pencarian produk, kolom SKU, dsb di J-POS SUDAH otomatis bisa menerima scan dari mesin seperti itu tanpa pengaturan
// apa pun, selama kolomnya sedang disentuh/fokus. Listener di bawah ini menutup satu celah: saat TIDAK ada kolom yang
// fokus (mis. kasir sedang lihat daftar produk, belum tap kolom cari) — mendeteksi ketikan sangat cepat khas mesin
// scan (jauh lebih cepat dari manusia mengetik) lalu arahkan otomatis ke aksi yang tepat sesuai layar yang sedang dibuka.
let SCN = Object.assign({ hid: false }, LS.get('jpos:scn', {}));
const scnSave = () => LS.set('jpos:scn', SCN);
let HIDBUF = '', HIDT = 0, HIDCB = null; // HIDCB: dipasang sementara oleh scannerTest() untuk menangkap 1 kode ke field tes
document.addEventListener('keydown', (e) => {
  if (!SCN.hid && !HIDCB) return;
  const ae = document.activeElement, tag = ae && ae.tagName;
  if (tag == 'INPUT' || tag == 'TEXTAREA' || (ae && ae.isContentEditable)) return; // kolom sudah fokus — biarkan mengetik alami (sudah otomatis bekerja), tidak perlu ditangkap di sini
  const now = Date.now();
  if (now - HIDT > 80) HIDBUF = ''; // jeda >80ms antar tombol = ketikan manusia biasa (bukan mesin scan) — buang, mulai kode baru
  HIDT = now;
  if (e.key == 'Enter' || e.key == 'Tab') {
    const v = HIDBUF; HIDBUF = '';
    if (v.length < 3) return;
    e.preventDefault();
    if (HIDCB) { const cb = HIDCB; HIDCB = null; cb(v); } else hidDispatch(v);
    return;
  }
  if (e.key.length == 1) HIDBUF += e.key;
});
// arahkan kode yang ditangkap scanner eksternal ke aksi yang tepat sesuai layar yang sedang dibuka saat ini
function hidDispatch(v) {
  if (typeof V != 'undefined' && V == 'pos' && document.getElementById('pg') && typeof scanHandle == 'function') { const r = scanHandle(v); if (typeof r == 'string') toast('✓ ' + r, 2200); return; }
  if (document.getElementById('osc') && typeof opnameScanHandle == 'function') { const r = opnameScanHandle(v); if (typeof r == 'string') toast('✓ ' + r, 2200); return; }
  if (document.getElementById('ppq') && typeof poScanHandle == 'function') { const r = poScanHandle(v); if (typeof r == 'string') toast('✓ ' + r, 2200); return; }
  const p = typeof bySku == 'function' ? bySku(v) : null;
  if (p) toast(p.n + ' · ' + (typeof rp == 'function' ? rp(p.pr) : p.pr) + (p.st != null ? ' · stok ' + p.st : ''), 2800);
  else toast('Kode terbaca dari scanner: ' + v, 2800);
}
// pengaturan: aktifkan/matikan mode scanner eksternal + uji coba satu kali scan
function scannerSettings() {
  const m = modal(`<h3>🔌 Scanner barcode eksternal</h3><small class="mu">Pakai mesin scan barcode USB atau Bluetooth (semua merek) selain kamera HP. Cocokkan dulu mesinnya ke HP ini:</small>
<div class="cd info" style="padding:10px;margin-top:8px"><small><b>Bluetooth:</b> nyalakan mode pairing di mesin scan (lihat manualnya), lalu sambungkan lewat Pengaturan Bluetooth bawaan HP Android (bukan di dalam J-POS) — pilih sebagai perangkat biasa.<br><b>USB:</b> colok langsung lewat kabel OTG ke HP.<br>Pastikan mesin scan dalam mode <b>"USB/Bluetooth HID Keyboard"</b> (biasanya mode bawaan/default — cek manual mesin kalau belum, biasanya dengan memindai satu barcode konfigurasi khusus dari manualnya).</small></div>
<label class="row" style="margin-top:10px"><span>Aktifkan mode scanner eksternal<br><small class="mu">Supaya scan langsung tertangkap walau belum tap kolom cari (mis. kasir sedang lihat daftar produk)</small></span><input type="checkbox" id="sch" ${SCN.hid ? 'checked' : ''} style="width:24px;height:24px"></label>
<b style="font-size:12px;display:block;margin-top:10px">🧪 Tes scan</b><small class="mu">Arahkan mesin scan ke sembarang barcode, lalu tembak/tekan tombolnya. Hasilnya muncul di bawah ini.</small>
<input id="scti" placeholder="Hasil scan akan muncul di sini…" readonly style="margin-top:6px"><button class="pr" id="ok" style="margin-top:10px">Simpan</button>`);
  HIDCB = (v) => { if (!document.body.contains(m)) { HIDCB = null; return; } const i = $('#scti', m); if (i) { i.value = v; i.style.color = 'var(--gr,#2ecc71)'; } toast('Terbaca: ' + v, 2000); };
  $('#ok', m).onclick = () => { SCN.hid = $('#sch', m).checked; scnSave(); HIDCB = null; m.close(); toast('Pengaturan scanner disimpan'); };
}
function openWebScanner(onCode, opt = {}) {
  const el = document.createElement('div'); el.className = 'scan';
  el.innerHTML = `<video playsinline muted></video><div class="bx"></div><div class="scanlbl" id="sl"></div><div class="bar"><input placeholder="…atau ketik kode lalu Enter" inputmode="numeric"><button class="gh" id="sx">Tutup</button></div>`;
  document.body.appendChild(el);
  const video = $('video', el), inp = $('input', el), lbl = $('#sl', el); let stream = null, stop = false, reader = null, lblT = null;
  const done = () => { stop = true; try { reader && reader.reset(); } catch (e) { } if (stream) stream.getTracks().forEach((t) => t.stop()); el.remove(); };
  // onCode boleh mengembalikan teks (nama produk + qty di keranjang) — ditampilkan besar & tetap di layar scan (bukan toast kecil yang cepat hilang) supaya kasir yakin sudah tercatat dan tidak scan dobel
  const showLbl = (txt) => { if (!lbl) return; lbl.textContent = '✓ ' + txt; lbl.classList.add('show'); clearTimeout(lblT); lblT = setTimeout(() => lbl.classList.remove('show'), 1800); };
  const hit = (v) => { v = String(v || '').trim(); if (!v) return; if (scanDup(v)) return; if (navigator.vibrate) navigator.vibrate(60); const ok = onCode(v); if (typeof ok == 'string') showLbl(ok); if (!opt.multi || ok === false) done(); };
  $('#sx', el).onclick = done;
  inp.addEventListener('keydown', (e) => { if (e.key == 'Enter') { hit(inp.value); inp.value = ''; } });
  (async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('kamera tidak tersedia');
      const c = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
      if ('BarcodeDetector' in window) {
        const fm = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf', 'qr_code', 'data_matrix'], sup = await BarcodeDetector.getSupportedFormats().catch(() => fm);
        const det = new BarcodeDetector({ formats: fm.filter((f) => sup.includes(f)) });
        stream = await navigator.mediaDevices.getUserMedia(c); video.srcObject = stream; await video.play();
        const loop = async () => { if (stop) return; try { const r = await det.detect(video); if (r[0]) hit(r[0].rawValue); } catch (e) { } setTimeout(loop, 200); }; loop();
      } else if (window.ZXing) {
        const hints = new Map(); try { hints.set(ZXing.DecodeHintType.TRY_HARDER, true); } catch (e) { } reader = new ZXing.BrowserMultiFormatReader(hints, 300);
        await reader.decodeFromConstraints(c, video, (res) => { if (res && !stop) hit(res.getText()); });
      } else throw new Error('pemindai tidak tersedia');
    } catch (e) { toast('Kamera tidak bisa dibuka (' + (e.message || e) + '). Ketik kode secara manual.', 4500); inp.focus(); }
  })();
}
