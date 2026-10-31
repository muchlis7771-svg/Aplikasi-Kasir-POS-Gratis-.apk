'use strict';
/* ============ PUSAT J-POS ============
   Head Admin: daftar toko per omzet / transaksi / pengguna, ringkasan tiap toko (stok, karyawan, laba, utang, piutang),
   pembayaran langganan otomatis, dan kotak komplain dari pemilik toko.
   Pemilik toko: perpanjang paket (transfer dengan kode unik → aktif otomatis) dan kirim komplain ke pengembang. */
const TIERNM = (t) => (typeof tierName == 'function' ? tierName(t) : t);
const ago2 = (t) => (typeof agoTxt == 'function' ? agoTxt(t) : t ? dstr(t) : '-');
const rpk = (v) => (v == null ? '<span class="mu">–</span>' : rp(Math.round(v)));

/* ---------- Head Admin: daftar toko dari KPI ---------- */
const HAL = {
  omzet: ['💰 Omzet per toko', (s) => +s.omzet || 0, (s) => s.omzet > 0, (s) => `<b>${rp(s.omzet)}</b><small>30 hari ${rp(s.om30 || 0)}</small>`],
  tx: ['🧾 Transaksi per toko', (s) => +s.tx || 0, (s) => s.tx > 0, (s) => `<b>${(+s.tx).toLocaleString('id-ID')} nota</b><small>30 hari ${(+s.tx30 || 0).toLocaleString('id-ID')}</small>`],
  users: ['👥 Pengguna per toko', (s) => +s.users || 0, () => 1, (s) => `<b>${s.users} orang</b><small>maks ${(HA.cfg && HA.cfg.pkg && HA.cfg.pkg[s.tier || 'high'] || {}).max || '-'}</small>`],
  all: ['🏪 Semua toko terdaftar', (s) => s.created || 0, () => 1, (s) => `<b>${esc(TIERNM(s.tier))}</b><small>daftar ${dstr(s.created)}</small>`],
};
function haList(k) {
  const H = HAL[k], L = (HA.stores || []).filter(H[2]).sort((a, b) => H[1](b) - H[1](a)), tot = L.reduce((a, s) => a + H[1](s), 0);
  const m = modal(`<div class="row" style="margin:0"><h3 style="margin:0">${H[0]}</h3><button class="gh" id="x">✕</button></div><small class="mu">${L.length} toko${k == 'omzet' ? ' · total ' + rp(tot) : k == 'tx' ? ' · total ' + tot.toLocaleString('id-ID') + ' nota' : ''} · ketuk toko untuk melihat ringkasan</small>
<div class="hal">${L.map((s, i) => `<button class="halr" data-s="${esc(s.id)}"><em>${i + 1}</em><span><b>${esc(s.name)}</b><small>${esc(s.owner || '')} · ${esc(TIERNM(s.tier))} · ${esc(s.id)}</small>${k == 'omzet' || k == 'tx' ? `<i class="halb"><i style="width:${tot ? (H[1](s) / H[1](L[0]) * 100).toFixed(1) : 0}%"></i></i>` : ''}</span><span class="r">${H[3](s)}</span></button>`).join('') || '<p class="mu">Belum ada.</p>'}</div>`, 'w');
  $('#x', m).onclick = () => m.close(); $$('[data-s]', m).forEach((b) => (b.onclick = () => { m.close(); haSum(b.dataset.s); }));
}
async function haSum(id) {
  const s = (HA.stores || []).find((x) => x.id == id); if (!s) return;
  const old = s.snt && Date.now() - s.snt > 3 * 864e5;
  const m = modal(`<div class="row" style="margin:0"><span><h3 style="margin:0">${esc(s.name)}</h3><small class="mu">${esc(s.owner || '')} · ${esc(s.phone || '')} · kode <b>${esc(s.id)}</b></small></span><button class="gh" id="x">✕</button></div>
<div class="wrap" style="margin:6px 0"><span class="chip">${esc(TIERNM(s.tier))}</span><span class="chip ${sState(s) == 'ok' ? 'g' : 'o'}">${esc(planName(s.plan))} · s/d ${s.exp ? dstr(s.exp) : '-'}</span><span class="chip">aktif terakhir ${ago2(s.last)}</span></div>
<div class="hsg">
<div><small>Omzet total</small><b>${rp(s.omzet || 0)}</b><small>30 hari ${rp(s.om30 || 0)} · ${(+s.tx30 || 0).toLocaleString('id-ID')} nota</small></div>
<div><small>Omzet bulan ini</small><b>${rpk(s.om)}</b><small>dari ringkasan HP toko</small></div>
<div><small>Laba bulan ini</small><b class="${s.lm < 0 ? 'rd' : 'gr'}">${rpk(s.lm)}</b><small>pendapatan − HPP − biaya</small></div>
<div><small>Nilai stok (HPP)</small><b>${rpk(s.sv)}</b><small>${s.nsku != null ? s.nsku + ' SKU · ' + (+s.qty || 0).toLocaleString('id-ID') + ' unit' : ''}${s.nlow ? ' · <span class="rd">' + s.nlow + ' menipis</span>' : ''}</small></div>
<div><small>Piutang pelanggan</small><b class="or">${rpk(s.ar)}</b><small>${s.od ? '<span class="rd">lewat tempo ' + rp(s.od) + '</span>' : 'tidak ada yang lewat tempo'}</small></div>
<div><small>Utang ke supplier</small><b class="rd">${rpk(s.ap)}</b><small>belum dibayar</small></div>
<div><small>Kas + bank</small><b>${s.kas == null ? '<span class="mu">–</span>' : rp((+s.kas || 0) + (+s.bank || 0))}</b><small>kas ${rpk(s.kas)} · bank ${rpk(s.bank)}</small></div>
<div><small>Karyawan</small><b>${s.users} orang</b><small id="hsr">memuat…</small></div>
</div>
<small class="${old ? 'or' : 'mu'}">${s.snt ? 'Ringkasan stok & keuangan dikirim HP toko ' + ago2(s.snt) + (old ? ' — toko belum membuka aplikasi beberapa hari' : '') : 'Toko belum mengirim ringkasan stok & keuangan (aplikasi toko belum diperbarui / belum dibuka).'}</small>
<div id="hstf" class="hstf"></div>
<div class="wrap" style="margin-top:8px"><button class="gh" id="mg">⚙️ Kelola toko</button>${s.phone ? `<a class="gh" target="_blank" rel="noopener" href="${esc(waLink(s.phone, 'Halo ' + (s.owner || '') + ', dari tim J-POS untuk toko ' + s.name + '.'))}">💬 WhatsApp</a>` : ''}</div>`, 'w');
  $('#x', m).onclick = () => m.close();
  $('#mg', m).onclick = () => { m.close(); haStore(id); };
  try {
    const r = await haApi('/api/admin/stores/' + id + '/staff'), by = {};
    for (const u of r.staff) by[u.role] = (by[u.role] || 0) + 1;
    const el = $('#hsr', m); if (el) el.textContent = Object.entries(by).map(([k, v]) => v + ' ' + (ROLE[k] || k).split(' ')[0]).join(' · ');
    const f = $('#hstf', m); if (f) f.innerHTML = r.staff.map((u) => `<span class="chip">${esc(u.name)} <small class="mu">${esc((ROLE[u.role] || u.role).split(' (')[0])}</small></span>`).join('');
  } catch (e) { }
}

