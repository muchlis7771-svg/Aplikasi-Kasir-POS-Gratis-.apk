// Penyesuaian khusus build Play Store (AAB rilis): versi, & izin yang dibatasi kebijakan Google Play.
const fs = require('fs'), path = require('path');
const mf = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
// USE_EXACT_ALARM & USE_FULL_SCREEN_INTENT hanya untuk aplikasi jam alarm / telepon → diganti SCHEDULE_EXACT_ALARM (pengguna mengizinkan sendiri)
x = x.replace(/\s*<uses-permission android:name="android\.permission\.USE_EXACT_ALARM"\s*\/>/g, '').replace(/\s*<uses-permission android:name="android\.permission\.USE_FULL_SCREEN_INTENT"\s*\/>/g, '');
if (!x.includes('SCHEDULE_EXACT_ALARM')) x = x.replace(/<\/manifest>\s*$/, '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />\n</manifest>\n');
fs.writeFileSync(mf, x);
const gf = path.join('android', 'app', 'build.gradle');
let g = fs.readFileSync(gf, 'utf8');
const vn = JSON.parse(fs.readFileSync('desktop/package.json', 'utf8')).version, vc = 100 + (+process.env.GITHUB_RUN_NUMBER || 1);
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + vc).replace(/versionName\s+"[^"]*"/, 'versionName "' + vn + '"');
fs.writeFileSync(gf, g);
console.log('Play build: versi', vn, '(kode', vc + ')');
