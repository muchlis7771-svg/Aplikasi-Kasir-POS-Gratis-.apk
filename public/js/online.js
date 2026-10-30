'use strict';
/* ============ TOKO ONLINE (sisi toko): katalog otomatis, pesanan pembeli, tawar, ACC kredit, kirim, chat ============ */
const ONL = { orders: [], shop: null, methods: {}, tab: 'sum', f: 'act', t: null, seen: 0, cat: '', pubT: null };
const OST = { nego: ['Tawar harga', 'o'], nego_toko: ['Menunggu pembeli', ''], acc_kredit: ['Minta kredit', 'o'], baru: ['Pesanan baru', 'o'], diproses: ['Diproses', ''], dikirim: ['Dikirim', 'g'], selesai: ['Selesai', 'g'], batal: ['Dibatalkan', 'r'], ditolak: ['Ditolak', 'r'] };
const PAYN = { cod: 'COD (bayar di tempat)', transfer: 'Transfer', kredit: 'Kredit / tempo' };
const MNAME = (k) => (ONL.methods[k] || BMETHODS[k] || [k])[0];
const BMETHODS = { ambil: ['Ambil sendiri', 'none'], kurir: ['Kurir toko', 'instant'], gosend: ['GoSend', 'instant'], grab: ['GrabExpress', 'instant'], jnt: ['J&T Express', 'exp'], jne: ['JNE', 'exp'], sicepat: ['SiCepat', 'exp'] };
const trackUrl = (c, r) => (r ? 'https://cekresi.com/?noresi=' + encodeURIComponent(r) : '');
const needAct = (o) => ['nego', 'baru', 'acc_kredit'].includes(o.status);

// katalog: dikirim otomatis ke pasar online setiap ada perubahan produk/stok (owner/admin/akuntan, online)
function publishCatalog(force) {
  if (!S || !S.srv || !U || !(U.r == 'owner' || U.r == 'admin') || !pkgHas('onl') || !canNet() || !TK() || isExp()) return;
  clearTimeout(ONL.pubT);
  ONL.pubT = setTimeout(async () => {
    if (!U || !(U.r == 'owner' || U.r == 'admin')) return;
    const items = S.p.filter((p) => !p.x && p.on !== false).map((p) => ({ id: p.id, n: p.n, c: p.c, pr: p.pr, opr: p.opr || 0, st: Math.max(0, p.st), img: p.img || '', sku: p.sku || '', u: p.u || '', kd: p.kd || '', b: p.b || '', t: (p.tiers || []).filter((t) => t.min > 1).map((t) => ({ min: t.min, d: t.d })) }));
    const key = 'jpos:cat2:' + SID, h = String(items.length) + ':' + (await sha(JSON.stringify(items))).slice(0, 16);
    if (!force && LS.get(key, '') == h) return;
    try { await post('/api/shop/catalog', { items, shop: { lat: S.set.glat, lng: S.set.glng, addr: S.set.addr || '' } }); LS.set(key, h); if (force) toast(items.length + ' produk tampil di pasar online'); } catch (e) { if (force) toast(e.message); }
  }, force ? 10 : 4000);
}
async function pollOrders(render) {
  if (!S || !S.srv || !U || !can('onl') || !canNet() || !TK()) return;
  try {
    const r = await api('/api/shop/orders'); ONL.orders = r.orders;
    const n = ONL.orders.filter(needAct).length;
    if (n > ONL.seen && ONL.seen >= 0 && V != 'onl') toast('🛍️ ' + n + ' pesanan online perlu tindakan', 4000);
    ONL.seen = n; onlBadge(); if (render && V == 'onl' && !$('.md')) R();
  } catch (e) { }
}
function onlBadge() { const n = ONL.orders.filter(needAct).length, el = $('#nb-onl') || (n ? $('#nb-menu') : null); if (el) { el.textContent = n; el.style.display = n ? 'grid' : 'none'; } }
setInterval(() => { if (U && S && S.srv) pollOrders(true); }, 30000);

