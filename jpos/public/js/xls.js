'use strict';
/* ============ IMPORT / EXPORT EXCEL: outlet (lengkap dengan GPS) & stok ============ */
const hn = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const xlsOk = () => { if (!window.XLSX) { toast('Pustaka Excel belum termuat'); return false; } return true; };
const xlsSave = (wb, name) => saveFile(name + '-' + FNAME(S.name) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
function xlsSheet(rows, widths) { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = (widths || rows[0].map(() => 16)).map((w) => ({ wch: w })); return ws; }
function readXls(file) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => { try { const wb = XLSX.read(new Uint8Array(r.result), { type: 'array' }); ok(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true })); } catch (e) { no(new Error('File tidak bisa dibaca. Pakai .xlsx / .xls / .csv')); } };
    r.onerror = () => no(new Error('Gagal membaca file')); r.readAsArrayBuffer(file);
  });
}
function colMap(rows, defs) { // cari baris judul + petakan kolom dengan sinonim
  let hi = 0, best = -1;
  const hs = (c) => [hn(c), hn(String(c).replace(/\(.*?\)/g, ''))];
  rows.slice(0, 15).forEach((r, i) => { const sc = r.filter((c) => Object.values(defs).some((syn) => hs(c).some((h) => syn.includes(h)))).length; if (sc > best) { best = sc; hi = i; } });
  const map = {}; rows[hi].forEach((c, i) => { for (const k in defs) if (hs(c).some((h) => defs[k].includes(h)) && map[k] == null) map[k] = i; });
  return { hi, map };
}
const cell = (r, m, k) => (m[k] == null ? '' : r[m[k]]);
const sval = (v) => (v == null ? '' : String(v).trim());
const dec = (v) => { if (typeof v == 'number') return v; let s = String(v ?? '').trim(); if (!s) return NaN; if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.'); return parseFloat(s); };
function parseLL(v) { // "-5.14,119.43" | link google maps | angka terpisah
  const s = String(v ?? ''); const m = s.match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/) || s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? [dec(m[1]), dec(m[2])] : null;
}
const llOk = (la, ln) => Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && !(la == 0 && ln == 0);
const normN = (s) => hn(s).replace(/^(toko|warung|kios|ud|cv|pt)\s+/, '');

