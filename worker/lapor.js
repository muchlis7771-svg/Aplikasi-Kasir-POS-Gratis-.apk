// ============ LAPORAN OTOMATIS KE WHATSAPP, EMAIL & TELEGRAM PEMILIK ============
// Harian (pergantian hari, lewat Cron Trigger tiap jam) + closing kasir (dikirim saat kasir tutup shift)
// + piutang baru (langsung saat nota kredit dibuat) + pengingat piutang/utang jatuh tempo besok.
// Gerbang kirim: WhatsApp lewat Fonnte (token), email lewat Resend (API key), Telegram lewat bot (token).
// Diatur Head Admin (berlaku semua toko) atau token WA milik toko sendiri. Tanpa gerbang, aplikasi tetap
// menyediakan tombol kirim manual (wa.me / email).
import { tgSendAll } from './tg.js';
export const RSCHEMA = [
  'CREATE TABLE IF NOT EXISTS snap(store_id TEXT PRIMARY KEY,t INTEGER,data TEXT)',
  'CREATE TABLE IF NOT EXISTS rptlog(store_id TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,t INTEGER,res TEXT,PRIMARY KEY(store_id,day,kind))',
  'CREATE TABLE IF NOT EXISTS notifq(id INTEGER PRIMARY KEY AUTOINCREMENT,sid TEXT NOT NULL,ch TEXT NOT NULL,payload TEXT NOT NULL,text TEXT NOT NULL,subject TEXT,tries INTEGER DEFAULT 0,next INTEGER NOT NULL,created INTEGER NOT NULL,last_err TEXT)',
];
export const RALTER = ['stores ADD COLUMN rpt TEXT', 'buyers ADD COLUMN kind TEXT', 'buyers ADD COLUMN kname TEXT', 'buyers ADD COLUMN kvis INTEGER DEFAULT 0', 'catalog ADD COLUMN tiers TEXT', 'catalog ADD COLUMN kd TEXT', 'catalog ADD COLUMN br TEXT', 'buyers ADD COLUMN sid TEXT'];

const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const pad = (n) => String(n).padStart(2, '0');
export const rptCfg = (s) => { try { const o = s && s.rpt ? JSON.parse(s.rpt) : null; return o && typeof o == 'object' ? o : {}; } catch (e) { return {}; } };
export function cleanCfg(b) {
  const nums = (v) => String(v || '').split(/[,;\s]+/).map((x) => x.replace(/[^\d]/g, '').replace(/^0/, '62')).filter((x) => x.length >= 9 && x.length <= 16).slice(0, 3);
  const ems = (v) => String(v || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]{1,64}@[^@\s]{1,120}\.[a-z]{2,}$/.test(x)).slice(0, 3);
  return { wa: nums(b.wa), em: ems(b.em), on: !!b.on, close: !!b.close, due: b.due === false ? false : true, h: Math.max(0, Math.min(23, Math.round(+b.h) || 0)), tz: [7, 8, 9].includes(+b.tz) ? +b.tz : 8, tok: String(b.tok || '').trim().slice(0, 80) };
}
// waktu lokal toko → rentang UTC
export function dayRange(tz, t, back) {
  const l = new Date(t + tz * 36e5); const y = l.getUTCFullYear(), m = l.getUTCMonth(), d = l.getUTCDate() - (back || 0);
  const f = Date.UTC(y, m, d) - tz * 36e5; const dd = new Date(f + tz * 36e5);
  return { f, t: f + 864e5, key: dd.getUTCFullYear() + '-' + pad(dd.getUTCMonth() + 1) + '-' + pad(dd.getUTCDate()), label: pad(dd.getUTCDate()) + '/' + pad(dd.getUTCMonth() + 1) + '/' + dd.getUTCFullYear() };
}
const hmz = (t, tz) => { const d = new Date(t + tz * 36e5); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };

