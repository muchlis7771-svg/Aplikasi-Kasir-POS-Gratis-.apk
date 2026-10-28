'use strict';
/* ============ APLIKASI PEMBELI (pasar online semua toko) ============ */
const BY = {
  tk: LS.get('jpos:bt', ''), me: LS.get('jpos:bme', null), pg: 'home', q: '', cat: '', store: null,
  items: LS.get('jpos:bitems', []), cats: [], stores: LS.get('jpos:bstores', []), cart: LS.get('jpos:bcart', null), orders: [], ordSt: {}, info: null, loading: false,
};
const bApi = (p, o) => api(p, o || {}, BY.tk || '');
const bPost = (p, b) => bApi(p, { method: 'POST', body: JSON.stringify(b) });
const bLL = () => (BY.me && BY.me.lat != null ? '&lat=' + BY.me.lat + '&lng=' + BY.me.lng : LS.get('jpos:bll', null) ? '&lat=' + LS.get('jpos:bll').lat + '&lng=' + LS.get('jpos:bll').lng : '');
const bSave = () => { LS.set('jpos:bcart', BY.cart); };
const BST = { nego: ['Menunggu jawaban tawar', 'o'], nego_toko: ['Toko memberi harga — perlu persetujuan Anda', 'o'], acc_kredit: ['Menunggu ACC kredit toko', 'o'], baru: ['Menunggu konfirmasi toko', 'o'], diproses: ['Sedang diproses', ''], dikirim: ['Dikirim / siap diambil', 'g'], selesai: ['Selesai', 'g'], batal: ['Dibatalkan', 'r'], ditolak: ['Ditolak toko', 'r'] };
const BPAGES = [['home', '🛍️', 'Belanja'], ['cart', '🛒', 'Keranjang'], ['ord', '📦', 'Pesanan'], ['chat', '💬', 'Chat'], ['acc', '👤', 'Akun']];
function buyerGo(pg) { BY.pg = pg; R(); window.scrollTo(0, 0); }
function buyerShell() {
  const n = BY.cart ? Object.values(BY.cart.items).reduce((a, i) => a + i.q, 0) : 0, act = BY.orders.filter((o) => o.status == 'nego_toko').length;
  let body; try { body = ({ home: bHome, store: bStore, cart: bCart, ord: bOrders, chat: bChats, acc: bAcc }[BY.pg] || bHome)(); } catch (e) { console.error(e); body = '<p class="rd">' + esc(e.message) + '</p>'; }
  return `<header><button class="av" onclick="buyerGo('acc')">${BY.me && BY.me.name ? esc(BY.me.name[0].toUpperCase()) : '🛍️'}</button><div class="hn"><b>J-POS Belanja</b><small>${BY.me ? esc(BY.me.name) + (BY.me.addr ? ' · ' + esc(BY.me.addr) : '') : 'Belanja grosir dari semua toko'}</small></div><span class="sp"></span><button class="gh" onclick="bExit()">Keluar</button></header>
<main>${body}</main><nav class="bn">${BPAGES.map((p) => `<button class="${BY.pg == p[0] || (BY.pg == 'store' && p[0] == 'home') ? 'a' : ''}" onclick="buyerGo('${p[0]}')"><i>${p[1]}</i><span>${p[2]}</span>${p[0] == 'cart' && n ? `<em style="display:grid">${n}</em>` : ''}${p[0] == 'ord' && act ? `<em style="display:grid">${act}</em>` : ''}</button>`).join('')}</nav>`;
}
function bExit() { MODE = 'home'; document.body.classList.remove('in'); R(); }
function bAfter() { if (BY.pg == 'home' && !BY.loaded) { BY.loaded = 1; bLoad(); } if (BY.pg == 'ord') bLoadOrders(); if (BY.pg == 'chat') bLoadChats(); if (BY.pg == 'cart') bQuote(); }

