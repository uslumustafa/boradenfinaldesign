// Sayfa türü formasyonları — sitenin kendi sayfa ve içerik yapısından: hizmet alanları, sektör × alan dağılımı, vergi takvimi,
// sirküler arşivi, sözlük, kariyer süreci, iletişim yönlendirmesi… (rakamlar src/data altındaki gerçek verilerden alınmıştır).
// Saf hesaplama; yerleşim: x ∈ [−6,5, 6,5], y ∈ [−4,2, 4,2], z ∈ [−3,5, 3,5].
import { Draw, X, Y, Z, TAU } from './draw.js';

const FLOOR = -4.0;
const smooth = (u) => u * u * (3 - 2 * u);
// Hizmet alanı renkleri (sitedeki sırayla: vergi, bağımsız denetim, muhasebe-bordro-raporlama, kurumsal finansman, teşvik, hukuk,
// dijital dönüşüm, akademi) — tüm sayfa şekillerinde aynı
const AREA_TINT = [1, 0, 3, 2, 3, 1, 0, 2];

/* ── Petek — Hizmetler: sekiz alan merkezin çevresinde, her alan bir altıgen kule; kat sayısı = alandaki hizmet sayısı
   (7 · 6 · 19 · 5 · 7 · 7 · 4 · 5 = 60; content.json) */
export function petek(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const R = 1.12;
  const dist = 3.55;
  const counts = [7, 6, 19, 5, 7, 7, 4, 5]; // vergi, bağımsız denetim, muhasebe-bordro, kurumsal finansman, teşvik, hukuk, dijital, akademi
  const tints = AREA_TINT;
  const kat = 0.17;
  const y0 = FLOOR + 0.25;
  const hex = (cx, y, cz, r) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    });
  // zemin: iç içe iki altıgen
  d.poly(hex(0, FLOOR, 0, dist + R + 0.45), { s: 1.0, d: 1.3 }, true);
  d.poly(hex(0, FLOOR, 0, dist + R + 0.85), { s: 0.8, d: 0.6 }, true);
  // merkez
  const hub0 = hex(0, y0, 0, R * 0.6);
  const hub1 = hex(0, y0 + 0.55, 0, R * 0.6);
  d.poly(hub0, { s: 1.0, d: 1.5 }, true);
  d.poly(hub1, { s: 0.95, d: 1.2 }, true);
  hub0.forEach((q, k) => d.line(q, hub1[k], { s: 0.8, d: 0.7 }));
  d.node([0, y0 + 1.0, 0], 0.28, 24, { t: 0 });
  counts.forEach((n, i) => {
    const a = (i * TAU) / counts.length;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cx = ca * dist;
    const cz = sa * dist;
    const h = n * kat;
    const t = tints[i];
    // merkezden hücreye yol
    d.line([ca * R * 0.66, y0, sa * R * 0.66], [cx - ca * R * 0.88, y0, cz - sa * R * 0.88], { s: 0.8, d: 0.9 });
    const base = hex(cx, y0, cz, R);
    const top = hex(cx, y0 + h, cz, R);
    d.poly(base, { t, s: 1.0, d: 1.3 }, true);
    d.poly(top, { t, s: 1.05, d: 1.7 }, true);
    base.forEach((q, k) => d.line(q, top[k], { t, s: 0.95, d: 1.1 }));
    // her hizmet bir kat
    for (let k = 1; k < n; k++) d.poly(hex(cx, y0 + k * kat, cz, R), { t, s: 0.75, d: 0.5 }, true);
    d.poly(hex(cx, y0 + h, cz, R * 0.5), { t, s: 0.95, d: 0.9 }, true);
    d.node([cx, y0 + h + 0.28, cz], 0.2, 14, { t });
  });
  d.done(Nf);
}

/* ── Matris — Sektörler: sütun = sektör, satır = hizmet alanı, yükseklik = o sektörde öne çıkan hizmet sayısı (sectors.json) */
export function matris(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // satırlar (hizmet alanları, sitedeki sırayla): vergi, bağımsız denetim, muhasebe-bordro, kurumsal finansman, teşvik, hukuk, dijital, akademi
  const M = [
    [1, 3, 2, 0, 0, 0, 1, 0], // finansal hizmetler
    [2, 0, 1, 0, 2, 0, 2, 0], // üretim ve sanayi
    [2, 1, 2, 2, 0, 0, 0, 0], // enerji ve doğal kaynaklar
    [1, 0, 3, 0, 1, 0, 2, 0], // perakende, tüketici ve gıda
    [1, 0, 1, 1, 2, 0, 2, 0], // teknoloji, medya ve telekom
    [1, 1, 3, 0, 1, 0, 1, 0], // sağlık ve ilaç
    [2, 1, 2, 2, 0, 0, 0, 0], // inşaat, gayrimenkul ve altyapı
    [1, 0, 4, 0, 1, 0, 1, 0], // turizm, ulaştırma ve lojistik
    [0, 1, 3, 3, 0, 1, 0, 0], // aile şirketleri ve KOBİ'ler
    [0, 2, 3, 0, 0, 0, 1, 1], // kamu ve sivil toplum
  ];
  const rowTint = AREA_TINT;
  const sx = 1.2;
  const sz = 0.78;
  const k = 0.6;
  M.forEach((col, i) =>
    col.forEach((n, j) => {
      const x = (i - 4.5) * sx;
      const z = (j - (M[0].length - 1) / 2) * sz;
      if (n === 0) {
        d.node([x, FLOOR + 0.04, z], 0.07, 3, { t: 0, s: 1.4 });
        return;
      }
      const h = n * k;
      d.box([x, FLOOR + h / 2, z], [0.56, h, 0.5], { t: rowTint[j], s: 0.92 }, { top: 2, front: n > 2 ? n - 1 : 0 });
    })
  );
  // zemin kafesi
  const W = 10 * sx + 0.5;
  const D = M[0].length * sz + 0.4;
  d.rect([0, FLOOR - 0.04, 0], X, Z, W, D, { s: 1.0, d: 1.4 });
  for (let i = 1; i < 10; i++) d.line([(i - 5) * sx, FLOOR - 0.04, -D / 2], [(i - 5) * sx, FLOOR - 0.04, D / 2], { s: 0.65, d: 0.35 });
  for (let j = 1; j < M[0].length; j++) d.line([-W / 2, FLOOR - 0.04, (j - M[0].length / 2) * sz], [W / 2, FLOOR - 0.04, (j - M[0].length / 2) * sz], { s: 0.65, d: 0.35 });
  d.done(Nf);
}

