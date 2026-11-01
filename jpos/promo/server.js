// Server website promo J-POS — tanpa paket tambahan (hanya Node.js bawaan). Jalankan: node server.js
// Hanya file website yang dilayani (index.html, config.js, folder img). File lain (termasuk server.js ini) tidak bisa diakses dari luar.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = +process.env.PORT || 8080;
const MIME = { '.apk': 'application/vnd.android.package-archive', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const ALLOW = (u) => u == '/index.html' || u == '/config.js' || u == '/apk/J-POS.apk' || /^\/img\/[\w.-]+\.(png|jpg|svg)$/.test(u);
let hits = 0;
http.createServer((req, res) => {
  const H = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN' };
  if (req.method != 'GET' && req.method != 'HEAD') { res.writeHead(405, { ...H, Allow: 'GET, HEAD' }); return res.end(); }
  let u; try { u = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400, H); return res.end(); }
  if (u == '/healthz') { res.writeHead(200, { ...H, 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (u == '/' ) u = '/index.html';
  if (u.includes('..') || !ALLOW(u)) { res.writeHead(404, { ...H, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Tidak ditemukan'); }
  const f = path.join(ROOT, u);
  if (u == '/apk/J-POS.apk') { // file besar → kirim bertahap (stream), bisa diunduh sebagai file
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) { res.writeHead(404, { ...H, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('APK belum disiapkan'); }
      res.writeHead(200, { ...H, 'Content-Type': MIME['.apk'], 'Content-Length': st.size, 'Content-Disposition': 'attachment; filename="J-POS.apk"', 'Cache-Control': 'no-cache' });
      if (req.method == 'HEAD') return res.end(); console.log(new Date().toLocaleTimeString('id-ID') + ' · APK diunduh'); fs.createReadStream(f).pipe(res);
    }); return;
  }
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404, { ...H, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Tidak ditemukan'); }
    if (u == '/index.html') hits++;
    res.writeHead(200, { ...H, 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': u.startsWith('/img/') ? 'public, max-age=86400' : 'no-cache', 'Content-Length': buf.length });
    res.end(req.method == 'HEAD' ? undefined : buf);
  });
}).listen(PORT, '0.0.0.0', () => console.log('Website promo J-POS berjalan di http://localhost:' + PORT + '  (tekan Ctrl+C untuk berhenti)'));
setInterval(() => { if (hits) { console.log(new Date().toLocaleTimeString('id-ID') + ' · halaman dibuka ' + hits + '× sejak server mulai'); } }, 600000);
