// Hitung Order Sales (baca foto/teks orderan pakai AI) + daftar harga principal + lupa PIN lewat email pemilik.
export const OSCHEMA = [
  'CREATE TABLE IF NOT EXISTS plist(store_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT,rows TEXT NOT NULL,t INTEGER,u TEXT,PRIMARY KEY(store_id,id))',
  'CREATE TABLE IF NOT EXISTS pinrst(store_id TEXT PRIMARY KEY,code_hash TEXT NOT NULL,exp INTEGER NOT NULL,tries INTEGER DEFAULT 0,t INTEGER)',
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mask = (e) => { const [a, d] = String(e).split('@'); return (a.length <= 2 ? a[0] + '*' : a.slice(0, 2) + '*'.repeat(Math.min(6, a.length - 2))) + '@' + d; };

async function mail(C, to, subject, text) {
  if (!C.mail_key) return { ok: false, e: 'Pengiriman email belum diaktifkan pemilik aplikasi' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + C.mail_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: C.mail_from || 'J-POS <onboarding@resend.dev>', to: [to], subject, text, html: '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>').replace(/\b(\d{6})\b/, '<b style="font-size:26px;letter-spacing:4px">$1</b>') + '</div>' }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('mail', r.status, t.slice(0, 200)); return { ok: false, e: 'Email gagal dikirim (' + r.status + ')' }; }
    return { ok: true };
  } catch (e) { return { ok: false, e: 'Email gagal dikirim' }; }
}

