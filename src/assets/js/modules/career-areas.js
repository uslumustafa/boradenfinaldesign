// Kariyer · çalışma alanları — sayfa modülü (<div class="cr-areas" data-module="career-areas">).
// Geniş ekranda (≥ 1000 px) liste + yanda önizleme paneli: satırın üzerine gelmek, tıklamak ya da içine odaklanmak o alanı etkinleştirir.
// Diğer alanların metinleri görsel olarak gizlenir ama erişilebilirlik ağacında kalır (ekran okuyucu sırayla okur; odaklanınca görünür).
// «Bu alan için başvurun» → başvuru formundaki alan seçilir, forma kaydırılır, ilk alana odaklanılır.
// JS yokken/dar ekranda: tüm metinler satırların altında görünür (CSS).
export function mount(el, ctx) {
  const items = Array.from(el.querySelectorAll('[data-cr-area]'));
  if (!items.length) return undefined;
  const motion = () => ctx.fx && ctx.fx.tier !== 'off';
  const wide = matchMedia('(min-width: 1000px)');
  let active = Math.max(0, items.findIndex((it) => it.classList.contains('is-active')));
  let timer = 0;
  el.classList.add('is-live');

  const set = (i) => {
    if (i === active) return;
    active = i;
    items.forEach((it, k) => it.classList.toggle('is-active', k === i));
  };
  const offs = [];
  const on = (node, ev, fn) => {
    node.addEventListener(ev, fn);
    offs.push(() => node.removeEventListener(ev, fn));
  };

  items.forEach((it, i) => {
    const row = it.querySelector('.cr-area__row');
    if (row) {
      on(row, 'pointerenter', () => wide.matches && set(i));
      on(row, 'click', () => set(i));
    }
    on(it, 'focusin', () => set(i));
  });

  // alan seçip forma geç
  on(el, 'click', (e) => {
    const a = e.target.closest('[data-cr-pick]');
    if (!a) return;
    const form = ctx.root.querySelector('#cr-form');
    const sel = form && form.elements.alan;
    if (!sel || !Array.from(sel.options).some((o) => o.value === a.dataset.crPick)) return; // normal çapa davranışı
    e.preventDefault();
    sel.value = a.dataset.crPick;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const target = ctx.root.querySelector('#basvuru') || form;
    target.scrollIntoView({ block: 'start', behavior: motion() ? 'smooth' : 'auto' });
    history.replaceState(history.state, '', '#basvuru');
    const live = ctx.root.querySelector('[data-fk-live]');
    if (live) live.textContent = `İlgilendiğiniz alan seçildi: ${sel.selectedOptions[0].textContent.trim()}.`;
    const first = form.querySelector('input[type="text"], input[type="email"], textarea');
    clearTimeout(timer);
    timer = setTimeout(() => first && !form.hidden && first.focus({ preventScroll: true }), motion() ? 650 : 0);
  });

  return () => {
    clearTimeout(timer);
    offs.forEach((fn) => fn());
    el.classList.remove('is-live');
  };
}
