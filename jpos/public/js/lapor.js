'use strict';
/* ============ LAPORAN KE WA & EMAIL PEMILIK ============
   Pemilik mengisi nomor WA & email. Server mengirim laporan harian otomatis (absen, penjualan, closing kasir,
   stok & keuangan) setiap pergantian hari, dan laporan closing setiap kasir tutup shift. HP mengirim ringkasan
   stok & keuangan ke server (snapshot) agar laporan harian memuat data stok terbaru. */
const rptC = () => LS.get('jpos:rpt:' + SID, {});
const rptWa = () => rptC().wa || '';
async function rptLoad() { if (!S || !S.srv || !canNet()) return; try { const r = await api('/api/rpt'); LS.set('jpos:rpt:' + SID, { wa: r.wa || '', gw: r.gw, cfg: r.cfg, tgN: r.tgN, ownBot: r.ownBot }); return r; } catch (e) { } }

// ringkasan stok & keuangan dari HP → server (maks tiap 20 menit)
function snapData() {
  const low = S.p.filter((p) => !p.x && p.st <= (p.min ?? 10)).sort((a, b) => a.st - (a.min ?? 10) - (b.st - (b.min ?? 10)));
  const now = Date.now(); let ar = 0, od = 0; for (const s of S.sales) { const o = sOut(s); if (o > 0) { ar += o; if (s.due && s.due < now) od += o; } }
  // rincian piutang per faktur (diurutkan jatuh tempo terdekat) untuk laporan WA/email/Telegram
  const arL = S.sales.filter((s) => sOut(s) > 0 && s.due).map((s) => ({ cn: s.cn || '-', due: s.due, amt: Math.round(sOut(s)) })).sort((a, b) => a.due - b.due);
  return { sv: Math.round(S.p.reduce((a, p) => a + Math.max(0, p.st) * (p.co || 0), 0)), bad: Math.round(S.p.reduce((a, p) => a + (p.bv || 0), 0)), nlow: low.length, low: low.slice(0, 15).map((p) => [p.n, p.st, p.min ?? 10]), van: Object.fromEntries(Object.entries(S.van || {}).map(([u, m]) => [u, Object.values(m).reduce((a, v) => a + v, 0)])), kas: Math.round(bal('1101')), bank: Math.round(bal('1102')), ar: Math.round(ar), od: Math.round(od), arN: arL.length, arL: arL.slice(0, 15), ...snapMore() };
}
// tambahan untuk ringkasan Head Admin: jumlah SKU & unit, utang supplier, omzet & laba bulan berjalan
function snapMore() {
  const P = S.p.filter((p) => !p.x), m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0); let lm = 0;
  for (const j of S.j || []) if (j.t >= m0.getTime()) for (const l of j.l || []) if (/^[4-9]/.test(String(l[0]))) lm += (l[2] || 0) - (l[1] || 0);
  return { nsku: P.length, qty: Math.round(P.reduce((a, p) => a + Math.max(0, p.st), 0)), ap: Math.round((S.ap || []).reduce((a, x) => a + apOut(x), 0)), lm: Math.round(lm), om: Math.round(S.sales.filter((s) => s.t >= m0.getTime()).reduce((a, s) => a + netSale(s), 0)) };
}
async function snapPost(force) {
  try {
    if (!S || !U || !S.srv || !canNet() || isExp() || !TK()) return; const k = 'jpos:snapT:' + SID;
    if (!force && Date.now() - LS.get(k, 0) < 12e5) return; LS.set(k, Date.now());
    await api('/api/snap', { method: 'POST', body: JSON.stringify({ d: snapData() }) });
  } catch (e) { }
}
setInterval(() => snapPost(), 6e4);

