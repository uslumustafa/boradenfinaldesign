
// Hizmet kavramı formasyonları — denetim, vergi, raporlama ve danışmanlık işinin kendi sözcüklerinden (terazi, bilanço, mühür, mutabakat…).
// Saf hesaplama; yerleşim: x ∈ [−6,5, 6,5], y ∈ [−4,2, 4,2], z ∈ [−3,5, 3,5].
import { Draw, X, Y, Z, TAU } from './draw.js';

const FLOOR = -4.0;

/* ── Terazi — bağımsız denetim: bağımsızlık ve denge. İki kefe, kiriş, sütun; kefelerde mavi/yeşil kayıt bulutları */
export function terazi(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const yb = 2.7;
  const arm = 4.6;
  const rim = 1.7;
  const py = -0.2;
  // taban ve sütun
  d.circle([0, FLOOR, 0], X, Z, 2.2, { s: 1.0, d: 1.3 });
  d.circle([0, FLOOR, 0], X, Z, 1.4, { s: 0.9, d: 1.0 });
  d.circle([0, FLOOR + 0.28, 0], X, Z, 0.8, { s: 0.9, d: 0.9 });
  d.line([0, FLOOR, 0], [0, yb, 0], { s: 1.1, d: 2.2 });
  d.circle([0, FLOOR + 1.2, 0], X, Z, 0.34, { s: 0.9, d: 1.0 });
  d.circle([0, FLOOR + 2.2, 0], X, Z, 0.28, { s: 0.9, d: 1.0 });
  // kiriş ve tepelik
  d.line([-arm, yb, 0], [arm, yb, 0], { s: 1.15, d: 2.4 });
  d.circle([0, yb + 0.62, 0], X, Y, 0.56, { s: 1.0, d: 1.2 });
  d.node([0, yb, 0], 0.26, 22, { t: 0 });
  // kefeler
  for (const sx of [-1, 1]) {
    const cx = sx * arm;
    d.node([cx, yb, 0], 0.2, 12, { t: 0 });
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + (k * TAU) / 3;
      d.line([cx, yb, 0], [cx + Math.cos(a) * rim, py, Math.sin(a) * rim * 0.9], { s: 0.8, d: 0.85 });
    }
    d.circle([cx, py, 0], X, Z, rim, { s: 1.05, d: 1.4 });
    d.circle([cx, py - 0.26, 0], X, Z, rim * 0.72, { s: 0.9, d: 1.0 });
    d.circle([cx, py - 0.46, 0], X, Z, rim * 0.36, { s: 0.9, d: 0.9 });
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      d.line([cx + Math.cos(a) * rim * 0.36, py - 0.46, Math.sin(a) * rim * 0.36], [cx + Math.cos(a) * rim, py, Math.sin(a) * rim], { s: 0.7, d: 0.5 });
    }
    d.cloud([cx, py + 0.4, 0], [1.05, 0.38, 1.05], 46, { t: sx < 0 ? 1 : 3, s: 0.9 });
  }
  d.done(Nf);
}

/* ── Bilanço — UFRS/TFRS, finansal tablo: aktif ile pasif eşit yükseklikte; kalemler ayrı katlar */
export function bilanco(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const towers = [
    { x: -3.5, layers: [[3.0, 1], [2.4, 0], [1.6, 1]] }, // duran varlıklar, dönen varlıklar, hazır değerler
    { x: 3.5, layers: [[2.4, 2], [1.6, 2], [3.0, 3]] }, // kısa vadeli, uzun vadeli yükümlülükler, özkaynak
  ];
  for (const T of towers) {
    let y = FLOOR;
    for (const [h, t] of T.layers) {
      d.box([T.x, y + h / 2, 0], [3.5, h, 2.6], { t, s: 0.95 }, { front: Math.max(2, Math.round(h * 1.5)), right: 2, left: 2, top: 2 });
      y += h + 0.1;
    }
  }
  // eşitlik işareti
  d.line([-1.1, 0.45, 0], [1.1, 0.45, 0], { s: 1.2, d: 2.2 });
  d.line([-1.1, -0.45, 0], [1.1, -0.45, 0], { s: 1.2, d: 2.2 });
  // ölçü çizgisi: iki kulenin aynı yükseklikte bittiği
  const top = FLOOR + 7.2 + 0.5;
  d.line([-5.25, top, 0], [5.25, top, 0], { t: 3, s: 0.95, d: 1.2 });
  d.line([-5.25, top, 0], [-5.25, top - 0.45, 0], { t: 3, s: 0.95, d: 1.2 });
  d.line([5.25, top, 0], [5.25, top - 0.45, 0], { t: 3, s: 0.95, d: 1.2 });
  d.node([0, top, 0], 0.2, 12, { t: 3 });
  // zemin levhası
  d.rect([0, FLOOR - 0.1, 0], X, Z, 13.2, 3.6, { s: 1.0, d: 1.1 });
  d.hatch([0, FLOOR - 0.1, 0], X, Z, 13.2, 3.6, 5, { s: 0.7, d: 0.55 });
  d.done(Nf);
}

