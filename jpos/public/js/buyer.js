'use strict';
/* ============ J-POS BELANJA — marketplace semua toko (gaya Tokopedia) ============ */
const BY = {
  tk: LS.get('jpos:bt', ''), me: LS.get('jpos:bme', null), pg: 'home', q: '', cat: '', sort: 'near', flt: { min: 0, max: 0, rt: 0, cod: 0, kredit: 0 },
  store: null, prod: null, back: 'home', od: null, home: LS.get('jpos:bhome', null), items: [], stores: LS.get('jpos:bstores', []), feed: [],
  carts: LS.get('jpos:bcarts', null) || (() => { const o = LS.get('jpos:bcart', null); return o && o.store ? { [o.store]: { sn: o.sn, items: o.items } } : {}; })(),
  recent: LS.get('jpos:brecent', []), orders: [], ordSt: {}, ordTab: 'all', reviewed: [], loading: false, addrI: 0,
};
const bApi = (p, o) => api(p, o || {}, BY.tk || '');
const bPost = (p, b) => bApi(p, { method: 'POST', body: JSON.stringify(b) });
const myLL = () => { const a = curAddr(); if (a && a.lat != null) return a; if (BY.me && BY.me.lat != null) return BY.me; return LS.get('jpos:bll', null); };
const bLL = () => { const l = myLL(); return l && l.lat != null ? '&lat=' + l.lat + '&lng=' + l.lng : ''; };
const bSave = () => LS.set('jpos:bcarts', BY.carts);
const cartN = () => Object.values(BY.carts).reduce((a, c) => a + Object.values(c.items).reduce((x, i) => x + i.q, 0), 0);
const addrs = () => (BY.me && BY.me.addrs) || [];
const curAddr = () => addrs()[BY.addrI] || addrs().find((a) => a.main) || addrs()[0] || null;
const BST = { nego: ['Menunggu jawaban tawar', 'o'], nego_toko: ['Toko memberi harga — setujui?', 'o'], acc_kredit: ['Menunggu ACC kredit', 'o'], baru: ['Menunggu konfirmasi', 'o'], diproses: ['Diproses penjual', ''], dikirim: ['Dalam pengiriman', 'g'], selesai: ['Selesai', 'g'], batal: ['Dibatalkan', 'r'], ditolak: ['Ditolak penjual', 'r'] };
const BPAGES = [['home', '🏠', 'Beranda'], ['feed', '▶️', 'Feed'], ['ord', '🧾', 'Transaksi'], ['wish', '❤️', 'Wishlist'], ['acc', '👤', 'Akun']];
const CATI = { sembako: '🍚', beras: '🍚', minuman: '🥤', makanan: '🍜', bumbu: '🧂', kebutuhan: '🧴', kresek: '🛍️', plastik: '🛍️', snack: '🍪', rokok: '🚬', obat: '💊', bayi: '🍼', elektronik: '🔌', atk: '✏️', pakaian: '👕', kosmetik: '💄', kopi: '☕', telur: '🥚', minyak: '🫗', gula: '🍬', umum: '📦' };
const catIcon = (c) => { const k = String(c || '').toLowerCase(); for (const [x, v] of Object.entries(CATI)) if (k.includes(x)) return v; return '🏷️'; };
const shortRp = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'jt' : n >= 1e3 ? Math.round(n / 1e3) + 'rb' : String(n));
const soldTxt = (n) => (n ? (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'rb+' : n) + ' terjual' : '');
const starTxt = (r) => (r ? '<span class="st">★</span> ' + String(r).replace('.', ',') : '');
function buyerGo(pg) { if (pg != BY.pg && !['prod', 'store', 'od', 'co', 'addr'].includes(pg)) BY.back = pg; BY.pg = pg; R(); window.scrollTo(0, 0); hb('b:' + pg); }
function bBack() { buyerGo({ prod: BY.back, store: BY.back, od: 'ord', co: 'cart', addr: BY.coBack || 'acc' }[BY.pg] || 'home'); }
function bExit() { MODE = 'home'; document.body.classList.remove('in', 'buyer'); R(); }
function buyerShell() {
  document.body.classList.add('buyer');
  const n = cartN(), act = BY.orders.filter((o) => o.status == 'nego_toko' || o.status == 'dikirim').length;
  const P = { home: bHome, search: bSearch, feed: bFeed, store: bStore, prod: bProdPage, cart: bCart, co: bCheckoutPage, ord: bOrders, od: bOrderDetail, chat: bChats, acc: bAcc, wish: bWish, addr: bAddrPage };
  let body; try { body = (P[BY.pg] || bHome)(); } catch (e) { console.error(e); body = '<p class="rd">' + esc(e.message) + '</p>'; }
  const T = { feed: 'Feed', cart: 'Keranjang', co: 'Pengiriman & pembayaran', ord: 'Daftar transaksi', od: 'Detail transaksi', chat: 'Chat', acc: 'Akun', store: 'Toko', prod: '', wish: 'Wishlist', addr: 'Daftar alamat' };
  const cartBtn = `<button class="bic" onclick="buyerGo('cart')">🛒${n ? `<em>${n}</em>` : ''}</button>`;
  const top = ['home', 'search'].includes(BY.pg)
    ? `<div class="bhead">${BY.pg == 'search' ? '<button class="bic" onclick="buyerGo(\'home\')">‹</button>' : ''}<div class="bsr"><span>🔍</span><input id="bq" placeholder="Cari di J-POS Belanja" value="${esc(BY.q)}" onfocus="if(BY.pg!='search'){buyerGo('search');setTimeout(()=>$('#bq')&&$('#bq').focus(),30)}" onkeydown="if(event.key=='Enter'){BY.q=this.value;bSearchRun()}"></div><button class="bic" onclick="buyerGo('chat')">💬</button>${cartBtn}</div>${BY.pg == 'home' ? `<div class="bloc2" onclick="bAddrPick()">📍 Dikirim ke <b>${esc(curAddr() ? curAddr().label + ' · ' + curAddr().addr : BY.me && BY.me.addr ? BY.me.addr : myLL() ? 'Lokasi saya' : 'Atur lokasi pengiriman')}</b> ▾</div>` : ''}`
    : `<header class="bh"><button class="bic" onclick="bBack()">‹</button><b>${T[BY.pg] || ''}</b><span class="sp"></span>${BY.pg == 'prod' || BY.pg == 'store' ? `<button class="bic" onclick="buyerGo('search')">🔍</button>` : ''}${BY.pg != 'cart' ? cartBtn : ''}</header>`;
  const nav = ['prod', 'co', 'od', 'addr'].includes(BY.pg) ? '' : `<nav class="bn">${BPAGES.map((p) => `<button class="${BY.pg == p[0] || (BY.pg == 'search' && p[0] == 'home') ? 'a' : ''}" onclick="buyerGo('${p[0]}')"><i>${p[1]}</i><span>${p[2]}</span>${p[0] == 'ord' && act ? `<em style="display:grid">${act}</em>` : ''}</button>`).join('')}</nav>`;
  return `${top}<main class="bmain ${nav ? '' : 'nonav'}">${body}</main>${nav}`;
}
function bAfter() { if (BY.pg == 'home') { if (!BY.loaded) { BY.loaded = 1; bLoad(); } bTimer(); } if (BY.pg == 'prod') bTimer(); if (BY.pg == 'feed' && !BY.feedT) bLoadFeed(); if (['ord', 'od'].includes(BY.pg)) bLoadOrders(); if (BY.pg == 'chat') bLoadChats(); if (BY.pg == 'co') bQuoteAll(); if (BY.pg == 'acc' && BY.tk) setTimeout(bLoadMe, 0); if (BY.pg == 'wish' && BY.tk && !BY.wish) bFavs(); }
let bTm; function bTimer() { clearInterval(bTm); bTm = setInterval(() => { $$('[data-end]').forEach((el) => { const d = +el.dataset.end - Date.now(); if (d <= 0) return (el.textContent = 'berakhir'); const h = Math.floor(d / 36e5), m = Math.floor((d % 36e5) / 6e4), s = Math.floor((d % 6e4) / 1e3); el.textContent = [h, m, s].map((x) => String(x).padStart(2, '0')).join(' : '); }); if (MODE != 'buyer') clearInterval(bTm); }, 1000); }

