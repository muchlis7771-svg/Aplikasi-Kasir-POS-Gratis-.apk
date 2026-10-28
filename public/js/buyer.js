'use strict';
/* ============ APLIKASI PEMBELI — marketplace semua toko (gaya TikTok Shop) ============ */
const BY = {
  tk: LS.get('jpos:bt', ''), me: LS.get('jpos:bme', null), pg: 'home', q: '', cat: '', sort: 'near', store: null, prod: null, back: 'home',
  home: LS.get('jpos:bhome', null), items: [], stores: LS.get('jpos:bstores', []), feed: [], cart: LS.get('jpos:bcart', null), orders: [], ordSt: {}, reviewed: [], loading: false,
};
const bApi = (p, o) => api(p, o || {}, BY.tk || '');
const bPost = (p, b) => bApi(p, { method: 'POST', body: JSON.stringify(b) });
const bLL = () => (BY.me && BY.me.lat != null ? '&lat=' + BY.me.lat + '&lng=' + BY.me.lng : LS.get('jpos:bll', null) ? '&lat=' + LS.get('jpos:bll').lat + '&lng=' + LS.get('jpos:bll').lng : '');
const bSave = () => { LS.set('jpos:bcart', BY.cart); };
const BST = { nego: ['Menunggu jawaban tawar', 'o'], nego_toko: ['Toko memberi harga — perlu persetujuan Anda', 'o'], acc_kredit: ['Menunggu ACC kredit toko', 'o'], baru: ['Menunggu konfirmasi toko', 'o'], diproses: ['Sedang dikemas', ''], dikirim: ['Dikirim / siap diambil', 'g'], selesai: ['Selesai', 'g'], batal: ['Dibatalkan', 'r'], ditolak: ['Ditolak toko', 'r'] };
const BPAGES = [['home', '🏠', 'Beranda'], ['feed', '▶️', 'Untukmu'], ['cart', '🛒', 'Keranjang'], ['ord', '📦', 'Pesanan'], ['acc', '👤', 'Saya']];
const CATI = { sembako: '🍚', minuman: '🥤', makanan: '🍜', bumbu: '🧂', kebutuhan: '🧴', kresek: '🛍️', plastik: '🛍️', snack: '🍪', rokok: '🚬', obat: '💊', bayi: '🍼', elektronik: '🔌', atk: '✏️', pakaian: '👕', kosmetik: '💄', umum: '📦' };
const catIcon = (c) => { const k = String(c || '').toLowerCase(); for (const [x, v] of Object.entries(CATI)) if (k.includes(x)) return v; return '🏷️'; };
const shortRp = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'jt' : n >= 1e3 ? Math.round(n / 1e3) + 'rb' : String(n));
const soldTxt = (n) => (n ? 'Terjual ' + (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'rb' : n) : 'Baru');
const stars = (r) => (r ? '⭐ ' + String(r).replace('.', ',') : '');
function buyerGo(pg) { if (pg != BY.pg && !['prod', 'store'].includes(pg)) BY.back = pg; BY.pg = pg; R(); window.scrollTo(0, 0); hb('b:' + pg); }
function buyerShell() {
  document.body.classList.add('buyer');
  const n = BY.cart ? Object.values(BY.cart.items).reduce((a, i) => a + i.q, 0) : 0, act = BY.orders.filter((o) => o.status == 'nego_toko').length;
  let body; try { body = ({ home: bHome, search: bSearch, feed: bFeed, store: bStore, prod: bProdPage, cart: bCart, ord: bOrders, chat: bChats, acc: bAcc }[BY.pg] || bHome)(); } catch (e) { console.error(e); body = '<p class="rd">' + esc(e.message) + '</p>'; }
  const top = ['home', 'search'].includes(BY.pg) ? `<div class="bhead"><div class="bsr" onclick="if(BY.pg!='search')buyerGo('search')"><span>🔍</span><input id="bq" placeholder="Cari kresek, beras, minyak…" value="${esc(BY.q)}" onkeydown="if(event.key=='Enter'){BY.q=this.value;bSearchRun()}"></div><button class="bic" onclick="buyerGo('cart')">🛒${n ? `<em>${n}</em>` : ''}</button><button class="bic" onclick="buyerGo('chat')">💬</button></div>`
    : `<header class="bh"><button class="bic" onclick="bBack()">‹</button><b>${{ feed: 'Untukmu', cart: 'Keranjang', ord: 'Pesanan saya', chat: 'Chat', acc: 'Akun saya', store: 'Toko', prod: 'Detail produk' }[BY.pg] || ''}</b><span class="sp"></span><button class="bic" onclick="buyerGo('cart')">🛒${n ? `<em>${n}</em>` : ''}</button></header>`;
  return `${top}<main class="bmain">${body}</main><nav class="bn">${BPAGES.map((p) => `<button class="${BY.pg == p[0] || (['search'].includes(BY.pg) && p[0] == 'home') ? 'a' : ''}" onclick="buyerGo('${p[0]}')"><i>${p[1]}</i><span>${p[2]}</span>${p[0] == 'cart' && n ? `<em style="display:grid">${n}</em>` : ''}${p[0] == 'ord' && act ? `<em style="display:grid">${act}</em>` : ''}</button>`).join('')}</nav>`;
}
function bBack() { buyerGo(['prod', 'store'].includes(BY.pg) ? BY.back || 'home' : 'home'); }
function bExit() { MODE = 'home'; document.body.classList.remove('in', 'buyer'); R(); }
function bAfter() { if (BY.pg == 'home') { if (!BY.loaded) { BY.loaded = 1; bLoad(); } bTimer(); } if (BY.pg == 'feed' && !BY.feedT) bLoadFeed(); if (BY.pg == 'ord') bLoadOrders(); if (BY.pg == 'chat') bLoadChats(); if (BY.pg == 'cart') bQuote(); if (BY.pg == 'acc' && BY.tk) setTimeout(bLoadMe, 0); }
let bTm; function bTimer() { clearInterval(bTm); bTm = setInterval(() => { $$('[data-end]').forEach((el) => { const d = +el.dataset.end - Date.now(); if (d <= 0) return (el.textContent = 'berakhir'); const h = Math.floor(d / 36e5), m = Math.floor((d % 36e5) / 6e4), s = Math.floor((d % 6e4) / 1e3); el.textContent = [h, m, s].map((x) => String(x).padStart(2, '0')).join(':'); }); if (MODE != 'buyer') clearInterval(bTm); }, 1000); }

