
// Sektör formasyonları — her biri, ilgili sektör sayfasının ilk başlığındaki muhasebe/denetim temasını çizer
// (src/data/sectors.json › topics). Saf hesaplama; yerleşim: x ∈ [−6.5, 6.5], y ∈ [−4.2, 4.2], z ∈ [−3.5, 3.5].
import { Draw, X, Y, Z, TAU, v3 } from './draw.js';

const smooth = (u) => u * u * (3 - 2 * u);
const sig = (x) => 1 / (1 + Math.exp(-x));

/* ── Finansal Hizmetler — «Finansal araçlar ve beklenen kredi zararları»: sağa yatık kayıp dağılımı; kuyruk (güven düzeyi ötesi) kırmızı */
export function kayip(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const bins = 30;
  const f = (u) => Math.pow(Math.max(u, 0.001), 1.6) * Math.exp(-5.4 * u);
  const peak = f(1.6 / 5.4);
  const H = 5.5;
  const floor = -4.0;
  const varU = 0.62;
  for (let i = 0; i < bins; i++) {
    const u = (i + 0.5) / bins;
    const h = Math.max(0.14, (H * f(u)) / peak);
    const x = -6 + 12 * u;
    const t = u >= varU ? 2 : u > 0.3 ? 1 : 0;
    d.box([x, floor + h / 2, 0], [0.34, h, 2.4], { t, s: 0.85 }, { front: Math.max(1, Math.round(h * 0.55)) });
  }
  // sürekli eğri (ön ve arka düzlemde) + taban
  for (const z of [-1.45, 1.45]) d.curve((u) => [-6 + 12 * u, floor + (H * f(u)) / peak + 0.04, z], { s: 1.0, d: 1.5 }, 120);
  d.line([-6.6, floor, 0], [6.6, floor, 0], { s: 1.1, d: 1.6 });
  d.line([-6.6, floor, 1.45], [6.6, floor, 1.45], { s: 0.8, d: 0.8 });
  d.line([-6.6, floor, -1.45], [6.6, floor, -1.45], { s: 0.8, d: 0.8 });
  // güven düzeyi düzlemi (VaR): kuyruğu gövdeden ayırır
  const xv = -6 + 12 * varU;
  d.rect([xv, -0.45, 0], Z, Y, 3.4, 7.1, { t: 3, s: 1.0, d: 1.3 });
  d.hatch([xv, -0.45, 0], Z, Y, 3.4, 7.1, 4, { t: 3, s: 0.7, d: 0.45 });
  // beklenen kayıp işareti (ortalama): ince dikey çizgi
  d.line([-6 + 12 * 0.34, floor, 0], [-6 + 12 * 0.34, floor + H * 1.12, 0], { t: 1, s: 1.1, d: 1.2 });
  d.node([-6 + 12 * 0.34, floor + H * 1.12, 0], 0.22, 14, { t: 1 });
  d.done(Nf);
}

/* ── Üretim ve Sanayi — «Maliyet muhasebesi ve stok değerleme»: hammadde, işçilik ve genel üretim gideri tek bir mamul maliyetinde birikir */
export function maliyet(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const tx = 3.2;
  const floor = -4.0;
  // maliyet kulesi: dört kat (hammadde, işçilik, genel üretim gideri, mamul maliyeti)
  const layers = [
    { y0: -4.0, y1: -1.6, t: 1 },
    { y0: -1.5, y1: 0.2, t: 0 },
    { y0: 0.3, y1: 1.6, t: 3 },
    { y0: 1.7, y1: 2.15, t: 2 },
  ];
  for (const L of layers) {
    const h = L.y1 - L.y0;
    d.box([tx, (L.y0 + L.y1) / 2, 0], [3.0, h, 2.6], { t: L.t, s: 0.95 }, { front: Math.max(3, Math.round(h * 2.6)), back: 2, top: 3, right: 2 });
  }
  d.rect([tx, floor - 0.12, 0], X, Z, 4.4, 3.8, { s: 1.0, d: 1.1 });
  d.hatch([tx, floor - 0.12, 0], X, Z, 4.4, 3.8, 6, { s: 0.7, d: 0.6 });
  // girdi akışları: üç şerit kuleye katlarına karşılık gelen yükseklikte bağlanır
  const src = [
    { y: -3.0, z: 1.8, ye: -2.8, t: 1 },
    { y: -0.1, z: 0.1, ye: -0.65, t: 0 },
    { y: 2.9, z: -1.8, ye: 0.95, t: 3 },
  ];
  for (const s of src) {
    for (let k = -1; k <= 1; k++) {
      d.curve(
        (u) => {
          const e = smooth(u);
          return [-6.4 + (tx - 1.5 + 6.4) * u, s.y + (s.ye - s.y) * e, s.z * (1 - e) + k * 0.28 * (1 - 0.4 * e)];
        },
        { t: s.t, s: 0.9, d: 1.1 },
        90
      );
    }
    d.node([-6.4, s.y, s.z], 0.42, 26, { t: s.t });
  }
  // zemin hattı (üretim bandı)
  d.line([-6.8, floor, 0], [tx - 2.6, floor, 0], { s: 1.0, d: 0.8 });
  d.done(Nf);
}