/* ---------------- OUTLET ---------------- */
const OCOL = {
  id: ['id', 'id outlet', 'id sistem'], kd: ['kode outlet', 'kd outlet', 'kode', 'kd'], n: ['nama', 'nama outlet', 'nama toko', 'outlet', 'toko', 'pelanggan', 'nama pelanggan'], ad: ['alamat', 'address'],
  ph: ['telepon', 'telp', 'hp', 'wa', 'no hp', 'no telepon', 'no wa', 'phone', 'whatsapp'], sl: ['sales', 'salesman', 'sales penanggung jawab', 'penanggung jawab'],
  term: ['tipe', 'pembayaran', 'tipe bayar', 'jenis', 'term', 'tunai kredit', 'kredit tunai'], lim: ['limit', 'limit kredit', 'plafon', 'plafon kredit'], tempo: ['tempo', 'tempo hari', 'jatuh tempo', 'tempo bayar'],
  lat: ['latitude', 'lat', 'lintang'], lng: ['longitude', 'lng', 'long', 'lon', 'bujur'], ll: ['koordinat', 'gps', 'lokasi', 'lat lng', 'maps', 'link maps', 'google maps', 'titik'], note: ['catatan', 'keterangan', 'note', 'notes'],
};
function xlsOutletExport() {
  if (!xlsOk()) return;
  const H = ['ID', 'Kode Outlet', 'Nama Outlet', 'Alamat', 'Telepon', 'Sales', 'Tipe (Tunai/Kredit)', 'Limit Kredit', 'Tempo (hari)', 'Latitude', 'Longitude', 'Link Google Maps', 'Catatan', 'Piutang Berjalan', 'Jatuh Tempo'];
  const rows = [H, ...S.c.filter((c) => !c.x).map((c) => [c.id, c.kd || '', c.n, c.ad || '', c.ph || '', c.sl || '', c.term == 'kredit' ? 'Kredit' : 'Tunai', c.lim || 0, c.tempo || S.set.tempo || 30, c.lat ?? '', c.lng ?? '', c.lat != null ? mapsUrl(c).replace('dir/?api=1&destination=', 'search/?api=1&query=') : '', c.note || '', outOf(c.id), overdue(c.id)])];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, xlsSheet(rows, [14, 12, 28, 34, 15, 14, 12, 12, 10, 12, 12, 34, 26, 14, 14]), 'Outlet'); xlsSave(wb, 'outlet'); toast(rows.length - 1 + ' outlet diekspor');
}
function xlsOutletTemplate() {
  if (!xlsOk()) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, xlsSheet([['Kode Outlet', 'Nama Outlet', 'Alamat', 'Telepon', 'Sales', 'Tipe (Tunai/Kredit)', 'Limit Kredit', 'Tempo (hari)', 'Latitude', 'Longitude', 'Catatan'], ['', 'Toko Berkah Jaya', 'Jl. Contoh No. 12, Makassar', '081234567890', 'Andi', 'Kredit', 5000000, 14, -5.1477, 119.4327, 'Buka jam 7 pagi'], ['', 'Warung Bu Sari', 'Jl. Mawar 3', '085211112222', '', 'Tunai', '', '', -5.1520, 119.4410, '']], [14, 28, 34, 15, 14, 18, 12, 10, 12, 12, 26]), 'Outlet');
  XLSX.utils.book_append_sheet(wb, xlsSheet([['PETUNJUK'], ['• Kolom wajib: Nama Outlet. Kolom lain boleh kosong (sel kosong TIDAK menghapus data lama).'], ['• Kode Outlet: kosongkan untuk outlet baru (dibuat otomatis OT-0001, OT-0002, …). Isi kode yang sudah ada untuk memperbarui outlet itu.'], ['• GPS: isi Latitude & Longitude (contoh -5.1477 dan 119.4327), ATAU satu kolom "Koordinat" berisi "-5.1477, 119.4327" / link Google Maps.'], ['• Tipe Tunai/Kredit, Limit, Tempo hanya berlaku bila diimpor oleh Pemilik (Owner).'], ['• Sales penanggung jawab hanya bisa diatur Owner/Admin.'], ['• Koordinat outlet yang sudah punya titik hanya bisa diubah Owner/Admin.']], [110]), 'Petunjuk');
  xlsSave(wb, 'template-outlet');
}
async function xlsOutletImport(el) {
  const f = el.files[0]; el.value = ''; if (!f || !xlsOk()) return;
  let rows; try { rows = await readXls(f); } catch (e) { return toast(e.message); }
  const { hi, map } = colMap(rows, OCOL); if (map.n == null) return toast('Kolom "Nama Outlet" tidak ditemukan. Unduh template untuk contoh format.');
  const boss = U.r == 'owner', mgr = MGR(U.r), plan = [], errs = [], seen = new Set(); let ign = 0;
  rows.slice(hi + 1, hi + 1501).forEach((r, i) => {
    const line = hi + i + 2, n = sval(cell(r, map, 'n')); if (!n && r.every((x) => x === '')) return; if (!n) return errs.push('Baris ' + line + ': nama kosong');
    const id = sval(cell(r, map, 'id')), ph = sval(cell(r, map, 'ph')).replace(/[^\d+]/g, '');
    const kd = sval(cell(r, map, 'kd')).toUpperCase(); let ex = id ? S.c.find((c) => !c.x && c.id == id) : null; if (!ex && kd) ex = S.c.find((c) => !c.x && String(c.kd || '').toUpperCase() == kd);
    if (!ex) ex = S.c.find((c) => !c.x && normN(c.n) == normN(n) && (!ph || !c.ph || String(c.ph).replace(/[^\d+]/g, '') == ph));
    const key = normN(n) + '|' + ph; if (seen.has(key)) return errs.push('Baris ' + line + ': ' + n + ' dobel di file'); seen.add(key);
    const d = { id: ex ? ex.id : 'c' + uid() }; if (!ex && kd) d.kd = kd;
    if (!ex || n != ex.n) d.n = n;
    for (const k of ['ad', 'note']) { const v = sval(cell(r, map, k)); if (v) d[k] = v; }
    if (ph) d.ph = sval(cell(r, map, 'ph'));
    let la = dec(cell(r, map, 'lat')), ln = dec(cell(r, map, 'lng'));
    if (!llOk(la, ln)) { const g = parseLL(map.ll != null ? cell(r, map, 'll') : ''); if (g) { la = g[0]; ln = g[1]; } }
    if (llOk(la, ln)) { if (ex && ex.lat != null && !mgr) ign++; else { d.lat = +la.toFixed(6); d.lng = +ln.toFixed(6); } }
    else if ((cell(r, map, 'lat') !== '' || cell(r, map, 'lng') !== '') || (map.ll != null && sval(cell(r, map, 'll')))) errs.push('Baris ' + line + ' (' + n + '): koordinat tidak terbaca — diimpor tanpa GPS');
    const sl = sval(cell(r, map, 'sl')); if (sl) { if (mgr) d.sl = sl; else ign++; }
    const tp = sval(cell(r, map, 'term')); if (tp || cell(r, map, 'lim') !== '' || cell(r, map, 'tempo') !== '') {
      if (!boss) ign++; else { if (/kredit|credit|tempo/i.test(tp)) d.term = 'kredit'; else if (/tunai|cash/i.test(tp)) d.term = 'cash'; const lm = dec(cell(r, map, 'lim')), tm = dec(cell(r, map, 'tempo')); if (Number.isFinite(lm)) d.lim = Math.max(0, Math.round(lm)); if (Number.isFinite(tm)) d.tempo = Math.max(1, Math.round(tm)); }
    }
    plan.push({ d, nw: !ex, n, gps: d.lat != null || (ex && ex.lat != null) });
  });
  if (!plan.length) return toast(errs[0] || 'Tidak ada baris valid');
  const nw = plan.filter((p) => p.nw).length, up = plan.length - nw, g = plan.filter((p) => p.gps).length;
  const m = modal(`<h3>Pratinjau impor outlet</h3>${row('Baru', '<b class="gr">' + nw + '</b>')}${row('Diperbarui', '<b>' + up + '</b>')}${row('Punya titik GPS', g + ' dari ' + plan.length)}${ign ? row('Kolom diabaikan (tanpa izin)', '<b class="or">' + ign + '</b>') : ''}${errs.length ? `<div class="warnbox">⚠ ${errs.length} catatan:<br>${errs.slice(0, 6).map(esc).join('<br>')}${errs.length > 6 ? '<br>…' : ''}</div>` : ''}<div class="ov" style="max-height:30vh"><table>${plan.slice(0, 8).map((p) => `<tr><td>${esc(p.n)}<td>${p.nw ? '<span class="chip g">baru</span>' : '<span class="chip">update</span>'}<td>${p.gps ? '📍' : ''}</tr>`).join('')}</table></div><button class="pr" id="ok">Impor ${plan.length} outlet</button><button class="gh" id="x">Batal</button>`);
  $('#x', m).onclick = () => m.close();
  $('#ok', m).onclick = () => { for (const p of plan) emit('cu', { c: p.d }); m.close(); R(); toast(nw + ' outlet baru, ' + up + ' diperbarui'); };
}

