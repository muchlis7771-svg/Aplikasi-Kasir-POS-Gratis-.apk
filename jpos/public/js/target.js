'use strict';
/* ============ TARGET, PENCAPAIAN & INSENTIF (per bulan, per karyawan) ============
   Jenis target: omzet total, omzet per merek, item fokus (qty), outlet aktif (AO), outlet baru (NOO).
   Hak akses: tgt = lihat milik sendiri · tgtAll = lihat semua · tgtSet = atur target, insentif & kalender kerja. */
const TGT = {
  omzet: ['💰', 'Omzet total', 'Rp', 'Total penjualan bersih (setelah diskon & retur, tanpa PPN)'],
  brand: ['🏷️', 'Omzet per merek', 'Rp', 'Penjualan bersih produk dengan merek tertentu (kategori bila merek kosong)'],
  item: ['⭐', 'Item fokus', 'pcs', 'Jumlah terjual untuk produk fokus'],
  ao: ['🏪', 'Outlet aktif (AO)', 'outlet', 'Jumlah outlet berbeda yang order di bulan itu'],
  noo: ['🆕', 'Outlet baru (NOO)', 'outlet', 'Outlet yang order pertama kali di bulan itu'],
};
const IMODE = { none: 'Tanpa insentif', flat: 'Bonus tetap (Rp) bila tercapai', pct: '% dari pencapaian (omzet)', unit: 'Rp per satuan tercapai (pcs / outlet)' };
const THARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const ymNow = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const ymOf = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ymName = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
const ymPrev = (m) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 2, 1); return ymOf(d.getTime()); };
const brandOf = (p) => (p && String(p.b || p.c || 'Umum').trim()) || 'Umum';
const brands = () => [...new Set(S.p.map(brandOf))].sort();
const tUnit = (ty, v) => (TGT[ty][2] == 'Rp' ? rp(Math.round(v)) : (Math.round(v * 10) / 10).toLocaleString('id-ID') + ' ' + TGT[ty][2]);
function tgtUsers() {
  const m = new Map(), add = (n, r) => { if (n && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), { n, r: r || '' }); };
  (S.staff || []).forEach((u) => add(u.name, u.role)); (S.users || []).forEach((u) => add(u.n, u.r)); S.sales.forEach((s) => add(s.u, ''));
  return [...m.values()].sort((a, b) => a.n.localeCompare(b.n));
}
const roleOf = (n) => (tgtUsers().find((u) => u.n.toLowerCase() == String(n).toLowerCase()) || {}).r || '';

/* ---------- kalender kerja ---------- */
function tcal(m) { const c = (S.tcal || {})[m]; return { wd: c ? c.wd : (S.set.twd || [1, 2, 3, 4, 5, 6]), off: c ? c.off : [] }; }
function workInfo(m) {
  const [y, mo] = m.split('-').map(Number), c = tcal(m), off = new Set(c.off), wd = new Set(c.wd), today = ymd(new Date());
  const days = []; for (let d = new Date(y, mo - 1, 1); d.getMonth() == mo - 1; d.setDate(d.getDate() + 1)) { const k = ymd(d); days.push({ k, d: d.getDate(), dow: d.getDay(), w: wd.has(d.getDay()) && !off.has(k), off: off.has(k) }); }
  const W = days.filter((x) => x.w), tot = W.length, done = W.filter((x) => x.k < today).length, isToday = W.some((x) => x.k == today), after = W.filter((x) => x.k > today).length;
  // berjalan = hari kerja sampai hari ini (termasuk hari ini); sisa = hari kerja yang masih bisa dipakai (hari ini + sesudahnya)
  return { days, tot, run: done + (isToday ? 1 : 0), left: after + (isToday ? 1 : 0), after, isToday, today };
}

