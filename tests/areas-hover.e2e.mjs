// Ana sayfa «Hizmet alanları» bandı: fareyle bir alanın üzerine gelince 3B şekil o alanın şekline döner (gerçek Chrome).
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/areas-hover.e2e.mjs [--base=http://127.0.0.1:4181]
// Müşteri (2026-10-21): «mouse ile üzerine geldiğinde 3B şekil değişmiyor; illa basınca değil, mouse hizmetin üzerine geldiğinde de şekil
// değişmeli; illa scroll da olmamalı — hem scroll ile hem mouse ile üzerine gelindiğinde değişmeli, direkt o hizmetin 3B şekli».
// Denetlenenler (behaviors.js › areas; 1440×900, «Tam» katman, bant sabitlenmiş):
//   • sekiz satırın her birinin üzerine gelince — kaydırma olmadan — bandın hedefi o alanın şekli (data-world-force = 1…8) ve dönüşüm başlar
//     (uMix); sayfa kaymaz, açık (seçili) alan ve satırların yeri değişmez
//   • hızlı geçişte aradaki alanların şekli istenmez; kısa süreli çıkışta şekil değişmez; listeden çıkınca kaydırmanın gösterdiği alana döner
//   • imleç listedeyken kaydırma alanı değiştirince önizleme bırakılır (şekil kaydırmayı izler); imleç kıpırdayınca önizleme yeniden başlar
//   • tıklama: alan seçilir, sahne o alanın konumuna kayar, şekil hedefte kalır; klavyeyle (görünür odak) odaklanınca şekil o alanınki
//   • dokunmatik olay şekli değiştirmez; dar (sabitlenmeyen) düzende ve «Kapalı» katmanda önizleme yok; konsol temiz
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:4181').slice(7);
const INTENT = 120;
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// uMix gözlemcisi (dönüşüm ilerlemesi 0 → 1) ve data-world-force kaydı
const watch = () => {
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
};

console.log('1 · Fareyle üzerine gelme (1440×900, Tam)');
const ctx = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
await ctx.addInitScript(() => localStorage.setItem('boraden-fx', 'full'));
await ctx.addInitScript(watch);
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && logs.push(m.text()));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__boraden === true, null, { timeout: 15000 });
// bandın başına: sahne sabitlenmiş, ilk alan açık
await page.evaluate(() => {
  const s = document.querySelector('#alanlar');
  scrollTo(0, scrollY + s.getBoundingClientRect().top + 40);
});
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const sec = document.querySelector('#alanlar');
  window.__force = [];
  new MutationObserver(() => window.__force.push(sec.dataset.worldForce ?? null)).observe(sec, { attributes: true, attributeFilter: ['data-world-force'] });
  return { range: sec.dataset.worldRange.split(',').map(Number), n: sec.querySelectorAll('.area').length };
});
const st = () =>
  page.evaluate(() => {
    const sec = document.querySelector('#alanlar');
    return {
      force: sec.dataset.worldForce ?? null,
      active: [...sec.querySelectorAll('.area')].findIndex((a) => a.classList.contains('is-active')),
      y: scrollY,
      tops: [...sec.querySelectorAll('.area__link')].map((b) => Math.round(b.getBoundingClientRect().top)),
    };
  });