/* ── Enerji ve Doğal Kaynaklar — «Yatırım dönemi maliyetleri ve aktifleştirme» + «Varlık değerleme ve değer düşüklüğü»:
      varlık değeri yatırım döneminde birikir, işletmede amortismanla azalır; bir değer düşüklüğü basamağı kırmızı */
export function varlik(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const hs = [0.8, 1.9, 3.1, 4.4, 5.2, 4.7, 4.2, 3.7, 1.9, 1.6, 1.3];
  const floor = -4.0;
  hs.forEach((h, i) => {
    const x = -6 + i * 1.2;
    const t = i < 4 ? 1 : i === 8 ? 2 : 0;
    d.box([x, floor + h / 2, 0], [0.84, h, 1.8], { t, s: 0.95 }, { front: Math.max(1, Math.round(h * 1.2)), top: 2 });
    // tüketilen değer: önceki yüksekliğe kadar seyrek hayalet çerçeve
    if (i >= 5) {
      const prev = i === 8 ? hs[7] : hs[i - 1];
      if (prev > h) d.rect([x, floor + (h + prev) / 2, 0.9], X, Y, 0.84, prev - h, { s: 0.7, d: 0.4, t: i === 8 ? 2 : 0 });
    }
  });
  // geri kazanılabilir tutar çizgisi
  d.line([-6.7, floor + 3.0, 1.0], [6.7, floor + 3.0, 1.0], { t: 3, s: 0.9, d: 0.8 });
  // değer düşüklüğü oku
  d.line([-6 + 8 * 1.2, floor + 3.7, 1.0], [-6 + 8 * 1.2, floor + 1.95, 1.0], { t: 2, s: 1.1, d: 1.4 });
  d.node([-6 + 8 * 1.2, floor + 1.95, 1.0], 0.2, 12, { t: 2 });
  d.line([-6.8, floor, 0], [6.8, floor, 0], { s: 1.1, d: 1.4 });
  d.line([-6.8, floor, 0.9], [6.8, floor, 0.9], { s: 0.8, d: 0.6 });
  d.done(Nf);
}

/* ── Perakende, Tüketici ve Gıda — «işlem hacmi yüksek, çok noktalı ve veri yoğun işleyiş»: şubeler merkez deftere bağlanır */
export function sube(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const hub = [0, 1.1, 0];
  // merkez defter: üst üste yapraklar
  for (let k = 0; k < 4; k++) {
    const c = [0, hub[1] + k * 0.3, 0];
    d.rect(c, X, Z, 1.9, 1.9, { s: 1.0, d: 1.2, t: k === 3 ? 1 : 0 });
    if (k === 3) d.hatch(c, X, Z, 1.9, 1.9, 5, { s: 0.7, d: 0.7 });
  }
  d.node([0, hub[1] + 0.5, 0], 0.5, 30, { t: 0, s: 2.6 });
  const rings = [
    { r: 2.7, n: 10, y: -0.6 },
    { r: 4.4, n: 16, y: -1.9 },
    { r: 6.0, n: 22, y: -3.2 },
  ];
  const nodes = rings.map((R, ri) =>
    Array.from({ length: R.n }, (_, i) => {
      const a = (i / R.n) * TAU + ri * 0.31 + (rnd() - 0.5) * 0.1;
      const r = R.r + (rnd() - 0.5) * 0.25;
      return [Math.cos(a) * r, R.y + (rnd() - 0.5) * 0.18, Math.sin(a) * r * 0.85];
    })
  );
  // yörünge çizgileri (sönük)
  rings.forEach((R) => d.circle([0, R.y, 0], X, [0, 0, 0.85], R.r, { s: 0.7, d: 0.3 }));
  const nearest = (a, list) => list.reduce((b, q) => (v3.dist(a, q) < v3.dist(a, b) ? q : b), list[0]);
  nodes[0].forEach((q) => d.line([0, hub[1] + 0.1, 0], q, { s: 0.8, d: 0.8 }));
  nodes[1].forEach((q) => d.line(nearest(q, nodes[0]), q, { s: 0.8, d: 0.8 }));
  nodes[2].forEach((q) => d.line(nearest(q, nodes[1]), q, { s: 0.8, d: 0.8 }));
  nodes.forEach((list, ri) =>
    list.forEach((q, i) => {
      const flag = (ri * 7 + i * 3) % 11 === 0; // kayıt–fiziki stok farkı olan noktalar
      d.node(q, flag ? 0.3 : 0.2, flag ? 20 : 11, { t: flag ? 2 : ri === 0 ? 1 : 0 });
    })
  );
  d.done(Nf);
}

