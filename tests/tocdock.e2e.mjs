// Yüzen «Bu sayfada» şeridi (behaviors.js › toc, 60-pages.css › .tocdock) — gerçek Chrome. Çalışan bir sunucu gerekir.
//   node tests/tocdock.e2e.mjs [--base=http://127.0.0.1:4181] [--only=/hizmetler/vergi/transfer-fiyatlandirma/]
// Müşteri geri bildirimi (2026-10-18): «Bu sayfada kısmı en alta gelince kaymıyor; müşteri en üste de gitmek isteyecek, yukarı
// çıkıp tekrar basması UI açısından zor». Denetlenenler (masaüstü, tablet, mobil dikey, telefon yan; Hafif ve Kapalı katman):
//   • sayfa başında şerit yok; menüye inildikten sonra sayfanın SONUNA kadar her konumda menü erişilebilir: ya kenar sütunundaki /
//     yapışkan menünün bir bağlantısı ekranda (header'ın altında) ya da yüzen şerit görünür
//   • mobilde yapışkan çip şeridi içerik bitip ayrılırken yüzen şerit tam aynı yerde (boşluk kalmaz)
//   • sayfa sonunda şeridin her bağlantısı bölüme götürür: bölüm başlığı header'ın ve şeridin altında, ekranın üst yarısında; adres #bölüm
//   • «Başa dön» sayfanın en üstüne çıkarır, odak sayfa başlığına gelir, şerit çekilir
//   • bölüm göstergesi (sağ kenar) tıklaması da bölümü şeridin altına getirir
//   • şerit yatay taşma yaratmaz; mobil menü açıkken erişilemez (inert); sayfa geçişinde tek şerit kalır (eskisi silinir)
//   • konsol/HTTP temiz
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ONLY = arg('only', '');
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const PAGES = [
  '/hizmetler/vergi/transfer-fiyatlandirma/', // müşterinin örneği (6 bölüm)
  '/hizmetler/tesvik/istihdam-tesvik/', // 9 bölüm
  '/sektorler/uretim-ve-sanayi/',
  '/hesaplayicilar/asgari-ucret-hesaplama/',
  '/hakkimizda/',
  '/bilgi-merkezi/okuma-notlari/amartya-sen-insan-ve-olcum/',
  '/yasal/kvkk-aydinlatma-metni/', // 13 bölüm, «İçindekiler» kutusu
].filter((u) => !ONLY || u === ONLY);
const VIEWS = [
  { name: 'masaüstü 1440×900', w: 1440, h: 900, fx: 'lite' },
  { name: 'masaüstü 1280×720', w: 1280, h: 720, fx: 'off' },
  { name: 'tablet 1024×768', w: 1024, h: 768, fx: 'lite', touch: true },
  { name: 'mobil 390×844', w: 390, h: 844, fx: 'lite', mobile: true },
  { name: 'telefon yan 844×390', w: 844, h: 390, fx: 'lite', mobile: true },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function settle(page, ms = 3500) {
  // yumuşak kaydırma bitene kadar (konum 300 ms değişmeyince)
  const t0 = Date.now();
  let last = -1;
  let still = 0;
  while (Date.now() - t0 < ms) {
    const y = await page.evaluate(() => scrollY);
    still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
    last = y;
    if (still >= 6) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(120);
}
// o anki durum: şerit, menü bağlantıları, header
const state = (page) =>
  page.evaluate(() => {
    const hdr = document.getElementById('hdr');
    const hr = hdr.getBoundingClientRect();
    const hdrBottom = document.documentElement.classList.contains('hdr-hidden') ? 0 : Math.max(0, hr.bottom);
    const dock = document.querySelector('.tocdock');
    const dr = dock ? dock.getBoundingClientRect() : null;
    const dockOn = !!dock && dock.classList.contains('is-on') && getComputedStyle(dock).visibility !== 'hidden';
    const toc = document.querySelector('main [data-toc]');
    const links = toc ? [...toc.querySelectorAll('a[href^="#"]')] : [];
    // ekranda tam görünen (header'ın altında, alt kenarın üstünde) menü bağlantısı sayısı; yapışkan şerit için şeridin kendi görünür alanı
    const strip = toc && toc.querySelector('ol');
    const sr = strip ? strip.getBoundingClientRect() : null;
    const visLinks = links.filter((a) => {
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const inStrip = !sr || (r.right > sr.left + 4 && r.left < sr.right - 4);
      return r.top >= hdrBottom - 1 && r.bottom <= innerHeight + 1 && inStrip && getComputedStyle(a).visibility !== 'hidden';
    }).length;
    const side = toc && (toc.closest('.svc__side, .ab-doc__side') || toc);
    const sideR = side ? side.getBoundingClientRect() : null;
    return {
      y: Math.round(scrollY),
      max: document.documentElement.scrollHeight - innerHeight,
      vh: innerHeight,
      vw: innerWidth,
      sw: document.documentElement.scrollWidth,
      hdrBottom,
      dockN: document.querySelectorAll('.tocdock').length,
      dockOn,
      dock: dr && { top: Math.round(dr.top), bottom: Math.round(dr.bottom), h: Math.round(dr.height) },
      dockLinks: dock ? [...dock.querySelectorAll('.tocdock__list a')].map((a) => a.getAttribute('href')) : [],
      tocLinks: links.map((a) => a.getAttribute('href')),
      visLinks,
      tocTop: links.length ? Math.round(links[0].getBoundingClientRect().top) : null,
      side: sideR && { top: Math.round(sideR.top), bottom: Math.round(sideR.bottom), pos: getComputedStyle(side).position },
      stripMode: !!strip && getComputedStyle(strip).overflowX === 'auto',
      inert: !!dock && dock.hasAttribute('inert'),
      active: dock ? dock.querySelector('.tocdock__list a.is-on')?.getAttribute('href') || null : null,
      activeVisible: (() => {
        const a = dock && dock.querySelector('.tocdock__list a.is-on');
        if (!a) return false;
        const l = dock.querySelector('.tocdock__list').getBoundingClientRect();
        const r = a.getBoundingClientRect();
        return r.left >= l.left - 1 && r.right <= l.right + 1;
      })(),
    };
  });

for (const V of VIEWS) {
  console.log(`\n${V.name} · ${V.fx}`);
  const ctx = await guardContext(
    await browser.newContext({ viewport: { width: V.w, height: V.h }, isMobile: !!V.mobile, hasTouch: !!(V.mobile || V.touch), reducedMotion: 'no-preference' })
  );
  await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), V.fx);
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !driverNoise(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && !/\.mp4$/.test(r.url()) && logs.push(`[http ${r.status()}] ${r.url()}`));

  for (const url of PAGES) {
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const s0 = await state(page);
    ok(s0.dockN === 1 && !s0.dockOn, `${url}: sayfa başında şerit gizli (${s0.dockN} şerit)`);
    ok(JSON.stringify(s0.dockLinks) === JSON.stringify(s0.tocLinks), `şeritte menüdeki ${s0.tocLinks.length} bağlantı, aynı sırada`);

    // baştan sona tarama: menüye inildikten sonra her konumda menü ya da şerit erişilebilir
    const step = Math.max(80, Math.round(V.h / 4));
    let seen = false;
    const gaps = [];
    let firstDock = null;
    let overflow = 0;
    for (let y = 0; y <= s0.max + step; y += step) {
      await page.evaluate((yy) => scrollTo(0, yy), Math.min(y, s0.max));
      await page.waitForTimeout(V.fx === 'off' ? 70 : 140);
      const s = await state(page);
      if (s.sw > s.vw + 1) overflow++;
      if (!seen && s.visLinks > 0) seen = true;
      if (!seen) continue;
      if (s.dockOn && firstDock === null) firstDock = s.y;
      if (!(s.dockOn || s.visLinks > 0)) gaps.push(s.y);
      if (y >= s0.max) break;
    }
    ok(seen, `menü ekrana geliyor`);
    ok(gaps.length === 0, `menüye inildikten sonra sayfa sonuna kadar her konumda menü ya da şerit erişilebilir${gaps.length ? ` — erişilemeyen konumlar: ${gaps.slice(0, 6).join(', ')}` : ''} (şerit ilk ${firstDock} px'te)`);
    ok(overflow === 0, `şerit yatay taşma yaratmaz`);

    // sayfa sonu: şerit görünür, aktif bağlantı şeritte görünür
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    const sEnd = await state(page);
    ok(sEnd.dockOn && sEnd.dock && Math.abs(sEnd.dock.top - sEnd.hdrBottom) <= 1, `sayfa sonunda şerit görünür, header'ın hemen altında (üst ${sEnd.dock && sEnd.dock.top} px, header alt ${sEnd.hdrBottom} px)`);
    ok(!!sEnd.active && sEnd.activeVisible, `sayfa sonunda aktif bağlantı «${sEnd.active}» şeritte görünür`);

    // mobil yapışkan şeritten yüzen şeride geçiş: aynı yer, aynı yükseklik, boşluk yok
    if (sEnd.stripMode) {
      const t = await page.evaluate(() => {
        const side = document.querySelector('main [data-toc]').closest('.svc__side');
        const grid = side.parentElement;
        return { gridEnd: grid.getBoundingClientRect().bottom + scrollY, h: side.offsetHeight };
      });
      const bad = [];
      for (let d = -40; d <= 140; d += 10) {
        // ızgaranın sonu ekranın üstüne (header + şerit) yaklaşırken, ayrılırken ve ayrıldıktan sonra
        await page.evaluate((yy) => scrollTo(0, yy), Math.round(t.gridEnd - (sEnd.hdrBottom ? 72 : 0) - t.h - d));
        await page.waitForTimeout(90);
        const r = await page.evaluate(() => {
          const top = document.documentElement.classList.contains('hdr-hidden') ? 0 : Math.max(0, document.getElementById('hdr').getBoundingClientRect().bottom);
          const side = document.querySelector('main [data-toc]').closest('.svc__side').getBoundingClientRect();
          const dock = document.querySelector('.tocdock');
          const dr = dock.getBoundingClientRect();
          const dockOn = dock.classList.contains('is-on');
          // üst bandın (header altından 45 px) kapsanması: yerindeki şerit ya da yüzen şerit
          const covers = (r) => r.top <= top + 1 && r.bottom >= top + 45;
          return { top, inflow: covers(side), dock: dockOn && covers(dr) };
        });
        if (!(r.inflow || r.dock)) bad.push(d);
      }
      ok(bad.length === 0, `mobil: yapışkan şerit ayrılırken yüzen şerit aynı yerde, arada boşluk yok${bad.length ? ` (boşluk: ${bad.join(', ')})` : ''}`);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
    }

    // şeritteki her bağlantı: bölüm başlığı örtülmeden ekranın üst yarısında
    const covered = [];
    for (const href of sEnd.dockLinks) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      const st = await state(page);
      if (!st.dockOn) {
        covered.push(`${href}: şerit görünmüyor`);
        continue;
      }
      await page.locator(`.tocdock .tocdock__list a[href="${href}"]`).click();
      await settle(page);
      const r = await page.evaluate((h) => {
        const el = document.querySelector(h);
        const cs = getComputedStyle(el);
        const top = el.getBoundingClientRect().top + (parseFloat(cs.paddingTop) || 0);
        const hdrB = document.documentElement.classList.contains('hdr-hidden') ? 0 : Math.max(0, document.getElementById('hdr').getBoundingClientRect().bottom);
        const dock = document.querySelector('.tocdock');
        const dockB = dock.classList.contains('is-on') ? dock.getBoundingClientRect().bottom : 0;
        // yapışkan mobil çip şeridi de bölümün üstünü örtebilir (masaüstündeki kenar sütunu sol sütundadır, başlığı örtmez)
        const toc = document.querySelector('main [data-toc]');
        const strip = toc && toc.querySelector('ol');
        const side = el.closest('.svc') && strip && getComputedStyle(strip).overflowX === 'auto' ? toc.closest('.svc__side') : null;
        const sideB = side && side.getBoundingClientRect().top <= hdrB + 1 ? side.getBoundingClientRect().bottom : 0;
        return { top: Math.round(top), cover: Math.round(Math.max(hdrB, dockB, sideB)), vh: innerHeight, hash: location.hash, max: document.documentElement.scrollHeight - innerHeight, y: scrollY };
      }, href);
      const atEnd = r.y >= r.max - 2; // son bölümler sayfanın sonuna sığmayabilir: en alta kayar
      if (r.top < r.cover - 1 || (!atEnd && r.top > r.vh * 0.6) || r.hash !== href) covered.push(`${href}: başlık ${r.top} px, örten ${r.cover} px, adres ${r.hash}`);
    }
    ok(covered.length === 0, `şeritteki ${sEnd.dockLinks.length} bağlantı bölüme götürür, başlık örtülmez${covered.length ? ' — ' + covered.slice(0, 3).join(' | ') : ''}`);

    // «Başa dön»
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    await page.locator('.tocdock .tocdock__top').click();
    await settle(page, 5000);
    const top = await page.evaluate(() => ({ y: scrollY, focus: document.activeElement?.tagName, on: document.querySelector('.tocdock').classList.contains('is-on'), hash: location.hash }));
    ok(top.y === 0 && top.focus === 'H1' && !top.on && !top.hash, `«Başa dön»: sayfanın en üstü (y=${top.y}), odak ${top.focus}, şerit çekildi, adreste # yok`);
  }

  // bölüm göstergesi (yalnızca geniş ekranda): tıklanan bölüm şeridin altında
  // (gösterge yalnızca ≥ 1200 px'te ve «Kapalı» dışındaki katmanlarda kurulur — behaviors.js › hud)
  if (V.w >= 1200 && V.fx !== 'off' && (!ONLY || ONLY === PAGES[0])) {
    await page.goto(BASE + PAGES[0], { waitUntil: 'load' });
    await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    const hrefs = await page.$$eval('.hud a', (as) => as.map((a) => a.getAttribute('href')));
    const bad = [];
    for (const h of hrefs.slice(0, -1)) {
      // gösterge alt bilgiye yaklaşınca çekilir: son bölümün (ilgili ekip) başına in — şerit görünür, gösterge de
      await page.evaluate((last) => scrollTo(0, document.querySelector(last).getBoundingClientRect().top + scrollY - 40), hrefs[hrefs.length - 1]);
      await page.waitForTimeout(400);
      await page.locator(`.hud a[href="${h}"]`).hover({ force: true });
      await page.locator(`.hud a[href="${h}"]`).click();
      await settle(page);
      const r = await page.evaluate((hh) => {
        const el = document.querySelector(hh);
        const top = el.getBoundingClientRect().top + (parseFloat(getComputedStyle(el).paddingTop) || 0);
        const hdrB = document.documentElement.classList.contains('hdr-hidden') ? 0 : Math.max(0, document.getElementById('hdr').getBoundingClientRect().bottom);
        const dock = document.querySelector('.tocdock');
        const dockB = dock.classList.contains('is-on') ? dock.getBoundingClientRect().bottom : 0;
        return { top: Math.round(top), cover: Math.round(Math.max(hdrB, dockB)) };
      }, h);
      if (r.top < r.cover - 1) bad.push(`${h}: ${r.top} < ${r.cover}`);
    }
    ok(hrefs.length >= 4 && bad.length === 0, `bölüm göstergesi (${hrefs.length} nokta): tıklanan bölüm header ve şeridin altında${bad.length ? ' — ' + bad.join(' | ') : ''}`);
  }

  // mobil menü açıkken şerit erişilemez; sayfa geçişinde tek şerit
  if (V.mobile && V.h > V.w && !ONLY) {
    await page.goto(BASE + PAGES[0], { waitUntil: 'load' });
    await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => scrollBy(0, -260)); // yukarı kaydırınca header (menü düğmesi) geri gelir
    await page.waitForTimeout(700);
    await page.locator('.hdr__burger').click();
    await page.waitForTimeout(700);
    const m1 = await state(page);
    await page.locator('.hdr__burger').click();
    await page.waitForTimeout(700);
    const m2 = await state(page);
    ok(m1.inert && !m2.inert, `mobil menü açıkken şerit erişilemez (inert), kapanınca geri gelir`);
  }
  if (!V.mobile && V.w === 1440 && !ONLY) {
    await page.goto(BASE + PAGES[0], { waitUntil: 'load' });
    await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
    await page.evaluate(() => (window.__navMark = 1));
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight - innerHeight * 1.6));
    await page.waitForTimeout(400);
    const next = page.locator('a.svcnav__a--next');
    const nextHref = await next.getAttribute('href');
    await next.click();
    await page.waitForFunction((u) => document.getElementById('main').dataset.url === u, nextHref, { timeout: 9000 });
    await page.waitForTimeout(900);
    const n = await page.evaluate(() => ({ mark: window.__navMark, docks: document.querySelectorAll('.tocdock').length, links: [...document.querySelectorAll('.tocdock .tocdock__list a')].map((a) => a.getAttribute('href')), toc: [...document.querySelectorAll('main [data-toc] a[href^="#"]')].map((a) => a.getAttribute('href')) }));
    ok(n.mark === 1 && n.docks === 1 && JSON.stringify(n.links) === JSON.stringify(n.toc), `sayfa geçişi (${nextHref}): tek şerit, bağlantıları yeni sayfanın menüsüyle aynı`);
  }

  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
