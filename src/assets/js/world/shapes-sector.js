// Sektör şekilleri (20 Ekim 2026, müşteri geri bildirimi: «yaptığın şekiller çok alakasız; turizm için deniz, otel tarzı, palmiye ağaçları,
// inşaata binalar — şekiller doğrudan bağlantılı olmalı»; nesne listesini proje sahibi onayladı). Önceki soyut muhasebe çizelgeleri (kayıp
// dağılımı, maliyet akışı, varlık ömrü, edimler, alacak akışı, sezon eğrisi, üç halka; eski dosya _to_delete/sektor-soyut-sekiller-2026-10-20/)
// yerine her sektöre bir bakışta tanınan nesneler:
//   kasa     — Finansal Hizmetler: çarklı kasa kapısı ve yükselen para kuleleri
//   fabrika  — Üretim ve Sanayi: testere dişi çatılı fabrika, bacalar ve dişli çark
//   enerji   — Enerji ve Doğal Kaynaklar: rüzgâr türbinleri ve güneş panelleri
//   magaza   — Perakende, Tüketici ve Gıda: çizgili tenteli mağaza vitrini ve alışveriş poşetleri
//   kule     — Teknoloji, Medya ve Telekomünikasyon: iletişim kulesi, sinyal halkaları ve akıllı telefon
//   ilac     — Sağlık ve İlaç: ilaç şişesi, kapsüller ve tabletler, kalp ritmi çizgisi
//   vinc     — İnşaat, Gayrimenkul ve Altyapı: kule vinç, yükselen bina iskeleti ve bitmiş binalar
//   otel     — Turizm, Ulaştırma ve Lojistik: deniz kıyısında otel, palmiyeler, güneş ve dalgalar
//   aile     — Aile Şirketleri ve KOBİ'ler: üç kuşak aile (bastonlu büyük, ebeveyn, çocuk) ve küçük işletme binası
//   kamu     — Kamu ve Sivil Toplum: kubbeli, sütunlu kamu binası ve el ele tutuşan insanlar
// Okunurluk (Vergi şekilleriyle aynı ilkeler, shapes-vergi.js): dış hatlar yoğun ve iri noktalı (d, s yüksek), iç ayrıntı seyrek; nesneler
// kameraya dönük durur (salınım, tam tur yok); yazı yok; renkler parçaları ayırır (0 beyaz-mavi gövde, 1 mavi ayrıntı, 2 kırmızı vurgu,
// 3 yeşil). Uzun parçalar sağda: sektör sayfası kahramanında soldaki başlık sütunuyla çakışmaz. Ana sayfa Sektörler bandında aynı şekiller
// solda, tanım yazısının altında durur (formations.js › SECTOR_LEFT). Saf hesaplama; yerleşim x ∈ [−6,2, 6,2], y ∈ [−4,0, 4,4],
// z ∈ [−2,5, 2,6] (tests/formations.test.mjs sınırları).
import { Draw, X, Y, Z, TAU, v3 } from './draw.js';

const FLOOR = -4.0;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Eksene dik birim taban: [eksen, u, w]. */
const basis = (ax) => {
  const a = v3.norm(ax);
  const u = v3.norm(cross(a, Math.abs(a[1]) < 0.9 ? Y : X));
  return [a, u, cross(a, u)];
};
/** Kübik Bézier: u ∈ [0,1] → nokta. */
const bez = (a, b, c, e) => (u) => {
  const k = 1 - u;
  return [0, 1, 2].map((i) => k * k * k * a[i] + 3 * k * k * u * b[i] + 3 * k * u * u * c[i] + u * u * u * e[i]);
};

/** a → b ekseninde kesik koni (r0 → r1; eşitse silindir): n doğrultu çizgisi + iki uç çemberi. */
function frustum(d, a, b, r0, r1, n = 10, o = {}) {
  const [, u, w] = basis(v3.sub(b, a));
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU;
    const dir = v3.add(v3.mul(u, Math.cos(t)), v3.mul(w, Math.sin(t)));
    d.line(v3.add(a, v3.mul(dir, r0)), v3.add(b, v3.mul(dir, r1)), { s: 0.85, d: 0.55, ...o });
  }
  d.circle(a, u, w, r0, { s: 1.0, d: 1.2, ...o });
  d.circle(b, u, w, r1, { s: 1.0, d: 1.2, ...o });
}
const cylinder = (d, a, b, r, n, o) => frustum(d, a, b, r, r, n, o);

/** Madeni para: c merkez, ax yüz normali, r yarıçap, th kalınlık — iki yüz, iç halka, kenar tırtılları. */
function coin(d, c, ax, r, th, o = {}, ridges = 18) {
  const [a, u, w] = basis(ax);
  const f0 = v3.add(c, v3.mul(a, -th / 2));
  const f1 = v3.add(c, v3.mul(a, th / 2));
  d.circle(f1, u, w, r, { s: 1.1, d: 1.8, ...o });
  d.circle(f0, u, w, r, { s: 0.95, d: 1.1, ...o });
  d.circle(f1, u, w, r * 0.78, { s: 0.85, d: 0.6, ...o });
  for (let k = 0; k < ridges; k++) {
    const t = (k / ridges) * TAU;
    const off = v3.add(v3.mul(u, Math.cos(t) * r), v3.mul(w, Math.sin(t) * r));
    d.line(v3.add(f0, off), v3.add(f1, off), { s: 0.8, d: 0.45, ...o });
  }
}

/** Dolu görünen küre: yüzeyde noktalar + kameraya dönük çevre çizgisi. */
function ball(d, c, r, w = 20, o = {}) {
  const [rx, ry, rz] = typeof r === 'number' ? [r, r, r] : r;
  d.shell(c, [rx, ry, rz], w, { s: 0.85, sv: 0.3, j: 0.015, ...o });
  d.curve((u) => [c[0] + rx * Math.cos(u * TAU), c[1] + ry * Math.sin(u * TAU), c[2]], { s: 1.05, d: 1.6, ...o }, 72);
}

/** Yuvarlak köşeli dikdörtgen (c merkez, u/v düzlem yönleri, w × h, köşe yarıçapı r): kapalı kırık çizgi noktaları. */
function rrect(c, u, v, w, h, r, k = 6) {
  const out = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-(w / 2 - r), h / 2 - r, Math.PI / 2], [-(w / 2 - r), -(h / 2 - r), Math.PI], [w / 2 - r, -(h / 2 - r), Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= k; i++) {
      const a = a0 + (i / k) * (Math.PI / 2);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      out.push([c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y, c[2] + u[2] * x + v[2] * y]);
    }
  }
  return out;
}

/** Ofis/konut bloğu: taban merkezi b, boyut [w, h, dp]; ön yüzde kat çizgileri ve pencere dikmeleri, sağ yüzde kat çizgileri. */
function building(d, b, [w, h, dp], { floors = 6, cols = 3, o = {}, win = {} } = {}) {
  d.box([b[0], b[1] + h / 2, b[2]], [w, h, dp], { s: 1.1, d: 1.8, ...o });
  const zf = b[2] + dp / 2;
  const xr = b[0] + w / 2;
  const fh = h / floors;
  const wo = { s: 0.75, d: 0.42, t: 1, ...win };
  for (let i = 1; i < floors; i++) {
    const y = b[1] + i * fh;
    d.line([b[0] - w / 2, y, zf], [xr, y, zf], wo);
    d.line([xr, y, zf], [xr, y, zf - dp], { ...wo, d: wo.d * 0.7 });
  }
  for (let j = 1; j < cols; j++) {
    const x = b[0] - w / 2 + (w * j) / cols;
    d.line([x, b[1], zf], [x, b[1] + h, zf], wo);
  }
}

/** Şekli yatayda sığdırır: noktaların x aralığı ortalanıp [−half, half] içine alınır; gerekirse zemine (FLOOR) göre orantılı küçültülür —
 *  nesneler zeminde kalır. Sektör şekilleri iki nesneyi yan yana taşıdığı için genişti (±6–7): dikey telefonda yanlardan kırpılıyor, yan
 *  çevrilmiş telefonda başlık sütununa giriyordu (tests/hero-overlap.e2e.mjs --set=sektorler). Vergi şekilleriyle aynı genişlik (±5,3). */
