// Ana sayfa başlığı: denetçi tikleri («Tam ✓ doğru ✓ zamanında ✓») — gerçek Chrome, Playwright.
// Çalışan bir sunucu gerekir (npm run dev ya da BORADEN_DIST=… PORT=… node scripts/serve.mjs).
//   node tests/hero.e2e.mjs [--base=http://127.0.0.1:4181] [--only=draw|tiers|a11y|layout]
// Denetlenenler:
//   draw   — Tam katman: son tik başlangıçta çizilmemiştir; tikler satır sırasıyla (mavi → kırmızı → yeşil) çizilir, hepsi 4 sn içinde tamamlanır
//   tiers  — Kapalı ve azaltılmış hareket: tikler baştan çizili (animasyon yok)
//   a11y   — tek h1, adı slogandır; satırlar ve tikler süstür (aria-hidden); satır sayısı slogandan türer
//   layout — 1440 ve 390 px: tik kendi satırının içinde (kırpılmaz, alta kaymaz), taşma yok; konsol/HTTP temiz
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
import { loadData } from '../scripts/build.mjs';
import { taglineWords } from '../scripts/filters.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ONLY = arg('only', '');
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) fails++;
};

const TAGLINE = loadData().site.tagline;
const WORDS = taglineWords(TAGLINE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function newPage({ w = 1440, h = 900, mobile = false, fx = 'full', reduced = false } = {}) {
  // guardContext: mailto:/tel: gezinmeleri işletim sistemine gitmesin (bkz. safe-context.mjs)
  const ctx = await guardContext(
    await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' }),
  );
  if (fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), fx); // fx=null: kayıtlı tercih yok
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && logs.push(`[http ${r.status()}] ${r.url()}`));
  page.on('requestfailed', (r) => !/ERR_ABORTED/.test(r.failure()?.errorText || '') && logs.push(`[failed] ${r.url()}`));
  return { ctx, page, logs };
}
async function open(page) {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 8000 });
}

// her tikin sağdan kırpma oranı (% — 100: hiç çizilmemiş, 0: tam çizili); clip-path yoksa 0
const REVEAL_FN = () => {
  const ps = [...document.querySelectorAll('.hero__title .p')];
  return ps.map((p) => {
    const m = getComputedStyle(p).clipPath;
    const v = m.match(/inset\(([^)]*)\)/);
    if (!v) return 0;
    const parts = v[1].trim().split(/\s+/);
    return parseFloat(parts.length === 1 ? parts[0] : parts[1]) || 0;
  });
};

