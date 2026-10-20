// Sayfa kahramanı: 3B şekil yazının üstüne binmiyor ve dar ekranda kırpılmıyor — gerçek Chrome + dünyanın kendi kamera yerleşimi.
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/hero-overlap.e2e.mjs [--base=http://127.0.0.1:4181] [--set=vergi|sektorler|hepsi]
// Müşteri geri bildirimi (2026-10-16): Vergi hizmetlerinin şekilleri yeniden çizildi («buraya uygun, daha belirgin, net görünen»);
// web, mobil ve yatay ekranda denetlenir. Yöntem: şeklin noktaları world.js › pose (scripts/scene-reach.mjs ile aynı VM dilimi) ile
// ekrana izdüşürülür; salınımın uçları ve fare paralaksı (±0,1 rad) dahil her evrede, sayfadaki yazı satırlarının kutularına
// (Range.getClientRects; sayfa yolu, üst etiket, başlık, öz; 6 px pay) düşen nokta sayılır.
//   • iki sütunlu düzen (> 900 px ya da yan çevrilmiş telefon, en-boy ≥ 1,5): 1920×1080 … 667×375 — yazıya düşen nokta ≤ %0,2
//   • dar düzen (dikey telefon/tablet: şekil ortada, yazının arkasında ve sönük — tasarım gereği): ekran dışında kalan nokta ≤ %2
// Sayfa kümesi (--set): vergi (varsayılan; test:e2e zincirinde) — yedi Vergi hizmeti; sektorler — on sektör sayfası (20 Ekim 2026, müşteri:
// «şekiller sektörle doğrudan bağlantılı olmalı»: kasa, fabrika, rüzgâr türbini, mağaza, iletişim kulesi, ilaç, vinç, otel, aile, kamu
// binası; npm run test:sectors ile); hepsi — ikisi birden.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';
import { buildFormation, FORMATIONS, POSES, SPIN, SWAY } from '../src/assets/js/world/formations.js';
import { clamp, smoothstep } from '../src/assets/js/util.js';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:4181').slice(7);
const SETS = {
  vergi: [
    '/hizmetler/vergi/tam-tasdik-islemleri/',
    '/hizmetler/vergi/kdv-iade-islemleri/',
    '/hizmetler/vergi/kurumlar-vergisi-denetim-ve-tasdik/',
    '/hizmetler/vergi/transfer-fiyatlandirma/',
    '/hizmetler/vergi/diger-dolayli-vergiler/',
    '/hizmetler/vergi/otv-hizmetleri/',
    '/hizmetler/vergi/bireysel-danismanlik-hizmetleri/',
  ],
  sektorler: [
    'finansal-hizmetler', 'uretim-ve-sanayi', 'enerji-ve-dogal-kaynaklar', 'perakende-tuketici-ve-gida', 'teknoloji-medya-ve-telekom', 'saglik-ve-ilac',
    'insaat-gayrimenkul-ve-altyapi', 'turizm-ulastirma-ve-lojistik', 'aile-sirketleri-ve-kobiler', 'kamu-ve-sivil-toplum',
  ].map((s) => `/sektorler/${s}/`),
};
const SET = (process.argv.find((a) => a.startsWith('--set=')) || '--set=vergi').slice(6);
const PAGES = SET === 'hepsi' ? [...SETS.vergi, ...SETS.sektorler] : SETS[SET];
if (!PAGES) throw new Error(`bilinmeyen sayfa kümesi: ${SET} (vergi, sektorler, hepsi)`);
const TWO = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1100, 800], [1024, 768], [960, 600], [932, 430], [844, 390], [740, 360], [667, 375]];
const NARROW = [[320, 568], [360, 740], [390, 844], [412, 915], [768, 1024]];
const MAX_TEXT = 0.002;
const MAX_OUT = 0.02;

