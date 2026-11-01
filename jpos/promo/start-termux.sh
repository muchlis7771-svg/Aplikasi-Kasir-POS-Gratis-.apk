#!/data/data/com.termux/files/usr/bin/bash
# Menjalankan website promo J-POS dari Termux + membuat alamat publik (https) lewat Cloudflare Tunnel.
# Cara pakai:  bash start-termux.sh
cd "$(dirname "$0")" || exit 1
PORT=${PORT:-8080}
echo "=== Website promo J-POS ==="
need() { command -v "$1" >/dev/null 2>&1; }
if ! need node || ! need cloudflared; then
  echo "Memasang paket yang dibutuhkan (nodejs & cloudflared) — butuh internet, sekali saja…"
  pkg update -y && pkg install -y nodejs cloudflared || { echo "Gagal memasang paket. Cek internet lalu ulangi."; exit 1; }
fi
# Termux tidak punya resolv.conf bawaan; cloudflared membutuhkannya
[ -s "$PREFIX/etc/resolv.conf" ] || printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > "$PREFIX/etc/resolv.conf"
termux-wake-lock 2>/dev/null   # cegah HP tidur saat server jalan (butuh Termux:API; bila tak ada, abaikan)
node server.js & SRV=$!
trap 'kill $SRV 2>/dev/null; termux-wake-unlock 2>/dev/null' EXIT INT TERM
sleep 1
echo
echo "Server lokal    : http://localhost:$PORT  (hanya di HP ini)"
echo "Alamat publik   : cari baris https://xxxx.trycloudflare.com di bawah ini — itu yang dibagikan ke orang lain."
echo "Jangan tutup Termux & jangan matikan layar/baterai hemat selama server dipakai."
echo
cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT"
