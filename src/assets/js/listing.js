// Listeler: süzme + arama + sayfalama. JS yoksa tüm öğeler görünür kalır (aşamalı geliştirme).
// Wagtail'de: aynı data-* öznitelikleri; büyük arşivlerde sunucu tarafı süzmeye geçilebilir.
//
//   <div data-listing="adı" data-per-page="12">
//     <div data-filter-by="group"> <button data-filter="all">…</button> <button data-filter="vergi">…</button> </div>
//     <input data-search>
//     <section data-group="vergi"> <li data-item data-text="aranacak metin" data-year="2024" data-type="x"> … </section>
//     <p data-empty hidden>…</p>  <p data-result-count></p>  <nav data-pager></nav>
//   </div>
//
// Süzgeç değeri: data-filter-by="group" → öğenin en yakın [data-group] üst öğesi; diğer anahtarlar → öğenin data-<anahtar> değeri.
import { qs, qsa } from './util.js';

const norm = (s) =>
  String(s || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

export function initListing(root, { on }) {
  qsa('[data-listing]', root).forEach((el) => setup(el, on));
}

function setup(el, on) {
  const items = qsa('[data-item]', el);
  if (!items.length) return;
  const blocks = qsa('[data-group]', el);
  const input = qs('[data-search]', el);
  const empty = qs('[data-empty]', el);
  const countEl = qs('[data-result-count]', el);
  const pager = qs('[data-pager]', el);
  const perPage = Number(el.dataset.perPage || 0);
  const filterBars = qsa('[data-filter-by]', el);
  const norms = new Map(items.map((it) => [it, norm(it.dataset.text || it.textContent)]));
  const valueOf = (it, key) => {
    if (key === 'group') return it.closest('[data-group]')?.dataset.group || '';
    return it.dataset[key] || '';
  };

  // başlangıç durumu: adres çubuğundaki sorgudan
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', page: Math.max(1, Number(params.get('p')) || 1), f: {} };
  filterBars.forEach((bar) => {
    const key = bar.dataset.filterBy;
    state.f[key] = params.get(key) || 'all';
  });
  if (input) input.value = state.q;

  function sync(replace = true) {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    for (const [k, v] of Object.entries(state.f)) if (v && v !== 'all') p.set(k, v);
    if (state.page > 1) p.set('p', String(state.page));
    const qsStr = p.toString();
    const url = location.pathname + (qsStr ? '?' + qsStr : '') + location.hash;
    if (url !== location.pathname + location.search + location.hash) history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
  }

  function paintBars() {
    filterBars.forEach((bar) => {
      const key = bar.dataset.filterBy;
      qsa('[data-filter]', bar).forEach((b) => {
        const onx = b.dataset.filter === state.f[key];
        b.classList.toggle('is-on', onx);
        b.setAttribute('aria-pressed', String(onx));
      });
    });
  }

  function apply({ resetPage = false } = {}) {
    if (resetPage) state.page = 1;
    const words = norm(state.q).split(/\s+/).filter(Boolean);
    const matched = items.filter((it) => {
      for (const [k, v] of Object.entries(state.f)) if (v !== 'all' && valueOf(it, k) !== v) return false;
      if (words.length) {
        const hay = norms.get(it);
        for (const w of words) if (!hay.includes(w)) return false;
      }
      return true;
    });
    const pages = perPage ? Math.max(1, Math.ceil(matched.length / perPage)) : 1;
    if (state.page > pages) state.page = pages;
    const from = perPage ? (state.page - 1) * perPage : 0;
    const to = perPage ? from + perPage : matched.length;
    const visible = new Set(matched.slice(from, to));
    items.forEach((it) => {
      it.hidden = !visible.has(it);
    });
    blocks.forEach((b) => {
      b.hidden = !qsa('[data-item]', b).some((it) => !it.hidden);
    });
    if (empty) empty.hidden = matched.length > 0;
    if (countEl) countEl.textContent = matched.length ? `${matched.length} sonuç` : '';
    paintBars();
    renderPager(pages);
  }

  function renderPager(pages) {
    if (!pager) return;
    if (!perPage || pages <= 1) {
      pager.innerHTML = '';
      pager.hidden = true;
      return;
    }
    pager.hidden = false;
    const btn = (label, page, { cur = false, dis = false, aria = '' } = {}) =>
      `<button type="button" data-page="${page}"${cur ? ' aria-current="page"' : ''}${dis ? ' disabled' : ''}${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;
    const list = [];
    const near = new Set([1, pages, state.page, state.page - 1, state.page + 1]);
    let last = 0;
    for (let i = 1; i <= pages; i++) {
      if (!near.has(i)) continue;
      if (i - last > 1) list.push('<span aria-hidden="true" style="align-self:center;color:var(--ink-3)">…</span>');
      list.push(btn(String(i), i, { cur: i === state.page, aria: `Sayfa ${i}` }));
      last = i;
    }
    pager.innerHTML = btn('←', state.page - 1, { dis: state.page === 1, aria: 'Önceki sayfa' }) + list.join('') + btn('→', state.page + 1, { dis: state.page === pages, aria: 'Sonraki sayfa' });
  }

  const onClick = (e) => {
    const f = e.target.closest('[data-filter]');
    if (f && el.contains(f)) {
      const bar = f.closest('[data-filter-by]');
      if (bar) {
        state.f[bar.dataset.filterBy] = f.dataset.filter;
        apply({ resetPage: true });
        sync();
      }
      return;
    }
    const p = e.target.closest('[data-page]');
    if (p && pager && pager.contains(p)) {
      state.page = Number(p.dataset.page);
      apply();
      sync();
      const top = el.getBoundingClientRect().top + scrollY - 100;
      if (top < scrollY) scrollTo({ top, behavior: 'smooth' });
    }
  };
  let t = 0;
  const onInput = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = input.value.trim();
      apply({ resetPage: true });
      sync();
    }, 120);
  };
  el.addEventListener('click', onClick);
  input?.addEventListener('input', onInput);
  // enter ile formun gönderilmesini engelle
  input?.closest('form')?.addEventListener('submit', (e) => e.preventDefault());
  on(() => {
    clearTimeout(t);
    el.removeEventListener('click', onClick);
    input?.removeEventListener('input', onInput);
  });
  apply();
}
