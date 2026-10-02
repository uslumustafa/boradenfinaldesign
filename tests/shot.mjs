// Ekran görüntüsü aracı (geliştirme): gerçek Chrome ile sayfayı açar, belirtilen yerlere kaydırıp görüntü alır.
//   node tests/shot.mjs --path=/ --w=1440 --h=900 --scroll=0,25%,#alanlar --name=home [--fx=full|lite|off] [--mobile] [--dpr=1]
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [m[1], m[2] ?? true];
  })
);
const base = args.base || 'http://127.0.0.1:4181';
const w = +(args.w || 1440);
const h = +(args.h || 900);
const scrolls = String(args.scroll ?? '0').split(',').map((s) => s.trim());
const name = args.name || 'shot';
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'shots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});
const ctx = await guardContext(await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: +(args.dpr || 1),
  isMobile: !!args.mobile,
  hasTouch: !!args.mobile,
}));
if (args.fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), args.fx);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[requestfailed] ' + r.url()));
page.on('response', (r) => {
  if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
});
await page.goto(base + (args.path || '/'), { waitUntil: 'load' });
if (args.css) await page.addStyleTag({ content: String(args.css) });
await page.waitForTimeout(+(args.wait || 2400));

for (const s of scrolls) {
  let y;
  if (s.endsWith('%')) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    y = Math.round((total * parseFloat(s)) / 100);
  } else if (s.startsWith('#')) {
    // "#id" veya "#id+600" / "#id-80" (öğenin tepesine göre piksel kayması)
    const m = s.match(/^(#[^@+]+)(?:@|(?=\+))?([+-]?\d+)?$/) || [null, s, '0'];
    y = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top + scrollY) : 0;
    }, m[1]);
    y += +(m[2] || 0) + +(args.offset || 0);
  } else y = +s;
  // kaydırmayı adım adım yap: kaydırma motoru ve IntersectionObserver gerçekçi tetiklensin
  await page.evaluate(async (target) => {
    const start = scrollY;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      scrollTo(0, start + ((target - start) * i) / steps);
      await new Promise((r) => setTimeout(r, 40));
    }
  }, y);
  await page.waitForTimeout(+(args.settle || 1100));
  const file = path.join(outDir, `${name}-${String(s).replace(/[^a-z0-9]+/gi, '_')}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 74, fullPage: false });
  const now = await page.evaluate(() => scrollY);
  console.log('shot', path.basename(file), 'y=', now);
}
const info = await page.evaluate(() => ({
  cls: document.documentElement.className,
  fx: document.documentElement.dataset.fx,
  scrollH: document.documentElement.scrollHeight,
  canvas: (() => {
    const c = document.getElementById('world-canvas');
    return c ? [c.width, c.height, getComputedStyle(c).opacity] : null;
  })(),
}));
console.log(JSON.stringify(info));
if (logs.length) console.log('--- konsol ---\n' + logs.slice(0, 40).join('\n'));
await browser.close();
