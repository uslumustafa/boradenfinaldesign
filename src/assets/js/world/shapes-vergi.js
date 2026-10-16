// Vergi Denetim ve Danışmanlık hizmetlerinin şekilleri (Ekim 2026, müşteri geri bildirimi: «buradaki 3B şekiller çok mantıksız; buraya
// uygun, daha belirgin, net görünen şekiller»). Önceki soyut çizelgeler (KDV zinciri basamakları, dilim çubukları, pasta dilimi, bilanço
// rafları, para gibi okunan mühür halkası) yerine her hizmete herkesin bir bakışta tanıdığı TEK bir nesne:
//   tasdik     — Tam Tasdik ve YMM: «TASDİK» başlıklı rapor, kırmızı mühür izi ve yeşil onay; yanında saplı kaşe
//   kdv-iade   — KDV İade: dik duran ₺ madeni para ve çevresinde geri dönen yeşil ok
//   kurumlar   — Kurumlar Vergisi Denetimi ve Tasdiki: şirket binası ve önünde onaylı büyüteç
//   transfer   — Transfer Fiyatlandırması: iki grup şirketi (merkez ve ilişkili şirket), aralarında iki yönlü ok ve ₺ fiyat etiketi
//   dolayli    — Dolaylı Vergiler: alışveriş arabası (içinde ürünler), önünde % etiketi — vergi fiyatın içinde
//   otv        — ÖTV: otomobil ve «ÖTV» levhalı akaryakıt pompası (tabancası aracın deposunda)
//   bireysel   — Bireysel Vergi Danışmanlığı: kişi, evi (varlık) ve önünde madeni para yığını (gelir)
// Okunurluk ilkeleri: dış hatlar yoğun ve iri noktalı (d, s yüksek), iç ayrıntı seyrek; nesneler kameraya dönük durur (salınım, tam tur
// yok); küçük yazı yok (yalnızca birkaç iri harf/simge); renkler parçaları ayırır (lacivert gövde, mavi ayrıntı, kırmızı vergi/fiyat,
// yeşil onay/iade). Saf hesaplama; yerleşim x ∈ [−6,2, 6,2], y ∈ [−4,0, 4,2], z ∈ [−2,5, 2,6] (tests/formations.test.mjs sınırları).
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
const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

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

/** Madeni para: c merkez, ax yüz normali, r yarıçap, th kalınlık — iki yüz, iç halka, kenar tırtılları. Ön yüzün merkezini döndürür. */
function coin(d, c, ax, r, th, o = {}, ridges = 36) {
  const [a, u, w] = basis(ax);
  const f0 = v3.add(c, v3.mul(a, -th / 2));
  const f1 = v3.add(c, v3.mul(a, th / 2));
  d.circle(f1, u, w, r, { s: 1.1, d: 1.8, ...o });
  d.circle(f0, u, w, r, { s: 0.95, d: 1.1, ...o });
  d.circle(f1, u, w, r * 0.8, { s: 0.85, d: 0.7, ...o });
  for (let k = 0; k < ridges; k++) {
    const t = (k / ridges) * TAU;
    const off = v3.add(v3.mul(u, Math.cos(t) * r), v3.mul(w, Math.sin(t) * r));
    d.line(v3.add(f0, off), v3.add(f1, off), { s: 0.8, d: 0.5, ...o });
  }
  return f1;
}

/** Dolu görünen küre: yüzeyde noktalar (derinliğe göre koyulaşır → hacim) + kameraya dönük çevre çizgisi ve bir paralel. */
function ball(d, c, r, w = 30, o = {}) {
  const [rx, ry, rz] = typeof r === 'number' ? [r, r, r] : r;
  d.shell(c, [rx, ry, rz], w, { s: 0.85, sv: 0.3, j: 0.015, ...o });
  d.curve((u) => [c[0] + rx * Math.cos(u * TAU), c[1] + ry * Math.sin(u * TAU), c[2]], { s: 1.1, d: 1.9, ...o }, 120);
  d.curve((u) => [c[0] + rx * Math.cos(u * TAU), c[1] - ry * 0.25, c[2] + rz * Math.sin(u * TAU)], { s: 0.85, d: 0.5, ...o }, 120);
}

