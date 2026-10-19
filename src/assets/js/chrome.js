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
     Müşteri (18 Ekim 2026): «fare paneldeyken tıklamadıysa panel kalsın, alt sınırın dışına inerse kapansın; bazen kalıyor bazen gidiyor».
     Müşteri (19 Ekim 2026): «navbar'a gelince nasıl çıkacağız» — önceki sürümde üst şeridin tamamı bölgeye dahildi: fare şeritte yana
     (logoya, boş alana, aramaya, İletişim düğmesine) gidince panel açık kalıyordu; Hizmetler paneli de ekranın altına kadar indiği için
     aşağıdan çıkılamıyordu (30-layout.css artık panelin altında sayfadan bir şerit bırakır).
     • Açılış: tetikleyicide kısa duruş (OPEN_DELAY). Üzerinden geçip giden fare paneli açmaz (açılıp kapanma titremesi olmaz).
     • Açık kalma: fare «bölgede» kaldıkça — bölge = açık panelin tetikleyici sütunu (öğenin genişliği × header'ın boyu) + panelin kutusu
       + tetikleyiciden panele doğru giden yol (fare sütundan çıktığı noktadan panelin üst kenarına doğru açılan üçgen; AIM_MS boyunca).
       Bölge geometriyle ölçülür (getBoundingClientRect): fare olayları perde (clip-path) inerken panelin henüz çizilmemiş kısmında güvenilir
       değildi.
     • Kapanış: fare bölgenin dışına çıkınca — panelin alt kenarının altına inince, şeritte tetikleyiciden yana (logo, boş alan, arama,
       İletişim) gidince, panelden yukarı şeride çıkınca ya da pencereden çıkınca — CLOSE_DELAY sonra; bu sürede dönülürse iptal.
       Kapanınca header, sayfa aşağıdaysa eskisi gibi yeniden gizlenir.
     • Şeritte başka öğeye geçiş: o öğede DURULURSA (SWITCH_DELAY) panel doğrudan değişir (arada kapanmaz); panelsiz öğede durunca
       (PLAIN_DELAY) kapanır. Menü öğelerinin arasından geçen fareye TRANSIT_MS süre tanınır (öğeler arası boşluk ya da üzerinden geçilen
       panelsiz öğe paneli hemen kapatmaz); menü öğelerinin dışına (logo, boş alan, arama, İletişim) çıkınca CLOSE_DELAY geçerlidir. Panele
       doğru çapraz giden fare (üçgenin içinde) üzerinden geçtiği öğeyle paneli değiştirmez ya da kapatmaz.
     • Klavye (odak, ↓, Esc) ve dokunmatik (ilk dokunuş açar, ikinci sayfaya gider) davranışı değişmedi. */
  const OPEN_DELAY = 90;
  const SWITCH_DELAY = 150;
  const CLOSE_DELAY = 220;
  const PLAIN_DELAY = 250; // panelsiz öğede bu kadar durunca panel kapanır (üzerinden geçerken kapanmasın: Hizmetler → Sektörler → Bilgi Merkezi)
  const TRANSIT_MS = 450;
  const AIM_MS = 600;
  const navList = qs('.nav__list', hdr);
  const within = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  // açık panelin tetikleyici sütunu: öğe (li) ± 8 px genişliğinde, header'ın üst kenarından panelin üst kenarına
  const colRect = (key) => {
    const l = links.find((x) => x.dataset.panel === key);
    const a = (l.closest('li') || l).getBoundingClientRect();
    const h = hdr.getBoundingClientRect();
    return { left: a.left - 8, right: a.right + 8, top: h.top, bottom: h.bottom };
  };
  // panele doğru giden yol: fare sütundan şeride çıktığı noktadan (aim) aşağıya, panelin üst kenarına doğru genişleyen üçgen. Yatay
  // (şerit boyunca) giden fare üçgenin dışında kalır; aşağı-çapraz giden içinde. Süresi (AIM_MS) dolunca geçersiz: şeritte duran fare paneli tutmaz.
  let aim = null; // { x, y, t }
  let lastCol = null; // farenin sütundaki son konumu
  let aimTimer = 0;
  const aiming = (x, y) => {
    if (!aim || !openKey || performance.now() - aim.t > AIM_MS) return false;
    const top = panels[openKey].getBoundingClientRect().top;
    const dy = y - aim.y;
    if (dy < -4 || y > top + 2) return false;
    const dx = x - aim.x;
    const k = (dx < 0 ? aim.x : innerWidth - aim.x) / Math.max(1, top - aim.y);
    return Math.abs(dx) <= Math.max(0, dy) * k + 12;
  };
  const inPanel = (x, y) => !!openKey && within(panels[openKey].getBoundingClientRect(), x, y);
  const inCol = (x, y) => !!openKey && within(colRect(openKey), x, y);
  const inZone = (x, y) => inPanel(x, y) || inCol(x, y) || aiming(x, y);
  // Süre dolunca karar bir sonraki karede verilir: tarayıcı o karenin fare olaylarını önce işler. Yoğun/yavaş bir makinede geciken
  // olaylar da karara yetişir (ör. fare öğeden çoktan çıkmışken eski :hover durumuyla panel değişmesin, bölgeye dönmüşken kapanmasın).
  const later = (ms, fn) => setTimeout(() => requestAnimationFrame(fn), ms);
  let intent = null; // bekleyen açılış/geçiş: fare bu öğede duruyor ({ el })
  let closeSeq = 0;
  let closeAt = 0; // gecikmeli kapanışın başladığı an
  const cancelClose = () => {
    clearTimeout(closeTimer);
    closeTimer = 0;
    closeSeq++;
  };
  const cancelIntent = () => {
    clearTimeout(openTimer);
    intent = null;
  };
  const resetAim = () => {
    aim = lastCol = null;
    clearTimeout(aimTimer);
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
    if (pointer && inCol(px, py)) lastCol = { x: px, y: py };
  }
  // immediate=false: CLOSE_DELAY sonra (bekleyen kapanış yeniden başlatılmaz — bölge dışında gezinen fare kapanışı ertelemesin).
  // Fare başka bir panelli öğenin üzerinde bekliyorsa (geçiş süresi işliyor) panel kapanmaz: geçiş doğrudan olur, arada boş an yok.
  // Fare menü öğelerinin arasındaysa kapanış, başladığı andan TRANSIT_MS sonrasına kadar ertelenir. Farenin gecikmeli kapanışı bekleyen
  // öğe beklemesini (geçiş / panelsiz öğede kapanış) iptal etmez.
  function closePanels(immediate = false, pointer = false) {
    if (immediate || !pointer) cancelIntent();
    const done = () => {
      cancelClose();
      cancelIntent();
      resetAim();
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
    closeAt = performance.now();
    const check = () => {
      if (seq !== closeSeq) return; // iptal edildi
      if (pointer && byPointer && inZone(px, py)) return cancelClose(); // bu arada bölgeye dönüldü
      if (pointer && intent && links.includes(intent.el) && intent.el.matches(':hover')) return cancelClose(); // geçiş bekleniyor
      const left = TRANSIT_MS - (performance.now() - closeAt);
      if (pointer && left > 16 && within(navList.getBoundingClientRect(), px, py)) {
        closeTimer = later(left, check); // menü öğelerinin arasından geçiyor
        return;
      }
      done();
    };
    closeTimer = later(CLOSE_DELAY, check);
  }
  // fare bir üst menü öğesinde durursa (süre dolduğunda hâlâ üzerindeyse) fn çalışır; öğeden çıkınca iptal. Panele doğru çapraz giden
  // fare (üçgenin içinde) üzerinden geçtiği öğeyi seçmez; orada durursa üçgenin süresi dolunca seçer.
  const dwell = (l, ms, fn) => {
    cancelIntent();
    const it = (intent = { el: l });
    const fire = () => {
      if (intent !== it || !l.matches(':hover')) return;
      if (aiming(px, py)) {
        openTimer = later(Math.max(30, AIM_MS - (performance.now() - aim.t)), fire);
        return;
      }
      intent = null;
      fn();
    };
    openTimer = later(ms, fire);
  };
  // Bekleme, öğenin üzerindeki GERÇEK fare hareketiyle başlar (pointermove): sayfa yukarı kaydırılınca header duran farenin altına
  // kayarak geldiğinde (ör. «Bu sayfada» şeridinden bir bölüme tıklandıktan sonra) panel kendiliğinden açılmaz.
  // Dokunuşla gelen odak paneli açmaz: dokunmatikte ilk dokunuşu tıklama işleyicisi karşılar (açar), ikincisi sayfaya gider. (Chrome
  // dokunulan bağlantıya tıklamadan önce odak verir; odak paneli açınca tıklama «ikinci dokunuş» sayılıp ilk dokunuşta sayfaya gidiliyordu.)
  let touchAt = -1e9;
  hdr.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && (touchAt = performance.now()), { passive: true });
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
      if (!quiet && performance.now() - touchAt > 800) openPanel(key);
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
  // panelsiz öğe bölgenin dışındadır: üzerinde durunca (PLAIN_DELAY) panel kapanır; üzerinden geçip giden fare kapatmaz. Panele doğru
  // çapraz giderken (üçgenin içinde) orada kısa durmak da kapatmaz; üçgenin süresi dolunca kapatır.
  plain.forEach((l) => {
    l.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !openKey || intent?.el === l) return;
      dwell(l, PLAIN_DELAY, () => openKey && closePanels(true, true));
    });
    l.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && intent?.el === l) cancelIntent();
    });
  });
  // fare bölgesi: açık panel varken her fare hareketinde bölge denetlenir (yalnızca okuma; değişiklik yalnızca durum değişince)
  const track = (x, y) => {
    if (inPanel(x, y)) {
      aim = lastCol = null; // panele girildi: yol tamam
    } else if (inCol(x, y)) {
      aim = null;
      lastCol = { x, y };
    } else if (lastCol && !aim) {
      // sütundan şeride çıktı: üçgenin tepesi sütundaki son nokta; süresi dolunca (fare şeritte durmuşsa) yeniden karar verilir
      aim = { x: lastCol.x, y: lastCol.y, t: performance.now() };
      lastCol = null;
      clearTimeout(aimTimer);
      aimTimer = setTimeout(() => openKey && byPointer && !inZone(px, py) && closePanels(false, true), AIM_MS + 20);
    }
    if (inZone(x, y)) {
      // klavyeyle açılmış panele fare girdiyse bundan sonra fare kuralı geçerli
      byPointer = true;
      if (closeTimer) cancelClose();
    } else if (byPointer) closePanels(false, true);
  };
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (openKey) track(px, py);
    },
    { passive: true }
  );
  // fare pencereden çıktı: bölgenin dışı sayılır. Son bilinen konum geçersizleşir — panel ekranın altına kadar uzanıyorsa (ör. 1280×720)
  // pencereden çıkmadan önceki son konum hâlâ panelin içindedir; kapanış denetimi onu «bölgeye dönüldü» sanmasın.
  document.addEventListener('mouseout', (e) => {
    if (e.relatedTarget) return;
    px = py = -1;
    cancelIntent(); // pencereden çıkan fare bekleyen geçişi de bırakır
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
