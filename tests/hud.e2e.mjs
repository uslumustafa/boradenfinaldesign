// Bölüm göstergesi (HUD, sağ kenar noktaları) tarayıcı denetimi.  Çalıştırma:  node tests/hud.e2e.mjs [--base=http://127.0.0.1:4181]
// Kurallar:
//  • [data-chapter] + id taşıyan ≥4 bölüm varsa gösterge onlardan kurulur (ana sayfa, bilgi merkezi, ekip…) — bölüm adı değişimde belirir.
//  • Yoksa «Bu sayfada» menüsünden ([data-toc]) türetilir (hizmet, sektör, hesaplayıcı, not, hukuki metin, hakkımızda); 4–10 bölüm;
//    sessizdir (data-quiet: ad kendiliğinden belirmez) ve yalnızca ≥1360 px'te görünür.
//  • Menüsüz sayfada, «Kapalı» efekt kademesinde ve router geçişlerinden sonra yinelenen/artık gösterge kalmaz.
import { chromium } from 'playwright-core';
import { guardContext, driverNoise } from './safe-context.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function newPage({ w = 1440, h = 900, mobile = false, fx = 'full' } = {}) {
  const ctx = await guardContext(await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile }));
  await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), fx);
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !driverNoise(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && logs.push(`[http ${r.status()}] ${r.url()}`));
  return { ctx, page, logs };
}
async function open(page, url) {
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
}
// sayfanın kendi kaynakları: elle işaretli bölümler ve menü bağlantıları
const source = (page) =>
  page.evaluate(() => {
    const chap = [...document.querySelectorAll('main [data-chapter]')].filter((e) => e.id);
    const toc = [...document.querySelectorAll('main [data-toc] a[href^="#"]')]
      .map((a) => ({ id: a.getAttribute('href').slice(1), t: a.textContent.replace(/\s+/g, ' ').trim() }))
      .filter((x) => document.getElementById(x.id) && x.t);
    return { chap: chap.length, toc: new Set(toc.map((x) => x.id)).size, tocLabels: toc.map((x) => x.t) };
  });
const hud = (page) =>
  page.evaluate(() => {
    const all = document.querySelectorAll('nav.hud');
    const n = all[0];
    if (!n) return { n: 0 };
    const links = [...n.querySelectorAll('a')];
    return {
      n: all.length,
      count: links.length,
      quiet: n.hasAttribute('data-quiet'),
      shown: getComputedStyle(n).display !== 'none',
      label: n.getAttribute('aria-label'),
      active: links.filter((a) => a.classList.contains('is-active')).length,
      current: links.filter((a) => a.getAttribute('aria-current') === 'location').length,
      activeIdx: links.findIndex((a) => a.classList.contains('is-active')),
      flash: n.classList.contains('is-flash'),
      labels: links.map((a) => a.querySelector('.hud__label').textContent),
      hrefsOk: links.every((a) => document.getElementById(a.getAttribute('href').slice(1))),
    };
  });

