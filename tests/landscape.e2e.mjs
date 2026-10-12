// Yatay ekran denetimi (e2e): telefonlar ve tabletler yan çevrildiğinde düzen bozuluyor mu?
// Gerçek Chrome, dokunmatik cihaz öykünmesi (telefonlarda isMobile + hasTouch, tabletlerde hasTouch). Her sayfada:
//   • yatay taşma      — sayfa ekrandan geniş (yatay kaydırma çubuğu); taşan öğeler listelenir
//   • üst şerit        — sayfa ortasında üstte sabit/yapışkan öğelerin (başlık, «Bu sayfada» şeridi…) kapladığı yükseklik
//   • alt şerit        — altta sabit öğelerin kapladığı yükseklik
//   • başlık görünmüyor — sayfanın h1'i ilk ekranda görünmüyor ya da üst şeridin altında kalıyor
//   • menü             — mobil menü (ya da masaüstü açılır menü) ekrana sığmıyor ve kaydırılamıyor; son bağlantıya ulaşılamıyor
//   • sahne            — 3B sahne/tuval görünür alandan büyük ya da ekran genişliğine uymuyor
//   • döndürme         — dikeyde açılıp yataya çevrilen sayfada yukarıdakilerin hepsi yeniden (yeniden boyutlanmayı izliyor mu)
// Kullanım: node tests/landscape.e2e.mjs [--base=http://127.0.0.1:4181] [--all] [--only=/,/iletisim/] [--shots=dizin]
//           [--devices=844x390,1024x768] [--fx=off]
// --all: site haritasındaki tüm sayfalar (yalnızca hızlı denetimler); yoksa seçili sayfalar (menü + ekran görüntüsü dahil).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [m[1], m[2] ?? true];
  })
);
const base = String(args.base || 'http://127.0.0.1:4181').replace(/\/$/, '');
const SHOTS = args.shots ? String(args.shots) : '';

const DEVICES = [
  { name: 'iPhone SE yatay', w: 667, h: 375, phone: true, dpr: 2 },
  { name: 'iPhone 14 yatay', w: 844, h: 390, phone: true, dpr: 3 },
  { name: 'Pixel 7 yatay', w: 915, h: 412, phone: true, dpr: 2.6 },
  { name: 'iPhone Pro Max yatay', w: 932, h: 430, phone: true, dpr: 3 },
  { name: 'iPad yatay', w: 1024, h: 768, phone: false, dpr: 2 },
  { name: 'iPad Air yatay', w: 1180, h: 820, phone: false, dpr: 2 },
].filter((d) => !args.devices || String(args.devices).split(',').includes(`${d.w}x${d.h}`));

const KEY_PAGES = [
  '/',
  '/hizmetler/',
  '/hizmetler/vergi/',
  '/hizmetler/vergi/kdv-iade-islemleri/',
  '/sektorler/',
  '/sektorler/insaat-gayrimenkul-ve-altyapi/',
  '/hakkimizda/',
  '/hakkimizda/ekibimiz/',
  '/hakkimizda/ekibimiz/cengiz-turmaz/',
  '/kariyer/',
  '/iletisim/',
  '/bilgi-merkezi/',
  '/bilgi-merkezi/sozluk/',
  '/bilgi-merkezi/sss/',
  '/bilgi-merkezi/sektor-raporlari/',
  '/hesaplayicilar/',
  '/hesaplayicilar/maas-hesaplama/',
  '/vergi-takvimi/',
  '/arama/?q=kdv',
  '/yok-boyle-bir-sayfa/',
];

async function sitemapPages() {
  const res = await fetch(base + '/sitemap.xml');
  const xml = await res.text();
  const list = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  return [...new Set([...list, '/arama/?q=kdv', '/yok-boyle-bir-sayfa/'])];
}
const ALL = !!args.all;
const pages = args.only ? String(args.only).split(',') : ALL ? await sitemapPages() : KEY_PAGES;

