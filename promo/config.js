// Alamat server J-POS (tempat data harga paket & pesanan). Bila halaman ini dibuka dari workers.dev yang sama, otomatis memakai alamat itu.
window.PROMO_APIS = [
  /\.workers\.dev$/.test(location.hostname) ? location.origin : '',
  'https://aplikasi-kasir-pos-gratis--apk.muchlis7771.workers.dev',
  'https://sistem-penjualan--apk.muchlis7771.workers.dev',
].filter(Boolean).filter((v, i, a) => a.indexOf(v) == i);
window.PROMO_WA = '6281340641730'; // WhatsApp cadangan bila server belum bisa dihubungi
// pengujian lokal: ?api=http://localhost:8799 (hanya localhost, agar data formulir tak bisa dibelokkan ke server lain)
try { const q = new URLSearchParams(location.search).get('api'); if (q && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(q)) window.PROMO_APIS = [q]; } catch (e) { }
