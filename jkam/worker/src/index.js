// JKam API — Head Admin / Owner / User
// File audio disimpan di R2, data akun/lisensi/rekaman di D1.
import { PANEL_HTML } from "./panel.js";
import { LOGO_SVG } from "./logo.js";
import { sendPush } from "./fcm.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization,Content-Type,X-Session-Id,X-Seq,X-Started-At,X-Duration-Ms,X-Enhanced,X-Device,Range",
  "Access-Control-Expose-Headers": "Content-Range,Accept-Ranges,Content-Length",
};
const DAY = 86400000;
const MAX_UPLOAD = 100 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
const fail = (status, msg) => { throw new HttpError(status, msg); };

// ---------- kripto ----------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}
function sameStr(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------- util ----------
const cleanUser = (u) => String(u || "").trim().toLowerCase();
function validUsername(u) { return /^[a-z0-9_.-]{3,32}$/.test(u); }
function validPassword(p) { return typeof p === "string" && p.length >= 6 && p.length <= 128; }
async function body(req) { try { return await req.json(); } catch { return {}; } }
const dayKey = (ms) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
function dayRange(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const s = Date.parse(date + "T00:00:00+08:00"); return [s, s + DAY];
}

let bootstrapped = false;
async function bootstrap(env) {
  if (bootstrapped) return;
  const r = await env.DB.prepare("SELECT id FROM accounts WHERE role='headadmin' LIMIT 1").first();
  if (!r) {
    let salt, hash;
    const m = /^pbkdf2\$100000\$([0-9a-f]+)\$([0-9a-f]{64})$/.exec(env.HEADADMIN_PASS_HASH || "");
    if (m) { salt = m[1]; hash = m[2]; }
    else if (env.HEADADMIN_PASSWORD) { salt = randHex(16); hash = await hashPassword(env.HEADADMIN_PASSWORD, salt); }
    if (hash) await env.DB.prepare(
      "INSERT INTO accounts (role, username, pass_hash, pass_salt, name, created_at) VALUES ('headadmin', ?1, ?2, ?3, 'Head Admin', ?4)"
    ).bind(cleanUser(env.HEADADMIN_USER || "headadmin"), hash, salt, Date.now()).run();
  }
  bootstrapped = true;
}

async function createSession(env, accountId, days) {
  const token = randHex(32);
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256(token), accountId, now, now + days * DAY).run();
  return token;
}