/* ── Mühür — tam tasdik, yeminli mali müşavirlik, yasal metinler: madeni para gibi kalınlıklı mühür; gilloş rozet, onay işareti */
export function muhur(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const R = 4.0;
  const zs = [-0.28, 0.28];
  for (const z of zs) {
    d.circle([0, 0, z], X, Y, R, { s: 1.05, d: 1.6 });
    d.circle([0, 0, z], X, Y, R * 0.94, { s: 0.8, d: 0.9 });
    d.circle([0, 0, z], X, Y, R * 0.68, { s: 1.0, d: 1.3 });
    d.circle([0, 0, z], X, Y, R * 0.16, { s: 0.9, d: 0.8 });
    // kenar çizgileri (damga halkası)
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      d.line([c * R * 0.74, s * R * 0.74, z], [c * R * 0.89, s * R * 0.89, z], { s: 0.75, d: 0.8, t: i % 6 === 0 ? 1 : 0 });
    }
  }
  // madeni para kenarı: iki yüzü bağlayan kısa çizgiler
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU;
    d.line([Math.cos(a) * R, Math.sin(a) * R, zs[0]], [Math.cos(a) * R, Math.sin(a) * R, zs[1]], { s: 0.8, d: 0.9 });
  }
  // gilloş rozet (hipotrokoid): ön yüzde ve arka yüzde farklı faz
  const rosette = (z, a, b, c, rot, t) =>
    d.curve(
      (u) => {
        const tt = u * TAU * (b / gcd(a, b));
        const x = (a - b) * Math.cos(tt) + c * Math.cos(((a - b) / b) * tt);
        const y = (a - b) * Math.sin(tt) - c * Math.sin(((a - b) / b) * tt);
        const sc = (R * 0.6) / (a - b + c);
        return [(x * Math.cos(rot) - y * Math.sin(rot)) * sc, (x * Math.sin(rot) + y * Math.cos(rot)) * sc, z];
      },
      { t, s: 0.8, d: 1.35 },
      500
    );
  rosette(0.28, 7, 3, 2.6, 0, 1);
  rosette(-0.28, 7, 3, 2.6, 0.45, 0);
  // onay işareti
  const ck = [[-1.0, -0.05, 0.3], [-0.35, -0.7, 0.3], [1.05, 0.8, 0.3]];
  for (const o of [0, 0.07, -0.07]) d.poly(ck.map(([x, y, z]) => [x, y + o, z]), { t: 3, s: 1.2, d: 1.8 });
  d.done(Nf);
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* ── Mutabakat — cari hesap mutabakatları: iki tarafın kayıtları satır satır eşleşir; eşleşmeyenler kırmızı kalır */
export function mutabakat(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const rows = 12;
  const ys = Array.from({ length: rows }, (_, i) => 3.3 - (i * 6.6) / (rows - 1));
  const xl = -3.2;
  const xr = 3.2;
  const map = [0, 1, 2, 4, 3, -1, 6, 5, 8, 7, 9, 11]; // sol satır → sağ satır (−1: karşılığı yok)
  const missRight = 10; // sağda karşılığı olmayan satır
  for (const [x, inner] of [[xl, 1], [xr, -1]]) {
    d.rect([x, 0, 0], X, Y, 2.5, 8.6, { s: 1.0, d: 1.2 });
    d.line([x - 1.25, 3.75, 0], [x + 1.25, 3.75, 0], { s: 1.0, d: 1.6 });
    ys.forEach((y) => d.line([x - 0.95, y, 0], [x + 0.6, y, 0], { s: 0.75, d: 0.5 }));
    ys.forEach((y) => d.node([x + inner * 1.25, y, 0], 0.07, 4, { s: 1.6 }));
  }
  map.forEach((r, i) => {
    const yl = ys[i];
    if (r < 0) {
      d.line([xl + 1.25, yl, 0], [xl + 2.3, yl, 0], { t: 2, s: 1.0, d: 1.2 });
      d.node([xl + 2.35, yl, 0], 0.16, 10, { t: 2 });
      return;
    }
    const yr = ys[r];
    const ok = r === i;
    const zoff = (ok ? 0.5 : 1.6) * (i % 2 ? 1 : -1);
    d.curve(
      (u) => [xl + 1.25 + (xr - 1.25 - (xl + 1.25)) * u, yl + (yr - yl) * (u * u * (3 - 2 * u)), Math.sin(u * Math.PI) * zoff],
      { t: ok ? 3 : 1, s: 0.85, d: 1.1 },
      50
    );
  });
  const ym = ys[missRight];
  d.line([xr - 1.25, ym, 0], [xr - 2.3, ym, 0], { t: 2, s: 1.0, d: 1.2 });
  d.node([xr - 2.35, ym, 0], 0.16, 10, { t: 2 });
  d.done(Nf);
}

