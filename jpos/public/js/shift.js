'use strict';
/* ============ SHIFT KASIR ============
   Admin / pemilik (hak "Atur shift kasir") membuat daftar shift & jadwal mingguan tiap karyawan.
   Kasir membuka kasir (modal awal) di jam shiftnya, lalu closing: hitung uang fisik vs seharusnya, laporan terkirim ke pemilik. */
const SHARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], SHORD = [1, 2, 3, 4, 5, 6, 0];
const shDefs = () => (S.shs && S.shs.defs) || [];
const shReq = () => !!(shDefs().length && (!S.shs || S.shs.req !== false));
const shKey = (u) => String(u || '').toLowerCase();
const tmin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
function shiftFor(u, t) { const d = new Date(t || Date.now()), a = ((S.shs && S.shs.as) || {})[shKey(u)] || {}, id = a[d.getDay()]; return shDefs().find((x) => x.id == id) || null; }
// jam masuk untuk absen: jam mulai shift hari itu, bila ada; selain itu jam masuk toko
const jinOf = (u, t) => { const s = shiftFor(u, t); return s ? s.s : S.set.jin || '08:00'; };
const shTxt = (s) => (s ? s.n + ' ' + s.s + '–' + s.e : 'Libur');
function shInWin(s, t) { // boleh buka 30 menit sebelum mulai s.d. jam selesai (shift malam melewati tengah malam didukung)
  const d = new Date(t || Date.now()), n = d.getHours() * 60 + d.getMinutes(), a = tmin(s.s) - 30, b = tmin(s.e);
  return b > a ? n >= a && n <= b : n >= a || n <= b;
}
const mySes = (u) => (S.ses || []).filter((x) => x.u == (u || U.n) && !x.tc && Date.now() - x.t < 20 * 36e5).pop() || null;
// rekap penjualan & penerimaan kasir dalam satu sesi
function sesSum(x, t1) {
  const t0 = x.t, t = t1 || Date.now(), M = { Tunai: 0, QRIS: 0, Transfer: 0 }; let omz = 0, n = 0, kred = 0, pay = 0;
  for (const s of S.sales) {
    if (s.u == x.u && s.t >= t0 && s.t <= t) { omz += s.tot; n++; if (s.pay == 'Piutang') { kred += s.tot - (s.dpay || 0); if (s.dpay) M[s.dpm || 'Tunai'] = (M[s.dpm || 'Tunai'] || 0) + s.dpay; } else M[s.pay] = (M[s.pay] || 0) + s.tot; }
    for (const p of s.pays || []) if (p.u == x.u && p.t >= t0 && p.t <= t) { M[p.m || 'Tunai'] = (M[p.m || 'Tunai'] || 0) + p.amt; pay += p.amt; }
  }
  return { omz, n, kred, pay, M, exp: x.c0 + M.Tunai };
}

