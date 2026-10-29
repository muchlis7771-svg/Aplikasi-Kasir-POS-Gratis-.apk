'use strict';
/* ============ GUARD: jam tepercaya, GPS, selfie, check-in / check-out outlet ============
   Catatan jujur: ini membuat kecurangan SULIT dan TERLIHAT, bukan mustahil. Aplikasi web/APK tidak bisa
   mengunci jam Android. Yang dilakukan: stempel waktu dari SERVER, deteksi jam diubah, deteksi lokasi
   melompat, foto selfie berstempel, dan semua anomali dilaporkan ke pemilik (menu Audit). */
const FXN = { 'wajah-baru': 'Wajah acuan baru didaftarkan', ofl: 'Dikirim offline (jam belum terverifikasi)', mundur: 'Jam HP diputar mundur', jam: 'Jam HP beda dengan server', lompat: 'Lokasi melompat tak wajar', akur: 'GPS kurang akurat', luar: 'Check-out di luar radius', titik: 'Titik outlet dibuat saat check-in', tw: 'Jam diubah saat aplikasi dibuka', lokasi: 'Absen jauh dari lokasi toko' };
const fxTxt = (a) => [...new Set([...String(a.fx || '').split(','), ...String(a.fl || '').split(',')].filter(Boolean))].map((k) => FXN[k] || k);
const CIR = () => +S.set.cir || 3000;
const antiOn = () => pkgHas('anti') && !!S.srv; // anti-curang butuh server (jam tepercaya)

/* ---------- waktu server ---------- */
const TT = { srv: 0, pf: 0, ok: false };
async function timeSync() {
  if (!AP || !navigator.onLine) return null;
  try {
    const p0 = performance.now();
    const r = await fetch(AP + '/api/time', { cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }).then((x) => x.json());
    const rtt = performance.now() - p0; TT.srv = r.t + rtt / 2; TT.pf = performance.now(); TT.ok = true;
    return TT.srv;
  } catch (e) { return null; }
}
const trustNow = () => (TT.ok ? Math.round(TT.srv + (performance.now() - TT.pf)) : null);
function tmark(t) { try { const o = LS.get('jpos:lastT', 0); if (t > o) LS.set('jpos:lastT', t); } catch (e) { } }
const skTxt = (s) => { s = Math.abs(s); return s < 120 ? s + ' dtk' : s < 7200 ? Math.round(s / 60) + ' menit' : s < 172800 ? Math.round(s / 3600) + ' jam' : Math.round(s / 86400) + ' hari'; };
async function clockCheck(strict) {
  const s = await timeSync(), dev = Date.now();
  if (s != null) {
    const sk = Math.round((dev - trustNow()) / 1000);
    if (Math.abs(sk) > 120) return { ok: false, msg: 'Jam / tanggal HP tidak sesuai waktu server (selisih ' + skTxt(sk) + '). Aktifkan "Tanggal & waktu otomatis" di Pengaturan HP, lalu coba lagi.' };
    return { ok: true, on: 1, sk, t: trustNow(), fx: [] };
  }
  const fx = ['ofl'];
  if (dev < LS.get('jpos:lastT', 0) - 60000) return { ok: false, msg: 'Jam HP terdeteksi diputar mundur. Setel tanggal & waktu otomatis lalu coba lagi saat ada sinyal.' };
  if (TT.ok && Math.abs(dev - trustNow()) > 120000) return { ok: false, msg: 'Jam HP berubah sejak aplikasi dibuka. Setel tanggal & waktu otomatis.' };
  if (strict) return { ok: false, msg: 'Toko ini mewajibkan absen / check-in saat ONLINE agar jam diverifikasi server. Cari sinyal lalu coba lagi.' };
  return { ok: true, on: 0, sk: null, t: dev, fx };
}