/** Rute tanpa login: lupa PIN pemilik → kode 6 angka ke email pemilik terdaftar → PIN baru. */
export async function pinPublic({ env, p, M, b, J, ip, limited, C, hp, same, logAct }) {
  if (p == '/api/pin/forgot' && M == 'POST') {
    const id = String(b.id || '').trim().toLowerCase();
    if (!/^[a-z0-9]{6,20}$/.test(id)) return J({ e: 'Kode toko tidak valid' }, 400);
    if ((await limited(env, 'pinf:' + ip, 10, 36e5)) || (await limited(env, 'pinf:' + id, 3, 9e5))) return J({ e: 'Terlalu sering meminta kode. Coba lagi 15 menit lagi.' }, 429);
    const s = await env.DB.prepare("SELECT s.email,s.name,(SELECT name FROM staff WHERE store_id=s.id AND role='owner' ORDER BY created LIMIT 1) owner FROM stores s WHERE s.id=?").bind(id).first();
    if (!s) return J({ e: 'Kode toko tidak ditemukan' }, 404);
    if (!s.email || !EMAIL.test(s.email)) return J({ e: 'Toko ini belum mendaftarkan email pemilik. Hubungi pemilik aplikasi (Head Admin) untuk reset PIN, lalu isi email di menu Akun agar lain kali bisa reset sendiri.', noEmail: 1 }, 400);
    if (!C.mail_key) return J({ e: 'Pengiriman email belum diaktifkan pemilik aplikasi. Hubungi Head Admin untuk reset PIN.' }, 501);
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await env.DB.prepare('INSERT INTO pinrst(store_id,code_hash,exp,tries,t) VALUES(?,?,?,0,?) ON CONFLICT(store_id) DO UPDATE SET code_hash=excluded.code_hash,exp=excluded.exp,tries=0,t=excluded.t')
      .bind(id, await hp(code, id, 'pinreset'), Date.now() + 15 * 6e4, Date.now()).run();
    const r = await mail(C, s.email, 'Kode reset PIN J-POS: ' + code,
      `Halo ${s.owner || 'Pemilik'},\n\nAda permintaan reset PIN pemilik untuk toko "${s.name}" (kode toko ${id}).\n\nKode reset PIN Anda:\n${code}\n\nKode berlaku 15 menit dan hanya bisa dipakai sekali. Jangan berikan kode ini kepada siapa pun, termasuk karyawan.\nJika Anda tidak meminta reset PIN, abaikan email ini — PIN Anda tidak berubah.`);
    if (!r.ok) return J({ e: r.e }, 502);
    await logAct(env, 'staff', s.owner || '', s.owner || '', id, 'minta kode reset PIN (email)', ip);
    return J({ ok: 1, to: mask(s.email), name: s.owner || '' });
  }
  if (p == '/api/pin/reset' && M == 'POST') {
    const id = String(b.id || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, ''), pin = String(b.pin || '');
    if (!/^[a-z0-9]{6,20}$/.test(id) || code.length != 6) return J({ e: 'Isi kode toko dan 6 angka kode dari email' }, 400);
    if (!/^\d{4,8}$/.test(pin)) return J({ e: 'PIN baru harus 4–8 angka' }, 400);
    if (await limited(env, 'pinr:' + ip, 20, 36e5)) return J({ e: 'Terlalu banyak percobaan, coba lagi nanti' }, 429);
    const r = await env.DB.prepare('SELECT * FROM pinrst WHERE store_id=?').bind(id).first();
    if (!r || r.exp < Date.now()) return J({ e: 'Kode sudah kedaluwarsa atau belum diminta. Minta kode baru.' }, 400);
    if (r.tries >= 5) { await env.DB.prepare('DELETE FROM pinrst WHERE store_id=?').bind(id).run(); return J({ e: 'Terlalu banyak kode salah. Minta kode baru.' }, 400); }
    if (!(await same(r.code_hash, await hp(code, id, 'pinreset')))) {
      await env.DB.prepare('UPDATE pinrst SET tries=tries+1 WHERE store_id=?').bind(id).run();
      return J({ e: 'Kode salah (sisa ' + (4 - r.tries) + ' kali percobaan)' }, 400);
    }
    const o = await env.DB.prepare("SELECT name FROM staff WHERE store_id=? AND role='owner' ORDER BY created LIMIT 1").bind(id).first();
    if (!o) return J({ e: 'Akun pemilik tidak ditemukan' }, 404);
    await env.DB.batch([
      env.DB.prepare('UPDATE staff SET pin_hash=? WHERE store_id=? AND name=?').bind(await hp(pin, id, o.name), id, o.name),
      env.DB.prepare('DELETE FROM pinrst WHERE store_id=?').bind(id),
    ]);
    await logAct(env, 'staff', o.name, o.name, id, 'reset PIN pemilik lewat email', ip);
    const s = await env.DB.prepare('SELECT email,name FROM stores WHERE id=?').bind(id).first();
    if (s && s.email) await mail(C, s.email, 'PIN J-POS Anda baru saja diganti', `PIN pemilik toko "${s.name}" (kode ${id}) berhasil diganti lewat reset email pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.\nJika ini bukan Anda, segera hubungi Head Admin J-POS.`);
    return J({ ok: 1, name: o.name });
  }
  return null;
}

