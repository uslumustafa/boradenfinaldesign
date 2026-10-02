
// Mıknatıslı düğmeler: ana düğmeler (`.btn`, `[data-magnetic]`) fare yaklaşınca ona doğru belirgin biçimde çekilir
// (hafifçe büyür), fare uzaklaşınca yaylı bir sekmeyle yerine döner. Özel imleç/halka YOKTUR: yerel imleç aynen kalır.
//   • Yalnızca hassas işaretçide (fare / izleme paneli) ve Tam/Hafif katmanda kurulur; «Kapalı» ve hareket azaltmada kurulmaz.
//   • Yalnızca `translate`/`scale` özelliklerini yazar (düzeni ve diğer dönüşümleri bozmaz); iç ok simgesi CSS'ten `--mx/--my` ile kayar.
//   • Aynı anda yalnızca fareye en yakın düğme çekilir. Olay delegasyonu: sayfa geçişlerinde yeniden kurulum gerekmez. Depolama yok.
import { clamp } from './util.js';

const MAGNET = '.btn, [data-magnetic]';
const RANGE = 84; // menzil: düğme kenarından px (düğmenin üstündeyken tam güç)
const PULL_X = 0.5; // fare–merkez farkının düğmeye yansıyan oranı
const PULL_Y = 0.6;
const MAX_X = 24; // en fazla kayma (px)
const MAX_Y = 15;
const GROW = 0.05; // yakalanınca büyüme
const K = 0.17; // yay sertliği
const D = 0.76; // sönüm (1'e yakın → daha çok sekme)

export function initPointerFx(fx) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let live = false;
  let cleanup = () => {};

  function start() {
    if (live || !fine.matches || fx.tier === 'off') return;
    live = true;
    const html = document.documentElement;
    const st = new Map(); // düğme → { x, y, s, vx, vy, vs, tx, ty, ts }
    let px = -1e4;
    let py = -1e4;
    let dirty = false;
    let raf = 0;
    let last = 0;

    const reset = (el) => {
      el.style.removeProperty('translate');
      el.style.removeProperty('scale');
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
      el.classList.remove('is-mag');
    };

    // fareye en yakın düğmeyi bulur; yalnızca o çekilir, diğerleri yerine döner
    function retarget() {
      let best = null;
      let bestD = RANGE;
      for (const el of document.querySelectorAll(MAGNET)) {
        if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.closest('[inert],[hidden],[aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
        const s = st.get(el);
        const ox = s ? s.x : 0; // ölçüm, mevcut kaymayı da içerir → geri al (geri besleme titremesi olmasın)
        const oy = s ? s.y : 0;
        const left = r.left - ox;
        const right = r.right - ox;
        const top = r.top - oy;
        const bottom = r.bottom - oy;
        const d = Math.hypot(Math.max(left - px, 0, px - right), Math.max(top - py, 0, py - bottom));
        if (d < bestD) {
          bestD = d;
          best = { el, cx: (left + right) / 2, cy: (top + bottom) / 2, d };
        }
      }
      for (const s of st.values()) {
        s.tx = 0;
        s.ty = 0;
        s.ts = 1;
      }
      if (best) {
        let s = st.get(best.el);
        if (!s) {
          s = { x: 0, y: 0, s: 1, vx: 0, vy: 0, vs: 0, tx: 0, ty: 0, ts: 1 };
          st.set(best.el, s);
          best.el.classList.add('is-mag');
        }
        const k = 1 - best.d / RANGE; // 0 (menzil kenarı) … 1 (düğme üstü)
        const g = 0.35 + 0.65 * (k * k * (3 - 2 * k));
        s.tx = clamp((px - best.cx) * PULL_X * g, -MAX_X, MAX_X);
        s.ty = clamp((py - best.cy) * PULL_Y * g, -MAX_Y, MAX_Y);
        s.ts = 1 + GROW * k;
      }
    }

    function step(now) {
      raf = 0;
      if (dirty) {
        dirty = false;
        retarget();
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const f = dt * 60; // 60 fps = 1
      const damp = Math.pow(D, f);
      let busy = false;
      for (const [el, s] of st) {
        if (!el.isConnected) {
          st.delete(el);
          continue;
        }
        s.vx = (s.vx + (s.tx - s.x) * K * f) * damp;
        s.vy = (s.vy + (s.ty - s.y) * K * f) * damp;
        s.vs = (s.vs + (s.ts - s.s) * K * f) * damp;
        s.x += s.vx * f;
        s.y += s.vy * f;
        s.s += s.vs * f;
        const rest = Math.abs(s.tx - s.x) < 0.04 && Math.abs(s.ty - s.y) < 0.04 && Math.abs(s.vx) < 0.02 && Math.abs(s.vy) < 0.02 && Math.abs(s.ts - s.s) < 0.0008 && Math.abs(s.vs) < 0.0004;
        if (rest && s.tx === 0 && s.ty === 0 && s.ts === 1) {
          reset(el);
          st.delete(el);
          continue;
        }
        el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
        el.style.scale = s.s.toFixed(4);
        el.style.setProperty('--mx', s.x.toFixed(2) + 'px');
        el.style.setProperty('--my', s.y.toFixed(2) + 'px');
        if (!rest) busy = true;
      }
      if (busy || dirty) raf = requestAnimationFrame(step);
    }
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX;
      py = e.clientY;
      dirty = true;
      wake();
    };
    const onLeave = () => {
      px = py = -1e4;
      dirty = true;
      wake();
    };
    const onScroll = () => {
      if (!st.size && px < -1e3) return;
      dirty = true;
      wake();
    };

    addEventListener('pointermove', onMove, { passive: true });
    html.addEventListener('mouseleave', onLeave);
    addEventListener('blur', onLeave);
    addEventListener('scroll', onScroll, { passive: true });

    cleanup = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      removeEventListener('pointermove', onMove);
      html.removeEventListener('mouseleave', onLeave);
      removeEventListener('blur', onLeave);
      removeEventListener('scroll', onScroll);
      for (const el of st.keys()) reset(el);
      st.clear();
      live = false;
    };
  }

  function stop() {
    cleanup();
    cleanup = () => {};
  }

  start();
  fx.onChange((tier) => (tier === 'off' ? stop() : start()));
  fine.addEventListener?.('change', () => (fine.matches ? start() : stop()));
}