/* ---- beranda: cari produk dari semua toko ---- */
async function bLoad() {
  if (!canNet()) return toast('Offline — menampilkan data terakhir');
  BY.loading = true;
  try {
    const [p, s] = await Promise.all([api('/api/b/products?q=' + encodeURIComponent(BY.q) + '&cat=' + encodeURIComponent(BY.cat) + bLL(), {}, ''), api('/api/b/stores?' + bLL().slice(1), {}, '')]);
    BY.items = p.items; BY.cats = p.cats; BY.stores = s.stores; LS.set('jpos:bitems', BY.items.slice(0, 120).map((x) => ({ ...x, img: '' }))); LS.set('jpos:bstores', BY.stores);
  } catch (e) { toast(e.message); }
  BY.loading = false; if (MODE == 'buyer' && BY.pg == 'home') R();
}
const pcardB = (x) => `<button class="pc" onclick="bProd('${esc(x.sid)}','${esc(x.pid)}')"><em class="bimg" style="background:${COL[(x.c || '').length % COL.length]}">${x.img ? `<img src="${esc(x.img)}" alt="">` : esc((x.n || '?')[0])}</em><b>${esc(x.n)}</b><small>${esc(x.sn)}${x.dist != null ? ' · ' + distStr(x.dist) : ''}</small><small class="mu">stok ${x.st}${x.unit ? ' ' + esc(x.unit) : ''}</small><span>${rp(x.price)}</span></button>`;
function bHome() {
  const ll = BY.me && BY.me.lat != null ? 1 : LS.get('jpos:bll', null);
  return `<div class="srch"><input id="bq" placeholder="Cari produk di semua toko…" value="${esc(BY.q)}" onkeydown="if(event.key=='Enter'){BY.q=this.value;bLoad()}"><button class="gh" onclick="BY.q=$('#bq').value;bLoad()">🔍</button></div>
${ll ? '' : `<div class="cd info"><div class="row" style="margin:0"><small>Aktifkan lokasi agar toko terdekat & ongkir tampil</small><button class="gh a" onclick="bSetLoc()">📍 Lokasi</button></div></div>`}
${BY.cats.length ? `<div class="seg"><button class="${BY.cat ? '' : 'a'}" onclick="BY.cat='';bLoad()">Semua</button>${BY.cats.map((c) => `<button class="${BY.cat == c.c ? 'a' : ''}" data-c="${esc(c.c)}" onclick="BY.cat=this.dataset.c;bLoad()">${esc(c.c)}</button>`).join('')}</div>` : ''}
${!BY.q && !BY.cat && BY.stores.length ? `<h3 style="margin:6px 2px 0">Toko ${ll ? 'terdekat' : ''}</h3><div class="hs">${BY.stores.slice(0, 20).map((s) => `<button class="stc" onclick="bOpenStore('${esc(s.id)}')"><b>${esc(s.name)}</b><small class="mu">${s.dist != null ? distStr(s.dist) + ' · ' : ''}${s.np} produk</small><small>${s.cod ? 'COD ' : ''}${s.credit ? '· Kredit' : ''}</small></button>`).join('')}</div>` : ''}
<h3 style="margin:6px 2px 0">${BY.q ? 'Hasil "' + esc(BY.q) + '"' : 'Produk'} ${BY.loading ? '<small class="mu">memuat…</small>' : ''}</h3>
<div class="grid">${BY.items.map(pcardB).join('') || '<p class="mu">Belum ada produk. Coba kata kunci lain.</p>'}</div>`;
}
async function bSetLoc() {
  toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) return toast('Lokasi tidak tersedia — izinkan akses lokasi');
  LS.set('jpos:bll', p); if (BY.tk) { try { const r = await bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ lat: p.lat, lng: p.lng }) }); BY.me = r.me; LS.set('jpos:bme', BY.me); } catch (e) { } }
  toast('Lokasi tersimpan'); bLoad(); if (BY.pg != 'home') R();
}
function bFindItem(sid, pid) { return BY.items.find((x) => x.sid == sid && x.pid == pid) || (BY.store && BY.store.items.find((x) => x.pid == pid)); }
function bProd(sid, pid) {
  const x = bFindItem(sid, pid); if (!x) return; const inC = BY.cart && BY.cart.store == sid && BY.cart.items[pid];
  const m = modal(`${x.img ? `<img src="${esc(x.img)}" style="width:100%;max-height:220px;object-fit:contain;border-radius:14px;background:var(--bg)">` : ''}<h3>${esc(x.n)}</h3><small class="mu">${esc(x.c || '')} · stok ${x.st}${x.unit ? ' ' + esc(x.unit) : ''}</small><h2 class="lg1">${rp(x.price)}</h2>
<button class="us2" id="st"><em>🏪</em><span>${esc(x.sn)}<br><small class="mu">${x.dist != null ? distStr(x.dist) + ' · ' : ''}lihat toko</small></span><span class="sp"></span>›</button>
<div class="qt" style="justify-content:center"><button id="mn">−</button><input id="qq" type="number" value="${inC ? inC.q : 1}" min="1" max="${x.st}"><button id="pl">+</button></div>
<label><small class="mu">💬 Tawar harga per item (opsional) — toko bisa terima, tolak, atau beri harga lain</small><input id="of" type="number" placeholder="mis. ${Math.round(x.price * 0.95)}" value="${inC && inC.offer ? inC.offer : ''}"></label>
<button class="pr" id="ad">${inC ? 'Perbarui keranjang' : 'Tambah ke keranjang'}</button><div class="fm2"><button class="gh" id="ch">💬 Chat toko</button><button class="gh" id="cx">Tutup</button></div>`);
  const q = $('#qq', m); $('#mn', m).onclick = () => (q.value = Math.max(1, num(q.value) - 1)); $('#pl', m).onclick = () => (q.value = Math.min(x.st, num(q.value) + 1));
  $('#st', m).onclick = () => { m.close(); bOpenStore(sid); }; $('#cx', m).onclick = () => m.close(); $('#ch', m).onclick = () => { m.close(); bChat(sid, x.sn); };
  $('#ad', m).onclick = () => {
    const n = Math.min(x.st, Math.max(1, num(q.value))), of = num($('#of', m).value);
    if (of && of >= x.price) return toast('Harga tawar harus di bawah ' + rp(x.price));
    if (BY.cart && BY.cart.store != sid && Object.keys(BY.cart.items).length) { if (!confirm('Keranjang berisi produk dari ' + BY.cart.sn + '. Satu pesanan hanya untuk satu toko. Kosongkan keranjang?')) return; BY.cart = null; }
    if (!BY.cart) BY.cart = { store: sid, sn: x.sn, items: {} };
    BY.cart.items[pid] = { q: n, offer: of || 0, n: x.n, price: x.price, unit: x.unit || '', st: x.st }; bSave(); m.close(); toast('Masuk keranjang'); R();
  };
}
async function bOpenStore(sid) {
  BY.pg = 'store'; BY.store = { id: sid, items: [], info: BY.stores.find((s) => s.id == sid) || { id: sid, name: '…' } }; R();
  try { const r = await api('/api/b/products?store=' + sid + bLL(), {}, ''); BY.store.items = r.items; if (r.items[0]) BY.store.info.name = r.items[0].sn; } catch (e) { toast(e.message); }
  if (BY.pg == 'store') R();
}
function bStore() {
  const s = BY.store.info, ships = String(s.ships || '').split(',').filter(Boolean).map((k) => (BMETHODS[k] || [k])[0]);
  return `<button class="gh" onclick="buyerGo('home')">← Kembali</button><div class="cd hero"><h2>${esc(s.name)}</h2><small>${s.dist != null ? distStr(s.dist) + ' · ' : ''}${esc(s.addr || '')}</small>${s.descr ? '<br><small>' + esc(s.descr) + '</small>' : ''}</div>
<div class="cd"><small>${s.cod ? '✔ COD · ' : ''}${s.credit ? '✔ Kredit (perlu ACC) · ' : ''}Pengiriman: ${ships.join(', ') || '-'}${s.minorder ? ' · min. belanja ' + rp(s.minorder) : ''}</small><div class="wrap" style="margin-top:6px"><button class="gh a" onclick="bChat('${esc(s.id)}','${esc(s.name).replace(/'/g, '')}')">💬 Chat toko</button></div></div>
<div class="grid">${BY.store.items.map(pcardB).join('') || '<p class="mu">Memuat produk…</p>'}</div>`;
}

