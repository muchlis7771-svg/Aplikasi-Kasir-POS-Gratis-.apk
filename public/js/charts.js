'use strict';
/* ============ grafik SVG/HTML ringan (tanpa pustaka) ============ */
let _g = 0;
function area(D, fmt = rp) {
  if (!D.length) return '';
  const id = 'ag' + ++_g, W = 600, H = 200, p = 24, top = 16, mx = Math.max(...D.map((d) => d.v), 1) * 1.18;
  const X = (i) => p + (D.length > 1 ? i * (W - 2 * p) / (D.length - 1) : (W - 2 * p) / 2), Y = (v) => H - p - Math.max(v, 0) / mx * (H - 2 * p - top);
  let d = 'M' + X(0) + ',' + Y(D[0].v);
  for (let i = 1; i < D.length; i++) { const m = (X(i - 1) + X(i)) / 2; d += `C${m},${Y(D[i - 1].v)} ${m},${Y(D[i].v)} ${X(i)},${Y(D[i].v)}`; }
  const step = Math.ceil(D.length / 8), last = D[D.length - 1], lx = X(D.length - 1), ly = Y(last.v), lblR = lx > W - 70;
  return `<svg viewBox="0 0 ${W} ${H + 16}" width="100%">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27407e" stop-opacity=".5"/><stop offset=".55" stop-color="#00c2a8" stop-opacity=".16"/><stop offset="1" stop-color="#00c2a8" stop-opacity="0"/></linearGradient>`
    + `<filter id="${id}f" x="-30%" y="-60%" width="160%" height="220%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.6" flood-color="#27407e" flood-opacity=".4"/></filter></defs>`
    + [0, 1, 2, 3].map((i) => `<line x1="${p}" x2="${W - p}" y1="${p - top / 2 + i * (H - 2 * p + top) / 3}" y2="${p - top / 2 + i * (H - 2 * p + top) / 3}" stroke-dasharray="2.5 5" style="stroke:var(--bd)"/>`).join('')
    + `<text x="${p}" y="${p - top / 2 - 6}" font-size="9.5" font-weight="600" style="fill:var(--mu)">${esc(fmt(Math.round(mx / 1.18)))}</text>`
    + `<path d="${d}L${X(D.length - 1)},${H - p}L${X(0)},${H - p}Z" fill="url(#${id})"/>`
    + `<path d="${d}" fill="none" stroke="#27407e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}f)"/>`
    + D.map((x, i) => (i % step && i != D.length - 1 ? '' : `<text x="${X(i)}" y="${H + 6}" text-anchor="middle" font-size="10" style="fill:var(--mu)">${esc(x.l)}</text>`)
      + (i == D.length - 1 ? `<circle cx="${lx}" cy="${ly}" r="8.5" fill="#00c2a8" opacity=".18"/>` : '')
      + `<circle cx="${X(i)}" cy="${Y(x.v)}" r="${i == D.length - 1 ? 4.5 : 3.2}" style="fill:var(--cd)" stroke="${i == D.length - 1 ? '#00c2a8' : '#27407e'}" stroke-width="2"><title>${esc(x.l)}: ${esc(fmt(x.v))}</title></circle>`).join('')
    + `<text x="${lx}" y="${Math.max(ly - 12, 11)}" text-anchor="${lblR ? 'end' : 'middle'}" font-size="11" font-weight="800" style="fill:#00916f">${esc(fmt(last.v))}</text>`
    + '</svg>';
}
// grafik garis multi-seri (dipakai untuk "Pergerakan Neraca" — beberapa pos akun sekaligus dalam satu sumbu Rp)
function multiLine(labels, series, fmt = rp) {
  if (!labels.length || !series.length) return '<p class="mu">Belum ada data</p>';
  const id = 'ml' + ++_g, W = 600, H = 220, p = 28, allV = series.flatMap((s) => s.vals), mx = Math.max(...allV, 1) * 1.1, mn = Math.min(0, ...allV) * 1.1;
  const X = (i) => p + (labels.length > 1 ? i * (W - 2 * p) / (labels.length - 1) : (W - 2 * p) / 2), Y = (v) => H - p - (v - mn) / ((mx - mn) || 1) * (H - 2 * p);
  const pathOf = (vals) => { let d = 'M' + X(0) + ',' + Y(vals[0]); for (let i = 1; i < vals.length; i++) { const m = (X(i - 1) + X(i)) / 2; d += `C${m},${Y(vals[i - 1])} ${m},${Y(vals[i])} ${X(i)},${Y(vals[i])}`; } return d; };
  const step = Math.ceil(labels.length / 7);
  const grid = [0, 1, 2, 3].map((i) => `<line x1="${p}" x2="${W - p}" y1="${p + i * (H - 2 * p) / 3}" y2="${p + i * (H - 2 * p) / 3}" stroke-dasharray="2.5 5" style="stroke:var(--bd)"/>`).join('')
    + `<text x="${p}" y="${p - 6}" font-size="9.5" font-weight="600" style="fill:var(--mu)">${esc(fmt(Math.round(mx / 1.1)))}</text>`
    + (mn < 0 && mx > 0 ? `<line x1="${p}" x2="${W - p}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--mu);stroke-dasharray:3 3"/>` : '');
  const axisLbl = labels.map((l, i) => (i % step && i != labels.length - 1 ? '' : `<text x="${X(i)}" y="${H + 14}" text-anchor="middle" font-size="10" style="fill:var(--mu)">${esc(l)}</text>`)).join('');
  const defs = `<defs><filter id="${id}f" x="-30%" y="-60%" width="160%" height="220%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.8" flood-color="#000" flood-opacity=".22"/></filter></defs>`;
  const lines = series.map((s, si) => { const col = s.color || COL[si % COL.length], vals = s.vals, lastI = vals.length - 1; return `<path d="${pathOf(vals)}" fill="none" stroke="${col}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}f)"/>` + vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${i == lastI ? 4 : 2.8}" style="fill:${col}" ${i == lastI ? 'stroke="var(--cd)" stroke-width="1.6"' : ''}><title>${esc(s.name)} · ${esc(labels[i])}: ${esc(fmt(v))}</title></circle>`).join(''); }).join('');
  const legend = `<div class="mlg">${series.map((s, si) => `<span><i style="background:${s.color || COL[si % COL.length]};color:${s.color || COL[si % COL.length]}"></i>${esc(s.name)} <b>${esc(fmt(s.vals[s.vals.length - 1]))}</b></span>`).join('')}</div>`;
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%">${defs}${grid}${axisLbl}${lines}</svg>${legend}`;
}
function donut(D, label = 'kategori') {
  D = D.filter((x) => x.v > 0); if (!D.length) return '<p class="mu">Belum ada data</p>';
  const id = 'dn' + ++_g, t = D.reduce((a, x) => a + x.v, 0) || 1, R = 48, C = 2 * Math.PI * R; let o = 0;
  return `<div class="dn"><svg viewBox="0 0 120 120" width="150"><defs><filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000" flood-opacity=".25"/></filter></defs><g transform="rotate(-90 60 60)" filter="url(#${id}f)">` + D.map((x, i) => { const l = x.v / t * C, s = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${COL[i % COL.length]}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${Math.max(l - 1.5, 0)} ${C}" stroke-dashoffset="${-o}"/>`; o += l; return s; }).join('')
    + `</g><circle cx="60" cy="60" r="${R - 10}" fill="var(--cd)"/><text x="60" y="58" text-anchor="middle" font-size="15" font-weight="800" style="fill:var(--tx)">${D.length}</text><text x="60" y="71" text-anchor="middle" font-size="9" style="fill:var(--mu)">${esc(label)}</text></svg><div>`
    + D.map((x, i) => `<div class="lg"><i style="background:${COL[i % COL.length]}"></i>${esc(x.l)} <b>${Math.round(x.v / t * 100)}%</b></div>`).join('') + '</div></div>';
}
function bars(D, fmt = (v) => v) {
  D = D.filter((x) => x.v > 0); if (!D.length) return '<p class="mu">Belum ada data</p>';
  const m = Math.max(...D.map((x) => x.v), 1);
  return D.map((x) => `<div class="br"><span title="${esc(x.l)}">${esc(x.l)}</span><div><u style="width:${x.v / m * 100}%;background:linear-gradient(90deg,#27407e,#1aa08c 65%,#00c2a8)"></u></div><b>${esc(fmt(x.v))}</b></div>`).join('');
}
function vbars(D, fmt = (v) => Math.round(v / 1000) + 'k') {
  if (!D.length) return '<p class="mu">Belum ada data</p>';
  const m = Math.max(...D.map((x) => x.v), 1);
  return `<div class="vb">` + D.map((x) => `<div title="${esc(x.l)}: ${esc(rp(x.v))}"><small>${esc(fmt(x.v))}</small><u style="height:${Math.max(2, x.v / m * 100)}%"></u><span>${esc(x.l)}</span></div>`).join('') + '</div>';
}
const kpi = (items) => `<div class="kp">${items.map((k, i) => k[3] ? `<button type="button" class="cd k${i % 6} kpb ${k[4] ? 'on' : ''}" onclick="${k[3]}"><small>${esc(k[0])} ›</small><h2>${esc(k[1])}</h2>${k[2] ? `<small>${esc(k[2])}</small>` : ''}</button>` : `<div class="cd k${i % 6}"><small>${esc(k[0])}</small><h2>${esc(k[1])}</h2>${k[2] ? `<small>${esc(k[2])}</small>` : ''}</div>`).join('')}</div>`;
const row = (a, b, c) => `<div class="row ${c || ''}"><span>${a}</span><b>${b}</b></div>`;
const days = (n) => { const o = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); o.push({ k: dkey(d), l: d.getDate() + '/' + (d.getMonth() + 1) }); } return o; };