/* ---------- Head Admin: pembayaran langganan ---------- */
let HAP = null;
async function haPayLoad() { try { const [c, i] = await Promise.all([haApi('/api/admin/pay'), haApi('/api/admin/inv')]); HAP = { c, inv: i.list }; } catch (e) { HAP = { err: e.message }; } if (MODE == 'ha' && HA.tab == 'bayar') R(); }
function haPayView() {
  if (!HAP) { haPayLoad(); return '<div class="cd mu">Memuat…</div>'; } if (HAP.err) return `<div class="cd rd">${esc(HAP.err)}</div>`;
  const c = HAP.c, wait = HAP.inv.filter((x) => x.status == 'tunggu'), paid = HAP.inv.filter((x) => x.status == 'lunas'), m30 = paid.filter((x) => x.paid_t > Date.now() - 30 * 864e5).reduce((a, x) => a + x.amount, 0);
  const IST = { tunggu: ['Menunggu transfer', 'o'], lunas: ['Lunas', 'g'], batal: ['Batal', ''], kedaluwarsa: ['Kedaluwarsa', ''] };
  return kpi([['Menunggu transfer', wait.length, rp(wait.reduce((a, x) => a + x.amount, 0))], ['Diterima 30 hari', rp(m30), paid.filter((x) => x.paid_t > Date.now() - 30 * 864e5).length + ' pembayaran'], ['Konfirmasi otomatis', c.moota || c.hook ? 'Aktif' : 'Belum', c.moota ? 'Moota' : c.hook ? 'webhook' : 'atur di bawah']])
    + `<div class="cd"><h3>🏦 Rekening penerima</h3><small class="mu">Tampil ke pemilik toko saat perpanjang. Satu baris per rekening.</small><textarea id="pb" rows="3" placeholder="BCA 1234567890 a.n. Muchlis&#10;BRI 0123-01-000000-50-1 a.n. Muchlis">${esc(c.bank)}</textarea>
<h3 style="margin-top:12px">⚡ Konfirmasi otomatis</h3><small class="mu">Tiap tagihan memakai <b>kode unik</b> (nominal + 1–999 rupiah). Hubungkan rekening Anda ke layanan cek mutasi bank seperti <b>Moota</b> (moota.co). Begitu transfer masuk dengan nominal yang sama persis, paket toko langsung diperpanjang otomatis.</small>
<label><small class="mu">Secret webhook Moota ${c.moota ? '<b class="gr">· tersimpan</b>' : ''}</small><input id="pm" placeholder="${c.moota ? 'tersimpan — isi untuk mengganti, “-” untuk menghapus' : 'secret token dari pengaturan webhook Moota'}" autocomplete="off"></label>
<small class="mu">URL webhook untuk Moota: <b class="sel">${esc(c.hookSig)}</b></small>
<small class="mu" style="display:block;margin-top:6px">Layanan lain (Mutasibank, dsb.) pakai URL berkunci:${c.hook ? ` <b class="sel">${esc(c.hook)}</b>` : ' belum dibuat'}</small>
<div class="wrap" style="margin-top:8px"><button class="pr" onclick="haPaySave()">Simpan</button><button class="gh" onclick="haPaySave(1)">${c.hook ? '↻ Ganti kunci URL' : '＋ Buat URL berkunci'}</button></div></div>
<div class="cd"><h3>🧾 Tagihan perpanjangan</h3>${HAP.inv.map((v) => `<div class="row kvrow"><span><b>${esc(v.sname || v.store_id)}</b> <span class="chip ${IST[v.status][1]}">${IST[v.status][0]}</span><br><small class="mu">${esc(TIERNM(v.tier))} · ${v.months} bln · dibuat ${dstr(v.t)} ${hm(v.t)}${v.paid_t ? ' · lunas ' + dstr(v.paid_t) + ' (' + esc(v.via || '') + ')' : ''}</small></span><span class="r"><b>${rp(v.amount)}</b>${v.status == 'tunggu' ? `<br><span class="wrap" style="flex-wrap:nowrap;justify-content:flex-end"><button class="gh d" onclick="haInv(${v.id},'batal')">Batal</button><button class="gh pri" onclick="haInv(${v.id},'lunas')">Tandai lunas</button></span>` : ''}</span></div>`).join('') || '<small class="mu">Belum ada tagihan.</small>'}</div>`;
}
async function haPaySave(nk) { try { await haApi('/api/admin/pay', { method: 'PUT', body: JSON.stringify({ bank: $('#pb').value, moota: $('#pm').value, newkey: nk ? 1 : 0 }) }); toast('Tersimpan'); HAP = null; R(); } catch (e) { toast(e.message); } }
async function haInv(id, op) { if (op == 'lunas' && !confirm('Tandai tagihan ini lunas dan perpanjang paket toko?')) return; try { await haApi('/api/admin/inv/' + id, { method: 'POST', body: JSON.stringify({ op }) }); toast(op == 'lunas' ? 'Lunas — paket toko diperpanjang' : 'Dibatalkan'); HAP = null; R(); haLoad(); } catch (e) { toast(e.message); } }