function fitX(p, i0, half = 5.3) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = i0; i < p.n; i++) {
    lo = Math.min(lo, p.x[i]);
    hi = Math.max(hi, p.x[i]);
  }
  const k = Math.min(1, (2 * half) / (hi - lo));
  const cx = (lo + hi) / 2;
  for (let i = i0; i < p.n; i++) {
    p.x[i] = (p.x[i] - cx) * k;
    p.y[i] = FLOOR + (p.y[i] - FLOOR) * k;
    p.z[i] *= k;
  }
}

/** Kişi (baş ve omuzlar; bireysel şekliyle aynı çizim, ölçekli): taban merkezi b (zemin), ölçek sc (1 → 7 birim boy). */
function bust(d, b, sc, o = {}) {
  const [PX, B0, PZ] = b;
  const DZ = 0.6;
  const k = sc;
  const Y0 = (y) => B0 + (y - FLOOR) * k; // bireysel'deki y → bu kişinin yüksekliği
  ball(d, [PX, Y0(1.9), PZ + 0.1 * k], 1.1 * k, 26 * k, o);
  cylinder(d, [PX, Y0(0.5), PZ], [PX, Y0(0.85), PZ], 0.44 * k, 8, { s: 0.9, d: 0.45, ...o });
  const torso = (s) => {
    if (s < 0.5) return [2.0 + 0.15 * (s / 0.5), -3.6 + (s / 0.5) * 2.85];
    const ph = ((s - 0.5) / 0.5) * (Math.PI / 2);
    return [0.5 + (2.15 - 0.5) * Math.cos(ph), -0.75 + 1.25 * Math.sin(ph)];
  };
  const surf = (s, ph) => {
    const [r, y] = torso(s);
    return [PX + r * k * 0.86 * Math.cos(ph), Y0(y), PZ + r * k * 0.86 * Math.sin(ph) * DZ];
  };
  d.scatter((r) => {
    let q;
    for (let i = 0; i < 8; i++) {
      q = r();
      if (r() * 2.2 < torso(q)[0]) break;
    }
    return surf(q, r() * TAU);
  }, 90 * k, { s: 0.85, sv: 0.3, j: 0.015, ...o });
  for (const ph of [0, Math.PI]) d.curve((u) => surf(u, ph), { s: 1.1, d: 1.9, ...o }, 80);
  d.curve((u) => surf(0, u * TAU), { s: 1.05, d: 1.5, ...o }, 100);
  d.curve((u) => surf(0.64, u * TAU), { s: 0.85, d: 0.5, ...o }, 100);
  // zeminden boyun hizasına kadar olan gövde: kaba en (sağ/sol uç) ve omuz yüksekliği döner
  return { top: Y0(3.0), shoulder: Y0(0.5), half: 2.15 * k * 0.86 };
}

/* ── Finansal Hizmetler: sağda kare çerçeveli yuvarlak kasa kapısı — kalın kapı, kenarda sürgüler, ortada dört kollu çark ve göbek,
      solda menteşeler; solda önde yeşil madeni para kuleleri (soldan sağa yükselen). */
export function kasa(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const V = [2.5, -0.1, -1.0];
  const S = 3.25; // çerçevenin yarı genişliği
  const zf = V[2] + 0.45;
  const zb = V[2] - 0.45;
  const sq = (z, s) => [[V[0] - s, V[1] - s, z], [V[0] + s, V[1] - s, z], [V[0] + s, V[1] + s, z], [V[0] - s, V[1] + s, z]];
  d.poly(sq(zf, S), { s: 1.15, d: 2.2 }, true);
  d.poly(sq(zb, S), { s: 0.9, d: 0.8 }, true);
  sq(zf, S).forEach((q, i) => d.line(q, sq(zb, S)[i], { s: 0.95, d: 1.0 }));
  d.poly(sq(zf, S - 0.45), { t: 1, s: 0.9, d: 0.8 }, true);
  // kapı: kalın disk, çerçevenin önünde
  const R = 2.5;
  const B = [V[0], V[1], zf + 0.05];
  const F = [V[0], V[1], zf + 0.6];
  d.circle(F, X, Y, R, { s: 1.2, d: 2.6 });
  d.circle(B, X, Y, R, { s: 0.95, d: 1.1 });
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * TAU;
    const off = [Math.cos(a) * R, Math.sin(a) * R, 0];
    d.line(v3.add(B, off), v3.add(F, off), { s: 0.8, d: 0.4 });
  }
  d.circle([F[0], F[1], F[2] + 0.01], X, Y, R * 0.8, { t: 1, s: 1.0, d: 1.3 });
  // sürgü pimleri: iki halka arasında
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU + 0.26;
    d.circle([F[0] + Math.cos(a) * R * 0.9, F[1] + Math.sin(a) * R * 0.9, F[2] + 0.02], X, Y, 0.12, { t: 1, s: 0.9, d: 0.7 });
  }
  // çark: mil, göbek, halka, dört kol ve uçlarda topuzlar
  const H = [F[0], F[1], F[2] + 0.45];
  cylinder(d, F, H, 0.2, 8, {});
  ball(d, H, 0.36, 10);
  d.circle(H, X, Y, 1.2, { s: 1.05, d: 1.5 });
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const e = [H[0] + Math.cos(a) * 1.65, H[1] + Math.sin(a) * 1.65, H[2]];
    d.line(H, e, { s: 1.15, d: 2.0 });
    ball(d, e, 0.22, 6);
  }
  // menteşeler (kapının solunda)
  for (const sy of [-1, 1]) cylinder(d, [V[0] - R - 0.12, V[1] + sy * 1.35 - 0.38, zf + 0.33], [V[0] - R - 0.12, V[1] + sy * 1.35 + 0.38, zf + 0.33], 0.17, 8, { t: 1 });
  // para kuleleri (önde, solda): 4 · 7 · 10 madeni para
  [[-5.15, 4], [-3.55, 7], [-1.95, 10]].forEach(([x, n]) => {
    for (let i = 0; i < n; i++) coin(d, [x + (i % 2 ? 0.05 : -0.04), FLOOR + 0.15 + i * 0.3, 1.7], Y, 0.72, 0.26, { t: 3 }, 16);
  });
  d.done(Nf);
  fitX(p, i0);
}

/** Dişli çark (xy düzleminde, kameraya dönük): c merkez, n diş, dış/dip yarıçap, kalınlık th. */
function gear(d, c, n, ro, ri, th, o = {}) {
  const prof = [];
  const pa = TAU / n;
  for (let k = 0; k < n; k++) {
    const a = k * pa;
    for (const [f, r] of [[0, ri], [0.12, ro], [0.45, ro], [0.57, ri]]) prof.push([Math.cos(a + f * pa) * r, Math.sin(a + f * pa) * r]);
  }
  for (const [z, oo] of [[th / 2, { s: 1.15, d: 2.0 }], [-th / 2, { s: 0.9, d: 0.8 }]]) d.poly(prof.map(([x, y]) => [c[0] + x, c[1] + y, c[2] + z]), { ...oo, ...o }, true);
  for (let i = 0; i < prof.length; i += 2) d.line([c[0] + prof[i][0], c[1] + prof[i][1], c[2] - th / 2], [c[0] + prof[i][0], c[1] + prof[i][1], c[2] + th / 2], { s: 0.8, d: 0.4, ...o });
  d.circle([c[0], c[1], c[2] + th / 2], X, Y, ri * 0.66, { s: 0.95, d: 1.0, ...o });
  d.circle([c[0], c[1], c[2] + th / 2], X, Y, ri * 0.24, { s: 1.0, d: 1.2, ...o });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    d.line([c[0] + Math.cos(a) * ri * 0.24, c[1] + Math.sin(a) * ri * 0.24, c[2] + th / 2], [c[0] + Math.cos(a) * ri * 0.66, c[1] + Math.sin(a) * ri * 0.66, c[2] + th / 2], { s: 0.9, d: 0.8, ...o });
  }
}