/** Kalın eğri (bant): orta çizgi + düzlem içinde iki yan çizgi + biraz geride derinlik çizgisi. fn: u → nokta (xy düzlemi). */
function band(d, fn, w = 0.2, o = {}) {
  const nrm = (u) => {
    const a = fn(Math.max(0, u - 0.002));
    const b = fn(Math.min(1, u + 0.002));
    const t = v3.norm(v3.sub(b, a));
    return [-t[1], t[0], 0];
  };
  d.curve(fn, { s: 1.15, d: 2.2, ...o });
  for (const sg of [-1, 1]) d.curve((u) => v3.add(fn(u), v3.mul(nrm(u), sg * w)), { s: 0.95, d: 1.0, ...o });
  d.curve((u) => v3.add(fn(u), [0, 0, -0.28]), { s: 0.85, d: 0.6, ...o });
}

/** Ok ucu (dolu üçgen): tip noktasında, dir yönünde, düzlem normali nz; taban yarı genişliği half, boy len. */
function arrowTip(d, tip, dir, { len = 1.0, half = 0.7, nz = Z, o = {} } = {}) {
  const b = v3.norm(dir);
  const sd = v3.norm(cross(nz, b));
  const base = v3.sub(tip, v3.mul(b, len));
  const L = v3.add(base, v3.mul(sd, half));
  const R = v3.sub(base, v3.mul(sd, half));
  d.poly([L, tip, R], { s: 1.15, d: 2.0, ...o }, true);
  for (const f of [0.3, 0.55, 0.78]) d.line(v3.mix(L, tip, f), v3.mix(R, tip, f), { s: 0.95, d: 0.9, ...o });
  d.poly([L, tip, R].map((q) => v3.add(q, v3.mul(nz, -0.28))), { s: 0.85, d: 0.6, ...o }, true);
}

/** Fiyat etiketi: c merkez, u uzun eksen (sivri uç −u yönünde), v kısa eksen; w × h; delik ve arkada ikinci kenar (kalınlık). */
function priceTag(d, c, u, v, w, h, o = {}) {
  const n = v3.norm(cross(u, v));
  const P = (a, b, k = 0) => [c[0] + u[0] * a + v[0] * b + n[0] * k, c[1] + u[1] * a + v[1] * b + n[1] * k, c[2] + u[2] * a + v[2] * b + n[2] * k];
  const outline = (k) => [P(-w / 2, 0, k), P(-w / 2 + h * 0.55, h / 2, k), P(w / 2, h / 2, k), P(w / 2, -h / 2, k), P(-w / 2 + h * 0.55, -h / 2, k)];
  d.poly(outline(0), { s: 1.15, d: 2.2, ...o }, true);
  d.poly(outline(-0.22), { s: 0.85, d: 0.7, ...o }, true);
  d.circle(P(-w / 2 + h * 0.42, 0), u, v, h * 0.12, { s: 0.95, d: 0.8, ...o });
  return P(-w / 2 + h * 0.42, 0); // delik
}

/** Ofis binası: taban merkezi b, boyut [w, h, dp]; ön yüzde kat çizgileri ve pencere dikmeleri (giydirme cephe), sağ yüzde kat çizgileri. */
function building(d, b, [w, h, dp], { floors = 8, cols = 4, o = {}, win = {} } = {}) {
  d.box([b[0], b[1] + h / 2, b[2]], [w, h, dp], { s: 1.1, d: 1.9, ...o });
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
    d.line([x, b[1] + fh, zf], [x, b[1] + h, zf], wo);
  }
  // giriş
  d.rect([b[0], b[1] + fh * 0.5, zf + 0.01], X, Y, Math.min(1.2, w * 0.32), fh * 0.95, { s: 0.95, d: 0.9, ...o });
}