/* ---------- Head Admin: komplain ---------- */
let HAK = null, HAKF = '';
async function haTkLoad() { try { HAK = await haApi('/api/admin/tiket' + (HAKF ? '?st=' + HAKF : '')); } catch (e) { HAK = { err: e.message, list: [] }; } if (MODE == 'ha' && HA.tab == 'tiket') R(); haTkBadge(); }
function haTkBadge() { const b = $('#hatkb'); if (b && HAK) { b.textContent = HAK.unread || ''; b.style.display = HAK.unread ? '' : 'none'; } }
const TKST = { baru: ['Baru', 'o'], proses: ['Diproses', ''], selesai: ['Selesai', 'g'] };
function haTkView() {
  if (!HAK) { haTkLoad(); return '<div class="cd mu">Memuat…</div>'; }
  return `<div class="cd"><div class="seg" style="margin:0">${[['', 'Semua'], ['baru', 'Baru'], ['proses', 'Diproses'], ['selesai', 'Selesai']].map((x) => `<button class="${HAKF == x[0] ? 'a' : ''}" onclick="HAKF='${x[0]}';HAK=null;R()">${x[1]}</button>`).join('')}</div><small class="mu">${HAK.open || 0} terbuka · ${HAK.unread || 0} belum dibalas</small></div>`
    + (HAK.list.map((k) => `<div class="cd tkc ${k.uh ? 'nw' : ''}" onclick="haTk(${k.id})"><div class="row" style="margin:0"><b>${esc(k.sub)}</b><span class="chip ${TKST[k.st][1]}">${TKST[k.st][0]}</span></div><small class="mu">${esc(k.sname)} · ${esc(k.by)} (${esc(ROLE[k.role] || k.role)}) · ${esc((HAK.cats || {})[k.cat] || k.cat)} · ${ago2(k.upd)}${k.uh ? ' · <b class="or">menunggu balasan</b>' : ''}</small><small class="tkl">${esc((k.msgs[k.msgs.length - 1] || {}).tx || '')}</small></div>`).join('') || '<div class="cd mu c">Belum ada komplain 🎉</div>');
}
function tkThread(L) { return `<div class="tkth">${L.map((x) => `<div class="tkm ${x.f}"><small>${esc(x.n)} · ${dstr(x.t)} ${hm(x.t)}</small><div>${esc(x.tx || '').replace(/\n/g, '<br>')}</div>${x.img ? `<img src="${esc(x.img)}" alt="lampiran" onclick="window.open().document.write('<img src=&quot;'+this.src+'&quot; style=max-width:100%>')">` : ''}${x.dev ? `<small class="mu">📱 ${esc(x.dev)}</small>` : ''}</div>`).join('')}</div>`; }
function haTk(id) {
  const k = HAK.list.find((x) => x.id == id); if (!k) return;
  const m = modal(`<div class="row" style="margin:0"><span><h3 style="margin:0">${esc(k.sub)}</h3><small class="mu">${esc(k.sname)} (${esc(k.store_id)}) · ${esc(k.by)} · ${esc(TIERNM(k.tier))}${k.phone ? ' · ' + esc(k.phone) : ''}</small></span><button class="gh" id="x">✕</button></div>${tkThread(k.msgs)}
<textarea id="tr" rows="3" placeholder="Tulis balasan untuk pemilik toko…"></textarea><div class="fm2"><select id="ts">${Object.entries(TKST).map(([v, t]) => `<option value="${v}" ${k.st == v || (k.st == 'baru' && v == 'proses') ? 'selected' : ''}>${t[0]}</option>`).join('')}</select><button class="pr" id="ok">Kirim balasan</button></div>`, 'w');
  $('#x', m).onclick = () => m.close();
  $('#ok', m).onclick = async () => { try { await haApi('/api/admin/tiket/' + id, { method: 'POST', body: JSON.stringify({ tx: $('#tr', m).value, st: $('#ts', m).value }) }); m.close(); toast('Terkirim'); HAK = null; R(); } catch (e) { toast(e.message); } };
  const th = $('.tkth', m); if (th) th.scrollTop = th.scrollHeight;
}
setInterval(() => { if (typeof HT != 'undefined' && HT && MODE == 'ha' && !$('.md')) { if (HA.tab == 'tiket') haTkLoad(); else haApi('/api/admin/tiket?st=baru').then((r) => { HAK = HAK && HA.tab == 'tiket' ? HAK : { ...(HAK || {}), unread: r.unread, open: r.open, list: (HAK && HAK.list) || null }; if (!HAK.list) HAK = null; const b = $('#hatkb'); if (b) { b.textContent = r.unread || ''; b.style.display = r.unread ? '' : 'none'; } }).catch(() => { }); } }, 45000);

