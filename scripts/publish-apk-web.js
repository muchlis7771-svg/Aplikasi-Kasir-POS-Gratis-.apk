#!/usr/bin/env node
// Unggah APK rilis (apk-dist/J-POS-latest.apk) ke sistem "Aplikasi di website" Head Admin,
// supaya tombol unduh di halaman promo otomatis mengarah ke APK terbaru tanpa perlu diunggah manual.
// Link yang sudah dibagikan ke TikTok/FB/Instagram/LinkedIn (yang mengarah ke halaman promo) tetap sama;
// hanya file APK di baliknya yang berubah. Potongan lama otomatis dihapus server saat potongan baru di-commit.
//
// Pemakaian: node scripts/publish-apk-web.js <path-apk> "<nama versi>" "<catatan>"
// Env wajib: JPOS_API (alamat Worker), JPOS_ADMIN_USER, JPOS_ADMIN_PASS

const fs = require('fs'), crypto = require('crypto');

const [, , apkPath, versionName, note] = process.argv;
const API = (process.env.JPOS_API || '').replace(/\/$/, '');
const USER = process.env.JPOS_ADMIN_USER || 'headadmin';
const PASS = process.env.JPOS_ADMIN_PASS || '';
const CHUNK = 360 * 1024; // byte mentah per potongan (sebelum base64), harus sama dengan APK_CHUNK di worker/hq.js

async function jreq(path, opt) {
  const r = await fetch(API + path, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt && opt.headers) } });
  let body; try { body = await r.json(); } catch (e) { body = { e: 'respons tidak valid (' + r.status + ')' }; }
  if (!r.ok) throw new Error((body && body.e) || ('HTTP ' + r.status));
  return body;
}

(async () => {
  if (!apkPath || !fs.existsSync(apkPath)) { console.error('File APK tidak ditemukan:', apkPath); process.exit(1); }
  if (!API || !PASS) { console.error('Set env JPOS_API dan JPOS_ADMIN_PASS dulu.'); process.exit(1); }

  const buf = fs.readFileSync(apkPath);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const n = Math.ceil(buf.length / CHUNK);
  console.log(`APK: ${apkPath} (${(buf.length / 1048576).toFixed(1)} MB, ${n} potongan, sha256 ${sha.slice(0, 12)}…)`);

  console.log('Login Head Admin…');
  const login = await jreq('/api/admin/login', { method: 'POST', body: JSON.stringify({ user: USER, pass: PASS }) });
  const HT = login.token;
  const auth = { Authorization: 'Bearer ' + HT };

  const up = crypto.randomBytes(8).toString('hex'); // id unggahan 16 hex, dipakai worker sbg kunci potongan
  for (let i = 0; i < n; i++) {
    const part = buf.subarray(i * CHUNK, (i + 1) * CHUNK).toString('base64');
    await jreq(`/api/admin/apk/chunk?up=${up}&i=${i}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'text/plain' }, body: part });
    process.stdout.write(`\r  mengunggah potongan ${i + 1}/${n}…`);
  }
  console.log('\nCommit…');
  const res = await jreq('/api/admin/apk/commit', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ up, n, size: buf.length, sha, name: versionName || 'J-POS.apk', note: note || '' }),
  });
  console.log('Selesai. APK di website sekarang:', res.name, '—', (res.size / 1048576).toFixed(1), 'MB');
})().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
