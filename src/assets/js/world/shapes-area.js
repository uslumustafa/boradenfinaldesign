// Hizmet alanı formasyonları (ana sayfa «Hizmet alanları» bandı ve alan sayfaları) — Ekim 2026 sekiz alanlı yapı.
// Vergi: beyan rakamları · Kurumsal Finansman: karar ağacı · Teşvik: destek basamakları ve AB yıldız halkası · Hukuk: § ve tokmak ·
// Dijital Dönüşüm: kâğıttan ekrana · Akademi: antik okul binası. Saf hesaplama; yerleşim: x ∈ [−6,5, 6,5], y ∈ [−4,2, 4,5], z ∈ [−3,5, 3,5].
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

/* ── Kurumsal Finansman: karar ağacı — ilk «yapı ağacı»nın çizgi dili (dallar ve parlak karar düğümleri), olgun bir ağaç olarak:
   kökleri olan kalın gövde, altı kademe dallanma, geniş taç; dal uçlarında küçük yaprak pırıltıları. (Ekim 2026: ilk ağaç «yeni filizlenen
   fidan», yuvarlak bulut taçlı ikinci deneme «ağaç olmamış» bulundu; müşteri «eski formda ama daha büyük, dalları olan» bir ağaç istedi.) */
export function agac(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const LEN = [1.5, 2.3, 1.75, 1.35, 1.05, 0.8, 0.6]; // kademe → dal boyu
  const R = [0.3, 0.18, 0.11, 0.07, 0.045, 0.03, 0.02]; // kademe → dal kalınlığı (yarıçap)
  const S = [1.05, 1.0, 0.95, 0.9, 0.86, 0.82, 0.8]; // kademe → nokta boyu
  const DENS = [3.0, 2.3, 1.7, 1.25, 1.0, 0.85, 0.7]; // kademe → yoğunluk
  const segs = [];
  const forks = [];
  const tips = [];
  const grow = (a, dir, depth) => {
    const b = v3.add(a, v3.mul(dir, LEN[depth] * (0.9 + rnd() * 0.2)));
    segs.push({ a, b, depth });
    if (depth >= 6) {
      tips.push(b);
      return;
    }
    if (depth >= 1 && depth <= 3) forks.push(b);
    const kids = depth < 3 ? 3 : 2;
    const spread = [0.95, 0.9, 0.8, 0.72, 0.66, 0.6][depth];
    for (let k = 0; k < kids; k++) {
      const ang = (k / kids) * TAU + rnd() * 1.1 + depth * 0.7;
      grow(b, v3.norm([dir[0] + Math.cos(ang) * spread, dir[1] * 0.82 + 0.32, dir[2] + Math.sin(ang) * spread * 0.85]), depth + 1);
    }
  };
  // gövde: tabandan hafif kıvrımla yükselir, sonra dallanır
  const base = [0, FLOOR - 0.1, 0];
  const mid = [0.15, FLOOR + 1.6, 0.05];
  segs.push({ a: base, b: mid, depth: 0, r: 0.42 });
  grow(mid, v3.norm([-0.08, 1, 0]), 0);
  // kökler: tabandan yere yayılan beş kök, uçlarında ince saçaklar
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + 0.5;
    const r1 = 1.2 + (k % 2) * 0.5;
    const p1 = [Math.cos(a) * r1, FLOOR - 0.05, Math.sin(a) * r1 * 0.8];
    segs.push({ a: [Math.cos(a) * 0.25, FLOOR + 0.35, Math.sin(a) * 0.2], b: p1, depth: 3 });
    for (const s of [-0.45, 0.45]) segs.push({ a: p1, b: [p1[0] + Math.cos(a + s) * 0.9, FLOOR - 0.1, p1[2] + Math.sin(a + s) * 0.7], depth: 5 });
  }
  // sahneye sığdır: taç genişliği |x|, |z| ≤ 6,4; tepe ≤ 4,6 (taban sabit)
  const all = [...segs.flatMap((s) => [s.a, s.b]), ...tips];
  const mxz = Math.max(...all.map((q) => Math.max(Math.abs(q[0]), Math.abs(q[2]))));
  const myy = Math.max(...all.map((q) => q[1]));
  const k = Math.min(1, 6.4 / mxz, (4.6 - FLOOR) / (myy - FLOOR));
  const fit = (q) => [q[0] * k, FLOOR + (q[1] - FLOOR) * k, q[2] * k];
  // dallar: kesitinde dolu silindir gibi (kalınlık kademeyle incelir)
  for (const sg of segs) {
    const a = fit(sg.a);
    const b = fit(sg.b);
    const r = (sg.r ?? R[sg.depth]) * k;
    d.part(v3.dist(a, b) * DENS[sg.depth], (n) => {
      for (let i = 0; i < n; i++) {
        const q = v3.mix(a, b, (i + rnd() * 0.7) / n);
        d.pt(q[0] + (rnd() - 0.5) * 2 * r, q[1] + (rnd() - 0.5) * 1.2 * r, q[2] + (rnd() - 0.5) * 2 * r, { s: S[sg.depth], sv: 0.3, j: 0 });
      }
    });
  }
  // karar düğümleri (ilk üç çatal): seyrek, parlak; mavi · kırmızı · yeşil
  forks.forEach((c, i) => d.node(fit(c), 0.2, 3, { t: [1, 2, 3][i % 3] }));
  // yaprak pırıltıları (dal uçları)
  tips.forEach((c) => d.cloud(fit(c), 0.16, 0.22, { s: 1.0, sv: 0.5, j: 0.01, acc: [3, 0.4], cap: 8 }));
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

