// Hukuk ve Teşvik hizmetlerine özel formasyonlar (Ekim 2026). Müşteri isteği: «Hukuk da tasarımları yap»; Teşvik'te konuya uymayan
// şekiller (istihdam teşvikinde denetim dosyası, Ar-Ge'de genel süreç akışı…) hizmetin kendi kapsamından türeyen şekillerle değişti.
// Her şekil content.json › services kaydının kapsam ve süreç sözcüklerinden gelir: sözleşme maddeleri ve imzalar; sicil gazetesi ve tescil
// mührü; arabuluculuk masası (4857 ve 5510 sayılı kanunlar); ihbarnameden uzlaşma ya da dava yolu; veri envanteri ve kalkan (6698);
// vadesi geçen fatura → ihtar → arabuluculuk → icra; şirket kuruluşu (vinç «A.Ş.» bloğunu yerine indirir); teşvik belgesi ve fabrika;
// iş planı (iş paketleri, takvim); Ar-Ge ampulü ve dişli; AB yıldızları ve avro; istihdam (koltuklar ve prim desteği); ihracat (dünya, rota,
// konteyner). Saf hesaplama; yerleşim x ∈ [−6,5, 6,5], y ∈ [−4,1, 5,2], z ∈ [−3,5, 4,5] (tests/formations.test.mjs sınırları).
import { Draw, X, Y, Z, TAU, v3 } from './draw.js';

const FLOOR = -4.0;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Kübik Bézier: u ∈ [0,1] → nokta. */
const bez = (a, b, c, e) => (u) => {
  const k = 1 - u;
  return [0, 1, 2].map((i) => k * k * k * a[i] + 3 * k * k * u * b[i] + 3 * k * u * u * c[i] + u * u * u * e[i]);
};

/** Noktaları x ekseni çevresinde eğerek yazan sarmalayıcı (py, pz ekseninde a radyan): yatay yüzeyler (masa) kameraya döner. */
const tiltX = (p, a, py = 0, pz = 0) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { add: (x, y, z, sz, t) => p.add(x, py + (y - py) * c - (z - pz) * s, pz + (y - py) * s + (z - pz) * c, sz, t) };
};

/** a → b ekseninde silindir: n doğrultu çizgisi + iki uç çemberi. */
function cylinder(d, a, b, r, n = 10, o = {}) {
  const ax = v3.norm(v3.sub(b, a));
  const ref = Math.abs(ax[1]) < 0.9 ? Y : X;
  const u = v3.norm(cross(ax, ref));
  const w = cross(ax, u);
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU;
    const off = v3.add(v3.mul(u, Math.cos(t) * r), v3.mul(w, Math.sin(t) * r));
    d.line(v3.add(a, off), v3.add(b, off), { s: 0.85, d: 0.55, ...o });
  }
  d.circle(a, u, w, r, { s: 0.95, d: 1.1, ...o });
  d.circle(b, u, w, r, { s: 0.95, d: 1.1, ...o });
}

/** base çemberinden tip noktasına koni (kalem ucu). */
function cone(d, base, tip, r, n = 8, o = {}) {
  const ax = v3.norm(v3.sub(tip, base));
  const ref = Math.abs(ax[1]) < 0.9 ? Y : X;
  const u = v3.norm(cross(ax, ref));
  const w = cross(ax, u);
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU;
    d.line(v3.add(base, v3.add(v3.mul(u, Math.cos(t) * r), v3.mul(w, Math.sin(t) * r))), tip, { s: 0.85, d: 0.6, ...o });
  }
}

/** Beş köşeli yıldız (xy düzleminde). */
function star(d, c, r, o = {}) {
  const pts = Array.from({ length: 11 }, (_, k) => {
    const a = Math.PI / 2 + (k * TAU) / 10;
    const rr = k % 2 ? r * 0.42 : r;
    return [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2]];
  });
  d.poly(pts, o);
}

/** Ofis koltuğu: (x, z) noktasında, f = [fx, fz] yönüne bakar — oturak, sırtlık, ayak ve beş kollu taban. */
function chair(d, x, z, f, o = {}) {
  const fw = v3.norm([f[0], 0, f[1]]);
  const sd = [-fw[2], 0, fw[0]];
  const ys = FLOOR + 1.7;
  const S = 0.6;
  const at = (a, b, y) => [x + sd[0] * a + fw[0] * b, y, z + sd[2] * a + fw[2] * b];
  const sq = (y) => [at(-S, -S, y), at(S, -S, y), at(S, S * 0.9, y), at(-S, S * 0.9, y)];
  d.poly(sq(ys), { s: 0.95, d: 1.2, ...o }, true);
  d.poly(sq(ys + 0.14), { s: 0.9, d: 0.8, ...o }, true);
  const yb0 = ys + 0.4;
  const yb1 = ys + 1.75;
  d.poly([at(-S * 0.9, -S - 0.02, yb0), at(-S * 0.95, -S - 0.14, yb1), at(S * 0.95, -S - 0.14, yb1), at(S * 0.9, -S - 0.02, yb0)], { s: 0.95, d: 1.3, ...o }, true);
  d.line(at(0, -S, ys + 0.14), at(0, -S - 0.02, yb0), { s: 0.9, d: 0.8, ...o });
  d.line(at(0, 0, ys), at(0, 0, FLOOR + 0.32), { s: 0.95, d: 1.0, ...o });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + 0.3;
    d.line([x, FLOOR + 0.32, z], [x + Math.cos(a) * 0.72, FLOOR + 0.1, z + Math.sin(a) * 0.72], { s: 0.9, d: 0.9, ...o });
  }
}

