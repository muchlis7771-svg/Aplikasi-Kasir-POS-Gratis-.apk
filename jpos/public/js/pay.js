'use strict';
/* ============ QRIS & REKENING TOKO ============
   Pemilik mengunggah gambar QRIS resmi toko & daftar rekening (Pengaturan). Kasir / sales / tim dropping
   menampilkannya ke pelanggan saat pembayaran QRIS / Transfer. Tersimpan di pengaturan toko → ikut ke semua HP, bisa offline. */
const payQ = () => (S && S.set.qris) || '', payB = () => ((S && S.set.bank) || []).filter((b) => b && b.no);
const bankLine = (b) => b.b + ' ' + b.no + (b.an ? ' a.n. ' + b.an : '');
function payNoteTxt() { const B = payB(); return B.length ? 'Pembayaran transfer ke: ' + B.map(bankLine).join(' / ') : ''; }
function copyTx(t) { try { navigator.clipboard.writeText(t).then(() => toast('Disalin: ' + t)).catch(() => prompt('Salin:', t)); } catch (e) { prompt('Salin:', t); } }

// tampilkan QRIS / rekening ke pelanggan. Hasil: true = uang sudah diterima, false = batal
function payShow(method, amt, info) {
  return new Promise((res) => {
    const q = payQ(), B = payB(), isQ = method == 'QRIS';
    const none = isQ ? !q : !B.length;
    const m = modal(`<div class="payx"><small class="mu">${esc(info || S.name)}</small><div class="payamt">${rp(amt || 0)}</div>
${isQ ? (q ? `<div class="payqr"><img src="${q}" alt="QRIS ${esc(S.name)}"></div><b>${esc(S.set.qn || S.name)}</b><small class="mu">Minta pelanggan scan QRIS ini dengan m-banking / e-wallet, lalu cek bukti / notifikasi dana masuk.</small>` : '')
  : B.map((b, i) => `<div class="paybk"><span><small class="mu">${esc(b.b)}</small><b>${esc(b.no)}</b><small>a.n. ${esc(b.an || '-')}</small></span><button class="gh" data-cp="${i}">Salin</button></div>`).join('') + (B.length ? '<small class="mu">Cocokkan nominal & nama pengirim di bukti transfer sebelum konfirmasi.</small>' : '')}
${none ? `<div class="warnbox">${isQ ? 'QRIS toko belum diunggah pemilik.' : 'Rekening toko belum diisi pemilik.'}<br><small>Pemilik: Pengaturan → 💳 QRIS & rekening toko.</small></div>` : ''}
<div class="fm2" style="margin-top:8px"><button class="gh" id="pxn">Batal</button><button class="pr" id="pxy">✓ Dana sudah diterima</button></div></div>`, 'w');
    let done = false; const end = (v) => { if (done) return; done = true; m.close(); res(v); };
    $$('[data-cp]', m).forEach((b) => (b.onclick = () => copyTx(B[+b.dataset.cp].no)));
    $('#pxy', m).onclick = () => end(true); $('#pxn', m).onclick = () => end(false); m.onclose = () => end(false);
  });
}
// tombol kecil untuk menampilkan tanpa transaksi (mis. pelanggan minta lihat dulu)
const payBtn = (method, amtExpr) => (method == 'QRIS' || method == 'Transfer') && (method == 'QRIS' ? payQ() : payB().length) ? `<button class="gh a" type="button" onclick="payShow('${method}',${amtExpr})">${method == 'QRIS' ? '📱 Tampilkan QRIS' : '🏦 Tampilkan rekening'}</button>` : '';

/* ---------- pengaturan pemilik ---------- */
let PQ = null;
function payCard() {
  const B = (S.set.bank || []).concat([{}, {}, {}]).slice(0, Math.max(3, (S.set.bank || []).length + 1)); PQ = null;
  return `<div class="cd"><h3>💳 QRIS & rekening toko</h3><small class="mu">Ditampilkan ke pelanggan oleh kasir, sales & tim dropping saat bayar QRIS / Transfer, dan rekening tercetak di faktur. Hanya pemilik yang bisa mengubah.</small>
<div class="row" style="align-items:flex-start;margin-top:8px"><div class="payqr sm" id="pqv">${S.set.qris ? `<img src="${S.set.qris}" alt="">` : '<small class="mu">Belum ada QRIS</small>'}</div><div class="fm" style="flex:1"><label class="gh" style="text-align:center">📤 Unggah gambar QRIS<input type="file" accept="image/*" style="display:none" onchange="payPick(this)"></label>${S.set.qris ? '<button class="gh d" onclick="PQ=\'\';$(\'#pqv\').innerHTML=\'<small class=mu>QRIS dihapus (simpan untuk menerapkan)</small>\'">Hapus QRIS</button>' : ''}<input id="pqn" placeholder="Nama merchant QRIS" value="${esc(S.set.qn || '')}"></div></div>
<small class="mu">Gunakan gambar QRIS resmi dari bank / penyedia QRIS toko Anda (screenshot atau foto yang tajam & lurus).</small>
<b style="font-size:13px;display:block;margin-top:8px">Rekening transfer</b>${B.map((b, i) => `<div class="fm3 pbrow"><input data-bb="${i}" placeholder="Bank (BCA, BRI…)" value="${esc(b.b || '')}"><input data-bn="${i}" placeholder="No. rekening" inputmode="numeric" value="${esc(b.no || '')}"><input data-ba="${i}" placeholder="Atas nama" value="${esc(b.an || '')}"></div>`).join('')}
<button class="pr" onclick="paySave()">Simpan QRIS & rekening</button></div>`;
}
async function payPick(el) {
  const f = el.files[0]; if (!f) return;
  const img = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = r.result; }; r.onerror = no; r.readAsDataURL(f); }).catch(() => null);
  if (!img) return toast('Gambar tidak bisa dibaca');
  // perkecil tapi tetap tajam agar bisa di-scan; batas ukuran supaya tersinkron ke semua HP
  let out = '';
  for (const [mx, fmt, ql] of [[720, 'image/png'], [720, 'image/jpeg', 0.92], [600, 'image/jpeg', 0.88], [520, 'image/jpeg', 0.82], [440, 'image/jpeg', 0.78]]) {
    const k = Math.min(1, mx / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL(fmt, ql); if (out.length < 110000) break;
  }
  if (out.length >= 110000) return toast('Gambar terlalu besar — potong (crop) area QRIS saja lalu coba lagi', 5000);
  PQ = out; $('#pqv').innerHTML = `<img src="${out}" alt="">`; toast('QRIS siap — tekan Simpan');
}
function paySave() {
  if (U.r != 'owner') return toast('Hanya pemilik yang bisa mengubah QRIS & rekening');
  const bank = $$('[data-bn]').map((e) => { const i = e.dataset.bn; return { b: $(`[data-bb="${i}"]`).value.trim(), no: e.value.replace(/[^\d -]/g, '').trim(), an: $(`[data-ba="${i}"]`).value.trim() }; }).filter((b) => b.no && b.b);
  const set = { bank, qn: $('#pqn').value.trim() }; if (PQ !== null) set.qris = PQ;
  emit('set', { set }); PQ = null; toast('QRIS & rekening disimpan — tampil di semua HP setelah sinkron'); R();
}
