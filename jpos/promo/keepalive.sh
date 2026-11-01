#!/data/data/com.termux/files/usr/bin/bash
# Menjalankan server website + tunnel publik terus-menerus (otomatis hidup lagi bila mati). Dipanggil oleh jpos-bg.sh.
cd "$(dirname "$0")" || exit 1
PORT=${PORT:-8080}
APIS="${JPOS_API:-https://aplikasi-kasir-pos-gratis--apk.muchlis7771.workers.dev https://sistem-penjualan--apk.muchlis7771.workers.dev}"
termux-wake-lock 2>/dev/null
[ -n "$PREFIX" ] && { [ -s "$PREFIX/etc/resolv.conf" ] || printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > "$PREFIX/etc/resolv.conf"; }
trap 'kill $(jobs -p) 2>/dev/null; pkill -f "node server.js" 2>/dev/null; pkill -f "cloudflared tunnel" 2>/dev/null; termux-wake-unlock 2>/dev/null; exit 0' TERM INT
# 1) server website
( while true; do node server.js >> web.log 2>&1; sleep 2; done ) &
# 2) tunnel publik — alamat https://….trycloudflare.com ditulis ke tunnel.log
( while true; do : > tunnel.log; cloudflared tunnel --no-autoupdate --protocol http2 --url "http://127.0.0.1:$PORT" >> tunnel.log 2>&1; sleep 5; done ) &
# 3) laporkan alamat tunnel ke server J-POS agar link tetap …/termux selalu menunjuk ke sini (butuh file tunnel.key)
( sleep 25; while true; do
    URL=$(grep -o 'https://[-a-z0-9]*\.trycloudflare\.com' tunnel.log 2>/dev/null | tail -1); KEY=$(tr -d ' \r\n' < tunnel.key 2>/dev/null)
    if [ -n "$URL" ] && [ -n "$KEY" ]; then for A in $APIS; do curl -s -m 15 -X POST "$A/api/tunnel" -H 'Content-Type: application/json' -d "{\"key\":\"$KEY\",\"url\":\"$URL\"}" | grep -q '"ok"' && break; done; fi
    [ "$(stat -c%s web.log 2>/dev/null || echo 0)" -gt 1048576 ] && : > web.log
    sleep 120
  done ) &
# 4) cadangan & cermin: tiap jam salin semua data website (pengaturan, media, APK, ulasan, pesanan, chat) ke folder ini
( sleep 45; while true; do node sync.js >> sync.log 2>&1; [ "$(stat -c%s sync.log 2>/dev/null || echo 0)" -gt 524288 ] && : > sync.log; sleep 3600; done ) &
wait