/** Kâğıt üzerinde metin satırları: at(x, y) düzleminde x0 → x1 arasında, y0'dan aşağı n satır; son satır kısa. */
function textLines(d, at, x0, x1, y0, n, gap, rnd, o = {}) {
  for (let i = 0; i < n; i++) {
    const end = i === n - 1 ? x0 + (x1 - x0) * (0.35 + rnd() * 0.3) : x1 - rnd() * (x1 - x0) * 0.12;
    d.line(at(x0, y0 - i * gap), at(end, y0 - i * gap), { s: 0.75, d: 0.5, ...o });
  }
}

/** Ok ucu: tip noktasında, dir yönünde (xy düzlemi). */
function arrowHead(d, tip, dir, o = {}, len = 0.45, half = 0.3) {
  const b = v3.norm(dir);
  const s = [-b[1], b[0], 0];
  d.line(tip, v3.add(tip, v3.add(v3.mul(b, -len), v3.mul(s, half))), o);
  d.line(tip, v3.add(tip, v3.sub(v3.mul(b, -len), v3.mul(s, half))), o);
}

/* ── Şirketler ve Sözleşmeler Hukuku: sözleşme — başlık, üç madde, iki imza; önde dolma kalem, arkada ikinci nüsha */
export function sozlesme(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  d.rect([1.2, 0.55, -1.6], X, Y, 6.0, 7.8, { s: 0.8, d: 0.8 });
  const c = [-0.6, 0.1, 0];
  const at = (a, b, z = 0) => [c[0] + a, c[1] + b, c[2] + z];
  d.rect(c, X, Y, 6.4, 8.4, { s: 1.1, d: 2.0 });
  d.text('SÖZLEŞME', at(0, 3.2), X, Y, 0.55, { align: 'center', t: 1, s: 1.15, d: 2.4 });
  d.line(at(-2.4, 2.9), at(2.4, 2.9), { t: 1, s: 0.95, d: 1.1 });
  [2.2, 0.5, -1.2].forEach((y, i) => {
    d.text(`MADDE ${i + 1}`, at(-2.8, y), X, Y, 0.34, { s: 1.0, d: 1.5 });
    textLines(d, at, -2.8, 2.6, y - 0.42, 3, 0.32, rnd);
  });
  const sig = (x0, t) => {
    d.line(at(x0, -3.3), at(x0 + 2.3, -3.3), { s: 0.9, d: 0.9 });
    d.curve((u) => at(x0 + 0.15 + u * 2.0, -2.95 + Math.sin(u * 12.5) * 0.2 * (1 - u * 0.5) + u * 0.22, 0.02), { t, s: 1.1, d: 2.2 }, 90);
  };
  sig(-2.8, 2);
  sig(0.4, 3);
  // dolma kalem: gövde ve uç (önde, çapraz)
  const a = [1.9, -3.2, 1.5];
  const b = [5.6, -0.4, 2.0];
  const m = v3.mix(a, b, 0.18);
  cylinder(d, m, b, 0.24, 10, { t: 1 });
  cylinder(d, v3.mix(a, b, 0.55), v3.mix(a, b, 0.6), 0.27, 8, { t: 1 });
  cone(d, m, a, 0.24, 8, { t: 1 });
  d.done(Nf);
}

/* ── Ticaret Sicil İşlemleri: sicil gazetesi — başlık, üç sütun, çerçeveli ilan; önde kırmızı tescil mührü */
export function sicil(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  d.rect([0.2, 0.7, -1.5], X, Y, 7.4, 8.4, { s: 0.8, d: 0.8 });
  const c = [-0.7, 0.2, 0];
  const at = (a, b, z = 0) => [c[0] + a, c[1] + b, c[2] + z];
  d.rect(c, X, Y, 7.6, 8.8, { s: 1.1, d: 2.0 });
  d.text('TİCARET SİCİLİ', at(0, 3.55), X, Y, 0.5, { align: 'center', s: 1.15, d: 2.4 });
  d.line(at(-3.5, 3.3), at(3.5, 3.3), { s: 1.0, d: 1.4 });
  d.line(at(-3.5, 3.14), at(3.5, 3.14), { s: 0.9, d: 0.9 });
  [[-3.4, -1.3], [-1.05, 1.05], [1.3, 3.4]].forEach(([x0, x1], ci) => {
    for (let r = 0; r < 18; r++) {
      const y = 2.75 - r * 0.36;
      if (ci === 1 && y < 2.25 && y > -0.45) continue; // ilan kutusu
      if (ci === 2 && y < -1.0) continue; // mührün altı
      const end = r % 6 === 5 ? x0 + (x1 - x0) * (0.3 + rnd() * 0.35) : x1 - rnd() * 0.12;
      d.line(at(x0, y), at(end, y), { s: 0.72, d: 0.42 });
    }
  });
  d.rect(at(0, 0.9), X, Y, 2.3, 2.5, { t: 1, s: 1.0, d: 1.6 });
  d.text('İLAN', at(0, 1.55), X, Y, 0.4, { align: 'center', t: 1, s: 1.05, d: 1.8 });
  for (let r = 0; r < 3; r++) d.line(at(-0.9, 1.2 - r * 0.34), at(r === 2 ? 0.3 : 0.9, 1.2 - r * 0.34), { t: 1, s: 0.8, d: 0.7 });
  const m = at(2.6, -2.55, 0.9);
  d.circle(m, X, Y, 1.45, { t: 2, s: 1.1, d: 2.0 });
  d.circle(m, X, Y, 1.12, { t: 2, s: 0.95, d: 1.2 });
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * TAU;
    d.line([m[0] + Math.cos(a) * 1.18, m[1] + Math.sin(a) * 1.18, m[2]], [m[0] + Math.cos(a) * 1.38, m[1] + Math.sin(a) * 1.38, m[2]], { t: 2, s: 0.9, d: 0.5 });
  }
  d.text('TESCİL', [m[0], m[1] - 0.19, m[2]], X, Y, 0.38, { align: 'center', t: 2, s: 1.05, d: 1.8 });
  d.done(Nf);
}

