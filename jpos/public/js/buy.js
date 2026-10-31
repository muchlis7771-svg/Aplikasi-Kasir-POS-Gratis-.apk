'use strict';
/* ============ PEMBELIAN STOK KE SUPPLIER / PABRIK / DISTRIBUTOR ============
   Alur: Supplier → Buat PO (multi-barang) → kirim ke supplier (WA) → Terima barang (bisa sebagian)
   → stok & HPP rata-rata naik, jurnal otomatis: Dr Persediaan / Cr Kas-Bank atau Utang Usaha (bila kredit, ada tempo & DP). */
let bTab = 'po', bFil = '', POD = null, SPQ = '';
const supOf = (id) => (S.sup || []).find((s) => s.id == id);
const poNo = () => 'PO-' + String((S.po || []).length + 1).padStart(4, '0');
const poTot = (po) => po.L.reduce((a, l) => a + l.q * l.c, 0);
const poRecv = (po) => po.L.reduce((a, l) => a + l.rq * l.c, 0);
const poLeft = (po) => po.L.reduce((a, l) => a + (l.q - l.rq), 0);
const POST = { dipesan: ['Dipesan', 'o'], sebagian: ['Sebagian', ''], diterima: ['Diterima', 'g'], batal: ['Batal', 'r'] };
const supList = () => (S.sup || []).filter((s) => !s.x).sort((a, b) => a.n.localeCompare(b.n));
const supStat = (s) => { const pos = (S.po || []).filter((p) => p.sup == s.id && p.st != 'batal'), ut = S.ap.filter((a) => a.sup == s.n).reduce((t, a) => t + apOut(a), 0); return { n: pos.length, tot: pos.reduce((t, p) => t + poRecv(p), 0), ut }; };
const lowStock = () => actProds().filter((p) => p.st <= (p.min ?? 10)).sort((a, b) => a.st - b.st);

