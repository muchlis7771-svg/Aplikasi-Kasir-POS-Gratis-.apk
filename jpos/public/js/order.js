'use strict';
/* ============ ANALISA ORDER: SKU apa yang harus dipesan ============
   Dihitung dari riwayat penjualan tiap SKU + kalender musim Indonesia (puasa, lebaran, Iduladha, Natal & tahun baru,
   tahun ajaran baru, Imlek). Rumus per SKU:
     1. Rata-rata jual / hari  = rata-rata berbobot 28 hari (50%), 29–90 hari (30%), 91–180 hari (20%)
     2. Tren                   = 28 hari terakhir ÷ 28 hari sebelumnya (dibatasi 0,7–1,5)
     3. Faktor musim           = dari riwayat SKU itu sendiri di musim yang sama tahun lalu (penjualan saat musim ÷ 60 hari sebelumnya);
                                 bila belum ada riwayat musim, pakai perkiraan menurut jenis barang (kata kunci nama / kategori)
     4. Kebutuhan              = rata-rata × tren × faktor musim × (waktu tunggu barang + lama stok yang ingin aman)
     5. Stok pengaman          = 1,28 × simpangan harian × √waktu tunggu  (tingkat layanan ±90%)
     6. Saran pesan            = kebutuhan + stok pengaman − stok sekarang − barang yang sudah dipesan (PO belum diterima) */
