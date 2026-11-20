'use strict';
/* ============ PESANAN DARI MEJA (sisi toko): katalog otomatis untuk menu QR, pesanan pembeli, kirim ke kasir ============ */
const ONL = { orders: [], shop: null, methods: {}, tab: 'ord', f: 'act', t: null, seen: 0, cat: '' };
const OST = { nego: ['Menunggu', 'o'], nego_toko: ['Menunggu', ''], acc_kredit: ['Menunggu', 'o'], baru: ['Pesanan baru', 'o'], diproses: ['Diproses', ''], dikirim: ['Siap disajikan', 'g'], selesai: ['Selesai', 'g'], batal: ['Dibatalkan', 'r'], ditolak: ['Ditolak', 'r'] };
const PAYN = { cod: 'Bayar di tempat', transfer: 'Bayar di kasir', kredit: 'Kredit / tempo' };
const BMETHODS = { ambil: ['Ambil sendiri', 'none'], kurir: ['Kurir toko', 'instant'], gosend: ['GoSend', 'instant'], grab: ['GrabExpress', 'instant'], jnt: ['J&T Express', 'exp'], jne: ['JNE', 'exp'], sicepat: ['SiCepat', 'exp'] };
const MNAME = (k) => (BMETHODS[k] || [k])[0];
const needAct = (o) => ['nego', 'baru', 'acc_kredit'].includes(o.status);

// katalog: dikirim otomatis agar menu tampil saat pembeli scan QR meja (owner/admin/akuntan)
function publishCatalog(force) {
  if (!S || !S.srv || !U || !(U.r == 'owner' || U.r == 'admin') || !pkgHas('onl') || !canNet() || !TK() || isExp()) return;
  clearTimeout(ONL.pubT);
  ONL.pubT = setTimeout(async () => {
    if (!U || !(U.r == 'owner' || U.r == 'admin')) return;
    const items = S.p.filter((p) => !p.x && p.on !== false).map((p) => ({ id: p.id, n: p.n, c: p.c, pr: p.pr, opr: p.opr || 0, st: Math.max(0, p.st), img: p.img || '', sku: p.sku || '', u: p.u || '', kd: p.kd || '', b: p.b || '', t: (p.tiers || []).filter((t) => t.min > 1).map((t) => ({ min: t.min, d: t.d })) }));
    const key = 'jpos:cat2:' + SID, h = String(items.length) + ':' + (await sha(JSON.stringify(items))).slice(0, 16);
    if (!force && LS.get(key, '') == h) return;
    try { await post('/api/shop/catalog', { items, shop: { lat: S.set.glat, lng: S.set.glng, addr: S.set.addr || '' } }); LS.set(key, h); if (force) toast(items.length + ' menu tersedia untuk dipesan lewat QR meja'); } catch (e) { if (force) toast(e.message); }
  }, force ? 10 : 4000);
}
async function pollOrders(render) {
  if (!S || !S.srv || !U || !can('onl') || !canNet() || !TK()) return;
  try {
    const r = await api('/api/shop/orders'); ONL.orders = r.orders;
    const n = ONL.orders.filter(needAct).length;
    if (n > ONL.seen && ONL.seen >= 0 && V != 'onl') toast('🔔 ' + n + ' pesanan meja perlu tindakan', 4000);
    ONL.seen = n; onlBadge(); if (render && V == 'onl' && !$('.md')) R();
  } catch (e) { }
}
function onlBadge() { const n = ONL.orders.filter(needAct).length, el = $('#nb-onl') || (n ? $('#nb-menu') : null); if (el) { el.textContent = n; el.style.display = n ? 'grid' : 'none'; } }
setInterval(() => { if (U && S && S.srv) pollOrders(true); }, 30000);