/* ── Üretim ve Sanayi: sağda testere dişi çatılı fabrika (camlı dik yüzler, pencereler, yükleme kapısı), arkada kırmızı bantlı iki baca ve
      sola süzülen duman; solda önde mavi dişli çark. */
export function fabrika(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const x0 = -2.3;
  const x1 = 5.7;
  const z0 = -2.2;
  const z1 = 0.4;
  const top = -0.95;
  const teeth = 4;
  const tw = (x1 - x0) / teeth;
  const th = 1.35;
  // bacalar (binanın arkasında, çatıdan yükselir)
  for (const [x, h, r] of [[3.4, 3.4, 0.4], [4.7, 2.7, 0.34]]) {
    const b = [x, top + 0.4, z0 + 0.55];
    const t = [x, top + 0.4 + h, z0 + 0.55];
    cylinder(d, b, t, r, 10, { s: 0.95, d: 0.8 });
    for (const f of [0.78, 0.88]) d.circle([x, b[1] + h * f, b[2]], X, Z, r + 0.02, { t: 2, s: 1.0, d: 1.2 });
    // duman: sola doğru büyüyen bulutlar
    [[-0.15, 0.55, 0.32], [-0.6, 1.0, 0.42], [-1.25, 1.35, 0.5]].forEach(([dx, dy, rr]) => d.cloud([x + dx, t[1] + dy, b[2]], [rr * 1.2, rr * 0.8, rr * 0.6], 1.6 * rr, { s: 0.75, sv: 0.3, j: 0.02 }));
  }
  const prof = (z) => {
    const q = [[x0, FLOOR, z], [x0, top, z]];
    for (let k = 0; k < teeth; k++) q.push([x0 + (k + 1) * tw, top + th, z], [x0 + (k + 1) * tw, top, z]);
    q.push([x1, FLOOR, z]);
    return q;
  };
  d.poly(prof(z1), { s: 1.15, d: 2.2 });
  d.poly(prof(z0), { s: 0.9, d: 0.8 });
  d.line([x0, FLOOR, z1], [x1, FLOOR, z1], { s: 1.0, d: 1.2 });
  for (const x of [x0, x1]) d.line([x, FLOOR, z0], [x, FLOOR, z1], { s: 0.9, d: 0.8 });
  for (let k = 0; k <= teeth; k++) {
    const x = x0 + k * tw;
    d.line([x, top, z0], [x, top, z1], { s: 0.95, d: 1.0 });
    if (k > 0) {
      d.line([x, top + th, z0], [x, top + th, z1], { s: 1.05, d: 1.3 });
      // camlı dik yüz (kuzey ışığı)
      for (let j = 1; j < 6; j++) d.line([x, top + 0.08, z0 + ((z1 - z0) * j) / 6], [x, top + th - 0.08, z0 + ((z1 - z0) * j) / 6], { t: 1, s: 0.8, d: 0.45 });
    }
  }
  // ön cephe: pencere sırası ve yükleme kapısı (kepenk)
  for (let i = 0; i < 4; i++) d.rect([0.7 + i * 1.35, -2.15, z1 + 0.01], X, Y, 0.85, 0.95, { t: 1, s: 0.9, d: 0.8 });
  const dc = [x0 + 1.15, FLOOR + 1.25, z1 + 0.01];
  d.rect(dc, X, Y, 1.6, 2.5, { s: 1.0, d: 1.2 });
  for (let i = 1; i < 6; i++) d.line([dc[0] - 0.8, FLOOR + i * 0.42, dc[2]], [dc[0] + 0.8, FLOOR + i * 0.42, dc[2]], { s: 0.8, d: 0.45 });
  // dişli çark
  gear(d, [-4.25, -2.05, 1.5], 10, 1.9, 1.52, 0.5, { t: 1 });
  d.done(Nf);
  fitX(p, i0);
}

/** Rüzgâr türbini: taban b, kule boyu h, kanat boyu L, kanat dönüş açısı rot. Kule kesik koni, gövde (nasel) kameraya doğru, üç kanat. */
function turbine(d, b, h, L, rot) {
  const top = [b[0], b[1] + h, b[2]];
  frustum(d, b, top, 0.3, 0.13, 8, { s: 0.95, d: 0.9 });
  d.box([top[0], top[1] + 0.12, top[2] + 0.15], [0.44, 0.44, 1.05], { s: 0.95, d: 0.9 });
  const hub = [top[0], top[1] + 0.12, top[2] + 0.8];
  ball(d, hub, 0.24, 6);
  for (let k = 0; k < 3; k++) {
    const a = rot + Math.PI / 2 + (k * TAU) / 3;
    const dir = [Math.cos(a), Math.sin(a), 0];
    const nrm = [-dir[1], dir[0], 0];
    const chord = (u) => (u < 0.2 ? 0.18 + 0.2 * (u / 0.2) : 0.38 - 0.32 * ((u - 0.2) / 0.8));
    const P = (u, side) => {
      const c = chord(u);
      const off = side > 0 ? c * 0.3 : -c * 0.7;
      return [hub[0] + dir[0] * (0.22 + u * L) + nrm[0] * off, hub[1] + dir[1] * (0.22 + u * L) + nrm[1] * off, hub[2] + 0.05];
    };
    const edge = (side) => Array.from({ length: 17 }, (_, i) => P(i / 16, side));
    d.poly([...edge(1), ...edge(-1).reverse()], { s: 1.05, d: 1.6 }, true);
    d.line(P(0, 0), P(0.95, 0), { s: 0.8, d: 0.5 });
  }
}

/** Güneş paneli: ön alt kenarın ortası c, genişlik w, eğim boyu L, eğim açısı tilt; 4 × 3 hücre, iki çift ayak. */
function panel(d, c, w, L, tilt) {
  const [x, y, z] = c;
  const up = [0, Math.sin(tilt), -Math.cos(tilt)];
  const P = (a, b) => [x + a * w, y + b * L * up[1], z + b * L * up[2]];
  d.poly([P(-0.5, 0), P(0.5, 0), P(0.5, 1), P(-0.5, 1)], { s: 1.1, d: 1.8 }, true);
  for (let i = 1; i < 4; i++) d.line(P(-0.5 + i / 4, 0), P(-0.5 + i / 4, 1), { t: 1, s: 0.8, d: 0.6 });
  for (let j = 1; j < 3; j++) d.line(P(-0.5, j / 3), P(0.5, j / 3), { t: 1, s: 0.8, d: 0.6 });
  d.scatter((r) => P(r() - 0.5, r()), 1.4 * w * L, { t: 1, s: 0.7, sv: 0.2, j: 0.01 });
  for (const a of [-0.4, 0.4]) {
    for (const b of [0.05, 0.95]) {
      const q = P(a, b);
      d.line(q, [q[0], FLOOR, q[2]], { s: 0.85, d: 0.6 });
    }
  }
}

/* ── Enerji ve Doğal Kaynaklar: sağda büyük, arkada küçük rüzgâr türbini (üç kanatlı, kameraya dönük rotor); solda önde eğik güneş
      panelleri (mavi hücreler, ayaklar). */
export function enerji(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  turbine(d, [4.0, FLOOR, -1.3], 5.5, 2.75, 0.12);
  turbine(d, [-0.15, FLOOR, -2.3], 4.0, 1.95, 0.7);
  for (let i = 0; i < 3; i++) panel(d, [-5.25 + i * 1.75, -3.15, 1.75], 1.58, 1.45, 0.6);
  d.done(Nf);
  fitX(p, i0);
}

/* ── Perakende, Tüketici ve Gıda: sağda mağaza — tabela, kırmızı-beyaz çizgili tente (dalgalı saçak), raflı vitrin (ürünler), camlı
      kapı; solda önde iki alışveriş poşeti (yeşil poşetten ekmek ve yeşillik, mavi poşetten şişe). */