/* ── Dilimler — gelir vergisi dilimleri, kıdem yılı basamakları: basamaklı artan oran; kesikli çizgi marjinal oranı izler */
export function dilimler(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  for (let i = 0; i < 5; i++) {
    const h = 1.0 + i * 1.1;
    const x = -5.0 + i * 2.5;
    const t = i < 2 ? 1 : i < 4 ? 0 : 2;
    d.box([x, FLOOR + h / 2, 0], [2.3, h, 3.0], { t, s: 0.95 }, { top: 4, front: Math.max(2, Math.round(h * 1.5)), right: 2 });
  }
  d.line([-6.2, -2.7, 1.9], [6.2, 3.1, 1.9], { t: 3, s: 0.95, d: 0.8 });
  d.node([6.2, 3.1, 1.9], 0.22, 14, { t: 3 });
  d.rect([0, FLOOR - 0.1, 0], X, Z, 13.6, 3.8, { s: 1.0, d: 1.1 });
  d.done(Nf);
}

/* ── KDV zinciri — KDV iadesi, dolaylı vergiler: her aşamada yüklenilen (mavi) ve hesaplanan (kırmızı) KDV; fark (yeşil) ödenecek tutar */
export function kdvZinciri(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const a = [0.0, 0.9, 2.0, 3.2, 4.5];
  const b = [0.9, 2.0, 3.2, 4.5, 6.0];
  for (let i = 0; i < 5; i++) {
    const x = -5.2 + i * 2.6;
    if (a[i] > 0) d.box([x - 0.6, FLOOR + a[i] / 2, 0], [0.8, a[i], 1.3], { t: 1, s: 0.95 }, { front: Math.max(1, Math.round(a[i] * 1.3)) });
    // hesaplanan: alt kısmı (yüklenilen kadar) kırmızı, fark yeşil
    const lo = a[i];
    const hi = b[i];
    if (lo > 0) d.box([x + 0.6, FLOOR + lo / 2, 0], [0.8, lo, 1.3], { t: 2, s: 0.95 }, { front: Math.max(1, Math.round(lo * 1.3)) });
    d.box([x + 0.6, FLOOR + lo + (hi - lo) / 2, 0], [0.8, hi - lo, 1.3], { t: 3, s: 1.0 }, { front: Math.max(1, Math.round((hi - lo) * 1.5)), top: 2 });
    // aktarım: bu aşamanın hesaplananı sonrakinin yüklenileni olur
    if (i < 4) {
      d.line([x + 1.05, FLOOR + hi, 0], [x + 2.6 - 1.05, FLOOR + hi, 0], { t: 0, s: 0.95, d: 1.0 });
      d.poly([[x + 2.6 - 1.4, FLOOR + hi + 0.2, 0], [x + 2.6 - 1.05, FLOOR + hi, 0], [x + 2.6 - 1.4, FLOOR + hi - 0.2, 0]], { s: 1.0, d: 1.4 });
    }
  }
  d.line([-6.4, FLOOR, 0], [6.4, FLOOR, 0], { s: 1.1, d: 1.6 });
  d.line([-6.4, FLOOR, 0.7], [6.4, FLOOR, 0.7], { s: 0.8, d: 0.6 });
  d.done(Nf);
}

