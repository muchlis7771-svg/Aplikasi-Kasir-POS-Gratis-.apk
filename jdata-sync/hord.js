// J-DATA Report: baca orderan sales (foto / teks) pakai AI + lupa password lewat email (pemilik akun / pemilik tim).
// Rahasia yang dipakai (Workers > jdata-sync > Settings > Variables and Secrets):
//   ANTHROPIC_API_KEY   → baca foto orderan
//   RESEND_API_KEY, MAIL_FROM (opsional, mis. "J-DATA <noreply@domainanda.com>") → kirim email kode reset
//   AUTH_ADMIN_USER, AUTH_ADMIN_PASS → akun admin J-DATA dipakai server untuk mengganti password setelah kode benar
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v) => (v == null ? "" : String(v));
const mask = (e) => { const [a, d] = s(e).split("@"); return (a.length <= 2 ? a[0] + "*" : a.slice(0, 2) + "*".repeat(Math.min(6, a.length - 2))) + "@" + d; };
let ready = false;
async function tables(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS user_email(username TEXT PRIMARY KEY, email TEXT NOT NULL, updated INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pw_reset(username TEXT PRIMARY KEY, code_hash TEXT NOT NULL, exp INTEGER NOT NULL, tries INTEGER DEFAULT 0, t INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS rl(k TEXT NOT NULL, t INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS rl_k ON rl(k,t)"),
    db.prepare("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)"),
  ]);
  ready = true;
}
async function limited(db, key, max, win) {
  const now = Date.now();
  if (Math.random() < 0.05) await db.prepare("DELETE FROM rl WHERE t<?").bind(now - 864e5).run();
  const r = await db.prepare("SELECT COUNT(*) c FROM rl WHERE k=? AND t>?").bind(key, now - win).first();
  if (r.c >= max) return true;
  await db.prepare("INSERT INTO rl(k,t) VALUES(?,?)").bind(key, now).run();
  return false;
}
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function mail(env, to, subject, text) {
  if (!env.RESEND_API_KEY) return { ok: false, e: "Pengiriman email belum diaktifkan (RESEND_API_KEY belum diatur di server jdata-sync)." };
  try {
    const html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">' + text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>").replace(/\b(\d{6})\b/, '<b style="font-size:26px;letter-spacing:4px">$1</b>') + "</div>";
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM || "J-DATA Report <onboarding@resend.dev>", to: [to], subject, text, html }) });
    if (!r.ok) { console.error("mail", r.status, (await r.text().catch(() => "")).slice(0, 200)); return { ok: false, e: "Email gagal dikirim (" + r.status + ")" }; }
    return { ok: true };
  } catch (e) { return { ok: false, e: "Email gagal dikirim" }; }
}

