'use strict';
/* ============ DASHBOARD per peran ============ */
const todayR = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return [d.getTime(), d.getTime() + 864e5 - 1]; };
const monthR = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return [d.getTime(), Date.now() + 864e5]; };
const dayAgg = (n, filt) => days(n).map((d) => ({ l: d.l, v: S.sales.filter((s) => dkey(s.t) == d.k && (!filt || filt(s))).reduce((a, s) => a + netSale(s), 0) }));
const arTotal = () => S.sales.reduce((a, s) => a + sOut(s), 0);
const apTotal = () => S.ap.reduce((a, x) => a + apOut(x), 0);
const quick = (L) => `<div class="qk">${L.map((q) => `<button onclick="go('${q[0]}')"><b>${q[1]}</b><span>${q[2]}</span></button>`).join('')}</div>`;

/* ---------- TEMA aplikasi & MODEL beranda: diatur pemilik untuk semua karyawan, bisa diizinkan diganti sendiri ---------- */
const THEMES = [['modern', '💎', 'Modern', 'Ungu elegan, kartu membulat', ['#4f46e5', '#a855f7', '#f4f5fb']], ['klasik', '📜', 'Klasik', 'Huruf serif, cokelat & krem, kotak tegas', ['#7c4a1e', '#c8a46a', '#f6efe1']], ['robot', '🤖', 'Robot', 'Futuristik neon, gelap, huruf mesin', ['#00e5ff', '#7cff6b', '#05070d']], ['minimalis', '⬜', 'Minimalis', 'Putih bersih, hitam, tanpa bayangan', ['#111111', '#6b7280', '#ffffff']], ['mewah', '👑', 'Mewah', 'Hitam & emas', ['#d4af37', '#8a6d1d', '#0c0b09']], ['ceria', '🌈', 'Ceria', 'Warna-warni cerah, ramah', ['#ff6b6b', '#ffd93d', '#fff7ed']], ['alam', '🌿', 'Alam', 'Hijau segar & tenang', ['#047857', '#34d399', '#f0fdf4']]];
const DLAY = [['auto', '✨', 'Otomatis', 'Menyesuaikan peran & ukuran layar'], ['lengkap', '📊', 'Lengkap', 'Semua kartu, angka, grafik & analisis'], ['ringkas', '⚡', 'Ringkas', 'Kartu utama + tombol cepat + yang perlu perhatian'], ['angka', '🔢', 'Fokus angka', 'Kartu angka besar, tanpa grafik di atas'], ['grafik', '📈', 'Fokus grafik', 'Grafik & analisis langsung terbuka di atas'], ['lapangan', '🧭', 'Lapangan', 'Kunjungan outlet & check-in di paling atas']];
const dlKey = () => 'jpos:dlay:' + SID + ':' + (U ? U.n : ''), thKey = () => 'jpos:thm:' + SID + ':' + (U ? U.n : '');
const ownOk = () => U && (U.r == 'owner' || S.set.uiOwn !== false); // karyawan boleh mengganti sendiri?
function themeNow() { const p = ownOk() ? LS.get(thKey(), '') : ''; return p || (S && S.set.uiTheme) || 'modern'; }
function dlayNow() {
  const p = ownOk() ? LS.get(dlKey(), '') : '', v = p && p != 'org' ? p : ((S.set.uiModel || {})[U.r] || 'auto');
  if (v != 'auto') return v; if (innerWidth >= 1000) return 'lengkap'; return ['owner', 'admin', 'akuntan'].includes(U.r) ? 'lengkap' : ['sales', 'dropping'].includes(U.r) ? 'lapangan' : 'ringkas';
}
function applyUiTheme() { try { document.body.dataset.th = document.documentElement.dataset.th = U && S ? themeNow() : 'modern'; } catch (e) { } }
const thSw = (t) => `<span class="thsw">${t[4].map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
function dlayPick() {
  if (!ownOk()) return alertBox('Tema & model beranda diatur oleh pemilik toko untuk semua karyawan.', 'Diatur pemilik');
  const curT = LS.get(thKey(), ''), curL = LS.get(dlKey(), '');
  const m = modal(`<h3>🎨 Tampilan saya</h3><small class="mu">Hanya untuk akun Anda di perangkat ini.${U.r == 'owner' ? ' Untuk mengatur semua karyawan: Pengaturan → Tampilan semua karyawan.' : ''}</small>
<b style="font-size:13px">Tema</b><div class="mg pmg"><button data-t="" class="${!curT ? 'a' : ''}"><i>🏢</i><b>Ikuti toko</b><small>${esc((THEMES.find((x) => x[0] == (S.set.uiTheme || 'modern')) || THEMES[0])[2])}</small></button>${THEMES.map((x) => `<button data-t="${x[0]}" class="${curT == x[0] ? 'a' : ''}"><i>${x[1]}</i><b>${x[2]}</b>${thSw(x)}</button>`).join('')}</div>
<b style="font-size:13px">Model beranda</b><div class="mg pmg"><button data-l="" class="${!curL ? 'a' : ''}"><i>🏢</i><b>Ikuti toko</b><small>${esc((DLAY.find((x) => x[0] == ((S.set.uiModel || {})[U.r] || 'auto')) || DLAY[0])[2])}</small></button>${DLAY.map((x) => `<button data-l="${x[0]}" class="${curL == x[0] ? 'a' : ''}"><i>${x[1]}</i><b>${x[2]}</b><small>${x[3]}</small></button>`).join('')}</div>`, 'w');
  $$('[data-t]', m).forEach((b) => (b.onclick = () => { LS.set(thKey(), b.dataset.t); m.close(); R(); }));
  $$('[data-l]', m).forEach((b) => (b.onclick = () => { LS.set(dlKey(), b.dataset.l); m.close(); R(); }));
}
// pengaturan pemilik: tema & model untuk SEMUA karyawan
function uiOrgCard() {
  const th = S.set.uiTheme || 'modern', md = S.set.uiModel || {}, R0 = [['owner', 'Pemilik'], ['admin', 'Admin'], ['akuntan', 'Akuntan'], ['kasir', 'Kasir'], ['spg', 'SPG / SPB'], ['sales', 'Sales'], ['dropping', 'Dropping']];
  return `<div class="cd"><h3>🎨 Tampilan semua karyawan</h3><small class="mu">Tema aplikasi & model beranda yang dipakai di HP / laptop semua pengguna toko ini.</small>