/* ── Ağ — Ekibimiz: sekiz hizmet alanı halkada; kişiler içeride, çalıştıkları alanlara bağlı */
export function ag(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const tints = AREA_TINT;
  const Rx = 5.2;
  const Ry = 3.4;
  const A = Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 2 + (k * TAU) / 8;
    return [Math.cos(a) * Rx, Math.sin(a) * Ry, Math.sin(k * 2.3 + 0.6) * 1.5];
  });
  d.curve((u) => [Math.cos(u * TAU) * Rx, Math.sin(u * TAU) * Ry, 0], { s: 0.8, d: 0.7 }, 140);
  A.forEach((q, k) => {
    const t = tints[k];
    d.node(q, 0.4, 34, { t });
    d.circle(q, X, Y, 0.66, { t, s: 0.95, d: 1.2 });
    d.cloud(q, 0.95, 12, { t, s: 0.8, d: 0.8 });
  });
  // kişiler: konum, bağlı alanlar
  const people = [
    [[-1.7, 0.8, 0.9], [0, 1]],
    [[1.5, 1.4, -0.7], [1, 2]],
    [[-0.1, -0.2, 0.3], [0, 3, 5]],
    [[2.4, -1.0, 0.8], [2, 6, 7]],
    [[-2.5, -1.2, -0.8], [4, 5]],
    [[0.5, 2.2, 1.0], [0, 2]],
    [[-0.6, -2.0, -0.4], [3, 4, 6]],
    [[1.2, -0.4, -1.0], [5, 7]],
  ];
  people.forEach(([q, links]) => {
    d.node(q, 0.26, 22, { t: 0 });
    d.circle(q, X, Y, 0.5, { s: 0.9, d: 0.9 });
    links.forEach((k) => {
      const a = A[k];
      const bulge = (rnd() - 0.5) * 1.6;
      d.curve((u) => [q[0] + (a[0] - q[0]) * u, q[1] + (a[1] - q[1]) * u + Math.sin(u * Math.PI) * 0.35, q[2] + (a[2] - q[2]) * u + Math.sin(u * Math.PI) * bulge], { t: tints[k], s: 0.8, d: 0.85 }, 40);
    });
  });
  d.done(Nf);
}

/* ── Yayın — Bilgi merkezi: dört yayın türü (sirküler, duyuru, blog, haber) için dört dosya yığını */
export function yayin(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const stacks = [
    { x: -4.9, n: 6, ang: -0.28, t: 1 }, // sirküler
    { x: -1.65, n: 3, ang: 0.12, t: 2 }, // duyuru
    { x: 1.65, n: 5, ang: -0.1, t: 3 }, // blog
    { x: 4.9, n: 4, ang: 0.26, t: 0 }, // haber
  ];
  const w = 2.3;
  const h = 3.2;
  for (const S of stacks) {
    const ca = Math.cos(S.ang);
    const sa = Math.sin(S.ang);
    const u = [ca, 0, -sa];
    for (let k = S.n - 1; k >= 0; k--) {
      const c = [S.x + k * 0.16 * ca, -0.2 + k * 0.17, -k * 0.34 - k * 0.16 * sa];
      const front = k === 0;
      d.rect(c, u, Y, w, h, { t: front ? S.t : 0, s: front ? 1.0 : 0.85, d: front ? 1.4 : 0.9 });
      if (!front) continue;
      const P = (a, b) => [c[0] + u[0] * a, c[1] + b, c[2] + u[2] * a];
      // başlık bloğu + metin satırları
      d.line(P(-0.9, 1.15), P(0.55, 1.15), { t: S.t, s: 1.1, d: 2.0 });
      d.line(P(-0.9, 0.85), P(0.1, 0.85), { s: 0.8, d: 1.0 });
      for (let r = 0; r < 7; r++) {
        const y = 0.35 - r * 0.32;
        d.line(P(-0.9, y), P(-0.9 + (r === 6 ? 0.9 : 1.8), y), { s: 0.75, d: 0.7 });
      }
      d.rect(P(0.45, -1.2), u, Y, 0.7, 0.4, { t: S.t, s: 0.9, d: 1.0 });
    }
  }
  // raf çizgisi
  d.line([-6.4, -2.15, 0.4], [6.4, -2.15, 0.4], { s: 1.0, d: 1.3 });
  d.line([-6.4, -2.15, -3.2], [6.4, -2.15, -3.2], { s: 0.8, d: 0.6 });
  d.done(Nf);
}

