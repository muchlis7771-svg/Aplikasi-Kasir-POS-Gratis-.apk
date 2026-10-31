'use strict';
/* ============ CETAK ULANG LABEL BARCODE SKU ============
   EAN-13 untuk SKU 13 digit yang valid (barcode pabrik), selain itu Code 128. Bisa ke PDF (label kecil 33×15 mm,
   40×30, 50×30, atau lembar A4 3×10) atau langsung ke printer thermal Bluetooth (perintah barcode ESC/POS). */
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
// → array lebar modul: bar, spasi, bar, … (dimulai bar)
function c128(txt) {
  const s = String(txt); let codes;
  if (/^\d+$/.test(s) && s.length >= 4 && s.length % 2 == 0) { codes = [105]; for (let i = 0; i < s.length; i += 2) codes.push(+s.substr(i, 2)); }
  else { codes = [104]; for (const ch of s) { const c = ch.charCodeAt(0); codes.push(c >= 32 && c <= 127 ? c - 32 : 0); } }
  let ck = codes[0]; for (let i = 1; i < codes.length; i++) ck += codes[i] * i; codes.push(ck % 103, 106);
  return codes.map((c) => C128[c]).join('').split('').map(Number);
}
const EANL = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'], EANP = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const eanOk = (s) => /^\d{13}$/.test(s) && (10 - [...s.slice(0, 12)].reduce((a, d, i) => a + +d * (i % 2 ? 3 : 1), 0) % 10) % 10 == +s[12];
function ean13(s) { // → string bit 95 modul
  const inv = (b) => b.replace(/./g, (x) => (x == '1' ? '0' : '1')), rev = (b) => b.split('').reverse().join('');
  let b = '101'; const par = EANP[+s[0]];
  for (let i = 1; i <= 6; i++) { const L = EANL[+s[i]]; b += par[i - 1] == 'L' ? L : rev(inv(L)); }
  b += '01010'; for (let i = 7; i <= 12; i++) b += inv(EANL[+s[i]]); return b + '101';
}
// pola batang seragam: daftar [x, w] dalam satuan modul + total modul
function bcBars(code) {
  if (eanOk(code)) { const b = ean13(code), r = []; for (let i = 0; i < b.length; i++) if (b[i] == '1') { let j = i; while (b[j + 1] == '1') j++; r.push([i, j - i + 1]); i = j; } return { bars: r, n: 95, ean: 1 }; }
  const w = c128(code), r = []; let x = 0; w.forEach((m, i) => { if (i % 2 == 0) r.push([x, m]); x += m; }); return { bars: r, n: x, ean: 0 };
}
function bcSvg(code, h = 46) { const B = bcBars(code), q = 8; return `<svg class="bcs" viewBox="0 0 ${B.n + q * 2} ${h}" preserveAspectRatio="none">${B.bars.map(([x, w]) => `<rect x="${x + q}" y="0" width="${w}" height="${h}"/>`).join('')}</svg>`; }
const genSku = () => { const b = '20' + String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 1000)).padStart(3, '0'); const c = (10 - [...b].reduce((a, d, i) => a + +d * (i % 2 ? 3 : 1), 0) % 10) % 10; return b + c; }; // awalan 20–29 = kode internal toko
const BCSZ = { s: ['Label kecil 33×15 mm', 33, 15], m: ['Label 40×30 mm', 40, 30], l: ['Label 50×30 mm', 50, 30], a4: ['Lembar A4 · 3×10 label', 70, 29.7] };
let BCQ = { L: {}, sz: 's', nm: 1, pr: 1, q: '' };
const bcCode = (p) => String(p.sku || p.kd || '').trim();
function bcOpen(ids) {
  if (ids) { BCQ.L = {}; for (const id of [].concat(ids)) BCQ.L[id] = 1; }
  const m = modal('<div id="bcb"></div>', 'w'); bcPaint(m); return m;
}
function bcPaint(m) {
  const q = BCQ.q.toLowerCase(), all = actProds().filter((p) => !q || (p.n + ' ' + (p.sku || '') + ' ' + (p.kd || '')).toLowerCase().includes(q)).slice(0, 60), pick = Object.keys(BCQ.L).map(prod).filter(Boolean), n = pick.reduce((a, p) => a + (BCQ.L[p.id] || 0), 0);
  $('#bcb', m).innerHTML = `<div class="row" style="margin:0"><h3 style="margin:0">🏷️ Cetak barcode</h3><button class="gh" data-x>✕</button></div>
<div class="bcpick">${pick.map((p) => `<div class="bcrow"><div class="bcpv">${bcCode(p) ? bcSvg(bcCode(p)) : '<small class="rd">SKU kosong</small>'}<small>${esc(bcCode(p) || '-')}</small></div><span><b>${esc(p.n)}</b><small class="mu">${rp(p.pr)}</small>${bcCode(p) ? '' : `<button class="gh" data-gen="${p.id}">Buat SKU</button>`}</span><input type="number" min="0" value="${BCQ.L[p.id]}" data-q="${p.id}" aria-label="Jumlah label"></div>`).join('') || '<small class="mu">Pilih produk di bawah.</small>'}</div>
<details ${pick.length ? '' : 'open'}><summary><b>+ Tambah produk</b></summary><input id="bcs" placeholder="Cari produk / SKU" value="${esc(BCQ.q)}"><div class="bcall">${all.map((p) => `<button class="${BCQ.L[p.id] ? 'a' : ''}" data-add="${p.id}"><b>${esc(p.n)}</b><small>${esc(bcCode(p) || 'tanpa SKU')}</small></button>`).join('')}</div></details>
<div class="fm2"><label><small class="mu">Ukuran</small><select id="bcz">${Object.entries(BCSZ).map(([k, v]) => `<option value="${k}" ${BCQ.sz == k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label><span class="wrap" style="align-self:end"><label class="chip"><input type="checkbox" id="bcn" ${BCQ.nm ? 'checked' : ''} style="width:auto"> Nama</label><label class="chip"><input type="checkbox" id="bcp" ${BCQ.pr ? 'checked' : ''} style="width:auto"> Harga</label></span></div>
<div class="fm2"><button class="pr" data-pdf ${n ? '' : 'disabled'}>PDF / Cetak (${n} label)</button><button class="gh" data-th ${n ? '' : 'disabled'}>🖨️ Printer thermal</button></div>
<small class="mu">PDF cocok untuk printer label (stiker 33×15, 40×30, 50×30 mm) atau kertas stiker A4. Printer thermal struk 58/80 mm mencetak barcode langsung lewat Bluetooth / RawBT.</small>`;
  const P = () => bcPaint(m);
  $('[data-x]', m).onclick = () => m.close();
  $$('[data-q]', m).forEach((i) => (i.onchange = () => { const v = Math.max(0, Math.round(+i.value || 0)); if (v) BCQ.L[i.dataset.q] = v; else delete BCQ.L[i.dataset.q]; P(); }));
  $$('[data-add]', m).forEach((b) => (b.onclick = () => { const id = b.dataset.add; if (BCQ.L[id]) delete BCQ.L[id]; else BCQ.L[id] = 1; P(); }));
  $$('[data-gen]', m).forEach((b) => (b.onclick = () => { if (!can('prodEdit')) return toast('Hanya yang boleh mengubah produk'); const s = genSku(); emit('pu', { p: { id: b.dataset.gen, sku: s } }); toast('SKU dibuat: ' + s); P(); }));
  const sr = $('#bcs', m); if (sr) sr.onchange = () => { BCQ.q = sr.value; P(); };
  $('#bcz', m).onchange = (e) => { BCQ.sz = e.target.value; }; $('#bcn', m).onchange = (e) => { BCQ.nm = e.target.checked ? 1 : 0; }; $('#bcp', m).onchange = (e) => { BCQ.pr = e.target.checked ? 1 : 0; };
  $('[data-pdf]', m).onclick = () => bcPdf(); $('[data-th]', m).onclick = () => bcThermal();
}
const bcItems = () => { const L = []; for (const [id, n] of Object.entries(BCQ.L)) { const p = prod(id); if (p && bcCode(p)) for (let i = 0; i < n; i++) L.push(p); } return L; };
function bcPdf() {
  const J = window.jspdf && window.jspdf.jsPDF; if (!J) return toast('Pustaka PDF belum termuat');
  const L = bcItems(); if (!L.length) return toast('Produk yang dipilih belum punya SKU');
  const [, w, h] = BCSZ[BCQ.sz], a4 = BCQ.sz == 'a4', doc = a4 ? new J({ unit: 'mm', format: 'a4' }) : new J({ unit: 'mm', format: [w, h], orientation: w > h ? 'landscape' : 'portrait' });
  L.forEach((p, i) => {
    let x0 = 0, y0 = 0;
    if (a4) { const k = i % 30; if (i && !k) doc.addPage(); x0 = (k % 3) * w; y0 = (Math.floor(k / 3)) * h; } else if (i) doc.addPage([w, h], w > h ? 'landscape' : 'portrait');
    const pad = h < 20 ? 1.2 : 2, code = bcCode(p), B = bcBars(code), fs = h < 20 ? 5 : 7;
    let top = y0 + pad; if (BCQ.nm) { doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.text(pdfT(p.n).slice(0, h < 20 ? 28 : 34), x0 + w / 2, top + fs * .32, { align: 'center', maxWidth: w - pad * 2 }); top += fs * .45; }
    const bot = y0 + h - pad - (BCQ.pr ? fs * .5 : 0) - fs * .42, bw = w - pad * 2 - 2, mod = bw / (B.n + 6), bh = Math.max(4, bot - top - .4), bx = x0 + pad + 1 + mod * 3;
    doc.setFillColor(0, 0, 0); for (const [x, ww] of B.bars) doc.rect(bx + x * mod, top + .3, ww * mod, bh, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fs - .5); doc.text(code, x0 + w / 2, bot + fs * .36, { align: 'center' });
    if (BCQ.pr) { doc.setFont('helvetica', 'bold'); doc.setFontSize(fs + .5); doc.text(pdfT(rp(p.pr)), x0 + w / 2, y0 + h - pad - .3, { align: 'center' }); }
  });
  saveFile(FNAME(S.name) + '-barcode-' + dkey(Date.now()) + '.pdf', doc.output('blob')); toast(L.length + ' label siap dicetak');
}
async function bcThermal() {
  const L = bcItems(); if (!L.length) return toast('Produk yang dipilih belum punya SKU');
  const b = [0x1b, 0x40], txt = (t) => { for (const ch of ascii(t)) b.push(ch.charCodeAt(0) & 0xff); b.push(0x0a); };
  for (const p of L) {
    const code = bcCode(p), ean = eanOk(code);
    b.push(0x1b, 0x61, 1); if (BCQ.nm) { b.push(0x1b, 0x45, 1); txt(String(p.n).slice(0, 32)); b.push(0x1b, 0x45, 0); }
    b.push(0x1d, 0x68, 60, 0x1d, 0x77, ean ? 2 : (code.length > 12 ? 1 : 2), 0x1d, 0x48, 2, 0x1d, 0x66, 0);
    if (ean) { b.push(0x1d, 0x6b, 67, 13); for (const ch of code) b.push(ch.charCodeAt(0)); }
    else { const d = [0x7b, 0x42, ...[...code].map((c) => c.charCodeAt(0) & 0x7f)]; b.push(0x1d, 0x6b, 73, d.length, ...d); }
    if (BCQ.pr) { b.push(0x1b, 0x45, 1); txt(rp(p.pr)); b.push(0x1b, 0x45, 0); }
    b.push(0x1b, 0x64, 2);
  }
  b.push(0x1b, 0x61, 0, 0x1b, 0x64, 3, 0x1d, 0x56, 0x42, 0x00);
  const u8 = new Uint8Array(b);
  try { if (PRN.mode == 'ble') { toast('Mencetak…', 1500); await bleWrite(u8); toast('Tercetak ✓'); } else await rawbt(u8); } catch (e) { toast(e.message || 'Gagal mencetak', 5000); }
}
