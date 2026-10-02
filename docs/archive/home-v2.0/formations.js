// 3B "dünya" formasyonları — hepsi aynı sayıda (N) noktadan oluşur; scroll ile biri diğerine dönüşür.
// Saf hesaplama: DOM veya three bağımlılığı yok (Node'da test edilebilir).
//
//   0 Ufuk          — veri arazisi (açılış)
//   1 Defter        — üst üste duran defter yaprakları          (Vergi)
//   2 Örnekleme     — 3B kafes + vurgulanan örnekler            (Denetim)
//   3 Yapı ağacı    — dallanan organizasyon yapısı              (Danışmanlık)
//   4 Ritim halkası — 12 aylık halka, artan sütunlar            (İK / Bordro)
//   5 Veri katmanı  — çubuk şehri                               (Sistemler)
//   6 Sütunlar      — iki sıra sütun + alınlık                  (Akademi)
//   7 Kapı          — kemer ve ona uzanan yol                   (Kapanış)

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nokta toplayıcı
class Pts {
  constructor() {
    this.x = [];
    this.y = [];
    this.z = [];
    this.s = [];
    this.t = [];
  }
  add(x, y, z, s = 1, t = 0) {
    this.x.push(x);
    this.y.push(y);
    this.z.push(z);
    this.s.push(s);
    this.t.push(t);
  }
  get n() {
    return this.x.length;
  }
}

/* ───────────────────────── formasyonlar ───────────────────────── */

// Arazi: ortada sakin bir "yol" vadisi, yanlarda tepeler, uzakta düşük bir dağ silsilesi
function terrain(x, z) {
  const dist = Math.max(0, 16.5 - z);
  const valley = 0.4 + 0.6 * smooth(3, 17, Math.abs(x));
  const base =
    -3.7 +
    valley * (1.35 * Math.sin(x * 0.17 + z * 0.09) * Math.cos(z * 0.16) + 0.75 * Math.sin(x * 0.41 - z * 0.23 + 1.3)) +
    0.35 * Math.sin(z * 0.5 + x * 0.12);
  const far = smooth(34, 92, dist);
  const range = far * (2.6 + 2.4 * Math.sin(x * 0.065 + 1.3) + 1.5 * Math.sin(x * 0.17 + z * 0.05) + 0.8 * Math.sin(x * 0.43));
  return base + range * (0.45 + 0.55 * smooth(4, 40, Math.abs(x)));
}

// Satırlar ekranda eşit aralıklı görünsün diye derinlik, bakış açısının tanjantına göre dağıtılır (klasik "arazi çizimi").
function horizon(p, rnd, Nf) {
  const rows = Math.max(36, Math.min(72, Math.round(Math.sqrt(Nf / 4.2))));
  const per = Math.ceil(Nf / rows);
  const h = 5.9; // kamera yüksekliği (arazi ortalamasına göre)
  const tMax = 0.33; // en yakın satır
  const tMin = 0.062; // en uzak satır
  for (let r = 0; r < rows; r++) {
    const tn = tMax - (tMax - tMin) * (r / (rows - 1));
    const dist = h / tn;
    const z = 16.5 - dist;
    const half = Math.max(16, dist * 0.84);
    for (let i = 0; i < per; i++) {
      const u = (i + rnd() * 0.6) / per;
      const x = (u - 0.5) * 2 * half;
      p.add(x, terrain(x, z), z, 0.8 + rnd() * 0.6, rnd() < 0.012 ? 1 + Math.floor(rnd() * 3) : 0);
    }
  }
}

