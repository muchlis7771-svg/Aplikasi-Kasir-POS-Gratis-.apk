'use strict';
/* ============ JARINGAN MITRA DISTRIBUTOR ============
   Toko (kios / grosir) memberi izin ke distributor untuk melihat stok, SKU fast moving, harga jual & harga beli.
   Pemilik toko memilih sendiri apa yang dibagi dan bisa mencabutnya kapan saja. */
const MSC = [['st', 'Stok'], ['fm', 'SKU fast moving (jumlah terjual)'], ['pj', 'Harga jual'], ['pb', 'Harga beli / HPP']];
let MIT = null;
async function mitLoad() { if (!S.srv || !canNet()) return; try { MIT = (await api('/api/mitra')).links; LS.set('jpos:mit:' + SID, MIT.filter((x) => x.status == 'ok').length); if (V == 'set') R(); } catch (e) { } }
const scTxt = (sc) => MSC.filter(([k]) => sc && sc[k]).map(([, n]) => n.split(' (')[0]).join(', ') || '-';
function mitraCard() {
  if (!S.srv) return '';
  if (MIT == null) { mitLoad(); return `<div class="cd"><h3>🤝 Mitra distributor</h3><small class="mu">${canNet() ? 'Memuat…' : 'Butuh internet.'}</small></div>`; }
  const req = MIT.filter((x) => x.status == 'req'), ok = MIT.filter((x) => x.status == 'ok');
  return `<div class="cd"><h3>🤝 Mitra distributor</h3><small class="mu">Izinkan distributor langganan Anda melihat stok & produk laris toko ini, agar bisa mengirim barang tepat waktu. Anda yang memilih data apa yang dibagi, dan bisa dicabut kapan saja.</small>
${req.map((x) => `<div class="warnbox" style="margin-top:8px"><b>${esc(x.name)}</b> <small>(${esc(x.dist_id)})</small> meminta akses data toko Anda.<div class="wrap" style="margin-top:6px"><button class="pr" onclick="mitForm('${esc(x.dist_id)}','${esc(x.name).replace(/'/g, '')}')">Tinjau & izinkan</button><button class="gh d" onclick="mitSet('${esc(x.dist_id)}',null,'off')">Tolak</button></div></div>`).join('')}
${ok.map((x) => `<div class="row" style="margin-top:8px;align-items:flex-start"><span><b>✅ ${esc(x.name)}</b><br><small class="mu">Melihat: ${esc(scTxt(x.scope))}</small></span><span class="wrap" style="flex-wrap:nowrap"><button class="gh" onclick="mitForm('${esc(x.dist_id)}','${esc(x.name).replace(/'/g, '')}',${JSON.stringify(x.scope).replace(/"/g, '&quot;')})">Ubah</button><button class="gh d" onclick="if(confirm('Cabut akses ${esc(x.name).replace(/'/g, '')}?'))mitSet('${esc(x.dist_id)}',null,'off')">Cabut</button></span></div>`).join('')}
<button class="gh" style="margin-top:8px" onclick="mitForm()">+ Bagikan ke distributor (pakai kode toko distributor)</button></div>`;
}
function mitForm(dist, name, sc) {
  sc = sc || { st: 1, fm: 1, pj: 1, pb: 0 };
  const m = modal(`<h3>Bagikan data ke ${name ? esc(name) : 'distributor'}</h3>${dist ? '' : '<label><small class="mu">Kode toko distributor</small><input id="mdi" autocapitalize="none" placeholder="mis. distributorabc"></label>'}
