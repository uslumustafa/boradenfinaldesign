// Üst menü panelleri (Hizmetler, Bilgi Merkezi) — fareyle gerçek zamanlı gezinme (chrome.js › mega paneller). Gerçek Chrome.
// Çalışan bir sunucu gerekir (npm run dev ya da node scripts/serve.mjs).
//   node tests/mega-hover.e2e.mjs [--base=http://127.0.0.1:4181]
// Müşteri geri bildirimi (2026-10-18): «mouse ile Hizmetler, Sektörler vb. gelince bazen aşağı inince kayıyor; mouse o kısımdayken
// tıklamadıysa kalsın, en alta sınır dışına inerse çıksın; bazen kalıyor bazen gidiyor».
// Müşteri geri bildirimi (2026-10-19): «şimdi de navbar'a geldiğimizde nasıl çıkacağız» — üst şeridin tamamı panelin bölgesindeydi
// (şeritte yana gidince panel açık kalıyordu) ve Hizmetler paneli ekranın altına kadar indiğinden aşağıdan da çıkılamıyordu.
// Fare, 60 Hz'e yakın adımlarla ve gerçek sürelerle taşınır (Playwright'ın anlık mouse.move'u yarışı göstermez). Denetlenenler:
//   • yavaş, hızlı (panel açılırken) ve çok hızlı (açılma gecikmesinden önce) aşağı iniş: panel açık kalır
//   • panelin içinde gezinme, boş alanlar, sütun araları, hareketsiz bekleme: panel açık kalır
//   • panelin altında her ekranda sayfadan bir şerit kalır; panelin alt sınırının dışına inince panel kapanır
//   • Hizmetler'den sağdaki sütunlara çapraz giderken üst şeritte «Bilgi Merkezi»nin üzerinden geçmek paneli değiştirmez; yavaş çapraz
//     (şeritte kapanma süresinden uzun kalan) panele doğru yol paneli kapatmaz
//   • üst şeritte bilinçli geçiş: başka panelli öğede durunca onun paneli (arada kapanmadan), panelsiz öğede durunca panel kapanır
//   • navbar'dan çıkış: şeritte tetikleyiciden yana (logo, boş alan, arama, İletişim düğmesi) ya da yukarı (pencereden) gidince ve panelden
//     yukarı şeride çıkınca panel kapanır, kapalı kalır
//   • header gizliyken (sayfa aşağıdayken) üst kenardan çağrılan header + panel: içeride açık, dışarı çıkınca kapanır ve header yine gizlenir
//   • konsol/HTTP temiz
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');

