'use strict';
/* ============ PANTAU GPS LANGSUNG (pemilik / admin) ============
   Posisi sales, sales kanvas & tim dropping dikirim HP karyawan ±1 menit sekali selama jam kerja
   (setelah absen masuk & aplikasi terbuka). Karyawan melihat pemberitahuan bahwa lokasinya dibagikan. */
const GPSR = ['sales', 'kanvas', 'dropping'];
let GPSU = '', GMAP = null, GLAY = null, GSIG = '';
const gpsSt = (t) => { const m = t ? (Date.now() - t) / 6e4 : 1e9; return m <= 3 ? ['live', 'Live', '#16a34a'] : m <= 15 ? ['near', 'Baru saja', '#d97706'] : ['off', 'Tidak aktif', '#94a3b8']; };
function gpsKm(L) { let d = 0; for (let i = 1; i < L.length; i++) { const x = haversine(L[i - 1][1], L[i - 1][2], L[i][1], L[i][2]); if (x < 5000) d += x; } return d / 1000; }
function gpsTeam() {
  const m = new Map(), add = (n, r) => { if (n && GPSR.includes(r) && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), { n, r }); };
  (S.staff || []).forEach((u) => add(u.name, u.role)); (S.users || []).forEach((u) => add(u.n, u.r)); Object.values(S.locs || {}).forEach((l) => add(l.u, l.r));
  const td = dkey(Date.now());
  return [...m.values()].map((u) => {
    const loc = (S.locs || {})[u.n], tr = ((S.trail || {})[u.n] || []).filter((p) => dkey(p[0]) == td), st = gpsSt(loc && loc.t), ci = typeof openCI == 'function' ? openCI(u.n) : null;
    const vis = S.att.filter((a) => a.u == u.n && a.k == 'visit' && dkey(a.t) == td).length, omz = S.sales.filter((s) => s.u == u.n && dkey(s.t) == td).reduce((a, s) => a + netSale(s), 0);
    return { ...u, loc, tr, st, ci, vis, omz, km: gpsKm(tr) };
  }).sort((a, b) => ({ live: 0, near: 1, off: 2 }[a.st[0]] - { live: 0, near: 1, off: 2 }[b.st[0]]) || a.n.localeCompare(b.n));
}
VW.gps = () => {
  const T = gpsTeam(), live = T.filter((u) => u.st[0] == 'live').length;
  return `<div class="kp"><div class="cd k0"><small>Live sekarang</small><h2>${live} / ${T.length}</h2><small>sales · kanvas · dropping</small></div><div class="cd k1"><small>Jarak tempuh hari ini</small><h2>${T.reduce((a, u) => a + u.km, 0).toFixed(1)} km</h2><small>${T.reduce((a, u) => a + u.vis, 0)} kunjungan outlet</small></div></div>
<div class="cd gpsc"><div class="row" style="margin:0 0 8px"><b>${GPSU ? '🧭 Jejak ' + esc(GPSU) + ' hari ini' : '🛰️ Posisi tim'}</b><span class="wrap">${GPSU ? '<button class="gh" onclick="GPSU=\'\';R()">Semua</button>' : ''}<button class="gh" onclick="gpsRefresh(1)">⟳</button></span></div><div class="map gmap" id="gmap"></div>
<small class="mu" id="gupd">Diperbarui otomatis tiap ±20 detik</small></div>
<div class="cd">${T.map((u) => `<div class="trow gpr ${GPSU == u.n ? 'on' : ''}" onclick="GPSU=GPSU=='${esc(u.n)}'?'':'${esc(u.n)}';R()"><em class="tav" style="background:${u.st[2]}">${esc(u.n[0].toUpperCase())}</em><span class="ti"><b>${esc(u.n)} <small class="mu">· ${esc(ROLE[u.r] || u.r)}</small></b><small><b style="color:${u.st[2]}">● ${u.st[1]}</b> · ${u.loc ? agoTxt(u.loc.t) : 'belum ada posisi'}${u.loc && u.loc.acc ? ' · ±' + u.loc.acc + ' m' : ''}</small><small class="mu">${u.ci ? '🏬 di ' + esc(u.ci.cn) + ' sejak ' + hm(u.ci.t) : 'tidak sedang check-in'} · ${u.km.toFixed(1)} km · ${u.vis} kunjungan${u.omz ? ' · ' + rp(u.omz) : ''}</small></span>${u.loc ? `<a class="gh" onclick="event.stopPropagation()" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${u.loc.lat},${u.loc.lng}">Maps</a>` : ''}</div>`).join('') || '<p class="mu">Belum ada sales, kanvas, atau tim dropping.</p>'}</div>
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
    const ln = u.tr.map((p) => [p[1], p[2]]);
    if (ln.length > 1) L.polyline(ln, { color: GPSU ? '#22366e' : u.st[2], weight: GPSU ? 4 : 2.5, opacity: GPSU ? .85 : .45, dashArray: GPSU ? null : '4 6' }).addTo(GLAY);
    if (GPSU) for (const p of u.tr) if (p[3]) L.circleMarker([p[1], p[2]], { radius: 5, color: '#fff', weight: 1.5, fillColor: p[3] == 'visit' ? '#c9a24a' : '#22366e', fillOpacity: 1 }).bindTooltip((p[3] == 'visit' ? 'Check-in outlet' : p[3] == 'in' ? 'Absen masuk' : 'Absen pulang') + ' ' + hm(p[0])).addTo(GLAY);
    if (!u.loc) continue; pts.push([u.loc.lat, u.loc.lng]); ln.forEach((x) => GPSU && pts.push(x));
    const ic = L.divIcon({ className: 'gpin', html: `<span class="gp ${u.st[0]}" style="--c:${u.st[2]}"><b>${esc(u.n[0].toUpperCase())}</b></span><i>${esc(u.n)}</i>`, iconSize: [36, 36], iconAnchor: [18, 18] });
    L.marker([u.loc.lat, u.loc.lng], { icon: ic }).bindPopup(`<b>${esc(u.n)}</b> · ${esc(ROLE[u.r] || u.r)}<br>${u.st[1]} · ${agoTxt(u.loc.t)}<br>${u.ci ? '🏬 ' + esc(u.ci.cn) : 'Tidak check-in'}<br>${u.km.toFixed(1)} km · ${u.vis} kunjungan`).on('click', () => { GPSU = u.n; R(); }).addTo(GLAY);
  }
  if (fit && pts.length) { try { GMAP.fitBounds(L.latLngBounds(pts).pad(.25), { maxZoom: 16 }); } catch (e) { } }
  setTimeout(() => { try { GMAP && GMAP.invalidateSize(); } catch (e) { } }, 150);
  const g = $('#gupd'); if (g) g.textContent = 'Diperbarui ' + hm(Date.now()) + ' · otomatis tiap ±20 detik';
}
async function gpsRefresh(btn) { try { await sync(); } catch (e) { } if (V != 'gps') return; if (btn) return R(); const sig = JSON.stringify(S.locs || {}); if (sig != GSIG) { GSIG = sig; gpsDraw(false); } }
setInterval(() => { if (U && S && V == 'gps' && document.visibilityState != 'hidden' && !document.querySelector('.md')) gpsRefresh(); }, 20000);
