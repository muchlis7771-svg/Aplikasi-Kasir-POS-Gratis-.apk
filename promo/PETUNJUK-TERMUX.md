# Website promo J-POS di Termux

## Cara cepat
1. Simpan folder ini di HP, mis. `~/jpos-promo` (ekstrak ZIP: `termux-setup-storage`, lalu `unzip ~/storage/downloads/jpos-promo-termux.zip -d ~/`).
2. Di Termux: `cd ~/jpos-promo && bash start-termux.sh`
3. Tunggu muncul alamat `https://….trycloudflare.com`. Itu alamat publik: bisa dibuka siapa saja di internet. Bagikan ke calon pelanggan.
4. Berhenti: tekan `Ctrl+C`.

## Yang perlu diketahui
- Alamat `trycloudflare.com` **berubah setiap kali dijalankan** dan tidak ada jaminan aktif terus. Cocok untuk promo sementara, bukan alamat tetap.
- Website hanya bisa dibuka selama **HP menyala, Termux terbuka, dan ada internet**. Matikan penghemat baterai untuk Termux (Pengaturan → Aplikasi → Termux → Baterai → Tanpa batasan) dan pasang **Termux:API** agar `termux-wake-lock` bekerja.
- Pesanan dari formulir **tidak disimpan di HP**. Formulir mengirim ke server J-POS, jadi pesanan tetap masuk ke Head Admin → tab **🛒 Pesanan** walau Termux mati.
- Alamat tetap & selalu aktif (disarankan): website yang sama sudah tersedia di server J-POS, di alamat `…workers.dev/promo/`. Alamat itu aktif 24 jam tanpa HP Anda.
- Mau alamat tetap dari Termux? Perlu domain sendiri di Cloudflare dan *named tunnel* (`cloudflared tunnel login`, `create`, `route dns`). Bisa dibantu bila diperlukan.

## Mengubah isi
Edit `index.html` (teks), `config.js` (alamat server), dan ganti gambar di `img/`. Muat ulang browser, tanpa perlu restart.
