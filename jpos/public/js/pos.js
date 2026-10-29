'use strict';
const VW = {};
/* ============ KASIR / ORDER ============ */
let cart = [], cCd = '', cPay = 'Tunai', cCu = '', cDp = 0, cDpm = 'Tunai', cNote = '', cKr = false, pQ = '', pCat = '';
const resetCart = () => { cart = []; cCd = ''; cPay = 'Tunai'; cCu = ''; cDp = 0; cDpm = 'Tunai'; cNote = ''; cKr = false; };
const actProds = () => S.p.filter((p) => !p.x);
const bySku = (v) => S.p.find((p) => !p.x && p.sku && String(p.sku).toLowerCase() == String(v).trim().toLowerCase());
const tierTxt = (p) => (p.tiers || []).slice().sort((a, b) => a.min - b.min).map((t) => '≥' + t.min + ': ' + t.d + '%').join(' · ');
function gridH() {
  const t = pQ.toLowerCase();
  const L = actProds().filter((p) => (!pCat || p.c == pCat) && (!t || p.n.toLowerCase().includes(t) || String(p.sku || '').toLowerCase().includes(t)));
  return L.map((p) => `<button class="pc" ${p.st < 1 ? 'disabled' : ''} onclick="padd('${p.id}')"><em style="background:${COL[p.c.length % COL.length]}">${p.img ? `<img src="${esc(p.img)}" alt="">` : esc(p.n[0] || '?')}</em><b>${esc(p.n)}</b><small>${esc(p.c)} · stok ${p.st}</small>${p.tiers && p.tiers.length ? `<small class="or">${esc(tierTxt(p))}</small>` : ''}<span>${rp(p.pr)}</span></button>`).join('') || '<p class="mu">Produk tidak ditemukan</p>';
}
const catsH = () => { const cs = [...new Set(actProds().map((p) => p.c))].sort(); return cs.length > 1 ? `<div class="seg"><button class="${pCat ? '' : 'a'}" onclick="pcat('')">Semua</button>${cs.map((c) => `<button class="${pCat == c ? 'a' : ''}" onclick="pcat(this.dataset.c)" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''; };
function creditInfo() {
  const c = cCu ? cust(cCu) : null; if (!c) return '';
  if (c.term != 'kredit') return `<small class="mu">Outlet ${esc(c.n)}: tunai saja</small>`;
  const out = outOf(c.id), od = overdue(c.id);
  return `<small>Limit ${rp(c.lim)} · terpakai ${rp(out)} · <b class="${c.lim - out < 0 ? 'rd' : 'gr'}">sisa ${rp(c.lim - out)}</b>${od ? ` · <b class="rd">jatuh tempo ${rp(od)}</b>` : ''}</small>`;
}
function cartH() {
  const items = cart.filter((i) => prod(i.id)), r = items.length ? calc(items.map((i) => ({ id: i.id, q: i.q, ld: i.ld })), cCd) : { lines: [], sub: 0, ldt: 0, cdA: 0, disc: 0, tax: 0, tot: 0 };
  const outs = S.c.filter((c) => !c.x).sort((a, b) => (U.r == 'sales' ? (b.sl == U.n) - (a.sl == U.n) : 0) || a.n.localeCompare(b.n));
  let h = `<div class="cthd"><h3>Keranjang</h3><button class="gh x" onclick="cartOpen(false)">Tutup ✕</button></div>`;
  h += r.lines.length ? r.lines.map((l) => { const ci = cart.find((x) => x.id == l.id); return `<div class="ci"><div class="t"><b>${esc(l.n)}</b><b>${rp(l.p * l.q - l.dd)}</b></div><small>${rp(l.p)} × ${l.q}${l.dd ? ` · diskon ${rp(l.dd)}${l.tier ? ' (grosir ' + esc(l.tier) + '%)' : ''}` : ''}</small><div class="qt" style="margin-top:6px"><button onclick="pstep('${l.id}',-1)">−</button><input type="number" min="1" value="${l.q}" onchange="pset('${l.id}',this.value)"><button onclick="pstep('${l.id}',1)">+</button><input placeholder="Disk % (5+2)" value="${esc(ci.ld || '')}" onchange="pld('${l.id}',this.value)" style="flex:1"><button onclick="pdel('${l.id}')">✕</button></div></div>`; }).join('') : '<p class="mu">Belum ada item. Ketuk produk atau scan barcode.</p>';
  h += `<div class="wrap" style="margin-top:8px"><select style="flex:1" onchange="pcu(this.value)"><option value="">${U.r == 'sales' ? '— pilih outlet —' : 'Pelanggan umum'}</option>${outs.map((c) => `<option value="${c.id}" ${cCu == c.id ? 'selected' : ''}>${esc(c.n)}${c.term == 'kredit' ? ' ★' : ''}</option>`).join('')}</select><button class="gh" onclick="outletForm(null,function(id){pcu(id);R()})">+ Outlet</button></div>${creditInfo()}`;
  h += `<div class="seg">${['Tunai', 'QRIS', 'Transfer', 'Piutang'].map((m) => `<button class="${cPay == m ? 'a' : ''}" onclick="ppay('${m}')">${m == 'Piutang' ? 'Kredit' : m}</button>`).join('')}</div>`;
  if (pkgHas('kirim') && S.srv && cCu) h += `<label class="row" style="margin:6px 0"><span>🚚 Diantar tim dropping${cKr && cPay != 'Piutang' ? '<br><small class="or">Dibayar ' + cPay + ' saat barang tiba (ditagih dropping)</small>' : ''}</span><input type="checkbox" style="width:auto" ${cKr ? 'checked' : ''} onchange="cKr=this.checked;cartUp()"></label>`;
  if (ciNeeded() && U.r == 'sales' && cCu) { const cur = openCI(U.n); h += cur && cur.cid == cCu ? `<small class="gr">📍 Check-in aktif di outlet ini</small>` : `<div class="row" style="margin:6px 0"><small class="rd">Belum check-in di outlet ini</small><button class="gh a" onclick="checkIn('${cCu}').then(cartUp)">Check-in</button></div>`; }
  if (cPay == 'Piutang') h += `<div class="fm2"><input type="number" placeholder="DP dibayar (opsional)" value="${cDp || ''}" onchange="cDp=num(this.value);cartUp()"><select onchange="cDpm=this.value"><option ${cDpm == 'Tunai' ? 'selected' : ''}>Tunai</option><option ${cDpm == 'Transfer' ? 'selected' : ''}>Transfer</option><option ${cDpm == 'QRIS' ? 'selected' : ''}>QRIS</option></select></div>`;
  h += `<div class="fm2" style="margin-top:6px"><input placeholder="Diskon total % (mis. 5+2)" value="${esc(cCd)}" onchange="cCd=this.value;cartUp()"><input placeholder="Catatan" value="${esc(cNote)}" onchange="cNote=this.value"></div>`;
  h += `<div class="tt" style="margin-top:8px">${row('Subtotal', rp(r.sub))}${row('Diskon item', rp(-r.ldt))}${r.cdA ? row('Diskon total', rp(-r.cdA)) : ''}${row('PPN ' + (S.set.ppn || 0) + '%', rp(r.tax))}<h2>${rp(r.tot)}</h2></div>`;
  if (cPay == 'Piutang' && r.tot) h += `<small>Piutang baru: <b>${rp(r.tot - Math.min(cDp, r.tot))}</b></small>`;
  h += `<div class="seg"><button onclick="ptahan()">Tahan</button><button onclick="planjut()">Lanjut (${S.hold.length})</button></div><button class="pr" ${items.length ? '' : 'disabled'} onclick="pbayar()">${U.r == 'sales' ? 'Simpan order' : 'Bayar'}</button>`;
  return h;
}
const cbarH = () => { const n = cart.reduce((a, i) => a + i.q, 0), t = cart.filter((i) => prod(i.id)).length ? calc(cart.map((i) => ({ id: i.id, q: i.q, ld: i.ld })), cCd).tot : 0; return `<span>🛒 ${n} item${S.hold.length ? ' · ' + S.hold.length + ' ditahan' : ''}</span><span>${rp(t)} ›</span>`; };
function cartUp() { const el = $('#ct'); if (!el) return; el.innerHTML = cartH(); const b = $('#cb'); if (b) b.innerHTML = cbarH(); }
const cartOpen = (o) => { const el = $('#ct'); if (el) el.classList.toggle('open', o); };
VW.pos = () => {
  if (U.r == 'sales' && !S.c.length && !cCu) { /* sales boleh tambah outlet langsung dari keranjang */ }
  return `<div class="pos"><section><div class="srch"><input id="pq" placeholder="Cari nama / SKU — Enter menambah" value="${esc(pQ)}" oninput="pQ=this.value;$('#pg').innerHTML=gridH()" onkeydown="pkey(event)"><button class="gh" onclick="scanAdd()" title="Scan barcode">▣</button></div><div id="pcats">${catsH()}</div><div class="grid" id="pg">${gridH()}</div></section><aside class="cd" id="ct">${cartH()}</aside></div><div class="cartbar" id="cb" onclick="cartOpen(true)">${cbarH()}</div>`;
};
function pkey(e) {
  if (e.key != 'Enter') return; const v = e.target.value.trim(); if (!v) return;
  const p = bySku(v) || (actProds().filter((x) => x.n.toLowerCase().includes(v.toLowerCase())).length == 1 ? actProds().find((x) => x.n.toLowerCase().includes(v.toLowerCase())) : null);
  if (p) { padd(p.id); pQ = ''; e.target.value = ''; $('#pg').innerHTML = gridH(); } else toast('Produk tidak ditemukan: ' + v);
}
const pcat = (c) => { pCat = c; $('#pcats').innerHTML = catsH(); $('#pg').innerHTML = gridH(); };
function padd(id, n = 1) {
  const p = prod(id); if (!p) return; const c = cart.find((x) => x.id == id), q = (c ? c.q : 0) + n;
  if (q > p.st) { toast('Stok ' + p.n + ' hanya ' + p.st); return cartUp(); }
  if (c) c.q = q; else cart.push({ id, q: n, ld: '' }); cartUp();
}
function pset(id, v) { const p = prod(id), c = cart.find((x) => x.id == id); if (!c) return; let q = Math.max(1, num(v)); if (q > p.st) { q = p.st; toast('Stok ' + p.n + ' hanya ' + p.st); } c.q = q; cartUp(); }
const pstep = (id, d) => { const c = cart.find((x) => x.id == id); if (!c) return; if (c.q + d < 1) return pdel(id); padd(id, d); };
const pdel = (id) => { cart = cart.filter((x) => x.id != id); cartUp(); };
const pld = (id, v) => { const c = cart.find((x) => x.id == id); if (c) c.ld = v.replace(/[^\d.,+]/g, ''); cartUp(); };
const pcu = (id) => { cCu = id; if (!id && cPay == 'Piutang') cPay = 'Tunai'; cartUp(); };
const ppay = (m) => { cPay = m; cartUp(); };
function scanAdd() { scanCode((v) => { const p = bySku(v); if (p) { padd(p.id); toast('+ ' + p.n, 1200); } else toast('SKU belum terdaftar: ' + v, 3000); }, { multi: true }); }
function ptahan() { if (!cart.length) return toast('Keranjang kosong'); S.hold.push({ cart, cCd, cPay, cCu, cDp, cDpm, cNote, cKr, t: Date.now() }); resetCart(); save(); cartUp(); toast('Transaksi ditahan'); }
function planjut() { if (!S.hold.length) return toast('Tidak ada transaksi ditahan'); if (cart.length && !confirm('Keranjang saat ini akan diganti. Lanjutkan?')) return; const h = S.hold.pop(); ({ cart, cCd, cPay, cCu, cDp, cDpm, cNote } = h); cKr = !!h.cKr; save(); cartUp(); }
function pbayar() {
  try {
    const s = mkSale({ items: cart.map((i) => ({ id: i.id, q: i.q, ld: i.ld })), cd: cCd, pay: cPay, cu: cCu, dpay: cDp, dpm: cDpm, note: cNote, kirim: cKr });
    resetCart(); R(); receipt(s); if (PRN.auto) printReceipt(s);
  } catch (e) { if (e.message != 'Dibatalkan') toast(e.message, 5000); }
}

