'use strict';
/* ============ EKSPOR: Excel (.xlsx) & PDF ============ */
const FNAME = (s) => String(s || 'toko').replace(/[^\w-]+/g, '_').slice(0, 30);
const sheetName = (n) => String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
function sheetRows(secs) {
  const out = [];
  secs.forEach((s) => {
    const fm = s.fmt || s.head.map((_, i) => (i ? 'm' : 't')), nh = s.head.length;
    out.push([s.title], s.head);
    s.rows.forEach((r) => { const fl = r.length > nh ? r[nh] : ''; out.push(s.head.map((_, i) => (fl == 'h' ? (i ? '' : r[0]) : fm[i] == 'd' && r[i] !== '' && r[i] != null ? dstr(r[i]) : r[i] == null ? '' : r[i]))); });
    out.push([]);
  });
  return out;
}
function addSheet(wb, name, secs) {
  const rows = sheetRows(secs), ws = XLSX.utils.aoa_to_sheet(rows), w = [];
  rows.forEach((r) => r.forEach((v, i) => { const l = Math.min(48, String(v ?? '').length + 2); if (!w[i] || w[i].wch < l) w[i] = { wch: Math.max(l, 10) }; }));
  ws['!cols'] = w; XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
}
function expXlsx(kind) {
  if (!window.XLSX) return toast('Pustaka Excel belum termuat');
  const f = PF, t = PT, wb = XLSX.utils.book_new(); let name;
  if (kind == 'all') {
    const J = RPT.jual(f, t), nm = ['Ringkasan', 'Harian', 'Per Produk', 'Per Kategori', 'Per Outlet', 'Per Kasir-Sales', 'Per Pembayaran'];
    J.forEach((s, i) => addSheet(wb, nm[i], [s]));
    addSheet(wb, 'Detail Item', RPT.fakturDetail(f, t)); addSheet(wb, 'Piutang', RPT.piutang()); addSheet(wb, 'Utang', RPT.utang()); addSheet(wb, 'Stok', RPT.stok()); addSheet(wb, 'Outlet', RPT.outlet());
    addSheet(wb, 'Laba Rugi', RPT.lr(f, t)); addSheet(wb, 'Neraca', RPT.neraca(f, t)); addSheet(wb, 'Arus Kas', RPT.cf(f, t)); addSheet(wb, 'Neraca Saldo', RPT.ns(f, t));
    addSheet(wb, 'Buku Besar', RPT.glAll(f, t)); addSheet(wb, 'Jurnal', RPT.jurnal(f, t)); addSheet(wb, 'Absensi', RPT.absen(f, t)); name = 'laporan-lengkap';
  } else if (kind == 'jurnal') { addSheet(wb, 'Jurnal', RPT.jurnal(f, t)); name = 'jurnal'; }
  else { addSheet(wb, (RTABS.find((x) => x[0] == RT) || [0, 'Laporan'])[1], RT == 'gl' ? RPT.gl(f, t, LG) : RPT[RT](f, t)); name = 'laporan-' + RT; }
  saveFile(FNAME(S.name) + '-' + name + '-' + dkey(Date.now()) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
  toast('File Excel siap');
}
const pdfT = (s) => String(s ?? '').replace(/[−–—]/g, '-').replace(/✓/g, 'OK').replace(/✗/g, 'X').replace(/[^\x20-\xFF]/g, '');
function mkPdf(title, secs, file) {
  const J = window.jspdf && window.jspdf.jsPDF; if (!J) return toast('Pustaka PDF belum termuat');
  const wide = secs.some((s) => s.head.length > 6), doc = new J({ unit: 'pt', format: 'a4', orientation: wide ? 'landscape' : 'portrait' });
  const at = (o) => (doc.autoTable ? doc.autoTable(o) : (window.autoTable || (window.jspdfAutoTable && (window.jspdfAutoTable.default || window.jspdfAutoTable)))(doc, o));
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(pdfT(S.name || 'J-POS'), 36, 40);
  doc.setFontSize(11); doc.text(pdfT(title), 36, 58); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
  doc.text(pdfT('Periode ' + perLabel() + ' · dicetak ' + tstr(Date.now()) + ' oleh ' + (U ? U.n : '')), 36, 72); doc.setTextColor(0);
  let y = 88;
  secs.forEach((s) => {
    const fm = s.fmt || s.head.map((_, i) => (i ? 'm' : 't')), nh = s.head.length, flags = [];
    const body = s.rows.map((r) => { const fl = r.length > nh ? r[nh] : ''; flags.push(fl); return fl == 'h' ? [{ content: pdfT(r[0]), colSpan: nh, styles: { fontStyle: 'bold', fillColor: [238, 236, 252] } }] : s.head.map((_, i) => pdfT(cellH(r[i], fm[i]).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'))); });
    if (y > H - 110) { doc.addPage(); y = 40; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(pdfT(s.title), 36, y); y += 6;
    const cs = {}; fm.forEach((f, i) => { if (f != 't') cs[i] = { halign: 'right' }; });
    at({ head: [s.head.map(pdfT)], body, startY: y, margin: { left: 36, right: 36 }, styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [34, 54, 110] }, columnStyles: cs, didParseCell: (d) => { if (d.section == 'body' && flags[d.row.index] == 'b') d.cell.styles.fontStyle = 'bold'; } });
    y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y + 30) + 22;
  });
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140); doc.text(pdfT('J-POS · halaman ' + i + '/' + n), W - 36, H - 20, { align: 'right' }); }
  saveFile(FNAME(S.name) + '-' + file + '-' + dkey(Date.now()) + '.pdf', doc.output('blob')); toast('File PDF siap');
}
function expPdf(kind) {
  const f = PF, t = PT;
  if (kind == 'akt') mkPdf('Laporan Akuntansi Lengkap', [...RPT.lr(f, t), ...RPT.neraca(f, t), ...RPT.cf(f, t), ...RPT.ns(f, t), ...RPT.glAll(f, t), ...RPT.jurnal(f, t)], 'akuntansi');
  else if (kind == 'jurnal') mkPdf('Jurnal Umum', RPT.jurnal(f, t), 'jurnal');
  else mkPdf((RTABS.find((x) => x[0] == RT) || [0, 'Laporan'])[1], RT == 'gl' ? RPT.gl(f, t, LG) : RPT[RT](f, t), RT);
}
function expBackup() { saveFile(FNAME(S.name) + '-backup-' + dkey(Date.now()) + '.json', new Blob([JSON.stringify(S)], { type: 'application/json' })); toast('Backup siap'); }
function restoreBackup(el) {
  const f = el.files[0]; el.value = ''; if (!f) return;
  if (S.srv) return toast('Toko online: data tersimpan di server, restore lokal tidak diperlukan.');
  const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!d.p || !d.j || !d.sales) throw 0; if (!confirm('Timpa seluruh data toko ini dengan backup?')) return; d.id = SID; S = d; save(); flushSave(); R(); toast('Backup dipulihkan'); } catch (e) { toast('File backup tidak valid'); } }; r.readAsText(f);
}
