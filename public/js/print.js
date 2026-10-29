'use strict';
/* ============ CETAK STRUK: printer thermal Bluetooth (BLE langsung / RawBT untuk Bluetooth klasik, USB, LAN),
   faktur besar A4/A5 (PDF), dan bagikan teks. Format ESC/POS 58mm (32 kolom) / 80mm (48 kolom). ============ */
const PRN = Object.assign({ mode: 'rawbt', paper: 58, auto: false, ble: null, copies: 1, logo: true, foot: 'Terima kasih 🙏' }, LS.get('jpos:prn', {}));
const prnSave = () => LS.set('jpos:prn', PRN);
const COLS = () => (PRN.paper == 80 ? 48 : 32);
const ascii = (s) => String(s ?? '').normalize('NFKD').replace(/[−–—]/g, '-').replace(/[^\x20-\x7E\n]/g, '');
function padLR(l, r, w = COLS()) { l = ascii(l); r = ascii(r); const sp = w - l.length - r.length; return sp >= 1 ? l + ' '.repeat(sp) + r : l.slice(0, Math.max(0, w - r.length - 1)) + ' ' + r; }
const center = (s, w = COLS()) => { s = ascii(s).slice(0, w); return ' '.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s; };
const wrap = (s, w = COLS()) => { const o = []; let c = ''; for (const wd of ascii(s).split(' ')) { if ((c + ' ' + wd).trim().length > w) { if (c) o.push(c); c = wd; } else c = (c + ' ' + wd).trim(); } if (c) o.push(c); return o; };
const rpp = (n) => ascii(rp(n)).replace('Rp', '');

// susun struk sebagai daftar baris {t, b(bold), c(center), big}
function receiptLines(s) {
  const W = COLS(), L = [], hr = { t: '-'.repeat(W) };
  L.push({ t: S.name || 'J-POS', c: 1, b: 1, big: 1 });
  if (S.set.addr) wrap(S.set.addr).forEach((x) => L.push({ t: x, c: 1 }));
  if (S.set.tel) L.push({ t: 'Telp ' + S.set.tel, c: 1 });
  L.push(hr, { t: padLR(s.no, tstr(s.t)) }, { t: padLR('Kasir: ' + s.u, s.cn ? '' : '') });
  if (s.cn) L.push({ t: 'Pelanggan: ' + s.cn });
  L.push(hr);
  for (const i of s.L) {
    wrap(i.n).forEach((x) => L.push({ t: x }));
    L.push({ t: padLR('  ' + i.q + ' x ' + rpp(i.p), rpp(i.p * i.q)) });
    if (i.dd) L.push({ t: padLR('  Diskon' + (i.tier ? ' grosir ' + i.tier + '%' : ''), '-' + rpp(i.dd)) });
    if (i.rq) L.push({ t: '  (retur ' + i.rq + ')' });
  }
  L.push(hr, { t: padLR('Subtotal', rpp(s.sub)) });
  if (s.disc) L.push({ t: padLR('Diskon', '-' + rpp(s.disc)) });
  if (s.tax) L.push({ t: padLR('PPN', rpp(s.tax)) });
  L.push({ t: padLR('TOTAL', rpp(s.tot)), b: 1, big: PRN.paper == 80 });
  L.push({ t: padLR('Bayar', s.pay == 'Piutang' ? 'Kredit' : s.pay) });
  if (s.pay == 'Piutang') { L.push({ t: padLR('Dibayar', rpp(s.pa || 0)) }, { t: padLR('Sisa', rpp(sOut(s))) }, { t: padLR('Jatuh tempo', dstr(s.due)) }); }
  if (s.rtot) L.push({ t: padLR('Retur', '-' + rpp(s.rtot)) });
  if (s.note) wrap('Catatan: ' + s.note).forEach((x) => L.push({ t: x }));
  L.push(hr); wrap(PRN.foot || 'Terima kasih').forEach((x) => L.push({ t: x, c: 1 }));
  L.push({ t: 'J-POS', c: 1 });
  return L;
}
// ESC/POS: ESC @ init, ESC a align, ESC E bold, GS ! size, GS V cut
function escpos(lines) {
  const b = [0x1b, 0x40, 0x1b, 0x74, 0x00];
  for (const l of lines) {
    b.push(0x1b, 0x61, l.c ? 1 : 0, 0x1b, 0x45, l.b ? 1 : 0, 0x1d, 0x21, l.big ? 0x11 : 0x00);
    const t = l.c && !l.big ? ascii(l.t).trim() : ascii(l.t);
    for (const ch of t) b.push(ch.charCodeAt(0) & 0xff);
    b.push(0x0a);
  }
  b.push(0x1b, 0x61, 0, 0x1d, 0x21, 0, 0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0x00);
  return new Uint8Array(b);
}
const u8b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
const linesText = (L) => L.map((l) => (l.c ? center(l.t) : ascii(l.t))).join('\n');