/* ── Kitap — Okuma notları: açık kitap; satır altı çizgileri notlar */
export function kitap(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const W = 5.4;
  const H = 3.55;
  const zc = (s) => 1.35 * Math.pow(s, 0.8) * (1 - 0.45 * s) - 0.3;
  const P = (side, s, y) => [side * s * W, y, zc(s)];
  const marks = { '-1:4': 3, '-1:5': 3, '1:2': 2, '1:9': 1, '1:10': 1 }; // sayfa:satır → renk (not)
  for (const side of [-1, 1]) {
    const edge = (y, o) => d.curve((u) => P(side, u, y), o, 36);
    edge(H, { s: 1.0, d: 1.4 });
    edge(-H, { s: 1.0, d: 1.4 });
    for (let k = 1; k <= 3; k++) edge(-H - 0.1 * k, { s: 0.75, d: 0.5 });
    d.line(P(side, 1, -H), P(side, 1, H), { s: 1.0, d: 1.4 });
    const rows = 15;
    for (let r = 0; r < rows; r++) {
      const y = H - 0.55 - (r * (2 * H - 1.1)) / (rows - 1);
      const end = r % 5 === 4 ? 0.52 + rnd() * 0.14 : 0.86 + rnd() * 0.08;
      const start = r % 5 === 0 ? 0.2 : 0.12;
      const t = marks[`${side}:${r}`];
      d.curve((u) => P(side, start + (end - start) * u, y), { t: t ?? 0, s: t ? 0.95 : 0.75, d: t ? 1.1 : 0.62 }, 22);
    }
  }
  d.line(P(1, 0, -H), P(1, 0, H), { s: 1.1, d: 1.8 });
  // ayraç
  d.line([0.35, H + 0.05, zc(0.06) + 0.04], [0.35, -H - 1.0, zc(0.06) + 0.04], { t: 2, s: 1.1, d: 2.2 });
  d.poly([[0.35, -H - 1.0, zc(0.06) + 0.04], [0.55, -H - 0.8, zc(0.06) + 0.04], [0.75, -H - 1.0, zc(0.06) + 0.04]], { t: 2, s: 1.0, d: 1.6 });
  d.done(Nf);
}

