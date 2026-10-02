// Kaydırma motoru: yerel kaydırma (scroll-jacking yok) + tek rAF döngüsü.
// Öğelere ilerleme değeri (0..1) hesaplar; CSS özel özellikleri ve geri çağırmalarla animasyonu sürer.
import { clamp } from './util.js';

export function createScroll() {
  const items = new Map(); // el -> {fn, mode, ...}
  const frameFns = new Set();
  let vh = innerHeight;
  let y = scrollY;
  let raf = 0;
  let lastY = -1;
  let velocity = 0;
  const root = document.documentElement;

  function progressOf(el, mode, rect) {
    switch (mode) {
      case 'pin': // yüksek sarmalayıcı içinde sticky sahne
        return clamp(-rect.top / Math.max(1, rect.height - vh));
      case 'enter': // alttan girmeye başlayıp üstten çıkana kadar
        return clamp((vh - rect.top) / (vh + rect.height));
      case 'center': // ortada 0.5
        return (vh / 2 - (rect.top + rect.height / 2)) / vh + 0.5;
      case 'reach': // üstü ekran altına değdiğinde 0, üstü ekran üstüne değdiğinde 1
        return clamp((vh - rect.top) / vh);
      default:
        return clamp((vh - rect.top) / (vh + rect.height));
    }
  }

  function tick() {
    raf = 0;
    y = scrollY;
    velocity = y - lastY;
    const docH = Math.max(1, document.documentElement.scrollHeight - vh);
    root.style.setProperty('--sp', clamp(y / docH).toFixed(4));
    // önce oku
    const reads = [];
    for (const [el, cfg] of items) {
      const rect = el.getBoundingClientRect();
      if (cfg.cull && (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) && cfg.last !== undefined && (cfg.last === 0 || cfg.last === 1)) continue;
      reads.push([el, cfg, rect]);
    }
    // sonra yaz
    for (const [el, cfg, rect] of reads) {
      const p = progressOf(el, cfg.mode, rect);
      cfg.last = p;
      cfg.fn(p, { rect, vh, y, el });
    }
    for (const fn of frameFns) fn({ y, vh, velocity });
    lastY = y;
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', () => {
    vh = innerHeight;
    schedule();
  });

  return {
    get y() {
      return y;
    },
    get vh() {
      return vh;
    },
    // el: izlenen öğe; mode: pin|enter|center|reach; fn(p, info)
    add(el, mode, fn, opts = {}) {
      items.set(el, { mode, fn, cull: opts.cull !== false });
      schedule();
      return () => items.delete(el);
    },
    onFrame(fn) {
      frameFns.add(fn);
      schedule();
      return () => frameFns.delete(fn);
    },
    refresh: schedule,
    clear() {
      items.clear();
    },
  };
}
