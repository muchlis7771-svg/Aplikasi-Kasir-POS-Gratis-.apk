'use strict';
/* ============ HEAD ADMIN → tab 💬 Chat: percakapan dari website promo + moderasi ulasan ============ */
const HAC = { list: null, un: 0, ul: null, err: '', t: 0 };
async function haChatLoad() {
  try { const [c, u] = await Promise.all([haApi('/api/admin/chat'), haApi('/api/admin/ulasan')]); HAC.list = c.list; HAC.un = c.unread; HAC.ul = u.list; HAC.err = ''; haChatBadge(); }
  catch (e) { if (e.status == 401) return haOut(); HAC.err = e.message; }
  if (MODE == 'ha' && HA.tab == 'chat' && !document.querySelector('.md')) R();
}
function haChatBadge() { const b = document.getElementById('hacb'); if (b) { b.style.display = HAC.un ? '' : 'none'; b.textContent = HAC.un; } }
setInterval(async () => { if (MODE != 'ha' || !HT || document.hidden) return; if (HA.tab == 'chat') return haChatLoad(); try { const c = await haApi('/api/admin/chat'); HAC.un = c.unread; haChatBadge(); } catch (e) { } }, 20000);
const cTm = (t) => { const d = new Date(t), n = new Date(); return (d.toDateString() == n.toDateString() ? '' : dstr(t) + ' ') + hm(t); };
function haChatView() {
  if (!HAC.list) { if (!HAC.err) haChatLoad(); return `<div class="cd ${HAC.err ? 'rd' : 'mu'}">${HAC.err ? esc(HAC.err) + '<br><button class="gh" onclick="HAC.err=\'\';R()">Coba lagi</button>' : 'Memuat…'}</div>`; }
  const ch = HAC.list.length ? HAC.list.map((c) => `<div class="row wsw" style="cursor:pointer" onclick="haChatOpen('${c.cid}')"><span style="min-width:0"><b>${esc(c.name || 'Pengunjung ' + c.cid.slice(0, 4))}</b>${c.un ? ` <span class="chip r">${c.un} baru</span>` : ''}<br><small class="mu" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62vw">${esc(c.last || '')}</small></span><small class="mu">${cTm(c.t)}</small></div>`).join('') : '<p class="mu">Belum ada percakapan. Pengunjung website memulai chat lewat tombol “Chat dengan admin”.</p>';
  const ul = (HAC.ul || []).length ? HAC.ul.map((r) => `<div class="wfq" style="grid-template-columns:1fr"><div><span class="chip ${r.ok ? 'g' : 'r'}">${r.ok ? 'Tampil' : 'Menunggu'}</span> <b>${esc(r.name)}</b>${r.store ? ' · ' + esc(r.store) : ''} <span style="color:#e8bf5a">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span><p style="margin:6px 0">${esc(r.txt)}</p><div class="wrap">${r.ok ? `<button class="gh" onclick="haUlAct(${r.id},'hide')">Sembunyikan</button>` : `<button class="gh pri" onclick="haUlAct(${r.id},'ok')">Setujui & tampilkan</button>`}<button class="gh d" onclick="haUlAct(${r.id},'del')">Hapus</button></div></div></div>`).join('') : '<p class="mu">Belum ada ulasan masuk.</p>';
  return `<div class="cd"><div class="row" style="margin:0"><h3 style="margin:0">💬 Chat website</h3><button class="gh" onclick="HAC.list=null;R()">⟳</button></div><small class="mu">Ketuk percakapan untuk membalas. Balasan muncul di chat pengunjung (diperbarui tiap beberapa detik). Percakapan dihapus otomatis setelah 60 hari.</small><div style="margin-top:8px">${ch}</div></div>
<div class="cd"><h3>⭐ Ulasan dari website</h3><small class="mu">Ulasan baru <b>tidak tampil</b> sampai Anda setujui.</small>${ul}</div>`;
}
async function haUlAct(id, act) { if (act == 'del' && !confirm('Hapus ulasan ini?')) return; try { await haApi('/api/admin/ulasan', { method: 'POST', body: JSON.stringify({ id, act }) }); HAC.list = null; R(); } catch (e) { toast(e.message); } }
async function haChatOpen(cid) {
  const m = modal('<div id="chb"><p class="mu">Memuat…</p></div>', 'w'); let lastN = -1, tm = 0, typing = false;
  const paint = async (force) => {
    if (!document.body.contains(m)) return clearTimeout(tm);
    try {
      const r = await haApi('/api/admin/chat?cid=' + cid), el = $('#chb', m); if (!el) return;
      if (r.m.length != lastN || force) {
        const keep = el.querySelector('textarea') ? el.querySelector('textarea').value : ''; lastN = r.m.length;
        const nm = (r.m.find((x) => x.who == 'v' && x.name) || {}).name || 'Pengunjung ' + cid.slice(0, 4);
        el.innerHTML = `<div class="row" style="margin:0"><b style="flex:1">${esc(nm)}</b><button class="gh d" data-d>Hapus</button><button class="gh" data-x>✕</button></div><div class="tkth" style="max-height:46vh;overflow:auto;display:flex;flex-direction:column;gap:6px;margin:10px 0">${r.m.map((x) => `<div style="align-self:${x.who == 'v' ? 'flex-start' : 'flex-end'};max-width:86%;padding:8px 12px;border-radius:12px;background:${x.who == 'v' ? 'var(--bg)' : x.who == 'a' ? '#c9a24a' : '#2a3558'};color:${x.who == 'a' ? '#1c1607' : 'inherit'};white-space:pre-wrap;word-break:break-word"><small style="display:block;opacity:.65;font-size:10.5px">${x.who == 'v' ? 'Pengunjung' : x.who == 'a' ? 'Anda' : 'Balasan otomatis'} · ${cTm(x.t)}</small>${esc(x.txt)}</div>`).join('')}</div><textarea id="crx" rows="2" maxlength="800" placeholder="Tulis balasan…"></textarea><div class="wrap" style="margin-top:8px"><button class="pr" data-s>Kirim balasan</button></div>`;
        const ta = el.querySelector('textarea'); ta.value = keep; ta.oninput = () => (typing = !!ta.value);
        el.querySelector('[data-x]').onclick = () => m.close();
        el.querySelector('[data-d]').onclick = async () => { if (!confirm('Hapus percakapan ini?')) return; try { await haApi('/api/admin/chat?cid=' + cid, { method: 'DELETE' }); m.close(); HAC.list = null; R(); } catch (e) { toast(e.message); } };
        el.querySelector('[data-s]').onclick = async () => { const t = ta.value.trim(); if (!t) return; try { await haApi('/api/admin/chat?cid=' + cid, { method: 'POST', body: JSON.stringify({ text: t }) }); ta.value = ''; typing = false; lastN = -1; paint(true); } catch (e) { toast(e.message); } };
        const th = el.querySelector('.tkth'); th.scrollTop = th.scrollHeight;
      }
    } catch (e) { if (e.status == 401) { m.close(); return haOut(); } }
    tm = setTimeout(paint, 5000);
  };
  m.onclose = () => { clearTimeout(tm); HAC.list = null; if (MODE == 'ha' && HA.tab == 'chat') R(); };
  paint(true);
}
