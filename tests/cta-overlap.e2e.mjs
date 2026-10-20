// Kapanış çağrı bandı («Size nasıl yardımcı olabiliriz?»; 20 Ekim 2026'ya dek «Görüşelim»): 3B şekil bandın yazısına binmiyor, dar ekranda
// kırpılmıyor — gerçek Chrome + dünyanın kendi kamerası.
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/cta-overlap.e2e.mjs [--base=http://127.0.0.1:4181] [--report]
// Müşteri geri bildirimi (2026-10-20): «Görüşelim kısmını beğenmediler, daha uygun 3B şekil» — kemer ve yol (`kapi`) yerine iki konuşma
// balonu (`diyalog`). Yöntem tests/hero-overlap.e2e.mjs ile aynı: şeklin noktaları world.js › pose ile ekrana izdüşürülür; salınımın
// uçları ve fare paralaksı dahil her evrede, bandın yazı kutularına (üst etiket, başlık, öz, düğmeler, iletişim satırları; 6 px pay)
// düşen nokta sayılır. Bant üç kaydırma konumunda denetlenir (bandın üstü ekranın üstünde, bant ortada, sayfanın sonu); şeklin yüksekliği
// yönetmenin (behaviors.js › director) hesabıyla bandın görünen kısmının ortasına hizalanır.
//   • iki sütunlu düzen (> 900 px ya da yan çevrilmiş telefon, en-boy ≥ 1,5): yazıya düşen nokta ≤ %0,2
//   • dar düzen (dikey telefon/tablet: şekil ortada, yazının arkasında ve sönük — tasarım gereği): ekran dışında kalan nokta ≤ %2
// Sayfalar: başlığı kısa ve uzun olanlar (ana sayfa «Size nasıl yardımcı olabiliriz?», hizmet, sektörler «Sektörünüze özgü ihtiyaçlarınızı
// değerlendirelim», ekip «Sizi doğru uzmana yönlendirelim», kişi «… ile görüşme talep edin», hesaplayıcı «Kesin hesaplama için uzmanlarımıza danışın»).
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';
import { buildFormation, FORMATIONS, POSES, SPIN, SWAY } from '../src/assets/js/world/formations.js';
import { clamp, smoothstep } from '../src/assets/js/util.js';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const REPORT = process.argv.includes('--report');
const PAGES = ['/', '/hizmetler/vergi/kdv-iade-islemleri/', '/sektorler/', '/hakkimizda/ekibimiz/', '/hakkimizda/ekibimiz/cengiz-turmaz/', '/hesaplayicilar/kidem-tazminati-hesaplama/'];
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
/** k sahnesinin noktaları W×H ekranda (CSS px), dönüş açısı a, yükseklik kayması lift (director). */
function project(k, F, W, H, a, lift) {
  const camera = new PerspectiveCamera(48, W / H, 0.1, 400);
  const twoCol = W > 900 || (W > 600 && W / H >= 1.5);
  const ctx = vm.createContext({
    POSES, SPIN, SWAY, clamp, smoothstep, camera, points: { rotation: new Euler() }, aspect: W / H, twoCol, side: 1, lift,
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
  return out;
}
// salınımın uçları (SWAY·0,6) ve fare paralaksı (±0,1 rad)
const anglesOf = (k) => {
  if (!(SWAY[k] > 0)) return SPIN[k] ? Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2) : [0];
  const m = SWAY[k] * 0.6 + 0.1;
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
    let worst = 0;
    let by = {};
    let where = '';
    let id = '';
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const pos of ['start', 'center', 'end']) {
      const info = await page.evaluate((pos) => {
        const cta = document.querySelector('#iletisim-cagri');
        if (pos === 'end') scrollTo(0, document.documentElement.scrollHeight);
        else cta.scrollIntoView({ block: pos });
        const vh = innerHeight;
        const r = cta.getBoundingClientRect();
        const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        const cy = (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2;
        const boxes = [];
        const add = (el, tag) => {
          if (!el) return;
          const rg = document.createRange();
          rg.selectNodeContents(el);
          for (const b of rg.getClientRects()) if (b.width > 2 && b.height > 2) boxes.push({ tag, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
        };
        add(cta.querySelector('.eyebrow'), 'üst etiket');
        add(cta.querySelector('h2'), 'başlık');
        add(cta.querySelector('.lead'), 'öz');
        cta.querySelectorAll('.cta__btns .btn').forEach((b) => {
          const q = b.getBoundingClientRect();
          boxes.push({ tag: 'düğme', x0: q.left, y0: q.top, x1: q.right, y1: q.bottom });
        });
        cta.querySelectorAll('.cta__side dd, .cta__side dt').forEach((x) => add(x, 'iletişim'));
        return {
          scene: Number(cta.dataset.world),
          boxes,
          lift: Math.min(0.45, Math.max(-0.45, (vh / 2 - cy) / vh)),
          cover: vis / Math.max(1, Math.min(vh, r.height)),
          sw: document.documentElement.scrollWidth,
        };
      }, pos);
      if (info.cover < 0.4) continue; // şekil toplanmaz (world.js › FORM_COVER)
      const k = info.scene;
      id = FORMATIONS[k]?.id;
      const F = formation(k);
      for (const a of anglesOf(k)) {
        const pts = project(k, F, W, H, a, info.lift);
        let n = 0;
        const hit = {};
        for (let j = 0; j < F.nf; j++) {
          const x = pts[j * 2];
          const y = pts[j * 2 + 1];
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
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
          where = pos;
        }
      }
      ok(info.sw <= W, `${url} (${pos}): yatay taşma yok (${info.sw} ≤ ${W})`);
    }
    if (REPORT) console.log(`    ${url} ${id}: şekil x ${bounds[0].toFixed(0)}…${bounds[2].toFixed(0)}, y ${bounds[1].toFixed(0)}…${bounds[3].toFixed(0)}`);
    if (narrow) ok(worst <= MAX_OUT, `${url} (${id}): ekran dışında %${(worst * 100).toFixed(1)}`);
    else ok(worst <= MAX_TEXT, `${url} (${id}): yazıya düşen nokta %${(worst * 100).toFixed(2)}${worst > 0 ? ` (${where}) ${JSON.stringify(by)}` : ''}`);
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
