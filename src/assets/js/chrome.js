// Sabit "kabuk": header menüleri, mobil menü, efekt anahtarı. Sayfa geçişlerinde yeniden kurulmaz.
import { qs, qsa } from './util.js';

export function initChrome(fx) {
  const html = document.documentElement;
  const hdr = qs('#hdr');
  const burger = qs('.hdr__burger');
  const mnav = qs('#mnav');
  const links = qsa('.nav__link[data-panel]', hdr);
  const panels = Object.fromEntries(qsa('.mega', hdr).map((p) => [p.dataset.mega, p]));
  let openKey = null;
  let openTimer = 0;
  let closeTimer = 0;
  let quiet = false; // odak tetikleyiciye geri verilirken paneli yeniden açma
  const focusQuietly = (el) => {
    quiet = true;
    el.focus();
    quiet = false;
  };

  /* ── Mega paneller */
  function openPanel(key) {
    clearTimeout(closeTimer);
    if (openKey === key) return;
    closePanels(true);
    const p = panels[key];
    if (!p) return;
    p.classList.add('is-open');
    links.forEach((l) => l.setAttribute('aria-expanded', String(l.dataset.panel === key)));
    openKey = key;
  }
  function closePanels(immediate = false) {
    clearTimeout(openTimer);
    const done = () => {
      Object.values(panels).forEach((p) => p.classList.remove('is-open'));
      links.forEach((l) => l.setAttribute('aria-expanded', 'false'));
      openKey = null;
    };
    if (immediate) done();
    else {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(done, 160);
    }
  }
  links.forEach((l) => {
    const key = l.dataset.panel;
    l.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      openTimer = setTimeout(() => openPanel(key), 90);
    });
    l.addEventListener('focus', () => {
      if (!quiet) openPanel(key);
    });
    // klavye: ↓ paneli açar ve ilk bağlantısına geçer (panel DOM'da üst menünün sonunda durduğu için Tab ile ulaşılmaz)
    l.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      openPanel(key);
      panels[key]?.querySelector('a')?.focus();
    });
    l.addEventListener('click', (e) => {
      // dokunmatik: ilk dokunuş paneli açar, ikinci dokunuş sayfaya gider
      if (matchMedia('(hover: none)').matches && openKey !== key) {
        e.preventDefault();
        openPanel(key);
      }
    });
  });
  hdr.addEventListener('mouseleave', () => closePanels());
  hdr.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  Object.values(panels).forEach((p) => {
    p.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    p.addEventListener('focusout', (e) => {
      if (!hdr.contains(e.relatedTarget)) closePanels();
    });
  });
  // odak, açık panelin tetikleyicisi ve paneli dışında bir üst menü öğesine geçince panel açık kalmasın
  hdr.addEventListener('focusin', (e) => {
    if (!openKey || e.target.closest('.mega') || e.target.closest('.nav__link[data-panel]')) return;
    closePanels(true);
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menuWasOpen = !!mnav?.classList.contains('is-open');
    const inPanel = document.activeElement?.closest?.('.mega');
    const trigger = inPanel ? links.find((l) => l.dataset.panel === inPanel.dataset.mega) : null;
    closePanels(true);
    setMenu(false);
    // Esc ile kapanınca odak, onu açan öğeye (menü düğmesi / panelin tetikleyicisi) dönsün; klavye kullanıcısı yerini kaybetmesin.
    if (menuWasOpen) burger?.focus();
    else if (trigger) focusQuietly(trigger);
  });
  document.addEventListener('click', (e) => {
    if (openKey && !e.target.closest('.hdr')) closePanels(true);
  });

  /* ── Akıllı header: aşağı kaydırınca gizlen, yukarı/üst kenar/odak ile geri gel */
  {
    const hot = document.createElement('div');
    hot.className = 'hdr-hot';
    hot.setAttribute('aria-hidden', 'true');
    hdr.before(hot);
    let lastY = scrollY;
    let hidden = false;
    const setHidden = (v) => {
      if (v === hidden) return;
      hidden = v;
      html.classList.toggle('hdr-hidden', v);
    };
    const pinned = () => openKey || mnav?.classList.contains('is-open') || hdr.matches(':focus-within');
    addEventListener(
      'scroll',
      () => {
        const y = scrollY;
        const d = y - lastY;
        if (y < 120 || pinned()) setHidden(false);
        else if (d > 8) setHidden(true);
        else if (d < -8) setHidden(false);
        if (Math.abs(d) > 8 || y < 120) lastY = y;
      },
      { passive: true }
    );
    hot.addEventListener('mouseenter', () => setHidden(false));
    hdr.addEventListener('mouseenter', () => setHidden(false));
    hdr.addEventListener('focusin', () => setHidden(false));
    // fare gelince açılan header, fare çekilince (ve kaydırma aşağıdaysa) tekrar kaybolur
    hdr.addEventListener('mouseleave', () => {
      if (scrollY >= 120 && !pinned()) setTimeout(() => !pinned() && !hdr.matches(':hover') && scrollY >= 120 && setHidden(true), 700);
    });
  }

  /* ── Mobil menü */
  // Menü açıkken arkadaki sayfa (skip bağlantısı, <main>, footer) klavyeden ve ekran okuyucudan gizlenir:
  // Tab yalnızca header + menü içinde dolaşır. Kapanınca hepsi geri açılır. (#main sayfa geçişlerinde
  // yer değiştirmez; yalnızca içeriği değişir, bu yüzden referanslar sabit kalır.)
  const behind = [qs('.skip'), qs('#main'), qs('#footer')].filter(Boolean);
  function setMenu(open) {
    if (!burger || !mnav) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    mnav.classList.toggle('is-open', open);
    html.style.overflow = open ? 'hidden' : '';
    behind.forEach((el) => el.toggleAttribute('inert', open));
  }
  burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  mnav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  matchMedia('(min-width: 1081px)').addEventListener?.('change', (e) => e.matches && setMenu(false));

  /* ── Efekt anahtarı */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fx-set]');
    if (b) fx.set(b.dataset.fxSet, true);
  });
  fx.refreshSwitches();

  return {
    // sayfa değişince menüleri kapat, aktif bağlantıyı güncelle
    onNavigate(url) {
      closePanels(true);
      setMenu(false);
      links.forEach((l) => {
        const href = l.getAttribute('href');
        const on = href !== '/' && url.startsWith(href);
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
      qsa('.nav__link:not([data-panel])', hdr).forEach((l) => {
        const href = l.getAttribute('href');
        const on = href !== '/' && url.startsWith(href);
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
    },
  };
}