// sayfa içinde: düzen ölçümleri
function measure() {
  const vw = document.documentElement.clientWidth;
  const vh = innerHeight;
  const label = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const visible = (el) => {
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // yatay taşma: sayfa genişliği ve kırpılmayan taşan öğeler
  const sw = document.documentElement.scrollWidth;
  const over = [];
  if (sw > vw + 1 || document.body.scrollWidth > vw + 1) {
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox !== 'visible') return true;
      }
      return false;
    };
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && r.width > 0 && visible(el) && !clipped(el) && getComputedStyle(el).position !== 'fixed') {
        over.push(`${label(el)} (${Math.round(r.left)}…${Math.round(r.right)})`);
        if (over.length > 6) break;
      }
    }
  }
  // sabit / yapışkan şeritler (görünür, ekranın üst ya da alt bandında)
  let top = 0;
  let bottom = 0;
  const bars = [];
  for (const el of document.body.querySelectorAll('*')) {
    const c = getComputedStyle(el);
    if (c.position !== 'fixed' && c.position !== 'sticky') continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh) continue;
    if (r.width < vw * 0.5) continue; // küçük düğmeler (yukarı çık vb.) şerit sayılmaz
    if (r.height >= vh * 0.95) continue; // tam ekran katmanlar (sahne arka planı vb.)
    if (c.position === 'sticky') {
      // yapışkan öğe gerçekten yapışmış mı (üstü top değerinde)
      const t = parseFloat(c.top);
      if (!(Number.isFinite(t) && Math.abs(r.top - t) < 2)) continue;
    }
    if (r.top < vh * 0.5) top = Math.max(top, r.bottom);
    else bottom = Math.max(bottom, vh - r.top);
    bars.push(`${label(el)} ${Math.round(r.top)}–${Math.round(r.bottom)}`);
  }
  const h1 = document.querySelector('h1');
  const h1r = h1 && visible(h1) ? h1.getBoundingClientRect() : null;
  const canv = [...document.querySelectorAll('canvas')].filter(visible).map((c) => {
    const r = c.getBoundingClientRect();
    return { el: label(c), w: Math.round(r.width), h: Math.round(r.height), bw: c.width, bh: c.height };
  });
  return {
    vw,
    vh,
    sw,
    over,
    top: Math.round(top),
    bottom: Math.round(bottom),
    bars,
    h1: h1r ? { top: Math.round(h1r.top + scrollY), bottom: Math.round(h1r.bottom + scrollY), text: h1.textContent.trim().slice(0, 40) } : null,
    canv,
    hdrHidden: document.documentElement.classList.contains('hdr-hidden'),
    sh: document.documentElement.scrollHeight,
  };
}