/* ── Teknoloji, Medya ve Telekomünikasyon — «Gelir tanıma ve sözleşme yapıları»: tek sözleşme, zamana yayılan edimlere ayrılır */
export function edim(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const pv = [-4.6, -3.9, 0];
  const slabs = 7;
  const rad = (a) => [Math.cos(a), Math.sin(a), 0];
  const nrm = (a) => [-Math.sin(a), Math.cos(a), 0];
  const a0 = (14 * Math.PI) / 180;
  const a1 = (84 * Math.PI) / 180;
  for (let k = 0; k < slabs; k++) {
    const a = a0 + ((a1 - a0) * k) / (slabs - 1);
    const u = rad(a);
    const n = nrm(a);
    const c = [pv[0] + u[0] * 4.5, pv[1] + u[1] * 4.5, -1.0 + k * 0.33];
    const t = k < 3 ? 1 : k < 6 ? 0 : 2;
    d.rect(c, u, n, 7.2, 2.6, { t, s: 0.95, d: 1.1 });
    d.hatch(c, u, n, 7.2, 2.6, 4, { t, s: 0.7, d: 0.55 });
    // slabın dış ucundaki düğüm: edimin yerine getirildiği an
    d.node([pv[0] + u[0] * 8.1, pv[1] + u[1] * 8.1, c[2]], 0.2, 14, { t: k < 3 ? 3 : 0 });
  }
  // zaman yayı
  d.arc([pv[0], pv[1], 0.9], X, Y, 8.1, a0, a1, { s: 0.9, d: 0.9 });
  // sözleşme: eksenin ucundaki kalın blok
  d.box([pv[0] + 0.1, pv[1] + 0.2, 0.9], [1.5, 1.2, 1.6], { t: 0, s: 1.1 }, { front: 3, top: 2 });
  d.node([pv[0], pv[1], 0.9], 0.5, 28, { t: 0, s: 2.4 });
  d.done(Nf);
}

/* ── Sağlık ve İlaç — «Gelir kaynakları ve alacak takibi»: hasta, özel sigorta ve kurum gelirleri tek alacakta birleşir; küçük bir kısmı kesinti/mutabakat farkı olur */
export function alacak(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const xA = -6.3;
  const xM = -1.2;
  const xS = 2.2;
  const xE = 6.3;
  const ribbon = (x0, x1, y0, y1, w0, w1, z0, z1, o) => {
    const rows = Math.max(3, Math.round(Math.max(w0, w1) * 2.4));
    for (let r = 0; r < rows; r++) {
      const off = rows === 1 ? 0 : r / (rows - 1) - 0.5;
      d.curve(
        (u) => {
          const e = smooth(u);
          return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * e + off * (w0 + (w1 - w0) * e), z0 + (z1 - z0) * e + Math.sin(u * 6 + r) * 0.05];
        },
        { ...o, d: 1.0 },
        70
      );
    }
  };
  // kaynak şeritleri: hasta (ince), özel sigorta, kurum (kalın)
  ribbon(xA, xM, 3.1, 1.7, 1.0, 1.0, -1.0, 0, { t: 1 });
  ribbon(xA, xM, 0.6, 0.5, 1.4, 1.4, 0.0, 0, { t: 3 });
  ribbon(xA, xM, -2.4, -1.2, 2.0, 2.0, 1.0, 0, { t: 0 });
  // birleşik alacak bandı
  ribbon(xM, xS, 0.0, 0.0, 4.4, 4.4, 0, 0, { t: 0, s: 0.85 });
  // çıkış: tahsil edilen (kalın) ve kesinti / mutabakat farkı (ince, kırmızı)
  ribbon(xS, xE, 0.5, 1.2, 3.4, 3.2, 0, 0.3, { t: 1 });
  ribbon(xS, xE, -1.7, -3.0, 1.0, 0.9, 0, -0.4, { t: 2 });
  // kaynak düğümleri ve uç okları
  [[3.1, -1.0, 1], [0.6, 0, 3], [-2.4, 1.0, 0]].forEach(([y, z, t]) => d.node([xA, y, z], 0.4, 24, { t }));
  d.poly([[xE - 0.5, 2.2, 0.3], [xE, 1.2, 0.3], [xE - 0.5, 0.2, 0.3]], { t: 1, s: 1.1, d: 1.4 });
  d.poly([[xE - 0.4, -2.4, -0.4], [xE, -3.0, -0.4], [xE - 0.4, -3.6, -0.4]], { t: 2, s: 1.1, d: 1.4 });
  d.done(Nf);
}

