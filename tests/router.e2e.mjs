// Sayfa geçişi (router) + klavye + mobil menü + efekt anahtarı uçtan uca denetimi (gerçek Chrome, Playwright).
// Çalışan bir sunucu gerekir (npm run dev ya da BORADEN_DIST=… PORT=… node scripts/serve.mjs).
//   node tests/router.e2e.mjs [--base=http://127.0.0.1:4181] [--only=router|keys|menu|fx|offline]
// Denetlenenler:
//   router — tam yeniden yükleme olmadan gezinme (sayfa işareti + kalıcı tuval), başlık/duyuru/odak, aria-current,
//            geri/ileri (+ ?q= durumu), modüllerin yeniden kurulması (sözlük, arşiv, hesaplayıcı, iletişim formu, arama), 404
//   keys   — «İçeriğe geç» bağlantısı, klavye gezinmesi sonrası odak halkası, mega menü (odak/ArrowDown ile aç, Esc ile kapat)
//   menu   — mobil menü: <nav> işareti, aç/kapa, arka plan inert, Tab menü dışına çıkmaz, Esc → odak düğmeye, bağlantı → kapanır
//   fx     — azaltılmış hareket → Kapalı; Tam/Hafif/Kapalı anahtarı kalıcı; tek depolama anahtarı boraden-fx (çerez yok)
//   offline — ağ yokken iç bağlantı: sayfada kalınır, «Bağlantı yok» uyarısı + «Yeniden dene»; sunucu hatası tam yüklemeye döner
import { chromium } from 'playwright-core';
import { guardContext, driverNoise, softwareGL } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ONLY = arg('only', '');
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function newPage(opts = {}) {
  // guardContext: gerçek Chrome'un mailto:/tel: gibi gezinmeleri işletim sistemine (Mail.app) devretmesini engeller (bkz. safe-context.mjs)
  const ctx = await guardContext(
    await browser.newContext({
      viewport: { width: opts.w || 1440, height: opts.h || 900 },
      isMobile: !!opts.mobile,
      hasTouch: !!opts.mobile,
      reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    }),
  );
  if (opts.fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), opts.fx);
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()) && !driverNoise(m.text())) logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) logs.push(`[failed] ${r.url()}`);
  });
  return { ctx, page, logs };
}

// sayfayı aç; main.js çalışıp router kurulana kadar bekle (yoksa tıklama tam sayfa yüklemesine düşer)
async function open(page, path) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 8000 });
}
// router geçişi tamamlandı: <main data-url> yeni yol + odak <main> üzerinde
async function waitSwap(page, path) {
  const want = path.split('#')[0].split('?')[0];
  await page.waitForFunction(
    (w) => document.getElementById('main').dataset.url === w && document.activeElement?.id === 'main',
    want,
    { timeout: 8000 },
  );
}
// gerçek kullanıcı tıklamasıyla aynı yoldan (belge düzeyinde click) — görünür bağlantısı olmayan derin sayfalar için
async function clickAnchor(page, href) {
  await page.evaluate((h) => {
    const a = document.createElement('a');
    a.href = h;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, href);
}
async function viaLink(page, href) {
  await clickAnchor(page, href);
  await waitSwap(page, href);
}
const snap = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      alive: window.__alive || '',
      path: location.pathname + location.search,
      dataUrl: document.getElementById('main').dataset.url,
      title: document.title,
      live: document.getElementById('live').textContent,
      focus: a ? a.id || a.tagName.toLowerCase() : '',
      canvas: !!document.getElementById('world-canvas')?.__same,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      current: [...document.querySelectorAll('#hdr .nav__link[aria-current]')].map((l) => l.getAttribute('href')),
    };
  });
const visibleCount = (page, sel) => page.$$eval(`${sel} [data-item]`, (els) => els.filter((e) => !e.hidden).length);

