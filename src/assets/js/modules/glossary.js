// Sözlük (/bilgi-merkezi/sozluk/): A–Z rayı (kaydırma izleme, boş harfleri pasifleştirme), #çapa ile terimi açma ve vurgulama,
// canlı sonuç sayısı, süzgeç sıfırlama ve yazdırmada tüm «Ayrıntı» bölümlerini açma.
// Süzme ve arama listing.js'tedir (data-listing); bu modül yalnızca onun sonucunu (hidden öznitelikleri) izler.
// JS yokken: tüm terimler, «Ayrıntı» bölümleri ve çapa bağlantıları normal çalışır.
export function mount(el, { fx, scroll }) {
  const railList = el.querySelector('[data-gl-rail-list]');
  const letters = Array.from(el.querySelectorAll('[data-gl-letter]'))
    .map((a) => ({ a, s: document.getElementById(a.dataset.glLetter) }))
    .filter((p) => p.s && el.contains(p.s));
  const terms = Array.from(el.querySelectorAll('.gl-term[data-item]'));
  const search = el.querySelector('[data-search]');
  const countEl = el.querySelector('[data-gl-count]');
  const reset = el.querySelector('[data-gl-reset]');
  const cleanups = [];
  const smoothOrAuto = () => (fx.tier === 'off' ? 'auto' : 'smooth');
  if (reset) reset.hidden = false;

  // ── Kaydırma izleme: etkin harf (gizli harf bölümleri atlanır)
  let cur = -2;
  const spy = (force) => {
    if (!letters.length) return;
    const line = innerHeight * 0.32;
    let idx = -1;
    for (let i = 0; i < letters.length; i++) {
      const { s } = letters[i];
      if (s.hidden) continue;
      if (s.getBoundingClientRect().top <= line) idx = i;
      else break;
    }
    if (idx < 0) idx = letters.findIndex((p) => !p.s.hidden);
    if (idx === cur && !force) return;
    cur = idx;
    letters.forEach(({ a }, i) => {
      const on = i === idx;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    // dar ekranda yatay şeritte etkin harfi ortala (yalnızca şeridin kendi kaydırması; sayfa kaydırılmaz)
    const a = letters[idx] && letters[idx].a;
    if (a && railList && railList.scrollWidth > railList.clientWidth + 2) {
      const ar = a.getBoundingClientRect();
      const lr = railList.getBoundingClientRect();
      const delta = ar.left + ar.width / 2 - (lr.left + lr.width / 2);
      if (Math.abs(delta) > 4) railList.scrollBy({ left: delta, behavior: smoothOrAuto() });
    }
  };

  // ── Sonuç sayısı + raydaki boş harfler (listing.js'in hidden değişikliklerinden sonra)
  let lastCount = -1;
  const paint = () => {
    const n = terms.filter((t) => !t.hidden).length;
    if (countEl && n !== lastCount) {
      lastCount = n;
      countEl.textContent = n === terms.length ? `${n} terim` : n ? `${n} / ${terms.length} terim gösteriliyor` : 'Eşleşen terim yok';
    }
    letters.forEach(({ a, s }) => {
      const off = s.hidden;
      a.classList.toggle('is-off', off);
      if (off) {
        a.setAttribute('aria-disabled', 'true');
        a.tabIndex = -1;
      } else {
        a.removeAttribute('aria-disabled');
        a.removeAttribute('tabindex');
      }
    });
  };
  let raf = 0;
  const mo = new MutationObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      paint();
      spy(true);
    });
  });
  mo.observe(el, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  cleanups.push(() => {
    mo.disconnect();
    cancelAnimationFrame(raf);
  });
  cleanups.push(scroll.onFrame(() => spy(false)));

  // ── Çapa: gerekirse süzgeçleri temizle, terimi aç, vurgula, kaydır
  const clearFilters = () => {
    if (search && search.value) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const all = el.querySelector('[data-filter-by] [data-filter="all"]');
    if (all && all.getAttribute('aria-pressed') !== 'true') all.click();
  };
  let goTimer = 0;
  const go = (id, { smooth = true, focus = false } = {}) => {
    const t = id ? document.getElementById(id) : null;
    if (!t || !el.contains(t)) return false;
    const run = () => {
      const term = t.classList.contains('gl-term') ? t : null;
      if (term) {
        const d = term.querySelector('details[data-gl-more]');
        if (d) d.open = true;
        el.querySelectorAll('.gl-term.is-target').forEach((x) => x.classList.remove('is-target'));
        void term.offsetWidth; // vurgu animasyonunu yeniden başlat
        term.classList.add('is-target');
      }
      t.scrollIntoView({ behavior: smooth ? smoothOrAuto() : 'auto', block: 'start' });
      if (focus && term) term.focus({ preventScroll: true });
    };
    if (t.hidden || t.closest('[hidden]')) {
      clearFilters();
      clearTimeout(goTimer);
      goTimer = setTimeout(run, 200); // listing.js aramayı ~120 ms gecikmeyle uygular
    } else run();
    return true;
  };
  cleanups.push(() => clearTimeout(goTimer));

  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (a && el.contains(a)) {
      e.preventDefault(); // yönlendiricinin genel çapa davranışı yerine
      if (a.getAttribute('aria-disabled') === 'true') return;
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (go(id, { focus: !a.hasAttribute('data-gl-letter') })) history.replaceState(history.state, '', '#' + id);
      return;
    }
    if (e.target.closest('[data-gl-reset]')) {
      clearFilters();
      if (search) search.focus();
    }
  };
  el.addEventListener('click', onClick);
  const onHash = () => go(decodeURIComponent(location.hash.slice(1)), { smooth: false });
  addEventListener('hashchange', onHash);
  cleanups.push(() => {
    el.removeEventListener('click', onClick);
    removeEventListener('hashchange', onHash);
  });

  // ── Yazdırma: kapalı «Ayrıntı» bölümlerini geçici olarak aç
  const opened = [];
  const beforePrint = () => {
    el.querySelectorAll('details:not([open])').forEach((d) => {
      d.open = true;
      opened.push(d);
    });
  };
  const afterPrint = () => opened.splice(0).forEach((d) => (d.open = false));
  addEventListener('beforeprint', beforePrint);
  addEventListener('afterprint', afterPrint);
  cleanups.push(() => {
    removeEventListener('beforeprint', beforePrint);
    removeEventListener('afterprint', afterPrint);
  });

  paint();
  spy(true);
  if (location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    requestAnimationFrame(() => go(id, { smooth: false }));
  }

  return () => cleanups.forEach((f) => f());
}
