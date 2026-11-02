'use strict';
/* ============ PRODUK & STOK ============ */
let prQ = '';
const imgData = (f, max = 160) => new Promise((ok) => {
  const r = new FileReader();
  r.onload = () => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, max / Math.max(i.width, i.height)); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72)); }; i.onerror = () => ok(''); i.src = r.result; };
  r.onerror = () => ok(''); r.readAsDataURL(f);
});
VW.prod = () => {
  const t = prQ.toLowerCase(), L = actProds().filter((p) => !t || p.n.toLowerCase().includes(t) || String(p.sku || '').toLowerCase().includes(t) || String(p.kd || '').toLowerCase().includes(t) || p.c.toLowerCase().includes(t));
  const low = actProds().filter((p) => p.st <= (p.min ?? 10));
  return `${kpi([['Jumlah produk', actProds().length], ['Nilai stok layak jual', rp(stockValue())], ['Stok menipis', low.length], ['Bad stock', badUnits() + ' unit · ' + rp(badValue())]])}
<div class="cd">${can('prodEdit') ? `<div class="wrap" style="margin-bottom:10px"><button class="gh pri" onclick="prodForm()">+ Produk</button><button class="gh" onclick="scanFind()">▣ Scan barcode</button><button class="gh" onclick="bcOpen()">🏷️ Cetak barcode</button><button class="gh" onclick="opnameForm()">Opname stok</button><button class="gh" onclick="bundleAtur()">🎁 Paket bundling</button>${['owner', 'admin'].includes(U.r) && can('retur') ? '<button class="gh" onclick="RTO.tab=\'bad\';go(\'retur\')">🗑️ Bad stock & pemusnahan</button>' : ''}${pkgHas('xls') && can('xls') ? '<button class="gh" onclick="xlsMenu(\'stok\')">📊 Excel</button>' : '<label class="gh">Impor Excel/CSV<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="impProd(this)"></label><button class="gh" onclick="tplProd()">Template</button>'}${pkgHas('beli') && can('beli') ? '<button class="gh" onclick="go(\'beli\')">📥 Pembelian</button>' : ''}</div>` : '<small class="mu">Mode lihat saja</small>'}
<input placeholder="Cari produk / kode item / SKU / kategori" value="${esc(prQ)}" onchange="prQ=this.value;R()"><div class="plist">${L.map((p) => { const lo = p.st <= (p.min ?? 10); return `<div class="pitem"><div class="ph1"><b>${esc(p.n)}</b>${p.kd ? '<span class="kd">' + esc(p.kd) + '</span>' : ''}</div><small class="mu">${esc(p.c)}${p.b ? ' · ' + esc(p.b) : ''}${p.sku ? ' · SKU ' + esc(p.sku) : ''}</small>${p.tiers && p.tiers.length ? `<small class="ptier">Grosir: ${esc(tierTxt(p))}</small>` : ''}
<div class="pnums"><span><small>Harga jual</small><b>${rp(p.pr)}</b></span><span><small>HPP</small><b>${rp(p.co)}</b></span><span><small>Stok</small><b class="${lo ? 'rd' : 'gr'}">${p.st.toLocaleString('id-ID')}${p.u ? ' <i>' + esc(p.u) + '</i>' : ''}</b></span><span><small>Bad stock</small><b class="${p.bad ? 'rd' : 'mu'}">${(p.bad || 0).toLocaleString('id-ID')}</b></span></div>
${typeof vanAll == 'function' && vanAll(p.id) ? `<small class="mu">🏬 Gudang ${(p.st - vanAll(p.id)).toLocaleString('id-ID')} · 🚚 di mobil kanvas ${vanAll(p.id).toLocaleString('id-ID')}</small>` : ''}${lo ? `<small class="rd">⚠ Stok menipis (minimal ${p.min ?? 10})</small>` : ''}${can('prodEdit') ? `<div class="pact"><button class="gh" onclick="prodForm('${p.id}')">✏️ Edit</button><button class="gh" onclick="bcOpen('${p.id}')">🏷️ Barcode</button><button class="gh pri" onclick="stkForm('${p.id}')">＋ Restok</button></div>` : ''}</div>`; }).join('') || '<div class="mu c" style="padding:20px">Belum ada produk. Tambahkan produk pertama Anda.</div>'}</div></div>`;
};
function prodForm(id, sku, then) {
  const p = id ? prod(id) : null, cats = [...new Set(actProds().map((x) => x.c))];
  const m = modal(`<h3>${p ? 'Edit' : 'Tambah'} produk</h3>
<input id="fn" placeholder="Nama produk *" value="${esc(p ? p.n : '')}"><div class="fm2"><input id="fc" list="cl" placeholder="Kategori" value="${esc(p ? p.c : '')}"><datalist id="cl">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist><input id="fb" list="bl" placeholder="Merek / brand" value="${esc(p ? p.b || '' : '')}"><datalist id="bl">${[...new Set(S.p.map((x) => x.b).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist><div class="srch"><input id="fk" placeholder="SKU / barcode" value="${esc(p ? p.sku || '' : sku || '')}"><button class="gh" id="fsc">▣</button></div></div>
<div class="fm2"><input id="fp" type="number" placeholder="Harga jual (Rp) *" value="${p ? p.pr : ''}"><input id="fh" type="number" placeholder="HPP / harga beli (Rp)" value="${p ? p.co : ''}"></div>
<div class="fm2">${p ? '' : '<input id="fs" type="number" placeholder="Stok awal">'}<input id="fm" type="number" placeholder="Stok minimum" value="${p ? p.min ?? 10 : 10}"></div>
<div class="cd info" style="padding:10px"><b>🛍️ Toko online</b><div class="fm2" style="margin-top:6px"><input id="fo" type="number" placeholder="Harga online (kosong = sama)" value="${p && p.opr ? p.opr : ''}"><input id="fu" placeholder="Satuan (pcs/dus/kg)" value="${esc(p ? p.u || '' : '')}"></div><label class="row" style="margin:6px 0 0"><span>Tampilkan di pasar online</span><input type="checkbox" id="fon" ${!p || p.on !== false ? 'checked' : ''}></label></div>
<div><b>Foto produk</b><div class="row" style="margin:4px 0"><img id="fpi" src="${p && p.img ? p.img : ''}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;${p && p.img ? '' : 'display:none'}" alt=""><div class="wrap" style="flex:1"><button type="button" class="gh" id="fcam">📷 Kamera</button><label class="gh">🖼️ Galeri<input id="fi" type="file" accept="image/*" style="display:none"></label>${p && p.img ? '<button type="button" class="gh d" id="fimx">Hapus foto</button>' : ''}</div></div></div>
<div><b>Diskon grosir bertingkat</b><br><small class="mu">Minimal qty → diskon %. Boleh berlapis, mis. 10+5 = 10% lalu 5%.</small><div id="tr"></div><button class="gh" id="ta">+ Tingkat</button></div>
<button class="pr" id="ok">Simpan</button>${p && U.r == 'owner' ? '<button class="gh d" id="ar">Arsipkan produk</button>' : ''}`);
  const tr = (p && p.tiers ? p.tiers : []).map((t) => ({ ...t })); const draw = () => { $('#tr', m).innerHTML = tr.map((t, i) => `<div class="fm2" style="grid-template-columns:90px 1fr 36px;margin:6px 0"><input type="number" min="2" placeholder="Min qty" value="${t.min || ''}" data-i="${i}" data-f="min"><input placeholder="Diskon % (mis. 5 atau 10+5)" value="${esc(t.d || '')}" data-i="${i}" data-f="d"><button class="gh d" data-del="${i}">✕</button></div>`).join(''); };
  draw(); m.addEventListener('input', (e) => { const i = e.target.dataset.i; if (i != null) tr[i][e.target.dataset.f] = e.target.dataset.f == 'min' ? num(e.target.value) : e.target.value.replace(/[^\d.,+]/g, ''); });
  m.addEventListener('click', (e) => { if (e.target.dataset.del != null) { tr.splice(+e.target.dataset.del, 1); draw(); } });
  $('#ta', m).onclick = () => { tr.push({ min: 0, d: '' }); draw(); };
  $('#fsc', m).onclick = () => scanCode((v) => { $('#fk', m).value = v; });
  let imgD = p && p.img ? p.img : '', imgRm = false;
  const showImg = () => { const i = $('#fpi', m); if (!i) return; if (imgD) { i.src = imgD; i.style.display = ''; } else i.style.display = 'none'; };
  $('#fcam', m).onclick = async () => { const ph = await camPhoto('environment', 480); if (ph) { imgD = ph; imgRm = false; showImg(); } };
  $('#fi', m).onchange = async () => { const f = $('#fi', m).files[0]; if (!f) return; imgD = await imgData(f, 360); imgRm = false; showImg(); };
  const fimx = $('#fimx', m); if (fimx) fimx.onclick = () => { imgD = ''; imgRm = true; showImg(); };
  $('#ok', m).onclick = async () => {
    const n = $('#fn', m).value.trim(), pr = num($('#fp', m).value); if (!n || pr <= 0) return toast('Nama dan harga jual wajib diisi');
    const sk = $('#fk', m).value.trim(); if (sk && S.p.some((x) => !x.x && x.sku == sk && x.id != (p && p.id))) return toast('SKU sudah dipakai produk lain');
    const d = { id: p ? p.id : 'p' + uid(), n, c: $('#fc', m).value.trim() || 'Umum', b: $('#fb', m).value.trim(), pr, sku: sk, min: num($('#fm', m).value), opr: num($('#fo', m).value) || 0, u: $('#fu', m).value.trim(), on: $('#fon', m).checked, tiers: tr.filter((t) => t.min > 1 && cfac(t.d) < 1).map((t) => ({ min: t.min, d: t.d })) };
    const co = num($('#fh', m).value); if (!p) { d.co = co; d.s0 = num(($('#fs', m) || {}).value); } else if (co != p.co) d.co = co;
    if (imgD && imgD != (p && p.img)) d.img = imgD; else if (imgRm) d.img = '';
    emit('pu', { p: d }); m.close(); R(); toast('Produk disimpan'); if (typeof then == 'function') try { then(d.id); } catch (e) { }
  };
  const ar = $('#ar', m); if (ar) ar.onclick = () => { if (confirm('Arsipkan ' + p.n + '? Produk disembunyikan dari kasir (riwayat tetap ada).')) { emit('pu', { p: { id: p.id, x: 1 } }); m.close(); R(); } };
}
function scanFind() {
  scanCode((v) => {
    const p = bySku(v);
    if (p) { const m = modal(`<h3>${esc(p.n)}</h3><small>${esc(p.sku)} · stok ${p.st} · ${rp(p.pr)}</small><button class="pr" id="a">Restok</button><button class="gh" id="b">Edit produk</button>`); $('#a', m).onclick = () => { m.close(); stkForm(p.id); }; $('#b', m).onclick = () => { m.close(); prodForm(p.id); }; }
    else skuUnknown(v);
  });
}
const STKOUT = ['Rusak / hilang (susut)', 'Pemakaian sendiri / sampel', 'Retur ke supplier', 'Koreksi jumlah stok', 'Lainnya'];
let STKDIR = 'in';
function stkForm(id) {
  const p = prod(id), sups = [...new Set([...S.ap.map((a) => a.sup), ...(S.sup || []).filter((x) => !x.x).map((x) => x.n)].filter((x) => x && x != '-'))];
  STKDIR = 'in';
  const body = () => STKDIR == 'in'
    ? `<div class="fm2"><input id="sq" type="number" min="1" placeholder="Jumlah masuk"><input id="sc" type="number" placeholder="Harga beli / unit" value="${p.co}"></div><div id="savgwrap" style="display:none"></div><input id="ss" list="sl" placeholder="Supplier (opsional)"><datalist id="sl">${sups.map((s) => `<option value="${esc(s)}">`).join('')}</datalist><select id="sm"><option value="Tunai">Bayar tunai (kas)</option><option value="Transfer">Bayar transfer (bank)</option><option value="Kredit">Beli kredit (utang usaha)</option></select><div id="st" style="display:none"><input id="sd" type="number" placeholder="Tempo (hari)" value="${S.set.tempo || 30}"></div>`
    : `<div class="fm2"><input id="sq" type="number" min="1" max="${p.st}" placeholder="Jumlah keluar (maks ${p.st})"><select id="swy">${STKOUT.map((w) => `<option>${esc(w)}</option>`).join('')}</select></div><input id="swn" placeholder="Catatan (opsional)"><small class="mu">Nilai ${rp(p.co)}/unit otomatis dijurnal sebagai Selisih Stok — sama seperti stok opname.</small>`;
  const m = modal(`<h3>Restok ${esc(p.n)}</h3><small>Stok saat ini ${p.st} · HPP rata-rata ${rp(p.co)}</small><div class="seg" id="sdir"><button class="${STKDIR == 'in' ? 'a' : ''}" data-d="in">📥 Stok masuk</button><button class="${STKDIR == 'out' ? 'a' : ''}" data-d="out">📤 Stok keluar</button></div><div id="sbody">${body()}</div><button class="pr" id="ok">Simpan</button>`);
  const wire = () => {
    if (STKDIR == 'in') {
      const sel = $('#sm', m); if (sel) sel.onchange = (e) => { $('#st', m).style.display = e.target.value == 'Kredit' ? 'block' : 'none'; };
      const sc = $('#sc', m), wrap = $('#savgwrap', m);
      const chk = () => {
        const c = num(sc.value);
        if (c > p.co && p.co > 0) { wrap.style.display = 'block'; wrap.innerHTML = `<small class="or">⚠ Harga beli (${rp(c)}) naik dari HPP rata-rata sekarang (${rp(p.co)}).</small><select id="savg"><option value="w">Rata-rata tertimbang dengan stok lama (bawaan)</option><option value="new">Pakai harga terbaru saja sebagai HPP baru (${rp(c)})</option></select>`; }
        else wrap.style.display = 'none';
      };
      sc.oninput = chk; chk();
    }
  };
  wire();
  $$('[data-d]', m).forEach((b) => (b.onclick = () => { STKDIR = b.dataset.d; $$('[data-d]', m).forEach((x) => x.classList.toggle('a', x == b)); $('#sbody', m).innerHTML = body(); wire(); }));
  $('#ok', m).onclick = () => {
    const q = num($('#sq', m).value);
    if (STKDIR == 'in') {
      const c = num($('#sc', m).value), v = $('#sm', m).value; if (q <= 0 || c < 0) return toast('Isi jumlah dan harga beli');
      const avgSel = $('#savg', m);
      emit('stk', { p: id, qty: q, cost: c, cr: v == 'Kredit', m: v == 'Kredit' ? 'Tunai' : v, sup: $('#ss', m).value.trim(), tempo: num($('#sd', m).value) || 30, avg: avgSel ? avgSel.value : 'w' }); m.close(); R(); toast('Stok masuk dicatat');
    } else {
      if (q <= 0) return toast('Isi jumlah keluar'); if (q > p.st) return toast('Jumlah keluar melebihi stok saat ini (' + p.st + ')');
      const wy = $('#swy', m).value, note = $('#swn', m).value.trim();
      emit('opn', { p: id, delta: -q, why: note ? wy + ' · ' + note : wy }); m.close(); R(); toast('Stok keluar dicatat');
    }
  };
}
function opnameForm() {
  const L = actProds().sort((a, b) => a.n.localeCompare(b.n));
  const m = modal(`<h3>Opname stok</h3><small class="mu">Isi jumlah fisik hasil hitung. Kosongkan jika tidak dihitung. Selisih otomatis dijurnal (Selisih Stok).</small><button class="gh" id="osc">▣ Scan untuk mengisi</button><div class="ov" style="max-height:48vh"><table>${L.map((p) => `<tr data-id="${p.id}"><td>${esc(p.n)}<br><small>${esc(p.sku || '')}</small><td class="n">${p.st}<td><input type="number" id="o${p.id}" style="width:80px" placeholder="fisik"></tr>`).join('')}</table></div><button class="pr" id="ok">Simpan selisih</button>`, 'w');
  $('#osc', m).onclick = () => scanCode((v) => { const p = bySku(v); if (!p) return toast('SKU tidak dikenal: ' + v); const el = $('#o' + p.id, m); el.scrollIntoView({ block: 'center' }); el.value = (num(el.value) || 0) + 1; toast(p.n + ': ' + el.value, 1200); }, { multi: true });
  $('#ok', m).onclick = () => { let n = 0; for (const p of L) { const el = $('#o' + p.id, m); if (!el || el.value === '') continue; const d = num(el.value) - p.st; if (d) { emit('opn', { p: p.id, delta: d }); n++; } } m.close(); R(); toast(n ? n + ' produk disesuaikan' : 'Tidak ada selisih'); };
}
/* ---------- paket bundling: beberapa produk dijual satu paket dengan diskon Rp / % dari total harga normal ---------- */
let BD = null;
function bundleAtur() {
  if (!BD) BD = JSON.parse(JSON.stringify(S.bundle || []));
  const L = actProds().sort((a, b) => a.n.localeCompare(b.n));
  const normTot = (b) => b.items.reduce((a, i) => { const p = prod(i.id); return a + (p ? p.pr * i.q : 0); }, 0);
  const m = modal(`<h3>🎁 Paket bundling & bonus</h3><small class="mu">Beberapa produk dijual satu paket dengan harga spesial, atau pakai mode "Bonus barang" di keranjang kasir untuk barang gratis.</small><div id="bdlist"></div><button class="gh" id="badd" style="margin-top:6px">+ Paket baru</button><button class="pr" style="margin-top:10px" id="ok">💾 Simpan semua paket</button>`, 'w');
  const draw = () => {
    $('#bdlist', m).innerHTML = BD.map((b, bi) => `<div class="cd" style="padding:10px;margin-top:8px"><div class="fm2"><input placeholder="Nama paket" value="${esc(b.n)}" data-bf="n" data-bi="${bi}"><button class="gh d" data-bdel="${bi}">✕ Hapus paket</button></div>
${b.items.map((it, ii) => `<div class="fm2" style="grid-template-columns:1fr 70px 30px;margin:4px 0"><select data-bi="${bi}" data-ii="${ii}" data-bf="pid">${L.map((p) => `<option value="${p.id}" ${it.id == p.id ? 'selected' : ''}>${esc(p.n)} (${rp(p.pr)})</option>`).join('')}</select><input type="number" min="1" value="${it.q}" data-bi="${bi}" data-ii="${ii}" data-bf="q"><button class="gh d" data-idel="${bi}:${ii}">✕</button></div>`).join('')}
<button class="gh" style="margin-top:2px" data-iadd="${bi}">+ Produk ke paket</button>
<div class="fm2" style="margin-top:6px"><select data-bi="${bi}" data-bf="mode"><option value="rp" ${b.mode != 'pct' ? 'selected' : ''}>Potongan Rupiah</option><option value="pct" ${b.mode == 'pct' ? 'selected' : ''}>Potongan Persen (%)</option></select><input type="number" min="0" placeholder="${b.mode == 'pct' ? 'Persen (%)' : 'Nilai potongan (Rp)'}" value="${b.val || ''}" data-bi="${bi}" data-bf="val"></div>
<small class="mu">Harga normal paket ${rp(normTot(b))} → harga paket ${rp(Math.max(0, normTot(b) - (b.mode == 'pct' ? Math.round(normTot(b) * (b.val || 0) / 100) : (b.val || 0))))}</small>
<label class="row" style="margin:6px 0 0"><span>Aktif</span><input type="checkbox" data-bi="${bi}" data-bf="on" ${b.on !== false ? 'checked' : ''}></label></div>`).join('') || '<small class="mu" style="display:block;margin-top:8px">Belum ada paket.</small>';
  };
  draw();
  $('#badd', m).onclick = () => { BD.push({ id: '', n: '', items: [{ id: L[0] ? L[0].id : '', q: 1 }], mode: 'rp', val: 0, on: true }); draw(); };
  m.addEventListener('change', (e) => {
    const bi = e.target.dataset.bi, ii = e.target.dataset.ii, f = e.target.dataset.bf; if (bi == null || f == null) return;
    const b = BD[+bi]; if (!b) return;
    if (ii != null) { const it = b.items[+ii]; if (!it) return; if (f == 'pid') it.id = e.target.value; else if (f == 'q') it.q = Math.max(1, num(e.target.value)); }
    else if (f == 'n') b.n = e.target.value; else if (f == 'mode') b.mode = e.target.value; else if (f == 'val') b.val = num(e.target.value); else if (f == 'on') b.on = e.target.checked;
    draw();
  });
  m.addEventListener('click', (e) => {
    if (e.target.dataset.bdel != null) { BD.splice(+e.target.dataset.bdel, 1); draw(); }
    else if (e.target.dataset.iadd != null) { BD[+e.target.dataset.iadd].items.push({ id: L[0] ? L[0].id : '', q: 1 }); draw(); }
    else if (e.target.dataset.idel != null) { const [bi, ii] = e.target.dataset.idel.split(':').map(Number); BD[bi].items.splice(ii, 1); if (!BD[bi].items.length) BD.splice(bi, 1); draw(); }
  });
  $('#ok', m).onclick = () => { emit('bdl', { list: BD.filter((b) => b.n.trim() && b.items.length) }); BD = null; m.close(); toast('Paket bundling disimpan'); R(); };
}
/* ---- impor / template ---- */
const PCOL = { nama: 'n', produk: 'n', 'nama produk': 'n', kategori: 'c', sku: 'sku', barcode: 'sku', 'harga jual': 'pr', harga: 'pr', hpp: 'co', 'harga beli': 'co', stok: 's0', 'stok awal': 's0', min: 'min', 'stok minimum': 'min' };
function impProd(el) {
  const f = el.files[0]; el.value = ''; if (!f) return; if (!window.XLSX) return toast('Pustaka Excel belum termuat');
  const r = new FileReader();
  r.onload = () => {
    try {
      const wb = XLSX.read(new Uint8Array(r.result), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      let hi = rows.findIndex((x) => x.some((c) => PCOL[String(c).trim().toLowerCase()] == 'n')); if (hi < 0) hi = 0;
      const map = rows[hi].map((c) => PCOL[String(c).trim().toLowerCase()] || (rows[hi].some((x) => PCOL[String(x).trim().toLowerCase()]) ? null : ['n', 'c', 'pr', 'co', 's0', 'sku'][rows[hi].indexOf(c)]));
      const items = rows.slice(hi + 1, hi + 2001).map((x) => { const o = {}; map.forEach((k, i) => { if (k) o[k] = x[i]; }); return o; }).filter((o) => String(o.n || '').trim() && num(o.pr) > 0);
      if (!items.length) return toast('Tidak ada baris valid. Pakai kolom: Nama, Kategori, SKU, Harga Jual, HPP, Stok');
      if (!confirm(items.length + ' produk akan diimpor (SKU yang sama = perbarui harga). Lanjutkan?')) return;
      let nw = 0, up = 0;
      for (const o of items) {
        const sku = String(o.sku || '').trim(), ex = sku ? S.p.find((p) => !p.x && p.sku == sku) : null;
        const d = { id: ex ? ex.id : 'p' + uid(), n: String(o.n).trim(), c: String(o.c || 'Umum').trim() || 'Umum', pr: num(o.pr), sku, min: o.min === '' || o.min == null ? 10 : num(o.min) };
        if (ex) { d.co = num(o.co) || ex.co; up++; } else { d.co = num(o.co); d.s0 = num(o.s0); nw++; }
        emit('pu', { p: d });
      }
      R(); toast(nw + ' baru, ' + up + ' diperbarui');
    } catch (e) { console.error(e); toast('File tidak bisa dibaca'); }
  };
  r.readAsArrayBuffer(f);
}
function tplProd() {
  const w = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([['Nama', 'Kategori', 'SKU', 'Harga Jual', 'HPP', 'Stok', 'Stok Minimum'], ['Beras Premium 5kg', 'Sembako', '8991234500011', 68000, 62000, 100, 20], ['Minyak Goreng 2L', 'Sembako', '8991234500028', 36000, 32500, 60, 12]]);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }]; XLSX.utils.book_append_sheet(w, ws, 'Produk');
  saveFile('template-produk.xlsx', new Blob([XLSX.write(w, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
}
