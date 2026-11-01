'use strict';
/* ============ PANTAU GPS LANGSUNG (pemilik / admin) ============
   Posisi sales, sales kanvas & tim dropping dikirim HP karyawan ±1 menit sekali selama jam kerja
   (setelah absen masuk & aplikasi terbuka). Karyawan melihat pemberitahuan bahwa lokasinya dibagikan. */
const GPSR = ['sales', 'kanvas', 'dropping'];
let GPSU = '', GMAP = null, GLAY = null, GSIG = '', GPSD = 1, GTR = null, GTRQ = 0;
const GDAYS = [[1, 'Hari ini'], [2, '2 hari'], [3, '3 hari'], [7, '7 hari'], [14, '14 hari'], [30, '30 hari (maks)']], GPCOL = ['#22366e', '#c9772a', '#1f8a5e', '#8e3b8a', '#b8392f', '#2b7fa8', '#6b6f1f'];
const gpsSt = (t) => { const m = t ? (Date.now() - t) / 6e4 : 1e9; return m <= 3 ? ['live', 'Live', '#16a34a'] : m <= 15 ? ['near', 'Baru saja', '#d97706'] : ['off', 'Tidak aktif', '#94a3b8']; };
function gpsKm(L) { let d = 0; for (let i = 1; i < L.length; i++) { const x = haversine(L[i - 1][1], L[i - 1][2], L[i][1], L[i][2]); if (x < 5000) d += x; } return d / 1000; }
const gdur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return s + ' dtk'; const m = Math.round(s / 60); if (m < 60) return m + ' mnt'; return Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt'; };
// outlet terdekat dari satu titik (untuk menamai lokasi berhenti)
function gpsPlace(lat, lng) { let best = null, bd = 1e9; for (const c of S.c || []) { if (c.x || c.lat == null) continue; const d = haversine(lat, lng, c.lat, c.lng); if (d < bd) { bd = d; best = c; } } return best && bd <= 150 ? { n: best.n, d: Math.round(bd) } : null; }
// susun riwayat perjalanan dari jejak: berhenti (≥4 mnt di radius 70 m) vs perjalanan, beserta durasi & jarak
function gpsHistory(P0, user) {
  const P = (P0 || []).filter((p) => p[1] != null && p[2] != null).slice().sort((a, b) => a[0] - b[0]);
  const out = { km: 0, moveMs: 0, stopMs: 0, nStop: 0, first: P.length ? P[0][0] : 0, last: P.length ? P[P.length - 1][0] : 0, tl: [], maxStop: null };
  if (P.length < 2) return out;
  const hv = (a, b) => haversine(P[a][1], P[a][2], P[b][1], P[b][2]);
  const segDist = (a, b) => { let d = 0; for (let k = a + 1; k <= b; k++) { const x = haversine(P[k - 1][1], P[k - 1][2], P[k][1], P[k][2]); if (x < 3000) d += x; } return d; };
  for (let k = 1; k < P.length; k++) out.km += (hv(k - 1, k) < 3000 ? hv(k - 1, k) : 0);
  out.km /= 1000;
  const STOPR = 70, STOPMIN = 4 * 6e4, vis = (S.att || []).filter((a) => a.k == 'visit' && a.u == user);
  const segs = []; let i = 0;
  while (i < P.length) { let j = i + 1; while (j < P.length && hv(i, j) <= STOPR) j++; segs.push({ i, e: j - 1 }); i = j; }
  let leg = null;
  for (const s of segs) {
    const dur = P[s.e][0] - P[s.i][0], isStop = s.e > s.i && dur >= STOPMIN;
    if (isStop) {
      if (leg) { leg.dist = segDist(leg.fi, leg.ei); leg.dur = leg.end - leg.start; out.tl.push(leg); leg = null; }
      const pl = gpsPlace(P[s.i][1], P[s.i][2]), near = vis.find((a) => a.t >= P[s.i][0] - 6e5 && a.t <= P[s.e][0] + 6e5);
      const e = { type: 'stop', start: P[s.i][0], end: P[s.e][0], dur, lat: P[s.i][1], lng: P[s.i][2], place: pl, ci: near ? near.cn : null };
      out.tl.push(e); out.stopMs += dur; out.nStop++; if (!out.maxStop || dur > out.maxStop.dur) out.maxStop = e;
    } else { if (!leg) leg = { type: 'move', start: P[s.i][0], fi: s.i }; leg.end = P[s.e][0]; leg.ei = s.e; }
  }
  if (leg) { leg.dist = segDist(leg.fi, leg.ei); leg.dur = leg.end - leg.start; out.tl.push(leg); }
  out.moveMs = Math.max(0, (out.last - out.first) - out.stopMs);
  return out;
}
// ambil riwayat dari server (disimpan 30 hari); tanpa server dipakai jejak lokal 24 jam
function gpsTrailLoad(force) {
  if (!GPSU) return; const key = GPSU + '|' + GPSD;
  if (!force && GTR && GTR.key == key && Date.now() - GTR.t < (GPSD == 1 ? 55000 : 5 * 6e4)) return;
  if (GTRQ == key) return; GTRQ = key;
  if (!(S.srv && canNet())) { GTR = { key, t: Date.now(), pts: ((S.trail || {})[GPSU] || []).slice(), local: 1 }; GTRQ = 0; return; }
  api('/api/trail?user=' + encodeURIComponent(GPSU) + '&days=' + GPSD).then((r) => { GTR = { key, t: Date.now(), pts: r.pts || [], n: r.n }; }).catch((e) => { GTR = { key, t: Date.now(), pts: [], err: e.message }; }).then(() => { GTRQ = 0; if (V == 'gps' && GPSU + '|' + GPSD == key && !document.querySelector('.md')) { R(); } });
}
const gpsDaysSel = () => `<select class="gdays" aria-label="Rentang riwayat" onchange="GPSD=+this.value;GTR=null;R()">${GDAYS.map((d) => `<option value="${d[0]}" ${GPSD == d[0] ? 'selected' : ''}>${d[1]}</option>`).join('')}</select>`;
function gpsHistCard(u) {
  if (!u) return '';
  const ok = GTR && GTR.key == GPSU + '|' + GPSD;
  if (!ok) { gpsTrailLoad(); return `<div class="cd"><b>🧭 Riwayat perjalanan ${esc(u.n)}</b><p class="mu" style="margin:8px 0 0">Memuat riwayat…</p></div>`; }
  const head = `<div class="row" style="margin:0"><b>🧭 Riwayat perjalanan ${esc(u.n)}</b>${gpsDaysSel()}</div>`;
  const pts = (GTR.pts || []).slice().sort((a, b) => a[0] - b[0]);
  if (GTR.err) return `<div class="cd">${head}<p class="rd" style="margin:8px 0 0">${esc(GTR.err)}</p></div>`;
  if (!pts.length) return `<div class="cd">${head}<p class="mu" style="margin:8px 0 0">Belum ada data perjalanan pada rentang ini. Jejak mulai terekam saat karyawan sudah absen masuk dan mengirim lokasi. Riwayat disimpan ${30} hari, lebih lama dihapus otomatis.</p></div>`;
  const byDay = {}; for (const p of pts) (byDay[dkey(p[0])] = byDay[dkey(p[0])] || []).push(p);
  const days = Object.keys(byDay).sort().reverse().map((k) => ({ k, h: gpsHistory(byDay[k], u.n) }));
  const T = days.reduce((a, d) => ({ km: a.km + d.h.km, mv: a.mv + d.h.moveMs, st: a.st + d.h.stopMs, n: a.n + d.h.nStop }), { km: 0, mv: 0, st: 0, n: 0 });
  const line = (e) => e.type == 'stop'
    ? `<div class="gh2 stop"><span class="gd">🅿️</span><span class="gi"><b>Berhenti ${e.place ? 'di ' + esc(e.place.n) : e.ci ? 'di ' + esc(e.ci) : '<span class="mu">di luar outlet</span>'}</b><small class="mu">${hm(e.start)}–${hm(e.end)} · ${e.place ? e.place.d + ' m dari titik outlet · ' : ''}${e.ci ? '✓ check-in · ' : ''}<a href="https://www.google.com/maps?q=${e.lat},${e.lng}" target="_blank" rel="noopener">peta</a></small></span><b class="gt ${e.dur >= 36e5 ? 'rd' : e.dur >= 12e5 ? 'or' : ''}">${gdur(e.dur)}</b></div>`
    : `<div class="gh2 move"><span class="gd">🚗</span><span class="gi"><b>Perjalanan</b><small class="mu">${hm(e.start)}–${hm(e.end)} · ±${(e.dist / 1000).toFixed(e.dist < 1000 ? 2 : 1)} km</small></span><b class="gt">${gdur(e.dur)}</b></div>`;
  const dayRow = (d, i) => { const h = d.h, span = h.last - h.first, pct = span > 0 ? Math.round(h.moveMs / span * 100) : 0, dt = new Date(d.k + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
    return `<details class="gday" ${i == 0 ? 'open' : ''}><summary><span class="gdc" style="background:${GPCOL[i % GPCOL.length]}"></span><b>${esc(dt)}</b><small class="mu">${h.km.toFixed(1)} km · jalan ${gdur(h.moveMs)} · berhenti ${gdur(h.stopMs)} (${h.nStop}×) · aktif ${pct}%</small></summary>
<div class="gtl">${h.tl.length ? h.tl.slice().reverse().map(line).join('') : '<small class="mu">Tidak ada pergerakan berarti.</small>'}</div></details>`; };
  return `<div class="cd">${head}
<div class="pnums" style="margin:10px 0"><span><small>Jarak tempuh</small><b>${T.km.toFixed(1)} km</b></span><span><small>Waktu jalan</small><b class="gr">${gdur(T.mv)}</b></span><span><small>Waktu berhenti</small><b class="or">${gdur(T.st)}</b></span><span><small>Berhenti</small><b>${T.n}×</b></span></div>
<small class="mu">${days.length} hari terdata${GPSD > 1 ? ' dalam ' + GPSD + ' hari terakhir' : ''} · ketuk hari untuk melihat rincian${GTR.local ? ' · <b class="or">mode lokal (offline), hanya 24 jam</b>' : ''}</small>
<div class="gdays-l">${days.map(dayRow).join('')}</div>
<small class="mu" style="display:block;margin-top:8px">Berhenti = diam ≥4 menit dalam radius 70 m. Riwayat disimpan <b>30 hari</b>; data lebih lama dihapus otomatis.</small></div>`;
}
function gpsTeam() {
  const m = new Map(), add = (n, r) => { if (n && GPSR.includes(r) && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), { n, r }); };
  (S.staff || []).forEach((u) => add(u.name, u.role)); (S.users || []).forEach((u) => add(u.n, u.r)); Object.values(S.locs || {}).forEach((l) => add(l.u, l.r));
  const td = dkey(Date.now());
  return [...m.values()].map((u) => {
    const loc = (S.locs || {})[u.n], tr = ((S.trail || {})[u.n] || []).filter((p) => dkey(p[0]) == td), st = gpsSt(loc && loc.t), ci = typeof openCI == 'function' ? openCI(u.n) : null;
    const vis = S.att.filter((a) => a.u == u.n && a.k == 'visit' && dkey(a.t) == td).length, omz = S.sales.filter((s) => s.u == u.n && dkey(s.t) == td).reduce((a, s) => a + netSale(s), 0);
    const io = S.att.filter((a) => a.u == u.n && (a.k == 'in' || a.k == 'out') && dkey(a.t) == td).sort((a, b) => a.t - b.t), work = io.length > 0 && io[io.length - 1].k == 'in';
    return { ...u, loc, tr, st, ci, vis, omz, km: gpsKm(tr), work };
  }).sort((a, b) => ({ live: 0, near: 1, off: 2 }[a.st[0]] - { live: 0, near: 1, off: 2 }[b.st[0]]) || a.n.localeCompare(b.n));
}
VW.gps = () => {
  const T = gpsTeam(), live = T.filter((u) => u.st[0] == 'live').length;
  return `<div class="kp"><div class="cd k0"><small>Live sekarang</small><h2>${live} / ${T.length}</h2><small>sales · kanvas · dropping</small></div><div class="cd k1"><small>Jarak tempuh hari ini</small><h2>${T.reduce((a, u) => a + u.km, 0).toFixed(1)} km</h2><small>${T.reduce((a, u) => a + u.vis, 0)} kunjungan outlet</small></div></div>
<div class="cd gpsc"><div class="row" style="margin:0 0 8px"><b>${GPSU ? '🧭 Jejak ' + esc(GPSU) + ' · ' + (GDAYS.find((d) => d[0] == GPSD) || [0, GPSD + ' hari'])[1].replace(' (maks)', '') : '🛰️ Posisi tim'}</b><span class="wrap">${GPSU ? '<button class="gh" onclick="GPSU=\'\';R()">Semua</button>' : ''}<button class="gh" onclick="gpsRefresh(1)">⟳</button></span></div><div class="map gmap" id="gmap"></div>
<small class="mu" id="gupd">Diperbarui otomatis tiap ±20 detik</small></div>
${GPSU ? gpsHistCard(T.find((x) => x.n == GPSU)) : ''}
<div class="cd">${T.map((u) => `<div class="trow gpr ${GPSU == u.n ? 'on' : ''}" onclick="GPSU=GPSU=='${esc(u.n)}'?'':'${esc(u.n)}';R()"><em class="tav" style="background:${u.st[2]}">${esc(u.n[0].toUpperCase())}</em><span class="ti"><b>${esc(u.n)} <small class="mu">· ${esc(ROLE[u.r] || u.r)}</small></b><small><b style="color:${u.st[2]}">● ${u.st[1]}</b> · ${u.loc ? agoTxt(u.loc.t) : 'belum ada posisi'}${u.loc && u.loc.acc ? ' · ±' + u.loc.acc + ' m' : ''}</small>${u.work && u.st[0] == 'off' ? '<small class="or">⚠ HP belum mengirim data sejak ' + (u.loc ? agoTxt(u.loc.t) : 'absen') + '. Kunjungan / transaksi terbaru bisa masih tertahan di HP — minta karyawan membuka aplikasi dan memastikan tanda “Online”.</small>' : ''}<small class="mu">${u.ci ? '🏬 di ' + esc(u.ci.cn) + ' sejak ' + hm(u.ci.t) : 'tidak sedang check-in'} · ${u.km.toFixed(1)} km · ${u.vis} kunjungan${u.omz ? ' · ' + rp(u.omz) : ''}</small></span>${u.loc ? `<a class="gh" onclick="event.stopPropagation()" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${u.loc.lat},${u.loc.lng}">Maps</a>` : ''}</div>`).join('') || '<p class="mu">Belum ada sales, kanvas, atau tim dropping.</p>'}</div>
<small class="mu" style="display:block;margin:0 4px 14px">Lokasi dikirim HP karyawan ±1 menit sekali selama jam kerja (setelah absen masuk). Di aplikasi Android, posisi tetap terkirim <b>walau aplikasi ditutup</b> selama karyawan mengizinkan lokasi "sepanjang waktu" (ada notifikasi tetap di HP karyawan). Bila HP dimatikan, di-restart, kehabisan baterai, tanpa sinyal, atau karyawan mematikan berbagi lokasi / mencabut izin, posisi terakhir yang tetap ditampilkan.</small>`;
};
VW.gps.after = () => {
  if (S.srv && canNet() && !(S.staff || []).length) api('/api/staff').then((r) => { S.staff = r.staff; save(); if (V == 'gps') R(); }).catch(() => { });
  gpsDraw(true);
};
function gpsDraw(fit) {
  const el = $('#gmap'); if (!el || !window.L) return;
  if (!GMAP || !document.body.contains(GMAP._container)) { GMAP = L.map(el, { zoomControl: true }).setView([-2.5, 118], 5); tiles(GMAP); GLAY = L.layerGroup().addTo(GMAP); }
  GLAY.clearLayers(); const T = gpsTeam(), pts = [];
  for (const u of T) {
    if (GPSU && u.n != GPSU) continue;
    const sel = GPSU && GTR && GTR.key == GPSU + '|' + GPSD && GTR.pts.length ? GTR.pts : null, src = sel || u.tr, ln = u.tr.map((p) => [p[1], p[2]]);
    if (sel) { const bd = {}; for (const p of sel.slice().sort((a, b) => a[0] - b[0])) (bd[dkey(p[0])] = bd[dkey(p[0])] || []).push(p); Object.keys(bd).sort().reverse().forEach((k, i) => { const L2 = bd[k].map((p) => [p[1], p[2]]); L2.forEach((x) => pts.push(x)); if (L2.length > 1) L.polyline(L2, { color: GPCOL[i % GPCOL.length], weight: i ? 3 : 4.5, opacity: i ? .6 : .9 }).bindTooltip(k).addTo(GLAY); for (const e of gpsHistory(bd[k], u.n).tl) if (e.type == 'stop') L.circleMarker([e.lat, e.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: GPCOL[i % GPCOL.length], fillOpacity: 1 }).bindTooltip('Berhenti ' + gdur(e.dur) + ' · ' + hm(e.start) + (e.place ? ' · ' + e.place.n : '')).addTo(GLAY); }); }
    else if (ln.length > 1) L.polyline(ln, { color: GPSU ? '#22366e' : u.st[2], weight: GPSU ? 4 : 2.5, opacity: GPSU ? .85 : .45, dashArray: GPSU ? null : '4 6' }).addTo(GLAY);
    if (GPSU && !sel) for (const p of u.tr) if (p[3]) L.circleMarker([p[1], p[2]], { radius: 5, color: '#fff', weight: 1.5, fillColor: p[3] == 'visit' ? '#c9a24a' : '#22366e', fillOpacity: 1 }).bindTooltip((p[3] == 'visit' ? 'Check-in outlet' : p[3] == 'in' ? 'Absen masuk' : 'Absen pulang') + ' ' + hm(p[0])).addTo(GLAY);
    if (!u.loc) continue; pts.push([u.loc.lat, u.loc.lng]); ln.forEach((x) => GPSU && pts.push(x));
    const ic = L.divIcon({ className: 'gpin', html: `<span class="gp ${u.st[0]}" style="--c:${u.st[2]}"><b>${esc(u.n[0].toUpperCase())}</b></span><i>${esc(u.n)}</i>`, iconSize: [36, 36], iconAnchor: [18, 18] });
    L.marker([u.loc.lat, u.loc.lng], { icon: ic }).bindPopup(`<b>${esc(u.n)}</b> · ${esc(ROLE[u.r] || u.r)}<br>${u.st[1]} · ${agoTxt(u.loc.t)}<br>${u.ci ? '🏬 ' + esc(u.ci.cn) : 'Tidak check-in'}<br>${u.km.toFixed(1)} km · ${u.vis} kunjungan`).on('click', () => { GPSU = u.n; R(); }).addTo(GLAY);
  }
  if (fit && pts.length) { try { GMAP.fitBounds(L.latLngBounds(pts).pad(.25), { maxZoom: 16 }); } catch (e) { } }
  setTimeout(() => { try { GMAP && GMAP.invalidateSize(); } catch (e) { } }, 150);
  const g = $('#gupd'); if (g) g.textContent = 'Diperbarui ' + hm(Date.now()) + ' · otomatis tiap ±20 detik';
}
async function gpsRefresh(btn) { try { await sync(); } catch (e) { } if (V != 'gps') return; if (GPSU && !btn) gpsTrailLoad(); if (btn) return R(); const sig = JSON.stringify(S.locs || {}); if (sig != GSIG) { GSIG = sig; gpsDraw(false); } }
setInterval(() => { if (U && S && V == 'gps' && document.visibilityState != 'hidden' && !document.querySelector('.md')) gpsRefresh(); }, 20000);