/* ── Abaküs — Hesaplayıcılar: kalem kalem hesap; sağa çekilen boncuklar toplanmış kalemleri gösterir */
export function abakus(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const fw = 11.6;
  const fh = 7.4;
  for (const z of [-0.45, 0.45]) d.rect([0, 0, z], X, Y, fw, fh, { s: 1.05, d: 1.1 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) d.line([sx * fw * 0.5, sy * fh * 0.5, -0.45], [sx * fw * 0.5, sy * fh * 0.5, 0.45], { s: 0.9, d: 1.0 });
  const counted = [4, 7, 2, 5, 8, 3, 6];
  const rods = counted.length;
  const bead = 0.31;
  const pitch = 0.66;
  const n = 10;
  for (let r = 0; r < rods; r++) {
    const y = 2.7 - r * 0.9;
    d.line([-fw / 2, y, 0], [fw / 2, y, 0], { s: 0.8, d: 0.9 });
    for (let b = 0; b < n; b++) {
      const right = b < counted[r];
      const x = right ? fw / 2 - 0.45 - bead - b * pitch : -fw / 2 + 0.45 + bead + (n - 1 - b) * pitch;
      // boncuk dolu görünsün: düğüm tavanından yüksek (yine de disk gibi doymaz)
      d.node([x, y, 0], bead, 9, { t: right ? (r === rods - 1 ? 3 : 1) : 0, s: 1.7, cap: 72 });
    }
  }
  // sağ taraf: toplam çubuğu
  d.line([fw / 2 - 0.2, 3.35, 0], [fw / 2 - 0.2, -3.35, 0], { t: 3, s: 1.0, d: 1.2 });
  // ayaklar
  for (const sx of [-1, 1]) d.line([sx * (fw / 2 - 0.4), -fh / 2, 0], [sx * (fw / 2 + 0.2), -fh / 2 - 0.5, 0], { s: 1.0, d: 1.3 });
  d.done(Nf);
}

/* ── Takvim — Vergi takvimi: ekim 2026 – mart 2027, gerçek son gün tarihleri (calendar.json); renk = beyan türü */
export function takvim(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const months = [
    { y: 2026, m: 9, days: [[26, 0], [28, 1]] },
    { y: 2026, m: 10, days: [[2, 3], [17, 2], [26, 0], [30, 3], [30, 1]] },
    { y: 2026, m: 11, days: [[10, 1], [14, 1], [28, 1], [28, 0], [31, 3]] },
    { y: 2027, m: 0, days: [[26, 0], [28, 1]] },
    { y: 2027, m: 1, days: [[1, 3], [17, 2], [26, 0]] },
    { y: 2027, m: 2, days: [[1, 1], [1, 3], [26, 0], [29, 1], [31, 3], [31, 2]] },
  ];
  const bw = 3.7;
  const bh = 3.1;
  const dx = 0.44;
  const dy = 0.42;
  months.forEach((M, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = (col - 1) * 4.25;
    const cy = row === 0 ? 1.85 : -1.85;
    const cz = (col - 1) * 0.4 - row * 0.35;
    const nd = new Date(Date.UTC(M.y, M.m + 1, 0)).getUTCDate();
    const first = (new Date(Date.UTC(M.y, M.m, 1)).getUTCDay() + 6) % 7;
    const cell = (day) => {
      const k = first + day - 1;
      return [cx + ((k % 7) - 3) * dx, cy + 0.78 - Math.floor(k / 7) * dy, cz];
    };
    d.rect([cx, cy, cz], X, Y, bw, bh, { s: 1.0, d: 1.4 });
    d.line([cx - bw / 2, cy + 1.0, cz], [cx + bw / 2, cy + 1.0, cz], { s: 1.0, d: 1.5 });
    d.circle([cx - 0.8, cy + bh / 2, cz], X, Y, 0.1, { s: 1.4, d: 1.0 });
    d.circle([cx + 0.8, cy + bh / 2, cz], X, Y, 0.1, { s: 1.4, d: 1.0 });
    d.scatter(
      (r, i) => {
        const q = cell((i % nd) + 1);
        return [q[0], q[1], q[2]];
      },
      nd * 1.25,
      { s: 0.85, j: 0.012 }
    );
    M.days.forEach(([day, t]) => {
      const q = cell(day);
      d.node([q[0], q[1], q[2] + 0.05], 0.14, 8, { t, s: 2.0 });
    });
  });
  d.done(Nf);
}

/* ── Başvuru — Kariyer: başvuru, değerlendirme, görüşme, sonuç; derinlikte küçülen dört kapıdan geçen yol (careers.json › süreç) */
export function basvuru(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const zs = [3.3, 1.1, -1.1, -3.3];
  const scale = [1, 0.84, 0.7, 0.58];
  const tints = [1, 1, 0, 3];
  const w0 = 4.6;
  const h0 = 6.2;
  const y0 = FLOOR + 0.1;
  const hw = (z) => 0.4 + (0.95 * (z + 5)) / 10; // yolun yarı genişliği: uzakta daralır
  const top = zs.map((_, i) => ({ w: w0 * scale[i], h: h0 * scale[i] }));
  zs.forEach((z, i) => {
    const t = tints[i];
    const { w, h } = top[i];
    for (const sx of [-1, 1]) {
      d.line([sx * w / 2, y0, z], [sx * w / 2, y0 + h, z], { t, s: 1.05, d: 1.7 });
      d.line([sx * (w / 2 - 0.3), y0, z], [sx * (w / 2 - 0.3), y0 + h - 0.3, z], { s: 0.75, d: 0.6 });
    }
    d.line([-w / 2, y0 + h, z], [w / 2, y0 + h, z], { t, s: 1.1, d: 2.0 });
    d.line([-w / 2 + 0.3, y0 + h - 0.3, z], [w / 2 - 0.3, y0 + h - 0.3, z], { s: 0.75, d: 0.7 });
    d.line([-w / 2 - 0.35, y0, z], [w / 2 + 0.35, y0, z], { s: 1.0, d: 1.3 });
    // adım işareti: lento üstünde i+1 düğüm
    for (let k = 0; k <= i; k++) d.node([(k - i / 2) * 0.5, y0 + h + 0.5, z], 0.13, 7, { t });
    // kapılar arasında köşe kirişleri (tünel)
    if (i < zs.length - 1) {
      const n = top[i + 1];
      for (const sx of [-1, 1]) d.line([sx * w / 2, y0 + h, z], [sx * n.w / 2, y0 + n.h, zs[i + 1]], { s: 0.7, d: 0.55 });
    }
  });
  // yol: iki kenar çizgisi + enine çizgiler + orta çizgi
  const zNear = 5.0;
  const zFar = -5.0;
  for (const sx of [-1, 1]) d.line([sx * hw(zNear), y0, zNear], [sx * hw(zFar), y0, zFar], { s: 0.95, d: 1.3 });
  for (let k = 0; k < 14; k++) {
    const z = zNear - 0.35 - k * 0.7;
    d.line([-hw(z), y0, z], [hw(z), y0, z], { s: 0.7, d: 0.4 });
  }
  d.line([0, y0, zNear], [0, y0, zFar], { t: 3, s: 0.9, d: 0.9 });
  d.node([0, y0 + 0.28, zNear - 0.5], 0.26, 18, { t: 3 });
  d.done(Nf);
}

/* ── Yönlendirme — İletişim: üç kanaldan gelen mesaj okunur ve konuya göre altı uzmanlık alanından birine yönlendirilir (contactpage.json) */
export function yonlendirme(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const tints = AREA_TINT;
  const channels = [[-5.6, 1.9, 0.4], [-5.6, 0, 0], [-5.6, -1.9, -0.4]];
  const hub = [-1.7, 0, 0];
  const outs = Array.from({ length: 6 }, (_, k) => [5.0, 3.5 - k * 1.4, 0]);
  const route = (a, b, zb, o) =>
    d.curve((u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * smooth(u), a[2] + (b[2] - a[2]) * u + Math.sin(u * Math.PI) * zb], o, 70);
  channels.forEach((c, i) => {
    d.circle(c, X, Y, 0.4, { t: 1, s: 1.0, d: 1.3 });
    d.node(c, 0.17, 12, { t: 1 });
    route(c, hub, (i - 1) * 0.6, { t: 1, s: 0.9, d: 1.1 });
  });
  d.node(hub, 0.3, 28, { t: 0 });
  d.circle(hub, X, Y, 0.75, { s: 1.0, d: 1.4 });
  d.circle(hub, Z, Y, 0.75, { s: 0.85, d: 0.9 });
  d.circle(hub, X, Z, 0.75, { s: 0.85, d: 0.9 });
  outs.forEach((o, k) => {
    const t = tints[k];
    route(hub, o, (k - 2.5) * 0.5, { t, s: 0.9, d: 1.2 });
    d.rect([o[0] + 0.85, o[1], o[2]], X, Y, 1.7, 0.8, { t, s: 1.0, d: 1.5 });
    d.hatch([o[0] + 0.85, o[1], o[2]], X, Y, 1.3, 0.4, 2, { t, s: 0.7, d: 0.5 });
    d.node(o, 0.16, 12, { t });
  });
  d.done(Nf);
}

/* ── Arama — sitedeki sayfalar bir ızgarada; eşleşenler renkli, mercek altında */
export function arama(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const cols = 9;
  const rows = 6;
  const gx = 1.28;
  const gy = 1.42;
  const lens = [1.3, 0.55];
  const hits = new Map([['6:1', 2], ['7:2', 3], ['5:2', 1], ['6:3', 3], ['7:1', 1]]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - 4) * gx;
      const y = (2.5 - r) * gy;
      const t = hits.get(`${c}:${r}`);
      const inside = Math.hypot(x - lens[0], y - lens[1]) < 2.1;
      const o = { t: t ?? 0, s: t ? 1.0 : 0.8, d: t ? 1.4 : inside ? 0.8 : 0.55 };
      d.rect([x, y, 0], X, Y, 0.9, 1.15, o);
      for (let k = 0; k < 3; k++) d.line([x - 0.3, y + 0.25 - k * 0.22, 0], [x + 0.3 - (k === 2 ? 0.2 : 0), y + 0.25 - k * 0.22, 0], { t: t ?? 0, s: 0.65, d: t ? 0.8 : 0.35 });
    }
  }
  // mercek
  const lz = 1.3;
  d.circle([lens[0], lens[1], lz], X, Y, 2.05, { s: 1.1, d: 1.9 });
  d.circle([lens[0], lens[1], lz], X, Y, 1.9, { s: 0.8, d: 0.9 });
  const a = -Math.PI / 4;
  const hx = lens[0] + Math.cos(a) * 2.05;
  const hy = lens[1] + Math.sin(a) * 2.05;
  d.line([hx, hy, lz], [hx + 1.7, hy - 1.7, lz], { s: 1.15, d: 2.2 });
  d.line([hx + 0.12, hy + 0.12, lz], [hx + 1.82, hy - 1.58, lz], { s: 0.9, d: 1.0 });
  d.done(Nf);
}

