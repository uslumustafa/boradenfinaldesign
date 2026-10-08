
// Formasyon çizim yardımcıları — çizgi, yay, kutu, bulut gibi ilkellerden nokta üretir.
// Saf hesaplama (DOM/three yok; Node'da test edilir).
//
// Her ilkel bir «ağırlık» taşır (≈ uzunluk × yoğunluk). done(Nf) toplam nokta sayısını ağırlıklara orantılı dağıtır;
// böylece bir şekil 3 600, 9 000 ya da 26 000 noktayla da aynı görünür (yalnızca sıklaşır).
// Düğümler (node) bunun istisnası: nokta sayısının bir tavanı vardır (cap); artan pay çizgilere dağılır. Aksi hâlde çok noktalı
// katmanda (WebGL, toplamalı karışım) düğüm düz, ağır bir beyaz diske dönüşür — ana sayfa şekillerindeki gibi seyrek, parlak
// birkaç iri nokta kalmalı.
//
// Seçenekler (o):  s: nokta boyutu  sv: boyut değişimi  t: renk (0 beyaz-mavi · 1 mavi · 2 kırmızı · 3 yeşil)
//                  acc: [renk, olasılık] vurgu noktaları   j: titreşim (yerleşimi bozar)   d: yoğunluk çarpanı
//                  cap: bu ilkelin en çok nokta sayısı (yalnızca bulut/kabuk/düğüm)
const TAU = Math.PI * 2;

