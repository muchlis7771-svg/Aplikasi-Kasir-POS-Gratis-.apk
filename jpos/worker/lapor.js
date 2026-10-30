// ============ LAPORAN OTOMATIS KE WHATSAPP & EMAIL PEMILIK ============
// Harian (pergantian hari, lewat Cron Trigger tiap jam) + closing kasir (dikirim saat kasir tutup shift).
// Gerbang kirim: WhatsApp lewat Fonnte (token), email lewat Resend (API key). Diatur Head Admin (berlaku semua toko)
// atau token WA milik toko sendiri. Tanpa gerbang, aplikasi tetap menyediakan tombol kirim manual (wa.me / email).
export const RSCHEMA = [
  'CREATE TABLE IF NOT EXISTS snap(store_id TEXT PRIMARY KEY,t INTEGER,data TEXT)',
  'CREATE TABLE IF NOT EXISTS rptlog(store_id TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,t INTEGER,res TEXT,PRIMARY KEY(store_id,day,kind))',
];
export const RALTER = ['stores ADD COLUMN rpt TEXT', 'buyers ADD COLUMN kind TEXT', 'buyers ADD COLUMN kname TEXT', 'buyers ADD COLUMN kvis INTEGER DEFAULT 0'];

const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const pad = (n) => String(n).padStart(2, '0');
export const rptCfg = (s) => { try { const o = s && s.rpt ? JSON.parse(s.rpt) : null; return o && typeof o == 'object' ? o : {}; } catch (e) { return {}; } };
export function cleanCfg(b) {
  const nums = (v) => String(v || '').split(/[,;\s]+/).map((x) => x.replace(/[^\d]/g, '').replace(/^0/, '62')).filter((x) => x.length >= 9 && x.length <= 16).slice(0, 3);
  const ems = (v) => String(v || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]{1,64}@[^@\s]{1,120}\.[a-z]{2,}$/.test(x)).slice(0, 3);
  return { wa: nums(b.wa), em: ems(b.em), on: !!b.on, close: !!b.close, h: Math.max(0, Math.min(23, Math.round(+b.h) || 0)), tz: [7, 8, 9].includes(+b.tz) ? +b.tz : 8, tok: String(b.tok || '').trim().slice(0, 80) };
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
  const ev = (await env.DB.prepare("SELECT k,t,data FROM ev WHERE store_id=? AND t>=? AND t<? AND k IN ('sale','pay','retur','in','out','visit','shf') ORDER BY t").bind(sid, R.f, to).all()).results.map((x) => { let d = {}; try { d = JSON.parse(x.data); } catch (e) { } return { ...d, k: x.k, t: x.t }; });
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
  }
  L.push('', '_Dikirim otomatis oleh J-POS_');
  return L.join('\n');
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const waToHtml = (t) => '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">' + esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>') + '</div>';

// kirim ke semua saluran yang tersedia; hasil per saluran
export async function sendOut(env, CFG, rc, text, subject) {
  const out = [];
  const tok = rc.tok || CFG.wa_tok;
  if ((rc.wa || []).length) {
    if (!tok) out.push({ ch: 'wa', ok: 0, e: 'gerbang WhatsApp belum diatur' });
    else try {
      const fd = new FormData(); fd.append('target', rc.wa.join(',')); fd.append('message', text); fd.append('countryCode', '62');
      const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: tok }, body: fd });
      const j = await r.json().catch(() => ({})); out.push({ ch: 'wa', ok: r.ok && j.status !== false ? 1 : 0, e: j.reason || j.detail || (r.ok ? '' : 'HTTP ' + r.status) });
    } catch (e) { out.push({ ch: 'wa', ok: 0, e: String(e.message || e).slice(0, 120) }); }
  }
  if ((rc.em || []).length) {
    if (!CFG.mail_key) out.push({ ch: 'email', ok: 0, e: 'gerbang email belum diatur' });
    else try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + CFG.mail_key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: CFG.mail_from || 'J-POS <onboarding@resend.dev>', to: rc.em, subject, text: text.replace(/[*_]/g, ''), html: waToHtml(text) }) });
      const j = await r.json().catch(() => ({})); out.push({ ch: 'email', ok: r.ok ? 1 : 0, e: r.ok ? '' : j.message || 'HTTP ' + r.status });
    } catch (e) { out.push({ ch: 'email', ok: 0, e: String(e.message || e).slice(0, 120) }); }
  }
  return out;
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
      const res = await sendOut(env, CFG, rc, text, 'Laporan harian ' + s.name + ' · ' + R.label);
      await env.DB.prepare('UPDATE rptlog SET res=? WHERE store_id=? AND day=? AND kind=?').bind(JSON.stringify(res), s.id, R.key, 'daily').run(); n++;
    } catch (e) { console.error('cronDaily', s.id, e && e.stack || e); }
  }
  return n;
}
