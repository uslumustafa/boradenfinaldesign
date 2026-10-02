// SSS (/bilgi-merkezi/sss/): «Tümünü aç/kapat», aramada az sayıda eşleşen yanıtı otomatik açma, #soru ve #grup çapaları,
// grup içindekiler izleme (aramada gizlenen grupları atlar) ve canlı sonuç sayısı.
// Süzme/arama listing.js'tedir (data-listing); bu modül yalnızca onun sonucunu (hidden öznitelikleri) izler.
// JS yokken: tüm sorular <details> olarak açılıp kapanır, çapalar normal çalışır; düğme gizli kalır.
export function mount(el, { fx, scroll }) {
  const items = Array.from(el.querySelectorAll('details[data-item]'));
  if (!items.length) return undefined;
  const toggle = el.querySelector('[data-qa-toggle]');
  const search = el.querySelector('[data-search]');
  const countEl = el.querySelector('[data-qa-count]');
  const links = Array.from(el.querySelectorAll('[data-qa-link]'))
    .map((a) => ({ a, s: document.getElementById(a.dataset.qaLink) }))
    .filter((p) => p.s && el.contains(p.s));
  const cleanups = [];
  const smoothOrAuto = () => (fx.tier === 'off' ? 'auto' : 'smooth');
  const visible = () => items.filter((d) => !d.hidden);

  const paintToggle = () => {
    if (!toggle) return;
    const v = visible();
    const allOpen = v.length > 0 && v.every((d) => d.open);
    const label = allOpen ? 'Tümünü kapat' : 'Tümünü aç';
    if (toggle.textContent !== label) toggle.textContent = label;
    toggle.setAttribute('aria-expanded', String(allOpen));
    toggle.disabled = !v.length;
  };
  let lastCount = -1;
  const paint = () => {
    const n = visible().length;
    if (countEl && n !== lastCount) {
      lastCount = n;
      countEl.textContent = n === items.length ? `${n} soru` : n ? `${n} / ${items.length} soru gösteriliyor` : 'Eşleşen soru yok';
    }
    links.forEach(({ a, s }) => {
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
    paintToggle();
  };

  // ── Grup içindekiler: etkin grup (gizli gruplar atlanır)
  let cur = -2;
  const spy = (force) => {
    if (!links.length) return;
    const line = innerHeight * 0.36;
    let idx = -1;
    for (let i = 0; i < links.length; i++) {
      const { s } = links[i];
      if (s.hidden) continue;
      if (s.getBoundingClientRect().top <= line) idx = i;
      else break;
    }
    if (idx < 0) idx = links.findIndex((p) => !p.s.hidden);
    if (idx === cur && !force) return;
    cur = idx;
    links.forEach(({ a }, i) => {
      const on = i === idx;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };
  cleanups.push(scroll.onFrame(() => spy(false)));

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

  // ── Arama: az sayıda eşleşme varsa yanıtları aç (yalnızca kendi açtıklarını geri kapatır)
  const auto = new Set();
  const autoOpen = () => {
    auto.forEach((d) => (d.open = false));
    auto.clear();
    const q = search ? search.value.trim() : '';
    const v = visible();
    if (q.length >= 2 && v.length && v.length <= 8) {
      v.forEach((d) => {
        if (!d.open) {
          d.open = true;
          auto.add(d);
        }
      });
    }
    paint();
  };
  let t = 0;
  const onInput = () => {
    clearTimeout(t);
    t = setTimeout(autoOpen, 200); // listing.js ~120 ms sonra süzer
  };
  if (search) search.addEventListener('input', onInput);
  cleanups.push(() => {
    clearTimeout(t);
    if (search) search.removeEventListener('input', onInput);
  });

  // ── Çapalar
  let goTimer = 0;
  const go = (id, { smooth = true, focus = false } = {}) => {
    const target = id ? document.getElementById(id) : null;
    if (!target || !el.contains(target)) return false;
    const run = () => {
      if (target.matches('details[data-item]')) {
        target.open = true;
        el.querySelectorAll('details.is-target').forEach((x) => x.classList.remove('is-target'));
        void target.offsetWidth;
        target.classList.add('is-target');
      }
      target.scrollIntoView({ behavior: smooth ? smoothOrAuto() : 'auto', block: 'start' });
      if (focus) {
        const sum = target.matches('details') ? target.querySelector('summary') : target.querySelector('h2');
        if (sum) {
          if (!sum.matches('summary')) sum.setAttribute('tabindex', '-1');
          sum.focus({ preventScroll: true });
        }
      }
      paintToggle();
    };
    if (target.hidden || target.closest('[hidden]')) {
      if (search && search.value) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      clearTimeout(goTimer);
      goTimer = setTimeout(run, 220);
    } else run();
    return true;
  };
  cleanups.push(() => clearTimeout(goTimer));

  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (toggle && e.target.closest('[data-qa-toggle]')) {
      const v = visible();
      const open = !v.every((d) => d.open);
      v.forEach((d) => (d.open = open));
      auto.clear();
      paintToggle();
      return;
    }
    const a = e.target.closest('a[href^="#"]');
    if (a && el.contains(a)) {
      e.preventDefault();
      if (a.getAttribute('aria-disabled') === 'true') return;
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (go(id, { focus: true })) history.replaceState(history.state, '', '#' + id);
    }
  };
  const onToggle = () => paintToggle();
  el.addEventListener('click', onClick);
  el.addEventListener('toggle', onToggle, true); // details «toggle» olayı kabarmaz: yakalama evresinde dinlenir
  const onHash = () => go(decodeURIComponent(location.hash.slice(1)), { smooth: false });
  addEventListener('hashchange', onHash);
  cleanups.push(() => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('toggle', onToggle, true);
    removeEventListener('hashchange', onHash);
  });

  if (toggle) toggle.hidden = false;
  paint();
  spy(true);
  if (search && search.value.trim()) autoOpen();
  if (location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    requestAnimationFrame(() => go(id, { smooth: false }));
  }

  return () => cleanups.forEach((f) => f());
}
