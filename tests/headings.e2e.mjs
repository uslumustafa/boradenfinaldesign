// Yazı tipleri: boraden.com.tr'deki aileler, bir yazının içi tek yazı tipi, düz yazı (gerçek Chrome) — çalışan bir sunucu gerekir
// (npm run dev ya da node scripts/serve.mjs).
//   node tests/headings.e2e.mjs [--base=http://127.0.0.1:4181] [--only=/,/hakkimizda/]
// Müşteri (2026-10-22): «fontları bizim web sitesindeki gibi yapacağız» (boraden.com.tr: başlıklar ve menü Montserrat, metin Open Sans);
// «Tam, doğru, zamanında» «Google yazı karakteri gibi kalın olsun» (eski sitede Montserrat 700). Proje sahibi: «aynı yazı üstünde
// çift font olmayacak». Önceki tur (2026-10-20): «2 tip yazı var (Sektörün dilini / bilen bir bakış), tek tip olacak»; «italik/eğik
// olmasın, düz». Site haritasındaki her sayfada (masaüstü ve telefon), görünen ve gizli (açılır panel, akordeon, form sonucu) her metin
// için denetlenenler:
//   • yalnızca iki aile: Montserrat ve Open Sans (form alanları ve düğmeler dahil)
//   • başlıklar (h1–h4), üst menü ve ana sayfa sloganı Montserrat; slogan 700 (kalın); düz metin paragrafları Open Sans. Etiket
//     biçimli başlıklar (büyük harf, ≤ 16 px: alt bilgi sütun başlıkları, bölüm etiketleri, menü paneli başlıkları) sitedeki bütün
//     etiketler gibi Open Sans
//   • bir yazının içi tek yazı tipi: aynı satırdaki akışın (paragraf, başlık, liste maddesi, düğme, bağlantı…) bütün parçaları —
//     satır içi öğeler, satır içi kutular (inline-block/inline-flex) ve içerikli ::before/::after metinleri — aynı ailede; satır
//     içindeki bağlantı, kalın yazı, sayı, kısaltma ayrı aileye geçmez. Yalnızca simgeden oluşan parçalar («→», «↗») yazı sayılmaz.
//     Satır akışı yalnızca ekranda çizilen öğelerde belli olduğu için bu denetim görünen öğelerde yapılır (akordeonlar açılarak);
//     gizli öğeler (hidden) aile ve italik denetimlerine girer
//   • italik ya da eğik yazı yok (font-style: normal); italik yazı dosyası yüklenmez; tarayıcı eğik taklidi üretmez
//   • başlıkların içindeki parçalar başlıkla aynı yazıda; iki satırlı başlıkların ikinci satırı (<em>) ilk satırla birebir aynı:
//     yazı, biçim, kalınlık, boy ve renk (proje sahibi: «alttaki yazı ile üstteki yazı aynı olacak, eğik vs. istemiyorlar, tek tip»)
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
const FAMILIES = ['Montserrat', 'Open Sans'];

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
  const bad = { italic: [], family: [], role: [], body: [], run: [], mixed: [], second: [] };
  const usage = {};
  let seconds = 0;
  let texts = 0;
  let runs = 0;
  let heads = 0;
  let synth = '';
  let hero = null;
  for (const u of urls) {
    await page.goto(BASE + u, { waitUntil: 'load' });
    const r = await page.evaluate((FAMILIES) => {
      const name = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
      const text = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
      const family = (cs) => cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const out = { texts: 0, runs: 0, heads: 0, seconds: 0, italic: [], family: [], role: [], body: [], run: [], mixed: [], second: [], usage: {}, hero: null, synth: getComputedStyle(document.documentElement).fontSynthesisStyle };
      const skip = (e) => e.closest('svg, script, style, noscript, template');
      const words = (s) => /[\p{L}\p{N}]/u.test(s || '');
      // aynı satırdaki akış: satır içi öğeler (span, a, strong…) ve satır içi kutular (inline-block/inline-flex rozet, bağlantı)
      // üst bloğun yazısının parçasıdır; blok, ızgara ve esnek öğeler (esnek/ızgara kutunun çocukları dahil) ayrı yazıdır
      const container = (e) => {
        let c = e;
        while (c && c !== document.body && /^(inline|inline-block|inline-flex|inline-grid|inline-table|contents)$/.test(getComputedStyle(c).display)) c = c.parentElement;
        return c;
      };
      const label = (cs) => cs.textTransform === 'uppercase' && parseFloat(cs.fontSize) <= 16.5;
      // akordeonların içi de çizilsin (satır akışı yalnızca çizilen öğede belli: gizli esnek kutunun çocukları satır içi görünür)
      for (const d of document.querySelectorAll('details:not([open])')) d.open = true;
      const shown = (e) => (e.checkVisibility ? e.checkVisibility() : e.getClientRects().length > 0);
      const groups = new Map();
      const add = (box, fam, label) => {
        if (!groups.has(box)) groups.set(box, new Map());
        const g = groups.get(box);
        if (!g.has(fam)) g.set(fam, label);
      };
      for (const e of document.querySelectorAll('body *')) {
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(e.tagName) || skip(e)) continue;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName);
        const cs = getComputedStyle(e);
        // içerikli sözde öğeler (sayaç, «/», «→» gibi süsler hariç: harf ya da rakam içerenler)
        for (const pe of ['::before', '::after']) {
          const ps = getComputedStyle(e, pe);
          const c = ps.content;
          if (!c || c === 'none' || c === 'normal' || !/^["'].*[\p{L}\p{N}].*["']$/u.test(c)) continue;
          if (ps.display !== 'inline') continue;
          out.runs++;
          if (shown(e)) add(container(e), family(ps), `${name(e)}${pe} «${c.slice(1, -1).slice(0, 20)}»`);
          if (ps.fontStyle !== 'normal') out.italic.push(`${name(e)}${pe} (${ps.fontStyle})`);
        }
        if (!own) continue;
        out.texts++;
        const fam = family(cs);
        out.usage[`${fam} ${cs.fontWeight}`] = (out.usage[`${fam} ${cs.fontWeight}`] || 0) + 1;
        if (cs.fontStyle !== 'normal') out.italic.push(`${name(e)} (${cs.fontStyle}) «${text(e)}»`);
        if (!FAMILIES.includes(fam)) out.family.push(`${name(e)} (${fam}) «${text(e) || e.getAttribute('placeholder') || ''}»`);
        out.runs++;
        if (shown(e) && (words([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)))
          add(container(e), fam, `${name(e)} «${text(e)}»`);
      }
      // bir yazının içi tek aile
      for (const [box, g] of groups) {
        if (g.size > 1) out.run.push(`${name(box)} «${text(box)}»: ${[...g].map(([f, l]) => `${f} (${l})`).join(' + ')}`);
      }
      // roller: başlıklar, menü ve slogan Montserrat; düz metin paragrafı Open Sans
      for (const h of document.querySelectorAll('h1, h2, h3, h4')) {
        if (!h.textContent.trim() || skip(h)) continue;
        out.heads++;
        const hs = getComputedStyle(h);
        const want = label(hs) ? 'Open Sans' : 'Montserrat';
        if (family(hs) !== want) out.role.push(`${name(h)} (${family(hs)}; ${label(hs) ? 'etiket' : 'başlık'}) «${text(h)}»`);
        for (const c of h.querySelectorAll('*')) {
          if (!words(c.textContent)) continue;
          const cs = getComputedStyle(c);
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
      for (const a of document.querySelectorAll('.nav__link')) {
        if (family(getComputedStyle(a)) !== 'Montserrat') out.role.push(`${name(a)} (${family(getComputedStyle(a))}) «${text(a)}»`);
      }
      // düz metin: içerik paragrafları (öne çıkan cümle ve giriş paragrafları — .statement, .lg-intro… — Montserrat 400 olabilir)
      for (const p of document.querySelectorAll('main p:not([class]), .prose p, .phero__lead, .hero__text')) {
        if (!p.textContent.trim() || skip(p) || p.closest('.lg-intro')) continue;
        const f = family(getComputedStyle(p));
        if (f !== 'Open Sans') out.body.push(`${name(p)} (${f}) «${text(p)}»`);
      }
      const ht = document.querySelector('.hero__title');
      if (ht) {
        const cs = getComputedStyle(ht);
        out.hero = { family: family(cs), weight: cs.fontWeight };
      }
      return out;
    }, FAMILIES);
    texts += r.texts;
    runs += r.runs;
    heads += r.heads;
    seconds += r.seconds;
    synth = synth || r.synth;
    hero = hero || r.hero;
    for (const [k, n] of Object.entries(r.usage)) usage[k] = (usage[k] || 0) + n;
    for (const k of Object.keys(bad)) for (const x of r[k]) bad[k].push(`${u} ${x}`);
  }
  const uniq = (a) => [...new Set(a.map((x) => x.replace(/^\S+ /, '')))].slice(0, 10).join(' | ');
  console.log(`\n${vp.label} ${vp.w}×${vp.h} · ${urls.length} sayfa · ${texts} metin öğesi · ${runs} yazı parçası · ${heads} başlık`);
  console.log(`  ⓘ kullanılan yüzler: ${Object.entries(usage).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(', ')}`);
  ok(bad.family.length === 0, `yalnızca Montserrat ve Open Sans${bad.family.length ? ` — başka aile ${bad.family.length}: ${uniq(bad.family)}` : ''}`);
  ok(heads > urls.length && bad.role.length === 0, `başlıklar (h1–h4) ve üst menü Montserrat, etiket biçimli başlıklar Open Sans${bad.role.length ? ` — ${bad.role.length}: ${uniq(bad.role)}` : ''}`);
  ok(!urls.includes('/') || (hero && hero.family === 'Montserrat' && hero.weight === '700'), `ana sayfa sloganı Montserrat 700 (${hero ? `${hero.family} ${hero.weight}` : 'yok'})`);
  ok(bad.body.length === 0, `düz metin paragrafları Open Sans${bad.body.length ? ` — ${bad.body.length}: ${uniq(bad.body)}` : ''}`);
  ok(runs >= texts && bad.run.length === 0, `bir yazının içi tek yazı tipi (satır içi bağlantı, kalın yazı, sayı, sözde öğe dahil)${bad.run.length ? ` — ${bad.run.length}: ${uniq(bad.run)}` : ''}`);
  ok(texts > urls.length * 20 && bad.italic.length === 0, `italik ya da eğik yazı yok${bad.italic.length ? ` — ${bad.italic.length}: ${uniq(bad.italic)}` : ''}`);
  ok(bad.mixed.length === 0, `başlıkların içindeki parçalar başlıkla aynı yazıda${bad.mixed.length ? ` — ${bad.mixed.length}: ${uniq(bad.mixed)}` : ''}`);
  ok(seconds > 0 && bad.second.length === 0, `iki satırlı başlıklarda (${seconds}) ikinci satır ilk satırla aynı: yazı, kalınlık, boy, renk${bad.second.length ? ` — farklı ${bad.second.length}: ${uniq(bad.second)}` : ''}`);
  const italicFiles = [...fonts].filter((f) => /italic/i.test(f));
  const foreign = [...fonts].filter((f) => !/^(montserrat|open-sans)-/.test(f));
  ok(fonts.size > 0 && italicFiles.length === 0 && foreign.length === 0, `yüklenen yazı tipi dosyaları düz Montserrat ve Open Sans (${[...fonts].map((f) => f.replace(/\.[0-9a-f]{8}\.woff2.*$/, '')).sort().join(', ')})`);
  ok(synth === 'none', `tarayıcı eğik taklidi üretmez (font-synthesis-style: ${synth})`);
  ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