/* ── Dijital Dönüşüm: kâğıttan dijitale — solda kâğıt fatura (başlık, satırlar, tutar), ortada ekrana akan 0 ve 1'ler, sağda ekranda
   aynı tutarla e-fatura, rapor çubukları ve onay işareti; üstte veriyi eşitleyen bulut (e-arşiv). Akış soldan sağa ve aşağıdan yukarı:
   şekil dar kalır, sayfa başlığına taşmaz.
   (Önceki «veri katmanları» şekli anlaşılmadı: müşteri geri bildirimi, Ekim 2026) */
const bez = (a, b, c, e) => (u) => {
  const k = 1 - u;
  return [0, 1, 2].map((i) => k * k * k * a[i] + 3 * k * k * u * b[i] + 3 * k * u * u * c[i] + u * u * u * e[i]);
};
export function dijital(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // kâğıt faturalar (solda, aşağıda): arkada bir yaprak, önde okunur fatura — başlık, satırlar, tutar
  const sheet = (c, ang) => ({ c, u: [Math.cos(ang), Math.sin(ang), 0], v: [-Math.sin(ang), Math.cos(ang), 0] });
  const B = sheet([-2.95, -0.75, -0.5], -0.1);
  d.rect(B.c, B.u, B.v, 2.4, 3.2, { s: 0.8, d: 0.8 });
  const F = sheet([-3.3, -1.05, 0], 0.07);
  d.rect(F.c, F.u, F.v, 2.4, 3.2, { s: 1.05, d: 1.6 });
  const at = (a, b) => [F.c[0] + F.u[0] * a + F.v[0] * b, F.c[1] + F.u[1] * a + F.v[1] * b, F.c[2] + 0.01];
  d.text('FATURA', at(0, 0.95), F.u, F.v, 0.4, { align: 'center', s: 1.1, d: 2.0 });
  for (let r = 0; r < 4; r++) d.line(at(-0.9, 0.45 - r * 0.33), at(0.9 - (r === 3 ? 0.7 : rnd() * 0.3), 0.45 - r * 0.33), { s: 0.75, d: 0.5 });
  d.line(at(-0.9, -0.9), at(0.9, -0.9), { s: 0.85, d: 0.7 });
  d.text('₺', at(-0.92, -1.38), F.u, F.v, 0.34, { t: 1, s: 1.05, d: 1.6 });
  d.text('12.500', at(0.92, -1.38), F.u, F.v, 0.32, { align: 'right', s: 1.05, d: 1.8 });
  // akış: kâğıttan ekrana yukarı doğru üç şerit; 0 ve 1'ler ekrana yaklaştıkça büyür, kâğıdın kenarında kırıntılar
  const lanes = [
    bez([-2.0, 0.1, 0.3], [-1.2, 0.9, 0.5], [-0.6, 1.6, 0.5], [0.15, 1.6, 0.3]),
    bez([-2.0, -0.9, 0.3], [-1.1, -0.5, 0.6], [-0.6, 0.6, 0.6], [0.15, 0.85, 0.3]),
    bez([-2.0, -1.9, 0.3], [-1.0, -1.7, 0.5], [-0.5, -0.2, 0.5], [0.15, 0.1, 0.3]),
  ];
  lanes.forEach((L, li) => {
    d.curve(L, { t: 1, s: 0.75, d: 0.4 });
    for (let k = 0; k < 5; k++) {
      const u = 0.12 + k * 0.19;
      const q = L(u);
      const sz = 0.2 + u * 0.18;
      d.text(rnd() < 0.5 ? '0' : '1', [q[0], q[1] - sz * 0.5, q[2]], X, Y, sz, { align: 'center', t: (k + li) % 4 === 3 ? 3 : 1, s: 1.0, d: 1.7 });
    }
  });
  d.cloud([-2.0, -0.9, 0.3], [0.25, 1.2, 0.3], 1.0, { s: 0.75, sv: 0.4, j: 0.02, acc: [1, 0.4] });
  // ekran (sağda, yukarıda): çerçeve (derinlikli), iç ekran, ayak
  const M = [2.4, 0.9, 0.2];
  const MW = 4.6;
  const MH = 3.0;
  d.box([M[0], M[1], M[2] - 0.15], [MW, MH, 0.3], { s: 1.0, d: 1.4 });
  d.rect([M[0], M[1], M[2] + 0.02], X, Y, MW - 0.35, MH - 0.35, { t: 1, s: 0.9, d: 1.0 });
  d.line([M[0], M[1] - MH / 2, M[2] - 0.15], [M[0], M[1] - MH / 2 - 0.85, M[2] - 0.15], { s: 1.0, d: 1.2 });
  d.circle([M[0], M[1] - MH / 2 - 0.9, M[2] - 0.15], X, Z, 0.95, { s: 0.95, d: 1.1 });
  // ekrandaki e-fatura: başlık; solda yükselen rapor çubukları, sağda aynı tutar ve onay işareti
  const S = (a, b) => [M[0] + a, M[1] + b, M[2] + 0.04];
  d.text('E-FATURA', S(-1.9, 0.88), X, Y, 0.28, { t: 1, s: 1.05, d: 1.8 });
  d.line(S(-2.0, 0.72), S(2.0, 0.72), { t: 1, s: 0.85, d: 0.6 });
  [0.55, 0.9, 1.2, 1.6].forEach((h, k) => {
    const c = S(-1.75 + k * 0.46, -1.15 + h / 2);
    const t = [1, 2, 1, 3][k];
    d.rect(c, X, Y, 0.3, h, { t, s: 0.95, d: 1.1 });
    d.hatch(c, X, Y, 0.22, h - 0.08, Math.max(2, Math.round(h * 4)), { t, s: 0.8, d: 0.4 });
  });
  d.line(S(-2.0, -1.17), S(-0.15, -1.17), { s: 0.85, d: 0.6 });
  d.text('₺', S(0.1, 0.05), X, Y, 0.34, { t: 1, s: 1.05, d: 1.6 });
  d.text('12.500', S(1.95, 0.05), X, Y, 0.34, { align: 'right', s: 1.1, d: 1.9 });
  d.line(S(0.1, -0.3), S(1.95, -0.3), { s: 0.8, d: 0.5 });
  d.circle(S(1.05, -0.85), X, Y, 0.32, { t: 3, s: 1.05, d: 1.4 });
  d.poly([S(0.89, -0.85), S(1.0, -0.98), S(1.24, -0.7)], { t: 3, s: 1.2, d: 2.2 });
  // bulut ve eşitleme okları (e-arşiv)
  const z0 = -0.4;
  d.arc([1.8, 3.55, z0], X, Y, 0.4, Math.PI * 0.5, Math.PI * 1.5, { s: 1.05, d: 1.6 });
  d.arc([2.4, 3.75, z0], X, Y, 0.58, Math.PI * 0.08, Math.PI * 0.92, { s: 1.05, d: 1.6 });
  d.arc([3.05, 3.57, z0], X, Y, 0.42, -Math.PI * 0.5, Math.PI * 0.5, { s: 1.05, d: 1.6 });
  d.line([1.8, 3.15, z0], [3.05, 3.15, z0], { s: 1.0, d: 1.4 });
  for (const [x, up, t] of [[2.15, 1, 3], [2.65, -1, 1]]) {
    const a = [x, M[1] + MH / 2 + 0.12, z0 / 2];
    const b = [x, 3.02, z0];
    d.line(a, b, { t, s: 1.0, d: 1.4 });
    const tip = up > 0 ? b : a;
    d.line(tip, [x - 0.16, tip[1] - up * 0.22, tip[2]], { t, s: 1.0, d: 1.2 });
    d.line(tip, [x + 0.16, tip[1] - up * 0.22, tip[2]], { t, s: 1.0, d: 1.2 });
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