/* ── Tam Tasdik ve Yeminli Mali Müşavirlik: «TASDİK» başlıklı rapor (dik yaprak, kıvrık köşe), metin satırları, imza; sağ altta kırmızı
      mühür izi ve içinde yeşil onay. Solunda saplı kaşe: topuz, boyun, taban ve kırmızı lastik. Uzun parça (rapor) sağda: kahramanda
      soldaki sayfa yolu ve başlık sütunuyla çakışmaz. */
export function tasdik(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const C = [2.05, 0.05, -0.8];
  const W = 5.4;
  const H = 7.4;
  const F = 0.9;
  const at = (a, b, z = 0) => [C[0] + a, C[1] + b, C[2] + z];
  d.poly([at(-W / 2, -H / 2), at(W / 2, -H / 2), at(W / 2, H / 2 - F), at(W / 2 - F, H / 2), at(-W / 2, H / 2)], { s: 1.15, d: 2.4 }, true);
  d.poly([at(W / 2 - F, H / 2), at(W / 2 - F, H / 2 - F), at(W / 2, H / 2 - F)], { s: 0.95, d: 1.0 });
  // arkada ikinci yaprak (kalınlık)
  d.poly([at(-W / 2 + 0.3, H / 2, -0.35), at(-W / 2 + 0.3, H / 2 + 0.25, -0.35), at(W / 2 - F + 0.25, H / 2 + 0.25, -0.35)], { s: 0.8, d: 0.6 });
  d.text('TASDİK', at(0, H / 2 - 1.55), X, Y, 0.7, { align: 'center', t: 1, s: 1.2, d: 2.6 });
  d.line(at(-2.05, H / 2 - 1.95), at(2.05, H / 2 - 1.95), { t: 1, s: 0.9, d: 0.9 });
  for (let i = 0; i < 5; i++) {
    const y = 1.25 - i * 0.62;
    d.line(at(-2.1, y), at(i === 4 ? 0.2 : 2.1 - rnd() * 0.35, y), { s: 0.78, d: 0.5 });
  }
  d.curve((u) => at(-2.2 + u * 1.85, -2.55 + Math.sin(u * 9.5) * 0.2 + u * 0.25, 0.02), { s: 1.0, d: 1.4 }, 90);
  d.line(at(-2.3, -2.98), at(-0.25, -2.98), { s: 0.8, d: 0.6 });
  // mühür izi + onay
  const S = at(1.3, -2.2, 0.04);
  d.circle(S, X, Y, 1.12, { t: 2, s: 1.1, d: 2.0 });
  d.circle(S, X, Y, 0.86, { t: 2, s: 0.9, d: 1.0 });
  for (const off of [0, 0.07]) d.poly([[-0.48, 0.02], [-0.1, -0.38], [0.52, 0.44]].map(([x, y]) => [S[0] + x, S[1] + y + off, S[2] + 0.02]), { t: 3, s: 1.2, d: 1.8 });
  // kaşe
  const K = [-3.25, FLOOR, 1.3];
  const up = (y) => [K[0], K[1] + y, K[2]];
  cylinder(d, up(0), up(0.42), 1.38, 16, { t: 2 });
  cylinder(d, up(0.42), up(0.92), 1.5, 16, {});
  frustum(d, up(0.92), up(2.55), 0.78, 0.44, 10, {});
  ball(d, up(3.38), [1.02, 0.9, 1.02], 26);
  d.done(Nf);
}

