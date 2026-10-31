// Membuat public/ota.json (daftar file + sidik SHA-256) untuk pembaruan otomatis aplikasi Android tanpa instal ulang.
// Versi = angka di public/sw.js (jpos-vNN), juga ditulis ke APPV di public/js/ota.js. Jalankan setiap rilis.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..', 'public'), SKIP = new Set(['ota.json', 'icons/icon-full.png']);
const v = +fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/jpos-v(\d+)/)[1];
const op = path.join(root, 'js', 'ota.js'); fs.writeFileSync(op, fs.readFileSync(op, 'utf8').replace(/const APPV = \d+;/, `const APPV = ${v};`));
const files = [];
(function walk(d) { for (const n of fs.readdirSync(d).sort()) { const f = path.join(d, n), r = path.relative(root, f).split(path.sep).join('/'); if (fs.statSync(f).isDirectory()) walk(f); else if (!SKIP.has(r) && !n.startsWith('.')) { const b = fs.readFileSync(f); files.push({ p: r, h: crypto.createHash('sha256').update(b).digest('hex').slice(0, 20), s: b.length }); } } })(root);
const note = process.argv.slice(2).join(' ');
fs.writeFileSync(path.join(root, 'ota.json'), JSON.stringify({ v, t: Date.now(), note, files }));
console.log('ota.json v' + v + ':', files.length, 'file,', Math.round(files.reduce((a, f) => a + f.s, 0) / 1024), 'KB');
