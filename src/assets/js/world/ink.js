
// «Mürekkep» çizici: formasyonu 2B tuvalde, three.js olmadan çizer. Beyaz sayfalardaki «Şekil» kutuları (modules/figure.js) kullanır.
// Aynı formasyon üreticilerini (formations.js) kullanır; 3B döndürme + perspektif yazılımla yapılır (2–6 bin nokta, görünürken 60/30 fps).
//
// Tema: 'ink'  — açık zeminde lacivert/mavi/kırmızı/yeşil noktalar (varsayılan)
//       'glow' — koyu zeminde toplamalı parıltı (yalnızca önizleme/test düzeneği)
// strength: mürekkep koyuluğu çarpanı (1 = açık; şekil kutusu ≈1,5)
import { buildFormation, FORMATIONS } from './formations.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// A → B dönüşümünde i. noktanın yerel konumu ve boyu (döndürme, soluma ve toplanma öncesi) → MP = [x, y, z, boy].
// draw() ile pose() aynı hesabı kullanır: dondurulan ara hâl, dondurulduğu karede çizilenle birebir aynıdır.
const MP = new Float64Array(4);
function morphPt(A, B, i, mix, t, Rb) {
  let x = A.px[i * 3];
  let y = A.px[i * 3 + 1];
  let z = A.px[i * 3 + 2];
  let sz = A.sz[i];
  if (B) {
    // dönüşüm: noktaya özgü gecikme (Morton sırası → komşu noktalar birlikte akar)
    let tt = clamp01((mix - A.rank[i] * 0.38) / 0.62);
    tt = tt * tt * (3 - 2 * tt);
    const w = Math.sin(tt * Math.PI) * Rb * 0.2;
    const s = A.phase[i * 4];
    x += (B.px[i * 3] - x) * tt + Math.sin(s * 6.283 + t * 0.5) * w;
    y += (B.px[i * 3 + 1] - y) * tt + Math.cos(s * 12.566 + t * 0.45) * w;
    z += (B.px[i * 3 + 2] - z) * tt + Math.sin(s * 9.4 - t * 0.4) * w;
    sz += (B.sz[i] - sz) * tt;
  }
  MP[0] = x;
  MP[1] = y;
  MP[2] = z;
  MP[3] = sz;
}
const hash = (n) => {
  const s = Math.sin(n * 91.3458) * 47453.5453;
  return s - Math.floor(s);
};

// renkler: [r, g, b] — 0 beyaz-mavi · 1 mavi · 2 kırmızı · 3 yeşil (formations.js ile aynı sıra)
const INK = [[10, 23, 48], [30, 117, 157], [184, 48, 48], [0, 122, 49]];
const GLOW = [[214, 232, 255], [92, 184, 250], [255, 117, 87], [87, 219, 128]];
const LEVELS = 5; // alfa kovaları
const PERSP = 4.2; // perspektif uzaklığı = PERSP × şeklin en büyük yarıçapı (büyük = daha yassı)
const FIT = 0.95; // kutuya sığdırmada güvenlik payı