VW.beli = () => (S.srv && ['owner', 'admin'].includes(U.r) ? '<div class="cd"><div class="row" style="margin:0"><span><b>🛒 Order online ke distributor / grosir</b><br><small class="mu">Belanja ke toko lain yang terdaftar di J-POS — stok ready, harga & diskon grosir terlihat.</small></span><button class="pr" onclick="startBuyerAsStore()">Buka</button></div></div>' : '') + VW.beli0();
VW.beli0 = () => {
  const now = Date.now(), act = (S.po || []).filter((p) => p.st == 'dipesan' || p.st == 'sebagian'), apl = S.ap.filter((a) => apOut(a) > 0).sort((a, b) => a.due - b.due);
  const wait = act.reduce((t, p) => t + (poTot(p) - poRecv(p)), 0), ut = apl.reduce((t, a) => t + apOut(a), 0), od = apl.filter((a) => a.due < now).reduce((t, a) => t + apOut(a), 0);
  let body = '';
  if (bTab == 'po') {
    const L = (S.po || []).filter((p) => !bFil || p.st == bFil).slice().reverse();
    body = `<div class="cd"><div class="seg" style="margin-top:0">${[['', 'Semua'], ['dipesan', 'Dipesan'], ['sebagian', 'Sebagian'], ['diterima', 'Diterima'], ['batal', 'Batal']].map((x) => `<button class="${bFil == x[0] ? 'a' : ''}" onclick="bFil='${x[0]}';R()">${x[1]}</button>`).join('')}</div></div>`
      + (L.map((p) => `<div class="cd" onclick="poDetail('${p.id}')" style="cursor:pointer"><div class="row" style="margin:0"><b>${esc(p.no)} · ${esc(p.sn || '-')}</b><span class="chip ${POST[p.st][1]}">${POST[p.st][0]}</span></div><small class="mu">${dstr(p.t)} · ${p.L.length} barang · oleh ${esc(p.u)}${p.eta ? ' · tiba ' + dstr(p.eta) : ''}</small><div class="row" style="margin:6px 0 0"><span>Total</span><b>${rp(poTot(p))}</b></div>${p.st == 'sebagian' ? `<small class="or">Terima ${rp(poRecv(p))} · sisa ${poLeft(p)} unit</small>` : ''}</div>`).join('') || '<div class="cd mu">Belum ada pesanan. Ketuk “+ Buat PO” untuk memesan stok ke supplier.</div>');
  } else if (bTab == 'sup') {
    const q = SPQ.toLowerCase(), L = supList().filter((s) => !q || s.n.toLowerCase().includes(q));
    body = `<div class="cd"><input placeholder="Cari supplier" value="${esc(SPQ)}" onchange="SPQ=this.value;R()"></div>` + (L.map((s) => { const st = supStat(s); return `<div class="cd"><div class="row" style="margin:0"><b>${esc(s.n)}</b><span>${s.ph ? `<a class="gh" style="text-decoration:none;color:inherit" href="https://wa.me/${esc(waNum(s.ph))}" target="_blank" rel="noopener">WA</a>` : ''}</span></div><small class="mu">${esc(s.ad || 'Alamat belum diisi')}${s.ph ? ' · ' + esc(s.ph) : ''} · tempo ${s.tempo || 30} hr</small><div class="row" style="margin:6px 0 0"><small>${st.n} PO · beli ${rp(st.tot)}</small>${st.ut ? `<b class="or">Utang ${rp(st.ut)}</b>` : '<small class="gr">Tidak ada utang</small>'}</div><div class="wrap" style="margin-top:8px"><button class="gh a" onclick="poForm(null,'${s.id}')">Buat PO</button><button class="gh" onclick="supForm('${s.id}')">Edit</button></div></div>`; }).join('') || '<div class="cd mu">Belum ada supplier. Tambahkan pabrik / distributor / grosir langganan.</div>');
  } else if (bTab == 'low') {
    body = ordView();
  } else {
    body = `<div class="cd"><h3>Utang ke supplier</h3>${apl.map((a) => `<div class="row"><span><b>${esc(a.sup)}</b><br><small>${esc(a.d)} · tempo ${dstr(a.due)}${a.due < now ? ' <b class="rd">lewat ' + Math.floor((now - a.due) / 864e5) + ' hr</b>' : ''}</small></span><span><b>${rp(apOut(a))}</b> <button class="gh" onclick="apayModal('${esc(a.id)}')">Bayar</button></span></div>`).join('') || '<small class="mu">Tidak ada utang 🎉</small>'}</div>`;
  }
  return `${kpi([['PO aktif', act.length, 'menunggu barang'], ['Nilai menunggu', rp(wait)], ['Utang supplier', rp(ut), od ? 'lewat tempo ' + rp(od) : ''], ['Stok menipis', lowStock().length, 'perlu restok']])}
<div class="cd"><div class="wrap"><button class="pr" style="flex:1" onclick="poForm()">+ Buat PO</button><button class="gh" onclick="supForm()">+ Supplier</button>${pkgHas('xls') && can('xls') ? '<button class="gh" onclick="expPO()">⬇ Excel</button>' : ''}</div><div class="seg">${[['po', 'Pesanan'], ['sup', 'Supplier'], ['low', '🧠 Analisa order'], ['ut', 'Utang']].map((x) => `<button class="${bTab == x[0] ? 'a' : ''}" onclick="bTab='${x[0]}';R()">${x[1]}</button>`).join('')}</div></div>${body}`;
};
const waNum = (p) => { let n = String(p || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); return n; };

/* ---------- supplier ---------- */
function supForm(id) {
  const s = id ? supOf(id) : null;
  const m = modal(`<h3>${s ? 'Edit' : 'Tambah'} supplier</h3><div class="fm"><input id="sn" placeholder="Nama pabrik / distributor / grosir" value="${esc(s ? s.n : '')}"><input id="sp" placeholder="No. WhatsApp / telepon" value="${esc(s ? s.ph : '')}" inputmode="tel"><input id="sa" placeholder="Alamat" value="${esc(s ? s.ad : '')}"><label><small class="mu">Tempo pembayaran default (hari)</small><input id="st" type="number" value="${s ? s.tempo || 30 : 30}"></label><input id="sc" placeholder="Catatan (sales, rekening, dll)" value="${esc(s ? s.note : '')}"></div><button class="pr" id="ok">Simpan</button>${s && U.r == 'owner' ? '<button class="gh d" id="del">Hapus supplier</button>' : ''}`);
  $('#ok', m).onclick = () => { const n = $('#sn', m).value.trim(); if (!n) return toast('Nama supplier wajib'); emit('sup', { s: { id: s ? s.id : 's' + uid(), n, ph: $('#sp', m).value.trim(), ad: $('#sa', m).value.trim(), tempo: num($('#st', m).value) || 30, note: $('#sc', m).value.trim() } }); m.close(); toast('Supplier disimpan'); R(); };
  const d = $('#del', m); if (d) d.onclick = () => { if (confirm('Hapus supplier ' + s.n + '? (PO lama tetap tersimpan)')) { emit('sup', { s: { id: s.id, x: 1 } }); m.close(); R(); } };
}

