// İçerik güvenlik politikası (CSP) taraması — yayındaki başlıklarla: sunucu vercel.json'u uygular ve canlı alan adını
// (www.boraden.com.tr) öykünür, yani katı politika denenir. Tüm sayfalar tam yüklemeyle gezilir, ardından etkileşimler:
// yönlendirici geçişleri, 3B dünya ve açılış sahnesi, efekt anahtarı (masaüstü ve mobil menü), hızlı KDV ve 11 hesaplayıcı
// (Enter ile gönderim yok), arama, sözlük, sirküler arşivi, SSS, sektör matrisi, vergi takvimi (.ics), film, iletişim
// formu taslağı, 404 ve eski site yönlendirmesi. Her ihlal (securitypolicyviolation olayı, konsoldaki CSP iletisi ya da
// CSP'nin engellediği istek) testi düşürür. Önce iki bilinçli ihlalle politikanın gerçekten etkin olduğu doğrulanır.
//
// Gerçek gönderim yok: bağlamlar guardContext ile sarılı (mailto/tel gezinmesi iptal edilir), pano ve yazdırma taklit edilir.
// Çalıştırma: BORADEN_DIST=<derleme> node tests/csp.e2e.mjs   (kendi sunucusunu rastgele bir kapıda açar)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from '../scripts/serve.mjs';
import { guardContext } from './safe-context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
const LIVE_HOST = 'www.boraden.com.tr';

const server = serve({ root: DIST, port: 0, quiet: true, host: LIVE_HOST });
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

// Sayfa listesi derleme çıktısından: her index.html bir adres; 404 için olmayan bir adres
const pages = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (rel === '' && e.name === 'assets') continue;
      walk(path.join(dir, e.name), `${rel}/${e.name}`);
    } else if (e.name === 'index.html') pages.push(`${rel}/`);
  }
})(DIST, '');
pages.sort();
pages.push('/olmayan-sayfa-csp/');

const violations = [];
let expectViolations = false;
const expected = [];
const record = (v) => (expectViolations ? expected : violations).push(v);

const GL = process.platform === 'darwin' ? 'metal' : 'swiftshader';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', `--use-angle=${GL}`, '--enable-unsafe-swiftshader'] });

async function newContext(opts) {
  const ctx = await guardContext(await browser.newContext(opts));
  await ctx.exposeBinding('__cspReport', ({ page }, v) => record({ page: page.url(), ...v }));
  await ctx.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__cspReport({ directive: e.violatedDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber, sample: e.sample })
    );
    // az çekirdekli test makinesinde de (bulut) 3B dünya kurulsun: site 2 çekirdek ve altını «efektsiz» sayar
    if ((navigator.hardwareConcurrency || 8) <= 2) Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 });
    if ((navigator.deviceMemory || 8) <= 1) Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 });
    window.__copies = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => window.__copies.push(t) }, configurable: true });
    window.print = () => (window.__printed = (window.__printed || 0) + 1);
  });
  return ctx;
}

function watch(page, label) {
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect|frame|create)/i.test(m.text())) record({ page: page.url(), console: m.text().slice(0, 300), label });
  });
  page.on('requestfailed', (r) => {
    if (/BLOCKED_BY_CSP/i.test(r.failure()?.errorText || '')) record({ page: page.url(), blocked: r.url(), label });
  });
  page.on('pageerror', (e) => record({ page: page.url(), pageerror: e.message, label }));
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += Math.round(innerHeight * 0.85)) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 35));
    }
    scrollTo(0, h());
    await new Promise((r) => setTimeout(r, 120));
    scrollTo(0, 0);
  });
}