// mobil menü ya da masaüstü açılır menü ekrana sığıyor mu
async function menuCheck(page) {
  const out = [];
  const burger = page.locator('.hdr__burger');
  if (await burger.isVisible()) {
    await burger.click();
    await page.waitForTimeout(650);
    const r = await page.evaluate(() => {
      const m = document.getElementById('mnav');
      const c = getComputedStyle(m);
      const links = [...m.querySelectorAll('a,button')].filter((a) => a.getBoundingClientRect().height > 0);
      const last = links[links.length - 1];
      // menünün kaydırılabilir kutusu (kendisi ya da bir iç öğe)
      let sc = null;
      for (const el of [m, ...m.querySelectorAll('*')]) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          sc = el;
          break;
        }
      }
      if (sc) sc.scrollTop = sc.scrollHeight;
      const lr = last ? last.getBoundingClientRect() : null;
      return {
        open: c.visibility !== 'hidden' && c.display !== 'none',
        h: Math.round(m.getBoundingClientRect().height),
        sh: m.scrollHeight,
        scroller: sc ? sc.className || sc.tagName : null,
        last: last ? last.textContent.trim().slice(0, 30) : '',
        lastBottom: lr ? Math.round(lr.bottom) : 0,
        vh: innerHeight,
        bodyLocked: getComputedStyle(document.documentElement).overflow + '/' + getComputedStyle(document.body).overflow,
      };
    });
    if (!r.open) out.push('mobil menü açılmadı');
    else if (r.lastBottom > r.vh + 1) out.push(`mobil menü: son öğe «${r.last}» ekran dışında (${r.lastBottom} > ${r.vh}), kaydırma kutusu: ${r.scroller || 'yok'}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    const still = await page.evaluate(() => document.querySelector('.hdr__burger').getAttribute('aria-expanded'));
    if (still === 'true') {
      await burger.click();
      await page.waitForTimeout(450);
    }
    return { kind: 'mobil', r, out };
  }
  // masaüstü: açılır panelleri sırayla aç
  const panels = await page.$$eval('.nav__link[data-panel]', (l) => l.map((a) => a.dataset.panel));
  const res = [];
  for (const p of panels) {
    const link = page.locator(`.nav__link[data-panel="${p}"]`);
    if (!(await link.isVisible())) continue;
    await link.hover();
    await page.waitForTimeout(500);
    const r = await page.evaluate((id) => {
      const m = document.getElementById('mega-' + id);
      if (!m) return null;
      const c = getComputedStyle(m);
      const rr = m.getBoundingClientRect();
      const links = [...m.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().height > 0);
      const last = links[links.length - 1];
      let sc = null;
      for (const el of [m, ...m.querySelectorAll('*')]) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          sc = el;
          break;
        }
      }
      if (sc) sc.scrollTop = sc.scrollHeight;
      const lr = last ? last.getBoundingClientRect() : null;
      return {
        open: c.visibility !== 'hidden' && +c.opacity > 0.5,
        bottom: Math.round(rr.bottom),
        last: last ? last.textContent.trim().slice(0, 30) : '',
        lastBottom: lr ? Math.round(lr.bottom) : 0,
        scroller: sc ? sc.className : null,
        vh: innerHeight,
      };
    }, p);
    res.push({ p, r });
    if (r && r.open && r.lastBottom > r.vh + 1) out.push(`açılır menü «${p}»: son bağlantı «${r.last}» ekran dışında (${r.lastBottom} > ${r.vh})`);
    await page.mouse.move(5, page.viewportSize().height - 5);
    await page.waitForTimeout(350);
  }
  return { kind: 'masaüstü', res, out };
}

function judge(d, m, url, phase) {
  const issues = [];
  if (m.over.length || m.sw > m.vw + 1) issues.push(`yatay taşma ${m.sw - m.vw}px: ${m.over.join(', ') || '(öğe bulunamadı)'}`);
  if (phase === 'orta' && m.top > m.vh * 0.34) issues.push(`üst şerit ekranın %${Math.round((m.top / m.vh) * 100)}'i (${m.top}px): ${m.bars.join(' | ')}`);
  if (m.bottom > m.vh * 0.25) issues.push(`alt şerit ekranın %${Math.round((m.bottom / m.vh) * 100)}'i (${m.bottom}px): ${m.bars.join(' | ')}`);
  if (phase === 'üst' && m.h1 && m.h1.top > m.vh) issues.push(`h1 «${m.h1.text}» ilk ekranda değil (üstü ${m.h1.top}px, ekran ${m.vh}px)`);
  if (phase === 'üst' && m.h1 && m.h1.top < m.top - 1) issues.push(`h1 «${m.h1.text}» üst şeridin altında (${m.h1.top} < ${m.top})`);
  for (const c of m.canv) if (c.w > m.vw + 1) issues.push(`tuval ${c.el} ekrandan geniş (${c.w} > ${m.vw})`);
  return issues.map((t) => ({ url, dev: `${d.w}×${d.h}`, t }));
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal'] });
const found = [];
const notes = [];
async function ctxFor(d, vp) {
  const ctx = await guardContext(
    await browser.newContext({ viewport: vp || { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, isMobile: d.phone, hasTouch: true })
  );
  if (args.fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), String(args.fx));
  return ctx;
}
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

for (const d of DEVICES) {
  const ctx = await ctxFor(d);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]));
  for (const url of pages) {
    try {
      await page.goto(base + url, { waitUntil: 'load', timeout: 25000 });
    } catch (e) {
      found.push({ url, dev: `${d.w}×${d.h}`, t: 'açılamadı: ' + String(e.message).split('\n')[0] });
      continue;
    }
    await page.waitForTimeout(ALL ? 300 : 900);
    const slug = url.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'ana';
    if (SHOTS && !ALL) await page.screenshot({ path: path.join(SHOTS, `${d.w}x${d.h}-${slug}-1.png`) });
    found.push(...judge(d, await page.evaluate(measure), url, 'üst'));
    // sayfa ortasına in (aşağı kaydırma: başlık gizlenebilir), sonra biraz yukarı (başlık geri gelir) — iki durumda şeritler
    const sh = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y < sh * 0.5; y += Math.round(d.h * 0.8)) {
      await page.evaluate((yy) => scrollTo(0, yy), y);
      await page.waitForTimeout(ALL ? 40 : 90);
    }
    await page.waitForTimeout(400);
    found.push(...judge(d, await page.evaluate(measure), url, 'orta'));
    await page.evaluate(() => scrollBy(0, -Math.round(innerHeight * 0.4)));
    await page.waitForTimeout(500);
    const m2 = await page.evaluate(measure);
    found.push(...judge(d, m2, url, 'orta'));
    if (SHOTS && !ALL) await page.screenshot({ path: path.join(SHOTS, `${d.w}x${d.h}-${slug}-2.png`) });
    // sayfa sonu
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(ALL ? 200 : 500);
    found.push(...judge(d, await page.evaluate(measure), url, 'son'));
    if (!ALL && (url === '/' || url === '/iletisim/' || url === '/hizmetler/vergi/')) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(500);
      const mc = await menuCheck(page);
      for (const t of mc.out) found.push({ url, dev: `${d.w}×${d.h}`, t });
      notes.push(`${d.w}×${d.h} ${url} menü (${mc.kind}): ${JSON.stringify(mc.r || mc.res)}`);
      if (SHOTS && mc.kind === 'mobil') {
        await page.locator('.hdr__burger').click();
        await page.waitForTimeout(650);
        await page.screenshot({ path: path.join(SHOTS, `${d.w}x${d.h}-${slug}-menu.png`) });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
  }
  for (const e of new Set(errs)) found.push({ url: '*', dev: `${d.w}×${d.h}`, t: 'sayfa hatası: ' + e });
  await ctx.close();
}

