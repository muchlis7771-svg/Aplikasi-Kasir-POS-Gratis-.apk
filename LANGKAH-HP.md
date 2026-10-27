# Mengaktifkan server J-POS (sekali saja, ±5 menit dari HP)

Server dipasang otomatis oleh GitHub. Anda hanya perlu memberi 1 token Cloudflare.

## 1. Buat token Cloudflare
1. Buka **dash.cloudflare.com** → ikon profil (kanan atas) → **Profil** → **Token API** → **Buat Token**.
2. Pilih template **Edit Cloudflare Workers** → **Gunakan templat**.
3. Di bagian **Izin**, tekan **+ Tambah lainnya** → pilih **Akun** · **D1** · **Edit**.
4. **Sumber Daya Akun**: pilih akun Anda (Muchlis7771@…). **Sumber daya zona**: Semua zona.
5. **Lanjutkan ke ringkasan** → **Buat Token** → **Salin** tokennya.

## 2. Simpan token di GitHub
1. Buka repo **Aplikasi-Kasir-POS-Gratis-.apk** → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** → Name: `CLOUDFLARE_API_TOKEN` → Secret: tempel token → **Add secret**.

## 3. Jalankan
Repo → tab **Actions** → **Deploy Backend** → **Run workflow** → pilih branch **jpos** → Run.
Tunggu tanda ✓ hijau (±2 menit). Server aktif di: https://jpos-api.muchlis7771.workers.dev

Login Head Admin: username `headadmin`, password dari chat (ganti setelah login lewat panel Head Admin).
