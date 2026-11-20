'use strict';
/* ============ Pesan dari meja (scan QR) — langsung ke menu toko, tanpa toko online/marketplace ============ */
const BY = {
  tk: LS.get('jpos:bt', ''), me: LS.get('jpos:bme', null), pg: 'store', q: '',
  store: null, prod: null, od: null, items: [],
  carts: LS.get('jpos:bcarts', null) || (() => { const o = LS.get('jpos:bcart', null); return o && o.store ? { [o.store]: { sn: o.sn, items: o.items } } : {}; })(),
  orders: [], ordSt: {}, ordTab: 'all', reviewed: [], meja: '', coNote: '',
};
const bApi = (p, o) => api(p, o || {}, BY.tk || '');
const bPost = (p, b) => bApi(p, { method: 'POST', body: JSON.stringify(b) });
const bSave = () => LS.set('jpos:bcarts', BY.carts);
const cartN = () => Object.values(BY.carts).reduce((a, c) => a + Object.values(c.items).reduce((x, i) => x + i.q, 0), 0);
const BST = { nego: ['Menunggu konfirmasi', 'o'], nego_toko: ['Menunggu konfirmasi', 'o'], acc_kredit: ['Menunggu konfirmasi', 'o'], baru: ['Menunggu konfirmasi', 'o'], diproses: ['Sedang disiapkan', ''], dikirim: ['Siap disajikan/diambil', 'g'], selesai: ['Selesai', 'g'], batal: ['Dibatalkan', 'r'], ditolak: ['Ditolak', 'r'] };
const BPAGES = [['store', '🍽️', 'Menu'], ['cart', '🛒', 'Keranjang'], ['ord', '🧾', 'Pesanan']];
const CATI = { sembako: '🍚', beras: '🍚', minuman: '🥤', makanan: '🍜', bumbu: '🧂', kebutuhan: '🧴', kresek: '🛍️', plastik: '🛍️', snack: '🍪', rokok: '🚬', obat: '💊', bayi: '🍼', elektronik: '🔌', atk: '✏️', pakaian: '👕', kosmetik: '💄', kopi: '☕', telur: '🥚', minyak: '🫗', gula: '🍬', umum: '📦' };
const catIcon = (c) => { const k = String(c || '').toLowerCase(); for (const [x, v] of Object.entries(CATI)) if (k.includes(x)) return v; return '🏷️'; };
function buyerGo(pg) { BY.pg = pg; R(); window.scrollTo(0, 0); }
function bBack() { buyerGo({ prod: 'store', od: 'ord', co: 'cart' }[BY.pg] || 'store'); }
function bExit() { MODE = 'home'; document.body.classList.remove('in', 'buyer'); R(); }
function buyerShell() {
  document.body.classList.add('buyer');
  const n = cartN();
  const P = { store: bStore, prod: bProdPage, cart: bCart, co: bCheckoutPage, ord: bOrders, od: bOrderDetail };
  let body; try { body = (P[BY.pg] || bStore)(); } catch (e) { console.error(e); body = '<p class="rd">' + esc(e.message) + '</p>'; }
  const T = { cart: 'Keranjang', co: 'Pesanan & pembayaran', ord: 'Pesanan saya', od: 'Detail pesanan', store: 'Menu', prod: '' };
  const cartBtn = `<button class="bic" onclick="buyerGo('cart')">🛒${n ? `<em>${n}</em>` : ''}</button>`;
  const top = `<header class="bh"><button class="bic" onclick="bBack()">‹</button><b>${esc(T[BY.pg] || '')}</b><span class="sp"></span>${BY.pg != 'cart' ? cartBtn : ''}</header>`;
  const nav = ['prod', 'co', 'od'].includes(BY.pg) ? '' : `<nav class="bn">${BPAGES.map((p) => `<button class="${BY.pg == p[0] ? 'a' : ''}" onclick="buyerGo('${p[0]}')"><i>${p[1]}</i><span>${p[2]}</span></button>`).join('')}</nav>`;
  return `${top}<main class="bmain ${nav ? '' : 'nonav'}">${body}</main>${nav}`;
}
function bAfter() { if (['ord', 'od'].includes(BY.pg)) bLoadOrders(); }

