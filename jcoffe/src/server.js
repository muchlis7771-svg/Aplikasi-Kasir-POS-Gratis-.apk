/**
 * J-DATA POS — Cloudflare Worker (single file)
 * Multi-toko, trial 14 hari, dashboard Head Admin, kasir, stok & resep,
 * laporan, bot Telegram, PWA (siap dijadikan APK lewat PWABuilder).
 *
 * Binding wajib : D1 database -> nama variabel  DB  (jdata_db)
 * Secret opsional: TELEGRAM_BOT_TOKEN, HEADADMIN_PASSWORD, RESET_KEY
 * Variabel opsional: TELEGRAM_BOT_USERNAME (default warkop_rafli_bot)
 * Cron opsional  : "0 13 * * *"  (= 21:00 WITA) untuk laporan harian
 */

const TRIAL_DAYS = 14;
const TZ_OFFSET_MS = 8 * 3600 * 1000; // WITA
const DEFAULT_ADMIN_USER = 'headadmin';
const DEFAULT_ADMIN_PASS = null; // isi lewat secret HEADADMIN_PASSWORD; kalau kosong dibuat acak (lihat /reset-headadmin)
const SESSION_DAYS = 30;
const DAY = 86400000;

// ---------------------------------------------------------------- schema
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS jd_stores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner_name TEXT, phone TEXT, address TEXT, status TEXT NOT NULL DEFAULT 'active', trial_end TEXT, paid_until TEXT, tg_chat_id TEXT, tg_link_code TEXT, receipt_note TEXT, created_at TEXT, is_demo INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS jd_users (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT, pass_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT, last_login TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS jd_menu (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT, price INTEGER NOT NULL DEFAULT 0, hpp INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, name TEXT NOT NULL, unit TEXT, qty REAL NOT NULL DEFAULT 0, min_qty REAL NOT NULL DEFAULT 0, cost_per_unit REAL NOT NULL DEFAULT 0, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_recipes (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, menu_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, qty REAL NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS jd_promos (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'percent', value REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS jd_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, user_id INTEGER, cashier TEXT, code TEXT, subtotal INTEGER NOT NULL DEFAULT 0, discount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, hpp_total INTEGER NOT NULL DEFAULT 0, pay_method TEXT, paid INTEGER NOT NULL DEFAULT 0, change_amt INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT, local_date TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_transaction_items (id INTEGER PRIMARY KEY AUTOINCREMENT, trx_id INTEGER NOT NULL, store_id INTEGER NOT NULL, menu_id INTEGER, name TEXT, qty INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL DEFAULT 0, hpp INTEGER NOT NULL DEFAULT 0, subtotal INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS jd_settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_role_perms (store_id INTEGER NOT NULL, role TEXT NOT NULL, perms TEXT NOT NULL, PRIMARY KEY (store_id, role))`,
  `CREATE TABLE IF NOT EXISTS jd_tables (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, name TEXT NOT NULL, token TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, table_id INTEGER, table_name TEXT, customer TEXT, note TEXT, items TEXT, total INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'baru', trx_id INTEGER, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_support (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER, user_id INTEGER, store_name TEXT, user_name TEXT, category TEXT, message TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_licenses (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, days INTEGER NOT NULL DEFAULT 90, batch TEXT, status TEXT NOT NULL DEFAULT 'baru', buyer_name TEXT, buyer_email TEXT, buyer_phone TEXT, order_ref TEXT, sold_at TEXT, store_id INTEGER, store_name TEXT, used_by TEXT, used_at TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_lynk_orders (ref TEXT PRIMARY KEY, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS jd_lynk_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, event TEXT, result TEXT, payload TEXT, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS ix_orders_store ON jd_orders(store_id, status)`,
  `CREATE INDEX IF NOT EXISTS ix_lic_status ON jd_licenses(status, days)`,
  `CREATE INDEX IF NOT EXISTS ix_lic_email ON jd_licenses(buyer_email)`,
  `CREATE INDEX IF NOT EXISTS ix_lic_store ON jd_licenses(store_id)`,
  `CREATE INDEX IF NOT EXISTS ix_tables_store ON jd_tables(store_id)`,
  `CREATE INDEX IF NOT EXISTS ix_trx_store_date ON jd_transactions(store_id, local_date)`,
  `CREATE INDEX IF NOT EXISTS ix_items_trx ON jd_transaction_items(trx_id)`,
  `CREATE INDEX IF NOT EXISTS ix_items_store ON jd_transaction_items(store_id)`,
  `CREATE INDEX IF NOT EXISTS ix_menu_store ON jd_menu(store_id)`,
  `CREATE INDEX IF NOT EXISTS ix_stock_store ON jd_stock(store_id)`,
  `CREATE INDEX IF NOT EXISTS ix_recipes_menu ON jd_recipes(menu_id)`,
  `CREATE INDEX IF NOT EXISTS ix_users_store ON jd_users(store_id)`,
  `CREATE INDEX IF NOT EXISTS ix_sessions_user ON jd_sessions(user_id)`,
];

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.filter((s) => s.startsWith('CREATE TABLE')).map((s) => env.DB.prepare(s)));
  const cols = (await env.DB.prepare(`PRAGMA table_info(jd_stores)`).all()).results.map((c) => c.name);
  if (!cols.includes('is_demo')) await env.DB.prepare(`ALTER TABLE jd_stores ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`).run();
  if (!cols.includes('qr_key')) await env.DB.prepare(`ALTER TABLE jd_stores ADD COLUMN qr_key TEXT`).run();
  await env.DB.batch(SCHEMA.filter((s) => s.startsWith('CREATE INDEX')).map((s) => env.DB.prepare(s)));
  const admin = await env.DB.prepare(`SELECT id FROM jd_users WHERE role='headadmin' LIMIT 1`).first();
  if (!admin) {
    const pw = env.HEADADMIN_PASSWORD || DEFAULT_ADMIN_PASS || 'Jd-' + randCode(12);
    await env.DB.prepare(
      `INSERT INTO jd_users (store_id, username, name, pass_hash, role, active, must_change, created_at) VALUES (NULL, ?, 'Head Admin', ?, 'headadmin', 1, 1, ?)`
    ).bind(DEFAULT_ADMIN_USER, await hashPw(pw), nowIso()).run();
  }
  schemaReady = true;
}

// ---------------------------------------------------------------- utils
const nowIso = () => new Date().toISOString();
const localDate = (d = new Date()) => new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString();
const int = (v, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function html(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function redirect(to, headers = {}) { return new Response(null, { status: 302, headers: { location: to, ...headers } }); }
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

function b64e(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64d(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
function randToken(n = 32) { return b64e(crypto.getRandomValues(new Uint8Array(n))).replace(/[+/=]/g, '').slice(0, n); }
function randCode(n = 6) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint8Array(n)); return Array.from(r, (x) => a[x % a.length]).join(''); }
async function sha256hex(s) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join(''); }

async function hashPw(pw, saltB64) {
  const salt = saltB64 ? b64d(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return `pbkdf2$100000$${b64e(salt)}$${b64e(new Uint8Array(bits))}`;
}
async function verifyPw(pw, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const calc = await hashPw(pw, stored.split('$')[2]);
  if (calc.length !== stored.length) return false;
  let diff = 0; for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}
function getCookie(req, name) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function sessionCookie(token, maxAge) {
  return `jd_sess=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
async function body(req) { try { return await req.json(); } catch { return {}; } }

// ---------------------------------------------------------------- access / trial
function storeAccess(store) {
  if (!store) return { ok: true, label: 'admin' };
  if (store.is_demo) { const end = Date.parse(store.trial_end); return { ok: Date.now() < end, label: Date.now() < end ? 'demo' : 'expired', end, daysLeft: 1, demo: true }; }
  const ends = [store.trial_end, store.paid_until].filter(Boolean).map((d) => Date.parse(d));
  const end = ends.length ? Math.max(...ends) : 0;
  const daysLeft = Math.ceil((end - Date.now()) / DAY);
  const paid = store.paid_until && Date.parse(store.paid_until) > Date.now();
  if (store.status === 'blocked') return { ok: false, label: 'diblokir', end, daysLeft };
  if (Date.now() > end) return { ok: false, label: 'expired', end, daysLeft };
  return { ok: true, label: paid ? 'aktif' : 'trial', end, daysLeft };
}

async function getAuth(req, env) {
  const token = getCookie(req, 'jd_sess');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.name, u.role, u.store_id, u.active, u.must_change, s.expires_at
     FROM jd_sessions s JOIN jd_users u ON u.id = s.user_id WHERE s.token = ?`
  ).bind(token).first();
  if (!row || !row.active || Date.parse(row.expires_at) < Date.now()) return null;
  const store = row.store_id ? await env.DB.prepare(`SELECT * FROM jd_stores WHERE id = ?`).bind(row.store_id).first() : null;
  const perms = store ? await permsFor(env, store, row.role) : [];
  return { user: row, store, token, access: storeAccess(store), perms };
}
const STORE_ROLES = ['owner', 'om', 'admin', 'spv', 'kasir'];
const LIMITED_PERMS = ['kasir', 'pesanan'];
function requireStore(auth) {
  if (!auth) fail(401, 'Silakan login');
  if (!STORE_ROLES.includes(auth.user.role) || !auth.store) fail(403, 'Akses ditolak');
  if (!auth.access.ok) {
    // trial/langganan habis: tetap bisa transaksi saja, fitur lain dikunci
    if (auth.access.label === 'expired' && !auth.store.is_demo) { auth.limited = true; auth.perms = auth.perms.filter((p) => LIMITED_PERMS.includes(p)); }
    else fail(402, auth.access.label === 'diblokir' ? 'Toko diblokir' : 'Masa demo habis');
  }
  return auth;
}
function requireAdmin(auth) {
  if (!auth) fail(401, 'Silakan login');
  if (auth.user.role !== 'headadmin') fail(403, 'Khusus Head Admin');
  return auth;
}
async function getSetting(env, key, def = null) { const r = await env.DB.prepare(`SELECT value FROM jd_settings WHERE key = ?`).bind(key).first(); return r ? r.value : def; }
async function setSetting(env, key, value) { await env.DB.prepare(`INSERT INTO jd_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, value == null ? null : String(value)).run(); }

// ---------------------------------------------------------------- telegram
// Token bot: dari secret TELEGRAM_BOT_TOKEN, atau disimpan Head Admin lewat dashboard (tabel jd_settings)
let tokenCache = { v: null, t: 0 };
async function botToken(env) {
  if (env.TELEGRAM_BOT_TOKEN) return env.TELEGRAM_BOT_TOKEN;
  if (Date.now() - tokenCache.t < 60000) return tokenCache.v;
  tokenCache = { v: await getSetting(env, 'tg_token'), t: Date.now() };
  return tokenCache.v;
}
let TG_BASE = 'https://api.telegram.org';
async function tgRaw(token, method, payload) {
  try {
    const isForm = payload instanceof FormData;
    const r = await fetch(`${TG_BASE}/bot${token}/${method}`, isForm ? { method: 'POST', body: payload } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return await r.json();
  } catch (e) { return { ok: false, description: e.message }; }
}
async function tg(env, method, payload) {
  const token = await botToken(env);
  if (!token) return { ok: false, description: 'Token bot belum diisi' };
  return tgRaw(token, method, payload);
}
function sendTG(env, chatId, text) { if (!chatId) return Promise.resolve(null); return tg(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }); }
async function notifyAdmin(env, text) { const chat = await getSetting(env, 'admin_chat_id'); if (chat) await sendTG(env, chat, text); }
async function webhookSecret(env, token) { return (await sha256hex('jdata:' + (token || (await botToken(env)) || ''))).slice(0, 40); }
async function botUsername(env) { return env.TELEGRAM_BOT_USERNAME || (await getSetting(env, 'bot_username')) || 'warkop_rafli_bot'; }
async function setupWebhook(env, origin, token) {
  const r = await tgRaw(token, 'setWebhook', { url: origin + '/telegram/webhook', secret_token: await webhookSecret(env, token), allowed_updates: ['message'], drop_pending_updates: true });
  if (!r.ok) fail(400, 'Telegram: ' + (r.description || 'gagal pasang webhook'));
  await tgRaw(token, 'setMyCommands', { commands: [
    { command: 'omzet', description: 'Omzet hari ini (/omzet bulan)' }, { command: 'laris', description: 'Menu terlaris bulan ini' },
    { command: 'stok', description: 'Stok menipis' }, { command: 'transaksi', description: '5 transaksi terakhir' },
    { command: 'toko', description: 'Admin: daftar toko' }, { command: 'statistik', description: 'Admin: statistik' }, { command: 'bantuan', description: 'Bantuan' },
  ] });
  await setSetting(env, 'tg_webhook', origin + '/telegram/webhook');
}

async function storeSummary(env, storeId, from, to) {
  const s = await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) omzet, COALESCE(SUM(hpp_total),0) hpp, COALESCE(SUM(discount),0) disc FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ?`).bind(storeId, from, to).first();
  const top = await env.DB.prepare(`SELECT i.name, SUM(i.qty) qty, SUM(i.subtotal) total FROM jd_transaction_items i JOIN jd_transactions t ON t.id = i.trx_id WHERE t.store_id = ? AND t.local_date BETWEEN ? AND ? GROUP BY i.name ORDER BY qty DESC LIMIT 5`).bind(storeId, from, to).all();
  return { ...s, top: top.results };
}
function fmtSummary(title, s) {
  let t = `<b>${escHtml(title)}</b>\n🧾 Transaksi: <b>${s.n}</b>\n💰 Omzet: <b>${rp(s.omzet)}</b>\n📦 HPP: ${rp(s.hpp)}\n📈 Laba kotor: <b>${rp(s.omzet - s.hpp)}</b>`;
  if (s.top?.length) t += `\n\n🔥 <b>Terlaris</b>\n` + s.top.map((r, i) => `${i + 1}. ${escHtml(r.name)} — ${r.qty}x`).join('\n');
  return t;
}
async function lowStockText(env, storeId) {
  const r = await env.DB.prepare(`SELECT name, qty, min_qty, unit FROM jd_stock WHERE store_id = ? AND qty <= min_qty ORDER BY name`).bind(storeId).all();
  if (!r.results.length) return '✅ Semua stok aman.';
  return '⚠️ <b>Stok menipis</b>\n' + r.results.map((s) => `• ${escHtml(s.name)}: <b>${+s.qty.toFixed(2)}</b> ${escHtml(s.unit || '')} (min ${s.min_qty})`).join('\n');
}

async function handleTelegram(req, env) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret(env))) return new Response('forbidden', { status: 403 });
  await ensureSchema(env);
  const upd = await body(req);
  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.text) return new Response('ok');
  const chatId = String(msg.chat.id);
  const [cmdRaw, ...args] = msg.text.trim().split(/\s+/);
  const cmd = cmdRaw.split('@')[0].toLowerCase();
  const reply = (t) => sendTG(env, chatId, t);
  const adminChat = await getSetting(env, 'admin_chat_id');
  const isAdmin = adminChat === chatId;
  const store = await env.DB.prepare(`SELECT * FROM jd_stores WHERE tg_chat_id = ? LIMIT 1`).bind(chatId).first();
  const today = localDate();
  const monthStart = today.slice(0, 8) + '01';

  if (cmd === '/start' && args[0]) {
    const code = args[0].toUpperCase();
    const adminCode = await getSetting(env, 'admin_link_code');
    if (adminCode && code === adminCode) {
      await setSetting(env, 'admin_chat_id', chatId);
      await reply('✅ Chat ini sekarang terhubung sebagai <b>Head Admin J-DATA</b>.\nKetik /bantuan untuk daftar perintah.');
      return new Response('ok');
    }
    const s = await env.DB.prepare(`SELECT * FROM jd_stores WHERE tg_link_code = ?`).bind(code).first();
    if (!s) { await reply('❌ Kode tidak dikenal. Ambil kode baru di menu Pengaturan aplikasi.'); return new Response('ok'); }
    await env.DB.prepare(`UPDATE jd_stores SET tg_chat_id = ?, tg_link_code = NULL WHERE id = ?`).bind(chatId, s.id).run();
    await reply(`✅ Terhubung ke toko <b>${escHtml(s.name)}</b>.\nNotifikasi transaksi & laporan harian akan dikirim ke sini.\nKetik /bantuan untuk daftar perintah.`);
    return new Response('ok');
  }
  if (cmd === '/start' || cmd === '/bantuan' || cmd === '/help') {
    let t = '🤖 <b>Bot J-DATA POS</b>\n\n';
    if (store) t += `Toko: <b>${escHtml(store.name)}</b>\n/omzet — omzet hari ini\n/omzet bulan — omzet bulan ini\n/laris — menu terlaris bulan ini\n/stok — stok menipis\n/transaksi — 5 transaksi terakhir\n`;
    if (isAdmin) t += `\n<b>Head Admin</b>\n/toko — daftar toko & status\n/statistik — statistik platform\n`;
    if (!store && !isAdmin) t += 'Chat ini belum terhubung. Buka aplikasi → Pengaturan → Hubungkan Telegram.';
    await reply(t); return new Response('ok');
  }
  if (store && cmd === '/omzet') {
    const month = (args[0] || '').toLowerCase().startsWith('bulan');
    const s = await storeSummary(env, store.id, month ? monthStart : today, today);
    await reply(fmtSummary(`${store.name} — ${month ? 'Bulan ini' : 'Hari ini (' + today + ')'}`, s)); return new Response('ok');
  }
  if (store && cmd === '/laris') {
    const s = await storeSummary(env, store.id, monthStart, today);
    await reply(s.top.length ? '🔥 <b>Terlaris bulan ini</b>\n' + s.top.map((r, i) => `${i + 1}. ${escHtml(r.name)} — ${r.qty}x (${rp(r.total)})`).join('\n') : 'Belum ada penjualan bulan ini.');
    return new Response('ok');
  }
  if (store && cmd === '/stok') { await reply(await lowStockText(env, store.id)); return new Response('ok'); }
  if (store && cmd === '/transaksi') {
    const r = await env.DB.prepare(`SELECT code, total, pay_method, cashier, created_at FROM jd_transactions WHERE store_id = ? ORDER BY id DESC LIMIT 5`).bind(store.id).all();
    await reply(r.results.length ? '🧾 <b>5 transaksi terakhir</b>\n' + r.results.map((x) => `• ${x.code} — <b>${rp(x.total)}</b> (${escHtml(x.pay_method)}, ${escHtml(x.cashier || '-')})`).join('\n') : 'Belum ada transaksi.');
    return new Response('ok');
  }
  if (isAdmin && cmd === '/toko') {
    const r = await env.DB.prepare(`SELECT * FROM jd_stores WHERE is_demo = 0 ORDER BY id DESC LIMIT 30`).all();
    await reply(r.results.length ? '🏪 <b>Daftar toko</b>\n' + r.results.map((s) => { const a = storeAccess(s); return `• <b>${escHtml(s.name)}</b> — ${a.label}${a.ok ? ` (${a.daysLeft} hari)` : ''}`; }).join('\n') : 'Belum ada toko.');
    return new Response('ok');
  }
  if (isAdmin && cmd === '/statistik') {
    const st = await adminStats(env);
    await reply(`📊 <b>Statistik J-DATA</b>\n🏪 Toko: ${st.stores} (trial ${st.trial}, aktif ${st.active}, expired ${st.expired}, blokir ${st.blocked})\n👥 User: ${st.users}\n🆕 Toko baru 7 hari: ${st.new7}\n🧾 Transaksi hari ini: ${st.trxToday}\n💰 Omzet semua toko hari ini: ${rp(st.omzetToday)}`);
    return new Response('ok');
  }
  await reply('Perintah tidak dikenal. Ketik /bantuan');
  return new Response('ok');
}

// ---------------------------------------------------------------- cron: laporan harian
let dailyChecked = 0;
async function maybeDaily(env) {
  if (Date.now() - dailyChecked < 300000) return;
  dailyChecked = Date.now();
  const hourWita = new Date(Date.now() + TZ_OFFSET_MS).getUTCHours();
  if (hourWita < 21) return;
  if ((await getSetting(env, 'last_daily')) === localDate()) return;
  await runDaily(env);
}
async function runDaily(env) {
  await ensureSchema(env);
  const today = localDate();
  await setSetting(env, 'last_daily', today);
  const stores = (await env.DB.prepare(`SELECT * FROM jd_stores WHERE is_demo = 0`).all()).results;
  const expiring = [];
  for (const s of stores) {
    const a = storeAccess(s);
    if (a.ok && s.tg_chat_id) {
      const sum = await storeSummary(env, s.id, today, today);
      await sendTG(env, s.tg_chat_id, fmtSummary(`📅 Laporan harian ${s.name} — ${today}`, sum) + '\n\n' + (await lowStockText(env, s.id)));
    }
    if (a.ok && a.daysLeft <= 3) {
      expiring.push(`• ${escHtml(s.name)} — ${a.label}, sisa ${a.daysLeft} hari (${escHtml(s.phone || '-')})`);
      if (s.tg_chat_id) await sendTG(env, s.tg_chat_id, `⏳ Masa ${a.label} toko <b>${escHtml(s.name)}</b> tersisa <b>${a.daysLeft} hari</b>. Hubungi admin untuk perpanjang.`);
    }
  }
  const st = await adminStats(env);
  await notifyAdmin(env, `📊 <b>Ringkasan J-DATA ${today}</b>\n🏪 Toko: ${st.stores} (trial ${st.trial}, aktif ${st.active}, expired ${st.expired})\n🧾 Transaksi hari ini: ${st.trxToday}\n💰 Omzet: ${rp(st.omzetToday)}` + (expiring.length ? `\n\n⏳ <b>Akan habis ≤3 hari</b>\n${expiring.join('\n')}` : ''));
}

// ---------------------------------------------------------------- admin
async function adminStats(env) {
  const stores = (await env.DB.prepare(`SELECT * FROM jd_stores WHERE is_demo = 0`).all()).results;
  const c = { trial: 0, aktif: 0, expired: 0, diblokir: 0 };
  for (const s of stores) c[storeAccess(s).label]++;
  const users = await env.DB.prepare(`SELECT COUNT(*) n FROM jd_users WHERE role != 'headadmin' AND (store_id IS NULL OR store_id NOT IN (SELECT id FROM jd_stores WHERE is_demo = 1))`).first();
  const t = await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) omzet FROM jd_transactions WHERE local_date = ? AND store_id NOT IN (SELECT id FROM jd_stores WHERE is_demo = 1)`).bind(localDate()).first();
  const new7 = stores.filter((s) => Date.parse(s.created_at) > Date.now() - 7 * DAY).length;
  return { stores: stores.length, trial: c.trial, active: c.aktif, expired: c.expired, blocked: c.diblokir, users: users.n, trxToday: t.n, omzetToday: t.omzet, new7 };
}

async function adminApi(req, env, auth, path, method) {
  requireAdmin(auth);
  if (path === '/api/admin/stats' && method === 'GET') {
    const st = await adminStats(env);
    const daily = await env.DB.prepare(`SELECT local_date d, COUNT(*) n, SUM(total) omzet FROM jd_transactions WHERE local_date >= ? AND store_id NOT IN (SELECT id FROM jd_stores WHERE is_demo = 1) GROUP BY local_date ORDER BY local_date`).bind(localDate(new Date(Date.now() - 13 * DAY))).all();
    return json({ ...st, daily: daily.results });
  }
  if (path === '/api/admin/stores' && method === 'GET') {
    const since = localDate(new Date(Date.now() - 29 * DAY));
    const r = await env.DB.prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM jd_users u WHERE u.store_id = s.id) users,
        (SELECT username FROM jd_users u WHERE u.store_id = s.id AND u.role='owner' ORDER BY u.id LIMIT 1) owner_username,
        (SELECT COUNT(*) FROM jd_transactions t WHERE t.store_id = s.id) trx_all,
        (SELECT COALESCE(SUM(total),0) FROM jd_transactions t WHERE t.store_id = s.id AND t.local_date >= ?) omzet30,
        (SELECT MAX(created_at) FROM jd_transactions t WHERE t.store_id = s.id) last_trx,
        (SELECT MAX(last_login) FROM jd_users u WHERE u.store_id = s.id) last_login
       FROM jd_stores s WHERE s.is_demo = 0 ORDER BY s.id DESC`
    ).bind(since).all();
    return json({ stores: r.results.map((s) => { const a = storeAccess(s); return { ...s, tg_link_code: undefined, status_label: a.label, days_left: a.daysLeft, end: a.end ? new Date(a.end).toISOString() : null }; }) });
  }
  let m = path.match(/^\/api\/admin\/stores\/(\d+)$/);
  if (m && method === 'PUT') {
    const id = int(m[1]); const b = await body(req);
    const s = await env.DB.prepare(`SELECT * FROM jd_stores WHERE id = ?`).bind(id).first();
    if (!s) fail(404, 'Toko tidak ditemukan');
    const base = (d) => new Date(Math.max(Date.now(), d ? Date.parse(d) : 0)).toISOString();
    let note = '';
    if (b.action === 'extend_trial') { await env.DB.prepare(`UPDATE jd_stores SET trial_end = ? WHERE id = ?`).bind(addDays(base(s.trial_end), int(b.days, 14)), id).run(); note = `Trial diperpanjang ${int(b.days, 14)} hari`; }
    else if (b.action === 'extend_paid') { await env.DB.prepare(`UPDATE jd_stores SET paid_until = ?, status='active' WHERE id = ?`).bind(addDays(base(s.paid_until), int(b.days, 30)), id).run(); note = `Langganan aktif +${int(b.days, 30)} hari`; }
    else if (b.action === 'block') { await env.DB.prepare(`UPDATE jd_stores SET status='blocked' WHERE id = ?`).bind(id).run(); note = 'Toko diblokir'; }
    else if (b.action === 'unblock') { await env.DB.prepare(`UPDATE jd_stores SET status='active' WHERE id = ?`).bind(id).run(); note = 'Blokir dibuka'; }
    else if (b.action === 'end_now') { await env.DB.prepare(`UPDATE jd_stores SET trial_end = ?, paid_until = NULL WHERE id = ?`).bind(nowIso(), id).run(); note = 'Masa aktif dihentikan'; }
    else fail(400, 'Aksi tidak dikenal');
    if (s.tg_chat_id && b.action !== 'block') await sendTG(env, s.tg_chat_id, `ℹ️ Info dari admin J-DATA: ${note}.`);
    return json({ ok: true, note });
  }
  if (m && method === 'DELETE') {
    const id = int(m[1]); const b = await body(req);
    const s = await env.DB.prepare(`SELECT name FROM jd_stores WHERE id = ?`).bind(id).first();
    if (!s) fail(404, 'Toko tidak ditemukan');
    if (str(b.confirm) !== s.name) fail(400, 'Nama toko konfirmasi tidak cocok');
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM jd_sessions WHERE user_id IN (SELECT id FROM jd_users WHERE store_id = ?)`).bind(id),
      ...['jd_users', 'jd_menu', 'jd_stock', 'jd_recipes', 'jd_promos', 'jd_transaction_items', 'jd_transactions', 'jd_tables', 'jd_orders', 'jd_role_perms'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE store_id = ?`).bind(id)),
      env.DB.prepare(`DELETE FROM jd_stores WHERE id = ?`).bind(id),
    ]);
    return json({ ok: true });
  }
  m = path.match(/^\/api\/admin\/stores\/(\d+)\/reset-owner$/);
  if (m && method === 'POST') {
    const owner = await env.DB.prepare(`SELECT id, username FROM jd_users WHERE store_id = ? AND role='owner' ORDER BY id LIMIT 1`).bind(int(m[1])).first();
    if (!owner) fail(404, 'Owner tidak ditemukan');
    const pw = 'jd' + randCode(6).toLowerCase();
    await env.DB.batch([
      env.DB.prepare(`UPDATE jd_users SET pass_hash = ?, must_change = 1, active = 1 WHERE id = ?`).bind(await hashPw(pw), owner.id),
      env.DB.prepare(`DELETE FROM jd_sessions WHERE user_id = ?`).bind(owner.id),
    ]);
    return json({ ok: true, username: owner.username, password: pw });
  }
  if (path === '/api/admin/settings' && method === 'GET') {
    let code = await getSetting(env, 'admin_link_code');
    if (!code) { code = 'ADM-' + randCode(8); await setSetting(env, 'admin_link_code', code); }
    return json({
      admin_wa: (await getSetting(env, 'admin_wa', '')) || DEFAULT_ADMIN_WA, apk: await apkInfo(env), price_text: await getSetting(env, 'price_text', ''),
      tg_token_set: !!(await botToken(env)), tg_token_from_secret: !!env.TELEGRAM_BOT_TOKEN, tg_admin_linked: !!(await getSetting(env, 'admin_chat_id')),
      tg_webhook: await getSetting(env, 'tg_webhook', ''), admin_link_code: code, bot_username: await botUsername(env),
      last_daily: await getSetting(env, 'last_daily', ''),
      cron_hint: 'Laporan harian otomatis terkirim mulai jam 21:00 WITA. (Opsional: Cron Trigger "0 13 * * *" agar selalu tepat waktu.)',
    });
  }
  if (path === '/api/admin/settings' && method === 'PUT') {
    const b = await body(req);
    if ('admin_wa' in b) await setSetting(env, 'admin_wa', str(b.admin_wa, 30).replace(/[^0-9]/g, ''));
    if ('price_text' in b) await setSetting(env, 'price_text', str(b.price_text, 300));
    if ('apk_version' in b) await setSetting(env, 'apk_version', String(int(b.apk_version) || ''));
    if ('apk_url' in b) await setSetting(env, 'apk_url', str(b.apk_url, 300));
    if ('apk_notes' in b) await setSetting(env, 'apk_notes', str(b.apk_notes, 300));
    return json({ ok: true });
  }
  if (path === '/api/admin/telegram/token' && method === 'POST') {
    const b = await body(req); const token = str(b.token, 100);
    if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token)) fail(400, 'Format token tidak valid. Contoh: 123456789:AAH...');
    const meR = await tgRaw(token, 'getMe', {});
    if (!meR.ok) fail(400, 'Token ditolak Telegram: ' + (meR.description || 'tidak valid'));
    await setupWebhook(env, new URL(req.url).origin, token);
    await setSetting(env, 'tg_token', token); await setSetting(env, 'bot_username', meR.result.username);
    tokenCache = { v: token, t: Date.now() };
    return json({ ok: true, bot_username: meR.result.username });
  }
  if (path === '/api/admin/telegram/setup' && method === 'POST') {
    const token = await botToken(env);
    if (!token) fail(400, 'Isi token bot dulu');
    await setupWebhook(env, new URL(req.url).origin, token);
    return json({ ok: true });
  }
  if (path === '/api/admin/telegram/test' && method === 'POST') {
    const chat = await getSetting(env, 'admin_chat_id');
    if (!chat) fail(400, 'Chat admin belum terhubung');
    const r = await sendTG(env, chat, '✅ Tes notifikasi J-DATA berhasil.');
    if (!r?.ok) fail(400, 'Gagal kirim: ' + (r?.description || ''));
    return json({ ok: true });
  }
  if (path === '/api/admin/run-daily' && method === 'POST') { await runDaily(env); return json({ ok: true }); }
  const ext = (await licenseAdmin(req, env, path, method)) || (await adminExtra(req, env, path, method));
  if (ext) return ext;
  fail(404, 'Endpoint tidak ditemukan');
}

// ---------------------------------------------------------------- store API
async function storeApi(req, env, ctx, auth, path, method) {
  const isOwner = auth.user.role === 'owner';
  const has = (...p) => p.some((x) => auth.perms.includes(x));
  const need = (...p) => { if (!has(...p)) fail(auth.limited ? 423 : 403, auth.limited ? 'Fitur terkunci — masa trial habis. Perpanjang untuk membuka semua fitur.' : 'Kamu tidak punya akses ke fitur ini'); };
  const featured = await featureApi(req, env, ctx, auth, path, method, need, has);
  if (featured) return featured;
  const sid = auth.store.id;
  const DB = env.DB;
  let m;

  // ---- menu
  if (path === '/api/menu' && method === 'GET') {
    need('kasir', 'menu', 'pesanan', 'laporan');
    const menu = (await DB.prepare(`SELECT * FROM jd_menu WHERE store_id = ? ORDER BY category, name`).bind(sid).all()).results;
    const rec = (await DB.prepare(`SELECT r.menu_id, r.stock_id, r.qty, s.cost_per_unit, s.name stock_name, s.unit FROM jd_recipes r JOIN jd_stock s ON s.id = r.stock_id WHERE r.store_id = ?`).bind(sid).all()).results;
    for (const mm of menu) { mm.recipe = rec.filter((r) => r.menu_id === mm.id); mm.recipe_cost = Math.round(mm.recipe.reduce((a, r) => a + r.qty * r.cost_per_unit, 0)); }
    return json({ menu });
  }
  if (path === '/api/menu' && method === 'POST') {
    need('menu'); const b = await body(req);
    if (!str(b.name)) fail(400, 'Nama menu wajib diisi');
    await validRecipe(DB, sid, b.recipe);
    const r = await DB.prepare(`INSERT INTO jd_menu (store_id, name, category, price, hpp, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`).bind(sid, str(b.name, 80), str(b.category, 40) || 'Lainnya', Math.max(0, int(b.price)), Math.max(0, int(b.hpp)), b.active === false ? 0 : 1, nowIso()).first();
    if (Array.isArray(b.recipe)) await saveRecipe(DB, sid, r.id, b.recipe);
    return json({ ok: true, id: r.id });
  }
  if ((m = path.match(/^\/api\/menu\/(\d+)$/))) {
    need('menu'); const id = int(m[1]);
    if (method === 'PUT') {
      const b = await body(req);
      if (!str(b.name)) fail(400, 'Nama menu wajib diisi');
      await validRecipe(DB, sid, b.recipe);
      await DB.prepare(`UPDATE jd_menu SET name = ?, category = ?, price = ?, hpp = ?, active = ? WHERE id = ? AND store_id = ?`).bind(str(b.name, 80), str(b.category, 40) || 'Lainnya', Math.max(0, int(b.price)), Math.max(0, int(b.hpp)), b.active === false ? 0 : 1, id, sid).run();
      if (Array.isArray(b.recipe)) await saveRecipe(DB, sid, id, b.recipe);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await DB.batch([DB.prepare(`DELETE FROM jd_recipes WHERE menu_id = ? AND store_id = ?`).bind(id, sid), DB.prepare(`DELETE FROM jd_menu WHERE id = ? AND store_id = ?`).bind(id, sid)]);
      return json({ ok: true });
    }
  }
  // ---- stock
  if (path === '/api/stock' && method === 'GET') need('stok', 'stok_adjust', 'menu');
  if (path === '/api/stock' && method === 'GET') return json({ stock: (await DB.prepare(`SELECT * FROM jd_stock WHERE store_id = ? ORDER BY name`).bind(sid).all()).results });
  if (path === '/api/stock' && method === 'POST') {
    need('stok'); const b = await body(req);
    if (!str(b.name)) fail(400, 'Nama bahan wajib diisi');
    await DB.prepare(`INSERT INTO jd_stock (store_id, name, unit, qty, min_qty, cost_per_unit, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(sid, str(b.name, 80), str(b.unit, 20), num(b.qty), num(b.min_qty), Math.max(0, num(b.cost_per_unit)), nowIso()).run();
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/stock\/(\d+)$/))) {
    need('stok'); const id = int(m[1]);
    if (method === 'PUT') {
      const b = await body(req);
      await DB.prepare(`UPDATE jd_stock SET name = ?, unit = ?, qty = ?, min_qty = ?, cost_per_unit = ?, updated_at = ? WHERE id = ? AND store_id = ?`).bind(str(b.name, 80), str(b.unit, 20), num(b.qty), num(b.min_qty), Math.max(0, num(b.cost_per_unit)), nowIso(), id, sid).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await DB.batch([DB.prepare(`DELETE FROM jd_recipes WHERE stock_id = ? AND store_id = ?`).bind(id, sid), DB.prepare(`DELETE FROM jd_stock WHERE id = ? AND store_id = ?`).bind(id, sid)]);
      return json({ ok: true });
    }
  }
  if ((m = path.match(/^\/api\/stock\/(\d+)\/adjust$/)) && method === 'POST') {
    need('stok','stok_adjust'); const b = await body(req);
    await DB.prepare(`UPDATE jd_stock SET qty = qty + ?, updated_at = ? WHERE id = ? AND store_id = ?`).bind(num(b.delta), nowIso(), int(m[1]), sid).run();
    return json({ ok: true });
  }
  // ---- promos
  if (path === '/api/promos' && method === 'GET') return json({ promos: (await DB.prepare(`SELECT * FROM jd_promos WHERE store_id = ? ORDER BY active DESC, name`).bind(sid).all()).results });
  if (path === '/api/promos' && method === 'POST') {
    need('promo'); const b = await body(req);
    if (!str(b.name)) fail(400, 'Nama promo wajib diisi');
    await DB.prepare(`INSERT INTO jd_promos (store_id, name, type, value, active) VALUES (?, ?, ?, ?, ?)`).bind(sid, str(b.name, 60), b.type === 'nominal' ? 'nominal' : 'percent', Math.max(0, num(b.value)), b.active === false ? 0 : 1).run();
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/promos\/(\d+)$/))) {
    need('promo'); const id = int(m[1]);
    if (method === 'PUT') { const b = await body(req); await DB.prepare(`UPDATE jd_promos SET name = ?, type = ?, value = ?, active = ? WHERE id = ? AND store_id = ?`).bind(str(b.name, 60), b.type === 'nominal' ? 'nominal' : 'percent', Math.max(0, num(b.value)), b.active === false ? 0 : 1, id, sid).run(); return json({ ok: true }); }
    if (method === 'DELETE') { await DB.prepare(`DELETE FROM jd_promos WHERE id = ? AND store_id = ?`).bind(id, sid).run(); return json({ ok: true }); }
  }
  // ---- transactions
  if (path === '/api/transactions' && method === 'POST') { need('kasir'); return checkout(req, env, ctx, auth); }
  if (path === '/api/transactions' && method === 'GET') {
    const u = new URL(req.url); const from = u.searchParams.get('from') || localDate(); const to = u.searchParams.get('to') || from;
    const trx = (await DB.prepare(`SELECT * FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ? ${has('trx_all') ? '' : 'AND user_id = ' + int(auth.user.id)} ORDER BY id DESC LIMIT 1000`).bind(sid, from, to).all()).results;
    const items = trx.length ? (await DB.prepare(`SELECT i.* FROM jd_transaction_items i JOIN jd_transactions t ON t.id = i.trx_id WHERE t.store_id = ? AND t.local_date BETWEEN ? AND ?`).bind(sid, from, to).all()).results : [];
    const byTrx = {}; for (const it of items) (byTrx[it.trx_id] ||= []).push(it);
    for (const t of trx) t.items = byTrx[t.id] || [];
    return json({ transactions: trx });
  }
  if ((m = path.match(/^\/api\/transactions\/(\d+)$/)) && method === 'DELETE') {
    need('trx_void'); const id = int(m[1]);
    const t = await DB.prepare(`SELECT * FROM jd_transactions WHERE id = ? AND store_id = ?`).bind(id, sid).first();
    if (!t) fail(404, 'Transaksi tidak ditemukan');
    const items = (await DB.prepare(`SELECT * FROM jd_transaction_items WHERE trx_id = ?`).bind(id).all()).results;
    const stmts = [];
    for (const it of items) {
      if (!it.menu_id) continue;
      const rec = (await DB.prepare(`SELECT stock_id, qty FROM jd_recipes WHERE menu_id = ? AND store_id = ?`).bind(it.menu_id, sid).all()).results;
      for (const r of rec) stmts.push(DB.prepare(`UPDATE jd_stock SET qty = qty + ? WHERE id = ? AND store_id = ?`).bind(r.qty * it.qty, r.stock_id, sid));
    }
    stmts.push(DB.prepare(`DELETE FROM jd_transaction_items WHERE trx_id = ?`).bind(id), DB.prepare(`DELETE FROM jd_transactions WHERE id = ?`).bind(id));
    await DB.batch(stmts);
    return json({ ok: true });
  }
  // ---- report
  if (path === '/api/report' && method === 'GET') {
    need('laporan');
    const u = new URL(req.url); const from = u.searchParams.get('from') || localDate(); const to = u.searchParams.get('to') || from;
    const q = (sql) => DB.prepare(sql).bind(sid, from, to);
    const [sum, daily, top, methods, hours, cashiers] = await DB.batch([
      q(`SELECT COUNT(*) n, COALESCE(SUM(total),0) omzet, COALESCE(SUM(hpp_total),0) hpp, COALESCE(SUM(discount),0) disc, COALESCE(SUM(subtotal),0) gross FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ?`),
      q(`SELECT local_date d, COUNT(*) n, SUM(total) omzet, SUM(hpp_total) hpp FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ? GROUP BY local_date ORDER BY local_date`),
      q(`SELECT i.name, SUM(i.qty) qty, SUM(i.subtotal) omzet, SUM(i.hpp * i.qty) hpp FROM jd_transaction_items i JOIN jd_transactions t ON t.id = i.trx_id WHERE t.store_id = ? AND t.local_date BETWEEN ? AND ? GROUP BY i.name ORDER BY qty DESC`),
      q(`SELECT pay_method m, COUNT(*) n, SUM(total) omzet FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ? GROUP BY pay_method`),
      q(`SELECT CAST(strftime('%H', datetime(created_at, '+8 hours')) AS INTEGER) h, COUNT(*) n, SUM(total) omzet FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ? GROUP BY h ORDER BY h`),
      q(`SELECT COALESCE(cashier,'-') c, COUNT(*) n, SUM(total) omzet FROM jd_transactions WHERE store_id = ? AND local_date BETWEEN ? AND ? GROUP BY cashier`),
    ]);
    return json({ from, to, summary: sum.results[0], daily: daily.results, top: top.results, methods: methods.results, hours: hours.results, cashiers: cashiers.results });
  }
  if (path === '/api/report/telegram' && method === 'POST') {
    need('laporan');
    if (!auth.store.tg_chat_id) fail(400, 'Hubungkan Telegram dulu di menu Lainnya → Bot Telegram');
    const b = await body(req); const from = str(b.from, 10) || localDate(); const to = str(b.to, 10) || from;
    const rows = (await DB.prepare(`SELECT t.created_at, t.code, t.cashier, t.pay_method, i.name, i.qty, i.price, i.subtotal, i.hpp * i.qty hpp, t.discount, t.total FROM jd_transaction_items i JOIN jd_transactions t ON t.id = i.trx_id WHERE t.store_id = ? AND t.local_date BETWEEN ? AND ? ORDER BY t.id`).bind(sid, from, to).all()).results;
    const sum = await storeSummary(env, sid, from, to);
    const cell = (v) => { const x = String(v ?? ''); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const lines = ['sep=;', `Laporan;${cell(auth.store.name)}`, `Periode;${from} s/d ${to}`, `Omzet;${sum.omzet}`, `HPP;${sum.hpp}`, `Laba kotor;${sum.omzet - sum.hpp}`, `Transaksi;${sum.n}`, '',
      'Tanggal;Kode;Kasir;Metode;Menu;Qty;Harga;Subtotal;HPP;Diskon Trx;Total Trx',
      ...rows.map((r) => [new Date(Date.parse(r.created_at) + TZ_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' '), r.code, r.cashier, r.pay_method, r.name, r.qty, r.price, r.subtotal, r.hpp, r.discount, r.total].map(cell).join(';'))];
    const fd = new FormData();
    fd.append('chat_id', auth.store.tg_chat_id);
    fd.append('caption', `📊 Laporan ${auth.store.name} ${from} s/d ${to}\nOmzet ${rp(sum.omzet)} • Laba ${rp(sum.omzet - sum.hpp)} • ${sum.n} trx`);
    fd.append('document', new File(['\ufeff' + lines.join('\r\n')], `Laporan_${from}_${to}.csv`, { type: 'text/csv' }));
    const r = await tg(env, 'sendDocument', fd);
    if (!r.ok) fail(400, 'Gagal kirim ke Telegram: ' + (r.description || ''));
    return json({ ok: true });
  }
  // ---- users (kasir)
  if (path === '/api/users' && method === 'GET') { need('users'); return json({ users: (await DB.prepare(`SELECT id, username, name, role, active, created_at, last_login FROM jd_users WHERE store_id = ? ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'om' THEN 1 WHEN 'admin' THEN 2 WHEN 'spv' THEN 3 ELSE 4 END, id`).bind(sid).all()).results }); }
  if (path === '/api/users' && method === 'POST') {
    need('users'); if (auth.store.is_demo) fail(400, 'Tidak tersedia di mode demo. Daftar gratis untuk menambah kasir.'); const b = await body(req);
    const username = str(b.username, 30).toLowerCase();
    const role = ROLES.some((r) => r[0] === b.role) ? b.role : 'kasir';
    if (role === 'om' && !isOwner) fail(403, 'Hanya owner yang bisa membuat Operational Manager');
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) fail(400, 'Username 3-30 karakter: huruf kecil, angka, titik, garis bawah');
    if (str(b.password).length < 6) fail(400, 'Password minimal 6 karakter');
    if (await DB.prepare(`SELECT id FROM jd_users WHERE username = ?`).bind(username).first()) fail(400, 'Username sudah dipakai');
    await DB.prepare(`INSERT INTO jd_users (store_id, username, name, pass_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`).bind(sid, username, str(b.name, 60) || username, await hashPw(str(b.password, 100)), role, nowIso()).run();
    return json({ ok: true });
  }
  if ((m = path.match(/^\/api\/users\/(\d+)$/))) {
    need('users'); const id = int(m[1]);
    const u = await DB.prepare(`SELECT * FROM jd_users WHERE id = ? AND store_id = ?`).bind(id, sid).first();
    if (!u) fail(404, 'User tidak ditemukan');
    if (u.role === 'owner' && method === 'DELETE') fail(400, 'Owner tidak bisa dihapus');
    if (!isOwner && (u.role === 'owner' || u.role === 'om')) fail(403, 'Hanya owner yang bisa mengubah akun ini');
    if (method === 'PUT') {
      const b = await body(req);
      if (b.password) { if (str(b.password).length < 6) fail(400, 'Password minimal 6 karakter'); await DB.prepare(`UPDATE jd_users SET pass_hash = ? WHERE id = ?`).bind(await hashPw(str(b.password, 100)), id).run(); }
      if ('active' in b && u.role !== 'owner') { await DB.prepare(`UPDATE jd_users SET active = ? WHERE id = ?`).bind(b.active ? 1 : 0, id).run(); if (!b.active) await DB.prepare(`DELETE FROM jd_sessions WHERE user_id = ?`).bind(id).run(); }
      if (b.name) await DB.prepare(`UPDATE jd_users SET name = ? WHERE id = ?`).bind(str(b.name, 60), id).run();
      if (b.role && u.role !== 'owner' && ROLES.some((r) => r[0] === b.role)) { if (b.role === 'om' && !isOwner) fail(403, 'Hanya owner yang bisa menjadikan Operational Manager'); await DB.prepare(`UPDATE jd_users SET role = ? WHERE id = ?`).bind(b.role, id).run(); }
      return json({ ok: true });
    }
    if (method === 'DELETE') { await DB.batch([DB.prepare(`DELETE FROM jd_sessions WHERE user_id = ?`).bind(id), DB.prepare(`DELETE FROM jd_users WHERE id = ?`).bind(id)]); return json({ ok: true }); }
  }
  // ---- store settings
  if (path === '/api/store' && method === 'PUT') {
    need('toko'); const b = await body(req);
    if (!str(b.name)) fail(400, 'Nama toko wajib diisi');
    await DB.prepare(`UPDATE jd_stores SET name = ?, owner_name = ?, phone = ?, address = ?, receipt_note = ? WHERE id = ?`).bind(str(b.name, 80), str(b.owner_name, 60), str(b.phone, 30), str(b.address, 200), str(b.receipt_note, 200), sid).run();
    return json({ ok: true });
  }
  if (path === '/api/store/telegram' && method === 'POST') {
    need('telegram'); if (auth.store.is_demo) fail(400, 'Bot Telegram tidak tersedia di mode demo. Daftar gratis untuk memakainya.'); const code = 'T' + randCode(7);
    await DB.prepare(`UPDATE jd_stores SET tg_link_code = ? WHERE id = ?`).bind(code, sid).run();
    const bot = await botUsername(env);
    return json({ code, bot, link: `https://t.me/${bot}?start=${code}` });
  }
  if (path === '/api/store/telegram' && method === 'DELETE') { need('telegram'); await DB.prepare(`UPDATE jd_stores SET tg_chat_id = NULL, tg_link_code = NULL WHERE id = ?`).bind(sid).run(); return json({ ok: true }); }
  if (path === '/api/store/telegram/test' && method === 'POST') {
    if (!auth.store.tg_chat_id) fail(400, 'Telegram belum terhubung');
    const r = await sendTG(env, auth.store.tg_chat_id, `✅ Tes notifikasi dari <b>${escHtml(auth.store.name)}</b> berhasil.`);
    if (!r?.ok) fail(400, 'Gagal kirim: ' + (r?.description || ''));
    return json({ ok: true });
  }
  fail(404, 'Endpoint tidak ditemukan');
}

async function validRecipe(DB, sid, recipe) {
  const valid = (await DB.prepare(`SELECT id FROM jd_stock WHERE store_id = ?`).bind(sid).all()).results.map((r) => r.id);
  const rows = (Array.isArray(recipe) ? recipe : []).filter((r) => valid.includes(int(r.stock_id)) && num(r.qty) > 0);
  if (!rows.length) fail(400, valid.length ? 'Resep belum diisi. Tambahkan minimal 1 bahan beserta takarannya sebelum menyimpan menu.' : 'Belum ada bahan di Stok. Tambahkan bahan dulu di menu Stok, lalu isi resep menu ini.');
  return rows;
}
async function saveRecipe(DB, sid, menuId, recipe) {
  const valid = (await DB.prepare(`SELECT id FROM jd_stock WHERE store_id = ?`).bind(sid).all()).results.map((r) => r.id);
  const stmts = [DB.prepare(`DELETE FROM jd_recipes WHERE menu_id = ? AND store_id = ?`).bind(menuId, sid)];
  for (const r of recipe.slice(0, 30)) {
    const stockId = int(r.stock_id); const qty = num(r.qty);
    if (valid.includes(stockId) && qty > 0) stmts.push(DB.prepare(`INSERT INTO jd_recipes (store_id, menu_id, stock_id, qty) VALUES (?, ?, ?, ?)`).bind(sid, menuId, stockId, qty));
  }
  await DB.batch(stmts);
}

async function checkout(req, env, ctx, auth) {
  const DB = env.DB; const sid = auth.store.id; const b = await body(req);
  const lines = (Array.isArray(b.items) ? b.items : []).map((x) => ({ menu_id: int(x.menu_id), qty: int(x.qty) })).filter((x) => x.qty > 0);
  if (!lines.length) fail(400, 'Keranjang kosong');
  const ids = [...new Set(lines.map((l) => l.menu_id))];
  const menus = (await DB.prepare(`SELECT * FROM jd_menu WHERE store_id = ? AND id IN (${ids.map(() => '?').join(',')})`).bind(sid, ...ids).all()).results;
  const rec = (await DB.prepare(`SELECT r.menu_id, r.stock_id, r.qty, s.cost_per_unit FROM jd_recipes r JOIN jd_stock s ON s.id = r.stock_id WHERE r.store_id = ? AND r.menu_id IN (${ids.map(() => '?').join(',')})`).bind(sid, ...ids).all()).results;
  const items = []; let subtotal = 0; let hppTotal = 0; const stockUse = {};
  for (const l of lines) {
    const mm = menus.find((x) => x.id === l.menu_id);
    if (!mm) fail(400, 'Menu tidak ditemukan / sudah dihapus');
    const r = rec.filter((x) => x.menu_id === mm.id);
    const hpp = r.length ? Math.round(r.reduce((a, x) => a + x.qty * x.cost_per_unit, 0)) : mm.hpp;
    for (const x of r) stockUse[x.stock_id] = (stockUse[x.stock_id] || 0) + x.qty * l.qty;
    const st = mm.price * l.qty; subtotal += st; hppTotal += hpp * l.qty;
    items.push({ menu_id: mm.id, name: mm.name, qty: l.qty, price: mm.price, hpp, subtotal: st });
  }
  let discount = 0;
  if (b.promo_id) {
    const p = await DB.prepare(`SELECT * FROM jd_promos WHERE id = ? AND store_id = ? AND active = 1`).bind(int(b.promo_id), sid).first();
    if (p) discount += p.type === 'percent' ? Math.round((subtotal * Math.min(p.value, 100)) / 100) : Math.round(p.value);
  }
  discount += Math.max(0, int(b.discount));
  discount = Math.min(discount, subtotal);
  const total = subtotal - discount;
  const method = ['Tunai', 'QRIS', 'Transfer', 'Debit'].includes(b.pay_method) ? b.pay_method : 'Tunai';
  const paid = method === 'Tunai' ? int(b.paid) : total;
  if (paid < total) fail(400, 'Uang bayar kurang');
  const now = new Date(); const ld = localDate(now);
  const code = 'TRX-' + ld.replace(/-/g, '').slice(2) + '-' + randCode(4);
  const t = await DB.prepare(`INSERT INTO jd_transactions (store_id, user_id, cashier, code, subtotal, discount, total, hpp_total, pay_method, paid, change_amt, note, created_at, local_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(sid, auth.user.id, auth.user.name || auth.user.username, code, subtotal, discount, total, hppTotal, method, paid, paid - total, str(b.note, 200), now.toISOString(), ld).first();
  const stmts = items.map((it) => DB.prepare(`INSERT INTO jd_transaction_items (trx_id, store_id, menu_id, name, qty, price, hpp, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(t.id, sid, it.menu_id, it.name, it.qty, it.price, it.hpp, it.subtotal));
  for (const [stockId, q] of Object.entries(stockUse)) stmts.push(DB.prepare(`UPDATE jd_stock SET qty = qty - ?, updated_at = ? WHERE id = ? AND store_id = ?`).bind(q, now.toISOString(), int(stockId), sid));
  if (int(b.order_id)) stmts.push(DB.prepare(`UPDATE jd_orders SET status = 'selesai', trx_id = ?, updated_at = ? WHERE id = ? AND store_id = ?`).bind(t.id, now.toISOString(), int(b.order_id), sid));
  await DB.batch(stmts);

  if (auth.store.tg_chat_id) {
    ctx.waitUntil((async () => {
      let txt = `🧾 <b>Transaksi baru</b> — ${escHtml(auth.store.name)}\n${code} • ${escHtml(method)} • kasir ${escHtml(auth.user.name || auth.user.username)}\n` + items.map((i) => `• ${escHtml(i.name)} x${i.qty} = ${rp(i.subtotal)}`).join('\n') + (discount ? `\nDiskon: -${rp(discount)}` : '') + `\n<b>Total: ${rp(total)}</b>`;
      const used = Object.keys(stockUse).map(int);
      if (used.length) {
        const low = (await DB.prepare(`SELECT name, qty, unit FROM jd_stock WHERE store_id = ? AND qty <= min_qty AND id IN (${used.map(() => '?').join(',')})`).bind(sid, ...used).all()).results;
        if (low.length) txt += '\n\n⚠️ Stok menipis: ' + low.map((s) => `${escHtml(s.name)} (${+Number(s.qty).toFixed(2)} ${escHtml(s.unit || '')})`).join(', ');
      }
      await sendTG(env, auth.store.tg_chat_id, txt);
    })());
  }
  return json({ ok: true, transaction: { id: t.id, note: str(b.note, 200), code, subtotal, discount, total, paid, change_amt: paid - total, pay_method: method, created_at: now.toISOString(), cashier: auth.user.name || auth.user.username, items } });
}

// ---------------------------------------------------------------- toko demo
// Setiap klik "Coba Demo" membuat toko demo baru berisi data contoh, berlaku 24 jam lalu dihapus otomatis.
const DEMO_STOCK = [
  ['Kopi bubuk', 'gram', 2400, 300, 120], ['Gula pasir', 'gram', 3500, 500, 16], ['Susu kental manis', 'ml', 1800, 300, 25],
  ['Teh celup', 'pcs', 80, 20, 300], ['Mie instan', 'pcs', 36, 12, 3200], ['Telur', 'pcs', 8, 10, 2100],
  ['Roti tawar', 'lembar', 30, 10, 800], ['Pisang', 'pcs', 24, 10, 1500], ['Cup plastik', 'pcs', 260, 50, 500], ['Jahe', 'gram', 400, 100, 30], ['Gorengan mentah', 'pcs', 120, 30, 500],
];
const DEMO_MENU = [ // nama, kategori, harga, hpp manual, resep [indeks stok, qty]
  ['Kopi Hitam', 'Minuman', 5000, 0, [[0, 12], [1, 10]]], ['Kopi Susu', 'Minuman', 8000, 0, [[0, 12], [2, 30]]],
  ['Es Kopi Susu', 'Minuman', 12000, 0, [[0, 15], [2, 40], [8, 1]]], ['Teh Manis', 'Minuman', 4000, 0, [[3, 1], [1, 15]]],
  ['Es Teh Manis', 'Minuman', 5000, 0, [[3, 1], [1, 20], [8, 1]]], ['Susu Jahe', 'Minuman', 8000, 0, [[2, 40], [9, 15]]],
  ['Indomie Rebus', 'Makanan', 10000, 0, [[4, 1]]], ['Indomie Goreng Telur', 'Makanan', 14000, 0, [[4, 1], [5, 1]]],
  ['Roti Bakar Coklat', 'Makanan', 12000, 1500, [[6, 2]]], ['Pisang Goreng', 'Snack', 10000, 1500, [[7, 2], [1, 5]]],
  ['Gorengan (5 pcs)', 'Snack', 5000, 0, [[10, 5]]],
];
const sqlStr = (v) => "'" + String(v).replace(/'/g, "''") + "'";

async function createDemo(env) {
  const DB = env.DB; const now = new Date(); const nowS = now.toISOString();
  // bersihkan demo yang sudah lewat 24 jam
  const old = `(SELECT id FROM jd_stores WHERE is_demo = 1 AND trial_end < ${sqlStr(nowS)})`;
  await DB.batch([
    DB.prepare(`DELETE FROM jd_sessions WHERE user_id IN (SELECT id FROM jd_users WHERE store_id IN ${old})`),
    ...['jd_transaction_items', 'jd_transactions', 'jd_recipes', 'jd_menu', 'jd_stock', 'jd_promos', 'jd_tables', 'jd_orders', 'jd_support', 'jd_role_perms', 'jd_users'].map((t) => DB.prepare(`DELETE FROM ${t} WHERE store_id IN ${old}`)),
    DB.prepare(`DELETE FROM jd_stores WHERE is_demo = 1 AND trial_end < ?`).bind(nowS),
  ]);
  const alive = await DB.prepare(`SELECT COUNT(*) n FROM jd_stores WHERE is_demo = 1`).first();
  if (alive.n >= 300) fail(429, 'Demo sedang penuh, coba lagi beberapa saat lagi.');

  const st = await DB.prepare(`INSERT INTO jd_stores (name, owner_name, phone, address, status, trial_end, receipt_note, created_at, is_demo) VALUES ('Warkop Demo', 'Pengunjung Demo', '-', 'Jl. Contoh No. 1', 'active', ?, 'Ini struk contoh — mode demo J-DATA', ?, 1) RETURNING id`).bind(addDays(nowS, 1), nowS).first();
  const sid = st.id; const uname = 'demo_' + randCode(8).toLowerCase();
  const u = await DB.prepare(`INSERT INTO jd_users (store_id, username, name, pass_hash, role, active, must_change, created_at, last_login) VALUES (?, ?, 'Pengunjung Demo', 'demo', 'owner', 1, 0, ?, ?) RETURNING id`).bind(sid, uname, nowS, nowS).first();

  const stockRows = (await DB.prepare(`INSERT INTO jd_stock (store_id, name, unit, qty, min_qty, cost_per_unit, updated_at) VALUES ` +
    DEMO_STOCK.map((x) => `(${sid}, ${sqlStr(x[0])}, ${sqlStr(x[1])}, ${x[2]}, ${x[3]}, ${x[4]}, ${sqlStr(nowS)})`).join(',') + ` RETURNING id, name`).all()).results;
  const stockId = (i) => stockRows.find((r) => r.name === DEMO_STOCK[i][0]).id;
  const menuRows = (await DB.prepare(`INSERT INTO jd_menu (store_id, name, category, price, hpp, active, created_at) VALUES ` +
    DEMO_MENU.map((m) => `(${sid}, ${sqlStr(m[0])}, ${sqlStr(m[1])}, ${m[2]}, ${m[3]}, 1, ${sqlStr(nowS)})`).join(',') + ` RETURNING id, name`).all()).results;
  const menuId = (name) => menuRows.find((r) => r.name === name).id;
  const recVals = []; const menuCost = {};
  for (const m of DEMO_MENU) {
    let cost = 0;
    for (const [si, q] of m[4]) { recVals.push(`(${sid}, ${menuId(m[0])}, ${stockId(si)}, ${q})`); cost += q * DEMO_STOCK[si][4]; }
    menuCost[m[0]] = m[4].length ? Math.round(cost) : m[3];
  }
  await DB.batch([
    DB.prepare(`INSERT INTO jd_recipes (store_id, menu_id, stock_id, qty) VALUES ` + recVals.join(',')),
    DB.prepare(`INSERT INTO jd_promos (store_id, name, type, value, active) VALUES (${sid}, 'Diskon Pelanggan Setia', 'percent', 10, 1), (${sid}, 'Potongan Rp 2.000', 'nominal', 2000, 1)`),
  ]);

  // transaksi contoh 14 hari terakhir
  let seed = (Date.now() % 2147483647) || 7; const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const weights = DEMO_MENU.map((m) => (m[1] === 'Minuman' ? 3 : 2));
  const pickMenu = () => { let r = rnd() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < DEMO_MENU.length; i++) { r -= weights[i]; if (r <= 0) return DEMO_MENU[i]; } return DEMO_MENU[0]; };
  const hours = [7, 7, 8, 8, 9, 10, 12, 13, 15, 16, 16, 17, 19, 19, 20, 20, 21, 21, 22, 23];
  const trxVals = []; const itemsPer = [];
  const todayLocalMid = Date.parse(localDate(now) + 'T00:00:00Z') - TZ_OFFSET_MS; // 00:00 WITA hari ini (UTC ms)
  for (let d = 13; d >= 0; d--) {
    const n = 8 + Math.floor(rnd() * 11) + (d % 7 === 1 || d % 7 === 2 ? 5 : 0);
    const times = [];
    for (let k = 0; k < n; k++) {
      const t = todayLocalMid - d * DAY + pick(hours) * 3600000 + Math.floor(rnd() * 3600000);
      if (t < now.getTime()) times.push(t);
    }
    times.sort((a, b) => a - b);
    for (const t of times) {
      const lines = {}; const cnt = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < cnt; k++) { const m = pickMenu(); lines[m[0]] = (lines[m[0]] || 0) + (rnd() < 0.25 ? 2 : 1); }
      const items = Object.entries(lines).map(([name, qty]) => { const m = DEMO_MENU.find((x) => x[0] === name); return { name, qty, price: m[2], hpp: menuCost[name], subtotal: m[2] * qty }; });
      const subtotal = items.reduce((a, i) => a + i.subtotal, 0); const hpp = items.reduce((a, i) => a + i.hpp * i.qty, 0);
      const disc = rnd() < 0.1 ? Math.round(subtotal * 0.1) : 0; const total = subtotal - disc;
      const r = rnd(); const method = r < 0.6 ? 'Tunai' : r < 0.9 ? 'QRIS' : 'Transfer';
      const paid = method === 'Tunai' ? Math.ceil(total / 5000) * 5000 + (rnd() < 0.3 ? 5000 : 0) : total;
      const dt = new Date(t); const ld = localDate(dt);
      trxVals.push(`(${sid}, ${u.id}, ${sqlStr(pick(['Rafli', 'Sari', 'Budi']))}, ${sqlStr('TRX-' + ld.replace(/-/g, '').slice(2) + '-' + randCode(4))}, ${subtotal}, ${disc}, ${total}, ${hpp}, ${sqlStr(method)}, ${paid}, ${paid - total}, '', ${sqlStr(dt.toISOString())}, ${sqlStr(ld)})`);
      itemsPer.push(items);
    }
  }
  const trxIds = [];
  for (let i = 0; i < trxVals.length; i += 80) {
    const rows = (await DB.prepare(`INSERT INTO jd_transactions (store_id, user_id, cashier, code, subtotal, discount, total, hpp_total, pay_method, paid, change_amt, note, created_at, local_date) VALUES ` + trxVals.slice(i, i + 80).join(',') + ` RETURNING id`).all()).results;
    trxIds.push(...rows.map((r) => r.id));
  }
  const itemVals = [];
  itemsPer.forEach((items, i) => { for (const it of items) itemVals.push(`(${trxIds[i]}, ${sid}, ${menuId(it.name)}, ${sqlStr(it.name)}, ${it.qty}, ${it.price}, ${it.hpp}, ${it.subtotal})`); });
  const stmts = [];
  for (let i = 0; i < itemVals.length; i += 200) stmts.push(DB.prepare(`INSERT INTO jd_transaction_items (trx_id, store_id, menu_id, name, qty, price, hpp, subtotal) VALUES ` + itemVals.slice(i, i + 200).join(',')));
  // meja + contoh pesanan QR
  stmts.push(DB.prepare(`INSERT INTO jd_tables (store_id, name, token, active, created_at) VALUES ` + [1, 2, 3, 4, 5, 6].map((n) => `(${sid}, 'Meja ${n}', ${sqlStr(randCode(10).toLowerCase())}, 1, ${sqlStr(nowS)})`).join(',')));
  const ord = (tbl, cust, items, status, minsAgo) => { const it = items.map(([n, q]) => ({ menu_id: menuId(n), name: n, qty: q, price: DEMO_MENU.find((x) => x[0] === n)[2] })); const tot = it.reduce((a, x) => a + x.price * x.qty, 0); const ts = sqlStr(new Date(now.getTime() - minsAgo * 60000).toISOString()); return `(${sid}, NULL, ${sqlStr(tbl)}, ${sqlStr(cust)}, '', ${sqlStr(JSON.stringify(it))}, ${tot}, ${sqlStr(status)}, ${ts}, ${ts})`; };
  stmts.push(DB.prepare(`INSERT INTO jd_orders (store_id, table_id, table_name, customer, note, items, total, status, created_at, updated_at) VALUES ` + [
    ord('Meja 3', 'Dina', [['Es Kopi Susu', 2], ['Pisang Goreng', 1]], 'baru', 1),
    ord('Meja 5', 'Andi', [['Kopi Hitam', 1], ['Indomie Goreng Telur', 1]], 'diproses', 6),
  ].join(',')));
  const token = randToken(40);
  stmts.push(DB.prepare(`INSERT INTO jd_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, u.id, addDays(nowS, 1)));
  await DB.batch(stmts);
  return json({ ok: true, redirect: '/app' }, 200, { 'set-cookie': sessionCookie(token, 86400) });
}

// ---------------------------------------------------------------- auth endpoints
async function login(req, env) {
  const b = await body(req);
  const username = str(b.username, 60).toLowerCase(); const password = str(b.password, 200);
  if (!username || !password) fail(400, 'Isi username dan password');
  const u = await env.DB.prepare(`SELECT * FROM jd_users WHERE username = ?`).bind(username).first();
  if (!u || !(await verifyPw(password, u.pass_hash))) fail(400, 'Username / Password salah!');
  if (!u.active) fail(403, 'Akun dinonaktifkan. Hubungi owner toko.');
  const token = randToken(40);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM jd_sessions WHERE expires_at < ?`).bind(nowIso()),
    env.DB.prepare(`INSERT INTO jd_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, u.id, addDays(nowIso(), SESSION_DAYS)),
    env.DB.prepare(`UPDATE jd_users SET last_login = ? WHERE id = ?`).bind(nowIso(), u.id),
  ]);
  return json({ ok: true, redirect: u.role === 'headadmin' ? '/admin' : '/app' }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

async function register(req, env, ctx) {
  const b = await body(req);
  const storeName = str(b.store_name, 80); const ownerName = str(b.owner_name, 60); const phone = str(b.phone, 30).replace(/[^0-9+]/g, '');
  const username = str(b.username, 30).toLowerCase(); const password = str(b.password, 100);
  if (!storeName || !ownerName) fail(400, 'Nama toko dan nama pemilik wajib diisi');
  if (phone.length < 8) fail(400, 'Nomor WhatsApp tidak valid');
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) fail(400, 'Username 3-30 karakter: huruf kecil, angka, titik, garis bawah');
  if (password.length < 6) fail(400, 'Password minimal 6 karakter');
  if (await env.DB.prepare(`SELECT id FROM jd_users WHERE username = ?`).bind(username).first()) fail(400, 'Username sudah dipakai');
  const now = nowIso();
  const s = await env.DB.prepare(`INSERT INTO jd_stores (name, owner_name, phone, status, trial_end, created_at) VALUES (?, ?, ?, 'active', ?, ?) RETURNING id`).bind(storeName, ownerName, phone, addDays(now, TRIAL_DAYS), now).first();
  const u = await env.DB.prepare(`INSERT INTO jd_users (store_id, username, name, pass_hash, role, active, created_at, last_login) VALUES (?, ?, ?, ?, 'owner', 1, ?, ?) RETURNING id`).bind(s.id, username, ownerName, await hashPw(password), now, now).first();
  const token = randToken(40);
  await env.DB.prepare(`INSERT INTO jd_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, u.id, addDays(now, SESSION_DAYS)).run();
  let lic = null;
  if (str(b.sn)) { try { const st = await env.DB.prepare(`SELECT * FROM jd_stores WHERE id = ?`).bind(s.id).first(); lic = await activateLicense(env, st, b.sn, ownerName); } catch (e) { lic = { ok: false, error: e.message }; } }
  ctx.waitUntil(notifyAdmin(env, `🆕 <b>Toko baru daftar</b>\n🏪 ${escHtml(storeName)}\n👤 ${escHtml(ownerName)} (@${escHtml(username)})\n📱 ${escHtml(phone)}\n⏳ Trial ${TRIAL_DAYS} hari s/d ${localDate(new Date(addDays(now, TRIAL_DAYS)))}`));
  return json({ ok: true, redirect: '/app' + (lic && !lic.ok ? '?snerr=' + encodeURIComponent(lic.error) : lic ? '?sn_ok=1' : ''), license: lic }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

async function me(env, auth) {
  if (!auth) fail(401, 'Silakan login');
  const out = { user: { id: auth.user.id, username: auth.user.username, name: auth.user.name, role: auth.user.role, must_change: !!auth.user.must_change }, access: auth.access };
  if (auth.store) { const { tg_link_code, ...s } = auth.store; out.store = { ...s, tg_connected: !!s.tg_chat_id, tg_chat_id: undefined }; }
  out.user.role_label = ROLE_LABEL[auth.user.role] || auth.user.role;
  out.perms = auth.store ? (requireStoreSoft(auth), auth.perms) : [];
  out.limited = !!auth.limited;
  out.admin_wa = (await getSetting(env, 'admin_wa', '')) || DEFAULT_ADMIN_WA;
  out.apk = await apkInfo(env);
  out.price_text = await getSetting(env, 'price_text', '');
  out.lynk_url = await getSetting(env, 'lynk_url', '');
  out.bot_username = await botUsername(env);
  return json(out);
}

async function changePassword(req, env, auth) {
  if (!auth) fail(401, 'Silakan login');
  if (auth.store?.is_demo) fail(400, 'Tidak tersedia di mode demo');
  const b = await body(req);
  const u = await env.DB.prepare(`SELECT * FROM jd_users WHERE id = ?`).bind(auth.user.id).first();
  if (!(await verifyPw(str(b.old_password, 200), u.pass_hash))) fail(400, 'Password lama salah');
  if (str(b.new_password).length < 8 && u.role === 'headadmin') fail(400, 'Password head admin minimal 8 karakter');
  if (str(b.new_password).length < 6) fail(400, 'Password minimal 6 karakter');
  await env.DB.batch([
    env.DB.prepare(`UPDATE jd_users SET pass_hash = ?, must_change = 0 WHERE id = ?`).bind(await hashPw(str(b.new_password, 200)), u.id),
    env.DB.prepare(`DELETE FROM jd_sessions WHERE user_id = ? AND token != ?`).bind(u.id, auth.token),
  ]);
  return json({ ok: true });
}

// Reset password head admin darurat: set secret RESET_KEY lalu buka /reset-headadmin?key=ISI_RESET_KEY
async function resetHeadAdmin(req, env) {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!env.RESET_KEY || env.RESET_KEY.length < 8) return html(page('Reset', `<div class="p-6 text-center">Fitur reset nonaktif. Tambahkan secret <b>RESET_KEY</b> (min 8 karakter) di Worker.</div>`), 403);
  if (key !== env.RESET_KEY) return html(page('Reset', `<div class="p-6 text-center">Key salah.</div>`), 403);
  const pw = 'Jd-' + randCode(10);
  const admin = await env.DB.prepare(`SELECT id, username FROM jd_users WHERE role='headadmin' ORDER BY id LIMIT 1`).first();
  await env.DB.batch([
    env.DB.prepare(`UPDATE jd_users SET pass_hash = ?, must_change = 1, active = 1 WHERE id = ?`).bind(await hashPw(pw), admin.id),
    env.DB.prepare(`DELETE FROM jd_sessions WHERE user_id = ?`).bind(admin.id),
  ]);
  return html(page('Reset berhasil', `<div class="min-h-screen flex items-center justify-center p-6"><div class="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl"><h1 class="text-xl font-bold mb-4">Password Head Admin direset</h1><p>Username: <b>${escHtml(admin.username)}</b></p><p class="mt-1">Password baru: <b class="font-mono text-lg">${pw}</b></p><p class="text-sm text-slate-500 mt-4">Catat sekarang, lalu hapus secret RESET_KEY agar link ini mati.</p><a href="/" class="block mt-6 bg-slate-900 text-white rounded-xl py-3 font-bold">Ke halaman login</a></div></div>`));
}

// ---------------------------------------------------------------- router
async function route(req, env, ctx) {
  if (env.TELEGRAM_API_BASE) TG_BASE = env.TELEGRAM_API_BASE;
  const url = new URL(req.url); const path = url.pathname.replace(/\/+$/, '') || '/'; const method = req.method;

  // static
  if (path === '/manifest.json') return new Response(JSON.stringify(MANIFEST), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
  if (path === '/app.css') return new Response(APP_CSS, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } });
  if (path === '/sw.js') return new Response(SW_JS, { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-cache' } });
  if (['/icon-192.png', '/icon-512.png', '/icon-mask.png', '/favicon.ico', '/logo.png'].includes(path)) return new Response(b64d(path === '/logo.png' ? LOGO_PNG : path === '/icon-512.png' ? ICON_512 : path === '/icon-mask.png' ? ICON_MASK : ICON_192), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
  const st = staticRoutes(path); if (st) return st;
  if (path === '/.well-known/assetlinks.json') return new Response(env.ASSETLINKS_JSON || '[]', { headers: { 'content-type': 'application/json' } });

  if (!env.DB) return html(page('Konfigurasi', `<div class="min-h-screen flex items-center justify-center p-6"><div class="bg-white rounded-3xl p-8 max-w-md shadow-xl"><h1 class="text-xl font-bold text-red-600 mb-3">Database belum terhubung</h1><p>Buka Cloudflare → Workers &amp; Pages → Worker ini → <b>Settings → Bindings → Add → D1 database</b>.<br>Variable name: <b class="font-mono">DB</b><br>Database: <b>jdata_db</b><br><br>Lalu Deploy ulang.</p></div></div>`), 500);

  try {
    await ensureSchema(env);
    ctx.waitUntil(maybeDaily(env).catch((e) => console.error('daily', e)));
    if (path === '/telegram/webhook' && method === 'POST') return await handleTelegram(req, env);
    if (path === '/reset-headadmin') return await resetHeadAdmin(req, env);
    if (path === '/api/login' && method === 'POST') return await login(req, env);
    if (path === '/api/register' && method === 'POST') return await register(req, env, ctx);
    if (path === '/api/demo' && method === 'POST') return await createDemo(env);
    const pub = (await licensePublic(req, env, ctx, path, method)) || (await publicRoutes(req, env, ctx, path, method));
    if (pub) return pub;

    const auth = await getAuth(req, env);
    if (path === '/api/logout' && method === 'POST') {
      if (auth) await env.DB.prepare(`DELETE FROM jd_sessions WHERE token = ?`).bind(auth.token).run();
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
    }
    if (path === '/api/me') return await me(env, auth);
    if (path === '/api/password' && method === 'POST') return await changePassword(req, env, auth);
    if (path.startsWith('/api/admin/')) return await adminApi(req, env, auth, path, method);
    if (path === '/api/support' && method === 'POST') return await supportPost(req, env, ctx, auth);
    if (path.startsWith('/api/license')) return await licenseStoreApi(req, env, auth, path, method);
    if (path === '/api/store' && method === 'GET') { if (!auth?.store) fail(401, 'Silakan login'); return me(env, auth); }
    if (path.startsWith('/api/')) return await storeApi(req, env, ctx, requireStore(auth), path, method);

    // pages
    if (path === '/' || path === '/login') { if (auth) return redirect(auth.user.role === 'headadmin' ? '/admin' : '/app'); return html(LOGIN_HTML); }
    if (path === '/daftar') return html(REGISTER_HTML);
    if (path === '/app') { if (!auth) return redirect('/'); if (auth.user.role === 'headadmin') return redirect('/admin'); return html(APP_HTML); }
    if (path === '/admin') { if (!auth) return redirect('/'); if (auth.user.role !== 'headadmin') return redirect('/app'); return html(ADMIN_HTML); }
    return html(page('404', `<div class="min-h-screen flex items-center justify-center"><a href="/" class="text-blue-600 font-bold">Halaman tidak ada — kembali</a></div>`), 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Server error: ' + e.message }, 500);
  }
}

export default {
  fetch: (req, env, ctx) => route(req, env, ctx),
  scheduled: (evt, env, ctx) => { if (env.TELEGRAM_API_BASE) TG_BASE = env.TELEGRAM_API_BASE; ctx.waitUntil(runDaily(env)); },
};
