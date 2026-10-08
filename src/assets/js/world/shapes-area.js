// Hizmet alanı formasyonları (ana sayfa «Hizmet alanları» bandı ve alan sayfaları) — Ekim 2026 sekiz alanlı yapı.
// Vergi: beyan rakamları · Kurumsal Finansman: karar ağacı · Teşvik: destek basamakları ve AB yıldız halkası · Hukuk: § ve tokmak ·
// Akademi: antik okul binası. Saf hesaplama; yerleşim: x ∈ [−6,5, 6,5], y ∈ [−4,2, 4,5], z ∈ [−3,5, 3,5].
import { Draw, X, Y, Z, TAU, v3 } from './draw.js';

const FLOOR = -4.0;

/* ── Vergi Denetim ve Danışmanlık: beyanname üzerinde hesap — matrah × oran = vergi; solda ₺, çevrede yürürlükteki oranlar.
   (Çizgi yerine vergiyle ilgili sayılar: müşteri geri bildirimi, Ekim 2026) */
export function rakamlar(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // beyanname yaprağı (hafif eğik, arkada)
  const sheet = { c: [1.2, 0.1, -0.6], w: 8.6, h: 7.2 };
  const tl = (a, b) => [sheet.c[0] + a, sheet.c[1] + b, sheet.c[2]];
  d.rect(sheet.c, X, Y, sheet.w, sheet.h, { s: 1.15, d: 2.2 });
  d.rect(tl(-0.15, 3.0), X, Y, sheet.w - 1.0, 0.75, { s: 0.9, d: 1.0 });
  // başlık: «KDV» ve dönem kutuları
  d.text('KDV', tl(-3.75, 2.75), X, Y, 0.5, { t: 1, s: 1.15, d: 2.4 });
  for (let i = 0; i < 4; i++) d.rect(tl(1.0 + i * 0.75, 3.0), X, Y, 0.55, 0.45, { s: 0.85, d: 0.9 });
  // hesap: matrah, oran, çizgi, vergi (sağa hizalı)
  const R = tl(3.75, 0);
  const at = (y, z = 0.25) => [R[0], R[1] + y, R[2] + z];
  d.text('1.250.000', at(1.35), X, Y, 0.95, { align: 'right', s: 1.2, d: 2.6 });
  d.text('×%20', at(0.05), X, Y, 0.95, { align: 'right', t: 2, s: 1.2, d: 2.6 });
  d.line(at(-0.35), [R[0] - 6.4, R[1] - 0.35, R[2] + 0.25], { s: 1.1, d: 2.0 });
  d.text('250.000', at(-1.75), X, Y, 1.15, { align: 'right', t: 3, s: 1.3, d: 3.0 });
  d.line(at(-2.05), [R[0] - 5.0, R[1] - 2.05, R[2] + 0.25], { t: 3, s: 1.0, d: 1.3 });
  d.line(at(-2.2), [R[0] - 5.0, R[1] - 2.2, R[2] + 0.25], { t: 3, s: 1.0, d: 1.3 });
  // satır çizgileri (form alanları)
  for (let r = 0; r < 3; r++) d.line(tl(-3.8, -2.75 - r * 0.3), tl(-0.6, -2.75 - r * 0.3), { s: 0.8, d: 0.6 });
  // büyük ₺ (önde, solda)
  d.text('₺', [-6.0, -1.7, 1.2], X, Y, 3.4, { t: 1, s: 1.25, d: 2.8 });
  // yürürlükteki oranlar: derinlikte asılı küçük rakamlar
  [['%1', [-4.4, 3.7, -1.8], 0], ['%10', [-2.7, 4.35, -2.6], 1], ['%25', [6.75, -1.6, 1.0], 2], ['%15', [-5.2, -3.6, 1.5], 0], ['%20', [6.75, 4.25, 0.4], 3]].forEach(([s, q, t]) =>
    d.text(s, q, X, Y, 0.62, { align: 'center', t, s: 1.0, d: 1.3 })
  );
  d.done(Nf);
}

