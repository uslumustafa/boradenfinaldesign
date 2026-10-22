// Ana sayfa kahramanı: videonun her anında yazıların okunurluğu (gerçek Chrome; H.264 oynatabilen tarayıcı gerekir — Chromium/başsız
// yazılım çözücü videoyu oynatamazsa atlanır). Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/hero-contrast.e2e.mjs [--base=http://127.0.0.1:4181] [--step=0.75] [--shots=klasör]
//   (--shots: her ekran ve yazı için en zor karenin zemini PNG olarak yazılır — gözle doğrulama)
// Neden: kahramanın zemini ofis videosudur ve yazılar videonun üstündedir; koyulaşma (50-home.css › .hero__media::after) videonun en
// parlak karelerine göre ayarlanır. 22 Ekim 2026'dan beri video ofisin içini gösteren aydınlık fotoğraflarla sürer (beyaz tavanlar,
// pencereler) — her yeni kurguda yeniden ölçülmeli. Yöntem: video `step` saniyede bir durdurulur, yazılar saydamlaştırılıp zemin
// (video + koyulaşma; çerçeveli düğmede düğmenin kendi yarı saydam zemini) ekrandan alınır; her yazı kutusunun arkasındaki zeminin %95'lik en parlak noktası yazı rengiyle karşılaştırılır (WCAG
// göreli parlaklık). Denetlenen en düşük oranlar, tüm kareler ve ekranlar boyunca:
//   • başlık «Tam ✓ doğru ✓ zamanında ✓» ≥ 7:1 (büyük yazı için WCAG AAA 4,5:1'in çok üstü; videonun en parlak anında da)
//   • alt metin, üst etiket ve çerçeveli düğme ≥ 4,5:1 (WCAG AA)
//   • masaüstü 1024–2560 px, dikey telefon 320–430 px, dikey tablet, yan çevrilmiş telefon
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { guardContext, driverNoise } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const STEP = Number(arg('step', '0.75'));
const SHOTS = arg('shots', '');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const MIN = { title: 7, text: 4.5, eyebrow: 4.5, ghost: 4.5 };
const NAMES = { title: 'başlık', text: 'alt metin', eyebrow: 'üst etiket', ghost: 'çerçeveli düğme' };
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const VIEWPORTS = [
  { k: 'masaüstü', w: 1024, h: 768 },
  { k: 'masaüstü', w: 1280, h: 720 },
  { k: 'masaüstü', w: 1440, h: 900 },
  { k: 'masaüstü', w: 1920, h: 1080 },
  { k: 'masaüstü', w: 2560, h: 1440 },
  { k: 'dikey telefon', w: 320, h: 568, m: true },
  { k: 'dikey telefon', w: 390, h: 844, m: true },
  { k: 'dikey telefon', w: 430, h: 932, m: true },
  { k: 'dikey tablet', w: 834, h: 1194, m: true },
  { k: 'yatay telefon', w: 667, h: 375, m: true },
  { k: 'yatay telefon', w: 844, h: 390, m: true },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
// ekran görüntüsünü çözmek ve parlaklığı hesaplamak için ayrı, boş bir sayfa (bağımlılık yok: tarayıcının kendi PNG çözücüsü)
const lab = await browser.newPage();
const measure = (png, boxes) =>
  lab.evaluate(
    async ({ b64, boxes }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const lin = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const out = {};
      for (const [k, list] of Object.entries(boxes)) {
        let worst = 0;
        for (const r of list) {
          const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
          const w = Math.min(c.width - x, Math.ceil(r.w)), h = Math.min(c.height - y, Math.ceil(r.h));
          if (w < 2 || h < 2) continue;
          const px = g.getImageData(x, y, w, h).data;
          const L = [];
          for (let i = 0; i < px.length; i += 16) L.push(0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]));
          L.sort((a, b) => a - b);
          worst = Math.max(worst, L[Math.floor(L.length * 0.95)] ?? 0);
        }
        out[k] = worst;
      }
      return out;
    },
    { b64: png.toString('base64'), boxes },
  );