/* ---- kartu produk ---- */
const pimg = (x, cls) => `<em class="${cls || 'bimg'}" style="background:${COL[(x.c || x.n || '').length % COL.length]}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : `<span>${catIcon(x.c)}</span>`}</em>`;
const disc = (x) => (x.fsp && x.orig > x.price ? Math.round((1 - x.price / x.orig) * 100) : 0);
const pcardB = (x) => `<button class="bpc" onclick="bProd('${esc(x.sid)}','${esc(x.pid)}')">${pimg(x)}${x.fsp ? '<i class="bdisc">⚡ Flash</i>' : ''}<div class="bpb"><b>${esc(x.n)}</b><div class="bpr"><span>${rp(x.price)}</span></div>${disc(x) ? `<div class="bpo"><i>${disc(x)}%</i><s>${rp(x.orig)}</s></div>` : ''}<small class="bst">🏪 ${esc(x.sn)}</small><small class="mu">${starTxt(x.rt)}${x.rt && x.sold ? ' · ' : ''}${soldTxt(x.sold)}${x.dist != null ? (x.rt || x.sold ? ' · ' : '') + distStr(x.dist) : ''}</small></div></button>`;

/* ---- beranda ---- */
async function bLoad() {
  if (!canNet()) return toast('Offline — menampilkan data terakhir');
  BY.loading = true;
  try {
    const [h, s] = await Promise.all([api('/api/b/home?' + bLL().slice(1), {}, ''), api('/api/b/stores?' + bLL().slice(1), {}, '')]);
    BY.home = h; BY.stores = s.stores; LS.set('jpos:bhome', { ...h, banners: [], flash: h.flash.slice(0, 8).map((x) => ({ ...x, img: '' })), best: h.best.slice(0, 10).map((x) => ({ ...x, img: '' })), fresh: [] }); LS.set('jpos:bstores', BY.stores);
  } catch (e) { toast(e.message); }
  BY.loading = false; if (MODE == 'buyer' && BY.pg == 'home') R();
}
function bHome() {
  const h = BY.home || { flash: [], best: [], fresh: [], cats: [], banners: [] };
  const bans = h.banners.length ? h.banners : [{ txt: 'Belanja grosir langsung dari toko terdekat', g: 1 }, { txt: 'Bisa tawar harga, COD, transfer, atau kredit', g: 2 }, { txt: 'Ongkir otomatis sesuai jarak', g: 3 }];
  return `<div class="bban">${bans.map((b, i) => b.img ? `<button class="bbn" onclick="${b.pid ? `bProd('${esc(b.sid)}','${esc(b.pid)}')` : `bOpenStore('${esc(b.sid)}')`}"><img src="${esc(b.img)}" alt=""><span><b>${esc(b.sn)}</b><br><small>${esc((b.txt || '').slice(0, 60))}</small></span></button>` : `<div class="bbn g${b.g || (i % 3) + 1}"><span><b>J-POS Belanja</b><br>${esc(b.txt)}</span></div>`).join('')}</div>
<div class="bqk">${[['🔥', 'Terlaris', "BY.sort='sold';BY.q='';BY.cat='';bSearchRun()"], ['⚡', 'Promo', "BY.sort='promo';BY.q='';BY.cat='';bSearchRun()"], ['📍', 'Terdekat', "BY.sort='near';BY.q='';BY.cat='';bSearchRun()"], ['🏪', 'Toko', "bStoreList()"], ['🧾', 'Transaksi', "buyerGo('ord')"]].map((x) => `<button onclick="${x[2]}"><i>${x[0]}</i><small>${x[1]}</small></button>`).join('')}</div>
${h.cats.length ? `<div class="bsec"><b>Kategori pilihan</b></div><div class="bcat">${h.cats.slice(0, 10).map((c) => `<button onclick="BY.cat='${esc(c.c).replace(/'/g, '')}';BY.q='';bSearchRun()"><i>${catIcon(c.c)}</i><small>${esc(c.c)}</small></button>`).join('')}</div>` : ''}
${h.flash.length ? `<div class="bsec fs"><div class="row" style="margin:0"><b>⚡ Kejar Diskon</b><span>Berakhir dalam <span class="cdn" data-end="${Math.min(...h.flash.map((x) => x.fse))}">--</span></span></div><div class="hs">${h.flash.map((x) => `<button class="bfs" onclick="bProd('${esc(x.sid)}','${esc(x.pid)}')">${pimg(x, 'bimg sm')}<b>${rp(x.price)}</b><div class="bpo"><i>${disc(x)}%</i><s>${rp(x.orig)}</s></div><div class="bar"><u style="width:${Math.min(100, 20 + (x.sold || 0) * 5)}%"></u></div><small class="mu">${x.sold ? 'Segera habis' : 'Tersedia'}</small></button>`).join('')}</div></div>` : ''}
${BY.recent.length ? `<div class="bsec"><b>Terakhir dilihat</b></div><div class="hs">${BY.recent.slice(0, 10).map((x) => `<div class="hsi">${pcardB(x)}</div>`).join('')}</div>` : ''}
${BY.stores.length ? `<div class="bsec"><div class="row" style="margin:0"><b>Toko ${myLL() ? 'terdekat' : 'pilihan'}</b><a onclick="bStoreList()">Lihat semua</a></div></div><div class="hs">${BY.stores.slice(0, 15).map((s) => `<button class="stc" onclick="bOpenStore('${esc(s.id)}')"><em>${esc((s.name || '?')[0].toUpperCase())}</em><b>${esc(s.name)}</b><small class="mu">${s.dist != null ? '📍 ' + distStr(s.dist) + ' · ' : ''}${s.np} produk</small><small class="tags">${s.cod ? '<i>COD</i>' : ''}${s.credit ? '<i>Kredit</i>' : ''}</small></button>`).join('')}</div>` : ''}
${h.best.length ? `<div class="bsec"><b>🔥 Paling laris</b></div><div class="hs">${h.best.slice(0, 10).map((x) => `<div class="hsi">${pcardB(x)}</div>`).join('')}</div>` : ''}
<div class="bsec"><b>Rekomendasi untukmu</b> ${BY.loading ? '<small class="mu">memuat…</small>' : ''}</div>
<div class="bgrid">${(h.fresh.length ? h.fresh : h.best).map(pcardB).join('') || `<div class="cd" style="grid-column:1/-1"><p class="mu">${BY.loading ? 'Memuat produk…' : 'Belum ada produk. Produk toko tampil otomatis setelah pemilik toko membuka aplikasi J-POS dalam keadaan online.'}</p><button class="gh" onclick="bLoad()">⟳ Muat ulang</button></div>`}</div>`;
}
function bStoreList() { const m = modal(`<h3>Semua toko</h3><div style="max-height:65vh;overflow:auto">${BY.stores.map((s) => `<button class="us2" data-s="${esc(s.id)}"><em>${esc((s.name || '?')[0])}</em><span>${esc(s.name)}<br><small class="mu">${s.dist != null ? distStr(s.dist) + ' · ' : ''}${s.np} produk ${s.cod ? '· COD ' : ''}${s.credit ? '· Kredit' : ''}</small></span><span class="sp"></span>›</button>`).join('') || '<p class="mu">Belum ada toko.</p>'}</div>`); $$('[data-s]', m).forEach((b) => (b.onclick = () => { m.close(); bOpenStore(b.dataset.s); })); }