/* ── Nakit şelalesi — mali danışmanlık, değerleme, yönetim raporlaması: açılış bakiyesi, girişler, çıkışlar ve kapanış */
export function nakit(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const k = 0.82;
  const bars = [
    { from: 0, to: 4.4, t: 1 },
    { from: 4.4, to: 7.0, t: 3 },
    { from: 7.0, to: 3.7, t: 2 },
    { from: 3.7, to: 5.1, t: 3 },
    { from: 0, to: 5.1, t: 1 },
  ];
  bars.forEach((B, i) => {
    const lo = Math.min(B.from, B.to) * k;
    const hi = Math.max(B.from, B.to) * k;
    const x = -5.4 + i * 2.7;
    d.box([x, FLOOR + (lo + hi) / 2, 0], [1.6, hi - lo, 1.8], { t: B.t, s: 0.95 }, { front: Math.max(2, Math.round((hi - lo) * 1.6)), top: 3, right: 2 });
    if (i < bars.length - 1) {
      const lvl = FLOOR + B.to * k;
      d.line([x + 0.8, lvl, 0], [x + 2.7 - 0.8, lvl, 0], { s: 0.85, d: 0.9 });
    }
  });
  d.line([-6.4, FLOOR, 0], [6.4, FLOOR, 0], { s: 1.1, d: 1.6 });
  d.line([-6.4, FLOOR, 0.9], [6.4, FLOOR, 0.9], { s: 0.8, d: 0.6 });
  d.done(Nf);
}

/* ── Rasyo radarı — finansal analiz: likidite, kaldıraç, kârlılık… altı oran; mevcut dönem (kırmızı) ve önceki dönem (mavi) */
export function rasyo(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const tilt = 0.5;
  const V = [0, Math.cos(tilt), -Math.sin(tilt)];
  const nrm = [0, Math.sin(tilt), Math.cos(tilt)];
  const c = [0, 0.2, 0];
  const P = (r, k, off = 0) => {
    const a = (k * TAU) / 6 + Math.PI / 2;
    return [c[0] + Math.cos(a) * r + nrm[0] * off, c[1] + V[1] * Math.sin(a) * r + nrm[1] * off, c[2] + V[2] * Math.sin(a) * r + nrm[2] * off];
  };
  [1.05, 2.1, 3.15, 4.2].forEach((r, i) => d.poly(Array.from({ length: 6 }, (_, k) => P(r, k)), { s: i === 3 ? 1.0 : 0.8, d: i === 3 ? 1.3 : 0.7 }, true));
  for (let k = 0; k < 6; k++) {
    d.line(P(0, k), P(4.2, k), { s: 0.75, d: 0.6 });
    d.node(P(4.2, k), 0.12, 6, { s: 1.8 });
  }
  const prev = [2.7, 3.0, 2.2, 2.8, 3.0, 2.0];
  const now = [3.6, 2.3, 3.2, 1.9, 3.9, 2.7];
  d.poly(prev.map((r, k) => P(r, k)), { t: 1, s: 0.9, d: 1.2 }, true);
  // mevcut dönem: gövde (üç kat) + tepe
  for (let o = 0; o < 4; o++) d.poly(now.map((r, k) => P(r, k, o * 0.28)), { t: 2, s: 0.95, d: o === 3 ? 1.5 : 0.7 }, true);
  now.forEach((r, k) => {
    d.line(P(r, k, 0), P(r, k, 0.84), { t: 2, s: 0.85, d: 0.7 });
    d.node(P(r, k, 0.84), 0.2, 12, { t: 2 });
  });
  d.node(P(0, 0, 0), 0.2, 10, { t: 0 });
  d.done(Nf);
}

