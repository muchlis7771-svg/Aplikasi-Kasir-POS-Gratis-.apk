'use strict';
/* ============ LAPORAN: pembangun data bersama (layar, Excel, PDF) ============ */
let PF = 0, PT = 1e15, PER = 'month', RT = 'lr', LG = '1101';
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function initPer() { const n = new Date(); PF = new Date(n.getFullYear(), n.getMonth(), 1).getTime(); PT = 1e15; PER = 'month'; }
function setPer(p) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (p == 'today') { PF = sod(n); PT = PF + 864e5 - 1; } else if (p == '7d') { PF = sod(n) - 6 * 864e5; PT = 1e15; } else if (p == 'month') { PF = new Date(y, m, 1).getTime(); PT = 1e15; }
  else if (p == 'lmonth') { PF = new Date(y, m - 1, 1).getTime(); PT = new Date(y, m, 1).getTime() - 1; } else if (p == 'year') { PF = new Date(y, 0, 1).getTime(); PT = 1e15; } else { PF = 0; PT = 1e15; }
  PER = p; R();
}
const perLabel = () => (PF ? dstr(PF) : 'awal') + ' – ' + (PT < 1e15 ? dstr(PT) : dstr(Date.now()));
function perBar() {
  const d = (v) => (v && v < 1e15 ? dkey(v) : '');
  return `<div class="cd"><h3>Periode laporan · <span class="mu">${perLabel()}</span></h3><div class="seg">${[['today', 'Hari ini'], ['7d', '7 hari'], ['month', 'Bulan ini'], ['lmonth', 'Bulan lalu'], ['year', 'Tahun ini'], ['all', 'Semua']].map((x) => `<button class="${PER == x[0] ? 'a' : ''}" onclick="setPer('${x[0]}')">${x[1]}</button>`).join('')}</div><div class="fm2"><input type="date" value="${d(PF)}" onchange="PF=this.value?new Date(this.value+'T00:00').getTime():0;PER='x';R()"><input type="date" value="${d(PT)}" onchange="PT=this.value?new Date(this.value+'T23:59:59').getTime():1e15;PER='x';R()"></div></div>`;
}
const agg = (o, k, v, h, q) => { const x = o[k] || (o[k] = { n: 0, v: 0, h: 0, q: 0 }); x.n++; x.v += v; x.h += h; x.q += q; };
function salesAgg(f, t) {
  const A = { n: 0, sub: 0, disc: 0, tax: 0, tot: 0, net: 0, hpp: 0, ret: 0, qty: 0, byP: {}, byC: {}, byU: {}, byO: {}, byD: {}, byPay: {} };
  for (const s of salesIn(f, t)) {
    const net = netSale(s), hpp = s.hpp - s.L.reduce((a, i) => a + (i.rq || 0) * i.hc, 0);
    A.n++; A.sub += s.sub; A.disc += s.disc; A.tax += s.tax; A.tot += s.tot - (s.rtot || 0); A.net += net; A.hpp += hpp; A.ret += s.rtot || 0;
    agg(A.byD, dkey(s.t), net, hpp, 1); agg(A.byU, s.u, net, hpp, 1); agg(A.byO, s.cn || '(Pelanggan umum)', net, hpp, 1); agg(A.byPay, s.pay == 'Piutang' ? 'Kredit' : s.pay, s.tot - (s.rtot || 0), 0, 1);
    for (const i of s.L) {
      const q = i.q - (i.rq || 0); if (q <= 0) continue; const p = prod(i.id), rev = Math.round((i.p * i.q - i.dd) * q / i.q);
      agg(A.byP, i.n, rev, i.hc * q, q); agg(A.byC, p ? p.c : '-', rev, i.hc * q, q); A.qty += q;
    }
  }
  A.profit = A.net - A.hpp; return A;
}
const aggRows = (o, key) => Object.entries(o).sort((a, b) => b[1].v - a[1].v).map(([k, x]) => [k, x.n, x.q, x.v, x.v - x.h]);
const ageBucket = (s, now) => { const d = Math.floor((now - s.due) / 864e5); return d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3; };

