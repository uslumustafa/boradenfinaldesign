// Hizmet / hizmet alanı / hizmetler dizini / sektör sayfaları — tarayıcı denetimi (gerçek Chrome, Playwright).
// Çalışan bir sunucu gerekir (npm run dev ya da BORADEN_DIST=… PORT=… node scripts/serve.mjs).
//   node tests/services.e2e.mjs [--base=http://127.0.0.1:4181] [--only=tick|tiers|layout|hud|router|mobile]
// Denetlenenler:
//   tick   — denetçi tiki: bölüm başlıklarında maske görseli var; görünene kadar çizilmez, görününce çizilir; süreç adımı tikleri kaydırdıkça dolar
//   tiers  — Tam / Hafif / Kapalı ve azaltılmış hareket: kaydırma sonunda hiçbir [data-reveal] gizli kalmaz; Kapalı'da hemen görünür
//   layout — 390/768/1100/1440 px'te yatay taşma yok; kapsam kartları geniş ekranda tek sırada, dar ekranda alt alta; alan/dizin kartları
//   hud    — alan sayfalarında elle işaretli bölüm noktaları (≥4); hizmet sayfasında menüden türeyen sessiz gösterge
//   router — dizin → alan → hizmet gezinmesi tam yenileme olmadan; künye ve tik yeniden kurulur; konsol/HTTP temiz
//   mobile — 390 px: «Bu sayfada» yapışkan çip şeridi (aktif çip ortalanır, çipe dokununca bölüm şeridin altında kalır); ekip/hizmet/künye bağlantıları ≥ 24 px
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
import { loadData } from '../scripts/build.mjs';
import { buildModel } from '../scripts/model.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ONLY = arg('only', '');
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) fails++;
};

const model = buildModel(loadData());
const RICH = '/hizmetler/vergi/kdv-iade-islemleri/'; // SSS + kaynak + ilgili içerik, 3 kapsam maddesi
const STEPS = '/hizmetler/kurumsal-finansman/sirket-degerlemesi/'; // 4 kapsam maddesi + 4 süreç adımı
const bare = model.services.find((s) => !s.related.total && !s.srcList.length && !(s.steps || []).length); // en sade hizmet
const AREA = '/hizmetler/vergi/';
const SECTOR_ODD = '/sektorler/finansal-hizmetler/'; // 7 hizmet (tek sayı)

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function newPage({ w = 1440, h = 900, mobile = false, fx = 'full', reduced = false } = {}) {
  // guardContext: mailto:/tel: gezinmeleri işletim sistemine gitmesin (bkz. safe-context.mjs)
  const ctx = await guardContext(
    await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' }),
  );
  if (fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), fx); // fx=null: kayıtlı tercih yok (hareket azaltma kendiliğinden «Kapalı» yapar)
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && logs.push(`[http ${r.status()}] ${r.url()}`));
  page.on('requestfailed', (r) => !/ERR_ABORTED/.test(r.failure()?.errorText || '') && logs.push(`[failed] ${r.url()}`));
  return { ctx, page, logs };
}
async function open(page, url) {
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 8000 });
  await page.waitForTimeout(500);
}
// sayfayı sonuna kadar adım adım kaydır (IntersectionObserver ve kaydırma tabanlı davranışlar gerçekçi tetiklensin)
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 500));
  });
}
async function scrollToEl(page, sel, frac = 0.25) {
  await page.evaluate(
    ([s, f]) => {
      const el = document.querySelector(s);
      scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * f);
    },
    [sel, frac],
  );
}
const tickState = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    const cs = getComputedStyle(el, '::before');
    return {
      isIn: el.classList.contains('is-in'),
      mask: (cs.webkitMaskImage || cs.maskImage || '').slice(0, 24),
      clip: cs.clipPath,
      w: cs.width,
    };
  }, sel);