/* ── Kurumsal Finansman: karar ağacı — kökleri toprağa yayılan kalın gövde, dallar ve dolgun taç; ilk çatallarda karar düğümleri.
   (Önceki ince dallanma «yeni filizlenen fidan» gibi okunuyordu: müşteri geri bildirimi, Ekim 2026) */
export function agac(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const ground = FLOOR - 0.1;
  // dal: konik gövde yüzeyi (r0 → r1); ince dallarda tek çizgi
  const limb = (a, b, r0, r1, o = {}) => {
    const ax = v3.norm(v3.sub(b, a));
    const ref = Math.abs(ax[1]) < 0.9 ? Y : X;
    const u = v3.norm([ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]]);
    const w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
    const L = v3.dist(a, b);
    if (r0 < 0.07) return d.line(a, b, { s: 0.9, d: 1.1, ...o });
    return d.part(L * (1 + r0 * 7) * (o.d ?? 1.2), (n) => {
      for (let i = 0; i < n; i++) {
        const t = rnd();
        const r = r0 + (r1 - r0) * t;
        const ang = rnd() * TAU;
        const q = v3.add(v3.mix(a, b, t), v3.add(v3.mul(u, Math.cos(ang) * r), v3.mul(w, Math.sin(ang) * r)));
        d.pt(q[0], q[1], q[2], { s: 0.95, sv: 0.3, j: 0.01, ...o });
      }
    });
  };
  // gövde ve kökler
  const base = [0, ground, 0];
  const top = [0.1, -1.0, 0.05];
  limb(base, top, 0.85, 0.42, { d: 1.9 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.4;
    const mid = [Math.cos(a) * 0.9, ground + 0.15, Math.sin(a) * 0.7];
    const end = [Math.cos(a) * (1.5 + (k % 2) * 0.5), ground, Math.sin(a) * (1.0 + (k % 2) * 0.35)];
    limb([Math.cos(a) * 0.4, ground + 0.5, Math.sin(a) * 0.35], mid, 0.24, 0.14);
    limb(mid, end, 0.14, 0.04);
  }
  // toprak: gövde dibinde kısa çizgi (halka çizilmez — taçla birlikte «mantar» gibi okunuyordu)
  d.line([-2.4, ground, 0.2], [2.4, ground, 0.2], { s: 0.8, d: 0.6 });
  // dallar: gövdenin tepesinden beş ana dal geniş açıyla açılır; her kademede 2–3 dal, uçlarda ve dal boyunca yaprak kümeleri
  const tips = [];
  const turn = (dir, ang, az) => {
    // dir'i, ona dik rastgele bir eksen etrafında ang kadar çevir; yukarı eğilim
    const ref = Math.abs(dir[1]) < 0.9 ? Y : X;
    const u = v3.norm([dir[1] * ref[2] - dir[2] * ref[1], dir[2] * ref[0] - dir[0] * ref[2], dir[0] * ref[1] - dir[1] * ref[0]]);
    const w = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
    const side = v3.add(v3.mul(u, Math.cos(az)), v3.mul(w, Math.sin(az)));
    return v3.norm(v3.add(v3.add(v3.mul(dir, Math.cos(ang)), v3.mul(side, Math.sin(ang))), [0, 0.18, 0]));
  };
  const grow = (a, dir, len, r, depth) => {
    const b = v3.add(a, v3.mul(dir, len));
    limb(a, b, r, r * 0.7);
    if (depth === 1) d.node(b, 0.2, 14, { t: [1, 2, 3][tips.length % 3] });
    if (depth >= 2) d.cloud(v3.mix(a, b, 0.7), [0.42, 0.32, 0.42], 1.0, { s: 0.7, sv: 0.35, j: 0.02, acc: [3, 0.25] });
    if (depth >= 3) {
      tips.push(b);
      return;
    }
    const kids = depth < 2 ? 3 : 2;
    for (let k = 0; k < kids; k++) grow(b, turn(dir, 0.42 + rnd() * 0.25, (k / kids) * TAU + rnd() * 1.2), len * (0.68 + rnd() * 0.1), r * 0.6, depth + 1);
  };
  for (let k = 0; k < 5; k++) {
    const az = (k / 5) * TAU + 0.3;
    const el = 0.85 + (k % 2) * 0.3; // yataydan yükselme açısı (dik dallar → yuvarlak taç; dallar taç içinde kalır)
    grow(top, v3.norm([Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az) * 0.8]), 1.45, 0.3, 1);
  }
  grow(top, [0.04, 1, 0.02], 1.8, 0.32, 2); // orta (önder) dal
  // dal uçlarında küçük yaprak kümeleri
  for (const q of tips) d.cloud(q, [0.5, 0.4, 0.45], 0.7, { s: 0.72, sv: 0.4, j: 0.02, acc: [3, 0.3] });
  // taç: yuvarlak kubbe — yaprak öbekleri elipsoit yüzeyine yakın dağılır (meşe/çınar silueti); alt kısım açık, gövde ve dallar görünür
  const C = [0.1, 1.6, 0];
  const RR = [2.4, 3.0, 2.2]; // taç yüksekliği ≈ genişliği: yuvarlak ağaç (yassı taç «mantar» gibi okunuyordu)
  for (let i = 0; i < 34; i++) {
    const yy = -0.62 + 1.62 * ((i + 0.5) / 34); // −0,62…1 (yuvarlak taç; altı kısmen açık)
    const ang = i * 2.39996; // altın açı
    const rr = Math.sqrt(Math.max(0, 1 - Math.min(1, yy) ** 2));
    const dir = [Math.cos(ang) * rr, Math.min(1, yy), Math.sin(ang) * rr];
    const q = [C[0] + dir[0] * RR[0] * 0.86, C[1] + dir[1] * RR[1] * 0.86, C[2] + dir[2] * RR[2] * 0.86];
    d.cloud(q, [0.85, 0.85, 0.8], 8, { s: 0.72, sv: 0.4, j: 0.02, acc: [3, 0.28] });
  }
  d.done(Nf);
}