export async function buildDaily(env, sid, sname, tz, R, upto) {
  const to = Math.min(R.t, upto || R.t);
  const ev = (await env.DB.prepare("SELECT k,t,data FROM ev WHERE store_id=? AND t>=? AND t<? AND k IN ('sale','pay','retur','in','out','visit','shf','kvl','kvb') ORDER BY t").bind(sid, R.f, to).all()).results.map((x) => { let d = {}; try { d = JSON.parse(x.data); } catch (e) { } return { ...d, k: x.k, t: x.t }; });
  const staff = (await env.DB.prepare('SELECT name,role FROM staff WHERE store_id=? ORDER BY created').bind(sid).all()).results;
  const nOut = (await env.DB.prepare("SELECT COUNT(*) n FROM (SELECT json_extract(data,'$.c.id') i, MIN(t) m FROM ev WHERE store_id=? AND k='cu' GROUP BY i) WHERE m>=? AND m<?").bind(sid, R.f, to).first()) || { n: 0 };
  const snap = await env.DB.prepare('SELECT t,data FROM snap WHERE store_id=?').bind(sid).first();
  let S = {}; try { S = snap ? JSON.parse(snap.data) : {}; } catch (e) { }
  const sales = ev.filter((e) => e.k == 'sale'), M = {}, byU = {};
  let omz = 0, kred = 0;
  for (const s of sales) {
    omz += s.tot || 0; const u = byU[s.u] || (byU[s.u] = { n: 0, v: 0 }); u.n++; u.v += s.tot || 0;
    if (s.pay == 'Piutang') { kred += (s.tot || 0) - (s.dpay || 0); if (s.dpay) M[s.dpm || 'Tunai'] = (M[s.dpm || 'Tunai'] || 0) + s.dpay; }
    else M[s.pay] = (M[s.pay] || 0) + (s.tot || 0);
  }
  const pays = ev.filter((e) => e.k == 'pay'), pv = pays.reduce((a, p) => a + (p.amt || 0), 0);
  const L = [];
  L.push('*📊 LAPORAN HARIAN ' + String(sname || '').toUpperCase() + '*', '_' + R.label + (upto && upto < R.t ? ' (s.d. ' + hmz(upto, tz) + ')' : '') + '_', '');
  L.push('*🛒 PENJUALAN*', 'Omzet: *' + rp(omz) + '* (' + sales.length + ' transaksi)');
  for (const m of ['Tunai', 'QRIS', 'Transfer']) if (M[m]) L.push('• ' + m + ': ' + rp(M[m]));
  if (kred) L.push('• Kredit (piutang baru): ' + rp(kred));
  if (pv) L.push('Pelunasan piutang masuk: ' + rp(pv) + ' (' + pays.length + 'x)');
  const rt = ev.filter((e) => e.k == 'retur').length; if (rt) L.push('Retur: ' + rt + ' transaksi');
  const us = Object.entries(byU).sort((a, b) => b[1].v - a[1].v);
  if (us.length) { L.push('', '*👤 PER KARYAWAN*'); for (const [n, x] of us) L.push('• ' + n + ': ' + rp(x.v) + ' (' + x.n + ' trx)'); }
  const cl = ev.filter((e) => e.k == 'shf' && e.op == 'close');
  if (cl.length) { L.push('', '*🔐 CLOSING KASIR*'); for (const c of cl) L.push('• ' + c.u + (c.sn ? ' · ' + c.sn : '') + ': omzet ' + rp(c.omz) + ', setor tunai ' + rp(c.cash) + (c.dif ? ' (selisih ' + (c.dif > 0 ? '+' : '−') + rp(Math.abs(c.dif)) + ')' : ' ✓')); }
  // sales kanvas: muat / balik barang (disetujui admin) & sisa di mobil
  const kv = {}; for (const e of ev) if (e.k == 'kvl' || e.k == 'kvb') { const u = String(e.to || e.u).toLowerCase(), r = kv[u] || (kv[u] = { m: 0, b: 0 }); const q = (e.L || []).reduce((a, i) => a + (+i.q || 0), 0); if (e.k == 'kvl') r.m += q; else r.b += q; }
  for (const s of sales) if (s.r == 'kanvas') { const u = String(s.u).toLowerCase(); (kv[u] = kv[u] || { m: 0, b: 0 }).j = (kv[u].j || 0) + (s.L || []).reduce((a, i) => a + (i.q || 0), 0); }
  if (Object.keys(kv).length || (S.van && Object.keys(S.van).length)) { L.push('', '*🚚 SALES KANVAS*'); const us = new Set([...Object.keys(kv), ...Object.keys(S.van || {})]); for (const u of us) { const r = kv[u] || {}; L.push('• ' + u + ': muat ' + (r.m || 0) + ', terjual ' + (r.j || 0) + ', balik ' + (r.b || 0) + (S.van && S.van[u] != null ? ', sisa mobil ' + S.van[u] : '')); } }
  // absensi
  const A = {}; for (const e of ev) if (e.k == 'in' || e.k == 'out') { const a = A[e.u] || (A[e.u] = {}); if (e.k == 'in' && !a.in) a.in = e.t; if (e.k == 'out') a.out = e.t; }
  const vis = {}; for (const e of ev) if (e.k == 'visit') vis[e.u] = (vis[e.u] || 0) + 1;
  L.push('', '*🕒 ABSENSI*');
  for (const s of staff) { if (s.role == 'owner') continue; const a = A[s.name]; L.push('• ' + s.name + ': ' + (a ? 'masuk ' + hmz(a.in || a.out, tz) + (a.out ? ', pulang ' + hmz(a.out, tz) : '') : '❌ tidak absen') + (vis[s.name] ? ' · ' + vis[s.name] + ' kunjungan' : '')); }
  if (nOut.n) L.push('Outlet baru: ' + nOut.n);
  if (snap) {
    L.push('', '*📦 STOK & KEUANGAN* _(data ' + hmz(snap.t, tz) + ')_');
    if (S.sv != null) L.push('Nilai persediaan: ' + rp(S.sv));
    if (S.bad) L.push('Bad stock: ' + rp(S.bad));
    if (S.low && S.low.length) { L.push('Stok menipis (' + S.nlow + ' item):'); for (const x of S.low.slice(0, 10)) L.push('• ' + x[0] + ': ' + x[1] + (x[2] != null ? ' (min ' + x[2] + ')' : '')); }
    if (S.kas != null) L.push('Kas: ' + rp(S.kas) + ' · Bank/QRIS: ' + rp(S.bank));
    if (S.ar != null) L.push('Piutang outlet: ' + rp(S.ar) + (S.od ? ' (jatuh tempo ' + rp(S.od) + ')' : ''));
    if (S.arL && S.arL.length) {
      L.push('Rincian piutang' + (S.arN > S.arL.length ? ' (' + S.arL.length + ' dari ' + S.arN + ', diurutkan jatuh tempo terdekat)' : ' (diurutkan jatuh tempo terdekat)') + ':');
      for (const x of S.arL) { const d = Math.ceil((x.due - Date.now()) / 864e5), dt = d < 0 ? 'Lewat ' + (-d) + ' hari' : d == 0 ? 'Jatuh tempo hari ini' : d + ' hari lagi'; L.push('• ' + x.cn + ': ' + rp(x.amt) + ' · ' + dt); }
    }
  }
  L.push('', '_Dikirim otomatis oleh J-POS_');
  return L.join('\n');
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const waToHtml = (t) => '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">' + esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>') + '</div>';

async function sendWaOnce(tok, targets, text) {
  if (!tok) return { ch: 'wa', ok: 0, e: 'gerbang WhatsApp belum diatur' };
  try {
    const fd = new FormData(); fd.append('target', targets.join(',')); fd.append('message', text); fd.append('countryCode', '62');
    const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: tok }, body: fd });
    const j = await r.json().catch(() => ({})); return { ch: 'wa', ok: r.ok && j.status !== false ? 1 : 0, e: j.reason || j.detail || (r.ok ? '' : 'HTTP ' + r.status) };
  } catch (e) { return { ch: 'wa', ok: 0, e: String(e.message || e).slice(0, 120) }; }
}
async function sendEmailOnce(mailKey, mailFrom, targets, text, subject) {
  if (!mailKey) return { ch: 'email', ok: 0, e: 'gerbang email belum diatur' };
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + mailKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: mailFrom || 'J-POS <onboarding@resend.dev>', to: targets, subject, text: text.replace(/[*_]/g, ''), html: waToHtml(text) }) });
    const j = await r.json().catch(() => ({})); return { ch: 'email', ok: r.ok ? 1 : 0, e: r.ok ? '' : j.message || 'HTTP ' + r.status };
  } catch (e) { return { ch: 'email', ok: 0, e: String(e.message || e).slice(0, 120) }; }
}
// gagal kirim yg BUKAN karena gerbang belum diatur (jaringan/limit/server pihak ketiga down, dkk) disimpan
// di notifq utk dicoba ulang otomatis lewat cron (lihat notifRetryRun) — supaya laporan/pengingat tidak
// hilang begitu saja. Kegagalan karena gerbang belum diatur TIDAK dimasukkan (akan gagal lagi percuma).
async function enqueueRetry(env, sid, ch, payload, text, subject, err) {
  try {
    await env.DB.prepare('INSERT INTO notifq(sid,ch,payload,text,subject,tries,next,created,last_err) VALUES(?,?,?,?,?,0,?,?,?)')
      .bind(sid, ch, JSON.stringify(payload), text, subject || '', Date.now() + NOTIFQ_BACKOFF[0] * 60000, Date.now(), String(err || '').slice(0, 200)).run();
  } catch (e) { console.error('enqueueRetry', e && e.stack || e); }
}
const NOTIFQ_MAX_TRIES = 5;
const NOTIFQ_BACKOFF = [5, 15, 60, 180, 360]; // menit — makin lama tiap gagal lagi (±24 jam total)
const isCfgMissing = (e) => /belum diatur/.test(String(e || ''));