/* ── İş ve Sosyal Güvenlik Hukuku: arabuluculuk masası — iki tarafın ve arabulucunun koltuğu, masada belgeler ve isim levhası;
   hizmetin dayandığı 4857 sayılı İş Kanunu ve 5510 sayılı Kanun numaraları */
export function arabulucu(p, rnd, Nf) {
  const top = FLOOR + 2.55;
  const d = new Draw(tiltX(p, 0.5, top, 0), rnd); // masa yüzeyi kameraya dönük: belgeler ve levha görünür
  const R = 2.7;
  d.circle([0, top, 0], X, Z, R, { s: 1.05, d: 2.2 });
  d.circle([0, top - 0.16, 0], X, Z, R, { s: 0.9, d: 1.0 });
  cylinder(d, [0, top - 0.16, 0], [0, FLOOR + 0.18, 0], 0.22, 8, {});
  d.circle([0, FLOOR + 0.06, 0], X, Z, 1.05, { s: 0.9, d: 1.0 });
  // masadaki belgeler (yatık)
  const doc = (cx, cz, ang) => {
    const u = [Math.cos(ang), 0, Math.sin(ang)];
    const v = [Math.sin(ang), 0, -Math.cos(ang)];
    const at = (a, b) => [cx + u[0] * a + v[0] * b, top + 0.03, cz + u[2] * a + v[2] * b];
    d.poly([at(-0.7, -0.95), at(0.7, -0.95), at(0.7, 0.95), at(-0.7, 0.95)], { s: 0.95, d: 1.2 }, true);
    textLines(d, at, -0.5, 0.5, 0.65, 4, 0.3, rnd);
  };
  doc(-1.0, 0.9, 0.25);
  doc(1.1, 0.8, -0.3);
  // arabulucu levhası: öne eğik üçgen prizma
  const zf = -0.7;
  const L = 1.35;
  const h = 0.6;
  const fb = (x) => [x, top, zf];
  const tp = (x) => [x, top + h, zf - 0.3];
  const bb = (x) => [x, top, zf - 0.6];
  d.poly([fb(-L), fb(L), tp(L), tp(-L)], { t: 1, s: 1.0, d: 1.4 }, true);
  d.line(tp(-L), bb(-L), { t: 1, s: 0.9, d: 0.8 });
  d.line(tp(L), bb(L), { t: 1, s: 0.9, d: 0.8 });
  d.line(bb(-L), bb(L), { t: 1, s: 0.8, d: 0.6 });
  const up = v3.norm([0, h, -0.3]);
  d.text('ARABULUCU', v3.add(fb(0), v3.mul(up, 0.14)), X, up, 0.3, { align: 'center', t: 1, s: 1.0, d: 1.6 });
  // koltuklar: taraflar (kırmızı, yeşil) ve arabulucu (mavi, arkada)
  const seat = (ang, t) => chair(d, Math.cos(ang) * 3.95, Math.sin(ang) * 3.95, [-Math.cos(ang), -Math.sin(ang)], { t });
  seat(Math.PI * 0.84, 2);
  seat(Math.PI * 0.16, 3);
  seat(-Math.PI / 2, 1);
  d.text('4857', [-5.9, 2.6, -1.4], X, Y, 0.62, { s: 1.1, d: 2.0 });
  d.text('5510', [5.9, 2.6, -1.4], X, Y, 0.62, { align: 'right', s: 1.1, d: 2.0 });
  d.done(Nf);
}

