'use strict';
/* ============ GAJI, LEMBUR & IZIN MASUK ============
   Pemilik mengatur level gaji & uang lembur, menetapkan level tiap karyawan, dan menandai tanggal merah.
   Hari kerja = hari dalam bulan − hari Minggu − tanggal merah. Gaji harian = gaji pokok ÷ hari kerja.
   Potongan = hari tidak hadir (hari kerja terjadwal tanpa absen masuk) × gaji harian.
   Lembur = masuk di hari libur dengan persetujuan admin / pemilik → dibayar uang lembur.
   Karyawan hanya bisa membuka aplikasi pada jam shift-nya, kecuali diizinkan admin / pemilik. */
const GJ = () => (S.gj = S.gj || { cfg: {}, req: [] });
const gjCfg = () => GJ().cfg || {};
const GJROLES = ['kasir', 'spg', 'sales', 'kanvas', 'dropping', 'akuntan'];
const gjLock = () => { const c = gjCfg(); return Array.isArray(c.lv) && c.lv.length > 0 && c.lock !== false; }; // aktif setelah pemilik menyimpan pengaturan gaji
const isHol = (d) => { const k = typeof d == 'string' ? d : dkey(d.getTime ? d.getTime() : d), dt = new Date(k + 'T12:00:00'); if (dt.getDay() == 0) return true; if ((gjCfg().hol || []).includes(k)) return true; const t = (S.tcal || {})[k.slice(0, 7)]; return !!(t && (t.off || []).includes(k)); };
const gjKey = (u) => String(u || '').toLowerCase();
function gjLevel(u) { const c = gjCfg(), e = (c.emp || {})[gjKey(u)] || {}, lv = (c.lv || []).find((x) => x.id == e.lv) || null; return { lv, g: +e.g || (lv ? +lv.g : 0), ot: +e.ot || (lv ? +lv.ot : 0) }; }
const gjHasSh = (u) => shDefs().length > 0 && (Object.keys(((S.shs && S.shs.as) || {})[shKey(u)] || {}).length > 0 || Object.keys(((S.shs && S.shs.dt) || {})[shKey(u)] || {}).length > 0);
const gjExpected = (u, k) => !isHol(k) && (!gjHasSh(u) || !!shiftFor(u, new Date(k + 'T12:00:00').getTime()));
const gjReq = (u, k, st) => (GJ().req || []).filter((r) => (!u || gjKey(r.u) == gjKey(u)) && (!k || r.d == k) && (!st || r.st == st));

function gjCalc(u, m) {
  const [y, mo] = m.split('-').map(Number), today = dkey(Date.now()), ins = {};
  for (const a of S.att) if (gjKey(a.u) == gjKey(u) && a.k == 'in') ins[dkey(a.t)] = 1;
  const L = gjLevel(u), since = gjCfg().since || today; let hk = 0, exp = 0, hadir = 0, absen = 0, libur = 0; const absDays = [], ot = [];
  for (let d = new Date(y, mo - 1, 1); d.getMonth() == mo - 1; d.setDate(d.getDate() + 1)) {
    const k = dkey(d.getTime()), hol = isHol(k);
    if (hol) libur++; else hk++;
    if (k > today) continue;
    if (gjExpected(u, k)) { if (k < today || ins[k]) { exp++; if (ins[k] || k < since) hadir++; else { absen++; absDays.push(d.getDate()); } } }
    const r = gjReq(u, k, 'ok').find((x) => x.kind == 'lembur'); if (r && ins[k]) ot.push({ d: k, amt: r.amt != null ? +r.amt : L.ot });
  }
  const rate = hk ? L.g / hk : 0, pot = Math.round(rate * absen), uot = ot.reduce((a, x) => a + x.amt, 0);
  return { ...L, hk, libur, exp, hadir, absen, absDays, rate, pot, ot, uot, tot: Math.max(0, L.g - pot) + uot, paid: (S.gj.paid || {})[gjKey(u) + '|' + m] };
}

