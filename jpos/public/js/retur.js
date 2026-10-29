'use strict';
/* ============ RETUR BARANG DARI OUTLET (expired · rusak / bad stock · kelebihan order) ============
   Setiap barang yang diretur dicek ke riwayat pengiriman ke outlet tersebut: pernah dikirim atau tidak,
   kapan (bulan & tanggal), faktur mana, dan sales siapa yang membuat ordernya. */
const RWHY = { exp: ['⏳', 'Expired / kedaluwarsa', '#ef4444'], rusak: ['💥', 'Rusak / bad stock', '#f97316'], lebih: ['📦', 'Kelebihan order', '#3b82f6'] };
const RTO = { tab: 'baru', cu: '', L: [], q: '', m: 'Potong tagihan', note: '', ph: null, mon: '', why: '' };
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const blnTxt = (t) => { const d = new Date(t); return BLN[d.getMonth()] + ' ' + d.getFullYear(); };
const tglTxt = (t) => { const d = new Date(t); return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); };
// riwayat pengiriman satu barang ke satu outlet (terbaru dulu)
function sentHist(cu, pid) {
  const H = [];
  for (const s of S.sales) {
    if (s.cu != cu) continue; const i = s.L.find((x) => x.id == pid); if (!i) continue;
    const dl = s.dl && s.dl.log ? s.dl.log.slice().reverse().find((l) => l.st == 'selesai') : null;
    H.push({ s, no: s.no, t: s.t, u: s.u, q: i.q, rq: i.rq || 0, sisa: i.q - (i.rq || 0), p: i.p, kirim: !!s.kirim, tiba: dl ? dl.t : null, by: dl ? dl.u : null, gagal: s.dl && s.dl.st == 'gagal' });
  }
  return H.sort((a, b) => b.t - a.t);
}
function rtrAnalisa(cu, pid, q) {
  const H = sentHist(cu, pid), sent = H.reduce((a, h) => a + h.q, 0), ret = H.reduce((a, h) => a + h.rq, 0), avail = sent - ret;
  return { H, sent, ret, avail, ok: H.length > 0 && q <= avail, never: !H.length, over: H.length > 0 && q > avail };
}
// bagi qty retur ke faktur-faktur asal (faktur terbaru dulu)
function rtrAlloc(cu, pid, q) { const out = []; for (const h of sentHist(cu, pid)) { if (q <= 0) break; const k = Math.min(q, h.sisa); if (k > 0) { out.push({ no: h.no, q: k, h }); q -= k; } } return out; }