/* ---------- pengawas jam saat aplikasi terbuka ---------- */
const TW = { d: Date.now(), p: performance.now(), n: 0 };
function twReset() { TW.d = Date.now(); TW.p = performance.now(); }
setInterval(() => {
  if (document.hidden) return twReset();
  const dd = Date.now() - TW.d, pp = performance.now() - TW.p;
  if (Math.abs(dd - pp) > 8000) {
    const sec = Math.round((dd - pp) / 1000); twReset(); TT.ok = false;
    if (U && S && S.srv) { toast('⚠ Jam HP berubah ' + (sec > 0 ? 'maju ' : 'mundur ') + skTxt(sec) + ' — dilaporkan ke pemilik', 6000); try { emit('sec', { w: 'jam', d: sec }); } catch (e) { } }
  }
}, 1000);
document.addEventListener('visibilitychange', twReset);

/* ---------- lokasi ---------- */
async function goodPos(need) {
  let best = null;
  for (let i = 0; i < 3; i++) { const p = await getPos(true); if (p && (!best || (p.acc || 1e9) < (best.acc || 1e9))) best = p; if (best && (best.acc || 1e9) <= need) break; await new Promise((r) => setTimeout(r, 1200)); }
  return best;
}
function lastPoint(u) {
  let b = null; for (const a of S.att) if (a.u == u && a.lat != null && (!b || a.t > b.t)) b = a;
  const l = S.locs && S.locs[u]; if (l && (!b || l.t > b.t)) b = l; return b;
}
function teleport(p, u) {
  const q = lastPoint(u); if (!q) return false; const dt = (Date.now() - q.t) / 1000; if (dt < 30 || dt > 21600) return false;
  const d = haversine(p.lat, p.lng, q.lat, q.lng); return d > 3000 && d / dt > 70; // >250 km/jam
}

/* ---------- selfie berstempel ---------- */
function selfie(label, facing) {
  facing = facing || 'user';
  return new Promise((res) => {
    const m = modal(`<h3>${facing == 'user' ? 'Foto selfie' : 'Foto bukti'}</h3><small class="mu">${facing == 'user' ? 'Wajah terlihat jelas. ' : ''}Foto diberi stempel waktu server & nama.</small><video id="sv" playsinline muted style="width:100%;border-radius:14px;background:#000;max-height:46vh;${facing == 'user' ? 'transform:scaleX(-1)' : ''}"></video><div class="fm2"><button class="pr" id="sk">📸 Ambil foto</button><button class="gh" id="sx">Batal</button></div>`);
    let stream = null, done = false; const end = (v) => { if (done) return; done = true; if (stream) stream.getTracks().forEach((t) => t.stop()); m.remove(); res(v); };
    $('#sx', m).onclick = () => end(null); m.onclose = () => end(null);
    (async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 480 } }, audio: false }); const v = $('#sv', m); v.srcObject = stream; await v.play(); }
      catch (e) { toast('Kamera depan tidak bisa dibuka: ' + (e.message || e), 4000); end(null); }
    })();
    $('#sk', m).onclick = () => {
      const v = $('#sv', m); if (!v.videoWidth) return toast('Kamera belum siap');
      const w = 220, h = Math.round(w * v.videoHeight / v.videoWidth), c = document.createElement('canvas'); c.width = w; c.height = h + 22; const x = c.getContext('2d');
      x.drawImage(v, 0, 0, w, h); x.fillStyle = '#000'; x.fillRect(0, h, w, 22); x.fillStyle = '#fff'; x.font = '11px sans-serif';
      x.fillText(String(label || '').slice(0, 34), 4, h + 15);
      try { const W = Math.min(640, v.videoWidth), b = document.createElement('canvas'); b.width = W; b.height = Math.round(W * v.videoHeight / v.videoWidth); b.getContext('2d').drawImage(v, 0, 0, b.width, b.height); selfie.big = b; } catch (e) { selfie.big = null; }
      end(c.toDataURL('image/jpeg', 0.5));
    };
  });
}