/* ---------- penjaga jam kerja (dipanggil di R) ---------- */
function workWin(u) {
  const n = new Date(), k = dkey(n.getTime()), mins = n.getHours() * 60 + n.getMinutes();
  if (gjReq(u, k, 'ok').length) return { ok: true };
  if (isHol(k)) return { ok: false, kind: 'lembur', why: 'Hari ini hari libur (' + (n.getDay() == 0 ? 'Minggu' : 'tanggal merah') + ').' };
  if (shDefs().length && gjHasSh(u)) {
    const s = shiftFor(u); if (!s) return { ok: false, kind: 'lembur', why: 'Hari ini jadwal Anda libur.' };
    const a = tmin(s.s) - 30, b = tmin(s.e) + 60, inn = b > a ? mins >= a && mins <= b : mins >= a || mins <= b % 1440;
    return inn ? { ok: true } : { ok: false, kind: 'luar', why: 'Shift Anda hari ini ' + s.n + ' ' + s.s + '–' + s.e + '. Aplikasi bisa dibuka 30 menit sebelum shift sampai 1 jam setelah shift selesai.' };
  }
  const j = String(S.set.jin || '08:00').split(':'), a = +j[0] * 60 + +j[1] - 30;
  return mins >= a && mins <= 23 * 60 ? { ok: true } : { ok: false, kind: 'luar', why: 'Jam kerja dimulai ' + esc(S.set.jin || '08:00') + '. Aplikasi bisa dibuka mulai 30 menit sebelumnya.' };
}
const workGate = () => !!(U && S && GJROLES.includes(U.r) && gjLock() && !workWin(U.n).ok);
function workGateView() {
  const w = workWin(U.n), k = dkey(Date.now()), pend = gjReq(U.n, k, 'tunggu'), no = gjReq(U.n, k, 'tolak');
  return `<main class="gate"><div class="gc"><div class="gico">${ico('lock')}</div><h2 style="margin:6px 0">Di luar jam kerja</h2><small class="gh1">${esc(U.n)} · ${esc(ROLE[U.r] || U.r)} · ${todayLong()}</small>
<div class="gmsg"><b>${esc(w.why || '')}</b><small>${w.kind == 'lembur' ? 'Bila Anda masuk lembur hari ini, minta persetujuan admin / pemilik. Lembur yang disetujui dibayar sesuai uang lembur.' : 'Minta izin admin / pemilik bila perlu membuka aplikasi sekarang.'}</small></div>
${pend.length ? '<div class="gmsg"><b>⏳ Permintaan terkirim</b><small>Menunggu persetujuan admin / pemilik. Layar ini terbuka otomatis setelah disetujui.</small></div><button class="gbtn" onclick="sync().then(R)">⟳ Cek persetujuan</button>' : `<input id="gzn" placeholder="${w.kind == 'lembur' ? 'Alasan lembur (mis. stok opname, pesanan besar)' : 'Alasan (mis. ada pengiriman pagi)'}"><button class="gbtn" onclick="gjAsk('${w.kind}')">${w.kind == 'lembur' ? 'Minta izin lembur' : 'Minta izin masuk'}</button>`}
${no.length ? `<small class="rd">Permintaan sebelumnya ditolak${no[no.length - 1].why ? ': ' + esc(no[no.length - 1].why) : ''}.</small>` : ''}
<button class="gh big" style="margin-top:10px;color:#fff;border-color:#ffffff44;background:transparent" onclick="logout()">Keluar</button></div></main>`;
}
function gjAsk(kind) { const note = ($('#gzn') || {}).value || ''; emit('gji', { op: 'izin', d: dkey(Date.now()), kind, note: note.trim().slice(0, 120) }); toast('Permintaan terkirim ke admin / pemilik'); R(); setTimeout(() => { try { sync(); } catch (e) { } }, 300); }
let gjPoll = 0; setInterval(() => { try { if (U && S && workGate() && gjReq(U.n, dkey(Date.now()), 'tunggu').length && canNet() && Date.now() - gjPoll > 25000) { gjPoll = Date.now(); sync().then(() => { if (!workGate()) { toast('Disetujui — selamat bekerja'); R(); } }); } } catch (e) { } }, 5000);