/* ---------- buat / edit PO ---------- */
function poForm(id, supId, fromLow) {
  const old = id ? (S.po || []).find((p) => p.id == id) : null;
  if (!supList().length && !old) { toast('Tambahkan supplier dulu'); return supForm(); }
  POD = old ? { id: old.id, no: old.no, sup: old.sup, L: old.L.map((l) => ({ ...l })), note: old.note, tempo: old.tempo, eta: old.eta } : { id: 'po-' + S.dv + '-' + uid(), no: poNo(), sup: supId || '', L: [], note: '', tempo: 0, eta: 0 };
  if (!old && fromLow == 'ana') POD.L = ordPOLines();
  else if (!old && fromLow) POD.L = lowStock().map((p) => ({ p: p.id, n: p.n, q: Math.max(1, (p.min ?? 10) * 2 - p.st), c: p.co, rq: 0 }));
  const m = modal('<div id="pob"></div>', 'w'); poPaint(m); return m;
}
function poPaint(m) {
  const d = POD, ss = supList(), sp = supOf(d.sup), tot = d.L.reduce((a, l) => a + l.q * l.c, 0);
  const q = ($('#ppq', m) || {}).value || '';
  $('#pob', m).innerHTML = `<h3>${d.no}</h3>
<label><small class="mu">Supplier / pabrik / distributor</small><select id="pos" onchange="POD.sup=this.value;POD.tempo=(supOf(this.value)||{}).tempo||0">${'<option value="">— pilih supplier —</option>' + ss.map((s) => `<option value="${s.id}" ${d.sup == s.id ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label>
<div class="fm2"><label><small class="mu">Tempo bayar (hari)</small><input id="pot" type="number" value="${d.tempo || (sp && sp.tempo) || 30}" onchange="POD.tempo=num(this.value)"></label><label><small class="mu">Estimasi tiba</small><input id="poe" type="date" value="${d.eta ? dkey(d.eta) : ''}" onchange="POD.eta=this.value?new Date(this.value+'T12:00:00').getTime():0"></label></div>
<b>Barang</b>
${d.L.map((l, i) => `<div class="cd" style="padding:10px"><div class="row" style="margin:0"><b>${esc(l.n)}</b><button class="gh d" onclick="POD.L.splice(${i},1);poPaint($('.md'))">✕</button></div><div class="fm2"><label><small class="mu">Jumlah</small><input type="number" min="1" value="${l.q}" onchange="POD.L[${i}].q=Math.max(1,num(this.value));poPaint($('.md'))"></label><label><small class="mu">Harga beli /unit</small><input type="number" value="${l.c}" onchange="POD.L[${i}].c=Math.max(0,num(this.value));poPaint($('.md'))"></label></div><small class="mu">Stok sekarang ${prod(l.p) ? prod(l.p).st : '-'} · subtotal <b>${rp(l.q * l.c)}</b></small></div>`).join('') || '<small class="mu">Belum ada barang. Cari produk di bawah.</small>'}
<input id="ppq" placeholder="🔍 Cari produk / scan SKU untuk ditambahkan" value="${esc(q)}" oninput="poSearch(this.value)"><div id="pol" style="display:grid;gap:4px"></div>
<div class="wrap"><button class="gh" onclick="poScan()">▣ Scan</button><button class="gh" onclick="poAddLow()">+ Semua stok menipis</button></div>
<input id="pon" placeholder="Catatan untuk supplier" value="${esc(d.note || '')}" onchange="POD.note=this.value">
<div class="row"><span>Total pesanan</span><b style="font-size:18px">${rp(tot)}</b></div>
<button class="pr" id="pok">${(S.po || []).some((p) => p.id == d.id) ? 'Simpan perubahan' : 'Simpan & pesan'}</button><button class="gh" onclick="this.closest('.md').close()">Tutup</button>`;
  $('#pok', m).onclick = () => {
    if (!d.sup) return toast('Pilih supplier'); if (!d.L.length) return toast('Tambahkan minimal 1 barang');
    const s = supOf(d.sup); emit('po', { po: { id: d.id, no: d.no, sup: d.sup, sn: s ? s.n : '', L: d.L.map((l) => ({ p: l.p, n: l.n, q: l.q, c: l.c })), note: d.note, tempo: d.tempo || (s && s.tempo) || 30, eta: d.eta } });
    m.close(); toast(d.no + ' tersimpan'); bTab = 'po'; R(); const po = (S.po || []).find((p) => p.id == d.id); if (po) poDetail(po.id);
  };
  if (q) poSearch(q);
}
function poSearch(v) {
  const t = String(v || '').toLowerCase(), el = $('#pol'); if (!el) return;
  const L = t ? actProds().filter((p) => p.n.toLowerCase().includes(t) || String(p.sku || '').toLowerCase().includes(t)).slice(0, 8) : [];
  el.innerHTML = L.map((p) => `<button class="gh" style="text-align:left" onclick="poAdd('${p.id}')">${esc(p.n)} <small class="mu">· stok ${p.st} · HPP ${rp(p.co)}</small></button>`).join('');
}
function poAdd(pid) { const p = prod(pid); if (!p) return; const l = POD.L.find((x) => x.p == pid); if (l) l.q++; else POD.L.push({ p: pid, n: p.n, q: Math.max(1, (p.min ?? 10) * 2 - p.st), c: p.co, rq: 0 }); const q = $('#ppq'); if (q) q.value = ''; poPaint($('.md')); }
function poScan() { scanCode((v) => { const p = bySku(v); if (p) { poAdd(p.id); toast('+ ' + p.n + ' (ketuk jumlah untuk mengubah)', 1500); return true; } skuUnknown(v, (id) => poAdd(id)); return false; }, { multi: true }); }
function poAddLow() { lowStock().forEach((p) => { if (!POD.L.some((x) => x.p == p.id)) POD.L.push({ p: p.id, n: p.n, q: Math.max(1, (p.min ?? 10) * 2 - p.st), c: p.co, rq: 0 }); }); poPaint($('.md')); }

/* ---------- detail & aksi PO ---------- */
function poText(p) {
  const s = supOf(p.sup);
  return `*PURCHASE ORDER ${p.no}*\n${S.name || ''}${S.set.addr ? '\n' + S.set.addr : ''}${S.set.tel ? '\nTelp ' + S.set.tel : ''}\nTanggal: ${dstr(p.t)}\nKepada: ${p.sn || (s && s.n) || '-'}\n\n` + p.L.map((l, i) => `${i + 1}. ${l.n} — ${l.q} × ${rp(l.c)} = ${rp(l.q * l.c)}`).join('\n') + `\n\n*Total ${rp(poTot(p))}*\nTempo pembayaran: ${p.tempo || 30} hari${p.eta ? '\nEstimasi tiba: ' + dstr(p.eta) : ''}${p.note ? '\nCatatan: ' + p.note : ''}\n\nMohon konfirmasi ketersediaan & jadwal kirim. Terima kasih 🙏`;
}
function poDetail(id) {
  const p = (S.po || []).find((x) => x.id == id); if (!p) return; const s = supOf(p.sup), can2 = p.st == 'dipesan' || p.st == 'sebagian';
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">${esc(p.no)}</h3><span class="chip ${POST[p.st][1]}">${POST[p.st][0]}</span></div><small class="mu">${esc(p.sn || '-')} · ${tstr(p.t)} · ${esc(p.u)}${p.eta ? ' · tiba ' + dstr(p.eta) : ''}</small>
<div class="ov"><table><tr><th>Barang<th class="n">Pesan<th class="n">Terima<th class="n">Harga</tr>${p.L.map((l) => `<tr><td>${esc(l.n)}<td class="n">${l.q}<td class="n ${l.rq >= l.q ? 'gr' : l.rq ? 'or' : ''}">${l.rq}<td class="n">${rp(l.c)}</tr>`).join('')}</table></div>
${row('Total pesanan', rp(poTot(p)), 'bo')}${p.rc && p.rc.length ? '<b>Riwayat penerimaan</b>' + p.rc.map((r) => `<div class="row"><small>${tstr(r.t)} · ${esc(r.u)}${r.inv ? ' · faktur ' + esc(r.inv) : ''} · ${esc(r.pay)}${r.ship ? ' · ongkir ' + rp(r.ship) : ''}</small><b>${rp(r.tot)}</b></div>`).join('') : ''}${p.note ? `<small>Catatan: ${esc(p.note)}</small>` : ''}
<div class="wrap">${can2 ? '<button class="pr" id="b1" style="flex:1">📥 Terima barang</button>' : ''}<button class="gh a" id="b2">Bagikan PO</button>${s && s.ph ? `<a class="gh" style="text-decoration:none;color:inherit" href="https://wa.me/${esc(waNum(s.ph))}?text=${encodeURIComponent(poText(p))}" target="_blank" rel="noopener">Kirim WA</a>` : ''}${p.st == 'dipesan' ? '<button class="gh" id="b3">Edit</button><button class="gh d" id="b4">Batalkan</button>' : ''}<button class="gh" id="bx">Tutup</button></div>`, 'w');
  const g = (i) => $('#' + i, m);
  if (g('b1')) g('b1').onclick = () => { m.close(); rcvForm(id); };
  g('b2').onclick = () => shareText('PO ' + p.no, poText(p));
  if (g('b3')) g('b3').onclick = () => { m.close(); poForm(id); };
  if (g('b4')) g('b4').onclick = () => { if (confirm('Batalkan ' + p.no + '?')) { emit('po', { po: { id: p.id, st: 'batal' } }); m.close(); R(); } };
  g('bx').onclick = () => m.close();
}