/* ── Teşvik, AB Projeleri ve Startup: yükselen destek basamakları, üzerinden yükselen ok; arkada AB'nin on iki yıldızlı halkası */
export function tesvik(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const steps = [1.0, 1.8, 2.8, 4.0, 5.4];
  const w = 1.5;
  steps.forEach((h, i) => {
    const x = -5.4 + i * 1.9;
    d.box([x, FLOOR + h / 2, 0.6], [w, h, 1.4], { t: i === steps.length - 1 ? 3 : i % 2 ? 1 : 0, s: 0.95 }, { top: 3, front: Math.round(h * 1.6) });
  });
  // yükselen ok (eğri + uç)
  const P = (u) => [-6.0 + u * 11.2, FLOOR + 2.0 + Math.pow(u, 1.6) * 6.0, 1.9];
  d.curve(P, { t: 2, s: 1.25, d: 2.6 }, 80);
  const tip = P(1);
  const back = v3.norm(v3.sub(P(0.97), tip));
  const side = [-back[1], back[0], 0];
  d.line(tip, v3.add(tip, v3.add(v3.mul(back, 0.9), v3.mul(side, 0.45))), { t: 2, s: 1.25, d: 2.6 });
  d.line(tip, v3.add(tip, v3.sub(v3.mul(back, 0.9), v3.mul(side, 0.45))), { t: 2, s: 1.25, d: 2.6 });
  // AB yıldız halkası (12 yıldız)
  const C = [3.2, 2.3, -2.6];
  const star = (c, r) => {
    const pts = Array.from({ length: 11 }, (_, k) => {
      const a = Math.PI / 2 + (k * TAU) / 10;
      const rr = k % 2 ? r * 0.42 : r;
      return [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2]];
    });
    d.poly(pts, { t: 1, s: 1.05, d: 1.6 });
  };
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    star([C[0] + Math.cos(a) * 1.9, C[1] + Math.sin(a) * 1.9, C[2]], 0.28);
  }
  // zemin
  d.line([-6.4, FLOOR, 1.5], [4.2, FLOOR, 1.5], { s: 0.9, d: 0.9 });
  d.line([-6.4, FLOOR, -0.3], [4.2, FLOOR, -0.3], { s: 0.7, d: 0.5 });
  d.done(Nf);
}