// kirim ke semua saluran yang tersedia; hasil per saluran. sid dipakai utk antre retry kalau gagal.
export async function sendOut(env, CFG, rc, text, subject, sid) {
  const out = [];
  const tok = rc.tok || CFG.wa_tok;
  if ((rc.wa || []).length) {
    const res = await sendWaOnce(tok, rc.wa, text); out.push(res);
    if (!res.ok && sid && !isCfgMissing(res.e)) await enqueueRetry(env, sid, 'wa', { tok, wa: rc.wa }, text, subject, res.e);
  }
  if ((rc.em || []).length) {
    const res = await sendEmailOnce(CFG.mail_key, CFG.mail_from, rc.em, text, subject); out.push(res);
    if (!res.ok && sid && !isCfgMissing(res.e)) await enqueueRetry(env, sid, 'email', { mailKey: CFG.mail_key, mailFrom: CFG.mail_from, em: rc.em }, text, subject, res.e);
  }
  if ((rc.tg || []).length) {
    const tgTok = rc.tg_tok || CFG.tg_tok; // bot sendiri toko (kalau diatur) lebih diutamakan dari bot bersama
    if (!tgTok) out.push({ ch: 'tg', ok: 0, e: 'bot Telegram belum diatur' });
    else { const res = await tgSendAll(tgTok, rc.tg, text); out.push(res); if (!res.ok && sid) await enqueueRetry(env, sid, 'tg', { tok: tgTok, tg: rc.tg }, text, subject, res.e); }
  }
  return out;
}