async function draw() {
  console.log('Tikler (1440×900, Tam)');
  const { ctx, page, logs } = await newPage();
  await open(page);
  const res = await page.evaluate(
    (fnSrc) =>
      new Promise((resolve) => {
        const read = new Function('return (' + fnSrc + ')')();
        const first = read();
        const done = first.map(() => null);
        const t0 = performance.now();
        const step = () => {
          const now = read();
          now.forEach((r, i) => {
            if (done[i] == null && r <= 0.5) done[i] = Math.round(performance.now() - t0);
          });
          if (done.every((x) => x != null) || performance.now() - t0 > 6000) resolve({ first, done });
          else requestAnimationFrame(step);
        };
        step();
      }),
    REVEAL_FN.toString(),
  );
  // (yoğun makinede ilk tik başlamış olabilir; en geç çizilecek olan sonuncunun henüz çizilmemiş olması beklenir)
  ok(res.first.length === WORDS.length && res.first[res.first.length - 1] >= 99, `${res.first.length} tikten sonuncusu başlangıçta çizilmemiş (${res.first.map((r) => r.toFixed(0) + '%').join(', ')})`);
  ok(res.done.every((x) => x != null && x < 4000), `hepsi 4 sn içinde çizilir (${res.done.join(' → ')} ms)`);
  ok(res.done.every((x, i) => i === 0 || x != null && x > res.done[i - 1]), 'tikler satır sırasıyla çizilir (1. → 2. → 3.)');
  // renkler: marka üçlüsü (açık tonlar), her satırda farklı
  const colors = await page.evaluate(() => {
    const probe = (v) => {
      const e = document.createElement('i');
      e.style.color = `var(${v})`;
      document.body.appendChild(e);
      const c = getComputedStyle(e).color;
      e.remove();
      return c;
    };
    return {
      got: [...document.querySelectorAll('.hero__title .p')].map((p) => getComputedStyle(p).color),
      want: ['--b-blue-2', '--b-red-2', '--b-green-2'].map(probe),
    };
  });
  ok(colors.got.slice(0, 3).every((c, i) => c === colors.want[i]) && new Set(colors.got).size === Math.min(3, colors.got.length), `tik renkleri mavi · kırmızı · yeşil (${colors.got.join(' | ')})`);
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

async function tiers() {
  console.log('Kapalı ve azaltılmış hareket: tikler baştan çizili');
  for (const [fx, reduced, label] of [['off', false, 'Kapalı'], [null, true, 'azaltılmış hareket']]) {
    const { ctx, page } = await newPage({ fx, reduced });
    await open(page);
    await page.waitForTimeout(150);
    const r = await page.evaluate(REVEAL_FN);
    ok(r.length === WORDS.length && r.every((x) => x <= 0.5), `${label}: ${r.length} tik beklemeden çizili (${r.map((x) => x.toFixed(0) + '%').join(', ')})`);
    await ctx.close();
  }
  // Hafif katmanda da çizilir
  const { ctx, page } = await newPage({ fx: 'lite' });
  await open(page);
  await page.waitForTimeout(3600);
  const r = await page.evaluate(REVEAL_FN);
  ok(r.every((x) => x <= 0.5), `Hafif: 3,6 sn sonra tüm tikler çizili (${r.map((x) => x.toFixed(0) + '%').join(', ')})`);
  await ctx.close();
}

async function a11y() {
  console.log('Erişilebilirlik');
  const { ctx, page } = await newPage({ fx: 'off' });
  await open(page);
  const s = await page.evaluate(() => {
    const h1s = [...document.querySelectorAll('h1')];
    const h = document.querySelector('.hero__title');
    return {
      n: h1s.length,
      label: h.getAttribute('aria-label'),
      lines: [...h.querySelectorAll('.line')].map((l) => ({ hidden: l.getAttribute('aria-hidden') === 'true', text: l.textContent.trim() })),
      ticks: [...h.querySelectorAll('.p')].map((p) => p.getAttribute('aria-hidden') === 'true' && p.textContent === ''),
    };
  });
  ok(s.n === 1 && s.label === TAGLINE, `tek h1; adı slogandır («${s.label}»)`);
  ok(s.lines.length === WORDS.length && s.lines.every((l, i) => l.hidden && l.text === WORDS[i]), `satırlar sloganın öbeklerinden türer ve süstür (${s.lines.map((l) => l.text).join(' · ')})`);
  ok(s.ticks.length === WORDS.length && s.ticks.every(Boolean), 'tikler süstür: aria-hidden, metin içermez (okuyucuya «işaret» okunmaz)');
  const named = await page.getByRole('heading', { level: 1, name: TAGLINE }).count();
  ok(named === 1, 'erişilebilirlik ağacında başlık adı slogandır');
  await ctx.close();
}

async function layout() {
  console.log('Yerleşim: tik kendi satırında');
  for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
    const { ctx, page, logs } = await newPage({ w, h, mobile, fx: 'off' });
    await open(page);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const lines = [...document.querySelectorAll('.hero__title .line')];
      return lines.map((l) => {
        const p = l.querySelector('.p').getBoundingClientRect();
        const word = l.firstElementChild.getBoundingClientRect();
        const box = l.getBoundingClientRect();
        return {
          w: Math.round(p.width),
          h: Math.round(p.height),
          inside: p.left >= box.left - 0.5 && p.right <= box.right + 0.5 && p.top >= box.top - 0.5 && p.bottom <= box.bottom + 0.5,
          sameRow: p.top >= word.top - 1 && p.bottom <= word.bottom + 1 && p.left >= word.left,
        };
      });
    });
    const dx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(r.every((x) => x.inside && x.sameRow && x.w >= 12 && x.h >= 9), `${w} px: ${r.length} tik satırının içinde ve kelimeyle aynı hizada (${r.map((x) => x.w + '×' + x.h).join(', ')})`);
    ok(dx === 0, `${w} px: yatay taşma yok`);
    ok(logs.length === 0, `${w} px: konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  }
}

try {
  if (!ONLY || ONLY === 'draw') await draw();
  if (!ONLY || ONLY === 'tiers') await tiers();
  if (!ONLY || ONLY === 'a11y') await a11y();
  if (!ONLY || ONLY === 'layout') await layout();
} catch (e) {
  fails++;
  console.log('  ✘ HATA', e.message.split('\n')[0]);
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
