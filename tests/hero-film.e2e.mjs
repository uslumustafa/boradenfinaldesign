// Ana sayfa kahraman videosu (gerçek Chrome; H.264 oynatabilen tarayıcı gerekir — Chromium/başsız yazılım çözücü oynatamazsa atlanır).
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/hero-film.e2e.mjs [--base=http://127.0.0.1:4181]
// Müşteri (2026-10-20): «insan yüzü görünmesin; tam ofise girdiğimizde, kapıdan giriş anında dursun» — video ofis alanına geçerken,
// kimse görünmeden biter (scripts/tools/hero-film.py › END) ve SON KAREDE DURUR (döngü yok; modules/hero-film.js). Denetlenenler:
//   • videoda döngü yok; süre ≈ 7,7 sn (230 kare)
//   • kendiliğinden oynar, sona gelince durur: duraklatılmış, «ended», son karede (poster gizli, video görünür); düğme «Videoyu oynat»
//   • sona geldikten sonra kaydırıp geri gelmek, sekme gizleyip göstermek ve efekt katmanı değişimi videoyu yeniden başlatmaz
//   • düğmeye basınca baştan oynar (son kareden değil); bir daha sona gelince yine durur
//   • masaüstü (1440×900, 1080p dosya) ve telefon (390×844, 720p dosya); konsol temiz
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
      hasVideo: document.querySelector('.hero').classList.contains('has-video'),
      label: ctl.getAttribute('aria-label'),
    };
  });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of [{ k: 'masaüstü', w: 1440, h: 900, m: false, file: 'boraden-giris-v2-1080.mp4' }, { k: 'telefon', w: 390, h: 844, m: true, file: 'boraden-giris-v2-720.mp4' }]) {
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
  ok(!s.loop, 'videoda döngü yok');
  ok(s.src === vp.file, `ekran için doğru dosya (${s.src})`);
  ok(Math.abs(s.d - 7.674) < 0.06, `süre ≈ 7,7 sn (${s.d.toFixed(3)} sn)`);
  // sona sar: gerçek oynatmayla son 0,6 sn
  await page.evaluate(() => {
    const v = document.querySelector('.hero__video');
    v.currentTime = Math.max(0, v.duration - 0.6);
  });
  const ended = await page.waitForFunction(() => document.querySelector('.hero__video').ended, null, { timeout: 8000 }).then(() => true, () => false);
  s = await state(page);
  ok(ended && s.paused && s.t >= s.d - 0.05, `sona gelince durur, son karede (t ${s.t.toFixed(3)} / ${s.d.toFixed(3)})`);
  ok(s.hasVideo, 'son kare görünür kalır (poster yerine video)');
  ok(s.label === 'Videoyu oynat', `düğme «${s.label}»`);
  // kaydır, geri gel; sekme gizle/göster; efekt katmanı değiştir — yeniden başlamaz
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
  const fxBtn = page.locator('[data-fx-set="lite"]').first();
  if (await fxBtn.count()) {
    await page.evaluate(() => document.querySelector('[data-fx-set="lite"]').click());
    await page.waitForTimeout(600);
  }
  s = await state(page);
  ok(s.paused && s.ended && s.t >= s.d - 0.05, `kaydırma, sekme ve katman değişimi yeniden başlatmaz (t ${s.t.toFixed(3)})`);
  // düğme: baştan oynar
  const ctl = page.locator('[data-film-ctl]');
  if (vp.m) await ctl.tap();
  else await ctl.click();
  await page.waitForFunction(() => !document.querySelector('.hero__video').paused, null, { timeout: 6000 }).catch(() => {});
  s = await state(page);
  // düğme etiketi «playing» olayıyla güncellenir (oynatma başlayınca)
  await page.waitForFunction(() => document.querySelector('[data-film-ctl]').getAttribute('aria-label') === 'Videoyu duraklat', null, { timeout: 4000 }).catch(() => {});
  s.label = (await state(page)).label;
  ok(!s.paused && s.t < 2.5, `düğmeye basınca baştan oynar (t ${s.t.toFixed(3)} sn)`);
  ok(s.label === 'Videoyu duraklat', `düğme «${s.label}»`);
  // bir daha sona gelince yine durur
  await page.evaluate(() => {
    const v = document.querySelector('.hero__video');
    v.currentTime = Math.max(0, v.duration - 0.4);
  });
  const again = await page.waitForFunction(() => document.querySelector('.hero__video').ended, null, { timeout: 8000 }).then(() => true, () => false);
  s = await state(page);
  ok(again && s.paused, 'ikinci kez de sonunda durur');
  ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