/* ── İnşaat, Gayrimenkul ve Altyapı — «Hasılat ve maliyetin dönemlere dağıtımı»: yıllara yaygın işte ilerleme (S eğrisi) ve hakediş basamakları */
export function hakedis(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const floor = -4.0;
  const L = (u, c, k) => (sig(k * (u - c)) - sig(-k * c)) / (sig(k * (1 - c)) - sig(-k * c));
  const Y0 = floor + 0.1;
  const H = 7.4;
  const X0 = -6.0;
  const W = 12.0;
  // eksenler + işaretler
  d.line([X0 - 0.6, floor, 0], [X0 + W + 0.6, floor, 0], { s: 1.1, d: 1.5 });
  d.line([X0 - 0.6, floor, 0], [X0 - 0.6, floor + H + 0.4, 0], { s: 1.1, d: 1.2 });
  for (let i = 0; i <= 10; i++) d.line([X0 + (W * i) / 10, floor, 0], [X0 + (W * i) / 10, floor - 0.22, 0], { s: 0.8, d: 1.2 });
  // gerçekleşen ilerleme: üç paralel eğri (şerit)
  for (const z of [-0.5, 0, 0.5]) d.curve((u) => [X0 + W * u, Y0 + H * L(u, 0.5, 9), z], { s: 1.0, d: 1.5, t: 0 }, 140);
  // planlanan (mavi, geride) ve nakit gerçekleşme (yeşil, önde)
  d.curve((u) => [X0 + W * u, Y0 + H * L(u, 0.56, 8), -1.7], { t: 1, s: 0.9, d: 1.0 }, 120);
  d.curve((u) => [X0 + W * u, Y0 + H * L(u, 0.45, 8.5), 1.7], { t: 3, s: 0.9, d: 1.0 }, 120);
  // hakediş basamakları: her dönemin ilerleme artışı
  const n = 9;
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const u1 = (i + 1) / n;
    const h = (L(u1, 0.5, 9) - L(u0, 0.5, 9)) * H * 2.1 + 0.1;
    d.box([X0 + W * (u0 + u1) / 2, floor + h / 2, 0.2], [W / n - 0.22, h, 1.2], { t: 1, s: 0.85 }, { front: 1 });
  }
  // dönüm noktaları: eğri üzerinde düğüm + eksene inen çizgi
  [0.25, 0.5, 0.75, 1].forEach((u, i) => {
    const q = [X0 + W * u, Y0 + H * L(u, 0.5, 9), 0];
    d.line(q, [q[0], floor, 0], { s: 0.7, d: 0.5 });
    d.node(q, 0.22, 16, { t: i === 3 ? 3 : 0 });
  });
  d.done(Nf);
}

/* ── Turizm, Ulaştırma ve Lojistik — «Sezonluk gelir ve nakit akışı planlaması»: on iki ay, yaz zirvesi; sabit gideri karşılamayan aylar kırmızı */
export function sezon(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const hs = [1.1, 1.0, 1.5, 2.6, 3.9, 5.3, 6.6, 6.9, 5.2, 3.2, 1.6, 1.2].map((h) => h * 0.84);
  const floor = -4.0;
  const fixed = 1.5;
  const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
  hs.forEach((h, i) => {
    const x = -5.5 + i;
    const low = h < fixed;
    d.box([x, floor + h / 2, 0], [0.64, h, 1.5], { t: low ? 2 : 1, s: 0.95 }, { front: Math.max(1, Math.round(h * 1.1)), top: 2 });
  });
  // sabit gider (kırmızı) ve ortalama (yeşil) düzeyi
  d.line([-6.4, floor + fixed, 0.9], [6.4, floor + fixed, 0.9], { t: 2, s: 0.9, d: 1.0 });
  d.line([-6.4, floor + avg, 0.9], [6.4, floor + avg, 0.9], { t: 3, s: 0.9, d: 1.0 });
  // sezon zarfı: sütun uçlarını izleyen eğri
  const xs = hs.map((_, i) => -5.5 + i);
  const env = (u) => {
    const f = u * (hs.length - 1);
    const i = Math.min(hs.length - 2, Math.floor(f));
    const e = smooth(f - i);
    return [xs[0] + u * (xs[hs.length - 1] - xs[0]), floor + hs[i] + (hs[i + 1] - hs[i]) * e + 0.18, 0.9];
  };
  d.curve(env, { t: 0, s: 1.0, d: 1.6 }, 140);
  d.line([-6.4, floor, 0], [6.4, floor, 0], { s: 1.1, d: 1.5 });
  d.line([-6.4, floor, 0.9], [6.4, floor, 0.9], { s: 0.8, d: 0.6 });
  d.done(Nf);
}

