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

// Lokasi GPS: {lat,lng,acc} atau null
async function getPos(fresh) {
  const G = plug('Geolocation');
  if (isNative() && G) {
    try { if (G.requestPermissions) await G.requestPermissions(); const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: fresh ? 0 : 10000 }); return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; } catch (e) { console.warn(e); }
  }
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => ok(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: fresh ? 0 : 20000 });
  });
}

/* ============ scan barcode ============ */
// Urutan: ML Kit native (APK) -> BarcodeDetector -> ZXing JS. Input manual & scanner Bluetooth (mode keyboard) selalu bisa.
async function scanCode(onCode, opt = {}) {
  const N = plug('BarcodeScanner');
  if (isNative() && N && N.scan) {
    try {
      if (N.requestPermissions) await N.requestPermissions();
      const r = await N.scan();
      const v = r && r.barcodes && r.barcodes[0] && (r.barcodes[0].rawValue || r.barcodes[0].displayValue);
      if (v) { onCode(String(v)); if (opt.multi) return scanCode(onCode, opt); }
      return;
    } catch (e) { if (/cancel/i.test(String(e && e.message))) return; console.warn('ML Kit gagal, pakai kamera web', e); }
  }
  openWebScanner(onCode, opt);
}
function openWebScanner(onCode, opt = {}) {
  const el = document.createElement('div'); el.className = 'scan';
  el.innerHTML = `<video playsinline muted></video><div class="bx"></div><div class="bar"><input placeholder="…atau ketik kode lalu Enter" inputmode="numeric"><button class="gh" id="sx">Tutup</button></div>`;
  document.body.appendChild(el);
  const video = $('video', el), inp = $('input', el); let stream = null, stop = false, reader = null, last = '', lastT = 0;
  const done = () => { stop = true; try { reader && reader.reset(); } catch (e) { } if (stream) stream.getTracks().forEach((t) => t.stop()); el.remove(); };
  const hit = (v) => { v = String(v || '').trim(); if (!v) return; const n = Date.now(); if (v == last && n - lastT < 1800) return; last = v; lastT = n; if (navigator.vibrate) navigator.vibrate(60); onCode(v); if (!opt.multi) done(); };
  $('#sx', el).onclick = done;
  inp.addEventListener('keydown', (e) => { if (e.key == 'Enter') { hit(inp.value); inp.value = ''; } });
  (async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('kamera tidak tersedia');
      const c = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false };
      if ('BarcodeDetector' in window) {
        const fm = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'], sup = await BarcodeDetector.getSupportedFormats().catch(() => fm);
        const det = new BarcodeDetector({ formats: fm.filter((f) => sup.includes(f)) });
        stream = await navigator.mediaDevices.getUserMedia(c); video.srcObject = stream; await video.play();
        const loop = async () => { if (stop) return; try { const r = await det.detect(video); if (r[0]) hit(r[0].rawValue); } catch (e) { } setTimeout(loop, 200); }; loop();
      } else if (window.ZXing) {
        reader = new ZXing.BrowserMultiFormatReader();
        await reader.decodeFromConstraints(c, video, (res) => { if (res && !stop) hit(res.getText()); });
      } else throw new Error('pemindai tidak tersedia');
    } catch (e) { toast('Kamera tidak bisa dibuka (' + (e.message || e) + '). Ketik kode secara manual.', 4500); inp.focus(); }
  })();
}
