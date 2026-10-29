'use strict';
/* ============ ANALISA OMZET (tajam) & SARAN KETERSEDIAAN STOK (baseline, tren, musiman, cross-selling) ============ */
const D1 = 864e5, sod0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const pct = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : a ? 100 : 0);
const pctP = (v) => (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v) + '% vs periode lalu';
const pctTxt = (v) => `<span class="${v >= 0 ? 'gr' : 'rd'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}%</span>`;
// kalender momen musiman Indonesia (tanggal hari raya Islam = perkiraan, bisa bergeser ±1 hari)
const EVENTS = (() => {
  const E = [], add = (n, d, before, after, cat) => E.push({ n, t: new Date(d + 'T00:00:00').getTime(), before, after, cat });
  [['2025-03-31', '2025-03-01'], ['2026-03-20', '2026-02-18'], ['2027-03-10', '2027-02-08'], ['2028-02-27', '2028-01-28']].forEach(([e, r]) => { add('Ramadan', r, 3, 26, 'ramadan'); add('Lebaran (Idul Fitri)', e, 21, 3, 'lebaran'); });
  ['2025-06-06', '2026-05-27', '2027-05-17', '2028-05-05'].forEach((d) => add('Idul Adha', d, 10, 2, 'adha'));
  [2025, 2026, 2027, 2028].forEach((y) => { add('Natal & Tahun Baru', y + '-12-25', 10, 8, 'nataru'); add('Tahun ajaran baru', y + '-07-14', 14, 7, 'sekolah'); });
  return E;
})();
// faktor kenaikan bawaan per momen & kategori (dipakai bila riwayat toko belum cukup)
const UPLIFT = { lebaran: { sembako: 1.8, minuman: 1.7, makanan: 1.7, bumbu: 1.6, kue: 2, snack: 1.8, kresek: 1.6, plastik: 1.6, kebutuhan: 1.4, _: 1.4 }, ramadan: { minuman: 1.4, sembako: 1.3, makanan: 1.3, snack: 1.3, _: 1.15 }, adha: { bumbu: 1.4, sembako: 1.2, kresek: 1.3, _: 1.1 }, nataru: { minuman: 1.3, snack: 1.3, kue: 1.4, _: 1.15 }, sekolah: { atk: 1.8, snack: 1.15, _: 1.05 } };
const evActive = (t) => EVENTS.filter((e) => t >= e.t - e.before * D1 && t <= e.t + e.after * D1);
const upDef = (cat, c) => { const U2 = UPLIFT[cat] || {}, k = String(c || '').toLowerCase(); for (const x in U2) if (x != '_' && k.includes(x)) return U2[x]; return U2._ || 1; };

/* ---------- data dasar: penjualan harian per produk ---------- */
function dailyMatrix(days) {
  const t0 = sod0(Date.now()) - (days - 1) * D1, P = {}, tot = new Array(days).fill(0);
  for (const s of S.sales) {
    if (s.t < t0) continue; const i = Math.floor((sod0(s.t) - t0) / D1); if (i < 0 || i >= days) continue;
    tot[i] += netSale(s);
    for (const l of s.L) { const q = l.q - (l.rq || 0); if (q <= 0) continue; (P[l.id] = P[l.id] || new Array(days).fill(0))[i] += q; }
  }
  return { t0, P, tot };
}
function dowFactors(tot, t0) { const s = new Array(7).fill(0), n = new Array(7).fill(0); tot.forEach((v, i) => { const d = new Date(t0 + i * D1).getDay(); s[d] += v; n[d]++; }); const avg = tot.reduce((a, v) => a + v, 0) / (tot.length || 1) || 1; return s.map((v, d) => (n[d] && avg ? Math.max(0.3, Math.min(2.5, v / n[d] / avg)) : 1)); }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0), sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

