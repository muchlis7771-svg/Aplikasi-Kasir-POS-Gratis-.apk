'use strict';
/* ============ OUTLET / TOKO LANGGANAN (peta, kredit/tunai, kunjungan) ============ */
let oQ = '', oMap = false, oSort = 'name', MYPOS = null, omap = null;
const DEF_POS = [-5.1477, 119.4327];
const mapsUrl = (c) => 'https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng;
const salesNames = () => { const a = new Set(); (S.staff || []).forEach((u) => u.role == 'sales' && a.add(u.name)); (S.users || []).forEach((u) => u.r == 'sales' && a.add(u.n)); S.c.forEach((c) => c.sl && a.add(c.sl)); return [...a].sort(); };
function outlets() {
  const t = oQ.toLowerCase();
  let L = S.c.filter((c) => !c.x && (!t || (c.n + ' ' + (c.ad || '') + ' ' + (c.sl || '')).toLowerCase().includes(t)));
  if (U.r == 'sales' && !t) L = L.slice().sort((a, b) => (b.sl == U.n) - (a.sl == U.n));
  const d = (c) => (MYPOS && c.lat != null ? haversine(MYPOS.lat, MYPOS.lng, c.lat, c.lng) : 1e12);
  if (oSort == 'near') L = L.slice().sort((a, b) => d(a) - d(b)); else if (oSort == 'debt') L = L.slice().sort((a, b) => outOf(b.id) - outOf(a.id)); else L = L.slice().sort((a, b) => a.n.localeCompare(b.n));
  return L;
}
VW.outlet = () => {
  const L = outlets(), tot = S.c.filter((c) => !c.x).reduce((a, c) => a + outOf(c.id), 0);
  return `${kpi([['Outlet', S.c.filter((c) => !c.x).length], ['Kredit aktif', S.c.filter((c) => !c.x && c.term == 'kredit').length], ['Total piutang', rp(tot)], ['Kunjungan hari ini', S.att.filter((a) => a.k == 'visit' && dkey(a.t) == dkey(Date.now())).length]])}
<div class="cd"><div class="wrap" style="margin-bottom:10px"><button class="gh a" onclick="outletForm()">+ Outlet</button><button class="gh ${oMap ? 'a' : ''}" onclick="oMap=!oMap;R()">🗺 Peta</button><button class="gh" onclick="nearMe()">📍 Terdekat</button><button class="gh ${oSort == 'debt' ? 'a' : ''}" onclick="oSort=oSort=='debt'?'name':'debt';R()">Piutang terbesar</button></div>
<input placeholder="Cari nama / alamat / sales" value="${esc(oQ)}" onchange="oQ=this.value;R()">${oMap ? '<div class="map" id="omap" style="margin-top:10px"></div>' : ''}</div>
${L.map((c) => { const out = outOf(c.id), od = overdue(c.id), d = MYPOS && c.lat != null ? haversine(MYPOS.lat, MYPOS.lng, c.lat, c.lng) : null; return `<div class="cd"><div class="row"><b>${esc(c.n)}</b><span>${c.term == 'kredit' ? '<span class="chip g">Kredit</span>' : '<span class="chip">Tunai</span>'}${od ? ' <span class="chip r">Jatuh tempo</span>' : ''}</span></div><small>${esc(c.ad || 'Alamat belum diisi')}${c.ph ? ' · ' + esc(c.ph) : ''}${c.sl ? ' · Sales: ' + esc(c.sl) : ''}${d != null ? ' · ' + distStr(d) : ''}</small>${c.term == 'kredit' ? `<div class="row"><small>Limit ${rp(c.lim)} · Piutang ${rp(out)}</small><b class="${c.lim - out < 0 ? 'rd' : 'gr'}">Sisa ${rp(c.lim - out)}</b></div>` : out ? `<small class="or">Piutang ${rp(out)}</small>` : ''}<div class="wrap" style="margin-top:8px"><button class="gh a" onclick="orderFor('${c.id}')">Order</button><button class="gh" onclick="visitOutlet('${c.id}')">Check-in</button>${c.lat != null ? `<a class="gh" style="text-decoration:none;color:inherit" href="${esc(mapsUrl(c))}" target="_blank" rel="noopener">Navigasi</a>` : ''}<button class="gh" onclick="outletDetail('${c.id}')">Detail</button></div></div>`; }).join('') || '<div class="cd mu">Belum ada outlet. Tambahkan toko langganan pertama Anda.</div>'}`;
};
VW.outlet.after = () => { if (oMap) setTimeout(drawMap, 60); };
async function nearMe() { toast('Mencari lokasi…', 1500); MYPOS = await getPos(); if (!MYPOS) return toast('Lokasi tidak tersedia. Aktifkan GPS & izin lokasi.'); oSort = 'near'; R(); }
function orderFor(id) { cCu = id; V = 'pos'; R(); }
function leafletOk() { return typeof L !== 'undefined' && L.map; }
const mapPin = () => L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#6c5ce7;border:3px solid #fff;box-shadow:0 2px 6px #0006"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
function tiles(m) { L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); }
function drawMap() {
  const el = $('#omap'); if (!el) return;
  if (!leafletOk()) { el.innerHTML = '<p class="mu" style="padding:14px">Peta tidak tersedia.</p>'; return; }
  if (omap) { omap.remove(); omap = null; }
  const L2 = S.c.filter((c) => !c.x && c.lat != null); omap = L.map(el).setView(L2.length ? [L2[0].lat, L2[0].lng] : DEF_POS, 12); tiles(omap);
  const g = L.featureGroup(L2.map((c) => L.circleMarker([c.lat, c.lng], { radius: 9, color: '#fff', weight: 2, fillColor: overdue(c.id) ? '#ff5d73' : c.term == 'kredit' ? '#00a58e' : '#6c5ce7', fillOpacity: 1 }).bindPopup(`<b>${esc(c.n)}</b><br>${esc(c.ad || '')}<br>Piutang ${rp(outOf(c.id))}<br><a href="${esc(mapsUrl(c))}" target="_blank" rel="noopener">Navigasi</a>`)).concat(MYPOS ? [L.circleMarker([MYPOS.lat, MYPOS.lng], { radius: 7, color: '#fff', fillColor: '#ff9f43', fillOpacity: 1 }).bindPopup('Lokasi saya')] : [])).addTo(omap);
  if (L2.length) omap.fitBounds(g.getBounds().pad(0.2), { maxZoom: 15 });
  setTimeout(() => omap && omap.invalidateSize(), 200);
}
function outletForm(id, cb) {
  const c = id ? cust(id) : null, boss = U.r == 'admin';
  let loc = c && c.lat != null ? { lat: c.lat, lng: c.lng } : null;
  const m = modal(`<h3>${c ? 'Edit' : 'Tambah'} outlet / toko langganan</h3>
<input id="on" placeholder="Nama toko *" value="${esc(c ? c.n : '')}"><div class="fm2"><input id="op" type="tel" placeholder="Telepon / WA" value="${esc(c ? c.ph || '' : '')}"><input id="oa" placeholder="Alamat" value="${esc(c ? c.ad || '' : '')}"></div><input id="oc" placeholder="Catatan" value="${esc(c ? c.note || '' : '')}">
<div><b>Titik lokasi</b> <small class="mu">ketuk peta atau geser pin</small></div><div class="map" id="fmap"></div>
<div class="fm2"><input id="ola" type="number" step="any" placeholder="Latitude" value="${loc ? loc.lat : ''}"><input id="oln" type="number" step="any" placeholder="Longitude" value="${loc ? loc.lng : ''}"></div><button class="gh" id="gps">📍 Pakai lokasi saya sekarang</button>
${boss ? `<div class="seg"><button data-t="cash" class="${!c || c.term != 'kredit' ? 'a' : ''}">Tunai saja</button><button data-t="kredit" class="${c && c.term == 'kredit' ? 'a' : ''}">Boleh kredit</button></div><div class="fm2" id="kr"><input id="ol" type="number" placeholder="Limit kredit (Rp)" value="${c ? c.lim || '' : ''}"><input id="ot" type="number" placeholder="Tempo (hari)" value="${c ? c.tempo || S.set.tempo : S.set.tempo || 30}"></div><select id="os"><option value="">— sales penanggung jawab —</option>${salesNames().map((n) => `<option ${c && c.sl == n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : `<small class="mu">${c ? '' : 'Outlet baru dimulai sebagai tunai saja. '}Fasilitas kredit & limit hanya diatur oleh pemilik toko.</small>`}
<button class="pr" id="ok">Simpan</button>${c && boss ? '<button class="gh d" id="del">Hapus outlet</button>' : ''}`, 'w');
  let term = c ? c.term : 'cash', mk = null, mp = null;
  const setLoc = (la, ln, ctr) => { loc = { lat: +(+la).toFixed(6), lng: +(+ln).toFixed(6) }; $('#ola', m).value = loc.lat; $('#oln', m).value = loc.lng; if (mp) { if (mk) mk.setLatLng([loc.lat, loc.lng]); else { mk = L.marker([loc.lat, loc.lng], { icon: mapPin(), draggable: true }).addTo(mp); mk.on('dragend', () => { const p = mk.getLatLng(); setLoc(p.lat, p.lng); }); } if (ctr) mp.setView([loc.lat, loc.lng], Math.max(mp.getZoom(), 16)); } };
  if (leafletOk()) { mp = L.map($('#fmap', m)).setView(loc ? [loc.lat, loc.lng] : MYPOS ? [MYPOS.lat, MYPOS.lng] : DEF_POS, loc ? 16 : 12); tiles(mp); mp.on('click', (e) => setLoc(e.latlng.lat, e.latlng.lng)); if (loc) setLoc(loc.lat, loc.lng); setTimeout(() => mp.invalidateSize(), 250); } else $('#fmap', m).outerHTML = '<small class="mu">Peta tidak tersedia — isi koordinat manual.</small>';
  const sync2 = () => { const la = parseFloat($('#ola', m).value), ln = parseFloat($('#oln', m).value); if (!isNaN(la) && !isNaN(ln)) setLoc(la, ln, true); };
  $('#ola', m).onchange = sync2; $('#oln', m).onchange = sync2;
  $('#gps', m).onclick = async () => { toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) return toast('GPS tidak tersedia. Aktifkan lokasi & izinkan aplikasi.'); MYPOS = p; setLoc(p.lat, p.lng, true); };
  $$('.seg button', m).forEach((b) => (b.onclick = () => { term = b.dataset.t; $$('.seg button', m).forEach((x) => x.classList.toggle('a', x == b)); $('#kr', m).style.display = term == 'kredit' ? 'grid' : 'none'; }));
  if (boss) $('#kr', m).style.display = term == 'kredit' ? 'grid' : 'none';
  $('#ok', m).onclick = () => {
    const n = $('#on', m).value.trim(); if (!n) return toast('Nama toko wajib diisi');
    const d = { id: c ? c.id : 'c' + uid(), n, ph: $('#op', m).value.trim(), ad: $('#oa', m).value.trim(), note: $('#oc', m).value.trim(), lat: loc ? loc.lat : null, lng: loc ? loc.lng : null };
    if (boss) { d.term = term; d.lim = term == 'kredit' ? num($('#ol', m).value) : 0; d.tempo = num($('#ot', m).value) || 30; d.sl = $('#os', m).value; }
    emit('cu', { c: d }); m.close(); toast('Outlet disimpan'); if (typeof cb == 'function') cb(d.id); else R();
  };
  const del = $('#del', m); if (del) del.onclick = () => { if (outOf(c.id)) return toast('Masih ada piutang ' + rp(outOf(c.id)) + ', lunasi dulu'); if (confirm('Hapus outlet ' + c.n + '?')) { emit('cu', { c: { id: c.id, x: 1 } }); m.close(); R(); } };
  if (boss && !(S.staff || []).length && S.srv && canNet()) api('/api/staff').then((r) => { S.staff = r.staff; save(); const sel = $('#os', m); if (sel) { const cur = sel.value; sel.innerHTML = '<option value="">— sales penanggung jawab —</option>' + salesNames().map((n) => `<option ${cur == n ? 'selected' : ''}>${esc(n)}</option>`).join(''); } }).catch(() => { });
}
async function visitOutlet(id) {
  const c = cust(id); toast('Mengambil lokasi…', 1500); const p = await getPos(); MYPOS = p || MYPOS;
  const dist = p && c.lat != null ? Math.round(haversine(p.lat, p.lng, c.lat, c.lng)) : null;
  const m = modal(`<h3>Check-in kunjungan</h3><b>${esc(c.n)}</b><small>${p ? (dist != null ? 'Jarak Anda ke outlet: <b class="' + (dist > 200 ? 'rd' : 'gr') + '">' + distStr(dist) + '</b>' + (dist > 200 ? ' (jauh dari titik outlet)' : '') : 'Outlet belum punya titik lokasi') : '<span class="rd">Lokasi GPS tidak tersedia — kunjungan dicatat tanpa lokasi</span>'}</small><input id="vn" placeholder="Catatan kunjungan (stok, keluhan, janji bayar)"><button class="pr" id="ok">Simpan check-in</button>`);
  $('#ok', m).onclick = () => { emit('visit', { cid: id, cn: c.n, lat: p ? p.lat : null, lng: p ? p.lng : null, dist, note: $('#vn', m).value.trim() }); m.close(); toast('Kunjungan dicatat'); R(); };
}
function outletDetail(id) {
  const c = cust(id); if (!c) return; const inv = S.sales.filter((s) => s.cu == id && sOut(s) > 0), out = outOf(id);
  const ss = S.sales.filter((s) => s.cu == id).slice(-8).reverse(), vs = S.att.filter((a) => a.k == 'visit' && a.cid == id).slice(-5).reverse();
  const m = modal(`<h3>${esc(c.n)}</h3><small>${esc(c.ad || '')}${c.ph ? ' · ' + esc(c.ph) : ''}${c.sl ? ' · Sales: ' + esc(c.sl) : ''}</small>${c.note ? `<small>Catatan: ${esc(c.note)}</small>` : ''}
${c.term == 'kredit' ? row('Limit kredit', rp(c.lim)) + row('Piutang berjalan', rp(out)) + row('Sisa limit', rp(c.lim - out), c.lim - out < 0 ? 'rd bo' : 'gr bo') + row('Tempo', (c.tempo || 30) + ' hari') : '<small>Outlet tunai (tanpa kredit)</small>'}
<b>Faktur belum lunas</b>${inv.map((s) => `<div class="row"><span>${esc(s.no)}<br><small>${dstr(s.t)} · jatuh tempo ${dstr(s.due)}${s.due < Date.now() ? ' <b class="rd">lewat</b>' : ''}</small></span><span><b>${rp(sOut(s))}</b> <button class="gh" onclick="this.closest('.md').close();payModal('${esc(s.no)}')">Terima</button></span></div>`).join('') || '<small class="mu">Tidak ada</small>'}
<b>Transaksi terakhir</b>${ss.map((s) => `<div class="row"><small>${dstr(s.t)} · ${esc(s.no)}</small><span>${rp(s.tot)}</span></div>`).join('') || '<small class="mu">Belum ada</small>'}
${vs.length ? '<b>Kunjungan terakhir</b>' + vs.map((v) => `<div class="row"><small>${tstr(v.t)} · ${esc(v.u)}${v.note ? ' · ' + esc(v.note) : ''}</small></div>`).join('') : ''}
<div class="wrap"><button class="gh a" id="e1">Order</button>${MGR(U.r) || U.r == 'sales' ? '<button class="gh" id="e2">Edit</button>' : ''}${out > 0 ? '<button class="gh" id="e3">Kirim tagihan</button>' : ''}</div>`);
  $('#e1', m).onclick = () => { m.close(); orderFor(id); };
  const e2 = $('#e2', m); if (e2) e2.onclick = () => { m.close(); outletForm(id); };
  const e3 = $('#e3', m); if (e3) e3.onclick = () => shareText('Tagihan ' + c.n, 'Yth. ' + c.n + ',\nRincian tagihan ' + (S.name || '') + ':\n' + inv.map((s) => s.no + ' (' + dstr(s.t) + ') ' + rp(sOut(s)) + ' — tempo ' + dstr(s.due)).join('\n') + '\nTotal: ' + rp(out) + '\nMohon konfirmasi pembayaran. Terima kasih 🙏');
}
