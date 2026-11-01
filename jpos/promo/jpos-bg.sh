#!/data/data/com.termux/files/usr/bin/bash
# Mengatur server website J-POS yang berjalan di latar belakang Termux.
#   bash jpos-bg.sh start    jalankan (tetap hidup walau jendela Termux ditutup)
#   bash jpos-bg.sh stop     hentikan
#   bash jpos-bg.sh status   lihat status & alamat
#   bash jpos-bg.sh url      tampilkan alamat publik
#   bash jpos-bg.sh boot     jalankan otomatis saat HP menyala (butuh aplikasi Termux:Boot)
cd "$(dirname "$0")" || exit 1
PIDF=.bg.pid
running() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }
geturl() { grep -o 'https://[-a-z0-9]*\.trycloudflare\.com' tunnel.log 2>/dev/null | tail -1; }
show() {
  local U; U=$(geturl)
  echo "────────────────────────────────────────"
  if running; then echo "Status  : BERJALAN di latar belakang"; else echo "Status  : berhenti"; fi
  [ "$(curl -s -m 3 127.0.0.1:${PORT:-8080}/healthz 2>/dev/null)" = ok ] && echo "Server  : OK (localhost:${PORT:-8080})" || { echo "Server  : tidak merespons — 5 baris terakhir web.log:"; tail -n 5 web.log 2>/dev/null; }
  if [ -n "$U" ]; then echo "Alamat  : $U"; echo "Admin   : $U/admin.html"; else echo "Alamat  : (belum ada — tunggu sebentar lalu jalankan: bash jpos-bg.sh url)"; fi
  [ -s tunnel.key ] && echo "Link tetap: …workers.dev/termux (aktif, dilaporkan otomatis)" || echo "Link tetap: belum — simpan kunci dari halaman admin (lihat PETUNJUK-TERMUX.md)"
  echo "────────────────────────────────────────"
  command -v termux-clipboard-set >/dev/null 2>&1 && [ -n "$U" ] && printf '%s' "$U" | termux-clipboard-set 2>/dev/null && echo "(alamat sudah disalin ke clipboard)"
}
case "$1" in
  start)
    if ! command -v node >/dev/null 2>&1 || ! command -v cloudflared >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
      echo "Memasang paket (nodejs, cloudflared, curl) — sekali saja…"; pkg update -y && pkg install -y nodejs cloudflared curl || { echo "Gagal memasang paket."; exit 1; }
    fi
    if running; then echo "Sudah berjalan."; else nohup bash keepalive.sh >/dev/null 2>&1 & echo $! > "$PIDF"; disown 2>/dev/null; echo "Dijalankan di latar belakang."; fi
    echo "Menunggu alamat publik (maks 60 detik)…"; for i in $(seq 1 30); do [ -n "$(geturl)" ] && break; sleep 2; done; show ;;
  stop) if running; then kill "$(cat "$PIDF")" 2>/dev/null; sleep 1; fi; pkill -f "node server.js" 2>/dev/null; pkill -f "cloudflared tunnel" 2>/dev/null; rm -f "$PIDF"; echo "Dihentikan." ;;
  status) show ;;
  url) U=$(geturl); [ -n "$U" ] && echo "$U" || echo "Belum ada alamat. Jalankan: bash jpos-bg.sh start" ;;
  boot) mkdir -p ~/.termux/boot && printf '#!/data/data/com.termux/files/usr/bin/sh\ntermux-wake-lock\ncd "%s" && bash jpos-bg.sh start\n' "$(pwd)" > ~/.termux/boot/jpos.sh && chmod +x ~/.termux/boot/jpos.sh && echo "Siap. Pasang & buka aplikasi Termux:Boot sekali (dari F-Droid) agar aktif saat HP menyala." ;;
  *) sed -n 2,8p "$0" ;;
esac
