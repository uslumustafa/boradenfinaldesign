// Sayfa geçişi («3B noktalar akar») — tarayıcı denetimi (gerçek Chrome, Playwright). Çalışan bir sunucu gerekir.
//   node tests/transition.e2e.mjs [--base=http://127.0.0.1:4181] [--rounds=2] [--slow=180]
// Hizmetler gezinmesinde (dizin satırı, kırıntı, alan kartı, alan → hizmet, Hizmetler mega menüsü) HER tıklamada:
//   · noktalar tamamen ekran dışına akar (uSurge ≥ 0,98),
//   · yeni sayfanın şekli noktalar dışarıdayken oturur — çözülme yok (uFade hep 1), iki şekil arası süzülme yok (uMix tam sayı),
//   · yeni şekil yerinde belirir (uSurge 1 → 0 yalnızca saydamlık; ara kareler çizilir), tam sayfa yenilemesi olmaz.
// İki koşu: olağan kareler ve geçiş sırasında yapay olarak yavaşlatılmış kareler (--slow ms; ağır sayfa / yavaş cihaz / GPU takılması).
// Eski sürümde yavaş karelerde noktalar dışarı varamadan sayfa değişiyor, yeni şekil içeri akmak yerine eski şekil geri toplanıp
// çözülerek değişiyordu («geçiş bazen gelmiyor», Ekim 2026) — bu betik o durumu yakalar.
// Ölçüm: WebGL uniform çağrıları (uSurge/uFade/uMix) sayfaya eklenen gözlemciyle okunur; üretim paketine dokunulmaz.
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ROUNDS = Number(arg('rounds', 2));
const SLOW = Number(arg('slow', 180));
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function run(slow) {
  console.log(slow ? `\nGeçiş kareleri yavaş (≈ ${slow} ms/kare)` : '\nOlağan kareler');
  const ctx = await guardContext(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
  await ctx.addInitScript((slowMs) => {
    localStorage.setItem('boraden-fx', 'full');
    // uniform gözlemcisi: konum → ad; kayıt açıkken her değişiklik [ad, değer] olarak yazılır
    const names = new WeakMap();
    const u = (window.__u = { rec: null });
    for (const P of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
      const getLoc = P.getUniformLocation;
      P.getUniformLocation = function (prog, name) {
        const loc = getLoc.call(this, prog, name);
        if (loc) names.set(loc, name);
        return loc;
      };
      const set1f = P.uniform1f;
      P.uniform1f = function (loc, v) {
        const n = loc && names.get(loc);
        if (n && u.rec) u.rec.push([n, v]);
        return set1f.call(this, loc, v);
      };
    }
    // yavaş kare: geçiş sürerken her karenin başında ana iş parçacığı slowMs meşgul edilir (karede bir kez)
    if (slowMs > 0) {
      const raf = window.requestAnimationFrame.bind(window);
      let stalled = -1;
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          if (t !== stalled && document.documentElement.matches('.is-leaving, .is-entering')) {
            stalled = t;
            const end = performance.now() + slowMs;
            while (performance.now() < end);
          }
          cb(t);
        });
    }
  }, slow);
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => (m.type() === 'error' || (m.type() === 'warning' && /\[router\]|\[dünya\]/.test(m.text()))) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  await page.goto(BASE + '/hizmetler/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('fx-live'), null, { timeout: 20000 });
  await page.evaluate(() => (window.__alive = 1));
  await page.waitForTimeout(2500);

  // tıkla → geçiş bitene kadar uniform değerlerini kaydet → çözümle
  async function nav(label, act) {
    const before = await page.evaluate(() => document.querySelector('#main').dataset.url);
    await page.evaluate(() => (window.__u.rec = []));
    await act();
    await page.waitForFunction((b) => document.querySelector('#main')?.dataset.url !== b, before, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => {
      const r = window.__u.rec || [];
      const last = [...r].reverse().find(([n]) => n === 'uSurge');
      return !document.documentElement.matches('.is-leaving, .is-entering') && last && last[1] === 0;
    }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250);
    const { rec, alive, url } = await page.evaluate(() => ({ rec: window.__u.rec, alive: window.__alive === 1, url: location.pathname }));
    await page.evaluate(() => (window.__u.rec = null));
    const vals = (n) => rec.filter(([k]) => k === n).map(([, v]) => v);
    const surge = vals('uSurge');
    const peak = surge.indexOf(Math.max(...surge));
    const inflow = surge.slice(peak).filter((v) => v > 0.03 && v < 0.97).length; // giriş sırasında çizilen ara kareler
    const fade = Math.min(1, ...vals('uFade'));
    const glide = vals('uMix').filter((v) => v > 0.001 && v < 0.999).length;
    const good = alive && url !== before && Math.max(...surge) >= 0.98 && fade >= 0.999 && glide === 0 && inflow >= 1 && surge.at(-1) === 0;
    ok(good, `${label}: ${before} → ${url} · çıkış ${Math.max(...surge).toFixed(2)} · çözülme ${fade < 0.999 ? 'VAR' : 'yok'} · süzülme ${glide ? 'VAR' : 'yok'} · giriş ara kare ${inflow}${alive ? '' : ' · TAM YENİLEME'}`);
  }
  const click = async (sel, i = 0) => {
    const el = page.locator(sel).nth(i);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400); // kahraman ekran dışındaysa dünya durur — gerçek kullanımdaki gibi
    await el.click();
  };
  for (let r = 0; r < ROUNDS; r++) {
    await nav('dizin satırı → hizmet', () => click('a.svcrow', (r * 13) % 60));
    await nav('kırıntı → Hizmetler', () => click('.crumbs a[href="/hizmetler/"]'));
    await nav('alan kartı → alan', () => click('a.agc', (r * 3 + 1) % 8));
    await nav('alan → hizmet kartı', () => click('.acards a', r % 3));
    await nav('mega menü → hizmet', async () => {
      await page.evaluate(() => scrollTo(0, 0));
      await page.hover('.nav__link[data-panel="services"]');
      await page.waitForSelector('#mega-services.is-open a', { state: 'visible' });
      await page.locator('#mega-services.is-open a').nth(2 + r * 9).click();
    });
    await nav('hizmet → Hizmetler (üst menü)', async () => {
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('.nav__link[data-panel="services"]').click();
    });
  }
  ok(!logs.length, `konsol temiz${logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

try {
  await run(0);
  if (SLOW > 0) await run(SLOW);
} finally {
  await browser.close();
}
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