/* ── Arşiv — Sirküler arşivi: yıl başına bir klasör; klasörün kalınlığı o yılın sirküler sayısıyla (karekök ölçekli) büyür (archive.json) */
export function arsiv(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const years = [
    [2, 0], // 2018
    [13, 1], // 2019
    [112, 2], // 2020
    [106, 3], // 2021
    [14, 1], // 2022
  ];
  const wid = (n) => 0.55 + Math.sqrt(n) * 0.2;
  const gap = 0.55;
  const total = years.reduce((s, [n]) => s + wid(n), 0) + gap * (years.length - 1);
  let x = -total / 2;
  const h = 5.2;
  years.forEach(([n, t], i) => {
    const w = wid(n);
    const cx = x + w / 2;
    const hh = h + (i % 2 ? 0.2 : -0.1);
    d.box([cx, FLOOR + hh / 2, 0], [w, hh, 2.3], { t, s: 0.95 }, { top: 2 });
    // sırt: etiket + halka bölgesi
    d.rect([cx, FLOOR + hh * 0.74, 1.16], X, Y, w * 0.72, 1.35, { t, s: 0.95, d: 1.3 });
    d.line([cx - w * 0.28, FLOOR + hh * 0.74 + 0.25, 1.16], [cx + w * 0.28, FLOOR + hh * 0.74 + 0.25, 1.16], { t, s: 0.75, d: 0.6 });
    d.line([cx - w * 0.28, FLOOR + hh * 0.74 - 0.15, 1.16], [cx + w * 0.1, FLOOR + hh * 0.74 - 0.15, 1.16], { s: 0.7, d: 0.5 });
    for (const yy of [0.34, 0.14]) d.circle([cx, FLOOR + hh * yy, 1.16], X, Y, Math.min(0.2, w * 0.28), { s: 0.95, d: 1.0 });
    // kalınlıkla orantılı kâğıt çizgileri (üst yüzey)
    x += w + gap;
  });
  // raf
  d.box([0, FLOOR - 0.18, 0], [total + 1.4, 0.3, 2.9], { s: 1.0 }, { front: 2, top: 2 });
  d.done(Nf);
}

