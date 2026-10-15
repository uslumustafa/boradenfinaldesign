// Boraden — ön yüz giriş noktası
import { initFx } from './fx.js';
import { createScroll } from './scroll.js';
import { initChrome } from './chrome.js';
import { initRouter } from './router.js';
import { createBehaviors } from './behaviors.js';

window.__boraden = true;
const html = document.documentElement;
const fx = initFx();
const scroll = createScroll();
const mainEl = document.getElementById('main');

// Açılış sahnesi: karar base.njk'deki erken betikte verilir (html.is-opening); burada yalnızca oynatılır.
let opening = html.classList.contains('is-opening') && fx.tier !== 'off';
// efektler kapalı çıktıysa perde oynatılmaz; beklemeden kalkar (yoksa 7 sn'lik güvenlik süresine dek sayfayı örtüyordu)
if (!opening) html.classList.remove('is-opening');
// Perde kalkınca kahramanın video posteri görünür. 3B dünya kahramanda çizilmediği için (Ekim 2026) açılışta noktaların toplanma
// animasyonu (world.js › assemble/uIntro) kullanılmaz: dünya ilk şeklini, her yüklemede olduğu gibi, ilk koyu bölümünde toplayarak çizer.

// 3B dünya köprüsü: world.js yüklenene kadar çağrıları hatırlar
const world = {
  impl: null,
  _target: 0,
  _lift: 0,
  _side: 1,
  _cover: 1,
  _visible: false,
  // cover: seçili bölümün görünen payı (toplanma eşiği); cut: bitişik olmayan koyu bölüme geçiş (dönüşüm yerine toplanma)
  target(v, lift = 0, side = 1, cover = 1, cut = false) {
    this._target = v;
    this._lift = lift;
    this._side = side;
    this._cover = cover;
    this.impl?.target(v, lift, side, cover, cut);
  },
  setVisible(b) {
    this._visible = b;
    this.impl?.setVisible(b);
  },
  // «BORADEN» anı: noktalar kelimeyi oluşturur (true) / önceki şekle döner (false). Ekim 2026'dan beri hiçbir sayfa kullanmıyor
  // (ana sayfa kahramanının zemini videoya geçti, modules/swipe-word.js kaldırıldı); dünya motorundaki karşılığı yerinde duruyor.
  word(on, text) {
    this.impl?.word?.(on, text);
  },
  // sayfa geçişi: noktalar (x, y) NDC noktasından dışarı akar (on) / yeni sayfada şekle oturur (!on).
  // Döndürür: çıkışın bitmesine kalan süre (ms; dünya yoksa undefined)
  surge(on, x, y) {
    return this.impl?.surge?.(on, x, y);
  },
  get live() {
    return !!this.impl;
  },
};

const behaviors = createBehaviors({ fx, scroll, world });
const chrome = initChrome(fx);
behaviors.mount(mainEl);
initRouter({ fx, world, mount: behaviors.mount, unmount: behaviors.unmount, onNavigate: chrome.onNavigate });
chrome.onNavigate(location.pathname);

function ready() {
  html.classList.add('is-ready');
}
if (opening) {
  import('./opening.js')
    .then((m) =>
      m.playOpening({
        onReveal() {
          ready();
        },
        onDone() {
          opening = false;
        },
      })
    )
    .catch((err) => {
      console.warn('[açılış] oynatılamadı:', err);
      opening = false;
      html.classList.remove('is-opening');
      ready();
    });
} else {
  // ilk boyamadan sonra açılış animasyonlarını başlat
  requestAnimationFrame(() => requestAnimationFrame(ready));
}

let worldBoot = 0;
async function bootWorld() {
  if (fx.tier === 'off' || world.impl) return;
  const id = ++worldBoot;
  try {
    const mod = await import('./world/world.js');
    if (id !== worldBoot || fx.tier === 'off') return;
    const impl = await mod.createWorld({ fx, canvas: document.getElementById('world-canvas') });
    if (id !== worldBoot || fx.tier === 'off') {
      impl?.destroy();
      return;
    }
    if (!impl) {
      fx.set('off');
      return;
    }
    world.impl = impl;
    impl.target(world._target, world._lift, world._side, world._cover);
    impl.setVisible(world._visible);
  } catch (err) {
    if (id !== worldBoot || fx.tier === 'off') return;
    console.warn('[dünya] başlatılamadı, efektler kapatıldı:', err);
    fx.set('off');
  }
}
// 3B dünya ilk görüntüden sonra kurulur (T-07, 4.1): sayfa yüklenip tarayıcı boşalınca. Ağ ve ana iş parçacığı önce metne,
// yazı tiplerine ve görsellere kalır (dünya parçası ≈ 113 KB; kurulumu yavaş telefonda ≈ 0,7 sn). Açılış sahnesi ve geçişler
// dünyayı beklemez: köprü (world) çağrıları hatırlar, dünya gelince uygular.
function afterFirstView(fn) {
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}
afterFirstView(bootWorld);

fx.onChange((tier) => {
  // katman değişince dünyayı yeni parametrelerle yeniden kur
  ++worldBoot;
  world.impl?.destroy();
  world.impl = null;
  html.classList.remove('fx-live');
  if (tier !== 'off') bootWorld();
  behaviors.refreshMotion(document.getElementById('main'));
});