/** Rute toko (sudah login). */
export async function hordRoutes({ env, p, M, b, u, J, sid, uname, role, limited, hp, same }) {
  // ----- email pemulihan PIN (pemilik) -----
  if (p == '/api/me/email') {
    if (role != 'owner') return J({ e: 'Hanya pemilik toko' }, 403);
    if (M == 'GET') { const s = await env.DB.prepare('SELECT email FROM stores WHERE id=?').bind(sid).first(); return J({ email: (s && s.email) || '' }); }
    if (M == 'POST') {
      const em = String(b.email || '').trim().toLowerCase();
      if (!EMAIL.test(em) || em.length > 120) return J({ e: 'Format email tidak valid' }, 400);
      if (await limited(env, 'eml:' + sid, 6, 36e5)) return J({ e: 'Terlalu sering, coba lagi nanti' }, 429);
      const cur = await env.DB.prepare('SELECT pin_hash FROM staff WHERE store_id=? AND name=?').bind(sid, uname).first();
      if (!cur || !(await same(cur.pin_hash, await hp(String(b.pin || ''), sid, uname)))) return J({ e: 'PIN salah' }, 400);
      try { await env.DB.prepare('UPDATE stores SET email=? WHERE id=?').bind(em, sid).run(); } catch (e) { return J({ e: 'Email ini sudah dipakai toko lain' }, 409); }
      return J({ ok: 1, email: em });
    }
  }
  // ----- daftar harga principal (dipakai bersama semua HP di toko) -----
  if (p == '/api/plist') {
    if (M == 'GET') { const r = await env.DB.prepare('SELECT id,name,rows,t,u FROM plist WHERE store_id=? ORDER BY t DESC').bind(sid).all(); return J({ lists: r.results.map((x) => ({ id: x.id, name: x.name, t: x.t, u: x.u, rows: JSON.parse(x.rows || '[]') })) }); }
    if (!['owner', 'admin'].includes(role)) return J({ e: 'Hanya pemilik / admin yang bisa mengubah daftar harga' }, 403);
    if (M == 'POST') {
      const id = String(b.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'pl' + Date.now().toString(36), name = String(b.name || 'Daftar harga').trim().slice(0, 60);
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 5000).map((r) => ({ c: String(r.c || '').trim().slice(0, 40), n: String(r.n || '').trim().slice(0, 160), p: Math.max(0, +r.p || 0), isi: Math.max(0, Math.round(+r.isi || 0)) })).filter((r) => r.c || r.n);
      if (!rows.length) return J({ e: 'Daftar harga kosong' }, 400);
      const n = await env.DB.prepare('SELECT COUNT(*) c FROM plist WHERE store_id=? AND id<>?').bind(sid, id).first();
      if (n.c >= 20) return J({ e: 'Maksimal 20 daftar harga per toko' }, 400);
      await env.DB.prepare('INSERT INTO plist(store_id,id,name,rows,t,u) VALUES(?,?,?,?,?,?) ON CONFLICT(store_id,id) DO UPDATE SET name=excluded.name,rows=excluded.rows,t=excluded.t,u=excluded.u').bind(sid, id, name, JSON.stringify(rows), Date.now(), uname).run();
      return J({ ok: 1, id, n: rows.length });
    }
    if (M == 'DELETE') { await env.DB.prepare('DELETE FROM plist WHERE store_id=? AND id=?').bind(sid, String(u.searchParams.get('id') || '')).run(); return J({ ok: 1 }); }
  }
  // ----- baca orderan (foto tulisan tangan / teks berantakan) pakai AI -----
  if (p == '/api/ord/read' && M == 'POST') {
    if (!env.ANTHROPIC_API_KEY) return J({ e: 'Baca foto belum diaktifkan pemilik aplikasi (ANTHROPIC_API_KEY belum diatur di Cloudflare). Orderan teks tetap bisa dihitung.' }, 501);
    if ((await limited(env, 'ord:' + sid, 120, 36e5)) || (await limited(env, 'ord:' + sid + ':' + uname.toLowerCase(), 30, 6e5))) return J({ e: 'Terlalu banyak permintaan baca, coba beberapa menit lagi' }, 429);
    const cat = (Array.isArray(b.cat) ? b.cat : []).slice(0, 3000).map((r) => String(r[0] || '').slice(0, 40) + ' | ' + String(r[1] || '').slice(0, 120)).join('\n');
    if (!cat) return J({ e: 'Daftar harga kosong' }, 400);
    const content = [];
    if (b.image) {
      const mm = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(b.image));
      if (!mm || mm[2].length > 4_500_000) return J({ e: 'Foto tidak didukung atau terlalu besar' }, 400);
      content.push({ type: 'image', source: { type: 'base64', media_type: mm[1], data: mm[2] } });
      content.push({ type: 'text', text: 'Baca foto orderan ini. Salin SEMUA baris orderan sesuai instruksi.' });
    } else if (b.text) content.push({ type: 'text', text: 'Teks orderan dari sales:\n<<<\n' + String(b.text).slice(0, 8000) + '\n>>>\nSalin SEMUA baris orderan sesuai instruksi.' });
    else return J({ e: 'Kirim foto atau teks' }, 400);
    const system = `Kamu adalah admin distributor di Indonesia yang sangat teliti. Tugasmu: MENYALIN (transkripsi) orderan sales dari foto tulisan tangan / foto layar / teks, lalu mencocokkan tiap baris ke KATALOG di bawah. Kamu TIDAK menghitung harga.

ATURAN WAJIB:
1. Satu baris orderan = satu entri, urut sesuai tulisan. Jangan gabung, jangan lewati, jangan menambah baris yang tidak ada.
2. "raw" = tulisan baris itu persis seperti terbaca (termasuk kode & angka).
3. "code" = kode dari KATALOG yang paling tepat. Jika tulisan memuat kode (mis. G2G-35, g2g 35, 35), pakai kode itu bila ada di katalog. Jika hanya nama, cocokkan nama + ukuran/varian/warna/nomor shade. Jika ada 2+ SKU katalog yang sama-sama mungkin (mis. nama sama tapi ukuran beda) atau kamu tidak yakin, isi "code" dengan pilihan terbaik tetapi "sure": false dan isi "alt" dengan kode-kode lain yang mungkin. Jika sama sekali tidak ada di katalog, "code": "".
4. "qty" = angka jumlah yang ditulis untuk baris itu (angka saja). Jangan tertukar dengan angka bagian nama produk (mis. 377, 02, 300ml, 10%) atau nomor urut baris. Jika tidak ada jumlah, qty null.
5. "unit" = satuan yang ditulis: "pcs", "lsn" (lusin), "dus" (dus/karton/ctn/box). Jika tidak ditulis, "pcs".
6. Coretan / tulisan yang dicoret = diabaikan; jika angka ditimpa/dikoreksi, pakai angka koreksi terakhir dan "sure": false.
7. Tulisan yang tidak terbaca jelas: tetap buat entri, tebakan terbaik, "sure": false.
8. "outlet" = nama toko/outlet bila tertulis; "sales" = nama sales bila tertulis; "written_total" = total rupiah yang ditulis sales bila ada (angka), else null.
9. Balas HANYA JSON valid satu objek, tanpa markdown, tanpa penjelasan:
{"outlet":"","sales":"","written_total":null,"lines":[{"raw":"","code":"","qty":0,"unit":"pcs","sure":true,"alt":[]}]}

KATALOG (KODE | NAMA):
${cat}`;
    try {
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: env.ANTHROPIC_ORDER_MODEL || 'claude-sonnet-5-5', max_tokens: 6000, system, messages: [{ role: 'user', content }] }),
      });
      if (!ar.ok) { console.error('ord/read', ar.status, (await ar.text().catch(() => '')).slice(0, 300)); return J({ e: 'Server AI sedang bermasalah (' + ar.status + '), coba lagi' }, 502); }
      const aj = await ar.json();
      const txt = String(((aj.content || []).find((c) => c.type == 'text') || {}).text || '');
      const js = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
      let out; try { out = JSON.parse(js); } catch (e) { return J({ e: 'Hasil baca tidak terbaca. Coba foto ulang lebih terang, tegak & dekat.' }, 502); }
      const lines = (Array.isArray(out.lines) ? out.lines : []).slice(0, 300).map((l) => ({ raw: String(l.raw || '').slice(0, 200), code: String(l.code || '').slice(0, 40), qty: l.qty == null || l.qty === '' || isNaN(+l.qty) ? null : +l.qty, unit: String(l.unit || 'pcs').toLowerCase().slice(0, 10), sure: l.sure !== false, alt: (Array.isArray(l.alt) ? l.alt : []).slice(0, 6).map((x) => String(x).slice(0, 40)) }));
      return J({ outlet: String(out.outlet || '').slice(0, 80), sales: String(out.sales || '').slice(0, 60), written_total: +out.written_total || 0, lines, stop: aj.stop_reason || '' });
    } catch (e) { console.error('ord/read', e && e.message); return J({ e: 'Gagal menghubungi layanan baca foto' }, 502); }
  }
  return null;
}
