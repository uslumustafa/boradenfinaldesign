// Sabit "kabuk": header menüleri, mobil menü, efekt anahtarı. Sayfa geçişlerinde yeniden kurulmaz.
import { qs, qsa } from './util.js';

export function initChrome(fx) {
  const html = document.documentElement;
  const hdr = qs('#hdr');
  const burger = qs('.hdr__burger');
  const mnav = qs('#mnav');
  const links = qsa('.nav__link[data-panel]', hdr);
  const plain = qsa('.nav__link:not([data-panel])', hdr); // panelsiz üst menü öğeleri (Sektörler, Hesaplayıcılar, Hakkımızda)
  const panels = Object.fromEntries(qsa('.mega', hdr).map((p) => [p.dataset.mega, p]));
  let openKey = null;
  let openTimer = 0;
  let closeTimer = 0;
  let byPointer = false; // açık panel fareyle mi açıldı (klavye/dokunma değil): yalnızca o zaman fare bölgesi izlenir
  let px = -1;
  let py = -1;
  let afterPointerClose = () => {}; // akıllı header: fare çekilince header'ı yeniden gizleme denetimi (aşağıda kurulur)
  let quiet = false; // odak tetikleyiciye geri verilirken paneli yeniden açma
  const focusQuietly = (el) => {
    quiet = true;
    el.focus();
    quiet = false;
  };

  /* ── Mega paneller (Hizmetler, Bilgi Merkezi)
     Müşteri (Ekim 2026): «fare paneldeyken tıklamadıysa panel kalsın, alt sınırın dışına inerse kapansın; bazen kalıyor bazen gidiyor».
     • Açılış: tetikleyicide kısa duruş (OPEN_DELAY). Üzerinden geçip giden fare paneli açmaz (açılıp kapanma titremesi olmaz).
     • Açık kalma: fare «bölgede» kaldıkça — bölge = üst şerit + açık panelin kutusu. Bölge geometriyle ölçülür (getBoundingClientRect):
       fare olayları perde (clip-path) inerken panelin henüz çizilmemiş kısmında ya da üstte duran başka bir katmanda güvenilir değildi.
     • Kapanış: fare bölgenin dışına çıkınca (ör. panelin alt kenarının altına inince ya da pencereden çıkınca) CLOSE_DELAY sonra;
       bu sürede bölgeye dönülürse iptal. Kapanınca header, sayfa aşağıdaysa eskisi gibi yeniden gizlenir.
     • Şeritte başka öğeye geçiş: o öğede DURULURSA (SWITCH_DELAY) panel değişir, panelsiz öğede kapanır. Panele doğru çapraz giderken
       üzerinden geçilen öğe paneli değiştirmez (bekleyen açılış, fare öğeden çıkınca iptal edilir).
     • Klavye (odak, ↓, Esc) ve dokunmatik (ilk dokunuş açar, ikinci sayfaya gider) davranışı değişmedi. */
  const OPEN_DELAY = 90;
  const SWITCH_DELAY = 150;
  const CLOSE_DELAY = 220;
  const within = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const inZone = (x, y) => !!openKey && (within(hdr.getBoundingClientRect(), x, y) || within(panels[openKey].getBoundingClientRect(), x, y));
  // Süre dolunca karar bir sonraki karede verilir: tarayıcı o karenin fare olaylarını önce işler. Yoğun/yavaş bir makinede geciken
  // olaylar da karara yetişir (ör. fare öğeden çoktan çıkmışken eski :hover durumuyla panel değişmesin, bölgeye dönmüşken kapanmasın).
  const later = (ms, fn) => setTimeout(() => requestAnimationFrame(fn), ms);
  let intent = null; // bekleyen açılış/geçiş: fare bu öğede duruyor ({ el })
  let closeSeq = 0;
  const cancelClose = () => {
    clearTimeout(closeTimer);
    closeTimer = 0;
    closeSeq++;
  };
  const cancelIntent = () => {
    clearTimeout(openTimer);
    intent = null;
  };
  function openPanel(key, pointer = false) {
    cancelClose();
    if (openKey === key) {
      if (pointer) byPointer = true;
      return;
    }
    closePanels(true, false);
    const p = panels[key];
    if (!p) return;
    p.classList.add('is-open');
    links.forEach((l) => l.setAttribute('aria-expanded', String(l.dataset.panel === key)));
    openKey = key;
    byPointer = pointer;
  }
  // immediate=false: CLOSE_DELAY sonra (bekleyen kapanış yeniden başlatılmaz — bölge dışında gezinen fare kapanışı ertelemesin)
  function closePanels(immediate = false, pointer = false) {
    cancelIntent();
    const done = () => {
      cancelClose();
      const was = openKey;
      Object.values(panels).forEach((p) => p.classList.remove('is-open'));
      links.forEach((l) => l.setAttribute('aria-expanded', 'false'));
      openKey = null;
      byPointer = false;
      if (was && pointer) afterPointerClose();
    };
    if (immediate) return done();
    if (closeTimer) return;
    const seq = closeSeq;
    closeTimer = later(CLOSE_DELAY, () => {
      if (seq !== closeSeq) return; // iptal edildi
      if (pointer && byPointer && inZone(px, py)) return cancelClose(); // bu arada bölgeye dönüldü
      done();
    });
  }
  // fare bir üst menü öğesinde durursa (süre dolduğunda hâlâ üzerindeyse) fn çalışır; öğeden çıkınca iptal
  const dwell = (l, ms, fn) => {
    cancelIntent();
    const it = (intent = { el: l });
    openTimer = later(ms, () => intent === it && l.matches(':hover') && fn());
  };
  // Bekleme, öğenin üzerindeki GERÇEK fare hareketiyle başlar (pointermove): sayfa yukarı kaydırılınca header duran farenin altına
  // kayarak geldiğinde (ör. «Bu sayfada» şeridinden bir bölüme tıklandıktan sonra) panel kendiliğinden açılmaz.
  links.forEach((l) => {
    const key = l.dataset.panel;
    l.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (openKey === key) {
        if (intent) cancelIntent();
        if (closeTimer) cancelClose();
        byPointer = true;
        return;
      }
      if (intent?.el === l) return; // bekleme sürüyor
      // başka bir panel açıkken geçiş için daha uzun duruş gerekir (panele doğru çapraz giderken üzerinden geçilen öğe değiştirmesin)
      dwell(l, openKey ? SWITCH_DELAY : OPEN_DELAY, () => openPanel(key, true));
    });
    l.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && intent?.el === l) cancelIntent();
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
  // panelsiz öğede durmak açık paneli kapatır (üzerinden geçmek kapatmaz)
  plain.forEach((l) => {
    l.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !openKey || intent?.el === l) return;
      dwell(l, SWITCH_DELAY, () => openKey && closePanels(true, true));
    });
    l.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && intent?.el === l) cancelIntent();
    });
  });
  // fare bölgesi: açık panel varken her fare hareketinde bölge denetlenir (yalnızca okuma; değişiklik yalnızca durum değişince)
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (!openKey) return;
      if (inZone(px, py)) {
        // klavyeyle açılmış panele fare girdiyse bundan sonra fare kuralı geçerli
        byPointer = true;
        if (closeTimer) cancelClose();
      } else if (byPointer) closePanels(false, true);
    },
    { passive: true }
  );
  // fare pencereden çıktı: bölgenin dışı sayılır. Son bilinen konum geçersizleşir — panel ekranın altına kadar uzanıyorsa (ör. 1280×720)
  // pencereden çıkmadan önceki son konum hâlâ panelin içindedir; kapanış denetimi onu «bölgeye dönüldü» sanmasın.
  document.addEventListener('mouseout', (e) => {
    if (e.relatedTarget) return;
    px = py = -1;
    if (openKey && byPointer) closePanels(false, true);
  });
  Object.values(panels).forEach((p) => {
    p.addEventListener('focusout', (e) => {
      if (hdr.contains(e.relatedTarget)) return;
      // fareyle açık panelin boş yerine tıklamak odağı panelden alır: fare bölgedeyse panel kalır
      if (byPointer && inZone(px, py)) return;
      closePanels();
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
    let leaveT = 0;
    const setHidden = (v) => {
      // header geri geldiyse bekleyen «fare çekildi → gizle» zamanlayıcısı iptal (yoksa üst kenardan çağrılan header 0,7 sn sonra kaçar)
      if (!v) clearTimeout(leaveT);
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
        // bölüm göstergesinden atlama sürerken (behaviors.js › hud) yukarı kaymak header'ı geri getirmez: hedef bölümün üstünü örtmesin
        if (html.classList.contains('is-jumping') && y >= 120 && !pinned()) {
          setHidden(true);
          lastY = y;
          return;
        }
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
    const hideSoon = () => {
      clearTimeout(leaveT);
      if (scrollY >= 120 && !pinned()) leaveT = setTimeout(() => !pinned() && !hdr.matches(':hover') && !hot.matches(':hover') && scrollY >= 120 && setHidden(true), 700);
    };
    hdr.addEventListener('mouseleave', hideSoon);
    // panel fareyle açıkken header'dan çıkılırsa (panel açık olduğu için o an gizlenmez) panel kapanınca aynı kural işler
    afterPointerClose = () => {
      if (!hdr.matches(':hover')) hideSoon();
    };
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
    // sayfaya göre değişen yüzen «Bu sayfada» şeridi (behaviors.js › toc) de menünün arkasında kalır
    [...behind, ...qsa('.tocdock')].forEach((el) => el.toggleAttribute('inert', open));
  }
  burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  mnav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  matchMedia('(min-width: 75.001em)').addEventListener?.('change', (e) => e.matches && setMenu(false));

  /* ── Efekt anahtarı */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fx-set]');
    if (b) fx.set(b.dataset.fxSet, true);
  });
  fx.refreshSwitches();

  return {
    // sayfa değişince menüleri kapat, aktif bağlantıyı güncelle (header.njk ile aynı kural: adres ya da data-match öneki)
    onNavigate(url) {
      closePanels(true);
      setMenu(false);
      const mark = (l, on, value) => {
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', value);
        else l.removeAttribute('aria-current');
      };
      qsa('.nav__link', hdr).forEach((l) => {
        const href = l.getAttribute('href');
        const extra = l.dataset.match;
        mark(l, href !== '/' && (url.startsWith(href) || (!!extra && url.startsWith(extra))), 'true');
      });
      qsa('.hdr__icon[href], .hdr__cta', hdr).forEach((l) => mark(l, url.startsWith(l.getAttribute('href')), 'page'));
    },
  };
}