/* ---- kartu & gambar produk ---- */
const pimg = (x, cls) => `<em class="${cls || 'bimg'}" style="background:${COL[(x.c || x.n || '').length % COL.length]}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : `<span>${catIcon(x.c)}</span>`}</em>`;
const disc = (x) => (x.fsp && x.orig > x.price ? Math.round((1 - x.price / x.orig) * 100) : 0);
const pcardB = (x) => `<button class="bpc" onclick="bProd('${esc(x.sid)}','${esc(x.pid)}')">${pimg(x)}<div class="bpb"><b>${esc(x.n)}</b><div class="bpr"><span>${rp(x.price)}</span></div>${disc(x) ? `<div class="bpo"><i>${disc(x)}%</i><s>${rp(x.orig)}</s></div>` : ''}<small class="bst">${x.st > 0 ? '<b class="gr">Stok ' + x.st + '</b>' : '<b class="rd">Habis</b>'}</small></div></button>`;

/* ---- sesi tamu diam-diam (tanpa layar login) — dibuat sekali per HP, dipakai lagi tiap pesan ---- */
async function bEnsureGuest() {
  if (BY.tk) return true;
  if (!canNet()) { toast('Butuh internet untuk memesan'); return false; }
  let g = LS.get('jpos:bguest', null);
  if (g) {
    try { const r = await api('/api/b/login', { method: 'POST', body: JSON.stringify({ phone: g.phone, pin: g.pin }) }, ''); BY.tk = r.token; BY.me = r.me; LS.set('jpos:bt', BY.tk); LS.set('jpos:bme', BY.me); return true; } catch (e) { }
  }
  try {
    g = { phone: '0' + String(Math.floor(1e9 + Math.random() * 9e9)).slice(0, 10), pin: String(1000 + Math.floor(Math.random() * 9000)) };
    const r = await api('/api/b/register', { method: 'POST', body: JSON.stringify({ phone: g.phone, name: 'Tamu', pin: g.pin }) }, '');
    LS.set('jpos:bguest', g); BY.tk = r.token; BY.me = r.me; LS.set('jpos:bt', BY.tk); LS.set('jpos:bme', BY.me); return true;
  } catch (e) { toast('Gagal menyiapkan sesi pemesanan: ' + e.message, 5000); return false; }
}

/* ---- halaman menu toko (dibuka langsung lewat QR meja) ---- */
async function bOpenStore(sid) {
  BY.store = { id: sid, d: null, q: '' }; buyerGo('store');
  try { BY.store.d = await bApi('/api/b/shop?s=' + encodeURIComponent(sid)); } catch (e) { toast(e.message); }
  if (BY.pg == 'store') R();
}
function bStore() {
  const d = BY.store && BY.store.d; if (!d) return '<p class="mu">Memuat menu…</p>';
  const s = d.shop, q = (BY.store.q || '').toLowerCase(), items = d.items.filter((x) => !q || x.n.toLowerCase().includes(q));
  return `<div class="bsh"><em class="sav big">${esc((s.name || '?')[0])}</em><div style="flex:1"><h2>${esc(s.name)}</h2>${BY.meja ? `<small class="chip">${esc(BY.meja)}</small>` : ''}</div></div>
<input placeholder="Cari menu" value="${esc(BY.store.q || '')}" onchange="BY.store.q=this.value;R()">
<div class="bgrid">${items.map(pcardB).join('') || '<p class="mu">Belum ada menu yang tersedia.</p>'}</div>`;
}

