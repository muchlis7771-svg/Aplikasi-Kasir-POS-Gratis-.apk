'use strict';
/* ============ PEMBARUAN OTOMATIS TANPA INSTAL ULANG (aplikasi Android) ============
   Aplikasi memeriksa ota.json di server J-POS resmi. Bila versinya lebih baru: file yang berubah diunduh, file yang sama
   disalin dari versi yang sedang berjalan, semua disimpan di memori aplikasi, lalu WebView Capacitor diarahkan ke folder
   itu (origin tetap https://localhost → data, login & antrian offline tidak hilang). Diterapkan saat aplikasi dibuka
   berikutnya, atau langsung lewat tombol "Perbarui sekarang". Bila versi baru gagal terbuka 2×, otomatis kembali. */
const APPV = 43;
const OTAK = 'jpos:ota', OTAT = 'jpos:otaTry';
const otaFS = () => plug('Filesystem'), otaWV = () => plug('WebView');
const otaOk = () => isNative() && otaFS() && otaWV() && otaFS().downloadFile && otaWV().setServerBasePath;
// hanya dari server resmi J-POS (bukan alamat server khusus) agar kode aplikasi tidak bisa disisipi pihak lain
const otaSrc = () => { const H = [window.JPOS_API, ...(window.JPOS_API_ALT || [])].filter(Boolean).map((u) => { try { return new URL(u).origin; } catch (e) { return ''; } }); let a = ''; try { a = new URL(AP).origin; } catch (e) { } return H.includes(a) ? a : H[0]; };
let OTAW = false;
async function otaB64Write(path, blob, first) {
  const FS = otaFS(), CH = 3 * 262144; // potongan kelipatan 3 byte agar base64 bisa disambung
  for (let i = 0; i < blob.size || (i == 0 && first); i += CH) {
    const part = blob.slice(i, i + CH), b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(part); });
    if (i == 0) await FS.writeFile({ path, data: b64, directory: 'DATA', recursive: true }); else await FS.appendFile({ path, data: b64, directory: 'DATA' });
    if (!blob.size) break;
  }
}
async function otaCheck(force) {
  if (OTAW || !otaOk() || !canNet()) return; if (!force && Date.now() - LS.get('jpos:otaT', 0) < 30 * 6e4) return;
  LS.set('jpos:otaT', Date.now()); OTAW = true;
  try {
    const src = otaSrc(), man = await (await fetch(src + '/ota.json?t=' + Date.now(), { cache: 'no-store' })).json();
    if (!(man && man.v > APPV && Array.isArray(man.files))) return;
    const st = LS.get(OTAK, {}) || {}, bad = LS.get(OTAT, {}) || {};
    if (st.ready == man.v || (bad.v == man.v && bad.n >= 2)) return otaBar();
    if (navigator.connection && navigator.connection.saveData && !force) return;
    const cur = await (await fetch('ota.json?t=' + Date.now(), { cache: 'no-store' })).json().catch(() => ({ files: [] })), ch = {};
    for (const f of cur.files || []) ch[f.p] = f.h;
    const FS = otaFS(), dir = 'ota/v' + man.v, runDir = st.v == APPV ? st.dir : '';
    try { await FS.rmdir({ path: dir, directory: 'DATA', recursive: true }); } catch (e) { }
    let dl = 0, cp = 0;
    for (const f of man.files) {
      const to = dir + '/' + f.p;
      if (ch[f.p] == f.h) {
        let done = false;
        if (runDir) { try { await FS.copy({ from: runDir + '/' + f.p, to, directory: 'DATA', toDirectory: 'DATA' }); done = true; } catch (e) { } }
        if (!done) { const r = await fetch(f.p, { cache: 'no-store' }); if (r.ok) { await otaB64Write(to, await r.blob(), true); done = true; } }
        if (done) { cp++; continue; }
      }
      await FS.downloadFile({ url: src + '/' + f.p.split('/').map(encodeURIComponent).join('/') + '?v=' + man.v, path: to, directory: 'DATA', recursive: true }); dl++;
      const s = await FS.stat({ path: to, directory: 'DATA' }); if (f.s != null && +s.size != f.s) throw new Error('ukuran ' + f.p + ' tidak cocok');
    }
    await otaB64Write(dir + '/ota.json', new Blob([JSON.stringify(man)]), true);
    const uri = (await FS.getUri({ path: dir, directory: 'DATA' })).uri, path = decodeURI(uri.replace(/^file:\/\//, ''));
    const keep = st.v == APPV ? st : null;
    LS.set(OTAK, { v: man.v, dir, path, ready: man.v, prev: keep ? { v: keep.v, dir: keep.dir, path: keep.path } : null, note: man.note || '', dl, cp, t: Date.now() });
    // hapus folder versi lama yang tidak dipakai
    try { const L = await FS.readdir({ path: 'ota', directory: 'DATA' }); for (const e of L.files || []) { const n = e.name || e; if (n != 'v' + man.v && !(keep && keep.dir == 'ota/' + n)) await FS.rmdir({ path: 'ota/' + n, directory: 'DATA', recursive: true }).catch(() => { }); } } catch (e) { }
    otaBar();
  } catch (e) { console.warn('OTA gagal', e && e.message); } finally { OTAW = false; }
}
function otaBar() {
  const st = LS.get(OTAK, {}) || {}; if (!(st.ready > APPV) || $('#otab')) return;
  const b = document.createElement('div'); b.id = 'otab'; b.className = 'otab';
  b.innerHTML = `<span><b>✨ Versi baru J-POS siap</b><small>${esc(st.note || 'Pembaruan fitur & perbaikan')} · diterapkan otomatis saat aplikasi dibuka lagi</small></span><button class="gh pri">Perbarui sekarang</button><button class="gh" aria-label="Nanti">✕</button>`;
  b.children[1].onclick = () => otaApply(true); b.children[2].onclick = () => b.remove(); document.body.appendChild(b);
}
async function otaApply(now) {
  const st = LS.get(OTAK, {}) || {}; if (!(st.ready > APPV) || !otaOk()) return;
  if (now && S && (S.eq || []).length && canNet()) { try { await sync(); } catch (e) { } }
  const t = LS.get(OTAT, {}) || {}; LS.set(OTAT, { v: st.ready, n: t.v == st.ready ? (t.n || 0) + 1 : 1, t: Date.now() });
  try { await otaWV().setServerBasePath({ path: st.path }); } catch (e) { console.warn('OTA apply', e); }
}
// saat aplikasi dibuka
(function otaBoot() {
  if (!otaOk()) return; const st = LS.get(OTAK, {}) || {}, t = LS.get(OTAT, {}) || {};
  if (st.ready == APPV) { // versi baru berhasil terbuka → kunci agar dipakai seterusnya
    setTimeout(async () => { try { await otaWV().persistServerBasePath(); LS.set(OTAT, {}); LS.set(OTAK, { ...st, ready: 0, v: APPV }); } catch (e) { } }, 6000);
  } else if (st.ready > APPV && !(t.v == st.ready && t.n >= 2)) { otaApply(false); return; }
  else if (st.ready > APPV) LS.set(OTAK, { ...st, ready: 0 }); // gagal 2× → lewati versi ini
  setTimeout(() => otaCheck(), 15000); setInterval(() => otaCheck(), 30 * 6e4);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState == 'visible') otaCheck(); });
})();
