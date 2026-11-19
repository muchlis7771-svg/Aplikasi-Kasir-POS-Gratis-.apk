// ============ NOTIFIKASI TELEGRAM (piutang, utang, laporan) ============
// Dua mode: (1) satu bot bersama dipakai semua toko (diatur Head Admin di /api/tg/hook), atau
// (2) bot sendiri per toko — khusus paket High · Distributor, supaya laporan 1 toko 1 bot, tidak
// pernah tercampur dengan toko lain walau toko itu dikelola orang yang sama (/api/tg/hook/<sid>).
// Tiap toko menghubungkan chat Telegram-nya sendiri lewat kode sekali-pakai (tombol "Hubungkan Telegram"
// di Pengaturan → link https://t.me/<bot>?start=<kode> → webhook mencatat chat_id ke toko yang benar,
// lewat bot bersama ATAU bot sendiri toko itu — kode kedaluwarsa 15 menit & sekali pakai, sudah cukup
// aman tanpa perlu dicocokkan lagi ke sid URL karena kode sendiri sudah mengunci ke 1 toko tertentu).
//
// Setelah terhubung, chat yang sama bisa TANYA data kapan saja (fitur feedback bot): owner cukup
// ketik perintah (mis. "piutang", "stok") dan bot membalas data terkini toko tersebut — dibaca dari
// tabel snap (snapshot ringkas yang didorong HP/app tiap ±1-20 menit lewat POST /api/snap), BUKAN
// dihitung ulang dari log event `ev` (terlalu berat utk dibalas sinkron di webhook). Lihat tgCmd().
export const TGSCHEMA = ['CREATE TABLE IF NOT EXISTS tglink(code TEXT PRIMARY KEY,sid TEXT NOT NULL,t INTEGER NOT NULL)'];
const TG_LINK_TTL = 15 * 60000;
const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');

const TG_COMMANDS = [
  { command: 'piutang', description: 'Total & rincian piutang outlet' },
  { command: 'stok', description: 'Produk yang stoknya menipis' },
  { command: 'utang', description: 'Utang ke supplier' },
  { command: 'kas', description: 'Saldo kas & bank' },
  { command: 'omset', description: 'Omset & laba bulan ini' },
  { command: 'ringkasan', description: 'Semua info singkat' },
  { command: 'menu', description: 'Daftar perintah yang tersedia' },
];
const TG_MENU_TEXT = '*🤖 J-POS Bot — Perintah*\nKetik salah satu (boleh tanpa tanda "/"):\n• *piutang* — total & rincian piutang outlet\n• *stok* — produk yang stoknya menipis\n• *utang* — utang ke supplier\n• *kas* — saldo kas & bank\n• *omset* — omset & laba bulan ini\n• *ringkasan* — semua info singkat\n\nChat ini terhubung ke lebih dari 1 toko? Tambahkan nama tokonya, contoh:\n`piutang Toko Jaya`';
const TG_NOTCONNECTED_TEXT = 'Halo! Untuk menghubungkan chat ini ke toko Anda, buka aplikasi J-POS → Pengaturan → Laporan Otomatis → tombol "Hubungkan Telegram".\n\nSudah terhubung? Ketik *menu* untuk melihat perintah yang bisa dipakai di chat ini.';

// cari semua toko yang rc.tg (daftar chat Telegram yang menerima notifikasi) berisi chatId ini.
// rpt tidak diindeks, jadi di-scan lalu disaring di JS — cukup utk skala toko saat ini; filter LIKE
// dulu supaya baris yang jelas tidak cocok tidak perlu JSON.parse.
async function tgFindStores(env, chatId) {
  const cid = String(chatId);
  const rows = (await env.DB.prepare("SELECT id,name,rpt FROM stores WHERE rpt LIKE ?").bind('%"' + cid + '"%').all().catch(() => ({ results: [] }))).results || [];
  const out = [];
  for (const r of rows) {
    let rc = {}; try { rc = r.rpt ? JSON.parse(r.rpt) : {}; } catch (e) { continue; }
    if (Array.isArray(rc.tg) && rc.tg.includes(cid)) out.push({ id: r.id, name: r.name || r.id });
  }
  return out;
}