/* ---- pencarian + filter ---- */
async function bSearchRun() {
  BY.pg = 'search'; BY.loading = true; R();
  try { const r = await api('/api/b/products?q=' + encodeURIComponent(BY.q) + '&cat=' + encodeURIComponent(BY.cat) + '&sort=' + BY.sort + bLL(), {}, ''); BY.items = r.items; } catch (e) { toast(e.message); }
  BY.loading = false; if (BY.pg == 'search') R();
}
function bFiltered() {
  const f = BY.flt, sc = (sid) => BY.stores.find((s) => s.id == sid) || {};
  return BY.items.filter((x) => (!f.min || x.price >= f.min) && (!f.max || x.price <= f.max) && (!f.rt || (x.rt || 0) >= f.rt) && (!f.cod || sc(x.sid).cod) && (!f.kredit || sc(x.sid).credit));
}
function bSearch() {
  const L = bFiltered(), nf = Object.values(BY.flt).filter(Boolean).length;
  return `<div class="bchips"><button class="${nf ? 'a' : ''}" onclick="bFilter()">⚙ Filter${nf ? ' (' + nf + ')' : ''}</button>${[['near', 'Terdekat'], ['sold', 'Terlaris'], ['cheap', 'Termurah'], ['rating', 'Ulasan'], ['promo', 'Promo']].map((x) => `<button class="${BY.sort == x[0] ? 'a' : ''}" onclick="BY.sort='${x[0]}';bSearchRun()">${x[1]}</button>`).join('')}${BY.cat ? `<button class="a" onclick="BY.cat='';bSearchRun()">${catIcon(BY.cat)} ${esc(BY.cat)} ✕</button>` : ''}</div>
${!BY.q && !BY.cat && !BY.items.length && !BY.loading ? `<div class="cd"><b>Pencarian populer</b><div class="wrap" style="margin-top:6px">${['beras', 'minyak', 'gula', 'kresek', 'kopi', 'mie', 'telur', 'air mineral'].map((w) => `<button class="gh" onclick="BY.q='${w}';bSearchRun()">${w}</button>`).join('')}</div></div>` : ''}
${BY.loading ? '<p class="mu">Mencari…</p>' : `<small class="mu">${L.length} produk${BY.q ? ' untuk "' + esc(BY.q) + '"' : ''}</small><div class="bgrid">${L.map(pcardB).join('') || '<p class="mu">Tidak ditemukan. Coba kata lain atau ubah filter.</p>'}</div>`}`;
}
function bFilter() {
  const f = BY.flt, m = modal(`<h3>Filter</h3><b>Harga</b><div class="fm2"><input id="fmin" type="number" placeholder="Minimum" value="${f.min || ''}"><input id="fmax" type="number" placeholder="Maksimum" value="${f.max || ''}"></div>
<b>Penilaian</b><label class="row"><span>★ 4 ke atas</span><input type="checkbox" id="frt" ${f.rt ? 'checked' : ''}></label><b>Pembayaran</b><label class="row"><span>Bisa COD</span><input type="checkbox" id="fcod" ${f.cod ? 'checked' : ''}></label><label class="row"><span>Bisa kredit / tempo</span><input type="checkbox" id="fkr" ${f.kredit ? 'checked' : ''}></label>
<div class="fm2"><button class="gh" id="rs">Reset</button><button class="pr" id="ok">Terapkan</button></div>`);
  $('#ok', m).onclick = () => { BY.flt = { min: num($('#fmin', m).value), max: num($('#fmax', m).value), rt: $('#frt', m).checked ? 4 : 0, cod: $('#fcod', m).checked ? 1 : 0, kredit: $('#fkr', m).checked ? 1 : 0 }; m.close(); R(); };
  $('#rs', m).onclick = () => { BY.flt = { min: 0, max: 0, rt: 0, cod: 0, kredit: 0 }; m.close(); R(); };
}
async function bSetLoc() {
  toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) return toast('Lokasi tidak tersedia — izinkan akses lokasi');
  LS.set('jpos:bll', p); if (BY.tk) { try { const r = await bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ lat: p.lat, lng: p.lng }) }); BY.me = { ...BY.me, ...r.me }; LS.set('jpos:bme', BY.me); } catch (e) { } }
  toast('Lokasi tersimpan'); bLoad(); R(); return p;
}

/* ---- detail produk ---- */
async function bProd(sid, pid) {
  BY.prod = { sid, pid, d: null, tab: 'info' }; buyerGo('prod');
  try {
    BY.prod.d = await bApi('/api/b/product?s=' + encodeURIComponent(sid) + '&p=' + encodeURIComponent(pid) + bLL());
    const x = BY.prod.d.item; BY.recent = [{ ...x, img: '' }, ...BY.recent.filter((r) => !(r.sid == x.sid && r.pid == x.pid))].slice(0, 20); LS.set('jpos:brecent', BY.recent);
  } catch (e) { toast(e.message); }
  if (BY.pg == 'prod') R();
}
function bProdPage() {
  const d = BY.prod && BY.prod.d; if (!d) return '<p class="mu">Memuat produk…</p>';
  const x = d.item, s = d.shop || {}, inC = BY.carts[x.sid] && BY.carts[x.sid].items[x.pid], tb = BY.prod.tab;
  return `<div class="bpd">${pimg(x, 'bimg big')}${disc(x) ? `<div class="bfl"><span>⚡ Flash Sale</span><span>Berakhir <b data-end="${x.fse}">--</b></span></div>` : ''}
<div class="cd"><div class="bpr big"><span>${rp(x.price)}</span></div>${disc(x) ? `<div class="bpo"><i>${disc(x)}%</i><s>${rp(x.orig)}</s></div>` : ''}<h3 style="margin:6px 0 4px;font-weight:600">${esc(x.n)}</h3><small class="mu">${soldTxt(x.sold) || 'Belum terjual'}${x.rt ? ' · ' + starTxt(x.rt) + ' (' + x.rc + ' rating)' : ''}</small>
<div class="wrap" style="margin-top:8px"><button class="gh" onclick="bFav('${esc(x.sid)}','${esc(x.pid)}')">${d.fav ? '❤️ Di wishlist' : '🤍 Wishlist'}</button><button class="gh" onclick="shareText('${esc(x.n).replace(/'/g, '')}','${esc(x.n).replace(/'/g, '')} ${rp(x.price)} di ${esc(x.sn).replace(/'/g, '')} — J-POS Belanja')">↗ Bagikan</button></div></div>
${d.vouchers.length ? `<div class="cd"><b>🎟️ Kupon toko</b><div class="hs" style="margin-top:6px">${d.vouchers.map((v) => `<div class="vch"><b>${v.typ == 'pct' ? 'Diskon ' + v.val + '%' : 'Potongan ' + shortRp(v.val)}</b><small>${v.min ? 'Min. belanja ' + shortRp(v.min) : 'Tanpa minimum'}</small><code>${esc(v.code)}</code></div>`).join('')}</div></div>` : ''}
<div class="cd"><div class="row" style="margin:0;gap:10px"><em class="sav">${esc((s.name || '?')[0])}</em><span style="flex:1"><b>${esc(s.name || x.sn)}</b><br><small class="mu">${s.rt ? starTxt(s.rt) + ' · ' : ''}${s.followers || 0} pengikut${x.dist != null ? ' · 📍 ' + distStr(x.dist) : ''}</small></span><button class="gh ${d.followed ? '' : 'a'}" onclick="bFollow('${esc(x.sid)}')">${d.followed ? 'Mengikuti' : 'Follow'}</button></div><div class="tags" style="margin-top:8px">${s.cod ? '<i>COD</i>' : ''}${s.credit ? '<i>Kredit/tempo</i>' : ''}${String(s.ships || '').split(',').filter(Boolean).map((k) => `<i>${esc((BMETHODS[k] || [k])[0])}</i>`).join('')}</div><button class="gh" style="width:100%;margin-top:8px" onclick="bOpenStore('${esc(x.sid)}')">Kunjungi toko ›</button></div>
<div class="cd"><div class="tabs2">${[['info', 'Detail'], ['rev', 'Ulasan (' + d.reviews.length + ')'], ['qa', 'Diskusi (' + d.qa.length + ')']].map((t) => `<button class="${tb == t[0] ? 'a' : ''}" onclick="BY.prod.tab='${t[0]}';R()">${t[1]}</button>`).join('')}</div>
${tb == 'info' ? `${row('Kategori', esc(x.c || '-'))}${row('Satuan', esc(x.unit || '-'))}${row('Stok', x.st)}${row('Dikirim dari', esc(s.addr || s.name || '-'))}${s.minorder ? row('Min. belanja', rp(s.minorder)) : ''}<small class="mu">Bisa tawar harga per item saat memasukkan ke keranjang.</small>`
    : tb == 'rev' ? (d.reviews.map((r) => `<div class="rv"><small><b>${esc(r.bn)}</b> · <span class="st">${'★'.repeat(r.stars)}</span> · ${dstr(r.t)}</small><div>${esc(r.txt || '')}</div>${r.reply ? `<small class="mu">↳ Penjual: ${esc(r.reply)}</small>` : ''}</div>`).join('') || '<p class="mu">Belum ada ulasan.</p>')
    : `<div class="srch"><input id="qq2" placeholder="Tanya stok, ukuran, harga grosir…"><button class="gh a" onclick="bAsk()">Kirim</button></div>${d.qa.map((q) => `<div class="rv"><small><b>${esc(q.bn)}</b> · ${dstr(q.t)}</small><div>❓ ${esc(q.q)}</div>${q.a ? `<div class="ans">💬 <b>Penjual:</b> ${esc(q.a)}</div>` : '<small class="mu">Menunggu jawaban penjual</small>'}</div>`).join('') || '<p class="mu">Belum ada diskusi.</p>'}`}</div>
${d.more.length ? `<div class="bsec"><b>Lainnya di toko ini</b></div><div class="hs">${d.more.map((y) => `<div class="hsi">${pcardB(y)}</div>`).join('')}</div>` : ''}</div>
<div class="bbuy"><button class="bic" onclick="bChat('${esc(x.sid)}','${esc(x.sn).replace(/'/g, '')}')">💬</button><button class="gh big ol" onclick="bAddCart(0)">${inC ? 'Ubah keranjang' : '+ Keranjang'}</button><button class="pr" onclick="bAddCart(1)">Beli langsung</button></div>`;
}
async function bAsk() { if (!BY.tk) return bLogin(bAsk); const q = $('#qq2').value.trim(); if (!q) return; try { await bPost('/api/b/qa', { s: BY.prod.sid, p: BY.prod.pid, q }); toast('Pertanyaan terkirim ke penjual'); bProd(BY.prod.sid, BY.prod.pid).then(() => { BY.prod.tab = 'qa'; R(); }); } catch (e) { toast(e.message); } }
function bAddCart(now) {
  const x = BY.prod.d.item, inC = BY.carts[x.sid] && BY.carts[x.sid].items[x.pid];
  const m = modal(`<div class="row" style="margin:0;gap:10px;justify-content:flex-start">${pimg(x, 'bimg sm')}<span><b class="lg2">${rp(x.price)}</b><br><small class="mu">Stok ${x.st}${x.unit ? ' ' + esc(x.unit) : ''}</small></span></div><b>Jumlah</b><div class="qt" style="justify-content:center"><button id="mn">−</button><input id="qq" type="number" value="${inC ? inC.q : 1}" min="1" max="${x.st}"><button id="pl">+</button></div>
<label><small class="mu">💬 Tawar harga per ${esc(x.unit || 'item')} (opsional)</small><input id="of" type="number" placeholder="mis. ${Math.round(x.price * 0.95)}" value="${inC && inC.offer ? inC.offer : ''}"></label><button class="pr" id="ad">${now ? 'Beli langsung' : 'Masukkan keranjang'}</button>`);
  const q = $('#qq', m); $('#mn', m).onclick = () => (q.value = Math.max(1, num(q.value) - 1)); $('#pl', m).onclick = () => (q.value = Math.min(x.st, num(q.value) + 1));
  $('#ad', m).onclick = () => {
    const n = Math.min(x.st, Math.max(1, num(q.value))), of = num($('#of', m).value);
    if (of && of >= x.price) return toast('Harga tawar harus di bawah ' + rp(x.price));
    if (!BY.stores.some((s) => s.id == x.sid) && BY.prod.d.shop) BY.stores.push({ ...BY.prod.d.shop, id: x.sid });
    const c = (BY.carts[x.sid] = BY.carts[x.sid] || { sn: x.sn, items: {} });
    if (now) Object.values(BY.carts).forEach((cc) => Object.values(cc.items).forEach((i) => (i.sel = false)));
    c.items[x.pid] = { q: n, offer: of || 0, n: x.n, price: x.price, unit: x.unit || '', st: x.st, c: x.c, sel: true }; bSave(); m.close();
    if (now) bGoCheckout(); else { toast('Berhasil ditambahkan ke keranjang 🛒'); R(); }
  };
}
async function bFollow(sid) { if (!BY.tk) return bLogin(() => bFollow(sid)); try { const r = await bPost('/api/b/follow', { store: sid }); toast(r.followed ? 'Mengikuti toko' : 'Berhenti mengikuti'); if (BY.prod && BY.prod.d) BY.prod.d.followed = r.followed; if (BY.store) BY.store.followed = r.followed; R(); } catch (e) { toast(e.message); } }
async function bFav(sid, pid) { if (!BY.tk) return bLogin(() => bFav(sid, pid)); try { const r = await bPost('/api/b/fav', { store: sid, pid }); toast(r.fav ? 'Ditambahkan ke wishlist' : 'Dihapus dari wishlist'); if (BY.prod && BY.prod.d) BY.prod.d.fav = r.fav; BY.wish = null; R(); } catch (e) { toast(e.message); } }