const RPT = {
  lr(f, t) { const L = lr(f, t); return [{ title: 'Laporan Laba Rugi · ' + perLabel(), head: ['Pos', 'Jumlah'], fmt: ['t', 'm'], rows: [['Penjualan', L.rev], ['Diskon penjualan', -L.dc], ['Penjualan bersih', L.net, 'b'], ['Harga pokok penjualan', -L.hpp], ['Laba kotor', L.gp, 'b'], ['BEBAN OPERASIONAL', '', 'h'], ...L.ex.map((x) => [x[1], -x[2]]), ['Total beban', -L.te, 'b'], ['LABA (RUGI) BERSIH', L.laba, 'b']] }]; },
  neraca(f, t) { const N = neraca(t); return [{ title: 'Neraca per ' + (t < 1e15 ? dstr(t) : dstr(Date.now())), head: ['Akun', 'Jumlah'], fmt: ['t', 'm'], rows: [['ASET', '', 'h'], ...N.as.map((x) => [x[0] + ' ' + x[1], x[2]]), ['Total aset', N.ta, 'b'], ['KEWAJIBAN', '', 'h'], ...N.li.map((x) => [x[0] + ' ' + x[1], x[2]]), ['Total kewajiban', N.tl, 'b'], ['EKUITAS', '', 'h'], ...N.eq.map((x) => [(x[0] ? x[0] + ' ' : '') + x[1], x[2]]), ['Total ekuitas', N.te, 'b'], ['Total kewajiban + ekuitas', N.tl + N.te, 'b'], [N.ok ? '✓ Neraca seimbang' : '✗ Neraca tidak seimbang', '', 'b']] }]; },
  cf(f, t) { const C = cashflow(f, t); return [{ title: 'Arus Kas (Kas & Bank) · ' + perLabel(), head: ['Keterangan', 'Jumlah'], fmt: ['t', 'm'], rows: [['Saldo awal', C.open, 'b'], ...C.rows.map((r) => [r[0], r[1]]), ['Kenaikan (penurunan) kas', C.inn + C.out, 'b'], ['Saldo akhir', C.close, 'b']] }]; },
  ns(f, t) { const R2 = neracaSaldo(f, t), d = R2.reduce((a, x) => a + x[2], 0), c = R2.reduce((a, x) => a + x[3], 0); return [{ title: 'Neraca Saldo · ' + perLabel(), head: ['Akun', 'Debit', 'Kredit'], fmt: ['t', 'm', 'm'], rows: [...R2.map((x) => [x[0] + ' ' + x[1], x[2], x[3]]), ['TOTAL', d, c, 'b']] }]; },
  gl(f, t, a) { const G = ledger(a, f, t); return [{ title: 'Buku Besar ' + a + ' ' + AC[a], head: ['Tanggal', 'Keterangan', 'Debit', 'Kredit', 'Saldo'], fmt: ['d', 't', 'm', 'm', 'm'], rows: [[f || 0, 'Saldo awal', '', '', G.open, 'b'], ...G.rows.map((r) => [r.e.t, r.e.d, r.dr, r.cr, r.sd]), [t < 1e15 ? t : Date.now(), 'Saldo akhir', '', '', G.close, 'b']] }]; },
  glAll(f, t) { return Object.keys(AC).filter((a) => ledger(a, f, t).rows.length || bal(a, 0, f - 1)).flatMap((a) => RPT.gl(f, t, a)); },
  jurnal(f, t) { const rows = []; S.j.filter((e) => e.t >= f && e.t <= t).forEach((e) => e.l.forEach((x, i) => rows.push([i ? '' : e.t, i ? '' : '#' + e.id, i ? '' : e.d, x[0] + ' ' + AC[x[0]], x[1], x[2]]))); return [{ title: 'Jurnal Umum · ' + perLabel(), head: ['Tanggal', 'No', 'Keterangan', 'Akun', 'Debit', 'Kredit'], fmt: ['d', 't', 't', 't', 'm', 'm'], rows }]; },
  jual(f, t) {
    const A = salesAgg(f, t), days2 = Object.entries(A.byD).sort().map(([k, x]) => [k, x.n, x.v, x.v - x.h]);
    return [
      { title: 'Ringkasan Penjualan · ' + perLabel(), head: ['Keterangan', 'Nilai'], fmt: ['t', 'm'], rows: [['Jumlah transaksi', A.n + ' transaksi'], ['Penjualan kotor', A.sub], ['Diskon', -A.disc], ['Retur', -(A.ret - 0)], ['Penjualan bersih (sebelum PPN)', A.net, 'b'], ['HPP', -A.hpp], ['Laba kotor', A.profit, 'b'], ['PPN dipungut', A.tax], ['Total diterima/ditagih (setelah retur)', A.tot, 'b']] },
      { title: 'Penjualan per Hari', head: ['Tanggal', 'Transaksi', 'Penjualan bersih', 'Laba kotor'], fmt: ['t', 'q', 'm', 'm'], rows: days2 },
      { title: 'Per Produk', head: ['Produk', 'Transaksi', 'Qty', 'Penjualan', 'Laba kotor'], fmt: ['t', 'q', 'q', 'm', 'm'], rows: aggRows(A.byP) },
      { title: 'Per Kategori', head: ['Kategori', 'Transaksi', 'Qty', 'Penjualan', 'Laba kotor'], fmt: ['t', 'q', 'q', 'm', 'm'], rows: aggRows(A.byC) },
      { title: 'Per Outlet / Pelanggan', head: ['Outlet', 'Transaksi', 'Qty', 'Penjualan', 'Laba kotor'], fmt: ['t', 'q', 'q', 'm', 'm'], rows: aggRows(A.byO) },
      { title: 'Per Kasir / Sales', head: ['Petugas', 'Transaksi', 'Qty', 'Penjualan', 'Laba kotor'], fmt: ['t', 'q', 'q', 'm', 'm'], rows: aggRows(A.byU) },
      { title: 'Per Metode Pembayaran', head: ['Metode', 'Transaksi', 'Qty', 'Nilai', ''], fmt: ['t', 'q', 'q', 'm', 't'], rows: aggRows(A.byPay).map((r) => [r[0], r[1], 0, r[3], '']) },
    ];
  },
  fakturDetail(f, t) { const rows = []; salesIn(f, t).forEach((s) => s.L.forEach((i, n) => rows.push([n ? '' : s.no, n ? '' : s.t, n ? '' : s.u, n ? '' : s.cn || '', n ? '' : s.pay, i.n, i.q, i.p, i.dd, i.p * i.q - i.dd]))); return [{ title: 'Detail Penjualan per Item', head: ['No', 'Tanggal', 'Petugas', 'Outlet', 'Bayar', 'Produk', 'Qty', 'Harga', 'Diskon', 'Subtotal'], fmt: ['t', 'd', 't', 't', 't', 't', 'q', 'm', 'm', 'm'], rows }]; },
  piutang() {
    const now = Date.now(), g = {}; S.sales.filter((s) => sOut(s) > 0).forEach((s) => { const k = s.cn || '(Umum)', x = g[k] || (g[k] = [k, 0, 0, 0, 0, 0]); x[1 + ageBucket(s, now)] += sOut(s); x[5] += sOut(s); });
    const rows = Object.values(g).sort((a, b) => b[5] - a[5]);
    return [
      { title: 'Umur Piutang per Outlet', head: ['Outlet', 'Belum jatuh tempo', '1–30 hari', '31–60 hari', '> 60 hari', 'Total'], fmt: ['t', 'm', 'm', 'm', 'm', 'm'], rows: [...rows, ['TOTAL', ...[1, 2, 3, 4, 5].map((i) => rows.reduce((a, r) => a + r[i], 0)), 'b']] },
      { title: 'Faktur Belum Lunas', head: ['No', 'Outlet', 'Tanggal', 'Jatuh tempo', 'Total', 'Sisa'], fmt: ['t', 't', 'd', 'd', 'm', 'm'], rows: S.sales.filter((s) => sOut(s) > 0).map((s) => [s.no, s.cn || '', s.t, s.due, s.tot, sOut(s)]) },
    ];
  },
  utang() { return [{ title: 'Utang Usaha', head: ['Supplier', 'Keterangan', 'Tanggal', 'Jatuh tempo', 'Total', 'Sisa'], fmt: ['t', 't', 'd', 'd', 'm', 'm'], rows: S.ap.filter((a) => apOut(a) > 0).map((a) => [a.sup, a.d, a.t, a.due, a.amt, apOut(a)]) }]; },
  stok() { const L = actProds().sort((a, b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n)); return [{ title: 'Stok & Nilai Persediaan', head: ['SKU', 'Produk', 'Kategori', 'Stok', 'HPP', 'Harga', 'Nilai'], fmt: ['t', 't', 't', 'q', 'm', 'm', 'm'], rows: [...L.map((p) => [p.sku || '', p.n, p.c, p.st, p.co, p.pr, Math.max(0, p.st) * p.co]), ['', 'TOTAL', '', L.reduce((a, p) => a + p.st, 0), '', '', stockValue(), 'b']] }]; },
  outlet() { return [{ title: 'Daftar Outlet', head: ['Outlet', 'Alamat', 'Telepon', 'Sales', 'Fasilitas', 'Limit', 'Piutang'], fmt: ['t', 't', 't', 't', 't', 'm', 'm'], rows: S.c.filter((c) => !c.x).map((c) => [c.n, c.ad || '', c.ph || '', c.sl || '', c.term == 'kredit' ? 'Kredit ' + (c.tempo || 30) + ' hr' : 'Tunai', c.lim || 0, outOf(c.id)]) }]; },
  absen(f, t) { return [{ title: 'Rekap Absensi · ' + perLabel(), head: ['Karyawan', 'Hari hadir', 'Terlambat', 'Total jam', 'Kunjungan'], fmt: ['t', 'q', 'q', 'q', 'q'], rows: attRecap(f, t).map((r) => [r.u, r.days, r.late, +r.hours.toFixed(1), r.visits]) }]; },
};
RPT.akt = (f, t) => [...RPT.lr(f, t), ...RPT.neraca(f, t), ...RPT.cf(f, t), ...RPT.ns(f, t)];
const RTABS = [['lr', 'Laba Rugi'], ['neraca', 'Neraca'], ['cf', 'Arus Kas'], ['ns', 'Neraca Saldo'], ['gl', 'Buku Besar'], ['jual', 'Penjualan'], ['piutang', 'Piutang'], ['utang', 'Utang'], ['stok', 'Stok'], ['absen', 'Absensi']];
const cellH = (v, f) => (v === '' || v == null ? '' : typeof v == 'string' ? esc(v) : f == 'm' ? rp(v) : f == 'q' ? Number(v).toLocaleString('id-ID') : f == 'd' ? dstr(v) : esc(v));
function tblH(s) {
  const fm = s.fmt || s.head.map((_, i) => (i ? 'm' : 't')), nh = s.head.length;
  return `<div class="ov"><table><tr>${s.head.map((h, i) => `<th class="${fm[i] != 't' ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr>${s.rows.map((r) => { const fl = r.length > nh ? r[nh] : ''; return `<tr class="${fl == 'b' ? 'bo' : ''}">${fl == 'h' ? `<td colspan="${nh}" class="mu bo">${esc(r[0])}</td>` : s.head.map((_, i) => `<td class="${fm[i] != 't' ? 'n' : ''}">${cellH(r[i], fm[i])}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${nh}" class="mu">Tidak ada data</td></tr>`}</table></div>`;
}
const secH = (s) => `<div class="cd"><h3>${esc(s.title)}</h3>${tblH(s)}</div>`;
VW.lap = () => {
  const secs = RT == 'gl' ? RPT.gl(PF, PT, LG) : RPT[RT](PF, PT);
  return `${perBar()}<div class="cd"><div class="seg" style="margin-top:0">${RTABS.map((x) => `<button class="${RT == x[0] ? 'a' : ''}" onclick="RT='${x[0]}';R()">${x[1]}</button>`).join('')}</div>${RT == 'gl' ? `<select onchange="LG=this.value;R()">${Object.keys(AC).map((a) => `<option value="${a}" ${a == LG ? 'selected' : ''}>${a} ${AC[a]}</option>`).join('')}</select>` : ''}
<div class="wrap" style="margin-top:8px"><button class="gh a" onclick="expXlsx('all')">⬇ Laporan lengkap (Excel)</button><button class="gh" onclick="expXlsx('cur')">Excel: tab ini</button><button class="gh" onclick="expPdf('akt')">PDF akuntansi lengkap</button><button class="gh" onclick="expPdf('cur')">PDF: tab ini</button></div></div>${secs.map(secH).join('')}`;
};