/* ─── Router: gezinme zinciri, geri/ileri, modüllerin yeniden kurulması ─── */
async function router() {
  console.log('Sayfa geçişleri (router)');
  const { ctx, page, logs } = await newPage({ fx: 'off' });
  await open(page, '/');
  await page.evaluate(() => {
    window.__alive = 'evet';
    document.getElementById('world-canvas').__same = 1;
  });
  let s = await snap(page);
  ok(s.dataUrl === '/' && s.h1.length === 1, 'ana sayfa açıldı, tek <h1>');

  // 1) gerçek tıklama: üst menüden «Hakkımızda»
  await page.locator('#hdr a.nav__link[href="/hakkimizda/"]').click();
  await waitSwap(page, '/hakkimizda/');
  s = await snap(page);
  ok(s.alive === 'evet', 'tam yeniden yükleme yok (sayfa işareti korundu)');
  ok(s.path === '/hakkimizda/', 'adres çubuğu /hakkimizda/');
  ok(/Hakkımızda/.test(s.title) && s.live === s.title, `başlık güncellendi, ekran okuyucuya duyuruldu: «${s.title}»`);
  ok(s.focus === 'main', 'odak <main> üzerine alındı');
  ok(s.canvas, 'kalıcı 3B tuval aynı öğe olarak yaşıyor');
  ok(s.h1.length === 1, `tek <h1>: «${s.h1[0]}»`);
  ok(JSON.stringify(s.current) === '["/hakkimizda/"]', 'üst menüde yalnızca Hakkımızda aria-current');

  // 2) sözlük: arama modülü yeniden kurulmuş mu
  await viaLink(page, '/bilgi-merkezi/sozluk/');
  const gl = '[data-listing="glossary"]';
  const g0 = await visibleCount(page, gl);
  await page.fill(`${gl} [data-search]`, 'kdv');
  await page.waitForTimeout(500);
  const g1 = await visibleCount(page, gl);
  ok(g0 > 5 && g1 > 0 && g1 < g0, `sözlük araması çalışıyor (${g0} → ${g1} terim)`);
  await page.fill(`${gl} [data-search]`, '');
  await page.waitForTimeout(500);
  ok((await visibleCount(page, gl)) === g0, 'arama temizlenince liste eski haline dönüyor');

  // 3) sirküler arşivi: süzme + adres durumu; geri/ileri
  await viaLink(page, '/bilgi-merkezi/sirkulerler/');
  const ar = '[data-listing="arsiv"]';
  const a0 = await visibleCount(page, ar);
  await page.fill(`${ar} [data-search]`, '2021/215');
  await page.waitForTimeout(500);
  const a1 = await visibleCount(page, ar);
  ok(a0 > 5 && a1 > 0 && a1 < a0, `arşiv araması çalışıyor (${a0} → ${a1} sirküler)`);
  const q = await page.evaluate(() => location.search);
  ok(/q=2021(%2F|\/)215/.test(q), `arama adres çubuğuna yansıdı (${q})`);
  await page.goBack();
  await waitSwap(page, '/bilgi-merkezi/sozluk/');
  s = await snap(page);
  ok(s.alive === 'evet' && s.path === '/bilgi-merkezi/sozluk/', 'geri → sözlük (tam yükleme yok; arşivdeki arama geçmişe eklenmemiş)');
  await page.goForward();
  await waitSwap(page, '/bilgi-merkezi/sirkulerler/');
  ok((await page.inputValue(`${ar} [data-search]`)) === '2021/215', 'ileri → arşiv, arama sorgusu adres çubuğundan geri yüklendi');
  ok((await visibleCount(page, ar)) === a1, 'ileri → süzülmüş liste yeniden kuruldu');

  // 4) hesaplayıcı: sonuç alanı dolu, girdiye tepki veriyor
  await viaLink(page, '/hesaplayicilar/kdv-hesaplama/');
  await page.waitForFunction(() => (document.querySelector('[data-calc-res]')?.textContent || '').trim().length > 20, null, { timeout: 8000 });
  const r0 = await page.textContent('[data-calc-res]');
  await page
    .locator('[data-calc-form] input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([type=range])')
    .first()
    .fill('3719');
  await page.waitForTimeout(600);
  const r1 = await page.textContent('[data-calc-res]');
  ok(r0 !== r1, 'hesaplayıcı girdiye tepki veriyor (sonuç değişti)');

  // 5) iletişim (CTA düğmesi): form doğrulaması yeniden kurulmuş mu
  // header aşağı kaydırınca gizlenir (tasarım gereği); üst kenara fare getirmek de açar
  await page.mouse.move(600, 4);
  await page.waitForFunction(() => !document.documentElement.classList.contains('hdr-hidden'), null, { timeout: 3000 });
  await page.locator('#hdr a.hdr__cta').click();
  await waitSwap(page, '/iletisim/');
  await page.click('.ct-submit');
  const inv = await page.$$eval('#ct-form .ct-field.is-invalid', (els) => els.map((e) => e.dataset.field));
  ok(JSON.stringify(inv) === JSON.stringify(['ad', 'eposta', 'konu', 'mesaj', 'kvkk-onay']), `iletişim formu doğrulaması çalışıyor (hatalı alanlar: ${inv.join(', ')})`);

  // 6) arama sayfası: ?q= ile gelen sorgu
  await viaLink(page, '/arama/?q=kdv');
  await page.waitForFunction(() => document.querySelectorAll('[data-sr-results] a').length > 0, null, { timeout: 8000 });
  ok((await page.inputValue('input[name="q"]')) === 'kdv', 'arama kutusu ?q= ile dolu, sonuçlar geldi');

  // 7) var olmayan sayfa: 404 içeriği perde içinde gösterilir (tam yükleme yok)
  await clickAnchor(page, '/yok-boyle-bir-sayfa/');
  await page.waitForFunction(() => /bulunamadı/i.test(document.title), null, { timeout: 8000 });
  s = await snap(page);
  ok(s.alive === 'evet' && /bulunamadı/i.test(s.title) && s.h1.length === 1, `404 sayfası geçişle gösterildi: «${s.title}»`);
  // tarayıcı 404 yanıtını her zaman konsola yazar; bu beklenen gürültüyü ayıkla, gerisi temiz olmalı
  for (let k = logs.length - 1; k >= 0; k--) if (/yok-boyle-bir-sayfa|Failed to load resource.*404/.test(logs[k])) logs.splice(k, 1);
  // router 404'te adres çubuğunu hedef URL'ye çeker; geri gelince arama sayfası
  await page.goBack();
  await waitSwap(page, '/arama/');

  // 8) geri zinciri
  const back = ['/iletisim/', '/hesaplayicilar/kdv-hesaplama/', '/bilgi-merkezi/sirkulerler/', '/bilgi-merkezi/sozluk/', '/hakkimizda/', '/'];
  const got = [];
  for (const want of back) {
    await page.goBack();
    await waitSwap(page, want);
    got.push((await snap(page)).dataUrl);
  }
  ok(JSON.stringify(got) === JSON.stringify(back), `geri zinciri doğru (${got.length} adım)`);
  s = await snap(page);
  ok(s.alive === 'evet' && s.canvas, 'tüm zincir boyunca tek belge ve tek tuval (tam yükleme hiç olmadı)');
  ok(logs.length === 0, 'konsol/ağ temiz' + (logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

/* ─── Klavye: skip bağlantısı, odak halkası, mega menü ─── */
async function keys() {
  console.log('Klavye');
  const { ctx, page, logs } = await newPage({ fx: 'off' });
  await open(page, '/hakkimizda/');

  // «İçeriğe geç»: ilk Tab ile görünür, Enter ile odak <main>'e taşınır
  await page.keyboard.press('Tab');
  let f = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return { cls: a.className, text: a.textContent.trim(), top: r.top, w: r.width, h: r.height };
  });
  ok(/skip/.test(f.cls) && f.top >= 0 && f.w > 40 && f.h > 20, `ilk Tab → «${f.text}» bağlantısı ekranda görünür`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  f = await page.evaluate(() => ({ id: document.activeElement.id, cls: document.activeElement.className, hash: location.hash }));
  ok(f.id === 'main', `«İçeriğe geç» sonrası odak <main> üzerinde (şu an: ${f.id || f.cls || 'başka'})`);
  ok(f.hash === '#main', 'adres çubuğu #main');

  // klavye ile gezinme sonrası odaklı <main> çerçeve çizmesin
  await page.focus('#hdr a.nav__link[href="/sektorler/"]');
  await page.keyboard.press('Enter');
  await waitSwap(page, '/sektorler/');
  const o = await page.evaluate(() => {
    const m = document.getElementById('main');
    const cs = getComputedStyle(m);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), fv: m.matches(':focus-visible') };
  });
  ok(o.style === 'none' || o.width === 0, `klavye gezinmesinden sonra <main> çerçevesiz (outline: ${o.style} ${o.width}px, focus-visible: ${o.fv})`);

  // mega menü: odak ile açılır, ArrowDown paneli içine girer, Esc kapatır ve odağı tetikleyiciye döndürür
  const trig = '#hdr a.nav__link[data-panel="services"]';
  await page.focus(trig);
  await page.waitForTimeout(100);
  ok((await page.getAttribute(trig, 'aria-expanded')) === 'true', 'Hizmetler bağlantısına odak → mega panel açıldı (aria-expanded=true)');
  await page.keyboard.press('ArrowDown');
  f = await page.evaluate(() => ({ inPanel: !!document.activeElement.closest('#mega-services'), tag: document.activeElement.tagName }));
  ok(f.inPanel && f.tag === 'A', 'ArrowDown → odak panelin ilk bağlantısına geçti');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  f = await page.evaluate((t) => ({ open: document.getElementById('mega-services').classList.contains('is-open'), onTrig: document.activeElement === document.querySelector(t) }), trig);
  ok(!f.open && f.onTrig, `Esc → panel kapandı ve odak tetikleyiciye döndü (açık: ${f.open}, odak tetikleyicide: ${f.onTrig})`);
  ok((await page.getAttribute(trig, 'aria-expanded')) === 'false', 'tetikleyici aria-expanded=false (odak dönünce panel yeniden açılmadı)');

  // Tab ile başka üst menü bağlantısına geçince panel açık kalmasın (önce odağı bırak ki «focus» olayı yeniden tetiklensin)
  await page.evaluate(() => document.activeElement.blur());
  await page.focus(trig);
  await page.waitForTimeout(100);
  ok((await page.getAttribute(trig, 'aria-expanded')) === 'true', 'odak yeniden verilince panel yeniden açıldı');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  f = await page.evaluate(() => ({ open: document.getElementById('mega-services').classList.contains('is-open'), at: document.activeElement.getAttribute('href') }));
  ok(!f.open, `Tab ile «${f.at}» bağlantısına geçince Hizmetler paneli kapandı`);
  ok(logs.length === 0, 'konsol/ağ temiz' + (logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

/* ─── Mobil menü ─── */
async function menu() {
  console.log('Mobil menü (390×844, dokunmatik)');
  const { ctx, page, logs } = await newPage({ w: 390, h: 844, mobile: true, fx: 'off' });
  await open(page, '/');
  const info = () =>
    page.evaluate(() => {
      const b = document.querySelector('.hdr__burger');
      const m = document.getElementById('mnav');
      const a = document.activeElement;
      return {
        tag: m.tagName,
        label: m.getAttribute('aria-label'),
        expanded: b.getAttribute('aria-expanded'),
        open: m.classList.contains('is-open'),
        vis: getComputedStyle(m).visibility,
        inert: ['.skip', '#main', '#footer'].map((s) => document.querySelector(s).hasAttribute('inert')),
        overflow: document.documentElement.style.overflow,
        focus: a === b ? 'burger' : a?.closest('#mnav') ? 'menu' : a?.closest('#main,#footer,.skip') ? 'page' : a?.tagName.toLowerCase() || '',
      };
    });
  let i = await info();
  ok(i.tag === 'NAV' && i.label === 'Mobil menü', 'mobil menü bir <nav> (aria-label="Mobil menü")');
  ok(i.expanded === 'false' && i.vis === 'hidden' && !i.inert.some(Boolean), 'kapalıyken: aria-expanded=false, gizli, arka plan etkin');

  await page.tap('.hdr__burger');
  await page.waitForTimeout(200);
  i = await info();
  ok(i.expanded === 'true' && i.open && i.vis === 'visible', 'düğmeye dokununca menü açıldı');
  ok(i.inert.every(Boolean), 'açıkken skip bağlantısı, <main> ve footer inert');
  ok(i.overflow === 'hidden', 'açıkken sayfa kaydırması kilitli');

  const seen = new Set();
  for (let n = 0; n < 40; n++) {
    await page.keyboard.press('Tab');
    seen.add((await info()).focus);
  }
  ok(!seen.has('page'), `Tab sayfanın arkasına sızmıyor (odak yerleri: ${[...seen].join(', ')})`);
  ok(seen.has('menu'), 'Tab menü bağlantılarına ulaşıyor');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  i = await info();
  ok(i.expanded === 'false' && !i.open && i.focus === 'burger', `Esc → menü kapandı, odak düğmeye döndü (odak: ${i.focus})`);
  ok(!i.inert.some(Boolean) && i.overflow === '', 'kapanınca inert ve kaydırma kilidi kalktı');

  // açık menüden bir bağlantıya dokun: geçiş + menü kapanır + odak <main>'de
  await page.evaluate(() => {
    window.__alive = 'evet';
  });
  await page.tap('.hdr__burger');
  await page.waitForTimeout(200);
  await page.tap('#mnav a[href="/hakkimizda/"]');
  await waitSwap(page, '/hakkimizda/');
  i = await info();
  ok(i.expanded === 'false' && !i.open && !i.inert.some(Boolean) && i.focus === 'page', `bağlantıya dokununca geçiş yapıldı, menü kapandı, odak sayfada (${i.focus})`);
  ok((await page.evaluate(() => window.__alive)) === 'evet', 'menüden gezinme tam yükleme yapmadı');

  // U-21: efekt anahtarı mobil menünün altında da var; seçim kalıcı, iki anahtar eşzamanlı, menü açık kalır
  await page.tap('.hdr__burger');
  await page.waitForTimeout(200);
  await page.locator('#mnav [data-fx-set="lite"]').tap();
  let s = await page.evaluate(() => ({
    stored: localStorage.getItem('boraden-fx'),
    open: document.getElementById('mnav').classList.contains('is-open'),
    synced: [...document.querySelectorAll('.fxswitch')].every((g) => [...g.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.fxSet).join() === document.documentElement.dataset.fx),
  }));
  ok(s.stored === 'lite' && s.open && s.synced, `menüdeki efekt anahtarı: seçim kaydedildi, menü açık, iki anahtar aynı (${JSON.stringify(s)})`);
  await page.locator('#mnav [data-fx-set="off"]').tap();
  s = await page.evaluate(() => ({ stored: localStorage.getItem('boraden-fx'), fx: document.documentElement.dataset.fx }));
  ok(s.stored === 'off' && s.fx === 'off', 'menüden «Kapalı» seçildi');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // menü açıkken pencere genişleyip masaüstü düzenine geçerse menü kendini kapatır
  await page.tap('.hdr__burger');
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(250);
  i = await info();
  ok(i.expanded === 'false' && !i.inert.some(Boolean) && i.overflow === '', 'pencere masaüstü genişliğine geçince menü kapandı, kilitler kalktı');
  ok(logs.length === 0, 'konsol/ağ temiz' + (logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

/* ─── Bağlantı yok (T-38) ─── */
// Ağ yokken iç bağlantı: sayfada kalınır (tarayıcının hata sayfası yerine), uyarı + «Yeniden dene»; ağ gelince aynı düğme
// sayfayı açar. Ağ dışı hata (sunucu 500) uyarı göstermez, önceki gibi tam sayfa yüklemesine döner.
async function offline() {
  console.log('Bağlantı yok');
  const { ctx, page, logs } = await newPage({ fx: 'lite' });
  await open(page, '/hizmetler/');
  const mark = await page.evaluate(() => (window.__mark = Math.random()));
  const st = () =>
    page.evaluate(() => {
      const n = document.querySelectorAll('#netnote');
      const el = n[0];
      const html = document.documentElement;
      return {
        path: location.pathname,
        mark: window.__mark,
        url: document.getElementById('main').dataset.url,
        n: n.length,
        role: el?.getAttribute('role'),
        text: el?.querySelector('.netnote__t')?.textContent,
        visible: !!el && el.checkVisibility(),
        inView: !!el && (() => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })(),
        busy: html.classList.contains('is-leaving') || html.classList.contains('is-loading') || document.getElementById('main').hasAttribute('aria-busy'),
      };
    });
  await ctx.setOffline(true);
  await clickAnchor(page, '/iletisim/');
  await page.waitForSelector('#netnote', { timeout: 8000 });
  await page.waitForTimeout(450);
  let s = await st();
  ok(s.path === '/hizmetler/' && s.url === '/hizmetler/' && s.mark === mark, 'ağ yok: sayfa yerinde kaldı (adres ve içerik aynı, tam yükleme yok)');
  ok(s.n === 1 && s.role === 'alert' && s.text === 'Bağlantı yok: sayfa açılamadı' && s.visible && s.inView, 'uyarı görünür, ekranda, role="alert"');
  ok(!s.busy, 'çıkış efekti ve yükleme çizgisi geri alındı');
  await page.locator('#netnote .netnote__b').click();
  await page.waitForSelector('#netnote', { timeout: 8000 });
  s = await st();
  ok(s.n === 1 && s.path === '/hizmetler/', 'hâlâ çevrimdışı: «Yeniden dene» uyarıyı yeniden gösterir (tek kopya)');
  await page.locator('#netnote .netnote__x').click();
  ok((await page.locator('#netnote').count()) === 0, '× uyarıyı kapatır');
  await clickAnchor(page, '/iletisim/');
  await page.waitForSelector('#netnote', { timeout: 8000 });
  await ctx.setOffline(false);
  await page.locator('#netnote .netnote__b').click();
  await waitSwap(page, '/iletisim/');
  s = await st();
  ok(s.path === '/iletisim/' && s.mark === mark && s.n === 0, 'ağ gelince «Yeniden dene» sayfayı açar (tam yükleme yok), uyarı kalkar');
  // mobil: dar ekranda uyarı taşmaz
  await page.setViewportSize({ width: 320, height: 640 });
  await ctx.setOffline(true);
  await clickAnchor(page, '/hakkimizda/');
  await page.waitForSelector('#netnote', { timeout: 8000 });
  await page.waitForTimeout(450);
  s = await st();
  const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  ok(s.visible && s.inView && sw, '320 px: uyarı ekranın içinde, yatay kaydırma yok');
  await ctx.setOffline(false);
  await page.setViewportSize({ width: 1440, height: 900 });
  // tarayıcı çevrimiçi görünüyor ama sunucuya ulaşılamıyor (geçiş isteği de yoklama da başarısız): yine sayfada kalınır, uyarı çıkar.
  // (Yalnızca geçiş isteği engellenip yoklama yanıt alırsa tam yüklemeye dönülür: router-regression F03)
  await page.route('**/kariyer/', (r) => r.abort('internetdisconnected'));
  await clickAnchor(page, '/kariyer/');
  await page.waitForSelector('#netnote', { timeout: 8000 });
  s = await st();
  ok(s.path === '/iletisim/' && s.mark === mark && s.n === 1, 'çevrimiçi görünürken sunucuya ulaşılamıyor: sayfa yerinde, uyarı');
  await page.unroute('**/kariyer/');
  // ağ dışı hata: uyarı yok, tam sayfa yüklemesine dönülür
  await page.route('**/hakkimizda/', (r) => r.fulfill({ status: 500, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>500</title><p>sunucu hatası</p>' }));
  await clickAnchor(page, '/hakkimizda/');
  await page.waitForURL('**/hakkimizda/', { timeout: 8000 });
  const after = await page.evaluate(() => ({ path: location.pathname, title: document.title, mark: window.__mark, n: document.querySelectorAll('#netnote').length }));
  ok(after.path === '/hakkimizda/' && after.title === '500' && after.mark === undefined && after.n === 0, 'sunucu hatası: uyarı yok, tam sayfa yüklemesine dönüldü');
  const errs = logs.filter((l) => l.startsWith('[pageerror]'));
  ok(errs.length === 0, 'sayfa hatası yok' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

/* ─── Efekt anahtarı ─── */
async function fx() {
  console.log('Efekt katmanı');
  {
    const { ctx, page } = await newPage({ reduced: true });
    await open(page, '/');
    const t = await page.evaluate(() => document.documentElement.dataset.fx);
    ok(t === 'off', `azaltılmış hareket tercihi → efektler «Kapalı» (data-fx=${t})`);
    await ctx.close();
  }
  const { ctx, page, logs } = await newPage({});
  await open(page, '/');
  const st = () =>
    page.evaluate(() => ({
      tier: document.documentElement.dataset.fx,
      stored: localStorage.getItem('boraden-fx'),
      // altbilgideki anahtar; mobil menüdeki eşi aynı durumu göstermeli
      pressed: [...document.querySelectorAll('.ftr [data-fx-set]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.fxSet),
      synced: [...document.querySelectorAll('.fxswitch')].every((g) => [...g.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.fxSet).join() === document.documentElement.dataset.fx),
      anim: document.documentElement.classList.contains('js-anim'),
    }));
  // ekran kartı olmayan makinede (CI) otomatik seçim «Kapalı» olmalı; gerçek cihazda «Tam» ya da «Hafif». Yazılım çizicide
  // «Kapalı» kararı 3B dünya kurulurken verilir (sayfa yüklenip tarayıcı boşalınca: main.js › bootWorld, world.js › webgl2Ok)
  const soft = await softwareGL(page);
  if (soft) await page.waitForFunction(() => document.documentElement.dataset.fx === 'off', null, { timeout: 8000 }).catch(() => {});
  let x = await st();
  ok((soft ? ['off'] : ['full', 'lite']).includes(x.tier) && x.stored === null && x.pressed.length === 1 && x.synced, `otomatik algılama: ${x.tier}${soft ? ' (yazılım WebGL: ekran kartı yok)' : ''} (kullanıcı seçimi yok, depolama boş)`);
  await page.locator('[data-fx-set="lite"]:visible').click();
  x = await st();
  ok(x.tier === 'lite' && x.stored === 'lite' && JSON.stringify(x.pressed) === '["lite"]' && x.synced, 'Hafif seçildi: data-fx, depolama ve aria-pressed uyumlu (iki anahtar)');
  await page.reload({ waitUntil: 'load' });
  x = await st();
  ok(x.tier === 'lite' && x.stored === 'lite', 'seçim yeniden yüklemede korunuyor');
  await page.locator('[data-fx-set="off"]:visible').click();
  x = await st();
  ok(x.tier === 'off' && !x.anim && x.stored === 'off', 'Kapalı seçildi: animasyon sınıfı kalktı');
  const keys = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookie: document.cookie }));
  ok(JSON.stringify(keys.local) === '["boraden-fx"]' && keys.session.length === 0 && keys.cookie === '' && (await ctx.cookies()).length === 0, 'tek depolama anahtarı boraden-fx; çerez ve sessionStorage yok');
  ok(logs.length === 0, 'konsol/ağ temiz' + (logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

const only = (n) => !ONLY || ONLY === n;
try {
  if (only('router')) await router();
  if (only('keys')) await keys();
  if (only('menu')) await menu();
  if (only('fx')) await fx();
  if (only('offline')) await offline();
} catch (e) {
  console.log('  ✘ beklenmeyen hata: ' + (e && e.message ? e.message.split('\n')[0] : e));
  fails++;
}
await browser.close();
console.log(fails ? `\n✖ ${fails} sorun` : '\n✔ tümü geçti');
process.exit(fails ? 1 : 0);
