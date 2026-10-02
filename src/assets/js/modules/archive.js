// Sirküler arşivi (modules/_template.js sözleşmesi).
//   <section id="arsiv" data-listing="arsiv" data-per-page="20" data-module="archive"> … </section>
// Süzme (yıl), arama ve sayfalama listing.js ile yapılır; bu modül yalnızca küçük eklemeler yapar:
//   1) Sayfa yönlendiriciyle açıldığında adresteki #arsiv çapasına kaydırır (ör. merkezdeki yıl grafiğinden ?yil=2020#arsiv).
//   2) Arama kutusunda Esc aramayı temizler (listing.js'e "input" olayıyla bildirilir).
export function mount(el, { fx }) {
  const input = el.querySelector('[data-search]');
  let raf = 0;

  if (el.id && location.hash === `#${el.id}`) {
    raf = requestAnimationFrame(() => {
      raf = 0;
      el.scrollIntoView({ block: 'start', behavior: fx.tier === 'off' ? 'auto' : 'smooth' });
    });
  }

  const onKey = (e) => {
    if (e.key !== 'Escape' || !input.value) return;
    e.preventDefault();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  input?.addEventListener('keydown', onKey);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    input?.removeEventListener('keydown', onKey);
  };
}