<small class="mu">Data yang boleh dilihat distributor:</small>${MSC.map(([k, n]) => `<label class="row" style="margin:6px 0"><span>${n}${k == 'pb' ? '<br><small class="or">Rahasia dagang — bagikan hanya ke distributor yang dipercaya</small>' : ''}</span><input type="checkbox" data-ms="${k}" style="width:22px;height:22px" ${sc[k] ? 'checked' : ''}></label>`).join('')}
<button class="pr" id="ok">Izinkan</button>`);
  $('#ok', m).onclick = async () => { const s = {}; $$('[data-ms]', m).forEach((c) => (s[c.dataset.ms] = c.checked ? 1 : 0)); const d = dist || $('#mdi', m).value.trim().toLowerCase(); if (!d) return toast('Isi kode toko distributor'); if (await mitSet(d, s, 'ok')) m.close(); };
}
async function mitSet(dist, scope, op) {
  if (!canNet()) { toast('Butuh internet'); return false; }
  try { MIT = (await api('/api/mitra', { method: 'POST', body: JSON.stringify({ dist, scope, op }) })).links; LS.set('jpos:mit:' + SID, MIT.filter((x) => x.status == 'ok').length); toast(op == 'off' ? 'Akses dicabut' : 'Data dibagikan — terkirim saat sinkron berikutnya'); if (op == 'ok') dsnapPost(true); R(); return true; } catch (e) { toast(e.message); return false; }
}
// data SKU toko → server (hanya bila ada mitra aktif), maks tiap 30 menit
function dsnapData() {
  const now = Date.now(), q7 = {}, q30 = {};
  for (const s of S.sales) { if (now - s.t > 30 * 864e5) continue; for (const l of s.L) { const q = l.q - (l.rq || 0); q30[l.id] = (q30[l.id] || 0) + q; if (now - s.t <= 7 * 864e5) q7[l.id] = (q7[l.id] || 0) + q; } }
  return { items: S.p.filter((p) => !p.x).map((p) => ({ n: p.n, sku: p.sku || '', kd: p.kd || '', c: p.c || '', b: p.b || '', u: p.u || '', st: p.st, pr: p.pr, co: p.co, q7: q7[p.id] || 0, q30: q30[p.id] || 0 })).slice(0, 3000) };
}
async function dsnapPost(force) {
  try {
    if (!S || !U || !S.srv || !canNet() || !TK() || !LS.get('jpos:mit:' + SID, 0)) return; const k = 'jpos:dsT:' + SID;
    if (!force && Date.now() - LS.get(k, 0) < 18e5) return; LS.set(k, Date.now());
    const r = await api('/api/dsnap', { method: 'POST', body: JSON.stringify({ d: dsnapData() }) }); if (r.none) LS.set('jpos:mit:' + SID, 0);
  } catch (e) { }
}
setInterval(() => dsnapPost(), 9e4);

/* ---------- halaman distributor ---------- */
const DN = { list: null, sel: '', data: {}, q: '', sort: 'q30', busy: false };
async function dnLoad() { try { DN.busy = true; DN.list = (await api('/api/dnet')).stores; } catch (e) { toast(e.message); DN.list = []; } DN.busy = false; if (V == 'dnet') R(); }
async function dnOpen(id) { DN.sel = id; R(); if (id != '*' && !DN.data[id]) { try { DN.data[id] = await api('/api/dnet/' + id); } catch (e) { DN.data[id] = { err: e.message, items: [] }; } R(); } if (id == '*') { for (const s of (DN.list || []).filter((x) => x.status == 'ok')) if (!DN.data[s.store_id]) { try { DN.data[s.store_id] = await api('/api/dnet/' + s.store_id); } catch (e) { DN.data[s.store_id] = { items: [] }; } } R(); } }
async function dnInvite(code) {
  code = code || prompt('Kode toko kios / grosir yang ingin diajak jadi mitra:'); if (!code) return;
  try { const r = await api('/api/dnet/req', { method: 'POST', body: JSON.stringify({ store: code.trim().toLowerCase() }) }); toast(r.already ? r.name + ' sudah menjadi mitra' : 'Ajakan terkirim ke ' + r.name + ' — menunggu persetujuan pemiliknya', 4500); dnLoad(); } catch (e) { toast(e.message); }
}
const dnSt = { ok: ['gr', 'Aktif'], req: ['or', 'Menunggu persetujuan'], off: ['rd', 'Dicabut / ditolak'] };
function dnRows(items) {
  const q = DN.q.toLowerCase(); let L = items.filter((i) => !q || (i.n + ' ' + i.sku + ' ' + i.kd + ' ' + i.b + ' ' + i.c).toLowerCase().includes(q));
  const S0 = { q30: (a, b) => (b.q30 || 0) - (a.q30 || 0), q7: (a, b) => (b.q7 || 0) - (a.q7 || 0), st: (a, b) => (a.st ?? 1e9) - (b.st ?? 1e9), n: (a, b) => a.n.localeCompare(b.n) };
  L.sort(S0[DN.sort] || S0.q30);
  const has = (k) => items.some((i) => i[k] != null);
  return `<div class="ov"><table class="dntab"><tr><th>#<th>Produk${has('st') ? '<th class="n">Stok' : ''}${has('q30') ? '<th class="n">Terjual 7 hr<th class="n">30 hr' : ''}${has('co') ? '<th class="n">Harga beli' : ''}${has('pr') ? '<th class="n">Harga jual' : ''}${has('co') && has('pr') ? '<th class="n">Margin' : ''}</tr>