/* ── KDV İade İşlemleri: dik duran ₺ madeni para; çevresinde saat yönünün tersine dönen yeşil ok (iade); altta «KDV». */
export function kdvIade(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const C = [0, 0.35, 0];
  const f = coin(d, C, Z, 2.2, 0.6, {}, 44);
  d.text('₺', [C[0] - 0.02, C[1] - 0.9, f[2] + 0.02], X, Y, 1.8, { align: 'center', t: 1, s: 1.2, d: 2.8 });
  const Ra = 3.35;
  const a0 = (80 * Math.PI) / 180;
  const a1 = a0 + (318 * Math.PI) / 180;
  const ring = (u) => {
    const a = a0 + (a1 - a0) * u;
    return [C[0] + Math.cos(a) * Ra, C[1] + Math.sin(a) * Ra, 0];
  };
  band(d, ring, 0.2, { t: 3 });
  const tip = [C[0] + Math.cos(a1 + 0.22) * Ra, C[1] + Math.sin(a1 + 0.22) * Ra, 0];
  arrowTip(d, tip, [-Math.sin(a1 + 0.11), Math.cos(a1 + 0.11), 0], { len: 1.05, half: 0.78, o: { t: 3 } });
  d.text('KDV', [C[0], C[1] - Ra - 1.0, 0], X, Y, 0.62, { align: 'center', t: 1, s: 1.15, d: 2.2 });
  d.done(Nf);
}

/* ── Kurumlar Vergisi Denetimi ve Tasdiki: sağda şirket binası (giydirme cephe, giriş, çatı katı); solda önde büyüteç, merceğinde yeşil onay. */
export function kurumlar(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const B = [2.3, FLOOR, -0.9];
  const BH = 7.2;
  building(d, B, [4.2, BH, 3.0], { floors: 9, cols: 5 });
  d.box([B[0] - 0.7, FLOOR + BH + 0.32, B[2]], [1.6, 0.64, 1.4], { s: 0.9, d: 0.7 });
  d.line([B[0] + 1.1, FLOOR + BH, B[2]], [B[0] + 1.1, FLOOR + BH + 0.75, B[2]], { s: 0.95, d: 0.8 });
  const L = [-2.45, 0.15, 1.9];
  const R = 1.95;
  d.circle(L, X, Y, R, { s: 1.2, d: 2.6 });
  d.circle([L[0], L[1], L[2] - 0.26], X, Y, R, { s: 0.9, d: 1.0 });
  d.circle(L, X, Y, R * 0.84, { t: 1, s: 0.8, d: 0.55 });
  const ha = -0.95;
  const h0 = [L[0] + Math.cos(ha) * (R + 0.05), L[1] + Math.sin(ha) * (R + 0.05), L[2] - 0.13];
  const h1 = [L[0] + Math.cos(ha) * (R + 2.25), L[1] + Math.sin(ha) * (R + 2.25), L[2] - 0.13];
  cylinder(d, h0, h1, 0.3, 10, { t: 1 });
  for (const off of [0, 0.08]) d.poly([[-0.95, 0.05], [-0.28, -0.68], [1.0, 0.82]].map(([x, y]) => [L[0] + x, L[1] + y + off, L[2] + 0.02]), { t: 3, s: 1.25, d: 2.2 });
  d.done(Nf);
}

/* ── Transfer Fiyatlandırması: iki grup şirketi (sağda uzun merkez, solda ilişkili şirket); üstte soldan sağa mavi, altta sağdan sola
      yeşil ok; ortada kırmızı fiyat etiketi ve ₺ — ilişkili taraflar arasındaki işlemin fiyatı. */