export function magaza(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const x0 = -1.3;
  const x1 = 5.7;
  const zf = 0.0;
  const zb = -2.0;
  const yt = 2.4;
  d.box([(x0 + x1) / 2, (FLOOR + yt) / 2, (zf + zb) / 2], [x1 - x0, yt - FLOOR, zf - zb], { s: 1.1, d: 1.7 });
  d.rect([(x0 + x1) / 2, 1.85, zf + 0.02], X, Y, x1 - x0 - 0.7, 0.75, { t: 1, s: 1.0, d: 1.2 });
  // tente: cepheden (y 1.25) öne ve aşağı (y 0.35, z 1.45); çizgiler sırayla kırmızı / beyaz
  const yA = 1.3;
  const yB = 0.35;
  const zB = 1.45;
  const nS = 12;
  const ax0 = x0 + 0.15;
  const ax1 = x1 - 0.15;
  const sw = (ax1 - ax0) / nS;
  for (let i = 0; i < nS; i++) {
    const t = i % 2 ? 0 : 2;
    for (let j = 0; j < 4; j++) {
      const x = ax0 + (i + (j + 0.5) / 4) * sw;
      d.line([x, yA, zf + 0.02], [x, yB, zB], { t, s: 0.9, d: 0.75 });
    }
    d.arc([ax0 + (i + 0.5) * sw, yB, zB], X, Y, sw / 2, Math.PI, TAU, { t, s: 1.0, d: 1.4 });
  }
  d.line([ax0, yA, zf + 0.02], [ax1, yA, zf + 0.02], { s: 1.0, d: 1.2 });
  d.line([ax0, yB, zB], [ax1, yB, zB], { s: 1.05, d: 1.5 });
  for (const x of [ax0, ax1]) {
    d.line([x, yA, zf + 0.02], [x, yB, zB], { s: 1.0, d: 1.1 });
    d.line([x, yB, zB], [x, yA - 1.05, zf + 0.02], { s: 0.8, d: 0.5 });
  }
  // vitrin: çerçeve, ortada dikme, iki raf ve ürünler
  const wx0 = -0.85;
  const wx1 = 3.2;
  d.rect([(wx0 + wx1) / 2, -1.75, zf + 0.02], X, Y, wx1 - wx0, 3.3, { s: 1.05, d: 1.4 });
  d.line([(wx0 + wx1) / 2, -3.4, zf + 0.02], [(wx0 + wx1) / 2, -0.1, zf + 0.02], { s: 0.85, d: 0.6 });
  for (const [ys, k] of [[-3.05, 0], [-1.75, 1]]) {
    d.line([wx0 + 0.1, ys, zf - 0.25], [wx1 - 0.1, ys, zf - 0.25], { s: 0.85, d: 0.7 });
    for (let i = 0; i < 6; i++) {
      const x = wx0 + 0.45 + i * 0.62;
      const t = (i + k) % 3 === 0 ? 3 : (i + k) % 3 === 1 ? 1 : 2;
      if ((i + k) % 2) d.rect([x, ys + 0.42, zf - 0.25], X, Y, 0.42, 0.84, { t, s: 0.85, d: 0.6 });
      else d.poly([[x - 0.15, ys, zf - 0.25], [x - 0.15, ys + 0.62, zf - 0.25], [x - 0.06, ys + 0.9, zf - 0.25], [x - 0.06, ys + 1.08, zf - 0.25], [x + 0.06, ys + 1.08, zf - 0.25], [x + 0.06, ys + 0.9, zf - 0.25], [x + 0.15, ys + 0.62, zf - 0.25], [x + 0.15, ys, zf - 0.25]], { t, s: 0.85, d: 0.6 });
    }
  }
  // kapı: çerçeve, cam, kol
  d.rect([4.55, FLOOR + 1.75, zf + 0.02], X, Y, 1.5, 3.5, { s: 1.05, d: 1.3 });
  d.rect([4.55, FLOOR + 2.15, zf + 0.03], X, Y, 1.05, 2.3, { t: 1, s: 0.85, d: 0.6 });
  d.line([3.98, FLOOR + 1.55, zf + 0.04], [3.98, FLOOR + 2.05, zf + 0.04], { s: 1.0, d: 0.8 });
  // alışveriş poşetleri
  const bag = (c, w, h, dp, t) => {
    d.box([c[0], FLOOR + h / 2, c[2]], [w, h, dp], { t, s: 1.05, d: 1.5 });
    for (const z of [c[2] - dp * 0.25, c[2] + dp * 0.25]) d.arc([c[0], FLOOR + h, z], X, Y, w * 0.28, 0, Math.PI, { t, s: 1.0, d: 1.1 });
    d.line([c[0] - w / 2, FLOOR + h * 0.8, c[2] + dp / 2 + 0.01], [c[0] + w / 2, FLOOR + h * 0.8, c[2] + dp / 2 + 0.01], { t, s: 0.8, d: 0.5 });
  };
  bag([-4.45, 0, 1.45], 1.75, 2.15, 1.0, 3);
  bag([-2.6, 0, 1.95], 1.35, 1.65, 0.8, 1);
  // ekmek (somun) ve yeşillik
  const br0 = [-5.0, FLOOR + 1.55, 1.3];
  const br1 = [-4.35, FLOOR + 3.55, 1.2];
  loaf(d, br0, br1, 0.27);
  for (let i = 0; i < 4; i++) d.curve(bez([-3.95 + i * 0.12, FLOOR + 2.0, 1.55], [-3.9 + i * 0.25, FLOOR + 2.6, 1.6], [-3.6 + i * 0.3, FLOOR + 2.9, 1.6], [-3.4 + i * 0.32, FLOOR + 2.75 - i * 0.12, 1.6]), { t: 3, s: 0.95, d: 1.0 }, 30);
  // şişe
  cylinder(d, [-2.45, FLOOR + 1.5, 1.95], [-2.4, FLOOR + 2.35, 1.95], 0.15, 6, { s: 0.85, d: 0.55 });
  cylinder(d, [-2.4, FLOOR + 2.35, 1.95], [-2.4, FLOOR + 2.55, 1.95], 0.19, 6, { t: 2, s: 0.9, d: 0.6 });
  d.done(Nf);
  fitX(p, i0);
}

/** Uzun ekmek: a → b, yarıçap r — yuvarlak uçlu gövde ve üstünde üç çapraz çizik. */
function loaf(d, a, b, r) {
  const [ax, u, w] = basis(v3.sub(b, a));
  const L = v3.dist(a, b);
  const at = (t, ang, k = 1) => v3.add(v3.add(a, v3.mul(ax, t * L)), v3.add(v3.mul(u, Math.cos(ang) * r * k), v3.mul(w, Math.sin(ang) * r * k)));
  const rad = (t) => Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 8)));
  for (let k = 0; k < 8; k++) d.curve((t) => at(t, (k / 8) * TAU, rad(t)), { s: 0.85, d: 0.5 }, 40);
  const side = v3.norm(cross(ax, Z));
  for (const sg of [-1, 1]) d.curve((t) => v3.add(v3.add(a, v3.mul(ax, t * L)), v3.mul(side, sg * r * rad(t))), { s: 1.05, d: 1.4 }, 40);
  for (const t of [0.3, 0.5, 0.7]) d.line(v3.add(at(t - 0.06, 0, 1.0), v3.mul(Z, 0.05)), v3.add(at(t + 0.06, Math.PI, 1.0), v3.mul(Z, 0.05)), { t: 2, s: 0.9, d: 0.8 });
}

/* ── Teknoloji, Medya ve Telekomünikasyon: sağda kafes iletişim kulesi (dört ayak, çapraz bağlar, anten panelleri, kırmızı ikaz lambası),
      tepesinden iki yana yayılan mavi sinyal halkaları; solda önde akıllı telefon (ekranda uygulama simgeleri). */
