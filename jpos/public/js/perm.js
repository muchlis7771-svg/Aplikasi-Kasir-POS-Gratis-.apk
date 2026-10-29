'use strict';
/* ============ PAKET APLIKASI (Head Admin) & HAK AKSES PERAN (Owner) ============ */
const tierName = (t) => ((HA.cfg && HA.cfg.pkg && HA.cfg.pkg[t || 'high']) || {}).n || { biasa: 'Biasa', standar: 'Standar', high: 'High' }[t || 'high'] || 'High';
const FGROUP = [
  ['🛒 Penjualan', ['pos', 'his', 'hisAll', 'retur', 'terima']], ['📦 Produk & stok', ['prod', 'prodEdit', 'beli', 'xls']], ['📍 Outlet & lapangan', ['outlet', 'cek', 'ana', 'kirim']],
  ['💰 Keuangan', ['keu', 'jur', 'kas', 'lap', 'backup']], ['👥 Tim', ['abs', 'absAll', 'usr', 'aud', 'chat']], ['🛍️ Lainnya', ['onl', 'anti', 'perm']],
];
const FSUB = { prodEdit: 'prod', hisAll: 'his', absAll: 'abs', aud: 'abs' };

/* ---------- Head Admin: atur isi paket ---------- */
function haPkgCard() {
  const pk = HA.cfg && HA.cfg.pkg; if (!pk) return '';
  const all = (HA.cfg.allf || []).filter((f) => FEAT[f]);
  return `<div class="cd"><h3>📦 Paket aplikasi</h3><small class="mu">Tentukan fitur & batas pengguna tiap paket. Pilih paket per toko lewat tombol “Kelola” di daftar toko. “Beranda” dan “Pengaturan” selalu ada.</small>
<label style="display:block;margin:8px 0"><small class="mu">Paket untuk masa coba (trial) toko baru</small><select id="ptt">${['biasa', 'standar', 'high'].map((t) => `<option value="${t}" ${(HA.cfg.trial_tier || 'high') == t ? 'selected' : ''}>${esc(tierName(t))}</option>`).join('')}</select></label>
${['biasa', 'standar', 'high'].map((t) => { const x = pk[t], fs = new Set(x.f.split(' ')); return `<details class="pkg" style="margin:6px 0"><summary><b>${esc(x.n)}</b> <small class="mu">· ${[...fs].filter((f) => FEAT[f]).length} fitur · maks ${x.max} pengguna</small></summary><div class="fm2" style="margin:8px 0"><label><small class="mu">Nama paket</small><input id="pn_${t}" value="${esc(x.n)}" maxlength="20"></label><label><small class="mu">Maks pengguna</small><input id="px_${t}" type="number" min="1" value="${x.max}"></label></div>${FGROUP.map((g) => `<b style="font-size:12px">${g[0]}</b><div class="wrap">${g[1].filter((f) => all.includes(f)).map((f) => `<label class="chip ${fs.has(f) ? 'g' : ''}" style="cursor:pointer;display:inline-flex;gap:4px;align-items:center"><input type="checkbox" style="width:auto" data-pk="${t}:${f}" ${fs.has(f) ? 'checked' : ''}>${esc(FEAT[f])}</label>`).join('')}</div>`).join('')}</details>`; }).join('')}
<button class="pr" style="margin-top:8px" onclick="haPkgSave()">Simpan paket</button></div>`;
}
async function haPkgSave() {
  const pkg = {};
  for (const t of ['biasa', 'standar', 'high']) pkg[t] = { n: $('#pn_' + t).value.trim() || t, max: num($('#px_' + t).value) || 5, f: $$('[data-pk^="' + t + ':"]').filter((c) => c.checked).map((c) => c.dataset.pk.split(':')[1]).join(' ') };
  try { HA.cfg = await haApi('/api/admin/cfg', { method: 'PUT', body: JSON.stringify({ pkg, trial_tier: $('#ptt').value }) }); toast('Paket disimpan'); R(); } catch (e) { toast(e.message); }
}