export const X = [1, 0, 0];
export const Y = [0, 1, 0];
export const Z = [0, 0, 1];

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  mix: (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

export class Draw {
  constructor(p, rnd) {
    this.p = p;
    this.rnd = rnd;
    this.parts = [];
  }

  /** Tek nokta (seçeneklere göre boyut/renk/titreşim uygulanır). tt: renk, ss: boyut — verilirse seçeneklerin yerine geçer. */
  pt(x, y, z, o = {}, tt, ss) {
    const r = this.rnd;
    const j = o.j ?? 0.03;
    const t = tt !== undefined ? tt : o.acc && r() < o.acc[1] ? o.acc[0] : o.t ?? 0;
    this.p.add(x + (r() - 0.5) * 2 * j, y + (r() - 0.5) * 2 * j, z + (r() - 0.5) * 2 * j, (ss !== undefined ? ss : o.s ?? 0.9) + r() * (o.sv ?? 0.35), t);
  }

  /** Özel ilkel: w ağırlık, emit(n) n nokta üretir; cap verilirse en çok cap nokta. */
  part(w, emit, cap) {
    if (w > 0) this.parts.push({ w, emit, cap });
    return this;
  }

  /** a → b doğru parçası. */
  line(a, b, o = {}) {
    const L = v3.dist(a, b);
    return this.part(L * (o.d ?? 1), (n) => {
      for (let i = 0; i < n; i++) {
        const u = (i + this.rnd() * 0.7) / n;
        this.pt(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, o);
      }
    });
  }

  /** a → b doğru parçasının yalnızca vis(x, y, z) doğru olan kısmı (ör. öndeki yaprağın altında kalan kenar çizilmez;
   *  nokta bulutunda örtme olmadığı için üst üste binen kâğıtlar böyle ayrık görünür). Ağırlık görünen uzunlukla orantılı. */
  lineVis(a, b, vis, o = {}) {
    const at = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    let f = 0;
    for (let i = 0; i < 64; i++) if (vis(...at((i + 0.5) / 64))) f++;
    if (!f) return this;
    return this.part(v3.dist(a, b) * (f / 64) * (o.d ?? 1), (n) => {
      let made = 0;
      for (let tries = 0; made < n && tries < n * 10; tries++) {
        const q = at(this.rnd());
        if (!vis(q[0], q[1], q[2])) continue;
        this.pt(q[0], q[1], q[2], o);
        made++;
      }
    });
  }

  /** Görünürlük süzgeçli kırık çizgi. */
  polyVis(pts, vis, o = {}, closed = false) {
    for (let i = 0; i < pts.length - 1; i++) this.lineVis(pts[i], pts[i + 1], vis, o);
    if (closed && pts.length > 2) this.lineVis(pts[pts.length - 1], pts[0], vis, o);
    return this;
  }

  /** Kırık çizgi (closed=true kapatır). */
  poly(pts, o = {}, closed = false) {
    for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], o);
    if (closed && pts.length > 2) this.line(pts[pts.length - 1], pts[0], o);
    return this;
  }

  /** Daire yayı: c + r (cos θ · u + sin θ · v), θ ∈ [a0, a1]. */
  arc(c, u, v, r, a0, a1, o = {}) {
    return this.part(Math.abs(a1 - a0) * r * (o.d ?? 1), (n) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * ((i + this.rnd() * 0.7) / n);
        const cs = Math.cos(a) * r;
        const sn = Math.sin(a) * r;
        this.pt(c[0] + u[0] * cs + v[0] * sn, c[1] + u[1] * cs + v[1] * sn, c[2] + u[2] * cs + v[2] * sn, o);
      }
    });
  }

  circle(c, u, v, r, o = {}) {
    return this.arc(c, u, v, r, 0, TAU, o);
  }

  /** Parametrik eğri fn(t ∈ [0,1]) → [x,y,z]; noktalar yay uzunluğuna göre eşit aralıklıdır. */
  curve(fn, o = {}, steps = 96) {
    const pts = [fn(0)];
    const cum = [0];
    for (let i = 1; i <= steps; i++) {
      const q = fn(i / steps);
      cum.push(cum[i - 1] + v3.dist(q, pts[i - 1]));
      pts.push(q);
    }
    const L = cum[steps];
    return this.part(L * (o.d ?? 1), (n) => {
      let k = 0;
      for (let i = 0; i < n; i++) {
        const target = (L * (i + this.rnd() * 0.7)) / n;
        while (k < steps - 1 && cum[k + 1] < target) k++;
        const seg = cum[k + 1] - cum[k] || 1;
        const q = v3.mix(pts[k], pts[k + 1], (target - cum[k]) / seg);
        this.pt(q[0], q[1], q[2], o);
      }
    });
  }

  /** Dikdörtgen çerçeve: merkez c, yönler u,v (birim), genişlik w, yükseklik h. */
  rect(c, u, v, w, h, o = {}) {
    const k = (a, b) => [c[0] + u[0] * a * w * 0.5 + v[0] * b * h * 0.5, c[1] + u[1] * a * w * 0.5 + v[1] * b * h * 0.5, c[2] + u[2] * a * w * 0.5 + v[2] * b * h * 0.5];
    return this.poly([k(-1, -1), k(1, -1), k(1, 1), k(-1, 1)], o, true);
  }

  /** Taralı yüzey: u yönünde uzanan `rows` paralel satır (v yönünde dizilir). */
  hatch(c, u, v, w, h, rows, o = {}) {
    for (let r = 0; r < rows; r++) {
      const b = rows === 1 ? 0 : (r / (rows - 1) - 0.5) * h;
      const m = [c[0] + v[0] * b, c[1] + v[1] * b, c[2] + v[2] * b];
      this.line([m[0] - u[0] * w * 0.5, m[1] - u[1] * w * 0.5, m[2] - u[2] * w * 0.5], [m[0] + u[0] * w * 0.5, m[1] + u[1] * w * 0.5, m[2] + u[2] * w * 0.5], o);
    }
    return this;
  }

  /** Eksenlere hizalı kutu: kenarlar + isteğe bağlı yüzey taraması (faces: {top, bottom, front, back, left, right} → satır sayısı). */
  box(c, size, o = {}, faces = {}) {
    const [sx, sy, sz] = size;
    const h = [sx / 2, sy / 2, sz / 2];
    const P = (a, b, d) => [c[0] + a * h[0], c[1] + b * h[1], c[2] + d * h[2]];
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        this.line(P(-1, a, b), P(1, a, b), o);
        this.line(P(a, -1, b), P(a, 1, b), o);
        this.line(P(a, b, -1), P(a, b, 1), o);
      }
    if (faces.top) this.hatch(P(0, 1, 0), X, Z, sx, sz, faces.top, { ...o, d: (o.d ?? 1) * 0.8 });
    if (faces.bottom) this.hatch(P(0, -1, 0), X, Z, sx, sz, faces.bottom, { ...o, d: (o.d ?? 1) * 0.8 });
    if (faces.front) this.hatch(P(0, 0, 1), X, Y, sx, sy, faces.front, { ...o, d: (o.d ?? 1) * 0.8 });
    if (faces.back) this.hatch(P(0, 0, -1), X, Y, sx, sy, faces.back, { ...o, d: (o.d ?? 1) * 0.8 });
    if (faces.left) this.hatch(P(-1, 0, 0), Y, Z, sy, sz, faces.left, { ...o, d: (o.d ?? 1) * 0.8 });
    if (faces.right) this.hatch(P(1, 0, 0), Y, Z, sy, sz, faces.right, { ...o, d: (o.d ?? 1) * 0.8 });
    return this;
  }

  /** Nokta kafesi (düğümler): c merkez, u,v yönleri, w×h boyut, nx×ny düğüm; w ağırlığı «uzunluk birimi» cinsinden verilir. */
  grid(c, u, v, w, h, nx, ny, o = {}) {
    const nodes = nx * ny;
    return this.part((o.w ?? nodes * 0.4) * (o.d ?? 1), (n) => {
      const off = Math.floor(this.rnd() * nodes);
      for (let i = 0; i < n; i++) {
        const k = (i + off) % nodes;
        const a = nx === 1 ? 0 : (k % nx) / (nx - 1) - 0.5;
        const b = ny === 1 ? 0 : Math.floor(k / nx) / (ny - 1) - 0.5;
        this.pt(c[0] + u[0] * a * w + v[0] * b * h, c[1] + u[1] * a * w + v[1] * b * h, c[2] + u[2] * a * w + v[2] * b * h, o);
      }
    });
  }

  /** Elipsoid hacmi içinde düzgün dağılmış bulut. w: ağırlık. */
  cloud(c, r, w, o = {}) {
    const rr = typeof r === 'number' ? [r, r, r] : r;
    return this.part(w * (o.d ?? 1), (n) => {
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * TAU;
        const b = Math.acos(2 * this.rnd() - 1);
        const k = Math.cbrt(this.rnd());
        this.pt(c[0] + rr[0] * k * Math.sin(b) * Math.cos(a), c[1] + rr[1] * k * Math.cos(b), c[2] + rr[2] * k * Math.sin(b) * Math.sin(a), o);
      }
    }, o.cap);
  }

  /** Elipsoid yüzeyi. w: ağırlık. */
  shell(c, r, w, o = {}) {
    const rr = typeof r === 'number' ? [r, r, r] : r;
    return this.part(w * (o.d ?? 1), (n) => {
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * TAU;
        const b = Math.acos(2 * this.rnd() - 1);
        this.pt(c[0] + rr[0] * Math.sin(b) * Math.cos(a), c[1] + rr[1] * Math.cos(b), c[2] + rr[2] * Math.sin(b) * Math.sin(a), o);
      }
    }, o.cap);
  }

  /** Düğüm: küçük kümede birkaç iri, parlak nokta. Nokta sayısı yarıçapla sınırlı (r 0,25 → ≈ 32): katman ne kadar çok noktalı
   *  olursa olsun düğüm dolu bir diske dönüşmez (ana sayfadaki «Yapı ağacı» düğümleri gibi); artan pay çizgilere gider. */
  node(c, r, w, o = {}) {
    const rm = typeof r === 'number' ? r : Math.max(...r);
    return this.cloud(c, r, w, { s: 2.0, sv: 0.6, j: 0, cap: Math.round(10 + 90 * rm), ...o });
  }

  /** Özel dağılım: fn(rnd, i, n) → [x, y, z, renk?, boyut?] her çağrıda bir nokta. */
  scatter(fn, w, o = {}) {
    return this.part(w * (o.d ?? 1), (n) => {
      for (let i = 0; i < n; i++) {
        const q = fn(this.rnd, i, n);
        this.pt(q[0], q[1], q[2], o, q[3], q[4]);
      }
    });
  }

  /** Yazı: GLYPHS'teki çizgi harflerle `str` (rakam, %, ₺, €, büyük harfler — Türkçe harfler dahil). o: başlangıç (taban çizgisinin solu; align: 'right' ise sağı,
   *  'center' ise ortası), u: yazı yönü, v: yukarı yönü (birim), size: harf yüksekliği. Harf aralığı yüksekliğe orantılı. Genişliği döndürür. */
  text(str, o, u, v, size, opt = {}) {
    const chars = Array.from(String(str));
    // harf çizgisi titreşimi harf boyuna orantılı: küçük yazı (levha, tablo başlığı) bulanıklaşmaz
    const oo = { j: Math.min(0.03, size * 0.03), sv: 0.2, ...opt };
    const adv = (ch) => (GLYPHS[ch] ? GLYPHS[ch].w ?? 0.8 : 0.55) * size;
    const W = chars.reduce((s, ch) => s + adv(ch), 0) - 0.2 * size;
    const shift = opt.align === 'right' ? -W : opt.align === 'center' ? -W / 2 : 0;
    let x = shift;
    for (const ch of chars) {
      const g = GLYPHS[ch];
      if (g) {
        const P = ([gx, gy]) => [o[0] + u[0] * (x + gx * size) + v[0] * gy * size, o[1] + u[1] * (x + gx * size) + v[1] * gy * size, o[2] + u[2] * (x + gx * size) + v[2] * gy * size];
        for (const st of g.s || []) this.poly(st.map(P), oo);
        for (const [cx, cy, r, a0 = 0, a1 = TAU] of g.c || []) this.arc(P([cx, cy]), u, v, r * size, a0, a1, oo);
      }
      x += adv(ch);
    }
    return W;
  }

  /** Toplam Nf·fill noktayı ağırlıklara göre dağıtır; tavanı (cap) olan ilkeller tavanda kalır, artan pay diğerlerine geçer. */
  done(Nf, fill = 0.97) {
    const share = new Map();
    let pool = this.parts;
    let budget = Nf * fill;
    for (let round = 0; round < 6 && pool.length; round++) {
      const W = pool.reduce((s, q) => s + q.w, 0) || 1;
      const full = pool.filter((q) => q.cap !== undefined && (budget * q.w) / W > q.cap);
      if (!full.length) {
        for (const q of pool) share.set(q, (budget * q.w) / W);
        pool = [];
        break;
      }
      for (const q of full) {
        share.set(q, q.cap);
        budget -= q.cap;
      }
      pool = pool.filter((q) => !full.includes(q));
    }
    if (pool.length) {
      const W = pool.reduce((s, q) => s + q.w, 0) || 1;
      for (const q of pool) share.set(q, (budget * q.w) / W);
    }
    for (const q of this.parts) q.emit(Math.max(3, Math.round(share.get(q))));
    this.parts = [];
    return this;
  }
}