export function kule(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const B = [3.4, FLOOR, -1.3];
  const H = 6.9;
  const w0 = 1.05;
  const w1 = 0.22;
  const seg = 6;
  const at = (u, sx, sz) => {
    const w = w0 + (w1 - w0) * u;
    return [B[0] + sx * w, B[1] + u * H, B[2] + sz * w];
  };
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of C4) d.line(at(0, sx, sz), at(1, sx, sz), { s: 1.1, d: 1.9 });
  for (let i = 0; i <= seg; i++) d.poly(C4.map(([sx, sz]) => at(i / seg, sx, sz)), { s: 0.9, d: 0.8 }, true);
  for (let i = 0; i < seg; i++) {
    for (let f = 0; f < 4; f++) {
      const [ax, az] = C4[f];
      const [bx, bz] = C4[(f + 1) % 4];
      d.line(at(i / seg, ax, az), at((i + 1) / seg, bx, bz), { s: 0.8, d: 0.45 });
      d.line(at(i / seg, bx, bz), at((i + 1) / seg, ax, az), { s: 0.8, d: 0.45 });
    }
  }
  const T = [B[0], B[1] + H, B[2]];
  d.line(T, [T[0], T[1] + 1.15, T[2]], { s: 1.0, d: 1.3 });
  d.node([T[0], T[1] + 1.2, T[2]], 0.2, 12, { t: 2 });
  for (const [sx, sz] of [[0, 1], [-1, 0], [1, 0]]) {
    const u = 0.8;
    const w = w0 + (w1 - w0) * u + 0.2;
    d.box([B[0] + sx * w, B[1] + u * H, B[2] + sz * w], [sx ? 0.14 : 0.38, 1.0, sz ? 0.14 : 0.38], { t: 1, s: 0.95, d: 0.9 });
  }
  // sinyal halkaları
  const S = [T[0], T[1] + 0.35, T[2]];
  for (const c of [0, Math.PI]) for (const r of [0.85, 1.5, 2.15]) d.arc(S, X, Y, r, c - 0.55, c + 0.55, { t: 1, s: 1.1, d: 1.9 });
  // akıllı telefon (biraz merkeze dönük)
  const a = 0.28;
  const u = [Math.cos(a), 0, -Math.sin(a)];
  const n = [Math.sin(a), 0, Math.cos(a)];
  const P0 = [-3.35, -1.05, 1.3];
  const PW = 2.5;
  const PH = 4.9;
  const front = v3.add(P0, v3.mul(n, 0.16));
  const back = v3.add(P0, v3.mul(n, -0.16));
  const of = rrect(front, u, Y, PW, PH, 0.42);
  const ob = rrect(back, u, Y, PW, PH, 0.42);
  d.poly(of, { s: 1.15, d: 2.2 }, true);
  d.poly(ob, { s: 0.9, d: 0.8 }, true);
  for (let i = 0; i < of.length; i += 7) d.line(of[i], ob[i], { s: 0.85, d: 0.5 });
  const scr = v3.add(front, v3.mul(n, 0.01));
  d.poly(rrect(scr, u, Y, PW - 0.36, PH - 0.7, 0.24), { t: 1, s: 0.95, d: 1.1 }, true);
  const on = (x, y) => v3.add(scr, v3.add(v3.mul(u, x), v3.mul(Y, y)));
  d.circle(on(0, PH / 2 - 0.2), u, Y, 0.07, { s: 0.9, d: 0.4 });
  d.line(on(-0.4, -PH / 2 + 0.2), on(0.4, -PH / 2 + 0.2), { s: 0.95, d: 0.8 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const t = (r * 3 + c) % 4 === 0 ? 2 : (r * 3 + c) % 4 === 1 ? 3 : (r * 3 + c) % 4 === 2 ? 1 : 0;
      d.poly(rrect(on(-0.62 + c * 0.62, 1.35 - r * 0.78), u, Y, 0.42, 0.42, 0.1, 3), { t, s: 0.9, d: 0.75 }, true);
    }
  }
  d.done(Nf);
  fitX(p, i0);
}

/** Kapsül: a → b ekseni, yarıçap r; iki yarı ayrı renk (tA, tB), ortada ek yeri, uçlar yarım küre. */
function capsule(d, a, b, r, tA, tB) {
  const [ax, u, w] = basis(v3.sub(b, a));
  const m = v3.mix(a, b, 0.5);
  const a1 = v3.add(a, v3.mul(ax, r));
  const b1 = v3.sub(b, v3.mul(ax, r));
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * TAU;
    const off = v3.add(v3.mul(u, Math.cos(t) * r), v3.mul(w, Math.sin(t) * r));
    d.line(v3.add(a1, off), v3.add(m, off), { t: tA, s: 0.85, d: 0.55 });
    d.line(v3.add(m, off), v3.add(b1, off), { t: tB, s: 0.85, d: 0.55 });
  }
  d.circle(m, u, w, r * 1.02, { s: 1.0, d: 1.3 });
  for (const [e, sg, t] of [[a1, -1, tA], [b1, 1, tB]]) {
    for (let k = 0; k < 5; k++) {
      const th = (k / 5) * Math.PI;
      d.arc(e, v3.add(v3.mul(u, Math.cos(th)), v3.mul(w, Math.sin(th))), v3.mul(ax, sg), r, 0, Math.PI, { t, s: 0.9, d: 0.75 });
    }
    d.circle(e, u, w, r, { t, s: 0.85, d: 0.5 });
  }
  // gövdenin görünen dış hattı (kameraya göre üst ve alt kenar)
  const side = v3.norm(cross(ax, Z));
  for (const sg of [-1, 1]) d.line(v3.add(a1, v3.mul(side, sg * r)), v3.add(b1, v3.mul(side, sg * r)), { s: 1.05, d: 1.4 });
}

/* ── Sağlık ve İlaç: sağda ilaç şişesi (gövde, omuz, boyun, tırtıllı mavi kapak, etikette yeşil artı); önde kırmızı-beyaz ve mavi-beyaz
      kapsüller, tabletler; arkada yeşil kalp ritmi (EKG) çizgisi. */
export function ilac(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const bx = 3.75;
  const bz = -0.7;
  const up = (y) => [bx, y, bz];
  const R = 1.4;
  cylinder(d, up(FLOOR), up(0.35), R, 14, { s: 1.0, d: 0.7 });
  d.curve((u) => [bx - R, FLOOR + u * (0.35 - FLOOR), bz], { s: 1.15, d: 2.0 }, 20);
  d.curve((u) => [bx + R, FLOOR + u * (0.35 - FLOOR), bz], { s: 1.15, d: 2.0 }, 20);
  frustum(d, up(0.35), up(0.95), R, 0.82, 12, {});
  cylinder(d, up(0.95), up(1.3), 0.82, 10, {});
  cylinder(d, up(1.3), up(2.45), 0.98, 20, { t: 1 });
  // etiket: önde kavisli bant ve artı
  const lab = (y) => (u) => {
    const a = Math.PI / 2 + (u - 0.5) * 1.9;
    return [bx + Math.cos(a) * (R + 0.02), y, bz + Math.sin(a) * (R + 0.02)];
  };
  for (const y of [-3.0, -0.75]) d.curve(lab(y), { t: 1, s: 1.0, d: 1.2 }, 40);
  for (const sg of [-1, 1]) {
    const a = Math.PI / 2 + sg * 0.95;
    d.line([bx + Math.cos(a) * (R + 0.02), -3.0, bz + Math.sin(a) * (R + 0.02)], [bx + Math.cos(a) * (R + 0.02), -0.75, bz + Math.sin(a) * (R + 0.02)], { t: 1, s: 0.95, d: 0.9 });
  }
  const pc = [bx, -1.88, bz + R + 0.05];
  d.rect(pc, X, Y, 0.95, 0.32, { t: 3, s: 1.1, d: 1.6 });
  d.rect(pc, X, Y, 0.32, 0.95, { t: 3, s: 1.1, d: 1.6 });
  d.hatch(pc, X, Y, 0.85, 0.22, 3, { t: 3, s: 0.9, d: 0.8 });
  d.hatch(pc, Y, X, 0.85, 0.22, 3, { t: 3, s: 0.9, d: 0.8 });
  // kapsüller ve tabletler (önde, zeminde)
  capsule(d, [-4.9, FLOOR + 0.55, 1.5], [-1.9, FLOOR + 0.55, 2.15], 0.55, 2, 0);
  capsule(d, [-1.25, FLOOR + 0.5, 2.25], [1.35, FLOOR + 0.5, 1.45], 0.5, 1, 0);
  capsule(d, [-3.9, FLOOR + 0.5, 0.15], [-1.4, FLOOR + 0.95, -0.25], 0.5, 3, 0);
  for (const [x, z] of [[1.75, 2.2], [2.55, 1.75], [0.85, 0.75]]) {
    coin(d, [x, FLOOR + 0.13, z], Y, 0.5, 0.24, {}, 12);
    d.line([x - 0.42, FLOOR + 0.26, z], [x + 0.42, FLOOR + 0.26, z], { s: 0.8, d: 0.5 });
  }
  // kalp ritmi: arkada
  const y0 = 1.9;
  const ecg = [[-6.0, y0], [-4.7, y0], [-4.35, y0 + 0.35], [-4.0, y0], [-3.45, y0], [-3.2, y0 - 0.45], [-2.8, y0 + 2.15], [-2.4, y0 - 1.05], [-2.1, y0], [-1.45, y0], [-1.0, y0 + 0.55], [-0.5, y0], [1.9, y0]];
  const zE = -2.2;
  d.poly(ecg.map(([x, y]) => [x, y, zE]), { t: 3, s: 1.2, d: 2.6 });
  d.poly(ecg.map(([x, y]) => [x, y + 0.05, zE + 0.05]), { t: 3, s: 0.9, d: 0.9 });
  d.node([1.9, y0, zE], 0.16, 10, { t: 3 });
  d.done(Nf);
  fitX(p, i0);
}