/* ── Sözlük — yedi kategoride 60 terim; birbirine bağlı kavramlar (glossary.json: Denetim 12 · Vergi 15 · Bordro ve İK 8 · Şirketler ve ticaret 6 · Değerleme 7 · Raporlama ve standartlar 7 · Sistemler ve veri 5) */
export function sozluk(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const sizes = [12, 15, 8, 6, 7, 7, 5];
  const tints = [1, 0, 3, 2, 1, 0, 3];
  const C = sizes.map((_, k) => {
    const a = (k / sizes.length) * TAU + 0.35;
    return [Math.cos(a) * 4.3, Math.sin(a) * 2.7, Math.sin(a * 2 + 0.5) * 2.0];
  });
  const nodes = [];
  sizes.forEach((n, k) => {
    const R = 0.55 + Math.sqrt(n) * 0.3;
    for (let i = 0; i < n; i++) {
      let q;
      do q = [(rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2];
      while (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > 1);
      nodes.push({ k, q: [C[k][0] + q[0] * R * 1.15, C[k][1] + q[1] * R * 0.85, C[k][2] + q[2] * R] });
    }
  });
  nodes.forEach(({ k, q }) => d.node(q, 0.1, 5, { t: tints[k], s: 1.8 }));
  const dist = (a, b) => Math.hypot(a.q[0] - b.q[0], a.q[1] - b.q[1], a.q[2] - b.q[2]);
  const seen = new Set();
  const link = (a, b, o) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    d.line(nodes[a].q, nodes[b].q, o);
  };
  // küme içi: her terim en yakın iki komşusuna
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => [j, dist(a, b)])
      .filter(([j]) => j !== i && nodes[j].k === a.k)
      .sort((u, v) => u[1] - v[1])
      .slice(0, 2);
    near.forEach(([j]) => link(i, j, { t: tints[a.k], s: 0.7, d: 0.55 }));
  });
  // kümeler arası: komşu kümelerin en yakın terim çiftleri
  for (let k = 0; k < sizes.length; k++) {
    for (const k2 of [(k + 1) % sizes.length, (k + 3) % sizes.length]) {
      let best = null;
      nodes.forEach((a, i) => {
        if (a.k !== k) return;
        nodes.forEach((b, j) => {
          if (b.k !== k2) return;
          const dd = dist(a, b);
          if (!best || dd < best[2]) best = [i, j, dd];
        });
      });
      if (best) link(best[0], best[1], { s: 0.8, d: 0.7 });
    }
  }
  d.done(Nf);
}

/* ── Gizlilik — yasal metinler (KVKK, gizlilik, çerez): kilit ve çevresinde dönen veri halkası */
export function gizlilik(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // gövde
  d.box([0, -1.35, 0], [4.6, 3.3, 1.5], { s: 0.95 }, { front: 7, top: 3, right: 3 });
  // kanca: iki yay + bacaklar
  for (const z of [-0.28, 0.28]) {
    d.arc([0, 0.3, z], X, Y, 1.5, 0, Math.PI, { s: 1.05, d: 1.6 });
    d.arc([0, 0.3, z], X, Y, 1.14, 0, Math.PI, { s: 0.85, d: 0.9 });
    for (const sx of [-1, 1]) {
      d.line([sx * 1.5, 0.3, z], [sx * 1.5, 0.3 - 0.35, z], { s: 0.9, d: 1.3 });
      d.line([sx * 1.14, 0.3, z], [sx * 1.14, 0.3 - 0.35, z], { s: 0.8, d: 0.8 });
    }
  }
  // anahtar deliği (yeşil)
  d.circle([0, -1.0, 0.77], X, Y, 0.4, { t: 3, s: 1.1, d: 1.8 });
  d.node([0, -1.0, 0.77], 0.14, 10, { t: 3 });
  d.line([0, -1.4, 0.77], [0, -2.3, 0.77], { t: 3, s: 1.0, d: 1.8 });
  // çevresinde dönen veri halkaları (kişisel veri kümeleri)
  const ring = (rx, ry, tilt, t, dens) =>
    d.curve((u) => {
      const a = u * TAU;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      return [x, y * Math.cos(tilt) - 0.0, y * Math.sin(tilt)];
    }, { t, s: 0.8, d: dens }, 120);
  ring(5.6, 3.2, 0.9, 1, 0.8);
  ring(4.9, 2.9, -0.7, 0, 0.7);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.4;
    d.node([Math.cos(a) * 5.6, Math.sin(a) * 3.2 * Math.cos(0.9), Math.sin(a) * 3.2 * Math.sin(0.9)], 0.15, 9, { t: k % 3 === 0 ? 2 : 1 });
  }
  d.done(Nf);
}

/* ── Soru — Sık sorulan sorular: beş başlık, yirmi yedi soru (faq.json: 6 · 5 · 5 · 5 · 6). Solda soru balonu, sağda her başlık için bir akordeon;
   satırdaki çentik sayısı o başlıktaki soru sayısıdır, ilk satır açık. */
