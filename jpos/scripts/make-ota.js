// Membuat public/ota.json (daftar file + sidik SHA-256) untuk pembaruan OTA aplikasi Android — versi WEBSITE (mainwt).
// Sama seperti scripts/make-ota.js di repo aplikasi (dev), tapi folder public/ di sini punya isi tambahan khusus
// website (promo/, report/, dan file dup lama public/ota.js) yang TIDAK ikut dikirim ke APK, jadi harus dikecualikan.
// Versi = angka di public/sw.js (jpos-vNN), juga ditulis ke APPV di public/js/ota.js. Jalankan setiap rilis.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..', 'public');
const SKIP = new Set(['ota.json', 'icons/icon-full.png', 'ota.js']); // ota.js (root) = dup lama tak terpakai, lihat index.html yang hanya memuat js/ota.js
const SKIP_DIR = new Set(['promo', 'report']); // khusus website, tidak termasuk build APK
const v = +fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/jpos-v(\d+)/)[1];
const op = path.join(root, 'js', 'ota.js'); fs.writeFileSync(op, fs.readFileSync(op, 'utf8').replace(/const APPV = \d+;/, `const APPV = ${v};`));
const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d).sort()) {
    const f = path.join(d, n), r = path.relative(root, f).split(path.sep).join('/');
    if (fs.statSync(f).isDirectory()) { if (!SKIP_DIR.has(r)) walk(f); }
    else if (!SKIP.has(r) && !n.startsWith('.')) { const b = fs.readFileSync(f); files.push({ p: r, h: crypto.createHash('sha256').update(b).digest('hex').slice(0, 20), s: b.length }); }
  }
})(root);
// --min=N (opsional): paksa semua pengguna yang versinya < N untuk update sebelum bisa memakai aplikasi lagi.
// Hanya pakai untuk pembaruan kritis (keamanan/bug fatal) — jangan dipakai di rilis biasa.
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--min='));
const minArg = process.argv.slice(2).find((a) => a.startsWith('--min='));
const min = minArg ? +minArg.slice(6) : undefined;
const note = argv.join(' ');
if (min && min > v) { console.error('GAGAL: --min=' + min + ' lebih besar dari versi sw.js (v' + v + ') — semua pengguna akan terkunci tanpa jalan keluar. Naikkan jpos-vNN di public/sw.js dulu.'); process.exit(1); }
fs.writeFileSync(path.join(root, 'ota.json'), JSON.stringify({ v, t: Date.now(), note, ...(min ? { min } : {}), files }));
console.log('ota.json v' + v + ':', files.length, 'file,', Math.round(files.reduce((a, f) => a + f.s, 0) / 1024), 'KB' + (min ? ' · WAJIB update ke v' + min : ''));
