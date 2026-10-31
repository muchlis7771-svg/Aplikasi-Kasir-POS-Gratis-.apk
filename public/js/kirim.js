'use strict';
/* ============ PENGANTARAN / TIM DROPPING ============
   Order sales bertanda 🚚 masuk antrean. Tim dropping: ambil tugas → muat → berangkat → tiba (check-in radius 3 km)
   → selesai (tagih tunai bila COD, foto bukti) → check-out. Kredit atau tunai terlihat jelas per outlet. */
let kMap = null, kRoute = null, kFil = 'aktif';
const DST = { baru: ['Menunggu', 'o'], tugas: ['Ditugaskan', ''], ambil: ['Barang dimuat', ''], jalan: ['Dalam perjalanan', ''], tiba: ['Tiba di outlet', 'g'], selesai: ['Selesai', 'g'], gagal: ['Gagal kirim', 'r'] };
const dlSt = (s) => (s.dl ? s.dl.st : 'baru');
const dlOpen = (s) => !['selesai', 'gagal'].includes(dlSt(s));
const deliveries = () => S.sales.filter((s) => s.kirim && s.cu && !(s.rtot >= s.tot)); // pengiriman hanya untuk penjualan yang punya outlet/pelanggan tujuan
const isDrv = () => U.r == 'dropping';
function myDl() { return deliveries().filter((s) => dlOpen(s) && (!s.dl || !s.dl.by || s.dl.by == U.n)); }
function payTag(s) {
  const out = sOut(s), c = cust(s.cu), old = c ? Math.max(0, outOf(c.id) - out) : 0;
  if (s.cod) return out > 0 ? `<span class="chip g">💵 TAGIH TUNAI ${rp(out)}</span>` : `<span class="chip g">Lunas ${rp(s.tot)}</span>`;
  if (s.pay == 'Piutang') return `<span class="chip" style="background:#27407e1f;color:#27407e">🧾 KREDIT · tempo ${dstr(s.due)}</span>${old ? ` <span class="chip o">piutang lama ${rp(old)}</span>` : ''}`;
  return `<span class="chip g">Lunas · ${esc(s.pay)}</span>`;
}
function dlvEmit(no, st, ex) {
  const s = S.sales.find((x) => x.no == no); if (!s) return;
  return emit('dlv', { sale: no, st, ...(ex || {}) });
}
async function dlvStep(no, st, opt = {}) {
  const s = S.sales.find((x) => x.no == no); if (!s) return;
  if (st == 'tugas') { dlvEmit(no, 'tugas', { as: opt.as || U.n }); toast(opt.as && opt.as != U.n ? 'Ditugaskan ke ' + opt.as : 'Tugas diambil'); return R(); }
  if (st == 'ambil' || st == 'jalan') { const p = await getPos(); dlvEmit(no, st, { lat: p ? p.lat : null, lng: p ? p.lng : null, as: s.dl && s.dl.by ? undefined : U.n }); toast(st == 'ambil' ? 'Barang dimuat' : 'Berangkat ke ' + (s.cn || 'outlet')); MYPOS = p || MYPOS; return R(); }
  if (st == 'tiba') {
    const ok = await checkIn(s.cu, 'antar'); if (!ok && !(openCI(U.n) && openCI(U.n).cid == s.cu)) return;
    const cur = openCI(U.n); dlvEmit(no, 'tiba', { lat: cur ? cur.lat : null, lng: cur ? cur.lng : null, dist: cur ? cur.dist : null, fx: cur ? cur.fx : '' }); toast('Tiba di ' + (s.cn || 'outlet')); return R();
  }
  if (st == 'selesai') return dlvDone(no);
  if (st == 'gagal') {
    const why = prompt('Alasan gagal kirim (outlet tutup, ditolak, alamat tidak ketemu, dll):'); if (!why || !why.trim()) return;
    const p = await getPos(); dlvEmit(no, 'gagal', { lat: p ? p.lat : null, lng: p ? p.lng : null, note: why.trim() }); toast('Dicatat gagal kirim — admin akan menindaklanjuti'); return R();
  }
}
/* ---- cek titik outlet saat serah terima ---- */
const DLR = () => +S.set.dlr || 300;
async function dlvLoc(s) {
  const c = cust(s.cu) || {}, p = await goodPos(+S.set.gacc || 150);
  if (!p) return { err: 'GPS tidak aktif / lokasi tidak didapat. Nyalakan GPS lalu coba lagi.' };
  if (c.lat == null) return { p, lok: 'tanpa', d: null };
  const d = Math.round(haversine(p.lat, p.lng, c.lat, c.lng)); return { p, d, lok: d <= DLR() ? 'ok' : 'jauh' };
}
const lokTxt = (l) => !l ? '' : l.lok == 'ok' ? `<b class="gr">✓ Sesuai titik outlet</b> <small class="mu">(${distStr(l.d)})</small>` : l.lok == 'jauh' ? `<b class="rd">✗ Tidak sesuai titik outlet</b> <small class="mu">(${distStr(l.d)} dari titik, batas ${distStr(DLR())})</small>` : '<b class="or">⚠ Outlet belum punya titik GPS — lokasi tetap dicatat</b>';
function dlvDone(no) {
  const s = S.sales.find((x) => x.no == no), c = cust(s.cu), cur = openCI(U.n);
  if (pkgHas('cek') && can('cek') && (!cur || cur.cid != s.cu)) { toast('Check-in di outlet dulu (radius ' + distStr(CIR()) + ')'); return dlvStep(no, 'tiba'); }
  const out = sOut(s), old = c ? S.sales.filter((x) => x.cu == c.id && x.no != s.no && sOut(x) > 0) : [], needPh = antiOn() && S.set.pod !== false;
  const m = modal(`<h3>Selesai kirim · ${esc(s.cn || '')}</h3><small class="mu">${esc(s.no)} · ${s.L.reduce((a, i) => a + i.q, 0)} item · ${rp(s.tot)}</small>
${s.cod && out > 0 ? `<div class="warnbox" style="background:#00b8941f;color:inherit"><b>💵 Tagih tunai ${rp(out)}</b><br><small>Orderan ini dibayar saat barang tiba.</small></div><div class="fm2"><input id="da" type="number" value="${out}" placeholder="Uang diterima"><select id="dm"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select></div><small class="mu">Kurang dari ${rp(out)} → sisanya jadi piutang outlet.</small>` : s.pay == 'Piutang' && !s.cod ? `<div class="warnbox" style="background:#27407e1f;color:inherit"><b>🧾 KREDIT</b> — tidak ada penagihan untuk order ini. Jatuh tempo ${dstr(s.due)}.</div>` : '<small class="gr">Sudah lunas.</small>'}
${old.length ? `<b>Piutang lama outlet ini (boleh ditagih sekalian)</b>${old.map((x) => `<div class="row"><span>${esc(x.no)}<br><small class="${x.due < Date.now() ? 'rd' : 'mu'}">tempo ${dstr(x.due)}</small></span><span><b>${rp(sOut(x))}</b> <button class="gh" data-pay="${esc(x.no)}">Tagih</button></span></div>`).join('')}` : ''}
<div class="row" id="dloc"><span>📍 Lokasi serah terima</span><small class="mu">memeriksa GPS…</small></div>
<input id="dn" placeholder="Catatan penerima (nama yang menerima, kondisi barang)">
${needPh ? '<button class="gh" id="dph">📸 Foto bukti serah terima</button><img id="dpi" alt="" style="display:none;width:90px;border-radius:10px">' : ''}
<button class="pr" id="ok">✓ Konfirmasi selesai</button>`, 'w');
  let ph = null, LOC = null;
  dlvLoc(s).then((l) => { LOC = l; const e = $('#dloc', m); if (e) e.innerHTML = '<span>📍 Lokasi serah terima</span><span>' + (l.err ? '<b class="rd">' + esc(l.err) + '</b>' : lokTxt(l)) + '</span>'; });
  $$('[data-pay]', m).forEach((b) => (b.onclick = () => { m.close(); payModal(b.dataset.pay); }));
  const bp = $('#dph', m); if (bp) bp.onclick = async () => { ph = await selfie(U.n + ' · ' + s.no + ' · ' + tstr(trustNow() || Date.now()), 'environment'); if (ph) { const i = $('#dpi', m); i.src = ph; i.style.display = 'block'; } };
  $('#ok', m).onclick = async () => {
    if (needPh && !ph) return toast('Foto bukti serah terima diperlukan');
    const amt = s.cod && out > 0 ? Math.min(out, num(($('#da', m) || {}).value)) : 0, dmv = ($('#dm', m) || {}).value;
    if (amt > 0 && (dmv == 'QRIS' || dmv == 'Transfer') && !m._paid) { if (!(await payShow(dmv, amt, (s.cn || '') + ' · ' + s.no))) return; m._paid = 1; }
    const L2 = await dlvLoc(s); LOC = L2; if (L2.err) return alertBox(L2.err, 'Lokasi belum terverifikasi');
    if (L2.lok == 'jauh' && S.set.dlb !== false) return alertBox('Anda ' + distStr(L2.d) + ' dari titik outlet ' + (s.cn || '') + ' (batas ' + distStr(DLR()) + '). Serah terima hanya bisa dilakukan di lokasi outlet. Jika titik outlet salah, minta admin/pemilik memperbaikinya.', 'Lokasi tidak sesuai');
    const pr = await proof({ needPos: false });
    if (pr.err) return alertBox(pr.err);
    if (amt > 0) emit('pay', { sale: no, amt, m: $('#dm', m).value }, pr.t);
    dlvEmit(no, 'selesai', { lat: +L2.p.lat.toFixed(6), lng: +L2.p.lng.toFixed(6), acc: L2.p.acc ? Math.round(L2.p.acc) : null, dist: L2.d, lok: L2.lok, cash: amt, note: $('#dn', m).value.trim(), ph: ph || undefined, on: pr.on, sk: pr.sk, fx: fxs(pr.fx) });
    m.close(); toast('Pengantaran selesai' + (amt ? ' · uang ' + rp(amt) + ' tercatat' : '')); await checkOut(true); R();
  };
}
function routeOrder(list) { // urutan terdekat dari posisi saat ini
  const pts = list.map((s) => ({ s, c: cust(s.cu) })).filter((x) => x.c && x.c.lat != null), rest = list.filter((s) => !pts.some((x) => x.s == s));
  let cur = MYPOS || (pts[0] && { lat: pts[0].c.lat, lng: pts[0].c.lng }), out = [], tot = 0; const left = pts.slice();
  while (left.length && cur) { let bi = 0, bd = 1e18; left.forEach((x, i) => { const d = haversine(cur.lat, cur.lng, x.c.lat, x.c.lng); if (d < bd) { bd = d; bi = i; } }); const x = left.splice(bi, 1)[0]; tot += bd; out.push(x.s); cur = x.c; }
  return { order: [...out, ...rest], km: tot / 1000 };
}
async function kRouteGo() { toast('Mengambil lokasi…', 1200); MYPOS = (await getPos()) || MYPOS; kRoute = true; R(); }
function gmapsRoute(list) {
  const pts = list.map((s) => cust(s.cu)).filter((c) => c && c.lat != null); if (!pts.length) return '';
  const dst = pts[pts.length - 1], wp = pts.slice(0, -1).slice(0, 8).map((c) => c.lat + ',' + c.lng).join('|');
  return 'https://www.google.com/maps/dir/?api=1' + (MYPOS ? '&origin=' + MYPOS.lat + ',' + MYPOS.lng : '') + '&destination=' + dst.lat + ',' + dst.lng + (wp ? '&waypoints=' + encodeURIComponent(wp) : '') + '&travelmode=driving';
}
function dlCard(s, i) {
  const c = cust(s.cu) || {}, st = dlSt(s), d = MYPOS && c.lat != null ? haversine(MYPOS.lat, MYPOS.lng, c.lat, c.lng) : null, mine = !s.dl || !s.dl.by || s.dl.by == U.n, mgr = !isDrv();
  const act = [];
  if (st == 'baru' && isDrv()) act.push(['Ambil tugas', 'tugas']);
  if (st == 'tugas' && mine) act.push(['📦 Barang dimuat', 'ambil']);
  if (st == 'ambil' && mine) act.push(['🚚 Berangkat', 'jalan']);
  if (st == 'jalan' && mine) act.push(['📍 Tiba · check-in', 'tiba']);
  if (st == 'tiba' && mine) act.push(['✓ Selesai kirim', 'selesai']);
  const can_f = ['tugas', 'ambil', 'jalan', 'tiba'].includes(st) && mine;
  const dl = s.dl;
  return `<div class="cd ${st == 'selesai' ? '' : ''}"><div class="row" style="margin:0"><b>${i != null ? '<span class="chip">' + (i + 1) + '</span> ' : ''}${esc(s.cn || 'Umum')}</b><span class="chip ${DST[st][1]}">${DST[st][0]}</span></div>${(() => { const f = s.dl && s.dl.log.slice().reverse().find((l) => l.st == 'selesai'); return f && f.lok ? '<small style="display:block;margin-top:4px">📍 ' + lokTxt({ lok: f.lok, d: f.dist }) + '</small>' : ''; })()}
<small class="mu">${esc(c.ad || 'Alamat belum diisi')}${c.ph ? ' · ' + esc(c.ph) : ''}${d != null ? ' · <b>' + distStr(d) + '</b>' : ''}</small>
<div style="margin:6px 0">${payTag(s)}</div>
<details><summary class="mu" style="font-size:12px">${s.L.reduce((a, x) => a + x.q, 0)} item · ${rp(s.tot)} · ${esc(s.no)} · sales ${esc(s.u)}</summary>${s.L.map((x) => `<div class="row"><small>${esc(x.n)}</small><b>×${x.q}</b></div>`).join('')}${s.note ? `<small>Catatan sales: ${esc(s.note)}</small>` : ''}</details>
${dl && dl.by ? `<small class="mu">Petugas: <b>${esc(dl.by)}</b>${dl.t ? ' · ' + hm(dl.t) : ''}</small>` : ''}
${dl && dl.log.filter((l) => l.fx).length ? `<small class="rd">⚠ ${esc(fxTxt({ fx: dl.log.map((l) => l.fx).join(',') }).join(' · '))}</small>` : ''}
${st == 'gagal' && dl ? `<small class="rd">Alasan: ${esc((dl.log[dl.log.length - 1] || {}).note || '-')}</small>` : ''}
<div class="wrap" style="margin-top:8px"><button class="gh" onclick="printMenu(S.sales.find((x)=>x.no=='${esc(s.no)}'),'sj')">📦 Surat jalan</button><button class="gh" onclick="printMenu(S.sales.find((x)=>x.no=='${esc(s.no)}'),'faktur')">🖨️ Faktur</button>${act.map((a) => `<button class="${a[1] == 'selesai' ? 'pr' : 'gh a'}" style="flex:1" onclick="dlvStep('${esc(s.no)}','${a[1]}')">${a[0]}</button>`).join('')}${c.lat != null ? `<a class="gh" style="text-decoration:none;color:inherit" href="${esc(mapsUrl(c))}" target="_blank" rel="noopener">🧭 Navigasi</a>` : ''}${c.ph ? `<a class="gh" style="text-decoration:none;color:inherit" href="tel:${esc(c.ph)}">📞</a>` : ''}${can_f ? `<button class="gh d" onclick="dlvStep('${esc(s.no)}','gagal')">Gagal</button>` : ''}${mgr && st != 'selesai' && st != 'gagal' && can('kirim') ? `<button class="gh" onclick="dlvAssign('${esc(s.no)}')">Tugaskan</button>` : ''}${mgr && st == 'gagal' && can('retur') ? `<button class="gh d" onclick="returModal('${esc(s.no)}')">Retur</button><button class="gh" onclick="dlvStep('${esc(s.no)}','tugas',{as:'${esc(U.n)}'})">Kirim ulang</button>` : ''}</div></div>`;
}
function dlvAssign(no) {
  const names = (S.staff || []).filter((u) => u.role == 'dropping').map((u) => u.name);
  if (!names.length) return toast('Belum ada pengguna Tim Dropping. Tambahkan di menu Pengguna.');
  const m = modal(`<h3>Tugaskan pengantaran</h3>${names.map((n) => `<button class="gh" style="text-align:left" data-n="${esc(n)}">🚚 ${esc(n)}</button>`).join('')}<button class="gh" id="x">Batal</button>`);
  $$('[data-n]', m).forEach((b) => (b.onclick = () => { m.close(); dlvStep(no, 'tugas', { as: b.dataset.n }); })); $('#x', m).onclick = () => m.close();
}
VW.kirim = () => {
  const all = deliveries(), td = dkey(Date.now()), open = all.filter(dlOpen), mine = isDrv() ? myDl() : open;
  const done = all.filter((s) => !dlOpen(s) && s.dl && dkey(s.dl.end || s.dl.t) == td && (!isDrv() || s.dl.by == U.n)), ok = done.filter((s) => dlSt(s) == 'selesai'), fail = done.filter((s) => dlSt(s) == 'gagal');
  const cash = S.sales.reduce((a, s) => a + (s.pays || []).filter((p) => p.u == U.n && dkey(p.t) == td && p.m == 'Tunai').reduce((x, p) => x + p.amt, 0), 0);
  const codWait = open.filter((s) => s.cod).reduce((a, s) => a + sOut(s), 0), kr = open.filter((s) => !s.cod && s.pay == 'Piutang').reduce((a, s) => a + s.tot, 0);
  let L = kFil == 'aktif' ? mine : kFil == 'baru' ? open.filter((s) => dlSt(s) == 'baru') : kFil == 'selesai' ? ok : fail;
  let rt = null; if (kFil == 'aktif' && kRoute) { rt = routeOrder(L); L = rt.order; }
  const staff = !isDrv() ? teamDrv() : [];
  return `<div class="cd hero hero2"><div class="row" style="margin:0;align-items:flex-start"><span><b class="hg">${greet()}, ${esc(U.n)} 🚚</b><br><small>${todayLong()}</small></span><span class="hbadge">${isDrv() ? 'Dropping' : 'Pengantaran'}</span></div>
<div class="hmain"><span><small>Tugas aktif</small><h2>${mine.length}</h2><small>${ok.length} selesai · ${fail.length} gagal hari ini</small></span></div>
<div class="hsplit"><span><small>Tagih tunai</small><b>${rp(codWait)}</b></span><span><small>Order kredit</small><b>${rp(kr)}</b></span><span><small>${isDrv() ? 'Uang di tangan' : 'Menunggu'}</small><b>${isDrv() ? rp(cash) : open.filter((s) => dlSt(s) == 'baru').length}</b></span></div></div>
${pkgHas('kirim') ? '' : '<div class="cd warn"><b>⚠ Paket toko belum termasuk fitur Pengantaran</b><br><small>Order sales tidak akan masuk papan ini. Minta pemilik toko / Head Admin menaikkan paket ke High.</small></div>'}${ciBar()}${can('retur') ? `<button class="pr" style="width:100%;background:linear-gradient(135deg,#ef4444,#f97316)" onclick="RTO.tab='baru';go('retur')">↩️ Ambil barang retur dari outlet</button>` : ''}<div class="cd"><div class="map" id="kmap" style="height:230px"></div><div class="wrap" style="margin-top:8px"><button class="gh a" onclick="kRouteGo()">🧭 Urutkan rute terdekat</button>${rt && gmapsRoute(L) ? `<a class="gh" style="text-decoration:none;color:inherit" href="${esc(gmapsRoute(L))}" target="_blank" rel="noopener">Buka di Google Maps</a>` : ''}<button class="gh" onclick="R()">⟳ Segarkan</button></div>${rt ? `<small class="mu">Estimasi jarak lurus antar titik ±${rt.km.toFixed(1)} km (${L.length} tujuan)</small>` : ''}</div>
<div class="cd"><div class="seg" style="margin-top:0">${[['aktif', isDrv() ? 'Tugas saya' : 'Aktif'], ['baru', 'Antrean'], ['selesai', 'Selesai'], ['gagal', 'Gagal']].map((x) => `<button class="${kFil == x[0] ? 'a' : ''}" onclick="kFil='${x[0]}';R()">${x[1]}</button>`).join('')}</div></div>
${staff.length ? `<div class="cd"><h3>Tim dropping</h3>${staff.map((u) => `<div class="row"><span><b>${esc(u.name)}</b><br><small class="mu">${u.lbl}${u.act ? ' · ' + u.act + ' tugas' : ''}</small></span><small class="mu">${u.loc ? '📍 ' + agoTxt(u.loc.t) : ''}</small></div>`).join('')}</div>` : ''}
${L.map((s, i) => dlCard(s, kFil == 'aktif' ? i : null)).join('') || `<div class="cd mu">${kFil == 'aktif' ? 'Tidak ada tugas. Order sales bertanda 🚚 akan muncul di sini.' : 'Tidak ada data.'}</div>`}`;
};
VW.kirim.after = () => setTimeout(drawKMap, 60);
function teamDrv() {
  const td = dkey(Date.now());
  return (S.staff || []).filter((u) => u.role == 'dropping').map((u) => {
    const loc = (S.locs || {})[u.name], at = S.att.filter((a) => a.u == u.name && dkey(a.t) == td), inn = at.some((a) => a.k == 'in') && !at.some((a) => a.k == 'out');
    return { name: u.name, loc, lbl: inn ? 'Sedang bertugas' : 'Belum absen', act: deliveries().filter((s) => dlOpen(s) && s.dl && s.dl.by == u.name).length };
  });
}
function drawKMap() {
  const el = $('#kmap'); if (!el || !window.L) return; if (kMap) { try { kMap.remove(); } catch (e) { } kMap = null; }
  const L0 = (isDrv() ? myDl() : deliveries().filter(dlOpen)), pts = L0.map((s) => ({ s, c: cust(s.cu) })).filter((x) => x.c && x.c.lat != null);
  const ppl = isDrv() ? [] : Object.values(S.locs || {}).filter((l) => l.r == 'dropping');
  if (!pts.length && !MYPOS && !ppl.length) { el.innerHTML = '<p class="mu" style="padding:14px">Belum ada titik tujuan dengan koordinat GPS.</p>'; return; }
  const first = pts[0] ? pts[0].c : MYPOS || ppl[0]; kMap = L.map(el).setView([first.lat, first.lng], 13); tiles(kMap);
  const grp = L.featureGroup().addTo(kMap);
  pts.forEach((x, i) => { const cod = x.s.cod, col = cod ? '#00b894' : x.s.pay == 'Piutang' ? '#27407e' : '#54a0ff'; L.circleMarker([x.c.lat, x.c.lng], { radius: 11, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).bindPopup(`<b>${esc(x.c.n)}</b><br>${cod ? '💵 Tagih tunai ' + rp(sOut(x.s)) : x.s.pay == 'Piutang' ? '🧾 Kredit' : 'Lunas'}<br>${esc(DST[dlSt(x.s)][0])}`).bindTooltip(String(i + 1), { permanent: true, direction: 'center', className: 'tmt' }).addTo(grp); });
  if (MYPOS) L.circleMarker([MYPOS.lat, MYPOS.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#e17055', fillOpacity: 1 }).bindTooltip('Saya', { permanent: true, direction: 'top', className: 'tmt' }).addTo(grp);
  ppl.forEach((l) => L.circleMarker([l.lat, l.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#e17055', fillOpacity: 1 }).bindTooltip('🚚 ' + esc(l.u), { permanent: true, direction: 'top', className: 'tmt' }).addTo(grp));
  if (grp.getLayers().length) kMap.fitBounds(grp.getBounds().pad(0.3), { maxZoom: 15 }); setTimeout(() => { try { kMap && document.body.contains(kMap._container) && kMap.invalidateSize(); } catch (e) { } }, 200);
}