/* ---- detail produk ---- */
async function bProd(sid, pid) {
  BY.prod = { sid, pid, d: null }; buyerGo('prod');
  try { BY.prod.d = await bApi('/api/b/product?s=' + encodeURIComponent(sid) + '&p=' + encodeURIComponent(pid)); } catch (e) { toast(e.message); }
  if (BY.pg == 'prod') R();
}
function bProdPage() {
  const d = BY.prod && BY.prod.d; if (!d) return '<p class="mu">Memuat produk…</p>';
  const x = d.item, inC = BY.carts[x.sid] && BY.carts[x.sid].items[x.pid];
  return `<div class="bpd">${pimg(x, 'bimg big')}
<div class="cd"><div class="bpr big"><span>${rp(x.price)}</span></div>${disc(x) ? `<div class="bpo"><i>${disc(x)}%</i><s>${rp(x.orig)}</s></div>` : ''}<h3 style="margin:6px 0 4px;font-weight:600">${esc(x.n)}</h3><small class="mu">${x.st > 0 ? 'Stok ' + x.st + (x.unit ? ' ' + esc(x.unit) : '') : 'Stok habis'}</small></div>
<div class="bbuy"><button class="gh big ol" onclick="bAddCart(0)">${inC ? 'Ubah keranjang' : '+ Keranjang'}</button><button class="pr" onclick="bAddCart(1)">Beli langsung</button></div>`;
}
function bAddCart(now) {
  const x = BY.prod.d.item, inC = BY.carts[x.sid] && BY.carts[x.sid].items[x.pid];
  const m = modal(`<div class="row" style="margin:0;gap:10px;justify-content:flex-start">${pimg(x, 'bimg sm')}<span><b class="lg2">${rp(x.price)}</b><br><small class="mu">Stok ${x.st}${x.unit ? ' ' + esc(x.unit) : ''}</small></span></div>
<b>Jumlah</b><div class="qt" style="justify-content:center"><button id="mn">−</button><input id="qq" type="number" value="${inC ? inC.q : 1}" min="1" max="${x.st || 99}"><button id="pl">+</button></div>
<button class="pr" id="ad">${now ? 'Beli langsung' : 'Masukkan keranjang'}</button>`);
  const q = $('#qq', m); $('#mn', m).onclick = () => { q.value = Math.max(1, num(q.value) - 1); }; $('#pl', m).onclick = () => { q.value = Math.min(x.st || 99, num(q.value) + 1); };
  $('#ad', m).onclick = () => {
    const n = Math.min(x.st || 99, Math.max(1, num(q.value)));
    const c = (BY.carts[x.sid] = BY.carts[x.sid] || { sn: x.sn, items: {} });
    c.items[x.pid] = { q: n, n: x.n, price: x.price, unit: x.unit || '', st: x.st, c: x.c, sel: true }; bSave(); m.close();
    if (now) bGoCheckout(); else { toast('Ditambahkan ke keranjang 🛒'); R(); }
  };
}

/* ---- keranjang ---- */
function bCart() {
  const S2 = Object.entries(BY.carts).filter(([, c]) => Object.keys(c.items).length);
  if (!S2.length) return `<div class="cd c"><div style="font-size:60px">🛒</div><h3>Keranjang kosong</h3><p class="mu">Pilih menu untuk mulai memesan.</p></div>`;
  let tot = 0, n = 0;
  const html = S2.map(([sid, c]) => `<div class="cd cs"><b>🏪 ${esc(c.sn)}</b>${Object.entries(c.items).map(([pid, i]) => { tot += i.price * i.q; n += i.q; return `<div class="cit"><em class="bimg xs" style="background:${COL[(i.c || i.n).length % COL.length]}"><span>${catIcon(i.c)}</span></em><div style="flex:1;min-width:0"><div class="t1">${esc(i.n)}</div><b>${rp(i.price)}</b><div class="qt" style="margin-top:6px"><button onclick="bQty('${esc(sid)}','${esc(pid)}',-9999)">🗑</button><span class="sp"></span><button onclick="bQty('${esc(sid)}','${esc(pid)}',-1)">−</button><b>${i.q}</b><button onclick="bQty('${esc(sid)}','${esc(pid)}',1)">+</button></div></div></div>`; }).join('')}</div>`).join('');
  return html + `<div class="bbuy cartbar2"><span><small class="mu">Total</small><br><b class="lg2">${rp(tot)}</b></span><button class="pr" ${n ? '' : 'disabled'} onclick="bGoCheckout()">Pesan (${n})</button></div>`;
}
function bQty(sid, pid, d) { const c = BY.carts[sid], i = c.items[pid]; i.q = Math.min(i.st || 99, i.q + d); if (i.q <= 0) delete c.items[pid]; if (!Object.keys(c.items).length) delete BY.carts[sid]; bSave(); R(); }
async function bGoCheckout() { if (!(await bEnsureGuest())) return; buyerGo('co'); }