VW.retur = () => {
  const tabs = `<div class="seg"><button class="${RTO.tab == 'baru' ? 'a' : ''}" onclick="RTO.tab='baru';R()">↩️ Buat retur</button><button class="${RTO.tab == 'ana' ? 'a' : ''}" onclick="RTO.tab='ana';R()">📊 Analisa retur</button></div>`;
  return tabs + (RTO.tab == 'ana' ? rtrAnaView() : rtrNewView());
};
function rtrNewView() {
  const outs = S.c.filter((c) => !c.x).sort((a, b) => a.n.localeCompare(b.n)), c = cust(RTO.cu);
  let h = `<div class="cd"><h3>1. Pilih outlet</h3><select onchange="RTO.cu=this.value;RTO.L=[];R()"><option value="">— pilih outlet yang mengembalikan barang —</option>${outs.map((o) => `<option value="${esc(o.id)}" ${o.id == RTO.cu ? 'selected' : ''}>${esc(o.n)}${o.kd ? ' · ' + esc(o.kd) : ''}</option>`).join('')}</select>${c ? `<small class="mu">${esc(c.ad || '')} · piutang berjalan ${rp(outOf(c.id))}</small>` : ''}</div>`;
  if (!c) return h + `<div class="cd info"><small>Retur dipakai untuk barang <b>expired</b>, <b>rusak / bad stock</b>, atau <b>kelebihan order</b> yang dikembalikan outlet. Setiap barang dicek otomatis: pernah dikirim ke outlet ini atau tidak, kapan, dan oleh sales siapa.</small></div>`;
  const sentIds = [...new Set(S.sales.filter((s) => s.cu == c.id).flatMap((s) => s.L.map((i) => i.id)))];
  const t = RTO.q.toLowerCase(), cand = t ? S.p.filter((p) => (p.n + ' ' + (p.kd || '') + ' ' + (p.sku || '')).toLowerCase().includes(t)).slice(0, 10) : sentIds.map(prod).filter(Boolean).slice(0, 12);
  h += `<div class="cd"><h3>2. Barang yang dikembalikan</h3><input placeholder="Cari nama / kode item / barcode" value="${esc(RTO.q)}" oninput="RTO.q=this.value;clearTimeout(RTO.tm);RTO.tm=setTimeout(R,250)"><small class="mu">${t ? 'Hasil pencarian' : 'Barang yang pernah dikirim ke outlet ini'} — ketuk untuk menambah</small><div class="wrap" style="margin-top:6px">${cand.map((p) => `<button class="gh" onclick="rtrAdd('${esc(p.id)}')">${sentIds.includes(p.id) ? '' : '⚠ '}${esc(p.n)}${p.kd ? ' <small class="kd">' + esc(p.kd) + '</small>' : ''}</button>`).join('') || '<small class="mu">Belum ada barang yang pernah dikirim ke outlet ini.</small>'}</div></div>`;
  if (RTO.L.length) {
    let okAll = true;
    h += `<div class="cd"><h3>3. Jumlah, alasan & hasil analisa</h3>${RTO.L.map((l, n) => {
      const p = prod(l.id) || {}, A = rtrAnalisa(c.id, l.id, l.q); if (!A.ok) okAll = false;
      const st = A.never ? `<div class="warnbox">⛔ <b>Tidak pernah dikirim ke outlet ini.</b> Tidak ada faktur ${esc(c.n)} yang berisi ${esc(p.n)}. Retur ditolak — periksa kemungkinan barang dari distributor lain.</div>`
        : A.over ? `<div class="warnbox">⛔ Jumlah retur ${l.q} melebihi yang pernah dikirim. Dikirim ${A.sent}, sudah diretur ${A.ret}, maksimal bisa diretur <b>${A.avail}</b>.</div>`
        : `<div class="okbox" style="text-align:left;font-weight:500">✅ Pernah dikirim <b>${A.H.length}×</b> (total ${A.sent} ${esc(p.u || 'pcs')}${A.ret ? ', sudah diretur ' + A.ret : ''}). Retur ini diambil dari faktur: ${rtrAlloc(c.id, l.id, l.q).map((a) => `<b>${esc(a.no)}</b> (${a.q})`).join(', ')}</div>`;
      return `<div style="border:1px solid var(--bd);border-radius:14px;padding:10px;margin-bottom:10px"><div class="row" style="margin:0"><b>${esc(p.n)}${p.kd ? ' <small class="kd">' + esc(p.kd) + '</small>' : ''}</b><button class="gh d" onclick="RTO.L.splice(${n},1);R()">✕</button></div>
<div class="fm2" style="margin:6px 0"><label><small class="mu">Jumlah (${esc(p.u || 'pcs')})</small><input type="number" min="1" value="${l.q}" onchange="RTO.L[${n}].q=Math.max(1,num(this.value));R()"></label><label><small class="mu">Alasan</small><select onchange="RTO.L[${n}].why=this.value;R()">${Object.entries(RWHY).map(([k, v]) => `<option value="${k}" ${l.why == k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label></div>
${st}${A.H.length ? `<details style="margin-top:6px"><summary><small>📜 Riwayat pengiriman ${esc(p.n)} ke ${esc(c.n)} (${A.H.length} faktur)</small></summary><div class="ov"><table><tr><th>Bulan<th>Tanggal<th>Faktur<th>Sales<th class="n">Qty<th class="n">Diretur</tr>${A.H.map((x) => `<tr><td>${blnTxt(x.t)}<td>${tglTxt(x.t)}${x.tiba ? '<br><small class="mu">tiba ' + dstr(x.tiba) + (x.by ? ' · ' + esc(x.by) : '') + '</small>' : ''}<td>${esc(x.no)}<td><b>${esc(x.u)}</b><td class="n">${x.q}<td class="n">${x.rq || '-'}</tr>`).join('')}</table></div></details>` : ''}
<small class="mu">${l.why == 'lebih' ? '📦 Kelebihan order: barang kembali ke stok jual.' : '🗑️ Expired / rusak: barang TIDAK kembali ke stok jual; dicatat sebagai beban barang rusak.'}</small></div>`;
    }).join('')}
<label><small class="mu">Pengembalian dana</small><select onchange="RTO.m=this.value">${['Potong tagihan', 'Tunai', 'Transfer'].map((m) => `<option ${RTO.m == m ? 'selected' : ''}>${m}</option>`).join('')}</select></label><small class="mu">Faktur kredit yang belum lunas otomatis dipotong tagihannya; sisanya dikembalikan dengan cara di atas.</small>
<input placeholder="Catatan (opsional)" value="${esc(RTO.note)}" onchange="RTO.note=this.value" style="margin-top:6px">
<button class="gh" style="margin-top:6px" onclick="rtrPhoto()">📸 ${RTO.ph ? 'Foto bukti ✓ (ulang)' : 'Foto bukti barang retur (disarankan)'}</button>
<button class="pr" style="margin-top:8px" ${okAll ? '' : 'disabled'} onclick="rtrSave()">✓ Simpan retur</button>${okAll ? '' : '<small class="rd">Perbaiki barang yang ditandai ⛔ dulu.</small>'}</div>`;
  }
  return h;
}
function rtrAdd(id) { if (RTO.L.some((l) => l.id == id)) return toast('Sudah ada di daftar'); RTO.L.push({ id, q: 1, why: 'exp' }); RTO.q = ''; R(); }
async function rtrPhoto() { const ph = await selfie(U.n + ' · retur · ' + tstr(Date.now()), 'environment'); if (ph) { RTO.ph = ph; R(); } }
function rtrSave() {
  const c = cust(RTO.cu); if (!c || !RTO.L.length) return;
  for (const l of RTO.L) { const A = rtrAnalisa(c.id, l.id, l.q); if (!A.ok) return toast('Ada barang yang tidak valid'); }
  const grp = 'rt' + uid(), ev = {}; // gabungkan per faktur + alasan
  for (const l of RTO.L) for (const a of rtrAlloc(c.id, l.id, l.q)) { const k = a.no + '|' + l.why; (ev[k] = ev[k] || { sale: a.no, why: l.why, L: [] }).L.push({ id: l.id, q: a.q }); }
  let n = 0; for (const k in ev) { const x = ev[k]; emit('retur', { sale: x.sale, L: x.L, m: RTO.m == 'Potong tagihan' ? 'Tunai' : RTO.m, why: x.why, bad: x.why != 'lebih' ? 1 : undefined, note: RTO.note || undefined, ph: n == 0 ? RTO.ph || undefined : undefined, grp, cu: c.id }); n++; }
  const recs = (S.rtr || []).filter((r) => r.grp == grp);
  Object.assign(RTO, { L: [], note: '', ph: null, q: '' }); toast('Retur disimpan (' + n + ' faktur asal)'); R(); rtrResult(recs);
}
function rtrResult(recs) {
  if (!recs.length) return;
  const m = modal(`<h3>↩️ Retur tersimpan · ${esc(recs[0].cn || '')}</h3><small class="mu">Asal barang yang diretur:</small><div class="ov"><table><tr><th>Barang<th>Alasan<th>Dikirim<th>Sales<th class="n">Qty</tr>${recs.flatMap((r) => r.L.map((l) => `<tr><td>${esc(l.n)}<td>${RWHY[r.why] ? RWHY[r.why][0] + ' ' + RWHY[r.why][1] : '-'}<td>${tglTxt(r.st)}<br><small class="mu">${esc(r.sale)}</small><td><b>${esc(r.su)}</b><td class="n">${l.q}</tr>`)).join('')}</table></div>${row('Nilai retur', '<b>' + rp(recs.reduce((a, r) => a + r.val, 0)) + '</b>')}<button class="gh" id="pp">🖨️ Cetak bukti retur</button><button class="pr" id="ok">Selesai</button>`);
  $('#ok', m).onclick = () => m.close(); $('#pp', m).onclick = () => rtrPrint(recs);
}
function rtrPrint(recs) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A5;margin:10mm}body{font:10pt Arial,sans-serif}td,th{border-bottom:1px solid #ccc;padding:3px 5px;text-align:left}table{border-collapse:collapse;width:100%}h2{margin:0}</style></head><body><h2>BUKTI RETUR BARANG</h2><b>${esc(S.name || '')}</b><br>Outlet: <b>${esc(recs[0].cn || '')}</b> · Tanggal: ${tstr(recs[0].t)} · Petugas: ${esc(recs[0].u)}<br><br><table><tr><th>Barang</th><th>Alasan</th><th>Faktur asal</th><th>Tgl kirim</th><th>Sales</th><th>Qty</th></tr>${recs.flatMap((r) => r.L.map((l) => `<tr><td>${esc(l.n)}</td><td>${RWHY[r.why] ? RWHY[r.why][1] : ''}</td><td>${esc(r.sale)}</td><td>${dstr(r.st)}</td><td>${esc(r.su)}</td><td>${l.q}</td></tr>`)).join('')}</table><p>Nilai retur: <b>${rp(recs.reduce((a, r) => a + r.val, 0))}</b></p><br><table><tr><td style="border:0;text-align:center">Outlet,<br><br><br>(..............)</td><td style="border:0;text-align:center">Petugas,<br><br><br>(${esc(recs[0].u)})</td></tr></table></body></html>`;
  if (sysPrint()) printHtml(html); else shareText('Bukti retur', recs.flatMap((r) => r.L.map((l) => `${l.n} ×${l.q} · ${RWHY[r.why] ? RWHY[r.why][1] : ''} · faktur ${r.sale} (${dstr(r.st)}, sales ${r.su})`)).join('\n'));
}
/* ---------- analisa retur ---------- */
function rtrAnaView() {
  const all = (S.rtr || []).filter((r) => (!RTO.mon || dkey(r.t).slice(0, 7) == RTO.mon) && (!RTO.why || r.why == RTO.why)), mons = [...new Set((S.rtr || []).map((r) => dkey(r.t).slice(0, 7)))].sort().reverse();
  const rows = all.flatMap((r) => r.L.map((l) => ({ ...r, l })));
  const by = (f) => { const o = {}; for (const r of all) { const k = f(r); (o[k] = o[k] || { n: 0, v: 0, q: 0 }); o[k].n++; o[k].v += r.val; o[k].q += r.L.reduce((a, l) => a + l.q, 0); } return Object.entries(o).sort((a, b) => b[1].v - a[1].v); };
  const tot = all.reduce((a, r) => a + r.val, 0);
  const tbl = (title, L, lab) => `<div class="cd"><h3>${title}</h3>${L.length ? `<table><tr><th>${lab}<th class="n">Retur<th class="n">Unit<th class="n">Nilai</tr>${L.map(([k, v]) => `<tr><td>${esc(k)}<td class="n">${v.n}<td class="n">${v.q}<td class="n">${rp(v.v)}</tr>`).join('')}</table>` : '<p class="mu">Belum ada data</p>'}</div>`;
  return `<div class="cd"><div class="fm2"><select onchange="RTO.mon=this.value;R()"><option value="">Semua bulan</option>${mons.map((m) => `<option value="${m}" ${RTO.mon == m ? 'selected' : ''}>${blnTxt(new Date(m + '-15').getTime())}</option>`).join('')}</select><select onchange="RTO.why=this.value;R()"><option value="">Semua alasan</option>${Object.entries(RWHY).map(([k, v]) => `<option value="${k}" ${RTO.why == k ? 'selected' : ''}>${v[1]}</option>`).join('')}</select></div></div>
${kpi([['Total retur', rp(tot)], ['Jumlah retur', all.length], ['Unit', rows.reduce((a, r) => a + r.l.q, 0)]])}
${tbl('👤 Per sales yang membuat order asal', by((r) => r.su), 'Sales')}
${tbl('📍 Per outlet', by((r) => r.cn || '-'), 'Outlet')}
${tbl('🏷️ Per alasan', by((r) => (RWHY[r.why] || ['', 'Lainnya'])[1]), 'Alasan')}
<div class="cd"><h3>📜 Rincian: barang diretur & asal pengirimannya</h3><div class="ov"><table><tr><th>Tgl retur<th>Outlet<th>Barang<th>Alasan<th>Dikirim (bulan / tgl)<th>Faktur<th>Sales<th class="n">Qty</tr>${rows.slice().reverse().map((r) => `<tr><td>${dstr(r.t)}<td>${esc(r.cn || '-')}<td>${esc(r.l.n)}<td>${RWHY[r.why] ? RWHY[r.why][0] + ' ' + RWHY[r.why][1] : '-'}<td>${blnTxt(r.st)}<br><small>${tglTxt(r.st)}</small><td>${esc(r.sale)}<td><b>${esc(r.su)}</b><td class="n">${r.l.q}</tr>`).join('') || '<tr><td colspan="8" class="mu">Belum ada retur</tr>'}</table></div>${rows.length && window.XLSX ? '<button class="gh" style="margin-top:8px" onclick="rtrXls()">⬇ Excel</button>' : ''}</div>`;
}
function rtrXls() {
  const rows = [['Tanggal retur', 'Outlet', 'Barang', 'Alasan', 'Bulan kirim', 'Tanggal kirim', 'Faktur asal', 'Sales', 'Qty', 'Nilai faktur retur']];
  for (const r of S.rtr || []) for (const l of r.L) rows.push([dstr(r.t), r.cn || '', l.n, (RWHY[r.why] || ['', ''])[1], blnTxt(r.st), dstr(r.st), r.sale, r.su, l.q, r.val]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Retur'); saveFile('retur-' + FNAME(S.name) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
}
