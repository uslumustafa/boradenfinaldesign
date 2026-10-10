// Mini sayfa yönlendirici: gerçek URL'ler korunur; JS varsa içerik değiştirilir, kalıcı 3B tuval kesintisiz yaşar.
// Geçiş: içerik solar, arka plandaki 3B noktalar tıklanan noktadan dışarı akar (world.surge); yeni sayfa gelince
// noktalar içeri akıp yeni sayfanın şekline oturur, içerik yükselerek belirir. «Kapalı» katmanda geçiş yoktur.
// Sıra (her seferinde aynı): çıkış → noktalar ekran dışına varır (dünya saatle ilerler, kalan süreyi bildirir) + sayfa getirilir →
// içerik değişir, yeni sayfanın sahne hedefi aynı anda verilir (behaviors › director) → giriş (noktalar yeni şekle akar).
// JS yoksa / hata olursa normal sayfa geçişi çalışır.
import { clamp, qs } from './util.js';

const SKIP_EXT = /\.(pdf|xlsx?|docx?|zip|xml|json|txt|jpg|jpeg|png|webp|svg|mp4)$/i;
const PAGE_HEAD = 'meta[name="description"],meta[name="robots"],link[rel="canonical"],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"]';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Gelen sayfayı etkisiz bir <template> içinde ayrıştırır (betik çalışmaz, görsel/video yüklenmez). DOMParser belgesi —
// içindeki <video> yüzünden — hiç toplanmıyordu: ana sayfaya her dönüşte bir belge (≈ 2.400 düğüm) birikiyordu (T-10).
function parsePage(text) {
  const t = document.createElement('template');
  t.innerHTML = text;
  const f = t.content;
  return { main: f.querySelector('#main'), title: f.querySelector('title')?.textContent ?? '', head: f.querySelectorAll(PAGE_HEAD) };
}