let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${m}`);
  if (!c) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// fareyi gerçek zamanlı taşır: ~16 ms'lik adımlarla, toplam ms sürede
let at = { x: 0, y: 0 };
async function glide(page, to, ms) {
  const from = { ...at };
  const n = Math.max(1, Math.round(ms / 16));
  const t0 = Date.now();
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
    const wait = t0 + k * ms - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  at = { ...to };
}
async function jump(page, to) {
  await page.mouse.move(to.x, to.y);
  at = { ...to };
}
const openKeys = (page) => page.evaluate(() => [...document.querySelectorAll('.mega.is-open')].map((m) => m.dataset.mega));
const isOpen = async (page, key) => {
  const k = await openKeys(page);
  return k.length === 1 && k[0] === key;
};
// beklenen duruma gelene kadar bekler (en çok ms). Yazılımla çizen (ekran kartsız) test makinesinde «Tam» katmanda kare ≈ 100 ms sürer;
// «durunca açılır/kapanır» denetimleri sabit bekleme yerine durumu bekler. «Açık kalır» denetimleri sabit süre bekleyip bakar.
async function until(page, want, ms = 1500) {
  const t0 = Date.now();
  for (;;) {
    const k = await openKeys(page);
    const hit = want === null ? k.length === 0 : k.length === 1 && k[0] === want;
    if (hit || Date.now() - t0 > ms) return hit;
    await page.waitForTimeout(40);
  }
}
// sayfa içi kayıt: üst menü öğelerinde farenin kalış süresi (olay zamanlarıyla; yavaş makinede adımlar uzar)
const dwellOn = (page, href) =>
  page.evaluate((h) => {
    const d = (window.__navDwell || []).filter((x) => x.href === h);
    const last = d[d.length - 1];
    return last ? Math.round((last.t1 ?? performance.now()) - last.t0) : 0;
  }, href);
const geo = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2, right: b.right, bottom: b.bottom };
    };
    const q = (s) => document.querySelector(s);
    return {
      vw: innerWidth,
      vh: innerHeight,
      hdr: r(q('#hdr')),
      svc: r(q('.nav__link[data-panel="services"]')),
      ins: r(q('.nav__link[data-panel="insights"]')),
      sek: r(q('.nav__link[href="/sektorler/"]')),
      calc: r(q('.nav__link[href="/hesaplayicilar/"]')),
    };
  });
// panel değişirken arada «hiç panel açık değil» anı oldu mu (kapanıp yeniden açılma titremesi): sınıf değişimlerini sayar
const watchGaps = (page) =>
  page.evaluate(() => {
    window.__megaGaps = 0;
    window.__megaMo?.disconnect();
    window.__megaMo = new MutationObserver(() => {
      if (!document.querySelector('.mega.is-open')) window.__megaGaps++;
    });
    document.querySelectorAll('.mega').forEach((m) => window.__megaMo.observe(m, { attributes: true, attributeFilter: ['class'] }));
  });
const gapsSeen = (page) => page.evaluate(() => (window.__megaMo?.disconnect(), window.__megaGaps));
const panelRect = (page, key) =>
  page.evaluate((k) => {
    const b = document.getElementById('mega-' + k).getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
  }, key);
// başlangıç: fare sayfa içeriğinde, paneller kapalı
// başlangıç: fare sayfa içeriğinde (açık panelin altında; panel ekranın altına kadar uzanıyorsa pencerenin dışında), paneller kapalı
async function reset(page, g) {
  const k = await openKeys(page);
  let y = g.vh - 40;
  if (k.length) {
    const r = await panelRect(page, k[0]);
    y = r.bottom + 20 < g.vh - 4 ? Math.max(r.bottom + 20, g.vh - 40) : g.vh + 40;
  }
  await glide(page, { x: g.vw * 0.5, y }, 120);
  await until(page, null, 2500);
  if (y > g.vh) await glide(page, { x: g.vw * 0.5, y: g.vh - 40 }, 60); // içeri dön (panel kapalı)
  await page.waitForTimeout(150);
}

// iki yerleşim: < 1512 px'te Hizmetler paneli iki sırada dörder (1280, 1440), ≥ 1512 px'te sekiz alan tek sırada (1536, 1920)
const CONFIGS = [
  { w: 1440, h: 900, tier: 'lite', url: '/' },
  { w: 1440, h: 900, tier: 'full', url: '/hizmetler/vergi/transfer-fiyatlandirma/' },
  { w: 1280, h: 720, tier: 'lite', url: '/hizmetler/' },
  { w: 1536, h: 864, tier: 'off', url: '/sektorler/' },
  { w: 1920, h: 1080, tier: 'off', url: '/' },
];

for (const C of CONFIGS) {
  console.log(`\n${C.w}×${C.h} · ${C.tier} · ${C.url}`);
  const ctx = await guardContext(await browser.newContext({ viewport: { width: C.w, height: C.h }, reducedMotion: 'no-preference' }));
  await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), C.tier);
  await ctx.addInitScript(() => {
    window.__navDwell = [];
    addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.nav__link').forEach((l) => {
        l.addEventListener('pointerenter', () => window.__navDwell.push({ href: l.getAttribute('href'), t0: performance.now() }));
        l.addEventListener('pointerleave', () => {
          const d = window.__navDwell.filter((x) => x.href === l.getAttribute('href')).pop();
          if (d && d.t1 === undefined) d.t1 = performance.now();
        });
      });
    });
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !driverNoise(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && !/\.mp4$/.test(r.url()) && logs.push(`[http ${r.status()}] ${r.url()}`));
  await page.goto(BASE + C.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boraden === true, null, { timeout: 10000 });
  await page.waitForTimeout(C.url === '/' ? 2600 : 900); // ana sayfa açılış anı
  at = { x: 0, y: 0 };
  const g = await geo(page);
  const bar = g.hdr.bottom;

  // 1 · yavaş iniş, panelin içinde gezinme, alttan çıkış
  await reset(page, g);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 180);
  ok(await until(page, 'services'), 'Hizmetler üzerinde durunca panel açılır');
  await page.waitForTimeout(150);
  const P = await panelRect(page, 'services');
  await glide(page, { x: g.svc.cx, y: bar + Math.min(160, P.h * 0.4) }, 420);
  await page.waitForTimeout(150);
  ok(await isOpen(page, 'services'), 'yavaş aşağı iniş: panel açık');
  const tour = [
    { x: P.x + 30, y: P.y + P.h * 0.5 },
    { x: P.right - 24, y: P.y + 30 }, // sağ üst köşe (sütunların dışı)
    { x: P.right - 40, y: P.bottom - 12 }, // sağ alt: boş alan
    { x: P.x + P.w * 0.37, y: P.bottom - 6 }, // alt kenarın hemen içi
    { x: P.x + P.w * 0.5, y: P.y + 8 }, // üst kenarın hemen altı
  ];
  let stayed = true;
  for (const pt of tour) {
    await glide(page, pt, 260);
    await page.waitForTimeout(120);
    if (!(await isOpen(page, 'services'))) {
      stayed = false;
      console.log(`    panel kapandı: (${Math.round(pt.x)}, ${Math.round(pt.y)})`);
    }
  }
  ok(stayed, 'panelin içinde gezinme (köşeler, boş alanlar, kenarların hemen içi): panel hep açık');
  await page.waitForTimeout(1600);
  ok(await isOpen(page, 'services'), 'panelin içinde hareketsiz 1,6 sn: panel açık');
  // panelin altında her ekranda sayfadan bir şerit kalır (30-layout.css: en az clamp(5rem, 14vh, 9rem)); fare oraya inince panel kapanır
  const room = g.vh - P.bottom;
  const need = Math.min(144, Math.max(80, g.vh * 0.14)) - 2;
  ok(room >= need, `panelin altında sayfadan şerit kalır: ${Math.round(room)} px (en az ${Math.round(need)})`);
  const below = room > 12 ? P.bottom + Math.min(70, room / 2) : g.vh + 40;
  await glide(page, { x: P.x + P.w * 0.37, y: below }, 160);
  ok(await until(page, null), `panelin alt sınırının dışına inince panel kapanır (${room > 12 ? `panel altı, y=${Math.round(below)}` : 'pencereden aşağı çıkış'})`);
  // pencereden aşağı çıkış (panelin hemen içinden): son konum panelde kalsa da kapanır
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 200);
  await until(page, 'services');
  await glide(page, { x: g.svc.cx + 60, y: Math.min(P.bottom - 8, g.vh - 8) }, 300);
  await page.waitForTimeout(200);
  const okIn = await isOpen(page, 'services');
  await glide(page, { x: g.svc.cx + 60, y: g.vh + 60 }, 60);
  ok(okIn && (await until(page, null)), 'panelden pencerenin dışına (aşağı) çıkınca panel kapanır');

  // 2 · hızlı iniş: panel açılırken (perde inerken) fare panelin henüz görünmeyen alt kısmına iner
  for (let i = 0; i < 3; i++) {
    await reset(page, g);
    await glide(page, { x: g.svc.cx, y: g.svc.cy }, 120);
    await until(page, 'services'); // perde inmeye başladı
    await page.waitForTimeout(i * 60); // perdenin farklı anlarında
    await glide(page, { x: g.svc.cx + 40, y: Math.min(P.bottom - 20, bar + 380) }, 70);
    await page.waitForTimeout(700);
    ok(await isOpen(page, 'services'), `hızlı iniş (perde inerken, +${i * 60} ms) #${i + 1}: panel açık kalır`);
  }

  // 3 · üzerinden geçip giden fare (açılma süresi dolmadan sayfaya iner): panel hiç açılmaz — açılıp kapanma (titreme) olmaz
  await reset(page, g);
  await page.evaluate(() => {
    window.__megaFlips = 0;
    const mo = new MutationObserver(() => window.__megaFlips++);
    document.querySelectorAll('.mega').forEach((m) => mo.observe(m, { attributes: true, attributeFilter: ['class'] }));
  });
  await jump(page, { x: g.svc.cx, y: 2 });
  await jump(page, { x: g.svc.cx, y: g.svc.cy });
  await jump(page, { x: g.svc.cx, y: bar + 220 });
  await page.waitForTimeout(600);
  const flips = await page.evaluate(() => window.__megaFlips);
  ok((await openKeys(page)).length === 0 && flips === 0, `üzerinden geçip giden fare paneli açmaz, titreme yok (${flips} değişim)`);
  // duran farenin altına kayan header: sayfa yukarı kaydırılınca header fare Hizmetler'in üzerindeyken gelir → panel kendiliğinden açılmaz
  await page.evaluate(() => scrollTo(0, Math.min(1400, document.documentElement.scrollHeight - innerHeight - 10)));
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(800);
  await jump(page, { x: g.svc.cx, y: g.svc.cy });
  await page.waitForTimeout(150);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(900);
  const under = await page.evaluate(() => ({ hid: document.documentElement.classList.contains('hdr-hidden'), hov: document.querySelector('.nav__link[data-panel="services"]').matches(':hover') }));
  ok(!under.hid && (await openKeys(page)).length === 0, `header duran farenin altına gelince panel açılmaz (fare öğenin üstünde: ${under.hov ? 'evet' : 'hayır'})`);
  await glide(page, { x: g.svc.cx + 6, y: g.svc.cy + 2 }, 60);
  ok(await until(page, 'services'), 'aynı yerde fare kıpırdayınca panel açılır');

  // 4 · çapraz: Hizmetler → sağ sütunlar; yol üst şeritte «Bilgi Merkezi»nin üzerinden geçer (öğede tek bir fare adımı kalır).
  //     Kural: öğede SWITCH_DELAY (150 ms) durulmadıkça panel değişmez. Kalış süresi sayfa içinde ölçülür — yazılımla çizen test
  //     makinesinde tek bir fare adımı bile ~100 ms sürebilir; 150 ms'yi aşarsa değişim kurala uygundur.
  for (let i = 0; i < 3; i++) {
    await reset(page, g);
    await glide(page, { x: g.svc.cx, y: g.svc.cy }, 150);
    await until(page, 'services');
    await page.waitForTimeout(120);
    const tgt = { x: Math.min(P.right - 60, g.vw - 80), y: bar + 70 };
    const mid = { x: g.ins.cx, y: bar - 14 }; // yolun şeritte Bilgi Merkezi'ne değdiği nokta
    await jump(page, { x: (g.svc.cx + mid.x) / 2, y: (g.svc.cy + mid.y) / 2 });
    await jump(page, mid);
    await jump(page, { x: (mid.x + tgt.x) / 2, y: (mid.y + tgt.y) / 2 });
    await jump(page, tgt);
    const dw = await dwellOn(page, '/bilgi-merkezi/');
    await page.waitForTimeout(500);
    const k = await openKeys(page);
    if (dw < 150) ok(k.length === 1 && k[0] === 'services', `çapraz geçiş #${i + 1} (Bilgi Merkezi üzerinde ${dw} ms): Hizmetler paneli değişmez ve açık kalır (açık: ${k.join(',') || 'yok'})`);
    else ok(k.length === 1, `çapraz geçiş #${i + 1}: fare Bilgi Merkezi üzerinde ${dw} ms kaldı (≥ 150 ms, yavaş makine) — bir panel açık (${k.join(',')})`);
  }

  // 5 · bilinçli geçiş: şerit boyunca Bilgi Merkezi'ne gidip durmak paneli değiştirir (arada kapanmadan); panelsiz öğede durmak kapatır
  await reset(page, g);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 150);
  await until(page, 'services');
  await page.waitForTimeout(120);
  await watchGaps(page);
  await glide(page, { x: g.ins.cx, y: g.ins.cy }, 300);
  const sw = await until(page, 'insights');
  const gaps5 = await gapsSeen(page);
  // Hizmetler'den çıkıştan Bilgi Merkezi'ne girişe kadar geçen süre ve aradaki Sektörler'de (panelsiz) kalış süresi sayfa içinde ölçülür.
  // Geçiş TRANSIT_MS'den (450 ms), Sektörler'de kalış PLAIN_DELAY'den (250 ms) kısaysa arada panel kapanmamalı; yazılımla çizen
  // makinede fare adımları uzayıp bu sürelerden biri aşılırsa kapanıp yeniden açılması kurala uygundur
  const cross = await page.evaluate(() => {
    const d = window.__navDwell || [];
    const lv = d.filter((x) => x.href === '/hizmetler/').pop();
    const en = d.filter((x) => x.href === '/bilgi-merkezi/').pop();
    return lv?.t1 !== undefined && en ? Math.round(en.t0 - lv.t1) : null;
  });
  const onSek = await dwellOn(page, '/sektorler/');
  ok(sw && (gaps5 === 0 || cross === null || cross >= 430 || onSek >= 235), `şeritte Bilgi Merkezi üzerinde durunca onun paneli açılır, arada kapanmadan (geçiş ${cross ?? '?'} ms, Sektörler üzerinde ${onSek} ms, arada kapanma: ${gaps5}${gaps5 ? ' — süre aşıldı, kurala uygun' : ''})`);
  const PI = await panelRect(page, 'insights');
  await glide(page, { x: g.ins.cx, y: bar + Math.min(120, PI.h * 0.5) }, 250);
  await page.waitForTimeout(300);
  ok(await isOpen(page, 'insights'), 'Bilgi Merkezi paneline inince açık kalır');
  await glide(page, { x: g.calc.cx, y: g.calc.cy }, 220);
  ok(await until(page, null), 'panelsiz öğede (Hesaplayıcılar) durunca panel kapanır');
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 260);
  await until(page, 'services');
  await glide(page, { x: g.sek.cx, y: g.sek.cy }, 160);
  ok(await until(page, null), 'Hizmetler → Sektörler (panelsiz) üzerinde durunca panel kapanır');

  // 6 · header gizliyken: sayfa aşağıda, fare üst kenara → header gelir → panel → içeride açık → dışarı → kapanır, header yine gizlenir
  await reset(page, g);
  await page.evaluate(() => scrollTo(0, Math.min(1600, document.documentElement.scrollHeight - innerHeight - 10)));
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(700);
  const hidden0 = await page.evaluate(() => document.documentElement.classList.contains('hdr-hidden'));
  ok(hidden0, 'aşağı kaydırınca header gizli');
  await glide(page, { x: g.svc.cx, y: 6 }, 200);
  await page.waitForTimeout(650);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 120);
  ok(await until(page, 'services'), 'header üst kenardan çağrılınca Hizmetler paneli açılır');
  await glide(page, { x: g.svc.cx + 300, y: bar + 200 }, 120);
  await page.waitForTimeout(900);
  const s6 = await page.evaluate(() => ({ hid: document.documentElement.classList.contains('hdr-hidden') }));
  ok((await isOpen(page, 'services')) && !s6.hid, 'panelin içinde: panel açık, header görünür');
  const P6 = await panelRect(page, 'services');
  await glide(page, { x: g.svc.cx + 300, y: g.vh - P6.bottom > 12 ? P6.bottom + Math.min(90, (g.vh - P6.bottom) / 2) : g.vh + 40 }, 140);
  await page.waitForTimeout(1500);
  const s6b = await page.evaluate(() => ({ hid: document.documentElement.classList.contains('hdr-hidden'), open: document.querySelectorAll('.mega.is-open').length }));
  ok(s6b.open === 0 && s6b.hid, `panelden aşağı çıkınca panel kapanır ve header yine gizlenir (açık panel ${s6b.open}, header ${s6b.hid ? 'gizli' : 'görünür'})`);

  // 7 · navbar'dan çıkış (müşteri, 2026-10-19): panel açıkken şeritte tetikleyiciden yana gidince, yukarı pencereden çıkınca ve panelden
  //     yukarı şeride çıkınca panel kapanır ve kapalı kalır
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  const H = await page.evaluate(() => {
    const c = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    };
    const lastNav = [...document.querySelectorAll('#hdr .nav__item')].pop().getBoundingClientRect();
    const act = document.querySelector('#hdr .hdr__actions').getBoundingClientRect();
    return { logo: c(document.querySelector('#hdr .brand')), search: c(document.querySelector('#hdr .hdr__icon')), cta: c(document.querySelector('#hdr .hdr__cta')), gapX: (lastNav.right + act.left) / 2 };
  });
  const exits = [
    ['Hizmetler', g.svc, 'services', 'logoya', H.logo.x],
    ['Hizmetler', g.svc, 'services', 'şeritteki boş alana', H.gapX],
    ['Hizmetler', g.svc, 'services', 'İletişim düğmesine', H.cta.x],
    ['Bilgi Merkezi', g.ins, 'insights', 'aramaya', H.search.x],
    ['Bilgi Merkezi', g.ins, 'insights', 'logoya', H.logo.x],
  ];
  for (const [name, from, key, label, x] of exits) {
    await reset(page, g);
    await glide(page, { x: from.cx, y: from.cy }, 150);
    await until(page, key);
    await page.waitForTimeout(150);
    await glide(page, { x, y: from.cy }, 320); // şerit boyunca yatay
    const closed = await until(page, null, 1600);
    await page.waitForTimeout(450);
    ok(closed && (await openKeys(page)).length === 0, `${name} açıkken şeritte ${label} gidince panel kapanır, kapalı kalır`);
  }
  await reset(page, g);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 150);
  await until(page, 'services');
  await glide(page, { x: g.svc.cx, y: -30 }, 120); // yukarı: pencereden (tarayıcının sekme/adres çubuğuna)
  ok(await until(page, null, 1600), 'Hizmetler açıkken fare yukarı, pencereden çıkınca panel kapanır');
  await glide(page, { x: g.vw * 0.5, y: g.vh - 40 }, 120);
  await reset(page, g);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 150);
  await until(page, 'services');
  await glide(page, { x: g.svc.cx, y: bar + 120 }, 160); // panele in
  await glide(page, { x: H.gapX, y: bar + 120 }, 260); // panelde sağa
  await page.waitForTimeout(150);
  const inP7 = await isOpen(page, 'services');
  await glide(page, { x: H.gapX, y: g.svc.cy }, 140); // yukarı, şeride (tetikleyici sütununun dışı)
  ok(inP7 && (await until(page, null, 1600)), 'panelden yukarı, şeride (tetikleyicinin dışına) çıkınca panel kapanır');

  // 8 · yavaş çapraz: tetikleyiciden panelin sağ ucuna 0,7 sn'de — fare şeritte kapanma süresinden uzun kalır, üzerinden geçtiği öğelerde
  //     de bir süre durur; panele doğru giden yol (üçgen) paneli kapatmaz, değiştirmez, arada kapanma yok
  await reset(page, g);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 150);
  await until(page, 'services');
  await page.waitForTimeout(150);
  await watchGaps(page);
  await glide(page, { x: Math.min(P.right - 80, g.vw - 100), y: bar + 60 }, 700);
  await page.waitForTimeout(450);
  const gaps8 = await gapsSeen(page);
  ok((await isOpen(page, 'services')) && gaps8 === 0, `yavaş çapraz (0,7 sn, şeritte Bilgi Merkezi ve diğer öğelerin üzerinden): Hizmetler paneli açık kalır, değişmez (arada kapanma: ${gaps8})`);
  // panele doğru başlayıp şeritte duran fare: yolun süresi dolunca panel kapanır
  await reset(page, g);
  await glide(page, { x: g.svc.cx, y: g.svc.cy }, 150);
  await until(page, 'services');
  await glide(page, { x: g.svc.cx + (g.ins.cx - g.svc.cx) * 0.6, y: bar - 6 }, 200);
  ok(await until(page, null, 2500), 'panele doğru çıkıp şeritte duran fare: kısa süre sonra panel kapanır');

  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n✘ ${fails} denetim başarısız` : '\n✔ tüm denetimler geçti');
process.exit(fails ? 1 : 0);