/* ── Vergi Uyuşmazlıkları: ihbarname → karar noktası → solda uzlaşma (tutanak ve tik), sağda dava (yargı binası) */
export function uyusmazlik(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const z = 0.4;
  const ny = -3.05;
  d.rect([0, ny, z], X, Y, 3.4, 1.9, { s: 1.05, d: 1.6 });
  d.text('İHBARNAME', [0, ny + 0.28, z], X, Y, 0.34, { align: 'center', s: 1.0, d: 1.6 });
  d.line([-1.3, ny - 0.25, z], [1.3, ny - 0.25, z], { s: 0.75, d: 0.5 });
  d.line([-1.3, ny - 0.55, z], [0.4, ny - 0.55, z], { s: 0.75, d: 0.5 });
  // yol ve karar noktası
  const fy = -0.55;
  d.line([0, ny + 0.95, z], [0, fy - 0.45, z], { s: 1.0, d: 1.6 });
  d.poly([[0, fy + 0.45, z], [0.45, fy, z], [0, fy - 0.45, z], [-0.45, fy, z]], { s: 1.05, d: 1.6 }, true);
  d.curve(bez([-0.45, fy, z], [-2.6, fy, z], [-3.9, fy + 0.2, z], [-3.9, 1.0, z]), { t: 3, s: 1.1, d: 2.2 });
  arrowHead(d, [-3.9, 1.05, z], [0, 1, 0], { t: 3, s: 1.1, d: 1.6 });
  d.curve(bez([0.45, fy, z], [2.6, fy, z], [3.9, fy + 0.2, z], [3.9, 1.0, z]), { t: 1, s: 1.1, d: 2.2 });
  arrowHead(d, [3.9, 1.05, z], [0, 1, 0], { t: 1, s: 1.1, d: 1.6 });
  // uzlaşma: iki tutanak ve yeşil tik
  d.rect([-4.35, 2.45, z - 0.3], X, Y, 1.7, 2.2, { s: 0.9, d: 1.0 });
  d.rect([-3.55, 2.25, z], X, Y, 1.7, 2.2, { s: 1.0, d: 1.4 });
  textLines(d, (a, b) => [-3.55 + a, 2.25 + b, z], -0.6, 0.6, 0.7, 4, 0.32, rnd);
  d.poly([[-4.55, 2.35, z + 0.3], [-3.85, 1.65, z + 0.3], [-2.55, 3.2, z + 0.3]], { t: 3, s: 1.25, d: 2.6 });
  d.text('UZLAŞMA', [-3.9, 4.25, z], X, Y, 0.42, { align: 'center', t: 3, s: 1.1, d: 2.0 });
  // dava: yargı binası (basamak, dört sütun, kiriş, alınlık)
  const bx = 3.9;
  const by = 1.35;
  d.line([bx - 1.75, by, z], [bx + 1.75, by, z], { t: 1, s: 1.0, d: 1.3 });
  d.line([bx - 1.55, by + 0.16, z], [bx + 1.55, by + 0.16, z], { t: 1, s: 1.0, d: 1.2 });
  for (const x of [-1.2, -0.4, 0.4, 1.2]) {
    d.line([bx + x - 0.13, by + 0.16, z], [bx + x - 0.13, by + 1.55, z], { t: 1, s: 0.95, d: 1.0 });
    d.line([bx + x + 0.13, by + 0.16, z], [bx + x + 0.13, by + 1.55, z], { t: 1, s: 0.95, d: 1.0 });
  }
  d.rect([bx, by + 1.7, z], X, Y, 3.3, 0.3, { t: 1, s: 1.0, d: 1.3 });
  d.poly([[bx - 1.75, by + 1.85, z], [bx, by + 2.5, z], [bx + 1.75, by + 1.85, z]], { t: 1, s: 1.05, d: 1.5 }, true);
  d.text('DAVA', [bx, 4.25, z], X, Y, 0.42, { align: 'center', t: 1, s: 1.1, d: 2.0 });
  d.done(Nf);
}

/* ── KVKK Uyum: veri envanteri (veri · amaç · sebep · süre) ve önünde anahtar delikli koruma kalkanı; 6698 sayılı Kanun */
export function kvkk(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const c = [-1.6, 0.2, -1.2];
  const W = 8.2;
  const H = 6.0;
  const at = (a, b, z = 0) => [c[0] + a, c[1] + b, c[2] + z];
  d.rect(c, X, Y, W, H, { s: 1.0, d: 1.6 });
  const xs = [-W / 2, -1.9, -0.1, 1.9, W / 2];
  for (const x of xs.slice(1, -1)) d.line(at(x, H / 2), at(x, -H / 2), { s: 0.8, d: 0.6 });
  const hy = H / 2 - 0.8;
  d.line(at(-W / 2, hy), at(W / 2, hy), { s: 1.0, d: 1.2 });
  ['VERİ', 'AMAÇ', 'SEBEP', 'SÜRE'].forEach((h, i) => d.text(h, at((xs[i] + xs[i + 1]) / 2, hy + 0.18), X, Y, 0.44, { align: 'center', t: 1, s: 0.95, d: 1.5 }));
  for (let r = 0; r < 5; r++) {
    const y = hy - 0.5 - r * 0.95;
    if (r) d.line(at(-W / 2, y + 0.47), at(W / 2, y + 0.47), { s: 0.7, d: 0.35 });
    for (let i = 0; i < 4; i++) {
      const x0 = xs[i] + 0.22;
      d.line(at(x0, y), at(x0 + (xs[i + 1] - xs[i] - 0.44) * (0.45 + rnd() * 0.5), y), { s: 0.72, d: 0.45 });
    }
  }
  d.text('KVKK', at(-W / 2, H / 2 + 0.3), X, Y, 0.5, { t: 1, s: 1.1, d: 2.0 });
  d.text('6698', at(W / 2, H / 2 + 0.3), X, Y, 0.5, { align: 'right', s: 1.1, d: 2.0 });
  // kalkan: üst kenar hafif içe kavisli, yanlar sivri uca iner
  const S0 = [2.9, -0.4, 1.6];
  const q = bez([1.75, 0.35, 0], [1.75, -1.2, 0], [0.8, -2.2, 0], [0, -2.7, 0]);
  const shield = (k) => {
    const P = (x, y) => [S0[0] + x * k, S0[1] + y * k, S0[2]];
    const pts = [P(-1.75, 1.95)];
    for (let i = 1; i <= 8; i++) pts.push(P(-1.75 + 3.5 * (i / 8), 1.95 - Math.sin((i / 8) * Math.PI) * 0.22));
    pts.push(P(1.75, 0.35));
    for (let i = 1; i <= 12; i++) pts.push(P(q(i / 12)[0], q(i / 12)[1]));
    for (let i = 11; i >= 0; i--) pts.push(P(-q(i / 12)[0], q(i / 12)[1]));
    pts.push(P(-1.75, 1.95));
    return pts;
  };
  d.poly(shield(1), { t: 1, s: 1.15, d: 2.4 });
  d.poly(shield(0.8), { t: 1, s: 0.95, d: 1.2 });
  const kc = [S0[0], S0[1] + 0.35, S0[2] + 0.02];
  d.circle(kc, X, Y, 0.42, { t: 3, s: 1.1, d: 2.0 });
  d.poly([[kc[0] - 0.18, kc[1] - 0.38, kc[2]], [kc[0] - 0.36, kc[1] - 1.35, kc[2]], [kc[0] + 0.36, kc[1] - 1.35, kc[2]], [kc[0] + 0.18, kc[1] - 0.38, kc[2]]], { t: 3, s: 1.1, d: 1.8 });
  d.done(Nf);
}