/* ---------- persetujuan (admin / pemilik) ---------- */
const gjPend = () => gjReq(null, null, 'tunggu').filter((r) => r.d >= dkey(Date.now() - 2 * 864e5));
function gjApprove(no, ok) {
  const r = (GJ().req || []).find((x) => x.no == no); if (!r) return;
  if (!ok) { const why = prompt('Alasan ditolak (opsional):'); if (why === null) return; emit('gji', { op: 'tolak', ref: no, why }); toast('Ditolak'); return R(); }
  if (r.kind == 'lembur') {
    const L = gjLevel(r.u), m = modal(`<h3>Setujui lembur · ${esc(r.u)}</h3><small class="mu">${dstr(new Date(r.d + 'T12:00:00').getTime())}${r.note ? ' · ' + esc(r.note) : ''}</small><label><small class="mu">Uang lembur hari ini (Rp)</small><input id="gla" type="number" min="0" value="${L.ot || 0}"></label><small class="mu">Bawaan dari level ${esc(L.lv ? L.lv.n : '-')}. Dibayar bila karyawan benar-benar absen masuk.</small><button class="pr" id="ok">Setujui lembur</button>`);
    $('#ok', m).onclick = () => { emit('gji', { op: 'ok', ref: no, amt: num($('#gla', m).value) }); m.close(); toast('Lembur disetujui'); R(); };
  } else { emit('gji', { op: 'ok', ref: no }); toast('Izin masuk disetujui'); R(); }
}
function gjPendCard() {
  const L = gjPend(); if (!L.length || !['owner', 'admin'].includes(U.r)) return '';
  return `<div class="cd fbar"><b>⏳ Permintaan izin masuk / lembur (${L.length})</b>${L.map((r) => `<div class="row kvrow"><span><b>${esc(r.u)}</b> · ${r.kind == 'lembur' ? '🌙 Lembur' : '🔓 Masuk di luar jam'}<br><small class="mu">${dstr(new Date(r.d + 'T12:00:00').getTime())} ${hm(r.t)}${r.note ? ' · ' + esc(r.note) : ''}</small></span><span class="wrap" style="flex-wrap:nowrap"><button class="gh d" onclick="gjApprove('${r.no}',0)">Tolak</button><button class="gh pri" onclick="gjApprove('${r.no}',1)">Setujui</button></span></div>`).join('')}</div>`;
}