// Çizgi harfler (birim kutu: genişlik ≈ 0,6, yükseklik 1; taban y = 0). s: kırık çizgiler, c: yaylar [cx, cy, r, a0, a1], w: ilerleme.
// Rakamlar yuvarlatılmış köşeli; ₺ işareti dikey gövde, iki eğik çizgi ve yukarı kıvrılan taban yayıyla çizilir.
// Ortak çizgiler (S/Ş, O/Ö, U/Ü, G/Ğ, C/Ç aynı gövdeyi paylaşır; CED: çengel)
const S_ = [[0.58, 0.86], [0.46, 1], [0.13, 1], [0.01, 0.88], [0.01, 0.66], [0.13, 0.54], [0.47, 0.46], [0.6, 0.34], [0.6, 0.12], [0.48, 0], [0.12, 0], [0, 0.13]];
const O_ = [[0.16, 0], [0.5, 0], [0.66, 0.16], [0.66, 0.84], [0.5, 1], [0.16, 1], [0, 0.84], [0, 0.16], [0.16, 0]];
const U_ = [[0, 1], [0, 0.15], [0.14, 0], [0.46, 0], [0.6, 0.15], [0.6, 1]];
const G_ = [[0.58, 0.86], [0.46, 1], [0.14, 1], [0, 0.86], [0, 0.14], [0.14, 0], [0.46, 0], [0.6, 0.14], [0.6, 0.46], [0.34, 0.46]];
const C_ = [[0.58, 0.86], [0.46, 1], [0.14, 1], [0, 0.86], [0, 0.14], [0.14, 0], [0.46, 0], [0.58, 0.14]];
const CED = [[0.3, 0], [0.34, -0.12], [0.24, -0.22]];

