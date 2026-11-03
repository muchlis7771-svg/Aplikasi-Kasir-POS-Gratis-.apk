'use strict';
/* ============ PRODUK & STOK ============ */
let prQ = '', prF = '', prView = LS.get('jpos:prView', 'v');
// produk yang sedang jadi bagian promo/bundling aktif — dipakai untuk penanda 🎁 di daftar stok & saat order, supaya sales/kasir gampang info promo ke pelanggan
function promoSkuSet() {
  const set = new Set();
  for (const b of S.bundle || []) { if (b.st != 'ok' || b.on === false) continue; for (const it of b.items || []) set.add(it.id); for (const bo of b.bonus || []) set.add(bo.id); }
  return set;
}
function promoOf(id) { return (S.bundle || []).filter((b) => b.st == 'ok' && b.on !== false && ((b.items || []).some((i) => i.id == id) || (b.bonus || []).some((i) => i.id == id))); }
function setView(v) { prView = v; LS.set('jpos:prView', v); R(); }
const imgData = (f, max = 160) => new Promise((ok) => {
  const r = new FileReader();
  r.onload = () => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, max / Math.max(i.width, i.height)); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72)); }; i.onerror = () => ok(''); i.src = r.result; };
  r.onerror = () => ok(''); r.readAsDataURL(f);
});
VW.prod = () => {
  const t = prQ.toLowerCase(), promoSet = promoSkuSet(), focus = focusSet(), sups = [...new Set(actProds().map((p) => p.sup).filter(Boolean))].sort();
  let L = actProds().filter((p) => !t || p.n.toLowerCase().includes(t) || String(p.sku || '').toLowerCase().includes(t) || String(p.kd || '').toLowerCase().includes(t) || p.c.toLowerCase().includes(t));
  if (prF == 'low') L = L.filter((p) => p.st <= (p.min ?? 10)); else if (prF == 'bad') L = L.filter((p) => p.bad); else if (prF == 'promo') L = L.filter((p) => promoSet.has(p.id));
  if (pSup) L = L.filter((p) => (p.sup || '') == pSup);
  if (pFocus) L = L.filter((p) => focus.has(p.id));
  const low = actProds().filter((p) => p.st <= (p.min ?? 10));
  return `${kpi([['Jumlah produk', actProds().length, prF ? 'ketuk: tampilkan semua' : '', "prF='';R()", !prF], ['Nilai stok layak jual', rp(stockValue())], ['Stok menipis', low.length, 'ketuk untuk lihat', "prF=prF=='low'?'':'low';R()", prF == 'low'], ['Bad stock', badUnits() + ' unit · ' + rp(badValue()), 'ketuk untuk lihat', "prF=prF=='bad'?'':'bad';R()", prF == 'bad'], ['Sedang promo', promoSet.size + ' produk', 'ketuk untuk lihat', "prF=prF=='promo'?'':'promo';R()", prF == 'promo']])}
<div class="cd">${can('prodEdit') ? `<div class="wrap" style="margin-bottom:10px"><button class="gh pri" onclick="prodForm()">+ Produk</button><button class="gh" onclick="scanFind()">▣ Scan barcode</button><button class="gh" onclick="bcOpen()">🏷️ Cetak barcode</button><button class="gh" onclick="opnameForm()">Opname stok</button><button class="gh" onclick="bundleAtur()">🎁 Promo & bundling${U.r == 'owner' && (S.bundle || []).some((b) => b.st == 'pending') ? ' <em class="hbdg" style="position:static;display:inline-grid">' + (S.bundle || []).filter((b) => b.st == 'pending').length + '</em>' : ''}</button>${['owner', 'admin'].includes(U.r) && can('retur') ? '<button class="gh" onclick="RTO.tab=\'bad\';go(\'retur\')">🗑️ Bad stock & pemusnahan</button>' : ''}${pkgHas('xls') && can('xls') ? '<button class="gh" onclick="xlsMenu(\'stok\')">📊 Excel</button>' : '<label class="gh">Impor Excel/CSV<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="impProd(this)"></label><button class="gh" onclick="tplProd()">Template</button>'}${pkgHas('beli') && can('beli') ? '<button class="gh" onclick="go(\'beli\')">📥 Pembelian</button>' : ''}</div>` : '<small class="mu">Mode lihat saja</small>'}
<div class="row" style="margin:0 0 8px;gap:8px"><input placeholder="Cari produk / kode item / SKU / kategori" value="${esc(prQ)}" onchange="prQ=this.value;R()" style="flex:1"><div class="seg" style="margin:0"><button class="${prView == 'v' ? 'a' : ''}" onclick="setView('v')" title="Tampilan vertikal">☰ Vertikal</button><button class="${prView == 'h' ? 'a' : ''}" onclick="setView('h')" title="Tampilan horizontal">▦ Horizontal</button></div></div>
${sups.length || focus.size ? `<div class="row" style="margin:0 0 8px;gap:8px;flex-wrap:wrap">${sups.length ? `<select onchange="pSup=this.value;R()" style="flex:1;min-width:140px"><option value="">🏭 Semua supplier</option>${sups.map((s) => `<option value="${esc(s)}" ${pSup == s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : ''}${focus.size ? `<button class="gh ${pFocus ? 'a' : ''}" onclick="pFocus=!pFocus;R()">⭐ Item fokus (${focus.size})</button>` : ''}</div>` : ''}
${prView == 'h' ? `<div class="ov"><table><tr><th>Produk<th>Kategori<th class="n">Harga<th class="n">HPP<th class="n">Stok<th class="n">Bad<th></tr>${L.map((p) => { const lo = p.st <= (p.min ?? 10), promo = promoSet.has(p.id); return `<tr><td><b>${esc(p.n)}</b>${promo ? ' 🎁' : ''}${p.kd ? '<br><small class="kd">' + esc(p.kd) + '</small>' : ''}<td>${esc(p.c)}<td class="n">${rp(p.pr)}<td class="n">${rp(p.co)}<td class="n ${lo ? 'rd' : 'gr'}">${p.st.toLocaleString('id-ID')}<td class="n ${p.bad ? 'rd' : 'mu'}">${(p.bad || 0).toLocaleString('id-ID')}<td>${can('prodEdit') ? `<button class="gh" style="padding:4px 8px" onclick="prodForm('${p.id}')">✏️</button><button class="gh pri" style="padding:4px 8px" onclick="stkForm('${p.id}')">＋</button>` : ''}</tr>`; }).join('') || `<tr><td colspan="7" class="mu c">Belum ada produk.</td></tr>`}</table></div>` : `<div class="plist">${L.map((p) => { const lo = p.st <= (p.min ?? 10), promo = promoSet.has(p.id); return `<div class="pitem"><div class="ph1"><b>${esc(p.n)}</b>${promo ? ' <span class="chip g" style="padding:1px 7px;font-size:11px">🎁 Promo</span>' : ''}${p.kd ? '<span class="kd">' + esc(p.kd) + '</span>' : ''}</div><small class="mu">${esc(p.c)}${p.b ? ' · ' + esc(p.b) : ''}${p.sku ? ' · SKU ' + esc(p.sku) : ''}${p.sup ? ' · 🏭 ' + esc(p.sup) : ''}</small>${p.tiers && p.tiers.length ? `<small class="ptier">Grosir: ${esc(tierTxt(p))}</small>` : ''}
<div class="pnums"><span><small>Harga jual</small><b>${rp(p.pr)}</b></span><span><small>HPP</small><b>${rp(p.co)}</b></span><span><small>Stok</small><b class="${lo ? 'rd' : 'gr'}">${p.st.toLocaleString('id-ID')}${p.u ? ' <i>' + esc(p.u) + '</i>' : ''}</b></span><span><small>Bad stock</small><b class="${p.bad ? 'rd' : 'mu'}">${(p.bad || 0).toLocaleString('id-ID')}</b></span></div>
${typeof vanAll == 'function' && vanAll(p.id) ? `<small class="mu">🏬 Gudang ${(p.st - vanAll(p.id)).toLocaleString('id-ID')} · 🚚 di mobil kanvas ${vanAll(p.id).toLocaleString('id-ID')}</small>` : ''}${lo ? `<small class="rd">⚠ Stok menipis (minimal ${p.min ?? 10})</small>` : ''}${promo ? `<small class="gr">🎁 ${esc(promoOf(p.id).map((b) => b.n).join(', '))}</small>` : ''}${can('prodEdit') ? `<div class="pact"><button class="gh" onclick="prodForm('${p.id}')">✏️ Edit</button><button class="gh" onclick="bcOpen('${p.id}')">🏷️ Barcode</button><button class="gh pri" onclick="stkForm('${p.id}')">＋ Restok</button></div>` : ''}</div>`; }).join('') || '<div class="mu c" style="padding:20px">Belum ada produk. Tambahkan produk pertama Anda.</div>'}</div>`}</div>`;
};
function prodForm(id, sku, then) {
  const p = id ? prod(id) : null, cats = [...new Set(actProds().map((x) => x.c))];
  const m = modal(`<h3>${p ? 'Edit' : 'Tambah'} produk</h3>
<input id="fn" placeholder="Nama produk *" value="${esc(p ? p.n : '')}"><div class="fm2"><input id="fc" list="cl" placeholder="Kategori" value="${esc(p ? p.c : '')}"><datalist id="cl">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist><input id="fb" list="bl" placeholder="Merek / brand" value="${esc(p ? p.b || '' : '')}"><datalist id="bl">${[...new Set(S.p.map((x) => x.b).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist><div class="srch"><input id="fk" placeholder="SKU / barcode" value="${esc(p ? p.sku || '' : sku || '')}"><button class="gh" id="fsc">▣</button></div><input id="fsup" list="supl" placeholder="Supplier (untuk filter saat order)" value="${esc(p ? p.sup || '' : '')}"><datalist id="supl">${[...new Set([...(S.sup || []).filter((x) => !x.x).map((x) => x.n), ...S.p.map((x) => x.sup).filter(Boolean)])].map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
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
    const d = { id: p ? p.id : 'p' + uid(), n, c: $('#fc', m).value.trim() || 'Umum', b: $('#fb', m).value.trim(), pr, sku: sk, min: num($('#fm', m).value), opr: num($('#fo', m).value) || 0, u: $('#fu', m).value.trim(), on: $('#fon', m).checked, sup: $('#fsup', m).value.trim(), tiers: tr.filter((t) => t.min > 1 && cfac(t.d) < 1).map((t) => ({ min: t.min, d: t.d })) };
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
/* ---------- promo: bundling / bonus barang / diskon — admin ajukan (butuh persetujuan pemilik), pemilik langsung aktif; otomatis terdeteksi & diterapkan di kasir ---------- */
function bundleAtur() {
  const m = modal(`<h3>🎁 Promo: bundling, diskon & bonus barang</h3><small class="mu">${U.r == 'admin' ? 'Promo yang Anda buat perlu disetujui pemilik dulu sebelum aktif di kasir.' : 'Promo yang Anda buat langsung aktif di kasir.'} Terdeteksi & diterapkan otomatis saat isi keranjang sesuai syarat — tidak perlu tombol manual di kasir.</small><div id="bdlist"></div><button class="pr" id="badd" style="margin-top:10px">+ Promo baru</button>`, 'w');
  const itemsTxt = (L) => L.map((i) => { const p = prod(i.id); return p ? p.n + ' ×' + i.q : ''; }).filter(Boolean).join(' + ');
  const draw = () => {
    $('#bdlist', m).innerHTML = (S.bundle || []).map((b) => {
      const discTxt = b.val > 0 ? (b.mode == 'pct' ? b.val + '%' : rp(b.val)) : '-', canDel = U.r == 'owner' || (b.st == 'pending' && b.by == U.n);
      return `<div class="cd" style="padding:10px;margin-top:8px"><div class="row" style="margin:0"><b>${esc(b.n)}</b><span class="chip ${b.st == 'ok' ? 'g' : 'o'}">${b.st == 'ok' ? '✅ Aktif' : '⏳ Menunggu persetujuan'}</span></div>
<small class="mu">Syarat: ${esc(itemsTxt(b.items)) || '-'}${b.bonus && b.bonus.length ? ' → bonus gratis: ' + esc(itemsTxt(b.bonus)) : ''}</small>
<div class="row" style="margin:4px 0"><small class="mu">Diskon: ${discTxt}${b.on === false ? ' · dimatikan' : ''}</small><small class="mu">oleh ${esc(b.by || '-')}</small></div>
<div class="wrap" style="margin-top:6px"><button class="gh" data-bedit="${b.id}">✏️ Edit</button>${b.st == 'pending' && U.r == 'owner' ? `<button class="gh a" data-bappr="${b.id}">✅ Setujui</button><button class="gh d" data-brej="${b.id}">❌ Tolak</button>` : ''}${canDel ? `<button class="gh d" data-bdel="${b.id}">🗑️ Hapus</button>` : ''}</div></div>`;
    }).join('') || '<p class="mu" style="margin-top:8px">Belum ada promo.</p>';
    $$('[data-bedit]', m).forEach((btn) => (btn.onclick = () => bundleEdit((S.bundle || []).find((x) => x.id == btn.dataset.bedit), draw)));
    $$('[data-bappr]', m).forEach((btn) => (btn.onclick = () => { emit('bdl', { op: 'approve', id: btn.dataset.bappr }); toast('Promo disetujui, langsung aktif'); draw(); }));
    $$('[data-brej]', m).forEach((btn) => (btn.onclick = () => { if (confirm('Tolak promo ini?')) { emit('bdl', { op: 'reject', id: btn.dataset.brej }); toast('Promo ditolak'); draw(); } }));
    $$('[data-bdel]', m).forEach((btn) => (btn.onclick = () => { if (confirm('Hapus promo ini?')) { emit('bdl', { op: 'del', id: btn.dataset.bdel }); toast('Promo dihapus'); draw(); } }));
  };
  draw();
  $('#badd', m).onclick = () => bundleEdit(null, draw);
}
function bundleEdit(b, onDone) {
  const L = actProds().sort((a, b2) => a.n.localeCompare(b2.n)); if (!L.length) return toast('Belum ada produk');
  const d = b ? JSON.parse(JSON.stringify(b)) : { id: '', n: '', items: [{ id: L[0].id, q: 1 }], bonus: [], mode: 'rp', val: 0, on: true };
  const mm = modal(`<h3>${b ? 'Edit' : 'Promo baru'}</h3><input id="bn" placeholder="Nama promo" value="${esc(d.n)}">
<b>Syarat pembelian (produk yang harus ada di keranjang)</b><div id="bitems"></div><button class="gh" id="biadd" style="margin-top:2px">+ Produk syarat</button>
<b style="display:block;margin-top:10px">Bonus barang gratis otomatis (opsional)</b><small class="mu">Ditambahkan otomatis ke keranjang saat syarat terpenuhi.</small><div id="bbonus"></div><button class="gh" id="bbadd" style="margin-top:2px">+ Barang bonus</button>
<b style="display:block;margin-top:10px">Diskon tambahan (opsional)</b><div class="fm2"><select id="bmode"><option value="rp" ${d.mode != 'pct' ? 'selected' : ''}>Potongan Rupiah</option><option value="pct" ${d.mode == 'pct' ? 'selected' : ''}>Potongan Persen (%)</option></select><input id="bval" type="number" min="0" placeholder="${d.mode == 'pct' ? 'Persen (%)' : 'Nilai (Rp)'}" value="${d.val || ''}"></div>
<label class="row" style="margin:8px 0 0"><span>Aktif</span><input type="checkbox" id="bon" ${d.on !== false ? 'checked' : ''}></label>
<button class="pr" style="margin-top:10px" id="bok">💾 Simpan</button>`, 'w');
  const rowH = (it, i, pfx) => `<div class="fm2" style="grid-template-columns:1fr 70px 30px;margin:4px 0"><select data-${pfx}i="${i}">${L.map((p) => `<option value="${p.id}" ${it.id == p.id ? 'selected' : ''}>${esc(p.n)} (${rp(p.pr)})</option>`).join('')}</select><input type="number" min="1" value="${it.q}" data-${pfx}q="${i}"><button class="gh d" data-${pfx}x="${i}">✕</button></div>`;
  const drawItems = () => { $('#bitems', mm).innerHTML = d.items.map((it, i) => rowH(it, i, 'i')).join(''); };
  const drawBonus = () => { $('#bbonus', mm).innerHTML = d.bonus.map((it, i) => rowH(it, i, 'b')).join('') || '<small class="mu">Tidak ada bonus barang.</small>'; };
  drawItems(); drawBonus();
  $('#biadd', mm).onclick = () => { d.items.push({ id: L[0].id, q: 1 }); drawItems(); };
  $('#bbadd', mm).onclick = () => { d.bonus.push({ id: L[0].id, q: 1 }); drawBonus(); };
  mm.addEventListener('change', (e) => {
    const ds = e.target.dataset;
    for (const [pfx, arr] of [['i', d.items], ['b', d.bonus]]) {
      if (ds[pfx + 'i'] != null) { const it = arr[+ds[pfx + 'i']]; if (it) it.id = e.target.value; }
      if (ds[pfx + 'q'] != null) { const it = arr[+ds[pfx + 'q']]; if (it) it.q = Math.max(1, num(e.target.value)); }
    }
  });
  mm.addEventListener('click', (e) => {
    const ds = e.target.dataset;
    if (ds.ix != null) { d.items.splice(+ds.ix, 1); drawItems(); }
    if (ds.bx != null) { d.bonus.splice(+ds.bx, 1); drawBonus(); }
  });
  $('#bok', mm).onclick = () => {
    const n = $('#bn', mm).value.trim(); if (!n) return toast('Isi nama promo'); if (!d.items.length) return toast('Isi minimal 1 produk syarat');
    emit('bdl', { op: 'set', bundle: { id: d.id, n, items: d.items, bonus: d.bonus, mode: $('#bmode', mm).value, val: num($('#bval', mm).value), on: $('#bon', mm).checked } });
    mm.close(); toast(U.r == 'owner' ? 'Promo disimpan & langsung aktif' : 'Promo diajukan — menunggu persetujuan pemilik'); if (onDone) onDone(); R();
  };
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
