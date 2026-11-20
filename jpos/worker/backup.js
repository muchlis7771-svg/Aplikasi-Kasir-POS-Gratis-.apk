// ============ BACKUP OTOMATIS TIAP TOKO KE R2 ============
// Tiap toko aktif di-backup sekali sehari ke R2: seluruh log kejadian (tabel ev — SUMBER KEBENARAN satu-
// satunya, seluruh state toko bisa direkonstruksi ulang dari sini lewat replay di HP) + data toko (baris
// stores) + daftar staf. Disimpan BK_KEEP_DAYS hari terakhir per toko, lebih lama otomatis dihapus.
// Ini jaring pengaman BENCANA (data terhapus tak sengaja, bug, dll) — BUKAN pengganti replikasi D1 sendiri
// (Cloudflare sudah mereplikasi D1 di baliknya) dan BUKAN alat restore otomatis: mengembalikan satu toko dari
// backup ini masih langkah manual Head Admin (unduh JSON, re-insert ke D1 lewat wrangler/API) — belum ada
// tombol "pulihkan" di sini karena perlu kehati-hatian ekstra (jangan sampai menimpa data yang justru lebih
// baru). Dicek tiap jam (dari scheduled() di worker.js), tapi tiap toko hanya benar-benar di-backup 1×/hari
// (dicek via R2 head() — key sudah ada = sudah backup hari ini, lewati) — jadi aman & murah dipanggil sesering
// apa pun, dan tahan terhadap satu-dua jadwal cron yang terlewat.
const BK_KEEP_DAYS = 14;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

export async function backupDaily(env, now) {
  if (!env.BACKUP) return { ok: 0, e: 'R2 belum diikat (lihat wrangler.toml)' }; // bucket R2 belum dibuat/diikat — no-op aman, tidak mengganggu fitur lain
  const day = dayKey(now), cutoff = dayKey(now - BK_KEEP_DAYS * 864e5);
  const stores = (await env.DB.prepare("SELECT id,name,owner,email,phone,status,created,exp,plan,tier,note FROM stores WHERE status='active'").all()).results;
  let n = 0, err = 0;
  for (const s of stores) {
    try {
      const key = `store/${s.id}/${day}.json`;
      if (await env.BACKUP.head(key)) continue; // sudah backup hari ini, lewati
      const [ev, staff] = await Promise.all([
        env.DB.prepare('SELECT seq,no,k,t,tot,data FROM ev WHERE store_id=? ORDER BY seq').bind(s.id).all(),
        env.DB.prepare('SELECT name,role,created FROM staff WHERE store_id=?').bind(s.id).all(),
      ]);
      const payload = JSON.stringify({ v: 1, t: now, store: s, staff: staff.results, ev: ev.results });
      await env.BACKUP.put(key, payload, { httpMetadata: { contentType: 'application/json' } });
      n++;
      // buang backup toko ini yg lebih tua dari BK_KEEP_DAYS hari
      const list = await env.BACKUP.list({ prefix: `store/${s.id}/` });
      for (const obj of list.objects) { const d = obj.key.split('/').pop().replace('.json', ''); if (d < cutoff) await env.BACKUP.delete(obj.key).catch(() => { }); }
    } catch (e) { err++; console.error('backupDaily', s.id, e && e.stack || e); }
  }
  return { ok: 1, n, err, total: stores.length };
}
// titik pulih sebelum reset data: dipanggil saat pemilik mengonfirmasi PIN reset (sebelum kejadian reset diterima), jadi
// selalu ada salinan seluruh log kejadian TEPAT sebelum data dinolkan — meski backup JSON di HP hilang. Tidak bergantung
// pada backup harian; ikut terbuang bersama backup lama (key diawali tanggal, lihat pruning BK_KEEP_DAYS).
export async function backupPreReset(env, sid, now) {
  if (!env.BACKUP) return { ok: 0 };
  const key = `store/${sid}/${dayKey(now)}-pre-${new Date(now).toISOString().slice(11, 19).replace(/:/g, '')}.json`;
  const [ev, staff] = await Promise.all([
    env.DB.prepare('SELECT seq,no,k,t,tot,data FROM ev WHERE store_id=? ORDER BY seq').bind(sid).all(),
    env.DB.prepare('SELECT name,role,created FROM staff WHERE store_id=?').bind(sid).all(),
  ]);
  await env.BACKUP.put(key, JSON.stringify({ v: 1, t: now, pre: 'reset', store: { id: sid }, staff: staff.results, ev: ev.results }), { httpMetadata: { contentType: 'application/json' } });
  return { ok: 1, key };
}
// daftar backup tersedia utk satu toko (Head Admin, utk diunduh manual bila diperlukan)
export async function backupList(env, sid) {
  if (!env.BACKUP) return [];
  const list = await env.BACKUP.list({ prefix: `store/${sid}/` });
  return list.objects.map((o) => ({ key: o.key, day: o.key.split('/').pop().replace('.json', ''), size: o.size, uploaded: o.uploaded })).sort((a, b) => b.day.localeCompare(a.day));
}
// unduh satu file backup (dicek key harus benar2 milik toko yg diminta, jangan sampai bisa baca toko lain)
export async function backupGet(env, sid, day) {
  if (!env.BACKUP || !/^[\w-]{1,40}$/.test(sid) || !/^\d{4}-\d\d-\d\d(-pre-\d{6})?$/.test(day)) return null;
  return await env.BACKUP.get(`store/${sid}/${day}.json`);
}
