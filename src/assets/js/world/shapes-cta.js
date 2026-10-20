// Kapanış çağrı bandının şekli — Ekim 2026, müşteri geri bildirimi: «Görüşelim kısmını beğenmediler, daha uygun 3B şekil». Önceki `kapi`
// (kemer ve ona uzanan yol) soyut kalıyordu. Yerine bandın kendi metninden («Size nasıl yardımcı olabiliriz?» — 20 Ekim'e dek «Görüşelim»;
// «… ilk görüşmede nasıl ilerleyeceğimizi belirleyelim») gelen, bir bakışta tanınan tek nesne: iki konuşma balonu.
//   diyalog — önde, solda sizin balonunuz (kuyruğu sola): içinde üç nokta, «yazıyor» — Boraden'in mavi · kırmızı · yeşil renkleri.
//             Arkada, sağda yanıt balonu (kuyruğu sağa, mavi): üç yazı satırı.
// Balonlar kabarıktır (yastık gibi): yüzleri seyrek noktalı levha, kenarları yuvarlak bordür — tel çerçeve değil, hacim olarak okunur
// (shapes-vergi.js › ball ile aynı yaklaşım). Okunurluk ilkeleri shapes-vergi.js ile aynı: dış hat yoğun ve iri noktalı, iç ayrıntı seyrek;
// nesne kameraya dönük (salınım, tam tur yok); yazı yok; renk parçaları ayırır. Saf hesaplama; yerleşim x ∈ [−6,2, 6,2], y ∈ [−4,8, 4,2],
// z ∈ [−1,1, 1,5] (tests/formations.test.mjs sınırları).
import { Draw, X, Y, TAU } from './draw.js';

/** Konuşma balonu dış hattı: köşeleri yuvarlatılmış dikdörtgen + alt kenardan çıkan kuyruk (xy düzleminde, z sabit). Kuyruk, alt kenarın
 *  x0…x1 aralığından dik inip uca (tip) kıvrılan ve uca doğru incelen kalın bir eğridir; ucu rho yarıçaplı yarım daire (sivri uç yok:
 *  kabarık balonda bordür sivri uçta üst üste biniyordu). Saatin tersi yönde kapalı çokgen noktaları. */
function bubblePath(c, w, h, r, tail, z) {
  const [cx, cy] = c;
  const xl = cx - w / 2;
  const xr = cx + w / 2;
  const yb = cy - h / 2;
  const yt = cy + h / 2;
  const pts = [[tail.x1, yb, z]];
  const arc = (ax, ay, a0, a1, n = 16) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([ax + r * Math.cos(a), ay + r * Math.sin(a), z]);
    }
  };
  arc(xr - r, yb + r, -Math.PI / 2, 0);
  arc(xr - r, yt - r, 0, Math.PI / 2);
  arc(xl + r, yt - r, Math.PI / 2, Math.PI);
  arc(xl + r, yb + r, Math.PI, 1.5 * Math.PI);
  // kuyruk: orta çizgi (ikinci dereceden Bézier) tabanın ortasından dik iner, uca kıvrılır; genişlik tabandan uca rho'ya iner
  const { x0, x1, tip, rho = 0.24, ky = 0.8 } = tail;
  const M = [(x0 + x1) / 2, yb];
  const K = [M[0], yb + (tip[1] - yb) * ky];
  const hw = (x1 - x0) / 2;
  const n = 24;
  const sideA = []; // x0 tarafı
  const sideB = []; // x1 tarafı
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const m = 1 - u;
    const qx = m * m * M[0] + 2 * m * u * K[0] + u * u * tip[0];
    const qy = m * m * M[1] + 2 * m * u * K[1] + u * u * tip[1];
    const dx = 2 * m * (K[0] - M[0]) + 2 * u * (tip[0] - K[0]);
    const dy = 2 * m * (K[1] - M[1]) + 2 * u * (tip[1] - K[1]);
    const l = Math.hypot(dx, dy) || 1;
    const wv = hw + (rho - hw) * Math.pow(u, 0.9);
    sideB.push([qx - (dy / l) * wv, qy + (dx / l) * wv, z]);
    sideA.push([qx + (dy / l) * wv, qy - (dx / l) * wv, z]);
  }
  pts.push(...sideA);
  // uç kapağı: A tarafının sonundan B tarafının sonuna, uç yönünden geçen yarım daire
  const a0 = Math.atan2(sideA[n][1] - tip[1], sideA[n][0] - tip[0]);
  const a1 = Math.atan2(sideB[n][1] - tip[1], sideB[n][0] - tip[0]);
  const dir = Math.atan2(tip[1] - K[1], tip[0] - K[0]);
  const norm = (v) => ((v % TAU) + TAU) % TAU;
  let span = norm(a1 - a0);
  if (norm(dir - a0) > span) span -= TAU;
  for (let i = 1; i < 12; i++) {
    const a = a0 + (span * i) / 12;
    pts.push([tip[0] + rho * Math.cos(a), tip[1] + rho * Math.sin(a), z]);
  }
  for (let i = n; i >= 1; i--) pts.push(sideB[i]);
  return pts;
}

