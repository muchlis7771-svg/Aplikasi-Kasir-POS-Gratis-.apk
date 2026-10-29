#!/usr/bin/env bash
# Dipanggil GitHub Actions: buat database D1 (sekali), pasang tabel, deploy Worker. Hanya butuh CLOUDFLARE_API_TOKEN.
set -euo pipefail
cd worker
W="npx --yes wrangler@4"
getid() { $W d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s).find(x=>x.name==="jpos");console.log(a?a.uuid:"")}catch(e){console.log("")}})'; }
ID=$(getid)
if [ -z "$ID" ]; then echo "Membuat database jpos…"; $W d1 create jpos; ID=$(getid); fi
[ -n "$ID" ] || { echo "::error::Gagal membuat/menemukan database D1. Pastikan token punya izin D1 Edit."; exit 1; }
grep -q database_id wrangler.toml || sed -i "s/database_name = \"jpos\"/database_name = \"jpos\"\ndatabase_id = \"$ID\"/" wrangler.toml
$W d1 execute jpos --remote --file=schema.sql
# migrasi kolom baru (abaikan jika sudah ada)
for c in "phone TEXT" "exp INTEGER" "plan TEXT DEFAULT 'trial'" "note TEXT"; do $W d1 execute jpos --remote --command "ALTER TABLE stores ADD COLUMN $c" >/dev/null 2>&1 || true; done
$W d1 execute jpos --remote --command "UPDATE stores SET exp=created+2592000000 WHERE exp IS NULL; UPDATE staff SET role='owner' WHERE role='admin' AND name=(SELECT owner FROM stores WHERE id=staff.store_id);" || true
$W deploy
echo "SELESAI"
