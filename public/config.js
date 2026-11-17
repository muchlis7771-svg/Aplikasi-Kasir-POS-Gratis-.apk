// Alamat server API J-POS (Cloudflare Worker). Kosongkan jika web & API dilayani dari Worker yang sama.
// Catatan: "aplikasi-kasir-pos-gratis--apk" dipakai sbg utama krn sudah terbukti aktif/live di akun Cloudflare.
// "sistem-penjualan--apk" belum pernah ter-deploy (GH Actions "Deploy Backend" gagal krn secret Cloudflare belum diisi) —
// tetap disimpan sbg cadangan supaya otomatis terpakai begitu worker itu aktif, tanpa perlu update app lagi.
window.JPOS_API = 'https://aplikasi-kasir-pos-gratis--apk.muchlis7771.workers.dev';
// Alamat cadangan: aplikasi otomatis pindah ke alamat yang aktif (aman saat nama server diganti).
window.JPOS_API_ALT = ['https://sistem-penjualan--apk.muchlis7771.workers.dev', 'https://j-data-mucus.muchlis7771.workers.dev'];
