'use strict';
/* ============ LOGIN SIDIK JARI (Android) ============
   PIN disimpan terenkripsi di Android Keystore lewat plugin biometrik, hanya bisa dibuka setelah sidik jari cocok.
   Berlaku untuk semua peran. Di laptop / browser tidak tersedia (tetap memakai PIN). */
const BIOP = () => (typeof isNative == 'function' && isNative() && plug('NativeBiometric')) || null;
const bioKey = (id, n) => 'jpos-' + String(id).toLowerCase() + '-' + String(n).toLowerCase();
const bioList = () => LS.get('jpos:bio', []) || [];
const bioHas = (id, n) => !!(id && n) && bioList().some((x) => x.id == String(id).toLowerCase() && x.n.toLowerCase() == String(n).toLowerCase());
let BIOOK = null;
async function bioAvail() { const B = BIOP(); if (!B) return false; if (BIOOK != null) return BIOOK; try { BIOOK = !!(await B.isAvailable()).isAvailable; } catch (e) { BIOOK = false; } return BIOOK; }
async function bioEnable(id, name, pin, silent) {
  const B = BIOP(); if (!B || !(await bioAvail())) { if (!silent) toast('Sidik jari tidak tersedia di perangkat ini'); return false; }
  try {
    await B.verifyIdentity({ reason: 'Aktifkan login sidik jari J-POS', title: 'Daftarkan sidik jari', subtitle: name, negativeButtonText: 'Batal' });
    await B.setCredentials({ username: name, password: pin, server: bioKey(id, name) });
    const L = bioList().filter((x) => !(x.id == String(id).toLowerCase() && x.n.toLowerCase() == name.toLowerCase())); L.push({ id: String(id).toLowerCase(), n: name }); LS.set('jpos:bio', L);
    toast('👆 Login sidik jari aktif'); return true;
  } catch (e) { if (!silent) toast('Sidik jari dibatalkan'); return false; }
}
async function bioDisable(id, name) { const B = BIOP(); try { B && (await B.deleteCredentials({ server: bioKey(id, name) })); } catch (e) { } LS.set('jpos:bio', bioList().filter((x) => !(x.id == String(id).toLowerCase() && x.n.toLowerCase() == String(name).toLowerCase()))); }
async function bioLogin(id, name) {
  const B = BIOP(); if (!B) return toast('Sidik jari hanya di aplikasi Android');
  let cr;
  try { await B.verifyIdentity({ reason: 'Masuk ke J-POS', title: 'Login sidik jari', subtitle: name + ' · ' + id, negativeButtonText: 'Pakai PIN' }); cr = await B.getCredentials({ server: bioKey(id, name) }); }
  catch (e) { return toast('Sidik jari tidak dikenali / dibatalkan — gunakan PIN'); }
  try { await doLogin(id, cr.username || name, cr.password); MODE = 'home'; }
  catch (e) { if (/PIN|salah|tidak ditemukan/i.test(e.message || '')) { await bioDisable(id, name); toast('PIN sudah diganti — login dengan PIN baru lalu aktifkan sidik jari lagi', 6000); } else toast(e.message || 'Gagal masuk', 5000); }
}
// ditawarkan sekali setelah login dengan PIN berhasil
async function bioOffer(id, name, pin) {
  if (!(await bioAvail()) || bioHas(id, name)) return; const k = 'jpos:bioask:' + bioKey(id, name); if (LS.get(k, '') == '0') return;
  setTimeout(async () => { if (confirm('Aktifkan login dengan sidik jari untuk ' + name + '? Berikutnya cukup tempel jari, tanpa mengetik PIN.')) await bioEnable(id, name, pin); else LS.set(k, '0'); }, 900);
}
function bioBtn(id, name) { return BIOP() && bioHas(id, name) ? `<button class="pr bio" onclick="bioLogin('${esc(id)}','${esc(name)}')">👆 Masuk dengan sidik jari</button>` : ''; }
