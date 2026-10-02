// Sektör dizini (/sektorler/): satır üzerine gelince ya da klavyeyle odaklanınca yan paneldeki önizlemeyi değiştirir.
// Panel yalnızca görseldir (aria-hidden); aynı bilgi sektör sayfalarında ve dar ekranda satır içi <details> ile erişilebilir.
// JS yokken panel ilk sektörü gösterir, satırlar doğrudan sektör sayfalarına bağlanır.
// Wagtail: şablon aynı data-* özniteliklerini korur; bu dosya statik olarak aynen kullanılır.
export function mount(el) {
  const rows = Array.from(el.querySelectorAll('[data-sx-row]'));
  const cards = new Map(Array.from(el.querySelectorAll('[data-sx-card]')).map((c) => [c.dataset.sxCard, c]));
  if (!rows.length || !cards.size) return undefined;
  const wide = matchMedia('(min-width: 1024px)');
  let cur = null;
  let timer = 0;

  const show = (slug) => {
    if (slug === cur || !cards.has(slug)) return;
    cur = slug;
    cards.forEach((c, k) => c.classList.toggle('is-on', k === slug));
    rows.forEach((r) => r.classList.toggle('is-active', r.dataset.sxRow === slug));
  };
  // fare satırlar üzerinden hızla geçerken paneli titretmemek için kısa gecikme
  const onOver = (e) => {
    const r = e.target.closest('[data-sx-row]');
    if (!r || !el.contains(r) || !wide.matches) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(r.dataset.sxRow), 60);
  };
  const onFocus = (e) => {
    const r = e.target.closest('[data-sx-row]');
    if (r && el.contains(r)) show(r.dataset.sxRow);
  };
  el.addEventListener('pointerover', onOver);
  el.addEventListener('focusin', onFocus);
  show(rows[0].dataset.sxRow);
  return () => {
    clearTimeout(timer);
    el.removeEventListener('pointerover', onOver);
    el.removeEventListener('focusin', onFocus);
  };
}
