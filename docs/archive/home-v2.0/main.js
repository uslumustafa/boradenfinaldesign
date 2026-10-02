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

// 3B dünya köprüsü: world.js yüklenene kadar çağrıları hatırlar
const world = {
  impl: null,
  _target: 0,
  _lift: 0,
  _visible: false,
  target(v, lift = 0) {
    this._target = v;
    this._lift = lift;
    this.impl?.target(v, lift);
  },
  setVisible(b) {
    this._visible = b;
    this.impl?.setVisible(b);
  },
};

const behaviors = createBehaviors({ fx, scroll, world });
const chrome = initChrome(fx);
behaviors.mount(mainEl);
initRouter({ fx, mount: behaviors.mount, unmount: behaviors.unmount, onNavigate: chrome.onNavigate });
chrome.onNavigate(location.pathname);

// ilk boyamadan sonra açılış animasyonlarını başlat
requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('is-ready')));

async function bootWorld() {
  if (fx.tier === 'off' || world.impl) return;
  try {
    const mod = await import('./world/world.js');
    const impl = await mod.createWorld({ fx, canvas: document.getElementById('world-canvas') });
    if (!impl) {
      fx.set('off');
      return;
    }
    world.impl = impl;
    impl.target(world._target, world._lift);
    impl.setVisible(world._visible);
  } catch (err) {
    console.warn('[dünya] başlatılamadı, efektler kapatıldı:', err);
    fx.set('off');
  }
}
bootWorld();

fx.onChange((tier) => {
  // katman değişince dünyayı yeni parametrelerle yeniden kur
  world.impl?.destroy();
  world.impl = null;
  html.classList.remove('fx-live');
  if (tier !== 'off') bootWorld();
  behaviors.mount(document.getElementById('main'));
});