// token admin untuk endpoint /api/admin/reset-password di server login (disimpan di D1, login ulang bila kedaluwarsa)
async function adminToken(env, authPost, fresh) {
  if (!fresh) { const r = await env.DB.prepare("SELECT v FROM kv WHERE k='adm_tok'").first(); if (r && r.v) return r.v; }
  if (!env.AUTH_ADMIN_USER || !env.AUTH_ADMIN_PASS) throw new Error("Reset password belum diaktifkan (AUTH_ADMIN_USER / AUTH_ADMIN_PASS belum diatur di server jdata-sync). Hubungi admin.");
  const r = await authPost("/api/login", { username: env.AUTH_ADMIN_USER, password: env.AUTH_ADMIN_PASS, device_id: "jdata-sync-reset" });
  if (!r.ok || !r.j.token) throw new Error("Server tidak bisa masuk sebagai admin: " + s(r.j.error || r.status) + ". Pastikan akun admin boleh dipakai di 1 perangkat tambahan.");
  await env.DB.prepare("INSERT INTO kv(k,v) VALUES('adm_tok',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(r.j.token).run();
  return r.j.token;
}

export async function hordRoutes(url, req, env, authPost) {
  const db = env.DB; await tables(db);
  const b = await req.json().catch(() => ({}));
  const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
  const ip = req.headers.get("CF-Connecting-IP") || "x";
  const who = async () => {
    const v = await authPost("/api/verify", { token: s(b.token), device_id: s(b.device_id) });
    if (!v.ok || v.j.valid === false) return null;
    return s(v.j.username || b.username).trim().toLowerCase().slice(0, 60) || null;
  };

  // ---------- email pemulihan password (milik akun yang sedang login) ----------
  if (url.pathname === "/pw/email") {
    const me = await who(); if (!me) return J({ error: "Sesi tidak valid, login ulang." }, 401);
    if (b.email == null) { const r = await db.prepare("SELECT email FROM user_email WHERE username=?").bind(me).first(); return J({ email: (r && r.email) || "" }); }
    const em = s(b.email).trim().toLowerCase();
    if (em === "") { await db.prepare("DELETE FROM user_email WHERE username=?").bind(me).run(); return J({ ok: true, email: "" }); }
    if (!EMAIL.test(em) || em.length > 120) return J({ error: "Format email tidak valid" }, 400);
    if (await limited(db, "eml:" + me, 10, 36e5)) return J({ error: "Terlalu sering, coba lagi nanti" }, 429);
    await db.prepare("INSERT INTO user_email(username,email,updated) VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET email=excluded.email,updated=excluded.updated").bind(me, em, Date.now()).run();
    return J({ ok: true, email: em });
  }
  // ---------- lupa password: kirim kode 6 angka ----------
  if (url.pathname === "/pw/forgot") {
    const u = s(b.username).trim().toLowerCase().slice(0, 60);
    if (u.length < 3) return J({ error: "Isi username" }, 400);
    if ((await limited(db, "pwf:" + ip, 10, 36e5)) || (await limited(db, "pwf:" + u, 3, 9e5))) return J({ error: "Terlalu sering meminta kode. Coba lagi 15 menit lagi." }, 429);
    let r = await db.prepare("SELECT email FROM user_email WHERE username=?").bind(u).first(), via = "akun";
    if (!r) { // anggota tim tanpa email sendiri → kode dikirim ke email pemilik tim
      const t = await db.prepare("SELECT owner FROM teams WHERE member=?").bind(u).first().catch(() => null);
      if (t) { r = await db.prepare("SELECT email FROM user_email WHERE username=?").bind(s(t.owner).toLowerCase()).first(); via = "pemilik tim (" + t.owner + ")"; }
    }
    if (!r || !EMAIL.test(r.email)) return J({ error: "Akun ini belum punya email pemulihan. Hubungi admin untuk reset password, lalu isi email di menu akun agar lain kali bisa reset sendiri.", noEmail: true }, 400);
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await db.prepare("INSERT INTO pw_reset(username,code_hash,exp,tries,t) VALUES(?,?,?,0,?) ON CONFLICT(username) DO UPDATE SET code_hash=excluded.code_hash,exp=excluded.exp,tries=0,t=excluded.t").bind(u, await sha(u + ":" + code + ":" + (env.SYNC_TOKEN || "")), Date.now() + 15 * 6e4, Date.now()).run();
    const m = await mail(env, r.email, "Kode reset password J-DATA: " + code, `Ada permintaan reset password untuk akun J-DATA Report "${u}".\n\nKode reset:\n${code}\n\nKode berlaku 15 menit dan hanya bisa dipakai sekali. Jangan berikan kode ini kepada orang yang tidak dikenal.\nJika tidak ada yang meminta reset, abaikan email ini — password tidak berubah.`);
    if (!m.ok) return J({ error: m.e }, 502);
    return J({ ok: true, to: mask(r.email), via });
  }
  // ---------- lupa password: kode + password baru ----------
  if (url.pathname === "/pw/reset") {
    const u = s(b.username).trim().toLowerCase().slice(0, 60), code = s(b.code).replace(/\D/g, ""), np = s(b.new_password);
    if (u.length < 3 || code.length !== 6) return J({ error: "Isi username dan 6 angka kode dari email" }, 400);
    if (np.length < 6) return J({ error: "Password baru minimal 6 karakter" }, 400);
    if (await limited(db, "pwr:" + ip, 20, 36e5)) return J({ error: "Terlalu banyak percobaan, coba lagi nanti" }, 429);
    const r = await db.prepare("SELECT * FROM pw_reset WHERE username=?").bind(u).first();
    if (!r || r.exp < Date.now()) return J({ error: "Kode sudah kedaluwarsa atau belum diminta. Minta kode baru." }, 400);
    if (r.tries >= 5) { await db.prepare("DELETE FROM pw_reset WHERE username=?").bind(u).run(); return J({ error: "Terlalu banyak kode salah. Minta kode baru." }, 400); }
    if (r.code_hash !== (await sha(u + ":" + code + ":" + (env.SYNC_TOKEN || "")))) { await db.prepare("UPDATE pw_reset SET tries=tries+1 WHERE username=?").bind(u).run(); return J({ error: "Kode salah (sisa " + (4 - r.tries) + " kali percobaan)" }, 400); }
    try {
      let tok = await adminToken(env, authPost, false);
      let x = await authPost("/api/admin/reset-password", { username: u, new_password: np }, tok);
      if (x.status === 401 || x.status === 403) { tok = await adminToken(env, authPost, true); x = await authPost("/api/admin/reset-password", { username: u, new_password: np }, tok); }
      if (!x.ok) return J({ error: "Gagal mengganti password: " + s(x.j.error || x.status) }, 502);
    } catch (e) { return J({ error: s(e.message || e) }, 502); }
    await db.prepare("DELETE FROM pw_reset WHERE username=?").bind(u).run();
    const em = await db.prepare("SELECT email FROM user_email WHERE username=?").bind(u).first();
    if (em) await mail(env, em.email, "Password J-DATA Anda baru saja diganti", `Password akun J-DATA Report "${u}" berhasil diganti lewat reset email pada ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA.\nJika ini bukan Anda, segera hubungi admin J-DATA.`);
    return J({ ok: true });
  }
  // ---------- baca orderan (foto tulisan tangan / teks) pakai AI ----------
  if (url.pathname === "/ord/read") {
    const me = await who(); if (!me) return J({ error: "Sesi tidak valid, login ulang." }, 401);
    if (!env.ANTHROPIC_API_KEY) return J({ error: "Baca foto belum diaktifkan (ANTHROPIC_API_KEY belum diatur di server jdata-sync). Orderan teks tetap bisa dihitung." }, 501);
    if ((await limited(db, "ord:" + me, 40, 6e5)) || (await limited(db, "ordd:" + me, 400, 864e5))) return J({ error: "Terlalu banyak permintaan baca, coba beberapa menit lagi" }, 429);
    const cat = (Array.isArray(b.cat) ? b.cat : []).slice(0, 3000).map((r) => s(r[0]).slice(0, 40) + " | " + s(r[1]).slice(0, 120)).join("\n");
    if (!cat) return J({ error: "Daftar harga kosong" }, 400);
    const ali = (Array.isArray(b.alias) ? b.alias : []).slice(-300).map((r) => s(r[0]).slice(0, 80) + " → " + s(r[1]).slice(0, 40)).join("\n");
    const content = [];
    if (b.image) {
      const mm = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(s(b.image));
      if (!mm || mm[2].length > 4500000) return J({ error: "Foto tidak didukung atau terlalu besar" }, 400);
      content.push({ type: "image", source: { type: "base64", media_type: mm[1], data: mm[2] } }, { type: "text", text: "Baca foto orderan ini. Salin SEMUA baris orderan sesuai instruksi." });
    } else if (b.text) content.push({ type: "text", text: "Teks orderan dari sales:\n<<<\n" + s(b.text).slice(0, 8000) + "\n>>>\nSalin SEMUA baris orderan sesuai instruksi." });
    else return J({ error: "Kirim foto atau teks" }, 400);
    const system = `Kamu adalah admin distributor di Indonesia yang sangat teliti. Tugasmu: MENYALIN (transkripsi) orderan sales dari foto tulisan tangan / foto layar / teks, lalu mencocokkan tiap baris ke KATALOG di bawah. Kamu TIDAK menghitung harga.

ATURAN WAJIB:
1. Satu baris orderan = satu entri, urut sesuai tulisan. Jangan gabung, jangan lewati, jangan menambah baris yang tidak ada.
2. "raw" = tulisan baris itu persis seperti terbaca (termasuk kode & angka).
3. "code" = kode dari KATALOG yang paling tepat. Jika tulisan memuat kode (mis. G2G-35, g2g 35, 35), pakai kode itu bila ada di katalog. Jika hanya nama, cocokkan nama + ukuran/varian/warna/nomor shade. Jika ada 2+ SKU katalog yang sama-sama mungkin (mis. nama sama tapi ukuran beda) atau kamu tidak yakin, isi "code" dengan pilihan terbaik tetapi "sure": false dan isi "alt" dengan kode-kode lain yang mungkin. Jika tidak ada di katalog, "code": "".
4. "qty" = angka jumlah yang ditulis untuk baris itu (angka saja). Jangan tertukar dengan angka bagian nama produk (mis. 377, 02, 300ml, 10%) atau nomor urut baris. Jika tidak ada jumlah, qty null.
5. "unit" = satuan yang ditulis: "pcs", "lsn" (lusin), "dus" (dus/karton/ctn/box). Jika tidak ditulis, "pcs".
6. Tulisan yang dicoret diabaikan; jika angka ditimpa/dikoreksi, pakai angka koreksi terakhir dan "sure": false.
7. Tulisan yang tidak terbaca jelas: tetap buat entri dengan tebakan terbaik, "sure": false.
8. Sales sering MENYINGKAT atau salah eja (huruf hilang/tertukar). Contoh singkatan: CS/CSN/CUSH = CUSHION, MW = MICELLAR WATER, MOIST/MST = MOISTURIZER, SRM/SER = SERUM, TNR = TONER, FW = FACIAL WASH, CLN = CLEANSER, RF/RFL = REFILL, POME = POMEGRANATE, NIA/NIAC = NIACINAMIDE, CNTL/CICA = CENTELLA, RTN = RETINOL, SAL = SALICYLIC, BB/BLBRY = BLUEBERRY, PCH = PEACH, DS = DARK SPOT, PRL = PRALINE, CUST = CUSTARD. Tafsirkan singkatan & salah eja dengan membandingkan ke nama di KATALOG (perhatikan nomor shade 00–05, ukuran ml/g, dan kata REFILL). "raw" tetap tulisan asli apa adanya.
9. "outlet" = nama toko/outlet bila tertulis; "sales" = nama sales bila tertulis; "written_total" = total rupiah yang ditulis sales bila ada (angka), else null.
10. Balas HANYA JSON valid satu objek, tanpa markdown, tanpa penjelasan:
{"outlet":"","sales":"","written_total":null,"lines":[{"raw":"","code":"","qty":0,"unit":"pcs","sure":true,"alt":[]}]}

KATALOG (KODE | NAMA):
${cat}${ali ? "\n\nKOREKSI SEBELUMNYA dari admin (kata tulisan sales → kode yang benar). Jika tulisan cocok, pakai kode ini:\n" + ali : ""}`;
    try {
      const ar = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: env.ANTHROPIC_ORDER_MODEL || "claude-sonnet-5-5", max_tokens: 6000, system, messages: [{ role: "user", content }] }),
      });
      if (!ar.ok) { console.error("ord/read", ar.status, (await ar.text().catch(() => "")).slice(0, 300)); return J({ error: "Server AI sedang bermasalah (" + ar.status + "), coba lagi" }, 502); }
      const aj = await ar.json();
      const txt = s(((aj.content || []).find((c) => c.type === "text") || {}).text);
      let out; try { out = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)); } catch (e) { return J({ error: "Hasil baca tidak terbaca. Coba foto ulang lebih terang, tegak & dekat." }, 502); }
      const lines = (Array.isArray(out.lines) ? out.lines : []).slice(0, 300).map((l) => ({ raw: s(l.raw).slice(0, 200), code: s(l.code).slice(0, 40), qty: l.qty == null || l.qty === "" || isNaN(+l.qty) ? null : +l.qty, unit: s(l.unit || "pcs").toLowerCase().slice(0, 10), sure: l.sure !== false, alt: (Array.isArray(l.alt) ? l.alt : []).slice(0, 6).map((x) => s(x).slice(0, 40)) }));
      return J({ outlet: s(out.outlet).slice(0, 80), sales: s(out.sales).slice(0, 60), written_total: +out.written_total || 0, lines });
    } catch (e) { console.error("ord/read", e && e.message); return J({ error: "Gagal menghubungi layanan baca foto" }, 502); }
  }
  return J({ error: "not found" }, 404);
}
