// Menambah izin (internet, lokasi, kamera) & mengatur manifest setelah `cap add android`.
const fs = require('fs'), path = require('path');
const mf = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(mf)) { console.error('AndroidManifest.xml tidak ditemukan — jalankan `npx cap add android` dulu'); process.exit(1); }
let x = fs.readFileSync(mf, 'utf8');
const perms = ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.CAMERA'];
const feats = ['<uses-feature android:name="android.hardware.camera" android:required="false" />', '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'];
let add = '';
for (const p of perms) if (!x.includes('"' + p + '"')) add += `    <uses-permission android:name="${p}" />\n`;
for (const f of feats) if (!x.includes(f.match(/name="([^"]+)"/)[1])) add += '    ' + f + '\n';
if (add) x = x.replace(/<\/manifest>\s*$/, add + '</manifest>\n');
if (!/android:usesCleartextTraffic/.test(x)) x = x.replace('<application', '<application android:usesCleartextTraffic="false"');
fs.writeFileSync(mf, x);
console.log('Manifest dipatch:', add.trim().split('\n').length, 'baris ditambahkan');