/* ── Alacak ve İcra Takibi: vadesi geçmiş faturalar → ihtar → arabuluculuk → icra adımları → tahsil (sikke kuleleri) */
export function icra(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  for (let i = 0; i < 3; i++) d.rect([-5.0 + i * 0.45, 1.0 - i * 0.4, -1.2 + i * 0.6], X, Y, 2.9, 3.8, { s: i === 2 ? 1.05 : 0.8, d: i === 2 ? 1.6 : 0.8 });
  const F = [-4.1, 0.2, 0.0];
  const at = (a, b, z = 0) => [F[0] + a, F[1] + b, F[2] + z];
  d.text('₺', at(-1.15, 0.85), X, Y, 0.7, { t: 1, s: 1.1, d: 1.8 });
  d.text('85.000', at(1.2, 0.95), X, Y, 0.42, { align: 'right', s: 1.1, d: 1.8 });
  textLines(d, at, -1.1, 1.1, 0.35, 4, 0.32, rnd);
  // VADE damgası (eğik, kırmızı)
  const ang = 0.28;
  const u = [Math.cos(ang), Math.sin(ang), 0];
  const v = [-Math.sin(ang), Math.cos(ang), 0];
  const sc = at(0.1, -1.25, 0.05);
  d.rect(sc, u, v, 1.9, 0.75, { t: 2, s: 1.05, d: 1.6 });
  d.text('VADE', v3.add(sc, v3.mul(v, -0.2)), u, v, 0.4, { align: 'center', t: 2, s: 1.05, d: 1.8 });
  // takip yolu ve adımlar
  const path = bez([-2.4, -0.4, 0.3], [-1.0, 2.2, 0.6], [1.4, 2.2, 0.6], [2.6, -0.2, 0.3]);
  d.curve(path, { s: 1.0, d: 1.8 });
  arrowHead(d, path(1), v3.sub(path(1), path(0.97)), { s: 1.0, d: 1.4 }, 0.4, 0.26);
  ['İHTAR', 'ARABULUCU', 'İCRA'].forEach((label, i) => {
    const qq = path(0.2 + i * 0.3);
    const t = [1, 2, 3][i];
    d.node(qq, 0.22, 3, { t });
    d.text(label, [qq[0], qq[1] + 0.42, qq[2]], X, Y, 0.3, { align: 'center', t, s: 1.0, d: 1.5 });
  });
  // tahsil: sikke kuleleri
  [[3.6, 4], [4.8, 7], [6.0, 10]].forEach(([x, n]) => {
    for (let i = 0; i < n; i++) d.circle([x, FLOOR + 0.05 + i * 0.27, 0.6], X, Z, 0.52, { t: i === n - 1 ? 3 : 0, s: 0.9, d: 0.8 });
    for (const a of [0.35, 1.25, 2.15, 3.05]) d.line([x + Math.cos(a) * 0.52, FLOOR + 0.05, 0.6 + Math.sin(a) * 0.52], [x + Math.cos(a) * 0.52, FLOOR + 0.05 + (n - 1) * 0.27, 0.6 + Math.sin(a) * 0.52], { s: 0.75, d: 0.4 });
  });
  d.done(Nf);
}

