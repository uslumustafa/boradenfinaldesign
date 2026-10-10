// Kaydırma motoru: yerel kaydırma (scroll-jacking yok) + tek rAF döngüsü.
// Öğelere ilerleme değeri (0..1) hesaplar; CSS özel özellikleri ve geri çağırmalarla animasyonu sürer.
// Karede sıra (U-39): önce bütün okumalar (izlenen öğelerin konumu, kare dinleyicileri), sonra yazmalar. Okuma arasına yazma girerse
// tarayıcı stili ve yerleşimi kare içinde yeniden hesaplamak zorunda kalır (yavaş telefonda kaydırma süresinin çoğu buydu).
import { clamp } from './util.js';

export function createScroll() {
  const items = new Map(); // el -> {fn, mode, ...}
  const frameFns = new Set();
  let vh = innerHeight;
  let y = scrollY;
  let raf = 0;
  let lastY = -1;
  let velocity = 0;
  // Sayfa ilerleme çizgisi: --sp yalnızca çizginin kabına yazılır (kökte bütün belgenin stilini her karede geçersiz kılıyordu).
  const bar = document.querySelector('.prog');
  // Kaydırılabilir yükseklik karede okunmaz: yalnızca boyut değişince ölçülür (içerik/sayfa değişimi, pencere boyu).
  let docH = 1;
  const measure = () => {
    docH = Math.max(1, document.documentElement.scrollHeight - vh);
  };

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
    // 1 · oku: izlenen öğelerin konumları (karede tek yerleşim hesabı)
    const reads = [];
    for (const [el, cfg] of items) {
      const rect = el.getBoundingClientRect();
      if (cfg.cull && (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) && cfg.last !== undefined && (cfg.last === 0 || cfg.last === 1)) continue;
      reads.push([el, cfg, rect]);
    }
    // 2 · kare dinleyicileri (bölüm göstergesi, sahne yönetmeni): çoğunlukla okur, yalnızca değişimde yazar → yazmalardan önce
    for (const fn of frameFns) fn({ y, vh, velocity });
    // 3 · yaz
    bar?.style.setProperty('--sp', clamp(y / docH).toFixed(4));
    for (const [el, cfg, rect] of reads) {
      const p = progressOf(el, cfg.mode, rect);
      cfg.last = p;
      cfg.fn(p, { rect, vh, y, el });
    }
    lastY = y;
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', () => {
    vh = innerHeight;
    measure();
    schedule();
  });
  // İçerik yüksekliği değişince (sayfa değişimi, görsel, açılan panel, süzgeç) yeniden ölç; gözlemci yerleşimden sonra çağrılır,
  // ek hesap zorlamaz. Desteklemeyen (çok eski) tarayıcıda yalnızca pencere boyu değişince ve refresh() ile ölçülür.
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      measure();
      schedule();
    }).observe(document.body);
  }
  measure();

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
    refresh() {
      measure();
      schedule();
    },
    clear() {
      items.clear();
    },
  };
}