/* ---------- hitung pencapaian ---------- */
let ACTM = null;
function actuals(m) {
  const key = m + '|' + S.sales.length + '|' + (S.rtr || []).length + '|' + S.c.length; if (ACTM && ACTM.k == key) return ACTM.v;
  const first = {}; for (const s of S.sales) if (s.cu && (!first[s.cu] || s.t < first[s.cu].t)) first[s.cu] = s;
  const U2 = {}, me = (u) => (U2[u] = U2[u] || { omzet: 0, brand: {}, item: {}, ao: new Set(), noo: 0, n: 0 });
  for (const s of S.sales) {
    if (ymOf(s.t) != m) continue; const net = (s.sub - s.disc) - (s.rn || 0);
    for (const who of [s.u, '*']) {
      const a = me(who); a.omzet += net; a.n++; if (s.cu && net > 0) a.ao.add(s.cu);
      const net0 = s.L.reduce((x, i) => x + i.p * i.q - i.dd, 0), k = net0 ? (net0 - (s.cdA || 0)) / net0 : 1;
      for (const i of s.L) { const left = i.q - (i.rq || 0); if (left <= 0) continue; const v = (i.p * i.q - i.dd) * (left / i.q) * k, b = brandOf(prod(i.id) || { c: '' }); a.brand[b] = (a.brand[b] || 0) + v; a.item[i.id] = (a.item[i.id] || 0) + left; }
    }
  }
  for (const cu in first) { const s = first[cu]; if (ymOf(s.t) == m) { me(s.u).noo++; me('*').noo++; } }
  ACTM = { k: key, v: U2 }; return U2;
}
function actOf(x, m) {
  const a = actuals(m)[x.u] || { omzet: 0, brand: {}, item: {}, ao: new Set(), noo: 0 };
  return x.ty == 'omzet' ? a.omzet : x.ty == 'brand' ? a.brand[x.ref] || 0 : x.ty == 'item' ? a.item[x.ref] || 0 : x.ty == 'ao' ? a.ao.size : a.noo;
}
function insOf(x, act) {
  const pct = x.v ? act / x.v * 100 : 0; if (x.im == 'none' || !x.iv || pct < x.min) return 0;
  return x.im == 'flat' ? x.iv : x.im == 'pct' ? Math.round(act * x.iv / 100) : Math.round(act * x.iv);
}
function evalT(x, m, wi) {
  const act = actOf(x, m), pct = x.v ? act / x.v * 100 : 0, rate = wi.run ? act / wi.run : 0, proj = act + rate * wi.after, ppct = x.v ? proj / x.v * 100 : 0;
  const gap = Math.max(0, x.v - act), need = wi.left ? gap / wi.left : gap, exp = wi.tot ? x.v * wi.run / wi.tot : 0;
  const st = pct >= 100 ? ['gr', '✅ Tercapai'] : !wi.left ? ['rd', '❌ Tidak tercapai'] : ppct >= 100 ? ['gr', '🟢 Sesuai jalur'] : ppct >= 85 ? ['or', '🟡 Perlu dikejar'] : ['rd', '🔴 Tertinggal'];
  return { act, pct, rate, proj, ppct, gap, need, exp, st, ins: insOf(x, act), insP: insOf(x, proj) };
}
const tgtOf = (m, u) => (S.tgt || []).filter((x) => x.m == m && (u == null || x.u == u));
const tRef = (x) => (x.ty == 'brand' ? ' · ' + esc(x.ref) : x.ty == 'item' ? ' · ' + esc((prod(x.ref) || { n: '(produk dihapus)' }).n) : '');
const tWho = (u) => (u == '*' ? '👥 Seluruh tim (total toko)' : esc(u));