${L.slice(0, 400).map((i, n) => { const lowSt = i.st != null && i.q30 ? i.st < i.q30 / 30 * 7 : false; return `<tr><td>${n + 1}<td><b>${esc(i.n)}</b><br><small class="mu">${esc(i.sku || i.kd || '')}${i.b ? ' · ' + esc(i.b) : ''}${i.k ? ' · ' + i.k + ' toko' : ''}</small>${has('st') ? `<td class="n ${i.st <= 0 ? 'rd' : lowSt ? 'or' : ''}">${i.st ?? '-'}${lowSt ? '<br><small>&lt; 7 hari</small>' : ''}` : ''}${has('q30') ? `<td class="n">${i.q7 ?? '-'}<td class="n"><b>${i.q30 ?? '-'}</b>` : ''}${has('co') ? `<td class="n">${i.co != null ? rp(i.co) : '-'}` : ''}${has('pr') ? `<td class="n">${i.pr != null ? rp(i.pr) : '-'}` : ''}${has('co') && has('pr') ? `<td class="n">${i.pr && i.co != null ? Math.round((i.pr - i.co) / i.pr * 100) + '%' : '-'}` : ''}</tr>`; }).join('') || '<tr><td colspan="8" class="mu">Belum ada data. Data dikirim oleh HP toko mitra saat aplikasinya dibuka & online.</td></tr>'}</table></div>`;
}
function dnAgg() {
  const A = {};
  for (const s of (DN.list || []).filter((x) => x.status == 'ok')) for (const i of (DN.data[s.store_id] || {}).items || []) {
    const k = (i.sku || i.n).toLowerCase(), a = A[k] || (A[k] = { n: i.n, sku: i.sku, kd: '', b: i.b, c: i.c, k: 0, st: null, q7: null, q30: null, pr: null, co: null, _p: [], _c: [] });
    a.k++; if (i.st != null) a.st = (a.st || 0) + i.st; if (i.q30 != null) { a.q30 = (a.q30 || 0) + i.q30; a.q7 = (a.q7 || 0) + i.q7; } if (i.pr != null) a._p.push(i.pr); if (i.co != null) a._c.push(i.co);
  }
  return Object.values(A).map((a) => ({ ...a, pr: a._p.length ? Math.round(a._p.reduce((x, y) => x + y, 0) / a._p.length) : null, co: a._c.length ? Math.round(a._c.reduce((x, y) => x + y, 0) / a._c.length) : null }));
}
VW.dnet = () => {
  if (!DN.list && !DN.busy) { dnLoad(); }
  const L = DN.list || [], act = L.filter((x) => x.status == 'ok');
  const top = `<div class="cd"><small class="mu">Toko kios & grosir yang menyetujui berbagi data dengan ${esc(S.name)}. Ajak toko lain dengan kode tokonya, atau dari menu Peta Kios. Toko memilih sendiri data yang dibagi.</small><div class="wrap" style="margin-top:8px"><button class="pr" onclick="dnInvite()">+ Ajak toko jadi mitra</button><button class="gh" onclick="go('kiosMap')">🗺️ Peta kios & grosir</button><button class="gh" onclick="DN.list=null;DN.data={};R()">⟳ Muat ulang</button></div></div>`;
  if (DN.sel) {
    const s = L.find((x) => x.store_id == DN.sel), d = DN.sel == '*' ? { items: dnAgg(), t: 0 } : DN.data[DN.sel];
    return `<div class="cd"><div class="row" style="margin:0"><button class="gh" onclick="DN.sel='';R()">‹ Kembali</button><b>${DN.sel == '*' ? 'Semua mitra (' + act.length + ' toko)' : esc(s ? s.name : DN.sel)}</b></div>
${d && d.t ? `<small class="mu">Data per ${dstr(d.t)} ${hm(d.t)} · dibagikan: ${esc(scTxt(d.scope))}</small>` : ''}${d && d.err ? `<div class="warnbox">${esc(d.err)}</div>` : ''}
<div class="fm2" style="margin-top:8px"><input placeholder="Cari SKU / nama / merek" value="${esc(DN.q)}" oninput="DN.q=this.value;clearTimeout(DN.t);DN.t=setTimeout(R,300)"><select onchange="DN.sort=this.value;R()">${[['q30', 'Paling laris 30 hari'], ['q7', 'Paling laris 7 hari'], ['st', 'Stok paling sedikit'], ['n', 'Nama A–Z']].map(([k, n]) => `<option value="${k}" ${DN.sort == k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
<div class="cd">${d ? dnRows(d.items || []) : '<small class="mu">Memuat…</small>'}</div>`;
  }
  return top + `<div class="cd"><div class="row" style="margin:0"><h3 style="margin:0">Toko mitra</h3>${act.length > 1 ? '<button class="gh a" onclick="dnOpen(\'*\')">📊 Gabungan semua mitra</button>' : ''}</div>
${DN.busy && !L.length ? '<small class="mu">Memuat…</small>' : ''}${L.map((x) => `<div class="row" style="margin-top:10px;align-items:flex-start"><span><b>${esc(x.name)}</b> <small class="mu">${esc(x.store_id)}</small><br><small class="${dnSt[x.status][0]}">${dnSt[x.status][1]}</small>${x.status == 'ok' ? `<small class="mu"> · ${esc(scTxt(x.scope))}${x.snapt ? ' · data ' + dstr(x.snapt) : ' · belum ada data'}</small>` : ''}</span>${x.status == 'ok' ? `<button class="pr" onclick="dnOpen('${esc(x.store_id)}')">Lihat stok</button>` : x.status == 'off' ? `<button class="gh" onclick="dnInvite('${esc(x.store_id)}')">Ajak lagi</button>` : ''}</div>`).join('') || (DN.busy ? '' : '<small class="mu">Belum ada mitra.</small>')}</div>`;
};