/* ---------- Pemilik toko: perpanjang paket ---------- */
let RNW = { tier: '', mo: 1 };
async function renewOpen() {
  if (!S || !S.srv) return toast('Perpanjangan butuh mode online');
  const m = modal('<div id="rnb"><p class="mu">Memuat…</p></div>', 'w');
  const load = async (body) => { try { const r = await api('/api/renew', body ? { method: 'POST', body: JSON.stringify(body) } : undefined); paint(r); if (r.inv.some((v) => v.status == 'lunas' && v.paid_t > Date.now() - 6e5)) sync().then(R); } catch (e) { toast(e.message); } };
  const paint = (r) => {
    const el = $('#rnb', m); if (!el) return; if (!RNW.tier) RNW.tier = r.pkg[S.tier] ? S.tier : 'standar';
    const pend = r.inv.find((v) => v.status == 'tunggu'), done = r.inv.find((v) => v.status == 'lunas' && v.paid_t > Date.now() - 864e5), tot = (r.pkg[RNW.tier] || {}).pr * RNW.mo;
    el.innerHTML = `<div class="row" style="margin:0"><h3 style="margin:0">💳 Perpanjang paket</h3><button class="gh" data-x>✕</button></div><small class="mu">Masa aktif sekarang: ${expTxt()} · paket ${esc(S.tn || S.tier)}</small>
${done ? `<div class="cd info" style="margin:8px 0"><b class="gr">✅ Pembayaran Rp${done.amount.toLocaleString('id-ID')} diterima</b><br><small>Paket ${esc(TIERNM(done.tier))} diperpanjang ${done.months} bulan.</small></div>` : ''}
${pend ? `<div class="rnpay"><small>Transfer <b>TEPAT</b> sejumlah</small><h2 class="sel">${rp(pend.amount)}</h2><small class="mu">termasuk kode unik <b>${pend.code}</b> agar terdeteksi otomatis · ${esc(TIERNM(pend.tier))} ${pend.months} bulan · berlaku s/d ${dstr(pend.t + r.ttl)} ${hm(pend.t + r.ttl)}</small>
<div class="rnbank">${esc(r.bank).split('\n').filter(Boolean).map((l) => `<b class="sel">${l}</b>`).join('') || '<span class="rd">Rekening belum diatur Head Admin</span>'}</div>
<small>${r.auto ? '⚡ Paket aktif <b>otomatis</b> dalam ±1–15 menit setelah transfer masuk. Halaman ini memeriksa sendiri.' : 'Setelah transfer, kirim bukti ke Head Admin agar paket segera diaktifkan.'}</small>
<div class="fm2" style="margin-top:8px"><button class="gh" data-cp="${pend.amount}">Salin nominal</button>${r.wa ? `<a class="gh" target="_blank" rel="noopener" href="${esc(waLink(r.wa, 'Halo, saya sudah transfer ' + rp(pend.amount) + ' untuk perpanjangan J-POS toko ' + S.name + ' (kode ' + SID + ').'))}">Kirim bukti via WA</a>` : '<span></span>'}</div><button class="gh d" data-cancel="${pend.id}" style="margin-top:6px">Batalkan tagihan</button></div>` : `
<div class="rntier">${Object.entries(r.pkg).map(([t, x]) => `<button class="${RNW.tier == t ? 'a' : ''}" data-t="${t}"><b>${esc(x.n)}</b><small>${rp(x.pr)}/bulan · ${x.max} pengguna</small></button>`).join('')}</div>
<small class="mu">Lama langganan</small><div class="seg">${r.months.map((n) => `<button class="${RNW.mo == n ? 'a' : ''}" data-m="${n}">${n} bulan</button>`).join('')}</div>
<div class="row"><span>Total</span><b style="font-size:18px">${rp(tot || 0)}</b></div>
${RNW.tier != S.tier ? `<small class="or">Paket berubah dari ${esc(S.tn || S.tier)} ke ${esc(r.pkg[RNW.tier].n)} setelah pembayaran diterima.</small>` : ''}
<button class="pr" data-go ${r.bank ? '' : 'disabled'}>Buat tagihan</button>${r.bank ? '' : '<small class="rd">Rekening pembayaran belum diatur pemilik aplikasi.</small>'}`}
<small class="mu" style="display:block;margin-top:8px">Riwayat: ${r.inv.filter((v) => v.status == 'lunas').map((v) => dstr(v.paid_t) + ' ' + rp(v.amount)).slice(0, 3).join(' · ') || 'belum ada'}</small>`;
    $('[data-x]', el).onclick = () => m.close();
    $$('[data-t]', el).forEach((b) => (b.onclick = () => { RNW.tier = b.dataset.t; paint(r); }));
    $$('[data-m]', el).forEach((b) => (b.onclick = () => { RNW.mo = +b.dataset.m; paint(r); }));
    const g = $('[data-go]', el); if (g) g.onclick = () => load({ tier: RNW.tier, months: RNW.mo });
    const c = $('[data-cancel]', el); if (c) c.onclick = () => { if (confirm('Batalkan tagihan ini?')) load({ cancel: +c.dataset.cancel }); };
    const cp = $('[data-cp]', el); if (cp) cp.onclick = () => copyTx(cp.dataset.cp);
    clearTimeout(m.tm); if (pend && document.body.contains(m)) m.tm = setTimeout(() => { if (document.body.contains(m)) load(); }, 20000);
  };
  load();
}