function ledger(p, rnd, Nf) {
  const sheets = 6;
  const per = Math.floor(Nf / sheets);
  for (let k = 0; k < sheets; k++) {
    const y = -2.5 + k * 0.98;
    const ry = (k - 2.5) * 0.085;
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const W = 13;
    const D = 8.6;
    const put = (x, z, s, t) => p.add(x * cs - z * sn, y + (rnd() - 0.5) * 0.02, x * sn + z * cs, s, t);
    const lines = 16;
    const nLine = Math.floor((per * 0.74) / lines);
    for (let l = 0; l < lines; l++) {
      const z = -D / 2 + (l / (lines - 1)) * D;
      for (let i = 0; i < nLine; i++) put(-W / 2 + ((i + rnd() * 0.5) / nLine) * W, z, 0.85 + rnd() * 0.5, k === 5 && rnd() < 0.03 ? 1 + Math.floor(rnd() * 3) : 0);
    }
    // kenar çerçevesi + sol boşluk çizgisi
    const nEdge = Math.floor(per * 0.26);
    for (let i = 0; i < nEdge; i++) {
      const u = i / nEdge;
      const e = Math.floor(rnd() * 5);
      if (e === 0) put(-W / 2 + u * W, -D / 2, 1.2, 0);
      else if (e === 1) put(-W / 2 + u * W, D / 2, 1.2, 0);
      else if (e === 2) put(-W / 2, -D / 2 + u * D, 1.2, 0);
      else if (e === 3) put(W / 2, -D / 2 + u * D, 1.2, 0);
      else put(-W / 2 + 1.6, -D / 2 + u * D, 1.0, k === 5 ? 3 : 0);
    }
  }
}

function sampling(p, rnd, Nf) {
  // kafes, nokta sayısına göre ölçeklenir (toplam boyut sabit kalır)
  const sc = Math.cbrt((Nf * 0.8) / (22 * 14 * 14));
  const nx = Math.round(22 * sc);
  const ny = Math.round(14 * sc);
  const nz = Math.round(14 * sc);
  const sp = 0.56 / sc;
  const flagP = 240 / (nx * ny * nz);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) {
        const flag = rnd() < flagP;
        p.add((i - (nx - 1) / 2) * sp + (rnd() - 0.5) * 0.09, (j - (ny - 1) / 2) * sp + (rnd() - 0.5) * 0.09, (k - (nz - 1) / 2) * sp + (rnd() - 0.5) * 0.09, flag ? 3.3 : 0.8 + rnd() * 0.4, flag ? 1 + Math.floor(rnd() * 3) : 0);
      }
  // kalan: kafes içinde rastgele (sönük)
  while (p.n < Nf) p.add((rnd() - 0.5) * nx * sp, (rnd() - 0.5) * ny * sp, (rnd() - 0.5) * nz * sp, 0.6 + rnd() * 0.4, 0);
}

function tree(p, rnd, Nf) {
  const segs = [];
  const nodes = [];
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const grow = (a, dir, len, depth) => {
    const b = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len];
    segs.push({ a, b, len, depth });
    nodes.push(b);
    if (depth >= 5) return;
    const kids = depth < 2 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const ang = (k / kids) * TAU + rnd() * 0.9;
      const spread = depth < 2 ? 0.95 : 0.75;
      const nd = norm([dir[0] + Math.cos(ang) * spread, dir[1] * 0.9 + 0.35, dir[2] + Math.sin(ang) * spread]);
      grow(b, nd, len * 0.74, depth + 1);
    }
  };
  grow([0, -4.2, 0], [0, 1, 0], 2.7, 0);
  const total = segs.reduce((s, g) => s + g.len, 0);
  const nNode = Math.min(nodes.length * 7, Math.floor(Nf * 0.18));
  const nLine = Nf - nNode;
  for (const g of segs) {
    const n = Math.max(6, Math.round((g.len / total) * nLine));
    for (let i = 0; i < n; i++) {
      const u = (i + rnd()) / n;
      p.add(g.a[0] + (g.b[0] - g.a[0]) * u + (rnd() - 0.5) * 0.04, g.a[1] + (g.b[1] - g.a[1]) * u, g.a[2] + (g.b[2] - g.a[2]) * u + (rnd() - 0.5) * 0.04, 0.8 + (5 - g.depth) * 0.1, 0);
    }
  }
  for (let i = 0; i < nNode; i++) {
    const c = nodes[i % nodes.length];
    const r = Math.pow(rnd(), 0.6) * 0.22;
    const a = rnd() * TAU;
    const b = Math.acos(2 * rnd() - 1);
    p.add(c[0] + r * Math.sin(b) * Math.cos(a), c[1] + r * Math.cos(b), c[2] + r * Math.sin(b) * Math.sin(a), 2.4, rnd() < 0.2 ? 1 + Math.floor(rnd() * 3) : 0);
  }
}

