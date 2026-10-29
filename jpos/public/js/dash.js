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
  const Y = salesAgg(t0 - 864e5, t0 - 1), gr = Y.net ? Math.round(((A.net - Y.net) / Y.net) * 100) : null, hr = new Date().getHours(), sal = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 18 ? 'Selamat sore' : 'Selamat malam';
  return `<div class="cd hero hero2"><div class="row" style="margin:0;align-items:flex-start"><span><small>${sal}, ${esc(U.n)} 👋</small><br><small>${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small></span><span class="hbadge">${esc(U.r)}</span></div><h2>${rp(A.net)}</h2><small>omzet hari ini · ${A.n} transaksi${gr != null ? ` · <b class="hgr">${gr >= 0 ? '▲' : '▼'} ${Math.abs(gr)}% vs kemarin</b>` : ''}</small><div class="hsplit"><span><small>Laba kotor</small><b>${rp(A.profit)}</b></span><span><small>Bulan ini</small><b>${rp(M.net)}</b></span><span><small>Stok menipis</small><b>${low.length}</b></span></div></div>`
    + kpi([['Omzet hari ini', rp(A.net), A.n + ' transaksi'], ['Laba kotor hari ini', rp(A.profit)], ['Omzet bulan ini', rp(M.net), M.n + ' transaksi'], ['Laba bersih bulan ini', rp(L.laba), 'setelah beban'], ['Kas + Bank', rp(bal('1101') + bal('1102'))], ['Piutang', rp(arTotal()), od.length + ' outlet jatuh tempo'], ['Utang usaha', rp(apTotal())], ['Nilai stok', rp(stockValue()), low.length + ' stok menipis']])
    + quick([['pos', '🛒', 'Kasir'], ...(can('onl') && S.srv ? [['onl', '🛍️', 'Online' + (ONL.orders.filter(needAct).length ? ' (' + ONL.orders.filter(needAct).length + ')' : '')]] : [['prod', '📦', 'Produk']]), ['outlet', '📍', 'Outlet'], ['lap', '📊', 'Laporan'], ...(can('ana') ? [['ana', '🎯', 'Analisa']] : [['keu', '🧾', 'Keuangan']]), ['chat', '💬', 'Chat']])
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
    + `<div class="cd"><div class="row"><span><b>Tutup kasir</b><br><small class="mu">Rekap setoran shift hari ini</small></span><button class="gh a" onclick="tutupKasir()">Rekap shift</button></div></div>`
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
    + (() => { const P = reorderPlan(true).filter((x) => x.st != 'aman'); return P.length ? `<div class="cd info"><div class="row" style="margin:0"><span><b>🎯 Saran order hari ini</b><br><small>${P.length} outlet perlu dikunjungi · potensi ${rp(P.reduce((a, x) => a + x.val, 0))}</small></span><button class="gh a" onclick="ANA.tab='order';go('ana')">Lihat</button></div><small class="mu">${P.slice(0, 3).map((x) => esc(x.c.n)).join(', ')}${P.length > 3 ? '…' : ''}</small></div>` : ''; })()
    + `<div class="cd"><h3>Omzet saya 14 hari</h3>${area(dayAgg(14, (s) => s.u == U.n))}</div>`
    + `<div class="two"><div class="cd"><h3>Outlet teratas bulan ini</h3>${bars(Object.entries(perC).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6), rp)}</div><div class="cd"><h3>Belum dikunjungi 14 hari+</h3>${due.map((c) => `<div class="row"><span>${esc(c.n)}</span><button class="gh" onclick="go('outlet');setTimeout(()=>outletDetail('${esc(c.id)}'),50)">Lihat</button></div>`).join('') || '<p class="mu">Semua outlet sudah dikunjungi 👍</p>'}</div></div>`;
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
const sDays = (s) => (s.exp ? Math.ceil((s.exp - Date.now()) / 864e5) : null);
const sState = (s) => (s.status != 'active' ? 'sus' : sDays(s) == null ? 'ok' : sDays(s) < 0 ? 'exp' : sDays(s) <= 7 ? 'soon' : 'ok');
const expChip = (s) => { const d = sDays(s), st = sState(s); return st == 'sus' ? '<span class="chip r">Suspend</span>' : d == null ? '<span class="chip">-</span>' : d < 0 ? `<span class="chip r">Habis ${-d} hr lalu</span>` : d <= 7 ? `<span class="chip o">${d} hari lagi</span>` : `<span class="chip g">${d} hari lagi</span>`; };
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
${L.map((s) => `<div class="sc"><div class="row" style="margin:0"><span><b>${esc(s.name)}</b> <span class="chip">${esc(planName(s.plan))}</span><br><small class="mu">Kode <b>${esc(s.id)}</b> · ${esc(s.owner || '')}${s.phone ? ' · ' + esc(s.phone) : ''}</small></span>${expChip(s)}</div><small class="mu">Daftar ${dstr(s.created)} · aktif s/d ${s.exp ? dstr(s.exp) : '-'} · ${s.users} user · ${s.tx} trx · ${rp(s.omzet)}${s.last ? ' · terakhir ' + dstr(s.last) : ''}</small><div class="wrap" style="margin-top:6px"><button class="gh a" onclick="haExt('${esc(s.id)}',30)">+30 hari</button><button class="gh" onclick="haStore('${esc(s.id)}')">Kelola</button>${s.phone ? `<a class="gh" target="_blank" href="${esc(waLink(s.phone, 'Halo ' + (s.owner || '') + ', terkait aplikasi J-POS toko ' + s.name + ' (kode ' + s.id + ')'))}">WhatsApp</a>` : ''}</div></div>`).join('') || '<p class="mu">Tidak ada toko</p>'}</div>`
    + `<div class="cd"><h3>Omzet seluruh toko · 14 hari</h3>${area(fill14(HA.d.daily))}</div>`
    + `<div class="two"><div class="cd"><h3>Pendaftaran toko baru</h3>${vbars(fill14(HA.d.signups), (v) => v)}</div><div class="cd"><h3>Toko teratas (30 hari)</h3>${bars(HA.d.top.map((x) => ({ l: x.name, v: x.v })), rp)}</div></div>`
    + `<div class="cd"><h3>Pengaturan langganan</h3><div class="fm"><label><small class="mu">No. WhatsApp Anda (tampil saat masa aktif toko habis)</small><input id="cw" inputmode="tel" placeholder="62812xxxx" value="${esc(HA.cfg ? HA.cfg.wa : '')}"></label><label><small class="mu">Info harga / cara bayar</small><textarea id="cp" rows="3" placeholder="Contoh: Rp99.000/bulan · Rp999.000/tahun. Transfer BCA 123… a.n. …">${esc(HA.cfg ? HA.cfg.price : '')}</textarea></label><label><small class="mu">Lama masa coba toko baru (hari)</small><input id="ctd" type="number" min="1" max="365" value="${HA.cfg ? HA.cfg.trial_days : 30}"></label><button class="pr" onclick="haCfg()">Simpan pengaturan</button></div></div>`
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
<div class="fm2"><label><small class="mu">Atau atur tanggal habis</small><input id="xd" type="date" value="${ed}"></label><label><small class="mu">Paket</small><select id="xp">${PLANS.map((p) => `<option value="${p[0]}" ${s.plan == p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label></div>
<input id="xn" placeholder="Catatan (mis. sudah bayar 1 bulan)" value="${esc(s.note || '')}"><button class="pr" id="xs">Simpan tanggal, paket & catatan</button>
<b>Pengguna toko</b><div class="ov"><table>${st.map((u) => `<tr><td>${esc(u.name)}<td>${esc(ROLE[u.role] || u.role)}<td class="n"><button class="gh" data-n="${esc(u.name)}">Reset PIN</button></tr>`).join('')}</table></div>
<div class="wrap"><button class="gh ${s.status == 'active' ? 'd' : 'a'}" id="tg">${s.status == 'active' ? 'Suspend toko' : 'Aktifkan toko'}</button><button class="gh d" id="dl">Hapus permanen</button><button class="gh" id="cx">Tutup</button></div>`, 'w');
  $$('[data-d]', m).forEach((b) => (b.onclick = async () => { if (await haExt(id, +b.dataset.d)) m.close(); }));
  $('#xs', m).onclick = async () => { const v = $('#xd', m).value, body = { plan: $('#xp', m).value, note: $('#xn', m).value }; if (v) body.exp = new Date(v + 'T23:59:59').getTime(); if (await haPatch(id, body)) m.close(); };
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
const ROLEI = { pembeli: '🛍️', owner: '👑', admin: '🧑‍💼', akuntan: '🧮', kasir: '🧾', sales: '🚚', 'head admin': '🛠' };
const PGN = (p) => ({ dash: 'Beranda', pos: 'Kasir', onl: 'Toko Online', prod: 'Produk', outlet: 'Outlet', ana: 'Analisa', lap: 'Laporan', keu: 'Keuangan', jur: 'Jurnal', abs: 'Absensi', chat: 'Chat', usr: 'Pengguna', set: 'Pengaturan', his: 'Riwayat', ha: 'Panel Head Admin', login: 'Baru login', 'b:home': 'Beranda belanja', 'b:search': 'Mencari produk', 'b:prod': 'Lihat produk', 'b:store': 'Lihat toko', 'b:cart': 'Keranjang', 'b:ord': 'Pesanan', 'b:feed': 'Feed Untukmu', 'b:acc': 'Akun', 'b:chat': 'Chat' }[p] || p || '-');
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
