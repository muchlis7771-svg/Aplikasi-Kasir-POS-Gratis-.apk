'use strict';
/* ============ RETUR BARANG DARI OUTLET (expired · rusak / bad stock · kelebihan order) ============
   Setiap barang yang diretur dicek ke riwayat pengiriman ke outlet tersebut: pernah dikirim atau tidak,
   kapan (bulan & tanggal), faktur mana, dan sales siapa yang membuat ordernya. */
// [ikon, label, warna, layak jual?]
const RWHY = { exp: ['⏳', 'Expired / kedaluwarsa', '#ef4444', 0], rusak: ['💥', 'Rusak / cacat', '#f97316', 0], kemasan: ['📦', 'Kemasan rusak', '#f59e0b', 0], lebih: ['➕', 'Kelebihan order (barang bagus)', '#3b82f6', 1], bagus: ['✅', 'Barang bagus / salah order', '#10b981', 1] };
const rGood = (w) => !!(RWHY[w] && RWHY[w][3]);
const RTO = { bq: '', tab: 'baru', cu: '', L: [], q: '', m: 'Potong tagihan', note: '', ph: null, mon: '', why: '' };
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
  const tabs = `<div class="seg"><button class="${RTO.tab == 'baru' ? 'a' : ''}" onclick="RTO.tab='baru';R()">↩️ Buat retur</button><button class="${RTO.tab == 'ana' ? 'a' : ''}" onclick="RTO.tab='ana';R()">📊 Analisa</button>${['owner', 'admin'].includes(U.r) ? `<button class="${RTO.tab == 'bad' ? 'a' : ''}" onclick="RTO.tab='bad';R()">🗑️ Bad stock</button>` : ''}</div>`;
  return tabs + (RTO.tab == 'ana' ? rtrAnaView() : RTO.tab == 'bad' && ['owner', 'admin'].includes(U.r) ? badView() : rtrNewView());
};
function rtrNewView() {
  const outs = S.c.filter((c) => !c.x).sort((a, b) => a.n.localeCompare(b.n)), c = cust(RTO.cu);
  let h = `<div class="cd"><h3>1. Pilih outlet</h3><select onchange="RTO.cu=this.value;RTO.L=[];R()"><option value="">— pilih outlet yang mengembalikan barang —</option>${outs.map((o) => `<option value="${esc(o.id)}" ${o.id == RTO.cu ? 'selected' : ''}>${esc(o.n)}${o.kd ? ' · ' + esc(o.kd) : ''}</option>`).join('')}</select>${c ? `<small class="mu">${esc(c.ad || '')} · piutang berjalan ${rp(outOf(c.id))}</small>` + outletHist(c) : ''}</div>`;
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
<div class="chip ${rGood(l.why) ? 'g' : 'r'}" style="margin-top:6px">${rGood(l.why) ? '✅ Masuk STOK LAYAK JUAL (good stock)' : '🗑️ Masuk BAD STOCK — tidak bisa dijual, menunggu pemusnahan'}</div></div>`;
    }).join('')}
<label><small class="mu">Pengembalian dana</small><select onchange="RTO.m=this.value">${['Potong tagihan', 'Tunai', 'Transfer'].map((m) => `<option ${RTO.m == m ? 'selected' : ''}>${m}</option>`).join('')}</select></label><small class="mu">Faktur kredit yang belum lunas otomatis dipotong tagihannya; sisanya dikembalikan dengan cara di atas.</small>
<input placeholder="Catatan (opsional)" value="${esc(RTO.note)}" onchange="RTO.note=this.value" style="margin-top:6px">
<div class="cd" style="margin:8px 0 0;padding:10px;background:var(--bg)"><b>✍️ Tanda tangan outlet${sigNeed() ? ' <span class="rd">*</span>' : ''}</b><small class="mu" style="display:block">Pemilik / penjaga outlet menandatangani sebagai bukti barang sudah diambil. Foto barang diambil otomatis saat simpan.</small>
<input id="rsn" placeholder="Nama penanda tangan di outlet" value="${esc(RTO.sn || '')}" oninput="RTO.sn=this.value" style="margin:6px 0">
<canvas id="sigc" class="sigc" width="600" height="220"></canvas><div class="row" style="margin:4px 0 0"><small class="mu" id="sigh">${RTO.sig ? '✓ Sudah ditandatangani' : 'Tanda tangan dengan jari di kotak'}</small><button class="gh" onclick="RTO.sig=null;sigInit(1)">Hapus</button></div></div>
<button class="pr" style="margin-top:8px" ${okAll ? '' : 'disabled'} onclick="rtrSave()">✓ Simpan retur</button>${okAll ? '' : '<small class="rd">Perbaiki barang yang ditandai ⛔ dulu.</small>'}</div>`;
  }
  return h;
}
const sigNeed = () => ['sales', 'dropping'].includes(U.r) || S.set.rsig === true;
/* ---------- tanda tangan digital ---------- */
function sigInit(clear) {
  const c = $('#sigc'); if (!c) return; const x = c.getContext('2d'); x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111';
  if (clear || !RTO.sig) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#c7c9d1'; x.font = '22px sans-serif'; x.fillText('tanda tangan di sini', 190, 120); c.dataset.blank = '1'; if (clear) { const h = $('#sigh'); if (h) h.textContent = 'Tanda tangan dengan jari di kotak'; } }
  else { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, c.width, c.height); im.src = RTO.sig; c.dataset.blank = '0'; }
  let dn = false, last = null; const pt = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = (e) => { e.preventDefault(); c.setPointerCapture && c.setPointerCapture(e.pointerId); if (c.dataset.blank == '1') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); c.dataset.blank = '0'; } dn = true; last = pt(e); x.beginPath(); x.arc(last[0], last[1], 2, 0, 7); x.fillStyle = '#111'; x.fill(); };
  c.onpointermove = (e) => { if (!dn) return; e.preventDefault(); const p = pt(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(p[0], p[1]); x.stroke(); last = p; };
  c.onpointerup = c.onpointercancel = () => { if (!dn) return; dn = false; RTO.sig = c.toDataURL('image/jpeg', 0.6); const h = $('#sigh'); if (h) h.textContent = '✓ Sudah ditandatangani'; };
}
VW.retur.after = () => sigInit();
/* ---------- foto otomatis (kamera belakang, tanpa tombol) ---------- */
async function autoShot(label) {
  const ov = document.createElement('div'); ov.className = 'autoshot'; ov.innerHTML = '<video playsinline muted></video><b>📸 Mengambil foto otomatis… arahkan ke barang retur</b>'; document.body.appendChild(ov);
  let st = null;
  try {
    st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); await camTune(st);
    const v = $('video', ov); v.srcObject = st; await v.play();
    for (let i = 0; i < 40 && !v.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 650)); // beri waktu fokus & cahaya
    const shot = camSnap(v, label, 1280, 135000);
    ov.classList.add('flash'); try { navigator.vibrate && navigator.vibrate(40); } catch (e) { }
    await new Promise((r) => setTimeout(r, 180));
    return shot;
  } catch (e) { toast('Kamera tidak bisa dibuka: ' + (e.message || e), 4000); return null; }
  finally { if (st) st.getTracks().forEach((t) => t.stop()); ov.remove(); }
}
function rtrAdd(id) { if (RTO.L.some((l) => l.id == id)) return toast('Sudah ada di daftar'); RTO.L.push({ id, q: 1, why: 'exp' }); RTO.q = ''; R(); }
async function rtrPhoto() { const ph = await selfie(U.n + ' · retur · ' + tstr(Date.now()), 'environment'); if (ph) { RTO.ph = ph; R(); } }
async function rtrSave() {
  const c = cust(RTO.cu); if (!c || !RTO.L.length) return;
  for (const l of RTO.L) { const A = rtrAnalisa(c.id, l.id, l.q); if (!A.ok) return toast('Ada barang yang tidak valid'); }
  if (sigNeed() && !RTO.sig) return toast('Minta outlet menandatangani dulu di kotak tanda tangan');
  if (sigNeed() && !(RTO.sn || '').trim()) return toast('Isi nama penanda tangan di outlet');
  const stamp = 'RETUR · ' + c.n + ' · ' + U.n + ' · ' + tstr((typeof trustNow == 'function' && trustNow()) || Date.now());
  const [ph, pos] = await Promise.all([RTO.ph ? Promise.resolve(RTO.ph) : autoShot(stamp), getPos(true).catch(() => null)]);
  if (!ph && sigNeed()) return toast('Foto bukti wajib — izinkan kamera lalu simpan lagi'); RTO.ph = ph;
  const dist = pos && c.lat != null ? Math.round(haversine(pos.lat, pos.lng, c.lat, c.lng)) : null;
  const grp = 'rt' + uid(), ev = {}; // gabungkan per faktur + alasan
  for (const l of RTO.L) for (const a of rtrAlloc(c.id, l.id, l.q)) { const k = a.no + '|' + l.why; (ev[k] = ev[k] || { sale: a.no, why: l.why, L: [] }).L.push({ id: l.id, q: a.q }); }
  let n = 0; for (const k in ev) { const x = ev[k]; emit('retur', { sale: x.sale, L: x.L, m: RTO.m == 'Potong tagihan' ? 'Tunai' : RTO.m, why: x.why, bad: rGood(x.why) ? undefined : 1, note: RTO.note || undefined, ph: n == 0 ? RTO.ph || undefined : undefined, sig: n == 0 ? RTO.sig || undefined : undefined, sn: (RTO.sn || '').trim() || undefined, lat: pos ? +pos.lat.toFixed(6) : undefined, lng: pos ? +pos.lng.toFixed(6) : undefined, dist: dist ?? undefined, grp, cu: c.id }); n++; }
  const recs = (S.rtr || []).filter((r) => r.grp == grp);
  Object.assign(RTO, { L: [], note: '', ph: null, q: '', sig: null, sn: '' }); toast('Retur disimpan (' + n + ' faktur asal)'); R(); rtrResult(recs);
}
function rtrResult(recs) {
  if (!recs.length) return;
  const m = modal(`<h3>↩️ Retur tersimpan · ${esc(recs[0].cn || '')}</h3><small class="mu">Asal barang yang diretur:</small><div class="ov"><table><tr><th>Barang<th>Alasan<th>Dikirim<th>Sales<th class="n">Qty</tr>${recs.flatMap((r) => r.L.map((l) => `<tr><td>${esc(l.n)}<td>${RWHY[r.why] ? RWHY[r.why][0] + ' ' + RWHY[r.why][1] : '-'}<td>${tglTxt(r.st)}<br><small class="mu">${esc(r.sale)}</small><td><b>${esc(r.su)}</b><td class="n">${l.q}</tr>`)).join('')}</table></div>${row('Nilai retur', '<b>' + rp(recs.reduce((a, r) => a + r.val, 0)) + '</b>')}${recs[0].ph || recs[0].sig ? `<div class="row" style="gap:8px;align-items:flex-start">${recs[0].ph ? `<figure style="margin:0;flex:1"><img src="${recs[0].ph}" style="width:100%;border-radius:10px"><figcaption><small class="mu">📸 Foto otomatis</small></figcaption></figure>` : ''}${recs[0].sig ? `<figure style="margin:0;flex:1"><img src="${recs[0].sig}" style="width:100%;border-radius:10px;border:1px solid var(--bd)"><figcaption><small class="mu">✍️ ${esc(recs[0].sn || 'Outlet')}</small></figcaption></figure>` : ''}</div>` : ''}<button class="gh" id="pp">🖨️ Cetak / kirim bukti retur</button><button class="pr" id="ok">Selesai</button>`);
  $('#ok', m).onclick = () => m.close(); $('#pp', m).onclick = () => rtrPrint(recs);
}
function rtrPrint(recs) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A5;margin:10mm}body{font:10pt Arial,sans-serif}td,th{border-bottom:1px solid #ccc;padding:3px 5px;text-align:left}table{border-collapse:collapse;width:100%}h2{margin:0}</style></head><body><h2>BUKTI RETUR BARANG</h2><b>${esc(S.name || '')}</b><br>Outlet: <b>${esc(recs[0].cn || '')}</b> · Tanggal: ${tstr(recs[0].t)} · Petugas: ${esc(recs[0].u)}<br><br><table><tr><th>Barang</th><th>Alasan</th><th>Faktur asal</th><th>Tgl kirim</th><th>Sales</th><th>Qty</th></tr>${recs.flatMap((r) => r.L.map((l) => `<tr><td>${esc(l.n)}</td><td>${RWHY[r.why] ? RWHY[r.why][1] : ''}</td><td>${esc(r.sale)}</td><td>${dstr(r.st)}</td><td>${esc(r.su)}</td><td>${l.q}</td></tr>`)).join('')}</table><p>Nilai retur: <b>${rp(recs.reduce((a, r) => a + r.val, 0))}</b></p>${recs[0].ph ? `<p><img src="${recs[0].ph}" style="width:200px;border-radius:6px"></p>` : ''}<br><table><tr><td style="border:0;text-align:center">Outlet,<br>${recs[0].sig ? `<img src="${recs[0].sig}" style="height:60px">` : '<br><br>'}<br>(${esc(recs[0].sn || '..............')})</td><td style="border:0;text-align:center">Petugas,<br><br><br>(${esc(recs[0].u)})</td></tr></table></body></html>`;
  if (sysPrint()) return printHtml(html);
  const J = window.jspdf && window.jspdf.jsPDF; if (J) { try { const d = new J({ unit: 'mm', format: 'a5' }); let y = 14; d.setFontSize(13); d.text('BUKTI RETUR BARANG', 10, y); d.setFontSize(9); y += 6; d.text(ascii(S.name || '') + ' - ' + ascii(recs[0].cn || ''), 10, y); y += 5; d.text(ascii(tstr(recs[0].t) + ' - petugas ' + recs[0].u), 10, y); y += 7;
    recs.forEach((r) => r.L.forEach((l) => { d.text(ascii(l.n + ' x' + l.q + ' - ' + ((RWHY[r.why] || [])[1] || '') + ' - faktur ' + r.sale + ' (' + dstr(r.st) + ', ' + r.su + ')').slice(0, 95), 10, y); y += 5; }));
    y += 3; if (recs[0].ph) { d.addImage(recs[0].ph, 'JPEG', 10, y, 60, 45); } if (recs[0].sig) { d.addImage(recs[0].sig, 'JPEG', 80, y, 55, 20); d.text(ascii('(' + (recs[0].sn || 'Outlet') + ')'), 80, y + 25); }
    saveFile('Bukti-retur-' + (recs[0].cn || '').replace(/\W+/g, '-') + '.pdf', d.output('blob')); return; } catch (e) { console.warn(e); } }
  shareText('Bukti retur', recs.flatMap((r) => r.L.map((l) => `${l.n} ×${l.q} · ${RWHY[r.why] ? RWHY[r.why][1] : ''} · faktur ${r.sale} (${dstr(r.st)}, sales ${r.su})`)).join('\n'));
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
<div class="cd"><h3>📜 Rincian: barang diretur & asal pengirimannya</h3><div class="ov"><table><tr><th>Tgl retur<th>Outlet<th>Barang<th>Alasan<th>Dikirim (bulan / tgl)<th>Faktur<th>Sales<th class="n">Qty</tr>${rows.slice().reverse().map((r) => `<tr><td>${dstr(r.t)}<td>${esc(r.cn || '-')}<td>${esc(r.l.n)}<td>${RWHY[r.why] ? RWHY[r.why][0] + ' ' + RWHY[r.why][1] : '-'}<td>${blnTxt(r.st)}<br><small>${tglTxt(r.st)}</small><td>${esc(r.sale)}<td><b>${esc(r.su)}</b><br><small class="mu">diambil ${esc(r.u)}${r.sn ? ' · ttd ' + esc(r.sn) : ''}</small>${(S.rtr || []).some((x) => x.grp == r.grp && (x.ph || x.sig)) ? ` <button class="gh" style="padding:2px 6px" onclick="rtrResult((S.rtr||[]).filter((x)=>x.grp=='${esc(r.grp)}'))">📸✍️</button>` : ''}<td class="n">${r.l.q}</tr>`).join('') || '<tr><td colspan="8" class="mu">Belum ada retur</tr>'}</table></div>${rows.length && window.XLSX ? '<button class="gh" style="margin-top:8px" onclick="rtrXls()">⬇ Excel</button>' : ''}</div>`;
}
function rtrXls() {
  const rows = [['Tanggal retur', 'Outlet', 'Barang', 'Alasan', 'Bulan kirim', 'Tanggal kirim', 'Faktur asal', 'Sales', 'Qty', 'Nilai faktur retur']];
  for (const r of S.rtr || []) for (const l of r.L) rows.push([dstr(r.t), r.cn || '', l.n, (RWHY[r.why] || ['', ''])[1], blnTxt(r.st), dstr(r.st), r.sale, r.su, l.q, r.val]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Retur'); saveFile('retur-' + FNAME(S.name) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
}

/* ---------- riwayat order outlet di distributor kita (cegah retur barang dari supplier lain) ---------- */
function outletHist(c) {
  const L = S.sales.filter((s) => s.cu == c.id).sort((a, b) => a.t - b.t);
  if (!L.length) return `<div class="warnbox" style="margin-top:8px">⛔ <b>Outlet ini belum pernah order di distributor kita.</b> Semua retur dari outlet ini akan ditolak — kemungkinan barang berasal dari supplier lain.</div>`;
  const bySl = {}; L.forEach((s) => { const k = s.u; (bySl[k] = bySl[k] || { n: 0, v: 0, last: 0 }); bySl[k].n++; bySl[k].v += s.tot; bySl[k].last = Math.max(bySl[k].last, s.t); });
  const items = new Set(L.flatMap((s) => s.L.map((i) => i.id))).size;
  return `<div class="okbox" style="text-align:left;font-weight:500;margin-top:8px">✅ <b>Pelanggan kita</b> sejak ${tglTxt(L[0].t)} · ${L.length} faktur · ${items} jenis barang · terakhir order ${tglTxt(L[L.length - 1].t)}${c.sl ? '<br>Sales penanggung jawab: <b>' + esc(c.sl) + '</b>' : ''}</div><details style="margin-top:6px"><summary><small>👤 Sales yang pernah mengambil order di outlet ini</small></summary><table><tr><th>Sales<th class="n">Faktur<th class="n">Nilai<th>Terakhir</tr>${Object.entries(bySl).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<tr><td><b>${esc(k)}</b><td class="n">${v.n}<td class="n">${rp(v.v)}<td>${dstr(v.last)}</tr>`).join('')}</table></details>`;
}
/* ---------- BAD STOCK & PEMUSNAHAN (pemilik / admin) ---------- */
function badView() {
  const B = S.p.filter((p) => p.bad > 0), log = (S.bst || []).slice().reverse().slice(0, 40), t = RTO.bq.toLowerCase();
  const cand = t ? actProds().filter((p) => (p.n + ' ' + (p.kd || '') + ' ' + (p.sku || '')).toLowerCase().includes(t)).slice(0, 8) : [];
  return `${kpi([['Bad stock', badUnits() + ' unit'], ['Nilai bad stock', rp(badValue())], ['Stok layak jual', rp(stockValue())]])}
<div class="cd"><h3>🗑️ Daftar bad stock</h3><small class="mu">Barang expired / rusak hasil retur atau yang dipindah dari gudang. Tidak ikut stok jual. Musnahkan, atau kembalikan ke layak jual setelah disortir.</small>
${B.length ? `<div class="ov"><table><tr><th>Barang<th class="n">Bad<th class="n">Nilai<th></tr>${B.map((p) => `<tr><td><b>${esc(p.n)}</b>${p.kd ? '<br><small class="kd">' + esc(p.kd) + '</small>' : ''}<td class="n rd"><b>${p.bad}</b><td class="n">${rp(p.bv || p.bad * p.co)}<td><button class="gh d" onclick="bstForm('${esc(p.id)}','musnah','bad')">🔥 Musnahkan</button> <button class="gh" onclick="bstForm('${esc(p.id)}','layak','bad')">↺ Layak jual</button></tr>`).join('')}</table></div>` : '<p class="mu">Tidak ada bad stock 👍</p>'}</div>
<div class="cd"><h3>➡️ Pindahkan stok gudang ke bad stock / musnahkan</h3><small class="mu">Untuk barang rusak / expired yang ditemukan di gudang (bukan dari retur).</small><input placeholder="Cari nama / kode item" value="${esc(RTO.bq)}" oninput="RTO.bq=this.value;clearTimeout(RTO.tm);RTO.tm=setTimeout(R,250)">${cand.map((p) => `<div class="row"><span>${esc(p.n)} <small class="mu">layak jual ${p.st}</small></span><span><button class="gh" onclick="bstForm('${esc(p.id)}','pindah','good')">→ Bad stock</button> <button class="gh d" onclick="bstForm('${esc(p.id)}','musnah','good')">🔥 Musnahkan</button></span></div>`).join('')}</div>
<div class="cd"><h3>📜 Riwayat bad stock & pemusnahan</h3>${log.length ? `<div class="ov"><table><tr><th>Tanggal<th>Kejadian<th>Barang<th class="n">Qty<th class="n">Nilai<th>Oleh</tr>${log.map((b) => `<tr><td>${dstr(b.t)}<td>${{ pindah: '➡️ Ke bad stock', layak: '↺ Layak jual', musnah: '🔥 Dimusnahkan' }[b.act]}${b.why ? '<br><small class="mu">' + esc(b.why) + '</small>' : ''}<td>${esc(b.n)}<td class="n">${b.q}<td class="n">${rp(b.v)}<td>${esc(b.u)}${b.saksi ? '<br><small>saksi ' + esc(b.saksi) + '</small>' : ''}${b.act == 'musnah' ? ` <button class="gh" style="padding:3px 7px" onclick="bstBA('${esc(b.no)}')">🖨️ BA</button>` : ''}</tr>`).join('')}</table></div>` : '<p class="mu">Belum ada</p>'}</div>`;
}
function bstForm(id, act, src) {
  const p = prod(id); if (!p) return; const max = src == 'good' ? p.st : p.bad || 0, T = { musnah: '🔥 Pemusnahan barang', pindah: '➡️ Pindah ke bad stock', layak: '↺ Kembalikan ke stok layak jual' }[act];
  const m = modal(`<h3>${T}</h3><b>${esc(p.n)}</b><small class="mu">${src == 'good' ? 'Stok layak jual' : 'Bad stock'} tersedia: ${max}</small>
<label><small class="mu">Jumlah</small><input id="bq" type="number" min="1" max="${max}" value="${max}"></label>
<label><small class="mu">Alasan / keterangan</small><input id="bw" placeholder="${act == 'musnah' ? 'mis. expired Okt 2026, dibakar / dibuang' : act == 'layak' ? 'mis. hasil sortir, kemasan masih baik' : 'mis. bocor di gudang'}"></label>
${act == 'musnah' ? '<label><small class="mu">Saksi pemusnahan</small><input id="bs" placeholder="Nama saksi"></label><button class="gh" id="bp">📸 Foto bukti pemusnahan</button><img id="bi" style="display:none;width:110px;border-radius:10px">' : ''}
<small class="mu">${act == 'musnah' ? 'Stok berkurang dan nilai barang dicatat sebagai Beban Pemusnahan Barang di laporan laba rugi.' : act == 'pindah' ? 'Stok layak jual berkurang, bad stock bertambah (nilai pindah ke akun Persediaan Bad Stock).' : 'Bad stock berkurang, stok layak jual bertambah.'}</small>
<button class="pr" id="ok">Simpan</button>`);
  let ph = null; const bp = $('#bp', m); if (bp) bp.onclick = async () => { ph = await selfie(U.n + ' · pemusnahan · ' + tstr(Date.now()), 'environment'); if (ph) { const i = $('#bi', m); i.src = ph; i.style.display = 'block'; } };
  $('#ok', m).onclick = () => {
    const q = Math.round(num($('#bq', m).value)); if (!(q > 0) || q > max) return toast('Jumlah 1–' + max);
    const why = $('#bw', m).value.trim(); if (act == 'musnah' && !why) return toast('Isi alasan pemusnahan');
    const saksi = act == 'musnah' ? $('#bs', m).value.trim() : ''; if (act == 'musnah' && !saksi) return toast('Isi nama saksi');
    if (act == 'musnah' && !confirm('Musnahkan ' + q + ' ' + p.n + '? Stok akan berkurang permanen.')) return;
    emit('bst', { act, src, id, q, why, saksi: saksi || undefined, ph: ph || undefined }); m.close(); toast({ musnah: 'Barang dimusnahkan', pindah: 'Dipindah ke bad stock', layak: 'Kembali ke stok layak jual' }[act]); R();
    if (act == 'musnah') { const b = (S.bst || []).slice(-1)[0]; if (b && confirm('Cetak berita acara pemusnahan?')) bstBA(b.no); }
  };
}
function bstBA(no) {
  const b = (S.bst || []).find((x) => x.no == no); if (!b) return; const p = prod(b.id) || {};
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;line-height:1.5}td,th{border:1px solid #333;padding:5px 8px}table{border-collapse:collapse;width:100%}h2{text-align:center;margin:0 0 4px}</style></head><body><h2>BERITA ACARA PEMUSNAHAN BARANG</h2><p style="text-align:center">${esc(S.name || '')}<br>No: ${esc(b.no)}</p><p>Pada tanggal <b>${tglTxt(b.t)}</b> pukul ${hm(b.t)} telah dilakukan pemusnahan barang dengan rincian:</p><table><tr><th>Kode</th><th>Nama barang</th><th>Jumlah</th><th>Nilai (HPP)</th><th>Asal</th></tr><tr><td>${esc(p.kd || '')}</td><td>${esc(b.n)}</td><td>${b.q} ${esc(p.u || 'pcs')}</td><td>${rp(b.v)}</td><td>${b.src == 'good' ? 'Stok gudang' : 'Bad stock (retur / rusak)'}</td></tr></table><p>Alasan: ${esc(b.why || '-')}</p>${b.ph ? `<p><img src="${b.ph}" style="width:160px"></p>` : ''}<br><table style="border:0"><tr><td style="border:0;text-align:center">Pelaksana,<br><br><br><br>( ${esc(b.u)} )</td><td style="border:0;text-align:center">Saksi,<br><br><br><br>( ${esc(b.saksi || '..............')} )</td><td style="border:0;text-align:center">Mengetahui pemilik,<br><br><br><br>( .............. )</td></tr></table></body></html>`;
  if (sysPrint()) printHtml(html); else shareText('Berita acara pemusnahan', `BERITA ACARA PEMUSNAHAN\n${S.name}\n${tglTxt(b.t)} ${hm(b.t)}\n${b.n} × ${b.q} (${rp(b.v)})\nAlasan: ${b.why}\nPelaksana: ${b.u}\nSaksi: ${b.saksi || '-'}`);
}
