'use strict';
/* ============ Toko DEMO (lokal, tanpa server) ============ */
async function makeDemo() {
  const id = 'demo', rnd = ((a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(20240601);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (L) => L[Math.floor(rnd() * L.length)];
  LS.del('jpos:s:' + id); SID = id; S = newStore(id, 'Toko Demo Grosir', 'demo@example.com', false);
  const pins = [['Owner', 'owner', '1234'], ['Admin', 'admin', '5555'], ['Kasir', 'kasir', '1111'], ['Akuntan', 'akuntan', '2222'], ['Sales', 'sales', '3333'], ['Budi', 'sales', '4444']];
  for (const [n, r, p] of pins) S.users.push({ n, r, h: await sha(id + ':' + n.toLowerCase() + ':' + p) });
  S.set.addr = 'Jl. Pasar Terong No. 12, Makassar'; S.set.tel = '0411-000000';
  const adm = { n: 'Owner', r: 'owner' }, ksr = { n: 'Kasir', r: 'kasir' }, akn = { n: 'Akuntan', r: 'akuntan' }, sls = [{ n: 'Sales', r: 'sales' }, { n: 'Budi', r: 'sales' }];
  const D = 864e5, T0 = Date.now() - 30 * D;
  U = adm;
  const at = (d, h, m) => { const x = new Date(T0 + d * D); x.setHours(h, m || 0, 0, 0); return x.getTime(); };
  emit('cap', { amt: 30000000, m: 'Bank', t2: 'modal', d: 'Setoran modal awal' }, at(0, 8), adm);
  const P = [
    ['Beras Premium 5kg', 'Sembako', 62000, 71000, 300, 'BR-5', [{ min: 10, d: '2' }, { min: 50, d: '4' }, { min: 100, d: '6+1' }]],
    ['Minyak Goreng 2L', 'Sembako', 31000, 36000, 400, 'MG-2', [{ min: 12, d: '3' }, { min: 60, d: '5' }]],
    ['Gula Pasir 1kg', 'Sembako', 14000, 16500, 500, 'GP-1', [{ min: 20, d: '2' }, { min: 100, d: '4' }]],
    ['Tepung Terigu 1kg', 'Sembako', 10500, 12500, 300, 'TT-1', [{ min: 25, d: '3' }]],
    ['Mi Instan (dus 40)', 'Makanan', 95000, 108000, 200, 'MI-40', [{ min: 5, d: '2' }, { min: 20, d: '5' }]],
    ['Kopi Sachet (renceng)', 'Minuman', 17000, 20000, 350, 'KP-R', [{ min: 10, d: '3' }]],
    ['Teh Celup (dus)', 'Minuman', 21000, 25000, 250, 'TH-D', [{ min: 10, d: '3' }]],
    ['Air Mineral 600ml (dus)', 'Minuman', 38000, 45000, 300, 'AM-D', [{ min: 10, d: '2' }, { min: 40, d: '5' }]],
    ['Sabun Mandi (dus)', 'Kebutuhan', 54000, 63000, 120, 'SM-D', [{ min: 6, d: '3' }]],
    ['Deterjen 800g', 'Kebutuhan', 16500, 19500, 280, 'DT-8', [{ min: 24, d: '4' }]],
    ['Kecap Manis 600ml', 'Bumbu', 17500, 21000, 200, 'KC-6', [{ min: 12, d: '3' }]],
    ['Garam Halus 250g', 'Bumbu', 2600, 3500, 600, 'GM-2', [{ min: 50, d: '5' }]],
  ];
  P.forEach((x, i) => emit('pu', { p: { id: 'p' + (i + 1), n: x[0], c: x[1], pr: x[3], co: x[2], s0: x[4]*2, sku: x[5], tiers: x[6], min: 40 } }, at(0, 9), adm));
  const O = [
    ['Warung Daeng Tata', -5.1477, 119.4327, 'cash', 0, 'Sales'], ['Toko Berkah Jaya', -5.1352, 119.4209, 'kredit', 15000000, 'Sales'], ['Minimarket Sinar', -5.1703, 119.4411, 'kredit', 25000000, 'Budi'],
    ['Kios Ibu Rahma', -5.1561, 119.4093, 'cash', 0, 'Budi'], ['Toko Sumber Rejeki', -5.1209, 119.4655, 'kredit', 20000000, 'Sales'], ['Warung Makan Bu Indah', -5.1824, 119.4562, 'kredit', 8000000, 'Budi'],
    ['Toko Bintang', -5.1398, 119.4511, 'kredit', 12000000, 'Sales'], ['Kantin Kampus Unhas', -5.1315, 119.4871, 'cash', 0, 'Budi'],
  ];
  O.forEach((o, i) => emit('cu', { c: { id: 'c' + (i + 1), n: o[0], ph: '0812' + ri(10000000, 99999999), ad: 'Makassar', lat: o[1], lng: o[2], term: o[3], lim: o[4], tempo: 30, sl: o[5], note: '' } }, at(0, 10), adm));
  const cred = S.c.filter((c) => c.term == 'kredit').map((c) => c.id);
  const Q = {};
  for (let d = 1; d <= 30; d++) {
    (Q[d] || []).forEach((x) => { const sl = S.sales.find((y) => y.no == x.no); if (sl && sOut(sl) > 0) emit('pay', { sale: x.no, amt: Math.max(1, Math.round(sOut(sl) * x.f)), m: x.m }, at(d, 14), adm); });
    // absensi
    [ksr, akn, adm, ...sls].forEach((u, k) => {
      if (u.n != 'Owner' && rnd() < 0.08) return;
      const late = rnd() < 0.15;
      emit('in', { lat: -5.147 + (rnd() - .5) * .002, lng: 119.432 + (rnd() - .5) * .002, note: '' }, at(d, 8 + (late ? 1 : 0), late ? ri(15, 40) : ri(0, 8)), u);
      emit('out', { lat: -5.147, lng: 119.432, note: '' }, at(d, 17, ri(0, 40)), u);
    });
    // restok
    if (d == 8 || d == 20) for (let i = 1; i <= 12; i++) { const pr = prod('p' + i), q = ri(80, 200); emit('stk', { p: pr.id, qty: q, cost: pr.co, cr: i % 2 == 0, sup: pick(['CV Mitra Pangan', 'PT Sumber Pangan', 'UD Maju Makmur']), tempo: 30, m: 'Bank' }, at(d, 9, 30), adm); }
    if (d % 7 == 1) emit('exp', { a: '6101', amt: 1500000, m: 'Tunai', d: 'Gaji mingguan' }, at(d, 16), adm);
    if (d % 10 == 5) emit('exp', { a: '6103', amt: ri(300, 600) * 1000, m: 'Tunai', d: 'Listrik & air' }, at(d, 16), adm);
    if (d == 3) emit('exp', { a: '6102', amt: 2500000, m: 'Bank', d: 'Sewa gudang' }, at(d, 11), adm);
    if (d % 4 == 0) emit('exp', { a: '6106', amt: ri(150, 350) * 1000, m: 'Tunai', d: 'BBM & transport pengiriman' }, at(d, 15), adm);
    // penjualan
    const n = ri(4, 8) + (d % 7 == 6 ? 2 : 0);
    for (let k = 0; k < n; k++) {
      const bySales = rnd() < 0.45, by = bySales ? pick(sls) : ksr, mine = S.c.filter((c) => !c.x && c.sl == by.n);
      const c = bySales ? pick(mine) : rnd() < 0.3 ? pick(S.c) : null, items = [];
      for (let q = ri(1, 4); q > 0; q--) { const p = pick(S.p), qty = bySales ? ri(5, 60) : ri(1, 15); if (!items.some((x) => x.id == p.id) && p.st >= qty) items.push({ id: p.id, q: qty }); }
      if (!items.length) continue;
      const useCredit = c && c.term == 'kredit' && rnd() < 0.6, pay = useCredit ? 'Piutang' : pick(['Tunai', 'Tunai', 'QRIS', 'Transfer']);
      try {
        const s = mkSale({ items, cd: rnd() < 0.1 ? '2' : '', pay, cu: c ? c.id : '', dpay: useCredit && rnd() < 0.3 ? 500000 : 0, dpm: 'Tunai' }, at(d, ri(8, 17), ri(0, 59)), by);
        if (pay == 'Piutang' && d < 24 && rnd() < 0.7) { const dd = d + ri(3, 6); (Q[dd] = Q[dd] || []).push({ no: s.no, f: rnd() < 0.5 ? 1 : 0.5, m: pick(['Tunai', 'Transfer']) }); }
      } catch (e) { /* kredit melebihi limit dsb. dilewati */ }
    }
    // kunjungan sales
    sls.forEach((u) => { for (let v = ri(1, 3); v > 0; v--) { const mine = S.c.filter((c) => c.sl == u.n), c = pick(mine); emit('visit', { cid: c.id, cn: c.n, lat: c.lat, lng: c.lng, dist: ri(5, 90), note: pick(['Order rutin', 'Cek stok rak', 'Tagih piutang', 'Tawarkan promo']) }, at(d, ri(9, 16), ri(0, 59)), u); } });
  }
  setReg(id, S.name, true); U = null; save(); flushSave();
  return id;
}