/* ── Şirket Kuruluş Danışmanlığı: temel ve kat iskeleti; kule vinç «A.Ş.» bloğunu yerine indirir */
export function kurulus(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const bx = -2.0;
  const bw = 4.6;
  const bd = 3.0;
  d.box([bx, FLOOR + 0.2, 0], [bw + 0.9, 0.4, bd + 0.9], { s: 0.95, d: 1.2 }, { top: 2 });
  const lv = [FLOOR + 0.4, FLOOR + 1.6, FLOOR + 2.8, FLOOR + 4.0];
  for (const x of [bx - bw / 2, bx, bx + bw / 2]) {
    for (const z of [-bd / 2, bd / 2]) {
      const short = x === bx + bw / 2 && z === bd / 2;
      d.line([x, lv[0], z], [x, short ? lv[2] + 0.6 : lv[3], z], { s: 0.95, d: 1.1 });
    }
  }
  for (let i = 1; i < 4; i++) d.rect([bx, lv[i], 0], X, Z, bw, bd, { s: 0.95, d: i === 3 ? 0.8 : 1.2 });
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < 4; k++) d.rect([bx - bw / 2 + 0.75 + k * 1.1, lv[i] + 0.6, bd / 2 + 0.01], X, Y, 0.7, 0.7, { t: 1, s: 0.85, d: 0.7 });
  }
  // kule vinç: kafes kule
  const mx = 3.3;
  const mt = 3.9;
  const h = 0.36;
  for (const [a, b] of [[-h, -h], [h, -h], [h, h], [-h, h]]) d.line([mx + a, FLOOR, b], [mx + a, mt, b], { t: 1, s: 0.95, d: 1.1 });
  const seg = (mt - FLOOR) / 11;
  for (let k = 0; k < 11; k++) {
    const y0 = FLOOR + k * seg;
    d.line([mx - h, y0, h], [mx + h, y0 + seg, h], { t: 1, s: 0.8, d: 0.45 });
    d.line([mx + h, y0, -h], [mx + h, y0 + seg, h], { t: 1, s: 0.8, d: 0.35 });
  }
  // bom ve karşı bom: iki alt kiriş, üst kiriş, çaprazlar
  const jx0 = -4.8;
  const jx1 = 6.3;
  d.line([jx0, mt, -0.28], [jx1, mt, -0.28], { t: 1, s: 0.95, d: 1.0 });
  d.line([jx0, mt, 0.28], [jx1, mt, 0.28], { t: 1, s: 0.95, d: 1.0 });
  d.line([jx0, mt + 0.6, 0], [jx1 - 0.6, mt + 0.6, 0], { t: 1, s: 0.95, d: 1.0 });
  for (let k = 0; k < 17; k++) {
    const x0 = jx0 + k * 0.62;
    d.line([x0, mt, 0.28], [x0 + 0.31, mt + 0.6, 0], { t: 1, s: 0.8, d: 0.35 });
    d.line([x0 + 0.31, mt + 0.6, 0], [x0 + 0.62, mt, 0.28], { t: 1, s: 0.8, d: 0.35 });
  }
  // kule tepesi ve askı halatları, karşı ağırlık
  d.line([mx - h, mt, 0], [mx, mt + 1.3, 0], { t: 1, s: 0.95, d: 1.0 });
  d.line([mx + h, mt, 0], [mx, mt + 1.3, 0], { t: 1, s: 0.95, d: 1.0 });
  d.line([mx, mt + 1.3, 0], [jx0 + 1.0, mt + 0.6, 0], { s: 0.75, d: 0.5 });
  d.line([mx, mt + 1.3, 0], [jx1 - 0.6, mt + 0.6, 0], { s: 0.75, d: 0.5 });
  d.box([5.7, mt - 0.45, 0], [1.0, 0.8, 0.9], { s: 0.95, d: 1.0 });
  // araba, halatlar, sapanlar ve «A.Ş.» bloğu (temelin üstüne iniyor)
  d.box([bx, mt - 0.12, 0], [0.5, 0.22, 0.6], { s: 0.9, d: 0.8 });
  d.line([bx - 0.1, mt - 0.22, 0], [bx - 0.1, 2.0, 0], { s: 0.8, d: 0.6 });
  d.line([bx + 0.1, mt - 0.22, 0], [bx + 0.1, 2.0, 0], { s: 0.8, d: 0.6 });
  const blk = [bx, 0.95, 0];
  d.box(blk, [2.2, 1.1, 1.4], { t: 2, s: 1.0, d: 1.4 });
  for (const [a, b] of [[-1.1, -0.7], [1.1, -0.7], [1.1, 0.7], [-1.1, 0.7]]) d.line([bx, 2.0, 0], [bx + a, blk[1] + 0.55, b], { s: 0.75, d: 0.45 });
  d.text('A.Ş.', [bx, blk[1] - 0.25, 0.71], X, Y, 0.55, { align: 'center', t: 2, s: 1.15, d: 2.2 });
  d.done(Nf);
}

/* ── Yatırım Teşvik Belgesi: belge (çift çerçeve, başlık, imza, mühür ve kurdele); arkada testere çatılı fabrika ve baca */
export function belge(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const z0 = -2.4;
  const fx = -5.4; // fabrikanın sol kenarı
  const roof = [[fx, FLOOR, z0], [fx, -1.7, z0]];
  for (let k = 0; k < 4; k++) {
    const x = fx + k * 1.85;
    roof.push([x, -0.4, z0], [x + 1.85, -1.7, z0]);
  }
  roof.push([fx + 7.4, FLOOR, z0]);
  d.poly(roof, { t: 1, s: 0.9, d: 1.1 });
  d.line([fx, FLOOR, z0], [fx + 7.4, FLOOR, z0], { t: 1, s: 0.85, d: 0.7 });
  for (let k = 0; k < 6; k++) d.rect([fx + 0.7 + k * 1.15, -2.75, z0], X, Y, 0.6, 0.6, { t: 1, s: 0.8, d: 0.5 });
  d.rect([fx + 0.8, 0.45, z0], X, Y, 0.6, 2.7, { t: 1, s: 0.9, d: 0.9 });
  for (const [x, y, r] of [[1.0, 2.3, 0.35], [1.5, 2.9, 0.45], [2.2, 3.4, 0.55]]) d.cloud([fx + x, y, z0], [r, r * 0.7, r * 0.5], 1.2, { s: 0.75, sv: 0.3, j: 0.02 });
  // belge
  const c = [1.9, 0.4, 1.0];
  const at = (a, b, z = 0) => [c[0] + a, c[1] + b, c[2] + z];
  d.rect(c, X, Y, 6.6, 4.8, { s: 1.1, d: 1.9 });
  d.rect(c, X, Y, 6.1, 4.3, { s: 0.85, d: 0.9 });
  d.text('TEŞVİK BELGESİ', at(0, 1.3), X, Y, 0.4, { align: 'center', t: 1, s: 1.1, d: 2.2 });
  for (const [w, y] of [[2.4, 0.75], [1.9, 0.4], [2.2, 0.05]]) d.line(at(-w, y), at(w, y), { s: 0.75, d: 0.5 });
  d.curve((u) => at(-2.4 + u * 1.9, -1.2 + Math.sin(u * 11) * 0.16 + u * 0.15, 0.02), { t: 3, s: 1.05, d: 1.8 }, 80);
  d.line(at(-2.5, -1.45), at(-0.4, -1.45), { s: 0.85, d: 0.7 });
  // mühür ve kurdele
  const s0 = at(1.9, -1.0, 0.15);
  d.circle(s0, X, Y, 0.62, { t: 2, s: 1.05, d: 1.6 });
  d.poly(Array.from({ length: 25 }, (_, k) => {
    const a = (k / 24) * TAU;
    const r = k % 2 ? 0.78 : 0.92;
    return [s0[0] + Math.cos(a) * r, s0[1] + Math.sin(a) * r, s0[2]];
  }), { t: 2, s: 1.0, d: 1.4 });
  for (const sg of [-1, 1]) {
    const P = (x, y) => [s0[0] + sg * x, s0[1] + y, s0[2]];
    d.poly([P(0.3, -0.8), P(0.62, -1.75), P(0.36, -1.55), P(0.12, -1.8), P(0.04, -0.86)], { t: 2, s: 1.0, d: 1.3 });
  }
  d.done(Nf);
}