async function auth(req, env, url) {
  const h = req.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("token") || "";
  if (!token) fail(401, "Silakan login");
  const acc = await env.DB.prepare(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2`
  ).bind(await sha256(token), Date.now()).first();
  if (!acc) fail(401, "Sesi habis, silakan login lagi");
  if (acc.status !== "active") fail(403, "Akun dinonaktifkan");
  return acc;
}
const need = (acc, ...roles) => { if (!roles.includes(acc.role)) fail(403, "Akses ditolak"); };

async function activeLicense(env, ownerId) {
  return env.DB.prepare(
    `SELECT l.*, p.name AS package_name, p.max_users, p.storage_gb
     FROM licenses l JOIN packages p ON p.id = l.package_id
     WHERE l.owner_id = ?1 AND l.status = 'active' AND l.expires_at > ?2
     ORDER BY l.expires_at DESC LIMIT 1`
  ).bind(ownerId, Date.now()).first();
}
async function ownerUsage(env, ownerId) {
  return env.DB.prepare(
    "SELECT COUNT(*) AS files, COALESCE(SUM(size),0) AS bytes, COALESCE(SUM(duration_ms),0) AS ms FROM recordings WHERE owner_id = ?1"
  ).bind(ownerId).first();
}
const publicAcc = (a) => ({
  id: a.id, role: a.role, username: a.username, name: a.name, phone: a.phone, owner_id: a.owner_id,
  status: a.status, last_seen: a.last_seen, is_recording: a.is_recording, device_info: a.device_info, created_at: a.created_at,
});

// ---------- AUTH ----------
async function login(req, env) {
  const b = await body(req);
  const username = cleanUser(b.username);
  const acc = await env.DB.prepare("SELECT * FROM accounts WHERE username = ?1").bind(username).first();
  const ok = acc && sameStr(await hashPassword(String(b.password || ""), acc.pass_salt), acc.pass_hash);
  if (!ok) fail(401, "Username atau password salah");
  if (b.app && b.app !== acc.role) fail(403, `Akun ini bukan untuk aplikasi JKam ${b.app}`);
  if (acc.status !== "active") fail(403, "Akun dinonaktifkan");
  if (acc.role === "user") {
    const owner = await env.DB.prepare("SELECT status FROM accounts WHERE id = ?1").bind(acc.owner_id).first();
    if (!owner || owner.status !== "active") fail(403, "Owner Anda dinonaktifkan");
  }
  const token = await createSession(env, acc.id, acc.role === "user" ? 365 : 30);
  return json({ token, account: publicAcc(acc) });
}

async function registerOwner(req, env) {
  const b = await body(req);
  const username = cleanUser(b.username);
  if (!validUsername(username)) fail(400, "Username 3-32 karakter: huruf kecil, angka, titik, garis bawah");
  if (!validPassword(b.password)) fail(400, "Password minimal 6 karakter");
  if (!String(b.name || "").trim()) fail(400, "Nama wajib diisi");
  const pkg = await env.DB.prepare("SELECT id FROM packages WHERE id = ?1 AND active = 1").bind(b.package_id | 0).first();
  if (!pkg) fail(400, "Pilih paket");
  const exists = await env.DB.prepare("SELECT 1 FROM accounts WHERE username = ?1").bind(username).first();
  if (exists) fail(409, "Username sudah dipakai");
  const salt = randHex(16); const now = Date.now();
  const r = await env.DB.prepare(
    "INSERT INTO accounts (role, username, pass_hash, pass_salt, name, phone, created_at) VALUES ('owner', ?1, ?2, ?3, ?4, ?5, ?6)"
  ).bind(username, await hashPassword(b.password, salt), salt, String(b.name).trim().slice(0, 80), String(b.phone || "").slice(0, 30), now).run();
  const ownerId = r.meta.last_row_id;
  await env.DB.prepare("INSERT INTO licenses (owner_id, package_id, status, requested_at) VALUES (?1, ?2, 'pending', ?3)")
    .bind(ownerId, pkg.id, now).run();
  const token = await createSession(env, ownerId, 30);
  const acc = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?1").bind(ownerId).first();
  return json({ token, account: publicAcc(acc) });
}

async function changePassword(req, env, acc) {
  const b = await body(req);
  if (!sameStr(await hashPassword(String(b.old_password || ""), acc.pass_salt), acc.pass_hash)) fail(400, "Password lama salah");
  if (!validPassword(b.new_password)) fail(400, "Password baru minimal 6 karakter");
  const salt = randHex(16);
  await env.DB.prepare("UPDATE accounts SET pass_hash = ?1, pass_salt = ?2 WHERE id = ?3")
    .bind(await hashPassword(b.new_password, salt), salt, acc.id).run();
  return json({ ok: true });
}

async function setPassword(env, id, password) {
  if (!validPassword(password)) fail(400, "Password minimal 6 karakter");
  const salt = randHex(16);
  await env.DB.prepare("UPDATE accounts SET pass_hash = ?1, pass_salt = ?2 WHERE id = ?3")
    .bind(await hashPassword(password, salt), salt, id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?1").bind(id).run();
}

async function me(env, acc) {
  const out = { account: publicAcc(acc) };
  const ownerId = acc.role === "owner" ? acc.id : acc.role === "user" ? acc.owner_id : null;
  if (ownerId) out.license = await activeLicense(env, ownerId);
  return json(out);
}

// ---------- OWNER ----------
async function ownerSummary(env, acc) {
  const license = await activeLicense(env, acc.id);
  const pending = await env.DB.prepare(
    `SELECT l.*, p.name AS package_name, p.price FROM licenses l JOIN packages p ON p.id = l.package_id
     WHERE l.owner_id = ?1 AND l.status = 'pending' ORDER BY l.requested_at DESC LIMIT 1`).bind(acc.id).first();
  const users = await env.DB.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN is_recording=1 AND last_seen > ?2 THEN 1 ELSE 0 END) AS recording FROM accounts WHERE owner_id = ?1"
  ).bind(acc.id, Date.now() - 10 * 60000).first();
  const history = await env.DB.prepare(
    `SELECT l.*, p.name AS package_name, p.price FROM licenses l JOIN packages p ON p.id = l.package_id
     WHERE l.owner_id = ?1 ORDER BY l.requested_at DESC LIMIT 20`).bind(acc.id).all();
  return json({ account: publicAcc(acc), license, pending, usage: await ownerUsage(env, acc.id), users, history: history.results });
}

async function ownerRequestLicense(req, env, acc) {
  const b = await body(req);
  const pkg = await env.DB.prepare("SELECT id FROM packages WHERE id = ?1 AND active = 1").bind(b.package_id | 0).first();
  if (!pkg) fail(400, "Paket tidak ditemukan");
  const pend = await env.DB.prepare("SELECT id FROM licenses WHERE owner_id = ?1 AND status = 'pending'").bind(acc.id).first();
  if (pend) {
    await env.DB.prepare("UPDATE licenses SET package_id = ?1, requested_at = ?2 WHERE id = ?3").bind(pkg.id, Date.now(), pend.id).run();
  } else {
    await env.DB.prepare("INSERT INTO licenses (owner_id, package_id, status, requested_at) VALUES (?1, ?2, 'pending', ?3)")
      .bind(acc.id, pkg.id, Date.now()).run();
  }
  return json({ ok: true });
}

async function ownerUsers(env, ownerId) {
  const r = await env.DB.prepare(
    `SELECT a.*, (SELECT COUNT(*) FROM recordings r WHERE r.user_id = a.id) AS files,
            (SELECT COALESCE(SUM(duration_ms),0) FROM recordings r WHERE r.user_id = a.id) AS ms,
            (SELECT MAX(started_at) FROM recordings r WHERE r.user_id = a.id) AS last_rec
     FROM accounts a WHERE a.owner_id = ?1 ORDER BY a.created_at DESC`).bind(ownerId).all();
  return r.results.map((u) => ({ ...publicAcc(u), files: u.files, ms: u.ms, last_rec: u.last_rec }));
}

async function ownerCreateUser(req, env, acc) {
  const lic = await activeLicense(env, acc.id);
  if (!lic) fail(402, "Lisensi belum aktif. Tunggu persetujuan Head Admin.");
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM accounts WHERE owner_id = ?1").bind(acc.id).first();
  if (count.n >= lic.max_users) fail(402, `Batas paket ${lic.package_name}: maksimal ${lic.max_users} user`);
  const b = await body(req);
  const username = cleanUser(b.username);
  if (!validUsername(username)) fail(400, "Username 3-32 karakter: huruf kecil, angka, titik, garis bawah");
  if (!validPassword(b.password)) fail(400, "Password minimal 6 karakter");
  if (await env.DB.prepare("SELECT 1 FROM accounts WHERE username = ?1").bind(username).first()) fail(409, "Username sudah dipakai");
  const salt = randHex(16);
  await env.DB.prepare(
    "INSERT INTO accounts (role, username, pass_hash, pass_salt, name, owner_id, created_at) VALUES ('user', ?1, ?2, ?3, ?4, ?5, ?6)"
  ).bind(username, await hashPassword(b.password, salt), salt, String(b.name || username).slice(0, 80), acc.id, Date.now()).run();
  return json({ ok: true });
}

async function getUserOf(env, acc, id) {
  const u = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?1 AND role = 'user'").bind(id).first();
  if (!u) fail(404, "User tidak ditemukan");
  if (acc.role === "owner" && u.owner_id !== acc.id) fail(403, "Bukan user Anda");
  return u;
}

async function updateUser(req, env, acc, id) {
  const u = await getUserOf(env, acc, id);
  const b = await body(req);
  if (b.status === "active" || b.status === "suspended") {
    await env.DB.prepare("UPDATE accounts SET status = ?1 WHERE id = ?2").bind(b.status, u.id).run();
    if (b.status === "suspended") await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?1").bind(u.id).run();
  }
  if (typeof b.name === "string" && b.name.trim()) await env.DB.prepare("UPDATE accounts SET name = ?1 WHERE id = ?2").bind(b.name.trim().slice(0, 80), u.id).run();
  if (b.password) await setPassword(env, u.id, b.password);
  return json({ ok: true });
}

async function deleteUser(env, acc, id) {
  const u = await getUserOf(env, acc, id);
  await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?1").bind(u.id).run();
  await env.DB.prepare("DELETE FROM accounts WHERE id = ?1").bind(u.id).run();
  return json({ ok: true, note: "Rekaman user tetap tersimpan" });
}

async function listRecordings(env, url, filter) {
  const where = []; const args = [];
  const add = (sql, v) => { args.push(v); where.push(sql.replace("?", "?" + args.length)); };
  if (filter.owner_id) add("r.owner_id = ?", filter.owner_id);
  const uid = url.searchParams.get("user_id"); if (uid) add("r.user_id = ?", uid | 0);
  const oid = url.searchParams.get("owner_id"); if (oid && !filter.owner_id) add("r.owner_id = ?", oid | 0);
  const rng = dayRange(url.searchParams.get("date"));
  if (rng) { add("r.started_at >= ?", rng[0]); add("r.started_at < ?", rng[1]); }
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10) || 500, 2000);
  args.push(limit);
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.owner_id, r.user_id, r.session_id, r.seq, r.started_at, r.duration_ms, r.size, r.enhanced,
            u.name AS user_name, u.username AS user_username, o.name AS owner_name
     FROM recordings r LEFT JOIN accounts u ON u.id = r.user_id LEFT JOIN accounts o ON o.id = r.owner_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY r.started_at DESC LIMIT ?${args.length}`
  ).bind(...args).all();
  return json({ recordings: results });
}

