'use strict';
/* ============ SALES KANVAS ============
   Muat barang dari gudang ke mobil → kunjungi outlet & jual langsung (tunai / QRIS / transfer / kredit) dari stok mobil →
   balikin barang tidak laku ke gudang → rekap & setoran otomatis. Stok total produk = gudang + semua mobil. */
let KVU = '', KVD = 0; // pengawas memilih sales kanvas; KVD = geser hari (0 = hari ini)
const kvUsers = () => [...new Set([...(S.staff || []).filter((u) => u.role == 'kanvas').map((u) => u.name), ...(S.users || []).filter((u) => u.r == 'kanvas').map((u) => u.n), ...(S.kv || []).map((x) => x.u)])].sort();
const kvWho = () => (U.r == 'kanvas' ? U.n : KVU || kvUsers()[0] || '');
const vanList = (u) => Object.entries((S.van || {})[vanKey(u)] || {}).map(([id, q]) => ({ p: prod(id), q })).filter((x) => x.p && x.q > 0).sort((a, b) => a.p.n.localeCompare(b.p.n));
const whFree = (id) => { const p = prod(id); return p ? Math.max(0, p.st - vanAll(id)) : 0; };
function kvRekap(u, d0) {
  const f = d0, t = d0 + 864e5, sales = S.sales.filter((s) => s.u == u && s.t >= f && s.t < t), M = { Tunai: 0, QRIS: 0, Transfer: 0 }; let kred = 0, omz = 0, pay = 0;
  for (const s of sales) { omz += s.tot - (s.rtot || 0); if (s.pay == 'Piutang') { kred += s.tot - (s.dpay || 0); if (s.dpay) M[s.dpm || 'Tunai'] += s.dpay; } else M[s.pay] = (M[s.pay] || 0) + s.tot; }
  for (const s of S.sales) for (const p of s.pays || []) if (p.u == u && p.t >= f && p.t < t) { M[p.m || 'Tunai'] = (M[p.m || 'Tunai'] || 0) + p.amt; pay += p.amt; }
  const mv = (S.kv || []).filter((x) => x.u == u && x.t >= f && x.t < t), P = {};
  const add = (id, k, q) => { const r = (P[id] = P[id] || { muat: 0, jual: 0, balik: 0, retur: 0 }); r[k] += q; };
  for (const x of mv) for (const i of x.L) add(i.id, x.k, i.q);
  for (const s of sales) for (const i of s.L) add(i.id, 'jual', i.q);
  for (const r of (S.rtr || []).filter((r) => r.u == u && r.t >= f && r.t < t && !r.bad)) for (const i of r.L) add(i.id, 'retur', i.q);
  const vis = new Set(S.att.filter((a) => a.u == u && a.k == 'visit' && a.t >= f && a.t < t).map((a) => a.cid)), noo = S.c.filter((c) => c.by == u && c.t >= f && c.t < t).length;
  return { sales, M, kred, omz, pay, P, mv, vis: vis.size, noo, nOut: new Set(sales.map((s) => s.cu).filter(Boolean)).size };
}
function kvText(u, d0, R0) {
  const L = ['*🚚 REKAP SALES KANVAS ' + String(S.name || '').toUpperCase() + '*', '_' + dstr(d0) + '_', '', 'Sales: *' + u + '*', 'Outlet dikunjungi: ' + R0.vis + ' · bertransaksi: ' + R0.nOut + (R0.noo ? ' · outlet baru: ' + R0.noo : ''), '',
    '*PENJUALAN* — ' + R0.sales.length + ' nota, omzet *' + rp(R0.omz) + '*', '• Tunai: ' + rp(R0.M.Tunai), '• QRIS: ' + rp(R0.M.QRIS || 0), '• Transfer: ' + rp(R0.M.Transfer || 0), '• Kredit: ' + rp(R0.kred)];
  if (R0.pay) L.push('Tagihan piutang diterima: ' + rp(R0.pay));
  L.push('', '*Setor tunai: ' + rp(R0.M.Tunai) + '*', '', '*BARANG* (muat / jual / balik / sisa mobil)');
  for (const [id, r] of Object.entries(R0.P)) { const p = prod(id); if (p) L.push('• ' + p.n + ': ' + r.muat + ' / ' + r.jual + ' / ' + r.balik + ' / ' + vanQ(u, id)); }
  L.push('', '_Dikirim dari J-POS_'); return L.join('\n');
}
function kvItems(title, rows, cap, btn, on) {
  const m = modal(`<h3>${title}</h3><input id="kvq" placeholder="Cari produk / kode"><div id="kvl" style="max-height:50vh;overflow:auto"></div><button class="pr" id="ok">${btn}</button>`, 'w'), Q = {};
  const draw = () => { const t = $('#kvq', m).value.toLowerCase(); $('#kvl', m).innerHTML = rows.filter((x) => !t || (x.p.n + ' ' + (x.p.kd || '') + ' ' + (x.p.sku || '')).toLowerCase().includes(t)).map((x) => `<div class="row kvrow"><span><b>${esc(x.p.n)}</b><br><small class="mu">${cap(x)}</small></span><span class="qt"><button data-m="${x.p.id}">−</button><input data-q="${x.p.id}" type="number" min="0" max="${x.max}" value="${Q[x.p.id] || 0}"><button data-p="${x.p.id}">＋</button></span></div>`).join('') || '<p class="mu">Tidak ada barang.</p>'; };
  const lim = (id) => (rows.find((x) => x.p.id == id) || { max: 0 }).max;
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-m],[data-p]'); if (!b) return; const id = b.dataset.m || b.dataset.p; Q[id] = Math.max(0, Math.min(lim(id), (Q[id] || 0) + (b.dataset.p ? 1 : -1))); draw(); });
  m.addEventListener('change', (e) => { const i = e.target.closest('[data-q]'); if (!i) return; Q[i.dataset.q] = Math.max(0, Math.min(lim(i.dataset.q), num(i.value))); draw(); });
  $('#kvq', m).oninput = draw; draw();
  $('#ok', m).onclick = () => { const L = Object.entries(Q).filter(([, q]) => q > 0).map(([id, q]) => ({ id, q })); if (!L.length) return toast('Isi jumlah barang'); m.close(); on(L); };
  return { m, Q, draw };
}
function kvLoad() {
  const u = kvWho(); if (!u) return toast('Belum ada sales kanvas');
  kvItems('🚚 Muat barang ke mobil · ' + esc(u), actProds().map((p) => ({ p, max: whFree(p.id) })).filter((x) => x.max > 0), (x) => `gudang ${x.max}${x.p.u ? ' ' + esc(x.p.u) : ''} · di mobil ${vanQ(u, x.p.id)}`, U.r == 'kanvas' ? 'Kirim permintaan muat ke admin' : 'Muat ke mobil', (L) => { if (U.r == 'kanvas') { emit('kvr', { op: 'muat', L }); toast('Permintaan muat terkirim — tunggu admin menyiapkan & menyetujui', 4000); } else { emit('kvl', { to: u, L }); toast('Barang dimuat ke mobil ' + u); } R(); });
}
function kvBack(all) {
  const u = kvWho(), rows = vanList(u).map((x) => ({ p: x.p, max: x.q })); if (!rows.length) return toast('Mobil kosong');
  if (all) { if (!confirm('Kembalikan SEMUA sisa barang di mobil (' + rows.reduce((a, x) => a + x.max, 0) + ' unit) ke gudang?')) return; const L = rows.map((x) => ({ id: x.p.id, q: x.max })); if (U.r == 'kanvas') { emit('kvr', { op: 'balik', L, note: 'balik semua' }); toast('Permintaan balik barang terkirim — admin memeriksa barang di gudang', 4000); } else { emit('kvb', { to: u, L, note: 'balik semua' }); toast('Semua sisa barang kembali ke gudang'); } return R(); }
  const k = kvItems('↩️ Balikin barang ke gudang', rows, (x) => `di mobil ${x.max}`, U.r == 'kanvas' ? 'Kirim permintaan balik ke admin' : 'Kembalikan ke gudang', (L) => { if (U.r == 'kanvas') { emit('kvr', { op: 'balik', L }); toast('Permintaan balik barang terkirim — admin memeriksa barang di gudang', 4000); } else { emit('kvb', { to: u, L }); toast('Barang kembali ke gudang'); } R(); });
  const b = document.createElement('button'); b.className = 'gh'; b.textContent = 'Isi semua sisa'; b.onclick = () => { rows.forEach((x) => (k.Q[x.p.id] = x.max)); k.draw(); }; $('#ok', k.m).before(b);
}
async function kvSetor() {
  const u = kvWho(), d0 = kvSod(Date.now() + KVD * 864e5), R0 = kvRekap(u, d0), text = kvText(u, d0, R0);
  if (vanList(u).length && !kvPend(u).some((q) => q.op == 'balik') && confirm('Masih ada sisa barang di mobil. Ajukan balik semua sisa ke gudang sekarang?')) { const L = vanList(u).map((x) => ({ id: x.p.id, q: x.q })); if (U.r == 'kanvas') emit('kvr', { op: 'balik', L, note: 'balik saat setor' }); else emit('kvb', { to: u, L, note: 'balik saat setor' }); }
  const t2 = kvText(u, d0, kvRekap(u, d0)); let sent = null;
  try { if (S.srv && canNet()) { await sync(); sent = await api('/api/rpt/push', { method: 'POST', body: JSON.stringify({ kind: 'kanvas', text: t2, subject: 'Rekap kanvas ' + u + ' · ' + S.name }) }); } } catch (e) { }
  R(); if (typeof shDone == 'function') shDone(t2, sent); else rptShow(t2, sent && sent.res);
}
const kvPend = (u) => (S.kvq || []).filter((q) => q.st == 'tunggu' && (!u || q.u == u));
const kvL = (L) => L.map((i) => esc((prod(i.id) || { n: '?' }).n) + ' <b>' + i.q + '</b>').join(', ');
// admin / pemilik: setujui (boleh ubah jumlah sesuai barang fisik) atau tolak
function kvApprove(no) {
  const q = (S.kvq || []).find((x) => x.no == no); if (!q || q.st != 'tunggu') return;
  const muat = q.op == 'muat', rows = q.L.map((i) => ({ p: prod(i.id), q: i.q, max: muat ? whFree(i.id) : vanQ(q.u, i.id) })).filter((x) => x.p);
  const m = modal(`<h3>${muat ? '🚚 Setujui muat barang' : '↩️ Terima barang kembali'}</h3><small class="mu">${esc(q.u)} · ${dstr(q.t)} ${hm(q.t)}${q.note ? ' · ' + esc(q.note) : ''}</small><small class="mu">${muat ? 'Siapkan barang dari gudang. Ubah jumlah bila stok fisik berbeda.' : 'Hitung barang yang benar-benar diterima di gudang. Ubah jumlah bila berbeda.'}</small>
${rows.map((x, n) => `<div class="row kvrow"><span><b>${esc(x.p.n)}</b><br><small class="mu">diminta ${x.q} · ${muat ? 'gudang' : 'di mobil'} ${x.max}</small></span><input id="ka${n}" type="number" min="0" max="${x.max}" value="${Math.min(x.q, x.max)}" style="width:90px"></div>`).join('')}
<div class="fm2"><button class="gh d" id="no">Tolak</button><button class="pr" id="ok">${muat ? 'Setujui & muat' : 'Terima di gudang'}</button></div>`, 'w');
  $('#ok', m).onclick = () => { const L = rows.map((x, n) => ({ id: x.p.id, q: Math.max(0, Math.min(x.max, num($('#ka' + n, m).value))) })).filter((i) => i.q > 0); if (!L.length) return toast('Jumlah kosong — gunakan Tolak'); emit(muat ? 'kvl' : 'kvb', { to: q.u, L, ref: q.no }); m.close(); toast(muat ? 'Barang dimuat ke mobil ' + q.u : 'Barang diterima di gudang'); R(); };
  $('#no', m).onclick = () => { const why = prompt('Alasan ditolak (opsional):') ?? null; if (why === null) return; emit('kvr', { op: 'tolak', ref: q.no, why }); m.close(); toast('Permintaan ditolak'); R(); };
}
function kvPendCard(u) {
  const mgr = U.r != 'kanvas', L = kvPend(mgr ? null : U.n); if (!L.length) return '';
  return `<div class="cd fbar"><b>⏳ ${mgr ? 'Permintaan menunggu persetujuan' : 'Menunggu admin'} (${L.length})</b>${L.map((q) => `<div class="row kvrow"><span><b>${q.op == 'muat' ? '🚚 Muat' : '↩️ Balik'}</b>${mgr ? ' · ' + esc(q.u) : ''} · ${hm(q.t)}<br><small class="mu">${kvL(q.L)}</small></span>${mgr && ['owner', 'admin'].includes(U.r) ? `<button class="gh pri" onclick="kvApprove('${q.no}')">Proses</button>` : U.r == 'kanvas' ? `<button class="gh d" onclick="emit('kvr',{op:'batal',ref:'${q.no}'});R()">Batal</button>` : ''}</div>`).join('')}</div>`;
}
const kvSod = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
VW.kanvas = () => {
  const mgr = U.r != 'kanvas', us = kvUsers(), u = kvWho(), d0 = kvSod(Date.now() + KVD * 864e5), R0 = u ? kvRekap(u, d0) : null, V0 = u ? vanList(u) : [];
  const head = `<div class="cd">${mgr ? `<label><small class="mu">Sales kanvas</small><select onchange="KVU=this.value;R()">${us.map((x) => `<option ${x == u ? 'selected' : ''}>${esc(x)}</option>`).join('') || '<option value="">Belum ada — tambah pengguna peran Sales Kanvas</option>'}</select></label>` : ''}
<div class="row" style="margin:${mgr ? '8px' : '0'} 0 0"><button class="gh" aria-label="Hari sebelumnya" onclick="KVD--;R()">‹</button><b>${KVD ? dstr(d0) : 'Hari ini · ' + dstr(d0)}</b><button class="gh" aria-label="Hari berikutnya" onclick="KVD=Math.min(0,KVD+1);R()" ${KVD >= 0 ? 'disabled' : ''}>›</button></div></div>`;
  if (!u) return head;
  const nV = V0.reduce((a, x) => a + x.q, 0), vV = V0.reduce((a, x) => a + x.q * x.p.pr, 0);
  return head + kvPendCard(u) + `<div class="kp"><div class="cd k0"><small>Omzet</small><h2>${rp(R0.omz)}</h2><small>${R0.sales.length} nota</small></div><div class="cd k1"><small>Setor tunai</small><h2>${rp(R0.M.Tunai)}</h2><small>QRIS ${rp(R0.M.QRIS || 0)} · TF ${rp(R0.M.Transfer || 0)}</small></div><div class="cd k2"><small>Kredit ke outlet</small><h2>${rp(R0.kred)}</h2><small>tagihan masuk ${rp(R0.pay)}</small></div><div class="cd k3"><small>Outlet</small><h2>${R0.vis} dikunjungi</h2><small>${R0.nOut} transaksi${R0.noo ? ' · ' + R0.noo + ' baru' : ''}</small></div></div>
<div class="cd"><div class="row" style="margin:0"><h3 style="margin:0">🚚 Stok di mobil</h3><small class="mu">${nV} unit · ${rp(vV)}</small></div>
${V0.map((x) => `<div class="row kvrow"><span><b>${esc(x.p.n)}</b><br><small class="mu">${x.p.kd ? esc(x.p.kd) + ' · ' : ''}${rp(x.p.pr)}</small></span><b>${x.q.toLocaleString('id-ID')} ${esc(x.p.u || '')}</b></div>`).join('') || '<small class="mu">Mobil kosong. Muat barang dari gudang dulu.</small>'}
${KVD ? '' : `<div class="wrap" style="margin-top:10px"><button class="gh pri" onclick="kvLoad()">＋ ${U.r == 'kanvas' ? 'Minta muat barang' : 'Muat barang'}</button>${V0.length ? '<button class="gh" onclick="kvBack()">↩️ ' + (U.r == 'kanvas' ? 'Minta balik barang' : 'Balikin barang') + '</button><button class="gh" onclick="kvBack(1)">Balikin semua sisa</button>' : ''}${U.r == 'kanvas' ? '<button class="gh" onclick="go(\'pos\')">🛒 Jual ke outlet</button><button class="gh" onclick="go(\'outlet\')">📍 Outlet</button>' : ''}</div>`}</div>
<div class="cd"><h3>📦 Rekap barang</h3><div class="ov"><table><tr><th>Produk<th class="n">Muat<th class="n">Jual<th class="n">Retur<th class="n">Balik<th class="n">Sisa</tr>${Object.entries(R0.P).map(([id, r]) => { const p = prod(id); return p ? `<tr><td>${esc(p.n)}<td class="n">${r.muat}<td class="n"><b>${r.jual}</b><td class="n">${r.retur || 0}<td class="n">${r.balik}<td class="n">${vanQ(u, id)}</tr>` : ''; }).join('') || '<tr><td colspan="6" class="mu">Belum ada pergerakan barang.</td></tr>'}</table></div></div>
<div class="cd"><h3>🧾 Nota hari ini</h3>${R0.sales.map((s) => `<div class="row"><span><b>${esc(s.cn || 'Umum')}</b><br><small class="mu">${hm(s.t)} · ${esc(s.pay == 'Piutang' ? 'Kredit' : s.pay)}</small></span><b>${rp(s.tot)}</b></div>`).join('') || '<small class="mu">Belum ada penjualan.</small>'}</div>
${KVD ? '' : `<button class="pr" style="margin-bottom:12px" onclick="kvSetor()">✅ Selesai hari ini — setor & kirim rekap</button>`}
<div class="cd"><h3>🕘 Riwayat muat & balik</h3>${(S.kvq || []).filter((q) => q.u == u && (q.st == 'ditolak' || q.st == 'batal') && q.t >= d0 && q.t < d0 + 864e5).map((q) => `<div class="row"><span><b class="rd">${q.st == 'ditolak' ? '✕ Ditolak' : 'Dibatalkan'}</b> · ${q.op} · ${hm(q.t)}<br><small class="mu">${kvL(q.L)}${q.why ? ' · ' + esc(q.why) : ''}</small></span></div>`).join('')}${R0.mv.slice().reverse().map((x) => `<div class="row"><span><b>${x.k == 'muat' ? '🚚 Muat' : '↩️ Balik'}</b> · ${hm(x.t)}<br><small class="mu">${x.L.map((i) => esc((prod(i.id) || { n: '?' }).n) + ' ' + i.q).join(', ')}${x.oleh != x.u ? ' · disetujui ' + esc(x.oleh) : ''}</small></span></div>`).join('') || '<small class="mu">Belum ada.</small>'}</div>`;
};
// kartu ringkas di beranda kanvas
function kvMini() { if (U.r != 'kanvas') return ''; const V0 = vanList(U.n), R0 = kvRekap(U.n, kvSod(Date.now())); return `<button class="cd kioshead" style="width:100%;text-align:left;cursor:pointer" onclick="go('kanvas')"><div class="row" style="margin:0"><b>🚚 Kanvas hari ini</b><b>${rp(R0.omz)}</b></div><small class="mu">${V0.reduce((a, x) => a + x.q, 0)} unit di mobil · ${R0.sales.length} nota · setor tunai ${rp(R0.M.Tunai)}</small></button>`; }
