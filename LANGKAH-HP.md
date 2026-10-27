# Cara paling mudah (cukup dari HP)

Backend dan APK dibuat otomatis oleh GitHub. Anda tidak perlu menjalankan wrangler di Termux (tidak didukung di Android).

## A. Kirim file ke GitHub (lewat Termux)
1. Di GitHub (browser HP): **New repository** → nama `jpos-app` → pilih **Private** → Create (jangan centang README).
2. GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate → centang **repo** dan **workflow** → salin tokennya.
3. Simpan `jpos-app.zip` ke folder Download HP. Buka Termux, tempel satu per satu:
```
pkg install -y git unzip
termux-setup-storage
cd ~ && unzip -o /sdcard/Download/jpos-app.zip && cd jpos-app
git init -b main && git add -A && git -c user.name=muchlis -c user.email=muchlis7771@gmail.com commit -m awal
git remote add origin https://muchlis7771-svg:TOKEN_ANDA@github.com/muchlis7771-svg/jpos-app.git
git push -u origin main
```
(ganti `TOKEN_ANDA` dengan token langkah 2)

## B. Buat token Cloudflare
Cloudflare → ikon profil → Profil → **API Tokens** → Create Token → template **Edit Cloudflare Workers** → tambahkan izin **Account → D1 → Edit** → Create. Salin tokennya.
Account ID: Cloudflare → Workers & Pages → di kanan ada *Account ID*.

## C. Isi 5 Secret di GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret:
| Nama | Isi |
|---|---|
| CLOUDFLARE_API_TOKEN | token langkah B |
| CLOUDFLARE_ACCOUNT_ID | Account ID |
| JPOS_SECRET | string acak panjang (dari chat) |
| JPOS_ADMIN_USER | headadmin |
| JPOS_ADMIN_PASS | password Head Admin (dari chat) |

## D. Jalankan
Repo → tab **Actions** → **Deploy Backend** → Run workflow (tunggu hijau ✓).
Lalu **Build APK** → Run workflow → unduh `J-POS.apk` dari **Releases → apk-latest**.