/* ============ KEUANGAN: piutang, utang, kas ============ */
function apayModal(id) {
  const a = S.ap.find((x) => x.id == id); if (!a) return; const out = apOut(a);
  const m = modal(`<h3>Bayar utang usaha</h3><small>${esc(a.sup)} · ${esc(a.d)} · sisa ${rp(out)}</small><input id="pa" type="number" value="${out}"><select id="pm"><option>Tunai</option><option>Transfer</option></select><button class="pr" id="ok">Bayar</button>`);
  $('#ok', m).onclick = () => { const v = num($('#pa', m).value); if (v <= 0 || v > out) return toast('Jumlah tidak valid'); emit('apay', { ap: id, amt: v, m: $('#pm', m).value }); m.close(); R(); toast('Pembayaran utang dicatat'); };
}
VW.keu = () => {
  const now = Date.now(), inv = S.sales.filter((s) => sOut(s) > 0).sort((a, b) => a.due - b.due), apl = S.ap.filter((a) => apOut(a) > 0).sort((a, b) => a.due - b.due);
  const totAr = inv.reduce((a, s) => a + sOut(s), 0), totAp = apl.reduce((a, x) => a + apOut(x), 0), od = inv.filter((s) => s.due < now).reduce((a, s) => a + sOut(s), 0), C = cashflow(sod(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), 1e15);
  return `${kpi([['Kas', rp(bal('1101'))], ['Bank & QRIS', rp(bal('1102'))], ['Piutang usaha', rp(totAr), od ? 'jatuh tempo ' + rp(od) : ''], ['Utang usaha', rp(totAp)], ['Nilai persediaan', rp(stockValue())]])}
<div class="cd"><h3>Piutang per outlet (umur)</h3>${tblH(RPT.piutang()[0])}</div>
<div class="cd"><h3>Faktur belum lunas</h3>${inv.map((s) => `<div class="row"><span><b>${esc(s.cn || 'Umum')}</b><br><small>${esc(s.no)} · tempo ${dstr(s.due)}${s.due < now ? ' <b class="rd">lewat ' + Math.floor((now - s.due) / 864e5) + ' hr</b>' : ''}</small></span><span><b>${rp(sOut(s))}</b> <button class="gh" onclick="payModal('${esc(s.no)}')">Terima</button></span></div>`).join('') || '<small class="mu">Semua faktur lunas 🎉</small>'}</div>
<div class="cd"><h3>Utang usaha</h3>${apl.map((a) => `<div class="row"><span><b>${esc(a.sup)}</b><br><small>${esc(a.d)} · tempo ${dstr(a.due)}${a.due < now ? ' <b class="rd">lewat</b>' : ''}</small></span><span><b>${rp(apOut(a))}</b> <button class="gh" onclick="apayModal('${esc(a.id)}')">Bayar</button></span></div>`).join('') || '<small class="mu">Tidak ada utang</small>'}</div>
<div class="cd"><h3>Arus kas bulan ini</h3>${row('Saldo awal', rp(C.open))}${C.rows.map((r) => row(esc(r[0]), rp(r[1]), r[1] < 0 ? 'rd' : '')).join('')}${row('Saldo akhir', rp(C.close), 'bo')}</div>`;
};