/* ---------------- STOK / PRODUK ---------------- */
const PCOL2 = {
  id: ['id', 'id produk', 'id sistem'], kd: ['kode item', 'kd item', 'kode', 'kd'], sku: ['sku', 'barcode', 'kode barang', 'kode produk'], n: ['nama', 'nama produk', 'produk', 'nama barang', 'barang'], c: ['kategori', 'category', 'jenis'], u: ['satuan', 'unit'],
  pr: ['harga jual', 'harga', 'harga satuan', 'price'], opr: ['harga online', 'harga toko online'], co: ['hpp', 'harga beli', 'harga pokok', 'modal', 'cost'], st: ['stok', 'stock', 'stok awal', 'stok fisik', 'stok sistem'],
  add: ['tambah stok', 'stok masuk', 'qty masuk', 'jumlah masuk', 'restok'], min: ['stok minimum', 'min', 'minimum', 'stok min'], tier: ['grosir', 'harga grosir', 'diskon grosir'], sup: ['supplier', 'pemasok'], pay: ['pembayaran', 'bayar', 'cara bayar'], tempo: ['tempo', 'tempo hari', 'tempo bayar'],
};
function parseTiers(v) { return String(v || '').split(/[;|\n]/).map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/(\d+)\s*[:=x>]+\s*([\d.,+]+)\s*%?/); return m ? { min: +m[1], d: m[2].replace(',', '.') } : null; }).filter((t) => t && t.min >= 2); }
function xlsStockExport() {
  if (!xlsOk()) return;
  const rows = [['ID', 'Kode Item', 'SKU', 'Nama Produk', 'Kategori', 'Satuan', 'Harga Jual', 'Harga Online', 'HPP', 'Stok', 'Stok Minimum', 'Nilai Stok (HPP)', 'Grosir (min:diskon%)', 'Tampil Online'],
    ...actProds().map((p) => [p.id, p.kd || '', p.sku || '', p.n, p.c, p.u || '', p.pr, p.opr || '', p.co, p.st, p.min ?? 10, Math.max(0, p.st) * p.co, (p.tiers || []).map((t) => t.min + ':' + t.d).join('; '), p.on ? 'Ya' : ''])];
  rows.push(['', '', '', 'TOTAL', '', '', '', '', '', actProds().reduce((a, p) => a + p.st, 0), '', stockValue(), '', '']);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, xlsSheet(rows, [12, 12, 16, 30, 14, 8, 12, 12, 12, 8, 10, 16, 20, 10]), 'Stok'); xlsSave(wb, 'stok'); toast(actProds().length + ' produk diekspor');
}
function xlsStockTemplate(mode) {
  if (!xlsOk()) return; const wb = XLSX.utils.book_new();
  if (mode == 'opname') XLSX.utils.book_append_sheet(wb, xlsSheet([['SKU', 'Nama Produk', 'Stok (hitungan fisik)'], ['8991234500011', 'Beras Premium 5kg', 98], ['8991234500028', 'Minyak Goreng 2L', 60]], [18, 30, 20]), 'Opname');
  else if (mode == 'masuk') XLSX.utils.book_append_sheet(wb, xlsSheet([['SKU', 'Nama Produk', 'Tambah Stok', 'Harga Beli', 'Supplier', 'Pembayaran (Tunai/Transfer/Kredit)', 'Tempo (hari)'], ['8991234500011', 'Beras Premium 5kg', 50, 62000, 'PT Sumber Pangan', 'Kredit', 30], ['8991234500028', 'Minyak Goreng 2L', 24, 32500, 'PT Sumber Pangan', 'Tunai', '']], [18, 30, 12, 12, 22, 30, 12]), 'Stok Masuk');
  else XLSX.utils.book_append_sheet(wb, xlsSheet([['SKU', 'Nama Produk', 'Kategori', 'Satuan', 'Harga Jual', 'Harga Online', 'HPP', 'Stok', 'Stok Minimum', 'Grosir (min:diskon%)'], ['8991234500011', 'Beras Premium 5kg', 'Sembako', 'karung', 68000, '', 62000, 100, 20, '10:2; 50:5'], ['8991234500028', 'Minyak Goreng 2L', 'Sembako', 'pcs', 36000, '', 32500, 60, 12, '']], [18, 30, 14, 8, 12, 12, 12, 8, 12, 22]), 'Produk');
  xlsSave(wb, 'template-stok-' + mode);
}
async function xlsStockImport(el, mode) {
  const f = el.files[0]; el.value = ''; if (!f || !xlsOk()) return;
  let rows; try { rows = await readXls(f); } catch (e) { return toast(e.message); }
  const { hi, map } = colMap(rows, PCOL2); if (map.n == null && map.sku == null && map.id == null && map.kd == null) return toast('Kolom SKU / Nama Produk tidak ditemukan. Unduh template untuk contoh format.');
  const plan = [], errs = [];
  rows.slice(hi + 1, hi + 2501).forEach((r, i) => {
    const line = hi + i + 2; if (r.every((x) => x === '')) return;
    const id = sval(cell(r, map, 'id')), sku = sval(cell(r, map, 'sku')), n = sval(cell(r, map, 'n')), kd = sval(cell(r, map, 'kd')).toUpperCase();
    const ex = (id && S.p.find((p) => !p.x && p.id == id)) || (kd && S.p.find((p) => !p.x && String(p.kd || '').toUpperCase() == kd)) || (sku && S.p.find((p) => !p.x && String(p.sku) == sku)) || (n && S.p.find((p) => !p.x && hn(p.n) == hn(n))) || null;
    if (mode == 'opname') {
      if (!ex) return errs.push('Baris ' + line + ': produk "' + (n || sku) + '" tidak ditemukan'); const q = dec(cell(r, map, 'st')); if (!Number.isFinite(q) || q < 0) return errs.push('Baris ' + line + ' (' + ex.n + '): stok fisik tidak valid');
      const dl = Math.round(q) - ex.st; if (dl) plan.push({ k: 'opn', ex, dl, label: ex.n + ': ' + ex.st + ' → ' + Math.round(q) }); return;
    }
    if (mode == 'masuk') {
      if (!ex) return errs.push('Baris ' + line + ': produk "' + (n || sku) + '" tidak ditemukan'); const q = Math.round(dec(cell(r, map, 'add')));
      if (!Number.isFinite(q) || q <= 0) return; const co = dec(cell(r, map, 'co')), py = sval(cell(r, map, 'pay')), kr = /kredit/i.test(py);
      plan.push({ k: 'stk', ex, q, cost: Number.isFinite(co) && co >= 0 ? Math.round(co) : ex.co, sup: sval(cell(r, map, 'sup')), cr: kr, m: /transfer|bank/i.test(py) ? 'Transfer' : 'Tunai', tempo: Math.round(dec(cell(r, map, 'tempo'))) || 30, label: ex.n + ' +' + q }); return;
    }
    // mode produk & harga
    const pr = dec(cell(r, map, 'pr')), d = { id: ex ? ex.id : 'p' + uid() }; if (!ex && kd) d.kd = kd;
    if (!ex) { if (!n) return errs.push('Baris ' + line + ': nama kosong'); if (!(pr > 0)) return errs.push('Baris ' + line + ' (' + n + '): harga jual wajib untuk produk baru'); d.n = n; d.c = sval(cell(r, map, 'c')) || 'Umum'; d.pr = Math.round(pr); d.sku = sku; d.co = Math.round(dec(cell(r, map, 'co'))) || 0; d.s0 = Math.max(0, Math.round(dec(cell(r, map, 'st'))) || 0); d.min = Number.isFinite(dec(cell(r, map, 'min'))) ? Math.round(dec(cell(r, map, 'min'))) : 10; }
    else { if (n && n != ex.n) d.n = n; const c = sval(cell(r, map, 'c')); if (c) d.c = c; if (pr > 0) d.pr = Math.round(pr); if (sku && sku != ex.sku) d.sku = sku; const co = dec(cell(r, map, 'co')); if (Number.isFinite(co) && co >= 0 && Math.round(co) != ex.co) d.co = Math.round(co); const mn = dec(cell(r, map, 'min')); if (Number.isFinite(mn)) d.min = Math.round(mn); }
    const u = sval(cell(r, map, 'u')); if (u) d.u = u; const op = dec(cell(r, map, 'opr')); if (Number.isFinite(op) && op > 0) d.opr = Math.round(op);
    const tr = parseTiers(cell(r, map, 'tier')); if (tr.length) d.tiers = tr;
    if (d.sku && S.p.some((p) => !p.x && p.sku == d.sku && p.id != d.id)) return errs.push('Baris ' + line + ': SKU ' + d.sku + ' dipakai produk lain');
    plan.push({ k: 'pu', d, nw: !ex, label: (d.n || ex.n) });
  });
  if (!plan.length) return toast(errs[0] || (mode == 'opname' ? 'Tidak ada selisih stok' : 'Tidak ada baris valid'));
  const T = { pu: 'Impor produk & harga', opn: 'Penyesuaian stok (opname)', stk: 'Stok masuk (restok)' }[plan[0].k];
  const m = modal(`<h3>${T}</h3>${row('Baris diproses', '<b>' + plan.length + '</b>')}${mode == 'produk' ? row('Produk baru', '<b class="gr">' + plan.filter((p) => p.nw).length + '</b>') + row('Diperbarui', plan.filter((p) => !p.nw).length) : ''}${mode == 'masuk' ? row('Total unit masuk', plan.reduce((a, p) => a + p.q, 0)) + row('Nilai pembelian', rp(plan.reduce((a, p) => a + p.q * p.cost, 0))) : ''}${mode == 'opname' ? row('Selisih (unit)', plan.reduce((a, p) => a + p.dl, 0)) : ''}${errs.length ? `<div class="warnbox">⚠ ${errs.length} catatan:<br>${errs.slice(0, 6).map(esc).join('<br>')}${errs.length > 6 ? '<br>…' : ''}</div>` : ''}<div class="ov" style="max-height:28vh"><table>${plan.slice(0, 10).map((p) => `<tr><td>${esc(p.label)}</tr>`).join('')}</table></div><button class="pr" id="ok">Terapkan ${plan.length} baris</button><button class="gh" id="x">Batal</button>`);
  $('#x', m).onclick = () => m.close();
  $('#ok', m).onclick = () => {
    for (const p of plan) { if (p.k == 'pu') emit('pu', { p: p.d }); else if (p.k == 'opn') emit('opn', { p: p.ex.id, delta: p.dl }); else emit('stk', { p: p.ex.id, qty: p.q, cost: p.cost, cr: p.cr, m: p.m, sup: p.sup, tempo: p.tempo }); }
    m.close(); R(); toast(plan.length + ' baris diterapkan');
  };
}
function xlsMenu(kind) {
  if (!(pkgHas('xls') && can('xls'))) return toast('Fitur Excel tidak tersedia di paket / hak akses Anda');
  const o = kind == 'outlet';
  const m = modal(`<h3>📊 Excel · ${o ? 'Data outlet (+GPS)' : 'Data stok'}</h3>
<button class="pr" id="ex">⬇ Ekspor ${o ? 'semua outlet' : 'semua stok'} ke Excel</button>
${o ? `<small class="mu">Kolom: nama, alamat, telepon, sales, tipe kredit/tunai, limit, tempo, latitude, longitude, catatan, piutang.</small><label class="gh a">⬆ Impor outlet dari Excel/CSV<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="this.closest('.md').remove();xlsOutletImport(this)"></label><button class="gh" id="tp">Unduh template + petunjuk</button>`
    : `<label class="gh a">⬆ Impor produk &amp; harga<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="this.closest('.md').remove();xlsStockImport(this,'produk')"></label><button class="gh" id="t1">Template produk &amp; harga</button>
<label class="gh">⬆ Impor stok masuk (restok + utang)<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="this.closest('.md').remove();xlsStockImport(this,'masuk')"></label><button class="gh" id="t2">Template stok masuk</button>
<label class="gh">⬆ Impor hasil opname (stok fisik)<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="this.closest('.md').remove();xlsStockImport(this,'opname')"></label><button class="gh" id="t3">Template opname</button>`}
<button class="gh" id="x">Tutup</button>`);
  $('#ex', m).onclick = () => (o ? xlsOutletExport() : xlsStockExport()); $('#x', m).onclick = () => m.close();
  if (o) $('#tp', m).onclick = xlsOutletTemplate; else { $('#t1', m).onclick = () => xlsStockTemplate('produk'); $('#t2', m).onclick = () => xlsStockTemplate('masuk'); $('#t3', m).onclick = () => xlsStockTemplate('opname'); }
}