/** Kafes direk: taban merkezi b, boy h, yarı genişlik w, n bölme — dört köşe direği, kat çerçeveleri, yüzlerde çapraz bağlar. */
function mast(d, b, h, w, n, o = {}) {
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const at = (u, sx, sz) => [b[0] + sx * w, b[1] + u * h, b[2] + sz * w];
  for (const [sx, sz] of C4) d.line(at(0, sx, sz), at(1, sx, sz), { s: 1.05, d: 1.6, ...o });
  for (let i = 0; i <= n; i++) d.poly(C4.map(([sx, sz]) => at(i / n, sx, sz)), { s: 0.85, d: 0.6, ...o }, true);
  for (let i = 0; i < n; i++) {
    for (let f = 0; f < 4; f++) {
      const [ax, az] = C4[f];
      const [bx, bz] = C4[(f + 1) % 4];
      d.line(at(i / n, ax, az), at((i + 1) / n, bx, bz), { s: 0.78, d: 0.4, ...o });
    }
  }
}

/** Üçgen kafes kiriş (bom): x0 → x1, alt kirişler y'de (z ± w), üst kiriş y + hh'de; n bölme zikzak. */
function jib(d, x0, x1, y, z, hh, w, n, o = {}) {
  const A = (x) => [x, y, z - w];
  const Bq = (x) => [x, y, z + w];
  const T = (x) => [x, y + hh, z];
  d.line(A(x0), A(x1), { s: 1.05, d: 1.6, ...o });
  d.line(Bq(x0), Bq(x1), { s: 1.05, d: 1.6, ...o });
  d.line(T(x0), T(x1), { s: 1.05, d: 1.4, ...o });
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    d.poly([A(x), Bq(x), T(x)], { s: 0.8, d: 0.45, ...o }, true);
    if (i < n) {
      const xn = x0 + ((x1 - x0) * (i + 1)) / n;
      d.line(A(x), T(xn), { s: 0.78, d: 0.4, ...o });
      d.line(Bq(x), T(xn), { s: 0.78, d: 0.4, ...o });
    }
  }
}

/* ── İnşaat, Gayrimenkul ve Altyapı: sağda kule vinç (kafes direk, kabin, uzun bom, karşı bomda kırmızı karşı ağırlık, tepe ve askı
      halatları, araba, kanca ve kırmızı çelik kiriş); bomun altında katları yükselen bina iskeleti; yanında bitmiş yüksek bina, solda
      alçak bina. */
export function vinc(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const M = [4.5, FLOOR, -1.5];
  const mh = 6.5;
  mast(d, M, mh, 0.36, 7);
  const yj = M[1] + mh + 0.3;
  d.box([M[0] - 0.62, yj - 0.25, M[2] + 0.5], [0.75, 0.75, 0.7], { t: 1, s: 1.0, d: 1.1 });
  jib(d, M[0], -4.7, yj, M[2], 0.55, 0.3, 14);
  jib(d, M[0], 6.15, yj, M[2], 0.4, 0.28, 3);
  d.box([5.7, yj - 0.5, M[2]], [0.8, 0.95, 0.8], { t: 2, s: 1.05, d: 1.3 }, { front: 2 });
  const A = [M[0], yj + 1.45, M[2]];
  for (const sx of [-1, 1]) d.line([M[0] + sx * 0.32, yj + 0.1, M[2]], A, { s: 1.0, d: 1.1 });
  d.line(A, [-2.4, yj + 0.55, M[2]], { s: 0.8, d: 0.6 });
  d.line(A, [6.05, yj + 0.4, M[2]], { s: 0.8, d: 0.6 });
  // araba, halat, kanca, kiriş
  const tx = -1.75;
  d.box([tx, yj - 0.12, M[2]], [0.55, 0.22, 0.6], { s: 0.95, d: 0.8 });
  const hy = 0.75;
  for (const dz of [-0.1, 0.1]) d.line([tx, yj - 0.22, M[2] + dz], [tx, hy + 0.35, M[2] + dz], { s: 0.85, d: 0.9 });
  d.arc([tx, hy + 0.12, M[2]], X, Y, 0.24, Math.PI * 0.95, TAU * 1.08, { t: 2, s: 1.0, d: 1.1 });
  const beam = [tx, hy - 0.85, M[2]];
  for (const sx of [-1, 1]) d.line([tx, hy, M[2]], [tx + sx * 1.15, beam[1] + 0.2, M[2]], { s: 0.8, d: 0.6 });
  d.box(beam, [2.7, 0.34, 0.42], { t: 2, s: 1.05, d: 1.4 });
  // bina iskeleti (bomun altında): döşemeler ve kolonlar; en üst kat yalnızca kolon
  const sx0 = -3.6;
  const sx1 = 0.05;
  const sz0 = -1.35;
  const sz1 = 1.15;
  const fh = 1.08;
  for (let k = 0; k <= 3; k++) {
    const y = FLOOR + k * fh;
    d.poly([[sx0, y, sz0], [sx1, y, sz0], [sx1, y, sz1], [sx0, y, sz1]], { s: 1.0, d: k === 0 ? 0.9 : 1.3 }, true);
    if (k) d.line([sx0, y - 0.12, sz1], [sx1, y - 0.12, sz1], { s: 0.85, d: 0.6 });
  }
  const cols = [[sx0, sz1], [(sx0 + sx1) / 2, sz1], [sx1, sz1], [sx0, sz0], [sx1, sz0], [(sx0 + sx1) / 2, sz0]];
  cols.forEach(([x, z], i) => d.line([x, FLOOR, z], [x, FLOOR + (i % 3 === 1 ? 3 : 3.75) * fh, z], { s: 1.0, d: 1.2 }));
  // bitmiş binalar
  building(d, [1.7, FLOOR, 0.4], [2.2, 5.9, 1.8], { floors: 8, cols: 3 });
  building(d, [-5.15, FLOOR, -0.5], [1.85, 3.3, 1.6], { floors: 4, cols: 2, o: { t: 1 }, win: { t: 0 } });
  d.done(Nf);
  fitX(p, i0);
}

