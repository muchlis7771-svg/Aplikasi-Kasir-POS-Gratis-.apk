'use strict';
/* ============ MESIN HITUNG ORDER SALES (murni, tanpa layar) ============
   Membaca orderan sales (teks WA atau hasil baca foto) per baris → cocokkan ke daftar harga (kode SKU / nama) →
   qty dalam pcs → subtotal = qty × harga. Prinsip: TIDAK menebak diam-diam. Setiap baris yang tidak 100% jelas
   ditandai "cek" (atau "x" bila tidak ketemu) supaya diperiksa manusia sebelum totalnya dipakai.
   Urutan per baris:
     1. kode SKU (mis. "G2G-35", "G2G 35", "g2g35", "KD 35", "NJM101001") → cocok persis ke daftar harga
     2. bila tidak ada kode: cocokkan nama (kata per kata, toleran salah ketik & singkatan). Nama yang dipakai
        beberapa SKU sekaligus (mis. ukuran berbeda, kode & harga beda) SELALU ditandai cek + pilihan kandidat
     3. qty: angka dengan satuan (pcs/lsn/dus), atau "x2" / "= 2" / "qty 2", atau angka yang tersisa.
        Angka yang merupakan bagian nama SKU (377, 02, 300ML, 10%) tidak dianggap qty.
        lusin = 12 pcs; dus/karton = isi per dus dari daftar harga (kalau kosong → cek). */