/* ─── Menüden türeyen gösterge ─── */
async function derived() {
  console.log('Menüden türeyen gösterge (1440×900)');
  const { ctx, page, logs } = await newPage();
  const pages = ['/hizmetler/vergi/kdv-iade-islemleri/', '/sektorler/saglik-ve-ilac/', '/hesaplayicilar/maas-hesaplama/', '/bilgi-merkezi/okuma-notlari/warren-buffett-deger-ve-fiyat/', '/yasal/kvkk-aydinlatma-metni/', '/hakkimizda/'];
  for (const url of pages) {
    await open(page, url);
    const s = await source(page);
    const h = await hud(page);
    const want = s.chap >= 4 ? s.chap : s.toc >= 4 && s.toc <= 10 ? s.toc : 0;
    ok((h.n || 0) === (want ? 1 : 0) && (h.count || 0) === want, `${url}: kaynak (bölüm ${s.chap}, menü ${s.toc}) → gösterge ${h.n ? h.count + ' nokta' : 'yok'} (beklenen ${want || 'yok'})`);
    if (!want) continue;
    ok(h.label === 'Sayfa bölümleri' && h.hrefsOk, `${url}: nav etiketi + her nokta var olan bir bölüme bağlı`);
    ok(h.quiet === (s.chap < 4) && h.shown, `${url}: ${h.quiet ? 'menüden türeyen (sessiz)' : 'elle işaretli'} gösterge görünür`);
    if (h.quiet) ok(JSON.stringify(h.labels) === JSON.stringify([...new Set(s.tocLabels)].slice(0, h.count)) || h.labels.every((l) => s.tocLabels.includes(l)), `${url}: nokta adları menü adlarıyla aynı`);
    ok(h.active === 1 && h.current === 1 && h.activeIdx === 0, `${url}: tepede tek aktif nokta (ilk bölüm) + aria-current`);
    // üçüncü bölüme (yoksa sonuncuya) kaydır: aktif nokta oraya (ya da daha ilerisine) geçer, yine tek aktif;
    // menüden türeyen gösterge bölüm adı yakmaz
    const k = Math.min(2, h.count - 1);
    await page.evaluate((i) => {
      const id = document.querySelectorAll('nav.hud a')[i].getAttribute('href').slice(1);
      window.scrollTo(0, document.getElementById(id).getBoundingClientRect().top + window.scrollY - innerHeight * 0.3);
    }, k);
    await page.waitForTimeout(900);
    const h2 = await hud(page);
    ok(h2.active === 1 && h2.current === 1 && h2.activeIdx >= k, `${url}: ${k + 1}. bölüme kaydırınca aktif nokta ilerledi (${h.activeIdx} → ${h2.activeIdx})`);
    if (h.quiet) ok(!h2.flash, `${url}: sessiz gösterge bölüm adını kendiliğinden göstermez`);
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

/* ─── Elle işaretli sayfalar ─── */
async function explicit() {
  console.log('Elle işaretli bölümler (1440×900)');
  const { ctx, page, logs } = await newPage();
  for (const url of ['/', '/bilgi-merkezi/', '/hakkimizda/ekibimiz/', '/hakkimizda/ekibimiz/adem-baser/']) {
    await open(page, url);
    const s = await source(page);
    const h = await hud(page);
    ok(s.chap >= 4 && h.n === 1 && h.count === s.chap && h.quiet === false && h.shown, `${url}: ${s.chap} işaretli bölüm → ${h.count} nokta, bölüm adı kendiliğinden belirir`);
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

/* ─── Göstergesiz sayfalar ─── */
async function none() {
  console.log('Göstergesiz sayfalar');
  const { ctx, page } = await newPage();
  for (const url of ['/iletisim/', '/kariyer/', '/arama/', '/404.html']) {
    await open(page, url);
    const s = await source(page);
    const h = await hud(page);
    const want = s.chap >= 4 || (s.toc >= 4 && s.toc <= 10);
    ok(!!h.n === want, `${url}: gösterge ${h.n ? 'var' : 'yok'} (kaynak: bölüm ${s.chap}, menü ${s.toc})`);
  }
  // yoğun menü (A–Z sözlük) → gösterge anlamsız, kurulmaz
  await open(page, '/bilgi-merkezi/sozluk/');
  const s = await source(page);
  const h = await hud(page);
  ok(s.toc <= 10 || !h.n, `/bilgi-merkezi/sozluk/: ${s.toc} menü bağlantısı → gösterge ${h.n ? 'var' : 'yok'} (>10 ise kurulmaz)`);
  await ctx.close();
}

/* ─── Genişlik ve efekt kademeleri ─── */
async function tiers() {
  console.log('Genişlik ve efekt kademeleri');
  {
    const { ctx, page } = await newPage({ w: 1280, h: 800 });
    await open(page, '/hizmetler/vergi/kdv-iade-islemleri/');
    const h = await hud(page);
    ok(h.n === 1 && h.quiet && !h.shown, '1280 px: menüden türeyen gösterge gizli (içerik sütunu sağ kenara kadar uzanır)');
    await open(page, '/');
    const h2 = await hud(page);
    ok(h2.n === 1 && !h2.quiet && h2.shown, '1280 px: elle işaretli gösterge (ana sayfa) görünür');
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ w: 390, h: 844, mobile: true });
    await open(page, '/sektorler/saglik-ve-ilac/');
    const h = await hud(page);
    ok(!h.n || !h.shown, '390 px (mobil): gösterge görünmez');
    await open(page, '/');
    const h2 = await hud(page);
    ok(!h2.n || !h2.shown, '390 px (mobil): ana sayfada da görünmez');
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ fx: 'off' });
    await open(page, '/hizmetler/vergi/kdv-iade-islemleri/');
    ok((await hud(page)).n === 0, 'Kapalı efekt kademesi: gösterge kurulmaz');
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ fx: 'lite' });
    await open(page, '/sektorler/saglik-ve-ilac/');
    const h = await hud(page);
    ok(h.n === 1 && h.count >= 4, `Hafif kademe: gösterge kurulur (${h.count} nokta)`);
    await ctx.close();
  }
}

