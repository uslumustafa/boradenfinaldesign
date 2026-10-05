// Efekt katmanı: Tam / Hafif / Kapalı. Otomatik algılama + görünür anahtar + uyarlanabilir düşürme.
import { store, prefersReduced } from './util.js';

const KEY = 'boraden-fx';

export function initFx() {
  const html = document.documentElement;
  const listeners = new Set();
  let pref = store(KEY); // 'full' | 'lite' | 'off' | null
  if (!['full', 'lite', 'off'].includes(pref)) pref = null;

  function detect() {
    if (prefersReduced()) return 'off';
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 700;
    if (mem <= 1 || cores <= 2) return 'off';
    if (coarse || small || mem <= 4 || cores <= 4) return 'lite';
    return 'full';
  }

  const fx = {
    tier: pref || detect(),
    auto: !pref,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // kalıcı=true: kullanıcı seçimi (saklanır). false: otomatik düşürme.
    set(tier, persist = false) {
      if (!['full', 'lite', 'off'].includes(tier)) return;
      const changed = fx.tier !== tier;
      fx.tier = tier;
      if (persist) {
        fx.auto = false;
        store(KEY, tier);
      }
      apply();
      if (changed) listeners.forEach((fn) => fn(tier));
    },
    downgrade() {
      if (fx.tier === 'full') fx.set('lite');
      else if (fx.tier === 'lite') fx.set('off');
    },
    params() {
      if (fx.tier === 'full') return { dpr: Math.min(devicePixelRatio || 1, 2), points: 26000, pointer: true, fps: 60 };
      return { dpr: 1, points: 9000, pointer: false, fps: 30 };
    },
  };

  function apply() {
    html.setAttribute('data-fx', fx.tier);
    html.classList.toggle('js-anim', fx.tier !== 'off');
    document.querySelectorAll('[data-fx-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fxSet === fx.tier)));
  }
  apply();
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => {
    if (fx.auto) fx.set(detect());
  });
  fx.refreshSwitches = apply;
  return fx;
}
