# J-POS — Kasir & Akuntansi Grosir (Android APK + Web + Backend)

POS multi-user untuk toko grosir/distributor. Jalan **online & offline** (data tersimpan di HP, otomatis sinkron saat ada internet).

## Isi paket
| Folder | Fungsi |
|---|---|
| `public/` | Aplikasi (web/PWA & isi APK) |
| `worker/` | Backend Cloudflare Worker + database D1 (multi-toko, Head Admin, chat) |
| `.github/workflows/build-apk.yml` | Membuat file **J-POS.apk** otomatis di GitHub |
| `scripts/`, `capacitor.config.json`, `package.json` | Konfigurasi pembuat APK (Capacitor) |

> Tidak paham? Baca **LANGKAH-HP.md** (cara termudah, semua dari HP).

## 1. Pasang backend manual (opsional)
Butuh Node 20+ dan akun Cloudflare (gratis).
```bash
cd worker
npx wrangler login
npx wrangler d1 create jpos                      # salin database_id ke wrangler.toml (ganti ISI_DATABASE_ID)
npx wrangler d1 execute jpos --remote --file=schema.sql
npx wrangler secret put SECRET                   # tempel string acak, mis: 8c0e41aeb22173c6cc1eba6a226ff35d3c3606b12ad7613a6246a686852b1d15
npx wrangler secret put ADMIN_USER               # username Head Admin (mis. headadmin)
npx wrangler secret put ADMIN_PASS               # password Head Admin — buat yang kuat!
npx wrangler deploy
```
Hasilnya alamat seperti `https://jpos-api.<akun-anda>.workers.dev` — **aplikasi web + API di satu alamat**. Buka alamat itu di Chrome HP → menu ⋮ → *Instal aplikasi* (PWA) jika ingin tanpa APK.

Head Admin: buka aplikasi → layar awal → tombol **🛠 Head Admin** → login dengan ADMIN_USER / ADMIN_PASS.

## 2. Buat APK (tanpa Android Studio)
1. Buat repository GitHub (private boleh), upload seluruh isi folder ini.
2. GitHub → *Settings → Secrets and variables → Actions → Variables* → tambah variabel **API_URL** = alamat Worker Anda (tanpa garis miring di akhir). (Atau edit `public/config.js`.)
3. Tab **Actions → Build APK → Run workflow**. Tunggu ±6–10 menit.
4. Unduh **J-POS.apk** dari *Artifacts* atau dari *Releases → apk-latest* (bisa dibuka langsung dari HP). Izinkan "instal dari sumber tidak dikenal".

APK ini adalah build *debug* (cukup untuk dipakai & dibagikan langsung). Untuk Google Play perlu build *release* bertanda tangan — bisa ditambahkan nanti.

## Fitur
- Layar awal: Masuk toko · Daftar toko baru · Toko demo · Head Admin (developer)
- Peran: Admin/Pemilik, Akuntan, Kasir, Sales — dashboard & menu masing-masing
- Kasir: scan barcode (kamera/ML Kit, scanner Bluetooth, input manual), diskon bertingkat per barang (mis. `10+5`, harga grosir per jumlah), tahan transaksi, tunai/QRIS/transfer/kredit, struk, retur
- Outlet langganan: titik peta (GPS/pilih di peta), tunai atau kredit dengan **limit & tempo yang hanya bisa diatur pemilik**, check-in kunjungan sales
- Akuntansi lengkap (jurnal otomatis): laba rugi, neraca, arus kas, neraca saldo, buku besar, piutang/utang & umur, opname, jurnal manual — **ekspor PDF & Excel**
- Laporan penjualan lengkap (per hari/produk/kategori/outlet/kasir/pembayaran, detail item) — **ekspor Excel**
- Absensi karyawan & sales (GPS, terlambat, rekap)
- Chat: tim toko, semua toko, dan pesan pribadi antar-toko (pakai kode toko)
- Head Admin: statistik semua toko, suspend/aktifkan, reset PIN, hapus toko, siaran pengumuman

## Catatan keamanan & batasan
- Ganti password Head Admin berkala; jangan unggah file `.dev.vars` / secret ke GitHub.
- Peran dibatasi **di server** (kasir/sales hanya boleh jenis transaksi tertentu); pengaturan kredit outlet hanya diterima dari admin.
- Login online pertama kali butuh internet; setelah itu bisa offline. Toko mode lokal (tanpa server) datanya hanya ada di perangkat — gunakan Backup.
- Peta memakai OpenStreetMap (butuh internet untuk menampilkan peta; koordinat tetap tersimpan offline).
- Notifikasi push belum ada (chat memakai polling saat aplikasi terbuka).