/* ─── Router: artık/yinelenen gösterge kalmaz ─── */
async function router() {
  console.log('Sayfa geçişleri (router)');
  const { ctx, page, logs } = await newPage();
  await open(page, '/hizmetler/vergi/kdv-iade-islemleri/');
  ok((await hud(page)).n === 1, 'başlangıç: tek gösterge');
  await page.click('.hdr a[href="/iletisim/"]');
  await page.waitForFunction(() => location.pathname === '/iletisim/', null, { timeout: 6000 });
  await page.waitForTimeout(900);
  ok((await hud(page)).n === 0, 'menüsüz sayfaya geçince gösterge kalkar');
  await page.goBack();
  await page.waitForFunction(() => location.pathname.startsWith('/hizmetler/'), null, { timeout: 6000 });
  await page.waitForTimeout(1200);
  const h = await hud(page);
  ok(h.n === 1 && h.count >= 4, `geri dönünce tek gösterge yeniden kurulur (${h.n} adet, ${h.count} nokta)`);
  // sektörden hizmete: gösterge yeni sayfanın bölümleriyle yenilenir
  await page.goto(BASE + '/sektorler/saglik-ve-ilac/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const a = await hud(page);
  // sektör sayfasındaki ilk HİZMET bağlantısı (/hizmetler/<alan>/<hizmet>/; alan sayfası değil)
  const svcHref = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('main a[href^="/hizmetler/"]')].map((a) => a.getAttribute('href')).filter((h) => h.split('/').filter(Boolean).length === 3);
    return hs.find((h) => h === '/hizmetler/vergi/kdv-iade-islemleri/') || hs[0]; // KDV iadesi: ≥4 bölümlü, zengin hizmet sayfası
  });
  await page.locator(`main a[href="${svcHref}"]`).first().click();
  await page.waitForFunction((h) => location.pathname === h, svcHref, { timeout: 6000 });
  await page.waitForTimeout(1200);
  const b = await hud(page);
  const sb = await source(page);
  const wantB = sb.toc >= 4 && sb.toc <= 10 ? 1 : 0;
  ok(a.n === 1 && b.n === wantB && (!wantB || (b.count === sb.toc && JSON.stringify(a.labels) !== JSON.stringify(b.labels))), `sektör → hizmet geçişinde gösterge yenilenir (${a.count} → ${b.count || 'yok'} nokta; menü ${sb.toc}; ${b.n} adet)`);
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

try {
  await derived();
  await explicit();
  await none();
  await tiers();
  await router();
} catch (e) {
  fails++;
  console.log('  ✘ HATA', e.message.split('\n')[0]);
}
await browser.close();
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