let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const src = await readFile(new URL('../src/assets/js/world/world.js', import.meta.url), 'utf8');
const poseSource = src.slice(src.indexOf('  function pose('), src.indexOf('  function frame('));
if (!poseSource.startsWith('  function pose(')) throw new Error('world.js › pose bulunamadı');
/** k sahnesinin noktaları W×H ekranda (CSS px), dönüş açısı a. */
function project(k, F, W, H, a) {
  const camera = new PerspectiveCamera(48, W / H, 0.1, 400);
  const twoCol = W > 900 || (W > 600 && W / H >= 1.5);
  const ctx = vm.createContext({
    POSES, SPIN, SWAY, clamp, smoothstep, camera, points: { rotation: new Euler() }, aspect: W / H, twoCol, side: 1, lift: 0,
    pointer: { x: 0, y: 0 }, time: 0, camPos: new Vector3(), camLook: new Vector3(), material: { uniforms: { uBright: { value: 1 } } },
  });
  vm.runInContext(`${poseSource}\npose(${k}, ${k}, 0);`, ctx);
  camera.updateMatrixWorld();
  const view = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const e = new Matrix4().multiplyMatrices(view, new Matrix4().makeRotationY(a)).elements;
  const out = new Float32Array(F.nf * 2);
  for (let j = 0; j < F.nf; j++) {
    const x = F.pos[j * 3];
    const y = F.pos[j * 3 + 1];
    const z = F.pos[j * 3 + 2];
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    out[j * 2] = (((e[0] * x + e[4] * y + e[8] * z + e[12]) / w + 1) / 2) * W;
    out[j * 2 + 1] = ((1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / w) / 2) * H;
  }
  return { pts: out, twoCol };
}
const anglesOf = (k) => {
  if (!(SWAY[k] > 0)) return SPIN[k] ? Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2) : [0];
  const m = SWAY[k] + 0.1;
  return Array.from({ length: 9 }, (_, i) => -m + (2 * m * i) / 8);
};
const cache = new Map();
const formation = (k) => cache.get(k) || (cache.set(k, buildFormation(k, 4000)), cache.get(k));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [W, H] of [...TWO, ...NARROW]) {
  const narrow = !(W > 900 || (W > 600 && W / H >= 1.5));
  console.log(`\n${W}×${H} ${narrow ? '(dar düzen: kırpılma)' : '(iki sütun: yazı çakışması)'}`);
  const ctx = await guardContext(await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 960, hasTouch: W < 1100 }));
  await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'lite'));
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !driverNoise(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  for (const url of PAGES) {
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
    const info = await page.evaluate(() => {
      const boxes = [];
      const add = (el, tag) => {
        if (!el) return;
        const r = document.createRange();
        r.selectNodeContents(el);
        for (const b of r.getClientRects()) if (b.width > 2 && b.height > 2) boxes.push({ tag, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
      };
      document.querySelectorAll('.phero .crumbs li').forEach((li) => add(li, 'sayfa yolu'));
      add(document.querySelector('.phero .eyebrow'), 'üst etiket');
      add(document.querySelector('.phero h1'), 'başlık');
      add(document.querySelector('.phero__lead'), 'öz');
      return { scene: Number(document.querySelector('.phero').dataset.world), boxes, sw: document.documentElement.scrollWidth };
    });
    const k = info.scene;
    const id = FORMATIONS[k]?.id;
    const F = formation(k);
    let worst = 0;
    let by = {};
    for (const a of anglesOf(k)) {
      const { pts } = project(k, F, W, H, a);
      let n = 0;
      const hit = {};
      for (let j = 0; j < F.nf; j++) {
        const x = pts[j * 2];
        const y = pts[j * 2 + 1];
        if (narrow) {
          if (x < 0 || x > W) n++;
          continue;
        }
        const b = info.boxes.find((q) => x > q.x0 - 6 && x < q.x1 + 6 && y > q.y0 - 6 && y < q.y1 + 6);
        if (b) {
          n++;
          hit[b.tag] = (hit[b.tag] || 0) + 1;
        }
      }
      if (n / F.nf > worst) {
        worst = n / F.nf;
        by = hit;
      }
    }
    const name = url.split('/').filter(Boolean).pop();
    if (narrow) ok(worst <= MAX_OUT, `${name} (${id}): ekran dışında %${(worst * 100).toFixed(1)}`);
    else ok(worst <= MAX_TEXT, `${name} (${id}): yazıya düşen nokta %${(worst * 100).toFixed(2)}${worst > 0 ? ' ' + JSON.stringify(by) : ''}`);
    ok(info.sw <= W, `${name}: yatay taşma yok (${info.sw} ≤ ${W})`);
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
