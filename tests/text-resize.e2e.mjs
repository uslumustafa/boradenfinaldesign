// Browser default font-size at 200%; this is distinct from native page zoom.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4181';
const outDir = process.env.TEXT_RESIZE_OUTPUT || '../audit-evidence/fixes/';
const out = new URL(outDir.endsWith('/') ? outDir : outDir + '/', import.meta.url);
await fs.mkdir(new URL('screenshots/', out), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const ctx = await guardContext(await browser.newContext({ viewport: { width, height: 900 } }));
    await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'off'));
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    for (const route of ['/', '/iletisim/', '/hesaplayicilar/kdv-hesaplama/']) {
      await page.goto(base + route, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const row = await page.evaluate(() => {
        const outside = [...document.querySelectorAll('main h1,main button,main input,main select,main textarea,.fxswitch button,.hdr__actions button')].filter(e => {
          const r = e.getBoundingClientRect();
          return r.width && r.height && getComputedStyle(e).visibility === 'visible' && (r.left < -1 || r.right > innerWidth + 1);
        }).map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 60) }));
        const nav = document.querySelector('.nav'), actions = document.querySelector('.hdr__actions');
        const nr = nav.getBoundingClientRect(), ar = actions.getBoundingClientRect();
        const navOverlap = nr.width > 0 && [...nav.querySelectorAll('.nav__link')].some(e => e.getBoundingClientRect().right > ar.left);
        const titleClipped = [...document.querySelectorAll('.hero__title .line')].some(e => e.scrollWidth > e.clientWidth + 1);
        const wideNodes = [...document.querySelectorAll('main *,footer *')].filter(e => {
          const r = e.getBoundingClientRect(), s = getComputedStyle(e);
          return r.width && r.height && r.right > innerWidth + 1 && s.visibility === 'visible' && s.position !== 'absolute' && !e.closest('[data-toc]');
        }).slice(0, 25).map(e => ({ tag: e.tagName, cls: e.className, text: e.textContent.trim().slice(0, 50), width: Math.round(e.getBoundingClientRect().width), right: Math.round(e.getBoundingClientRect().right) }));
        return { rootFont: getComputedStyle(document.documentElement).fontSize, overflow: document.documentElement.scrollWidth - innerWidth, outside, navOverlap, titleClipped, wideNodes };
      });
      const shot = `text-${width}-${route.replace(/[^a-z0-9]/g, '_')}.png`;
      if ([390, 1440].includes(width)) await page.screenshot({ path: new URL('screenshots/' + shot, out).pathname });
      results.push({ route, width, ...row, screenshot: [390, 1440].includes(width) ? shot : null });
      console.log(JSON.stringify(results.at(-1)));
      if (route === '/' && [390, 1440].includes(width)) {
        await page.locator('.hdr__burger').focus();
        await page.keyboard.press('Space');
        assert.equal(await page.locator('.hdr__burger').getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#main').evaluate(el => el.inert), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.hdr__burger').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.evaluate(() => document.activeElement.matches('.hdr__burger')), true);
      }
    }
    await ctx.close();
  }
  await fs.writeFile(new URL('text-resize.json', out), JSON.stringify(results, null, 2));
  assert.ok(results.every(r => r.overflow <= 1 && !r.outside.length && !r.navOverlap && !r.titleClipped && !r.wideNodes.length), '200% text must fit with usable controls and readable title');
} finally { await browser.close(); }
