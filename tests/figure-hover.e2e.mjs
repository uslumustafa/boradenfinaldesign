// Beyaz sayfalardaki şekil kutusu (modules/figure.js): satırın/kartın üzerine gelince yalnızca O şekil gelmeli — gerçek Chrome.
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/figure-hover.e2e.mjs [--base=http://127.0.0.1:4181] [--only=/hizmetler/]
// Müşteri geri bildirimi (2026-10-16): «hizmetlerde şekiller 2 kere değişiyor; diğer şekle geçmek istediğimde önce ilk şekil,
// sonra öbürü geliyor — sadece üzerine gelinen şekil gelmeli» (Hizmetler/Hesaplayıcılar/Sektörler dizini, hizmet alanı sayfaları).
// Her çizilen kare kaydedilir (figure.js her karede fig.__ink = { a, b, mix } yazar: a → b dönüşümü, şekil kimlikleri;
// 'kaydirma' = sayfanın kaydırma şekli, 'ara' = dönüşüm sürerken dondurulan ara hâl). Bir şeklin görünür sayıldığı eşik: ağırlığı > %2.
// Denetlenenler (Tam ve Hafif katman; Kapalı'da yalnızca son kare):
//   • satır A → satır B: karelerde yalnızca A, B (ve ara hâl) görünür; sayfanın şekli ya da başka bir şekil araya girmez, dönüşüm tek yönlüdür
//   • dönüşüm sürerken başka satıra geçiş (A → C → hemen B): yine yalnızca bu şekiller; sonunda B
//   • satırlar arası boşluk / grup başlığı üzerinden yavaş geçiş: sayfanın şekli araya girmez
//   • klavye odağı satırdan satıra: aynı kural
//   • liste bölgesinden çıkınca sayfanın şekline döner
//   • konsol/HTTP temiz
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ONLY = arg('only', '');
const PAGES = [
  { url: '/hizmetler/', name: 'Hizmetler dizini', gap: true },
  { url: '/hizmetler/vergi/', name: 'Hizmet alanı (Vergi)' },
  { url: '/hizmetler/denetim/', name: 'Hizmet alanı (Denetim)' },
  { url: '/hesaplayicilar/', name: 'Hesaplayıcılar dizini', gap: true },
  { url: '/sektorler/', name: 'Sektörler dizini', gap: true },
].filter((p) => !ONLY || p.url === ONLY);
const TIERS = ['full', 'lite', 'off'];
const SETTLE = 1400; // dönüşüm + bekleme payı (ms)

let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};
const VIS = 0.02;
// bir karede görünen şekiller
const seen = (s) => {
  const out = [];
  if (!s) return out;
  if (!s.b || s.mix < 1 - VIS) out.push(s.a);
  if (s.b && s.mix > VIS) out.push(s.b);
  return out;
};
const shown = (s) => (s ? (!s.b || s.mix <= VIS ? s.a : s.mix >= 1 - VIS ? s.b : null) : null);
// kare kaydı içinde izin verilmeyen şekiller
function stray(log, allowed) {
  const bad = new Map();
  for (const s of log) for (const id of seen(s)) if (!allowed.includes(id)) bad.set(id, (bad.get(id) || 0) + 1);
  return [...bad].map(([id, n]) => `${id}×${n}`);
}
// a→b çifti için dönüşüm tek yönlü mü (mix geri gitmez; aynı çift içinde)
function oneWay(log) {
  let prev = null;
  for (const s of log) {
    if (prev && prev.a === s.a && prev.b === s.b && s.b && s.mix < prev.mix - 0.02) return false;
    prev = s;
  }
  return true;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const P of PAGES) {
  for (const tier of TIERS) {
    console.log(`\n${P.name} ${P.url} · ${tier}`);
    const ctx = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' }));
    await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), tier);
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !driverNoise(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
    page.on('response', (r) => r.status() >= 400 && logs.push(`[http ${r.status()}] ${r.url()}`));
    await page.goto(BASE + P.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__boraden === true, null, { timeout: 8000 });
    // ilk satır ekranın üst üçte birine gelsin (önizleme yapışkan sütunda görünür)
    await page.evaluate(() => {
      const r = document.querySelector('[data-shape-hover]');
      scrollTo(0, scrollY + r.getBoundingClientRect().top - innerHeight * 0.3);
    });
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(4, 450);
    await page.waitForFunction(() => [...document.querySelectorAll('figure.fig')].some((f) => f.__ink), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(SETTLE + 400);

    const info = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-shape-hover]')];
      const scope = rows[0].closest('.sheet') || document.querySelector('main');
      const figs = [...scope.querySelectorAll('figure.fig')].filter((f) => {
        const r = f.getBoundingClientRect();
        return f.__ink && !f.classList.contains('is-off') && r.height > 60 && r.bottom > 0 && r.top < innerHeight;
      });
      figs.forEach((f, i) => (f.dataset.hoverProbe = String(i)));
      const vis = rows
        .map((el, i) => {
          const a = el.querySelector('a') || el;
          const r = a.getBoundingClientRect();
          return { i, id: el.dataset.shapeHover, x: r.left + Math.min(r.width / 2, 160), y: r.top + r.height / 2, top: r.top, bottom: r.bottom, group: el.closest('section')?.id || '' };
        })
        .filter((r) => r.y > 90 && r.y < innerHeight - 30 && el(r.i)); // satırın bağlantısının ortası ekranda
      function el(i) {
        const e = rows[i];
        return e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      }
      return { figs: figs.map((f) => ({ ink: f.__ink, cls: f.className })), rows: vis };
    });
    ok(info.figs.length > 0, `görünür şekil kutusu: ${info.figs.map((f) => f.cls).join(', ') || 'yok'}`);
    if (!info.figs.length) {
      await ctx.close();
      continue;
    }
    const base = [...new Set(info.figs.flatMap((f) => seen(f.ink)))];
    // birbirinden ve sayfanın şeklinden farklı şekilli satırlar
    const pick = [];
    for (const r of info.rows) if (!base.includes(r.id) && !pick.some((p) => p.id === r.id)) pick.push(r);
    console.log(`  · sayfanın şekli: ${base.join(' + ')} · seçilen satırlar: ${pick.slice(0, 3).map((r) => r.id).join(', ')}`);
    ok(pick.length >= 2, `ekranda en az 2 farklı şekilli satır (${pick.length})`);
    if (pick.length < 2) {
      await ctx.close();
      continue;
    }
    const [R1, R2, R3 = R1] = pick;

    const rec = () =>
      page.evaluate(() => {
        cancelAnimationFrame(window.__figRaf || 0);
        const figs = [...document.querySelectorAll('figure.fig[data-hover-probe]')];
        window.__figLog = figs.map(() => []);
        const last = figs.map(() => '');
        const loop = () => {
          figs.forEach((f, i) => {
            const s = f.__ink;
            if (!s) return;
            const k = `${s.a}|${s.b}|${s.mix.toFixed(3)}`;
            if (k === last[i]) return;
            last[i] = k;
            window.__figLog[i].push({ a: s.a, b: s.b, mix: s.mix });
          });
          window.__figRaf = requestAnimationFrame(loop);
        };
        loop();
      });
    const take = () => page.evaluate(() => window.__figLog.map((l) => l.slice()));
    const now = () => page.evaluate(() => [...document.querySelectorAll('figure.fig[data-hover-probe]')].map((f) => f.__ink));
    const hover = (r, steps = 10) => page.mouse.move(r.x, r.y, { steps });
    const check = async (label, allowed, want) => {
      const logs2 = await take();
      const fin = await now();
      logs2.forEach((log, i) => {
        const tag = info.figs.length > 1 ? ` [${info.figs[i].cls}]` : '';
        const bad = stray(log, allowed);
        ok(!bad.length, `${label}${tag}: yalnızca ${allowed.filter((a) => a !== 'ara').join(' → ')} görünür (${log.length} kare)${bad.length ? ' — araya giren: ' + bad.join(', ') : ''}`);
        if (tier !== 'off') ok(oneWay(log), `${label}${tag}: dönüşüm geri dönmeden tek yönde ilerler`);
        if (want) ok(shown(fin[i]) === want, `${label}${tag}: sonunda ${want} (${JSON.stringify(fin[i])})`);
      });
    };

    // 1) ilk satır
    await hover(R1);
    await page.waitForTimeout(SETTLE);
    ok((await now()).every((s) => shown(s) === R1.id), `ilk satır: ${R1.id} gösteriliyor`);

    // 2) satır A → satır B (yerleşmiş hâlden)
    await rec();
    await hover(R2);
    await page.waitForTimeout(SETTLE);
    await check(`${R1.id} → ${R2.id}`, [R1.id, R2.id, 'ara'], R2.id);

    // 3) dönüşüm sürerken başka satıra: B → C, 250 ms sonra → A
    await rec();
    await hover(R3, 6);
    await page.waitForTimeout(250);
    await hover(R1, 6);
    await page.waitForTimeout(SETTLE);
    await check(`${R2.id} → ${R3.id} → (yarıda) ${R1.id}`, [R1.id, R2.id, R3.id, 'ara'], R1.id);

    // 4) hızla birkaç satırın üzerinden geçip sonuncuda durma: aradaki satırların şekli gelmez
    const far = [...info.rows].reverse().find((r) => r.id !== R1.id && !base.includes(r.id) && Math.abs(r.y - R1.y) > 150);
    if (far) {
      const farId = far.id;
      await rec();
      await page.mouse.move(far.x, far.y, { steps: 4 });
      await page.waitForTimeout(SETTLE);
      await check(`hızlı geçiş ${R1.id} ⇒ ${farId}`, [R1.id, farId, 'ara'], farId);
      await hover(R1);
      await page.waitForTimeout(SETTLE);
    }

    // 5) yavaş geçiş: satır araları ve (varsa) grup başlığı üzerinden — imleç listede kaldıkça sayfanın şekli araya girmez
    //    Grup sınırı: belge sırasında art arda gelen, farklı bölümlerdeki ve farklı şekilli iki satır; ikisi ekranda kalacak biçimde kaydırılır.
    const slow = async (from, to, label) => {
      await hover(from);
      await page.waitForTimeout(SETTLE);
      await rec();
      for (let k = 1; k <= 24; k++) {
        await page.mouse.move(from.x + ((to.x - from.x) * k) / 24, from.y + ((to.y - from.y) * k) / 24);
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(SETTLE);
      await check(label, [from.id, to.id, 'ara'], to.id);
    };
    await slow(R1, R2, `satır araları üzerinden yavaş ${R1.id} → ${R2.id}`);
    if (P.gap) {
      const pair = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-shape-hover]')].filter((e) => e.getClientRects().length);
        const secs = [...document.querySelectorAll('section')];
        const g = (e) => secs.indexOf(e.closest('section'));
        for (let i = 1; i < rows.length; i++) {
          const a = rows[i - 1];
          const b = rows[i];
          if (g(a) === g(b) || a.dataset.shapeHover === b.dataset.shapeHover) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          if (rb.bottom - ra.top > innerHeight - 200) continue; // ikisi birlikte ekrana sığmıyor
          scrollTo(0, scrollY + (ra.top + rb.bottom) / 2 - innerHeight / 2);
          return [i - 1, i];
        }
        return null;
      });
      if (pair) {
        await page.waitForTimeout(SETTLE); // kaydırma şekli (bölüm işaretleri) yerleşsin
        const pts = await page.evaluate((ix) => {
          const rows = [...document.querySelectorAll('[data-shape-hover]')].filter((e) => e.getClientRects().length);
          return ix.map((i) => {
            const a = rows[i].querySelector('a') || rows[i];
            const r = a.getBoundingClientRect();
            return { id: rows[i].dataset.shapeHover, x: r.left + Math.min(r.width / 2, 160), y: r.top + r.height / 2 };
          });
        }, pair);
        await slow(pts[0], pts[1], `grup başlığı üzerinden yavaş ${pts[0].id} → ${pts[1].id}`);
        await page.mouse.move(4, 450);
        await page.evaluate((y) => scrollTo(0, y), y0); // satır konumları ve sayfanın şekli yeniden ilk hâline
        await page.waitForTimeout(SETTLE);
      } else console.log('  · grup sınırı denetimi: uygun satır çifti yok, atlandı');
    }

    // 6) klavye: odak satırdan satıra
    await page.mouse.move(4, 450);
    await page.waitForTimeout(SETTLE);
    const focusRow = (r) =>
      page.evaluate((i) => {
        const el = document.querySelectorAll('[data-shape-hover]')[i];
        (el.querySelector('a') || el).focus({ preventScroll: true });
      }, r.i);
    await page.keyboard.press('Shift'); // odak halkası klavye kipinde görünsün (:focus-visible)
    await focusRow(R1);
    await page.waitForTimeout(SETTLE);
    await rec();
    await focusRow(R2);
    await page.waitForTimeout(SETTLE);
    await check(`klavye ${R1.id} → ${R2.id}`, [R1.id, R2.id, 'ara'], R2.id);
    await page.evaluate(() => document.activeElement?.blur());

    // 7) liste bölgesinden çıkınca sayfanın şekline döner
    await hover(R1);
    await page.waitForTimeout(SETTLE);
    await page.mouse.move(4, 450, { steps: 6 });
    await page.waitForTimeout(SETTLE + 400);
    const back = await now();
    ok(back.every((s) => seen(s).every((id) => base.includes(id))), `liste dışına çıkınca sayfanın şekli (${base.join(' + ')}): ${JSON.stringify(back)}`);

    ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  }
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