// Cron tiap jam: coba ulang notifikasi yg sebelumnya gagal (lihat enqueueRetry). Backoff makin lama tiap
// gagal lagi; setelah NOTIFQ_MAX_TRIES tetap gagal, dibuang (toko tetap bisa kirim manual dari aplikasi).
export async function notifRetryRun(env, now) {
  const rows = (await env.DB.prepare('SELECT * FROM notifq WHERE next<=? ORDER BY id LIMIT 50').bind(now).all()).results;
  let ok = 0, drop = 0;
  for (const r of rows) {
    try {
      let p = {}; try { p = JSON.parse(r.payload); } catch (e) { }
      let res;
      if (r.ch == 'wa') res = await sendWaOnce(p.tok, p.wa || [], r.text);
      else if (r.ch == 'email') res = await sendEmailOnce(p.mailKey, p.mailFrom, p.em || [], r.text, r.subject);
      else if (r.ch == 'tg') res = await tgSendAll(p.tok, p.tg || [], r.text);
      else res = { ok: 0, e: 'saluran tidak dikenal' };
      if (res && res.ok) { await env.DB.prepare('DELETE FROM notifq WHERE id=?').bind(r.id).run(); ok++; continue; }
      const tries = (r.tries || 0) + 1;
      if (tries >= NOTIFQ_MAX_TRIES) { await env.DB.prepare('DELETE FROM notifq WHERE id=?').bind(r.id).run(); drop++; }
      else { const mins = NOTIFQ_BACKOFF[tries] || 360; await env.DB.prepare('UPDATE notifq SET tries=?,next=?,last_err=? WHERE id=?').bind(tries, now + mins * 60000, String((res && res.e) || '').slice(0, 200), r.id).run(); }
    } catch (e) { console.error('notifRetryRun', r.id, e && e.stack || e); }
  }
  return { ok, drop, checked: rows.length };
}

