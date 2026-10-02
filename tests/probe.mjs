// Bir seçicinin boyut/görünüm/ata zincirini yazar (hata ayıklama aracı): node tests/probe.mjs /yol "<seçici>" [--w=390]
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
const [, , url, sel, ...rest] = process.argv;
const w = +((rest.find((a) => a.startsWith('--w=')) || '--w=390').slice(4));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await guardContext(await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: w < 700, hasTouch: w < 700 }));
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4181' + url, { waitUntil: 'load' });
await page.waitForTimeout(900);
const out = await page.evaluate((s) => {
  return [...document.querySelectorAll(s)].slice(0, 8).map((e) => {
    const r = e.getBoundingClientRect();
    const path = [];
    for (let p = e; p && p !== document.body && path.length < 5; p = p.parentElement) path.push(p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/).join('.') : ''));
    return { w: Math.round(r.width), h: Math.round(r.height), text: (e.textContent || '').trim().slice(0, 40), disp: getComputedStyle(e).display, path: path.join(' < ') };
  });
}, sel);
console.log(JSON.stringify(out, null, 1));
await browser.close();
