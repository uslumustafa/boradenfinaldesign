// Toplu sayfa denetimi (geliştirme): dist/ içindeki tüm sayfaları gerçek Chrome ile açar;
// yatay taşma, konsol/ağ hatası, başlık düzeni, alt metinsiz görsel, adsız düğme/bağlantı,
// yinelenen id ve küçük dokunma hedeflerini raporlar.
//   node tests/audit.mjs [--base=http://127.0.0.1:4181] [--w=390 --h=844 --mobile] [--fx=lite]
//                        [--only=/sektorler/,/sss/] [--limit=20] [--dist=dist] [--shots=/sektorler/,/sss/]
// Çıktı: konsola özet; ayrıntılı JSON → tests/shots/audit-<w>.json
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
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const base = args.base || 'http://127.0.0.1:4181';
const w = +(args.w || 390);
const h = +(args.h || 844);
const mobile = !!args.mobile || w < 700;
const dist = path.resolve(root, args.dist || process.env.BORADEN_DIST || 'dist');
const outDir = args.out ? path.resolve(root, args.out) : path.join(here, 'shots');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'assets') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html' || e.name === '404.html') out.push(p);
  }
  return out;
}
let urls = walk(dist)
  .map((p) => {
    const rel = path.relative(dist, p).replace(/\\/g, '/');
    if (rel === '404.html') return '/404.html';
    return '/' + rel.replace(/index\.html$/, '');
  })
  .sort();
if (args.only) {
  const set = String(args.only).split(',');
  // tam eşleşme; sonu * ile biten girdi ön ek olarak eşleşir (ör. /hizmetler/*)
  urls = urls.filter((u) => set.some((s) => (s.endsWith('*') ? u.startsWith(s.slice(0, -1)) : u === s)));
}
if (args.limit) urls = urls.slice(0, +args.limit);
const shotSet = new Set(String(args.shots || '').split(',').filter(Boolean));

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});
const ctx = await guardContext(await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
}));
if (args.fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), args.fx);
const page = await ctx.newPage();
let logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[requestfailed] ' + r.url()));
page.on('response', (r) => {
  if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
});

const probe = () => {
  const vw = document.documentElement.clientWidth;
  const out = {};
  out.overflowX = Math.max(0, document.documentElement.scrollWidth - vw);
  // taşan öğeler: kaydırılabilir bir atası olmayanlar
  const scrollable = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) return true;
    }
    return false;
  };
  const off = [];
  if (out.overflowX > 0) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.right > vw + 1 || r.left < -1) {
        if (scrollable(el)) continue;
        off.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} r=${Math.round(r.right)} l=${Math.round(r.left)}`);
        if (off.length >= 6) break;
      }
    }
  }
  out.offenders = off;
  const hs = [...document.querySelectorAll('h1,h2,h3,h4')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  out.h1 = document.querySelectorAll('h1').length;
  let prev = 0;
  const skips = [];
  for (const e of hs) {
    const n = +e.tagName[1];
    if (prev && n > prev + 1) skips.push(`h${prev}→h${n} "${(e.textContent || '').trim().slice(0, 28)}"`);
    prev = n;
  }
  out.headingSkips = skips.slice(0, 4);
  out.imgNoAlt = [...document.querySelectorAll('img:not([alt])')].map((e) => e.getAttribute('src')).slice(0, 4);
  const name = (e) =>
    (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.textContent || '').trim() ||
    e.querySelector('img[alt]:not([alt=""])') ||
    e.querySelector('svg title');
  out.noName = [...document.querySelectorAll('a[href],button')]
    .filter((e) => !name(e))
    .map((e) => `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).trim().split(/\s+/)[0] : ''}[${(e.getAttribute('href') || '').slice(0, 40)}]`)
    .slice(0, 5);
  const ids = {};
  for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, c]) => c > 1).map(([k]) => k).slice(0, 5);
  const lbl = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea')].filter((e) => {
    if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby')) return false;
    if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return false;
    if (e.closest('label')) return false;
    return true;
  });
  out.unlabeled = lbl.map((e) => `${e.tagName.toLowerCase()}[name=${e.getAttribute('name') || ''}]`).slice(0, 5);
  // küçük dokunma hedefleri (yalnızca dokunmatik modda anlamlı)
  // WCAG 2.5.8 (AA): bağlantı/hedef en az 24×24 CSS px; düğme, çip ve alanlar için daha rahat 40 px yükseklik
  const small = [];
  for (const e of document.querySelectorAll('button, .btn, .chip, input:not([type=hidden]), select, textarea, a[href]')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || e.closest('[hidden]')) continue;
    if (e.matches('.sr-only, .skip, .skip-link') || e.closest('.sr-only')) continue;
    if (e.matches('input[type=checkbox],input[type=radio]') && (e.closest('label') || document.querySelector(`label[for="${CSS.escape(e.id || '_')}"]`))) continue;
    // etkileşimsiz etiket (span.chip) hedef değildir
    if (e.matches('span.chip, div.chip')) continue;
    const isCtl = e.matches('button, .btn, .chip, input, select, textarea');
    // metin içindeki (satır içi) bağlantılar WCAG'de muaf: bir paragraf/liste öğesinin içinde cümle akışında duranlar
    const inline = !isCtl && cs.display === 'inline' && e.parentElement && e.parentElement.textContent.trim().length > e.textContent.trim().length + 6;
    if (inline) continue;
    const bad = isCtl ? r.height < 40 : r.height < 24 || r.width < 24;
    if (bad) small.push(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''} ${Math.round(r.width)}×${Math.round(r.height)} "${(e.textContent || '').trim().slice(0, 18)}"`);
  }
  out.smallTargets = small.slice(0, 5);
  out.title = document.title;
  out.hasMetaDesc = !!document.querySelector('meta[name=description]');
  out.lang = document.documentElement.lang;
  out.errorPage = /\[sayfa\]|HATA|Template render error|ReferenceError|TypeError/.test(document.body.innerText.slice(0, 600));
  out.fontsOk = document.fonts ? document.fonts.status : 'n/a';
  out.imgsBroken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc).slice(0, 4);
  return out;
};