/* ============ PENGINGAT PIUTANG & UTANG JATUH TEMPO + PIUTANG BARU ============
   Dikirim lewat saluran yang sama (WA/email/Telegram). Piutang baru dikirim langsung saat nota kredit
   dibuat (dipanggil dari handler /api/ev). Pengingat jatuh tempo dicek sekali per hari lewat Cron Trigger. */
const rpn = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
export async function notifNewAR(env, CFG, sid, sname, sale) {
  try {
    const s = await env.DB.prepare('SELECT rpt FROM stores WHERE id=?').bind(sid).first(); if (!s) return;
    let rc = {}; try { rc = s.rpt ? JSON.parse(s.rpt) : {}; } catch (e) { }
    if (!((rc.wa || []).length || (rc.em || []).length || (rc.tg || []).length)) return;
    const out = (sale.tot || 0) - (sale.dpay || 0); if (out <= 0) return;
    const d = new Date(sale.due); const due = String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
    const text = `*🆕 PIUTANG BARU — ${String(sname || '').toUpperCase()}*\nOutlet: *${sale.cn || '-'}*\nNota: ${sale.no || '-'}\nJumlah: *${rpn(out)}*\nTempo: ${due}\nOleh: ${sale.u || '-'}`;
    await sendOut(env, CFG, rc, text, 'Piutang baru · ' + (sale.cn || ''), sid);
  } catch (e) { }
}
// Pengingat piutang/utang (jatuh tempo ≤2 hari lagi, hari ini, atau sudah lewat) + stok menipis: dipicu HP
// pemilik/admin (yang sudah punya angka SISA tagihan yang BENAR dari replay transaksi di aplikasi — retur,
// cicilan, dll sudah terhitung), bukan dihitung ulang di server (supplier/piutang punya banyak sumber
// kejadian berbeda, rawan salah hitung bila direplikasi di sini). Server hanya menyaring & meneruskan ke
// WA/email/Telegram, dengan jatah kirim maks 2×/hari per toko (pagi & siang stlh istirahat — b.part menandai
// sesi yang mana, dijatah terpisah per sesi lewat kind 'due_am'/'due_pm' agar tidak dobel walau beberapa HP
// pemilik mengirim bersamaan).
const dueLabel = (due) => { const d = Math.ceil((due - Date.now()) / 864e5); return d < 0 ? 'Lewat ' + (-d) + ' hari' : d == 0 ? 'Jatuh tempo hari ini' : d + ' hari lagi'; };
export async function dueNotify(env, CFG, sid, sname, b, J) {
  const clip = (arr, n) => (Array.isArray(arr) ? arr : []).slice(0, n);
  const ar = clip(b.ar, 30).map((x) => ({ cn: String(x.cn || '-').slice(0, 60), no: String(x.no || '').slice(0, 30), amt: Math.max(0, Math.round(+x.amt) || 0), due: +x.due || 0 })).filter((x) => x.amt > 0).sort((a, c) => a.due - c.due);
  const ap = clip(b.ap, 30).map((x) => ({ sup: String(x.sup || '-').slice(0, 60), amt: Math.max(0, Math.round(+x.amt) || 0), due: +x.due || 0 })).filter((x) => x.amt > 0).sort((a, c) => a.due - c.due);
  const low = clip(b.low, 40).map((x) => ({ n: String(x.n || '-').slice(0, 60), st: Math.round(+x.st) || 0, min: Math.round(+x.min) || 0 }));
  if (!ar.length && !ap.length && !low.length) return J({ ok: 1, sent: 0 });
  const s = await env.DB.prepare('SELECT rpt FROM stores WHERE id=?').bind(sid).first(); const rc = rptCfg(s || {});
  if (rc.due === false) return J({ ok: 1, sent: 0 });
  if (!((rc.wa || []).length || (rc.em || []).length || (rc.tg || []).length)) return J({ ok: 1, sent: 0 });
  const kind = 'due_' + (b.part == 'pm' ? 'pm' : 'am');
  const day = new Date(Date.now() + (rc.tz || 8) * 36e5).toISOString().slice(0, 10);
  const done = await env.DB.prepare('SELECT 1 FROM rptlog WHERE store_id=? AND day=? AND kind=?').bind(sid, day, kind).first();
  if (done) return J({ ok: 1, sent: 0, already: 1 });
  await env.DB.prepare('INSERT OR IGNORE INTO rptlog(store_id,day,kind,t,res) VALUES(?,?,?,?,?)').bind(sid, day, kind, Date.now(), 'kirim').run();
  const L = ['*⏰ PENGINGAT PIUTANG & STOK — ' + String(sname || '').toUpperCase() + '*', ''];
  if (ar.length) { L.push('*📥 Piutang dari outlet (' + ar.length + '):*'); for (const x of ar) L.push('• ' + x.cn + ' · ' + rpn(x.amt) + (x.no ? ' (nota ' + x.no + ')' : '') + ' · ' + dueLabel(x.due)); L.push(''); }
  if (ap.length) { L.push('*📤 Utang ke supplier (' + ap.length + '):*'); for (const x of ap) L.push('• ' + x.sup + ' · ' + rpn(x.amt) + ' · ' + dueLabel(x.due)); L.push(''); }
  if (low.length) { L.push('*📦 Stok menipis (' + low.length + ' SKU):*'); for (const x of low) L.push('• ' + x.n + ': sisa ' + x.st + ' (min ' + x.min + ')'); L.push(''); }
  L.push('_Dikirim otomatis oleh J-POS_');
  const res = await sendOut(env, CFG, rc, L.join('\n'), 'Pengingat piutang & stok · ' + sname, sid);
  await env.DB.prepare('UPDATE rptlog SET res=? WHERE store_id=? AND day=? AND kind=?').bind(JSON.stringify(res), sid, day, kind).run();
  return J({ ok: 1, sent: 1, res });
}