export function initRouter({ fx, world, mount, unmount, onNavigate }) {
  const main = qs('#main');
  const html = document.documentElement;
  let enterT = 0;
  const live = qs('#live');
  const cache = new Map();
  let nav = 0; // geçerli gezinme kimliği (yarışlara karşı)
  let shown = location.pathname + location.search; // şu an gösterilen sayfa (hash hariç)
  const positions = new Map();
  let shownEntry = history.state?.boradenEntry ?? 0;
  let entrySeq = shownEntry;
  let hoverTimer = 0;
  let busyT = 0;

  history.scrollRestoration = 'manual';
  history.replaceState({ ...history.state, boradenEntry: shownEntry, y: scrollY }, '');

  // Sayfa içi bağlantıda («İçeriğe geç», içindekiler, #çapa) tarayıcı odağı da hedefe taşır; kaydırmayı biz
  // yönettiğimiz için (yumuşak kaydırma) odağı da biz taşırız. Odaklanamayan hedefe (başlık) tabindex=-1 verilir.
  function focusTarget(t) {
    if (!t.matches('a[href],button,input,select,textarea,summary,[tabindex]')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  }
  const sameOrigin = (a) => a.origin === location.origin;
  const eligible = (a) =>
    a &&
    a.href &&
    sameOrigin(a) &&
    !a.hasAttribute('download') &&
    !a.hasAttribute('data-no-swap') &&
    (!a.target || a.target === '_self') &&
    !SKIP_EXT.test(a.pathname) &&
    !a.pathname.startsWith('/assets/');

  async function fetchPage(url) {
    if (cache.has(url)) return cache.get(url);
    const p = fetch(url, { headers: { 'X-Requested-With': 'boraden-swap' } }).then((r) => {
      if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('text/html')) throw new Error('html değil');
      return r.text().then((text) => ({ text, status: r.status }));
    });
    cache.set(url, p);
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    p.catch(() => cache.delete(url));
    return p;
  }

  // Geçişin «çıkış» yarısı: içerik solar, noktalar dışarı akar. Dünya yüklü değilse yalnızca kısa bir solma.
  function leave(from) {
    if (fx.tier === 'off') return 0;
    clearTimeout(enterT);
    html.classList.remove('is-entering');
    html.classList.add('is-leaving');
    if (world?.live) {
      const nx = from ? clamp((from.x / innerWidth) * 2 - 1, -1, 1) : 0;
      const ny = from ? clamp(-((from.y / innerHeight) * 2 - 1), -1, 1) : 0;
      // noktalar ekran dışına varana kadar beklenir; içerik solması (0,24 sn) da bitsin
      const ms = world.surge(true, nx, ny);
      return Math.max(260, (Number.isFinite(ms) ? ms : 350) + 30);
    }
    return 200;
  }
  // «Giriş» yarısı: noktalar yeni şekle oturur, içerik belirir
  function enter() {
    if (fx.tier === 'off') {
      html.classList.remove('is-leaving', 'is-entering');
      return;
    }
    html.classList.remove('is-leaving');
    html.classList.add('is-entering');
    world?.surge(false);
    enterT = setTimeout(() => html.classList.remove('is-entering'), 1100);
  }
  function abort() {
    clearTimeout(enterT);
    busy(false);
    html.classList.remove('is-leaving', 'is-entering');
    world?.surge(false);
  }
  // Yavaş ağ (T-14, U-13): çıkış bittiği hâlde sayfa gelmediyse ince bir yükleme çizgisi (.prog, 80-fx.css › is-loading).
  // Tıklamadan en az 300 ms sonra ve çıkış efektinden 100 ms sonra; yanıt o ana dek geldiyse hiç görünmez (kısa gezinmede yanıp sönmez).
  function busy(on, page, ms = 0) {
    clearTimeout(busyT);
    if (!on) {
      html.classList.remove('is-loading');
      main.removeAttribute('aria-busy');
      return;
    }
    let arrived = false;
    page.then(
      () => (arrived = true),
      () => {}
    );
    busyT = setTimeout(() => {
      if (arrived) return;
      html.classList.add('is-loading');
      main.setAttribute('aria-busy', 'true');
    }, Math.max(300, ms + 100));
  }

  function applyDocument(doc, url, { push, y, entry }) {
    const next = doc.main;
    if (!next) throw new Error('main yok');
    unmount();
    document.title = doc.title;
    // Sayfaya ait head verisini değiştir; kalıcı CSS ve çalıştırılabilir betikler kabukta kalır.
    document.head.querySelectorAll(PAGE_HEAD).forEach((el) => el.remove());
    doc.head.forEach((el) => document.head.append(document.importNode(el, true)));
    document.body.className = next.dataset.bodyClass || '';
    fx.syncLayout?.();
    for (const a of ['data-scene', 'data-shapes', 'data-url', 'data-title', 'data-body-class']) {
      if (next.hasAttribute(a)) main.setAttribute(a, next.getAttribute(a));
      else main.removeAttribute(a);
    }
    main.innerHTML = next.innerHTML;
    shownEntry = push ? ++entrySeq : entry ?? ++entrySeq;
    entrySeq = Math.max(entrySeq, shownEntry);
    if (push) history.pushState({ boradenEntry: shownEntry, y: 0 }, '', url);
    else if (entry == null) history.replaceState({ ...history.state, boradenEntry: shownEntry, y }, '');
    shown = location.pathname + location.search;
    window.scrollTo(0, push ? 0 : y || 0);
    onNavigate(new URL(url, location.href).pathname);
    mount(main);
    // #çapa ile gelinen gezinme (ör. /sozluk/#kdv): hedefe kaydır (geri/ileri ise kayıtlı konum korunur)
    const hash = new URL(url, location.href).hash;
    if (hash && push) {
      let target = null;
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)));
      } catch (e) {
        /* geçersiz kodlama */
      }
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: 'start' });
          focusTarget(target);
        });
      }
    }
    // odak + ekran okuyucu duyurusu
    main.focus({ preventScroll: true });
    if (live) live.textContent = doc.title;
  }

  async function go(url, { push = true, y = 0, entry, from = null } = {}) {
    const id = ++nav;
    // popstate sırasında adres artık hedef kayda aittir; gösterilen sayfanın konumunu ayrı sakla.
    positions.set(shownEntry, scrollY);
    if (push && history.state?.boradenEntry === shownEntry) history.replaceState({ ...history.state, y: scrollY }, '');
    try {
      const page = fetchPage(url);
      const out = leave(from);
      busy(true, page, out);
      const [res] = await Promise.all([page, wait(out)]);
      if (id !== nav) return; // daha yeni bir gezinme başladı (o, geçişi kendisi sürdürür)
      busy(false);
      const doc = parsePage(res.text);
      applyDocument(doc, url, { push, y, entry });
      enter();
    } catch (err) {
      if (id !== nav) return; // eski isteğin hatası yeni gezinmeyi iptal edemez
      abort();
      console.warn('[router] tam sayfa yüklemeye dönülüyor:', err.message);
      location.href = url;
    }
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!eligible(a)) return;
    const u = new URL(a.href);
    // aynı sayfa içi bağlantı: normal davranış (kaydırma)
    if (u.pathname === location.pathname && u.search === location.search) {
      if (u.hash) {
        const t = document.getElementById(decodeURIComponent(u.hash.slice(1)));
        if (t) {
          e.preventDefault();
          t.scrollIntoView({ behavior: fx.tier === 'off' ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(history.state, '', u.hash);
          focusTarget(t);
        }
      } else {
        e.preventDefault();
        scrollTo({ top: 0, behavior: fx.tier === 'off' ? 'auto' : 'smooth' });
      }
      return;
    }
    e.preventDefault();
    // fare/dokunma ile tıklandıysa noktalar tıklanan noktadan dışarı akar (klavye: ekran ortası)
    go(u.pathname + u.search + u.hash, { from: e.detail > 0 ? { x: e.clientX, y: e.clientY } : null });
  });

  addEventListener('popstate', (e) => {
    positions.set(shownEntry, scrollY);
    const entry = e.state?.boradenEntry;
    const y = positions.get(entry) ?? e.state?.y ?? 0;
    const next = location.pathname + location.search;
    if (next === shown) {
      ++nav;
      abort();
      shownEntry = entry ?? ++entrySeq;
      entrySeq = Math.max(entrySeq, shownEntry);
      if (entry == null) history.replaceState({ ...history.state, boradenEntry: shownEntry, y }, '');
      // aynı sayfa: yalnızca hash/kaydırma değişti
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
      else window.scrollTo(0, y);
      return;
    }
    go(next, { push: false, y, entry });
  });

  // Üzerine gelince önceden getir
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a');
    if (!eligible(a)) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const u = new URL(a.href);
      if (u.pathname !== location.pathname) fetchPage(u.pathname + u.search).catch(() => {});
    }, 90);
  });
  document.addEventListener('touchstart', (e) => {
    const a = e.target.closest('a');
    if (eligible(a)) fetchPage(new URL(a.href).pathname).catch(() => {});
  }, { passive: true });

  return { go };
}