const results = [];
let bad = 0;
for (const u of urls) {
  logs = [];
  let res;
  try {
    await page.goto(base + u, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(+(args.wait || 700));
    // geç yüklenen içerik / reveal tetiklensin
    await page.evaluate(async () => {
      const total = document.documentElement.scrollHeight;
      for (let y = 0; y < total; y += innerHeight * 0.9) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(250);
    res = await page.evaluate(probe);
    if (shotSet.has(u)) {
      const f = path.join(outDir, `audit-${w}-${u.replace(/[^a-z0-9]+/gi, '_') || 'home'}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 72 });
    }
  } catch (e) {
    res = { fatal: String(e.message || e).slice(0, 160) };
  }
  res.url = u;
  res.logs = [...new Set(logs)].slice(0, 6);
  const issues = [];
  if (res.fatal) issues.push('fatal: ' + res.fatal);
  if (res.overflowX > 0) issues.push(`yatay taşma ${res.overflowX}px → ${res.offenders.join(' | ')}`);
  if (res.errorPage) issues.push('hata sayfası?');
  if (res.h1 !== 1 && !res.fatal) issues.push(`h1 sayısı ${res.h1}`);
  if (res.headingSkips?.length) issues.push('başlık atlaması: ' + res.headingSkips.join('; '));
  if (res.imgNoAlt?.length) issues.push('alt yok: ' + res.imgNoAlt.join(','));
  if (res.noName?.length) issues.push('adsız: ' + res.noName.join(' '));
  if (res.dupIds?.length) issues.push('yinelenen id: ' + res.dupIds.join(','));
  if (res.unlabeled?.length) issues.push('etiketsiz alan: ' + res.unlabeled.join(' '));
  if (mobile && res.smallTargets?.length) issues.push('küçük hedef: ' + res.smallTargets.join(' | '));
  if (res.imgsBroken?.length) issues.push('kırık görsel: ' + res.imgsBroken.join(','));
  if (res.logs.length) issues.push('konsol/ağ: ' + res.logs.join(' ; '));
  if (!res.fatal && !res.hasMetaDesc && !/404/.test(u)) issues.push('meta description yok');
  res.issues = issues;
  if (issues.length) bad++;
  results.push(res);
  console.log(`${issues.length ? '✗' : '✓'} ${u}${issues.length ? '\n    ' + issues.join('\n    ') : ''}`);
}
fs.writeFileSync(path.join(outDir, `audit-${w}.json`), JSON.stringify(results, null, 1));
console.log(`\nÖZET w=${w}: ${results.length} sayfa, sorunlu: ${bad}`);
await browser.close();
