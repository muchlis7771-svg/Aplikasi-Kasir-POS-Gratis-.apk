# Website promo J-POS di Termux — jalan terus di latar belakang

## Pertama kali (sekali saja)
```
cd ~/jpos-promo
bash jpos-bg.sh start
```
Pertama kali akan memasang paket (`nodejs`, `cloudflared`, `curl`); jawab **y** bila ditanya. Tunggu sampai muncul alamat `https://….trycloudflare.com`.
Setelah itu **jendela Termux boleh ditutup**: server tetap berjalan di latar belakang dan otomatis hidup lagi bila mati.

## Perintah sehari-hari
| Perintah | Fungsi |
|---|---|
| `bash jpos-bg.sh start` | jalankan |
| `bash jpos-bg.sh status` | status + alamat publik |
| `bash jpos-bg.sh url` | tampilkan alamat publik |
| `bash jpos-bg.sh stop` | hentikan |
| `bash jpos-bg.sh boot` | jalan otomatis saat HP menyala (pasang aplikasi **Termux:Boot** dari F-Droid dan buka sekali) |

## Agar tidak dimatikan Android (penting, terutama Xiaomi/HyperOS)
1. Pengaturan → Aplikasi → Termux → Hemat baterai → **Tanpa batasan**.
2. Aktifkan **Mulai otomatis** untuk Termux.
3. Di layar aplikasi terbaru, **kunci** (tahan) kartu Termux.
4. Tarik notifikasi Termux → tekan **Acquire wakelock**.
Tanpa langkah ini, Android bisa mematikan Termux kapan saja. Server **tidak** bisa jalan bila HP mati, internet mati, atau Termux dihentikan paksa.

## Link tetap (tidak berubah walau Termux restart)
Alamat `trycloudflare.com` **berubah tiap tunnel dijalankan ulang**. Supaya ada link yang selalu sama:
1. Buka `…/admin.html` (di website promo) → login dengan akun **Head Admin**.
2. Tab **Link & server Termux** → salin **perintah kunci** → tempel di Termux (sekali).
3. Bagikan **link tetap** `…workers.dev/termux`. Link itu otomatis mengarah ke server Termux yang sedang aktif; bila Termux mati, pengunjung dialihkan ke website promo di server J-POS (`…workers.dev/promo/`).

## Admin website
`…/admin.html` → login Head Admin → daftar **pesanan** masuk (WhatsApp pelanggan + ubah status) dan status server Termux.
Login dibatasi 8 percobaan per 15 menit; password tidak disimpan di website.

## Unduhan APK
Taruh file di `~/jpos-promo/apk/J-POS.apk` (pakai APK rilis bertanda tangan). Tombol "Unduh aplikasi Android" muncul otomatis.

## Catatan
- Pesanan dari formulir **tidak disimpan di HP**; langsung masuk ke Head Admin → tab Pesanan.
- Alamat tetap & selalu aktif tanpa HP: `…workers.dev/promo/`.
- Mengubah teks/gambar: edit `index.html`, `config.js`, `img/`; muat ulang browser tanpa restart.