/* ---- halaman toko ---- */
async function bOpenStore(sid) {
  BY.store = { id: sid, d: null, tab: 'prod', q: '' }; buyerGo('store');
  try { BY.store.d = await bApi('/api/b/shop?s=' + encodeURIComponent(sid) + bLL()); BY.store.followed = BY.store.d.followed; if (!BY.stores.some((s) => s.id == sid)) BY.stores.push({ ...BY.store.d.shop }); } catch (e) { toast(e.message); }
  if (BY.pg == 'store') R();
}
function bStore() {
  const d = BY.store && BY.store.d; if (!d) return '<p class="mu">Memuat toko…</p>'; const s = d.shop, q = BY.store.q.toLowerCase(), items = d.items.filter((x) => !q || x.n.toLowerCase().includes(q));
  return `<div class="bsh"><em class="sav big">${esc((s.name || '?')[0])}</em><div style="flex:1"><h2>${esc(s.name)}</h2><small>${s.rt ? '★ ' + s.rt + ' (' + s.rc + ') · ' : ''}${s.followers} pengikut${s.dist != null ? ' · ' + distStr(s.dist) : ''}</small><br><small>${esc(s.addr || '')}</small></div></div>
<div class="fm2"><button class="pr" style="${BY.store.followed ? 'background:#6d7588' : ''}" onclick="bFollow('${esc(s.id)}')">${BY.store.followed ? '✓ Mengikuti' : '+ Follow'}</button><button class="gh big ol" onclick="bChat('${esc(s.id)}','${esc(s.name).replace(/'/g, '')}')">💬 Chat penjual</button></div>
<div class="tags">${s.cod ? '<i>COD</i>' : ''}${s.credit ? '<i>Kredit</i>' : ''}${String(s.ships || '').split(',').filter(Boolean).map((k) => `<i>${esc((BMETHODS[k] || [k])[0])}</i>`).join('')}${s.minorder ? `<i>Min ${shortRp(s.minorder)}</i>` : ''}</div>${s.descr ? `<small class="mu">${esc(s.descr)}</small>` : ''}
${d.vouchers.length ? `<div class="hs">${d.vouchers.map((v) => `<div class="vch"><b>${v.typ == 'pct' ? v.val + '%' : shortRp(v.val)}</b><small>${v.min ? 'min ' + shortRp(v.min) : 'semua'}</small><code>${esc(v.code)}</code></div>`).join('')}</div>` : ''}
<div class="tabs2">${[['prod', 'Produk'], ['post', 'Feed']].map((t) => `<button class="${BY.store.tab == t[0] ? 'a' : ''}" onclick="BY.store.tab='${t[0]}';R()">${t[1]}</button>`).join('')}</div>
${BY.store.tab == 'prod' ? `<input placeholder="Cari di toko ini" value="${esc(BY.store.q)}" onchange="BY.store.q=this.value;R()"><div class="bgrid">${items.map(pcardB).join('') || '<p class="mu">Belum ada produk.</p>'}</div>` : d.posts.map((p) => `<div class="cd">${p.img ? `<img src="${esc(p.img)}" style="width:100%;border-radius:12px">` : ''}<p>${esc(p.txt)}</p><small class="mu">❤️ ${p.likes} · ${dstr(p.t)}</small>${p.pid ? `<button class="gh a" onclick="bProd('${esc(s.id)}','${esc(p.pid)}')">Lihat produk</button>` : ''}</div>`).join('') || '<p class="mu">Belum ada postingan.</p>'}`;
}
/* ---- feed ---- */
async function bLoadFeed() { BY.feedT = 1; try { BY.feed = (await bApi('/api/b/feed')).posts; } catch (e) { toast(e.message); } if (BY.pg == 'feed') R(); }
function bFeed() {
  if (!BY.feed.length) return `<div class="cd"><p class="mu">${BY.feedT ? 'Belum ada postingan dari toko.' : 'Memuat…'}</p></div>`;
  return `<div class="feed">${BY.feed.map((p) => `<div class="fcard" style="${p.img ? `background-image:url('${esc(p.img)}')` : ''}"><div class="fov"><button class="fst" onclick="bOpenStore('${esc(p.sid)}')"><em class="sav">${esc((p.sn || '?')[0])}</em><b>${esc(p.sn)}</b></button><p>${esc(p.txt || '')}</p>${p.pid && p.pn ? `<button class="fprod" onclick="bProd('${esc(p.sid)}','${esc(p.pid)}')">🛍️ ${esc(p.pn)} · <b>${rp(p.price)}</b> ›</button>` : ''}</div><div class="fside"><button onclick="bLike(${p.id})">${p.liked ? '❤️' : '🤍'}<small>${p.likes}</small></button><button onclick="bChat('${esc(p.sid)}','${esc(p.sn).replace(/'/g, '')}')">💬<small>Chat</small></button><button onclick="shareText('${esc(p.sn).replace(/'/g, '')}','${esc((p.txt || '').slice(0, 80)).replace(/'/g, '')} — J-POS Belanja')">↗<small>Bagi</small></button></div></div>`).join('')}</div>`;
}
async function bLike(id) { if (!BY.tk) return bLogin(() => bLike(id)); try { const r = await bPost('/api/b/like', { post: id }), p = BY.feed.find((x) => x.id == id); if (p) { p.liked = r.liked; p.likes += r.liked ? 1 : -1; } R(); } catch (e) { toast(e.message); } }