// Cadangan server utk pengingat piutang/utang & stok menipis: kalau HP pemilik/admin TIDAK aktif pas jam
// kirim, Cron Trigger (tiap jam) memakai snapshot terakhir (dikirim HP tiap ≤20 menit saat toko online lewat
// /api/snap — snapData()/snapMore() di client, termasuk arL & apL yg sudah berisi angka SISA yg benar dari
// replay transaksi) supaya pengingat tetap terkirim. Dedup kirim tetap lewat rptlog (sama persis dgn jalur
// dari HP), jadi tidak dobel kalau HP memang aktif & sudah mengirim duluan. Snapshot yg sudah basi (>48 jam,
// toko lama tidak dibuka) dilewati drpd mengirim data usang.
export async function dueCronCheck(env, CFG, now) {
  const rows = (await env.DB.prepare("SELECT s.id sid, s.name sname, s.rpt rpt, sn.t st, sn.data sdata FROM stores s JOIN snap sn ON sn.store_id=s.id WHERE s.status='active' AND s.rpt IS NOT NULL").all()).results;
  let n = 0;
  for (const r of rows) {
    try {
      if (now - (r.st || 0) > 48 * 36e5) continue; // snapshot basi, lewati
      const rc = rptCfg({ rpt: r.rpt }), tz = rc.tz || 8;
      const lh = new Date(now + tz * 36e5).getUTCHours();
      if (lh < 7 || lh >= 21) continue; // di luar jam wajar toko buka; coba lagi jam berikutnya
      const part = lh < 13 ? 'am' : 'pm';
      let S = {}; try { S = r.sdata ? JSON.parse(r.sdata) : {}; } catch (e) { continue; }
      const d0 = new Date(now + tz * 36e5); d0.setUTCHours(0, 0, 0, 0);
      const t2 = d0.getTime() - tz * 36e5 + 3 * 864e5; // batas atas: akhir hari ini + 2 hari (tanpa batas bawah → termasuk yg sudah lewat tempo)
      const ar = (S.arL || []).filter((x) => x.due && x.due < t2);
      const ap = (S.apL || []).filter((x) => x.due && x.due < t2);
      const low = (S.low || []).map((x) => ({ n: x[0], st: x[1], min: x[2] }));
      const res = await dueNotify(env, CFG, r.sid, r.sname, { ar, ap, low, part }, (o) => o);
      if (res && res.sent) n++;
    } catch (e) { console.error('dueCronCheck', r.sid, e && e.stack || e); }
  }
  return n;
}

