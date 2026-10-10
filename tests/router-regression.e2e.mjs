// Router regressions against the real source (isolated fixture) or a running production build.
// node tests/router-regression.e2e.mjs [--base=http://127.0.0.1:4181] [--only=history|race|head|memory|slow] [--out=path.json]
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';

const arg = (key) => process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const fixture = !arg('base');
const only = arg('only');
const results = { mode: fixture ? 'source fixture' : 'production', command: process.argv.slice(1).join(' '), checks: [] };
let server;
let base = arg('base');
const paths = fixture ? { a: '/a/', b: '/b/', c: '/c/', search: '/search/', legal: '/legal/', home: '/' }
  : { a: '/hakkimizda/', b: '/hizmetler/', c: '/iletisim/', search: '/arama/', legal: '/yasal/kvkk-aydinlatma-metni/', home: '/' };

if (fixture) {
  const source = new Map(await Promise.all(['router.js', 'util.js'].map(async (name) => [name, await readFile(new URL(`../src/assets/js/${name}`, import.meta.url), 'utf8')])));
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (source.has(url.pathname.slice(1))) {
      res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(source.get(url.pathname.slice(1)));
      return;
    }
    const path = url.pathname;
    const robots = [paths.search, paths.legal].includes(path) ? '<meta name="robots" content="noindex,follow">' : '';
    const schema = path === paths.b ? '' : `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': path === paths.c ? 'ContactPage' : 'WebPage', url: `https://boraden.test${path}` })}</script>`;
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<!doctype html><html><head><title>${path}</title><meta name="description" content="Description ${path}">${robots}<link rel="canonical" href="https://boraden.test${path}"><meta property="og:title" content="${path}"><meta property="og:url" content="https://boraden.test${path}"><meta property="og:image" content="https://boraden.test${path}image.png"><meta property="og:image:alt" content="Image ${path}"><meta name="twitter:title" content="${path}">${schema}<style id="shell-style">body{margin:0}main{height:6000px}</style></head><body><main id="main" tabindex="-1" data-url="${path}"><h1>${path}</h1><video muted playsinline preload="none"></video><h2 id="anchor" style="margin-top:1400px">Anchor</h2></main><p id="live"></p><script type="module" id="shell-script">import {initRouter} from '/router.js';window.__router=initRouter({fx:{tier:'off'},mount(){},unmount(){},onNavigate(){}});window.__routerReady=true;</script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
results.base = base;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }));
await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'off'));
const page = await ctx.newPage();
const warnings = [];
page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[router]')) warnings.push(m.text()); });
const open = async (path) => {
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__routerReady || window.__boraden);
};
const click = (path) => page.evaluate((href) => {
  const a = document.createElement('a'); a.href = href; document.body.append(a); a.click(); a.remove();
}, path);
const settled = (path) => page.waitForFunction((want) => document.querySelector('#main').dataset.url === want && document.activeElement?.id === 'main', path);
const swap = async (path) => { await click(path); await settled(new URL(path, base).pathname); };
const scroll = async (y) => { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForFunction((v) => Math.abs(scrollY - v) < 2, y); };
const position = () => page.evaluate(() => ({ path: location.pathname, y: scrollY, state: history.state }));
const headSnapshot = () => ({
  title: document.title,
  description: [...document.head.querySelectorAll('meta[name="description"]')].map((el) => el.content),
  robots: [...document.head.querySelectorAll('meta[name="robots"]')].map((el) => el.content),
  canonical: [...document.head.querySelectorAll('link[rel="canonical"]')].map((el) => el.href),
  social: [...document.head.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')].map((el) => [el.getAttribute('property') || el.name, el.content]).sort(),
  schema: [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((el) => JSON.parse(el.textContent)),
});
const traverse = async (direction, path, y) => {
  await page.evaluate((d) => history[d](), direction);
  await settled(path);
  await page.waitForFunction((v) => Math.abs(scrollY - v) < 2, y);
  return position();
};
async function check(id, run) {
  try { const observations = await run(); results.checks.push({ id, pass: true, observations }); console.log(`PASS ${id}`); }
  catch (error) { results.checks.push({ id, pass: false, error: error.stack }); console.error(`FAIL ${id}: ${error.message}`); }
}

try {
  if (!only || only === 'history') await check('F02 history scroll and distinct visits', async () => {
    await open(paths.a);
    await page.evaluate(() => { window.__alive = 'history'; history.replaceState({ ...history.state, syntheticState: 'preserve' }, ''); });
    await scroll(500);
    await swap(paths.b);
    await scroll(1000);
    const observations = [await traverse('back', paths.a, 500), await traverse('forward', paths.b, 1000), await traverse('back', paths.a, 500)];
    assert.equal(observations[0].state.syntheticState, 'preserve');
    assert.equal(observations[0].state.y, 500, 'target history state must not be overwritten by outgoing scroll');
    await swap(paths.b);
    await scroll(900);
    await swap(paths.a);
    await scroll(300);
    observations.push(await traverse('back', paths.b, 900), await traverse('back', paths.a, 500), await traverse('forward', paths.b, 900), await traverse('forward', paths.a, 300));
    assert.equal(await page.evaluate(() => window.__alive), 'history');
    return observations;
  });
  if (!only || only === 'history') await check('F02 rapid back/forward cancels pending older pop', async () => {
    await open(paths.a);
    await page.evaluate(() => { window.__alive = 'rapid-history'; });
    await scroll(500);
    await swap(paths.b);
    await scroll(800);
    let release;
    let acknowledge;
    const requested = new Promise((resolve) => { acknowledge = resolve; });
    await ctx.route(base + paths.a, async (route) => {
      if (route.request().headers()['x-requested-with'] !== 'boraden-swap') return route.continue();
      acknowledge();
      await new Promise((resolve) => { release = resolve; });
      await route.continue();
    });
    await page.evaluate(() => history.back());
    await requested;
    await page.evaluate(() => history.forward());
    await page.waitForFunction((path) => location.pathname === path && scrollY === 800, paths.b);
    release();
    await page.waitForTimeout(350);
    const observation = await page.evaluate(() => ({ path: location.pathname, main: document.querySelector('#main').dataset.url, y: scrollY, alive: window.__alive }));
    assert.deepEqual(observation, { path: paths.b, main: paths.b, y: 800, alive: 'rapid-history' });
    await ctx.unroute(base + paths.a);
    return observation;
  });
  if (!only || only === 'race') await check('F03 stale failure ignored; active failure falls back', async () => {
    await open(paths.a);
    await page.evaluate(() => { window.__alive = 'race'; });
    const slow = paths.c + '?router-regression=slow';
    let release;
    let acknowledge;
    const requested = new Promise((resolve) => { acknowledge = resolve; });
    await ctx.route(base + slow, async (route) => {
      if (route.request().headers()['x-requested-with'] !== 'boraden-swap') return route.continue();
      acknowledge();
      await new Promise((resolve) => { release = resolve; });
      await route.abort('failed');
    });
    const beforeWarnings = warnings.length;
    await click(slow);
    await requested;
    await swap(paths.b);
    release();
    await page.waitForTimeout(350);
    const stale = await page.evaluate(() => ({ path: location.pathname, alive: window.__alive, main: document.querySelector('#main').dataset.url }));
    assert.equal(stale.path, paths.b);
    assert.equal(stale.main, paths.b);
    assert.equal(stale.alive, 'race');
    assert.equal(warnings.length, beforeWarnings, 'stale failure must not warn or trigger full navigation');
    await ctx.unroute(base + slow);
    const active = paths.c + '?router-regression=active';
    await ctx.route(base + active, (route) => route.request().headers()['x-requested-with'] === 'boraden-swap' ? route.abort('failed') : route.continue());
    await click(active);
    await page.waitForURL(base + active, { waitUntil: 'load' });
    const fallback = await page.evaluate(() => ({ path: location.pathname, alive: window.__alive || null }));
    assert.equal(fallback.path, paths.c);
    assert.equal(fallback.alive, null);
    assert.equal(warnings.length, beforeWarnings + 1, 'current request failure must retain full-page fallback');
    await ctx.unroute(base + active);
    return { stale, fallback, warnings: warnings.slice(beforeWarnings) };
  });
  if (!only || only === 'head') await check('F04 swap head equals direct document; shell stays mounted', async () => {
    await open(paths.a);
    await page.evaluate(() => {
      window.__alive = 'head';
      window.__routerShell = [...document.head.querySelectorAll('link[rel="stylesheet"],style,script:not([type="application/ld+json"])')];
    });
    const direct = await ctx.newPage();
    const observations = [];
    try {
      for (const path of [paths.search, paths.b, paths.c, paths.a, paths.legal, paths.b]) {
        await direct.goto(base + path, { waitUntil: 'load' });
        const expected = await direct.evaluate(headSnapshot);
        await swap(path);
        const actual = await page.evaluate(headSnapshot);
        assert.deepEqual(actual, expected, `head metadata mismatch for ${path}`);
        assert.equal(await page.evaluate(() => window.__alive), 'head');
        assert.equal(await page.evaluate(() => {
          const shell = [...document.head.querySelectorAll('link[rel="stylesheet"],style,script:not([type="application/ld+json"])')];
          return shell.length === window.__routerShell.length && shell.every((node, i) => node === window.__routerShell[i]);
        }), true, 'shell styles/scripts must remain the same nodes');
        observations.push({ path, actual });
      }
    } finally { await direct.close(); }
    return observations;
  });
  // T-10: gelen sayfa DOMParser'la ayrıştırılınca (içinde <video> varken) belge hiç toplanmıyordu; her gidiş-dönüşte bir belge birikiyordu
  if (!only || only === 'memory') await check('F05 swaps do not accumulate documents or nodes', async () => {
    await open(paths.home);
    const cdp = await ctx.newCDPSession(page);
    const counters = async () => {
      for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
      return cdp.send('Memory.getDOMCounters');
    };
    try {
      await swap(paths.b);
      await swap(paths.home);
      const start = await counters();
      for (let i = 0; i < 6; i++) {
        await swap(paths.b);
        await swap(paths.home);
      }
      const end = await counters();
      assert.ok(end.documents <= start.documents, `documents grew ${start.documents} → ${end.documents}`);
      assert.ok(end.nodes - start.nodes < 200, `nodes grew ${start.nodes} → ${end.nodes}`);
      return { start, end };
    } finally { await cdp.detach(); }
  });
  // T-14 / U-13: yavaş ağda çıkıştan sonra yükleme çizgisi (html.is-loading + main[aria-busy]); hızlı yanıtta hiç görünmez
  if (!only || only === 'slow') await check('F06 slow response shows a loading line; fast one does not', async () => {
    await open(paths.a);
    await page.evaluate(() => {
      window.__loading = [];
      new MutationObserver(() => window.__loading.push(document.documentElement.classList.contains('is-loading'))).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    await swap(paths.c); // önbellekte değil, ama yerel: hızlı
    const fast = await page.evaluate(() => window.__loading.includes(true));
    assert.equal(fast, false, 'fast response must not flash the loading line');
    const slowPath = new URL(paths.b, base).pathname;
    await page.route((u) => u.pathname === slowPath, async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
    try {
      const t0 = Date.now();
      await click(paths.b);
      await page.waitForFunction(() => document.documentElement.classList.contains('is-loading') && document.getElementById('main').getAttribute('aria-busy') === 'true', null, { timeout: 1400 });
      const shownAfter = Date.now() - t0;
      await settled(slowPath);
      const after = await page.evaluate(() => ({ loading: document.documentElement.classList.contains('is-loading'), busy: document.getElementById('main').hasAttribute('aria-busy') }));
      assert.deepEqual(after, { loading: false, busy: false }, 'loading state cleared after the swap');
      assert.ok(shownAfter >= 250, `line appeared too early (${shownAfter} ms)`);
      return { shownAfter };
    } finally { await page.unroute((u) => u.pathname === slowPath); }
  });
} finally {
  await ctx.close(); await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (arg('out')) { await mkdir(dirname(arg('out')), { recursive: true }); await writeFile(arg('out'), JSON.stringify(results, null, 2) + '\n'); }
}
process.exitCode = results.checks.every((r) => r.pass) ? 0 : 1;