/** Otel bloğu: taban merkezi b, [w, h, dp]; her katta önde balkon (döşeme + mavi korkuluk), odaları ayıran dikmeler. */
function hotelBlock(d, b, [w, h, dp], floors) {
  d.box([b[0], b[1] + h / 2, b[2]], [w, h, dp], { s: 1.1, d: 1.8 });
  const zf = b[2] + dp / 2;
  const fh = h / floors;
  const xl = b[0] - w / 2;
  const xr = b[0] + w / 2;
  for (let i = 1; i < floors; i++) {
    const y = b[1] + i * fh;
    d.line([xl, y, zf + 0.35], [xr, y, zf + 0.35], { s: 0.9, d: 0.9 });
    d.line([xl, y + fh * 0.36, zf + 0.35], [xr, y + fh * 0.36, zf + 0.35], { t: 1, s: 0.85, d: 0.7 });
    for (const x of [xl, xr]) d.line([x, y, zf], [x, y, zf + 0.35], { s: 0.8, d: 0.4 });
  }
  const rooms = Math.max(2, Math.round(w / 0.8));
  for (let j = 1; j < rooms; j++) {
    const x = xl + (w * j) / rooms;
    d.line([x, b[1] + fh, zf], [x, b[1] + h, zf], { t: 1, s: 0.75, d: 0.35 });
  }
  d.rect([b[0], b[1] + fh * 0.5, zf + 0.01], X, Y, Math.min(1.3, w * 0.35), fh * 0.9, { s: 0.95, d: 0.9 });
}

/** Palmiye: taban b, boy h, tepenin yana kayması lean; gövde halkalı ve kavisli, tepede sarkık yapraklar (yaprakçıklarıyla), hindistancevizleri. */
function palm(d, b, h, lean, rot) {
  const C = [b[0] + lean, b[1] + h, b[2]];
  const trunk = bez(b, [b[0] + lean * 0.1, b[1] + h * 0.4, b[2]], [b[0] + lean * 0.65, b[1] + h * 0.8, b[2]], C);
  for (const sg of [-1, 1]) {
    d.curve((u) => {
      const q = trunk(u);
      const r = 0.3 - 0.13 * u;
      return [q[0] + sg * r, q[1], q[2]];
    }, { s: 1.05, d: 1.5 }, 60);
  }
  for (let i = 0; i < 14; i++) {
    const u = (i + 0.5) / 14;
    const q = trunk(u);
    const r = 0.3 - 0.13 * u;
    d.arc(q, X, Z, r, Math.PI * 0.05, Math.PI * 0.95, { s: 0.85, d: 0.55 });
  }
  const nF = 7;
  for (let k = 0; k < nF; k++) {
    const az = rot + (k / nF) * TAU;
    const dir = [Math.cos(az), 0, Math.sin(az) * 0.55];
    const L = 2.6 + (k % 2) * 0.4;
    const fr = (u) => [C[0] + dir[0] * L * u, C[1] + 0.75 * Math.sin(u * Math.PI * 0.85) - 1.9 * u * u, C[2] + dir[2] * L * u];
    d.curve(fr, { t: 3, s: 1.1, d: 1.7 }, 40);
    for (let j = 1; j < 9; j++) {
      const u = j / 9;
      const q = fr(u);
      const l = 0.55 * (1 - u * 0.6);
      const side = v3.norm([-dir[2], 0, dir[0]]);
      for (const sg of [-1, 1]) d.line(q, [q[0] + side[0] * sg * l * 0.6 + dir[0] * l * 0.4, q[1] - l * 0.7, q[2] + side[2] * sg * l * 0.6 + dir[2] * l * 0.4], { t: 3, s: 0.8, d: 0.45 });
    }
  }
  for (const [dx, dz] of [[-0.18, 0.12], [0.16, 0.1], [0, -0.15]]) ball(d, [C[0] + dx, C[1] - 0.32, C[2] + dz], 0.16, 3, { t: 0 });
}

/* ── Turizm, Ulaştırma ve Lojistik: sağda deniz kıyısında otel (yüksek blok ve alçak kanat, katlarda balkonlar), solda iki palmiye
      (yeşil yapraklar), arkada kırmızı güneş ve ışınları, önde mavi deniz dalgaları. */
export function otel(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  hotelBlock(d, [4.0, FLOOR, -1.3], [3.3, 7.2, 2.2], 9);
  hotelBlock(d, [1.4, FLOOR, -1.0], [1.9, 4.0, 2.0], 5);
  palm(d, [-1.35, FLOOR, 1.1], 5.0, -0.5, 0.3);
  palm(d, [-5.05, FLOOR, 0.35], 4.1, 0.55, 0.9);
  // güneş
  const SC = [-0.55, 3.15, -2.4];
  d.circle(SC, X, Y, 0.95, { t: 2, s: 1.15, d: 2.2 });
  d.scatter((r) => {
    const a = r() * TAU;
    const rr = Math.sqrt(r()) * 0.88;
    return [SC[0] + Math.cos(a) * rr, SC[1] + Math.sin(a) * rr, SC[2]];
  }, 2.2, { t: 2, s: 0.75, sv: 0.2, j: 0.01 });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU + 0.13;
    d.line([SC[0] + Math.cos(a) * 1.22, SC[1] + Math.sin(a) * 1.22, SC[2]], [SC[0] + Math.cos(a) * 1.65, SC[1] + Math.sin(a) * 1.65, SC[2]], { t: 2, s: 0.95, d: 1.0 });
  }
  // deniz dalgaları (önde)
  for (let i = 0; i < 3; i++) {
    const z = 1.75 + i * 0.38;
    const y = FLOOR + 0.18 - i * 0.07;
    d.curve((u) => [-6.0 + 12.0 * u, y + 0.14 * Math.sin(u * 28 + i * 1.9), z], { t: 1, s: 1.0 + i * 0.05, d: 1.5 }, 180);
  }
  d.done(Nf);
  fitX(p, i0);
}

/* ── Aile Şirketleri ve KOBİ'ler: solda üç kuşak — bastonlu büyük, ebeveyn ve çocuk (baş ve omuzlar); sağda iki katlı küçük işletme
      binası (düz çatı ve korkuluk, katlar arasında yeşil tabela, altta tenteli vitrin ve kapı, üstte pencereler). */
export function aile(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const g = bust(d, [-4.75, FLOOR, 0.5], 0.54, {});
  bust(d, [-2.45, FLOOR, 0.95], 0.64, {});
  bust(d, [-0.55, FLOOR, 1.55], 0.42, {});
  // baston (büyüğün solunda, gövdenin dışında): gövde ve kıvrık sap
  const cx = -4.75 - g.half - 0.3;
  d.line([cx, FLOOR, 1.2], [cx, FLOOR + 2.55, 1.2], { t: 1, s: 1.15, d: 1.8 });
  d.arc([cx + 0.3, FLOOR + 2.55, 1.2], X, Y, 0.3, 0, Math.PI, { t: 1, s: 1.15, d: 1.6 });
  // işletme binası
  const bx = 3.55;
  const bw = 4.2;
  const bh = 5.4;
  const bz = -0.9;
  const bd = 2.2;
  const zf = bz + bd / 2 + 0.01;
  d.box([bx, FLOOR + bh / 2, bz], [bw, bh, bd], { s: 1.1, d: 1.8 });
  d.box([bx, FLOOR + bh + 0.18, bz], [bw + 0.2, 0.36, bd + 0.2], { s: 0.9, d: 0.8 });
  const ym = FLOOR + 2.85;
  d.line([bx - bw / 2, ym, zf], [bx + bw / 2, ym, zf], { s: 0.95, d: 1.0 });
  d.rect([bx, ym + 0.42, zf + 0.02], X, Y, bw - 0.6, 0.62, { t: 3, s: 1.05, d: 1.4 });
  // altta vitrin, tente ve kapı
  d.rect([bx - 0.75, FLOOR + 1.2, zf], X, Y, 2.1, 1.8, { t: 1, s: 1.0, d: 1.1 });
  d.line([bx - 0.75, FLOOR + 0.3, zf], [bx - 0.75, FLOOR + 2.1, zf], { t: 1, s: 0.8, d: 0.5 });
  for (const z of [zf + 0.02, zf + 0.75]) d.line([bx - 1.9, FLOOR + (z > zf + 0.1 ? 2.05 : 2.45), z], [bx + 0.4, FLOOR + (z > zf + 0.1 ? 2.05 : 2.45), z], { t: 2, s: 1.0, d: 1.2 });
  for (let i = 0; i <= 6; i++) {
    const x = bx - 1.9 + (2.3 * i) / 6;
    d.line([x, FLOOR + 2.45, zf + 0.02], [x, FLOOR + 2.05, zf + 0.75], { t: 2, s: 0.85, d: 0.6 });
  }
  d.rect([bx + 1.35, FLOOR + 1.15, zf], X, Y, 0.95, 2.3, { s: 1.0, d: 1.1 });
  // üst kat pencereleri
  for (const x of [bx - 1.25, bx, bx + 1.25]) {
    d.rect([x, FLOOR + 4.2, zf], X, Y, 0.85, 1.1, { t: 1, s: 0.95, d: 0.9 });
    d.line([x, FLOOR + 3.65, zf], [x, FLOOR + 4.75, zf], { t: 1, s: 0.75, d: 0.35 });
  }
  d.done(Nf);
  fitX(p, i0);
}