/* ---------- tampilan ---------- */
let TM = ymNow(), TU = '', TTAB = 'hasil';
const tAll = () => can('tgtAll');
function tBar(p, cls) { return `<div class="tbar"><i class="${cls}" style="width:${Math.min(100, Math.max(0, p)).toFixed(1)}%"></i></div>`; }
function tRow(x, m, wi) {
  const e = evalT(x, m, wi);
  return `<div class="tgrw"><div class="row" style="margin:0"><span><b>${TGT[x.ty][0]} ${TGT[x.ty][1]}</b>${tRef(x)}</span><b class="${e.st[0]}">${e.pct.toFixed(1)}%</b></div>${tBar(e.pct, e.st[0])}
<div class="tgrid"><span><small class="mu">Aktual</small><b>${tUnit(x.ty, e.act)}</b></span><span><small class="mu">Target</small><b>${tUnit(x.ty, x.v)}</b></span><span><small class="mu">Kurang</small><b>${tUnit(x.ty, e.gap)}</b></span>
<span><small class="mu">Rata-rata / hari kerja</small><b>${tUnit(x.ty, e.rate)}</b></span><span><small class="mu">Perlu / hari (${wi.left} hari)</small><b class="${e.gap ? 'or' : 'gr'}">${e.gap ? tUnit(x.ty, e.need) : '—'}</b></span><span><small class="mu">Proyeksi akhir bulan</small><b>${tUnit(x.ty, e.proj)} <small>(${e.ppct.toFixed(0)}%)</small></b></span></div>
<div class="row" style="margin:4px 0 0"><small class="${e.st[0]}"><b>${e.st[1]}</b> · seharusnya s.d. hari ini ${tUnit(x.ty, e.exp)}</small>${x.im != 'none' && x.iv ? `<small>🎁 ${e.ins ? `<b class="gr">${rp(e.ins)}</b>` : `<span class="mu">potensi ${rp(e.insP)}</span>`} <span class="mu">(${insTxt(x)})</span></small>` : ''}</div></div>`;
}
const insTxt = (x) => (x.im == 'flat' ? rp(x.iv) : x.im == 'pct' ? x.iv + '% omzet' : rp(x.iv) + '/' + TGT[x.ty][2]) + ' bila ≥ ' + x.min + '%';
function tUserCard(u, m, wi) {
  const L = tgtOf(m, u); if (!L.length) return '';
  const ins = L.reduce((a, x) => a + evalT(x, m, wi).ins, 0), insP = L.reduce((a, x) => a + evalT(x, m, wi).insP, 0);
  return `<div class="cd"><div class="row" style="margin:0 0 6px"><span><b style="font-size:15px">${tWho(u)}</b>${u != '*' && roleOf(u) ? ` <small class="mu">· ${esc(ROLE[roleOf(u)] || roleOf(u))}</small>` : ''}</span><span class="c"><small class="mu">Insentif</small><br><b class="gr">${rp(ins)}</b>${insP > ins ? `<br><small class="mu">proyeksi ${rp(insP)}</small>` : ''}</span></div>${L.map((x) => tRow(x, m, wi)).join('')}</div>`;
}
function tCalCard(wi, m) {
  return `<div class="cd tcal"><div class="row" style="margin:0"><b>📅 ${esc(ymName(m))}</b><small class="mu">${tcal(m).wd.map((d) => THARI[d]).join(', ')}</small></div><div class="tgrid"><span><small class="mu">Hari kerja</small><b>${wi.tot}</b></span><span><small class="mu">Berjalan (s.d. hari ini)</small><b>${wi.run}</b></span><span><small class="mu">Sisa (termasuk hari ini)</small><b class="or">${wi.left}</b></span></div>${tBar(wi.tot ? wi.run / wi.tot * 100 : 0, 'ac')}</div>`;
}
function tTeam(m, wi) {
  const us = [...new Set(tgtOf(m).map((x) => x.u))].sort((a, b) => (a == '*' ? -1 : b == '*' ? 1 : a.localeCompare(b)));
  if (!us.length) return '';
  return `<div class="cd"><h3>📋 Ringkasan tim</h3><div class="ov"><table><tr><th>Karyawan<th class="n">Target<th class="n">Rata-rata<th class="n">Proyeksi<th class="n">Insentif</tr>${us.map((u) => { const E = tgtOf(m, u).map((x) => evalT(x, m, wi)), av = E.reduce((a, e) => a + Math.min(e.pct, 150), 0) / E.length, pv = E.reduce((a, e) => a + Math.min(e.ppct, 150), 0) / E.length; return `<tr data-tu="${esc(u)}" style="cursor:pointer"><td>${u == '*' ? '👥 Tim' : esc(u)}<td class="n">${E.length}<td class="n ${av >= 100 ? 'gr' : av >= 85 ? 'or' : 'rd'}">${av.toFixed(0)}%<td class="n">${pv.toFixed(0)}%<td class="n">${rp(E.reduce((a, e) => a + e.ins, 0))}</tr>`; }).join('')}</table></div><small class="mu">Ketuk nama untuk melihat detail. Rata-rata = rata-rata % pencapaian semua target orang tersebut.</small></div>`;
}
VW.tgt = () => {
  const m = TM, wi = workInfo(m), all = tAll(), set = can('tgtSet');
  if (!all) TU = U.n;
  const tabs = [['hasil', '📈 Pencapaian'], ...(set ? [['atur', '🎯 Atur target'], ['kal', '📅 Kalender kerja']] : [])];
  let body = '';
  if (TTAB == 'atur' && set) body = tAtur(m);
  else if (TTAB == 'kal' && set) body = tKal(m, wi);
  else {
    const us = all ? (TU ? [TU] : [...new Set(tgtOf(m).map((x) => x.u))].sort((a, b) => (a == '*' ? -1 : b == '*' ? 1 : a.localeCompare(b)))) : [U.n];
    body = tCalCard(wi, m) + (all && !TU ? tTeam(m, wi) : '') + (us.map((u) => tUserCard(u, m, wi)).join('') || `<div class="cd mu c">Belum ada target untuk ${all && TU ? esc(TU) + ' di ' : ''}${esc(ymName(m))}.${set ? ' Buka tab <b>Atur target</b> untuk membuat.' : ' Target diatur oleh pemilik / admin.'}</div>`);
  }
  return `<div class="cd"><div class="fm2"><label><small class="mu">Bulan</small><input type="month" value="${m}" onchange="TM=this.value||ymNow();R()"></label>${all && TTAB == 'hasil' ? `<label><small class="mu">Karyawan</small><select onchange="TU=this.value;R()"><option value="">Semua</option><option value="*" ${TU == '*' ? 'selected' : ''}>👥 Seluruh tim</option>${tgtUsers().map((u) => `<option ${TU == u.n ? 'selected' : ''}>${esc(u.n)}</option>`).join('')}</select></label>` : ''}</div>${tabs.length > 1 ? `<div class="seg" style="margin-top:8px">${tabs.map((t) => `<button class="${TTAB == t[0] ? 'a' : ''}" onclick="TTAB='${t[0]}';R()">${t[1]}</button>`).join('')}</div>` : ''}</div>${body}`;
};
document.addEventListener('click', (e) => { const r = e.target.closest('[data-tu]'); if (r && V == 'tgt') { TU = r.dataset.tu; R(); } });