const HOX = (() => {
  const UPCS = /^(PCS|PC|PCE|PCES|PSC|BH|BUAH|BTL|BOTOL|PACK|PAK|PCK|PK|TUBE|TB|SACHET|SCT|POT|JAR|UNIT|BIJI|BJ|EA|ITEM|PIECE|PIECES)$/;
  const ULSN = /^(LSN|LUSIN|LS|DZ|DOZEN|DOZ)$/;
  const UDUS = /^(DUS|DOS|CTN|KARTON|KRTN|KRT|BOX|BOKS|BX|INNER|INR|CARTON)$/;
  const SIZE = /^(ML|GR|GRAM|G|MG|L|LTR|LITER|CM|MM|OZ|%)$/;
  const norm = (s) => String(s ?? '').toUpperCase().replace(/[–—−]/g, '-').replace(/[*_~`"“”]/g, ' ').replace(/\s+/g, ' ').trim();
  const nc = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tailKey = (t) => t.replace(/^0+(?=\d)/, '');
  const toNum = (s) => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? null : v; };
  // token nama: huruf/angka; "300ML" & "300 ML" dua-duanya jadi "300ML"; "10%" tetap
  function toks(s) {
    const t = norm(s).replace(/(\d)\s+(ML|GR|GRAM|G|MG|L|LTR|CM|MM|OZ)\b/g, '$1$2').replace(/(\d)\s*%/g, '$1%').replace(/[^A-Z0-9%]+/g, ' ').split(' ').filter(Boolean);
    return t.filter((x) => x.length >= 2 || /\d/.test(x));
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let p = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const c = [i]; let mn = i;
      for (let j = 1; j <= b.length; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)); if (c[j] < mn) mn = c[j]; }
      if (mn > max) return max + 1; p = c;
    }
    return p[b.length];
  }
  const subseq = (sh, lg) => { let i = 0; for (const ch of lg) if (ch == sh[i]) i++; return i == sh.length; };
  // seberapa mirip 2 token (0..1). Angka harus sama persis (02 ≠ 03, 300ML ≠ 130ML).
  function tm(a, b) {
    if (a == b) return 1;
    const da = /\d/.test(a), db = /\d/.test(b);
    if (da || db) { if (da && db && a.replace(/^0+/, '') == b.replace(/^0+/, '')) return 1; return 0; }
    const sh = a.length <= b.length ? a : b, lg = a.length <= b.length ? b : a;
    if (sh.length >= 4 && lg.startsWith(sh)) return 0.9;
    const mx = lg.length >= 8 ? 2 : lg.length >= 5 ? 1 : 0;
    if (mx && lev(a, b, mx) <= mx) return 0.85;
    if (sh.length >= 3 && sh[0] == lg[0] && sh.length <= lg.length * 0.85 && subseq(sh, lg)) return 0.7;
    return 0;
  }

  /** rows: [{c: kode, n: nama, p: harga per pcs, isi: pcs per dus (opsional)}] */
  function index(rows) {
    const X = { rows: [], byNc: new Map(), byTail: new Map(), pre: [], df: new Map(), N: 0 };
    const pre = new Set();
    rows.forEach((r0) => {
      const r = { c: String(r0.c || '').trim(), n: String(r0.n || '').trim(), p: +r0.p || 0, isi: +r0.isi || 0 };
      if (!r.c && !r.n) return;
      r.nc = nc(r.c); r.tk = [...new Set(toks(r.n))]; r.i = X.rows.length; X.rows.push(r);
      if (r.nc) X.byNc.set(r.nc, r);
      const m = /^(.*?)(\d+)$/.exec(r.nc);
      if (m) { r.pre = m[1]; r.tail = m[2]; if (m[1]) pre.add(m[1]); const k = m[1] + '|' + tailKey(m[2]); (X.byTail.get(k) || X.byTail.set(k, []).get(k)).push(r); const k2 = '*|' + tailKey(m[2]); (X.byTail.get(k2) || X.byTail.set(k2, []).get(k2)).push(r); }
      r.tk.forEach((t) => X.df.set(t, (X.df.get(t) || 0) + 1));
    });
    X.N = X.rows.length; X.pre = [...pre].sort((a, b) => b.length - a.length);
    X.w = (t) => Math.log(1 + X.N / (X.df.get(t) || 0.6));
    X.preRe = X.pre.map((P) => [P, new RegExp('(^|[^A-Z0-9])(' + P.split('').map(escRe).join('[\\s\\-_./]?') + ')\\s*[-_./:]?\\s*(\\d+)(?![0-9])', 'g')]);
    return X;
  }
  const byCode = (X, code) => { const k = nc(code); if (!k) return null; if (X.byNc.has(k)) return X.byNc.get(k); const m = /^(.*?)(\d+)$/.exec(k); if (!m) return null; const L = X.byTail.get(m[1] + '|' + tailKey(m[2])); return L && L.length == 1 ? L[0] : null; };

  // cocokkan nama: kembalikan kandidat urut skor
  function nameMatch(X, lt) {
    const lw = lt.filter((t) => !/^\d+(\.\d+)?$/.test(t) || X.df.has(t)); // angka polos hanya dipakai kalau memang muncul di nama SKU
    if (!lw.some((t) => /[A-Z]{2}/.test(t))) return []; // minimal 1 kata huruf — angka saja tidak cukup untuk menebak nama
    const out = [];
    for (const r of X.rows) {
      if (!r.tk.length) continue;
      let sw = 0, sm = 0;
      for (const t of r.tk) { const w = X.w(t); sw += w; let b = 0; for (const u of lw) { const v = tm(t, u); if (v > b) b = v; if (b == 1) break; } sm += w * b; }
      let lwW = 0, lwM = 0;
      for (const u of lw) { let b = 0, bw = 0; for (const t of r.tk) { const v = tm(t, u); if (v > b) { b = v; bw = X.w(t); } } if (!b && /^\d+$/.test(u)) continue; /* angka polos yang tidak ada di nama = kemungkinan qty, bukan penalti */ const w = b ? bw : (X.df.has(u) ? X.w(u) : 1.2); lwW += w; lwM += w * b; }
      const rc = sw ? sm / sw : 0, lc = lwW ? lwM / lwW : 0, sc = 0.55 * rc + 0.45 * lc;
      if (sc > 0.2) out.push({ r, sc, rc, lc });
    }
    return out.sort((a, b) => b.sc - a.sc);
  }
  const sameName = (a, b) => a.tk.length == b.tk.length && a.tk.every((t) => b.tk.includes(t));
  function amt(s) { // "Rp 1.234.567", "500rb", "1,2jt"
    const m = /(\d[\d.,]*)\s*(RB|RIBU|K|JT|JUTA)?/.exec(s); if (!m) return 0;
    let v = m[2] ? toNum(m[1].replace(/\.(?=\d{3}\b)/g, '')) : +m[1].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (!v && v !== 0) return 0; if (/RB|RIBU|K/.test(m[2] || '')) v *= 1e3; if (/JT|JUTA/.test(m[2] || '')) v *= 1e6; return v;
  }

  /** satu baris teks → hasil baca */
  function line(X, raw) {
    const R = { raw: String(raw || '').trim(), kind: 'item', sku: null, qty: null, unit: 'pcs', mul: 1, conf: 'x', why: [], cands: [] };
    let s = ' ' + norm(raw).replace(/^\s*(\d{1,3}\s*[.)]\s+(?=\D)|[-•·>]+\s*)/, '') + ' ';
    if (!s.trim()) { R.kind = 'skip'; return R; }
    if (/\b(TOTAL|TTL|GRAND|SUBTOTAL|JUMLAH HARGA|NILAI)\b/.test(s) && /\d/.test(s)) { R.kind = 'total'; R.amt = amt(s.replace(/^.*?(TOTAL|TTL|GRAND|SUBTOTAL|NILAI)\b[^0-9]*/, '')); return R; }
    if (/\b(SALES|SLS|SALESMAN|NAMA SALES)\b\s*[:=-]/.test(s)) { R.kind = 'info'; R.tag = 'sales'; R.val = s.replace(/^.*?(SALES|SLS|SALESMAN)\b\s*[:=-]\s*/, '').trim(); return R; }
    if (/\b(TOKO|OUTLET|CUST|CUSTOMER|PELANGGAN|TK)\b\s*[:=-]/.test(s) && !/\d+\s*(PCS|LSN|DUS|CTN)/.test(s)) { R.kind = 'info'; R.tag = 'outlet'; R.val = s.replace(/^.*?(TOKO|OUTLET|CUSTOMER|CUST|PELANGGAN|TK)\b\s*[:=-]\s*/, '').trim(); return R; }
    // harga yang ikut ditulis sales (Rp 37.000 / 75rb) — dicatat, bukan qty
    s = s.replace(/\bRP\.?\s*\d[\d.,]*\s*(RB|RIBU|K|JT|JUTA)?\b/g, (m) => { R.wrote = amt(m); return ' '; }).replace(/\b\d[\d.,]*\s*(RB|RIBU|JT|JUTA)\b/g, (m) => { R.wrote = amt(m); return ' '; });
    // 1. kode SKU
    let codeTxt = '';
    for (const [P, re] of X.preRe) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(s))) {
        const k = P + m[3], r = X.byNc.get(k) || (X.byTail.get(P + '|' + tailKey(m[3])) || [])[0];
        if (r) { R.sku = r; codeTxt = m[2] + m[3]; s = s.slice(0, m.index) + m[1] + ' ' + s.slice(m.index + m[0].length); break; }
        if (!R.badCode) { R.badCode = P + '-' + m[3]; s = s.slice(0, m.index) + m[1] + ' ' + s.slice(m.index + m[0].length); re.lastIndex = 0; }
      }
      if (R.sku) break;
    }
    if (!R.sku) {
      const m = /\b(KD|KODE|KODE BRG|CODE|SKU|ART|ITEM)\s*[:.#=-]?\s*([A-Z0-9][A-Z0-9-]*)/.exec(s);
      if (m) { const r = byCode(X, m[2]) || (/^\d+$/.test(m[2]) ? ((X.byTail.get('*|' + tailKey(m[2])) || []).length == 1 ? X.byTail.get('*|' + tailKey(m[2]))[0] : null) : null); if (r) { R.sku = r; codeTxt = m[2]; s = s.replace(m[0], ' '); } else R.badCode = m[2]; }
    }
    if (!R.sku) { // kode tanpa awalan huruf & tanpa pemisah, mis. "NJM101001" sudah tertangkap di atas; di sini kode utuh ditulis apa adanya
      for (const w of s.split(/\s+/)) { const k = nc(w); if (k.length >= 4 && /\d/.test(k) && /[A-Z]/.test(k) && X.byNc.has(k)) { R.sku = X.byNc.get(k); codeTxt = w; s = s.replace(w, ' '); break; } }
    }
    // 2. qty — kumpulkan semua angka beserta konteksnya
    const sizeT = [];
    s = s.replace(/(\d+(?:[.,]\d+)?)\s*(ML|GR|GRAM|MG|LTR|LITER|CM|MM|OZ|%)(?![A-Z])/g, (m, a, u) => { sizeT.push(a.replace(',', '.') + (u == 'GRAM' ? 'GR' : u)); return ' ' + a + u + ' '; });
    s = s.replace(/\bX\s*(?=\d)/g, ' X ').replace(/(\d)\s*X\b/g, '$1 X ').replace(/\b(QTY|JML|ORD)(?=\d)/g, '$1 ');
    const nums = []; let m; const reN = /(^|[^A-Z0-9.,])(\d+(?:[.,]\d+)?)(?![0-9])(\s*)([A-Z%]*)/g;
    while ((m = reN.exec(s))) {
      const v = toNum(m[2]), st = m.index + m[1].length; let u = m[4] || '';
      if (u && m[3] && !UPCS.test(u) && !ULSN.test(u) && !UDUS.test(u) && u != 'X' && !SIZE.test(u)) u = ''; // ada spasi & bukan satuan → kata berikutnya, bukan tempelan
      const pre = s.slice(Math.max(0, st - 6), st);
      if (SIZE.test(u) || /^(ML|GR|G|MG|L|LTR)$/.test(u)) continue; // ukuran (300ML, 55G) bukan qty
      if (u && !UPCS.test(u) && !ULSN.test(u) && !UDUS.test(u) && u != 'X') { nums.push({ v, s: m[2], u: '', glued: u, st, mark: false }); continue; }
      nums.push({ v, s: m[2], u, st, mark: /(QTY|JML|JUMLAH|ORDER|ORD|@|=|:|\bX|\*)\s*$/.test(pre) || u == 'X' || /^\s*X\s*$/.test(pre.slice(-2)) });
    }
    // 3. bila belum ada SKU: cocokkan nama (angka yang menempel huruf/ukuran ikut sebagai token nama)
    const lt = toks(s).filter((t) => !UPCS.test(t) && !ULSN.test(t) && !UDUS.test(t) && !/^(QTY|JML|JUMLAH|ORDER|X|PESAN|MINTA|TAMBAH|DAN)$/.test(t));
    if (!R.sku && R.badCode) { const C = nameMatch(X, lt); R.cands = C.slice(0, 5).map((x) => x.r); }
    else if (!R.sku) {
      const C = nameMatch(X, lt), b = C[0];
      if (b && b.sc >= 0.45) {
        // kembar = nama sama persis, ATAU tulisan sales sama-sama cocok penuh ke SKU lain (beda hanya di kata yang tidak ditulis)
        const twins = C.filter((x) => x !== b && (sameName(x.r, b.r) || b.sc - x.sc < 0.12 || x.lc >= b.lc - 0.05)).slice(0, 6);
        R.sku = b.r; R.cands = [b, ...twins].map((x) => x.r); R.byName = true; R.score = b.sc;
        if (twins.some((x) => sameName(x.r, b.r))) R.why.push('Nama ini dipakai ' + (twins.filter((x) => sameName(x.r, b.r)).length + 1) + ' SKU (ukuran/kode beda) — pilih yang benar');
        else if (twins.length) R.why.push('Mirip beberapa SKU — pastikan pilihan benar');
        else if (!(b.lc >= 0.9 && b.sc >= 0.55)) R.why.push('Nama kurang lengkap/mirip — pastikan SKU benar');
        R.nameOk = !twins.length && b.lc >= 0.9 && b.sc >= 0.55;
      } else if (b && b.sc >= 0.3) { R.cands = C.slice(0, 5).map((x) => x.r); }
    }
    // 4. pilih qty: buang angka yang sebenarnya bagian nama SKU terpilih (377, 02, 5.5 …)
    let Q = nums.slice();
    if (R.sku) { const nt = R.sku.tk.filter((t) => /^\d/.test(t)).slice(); Q = Q.filter((q) => { if (q.u || q.mark) return true; const i = nt.findIndex((t) => t.replace(/^0+(?=\d)/, '') == q.s.replace(/^0+(?=\d)/, '') || t == q.s + (q.glued || '')); if (i >= 0) { nt.splice(i, 1); return false; } return !q.glued; }); }
    else Q = Q.filter((q) => !q.glued);
    const strong = Q.filter((q) => q.u && q.u != 'X' || q.mark);
    let pick = null;
    if (strong.length == 1) pick = strong[0];
    else if (strong.length > 1) { pick = strong[strong.length - 1]; R.why.push('Ada beberapa angka qty (' + strong.map((q) => q.s + (q.u && q.u != 'X' ? ' ' + q.u.toLowerCase() : '')).join(', ') + ')'); }
    else if (Q.length == 1) pick = Q[0];
    else if (Q.length > 1) { pick = Q[Q.length - 1]; R.why.push('Ada beberapa angka (' + Q.map((q) => q.s).join(', ') + ') — qty diambil ' + pick.s); }
    // kode ditulis tanpa awalan, mis. "35 = 2" / "35 2pcs": angka pertama = ekor kode SKU yang unik
    if (!R.sku && Q.length >= 2 && X.pre.length) {
      const first = Q[0], L = X.byTail.get('*|' + tailKey(first.s)) || [];
      if (L.length == 1 && !first.u && pick !== first) { R.sku = L[0]; R.why.push('Kode ditulis tanpa awalan (' + first.s + ' → ' + L[0].c + ') — pastikan benar'); R.tailGuess = true; }
    }
    if (pick) { R.qty = pick.v; const u = pick.u; if (ULSN.test(u)) { R.unit = 'lsn'; R.mul = 12; } else if (UDUS.test(u)) { R.unit = 'dus'; R.mul = R.sku && R.sku.isi ? R.sku.isi : null; } else R.unit = 'pcs'; }
    // 5. jenis baris & status
    if (!R.sku && !R.qty && !R.badCode) { R.kind = /\d/.test(s) ? 'item' : 'info'; if (R.kind == 'info') { R.val = R.raw; return R; } }
    if (!R.sku) { R.conf = 'x'; R.why.unshift(R.badCode ? 'Kode ' + R.badCode + ' tidak ada di daftar harga' : 'SKU tidak dikenali'); }
    else {
      R.code = codeTxt;
      R.conf = (R.byName && !R.nameOk) || R.tailGuess ? 'cek' : 'ok';
      if (R.qty == null) { R.conf = 'cek'; R.why.push('Qty tidak ditemukan'); }
      else if (!(R.qty > 0)) { R.conf = 'cek'; R.why.push('Qty 0'); }
      if (R.mul == null) { R.conf = 'cek'; R.why.push('Satuan dus — isi per dus belum ada di daftar harga, isi qty dalam pcs'); }
      if (R.qty != null && R.qty % 1 && R.mul == 1) { R.conf = 'cek'; R.why.push('Qty pecahan'); }
      if (!(R.sku.p > 0)) { R.conf = 'cek'; R.why.push('Harga SKU ini 0 di daftar harga'); }
      if (R.why.length && R.conf == 'ok' && /beberapa/.test(R.why.join())) R.conf = 'cek';
    }
    return R;
  }
  /** pecah teks orderan menjadi baris item (koma/titik-koma memisah item bila tiap bagian punya angka) */
  function split(text) {
    const out = [];
    String(text || '').replace(/\r/g, '').split(/\n|;/).forEach((L) => {
      const parts = L.split(/,(?!\d)|(?<!\d),/);
      if (parts.length > 1 && parts.every((p) => /\d/.test(p) && /[A-Za-z]/.test(p))) parts.forEach((p) => out.push(p)); else out.push(L);
    });
    return out;
  }
  function text(X, txt) {
    const L = split(txt).map((l) => line(X, l)).filter((r) => r.kind != 'skip');
    const info = { sales: '', outlet: '', wrote: 0 };
    L.forEach((r) => { if (r.kind == 'info' && r.tag) info[r.tag] = info[r.tag] || r.val; if (r.kind == 'total' && r.amt) info.wrote = r.amt; });
    if (!info.outlet) { const f = L.find((r) => r.kind == 'info' && !r.tag); const firstItem = L.findIndex((r) => r.kind == 'item'); if (f && L.indexOf(f) < firstItem) info.outlet = f.raw; }
    return { lines: L.filter((r) => r.kind == 'item'), notes: L.filter((r) => r.kind == 'info'), info };
  }
  const pcs = (r) => (r.qty == null || r.mul == null ? 0 : r.qty * r.mul);
  const sub = (r) => (r.sku ? pcs(r) * r.sku.p : 0);
  function sum(lines) {
    const ok = lines.filter((r) => r.sku && r.kind != 'del');
    const per = new Map();
    ok.forEach((r) => { const k = r.sku.c || r.sku.n; const o = per.get(k) || { sku: r.sku, pcs: 0, rp: 0, n: 0 }; o.pcs += pcs(r); o.rp += sub(r); o.n++; per.set(k, o); });
    return { tot: ok.reduce((a, r) => a + sub(r), 0), pcs: ok.reduce((a, r) => a + pcs(r), 0), per: [...per.values()], cek: lines.filter((r) => r.kind != 'del' && r.conf != 'ok').length, n: ok.length };
  }
  /** baris daftar harga dari Excel/CSV (array 2D). Mencari baris judul otomatis (PRODUCT CODE/KODE, DESCRIPTION/NAMA, DBP/HPP/HARGA, ISI). */
  function sheet(aoa) {
    const H = { c: /^(PRODUCT ?CODE|KODE( ?(SKU|BARANG|BRG|PRODUK))?|KD( ?SKU)?|SKU|CODE|ITEM ?CODE|PLU|ARTICLE)$/, n: /^(DESCRIPTION|DESKRIPSI|NAMA( ?(SKU|BARANG|BRG|PRODUK))?|PRODUCT( ?NAME)?|PRODUK|ITEM( ?NAME)?|BARANG)$/, p: /(DBP|HPP|HARGA|PRICE|HNA|COGS|NET)/, isi: /^(ISI|ISI ?(PER ?)?(DUS|CTN|KARTON|BOX)|PCS ?\/ ?(DUS|CTN)|QTY ?\/ ?CTN|UOM ?CONV|KONVERSI|PACK ?SIZE)$/ };
    let hi = -1, col = null;
    for (let i = 0; i < Math.min(aoa.length, 30); i++) {
      const r = (aoa[i] || []).map((x) => norm(x).replace(/[^A-Z0-9 /%+]/g, ' ').replace(/\s+/g, ' ').trim());
      const c = { c: r.findIndex((x) => H.c.test(x)), n: r.findIndex((x) => H.n.test(x)), p: -1, isi: r.findIndex((x) => H.isi.test(x)) };
      // harga: prioritas kolom yang memuat PPN (DBP+PPN) bila ada, lalu DBP/HPP/HARGA pertama
      const pp = r.map((x, j) => [x, j]).filter(([x]) => H.p.test(x) && !H.isi.test(x));
      if (pp.length) c.p = (pp.find(([x]) => /PPN|INC|\+/.test(x)) || pp[0])[1];
      if (c.c >= 0 && c.p >= 0 && (c.n >= 0 || true)) { hi = i; col = c; break; }
    }
    if (hi < 0) return { rows: [], err: 'Judul kolom tidak ditemukan. Butuh kolom KODE (Product Code) dan HARGA (DBP/HPP), plus NAMA (Description).' };
    const rows = [], seen = new Set(), dup = [];
    for (let i = hi + 1; i < aoa.length; i++) {
      const r = aoa[i] || [], c = String(r[col.c] ?? '').trim(), n = col.n >= 0 ? String(r[col.n] ?? '').trim() : '';
      if (!c && !n) continue;
      let pv = r[col.p]; if (typeof pv == 'string') { pv = pv.replace(/rp/i, '').trim(); pv = /,\d{1,3}$/.test(pv) ? pv.replace(/\./g, '').replace(',', '.') : pv.replace(/,/g, ''); }
      const p = +pv || 0, isi = col.isi >= 0 ? +r[col.isi] || 0 : 0;
      const k = nc(c); if (k && seen.has(k)) dup.push(c); if (k) seen.add(k);
      rows.push({ c, n, p, isi });
    }
    return { rows, dup, head: hi, cols: col };
  }
  return { index, line, text, sum, pcs, sub, sheet, norm, nc, toks, byCode };
})();
if (typeof module != 'undefined') module.exports = HOX;
