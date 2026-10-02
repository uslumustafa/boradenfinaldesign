// Sayfa davranışları: her sayfa yüklendiğinde (veya yönlendirici içeriği değiştirdiğinde) mount() çalışır.
// Wagtail'de: aynı data-* öznitelikleri şablonlarda kalır; bu dosya statik dosya olarak aynen kullanılır.
import { clamp, smoothstep, easeOutExpo, qs, qsa, fmtTR, parseTR } from './util.js';
import { initCalculators } from './calculators.js';
import { initListing } from './listing.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createBehaviors({ fx, scroll, world }) {
  let cleanups = [];
  const on = (fn) => cleanups.push(fn);

  /* ── Giriş animasyonları */
  function reveal(root) {
    const els = qsa('[data-reveal]', root);
    if (!els.length) return;
    if (fx.tier === 'off') {
      els.forEach((e) => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0.06 }
    );
    els.forEach((e) => {
      if (!e.classList.contains('is-in')) io.observe(e);
    });
    on(() => io.disconnect());
  }

  /* ── Sayaçlar */
  function counters(root) {
    qsa('[data-count]', root).forEach((el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || fx.tier === 'off') return;
      el.textContent = '0';
      const io = new IntersectionObserver(
        ([en]) => {
          if (!en.isIntersecting) return;
          io.disconnect();
          const t0 = performance.now();
          const dur = 1500;
          const step = (now) => {
            const k = clamp((now - t0) / dur);
            el.textContent = String(Math.round(target * easeOutExpo(k)));
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        },
        { threshold: 0.6 }
      );
      io.observe(el);
      on(() => io.disconnect());
    });
  }

  /* ── Kaydırdıkça aydınlanan metin */
  function lit(root) {
    qsa('[data-lit]', root).forEach((el) => {
      const text = el.textContent.trim();
      // ekran okuyucu için düz metin (sr-only); kelime kelime yanan kopya aria-hidden
      el.innerHTML =
        `<span class="sr-only">${esc(text)}</span><span aria-hidden="true">` +
        text
          .split(/\s+/)
          .map((w) => `<span class="w">${esc(w)}</span>`)
          .join(' ') +
        '</span>';
      const words = qsa('.w', el);
      if (fx.tier === 'off') {
        words.forEach((w) => w.classList.add('on'));
        return;
      }
      let shown = -1;
      const off = scroll.add(el, 'enter', (_p, { rect, vh }) => {
        const start = vh * 0.82;
        const end = vh * 0.5;
        const p = clamp((start - rect.top) / (rect.height + start - end));
        const n = Math.round(p * (words.length + 3));
        if (n === shown) return;
        shown = n;
        words.forEach((w, i) => w.classList.toggle('on', i < n));
      });
      on(off);
    });
  }

  /* ── Parallax ve genişleyen görsel bandı */
  function parallax(root) {
    if (fx.tier === 'off') return;
    qsa('[data-parallax]', root).forEach((el) => {
      const band = el.closest('.band');
      const off = scroll.add(band || el, 'enter', (p) => {
        el.style.setProperty('--pp', p.toFixed(4));
        if (band) band.style.setProperty('--e', smoothstep(0.04, 0.4, p).toFixed(4));
      });
      on(off);
    });
  }

  /* ── Yaklaşım adımları: ilerleme çizgisi */
  function steps(root) {
    qsa('[data-steps]', root).forEach((el) => {
      if (fx.tier === 'off') {
        el.style.setProperty('--p', '1');
        return;
      }
      const off = scroll.add(el, 'enter', (_p, { rect, vh }) => {
        const p = clamp((vh * 0.82 - rect.top) / (rect.height * 0.8 + vh * 0.1));
        el.style.setProperty('--p', p.toFixed(4));
      });
      on(off);
    });
  }

  /* ── Kahraman: üstüne beyaz sayfa binerken sahne geri çekilir */
  function stack(root) {
    qsa('[data-stack]', root).forEach((el) => {
      const hero = qs('.hero', el);
      if (!hero || fx.tier === 'off') return;
      const off = scroll.add(el, 'enter', (_p, { rect, vh }) => {
        hero.style.setProperty('--hp', clamp(-rect.top / (vh * 0.92)).toFixed(4));
      });
      on(off);
    });
  }

  /* ── Hizmet alanları: sabit sahne */
  function areas(root) {
    qsa('[data-areas]', root).forEach((sec) => {
      const items = qsa('.area', sec);
      const cap = qs('[data-areas-cap]', sec);
      const idxEl = qs('[data-areas-idx]', sec);
      const n = items.length;
      let active = -1;
      const setActive = (i) => {
        if (i === active) return;
        active = i;
        items.forEach((it, k) => it.classList.toggle('is-active', k === i));
        const name = qs('.area__name', items[i])?.textContent || '';
        if (cap) cap.textContent = items[i].dataset.fig || name;
        if (idxEl) idxEl.textContent = String(i + 1).padStart(2, '0');
      };
      // mobilde (sabitlenmeyen düzen) otomatik geçiş yok
      const mq = matchMedia('(max-width: 900px)');
      const off = scroll.add(sec, 'pin', (p) => {
        if (mq.matches || fx.tier === 'off') return;
        setActive(Math.min(n - 1, Math.floor(p * n + 0.18)));
      });
      on(off);
      // tıklama/odak ile elle seçim (klavye erişimi)
      items.forEach((it, i) => {
        const link = qs('.area__link', it);
        link.addEventListener('focus', () => !mq.matches && setActive(i));
      });
      setActive(0);
    });
  }

  /* ── Hızlı KDV */
  function mini(root) {
    qsa('[data-mini="kdv"]', root).forEach((form) => {
      const amount = form.elements.amount;
      const rate = form.elements.rate;
      const out = (k) => qs(`[data-out="${k}"]`, form);
      const fmt = (v) => fmtTR(v) + ' ₺';
      const calc = () => {
        const a = parseTR(amount.value);
        const r = Number(rate.value) / 100;
        const mode = form.elements.mode.value;
        if (!Number.isFinite(a) || a < 0) {
          ['net', 'vat', 'gross'].forEach((k) => (out(k).textContent = '—'));
          return;
        }
        const net = mode === 'excl' ? a : a / (1 + r);
        const gross = mode === 'excl' ? a * (1 + r) : a;
        out('net').textContent = fmt(net);
        out('vat').textContent = fmt(gross - net);
        out('gross').textContent = fmt(gross);
      };
      form.addEventListener('input', calc);
      form.addEventListener('change', calc);
      amount.addEventListener('blur', () => {
        const a = parseTR(amount.value);
        if (Number.isFinite(a)) amount.value = fmtTR(a, a % 1 ? 2 : 0);
      });
      calc();
    });
  }

  /* ── HUD: bölüm göstergesi (yalnızca ≥3 bölümlü sayfalarda) */
  function hud(root) {
    const chapters = qsa('[data-chapter]', root).filter((el) => el.id);
    if (chapters.length < 4 || fx.tier === 'off') return;
    const nav = document.createElement('nav');
    nav.className = 'hud';
    nav.setAttribute('aria-label', 'Sayfa bölümleri');
    nav.innerHTML =
      '<ol>' +
      chapters.map((c) => `<li><a href="#${c.id}"><span class="hud__label">${esc(c.dataset.chapter)}</span><span class="hud__dash"></span></a></li>`).join('') +
      '</ol>';
    document.body.appendChild(nav);
    const links = qsa('a', nav);
    let cur = -1;
    let flashT = 0;
    let away = false;
    const foot = document.getElementById('footer');
    const off = scroll.onFrame(({ y }) => {
      // alt bilgi görünür olunca gösterge kaybolur (alt bilgi içeriğine binmesin)
      const nowAway = !!foot && foot.getBoundingClientRect().top < innerHeight * 0.8;
      if (nowAway !== away) {
        away = nowAway;
        nav.classList.toggle('is-away', away);
      }
      const mid = innerHeight * 0.5;
      let idx = 0;
      chapters.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.top <= mid) idx = i;
      });
      if (idx === cur) return;
      cur = idx;
      links.forEach((l, i) => l.classList.toggle('is-active', i === idx));
      // bölüm adı yalnızca değişimde kısa süre görünür (içeriğin üstüne binmesin)
      nav.classList.add('is-flash');
      clearTimeout(flashT);
      flashT = setTimeout(() => nav.classList.remove('is-flash'), 1700);
      const dark = chapters[idx].matches('.sec--dark, .sec--solid, .sec--ink');
      nav.dataset.tone = dark ? 'dark' : 'light';
    });
    on(() => {
      off();
      nav.remove();
    });
  }

  /* ── İçindekiler: aktif bölümü izler, tıklamada yumuşak kayar */
  function toc(root) {
    qsa('[data-toc]', root).forEach((nav) => {
      const pairs = qsa('a[href^="#"]', nav)
        .map((a) => ({ a, s: qs(a.getAttribute('href'), root) }))
        .filter((p) => p.s);
      if (!pairs.length) return;
      let cur = -1;
      const off = scroll.onFrame(() => {
        const line = innerHeight * 0.36;
        let idx = 0;
        pairs.forEach((p, i) => {
          if (p.s.closest('[hidden]')) return; // süzgeç/arama ile gizlenen bölümleri sayma
          if (p.s.getBoundingClientRect().top <= line) idx = i;
        });
        if (idx === cur) return;
        cur = idx;
        pairs.forEach((p, i) => {
          p.a.classList.toggle('is-on', i === idx);
          if (i === idx) p.a.setAttribute('aria-current', 'location');
          else p.a.removeAttribute('aria-current');
        });
      });
      const click = (e) => {
        const a = e.target.closest('a[href^="#"]');
        const hit = a && pairs.find((p) => p.a === a);
        if (!hit) return;
        e.preventDefault();
        hit.s.scrollIntoView({ behavior: fx.tier === 'off' ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(history.state, '', a.getAttribute('href'));
      };
      nav.addEventListener('click', click);
      on(() => {
        off();
        nav.removeEventListener('click', click);
      });
    });
  }

  /* ── Yönetmen: görünür koyu bölümlere göre 3B dünyanın sahnesini seçer */
  function director(root) {
    const els = qsa('[data-world], [data-world-range]', root);
    if (!els.length) {
      world.setVisible(false);
      return;
    }
    const cfg = els.map((el) => {
      if (el.dataset.worldRange) {
        const [a, b] = el.dataset.worldRange.split(',').map(Number);
        return { el, range: [a, b] };
      }
      return { el, value: Number(el.dataset.world) };
    });
    const sceneOfRange = (p, [a, b]) => {
      const n = b - a + 1;
      const x = p * n;
      const i = Math.min(n - 1, Math.floor(x));
      const f = x - i;
      const morph = i < n - 1 ? smoothstep(0.6, 1, f) : 0;
      return a + i + morph;
    };
    const off = scroll.onFrame(() => {
      const vh = innerHeight;
      let best = null;
      let bestVis = 0;
      for (const c of cfg) {
        const r = c.el.getBoundingClientRect();
        const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (vis > bestVis) {
          bestVis = vis;
          best = { c, r };
        }
      }
      if (!best) {
        world.setVisible(false);
        return;
      }
      world.setVisible(true);
      const { c, r } = best;
      // formasyon, bölümün ekranda görünen kısmının ortasına hizalanır (kısa alt sayfa kahramanlarında yukarı kayar)
      const cy = (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2;
      const lift = clamp((vh / 2 - cy) / vh, -0.45, 0.45);
      if (c.range) world.target(sceneOfRange(clamp(-r.top / Math.max(1, r.height - vh)), c.range), lift);
      else world.target(c.value, lift);
    });
    on(off);
  }

  /* ── Sayfa modülleri: <… data-module="ad"> → modules/ad.js (yalnızca gerektiğinde, ayrı parça olarak yüklenir).
        Modül `export function mount(el, ctx)` verir; ctx = { fx, scroll, on, root }. mount bir temizlik işlevi döndürebilir
        ya da ctx.on(temizlik) kaydedebilir; sayfa değişince/efekt kademesi değişince çağrılır.
        Birden çok modül boşlukla ayrılır: data-module="a b". */
  function modules(root) {
    qsa('[data-module]', root).forEach((el) => {
      for (const name of (el.dataset.module || '').split(/[\s,]+/).filter((n) => /^[a-z0-9-]+$/.test(n) && !n.startsWith('_'))) {
        let dead = false;
        let cleanup = null;
        on(() => {
          dead = true;
          try {
            if (typeof cleanup === 'function') cleanup();
          } catch (e) {
            /* yoksay */
          }
        });
        import(`./modules/${name}.js`)
          .then((m) => {
            if (dead) return;
            const fn = m.mount || m.default;
            if (typeof fn === 'function') cleanup = fn(el, { fx, scroll, on, root });
          })
          .catch((err) => console.warn(`[modül:${name}] yüklenemedi:`, err));
      }
    });
  }

  function mount(root) {
    unmount();
    reveal(root);
    counters(root);
    lit(root);
    parallax(root);
    steps(root);
    stack(root);
    areas(root);
    mini(root);
    hud(root);
    toc(root);
    director(root);
    initCalculators(root, { fx, scroll, on });
    initListing(root, { on });
    modules(root);
    scroll.refresh();
  }
  function unmount() {
    cleanups.forEach((f) => {
      try {
        f();
      } catch (e) {
        /* yoksay */
      }
    });
    cleanups = [];
    scroll.clear();
  }
  return { mount, unmount };
}