/** (x, y) balonun gövdesinin ya da kuyruk üçgeninin içinde mi — pay kadar genişletilmiş (öndeki balonun arkasında kalanı gizlemek için). */
function inBubble(c, w, h, r, tail, pad = 0) {
  const [cx, cy] = c;
  const yb = cy - h / 2;
  return (x, y) => {
    const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0);
    const dy = Math.max(Math.abs(y - cy) - (h / 2 - r), 0);
    if (Math.hypot(dx, dy) < r + pad) return true;
    const [tx, ty] = tail.tip;
    if (y > yb + pad || y < ty - pad) return false;
    const u = (y - yb) / (ty - yb || -1);
    const a = tail.x0 + (tx - tail.x0) * u;
    const b = tail.x1 + (tx - tail.x1) * u;
    return x > Math.min(a, b) - pad && x < Math.max(a, b) + pad;
  };
}

/** Kabarık (yastık gibi) balon: yüzü seyrek noktalı düz levha, kenarı yarım daire kesitli yuvarlak bordür (T kalınlık). Önde yüz kenarı,
 *  dışta (bordürün ekvatoru) yoğun siluet. Köşe normalleri komşu kenarların ortalamasıdır (gönye boyu sınırlı); kuyruk ile gövde arasındaki
 *  dar oyukta iki yanın bordürü birbirini keseceği yerde çizilmez. vis(x, y): görünür mü (öndeki balonun arkasında kalan kısım çizilmez).
 *  Yüzün z'sini döndürür. Hız: bordür ve yüz, önceden hesaplanan tablolardan örneklenir. */