/* ── Hile üçgeni — usulsüzlük/hile denetimi, suistimal inceleme: baskı, fırsat, gerekçelendirme; içe doğru iç içe üçgenler (derinlemesine inceleme) */
export function hile(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const V = [[0, 3.7, 0], [-4.4, -3.6, 0], [4.4, -3.6, 0]];
  const c = [0, -1.17, 0];
  const at = (k, s) => V.map((q) => [c[0] + (q[0] - c[0]) * s, c[1] + (q[1] - c[1]) * s, -0.62 * k]);
  const layers = [];
  for (let k = 0; k < 5; k++) {
    const q = at(k, 1 - 0.19 * k);
    layers.push(q);
    d.poly(q, { s: k === 0 ? 1.05 : 0.9, d: k === 0 ? 1.8 : 1.0 - k * 0.12, t: k === 0 ? 0 : k < 3 ? 1 : 0 }, true);
  }
  // dış üçgenin ikinci (ön) hattı
  d.poly(at(0, 1).map((q) => [q[0], q[1], 0.32]), { s: 0.9, d: 1.1 }, true);
  // tünel kirişleri
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) d.line(layers[k][j], layers[k + 1][j], { s: 0.75, d: 0.55 });
  // köşeler: üç etken
  layers[0].forEach((q) => d.node([q[0], q[1], q[2] + 0.1], 0.36, 40, { t: 2 }));
  d.node(layers[4][0], 0.14, 8, { t: 0 });
  d.node(layers[4][1], 0.14, 8, { t: 0 });
  d.node(layers[4][2], 0.14, 8, { t: 0 });
  d.done(Nf);
}

/* ── Veri küpü — veri analiz sistemleri, iş zekâsı: boyutlara göre dilimlenen veri; bir dilim (mavi), bir kesit (kırmızı), bir alt küp (yeşil) */
export function kup(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const n = 11;
  const S = 6.4;
  const o = [0, 0.2, 0];
  // yüzey ağları (altı yüz)
  const face = (c, u, v, t, dd) => d.grid(c, u, v, S, S, n, n, { t, s: 0.8, d: dd, w: n * n * 0.5 });
  const h = S / 2;
  face([o[0], o[1], o[2] + h], X, Y, 0, 1.0);
  face([o[0], o[1], o[2] - h], X, Y, 0, 0.7);
  face([o[0] - h, o[1], o[2]], Z, Y, 0, 0.8);
  face([o[0] + h, o[1], o[2]], Z, Y, 0, 0.8);
  face([o[0], o[1] + h, o[2]], X, Z, 0, 0.8);
  face([o[0], o[1] - h, o[2]], X, Z, 0, 0.7);
  d.box(o, [S, S, S], { s: 1.0, d: 1.3 });
  // dilim: x = +0,6 düzlemi (mavi)
  d.grid([o[0] + 0.6, o[1], o[2]], Z, Y, S, S, n, n, { t: 1, s: 1.0, d: 1.8, w: n * n * 0.7 });
  d.rect([o[0] + 0.6, o[1], o[2]], Z, Y, S, S, { t: 1, s: 1.0, d: 1.4 });
  // kesit: y = −1,1 düzlemi (kırmızı, yarım)
  d.grid([o[0] - 1.6, o[1] - 1.1, o[2]], X, Z, S * 0.5, S, 5, n, { t: 2, s: 1.0, d: 1.6, w: 5 * n * 0.8 });
  // alt küp: köşede (yeşil)
  d.box([o[0] + 2.0, o[1] + 2.0, o[2] + 2.0], [2.2, 2.2, 2.2], { t: 3, s: 1.0, d: 1.6 }, { front: 3, top: 3 });
  d.cloud([o[0] + 2.0, o[1] + 2.0, o[2] + 2.0], [1.0, 1.0, 1.0], 40, { t: 3, s: 1.1 });
  d.done(Nf);
}