/* ---- keranjang & checkout ---- */
const BQ = { m: 'ambil', pay: 'transfer', days: 14, q: null };
function bCart() {
  if (!BY.cart || !Object.keys(BY.cart.items).length) return `<div class="cd"><h3>Keranjang kosong</h3><p class="mu">Cari produk dari semua toko di menu Belanja.</p><button class="pr" onclick="buyerGo('home')">Mulai belanja</button></div>`;
  const s = BY.stores.find((x) => x.id == BY.cart.store) || {}, ships = String(s.ships || 'ambil').split(',').filter((k) => BMETHODS[k]), L = Object.entries(BY.cart.items);
  if (!ships.includes(BQ.m)) BQ.m = ships[0] || 'ambil';
  const sub = L.reduce((a, [, i]) => a + i.price * i.q, 0), nego = L.some(([, i]) => i.offer), subO = L.reduce((a, [, i]) => a + (i.offer || i.price) * i.q, 0), kind = BMETHODS[BQ.m][1];
  const fee = kind == 'instant' ? (BQ.q && BQ.q.fee) : 0, pays = [['transfer', 'Transfer'], ...(s.cod ? [['cod', 'COD']] : []), ...(s.credit ? [['kredit', 'Kredit / tempo']] : [])];
  if (!pays.some((p) => p[0] == BQ.pay)) BQ.pay = 'transfer';
  return `<div class="cd"><h3>🏪 ${esc(BY.cart.sn)}</h3>${L.map(([pid, i]) => `<div class="ci"><div class="t"><b>${esc(i.n)}</b><b>${rp(i.price * i.q)}</b></div><small>${rp(i.price)} × ${i.q}${i.offer ? ` · <span class="or">tawar ${rp(i.offer)}/item</span>` : ''}</small><div class="qt" style="margin-top:4px"><button onclick="bQty('${esc(pid)}',-1)">−</button><b>${i.q}</b><button onclick="bQty('${esc(pid)}',1)">+</button><button onclick="bQty('${esc(pid)}',-9999)" style="margin-left:auto">🗑</button></div></div>`).join('')}</div>
<div class="cd"><h3>Pengiriman</h3>${ships.map((k) => `<label class="row"><span>${esc(BMETHODS[k][0])} <small class="mu">${BMETHODS[k][1] == 'instant' ? (BQ.q && BQ.q.fee != null ? rp(BQ.q.fee) : BQ.q && BQ.q.dist ? 'terlalu jauh' : 'butuh lokasi') : BMETHODS[k][1] == 'exp' ? 'ongkir diinfokan toko' : 'gratis'}</small></span><input type="radio" name="bm" ${BQ.m == k ? 'checked' : ''} onchange="BQ.m='${k}';R()"></label>`).join('')}
${BQ.q && BQ.q.dist ? `<small class="mu">Jarak ±${distStr(BQ.q.road || BQ.q.dist)} lewat jalan (perkiraan)</small>` : ''}
${kind != 'none' ? `<input id="ba" placeholder="Alamat lengkap pengiriman" value="${esc((BY.me && BY.me.addr) || '')}"><button class="gh" onclick="bSetLoc().then(bQuote)">📍 Pakai lokasi saya sekarang</button>` : ''}</div>
<div class="cd"><h3>Pembayaran</h3>${pays.map((p) => `<label class="row"><span>${p[1]}</span><input type="radio" name="bp" ${BQ.pay == p[0] ? 'checked' : ''} onchange="BQ.pay='${p[0]}';R()"></label>`).join('')}
${BQ.pay == 'kredit' ? `<label><small class="mu">Tempo pembayaran (hari) — pengajuan kredit akan dinilai & di-ACC pemilik toko</small><input id="bd" type="number" value="${BQ.days}" onchange="BQ.days=num(this.value)"></label>` : ''}${BQ.pay == 'transfer' ? '<small class="mu">Nomor rekening toko tampil di menu Pesanan setelah pesanan dibuat.</small>' : ''}
<input id="bn" placeholder="Catatan untuk toko (opsional)"></div>
<div class="cd tt">${row('Subtotal', rp(sub))}${nego ? row('Jika tawaran diterima', '<span class="or">' + rp(subO) + '</span>') : ''}${row('Ongkir', kind == 'exp' ? 'diinfokan toko' : rp(fee || 0))}<h2>${rp(sub + (fee || 0))}</h2>${s.minorder && sub < s.minorder ? `<small class="rd">Minimal belanja ${rp(s.minorder)}</small>` : ''}
<button class="pr" onclick="bCheckout()">${nego ? 'Kirim penawaran ke toko' : BQ.pay == 'kredit' ? 'Ajukan pesanan kredit' : 'Buat pesanan'}</button></div>`;
}
function bQty(pid, d) { const i = BY.cart.items[pid]; i.q = Math.min(i.st || 9999, i.q + d); if (i.q <= 0) delete BY.cart.items[pid]; if (!Object.keys(BY.cart.items).length) BY.cart = null; bSave(); R(); }
async function bQuote() {
  if (!BY.cart) return; const ll = BY.me && BY.me.lat != null ? BY.me : LS.get('jpos:bll', null); if (!ll || !canNet()) return;
  try { const q = await api('/api/b/quote', { method: 'POST', body: JSON.stringify({ store: BY.cart.store, lat: ll.lat, lng: ll.lng }) }, ''); const ch = JSON.stringify(q) != JSON.stringify(BQ.q); BQ.q = q; if (ch && BY.pg == 'cart') R(); } catch (e) { }
}
async function bCheckout() {
  if (!BY.tk) return bLogin(() => { buyerGo('cart'); });
  const ll = LS.get('jpos:bll', null) || BY.me, kind = BMETHODS[BQ.m][1], addr = ($('#ba') || {}).value || (BY.me && BY.me.addr) || '';
  if (kind != 'none' && (!ll || ll.lat == null)) return toast('Atur lokasi pengiriman dulu (📍)');
  if (kind != 'none' && !addr.trim()) return toast('Isi alamat pengiriman');
  try {
    const r = await bPost('/api/b/orders', { store: BY.cart.store, items: Object.entries(BY.cart.items).map(([pid, i]) => ({ pid, q: i.q, offer: i.offer })), method: BQ.m, pay: BQ.pay, days: BQ.days, addr, lat: ll && ll.lat, lng: ll && ll.lng, note: ($('#bn') || {}).value || '' });
    if (addr && BY.me && addr != BY.me.addr) { BY.me.addr = addr; LS.set('jpos:bme', BY.me); bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ addr }) }).catch(() => { }); }
    BY.cart = null; bSave(); toast({ nego: 'Penawaran terkirim — tunggu jawaban toko', acc_kredit: 'Pengajuan kredit terkirim — menunggu ACC toko', baru: 'Pesanan dibuat!' }[r.status] || 'Pesanan dibuat', 5000); buyerGo('ord');
  } catch (e) { if (e.status == 401) { BY.tk = ''; return bLogin(bCheckout); } toast(e.message, 5000); }
}