// pengingat piutang/utang (jatuh tempo ≤2 hari lagi, hari ini, atau sudah lewat) + stok menipis: HP
// pemilik/admin menghitung sendiri (angka SISA yang benar dari replay transaksi, sudah memperhitungkan
// retur/cicilan), lalu kirim ke server untuk diteruskan ke WA/email/Telegram. Dikirim maks 2×/hari —
// sesi "pagi" (sebelum jam 13:00 waktu lokal toko) & sesi "siang" (jam 13:00 ke atas, setelah istirahat
// siang) — server menjatah terpisah per sesi agar tidak dobel walau beberapa HP mengecek bersamaan.
function dueNotifCheck() {
  try {
    if (!S || !U || !['owner', 'admin'].includes(U.r) || !S.srv || !canNet() || isExp() || !TK()) return;
    const tz = ((RPTX && RPTX.cfg) || rptC().cfg || {}).tz || 8;
    const now = Date.now() + tz * 36e5, lh = new Date(now).getUTCHours(), part = lh < 13 ? 'am' : 'pm';
    const today = new Date().toISOString().slice(0, 10), k = 'jpos:dueT:' + SID, sess = today + ':' + part;
    if (LS.get(k, '') === sess) return; // sesi ini (pagi/siang) sudah dicek hari ini
    const d0 = new Date(now); d0.setUTCHours(0, 0, 0, 0);
    const t2 = d0.getTime() - tz * 36e5 + 3 * 864e5; // batas atas: akhir hari ini + 2 hari (tanpa batas bawah → termasuk yg sudah lewat tempo)
    const ar = S.sales.filter((s) => sOut(s) > 0 && s.due && s.due < t2).map((s) => ({ cn: s.cn || '-', no: s.no, amt: Math.round(sOut(s)), due: s.due }));
    const ap = (S.ap || []).filter((a) => apOut(a) > 0 && a.due && a.due < t2).map((a) => ({ sup: a.sup || '-', amt: Math.round(apOut(a)), due: a.due }));
    const low = S.p.filter((p) => !p.x && p.st <= (p.min ?? 10)).map((p) => ({ n: p.n, st: p.st, min: p.min ?? 10 }));
    LS.set(k, sess); // dicatat duluan: baik hasilnya kosong atau gagal kirim, tak perlu dicoba berulang sesi ini
    if (!ar.length && !ap.length && !low.length) return;
    api('/api/notif/due', { method: 'POST', body: JSON.stringify({ ar, ap, low, part }) }).catch(() => { });
  } catch (e) { }
}
setInterval(dueNotifCheck, 3e5);