/* ---- keranjang (banyak toko) ---- */
function bCart() {
  const S2 = Object.entries(BY.carts).filter(([, c]) => Object.keys(c.items).length);
  if (!S2.length) return `<div class="cd c"><div style="font-size:60px">🛒</div><h3>Wah, keranjang belanjamu kosong</h3><p class="mu">Yuk, isi dengan barang-barang kebutuhan tokomu!</p><button class="pr" onclick="buyerGo('home')">Mulai belanja</button></div>${BY.recent.length ? `<div class="bsec"><b>Terakhir dilihat</b></div><div class="bgrid">${BY.recent.slice(0, 6).map(pcardB).join('')}</div>` : ''}`;
  let tot = 0, n = 0;
  const html = S2.map(([sid, c]) => { const allSel = Object.values(c.items).every((i) => i.sel !== false); return `<div class="cd cs"><label class="row" style="margin:0;justify-content:flex-start;gap:10px"><input type="checkbox" ${allSel ? 'checked' : ''} onchange="bSelStore('${esc(sid)}',this.checked)"><b>🏪 ${esc(c.sn)}</b></label>${Object.entries(c.items).map(([pid, i]) => { if (i.sel !== false) { tot += (i.offer || i.price) * i.q; n += i.q; } return `<div class="cit"><input type="checkbox" ${i.sel !== false ? 'checked' : ''} onchange="bSel('${esc(sid)}','${esc(pid)}',this.checked)"><em class="bimg xs" style="background:${COL[(i.c || i.n).length % COL.length]}"><span>${catIcon(i.c)}</span></em><div style="flex:1;min-width:0"><div class="t1">${esc(i.n)}</div><b>${rp(i.price)}</b>${i.offer ? `<small class="or"> · tawar ${rp(i.offer)}</small>` : ''}<div class="qt" style="margin-top:6px"><button onclick="bQty('${esc(sid)}','${esc(pid)}',-9999)">🗑</button><span class="sp"></span><button onclick="bQty('${esc(sid)}','${esc(pid)}',-1)">−</button><b>${i.q}</b><button onclick="bQty('${esc(sid)}','${esc(pid)}',1)">+</button></div></div></div>`; }).join('')}</div>`; }).join('');
  return html + `<div class="bbuy cartbar2"><span><small class="mu">Total</small><br><b class="lg2">${rp(tot)}</b></span><button class="pr" ${n ? '' : 'disabled'} onclick="bGoCheckout()">Beli (${n})</button></div>`;
}
function bSel(sid, pid, v) { BY.carts[sid].items[pid].sel = v; bSave(); R(); }
function bSelStore(sid, v) { Object.values(BY.carts[sid].items).forEach((i) => (i.sel = v)); bSave(); R(); }
function bQty(sid, pid, d) { const c = BY.carts[sid], i = c.items[pid]; i.q = Math.min(i.st || 9999, i.q + d); if (i.q <= 0) delete c.items[pid]; if (!Object.keys(c.items).length) delete BY.carts[sid]; bSave(); R(); }
function bGoCheckout() { if (!BY.tk) return bLogin(bGoCheckout); BY.co = {}; buyerGo('co'); }

/* ---- checkout: satu pesanan per toko ---- */
function coGroups() { return Object.entries(BY.carts).map(([sid, c]) => ({ sid, sn: c.sn, items: Object.entries(c.items).filter(([, i]) => i.sel !== false) })).filter((g) => g.items.length); }
function coState(sid) { const s = BY.stores.find((x) => x.id == sid) || {}, ships = String(s.ships || 'ambil').split(',').filter((k) => BMETHODS[k]); const st = (BY.co[sid] = BY.co[sid] || { m: ships.includes('kurir') ? 'kurir' : ships[0] || 'ambil', vc: '', vd: 0, q: null, note: '' }); if (!ships.includes(st.m)) st.m = ships[0] || 'ambil'; return { st, s, ships }; }
function bCheckoutPage() {
  const G = coGroups(); if (!G.length) return '<p class="mu">Tidak ada barang dipilih.</p>';
  const a = curAddr(), pay = BY.coPay || 'transfer', allCod = G.every((g) => coState(g.sid).s.cod), allCr = G.every((g) => coState(g.sid).s.credit);
  let total = 0, ship = 0, vd = 0;
  const groups = G.map((g) => {
    const { st, s, ships } = coState(g.sid), sub = g.items.reduce((x, [, i]) => x + i.price * i.q, 0), kind = BMETHODS[st.m][1], fee = kind == 'instant' ? (st.q && st.q.fee) || 0 : 0;
    total += sub; ship += fee; vd += st.vd;
    return `<div class="cd"><b>🏪 ${esc(g.sn)}</b>${g.items.map(([, i]) => `<div class="row"><span>${esc(i.n)} <small class="mu">× ${i.q}</small>${i.offer ? `<br><small class="or">ditawar ${rp(i.offer)}</small>` : ''}</span><b>${rp(i.price * i.q)}</b></div>`).join('')}
<label><small class="mu">Pengiriman</small><select onchange="BY.co['${esc(g.sid)}'].m=this.value;R()">${ships.map((k) => `<option value="${k}" ${st.m == k ? 'selected' : ''}>${esc(BMETHODS[k][0])} — ${BMETHODS[k][1] == 'instant' ? (st.q && st.q.fee != null ? rp(st.q.fee) : st.q && st.q.dist ? 'terlalu jauh' : 'butuh lokasi') : BMETHODS[k][1] == 'exp' ? 'ongkir dari penjual' : 'gratis'}</option>`).join('')}</select></label>
<div class="srch"><input placeholder="Kode kupon toko" value="${esc(st.vc)}" id="v_${esc(g.sid)}" style="text-transform:uppercase"><button class="gh" onclick="bVoucher('${esc(g.sid)}',${sub})">Pakai</button></div>${st.vd ? `<small class="gr">✔ Kupon ${esc(st.vc)} hemat ${rp(st.vd)}</small>` : ''}
<input placeholder="Pesan untuk penjual (opsional)" value="${esc(st.note)}" onchange="BY.co['${esc(g.sid)}'].note=this.value">${s.minorder && sub < s.minorder ? `<small class="rd">Minimal belanja di toko ini ${rp(s.minorder)}</small>` : ''}</div>`;
  }).join('');
  return `<div class="cd"><div class="row" style="margin:0"><b>📍 Alamat pengiriman</b><a onclick="BY.coBack='co';buyerGo('addr')">Ganti</a></div>${a ? `<div style="margin-top:6px"><b>${esc(a.label)}</b> · ${esc(a.name || BY.me.name)} ${a.phone ? '(' + esc(a.phone) + ')' : ''}<br><small class="mu">${esc(a.addr)}${a.lat != null ? ' · 📍 titik tersimpan' : ''}</small></div>` : `<p class="mu">Belum ada alamat.</p><button class="gh a" onclick="BY.coBack='co';buyerGo('addr')">+ Tambah alamat</button>`}</div>
${groups}
<div class="cd"><b>Metode pembayaran</b>${[['transfer', '🏦 Transfer bank', 1], ['cod', '💵 Bayar di tempat (COD)', allCod], ['kredit', '🤝 Kredit / tempo (perlu ACC penjual)', allCr]].map((p) => `<label class="row ${p[2] ? '' : 'dis'}"><span>${p[1]}${p[2] ? '' : ' <small class="mu">— tidak tersedia di semua toko</small>'}</span><input type="radio" name="bp" ${pay == p[0] ? 'checked' : ''} ${p[2] ? '' : 'disabled'} onchange="BY.coPay='${p[0]}';R()"></label>`).join('')}${pay == 'kredit' ? `<label><small class="mu">Tempo (hari)</small><input type="number" value="${BY.coDays || 14}" onchange="BY.coDays=num(this.value)"></label>` : ''}</div>
<div class="cd tt"><b>Ringkasan belanja</b>${row('Total harga (' + G.reduce((a2, g) => a2 + g.items.reduce((x, [, i]) => x + i.q, 0), 0) + ' barang)', rp(total))}${row('Total ongkos kirim', rp(ship))}${vd ? row('Kupon', '<span class="gr">−' + rp(vd) + '</span>') : ''}</div>
<div class="bbuy cartbar2"><span><small class="mu">Total tagihan</small><br><b class="lg2">${rp(total + ship - vd)}</b></span><button class="pr" onclick="bPlace()">${pay == 'kredit' ? 'Ajukan kredit' : 'Bayar / Pesan'}</button></div>`;
}
async function bQuoteAll() { const ll = curAddr() && curAddr().lat != null ? curAddr() : myLL(); if (!ll || !canNet()) return; let ch = false; for (const g of coGroups()) { const { st } = coState(g.sid); try { const q = await api('/api/b/quote', { method: 'POST', body: JSON.stringify({ store: g.sid, lat: ll.lat, lng: ll.lng }) }, ''); if (JSON.stringify(q) != JSON.stringify(st.q)) { st.q = q; ch = true; } } catch (e) { } } if (ch && BY.pg == 'co') R(); }
async function bVoucher(sid, sub) { const st = BY.co[sid], c = ($('#v_' + sid) || {}).value || ''; if (!c.trim()) { st.vc = ''; st.vd = 0; return R(); } try { const r = await bPost('/api/b/voucher', { store: sid, code: c, sub }); st.vc = r.code; st.vd = r.disc; toast('Kupon dipakai: hemat ' + rp(r.disc)); } catch (e) { st.vc = ''; st.vd = 0; toast(e.message); } R(); }
async function bPlace() {
  const a = curAddr(), ll = a && a.lat != null ? a : myLL(), pay = BY.coPay || 'transfer', G = coGroups(); let ok = 0;
  for (const g of G) {
    const { st } = coState(g.sid), kind = BMETHODS[st.m][1];
    if (kind != 'none' && (!ll || ll.lat == null)) return toast('Atur titik lokasi alamat pengiriman dulu');
    if (kind != 'none' && !(a && a.addr) && !(BY.me && BY.me.addr)) return toast('Tambah alamat pengiriman dulu');
  }
  for (const g of G) {
    const { st } = coState(g.sid);
    try {
      await bPost('/api/b/orders', { store: g.sid, items: g.items.map(([pid, i]) => ({ pid, q: i.q, offer: i.offer })), method: st.m, pay, days: BY.coDays || 14, addr: a ? a.label + ': ' + a.addr + (a.phone ? ' (' + a.phone + ')' : '') : (BY.me && BY.me.addr) || '', lat: ll && ll.lat, lng: ll && ll.lng, note: st.note, voucher: st.vc });
      g.items.forEach(([pid]) => delete BY.carts[g.sid].items[pid]); if (!Object.keys(BY.carts[g.sid].items).length) delete BY.carts[g.sid]; ok++;
    } catch (e) { if (e.status == 401) { BY.tk = ''; return bLogin(bPlace); } toast(g.sn + ': ' + e.message, 6000); }
  }
  bSave(); if (ok) { toast(ok + ' pesanan berhasil dibuat 🎉', 5000); BY.ordTab = 'all'; buyerGo('ord'); }
}