function fmtPiutang(S) {
  const L = ['*💰 Piutang Outlet*', ''];
  if (!S.arN) { L.push('Tidak ada piutang outlet saat ini. 👍'); return L.join('\n'); }
  L.push('Total: *' + rp(S.ar) + '*' + (S.od ? ' (lewat jatuh tempo: ' + rp(S.od) + ')' : ''), '', 'Rincian (' + Math.min(S.arN, (S.arL || []).length) + ' dari ' + S.arN + ', diurutkan jatuh tempo terdekat):');
  for (const x of (S.arL || [])) {
    const d = Math.ceil((x.due - Date.now()) / 864e5);
    const dt = d < 0 ? 'Lewat ' + (-d) + ' hari' : d == 0 ? 'Jatuh tempo hari ini' : d + ' hari lagi';
    L.push('• ' + x.cn + ': ' + rp(x.amt) + ' · ' + dt);
  }
  return L.join('\n');
}
function fmtStok(S) {
  const L = ['*📦 Stok Menipis*', ''];
  if (!S.nlow) { L.push('Tidak ada produk yang stoknya menipis saat ini. 👍'); return L.join('\n'); }
  L.push('Ada *' + S.nlow + '* item menipis' + (S.nlow > (S.low || []).length ? ' (ditampilkan ' + (S.low || []).length + ')' : '') + ':');
  for (const x of (S.low || [])) L.push('• ' + x[0] + ': ' + x[1] + (x[2] != null ? ' (min ' + x[2] + ')' : ''));
  return L.join('\n');
}
function fmtUtang(S) {
  const L = ['*🧾 Utang Supplier*', ''];
  if (!S.ap) { L.push('Tidak ada utang supplier saat ini. 👍'); return L.join('\n'); }
  L.push('Total: *' + rp(S.ap) + '*', '', 'Rincian (diurutkan jatuh tempo terdekat):');
  for (const x of (S.apL || [])) {
    const d = Math.ceil((x.due - Date.now()) / 864e5);
    const dt = d < 0 ? 'Lewat ' + (-d) + ' hari' : d == 0 ? 'Jatuh tempo hari ini' : d + ' hari lagi';
    L.push('• ' + x.sup + ': ' + rp(x.amt) + ' · ' + dt);
  }
  return L.join('\n');
}
function fmtKas(S) {
  return ['*💵 Kas & Bank*', '', 'Kas: *' + rp(S.kas) + '*', 'Bank/QRIS: *' + rp(S.bank) + '*', '', 'Nilai persediaan: ' + rp(S.sv) + (S.bad ? ' · Bad stock: ' + rp(S.bad) : '')].join('\n');
}
function fmtOmset(S) {
  return ['*📈 Omset Bulan Ini*', '', 'Omset: *' + rp(S.om) + '*', 'Laba kotor: *' + rp(S.lm) + '*'].join('\n');
}
function fmtRingkasan(S) {
  return ['*🏪 Ringkasan Toko*', '', 'Kas: ' + rp(S.kas) + ' · Bank/QRIS: ' + rp(S.bank), 'Piutang outlet: ' + rp(S.ar) + (S.od ? ' (lewat jatuh tempo ' + rp(S.od) + ')' : ''), 'Utang supplier: ' + rp(S.ap), 'Stok menipis: ' + (S.nlow || 0) + ' item', 'Omset bulan ini: ' + rp(S.om) + ' · Laba: ' + rp(S.lm), '', 'Ketik *piutang*, *stok*, *utang*, *kas*, atau *omset* untuk rincian.'].join('\n');
}
const TG_FMT = { piutang: fmtPiutang, stok: fmtStok, utang: fmtUtang, kas: fmtKas, omset: fmtOmset, ringkasan: fmtRingkasan };

