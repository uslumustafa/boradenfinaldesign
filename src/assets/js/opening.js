// Açılış sahnesi (yalnızca ana sayfaya ilk gelişte; başlangıç kararı base.njk'deki erken betikte verilir → html.is-opening).
//   ~2,2 sn: koyu perde üstünde kuruluş yılı sayaçla belirir, ardından perde ortadan dışa doğru PİKSEL PİKSEL çözülür ve
//   altındaki ana sahne (parçacık alanı + başlık) açılır. Her zaman atlanabilir: tıklama, Esc/Enter/Boşluk, kaydırma, «Girişi atla».
// İçerik asla bu sahneye bağlı değildir: perde yalnızca üstte durur; JS gelmezse base.njk'deki güvenlik ağı onu kaldırır.
// Depolama yok (çerez, localStorage, sessionStorage kullanılmaz); «bir kez» kararı gezinti türü + yönlendirenle verilir.
import { clamp, smoothstep, easeOutExpo, prefersReduced } from './util.js';

const COLORS = ['#1e759d', '#b83030', '#007a31']; // marka tonları (logo dosyasından örneklenmiş değerler; yalnızca tek tek piksel parıltısı)

export function playOpening({ onReveal, onDone }) {
  const html = document.documentElement;
  const root = document.querySelector('.open');
  const skipBtn = document.querySelector('[data-open-skip]');
  let revealed = false;
  let finished = false;
  let cleanupFn = () => {};
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    try {
      onReveal();
    } catch (e) {
      /* yoksay */
    }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    reveal();
    cleanupFn();
    if (root) {
      // atlamada kısa bir sönme; doğal bitişte perde zaten tamamen saydamdır
      root.classList.add('is-out');
      setTimeout(() => {
        html.classList.remove('is-opening');
        root.classList.remove('is-out');
      }, 320);
    } else html.classList.remove('is-opening');
    try {
      onDone();
    } catch (e) {
      /* yoksay */
    }
  };
  if (!root || prefersReduced()) {
    finish();
    return () => {};
  }

  const cv = root.querySelector('.open__cv');
  const mid = root.querySelector('.open__mid');
  const yearEl = root.querySelector('[data-open-year]');
  const ctx = cv.getContext('2d');
  const YEAR = Number(yearEl?.dataset.year) || 1993;
  const T_ROLL = 950; // sayaç (ms)
  const T_HOLD = 1280; // perde çözülmeye başlar
  const T_DISS = 1000; // çözülme süresi
  const T_END = T_HOLD + T_DISS + 80;

  let W = 0;
  let H = 0;
  let cell = 56;
  let cols = 0;
  let rows = 0;
  let cells = [];
  function layout() {
    W = innerWidth;
    H = innerHeight;
    cv.width = W;
    cv.height = H;
    cell = W < 700 ? 40 : 56;
    cols = Math.ceil(W / cell);
    rows = Math.ceil(H / cell);
    cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = (c + 0.5) / cols - 0.5;
        const ny = (r + 0.5) / rows - 0.5;
        const noise = Math.random();
        // merkezden dışa: uzaklık + gürültü (piksel piksel çözülme)
        const d = clamp(Math.hypot(nx * 1.15, ny) * 1.25 + (noise - 0.5) * 0.3, 0, 1);
        const v = Math.floor(Math.random() * 9);
        cells.push({ x: c * cell, y: r * cell, d, shade: `rgb(${8 + v},${19 + Math.round(v * 1.3)},${42 + v * 2})`, accent: Math.random() < 0.035 ? COLORS[Math.floor(Math.random() * 3)] : null });
      }
    }
  }
  layout();
  const onResize = () => layout();
  addEventListener('resize', onResize);

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const k = clamp((t - T_HOLD) / T_DISS); // 0..1 çözülme ilerlemesi
    for (const c of cells) {
      // her hücre kendi anında açılır: d küçük → önce
      const a = 1 - smoothstep(c.d * 0.62, c.d * 0.62 + 0.38, k);
      if (a <= 0.003) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = c.shade;
      ctx.fillRect(c.x, c.y, cell + 0.5, cell + 0.5);
      if (c.accent && k > 0) {
        // çözülürken marka renginde kısa bir parıltı
        const glow = Math.sin(clamp((k - c.d * 0.62) / 0.38) * Math.PI);
        if (glow > 0.02) {
          ctx.globalAlpha = a * glow * 0.9;
          ctx.fillStyle = c.accent;
          ctx.fillRect(c.x + 2, c.y + 2, cell - 4, cell - 4);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ilk kare: perde tuvale devredilir (JS gelene kadar CSS arka planı örter → ana sahne bir an bile görünmez)
  draw(0);
  root.classList.add('is-live');

  let t0 = 0;
  let raf = 0;
  function tick(now) {
    if (finished) return;
    if (!t0) t0 = now;
    const t = now - t0;
    // sayaç: 1900 → kuruluş yılı (yavaşlayarak)
    const roll = easeOutExpo(clamp(t / T_ROLL));
    if (yearEl) yearEl.textContent = String(Math.round(1900 + (YEAR - 1900) * roll));
    root.style.setProperty('--ot', clamp(t / T_ROLL).toFixed(3));
    // yıl/etiket perde çözülmeden hemen önce söner
    if (mid) mid.style.opacity = String(1 - smoothstep(T_HOLD - 120, T_HOLD + 260, t));
    if (t >= T_HOLD) reveal();
    draw(t);
    if (t >= T_END) return finish();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // atlama yolları
  const skip = () => finish();
  const onKey = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip();
  };
  root.addEventListener('pointerdown', skip);
  skipBtn?.addEventListener('click', skip);
  addEventListener('keydown', onKey);
  addEventListener('wheel', skip, { passive: true, once: true });
  addEventListener('touchmove', skip, { passive: true, once: true });

  function cleanup() {
    cancelAnimationFrame(raf);
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKey);
    removeEventListener('wheel', skip);
    removeEventListener('touchmove', skip);
    root.removeEventListener('pointerdown', skip);
    skipBtn?.removeEventListener('click', skip);
    ctx.clearRect(0, 0, W, H);
  }
  cleanupFn = cleanup;
  return skip;
}
