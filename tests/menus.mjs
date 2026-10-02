// Menü panellerini (Hizmetler, Bilgi Merkezi) açıp alt bilgiyle birlikte ekran görüntüsü alır (geliştirme aracı).
//   node tests/menus.mjs [--w=1440] [--fx=lite] [--path=/]   → tests/shots/mega-*.jpg, footer-*.jpg
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const w = +(args.w || 1440);
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'shots');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
const ctx = await guardContext(await browser.newContext({ viewport: { width: w, height: 900 } }));
if (args.fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), args.fx);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
page.on('pageerror', (e) => logs.push(e.message));
await page.goto('http://127.0.0.1:4181' + (args.path || '/'), { waitUntil: 'load' });
await page.waitForTimeout(1800);
for (const panel of ['insights', 'services']) {
  const link = page.locator(`a.nav__link[data-panel="${panel}"]`);
  await link.hover();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `mega-${panel}-${w}.jpg`), type: 'jpeg', quality: 80 });
  console.log('shot mega', panel, await page.locator(`#mega-${panel}`).evaluate((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), getComputedStyle(e).visibility]; }));
  await page.mouse.move(700, 700);
  await page.waitForTimeout(500);
}
// alt bilgi
await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(out, `footer-${w}.jpg`), type: 'jpeg', quality: 80 });
console.log(logs.length ? 'konsol hataları: ' + logs.join(' | ') : 'konsol temiz');
await browser.close();