/* ── TÜBİTAK ve KOSGEB Destek Programları: proje iş planı — 12 aylık takvim, dört iş paketi, kilometre taşları, «bugün» çizgisi */
export function proje(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const c = [0.6, 0.3, 0];
  const W = 9.8;
  const H = 6.8;
  const x0 = c[0] - W / 2;
  const yT = c[1] + H / 2;
  const yB = c[1] - H / 2;
  d.rect(c, X, Y, W, H, { s: 1.0, d: 1.5 });
  d.text('İŞ PLANI', [x0 + 0.4, yT - 0.75, 0], X, Y, 0.42, { t: 1, s: 1.1, d: 2.0 });
  const gx0 = x0 + 1.9;
  const gx1 = x0 + W - 0.4;
  const gy0 = yT - 1.2;
  const gy1 = yB + 0.35;
  d.line([x0, gy0, 0], [x0 + W, gy0, 0], { s: 0.95, d: 1.0 });
  const mx = (m) => gx0 + ((gx1 - gx0) * m) / 12;
  for (let m = 0; m <= 12; m++) d.line([mx(m), gy0, 0], [mx(m), gy1, 0], { s: 0.6, d: m % 3 === 0 ? 0.4 : 0.18 });
  const wp = [[0, 4], [2, 7], [5, 10], [8, 12]];
  const tc = [1, 0, 2, 3];
  wp.forEach(([a, b], i) => {
    const y = gy0 - 0.9 - i * 1.25;
    d.text(`İP${i + 1}`, [x0 + 0.4, y - 0.17, 0], X, Y, 0.34, { s: 1.0, d: 1.5 });
    const xa = mx(a);
    const xb = mx(b);
    d.rect([(xa + xb) / 2, y, 0.05], X, Y, xb - xa, 0.6, { t: tc[i], s: 1.0, d: 1.4 });
    d.hatch([(xa + xb) / 2, y, 0.05], X, Y, xb - xa - 0.12, 0.42, 3, { t: tc[i], s: 0.8, d: 0.45 });
    d.poly([[xb, y + 0.42, 0.1], [xb + 0.3, y, 0.1], [xb, y - 0.42, 0.1], [xb - 0.3, y, 0.1]], { t: 2, s: 1.05, d: 1.4 }, true);
  });
  const xt = mx(6.4);
  d.line([xt, gy0 + 0.1, 0.15], [xt, gy1, 0.15], { t: 3, s: 1.05, d: 1.6 });
  d.poly([[xt - 0.22, gy0 + 0.42, 0.15], [xt + 0.22, gy0 + 0.42, 0.15], [xt, gy0 + 0.1, 0.15]], { t: 3, s: 1.05, d: 1.4 }, true);
  d.done(Nf);
}

/* ── Ar-Ge ve Teknokent Danışmanlığı: fikir ampulü (cam gövde, dişli duy), içinde dişli; üstünde ışık çizgileri */
export function arge(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const cy = 1.15;
  const R = 2.3;
  const th1 = 2.2;
  const r0 = R * Math.sin(th1);
  const y0 = cy + R * Math.cos(th1);
  // cam: kürenin büyük bölümü + duya inen boyun (dönel yüzeyin meridyenleri ve birkaç paraleli)
  const prof = (s) => {
    if (s <= 0.78) {
      const th = (s / 0.78) * th1;
      return [R * Math.sin(th), cy + R * Math.cos(th)];
    }
    const u = (s - 0.78) / 0.22;
    return [r0 + (0.82 - r0) * (u * (2 - u)), y0 + (-1.55 - y0) * u];
  };
  for (let k = 0; k < 8; k++) {
    const ph = (k / 8) * TAU;
    d.curve((s) => {
      const [r, y] = prof(s);
      return [r * Math.cos(ph), y, r * Math.sin(ph)];
    }, { s: 0.85, d: k % 2 ? 0.45 : 0.7 }, 72);
  }
  for (const s of [0.25, 0.5, 0.72]) {
    const [r, y] = prof(s);
    d.circle([0, y, 0], X, Z, r, { s: 0.8, d: 0.5 });
  }
  // duy: vida halkaları ve alt kontak
  for (let i = 0; i < 5; i++) d.circle([0, -1.62 - i * 0.24, 0], X, Z, 0.84 - i * 0.03, { t: 1, s: 0.95, d: 1.0 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    d.line([Math.cos(a) * 0.84, -1.62, Math.sin(a) * 0.84], [Math.cos(a) * 0.72, -2.58, Math.sin(a) * 0.72], { t: 1, s: 0.8, d: 0.45 });
  }
  d.circle([0, -2.82, 0], X, Z, 0.36, { t: 1, s: 0.95, d: 0.9 });
  // dişli ve taşıyıcı teller
  const g = [0, 1.25, 0];
  const teeth = 10;
  const gp = [];
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * TAU;
    const st = TAU / teeth;
    for (const [f, r] of [[0, 0.92], [0.15, 1.22], [0.45, 1.22], [0.6, 0.92]]) gp.push([g[0] + Math.cos(a0 + f * st) * r, g[1] + Math.sin(a0 + f * st) * r, g[2]]);
  }
  gp.push(gp[0]);
  d.poly(gp, { t: 1, s: 1.05, d: 1.8 });
  d.circle(g, X, Y, 0.38, { t: 1, s: 1.0, d: 1.2 });
  d.line([-0.25, 0.3, 0], [-0.3, -1.5, 0], { s: 0.75, d: 0.5 });
  d.line([0.25, 0.3, 0], [0.3, -1.5, 0], { s: 0.75, d: 0.5 });
  // ışık
  for (let k = 0; k < 9; k++) {
    const a = 0.18 * Math.PI + (k / 8) * 0.64 * Math.PI;
    d.line([Math.cos(a) * 2.75, cy + Math.sin(a) * 2.75, 0], [Math.cos(a) * 3.45, cy + Math.sin(a) * 3.45, 0], { t: 3, s: 1.05, d: 1.3 });
  }
  d.text('AR-GE', [0, -3.85, 0], X, Y, 0.45, { align: 'center', t: 1, s: 1.1, d: 2.0 });
  d.done(Nf);
}