<b style="font-size:13px;display:block;margin-top:8px">Tema aplikasi</b><div class="mg pmg" id="uthm">${THEMES.map((x) => `<button data-ut="${x[0]}" class="${th == x[0] ? 'a' : ''}"><i>${x[1]}</i><b>${x[2]}</b>${thSw(x)}<small>${x[3]}</small></button>`).join('')}</div>
<b style="font-size:13px;display:block;margin-top:8px">Model beranda per peran</b>${R0.map(([r, n]) => `<label class="row" style="margin:4px 0"><span>${n}</span><select data-um="${r}" style="width:auto">${DLAY.map((x) => `<option value="${x[0]}" ${(md[r] || 'auto') == x[0] ? 'selected' : ''}>${x[1]} ${x[2]}</option>`).join('')}</select></label>`).join('')}
<label class="row" style="margin:8px 0"><span>Izinkan karyawan mengganti tampilan sendiri</span><input type="checkbox" id="uown" style="width:24px;height:24px" ${S.set.uiOwn !== false ? 'checked' : ''}></label>
<button class="gh a" onclick="uiOrgSave()">Simpan untuk semua karyawan</button></div>`;
}
let UTH = null;
function uiOrgSave() { const md = {}; $$('[data-um]').forEach((s) => (md[s.dataset.um] = s.value)); emit('set', { set: { uiTheme: UTH || S.set.uiTheme || 'modern', uiModel: md, uiOwn: $('#uown').checked } }); toast('Tampilan semua karyawan disimpan — berlaku setelah sinkron'); LS.set(thKey(), ''); R(); }
document.addEventListener('click', (e) => { const b = e.target.closest('[data-ut]'); if (!b) return; UTH = b.dataset.ut; $$('[data-ut]').forEach((x) => x.classList.toggle('a', x == b)); document.body.dataset.th = document.documentElement.dataset.th = UTH; });
const dashWrap = (h) => { const l = dlayNow(), t = (THEMES.find((x) => x[0] == themeNow()) || THEMES[0]); return `<div class="dlay dl-${l}">${typeof tgtMini == 'function' && U.r != 'dropping' ? tgtMini() : ''}${S.srv && ['owner', 'admin'].includes(U.r) && S.tier != 'high' ? '<button class="cd kioshead" style="width:100%;text-align:left;cursor:pointer" onclick="startBuyerAsStore()"><b>🛒 Order stok ke ' + (S.tier == 'biasa' ? 'grosir / distributor' : 'distributor') + ' terdekat</b><br><small class="mu">Lihat stok ready, harga & diskon grosir, lalu pesan langsung atas nama toko Anda.</small></button>' : ''}<div class="dlbar"><button class="gh" onclick="dlayPick()">🎨 ${esc(t[2])} · ${esc((DLAY.find((x) => x[0] == l) || DLAY[1])[2])}${ownOk() ? '' : ' 🔒'}</button></div>${l == 'grafik' ? h.replace('<details class="more"', '<details class="more" open') : h}</div>`; };
VW.dash = () => (U.r == 'dropping' ? VW.kirim() : dashWrap(U.r == 'kasir' || U.r == 'spg' ? dashKasir() : U.r == 'sales' ? dashSales() : dashAdmin()));
VW.dash.after = () => { if (U.r == 'dropping') return VW.kirim.after(); if (teamMapPending) { teamMapPending = 0; setTimeout(drawTeamMap, 60); } };

/* ---- pantau lokasi & kehadiran tim lapangan (untuk owner/admin) ---- */
let teamMapPending = 0, tmap = null;
const agoTxt = (t) => { if (!t) return 'belum pernah'; const m = Math.floor((Date.now() - t) / 6e4); return m < 1 ? 'baru saja' : m < 60 ? m + ' mnt lalu' : m < 1440 ? Math.floor(m / 60) + ' jam lalu' : dstr(t); };
function teamStatus() {
  const field = (S.srv ? (S.staff || []).map((u) => ({ name: u.name, role: u.role })) : S.users.map((u) => ({ name: u.n, r: u.r }))).map((u) => ({ name: u.name, role: u.role || u.r }))
    .filter((u) => u.role == 'sales' || u.role == 'kasir' || u.role == 'dropping');
  const td = dkey(Date.now()), locs = S.locs || {};
  return field.map((u) => {
    const at = S.att.filter((a) => a.u == u.name && dkey(a.t) == td), inn = at.filter((a) => a.k == 'in').sort((a, b) => a.t - b.t)[0], out = at.filter((a) => a.k == 'out').sort((a, b) => b.t - a.t)[0];
    const vis = S.att.filter((a) => a.k == 'visit' && a.u == u.name && dkey(a.t) == td), lastV = vis.sort((a, b) => b.t - a.t)[0], loc = locs[u.name];
    const sales = S.sales.filter((s) => s.u == u.name && dkey(s.t) == td), omz = sales.reduce((a, s) => a + netSale(s), 0);
    const clockedIn = inn && !out, live = loc && Date.now() - loc.t < 12 * 6e4;
    let st = 'off', lbl = 'Belum absen';
    if (clockedIn) { st = live ? 'on' : 'idle'; lbl = live ? 'Aktif di lapangan' : 'Absen, sinyal lama'; }
    else if (out) { st = 'done'; lbl = 'Sudah pulang'; }
    return { ...u, inn, out, clockedIn, loc, live, lastV, visN: vis.length, omz, sales: sales.length, st, lbl };
  }).sort((a, b) => ({ on: 0, idle: 1, off: 2, done: 3 }[a.st] - { on: 0, idle: 1, off: 2, done: 3 }[b.st]));
}
function teamCard() {
  const T = teamStatus(); if (!T.length) return '';
  teamMapPending = T.some((u) => u.loc) ? 1 : 0;
  const on = T.filter((u) => u.st == 'on').length, mangkir = T.filter((u) => u.st == 'idle' || (hrNow() >= 9 && hrNow() < 16 && u.st == 'off'));
  const dot = { on: '#00b894', idle: '#ff9f43', off: '#b2bec3', done: '#54a0ff' };
  return `<div class="cd"><div class="row" style="margin:0 0 4px"><h3 style="margin:0">📍 Lokasi & kehadiran tim</h3><small class="mu">${on}/${T.length} aktif</small></div>