/* ---------- bukti: jam + lokasi (+ selfie) ---------- */
function alertBox(msg, title) { const m = modal(`<h3>${esc(title || 'Tidak bisa dilanjutkan')}</h3><p style="margin:6px 0">${esc(msg)}</p><button class="pr" id="ok">Mengerti</button>`); $('#ok', m).onclick = () => m.close(); }
async function proof(o = {}) {
  const anti = antiOn(), strict = o.strict ?? (anti && !S.set.aoff);
  const c = await clockCheck(strict); if (!c.ok) return { err: c.msg };
  const need = +S.set.gacc || 150;
  let p = null, fx = c.fx.slice();
  if (o.pos !== false) {
    p = await goodPos(need);
    if (!p) { if (o.needPos) return { err: 'Lokasi GPS tidak tersedia. Aktifkan GPS & izin lokasi untuk aplikasi.' }; }
    else {
      if ((p.acc || 1e9) > need) { if (o.needPos && anti) return { err: 'GPS kurang akurat (±' + Math.round(p.acc || 0) + ' m, batas ' + need + ' m). Pindah ke tempat terbuka lalu coba lagi.' }; fx.push('akur'); }
      if (teleport(p, U.n)) fx.push('lompat');
    }
  }
  let ph = null; if (o.selfie) { selfie.big = null; ph = await selfie(U.n + ' · ' + tstr(c.t) + (c.on ? '' : ' (offline)')); if (!ph) return { err: 'Selfie diperlukan untuk absen.' }; }
  return { t: c.t, on: c.on, sk: c.sk, fx, lat: p ? p.lat : null, lng: p ? p.lng : null, acc: p ? Math.round(p.acc || 0) : null, ph };
}
const fxs = (a) => a.join(',');

/* ---------- check-in / check-out outlet ---------- */
function openCI(u) {
  const v = S.att.filter((a) => a.u == u && (a.k == 'visit' || a.k == 'vout')).sort((a, b) => a.t - b.t), l = v[v.length - 1];
  return l && l.k == 'visit' && Date.now() - l.t < 12 * 36e5 ? l : null;
}
const ciNeeded = () => pkgHas('cek') && can('cek') && S.set.cireq !== false && (U.r == 'sales' || U.r == 'dropping');
async function checkIn(cid, why) {
  const c = cust(cid); if (!c) return;
  const cur = openCI(U.n);
  if (cur && cur.cid == cid) return toast('Sudah check-in di ' + c.n);
  if (cur) { if (!confirm('Anda masih check-in di ' + cur.cn + '. Check-out dulu dan pindah ke ' + c.n + '?')) return; const r = await checkOut(true); if (!r) return; }
  toast('Memverifikasi jam & lokasi…', 2000);
  const enforce = pkgHas('cek') && can('cek'), pr = await proof({ needPos: enforce });
  if (pr.err) return alertBox(pr.err);
  let dist = null; const fx = pr.fx.slice();
  if (c.lat == null) {
    if (enforce) {
      if (!can('outlet')) return alertBox(c.n + ' belum punya titik lokasi. Minta sales / admin menentukan titik outlet dulu.');
      if (pr.lat == null) return alertBox('Lokasi GPS diperlukan untuk menentukan titik outlet.');
      if (!confirm(c.n + ' belum punya titik lokasi.\nJadikan lokasi Anda sekarang sebagai titik outlet? (dicatat & dilaporkan ke pemilik)')) return;
      emit('cu', { c: { id: c.id, lat: pr.lat, lng: pr.lng } }); fx.push('titik'); dist = 0;
    }
  } else if (pr.lat != null) {
    dist = Math.round(haversine(pr.lat, pr.lng, c.lat, c.lng));
    if (enforce && dist > CIR()) return alertBox('Anda ' + distStr(dist) + ' dari titik ' + c.n + '. Check-in hanya bisa dalam radius ' + distStr(CIR()) + ' dari titik outlet.');
  }
  emit('visit', { cid, cn: c.n, lat: pr.lat, lng: pr.lng, acc: pr.acc, dist, why: why || '', on: pr.on, sk: pr.sk, fx: fxs(fx), note: '' }, pr.t);
  toast('Check-in ' + c.n + (dist != null ? ' · ' + distStr(dist) : '')); R(); return true;
}
async function checkOut(silent) {
  const cur = openCI(U.n); if (!cur) { toast('Belum check-in'); return false; }
  const c = cust(cur.cid) || { n: cur.cn, lat: null };
  toast('Memverifikasi jam & lokasi…', 2000);
  const enforce = pkgHas('cek') && can('cek'), pr = await proof({ needPos: false });
  if (pr.err) { alertBox(pr.err); return false; }
  const fx = pr.fx.slice(); let dist = null, note = '';
  if (pr.lat != null && c.lat != null) dist = Math.round(haversine(pr.lat, pr.lng, c.lat, c.lng));
  if (enforce && dist != null && dist > CIR()) { note = prompt('Anda ' + distStr(dist) + ' dari ' + c.n + ' (di luar radius ' + distStr(CIR()) + ').\nTulis alasan check-out di sini (dilaporkan ke pemilik):') || ''; if (!note.trim()) return false; fx.push('luar'); }
  emit('vout', { cid: cur.cid, cn: c.n, lat: pr.lat, lng: pr.lng, acc: pr.acc, dist, on: pr.on, sk: pr.sk, fx: fxs(fx), note }, pr.t);
  if (!silent) { toast('Check-out ' + c.n + ' · durasi ' + Math.max(1, Math.round((pr.t - cur.t) / 6e4)) + ' mnt'); R(); } return true;
}
function ciBar() {
  if (!(pkgHas('cek') && can('cek'))) return '';
  const cur = openCI(U.n);
  return cur ? `<div class="cd hero" style="padding:14px"><small>📍 Sedang check-in</small><h3 style="margin:2px 0">${esc(cur.cn)}</h3><small>Sejak ${hm(cur.t)} · ${cur.dist != null ? 'jarak ' + distStr(cur.dist) : 'tanpa jarak'}</small><div class="wrap" style="margin-top:8px"><button class="gh a" onclick="checkOut()">Check-out</button>${cust(cur.cid) && U.r == 'sales' ? `<button class="gh" onclick="orderFor('${cur.cid}')">Order</button>` : ''}</div></div>`
    : `<div class="cd" style="padding:12px"><small class="mu">📍 Belum check-in di outlet. ${U.r == 'sales' ? 'Check-in dulu di outlet (radius ' + distStr(CIR()) + ') sebelum membuat order.' : 'Check-in di outlet tujuan saat tiba.'}</small></div>`;
}