/* ---- alamat ---- */
function bAddrPage() {
  const L = addrs();
  return `${L.map((a, i) => `<div class="cd ${BY.addrI == i ? 'selc' : ''}"><div class="row" style="margin:0"><b>${esc(a.label)}${a.main ? ' <span class="chip">Utama</span>' : ''}</b><a onclick="bAddrEdit(${i})">Ubah</a></div><small>${esc(a.name || '')} ${a.phone ? '· ' + esc(a.phone) : ''}</small><br><small class="mu">${esc(a.addr)}${a.lat != null ? ' · 📍 titik lokasi' : ' · <span class="rd">belum ada titik</span>'}</small><button class="gh ${BY.addrI == i ? 'a' : ''}" style="width:100%;margin-top:8px" onclick="BY.addrI=${i};bBack()">${BY.addrI == i ? '✓ Dipilih' : 'Pilih alamat ini'}</button></div>`).join('')}<button class="pr" onclick="bAddrEdit(-1)">+ Tambah alamat baru</button>`;
}
function bAddrPick() { if (!BY.tk) return addrs().length ? null : bSetLoc(); BY.coBack = 'home'; buyerGo('addr'); }
function bAddrEdit(i) {
  const a = i >= 0 ? { ...addrs()[i] } : { label: addrs().length ? 'Toko' : 'Rumah', name: BY.me.name, phone: BY.me.phone, addr: BY.me.addr || '', lat: null, lng: null, main: !addrs().length };
  const m = modal(`<h3>${i >= 0 ? 'Ubah' : 'Tambah'} alamat</h3><input id="al" placeholder="Label (Rumah / Toko / Gudang)" value="${esc(a.label)}"><input id="an" placeholder="Nama penerima" value="${esc(a.name || '')}"><input id="ap" type="tel" placeholder="No. HP penerima" value="${esc(a.phone || '')}"><textarea id="aa" rows="3" placeholder="Alamat lengkap (jalan, nomor, RT/RW, kelurahan, patokan)">${esc(a.addr || '')}</textarea><button class="gh" id="ag">📍 ${a.lat != null ? 'Perbarui' : 'Ambil'} titik lokasi GPS</button><small id="as" class="mu">${a.lat != null ? 'Titik: ' + a.lat.toFixed(5) + ', ' + a.lng.toFixed(5) : 'Titik lokasi dipakai untuk menghitung ongkir'}</small><label class="row"><span>Jadikan alamat utama</span><input type="checkbox" id="am" ${a.main ? 'checked' : ''}></label><button class="pr" id="ok">Simpan</button>${i >= 0 ? '<button class="gh d" id="del">Hapus alamat</button>' : ''}`);
  $('#ag', m).onclick = async () => { const p = await getPos(); if (!p) return toast('Lokasi tidak tersedia'); a.lat = p.lat; a.lng = p.lng; $('#as', m).textContent = 'Titik: ' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); };
  const saveL = async (L) => { try { const r = await bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ addrs: L }) }); BY.me = { ...BY.me, ...r.me }; LS.set('jpos:bme', BY.me); m.close(); if (i < 0 && BY.pg == 'addr' && BY.coBack == 'co') bBack(); else R(); } catch (e) { toast(e.message); } };
  $('#ok', m).onclick = () => { Object.assign(a, { label: $('#al', m).value.trim() || 'Alamat', name: $('#an', m).value.trim(), phone: $('#ap', m).value.trim(), addr: $('#aa', m).value.trim(), main: $('#am', m).checked }); if (!a.addr) return toast('Isi alamat lengkap'); let L = [...addrs()]; if (a.main) L = L.map((x) => ({ ...x, main: false })); if (i >= 0) L[i] = a; else { L.push(a); BY.addrI = L.length - 1; } saveL(L); };
  const d = $('#del', m); if (d) d.onclick = () => { const L = addrs().filter((_, k) => k != i); BY.addrI = 0; saveL(L); };
}

