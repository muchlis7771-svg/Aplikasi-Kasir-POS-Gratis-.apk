'use strict';
/* ============ LAPANGAN: outlet yang sedang check-in, alarm lupa check-out, detail kunjungan ============ */
// semua check-in yang masih terbuka: cid -> [{u, t}]
// sales / dropping hanya melihat check-in miliknya; pemilik / admin / akuntan melihat semua petugas
function openCIAll(all) {
  const mgr = all || MGR(U.r), last = {}; for (const a of S.att) if ((a.k == 'visit' || a.k == 'vout') && (mgr || a.u == U.n) && (!last[a.u] || a.t >= last[a.u].t)) last[a.u] = a;
  const o = {}; for (const u in last) { const l = last[u]; if (l.k == 'visit' && Date.now() - l.t < CIMAX()) (o[l.cid] = o[l.cid] || []).push({ u, t: l.t }); }
  return o;
}
// pasangan check-in / check-out (kunjungan) dalam rentang waktu
function visitsIn(f, t, u) {
  const A = S.att.filter((a) => (a.k == 'visit' || a.k == 'vout') && (!u || a.u == u)).sort((a, b) => a.t - b.t), out = [];
  for (let i = 0; i < A.length; i++) {
    const v = A[i]; if (v.k != 'visit' || v.t < f || v.t > t) continue;
    let co = null; for (let j = i + 1; j < A.length; j++) { const x = A[j]; if (x.u != v.u) continue; if (x.k == 'vout') { co = x; } break; }
    const ord = S.sales.filter((s) => s.cu == v.cid && s.u == v.u && s.t >= v.t && s.t <= (co ? co.t : v.t + 12 * 36e5));
    out.push({ v, co, dur: co ? co.t - v.t : null, ord, tot: ord.reduce((a, s) => a + s.tot, 0) });
  }
  return out.reverse();
}
const durTxt = (ms) => { const m = Math.round(ms / 6e4); return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' j ' + (m % 60) + ' mnt'; };
const VDET = { d: 'today', u: '' };
function visitCard(mine) {
  if (!(pkgHas('cek') || can('outlet'))) return '';
  const [t0, t1] = todayR(), L = visitsIn(t0, t1, mine ? U.n : ''), ord = L.filter((x) => x.ord.length).length, open = Object.values(openCIAll()).flat().length;
  return `<div class="cd vcard"><div class="row" style="margin:0"><h3 style="margin:0">📍 Outlet dikunjungi hari ini</h3><button class="gh a" onclick="VDET.u='${mine ? esc(U.n) : ''}';visitDetail()">Detail</button></div>
<div class="kq" style="margin-top:8px"><div><small>Kunjungan</small><b>${L.length}</b></div><div><small>Dengan order</small><b>${ord}</b></div><div><small>Nilai order</small><b>${rp(L.reduce((a, x) => a + x.tot, 0))}</b></div>${mine ? '' : `<div><small>Sedang check-in</small><b class="gr">${open}</b></div>`}</div>
${L.slice(0, 3).map((x) => `<div class="row" style="margin:6px 0 0"><span><b>${esc(x.v.cn || '')}</b><br><small class="mu">${mine ? '' : esc(x.v.u) + ' · '}${hm(x.v.t)}${x.co ? '–' + hm(x.co.t) + ' (' + durTxt(x.dur) + ')' : (Date.now() - x.v.t > CIMAX() ? ' · <b class="rd">lupa check-out</b>' : ' · <b class="gr">sedang di lokasi</b>')}</small></span><small class="${x.ord.length ? 'gr' : 'mu'}">${x.ord.length ? '🧾 ' + rp(x.tot) : 'tanpa order'}</small></div>`).join('')}</div>`;
}
function visitDetail() {
  const R2 = { today: todayR(), kemarin: [todayR()[0] - 864e5, todayR()[0] - 1], d7: [Date.now() - 7 * 864e5, Date.now()], d30: [Date.now() - 30 * 864e5, Date.now()] }, mgr = MGR(U.r);
  const draw = () => {
    const [f, t] = R2[VDET.d], L = visitsIn(f, t, mgr ? VDET.u : U.n), names = [...new Set(S.att.filter((a) => a.k == 'visit').map((a) => a.u))].sort();
    const uniq = new Set(L.map((x) => x.v.cid)).size;
    m.querySelector('.dg').innerHTML = `<div class="row" style="margin:0"><h3 style="margin:0">📍 Detail kunjungan outlet</h3><button class="gh" id="vx">✕</button></div>
<div class="seg">${[['today', 'Hari ini'], ['kemarin', 'Kemarin'], ['d7', '7 hari'], ['d30', '30 hari']].map((x) => `<button class="${VDET.d == x[0] ? 'a' : ''}" data-d="${x[0]}">${x[1]}</button>`).join('')}</div>
${mgr ? `<select id="vu"><option value="">Semua sales / dropping</option>${names.map((n) => `<option ${VDET.u == n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
<div class="kq"><div><small>Kunjungan</small><b>${L.length}</b></div><div><small>Outlet berbeda</small><b>${uniq}</b></div><div><small>Dengan order</small><b>${L.filter((x) => x.ord.length).length}</b></div><div><small>Nilai order</small><b>${rp(L.reduce((a, x) => a + x.tot, 0))}</b></div></div>
<div class="ov" style="max-height:55vh"><table><tr><th>Outlet<th>Petugas<th>Masuk – keluar<th>Jarak<th class="n">Order</tr>${L.map((x) => `<tr><td><b>${esc(x.v.cn || '')}</b><br><small class="mu">${dstr(x.v.t)}</small><td>${esc(x.v.u)}<td>${hm(x.v.t)} – ${x.co ? hm(x.co.t) + '<br><small class="mu">' + durTxt(x.dur) + (x.co.fx && /luar/.test(x.co.fx) ? ' · <span class="rd">di luar radius</span>' : '') + '</small>' : (Date.now() - x.v.t > CIMAX() ? '<b class="rd">lupa check-out</b>' : '<b class="gr">sedang di lokasi</b>')}<td>${x.v.dist != null ? distStr(x.v.dist) : '-'}<td class="n">${x.ord.length ? '<b class="gr">' + rp(x.tot) + '</b><br><small class="mu">' + x.ord.length + ' faktur</small>' : '<small class="mu">tanpa order</small>'}</tr>`).join('') || '<tr><td colspan="5" class="mu">Belum ada kunjungan</tr>'}</table></div>`;
    $('#vx', m).onclick = () => m.close();
    $$('[data-d]', m).forEach((b) => (b.onclick = () => { VDET.d = b.dataset.d; draw(); }));
    const vu = $('#vu', m); if (vu) vu.onchange = () => { VDET.u = vu.value; draw(); };
  };
  const m = modal('', 'w'); draw();
}
/* ---------- alarm besar: sudah meninggalkan outlet tapi belum check-out ---------- */
let coT = null, coSn = 0, coRing = null;
function bigAlarm(title, text, btns) {
  const old = $('#bigal'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'bigal';
  el.innerHTML = `<div class="rg"><div class="rb">🚨</div><h2>${title}</h2><p>${text}</p>${btns.map((b, i) => `<button class="${i == 0 ? 'gbtn' : 'gh'}" data-i="${i}">${b[0]}</button>`).join('')}</div>`;
  document.body.appendChild(el);
  let ctx = null, it = null, vb = null;
  try { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); let f = 0; const beep = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f++ % 2 ? 740 : 1180; g.gain.value = 1; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25); }; ctx.resume && ctx.resume(); beep(); it = setInterval(beep, 420); } catch (e) { }
  try { if (navigator.vibrate) { navigator.vibrate([700, 200, 700]); vb = setInterval(() => navigator.vibrate([700, 200, 700]), 2200); } } catch (e) { }
  const stop = () => { clearInterval(it); clearInterval(vb); try { ctx && ctx.close(); } catch (e) { } el.remove(); coRing = null; };
  coRing = stop;
  $$('[data-i]', el).forEach((b) => (b.onclick = () => { stop(); btns[+b.dataset.i][1](); }));
}
async function coWatch() {
  try {
    if (!U || !S || !['sales', 'dropping'].includes(U.r) || coRing || document.hidden) return;
    const cur = openCI(U.n); if (!cur || Date.now() < coSn) return;
    const c = cust(cur.cid); if (!c || c.lat == null) return;
    const p = await getPos1(true); if (!p) return;
    const d = haversine(p.lat, p.lng, c.lat, c.lng), lim = Math.max(+S.set.coDist || 500, (p.acc || 0) * 1.5);
    if (d <= lim) return;
    bigAlarm('Belum check-out!', `Anda sudah <b>${distStr(d)}</b> dari <b>${esc(c.n)}</b> tapi belum check-out. Check-out dulu sebelum ke outlet berikutnya.`, [
      ['✓ Check-out sekarang', () => checkOut()],
      ['Saya masih di outlet (ingatkan 10 menit lagi)', () => { coSn = Date.now() + 6e5; }],
    ]);
  } catch (e) { }
}
setInterval(coWatch, 45000); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(coWatch, 2000); });