/* ── AB Hibe ve Proje Danışmanlığı: on iki yıldızlı halka, ortada avro; altta başvuru dosyası */
export function hibe(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const C = [0, 1.1, -0.6];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    star(d, [C[0] + Math.cos(a) * 3.1, C[1] + Math.sin(a) * 3.1, C[2]], 0.36, { t: 1, s: 1.05, d: 1.6 });
  }
  d.text('€', [C[0] - 0.15, C[1] - 1.05, C[2] + 0.7], X, Y, 2.1, { align: 'center', s: 1.2, d: 2.8 });
  for (let i = 0; i < 3; i++) d.box([0.2 - i * 0.12, FLOOR + 0.12 + i * 0.22, 1.9 + i * 0.05], [4.4 - i * 0.25, 0.16, 2.4 - i * 0.2], { s: 0.85, d: 0.55 });
  d.done(Nf);
}

/* ── İstihdam Teşvikleri: önde dört koltuk (en yenisi yeşil, üstünde «+»), arkada 12 aylık SGK prim çubukları; alt dilim prim desteği */
export function istihdam(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const z = -2.3;
  for (let m = 0; m < 12; m++) {
    const x = -5.5 + m * 1.0;
    const h = 2.9 + Math.sin(m * 0.8) * 0.22 + m * 0.03;
    const yb = -1.0; // duvardaki çizelge: koltukların üstünde
    d.rect([x, yb + h / 2, z], X, Y, 0.64, h, { s: 0.85, d: 0.75 });
    const hs = h * 0.36;
    d.hatch([x, yb + hs / 2, z], X, Y, 0.56, hs - 0.08, 5, { t: 3, s: 0.85, d: 0.55 });
  }
  d.line([-6.0, -1.0, z], [6.0, -1.0, z], { s: 0.85, d: 0.7 });
  d.text('SGK', [-5.85, 2.75, z], X, Y, 0.55, { t: 1, s: 1.1, d: 2.0 });
  [-3.9, -1.3, 1.3, 3.9].forEach((x, i) => chair(d, x, 1.7, [0, 1], { t: i === 3 ? 3 : i % 2 ? 1 : 0 }));
  d.text('+', [5.2, -2.1, 1.7], X, Y, 0.9, { align: 'center', t: 3, s: 1.2, d: 2.4 });
  d.done(Nf);
}

/* ── İhracat ve Dış Ticaret Destekleri: tel kafes dünya, yüzeyden yükselen rota (iki liman), önde üst üste iki konteyner */
export function ihracat(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const G = [1.6, 0.9, -0.8];
  const R = 3.0;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI;
    d.circle(G, [Math.cos(a), 0, Math.sin(a)], Y, R, { t: 1, s: 0.85, d: 0.65 });
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const L = (lat * Math.PI) / 180;
    d.circle([G[0], G[1] + R * Math.sin(L), G[2]], X, Z, R * Math.cos(L), { t: 1, s: 0.85, d: lat === 0 ? 0.9 : 0.55 });
  }
  const sph = (lat, lon, rr) => [G[0] + rr * Math.cos(lat) * Math.sin(lon), G[1] + rr * Math.sin(lat), G[2] + rr * Math.cos(lat) * Math.cos(lon)];
  const A = [0.62, -0.95];
  const B = [0.78, 0.85];
  d.curve((u) => sph(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, R + 0.1 + Math.sin(u * Math.PI) * 1.0), { t: 2, s: 1.15, d: 2.6 });
  d.node(sph(A[0], A[1], R), 0.22, 2, { t: 2 });
  d.node(sph(B[0], B[1], R), 0.22, 2, { t: 3 });
  const cont = (c, o) => {
    const w = 3.3;
    const h = 1.4;
    const dp = 1.4;
    d.box(c, [w, h, dp], { s: 0.95, d: 1.1, ...o });
    for (let k = 1; k < 11; k++) {
      const x = c[0] - w / 2 + (w * k) / 11;
      d.line([x, c[1] - h / 2 + 0.08, c[2] + dp / 2], [x, c[1] + h / 2 - 0.08, c[2] + dp / 2], { s: 0.75, d: 0.4, ...o });
    }
  };
  cont([-4.3, FLOOR + 0.7, 1.7], { t: 3 });
  cont([-4.0, FLOOR + 2.1, 1.5], { t: 2 });
  d.done(Nf);
}