export function createInk(canvas, opts = {}) {
  const N = opts.points ?? 3600;
  const theme = opts.theme === 'glow' ? 'glow' : 'ink';
  const strength = opts.strength ?? 1;
  const ctx = canvas.getContext('2d');
  const prepared = new Map();
  let W = 0;
  let H = 0;
  let dpr = 1;

  // ── formasyonu çizime hazırla: merkezle, ölçü çıkar, renge göre grupla
  function prepare(k) {
    let P = prepared.get(k);
    if (P) return P;
    const F = buildFormation(k, N);
    const n = F.nf;
    const view = FORMATIONS[k].view || {};
    const xs = [];
    const ys = [];
    const zs = [];
    for (let i = 0; i < n; i++) {
      xs.push(F.pos[i * 3]);
      ys.push(F.pos[i * 3 + 1]);
      zs.push(F.pos[i * 3 + 2]);
    }
    const trim = (a) => {
      const s = a.slice().sort((p, q) => p - q);
      return [s[Math.floor(n * 0.012)], s[Math.floor(n * 0.988)]];
    };
    const [x0, x1] = trim(xs);
    const [y0, y1] = trim(ys);
    const [z0, z1] = trim(zs);
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    // renge göre sırala (aynı renkteki noktalar bitişik → grup başına tek yol)
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => F.tint[a] - F.tint[b] || a - b);
    const px = new Float32Array(n * 3);
    const sz = new Float32Array(n);
    const rank = new Float32Array(n);
    const phase = new Float32Array(n * 4);
    const sc = new Float32Array(n * 3);
    const ranges = [[0, 0], [0, 0], [0, 0], [0, 0]];
    let cur = -1;
    order.forEach((j, i) => {
      px[i * 3] = F.pos[j * 3] - c[0];
      px[i * 3 + 1] = F.pos[j * 3 + 1] - c[1];
      px[i * 3 + 2] = F.pos[j * 3 + 2] - c[2];
      sz[i] = F.size[j];
      rank[i] = j / n;
      const t = Math.min(3, Math.max(0, Math.round(F.tint[j])));
      if (t !== cur) {
        if (cur >= 0) ranges[cur][1] = i;
        cur = t;
        ranges[t][0] = i;
      }
      for (let q = 0; q < 4; q++) phase[i * 4 + q] = hash(j * 4 + q + k * 1000);
      for (let q = 0; q < 3; q++) sc[i * 3 + q] = hash(j * 3 + q + 7 + k * 100) - 0.5;
    });
    if (cur >= 0) ranges[cur][1] = n;
    // Kutu ölçüleri: salınım aralığındaki (yaw ±0,6 · pitch ±0,12) en büyük izdüşüm → şekil hiçbir açıda taşmaz.
    // 1. geçiş ham 3B yarı-boyutları (rx, ry, rz → perspektif uzaklığı D), 2. geçiş perspektifli ekran yarı-boyutları (qx, qy).
    const pct = (a) => a.slice().sort((p, q) => p - q)[Math.floor(n * 0.985)];
    const sweep = (visit) => {
      for (const dy of [-0.6, 0, 0.6]) {
        for (const dp of [-0.12, 0, 0.12]) {
          const cyw = Math.cos((view.yaw || 0) + dy);
          const syw = Math.sin((view.yaw || 0) + dy);
          const cpt = Math.cos((view.pitch || 0) + dp);
          const spt = Math.sin((view.pitch || 0) + dp);
          visit(cyw, syw, cpt, spt, dy === 0 && dp === 0);
        }
      }
    };
    let rx = 0.5;
    let ry = 0.5;
    let rz = 1;
    sweep((cyw, syw, cpt, spt, mid) => {
      const rxs = new Array(n);
      const rys = new Array(n);
      for (let i = 0; i < n; i++) {
        const x = px[i * 3];
        const y = px[i * 3 + 1];
        const z = px[i * 3 + 2];
        const x1r = x * cyw + z * syw;
        const z1r = -x * syw + z * cyw;
        rxs[i] = Math.abs(x1r);
        rys[i] = Math.abs(y * cpt - z1r * spt);
        if (mid) rz = Math.max(rz, Math.abs(z));
      }
      rx = Math.max(rx, pct(rxs));
      ry = Math.max(ry, pct(rys));
    });
    const D0 = Math.max(rx, ry, rz) * PERSP;
    let qx = 0.5;
    let qy = 0.5;
    sweep((cyw, syw, cpt, spt) => {
      const qxs = new Array(n);
      const qys = new Array(n);
      for (let i = 0; i < n; i++) {
        const x = px[i * 3];
        const y = px[i * 3 + 1];
        const z = px[i * 3 + 2];
        const x1r = x * cyw + z * syw;
        const z1r = -x * syw + z * cyw;
        const y2 = y * cpt - z1r * spt;
        const z2 = y * spt + z1r * cpt;
        const f = D0 / Math.max(D0 * 0.2, D0 - z2);
        qxs[i] = Math.abs(x1r) * f;
        qys[i] = Math.abs(y2) * f;
      }
      qx = Math.max(qx, pct(qxs));
      qy = Math.max(qy, pct(qys));
    });
    P = { k, n, px, sz, rank, phase, sc, ranges, rx, ry, rz, qx, qy, view };
    prepared.set(k, P);
    return P;
  }

  // a / b: formasyon sıra numarası ya da pose() çıktısı (dondurulmuş ara hâl)
  const res = (k) => (k && typeof k === 'object' ? k : prepare(k));

  /**
   * Ara hâli dondurur: a → b dönüşümünün (mix, t anındaki) nokta konumları yeni bir «şekil» olur; draw() bunu a ya da b olarak alır.
   * Dönüşüm sürerken hedef değişirse ekrandaki hâlden DOĞRUDAN yeni hedefe gidilir — önce eski ya da ilk şekle dönülmez (modules/figure.js).
   * Renk grupları, gecikme sırası, soluma ve toplanma fazları A'dan, ölçüler ve bakış açısı karışımdan gelir → çizim dondurulduğu kareyle aynıdır.
   * into: daha önce pose()'un döndürdüğü nesne → yeniden kullanılır (her karede çağrılırsa bellek ayrılmaz). Dönüşüm yoksa A'nın kendisi döner.
   */
  function pose(a, b, mix, t = 0, into = null) {
    const A = res(a);
    const B = b !== undefined && b !== null && b !== a && mix > 0 ? res(b) : null;
    if (!B || B === A) return A;
    const m = clamp01(mix);
    const n = Math.min(A.n, B.n, N);
    const P = into && into.own && into.px.length >= n * 3 ? into : { own: true, k: -1, px: new Float32Array(n * 3), sz: new Float32Array(n), view: {} };
    const lerp = (p, q) => p * (1 - m) + q * m;
    P.n = n;
    P.rank = A.rank;
    P.phase = A.phase;
    P.sc = A.sc;
    P.ranges = m >= 0.5 ? B.ranges : A.ranges;
    P.rx = lerp(A.rx, B.rx);
    P.ry = lerp(A.ry, B.ry);
    P.rz = lerp(A.rz, B.rz);
    P.qx = lerp(A.qx, B.qx);
    P.qy = lerp(A.qy, B.qy);
    P.view.yaw = lerp(A.view.yaw || 0, B.view.yaw || 0);
    P.view.pitch = lerp(A.view.pitch || 0, B.view.pitch || 0);
    P.view.zoom = lerp(A.view.zoom || 1, B.view.zoom || 1);
    const Rb = Math.max(P.rx, P.ry, P.rz);
    for (let i = 0; i < n; i++) {
      morphPt(A, B, i, m, t, Rb);
      P.px[i * 3] = MP[0];
      P.px[i * 3 + 1] = MP[1];
      P.px[i * 3 + 2] = MP[2];
      P.sz[i] = MP[3];
    }
    return P;
  }

  const buf = {
    x: new Float32Array(N),
    y: new Float32Array(N),
    s: new Float32Array(N),
    b: new Uint8Array(N),
  };

  function resize(w, h, ratio = 1) {
    W = w;
    H = h;
    dpr = ratio;
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /**
   * Bir kare çizer.
   *   a, b   — formasyon sıra numaraları ya da pose() ara hâlleri (b verilirse mix ile a→b dönüşür)
   *   mix    — 0..1 dönüşüm ilerlemesi         intro — 0..1 toplanma (noktalar dağınık hâlden şekle)
   *   yaw, pitch — ek döndürme (rad)           zoom — boyut çarpanı (1 = kutuya sığdır)
   *   cx, cy — şeklin merkezi (css px)         fit — {w, h}: şeklin sığacağı kutu (css px)
   *   ptr    — {x, y, k}: fare lensi (css px, k 0..1)       alpha — genel şiddet
   */
  function draw(r) {
    const t = r.t || 0;
    const A = res(r.a);
    const B = r.b !== undefined && r.b !== null && r.b !== r.a && (r.mix || 0) > 0 ? res(r.b) : null;
    const mix = B ? clamp01(r.mix) : 0;
    const yaw0 = (r.yaw || 0) + (A.view.yaw || 0) * (1 - mix) + (B ? (B.view.yaw || 0) * mix : 0);
    const pitch0 = (r.pitch || 0) + (A.view.pitch || 0) * (1 - mix) + (B ? (B.view.pitch || 0) * mix : 0);
    const cyw = Math.cos(yaw0);
    const syw = Math.sin(yaw0);
    const cpt = Math.cos(pitch0);
    const spt = Math.sin(pitch0);
    const fit = r.fit || { w: W, h: H };
    const rxm = A.rx * (1 - mix) + (B ? B.rx * mix : 0);
    const rym = A.ry * (1 - mix) + (B ? B.ry * mix : 0);
    const rzm = A.rz * (1 - mix) + (B ? B.rz * mix : 0);
    const qxm = A.qx * (1 - mix) + (B ? B.qx * mix : 0);
    const qym = A.qy * (1 - mix) + (B ? B.qy * mix : 0);
    // kutuya sığdırma: qx/qy perspektif dâhil ekran yarı-boyutlarıdır (prepare); FIT küçük bir güvenlik payı bırakır.
    // view.zoom (FORMATIONS): seyrek uçları yüzdelik sınırın dışında kalan şekiller (ör. ağaç tacı) için şekle özgü küçültme
    const vzoom = (A.view.zoom || 1) * (1 - mix) + (B ? (B.view.zoom || 1) * mix : 0);
    const scale = Math.min(fit.w / (2 * qxm), fit.h / (2 * qym)) * FIT * (r.zoom || 1) * vzoom;
    const Rb = Math.max(rxm, rym, rzm);
    const D = Rb * PERSP;
    const intro = r.intro === undefined ? 1 : r.intro;
    const ptr = r.ptr && r.ptr.k > 0.004 ? r.ptr : null;
    const cx = r.cx ?? W / 2;
    const cy = r.cy ?? H / 2;
    const n = Math.min(A.n, B ? B.n : A.n, N);
    const drift = Rb * 0.012;
    const px = scale; // nokta boyutu ölçeği: şekil küçüldükçe noktalar da hafif küçülür
    const pxs = Math.min(1.5, Math.max(0.8, Math.sqrt(scale) * 0.34)) * (theme === 'glow' ? 1.25 : 1);

    for (let i = 0; i < n; i++) {
      morphPt(A, B, i, mix, t, Rb);
      let x = MP[0];
      let y = MP[1];
      let z = MP[2];
      const sz = MP[3];
      // soluma: noktaya özgü küçük salınım
      const ph = A.phase[i * 4 + 1];
      const br = Math.sin(t * 0.6 + ph * 40) * drift;
      x += (A.phase[i * 4 + 2] - 0.5) * br * 2;
      y += (A.phase[i * 4 + 3] - 0.5) * br * 2;
      z += (ph - 0.5) * br * 2;
      // toplanma: dağınık hâlden şekle (noktaya özgü gecikme, yavaşlayan varış)
      let it = 1;
      if (intro < 1) {
        it = clamp01((intro - A.rank[i] * 0.5) / 0.5);
        it = 1 - Math.pow(1 - it, 3);
        x += A.sc[i * 3] * rxm * 5 * (1 - it);
        y += A.sc[i * 3 + 1] * rym * 4 * (1 - it);
        z += A.sc[i * 3 + 2] * rzm * 4 * (1 - it);
      }
      // döndür (yaw → pitch) + perspektif
      const x1 = x * cyw + z * syw;
      const z1 = -x * syw + z * cyw;
      const y2 = y * cpt - z1 * spt;
      const z2 = y * spt + z1 * cpt;
      const f = D / Math.max(D * 0.2, D - z2);
      let X = cx + x1 * f * scale;
      let Y = cy - y2 * f * scale;
      let al = 0.34 + 0.66 * clamp01(0.5 + z2 / (2 * Rb));
      al *= 0.82 + 0.18 * Math.sin(t * (0.6 + A.phase[i * 4 + 2]) + ph * 50);
      let s = (0.7 + 0.5 * sz) * f * pxs;
      if (ptr) {
        // fare lensi: imlecin hemen çevresindeki noktalar hafifçe itilir, biraz büyür
        const dx = X - ptr.x;
        const dy = Y - ptr.y;
        const k = Math.exp(-(dx * dx + dy * dy) / 2800) * ptr.k;
        if (k > 0.01) {
          const dl = Math.hypot(dx, dy) || 1;
          X += (dx / dl) * k * 9;
          Y += (dy / dl) * k * 9;
          s *= 1 + k * 0.6;
          al *= 1 + k * 0.7;
        }
      }
      if (intro < 1) al *= smooth(0, 0.25, it);
      buf.x[i] = X;
      buf.y[i] = Y;
      buf.s[i] = s < 1 ? 1 : s > 4.2 ? 4.2 : s;
      const lv = Math.floor(al * (r.alpha ?? 1) * LEVELS);
      buf.b[i] = lv < 0 ? 0 : lv >= LEVELS ? LEVELS - 1 : lv;
    }

    ctx.clearRect(0, 0, W, H);
    if (theme === 'glow') {
      ctx.fillStyle = '#08132a';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
    } else ctx.globalCompositeOperation = 'source-over';
    const pal = theme === 'glow' ? GLOW : INK;
    const alphas = (theme === 'glow' ? [0.2, 0.34, 0.5, 0.7, 0.95] : [0.1, 0.18, 0.28, 0.4, 0.54]).map((x) => Math.min(0.96, x * strength));
    // renk × alfa kovası başına tek yol
    const RG = B && mix >= 0.5 ? B.ranges : A.ranges; // dönüşümün ikinci yarısında renkler B'ye geçer (sıralı indeks aynı noktaya karşılık gelir)
    for (let tn = 0; tn < 4; tn++) {
      const [s0, s1] = RG[tn];
      if (s1 <= s0) continue;
      const col = pal[tn];
      for (let lv = 0; lv < LEVELS; lv++) {
        ctx.beginPath();
        let any = false;
        for (let i = s0; i < s1 && i < n; i++) {
          if (buf.b[i] !== lv) continue;
          const s = buf.s[i];
          ctx.rect(buf.x[i] - s / 2, buf.y[i] - s / 2, s, s);
          any = true;
        }
        if (!any) continue;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alphas[lv]})`;
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    return { scale, px };
  }

  function dispose() {
    prepared.clear();
  }

  return { resize, draw, dispose, prepare, pose, get size() { return { w: W, h: H, dpr }; } };
}
