// Production regression: effect changes must preserve page state; no external schemes or real clipboard writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
const base = process.env.BASE_URL || 'http://127.0.0.1:4181';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
await ctx.addInitScript(() => {
  localStorage.setItem('boraden-fx', 'off');
  window.__copies = [];
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => window.__copies.push(text) } });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
async function tier(value) {
  await page.locator(`[data-fx-set="${value}"]:visible`).click();
  await page.waitForFunction(t => document.documentElement.dataset.fx === t, value);
  await page.waitForTimeout(150);
  assert.equal(await page.locator('html').getAttribute('data-fx'), value, `stable effect tier ${value}`);
}
try {
  await page.goto(base);
  await page.waitForSelector('[data-lit] .sr-only', { state: 'attached' });
  const original = await page.locator('[data-lit] .sr-only').first().textContent();
  for (const value of ['off', 'lite', 'off', 'full', 'off']) {
    await tier(value);
    assert.equal(await page.locator('[data-lit] .sr-only').first().textContent(), original, `lit text after ${value}`);
  }
  console.log('PASS: repeated effect changes keep one accessible text copy');
  const video = page.locator('.film__video');
  await page.click('[data-film-ctl]');
  await page.waitForFunction(() => !document.querySelector('.film__video').paused);
  await page.click('[data-film-ctl]');
  for (const value of ['lite', 'full', 'off']) {
    await tier(value);
    await page.locator('#film').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.equal(await video.evaluate(el => el.paused), true, `explicit video pause after ${value}`);
  }
  console.log('PASS: effect changes preserve explicit video pause');
  await page.goto(base + '/iletisim/?hizmet=kdv-iade-islemleri');
  await page.waitForFunction(() => document.querySelector('#ct-f-konu')?.value === 'vergi-ve-mali-musavirlik');
  await page.fill('#ct-f-ad', 'Test Kullanıcısı');
  await page.fill('#ct-f-eposta', 'test@example.invalid');
  const message = 'Uzun taslak çğıöşü 🙂 '.repeat(180);
  await page.fill('#ct-f-mesaj', message);
  await page.check('#ct-f-kvkk-onay');
  await page.click('.ct-submit');
  await page.waitForSelector('[data-fk-done]:not([hidden])');
  await page.click('[data-fk-copy]');
  const copy = await page.evaluate(() => window.__copies.at(-1));
  assert.ok(copy.includes(message.trim()));
  const href = await page.getAttribute('[data-fk-mailto]', 'href');
  for (const value of ['off', 'lite', 'off', 'full', 'off']) {
    await tier(value);
    await page.click('[data-fk-copy]');
    assert.equal(await page.evaluate(() => window.__copies.at(-1)), copy, `draft copy after ${value}`);
    assert.equal(await page.getAttribute('[data-fk-mailto]', 'href'), href);
    assert.ok(await page.isVisible('[data-fk-done]'));
  }
  await page.click('[data-fk-edit]');
  assert.equal(await page.inputValue('#ct-f-mesaj'), message);
  assert.equal(await page.inputValue('#ct-f-konu'), 'vergi-ve-mali-musavirlik');
  await page.locator('#ct-f-ad').evaluate(el => { el.value = 'A'.repeat(161); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('.ct-submit');
  assert.match(await page.locator('#ct-f-ad-e').textContent(), /En fazla 160/);
  assert.ok(await page.isVisible('#ct-form'));
  console.log('PASS: overlong header fields are rejected before draft creation');
  assert.deepEqual(await page.evaluate(() => window.__blockedExternal), []);
  await page.goto(base + '/kariyer/?alan=sistem');
  await page.waitForFunction(() => document.querySelector('#cr-f-alan')?.value === 'sistem');
  await page.fill('#cr-f-ad', 'Test Kullanıcısı');
  await page.fill('#cr-f-eposta', 'test@example.invalid');
  await page.check('input[name="deneyim"][value="1-3-yil"]');
  await page.setInputFiles('#cr-f-cv', { name: 'test-cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF synthetic fixture') });
  await page.check('#cr-f-kvkk-onay');
  await page.click('#cr-form .ct-submit');
  await page.waitForSelector('[data-fk-done]:not([hidden])');
  await page.click('[data-fk-copy]');
  const careerCopy = await page.evaluate(() => window.__copies.at(-1));
  assert.ok(careerCopy.includes('test-cv.pdf'));
  for (const next of ['lite', 'off']) {
    await tier(next);
    await page.click('[data-fk-copy]');
    assert.equal(await page.evaluate(() => window.__copies.at(-1)), careerCopy);
  }
  await page.click('[data-fk-edit]');
  assert.equal(await page.locator('#cr-f-cv').evaluate(el => el.files[0].name), 'test-cv.pdf');
  assert.equal(await page.inputValue('#cr-f-alan'), 'sistem');
  assert.deepEqual(await page.evaluate(() => window.__blockedExternal), []);
  console.log('PASS: effect changes preserve career draft, selection and CV fixture');
  await page.goto(base + '/hesaplayicilar/kdv-hesaplama/');
  await page.waitForSelector('[data-calc] .calc__main dd');
  const amount = page.locator('[data-calc] input[name="amount"]');
  await amount.fill('25000');
  await amount.blur();
  await page.waitForTimeout(400);
  const value = await amount.inputValue();
  const result = await page.locator('[data-calc-res] .calc__main').textContent();
  for (const next of ['off', 'lite', 'off']) {
    await tier(next);
    assert.equal(await amount.inputValue(), value);
    assert.equal(await page.locator('[data-calc-res] .calc__main').textContent(), result);
  }
  console.log('PASS: effect changes preserve calculator input and result');
  assert.deepEqual(errors, []);
  console.log('PASS: effect changes preserve full draft, copy, form values and context');

  // T-09: automatic fallback (no WebGL) must not re-wrap the open page's hero title; the next page and the user's own choice may.
  const gl = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
  await gl.addInitScript(() => {
    // capable hardware (tier «full» on start), but no WebGL: the world fails after its chunk loads
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 });
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/i.test(type) ? null : get.call(this, type, ...rest); };
  });
  let release;
  const held = new Promise((r) => { release = r; });
  await gl.route('**/chunks/world-*.js', async (route) => { await held; await route.continue(); });
  const p2 = await gl.newPage();
  const glErrors = [];
  p2.on('console', (m) => { if (m.type() === 'error') glErrors.push(m.text()); });
  const hero = () => p2.evaluate(() => {
    const h = document.querySelector('.phero h1'); // layout box (offset*: the entrance transform does not count)
    const d = document.documentElement;
    return { box: [h.offsetTop, h.offsetWidth, h.offsetHeight], wide: d.classList.contains('hero-wide'), fx: d.dataset.fx };
  });
  try {
    await p2.goto(base + '/vergi-takvimi/');
    await p2.waitForFunction(() => document.documentElement.classList.contains('is-ready'));
    const before = await hero();
    assert.ok(before.fx !== 'off' && !before.wide, `effects on at start, column follows the shape (${JSON.stringify(before)})`);
    release();
    await p2.waitForFunction(() => document.documentElement.dataset.fx === 'off');
    await p2.waitForTimeout(100);
    const after = await hero();
    assert.equal(after.wide, false, 'automatic fallback keeps the open page laid out');
    assert.deepEqual(after.box, before.box, 'hero title box unchanged after automatic fallback');
    await p2.evaluate(() => { const a = document.createElement('a'); a.href = '/hizmetler/'; document.body.append(a); a.click(); a.remove(); });
    await p2.waitForFunction(() => document.querySelector('#main').dataset.url === '/hizmetler/' && document.activeElement?.id === 'main');
    assert.equal((await hero()).wide, true, 'next page uses the full-width column');
    await p2.locator('[data-fx-set="full"]:visible').click();
    assert.equal((await hero()).wide, false, 'user choice narrows the column at once');
    await p2.waitForFunction(() => document.documentElement.dataset.fx === 'off');
    assert.equal((await hero()).wide, false, 'fallback after the user choice keeps the open page laid out');
    await p2.locator('[data-fx-set="off"]:visible').click();
    assert.equal((await hero()).wide, true, 'user choice «off» widens the column at once');
    console.log('PASS: automatic effect fallback keeps the hero title in place');
    // T-35: WebGL 2 is tested on a throwaway canvas first, so three.js never tries (and logs) a failing renderer
    assert.deepEqual(glErrors.filter((t) => /THREE|WebGL/i.test(t)), [], 'no three.js / WebGL errors without WebGL');
    console.log('PASS: no console errors from the renderer when WebGL is missing');
  } finally {
    await gl.close();
  }
} finally {
  await ctx.close();
  await browser.close();
}
