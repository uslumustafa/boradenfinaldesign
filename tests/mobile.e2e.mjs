// Telefon ve tablet (dikey + yan çevrilmiş): ana sayfa kahraman videosu ve koyu bölümler — gerçek Chrome, dokunmatik öykünme.
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/mobile.e2e.mjs [--base=http://127.0.0.1:4181]
// Müşteri geri bildirimi (Ekim 2026): «mobilde video aşağı düşüyor, webdeki gibi görünmeli»; yatay ekran da genel olarak denetlenir.
// Denetlenenler:
//   • video kahramanın tam ekran zeminidir (masaüstündeki gibi; ayrı bir bant değil)
//   • kahraman ekrandan uzun olsa da metin, düğmeler ve video düğmesi beyaz sayfa üstüne binmeden tam görünür (yapışma konumu)
//   • oynat/duraklat düğmesi görünür ve dokununca durum değiştirir (iki kez: geri döner)
//   • yatay taşma yok; konsol/HTTP temiz
//   • yan çevrilmiş telefonda (601–900 px, en-boy ≥ 1,5) koyu bölümlerin yazısı 3B şeklin karşı yarısındadır
// Not: Playwright'ın WebKit'i sessiz kendiliğinden oynatmaya izin vermediği için iPhone Safari ayrıca iOS Simülatörü'nde denenir
// (docs/HANDOFF.md); bu test Chrome ile çalışır (CI'da da).
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:4181').slice(7);
const DEVICES = [
  { name: 'iPhone SE dikey', w: 320, h: 568 },
  { name: 'iPhone 14 dikey (Safari görünür alanı)', w: 390, h: 664 },
  { name: 'Pixel 7 dikey', w: 412, h: 839 },
  { name: 'iPad dikey', w: 768, h: 1024 },
  { name: 'iPhone SE yatay', w: 667, h: 375 },
  { name: 'iPhone 14 yatay (Safari görünür alanı)', w: 750, h: 340 },
  { name: 'Pixel 7 yatay', w: 863, h: 360 },
];
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const d of DEVICES) {
  console.log(`${d.name} (${d.w}×${d.h})`);
  const ctx = await guardContext(await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: d.w < 700 || d.h < 500, hasTouch: true, deviceScaleFactor: 2 }));
  await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'lite')); // telefonun kendiliğinden seçtiği katman
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !driverNoise(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && logs.push(`[http ${r.status()}] ${r.url()}`));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 8000 });
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const hero = r('.hero'), media = r('.hero__media');
    return { hero: [hero.top, hero.bottom, hero.width], media: [media.top, media.bottom, media.width], vw: innerWidth, sw: document.scrollingElement.scrollWidth, ctlHidden: document.querySelector('[data-film-ctl]').hidden };
  });
  ok(Math.abs(m.media[0] - m.hero[0]) <= 1 && Math.abs(m.media[1] - m.hero[1]) <= 1 && m.media[2] >= m.vw - 1, `video kahramanın tam ekran zemini (kahraman ${Math.round(m.hero[0])}–${Math.round(m.hero[1])}, video ${Math.round(m.media[0])}–${Math.round(m.media[1])})`);
  ok(m.sw <= m.vw + 1, `yatay taşma yok (${m.sw} ≤ ${m.vw})`);

  // kaydırırken metin, düğmeler ve video düğmesi beyaz sayfa üstüne binmeden tam görünür
  const seen = await page.evaluate(async () => {
    const sheet = document.querySelector('.intro');
    const parts = { metin: '.hero__text', düğmeler: '.hero__btns', 'video düğmesi': '.hero__ctl', başlık: '.hero__title' };
    const best = Object.fromEntries(Object.keys(parts).map((k) => [k, 0]));
    for (let y = 0; y <= innerHeight * 1.6; y += 12) {
      scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const st = sheet.getBoundingClientRect().top;
      for (const [k, s] of Object.entries(parts)) {
        const b = document.querySelector(s).getBoundingClientRect();
        const vis = Math.max(0, Math.min(b.bottom, innerHeight, st) - Math.max(b.top, 0));
        best[k] = Math.max(best[k], vis / b.height);
      }
    }
    scrollTo(0, 0);
    return best;
  });
  for (const [k, v] of Object.entries(seen)) ok(v >= 0.98, `${k} beyaz sayfa binmeden tam görünür (%${Math.round(v * 100)})`);

  // oynat/duraklat: görünür, dokununca durum değişir ve ikinci dokunuşta geri döner
  await page.waitForTimeout(500);
  const label = () => page.getAttribute('.hero [data-film-ctl]', 'aria-label');
  const l0 = await label();
  let l1 = '', l2 = '';
  try {
    await page.tap('.hero [data-film-ctl]', { timeout: 5000 });
    await page.waitForTimeout(450);
    l1 = await label();
    await page.tap('.hero [data-film-ctl]', { timeout: 5000 });
    await page.waitForTimeout(450);
    l2 = await label();
  } catch (e) {
    l1 = 'dokunulamadı: ' + e.message.split('\n')[0];
  }
  ok(!m.ctlHidden && l1 !== l0 && l2 === l0, `oynat/duraklat düğmesi dokununca çalışır («${l0}» → «${l1}» → «${l2}»)`);

  // yan çevrilmiş telefon: koyu bölümlerde yazı şeklin karşı yarısında
  if (d.w > 600 && d.w <= 900 && d.w / d.h >= 1.5) {
    const col = await page.evaluate(() => {
      if (document.documentElement.classList.contains('hero-wide')) return null;
      const right = (sel) => Math.max(...[...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().right));
      const left = (sel) => Math.min(...[...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().left));
      return { vw: innerWidth, cta: right('.cta__main > *'), areas: right('.areas__list .area__name'), sectors: left('.sectors__head, .sectorlist') };
    });
    if (!col) console.log('  · efektler kapalı (şekil yok): sütun denetimi atlandı');
    else {
      ok(col.cta <= col.vw * 0.56 && col.areas <= col.vw * 0.56, `şekil sağda: iletişim bandı ve alanların yazısı sol yarıda (sağ kenar ${Math.round(col.cta)} / ${Math.round(col.areas)} ≤ ${Math.round(col.vw * 0.56)})`);
      ok(col.sectors >= col.vw * 0.42, `şekil solda: sektörlerin yazısı sağ yarıda (sol kenar ${Math.round(col.sectors)} ≥ ${Math.round(col.vw * 0.42)})`);
    }
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
