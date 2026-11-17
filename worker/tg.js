// ============ NOTIFIKASI TELEGRAM (piutang, utang, laporan) ============
// Satu bot Telegram dipakai bersama semua toko (token diatur Head Admin, sekali saja).
// Tiap toko menghubungkan chat Telegram-nya sendiri lewat kode sekali-pakai (tombol "Hubungkan Telegram"
// di Pengaturan → link https://t.me/<bot>?start=<kode> → webhook ini mencatat chat_id ke toko yang benar).
// Tanpa ini, chat_id tiap toko tidak pernah tercampur — kode kedaluwarsa 15 menit & sekali pakai.
export const TGSCHEMA = ['CREATE TABLE IF NOT EXISTS tglink(code TEXT PRIMARY KEY,sid TEXT NOT NULL,t INTEGER NOT NULL)'];
const TG_LINK_TTL = 15 * 60000;

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
// webhook Telegram: tiap update (pesan masuk ke bot) dikirim Telegram ke sini
export async function tgHook(env, b, CFG, J) {
  try {
    const msg = b && b.message; const chatId = msg && msg.chat && msg.chat.id; const tok = CFG.tg_tok;
    if (!chatId) return J({ ok: 1 });
    const m = String(msg.text || '').trim().match(/^\/start(?:@\w+)?\s*([A-Za-z0-9]{4,10})?/);
    const code = m && m[1] ? m[1].toUpperCase() : '';
    if (!code) { if (tok) await tgSend(tok, chatId, 'Halo! Untuk menghubungkan chat ini ke toko Anda, buka aplikasi J-POS → Pengaturan → Laporan Otomatis → tombol "Hubungkan Telegram".'); return J({ ok: 1 }); }
    const row = await env.DB.prepare('SELECT sid,t FROM tglink WHERE code=?').bind(code).first();
    await env.DB.prepare('DELETE FROM tglink WHERE code=?').bind(code).run();
    if (!row || Date.now() - row.t > TG_LINK_TTL) { if (tok) await tgSend(tok, chatId, '⚠️ Kode sudah kedaluwarsa atau tidak valid. Ulangi dari Pengaturan di aplikasi untuk kode baru.'); return J({ ok: 1 }); }
    const s = await env.DB.prepare('SELECT id,name,rpt FROM stores WHERE id=?').bind(row.sid).first();
    if (!s) return J({ ok: 1 });
    let rc = {}; try { rc = s.rpt ? JSON.parse(s.rpt) : {}; } catch (e) { }
    const tg = Array.isArray(rc.tg) ? rc.tg.slice() : []; const cid = String(chatId);
    if (!tg.includes(cid)) tg.push(cid); rc.tg = tg.slice(-5);
    await env.DB.prepare('UPDATE stores SET rpt=? WHERE id=?').bind(JSON.stringify(rc), row.sid).run();
    if (tok) await tgSend(tok, chatId, `✅ Terhubung ke toko *${s.name}*.\nAnda akan menerima notifikasi piutang baru, pengingat jatuh tempo piutang/utang, dan laporan dari J-POS di chat ini.`);
    return J({ ok: 1 });
  } catch (e) { return J({ ok: 1 }); }
}
// daftarkan webhook ke Telegram (dipanggil otomatis saat Head Admin menyimpan token bot baru)
export async function tgSetWebhook(tok, url, secret) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${tok}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'] }) });
    const j = await r.json().catch(() => ({})); return { ok: r.ok && j.ok ? 1 : 0, e: j.description || '' };
  } catch (e) { return { ok: 0, e: String(e.message || e).slice(0, 120) }; }
}
