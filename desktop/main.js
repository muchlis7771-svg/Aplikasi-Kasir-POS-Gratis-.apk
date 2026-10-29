// J-POS Desktop (Windows/Linux/Mac) — membungkus aplikasi web J-POS (folder app/) agar bisa dipasang di laptop & dipakai offline.
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('path'), url = require('url');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, stream: true } }]);
const ROOT = path.join(__dirname, 'app');
function win() {
  const w = new BrowserWindow({ width: 1366, height: 860, minWidth: 380, minHeight: 600, title: 'J-POS', backgroundColor: '#0f111a', icon: path.join(ROOT, 'icons', 'icon-512.png'), autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false } });
  w.loadURL('app://jpos/index.html');
  // tautan luar (WhatsApp, Google Maps, dll) dibuka di browser bawaan laptop
  w.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:/i.test(u)) shell.openExternal(u); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, u) => { if (!u.startsWith('app://')) { e.preventDefault(); if (/^https?:|^mailto:|^tel:/i.test(u)) shell.openExternal(u); } });
}
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname); if (p == '/' || !p) p = '/index.html';
    const f = path.normalize(path.join(ROOT, p)); if (!f.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(url.pathToFileURL(f).toString());
  });
  // izin kamera (scan barcode) & lokasi
  require('electron').session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write'].includes(perm)));
  win();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) win(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