const hidden = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-reveal]')]
      .filter((e) => !e.classList.contains('is-in') || +getComputedStyle(e).opacity < 0.99)
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`)
      .slice(0, 6),
  );
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ─── Denetçi tiki ─── */
async function tick() {
  console.log('Denetçi tiki (1440×900, Tam)');
  const { ctx, page, logs } = await newPage();
  await open(page, RICH);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.svc__label')].map((e) => e.hasAttribute('data-reveal')));
  ok(labels.length >= 5 && labels.every(Boolean), `her bölüm başlığı animasyona bağlı (${labels.length} başlık)`);
  const first = await tickState(page, '#kisaca .svc__label');
  ok(/svg/.test(first.mask) && parseFloat(first.w) > 10, `başlık tiki: maske görseli var (${first.mask}…, genişlik ${first.w})`);
  // sayfanın aşağısındaki başlık: görünene kadar çizilmez
  const before = await tickState(page, '#sss .svc__label');
  ok(!before.isIn && /100%/.test(before.clip), `ekran dışındaki başlıkta tik henüz çizilmez (${before.clip})`);
  await scrollToEl(page, '#sss .svc__label', 0.4);
  await page.waitForTimeout(1900);
  const after = await tickState(page, '#sss .svc__label');
  ok(after.isIn && !/100%/.test(after.clip), `görününce tik çizilir (${after.clip})`);
  // renk döngüsü: mavi → kırmızı → yeşil (3n+2 / 3n)
  const colors = await page.evaluate(() => [...document.querySelectorAll('.svc__sec .svc__label')].slice(0, 3).map((e) => getComputedStyle(e, '::before').backgroundColor));
  ok(new Set(colors).size === 3, `ilk üç başlıkta üç farklı vurgu rengi (${colors.join(' | ')})`);
  // künye: Ref. + en az 3 hücre; tik maskesi
  const k = await page.evaluate(() => {
    const d = document.querySelector('dl.kunye');
    return { cells: d.children.length, ref: d.querySelector('.kunye__ref dd')?.textContent, mask: (getComputedStyle(d.querySelector('.kunye__ref dd'), '::before').webkitMaskImage || '').slice(0, 20) };
  });
  ok(k.cells >= 3 && /^\d{2}\.\d{2}$/.test(k.ref) && /svg/.test(k.mask), `künye: ${k.cells} hücre, Ref. ${k.ref}, tik maskesi var`);
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();

  // süreç adımı tikleri kaydırdıkça dolar (progress-driven)
  const c2 = await newPage();
  await open(c2.page, STEPS);
  const p0 = await c2.page.evaluate(() => +document.querySelector('.flow').style.getPropertyValue('--p') || 0);
  await scrollToEl(c2.page, '.flow', 0.2);
  await c2.page.waitForTimeout(1300);
  const flow = await c2.page.evaluate(() => {
    const f = document.querySelector('.flow');
    return {
      p: +f.style.getPropertyValue('--p'),
      n: f.querySelectorAll('.flow__i').length,
      clips: [...f.querySelectorAll('.flow__n')].map((n) => getComputedStyle(n, '::after').clipPath),
    };
  });
  ok(flow.n === 4 && flow.p > p0 && flow.p >= 0.95, `süreç ilerlemesi kaydırınca 0 → ${flow.p.toFixed(2)} (${flow.n} adım)`);
  ok(flow.clips.every((c) => !/100%/.test(c)), `ilerleme dolunca dört adımın tiki de çizili (${flow.clips.join(' ; ')})`);
  await c2.ctx.close();
}

/* ─── Efekt kademeleri ─── */
async function tiers() {
  console.log('Efekt kademeleri: kaydırma sonunda hiçbir bölüm gizli kalmaz');
  const pages = [RICH, STEPS, AREA, '/hizmetler/', SECTOR_ODD];
  for (const [fx, reduced, label] of [['full', false, 'Tam'], ['lite', false, 'Hafif'], ['off', false, 'Kapalı'], [null, true, 'azaltılmış hareket']]) {
    const { ctx, page, logs } = await newPage({ fx, reduced });
    for (const url of pages) {
      await open(page, url);
      if (fx === 'off' || reduced) {
        const h0 = await hidden(page); // Kapalı: kaydırmadan hemen görünür
        ok(h0.length === 0, `${label}: ${url} açılır açılmaz tüm içerik görünür${h0.length ? ' — gizli: ' + h0.join(', ') : ''}`);
      }
      await scrollThrough(page);
      await page.waitForTimeout(1300);
      const h = await hidden(page);
      ok(h.length === 0, `${label}: ${url} sonuna kadar kaydırınca gizli içerik kalmaz${h.length ? ' — gizli: ' + h.join(', ') : ''}`);
    }
    if (fx === 'off') {
      await open(page, STEPS);
      const f = await page.evaluate(() => ({ p: document.querySelector('.flow').style.getPropertyValue('--p'), clip: getComputedStyle(document.querySelector('.flow__i:last-child .flow__n'), '::after').clipPath }));
      ok(f.p === '1' && !/100%/.test(f.clip), `Kapalı: süreç tikleri baştan dolu (--p ${f.p})`);
    }
    ok(logs.length === 0, `${label}: konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
    await ctx.close();
  }
}