// ---------- USER (perekam) ----------
async function upload(req, env, acc) {
  need(acc, "user");
  const owner = await env.DB.prepare("SELECT status FROM accounts WHERE id = ?1").bind(acc.owner_id).first();
  if (!owner || owner.status !== "active") fail(403, "Owner dinonaktifkan");
  const lic = await activeLicense(env, acc.owner_id);
  if (!lic) fail(402, "Lisensi owner tidak aktif");
  const usage = await ownerUsage(env, acc.owner_id);
  if (usage.bytes > lic.storage_gb * 1e9) fail(507, "Kuota penyimpanan owner penuh");

  const session = String(req.headers.get("X-Session-Id") || "").replace(/[^a-zA-Z0-9\-]/g, "").slice(0, 40);
  const seq = parseInt(req.headers.get("X-Seq") || "", 10);
  const startedAt = parseInt(req.headers.get("X-Started-At") || "", 10);
  const durationMs = parseInt(req.headers.get("X-Duration-Ms") || "0", 10) || 0;
  const enhanced = req.headers.get("X-Enhanced") === "0" ? 0 : 1;
  const mime = (req.headers.get("Content-Type") || "audio/mp4").split(";")[0];
  if (!session || !Number.isFinite(seq) || !Number.isFinite(startedAt)) fail(400, "Header rekaman tidak lengkap");
  if (!mime.startsWith("audio/")) fail(415, "Harus file audio");
  if (parseInt(req.headers.get("Content-Length") || "0", 10) > MAX_UPLOAD) fail(413, "File terlalu besar");
  const data = await req.arrayBuffer();
  if (!data.byteLength) fail(400, "File kosong");

  const id = `u${acc.id}-${session}-${String(seq).padStart(5, "0")}`;
  const key = `o${acc.owner_id}/u${acc.id}/${dayKey(startedAt)}/${id}.m4a`;
  await env.AUDIO.put(key, data, { httpMetadata: { contentType: mime } });
  await env.DB.prepare(
    `INSERT OR REPLACE INTO recordings (id, owner_id, user_id, session_id, seq, started_at, duration_ms, size, mime, r2_key, enhanced, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
  ).bind(id, acc.owner_id, acc.id, session, seq, startedAt, durationMs, data.byteLength, mime, key, enhanced, Date.now()).run();
  const dev = String(req.headers.get("X-Device") || "").slice(0, 80);
  await env.DB.prepare("UPDATE accounts SET last_seen = ?1, device_info = CASE WHEN ?2 = '' THEN device_info ELSE ?2 END WHERE id = ?3")
    .bind(Date.now(), dev, acc.id).run();
  return json({ ok: true, id });
}

async function heartbeat(req, env, acc) {
  need(acc, "user");
  const b = await body(req);
  await env.DB.prepare("UPDATE accounts SET last_seen = ?1, is_recording = ?2, device_info = ?3 WHERE id = ?4")
    .bind(Date.now(), b.recording ? 1 : 0, String(b.device || acc.device_info || "").slice(0, 80), acc.id).run();
  const lic = await activeLicense(env, acc.owner_id);
  return json({ ok: true, license_active: !!lic, expires_at: lic ? lic.expires_at : null });
}

// ---------- perintah mulai/stop dari Owner ----------
async function setCommand(req, env, acc, userId) {
  const u = await getUserOf(env, acc, userId); // cek user ini milik owner (admin lolos)
  const b = await body(req);
  const action = b.action === "stop" ? "stop" : b.action === "start" ? "start" : null;
  if (!action) fail(400, "Perintah harus start atau stop");
  const ts = Date.now();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO commands (user_id, action, created_at, acked) VALUES (?1, ?2, ?3, 0)"
  ).bind(u.id, action, ts).run();
  // Push instan via Firebase (best-effort; jika tidak ada token/secret, user memakai polling)
  let pushed = false;
  try {
    const t = await env.DB.prepare("SELECT token FROM fcm_tokens WHERE user_id = ?1").bind(u.id).first();
    if (t && t.token) pushed = await sendPush(env, t.token, { type: "command", action, created_at: String(ts) });
  } catch (_) {}
  return json({ ok: true, pushed });
}

async function saveFcmToken(req, env, acc) {
  need(acc, "user");
  const b = await body(req);
  const token = String(b.token || "").slice(0, 300);
  if (token) await env.DB.prepare(
    "INSERT OR REPLACE INTO fcm_tokens (user_id, token, updated_at) VALUES (?1, ?2, ?3)"
  ).bind(acc.id, token, Date.now()).run();
  return json({ ok: true });
}

async function getCommand(env, acc) {
  need(acc, "user");
  const c = await env.DB.prepare("SELECT action, created_at FROM commands WHERE user_id = ?1 AND acked = 0").bind(acc.id).first();
  return json({ command: c || null });
}

async function ackCommand(req, env, acc) {
  need(acc, "user");
  const b = await body(req);
  const ts = Number(b.created_at) || 0; // timestamp ms > 32-bit, jangan pakai | 0
  await env.DB.prepare("UPDATE commands SET acked = 1 WHERE user_id = ?1 AND created_at = ?2").bind(acc.id, ts).run();
  return json({ ok: true });
}

// ---------- rekaman: putar / hapus ----------
async function recordingFor(env, acc, id) {
  const r = await env.DB.prepare("SELECT * FROM recordings WHERE id = ?1").bind(id).first();
  if (!r) fail(404, "Rekaman tidak ditemukan");
  if (acc.role === "owner" && r.owner_id !== acc.id) fail(403, "Akses ditolak");
  if (acc.role === "user") fail(403, "Akses ditolak");
  return r;
}

async function streamAudio(req, env, acc, id) {
  const row = await recordingFor(env, acc, id);
  const range = req.headers.get("Range");
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m && (m[1] || m[2])) {
    const head = await env.AUDIO.head(row.r2_key);
    if (!head) fail(404, "File hilang");
    const size = head.size;
    let start, end;
    if (m[1]) { start = parseInt(m[1], 10); end = m[2] ? parseInt(m[2], 10) : size - 1; }
    else { start = size - parseInt(m[2], 10); end = size - 1; }
    start = Math.max(0, start); end = Math.min(size - 1, end);
    const obj = await env.AUDIO.get(row.r2_key, { range: { offset: start, length: end - start + 1 } });
    return new Response(obj.body, { status: 206, headers: {
      "Content-Type": row.mime, "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes", ...CORS } });
  }
  const obj = await env.AUDIO.get(row.r2_key);
  if (!obj) fail(404, "File hilang");
  return new Response(obj.body, { headers: {
    "Content-Type": row.mime, "Content-Length": String(obj.size), "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="JKam-${row.id}.m4a"`, ...CORS } });
}