/* ---------- bilah kasir di halaman Kasir ---------- */
function shBar() {
  if (!S || !U) return ''; const x = mySes(), need = U.r == 'kasir' && shReq();
  if (!x && !need) return '';
  const s = shiftFor(U.n);
  if (x) { const r = sesSum(x); return `<div class="cd shbar on"><div class="row" style="margin:0"><span><b>🔓 Kasir dibuka ${hm(x.t)}</b><br><small class="mu">${esc(x.sn || 'Tanpa shift')} · modal ${rp(x.c0)} · ${r.n} transaksi · ${rp(r.omz)}</small></span><button class="pr" onclick="shClose()">🔐 Closing</button></div></div>`; }
  return `<div class="cd shbar"><div class="row" style="margin:0"><span><b>🔒 Kasir belum dibuka</b><br><small class="mu">Shift hari ini: ${esc(shTxt(s))}</small></span><button class="pr" onclick="shOpen()">Buka kasir</button></div></div>`;
}
function shOpen() {
  const s = shiftFor(U.n), mgr = MGR(U.r);
  if (U.r == 'kasir' && shReq()) {
    if (!s) return alertBox('Anda tidak terjadwal shift hari ini (' + SHARI[new Date().getDay()] + '). Hubungi admin / pemilik untuk mengatur jadwal.', 'Tidak ada jadwal');
    if (!shInWin(s)) return alertBox('Shift Anda ' + shTxt(s) + '. Kasir bisa dibuka mulai 30 menit sebelum jam mulai sampai jam selesai shift.', 'Di luar jam shift');
  }
  const m = modal(`<h3>Buka kasir</h3><small class="mu">${esc(U.n)} · ${esc(shTxt(s))}${mgr && !s ? ' (tanpa jadwal)' : ''}</small><label><small class="mu">Modal awal / uang kembalian di laci (Rp)</small><input id="sc0" type="number" inputmode="numeric" min="0" value="${S.set.c0 || 0}"></label><button class="pr" id="ok">Buka kasir</button>`);
  $('#ok', m).onclick = () => { emit('shf', { op: 'open', sh: s ? s.id : '', sn: s ? shTxt(s) : '', c0: num($('#sc0', m).value) }); m.close(); toast('Kasir dibuka — selamat bekerja'); R(); };
}
function closingText(x, r, cash, note) {
  const dif = cash - r.exp;
  return ['*🔐 CLOSING KASIR ' + String(S.name || '').toUpperCase() + '*', '_' + dstr(Date.now()) + '_', '', 'Kasir: *' + x.u + '*', 'Shift: ' + (x.sn || '-'), 'Buka ' + hm(x.t) + ' · tutup ' + hm(Date.now()), '',
    'Transaksi: ' + r.n + ' · Omzet: *' + rp(r.omz) + '*', '• Tunai: ' + rp(r.M.Tunai), '• QRIS: ' + rp(r.M.QRIS || 0), '• Transfer: ' + rp(r.M.Transfer || 0), r.kred ? '• Kredit: ' + rp(r.kred) : '', r.pay ? 'Pelunasan diterima: ' + rp(r.pay) : '', '',
    'Modal awal: ' + rp(x.c0), 'Tunai seharusnya: ' + rp(r.exp), 'Uang fisik dihitung: *' + rp(cash) + '*', 'Selisih: *' + (dif ? (dif > 0 ? '+' : '−') + rp(Math.abs(dif)) + (dif > 0 ? ' (lebih)' : ' (kurang)') : 'Rp0 ✓') + '*', note ? 'Catatan: ' + note : '', '', '_Dikirim dari J-POS_'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
function shClose() {
  const x = mySes(); if (!x) return toast('Kasir belum dibuka'); const r = sesSum(x);
  const m = modal(`<h3>🔐 Closing kasir</h3><small class="mu">${esc(x.u)} · ${esc(x.sn || 'Tanpa shift')} · buka ${hm(x.t)}</small>
<div class="tt">${row('Transaksi', r.n)}${row('Omzet', '<b>' + rp(r.omz) + '</b>')}${row('Tunai', rp(r.M.Tunai))}${row('QRIS', rp(r.M.QRIS || 0))}${row('Transfer', rp(r.M.Transfer || 0))}${r.kred ? row('Kredit (piutang)', rp(r.kred)) : ''}${r.pay ? row('Pelunasan diterima', rp(r.pay)) : ''}${row('Modal awal', rp(x.c0))}${row('<b>Tunai seharusnya di laci</b>', '<b>' + rp(r.exp) + '</b>')}</div>
<label><small class="mu">Uang fisik di laci (hitung, Rp)</small><input id="scs" type="number" inputmode="numeric" min="0" placeholder="${r.exp}"></label><small id="sdf" class="mu"></small>
<input id="snt" placeholder="Catatan (opsional)"><button class="pr" id="ok">Tutup kasir & kirim laporan</button>`, 'w');
  const df = () => { const v = $('#scs', m).value; if (v === '') return ($('#sdf', m).textContent = ''); const d = num(v) - r.exp; $('#sdf', m).innerHTML = d ? `<b class="${d > 0 ? 'or' : 'rd'}">Selisih ${d > 0 ? '+' : '−'}${rp(Math.abs(d))} (${d > 0 ? 'lebih' : 'kurang'})</b>` : '<b class="gr">Pas ✓</b>'; };
  $('#scs', m).oninput = df;
  $('#ok', m).onclick = async () => {
    const v = $('#scs', m).value; if (v === '') return toast('Isi jumlah uang fisik di laci');
    const cash = num(v), note = $('#snt', m).value.trim(), dif = cash - r.exp;
    if (dif && !confirm('Ada selisih ' + (dif > 0 ? '+' : '−') + rp(Math.abs(dif)) + '. Tetap tutup kasir?')) return;
    const text = closingText(x, r, cash, note);
    emit('shf', { op: 'close', ref: x.no, cash, exp: r.exp, dif, omz: r.omz, n: r.n, M: r.M, note, sn: x.sn }); m.close(); R();
    let sent = null; try { if (S.srv && canNet()) { await sync(); sent = await api('/api/rpt/push', { method: 'POST', body: JSON.stringify({ kind: 'closing', text, subject: 'Closing kasir ' + x.u + ' · ' + S.name }) }); } } catch (e) { }
    shDone(text, sent);
  };
}
function shDone(text, sent) {
  const ok = sent && sent.res && sent.res.filter((y) => y.ok).map((y) => (y.ch == 'wa' ? 'WhatsApp' : 'email')), wa = rptWa();
  const m = modal(`<div style="text-align:center"><div style="font-size:44px">✅</div><h3>Kasir ditutup</h3>${ok && ok.length ? `<small class="gr">Laporan closing terkirim otomatis ke ${ok.join(' & ')} pemilik.</small>` : '<small class="mu">Laporan belum terkirim otomatis — kirim manual ke pemilik:</small>'}</div>
<pre class="shpre">${esc(text)}</pre><div class="fm2">${wa ? `<a class="pr" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(text)}">Kirim ke WA pemilik</a>` : `<a class="pr" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Bagikan ke WhatsApp</a>`}<button class="gh" id="cp">Salin</button></div><button class="gh" id="ok">Selesai</button>`, 'w');
  $('#cp', m).onclick = () => copyTx(text); $('#ok', m).onclick = () => m.close();
}

/* ---------- halaman Shift Kasir (admin / pemilik) ---------- */
let SHD = null;
VW.shiftSet = () => {
  if (!SHD) SHD = JSON.parse(JSON.stringify({ defs: shDefs(), as: (S.shs && S.shs.as) || {}, req: !S.shs || S.shs.req !== false }));
  const us = (typeof tgtUsers == 'function' ? tgtUsers() : (S.users || []).map((u) => ({ n: u.n, r: u.r }))).filter((u) => u.r != 'owner').sort((a, b) => (a.r == 'kasir' ? -1 : 0) - (b.r == 'kasir' ? -1 : 0) || a.n.localeCompare(b.n));
  const open = (S.ses || []).filter((x) => !x.tc && Date.now() - x.t < 20 * 36e5), hist = (S.ses || []).filter((x) => x.tc).slice(-40).reverse();
  return `<div class="cd"><h3>🕐 Daftar shift</h3><small class="mu">Contoh: Pagi 07:00–15:00, Sore 15:00–23:00. Shift malam yang melewati tengah malam boleh (mis. 22:00–06:00).</small>
${SHD.defs.map((d, i) => `<div class="shrow"><input value="${esc(d.n)}" placeholder="Nama shift" onchange="SHD.defs[${i}].n=this.value"><input type="time" value="${d.s}" onchange="SHD.defs[${i}].s=this.value"><input type="time" value="${d.e}" onchange="SHD.defs[${i}].e=this.value"><button class="gh d" aria-label="Hapus shift" onclick="SHD.defs.splice(${i},1);R()">✕</button></div>`).join('') || '<small class="mu">Belum ada shift.</small>'}
<div class="wrap" style="margin-top:6px"><button class="gh" onclick="SHD.defs.push({id:'s'+uid().slice(0,6),n:['Pagi','Siang','Sore','Malam'][SHD.defs.length]||'Shift '+(SHD.defs.length+1),s:SHD.defs.length?SHD.defs[SHD.defs.length-1].e:'07:00',e:'15:00'});R()">+ Tambah shift</button></div>
<label class="row" style="margin:10px 0 0"><span>Kasir wajib <b>buka kasir</b> sesuai jadwal sebelum bisa berjualan</span><input type="checkbox" style="width:24px;height:24px" ${SHD.req ? 'checked' : ''} onchange="SHD.req=this.checked"></label></div>
<div class="cd"><h3>📅 Jadwal mingguan karyawan</h3><small class="mu">Pilih shift tiap hari. Jam mulai shift juga dipakai sebagai jam masuk absen (terlambat dihitung dari sini).</small>
<div class="ov"><table class="shtab"><tr><th>Karyawan${SHORD.map((d) => `<th>${SHARI[d]}`).join('')}<th></tr>${us.map((u) => { const a = SHD.as[shKey(u.n)] || {}; return `<tr><td><b>${esc(u.n)}</b><br><small class="mu">${esc(ROLE[u.r] ? ROLE[u.r].split(' ')[0] : u.r || '')}</small>${SHORD.map((d) => `<td><select data-su="${esc(shKey(u.n))}" data-sd="${d}"><option value="">Libur</option>${SHD.defs.map((x) => `<option value="${x.id}" ${a[d] == x.id ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select>`).join('')}<td><button class="gh" title="Samakan semua hari dengan Senin" onclick="shSame('${esc(shKey(u.n))}')">⇉</button></tr>`; }).join('') || '<tr><td colspan="9" class="mu">Belum ada karyawan.</td></tr>'}</table></div>
<button class="pr" style="margin-top:10px" onclick="shSave()">Simpan shift & jadwal</button></div>
<div class="cd"><h3>🔓 Kasir sedang buka</h3>${open.map((x) => { const r = sesSum(x); return `<div class="row"><span><b>${esc(x.u)}</b> · ${esc(x.sn || '-')}<br><small class="mu">buka ${hm(x.t)} · modal ${rp(x.c0)}</small></span><span class="r"><b>${rp(r.omz)}</b><br><small class="mu">${r.n} trx · tunai ${rp(r.exp)}</small></span></div>`; }).join('') || '<small class="mu">Tidak ada.</small>'}</div>
<div class="cd"><h3>🧾 Riwayat closing</h3><div class="ov"><table><tr><th>Kasir<th>Tanggal<th class="n">Omzet<th class="n">Setor tunai<th class="n">Selisih</tr>${hist.map((x) => `<tr><td>${esc(x.u)}<br><small class="mu">${esc(x.sn || '-')}</small><td>${dstr(x.t)}<br><small class="mu">${hm(x.t)}–${hm(x.tc)}</small><td class="n">${rp(x.omz)}<td class="n">${rp(x.cash)}<td class="n ${x.dif ? (x.dif > 0 ? 'or' : 'rd') : 'gr'}">${x.dif ? (x.dif > 0 ? '+' : '−') + rp(Math.abs(x.dif)) : '✓'}</tr>`).join('') || '<tr><td colspan="5" class="mu">Belum ada closing.</td></tr>'}</table></div></div>`;
};
VW.shiftSet.after = () => { if (S.srv && canNet() && Date.now() - (VW.shiftSet.ld || 0) > 6e4) { VW.shiftSet.ld = Date.now(); api('/api/staff').then((r) => { const ch = JSON.stringify(S.staff || []) != JSON.stringify(r.staff); S.staff = r.staff; save(); if (ch && V == 'shiftSet') R(); }).catch(() => { }); } };
document.addEventListener('change', (e) => { const s = e.target.closest('[data-su]'); if (!s || !SHD) return; const a = (SHD.as[s.dataset.su] = SHD.as[s.dataset.su] || {}); if (s.value) a[s.dataset.sd] = s.value; else delete a[s.dataset.sd]; });
function shSame(k) { const a = (SHD.as[k] = SHD.as[k] || {}), v = a[1] || ''; for (const d of SHORD) { if (v) a[d] = v; else delete a[d]; } R(); }
function shSave() {
  for (const d of SHD.defs) { if (!d.n.trim() || !/^\d\d:\d\d$/.test(d.s) || !/^\d\d:\d\d$/.test(d.e)) return toast('Lengkapi nama & jam setiap shift'); }
  const ids = new Set(SHD.defs.map((d) => d.id)); for (const k in SHD.as) for (const d in SHD.as[k]) if (!ids.has(SHD.as[k][d])) delete SHD.as[k][d];
  emit('shs', { x: SHD }); SHD = null; toast('Shift & jadwal disimpan — berlaku di semua HP setelah sinkron'); R();
}