/* ============ JURNAL & input akuntansi ============ */
let jQ = '';
VW.jur = () => {
  const t = jQ.toLowerCase(), L = S.j.filter((e) => e.t >= PF && e.t <= PT && (!t || e.d.toLowerCase().includes(t) || e.l.some((x) => (x[0] + AC[x[0]]).toLowerCase().includes(t)))).slice(-80).reverse();
  return `${perBar()}<div class="two"><div class="cd"><h3>Catat beban</h3><div class="fm"><select id="ja">${EXPA.map((a) => `<option value="${a}">${AC[a]}</option>`).join('')}</select><input id="jn" type="number" placeholder="Jumlah"><input id="jk" placeholder="Keterangan"><select id="jm"><option>Tunai</option><option>Transfer</option></select><button class="pr" onclick="addExp()">Simpan beban</button></div></div>
${U.r == 'owner' ? `<div class="cd"><h3>Modal / prive</h3><div class="fm"><select id="ct"><option value="modal">Setoran modal</option><option value="prive">Prive (ambil pemilik)</option></select><input id="cn" type="number" placeholder="Jumlah"><select id="cm"><option>Tunai</option><option>Transfer</option></select><input id="ck" placeholder="Keterangan"><button class="pr" onclick="addCap()">Simpan</button></div></div>` : ''}</div>
<div class="cd"><div class="wrap"><button class="gh a" onclick="manualJournal()">+ Jurnal manual (debit/kredit)</button><button class="gh" onclick="expXlsx('jurnal')">⬇ Jurnal Excel</button><button class="gh" onclick="expPdf('jurnal')">Jurnal PDF</button></div><input style="margin-top:10px" placeholder="Cari keterangan / akun" value="${esc(jQ)}" onchange="jQ=this.value;R()"></div>
<div class="cd"><h3>Jurnal umum (${L.length} terbaru)</h3>${L.map((e) => `<div class="je"><small>#${e.id} · ${tstr(e.t)} · ${esc(e.d)}</small>${e.l.map((x) => `<p class="${x[2] ? 'ind' : ''}"><span>${x[0]} ${AC[x[0]]}</span><b>${rp(x[1] || x[2])}</b></p>`).join('')}</div>`).join('') || '<small class="mu">Tidak ada jurnal pada periode ini</small>'}</div>`;
};
const addExp = () => { const a = $('#ja').value, n = num($('#jn').value); if (n <= 0) return toast('Isi jumlah'); emit('exp', { a, amt: n, d: $('#jk').value.trim() || AC[a], m: $('#jm').value }); toast('Beban dicatat'); R(); };
const addCap = () => { const n = num($('#cn').value); if (n <= 0) return toast('Isi jumlah'); emit('cap', { t2: $('#ct').value, amt: n, d: $('#ck').value.trim(), m: $('#cm').value }); toast('Tersimpan'); R(); };
function manualJournal() {
  const opts = Object.keys(AC).map((a) => `<option value="${a}">${a} ${AC[a]}</option>`).join('');
  const m = modal(`<h3>Jurnal manual</h3><input id="md" placeholder="Keterangan"><div id="ml"></div><button class="gh" id="madd">+ Baris</button><div class="row"><span>Total debit</span><b id="td">0</b></div><div class="row"><span>Total kredit</span><b id="tc">0</b></div><button class="pr" id="ok">Simpan jurnal</button>`, 'w');
  const add = () => { const d = document.createElement('div'); d.className = 'fm2'; d.style.gridTemplateColumns = '1.6fr 1fr 1fr'; d.style.margin = '6px 0'; d.innerHTML = `<select>${opts}</select><input type="number" placeholder="Debit"><input type="number" placeholder="Kredit">`; $('#ml', m).appendChild(d); };
  add(); add(); $('#madd', m).onclick = add;
  const tot = () => { let a = 0, b = 0; $$('#ml .fm2', m).forEach((r) => { const i = $$('input', r); a += num(i[0].value); b += num(i[1].value); }); $('#td', m).textContent = rp(a); $('#tc', m).textContent = rp(b); $('#tc', m).className = a == b && a ? 'gr' : 'rd'; return [a, b]; };
  m.addEventListener('input', tot);
  $('#ok', m).onclick = () => { const [a, b] = tot(); if (!a || a != b) return toast('Total debit harus sama dengan kredit'); const l = $$('#ml .fm2', m).map((r) => { const i = $$('input', r); return [$('select', r).value, num(i[0].value), num(i[1].value)]; }).filter((x) => x[1] || x[2]); emit('jm', { d: $('#md', m).value.trim() || 'Jurnal manual', l }); m.close(); R(); toast('Jurnal tersimpan'); };
}