// Cron tiap jam: kirim laporan harian ke toko yang jam lokalnya = jam kirim yang dipilih pemilik
export async function cronDaily(env, CFG, now) {
  const st = (await env.DB.prepare("SELECT id,name,rpt,exp,status FROM stores WHERE rpt IS NOT NULL AND status='active'").all()).results;
  let n = 0;
  for (const s of st) {
    const rc = rptCfg(s); if (!rc.on || (!(rc.wa || []).length && !(rc.em || []).length)) continue;
    if (s.exp && now > s.exp + 3 * 864e5) continue;
    const tz = rc.tz || 8, lh = new Date(now + tz * 36e5).getUTCHours(); if (lh != (rc.h || 0)) continue;
    const R = dayRange(tz, now, (rc.h || 0) < 12 ? 1 : 0); // jam 00–11 → laporan kemarin; jam 12–23 → laporan hari ini
    const done = await env.DB.prepare('SELECT 1 FROM rptlog WHERE store_id=? AND day=? AND kind=?').bind(s.id, R.key, 'daily').first(); if (done) continue;
    await env.DB.prepare('INSERT OR IGNORE INTO rptlog(store_id,day,kind,t,res) VALUES(?,?,?,?,?)').bind(s.id, R.key, 'daily', now, 'kirim').run();
    try {
      const text = await buildDaily(env, s.id, s.name, tz, R, (rc.h || 0) < 12 ? 0 : now);
      const res = await sendOut(env, CFG, rc, text, 'Laporan harian ' + s.name + ' · ' + R.label, s.id);
      await env.DB.prepare('UPDATE rptlog SET res=? WHERE store_id=? AND day=? AND kind=?').bind(JSON.stringify(res), s.id, R.key, 'daily').run(); n++;
    } catch (e) { console.error('cronDaily', s.id, e && e.stack || e); }
  }
  return n;
}
