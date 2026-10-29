'use strict';
/* ============ OUTLET / TOKO LANGGANAN (peta, kredit/tunai, kunjungan) ============ */
let oQ = '', oMap = false, oSort = 'name', MYPOS = null, omap = null;
const DEF_POS = [-5.1477, 119.4327];
const mapsUrl = (c) => 'https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng;
const salesNames = () => { const a = new Set(); (S.staff || []).forEach((u) => u.role == 'sales' && a.add(u.name)); (S.users || []).forEach((u) => u.r == 'sales' && a.add(u.n)); S.c.forEach((c) => c.sl && a.add(c.sl)); return [...a].sort(); };
function outlets() {
  const t = oQ.toLowerCase();
  let L = S.c.filter((c) => !c.x && (!t || (c.n + ' ' + (c.kd || '') + ' ' + (c.ad || '') + ' ' + (c.sl || '')).toLowerCase().includes(t)));
  if (U.r == 'sales' && !t) L = L.slice().sort((a, b) => (b.sl == U.n) - (a.sl == U.n));
  const d = (c) => (MYPOS && c.lat != null ? haversine(MYPOS.lat, MYPOS.lng, c.lat, c.lng) : 1e12);
  if (oSort == 'near') L = L.slice().sort((a, b) => d(a) - d(b)); else if (oSort == 'debt') L = L.slice().sort((a, b) => outOf(b.id) - outOf(a.id)); else L = L.slice().sort((a, b) => a.n.localeCompare(b.n));
  return L;
}
VW.outlet = () => {
  const L = outlets(), tot = S.c.filter((c) => !c.x).reduce((a, c) => a + outOf(c.id), 0);
  return `${kpi([['Outlet', S.c.filter((c) => !c.x).length], ['Kredit aktif', S.c.filter((c) => !c.x && c.term == 'kredit').length], ['Total piutang', rp(tot)], ['Kunjungan hari ini', S.att.filter((a) => a.k == 'visit' && dkey(a.t) == dkey(Date.now())).length]])}
<div class="cd"><div class="wrap" style="margin-bottom:10px"><button class="gh a" onclick="outletForm()">+ Outlet</button><button class="gh ${oMap ? 'a' : ''}" onclick="oMap=!oMap;R()">🗺 Peta</button><button class="gh" onclick="nearMe()">📍 Terdekat</button>${MGR(U.r) || U.r == 'sales' ? '<button class="gh a" onclick="scanOutlets()">🔎 Cari outlet sekitar</button>' : ''}<button class="gh ${oSort == 'debt' ? 'a' : ''}" onclick="oSort=oSort=='debt'?'name':'debt';R()">Piutang terbesar</button>${pkgHas('xls') && can('xls') ? '<button class="gh" onclick="xlsMenu(\'outlet\')">📊 Excel</button>' : ''}</div>
<input placeholder="Cari nama / alamat / sales" value="${esc(oQ)}" onchange="oQ=this.value;R()">${oMap ? '<div class="map" id="omap" style="margin-top:10px"></div>' : ''}</div>
${L.map((c) => { const out = outOf(c.id), od = overdue(c.id), d = MYPOS && c.lat != null ? haversine(MYPOS.lat, MYPOS.lng, c.lat, c.lng) : null; return `<div class="cd"><div class="row"><b>${esc(c.n)}</b>${c.kd ? ' <small class="kd">' + esc(c.kd) + '</small>' : ''}<span>${c.term == 'kredit' ? '<span class="chip g">Kredit</span>' : '<span class="chip">Tunai</span>'}${od ? ' <span class="chip r">Jatuh tempo</span>' : ''}</span></div><small>${esc(c.ad || 'Alamat belum diisi')}${c.ph ? ' · ' + esc(c.ph) : ''}${c.sl ? ' · Sales: ' + esc(c.sl) : ''}${d != null ? ' · ' + distStr(d) : ''}</small>${c.term == 'kredit' ? `<div class="row"><small>Limit ${rp(c.lim)} · Piutang ${rp(out)}</small><b class="${c.lim - out < 0 ? 'rd' : 'gr'}">Sisa ${rp(c.lim - out)}</b></div>` : out ? `<small class="or">Piutang ${rp(out)}</small>` : ''}<div class="wrap" style="margin-top:8px"><button class="gh a" onclick="orderFor('${c.id}')">Order</button><button class="gh" onclick="visitOutlet('${c.id}')">${pkgHas('cek') && can('cek') && (openCI(U.n) || {}).cid == c.id ? 'Check-out' : 'Check-in'}</button>${c.lat != null ? `<a class="gh" style="text-decoration:none;color:inherit" href="${esc(mapsUrl(c))}" target="_blank" rel="noopener">Navigasi</a>` : ''}<button class="gh" onclick="outletDetail('${c.id}')">Detail</button></div></div>`; }).join('') || '<div class="cd mu">Belum ada outlet. Tambahkan toko langganan pertama Anda.</div>'}`;
};
VW.outlet.after = () => { if (oMap) setTimeout(drawMap, 60); };
async function nearMe() { toast('Mencari lokasi…', 1500); MYPOS = await getPos(); if (!MYPOS) return toast('Lokasi tidak tersedia. Aktifkan GPS & izin lokasi.'); oSort = 'near'; R(); }
function orderFor(id) { cCu = id; V = 'pos'; R(); }
function leafletOk() { return typeof L !== 'undefined' && L.map; }
const mapPin = () => L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#6c5ce7;border:3px solid #fff;box-shadow:0 2px 6px #0006"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
function tiles(m) { try { window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); } catch (e) { } }
function drawMap() {
  const el = $('#omap'); if (!el) return;
  if (!leafletOk()) { el.innerHTML = '<p class="mu" style="padding:14px">Peta tidak tersedia.</p>'; return; }
  if (omap) { omap.remove(); omap = null; }
  const L2 = S.c.filter((c) => !c.x && c.lat != null); omap = L.map(el).setView(L2.length ? [L2[0].lat, L2[0].lng] : DEF_POS, 12); tiles(omap);
  const g = L.featureGroup(L2.map((c) => L.circleMarker([c.lat, c.lng], { radius: 9, color: '#fff', weight: 2, fillColor: overdue(c.id) ? '#ff5d73' : c.term == 'kredit' ? '#00a58e' : '#6c5ce7', fillOpacity: 1 }).bindPopup(`<b>${esc(c.n)}</b><br>${esc(c.ad || '')}<br>Piutang ${rp(outOf(c.id))}<br><a href="${esc(mapsUrl(c))}" target="_blank" rel="noopener">Navigasi</a>`)).concat(MYPOS ? [L.circleMarker([MYPOS.lat, MYPOS.lng], { radius: 7, color: '#fff', fillColor: '#ff9f43', fillOpacity: 1 }).bindPopup('Lokasi saya')] : [])).addTo(omap);
  if (L2.length) omap.fitBounds(g.getBounds().pad(0.2), { maxZoom: 15 });
  setTimeout(() => { try { omap && document.body.contains(omap._container) && omap.invalidateSize(); } catch (e) { } }, 200);
}
function outletForm(id, cb) {
  const c = id ? cust(id) : null, boss = U.r == 'owner';
  let loc = c && c.lat != null ? { lat: c.lat, lng: c.lng } : null;
  const m = modal(`<h3>${c ? 'Edit' : 'Tambah'} outlet / toko langganan</h3>
${c ? '' : `<div class="sugh"><div class="row" style="margin:0"><b>💡 Potensi outlet baru di sekitar</b><select id="srad" style="width:auto;padding:5px 8px">${[1000, 3000, 5000, 10000].map((r) => `<option value="${r}" ${r == (SCAN.fr || 10000) ? 'selected' : ''}>${r / 1000} km</option>`).join('')}</select></div><small class="mu">Toko dari peta di sekitar titik GPS Anda yang belum jadi outlet. Ketuk untuk mengisi formulir otomatis.</small><div id="sug" class="sug"><p class="mu">📡 Mengambil lokasi GPS…</p></div></div>`}
<input id="on" placeholder="Nama toko *" value="${esc(c ? c.n : '')}"><div class="fm2"><input id="op" type="tel" placeholder="Telepon / WA" value="${esc(c ? c.ph || '' : '')}"><input id="oa" placeholder="Alamat" value="${esc(c ? c.ad || '' : '')}"></div><input id="oc" placeholder="Catatan" value="${esc(c ? c.note || '' : '')}">
<div><b>Titik lokasi</b> <small class="mu">ketuk peta atau geser pin</small></div><div class="map" id="fmap"></div>
<div class="fm2"><input id="ola" type="number" step="any" placeholder="Latitude" value="${loc ? loc.lat : ''}"><input id="oln" type="number" step="any" placeholder="Longitude" value="${loc ? loc.lng : ''}"></div><button class="gh" id="gps">📍 Pakai lokasi saya sekarang</button>
${boss ? `<div class="seg"><button data-t="cash" class="${!c || c.term != 'kredit' ? 'a' : ''}">Tunai saja</button><button data-t="kredit" class="${c && c.term == 'kredit' ? 'a' : ''}">Boleh kredit</button></div><div class="fm2" id="kr"><input id="ol" type="number" placeholder="Limit kredit (Rp)" value="${c ? c.lim || '' : ''}"><input id="ot" type="number" placeholder="Tempo (hari)" value="${c ? c.tempo || S.set.tempo : S.set.tempo || 30}"></div>` : `<small class="mu">${c ? '' : 'Outlet baru dimulai sebagai tunai saja. '}Fasilitas kredit & limit hanya diatur oleh pemilik toko (owner).</small>`}${MGR(U.r) ? `<select id="os"><option value="">— sales penanggung jawab —</option>${salesNames().map((n) => `<option ${c && c.sl == n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
<button class="pr" id="ok">Simpan</button>${c && boss ? '<button class="gh d" id="del">Hapus outlet</button>' : ''}`, 'w');
  let term = c ? c.term : 'cash', mk = null, mp = null;
  const setLoc = (la, ln, ctr) => { loc = { lat: +(+la).toFixed(6), lng: +(+ln).toFixed(6) }; $('#ola', m).value = loc.lat; $('#oln', m).value = loc.lng; if (mp) { if (mk) mk.setLatLng([loc.lat, loc.lng]); else { mk = L.marker([loc.lat, loc.lng], { icon: mapPin(), draggable: true }).addTo(mp); mk.on('dragend', () => { const p = mk.getLatLng(); setLoc(p.lat, p.lng); }); } if (ctr) mp.setView([loc.lat, loc.lng], Math.max(mp.getZoom(), 16)); } };
  if (leafletOk()) { mp = L.map($('#fmap', m)).setView(loc ? [loc.lat, loc.lng] : MYPOS ? [MYPOS.lat, MYPOS.lng] : DEF_POS, loc ? 16 : 12); tiles(mp); mp.on('click', (e) => setLoc(e.latlng.lat, e.latlng.lng)); if (loc) setLoc(loc.lat, loc.lng); setTimeout(() => mp.invalidateSize(), 250); } else $('#fmap', m).outerHTML = '<small class="mu">Peta tidak tersedia — isi koordinat manual.</small>';
  const sync2 = () => { const la = parseFloat($('#ola', m).value), ln = parseFloat($('#oln', m).value); if (!isNaN(la) && !isNaN(ln)) setLoc(la, ln, true); };
  $('#ola', m).onchange = sync2; $('#oln', m).onchange = sync2;
  let from = '', sugLy = null, SG = [];
  const fillAddr = async (p) => { if ($('#oa', m).value.trim()) return; const a = await revGeo(p); if (a && !$('#oa', m).value.trim()) $('#oa', m).value = a; };
  const gpsNow = async (quiet) => { if (!quiet) toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) { if (!quiet) toast('GPS tidak tersedia. Aktifkan lokasi & izinkan aplikasi.'); return null; } MYPOS = p; setLoc(p.lat, p.lng, true); fillAddr(p); return p; };
  $('#gps', m).onclick = () => gpsNow();
  const pick = (i) => { const x = SG[i]; if (!x) return; $('#on', m).value = x.n; if (x.ph) $('#op', m).value = x.ph; $('#oa', m).value = x.ad || ''; from = 'Dari peta: ' + (SHOPT[x.type] || x.type || 'toko'); if (!$('#oc', m).value) $('#oc', m).value = from; setLoc(x.lat, x.lng, true); if (!x.ad) fillAddr(x); $$('#sug button', m).forEach((b) => b.classList.toggle('on', +b.dataset.i == i)); toast('Diisi dari peta: ' + x.n); };
  const loadSug = async () => {
    const el = $('#sug', m); if (!el) return; SCAN.fr = +$('#srad', m).value;
    let p = MYPOS && Date.now() - (MYPOS.t || 0) < 3e5 ? MYPOS : null; if (!p) { el.innerHTML = '<p class="mu">📡 Mengambil lokasi GPS…</p>'; p = await gpsNow(true); if (p) p.t = Date.now(); } else if (!loc) setLoc(p.lat, p.lng, true), fillAddr(p);
    if (!p) { el.innerHTML = '<p class="rd">GPS tidak terbaca. Aktifkan lokasi (GPS) & izinkan aplikasi, lalu <a onclick="this.closest(\'.md\').querySelector(\'#srad\').dispatchEvent(new Event(\'change\'))">coba lagi</a>.</p>'; return; }
    el.innerHTML = `<p class="mu">🔎 Mencari toko di peta dalam radius ${distStr(SCAN.fr)}…</p>`;
    try { SG = (await osmShops(p, SCAN.fr, false)).filter((x) => !x.dup).slice(0, 60); } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; return; }
    if (!$('#sug', m)) return;
    el.innerHTML = SG.length ? `<small class="mu">${SG.length} potensi outlet · terdekat lebih dulu</small>` + SG.map((x, i) => `<button data-i="${i}"><i>🏪</i><span><b>${esc(x.n)}</b><small class="mu">${esc(SHOPT[x.type] || x.type || 'Toko')} · ${distStr(x.d)}${x.ad ? ' · ' + esc(x.ad) : ''}</small></span><small class="gh a" style="flex:none">Pakai</small></button>`).join('') + `<button class="gh" id="sgall" style="justify-content:center">📋 Tambah banyak sekaligus…</button>` : '<p class="mu">Belum ada toko tercatat di peta pada radius ini. Coba radius lebih besar, atau isi manual.</p>';
    $$('#sug [data-i]', m).forEach((b) => (b.onclick = () => pick(+b.dataset.i)));
    const ga = $('#sgall', m); if (ga) ga.onclick = () => { m.close(); SCAN.r = SCAN.fr; scanOutlets(true); };
    if (mp) { if (sugLy) mp.removeLayer(sugLy); sugLy = window.L.featureGroup(SG.map((x, i) => window.L.circleMarker([x.lat, x.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#ff5d73', fillOpacity: 0.9 }).bindTooltip(esc(x.n)).on('click', () => pick(i)))).addTo(mp); }
  };
  if (!c) { $('#srad', m).onchange = loadSug; loadSug(); }
  $$('.seg button', m).forEach((b) => (b.onclick = () => { term = b.dataset.t; $$('.seg button', m).forEach((x) => x.classList.toggle('a', x == b)); $('#kr', m).style.display = term == 'kredit' ? 'grid' : 'none'; }));
  if (boss) $('#kr', m).style.display = term == 'kredit' ? 'grid' : 'none';
  $('#ok', m).onclick = () => {
    const n = $('#on', m).value.trim(); if (!n) return toast('Nama toko wajib diisi');
    const d = { id: c ? c.id : 'c' + uid(), n, ph: $('#op', m).value.trim(), ad: $('#oa', m).value.trim(), note: $('#oc', m).value.trim(), lat: loc ? loc.lat : null, lng: loc ? loc.lng : null };
    if (boss) { d.term = term; d.lim = term == 'kredit' ? num($('#ol', m).value) : 0; d.tempo = num($('#ot', m).value) || 30; }
    if (MGR(U.r) && $('#os', m)) d.sl = $('#os', m).value;
    emit('cu', { c: d }); m.close(); toast('Outlet disimpan'); if (typeof cb == 'function') cb(d.id); else R();
  };
  const del = $('#del', m); if (del) del.onclick = () => { if (outOf(c.id)) return toast('Masih ada piutang ' + rp(outOf(c.id)) + ', lunasi dulu'); if (confirm('Hapus outlet ' + c.n + '?')) { emit('cu', { c: { id: c.id, x: 1 } }); m.close(); R(); } };
  if (MGR(U.r) && !(S.staff || []).length && S.srv && canNet()) api('/api/staff').then((r) => { S.staff = r.staff; save(); const sel = $('#os', m); if (sel) { const cur = sel.value; sel.innerHTML = '<option value="">— sales penanggung jawab —</option>' + salesNames().map((n) => `<option ${cur == n ? 'selected' : ''}>${esc(n)}</option>`).join(''); } }).catch(() => { });
}
async function visitOutlet(id) {
  if (pkgHas('cek') && can('cek')) { const cur = openCI(U.n); return cur && cur.cid == id ? checkOut() : checkIn(id); }
  const c = cust(id); toast('Mengambil lokasi…', 1500); const p = await getPos(); MYPOS = p || MYPOS;
  const dist = p && c.lat != null ? Math.round(haversine(p.lat, p.lng, c.lat, c.lng)) : null;
  const m = modal(`<h3>Check-in kunjungan</h3><b>${esc(c.n)}</b><small>${p ? (dist != null ? 'Jarak Anda ke outlet: <b class="' + (dist > 200 ? 'rd' : 'gr') + '">' + distStr(dist) + '</b>' + (dist > 200 ? ' (jauh dari titik outlet)' : '') : 'Outlet belum punya titik lokasi') : '<span class="rd">Lokasi GPS tidak tersedia — kunjungan dicatat tanpa lokasi</span>'}</small><input id="vn" placeholder="Catatan kunjungan (stok, keluhan, janji bayar)"><button class="pr" id="ok">Simpan check-in</button>`);
  $('#ok', m).onclick = () => { emit('visit', { cid: id, cn: c.n, lat: p ? p.lat : null, lng: p ? p.lng : null, dist, note: $('#vn', m).value.trim() }); m.close(); toast('Kunjungan dicatat'); R(); };
}
function outletDetail(id) {
  const c = cust(id); if (!c) return; const inv = S.sales.filter((s) => s.cu == id && sOut(s) > 0), out = outOf(id);
  const ss = S.sales.filter((s) => s.cu == id).slice(-8).reverse(), vs = S.att.filter((a) => a.k == 'visit' && a.cid == id).slice(-5).reverse();
  const m = modal(`<h3>${esc(c.n)}</h3>${c.kd ? '<small class="kd">Kode outlet: ' + esc(c.kd) + '</small>' : ''}<small>${esc(c.ad || '')}${c.ph ? ' · ' + esc(c.ph) : ''}${c.sl ? ' · Sales: ' + esc(c.sl) : ''}</small>${c.note ? `<small>Catatan: ${esc(c.note)}</small>` : ''}
${c.term == 'kredit' ? row('Limit kredit', rp(c.lim)) + row('Piutang berjalan', rp(out)) + row('Sisa limit', rp(c.lim - out), c.lim - out < 0 ? 'rd bo' : 'gr bo') + row('Tempo', (c.tempo || 30) + ' hari') : '<small>Outlet tunai (tanpa kredit)</small>'}
<b>Faktur belum lunas</b>${inv.map((s) => `<div class="row"><span>${esc(s.no)}<br><small>${dstr(s.t)} · jatuh tempo ${dstr(s.due)}${s.due < Date.now() ? ' <b class="rd">lewat</b>' : ''}</small></span><span><b>${rp(sOut(s))}</b> <button class="gh" onclick="this.closest('.md').close();payModal('${esc(s.no)}')">Terima</button></span></div>`).join('') || '<small class="mu">Tidak ada</small>'}
<b>Transaksi terakhir</b>${ss.map((s) => `<div class="row"><small>${dstr(s.t)} · ${esc(s.no)}</small><span>${rp(s.tot)}</span></div>`).join('') || '<small class="mu">Belum ada</small>'}
${vs.length ? '<b>Kunjungan terakhir</b>' + vs.map((v) => `<div class="row"><small>${tstr(v.t)} · ${esc(v.u)}${v.note ? ' · ' + esc(v.note) : ''}</small></div>`).join('') : ''}
<div class="wrap"><button class="gh a" id="e1">Order</button>${can('retur') ? '<button class="gh" id="e9">↩️ Retur</button>' : ''}${MGR(U.r) || U.r == 'sales' ? '<button class="gh" id="e2">Edit</button>' : ''}${out > 0 ? '<button class="gh" id="e3">Kirim tagihan</button>' : ''}</div>`);
  { const e9 = $('#e9', m); if (e9) e9.onclick = () => { m.close(); RTO.cu = id; RTO.L = []; RTO.tab = 'baru'; go('retur'); }; }
  $('#e1', m).onclick = () => { m.close(); orderFor(id); };
  const e2 = $('#e2', m); if (e2) e2.onclick = () => { m.close(); outletForm(id); };
  const e3 = $('#e3', m); if (e3) e3.onclick = () => shareText('Tagihan ' + c.n, 'Yth. ' + c.n + ',\nRincian tagihan ' + (S.name || '') + ':\n' + inv.map((s) => s.no + ' (' + dstr(s.t) + ') ' + rp(sOut(s)) + ' — tempo ' + dstr(s.due)).join('\n') + '\nTotal: ' + rp(out) + '\nMohon konfirmasi pembayaran. Terima kasih 🙏');
}

/* ============ CARI OUTLET OTOMATIS dari peta (OpenStreetMap) di sekitar titik GPS, radius s/d 10 km ============ */
const SHOPT = { convenience: 'Toko kelontong/minimarket', supermarket: 'Supermarket', grocery: 'Toko sembako', general: 'Toko serba ada', kiosk: 'Kios', wholesale: 'Grosir', variety_store: 'Toko serba ada', beverages: 'Toko minuman', bakery: 'Toko roti', greengrocer: 'Sayur & buah', butcher: 'Daging', deli: 'Makanan', frozen_food: 'Makanan beku', confectionery: 'Toko kue', tobacco: 'Rokok', chemist: 'Toko kebutuhan', cosmetics: 'Kosmetik', houseware: 'Perabot', hardware: 'Toko bangunan', stationery: 'ATK', department_store: 'Toserba', mall: 'Mal', water: 'Depot air', rice: 'Toko beras', seafood: 'Ikan', dairy: 'Susu', farm: 'Hasil tani', pastry: 'Kue', spices: 'Bumbu', tea: 'Teh', coffee: 'Kopi' };
const SCAN = { r: 10000, all: false, list: [], at: null };
async function scanOutlets(auto) {
  const m = modal(`<h3>🔎 Cari outlet di sekitar</h3><small class="mu">Mengambil toko/warung dari peta OpenStreetMap di sekitar lokasi GPS Anda. Data peta dibuat komunitas — tidak semua warung tercatat.</small>
<label><small class="mu">Radius pencarian</small><select id="sr">${[1000, 3000, 5000, 10000].map((r) => `<option value="${r}" ${SCAN.r == r ? 'selected' : ''}>${r >= 1000 ? r / 1000 + ' km' : r + ' m'}</option>`).join('')}</select></label>
<label class="row"><span>Tampilkan semua jenis toko (bukan hanya kelontong/grosir)</span><input type="checkbox" id="sa" ${SCAN.all ? 'checked' : ''}></label>
<button class="pr" id="go">📍 Ambil GPS & cari</button><div id="sres"></div>`, 'w');
  $('#go', m).onclick = async () => {
    SCAN.r = +$('#sr', m).value; SCAN.all = $('#sa', m).checked; const out = $('#sres', m); out.innerHTML = '<p class="mu">Mengambil lokasi GPS…</p>';
    const p = await getPos(); if (!p) { out.innerHTML = '<p class="rd">Lokasi tidak tersedia. Aktifkan GPS & izin lokasi.</p>'; return; }
    SCAN.at = p; out.innerHTML = '<p class="mu">Mencari toko di peta (radius ' + distStr(SCAN.r) + ')… bisa sampai 20 detik.</p>';
    try { SCAN.list = await osmShops(p, SCAN.r, SCAN.all); } catch (e) { out.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; return; }
    scanList(out, m);
  };
  if (auto) $('#go', m).click();
}
const OSMC = LS.get('jpos:osmc', null);
async function osmShops(p, r, all) {
  const C = OSMC_get(p, r, all); if (C) return markDup(C, p);
  const types = all ? '' : '["shop"~"^(' + ['convenience', 'supermarket', 'grocery', 'general', 'kiosk', 'wholesale', 'variety_store', 'beverages', 'bakery', 'greengrocer', 'deli', 'frozen_food', 'confectionery', 'tobacco', 'chemist', 'water', 'rice', 'department_store', 'dairy', 'spices', 'butcher', 'seafood', 'cosmetics', 'houseware', 'stationery'].join('|') + ')$"]';
  const ar = `(around:${r},${p.lat},${p.lng})`;
  const q = `[out:json][timeout:25];(node["shop"]${types}${ar};way["shop"]${types}${ar};${all ? `node["amenity"~"^(marketplace|cafe|restaurant|fast_food)$"]${ar};` : ''});out center 800;`;
  let js = null;
  for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try { const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined }); if (res.ok) { js = await res.json(); break; } } catch (e) { }
  }
  if (!js) throw new Error('Server peta tidak bisa dihubungi. Periksa internet lalu coba lagi.');
  const seen = new Set();
  const list = js.elements.map((e) => { const t = e.tags || {}, lat = e.lat ?? (e.center && e.center.lat), lng = e.lon ?? (e.center && e.center.lon); return { id: e.type + e.id, n: t.name || t['name:id'] || t.brand || '', type: t.shop || t.amenity, lat, lng, ad: [t['addr:street'], t['addr:housenumber'], t['addr:suburb'] || t['addr:village'], t['addr:city']].filter(Boolean).join(' '), ph: t.phone || t['contact:phone'] || t['contact:whatsapp'] || '' }; })
    .filter((x) => x.lat != null && x.n && !seen.has(x.n.toLowerCase() + Math.round(x.lat * 1e3)) && seen.add(x.n.toLowerCase() + Math.round(x.lat * 1e3)));
  try { LS.set('jpos:osmc', { lat: p.lat, lng: p.lng, r, all, t: Date.now(), list: list.slice(0, 600) }); } catch (e) { }
  return markDup(list, p);
}
function OSMC_get(p, r, all) { const c = LS.get('jpos:osmc', null); return c && c.r >= r && c.all == all && Date.now() - c.t < 6 * 36e5 && haversine(c.lat, c.lng, p.lat, p.lng) < 300 ? c.list.filter((x) => haversine(p.lat, p.lng, x.lat, x.lng) <= r) : null; }
function markDup(list, p) { return list.map((x) => ({ ...x, d: haversine(p.lat, p.lng, x.lat, x.lng), dup: S.c.find((c) => !c.x && ((c.lat != null && haversine(c.lat, c.lng, x.lat, x.lng) < 60) || c.n.toLowerCase() == x.n.toLowerCase())) })).sort((a, b) => a.d - b.d); }
async function revGeo(p) { try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=id&lat=${p.lat}&lon=${p.lng}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined }); if (!r.ok) return ''; const j = await r.json(), a = j.address || {}; return [a.road, a.house_number, a.neighbourhood || a.hamlet, a.village || a.suburb, a.city_district, a.city || a.town || a.county].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 4).join(','); } catch (e) { return ''; } }
function scanList(out, m) {
  const L = SCAN.list, nw = L.filter((x) => !x.dup);
  out.innerHTML = `<div class="row"><b>${L.length} toko ditemukan · ${nw.length} belum jadi outlet</b><label class="row" style="margin:0;gap:6px"><small>Pilih semua</small><input type="checkbox" id="sall"></label></div><div id="smap" class="map" style="height:220px"></div>
${MGR(U.r) ? `<label><small class="mu">Sales penanggung jawab (opsional)</small><select id="ssl"><option value="">—</option>${salesNames().map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>` : ''}
<div style="max-height:40vh;overflow:auto">${L.map((x, i) => `<label class="row sitem" style="${x.dup ? 'opacity:.55' : ''}"><span><b>${esc(x.n)}</b><br><small class="mu">${esc(SHOPT[x.type] || x.type || 'Toko')} · ${distStr(x.d)}${x.ad ? ' · ' + esc(x.ad) : ''}${x.ph ? ' · ' + esc(x.ph) : ''}${x.dup ? ' · <b>sudah ada: ' + esc(x.dup.n) + '</b>' : ''}</small></span>${x.dup ? '' : `<input type="checkbox" data-i="${i}">`}</label>`).join('') || '<p class="mu">Tidak ada toko bernama di radius ini. Coba radius lebih besar.</p>'}</div>
<button class="pr" id="sadd">Tambahkan outlet terpilih</button>`;
  $('#sall', m).onchange = (e) => $$('[data-i]', m).forEach((c) => (c.checked = e.target.checked));
  $('#sadd', m).onclick = () => {
    const pick = $$('[data-i]', m).filter((c) => c.checked).map((c) => SCAN.list[+c.dataset.i]); if (!pick.length) return toast('Centang toko yang mau ditambahkan');
    const sl = ($('#ssl', m) || {}).value || (U.r == 'sales' ? U.n : '');
    pick.forEach((x) => emit('cu', { c: { id: 'c' + uid(), n: x.n, ph: x.ph, ad: x.ad, lat: x.lat, lng: x.lng, note: 'Dari peta: ' + (SHOPT[x.type] || x.type || 'toko'), ...(sl ? { sl } : {}) } }));
    m.close(); toast(pick.length + ' outlet ditambahkan ✓'); R();
  };
  setTimeout(() => {
    if (!window.L || !$('#smap', m)) return; const mp = window.L.map($('#smap', m)).setView([SCAN.at.lat, SCAN.at.lng], SCAN.r > 3000 ? 12 : 14);
    tiles(mp);
    window.L.circle([SCAN.at.lat, SCAN.at.lng], { radius: SCAN.r, color: '#6c5ce7', weight: 1, fillOpacity: 0.05 }).addTo(mp);
    window.L.circleMarker([SCAN.at.lat, SCAN.at.lng], { radius: 7, color: '#fff', fillColor: '#6c5ce7', fillOpacity: 1, weight: 3 }).addTo(mp).bindPopup('Posisi Anda');
    SCAN.list.slice(0, 400).forEach((x) => window.L.circleMarker([x.lat, x.lng], { radius: 5, color: x.dup ? '#999' : '#ff5d73', fillOpacity: 0.8, weight: 1 }).addTo(mp).bindPopup(esc(x.n)));
  }, 80);
}
