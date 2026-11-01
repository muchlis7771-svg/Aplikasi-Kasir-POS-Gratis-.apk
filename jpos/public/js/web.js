'use strict';
/* ============ HEAD ADMIN → tab 🌐 Web ============
   Kontrol website promo J-POS dari dashboard: unggah APK (diunduh pengunjung dari website), teks & bagian yang tampil,
   pengumuman, tutup/buka form pesanan, mode pemeliharaan, FAQ, dan statistik kunjungan. */
const HAW = { site: null, apk: null, stats: null, busy: false, err: '' };
const WCH = 360 * 1024;
async function haWebLoad() {
  try {
    const [s, a, st] = await Promise.all([haApi('/api/admin/site'), haApi('/api/admin/apk'), haApi('/api/admin/site/stats')]);
    HAW.site = s.site; HAW.def = s.def; HAW.apk = a; HAW.stats = st.days; HAW.err = '';
  } catch (e) { if (e.status == 401) return haOut(); HAW.err = e.message; }
  if (MODE == 'ha' && HA.tab == 'web' && !HAW.busy && !document.querySelector('.md')) R();
}
const wTxt = (id, v, ph, ml) => `<input id="${id}" value="${esc(v || '')}" ${ph ? `placeholder="${esc(ph)}"` : ''} ${ml ? `maxlength="${ml}"` : ''}>`;
const wChk = (id, on, lb) => `<label class="row wsw"><span>${lb}</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''} style="width:22px;height:22px;flex:none"></label>`;
function haWebView() {
  if (!HAW.site) { if (!HAW.err) haWebLoad(); return `<div class="cd ${HAW.err ? 'rd' : 'mu'}">${HAW.err ? esc(HAW.err) + '<br><button class="gh" onclick="HAW.err=\'\';R()">Coba lagi</button>' : 'Memuat…'}</div>`; }
  const S = HAW.site, A = HAW.apk || {}, base = (typeof AP == 'string' && AP) || location.origin, st = HAW.stats || [];
  const tot = (k) => st.reduce((a, d) => a + (d[k] || 0), 0);
  const apkCard = `<div class="cd"><div class="row" style="margin:0"><h3 style="margin:0">📲 Aplikasi di website</h3>${A.has ? '<span class="chip g">Tersedia</span>' : '<span class="chip">Belum ada</span>'}</div>
<small class="mu">File APK yang Anda unggah di sini muncul sebagai tombol <b>⬇ Unduh aplikasi Android</b> di website promo. Hanya satu versi aktif; unggahan baru menggantikan yang lama.</small>
${A.has ? `<div class="hsg" style="margin:10px 0"><div><small>Nama</small><b style="font-size:13px;overflow-wrap:anywhere">${esc(A.name)}</b></div><div><small>Ukuran</small><b>${(A.size / 1048576).toFixed(1)} MB</b></div><div><small>Diunggah</small><b style="font-size:13px">${dstr(A.t)} ${hm(A.t)}</b></div><div><small>SHA-256</small><b style="font-size:12px">${esc(A.sha.slice(0, 12))}…</b></div></div>${A.note ? `<small class="mu">Catatan: ${esc(A.note)}</small>` : ''}` : ''}
<div class="wup"><label class="gh wfl"><input type="file" id="wfile" accept=".apk,application/vnd.android.package-archive" hidden onchange="$('#wfn').textContent=this.files[0]?this.files[0].name+' · '+(this.files[0].size/1048576).toFixed(1)+' MB':'Belum ada file dipilih'">📂 Pilih file APK</label><small class="mu" id="wfn">Belum ada file dipilih</small>
<input id="wnm" placeholder="Nama versi (mis. J-POS v1.49)" maxlength="60" value="${esc(A.has ? '' : '')}"><input id="wnt" placeholder="Catatan singkat (opsional)" maxlength="200">
<div class="wprog" id="wpw" hidden><i id="wpb"></i></div><small id="wps" class="mu"></small>
<div class="wrap"><button class="pr" id="wub" onclick="haApkUp()" ${HAW.busy ? 'disabled' : ''}>⬆ Unggah ke website</button>${A.has ? '<button class="gh d" onclick="haApkDel()">🗑 Hapus dari website</button>' : ''}</div></div>
<small class="mu">Pakai APK rilis yang sudah <b>ditandatangani</b> (bukan APK debug). Maks. ±120 MB. File diperiksa keutuhannya (SHA-256) saat diunduh pengunjung.</small></div>`;
  const faq = (S.faq || []).map((f, i) => `<div class="wfq"><input class="fq" value="${esc(f.q)}" placeholder="Pertanyaan" maxlength="140"><textarea class="fa" rows="2" placeholder="Jawaban" maxlength="600">${esc(f.a)}</textarea><button class="gh d" onclick="haWebFaq(${i})" aria-label="Hapus">✕</button></div>`).join('');
  const ctl = `<div class="cd"><h3>🎛️ Kontrol website</h3><small class="mu">Perubahan langsung tampil di website setelah disimpan (maks. ±30 detik).</small>
<h4>📣 Pengumuman di atas halaman</h4>${wChk('wbo', S.banner.on, 'Tampilkan pengumuman')}${wTxt('wbt', S.banner.text, 'Teks pengumuman (mis. Diskon 20% bulan ini)', 160)}${wTxt('wbl', S.banner.link, 'Tautan (opsional): https://… atau #pesan', 200)}
<h4>✏️ Teks utama</h4>${wTxt('wey', S.eyebrow, 'Label kecil di atas judul', 60)}${wTxt('wti', S.title, 'Judul', 90)}${wTxt('wgo', S.gold, 'Lanjutan judul (berwarna emas)', 90)}<textarea id="wld" rows="3" maxlength="320" placeholder="Kalimat pengantar">${esc(S.lead)}</textarea>${wTxt('wct', S.cta, 'Teks tombol utama', 30)}
<h4>👁️ Bagian yang ditampilkan</h4>${[['fitur', 'Fitur'], ['tampilan', 'Tampilan aplikasi'], ['paket', 'Paket & harga'], ['langkah', 'Cara mulai'], ['tanya', 'Tanya jawab'], ['pesan', 'Formulir pemesanan'], ['apk', 'Tombol unduh aplikasi']].map(([k, l]) => wChk('wsh_' + k, S.show[k], l)).join('')}
<h4>🛒 Pemesanan</h4>${wChk('wop', S.order.open, 'Terima pesanan (formulir terbuka)')}${wTxt('wom', S.order.closedMsg, 'Pesan saat ditutup', 200)}
<h4>🛠 Mode pemeliharaan</h4>${wChk('wmo', S.maint.on, 'Aktifkan (pengunjung melihat pesan di bawah, bukan website)')}${wTxt('wmm', S.maint.msg, 'Pesan pemeliharaan', 200)}
<h4>📞 Kontak</h4>${wTxt('wwa', S.wa, 'No. WhatsApp khusus website (kosong = pakai nomor Head Admin)', 16)}${wTxt('wft', S.foot, 'Teks tambahan di bagian bawah', 160)}
<h4>❓ Tanya jawab (FAQ)</h4><small class="mu">Kosongkan semua untuk memakai FAQ bawaan.</small>${faq}<button class="gh" onclick="haWebFaq(-1)">+ Tambah pertanyaan</button>
<div class="wrap" style="margin-top:14px"><button class="pr" onclick="haWebSave()">💾 Simpan & terapkan</button><button class="gh" onclick="haWebReset()">↺ Kembalikan ke bawaan</button></div></div>`;
  const statCard = `<div class="cd"><h3>📈 Statistik website · 14 hari</h3>${kpi([['Kunjungan', tot('v')], ['Unduhan APK', tot('dl')], ['Pesanan masuk', tot('o')]])}
<small class="mu">Kunjungan per hari</small>${vbars(st.map((d) => ({ l: d.d.slice(8), v: d.v })), (v) => v)}</div>`;
  const links = `<div class="cd"><h3>🔗 Tautan</h3><div class="wrap"><a class="gh pri" target="_blank" rel="noopener" href="${esc(base)}/promo/">Buka website</a><a class="gh" target="_blank" rel="noopener" href="${esc(base)}/promo/admin.html">Halaman admin web</a><button class="gh" onclick="copyTx('${esc(base)}/termux')">Salin link tetap Termux</button><button class="gh" onclick="copyTx('${esc(base)}/promo/')">Salin link website</button></div>
<small class="mu">Harga paket diatur di tab <b>Toko</b> (kartu “Harga paket langganan”). Pesanan masuk di tab <b>Pesanan</b>.</small></div>`;
  return apkCard + ctl + statCard + links;
}
// ---- baca isian form → HAW.site ----
function haWebCollect() {
  const v = (id) => ($('#' + id) || {}).value || '', c = (id) => !!($('#' + id) || {}).checked, S = HAW.site; if (!$('#wti')) return;
  S.banner = { on: c('wbo'), text: v('wbt').trim(), link: v('wbl').trim() }; S.eyebrow = v('wey').trim(); S.title = v('wti').trim(); S.gold = v('wgo').trim(); S.lead = v('wld').trim(); S.cta = v('wct').trim();
  for (const k of Object.keys(S.show)) S.show[k] = c('wsh_' + k);
  S.order = { open: c('wop'), closedMsg: v('wom').trim() }; S.maint = { on: c('wmo'), msg: v('wmm').trim() }; S.wa = v('wwa').trim(); S.foot = v('wft').trim();
  S.faq = $$('.wfq').map((r) => ({ q: ($('.fq', r) || {}).value || '', a: ($('.fa', r) || {}).value || '' }));
}
function haWebFaq(i) { haWebCollect(); const S = HAW.site; if (i < 0) { if (S.faq.length >= 12) return toast('Maksimal 12 pertanyaan'); S.faq.push({ q: '', a: '' }); } else S.faq.splice(i, 1); R(); }
async function haWebSave() {
  haWebCollect(); const S = HAW.site; S.faq = S.faq.filter((f) => f.q.trim() && f.a.trim());
  if (!S.title) return toast('Judul tidak boleh kosong');
  try { const r = await haApi('/api/admin/site', { method: 'PUT', body: JSON.stringify(S) }); HAW.site = r.site; toast('Tersimpan — website diperbarui'); R(); } catch (e) { toast(e.message); }
}
async function haWebReset() { if (!confirm('Kembalikan semua teks & pengaturan website ke bawaan?')) return; try { const r = await haApi('/api/admin/site', { method: 'DELETE' }); HAW.site = r.site; toast('Dikembalikan ke bawaan'); R(); } catch (e) { toast(e.message); } }
// ---- unggah APK (dipecah ±360 KB, dikirim 3 paralel, dicoba ulang bila gagal) ----
const wB64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(new Error('gagal membaca file')); r.readAsDataURL(blob); });
const wHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function haApkUp() {
  const f = ($('#wfile') || {}).files && $('#wfile').files[0]; if (HAW.busy) return;
  if (!f) return toast('Pilih file APK dulu');
  if (!/\.apk$/i.test(f.name)) return toast('File harus berekstensi .apk');
  if (f.size < 100000 || f.size > WCH * 340) return toast('Ukuran file tidak wajar (maks. ±120 MB)');
  const ps = (t) => { const e = $('#wps'); if (e) e.textContent = t; }, pb = (p) => { const w = $('#wpw'), b = $('#wpb'); if (w) w.hidden = false; if (b) b.style.width = p + '%'; };
  HAW.busy = true; const btn = $('#wub'); if (btn) btn.disabled = true;
  try {
    ps('Memeriksa file…'); pb(1); const buf = await f.arrayBuffer(), sha = wHex(await crypto.subtle.digest('SHA-256', buf));
    const up = wHex(crypto.getRandomValues(new Uint8Array(8))), n = Math.ceil(f.size / WCH); let done = 0, next = 0;
    const put = async (i) => {
      const body = await wB64(f.slice(i * WCH, (i + 1) * WCH));
      for (let t = 0; ; t++) {
        try { const r = await fetch(AP + '/api/admin/apk/chunk?up=' + up + '&i=' + i, { method: 'PUT', headers: { Authorization: 'Bearer ' + HT, 'Content-Type': 'text/plain' }, body }); if (r.ok) return; const j = await r.json().catch(() => ({})); if (r.status < 500 && r.status != 429) throw Object.assign(new Error(j.e || 'Ditolak server (' + r.status + ')'), { fatal: 1 }); }
        catch (e) { if (e.fatal || t >= 3) throw e; }
        await new Promise((z) => setTimeout(z, 700 * (t + 1)));
      }
    };
    const worker = async () => { while (next < n) { const i = next++; await put(i); done++; pb(Math.max(1, Math.round(done / n * 96))); ps('Mengunggah ' + done + ' / ' + n + ' potongan…'); } };
    await Promise.all([worker(), worker(), worker()]);
    ps('Menyelesaikan…'); const r = await haApi('/api/admin/apk/commit', { method: 'POST', body: JSON.stringify({ up, n, size: f.size, sha, name: ($('#wnm') || {}).value.trim() || f.name, note: ($('#wnt') || {}).value.trim() }) });
    pb(100); HAW.apk = r; toast('APK berhasil diunggah ke website'); HAW.busy = false; R();
  } catch (e) { HAW.busy = false; ps('Gagal: ' + e.message); if (btn) btn.disabled = false; toast('Unggah gagal: ' + e.message, 6000); }
}
async function haApkDel() { if (!confirm('Hapus APK dari website? Tombol unduh akan hilang.')) return; try { await haApi('/api/admin/apk', { method: 'DELETE' }); HAW.apk = { has: 0 }; toast('APK dihapus dari website'); R(); } catch (e) { toast(e.message); } }