/* ---- pesan: tanpa alamat/ongkir/kupon/kredit — ambil/sajikan di tempat, bayar di kasir ---- */
function bCheckoutPage() {
  const sid = BY.store && BY.store.id, c = sid && BY.carts[sid];
  if (!c || !Object.keys(c.items).length) return '<p class="mu">Keranjang kosong.</p>';
  const items = Object.entries(c.items), tot = items.reduce((a, [, i]) => a + i.price * i.q, 0);
  return `<div class="cd"><b>🏪 ${esc(c.sn)}</b>${BY.meja ? `<div class="chip">${esc(BY.meja)}</div>` : ''}
${items.map(([, i]) => `<div class="row"><span>${esc(i.n)} <small class="mu">× ${i.q}</small></span><b>${rp(i.price * i.q)}</b></div>`).join('')}
<input placeholder="Catatan untuk kasir (opsional)" value="${esc(BY.coNote || '')}" onchange="BY.coNote=this.value"></div>
<div class="cd tt"><b>Ringkasan</b><div class="row"><span>Total pesanan</span><b>${rp(tot)}</b></div><small class="mu">Pembayaran dilakukan di kasir.</small></div>
<div class="bbuy cartbar2"><span><small class="mu">Total</small><br><b class="lg2">${rp(tot)}</b></span><button class="pr" onclick="bPlace()">Pesan sekarang</button></div>`;
}
async function bPlace() {
  const sid = BY.store && BY.store.id, c = sid && BY.carts[sid]; if (!c || !Object.keys(c.items).length) return;
  if (!(await bEnsureGuest())) return;
  const items = Object.entries(c.items).map(([pid, i]) => ({ pid, q: i.q, offer: 0 }));
  const note = (BY.meja ? BY.meja : '') + (BY.coNote ? (BY.meja ? ' · ' : '') + BY.coNote : '');
  try {
    await bPost('/api/b/orders', { store: sid, items, method: 'ambil', pay: 'transfer', note });
    delete BY.carts[sid]; bSave(); toast('Pesanan terkirim ke kasir 🎉', 4000); BY.ordTab = 'all'; buyerGo('ord');
  } catch (e) { if (e.status == 401) { BY.tk = ''; if (await bEnsureGuest()) return bPlace(); } toast(e.message, 6000); }
}