/* ---- BLE langsung (printer thermal yang mendukung Bluetooth Low Energy) ---- */
const BLE = () => plug('BluetoothLe');
async function bleInit() { const B = BLE(); if (!B) throw new Error('Bluetooth langsung hanya tersedia di aplikasi Android (APK)'); await B.initialize({ androidNeverForLocation: true }); return B; }
async function blePick() {
  const B = await bleInit();
  const d = await B.requestDevice({ services: [], optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb'] });
  await B.connect({ deviceId: d.deviceId });
  const sv = (await B.getServices({ deviceId: d.deviceId })).services || [];
  let w = null; for (const s of sv) for (const c of s.characteristics || []) if (!w && c.properties && (c.properties.write || c.properties.writeWithoutResponse)) w = { service: s.uuid, characteristic: c.uuid, wnr: !!c.properties.writeWithoutResponse };
  if (!w) throw new Error('Printer tidak punya jalur tulis BLE — gunakan mode RawBT');
  PRN.ble = { deviceId: d.deviceId, name: d.name || d.deviceId, ...w }; prnSave(); return PRN.ble;
}
async function bleWrite(u8) {
  const B = await bleInit(), p = PRN.ble; if (!p) throw new Error('Pilih printer Bluetooth dulu (Pengaturan → Printer)');
  try { await B.connect({ deviceId: p.deviceId }); } catch (e) { }
  const hex = (a) => Array.from(a, (x) => x.toString(16).padStart(2, '0')).join(' ');
  for (let i = 0; i < u8.length; i += 180) {
    const o = { deviceId: p.deviceId, service: p.service, characteristic: p.characteristic, value: hex(u8.subarray(i, i + 180)) };
    if (p.wnr) await B.writeWithoutResponse(o); else await B.write(o);
    await new Promise((r) => setTimeout(r, 25));
  }
}
/* ---- RawBT: aplikasi gratis di Play Store, mendukung semua printer Bluetooth klasik, USB OTG, dan Wi-Fi/LAN ---- */
function rawbt(u8) { const url = 'rawbt:base64,' + u8b64(u8); if (isNative()) location.href = url; else { const a = document.createElement('a'); a.href = url; a.click(); } }

/* ---- faktur besar (A4 / A5) PDF ---- */
function invoicePdf(s, size) {
  const J = window.jspdf && window.jspdf.jsPDF; if (!J) return toast('Pustaka PDF belum termuat');
  const doc = new J({ unit: 'mm', format: size || 'a4' }), W = doc.internal.pageSize.getWidth(), at = (o) => (doc.autoTable ? doc.autoTable(o) : window.jspdf.autoTable(doc, o)), t = (x) => ascii(x);
  doc.setFillColor(108, 92, 231); doc.rect(0, 0, W, 28, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(t(S.name || 'J-POS'), 12, 13);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(t([S.set.addr, S.set.tel && 'Telp ' + S.set.tel].filter(Boolean).join(' · ')), 12, 20);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('FAKTUR', W - 12, 13, { align: 'right' }); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(t(s.no), W - 12, 20, { align: 'right' });
  doc.setTextColor(0); doc.setFontSize(10);
  const c = s.cu ? cust(s.cu) : null;
  doc.text(t('Kepada: ' + (s.cn || 'Pelanggan umum')), 12, 38); if (c && c.ad) doc.text(t(c.ad).slice(0, 80), 12, 43); if (c && c.ph) doc.text(t('Telp ' + c.ph), 12, 48);
  doc.text(t('Tanggal: ' + tstr(s.t)), W - 12, 38, { align: 'right' }); doc.text(t('Kasir/Sales: ' + s.u), W - 12, 43, { align: 'right' }); doc.text(t('Pembayaran: ' + (s.pay == 'Piutang' ? 'Kredit, jatuh tempo ' + dstr(s.due) : s.pay)), W - 12, 48, { align: 'right' });
  at({ startY: 54, head: [['No', 'Barang', 'Qty', 'Harga', 'Diskon', 'Jumlah']], body: s.L.map((i, n) => [n + 1, t(i.n) + (i.tier ? ' (grosir ' + i.tier + '%)' : ''), i.q + (i.rq ? ' (retur ' + i.rq + ')' : ''), t(rp(i.p)), i.dd ? t(rp(i.dd)) : '-', t(rp(i.p * i.q - i.dd))]), styles: { fontSize: 9 }, headStyles: { fillColor: [108, 92, 231] }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }, margin: { left: 12, right: 12 } });
  let y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 80) + 6; const R = (a, b, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(t(a), W - 60, y); doc.text(t(b), W - 12, y, { align: 'right' }); y += 6; };
  R('Subtotal', rp(s.sub)); if (s.disc) R('Diskon', '-' + rp(s.disc)); if (s.tax) R('PPN', rp(s.tax)); R('TOTAL', rp(s.tot), 1);
  if (s.pay == 'Piutang') { R('Dibayar', rp(s.pa || 0)); R('Sisa tagihan', rp(sOut(s)), 1); }
  y += 10; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Hormat kami,', 20, y); doc.text('Penerima,', W - 50, y); y += 22; doc.text('(' + t(s.u) + ')', 20, y); doc.text('(.....................)', W - 50, y);
  saveFile('Faktur-' + s.no + '.pdf', doc.output('blob'));
}

/* ---- pintu utama ---- */
async function printReceipt(s, how) {
  how = how || PRN.mode; const L = receiptLines(s);
  try {
    if (how == 'a4' || how == 'a5') return invoicePdf(s, how);
    if (how == 'text') return shareText('Struk ' + s.no, linesText(L));
    let data = escpos(L); if (PRN.copies > 1) { const one = data; data = new Uint8Array(one.length * PRN.copies); for (let i = 0; i < PRN.copies; i++) data.set(one, i * one.length); }
    if (how == 'ble') { toast('Mencetak…', 1500); await bleWrite(data); toast('Struk dicetak ✓'); }
    else rawbt(data);
  } catch (e) { toast(e.message || 'Gagal mencetak', 5000); }
}
function printMenu(s) {
  const m = modal(`<h3>🖨️ Cetak ${esc(s.no)}</h3><div class="mg">${[['rawbt', '🧾', 'Thermal (RawBT)', 'Bluetooth/USB/LAN'], ['ble', '📶', 'Thermal BLE', PRN.ble ? esc(PRN.ble.name) : 'pilih printer'], ['a4', '📄', 'Faktur A4', 'PDF / printer besar'], ['a5', '📃', 'Faktur A5', 'PDF setengah A4'], ['text', '💬', 'Kirim teks', 'WA / lainnya']].map((x) => `<button data-h="${x[0]}"><i>${x[1]}</i><b>${x[2]}</b><small>${x[3]}</small></button>`).join('')}</div><button class="gh" id="ps">⚙️ Pengaturan printer</button>`);
  $$('[data-h]', m).forEach((b) => (b.onclick = () => { m.close(); printReceipt(s, b.dataset.h); }));
  $('#ps', m).onclick = () => { m.close(); printerSettings(); };
}
function printerSettings() {
  const m = modal(`<h3>🖨️ Pengaturan printer</h3><label><small class="mu">Cara cetak utama</small><select id="pm"><option value="rawbt">Thermal via RawBT (Bluetooth klasik / USB / LAN)</option><option value="ble">Thermal Bluetooth BLE langsung</option><option value="a4">Faktur A4 (PDF → printer besar)</option><option value="a5">Faktur A5 (PDF)</option><option value="text">Bagikan teks</option></select></label>
<label><small class="mu">Lebar kertas thermal</small><select id="pp"><option value="58">58 mm (32 karakter)</option><option value="80">80 mm (48 karakter)</option></select></label>
<label><small class="mu">Jumlah salinan</small><input id="pc" type="number" min="1" max="5" value="${PRN.copies}"></label>
<label><small class="mu">Kalimat penutup struk</small><input id="pf" value="${esc(PRN.foot)}"></label>
<label class="row"><span>Cetak otomatis setelah transaksi</span><input type="checkbox" id="pa" ${PRN.auto ? 'checked' : ''}></label>
<div class="cd info" style="padding:10px"><small><b>Printer Bluetooth biasa (kebanyakan printer thermal murah)</b>: pasang aplikasi gratis <b>RawBT</b> dari Play Store, sambungkan printer di RawBT sekali, lalu pilih mode RawBT. RawBT juga mendukung printer USB (OTG) dan Wi-Fi/LAN.<br><b>Printer BLE</b>: tekan tombol di bawah untuk memilih printer.</small></div>
<button class="gh" id="pb">📶 Pilih printer BLE ${PRN.ble ? '(' + esc(PRN.ble.name) + ')' : ''}</button><a class="gh" target="_blank" href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter">⬇ RawBT di Play Store</a>
<button class="gh" id="pt">🧪 Cetak tes</button><button class="pr" id="ok">Simpan</button>`);
  $('#pm', m).value = PRN.mode; $('#pp', m).value = String(PRN.paper);
  const read = () => { PRN.mode = $('#pm', m).value; PRN.paper = +$('#pp', m).value; PRN.copies = Math.max(1, Math.min(5, num($('#pc', m).value) || 1)); PRN.foot = $('#pf', m).value; PRN.auto = $('#pa', m).checked; prnSave(); };
  $('#pb', m).onclick = async () => { try { const p = await blePick(); toast('Printer terhubung: ' + p.name); $('#pb', m).textContent = '📶 ' + p.name; $('#pm', m).value = 'ble'; } catch (e) { toast(e.message || 'Gagal memilih printer', 5000); } };
  $('#pt', m).onclick = () => { read(); printReceipt({ no: 'TES-001', t: Date.now(), u: U ? U.n : 'Kasir', L: [{ n: 'Produk contoh panjang namanya', q: 2, p: 15000, dd: 1500, tier: '5' }], sub: 30000, disc: 1500, tax: 0, tot: 28500, pay: 'Tunai' }); };
  $('#ok', m).onclick = () => { read(); m.close(); toast('Pengaturan printer disimpan'); };
}