/* ── Hukuk: büyük paragraf işareti (§), önde tokmak ve altlığı */
export function hukuk(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // § — üç yay: üst kıvrım, ortadaki halka, alt kıvrım
  const S = 3.6;
  const c = [-2.6, -0.6, -0.8];
  const at = (x, y) => [c[0] + x * S, c[1] + y * S, c[2]];
  const o = { t: 1, s: 1.2, d: 2.4 };
  d.arc(at(0.3, 0.86), X, Y, 0.24 * S, 0.15, Math.PI * 1.5, o);
  d.circle(at(0.3, 0.46), X, Y, 0.19 * S, o);
  d.arc(at(0.3, 0.06), X, Y, 0.24 * S, Math.PI + 0.15, Math.PI * 2.5, o);
  // tokmak: başlık (yatay silindir), sap; eğik
  const ang = 0.5;
  const ax = [Math.cos(ang), Math.sin(ang), 0];
  const head = [2.3, 0.4, 0.9];
  const hu = [-ax[1], ax[0], 0]; // başlık ekseni (sapa dik)
  const cyl = (a, b, r, n = 14, oo = {}) => {
    const ax2 = v3.norm(v3.sub(b, a));
    const u = Math.abs(ax2[2]) < 0.9 ? v3.norm([-ax2[1], ax2[0], 0]) : X;
    const w = [ax2[1] * u[2] - ax2[2] * u[1], ax2[2] * u[0] - ax2[0] * u[2], ax2[0] * u[1] - ax2[1] * u[0]];
    for (let k = 0; k < n; k++) {
      const t = (k / n) * TAU;
      const off = v3.add(v3.mul(u, Math.cos(t) * r), v3.mul(w, Math.sin(t) * r));
      d.line(v3.add(a, off), v3.add(b, off), { s: 0.9, d: 0.8, ...oo });
    }
    d.circle(a, u, w, r, { s: 1.0, d: 1.4, ...oo });
    d.circle(b, u, w, r, { s: 1.0, d: 1.4, ...oo });
  };
  cyl(v3.add(head, v3.mul(hu, -1.3)), v3.add(head, v3.mul(hu, 1.3)), 0.62, 16, { t: 0 });
  cyl(head, v3.add(head, v3.mul(ax, 4.2)), 0.16, 8, { t: 2 });
  // altlık (yassı silindir)
  const blk = [2.9, -2.2, 0.9];
  d.circle(blk, X, Z, 1.6, { s: 1.05, d: 1.8 });
  d.circle([blk[0], blk[1] + 0.45, blk[2]], X, Z, 1.6, { s: 1.05, d: 1.8 });
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * TAU;
    d.line([blk[0] + Math.cos(t) * 1.6, blk[1], blk[2] + Math.sin(t) * 1.6], [blk[0] + Math.cos(t) * 1.6, blk[1] + 0.45, blk[2] + Math.sin(t) * 1.6], { s: 0.85, d: 0.6 });
  }
  d.done(Nf);
}

/* ── Akademi: antik okul binası — üç basamaklı kaide, önde altı sütun, arkada duvar ve kapı; sütunları kiriş, frizdeki «AKADEMİ» yazısı ve
   üçgen alınlık birleştirir, çatı derinliğe uzanır. (Ayrık sütun sıraları zayıf bulunmuştu: müşteri geri bildirimi, Ekim 2026) */