// Sayfadaki görünür düğmelere birer kez bas (gönder düğmeleri ve dış gezinmeler hariç); açılan katmanı Escape ile kapat
async function pressButtons(page, limit = 40) {
  const handles = await page.$$('main button:not(form button), .hdr button, .ftr button');
  let n = 0;
  for (const b of handles) {
    if (n >= limit) break;
    if (!(await b.isVisible().catch(() => false))) continue;
    await b.click({ timeout: 2000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    n++;
  }
  return n;
}

const t0 = Date.now();
let interactions = 0;
let crawled = 0;
const step = (s) => {
  interactions++;
  if (process.env.CSP_VERBOSE) console.log('  ·', s);
};

try {
  // 0) Sunucu yayındaki başlıkları veriyor mu?
  const head = await fetch(base + '/');
  const csp = head.headers.get('content-security-policy') || '';
  assert.ok(csp.includes("default-src 'self'") && csp.includes('sha256-'), 'sunucu vercel.json CSP başlığını uygulamıyor');
  assert.equal(head.headers.get('x-robots-tag'), null, 'canlı alan adında noindex olmamalı');
  assert.ok(!csp.includes('vercel.live'), 'canlı alan adında katı politika beklenir');

  const desk = await newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desk.newPage();
  page.setDefaultTimeout(15000);
  watch(page, 'masaüstü');

  // 1) Politika etkin mi? İki bilinçli ihlal: satır içi olay işleyicisi ve dış bağlantı
  await page.goto(base + '/', { waitUntil: 'load' });
  expectViolations = true;
  await page.evaluate(() => {
    const i = document.createElement('img');
    i.setAttribute('onerror', 'window.__inline = 1');
    i.src = 'data:,';
    document.body.append(i);
    fetch('https://example.invalid/csp-yoklama').catch(() => {});
  });
  await page.waitForTimeout(600);
  expectViolations = false;
  assert.equal(await page.evaluate(() => window.__inline), undefined, 'satır içi işleyici çalışmamalıydı');
  assert.ok(expected.some((v) => /script-src/.test(v.directive || '')), 'satır içi işleyici ihlali yakalanmadı');
  assert.ok(expected.some((v) => /connect-src/.test(v.directive || '')), 'dış bağlantı ihlali yakalanmadı');
  console.log(`PASS: politika etkin (bilinçli ihlaller yakalandı: ${[...new Set(expected.map((v) => v.directive).filter(Boolean))].join(', ')})`);

  // 2) Tüm sayfalar: tam yükleme + kaydırma (CSP_CRAWL=0: yalnızca etkileşimler — hata ayıklarken)
  for (const p of process.env.CSP_CRAWL === '0' ? [] : pages) {
    const res = await page.goto(base + p, { waitUntil: 'load' });
    assert.ok(res && (res.status() === 200 || (p.startsWith('/olmayan') && res.status() === 404)), `${p} → ${res && res.status()}`);
    await scrollThrough(page);
    await page.waitForTimeout(250);
    crawled++;
  }
  if (crawled) console.log(`PASS: ${crawled} sayfa tam yüklemeyle gezildi — ihlal ${violations.length}`);

  // 3) Açılış sahnesi + 3B dünya (efektler tam)
  await page.evaluate(() => localStorage.setItem('boraden-fx', 'full'));
  await page.goto(base + '/?intro', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('fx-live'), null, { timeout: 20000 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-opening'), null, { timeout: 20000 });
  step('açılış sahnesi ve dünya');

  // 4) Hızlı KDV: Enter sayfayı göndermez
  await page.evaluate(() => (window.__stay = 1));
  const amount = page.locator('[data-mini="kdv"] input[name="amount"]');
  await amount.scrollIntoViewIfNeeded();
  await amount.fill('12.500');
  await amount.press('Enter');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__stay), 1, 'hızlı KDV: Enter sayfayı yeniden yükledi');
  assert.equal(new URL(page.url()).search, '?intro', 'hızlı KDV: adres değişmemeli');
  assert.notEqual((await page.textContent('[data-mini="kdv"] [data-out="gross"]')).trim(), '—');
  step('hızlı KDV Enter');

  // 5) Film ve efekt anahtarı
  // film denetimi efektler açıkken kaydırmaya bağlı sahnede yer değiştirir: düğmeye doğrudan basılır (işleyici aynı)
  await page.locator('#film').scrollIntoViewIfNeeded();
  const film = page.locator('[data-film-ctl]');
  await film.evaluate((b) => b.click());
  await page.waitForFunction(() => !document.querySelector('.film__video').paused, null, { timeout: 8000 });
  await film.evaluate((b) => b.click());
  step('film');
  for (const tier of ['off', 'lite', 'full']) {
    await page.locator(`[data-fx-set="${tier}"]:visible`).click();
    await page.waitForFunction((t) => document.documentElement.dataset.fx === t, tier);
    await page.waitForTimeout(300);
    step(`efekt ${tier}`);
  }
  await page.waitForFunction(() => document.documentElement.classList.contains('fx-live'), null, { timeout: 20000 });

  // 6) Yönlendirici geçişleri (dünya açıkken) ve geri/ileri
  const swaps = ['/hizmetler/', '/hizmetler/vergi/', '/hizmetler/vergi/kdv-iade-islemleri/', '/sektorler/', '/bilgi-merkezi/', '/hesaplayicilar/', '/iletisim/', '/'];
  for (const href of swaps) {
    // bağlantı önce sayfa içeriğinde, sonra altbilgide aranır (üstbilgideki «Hizmetler» menü panelini de açar);
    // tıklama olayı doğrudan gönderilir: yönlendirici belge düzeyinde dinler, üstbilgi kaydırınca gizlenebilir
    const found = await page.evaluate((h) => {
      window.__swapMark = h;
      const a = ['main', '.ftr', 'body'].map((s) => document.querySelector(`${s} a[href="${h}"]`)).find(Boolean);
      if (!a) return false;
      a.click();
      return true;
    }, href);
    assert.ok(found, `${href}: sayfada bağlantı yok`);
    await page.waitForFunction((h) => location.pathname === h, href);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__swapMark !== undefined), true, `${href}: yönlendirici yerine tam yükleme oldu`);
    step(`geçiş ${href}`);
  }
  await page.goBack();
  await page.waitForTimeout(600);
  await page.goForward();
  await page.waitForTimeout(600);
  step('geri/ileri');

  // 7) Hesaplayıcılar: Enter gönderim yapmaz; kopyala/yazdır düğmeleri
  const calcs = pages.filter((p) => /^\/hesaplayicilar\/[^/]+\/$/.test(p));
  for (const p of calcs) {
    await page.goto(base + p, { waitUntil: 'load' });
    await page.waitForSelector('[data-calc-form] input, [data-calc-form] select');
    await page.evaluate(() => (window.__stay = 1));
    const before = new URL(page.url()).pathname;
    const field = page.locator('[data-calc-form] input[type="text"]:visible, [data-calc-form] input[inputmode]:visible').first();
    if (await field.count()) {
      await field.focus();
      await field.press('Enter');
    } else {
      await page.locator('[data-calc-form]').evaluate((f) => f.requestSubmit());
    }
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.__stay), 1, `${p}: Enter sayfayı yeniden yükledi`);
    assert.equal(new URL(page.url()).pathname, before, `${p}: adres değişmemeli`);
    await page.click('[data-copy-link]').catch(() => {});
    await page.click('[data-print]').catch(() => {});
    step(`hesaplayıcı ${p}`);
  }
  console.log(`PASS: ${calcs.length} hesaplayıcı — Enter gönderim yapmıyor`);

  // 8) Modül sayfaları: arama, sözlük, SSS, sirküler arşivi, sektörler, bilgi merkezi, kariyer, hukuki metin, vergi takvimi
  await page.goto(base + '/arama/?q=kdv', { waitUntil: 'load' });
  await page.fill('#sr-q', 'bordro');
  await page.press('#sr-q', 'Enter');
  await page.waitForTimeout(500);
  step('arama');
  for (const p of ['/bilgi-merkezi/sozluk/', '/bilgi-merkezi/sss/', '/bilgi-merkezi/sirkulerler/', '/sektorler/', '/bilgi-merkezi/', '/kariyer/', '/yasal/gizlilik-politikasi/', '/hakkimizda/']) {
    await page.goto(base + p, { waitUntil: 'load' });
    const input = page.locator('main input[type="search"]:visible, main input[type="text"]:visible').first();
    if (await input.count()) {
      await input.fill('vergi');
      await page.waitForTimeout(250);
      await input.fill('');
    }
    const n = await pressButtons(page);
    await page.waitForTimeout(200);
    step(`${p} (${n} düğme)`);
  }
  const cal = pages.find((p) => p.includes('vergi-takvimi'));
  if (cal) {
    await page.goto(base + cal, { waitUntil: 'load' });
    const ics = page.locator('[data-cal-ics]:visible').first();
    if (await ics.count()) {
      const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await ics.click();
      assert.ok(await dl, 'vergi takvimi: .ics indirmesi başlamadı');
    }
    await pressButtons(page);
    step('vergi takvimi (.ics)');
  }

  // 9) İletişim formu: taslak (mailto gezinmesi guardContext ile iptal edilir; gerçek e-posta uygulaması açılmaz)
  await page.goto(base + '/iletisim/?hizmet=kdv-iade-islemleri', { waitUntil: 'load' });
  await page.fill('#ct-f-ad', 'Test Kullanıcısı');
  await page.fill('#ct-f-eposta', 'test@example.invalid');
  await page.fill('#ct-f-mesaj', 'CSP taraması — deneme metni.');
  await page.check('#ct-f-kvkk-onay');
  await page.click('.ct-submit');
  await page.waitForSelector('[data-fk-done]:not([hidden])');
  await page.click('[data-fk-copy]').catch(() => {});
  step('iletişim taslağı');

  // 10) 404 ve eski site yönlendirmesi (2 adım: eğik çizgi, sonra yeni adres)
  const nf = await page.goto(base + '/olmayan-sayfa-csp/', { waitUntil: 'load' });
  assert.equal(nf.status(), 404);
  await pressButtons(page, 10);
  step('404');
  await page.goto(base + '/bordrolama', { waitUntil: 'load' });
  assert.equal(new URL(page.url()).pathname, '/hizmetler/muhasebe/bordrolama/', 'eski adres yönlendirmesi');
  step('eski adres → yeni adres');
  // elle yazılmış büyük harfli / Türkçe karakterli adres: 404 sayfası doğru yazıma taşır (T-36; HEAD isteği CSP'ye uygun)
  for (const [from, to] of [
    ['/HIZMETLER/VERGI/', '/hizmetler/vergi/'],
    ['/hakkımızda/?k=1', '/hakkimizda/'],
    ['/Bordrolama/', '/hizmetler/muhasebe/bordrolama/'],
  ]) {
    await page.goto(base + from, { waitUntil: 'load' });
    await page.waitForURL((u) => u.pathname === to, { timeout: 8000 });
    if (from.includes('?')) assert.equal(new URL(page.url()).search, '?k=1', 'sorgu korunur');
    step(`404 düzeltmesi ${from} → ${to}`);
  }
  await page.goto(base + '/olmayan-sayfa-csp/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  assert.equal(new URL(page.url()).pathname, '/olmayan-sayfa-csp/', 'karşılığı olmayan adreste 404 kalır');

  // 11) Örnek sayfalarda tüm düğmeler (hizmet, sektör, not, ekip, hesaplayıcı listesi)
  for (const p of ['/', '/hizmetler/', '/hizmetler/denetim/bagimsiz-denetim/', pages.find((x) => /^\/sektorler\/[^/]+\/$/.test(x)), pages.find((x) => /^\/bilgi-merkezi\/blog\/[^/]+\/$/.test(x)), '/hakkimizda/ekibimiz/', pages.find((x) => /^\/hakkimizda\/ekibimiz\/[^/]+\/$/.test(x)), '/hesaplayicilar/'].filter(Boolean)) {
    const r = await page.goto(base + p, { waitUntil: 'load' });
    if (r.status() !== 200) continue;
    const n = await pressButtons(page);
    step(`${p} (${n} düğme)`);
  }

  // 12) Mobil: menü, menüdeki efekt anahtarı, menüden geçiş
  const mob = await newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mob.newPage();
  m.setDefaultTimeout(15000);
  watch(m, 'mobil');
  await m.goto(base + '/', { waitUntil: 'load' });
  await m.click('.hdr__burger');
  await m.waitForSelector('#mnav', { state: 'visible' });
  for (const tier of ['off', 'full']) {
    await m.locator(`#mnav [data-fx-set="${tier}"]`).click();
    await m.waitForFunction((t) => document.documentElement.dataset.fx === t, tier);
  }
  await m.locator('#mnav a[href="/sektorler/"]').first().click();
  await m.waitForFunction(() => location.pathname === '/sektorler/');
  await m.waitForTimeout(800);
  step('mobil menü');
  await mob.close();
  await desk.close();
} finally {
  await browser.close();
  server.close();
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (violations.length) {
  console.log(`FAIL: ${violations.length} ihlal / hata (${crawled} sayfa, ${interactions} etkileşim, ${secs} sn)`);
  for (const v of violations.slice(0, 40)) console.log('  ✘', JSON.stringify(v));
  process.exit(1);
}
console.log(`PASS: CSP ihlali yok — ${crawled} sayfa, ${interactions} etkileşim (${secs} sn)`);
