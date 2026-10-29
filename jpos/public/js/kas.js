'use strict';
/* ============ BUKU KAS: semua uang masuk / keluar otomatis dari transaksi + catatan manual pemilik ============ */
let kAcc = 'all', kQ = '';
const KIN = [['4201', 'Pendapatan lain-lain'], ['3101', 'Setoran modal pemilik'], ['2103', 'Pinjaman diterima']];
const KOUT = [...EXPA.map((a) => [a, AC[a]]), ['3102', 'Prive (diambil pemilik)'], ['2103', 'Bayar pinjaman']];
function kasCat(e) {
  const k = e.k;
  if (k == 'sale') return 'Penjualan'; if (k == 'pay') return 'Pelunasan piutang'; if (k == 'retur') return 'Retur penjualan';
  if (k == 'stk' || k == 'rcv') return 'Pembelian stok'; if (k == 'apay') return 'Bayar utang supplier'; if (k == 'opn') return 'Selisih stok'; if (k == 'jm') return 'Jurnal manual';
  const c = e.l.filter((x) => x[0] != '1101' && x[0] != '1102').sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]))[0];
  return c ? AC[c[0]] || 'Lain-lain' : 'Pindah dana';
}
function kasRows(f, t, acc) {
  const set = acc == 'all' ? ['1101', '1102'] : [acc], rows = []; let open = 0;
  const L = S.j.slice().sort((a, b) => a.t - b.t || a.id - b.id);
  for (const e of L) {
    const d = e.l.reduce((a, x) => (set.includes(x[0]) ? a + x[1] - x[2] : a), 0); if (!d) continue;
    if (e.t < f) { open += d; continue; } if (e.t > t) continue;
    rows.push({ e, d, cat: kasCat(e) });
  }
  let sd = open; rows.forEach((r) => { sd += r.d; r.sd = sd; });
  return { open, rows, close: sd, inn: rows.filter((r) => r.d > 0).reduce((a, r) => a + r.d, 0), out: rows.filter((r) => r.d < 0).reduce((a, r) => a - r.d, 0) };
}
VW.kas = () => {
  const K = kasRows(PF, PT, kAcc), q = kQ.toLowerCase(), rows = K.rows.filter((r) => !q || (r.e.d + ' ' + r.cat + ' ' + (r.e.u || '')).toLowerCase().includes(q)).slice().reverse();
  const td = kasRows(sod(new Date()), 1e15, 'all'), cat = {}, cin = {};
  K.rows.forEach((r) => { const o = r.d > 0 ? cin : cat; o[r.cat] = (o[r.cat] || 0) + Math.abs(r.d); });
  const dd = days(14).map((x) => { const r = K.rows.filter((y) => dkey(y.e.t) == x.k); return { l: x.l, v: Math.max(0, r.reduce((a, y) => a + y.d, 0)) }; });
  const byDay = {}; rows.slice(0, 200).forEach((r) => { (byDay[dkey(r.e.t)] = byDay[dkey(r.e.t)] || []).push(r); });
  return `<div class="cd hero"><small>Saldo kas + bank sekarang</small><h2>${rp(bal('1101') + bal('1102'))}</h2><small>Tunai ${rp(bal('1101'))} · Bank/QRIS ${rp(bal('1102'))}</small><div class="row" style="margin:8px 0 0"><span>Hari ini</span><span>▲ ${rp(td.inn)} · ▼ ${rp(td.out)}</span></div></div>
<div class="cd"><div class="kq"><button class="gh a" onclick="kasForm('in')">＋ Uang masuk</button><button class="gh d" onclick="kasForm('out')">－ Uang keluar</button><button class="gh" onclick="kasTf()">⇄ Pindah dana</button><button class="gh" onclick="kasCount()">🧮 Hitung kas</button></div><small class="mu">Penjualan, pelunasan, pembelian, bayar utang, biaya, dan retur masuk ke buku kas OTOMATIS. Tombol di atas hanya untuk uang di luar transaksi.</small></div>
${perBar()}${kpi([['Saldo awal', rp(K.open)], ['Uang masuk', rp(K.inn), K.rows.filter((r) => r.d > 0).length + ' transaksi'], ['Uang keluar', rp(K.out), K.rows.filter((r) => r.d < 0).length + ' transaksi'], ['Saldo akhir', rp(K.close)]])}
<div class="cd"><div class="seg" style="margin-top:0">${[['all', 'Kas + Bank'], ['1101', 'Tunai'], ['1102', 'Bank / QRIS']].map((x) => `<button class="${kAcc == x[0] ? 'a' : ''}" onclick="kAcc='${x[0]}';R()">${x[1]}</button>`).join('')}</div><div class="srch" style="margin-top:8px"><input placeholder="Cari keterangan / kategori / petugas" value="${esc(kQ)}" onchange="kQ=this.value;R()"></div><div class="wrap" style="margin-top:8px"><button class="gh" onclick="expKas()">⬇ Excel buku kas</button><button class="gh" onclick="shareKas()">Bagikan ringkasan</button></div></div>
<div class="two"><div class="cd"><h3>▲ Uang masuk per kategori</h3>${bars(Object.entries(cin).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v), rp)}</div><div class="cd"><h3>▼ Uang keluar per kategori</h3>${bars(Object.entries(cat).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v), rp)}</div></div>
<div class="cd"><h3>Uang masuk 14 hari terakhir</h3>${vbars(dd)}</div>
${Object.entries(byDay).map(([k, L]) => `<div class="cd"><div class="row" style="margin:0"><b>${dstr(L[0].e.t)}</b><small>▲ ${rp(L.filter((r) => r.d > 0).reduce((a, r) => a + r.d, 0))} · ▼ ${rp(L.filter((r) => r.d < 0).reduce((a, r) => a - r.d, 0))}</small></div>${L.map((r) => `<div class="row"><span><b class="${r.d > 0 ? 'gr' : 'rd'}">${r.d > 0 ? '＋' : '－'}${rp(Math.abs(r.d))}</b> <span class="chip ${r.d > 0 ? 'g' : 'r'}">${esc(r.cat)}</span><br><small class="mu">${hm(r.e.t)} · ${esc(r.e.d)}${r.e.u ? ' · ' + esc(r.e.u) : ''}</small></span><small class="mu">${rp(r.sd)}</small></div>`).join('')}</div>`).join('') || '<div class="cd mu">Belum ada pergerakan kas pada periode ini.</div>'}`;
};
function kasForm(dir) {
  const cats = dir == 'in' ? KIN : KOUT;
  const m = modal(`<h3>${dir == 'in' ? '＋ Uang masuk' : '－ Uang keluar'} (di luar transaksi)</h3><div class="fm"><input id="ka" type="number" placeholder="Jumlah (Rp)" inputmode="numeric"><select id="kc">${cats.map((c) => `<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select><select id="km"><option value="Tunai">Dari / ke Kas tunai</option><option value="Transfer">Dari / ke Bank / QRIS</option></select><input id="kd" placeholder="Catatan (mis. bayar listrik Oktober, setoran modal dari rekening pribadi)"><label><small class="mu">Tanggal</small><input id="kt" type="date" value="${dkey(Date.now())}" max="${dkey(Date.now())}"></label></div><button class="pr" id="ok">Simpan</button>`);
  $('#ok', m).onclick = () => {
    const amt = num($('#ka', m).value); if (amt <= 0) return toast('Isi jumlah');
    const dv = $('#kt', m).value, t = dv && dv != dkey(Date.now()) ? new Date(dv + 'T12:00:00').getTime() : undefined;
    emit('kas', { dir, a: $('#kc', m).value, amt, m: $('#km', m).value, d: $('#kd', m).value.trim(), cat: $('#kc', m).selectedOptions[0].text }, t); m.close(); toast('Tercatat di buku kas'); R();
  };
}
function kasTf() {
  const m = modal(`<h3>⇄ Pindah dana kas ↔ bank</h3><div class="fm"><select id="kf"><option value="Tunai">Dari Kas tunai → ke Bank</option><option value="Transfer">Dari Bank → ke Kas tunai</option></select><input id="ka" type="number" placeholder="Jumlah (Rp)"><input id="kd" placeholder="Catatan (mis. setor ke bank)"></div><button class="pr" id="ok">Simpan</button>`);
  $('#ok', m).onclick = () => { const amt = num($('#ka', m).value), f = $('#kf', m).value; if (amt <= 0) return toast('Isi jumlah'); emit('kas', { dir: 'tf', amt, m: f, m2: f == 'Tunai' ? 'Transfer' : 'Tunai', d: $('#kd', m).value.trim() }); m.close(); R(); toast('Dana dipindahkan'); };
}
function kasCount() {
  const sys = bal('1101');
  const m = modal(`<h3>🧮 Hitung kas fisik</h3><small class="mu">Hitung uang tunai di laci / brankas lalu isi. Selisih otomatis dijurnal.</small>${row('Saldo kas menurut sistem', rp(sys), 'bo')}<input id="kp" type="number" placeholder="Uang tunai fisik (Rp)"><div class="row"><span>Selisih</span><b id="kdf">-</b></div><button class="pr" id="ok">Catat selisih</button>`);
  $('#kp', m).oninput = () => { const d = num($('#kp', m).value) - sys; $('#kdf', m).textContent = (d > 0 ? '+' : '') + rp(d); $('#kdf', m).className = d == 0 ? 'gr' : 'rd'; };
  $('#ok', m).onclick = () => { if ($('#kp', m).value === '') return toast('Isi uang fisik'); const d = num($('#kp', m).value) - sys; if (!d) { m.close(); return toast('Kas cocok ✅'); } emit('kas', d > 0 ? { dir: 'in', a: '4201', amt: d, m: 'Tunai', d: 'Selisih hitung kas fisik (lebih)' } : { dir: 'out', a: '6104', amt: -d, m: 'Tunai', d: 'Selisih hitung kas fisik (kurang)' }); m.close(); R(); toast('Selisih ' + rp(d) + ' dicatat'); };
}
function expKas() {
  if (!window.XLSX) return toast('Pustaka Excel belum termuat');
  const K = kasRows(PF, PT, kAcc), rows = [['Tanggal', 'Jam', 'Keterangan', 'Kategori', 'Masuk', 'Keluar', 'Saldo', 'Petugas']];
  rows.push(['', '', 'Saldo awal', '', '', '', K.open, '']);
  K.rows.forEach((r) => rows.push([dstr(r.e.t), hm(r.e.t), r.e.d, r.cat, r.d > 0 ? r.d : '', r.d < 0 ? -r.d : '', r.sd, r.e.u || '']));
  rows.push(['', '', 'Total', '', K.inn, K.out, K.close, '']);
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 11 }, { wch: 7 }, { wch: 44 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]; XLSX.utils.book_append_sheet(wb, ws, 'Buku Kas');
  const g = {}; K.rows.forEach((r) => { const o = (g[r.cat] = g[r.cat] || [0, 0]); if (r.d > 0) o[0] += r.d; else o[1] -= r.d; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Kategori', 'Masuk', 'Keluar'], ...Object.entries(g).map(([k, v]) => [k, v[0], v[1]])]), 'Per Kategori');
  saveFile('buku-kas-' + FNAME(S.name) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
}
function shareKas() { const K = kasRows(PF, PT, kAcc); shareText('Buku kas ' + (S.name || ''), `Buku kas ${S.name || ''}\nPeriode ${perLabel()}\nSaldo awal ${rp(K.open)}\nUang masuk ${rp(K.inn)}\nUang keluar ${rp(K.out)}\nSaldo akhir ${rp(K.close)}`); }
