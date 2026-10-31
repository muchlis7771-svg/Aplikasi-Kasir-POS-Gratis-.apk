'use strict';
/* ============ KENYAMANAN TAMPILAN ============
   1. Kolom angka menampilkan pemisah ribuan (500.000) saat diketik; kode tetap membaca angka mentah (500000).
   2. Kolom isian di jendela (modal) diberi label kecil di atas, jadi isinya tetap jelas setelah diketik. */
const NVD = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
const nfRaw = (s) => { s = String(s ?? ''); const neg = /^\s*-/.test(s); const d = s.replace(/[^\d]/g, ''); return d ? (neg ? '-' : '') + d.replace(/^0+(?=\d)/, '') : ''; };
const nfShow = (r) => (r === '' || r === '-' ? r : (r[0] == '-' ? '-' : '') + r.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
function nfOne(el) {
  if (el.dataset.nf || el.type != 'number') return;
  const st = el.getAttribute('step') || '', mx = el.getAttribute('max');
  if (/\.|any/.test(st) || (mx != null && +mx <= 1000) || el.classList.contains('nonf')) return; // persen, jam, desimal: biarkan
  const v0 = NVD.get.call(el); el.dataset.nf = '1'; el.type = 'text'; el.inputMode = 'numeric'; el.autocomplete = 'off';
  Object.defineProperty(el, 'value', { configurable: true, get() { return nfRaw(NVD.get.call(this)); }, set(v) { NVD.set.call(this, nfShow(nfRaw(v))); } });
  el.value = v0;
  el.addEventListener('input', () => { const cur = NVD.get.call(el), pos = el.selectionStart ?? cur.length, dBefore = cur.slice(0, pos).replace(/[^\d]/g, '').length, out = nfShow(nfRaw(cur)); if (out === cur) return; NVD.set.call(el, out); let n = 0, p = 0; while (p < out.length && n < dBefore) { if (/\d/.test(out[p])) n++; p++; } try { el.setSelectionRange(p, p); } catch (e) { } });
}
function flOne(el) {
  if (el.dataset.fl || !el.placeholder || ['checkbox', 'radio', 'file', 'hidden', 'color', 'range'].includes(el.type)) return;
  if (el.closest('label') || el.closest('.srch') || el.closest('.nofl') || !el.closest('.md')) return;
  el.dataset.fl = '1'; const w = document.createElement('label'); w.className = 'fl'; const s = document.createElement('small'); s.textContent = el.placeholder.replace(/\s*\*$/, ' *').replace(/^mis\.\s*/i, ''); el.parentNode.insertBefore(w, el); w.appendChild(s); w.appendChild(el);
}
function uxScan(root) { try { (root.querySelectorAll ? root : document).querySelectorAll('input[type=number]').forEach(nfOne); (root.querySelectorAll ? root : document).querySelectorAll('.md input[placeholder], .md textarea[placeholder]').forEach(flOne); } catch (e) { } }
let uxT = 0; new MutationObserver(() => { if (uxT) return; uxT = requestAnimationFrame(() => { uxT = 0; uxScan(document); }); }).observe(document.documentElement, { childList: true, subtree: true });
/* 3. Peta: setiap peta dicatat lalu dilepas dengan bersih sebelum layar digambar ulang, agar animasi peta yang tertunda tidak error */
(function () {
  if (!window.L || !L.map || L.__wrapped) return; const orig = L.map; L.__maps = new Set(); L.__wrapped = 1;
  L.map = function (el, o) { const c = typeof el == 'string' ? document.getElementById(el) : el; if (c && c._leaflet_id) { for (const x of [...L.__maps]) if (x._container === c) { try { x.off(); x.remove(); } catch (e) { } L.__maps.delete(x); } delete c._leaflet_id; c.innerHTML = ''; c.className = String(c.className).replace(/\bleaflet-[\w-]+/g, '').trim(); }
    const m = orig.call(this, el, Object.assign({ zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }, o || {})); L.__maps.add(m); return m; };
})();
function mapsDrop(all) { if (!window.L || !L.__maps) return; for (const m of [...L.__maps]) { const c = m._container; if (all || !c || !document.body.contains(c) || !c.closest('.md')) { try { m.stop && m.stop(); m.off(); m.remove(); } catch (e) { } L.__maps.delete(m); } } }
// jangan gambar ulang layar saat pengguna sedang mengetik / memilih berkas (isian belum disimpan tidak hilang)
const uiTyping = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#app') && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type != 'checkbox'); };