const D864 = 864e5;
// tanggal perkiraan (bisa bergeser ±1 hari sesuai sidang isbat)
const RAMADAN = [['2024-03-11', '2024-04-10'], ['2025-03-01', '2025-03-31'], ['2026-02-18', '2026-03-20'], ['2027-02-08', '2027-03-10'], ['2028-01-28', '2028-02-26'], ['2029-01-16', '2029-02-14']];
const ADHA = ['2024-06-17', '2025-06-06', '2026-05-27', '2027-05-16', '2028-05-05', '2029-04-24'], IMLEK = ['2024-02-10', '2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13'];
const dt0 = (k) => new Date(k + 'T00:00:00').getTime();
function seasons() {
  const L = [];
  for (const [a, e] of RAMADAN) { L.push({ id: 'puasa', n: 'Bulan puasa', a: dt0(a), b: dt0(e) - 11 * D864, e }); L.push({ id: 'lebaran', n: 'Persiapan lebaran', a: dt0(e) - 10 * D864, b: dt0(e) + 3 * D864, e }); }
  for (const k of ADHA) L.push({ id: 'adha', n: 'Iduladha', a: dt0(k) - 7 * D864, b: dt0(k) + 1 * D864 });
  for (const k of IMLEK) L.push({ id: 'imlek', n: 'Imlek', a: dt0(k) - 10 * D864, b: dt0(k) + 1 * D864 });
  for (let y = 2023; y <= 2029; y++) { L.push({ id: 'nataru', n: 'Natal & tahun baru', a: dt0(y + '-12-15'), b: dt0((y + 1) + '-01-02') }); L.push({ id: 'sekolah', n: 'Tahun ajaran baru', a: dt0(y + '-06-25'), b: dt0(y + '-07-20') }); }
  return L.sort((x, y) => x.a - y.a);
}
// perkiraan kenaikan menurut jenis barang bila SKU belum punya riwayat musim
const SKW = {
  puasa: [[/kurma/, 3], [/sirup|syrup|marjan|abc squash/, 2.2], [/sarung|mukena|peci|sajadah|koko/, 2.5], [/tepung|terigu|maizena|tapioka/, 1.6], [/gula/, 1.5], [/kental manis|skm|susu kental|santan|kara/, 1.6], [/margarin|mentega|blue band|butter/, 1.6], [/minyak goreng|minyak/, 1.4], [/kolang|cincau|agar|nata|jelly|jeli/, 1.8], [/teh|kopi/, 1.2], [/air mineral|aqua|le minerale/, 1.25], [/telur/, 1.3], [/mie|mi instan|indomie|sarimi/, 1.15]],
  lebaran: [[/biskuit|biscuit|wafer|kue|cookies|nastar|kaleng|khong guan|monde|roma/, 2.6], [/sirup|syrup|marjan/, 2.2], [/kacang|kuaci|emping|rengginang|keripik/, 2.0], [/permen|candy|cokelat|coklat/, 1.7], [/minuman|soft drink|soda|teh botol|teh kotak|fanta|sprite|coca/, 1.8], [/air mineral|aqua|gelas/, 1.6], [/sarung|mukena|peci|baju/, 2.0], [/tepung|gula|mentega|margarin|telur/, 1.6], [/amplop|angpao/, 3]],
  adha: [[/kecap|bumbu|saos|saus|merica|ketumbar|bawang/, 1.5], [/arang|tusuk sate/, 3], [/santan|kara|minyak/, 1.3]],
  imlek: [[/kue keranjang|jeruk|angpao|amplop/, 3], [/permen|biskuit|kaleng/, 1.15]],
  nataru: [[/biskuit|kue|kaleng|cokelat|coklat|permen/, 1.6], [/minuman|soda|sirup|soft drink/, 1.5], [/snack|keripik|kacang/, 1.4], [/terompet|kembang api/, 4]],
  sekolah: [[/buku|tulis|pulpen|pena|pensil|penghapus|penggaris|tas|seragam|sampul/, 2.6], [/susu kotak|susu uht|roti/, 1.2]],
};
const skwOf = (p, id) => { const t = (p.n + ' ' + (p.c || '') + ' ' + (p.b || '')).toLowerCase(); for (const [re, f] of SKW[id] || []) if (re.test(t)) return f; return 1; };
let ORD = { lt: 7, cv: 14, f: 'need', q: '' };
const dayIx = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / D864);
// penjualan harian per SKU (bersih retur)
function ordDaily() {
  const key = S.sales.length + '|' + (S.rtr || []).length; if (ordDaily.k == key) return ordDaily.v;
  const m = {}; for (const s of S.sales) { const d = dayIx(s.t); for (const i of s.L) { const q = i.q - (i.rq || 0); if (q <= 0) continue; ((m[i.id] = m[i.id] || {})[d] = (m[i.id][d] || 0) + q); } }
  ordDaily.k = key; ordDaily.v = m; return m;
}
function ordCalc(p, ctx) {
  const dm = ordDaily()[p.id] || {}, today = dayIx(Date.now()), sum = (a, b) => { let s = 0; for (let d = today - b; d < today - a; d++) s += dm[d] || 0; return s; };
  const first = Math.min(...Object.keys(dm).map(Number), today), age = Math.max(1, today - first);
  const w = [[0, 28, .5], [28, 90, .3], [90, 180, .2]].filter(([a]) => age > a);
  const ws = w.reduce((x, r) => x + r[2], 0) || 1, avg = w.reduce((x, [a, b, k]) => x + k * sum(a, Math.min(b, age)) / Math.max(1, Math.min(b, age) - a), 0) / ws;
  const r28 = sum(0, 28), p28 = sum(28, 56), trend = age > 50 && p28 > 0 ? Math.min(1.5, Math.max(.7, r28 / p28)) : 1;
  const ser = []; for (let d = today - Math.min(56, age); d < today; d++) ser.push(dm[d] || 0);
  const mu = ser.reduce((a, x) => a + x, 0) / Math.max(1, ser.length), sd = Math.sqrt(ser.reduce((a, x) => a + (x - mu) ** 2, 0) / Math.max(1, ser.length));
  // faktor musim untuk tiap hari di jendela pesanan
  const W = ctx.lt + ctx.cv, fac = new Map(), oc = {}; let fsum = 0;
  for (let i = 0; i < W; i++) {
    const t = Date.now() + i * D864, ev = ctx.S.filter((s) => t >= s.a && t <= s.b); let f = 1;
    for (const s of ev) { const own = s.id in oc ? oc[s.id] : (oc[s.id] = ordSeasonOwn(dm, s.id, ctx)), k = own ? own.f : skwOf(p, s.id); f = Math.max(f, k); if (!fac.has(s.id)) fac.set(s.id, { s, f: k, own: !!own, base: own ? own.yr : null }); }
    fsum += f;
  }
  const wf = fsum / W, base = avg * trend, need = base * wf * W, safety = 1.28 * sd * Math.sqrt(ctx.lt), onPO = ctx.po[p.id] || 0, stk = Math.max(0, p.st);
  const ord = Math.max(0, Math.ceil(need + safety - stk - onPO)), cover = base > 0 ? stk / (base * (wf > 1 ? wf : 1)) : Infinity;
  const rev90 = sum(0, 90) * (p.pr || 0);
  return { p, avg, trend, sd, wf, need, safety, onPO, stk, ord, cover, rev90, ev: [...fac.values()], age, r28, sold90: sum(0, 90) };
}
// faktor musim dari riwayat SKU sendiri: penjualan rata-rata saat musim terakhir yang tercatat ÷ 60 hari sebelum musim itu
function ordSeasonOwn(dm, id, ctx) {
  const past = ctx.S.filter((s) => s.id == id && s.b < Date.now()).reverse();
  for (const s of past) {
    const a = dayIx(s.a), b = dayIx(s.b); let x = 0, y = 0, any = 0; for (let d = a; d <= b; d++) { x += dm[d] || 0; if (dm[d]) any++; } for (let d = a - 60; d < a; d++) y += dm[d] || 0;
    if (any < 3 || y <= 0) continue; const f = (x / (b - a + 1)) / (y / 60); return { f: Math.min(4, Math.max(.6, f)), yr: new Date(s.a).getFullYear() };
  }
  return null;
}
function ordCtx() { const po = {}; for (const o of S.po || []) if (o.st == 'dipesan' || o.st == 'sebagian') for (const l of o.L) po[l.p] = (po[l.p] || 0) + Math.max(0, l.q - (l.rq || 0)); return { S: seasons(), po, lt: ORD.lt, cv: ORD.cv }; }
function ordAll() { const ctx = ordCtx(), R0 = actProds().map((p) => ordCalc(p, ctx)), tot = R0.reduce((a, r) => a + r.rev90, 0); let c = 0; R0.slice().sort((a, b) => b.rev90 - a.rev90).forEach((r) => { c += r.rev90; r.abc = !tot || r.rev90 <= 0 ? 'C' : c / tot <= .8 ? 'A' : c / tot <= .95 ? 'B' : 'C'; }); return { R: R0, ctx }; }
const onf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('id-ID');
function ordWhy(r, ctx) {
  const u = r.p.u || 'pcs', W = ctx.lt + ctx.cv, out = [];
  if (r.sold90 <= 0 && !r.ev.length) return 'Belum ada penjualan 90 hari terakhir — tidak perlu dipesan kecuali ada pesanan khusus.';
  out.push(`Rata-rata terjual <b>${onf(r.avg)} ${esc(u)}/hari</b>${r.age < 60 ? ' (riwayat baru ' + r.age + ' hari)' : ''}`);
  if (Math.abs(r.trend - 1) >= .08) out.push(`tren 4 minggu terakhir <b class="${r.trend > 1 ? 'gr' : 'rd'}">${r.trend > 1 ? 'naik' : 'turun'} ${Math.round(Math.abs(r.trend - 1) * 100)}%</b>`);
  for (const e of r.ev) if (e.f > 1.04 || e.own) out.push(`<b>${esc(e.s.n)}</b> (${dstr(e.s.a)}–${dstr(e.s.b)}): ${e.own ? 'tahun ' + e.base + ' penjualan SKU ini' : 'barang sejenis biasanya'} <b class="${e.f >= 1 ? 'gr' : 'rd'}">${e.f >= 1 ? 'naik' : 'turun'} ${onf(e.f, 1)}×</b>`);
  out.push(`kebutuhan ${W} hari (tunggu barang ${ctx.lt} + stok aman ${ctx.cv}) ≈ <b>${onf(r.need, 0)}</b> + cadangan ${onf(r.safety, 0)}`);
  out.push(`stok ${onf(r.stk, 0)}${r.onPO ? ' + dalam PO ' + onf(r.onPO, 0) : ''}`);
  return out.join(' · ') + (r.ord ? ` → <b>pesan ${onf(r.ord, 0)} ${esc(u)}</b>.` : ' → <b class="gr">stok cukup</b>.');
}
function ordView() {
  const { R: all, ctx } = ordAll(), now = Date.now(), up = ctx.S.filter((s) => s.b >= now && s.a <= now + 120 * D864).slice(0, 4), q = ORD.q.toLowerCase();
  let L = all.filter((r) => !q || (r.p.n + ' ' + (r.p.sku || '') + ' ' + (r.p.kd || '')).toLowerCase().includes(q));
  L = ORD.f == 'need' ? L.filter((r) => r.ord > 0) : ORD.f == 'mus' ? L.filter((r) => r.ev.some((e) => e.f > 1.04)) : ORD.f == 'mati' ? L.filter((r) => r.sold90 <= 0 && r.stk > 0) : L;
  L.sort((a, b) => (b.ord > 0) - (a.ord > 0) || a.cover - b.cover || b.rev90 - a.rev90);
  const need = all.filter((r) => r.ord > 0), val = need.reduce((a, r) => a + r.ord * (r.p.co || 0), 0), urg = need.filter((r) => r.cover <= ctx.lt).length;
  const lt = (v, t) => `<button class="${ORD.lt == v[0] && ORD.cv == v[1] ? 'a' : ''}" onclick="ORD.lt=${v[0]};ORD.cv=${v[1]};R()">${t}</button>`;
  const toEid = (() => { const r = RAMADAN.map((x) => x[1]).find((e) => dt0(e) > now); return r ? Math.ceil((dt0(r) - now) / D864) : 0; })();
  return `<div class="cd ordh"><div class="row" style="margin:0"><h3 style="margin:0">🧠 Analisa order</h3><small class="mu">dari riwayat & musim</small></div>
<div class="osea">${up.map((s) => { const d = Math.ceil((s.a - now) / D864); return `<span class="${d <= 0 ? 'on' : ''}"><b>${esc(s.n)}</b><small>${d <= 0 ? 'sedang berlangsung' : d + ' hari lagi'} · ${dstr(s.a)}</small></span>`; }).join('') || '<small class="mu">Tidak ada musim besar dalam 4 bulan ke depan.</small>'}</div>
<small class="mu">Rentang pesanan (waktu tunggu barang + lama stok aman)</small><div class="seg">${lt([3, 7], '10 hari')}${lt([7, 14], '3 minggu')}${lt([7, 30], '5 minggu')}${toEid > 30 && toEid < 200 ? `<button class="${ORD.cv == toEid - 7 ? 'a' : ''}" onclick="ORD.lt=7;ORD.cv=${toEid - 7};R()">s.d. lebaran</button>` : ''}</div></div>
<div class="kp"><div class="cd k0"><small>SKU perlu dipesan</small><h2>${need.length}</h2><small>${urg} habis sebelum barang datang</small></div><div class="cd k1"><small>Perkiraan modal order</small><h2>${rp(val)}</h2><small>harga beli (HPP)</small></div></div>
<div class="cd"><input placeholder="Cari SKU / nama produk" value="${esc(ORD.q)}" onchange="ORD.q=this.value;R()"><div class="seg">${[['need', 'Perlu order'], ['mus', 'Musiman'], ['all', 'Semua'], ['mati', 'Tidak laku']].map((x) => `<button class="${ORD.f == x[0] ? 'a' : ''}" onclick="ORD.f='${x[0]}';R()">${x[1]}</button>`).join('')}</div>${need.length ? `<button class="pr" style="margin-top:8px" onclick="poForm(null,'','ana')">Buat PO dari ${need.length} saran</button>` : ''}</div>
${L.slice(0, 120).map((r) => `<div class="cd ordc"><div class="row" style="margin:0"><span><b>${esc(r.p.n)}</b> <span class="chip ${r.abc == 'A' ? 'g' : r.abc == 'B' ? '' : 'o'}">Kelas ${r.abc}</span>${r.ev.some((e) => e.f > 1.04) ? ' <span class="chip omus">🌙 musim</span>' : ''}<br><small class="mu">${esc(r.p.sku || r.p.kd || '')}</small></span><span class="r"><small class="mu">Saran pesan</small><br><b class="${r.ord ? 'or' : 'gr'}" style="font-size:18px">${r.ord ? onf(r.ord, 0) : '—'}</b></span></div>
<div class="pnums"><span><small>Jual / hari</small><b>${onf(r.avg * r.trend)}</b></span><span><small>Stok</small><b>${onf(r.stk, 0)}</b></span><span><small>Cukup untuk</small><b class="${r.cover <= ctx.lt ? 'rd' : r.cover <= ctx.lt + ctx.cv ? 'or' : 'gr'}">${r.cover == Infinity ? '∞' : onf(r.cover, 0) + ' hari'}</b></span><span><small>Faktor musim</small><b>${onf(r.wf, 2)}×</b></span></div>
<small class="owhy">${ordWhy(r, ctx)}</small></div>`).join('') || '<div class="cd gr">✅ Tidak ada SKU yang perlu dipesan untuk rentang ini.</div>'}
<details class="cd"><summary><b>Cara menghitung</b></summary><small class="mu">1) Rata-rata jual per hari diberi bobot: 28 hari terakhir 50%, hari ke-29–90 30%, hari ke-91–180 20%. 2) Tren = penjualan 4 minggu terakhir dibanding 4 minggu sebelumnya (dibatasi 0,7–1,5×). 3) Faktor musim: bila SKU sudah pernah terjual di musim yang sama (mis. puasa tahun lalu), kenaikannya dihitung dari data toko sendiri; bila belum, dipakai perkiraan menurut jenis barang (sirup, biskuit kaleng, kurma, sarung, gula, tepung, dll). 4) Kebutuhan = rata-rata × tren × faktor musim × jumlah hari rentang. 5) Ditambah stok pengaman agar tidak kehabisan saat penjualan naik-turun (±90% aman). 6) Dikurangi stok sekarang dan barang yang sudah dipesan tapi belum diterima. Kelas A = SKU penyumbang 80% omzet (jangan sampai kosong), B = 15% berikutnya, C = sisanya. Tanggal puasa & lebaran adalah perkiraan dan bisa bergeser ±1 hari.</small></details>`;
}
function ordPOLines() { return ordAll().R.filter((r) => r.ord > 0).map((r) => ({ p: r.p.id, n: r.p.n, q: r.ord, c: r.p.co, rq: 0 })); }