/* ---- pesanan ---- */
async function bLoadOrders() {
  if (!BY.tk || !canNet()) return;
  try {
    const r = await bApi('/api/b/orders'), ch = JSON.stringify(r.orders.map((o) => [o.id, o.status, o.paid, o.upd])) != JSON.stringify(BY.orders.map((o) => [o.id, o.status, o.paid, o.upd]));
    r.orders.forEach((o) => { const old = BY.ordSt[o.id]; if (old && old != o.status) toast('Pesanan #' + o.id + ': ' + (BST[o.status] || [o.status])[0], 5000); BY.ordSt[o.id] = o.status; });
    BY.orders = r.orders; if (ch && MODE == 'buyer' && (BY.pg == 'ord') && !$('.md')) R();
  } catch (e) { if (e.status == 401) BY.tk = ''; }
}
setInterval(() => { if (MODE == 'buyer' && BY.tk) bLoadOrders(); }, 25000);
function bOrders() {
  if (!BY.tk) return `<div class="cd"><h3>Pesanan saya</h3><p class="mu">Masuk dulu untuk melihat pesanan.</p><button class="pr" onclick="bLogin(()=>buyerGo('ord'))">Masuk / Daftar</button></div>`;
  return (BY.orders.map((o) => {
    const st = BST[o.status] || [o.status, ''], b = [];
    if (o.status == 'nego_toko') b.push(`<button class="gh a" onclick="bAct(${o.id},'accept_counter')">✔ Setuju harga toko</button>`);
    if (['nego', 'nego_toko', 'baru', 'acc_kredit'].includes(o.status)) b.push(`<button class="gh d" onclick="if(confirm('Batalkan pesanan?'))bAct(${o.id},'cancel')">Batalkan</button>`);
    if (o.status == 'dikirim') b.push(`<button class="gh a" onclick="bAct(${o.id},'received')">📦 Pesanan sudah diterima</button>`);
    if (!o.paid && o.pay == 'transfer' && ['baru', 'diproses', 'dikirim', 'selesai'].includes(o.status)) b.push(`<button class="gh" onclick="bAct(${o.id},'paid_claim',{note:prompt('Catatan transfer (bank/nama pengirim):')||''})">Saya sudah transfer</button>`);
    b.push(`<button class="gh" onclick="bChat('${esc(o.store_id)}','${esc(o.sn).replace(/'/g, '')}')">💬 Chat toko</button>`);
    if (o.wa) b.push(`<a class="gh" target="_blank" href="${esc(waLink(o.wa, 'Halo ' + o.sn + ', saya ' + (BY.me ? BY.me.name : '') + ' terkait pesanan #' + o.id))}">WA toko</a>`);
    return `<div class="cd"><div class="row" style="margin:0"><span><b>#${o.id} · ${esc(o.sn)}</b><br><small class="mu">${tstr(o.t)}</small></span><span class="chip ${st[1]}">${st[0]}</span></div>
${o.items.map((i) => `<div class="row" style="margin:2px 0"><span>${esc(i.n)} <small class="mu">× ${i.q}</small>${i.offer ? `<br><small class="or">tawaran Anda ${rp(i.offer)}</small>` : ''}${i.counter && o.status == 'nego_toko' ? `<br><small class="gr">harga dari toko ${rp(i.counter)}</small>` : ''}</span><b>${rp((o.status == 'nego_toko' && i.counter ? i.counter : i.price) * i.q)}</b></div>`).join('')}
${row('Ongkir · ' + esc((BMETHODS[o.method] || [o.method])[0]), o.ship ? rp(o.ship) : BMETHODS[o.method] && BMETHODS[o.method][1] == 'exp' ? 'menunggu toko' : rp(0))}${row('<b>Total</b>', rp(o.tot))}
<small class="mu">${o.pay == 'kredit' ? 'Kredit ' + o.days + ' hari' + (o.due ? ' · jatuh tempo ' + dstr(o.due) : '') : o.pay == 'cod' ? 'Bayar di tempat (COD)' : 'Transfer'} · ${o.paid ? '<b class="gr">LUNAS</b>' : '<b class="or">belum lunas</b>'}${o.pay == 'transfer' && !o.paid && o.bank ? '<br>Transfer ke: <b>' + esc(o.bank) + '</b>' : ''}${o.resi ? `<br>Resi ${esc((BMETHODS[o.courier] || [o.courier])[0])}: <b>${esc(o.resi)}</b> <a target="_blank" href="${trackUrl(o.courier, o.resi)}">lacak</a>` : ''}</small>
<details><summary class="mu" style="font-size:12px">Riwayat</summary>${o.hist.map((h) => `<small class="mu">${tstr(h.t)} · ${esc(h.txt)}</small>`).join('<br>')}</details><div class="wrap" style="margin-top:8px">${b.join('')}</div></div>`;
  }).join('') || `<div class="cd"><p class="mu">Belum ada pesanan.</p><button class="pr" onclick="buyerGo('home')">Mulai belanja</button></div>`) + `<button class="gh" onclick="bLoadOrders().then(R)">⟳ Muat ulang</button>`;
}
async function bAct(id, act, extra) { try { await bPost('/api/b/orders/' + id + '/act', { act, ...(extra || {}) }); toast('Tersimpan'); await bLoadOrders(); R(); } catch (e) { toast(e.message); } }

