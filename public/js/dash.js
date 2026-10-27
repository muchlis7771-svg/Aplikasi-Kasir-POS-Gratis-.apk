'use strict';
/* ============ DASHBOARD per peran ============ */
const todayR = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return [d.getTime(), d.getTime() + 864e5 - 1]; };
const monthR = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return [d.getTime(), Date.now() + 864e5]; };
const dayAgg = (n, filt) => days(n).map((d) => ({ l: d.l, v: S.sales.filter((s) => dkey(s.t) == d.k && (!filt || filt(s))).reduce((a, s) => a + netSale(s), 0) }));
const arTotal = () => S.sales.reduce((a, s) => a + sOut(s), 0);
const apTotal = () => S.ap.reduce((a, x) => a + apOut(x), 0);
const quick = (L) => `<div class="qk">${L.map((q) => `<button onclick="go('${q[0]}')"><b>${q[1]}</b><span>${q[2]}</span></button>`).join('')}</div>`;

VW.dash = () => (U.r == 'kasir' ? dashKasir() : U.r == 'sales' ? dashSales() : dashAdmin());

function dashAdmin() {
  const [t0, t1] = todayR(), [m0, m1] = monthR(), A = salesAgg(t0, t1), M = salesAgg(m0, m1), L = lr(m0, m1);
  const low = S.p.filter((p) => !p.x && p.st <= (p.min ?? 10)), od = S.c.filter((c) => !c.x && overdue(c.id) > 0).sort((a, b) => overdue(b.id) - overdue(a.id));
  const cats = Object.entries(M.byC).map(([k, v]) => ({ l: k, v: v.v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const prods = Object.entries(M.byP).map(([k, v]) => ({ l: k, v: v.v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const users = Object.entries(M.byU).map(([k, v]) => ({ l: k, v: v.v })).sort((a, b) => b.v - a.v);
  const hadir = S.att.filter((a) => a.k == 'in' && dkey(a.t) == dkey(Date.now())).length;
  return kpi([['Omzet hari ini', rp(A.net), A.n + ' transaksi'], ['Laba kotor hari ini', rp(A.profit)], ['Omzet bulan ini', rp(M.net), M.n + ' transaksi'], ['Laba bersih bulan ini', rp(L.laba), 'setelah beban'], ['Kas + Bank', rp(bal('1101') + bal('1102'))], ['Piutang', rp(arTotal()), od.length + ' outlet jatuh tempo'], ['Utang usaha', rp(apTotal())], ['Nilai stok', rp(stockValue()), low.length + ' stok menipis']])
    + quick([['pos', '🛒', 'Kasir'], ['prod', '📦', 'Produk'], ['outlet', '📍', 'Outlet'], ['lap', '📊', 'Laporan'], ['keu', '🧾', 'Akuntansi'], ['chat', '💬', 'Chat']])
    + `<div class="cd"><h3>Omzet 14 hari terakhir</h3>${area(dayAgg(14))}</div>`
    + `<div class="two"><div class="cd"><h3>Penjualan per kategori (bulan ini)</h3>${donut(cats)}</div><div class="cd"><h3>Produk terlaris</h3>${bars(prods, rp)}</div></div>`
    + `<div class="two"><div class="cd"><h3>Kinerja kasir & sales</h3>${bars(users, rp)}<small class="mu">Kehadiran hari ini: ${hadir} orang</small></div>
<div class="cd"><h3>⚠ Perlu perhatian</h3>${od.slice(0, 5).map((c) => row(esc(c.n) + ' <small class="mu">jatuh tempo</small>', '<span class="rd">' + rp(overdue(c.id)) + '</span>')).join('')}${low.slice(0, 6).map((p) => row(esc(p.n), '<span class="rd">' + p.st + ' ' + esc(p.u || '') + '</span>')).join('')}${od.length + low.length ? '' : '<p class="mu">Semua aman 👍</p>'}</div></div>`;
}

function dashKasir() {
  const [t0, t1] = todayR(), mine = S.sales.filter((s) => s.u == U.n && s.t >= t0 && s.t <= t1), tot = mine.reduce((a, s) => a + s.tot - (s.rtot || 0), 0), cash = mine.filter((s) => s.pay == 'Tunai').reduce((a, s) => a + s.tot - (s.rtot || 0), 0);
  const td = myToday(), last = td[td.length - 1], inn = last && last.k == 'in', byPay = {}; mine.forEach((s) => { const k = s.pay == 'Piutang' ? 'Kredit' : s.pay; byPay[k] = (byPay[k] || 0) + s.tot - (s.rtot || 0); });
  return `<div class="cd hero"><small>Halo, ${esc(U.n)}</small><h2>${rp(tot)}</h2><small>penjualan Anda hari ini · ${mine.length} transaksi</small></div>`
    + kpi([['Tunai di laci', rp(cash)], ['Rata-rata/transaksi', rp(mine.length ? tot / mine.length : 0)]])
    + quick([['pos', '🛒', 'Mulai jual'], ['his', '🧾', 'Riwayat'], ['abs', '🕒', inn ? 'Absen pulang' : 'Absen masuk'], ['chat', '💬', 'Chat']])
    + `<div class="cd"><h3>Metode pembayaran hari ini</h3>${donut(Object.entries(byPay).map(([l, v]) => ({ l, v })), 'metode')}</div>`
    + `<div class="cd"><h3>Transaksi terakhir</h3>${mine.slice(-6).reverse().map((s) => row(esc(s.no) + ' <small class="mu">' + hm(s.t) + ' · ' + esc(s.cn || 'Umum') + '</small>', rp(s.tot))).join('') || '<p class="mu">Belum ada transaksi hari ini</p>'}</div>`;
}

function dashSales() {
  const [t0, t1] = todayR(), [m0, m1] = monthR(), mine = (a, b) => S.sales.filter((s) => s.u == U.n && s.t >= a && s.t <= b);
  const mm = mine(m0, m1), omz = mm.reduce((a, s) => a + netSale(s), 0), vis = S.att.filter((a) => a.k == 'visit' && a.u == U.n);
  const vToday = vis.filter((a) => a.t >= t0 && a.t <= t1).length, vMonth = vis.filter((a) => a.t >= m0).length;
  const myc = S.c.filter((c) => !c.x && (c.sl == U.n || S.sales.some((s) => s.u == U.n && s.cu == c.id))), ar = myc.reduce((a, c) => a + outOf(c.id), 0);
  const perC = {}; mm.forEach((s) => { const k = s.cn || 'Umum'; perC[k] = (perC[k] || 0) + netSale(s); });
  const lastV = {}; vis.forEach((v) => (lastV[v.cid] = Math.max(lastV[v.cid] || 0, v.t)));
  const due = myc.filter((c) => !lastV[c.id] || Date.now() - lastV[c.id] > 14 * 864e5).slice(0, 5);
  return `<div class="cd hero"><small>Halo, ${esc(U.n)}</small><h2>${rp(omz)}</h2><small>omzet Anda bulan ini · ${mm.length} order</small></div>`
    + kpi([['Order hari ini', mine(t0, t1).length], ['Kunjungan hari ini', vToday, vMonth + ' bulan ini'], ['Outlet saya', myc.length], ['Piutang outlet saya', rp(ar)]])
    + quick([['outlet', '📍', 'Outlet & peta'], ['pos', '📝', 'Buat order'], ['abs', '🕒', 'Absen'], ['chat', '💬', 'Chat']])
    + `<div class="cd"><h3>Omzet saya 14 hari</h3>${area(dayAgg(14, (s) => s.u == U.n))}</div>`
    + `<div class="two"><div class="cd"><h3>Outlet teratas bulan ini</h3>${bars(Object.entries(perC).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6), rp)}</div><div class="cd"><h3>Belum dikunjungi 14 hari+</h3>${due.map((c) => `<div class="row"><span>${esc(c.n)}</span><button class="gh" onclick="go('outlet');setTimeout(()=>outletDetail('${esc(c.id)}'),50)">Lihat</button></div>`).join('') || '<p class="mu">Semua outlet sudah dikunjungi 👍</p>'}</div></div>`;
}

/* ============ HEAD ADMIN (developer) ============ */
const HA = { d: null, stores: [], q: '', err: '' };
async function haLoad() {
  try {
    const [st, ss] = await Promise.all([haApi('/api/admin/stats?tz=' + -new Date().getTimezoneOffset() / 60), haApi('/api/admin/stores')]);
    HA.d = st; HA.stores = ss.stores; HA.err = ''; HT && R();
  } catch (e) { if (e.status == 401) { haOut(); toast('Sesi berakhir, login ulang'); } else { HA.err = e.message; R(); } }
}
function haOut() { HT = ''; sessionStorage.removeItem('jpos:ht'); HA.d = null; R(); }
const fill14 = (rows) => days(14).map((d) => ({ l: d.l, v: (rows.find((r) => r.d == d.k) || {}).v || 0 }));
function haView() {
  if (!HA.d) return `<div class="cd">${HA.err ? '<p class="rd">' + esc(HA.err) + '</p>' : '<p class="mu">Memuat data…</p>'}</div>`;
  const t = HA.d.totals, q = HA.q.toLowerCase(), L = HA.stores.filter((s) => !q || (s.name + s.id + s.owner + (s.email || '')).toLowerCase().includes(q));
  return kpi([['Toko terdaftar', t.stores, t.active + ' aktif'], ['Total pengguna', t.users], ['Total omzet (semua toko)', rp(t.omzet)], ['Transaksi', t.tx]])
    + `<div class="cd"><h3>Omzet seluruh toko · 14 hari</h3>${area(fill14(HA.d.daily))}</div>`
    + `<div class="two"><div class="cd"><h3>Pendaftaran toko baru</h3>${vbars(fill14(HA.d.signups), (v) => v)}</div><div class="cd"><h3>Toko teratas (30 hari)</h3>${bars(HA.d.top.map((x) => ({ l: x.name, v: x.v })), rp)}</div></div>`
    + `<div class="cd"><h3>Siaran ke semua toko</h3><div class="row"><input id="an" maxlength="500" placeholder="Pengumuman (tampil di chat 'Semua toko')" style="flex:1"><button class="pr" style="width:auto;padding:12px 20px" onclick="haAnn()">Kirim</button></div></div>`
    + `<div class="cd"><h3>Daftar toko (${L.length}) <button class="gh" style="float:right" onclick="haLoad()">⟳</button></h3><input placeholder="Cari nama / kode / pemilik / email" value="${esc(HA.q)}" onchange="HA.q=this.value;R()"><div class="ov"><table><tr><th>Toko<th>Pemilik<th class="n">User<th class="n">Trx<th class="n">Omzet<th>Status<th></tr>${L.map((s) => `<tr><td><b>${esc(s.name)}</b><br><small class="mu">${esc(s.id)} · ${dstr(s.created)}</small><td>${esc(s.owner)}<br><small class="mu">${esc(s.email || '')}</small><td class="n">${s.users}<td class="n">${s.tx}<td class="n">${rp(s.omzet)}<td><span class="chip ${s.status == 'active' ? 'g' : 'r'}">${s.status == 'active' ? 'Aktif' : 'Suspend'}</span><td class="n"><button class="gh" onclick="haStore('${esc(s.id)}')">Kelola</button></tr>`).join('') || '<tr><td colspan="7" class="mu">Belum ada toko</tr>'}</table></div></div>`;
}
async function haAnn() { const tx = $('#an').value.trim(); if (!tx) return; try { await haApi('/api/admin/announce', { method: 'POST', body: JSON.stringify({ text: tx }) }); $('#an').value = ''; toast('Pengumuman terkirim'); } catch (e) { toast(e.message); } }
async function haStore(id) {
  const s = HA.stores.find((x) => x.id == id); let st = []; try { st = (await haApi('/api/admin/stores/' + id + '/staff')).staff; } catch (e) { }
  const m = modal(`<h3>${esc(s.name)}</h3><small class="mu">Kode ${esc(s.id)} · pemilik ${esc(s.owner)} · ${esc(s.email || '-')}</small>
<div class="ov"><table><tr><th>Pengguna<th>Peran<th></tr>${st.map((u) => `<tr><td>${esc(u.name)}<td>${esc(ROLE[u.role] || u.role)}<td class="n"><button class="gh" data-n="${esc(u.name)}">Reset PIN</button></tr>`).join('')}</table></div>
<div class="wrap"><button class="gh ${s.status == 'active' ? 'd' : ''}" id="tg">${s.status == 'active' ? 'Suspend toko' : 'Aktifkan toko'}</button><button class="gh d" id="dl">Hapus permanen</button></div><small class="mu">Suspend: semua pengguna toko tidak bisa sinkron/login online. Data tetap aman.</small>`);
  $$('[data-n]', m).forEach((b) => (b.onclick = async () => { const p = prompt('PIN baru untuk ' + b.dataset.n + ' (4–8 angka):'); if (!p) return; try { await haApi('/api/admin/stores/' + id + '/resetpin', { method: 'POST', body: JSON.stringify({ name: b.dataset.n, pin: p }) }); toast('PIN direset'); } catch (e) { toast(e.message); } }));
  $('#tg', m).onclick = async () => { try { await haApi('/api/admin/stores/' + id, { method: 'PATCH', body: JSON.stringify({ status: s.status == 'active' ? 'suspended' : 'active' }) }); m.close(); haLoad(); } catch (e) { toast(e.message); } };
  $('#dl', m).onclick = async () => { if (prompt('Ketik kode toko "' + id + '" untuk menghapus PERMANEN semua data toko ini:') != id) return; try { await haApi('/api/admin/stores/' + id, { method: 'DELETE' }); m.close(); toast('Toko dihapus'); haLoad(); } catch (e) { toast(e.message); } };
}