export function soru(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // soru balonu (elips + kuyruk) ve içinde «?» işareti
  const bc = [-3.7, 0.55, 0];
  d.arc(bc, [1.28, 0, 0], Y, 1.95, 0, TAU, { t: 1, s: 1.0, d: 1.6 });
  d.arc(bc, [1.28, 0, 0], Y, 1.62, 0, TAU, { t: 1, s: 0.75, d: 0.5 });
  d.poly([[-5.1, -1.0, 0], [-5.75, -2.2, 0], [-3.9, -1.38, 0]], { t: 1, s: 1.0, d: 1.5 }, true);
  const qc = [-3.7, 1.15, 0];
  d.arc(qc, X, Y, 0.78, -0.22 * Math.PI, 1.12 * Math.PI, { s: 1.2, d: 2.4 });
  d.line([qc[0] + 0.78 * Math.cos(-0.22 * Math.PI), qc[1] + 0.78 * Math.sin(-0.22 * Math.PI), 0], [-3.7, 0.0, 0], { s: 1.2, d: 2.2 });
  d.line([-3.7, 0.0, 0], [-3.7, -0.22, 0], { s: 1.1, d: 1.2 });
  d.node([-3.7, -0.62, 0], 0.17, 12, { t: 2, s: 1.9 });
  // beş başlık: çentik sayısı = soru sayısı (faq.json)
  const groups = [
    { n: 6, t: 1 },
    { n: 5, t: 2 },
    { n: 5, t: 0 },
    { n: 5, t: 1 },
    { n: 6, t: 3 },
  ];
  const x0 = -0.2;
  const w = 6.4;
  const hh = 0.8;
  const ys = [3.1, 0.52, -0.66, -1.84, -3.02]; // ilk satır açık: altında yanıt gövdesi
  groups.forEach((g, i) => {
    const y = ys[i];
    const open = i === 0;
    d.rect([x0 + w / 2, y, 0], X, Y, w, hh, { t: g.t, s: 1.0, d: 1.5 });
    d.line([x0, y - hh / 2, 0], [x0, y + hh / 2, 0], { t: g.t, s: 1.2, d: 2.2 });
    // soru çentikleri
    for (let k = 0; k < g.n; k++) d.line([x0 + 0.5 + k * 0.34, y - 0.17, 0], [x0 + 0.5 + k * 0.34, y + 0.17, 0], { t: g.t, s: 0.95, d: 1.3 });
    // ok: açık satırda yukarı, kapalılarda aşağı
    const ex = x0 + w - 0.5;
    const dir = open ? 1 : -1;
    d.poly([[ex - 0.2, y - 0.1 * dir, 0], [ex, y + 0.1 * dir, 0], [ex + 0.2, y - 0.1 * dir, 0]], { s: 1.0, d: 1.6 });
    // balondan başlığa ince bağlantı
    d.line([-1.75, 0.55 + (i - 2) * 0.12, 0], [x0, y, 0], { t: g.t, s: 0.6, d: 0.35 });
  });
  // açık satırın yanıt gövdesi
  d.rect([x0 + w / 2, 2.0, 0], X, Y, w, 1.4, { s: 0.9, d: 1.1 });
  [[2.45, 5.6], [2.02, 5.0], [1.59, 3.7]].forEach(([y, wd]) => d.line([x0 + 0.4, y, 0], [x0 + 0.4 + wd, y, 0], { s: 0.8, d: 1.0 }));
  d.done(Nf);
}

/* ── Yazıt — Hakkımızda: Orhun Abideleri tarzında iki dikili taş. Büyüğü kaplumbağa biçimli kaidenin sırtında yükselir; yüzlerinde
   dikey sütunlar hâlinde runik izlenimli işaretler, sözcük araları iki noktayla ayrılır, tepede kemer biçimli başlık.
   İşaretler süs amaçlıdır, gerçek bir metni okumaz (yanlış okunabilecek uydurma yazı olmasın diye). */
const RUNES = [
  [[[0, -0.5], [0, 0.5]], [[0, 0.5], [0.34, 0.16]]],
  [[[-0.3, 0.42], [0.3, 0]], [[0.3, 0], [-0.3, -0.42]]],
  [[[0, -0.5], [0, 0.02]], [[0, 0.02], [-0.3, 0.46]], [[0, 0.02], [0.3, 0.46]]],
  [[[-0.3, -0.45], [0.3, 0.45]], [[0.3, -0.45], [-0.3, 0.45]]],
  [[[-0.17, -0.45], [-0.17, 0.45]], [[0.17, -0.45], [0.17, 0.45]]],
  [[[-0.24, -0.46], [-0.24, 0.46]], [[-0.24, 0.46], [0.26, 0]], [[0.26, 0], [-0.24, -0.46]]],
  [[[0, -0.5], [0, 0.5]], [[-0.28, 0.2], [0, 0.5]], [[0, 0.5], [0.28, 0.2]]],
  [[[-0.3, -0.45], [0, 0.45]], [[0, 0.45], [0.3, -0.45]]],
  [[[-0.2, 0.46], [0.22, 0.28]], [[0.22, 0.28], [0.22, -0.28]], [[0.22, -0.28], [-0.2, -0.46]]],
  [[[0, -0.5], [0, 0.5]], [[0, 0.16], [0.3, 0.42]], [[0, -0.16], [0.3, 0.1]]],
];