VW.onl = () => {
  if (!S.srv) return `<div class="cd"><h3>Toko online</h3><p class="mu">Fitur pasar online butuh toko yang terdaftar di server (bukan mode lokal/demo).</p></div>`;
  const tabs = `<div class="seg sc-tabs" style="margin-top:0">${[['sum', '📊 Ringkasan'], ['ord', '📦 Pesanan'], ['promo', '⚡ Promo'], ['konten', '🎬 Konten'], ['ulasan', '⭐ Ulasan'], ['qa', '❓ Diskusi'], ['chat', '💬 Chat'], ['set', '⚙️ Toko']].map((t) => `<button class="${ONL.tab == t[0] ? 'a' : ''}" onclick="ONL.tab='${t[0]}';R()">${t[1]}${t[0] == 'ord' && ONL.orders.filter(needAct).length ? ' (' + ONL.orders.filter(needAct).length + ')' : ''}</button>`).join('')}</div>`;
  if (ONL.tab == 'set') return tabs + `<div id="onlset" class="cd"><p class="mu">Memuat pengaturan…</p></div>`;
  if (['sum', 'promo', 'konten', 'ulasan', 'qa'].includes(ONL.tab)) return tabs + `<div id="onlx"><div class="cd"><p class="mu">Memuat…</p></div></div>`;
  if (ONL.tab == 'chat') return tabs + `<div id="onlchat" class="cd"><p class="mu">Memuat chat…</p></div>`;
  const F = { act: (o) => needAct(o) || ['nego_toko', 'diproses', 'dikirim'].includes(o.status) || (!o.paid && o.status == 'selesai'), run: (o) => ['nego_toko', 'diproses', 'dikirim'].includes(o.status), done: (o) => o.status == 'selesai', unpaid: (o) => !o.paid && !['batal', 'ditolak'].includes(o.status), x: (o) => ['batal', 'ditolak'].includes(o.status), all: () => 1 };
  const L = ONL.orders.filter(F[ONL.f]), cnt = (k) => ONL.orders.filter(F[k]).length;
  const omz = ONL.orders.filter((o) => o.status == 'selesai').reduce((a, o) => a + o.sub, 0);
  return tabs + kpi([['Perlu tindakan', ONL.orders.filter(needAct).length], ['Sedang berjalan', cnt('run')], ['Belum dibayar', rp(ONL.orders.filter(F.unpaid).reduce((a, o) => a + o.tot, 0))], ['Omzet online selesai', rp(omz)]])
    + `<div class="seg">${[['act', 'Aktif'], ['run', 'Berjalan'], ['unpaid', 'Belum bayar'], ['done', 'Selesai'], ['x', 'Batal'], ['all', 'Semua']].map((x) => `<button class="${ONL.f == x[0] ? 'a' : ''}" onclick="ONL.f='${x[0]}';R()">${x[1]} (${cnt(x[0])})</button>`).join('')}</div>`
    + (L.map(ordCard).join('') || `<div class="cd"><p class="mu">Belum ada pesanan di sini. Pastikan toko online <b>dibuka</b> di tab Pengaturan.</p></div>`)
    + `<div class="wrap"><button class="gh" onclick="pollOrders(true)">⟳ Muat ulang</button><button class="gh" onclick="publishCatalog(true)">⬆ Publikasikan katalog sekarang</button></div>`;
};
VW.onl.after = () => {
  if (!S.srv) return;
  if (ONL.tab == 'set') onlSettings(); else if (ONL.tab == 'chat') onlChats(); else if (SC[ONL.tab]) SC[ONL.tab]();
  else if (!ONL.loaded) { ONL.loaded = 1; pollOrders(true); }
};
function ordCard(o) {
  const st = OST[o.status] || [o.status, ''], items = o.items.map((i) => `<div class="row" style="margin:2px 0"><span>${esc(i.n)} <small class="mu">× ${i.q}${i.unit ? ' ' + esc(i.unit) : ''}</small>${i.offer ? `<br><small class="or">ditawar ${rp(i.offer)} (harga ${rp(i.price)})</small>` : ''}${i.counter ? `<br><small class="mu">harga toko ${rp(i.counter)}</small>` : ''}</span><b>${rp((i.offer || i.price) * i.q)}</b></div>`).join('');
  const b = [];
  if (o.status == 'nego') b.push(`<button class="gh a" onclick="oAct(${o.id},'accept_offer')">Terima tawaran</button>`, `<button class="gh" onclick="oCounter(${o.id})">Beri harga lain</button>`);
  if (o.status == 'acc_kredit') b.push(`<button class="gh a" onclick="oCredit(${o.id})">📊 Cek skor & ACC kredit</button>`);
  if (o.status == 'baru') b.push(`<button class="gh a" onclick="oAccept(${o.id})">Terima & proses</button>`, `<button class="gh" onclick="oCounter(${o.id})">Ubah harga</button>`);
  if (o.status == 'diproses') b.push(`<button class="gh a" onclick="oShip(${o.id})">${o.method == 'ambil' ? 'Siap diambil' : '🚚 Kirim'}</button>`);
  if (['diproses', 'dikirim'].includes(o.status)) b.push(`<button class="gh" onclick="oAct(${o.id},'done')">Selesai</button>`);
  if (['diproses', 'dikirim', 'selesai'].includes(o.status) && !o.sale_no) b.push(`<button class="gh" onclick="oSale(${o.id})">Catat ke kasir</button>`);
  if (!o.paid && !['batal', 'ditolak', 'nego', 'nego_toko'].includes(o.status)) b.push(`<button class="gh" onclick="oPaid(${o.id})">✔ Tandai lunas</button>`);
  if (!['selesai', 'batal', 'ditolak'].includes(o.status)) b.push(`<button class="gh d" onclick="oReject(${o.id})">Tolak</button>`);
  b.push(`<button class="gh" onclick="bChatOpen(${o.buyer_id},'${esc(o.bn).replace(/'/g, '')}')">💬 Chat</button>`);
  if (o.bp) b.push(`<a class="gh" target="_blank" href="${esc(waLink(o.bp, 'Halo ' + o.bn + ', terkait pesanan #' + o.id + ' di ' + S.name))}">WA</a>`);
  return `<div class="cd"><div class="row" style="margin:0"><span><b>#${o.id} · ${esc(o.bn)}</b><br><small class="mu">${tstr(o.t)} · ${esc(o.bp || '')}</small></span><span class="chip ${st[1]}">${st[0]}</span></div>
<div style="margin:8px 0">${items}</div>${row('Subtotal', rp(o.sub))}${row('Ongkir · ' + esc(MNAME(o.method)) + (o.dist ? ' · ' + distStr(o.dist) : ''), o.ship ? rp(o.ship) : BMETHODS[o.method] && BMETHODS[o.method][1] == 'exp' ? '<span class="or">isi saat kirim</span>' : rp(0))}${row('<b>Total</b>', rp(o.tot))}
<small class="mu">Bayar: <b>${esc(PAYN[o.pay] || o.pay)}</b>${o.pay == 'kredit' ? ' · tempo ' + o.days + ' hari' + (o.due ? ' (jatuh tempo ' + dstr(o.due) + ')' : '') : ''} · ${o.paid ? '<b class="gr">LUNAS</b>' : '<b class="rd">belum dibayar</b>'}${o.sale_no ? ' · tercatat di kasir ' + esc(o.sale_no) : ''}<br>Alamat: ${esc(o.addr || '-')}${o.lat != null ? ` · <a target="_blank" href="${mapsUrl(o)}">peta</a>` : ''}${o.note ? '<br>Catatan: ' + esc(o.note) : ''}${o.resi ? `<br>Resi ${esc(MNAME(o.courier))}: <b>${esc(o.resi)}</b> <a target="_blank" href="${trackUrl(o.courier, o.resi)}">lacak</a>` : ''}</small>
<details><summary class="mu" style="font-size:12px">Riwayat</summary>${o.hist.map((h) => `<small class="mu">${tstr(h.t)} · ${esc(h.who)}: ${esc(h.txt)}</small>`).join('<br>')}</details>
<div class="wrap" style="margin-top:8px">${b.join('')}</div></div>`;
}
const oFind = (id) => ONL.orders.find((o) => o.id == id);
async function oAct(id, act, body = {}) { try { await post('/api/shop/orders/' + id + '/act', { act, ...body }); toast('Tersimpan'); await pollOrders(true); return true; } catch (e) { toast(e.message, 5000); } }
function oReject(id) { const r = prompt('Alasan menolak (opsional):'); if (r === null) return; oAct(id, 'reject', { reason: r }); }
function oCounter(id) {
  const o = oFind(id), m = modal(`<h3>Beri harga untuk #${id}</h3><small class="mu">Pembeli akan diminta menyetujui harga ini.</small>${o.items.map((i) => `<label><small>${esc(i.n)} × ${i.q} · harga ${rp(i.price)}${i.offer ? ' · ditawar ' + rp(i.offer) : ''}</small><input type="number" data-p="${esc(i.pid)}" value="${i.offer ? Math.round((i.offer + i.price) / 2) : i.price}"></label>`).join('')}<button class="pr" id="ok">Kirim harga ke pembeli</button>`);
  $('#ok', m).onclick = async () => { const prices = {}; $$('[data-p]', m).forEach((x) => (prices[x.dataset.p] = num(x.value))); if (await oAct(id, 'counter', { prices })) m.close(); };
}
async function oAccept(id) {
  const o = oFind(id), exp = BMETHODS[o.method] && BMETHODS[o.method][1] == 'exp';
  let ship = 0; if (exp && !o.ship) { const v = prompt('Ongkir ' + MNAME(o.method) + ' ke alamat pembeli (Rp). Bisa diisi nanti saat kirim:', ''); if (v === null) return; ship = num(v); }
  if (await oAct(id, 'accept', { ship })) oSale(id, true);
}
async function oCredit(id) {
  const o = oFind(id); let d; try { d = await api('/api/shop/buyer/' + o.buyer_id); } catch (e) { return toast(e.message); }
  const c = d.credit, col = { A: 'var(--gr)', B: 'var(--bl)', C: 'var(--or)', D: 'var(--rd)' }[c.grade], need = d.owing + o.tot, sug = Math.max(need, c.rec);
  const m = modal(`<h3>Kelayakan kredit · ${esc(d.buyer.name)}</h3><div class="row"><span><b style="font-size:34px;color:${col}">${c.score}</b><small class="mu">/100</small></span><span class="chip" style="font-size:14px;color:${col}">Nilai ${c.grade} · ${esc(c.label)}</span></div>
<div style="height:10px;border-radius:9px;background:var(--bd);overflow:hidden"><div style="width:${c.score}%;height:100%;background:${col}"></div></div>
<small class="mu">${c.why.map(esc).join(' · ')}</small>${row('Piutang pembeli di toko ini', rp(d.owing))}${row('Pesanan ini', rp(o.tot))}${row('Limit saat ini', d.lim ? rp(d.lim.lim) : '-')}${row('Rekomendasi sistem', '<b>' + rp(c.rec) + '</b>')}
${U.r == 'owner' ? `<label><small class="mu">Limit kredit untuk pembeli ini</small><input id="cl" type="number" value="${d.lim ? Math.max(d.lim.lim, need) : sug}"></label><label><small class="mu">Tempo (hari)</small><input id="cd" type="number" value="${o.days || 14}"></label>${c.grade == 'D' ? '<small class="rd">⚠ Sistem tidak menyarankan kredit untuk pembeli ini.</small>' : ''}<button class="pr" id="ok">✔ ACC kredit</button>` : '<small class="rd">Hanya pemilik toko (owner) yang bisa ACC kredit.</small>'}<button class="gh d" id="no">Tolak kredit</button>`);
  const ok = $('#ok', m); if (ok) ok.onclick = async () => { if (await oAct(id, 'acc_credit', { lim: num($('#cl', m).value), days: num($('#cd', m).value) })) { m.close(); oSale(id, true); } };
  $('#no', m).onclick = async () => { if (await oAct(id, 'reject', { reason: 'Pengajuan kredit belum bisa disetujui' })) m.close(); };
}
function oShip(id) {
  const o = oFind(id), opts = Object.entries(BMETHODS).filter(([k]) => k != 'ambil'), exp = (k) => BMETHODS[k][1] == 'exp';
  if (o.method == 'ambil') return oAct(id, 'ship', {});
  const m = modal(`<h3>Kirim pesanan #${id}</h3><label><small class="mu">Kurir</small><select id="sc">${opts.map(([k, v]) => `<option value="${k}" ${o.method == k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label><input id="sr" placeholder="No. resi / kode booking (opsional untuk kurir toko)"><input id="sf" type="number" placeholder="Ongkir (Rp) — kosongkan bila sudah dihitung" value="${o.ship || ''}"><small class="mu">GoSend/Grab: pesan lewat aplikasi Gojek/Grab, lalu tempel kode booking di atas. J&T/JNE/SiCepat: isi nomor resi agar pembeli bisa melacak.</small><div class="wrap"><a class="gh" target="_blank" href="https://www.gojek.com/gosend/">Buka GoSend</a><a class="gh" target="_blank" href="https://www.grab.com/id/express/">Buka GrabExpress</a></div><button class="pr" id="ok">Tandai dikirim</button>`);
  $('#ok', m).onclick = async () => { const c = $('#sc', m).value, r = $('#sr', m).value.trim(); if (exp(c) && !r) return toast('Isi nomor resi'); if (await oAct(id, 'ship', { courier: c, resi: r, ship: num($('#sf', m).value) })) m.close(); };
}
// catat pesanan online ke kasir/akuntansi toko (stok berkurang, piutang tercatat sampai lunas)
async function oSale(id, silent) {
  const o = oFind(id); if (!o || o.sale_no) return;
  const items = o.items.filter((i) => prod(i.pid)).map((i) => ({ id: i.pid, q: i.q, pp: i.price }));
  if (items.length < o.items.length) return toast('Ada produk pesanan yang tidak ada di data toko ini — catat manual di kasir', 5000);
  for (const i of items) { const p = prod(i.id); if (p.st < i.q && !confirm('Stok ' + p.n + ' tinggal ' + p.st + '. Tetap catat?')) return; }
  const cid = 'ob' + o.buyer_id;
  try {
    if (!cust(cid)) emit('cu', { c: { id: cid, n: o.bn + ' (online)', ph: o.bp || '', ad: o.addr || '', lat: o.lat, lng: o.lng, note: 'Pembeli pasar online' } });
    const r = calc(items, '');
    const ev = emit('sale', { tot: r.sub - r.disc, sub: r.sub, disc: r.disc, cdA: 0, cd: '', tax: 0, hpp: r.hpp, L: r.lines, pay: 'Piutang', cu: cid, cn: o.bn + ' (online)', dpay: 0, dpm: 'Tunai', due: o.due || Date.now() + 7 * 864e5, note: 'Pesanan online #' + o.id + (o.ship ? ' · ongkir ' + rp(o.ship) + ' (' + MNAME(o.method) + ')' : ''), ppn: 0, oid: o.id });
    await post('/api/shop/orders/' + id + '/act', { act: 'sale', no: ev.no }); o.sale_no = ev.no;
    if (o.paid) emit('pay', { sale: ev.no, amt: r.sub - r.disc, m: o.pay == 'cod' ? 'Tunai' : 'Transfer' });
    if (!silent) toast('Tercatat di kasir: ' + ev.no); else toast('Pesanan diproses & dicatat ke kasir');
    publishCatalog(); R();
  } catch (e) { toast(e.message); }
}
async function oPaid(id) {
  const o = oFind(id); if (!confirm('Tandai pesanan #' + id + ' (' + rp(o.tot) + ') sudah dibayar?')) return;
  if (await oAct(id, 'paid')) { const s = o.sale_no && S.sales.find((x) => x.no == o.sale_no); if (s && sOut(s) > 0) emit('pay', { sale: s.no, amt: sOut(s), m: o.pay == 'cod' ? 'Tunai' : 'Transfer' }); R(); }
}
async function onlSettings() {
  const el = $('#onlset'); if (!el) return;
  let d; try { d = await api('/api/shop/profile'); } catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; return; }
  if (!document.body.contains(el)) return;
  const s = d.shop; ONL.shop = s; ONL.methods = d.methods || BMETHODS; const ships = String(s.ships || 'ambil,kurir').split(','), own = U.r == 'owner';
  el.innerHTML = `<h3>Pengaturan toko online</h3><label class="row"><span><b>Buka toko di pasar online</b><br><small class="mu">Produk tampil untuk semua pembeli</small></span><input type="checkbox" id="oo" ${s.open ? 'checked' : ''}></label>
<div class="fm"><div class="row"><small class="mu">Lokasi toko (untuk ongkir): <b id="oll">${s.lat != null ? s.lat.toFixed(5) + ', ' + s.lng.toFixed(5) : 'belum diatur'}</b></small><button class="gh" id="ogps">📍 Pakai lokasi saya</button></div>
<input id="oa" placeholder="Alamat toko" value="${esc(s.addr || S.set.addr || '')}"><textarea id="ob" rows="2" placeholder="Rekening untuk transfer (mis. BCA 123456 a.n. Toko …)">${esc(s.bank || '')}</textarea><input id="ow" inputmode="tel" placeholder="No. WhatsApp toko" value="${esc(s.wa || S.set.tel || '')}"><input id="om" type="number" placeholder="Minimal belanja (Rp, opsional)" value="${s.minorder || ''}"><textarea id="od" rows="2" placeholder="Deskripsi toko (opsional)">${esc(s.descr || '')}</textarea>
<b>Pembayaran</b><label class="row"><span>Terima COD (bayar di tempat)</span><input type="checkbox" id="ocod" ${s.cod ? 'checked' : ''}></label><label class="row"><span>Terima kredit / tempo (perlu ACC owner) ${own ? '' : '<small class="mu">— hanya owner</small>'}</span><input type="checkbox" id="ocr" ${s.credit ? 'checked' : ''} ${own ? '' : 'disabled'}></label>
<b>Pengiriman yang dilayani</b>${Object.entries(ONL.methods).map(([k, v]) => `<label class="row"><span>${esc(v[0])} <small class="mu">${v[1] == 'instant' ? '· ongkir otomatis per jarak' : v[1] == 'exp' ? '· ongkir diisi toko' : ''}</small></span><input type="checkbox" data-sh="${k}" ${ships.includes(k) ? 'checked' : ''}></label>`).join('')}
<small class="mu">${d.n} produk tampil di pasar. Atur harga online & sembunyikan produk lewat menu Produk → Edit.</small><button class="pr" id="osv">Simpan</button><button class="gh" onclick="publishCatalog(true)">⬆ Publikasikan katalog sekarang</button></div>`;
  let ll = s.lat != null ? { lat: s.lat, lng: s.lng } : S.set.glat != null ? { lat: S.set.glat, lng: S.set.glng } : null;
  if (ll && s.lat == null) $('#oll').textContent = ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5) + ' (dari lokasi absensi)';
  $('#ogps').onclick = async () => { toast('Mengambil lokasi…', 1500); const p = await getPos(); if (!p) return toast('Lokasi tidak tersedia'); ll = p; $('#oll').textContent = p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); };
  $('#osv').onclick = async () => {
    if ($('#oo').checked && !ll) return toast('Atur lokasi toko dulu (📍)');
    try {
      await api('/api/shop/profile', { method: 'PUT', body: JSON.stringify({ open: $('#oo').checked, lat: ll && ll.lat, lng: ll && ll.lng, addr: $('#oa').value, bank: $('#ob').value, wa: $('#ow').value, minorder: num($('#om').value), descr: $('#od').value, cod: $('#ocod').checked, credit: $('#ocr').checked, ships: $$('[data-sh]').filter((x) => x.checked).map((x) => x.dataset.sh).join(',') }) });
      toast('Pengaturan toko online disimpan'); publishCatalog(true); onlSettings();
    } catch (e) { toast(e.message); }
  };
}
async function onlChats() {
  const el = $('#onlchat'); if (!el) return;
  try { const r = await api('/api/shop/chats'); el.innerHTML = '<h3>Chat dengan pembeli</h3>' + (r.rooms.map((x) => `<button class="us2" onclick="bChatOpen(${x.buyer},'${esc(x.name).replace(/'/g, '')}')"><em>${esc((x.name || '?')[0].toUpperCase())}</em><span>${esc(x.name)}</span><span class="sp"></span>›</button>`).join('') || '<p class="mu">Belum ada chat dari pembeli.</p>'); }
  catch (e) { el.innerHTML = '<p class="rd">' + esc(e.message) + '</p>'; }
}
function bChatOpen(bid, name) {
  let last = 0, timer;
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">💬 ${esc(name)}</h3><button class="gh" id="cx">✕</button></div><div class="chat" id="cm" style="height:50vh"></div><div class="cin"><input id="ci" placeholder="Tulis pesan…" maxlength="500"><button id="cs">Kirim</button></div>`, 'w');
  const load = async () => { try { const r = await api('/api/shop/chat?buyer=' + bid + '&since=' + last); const el = $('#cm', m); if (!el) return clearInterval(timer); r.m.forEach((x) => { last = Math.max(last, x.seq); el.insertAdjacentHTML('beforeend', `<div class="bub ${x.sid == SID ? 'me' : ''}"><small>${x.sid == SID ? esc(x.un) : esc(name)} · ${hm(x.t)}</small>${esc(x.tx)}</div>`); }); if (r.m.length) el.scrollTop = el.scrollHeight; if (!last && !r.m.length) el.innerHTML = '<small class="mu">Belum ada pesan.</small>'; } catch (e) { } };
  const send = async () => { const i = $('#ci', m), tx = i.value.trim(); if (!tx) return; i.value = ''; try { await post('/api/shop/chat', { buyer: bid, text: tx }); if (!last) $('#cm', m).innerHTML = ''; load(); } catch (e) { toast(e.message); i.value = tx; } };
  $('#cs', m).onclick = send; $('#ci', m).onkeydown = (e) => { if (e.key == 'Enter') send(); }; $('#cx', m).onclick = () => m.close();
  m.onclose = () => clearInterval(timer); load(); timer = setInterval(load, 4000);
}

/* ============ SELLER CENTER: ringkasan, promo (flash sale & voucher), konten, ulasan ============ */
const scEl = () => $('#onlx');
const SC = {
  async sum() {
    let d; try { d = await api('/api/shop/stats'); } catch (e) { return scEl() && (scEl().innerHTML = '<p class="rd">' + esc(e.message) + '</p>'); }
    if (!scEl()) return; const need = ONL.orders.filter(needAct).length;
    const days14 = days(14).map((x) => ({ l: x.l, v: (d.daily.find((y) => y.d == x.k) || {}).v || 0 }));
    scEl().innerHTML = `<div class="cd hero"><small>Seller Center · ${esc(S.name)}</small><h2>${rp(d.omz)}</h2><small>omzet online 30 hari · ${d.orders} pesanan · ${d.buyers} pembeli</small></div>
${need ? `<div class="cd info"><div class="row" style="margin:0"><b>📦 ${need} pesanan perlu tindakan</b><button class="gh a" onclick="ONL.tab='ord';R()">Proses</button></div></div>` : ''}
${kpi([['Dilihat (7 hari)', d.views, d.uniq + ' pengunjung unik'], ['Konversi', d.conv + '%', 'pengunjung → pembeli'], ['Pengikut', d.followers], ['Rating toko', d.rt ? '⭐ ' + d.rt : '-', d.rc + ' ulasan'], ['Kunjungan toko', d.shopViews], ['Dibatalkan', d.cancel]])}
<div class="cd"><h3>Pengunjung 14 hari</h3>${area(days14, (v) => v + ' x')}</div>
<div class="two"><div class="cd"><h3>👀 Paling sering dilihat</h3>${d.topViews.map((x) => row(esc(x.n), x.cnt + 'x')).join('') || '<small class="mu">Belum ada</small>'}</div><div class="cd"><h3>🔥 Terlaris online</h3>${d.topSold.filter((x) => x.sold).map((x) => row(esc(x.n), x.sold + ' terjual')).join('') || '<small class="mu">Belum ada</small>'}</div></div>
<div class="cd"><h3>Tips naikkan penjualan</h3><small class="mu">• Pasang foto produk yang jelas (Produk → Edit → Foto)<br>• Buat Flash Sale & voucher di tab Promo<br>• Posting promo di tab Konten agar muncul di feed "Untukmu" pembeli<br>• Balas chat & ulasan dengan cepat</small></div>`;
  },
  async promo() {
    let f, v; try { [f, v] = await Promise.all([api('/api/shop/flash'), api('/api/shop/vouchers')]); } catch (e) { return scEl() && (scEl().innerHTML = '<p class="rd">' + esc(e.message) + '</p>'); }
    if (!scEl()) return; const P = S.p.filter((p) => !p.x && p.on !== false && p.st > 0), boss = ['owner', 'admin'].includes(U.r);
    scEl().innerHTML = `<div class="cd"><h3>⚡ Flash Sale</h3><small class="mu">Harga promo terbatas waktu, tampil di bagian Flash Sale beranda pembeli dengan hitung mundur.</small>
${boss ? `<div class="fm" style="margin-top:8px"><select id="fp">${P.map((p) => `<option value="${esc(p.id)}">${esc(p.n)} — ${rp(p.opr || p.pr)}</option>`).join('')}</select><div class="fm2"><input id="fh" type="number" placeholder="Harga flash sale"><select id="fd"><option value="3">3 jam</option><option value="6">6 jam</option><option value="24" selected>24 jam</option><option value="72">3 hari</option><option value="168">7 hari</option></select></div><button class="pr" onclick="scFlash()">Mulai flash sale</button></div>` : ''}
${f.flash.map((x) => `<div class="row"><span>${esc(x.n || x.pid)}<br><small class="mu">${rp(x.price)} <s>${rp(x.opr || x.pr || 0)}</s> · ${x.end > Date.now() ? 'sampai ' + tstr(x.end) : '<span class="rd">berakhir</span>'}</small></span>${boss ? `<button class="gh d" onclick="scDel('flash','pid=${esc(x.pid)}')">Hapus</button>` : ''}</div>`).join('') || '<small class="mu">Belum ada flash sale.</small>'}</div>
<div class="cd"><h3>🎟️ Voucher toko</h3><small class="mu">Pembeli memasukkan kode saat checkout.</small>
${boss ? `<div class="fm" style="margin-top:8px"><div class="fm2"><input id="vc" placeholder="Kode (mis. HEMAT10)" style="text-transform:uppercase"><select id="vt"><option value="pct">Diskon %</option><option value="amt">Potongan Rp</option></select></div><div class="fm2"><input id="vv" type="number" placeholder="Nilai (10 = 10% / Rp)"><input id="vm" type="number" placeholder="Min. belanja (Rp)"></div><div class="fm2"><input id="vx" type="number" placeholder="Maks. potongan (Rp, opsional)"><input id="vq" type="number" placeholder="Kuota (0 = tak terbatas)"></div><label><small class="mu">Berlaku sampai (opsional)</small><input id="ve" type="date"></label><button class="pr" onclick="scVoucher()">Buat voucher</button></div>` : ''}
${v.vouchers.map((x) => `<div class="row"><span><b>${esc(x.code)}</b> · ${x.typ == 'pct' ? x.val + '%' : rp(x.val)}${x.maxd ? ' (maks ' + rp(x.maxd) + ')' : ''}<br><small class="mu">min ${rp(x.min || 0)} · dipakai ${x.used}${x.quota ? '/' + x.quota : ''}${x.exp ? ' · s/d ' + dstr(x.exp) : ''}</small></span>${boss ? `<button class="gh d" onclick="scDel('vouchers','id=${x.id}')">Hapus</button>` : ''}</div>`).join('') || '<small class="mu">Belum ada voucher.</small>'}</div>`;
  },
  async konten() {
    let r; try { r = await api('/api/shop/posts'); } catch (e) { return scEl() && (scEl().innerHTML = '<p class="rd">' + esc(e.message) + '</p>'); }
    if (!scEl()) return; const P = S.p.filter((p) => !p.x && p.on !== false);
    scEl().innerHTML = `<div class="cd"><h3>🎬 Buat postingan</h3><small class="mu">Tampil di feed "Untukmu" & banner beranda pembeli (seperti konten TikTok Shop).</small><div class="fm" style="margin-top:8px"><label class="gh">📷 Pilih foto<input id="ki" type="file" accept="image/*"></label><img id="kpv" style="display:none;width:100%;border-radius:12px"><textarea id="kt" rows="3" placeholder="Tulis promo… mis. 'Stok baru datang! Diskon grosir min 10 dus 🔥'"></textarea><select id="kp"><option value="">— tautkan produk (opsional) —</option>${P.map((p) => `<option value="${esc(p.id)}">${esc(p.n)}</option>`).join('')}</select><button class="pr" onclick="scPost()">Posting</button></div></div>
${r.posts.map((p) => `<div class="cd">${p.img ? `<img src="${esc(p.img)}" style="width:100%;border-radius:12px">` : ''}<p>${esc(p.txt)}</p><div class="row"><small class="mu">❤️ ${p.likes} suka · ${tstr(p.t)}</small><button class="gh d" onclick="scDel('posts','id=${p.id}')">Hapus</button></div></div>`).join('')}`;
    $('#ki').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; ONL.kimg = await imgData(f, 720); const pv = $('#kpv'); pv.src = ONL.kimg; pv.style.display = 'block'; };
  },
  async ulasan() {
    let r; try { r = await api('/api/shop/reviews'); } catch (e) { return scEl() && (scEl().innerHTML = '<p class="rd">' + esc(e.message) + '</p>'); }
    if (!scEl()) return; const avg = r.reviews.length ? (r.reviews.reduce((a, x) => a + x.stars, 0) / r.reviews.length).toFixed(1) : '-';
    scEl().innerHTML = `<div class="cd hero"><small>Rating toko</small><h2>⭐ ${avg}</h2><small>${r.reviews.length} ulasan</small></div>` + (r.reviews.map((x) => `<div class="cd"><small><b>${esc(x.bn)}</b> · ${'⭐'.repeat(x.stars)} · ${esc(x.n || '')} · ${dstr(x.t)}</small><p style="margin:4px 0">${esc(x.txt || '(tanpa komentar)')}</p>${x.reply ? `<small class="mu">↳ Balasan Anda: ${esc(x.reply)}</small>` : `<button class="gh" onclick="scReply(${x.id})">Balas</button>`}</div>`).join('') || '<div class="cd"><p class="mu">Belum ada ulasan.</p></div>');
  },
};
async function scFlash() { try { await post('/api/shop/flash', { pid: $('#fp').value, price: num($('#fh').value), end: Date.now() + num($('#fd').value) * 36e5 }); toast('Flash sale dimulai ⚡'); SC.promo(); } catch (e) { toast(e.message); } }
async function scVoucher() { try { const e = $('#ve').value; await post('/api/shop/vouchers', { code: $('#vc').value, typ: $('#vt').value, val: num($('#vv').value), min: num($('#vm').value), maxd: num($('#vx').value), quota: num($('#vq').value), exp: e ? new Date(e + 'T23:59:59').getTime() : 0 }); toast('Voucher dibuat 🎟️'); SC.promo(); } catch (e) { toast(e.message); } }
async function scPost() { try { await post('/api/shop/posts', { img: ONL.kimg || '', txt: $('#kt').value, pid: $('#kp').value }); ONL.kimg = ''; toast('Postingan tayang 🎬'); SC.konten(); } catch (e) { toast(e.message); } }
async function scDel(k, q) { if (!confirm('Hapus?')) return; try { await api('/api/shop/' + k + '?' + q, { method: 'DELETE' }); SC[k == 'posts' ? 'konten' : 'promo'](); } catch (e) { toast(e.message); } }
SC.qa = async function () {
  try {
    const r = await api('/api/shop/qa'), open = r.qa.filter((x) => !x.a).length;
    scEl().innerHTML = `<div class="cd hero"><small>Diskusi produk</small><h2>${open}</h2><small>pertanyaan belum dijawab · ${r.qa.length} total</small></div>` + (r.qa.map((x) => `<div class="cd"><small><b>${esc(x.bn)}</b> · ${esc(x.n || x.pid)} · ${dstr(x.t)}</small><p style="margin:4px 0">❓ ${esc(x.q)}</p>${x.a ? `<small class="mu">↳ Jawaban Anda: ${esc(x.a)}</small> <button class="gh" onclick="scAnswer(${x.id})">Ubah</button>` : `<button class="gh a" onclick="scAnswer(${x.id})">Jawab</button>`}</div>`).join('') || '<div class="cd"><p class="mu">Belum ada pertanyaan dari pembeli.</p></div>');
  } catch (e) { scEl().innerHTML = '<div class="cd"><p class="rd">' + esc(e.message) + '</p></div>'; }
};
async function scAnswer(id) { const t = prompt('Jawaban untuk pertanyaan pembeli:'); if (!t) return; try { await post('/api/shop/qa', { id, a: t }); SC.qa(); } catch (e) { toast(e.message); } }
async function scReply(id) { const t = prompt('Balasan untuk ulasan ini:'); if (!t) return; try { await post('/api/shop/reviews', { id, reply: t }); SC.ulasan(); } catch (e) { toast(e.message); } }