const center = async (i) => {
  const b = await page.locator('#alanlar .area__link').nth(i).boundingBox();
  return [b.x + Math.min(160, b.width / 3), b.y + b.height / 2];
};
const s0 = await st();
ok(info.n === 8 && info.range[0] === 1 && info.range[1] === 8 && s0.active === 0 && s0.force === null, `bant sabitlenmiş, ilk alan açık, hedef kaydırmadan (alan ${info.n}, aralık ${info.range.join('–')})`);
// her satır: hedef o alanın şekli
const seen = [];
for (let i = 0; i < info.n; i++) {
  const [x, y] = await center(i);
  await page.mouse.move(x, y, { steps: 3 });
  await page.waitForTimeout(INTENT + 260);
  seen.push((await st()).force);
}
ok(seen.every((f, i) => f === String(info.range[0] + i)), `her satırın üzerine gelince o alanın şekli (${seen.join(' · ')})`);
const s1 = await st();
ok(s1.y === s0.y, 'sayfa kaymadı');
ok(s1.active === 0 && s1.tops.every((t, i) => Math.abs(t - s0.tops[i]) <= 1), 'açık alan ve satırların yeri değişmedi (imlecin altındaki satır kaymaz)');
// dönüşüm başlar (kaydırma olmadan)
await page.evaluate(() => (window.__mix.rec = []));
let [x, y] = await center(5);
await page.mouse.move(x, y, { steps: 3 });
await page.waitForTimeout(500);
const mix = await page.evaluate(() => window.__mix.rec.slice());
ok((await st()).force === String(info.range[0] + 5) && mix.some((v) => v > 0.02), `dönüşüm başlar — kaydırma olmadan (uMix en çok ${Math.max(0, ...mix).toFixed(2)})`);
await page.waitForTimeout(900);
// hızlı geçiş: satır merkezleri önceden ölçülür, imleç satırlarda kısa kalır — yalnızca son satırın şekli istenir
const fast = async () => {
  const pts = [];
  for (const i of [4, 3, 2, 1]) pts.push(await center(i));
  await page.evaluate(() => {
    window.__force = [];
    window.__over = [];
    const rows = [...document.querySelectorAll('#alanlar .area')];
    window.__overFn = (e) => {
      const a = e.target.closest?.('.area');
      if (a && window.__over.at(-1)?.i !== rows.indexOf(a)) window.__over.push({ i: rows.indexOf(a), t: performance.now() });
    };
    document.querySelector('#alanlar .areas__list').addEventListener('pointermove', window.__overFn);
  });
  for (const [px, py] of pts) {
    await page.mouse.move(px, py);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    document.querySelector('#alanlar .areas__list').removeEventListener('pointermove', window.__overFn);
    return { seq: window.__force.slice(), over: window.__over.slice() };
  });
};
let run = await fast();
const dwell = (r) => r.over.slice(0, -1).map((o, j) => ({ i: o.i, ms: r.over[j + 1].t - o.t }));
if (dwell(run).some((d) => d.ms >= INTENT - 10)) run = await fast();
const long = dwell(run).filter((d) => d.ms >= INTENT - 10).map((d) => String(info.range[0] + d.i));
const expect = [...long, String(info.range[0] + 1)];
ok(run.seq.length === expect.length && run.seq.at(-1) === String(info.range[0] + 1) && run.seq.every((v) => expect.includes(v)), `hızlı geçişte yalnızca imlecin durduğu satırın şekli (${run.seq.join(' → ') || 'değişim yok'} · satırda kalış ${dwell(run).map((d) => Math.round(d.ms)).join('/')} ms)`);
// kısa süreli çıkış (≈ 80 ms) şekli değiştirmez
[x, y] = await center(1);
await page.evaluate(() => (window.__force = []));
const listBox = await page.locator('#alanlar .areas__list').boundingBox();
await page.mouse.move(listBox.x + listBox.width + 40, y, { steps: 2 });
await page.waitForTimeout(80);
await page.mouse.move(x, y, { steps: 2 });
await page.waitForTimeout(500);
ok((await page.evaluate(() => window.__force.length)) === 0 && (await st()).force === String(info.range[0] + 1), 'listeden kısa süreli çıkışta şekil değişmez');
// listeden çıkınca kaydırmanın gösterdiği alana döner
await page.evaluate(() => (window.__mix.rec = []));
await page.mouse.move(listBox.x + listBox.width + 200, 120, { steps: 5 });
await page.waitForTimeout(800);
ok((await st()).force === null && (await page.evaluate(() => window.__mix.rec.slice())).some((v) => v > 0.02), 'listeden çıkınca şekil kaydırmanın gösterdiği alana döner (dönüşüm başlar)');
// imleç listedeyken kaydırma: önizleme bırakılır, şekil kaydırmayı izler; imleç kıpırdayınca önizleme yeniden
[x, y] = await center(6);
await page.mouse.move(x, y, { steps: 3 });
await page.waitForTimeout(INTENT + 260);
const before = await st();
const r = await page.evaluate(() => {
  const s = document.querySelector('#alanlar').getBoundingClientRect();
  return { h: s.height };
});
await page.mouse.wheel(0, Math.round((r.h - 900) / 8) * 2.2);
await page.waitForTimeout(1300);
const afterScroll = await st();
ok(before.force === String(info.range[0] + 6) && afterScroll.active >= 2 && afterScroll.force === null, `kaydırma alanı değiştirince önizleme bırakılır — şekil kaydırmayı izler (açık alan ${before.active + 1} → ${afterScroll.active + 1}, hedef ${afterScroll.force ?? 'kaydırma'})`);
await page.mouse.move(x + 6, y + 1, { steps: 2 });
await page.waitForTimeout(INTENT + 260);
const moved = await st();
const under = await page.evaluate(([px, py]) => {
  const a = document.elementFromPoint(px, py)?.closest('.area');
  return a ? [...document.querySelectorAll('#alanlar .area')].indexOf(a) : -1;
}, [x + 6, y + 1]);
ok(under >= 0 && moved.force === String(info.range[0] + under), `imleç kıpırdayınca önizleme yeniden başlar (satır ${under + 1})`);
// tıklama: alan seçilir, sahne o alana kayar, şekil hedefte kalır
const yBefore = (await st()).y;
[x, y] = await center(3);
await page.mouse.move(x, y, { steps: 2 });
await page.mouse.click(x, y);
await page.waitForTimeout(250);
const mid = await st();
await page.waitForTimeout(1600);
const end = await st();
ok(mid.force === String(info.range[0] + 3) && end.active === 3 && end.force === String(info.range[0] + 3) && end.y !== yBefore, `tıklayınca alan seçilir, sahne kayar, şekil hedefte kalır (açık ${end.active + 1}, hedef ${end.force})`);
// klavye: görünür odak → şekil o alanınki; odak listeden çıkınca kaydırmanınki
await page.mouse.move(listBox.x + listBox.width + 200, 120, { steps: 3 });
await page.waitForTimeout(500);
// listeden önceki son odaklanabilir öğeye odaklanıp Tab: ilk alanın düğmesi klavyeyle (görünür odak) odaklanır
await page.evaluate(() => {
  const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => !e.closest('[inert]') && !e.disabled);
  const first = document.querySelector('#alanlar .area__link');
  all[all.indexOf(first) - 1].focus();
});
await page.keyboard.press('Tab');
await page.waitForTimeout(250);
const kf = await st();
const onFirst = await page.evaluate(() => document.activeElement === document.querySelector('#alanlar .area__link'));
ok(onFirst && kf.force === String(info.range[0]) && kf.active === 0, `klavyeyle odaklanınca şekil o alanınki (Tab → 1. alan, hedef ${kf.force})`);
await page.evaluate(() => document.activeElement.blur());
await page.waitForTimeout(200);
ok((await st()).force === null, 'odak listeden çıkınca şekil kaydırmanınki');
// dokunmatik olay: şekil değişmez
await page.evaluate(() => {
  const b = document.querySelectorAll('#alanlar .area__link')[2];
  const r = b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: r.left + 40, clientY: r.top + 10 }));
});
await page.waitForTimeout(INTENT + 260);
ok((await st()).force === null, 'dokunmatik olay şekli değiştirmez');
ok(logs.length === 0, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
await ctx.close();

// 2 · dar düzen (sabitlenmeyen, fare) ve «Kapalı» katman: önizleme yok
console.log('\n2 · Dar düzen ve «Kapalı» katman');
for (const [label, vp, tier] of [['dar düzen 800×900', { width: 800, height: 900 }, 'full'], ['«Kapalı» 1440×900', { width: 1440, height: 900 }, 'off']]) {
  const c2 = await guardContext(await browser.newContext({ viewport: vp }));
  await c2.addInitScript((t) => localStorage.setItem('boraden-fx', t), tier);
  const p2 = await c2.newPage();
  const l2 = [];
  p2.on('pageerror', (e) => l2.push(e.message));
  p2.on('console', (m) => m.type() === 'error' && !driverNoise(m.text()) && l2.push(m.text()));
  await p2.goto(BASE + '/', { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__boraden === true, null, { timeout: 15000 });
  await p2.locator('#alanlar .area__link').nth(4).scrollIntoViewIfNeeded();
  await p2.waitForTimeout(600);
  await p2.locator('#alanlar .area__link').nth(4).hover();
  await p2.mouse.move(...(await p2.locator('#alanlar .area__link').nth(4).boundingBox().then((b) => [b.x + 50, b.y + b.height / 2])), { steps: 3 });
  await p2.waitForTimeout(INTENT + 300);
  const f = await p2.evaluate(() => document.querySelector('#alanlar').dataset.worldForce ?? null);
  ok(f === null && l2.length === 0, `${label}: önizleme yok, konsol temiz${l2.length ? ': ' + l2.slice(0, 2).join(' | ') : ''}`);
  await c2.close();
}
await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
