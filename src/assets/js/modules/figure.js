// Şekil kutusu: sayfadaki figure.fig[data-shapes] alanlarına mürekkeple (2B tuval, three.js yok) formasyon çizer.
// Yazının ARKASINA değil, kendi yerine çizilir — yazıyla, kartla, fotoğrafla çakışmaz:
//   .fig--side  yan sütunda «Bu sayfada» menüsünün altında; yapışkan sütunda kalan boşluk kadar yer kaplar, yer yoksa gizlenir
//   .fig--pv    dizin sayfalarında yapışkan önizleme sütunu (üzerine gelinen hizmetin/sektörün şekli)
//   .fig--lead  bölüm içinde, metnin yanında duran büyük şekil
// Koyu kahramandaki 3B dünyayla aynı şekil üreticilerini (world/formations.js) kullanır.
//
// Şekil dizisi:  [data-shapes] değeri → main[data-shapes] → main[data-scene]   (boşlukla ayrılmış kimlikler ya da sıra numaraları)
//   Birden çok şekil verilirse kapsam (en yakın .sheet, yoksa main) kaydırıldıkça sırayla birbirine dönüşür.
// [data-shape-at="kimlik"]: kapsamdaki bölüm ekranın ortasına geldikçe şekil sırayla o şekle döner (dönüşüm zamana yayılır, ~1 sn).
// [data-shape-hover="kimlik"]: kapsamdaki satırın/kartın üzerine gelince (fare) ya da klavyeyle odaklanınca geçici olarak o şekil.
// Katmanlar: Tam = canlı, 60 fps, küçük fare lensi · Hafif = canlı, 30 fps, daha az nokta · Kapalı = hareketsiz tek kare.
// Görünmezken çizilmez. Yazdırmada ve yüksek karşıtlık tercihinde gizlenir (CSS: 80-fx.css › .fig).
import { createInk } from '../world/ink.js';
import { FORMATIONS, SCENE, FORMATION_COUNT } from '../world/formations.js';
import { clamp, smoothstep } from '../util.js';

const POINTS = { side: [4200, 2200], pv: [6400, 3000], lead: [6400, 3000] }; // [Tam, Hafif/Kapalı]
const FPS = { full: 60, lite: 30 };
const INTRO_S = 1.6; // toplanma süresi (sn)
const STRENGTH = 1.55; // mürekkep koyuluğu (yazı arkası değil, ön planda şekil)

// paylaşılan döngü: görünen canlı şekil varsa tek rAF
const live = new Set();
let raf = 0;
let clock = 0;
let lastNow = 0;
function tick(now) {
  raf = 0;
  if (!live.size) return;
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  clock += dt;
  for (const f of live) f.frame(now, clock);
  raf = requestAnimationFrame(tick);
}
function wake() {
  if (raf) return;
  lastNow = performance.now();
  raf = requestAnimationFrame(tick);
}

export function parseShapes(raw) {
  const out = [];
  for (const tok of String(raw || '').split(/[\s,]+/)) {
    if (!tok) continue;
    const k = /^\d+$/.test(tok) ? Number(tok) : SCENE[tok];
    if (Number.isInteger(k) && k >= 0 && k < FORMATION_COUNT) out.push(k);
  }
  return out;
}