/* ---------- ANALISA OMZET ---------- */
let OMZ = { d: 30 };
function omzetView() {
  const N = OMZ.d, now = Date.now(), t1 = sod0(now) - (N - 1) * D1, t0 = t1 - N * D1;
  const cur = S.sales.filter((s) => s.t >= t1), prev = S.sales.filter((s) => s.t >= t0 && s.t < t1);
  const agg = (L) => { let o = 0, h = 0, it = 0; const cu = new Set(); L.forEach((s) => { o += netSale(s); h += s.hpp - s.L.reduce((a, i) => a + (i.rq || 0) * i.hc, 0); it += s.L.reduce((a, i) => a + i.q - (i.rq || 0), 0); if (s.cu) cu.add(s.cu); }); return { o, h, gp: o - h, n: L.length, it, cu: cu.size, aov: L.length ? o / L.length : 0 }; };
  const A = agg(cur), B = agg(prev), mg = A.o ? Math.round((A.gp / A.o) * 1000) / 10 : 0, mgB = B.o ? Math.round((B.gp / B.o) * 1000) / 10 : 0;
  const M = dailyMatrix(Math.max(N, 60)), dly = M.tot.slice(-N), dow = new Array(7).fill(0), dowN = new Array(7).fill(0), hr = new Array(24).fill(0);
  dly.forEach((v, i) => { const d = new Date(t1 + i * D1).getDay(); dow[d] += v; dowN[d]++; }); cur.forEach((s) => (hr[new Date(s.t).getHours()] += netSale(s)));
  // per produk / kategori / outlet / kasir
  const byP = {}, byC = {}, byO = {}, byU = {}, byPay = {};
  cur.forEach((s) => { const n = netSale(s), k = s.pay == 'Piutang' ? 'Kredit' : s.pay; byPay[k] = (byPay[k] || 0) + n; byO[s.cn || 'Umum'] = (byO[s.cn || 'Umum'] || 0) + n; byU[s.u] = (byU[s.u] || 0) + n;
    s.L.forEach((i) => { const q = i.q - (i.rq || 0); if (q <= 0) return; const rev = Math.round((i.p * i.q - i.dd) * (q / i.q)), p = prod(i.id), x = (byP[i.id] = byP[i.id] || { n: i.n, c: p ? p.c : '-', rev: 0, hpp: 0, q: 0 }); x.rev += rev; x.hpp += i.hc * q; x.q += q; byC[x.c] = (byC[x.c] || 0) + rev; }); });
  const prods = Object.values(byP).sort((a, b) => b.rev - a.rev), totRev = prods.reduce((a, x) => a + x.rev, 0) || 1; let cum = 0;
  prods.forEach((x) => { cum += x.rev; x.cls = cum / totRev <= 0.8 ? 'A' : cum / totRev <= 0.95 ? 'B' : 'C'; x.mg = x.rev ? Math.round(((x.rev - x.hpp) / x.rev) * 1000) / 10 : 0; });
  const cls = (c) => prods.filter((x) => x.cls == c);
  // monthly 12
  const mon = []; for (let k = 11; k >= 0; k--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); const a = sod0(d.getTime()), e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); mon.push({ l: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()], v: S.sales.filter((s) => s.t >= a && s.t < e).reduce((x, s) => x + netSale(s), 0) }); }
  // proyeksi 30 hari: regresi linear 60 hari × pola hari, + efek momen musiman
  const base = M.tot.slice(-60), n = base.length, xs = base.map((_, i) => i), mx = mean(xs), my = mean(base), slope = n > 1 ? xs.reduce((a, x, i) => a + (x - mx) * (base[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1) : 0;
  const dowF = dowFactors(M.tot.slice(-56), sod0(now) - 55 * D1); let fc = 0; const fcs = [];
  for (let k = 1; k <= 30; k++) { const t = sod0(now) + k * D1, ev = evActive(t), up = ev.length ? Math.max(...ev.map((e) => upDef(e.cat, ''))) : 1, v = Math.max(0, (my + slope * (n - 1 + k - mx)) * dowF[new Date(t).getDay()] * up); fc += v; fcs.push(v); }
  const best = dow.map((v, d) => ({ d, v: dowN[d] ? v / dowN[d] : 0 })).sort((a, b) => b.v - a.v), peakH = hr.map((v, h) => ({ h, v })).sort((a, b) => b.v - a.v);
  const catPrev = {}; prev.forEach((s) => s.L.forEach((i) => { const p = prod(i.id), c = p ? p.c : '-'; catPrev[c] = (catPrev[c] || 0) + i.p * i.q - i.dd; }));
  const catDelta = Object.entries(byC).map(([c, v]) => ({ c, v, d: pct(v, catPrev[c] || 0) })).sort((a, b) => a.d - b.d);
  const ins = [];
  ins.push(`Omzet ${N} hari ${pct(A.o, B.o) >= 0 ? 'naik' : 'turun'} <b>${Math.abs(pct(A.o, B.o))}%</b> dibanding ${N} hari sebelumnya (${rp(B.o)} → ${rp(A.o)}).`);
  if (A.n && B.n) ins.push(`Penyebab utama: jumlah nota ${pctP(pct(A.n, B.n))} dan rata-rata nilai nota ${pctP(pct(A.aov, B.aov))}.`);
  if (catDelta.length) { const w = catDelta[0], bst = catDelta[catDelta.length - 1]; if (w.d < 0) ins.push(`Kategori melemah: <b>${esc(w.c)}</b> (${w.d}%). Kategori menguat: <b>${esc(bst.c)}</b> (+${bst.d}%).`); }
  if (best[0].v) ins.push(`Hari terbaik <b>${HARI[best[0].d]}</b>, terlemah <b>${HARI[best[6].d]}</b> — atur stok & jadwal kunjungan sales mengikuti pola ini.`);
  if (peakH[0].v) ins.push(`Jam paling ramai pukul <b>${String(peakH[0].h).padStart(2, '0')}:00–${String(peakH[0].h + 1).padStart(2, '0')}:00</b>.`);
  if (prods.length) ins.push(`<b>${cls('A').length}</b> produk (kelas A) menyumbang 80% omzet — jangan sampai kosong. ${cls('C').length} produk kelas C hanya 5% omzet.`);
  if (mg < mgB - 1) ins.push(`Margin kotor turun dari ${mgB}% ke <b>${mg}%</b> — cek diskon grosir & harga beli terbaru.`);
  const upEv = EVENTS.filter((e) => e.t - e.before * D1 > now && e.t - e.before * D1 < now + 45 * D1)[0]; if (upEv) ins.push(`📅 Momen <b>${upEv.n}</b> mulai berpengaruh ±${Math.round((upEv.t - upEv.before * D1 - now) / D1)} hari lagi — siapkan stok (lihat tab Stok).`);
  ins.push(`Proyeksi 30 hari ke depan: <b>${rp(fc)}</b> (${pctTxt(pct(fc, A.o * (30 / N)))} dari laju sekarang).`);
  return `<div class="seg">${[[7, '7 hari'], [30, '30 hari'], [90, '90 hari'], [365, '1 tahun']].map((x) => `<button class="${OMZ.d == x[0] ? 'a' : ''}" onclick="OMZ.d=${x[0]};R()">${x[1]}</button>`).join('')}</div>
<div class="cd hero"><small>Omzet ${N} hari</small><h2>${rp(A.o)}</h2><small>${pctTxt(pct(A.o, B.o))} vs periode sebelumnya · laba kotor ${rp(A.gp)} (${mg}%)</small></div>
${kpi([['Transaksi', A.n, pctP(pct(A.n, B.n))], ['Rata-rata nota', rp(A.aov), pctP(pct(A.aov, B.aov))], ['Item / nota', A.n ? (A.it / A.n).toFixed(1) : 0], ['Pelanggan aktif', A.cu, pctP(pct(A.cu, B.cu))], ['Omzet / hari', rp(A.o / N)], ['Proyeksi 30 hari', rp(fc)]])}
<div class="cd insight"><h3>💡 Insight otomatis</h3>${ins.map((x) => `<p>• ${x}</p>`).join('')}</div>
<div class="cd"><h3>Omzet harian</h3>${area(dly.map((v, i) => ({ l: dstr(t1 + i * D1).slice(0, 5), v })))}</div>
<div class="cd"><h3>Proyeksi 30 hari (pola hari + tren + momen)</h3>${area(fcs.map((v, i) => ({ l: dstr(sod0(now) + (i + 1) * D1).slice(0, 5), v })))}</div>
<div class="two"><div class="cd"><h3>12 bulan terakhir</h3>${vbars(mon, (v) => shortRp2(v))}</div><div class="cd"><h3>Rata-rata per hari</h3>${vbars([1, 2, 3, 4, 5, 6, 0].map((d) => ({ l: HARI[d], v: dowN[d] ? dow[d] / dowN[d] : 0 })), (v) => shortRp2(v))}</div></div>
<div class="cd"><h3>Jam ramai</h3>${vbars(hr.map((v, h) => ({ l: String(h).padStart(2, '0'), v })).slice(5, 23), (v) => shortRp2(v))}</div>
<div class="two"><div class="cd"><h3>Per kategori</h3>${donut(Object.entries(byC).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 7))}</div><div class="cd"><h3>Per metode bayar</h3>${donut(Object.entries(byPay).map(([l, v]) => ({ l, v })), 'metode')}</div></div>
<div class="cd"><h3>Analisa ABC (Pareto) produk</h3>${kpi([['Kelas A (80%)', cls('A').length + ' produk'], ['Kelas B (15%)', cls('B').length + ' produk'], ['Kelas C (5%)', cls('C').length + ' produk']])}
<div class="ov"><table><tr><th>Produk<th>Kls<th class="n">Qty<th class="n">Omzet<th class="n">Margin</tr>${prods.slice(0, 25).map((x) => `<tr><td>${esc(x.n)}<br><small class="mu">${esc(x.c)}</small><td><span class="chip ${x.cls == 'A' ? 'g' : x.cls == 'B' ? '' : 'o'}">${x.cls}</span><td class="n">${x.q}<td class="n">${rp(x.rev)}<td class="n ${x.mg < 10 ? 'rd' : ''}">${x.mg}%</tr>`).join('')}</table></div></div>
<div class="two"><div class="cd"><h3>Outlet teratas</h3>${bars(Object.entries(byO).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 10), rp)}</div><div class="cd"><h3>Kasir & sales</h3>${bars(Object.entries(byU).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v), rp)}</div></div>
<div class="cd"><h3>Margin terendah (perlu dicek harga)</h3>${prods.filter((x) => x.q > 0).sort((a, b) => a.mg - b.mg).slice(0, 6).map((x) => row(esc(x.n), `<span class="${x.mg < 10 ? 'rd' : ''}">${x.mg}%</span>`)).join('') || '<small class="mu">-</small>'}</div>
<div class="wrap"><button class="gh" onclick="omzXlsx()">⬇ Excel analisa omzet</button></div>`;
}
const shortRp2 = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'jt' : v >= 1e3 ? Math.round(v / 1e3) + 'rb' : Math.round(v));
function omzXlsx() { if (!window.XLSX) return; const wb = XLSX.utils.book_new(), rows = [['Tanggal', 'Omzet', 'Nota']]; const M = dailyMatrix(OMZ.d); M.tot.forEach((v, i) => rows.push([dstr(M.t0 + i * D1), Math.round(v), S.sales.filter((s) => dkey(s.t) == dkey(M.t0 + i * D1)).length])); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Harian'); const st = stockPlan(), r2 = [['Produk', 'Kategori', 'Stok', 'Rata2/hari', 'Proyeksi/hari', 'Hari cukup', 'Status', 'Saran pesan', 'Alasan']]; st.forEach((x) => r2.push([x.p.n, x.p.c, x.p.st, +x.base.toFixed(2), +x.fday.toFixed(2), x.cover ?? '', x.st, x.order, x.why.join('; ')])); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r2), 'Saran stok'); saveFile('analisa-' + dkey(Date.now()) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })])); }

/* ---------- SARAN KETERSEDIAAN STOK ---------- */
const STK = Object.assign({ lead: 3, cover: 14, sl: 95 }, LS.get('jpos:stkcfg', {}));
function crossSell() {
  const cnt = {}, pair = {}, N = S.sales.filter((s) => s.t > Date.now() - 180 * D1);
  N.forEach((s) => { const ids = [...new Set(s.L.map((l) => l.id))]; ids.forEach((a) => (cnt[a] = (cnt[a] || 0) + 1)); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = ids[i] < ids[j] ? ids[i] + '|' + ids[j] : ids[j] + '|' + ids[i]; pair[k] = (pair[k] || 0) + 1; } });
  const T = N.length || 1;
  return Object.entries(pair).filter(([, c]) => c >= 3).map(([k, c]) => { const [a, b] = k.split('|'); return { a, b, c, conf: Math.max(c / cnt[a], c / cnt[b]), lift: (c / T) / ((cnt[a] / T) * (cnt[b] / T)) }; }).filter((x) => x.lift > 1.1).sort((x, y) => y.lift * y.c - x.lift * x.c);
}
function stockPlan() {
  const now = Date.now(), H = 120, M = dailyMatrix(H), dowF = dowFactors(M.tot.slice(-56), M.t0 + (H - 56) * D1), z = { 90: 1.28, 95: 1.65, 98: 2.05, 99: 2.33 }[STK.sl] || 1.65;
  const outletQ = {}; try { reorderPlan(false).forEach((x) => x.items.forEach((i) => { if (i.due <= STK.lead + 3) outletQ[i.id] = (outletQ[i.id] || 0) + i.q; })); } catch (e) { }
  const CS = crossSell();
  return S.p.filter((p) => !p.x).map((p) => {
    const ser = M.P[p.id] || new Array(H).fill(0), last28 = ser.slice(-28), prev28 = ser.slice(-56, -28), why = [];
    // baseline: rata-rata 28 hari di luar periode momen
    const clean = last28.filter((_, i) => !evActive(M.t0 + (H - 28 + i) * D1).length); const base = mean(clean.length >= 10 ? clean : last28), sig = sd(last28);
    const tr = Math.max(0.6, Math.min(1.6, mean(prev28) ? mean(ser.slice(-14)) / (mean(prev28) || 1) : 1));
    // kenaikan musiman: dari riwayat momen yang sama (bila ada) atau bawaan kategori
    const learned = {}; EVENTS.filter((e) => e.t < now - D1 && e.t > M.t0 + 30 * D1).forEach((e) => { const a = Math.floor((e.t - e.before * D1 - M.t0) / D1), b = Math.floor((e.t + e.after * D1 - M.t0) / D1), w = ser.slice(Math.max(0, a), Math.max(0, b)), pre = ser.slice(Math.max(0, a - 28), Math.max(0, a)); if (w.length > 3 && mean(pre) > 0) learned[e.cat] = Math.max(0.8, Math.min(3, mean(w) / mean(pre))); });
    const horizon = STK.lead + STK.cover; let need = 0, needL = 0, evs = new Set();
    for (let k = 1; k <= horizon; k++) { const t = sod0(now) + k * D1, ev = evActive(t), up = ev.length ? Math.max(...ev.map((e) => { evs.add(e.n); return learned[e.cat] || upDef(e.cat, p.c); })) : 1, v = base * tr * dowF[new Date(t).getDay()] * up; need += v; if (k <= STK.lead) needL += v; }
    const fday = need / horizon, ss = z * sig * Math.sqrt(STK.lead), oq = outletQ[p.id] || 0;
    const target = Math.ceil(Math.max(need, oq) + ss), rop = Math.ceil(needL + ss), order = Math.max(0, target - Math.max(0, p.st)), cover = fday > 0 ? Math.floor(p.st / fday) : null, sold30 = ser.slice(-30).reduce((a, v) => a + v, 0);
    let st = 'aman';
    if (p.st <= 0 && (base > 0 || oq)) st = 'habis'; else if (p.st < needL && (base > 0 || oq)) st = 'kritis'; else if (p.st <= rop && (base > 0 || oq)) st = 'pesan'; else if (!sold30 && p.st > 0) st = 'mati'; else if (cover != null && cover > 60) st = 'lebih';
    if (base) why.push('rata-rata ' + base.toFixed(1) + '/hari');
    if (Math.abs(tr - 1) >= 0.1) why.push('tren ' + (tr > 1 ? '+' : '') + Math.round((tr - 1) * 100) + '%');
    if (evs.size) why.push('momen ' + [...evs].join(', ') + ' ×' + Math.max(...[...evs].map((n) => { const e = EVENTS.find((x) => x.n == n); return learned[e.cat] || upDef(e.cat, p.c); })).toFixed(1));
    if (oq) why.push('outlet langganan butuh ±' + oq + ' segera');
    const cs = CS.filter((x) => x.a == p.id || x.b == p.id).slice(0, 2).map((x) => prod(x.a == p.id ? x.b : x.a)).filter(Boolean);
    if (cs.length) why.push('sering dibeli bersama ' + cs.map((c) => c.n).join(', '));
    return { p, base, tr, fday, ss: Math.ceil(ss), rop, target, order: st == 'mati' || st == 'lebih' ? 0 : order, cover, st, why, cs, val: (st == 'mati' || st == 'lebih' ? 0 : order) * p.co, sold30 };
  });
}
const SST = { habis: ['Habis', 'r', 0], kritis: ['Kritis', 'r', 1], pesan: ['Pesan sekarang', 'o', 2], aman: ['Aman', 'g', 4], lebih: ['Stok berlebih', '', 5], mati: ['Tidak laku', '', 6] };
let STKF = 'need';
function stokView() {
  const L = stockPlan(), need = L.filter((x) => ['habis', 'kritis', 'pesan'].includes(x.st)), now = Date.now(), CS = crossSell().slice(0, 8);
  const up = EVENTS.filter((e) => e.t + e.after * D1 > now && e.t - e.before * D1 < now + 60 * D1);
  const F = { need: (x) => ['habis', 'kritis', 'pesan'].includes(x.st), all: () => 1, lebih: (x) => x.st == 'lebih' || x.st == 'mati' }, rows = L.filter(F[STKF]).sort((a, b) => SST[a.st][2] - SST[b.st][2] || b.val - a.val);
  return `<div class="cd"><div class="fm2" style="grid-template-columns:repeat(3,1fr)"><label><small class="mu">Waktu kirim supplier (hari)</small><input type="number" value="${STK.lead}" onchange="STK.lead=Math.max(1,num(this.value));LS.set('jpos:stkcfg',STK);R()"></label><label><small class="mu">Stok untuk berapa hari</small><input type="number" value="${STK.cover}" onchange="STK.cover=Math.max(3,num(this.value));LS.set('jpos:stkcfg',STK);R()"></label><label><small class="mu">Tingkat aman</small><select onchange="STK.sl=+this.value;LS.set('jpos:stkcfg',STK);R()">${[90, 95, 98, 99].map((v) => `<option ${STK.sl == v ? 'selected' : ''} value="${v}">${v}%</option>`).join('')}</select></label></div></div>
${up.length ? `<div class="cd warn"><b>📅 Momen musiman</b>${up.map((e) => `<p style="margin:4px 0">• <b>${esc(e.n)}</b> ${dstr(e.t)} — permintaan mulai naik ±${e.before} hari sebelumnya${e.t - e.before * D1 > now ? ' (mulai ' + dstr(e.t - e.before * D1) + ')' : ' (<b>sedang berlangsung</b>)'}</p>`).join('')}<small class="mu">Tanggal hari raya Islam adalah perkiraan. Kenaikan dihitung dari riwayat toko pada momen yang sama; bila belum ada, memakai perkiraan per kategori.</small></div>` : ''}
${kpi([['Perlu dipesan', need.length + ' produk'], ['Perkiraan belanja', rp(need.reduce((a, x) => a + x.val, 0))], ['Habis / kritis', L.filter((x) => x.st == 'habis' || x.st == 'kritis').length], ['Berlebih / tidak laku', L.filter((x) => x.st == 'lebih' || x.st == 'mati').length]])}
<div class="seg">${[['need', 'Perlu dipesan'], ['lebih', 'Berlebih & tidak laku'], ['all', 'Semua']].map((x) => `<button class="${STKF == x[0] ? 'a' : ''}" onclick="STKF='${x[0]}';R()">${x[1]}</button>`).join('')}</div>
${rows.map((x) => `<div class="cd"><div class="row" style="margin:0"><span><b>${esc(x.p.n)}</b><br><small class="mu">${esc(x.p.c)} · stok ${x.p.st}${x.cover != null ? ' · cukup ±' + x.cover + ' hari' : ''} · terjual 30hr ${x.sold30}</small></span><span class="chip ${SST[x.st][1]}">${SST[x.st][0]}</span></div>
${x.order ? `<div class="row"><span>Saran pesan</span><b class="lg1" style="font-size:18px">${x.order} ${esc(x.p.u || '')}</b></div><small class="mu">Titik pesan ulang ${x.rop} · stok pengaman ${x.ss} · proyeksi ${x.fday.toFixed(1)}/hari · ±${rp(x.val)}</small>` : ''}
<small class="mu" style="display:block;margin-top:4px">📌 ${esc(x.why.join(' · ') || 'belum ada riwayat penjualan')}</small></div>`).join('') || '<div class="cd"><p class="mu">Tidak ada produk di kategori ini 👍</p></div>'}
<div class="cd"><h3>🔗 Cross-selling (sering dibeli bersama)</h3><small class="mu">Dari transaksi 180 hari. "Lift" &gt; 1 artinya lebih sering dibeli bersama daripada kebetulan — tawarkan bersamaan & stok seimbang.</small>${CS.map((x) => row(esc((prod(x.a) || {}).n || x.a) + ' + ' + esc((prod(x.b) || {}).n || x.b), x.c + '× · lift ' + x.lift.toFixed(1))).join('') || '<p class="mu">Belum cukup data.</p>'}</div>
<div class="wrap"><button class="gh a" onclick="poXlsx()">⬇ Rencana belanja (Excel)</button><button class="gh" onclick="omzXlsx()">⬇ Excel lengkap</button></div>`;
}
function poXlsx() { if (!window.XLSX) return; const L = stockPlan().filter((x) => x.order > 0), r = [['Produk', 'SKU', 'Kategori', 'Stok', 'Qty pesan', 'Harga beli', 'Subtotal', 'Alasan']]; L.forEach((x) => r.push([x.p.n, x.p.sku || '', x.p.c, x.p.st, x.order, x.p.co, x.order * x.p.co, x.why.join('; ')])); r.push([], ['TOTAL', '', '', '', L.reduce((a, x) => a + x.order, 0), '', L.reduce((a, x) => a + x.val, 0)]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), 'Rencana belanja'); saveFile('rencana-belanja-' + dkey(Date.now()) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })])); }
