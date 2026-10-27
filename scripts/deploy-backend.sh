#!/usr/bin/env bash
# Dipanggil oleh GitHub Actions: membuat database D1, memasang tabel, men-deploy Worker, dan mengisi secret.
set -euo pipefail
cd worker
W="npx --yes wrangler@4"
getid() { $W d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name==="jpos");console.log(a?a.uuid:"")})'; }
ID=$(getid)
if [ -z "$ID" ]; then echo "Membuat database jpos…"; $W d1 create jpos >/dev/null; ID=$(getid); fi
[ -n "$ID" ] || { echo "Gagal mendapatkan ID database"; exit 1; }
sed -i "s/ISI_DATABASE_ID/$ID/" wrangler.toml
$W d1 execute jpos --remote --file=schema.sql -y
$W deploy
node -e 'const e=process.env;console.log(JSON.stringify({SECRET:e.JPOS_SECRET,ADMIN_USER:e.JPOS_ADMIN_USER,ADMIN_PASS:e.JPOS_ADMIN_PASS}))' > /tmp/secrets.json
$W secret bulk /tmp/secrets.json
rm -f /tmp/secrets.json
echo "SELESAI. Cek alamat Worker di log 'wrangler deploy' di atas."