// cocokkan teks pesan ke salah satu perintah data di atas (toleran: boleh pakai/tidak pakai "/",
// sinonim umum, dan huruf besar/kecil bebas). sisa teks setelah kata kunci dipakai sbg filter nama
// toko (utk chat yg terhubung ke >1 toko).
function tgParseCmd(text) {
  const low = String(text || '').trim().toLowerCase().replace(/^\//, '');
  const defs = [
    [/^(piutang|ar)\b/, 'piutang'], [/^(stok|stock|menipis)\b/, 'stok'],
    [/^(utang|hutang|ap)\b/, 'utang'], [/^(kas|saldo|bank)\b/, 'kas'],
    [/^(omset|omzet|laba)\b/, 'omset'], [/^(ringkasan|info|semua|summary)\b/, 'ringkasan'],
    [/^(menu|bantuan|help|\?)\b/, 'menu'],
  ];
  for (const [re, cmd] of defs) { const m = low.match(re); if (m) return { cmd, rest: low.slice(m[0].length).trim() }; }
  if (!low) return { cmd: 'menu', rest: '' };
  return { cmd: null, rest: '' };
}

// tangani pesan yang BUKAN /start: cari toko yang terhubung ke chat ini lalu balas data yang diminta.
async function tgCmd(env, tok, chatId, text) {
  const { cmd, rest } = tgParseCmd(text);
  if (!cmd) return; // teks tak dikenal & chat sudah pernah dapat salam — diamkan saja, jangan spam
  const stores = await tgFindStores(env, chatId);
  if (!stores.length) { if (tok) await tgSend(tok, chatId, TG_NOTCONNECTED_TEXT); return; }
  if (cmd === 'menu') { if (tok) await tgSend(tok, chatId, TG_MENU_TEXT + (stores.length > 1 ? '\n\nToko terhubung: ' + stores.map((s) => s.name).join(', ') : '')); return; }
  let cand = stores;
  if (rest) { const f = stores.filter((s) => String(s.name || '').toLowerCase().includes(rest)); if (f.length) cand = f; else { if (tok) await tgSend(tok, chatId, 'Toko "' + rest + '" tidak ditemukan. Toko yang terhubung ke chat ini: ' + stores.map((s) => s.name).join(', ')); return; } }
  if (cand.length > 1) { if (tok) await tgSend(tok, chatId, 'Chat ini terhubung ke beberapa toko: ' + cand.map((s) => s.name).join(', ') + '.\nKetik ulang dengan nama toko, contoh: `' + cmd + ' ' + cand[0].name + '`'); return; }
  const store = cand[0];
  const row = await env.DB.prepare('SELECT t,data FROM snap WHERE store_id=?').bind(store.id).first().catch(() => null);
  if (!row || !row.data) { if (tok) await tgSend(tok, chatId, 'Data toko *' + store.name + '* belum tersinkron ke server. Buka aplikasi J-POS di HP toko sebentar, lalu coba lagi.'); return; }
  let S = {}; try { S = JSON.parse(row.data); } catch (e) { }
  const body = (TG_FMT[cmd] || fmtRingkasan)(S);
  if (tok) await tgSend(tok, chatId, body + '\n\n_Toko: ' + store.name + ' · data per ' + new Date(row.t).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + '_');
}

export async function tgSend(tok, chatId, text) {
  if (!tok || !chatId) return { ok: 0, e: 'belum terhubung' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok ? 1 : 0, e: j.description || (r.ok ? '' : 'HTTP ' + r.status) };
  } catch (e) { return { ok: 0, e: String(e.message || e).slice(0, 120) }; }
}
// kirim ke semua chat Telegram yang terhubung ke 1 toko; kembalikan satu ringkasan hasil
export async function tgSendAll(tok, chatIds, text) {
  const out = [];
  for (const id of (chatIds || []).slice(0, 5)) out.push(await tgSend(tok, id, text));
  const ok = out.some((x) => x.ok); return { ch: 'tg', ok: ok ? 1 : 0, e: ok ? '' : (out[0] && out[0].e) || 'gagal terkirim' };
}
// buat kode penghubung sekali-pakai untuk 1 toko (dipanggil dari tombol "Hubungkan Telegram" di Pengaturan)
export async function tgLinkCode(env, sid) {
  await env.DB.prepare('DELETE FROM tglink WHERE t<?').bind(Date.now() - TG_LINK_TTL).run().catch(() => {});
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await env.DB.prepare('INSERT OR REPLACE INTO tglink(code,sid,t) VALUES(?,?,?)').bind(code, sid, Date.now()).run();
  return code;
}
// webhook Telegram: tiap update (pesan masuk ke bot) dikirim Telegram ke sini.
// tok = token bot YANG MENERIMA update ini (bot bersama atau bot sendiri toko) — hanya dipakai utk
// membalas chat; tidak memengaruhi toko mana yang tersambung (itu ditentukan murni oleh kode /start).
export async function tgHook(env, b, tok, J) {
  try {
    const msg = b && b.message; const chatId = msg && msg.chat && msg.chat.id;
    if (!chatId) return J({ ok: 1 });
    const text = String(msg.text || '').trim();
    const m = text.match(/^\/start(?:@\w+)?\s*([A-Za-z0-9]{4,10})?/);
    if (!m) { await tgCmd(env, tok, chatId, text); return J({ ok: 1 }); }
    const code = m[1] ? m[1].toUpperCase() : '';
    if (!code) { if (tok) await tgSend(tok, chatId, TG_NOTCONNECTED_TEXT); return J({ ok: 1 }); }
    const row = await env.DB.prepare('SELECT sid,t FROM tglink WHERE code=?').bind(code).first();
    await env.DB.prepare('DELETE FROM tglink WHERE code=?').bind(code).run();
    if (!row || Date.now() - row.t > TG_LINK_TTL) { if (tok) await tgSend(tok, chatId, '⚠️ Kode sudah kedaluwarsa atau tidak valid. Ulangi dari Pengaturan di aplikasi untuk kode baru.'); return J({ ok: 1 }); }
    const s = await env.DB.prepare('SELECT id,name,rpt FROM stores WHERE id=?').bind(row.sid).first();
    if (!s) return J({ ok: 1 });
    let rc = {}; try { rc = s.rpt ? JSON.parse(s.rpt) : {}; } catch (e) { }
    const tg = Array.isArray(rc.tg) ? rc.tg.slice() : []; const cid = String(chatId);
    if (!tg.includes(cid)) tg.push(cid); rc.tg = tg.slice(-5);
    await env.DB.prepare('UPDATE stores SET rpt=? WHERE id=?').bind(JSON.stringify(rc), row.sid).run();
    if (tok) await tgSend(tok, chatId, `✅ Terhubung ke toko *${s.name}*.\nAnda akan menerima notifikasi piutang baru, pengingat jatuh tempo piutang/utang, dan laporan dari J-POS di chat ini.\n\nKetik *menu* untuk lihat perintah yang bisa Anda pakai di chat ini — misalnya tanya piutang atau stok menipis kapan saja.`);
    return J({ ok: 1 });
  } catch (e) { return J({ ok: 1 }); }
}
// daftarkan webhook ke Telegram (dipanggil otomatis saat Head Admin menyimpan token bot baru); juga
// daftarkan daftar perintah supaya muncul di menu "/" bawaan Telegram.
export async function tgSetWebhook(tok, url, secret) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${tok}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'] }) });
    const j = await r.json().catch(() => ({}));
    fetch(`https://api.telegram.org/bot${tok}/setMyCommands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commands: TG_COMMANDS }) }).catch(() => {});
    return { ok: r.ok && j.ok ? 1 : 0, e: j.description || '' };
  } catch (e) { return { ok: 0, e: String(e.message || e).slice(0, 120) }; }
}