/* ---------- atur target (tgtSet) ---------- */
function tAtur(m) {
  const L = tgtOf(m), us = [...new Set(L.map((x) => x.u))].sort();
  return `<div class="cd"><div class="wrap"><button class="pr" onclick="tEdit()">+ Tambah target</button><button class="gh" onclick="tCopy()">📋 Salin dari ${esc(ymName(ymPrev(m)))}</button></div><small class="mu">Satu target bisa diberikan ke beberapa karyawan sekaligus (sales, kasir, admin, dll). Pilih “Seluruh tim” untuk target total toko.</small></div>
${us.map((u) => `<div class="cd"><b>${tWho(u)}</b>${tgtOf(m, u).map((x) => `<div class="row tgrw2"><span>${TGT[x.ty][0]} ${TGT[x.ty][1]}${tRef(x)}<br><small class="mu">Target ${tUnit(x.ty, x.v)}${x.im != 'none' && x.iv ? ' · 🎁 ' + esc(insTxt(x)) : ''}</small></span><span class="wrap" style="flex-wrap:nowrap"><button class="gh" onclick="tEdit('${esc(x.id)}')">Ubah</button><button class="gh d" onclick="tDel('${esc(x.id)}')">Hapus</button></span></div>`).join('')}</div>`).join('') || '<div class="cd mu c">Belum ada target bulan ini.</div>'}`;
}
function tEdit(id) {
  const x = id ? S.tgt.find((y) => y.id == id) : null, us = tgtUsers();
  const m = modal(`<h3>${x ? 'Ubah target' : 'Tambah target'} · ${esc(ymName(x ? x.m : TM))}</h3>
${x ? `<small class="mu">Untuk: <b>${tWho(x.u)}</b></small>` : `<small class="mu">Untuk siapa? (boleh lebih dari satu)</small><div class="wrap tusr"><label class="chip"><input type="checkbox" value="*" style="width:auto"> 👥 Seluruh tim</label>${us.map((u) => `<label class="chip"><input type="checkbox" value="${esc(u.n)}" style="width:auto"> ${esc(u.n)} <small class="mu">${esc(ROLE[u.r] ? ROLE[u.r].split(' ')[0] : u.r)}</small></label>`).join('')}</div>
<div class="wrap" style="margin:4px 0">${['sales', 'kasir', 'spg', 'admin'].map((r) => `<button class="gh" data-rl="${r}">Semua ${esc(r == 'spg' ? 'SPG/SPB' : ROLE[r].split(' ')[0])}</button>`).join('')}</div>`}
<label><small class="mu">Jenis target</small><select id="tty">${Object.entries(TGT).map(([k, v]) => `<option value="${k}" ${x && x.ty == k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label><small class="mu" id="tdesc"></small>
<label id="tbw"><small class="mu">Merek</small><input id="tbr" list="tbl" value="${esc(x && x.ty == 'brand' ? x.ref : '')}" placeholder="Nama merek"><datalist id="tbl">${brands().map((b) => `<option value="${esc(b)}">`).join('')}</datalist></label>
<label id="tiw"><small class="mu">Produk fokus</small><select id="tit">${S.p.map((p) => `<option value="${esc(p.id)}" ${x && x.ref == p.id ? 'selected' : ''}>${esc(p.n)}${p.kd ? ' · ' + esc(p.kd) : ''}</option>`).join('')}</select></label>
<label><small class="mu" id="tvl">Target</small><input id="tv" type="number" min="0" inputmode="numeric" value="${x ? x.v : ''}"></label>
<b style="font-size:13px">🎁 Insentif</b><select id="tim">${Object.entries(IMODE).map(([k, v]) => `<option value="${k}" ${(x ? x.im : 'none') == k ? 'selected' : ''}>${v}</option>`).join('')}</select>
<div class="fm2" id="tiv2"><label><small class="mu" id="tivl">Nilai</small><input id="tiv" type="number" min="0" step="any" value="${x ? x.iv : ''}"></label><label><small class="mu">Syarat minimal pencapaian (%)</small><input id="tmin" type="number" min="0" max="200" value="${x ? x.min : 100}"></label></div>
<button class="pr" id="tok">Simpan</button>`, 'w');
  const sync = () => {
    const ty = $('#tty', m).value, im = $('#tim', m).value; $('#tdesc', m).textContent = TGT[ty][3];
    $('#tbw', m).style.display = ty == 'brand' ? '' : 'none'; $('#tiw', m).style.display = ty == 'item' ? '' : 'none';
    $('#tvl', m).textContent = 'Target (' + TGT[ty][2] + ')'; $('#tiv2', m).style.display = im == 'none' ? 'none' : '';
    $('#tivl', m).textContent = im == 'flat' ? 'Bonus (Rp)' : im == 'pct' ? 'Persen dari pencapaian (%)' : 'Rp per ' + TGT[ty][2];
  };
  $('#tty', m).onchange = sync; $('#tim', m).onchange = sync; sync();
  $$('[data-rl]', m).forEach((b) => (b.onclick = () => $$('.tusr input', m).forEach((c) => { if (roleOf(c.value) == b.dataset.rl) c.checked = true; })));
  $('#tok', m).onclick = () => {
    const ty = $('#tty', m).value, ref = ty == 'brand' ? $('#tbr', m).value.trim() : ty == 'item' ? $('#tit', m).value : '', v = +$('#tv', m).value || 0, im = $('#tim', m).value;
    const who = x ? [x.u] : $$('.tusr input', m).filter((c) => c.checked).map((c) => c.value);
    if (!who.length) return toast('Pilih minimal satu karyawan'); if (!(v > 0)) return toast('Isi nilai target'); if ((ty == 'brand' || ty == 'item') && !ref) return toast(ty == 'brand' ? 'Isi merek' : 'Pilih produk');
    if (im == 'pct' && !['omzet', 'brand'].includes(ty)) return toast('Insentif % hanya untuk target omzet / merek');
    for (const u of who) emit('tgt', { op: 'put', x: { id: x ? x.id : 't' + uid(), m: x ? x.m : TM, u, ty, ref, v, im, iv: +$('#tiv', m).value || 0, min: +$('#tmin', m).value || 100 } });
    m.close(); toast(who.length > 1 ? 'Target disimpan untuk ' + who.length + ' karyawan' : 'Target disimpan'); R();
  };
}
function tDel(id) { const x = S.tgt.find((y) => y.id == id); if (!x || !confirm('Hapus target ' + TGT[x.ty][1] + ' untuk ' + (x.u == '*' ? 'seluruh tim' : x.u) + '?')) return; emit('tgt', { op: 'del', id }); R(); }
function tCopy() {
  const pv = tgtOf(ymPrev(TM)); if (!pv.length) return toast('Bulan lalu tidak ada target');
  const has = tgtOf(TM); if (has.length && !confirm('Bulan ini sudah ada ' + has.length + ' target. Tambahkan ' + pv.length + ' target dari bulan lalu?')) return;
  for (const x of pv) emit('tgt', { op: 'put', x: { ...x, id: 't' + uid(), m: TM } }); toast(pv.length + ' target disalin'); R();
}

/* ---------- kalender kerja (hari kerja & libur) ---------- */
function tKal(m, wi) {
  const c = tcal(m), first = wi.days[0].dow;
  return `<div class="cd"><h3>📅 Hari kerja ${esc(ymName(m))}</h3><small class="mu">Hari kerja mingguan</small><div class="wrap" style="margin:6px 0">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chip ${c.wd.includes(d) ? 'g' : ''}"><input type="checkbox" class="twd" value="${d}" style="width:auto" ${c.wd.includes(d) ? 'checked' : ''}> ${THARI[d]}</label>`).join('')}</div>
<small class="mu">Ketuk tanggal untuk menandai <b class="rd">libur</b> (tanggal merah, cuti bersama, dll).</small>
<div class="tkal">${THARI.map((h) => `<b>${h}</b>`).join('')}${'<span></span>'.repeat(first)}${wi.days.map((d) => `<button data-off="${d.k}" class="${d.off ? 'off' : d.w ? 'w' : 'nw'} ${d.k == wi.today ? 'td' : ''}">${d.d}</button>`).join('')}</div>
<div class="row"><small class="mu">Hari kerja: <b id="tkn">${wi.tot}</b> · berjalan ${wi.run} · sisa ${wi.left}</small></div>
<div class="wrap"><button class="pr" onclick="tKalSave()">Simpan kalender</button><label class="chip"><input type="checkbox" id="tkdef" style="width:auto"> Jadikan hari kerja mingguan bawaan bulan berikutnya</label></div></div>`;
}
let TOFF = null;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-off]'); if (!b || V != 'tgt') return;
  if (!TOFF || TOFF.m != TM) TOFF = { m: TM, s: new Set(tcal(TM).off) };
  const k = b.dataset.off; if (TOFF.s.has(k)) { TOFF.s.delete(k); b.classList.remove('off'); } else { TOFF.s.add(k); b.classList.add('off'); }
});
function tKalSave() {
  const wd = $$('.twd').filter((c) => c.checked).map((c) => +c.value), off = [...(TOFF && TOFF.m == TM ? TOFF.s : new Set(tcal(TM).off))].sort();
  if (!wd.length) return toast('Pilih minimal satu hari kerja');
  emit('tgt', { op: 'cal', m: TM, wd, off }); if ($('#tkdef').checked && U.r == 'owner') emit('set', { set: { twd: wd } });
  TOFF = null; toast('Kalender kerja disimpan'); R();
}

/* ---------- kartu ringkas di beranda ---------- */
function tgtMini() {
  try {
    if (!can('tgt')) return ''; const m = ymNow(), L = tgtOf(m, U.n); if (!L.length) return '';
    const wi = workInfo(m), E = L.map((x) => [x, evalT(x, m, wi)]), main = E.find((e) => e[0].ty == 'omzet') || E[0], ins = E.reduce((a, e) => a + e[1].ins, 0);
    return `<div class="cd tmini" onclick="TTAB='hasil';TU='${esc(U.n)}';go('tgt')" style="cursor:pointer"><div class="row" style="margin:0"><b>🏆 Target ${esc(ymName(m))}</b><b class="${main[1].st[0]}">${main[1].pct.toFixed(0)}%</b></div>${tBar(main[1].pct, main[1].st[0])}
<small class="mu">${TGT[main[0].ty][1]}${tRef(main[0])}: ${tUnit(main[0].ty, main[1].act)} / ${tUnit(main[0].ty, main[0].v)} · sisa ${wi.left} hari kerja${main[1].gap ? ' · perlu <b class="or">' + tUnit(main[0].ty, main[1].need) + '/hari</b>' : ''}</small>
<div class="wrap" style="margin-top:4px">${E.filter((e) => e != main).slice(0, 4).map((e) => `<span class="chip ${e[1].pct >= 100 ? 'g' : ''}">${TGT[e[0].ty][0]} ${e[1].pct.toFixed(0)}%</span>`).join('')}${ins ? `<span class="chip g">🎁 ${rp(ins)}</span>` : ''}</div></div>`;
  } catch (e) { return ''; }
}