/* ---------- terima barang (bisa sebagian) ---------- */
function rcvForm(id) {
  const p = (S.po || []).find((x) => x.id == id); if (!p) return; const s = supOf(p.sup), open = p.L.filter((l) => l.rq < l.q);
  const m = modal(`<h3>Terima barang · ${esc(p.no)}</h3><small class="mu">Isi jumlah yang benar-benar datang. Harga bisa disesuaikan dengan faktur supplier.</small>
${open.map((l, i) => `<div class="cd" style="padding:10px"><b>${esc(l.n)}</b> <small class="mu">sisa ${l.q - l.rq} dari ${l.q}</small><div class="fm2"><label><small class="mu">Datang</small><input type="number" min="0" max="${l.q - l.rq}" id="rq${i}" value="${l.q - l.rq}"></label><label><small class="mu">Harga /unit</small><input type="number" id="rc${i}" value="${l.c}"></label></div></div>`).join('')}
<div class="fm2"><input id="rinv" placeholder="No. faktur supplier"><input id="rship" type="number" placeholder="Ongkir / biaya lain"></div>
<select id="rpay"><option value="Tunai">Bayar tunai (kas)</option><option value="Transfer">Bayar transfer (bank)</option><option value="Kredit">Kredit — masuk utang usaha</option></select>
<div id="rkr" style="display:none" class="fm2"><input id="rdp" type="number" placeholder="DP dibayar (opsional)"><select id="rdm"><option>Tunai</option><option>Transfer</option></select><input id="rtp" type="number" placeholder="Tempo (hari)" value="${p.tempo || (s && s.tempo) || 30}" style="grid-column:1/3"></div>
<div class="row"><span>Total diterima</span><b id="rtot">-</b></div><button class="pr" id="ok">Terima & masukkan ke stok</button>`, 'w');
  const calcT = () => { let t = 0; open.forEach((l, i) => { t += Math.min(num($('#rq' + i, m).value), l.q - l.rq) * num($('#rc' + i, m).value); }); t += num($('#rship', m).value); $('#rtot', m).textContent = rp(t); return t; };
  m.addEventListener('input', calcT); calcT();
  $('#rpay', m).onchange = (e) => { $('#rkr', m).style.display = e.target.value == 'Kredit' ? 'grid' : 'none'; };
  $('#ok', m).onclick = () => {
    const L = open.map((l, i) => ({ p: l.p, q: Math.min(num($('#rq' + i, m).value), l.q - l.rq), c: num($('#rc' + i, m).value) })).filter((x) => x.q > 0);
    if (!L.length) return toast('Isi jumlah yang datang'); const k = $('#rpay', m).value == 'Kredit';
    emit('rcv', { po: id, L, ship: num($('#rship', m).value), inv: $('#rinv', m).value.trim(), pay: $('#rpay', m).value, m: k ? $('#rdm', m).value : $('#rpay', m).value, dp: k ? num($('#rdp', m).value) : 0, tempo: k ? num($('#rtp', m).value) || 30 : 0 });
    m.close(); toast('Barang diterima — stok & jurnal diperbarui'); R();
  };
}
function expPO() {
  if (!window.XLSX) return toast('Pustaka Excel belum termuat');
  const rows = [['No PO', 'Tanggal', 'Supplier', 'Status', 'Barang', 'Pesan', 'Terima', 'Harga', 'Subtotal']];
  (S.po || []).forEach((p) => p.L.forEach((l) => rows.push([p.no, dstr(p.t), p.sn, POST[p.st][0], l.n, l.q, l.rq, l.c, l.q * l.c])));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Pembelian');
  const sr = [['Supplier', 'Telepon', 'Alamat', 'Tempo (hari)', 'Catatan']]; supList().forEach((s) => sr.push([s.n, s.ph, s.ad, s.tempo || 30, s.note]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sr), 'Supplier');
  saveFile('pembelian-' + FNAME(S.name) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
}