function ring(p, rnd, Nf) {
  const R = 5.3;
  const gap = 0.07;
  const span = TAU / 12 - gap;
  const nBar = Math.floor(Nf * 0.8);
  const heights = Array.from({ length: 12 }, (_, m) => 0.45 + m * 0.2 + Math.sin(m * 1.7) * 0.12);
  const totalH = heights.reduce((a, b) => a + b, 0);
  for (let m = 0; m < 12; m++) {
    const a0 = (m / 12) * TAU + gap / 2 - Math.PI / 2;
    const n = Math.round((heights[m] / totalH) * nBar);
    for (let i = 0; i < n; i++) {
      const a = a0 + rnd() * span;
      const r = R - 0.5 + rnd() * 1.0;
      // yüzeylere (dış/iç/üst) ağırlık: hacmin içini seyrek bırak
      const face = rnd();
      let rr = r;
      let hh = rnd() * heights[m];
      if (face < 0.34) rr = R + 0.5;
      else if (face < 0.62) rr = R - 0.5;
      else if (face < 0.82) hh = heights[m];
      p.add(Math.cos(a) * rr, -3.2 + hh, Math.sin(a) * rr, 0.85 + rnd() * 0.5, m === 11 && rnd() < 0.1 ? 3 : 0);
    }
  }
  // iç ışınlar (ay sınırları) ve merkez halkası
  while (p.n < Nf) {
    if (rnd() < 0.75) {
      const m = Math.floor(rnd() * 12);
      const a = (m / 12) * TAU - Math.PI / 2;
      const r = 1.9 + rnd() * (R - 0.9 - 1.9);
      p.add(Math.cos(a) * r, -3.2, Math.sin(a) * r, 0.7, 0);
    } else {
      const a = rnd() * TAU;
      p.add(Math.cos(a) * 1.25, -3.2, Math.sin(a) * 1.25, 1.0, rnd() < 0.15 ? 1 : 0);
    }
  }
}

function strata(p, rnd, Nf) {
  const gx = 11;
  const gz = 8;
  const sp = 1.12;
  const bars = [];
  let totalH = 0;
  for (let i = 0; i < gx; i++)
    for (let k = 0; k < gz; k++) {
      const h = 0.5 + 3.4 * (0.5 + 0.5 * Math.sin(i * 0.72 + k * 0.4) * Math.cos(k * 0.62 - i * 0.18));
      bars.push({ x: (i - (gx - 1) / 2) * sp, z: (k - (gz - 1) / 2) * sp, h });
      totalH += h;
    }
  for (const b of bars) {
    const n = Math.max(8, Math.round((b.h / totalH) * Nf));
    const w = 0.34;
    for (let i = 0; i < n; i++) {
      const f = rnd();
      const y = -4 + rnd() * b.h;
      if (f < 0.55) {
        const c = Math.floor(rnd() * 4);
        p.add(b.x + (c % 2 ? w : -w), y, b.z + (c < 2 ? w : -w), 0.85 + rnd() * 0.4, 0);
      } else if (f < 0.85) {
        p.add(b.x + (rnd() - 0.5) * 2 * w, -4 + b.h, b.z + (rnd() - 0.5) * 2 * w, 1.15, rnd() < 0.06 ? 1 + Math.floor(rnd() * 3) : 0);
      } else {
        const side = Math.floor(rnd() * 4);
        const u = (rnd() - 0.5) * 2 * w;
        p.add(b.x + (side < 2 ? u : side === 2 ? w : -w), y, b.z + (side < 2 ? (side === 0 ? w : -w) : u), 0.7, 0);
      }
    }
  }
  while (p.n < Nf) p.add((rnd() - 0.5) * gx * sp, -4, (rnd() - 0.5) * gz * sp, 0.6, 0);
}