export function transfer(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  building(d, [-4.0, FLOOR, -0.2], [2.6, 4.6, 2.4], { floors: 5, cols: 3, o: { t: 1 }, win: { t: 0 } });
  building(d, [4.0, FLOOR, -0.2], [2.6, 6.8, 2.4], { floors: 8, cols: 3 });
  const top = bez([-2.55, 1.0, 0.3], [-1.3, 3.7, 0.3], [1.2, 4.1, 0.3], [2.6, 2.55, 0.3]);
  band(d, (u) => top(u * 0.9), 0.17, { t: 1 });
  arrowTip(d, top(1), v3.sub(top(1), top(0.9)), { len: 0.95, half: 0.62, o: { t: 1 } });
  const bot = bez([2.55, -2.2, 0.3], [1.3, -4.05, 0.3], [-1.3, -4.05, 0.3], [-2.6, -2.55, 0.3]);
  band(d, (u) => bot(u * 0.9), 0.17, { t: 3 });
  arrowTip(d, bot(1), v3.sub(bot(1), bot(0.9)), { len: 0.95, half: 0.62, o: { t: 3 } });
  priceTag(d, [0.1, -0.35, 0.8], X, Y, 3.1, 1.75, { t: 2 });
  d.text('₺', [0.55, -0.98, 0.82], X, Y, 1.25, { align: 'center', t: 2, s: 1.15, d: 2.2 });
  d.done(Nf);
}

/* ── Dolaylı Vergiler: alışveriş arabası — tel sepet, itme kolu, şasi, tekerlekler; sepette iki ürün kutusu; ön köşeden sarkan
      kırmızı % etiketi (vergi fiyatın içinde). */
export function dolayli(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const zs = [-1.55, 1.55];
  const BT = [-3.1, 1.15];
  const FT = [3.3, 1.15];
  const FB = [2.4, -1.45];
  const BB = [-2.75, -1.45];
  const P = (q, z) => [q[0], q[1], z];
  for (const z of zs) d.poly([P(BT, z), P(FT, z), P(FB, z), P(BB, z)], { s: 1.1, d: 2.0 }, true);
  for (const q of [BT, FT, FB, BB]) d.line(P(q, zs[0]), P(q, zs[1]), { s: 1.05, d: 1.5 });
  const wire = { s: 0.75, d: 0.42 };
  for (let i = 1; i < 10; i++) {
    const u = i / 10;
    for (const z of zs) d.line(P(lerp2(BT, FT, u), z), P(lerp2(BB, FB, u), z), wire);
    d.line(P(lerp2(BB, FB, u), zs[0]), P(lerp2(BB, FB, u), zs[1]), { ...wire, d: 0.32 });
  }
  for (const z of zs) d.line(P(lerp2(BT, BB, 0.5), z), P(lerp2(FT, FB, 0.5), z), wire);
  for (let i = 1; i < 5; i++) d.line(P(lerp2(FT, FB, i / 5), zs[0]), P(lerp2(FT, FB, i / 5), zs[1]), wire);
  for (let i = 1; i < 6; i++) d.line(P(lerp2(BT, BB, i / 6), zs[0]), P(lerp2(BT, BB, i / 6), zs[1]), { ...wire, d: 0.3 });
  // itme kolu ve tutamak
  const H1 = [-4.0, 2.45];
  for (const z of zs) d.line(P(BT, z), P(H1, z), { s: 1.05, d: 1.4 });
  d.line([H1[0], H1[1], -1.85], [H1[0], H1[1], 1.85], { t: 1, s: 1.25, d: 2.6 });
  d.line([H1[0], H1[1] + 0.12, -1.6], [H1[0], H1[1] + 0.12, 1.6], { t: 1, s: 0.95, d: 0.9 });
  // şasi ve tekerlekler
  const yb = -3.3;
  for (const z of zs) {
    d.line([BB[0], BB[1], z], [-2.95, yb, z], { s: 1.0, d: 1.2 });
    d.line([FB[0], FB[1], z], [2.15, yb, z], { s: 1.0, d: 1.2 });
    d.line([-2.95, yb, z], [2.15, yb, z], { s: 1.0, d: 1.2 });
  }
  d.line([-2.95, yb, zs[0]], [-2.95, yb, zs[1]], { s: 0.95, d: 0.9 });
  d.line([2.15, yb, zs[0]], [2.15, yb, zs[1]], { s: 0.95, d: 0.9 });
  for (const x of [-2.95, 2.15]) {
    for (const z of [zs[0] + 0.1, zs[1] - 0.1]) {
      d.circle([x, -3.55, z], X, Y, 0.42, { s: 1.05, d: 1.3 });
      d.circle([x, -3.55, z], X, Y, 0.14, { s: 0.9, d: 0.5 });
    }
  }
  // ürünler
  d.box([-1.45, 1.35, -0.25], [2.3, 2.3, 2.1], { t: 1, s: 0.95, d: 1.0 }, { front: 2 });
  d.box([1.1, 0.75, 0.25], [1.9, 1.5, 1.7], { t: 3, s: 0.95, d: 1.0 });
  // % etiketi
  const hole = priceTag(d, [4.45, -0.55, 1.65], [0, -1, 0], X, 2.5, 1.6, { t: 2 });
  d.line([FT[0], FT[1], zs[1]], hole, { t: 2, s: 0.85, d: 0.7 });
  d.text('%', [4.45, -1.32, 1.67], X, Y, 0.92, { align: 'center', t: 2, s: 1.15, d: 2.2 });
  d.done(Nf);
}

