// Service worker: cache aplikasi agar bisa dibuka offline. API tidak di-cache.
const V = 'jpos-v12', ASSETS = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/xlsx.full.min.js', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'vendor/zxing.min.js',
  ...['core', 'native', 'guard', 'net', 'charts', 'print', 'pos', 'prod', 'outlet', 'report', 'export', 'team', 'absen', 'buy', 'kas', 'kirim', 'xls', 'perm', 'dash', 'online', 'ana', 'ana2', 'buyer', 'demo', 'main'].map((n) => 'js/' + n + '.js')];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x != V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url); if (e.request.method != 'GET' || u.pathname.startsWith('/api/')) return;
  if (u.origin == location.origin) { // jaringan dulu (agar update cepat), cache bila offline
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  } else if (/tile\.openstreetmap/.test(u.host)) {
    e.respondWith(caches.open(V + '-t').then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => { c.put(e.request, n.clone()); return n; }).catch(() => new Response('', { status: 504 })))));
  }
});