/* ---- chat ---- */
async function bLoadChats() {
  const el = $('#bchats'); if (!el || !BY.tk) return;
  try { const r = await bApi('/api/b/chats'); el.innerHTML = r.rooms.map((x) => `<button class="us2" onclick="bChat('${esc(x.store)}','${esc(x.name).replace(/'/g, '')}')"><em>🏪</em><span>${esc(x.name)}</span><span class="sp"></span>›</button>`).join('') || '<p class="mu">Belum ada chat. Buka produk/toko lalu tekan "Chat toko".</p>'; } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; }
}
function bChats() { return BY.tk ? `<div class="cd"><h3>Chat dengan toko</h3><div id="bchats"><p class="mu">Memuat…</p></div></div>` : `<div class="cd"><p class="mu">Masuk untuk chat dengan toko.</p><button class="pr" onclick="bLogin(()=>buyerGo('chat'))">Masuk / Daftar</button></div>`; }
function bChat(sid, name) {
  if (!BY.tk) return bLogin(() => bChat(sid, name));
  let last = 0, timer; const myId = 'b' + (BY.me && BY.me.id);
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">💬 ${esc(name)}</h3><button class="gh" id="cx">✕</button></div><div class="chat" id="cm" style="height:50vh"></div><div class="cin"><input id="ci" placeholder="Tanya stok, harga, pengiriman…" maxlength="500"><button id="cs">Kirim</button></div>`, 'w');
  const load = async () => { try { const r = await bApi('/api/b/chat?store=' + sid + '&since=' + last), el = $('#cm', m); if (!el) return clearInterval(timer); r.m.forEach((x) => { last = Math.max(last, x.seq); el.insertAdjacentHTML('beforeend', `<div class="bub ${x.sid == myId ? 'me' : ''}"><small>${x.sid == myId ? 'Saya' : esc(x.un) + ' · ' + esc(name)} · ${hm(x.t)}</small>${esc(x.tx)}</div>`); }); if (r.m.length) el.scrollTop = el.scrollHeight; } catch (e) { } };
  const send = async () => { const i = $('#ci', m), tx = i.value.trim(); if (!tx) return; i.value = ''; try { await bPost('/api/b/chat', { store: sid, text: tx }); load(); } catch (e) { toast(e.message); i.value = tx; } };
  $('#cs', m).onclick = send; $('#ci', m).onkeydown = (e) => { if (e.key == 'Enter') send(); }; $('#cx', m).onclick = () => m.close();
  m.onclose = () => clearInterval(timer); load(); timer = setInterval(load, 4000);
}