/* ---------- halaman Gaji ---------- */
let GM = '', GT = 'rekap', GD = null;
const gjUsers = () => (typeof tgtUsers == 'function' ? tgtUsers() : []).filter((u) => u.r && u.r != 'owner');
VW.gaji = () => {
  if (!GM) GM = ymNow(); const own = U.r == 'owner';
  const tabs = [['rekap', 'Rekap gaji'], ...(own ? [['atur', 'Level & karyawan'], ['libur', 'Tanggal merah']] : [])];
  return gjPendCard() + `<div class="cd"><div class="fm2"><label><small class="mu">Bulan</small><input type="month" value="${GM}" onchange="GM=this.value||ymNow();R()"></label><span></span></div><div class="seg" style="margin-top:8px">${tabs.map((t) => `<button class="${GT == t[0] ? 'a' : ''}" onclick="GT='${t[0]}';GD=null;R()">${t[1]}</button>`).join('')}</div></div>` + (GT == 'atur' && own ? gjAtur() : GT == 'libur' && own ? gjLibur() : gjRekap());
};
function gjRekap() {
  const us = gjUsers(), rows = us.map((u) => ({ u, c: gjCalc(u.n, GM) })), tot = rows.reduce((a, x) => a + x.c.tot, 0), [y, mo] = GM.split('-').map(Number);
  const c0 = rows[0] ? rows[0].c : gjCalc('-', GM);
  return `<div class="kp"><div class="cd k0"><small>Total gaji ${GM == ymNow() ? '(berjalan)' : ''}</small><h2>${rp(tot)}</h2><small>${rows.length} karyawan</small></div><div class="cd k1"><small>Hari kerja</small><h2>${c0.hk} hari</h2><small>libur ${c0.libur} hari (Minggu + tanggal merah)</small></div></div>
${rows.map(({ u, c }) => `<div class="cd gji"><div class="row" style="margin:0"><span><b style="font-size:15px">${esc(u.n)}</b><br><small class="mu">${esc(ROLE[u.r] || u.r)} · ${c.lv ? 'Level ' + esc(c.lv.n) : '<span class="or">level belum diatur</span>'}</small></span><span class="r"><small class="mu">Diterima</small><br><b class="gr" style="font-size:17px">${rp(c.tot)}</b></span></div>
<div class="pnums"><span><small>Gaji pokok</small><b>${rp(c.g)}</b></span><span><small>Hadir / jadwal</small><b>${c.hadir} / ${c.exp}</b></span><span><small>Tidak hadir</small><b class="${c.absen ? 'rd' : ''}">${c.absen} hari</b></span><span><small>Lembur</small><b class="${c.ot.length ? 'gr' : ''}">${c.ot.length} hari</b></span></div>
<small class="mu">Gaji harian ${rp(Math.round(c.rate))} · potongan <b class="${c.pot ? 'rd' : ''}">−${rp(c.pot)}</b>${c.absDays.length ? ' (tgl ' + c.absDays.join(', ') + ')' : ''} · uang lembur <b class="gr">+${rp(c.uot)}</b>${c.paid ? ' · <b class="gr">✓ dibayar ' + dstr(c.paid) + '</b>' : ''}</small>
<div class="wrap" style="margin-top:8px"><button class="gh" onclick="gjSlip('${esc(u.n)}')">🧾 Slip gaji</button>${U.r == 'owner' && !c.paid && GM <= ymNow() ? `<button class="gh pri" onclick="gjPay('${esc(u.n)}')">Bayar & catat</button>` : ''}</div></div>`).join('') || '<div class="cd mu c">Belum ada karyawan.</div>'}
<small class="mu" style="display:block;margin:0 4px 12px">Tidak hadir dihitung dari hari kerja terjadwal yang sudah lewat tanpa absen masuk. Bulan berjalan: hari ini belum dihitung tidak hadir. Absen mulai dihitung sejak ${esc(dstr(new Date((gjCfg().since || dkey(Date.now())) + 'T12:00:00').getTime()))} (pertama kali pengaturan gaji disimpan).</small>`;
}
function gjSlipText(n) {
  const c = gjCalc(n, GM), [y, mo] = GM.split('-').map(Number), nm = new Date(y, mo - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return ['*SLIP GAJI ' + String(S.name || '').toUpperCase() + '*', '_' + nm + '_', '', 'Nama: *' + n + '*', 'Level: ' + (c.lv ? c.lv.n : '-'), '', 'Gaji pokok: ' + rp(c.g), 'Hari kerja bulan ini: ' + c.hk + ' hari (libur ' + c.libur + ')', 'Hadir: ' + c.hadir + ' dari ' + c.exp + ' hari terjadwal', 'Tidak hadir: ' + c.absen + ' hari × ' + rp(Math.round(c.rate)) + ' = −' + rp(c.pot), 'Lembur: ' + c.ot.length + ' hari = +' + rp(c.uot), '', '*Total diterima: ' + rp(c.tot) + '*', '', '_Dibuat oleh J-POS_'].join('\n');
}
function gjSlip(n) { const t = gjSlipText(n), m = modal(`<h3>Slip gaji · ${esc(n)}</h3><pre class="shpre">${esc(t)}</pre><div class="fm2"><a class="pr" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t)}">Kirim via WhatsApp</a><button class="gh" id="cp">Salin</button></div>`, 'w'); $('#cp', m).onclick = () => copyTx(t); }
function gjPay(n) {
  const c = gjCalc(n, GM); if (!confirm('Bayar gaji ' + n + ' ' + rp(c.tot) + ' dan catat sebagai Beban Gaji di pembukuan?')) return;
  const mth = prompt('Dibayar dengan (Tunai / Transfer):', 'Transfer') || 'Transfer';
  if (c.tot > 0) emit('exp', { a: '6101', amt: c.tot, m: /tun/i.test(mth) ? 'Tunai' : 'Transfer', d: 'Gaji ' + n + ' ' + GM });
  emit('gji', { op: 'paid', u: n, m: GM, amt: c.tot }); toast('Gaji dibayar & tercatat di Beban Gaji'); R();
}
function gjAtur() {
  const c = gjCfg(); if (!GD) GD = JSON.parse(JSON.stringify({ lv: c.lv || [{ id: 'l1', n: '1 · Junior', g: 1500000, ot: 75000 }, { id: 'l2', n: '2 · Senior', g: 2200000, ot: 100000 }, { id: 'l3', n: '3 · Kepala', g: 3000000, ot: 150000 }], emp: c.emp || {}, lock: c.lock !== false }));
  const us = gjUsers();
  return `<div class="cd"><h3>💼 Level gaji</h3><small class="mu">Gaji pokok per bulan dan uang lembur per hari (masuk di hari libur dengan persetujuan).</small>
${GD.lv.map((l, i) => `<div class="shrow" style="grid-template-columns:1fr 1fr 44px"><input value="${esc(l.n)}" placeholder="Nama level" onchange="GD.lv[${i}].n=this.value"><input type="number" value="${l.g}" placeholder="Gaji pokok / bulan (Rp)" onchange="GD.lv[${i}].g=num(this.value)"><input type="number" value="${l.ot}" placeholder="Uang lembur / hari (Rp)" onchange="GD.lv[${i}].ot=num(this.value)"><button class="gh d" aria-label="Hapus level" onclick="GD.lv.splice(${i},1);R()">✕</button></div>`).join('')}
<button class="gh" style="margin-top:6px" onclick="GD.lv.push({id:'l'+uid().slice(0,6),n:'Level '+(GD.lv.length+1),g:0,ot:0});R()">+ Level</button></div>
<div class="cd"><h3>👥 Level tiap karyawan</h3><small class="mu">Kosongkan "gaji khusus" bila mengikuti level.</small>
${us.map((u) => { const e = GD.emp[gjKey(u.n)] || {}; return `<div class="row kvrow" style="gap:6px"><span style="min-width:90px"><b>${esc(u.n)}</b><br><small class="mu">${esc(ROLE[u.r] || u.r)}</small></span><select style="width:auto;max-width:140px" onchange="(GD.emp['${gjKey(u.n)}']=GD.emp['${gjKey(u.n)}']||{}).lv=this.value"><option value="">— level —</option>${GD.lv.map((l) => `<option value="${l.id}" ${e.lv == l.id ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select><input type="number" style="width:120px" value="${e.g || ''}" placeholder="Gaji khusus" onchange="(GD.emp['${gjKey(u.n)}']=GD.emp['${gjKey(u.n)}']||{}).g=num(this.value)"></div>`; }).join('') || '<small class="mu">Belum ada karyawan.</small>'}</div>
<div class="cd"><label class="row" style="margin:0"><span><b>🔒 Karyawan hanya bisa membuka aplikasi di jam kerja / shift</b><br><small class="mu">Di luar jam itu, karyawan harus minta izin admin / pemilik (hari libur = izin lembur). Berlaku untuk kasir, SPG, sales, kanvas, dropping & akuntan.</small></span><input type="checkbox" style="width:24px;height:24px;flex:none" ${GD.lock ? 'checked' : ''} onchange="GD.lock=this.checked"></label></div>
<button class="pr" style="margin-bottom:12px" onclick="gjSave()">💾 Simpan pengaturan gaji</button>`;
}
function gjSave(extra) { const c = gjCfg(); emit('gji', { op: 'cfg', cfg: { lv: (GD ? GD.lv : c.lv || []).filter((l) => String(l.n).trim()), emp: GD ? GD.emp : c.emp || {}, lock: GD ? GD.lock : c.lock !== false, since: c.since, hol: c.hol || [], ...(extra || {}) } }); GD = null; toast('Pengaturan gaji disimpan'); R(); }
function gjLibur() {
  const [y, mo] = GM.split('-').map(Number), hol = new Set(gjCfg().hol || []), first = new Date(y, mo - 1, 1).getDay(), days = [];
  for (let d = new Date(y, mo - 1, 1); d.getMonth() == mo - 1; d.setDate(d.getDate() + 1)) days.push({ k: dkey(d.getTime()), d: d.getDate(), sun: d.getDay() == 0 });
  return `<div class="cd"><h3>📅 Tanggal merah ${esc(new Date(y, mo - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))}</h3><small class="mu">Ketuk tanggal untuk menandai libur nasional / cuti bersama. Hari Minggu otomatis libur. Tanggal merah tidak dihitung sebagai hari kerja; masuk di tanggal merah = lembur.</small>
<div class="tkal">${['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((h) => `<b>${h}</b>`).join('')}${'<span></span>'.repeat(first)}${days.map((x) => `<button class="${x.sun ? 'off' : hol.has(x.k) ? 'off' : 'w'}" ${x.sun ? 'disabled' : ''} onclick="gjHol('${x.k}')">${x.d}</button>`).join('')}</div>
<small class="mu">Hari kerja bulan ini: <b>${days.filter((x) => !isHol(x.k)).length}</b> · libur: <b>${days.filter((x) => isHol(x.k)).length}</b></small></div>`;
}
function gjHol(k) { const h = new Set(gjCfg().hol || []); if (h.has(k)) h.delete(k); else h.add(k); GD = null; gjSave({ hol: [...h].filter((x) => x >= dkey(Date.now() - 400 * 864e5)).sort() }); }
// slip milik karyawan sendiri (halaman Absensi)
function gjMine() { if (!S.gj || !gjLevel(U.n).g || U.r == 'owner') return ''; const c = gjCalc(U.n, ymNow()); return `<div class="cd"><div class="row" style="margin:0"><b>💼 Perkiraan gaji bulan ini</b><b class="gr">${rp(c.tot)}</b></div><small class="mu">Pokok ${rp(c.g)} · tidak hadir ${c.absen} hari (−${rp(c.pot)}) · lembur ${c.ot.length} hari (+${rp(c.uot)})</small></div>`; }
// tempel kartu persetujuan (beranda & shift admin) dan perkiraan gaji (absensi karyawan)
addEventListener('DOMContentLoaded', () => { for (const [k, f] of [['dash', gjPendCard], ['shiftSet', gjPendCard], ['abs', gjMine]]) { const o = VW[k]; if (!o || o.gj) continue; const w = () => { let h = ''; try { h = f(); } catch (e) { console.error(e); } return h + o(); }; w.after = o.after; w.gj = 1; VW[k] = w; } });
VW.gaji.after = () => { if (S.srv && canNet() && Date.now() - (VW.gaji.ld || 0) > 6e4) { VW.gaji.ld = Date.now(); api('/api/staff').then((r) => { const ch = JSON.stringify(S.staff || []) != JSON.stringify(r.staff); S.staff = r.staff; save(); if (ch && V == 'gaji') R(); }).catch(() => { }); } };