export const GLYPHS = {
  0: { s: [[[0.12, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.88], [0.48, 1], [0.12, 1], [0, 0.88], [0, 0.12], [0.12, 0]]] },
  1: { s: [[[0.12, 0.78], [0.36, 1], [0.36, 0]], [[0.14, 0], [0.58, 0]]] },
  2: { s: [[[0, 0.84], [0.12, 1], [0.48, 1], [0.6, 0.86], [0.6, 0.64], [0, 0.02], [0.62, 0.02]]] },
  3: { s: [[[0, 0.9], [0.1, 1], [0.5, 1], [0.6, 0.9], [0.6, 0.62], [0.5, 0.53], [0.2, 0.53]], [[0.5, 0.53], [0.6, 0.43], [0.6, 0.1], [0.5, 0], [0.1, 0], [0, 0.1]]] },
  4: { s: [[[0.46, 0], [0.46, 1], [0, 0.3], [0.62, 0.3]]] },
  5: { s: [[[0.6, 1], [0.06, 1], [0.02, 0.56], [0.46, 0.6], [0.6, 0.46], [0.6, 0.12], [0.48, 0], [0.1, 0], [0, 0.1]]] },
  6: { s: [[[0.56, 0.94], [0.46, 1], [0.14, 1], [0, 0.86], [0, 0.12], [0.12, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.42], [0.48, 0.55], [0.12, 0.55], [0, 0.44]]] },
  7: { s: [[[0, 1], [0.62, 1], [0.2, 0]]] },
  8: { s: [[[0.12, 0.55], [0.04, 0.63], [0.04, 0.9], [0.14, 1], [0.46, 1], [0.56, 0.9], [0.56, 0.63], [0.48, 0.55], [0.12, 0.55], [0, 0.44], [0, 0.11], [0.11, 0], [0.49, 0], [0.6, 0.11], [0.6, 0.44], [0.48, 0.55]]] },
  9: { s: [[[0.04, 0.06], [0.14, 0], [0.46, 0], [0.6, 0.14], [0.6, 0.88], [0.48, 1], [0.12, 1], [0, 0.88], [0, 0.58], [0.12, 0.45], [0.48, 0.45], [0.6, 0.56]]] },
  '%': { s: [[[0.6, 1], [0.02, 0]]], c: [[0.13, 0.84, 0.13], [0.49, 0.16, 0.13]] },
  '.': { s: [[[0.06, 0], [0.13, 0]], [[0.06, 0.06], [0.13, 0.06]]], w: 0.4 },
  ',': { s: [[[0.12, 0.08], [0.05, -0.14]]], w: 0.4 },
  '₺': { s: [[[0.24, 1], [0.24, 0]], [[0.02, 0.5], [0.5, 0.68]], [[0.02, 0.3], [0.5, 0.48]]], c: [[0.24, 0.42, 0.42, -Math.PI / 2, 0.15]] },
  '×': { s: [[[0.04, 0.16], [0.52, 0.64]], [[0.04, 0.64], [0.52, 0.16]]] },
  '+': { s: [[[0, 0.4], [0.56, 0.4]], [[0.28, 0.12], [0.28, 0.68]]] },
  '-': { s: [[[0.04, 0.4], [0.5, 0.4]]] },
  '=': { s: [[[0, 0.28], [0.56, 0.28]], [[0, 0.54], [0.56, 0.54]]] },
  A: { s: [[[0, 0], [0.3, 1], [0.6, 0]], [[0.12, 0.38], [0.48, 0.38]]] },
  D: { s: [[[0, 0], [0, 1], [0.34, 1], [0.6, 0.76], [0.6, 0.24], [0.34, 0], [0, 0]]] },
  E: { s: [[[0.58, 1], [0, 1], [0, 0], [0.58, 0]], [[0, 0.52], [0.46, 0.52]]] },
  I: { s: [[[0.3, 0], [0.3, 1]]], w: 0.62 },
  İ: { s: [[[0.3, 0], [0.3, 0.84]], [[0.27, 1.02], [0.33, 1.02]]], w: 0.62 },
  K: { s: [[[0, 0], [0, 1]], [[0.6, 1], [0, 0.4]], [[0.2, 0.6], [0.62, 0]]] },
  M: { s: [[[0, 0], [0, 1], [0.32, 0.42], [0.64, 1], [0.64, 0]]], w: 0.86 },
  V: { s: [[[0, 1], [0.3, 0], [0.6, 1]]] },
  T: { s: [[[0, 1], [0.6, 1]], [[0.3, 1], [0.3, 0]]] },
  R: { s: [[[0, 0], [0, 1], [0.44, 1], [0.58, 0.88], [0.58, 0.64], [0.44, 0.52], [0, 0.52]], [[0.3, 0.52], [0.62, 0]]] },
  H: { s: [[[0, 0], [0, 1]], [[0.6, 0], [0.6, 1]], [[0, 0.52], [0.6, 0.52]]] },
  // Ekim 2026: Hukuk ve Teşvik şekilleri için ek harfler (SÖZLEŞME, TİCARET SİCİLİ, İHBARNAME, UZLAŞMA, AR-GE, SGK…) ve €, /, :
  S: { s: [S_] },
  Ş: { s: [S_, CED] },
  Z: { s: [[[0.02, 1], [0.6, 1], [0, 0], [0.6, 0]]] },
  F: { s: [[[0.58, 1], [0, 1], [0, 0]], [[0, 0.52], [0.46, 0.52]]] },
  L: { s: [[[0, 1], [0, 0], [0.56, 0]]], w: 0.72 },
  O: { s: [O_], w: 0.88 },
  Ö: { s: [O_, [[0.2, 1.16], [0.26, 1.16]], [[0.4, 1.16], [0.46, 1.16]]], w: 0.88 },
  U: { s: [U_] },
  Ü: { s: [U_, [[0.15, 1.16], [0.21, 1.16]], [[0.39, 1.16], [0.45, 1.16]]] },
  G: { s: [G_] },
  Ğ: { s: [G_, [[0.16, 1.22], [0.3, 1.12], [0.44, 1.22]]] },
  N: { s: [[[0, 0], [0, 1], [0.6, 0], [0.6, 1]]] },
  B: { s: [[[0, 0], [0, 1], [0.42, 1], [0.56, 0.88], [0.56, 0.65], [0.43, 0.53], [0, 0.53]], [[0.43, 0.53], [0.6, 0.41], [0.6, 0.12], [0.48, 0], [0, 0]]] },
  C: { s: [C_] },
  Ç: { s: [C_, CED] },
  P: { s: [[[0, 0], [0, 1], [0.44, 1], [0.58, 0.87], [0.58, 0.63], [0.44, 0.5], [0, 0.5]]] },
  Y: { s: [[[0, 1], [0.3, 0.5], [0.6, 1]], [[0.3, 0.5], [0.3, 0]]] },
  '€': { s: [[[-0.04, 0.6], [0.52, 0.6]], [[-0.04, 0.42], [0.48, 0.42]]], c: [[0.48, 0.5, 0.44, 0.72, TAU - 0.72]], w: 1.0 },
  '/': { s: [[[0, -0.05], [0.46, 1.05]]], w: 0.64 },
  ':': { s: [[[0.08, 0], [0.15, 0]], [[0.08, 0.06], [0.15, 0.06]], [[0.08, 0.6], [0.15, 0.6]], [[0.08, 0.66], [0.15, 0.66]]], w: 0.42 },
  ' ': { w: 0.45 },
};

export { TAU };
