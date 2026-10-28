'use strict';
/* ============ util ============ */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => (n < 0 ? '−' : '') + 'Rp' + Math.abs(Math.round(n || 0)).toLocaleString('id-ID');
const num = (v) => { const n = Math.round(parseFloat(String(v).replace(/[^\d.-]/g, ''))); return isNaN(n) ? 0 : n; };
const pad = (n) => String(n).padStart(2, '0');
const dstr = (t) => { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
const hm = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const tstr = (t) => dstr(t) + ' ' + hm(t);
const dkey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const mkey = (t) => dkey(t).slice(0, 7);
const COL = ['#6c5ce7', '#00c2a8', '#ff9f43', '#ff5d73', '#54a0ff', '#a29bfe', '#fdcb6e'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
function toast(m, ms = 2600) { const t = document.createElement('div'); t.className = 'ts'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function modal(html, cls = '') {
  const m = document.createElement('div'); m.className = 'md';
  m.innerHTML = `<div class="dg ${cls}">${html}</div>`;
  m.addEventListener('mousedown', (e) => { if (e.target === m) m.close(); });
  m.close = () => { m.remove(); if (m.onclose) m.onclose(); };
  document.body.appendChild(m); return m;
}
const haversine = (a, b, c, d) => { const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(h)); };
const distStr = (m) => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km');

/* ============ akun ============ */
const AC = { 1101: 'Kas', 1102: 'Bank & QRIS', 1103: 'Piutang Usaha', 1201: 'Persediaan', 2101: 'Utang PPN', 2102: 'Utang Usaha', 3101: 'Modal Pemilik', 3102: 'Prive', 4101: 'Penjualan', 4102: 'Diskon Penjualan', 5101: 'Harga Pokok Penjualan', 6101: 'Beban Gaji', 6102: 'Beban Sewa', 6103: 'Beban Listrik & Air', 6104: 'Beban Lain-lain', 6105: 'Selisih Stok', 6106: 'Beban Transport & BBM', 6107: 'Komisi Sales', 6108: 'Beban Pemasaran' };
const EXPA = ['6101', '6102', '6103', '6104', '6106', '6107', '6108'];
const ROLE = { owner: 'Pemilik (Owner)', admin: 'Admin Toko', akuntan: 'Akuntan', kasir: 'Kasir', sales: 'Sales' };
const MGR = (r) => r == 'owner' || r == 'admin' || r == 'akuntan';
// Hak akses fitur per peran (owner = semua). Sama dengan pembatasan di server.
const PERM = {
  owner: '*',
  admin: 'dash pos his hisAll prod prodEdit outlet onl ana lap keu jur abs absAll chat usr retur backup set',
  akuntan: 'dash his hisAll prod lap keu jur abs absAll chat set',
  kasir: 'dash pos his abs chat set',
  sales: 'dash pos his outlet ana abs chat set',
};
const can = (f, r) => { r = r || (U && U.r); return PERM[r] == '*' || (PERM[r] || '').split(' ').includes(f); };
const ALLOWK = { admin: ['sale', 'pay', 'retur', 'stk', 'apay', 'opn', 'exp', 'jm', 'pu', 'cu', 'in', 'out', 'visit'], akuntan: ['pay', 'apay', 'exp', 'jm', 'opn', 'in', 'out'], kasir: ['sale', 'pay', 'in', 'out'], sales: ['sale', 'pay', 'in', 'out', 'visit', 'cu'] };
// Masa aktif toko (trial / langganan) — dicek juga saat offline dari data terakhir server.
const isExp = () => !!(S && S.exp && Date.now() > S.exp);
const daysLeft = () => (S && S.exp ? Math.ceil((S.exp - Date.now()) / 864e5) : null);

/* ============ state toko ============ */
let AP = '', SID = null, S = null, U = null, V = 'dash';
const REG = () => LS.get('jpos:reg', []);
const setReg = (id, n, demo) => { const r = REG().filter((x) => x.id != id); r.push({ id, n, demo: !!demo }); LS.set('jpos:reg', r); };
const TK = () => LS.get('jpos:tk:' + SID, '');
function newStore(id, name, email, srv) {
  return { v4: 1, exp: 0, plan: '', id, name, email: email || '', srv: !!srv, set: { ppn: 11, tempo: 30, addr: '', tel: '', jin: '08:00', od: false }, logo: '', p: [], c: [], sales: [], j: [], ap: [], att: [], users: [], done: {}, pend: {}, eq: [], cq: [], cs: {}, ec: 0, seq: 1, dv: Math.random().toString(36).slice(2, 5), hold: [], staff: [] };
}
let saveT = null;
function save() { if (!S) return; clearTimeout(saveT); saveT = setTimeout(flushSave, 400); }
function flushSave() { clearTimeout(saveT); saveT = null; if (S && !LS.set('jpos:s:' + SID, S) && !flushSave.w) { flushSave.w = 1; toast('Penyimpanan perangkat penuh! Ekspor backup lalu kosongkan data lama.', 7000); } }
addEventListener('pagehide', flushSave); document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
function loadStore(id) { const s = LS.get('jpos:s:' + id, null); if (!s) return false; SID = id; S = s; for (const k of ['p', 'c', 'sales', 'j', 'ap', 'att', 'users', 'eq', 'cq', 'hold', 'staff']) S[k] = S[k] || []; S.done = S.done || {}; S.pend = S.pend || {}; S.cs = S.cs || {}; S.set = Object.assign({ ppn: 11, tempo: 30, jin: '08:00' }, S.set || {});
  if (!S.v4) { const o = S.users.find((u) => u.r == 'admin'); if (o && !S.users.some((u) => u.r == 'owner')) o.r = 'owner'; S.v4 = 1; }
  return true; }

/* ============ akuntansi (hasil putar ulang kejadian) ============ */
const prod = (id) => S.p.find((x) => x.id == id);
const cust = (id) => S.c.find((x) => x.id == id);
const payAcc = (m) => (m == 'Tunai' ? '1101' : '1102');
function jr(e, d, l) {
  l = l.filter((x) => x[1] || x[2]);
  const dr = l.reduce((a, x) => a + x[1], 0), cr = l.reduce((a, x) => a + x[2], 0);
  if (Math.abs(dr - cr) > 1) { console.error('Jurnal tidak seimbang', e.no, d, dr, cr); return; }
  if (l.length) S.j.push({ id: S.j.length + 1, t: e.t, d, l, k: e.k, sr: e.no });
}
const cfac = (s) => String(s || '').split('+').reduce((a, x) => { const v = parseFloat(x.replace(',', '.')); return a * (isNaN(v) || v <= 0 ? 1 : 1 - Math.min(v, 100) / 100); }, 1);
const tierOf = (p, q) => (p.tiers || []).filter((t) => q >= t.min).sort((a, b) => b.min - a.min)[0];
const sOut = (s) => (s.pay == 'Piutang' ? Math.max(0, s.tot - (s.rtot || 0) - (s.pa || 0)) : 0);
const outOf = (cid) => S.sales.filter((s) => s.cu == cid).reduce((a, s) => a + sOut(s), 0);
const overdue = (cid) => S.sales.filter((s) => s.cu == cid && sOut(s) > 0 && s.due < Date.now()).reduce((a, s) => a + sOut(s), 0);
const apOut = (a) => Math.max(0, a.amt - (a.pa || 0));

const Ap = {
  sale(e) {
    if (S.sales.some((x) => x.no == e.no)) return;
    let paid = e.pay == 'Piutang' ? Math.min(e.dpay || 0, e.tot) : e.tot;
    const ar = e.tot - paid;
    S.sales.push({ ...e, pa: paid });
    for (const i of e.L) { const p = prod(i.id); if (p) p.st -= i.q; }
    jr(e, 'Penjualan ' + e.no + ' (' + e.pay + ')', [[payAcc(e.pay == 'Piutang' ? e.dpm || 'Tunai' : e.pay), paid, 0], ['1103', ar, 0], ['4102', e.disc, 0], ['4101', 0, e.sub], ['2101', 0, e.tax]]);
    jr(e, 'HPP ' + e.no, [['5101', e.hpp, 0], ['1201', 0, e.hpp]]);
    (S.pend[e.no] || []).forEach((x) => { delete S.done[x.no]; apply(x); S.done[x.no] = 1; }); delete S.pend[e.no];
  },
  pay(e) {
    const s = S.sales.find((x) => x.no == e.sale);
    if (!s) { (S.pend[e.sale] = S.pend[e.sale] || []).push(e); return; }
    const amt = Math.min(e.amt, sOut(s)); if (amt <= 0) return;
    s.pa = (s.pa || 0) + amt; (s.pays = s.pays || []).push({ t: e.t, amt, m: e.m || 'Tunai', u: e.u });
    jr(e, 'Pelunasan ' + s.no + (s.cn ? ' · ' + s.cn : ''), [[payAcc(e.m || 'Tunai'), amt, 0], ['1103', 0, amt]]);
  },
  retur(e) {
    const s = S.sales.find((x) => x.no == e.sale);
    if (!s) { (S.pend[e.sale] = S.pend[e.sale] || []).push(e); return; }
    const net0 = s.L.reduce((a, i) => a + i.p * i.q - i.dd, 0), cdA = s.cdA || 0;
    let g = 0, dd = 0, hc = 0;
    for (const r of e.L) {
      const i = s.L.find((x) => x.id == r.id); if (!i) continue;
      const q = Math.min(r.q, i.q - (i.rq || 0)); if (q <= 0) continue;
      g += i.p * q; dd += Math.round(i.dd * q / i.q); hc += i.hc * q; i.rq = (i.rq || 0) + q;
      const p = prod(i.id); if (p) p.st += q;
    }
    if (!g) return;
    const lnet = g - dd, cs = net0 ? Math.round(cdA * lnet / net0) : 0, tr = net0 - cdA ? Math.round(s.tax * (lnet - cs) / (net0 - cdA)) : 0;
    const discr = dd + cs, tot = g - discr + tr, before = s.rtot || 0;
    s.rtot = before + tot; s.rn = (s.rn || 0) + (g - discr);
    let ar = 0;
    if (s.pay == 'Piutang') ar = Math.min(tot, Math.max(0, s.tot - before - (s.pa || 0)));
    const cash = tot - ar, acc = payAcc(s.pay == 'Piutang' ? e.m || 'Tunai' : s.pay);
    jr(e, 'Retur ' + s.no, [['4101', g, 0], ['2101', tr, 0], ['4102', 0, discr], ['1103', 0, ar], [acc, 0, cash]]);
    jr(e, 'HPP retur ' + s.no, [['1201', hc, 0], ['5101', 0, hc]]);
  },
  stk(e) {
    const p = prod(e.p); if (!p || !(e.qty > 0)) return;
    const v = Math.round(e.qty * e.cost), base = Math.max(p.st, 0);
    p.co = Math.round((base * p.co + v) / (base + e.qty)); p.st += e.qty;
    if (e.cr) S.ap.push({ id: e.no, t: e.t, sup: e.sup || '-', d: 'Restok ' + p.n + ' ×' + e.qty, amt: v, pa: 0, due: e.t + (e.tempo || 30) * 864e5 });
    jr(e, 'Restok ' + p.n + ' ×' + e.qty + (e.sup ? ' · ' + e.sup : ''), [['1201', v, 0], [e.cr ? '2102' : payAcc(e.m || 'Tunai'), 0, v]]);
  },
  apay(e) {
    const a = S.ap.find((x) => x.id == e.ap); if (!a) return;
    const amt = Math.min(e.amt, apOut(a)); if (amt <= 0) return;
    a.pa = (a.pa || 0) + amt;
    jr(e, 'Bayar utang ' + a.sup, [['2102', amt, 0], [payAcc(e.m || 'Tunai'), 0, amt]]);
  },
  opn(e) {
    const p = prod(e.p); if (!p || !e.delta) return;
    p.st += e.delta; const v = Math.abs(Math.round(e.delta * p.co));
    jr(e, 'Opname ' + p.n + ' (' + (e.delta > 0 ? '+' : '') + e.delta + ')', e.delta < 0 ? [['6105', v, 0], ['1201', 0, v]] : [['1201', v, 0], ['6105', 0, v]]);
  },
  exp(e) { if (!AC[e.a] || !(e.amt > 0)) return; jr(e, e.d || AC[e.a], [[e.a, e.amt, 0], [payAcc(e.m || 'Tunai'), 0, e.amt]]); },
  cap(e) {
    if (!(e.amt > 0)) return;
    if (e.t2 == 'prive') jr(e, e.d || 'Prive', [['3102', e.amt, 0], [payAcc(e.m || 'Tunai'), 0, e.amt]]);
    else jr(e, e.d || 'Setoran modal', [[payAcc(e.m || 'Tunai'), e.amt, 0], ['3101', 0, e.amt]]);
  },
  jm(e) { if (!Array.isArray(e.l) || !e.l.every((x) => AC[x[0]])) return; jr(e, e.d || 'Jurnal manual', e.l.map((x) => [String(x[0]), Math.abs(+x[1] || 0), Math.abs(+x[2] || 0)])); },
  pu(e) {
    const q = e.p || {}; if (!/^[\w-]{1,40}$/.test(String(q.id))) return; let p = prod(q.id);
    if (!p) {
      p = { id: q.id, n: '', c: 'Umum', pr: 0, co: 0, st: 0, sku: '', tiers: [], min: 10 }; S.p.push(p);
      const s0 = Math.max(0, Math.round(+q.s0 || 0)); p.co = Math.round(+q.co) || 0;
      if (s0 > 0) { p.st = s0; jr(e, 'Saldo awal persediaan ' + q.n, [['1201', s0 * p.co, 0], ['3101', 0, s0 * p.co]]); }
    } else if ('co' in q) p.co = Math.round(+q.co) || 0;
    for (const f of ['n', 'c', 'pr', 'sku', 'img', 'tiers', 'min', 'x', 'opr', 'u', 'on']) if (f in q) p[f] = q[f];
  },
  cu(e) {
    const q = e.c || {}; if (!/^[\w-]{1,40}$/.test(String(q.id))) return; let c = cust(q.id);
    if (!c) { c = { id: q.id, n: '', ph: '', ad: '', lat: null, lng: null, term: 'cash', lim: 0, tempo: S.set.tempo || 30, sl: e.r == 'sales' ? e.u : '', note: '', t: e.t }; S.c.push(c); }
    for (const f of ['n', 'ph', 'ad', 'lat', 'lng', 'note']) if (f in q) c[f] = q[f];
    if (MGR(e.r) && 'sl' in q) c.sl = q.sl;
    if (e.r == 'owner') for (const f of ['term', 'lim', 'tempo', 'x']) if (f in q) c[f] = q[f]; // hanya pemilik yang mengatur kredit
  },
  set(e) { if (e.r != 'owner') return; Object.assign(S.set, e.set || {}); if (e.name) S.name = e.name; if ('logo' in e) S.logo = e.logo; },
  in(e) { S.att.push({ no: e.no, k: 'in', t: e.t, u: e.u, lat: e.lat, lng: e.lng, note: e.note }); },
  out(e) { S.att.push({ no: e.no, k: 'out', t: e.t, u: e.u, lat: e.lat, lng: e.lng, note: e.note }); },
  visit(e) { S.att.push({ no: e.no, k: 'visit', t: e.t, u: e.u, cid: e.cid, cn: e.cn, lat: e.lat, lng: e.lng, dist: e.dist, note: e.note }); },
};
const NEED_MGR = new Set(['stk', 'apay', 'opn', 'exp', 'cap', 'jm', 'pu', 'retur']);
function apply(e) {
  if (!e || S.done[e.no]) return false;
  S.done[e.no] = 1;
  if (NEED_MGR.has(e.k) && !MGR(e.r) && e.r) return false;
  if (e.r && ALLOWK[e.r] && !ALLOWK[e.r].includes(e.k)) return false;
  try { (Ap[e.k] || (() => { }))(e); } catch (x) { console.error('apply gagal', e && e.no, x); }
  return true;
}
function emit(k, data, t, by) {
  const a = by || U;
  if (!by && isExp()) { toast('Masa aktif toko habis — data hanya bisa dilihat. Hubungi pemilik aplikasi untuk perpanjangan.', 6000); throw new Error('Masa aktif toko habis'); }
  const e = { no: k + '-' + S.dv + '-' + (S.seq++), k, t: t || Date.now(), u: a.n, r: a.r, ...data };
  apply(e);
  if (S.srv) S.eq.push(e);
  save(); if (typeof kick == 'function') kick();
  return e;
}

/* ============ penjualan ============ */
function calc(items, cd) {
  let sub = 0, ldt = 0, net = 0;
  const lines = items.map((i) => {
    const p = prod(i.id), q = i.q, price = i.pp > 0 ? i.pp : p.pr, gross = price * q, tr = i.pp > 0 ? null : tierOf(p, q);
    const dd = Math.round(gross * (1 - cfac(tr && tr.d) * cfac(i.ld)));
    sub += gross; ldt += dd; net += gross - dd;
    return { id: p.id, n: p.n, q, p: price, dd, hc: p.co, tier: tr ? tr.d : '', ld: i.ld || '' };
  });
  const cdA = Math.round(net * (1 - cfac(cd))), disc = ldt + cdA, tax = Math.round((net - cdA) * (S.set.ppn || 0) / 100);
  return { lines, sub, ldt, cdA, disc, tax, tot: sub - disc + tax, hpp: lines.reduce((a, l) => a + l.hc * l.q, 0) };
}
function mkSale(o, t, by) { // o: {items,cd,pay,cu,dpay,dpm,note}; melempar Error(pesan) bila ditolak
  const a = by || U;
  if (!o.items.length) throw new Error('Keranjang kosong');
  for (const i of o.items) { const p = prod(i.id); if (!p) throw new Error('Produk tidak ditemukan'); if (p.st < i.q) throw new Error('Stok ' + p.n + ' kurang (sisa ' + p.st + ')'); }
  const c = o.cu ? cust(o.cu) : null, r = calc(o.items, o.cd);
  if (a.r == 'sales' && !c) throw new Error('Pilih outlet pelanggan dulu');
  if (o.pay == 'Piutang') {
    if (!c) throw new Error('Pilih outlet untuk penjualan kredit');
    if (c.term != 'kredit') throw new Error('Outlet ini hanya boleh bayar tunai (belum diberi fasilitas kredit oleh pemilik)');
    const dp = Math.min(o.dpay || 0, r.tot), newAr = r.tot - dp, out = outOf(c.id);
    if (out + newAr > (c.lim || 0)) {
      const msg = 'Melebihi limit kredit ' + c.n + ': limit ' + rp(c.lim) + ', piutang ' + rp(out) + ' + transaksi ini ' + rp(newAr);
      if (a.r != 'owner') throw new Error(msg);
      if (!confirm(msg + '\n\nSebagai pemilik, tetap lanjutkan?')) throw new Error('Dibatalkan');
    }
    if (S.set.od && overdue(c.id) > 0) {
      const msg = c.n + ' punya tagihan jatuh tempo ' + rp(overdue(c.id));
      if (a.r != 'owner') throw new Error(msg + ' — lunasi dulu');
      if (!confirm(msg + '\n\nLanjutkan?')) throw new Error('Dibatalkan');
    }
  }
  const tm = t || Date.now();
  const ev = emit('sale', { tot: r.tot, sub: r.sub, disc: r.disc, cdA: r.cdA, cd: o.cd || '', tax: r.tax, hpp: r.hpp, L: r.lines, pay: o.pay, cu: c ? c.id : '', cn: c ? c.n : '', dpay: o.pay == 'Piutang' ? Math.min(o.dpay || 0, r.tot) : 0, dpm: o.dpm || 'Tunai', due: o.pay == 'Piutang' ? tm + (c.tempo || 30) * 864e5 : 0, note: o.note || '', ppn: S.set.ppn || 0 }, tm, by);
  return S.sales.find((x) => x.no == ev.no);
}
const netSale = (s) => s.sub - s.disc - (s.rn || 0); // penjualan bersih (tanpa PPN) setelah retur

/* ============ laporan (dari jurnal) ============ */
function bal(a, f = 0, t = 1e15) { let s = 0; for (const e of S.j) if (e.t >= f && e.t <= t) for (const x of e.l) if (x[0] == a) s += x[1] - x[2]; return s; }
function lr(f = 0, t = 1e15) {
  const b = (a) => bal(a, f, t), rev = -b('4101'), dc = b('4102'), hpp = b('5101');
  const ex = [...EXPA, '6105'].map((a) => [a, AC[a], b(a)]).filter((x) => x[2]), te = ex.reduce((a, x) => a + x[2], 0);
  return { rev, dc, hpp, ex, net: rev - dc, gp: rev - dc - hpp, te, laba: rev - dc - hpp - te };
}
function neraca(t = 1e15) {
  const b = (a) => bal(a, 0, t), L = lr(0, t);
  const as = ['1101', '1102', '1103', '1201'].map((a) => [a, AC[a], b(a)]), ta = as.reduce((a, x) => a + x[2], 0);
  const li = ['2101', '2102'].map((a) => [a, AC[a], -b(a)]), tl = li.reduce((a, x) => a + x[2], 0);
  const eq = [['3101', AC['3101'], -b('3101')], ['3102', AC['3102'], -b('3102')], ['', 'Laba (rugi) berjalan', L.laba]], te = eq.reduce((a, x) => a + x[2], 0);
  return { as, ta, li, tl, eq, te, ok: Math.round(ta) == Math.round(tl + te) };
}
function neracaSaldo(f = 0, t = 1e15) { return Object.keys(AC).map((a) => { const s = bal(a, f, t); return [a, AC[a], s > 0 ? s : 0, s < 0 ? -s : 0]; }).filter((x) => x[2] || x[3]); }
function ledger(a, f = 0, t = 1e15) {
  let sd = bal(a, 0, f - 1); const rows = [];
  for (const e of S.j) if (e.t >= f && e.t <= t) for (const x of e.l) if (x[0] == a) { sd += x[1] - x[2]; rows.push({ e, dr: x[1], cr: x[2], sd }); }
  return { open: bal(a, 0, f - 1), rows, close: sd };
}
const CASHK = { sale: 'Penerimaan penjualan', pay: 'Penerimaan piutang', retur: 'Retur penjualan', stk: 'Pembelian stok', apay: 'Pembayaran utang usaha', exp: 'Beban operasional', cap: 'Modal / prive', opn: 'Lain-lain', jm: 'Lain-lain', pu: 'Saldo awal / lain-lain' };
function cashflow(f = 0, t = 1e15) {
  const g = {}; let open = 0;
  for (const e of S.j) {
    const d = e.l.reduce((a, x) => (x[0] == '1101' || x[0] == '1102' ? a + x[1] - x[2] : a), 0); if (!d) continue;
    if (e.t < f) open += d; else if (e.t <= t) { const k = CASHK[e.k] || 'Lain-lain'; g[k] = (g[k] || 0) + d; }
  }
  const rows = Object.entries(g).map(([k, v]) => [k, v]), inn = rows.filter((r) => r[1] > 0).reduce((a, r) => a + r[1], 0), out = rows.filter((r) => r[1] < 0).reduce((a, r) => a + r[1], 0);
  return { open, rows, inn, out, close: open + inn + out };
}
const stockValue = () => S.p.reduce((a, p) => a + Math.max(0, p.st) * p.co, 0);
const salesIn = (f = 0, t = 1e15) => S.sales.filter((s) => s.t >= f && s.t <= t);