/* ---- pesanan saya ---- */
async function bLoadOrders() {
  if (!BY.tk || !canNet()) return;
  try {
    const r = await bApi('/api/b/orders'), ch = JSON.stringify(r.orders.map((o) => [o.id, o.status, o.paid, o.upd])) != JSON.stringify(BY.orders.map((o) => [o.id, o.status, o.paid, o.upd]));
    r.orders.forEach((o) => { const old = BY.ordSt[o.id]; if (old && old != o.status) toast('Pesanan #' + o.id + ': ' + (BST[o.status] || [o.status])[0], 5000); BY.ordSt[o.id] = o.status; });
    BY.orders = r.orders;
    if (ch && MODE == 'buyer' && ['ord', 'od'].includes(BY.pg) && !$('.md')) R();
  } catch (e) { if (e.status == 401) BY.tk = ''; }
}
setInterval(() => { if (MODE == 'buyer' && BY.tk) bLoadOrders(); }, 25000);
const OTAB = { all: () => 1, wait: (o) => ['nego', 'nego_toko', 'acc_kredit', 'baru'].includes(o.status), proc: (o) => o.status == 'diproses', ship: (o) => o.status == 'dikirim', done: (o) => o.status == 'selesai', x: (o) => ['batal', 'ditolak'].includes(o.status) };
function bOrders() {
  if (!BY.tk) return `<div class="cd c"><p class="mu">Belum ada pesanan.</p></div>`;
  const L = BY.orders.filter(OTAB[BY.ordTab]);
  return `<div class="bchips">${[['all', 'Semua'], ['wait', 'Menunggu'], ['proc', 'Diproses'], ['ship', 'Siap'], ['done', 'Selesai'], ['x', 'Dibatalkan']].map((x) => `<button class="${BY.ordTab == x[0] ? 'a' : ''}" onclick="BY.ordTab='${x[0]}';R()">${x[1]}${x[0] != 'all' && BY.orders.filter(OTAB[x[0]]).length ? ' (' + BY.orders.filter(OTAB[x[0]]).length + ')' : ''}</button>`).join('')}</div>
${L.map((o) => { const st = BST[o.status] || [o.status, '']; return `<div class="cd oc" onclick="BY.od=${o.id};buyerGo('od')"><div class="row" style="margin:0"><small><b>🍽️ Pesanan</b> · ${dstr(o.t)}</small><span class="chip ${st[1]}">${st[0]}</span></div><div class="row" style="justify-content:flex-start;gap:10px"><em class="bimg xs" style="background:${COL[o.sn.length % COL.length]}"><span>🏪</span></em><span><b>${esc(o.sn)}</b><br><small class="mu">${esc(o.items[0].n)}${o.items.length > 1 ? ' +' + (o.items.length - 1) + ' lainnya' : ''}</small></span></div><div class="row"><span><small class="mu">Total</small><br><b>${rp(o.tot)}</b></span></div></div>`; }).join('') || '<div class="cd c"><p class="mu">Belum ada pesanan di sini.</p></div>'}`;
}
function bOrderDetail() {
  const o = BY.orders.find((x) => x.id == BY.od); if (!o) return '<p class="mu">Memuat…</p>';
  const steps = [['Dibuat', 1], ['Dikonfirmasi', ['diproses', 'dikirim', 'selesai'].includes(o.status)], ['Disiapkan', ['dikirim', 'selesai'].includes(o.status)], ['Selesai', o.status == 'selesai']], x = ['batal', 'ditolak'].includes(o.status), st = BST[o.status] || [o.status, ''], b = [];
  if (o.status == 'dikirim') b.push(`<button class="pr" onclick="bAct(${o.id},'received')">✔ Sudah diterima/diambil</button>`);
  if (['nego', 'nego_toko', 'baru', 'acc_kredit'].includes(o.status)) b.push(`<button class="gh d big" onclick="if(confirm('Batalkan pesanan?'))bAct(${o.id},'cancel')">Batalkan pesanan</button>`);
  return `<div class="cd"><span class="chip ${st[1]}" style="font-size:13px">${st[0]}</span>${x ? '' : `<div class="stepper">${steps.map((s, i) => `<div class="${s[1] ? 'on' : ''}"><i>${s[1] ? '✓' : i + 1}</i><small>${s[0]}</small></div>`).join('')}</div>`}<small class="mu">No. #${o.id} · ${tstr(o.t)}</small></div>
<div class="cd"><b>🏪 ${esc(o.sn)}</b>${o.items.map((i) => `<div class="row"><span>${esc(i.n)}<br><small class="mu">${i.q} × ${rp(i.price)}</small></span><b>${rp(i.price * i.q)}</b></div>`).join('')}${o.note ? `<small class="mu">Catatan: ${esc(o.note)}</small>` : ''}</div>
<div class="cd"><b>Total</b><div class="row"><span>Total pesanan</span><b>${rp(o.tot)}</b></div><small class="mu">Dibayar langsung di kasir.</small></div>
<div class="fm">${b.join('')}</div>`;
}
async function bAct(id, act, extra) { try { await bPost('/api/b/orders/' + id + '/act', { act, ...(extra || {}) }); toast('Tersimpan'); await bLoadOrders(); R(); } catch (e) { toast(e.message); } }

function startBuyer() { MODE = 'buyer'; BY.pg = 'store'; R(); hb('b:store'); if (BY.tk) bLoadOrders(); }
