// J-POS Desktop (Windows 7/8/10/11, Linux) — membungkus aplikasi web J-POS (folder app/) agar bisa dipasang di laptop & dipakai offline.
// Electron 22 dipakai karena versi terakhir yang masih berjalan di Windows 7 / 8 / 8.1.
const { app, BrowserWindow, protocol, shell, Menu, session } = require('electron');
const path = require('path');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, stream: true } }]);
const ROOT = path.join(__dirname, 'app');
function win() {
  const w = new BrowserWindow({ width: 1366, height: 860, minWidth: 380, minHeight: 600, title: 'J-POS', backgroundColor: '#0f111a', icon: path.join(ROOT, 'icons', 'icon-512.png'), autoHideMenuBar: true, show: false, webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false } });
  w.once('ready-to-show', () => { w.maximize(); w.show(); });
  w.loadURL('app://jpos/index.html');
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, u) => { if (!u.startsWith('app://')) { e.preventDefault(); if (/^https?:|^mailto:|^tel:/i.test(u)) shell.openExternal(u); } });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.registerFileProtocol('app', (req, cb) => {
      let p = decodeURIComponent(new URL(req.url).pathname); if (!p || p == '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p)); if (!f.startsWith(ROOT)) return cb({ statusCode: 403 });
      cb({ path: f });
    });
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write'].includes(perm)));
    win();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) win(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