/* ── ÖTV Hizmetleri: otomobil (yan profil iki yanda, aralarında enine çizgiler; camlar, kapı, tekerlekler, far) ve sağda «ÖTV» levhalı
      akaryakıt pompası (ekran, tabanca yuvası); hortum pompadan aracın deposuna uzanır. */
export function otv(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const zs = [-1.5, 1.5];
  const sx = -0.3; // aracın yatay kayması
  const kx = 0.9; // aracın boyu (yan profil x ölçeği)
  const top = [[-5.6, -3.05], [-5.75, -2.35], [-5.3, -1.95], [-3.1, -1.7], [-2.0, -0.5], [0.5, -0.5], [1.6, -1.6], [2.3, -1.75], [2.45, -2.45], [2.3, -3.05]];
  const arch = (cx, from, to) => Array.from({ length: 13 }, (_, k) => {
    const a = from + ((to - from) * k) / 12;
    return [cx + Math.cos(a) * 1.05, -3.15 + Math.sin(a) * 1.05];
  });
  const bottom = [[1.95, -3.05], ...arch(0.9, -0.1, Math.PI + 0.1), [-2.85, -3.05], ...arch(-3.9, -0.1, Math.PI + 0.1)];
  const X0 = -1.65; // ölçek merkezi (aracın ortası)
  const cx = (x) => X0 + (x - X0) * kx + sx;
  const prof = [...top, ...bottom].map(([x, y]) => [cx(x), y]);
  const P = (q, z) => [q[0], q[1], z];
  for (const z of zs) d.poly(prof.map((q) => P(q, z)), { s: 1.1, d: 2.0 }, true);
  for (const q of top) d.line(P([cx(q[0]), q[1]], zs[0]), P([cx(q[0]), q[1]], zs[1]), { s: 0.95, d: 1.0 });
  const win = [[-2.85, -1.72], [-1.9, -0.7], [0.35, -0.7], [1.3, -1.62]].map(([x, y]) => [cx(x), y]);
  for (const z of zs) {
    d.poly(win.map((q) => P(q, z)), { t: 1, s: 0.95, d: 1.2 }, true);
    d.line(P([cx(-0.75), -0.7], z), P([cx(-0.75), -2.95], z), { s: 0.85, d: 0.7 });
    d.line(P([cx(-0.3), -2.0], z), P([cx(0.15), -2.0], z), { s: 0.9, d: 0.6 });
    d.poly([[-5.62, -2.25], [-5.22, -2.05], [-5.0, -2.35], [-5.55, -2.5]].map(([x, y]) => P([cx(x), y], z)), { t: 1, s: 0.95, d: 0.8 }, true);
  }
  for (const wx of [cx(-3.9), cx(0.9)]) {
    for (const z of [zs[0] - 0.05, zs[1] + 0.05]) {
      d.circle([wx, -3.15, z], X, Y, 0.85, { s: 1.1, d: 1.6 });
      d.circle([wx, -3.15, z], X, Y, 0.42, { t: 1, s: 0.95, d: 0.8 });
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.3;
        d.line([wx + Math.cos(a) * 0.12, -3.15 + Math.sin(a) * 0.12, z], [wx + Math.cos(a) * 0.42, -3.15 + Math.sin(a) * 0.42, z], { t: 1, s: 0.8, d: 0.35 });
      }
    }
  }
  // pompa
  const px = 4.1;
  const pz = -0.4;
  d.box([px, -1.15, pz], [2.1, 5.7, 1.5], { s: 1.1, d: 1.9 });
  d.box([px, 2.45, pz], [2.5, 1.3, 1.7], { t: 2, s: 1.1, d: 1.7 });
  d.text('ÖTV', [px, 2.0, pz + 0.87], X, Y, 0.72, { align: 'center', t: 2, s: 1.2, d: 2.4 });
  d.rect([px, 0.65, pz + 0.76], X, Y, 1.45, 1.15, { t: 1, s: 0.95, d: 1.0 });
  for (const y of [0.85, 0.45]) d.line([px - 0.5, y, pz + 0.77], [px + 0.5, y, pz + 0.77], { t: 1, s: 0.85, d: 0.5 });
  d.box([px - 1.25, -0.75, pz + 0.2], [0.4, 0.9, 0.6], { s: 0.9, d: 0.6 });
  const fuel = cx(1.7); // depo kapağı (arka çamurluk)
  d.curve(bez([px - 1.3, -1.2, pz + 0.3], [px - 1.6, -4.4, 0.6], [fuel + 0.6, -3.6, 1.4], [fuel, -2.1, 1.62]), { t: 1, s: 0.95, d: 1.1 }, 80);
  cylinder(d, [fuel + 0.2, -2.05, 1.62], [fuel + 0.85, -2.25, 1.62], 0.14, 6, { t: 1 });
  d.done(Nf);
}

