'use strict';
/* ============ PETA KIOS (toko grosir / distributor) ============
   Kios yang mendaftar di J-POS Belanja dan mengizinkan tokonya tampil, muncul di peta ini.
   Toko bisa menawarkan produk lewat WhatsApp, membuka navigasi, atau menjadikannya outlet. */
const KM = { r: 25, at: null, src: 'toko', list: null, q: '', err: '', busy: false };
let kmap = null;
function kmCenter() { if (KM.src == 'toko' && S.set.glat != null) return { lat: +S.set.glat, lng: +S.set.glng }; return KM.at; }
async function kmLoad() {
  if (!S.srv || !canNet()) { KM.err = 'Peta kios butuh internet.'; return R(); }
  let c = kmCenter(); if (!c) { KM.busy = true; R(); const p = await getPos(); KM.busy = false; if (!p) { KM.err = 'Lokasi tidak tersedia. Aktifkan GPS atau atur lokasi toko di Pengaturan.'; return R(); } KM.at = { lat: p.lat, lng: p.lng }; if (KM.src == 'toko' && S.set.glat == null) KM.src = 'saya'; c = KM.at; }
  KM.busy = true; KM.err = ''; R();
  try { const r = await api('/api/kios?lat=' + c.lat + '&lng=' + c.lng + '&r=' + KM.r); KM.list = r.kios; KM.shops = r.shops || []; } catch (e) { KM.err = e.message; }
  KM.busy = false; R();
}
const kmPh = (x) => String(x.phone || '').replace(/\D/g, '').replace(/^0/, '62');
const kmIsOutlet = (x) => S.c.some((c) => !c.x && ((c.ph && String(c.ph).replace(/\D/g, '').replace(/^0/, '62') == kmPh(x)) || (c.lat != null && haversine(c.lat, c.lng, x.lat, x.lng) < 30)));
function kmOffer(i) {
  const x = KM.list[i];
  const t = `Halo ${x.name}${x.kname ? ' (' + x.kname + ')' : ''} 👋\nKami dari *${S.name}*${S.set.addr ? ', ' + S.set.addr : ''}.\nKami menyediakan barang grosir untuk kios Anda dengan harga grosir${S.set.tel ? ' — telp ' + S.set.tel : ''}.\n\nBelanja langsung lewat aplikasi J-POS → menu *Belanja* → pilih toko *${S.name}*, atau balas pesan ini untuk daftar harga. Terima kasih 🙏`;
  window.open('https://wa.me/' + kmPh(x) + '?text=' + encodeURIComponent(t), '_blank');
}
function kmOutlet(i) {
  const x = KM.list[i]; if (!can('outlet')) return toast('Tidak punya hak menambah outlet');
  if (kmIsOutlet(x)) return toast('Kios ini sudah ada di daftar outlet');
  if (!confirm('Tambahkan "' + (x.kname || x.name) + '" sebagai outlet?')) return;
  emit('cu', { c: { id: 'c' + uid(), n: x.kname || x.name, ph: x.phone || '', ad: x.addr || '', lat: x.lat, lng: x.lng, note: 'Dari Peta Kios · pemilik ' + x.name } }); toast('Outlet ditambahkan'); R();
}
VW.kiosMap = () => {
  const L0 = (KM.list || []).map((x, i) => ({ ...x, i })).filter((x) => !KM.q || (x.kname + ' ' + x.name + ' ' + (x.addr || '')).toLowerCase().includes(KM.q.toLowerCase()));
  const nOrd = L0.filter((x) => x.ord).length;
  return `<div class="cd"><small class="mu">Kios yang terdaftar di J-POS Belanja dan mengizinkan tokonya tampil. Tawarkan produk, buka navigasi, atau jadikan outlet.</small>
<div class="fm2" style="margin-top:8px"><label><small class="mu">Pusat pencarian</small><select onchange="KM.src=this.value;KM.list=null;kmLoad()"><option value="toko" ${KM.src == 'toko' ? 'selected' : ''} ${S.set.glat == null ? 'disabled' : ''}>📍 Lokasi toko</option><option value="saya" ${KM.src == 'saya' ? 'selected' : ''}>🧭 Lokasi saya sekarang</option></select></label>
<label><small class="mu">Radius</small><select onchange="KM.r=+this.value;kmLoad()">${[5, 10, 25, 50, 100].map((r) => `<option value="${r}" ${KM.r == r ? 'selected' : ''}>${r} km</option>`).join('')}</select></label></div>
<input placeholder="Cari nama kios / alamat" value="${esc(KM.q)}" oninput="KM.q=this.value;clearTimeout(KM.t);KM.t=setTimeout(R,300)" style="margin-top:8px"></div>
${KM.err ? `<div class="cd warnbox">${esc(KM.err)}</div>` : ''}
<div class="cd" style="padding:0;overflow:hidden"><div id="kmap" style="height:320px"></div></div>
<div class="seg" style="margin:4px 0 8px"><button class="${KM.tab != 'shop' ? 'a' : ''}" onclick="KM.tab='kios';R()">🏪 Kios (${(KM.list || []).length})</button><button class="${KM.tab == 'shop' ? 'a' : ''}" onclick="KM.tab='shop';R()">🏬 Toko grosir (${(KM.shops || []).length})</button></div>
<div class="row" style="margin:4px 4px 8px"><small class="mu"><span class="kdot"></span> kios belum order · <span class="kdot g"></span> kios pelanggan · <span class="kdot b"></span> toko grosir</small></div>
${KM.tab == 'shop' ? (KM.shops || []).filter((x) => !KM.q || (x.name + ' ' + (x.addr || '')).toLowerCase().includes(KM.q.toLowerCase())).map((x) => `<div class="cd"><div class="row" style="margin:0;align-items:flex-start"><span><b>🏬 ${esc(x.name)}</b><br><small class="mu">${esc({ biasa: 'Kios', standar: 'Grosir', high: 'Distributor' }[x.tier] || 'Toko')} · ${distStr(x.dist)}${x.addr ? ' · ' + esc(x.addr) : ''} · kode ${esc(x.id)}</small></span></div><div class="wrap" style="margin-top:8px">${can('dnet') ? `<button class="pr" onclick="dnInvite('${esc(x.id)}')">🤝 Ajak jadi mitra</button>` : ''}<a class="gh" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="${esc(mapsUrl(x))}">🧭 Navigasi</a></div></div>`).join('') || '<div class="cd mu c">Belum ada toko grosir dalam radius ini.</div>' : ''}
${KM.tab == 'shop' ? '' : L0.map((x) => `<div class="cd"><div class="row" style="margin:0;align-items:flex-start"><span><b>🏪 ${esc(x.kname || x.name)}</b><br><small class="mu">${esc(x.name)} · ${distStr(x.dist)}${x.addr ? ' · ' + esc(x.addr) : ''}</small></span>${x.ord ? '<span class="chip g">Pelanggan</span>' : kmIsOutlet(x) ? '<span class="chip">Outlet</span>' : ''}</div>
<div class="wrap" style="margin-top:8px">${x.phone ? `<button class="pr" onclick="kmOffer(${x.i})">💬 Tawarkan via WA</button>` : ''}<a class="gh" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="${esc(mapsUrl(x))}">🧭 Navigasi</a>${can('outlet') && !kmIsOutlet(x) ? `<button class="gh" onclick="kmOutlet(${x.i})">＋ Jadikan outlet</button>` : ''}</div></div>`).join('') || (KM.list && !KM.busy ? `<div class="cd mu c">Belum ada kios terdaftar dalam radius ${KM.r} km.${nOrd ? '' : ' Ajak kios di sekitar Anda mendaftar di J-POS → Belanja → Daftar sebagai kios.'}</div>` : '')}`;
};
VW.kiosMap.after = () => {
  if (!KM.list && !KM.busy && !KM.err) return kmLoad();
  const el = $('#kmap'); if (!el || !leafletOk()) return; const c = kmCenter() || DEF_POS;
  try { if (kmap) kmap.remove(); } catch (e) { }
  kmap = L.map(el).setView(c.lat != null ? [c.lat, c.lng] : DEF_POS, KM.r <= 5 ? 13 : KM.r <= 25 ? 11 : 9); tiles(kmap);
  if (c.lat != null) { L.circle([c.lat, c.lng], { radius: KM.r * 1000, color: '#d4af37', weight: 1, fillOpacity: 0.04 }).addTo(kmap); L.circleMarker([c.lat, c.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#4f46e5', fillOpacity: 1 }).bindTooltip(KM.src == 'toko' ? S.name : 'Lokasi saya').addTo(kmap); }
  for (const x of KM.shops || []) L.circleMarker([x.lat, x.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }).bindPopup(`<b>🏬 ${esc(x.name)}</b><br>${distStr(x.dist)}`).addTo(kmap);
  for (const x of KM.list || []) L.circleMarker([x.lat, x.lng], { radius: 8, color: '#fff', weight: 2, fillColor: x.ord ? '#10b981' : '#f59e0b', fillOpacity: 1 }).bindPopup(`<b>${esc(x.kname || x.name)}</b><br>${esc(x.name)} · ${distStr(x.dist)}${x.phone ? `<br><a href="#" onclick="kmOffer(${KM.list.indexOf(x)});return false">💬 Tawarkan via WA</a>` : ''}`).addTo(kmap);
};