/* ── Süreç akışı — çözüm prosedürleri, iç kontrol: başlangıç, adımlar, karar ve kontrol noktaları (mavi plan çizimi) */
export function akis(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const box = (x, y, w, h, o, z = 0) => d.rect([x, y, z], X, Y, w, h, { s: 1.0, d: 1.5, ...o });
  const arrow = (a, b, o = {}) => {
    d.line(a, b, { s: 0.95, d: 1.3, ...o });
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    d.poly([[b[0] - ux * 0.35 - uy * 0.2, b[1] - uy * 0.35 + ux * 0.2, b[2]], b, [b[0] - ux * 0.35 + uy * 0.2, b[1] - uy * 0.35 - ux * 0.2, b[2]]], { s: 1.0, d: 1.6, ...o });
  };
  // arka plan: iki kulvar
  [[2.0, 4.0], [-1.7, 3.7]].forEach(([y, hh], i) => {
    d.rect([0, y - hh / 2 + 1.0 - (i ? 0.3 : 0), -0.9], X, Y, 13, hh, { s: 0.7, d: 0.4 });
  });
  // başlangıç (yeşil), işlem adımları, karar (kırmızı), bitiş (yeşil)
  box(-5.0, 2.9, 2.2, 0.9, { t: 3 });
  box(-5.0, 0.6, 2.6, 1.1, { t: 1 });
  box(-1.3, 0.6, 2.6, 1.1, { t: 1 });
  d.poly([[3.4, 1.7, 0.5], [4.8, 0.6, 0.5], [3.4, -0.5, 0.5], [2.0, 0.6, 0.5]], { t: 2, s: 1.0, d: 1.6 }, true);
  box(3.4, -3.0, 2.6, 1.1, { t: 1 });
  d.circle([-1.3, -3.0, 0], X, Y, 0.62, { t: 3, s: 1.0, d: 1.4 });
  arrow([-5.0, 2.45, 0], [-5.0, 1.15, 0]);
  arrow([-3.7, 0.6, 0], [-2.6, 0.6, 0]);
  arrow([0.0, 0.6, 0], [2.0, 0.6, 0.3]);
  arrow([3.4, -0.5, 0.5], [3.4, -2.45, 0]);
  arrow([2.1, -3.0, 0], [-0.68, -3.0, 0]);
  // «hayır» dönüşü: karardan başa
  d.poly([[4.8, 0.6, 0.5], [5.8, 0.6, 0.3], [5.8, 2.9, 0], [-3.9, 2.9, 0]], { t: 2, s: 0.9, d: 1.0 });
  // kontrol noktaları
  [[-3.15, 0.6], [1.0, 0.6], [3.4, -1.5]].forEach(([x, y]) => d.node([x, y, 0.1], 0.14, 8, { t: 0, s: 1.9 }));
  d.done(Nf);
}