/* ── Bireysel Vergi Danışmanlığı: kişi (baş ve omuzlar), sağda evi (varlık: duvarlar, kırmızı beşik çatı, kapı, pencere, baca),
      aralarında önde yeşil madeni para yığını (gelir). */
export function bireysel(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const PX = -2.75;
  const DZ = 0.6; // gövdenin derinlik çarpanı (önden geniş, yandan ince)
  ball(d, [PX, 1.9, 0.1], 1.1, 34);
  cylinder(d, [PX, 0.5, 0.05], [PX, 0.85, 0.05], 0.44, 8, { s: 0.9, d: 0.45 });
  const torso = (s) => {
    if (s < 0.5) return [2.0 + 0.15 * (s / 0.5), -3.6 + (s / 0.5) * 2.85];
    const ph = ((s - 0.5) / 0.5) * (Math.PI / 2);
    return [0.5 + (2.15 - 0.5) * Math.cos(ph), -0.75 + 1.25 * Math.sin(ph)];
  };
  const surf = (s, ph, k = 0) => {
    const [r, y] = torso(s);
    return [PX + (r + k) * Math.cos(ph), y, (r + k) * Math.sin(ph) * DZ];
  };
  // yüzeyde noktalar (yarıçapa orantılı: dar boyunda seyrek, geniş gövdede sık)
  d.scatter((r) => {
    let q;
    for (let i = 0; i < 8; i++) {
      q = r();
      if (r() * 2.2 < torso(q)[0]) break;
    }
    return surf(q, r() * TAU);
  }, 120, { s: 0.85, sv: 0.3, j: 0.015 });
  // dış hat: iki yandaki meridyenler, alt kenar ve omuz çizgisi
  for (const ph of [0, Math.PI]) d.curve((u) => surf(u, ph), { s: 1.1, d: 2.0 }, 90);
  d.curve((u) => surf(0, u * TAU), { s: 1.1, d: 1.6 }, 120);
  d.curve((u) => surf(0.64, u * TAU), { s: 0.85, d: 0.55 }, 120);
  // yaka (V) ve kravat — gövdenin ön yüzünde
  const front = (s, dx = 0, k = 0.06) => {
    const [r, y] = torso(s);
    return [PX + dx, y, Math.sqrt(Math.max(0, r * r - dx * dx)) * DZ + k];
  };
  for (const sg of [-1, 1]) d.curve((u) => front(0.97 - u * 0.4, sg * (0.46 - u * 0.46)), { s: 1.05, d: 1.5 }, 40);
  const tie = [[0.9, -0.15], [0.9, 0.15], [0.84, 0.12], [0.62, 0.26], [0.36, 0.0], [0.62, -0.26], [0.84, -0.12]];
  d.poly(tie.map(([s0, dx]) => front(s0, dx, 0.1)), { t: 2, s: 1.15, d: 2.0 }, true);
  d.line(front(0.84, 0, 0.1), front(0.38, 0, 0.1), { t: 2, s: 0.95, d: 0.8 });
  // ev
  const hx = 3.0;
  const hz = -0.3;
  const [bw, bh, bd] = [3.8, 3.2, 3.2];
  const yt = FLOOR + bh;
  d.box([hx, FLOOR + bh / 2, hz], [bw, bh, bd], { t: 1, s: 1.1, d: 1.8 });
  const ov = 0.3;
  const apex = yt + 2.1;
  for (const z of [hz - bd / 2 - 0.1, hz + bd / 2 + 0.1]) d.poly([[hx - bw / 2 - ov, yt - 0.2, z], [hx, apex, z], [hx + bw / 2 + ov, yt - 0.2, z]], { t: 2, s: 1.15, d: 2.0 });
  d.line([hx, apex, hz - bd / 2 - 0.1], [hx, apex, hz + bd / 2 + 0.1], { t: 2, s: 1.1, d: 1.6 });
  for (const sg of [-1, 1]) {
    const e = [hx + sg * (bw / 2 + ov), yt - 0.2];
    d.line([e[0], e[1], hz - bd / 2 - 0.1], [e[0], e[1], hz + bd / 2 + 0.1], { t: 2, s: 1.0, d: 1.1 });
    for (const f of [0.33, 0.66]) {
      const q = [hx + (e[0] - hx) * f, apex + (e[1] - apex) * f];
      d.line([q[0], q[1], hz - bd / 2 - 0.1], [q[0], q[1], hz + bd / 2 + 0.1], { t: 2, s: 0.8, d: 0.45 });
    }
  }
  const zf = hz + bd / 2 + 0.01;
  d.rect([hx - 0.75, FLOOR + 0.8, zf], X, Y, 0.95, 1.6, { s: 1.0, d: 1.0 });
  d.rect([hx + 0.85, FLOOR + 2.0, zf], X, Y, 1.0, 0.9, { s: 0.95, d: 0.9 });
  d.line([hx + 0.85, FLOOR + 1.55, zf], [hx + 0.85, FLOOR + 2.45, zf], { s: 0.8, d: 0.5 });
  d.line([hx + 0.35, FLOOR + 2.0, zf], [hx + 1.35, FLOOR + 2.0, zf], { s: 0.8, d: 0.5 });
  d.box([hx + 1.0, apex - 0.55, hz - 0.6], [0.5, 1.2, 0.5], { t: 2, s: 0.95, d: 0.8 });
  // madeni para yığını
  for (let i = 0; i < 4; i++) coin(d, [0.15 + (i % 2 ? 0.06 : -0.04), FLOOR + 0.13 + i * 0.27, 1.55], Y, 0.82, 0.24, { t: 3 }, 18);
  d.done(Nf);
}