/* ---- transaksi ---- */
async function bLoadOrders() {
  if (!BY.tk || !canNet()) return;
  try {
    const r = await bApi('/api/b/orders'), ch = JSON.stringify(r.orders.map((o) => [o.id, o.status, o.paid, o.upd])) != JSON.stringify(BY.orders.map((o) => [o.id, o.status, o.paid, o.upd]));
    r.orders.forEach((o) => { const old = BY.ordSt[o.id]; if (old && old != o.status) toast('Pesanan #' + o.id + ': ' + (BST[o.status] || [o.status])[0], 5000); BY.ordSt[o.id] = o.status; });
    BY.orders = r.orders; if (r.orders.some((o) => o.status == 'selesai')) bApi('/api/b/reviewed').then((x) => { BY.reviewed = x.ids; }).catch(() => { });
    if (ch && MODE == 'buyer' && ['ord', 'od'].includes(BY.pg) && !$('.md')) R();
  } catch (e) { if (e.status == 401) BY.tk = ''; }
}
setInterval(() => { if (MODE == 'buyer' && BY.tk) bLoadOrders(); }, 25000);
const OTAB = { all: () => 1, wait: (o) => ['nego', 'nego_toko', 'acc_kredit', 'baru'].includes(o.status), proc: (o) => o.status == 'diproses', ship: (o) => o.status == 'dikirim', done: (o) => o.status == 'selesai', x: (o) => ['batal', 'ditolak'].includes(o.status) };
function bOrders() {
  if (!BY.tk) return `<div class="cd c"><div style="font-size:50px">🧾</div><h3>Masuk untuk melihat transaksi</h3><button class="pr" onclick="bLogin(()=>buyerGo('ord'))">Masuk / Daftar</button></div>`;
  const L = BY.orders.filter(OTAB[BY.ordTab]);
  return `<div class="bchips">${[['all', 'Semua'], ['wait', 'Menunggu'], ['proc', 'Diproses'], ['ship', 'Dikirim'], ['done', 'Selesai'], ['x', 'Dibatalkan']].map((x) => `<button class="${BY.ordTab == x[0] ? 'a' : ''}" onclick="BY.ordTab='${x[0]}';R()">${x[1]}${x[0] != 'all' && BY.orders.filter(OTAB[x[0]]).length ? ' (' + BY.orders.filter(OTAB[x[0]]).length + ')' : ''}</button>`).join('')}</div>
${L.map((o) => { const st = BST[o.status] || [o.status, '']; return `<div class="cd oc" onclick="BY.od=${o.id};buyerGo('od')"><div class="row" style="margin:0"><small><b>🛍️ Belanja</b> · ${dstr(o.t)}</small><span class="chip ${st[1]}">${st[0]}</span></div><div class="row" style="justify-content:flex-start;gap:10px"><em class="bimg xs" style="background:${COL[o.sn.length % COL.length]}"><span>🏪</span></em><span><b>${esc(o.sn)}</b><br><small class="mu">${esc(o.items[0].n)}${o.items.length > 1 ? ' +' + (o.items.length - 1) + ' produk lainnya' : ''}</small></span></div><div class="row"><span><small class="mu">Total belanja</small><br><b>${rp(o.tot)}</b></span>${o.status == 'selesai' ? `<button class="gh a" onclick="event.stopPropagation();bReorder(${o.id})">Beli lagi</button>` : o.status == 'nego_toko' ? '<span class="chip o">Perlu persetujuan</span>' : o.status == 'dikirim' ? '<span class="chip g">Konfirmasi terima</span>' : ''}</div></div>`; }).join('') || '<div class="cd c"><p class="mu">Belum ada transaksi di sini.</p></div>'}`;
}
function bOrderDetail() {
  const o = BY.orders.find((x) => x.id == BY.od); if (!o) return '<p class="mu">Memuat…</p>';
  const steps = [['Dibuat', 1], ['Dikonfirmasi', ['diproses', 'dikirim', 'selesai'].includes(o.status)], ['Dikirim', ['dikirim', 'selesai'].includes(o.status)], ['Selesai', o.status == 'selesai']], x = ['batal', 'ditolak'].includes(o.status), st = BST[o.status] || [o.status, ''], b = [];
  if (o.status == 'nego_toko') b.push(`<button class="pr" onclick="bAct(${o.id},'accept_counter')">✔ Setuju harga penjual</button>`);
  if (o.status == 'dikirim') b.push(`<button class="pr" onclick="bAct(${o.id},'received')">📦 Pesanan diterima</button>`);
  if (o.status == 'selesai' && !BY.reviewed.includes(o.id)) b.push(`<button class="pr" onclick="bReview(${o.id})">⭐ Beri ulasan</button>`);
  if (o.status == 'selesai') b.push(`<button class="gh big ol" onclick="bReorder(${o.id})">🔁 Beli lagi</button>`);
  if (!o.paid && o.pay == 'transfer' && ['baru', 'diproses', 'dikirim', 'selesai'].includes(o.status)) b.push(`<button class="gh big ol" onclick="bAct(${o.id},'paid_claim',{note:prompt('Catatan transfer (bank/nama pengirim):')||''})">Saya sudah transfer</button>`);
  b.push(`<button class="gh big ol" onclick="bChat('${esc(o.store_id)}','${esc(o.sn).replace(/'/g, '')}')">💬 Chat penjual</button>`);
  if (['nego', 'nego_toko', 'baru', 'acc_kredit'].includes(o.status)) b.push(`<button class="gh d big" onclick="if(confirm('Batalkan pesanan?'))bAct(${o.id},'cancel')">Batalkan pesanan</button>`);
  return `<div class="cd"><span class="chip ${st[1]}" style="font-size:13px">${st[0]}</span>${x ? '' : `<div class="stepper">${steps.map((s, i) => `<div class="${s[1] ? 'on' : ''}"><i>${s[1] ? '✓' : i + 1}</i><small>${s[0]}</small></div>`).join('')}</div>`}<small class="mu">No. #${o.id} · ${tstr(o.t)}</small></div>
${o.status == 'nego_toko' ? `<div class="cd warn"><b>Penjual memberi harga baru</b>${o.items.map((i) => row(esc(i.n), (i.offer ? '<s class="mu">' + rp(i.offer) + '</s> ' : '') + '<b>' + rp(i.counter || i.price) + '</b>')).join('')}</div>` : ''}
<div class="cd"><b>🏪 ${esc(o.sn)}</b>${o.items.map((i) => `<div class="row"><span>${esc(i.n)}<br><small class="mu">${i.q} × ${rp(i.price)}${i.offer ? ' · tawaran ' + rp(i.offer) : ''}</small></span><b>${rp(i.price * i.q)}</b></div>`).join('')}</div>
<div class="cd"><b>Info pengiriman</b>${row('Kurir', esc((BMETHODS[o.method] || [o.method])[0]))}${o.resi ? row('No. resi', `<b>${esc(o.resi)}</b> <a target="_blank" href="${trackUrl(o.courier, o.resi)}">Lacak</a>`) : ''}<small class="mu">Alamat: ${esc(o.addr || '-')}</small></div>
<div class="cd"><b>Rincian pembayaran</b>${row('Metode', o.pay == 'kredit' ? 'Kredit ' + o.days + ' hari' : o.pay == 'cod' ? 'COD' : 'Transfer')}${row('Total harga', rp(o.sub))}${row('Ongkos kirim', o.ship ? rp(o.ship) : BMETHODS[o.method] && BMETHODS[o.method][1] == 'exp' ? 'menunggu penjual' : rp(0))}${o.disc ? row('Kupon ' + esc(o.vcode || ''), '−' + rp(o.disc)) : ''}${row('<b>Total belanja</b>', '<b>' + rp(o.tot) + '</b>')}${row('Status bayar', o.paid ? '<b class="gr">LUNAS</b>' : '<b class="or">Belum lunas</b>')}${o.due ? row('Jatuh tempo', dstr(o.due)) : ''}${o.pay == 'transfer' && !o.paid && o.bank ? `<div class="cd info" style="padding:10px;margin-top:6px"><small>Transfer ke:</small><br><b>${esc(o.bank)}</b></div>` : ''}</div>
<div class="cd"><b>Riwayat</b><div class="tl">${o.hist.slice().reverse().map((h) => `<div><small class="mu">${tstr(h.t)}</small><div>${esc(h.txt)}</div></div>`).join('')}</div></div>
<div class="fm">${b.join('')}</div>`;
}
async function bAct(id, act, extra) { try { await bPost('/api/b/orders/' + id + '/act', { act, ...(extra || {}) }); toast('Tersimpan'); await bLoadOrders(); R(); } catch (e) { toast(e.message); } }
function bReview(id) {
  let st = 5; const m = modal(`<h3>Ulasan pesanan #${id}</h3><div class="stars">${[1, 2, 3, 4, 5].map((i) => `<button data-s="${i}">★</button>`).join('')}</div><textarea id="rt" rows="3" placeholder="Ceritakan kualitas barang & pelayanan penjual"></textarea><button class="pr" id="ok">Kirim ulasan</button>`);
  const draw = () => $$('[data-s]', m).forEach((b) => (b.style.color = +b.dataset.s <= st ? '#ffc400' : '#d6d6d6')); draw();
  $$('[data-s]', m).forEach((b) => (b.onclick = () => { st = +b.dataset.s; draw(); }));
  $('#ok', m).onclick = async () => { try { await bPost('/api/b/review', { order: id, stars: st, txt: $('#rt', m).value }); BY.reviewed.push(id); m.close(); toast('Terima kasih atas ulasannya!'); R(); } catch (e) { toast(e.message); } };
}
function bReorder(id) { const o = BY.orders.find((x) => x.id == id); if (!o) return; const c = (BY.carts[o.store_id] = BY.carts[o.store_id] || { sn: o.sn, items: {} }); o.items.forEach((i) => (c.items[i.pid] = { q: i.q, offer: 0, n: i.n, price: i.price, unit: i.unit || '', st: 9999, sel: true })); bSave(); buyerGo('cart'); toast('Dimasukkan ke keranjang — harga dicek ulang saat pesan'); }