VW.onl = () => {
  if (!S.srv) return `<div class="cd"><h3>Pesanan meja (QR)</h3><p class="mu">Fitur ini butuh toko yang terdaftar di server (bukan mode lokal/demo).</p></div>`;
  const tabs = `<div class="seg sc-tabs" style="margin-top:0">${[['ord', '📦 Pesanan'], ['set', '⚙️ Pengaturan']].map((t) => `<button class="${ONL.tab == t[0] ? 'a' : ''}" onclick="ONL.tab='${t[0]}';R()">${t[1]}${t[0] == 'ord' && ONL.orders.filter(needAct).length ? ' (' + ONL.orders.filter(needAct).length + ')' : ''}</button>`).join('')}</div>`;
  if (ONL.tab == 'set') return tabs + `<div id="onlset" class="cd"><p class="mu">Memuat pengaturan…</p></div>`;
  const F = { act: (o) => needAct(o) || ['nego_toko', 'diproses', 'dikirim'].includes(o.status) || (!o.paid && o.status == 'selesai'), run: (o) => ['nego_toko', 'diproses', 'dikirim'].includes(o.status), done: (o) => o.status == 'selesai', unpaid: (o) => !o.paid && !['batal', 'ditolak'].includes(o.status), x: (o) => ['batal', 'ditolak'].includes(o.status), all: () => 1 };
  const L = ONL.orders.filter(F[ONL.f]), cnt = (k) => ONL.orders.filter(F[k]).length;
  const omz = ONL.orders.filter((o) => o.status == 'selesai').reduce((a, o) => a + o.sub, 0);
  return tabs + kpi([['Perlu tindakan', ONL.orders.filter(needAct).length], ['Sedang berjalan', cnt('run')], ['Belum dibayar', rp(ONL.orders.filter(F.unpaid).reduce((a, o) => a + o.tot, 0))], ['Omzet pesanan meja', rp(omz)]])
    + `<div class="seg">${[['act', 'Aktif'], ['run', 'Berjalan'], ['unpaid', 'Belum bayar'], ['done', 'Selesai'], ['x', 'Batal'], ['all', 'Semua']].map((x) => `<button class="${ONL.f == x[0] ? 'a' : ''}" onclick="ONL.f='${x[0]}';R()">${x[1]} (${cnt(x[0])})</button>`).join('')}</div>`
    + (L.map(ordCard).join('') || `<div class="cd"><p class="mu">Belum ada pesanan di sini. Pastikan fitur pesan dari meja <b>diaktifkan</b> di tab Pengaturan.</p></div>`)
    + `<div class="wrap"><button class="gh" onclick="pollOrders(true)">⟳ Muat ulang</button><button class="gh" onclick="publishCatalog(true)">⬆ Perbarui menu sekarang</button></div>`;
};
VW.onl.after = () => {
  if (!S.srv) return;
  if (ONL.tab == 'set') onlSettings();
  else if (!ONL.loaded) { ONL.loaded = 1; pollOrders(true); }
};
function ordCard(o) {
  const st = OST[o.status] || [o.status, ''], items = o.items.map((i) => `<div class="row" style="margin:2px 0"><span>${esc(i.n)} <small class="mu">× ${i.q}${i.unit ? ' ' + esc(i.unit) : ''}</small></span><b>${rp(i.price * i.q)}</b></div>`).join('');
  const b = [];
  if (o.status == 'baru') b.push(`<button class="gh a" onclick="oAccept(${o.id})">Terima & proses</button>`);
  if (o.status == 'diproses') b.push(`<button class="gh a" onclick="oShip(${o.id})">Siap disajikan/diambil</button>`);
  if (['diproses', 'dikirim'].includes(o.status)) b.push(`<button class="gh" onclick="oAct(${o.id},'done')">Selesai</button>`);
  if (['diproses', 'dikirim', 'selesai'].includes(o.status) && !o.sale_no) b.push(`<button class="gh" onclick="oSale(${o.id})">Catat ke kasir</button>`);
  if (!o.paid && !['batal', 'ditolak'].includes(o.status)) b.push(`<button class="gh" onclick="oPaid(${o.id})">✔ Tandai lunas</button>`);
  if (!['selesai', 'batal', 'ditolak'].includes(o.status)) b.push(`<button class="gh d" onclick="oReject(${o.id})">Tolak</button>`);
  return `<div class="cd"><div class="row" style="margin:0"><span><b>#${o.id} · ${esc(o.bn)}</b><br><small class="mu">${tstr(o.t)}</small></span><span class="chip ${st[1]}">${st[0]}</span></div>
<div style="margin:8px 0">${items}</div>${row('<b>Total</b>', rp(o.tot))}
<small class="mu">Bayar: <b>${esc(PAYN[o.pay] || o.pay)}</b> · ${o.paid ? '<b class="gr">LUNAS</b>' : '<b class="rd">belum dibayar</b>'}${o.sale_no ? ' · tercatat di kasir ' + esc(o.sale_no) : ''}${o.note ? '<br>Catatan: ' + esc(o.note) : ''}</small>
<details><summary class="mu" style="font-size:12px">Riwayat</summary>${o.hist.map((h) => `<small class="mu">${tstr(h.t)} · ${esc(h.who)}: ${esc(h.txt)}</small>`).join('<br>')}</details>
<div class="wrap" style="margin-top:8px">${b.join('')}</div></div>`;
}
const oFind = (id) => ONL.orders.find((o) => o.id == id);
async function oAct(id, act, body = {}) { try { await post('/api/shop/orders/' + id + '/act', { act, ...body }); toast('Tersimpan'); await pollOrders(true); return true; } catch (e) { toast(e.message, 5000); } }
function oReject(id) { const r = prompt('Alasan menolak (opsional):'); if (r === null) return; oAct(id, 'reject', { reason: r }); }
async function oAccept(id) { if (await oAct(id, 'accept', { ship: 0 })) oSale(id, true); }
function oShip(id) { oAct(id, 'ship', {}); }
// catat pesanan meja ke kasir/akuntansi toko (stok berkurang)
async function oSale(id, silent) {
  const o = oFind(id); if (!o || o.sale_no) return;
  const items = o.items.filter((i) => prod(i.pid)).map((i) => ({ id: i.pid, q: i.q, pp: i.price }));
  if (items.length < o.items.length) return toast('Ada item pesanan yang tidak ada di data toko ini — catat manual di kasir', 5000);
  for (const i of items) { const p = prod(i.id); if (p.st < i.q && !confirm('Stok ' + p.n + ' tinggal ' + p.st + '. Tetap catat?')) return; }
  const cid = 'ob' + o.buyer_id;
  try {
    if (!cust(cid)) emit('cu', { c: { id: cid, n: o.bn + ' (meja)', ph: o.bp || '', ad: '', note: 'Pembeli pesan via QR meja' } });
    const r = calc(items, '');
    const ev = emit('sale', { tot: r.sub - r.disc, sub: r.sub, disc: r.disc, cdA: 0, cd: '', tax: 0, hpp: r.hpp, L: r.lines, pay: 'Piutang', cu: cid, cn: o.bn + ' (meja)', dpay: 0, dpm: 'Tunai', due: Date.now(), note: 'Pesanan meja #' + o.id + (o.note ? ' · ' + o.note : ''), ppn: 0, oid: o.id });
    await post('/api/shop/orders/' + id + '/act', { act: 'sale', no: ev.no }); o.sale_no = ev.no;
    if (o.paid) emit('pay', { sale: ev.no, amt: r.sub - r.disc, m: 'Tunai' });
    if (!silent) toast('Tercatat di kasir: ' + ev.no); else toast('Pesanan diproses & dicatat ke kasir');
    publishCatalog(); R();
  } catch (e) { toast(e.message); }
}
async function oPaid(id) {
  const o = oFind(id); if (!confirm('Tandai pesanan #' + id + ' (' + rp(o.tot) + ') sudah dibayar?')) return;
  if (await oAct(id, 'paid')) { const s = o.sale_no && S.sales.find((x) => x.no == o.sale_no); if (s && sOut(s) > 0) emit('pay', { sale: s.no, amt: sOut(s), m: 'Tunai' }); R(); }
}
async function onlSettings() {
  const el = $('#onlset'); if (!el) return;
  let d; try { d = await api('/api/shop/profile'); } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; return; }
  if (!document.body.contains(el)) return;
  const s = d.shop; ONL.shop = s;
  el.innerHTML = `<h3>Pengaturan pesan dari meja</h3><label class="row"><span><b>Aktifkan pesan dari meja (QR)</b><br><small class="mu">Pembeli yang scan QR meja bisa melihat menu & memesan</small></span><input type="checkbox" id="oo" ${s.open ? 'checked' : ''}></label>
<div class="fm"><input id="oa" placeholder="Alamat toko (opsional)" value="${esc(s.addr || S.set.addr || '')}"><input id="ow" inputmode="tel" placeholder="No. WhatsApp toko (opsional)" value="${esc(s.wa || S.set.tel || '')}"><textarea id="od" rows="2" placeholder="Catatan toko untuk pembeli (opsional)">${esc(s.descr || '')}</textarea>
<small class="mu">${d.n} menu tersedia untuk dipesan. Atur menu & stok lewat Produk → Edit.</small><button class="pr" id="osv">Simpan</button><button class="gh" onclick="publishCatalog(true)">⬆ Perbarui menu sekarang</button></div>`;
  $('#osv').onclick = async () => {
    try {
      await api('/api/shop/profile', { method: 'PUT', body: JSON.stringify({ open: $('#oo').checked, addr: $('#oa').value, wa: $('#ow').value, descr: $('#od').value }) });
      toast('Pengaturan disimpan'); publishCatalog(true); onlSettings();
    } catch (e) { toast(e.message); }
  };
}
