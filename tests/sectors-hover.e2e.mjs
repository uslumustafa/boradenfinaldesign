// Ana sayfa «Sektörler» bandı: fareyle bir sektörün üzerine gelince 3B şekil o sektörün şekline döner (gerçek Chrome).
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/sectors-hover.e2e.mjs [--base=http://127.0.0.1:4181]
// Müşteri (2026-10-20): «Sektörlerde tek 1 tane 3B şekil var; buradakilere uygun şekiller olması gerekiyordu; öbür sayfalarda olduğu gibi
// mouse ile üzerine geldiğinde o sektörün şekli olması gerekiyor». Şekiller sektör sayfalarının kendi şekilleridir (scenes.mjs ›
// SECTOR_SHAPE; satırda data-world-shape), bandın şekli matris. Denetlenenler:
//   1 · Yerleşim (dünyanın kendi kamerasıyla izdüşüm, world.js › pose; bant bağlamalı yükseklik — data-world-anchor): matris ve her
//       sektörün şekli solda kalır; bandın yazısına (tanım yazısı — o sektörün tanımıyla —, «Tüm sektörler», başlık, liste) düşen nokta
//       ≤ %0,2; salınımın uçları dahil; bant dört kaydırma konumunda (üstü ekranın üstünde, ortada, altı ekranın altında, üstü ekranın
//       %25'inde). İki sütunlu masaüstü düzeni (> 900 px) ile yan çevrilmiş telefon ve küçük yatay pencere (601–900 px, en-boy ≥ 1,5:
//       sayfa tek sütun, şekil solda, liste sağ yarıda; tanım yazısı gizli, şekil görünen bandın ortasına hizalanır). Dikey telefonda
//       şekil ortada, yazının arkasında söner (tasarım gereği; bu denetimin dışında).
//   2 · Etkileşim (Tam katman): satırın üzerine gelince — kaydırma olmadan — bandın hedefi o sektörün şekli olur ve dönüşüm başlar
//       (uMix); hızlı geçişte aradaki satırların şekli istenmez, yalnızca imlecin durduğu satırınki; listeden çıkınca bandın şekline
//       döner; kısa süreli çıkışta şekil değişmez; klavyeyle odaklanınca (Shift+Tab) şekil değişir, odak listeden çıkınca geri döner;
//       dokunmatik dokunuş şekli değiştirmez (yalnızca tanım); «Kapalı» katmanda hedef yazılmaz; konsol temiz.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';
import { buildFormation, FORMATIONS, POSES, SPIN, SWAY, SCENE } from '../src/assets/js/world/formations.js';
import { clamp, smoothstep } from '../src/assets/js/util.js';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:4181').slice(7);
const TWO = [[1920, 1080], [1512, 982], [1440, 900], [1366, 768], [1280, 720], [1100, 800], [1024, 768], [960, 600], [880, 560], [844, 390], [740, 360], [667, 375]];
const MAX_TEXT = 0.002;
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const src = await readFile(new URL('../src/assets/js/world/world.js', import.meta.url), 'utf8');
const poseSource = src.slice(src.indexOf('  function pose('), src.indexOf('  function frame('));
if (!poseSource.startsWith('  function pose(')) throw new Error('world.js › pose bulunamadı');
function project(k, F, W, H, a, lift) {
  const camera = new PerspectiveCamera(48, W / H, 0.1, 400);
  const twoCol = W > 900 || (W > 600 && W / H >= 1.5);
  const ctx = vm.createContext({
    POSES, SPIN, SWAY, clamp, smoothstep, camera, points: { rotation: new Euler() }, aspect: W / H, twoCol, side: -1, lift,
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
const anglesOf = (k) => {
  if (!(SWAY[k] > 0)) return SPIN[k] ? Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2) : [0];
  const m = SWAY[k] * 0.6 + 0.1;
  return Array.from({ length: 7 }, (_, i) => -m + (2 * m * i) / 6);
};
const cache = new Map();
const formation = (k) => cache.get(k) || (cache.set(k, buildFormation(k, 3000)), cache.get(k));

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ── 1 · Yerleşim
console.log('1 · Yerleşim: şekiller solda, bandın yazısına binmez');
for (const [W, H] of TWO) {
  const ctx = await guardContext(await browser.newContext({ viewport: { width: W, height: H } }));
  await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'lite'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
  // her sahne için (bandın şekli: tanım yazısı varsayılan; sektörün şekli: tanım o sektörünki) ve her kaydırma konumunda yazı kutuları
  const sets = await page.evaluate(async () => {
    const sec = document.querySelector('#sektorler');
    const cap = sec.querySelector('[data-sectors-cap]');
    const rows = [...sec.querySelectorAll('.sectorlist .sector')];
    const scenes = [{ scene: Number(sec.dataset.world), short: null }, ...rows.map((a) => ({ scene: Number(a.dataset.worldShape), short: a.dataset.short }))];
    const out = [];
    const def = cap.textContent;
    for (const sc of scenes) {
      cap.textContent = sc.short || def;
      for (const pos of ['start', 'center', 'end', 'partial']) {
        if (pos === 'partial') {
          sec.scrollIntoView({ block: 'start' });
          scrollBy(0, -innerHeight * 0.25);
        } else sec.scrollIntoView({ block: pos });
        const vh = innerHeight;
        const r = sec.getBoundingClientRect();
        // director: bant bağlamalı (data-world-anchor="band", > 900 px) → bandın ortası
        const cy = sec.dataset.worldAnchor === 'band' && innerWidth > 900 ? r.top + r.height / 2 : (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2;
        const boxes = [];
        const add = (el, tag) => {
          if (!el) return;
          const rg = document.createRange();
          rg.selectNodeContents(el);
          for (const b of rg.getClientRects()) if (b.width > 2 && b.height > 2) boxes.push({ tag, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
        };
        add(cap, 'tanım');
        add(sec.querySelector('.sectors__more a'), 'tüm sektörler');
        add(sec.querySelector('.sectors__head'), 'başlık');
        rows.forEach((a) => {
          const q = a.getBoundingClientRect();
          boxes.push({ tag: 'liste', x0: q.left, y0: q.top, x1: q.right, y1: q.bottom });
        });
        out.push({ scene: sc.scene, pos, lift: Math.min(0.45, Math.max(-0.45, (vh / 2 - cy) / vh)), boxes });
      }
    }
    cap.textContent = def;
    return out;
  });
  const worst = new Map();
  for (const S of sets) {
    const F = formation(S.scene);
    for (const a of anglesOf(S.scene)) {
      const pts = project(S.scene, F, W, H, a, S.lift);
      let n = 0;
      const hit = {};
      for (let j = 0; j < F.nf; j++) {
        const x = pts[j * 2];
        const y = pts[j * 2 + 1];
        const b = S.boxes.find((q) => x > q.x0 - 6 && x < q.x1 + 6 && y > q.y0 - 6 && y < q.y1 + 6);
        if (b) {
          n++;
          hit[b.tag] = (hit[b.tag] || 0) + 1;
        }
      }
      const w = worst.get(S.scene) || { v: 0 };
      if (n / F.nf > w.v) worst.set(S.scene, { v: n / F.nf, hit, pos: S.pos });
      else if (!worst.has(S.scene)) worst.set(S.scene, w);
    }
  }
  const bad = [...worst].filter(([, w]) => w.v > MAX_TEXT);
  const max = Math.max(...[...worst.values()].map((w) => w.v));
  ok(worst.size === 9 && bad.length === 0, `${W}×${H}: ${worst.size} şekil (matris + 8 sektör) · yazıya düşen en çok %${(max * 100).toFixed(2)}${bad.length ? ' — ' + bad.map(([k, w]) => `${FORMATIONS[k].id} %${(w.v * 100).toFixed(2)} (${w.pos}) ${JSON.stringify(w.hit)}`).join(' | ') : ''}`);
  await ctx.close();
}

// ── 2 · Etkileşim
console.log('\n2 · Etkileşim (1440×900, Tam)');
const ctx = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
await ctx.addInitScript(() => {
  localStorage.setItem('boraden-fx', 'full');
  // uMix gözlemcisi: dönüşüm ilerlemesi (0 → 1); kayıt açıkken her değer yazılır
  const names = new WeakMap();
  const u = (window.__mix = { rec: null });
  for (const P of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    const getLoc = P.getUniformLocation;
    P.getUniformLocation = function (prog, name) {
      const loc = getLoc.call(this, prog, name);
      if (loc) names.set(loc, name);
      return loc;
    };
    const set1f = P.uniform1f;
    P.uniform1f = function (loc, v) {
      if (u.rec && loc && names.get(loc) === 'uMix') u.rec.push(v);
      return set1f.call(this, loc, v);
    };
  }
});
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && logs.push(m.text()));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__boraden === true, null, { timeout: 15000 });
await page.evaluate(() => document.querySelector('#sektorler').scrollIntoView({ block: 'center' }));
await page.waitForTimeout(2500); // dünya yüklenir, bandın şekli toplanır
const info = await page.evaluate(() => {
  const sec = document.querySelector('#sektorler');
  // hedef değişimlerinin kaydı (MutationObserver: data-world-force)
  window.__force = [];
  new MutationObserver(() => window.__force.push(sec.dataset.worldForce ?? null)).observe(sec, { attributes: true, attributeFilter: ['data-world-force'] });
  return { rows: [...sec.querySelectorAll('.sectorlist .sector')].map((a) => ({ shape: Number(a.dataset.worldShape), href: a.getAttribute('href') })), band: Number(sec.dataset.world) };
});
ok(info.rows.length === 8 && info.rows.every((r) => Number.isInteger(r.shape)), `sekiz satırın her birinde şekil (${info.rows.map((r) => FORMATIONS[r.shape]?.id).join(', ')})`);
ok(new Set(info.rows.map((r) => r.shape)).size === 8 && !info.rows.some((r) => r.shape === info.band), 'her sektörün kendi şekli (tekrar yok, bandın şekli değil)');
const center = async (i) => {
  const b = await page.locator('#sektorler .sector').nth(i).boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};
const force = () => page.evaluate(() => document.querySelector('#sektorler').dataset.worldForce ?? null);
const scrollY0 = await page.evaluate(() => scrollY);
// tek satır: hedef + dönüşüm (kaydırma olmadan)
await page.evaluate(() => (window.__mix.rec = []));
let [x, y] = await center(2);
await page.mouse.move(x, y, { steps: 4 });
await page.waitForTimeout(450);
const mix = await page.evaluate(() => window.__mix.rec.slice());
ok((await force()) === String(info.rows[2].shape), `satırın üzerine gelince hedef o sektörün şekli (${FORMATIONS[info.rows[2].shape].id})`);
ok(mix.some((v) => v > 0.02), `dönüşüm başlar — kaydırma olmadan (uMix en çok ${Math.max(0, ...mix).toFixed(2)})`);
ok((await page.evaluate(() => scrollY)) === scrollY0, 'sayfa kaymadı');
await page.waitForTimeout(900);
// hızlı geçiş: imleç satırlarda kısa kalır (satır merkezleri önceden ölçülür; sayfada her satıra giriş anı kaydedilir) — yalnızca
// imlecin durduğu son satırın şekli istenir. Sürücü yavaşsa ve imleç bir satırda SECTOR_INTENT (120 ms) kadar kaldıysa o satırın şekli
// de beklenir (kalış süreleri iletide); bu durumda deneme kısa kalışlarla bir kez yinelenir.
const INTENT = 120;
const fast = async () => {
  const pts = [];
  for (let i = 3; i < 8; i++) pts.push(await center(i));
  await page.evaluate(() => {
    window.__force = [];
    window.__over = [];
    const rows = [...document.querySelectorAll('#sektorler .sector')];
    window.__overFn = (e) => {
      const a = e.target.closest?.('.sector');
      if (a && window.__over.at(-1)?.i !== rows.indexOf(a)) window.__over.push({ i: rows.indexOf(a), t: performance.now() });
    };
    document.querySelector('#sektorler .sectorlist').addEventListener('pointerover', window.__overFn);
  });
  for (const [px, py] of pts) {
    await page.mouse.move(px, py);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    document.querySelector('#sektorler .sectorlist').removeEventListener('pointerover', window.__overFn);
    return { seq: window.__force.slice(), over: window.__over.slice() };
  });
};
let run = await fast();
const dwell = (r) => r.over.slice(0, -1).map((o, j) => ({ i: o.i, ms: r.over[j + 1].t - o.t }));
if (dwell(run).some((d) => d.ms >= INTENT - 10)) run = await fast();
const long = dwell(run).filter((d) => d.ms >= INTENT - 10).map((d) => String(info.rows[d.i].shape));
const expect = [...long, String(info.rows[7].shape)];
ok(
  run.over.length === 5 && run.over.at(-1).i === 7 && run.seq.length === expect.length && run.seq.every((v, j) => v === expect[j] || (long.length && long.includes(v))),
  `hızlı geçişte yalnızca imlecin durduğu satırın şekli (${run.seq.map((v) => (v === null ? 'bant' : FORMATIONS[Number(v)].id)).join(' → ') || 'değişim yok'} · satırda kalış ${dwell(run).map((d) => Math.round(d.ms)).join('/')} ms)`,
);
[x, y] = await center(7);
// kısa süreli çıkış (≈ 80 ms) şekli değiştirmez
await page.evaluate(() => (window.__force = []));
const listBox = await page.locator('#sektorler .sectorlist').boundingBox();
await page.mouse.move(listBox.x - 30, y, { steps: 2 });
await page.waitForTimeout(80);
await page.mouse.move(x, y, { steps: 2 });
await page.waitForTimeout(500);
ok((await page.evaluate(() => window.__force.length)) === 0 && (await force()) === String(info.rows[7].shape), 'listeden kısa süreli çıkışta şekil değişmez');
// listeden çıkınca bandın şekline döner
await page.evaluate(() => (window.__mix.rec = []));
await page.mouse.move(80, y, { steps: 6 });
await page.waitForTimeout(700);
ok((await force()) === null, 'listeden çıkınca bandın şekline (matris) döner');
ok((await page.evaluate(() => window.__mix.rec.slice())).some((v) => v > 0.02), 'geri dönüşüm başlar');
// klavye: «Tüm sektörler»den Shift+Tab → son satır, bir daha → yedinci; Tab ile listeden çıkınca geri
await page.focus('#sektorler .sectors__more a');
await page.keyboard.press('Shift+Tab');
await page.waitForTimeout(150);
ok((await force()) === String(info.rows[7].shape), `klavyeyle odaklanınca şekil değişir (${FORMATIONS[info.rows[7].shape].id})`);
await page.keyboard.press('Shift+Tab');
await page.waitForTimeout(150);
ok((await force()) === String(info.rows[6].shape), `odak satırdan satıra geçince (${FORMATIONS[info.rows[6].shape].id})`);
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.waitForTimeout(150);
ok((await force()) === null, 'odak listeden çıkınca bandın şekline döner');
// dokunmatik dokunuş: yalnızca tanım değişir
await page.evaluate(() => {
  const a = document.querySelectorAll('#sektorler .sector')[1];
  a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }));
});
await page.waitForTimeout(400);
const touch = await page.evaluate(() => ({ f: document.querySelector('#sektorler').dataset.worldForce ?? null, cap: document.querySelector('[data-sectors-cap]').textContent, short: document.querySelectorAll('#sektorler .sector')[1].dataset.short }));
ok(touch.f === null && touch.cap.length > 0 && touch.short.startsWith(touch.cap.slice(0, 12)), 'dokunmatik dokunuşta şekil değişmez, tanım değişir');
ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
await ctx.close();

// «Kapalı» katman: 3B dünya yok, hedef yazılmaz; tanım yine değişir
const off = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
await off.addInitScript(() => localStorage.setItem('boraden-fx', 'off'));
const p2 = await off.newPage();
const logs2 = [];
p2.on('pageerror', (e) => logs2.push(e.message));
p2.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && logs2.push(m.text()));
await p2.goto(BASE + '/', { waitUntil: 'load' });
await p2.waitForFunction(() => window.__boraden === true, null, { timeout: 15000 });
await p2.evaluate(() => document.querySelector('#sektorler').scrollIntoView({ block: 'center' }));
await p2.waitForTimeout(300);
await p2.locator('#sektorler .sector').nth(0).hover();
await p2.waitForTimeout(400);
const o = await p2.evaluate(() => ({ f: document.querySelector('#sektorler').dataset.worldForce ?? null, cap: document.querySelector('[data-sectors-cap]').textContent }));
ok(o.f === null && o.cap.length > 0, '«Kapalı» katmanda hedef yazılmaz, tanım değişir');
ok(logs2.length === 0, `konsol temiz («Kapalı»)${logs2.length ? ': ' + logs2.slice(0, 3).join(' | ') : ''}`);
await off.close();
await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
