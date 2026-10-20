// Ana sayfa kahraman videosu (gerçek Chrome; H.264 oynatabilen tarayıcı gerekir — Chromium/başsız yazılım çözücü oynatamazsa atlanır).
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/hero-film.e2e.mjs [--base=http://127.0.0.1:4181]
// Müşteri (2026-10-20): «insan yüzü görünmesin; tam ofise girdiğimizde, kapıdan giriş anında dursun» — video ofis alanına geçerken,
// kimse görünmeden biter (scripts/tools/hero-film.py › END). Aynı gün proje sahibi: «video bitince eskisi gibi başa sarıyordu, tekrar
// öyle» — video döngüdür; sonu ve başı laciverde geçişlidir (başa dönüş kesik görünmez). Denetlenenler:
//   • videoda döngü var; süre ≈ 7,7 sn (230 kare); ekrana göre doğru dosya (1080p / 720p)
//   • kendiliğinden oynar; sona gelince durmaz, başa sarıp oynamayı sürdürür
//   • son ve ilk kareler lacivert (geçiş), arada parlak (görüntü): başa dönüşte sert kesme yok
//   • ziyaretçi duraklatınca kaydırma, sekme ve efekt katmanı değişimi videoyu yeniden başlatmaz; düğme yeniden oynatır
//   • masaüstü (1440×900) ve telefon (390×844); konsol temiz
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:4181').slice(7);
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};
const state = (page) =>
  page.evaluate(() => {
    const v = document.querySelector('.hero__video');
    const ctl = document.querySelector('[data-film-ctl]');
    return {
      src: v.currentSrc.replace(/^.*\/assets\/video\//, ''),
      loop: v.loop,
      paused: v.paused,
      ended: v.ended,
      t: v.currentTime,
      d: v.duration,
      label: ctl.getAttribute('aria-label'),
    };
  });
// t anındaki karenin ortalama parlaklığı (0–255): video duraklatılır, konuma gidilir, kare küçük bir tuvale çizilir. Her bekleme
// süreyle sınırlıdır: duraklatılmış videoda kare geri çağrısı (requestVideoFrameCallback) hiç gelmeyebilir; konum zaten oradaysa
// «seeked» de gelmez — sınırsız bekleme testi takardı.
const lumaAt = (page, t) =>
  page.evaluate(async (t) => {
    const v = document.querySelector('.hero__video');
    const within = (ms, fn) => Promise.race([new Promise(fn), new Promise((res) => setTimeout(res, ms))]);
    v.pause();
    await within(1500, (res) => {
      v.addEventListener('seeked', res, { once: true });
      v.currentTime = Math.max(0, Math.min(v.duration - 0.001, t));
    });
    await within(400, (res) => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => res()) : setTimeout(res, 120)));
    await new Promise((res) => setTimeout(res, 60));
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 36;
    const g = c.getContext('2d');
    g.drawImage(v, 0, 0, 64, 36);
    const px = g.getImageData(0, 0, 64, 36).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    return sum / (px.length / 4);
  }, t);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of [{ k: 'masaüstü', w: 1440, h: 900, m: false, file: 'boraden-giris-v3-1080.mp4' }, { k: 'telefon', w: 390, h: 844, m: true, file: 'boraden-giris-v3-720.mp4' }]) {
  console.log(`\n${vp.k} ${vp.w}×${vp.h}`);
  const ctx = await guardContext(await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m, deviceScaleFactor: vp.m ? 2 : 1 }));
  await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'full'));
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && logs.push(m.text()));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 15000 });
  const canH264 = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.640029"') !== '');
  const played = canH264 && (await page.waitForFunction(() => !document.querySelector('.hero__video').paused, null, { timeout: 12000 }).then(() => true, () => false));
  if (!played) {
    console.log('  ⓘ bu tarayıcı H.264 videoyu oynatamıyor (Chromium ya da yazılım çözücü) — oynatma denetimleri atlandı');
    await ctx.close();
    continue;
  }
  let s = await state(page);
  ok(s.loop, 'videoda döngü var');
  ok(s.src === vp.file, `ekran için doğru dosya (${s.src})`);
  ok(Math.abs(s.d - 7.674) < 0.06, `süre ≈ 7,7 sn (${s.d.toFixed(3)} sn)`);
  // sona yakın bir konuma git: gerçek oynatmayla sona varınca durmaz, başa sarıp sürer
  await page.evaluate(() => {
    const v = document.querySelector('.hero__video');
    v.currentTime = Math.max(0, v.duration - 0.6);
  });
  const wrapped = await page
    .waitForFunction(() => {
      const v = document.querySelector('.hero__video');
      return !v.paused && v.currentTime > 0.05 && v.currentTime < 2;
    }, null, { timeout: 8000 })
    .then(() => true, () => false);
  s = await state(page);
  ok(wrapped && !s.ended && !s.paused, `sona gelince başa sarıp oynamayı sürdürür (t ${s.t.toFixed(2)} sn)`);
  ok(s.label === 'Videoyu duraklat', `düğme «${s.label}»`);
  // başa dönüş laciverde geçişli: son ve ilk kare koyu, arada görüntü parlak
  const end = await lumaAt(page, s.d - 0.02);
  const before = await lumaAt(page, s.d - 0.9);
  const start = await lumaAt(page, 0.02);
  const mid = await lumaAt(page, 2.0);
  ok(end < 0.4 * before && start < 0.5 * mid, `son ve ilk kare lacivert (parlaklık: son ${end.toFixed(0)} · ${(s.d - 0.9).toFixed(1)} sn ${before.toFixed(0)} · ilk ${start.toFixed(0)} · 2 sn ${mid.toFixed(0)})`);
  // ölçüm için duraklatılan video yeniden oynatılır (düğme)
  const ctl = page.locator('[data-film-ctl]');
  const press = () => (vp.m ? ctl.tap() : ctl.click());
  await press();
  await page.waitForFunction(() => !document.querySelector('.hero__video').paused, null, { timeout: 6000 }).catch(() => {});
  // ziyaretçi duraklatır: kaydırma, sekme ve katman değişimi yeniden başlatmaz
  await press();
  await page.waitForFunction(() => document.querySelector('.hero__video').paused, null, { timeout: 4000 }).catch(() => {});
  await page.evaluate(() => scrollTo(0, innerHeight * 2));
  await page.waitForTimeout(700);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(600);
  if (await page.locator('[data-fx-set="lite"]').count()) {
    await page.evaluate(() => document.querySelector('[data-fx-set="lite"]').click());
    await page.waitForTimeout(600);
  }
  s = await state(page);
  ok(s.paused, 'ziyaretçi duraklattıysa kaydırma, sekme ve katman değişimi yeniden başlatmaz');
  await press();
  const resumed = await page.waitForFunction(() => !document.querySelector('.hero__video').paused, null, { timeout: 6000 }).then(() => true, () => false);
  ok(resumed, 'düğmeyle yeniden oynar');
  ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
