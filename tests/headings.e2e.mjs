// Tek yazı tipi, düz yazı (gerçek Chrome) — çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/headings.e2e.mjs [--base=http://127.0.0.1:4181] [--only=/,/hakkimizda/]
// Müşteri (2026-10-20): «2 tip yazı var (Sektörün dilini / bilen bir bakış), tek tip olacak, çoğu yerde var»; «tüm yazılar tek
// font olsun, italik/eğik olmasın, düz — Deloitte'nin düz yazısı». Site haritasındaki her sayfada (masaüstü ve telefon), görünen ve
// gizli (açılır panel, akordeon, form sonucu) her metin için denetlenenler:
//   • italik ya da eğik yazı yok (font-style: normal)
//   • tek yazı ailesi: Open Sans (form alanları ve düğmeler dahil)
//   • başlıkların içindeki parçalar başlıkla aynı yazıda; iki satırlı başlıkların ikinci satırı (<em>) ilk satırla birebir aynı:
//     yazı, biçim, kalınlık, boy ve renk (proje sahibi: «alttaki yazı ile üstteki yazı aynı olacak, eğik vs. istemiyorlar, tek tip»)
//   • italik yazı dosyası yüklenmez; tarayıcı eğik taklidi üretmez (font-synthesis-style: none)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { guardContext, driverNoise } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const DIST = new URL('../dist/', import.meta.url).pathname;
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'assets') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push('/' + path.relative(DIST, p).replace(/index\.html$/, ''));
  }
  return out;
};
const only = arg('only', '');
const urls = only ? only.split(',') : walk(DIST).sort();

let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const vp of [
  { w: 1440, h: 900, mobile: false, label: 'masaüstü' },
  { w: 390, h: 844, mobile: true, label: 'telefon' },
]) {
  const ctx = await guardContext(await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile }));
  await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'off'));
  const page = await ctx.newPage();
  const logs = [];
  const fonts = new Set();
  page.on('pageerror', (e) => logs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && logs.push(m.text()));
  page.on('request', (r) => r.resourceType() === 'font' && fonts.add(r.url().replace(/^.*\/assets\/fonts\//, '')));
  const bad = { italic: [], family: [], mixed: [], second: [] };
  let seconds = 0;
  let texts = 0;
  let heads = 0;
  let synth = '';
  for (const u of urls) {
    await page.goto(BASE + u, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const name = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
      const text = (e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 32);
      const family = (cs) => cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const out = { texts: 0, heads: 0, seconds: 0, italic: [], family: [], mixed: [], second: [], synth: getComputedStyle(document.documentElement).fontSynthesisStyle };
      for (const e of document.querySelectorAll('body *')) {
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(e.tagName)) continue;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName);
        if (!own || e.closest('svg, script, style, noscript, template')) continue;
        out.texts++;
        const cs = getComputedStyle(e);
        if (cs.fontStyle !== 'normal') out.italic.push(`${name(e)} (${cs.fontStyle}) «${text(e)}»`);
        if (family(cs) !== 'Open Sans') out.family.push(`${name(e)} (${family(cs)}) «${text(e) || e.getAttribute('placeholder') || ''}»`);
      }
      for (const h of document.querySelectorAll('h1, h2, h3, h4')) {
        if (!h.textContent.trim()) continue;
        out.heads++;
        const hs = getComputedStyle(h);
        for (const c of h.querySelectorAll('*')) {
          if (!c.textContent.trim()) continue;
          const cs = getComputedStyle(c);
          // aynı aile ve biçim (kalınlık/renk farkı — ör. sıra numarası — aynı yazı tipidir)
          if (cs.fontStyle !== hs.fontStyle || family(cs) !== family(hs)) out.mixed.push(`${name(h)} › ${name(c)} «${text(c)}»`);
        }
        // ikinci satır (<em>): ilk satırla birebir aynı görünüm
        for (const em of h.querySelectorAll('em')) {
          out.seconds++;
          const cs = getComputedStyle(em);
          const diff = ['fontStyle', 'fontWeight', 'fontSize', 'color', 'letterSpacing'].filter((k) => cs[k] !== hs[k]);
          if (family(cs) !== family(hs)) diff.push('fontFamily');
          if (diff.length) out.second.push(`${name(h)} «${text(h)}» (${diff.map((k) => `${k}: ${hs[k]} → ${cs[k]}`).join(', ')})`);
        }
      }
      return out;
    });
    texts += r.texts;
    heads += r.heads;
    seconds += r.seconds;
    synth = synth || r.synth;
    for (const k of Object.keys(bad)) for (const x of r[k]) bad[k].push(`${u} ${x}`);
  }
  const uniq = (a) => [...new Set(a.map((x) => x.replace(/^\S+ /, '')))].slice(0, 10).join(' | ');
  console.log(`\n${vp.label} ${vp.w}×${vp.h} · ${urls.length} sayfa · ${texts} metin öğesi · ${heads} başlık`);
  ok(texts > urls.length * 20 && bad.italic.length === 0, `italik ya da eğik yazı yok${bad.italic.length ? ` — ${bad.italic.length}: ${uniq(bad.italic)}` : ''}`);
  ok(bad.family.length === 0, `tek yazı ailesi: Open Sans${bad.family.length ? ` — başka aile ${bad.family.length}: ${uniq(bad.family)}` : ''}`);
  ok(heads > urls.length && bad.mixed.length === 0, `başlıkların içindeki parçalar başlıkla aynı yazıda${bad.mixed.length ? ` — ${bad.mixed.length}: ${uniq(bad.mixed)}` : ''}`);
  ok(seconds > 0 && bad.second.length === 0, `iki satırlı başlıklarda (${seconds}) ikinci satır ilk satırla aynı: yazı, kalınlık, boy, renk${bad.second.length ? ` — farklı ${bad.second.length}: ${uniq(bad.second)}` : ''}`);
  const italicFiles = [...fonts].filter((f) => /italic/i.test(f));
  ok(fonts.size > 0 && italicFiles.length === 0, `yüklenen yazı tipi dosyaları düz (${[...fonts].map((f) => f.replace(/\.[0-9a-f]{8}\.woff2.*$/, '')).join(', ')})`);
  ok(synth === 'none', `tarayıcı eğik taklidi üretmez (font-synthesis-style: ${synth})`);
  ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