/* ─── Yerleşim ─── */
async function layout() {
  console.log('Yerleşim: yatay taşma ve ızgara sütunları');
  const pages = [RICH, STEPS, AREA, '/hizmetler/akademi/', '/hizmetler/', SECTOR_ODD];
  if (bare) pages.push(bare.url);
  for (const w of [390, 768, 1100, 1440]) {
    const mobile = w < 800;
    const { ctx, page, logs } = await newPage({ w, h: mobile ? 844 : 900, mobile, fx: w < 800 ? 'lite' : 'full' });
    const bad = [];
    for (const url of pages) {
      await open(page, url);
      await scrollThrough(page);
      const dx = await overflowX(page);
      if (dx > 0) bad.push(`${url} (+${dx}px)`);
    }
    ok(bad.length === 0, `${w} px: yatay taşma yok (${pages.length} sayfa)${bad.length ? ' — taşan: ' + bad.join(', ') : ''}`);
    ok(logs.length === 0, `${w} px: konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  }
  // kapsam kartları: geniş ekranda tek sırada, dar ekranda alt alta
  for (const [w, mobile, wantRow] of [[1440, false, true], [390, true, false]]) {
    const { ctx, page } = await newPage({ w, h: mobile ? 844 : 900, mobile, fx: 'off' });
    await open(page, RICH);
    const tops = await page.evaluate(() => [...document.querySelectorAll('.sgrid .sc')].map((e) => Math.round(e.getBoundingClientRect().top + scrollY)));
    ok(tops.length === 3 && (new Set(tops).size === 1) === wantRow, `${w} px: 3 kapsam kartı ${wantRow ? 'tek sırada' : 'alt alta'} (${tops.join(', ')})`);
    if (w === 1440) {
      await open(page, STEPS);
      const t4 = await page.evaluate(() => [...document.querySelectorAll('.sgrid .sc')].map((e) => Math.round(e.getBoundingClientRect().top + scrollY)));
      ok(t4.length === 4 && new Set(t4).size === 2, `1440 px: 4 kapsam kartı 2×2 (${t4.join(', ')})`);
      await open(page, '/hizmetler/');
      const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.agrid')).gridTemplateColumns.split(' ').length);
      ok(cols === 3, `1440 px: dizinde alan kartları 3 sütun (${cols})`);
      await open(page, SECTOR_ODD);
      const last = await page.evaluate(() => {
        const li = [...document.querySelectorAll('.sx-svcs > li')];
        const a = li[li.length - 1].getBoundingClientRect();
        const ul = document.querySelector('.sx-svcs').getBoundingClientRect();
        return { n: li.length, full: Math.abs(a.width - ul.width) < 2 };
      });
      ok(last.n % 2 === 1 && last.full, `1440 px: sektörde ${last.n} hizmet kartı (tek sayı) → sonuncusu tam genişlikte, boş hücre yok`);
    } else {
      await open(page, '/hizmetler/');
      const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.agrid')).gridTemplateColumns.split(' ').length);
      ok(cols === 1, `390 px: dizinde alan kartları tek sütun (${cols})`);
      await open(page, AREA);
      const c2 = await page.evaluate(() => getComputedStyle(document.querySelector('.acards')).gridTemplateColumns.split(' ').length);
      ok(c2 === 1, `390 px: alan sayfasında hizmet kartları tek sütun (${c2})`);
    }
    await ctx.close();
  }
  // fotoğraf bandı gerçekten yüklenir (tembel yükleme: kaydırınca)
  {
    const { ctx, page } = await newPage({ fx: 'lite' });
    for (const url of [RICH, AREA, '/hizmetler/']) {
      await open(page, url);
      await scrollThrough(page);
      await page.waitForTimeout(600);
      const imgs = await page.evaluate(() => [...document.querySelectorAll('.sfig img, .agc img')].map((i) => ({ ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt') })));
      ok(imgs.length >= 1 && imgs.every((i) => i.ok && i.alt === ''), `${url}: ${imgs.length} arşiv fotoğrafı yüklendi (süs görseli, alt boş)`);
    }
    await ctx.close();
  }
}

/* ─── Bölüm göstergesi (HUD) ─── */
async function hud() {
  console.log('Bölüm göstergesi');
  const { ctx, page } = await newPage();
  const read = () =>
    page.evaluate(() => {
      const n = document.querySelector('nav.hud');
      if (!n) return { n: 0 };
      return {
        n: document.querySelectorAll('nav.hud').length,
        count: n.querySelectorAll('a').length,
        quiet: n.hasAttribute('data-quiet'),
        shown: getComputedStyle(n).display !== 'none',
        chap: [...document.querySelectorAll('main [data-chapter]')].filter((e) => e.id).length,
        labels: [...n.querySelectorAll('.hud__label')].map((e) => e.textContent),
      };
    });
  for (const g of model.groups) {
    await open(page, g.url);
    const h = await read();
    ok(h.n === 1 && h.count >= 4 && h.count === h.chap && !h.quiet && h.shown, `${g.url}: ${h.chap} işaretli bölüm → ${h.count} nokta (${h.labels.join(' · ')})`);
  }
  await open(page, RICH);
  const r = await read();
  ok(r.n === 1 && r.quiet && r.shown && r.count >= 6, `${RICH}: menüden türeyen sessiz gösterge (${r.count} nokta)`);
  await ctx.close();
  const m = await newPage({ w: 390, h: 844, mobile: true });
  await open(m.page, AREA);
  const mh = await m.page.evaluate(() => { const n = document.querySelector('nav.hud'); return !n || getComputedStyle(n).display === 'none'; });
  ok(mh, '390 px: gösterge görünmez');
  await m.ctx.close();
}

/* ─── Router ─── */
async function router() {
  console.log('Gezinme (router): dizin → alan → hizmet');
  const { ctx, page, logs } = await newPage();
  await open(page, '/hizmetler/');
  const marker = await page.evaluate(() => (window.__navMark = 'ayni-sayfa'));
  await page.locator(`a.agc[href="${AREA}"]`).first().click();
  await page.waitForFunction((p) => document.getElementById('main').dataset.url === p, AREA, { timeout: 9000 });
  await page.waitForTimeout(1200);
  let s = await page.evaluate(() => ({ mark: window.__navMark, kunye: !!document.querySelector('dl.kunye'), cards: document.querySelectorAll('.acard').length, h1: document.querySelectorAll('h1').length }));
  const g = model.groups.find((x) => x.url === AREA);
  ok(s.mark === marker && s.kunye && s.cards === g.services.length && s.h1 === 1, `dizin → alan: tam yenileme yok, künye + ${s.cards} hizmet kartı`);
  // hizmet kartı → hizmet sayfası
  const first = g.services[0];
  await page.locator(`a.acard[href="${first.url}"]`).first().click();
  await page.waitForFunction((p) => document.getElementById('main').dataset.url === p, first.url, { timeout: 9000 });
  await page.waitForTimeout(1200);
  s = await page.evaluate(() => ({ mark: window.__navMark, ref: document.querySelector('.kunye__ref dd')?.textContent, labels: document.querySelectorAll('.svc__label[data-reveal]').length, sc: document.querySelectorAll('.sc').length }));
  ok(s.mark === marker && s.ref === first.ref && s.labels >= 4 && s.sc === first.scopeItems.length, `alan → hizmet: künye Ref. ${s.ref}, ${s.labels} başlık, ${s.sc} kapsam kartı`);
  // yeni sayfada tik yeniden kurulur (router sonrası da çizilir)
  await scrollToEl(page, '#cikti .svc__label', 0.4);
  await page.waitForTimeout(1900);
  const t = await tickState(page, '#cikti .svc__label');
  ok(t.isIn && !/100%/.test(t.clip), `router sonrası da görününce tik çizilir (${t.clip})`);
  // ilgili içerik bağlantısı (sektör çipi) → sektör sayfası; geri → hizmet
  const chip = page.locator('#ilgili .rel__row--sector a.chip').first();
  if (await chip.count()) {
    const href = await chip.getAttribute('href');
    await chip.click();
    await page.waitForFunction((p) => document.getElementById('main').dataset.url === p, href, { timeout: 9000 });
    await page.waitForTimeout(900);
    ok((await page.evaluate(() => document.querySelectorAll('h1').length)) === 1 && (await page.evaluate(() => window.__navMark)) === marker, `ilgili sektör çipi (${href}) router ile açılır`);
    await page.goBack();
    await page.waitForFunction((p) => document.getElementById('main').dataset.url === p, first.url, { timeout: 9000 });
    await page.waitForTimeout(900);
    ok((await page.evaluate(() => !!document.querySelector('dl.kunye'))), 'geri dönünce hizmet sayfası yeniden kurulur (künye var)');
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

/* ─── Mobil: «Bu sayfada» şeridi + dokunma hedefleri ─── */
async function mobile() {
  console.log('Mobil (390×844, Hafif): «Bu sayfada» şeridi ve dokunma hedefleri');
  const { ctx, page, logs } = await newPage({ w: 390, h: 844, mobile: true, fx: 'lite' });
  const SIDE = '.svc > .svc__side:not(.lg-side)';
  const strip = () =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const ol = el.querySelector('.toc ol');
      if (!ol) return { none: true, links: 0, pos: getComputedStyle(el).position }; // kişi sayfası: kenar sütunu künye kartı, içindekiler yok
      const r = el.getBoundingClientRect();
      const on = ol.querySelector('a.is-on');
      const or = on && on.getBoundingClientRect();
      const sr = ol.getBoundingClientRect();
      return {
        pos: getComputedStyle(el).position,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        h: Math.round(r.height),
        links: ol.querySelectorAll('a').length,
        ovf: getComputedStyle(ol).overflowX,
        scrollable: ol.scrollWidth > ol.clientWidth + 2,
        left: Math.round(ol.scrollLeft),
        on: on ? on.getAttribute('href') : null,
        inView: !!on && or.left >= sr.left - 1 && or.right <= sr.right + 1,
        hdr: document.documentElement.classList.contains('hdr-hidden'),
      };
    }, SIDE);

  await open(page, RICH);
  const a = await strip();
  ok(a && a.links >= 6 && a.pos === 'sticky' && a.ovf === 'auto' && a.scrollable && a.h >= 50 && a.h <= 66, `${RICH}: «Bu sayfada» yatay kayan, yapışkan şerit (${a && a.links} çip, yükseklik ${a && a.h} px)`);
  const hrefs = await page.$$eval(`${SIDE} .toc ol a`, (as) => as.map((x) => x.getAttribute('href')));

  // ortada bir bölüme kaydır: şerit ekranın üstünde yapışık kalır, aktif çip görünür alandadır
  await scrollToEl(page, '#sss .svc__label', 0.3);
  await page.waitForTimeout(1300);
  const mid = await strip();
  const wantTop = mid.hdr ? 0 : 72;
  ok(Math.abs(mid.top - wantTop) <= 1, `kaydırınca şerit ekranın üstünde yapışık (üst = ${mid.top} px, header ${mid.hdr ? 'gizli → 0' : 'görünür → 72'})`);
  ok(mid.on === '#sss' && mid.inView, `aktif çip «${mid.on}» şerit içinde görünür`);

  // son bölüme: şerit kaydırılmış, son çip aktif ve görünür
  const last = hrefs[hrefs.length - 1];
  await scrollToEl(page, last, 0.12);
  await page.waitForTimeout(1500);
  const end = await strip();
  ok(end.left > 0 && end.inView && end.on === last, `son bölümde şerit yana kayar ve «${last}» çipi ortalanır/görünür (kaydırma ${end.left} px, aktif ${end.on})`);

  // çipe dokununca bölüm şeridin altında kalır (scroll-margin) ve sayfa yatayda taşmaz
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.locator(`${SIDE} .toc ol a[href="#sss"]`).click();
  await page.waitForTimeout(1800);
  const jump = await page.evaluate((sel) => ({ s: document.querySelector('#sss').getBoundingClientRect().top, b: document.querySelector(sel).getBoundingClientRect().bottom }), SIDE);
  ok(jump.s >= jump.b - 1 && jump.s - jump.b < 140, `çipe dokununca «SSS» bölümü şeridin hemen altında (bölüm ${Math.round(jump.s)} px, şerit alt ${Math.round(jump.b)} px)`);
  ok((await overflowX(page)) === 0, 'şerit sayfada yatay taşma yaratmaz');

  // şerit yalnızca ≥ 4 bölümlü sayfalarda; hukuki metin kendi «İçindekiler» kutusunu korur
  const person = model.team.members[0].url;
  await open(page, person);
  const p = await strip();
  ok(p && p.none && p.pos !== 'sticky', `${person}: kenar sütunu künye kartıdır, şeride dönüşmez (${p && p.pos})`);
  const CALC = '/hesaplayicilar/kdv-hesaplama/';
  await open(page, CALC);
  const c = await strip();
  ok(!c || (c.links >= 4) === (c.pos === 'sticky'), `${CALC}: şerit yalnızca ≥ 4 bölümde (${c ? c.links + ' bölüm → ' + c.pos : 'içindekiler yok'})`);
  await open(page, '/yasal/gizlilik-politikasi/');
  const lg = await page.evaluate(() => {
    const side = document.querySelector('.svc > .svc__side.lg-side');
    const ol = side && side.querySelector('ol');
    return side ? { pos: getComputedStyle(side).position, ovf: ol ? getComputedStyle(ol).overflowX : 'yok' } : null;
  });
  ok(lg && lg.pos !== 'sticky' && lg.ovf !== 'auto', `/yasal/…: «İçindekiler» kutusu şeride dönüşmez (${lg && lg.pos}, taşma ${lg && lg.ovf})`);

  // dokunma hedefleri: ad / hizmet / künye bağlantıları ≥ 24 px (WCAG 2.5.8); yerleşim dengelendiği için görünüm aynı kalır
  const TOUCH = '.prow__name a, .tm-dept__a a, .pp__name a, .pp__topics a, .who__t, .who__none, .who__pp, .pf-svcgrp__h a, .pf-svcgrp__l a, .pf-facts__chips a, .pinline a, .kunye dd a';
  let total = 0;
  const small = [];
  for (const url of [AREA, RICH, '/hizmetler/akademi/ufrs/', SECTOR_ODD, '/hakkimizda/', '/hakkimizda/ekibimiz/', person]) {
    await open(page, url);
    const r = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width && b.height && getComputedStyle(e).visibility !== 'hidden';
      });
      return { n: els.length, bad: els.map((e) => ({ t: e.textContent.trim().slice(0, 18), h: e.getBoundingClientRect().height })).filter((x) => x.h < 24) };
    }, TOUCH);
    total += r.n;
    r.bad.forEach((b) => small.push(`${url} «${b.t}» ${b.h.toFixed(1)} px`));
  }
  ok(total >= 40 && small.length === 0, `ad/hizmet/künye bağlantıları ≥ 24 px yüksek (${total} bağlantı denetlendi)${small.length ? ' — küçük: ' + small.slice(0, 4).join(' | ') : ''}`);
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

try {
  if (!ONLY || ONLY === 'tick') await tick();
  if (!ONLY || ONLY === 'tiers') await tiers();
  if (!ONLY || ONLY === 'layout') await layout();
  if (!ONLY || ONLY === 'hud') await hud();
  if (!ONLY || ONLY === 'router') await router();
  if (!ONLY || ONLY === 'mobile') await mobile();
} catch (e) {
  fails++;
  console.log('  ✘ HATA', e.message.split('\n')[0]);
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
