// Site içi arama (istemci tarafı). Şablon: pages/support/search.njk — <form data-module="search" data-index="…">
// Wagtail karşılığı: SearchPage şablonunda aynı işaretleme + bu modül. Dizin derlemede üretilir
//   (/assets/data/search-index.json → [{ t: başlık, u: adres, d: açıklama, k: tür }]); ileride wagtail.search
//   sonuçları aynı biçimde döndürülerek kullanılabilir.
//
// • Dizin tembel yüklenir: modül yalnızca bu sayfada yüklenir, dizin bir kez indirilir.
// • Türkçe harf katlama: İ/I/ı/i → i, ş → s, ğ → g, ü → u, ö → o, ç → c (+ diğer aksanlar, tırnak ve tire biçimleri).
// • Sözcükler VE mantığıyla aranır; puan: başlık tam eşleşme > başlık öneki > başlıkta geçme > açıklamada geçme.
// • Sonuçlar türe göre gruplanır (en iyi sonucu olan tür önce); tür süzgeci adetlidir; ilk 50 + "daha fazla göster".
// • Eşleşen kısımlar <mark> ile vurgulanır — yalnızca DOM/textContent; kullanıcı metni innerHTML'e girmez.
// • ?q= adres çubuğuyla eşitlenir (history.replaceState). Klavye: ↓ sonuçlara geçer, ↑/↓ sonuçlar arasında gezer,
//   Enter sonucu açar (girişte: ilk sonuca geçer), Esc aramayı temizler.
// • Çerez/depolama yok; tek ağ isteği dizin dosyasıdır.

const STEP = 50;
const FOLD = {
  İ: 'i', I: 'i', ı: 'i', i: 'i',
  Ş: 's', ş: 's', Ğ: 'g', ğ: 'g', Ü: 'u', ü: 'u', Ö: 'o', ö: 'o', Ç: 'c', ç: 'c',
  Â: 'a', â: 'a', Î: 'i', î: 'i', Û: 'u', û: 'u',
  '’': "'", '‘': "'", 'ʼ': "'", '“': '"', '”': '"', '–': '-', '—': '-',
};
const COMBINING = /[̀-ͯ]/g;

function foldChar(c) {
  const m = FOLD[c];
  return m !== undefined ? m : c.toLowerCase().normalize('NFD').replace(COMBINING, '');
}

// Katlanmış metin + her katlanmış karakterin özgün metindeki konumu (vurgulama için)
export function foldMap(s) {
  const src = String(s ?? '');
  let f = '';
  const map = [];
  for (let i = 0; i < src.length; i++) {
    const r = foldChar(src[i]);
    f += r;
    for (let k = 0; k < r.length; k++) map.push(i);
  }
  return { f, map };
}
export const fold = (s) => foldMap(s).f.replace(/\s+/g, ' ').trim();