function puffy(d, path, zc, T, o = {}, vis = () => true, face = 0.45) {
  const R = T / 2;
  const P = [];
  for (const q of path) {
    const l = P[P.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) P.push(q);
  }
  if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();
  const m = P.length;
  let area = 0;
  for (let i = 0; i < m; i++) area += P[i][0] * P[(i + 1) % m][1] - P[(i + 1) % m][0] * P[i][1];
  const sg = area > 0 ? 1 : -1;
  const segs = [];
  let L = 0;
  for (let i = 0; i < m; i++) {
    const a = P[i];
    const b = P[(i + 1) % m];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, c: L, n: [((b[1] - a[1]) / l) * sg, (-(b[0] - a[0]) / l) * sg] });
    L += l;
  }
  const vn = segs.map((q, i) => {
    const e = segs[(i - 1 + m) % m].n;
    let x = e[0] + q.n[0];
    let y = e[1] + q.n[1];
    const l = Math.hypot(x, y) || 1;
    x /= l;
    y /= l;
    const k = Math.min(1.5, 1 / Math.max(0.2, x * q.n[0] + y * q.n[1]));
    return [x * k, y * k];
  });
  // dış hat boyunca S örnek: konum ve (köşe normallerinden doğrusal) dış normal
  const S = 480;
  const sx = new Float64Array(S);
  const sy = new Float64Array(S);
  const snx = new Float64Array(S);
  const sny = new Float64Array(S);
  for (let i = 0, j = 0; i < S; i++) {
    const u = ((i + 0.5) / S) * L;
    while (j < m - 1 && segs[j + 1].c <= u) j++;
    const q = segs[j];
    const t = Math.min(1, (u - q.c) / q.l);
    const n0 = vn[j];
    const n1 = vn[(j + 1) % m];
    sx[i] = q.a[0] + (q.b[0] - q.a[0]) * t;
    sy[i] = q.a[1] + (q.b[1] - q.a[1]) * t;
    snx[i] = n0[0] + (n1[0] - n0[0]) * t;
    sny[i] = n0[1] + (n1[1] - n0[1]) * t;
  }
  // dört bordür kalınlığında (e = R·¼ … R): bordür noktası hattın başka bir parçasına e'nin %80'inden yakın mı (oyukta iki yan kesişir)
  const LV = 4;
  const ok = new Uint8Array(S * LV);
  for (let i = 0; i < S; i++) {
    for (let k = 0; k < LV; k++) {
      const e = (R * (k + 1)) / LV;
      const x = sx[i] + snx[i] * e;
      const y = sy[i] + sny[i] * e;
      let good = 1;
      for (const q of segs) {
        const vx = q.b[0] - q.a[0];
        const vy = q.b[1] - q.a[1];
        const t = Math.max(0, Math.min(1, ((x - q.a[0]) * vx + (y - q.a[1]) * vy) / (q.l * q.l)));
        const ex = q.a[0] + vx * t - x;
        const ey = q.a[1] + vy * t - y;
        if (ex * ex + ey * ey < 0.64 * e * e) {
          good = 0;
          break;
        }
      }
      ok[i * LV + k] = good;
    }
  }
  const zf = zc + R;
  // bordür yüzeyi (kesit: önden θ=0, dış kenar θ=π/2, arka θ=π)
  d.scatter((r) => {
    for (let k = 0; k < 16; k++) {
      const i = Math.min(S - 1, Math.floor(r() * S));
      const th = r() * Math.PI;
      const sn = Math.sin(th);
      if (!ok[i * LV + Math.min(LV - 1, Math.floor(sn * LV))]) continue;
      const x = sx[i] + snx[i] * R * sn;
      const y = sy[i] + sny[i] * R * sn;
      if (vis(x, y)) return [x, y, zc + R * Math.cos(th)];
    }
    return [sx[0], sy[0], zf]; // (olasılığı yok denecek kadar az) yedek
  }, L * T * 1.1, { s: 0.9, sv: 0.3, j: 0.01, ...o });
  // siluet (bordürün ekvatoru): görünen ardışık örnekler kırık çizgi olarak
  let run = [];
  const flush = () => {
    if (run.length > 1) d.poly(run, { s: 1.2, d: 2.0, ...o });
    run = [];
  };
  for (let i = 0; i <= S; i++) {
    const k = i % S;
    const x = sx[k] + snx[k] * R;
    const y = sy[k] + sny[k] * R;
    if (ok[k * LV + LV - 1] && vis(x, y)) run.push([x, y, zc]);
    else flush();
  }
  flush();
  // yüz kenarı
  d.polyVis(P.map(([x, y]) => [x, y, zf]), vis, { s: 1.0, d: 0.9, ...o }, true);
  // yüz: tarama satırlarıyla düzgün dağılmış seyrek noktalar (çokgenin içi, satır satır aralıklar)
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const q of P) {
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  const ROWS = 160;
  const dy = (y1 - y0) / ROWS;
  const spans = [];
  let tot = 0;
  for (let rI = 0; rI < ROWS; rI++) {
    const y = y0 + (rI + 0.5) * dy;
    const xs = [];
    for (const q of segs) {
      const [ax, ay] = q.a;
      const [bx, by] = q.b;
      if (ay > y !== by > y) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      tot += xs[k + 1] - xs[k];
      spans.push({ y, a: xs[k], b: xs[k + 1], c: tot });
    }
  }
  d.scatter((r) => {
    for (let k = 0; k < 24; k++) {
      const u = r() * tot;
      let lo = 0;
      let hi = spans.length - 1;
      while (lo < hi) {
        const md = (lo + hi) >> 1;
        if (spans[md].c < u) lo = md + 1;
        else hi = md;
      }
      const sp = spans[lo];
      const x = sp.a + r() * (sp.b - sp.a);
      const y = sp.y + (r() - 0.5) * dy;
      if (vis(x, y)) return [x, y, zf];
    }
    return [sx[0], sy[0], zf];
  }, (Math.abs(area) / 2) * face, { s: 0.8, sv: 0.25, j: 0.01, ...o });
  return zf;
}

