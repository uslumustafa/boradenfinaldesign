
// 3B "dünya" formasyonları — hepsi aynı sayıda (N) noktadan oluşur; scroll ile biri diğerine dönüşür.
// Saf hesaplama: DOM veya three bağımlılığı yok (Node'da test edilebilir).
//
// Bir formasyon = kayıt defterindeki (FORMATIONS) bir satır: kimlik, çizici işlev, kamera pozu, dönüş davranışı ve ekranda gösterilen kısa açıklama.
// Sayfalar sahneyi kimlikle seçer (scripts/scenes.mjs › sceneOf; şablonlarda sceneNo('kimlik')): sıra numarası derlemede üretilir.
// Tek kural: 1…8 ana sayfadaki hizmet alanlarıyla aynı sırada ve ardışıktır (alanlar bandı bu aralıkta kaydırmayla geçiş yapar).
// Şekiller, sitenin yazdığı içerikle bağlantılıdır (hizmet, sektör ve sayfa metinleri); ilgisiz simgeler kullanılmaz. Ayrıntı: docs/FORMASYONLAR.md
//
//   0 Ufuk          — veri arazisi (açılış)
//   1 Rakamlar      — beyanname: matrah × oran = vergi, ₺, oranlar  (Vergi Denetim ve Danışmanlık)
//   2 Örnekleme     — denetim dosyası: tablo, büyüteç, denetçi tikleri (Bağımsız Denetim)
//   3 Defter        — yelpaze gibi açılmış defter/beyan yaprakları   (Muhasebe, Bordro ve Finansal Raporlama)
//   4 Karar ağacı   — kökler, gövde, dallar, taç                     (Kurumsal Finansman)
//   5 Teşvik        — destek basamakları, yükselen ok, AB yıldızları (Teşvik, AB Projeleri ve Startup)
//   6 Hukuk         — paragraf işareti ve tokmak                     (Hukuk)
//   7 Veri katmanı  — çubuk şehri                                    (Dijital Dönüşüm)
//   8 Okul binası   — kaide, sütunlar, kiriş, alınlık                (Akademi)
//   9 Kapı          — kemer ve ona uzanan yol                        (Kapanış)
//   10… bordro halkası, sektörler, hizmet kavramları, sayfa türleri; sonda Hukuk ve Teşvik hizmet şekilleri (bkz. FORMATIONS)
import { Draw, v3, X, Y } from './draw.js';
import { kayip, maliyet, varlik, sube, edim, alacak, hakedis, sezon, ucHalka, savunma } from './shapes-sector.js';
import { terazi, bilanco, muhur, mutabakat, dilimler, kdvZinciri, nakit, rasyo, hile, kup, akis, pay, sure } from './shapes-service.js';
import { petek, matris, ag, yayin, kitap, abakus, takvim, basvuru, yonlendirme, arama, arsiv, sozluk, gizlilik, soru, yazit } from './shapes-page.js';
import { rakamlar, agac, tesvik, hukuk, okul } from './shapes-area.js';
import { sozlesme, sicil, arabulucu, uyusmazlik, kvkk, icra, kurulus, belge, proje, arge, hibe, istihdam, ihracat } from './shapes-legal.js';

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

// Ufuk: satır sayısı ekranda eşit aralıklı görünsün diye derinlik, bakış açısının tanjantına göre dağıtılır (klasik "arazi çizimi").
// Her satırda aynı sayıda nokta + satır genişliği derinlikle orantılı → ekran uzayında düzgün yoğunluk.
// Her 8. satır "kontur" çizgisi (iki kat yoğun, iri); arazinin üstünde ince bir "veri sisi" katmanı yüzer.
function horizon(p, rnd, Nf) {
  const rows = Math.max(40, Math.min(72, Math.round(Math.sqrt(Nf / 3.2))));
  const per = Math.max(110, Math.round((Nf * 0.5) / rows));
  const h = 5.9; // kamera yüksekliği (arazi ortalamasına göre)
  const tMax = 0.66; // en yakın satır (ekranın alt kenarı)
  const tMin = 0.058; // en uzak satır
  for (let r = 0; r < rows; r++) {
    const tn = tMax - (tMax - tMin) * (r / (rows - 1));
    const dist = h / tn;
    const z = 16.5 - dist;
    const half = Math.max(11, dist * 0.95);
    const contour = r % 8 === 0;
    const cnt = contour ? per * 2 : per;
    for (let i = 0; i < cnt; i++) {
      const u = (i + rnd() * 0.6) / cnt;
      const x = (u - 0.5) * 2 * half;
      p.add(x, terrain(x, z), z, (contour ? 1.1 : 0.8) + rnd() * 0.6, rnd() < 0.02 ? 1 + Math.floor(rnd() * 3) : 0);
    }
  }
  // veri sisi: arazinin hemen üstünde, yere yakın yoğun
  while (p.n < Nf) {
    const dist = 8 + Math.pow(rnd(), 0.75) * 92;
    const z = 16.5 - dist;
    const x = (rnd() - 0.5) * 2 * dist * 0.85;
    const y = terrain(x, z) + 0.3 + Math.pow(rnd(), 1.7) * 7.5;
    p.add(x, y, z, 0.55 + rnd() * 0.55, rnd() < 0.012 ? 1 + Math.floor(rnd() * 3) : 0);
  }
}