/* ---- akun pembeli ---- */
function bAcc() {
  if (!BY.tk) return `<div class="cd"><h3>Akun pembeli</h3><p class="mu">Daftar gratis untuk memesan dari semua toko, tawar harga, chat, dan mengajukan kredit.</p><button class="pr" onclick="bLogin(()=>buyerGo('acc'))">Masuk / Daftar</button></div>`;
  setTimeout(bLoadMe, 0);
  return `<div class="cd"><h3>${esc(BY.me.name)}</h3><small class="mu">${esc(BY.me.phone || '')}</small><div class="fm" style="margin-top:8px"><input id="an" placeholder="Nama" value="${esc(BY.me.name)}"><input id="aa" placeholder="Alamat pengiriman" value="${esc(BY.me.addr || '')}"><button class="gh" onclick="bSetLoc()">📍 Perbarui lokasi (${BY.me.lat != null ? 'sudah' : 'belum'})</button><button class="pr" onclick="bSaveMe()">Simpan</button></div></div>
<div class="cd" id="bcred"><h3>Kelayakan kredit</h3><p class="mu">Memuat…</p></div>
<div class="wrap"><button class="gh" onclick="bPin()">🔑 Ganti PIN</button><button class="gh d" onclick="bLogout()">Keluar akun</button></div>`;
}
async function bLoadMe() {
  const el = $('#bcred'); if (!el) return;
  try {
    const r = await bApi('/api/b/me'), c = r.credit, col = { A: 'var(--gr)', B: 'var(--bl)', C: 'var(--or)', D: 'var(--rd)' }[c.grade];
    el.innerHTML = `<h3>Kelayakan kredit</h3><div class="row"><b style="font-size:30px;color:${col}">${c.score}<small class="mu" style="font-size:13px">/100</small></b><span class="chip" style="color:${col}">Nilai ${c.grade} · ${esc(c.label)}</span></div><div style="height:9px;border-radius:9px;background:var(--bd);overflow:hidden"><div style="width:${c.score}%;height:100%;background:${col}"></div></div><small class="mu">${c.why.map(esc).join(' · ')}</small>${r.lim.map((l) => row(esc(l.name), 'limit ' + rp(l.lim) + ' · ' + l.days + ' hr')).join('')}<small class="mu">Tips: selesaikan pesanan & bayar kredit tepat waktu untuk menaikkan nilai.</small>`;
  } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; }
}
async function bSaveMe() { try { const r = await bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ name: $('#an').value, addr: $('#aa').value }) }); BY.me = r.me; LS.set('jpos:bme', BY.me); toast('Tersimpan'); R(); } catch (e) { toast(e.message); } }
function bPin() { const o = prompt('PIN lama:'); if (o == null) return; const n = prompt('PIN baru (4–8 angka):'); if (!n) return; bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ old: o, pin: n }) }).then(() => toast('PIN diganti')).catch((e) => toast(e.message)); }
function bLogout() { BY.tk = ''; BY.me = null; BY.orders = []; LS.del('jpos:bt'); LS.del('jpos:bme'); R(); }
function bLogin(then) {
  let reg = false;
  const m = modal(`<h3 id="lt">Masuk pembeli</h3><input id="lp" type="tel" inputmode="tel" placeholder="No. HP (08…)"><input id="ln" placeholder="Nama lengkap" style="display:none"><input id="lpin" type="password" inputmode="numeric" maxlength="8" placeholder="PIN 4–8 angka"><button class="pr" id="ok">Masuk</button><button class="gh" id="sw">Belum punya akun? Daftar gratis</button>`);
  $('#sw', m).onclick = () => { reg = !reg; $('#ln', m).style.display = reg ? '' : 'none'; $('#lt', m).textContent = reg ? 'Daftar pembeli' : 'Masuk pembeli'; $('#ok', m).textContent = reg ? 'Daftar' : 'Masuk'; $('#sw', m).textContent = reg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar gratis'; };
  $('#ok', m).onclick = async () => {
    const ll = LS.get('jpos:bll', null);
    try {
      const r = reg ? await api('/api/b/register', { method: 'POST', body: JSON.stringify({ phone: $('#lp', m).value, name: $('#ln', m).value, pin: $('#lpin', m).value, lat: ll && ll.lat, lng: ll && ll.lng }) }, '') : await api('/api/b/login', { method: 'POST', body: JSON.stringify({ phone: $('#lp', m).value, pin: $('#lpin', m).value }) }, '');
      BY.tk = r.token; BY.me = r.me; LS.set('jpos:bt', BY.tk); LS.set('jpos:bme', BY.me); m.close(); toast('Selamat datang, ' + r.me.name); bLoadOrders(); if (then) then(); else R();
    } catch (e) { toast(e.message, 5000); }
  };
}
function startBuyer() { MODE = 'buyer'; BY.pg = 'home'; R(); if (!LS.get('jpos:bll', null) && !(BY.me && BY.me.lat != null)) bSetLoc(); }
