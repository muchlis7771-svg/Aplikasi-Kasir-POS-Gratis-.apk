'use strict';
/* ============ HITUNG ORDER SALES: tempel teks WA / foto tulisan tangan → SKU × qty × harga (DBP/HPP) = total Rp ============
   Mesin baca ada di hordx.js. Halaman ini: pilih daftar harga (import Excel principal, atau HPP produk J-POS),
   baca orderan, periksa baris yang ditandai, lalu salin ke WA / Excel / simpan ke rekap per sales. */
const HO = { sel: '', rows: [], info: { sales: '', outlet: '', wrote: 0 }, imgs: [], txt: '', busy: '', open: {}, xk: '', X: null, synced: 0 };
const hordOk = () => !!U && !!S && (S.set || {}).biz != 'cafe' && ['owner', 'admin', 'akuntan', 'sales', 'kanvas', 'kasir'].includes(U.r);
const hoKey = (k) => 'jpos:' + k + ':' + SID;
const rp2 = (n) => 'Rp' + (+n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const hoLists = () => [...(LS.get(hoKey('pl'), []) || []), { id: '_prod', name: 'Produk J-POS (pakai HPP produk)', rows: null }];
function hoRowsOf(L) {
  if (!L) return [];
  if (L.id == '_prod') return (S.p || []).filter((p) => !p.x).map((p) => ({ c: p.sku || p.kd || '', n: p.n, p: +p.co || 0, isi: +p.isi || 0 }));
  return L.rows || [];
}
function hoCur() { const A = hoLists(); if (!HO.sel) HO.sel = LS.get(hoKey('plsel'), '') || (A[0] || {}).id; return A.find((x) => x.id == HO.sel) || A[0]; }
function hoIdx() {
  const L = hoCur(), k = L.id + ':' + (L.t || '') + ':' + (L.id == '_prod' ? (S.p || []).length + ':' + (S.seq || 0) : (L.rows || []).length);
  if (HO.xk != k) { HO.X = HOX.index(hoRowsOf(L)); HO.xk = k; }
  return HO.X;
}
async function hoSync(force) {
  if (!S.srv || !canNet() || (!force && Date.now() - HO.synced < 60000)) return;
  HO.synced = Date.now();
  try { const r = await api('/api/plist'); LS.set(hoKey('pl'), r.lists || []); HO.xk = ''; if (V == 'hord') R(); } catch (e) { }
}

VW.hord = () => {
  const A = hoLists(), L = hoCur(), X = hoIdx(), mgr = ['owner', 'admin'].includes(U.r);
  const zero = X.rows.filter((r) => !(r.p > 0)).length;
  const S0 = HOX.sum(HO.rows);
  const listCard = `<div class="cd"><h3>📋 Daftar harga</h3><select onchange="HO.sel=this.value;LS.set(hoKey('plsel'),this.value);HO.xk='';hoRecalc();R()">${A.map((x) => `<option value="${esc(x.id)}" ${x.id == L.id ? 'selected' : ''}>${esc(x.name)}${x.rows ? ' · ' + x.rows.length + ' SKU' : ''}</option>`).join('')}</select>
<small class="mu">${X.rows.length} SKU${L.t ? ' · diperbarui ' + tstr(L.t) + (L.u ? ' oleh ' + esc(L.u) : '') : ''}${zero ? ` · <b class="or">${zero} SKU harganya 0</b>` : ''}${L.id == '_prod' ? ' · harga = HPP (harga beli) produk' : ' · harga per pcs dari file principal'}</small>
<div class="wrap" style="margin-top:8px">${mgr ? '<label class="gh pri">⬆️ Import Excel daftar harga<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="hoImport(this)"></label>' : ''}<button class="gh" onclick="hoListView()">🔎 Lihat SKU & harga</button>${mgr && L.id != '_prod' ? '<button class="gh d" onclick="hoListDel()">Hapus daftar ini</button>' : ''}</div>
${mgr ? '<small class="mu">Format: kolom PRODUCT CODE / KODE, DESCRIPTION / NAMA, DBP+PPN / HPP / HARGA (opsional ISI per dus). Daftar dipakai bersama semua HP di toko.</small>' : ''}</div>`;
  const inCard = `<div class="cd"><h3>📝 Orderan sales</h3><div class="fm2"><input id="hos" placeholder="Nama sales" value="${esc(HO.info.sales)}" onchange="HO.info.sales=this.value"><input id="hoo" placeholder="Outlet / toko" value="${esc(HO.info.outlet)}" onchange="HO.info.outlet=this.value"></div>
<textarea id="hot" rows="6" placeholder="Tempel teks orderan dari WA di sini, satu SKU per baris. Contoh:&#10;G2G-35 2 pcs&#10;g2g 42 = 3&#10;Pomegranate niacinamide toner 2&#10;KD 05 1 lsn" style="width:100%;font-family:inherit">${esc(HO.txt)}</textarea>
<div class="wrap" style="margin-top:8px"><button class="gh pri" onclick="hoText()">🧮 Hitung teks</button><label class="gh">📷 Foto orderan<input type="file" accept="image/*" multiple hidden onchange="hoPhotos(this)"></label>${S.srv ? '<button class="gh" onclick="hoTextAI()" title="Untuk teks yang berantakan">🤖 Baca teks pakai AI</button>' : ''}${HO.rows.length ? '<button class="gh d" onclick="hoClear()">Mulai baru</button>' : ''}</div>
${HO.busy ? `<div class="info cd" style="padding:10px;margin-top:8px"><b>⏳ ${esc(HO.busy)}</b></div>` : ''}
<small class="mu">Foto: tulisan tangan atau screenshot, bisa beberapa foto sekaligus (dibaca AI, butuh internet). Teks dihitung langsung di HP. Semua baris yang tidak 100% jelas ditandai <b class="or">⚠ cek</b> — periksa sebelum dipakai.</small></div>`;
  if (!HO.rows.length) return listCard + inCard + hoRekap();
  const wrote = HO.info.wrote, diff = wrote ? Math.round(S0.tot) - Math.round(wrote) : 0;
  const hero = `<div class="cd hero"><small>Total orderan${HO.info.outlet ? ' · ' + esc(HO.info.outlet) : ''}${HO.info.sales ? ' · ' + esc(HO.info.sales) : ''}</small><h2>${rp(S0.tot)}</h2><small>${S0.per.length} SKU · ${fmtQ(S0.pcs)} pcs · ${S0.n} baris</small>
${S0.cek ? `<div class="row" style="margin:8px 0 0"><b class="or">⚠ ${S0.cek} baris perlu dicek</b><small>total belum final</small></div>` : '<div class="row" style="margin:8px 0 0"><b class="gr">✓ Semua baris sudah jelas</b></div>'}
${wrote ? `<div class="row" style="margin:6px 0 0"><span>Total tulisan sales</span><b class="${Math.abs(diff) <= 1 ? 'gr' : 'or'}">${rp(wrote)}${Math.abs(diff) <= 1 ? ' ✓ sama' : ' · selisih ' + rp(diff)}</b></div>` : ''}</div>`;
  const imgs = HO.imgs.length ? `<div class="cd"><h3>📷 Foto orderan</h3><small class="mu">Ketuk foto untuk memperbesar & bandingkan dengan hasil baca.</small><div class="wrap" style="margin-top:6px">${HO.imgs.map((d, i) => `<img src="${d}" alt="foto ${i + 1}" style="height:110px;border-radius:10px;cursor:zoom-in" onclick="hoZoom(${i})">`).join('')}</div></div>` : '';
  const opts = X.rows.map((r) => `<option value="${esc(r.c + ' · ' + r.n)}">${esc(rp2(r.p))}</option>`).join('');
  const rowsHtml = HO.rows.map((r, i) => {
    if (r.kind == 'del') return '';
    const st = r.conf == 'ok' ? '<b class="gr">✓</b>' : r.conf == 'cek' ? '<b class="or">⚠ cek</b>' : '<b class="rd">✕ tidak cocok</b>';
    const twins = (r.cands || []).filter((c) => !r.sku || c.c != r.sku.c);
    return `<div class="cd" style="padding:10px;margin:6px 0;border-left:4px solid ${r.conf == 'ok' ? '#00b894' : r.conf == 'cek' ? '#ff9f43' : '#ff5d73'}">
<div class="row" style="margin:0"><small class="mu">#${i + 1} · tulisan: <i>${esc(r.raw || '(ditambah manual)')}</i>${r.src == 'ai' ? ' · 📷' : ''}</small>${st}</div>
<input list="hodl" placeholder="Ketik kode / nama SKU" value="${esc(r.sku ? r.sku.c + ' · ' + r.sku.n : '')}" onchange="hoSetSku(${i},this.value)" style="margin-top:6px">
${r.why && r.why.length ? `<small class="${r.conf == 'ok' ? 'mu' : 'or'}">${r.why.map(esc).join(' · ')}</small>` : ''}
${twins.length && r.conf != 'ok' ? `<div class="wrap" style="margin-top:4px"><small class="mu">Pilihan:</small>${[r.sku, ...twins].filter(Boolean).slice(0, 7).map((c) => `<button class="gh ${r.sku && c.c == r.sku.c ? 'a' : ''}" style="font-size:12px" onclick="hoPick(${i},'${esc(c.c)}')">${esc(c.c)} · ${esc(c.n.slice(0, 38))} · ${rp2(c.p)}</button>`).join('')}</div>` : ''}
<div class="row" style="gap:6px;margin:6px 0 0;align-items:center"><input type="number" inputmode="decimal" min="0" step="any" value="${r.qty == null ? '' : r.qty}" placeholder="qty" style="width:80px" onchange="hoSetQty(${i},this.value)"><select style="width:90px" onchange="hoSetUnit(${i},this.value)">${['pcs', 'lsn', 'dus'].map((u) => `<option ${r.unit == u ? 'selected' : ''}>${u}</option>`).join('')}</select>
<small class="mu" style="flex:1">${r.sku ? `${r.mul && r.mul != 1 ? '= ' + fmtQ(HOX.pcs(r)) + ' pcs · ' : ''}× ${rp2(r.sku.p)}` : ''}</small><b>${r.sku ? rp(HOX.sub(r)) : '-'}</b></div>
<div class="wrap" style="margin-top:6px">${r.conf != 'ok' && r.sku && r.qty > 0 && r.mul ? `<button class="gh a" onclick="hoOk(${i})">✓ Sudah benar</button>` : ''}<button class="gh d" onclick="hoDel(${i})">Hapus baris</button></div></div>`;
  }).join('');
  const per = `<div class="cd"><div class="row" style="margin:0"><h3 style="margin:0">Rekap per SKU</h3><button class="gh" onclick="HO.open.per=!HO.open.per;R()">${HO.open.per ? 'Tutup' : 'Buka'}</button></div>${HO.open.per ? `<table class="tb"><tr><th>Kode</th><th>Nama</th><th>Pcs</th><th>Harga</th><th>Subtotal</th></tr>${S0.per.map((o) => `<tr><td>${esc(o.sku.c)}</td><td>${esc(o.sku.n)}</td><td>${fmtQ(o.pcs)}</td><td>${rp2(o.sku.p)}</td><td>${rp(o.rp)}</td></tr>`).join('')}<tr><th colspan="2">TOTAL</th><th>${fmtQ(S0.pcs)}</th><th></th><th>${rp(S0.tot)}</th></tr></table>` : ''}</div>`;
  const act = `<div class="cd"><div class="wrap"><button class="gh pri" onclick="hoShare()">📤 Kirim / salin ke WA</button><button class="gh" onclick="hoXlsx()">📊 Excel</button><button class="gh" onclick="hoSave()">💾 Simpan ke rekap</button><button class="gh" onclick="hoAdd()">＋ Tambah baris</button></div></div>`;
  return hero + act + imgs + `<datalist id="hodl">${opts}</datalist><div class="cd"><h3>Baris orderan</h3><small class="mu">Ubah SKU / qty kalau salah. Baris ⚠ cek dan ✕ wajib diperiksa.</small>${rowsHtml}</div>` + per + listCard + inCard + hoRekap();
};
VW.hord.after = () => { hoSync(); };
const fmtQ = (n) => (+n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

/* ---------- membaca ---------- */
function hoNeedList() { if (!hoIdx().rows.length) { toast('Daftar harga masih kosong. Import Excel daftar harga dulu.', 4000); return true; } return false; }
function hoText() {
  const t = ($('#hot') || {}).value || ''; HO.txt = t; HO.info.sales = ($('#hos') || {}).value || HO.info.sales; HO.info.outlet = ($('#hoo') || {}).value || HO.info.outlet;
  if (!t.trim()) return toast('Tempel teks orderan dulu'); if (hoNeedList()) return;
  const r = HOX.text(hoIdx(), t);
  HO.rows = r.lines.map((x) => ({ ...x, src: 'txt' })); HO.imgs = [];
  if (!HO.info.sales && r.info.sales) HO.info.sales = r.info.sales; if (!HO.info.outlet && r.info.outlet) HO.info.outlet = r.info.outlet; HO.info.wrote = r.info.wrote || 0;
  if (!HO.rows.length) toast('Tidak ada baris orderan yang terbaca'); R();
}
const hoCat = () => hoIdx().rows.map((r) => [r.c, r.n]);
async function hoAI(body, label) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 150000);
  try {
    const r = await fetch(AP + '/api/ord/read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TK() }, body: JSON.stringify({ ...body, cat: hoCat() }), signal: ctl.signal });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.e || 'Gagal membaca (' + r.status + ')');
    return j;
  } catch (e) { throw new Error(e.name == 'AbortError' ? label + ': waktu habis, coba lagi' : e.message); } finally { clearTimeout(tm); }
}
// gabungkan hasil AI dengan pembacaan lokal → status per baris (AI tidak pernah dipercaya buta)
function hoFromAI(j) {
  const X = hoIdx(), out = [];
  for (const l of j.lines || []) {
    const loc = HOX.line(X, l.raw), ai = l.code ? HOX.byCode(X, l.code) : null;
    const r = { raw: l.raw, kind: 'item', src: 'ai', sku: ai || loc.sku || null, qty: l.qty != null ? l.qty : loc.qty, unit: /lsn|lusin/.test(l.unit) ? 'lsn' : /dus|ctn|karton|box/.test(l.unit) ? 'dus' : 'pcs', why: [], cands: [] };
    if (!l.sure) r.why.push('AI ragu membaca tulisan ini — bandingkan dengan foto');
    if (l.code && !ai) r.why.push('Kode terbaca "' + l.code + '" tidak ada di daftar harga');
    if (ai && loc.sku && loc.sku !== ai && !loc.byName) r.why.push('Tulisan menyebut ' + loc.sku.c + ' tapi AI memilih ' + ai.c);
    if (loc.qty != null && l.qty != null && loc.qty != l.qty && !loc.why.length) r.why.push('Qty beda: tulisan ' + loc.qty + ', AI ' + l.qty);
    const alt = (l.alt || []).map((c) => HOX.byCode(X, c)).filter(Boolean);
    if (alt.filter((x) => x !== r.sku).length) r.why.push('AI menyebut kemungkinan lain: ' + alt.filter((x) => x !== r.sku).map((x) => x.c).join(', '));
    const twins = r.sku ? X.rows.filter((x) => x !== r.sku && x.tk.length == r.sku.tk.length && x.tk.every((t) => r.sku.tk.includes(t))) : [];
    const codeWritten = loc.sku && !loc.byName && !loc.tailGuess && loc.sku === r.sku;
    if (twins.length && !codeWritten) r.why.push('Nama ini dipakai ' + (twins.length + 1) + ' SKU (ukuran/kode beda) — pastikan pilihan benar');
    r.cands = [...new Set([r.sku, ...alt, ...twins, ...(loc.cands || [])].filter(Boolean))];
    r.conf = r.sku ? (r.why.length ? 'cek' : 'ok') : 'x';
    if (!r.sku) r.why.unshift('SKU tidak dikenali');
    hoFix(r); out.push(r);
  }
  return out;
}
function hoFix(r) { // satuan, harga 0, qty kosong → status
  if (!r.sku) { r.conf = 'x'; return r; }
  r.mul = r.unit == 'lsn' ? 12 : r.unit == 'dus' ? (r.sku.isi || null) : 1;
  r.why = (r.why || []).filter((w) => !/^(Qty tidak ditemukan|Qty 0|Satuan dus|Harga SKU ini 0)/.test(w));
  if (r.qty == null || r.qty === '') r.why.push('Qty tidak ditemukan');
  else if (!(r.qty > 0)) r.why.push('Qty 0');
  if (r.mul == null) r.why.push('Satuan dus — isi per dus belum ada di daftar harga, isi qty dalam pcs');
  if (!(r.sku.p > 0)) r.why.push('Harga SKU ini 0 di daftar harga');
  r.conf = r.why.length ? 'cek' : 'ok';
  return r;
}
async function hoTextAI() {
  const t = ($('#hot') || {}).value || ''; HO.txt = t; if (!t.trim()) return toast('Tempel teks orderan dulu'); if (hoNeedList()) return;
  if (!canNet()) return toast('Butuh internet');
  HO.busy = 'AI sedang membaca teks…'; R();
  try { const j = await hoAI({ text: t }, 'Baca teks'); HO.rows = hoFromAI(j); HO.imgs = []; hoInfo(j); } catch (e) { toast(e.message, 6000); }
  HO.busy = ''; R();
}
function hoInfo(j) { if (!HO.info.sales && j.sales) HO.info.sales = j.sales; if (!HO.info.outlet && j.outlet) HO.info.outlet = j.outlet; if (j.written_total) HO.info.wrote = (HO.info.wrote || 0) + j.written_total; }
const hoImg = (f) => new Promise((ok, no) => {
  const rd = new FileReader(); rd.onerror = no;
  rd.onload = () => { const im = new Image(); im.onerror = () => no(new Error('Foto tidak bisa dibuka')); im.onload = () => {
    const k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    let q = 0.88, d = c.toDataURL('image/jpeg', q); while (d.length > 4_000_000 && q > 0.4) { q -= 0.12; d = c.toDataURL('image/jpeg', q); } ok(d);
  }; im.src = rd.result; };
  rd.readAsDataURL(f);
});
async function hoPhotos(inp) {
  const F = [...(inp.files || [])].slice(0, 8); inp.value = ''; if (!F.length) return; if (hoNeedList()) return;
  if (!S.srv) return toast('Baca foto butuh toko online (server). Untuk sementara tempel orderan sebagai teks.', 5000);
  if (!canNet()) return toast('Baca foto butuh internet');
  HO.info.sales = ($('#hos') || {}).value || HO.info.sales; HO.info.outlet = ($('#hoo') || {}).value || HO.info.outlet;
  if (HO.rows.length && !confirm('Tambahkan hasil foto ke orderan yang sedang dibuka? (Batal = mulai orderan baru)')) { HO.rows = []; HO.imgs = []; HO.info.wrote = 0; }
  for (let i = 0; i < F.length; i++) {
    HO.busy = 'Membaca foto ' + (i + 1) + ' dari ' + F.length + '… (±10–30 detik per foto)'; R();
    try { const d = await hoImg(F[i]); const j = await hoAI({ image: d }, 'Foto ' + (i + 1)); HO.imgs.push(d); HO.rows.push(...hoFromAI(j)); hoInfo(j); if (!(j.lines || []).length) toast('Foto ' + (i + 1) + ': tidak ada baris orderan terbaca', 5000); }
    catch (e) { toast('Foto ' + (i + 1) + ': ' + e.message, 6000); }
  }
  HO.busy = ''; R();
}
function hoZoom(i) { const m = modal(`<img src="${HO.imgs[i]}" style="width:100%;border-radius:8px"><div class="wrap" style="margin-top:8px"><button class="gh" id="zx">Tutup</button></div>`); $('#zx', m).onclick = () => m.close(); }
function hoRecalc() { // daftar harga diganti → cocokkan ulang SKU baris ke daftar baru (berdasar kode)
  const X = hoIdx(); HO.rows.forEach((r) => { if (r.kind == 'del' || !r.sku) return; const n = HOX.byCode(X, r.sku.c); if (n) r.sku = n; else { r.sku = null; r.why = ['Kode tidak ada di daftar harga ini']; } hoFix(r); if (!r.sku) r.conf = 'x'; });
}

/* ---------- koreksi manual ---------- */
function hoSetSku(i, v) {
  const r = HO.rows[i], X = hoIdx(), code = String(v).split(' · ')[0].trim();
  let s = HOX.byCode(X, code) || X.rows.find((x) => (x.c + ' · ' + x.n) == v);
  if (!s && v.trim()) { const t = HOX.line(X, v + ' 1'); if (t.sku && t.conf == 'ok') s = t.sku; }
  if (!s) { toast('SKU tidak ditemukan di daftar harga'); return R(); }
  r.sku = s; r.why = []; r.cands = []; r.conf = 'ok'; r.man = 1; hoFix(r); R();
}
function hoPick(i, c) { const r = HO.rows[i], s = HOX.byCode(hoIdx(), c); if (!s) return; r.sku = s; r.why = []; r.conf = 'ok'; r.man = 1; hoFix(r); R(); }
function hoSetQty(i, v) { const r = HO.rows[i]; r.qty = v === '' ? null : +String(v).replace(',', '.'); r.why = (r.why || []).filter((w) => !/qty|angka/i.test(w)); hoFix(r); R(); }
function hoSetUnit(i, u) { const r = HO.rows[i]; r.unit = u; hoFix(r); R(); }
function hoOk(i) { const r = HO.rows[i]; r.why = []; r.conf = 'ok'; r.man = 1; hoFix(r); R(); }
function hoDel(i) { HO.rows[i].kind = 'del'; R(); }
function hoAdd() { HO.rows.push({ raw: '', kind: 'item', sku: null, qty: 1, unit: 'pcs', mul: 1, conf: 'x', why: ['Pilih SKU'], cands: [], src: 'man' }); R(); }
function hoClear() { HO.rows = []; HO.imgs = []; HO.txt = ''; HO.info = { sales: '', outlet: '', wrote: 0 }; R(); }

/* ---------- hasil ---------- */
const hoLive = () => HO.rows.filter((r) => r.kind != 'del' && r.sku);
function hoWaText() {
  const S0 = HOX.sum(HO.rows), L = hoLive();
  const t = [`*ORDER${HO.info.outlet ? ' ' + HO.info.outlet.toUpperCase() : ''}*`, (HO.info.sales ? 'Sales: ' + HO.info.sales + ' · ' : '') + dstr(Date.now()), ''];
  L.forEach((r, i) => t.push(`${i + 1}. ${r.sku.c} ${r.sku.n}\n    ${fmtQ(r.qty)} ${r.unit}${r.mul != 1 ? ' (' + fmtQ(HOX.pcs(r)) + ' pcs)' : ''} × ${rp2(r.sku.p)} = ${rp(HOX.sub(r))}`));
  t.push('', `*TOTAL: ${rp(S0.tot)}*`, `${S0.per.length} SKU · ${fmtQ(S0.pcs)} pcs`, `Harga: ${hoCur().name}`);
  return t.join('\n');
}
function hoShare() {
  const S0 = HOX.sum(HO.rows); if (!S0.n) return toast('Belum ada baris');
  if (S0.cek && !confirm(S0.cek + ' baris masih perlu dicek, total bisa belum benar. Tetap kirim?')) return;
  shareText('Order ' + (HO.info.outlet || ''), hoWaText());
}
function hoXlsx() {
  if (!window.XLSX) return toast('Excel belum termuat');
  const S0 = HOX.sum(HO.rows), L = hoLive(), wb = XLSX.utils.book_new();
  const a = [['Outlet', HO.info.outlet || ''], ['Sales', HO.info.sales || ''], ['Tanggal', tstr(Date.now())], ['Daftar harga', hoCur().name], [], ['No', 'Kode', 'Nama SKU', 'Qty', 'Satuan', 'Qty (pcs)', 'Harga/pcs', 'Subtotal', 'Status', 'Tulisan asli']];
  L.forEach((r, i) => a.push([i + 1, r.sku.c, r.sku.n, r.qty, r.unit, HOX.pcs(r), r.sku.p, Math.round(HOX.sub(r) * 100) / 100, r.conf == 'ok' ? 'OK' : 'CEK: ' + (r.why || []).join('; '), r.raw]));
  a.push([], ['', '', 'TOTAL', '', '', S0.pcs, '', Math.round(S0.tot)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Order');
  const b = [['Kode', 'Nama SKU', 'Qty (pcs)', 'Harga/pcs', 'Subtotal']]; S0.per.forEach((o) => b.push([o.sku.c, o.sku.n, o.pcs, o.sku.p, Math.round(o.rp * 100) / 100])); b.push(['', 'TOTAL', S0.pcs, '', Math.round(S0.tot)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), 'Per SKU');
  saveFile('order-' + FNAME(HO.info.outlet || HO.info.sales || 'sales') + '-' + dkey(Date.now()) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
}
function hoSave() {
  const S0 = HOX.sum(HO.rows); if (!S0.n) return toast('Belum ada baris');
  if (S0.cek && !confirm(S0.cek + ' baris masih perlu dicek. Tetap simpan?')) return;
  const H = LS.get(hoKey('hord'), []) || [];
  H.unshift({ t: Date.now(), by: U.n, sales: HO.info.sales || '', outlet: HO.info.outlet || '', tot: Math.round(S0.tot), pcs: S0.pcs, n: S0.per.length, cek: S0.cek, list: hoCur().name, rows: hoLive().map((r) => ({ raw: r.raw, c: r.sku.c, n: r.sku.n, p: r.sku.p, isi: r.sku.isi || 0, qty: r.qty, unit: r.unit, conf: r.conf, why: r.why })) });
  LS.set(hoKey('hord'), H.slice(0, 200)); toast('Tersimpan ke rekap'); R();
}
function hoRekap() {
  const H = LS.get(hoKey('hord'), []) || []; if (!H.length) return '';
  const td = dkey(Date.now()), today = H.filter((h) => dkey(h.t) == td), by = {};
  today.forEach((h) => { const k = h.sales || '(tanpa nama)'; const o = by[k] || (by[k] = { n: 0, tot: 0, pcs: 0 }); o.n++; o.tot += h.tot; o.pcs += h.pcs; });
  return `<div class="cd"><h3>📊 Rekap orderan tersimpan</h3>${today.length ? `<small class="mu">Hari ini per sales</small><table class="tb"><tr><th>Sales</th><th>Order</th><th>Pcs</th><th>Total</th></tr>${Object.entries(by).map(([k, o]) => `<tr><td>${esc(k)}</td><td>${o.n}</td><td>${fmtQ(o.pcs)}</td><td>${rp(o.tot)}</td></tr>`).join('')}<tr><th>TOTAL</th><th>${today.length}</th><th>${fmtQ(today.reduce((a, h) => a + h.pcs, 0))}</th><th>${rp(today.reduce((a, h) => a + h.tot, 0))}</th></tr></table>` : '<small class="mu">Belum ada orderan tersimpan hari ini.</small>'}
${H.slice(0, 30).map((h, i) => `<div class="row"><span><b>${esc(h.outlet || '-')}</b> <small class="mu">${esc(h.sales || '')} · ${tstr(h.t)}${h.cek ? ' · <b class="or">' + h.cek + ' cek</b>' : ''}</small></span><span><b>${rp(h.tot)}</b> <button class="gh" onclick="hoOpenH(${i})">Buka</button></span></div>`).join('')}
<div class="wrap" style="margin-top:6px"><button class="gh" onclick="hoRekapXlsx()">📊 Excel rekap</button><button class="gh d" onclick="if(confirm('Hapus semua rekap orderan di HP ini?')){LS.del(hoKey('hord'));R()}">Hapus rekap</button></div></div>`;
}
function hoOpenH(i) {
  const h = (LS.get(hoKey('hord'), []) || [])[i]; if (!h) return;
  const X = hoIdx();
  HO.rows = h.rows.map((x) => { const sku = HOX.byCode(X, x.c) || { c: x.c, n: x.n, p: x.p, isi: x.isi, tk: HOX.toks(x.n) }; return hoFix({ raw: x.raw, kind: 'item', src: 'his', sku, qty: x.qty, unit: x.unit, conf: x.conf, why: x.why || [], cands: [] }); });
  HO.info = { sales: h.sales, outlet: h.outlet, wrote: 0 }; HO.imgs = []; R(); window.scrollTo(0, 0);
}
function hoRekapXlsx() {
  const H = LS.get(hoKey('hord'), []) || []; if (!H.length || !window.XLSX) return;
  const a = [['Tanggal', 'Sales', 'Outlet', 'Kode', 'Nama SKU', 'Qty', 'Satuan', 'Harga/pcs', 'Subtotal', 'Status']];
  H.forEach((h) => h.rows.forEach((r) => { const mul = r.unit == 'lsn' ? 12 : r.unit == 'dus' ? r.isi || 0 : 1; a.push([tstr(h.t), h.sales, h.outlet, r.c, r.n, r.qty, r.unit, r.p, Math.round(r.qty * mul * r.p * 100) / 100, r.conf == 'ok' ? 'OK' : 'CEK']); }));
  const b = [['Tanggal', 'Sales', 'Outlet', 'Jumlah SKU', 'Pcs', 'Total']]; H.forEach((h) => b.push([tstr(h.t), h.sales, h.outlet, h.n, h.pcs, h.tot]));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), 'Per order'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Detail SKU');
  saveFile('rekap-order-sales-' + dkey(Date.now()) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
}

/* ---------- daftar harga ---------- */
async function hoImport(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  if (!window.XLSX) return toast('Excel belum termuat');
  let best = null;
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    for (const n of wb.SheetNames) { const r = HOX.sheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' })); if (r.rows.length && (!best || r.rows.length > best.rows.length)) best = { ...r, sheet: n }; }
  } catch (e) { return toast('File tidak bisa dibaca: ' + e.message, 5000); }
  if (!best) return toast('Kolom KODE dan HARGA tidak ditemukan di file. Pastikan ada judul kolom seperti PRODUCT CODE, DESCRIPTION, DBP+PPN.', 7000);
  const z = best.rows.filter((r) => !(r.p > 0)), noc = best.rows.filter((r) => !r.c);
  const ex = hoLists().find((x) => x.id != '_prod' && x.name.toLowerCase() == f.name.replace(/\.[^.]+$/, '').toLowerCase());
  const m = modal(`<h3>Import daftar harga</h3><small class="mu">${esc(f.name)} · sheet ${esc(best.sheet)}</small>
${row('SKU terbaca', best.rows.length)}${row('Harga 0 / kosong', z.length)}${row('Tanpa kode', noc.length)}${best.dup.length ? row('Kode dobel', best.dup.length + ' (' + best.dup.slice(0, 5).join(', ') + ')') : ''}${row('Kolom isi/dus', best.cols.isi >= 0 ? 'ada' : 'tidak ada (satuan dus perlu diisi pcs manual)')}
<table class="tb"><tr><th>Kode</th><th>Nama</th><th>Harga/pcs</th></tr>${best.rows.slice(0, 6).map((r) => `<tr><td>${esc(r.c)}</td><td>${esc(r.n)}</td><td>${rp2(r.p)}</td></tr>`).join('')}</table>
<small class="mu">Periksa 6 baris contoh di atas: kode, nama & harga harus sesuai file.</small>
<input id="pln" placeholder="Nama daftar harga" value="${esc(ex ? ex.name : f.name.replace(/\.[^.]+$/, ''))}">${ex ? '<small class="or">Nama sama dengan daftar yang sudah ada → daftar lama akan DIGANTI dengan file ini.</small>' : ''}
<div class="wrap"><button class="gh pri" id="pls">Simpan daftar harga</button><button class="gh" id="plc">Batal</button></div>`);
  $('#plc', m).onclick = () => m.close();
  $('#pls', m).onclick = () => busy($('#pls', m), async () => {
    const name = $('#pln', m).value.trim() || 'Daftar harga', id = ex ? ex.id : 'pl' + Date.now().toString(36);
    const L = { id, name, rows: best.rows, t: Date.now(), u: U.n };
    if (S.srv) { if (!canNet()) throw new Error('Butuh internet untuk menyimpan ke server'); await post('/api/plist', { id, name, rows: best.rows }); }
    const A = (LS.get(hoKey('pl'), []) || []).filter((x) => x.id != id); A.unshift(L); LS.set(hoKey('pl'), A);
    HO.sel = id; LS.set(hoKey('plsel'), id); HO.xk = ''; hoRecalc(); m.close(); toast('Daftar harga tersimpan: ' + best.rows.length + ' SKU'); R();
  });
}
async function hoListDel() {
  const L = hoCur(); if (L.id == '_prod' || !confirm('Hapus daftar harga "' + L.name + '"?')) return;
  try { if (S.srv) await api('/api/plist?id=' + encodeURIComponent(L.id), { method: 'DELETE' }); } catch (e) { return toast(e.message); }
  LS.set(hoKey('pl'), (LS.get(hoKey('pl'), []) || []).filter((x) => x.id != L.id)); HO.sel = ''; LS.del(hoKey('plsel')); HO.xk = ''; R();
}
function hoListView() {
  const X = hoIdx();
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">${esc(hoCur().name)}</h3><button class="gh" id="lx">✕</button></div><input id="lq" placeholder="Cari kode / nama"><div id="ll"></div>`);
  const draw = () => { const q = $('#lq', m).value.toUpperCase(); $('#ll', m).innerHTML = `<table class="tb"><tr><th>Kode</th><th>Nama</th><th>Harga/pcs</th></tr>${X.rows.filter((r) => !q || (r.c + ' ' + r.n).toUpperCase().includes(q)).slice(0, 300).map((r) => `<tr><td>${esc(r.c)}</td><td>${esc(r.n)}${r.isi ? ' <small class="mu">(isi ' + r.isi + '/dus)</small>' : ''}</td><td class="${r.p > 0 ? '' : 'rd'}">${rp2(r.p)}</td></tr>`).join('')}</table>`; };
  $('#lq', m).oninput = draw; $('#lx', m).onclick = () => m.close(); draw();
}

/* ---------- lupa PIN pemilik (layar masuk) & email pemulihan (menu akun) ---------- */
function forgotPin() {
  const id0 = (($('#lid') || {}).value || (LS.get('jpos:last', null) || {}).id || '').trim().toLowerCase();
  const m = modal(`<h3>🔐 Lupa PIN pemilik</h3><small class="mu">Kode reset dikirim ke <b>email pemilik</b> yang didaftarkan untuk toko ini. Karyawan yang lupa PIN: minta pemilik / admin mengganti PIN di menu Pengguna.</small>
<div class="fm"><input id="fpi" placeholder="Kode toko" autocapitalize="none" value="${esc(id0)}"><button class="pr" id="fps">📧 Kirim kode ke email</button>
<div id="fp2" style="display:none"><small class="mu" id="fpt"></small><input id="fpc" inputmode="numeric" maxlength="6" placeholder="6 angka kode dari email" autocomplete="one-time-code"><input id="fpn" type="password" inputmode="numeric" maxlength="8" placeholder="PIN baru (4–8 angka)" autocomplete="new-password"><input id="fpn2" type="password" inputmode="numeric" maxlength="8" placeholder="Ulangi PIN baru" autocomplete="new-password"><button class="pr" id="fpr">Simpan PIN baru</button></div>
<button class="gh" id="fpx">Tutup</button></div>`);
  $('#fpx', m).onclick = () => m.close();
  $('#fps', m).onclick = () => busy($('#fps', m), async () => {
    const id = $('#fpi', m).value.trim().toLowerCase(); if (!id) throw new Error('Isi kode toko');
    const r = await post('/api/pin/forgot', { id }, '');
    $('#fp2', m).style.display = ''; $('#fpt', m).innerHTML = `Kode dikirim ke <b>${esc(r.to)}</b> (pemilik: ${esc(r.name)}). Cek juga folder Spam. Kode berlaku 15 menit.`; $('#fps', m).textContent = 'Kirim ulang kode'; m.dataset.owner = r.name || '';
  });
  $('#fpr', m).onclick = () => busy($('#fpr', m), async () => {
    const id = $('#fpi', m).value.trim().toLowerCase(), c = $('#fpc', m).value.trim(), p1 = $('#fpn', m).value, p2 = $('#fpn2', m).value;
    if (!/^\d{6}$/.test(c)) throw new Error('Kode 6 angka dari email'); if (!/^\d{4,8}$/.test(p1)) throw new Error('PIN baru 4–8 angka'); if (p1 != p2) throw new Error('Ulangan PIN tidak sama');
    const r = await post('/api/pin/reset', { id, code: c, pin: p1 }, '');
    m.close(); toast('PIN pemilik berhasil diganti. Silakan masuk dengan PIN baru.', 6000);
    if ($('#lid')) { $('#lid').value = id; if ($('#lnm')) { $('#lnm').removeAttribute('readonly'); $('#lnm').value = r.name || ''; } if ($('#lpn')) $('#lpn').value = ''; }
  });
}
async function emailSet() {
  if (!S.srv || !canNet()) return toast('Butuh internet');
  let cur = ''; try { cur = (await api('/api/me/email')).email || ''; } catch (e) { return toast(e.message); }
  const m = modal(`<h3>📧 Email pemulihan PIN</h3><small class="mu">Dipakai untuk <b>Lupa PIN</b> di layar masuk: kode reset dikirim ke email ini. Saat ini: <b>${esc(cur || 'belum diisi')}</b></small><div class="fm"><input id="emv" type="email" placeholder="email@contoh.com" value="${esc(cur)}"><input id="emp" type="password" inputmode="numeric" maxlength="8" placeholder="PIN Anda (konfirmasi)" autocomplete="current-password"><button class="pr" id="ems">Simpan</button><button class="gh" id="emx">Batal</button></div>`);
  $('#emx', m).onclick = () => m.close();
  $('#ems', m).onclick = () => busy($('#ems', m), async () => { const r = await post('/api/me/email', { email: $('#emv', m).value.trim(), pin: $('#emp', m).value }); S.email = r.email; m.close(); toast('Email pemulihan tersimpan: ' + r.email); });
}
