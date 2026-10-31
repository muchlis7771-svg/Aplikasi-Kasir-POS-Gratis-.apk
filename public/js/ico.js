'use strict';
/* ============ IKON GARIS ELEGAN (SVG) ============
   Setiap ikon 24×24, garis tipis membulat + aksen lembut (kelas "a" berisi warna aksen transparan).
   ico(nama) → markup <svg>. pIco(kunci halaman) → ikon halaman. */
const ICP = {
  dash: '<path class="a" d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/><path d="M3 12 12 4.5 21 12M5.5 10.2V19a1 1 0 0 0 1 1h3.5v-5.2h4V20h3.5a1 1 0 0 0 1-1v-8.8"/>',
  pos: '<path class="a" d="M6.5 7h13l-1.6 7.2a1.5 1.5 0 0 1-1.5 1.2H9.3a1.5 1.5 0 0 1-1.5-1.2z"/><path d="M3 4h2.2l2.3 10.6a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L19.6 7H6.1"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="16.5" cy="19.5" r="1.3"/>',
  his: '<path class="a" d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9 8h6M9 11.5h6M9 15h3.5"/>',
  prod: '<path class="a" d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3z"/><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3zM4 7.3l8 4.3 8-4.3M12 11.6V21M8 5.2l8 4.3"/>',
  outlet: '<path class="a" d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  lap: '<path class="a" d="M5 4h14v16H5z"/><path d="M5 4h14v16H5zM9 16v-3M12 16V9M15 16v-5"/>',
  keu: '<path class="a" d="M3.5 7.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-15z"/><path d="M3.5 7.5v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-15zm0 0 11-3.3a1.5 1.5 0 0 1 1.9 1.4v1.9M16 13.5h2"/>',
  jur: '<path class="a" d="M6 3.5h11.5v17H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M4.5 18.5V5A1.5 1.5 0 0 1 6 3.5h11.5v14H6a1.5 1.5 0 0 0 0 3h11.5M9 8h5M9 11h5"/>',
  abs: '<circle class="a" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chat: '<path class="a" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z"/><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5zM8.5 9h7M8.5 12h4.5"/>',
  onl: '<path class="a" d="M5 8h14l-1 12H6z"/><path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8M9.5 12a2.5 2.5 0 0 0 5 0"/>',
  ana: '<path class="a" d="M4 20V4h16v16z"/><path d="M4 4v16h16M7.5 15l3.5-4 3 2.5 4.5-5.5M15 8h3.5v3.5"/>',
  usr: '<circle class="a" cx="9" cy="8.5" r="3.2"/><circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.7.6 3 2.3 3.5 4.7"/>',
  set: '<circle class="a" cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  beli: '<path class="a" d="M4 9h16v10.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 9h16v10.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM6 5h12l2 4M6 5 4 9M12 11.5v5.5M9.5 14.5 12 17l2.5-2.5"/>',
  kas: '<rect class="a" x="3" y="6" width="18" height="12" rx="2"/><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  kirim: '<path class="a" d="M3 6.5h11v10H3z"/><path d="M3 6.5h11v10H3zM14 9.5h3.6l3.4 3.6v3.4h-7"/><circle cx="6.5" cy="18.2" r="1.7"/><circle cx="17.5" cy="18.2" r="1.7"/>',
  perm: '<path class="a" d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><rect x="9" y="11" width="6" height="4.5" rx="1"/><path d="M10.2 11V9.6a1.8 1.8 0 0 1 3.6 0V11"/>',
  aud: '<path class="a" d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6zM8.8 12l2.2 2.2 4.2-4.4"/>',
  retur: '<path class="a" d="M5 9.5h10a4.5 4.5 0 0 1 0 9H8"/><path d="M5 9.5h10a4.5 4.5 0 0 1 0 9H8M8.5 6 5 9.5 8.5 13"/>',
  tgt: '<circle class="a" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m12 12 6.5-6.5M16 5.5h2.5V8"/>',
  shiftSet: '<rect class="a" x="3.5" y="5" width="17" height="15" rx="2"/><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v3l2 1.2"/>',
  kiosMap: '<path class="a" d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13"/>',
  dnet: '<circle class="a" cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m6.6 7.3 3.2 2.6M17.4 7.3l-3.2 2.6M6.6 16.7l3.2-2.6M17.4 16.7l-3.2-2.6"/>',
  kanvas: '<path class="a" d="M2.5 7.5h12.5v9H2.5z"/><path d="M2.5 7.5h12.5v9H2.5zM15 10h3.2l3.3 3.3v3.2H15M5.8 7.5V5.5h6v2"/><circle cx="6" cy="18.2" r="1.7"/><circle cx="17.5" cy="18.2" r="1.7"/>',
  gaji: '<rect class="a" x="2.5" y="6.5" width="19" height="11" rx="2"/><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 9.5h1.5M17 14.5h1.5M5 20h14"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9.5 8 5.5 12l4 4M5.5 12H15"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  lock: '<rect class="a" x="5" y="10.5" width="14" height="10" rx="2"/><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
  plus: '<circle class="a" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  edit: '<path class="a" d="M5 19l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L9 17.5z"/><path d="M5 19l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L9 17.5zM13.5 7l3 3"/>',
  srv: '<rect class="a" x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M7.5 7.5h.01M7.5 16.5h.01M11 7.5h5M11 16.5h5"/>',
  crown: '<path class="a" d="m4 8 4 4 4-6 4 6 4-4-1.5 10h-13z"/><path d="m4 8 4 4 4-6 4 6 4-4-1.5 10h-13zM6 20.5h12"/>',
  bag: '<path class="a" d="M5 8h14l-1 12H6z"/><path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
  key: '<circle class="a" cx="8" cy="15" r="4"/><circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5"/>',
  play: '<circle class="a" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
  shield: '<path class="a" d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/>',
  wifi: '<path d="M4 9.5a12 12 0 0 1 16 0M6.8 12.7a8 8 0 0 1 10.4 0M9.6 15.9a4 4 0 0 1 4.8 0"/><circle cx="12" cy="19" r="1"/>',
};
const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICP[n] || ICP.dash}</svg>`;
const pIco = (k) => (ICP[k] ? ico(k) : (PAGES[k] || ['•'])[0]);
const TICO = { '➕': 'plus', '📝': 'edit' };
const tIco = (q) => (TICO[q[1]] ? ico(TICO[q[1]]) : ICP[q[0]] ? ico(q[0]) : q[1]);
