// Yayın sayfası · okuma ilerlemesi (modules/_template.js sözleşmesi).
//   <div class="art" data-module="insights-article"> … <div data-art-body> … </div> … <span data-art-pct></span> … </div>
// Metin sütununun (gövde + kaynaklar) okunan oranını --rp (0..1) olarak yazar: yan paneldeki çubuk ve yüzde ile
// metnin solundaki çizgi bu değerle dolar. Yalnızca görsel bir göstergedir (aria-hidden); JS yoksa gösterilmez.
// Kaydırmayla birebir ilerlediği için efekt kademesinden bağımsız çalışır (geçiş animasyonu yoktur).
export function mount(el, { scroll }) {
  const body = el.querySelector('[data-art-body]');
  if (!body) return undefined;
  const pct = el.querySelector('[data-art-pct]');
  el.classList.add('is-live');
  let last = -1;

  const off = scroll.add(
    body,
    'enter',
    (_p, { rect, vh }) => {
      const line = vh * 0.55; // okuma çizgisi: ekranın biraz altı
      const p = Math.min(1, Math.max(0, (line - rect.top) / Math.max(1, rect.height)));
      const r = Math.round(p * 1000) / 1000;
      if (r === last) return;
      last = r;
      el.style.setProperty('--rp', String(r));
      if (pct) pct.textContent = `%${Math.round(r * 100)}`;
    },
    { cull: false }
  );

  return () => {
    off();
    el.classList.remove('is-live');
    el.style.removeProperty('--rp');
  };
}
