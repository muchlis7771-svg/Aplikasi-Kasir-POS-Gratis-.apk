# J-DATA Sync (Cloudflare Worker + D1 baru)

Database terpisah `jdata_sync_db`. Tidak menyentuh database POS (`warkop_rafli_db`) maupun `jdata_db`.

## Deploy lewat dashboard Cloudflare
1. Workers & Pages > Create > Import a repository > pilih repo ini, **Root directory: `jdata-sync`**. Nama: `jdata-sync`.
2. Storage & Databases > D1 > Create database: `jdata_sync_db`.
3. Buka database > Console > tempel isi `schema.sql` > Execute.
4. Worker `jdata-sync` > Settings > Bindings > Add > D1 database, variable name `DB`, pilih `jdata_sync_db`.
5. Settings > Variables and Secrets > Add secret `SYNC_TOKEN` = teks acak panjang (min 32 karakter). Simpan, jangan dibagikan.
6. Deploy ulang, lalu buka `https://jdata-sync.<akun>.workers.dev/health` -> harus `{"ok":true}`.