/* ── Aile Şirketleri ve KOBİ'ler — «mülkiyet, yönetim ve aile ilişkileri iç içedir»: üç halka (aile · mülkiyet · işletme) ve ortak kesişim */
export function ucHalka(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const R = 2.9;
  const cs = [
    { c: [0, 1.75, -0.5], t: 2 }, // aile
    { c: [-1.75, -1.2, 0], t: 1 }, // mülkiyet
    { c: [1.75, -1.2, 0.5], t: 3 }, // işletme
  ];
  for (const q of cs) d.circle(q.c, X, Y, R, { t: q.t, s: 1.05, d: 1.8 });
  // iç yüzey: kaç halkanın içindeyse o kadar yoğun; tek halkada kendi rengi, kesişimlerde beyaz-mavi (üçlü kesişim iri)
  d.scatter(
    (r) => {
      for (let tries = 0; tries < 60; tries++) {
        const q = cs[Math.floor(r() * 3)];
        const a = r() * TAU;
        const k = Math.sqrt(r()) * R;
        const x = q.c[0] + Math.cos(a) * k;
        const y = q.c[1] + Math.sin(a) * k;
        const inside = cs.filter((o) => Math.hypot(x - o.c[0], y - o.c[1]) < R);
        const m = inside.length;
        if (r() < [0.1, 0.3, 0.75][m - 1]) return [x, y, q.c[2] + (r() - 0.5) * 0.5, m === 1 ? inside[0].t : 0, m === 3 ? 1.5 : 0.8];
      }
      return [0, 0, 0, 0, 1.2];
    },
    130,
    { s: 0 }
  );
  d.node([0, 0, 0.1], 0.3, 14, { t: 0, s: 1.8 });
  d.done(Nf);
}

/* ── Kamu İştirakleri ve Sivil Toplum — «Kamu hesap verebilirliği ve iç kontrol»: üç savunma hattı (yönetim, risk ve uyum, iç denetim) varlıkları çevreler */
export function savunma(p, rnd, Nf) {
  const d = new Draw(p, rnd);
  const c0 = [0, -3.6, 0];
  const front = Math.PI / 2; // kameraya bakan yön: dış katmanlarda bu dilim açık bırakılır (iç katmanlar görünsün)
  const shells = [
    { R: 4.7, t: 1, mer: 14, lat: 4, cut: 0.8, w: 1.0 },
    { R: 3.4, t: 0, mer: 12, lat: 3, cut: 0.45, w: 0.9 },
    { R: 2.2, t: 3, mer: 10, lat: 3, cut: 0, w: 0.8 },
  ];
  const dome = (R, phi, psi) => [c0[0] + R * Math.cos(phi) * Math.cos(psi), c0[1] + R * Math.sin(phi), c0[2] + R * Math.cos(phi) * Math.sin(psi) * 0.9];
  for (const S of shells) {
    for (let k = 0; k < S.lat; k++) {
      const phi = (k / S.lat) * 1.35;
      const c = [c0[0], c0[1] + S.R * Math.sin(phi), c0[2]];
      const r = S.R * Math.cos(phi);
      if (S.cut > 0) d.arc(c, X, [0, 0, 0.9], r, front + S.cut, front + TAU - S.cut, { t: S.t, s: 0.9, d: S.w });
      else d.circle(c, X, [0, 0, 0.9], r, { t: S.t, s: 0.9, d: S.w });
    }
    for (let j = 0; j < S.mer; j++) {
      const psi = (j / S.mer) * TAU;
      const off = Math.abs(Math.atan2(Math.sin(psi - front), Math.cos(psi - front)));
      if (S.cut > 0 && off < S.cut) continue;
      d.curve((u) => dome(S.R, u * 1.4, psi), { t: S.t, s: 0.9, d: S.w }, 24);
    }
  }
  // çekirdek: korunan varlıklar ve kaynaklar
  d.node([0, c0[1] + 0.7, 0], 0.55, 70, { t: 2, s: 2.4 });
  d.node([0, c0[1] + 0.7, 0], 1.0, 40, { t: 0, s: 1.4 });
  d.done(Nf);
}