export function okul(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const W = 11.6; // ön genişlik
  const D = 5.0; // derinlik
  const zF = D / 2;
  const zB = -D / 2;
  // kaide: üç basamak
  for (let k = 0; k < 3; k++) {
    const h = 0.32;
    const y = FLOOR + k * h + h / 2;
    d.box([0, y, 0], [W + 1.4 - k * 0.55, h, D + 1.4 - k * 0.55], { s: 0.9, d: 0.9 }, { top: k === 2 ? 0 : 1 });
  }
  const y0 = FLOOR + 0.96; // sütun tabanı
  const y1 = 1.2; // sütun başlığı
  const cols = 6;
  const colX = (i) => -W / 2 + 0.75 + (i * (W - 1.5)) / (cols - 1);
  const column = (x, z, r = 0.38) => {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      d.line([x + Math.cos(a) * r, y0 + 0.2, z + Math.sin(a) * r], [x + Math.cos(a) * r * 0.88, y1 - 0.25, z + Math.sin(a) * r * 0.88], { s: 0.85, d: 0.55 });
    }
    d.box([x, y0 + 0.1, z], [r * 2.6, 0.2, r * 2.6], { s: 0.95, d: 1.0 });
    d.box([x, y1 - 0.12, z], [r * 2.6, 0.24, r * 2.6], { s: 0.95, d: 1.0 });
  };
  for (let i = 0; i < cols; i++) column(colX(i), zF - 0.55);
  // yan sütunlar (önden arkaya)
  for (const z of [zF - 1.75, zF - 2.95]) {
    column(colX(0), z, 0.34);
    column(colX(cols - 1), z, 0.34);
  }
  // iç duvar (cella) ve kapı
  d.rect([0, (y0 + y1) / 2, zB + 0.6], X, Y, W - 3.2, y1 - y0, { s: 0.9, d: 1.0 });
  d.poly([[-0.8, y0, zB + 0.6], [-0.8, y0 + 2.6, zB + 0.6], [0.8, y0 + 2.6, zB + 0.6], [0.8, y0, zB + 0.6]], { t: 1, s: 1.0, d: 1.2 });
  // kiriş (arşitrav) + friz + korniş
  d.box([0, y1 + 0.28, 0], [W, 0.56, D], { s: 1.0, d: 1.3 }, { front: 2 });
  d.box([0, y1 + 0.95, 0], [W + 0.3, 0.78, D + 0.3], { s: 1.0, d: 1.3 });
  d.text('AKADEMİ', [0, y1 + 0.67, zF + 0.17], X, Y, 0.5, { align: 'center', t: 1, s: 1.1, d: 2.2 });
  // alınlık: ön ve arka üçgen, çatı çizgileri
  const yP = y1 + 1.34;
  const peak = yP + 1.75;
  const tri = (z) => [[-W / 2 - 0.15, yP, z], [0, peak, z], [W / 2 + 0.15, yP, z]];
  d.poly(tri(zF + 0.15), { s: 1.1, d: 1.8 }, true);
  d.poly(tri(zB - 0.15), { s: 0.9, d: 0.9 }, true);
  d.line([0, peak, zF + 0.15], [0, peak, zB - 0.15], { s: 1.0, d: 1.2 });
  for (let k = 1; k < 6; k++) {
    const u = k / 6;
    for (const sgn of [-1, 1]) d.line([sgn * (W / 2 + 0.15) * (1 - u), yP + 1.75 * u, zF + 0.15], [sgn * (W / 2 + 0.15) * (1 - u), yP + 1.75 * u, zB - 0.15], { s: 0.75, d: 0.35 });
  }
  // alınlık içinde açık kitap
  const bk = [0, yP + 0.55, zF + 0.2];
  d.poly([[bk[0] - 0.95, bk[1], bk[2]], [bk[0], bk[1] - 0.18, bk[2]], [bk[0] + 0.95, bk[1], bk[2]], [bk[0] + 0.95, bk[1] + 0.55, bk[2]], [bk[0], bk[1] + 0.37, bk[2]], [bk[0] - 0.95, bk[1] + 0.55, bk[2]], [bk[0] - 0.95, bk[1], bk[2]]], { t: 3, s: 1.05, d: 1.4 });
  d.line([bk[0], bk[1] - 0.18, bk[2]], [bk[0], bk[1] + 0.37, bk[2]], { t: 3, s: 1.0, d: 1.2 });
  d.done(Nf);
}
