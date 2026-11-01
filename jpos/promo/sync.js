// Cadangan & cermin website J-POS di Termux (Node.js bawaan, tanpa paket tambahan).
// Mengambil dari server J-POS: pengaturan website, media iklan (gambar/video), file APK terbaru, ulasan, pesanan, chat,
// serta file halaman website terbaru. Hasil disimpan di folder ini: data/ (JSON), media/, apk/J-POS.apk.
// Dijalankan otomatis tiap jam oleh keepalive.sh, atau manual:  node sync.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = __dirname, APIS = (process.env.JPOS_API || 'https://aplikasi-kasir-pos-gratis--apk.muchlis7771.workers.dev https://sistem-penjualan--apk.muchlis7771.workers.dev').split(/\s+/).filter(Boolean);
const log = (...a) => console.log(new Date().toLocaleString('id-ID'), '·', ...a);
const mk = (d) => fs.mkdirSync(path.join(R, d), { recursive: true });
const KEY = (() => { try { return fs.readFileSync(path.join(R, 'tunnel.key'), 'utf8').replace(/\s/g, ''); } catch (e) { return ''; } })();
async function get(base, p, asText) { const c = new AbortController(), t = setTimeout(() => c.abort(), 30000); try { const r = await fetch(base + p, { signal: c.signal }); if (!r.ok) throw new Error(p + ' → ' + r.status); return asText === 'buf' ? Buffer.from(await r.arrayBuffer()) : asText ? await r.text() : await r.json(); } finally { clearTimeout(t); } }
async function chunks(base, path0, m, extra) { // rakit file dari potongan base64
  const parts = []; for (let i = 0; i < m.n; i++) { let txt; for (let t = 0; ; t++) { try { txt = await get(base, path0 + '?' + extra + '&i=' + i, true); break; } catch (e) { if (t >= 3) throw e; await new Promise((z) => setTimeout(z, 800 * (t + 1))); } } parts.push(Buffer.from(txt.trim(), 'base64')); }
  const buf = Buffer.concat(parts); if (buf.length != m.size || crypto.createHash('sha256').update(buf).digest('hex') != m.sha) throw new Error('file rusak / tidak utuh'); return buf;
}
(async () => {
  let base = '', ex; mk('data'); mk('media'); mk('apk'); mk('img'); mk('video');
  if (!KEY) { log('Belum ada tunnel.key — simpan kunci dari halaman admin dulu (lihat PETUNJUK-TERMUX.md). Hanya memperbarui file halaman.'); }
  if (KEY) for (const b of APIS) { try { ex = await get(b, '/api/tunnel/export?key=' + encodeURIComponent(KEY)); base = b; break; } catch (e) { log('gagal', b, e.message); } }
  if (!base) base = APIS[0];
  // 1) file halaman website terbaru
  const files = ['index.html', 'admin.html', 'config.js', 'video/J-POS-promo.mp4', 'img/logo.png', 'img/logo-192.png', 'img/og.jpg', 'img/video-poster.jpg', 's-dash', 's-home', 's-kasir', 's-laporan', 's-menu', 's-order', 's-produk'].map((f) => (f.startsWith('s-') ? 'img/' + f + '.jpg' : f));
  let upd = 0; for (const f of files) {
    try { const dst = path.join(R, f), isBig = /\.(mp4|jpg|png)$/.test(f), have = fs.existsSync(dst) ? fs.statSync(dst).size : -1; if (isBig && have > 0) continue;
      const buf = await get(base, '/promo/' + f, 'buf'); if (buf.length < 20) continue; if (have != buf.length || !isBig) { if (!isBig && have == buf.length && fs.readFileSync(dst).equals(buf)) continue; fs.writeFileSync(dst, buf); upd++; } } catch (e) { log('lewati', f, e.message); }
  }
  log('file halaman diperbarui:', upd);
  if (!ex) return log('selesai (tanpa data — kunci tunnel belum ada/salah).');
  // 2) data
  const D = path.join(R, 'data'), w = (n, v) => fs.writeFileSync(path.join(D, n), JSON.stringify(v, null, 1));
  w('site.json', ex.site); w('ulasan.json', ex.ulasan); w('pesanan.json', ex.leads); w('chat.json', ex.chat); w('media.json', ex.media);
  const day = new Date().toISOString().slice(0, 10); w('cadangan-' + day + '.json', ex);
  fs.readdirSync(D).filter((f) => /^cadangan-/.test(f)).sort().slice(0, -7).forEach((f) => fs.unlinkSync(path.join(D, f)));
  log('data tersimpan: pesanan', ex.leads.length, '· ulasan', ex.ulasan.length, '· chat', ex.chat.length);
  // 3) media iklan
  const keep = new Set(); for (const m of ex.media) {
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }[m.type] || 'bin', fn = m.id + '.' + ext, dst = path.join(R, 'media', fn); keep.add(fn);
    if (fs.existsSync(dst) && fs.statSync(dst).size == m.size) continue;
    try { fs.writeFileSync(dst, await chunks(base, '/api/media/chunk', m, 'id=' + m.id)); log('media disimpan:', m.name); } catch (e) { log('media gagal', m.name, e.message); }
  }
  fs.readdirSync(path.join(R, 'media')).forEach((f) => { if (/^[a-f0-9]{16}\./.test(f) && !keep.has(f)) fs.unlinkSync(path.join(R, 'media', f)); });
  // 4) APK terbaru
  const A = ex.apk, shaF = path.join(R, 'apk', '.sha'), cur = fs.existsSync(shaF) ? fs.readFileSync(shaF, 'utf8') : '';
  if (A && A.has && cur != A.sha) { try { fs.writeFileSync(path.join(R, 'apk', 'J-POS.apk'), await chunks(base, '/api/apk/chunk', A, 'up=' + A.up)); fs.writeFileSync(shaF, A.sha); log('APK disimpan:', A.name); } catch (e) { log('APK gagal:', e.message); } }
  fs.writeFileSync(path.join(D, 'terakhir-sinkron.txt'), new Date().toISOString());
  log('selesai.');
})().catch((e) => { log('galat:', e.message); process.exit(1); });