function colonnade(p, rnd, Nf) {
  const cols = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) cols.push({ x: -5.5 + i * 2.2, z: row ? 2.7 : -2.7 });
  const H = 5;
  const perCol = Math.floor((Nf * 0.72) / cols.length);
  for (const c of cols) {
    for (let i = 0; i < perCol; i++) {
      const y = -4 + rnd() * H;
      const a = rnd() * TAU;
      const ring = rnd() < 0.45;
      const rr = 0.42 + (y < -3.8 || y > 0.8 ? 0.08 : 0);
      const flute = Math.round(a / (TAU / 10)) * (TAU / 10);
      p.add(c.x + Math.cos(ring ? a : flute) * rr, ring ? Math.round(y * 3) / 3 : y, c.z + Math.sin(ring ? a : flute) * rr, 0.8 + rnd() * 0.4, 0);
    }
  }
  // alınlık (kiriş) ve üçgen alın
  const rest = Nf - p.n;
  for (let i = 0; i < rest; i++) {
    const f = rnd();
    const zz = rnd() < 0.5 ? -2.7 : 2.7;
    if (f < 0.55) p.add(-6.6 + rnd() * 13.2, 1.1 + rnd() * 0.45, zz + (rnd() - 0.5) * 0.7, 1.0, 0);
    else if (f < 0.85) {
      const side = rnd() < 0.5 ? -1 : 1;
      const u = rnd();
      p.add(side * 6.6 * (1 - u), 1.55 + u * 1.7, zz, 1.0, u > 0.97 ? 1 : 0);
    } else {
      const step = Math.floor(rnd() * 3);
      const e = Math.floor(rnd() * 4);
      const hw = 7.2 + step * 0.5;
      const hd = 4 + step * 0.5;
      const u = rnd();
      const y = -4;
      if (e === 0) p.add(-hw + u * 2 * hw, y, -hd, 0.8, 0);
      else if (e === 1) p.add(-hw + u * 2 * hw, y, hd, 0.8, 0);
      else if (e === 2) p.add(-hw, y, -hd + u * 2 * hd, 0.8, 0);
      else p.add(hw, y, -hd + u * 2 * hd, 0.8, 0);
    }
  }
}

function gate(p, rnd, Nf) {
  const Ro = 5.4;
  const Ri = 4.0;
  const nArch = Math.floor(Nf * 0.62);
  for (let i = 0; i < nArch; i++) {
    const f = rnd();
    const z = (rnd() - 0.5) * 1.1;
    if (f < 0.62) {
      const a = rnd() * Math.PI;
      const r = rnd() < 0.5 ? Ro : Ri + rnd() * (Ro - Ri);
      p.add(Math.cos(a) * r, 0.6 + Math.sin(a) * r, rnd() < 0.5 ? z : rnd() < 0.5 ? -0.55 : 0.55, 0.9 + rnd() * 0.5, 0);
    } else {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = side * (Ri + rnd() * (Ro - Ri));
      p.add(x, -4.2 + rnd() * 4.8, rnd() < 0.5 ? z : rnd() < 0.5 ? -0.55 : 0.55, 0.9 + rnd() * 0.4, rnd() < 0.015 ? 1 + Math.floor(rnd() * 3) : 0);
    }
  }
  // kemere uzanan yol: yan çizgiler ve kısa çizgiler
  while (p.n < Nf) {
    const f = rnd();
    const z = 0.8 + rnd() * 17;
    const half = 0.9 + z * 0.16;
    if (f < 0.55) p.add((rnd() < 0.5 ? -1 : 1) * half, -4.2, z, 1.0, 0);
    else if (Math.floor(z * 1.2) % 2 === 0) p.add((rnd() - 0.5) * 0.18, -4.2, z, 0.9, rnd() < 0.1 ? 2 : 0);
    else p.add((rnd() < 0.5 ? -1 : 1) * (half * 0.5), -4.2, z, 0.7, 0);
  }
}

/* ───────────────────────── kamera pozları ───────────────────────── */
// Formasyon sahnenin ortasındadır (x=0). Kamera sola kayar (düz çeviri, açı yok) → formasyon ekranın sağ yarısında görünür.
export const POSES = [
  { pos: [0, 2.2, 16.5], look: [0, -1.5, -14], fov: 48, bright: 1.1 }, // 0 ufuk
  { pos: [-4.2, 7.2, 18.5], look: [-4.2, -0.4, 0], fov: 44, bright: 1.2 }, // 1 defter
  { pos: [-4.2, 2.0, 20.5], look: [-4.2, 0.0, 0], fov: 44, bright: 1.15 }, // 2 örnekleme
  { pos: [-4.2, 1.8, 21.0], look: [-4.2, 0.4, 0], fov: 44, bright: 1.15 }, // 3 ağaç
  { pos: [-4.2, 5.4, 18.5], look: [-4.2, -1.4, 0], fov: 44, bright: 1.15 }, // 4 halka
  { pos: [-4.2, 4.6, 19.5], look: [-4.2, -0.6, 0], fov: 44, bright: 1.15 }, // 5 çubuklar
  { pos: [-4.6, 1.8, 24.0], look: [-4.6, -0.5, 0], fov: 44, bright: 1.2 }, // 6 sütunlar
  { pos: [0, 0.6, 16.0], look: [0, -0.2, 0], fov: 48, bright: 1.05 }, // 7 kapı
];

