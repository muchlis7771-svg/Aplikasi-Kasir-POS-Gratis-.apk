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