export function mount(fig, ctx = {}) {
  const fx = ctx.fx;
  // yalnızca şekil kutusu (ana sayfadaki alan listesinin data-fig açıklama özniteliğiyle karışmasın)
  if (!fig || !fig.classList.contains('fig') || fig.dataset.shapesLive) return undefined;
  if (matchMedia('(prefers-contrast: more)').matches) return undefined;
  const main = ctx.main?.matches?.('main') ? ctx.main : fig.closest('main') || document.querySelector('main');
  const scope = fig.closest('.sheet') || main || document.body;
  const raw = (fig.dataset.shapes || '').trim() || main?.dataset.shapes || main?.dataset.scene || '';
  const shapes = parseShapes(raw);
  if (!shapes.length) return undefined;
  fig.dataset.shapesLive = '1';

  const still = !fx || fx.tier === 'off';
  const lite = !still && fx.tier !== 'full';
  const kind = fig.classList.contains('fig--side') ? 'side' : fig.classList.contains('fig--pv') ? 'pv' : 'lead';
  let canvas = fig.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'fig__cv';
    fig.prepend(canvas);
  }
  const cap = fig.querySelector('.fig__cap');
  const ink = createInk(canvas, { points: POINTS[kind][lite || still ? 1 : 0], strength: STRENGTH });
  const dprMax = lite ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const minDt = 1000 / (lite ? FPS.lite : FPS.full);
  const ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, k: 0, at: -1e9 };
  // bölüm işaretleri (kapsam içinde, belge sırasıyla)
  const marks = [...scope.querySelectorAll('[data-shape-at]')]
    .map((el) => ({ el, k: parseShapes(el.dataset.shapeAt)[0] }))
    .filter((m) => m.k !== undefined);
  // üzerine gelinen öğenin şekli: kaydırma şeklinin üstüne biner. cur: gösterilen, m: ağırlığı (0…1), want: istenen (−1 = yok)
  const hov = { cur: -1, want: -1, m: 0 };
  let W = 0;
  let H = 0;
  let last = 0;
  let prevT = -1;
  let introAt = -1;
  let capShape = -1;
  let uS = null;
  let pS = null;
  let dead = false;
  let pending = 0;

  // kenar şekli: yapışkan yan sütunda kalan boşluğa sığar; mobil düzende (yapışkan değil) ya da yer yoksa gizlenir
  function fitSide() {
    if (kind !== 'side') return;
    const side = fig.parentElement;
    const cs = getComputedStyle(side);
    const figCs = getComputedStyle(fig);
    if (cs.position !== 'sticky') {
      fig.classList.add('is-off');
      return;
    }
    const top = parseFloat(cs.top) || 0;
    // kullanılan yükseklik: şekilden ÖNCEKİ kardeşlerin alt kenarı (yan sütunun kendi kutusu içerikten kısa olabilir)
    const sr = side.getBoundingClientRect();
    let used = 0;
    for (const ch of side.children) {
      if (ch === fig) break;
      if (ch.getClientRects().length) used = Math.max(used, ch.getBoundingClientRect().bottom - sr.top);
    }
    // yan sütun ızgara/esnek kutuysa öğeler arası boşluk da şeklin üstüne eklenir
    const gap = /grid|flex/.test(cs.display) ? parseFloat(cs.rowGap) || 0 : 0;
    // yan sütunun kendi yükseklik sınırı varsa (ör. hukuki metinlerde kendi içinde kayan içindekiler) şekil o sınırın içinde kalır
    const maxH = parseFloat(cs.maxHeight);
    const floor = Number.isFinite(maxH) ? Math.min(innerHeight - 28, top + maxH - 8) : innerHeight - 28;
    const capH = cap ? cap.getBoundingClientRect().height || 44 : 0;
    const w = fig.parentElement.getBoundingClientRect().width;
    const avail = floor - top - used - gap - (parseFloat(figCs.marginTop) || 32) - capH;
    const h = Math.min(Math.round(avail), Math.round(w * 1.05));
    if (h < 150) {
      fig.classList.add('is-off');
      return;
    }
    fig.classList.remove('is-off');
    fig.style.setProperty('--fig-h', `${h}px`);
  }

  function measure() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w;
    H = h;
    ink.resize(W, H, dprMax);
  }

  // dönüş: salınımlı şekiller ±sway, diğerleri yavaşça döner
  const turn = (k, t) => {
    const F = FORMATIONS[k];
    return F.sway ? Math.sin(t * 0.24) * F.sway : (F.spin ?? 1) * t * 0.05;
  };

  function frame(now, t) {
    if (dead) return;
    if (!still && now - last < minDt - 2) return;
    last = now;
    measure();
    if (!W || !H) return;
    const vh = innerHeight;
    const cr = canvas.getBoundingClientRect();
    const vis = clamp((Math.min(cr.bottom, vh) - Math.max(cr.top, 0)) / Math.max(1, cr.height));
    if (!still && vis < 0.01) return;
    const dtf = prevT < 0 ? 0 : Math.min(0.1, Math.max(0, t - prevT));
    prevT = t;
    if (introAt < 0 && vis > 0.2) introAt = t;
    const intro = still ? 1 : introAt < 0 ? 0 : clamp((t - introAt) / INTRO_S);
    const ease = (rate) => (still ? 1 : 1 - Math.exp(-dtf * rate));

    // kaydırma durumu → şekil çifti (a, b) ve dönüşüm (mix); hızlı kaydırmada da dönüşüm zamana yayılır
    let a;
    let b;
    let mix = 0;
    if (marks.length) {
      const line = vh * 0.5;
      let u = 0;
      for (const m of marks) if (m.el.getClientRects().length) u += clamp((line - m.el.getBoundingClientRect().top) / (vh * 0.5));
      uS = uS === null ? u : uS + (u - uS) * ease(2.3);
      const seq = [shapes[0], ...marks.map((m) => m.k)];
      const i = Math.min(marks.length, Math.floor(uS + 1e-6));
      a = seq[i];
      b = seq[i + 1] ?? a;
      mix = i < marks.length ? smoothstep(0, 1, uS - i) : 0;
    } else {
      const sr = scope.getBoundingClientRect();
      const tall = sr.height > vh * 1.35;
      const p = tall ? clamp(-sr.top / Math.max(1, sr.height - vh)) : clamp((vh - sr.top) / (vh + sr.height));
      pS = pS === null ? p : pS + (p - pS) * ease(2.3);
      const n = shapes.length;
      const x = pS * n;
      const i = Math.min(n - 1, Math.floor(x));
      mix = i < n - 1 ? smoothstep(0.3, 0.95, x - i) : 0;
      a = shapes[i];
      b = i < n - 1 ? shapes[i + 1] : a;
    }
    // üzerine gelinen öğe: önce eskisi söner, sonra yenisi belirir
    const r = ease(7);
    if (hov.cur !== hov.want) {
      hov.m -= hov.m * r;
      if (hov.m < 0.02 || still) {
        hov.m = 0;
        hov.cur = hov.want;
      }
    }
    if (hov.cur === hov.want && hov.cur >= 0) hov.m += (1 - hov.m) * r;
    if (hov.cur >= 0 && hov.m > 0.004) {
      const base = mix < 0.5 ? a : b;
      if (base !== hov.cur) {
        a = base;
        b = hov.cur;
        mix = smoothstep(0, 1, hov.m);
      } else {
        a = base;
        b = base;
        mix = 0;
      }
    }
    if (still && mix > 0) {
      // hareketsiz katman: ara kare yok
      a = mix >= 0.5 ? b : a;
      b = a;
      mix = 0;
    }
    const tt = still ? 0 : t;
    const yaw = turn(a, tt) * (1 - mix) + turn(b, tt) * mix;
    // fare lensi (yalnızca Tam): son 1,8 sn içinde şeklin üstünde hareket varsa açık
    let lens = null;
    if (!lite && !still) {
      const kt = now - ptr.at < 1800 && ptr.tx > cr.left && ptr.tx < cr.right && ptr.ty > cr.top && ptr.ty < cr.bottom ? 1 : 0;
      ptr.k += (kt - ptr.k) * 0.14;
      if (ptr.k < 0.004 && !kt) ptr.k = 0;
      ptr.x += (ptr.tx - ptr.x) * 0.5;
      ptr.y += (ptr.ty - ptr.y) * 0.5;
      if (ptr.k > 0.004) lens = { x: ptr.x - cr.left, y: ptr.y - cr.top, k: ptr.k };
    }
    ink.draw({
      a,
      b,
      mix,
      t: tt,
      intro,
      yaw,
      pitch: 0,
      fit: { w: W * 0.94, h: H * 0.92 },
      cx: W / 2,
      cy: H / 2,
      ptr: lens,
      alpha: still ? 1 : smoothstep(0.02, 0.35, vis),
    });
    // açıklama: baskın şekle göre
    const shown = mix < 0.5 ? a : b;
    if (cap && shown !== capShape) {
      capShape = shown;
      const text = FORMATIONS[shown].figure || '';
      cap.textContent = text ? `Şekil · ${text}` : '';
      if (!still) {
        cap.classList.remove('is-in');
        void cap.offsetWidth; // animasyonu yeniden başlat
        cap.classList.add('is-in');
      }
    }
  }
  const inst = { frame };

  // hareketsiz katman: yalnızca gerektiğinde tek kare
  function redraw() {
    if (pending || dead) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      frame(performance.now(), 0);
    });
  }

  // ——— üzerine gelme / odak
  let intentT = 0;
  let leaveT = 0;
  const hoverOf = (el) => (el && el.closest ? el.closest('[data-shape-hover]') : null);
  const setWant = (k) => {
    hov.want = k;
    if (still) redraw();
  };
  const aim = (el) => {
    clearTimeout(intentT);
    clearTimeout(leaveT);
    const k = parseShapes(el.dataset.shapeHover)[0];
    if (k === undefined) return;
    // kısa bekleme: imleç satırların üstünden geçerken şekil titremesin
    intentT = setTimeout(() => setWant(k), 90);
  };
  const release = () => {
    clearTimeout(intentT);
    clearTimeout(leaveT);
    leaveT = setTimeout(() => setWant(-1), 160);
  };
  const onOver = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = hoverOf(e.target);
    if (el && scope.contains(el)) aim(el);
  };
  const onOut = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (!hoverOf(e.relatedTarget)) release();
  };
  const onFocusIn = (e) => {
    const el = hoverOf(e.target);
    if (el && e.target.matches && e.target.matches(':focus-visible')) aim(el);
  };
  const onFocusOut = (e) => {
    if (!hoverOf(e.relatedTarget)) release();
  };
  scope.addEventListener('pointerover', onOver);
  scope.addEventListener('pointerout', onOut);
  scope.addEventListener('focusin', onFocusIn);
  scope.addEventListener('focusout', onFocusOut);

  // ——— görünürlük, boyut, fare
  const io = new IntersectionObserver(
    ([en]) => {
      if (dead) return;
      if (still) {
        if (en.isIntersecting) redraw();
        return;
      }
      if (en.isIntersecting) {
        live.add(inst);
        wake();
      } else live.delete(inst);
    },
    { rootMargin: '10% 0px 10% 0px' }
  );
  io.observe(fig);
  const ro = new ResizeObserver(() => {
    fitSide();
    measure();
    if (still) redraw();
  });
  ro.observe(fig);
  if (kind === 'side') ro.observe(fig.parentElement);
  const onResize = () => {
    fitSide();
    if (still) redraw();
  };
  addEventListener('resize', onResize, { passive: true });
  const onScrollStill = () => redraw();
  if (still && marks.length) addEventListener('scroll', onScrollStill, { passive: true });
  const onMove = (e) => {
    ptr.tx = e.clientX;
    ptr.ty = e.clientY;
    ptr.at = performance.now();
    if (!ptr.k) {
      ptr.x = ptr.tx;
      ptr.y = ptr.ty;
    }
  };
  if (!lite && !still) fig.addEventListener('pointermove', onMove, { passive: true });
  fitSide();
  measure();
  if (still) redraw();

  return () => {
    dead = true;
    live.delete(inst);
    if (pending) cancelAnimationFrame(pending);
    io.disconnect();
    ro.disconnect();
    removeEventListener('resize', onResize);
    removeEventListener('scroll', onScrollStill);
    fig.removeEventListener('pointermove', onMove);
    clearTimeout(intentT);
    clearTimeout(leaveT);
    scope.removeEventListener('pointerover', onOver);
    scope.removeEventListener('pointerout', onOut);
    scope.removeEventListener('focusin', onFocusIn);
    scope.removeEventListener('focusout', onFocusOut);
    ink.dispose();
    delete fig.dataset.shapesLive;
    if (cap) cap.textContent = '';
    const c2 = canvas.getContext('2d');
    c2 && c2.clearRect(0, 0, canvas.width, canvas.height);
  };
}

export default mount;