// döndürme: dikeyde aç → yataya çevir → ölç → geri çevir
if (!ALL) {
  const ROT = [
    { phone: true, dpr: 3, a: [390, 844], b: [844, 390] },
    { phone: false, dpr: 2, a: [768, 1024], b: [1024, 768] },
  ];
  const rotPages = ['/', '/hizmetler/vergi/', '/hakkimizda/ekibimiz/', '/iletisim/', '/hesaplayicilar/maas-hesaplama/'];
  for (const r of ROT) {
    const ctx = await ctxFor({ phone: r.phone, dpr: r.dpr }, { width: r.a[0], height: r.a[1] });
    const page = await ctx.newPage();
    for (const url of rotPages) {
      await page.goto(base + url, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 1.2)));
      await page.waitForTimeout(400);
      await page.setViewportSize({ width: r.b[0], height: r.b[1] });
      await page.waitForTimeout(900);
      const m = await page.evaluate(measure);
      const d = { w: r.b[0], h: r.b[1] };
      for (const it of judge(d, m, url, 'orta')) found.push({ ...it, t: 'döndürme → ' + it.t });
      for (const c of m.canv) {
        // tuval CSS boyu yeni ekranla uyumlu mu, çizim tamponu güncellendi mi (boyut ≈ CSS × dpr; 0 ya da eski boy değil)
        if (c.bw && Math.abs(c.bw / c.w - c.bh / c.h) > 0.15) found.push({ url, dev: `${d.w}×${d.h}`, t: `döndürme → tuval ${c.el} en-boy oranı bozuk (CSS ${c.w}×${c.h}, tampon ${c.bw}×${c.bh})` });
      }
      notes.push(`döndürme ${r.a.join('×')}→${r.b.join('×')} ${url}: tuval ${JSON.stringify(m.canv)} üst ${m.top}`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `rot-${r.b[0]}x${r.b[1]}-${url.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'ana'}.png`) });
      await page.setViewportSize({ width: r.a[0], height: r.a[1] });
      await page.waitForTimeout(700);
      const m3 = await page.evaluate(measure);
      for (const it of judge({ w: r.a[0], h: r.a[1] }, m3, url, 'orta')) found.push({ ...it, t: 'geri döndürme → ' + it.t });
    }
    await ctx.close();
  }
}
await browser.close();

// aynı sorun birden çok cihazda: birleştir
const merged = new Map();
for (const f of found) {
  const k = `${f.url}|${f.t.replace(/\d+px|\(\d[^)]*\)|%\d+|\d+–\d+/g, '#')}`;
  const p = merged.get(k);
  if (p) p.devs.add(f.dev);
  else merged.set(k, { ...f, devs: new Set([f.dev]) });
}
console.log(`Yatay ekran denetimi — ${pages.length} sayfa × ${DEVICES.length} cihaz`);
for (const n of notes) if (args.verbose) console.log('  · ' + n);
for (const f of merged.values()) console.log(`  ✘ ${f.url} · ${f.t} · ${[...f.devs].join(', ')}`);
console.log(merged.size ? `\n✖ ${merged.size} sorun` : '\n✔ sorun yok');
process.exit(merged.size ? 1 : 0);