/* ---- beranda ---- */
async function bLoad() {
  if (!canNet()) return toast('Offline — menampilkan data terakhir');
  BY.loading = true;
  try {
    const [h, s] = await Promise.all([api('/api/b/home?' + bLL().slice(1), {}, ''), api('/api/b/stores?' + bLL().slice(1), {}, '')]);
    BY.home = h; BY.stores = s.stores; LS.set('jpos:bhome', { ...h, banners: [], flash: h.flash.map((x) => ({ ...x, img: '' })), best: h.best.slice(0, 10).map((x) => ({ ...x, img: '' })), fresh: [] }); LS.set('jpos:bstores', BY.stores);
  } catch (e) { toast(e.message); }
  BY.loading = false; if (MODE == 'buyer' && BY.pg == 'home') R();
}
const pimg = (x, cls) => `<em class="${cls || 'bimg'}" style="background:${COL[(x.c || x.n || '').length % COL.length]}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : `<span>${catIcon(x.c)}</span>`}</em>`;
const disc = (x) => (x.fsp && x.orig > x.price ? Math.round((1 - x.price / x.orig) * 100) : 0);
const pcardB = (x) => `<button class="bpc" onclick="bProd('${esc(x.sid)}','${esc(x.pid)}')">${pimg(x)}${disc(x) ? `<i class="bdisc">-${disc(x)}%</i>` : ''}<div class="bpb"><b>${esc(x.n)}</b><div class="bpr"><span>${rp(x.price)}</span>${disc(x) ? `<s>${rp(x.orig)}</s>` : ''}</div><small>${stars(x.rt)}${x.rt ? ' · ' : ''}${soldTxt(x.sold)}</small><small class="mu">🏪 ${esc(x.sn)}${x.dist != null ? ' · ' + distStr(x.dist) : ''}</small></div></button>`;
function bHome() {
  const h = BY.home || { flash: [], best: [], fresh: [], cats: [], banners: [] }, ll = (BY.me && BY.me.lat != null) || LS.get('jpos:bll', null);
  const bans = h.banners.length ? h.banners : [{ txt: 'Belanja grosir langsung dari toko terdekat', g: 1 }, { txt: 'Tawar harga, bayar COD, transfer, atau kredit', g: 2 }, { txt: 'Ongkir dihitung otomatis per jarak', g: 3 }];
  return `${ll ? '' : `<div class="bloc" onclick="bSetLoc()">📍 Aktifkan lokasi untuk lihat toko & ongkir terdekat <b>›</b></div>`}
<div class="bban">${bans.map((b, i) => b.img ? `<button class="bbn" onclick="${b.pid ? `bProd('${esc(b.sid)}','${esc(b.pid)}')` : `bOpenStore('${esc(b.sid)}')`}"><img src="${esc(b.img)}" alt=""><span>${esc(b.sn)}<br><small>${esc((b.txt || '').slice(0, 60))}</small></span></button>` : `<div class="bbn g${b.g || (i % 3) + 1}"><span><b>J-POS Belanja</b><br>${esc(b.txt)}</span></div>`).join('')}</div>
${h.cats.length ? `<div class="bcat">${h.cats.map((c) => `<button onclick="BY.cat='${esc(c.c).replace(/'/g, '')}';BY.q='';buyerGo('search');bSearchRun()"><i>${catIcon(c.c)}</i><small>${esc(c.c)}</small></button>`).join('')}</div>` : ''}
${h.flash.length ? `<div class="bsec fs"><div class="row" style="margin:0"><b>⚡ Flash Sale</b><span class="cdn" data-end="${Math.min(...h.flash.map((x) => x.fse))}">--:--:--</span></div><div class="hs">${h.flash.map((x) => `<button class="bfs" onclick="bProd('${esc(x.sid)}','${esc(x.pid)}')">${pimg(x, 'bimg sm')}<i class="bdisc">-${disc(x)}%</i><b>${rp(x.price)}</b><s>${rp(x.orig)}</s><div class="bar"><u style="width:${Math.min(100, 20 + (x.sold || 0) * 5)}%"></u><small>${soldTxt(x.sold)}</small></div></button>`).join('')}</div></div>` : ''}
${BY.stores.length ? `<div class="bsec"><div class="row" style="margin:0"><b>🏪 Toko ${ll ? 'terdekat' : 'pilihan'}</b></div><div class="hs">${BY.stores.slice(0, 20).map((s) => `<button class="stc" onclick="bOpenStore('${esc(s.id)}')"><em>${esc((s.name || '?')[0].toUpperCase())}</em><b>${esc(s.name)}</b><small class="mu">${s.dist != null ? distStr(s.dist) + ' · ' : ''}${s.np} produk</small><small>${s.cod ? '💵 COD ' : ''}${s.credit ? '· 🤝 Kredit' : ''}</small></button>`).join('')}</div></div>` : ''}
${h.best.length ? `<div class="bsec"><b>🔥 Terlaris</b><div class="hs">${h.best.slice(0, 10).map((x) => `<div class="hsi">${pcardB(x)}</div>`).join('')}</div></div>` : ''}
<div class="bsec"><b>✨ Rekomendasi untukmu</b> ${BY.loading ? '<small class="mu">memuat…</small>' : ''}</div>
<div class="bgrid">${(h.fresh.length ? h.fresh : h.best).map(pcardB).join('') || `<div class="cd" style="grid-column:1/-1"><p class="mu">${BY.loading ? 'Memuat produk…' : 'Belum ada produk dari toko. Toko akan tampil otomatis setelah pemilik toko membuka aplikasi J-POS dalam keadaan online.'}</p><button class="gh" onclick="bLoad()">⟳ Muat ulang</button></div>`}</div>`;
}
/* ---- pencarian ---- */
async function bSearchRun() {
  BY.pg = 'search'; BY.loading = true; R();
  try { const r = await api('/api/b/products?q=' + encodeURIComponent(BY.q) + '&cat=' + encodeURIComponent(BY.cat) + '&sort=' + BY.sort + bLL(), {}, ''); BY.items = r.items; } catch (e) { toast(e.message); }
  BY.loading = false; if (BY.pg == 'search') R(); const i = $('#bq'); if (i && !BY.q && !BY.cat) i.focus();
}
function bSearch() {
  return `<div class="seg bsort">${[['near', '📍 Terdekat'], ['sold', '🔥 Terlaris'], ['cheap', '💰 Termurah'], ['rating', '⭐ Rating'], ['promo', '⚡ Promo']].map((x) => `<button class="${BY.sort == x[0] ? 'a' : ''}" onclick="BY.sort='${x[0]}';bSearchRun()">${x[1]}</button>`).join('')}</div>
${BY.cat ? `<div class="row"><span class="chip">${catIcon(BY.cat)} ${esc(BY.cat)}</span><button class="gh" onclick="BY.cat='';bSearchRun()">✕ semua kategori</button></div>` : ''}
${BY.loading ? '<p class="mu">Mencari…</p>' : `<small class="mu">${BY.items.length} produk${BY.q ? ' untuk "' + esc(BY.q) + '"' : ''}</small><div class="bgrid">${BY.items.map(pcardB).join('') || '<p class="mu">Tidak ditemukan. Coba kata lain.</p>'}</div>`}`;
}
async function bSetLoc() {
  toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) return toast('Lokasi tidak tersedia — izinkan akses lokasi');
  LS.set('jpos:bll', p); if (BY.tk) { try { const r = await bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ lat: p.lat, lng: p.lng }) }); BY.me = r.me; LS.set('jpos:bme', BY.me); } catch (e) { } }
  toast('Lokasi tersimpan'); bLoad(); if (BY.pg != 'home') R();
}
/* ---- detail produk ---- */
async function bProd(sid, pid) {
  BY.prod = { sid, pid, d: null }; buyerGo('prod');
  try { BY.prod.d = await bApi('/api/b/product?s=' + encodeURIComponent(sid) + '&p=' + encodeURIComponent(pid) + bLL()); } catch (e) { toast(e.message); }
  if (BY.pg == 'prod') R();
}
function bProdPage() {
  const d = BY.prod && BY.prod.d; if (!d) return '<p class="mu">Memuat produk…</p>';
  const x = d.item, s = d.shop || {}, inC = BY.cart && BY.cart.store == x.sid && BY.cart.items[x.pid];
  return `<div class="bpd">${pimg(x, 'bimg big')}${disc(x) ? `<div class="bfl">⚡ Flash Sale -${disc(x)}% · berakhir <span data-end="${x.fse}">--:--:--</span></div>` : ''}
<div class="cd"><div class="bpr big"><span>${rp(x.price)}</span>${disc(x) ? `<s>${rp(x.orig)}</s>` : ''}</div><h3 style="margin:4px 0">${esc(x.n)}</h3><small class="mu">${stars(x.rt)}${x.rc ? ' (' + x.rc + ' ulasan)' : ''} · ${soldTxt(x.sold)} · stok ${x.st}${x.unit ? ' ' + esc(x.unit) : ''}</small>
<div class="wrap" style="margin-top:8px"><button class="gh" onclick="bFav('${esc(x.sid)}','${esc(x.pid)}')">${d.fav ? '❤️ Favorit' : '🤍 Favoritkan'}</button><button class="gh" onclick="shareText('${esc(x.n).replace(/'/g, '')}','${esc(x.n).replace(/'/g, '')} ${rp(x.price)} di ${esc(x.sn).replace(/'/g, '')} — cari di aplikasi J-POS Belanja')">↗ Bagikan</button></div></div>
${d.vouchers.length ? `<div class="cd"><b>🎟️ Voucher toko</b><div class="hs" style="margin-top:6px">${d.vouchers.map((v) => `<div class="vch"><b>${v.typ == 'pct' ? v.val + '%' : shortRp(v.val)}</b><small>${v.min ? 'min ' + shortRp(v.min) : 'tanpa minimum'}</small><code>${esc(v.code)}</code></div>`).join('')}</div></div>` : ''}
<div class="cd"><div class="row" style="margin:0"><span class="row" style="margin:0;gap:10px"><em class="sav">${esc((s.name || '?')[0])}</em><span><b>${esc(s.name || x.sn)}</b><br><small class="mu">${stars(s.rt)} · ${s.followers || 0} pengikut · ${s.np || 0} produk${x.dist != null ? ' · ' + distStr(x.dist) : ''}</small></span></span></div><div class="fm2" style="margin-top:8px"><button class="gh ${d.followed ? '' : 'a'}" onclick="bFollow('${esc(x.sid)}')">${d.followed ? '✓ Mengikuti' : '+ Ikuti'}</button><button class="gh" onclick="bOpenStore('${esc(x.sid)}')">Kunjungi toko</button></div><small class="mu">${s.cod ? '💵 COD · ' : ''}${s.credit ? '🤝 Kredit/tempo · ' : ''}🚚 ${String(s.ships || '').split(',').filter(Boolean).map((k) => (BMETHODS[k] || [k])[0]).join(', ')}${s.minorder ? ' · min. belanja ' + rp(s.minorder) : ''}</small></div>
<div class="cd"><b>Ulasan pembeli</b>${d.reviews.map((r) => `<div class="rv"><small><b>${esc(r.bn)}</b> · ${'⭐'.repeat(r.stars)} · ${dstr(r.t)}</small><div>${esc(r.txt || '')}</div>${r.reply ? `<small class="mu">↳ Toko: ${esc(r.reply)}</small>` : ''}</div>`).join('') || '<p class="mu">Belum ada ulasan.</p>'}</div>
${d.more.length ? `<div class="bsec"><b>Produk lain dari toko ini</b></div><div class="bgrid">${d.more.map(pcardB).join('')}</div>` : ''}</div>
<div class="bbuy"><button class="bic" onclick="bChat('${esc(x.sid)}','${esc(x.sn).replace(/'/g, '')}')">💬<small>Chat</small></button><button class="gh big" onclick="bAddCart(0)">${inC ? 'Ubah keranjang' : '+ Keranjang'}</button><button class="pr" onclick="bAddCart(1)">Beli sekarang</button></div>`;
}
function bAddCart(now) {
  const x = BY.prod.d.item, inC = BY.cart && BY.cart.store == x.sid && BY.cart.items[x.pid];
  const m = modal(`<div class="row" style="margin:0;gap:10px">${pimg(x, 'bimg sm')}<span><b>${rp(x.price)}</b><br><small class="mu">stok ${x.st}</small></span></div><b>Jumlah</b><div class="qt" style="justify-content:center"><button id="mn">−</button><input id="qq" type="number" value="${inC ? inC.q : 1}" min="1" max="${x.st}"><button id="pl">+</button></div>
<label><small class="mu">💬 Tawar harga per ${esc(x.unit || 'item')} (opsional) — toko bisa terima, tolak, atau beri harga lain</small><input id="of" type="number" placeholder="mis. ${Math.round(x.price * 0.95)}" value="${inC && inC.offer ? inC.offer : ''}"></label><button class="pr" id="ad">${now ? 'Lanjut ke pembayaran' : 'Masukkan keranjang'}</button>`);
  const q = $('#qq', m); $('#mn', m).onclick = () => (q.value = Math.max(1, num(q.value) - 1)); $('#pl', m).onclick = () => (q.value = Math.min(x.st, num(q.value) + 1));
  $('#ad', m).onclick = () => {
    const n = Math.min(x.st, Math.max(1, num(q.value))), of = num($('#of', m).value);
    if (of && of >= x.price) return toast('Harga tawar harus di bawah ' + rp(x.price));
    if (BY.cart && BY.cart.store != x.sid && Object.keys(BY.cart.items).length) { if (!confirm('Keranjang berisi produk dari ' + BY.cart.sn + '. Satu pesanan untuk satu toko. Kosongkan keranjang?')) return; BY.cart = null; }
    if (!BY.cart) BY.cart = { store: x.sid, sn: x.sn, items: {} };
    if (!BY.stores.some((s) => s.id == x.sid) && BY.prod.d.shop) BY.stores.push({ ...BY.prod.d.shop, id: x.sid });
    BY.cart.items[x.pid] = { q: n, offer: of || 0, n: x.n, price: x.price, unit: x.unit || '', st: x.st }; bSave(); m.close();
    if (now) buyerGo('cart'); else { toast('Masuk keranjang 🛒'); R(); }
  };
}
async function bFollow(sid) { if (!BY.tk) return bLogin(() => bFollow(sid)); try { const r = await bPost('/api/b/follow', { store: sid }); toast(r.followed ? 'Mengikuti toko' : 'Berhenti mengikuti'); if (BY.prod && BY.prod.d) BY.prod.d.followed = r.followed; if (BY.store) BY.store.followed = r.followed; R(); } catch (e) { toast(e.message); } }
async function bFav(sid, pid) { if (!BY.tk) return bLogin(() => bFav(sid, pid)); try { const r = await bPost('/api/b/fav', { store: sid, pid }); toast(r.fav ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit'); if (BY.prod && BY.prod.d) BY.prod.d.fav = r.fav; R(); } catch (e) { toast(e.message); } }
/* ---- halaman toko ---- */
async function bOpenStore(sid) {
  BY.store = { id: sid, d: null, tab: 'prod' }; buyerGo('store');
  try { BY.store.d = await bApi('/api/b/shop?s=' + encodeURIComponent(sid) + bLL()); BY.store.followed = BY.store.d.followed; if (!BY.stores.some((s) => s.id == sid)) BY.stores.push({ ...BY.store.d.shop }); } catch (e) { toast(e.message); }
  if (BY.pg == 'store') R();
}
function bStore() {
  const d = BY.store && BY.store.d; if (!d) return '<p class="mu">Memuat toko…</p>'; const s = d.shop;
  return `<div class="bsh"><em class="sav big">${esc((s.name || '?')[0])}</em><div><h2>${esc(s.name)}</h2><small>${stars(s.rt)}${s.rc ? ' (' + s.rc + ')' : ''} · ${s.followers} pengikut${s.dist != null ? ' · ' + distStr(s.dist) : ''}</small><br><small>${esc(s.addr || '')}</small></div></div>
<div class="fm2"><button class="pr" style="${BY.store.followed ? 'background:#999' : ''}" onclick="bFollow('${esc(s.id)}')">${BY.store.followed ? '✓ Mengikuti' : '+ Ikuti'}</button><button class="gh big" onclick="bChat('${esc(s.id)}','${esc(s.name).replace(/'/g, '')}')">💬 Chat</button></div>
${s.descr ? `<small class="mu">${esc(s.descr)}</small>` : ''}<small class="mu">${s.cod ? '💵 COD · ' : ''}${s.credit ? '🤝 Kredit · ' : ''}🚚 ${String(s.ships || '').split(',').filter(Boolean).map((k) => (BMETHODS[k] || [k])[0]).join(', ')}${s.minorder ? ' · min ' + rp(s.minorder) : ''}</small>
${d.vouchers.length ? `<div class="hs">${d.vouchers.map((v) => `<div class="vch"><b>${v.typ == 'pct' ? v.val + '%' : shortRp(v.val)}</b><small>${v.min ? 'min ' + shortRp(v.min) : 'semua'}</small><code>${esc(v.code)}</code></div>`).join('')}</div>` : ''}
<div class="seg">${[['prod', 'Produk (' + d.items.length + ')'], ['post', 'Postingan (' + d.posts.length + ')']].map((t) => `<button class="${BY.store.tab == t[0] ? 'a' : ''}" onclick="BY.store.tab='${t[0]}';R()">${t[1]}</button>`).join('')}</div>
${BY.store.tab == 'prod' ? `<div class="bgrid">${d.items.map(pcardB).join('') || '<p class="mu">Belum ada produk.</p>'}</div>` : d.posts.map((p) => `<div class="cd">${p.img ? `<img src="${esc(p.img)}" style="width:100%;border-radius:12px">` : ''}<p>${esc(p.txt)}</p><small class="mu">❤️ ${p.likes} · ${dstr(p.t)}</small>${p.pid ? `<button class="gh a" onclick="bProd('${esc(s.id)}','${esc(p.pid)}')">Lihat produk</button>` : ''}</div>`).join('') || '<p class="mu">Belum ada postingan.</p>'}`;
}
/* ---- Untukmu: feed konten toko (scroll vertikal) ---- */
async function bLoadFeed() { BY.feedT = 1; try { BY.feed = (await bApi('/api/b/feed')).posts; } catch (e) { toast(e.message); } if (BY.pg == 'feed') R(); }
function bFeed() {
  if (!BY.feed.length) return `<div class="cd"><p class="mu">${BY.feedT ? 'Belum ada postingan dari toko. Toko bisa membuat postingan promo di Seller Center.' : 'Memuat…'}</p></div>`;
  return `<div class="feed">${BY.feed.map((p) => `<div class="fcard" style="${p.img ? `background-image:url('${esc(p.img)}')` : ''}"><div class="fov"><button class="fst" onclick="bOpenStore('${esc(p.sid)}')"><em class="sav">${esc((p.sn || '?')[0])}</em><b>${esc(p.sn)}</b></button><p>${esc(p.txt || '')}</p>${p.pid && p.pn ? `<button class="fprod" onclick="bProd('${esc(p.sid)}','${esc(p.pid)}')">🛍️ ${esc(p.pn)} · <b>${rp(p.price)}</b> ›</button>` : ''}</div><div class="fside"><button onclick="bLike(${p.id})">${p.liked ? '❤️' : '🤍'}<small>${p.likes}</small></button><button onclick="bChat('${esc(p.sid)}','${esc(p.sn).replace(/'/g, '')}')">💬<small>Chat</small></button><button onclick="shareText('${esc(p.sn).replace(/'/g, '')}','${esc((p.txt || '').slice(0, 80)).replace(/'/g, '')} — lihat di J-POS Belanja')">↗<small>Bagi</small></button></div></div>`).join('')}</div>`;
}
async function bLike(id) { if (!BY.tk) return bLogin(() => bLike(id)); try { const r = await bPost('/api/b/like', { post: id }), p = BY.feed.find((x) => x.id == id); if (p) { p.liked = r.liked; p.likes += r.liked ? 1 : -1; } R(); } catch (e) { toast(e.message); } }

/* ---- keranjang & checkout ---- */
const BQ = { m: 'ambil', pay: 'transfer', days: 14, q: null, vc: '', vd: 0 };
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
<div class="cd"><b>🎟️ Voucher toko</b><div class="srch" style="margin-top:6px"><input id="bv" placeholder="Masukkan kode voucher" value="${esc(BQ.vc)}" style="text-transform:uppercase"><button class="gh" onclick="bVoucher(${sub})">Pakai</button></div>${BQ.vd ? `<small class="gr">✔ ${esc(BQ.vc)} hemat ${rp(BQ.vd)}</small>` : ''}</div>
<div class="cd tt">${row('Subtotal', rp(sub))}${nego ? row('Jika tawaran diterima', '<span class="or">' + rp(subO) + '</span>') : ''}${BQ.vd ? row('Voucher', '<span class="gr">−' + rp(BQ.vd) + '</span>') : ''}${row('Ongkir', kind == 'exp' ? 'diinfokan toko' : rp(fee || 0))}<h2>${rp(sub - BQ.vd + (fee || 0))}</h2>${s.minorder && sub < s.minorder ? `<small class="rd">Minimal belanja ${rp(s.minorder)}</small>` : ''}
<button class="pr" onclick="bCheckout()">${nego ? 'Kirim penawaran ke toko' : BQ.pay == 'kredit' ? 'Ajukan pesanan kredit' : 'Buat pesanan'}</button></div>`;
}
async function bVoucher(sub) { const c = $('#bv').value.trim().toUpperCase(); if (!c) { BQ.vc = ''; BQ.vd = 0; return R(); } if (!BY.tk) return bLogin(() => bVoucher(sub)); try { const r = await bPost('/api/b/voucher', { store: BY.cart.store, code: c, sub }); BQ.vc = r.code; BQ.vd = r.disc; toast('Voucher dipakai: hemat ' + rp(r.disc)); } catch (e) { BQ.vc = ''; BQ.vd = 0; toast(e.message); } R(); }
function bQty(pid, d) { BQ.vd = 0; BQ.vc = ''; const i = BY.cart.items[pid]; i.q = Math.min(i.st || 9999, i.q + d); if (i.q <= 0) delete BY.cart.items[pid]; if (!Object.keys(BY.cart.items).length) BY.cart = null; bSave(); R(); }
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
    const r = await bPost('/api/b/orders', { store: BY.cart.store, items: Object.entries(BY.cart.items).map(([pid, i]) => ({ pid, q: i.q, offer: i.offer })), method: BQ.m, pay: BQ.pay, days: BQ.days, addr, lat: ll && ll.lat, lng: ll && ll.lng, note: ($('#bn') || {}).value || '', voucher: BQ.vc });
    BQ.vc = ''; BQ.vd = 0;
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
    BY.orders = r.orders; if (r.orders.some((o) => o.status == 'selesai')) bApi('/api/b/reviewed').then((x) => { BY.reviewed = x.ids; }).catch(() => { }); if (ch && MODE == 'buyer' && (BY.pg == 'ord') && !$('.md')) R();
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
    if (o.status == 'selesai' && !BY.reviewed.includes(o.id)) b.push(`<button class="gh a" onclick="bReview(${o.id})">⭐ Beri ulasan</button>`);
    if (o.status == 'selesai') b.push(`<button class="gh" onclick="bReorder(${o.id})">🔁 Beli lagi</button>`);
    if (!o.paid && o.pay == 'transfer' && ['baru', 'diproses', 'dikirim', 'selesai'].includes(o.status)) b.push(`<button class="gh" onclick="bAct(${o.id},'paid_claim',{note:prompt('Catatan transfer (bank/nama pengirim):')||''})">Saya sudah transfer</button>`);
    b.push(`<button class="gh" onclick="bChat('${esc(o.store_id)}','${esc(o.sn).replace(/'/g, '')}')">💬 Chat toko</button>`);
    if (o.wa) b.push(`<a class="gh" target="_blank" href="${esc(waLink(o.wa, 'Halo ' + o.sn + ', saya ' + (BY.me ? BY.me.name : '') + ' terkait pesanan #' + o.id))}">WA toko</a>`);
    return `<div class="cd"><div class="row" style="margin:0"><span><b>#${o.id} · ${esc(o.sn)}</b><br><small class="mu">${tstr(o.t)}</small></span><span class="chip ${st[1]}">${st[0]}</span></div>
${o.items.map((i) => `<div class="row" style="margin:2px 0"><span>${esc(i.n)} <small class="mu">× ${i.q}</small>${i.offer ? `<br><small class="or">tawaran Anda ${rp(i.offer)}</small>` : ''}${i.counter && o.status == 'nego_toko' ? `<br><small class="gr">harga dari toko ${rp(i.counter)}</small>` : ''}</span><b>${rp((o.status == 'nego_toko' && i.counter ? i.counter : i.price) * i.q)}</b></div>`).join('')}
${o.disc ? row('Voucher ' + esc(o.vcode || ''), '<span class="gr">−' + rp(o.disc) + '</span>') : ''}${row('Ongkir · ' + esc((BMETHODS[o.method] || [o.method])[0]), o.ship ? rp(o.ship) : BMETHODS[o.method] && BMETHODS[o.method][1] == 'exp' ? 'menunggu toko' : rp(0))}${row('<b>Total</b>', rp(o.tot))}
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
  return `<div class="cd"><h3>${esc(BY.me.name)}</h3><small class="mu">${esc(BY.me.phone || '')}</small><div class="fm" style="margin-top:8px"><input id="an" placeholder="Nama" value="${esc(BY.me.name)}"><input id="aa" placeholder="Alamat pengiriman" value="${esc(BY.me.addr || '')}"><button class="gh" onclick="bSetLoc()">📍 Perbarui lokasi (${BY.me.lat != null ? 'sudah' : 'belum'})</button><button class="pr" onclick="bSaveMe()">Simpan</button></div></div>
<div class="cd" id="bcred"><h3>Kelayakan kredit</h3><p class="mu">Memuat…</p></div>
<div class="bmenu">${[['ord', '📦', 'Pesanan saya'], ['chat', '💬', 'Chat toko'], ['favs', '❤️', 'Favorit & toko diikuti']].map((x) => `<button onclick="${x[0] == 'favs' ? 'bFavs()' : `buyerGo('${x[0]}')`}"><i>${x[1]}</i><span>${x[2]}</span><b>›</b></button>`).join('')}</div><div id="bfavs"></div>
<div class="wrap"><button class="gh" onclick="bPin()">🔑 Ganti PIN</button><button class="gh d" onclick="bLogout()">Keluar akun</button><button class="gh" onclick="bExit()">← Ke layar awal</button></div>`;
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
function startBuyer() { MODE = 'buyer'; BY.pg = 'home'; R(); hb('b:home'); if (!LS.get('jpos:bll', null) && !(BY.me && BY.me.lat != null)) bSetLoc(); }

async function bFavs() { const el = $('#bfavs'); if (!el) return; el.innerHTML = '<p class="mu">Memuat…</p>'; try { const r = await bApi('/api/b/favs'); el.innerHTML = `<div class="cd"><b>Toko diikuti</b><div class="wrap" style="margin-top:6px">${r.stores.map((s) => `<button class="gh" onclick="bOpenStore('${esc(s.id)}')">🏪 ${esc(s.name)}</button>`).join('') || '<small class="mu">Belum ada</small>'}</div></div><div class="bsec"><b>❤️ Produk favorit</b></div><div class="bgrid">${r.items.map(pcardB).join('') || '<small class="mu">Belum ada</small>'}</div>`; } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; } }
function bReview(id) {
  let st = 5; const m = modal(`<h3>Ulasan pesanan #${id}</h3><div class="stars">${[1, 2, 3, 4, 5].map((i) => `<button data-s="${i}">⭐</button>`).join('')}</div><textarea id="rt" rows="3" placeholder="Ceritakan kualitas barang & pelayanan toko"></textarea><button class="pr" id="ok">Kirim ulasan</button>`);
  const draw = () => $$('[data-s]', m).forEach((b) => (b.style.opacity = +b.dataset.s <= st ? 1 : 0.25)); draw();
  $$('[data-s]', m).forEach((b) => (b.onclick = () => { st = +b.dataset.s; draw(); }));
  $('#ok', m).onclick = async () => { try { await bPost('/api/b/review', { order: id, stars: st, txt: $('#rt', m).value }); BY.reviewed.push(id); m.close(); toast('Terima kasih atas ulasannya!'); R(); } catch (e) { toast(e.message); } };
}
function bReorder(id) { const o = BY.orders.find((x) => x.id == id); if (!o) return; BY.cart = { store: o.store_id, sn: o.sn, items: {} }; o.items.forEach((i) => (BY.cart.items[i.pid] = { q: i.q, offer: 0, n: i.n, price: i.price, unit: i.unit || '', st: 9999 })); bSave(); buyerGo('cart'); toast('Produk dimasukkan ke keranjang — harga akan dicek ulang saat pesan'); }