/** Dolu yuvarlak (düz disk): seyrek, iri noktalı dolgu + yoğun çevre (toplamalı karışımda sık dolgu beyaza döner, renk kaybolur). */
function dot(d, c, r, o = {}) {
  d.scatter((rnd) => {
    const a = rnd() * TAU;
    const k = Math.sqrt(rnd()) * r * 0.86;
    return [c[0] + Math.cos(a) * k, c[1] + Math.sin(a) * k, c[2]];
  }, r * r * 7, { s: 1.35, sv: 0.4, j: 0.01, ...o });
  d.circle(c, X, Y, r, { s: 1.2, d: 2.0, ...o });
}

/* ── Diyalog: iki kabarık konuşma balonu. Önde, solda sizin balonunuz (beyaz; kuyruğu sola): içinde üç nokta — Boraden'in mavi · kırmızı ·
   yeşil renkleri («yazıyor»). Arkada, sağda yanıt balonu (mavi; kuyruğu sağa): üç yazı satırı. Öndeki balonun arkasında kalan kısım çizilmez. */
export function diyalog(p, rnd, Nf) {
  // bütün şekil %92 ölçekte: dikey telefonda (şekil ortada, ekran genişliğine yayılır) kenarlardan taşmasın (tests/cta-overlap.e2e.mjs)
  const K = 0.92;
  const d = new Draw({ add: (x, y, z, s, t) => p.add(x * K, y * K, z * K, s, t) }, rnd);
  const T = 0.7; // balon kalınlığı
  // arkadaki yanıt balonu
  const B = { c: [1.35, 1.25], w: 7.8, h: 4.5, r: 1.2, z: -0.7 };
  const bxr = B.c[0] + B.w / 2;
  const byb = B.c[1] - B.h / 2;
  B.tail = { x0: bxr - B.r - 1.2, x1: bxr - B.r - 0.05, tip: [bxr - 0.55, byb - 1.0], rho: 0.2 };
  // öndeki balon
  const F = { c: [-2.85, -1.6], w: 5.0, h: 2.8, r: 1.15, z: 1.1 };
  const fxl = F.c[0] - F.w / 2;
  const fyb = F.c[1] - F.h / 2;
  F.tail = { x0: fxl + F.r + 0.05, x1: fxl + F.r + 1.2, tip: [fxl + 0.55, fyb - 1.0], rho: 0.2 };
  const nearF = inBubble(F.c, F.w, F.h, F.r, F.tail, T / 2 + 0.3);
  const visB = (x, y) => !nearF(x, y);
  const zB = puffy(d, bubblePath(B.c, B.w, B.h, B.r, B.tail, 0), B.z, T, { t: 1 }, visB);
  // yanıt satırları
  const x0 = B.c[0] - B.w / 2 + 0.95;
  // satırlar balonun üst kısmında: öndeki balonun arkasında kalmaz
  [[1.3, 5.7], [0.42, 5.1], [-0.46, 3.4]].forEach(([dy, len]) => {
    const y = B.c[1] + dy;
    d.lineVis([x0, y, zB + 0.03], [x0 + len, y, zB + 0.03], visB, { s: 1.1, d: 1.6 });
  });
  // öndeki balon ve üç nokta
  const zF = puffy(d, bubblePath(F.c, F.w, F.h, F.r, F.tail, 0), F.z, T, { t: 0 });
  [1, 2, 3].forEach((t, i) => dot(d, [F.c[0] + (i - 1) * 1.3, F.c[1], zF + 0.03], 0.4, { t }));
  d.done(Nf);
}