// ── 1 · Vergi ve Mali Müşavirlik: masada yelpaze gibi açılmış defter ve beyan yaprakları.
//    Her yaprak ayrı görünür: kenarı belirgin, üstteki yaprağın altında kalan kısmı çizilmez (nokta bulutunda örtme yok;
//    yoksa yapraklar üst üste binip tek bir kutu gibi görünüyordu). En üstteki defter sayfası: başlık, mavi satır çizgileri,
//    kırmızı kenar boşluğu ve tutar sütunları, yeşil toplam, kıvrık köşe; alttakilerde başlık/form kutusu.
function ledger(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const i0 = p.n;
  const W = 8.2; // yaprak genişliği (x)
  const D = 5.6; // yaprak derinliği (z)
  // yelpaze: yapraklar bir köşeden (K) aynı noktaya tutturulmuş gibi döner; alttakiler üstteki sayfanın yanında açığa çıkar
  const top = { c: [-0.2, 0.25, 0.7], ry: -0.05 };
  const K = [top.c[0] + (W / 2) * Math.cos(top.ry) - (D / 2) * Math.sin(top.ry), top.c[2] + (W / 2) * Math.sin(top.ry) + (D / 2) * Math.cos(top.ry)];
  const sheets = [0.5, 0.33, 0.16, top.ry].map((ry, k) => {
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const c = [K[0] - ((W / 2) * cs - (D / 2) * sn), top.c[1] - (3 - k) * 0.6, K[1] - ((W / 2) * sn + (D / 2) * cs)];
    return { c, ry, cs, sn };
  });
  const local = (S, x, z) => {
    const dx = x - S.c[0];
    const dz = z - S.c[2];
    return [dx * S.cs + dz * S.sn, -dx * S.sn + dz * S.cs];
  };
  const P = (S, x, z, lift = 0) => [S.c[0] + x * S.cs - z * S.sn, S.c[1] + lift, S.c[2] + x * S.sn + z * S.cs];
  // k. yaprağın noktası, üstündeki yaprakların altında kalıyorsa görünmez
  const visFor = (k) => (x, _y, z) => {
    for (let j = k + 1; j < sheets.length; j++) {
      const [lx, lz] = local(sheets[j], x, z);
      if (Math.abs(lx) < W / 2 + 0.06 && Math.abs(lz) < D / 2 + 0.06) return false;
    }
    return true;
  };
  const last = sheets.length - 1;
  sheets.forEach((S, k) => {
    const vis = visFor(k);
    const top = k === last;
    if (!top) {
      // alttaki yapraklar: yalnızca açıkta kalan kenar ve birkaç satır
      d.polyVis([P(S, -W / 2, -D / 2), P(S, W / 2, -D / 2), P(S, W / 2, D / 2), P(S, -W / 2, D / 2)], vis, { s: 1.15, d: 2.2 }, true);
      d.lineVis(P(S, -W / 2 + 0.5, -D / 2 + 0.55), P(S, W / 2 - 0.5, -D / 2 + 0.55), vis, { s: 0.95, d: 1.1 });
      if (k === last - 1) {
        // beyan formu: başlık altında kutucuklar
        for (let i = 0; i < 3; i++) {
          const x0 = -W / 2 + 0.5 + i * 1.05;
          d.polyVis([P(S, x0, -D / 2 + 0.85), P(S, x0 + 0.8, -D / 2 + 0.85), P(S, x0 + 0.8, -D / 2 + 1.45), P(S, x0, -D / 2 + 1.45)], vis, { t: 1, s: 0.95, d: 1.4 }, true);
        }
      }
      for (let r = 0; r < 7; r++) {
        const z = -D / 2 + 1.1 + r * 0.62;
        d.lineVis(P(S, -W / 2 + 0.5, z), P(S, W / 2 - 0.5, z), vis, { s: 0.8, d: 0.45, t: k === 1 ? 1 : 0 });
      }
      return;
    }
    // üstteki defter sayfası — sağ arka köşesi kıvrık
    const f = 0.95;
    const e = { s: 1.25, d: 2.6 };
    d.poly([P(S, -W / 2, -D / 2), P(S, W / 2 - f, -D / 2), P(S, W / 2, -D / 2 + f), P(S, W / 2, D / 2), P(S, -W / 2, D / 2)], e, true);
    d.poly([P(S, W / 2 - f, -D / 2, 0.02), P(S, W / 2 - f + 0.08, -D / 2 + f - 0.08, 0.22), P(S, W / 2, -D / 2 + f, 0.02)], { s: 1.05, d: 2.2 });
    // başlık: iki kalın çizgi
    d.line(P(S, -W / 2 + 0.6, -D / 2 + 0.55), P(S, 0.6, -D / 2 + 0.55), { s: 1.15, d: 1.8 });
    d.line(P(S, -W / 2 + 0.6, -D / 2 + 0.85), P(S, -0.6, -D / 2 + 0.85), { s: 0.95, d: 1.2 });
    // kenar boşluğu (kırmızı) ve iki tutar sütunu (kırmızı) — muhasebe defteri
    const zTop = -D / 2 + 1.25;
    const zBot = D / 2 - 0.35;
    d.line(P(S, -W / 2 + 1.05, zTop - 0.15), P(S, -W / 2 + 1.05, zBot), { t: 2, s: 0.95, d: 1.0 });
    d.line(P(S, W / 2 - 2.5, zTop - 0.15), P(S, W / 2 - 2.5, zBot), { t: 2, s: 0.95, d: 1.0 });
    d.line(P(S, W / 2 - 1.25, zTop - 0.15), P(S, W / 2 - 1.25, zBot), { t: 2, s: 0.95, d: 1.0 });
    // satırlar (mavi) + tutarlar
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const z = zTop + r * ((zBot - zTop) / (rows - 1));
      d.line(P(S, -W / 2 + 0.4, z), P(S, W / 2 - 0.4, z), { t: 1, s: 0.85, d: 0.55 });
      if (r < rows - 1) {
        const zz = z + 0.32;
        const len = 1.4 + ((r * 7) % 5) * 0.45;
        d.line(P(S, -W / 2 + 1.35, zz, 0.01), P(S, -W / 2 + 1.35 + len, zz, 0.01), { s: 0.95, d: 0.65 });
        if (r % 3 !== 2) d.line(P(S, W / 2 - 2.3, zz, 0.01), P(S, W / 2 - 1.45, zz, 0.01), { s: 1.0, d: 1.1 });
        if (r % 2 === 0) d.line(P(S, W / 2 - 1.05, zz, 0.01), P(S, W / 2 - 0.55, zz, 0.01), { s: 1.0, d: 1.1 });
      }
    }
    // toplam: tutar sütununda çift çizgi (yeşil)
    const zSum = zBot - 0.12;
    d.line(P(S, W / 2 - 2.3, zSum, 0.01), P(S, W / 2 - 0.3, zSum, 0.01), { t: 3, s: 1.05, d: 1.4 });
    d.line(P(S, W / 2 - 2.3, zSum - 0.12, 0.01), P(S, W / 2 - 0.3, zSum - 0.12, 0.01), { t: 3, s: 1.05, d: 1.4 });
  });
  d.done(Nf);
  // yapraklar kameraya doğru eğilir (X ekseni çevresinde): yüzeyleri üstten bakışta ince bir şeride dönüşmesin, satırlar okunsun
  const ct = Math.cos(0.5);
  const st = Math.sin(0.5);
  for (let i = i0; i < p.n; i++) {
    const y = p.y[i];
    const z = p.z[i];
    p.y[i] = y * ct - z * st;
    p.z[i] = y * st + z * ct;
  }
}