/** El ele tutuşan kişi simgesi: x, z; boy h; renk t. Baş, omuzdan etek ucuna genişleyen gövde, iki bacak. Omuz ve el noktalarını döndürür. */
function figure(d, x, z, h, t) {
  const hr = 0.14 * h;
  const yHead = FLOOR + h - hr;
  ball(d, [x, yHead, z], hr, 6 * h, { t });
  const ySh = FLOOR + 0.72 * h;
  const yHem = FLOOR + 0.3 * h;
  const sw = 0.2 * h;
  const hw = 0.23 * h;
  for (const dz of [0.12 * h, -0.12 * h]) {
    d.poly([[x - sw, ySh, z + dz], [x + sw, ySh, z + dz], [x + hw, yHem, z + dz], [x - hw, yHem, z + dz]], { t, s: dz > 0 ? 1.1 : 0.85, d: dz > 0 ? 1.8 : 0.7 }, true);
  }
  for (const [px, py] of [[x - sw, ySh], [x + sw, ySh], [x + hw, yHem], [x - hw, yHem]]) d.line([px, py, z - 0.12 * h], [px, py, z + 0.12 * h], { t, s: 0.8, d: 0.4 });
  d.scatter((r) => {
    const v = r();
    const half = sw + (hw - sw) * v;
    return [x + (r() * 2 - 1) * half, ySh + (yHem - ySh) * v, z + (r() * 2 - 1) * 0.12 * h];
  }, 2.2 * h, { t, s: 0.75, sv: 0.2, j: 0.01 });
  for (const sg of [-1, 1]) d.line([x + sg * 0.09 * h, yHem, z], [x + sg * 0.1 * h, FLOOR, z], { t, s: 1.05, d: 1.5 });
  return { L: [x - sw, ySh - 0.03 * h, z], R: [x + sw, ySh - 0.03 * h, z] };
}

/* ── Kamu ve Sivil Toplum: sağda kubbeli kamu binası (basamaklı kaide, iki kanat ve pencereleri, dört sütunlu giriş, alınlık, kasnak üstünde
      kaburgalı kubbe ve fener); solda önde el ele tutuşan dört kişi (sivil toplum; mavi, yeşil, kırmızı, beyaz). */
export function kamu(p, rnd, Nf) {
  const i0 = p.n;
  const d = new Draw(p, rnd);
  const cx = 2.6;
  const zb = -2.0;
  const zf = 0.0;
  const zc = (zb + zf) / 2;
  // kaide ve üç basamak
  d.box([cx, FLOOR + 0.3, zc + 0.15], [6.8, 0.6, 2.5], { s: 1.05, d: 1.3 });
  for (let i = 0; i < 3; i++) d.box([cx, FLOOR + 0.1 + i * 0.2, zf + 0.85 - i * 0.22], [2.6 - i * 0.25, 0.2, 0.3], { s: 0.85, d: 0.55 });
  const yb = FLOOR + 0.6;
  // kanatlar
  for (const sx of [-1, 1]) {
    const wx = cx + sx * 2.45;
    d.box([wx, yb + 1.4, zc], [1.9, 2.8, zf - zb], { s: 1.1, d: 1.6 });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) d.rect([wx - 0.42 + c * 0.84, yb + 0.85 + r * 1.2, zf + 0.01], X, Y, 0.48, 0.75, { t: 1, s: 0.9, d: 0.7 });
  }
  // orta bölüm: dört sütun, saçak, alınlık
  const yt = yb + 3.0;
  for (let i = 0; i < 4; i++) cylinder(d, [cx - 1.2 + i * 0.8, yb, zf + 0.4], [cx - 1.2 + i * 0.8, yt, zf + 0.4], 0.18, 8, { s: 0.95, d: 0.8 });
  d.box([cx, yt + 0.2, zc + 0.2], [3.1, 0.4, zf - zb + 0.4], { s: 1.05, d: 1.3 });
  d.box([cx, yb + 1.5, zc - 0.3], [3.0, 3.0, zf - zb - 0.6], { s: 0.85, d: 0.6 });
  d.poly([[cx - 1.55, yt + 0.4, zf + 0.4], [cx, yt + 1.35, zf + 0.4], [cx + 1.55, yt + 0.4, zf + 0.4]], { s: 1.15, d: 2.0 }, true);
  d.poly([[cx - 1.1, yt + 0.55, zf + 0.42], [cx, yt + 1.15, zf + 0.42], [cx + 1.1, yt + 0.55, zf + 0.42]], { t: 1, s: 0.85, d: 0.6 }, true);
  // kasnak ve kubbe
  const dc = [cx, yt + 0.4, zc - 0.25];
  const Rd = 1.25;
  cylinder(d, dc, [dc[0], dc[1] + 0.75, dc[2]], Rd, 16, { s: 0.9, d: 0.7 });
  const dome = [dc[0], dc[1] + 0.75, dc[2]];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    d.arc(dome, [Math.cos(a), 0, Math.sin(a)], Y, Rd, 0, Math.PI / 2, { t: 1, s: 0.9, d: 0.8 });
  }
  d.arc(dome, X, Y, Rd, 0, Math.PI, { s: 1.15, d: 2.0 });
  for (const f of [0.35, 0.7]) d.circle([dome[0], dome[1] + Rd * Math.sin(f * 1.2), dome[2]], X, Z, Rd * Math.cos(f * 1.2), { s: 0.85, d: 0.6 });
  cylinder(d, [dome[0], dome[1] + Rd, dome[2]], [dome[0], dome[1] + Rd + 0.45, dome[2]], 0.2, 6, {});
  ball(d, [dome[0], dome[1] + Rd + 0.62, dome[2]], 0.17, 4);
  // el ele tutuşan dört kişi
  const H = 3.3;
  const xs = [-5.6, -4.25, -2.9, -1.55];
  const zs = [1.45, 1.75, 1.75, 1.45];
  const ts = [1, 3, 2, 0];
  const pts = xs.map((x, i) => figure(d, x, zs[i], H, ts[i]));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i].R;
    const b = pts[i + 1].L;
    const hand = [(a[0] + b[0]) / 2, FLOOR + 0.48 * H, (a[2] + b[2]) / 2];
    d.line(a, hand, { t: ts[i], s: 1.05, d: 1.4 });
    d.line(b, hand, { t: ts[i + 1], s: 1.05, d: 1.4 });
    d.node(hand, 0.1, 6, { t: 0 });
  }
  for (const [q, sg, t] of [[pts[0].L, -1, ts[0]], [pts[3].R, 1, ts[3]]]) d.line(q, [q[0] + sg * 0.3 * H * 0.5, FLOOR + 0.4 * H, q[2]], { t, s: 1.05, d: 1.3 });
  d.done(Nf);
  fitX(p, i0);
}
