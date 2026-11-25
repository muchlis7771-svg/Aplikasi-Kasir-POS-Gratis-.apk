# JKam — Rekaman Suara Jernih 24 Jam

Tiga aplikasi Android, satu backend Cloudflare.

| APK | Untuk | Isi |
|---|---|---|
| **JKam-HeadAdmin.apk** | Pengelola sistem | Dashboard pendapatan & pemakaian, setujui/tolak lisensi, kelola semua owner (suspend, perpanjang, reset password, hapus), atur paket & harga, dengar semua rekaman |
| **JKam-Owner.apk** | Pelanggan | Daftar akun + pilih paket, status lisensi & kuota, buat/kelola user perekam, lihat siapa yang sedang merekam, dengar/unduh/hapus rekaman per user per tanggal |
| **JKam-User.apk** | Perekam di HP | Login dari akun buatan owner, rekam 24 jam di latar belakang, penjernih suara, kirim otomatis ke server |

## Arsitektur

```
JKam-User (rekam) ──upload .m4a──▶  Cloudflare Worker "jkam-api"
JKam-Owner  (WebView panel) ───▶     ├─ D1  jkam_db   : akun, paket, lisensi, sesi, data rekaman
JKam-HeadAdmin (WebView panel) ─▶    └─ R2  jkam-audio : file audio (o<owner>/u<user>/<tanggal>/…m4a)
```

File audio disimpan di **R2**, bukan langsung di D1, karena satu baris D1 maksimal sekitar 2 MB dan total database terbatas.
D1 menyimpan semua data akun dan indeks rekaman.

## Tabel database (`worker/schema.sql`)

- **accounts**: headadmin, owner, user (`role`), password di-hash PBKDF2, `owner_id` untuk user, status aktif/suspend, `last_seen`, `is_recording`, `device_info`
- **packages**: nama, maks. user, kuota GB, masa aktif (hari), harga. Isi awal: Basic, Pro, Bisnis
- **licenses**: pengajuan/aktivasi paket per owner (`pending`, `active`, `rejected`), `starts_at`, `expires_at`
- **sessions**: token login (disimpan sebagai hash)
- **recordings**: satu baris per potongan audio (owner, user, sesi, urutan, waktu mulai, durasi, ukuran, kunci R2)

## Alur pemakaian

1. Owner mendaftar di JKam Owner dan memilih paket. Lisensinya berstatus **Menunggu**.
2. Head Admin menyetujui di menu **Lisensi** setelah pembayaran diterima. Lisensi aktif selama masa paket.
3. Owner membuat user perekam (username + password), sesuai batas paket.
4. User login di JKam User dan menekan tombol rekam. Audio dipotong per 5 menit lalu dikirim otomatis.
5. Owner membuka menu **Rekaman** untuk mendengar per user per tanggal, dengan putar berurutan otomatis.

Jika lisensi habis atau owner di-suspend, rekaman **tidak hilang**. Rekaman disimpan di HP user dan terkirim otomatis setelah lisensi aktif lagi.

## Penjernih suara (JKam User)

Diproses langsung di HP sebelum disimpan:
1. Peredam bising bawaan HP (NoiseSuppressor), jika tersedia
2. High-pass 90 Hz: membuang dengung, getaran, dan kipas
3. Low-pass 9 kHz: mengurangi desis
4. EQ +4 dB di 3 kHz: suara orang lebih jelas
5. Noise gate adaptif: noise latar diturunkan ±14 dB saat hening
6. AGC: suara pelan atau jauh dikuatkan sampai +20 dB
7. Limiter: suara tidak pecah

Hasilnya disimpan sebagai AAC (.m4a), mono 48 kHz. Pilihan kualitas: 32, 48, atau 96 kbps (±350 MB, 520 MB, atau 1 GB per 24 jam).

## Rekam 24 jam

- Foreground service jenis mikrofon dengan notifikasi permanen dan tombol **Berhenti**, plus wake lock
- Potongan disimpan ke penyimpanan internal, lalu diunggah oleh WorkManager (tahan restart dan sinyal putus, dicoba ulang otomatis)
- Tombol **matikan optimasi baterai**. Di HP Xiaomi, Oppo, atau Vivo, aktifkan juga *Autostart* dan setel *Penghemat baterai: Tanpa batasan* untuk JKam

---

## Deploy (otomatis dari repo HomeTech)

JKam ada di folder `jkam/` repo ini. Setiap ada push ke `main`:
- **Deploy JKam API** (`.github/workflows/jkam-deploy.yml`): membuat D1 `jkam_db` dan R2 `jkam-audio` bila belum ada, memperbarui tabel, lalu men-deploy worker `jkam-api` ke https://jkam-api.muchlis7771.workers.dev
- **Build APK JKam** (`.github/workflows/jkam-apk.yml`): build 3 APK, lalu mengunggahnya ke R2. Unduhan tersedia di:
  - `https://jkam-api.muchlis7771.workers.dev/download/jkam-owner.apk`
  - `https://jkam-api.muchlis7771.workers.dev/download/jkam-user.apk`
  - `https://jkam-api.muchlis7771.workers.dev/download/jkam-headadmin.apk` (khusus Head Admin, tidak dipasang di promo)

Kedua workflow memakai secret `CLOUDFLARE_API_TOKEN` yang sama dengan website HomeTech. Token itu harus punya izin Workers, D1, dan **R2**, dan R2 harus sudah aktif di akun Cloudflare.

Kartu JKam di halaman promo HomeTech (`jpos/public/promo/index.html`) mengambil versi dan link unduhan dari `/api/public/apps`.

### Login Head Admin
- Panel: https://jkam-api.muchlis7771.workers.dev/?app=headadmin (atau APK JKam Admin)
- Username: `headadmin`. Password diberikan terpisah. Yang tersimpan di `wrangler.toml` hanya hash PBKDF2-nya.
- Ganti password lewat menu **Akun** setelah login pertama.

## Catatan hukum
Beri tahu orang yang suaranya direkam (misalnya karyawan, lewat pengumuman atau stiker "area direkam"). Notifikasi JKam selalu tampil selama merekam dan sengaja tidak bisa disembunyikan.
