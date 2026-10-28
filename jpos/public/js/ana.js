'use strict';
/* ============ ANALISA: saran order ke outlet (untuk sales), tren produk, kelayakan kredit outlet ============ */
const DAYMS = 864e5;
// Pola beli tiap outlet per produk: rata-rata jarak antar pembelian & jumlah → produk yang "waktunya" dipesan lagi
function reorderPlan(onlyMine) {
  const now = Date.now(), out = [];
  for (const c of S.c) {
    if (c.x || (onlyMine && c.sl && c.sl != U.n)) continue;
    const ss = S.sales.filter((s) => s.cu == c.id).sort((a, b) => a.t - b.t); if (!ss.length) continue;
    const lastT = ss[ss.length - 1].t, oInt = ss.length > 1 ? Math.max(1, (lastT - ss[0].t) / DAYMS / (ss.length - 1)) : null, since = (now - lastT) / DAYMS;
    const per = {};
    for (const s of ss) for (const i of s.L) { const q = i.q - (i.rq || 0); if (q <= 0) continue; (per[i.id] = per[i.id] || []).push({ t: s.t, q }); }
    const items = [];
    for (const [pid, h] of Object.entries(per)) {
      const p = prod(pid); if (!p || p.x) continue;
      const last = h[h.length - 1], int = h.length > 1 ? Math.max(1, (last.t - h[0].t) / DAYMS / (h.length - 1)) : oInt || 14;
      const due = (last.t + int * DAYMS - now) / DAYMS, recent = h.slice(-3), qty = Math.max(1, Math.round(recent.reduce((a, x) => a + x.q, 0) / recent.length));
      if (due <= 3) items.push({ id: pid, n: p.n, q: Math.min(qty, Math.max(0, p.st)) || qty, st: p.st, due: Math.round(due), int: Math.round(int), times: h.length, val: qty * p.pr });
    }
    items.sort((a, b) => a.due - b.due || b.val - a.val);
    const st = oInt == null ? (since > 14 ? 'lama' : 'baru') : since > oInt * 1.6 ? 'telat' : since >= oInt * 0.8 ? 'waktunya' : 'aman';
    if (items.length || st == 'telat' || st == 'lama')
      out.push({ c, items, val: items.reduce((a, i) => a + i.val, 0), since: Math.floor(since), int: oInt ? Math.round(oInt) : null, st, n: ss.length, dist: typeof MYPOS != 'undefined' && MYPOS && c.lat != null ? haversine(MYPOS.lat, MYPOS.lng, c.lat, c.lng) : null });
  }
  const rank = { telat: 0, waktunya: 1, lama: 2, baru: 3, aman: 4 };
  return out.sort((a, b) => rank[a.st] - rank[b.st] || b.val - a.val);
}
function prodTrend() {
  const now = Date.now(), a = {}, b = {};
  for (const s of S.sales) { const age = (now - s.t) / DAYMS; if (age > 28) continue; const tgt = age <= 14 ? a : b; for (const i of s.L) tgt[i.id] = (tgt[i.id] || 0) + i.q - (i.rq || 0); }
  return S.p.filter((p) => !p.x).map((p) => { const x = a[p.id] || 0, y = b[p.id] || 0; return { p, now: x, prev: y, g: y ? Math.round(((x - y) / y) * 100) : x ? 100 : 0, cover: x ? Math.round(p.st / (x / 14)) : null }; });
}
// skor kredit outlet dari riwayat bayar (piutang) di toko ini
function outletCredit() {
  const now = Date.now();
  return S.c.filter((c) => !c.x).map((c) => {
    const ss = S.sales.filter((s) => s.cu == c.id); if (!ss.length) return null;
    const cr = ss.filter((s) => s.pay == 'Piutang'), paidT = cr.filter((s) => sOut(s) <= 0 && s.pays && s.pays.length);
    const lateDays = paidT.map((s) => (s.pays[s.pays.length - 1].t - s.due) / DAYMS), ontime = lateDays.filter((d) => d <= 0).length, late = lateDays.filter((d) => d > 0).length;
    const od = cr.filter((s) => sOut(s) > 0 && s.due < now).length, owing = outOf(c.id), val = ss.reduce((a, s) => a + s.tot - (s.rtot || 0), 0), months = Math.max(1, (now - Math.min(...ss.map((s) => s.t))) / (30 * DAYMS));
    let sc = 30 + Math.min(25, ss.length * 2) + Math.min(15, months * 3) + (paidT.length ? (20 * ontime) / paidT.length : 8) - 15 * od - 4 * late;
    sc = Math.max(0, Math.min(100, Math.round(sc))); const g = sc >= 75 ? 'A' : sc >= 55 ? 'B' : sc >= 35 ? 'C' : 'D';
    const monthly = val / months, rec = Math.round((monthly * { A: 1.5, B: 1, C: 0.4, D: 0 }[g]) / 50000) * 50000;
    return { c, sc, g, rec, owing, od, n: ss.length, val, ontime, late };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc);
}
const GCOL = { A: 'g', B: '', C: 'o', D: 'r' }, STN = { telat: ['Terlambat order', 'r'], waktunya: ['Waktunya order', 'o'], lama: ['Lama tidak order', 'r'], baru: ['Pelanggan baru', ''], aman: ['Aman', 'g'] };
let ANA = { tab: 'order' };
VW.ana = () => {
  const mine = U.r == 'sales', tabs = [['order', 'Saran order'], ['tren', 'Tren produk'], ...(MGR(U.r) ? [['kredit', 'Kelayakan kredit']] : [])];
  let h = `<div class="seg" style="margin-top:0">${tabs.map((t) => `<button class="${ANA.tab == t[0] ? 'a' : ''}" onclick="ANA.tab='${t[0]}';R()">${t[1]}</button>`).join('')}</div>`;
  if (ANA.tab == 'order') {
    const P = reorderPlan(mine), tot = P.reduce((a, x) => a + x.val, 0);
    h += kpi([['Outlet perlu dikunjungi', P.filter((x) => x.st != 'aman').length], ['Potensi order', rp(tot)], ['Terlambat order', P.filter((x) => x.st == 'telat').length]])
      + `<div class="cd info"><small>Sistem membaca pola belanja tiap outlet (rata-rata jarak antar pembelian & jumlah tiap produk). Produk yang biasanya sudah waktunya dibeli lagi muncul di bawah, lengkap dengan jumlah saran.${mine ? ' Hanya outlet yang menjadi tanggung jawab Anda.' : ''}</small></div>`
      + (P.map((x, i) => `<div class="cd"><div class="row" style="margin:0"><span><b>${esc(x.c.n)}</b><br><small class="mu">Order terakhir ${x.since} hari lalu${x.int ? ' · biasanya tiap ' + x.int + ' hari' : ''} · ${x.n} transaksi${x.dist != null ? ' · ' + distStr(x.dist) : ''}${x.c.sl ? ' · sales ' + esc(x.c.sl) : ''}</small></span><span class="chip ${STN[x.st][1]}">${STN[x.st][0]}</span></div>
${x.items.map((it) => `<div class="row" style="margin:4px 0"><span>${esc(it.n)}<br><small class="mu">${it.due < 0 ? 'lewat ' + -it.due + ' hari' : it.due == 0 ? 'hari ini' : it.due + ' hari lagi'} · tiap ±${it.int} hari · stok gudang ${it.st}</small></span><b>${it.q} <small class="mu">${rp(it.val)}</small></b></div>`).join('') || '<small class="mu">Belum ada pola produk — kunjungi untuk menawarkan.</small>'}
<div class="wrap" style="margin-top:6px">${x.items.length && can('pos') ? `<button class="gh a" onclick="anaOrder(${i})">🛒 Buat order (${x.items.length} produk)</button>` : ''}${x.c.lat != null ? `<a class="gh" target="_blank" href="${mapsUrl(x.c)}">🧭 Navigasi</a>` : ''}${x.c.ph ? `<a class="gh" target="_blank" href="${esc(waLink(x.c.ph, 'Halo ' + x.c.n + ', stok ' + x.items.slice(0, 3).map((i) => i.n).join(', ') + ' sudah mau habis? Kami siap kirim.'))}">WA</a>` : ''}</div></div>`).join('') || '<div class="cd"><p class="mu">Belum ada data cukup. Saran muncul setelah outlet punya riwayat order.</p></div>');
    VW.ana.plan = P;
  } else if (ANA.tab == 'tren') {
    const T = prodTrend(), up = T.filter((x) => x.now > 0).sort((a, b) => b.g - a.g).slice(0, 8), down = T.filter((x) => x.prev > 0 && x.g < 0).sort((a, b) => a.g - b.g).slice(0, 8), run = T.filter((x) => x.cover != null && x.cover <= 14).sort((a, b) => a.cover - b.cover).slice(0, 8), dead = T.filter((x) => !x.now && !x.prev && x.p.st > 0).slice(0, 8);
    const L = (arr, f) => arr.map((x) => row(esc(x.p.n), f(x))).join('') || '<small class="mu">-</small>';
    h += `<div class="two"><div class="cd"><h3>📈 Naik (14 hari vs 14 hari sebelumnya)</h3>${L(up, (x) => `<span class="gr">${x.g > 0 ? '+' : ''}${x.g}%</span> <small class="mu">${x.now} terjual</small>`)}</div><div class="cd"><h3>📉 Turun</h3>${L(down, (x) => `<span class="rd">${x.g}%</span> <small class="mu">${x.now} terjual</small>`)}</div></div>
<div class="two"><div class="cd"><h3>⏳ Stok cepat habis</h3>${L(run, (x) => `<span class="${x.cover <= 7 ? 'rd' : 'or'}">±${x.cover} hari</span> <small class="mu">stok ${x.p.st}</small>`)}</div><div class="cd"><h3>💤 Tidak laku 28 hari</h3>${L(dead, (x) => `<small class="mu">stok ${x.p.st}</small>`)}</div></div>`;
  } else {
    const K = outletCredit();
    h += `<div class="cd info"><small>Skor dari riwayat belanja & pembayaran outlet di toko ini: jumlah transaksi, lama berlangganan, ketepatan bayar piutang, tagihan lewat jatuh tempo. Rekomendasi limit ≈ belanja bulanan × faktor nilai (A 1,5× · B 1× · C 0,4× · D 0).</small></div>`
      + K.map((k) => `<div class="cd"><div class="row" style="margin:0"><span><b>${esc(k.c.n)}</b><br><small class="mu">${k.n} transaksi · ${rp(k.val)} · bayar tepat ${k.ontime}, telat ${k.late}${k.od ? ' · <b class="rd">' + k.od + ' lewat tempo</b>' : ''}</small></span><span class="chip ${GCOL[k.g]}">${k.sc} · ${k.g}</span></div>${row('Status sekarang', k.c.term == 'kredit' ? 'Kredit · limit ' + rp(k.c.lim) : 'Tunai')}${row('Piutang', rp(k.owing))}${row('Rekomendasi limit', '<b>' + (k.rec ? rp(k.rec) : 'tidak disarankan') + '</b>')}${U.r == 'owner' && k.rec ? `<button class="gh a" onclick="anaSetLim('${esc(k.c.id)}',${k.rec})">Terapkan limit ${rp(k.rec)}</button>` : ''}</div>`).join('');
  }
  return h;
};
function anaOrder(i) {
  const x = VW.ana.plan[i]; if (!x) return;
  if (cart.length && !confirm('Keranjang kasir saat ini akan diganti. Lanjut?')) return;
  cart = x.items.filter((it) => it.st > 0).map((it) => ({ id: it.id, q: Math.min(it.q, it.st), ld: '' })); cCu = x.c.id;
  go('pos'); setTimeout(() => cartOpen(true), 100); toast('Order untuk ' + x.c.n + ' disiapkan — periksa jumlah lalu simpan');
}
function anaSetLim(cid, lim) { const c = cust(cid); if (!confirm('Beri ' + c.n + ' fasilitas kredit dengan limit ' + rp(lim) + '?')) return; emit('cu', { c: { id: cid, term: 'kredit', lim, tempo: c.tempo || S.set.tempo || 30 } }); toast('Limit diterapkan'); R(); }