async function deleteRecording(env, acc, id) {
  const r = await recordingFor(env, acc, id);
  await env.AUDIO.delete(r.r2_key);
  await env.DB.prepare("DELETE FROM recordings WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

// Hapus massal: pilihan (ids), satu sesi, satu user/tanggal, atau lebih lama dari N hari.
async function bulkDelete(req, env, acc) {
  const b = await body(req);
  const where = []; const args = [];
  const add = (cond, v) => { args.push(v); where.push(cond.replace("?", "?" + args.length)); };
  if (acc.role === "owner") add("owner_id = ?", acc.id);
  else if (b.owner_id) add("owner_id = ?", b.owner_id | 0);

  if (Array.isArray(b.ids) && b.ids.length) {
    const ids = b.ids.slice(0, 3000).map(String);
    where.push("id IN (" + ids.map((_, i) => "?" + (args.length + i + 1)).join(",") + ")");
    args.push(...ids);
  } else {
    const rng = dayRange(b.date);
    if (b.user_id) add("user_id = ?", b.user_id | 0);
    if (b.session_id) add("session_id = ?", String(b.session_id));
    if (rng) { add("started_at >= ?", rng[0]); add("started_at < ?", rng[1]); }
    if (b.before_days) add("started_at < ?", Date.now() - (b.before_days | 0) * DAY);
    if (!(b.user_id || b.session_id || rng || b.before_days)) fail(400, "Pilih rekaman atau filter dulu");
  }
  const { results } = await env.DB.prepare(
    "SELECT id, r2_key FROM recordings WHERE " + where.join(" AND ") + " ORDER BY started_at LIMIT 5000"
  ).bind(...args).all();
  if (!results.length) return json({ ok: true, deleted: 0 });
  const keys = results.map((r) => r.r2_key);
  for (let i = 0; i < keys.length; i += 1000) await env.AUDIO.delete(keys.slice(i, i + 1000));
  const ids = results.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    await env.DB.prepare("DELETE FROM recordings WHERE id IN (" + chunk.map((_, k) => "?" + (k + 1)).join(",") + ")").bind(...chunk).run();
  }
  return json({ ok: true, deleted: results.length });
}

// ---------- HEAD ADMIN ----------
async function adminSummary(env) {
  const now = Date.now();
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
  const [owners, users, rec, pending, activeLic, recording] = await Promise.all([
    q("SELECT COUNT(*) AS n FROM accounts WHERE role='owner'"),
    q("SELECT COUNT(*) AS n FROM accounts WHERE role='user'"),
    q("SELECT COUNT(*) AS files, COALESCE(SUM(size),0) AS bytes, COALESCE(SUM(duration_ms),0) AS ms FROM recordings"),
    q("SELECT COUNT(*) AS n FROM licenses WHERE status='pending'"),
    q("SELECT COUNT(DISTINCT owner_id) AS n FROM licenses WHERE status='active' AND expires_at > ?1", now),
    q("SELECT COUNT(*) AS n FROM accounts WHERE role='user' AND is_recording=1 AND last_seen > ?1", now - 10 * 60000),
  ]);
  const revenue = await q(
    "SELECT COALESCE(SUM(p.price),0) AS total FROM licenses l JOIN packages p ON p.id=l.package_id WHERE l.status='active' AND l.starts_at > ?1",
    now - 30 * DAY);
  return json({ owners: owners.n, users: users.n, recordings: rec, pending: pending.n, active_owners: activeLic.n,
    recording_now: recording.n, revenue_30d: revenue.total });
}

async function adminOwners(env) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT a.*,
      (SELECT COUNT(*) FROM accounts u WHERE u.owner_id = a.id) AS user_count,
      (SELECT COUNT(*) FROM accounts u WHERE u.owner_id = a.id AND u.is_recording = 1 AND u.last_seen > ?1) AS recording_now,
      (SELECT COALESCE(SUM(size),0) FROM recordings r WHERE r.owner_id = a.id) AS bytes,
      (SELECT p.name FROM licenses l JOIN packages p ON p.id=l.package_id WHERE l.owner_id=a.id AND l.status='active' AND l.expires_at > ?2 ORDER BY l.expires_at DESC LIMIT 1) AS package_name,
      (SELECT l.expires_at FROM licenses l WHERE l.owner_id=a.id AND l.status='active' ORDER BY l.expires_at DESC LIMIT 1) AS expires_at,
      (SELECT COUNT(*) FROM licenses l WHERE l.owner_id=a.id AND l.status='pending') AS pending
     FROM accounts a WHERE a.role = 'owner' ORDER BY a.created_at DESC`).bind(now - 10 * 60000, now).all();
  return json({ owners: results.map((o) => ({ ...publicAcc(o), user_count: o.user_count, recording_now: o.recording_now,
    bytes: o.bytes, package_name: o.package_name, expires_at: o.expires_at, pending: o.pending })) });
}

async function adminUpdateOwner(req, env, id) {
  const o = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?1 AND role = 'owner'").bind(id).first();
  if (!o) fail(404, "Owner tidak ditemukan");
  const b = await body(req);
  if (b.status === "active" || b.status === "suspended") {
    await env.DB.prepare("UPDATE accounts SET status = ?1 WHERE id = ?2").bind(b.status, id).run();
    // Sesi owner diputus; HP user tetap login tapi upload ditahan (rekaman antre di HP) sampai owner aktif lagi.
    if (b.status === "suspended") await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?1").bind(id).run();
  }
  if (b.password) await setPassword(env, id, b.password);
  return json({ ok: true });
}

async function adminDeleteOwner(env, id) {
  const o = await env.DB.prepare("SELECT id FROM accounts WHERE id = ?1 AND role = 'owner'").bind(id).first();
  if (!o) fail(404, "Owner tidak ditemukan");
  // hapus file R2 milik owner (bertahap)
  let cursor;
  do {
    const list = await env.AUDIO.list({ prefix: `o${id}/`, cursor });
    if (list.objects.length) await env.AUDIO.delete(list.objects.map((x) => x.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM recordings WHERE owner_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE owner_id = ?1 OR id = ?1)").bind(id),
    env.DB.prepare("DELETE FROM licenses WHERE owner_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM accounts WHERE owner_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM accounts WHERE id = ?1").bind(id),
  ]);
  return json({ ok: true });
}

async function adminLicenses(env, url) {
  const status = url.searchParams.get("status");
  const { results } = await env.DB.prepare(
    `SELECT l.*, p.name AS package_name, p.price, p.duration_days, a.name AS owner_name, a.username AS owner_username, a.phone AS owner_phone
     FROM licenses l JOIN packages p ON p.id = l.package_id JOIN accounts a ON a.id = l.owner_id
     ${status ? "WHERE l.status = ?1" : ""} ORDER BY l.requested_at DESC LIMIT 200`
  ).bind(...(status ? [status] : [])).all();
  return json({ licenses: results });
}

async function adminApprove(req, env, acc, id, approve) {
  const l = await env.DB.prepare(
    "SELECT l.*, p.duration_days FROM licenses l JOIN packages p ON p.id = l.package_id WHERE l.id = ?1").bind(id).first();
  if (!l) fail(404, "Lisensi tidak ditemukan");
  if (l.status !== "pending") fail(400, "Lisensi sudah diproses");
  const b = await body(req);
  if (!approve) {
    await env.DB.prepare("UPDATE licenses SET status='rejected', note=?1, approved_by=?2 WHERE id=?3")
      .bind(String(b.note || "").slice(0, 200), acc.id, id).run();
    return json({ ok: true });
  }
  const days = (b.days | 0) > 0 ? b.days | 0 : l.duration_days;
  const cur = await activeLicense(env, l.owner_id);
  const start = cur ? cur.expires_at : Date.now(); // perpanjangan ditambahkan setelah masa aktif sekarang
  await env.DB.prepare("UPDATE licenses SET status='active', starts_at=?1, expires_at=?2, approved_by=?3, note=?4 WHERE id=?5")
    .bind(start, start + days * DAY, acc.id, String(b.note || "").slice(0, 200), id).run();
  return json({ ok: true });
}

async function adminGrant(req, env, acc, ownerId) {
  const b = await body(req);
  const pkg = await env.DB.prepare("SELECT * FROM packages WHERE id = ?1").bind(b.package_id | 0).first();
  if (!pkg) fail(400, "Paket tidak ditemukan");
  const days = (b.days | 0) > 0 ? b.days | 0 : pkg.duration_days;
  const cur = await activeLicense(env, ownerId);
  const start = cur ? cur.expires_at : Date.now();
  await env.DB.prepare(
    "INSERT INTO licenses (owner_id, package_id, status, requested_at, starts_at, expires_at, approved_by, note) VALUES (?1, ?2, 'active', ?3, ?3, ?4, ?5, 'Diberikan Head Admin')"
  ).bind(ownerId, pkg.id, start, start + days * DAY, acc.id).run();
  return json({ ok: true });
}

async function adminPackages(req, env, id) {
  if (req.method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM packages ORDER BY price").all();
    return json({ packages: results });
  }
  const b = await body(req);
  const f = {
    name: String(b.name || "").trim().slice(0, 40), max_users: b.max_users | 0, storage_gb: b.storage_gb | 0,
    duration_days: b.duration_days | 0, price: b.price | 0, description: String(b.description || "").slice(0, 120),
    active: b.active === false || b.active === 0 ? 0 : 1,
  };
  if (!f.name || f.max_users < 1 || f.storage_gb < 1 || f.duration_days < 1) fail(400, "Data paket tidak lengkap");
  if (id) {
    await env.DB.prepare("UPDATE packages SET name=?1,max_users=?2,storage_gb=?3,duration_days=?4,price=?5,description=?6,active=?7 WHERE id=?8")
      .bind(f.name, f.max_users, f.storage_gb, f.duration_days, f.price, f.description, f.active, id).run();
  } else {
    await env.DB.prepare("INSERT INTO packages (name,max_users,storage_gb,duration_days,price,description,active) VALUES (?1,?2,?3,?4,?5,?6,?7)")
      .bind(f.name, f.max_users, f.storage_gb, f.duration_days, f.price, f.description, f.active).run();
  }
  return json({ ok: true });
}

// ---------- router ----------
async function route(req, env, url) {
  const p = url.pathname; const M = req.method;
  let m;
  if (p === "/api/health") return json({ ok: true, app: "JKam" });
  if (p === "/api/packages" && M === "GET") {
    const { results } = await env.DB.prepare("SELECT id,name,max_users,storage_gb,duration_days,price,description FROM packages WHERE active=1 ORDER BY price").all();
    return json({ packages: results });
  }
  if (p === "/api/auth/login" && M === "POST") return login(req, env);
  if (p === "/api/auth/register" && M === "POST") return registerOwner(req, env);

  const acc = await auth(req, env, url);
  if (p === "/api/me") return me(env, acc);
  if (p === "/api/auth/logout" && M === "POST") {
    const h = req.headers.get("Authorization") || "";
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha256(h.slice(7))).run();
    return json({ ok: true });
  }
  if (p === "/api/auth/password" && M === "POST") return changePassword(req, env, acc);

  // user
  if (p === "/api/upload" && M === "POST") return upload(req, env, acc);
  if (p === "/api/user/heartbeat" && M === "POST") return heartbeat(req, env, acc);
  if (p === "/api/user/command" && M === "GET") return getCommand(env, acc);
  if (p === "/api/user/command/ack" && M === "POST") return ackCommand(req, env, acc);
  if (p === "/api/user/fcm-token" && M === "POST") return saveFcmToken(req, env, acc);

  // rekaman
  if ((m = /^\/api\/rec\/([A-Za-z0-9\-]+)\/audio$/.exec(p)) && M === "GET") return streamAudio(req, env, acc, m[1]);
  if ((m = /^\/api\/rec\/([A-Za-z0-9\-]+)$/.exec(p)) && M === "DELETE") { need(acc, "owner", "headadmin"); return deleteRecording(env, acc, m[1]); }

  // owner
  if (p.startsWith("/api/owner/")) {
    need(acc, "owner");
    if (p === "/api/owner/summary") return ownerSummary(env, acc);
    if (p === "/api/owner/license" && M === "POST") return ownerRequestLicense(req, env, acc);
    if (p === "/api/owner/users" && M === "GET") return json({ users: await ownerUsers(env, acc.id) });
    if (p === "/api/owner/users" && M === "POST") return ownerCreateUser(req, env, acc);
    if ((m = /^\/api\/owner\/users\/(\d+)\/command$/.exec(p)) && M === "POST") return setCommand(req, env, acc, m[1] | 0);
    if ((m = /^\/api\/owner\/users\/(\d+)$/.exec(p))) {
      if (M === "PATCH") return updateUser(req, env, acc, m[1] | 0);
      if (M === "DELETE") return deleteUser(env, acc, m[1] | 0);
    }
    if (p === "/api/owner/recordings" && M === "GET") return listRecordings(env, url, { owner_id: acc.id });
    if (p === "/api/owner/recordings/delete" && M === "POST") return bulkDelete(req, env, acc);
  }

  // head admin
  if (p.startsWith("/api/admin/")) {
    need(acc, "headadmin");
    if (p === "/api/admin/summary") return adminSummary(env);
    if (p === "/api/admin/owners") return adminOwners(env);
    if ((m = /^\/api\/admin\/owners\/(\d+)$/.exec(p))) {
      if (M === "PATCH") return adminUpdateOwner(req, env, m[1] | 0);
      if (M === "DELETE") return adminDeleteOwner(env, m[1] | 0);
    }
    if ((m = /^\/api\/admin\/owners\/(\d+)\/users$/.exec(p))) return json({ users: await ownerUsers(env, m[1] | 0) });
    if ((m = /^\/api\/admin\/owners\/(\d+)\/grant$/.exec(p)) && M === "POST") return adminGrant(req, env, acc, m[1] | 0);
    if ((m = /^\/api\/admin\/users\/(\d+)\/command$/.exec(p)) && M === "POST") return setCommand(req, env, acc, m[1] | 0);
    if ((m = /^\/api\/admin\/users\/(\d+)$/.exec(p))) {
      if (M === "PATCH") return updateUser(req, env, acc, m[1] | 0);
      if (M === "DELETE") return deleteUser(env, acc, m[1] | 0);
    }
    if (p === "/api/admin/licenses") return adminLicenses(env, url);
    if ((m = /^\/api\/admin\/licenses\/(\d+)\/(approve|reject)$/.exec(p)) && M === "POST")
      return adminApprove(req, env, acc, m[1] | 0, m[2] === "approve");
    if (p === "/api/admin/packages") return adminPackages(req, env, null);
    if ((m = /^\/api\/admin\/packages\/(\d+)$/.exec(p)) && M === "PATCH") return adminPackages(req, env, m[1] | 0);
    if (p === "/api/admin/recordings" && M === "GET") return listRecordings(env, url, {});
    if (p === "/api/admin/recordings/delete" && M === "POST") return bulkDelete(req, env, acc);
  }
  fail(404, "Tidak ditemukan");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    // Unduhan APK (diunggah ke R2 oleh workflow build) — dipakai halaman promo HomeTech
    const dl = /^\/download\/(jkam-(?:user|owner|headadmin)\.apk)$/.exec(url.pathname);
    if (dl) {
      const obj = await env.AUDIO.get("apk/" + dl[1]);
      if (!obj) return new Response("APK belum tersedia", { status: 404 });
      return new Response(obj.body, { headers: {
        "Content-Type": "application/vnd.android.package-archive", "Content-Length": String(obj.size),
        "Content-Disposition": `attachment; filename="${dl[1]}"`, "Cache-Control": "no-cache" } });
    }
    if (url.pathname === "/api/public/apps") {
      const v = await env.AUDIO.get("apk/version.json");
      const info = v ? await v.json().catch(() => ({})) : {};
      const base = url.origin + "/download/";
      return json({ app: "JKam", version: info.version || null, built_at: info.built_at || null,
        downloads: { owner: base + "jkam-owner.apk", user: base + "jkam-user.apk" }, register: url.origin + "/?app=owner" });
    }
    if (url.pathname === "/logo.svg")
      return new Response(LOGO_SVG, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
    if (!url.pathname.startsWith("/api/"))
      return new Response(PANEL_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    try {
      await bootstrap(env);
      return await route(req, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      return json({ error: "Server error: " + (e && e.message || e) }, 500);
    }
  },
};
