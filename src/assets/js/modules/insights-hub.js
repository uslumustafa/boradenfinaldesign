// Bilgi merkezi · son yayınlar önizlemesi (modules/_template.js sözleşmesi).
//   <section data-listing="…" data-module="insights-hub"> … <a data-ic-row …> … <a data-ic-panel aria-hidden="true"> … </section>
// Geniş ekranda bir satırın üzerine gelindiğinde / satıra odaklanıldığında sağdaki panel o yayını gösterir.
// Süzgeç (listing.js) gösterilen satırı gizlerse panel ilk görünür satıra geçer (MutationObserver ile [hidden] izlenir).
// Panel satırın görsel kopyasıdır (aria-hidden, sekme sırasında değil); JS yoksa sunucuda basılan ilk yayını gösterir.
export function mount(el, { fx }) {
  const panel = el.querySelector('[data-ic-panel]');
  const rows = Array.from(el.querySelectorAll('[data-ic-row]'));
  if (!panel || !rows.length) return undefined;

  const slot = (k) => panel.querySelector(`[data-p="${k}"]`);
  const slots = { type: slot('type'), cat: slot('cat'), date: slot('date'), title: slot('title'), sum: slot('sum'), src: slot('src') };
  const itemOf = (r) => r.closest('[data-item]') || r;
  const text = (r, sel) => r.querySelector(sel)?.textContent.trim() || '';
  const set = (node, value) => {
    if (node) node.textContent = value;
  };
  let cur = null;

  function show(row, animate = true) {
    if (!row || row === cur) return;
    cur = row;
    rows.forEach((r) => r.classList.toggle('is-cur', r === row));
    panel.setAttribute('href', row.getAttribute('href'));
    set(slots.type, row.dataset.type || '');
    set(slots.cat, row.dataset.cat || '');
    set(slots.date, row.dataset.date || '');
    set(slots.src, row.dataset.src || '');
    set(slots.title, text(row, '.ic-row__t'));
    set(slots.sum, text(row, '.ic-row__s'));
    if (animate && fx.tier !== 'off') {
      panel.classList.remove('is-swap');
      void panel.offsetWidth; // animasyonu yeniden başlat
      panel.classList.add('is-swap');
    }
  }

  const firstVisible = () => rows.find((r) => !itemOf(r).hidden) || null;
  const onEnter = (e) => {
    const r = e.target.closest && e.target.closest('[data-ic-row]');
    if (r && el.contains(r)) show(r);
  };
  el.addEventListener('pointerover', onEnter);
  el.addEventListener('focusin', onEnter);

  const mo = new MutationObserver(() => {
    if (!cur || itemOf(cur).hidden) {
      cur = null;
      show(firstVisible());
    }
  });
  rows.forEach((r) => mo.observe(itemOf(r), { attributes: true, attributeFilter: ['hidden'] }));

  // başlangıç: ilk görünür satır (süzgeç adres çubuğundan gelmiş olabilir)
  show(firstVisible(), false);

  return () => {
    mo.disconnect();
    el.removeEventListener('pointerover', onEnter);
    el.removeEventListener('focusin', onEnter);
  };
}