const isPdf = (u) => /\.pdf($|[?#])/i.test(u);
const wordChar = /[a-z0-9]/;
// hazırlanmış dizin modül ömrü boyunca saklanır (sayfaya geri dönüşte yeniden indirilip katlanmaz)
const indexCache = new Map();

// w, s içinde bir sözcük başında geçiyor mu?
function atWordStart(s, w) {
  let i = s.indexOf(w);
  while (i !== -1) {
    if (i === 0 || !wordChar.test(s[i - 1])) return true;
    i = s.indexOf(w, i + 1);
  }
  return false;
}

// Puan: -1 = eşleşmedi. Her sözcük başlıkta, açıklamada ya da türde geçmeli (VE).
function scoreOf(it, qf, words) {
  let s = 0;
  for (const w of words) {
    if (it.tf.includes(w)) s += atWordStart(it.tf, w) ? 40 : 24;
    else if (it.df.includes(w)) s += atWordStart(it.df, w) ? 10 : 7;
    else if (it.kf.includes(w)) s += 4;
    else return -1;
  }
  if (it.tf === qf) s += 1000;
  else if (it.tf.startsWith(qf)) s += 400;
  else if (atWordStart(it.tf, qf)) s += 200;
  else if (it.tf.includes(qf)) s += 120;
  else if (words.length > 1 && it.df.includes(qf)) s += 15;
  if (isPdf(it.u)) s -= 3; // arşiv PDF'leri eşit puanda sayfalardan sonra gelir
  return s;
}

export function tokenize(q) {
  return [...new Set(fold(q).split(/[\s,;:!?()"«»]+/).filter(Boolean))];
}

export function search(index, q) {
  const qf = fold(q);
  const words = tokenize(q);
  if (!words.length) return [];
  const out = [];
  for (const it of index) {
    const s = scoreOf(it, qf, words);
    if (s >= 0) out.push({ it, s });
  }
  out.sort((a, b) => b.s - a.s || a.it.t.length - b.it.t.length || a.it.t.localeCompare(b.it.t, 'tr'));
  return out.map((x) => x.it);
}

// Vurgu: özgün metin + katlanmış sözcükler → metin düğümleri ve <mark> öğeleri
function highlight(text, words) {
  const frag = document.createDocumentFragment();
  if (!text) return frag;
  const { f, map } = foldMap(text);
  const ranges = [];
  for (const w of words) {
    let i = f.indexOf(w);
    while (i !== -1 && w) {
      ranges.push([map[i], map[i + w.length - 1] + 1]);
      i = f.indexOf(w, i + w.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let pos = 0;
  for (const [a, b] of ranges) {
    if (b <= pos) continue;
    const from = Math.max(a, pos);
    if (from > pos) frag.append(text.slice(pos, from));
    const m = document.createElement('mark');
    m.textContent = text.slice(from, b);
    frag.append(m);
    pos = b;
  }
  if (pos < text.length) frag.append(text.slice(pos));
  return frag;
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const prettyUrl = (u) => {
  try {
    return decodeURI(u);
  } catch {
    return u;
  }
};

export function mount(form, ctx) {
  const root = ctx.root || document;
  const input = form.querySelector('input[name="q"]');
  const clearBtn = form.querySelector('[data-sr-clear]');
  const q$ = (sel) => root.querySelector(sel);
  const results = q$('[data-sr-results]');
  const statusEl = q$('[data-sr-status]');
  const facets = q$('[data-sr-facets]');
  const chips = q$('[data-sr-chips]');
  const moreWrap = q$('[data-sr-morewrap]');
  const moreBtn = q$('[data-sr-more]');
  const start = q$('[data-sr-start]');
  const none = q$('[data-sr-none]');
  const noneQ = q$('[data-sr-none-q]');
  if (!input || !results) return undefined;

  let index = null;
  let loading = null;
  let failed = false;
  let dead = false;
  let timer = 0;
  let matches = [];
  const state = { q: '', kind: 'all', limit: STEP };
  let chipsFor = null; // süzgeç düğmelerinin hangi sorgu için kurulduğu

  const src = form.dataset.index;
  const load = () => {
    if (loading) return loading;
    if (!indexCache.has(src)) {
      const p = fetch(src, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then((arr) =>
          (Array.isArray(arr) ? arr : [])
            .filter((x) => x && x.t && x.u)
            .map((x) => ({ t: String(x.t), u: String(x.u), d: String(x.d || ''), k: String(x.k || 'Sayfa'), tf: fold(x.t), df: fold(x.d), kf: fold(x.k) }))
        );
      p.catch(() => indexCache.delete(src));
      indexCache.set(src, p);
    }
    loading = indexCache.get(src).then(
      (list) => (index = list),
      (err) => {
        failed = true;
        console.warn('[arama] dizin yüklenemedi:', err.message || err);
        throw err;
      }
    );
    return loading;
  };

  const say = (txt) => {
    if (statusEl && statusEl.textContent !== txt) statusEl.textContent = txt;
  };

  function syncUrl() {
    const p = new URLSearchParams(location.search);
    if (state.q) p.set('q', state.q);
    else p.delete('q');
    const s = p.toString();
    const url = location.pathname + (s ? '?' + s : '') + location.hash;
    if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
  }

  function showStart() {
    results.replaceChildren();
    if (start) start.hidden = false;
    if (none) none.hidden = true;
    if (facets) facets.hidden = true;
    if (moreWrap) moreWrap.hidden = true;
    chipsFor = null;
  }

  // gruplar: türlerin sırası en iyi sonuçlarına göre (matches zaten puana göre sıralı)
  function kindsOf(list) {
    const m = new Map();
    for (const it of list) m.set(it.k, (m.get(it.k) || 0) + 1);
    return [...m].map(([k, n]) => ({ k, n }));
  }

  function renderChips(kinds) {
    if (!chips) return;
    const all = [{ k: 'all', label: 'Tümü', n: matches.length }, ...kinds.map((x) => ({ k: x.k, label: x.k, n: x.n }))];
    chips.replaceChildren(
      ...all.map((c) => {
        const b = el('button', 'sr-chip');
        b.type = 'button';
        b.dataset.kind = c.k;
        b.setAttribute('aria-pressed', String(state.kind === c.k));
        b.append(el('span', 'sr-chip__l', c.label), el('span', 'sr-chip__n mono tnum', String(c.n)));
        return b;
      })
    );
    chipsFor = state.q;
  }
  function paintChips() {
    chips?.querySelectorAll('.sr-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind)));
  }

  function hitEl(it, words) {
    const li = el('li');
    const a = el('a', 'sr-hit');
    a.href = it.u;
    a.setAttribute('data-sr-hit', '');
    const pdf = isPdf(it.u);
    if (pdf) {
      a.target = '_blank';
      a.rel = 'noopener';
    } else if (it.u.includes('#')) {
      // çapalı adresler tam gezinmeyle açılır: tarayıcı hedefe kendisi kaydırır
      a.setAttribute('data-no-swap', '');
    }
    const t = el('span', 'sr-hit__t');
    t.append(highlight(it.t, words));
    a.append(t);
    if (it.d) {
      const d = el('span', 'sr-hit__d');
      d.append(highlight(it.d.length >= 220 ? it.d.replace(/\s+\S*$/, '') + '…' : it.d, words));
      a.append(d);
    }
    // adres satırı yalnızca sayfalar için (PDF adları okunur değildir; açıklamada belge bilgisi zaten var)
    if (!pdf) a.append(el('span', 'sr-hit__u mono', prettyUrl(it.u)));
    const go = el('span', 'sr-hit__go', pdf ? '↗' : '→');
    go.setAttribute('aria-hidden', 'true');
    a.append(go);
    if (pdf) a.append(el('span', 'sr-only', ' (PDF, yeni sekmede açılır)'));
    li.append(a);
    return li;
  }

  function renderResults(focusFrom = -1) {
    const words = tokenize(state.q);
    const pool = state.kind === 'all' ? matches : matches.filter((it) => it.k === state.kind);
    const shown = pool.slice(0, state.limit);
    const groups = new Map();
    for (const it of shown) {
      if (!groups.has(it.k)) groups.set(it.k, []);
      groups.get(it.k).push(it);
    }
    const totals = new Map(kindsOf(pool).map((x) => [x.k, x.n]));
    let gi = 0;
    const secs = [];
    for (const [k, list] of groups) {
      const id = `sr-g-${gi++}`;
      const sec = el('section', 'sr-group');
      sec.setAttribute('aria-labelledby', id);
      const h = el('h2', 'sr-group__h');
      h.id = id;
      const total = totals.get(k) || list.length;
      h.append(el('span', 'sr-group__t', k), el('span', 'sr-group__c mono tnum', total > list.length ? `${list.length} / ${total}` : String(total)));
      const ol = el('ol', 'sr-list');
      for (const it of list) ol.append(hitEl(it, words));
      sec.append(h, ol);
      secs.push(sec);
    }
    results.replaceChildren(...secs);
    const rest = pool.length - shown.length;
    if (moreWrap) moreWrap.hidden = rest <= 0;
    if (moreBtn && rest > 0) moreBtn.textContent = `Daha fazla göster (${rest} sonuç daha)`;
    const kindTxt = state.kind === 'all' ? '' : ` · ${state.kind}: ${pool.length}`;
    const part = rest > 0 ? ` · ilk ${shown.length} gösteriliyor` : '';
    say(`«${state.q}» için ${matches.length} sonuç${kindTxt}${part}`);
    if (focusFrom >= 0) focusHit(focusFrom);
  }

  function run() {
    state.q = input.value.trim();
    if (clearBtn) clearBtn.hidden = !input.value;
    syncUrl();
    if (!state.q) {
      say('');
      showStart();
      return;
    }
    if (!index) {
      if (failed) {
        say('Arama dizini yüklenemedi. Sayfaları site haritasından bulabilirsiniz.');
        showStart();
        return;
      }
      say('Arama dizini yükleniyor…');
      load().then(
        () => !dead && run(),
        () => !dead && run()
      );
      return;
    }
    matches = search(index, state.q);
    if (start) start.hidden = true;
    if (!matches.length) {
      results.replaceChildren();
      if (facets) facets.hidden = true;
      if (moreWrap) moreWrap.hidden = true;
      if (noneQ) noneQ.textContent = state.q;
      if (none) none.hidden = false;
      say(`«${state.q}» için sonuç bulunamadı`);
      chipsFor = null;
      return;
    }
    if (none) none.hidden = true;
    const kinds = kindsOf(matches);
    if (state.kind !== 'all' && !kinds.some((x) => x.k === state.kind)) state.kind = 'all';
    if (chipsFor !== state.q) renderChips(kinds);
    if (facets) facets.hidden = kinds.length < 2;
    renderResults();
  }

  // ——— klavye ve odak
  const hits = () => [...results.querySelectorAll('[data-sr-hit]')];
  function focusHit(i) {
    const h = hits();
    const a = h[Math.max(0, Math.min(i, h.length - 1))];
    if (!a) return;
    a.focus({ preventScroll: true });
    const r = a.getBoundingClientRect();
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 72) + 16;
    if (r.top < top) scrollBy({ top: r.top - top - 8 });
    else if (r.bottom > innerHeight - 16) scrollBy({ top: r.bottom - innerHeight + 24 });
  }
  function clearAll() {
    clearTimeout(timer);
    input.value = '';
    state.kind = 'all';
    state.limit = STEP;
    run();
    input.focus();
  }
  function toInput() {
    input.focus({ preventScroll: true });
    const n = input.value.length;
    try {
      input.setSelectionRange(n, n);
    } catch (e) {
      /* bazı tarayıcılarda desteklenmez */
    }
    input.scrollIntoView({ block: 'nearest' });
  }

  const onInput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.limit = STEP;
      run();
    }, 110);
  };
  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      if (hits().length) {
        e.preventDefault();
        focusHit(0);
      }
    } else if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      clearAll();
    }
  };
  const onSubmit = (e) => {
    e.preventDefault();
    clearTimeout(timer);
    run();
    if (hits().length) focusHit(0);
  };
  const onResultsKey = (e) => {
    const h = hits();
    const i = h.indexOf(document.activeElement);
    if (i === -1) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (i < h.length - 1) focusHit(i + 1);
      else if (moreWrap && !moreWrap.hidden) moreBtn.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i > 0) focusHit(i - 1);
      else toInput();
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusHit(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusHit(h.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearAll();
    } else if (e.key === 'Backspace' || (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      // yazmaya devam: odak girişe döner, karakter girişe düşer
      toInput();
    }
  };
  const onChip = (e) => {
    const b = e.target.closest('.sr-chip');
    if (!b) return;
    state.kind = b.dataset.kind || 'all';
    state.limit = STEP;
    paintChips();
    renderResults();
  };
  const onMore = () => {
    const before = hits().length;
    state.limit += STEP;
    renderResults(before);
  };
  const onClear = () => clearAll();
  const onTry = (e) => {
    const a = e.target.closest('[data-sr-try]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); // yönlendirici sayfayı yeniden yüklemesin
    input.value = a.dataset.srTry || a.textContent.trim();
    state.kind = 'all';
    state.limit = STEP;
    run();
    input.focus();
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onInputKey);
  form.addEventListener('submit', onSubmit);
  results.addEventListener('keydown', onResultsKey);
  chips?.addEventListener('click', onChip);
  moreBtn?.addEventListener('click', onMore);
  clearBtn?.addEventListener('click', onClear);
  start?.addEventListener('click', onTry);

  // başlangıç: ?q= varsa ara, yoksa girişe odaklan; dizin hemen istenir (ilk tuşta hazır olsun)
  const initial = new URLSearchParams(location.search).get('q') || '';
  input.value = initial;
  load().catch(() => {});
  run();
  if (!initial) requestAnimationFrame(() => !dead && input.focus({ preventScroll: true }));

  return () => {
    dead = true;
    clearTimeout(timer);
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onInputKey);
    form.removeEventListener('submit', onSubmit);
    results.removeEventListener('keydown', onResultsKey);
    chips?.removeEventListener('click', onChip);
    moreBtn?.removeEventListener('click', onMore);
    clearBtn?.removeEventListener('click', onClear);
    start?.removeEventListener('click', onTry);
  };
}