<small class="mu">Posisi dibagikan oleh HP karyawan selama jam kerja (setelah absen masuk &amp; aplikasi dibuka).</small>
${teamMapPending ? '<div class="map" id="tmap" style="margin-top:8px"></div>' : ''}
${mangkir.length ? `<div class="warnbox">⚠️ ${mangkir.length} perlu dicek: ${mangkir.map((u) => esc(u.name)).join(', ')} — belum terlihat aktif di jam kerja.</div>` : ''}
<div class="tlist">${T.map((u) => `<div class="trow"><em class="tav" style="background:${dot[u.st]}">${esc(u.name[0].toUpperCase())}</em><span class="ti"><b>${esc(u.name)} <small class="mu">· ${u.role}</small></b><small class="mu">${u.lbl}${u.inn ? ' · masuk ' + hm(u.inn.t) : ''}${u.out ? ' · pulang ' + hm(u.out.t) : ''}</small><small class="mu">${u.visN ? '🏬 ' + u.visN + ' kunjungan' : 'belum berkunjung'}${u.sales ? ' · ' + u.sales + ' order (' + rp(u.omz) + ')' : ''}${u.loc ? ' · 📍 ' + agoTxt(u.loc.t) : ''}</small></span>${u.loc ? `<a class="gh" href="https://www.google.com/maps?q=${u.loc.lat},${u.loc.lng}" target="_blank" rel="noopener">Peta</a>` : ''}</div>`).join('')}</div></div>`;
}
const hrNow = () => new Date().getHours();
function drawTeamMap() {
  const el = $('#tmap'); if (!el || !window.L) return; const T = teamStatus().filter((u) => u.loc);
  if (tmap) { tmap.remove(); tmap = null; } if (!T.length) { el.innerHTML = '<p class="mu" style="padding:14px">Belum ada posisi diterima.</p>'; return; }
  tmap = L.map(el).setView([T[0].loc.lat, T[0].loc.lng], 13); tiles(tmap);
  const col = { on: '#00b894', idle: '#ff9f43', off: '#b2bec3', done: '#54a0ff' };
  const g = L.featureGroup(T.map((u) => L.circleMarker([u.loc.lat, u.loc.lng], { radius: 9, color: '#fff', weight: 2, fillColor: col[u.st], fillOpacity: 1 }).bindPopup(`<b>${esc(u.name)}</b><br>${esc(u.lbl)}<br>📍 ${agoTxt(u.loc.t)}${u.lastV ? '<br>Terakhir: ' + esc(u.lastV.cn || '') : ''}`).bindTooltip(esc(u.name), { permanent: true, direction: 'top', className: 'tmt' }))).addTo(tmap);
  tmap.fitBounds(g.getBounds().pad(0.3), { maxZoom: 15 }); setTimeout(() => { try { tmap && document.body.contains(tmap._container) && tmap.invalidateSize(); } catch (e) { } }, 200);
}

const greet = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
const todayLong = () => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
const spark = (vals) => { const mx = Math.max(1, ...vals), w = 100, h = 30, pts = vals.map((v, i) => [(i / Math.max(1, vals.length - 1)) * w, h - (v / mx) * (h - 4) - 2]); const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); return `<svg class="spk" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d} L${w} ${h} L0 ${h}Z" fill="#ffffff26"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`; };
const heroCard = (title, val, sub, chg, extra, vals) => `<div class="cd hero hero2"><div class="row" style="margin:0;align-items:flex-start"><span><b class="hg">${greet()}, ${esc(U.n)} 👋</b><br><small>${todayLong()}</small></span><span class="hbadge">${esc({ owner: 'Pemilik', admin: 'Admin', akuntan: 'Akuntan', kasir: 'Kasir', sales: 'Sales', dropping: 'Dropping' }[U.r] || U.r)}</span></div>
<div class="hmain"><span><small>${title}</small><h2>${val}</h2><small>${sub}${chg != null ? ` <b class="hchip">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg)}%</b>` : ''}</small></span>${vals ? spark(vals) : ''}</div>${extra ? `<div class="hsplit">${extra.map((x) => `<span><small>${x[0]}</small><b>${x[1]}</b></span>`).join('')}</div>` : ''}</div>`;
const tiles2 = (L) => `<div class="qt2">${L.filter((q) => can(q[0])).map((q) => `<button onclick="${q[3] || `go('${q[0]}')`}"><i style="--c:${q[4] || '#5b4cdb'}">${q[1]}</i><span>${q[2]}</span>${q[5] ? `<em>${q[5]}</em>` : ''}</button>`).join('')}</div>`;
const lineItem = (ic, col, l, sub, v, cls, on) => `<button class="li2" ${on ? `onclick="${on}"` : ''}><i style="--c:${col}">${ic}</i><span><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</span><b class="${cls || ''}">${v}</b>${on ? '<u>›</u>' : ''}</button>`;
const pctCh = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
function dashAdmin() {
  const [t0, t1] = todayR(), [m0, m1] = monthR(), A = salesAgg(t0, t1), M = salesAgg(m0, m1), L = lr(m0, m1), Y = salesAgg(t0 - 864e5, t0 - 1);
  const low = S.p.filter((p) => !p.x && p.st <= (p.min ?? 10)), od = S.c.filter((c) => !c.x && overdue(c.id) > 0).sort((a, b) => overdue(b.id) - overdue(a.id));
  const cats = Object.entries(M.byC).map(([k, v]) => ({ l: k, v: v.v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const prods = Object.entries(M.byP).map(([k, v]) => ({ l: k, v: v.v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const users = Object.entries(M.byU).map(([k, v]) => ({ l: k, v: v.v })).sort((a, b) => b.v - a.v);
  const hadir = S.att.filter((a) => a.k == 'in' && dkey(a.t) == dkey(Date.now())).length, d7 = dayAgg(7).map((d) => d.v);
  const onl = typeof ONL != 'undefined' && S.srv ? ONL.orders.filter(needAct).length : 0, odSum = od.reduce((a, c) => a + overdue(c.id), 0);
  const dq = can('kirim') ? deliveries().filter((x) => dlSt(x) == 'baru').length : 0, dgo = can('kirim') ? deliveries().filter((x) => ['tugas', 'ambil', 'jalan', 'tiba'].includes(dlSt(x))).length : 0;
  const fl = can('aud') ? S.att.filter((a) => dkey(a.t) == dkey(Date.now()) && (fxTxt(a).length || (a.dist != null && a.dist > CIR()))).length + (S.sec || []).filter((x) => dkey(x.t) == dkey(Date.now())).length : 0;
  const poW = can('beli') ? (S.po || []).filter((x) => x.st == 'dipesan' || x.st == 'sebagian').length : 0, apOd = (can('beli') || can('keu')) ? S.ap.filter((a) => apOut(a) > 0 && a.due < Date.now()) : [];
  const todo = [
    fl ? lineItem('🛡️', '#e17055', fl + ' catatan mencurigakan hari ini', 'Jam HP diubah, wajah tidak cocok, lokasi janggal', 'Audit', 'rd', "go('aud')") : '',
    dq ? lineItem('🚚', '#e17055', dq + ' order menunggu pengantaran', dgo + ' sedang diantar', 'Papan', 'or', "go('kirim')") : '',
    apOd.length ? lineItem('🏦', '#ff5d73', apOd.length + ' utang supplier lewat tempo', apOd.slice(0, 2).map((a) => esc(a.sup)).join(', '), rp(apOd.reduce((t, a) => t + apOut(a), 0)), 'rd', can('beli') ? "bTab='ut';go('beli')" : "go('keu')") : '',
    poW ? lineItem('📥', '#6c5ce7', poW + ' PO menunggu barang', 'Terima barang saat tiba', 'Lihat', '', "bTab='po';go('beli')") : '',
    onl ? lineItem('🛍️', '#ff6b6b', onl + ' pesanan online baru', 'Segera konfirmasi agar pembeli tidak menunggu', 'Proses', 'or', "ONL.tab='ord';go('onl')") : '',
    od.length ? lineItem('⏰', '#ff5d73', od.length + ' outlet lewat jatuh tempo', od.slice(0, 3).map((c) => esc(c.n)).join(', '), rp(odSum), 'rd', "oSort='debt';go('outlet')") : '',
    low.length ? lineItem('📦', '#ff9f43', low.length + ' produk stok menipis', low.slice(0, 3).map((p) => esc(p.n) + ' (' + p.st + ')').join(', '), 'Lihat', 'or', can('ana') ? "ANA.tab='stok';go('ana')" : "go('prod')") : '',
  ].filter(Boolean);
  const Q = [['pos', '🛒', 'Kasir', 0, '#5b4cdb'], ...(can('onl') && S.srv ? [['onl', '🛍️', 'Online', 0, '#ff6b6b', onl || '']] : []), ['prod', '📦', 'Produk', 0, '#ff9f43'], ['outlet', '📍', 'Outlet', 0, '#00b894'], ...(can('beli') ? [['beli', '📥', 'Beli', 0, '#6c5ce7', poW || '']] : []), ...(can('kirim') ? [['kirim', '🚚', 'Antar', 0, '#e17055', dq || '']] : []), ['lap', '📊', 'Laporan', 0, '#54a0ff'], ['abs', '🕒', 'Absen', 0, '#20bf6b'], ...(can('kas') ? [['kas', '📘', 'Kas', 0, '#00a58e']] : []), ...(can('aud') ? [['aud', '🛡️', 'Audit', 0, '#e84393', fl || '']] : []), ['keu', '🧾', 'Keuangan', 0, '#fd9644'], ['chat', '💬', 'Chat', 0, '#4b7bec'], ['set', '⚙️', 'Pengaturan', 0, '#778ca3']].filter((x, i, a) => a.findIndex((y) => y[0] == x[0]) == i && can(x[0])).slice(0, 8);
  const rk = (v) => (innerWidth >= 760 ? rp(v) : Math.abs(v) >= 1e9 ? 'Rp' + (v / 1e9).toFixed(1).replace('.', ',') + ' M' : Math.abs(v) >= 1e6 ? 'Rp' + (v / 1e6).toFixed(1).replace('.', ',') + ' jt' : rp(v));
  const kpi = (ic, c, l, v, sub, on) => `<button class="kpi" style="--c:${c}" ${on ? `onclick="${on}"` : ''}><i>${ic}</i><span><small>${l}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</span></button>`;
  const K = `<div class="kpis">${kpi('💵', '#10b981', 'Kas + Bank', rk(bal('1101') + bal('1102')), 'uang tersedia', can('kas') ? "go('kas')" : '')}${kpi('📈', '#6366f1', 'Laba bersih bulan ini', rk(L.laba), L.laba < 0 ? 'rugi' : 'setelah beban', can('lap') ? "go('lap')" : '')}${kpi('🧾', '#f59e0b', 'Piutang outlet', rk(arTotal()), od.length ? od.length + ' lewat tempo' : 'aman', "oSort='debt';go('outlet')")}${kpi('📦', '#3b82f6', 'Stok layak jual', rk(stockValue()), (low.length ? low.length + ' menipis' : S.p.filter((p) => !p.x).length + ' produk') + (badUnits() ? ' · bad ' + badUnits() : ''), "go('prod')")}</div>`;
  return `<div class="dtop">` + heroCard('Omzet hari ini', rp(A.net), A.n + ' transaksi', pctCh(A.net, Y.net), [['Laba kotor', rp(A.profit)], ['Bulan ini', rp(M.net)], ['Hadir', hadir + ' orang']], d7) + K + `</div>`
    + tiles2(Q)
    + `<div class="cd todo"><div class="row" style="margin:0 0 6px"><h3 style="margin:0">Perlu perhatian</h3><small class="mu">${todo.length || ''}</small></div>${todo.slice(0, 4).join('') || '<div class="okbox">✨ Semua aman hari ini</div>'}</div>`
    + visitCard(false)
    + `<details class="more" ${innerWidth >= 760 ? 'open' : ''}><summary>Lihat analisis lengkap</summary>`
    + `<div class="cd"><h3>💼 Posisi keuangan</h3>${lineItem('💵', '#00b894', 'Kas + Bank', 'uang tersedia', rp(bal('1101') + bal('1102')), 'gr')}${lineItem('📈', '#5b4cdb', 'Laba bersih bulan ini', 'setelah semua beban', rp(L.laba), L.laba < 0 ? 'rd' : '')}${lineItem('🧾', '#ff9f43', 'Piutang outlet', od.length + ' jatuh tempo', rp(arTotal()), '', can('lap') ? "go('lap')" : '')}${lineItem('🏦', '#ff5d73', 'Utang usaha', 'ke supplier', rp(apTotal()))}${lineItem('📦', '#54a0ff', 'Stok layak jual', S.p.filter((p) => !p.x).length + ' produk', rp(stockValue()))}${badUnits() ? lineItem('🗑️', '#ef4444', 'Bad stock', badUnits() + ' unit menunggu pemusnahan / sortir', rp(badValue()), 'rd', "RTO.tab='bad';go('retur')") : ''}</div>`
    + `<div class="cd"><div class="row" style="margin:0"><h3 style="margin:0">Omzet 14 hari terakhir</h3><small class="mu">${M.n} transaksi bulan ini</small></div>${area(dayAgg(14))}</div>`
    + `<div class="two"><div class="cd"><h3>🏆 Produk terlaris bulan ini</h3>${bars(prods, rp)}</div><div class="cd"><h3>Penjualan per kategori</h3>${donut(cats)}</div></div>`
    + teamCard()
    + `<div class="cd"><h3>👥 Kinerja tim bulan ini</h3>${bars(users, rp)}<small class="mu">Kehadiran hari ini: ${hadir} orang</small></div></details>`;
}
const shareBanner = () => { if (LOCMUST()) return `<div class="sharebar"><span>📍 Lokasi Anda dibagikan ke pemilik toko selama jam kerja (wajib untuk peran ${esc(ROLE[U.r])})</span></div>`; const on = LS.get('jpos:sharing', '1') != '0'; return `<div class="sharebar ${on ? '' : 'offb'}"><span>📍 ${on ? 'Lokasi Anda dibagikan ke pemilik toko selama jam kerja' : 'Berbagi lokasi dimatikan'}</span><button onclick="toggleShare()">${on ? 'Matikan' : 'Aktifkan'}</button></div>`; };
function toggleShare() { if (LOCMUST()) return toast('Berbagi lokasi wajib untuk peran Anda'); const on = LS.get('jpos:sharing', '1') != '0'; LS.set('jpos:sharing', on ? '0' : '1'); if (!on) locPing(1); toast(on ? 'Berbagi lokasi dimatikan' : 'Berbagi lokasi diaktifkan'); R(); }

function dashKasir() {
  const [t0, t1] = todayR(), mine = S.sales.filter((s) => s.u == U.n && s.t >= t0 && s.t <= t1), tot = mine.reduce((a, s) => a + s.tot - (s.rtot || 0), 0), cash = mine.filter((s) => s.pay == 'Tunai').reduce((a, s) => a + s.tot - (s.rtot || 0), 0);
  const td = myToday(), last = td[td.length - 1], inn = last && last.k == 'in', byPay = {}; mine.forEach((s) => { const k = s.pay == 'Piutang' ? 'Kredit' : s.pay; byPay[k] = (byPay[k] || 0) + s.tot - (s.rtot || 0); });
  return shareBanner() + heroCard('Penjualan Anda hari ini', rp(tot), mine.length + ' transaksi', null, [['Tunai di laci', rp(cash)], ['Rata-rata', rp(mine.length ? tot / mine.length : 0)], ['Status', inn ? 'Sudah absen' : 'Belum absen']])
    + (U.r == 'spg' && typeof spgTasks == 'function' ? spgTasks() : '')
    + (typeof myCal == 'function' ? myCal() : '')
    + tiles2([['pos', '🛒', 'Mulai jual', 0, '#5b4cdb'], ['his', '🧾', 'Riwayat', 0, '#54a0ff'], ['abs', '🕒', inn ? 'Absen pulang' : 'Absen masuk', 0, '#20bf6b'], ['chat', '💬', 'Chat', 0, '#4b7bec']])
    + `<div class="cd"><div class="row"><span><b>Tutup kasir</b><br><small class="mu">Rekap setoran shift hari ini</small></span><button class="gh a" onclick="tutupKasir()">Rekap shift</button></div></div>`
    + `<details class="more"><summary>Lihat rincian</summary><div class="cd"><h3>Metode pembayaran hari ini</h3>${donut(Object.entries(byPay).map(([l, v]) => ({ l, v })), 'metode')}</div>`
    + `<div class="cd"><h3>Transaksi terakhir</h3>${mine.slice(-6).reverse().map((s) => row(esc(s.no) + ' <small class="mu">' + hm(s.t) + ' · ' + esc(s.cn || 'Umum') + '</small>', rp(s.tot))).join('') || '<p class="mu">Belum ada transaksi hari ini</p>'}</div></details>`;
}

function dashSales() {
  const [t0, t1] = todayR(), [m0, m1] = monthR(), mine = (a, b) => S.sales.filter((s) => s.u == U.n && s.t >= a && s.t <= b);
  const mm = mine(m0, m1), omz = mm.reduce((a, s) => a + netSale(s), 0), vis = S.att.filter((a) => a.k == 'visit' && a.u == U.n);
  const vToday = vis.filter((a) => a.t >= t0 && a.t <= t1).length, vMonth = vis.filter((a) => a.t >= m0).length;
  const myc = S.c.filter((c) => !c.x && (c.sl == U.n || S.sales.some((s) => s.u == U.n && s.cu == c.id))), ar = myc.reduce((a, c) => a + outOf(c.id), 0);
  const perC = {}; mm.forEach((s) => { const k = s.cn || 'Umum'; perC[k] = (perC[k] || 0) + netSale(s); });
  const lastV = {}; vis.forEach((v) => (lastV[v.cid] = Math.max(lastV[v.cid] || 0, v.t)));
  const due = myc.filter((c) => !lastV[c.id] || Date.now() - lastV[c.id] > 14 * 864e5).slice(0, 5);
  return shareBanner() + ciBar() + heroCard('Omzet Anda bulan ini', rp(omz), mm.length + ' order', null, [['Order hari ini', mine(t0, t1).length], ['Kunjungan', vToday + ' hari ini'], ['Outlet saya', myc.length]], dayAgg(7, (s) => s.u == U.n).map((d) => d.v))
    + visitCard(true)
    + tiles2([['outlet', '➕', 'Outlet baru', 'go(\'outlet\');setTimeout(()=>outletForm(),80)', '#00b894'], ['outlet', '📍', 'Outlet & peta', 0, '#5b4cdb'], ['pos', '📝', 'Buat order', 0, '#ff9f43'], ['abs', '🕒', 'Absen', 0, '#20bf6b'], ['retur', '↩️', 'Ambil retur', 0, '#ef4444']])
    + `<div class="cd">${lineItem('🧾', '#ff9f43', 'Piutang outlet saya', 'tagih saat kunjungan', rp(ar), ar ? 'or' : '', "oSort='debt';go('outlet')")}${lineItem('🚶', '#5b4cdb', 'Kunjungan bulan ini', 'check-in di outlet', vMonth)}</div>`
    + (() => { if (!can('ana')) return ''; const P = reorderPlan(true).filter((x) => x.st != 'aman'); return P.length ? `<div class="cd info"><div class="row" style="margin:0"><span><b>🎯 Saran order hari ini</b><br><small>${P.length} outlet perlu dikunjungi · potensi ${rp(P.reduce((a, x) => a + x.val, 0))}</small></span><button class="gh a" onclick="ANA.tab='order';go('ana')">Lihat</button></div><small class="mu">${P.slice(0, 3).map((x) => esc(x.c.n)).join(', ')}${P.length > 3 ? '…' : ''}</small></div>` : ''; })()
    + `<details class="more"><summary>Lihat rincian</summary><div class="cd"><h3>Omzet saya 14 hari</h3>${area(dayAgg(14, (s) => s.u == U.n))}</div>`
    + `<div class="two"><div class="cd"><h3>Outlet teratas bulan ini</h3>${bars(Object.entries(perC).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6), rp)}</div><div class="cd"><h3>Belum dikunjungi 14 hari+</h3>${due.map((c) => `<div class="row"><span>${esc(c.n)}</span><button class="gh" onclick="go('outlet');setTimeout(()=>outletDetail('${esc(c.id)}'),50)">Lihat</button></div>`).join('') || '<p class="mu">Semua outlet sudah dikunjungi 👍</p>'}</div></div></details>`;
}

function tutupKasir() {
  const [t0, t1] = todayR(), mine = S.sales.filter((s) => s.u == U.n && s.t >= t0 && s.t <= t1), by = {};
  mine.forEach((s) => { const k = s.pay == 'Piutang' ? 'Kredit' : s.pay; by[k] = (by[k] || 0) + s.tot - (s.rtot || 0); });
  const pays = S.sales.flatMap((s) => (s.pays || []).filter((p) => p.u == U.n && p.t >= t0 && p.t <= t1)), pc = pays.filter((p) => p.m == 'Tunai').reduce((a, p) => a + p.amt, 0);
  const dp = mine.filter((s) => s.pay == 'Piutang' && (s.dpm || 'Tunai') == 'Tunai').reduce((a, s) => a + (s.dpay || 0), 0);
  const cash = (by.Tunai || 0) + pc + dp, tot = Object.values(by).reduce((a, v) => a + v, 0);
  const txt = [`REKAP KASIR — ${S.name}`, `${U.n} · ${dstr(Date.now())} ${hm(Date.now())}`, '-'.repeat(28), `Transaksi: ${mine.length}`, ...Object.entries(by).map(([k, v]) => `${k}: ${rp(v)}`), `Pelunasan piutang tunai: ${rp(pc)}`, `DP kredit tunai: ${rp(dp)}`, '-'.repeat(28), `TOTAL PENJUALAN: ${rp(tot)}`, `UANG TUNAI DI LACI: ${rp(cash)}`].join('\n');
  const m = modal(`<h3>Rekap shift · ${esc(U.n)}</h3>${row('Transaksi', mine.length)}${Object.entries(by).map(([k, v]) => row(esc(k), rp(v))).join('')}${row('Pelunasan piutang (tunai)', rp(pc))}${row('DP kredit (tunai)', rp(dp))}<hr style="border:0;border-top:1px dashed var(--bd);width:100%">${row('<b>Total penjualan</b>', rp(tot))}${row('<b>Uang tunai seharusnya di laci</b>', '<span class="gr">' + rp(cash) + '</span>')}<input id="kc" type="number" placeholder="Uang tunai dihitung (opsional)"><small id="ks" class="mu"></small><div class="fm2"><button class="gh" id="sh">Bagikan / kirim WA</button><button class="gh" id="cl">Tutup</button></div>`);
  $('#kc', m).oninput = (e) => { const d = num(e.target.value) - cash; $('#ks', m).innerHTML = e.target.value ? (d == 0 ? '<b class="gr">Pas ✓</b>' : d > 0 ? '<b class="or">Lebih ' + rp(d) + '</b>' : '<b class="rd">Kurang ' + rp(-d) + '</b>') : ''; };
  $('#sh', m).onclick = () => shareText('Rekap kasir', txt + ($('#kc', m).value ? '\nDihitung: ' + rp(num($('#kc', m).value)) : '')); $('#cl', m).onclick = () => m.close();
}

/* ============ HEAD ADMIN (pemilik aplikasi) ============ */
const HA = { d: null, stores: [], q: '', f: 'all', cfg: null, err: '' };
const PLANS = [['trial', 'Trial'], ['bulanan', 'Bulanan'], ['3bulan', '3 Bulan'], ['tahunan', 'Tahunan'], ['premium', 'Premium']];
const planName = (p) => (PLANS.find((x) => x[0] == p) || [p, p || '-'])[1];
const sDays = (s) => (s.exp ? calDays(s.exp) : null);
const sState = (s) => (s.status != 'active' ? 'sus' : sDays(s) == null ? 'ok' : sDays(s) < 0 ? 'exp' : sDays(s) <= 7 ? 'soon' : 'ok');
const expChip = (s) => { const d = sDays(s), st = sState(s); return st == 'sus' ? '<span class="chip r">Suspend</span>' : d == null ? '<span class="chip">-</span>' : d < 0 ? `<span class="chip r">Habis ${-d} hr lalu</span>` : d <= 7 ? `<span class="chip o">${d == 0 ? 'berakhir hari ini' : d + ' hari lagi'}</span>` : `<span class="chip g">${d} hari lagi</span>`; };
const waLink = (no, txt) => 'https://wa.me/' + String(no || '').replace(/^0/, '62').replace(/\D/g, '') + '?text=' + encodeURIComponent(txt);
async function haLoad() {
  try {
    const [st, ss, cf] = await Promise.all([haApi('/api/admin/stats?tz=' + -new Date().getTimezoneOffset() / 60), haApi('/api/admin/stores'), haApi('/api/admin/cfg')]);
    HA.d = st; HA.stores = ss.stores; HA.cfg = cf; HA.err = ''; HT && R();
  } catch (e) { if (e.status == 401) { haOut(); toast('Sesi berakhir, login ulang'); } else { HA.err = e.message; R(); } }
}
function haOut() { HT = ''; sessionStorage.removeItem('jpos:ht'); HA.d = null; R(); }
const fill14 = (rows) => days(14).map((d) => ({ l: d.l, v: (rows.find((r) => r.d == d.k) || {}).v || 0 }));
function haView() {
  if (!HA.d) return `<div class="cd">${HA.err ? '<p class="rd">' + esc(HA.err) + '</p><button class="gh" onclick="haLoad()">Coba lagi</button>' : '<p class="mu">Memuat data…</p>'}</div>`;
  const t = HA.d.totals, q = HA.q.toLowerCase(), F = { all: () => 1, ok: (s) => sState(s) == 'ok', soon: (s) => sState(s) == 'soon', exp: (s) => sState(s) == 'exp', sus: (s) => sState(s) == 'sus', trial: (s) => s.plan == 'trial' };
  const L = HA.stores.filter((s) => F[HA.f](s) && (!q || (s.name + s.id + s.owner + (s.email || '') + (s.phone || '')).toLowerCase().includes(q)));
  const cnt = (f) => HA.stores.filter(F[f]).length;
  return kpi([['Toko terdaftar', t.stores, t.active + ' aktif'], ['Masa coba (trial)', t.trial], ['Berbayar aktif', t.paid], ['Akan habis ≤7 hari', t.soon], ['Sudah habis', t.expired], ['Total pengguna', t.users], ['Omzet semua toko', rp(t.omzet)], ['Transaksi', t.tx], ['Pembeli online', t.buyers || 0], ['Toko buka online', t.shops || 0], ['Pesanan online', t.orders || 0], ['Nilai pesanan selesai', rp(t.gmv || 0)]])
    + `<div class="cd"><h3>Daftar toko</h3><input placeholder="Cari nama / kode / pemilik / no. HP" value="${esc(HA.q)}" onchange="HA.q=this.value;R()"><div class="seg">${[['all', 'Semua'], ['trial', 'Trial'], ['soon', 'Akan habis'], ['exp', 'Habis'], ['sus', 'Suspend']].map((x) => `<button class="${HA.f == x[0] ? 'a' : ''}" onclick="HA.f='${x[0]}';R()">${x[1]} (${cnt(x[0])})</button>`).join('')}</div>
${L.map((s) => `<div class="sc"><div class="row" style="margin:0"><span><b>${esc(s.name)}</b> <span class="chip">${esc(planName(s.plan))}</span> <span class="chip o">${esc(tierName(s.tier))}</span><br><small class="mu">Kode <b>${esc(s.id)}</b> · ${esc(s.owner || '')}${s.phone ? ' · ' + esc(s.phone) : ''}</small></span>${expChip(s)}</div><small class="mu">Daftar ${dstr(s.created)} · aktif s/d ${s.exp ? dstr(s.exp) : '-'} · ${s.users} user · ${s.tx} trx · ${rp(s.omzet)}${s.last ? ' · terakhir ' + dstr(s.last) : ''}</small><div class="wrap" style="margin-top:6px"><button class="gh a" onclick="haExt('${esc(s.id)}',30)">+30 hari</button><button class="gh" onclick="haStore('${esc(s.id)}')">Kelola</button>${s.phone ? `<a class="gh" target="_blank" href="${esc(waLink(s.phone, 'Halo ' + (s.owner || '') + ', terkait aplikasi J-POS toko ' + s.name + ' (kode ' + s.id + ')'))}">WhatsApp</a>` : ''}</div></div>`).join('') || '<p class="mu">Tidak ada toko</p>'}</div>`
    + `<div class="cd"><h3>Omzet seluruh toko · 14 hari</h3>${area(fill14(HA.d.daily))}</div>`
    + `<div class="two"><div class="cd"><h3>Pendaftaran toko baru</h3>${vbars(fill14(HA.d.signups), (v) => v)}</div><div class="cd"><h3>Toko teratas (30 hari)</h3>${bars(HA.d.top.map((x) => ({ l: x.name, v: x.v })), rp)}</div></div>`
    + `<div class="cd"><h3>Pengaturan langganan</h3><div class="fm"><label><small class="mu">No. WhatsApp Anda (tampil saat masa aktif toko habis)</small><input id="cw" inputmode="tel" placeholder="62812xxxx" value="${esc(HA.cfg ? HA.cfg.wa : '')}"></label><label><small class="mu">Info harga / cara bayar</small><textarea id="cp" rows="3" placeholder="Contoh: Rp99.000/bulan · Rp999.000/tahun. Transfer BCA 123… a.n. …">${esc(HA.cfg ? HA.cfg.price : '')}</textarea></label><label><small class="mu">Lama masa coba toko baru (hari)</small><input id="ctd" type="number" min="1" max="365" value="${HA.cfg ? HA.cfg.trial_days : 30}"></label><button class="pr" onclick="haCfg()">Simpan pengaturan</button></div></div>`
    + haPkgCard() + (typeof haGwCard == 'function' ? haGwCard() : '')
    + (() => { const sc = (HA.cfg && HA.cfg.ship) || {}; const f = (id, lb, v, st) => `<label><small class="mu">${lb}</small><input id="${id}" type="number" step="${st || 1}" value="${v ?? ''}"></label>`; const ex = (km) => Math.ceil(Math.max(sc.min || 0, (sc.base || 0) + km * 1000 * (sc.road || 1) * (sc.per_m || 0)) / (sc.round || 1)) * (sc.round || 1);
      return `<div class="cd"><h3>🚚 Ongkir pasar online (kurir instan)</h3><small class="mu">Rumus: tarif dasar + (jarak lurus × faktor jalan) × tarif per meter, minimal & dibulatkan. Dipakai untuk Kurir toko, GoSend & GrabExpress.</small><div class="fm2" style="margin-top:8px">${f('s1', 'Tarif dasar (Rp)', sc.base)}${f('s2', 'Tarif per meter (Rp)', sc.per_m, 0.1)}${f('s3', 'Faktor jalan (×)', sc.road, 0.05)}${f('s4', 'Ongkir minimal (Rp)', sc.min)}${f('s5', 'Jarak maksimal (km)', sc.max_km)}${f('s6', 'Pembulatan (Rp)', sc.round)}</div><small class="mu">Contoh: 1 km ≈ ${rp(ex(1))} · 3 km ≈ ${rp(ex(3))} · 10 km ≈ ${rp(ex(10))}</small><button class="pr" style="margin-top:8px" onclick="haShip()">Simpan tarif ongkir</button></div>`; })()
    + `<div class="cd"><h3>Siaran ke semua toko</h3><textarea id="an" maxlength="500" rows="2" placeholder="Pengumuman (tampil di chat 'Semua toko')"></textarea><button class="pr" style="margin-top:8px" onclick="haAnn()">Kirim pengumuman</button></div>`
    + `<div class="cd"><h3>Akun Head Admin</h3><div class="fm"><small class="mu">Username saat ini: <b>${esc(HA.cfg ? HA.cfg.user : '')}</b></small><input id="pu" placeholder="Username baru (opsional)" autocapitalize="none"><input id="po" type="password" placeholder="Password lama"><input id="pn" type="password" placeholder="Password baru (min 10 karakter)"><button class="gh a" onclick="haPass()">Ganti password</button></div></div>`;
}
async function haPatch(id, body, msg) { try { await haApi('/api/admin/stores/' + id, { method: 'PATCH', body: JSON.stringify(body) }); toast(msg || 'Tersimpan'); await haLoad(); return true; } catch (e) { toast(e.message); } }
const haExt = (id, d) => haPatch(id, { add_days: d }, 'Masa aktif diperpanjang ' + d + ' hari');
async function haCfg() { try { HA.cfg = await haApi('/api/admin/cfg', { method: 'PUT', body: JSON.stringify({ wa: $('#cw').value, price: $('#cp').value, trial_days: num($('#ctd').value) }) }); toast('Pengaturan disimpan'); } catch (e) { toast(e.message); } }
async function haPass() { try { await haApi('/api/admin/password', { method: 'POST', body: JSON.stringify({ user: $('#pu').value.trim(), old: $('#po').value, pass: $('#pn').value }) }); toast('Password diganti. Login ulang.'); haOut(); MODE = 'ha'; R(); } catch (e) { toast(e.message); } }
async function haAnn() { const tx = $('#an').value.trim(); if (!tx) return; try { await haApi('/api/admin/announce', { method: 'POST', body: JSON.stringify({ text: tx }) }); $('#an').value = ''; toast('Pengumuman terkirim'); } catch (e) { toast(e.message); } }
async function haStore(id) {
  const s = HA.stores.find((x) => x.id == id); let st = []; try { st = (await haApi('/api/admin/stores/' + id + '/staff')).staff; } catch (e) { }
  const ed = s.exp ? new Date(s.exp - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : '';
  const m = modal(`<h3>${esc(s.name)}</h3><small class="mu">Kode ${esc(s.id)} · pemilik ${esc(s.owner || '')} · ${esc(s.email || '-')} · ${esc(s.phone || '-')}</small>
<div class="row"><span>Masa aktif</span>${expChip(s)}</div>
<b>Perpanjang</b><div class="wrap">${[7, 30, 90, 180, 365].map((d) => `<button class="gh a" data-d="${d}">+${d} hari</button>`).join('')}</div>
<div class="fm2"><label><small class="mu">Atau atur tanggal habis</small><input id="xd" type="date" value="${ed}"></label><label><small class="mu">Jenis langganan</small><select id="xp">${PLANS.map((p) => `<option value="${p[0]}" ${s.plan == p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label></div>
<label><small class="mu">Tingkat paket aplikasi (fitur yang dipakai toko)</small><select id="xt">${['biasa', 'standar', 'high'].map((t) => `<option value="${t}" ${(s.tier || 'high') == t ? 'selected' : ''}>${tierName(t)}</option>`).join('')}</select></label>
<input id="xn" placeholder="Catatan (mis. sudah bayar 1 bulan)" value="${esc(s.note || '')}"><button class="pr" id="xs">Simpan tanggal, paket & catatan</button>
<b>Pengguna toko</b><div class="ov"><table>${st.map((u) => `<tr><td>${esc(u.name)}<td>${esc(ROLE[u.role] || u.role)}<td class="n"><button class="gh" data-n="${esc(u.name)}">Reset PIN</button></tr>`).join('')}</table></div>
<div class="wrap"><button class="gh ${s.status == 'active' ? 'd' : 'a'}" id="tg">${s.status == 'active' ? 'Suspend toko' : 'Aktifkan toko'}</button><button class="gh d" id="dl">Hapus permanen</button><button class="gh" id="cx">Tutup</button></div>`, 'w');
  $$('[data-d]', m).forEach((b) => (b.onclick = async () => { if (await haExt(id, +b.dataset.d)) m.close(); }));
  $('#xs', m).onclick = async () => { const v = $('#xd', m).value, body = { plan: $('#xp', m).value, tier: $('#xt', m).value, note: $('#xn', m).value }; if (v) body.exp = new Date(v + 'T23:59:59').getTime(); if (await haPatch(id, body)) m.close(); };
  $$('[data-n]', m).forEach((b) => (b.onclick = async () => { const p = prompt('PIN baru untuk ' + b.dataset.n + ' (4–8 angka):'); if (!p) return; try { await haApi('/api/admin/stores/' + id + '/resetpin', { method: 'POST', body: JSON.stringify({ name: b.dataset.n, pin: p }) }); toast('PIN direset'); } catch (e) { toast(e.message); } }));
  $('#tg', m).onclick = async () => { if (await haPatch(id, { status: s.status == 'active' ? 'suspended' : 'active' })) m.close(); };
  $('#dl', m).onclick = async () => { if (prompt('Ketik kode toko "' + id + '" untuk menghapus PERMANEN semua data toko ini:') != id) return; try { await haApi('/api/admin/stores/' + id, { method: 'DELETE' }); m.close(); toast('Toko dihapus'); haLoad(); } catch (e) { toast(e.message); } };
  $('#cx', m).onclick = () => m.close();
}

async function haShip() { const v = (i) => +$('#' + i).value; try { HA.cfg = await haApi('/api/admin/cfg', { method: 'PUT', body: JSON.stringify({ ship_base: v('s1'), ship_per_m: v('s2'), ship_road: v('s3'), ship_min: v('s4'), ship_max_km: v('s5'), ship_round: v('s6') }) }); toast('Tarif ongkir disimpan'); R(); } catch (e) { toast(e.message); } }

/* ---------- Head Admin: pantau pengunjung & aktivitas ---------- */
const HAA = { d: null, typ: '', q: '', t: null };
async function haAct() {
  try { HAA.d = await haApi('/api/admin/activity?typ=' + HAA.typ + '&q=' + encodeURIComponent(HAA.q)); } catch (e) { if (e.status == 401) return haOut(); toast(e.message); }
  if (HA.tab == 'act' && MODE == 'ha' && !$('.md')) R();
}
const ROLEI = { pembeli: '🛍️', owner: '👑', admin: '🧑‍💼', akuntan: '🧮', kasir: '🧾', spg: '🧹', sales: '💼', dropping: '🚚', 'head admin': '🛠' };
const PGN = (p) => ({ beli: 'Pembelian', kas: 'Buku Kas', kirim: 'Pengantaran', perm: 'Hak Akses', aud: 'Audit Lapangan', dash: 'Beranda', pos: 'Kasir', onl: 'Toko Online', prod: 'Produk', outlet: 'Outlet', ana: 'Analisa', lap: 'Laporan', keu: 'Keuangan', jur: 'Jurnal', abs: 'Absensi', chat: 'Chat', usr: 'Pengguna', set: 'Pengaturan', his: 'Riwayat', ha: 'Panel Head Admin', login: 'Baru login', 'b:home': 'Beranda belanja', 'b:search': 'Mencari produk', 'b:prod': 'Lihat produk', 'b:store': 'Lihat toko', 'b:cart': 'Keranjang', 'b:ord': 'Pesanan', 'b:feed': 'Feed Untukmu', 'b:acc': 'Akun', 'b:chat': 'Chat' }[p] || p || '-');
function haActView() {
  const d = HAA.d; if (!d) return '<div class="cd"><p class="mu">Memuat aktivitas…</p></div>';
  const on = d.online, by = (r) => on.filter((x) => (x.role || x.typ) == r).length, ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + ' dtk' : Math.round(s / 60) + ' mnt'; };
  const tod = {}; d.today.forEach((x) => (tod[x.role || x.typ] = (tod[x.role || x.typ] || 0) + x.n));
  const hours = Array.from({ length: 24 }, (_, h) => ({ l: String(h).padStart(2, '0'), v: (d.hourly.find((x) => +x.h == h) || {}).n || 0 }));
  return `<div class="cd hero"><small>Sedang online (5 menit terakhir)</small><h2>${on.length} orang</h2><small>${['pembeli', 'owner', 'admin', 'kasir', 'sales', 'akuntan'].map((r) => ROLEI[r] + ' ' + by(r)).join(' · ')}</small></div>
${kpi(Object.entries(tod).map(([r, n]) => [(ROLEI[r] || '') + ' ' + r + ' aktif hari ini', n]))}
<div class="cd"><h3>🟢 Online sekarang</h3>${on.map((x) => `<div class="row"><span>${ROLEI[x.role] || '•'} <b>${esc(x.name)}</b> <small class="mu">${esc(x.role || x.typ)}${x.sn ? ' · ' + esc(x.sn) : ''}</small><br><small class="mu">📍 ${esc(PGN(x.page))}${x.dev ? ' · ' + esc(x.dev.slice(0, 40)) : ''}</small></span><small class="gr">${ago(x.t)}</small></div>`).join('') || '<small class="mu">Tidak ada yang online.</small>'}</div>
<div class="cd"><h3>Aktivitas per jam (24 jam)</h3>${vbars(hours, (v) => v)}</div>
<div class="cd"><h3>📜 Log aktivitas</h3><div class="srch"><input id="aq" placeholder="Cari nama / toko / aktivitas" value="${esc(HAA.q)}" onkeydown="if(event.key=='Enter'){HAA.q=this.value;haAct()}"><button class="gh" onclick="HAA.q=$('#aq').value;haAct()">🔍</button></div><div class="seg">${[['', 'Semua'], ['buyer', '🛍️ Pembeli'], ['staff', '🏪 Toko'], ['admin', '🛠 Head Admin']].map((x) => `<button class="${HAA.typ == x[0] ? 'a' : ''}" onclick="HAA.typ='${x[0]}';haAct()">${x[1]}</button>`).join('')}</div>
${d.log.map((a) => `<div class="je"><small>${tstr(a.t)} · ${a.typ == 'buyer' ? '🛍️' : a.typ == 'admin' ? '🛠' : '🏪'} <b>${esc(a.name)}</b>${a.sn ? ' · ' + esc(a.sn) : ''}</small><p><span>${esc(a.act)}</span><small class="mu">${esc(a.det || '')}</small></p></div>`).join('') || '<small class="mu">Belum ada aktivitas.</small>'}</div>`;
}