/* ---------- Owner: matriks hak akses ---------- */
const PROLES = ['admin', 'akuntan', 'kasir', 'sales', 'dropping'];
let PMD = null;
function pmInit(force) { if (PMD && !force) return; PMD = {}; for (const r of PROLES) PMD[r] = new Set(String((S.pm || {})[r] ?? DEFPERM[r] ?? '').split(' ').filter(Boolean)); }
function pmTog(r, f) {
  const s = PMD[r]; if (!pkgHas(f)) return toast('Fitur ini ada di paket yang lebih tinggi');
  if (s.has(f)) { s.delete(f); for (const k in FSUB) if (FSUB[k] == f) s.delete(k); } else { s.add(f); if (FSUB[f]) s.add(FSUB[f]); }
  R();
}
function pmReset(r) { PMD[r] = new Set((DEFPERM[r] || '').split(' ').filter((f) => f && pkgHas(f))); R(); }
async function pmSave() {
  if (!S.srv || !canNet()) return toast('Butuh internet untuk menyimpan hak akses');
  const pm = {}; for (const r of PROLES) pm[r] = [...PMD[r]].filter((f) => f != 'dash' && f != 'set').concat('dash', 'set').join(' ');
  try { const r = await api('/api/perm', { method: 'PUT', body: JSON.stringify({ pm }) }); S.pm = r.pm; save(); toast('Hak akses disimpan — berlaku untuk semua perangkat'); R(); } catch (e) { toast(e.message); }
}
VW.perm = () => {
  pmInit(); const info = LS.get('jpos:info', { wa: '' }), nU = staffList().length, tot = (S.pf || PKGHI).split(' ').filter((f) => FEAT[f]).length;
  return `<div class="cd hero hero2"><div class="row" style="margin:0"><span><small>Paket aplikasi Anda</small><h2>${esc(S.tn || 'High')}</h2></span><span class="hbadge">${tot} fitur</span></div><small>${S.lim ? nU + ' dari ' + S.lim + ' pengguna terpakai' : ''}${S.exp ? ' · ' + expTxt() : ''}</small>${info.wa ? `<div style="margin-top:10px"><a class="gh" style="text-decoration:none;color:#fff;border-color:#fff8" target="_blank" rel="noopener" href="${esc(waLink(info.wa, 'Halo, saya ingin naik paket J-POS untuk toko ' + (S.name || '') + ' (kode ' + SID + ')'))}">⬆ Naik paket via WhatsApp</a></div>` : ''}</div>
<div class="cd"><h3>🔐 Hak akses karyawan</h3><small class="mu">Centang fitur yang boleh dipakai tiap peran. Fitur 🔒 belum termasuk paket Anda. Pemilik selalu punya semua fitur paket.</small>
<div class="ov" style="margin-top:8px"><table class="pmt"><tr><th>Fitur${PROLES.map((r) => `<th class="c"><small>${esc({ admin: 'Admin', akuntan: 'Akuntan', kasir: 'Kasir', sales: 'Sales', dropping: 'Drop' }[r])}</small>`).join('')}</tr>
${FGROUP.map((g) => `<tr class="gh2"><td colspan="${PROLES.length + 1}"><b>${g[0]}</b></tr>${g[1].filter((f) => f != 'perm' && f != 'anti').map((f) => `<tr><td>${esc(FEAT[f])}${FSUB[f] ? '' : ''}${pkgHas(f) ? '' : ' 🔒'}${PROLES.map((r) => `<td class="c"><input type="checkbox" style="width:20px;height:20px" ${PMD[r].has(f) ? 'checked' : ''} ${pkgHas(f) ? '' : 'disabled'} onchange="pmTog('${r}','${f}')">`).join('')}</tr>`).join('')}`).join('')}</table></div>
<div class="wrap" style="margin-top:10px">${PROLES.map((r) => `<button class="gh" onclick="pmReset('${r}')">Reset ${esc(ROLE[r].replace('Tim ', ''))}</button>`).join('')}</div>
<button class="pr" style="margin-top:10px" onclick="pmSave()">Simpan hak akses</button>${pkgHas('perm') ? '' : '<small class="rd">Pengaturan hak akses tersedia di paket Standar / High. Perubahan tidak akan diterima server.</small>'}</div>
<div class="cd"><h3>Keamanan & anti-curang</h3>${secForm()}</div>`;
};
VW.perm.after = () => { if (S.srv && canNet() && !VW.perm.ld) { VW.perm.ld = 1; api('/api/staff').then((r) => { const ch = (S.staff || []).length != r.staff.length; S.staff = r.staff; save(); if (ch && V == 'perm' && !$('.md')) R(); }).catch(() => { }).finally(() => setTimeout(() => (VW.perm.ld = 0), 8000)); } };
function secForm() {
  const x = S.set, anti = pkgHas('anti'), cek = pkgHas('cek'), sw = (id, lb, on, dis, hint) => `<label class="row" style="margin:6px 0"><span>${lb}${dis ? ' 🔒' : ''}${hint ? '<br><small class="mu">' + hint + '</small>' : ''}</span><input type="checkbox" id="${id}" style="width:24px;height:24px" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}></label>`;
  return `${sw('sc1', 'Selfie berstempel saat absen', x.selfie !== false, !anti, 'Foto wajah + jam server tiap absen masuk/pulang')}${sw('sc2', 'Izinkan absen / check-in saat offline', !!x.aoff, !anti, 'Mati = wajib online agar jam diverifikasi server. Menyala = tetap bisa, tapi ditandai “offline” di audit')}${sw('sc3', 'Wajib check-in sebelum order sales', x.cireq !== false, !cek, 'Sales hanya bisa buat order bila sedang check-in di outlet tsb')}${sw('sc4', 'Foto bukti serah terima (dropping)', x.pod !== false, !anti)}
<div class="fm2"><label><small class="mu">Radius check-in / check-out (meter)</small><input id="sc5" type="number" min="50" value="${+x.cir || 3000}" ${cek ? '' : 'disabled'}></label><label><small class="mu">Akurasi GPS maksimal (meter)</small><input id="sc6" type="number" min="20" value="${+x.gacc || 150}" ${anti ? '' : 'disabled'}></label></div>
<button class="gh a" style="margin-top:8px" onclick="secSave()">Simpan keamanan</button><small class="mu">Catatan: aplikasi tidak bisa mengunci jam Android. Yang dilakukan: stempel waktu dari server, jam HP dibandingkan server, deteksi jam diubah / mundur, deteksi lokasi melompat, dan semua anomali masuk menu Audit.</small>`;
}
function secSave() {
  const g = (i) => $('#' + i); const set = {};
  if (!g('sc1').disabled) { set.selfie = g('sc1').checked; set.aoff = g('sc2').checked; set.pod = g('sc4').checked; set.gacc = Math.max(20, num(g('sc6').value) || 150); }
  if (!g('sc3').disabled) { set.cireq = g('sc3').checked; set.cir = Math.max(50, num(g('sc5').value) || 3000); }
  emit('set', { set }); toast('Pengaturan keamanan disimpan'); R();
}