/* ---------- pengaturan pemilik ---------- */
let RPTX = null;
function rptCard() {
  const c = (RPTX && RPTX.cfg) || rptC().cfg || {}, gw = (RPTX && RPTX.gw) || rptC().gw || {}, tgN = (RPTX && RPTX.tgN) || rptC().tgN || 0, hpWa = LS.get('jpos:info', { wa: '' }).wa, ownBot = (RPTX && RPTX.ownBot) || rptC().ownBot || '';
  if (!RPTX && S.srv && canNet()) rptLoad().then((r) => { if (r) { RPTX = r; if (V == 'set' && !uiTyping()) R(); } });
  const H = Array.from({ length: 24 }, (_, h) => h);
  return `<div class="cd"><h3>📤 Laporan otomatis ke WA, email & Telegram</h3><small class="mu">Absen, penjualan per karyawan, closing kasir, stok menipis, kas & piutang — dikirim ke Anda setiap pergantian hari dan setiap kasir closing. Plus notifikasi langsung piutang baru & pengingat piutang/stok menipis 2×/hari (pagi & siang).</small>
${!S.srv ? '<div class="warnbox">Butuh toko online (terdaftar di server).</div>' : ''}
<div class="fm" style="margin-top:8px"><label><small class="mu">No. WhatsApp pemilik (boleh 2–3, pisahkan koma)</small><input id="rwa" inputmode="tel" placeholder="0813xxxxxxx" value="${esc((c.wa || []).join(', '))}"></label>
<label><small class="mu">Email pemilik (boleh 2–3)</small><input id="rem" type="email" placeholder="nama@email.com" value="${esc((c.em || []).join(', '))}"></label>
<div class="row" style="margin:4px 0"><span>📨 Telegram ${!pkgHas('tg') ? '<b class="mu">· khusus paket High · Distributor</b>' : tgN ? `<b class="gr">· ${tgN} akun terhubung${ownBot ? ' lewat bot sendiri' : ''}</b>` : gw.tg ? '<b class="or">· belum terhubung</b>' : '<b class="mu">· belum aktif (Head Admin)</b>'}</span>${pkgHas('tg') && gw.tg ? `<button class="gh" onclick="tgLink()">${tgN ? 'Hubungkan lagi' : 'Hubungkan'}</button>` : !pkgHas('tg') && hpWa ? `<a class="gh" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(waLink(hpWa, 'Halo, saya ingin naik paket ke High · Distributor untuk toko ' + (S.name || '') + ' (kode ' + SID + ') agar bisa pakai notifikasi Telegram'))}">⬆ Naik paket</a>` : ''}</div>
${tgN ? '<div class="wrap"><button class="gh" onclick="tgUnlink()">Putuskan semua Telegram</button></div>' : ''}
${pkgHas('tg') ? `<details><summary class="mu" style="cursor:pointer">Bot Telegram sendiri (opsional, disarankan) ${ownBot ? `<b class="gr">· @${esc(ownBot)}</b>` : ''}</summary><small class="mu">Supaya laporan toko ini tidak lewat bot bersama J-POS — 1 toko 1 bot sendiri, tidak mungkin tercampur dengan toko lain. Buat gratis lewat Telegram: chat <b>@BotFather</b> → <code>/newbot</code> → salin token ke kolom ini. Ganti atau isi "-" untuk hapus akan memutus akun Telegram yang sudah terhubung (perlu hubungkan ulang).</small><input id="rtgtk" placeholder="${ownBot ? 'tersimpan — isi untuk mengganti, “-” untuk menghapus' : 'token dari @BotFather'}" autocomplete="off"></details>` : ''}
<label class="row" style="margin:4px 0"><span>Kirim laporan harian otomatis</span><input id="ron" type="checkbox" style="width:24px;height:24px" ${c.on !== false ? 'checked' : ''}></label>
<div class="fm2"><label><small class="mu">Jam kirim</small><select id="rh">${H.map((h) => `<option value="${h}" ${(c.h || 0) == h ? 'selected' : ''}>${String(h).padStart(2, '0')}:05${h == 0 ? ' (pergantian hari)' : h < 12 ? ' · lap. kemarin' : ' · lap. hari ini'}</option>`).join('')}</select></label>
<label><small class="mu">Zona waktu toko</small><select id="rtz">${[[7, 'WIB'], [8, 'WITA'], [9, 'WIT']].map(([v, n]) => `<option value="${v}" ${(c.tz || 8) == v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
<label class="row" style="margin:4px 0"><span>Kirim laporan setiap <b>closing kasir</b></span><input id="rcl" type="checkbox" style="width:24px;height:24px" ${c.close !== false ? 'checked' : ''}></label>
<label class="row" style="margin:4px 0"><span>Pengingat piutang/utang & stok menipis (2×/hari: pagi & siang)</span><input id="rdue" type="checkbox" style="width:24px;height:24px" ${c.due !== false ? 'checked' : ''}></label>
<details><summary class="mu" style="cursor:pointer">Gerbang WhatsApp sendiri (opsional)</summary><small class="mu">Isi token Fonnte milik toko bila ingin laporan dikirim dari nomor WA toko sendiri.</small><input id="rtk" placeholder="Token Fonnte" value="${esc(c.tok || '')}" autocomplete="off"></details>
<small>Status pengiriman: WhatsApp ${gw.wa ? '<b class="gr">siap</b>' : '<b class="or">belum aktif</b>'} · Email ${gw.mail ? '<b class="gr">siap</b>' : '<b class="or">belum aktif</b>'} · Telegram ${gw.tg ? '<b class="gr">siap</b>' : '<b class="or">belum aktif</b>'}${gw.wa && gw.mail && gw.tg ? '' : ' <span class="mu">— gerbang diaktifkan pemilik aplikasi (Head Admin). Sementara itu gunakan tombol kirim manual.</span>'}</small>
<div class="wrap"><button class="pr" onclick="rptSave()">Simpan</button><button class="gh" onclick="rptTest()">Kirim tes sekarang</button><button class="gh" onclick="rptManual()">📲 Kirim manual via WA</button></div></div></div>`;
}
async function rptSave() {
  if (!S.srv || !canNet()) return toast('Butuh internet');
  const b = { wa: $('#rwa').value, em: $('#rem').value, on: $('#ron').checked, h: +$('#rh').value, tz: +$('#rtz').value, close: $('#rcl').checked, due: $('#rdue').checked, tok: $('#rtk').value.trim() };
  if ($('#rtgtk')) b.tgtok = $('#rtgtk').value.trim();
  try { const r = await api('/api/rpt', { method: 'PUT', body: JSON.stringify(b) }); RPTX = r; LS.set('jpos:rpt:' + SID, { wa: (r.cfg.wa || [])[0] || '', gw: r.gw, cfg: r.cfg, tgN: r.tgN, ownBot: r.ownBot }); toast('Pengaturan laporan disimpan'); R(); } catch (e) { toast(e.message); }
}
// hubungkan akun Telegram pemilik: minta kode sekali-pakai lalu buka bot dengan deep-link /start=<kode>
async function tgLink() {
  if (!canNet()) return toast('Butuh internet');
  try {
    const r = await api('/api/rpt/tg/code', { method: 'POST', body: '{}' });
    const url = `https://t.me/${r.bot}?start=${r.code}`;
    const m = modal(`<h3>📨 Hubungkan Telegram</h3><small class="mu">Ketuk tombol di bawah untuk membuka bot Telegram, lalu tekan <b>Start</b> di sana. Kode berlaku 15 menit.</small><div class="fm2" style="margin-top:10px"><a class="pr" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="${url}">Buka Telegram</a><button class="gh" id="cp">Salin tautan</button></div>`, 'w');
    $('#cp', m).onclick = () => copyTx(url);
  } catch (e) { toast(e.message); }
}
async function tgUnlink() {
  if (!canNet()) return toast('Butuh internet');
  if (!confirm('Putuskan semua akun Telegram yang terhubung ke toko ini?')) return;
  try { await api('/api/rpt/tg/clear', { method: 'POST', body: '{}' }); RPTX = null; toast('Telegram diputuskan'); R(); } catch (e) { toast(e.message); }
}
function rptShow(text, res) {
  const m = modal(`<h3>Laporan</h3>${res && res.length ? res.map((x) => `<small class="${x.ok ? 'gr' : 'rd'}">${x.ch == 'wa' ? 'WhatsApp' : 'Email'}: ${x.ok ? 'terkirim ✓' : 'gagal — ' + esc(x.e || '')}</small>`).join('<br>') : ''}<pre class="shpre">${esc(text)}</pre><div class="fm2"><a class="pr" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/${esc(rptWa())}?text=${encodeURIComponent(text)}">Kirim via WhatsApp</a><button class="gh" id="cp">Salin</button></div>`, 'w');
  $('#cp', m).onclick = () => copyTx(text);
}
async function rptTest() { if (!canNet()) return toast('Butuh internet'); await snapPost(true); try { const r = await api('/api/rpt/test', { method: 'POST', body: '{}' }); rptShow(r.text, r.res); } catch (e) { toast(e.message); } }
async function rptManual() { if (!canNet()) return toast('Butuh internet'); await snapPost(true); try { const r = await api('/api/rpt/test', { method: 'POST', body: JSON.stringify({ dry: 1 }) }); rptShow(r.text, null); } catch (e) { toast(e.message); } }

/* ---------- Head Admin: gerbang pengiriman ---------- */
function haGwCard() {
  const g = (HA.cfg && HA.cfg.gw) || {};
  return `<div class="cd"><h3>📤 Gerbang laporan otomatis</h3><small class="mu">Dipakai semua toko untuk mengirim laporan harian & closing kasir ke WA / email / Telegram pemilik toko.</small>
<div class="fm"><label><small class="mu">Token WhatsApp Fonnte ${g.wa ? '<b class="gr">· aktif</b>' : '<b class="or">· belum</b>'}</small><input id="gwt" placeholder="${g.wa ? 'tersimpan — isi untuk mengganti, “-” untuk menghapus' : 'token dari fonnte.com'}" autocomplete="off"></label>
<label><small class="mu">API key email Resend ${g.mail ? '<b class="gr">· aktif</b>' : '<b class="or">· belum</b>'}</small><input id="gwm" placeholder="${g.mail ? 'tersimpan — isi untuk mengganti, “-” untuk menghapus' : 're_xxx dari resend.com'}" autocomplete="off"></label>
<label><small class="mu">Pengirim email (domain terverifikasi di Resend)</small><input id="gwf" placeholder="J-POS &lt;laporan@domainanda.com&gt;" value="${esc(g.from || '')}"></label>
<label><small class="mu">Token bot Telegram ${g.tg ? `<b class="gr">· aktif @${esc(g.tgBot || '')}</b>` : '<b class="or">· belum</b>'}</small><input id="gwtg" placeholder="${g.tg ? 'tersimpan — isi untuk mengganti, “-” untuk menghapus' : 'token dari @BotFather'}" autocomplete="off"></label>
<small class="mu">Buat bot gratis lewat Telegram: chat <b>@BotFather</b> → <code>/newbot</code> → salin token yang diberikan ke kolom di atas.</small>
<button class="pr" onclick="haGwSave()">Simpan gerbang</button></div></div>`;
}
async function haGwSave() { try { HA.cfg = await haApi('/api/admin/cfg', { method: 'PUT', body: JSON.stringify({ wa_tok: $('#gwt').value, mail_key: $('#gwm').value, mail_from: $('#gwf').value || '-', tg_tok: $('#gwtg').value }) }); toast('Gerbang disimpan'); R(); } catch (e) { toast(e.message); } }
