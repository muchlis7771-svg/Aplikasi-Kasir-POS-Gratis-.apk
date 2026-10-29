'use strict';
/* ============ VERIFIKASI WAJAH SAAT ABSEN (di HP, tanpa internet) ============
   Model pengenal wajah (face-api / TensorFlow.js) dimuat dari folder aplikasi saat pertama dibutuhkan.
   Absen pertama mendaftarkan wajah acuan; absen berikutnya dibandingkan dengan acuan itu.
   Pemilik bisa melihat & mereset wajah acuan tiap karyawan di menu Absensi. */
const FACE_TH = 0.5;            // jarak maksimum dianggap orang yang sama (semakin kecil semakin ketat)
let FAP = null;
function faceLoad() {
  if (FAP) return FAP;
  FAP = (async () => {
    if (!window.faceapi) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/face/face-api.js'; s.onload = ok; s.onerror = () => no(new Error('Modul wajah gagal dimuat')); document.head.appendChild(s); });
    const f = window.faceapi, base = 'vendor/face';
    try { await f.tf.setBackend('webgl'); } catch (e) { } try { await f.tf.ready(); } catch (e) { }
    await f.nets.tinyFaceDetector.loadFromUri(base); await f.nets.faceLandmark68Net.loadFromUri(base); await f.nets.faceRecognitionNet.loadFromUri(base);
    return f;
  })();
  FAP.catch(() => { FAP = null; });
  return FAP;
}
const faceOn = () => S.set.fv !== false;
// hasil: {n: jumlah wajah, d: deskriptor 128 angka | null}
async function faceDesc(cv) {
  const f = await faceLoad(), opt = new f.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 });
  const all = await f.detectAllFaces(cv, opt).withFaceLandmarks().withFaceDescriptors();
  if (all.length != 1) return { n: all.length, d: null };
  return { n: 1, d: Array.from(all[0].descriptor).map((v) => +v.toFixed(4)), sc: all[0].detection.score };
}
const faceDist = (a, b) => { let s = 0; for (let i = 0; i < 128; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
// dipanggil setelah selfie absen. Mengembalikan {ok, err?, fm?, baru?}
async function faceCheck(ph) {
  if (!faceOn()) return { ok: true };
  if (!selfie.big) return { ok: false, err: 'Foto wajah tidak terbaca. Ulangi absen.' };
  let r; toast('Memeriksa wajah…', 3000);
  try { r = await faceDesc(selfie.big); } catch (e) { console.warn(e); return { ok: false, err: 'Pemeriksa wajah tidak bisa dijalankan di perangkat ini (' + (e.message || e) + '). Hubungi pemilik toko.' }; }
  if (r.n == 0) return { ok: false, err: 'Wajah tidak terdeteksi. Hadapkan wajah ke kamera, cahaya cukup, tanpa masker / kacamata hitam.' };
  if (r.n > 1) return { ok: false, err: 'Terdeteksi ' + r.n + ' wajah. Absen harus sendiri, satu wajah di foto.' };
  const ref = (S.face || {})[U.n];
  if (!ref) { emit('face', { fu: U.n, d: r.d, ph }); return { ok: true, baru: 1 }; }
  const dist = faceDist(r.d, ref.d), fm = Math.round(dist * 100) / 100;
  if (dist > FACE_TH) { try { emit('sec', { w: 'wajah', d: fm }); } catch (e) { } return { ok: false, fm, err: 'Wajah tidak cocok dengan wajah terdaftar atas nama ' + U.n + ' (skor ' + fm + ', batas ' + FACE_TH + '). Percobaan ini dilaporkan ke pemilik toko.' }; }
  return { ok: true, fm };
}
function faceReset(u) { if (U.r != 'owner') return; if (!confirm('Reset wajah acuan ' + u + '? Absen berikutnya akan mendaftarkan wajah baru.')) return; emit('face', { fu: u, x: 1 }); toast('Wajah acuan ' + u + ' direset'); R(); }
function faceView(u) { const f = (S.face || {})[u]; if (!f) return toast('Belum ada wajah terdaftar'); const m = modal(`<h3>Wajah acuan · ${esc(u)}</h3>${f.ph ? `<img src="${f.ph}" style="width:200px;border-radius:14px;align-self:center">` : ''}<small class="mu">Didaftarkan ${dstr(f.t)} ${hm(f.t)}${f.by && f.by != u ? ' oleh ' + esc(f.by) : ''}</small>${U.r == 'owner' ? '<button class="gh d" id="rs">Reset wajah acuan</button>' : ''}<button class="gh" id="cl">Tutup</button>`); const rs = $('#rs', m); if (rs) rs.onclick = () => { m.close(); faceReset(u); }; $('#cl', m).onclick = () => m.close(); }