const BUILDERS = [horizon, ledger, sampling, tree, ring, strata, colonnade, gate];

/* ───────────────────────── Morton sıralama ───────────────────────── */
function part1by2(x) {
  x &= 0x3ff;
  x = (x | (x << 16)) & 0x030000ff;
  x = (x | (x << 8)) & 0x0300f00f;
  x = (x | (x << 4)) & 0x030c30c3;
  x = (x | (x << 2)) & 0x09249249;
  return x;
}

function mortonOrder(p) {
  const n = p.n;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    min[0] = Math.min(min[0], p.x[i]);
    max[0] = Math.max(max[0], p.x[i]);
    min[1] = Math.min(min[1], p.y[i]);
    max[1] = Math.max(max[1], p.y[i]);
    min[2] = Math.min(min[2], p.z[i]);
    max[2] = Math.max(max[2], p.z[i]);
  }
  const codes = new Uint32Array(n);
  const q = (v, a, b) => Math.min(1023, Math.max(0, Math.floor(((v - a) / (b - a || 1)) * 1023)));
  for (let i = 0; i < n; i++) {
    codes[i] = (part1by2(q(p.x[i], min[0], max[0])) | (part1by2(q(p.y[i], min[1], max[1])) << 1) | (part1by2(q(p.z[i], min[2], max[2])) << 2)) >>> 0;
  }
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => codes[a] - codes[b]);
  return idx;
}

/** Formasyonları üretir. Dönen her öğe: {pos(3N), size(N), tint(N), pose}. */
export function buildFormations(N, seed = 20260101) {
  const Nf = Math.floor(N * 0.9);
  const Nd = N - Nf;
  // sabit "toz": her formasyonda aynı yerde, sönük
  const dr = mulberry32(seed ^ 0x9e3779b9);
  const dust = { pos: new Float32Array(Nd * 3), size: new Float32Array(Nd), tint: new Float32Array(Nd) };
  for (let i = 0; i < Nd; i++) {
    dust.pos[i * 3] = (dr() - 0.5) * 70;
    dust.pos[i * 3 + 1] = (dr() - 0.5) * 24;
    dust.pos[i * 3 + 2] = -30 + dr() * 55;
    dust.size[i] = 0.5 + dr() * 0.6;
  }
  return BUILDERS.map((build, k) => {
    const rnd = mulberry32(seed + k * 7919);
    const p = new Pts();
    build(p, rnd, Nf);
    // tam Nf noktaya getir
    while (p.n < Nf) {
      const j = Math.floor(rnd() * p.n);
      p.add(p.x[j] + (rnd() - 0.5) * 0.06, p.y[j] + (rnd() - 0.5) * 0.06, p.z[j] + (rnd() - 0.5) * 0.06, p.s[j], 0);
    }
    let order = mortonOrder(p);
    if (order.length > Nf) {
      // fazlalığı rastgele ele (Morton sırasını bozmadan, uzamsal önyargı olmasın)
      const drop = new Set();
      while (drop.size < order.length - Nf) drop.add(Math.floor(rnd() * order.length));
      order = order.filter((_, i) => !drop.has(i));
    }
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const tint = new Float32Array(N);
    for (let i = 0; i < Nf; i++) {
      const j = order[i];
      pos[i * 3] = p.x[j];
      pos[i * 3 + 1] = p.y[j];
      pos[i * 3 + 2] = p.z[j];
      size[i] = p.s[j];
      tint[i] = p.t[j];
    }
    pos.set(dust.pos, Nf * 3);
    size.set(dust.size, Nf);
    return { pos, size, tint, pose: POSES[k], name: BUILDERS[k].name };
  });
}