/* ---------- audit lapangan (pemilik) ---------- */
let AUD = { d: dkey(Date.now()), u: '' };
function audRows(day, u) {
  const rows = S.att.filter((a) => dkey(a.t) == day && (!u || a.u == u) && ['in', 'out', 'visit', 'vout'].includes(a.k)).sort((a, b) => a.t - b.t);
  return rows;
}
VW.aud = () => {
  const names = [...new Set(S.att.map((a) => a.u))].sort(), rows = audRows(AUD.d, AUD.u), flagged = rows.filter((a) => fxTxt(a).length || (a.dist != null && a.dist > CIR()));
  const KN = { in: ['🟢', 'Absen masuk'], out: ['🔴', 'Absen pulang'], visit: ['📍', 'Check-in'], vout: ['🏁', 'Check-out'] };
  const sec = (S.sec || []).filter((x) => dkey(x.t) == AUD.d && (!AUD.u || x.u == AUD.u));
  const ords = S.sales.filter((s) => dkey(s.t) == AUD.d && (!AUD.u || s.u == AUD.u) && s.r == 'sales');
  const noci = ords.filter((s) => !s.ci);
  return `<div class="cd hero"><small>Audit lapangan · ${dstr(new Date(AUD.d + 'T12:00:00').getTime())}</small><h2>${rows.length} catatan</h2><small>${flagged.length || sec.length ? '<b>⚠ ' + (flagged.length + sec.length) + ' mencurigakan</b>' : '✅ Tidak ada anomali'}${sec.length ? ' · ' + (sec.filter((x) => x.w != 'wajah').length ? sec.filter((x) => x.w != 'wajah').length + ' perubahan jam HP ' : '') + (sec.filter((x) => x.w == 'wajah').length ? sec.filter((x) => x.w == 'wajah').length + ' wajah tidak cocok' : '') : ''}</small></div>
<div class="cd"><div class="fm2"><input type="date" value="${AUD.d}" onchange="AUD.d=this.value;R()"><select onchange="AUD.u=this.value;R()"><option value="">Semua karyawan</option>${names.map((n) => `<option ${AUD.u == n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
${sec.filter((x) => x.w == 'wajah').length ? `<div class="cd"><h3>🙅 Wajah tidak cocok saat absen</h3>${sec.filter((x) => x.w == 'wajah').map((x) => `<div class="row"><span><b>${esc(x.u)}</b> · ${hm(x.t)}</span><span><b class="rd">skor ${x.d}</b> <button class="gh" style="padding:4px 8px" onclick="faceView('${esc(x.u)}')">Wajah acuan</button></span></div>`).join('')}<small class="mu">Seseorang mencoba absen atas nama karyawan ini, tetapi wajahnya tidak cocok (batas skor ${FACE_TH}).</small></div>` : ''}${sec.filter((x) => x.w != 'wajah').length ? `<div class="cd"><h3>🕵️ Jam HP diubah</h3>${sec.filter((x) => x.w != 'wajah').map((x) => `<div class="row"><span><b>${esc(x.u)}</b> · ${hm(x.t)}</span><b class="rd">${x.d > 0 ? '+' : ''}${skTxt(x.d)}</b></div>`).join('')}</div>` : ''}
<div class="cd"><h3>Garis waktu</h3>${rows.map((a) => { const f = fxTxt(a), far = a.dist != null && a.dist > CIR(); return `<div class="je"><small>${hm(a.t)} · ${KN[a.k][0]} <b>${esc(a.u)}</b> · ${KN[a.k][1]}${a.cn ? ' · ' + esc(a.cn) : ''}</small><p><span>${a.fm != null ? '🙂 Wajah cocok (' + a.fm + ') · ' : ''}${a.dist != null ? 'Jarak ' + distStr(a.dist) : a.lat != null ? 'GPS ✓' : '<span class="rd">tanpa GPS</span>'}${a.acc ? ' · ±' + a.acc + ' m' : ''}${a.note ? ' · ' + esc(a.note) : ''}</span>${a.ph ? `<img src="${a.ph}" alt="" style="width:44px;border-radius:8px">` : ''}</p>${f.length || far ? `<small class="rd">⚠ ${[...f, ...(far ? ['Di luar radius ' + distStr(CIR())] : [])].map(esc).join(' · ')}</small>` : ''}</div>`; }).join('') || '<small class="mu">Tidak ada catatan pada tanggal ini.</small>'}</div>
${(() => { const D = S.sales.flatMap((x) => (x.dl ? x.dl.log.filter((l) => l.st == 'selesai' && dkey(l.t) == AUD.d && (!AUD.u || l.u == AUD.u)).map((l) => [x, l]) : [])); return D.length ? `<div class="cd"><h3>🚚 Serah terima hari ini</h3>${D.map(([x, l]) => `<div class="row"><span>${hm(l.t)} · ${esc(l.u)} · ${esc(x.cn || '-')}</span><span>${l.lok ? lokTxt({ lok: l.lok, d: l.dist }) : '<small class="mu">tanpa cek titik</small>'}</span></div>`).join('')}</div>` : ''; })()}${ords.length ? `<div class="cd"><h3>Order sales hari ini</h3>${ords.map((s) => `<div class="row"><span>${hm(s.t)} · ${esc(s.u)} · ${esc(s.cn || '-')}</span><b class="${s.ci ? '' : 'rd'}">${rp(s.tot)}${s.ci ? '' : ' ⚠ tanpa check-in'}</b></div>`).join('')}${noci.length ? '<small class="rd">Order tanpa check-in dibuat dari versi/aturan lama.</small>' : ''}</div>` : ''}`;
};
