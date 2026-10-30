'use strict';
/* ============ FAKTUR PENJUALAN untuk distributor ============
   Format: A4 / A5 (printer tinta / laser), continuous form 9½" × 11" dan 9½" × 5½" (printer dot matrix, mis. Epson LX-310),
   thermal 58/80 mm (Bluetooth). Di laptop / browser dicetak lewat dialog printer; di HP Android menjadi PDF lalu dibagikan
   ke aplikasi printer (atau dicetak lewat layanan cetak Android). */
const FMT = {
  a4: { n: 'A4', w: 210, h: 297, dm: 0 }, a5: { n: 'A5', w: 148, h: 210, dm: 0 },
  cf: { n: 'Continuous form 9½×11"', w: 241.3, h: 279.4, dm: 1 }, cf2: { n: 'Continuous form ½ (9½×5½")', w: 241.3, h: 139.7, dm: 1 },
};
function terbilang(n) {
  n = Math.floor(Math.abs(+n || 0)); const A = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const t = (x) => x < 12 ? A[x] : x < 20 ? t(x - 10) + ' belas' : x < 100 ? t(Math.floor(x / 10)) + ' puluh ' + t(x % 10) : x < 200 ? 'seratus ' + t(x - 100) : x < 1000 ? t(Math.floor(x / 100)) + ' ratus ' + t(x % 100) : x < 2000 ? 'seribu ' + t(x - 1000) : x < 1e6 ? t(Math.floor(x / 1000)) + ' ribu ' + t(x % 1000) : x < 1e9 ? t(Math.floor(x / 1e6)) + ' juta ' + t(x % 1e6) : x < 1e12 ? t(Math.floor(x / 1e9)) + ' miliar ' + t(x % 1e9) : t(Math.floor(x / 1e12)) + ' triliun ' + t(x % 1e12);
  const s = n ? t(n).replace(/\s+/g, ' ').trim() : 'nol'; return s.charAt(0).toUpperCase() + s.slice(1) + ' rupiah';
}
function fakData(s) {
  s = S.sales.find((x) => x.no == s.no) || s; const c = s.cu ? cust(s.cu) : null;
  return { s, c, rows: s.L.map((i, n) => { const p = prod(i.id) || {}; return { no: n + 1, kd: p.kd || '', n: i.n, q: i.q - (i.rq || 0), u: p.u || 'pcs', p: i.p, dd: i.dd || 0, tier: i.tier, j: i.p * (i.q - (i.rq || 0)) - (i.dd || 0) }; }).filter((r) => r.q > 0),
    pay: s.cod ? 'Tunai saat barang tiba (COD)' : s.pay == 'Piutang' ? 'Kredit' : s.pay, tot: s.tot - (s.rtot || 0) };
}
const nf = (v) => Math.round(v).toLocaleString('id-ID');
const DOCN = { faktur: 'FAKTUR', sj: 'SURAT JALAN' };
const tagihTxt = (x) => x.cod && sOut(x) > 0 ? 'TAGIH TUNAI ' + rp(sOut(x)) : x.pay == 'Piutang' ? 'Kredit · tempo ' + dstr(x.due) : 'Lunas (' + x.pay + ')';
function fakturHtml(s, fmt, doc) {
  doc = doc || 'faktur'; const sj = doc == 'sj';
  const F = FMT[fmt] || FMT.a4, D = fakData(s), x = D.s, c = D.c, dm = F.dm, small = fmt == 'a5' || fmt == 'cf2';
  const css = dm
    ? `*{font-family:"Courier New",Courier,monospace!important;color:#000!important;background:none!important}body{font-size:${small ? 10.5 : 11.5}pt;line-height:1.25}h1{font-size:15pt;letter-spacing:3px}th,td{border:0!important;padding:1px 4px}thead th{border-top:1px dashed #000!important;border-bottom:1px dashed #000!important}tfoot td,.tt{border-top:1px dashed #000!important}`
    : `body{font-family:Arial,Helvetica,sans-serif;font-size:${small ? 9 : 10}pt;color:#111}h1{font-size:${small ? 15 : 19}pt;color:#4f46e5;letter-spacing:2px}.hd{border-bottom:3px solid #4f46e5}thead th{background:#eef0ff;border-bottom:1.5px solid #4f46e5}td{border-bottom:1px solid #e5e7eb}`;
  const head = `<table class="hd" style="width:100%;margin-bottom:6px"><tr><td style="vertical-align:top;border:0"><b style="font-size:${dm ? 13 : small ? 12 : 14}pt">${esc(S.name || 'J-POS')}</b><br>${esc(S.set.addr || '')}${S.set.tel ? '<br>Telp ' + esc(S.set.tel) : ''}</td><td style="text-align:right;vertical-align:top;border:0"><h1 style="margin:0">${DOCN[doc]}</h1><b>${esc(x.no)}</b><br>${tstr(x.t)}</td></tr></table>`;
  const info = `<table style="width:100%;margin-bottom:6px"><tr><td style="width:55%;vertical-align:top;border:0">Kepada Yth.<br><b>${esc(x.cn || 'Pelanggan umum')}</b>${c && c.kd ? ' (' + esc(c.kd) + ')' : ''}${c && c.ad ? '<br>' + esc(c.ad) : ''}${c && c.ph ? '<br>Telp ' + esc(c.ph) : ''}</td><td style="vertical-align:top;border:0"><table style="width:100%">${[['Sales / kasir', x.u], ...(sj ? [['Pengirim', (x.dl && x.dl.by) || '..................'], ['Pembayaran', tagihTxt(x)]] : [['Pembayaran', D.pay], ...(x.pay == 'Piutang' && !x.cod ? [['Jatuh tempo', dstr(x.due)]] : []), ...(x.kirim ? [['Pengiriman', 'Diantar']] : [])])].map((r) => `<tr><td style="border:0;padding:0 4px">${r[0]}</td><td style="border:0;padding:0 4px">: <b>${esc(r[1])}</b></td></tr>`).join('')}</table></td></tr></table>`;
  const tq = D.rows.reduce((a, r) => a + r.q, 0);
  const bodySJ = `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">No</th><th style="text-align:left">Kode</th><th style="text-align:left">Nama barang</th><th style="text-align:right">Qty</th><th style="text-align:left">Satuan</th><th>Cek gudang</th><th>Diterima</th></tr></thead><tbody>${D.rows.map((r) => `<tr><td>${r.no}</td><td>${esc(r.kd)}</td><td>${esc(r.n)}</td><td style="text-align:right"><b>${nf(r.q)}</b></td><td>${esc(r.u)}</td><td style="text-align:center">[&nbsp;&nbsp;]</td><td style="text-align:center">[&nbsp;&nbsp;]</td></tr>`).join('')}</tbody></table><p class="tt" style="margin:4px 0">Total: <b>${D.rows.length} jenis barang · ${nf(tq)} unit</b>${x.note ? ' · Catatan: ' + esc(x.note) : ''}${x.cod && sOut(x) > 0 ? '<br><b>Tagih tunai saat barang diterima: ' + rp(sOut(x)) + '</b>' : ''}</p>`;
  const body = `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">No</th><th style="text-align:left">Kode</th><th style="text-align:left">Nama barang</th><th style="text-align:right">Qty</th><th style="text-align:left">Sat</th><th style="text-align:right">Harga</th><th style="text-align:right">Disc</th><th style="text-align:right">Jumlah</th></tr></thead><tbody>${D.rows.map((r) => `<tr><td>${r.no}</td><td>${esc(r.kd)}</td><td>${esc(r.n)}${r.tier ? ' <small>(grosir ' + r.tier + '%)</small>' : ''}</td><td style="text-align:right">${nf(r.q)}</td><td>${esc(r.u)}</td><td style="text-align:right">${nf(r.p)}</td><td style="text-align:right">${r.dd ? nf(r.dd) : '-'}</td><td style="text-align:right">${nf(r.j)}</td></tr>`).join('')}</tbody></table>`;
  const sum = [['Subtotal', x.sub], ...(x.disc ? [['Diskon', -x.disc]] : []), ...(x.tax ? [['PPN', x.tax]] : []), ...(x.rtot ? [['Retur', -x.rtot]] : []), ['TOTAL', D.tot, 1], ...(x.pay == 'Piutang' ? [['Dibayar', x.pa || 0], ['Sisa tagihan', sOut(x), 1]] : [])];
  const foot = `<table class="tt" style="width:100%;margin-top:4px"><tr><td style="vertical-align:top;border:0;width:58%"><i>Terbilang:</i><br><b>${terbilang(D.tot)}</b>${x.note ? '<br>Catatan: ' + esc(x.note) : ''}${!sj && typeof payNoteTxt == 'function' && payNoteTxt() ? '<br><small>' + esc(payNoteTxt()) + '</small>' : ''}</td><td style="border:0"><table style="width:100%">${sum.map((r) => `<tr><td style="border:0;padding:0 4px">${r[2] ? '<b>' + r[0] + '</b>' : r[0]}</td><td style="border:0;padding:0 4px;text-align:right">${r[2] ? '<b>' + nf(r[1]) + '</b>' : nf(r[1])}</td></tr>`).join('')}</table></td></tr></table>
<table style="width:100%;margin-top:${small ? 10 : 22}px;text-align:center"><tr>${(sj ? ['Bagian gudang', 'Pengirim', 'Penerima'] : ['Hormat kami', 'Pengirim', 'Penerima']).map((t, i) => `<td style="border:0">${t},<br><br><br>${i == 0 && !sj ? '( ' + esc(x.u) + ' )' : '( .................... )'}</td>`).join('')}</tr></table>${dm ? '' : '<p style="text-align:center;color:#888;font-size:8pt;margin-top:8px">Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada perjanjian · Dicetak dengan J-POS</p>'}`;
  const sigOnly = foot.slice(foot.indexOf('<table style="width:100%;margin-top'));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${DOCN[doc]} ${esc(x.no)}</title><style>@page{size:${F.w}mm ${F.h}mm;margin:${dm ? '6mm 8mm' : '10mm'}}html,body{margin:0}table{border-collapse:collapse}td,th{padding:3px 5px}${css}</style></head><body>${head}${info}${sj ? bodySJ + sigOnly : body + foot}</body></html>`;
}
// cetak lewat dialog printer sistem (laptop / browser). Di APK Android tidak ada dialog cetak → PDF.
const sysPrint = () => !isNative();
function printHtml(html) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.onload = () => { setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Tidak bisa membuka dialog printer'); } setTimeout(() => f.remove(), 60000); }, 250); };
  f.srcdoc = html;
}
function fakturPdf(s, fmt, docT) {
  docT = docT || 'faktur'; const sj = docT == 'sj';
  const J = window.jspdf && window.jspdf.jsPDF; if (!J) return toast('Pustaka PDF belum termuat');
  const F = FMT[fmt] || FMT.a4, D = fakData(s), x = D.s, c = D.c, dm = F.dm, small = fmt == 'a5' || fmt == 'cf2', t = (v) => ascii(v);
  const doc = new J({ unit: 'mm', format: [F.w, F.h], orientation: F.w > F.h ? 'l' : 'p' }), W = F.w, M = dm ? 8 : 10, fnt = dm ? 'courier' : 'helvetica', fs = small ? 8.5 : 9.5;
  const at = (o) => (doc.autoTable ? doc.autoTable(o) : window.jspdf.autoTable(doc, o));
  doc.setFont(fnt, 'bold'); doc.setFontSize(small ? 12 : 14); doc.text(t(S.name || 'J-POS'), M, M + 5);
  doc.setFont(fnt, 'normal'); doc.setFontSize(fs); doc.text(t([S.set.addr, S.set.tel && 'Telp ' + S.set.tel].filter(Boolean).join(' / ')).slice(0, 90), M, M + 10);
  doc.setFont(fnt, 'bold'); doc.setFontSize(small ? 14 : 17); if (!dm) doc.setTextColor(79, 70, 229); doc.text(DOCN[docT], W - M, M + 5, { align: 'right' }); doc.setTextColor(0);
  doc.setFontSize(fs); doc.text(t(x.no), W - M, M + 10, { align: 'right' }); doc.setFont(fnt, 'normal'); doc.text(t(tstr(x.t)), W - M, M + 14, { align: 'right' });
  let y = M + 21; doc.text('Kepada Yth.', M, y); doc.setFont(fnt, 'bold'); doc.text(t((x.cn || 'Pelanggan umum') + (c && c.kd ? ' (' + c.kd + ')' : '')), M, y + 4.5); doc.setFont(fnt, 'normal');
  if (c && c.ad) doc.text(t(c.ad).slice(0, 60), M, y + 9); if (c && c.ph) doc.text(t('Telp ' + c.ph), M, y + 13.5);
  const R2 = sj ? [['Sales/kasir', x.u], ['Pengirim', (x.dl && x.dl.by) || '...............'], ['Pembayaran', tagihTxt(x)]] : [['Sales/kasir', x.u], ['Pembayaran', D.pay], ...(x.pay == 'Piutang' && !x.cod ? [['Jatuh tempo', dstr(x.due)]] : [])];
  R2.forEach((r, i) => { doc.text(t(r[0]), W * 0.58, y + i * 4.5); doc.text(t(': ' + r[1]), W * 0.58 + 24, y + i * 4.5); });
  if (sj) {
    at({ startY: y + 17, head: [['No', 'Kode', 'Nama barang', 'Qty', 'Satuan', 'Cek gudang', 'Diterima']], body: D.rows.map((r) => [r.no, t(r.kd), t(r.n), nf(r.q), t(r.u), '[  ]', '[  ]']),
      theme: dm ? 'plain' : 'grid', styles: { font: fnt, fontSize: fs, cellPadding: 1.4, textColor: 0 }, headStyles: dm ? { fontStyle: 'bold' } : { fillColor: [79, 70, 229], textColor: 255 }, columnStyles: { 3: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'center' }, 6: { halign: 'center' } }, margin: { left: M, right: M } });
    y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y + 30) + 5; doc.setFont(fnt, 'bold');
    doc.text(t('Total: ' + D.rows.length + ' jenis barang - ' + nf(D.rows.reduce((a, r) => a + r.q, 0)) + ' unit'), M, y);
    if (x.cod && sOut(x) > 0) { y += 5; doc.text(t('Tagih tunai saat barang diterima: ' + rp(sOut(x))), M, y); }
    if (x.note) { y += 5; doc.setFont(fnt, 'normal'); doc.text(t('Catatan: ' + x.note).slice(0, 100), M, y); }
    y += small ? 9 : 14; doc.setFont(fnt, 'normal');
    ['Bagian gudang,', 'Pengirim,', 'Penerima,'].forEach((h, i) => { const cx = M + (W - 2 * M) * (i + 0.5) / 3; doc.text(h, cx, y, { align: 'center' }); doc.text('( .................... )', cx, y + (small ? 13 : 18), { align: 'center' }); });
  } else {
    at({ startY: y + 17, head: [['No', 'Kode', 'Nama barang', 'Qty', 'Sat', 'Harga', 'Disc', 'Jumlah']], body: D.rows.map((r) => [r.no, t(r.kd), t(r.n), nf(r.q), t(r.u), nf(r.p), r.dd ? nf(r.dd) : '-', nf(r.j)]),
      theme: dm ? 'plain' : 'striped', styles: { font: fnt, fontSize: fs - 0.5, cellPadding: 1.2, textColor: 0 }, headStyles: dm ? { fontStyle: 'bold', lineWidth: { top: 0.2, bottom: 0.2 } } : { fillColor: [79, 70, 229], textColor: 255 },
      columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }, margin: { left: M, right: M } });
    y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y + 30) + 5;
    const sum = [['Subtotal', x.sub], ...(x.disc ? [['Diskon', -x.disc]] : []), ...(x.tax ? [['PPN', x.tax]] : []), ...(x.rtot ? [['Retur', -x.rtot]] : []), ['TOTAL', D.tot, 1], ...(x.pay == 'Piutang' ? [['Dibayar', x.pa || 0], ['Sisa tagihan', sOut(x), 1]] : [])];
    sum.forEach((r, i) => { doc.setFont(fnt, r[2] ? 'bold' : 'normal'); doc.text(t(r[0]), W - M - 55, y + i * 4.6); doc.text(nf(r[1]), W - M, y + i * 4.6, { align: 'right' }); });
    doc.setFont(fnt, 'italic'); doc.text('Terbilang:', M, y); doc.setFont(fnt, 'bold'); doc.text(doc.splitTextToSize(t(terbilang(D.tot)), W * 0.5), M, y + 4.5);
    y += Math.max(sum.length * 4.6, 12) + (small ? 6 : 12); doc.setFont(fnt, 'normal');
    ['Hormat kami,', 'Pengirim,', 'Penerima,'].forEach((h, i) => { const cx = M + (W - 2 * M) * (i + 0.5) / 3; doc.text(h, cx, y, { align: 'center' }); doc.text(i == 0 ? '( ' + t(x.u) + ' )' : '( .................... )', cx, y + (small ? 13 : 18), { align: 'center' }); });
  }
  saveFile((sj ? 'SuratJalan-' : 'Faktur-') + x.no + '-' + fmt + '.pdf', doc.output('blob'));
}
// thermal lewat printer Windows (USB / Bluetooth yang terpasang sebagai printer di laptop)
function thermalHtml(s, doc) {
  const L = receiptLines(s, doc), w = PRN.paper == 80 ? 80 : 58;
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${w}mm 297mm;margin:2mm}body{margin:0;width:${w - 4}mm;font:${w == 80 ? 7.4 : 7.6}pt "Courier New",monospace;color:#000}pre{margin:0;white-space:pre;overflow:hidden}.b{font-weight:bold}.c{text-align:center}.g{font-size:1.35em}</style></head><body>${L.map((l) => `<pre class="${l.b ? 'b ' : ''}${l.c ? 'c ' : ''}${l.big ? 'g' : ''}">${esc(l.c ? String(l.t).trim() : l.t) || '&nbsp;'}</pre>`).join('')}</body></html>`;
}
function printFaktur(s, fmt, pdf, doc) {
  if (!FMT[fmt]) fmt = 'a4';
  if (!pdf && sysPrint()) { printHtml(fakturHtml(s, fmt, doc)); return; }
  fakturPdf(s, fmt, doc); if (isNative()) toast('PDF dibuat — pilih aplikasi printer atau "Cetak" di menu bagikan', 5000);
}
