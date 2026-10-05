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
let introWanted = opening; // ilk kurulan dünya toplanma animasyonuyla başlar (sonraki yeniden kurulumlar hazır gelir)

// 3B dünya köprüsü: world.js yüklenene kadar çağrıları hatırlar
const world = {
  impl: null,
  _target: 0,
  _lift: 0,
  _side: 1,
  _visible: false,
  _assemble: false,
  target(v, lift = 0, side = 1) {
    this._target = v;
    this._lift = lift;
    this._side = side;
    this.impl?.target(v, lift, side);
  },
  setVisible(b) {
    this._visible = b;
    this.impl?.setVisible(b);
  },
  // açılış: noktalar dağınık hâlden toplanır (dünya henüz yüklenmediyse yüklenince)
  assemble() {
    this._assemble = true;
    this.impl?.assemble?.();
  },
  // «BORADEN» anı: noktalar kelimeyi oluşturur (true) / hero şekline döner (false)
  word(on, text) {
    this.impl?.word?.(on, text);
  },
  // sayfa geçişi: noktalar (x, y) NDC noktasından dışarı akar (on) / yeni sayfada şekle oturur (!on)
  surge(on, x, y) {
    this.impl?.surge?.(on, x, y);
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
          world.assemble();
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
      world.assemble();
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
    const impl = await mod.createWorld({ fx, canvas: document.getElementById('world-canvas'), intro: introWanted });
    if (id !== worldBoot || fx.tier === 'off') {
      impl?.destroy();
      return;
    }
    introWanted = false;
    if (!impl) {
      fx.set('off');
      return;
    }
    world.impl = impl;
    impl.target(world._target, world._lift, world._side);
    impl.setVisible(world._visible);
    if (world._assemble) impl.assemble?.();
  } catch (err) {
    if (id !== worldBoot || fx.tier === 'off') return;
    console.warn('[dünya] başlatılamadı, efektler kapatıldı:', err);
    fx.set('off');
  }
}
bootWorld();

fx.onChange((tier) => {
  // katman değişince dünyayı yeni parametrelerle yeniden kur
  ++worldBoot;
  world.impl?.destroy();
  world.impl = null;
  html.classList.remove('fx-live');
  if (tier !== 'off') bootWorld();
  behaviors.refreshMotion(document.getElementById('main'));
});