/* ── Pay dağılımı — şirket kuruluşu, ticaret sicili, değerleme: sermaye ve ortaklık yapısı; en büyük pay öne çıkar */
export function pay(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const shares = [0.38, 0.27, 0.18, 0.11, 0.06];
  const tints = [1, 0, 3, 2, 1];
  const Ro = 5.0;
  const Ri = 2.5;
  const th = 1.2;
  const yb = -1.4;
  let a0 = -Math.PI / 2;
  shares.forEach((sh, i) => {
    const a1 = a0 + sh * TAU - 0.05;
    const am = (a0 + a1) / 2;
    const lift = i === 0 ? 0.6 : 0;
    const c = [Math.cos(am) * lift, yb + (i === 0 ? 0.5 : 0), Math.sin(am) * lift];
    const o = { t: tints[i], s: 0.95 };
    const top = c[1] + th;
    // üst yüzey: eş merkezli yaylar
    for (let r = Ri; r <= Ro + 0.01; r += (Ro - Ri) / 5) d.arc([c[0], top, c[2]], X, Z, r, a0, a1, { ...o, d: 0.9 });
    // dış ve iç duvarlar
    for (const r of [Ro, Ri]) {
      d.arc([c[0], c[1], c[2]], X, Z, r, a0, a1, { ...o, d: 1.0 });
      d.arc([c[0], c[1] + th * 0.5, c[2]], X, Z, r, a0, a1, { ...o, d: 0.5 });
    }
    // kenar çizgileri (ışınsal) ve köşe dikmeleri
    for (const a of [a0, a1]) {
      const q = (r, y) => [c[0] + Math.cos(a) * r, y, c[2] + Math.sin(a) * r];
      d.line(q(Ri, top), q(Ro, top), { ...o, d: 1.2 });
      d.line(q(Ri, c[1]), q(Ro, c[1]), { ...o, d: 0.8 });
      d.line(q(Ro, c[1]), q(Ro, top), { ...o, d: 1.0 });
      d.line(q(Ri, c[1]), q(Ri, top), { ...o, d: 1.0 });
    }
    a0 = a1 + 0.05;
  });
  d.node([0, yb + th * 0.5, 0], 0.4, 14, { t: 0, s: 1.8 });
  d.done(Nf);
}

/* ── Süre — hizmet borçlanması, emeklilik, kıdem ve ihbar: yıllara yayılan hizmet dönemleri.
   Satır = dönem türü, çubuk = kesintisiz dönem (boşluk = ara), kırmızı kısa çubuk = sonradan eklenen dönem, dikey bayrak = sürenin eşiği */
export function sure(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const xa = -6.0;
  const xb = 6.0;
  const yAxis = -3.0;
  // zaman ekseni: yıl çentikleri (her 4. çentik uzun)
  d.line([xa - 0.3, yAxis, 0], [xb + 0.3, yAxis, 0], { s: 1.0, d: 1.5 });
  for (let k = 0; k <= 12; k++) {
    const big = k % 4 === 0;
    d.line([xa + k, yAxis, 0], [xa + k, yAxis - (big ? 0.5 : 0.25), 0], { s: big ? 1.0 : 0.8, d: big ? 1.4 : 0.8 });
  }
  // dönem çubukları (her satır farklı derinlikte → yandan bakışta paralaks)
  const rows = [
    { y: 2.55, z: 0.9, t: 1, seg: [[-6.0, -2.6], [-2.0, 1.2]] },
    { y: 1.25, z: 0.3, t: 3, seg: [[-4.6, -3.5], [-1.2, 2.4]] },
    { y: -0.05, z: -0.3, t: 0, seg: [[-3.0, 1.6], [2.1, 4.6]] },
    { y: -1.35, z: -0.9, t: 2, seg: [[0.2, 1.4]] },
  ];
  for (const r of rows) {
    // satır kılavuzu
    d.line([xa, r.y, r.z], [xb, r.y, r.z], { s: 0.6, d: 0.28 });
    for (const [a, b] of r.seg) {
      d.box([(a + b) / 2, r.y, r.z], [b - a, 0.5, 0.9], { t: r.t, s: 0.95 }, { top: 3, front: 2 });
    }
  }
  // bayrak: sürenin eşiği
  const fx = 4.9;
  d.line([fx, yAxis, 0], [fx, 3.55, 0], { t: 3, s: 1.0, d: 1.4 });
  d.poly([[fx, 3.55, 0], [fx + 1.0, 3.25, 0], [fx, 2.95, 0]], { t: 3, s: 1.0, d: 1.6 }, true);
  d.node([fx, yAxis, 0], 0.16, 10, { t: 3 });
  // toplam süre ölçüsü: iki uçta çentikli yatay çizgi
  d.line([xa, 3.9, 0], [fx, 3.9, 0], { s: 0.9, d: 1.0 });
  for (const x of [xa, fx]) d.line([x, 3.7, 0], [x, 4.1, 0], { s: 0.9, d: 1.0 });
  d.done(Nf);
}