const results = {};
for (const vp of VIEWPORTS) {
  const label = `${vp.k} ${vp.w}×${vp.h}`;
  const ctx = await guardContext(await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, deviceScaleFactor: 1 }));
  await ctx.addInitScript(() => {
    localStorage.setItem('boraden-fx', 'full');
    sessionStorage.setItem('boraden-opened', '1');
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && logs.push(m.text()));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 15000 });
  const canH264 = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.640029"') !== '');
  const played = canH264 && (await page.waitForFunction(() => !document.querySelector('.hero__video').paused, null, { timeout: 12000 }).then(() => true, () => false));
  if (!played) {
    console.log(`\n${label}\n  ⓘ bu tarayıcı H.264 videoyu oynatamıyor (Chromium ya da yazılım çözücü) — ölçüm atlandı`);
    await ctx.close();
    continue;
  }
  // yazı kutuları ve renkleri (giriş animasyonu bitmiş, sayfa en üstte)
  await page.waitForTimeout(2600);
  const info = await page.evaluate(() => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
    // yazının kendisinin kapladığı satır kutuları (esnek sütundaki etiket ve paragraf satır boyunca uzar; boş kısmı sayılmaz)
    const lines = (e) => {
      const rg = document.createRange();
      rg.selectNodeContents(e);
      return [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1).map(box);
    };
    const pick = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
    const title = pick('.hero__title .line > span');
    const text = pick('.hero__text');
    const eyebrow = pick('.hero__eyebrow');
    const ghost = pick('.hero__btns .btn--ghost');
    const color = (list) => (list[0] ? rgb(getComputedStyle(list[0]).color) : [255, 255, 255]);
    return {
      // başlık satırları (tik dahil) ve çerçeveli düğme kutusuyla; etiket ve alt metin yazının satır kutularıyla
      // çerçeveli düğmenin kendi zemini ölçüme girer, 1 px çerçevesi girmez (kutu 2 px içeriden)
      boxes: {
        title: title.map((e) => box(e.getBoundingClientRect())),
        text: text.flatMap(lines),
        eyebrow: eyebrow.flatMap(lines),
        ghost: ghost.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.left + 2, y: r.top + 2, w: r.width - 4, h: r.height - 4 };
        }),
      },
      colors: { title: color(title), text: color(text), eyebrow: color(eyebrow), ghost: color(ghost) },
      d: document.querySelector('.hero__video').duration,
    };
  });
  // yazılar saydamlaşır (tikler ve çizgiler dahil): ekrandan yalnızca zemin alınır — video + koyulaşma + düğmenin kendi zemini
  await page.addStyleTag({
    content:
      '.hero__inner, .hero__inner *, .hero__inner *::before, .hero__inner *::after { color: transparent !important; text-shadow: none !important }' +
      ' .hero__ctl, .hero__scroll { visibility: hidden !important } .hero__video { transition: none !important }',
  });
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const worst = {};
  for (let t = 0.05; t < info.d - 0.05; t += STEP) {
    await page.evaluate(async (t) => {
      const v = document.querySelector('.hero__video');
      const within = (ms, fn) => Promise.race([new Promise(fn), new Promise((res) => setTimeout(res, ms))]);
      v.pause();
      await within(1500, (res) => {
        v.addEventListener('seeked', res, { once: true });
        v.currentTime = t;
      });
      await within(400, (res) => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => res()) : setTimeout(res, 120)));
    }, t);
    await page.waitForTimeout(40);
    const png = await page.screenshot({ type: 'png' });
    const bg = await measure(png, info.boxes);
    for (const k of Object.keys(MIN)) {
      if (!info.boxes[k].length) continue;
      const fg = lum(info.colors[k]);
      const ratio = (Math.max(fg, bg[k]) + 0.05) / (Math.min(fg, bg[k]) + 0.05);
      if (!worst[k] || ratio < worst[k].ratio) worst[k] = { ratio, t, png };
    }
  }
  console.log(`\n${label} · ${Math.floor((info.d - 0.1) / STEP) + 1} kare (${STEP} sn arayla, süre ${info.d.toFixed(1)} sn)`);
  for (const k of Object.keys(MIN)) {
    if (!worst[k]) continue;
    ok(worst[k].ratio >= MIN[k], `${NAMES[k]}: en düşük ${worst[k].ratio.toFixed(2)}:1 (${worst[k].t.toFixed(2)} sn) ≥ ${MIN[k]}:1`);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, `${vp.w}x${vp.h}-${k}-${worst[k].t.toFixed(2)}.png`), worst[k].png);
    results[k] = Math.min(results[k] ?? Infinity, worst[k].ratio);
  }
  ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
if (Object.keys(results).length) console.log(`\nen düşük oranlar (tüm ekranlar): ${Object.entries(results).map(([k, v]) => `${NAMES[k]} ${v.toFixed(2)}:1`).join(' · ')}`);
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