// ── 2 · Denetim ve Raporlama: denetim dosyası. Önde bir finansal tablo, arkasında başka bir yaprak; örneklenen satırlarda
//    denetçi tikleri (mavi · kırmızı · yeşil), altta rapor çubukları; öndeki yaprağın üzerinde büyüteç — merceğin içinde
//    satırlar büyür ve kontrol tiki görünür. (Önceden 3B örnekleme kafesiydi; ilk bakışta denetim olarak okunmuyordu.)
function sampling(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  // öndeki yaprak (kameraya bakar) ve arkadaki yaprak (sol üste kaymış)
  const F = { x0: -2.6, x1: 2.8, y0: -3.6, y1: 3.4, z: 0.3 };
  const B = { x0: -4.3, x1: 1.1, y0: -2.6, y1: 4.3, z: -1.0 };
  // büyüteç
  const L = { x: 1.2, y: 0.5, z: 1.5, r: 1.6 };
  const M = 1.6; // büyütme
  const outF = (x, y) => !(x > F.x0 - 0.1 && x < F.x1 + 0.1 && y > F.y0 - 0.1 && y < F.y1 + 0.1);
  const outLens = (x, y) => (x - L.x) ** 2 + (y - L.y) ** 2 > (L.r + 0.28) ** 2;
  const inLens = (x, y) => (x - L.x) ** 2 + (y - L.y) ** 2 < (L.r - 0.12) ** 2;
  const visB = (x, y) => outF(x, y);
  const visF = (x, y) => outLens(x, y);
  const tick = (x, y, z, sc, t) => d.poly([[x, y, z], [x + 0.2 * sc, y - 0.26 * sc, z], [x + 0.66 * sc, y + 0.4 * sc, z]], { t, s: 1.4, d: 3.2, j: 0.012 });
  // arka yaprak: yalnızca öndekinin dışında kalan kısmı
  d.polyVis([[B.x0, B.y0, B.z], [B.x1, B.y0, B.z], [B.x1, B.y1, B.z], [B.x0, B.y1, B.z]], visB, { s: 1.1, d: 2.0 }, true);
  d.lineVis([B.x0 + 0.5, B.y1 - 0.55, B.z], [B.x1 - 0.5, B.y1 - 0.55, B.z], visB, { s: 1.0, d: 1.3 });
  for (let r = 0; r < 10; r++) {
    const y = B.y1 - 1.2 - r * 0.58;
    d.lineVis([B.x0 + 0.45, y, B.z], [B.x0 + 1.5 + (r % 3) * 0.35, y, B.z], visB, { s: 0.85, d: 0.8 });
  }
  // öndeki yaprak: kenar, başlık
  d.polyVis([[F.x0, F.y0, F.z], [F.x1, F.y0, F.z], [F.x1, F.y1, F.z], [F.x0, F.y1, F.z]], visF, { s: 1.2, d: 2.4 }, true);
  d.line([F.x0 + 0.55, F.y1 - 0.6, F.z], [F.x0 + 3.4, F.y1 - 0.6, F.z], { s: 1.2, d: 2.0 });
  d.line([F.x0 + 0.55, F.y1 - 0.95, F.z], [F.x0 + 2.2, F.y1 - 0.95, F.z], { s: 0.95, d: 1.2 });
  // satırlar: kalem adı + tutar (mercek altındakiler merceğin içinde büyür)
  const rows = [];
  for (let r = 0; r < 7; r++) rows.push(F.y1 - 1.6 - r * 0.6);
  const label = (r) => [F.x0 + 0.95, F.x0 + 2.3 + ((r * 5) % 4) * 0.42];
  const amount = [F.x1 - 1.75, F.x1 - 0.45];
  rows.forEach((y, r) => {
    const [la, lb] = label(r);
    d.lineVis([la, y, F.z], [lb, y, F.z], visF, { s: 0.9, d: 0.9 });
    d.lineVis([amount[0], y, F.z], [amount[1], y, F.z], visF, { s: 1.0, d: 1.1 });
  });
  // örneklenen satırlarda denetçi tikleri (sol kenarda, sırayla mavi · kırmızı · yeşil)
  [[0, 1], [2, 2], [5, 3]].forEach(([r, t]) => tick(F.x0 + 0.22, rows[r] + 0.05, F.z + 0.02, 0.85, t));
  // toplam (çift çizgi) ve rapor çubukları
  const ySum = rows[rows.length - 1] - 0.45;
  d.lineVis([amount[0], ySum, F.z], [amount[1], ySum, F.z], visF, { t: 3, s: 1.05, d: 1.4 });
  d.lineVis([amount[0], ySum - 0.13, F.z], [amount[1], ySum - 0.13, F.z], visF, { t: 3, s: 1.05, d: 1.4 });
  const yBase = F.y0 + 0.45;
  d.line([F.x0 + 0.55, yBase, F.z], [F.x0 + 3.6, yBase, F.z], { s: 0.9, d: 1.0 });
  [0.55, 0.9, 0.7, 1.15, 1.35].forEach((h, i) => {
    const x = F.x0 + 0.75 + i * 0.6;
    d.rect([x + 0.16, yBase + h / 2, F.z], X, Y, 0.32, h, { t: i === 4 ? 3 : 1, s: 1.0, d: 1.3 });
  });
  // büyüteç: çift çerçeve, sap
  d.circle([L.x, L.y, L.z], X, Y, L.r, { s: 1.25, d: 2.2 });
  d.circle([L.x, L.y, L.z], X, Y, L.r + 0.22, { s: 1.1, d: 1.6 });
  const ang = -0.9;
  const hd = [Math.cos(ang), Math.sin(ang), 0.12];
  const h0 = [L.x + Math.cos(ang) * (L.r + 0.22), L.y + Math.sin(ang) * (L.r + 0.22), L.z];
  const h1 = v3.add(h0, v3.mul(hd, 2.7));
  const hs = [-Math.sin(ang), Math.cos(ang), 0];
  for (const o of [-0.16, 0, 0.16]) d.line(v3.add(h0, v3.mul(hs, o)), v3.add(h1, v3.mul(hs, o)), { s: 1.1, d: 1.3 });
  d.line(v3.add(h1, v3.mul(hs, -0.16)), v3.add(h1, v3.mul(hs, 0.16)), { s: 1.1, d: 2.0 });
  // merceğin içi: altındaki satırlar büyümüş hâlde (yalnızca mercek dairesinin içinde), kontrol tiki
  const zl = L.z - 0.1;
  const mag = (x, y) => [L.x + (x - L.x) * M, L.y + (y - L.y) * M];
  const inL = (x, y) => inLens(x, y);
  const CHECKED = 2; // merceğin altındaki, kontrol edilen satır
  rows.forEach((y, r) => {
    const [la, lb] = label(r);
    for (const [xa, xb] of r === CHECKED ? [amount] : [[la, lb], amount]) {
      const [ax, ay] = mag(xa, y);
      const [bx] = mag(xb, y);
      if (Math.abs(ay - L.y) < L.r) d.lineVis([ax, ay, zl], [bx, ay, zl], inL, { s: 1.15, d: 1.6 });
    }
  });
  // büyük kontrol tiki: kontrol edilen satırın büyümüş tutarının solunda
  const [, cy] = mag(0, rows[CHECKED]);
  tick(L.x - 1.3, cy - 0.12, zl + 0.02, 1.15, 3);
  d.done(Nf);
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

/* ───────────────────────── kayıt defteri ───────────────────────── */
// Kamera pozu: formasyon sahnenin ortasındadır (x=0). Kamera sola kayar (düz çeviri, açı yok) → formasyon ekranın sağ yarısında görünür.
// Yeni şekiller (x ∈ ±6,5, y ∈ ±4,2) için ortak başlangıç pozu; şekle göre dx (sağa kaydırma), dy (kamera yüksekliği), dz (uzaklık), ly (bakış yüksekliği).
// Kahramanda başlık solda durduğu için şekil sağ yarının ortasına (≈ %72) yerleşir; uzun başlıklı sayfalarda dx ile biraz daha sağa alınır.
const POSE = ({ dx = 0, dy = 0, dz = 0, ly = 0, bright = 1.55 } = {}) => ({ pos: [-6.6 - dx, 2.0 + dy, 21.4 + dz], look: [-6.6 - dx, 0.2 + ly, 0], fov: 44, bright });

// spin: sürekli dönüş çarpanı (0 = dönmez). sway: >0 ise dönmek yerine ±sway rad salınır (düzlemsel şekiller yandan ince görünmesin).
// view: mürekkep alanı (2B) için başlangıç bakışı — pitch: öne eğim (rad), yaw: sağa dönüş (rad), zoom: boyut çarpanı.
export const FORMATIONS = [
  { id: 'ufuk', build: horizon, spin: 0, pose: { pos: [0, 2.2, 16.5], look: [0, -1.5, -14], fov: 48, bright: 1.45 }, figure: 'Ufuk — veri arazisi' },
  { id: 'rakamlar', build: rakamlar, spin: 0, sway: 0.4, pose: POSE({ dz: 0.6 }), figure: 'Beyan rakamları — matrah, oran ve hesaplanan vergi', view: { pitch: 0.06, yaw: -0.2 } },
  { id: 'ornekleme', build: sampling, spin: 0, sway: 0.4, pose: { pos: [-5.1, 2.2, 22.0], look: [-5.1, 0.2, 0], fov: 44, bright: 1.55 }, figure: 'Denetim dosyası — finansal tablo, büyüteç ve denetçi tikleri', view: { pitch: 0.06, yaw: -0.18 } },
  { id: 'defter', build: ledger, spin: 0, sway: 0.35, pose: { pos: [-6.2, 8.2, 21.4], look: [-6.2, -0.1, 0], fov: 44, bright: 1.6 }, figure: 'Defter ve beyan yaprakları — kayıt düzeni, tutar sütunları', view: { pitch: 0.2, yaw: -0.2 } },
  { id: 'agac', build: agac, spin: 0.6, pose: POSE({ dy: 0.4, dz: 0.8, ly: 0.3 }), figure: 'Karar ağacı — seçenekler, senaryolar ve sonuçlar', view: { pitch: 0.1, yaw: 0 } },
  { id: 'tesvik', build: tesvik, spin: 0, sway: 0.45, pose: POSE({ dz: 0.6 }), figure: 'Destek basamakları — teşvik, hibe ve yatırım', view: { pitch: 0.08, yaw: -0.25 } },
  { id: 'hukuk', build: hukuk, spin: 0, sway: 0.45, pose: POSE({ dz: 0.4 }), figure: 'Hukuki çerçeve — kanun maddesi ve karar', view: { pitch: 0.06, yaw: 0.2 } },
  // sektörlerde solda: lx = sol kaydırma kazancı, ls = sol uzaklık çarpanı
  { id: 'katman', build: strata, spin: 1, pose: { pos: [-6.4, 1.5, 23.5], look: [-6.4, -1.9, 0], fov: 44, bright: 1.6, lx: 1.5, ls: 1.12 }, figure: 'Veri katmanları — sistem ve raporlama', view: { pitch: 0.3, yaw: -0.35 } },
  { id: 'sutunlar', build: okul, spin: 0, sway: 0.5, pose: POSE({ dy: 0.6, dz: 1.4, ly: 0.2 }), figure: 'Akademi — antik okul binası: sütunlar, kiriş ve alınlık', view: { pitch: 0.12, yaw: -0.3 } },
  { id: 'kapi', build: gate, spin: 0, sway: 0.2, pose: { pos: [-8.0, -0.2, 19.5], look: [-8.0, -1.0, 0], fov: 48, bright: 1.45 }, figure: 'Kapı — görüşmeye açılan yol', view: { pitch: 0.12, yaw: -0.2 } },
  { id: 'halka', build: ring, spin: 1, pose: { pos: [-5.1, 6.4, 17.9], look: [-5.1, -1.4, 0], fov: 44, bright: 1.55 }, figure: 'Yıl halkası — on iki aylık bordro döngüsü', view: { pitch: 0.45, yaw: 0 } },
  // ── sektörler (src/data/sectors.json › her sektörün ilk konu başlığı)
  { id: 'kayip', build: kayip, spin: 0, sway: 0.5, pose: POSE({ dy: 0.4 }), figure: 'Kayıp dağılımı — beklenen kredi zararı ve kuyruk riski', view: { pitch: 0.1, yaw: -0.25 } },
  { id: 'maliyet', build: maliyet, spin: 0, sway: 0.5, pose: POSE(), figure: 'Maliyet akışı — hammadde, işçilik ve genel üretim gideri', view: { pitch: 0.1, yaw: 0.2 } },
  { id: 'varlik', build: varlik, spin: 0, sway: 0.5, pose: POSE(), figure: 'Varlık ömrü — aktifleştirme, amortisman ve değer düşüklüğü', view: { pitch: 0.12, yaw: -0.2 } },
  { id: 'sube', build: sube, spin: 1, pose: POSE({ dy: 3.2, dz: -1.5, ly: -1.0 }), figure: 'Şube ağı — merkez kayda bağlanan çok noktalı yapı', view: { pitch: 0.55, yaw: 0 } },
  { id: 'edim', build: edim, spin: 0, sway: 0.45, pose: POSE({ ly: 0.4 }), figure: 'Edimler — sözleşmenin zamana yayılan gelir dilimleri', view: { pitch: 0.05, yaw: -0.25 } },
  { id: 'alacak', build: alacak, spin: 0, sway: 0.5, pose: POSE(), figure: 'Alacak akışı — hasta, özel sigorta ve kurum gelirleri', view: { pitch: 0.1, yaw: 0.2 } },
  { id: 'hakedis', build: hakedis, spin: 0, sway: 0.5, pose: POSE(), figure: 'Hakediş eğrisi — yıllara yaygın işte ilerleme', view: { pitch: 0.1, yaw: -0.25 } },
  { id: 'sezon', build: sezon, spin: 0, sway: 0.5, pose: POSE(), figure: 'Sezon eğrisi — aylık gelir ve sabit gider', view: { pitch: 0.1, yaw: 0.2 } },
  { id: 'uc-halka', build: ucHalka, spin: 0, sway: 0.5, pose: POSE({ dy: -0.2 }), figure: 'Üç halka — aile, mülkiyet ve işletme', view: { pitch: 0, yaw: 0 } },
  { id: 'savunma', build: savunma, spin: 1, pose: POSE({ dy: 1.0 }), figure: 'Üç savunma hattı — yönetim, risk ve uyum, iç denetim', view: { pitch: 0.25, yaw: 0.1 } },
  // ── hizmet kavramları (src/data/content.json › hizmet adları ve açıklamaları)
  { id: 'terazi', build: terazi, spin: 0, sway: 0.5, pose: POSE({ dy: 0.2 }), figure: 'Terazi — bağımsızlık ve denge', view: { pitch: 0.08, yaw: 0 } },
  { id: 'bilanco', build: bilanco, spin: 0, sway: 0.5, pose: POSE(), figure: 'Bilanço — aktif ile pasifin dengesi', view: { pitch: 0.1, yaw: -0.2 } },
  { id: 'muhur', build: muhur, spin: 0, sway: 0.55, pose: POSE(), figure: 'Mühür — tasdik ve onaylı belge', view: { pitch: 0.05, yaw: 0.35 } },
  { id: 'mutabakat', build: mutabakat, spin: 0, sway: 0.45, pose: POSE(), figure: 'Mutabakat — karşılıklı kayıtların eşleşmesi', view: { pitch: 0.05, yaw: -0.15 } },
  { id: 'dilimler', build: dilimler, spin: 0, sway: 0.5, pose: POSE(), figure: 'Dilimler — kademeli oran ve hesap', view: { pitch: 0.12, yaw: -0.25 } },
  { id: 'kdv-zinciri', build: kdvZinciri, spin: 0, sway: 0.5, pose: POSE(), figure: 'KDV zinciri — yüklenilen ve hesaplanan vergi', view: { pitch: 0.1, yaw: 0.2 } },
  { id: 'nakit', build: nakit, spin: 0, sway: 0.5, pose: POSE(), figure: 'Akış şelalesi — başlangıçtan kapanışa kalem kalem değişim', view: { pitch: 0.1, yaw: -0.2 } },
  { id: 'rasyo', build: rasyo, spin: 1, pose: POSE({ dy: 1.2, ly: -0.4 }), figure: 'Rasyo radarı — finansal oranların dengesi', view: { pitch: 0.3, yaw: 0 } },
  { id: 'hile', build: hile, spin: 0, sway: 0.4, pose: POSE(), figure: 'Hile üçgeni — baskı, fırsat, gerekçelendirme', view: { pitch: 0.05, yaw: 0.2 } },
  { id: 'kup', build: kup, spin: 1, pose: POSE({ dz: 1.2 }), figure: 'Veri küpü — boyutlara göre dilimlenen veri', view: { pitch: 0.35, yaw: 0.5 } },
  { id: 'akis', build: akis, spin: 0, sway: 0.35, pose: POSE(), figure: 'Süreç akışı — adım, karar ve kontrol noktası', view: { pitch: 0.05, yaw: -0.15 } },
  { id: 'pay', build: pay, spin: 1, pose: POSE({ dy: 1.4, ly: -0.3 }), figure: 'Pay dağılımı — ortaklık ve sermaye yapısı', view: { pitch: 0.5, yaw: 0 } },
  // ── sayfa türleri (hizmetler, sektörler, ekip, bilgi merkezi, araçlar, takvim, kariyer, iletişim, arama, arşiv, sözlük, yasal)
  { id: 'petek', build: petek, spin: 1, pose: POSE({ dy: 2.6, dz: 0.8, ly: -0.9 }), figure: 'Hizmet alanları — sekiz alan, altmış hizmet başlığı', view: { pitch: 0.85, yaw: 0 } },
  // matris ana sayfanın Sektörler bandında solda da durur (lx/ls: katman ile aynı sol yerleşim)
  { id: 'matris', build: matris, spin: 0, sway: 0.5, pose: { ...POSE({ dy: 1.8, ly: -0.6 }), lx: 1.5, ls: 1.12 }, figure: 'Sektör ve hizmet alanı — her sektörde öne çıkan hizmetler', view: { pitch: 0.8, yaw: 0.12 } },
  { id: 'ag', build: ag, spin: 0, sway: 0.45, pose: POSE({ dz: 1.0 }), figure: 'Uzmanlık ağı — kişiler ve çalıştıkları alanlar', view: { pitch: 0.05, yaw: 0 } },
  { id: 'yayin', build: yayin, spin: 0, sway: 0.45, pose: POSE(), figure: 'Yayınlar — sirküler, duyuru, blog ve haber', view: { pitch: 0.08, yaw: -0.15 } },
  { id: 'kitap', build: kitap, spin: 0, sway: 0.4, pose: POSE({ dy: 0.6 }), figure: 'Okuma notları — kitaplardan alınan notlar', view: { pitch: 0.3, yaw: 0 } },
  { id: 'abakus', build: abakus, spin: 0, sway: 0.35, pose: POSE({ dz: 1.0 }), figure: 'Abaküs — kalem kalem hesap', view: { pitch: 0.05, yaw: -0.3 } },
  { id: 'takvim', build: takvim, spin: 0, sway: 0.4, pose: POSE({ dz: 0.8 }), figure: 'Takvim — aylara yayılan beyan ve ödeme günleri', view: { pitch: 0.1, yaw: -0.2 } },
  { id: 'basvuru', build: basvuru, spin: 0, sway: 0.35, pose: POSE({ dz: 0.8 }), figure: 'Başvuru yolu — adım adım daralan kapılar', view: { pitch: 0.1, yaw: 0.7 } },
  { id: 'yonlendirme', build: yonlendirme, spin: 0, sway: 0.45, pose: POSE({ dz: 0.8 }), figure: 'Yönlendirme — mesajınız konuya göre ilgili alana ulaşır', view: { pitch: 0.05, yaw: 0.1 } },
  { id: 'arama', build: arama, spin: 0, sway: 0.4, pose: POSE({ dz: 1.0 }), figure: 'Arama — sitedeki sayfalar arasında eşleşenler', view: { pitch: 0.04, yaw: -0.2 } },
  { id: 'arsiv', build: arsiv, spin: 0, sway: 0.5, pose: POSE(), figure: 'Arşiv — yıllara göre sirküler dosyaları', view: { pitch: 0.12, yaw: 0.35 } },
  { id: 'sozluk', build: sozluk, spin: 1, pose: POSE({ dz: 1.0 }), figure: 'Sözlük — birbirine bağlı terimler', view: { pitch: 0.2, yaw: 0 } },
  { id: 'gizlilik', build: gizlilik, spin: 0, sway: 0.5, pose: POSE({ dz: 1.0 }), figure: 'Gizlilik — kişisel verinin korunması', view: { pitch: 0.05, yaw: 0.25 } },
  // 43… — sonradan eklenenler (sıra kalıcıdır; yenisi hep sona)
  { id: 'sure', build: sure, spin: 0, sway: 0.45, pose: POSE({ dz: 0.8 }), figure: 'Hizmet süreleri — yıllara yayılan çalışma ve sigortalılık dönemleri', view: { pitch: 0.1, yaw: -0.25 } },
  { id: 'soru', build: soru, spin: 0, sway: 0.4, pose: POSE({ dx: 0.7, dz: 1.6 }), figure: 'Sorular — başlıklara göre toplanan sorular ve yanıtlar', view: { pitch: 0.05, yaw: -0.2 } },
  { id: 'yazit', build: yazit, spin: 0, sway: 0.5, pose: POSE({ dy: 0.5, dz: 0.6 }), figure: 'Yazıt — Orhun Abideleri tarzında dikili taşlar', view: { pitch: 0.08, yaw: -0.32 } },
  // Hukuk ve Teşvik hizmetleri (Ekim 2026; shapes-legal.js)
  { id: 'sozlesme', build: sozlesme, spin: 0, sway: 0.4, pose: POSE({ dz: 0.6 }), figure: 'Sözleşme — maddeler, imzalar ve kalem', view: { pitch: 0.05, yaw: -0.2 } },
  { id: 'sicil', build: sicil, spin: 0, sway: 0.4, pose: POSE({ dz: 0.6 }), figure: 'Ticaret sicili — gazete ilanı ve tescil mührü', view: { pitch: 0.05, yaw: 0.2 } },
  { id: 'arabulucu', build: arabulucu, spin: 0, sway: 0.5, pose: POSE({ dz: 0.4 }), figure: 'Arabuluculuk masası — taraflar, arabulucu ve iş kanunları', view: { pitch: 0.12, yaw: -0.25 } },
  { id: 'uyusmazlik', build: uyusmazlik, spin: 0, sway: 0.4, pose: POSE({ dz: 0.6 }), figure: 'Vergi uyuşmazlığı — ihbarnameden uzlaşma ya da dava yoluna', view: { pitch: 0.05, yaw: -0.15 } },
  { id: 'kvkk', build: kvkk, spin: 0, sway: 0.45, pose: POSE({ dz: 0.6 }), figure: 'KVKK uyumu — veri envanteri ve koruma kalkanı', view: { pitch: 0.06, yaw: -0.25 } },
  { id: 'icra', build: icra, spin: 0, sway: 0.45, pose: POSE({ dy: 0.6, dz: 0.8 }), figure: 'Alacak takibi — vadesi geçen fatura, ihtar, arabuluculuk, icra ve tahsil', view: { pitch: 0.15, yaw: -0.2 } },
  { id: 'kurulus', build: kurulus, spin: 0, sway: 0.45, pose: POSE({ dy: 0.6, dz: 1.2, ly: 0.4 }), figure: 'Şirket kuruluşu — temel, katlar ve yerine inen «A.Ş.»', view: { pitch: 0.12, yaw: -0.3 } },
  { id: 'belge', build: belge, spin: 0, sway: 0.4, pose: POSE({ dz: 0.6 }), figure: 'Yatırım teşvik belgesi — belge, mühür ve fabrika', view: { pitch: 0.06, yaw: -0.2 } },
  { id: 'proje', build: proje, spin: 0, sway: 0.4, pose: POSE({ dz: 0.6 }), figure: 'Proje iş planı — iş paketleri, takvim ve kilometre taşları', view: { pitch: 0.05, yaw: -0.2 } },
  { id: 'arge', build: arge, spin: 0, sway: 0.5, pose: POSE({ dz: 0.4 }), figure: 'Ar-Ge — fikir ampulü ve dişli', view: { pitch: 0.1, yaw: 0 } },
  { id: 'hibe', build: hibe, spin: 0, sway: 0.45, pose: POSE({ dz: 0.4 }), figure: 'AB hibesi — on iki yıldız, avro ve başvuru dosyası', view: { pitch: 0.08, yaw: -0.15 } },
  { id: 'istihdam', build: istihdam, spin: 0, sway: 0.4, pose: POSE({ dy: 0.8, dz: 0.8, ly: -0.3 }), figure: 'İstihdam teşviki — yeni koltuklar ve prim desteği', view: { pitch: 0.25, yaw: -0.2 } },
  { id: 'ihracat', build: ihracat, spin: 0, sway: 0.4, pose: POSE({ dz: 0.8 }), figure: 'İhracat — dünya, rota ve konteyner', view: { pitch: 0.12, yaw: -0.2 } },
];

/** Kimlik → sahne sıra numarası. Şablonlar/rotalar sahneyi buradan adıyla seçer (data-world = sıra numarası). */
export const SCENE = Object.fromEntries(FORMATIONS.map((f, i) => [f.id, i]));
export const FORMATION_COUNT = FORMATIONS.length;
export const POSES = FORMATIONS.map((f) => f.pose);
export const SPIN = FORMATIONS.map((f) => f.spin ?? 1);
export const SWAY = FORMATIONS.map((f) => f.sway ?? 0);
export const FIGURES = FORMATIONS.map((f) => f.figure || '');

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

// sabit "toz": her formasyonda aynı yerde, sönük (N ve tohuma göre; formasyondan bağımsız)
function makeDust(N, Nf, seed) {
  const Nd = N - Nf;
  const dr = mulberry32(seed ^ 0x9e3779b9);
  const dust = { pos: new Float32Array(Nd * 3), size: new Float32Array(Nd) };
  for (let i = 0; i < Nd; i++) {
    dust.pos[i * 3] = (dr() - 0.5) * 70;
    dust.pos[i * 3 + 1] = (dr() - 0.5) * 24;
    dust.pos[i * 3 + 2] = -30 + dr() * 55;
    dust.size[i] = 0.5 + dr() * 0.6;
  }
  return dust;
}

/** k numaralı formasyonu üretir: {pos(3N), size(N), tint(N), pose, id, name, nf}. İlk nf nokta şekil, kalanı toz. */
export function buildFormation(k, N, seed = 20260101, dust = null) {
  const F = FORMATIONS[k];
  if (!F) throw new RangeError(`formasyon yok: ${k}`);
  const Nf = Math.floor(N * 0.9);
  const dst = dust || makeDust(N, Nf, seed);
  const rnd = mulberry32(seed + k * 7919);
  const p = new Pts();
  F.build(p, rnd, Nf);
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
  pos.set(dst.pos, Nf * 3);
  size.set(dst.size, Nf);
  return { pos, size, tint, pose: F.pose, id: F.id, name: F.build.name, nf: Nf };
}

/** Tüm formasyonları üretir (testler ve küçük N için). Canlı dünya lazyFormations kullanır. */
export function buildFormations(N, seed = 20260101) {
  const dust = makeDust(N, Math.floor(N * 0.9), seed);
  return FORMATIONS.map((_, k) => buildFormation(k, N, seed, dust));
}

/** Tembel dizi: F[k] ilk erişimde üretilir (tüm formasyonlar açılışta üretilmez). */
export function lazyFormations(N, seed = 20260101) {
  const cache = [];
  const dust = makeDust(N, Math.floor(N * 0.9), seed);
  return new Proxy(cache, {
    get(t, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        const k = Number(key);
        if (k < FORMATIONS.length) return (t[k] ??= buildFormation(k, N, seed, dust));
      }
      if (key === 'length') return FORMATIONS.length;
      return Reflect.get(t, key);
    },
  });
}