/* ---- chat ---- */
async function bLoadChats() { const el = $('#bchats'); if (!el || !BY.tk) return; try { const r = await bApi('/api/b/chats'); el.innerHTML = r.rooms.map((x) => `<button class="us2" onclick="bChat('${esc(x.store)}','${esc(x.name).replace(/'/g, '')}')"><em>🏪</em><span>${esc(x.name)}</span><span class="sp"></span>›</button>`).join('') || '<p class="mu">Belum ada chat.</p>'; } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; } }
function bChats() { return BY.tk ? `<div class="cd"><div id="bchats"><p class="mu">Memuat…</p></div></div>` : `<div class="cd c"><p class="mu">Masuk untuk chat dengan penjual.</p><button class="pr" onclick="bLogin(()=>buyerGo('chat'))">Masuk / Daftar</button></div>`; }
function bChat(sid, name) {
  if (!BY.tk) return bLogin(() => bChat(sid, name));
  let last = 0, timer; const myId = 'b' + (BY.me && BY.me.id);
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">💬 ${esc(name)}</h3><button class="gh" id="cx">✕</button></div><div class="chat" id="cm" style="height:50vh"></div><div class="cin"><input id="ci" placeholder="Tanya stok, harga, pengiriman…" maxlength="500"><button id="cs">Kirim</button></div>`, 'w');
  const load = async () => { try { const r = await bApi('/api/b/chat?store=' + sid + '&since=' + last), el = $('#cm', m); if (!el) return clearInterval(timer); r.m.forEach((x) => { last = Math.max(last, x.seq); el.insertAdjacentHTML('beforeend', `<div class="bub ${x.sid == myId ? 'me' : ''}"><small>${x.sid == myId ? 'Saya' : esc(x.un) + ' · ' + esc(name)} · ${hm(x.t)}</small>${esc(x.tx)}</div>`); }); if (r.m.length) el.scrollTop = el.scrollHeight; } catch (e) { } };
  const send = async () => { const i = $('#ci', m), tx = i.value.trim(); if (!tx) return; i.value = ''; try { await bPost('/api/b/chat', { store: sid, text: tx }); load(); } catch (e) { toast(e.message); i.value = tx; } };
  $('#cs', m).onclick = send; $('#ci', m).onkeydown = (e) => { if (e.key == 'Enter') send(); }; $('#cx', m).onclick = () => m.close();
  m.onclose = () => clearInterval(timer); load(); timer = setInterval(load, 4000);
}

/* ---- wishlist ---- */
function bWish() {
  if (!BY.tk) return `<div class="cd c"><div style="font-size:50px">❤️</div><h3>Simpan barang favoritmu</h3><button class="pr" onclick="bLogin(()=>buyerGo('wish'))">Masuk / Daftar</button></div>`;
  const w = BY.wish; if (!w) return '<p class="mu">Memuat…</p>';
  return `<div class="cd"><b>Toko yang kamu follow</b><div class="hs" style="margin-top:6px">${w.stores.map((s) => `<button class="stc" onclick="bOpenStore('${esc(s.id)}')"><em>${esc(s.name[0])}</em><b>${esc(s.name)}</b></button>`).join('') || '<small class="mu">Belum ada</small>'}</div></div><div class="bsec"><b>Wishlist (${w.items.length})</b></div><div class="bgrid">${w.items.map(pcardB).join('') || '<p class="mu">Belum ada barang di wishlist.</p>'}</div>`;
}
async function bFavs() { try { BY.wish = await bApi('/api/b/favs'); } catch (e) { BY.wish = { items: [], stores: [] }; toast(e.message); } if (BY.pg == 'wish') R(); }

/* ---- akun ---- */
function bAcc() {
  if (!BY.tk) return `<div class="bacc"><div class="bavb">👤</div><h3>Masuk ke J-POS Belanja</h3><p class="mu">Belanja dari semua toko, tawar harga, chat penjual, dan ajukan kredit.</p><button class="pr" onclick="bLogin(()=>buyerGo('acc'))">Masuk / Daftar</button><button class="gh big" onclick="bExit()">← Ke layar awal</button></div>`;
  return `<div class="bacc"><div class="row" style="justify-content:flex-start;gap:12px"><div class="bavb">${esc(BY.me.name[0].toUpperCase())}</div><span><b style="font-size:17px">${esc(BY.me.name)}</b><br><small>${esc(BY.me.phone || '')}</small></span></div></div>
<div class="bqk">${[['🧾', 'Transaksi', "buyerGo('ord')"], ['❤️', 'Wishlist', "buyerGo('wish')"], ['💬', 'Chat', "buyerGo('chat')"], ['📍', 'Alamat', "BY.coBack='acc';buyerGo('addr')"], ['🛒', 'Keranjang', "buyerGo('cart')"]].map((x) => `<button onclick="${x[2]}"><i>${x[0]}</i><small>${x[1]}</small></button>`).join('')}</div>
<div class="cd" id="bcred"><h3>Kelayakan kredit</h3><p class="mu">Memuat…</p></div>
<div class="bmenu">${[['✏️', 'Ubah nama', 'bName()'], ['🔑', 'Ganti PIN', 'bPin()'], ['📍', 'Perbarui lokasi GPS', 'bSetLoc()'], ['🚪', 'Keluar akun', 'bLogout()'], ['🏠', 'Kembali ke layar awal J-POS', 'bExit()']].map((x) => `<button onclick="${x[2]}"><i>${x[0]}</i><span>${x[1]}</span><b>›</b></button>`).join('')}</div>`;
}
async function bLoadMe() {
  const el = $('#bcred'); if (!el) return;
  try {
    const r = await bApi('/api/b/me'), c = r.credit, col = { A: 'var(--gr)', B: 'var(--bl)', C: 'var(--or)', D: 'var(--rd)' }[c.grade]; BY.me = { ...BY.me, ...r.me }; LS.set('jpos:bme', BY.me);
    el.innerHTML = `<h3>Kelayakan kredit</h3><div class="row"><b style="font-size:30px;color:${col}">${c.score}<small class="mu" style="font-size:13px">/100</small></b><span class="chip" style="color:${col}">Nilai ${c.grade} · ${esc(c.label)}</span></div><div style="height:9px;border-radius:9px;background:var(--bd);overflow:hidden"><div style="width:${c.score}%;height:100%;background:${col}"></div></div><small class="mu">${c.why.map(esc).join(' · ')}</small>${r.lim.map((l) => row(esc(l.name), 'limit ' + rp(l.lim) + ' · ' + l.days + ' hr')).join('')}`;
  } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; }
}
function bName() { const n = prompt('Nama:', BY.me.name); if (!n) return; bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ name: n }) }).then((r) => { BY.me = { ...BY.me, ...r.me }; LS.set('jpos:bme', BY.me); R(); }).catch((e) => toast(e.message)); }
function bPin() { const o = prompt('PIN lama:'); if (o == null) return; const n = prompt('PIN baru (4–8 angka):'); if (!n) return; bApi('/api/b/me', { method: 'PUT', body: JSON.stringify({ old: o, pin: n }) }).then(() => toast('PIN diganti')).catch((e) => toast(e.message)); }
function bLogout() { BY.tk = ''; BY.me = null; BY.orders = []; BY.wish = null; LS.del('jpos:bt'); LS.del('jpos:bme'); R(); }
function bLogin(then) {
  let reg = false;
  const m = modal(`<div class="c"><div style="font-size:44px">🛍️</div><h3 id="lt">Masuk ke J-POS Belanja</h3></div><input id="lp" type="tel" inputmode="tel" placeholder="Nomor HP (08…)"><input id="ln" placeholder="Nama lengkap / nama toko" style="display:none"><input id="lpin" type="password" inputmode="numeric" maxlength="8" placeholder="PIN 4–8 angka"><button class="pr" id="ok">Masuk</button><button class="gh" id="sw">Belum punya akun? Daftar gratis</button>`);
  $('#sw', m).onclick = () => { reg = !reg; $('#ln', m).style.display = reg ? '' : 'none'; $('#lt', m).textContent = reg ? 'Daftar akun pembeli' : 'Masuk ke J-POS Belanja'; $('#ok', m).textContent = reg ? 'Daftar' : 'Masuk'; $('#sw', m).textContent = reg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar gratis'; };
  $('#ok', m).onclick = async () => {
    const ll = LS.get('jpos:bll', null);
    try {
      const r = reg ? await api('/api/b/register', { method: 'POST', body: JSON.stringify({ phone: $('#lp', m).value, name: $('#ln', m).value, pin: $('#lpin', m).value, lat: ll && ll.lat, lng: ll && ll.lng }) }, '') : await api('/api/b/login', { method: 'POST', body: JSON.stringify({ phone: $('#lp', m).value, pin: $('#lpin', m).value }) }, '');
      BY.tk = r.token; BY.me = r.me; LS.set('jpos:bt', BY.tk); LS.set('jpos:bme', BY.me); m.close(); toast('Selamat datang, ' + r.me.name); hb('b:login'); bLoadOrders(); bApi('/api/b/me').then((x) => { BY.me = { ...BY.me, ...x.me }; LS.set('jpos:bme', BY.me); }).catch(() => { }); if (then) then(); else R();
    } catch (e) { toast(e.message, 5000); }
  };
}
function startBuyer() { MODE = 'buyer'; BY.pg = 'home'; R(); hb('b:home'); if (!myLL()) bSetLoc(); if (BY.tk) bLoadOrders(); }