export function yazit(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const ground = -3.35;
  // bir yüzeye sütun sütun işaret kazır: P(a, b) yüzey düzleminde (a: yatay, b: dikey) noktayı 3B'ye çevirir
  const carve = (P, a0, a1, b0, b1, cols, accT, gMax = 0.42) => {
    const pitch = (a1 - a0) / cols;
    const g = Math.min(pitch * 0.7, gMax);
    const vp = g * 1.42;
    for (let k = 0; k < cols; k++) {
      const a = a0 + pitch * (k + 0.5);
      // sütun kılavuzu (ince)
      if (k > 0) d.line(P(a0 + pitch * k, b0), P(a0 + pitch * k, b1), { s: 0.6, d: 0.22 });
      const stop = rnd() < 0.3 ? b0 + (b1 - b0) * (0.15 + rnd() * 0.5) : b0; // bazı sütunlar erken biter
      let b = b1 - vp * 0.55;
      let first = true;
      while (b - g * 0.5 > stop) {
        if (!first && rnd() < 0.16) {
          // sözcük arası: iki nokta (çoğu lacivert, arada bir kırmızı)
          const tt = rnd() < 0.25 ? 2 : 0;
          d.node(P(a, b + g * 0.15), 0.03, 0.35, { t: tt, s: 1.2 });
          d.node(P(a, b - g * 0.15), 0.03, 0.35, { t: tt, s: 1.2 });
          b -= vp * 0.6;
          continue;
        }
        first = false;
        const r = RUNES[Math.floor(rnd() * RUNES.length)];
        for (const [[ax, ay], [bx, by]] of r) d.line(P(a + ax * g, b + ay * g), P(a + bx * g, b + by * g), { t: 0, s: 0.8, sv: 0.2, d: 2.1, j: 0.005, acc: [accT, 0.06] });
        b -= vp;
      }
    }
  };
  // dikili taş: gövde + kemer başlık + ön yüz ve iki yan yüzde yazı
  const stele = (cx, cz, y0, sc, cols, accT) => {
    const hw = 1.25 * sc;
    const hd = 0.42 * sc;
    const y1 = y0 + 5.4 * sc;
    const cr = 0.95 * sc;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) d.line([cx + sx * hw, y0, cz + sz * hd], [cx + sx * hw, y1, cz + sz * hd], { s: 1.05, d: 1.4 });
    d.rect([cx, y0, cz], X, Z, hw * 2, hd * 2, { s: 1.0, d: 1.2 });
    for (const sz of [-1, 1]) {
      d.arc([cx, y1, cz + sz * hd], [hw, 0, 0], [0, cr, 0], 1, 0, Math.PI, { s: 1.05, d: 1.25 * (hw + cr) });
    }
    // başlıktaki iç kemer (ön yüz) ve kemerleri bağlayan çizgiler
    d.arc([cx, y1 + 0.05 * sc, cz + hd], [hw * 0.7, 0, 0], [0, cr * 0.66, 0], 1, 0, Math.PI, { t: 1, s: 1.0, d: 1.1 * (hw + cr) });
    for (const th of [0, 0.55, 1.15, Math.PI / 2, 1.99, 2.59, Math.PI]) {
      const x = cx + Math.cos(th) * hw;
      const y = y1 + Math.sin(th) * cr;
      d.line([x, y, cz - hd], [x, y, cz + hd], { s: 0.9, d: 0.9 });
    }
    // ön yüz: oyma çerçeve + yazı
    const zf = cz + hd;
    d.rect([cx, (y0 + y1) / 2 + 0.05 * sc, zf], X, Y, hw * 2 - 0.22 * sc, y1 - y0 - 0.28 * sc, { s: 0.8, d: 0.7 });
    carve((a, b) => [a, b, zf], cx - hw + 0.2 * sc, cx + hw - 0.2 * sc, y0 + 0.32 * sc, y1 - 0.12 * sc, cols, accT, 0.42 * sc);
    // yan yüzler: birer sütun
    for (const sx of [-1, 1]) {
      const xs = cx + sx * hw;
      carve((a, b) => [xs, b, a], cz - hd + 0.06 * sc, cz + hd - 0.06 * sc, y0 + 0.32 * sc, y1 - 0.12 * sc, 1, accT, 0.36 * sc);
    }
  };

  // —— kaplumbağa kaide (büyük taş)
  const tx = 0.9;
  const tz = 0;
  const rx = 2.3;
  const ry = 1.0;
  const rz = 1.6;
  // kabuk: halkalar + tepeden kenara inen dilim çizgileri (yüzey bulutu yok: temiz görünsün)
  for (const k of [0, 0.45, 0.8]) {
    const q = Math.sqrt(1 - k * k);
    d.curve((u) => [tx + rx * q * Math.cos(u * TAU), ground + ry * k, tz + rz * q * Math.sin(u * TAU)], { t: 1, s: k ? 0.85 : 1.0, d: k ? 0.9 : 1.3 }, 96);
  }
  for (let m = 0; m < 10; m++) {
    const a = (m / 10) * TAU + 0.2;
    d.curve((u) => {
      const b = 0.25 + u * (Math.PI / 2 - 0.25);
      return [tx + rx * Math.sin(b) * Math.cos(a), ground + ry * Math.cos(b), tz + rz * Math.sin(b) * Math.sin(a)];
    }, { t: 1, s: 0.75, d: 0.55 }, 24);
  }
  d.cloud([tx, ground + 0.42, tz + rz + 0.4], [0.38, 0.3, 0.5], 6, { t: 1, s: 0.95 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) d.node([tx + sx * rx * 0.8, ground + 0.1, tz + sz * rz * 0.72], 0.16, 2, { t: 1 });
  stele(tx, tz, ground + ry - 0.15, 1, 4, 1);

  // —— ikinci taş: basamaklı kaide üstünde, geride ve solda
  const sx2 = -3.1;
  const sz2 = -1.4;
  const sc2 = 0.72;
  d.box([sx2, ground + 0.25, sz2], [2.5 * sc2 + 0.6, 0.5, 0.84 * sc2 + 0.6], { s: 0.95 }, { top: 2, front: 2 });
  stele(sx2, sz2, ground + 0.5, sc2, 3, 3);

  // zemin izi
  d.curve((u) => [-0.5 + 4.4 * Math.cos(u * TAU), ground, -0.4 + 2.3 * Math.sin(u * TAU)], { s: 0.7, d: 0.35 }, 120);
  d.done(Nf);
}