/* ============ struk ============ */
function receiptText(s) {
  const L = [S.name || 'J-POS', S.set.addr || '', S.set.tel ? 'Telp ' + S.set.tel : '', '-'.repeat(28), s.no + ' · ' + tstr(s.t), 'Kasir: ' + s.u + (s.cn ? ' · ' + s.cn : ''), '-'.repeat(28)].filter(Boolean);
  s.L.forEach((i) => L.push(i.n + '\n  ' + i.q + ' × ' + rp(i.p) + (i.dd ? ' (-' + rp(i.dd) + ')' : '') + ' = ' + rp(i.p * i.q - i.dd)));
  L.push('-'.repeat(28), 'Subtotal ' + rp(s.sub));
  if (s.disc) L.push('Diskon ' + rp(-s.disc));
  if (s.tax) L.push('PPN ' + rp(s.tax));
  L.push('TOTAL ' + rp(s.tot), 'Bayar: ' + (s.cod ? 'Tunai saat barang tiba (' + (s.cm || 'Tunai') + ')' : s.pay == 'Piutang' ? 'Kredit' : s.pay));
  if (s.pay == 'Piutang') L.push('Dibayar ' + rp(s.pa || 0), 'Sisa ' + rp(sOut(s)), 'Jatuh tempo ' + dstr(s.due));
  L.push('', 'Terima kasih 🙏'); return L.join('\n');
}
function receipt(s) {
  s = S.sales.find((x) => x.no == s.no) || s;
  const m = modal(`<div class="rc"><h3>◆ ${esc(S.name || 'J-POS')}</h3><small>${esc(S.set.addr || '')}${S.set.tel ? ' · ' + esc(S.set.tel) : ''}<br>${esc(s.no)} · ${tstr(s.t)}<br>Kasir: ${esc(s.u)}${s.cn ? ' · ' + esc(s.cn) : ''}</small><hr>${s.L.map((i) => `<p><span>${esc(i.n)} ×${i.q}${i.rq ? ` <small class="rd">(retur ${i.rq})</small>` : ''}${i.dd ? `<br><small>diskon ${rp(i.dd)}</small>` : ''}</span><b>${rp(i.p * i.q - i.dd)}</b></p>`).join('')}<hr><p>Subtotal<b>${rp(s.sub)}</b></p>${s.disc ? `<p>Diskon<b>${rp(-s.disc)}</b></p>` : ''}${s.tax ? `<p>PPN<b>${rp(s.tax)}</b></p>` : ''}<h2>${rp(s.tot)}</h2><small>${s.cod ? 'Bayar saat diantar (' + esc(s.cm || 'Tunai') + ') · sisa ' + rp(sOut(s)) : s.pay == 'Piutang' ? 'Kredit · dibayar ' + rp(s.pa || 0) + ' · sisa ' + rp(sOut(s)) + ' · tempo ' + dstr(s.due) : esc(s.pay)}${s.rtot ? ' · retur ' + rp(s.rtot) : ''}${s.note ? '<br>Catatan: ' + esc(s.note) : ''}</small></div><button class="pr" id="rp">🖨️ Cetak struk</button><div class="fm2"><button class="gh" id="rs">Bagikan</button><button class="gh" id="rx">Tutup</button></div>${sOut(s) > 0 ? `<button class="gh a" id="rpay">Terima pembayaran</button>` : ''}${can('retur') && s.L.some((i) => i.q > (i.rq || 0)) ? `<button class="gh d" id="rret">Retur barang</button>` : ''}`);
  $('#rp', m).onclick = () => printMenu(s);
  $('#rx', m).onclick = () => m.close(); $('#rs', m).onclick = () => shareText('Struk ' + s.no, receiptText(s));
  const pb = $('#rpay', m); if (pb) pb.onclick = () => { m.close(); payModal(s.no); };
  const rb = $('#rret', m); if (rb) rb.onclick = () => { m.close(); returModal(s.no); };
}
function payModal(no) {
  const s = S.sales.find((x) => x.no == no); if (!s) return; const out = sOut(s);
  const m = modal(`<h3>Terima pembayaran</h3><small>${esc(s.no)} · ${esc(s.cn || '')} · sisa ${rp(out)}</small><input id="pa" type="number" value="${out}"><select id="pm"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select><button class="pr" id="ok">Simpan</button>`);
  $('#ok', m).onclick = () => { const a = num($('#pa', m).value); if (a <= 0 || a > out) return toast('Jumlah tidak valid (maks ' + rp(out) + ')'); emit('pay', { sale: no, amt: a, m: $('#pm', m).value }); m.close(); toast('Pembayaran dicatat'); R(); };
}
function returModal(no) {
  const s = S.sales.find((x) => x.no == no); if (!s) return;
  const m = modal(`<h3>Retur ${esc(s.no)}</h3><small>Isi jumlah yang dikembalikan</small>${s.L.map((i, n) => `<div class="row"><span>${esc(i.n)} <small>(maks ${i.q - (i.rq || 0)})</small></span><input type="number" min="0" max="${i.q - (i.rq || 0)}" id="rq${n}" style="width:80px" value="0"></div>`).join('')}<select id="rm"><option>Tunai</option><option>Transfer</option></select><small>Metode pengembalian uang (jika sudah dibayar)</small><button class="pr" id="ok">Proses retur</button>`);
  $('#ok', m).onclick = () => { const L = s.L.map((i, n) => ({ id: i.id, q: Math.min(num($('#rq' + n, m).value), i.q - (i.rq || 0)) })).filter((x) => x.q > 0); if (!L.length) return toast('Isi jumlah retur'); emit('retur', { sale: no, L, m: $('#rm', m).value }); m.close(); toast('Retur dicatat'); R(); };
}
let hQ = '', hD = '';
VW.his = () => {
  const t = hQ.toLowerCase(), L = S.sales.filter((s) => (can('hisAll') || s.u == U.n) && (!hD || dkey(s.t) == hD) && (!t || (s.no + ' ' + (s.cn || '') + ' ' + s.u).toLowerCase().includes(t))).slice(-150).reverse();
  return `<div class="cd"><h3>Riwayat transaksi</h3><div class="fm2"><input placeholder="Cari no / outlet / kasir" value="${esc(hQ)}" onchange="hQ=this.value;R()"><input type="date" value="${hD}" onchange="hD=this.value;R()"></div><div class="ov"><table><tr><th>No<th>Tanggal<th>Outlet<th class="n">Total<th></tr>${L.map((s) => `<tr data-go="${esc(s.no)}"><td>${esc(s.no)}<br><small>${esc(s.u)} · ${esc(s.pay == 'Piutang' ? 'Kredit' : s.pay)}</small><td>${dstr(s.t)}<br><small>${hm(s.t)}</small><td>${esc(s.cn || '-')}<td class="n">${rp(s.tot)}${s.rtot ? `<br><small class="rd">retur ${rp(s.rtot)}</small>` : ''}${sOut(s) > 0 ? `<br><small class="or">sisa ${rp(sOut(s))}</small>` : ''}<td>${MGR(U.r) && !(s.rtot >= s.tot) ? `<button class="gh" onclick="event.stopPropagation();returModal('${esc(s.no)}')">Retur</button>` : ''}</tr>`).join('') || '<tr><td colspan="5" class="mu">Belum ada transaksi</tr>'}</table></div></div>`;
};
document.addEventListener('click', (e) => { const r = e.target.closest('tr[data-go]'); if (r && V == 'his') { const s = S.sales.find((x) => x.no == r.dataset.go); if (s) receipt(s); } });