/* ---------- Pemilik / admin toko: komplain ke pengembang ---------- */
let TKD = null;
const imgSmall = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let q = .75, d = c.toDataURL('image/jpeg', q); while (d.length > 250000 && q > .3) { q -= .15; d = c.toDataURL('image/jpeg', q); } ok(d); }; im.onerror = no; im.src = r.result; }; r.onerror = no; r.readAsDataURL(f); });
async function tiketOpen(view) {
  if (!S || !S.srv) return toast('Komplain butuh mode online');
  const m = modal('<div id="tkb"><p class="mu">Memuat…</p></div>', 'w'); let img = '';
  const load = async (path, body) => { try { TKD = await api(path || '/api/tiket', body ? { method: 'POST', body: JSON.stringify(body) } : undefined); paint(); } catch (e) { toast(e.message); } };
  const paint = () => {
    const el = $('#tkb', m); if (!el) return; const k = view && TKD.list.find((x) => x.id == view);
    if (k) {
      el.innerHTML = `<div class="row" style="margin:0"><button class="gh" data-b>←</button><b style="flex:1;margin:0 8px">${esc(k.sub)}</b><span class="chip ${TKST[k.st][1]}">${TKST[k.st][0]}</span></div>${tkThread(k.msgs)}<textarea id="tx" rows="2" placeholder="Tambah pesan…"></textarea><div class="fm2"><label class="gh">📎 Foto<input type="file" accept="image/*" id="ti" hidden></label><button class="pr" data-s>Kirim</button></div><small class="mu" id="tim"></small>`;
      $('[data-b]', el).onclick = () => { view = 0; paint(); };
      $('[data-s]', el).onclick = () => load('/api/tiket/' + k.id, { tx: $('#tx', el).value, img });
      if (k.us) api('/api/tiket/' + k.id, { method: 'POST', body: JSON.stringify({ read: 1 }) }).catch(() => { });
      const th = $('.tkth', el); if (th) th.scrollTop = th.scrollHeight;
    } else {
      el.innerHTML = `<div class="row" style="margin:0"><h3 style="margin:0">🛟 Bantuan & komplain</h3><button class="gh" data-x>✕</button></div><small class="mu">Sampaikan kendala pemakaian aplikasi langsung ke tim pengembang J-POS. Balasan muncul di sini.</small>
<div class="cd" style="margin:8px 0;padding:12px"><select id="tc">${Object.entries(TKD.cats).map(([k2, v]) => `<option value="${k2}">${esc(v)}</option>`).join('')}</select><input id="ts" placeholder="Judul singkat (mis. struk tidak tercetak)" maxlength="90"><textarea id="tx" rows="4" placeholder="Ceritakan kendalanya: apa yang dilakukan, apa yang terjadi, di halaman mana…"></textarea><div class="fm2"><label class="gh">📎 Lampirkan screenshot<input type="file" accept="image/*" id="ti" hidden></label><button class="pr" data-n>Kirim komplain</button></div><small class="mu" id="tim"></small></div>
${TKD.list.map((x) => `<div class="cd tkc ${x.us ? 'nw' : ''}" data-v="${x.id}"><div class="row" style="margin:0"><b>${esc(x.sub)}</b><span class="chip ${TKST[x.st][1]}">${TKST[x.st][0]}</span></div><small class="mu">${esc(TKD.cats[x.cat] || x.cat)} · ${esc(x.by)} · ${ago2(x.upd)}${x.us ? ' · <b class="gr">ada balasan baru</b>' : ''}</small></div>`).join('')}`;
      $('[data-x]', el).onclick = () => m.close();
      $('[data-n]', el).onclick = () => { const tx = $('#tx', el).value.trim(); if (tx.length < 5) return toast('Tulis keluhan dulu'); load('/api/tiket', { cat: $('#tc', el).value, sub: $('#ts', el).value, tx, img, dev: (navigator.userAgent.match(/Android [\d.]+|Windows NT [\d.]+|iPhone OS [\d_]+|Mac OS X [\d_]+/) || [''])[0] + ' · J-POS ' + (typeof APPV != 'undefined' ? 'v' + APPV : '') + ' · ' + U.r }).then(() => { img = ''; toast('Komplain terkirim ke tim J-POS'); }); };
      $$('[data-v]', el).forEach((b) => (b.onclick = () => { view = +b.dataset.v; paint(); }));
    }
    const fi = $('#ti', el); if (fi) fi.onchange = async () => { try { img = await imgSmall(fi.files[0]); $('#tim', el).textContent = '📎 Foto terlampir (' + Math.round(img.length / 1024) + ' KB)'; } catch (e) { toast('Foto tidak bisa dibaca'); } };
  };
  load();
}
// tanda balasan baru dari tim J-POS
async function tiketPoll() { try { if (!U || !S || !S.srv || !['owner', 'admin'].includes(U.r) || !canNet()) return; const r = await api('/api/tiket'); TKD = r; const n = r.list.filter((x) => x.us).length; if (n && LS.get('jpos:tkn:' + SID, 0) != n) { LS.set('jpos:tkn:' + SID, n); toast('🛟 Ada balasan dari tim J-POS untuk komplain Anda', 5000); } } catch (e) { } }
setInterval(tiketPoll, 5 * 6e4); setTimeout(tiketPoll, 20000);
