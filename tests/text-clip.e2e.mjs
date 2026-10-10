// Kesilen / taşan / örtülen yazı taraması (e2e). Gerçek Chrome ile sayfaları farklı ekran boylarında baştan sona kaydırır ve
// görünen her metin satırını denetler:
//   • kutu dışı   — satır kendi bölümünün (section, .sheet, header, footer) ya da yapışkan/sabit sahnesinin dışına taşmış
//                   (ör. sabit sahne ekrana sığmadığı için başlığı bir önceki bölümün altında kalıyor)
//   • kırpılmış   — satırın bir kısmı overflow:hidden/clip olan bir atanın kenarında kesiliyor (tamamen gizli içerik sayılmaz:
//                   kapalı akordeon gibi)
//   • yatay taşma — satır ekranın sağından/solundan taşıyor
//   • örtülü      — satırın üstünde opak bir öğe var (bölüm, kart, görsel) — kaydırma geçişlerinde de görülebildiği için uyarı
//   • kelime bölünmüş — kutuya sığmayan bir kelime satır sonunda harf ortasından kırılmış (ör. «İstanbu / l»); tire, eğik çizgi,
//                   e-posta ve adres gibi kırılabilir dizgiler sayılmaz
// Kullanım:  node tests/text-clip.e2e.mjs [--base=http://127.0.0.1:4181] [--full] [--only=/,/hizmetler/] [--sizes=1440x900,390x844]
//            node tests/text-clip.e2e.mjs --words      site haritasındaki TÜM sayfalarda (kaydırmadan) yalnızca «kelime bölünmüş»
//                                                     denetimi — 7 genişlik; uzun Türkçe kelimeler için hızlı tarama
//            node tests/text-clip.e2e.mjs --all --sizes=1440x900,390x844   tüm sayfalarda kaydırmalı tam denetim (≈ 25 dk)
// Sunucu: npm run dev (ya da npm run serve) açık olmalı. --full tüm ekran boylarını ve sayfaları dener.
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [m[1], m[2] ?? true];
  })
);
const base = String(args.base || 'http://127.0.0.1:4181').replace(/\/$/, '');
const FULL = !!args.full;

const PAGES = [
  '/',
  '/hizmetler/',
  '/hizmetler/vergi/',
  '/hizmetler/vergi/kdv-iade-islemleri/',
  '/hizmetler/muhasebe/emeklilik-danismanligi/',
  '/sektorler/',
  '/sektorler/insaat-gayrimenkul-ve-altyapi/',
  '/hakkimizda/',
  '/hakkimizda/ekibimiz/',
  '/kariyer/',
  '/iletisim/',
  '/bilgi-merkezi/',
  '/bilgi-merkezi/sirkulerler/',
  '/bilgi-merkezi/sozluk/',
  '/bilgi-merkezi/sss/',
  '/hesaplayicilar/',
  '/hesaplayicilar/maas-hesaplama/',
  '/vergi-takvimi/',
  '/yasal/gizlilik-politikasi/',
  '/site-haritasi/',
];
const MORE = [
  '/hizmetler/denetim/',
  '/hizmetler/denetim/bagimsiz-denetim/',
  '/hizmetler/kurumsal-finansman/sirket-degerlemesi/',
  '/sektorler/finansal-hizmetler/',
  '/sektorler/aile-sirketleri-ve-kobiler/',
  '/bilgi-merkezi/blog/',
  '/bilgi-merkezi/okuma-notlari/',
  '/bilgi-merkezi/sektor-raporlari/',
  '/hesaplayicilar/kidem-tazminati-hesaplama/',
  '/arama/?q=kdv',
  '/yok-boyle-bir-sayfa/',
];
const WORDS = !!args.words;
const SIZES = (
  args.sizes
    ? String(args.sizes).split(',')
    : WORDS
      ? ['1920x1080', '1440x900', '1280x720', '1024x768', '768x1024', '390x844', '360x740']
      : FULL
        ? ['1920x1080', '1440x900', '1366x768', '1280x720', '1024x768', '768x1024', '390x844', '360x740']
        : ['1440x900', '1280x720', '1024x768', '390x844']
).map((s) => s.split('x').map(Number));

// --words: site haritasındaki tüm sayfalar (+ dizine girmeyen arama ve 404)
async function sitemapPages() {
  const res = await fetch(base + '/sitemap.xml');
  if (!res.ok) throw new Error(`sitemap.xml okunamadı (${res.status})`);
  const xml = await res.text();
  const list = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  return [...new Set([...list, '/arama/?q=kdv', '/yok-boyle-bir-sayfa/'])];
}
// --all: kaydırmalı tam denetim site haritasındaki tüm sayfalarda (uzun sürer; --sizes ile birkaç boy seçin)
const pages = args.only ? String(args.only).split(',') : WORDS || args.all ? await sitemapPages() : FULL ? [...PAGES, ...MORE] : PAGES;

// sayfa içinde çalışan denetim: görünen satırları toplar (opts.words: yalnızca kelime bölünmesi, ekran dışı satırlar dahil)
function audit(opts = {}) {
  const WORDS_ONLY = !!opts.words;
  const vh = innerHeight;
  const vw = document.documentElement.clientWidth;
  const html = document.documentElement;
  const hdr = document.getElementById('hdr');
  const hdrB = hdr && !html.classList.contains('hdr-hidden') ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0;
  const out = [];
  const css = new Map();
  const cs = (el) => {
    let c = css.get(el);
    if (!c) css.set(el, (c = getComputedStyle(el)));
    return c;
  };
  const label = (el) => {
    if (!el) return '?';
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const opaque = (el, x, y) => {
    const b = el.getBoundingClientRect();
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return false; // isabet sahte öğeden (::after) geliyor
    const c = cs(el);
    if (/^(IMG|VIDEO|PICTURE)$/.test(el.tagName)) return true;
    if (c.backgroundImage && c.backgroundImage !== 'none') return true;
    const m = c.backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(',').map((x) => parseFloat(x));
    return parts.length < 4 || parts[3] > 0.5;
  };
  const isBox = (el) => {
    if (el.matches('section, .sheet, header, footer, aside, nav')) return true;
    const p = cs(el).position;
    return p === 'sticky' || p === 'fixed';
  };
  const root = document.querySelector('main') || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.replace(/\s+/g, '').length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const seen = new Set();
  const wordSeen = (window.__wordSeen ||= new WeakSet());
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(n)) continue;
    seen.add(n);
    if (el.closest('[hidden], .sr-only, noscript, script, style, template, select, option')) continue;
    const det = el.closest('details:not([open])');
    if (det && !el.closest('summary')) continue; // kapalı akordeonun içeriği görünmez
    const c = cs(el);
    if (c.visibility === 'hidden' || c.display === 'none') continue;
    // etkin opaklık (açılma animasyonu sürüyorsa ya da gizliyse atla)
    let op = 1;
    for (let p = el; p && p !== html; p = p.parentElement) {
      op *= parseFloat(cs(p).opacity);
      if (op < 0.2) break;
    }
    if (op < 0.2) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 3 && r.height > 5);
    const text = n.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 48);
    const fs = parseFloat(c.fontSize) || 16;
    const tol = 2 + fs * 0.3; // harf kuyrukları/şapkaları satır kutusunun biraz dışına çıkabilir
    let sticky = false;
    for (let p = el; p && p !== html; p = p.parentElement) if (/(sticky|fixed)/.test(cs(p).position)) sticky = true;
    let scrollAnc = null;
    for (let p = el.parentElement; p && p !== html && p !== document.body; p = p.parentElement) if (/(auto|scroll)/.test(cs(p).overflowX) && p.scrollWidth > p.clientWidth + 1) { scrollAnc = p; break; }
    // kelime ortasından kırılma: bir kelimenin satırları farklıysa (yalnızca bir kez, ekranda görünen düğümler için)
    if (!wordSeen.has(n) && (WORDS_ONLY ? rects.length : rects.some((r) => r.bottom > hdrB && r.top < vh))) {
      wordSeen.add(n);
      const re = /\S{4,}/g;
      let m;
      while ((m = re.exec(n.nodeValue))) {
        const w = m[0];
        if (/[-‐‑–—/@._·:]/.test(w)) continue;
        const wr = document.createRange();
        wr.setStart(n, m.index);
        wr.setEnd(n, m.index + w.length);
        const lines = [...wr.getClientRects()].filter((q) => q.width > 1);
        if (lines.length > 1 && Math.abs(lines[0].top - lines[lines.length - 1].top) > 2) {
          out.push({ kind: 'kelime bölünmüş', el: label(el), text: w.slice(0, 40), lines: lines.length });
        }
      }
    }
    if (WORDS_ONLY) continue;
    for (const r of rects) {
      if (r.bottom < hdrB + 2 || r.top > vh - 2) continue; // ekranda değil
      const onScreen = r.top >= hdrB + 2 && r.bottom <= vh - 2;
      // yatay taşma
      if ((r.right > vw + 1.5 || r.left < -1.5) && !scrollAnc) out.push({ kind: 'yatay taşma', el: label(el), text, d: Math.round(Math.max(r.right - vw, -r.left)) });
      let clipped = false;
      let outside = false;
      for (let p = el.parentElement; p && p !== html && p !== document.body; p = p.parentElement) {
        const pc = cs(p);
        const pr = p.getBoundingClientRect();
        // kırpan ata: kısmen kesilen satır (tamamen dışarıda kalan = gizli içerik, sayılmaz)
        const cx = pc.overflowX !== 'visible' && !/(auto|scroll)/.test(pc.overflowX);
        const cy = pc.overflowY !== 'visible' && !/(auto|scroll)/.test(pc.overflowY);
        if (!clipped && (cx || cy)) {
          const ix = Math.min(r.right, pr.right) - Math.max(r.left, pr.left);
          const iy = Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top);
          const visible = ix > 2 && iy > 2;
          if (visible) {
            const cutX = cx && (r.left < pr.left - 2 || r.right > pr.right + 2);
            const cutY = cy && (r.top < pr.top - tol || r.bottom > pr.bottom + tol);
            if (cutX || cutY) {
              const ell = c.textOverflow === 'ellipsis' || cs(p).textOverflow === 'ellipsis' || c.webkitLineClamp !== 'none' || pc.webkitLineClamp !== 'none';
              out.push({ kind: ell ? 'kırpılmış (bilerek: üç nokta/satır sınırı)' : 'kırpılmış', el: label(el), by: label(p), text, d: Math.round(cutY ? Math.max(pr.top - r.top, r.bottom - pr.bottom) : Math.max(pr.left - r.left, r.right - pr.right)) });
              clipped = true;
            }
          }
        }
        // kutu dışı: bölüm / yapışkan sahne dışına taşan satır (kendi içinde kayan kutu sayılmaz: ör. kısa ekranda uzun
        // «İçindekiler» yan sütunu — satır kaydırılarak görülür)
        if (!outside && isBox(p) && pr.height > 0 && pr.width > 0 && !/(auto|scroll)/.test(pc.overflowY)) {
          const over = Math.max(pr.top - r.top, r.bottom - pr.bottom);
          if (over > tol && !(pc.overflowY === 'visible' && p.tagName === 'NAV')) {
            out.push({ kind: 'kutu dışı', el: label(el), by: label(p), text, d: Math.round(over) });
            outside = true;
          }
        }
      }
      // örtülme: satırın ortasından üç nokta
      if (onScreen && !sticky && c.pointerEvents !== 'none') {
        for (const fx of [0.12, 0.5, 0.88]) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height / 2;
          if (x < 1 || x > vw - 1) continue;
          const hit = document.elementFromPoint(x, y);
          if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
          // ortak ataya kadar opak bir öğe var mı?
          let cover = null;
          let stickyCover = false;
          for (let q = hit; q && !q.contains(el); q = q.parentElement) {
            if (opaque(q, x, y)) cover = q;
            if (/(sticky|fixed)/.test(cs(q).position)) stickyCover = true;
          }
          if (cover && !stickyCover && !cover.closest('#hdr, .hdr, .hud, .prog')) {
            out.push({ kind: 'örtülü', el: label(el), by: label(cover), text });
            break;
          }
        }
      }
    }
  }
  return out;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal'] });
const found = new Map();
let checks = 0;
for (const [w, h] of SIZES) {
  const ctx = await guardContext(await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600 }));
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('boraden-fx', 'off');
    } catch (e) {
      /* yoksay */
    }
  });
  const page = await ctx.newPage();
  for (const url of pages) {
    try {
      await page.goto(base + url, { waitUntil: 'load', timeout: 20000 });
    } catch (e) {
      console.log(`  ! ${url} açılamadı: ${String(e.message).split('\n')[0]}`);
      continue;
    }
    await page.waitForTimeout(WORDS ? 250 : 500);
    const total = WORDS ? 0 : await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const step = Math.max(200, Math.round(h * 0.45));
    for (let y = 0; y <= total + step - 1; y += step) {
      if (!WORDS) {
        await page.evaluate((yy) => scrollTo(0, yy), Math.min(y, total));
        await page.waitForTimeout(140);
      }
      const res = await page.evaluate(audit, { words: WORDS });
      checks++;
      for (const it of res) {
        const key = `${url}|${it.kind}|${it.el}|${it.by || ''}|${it.text}`;
        const prev = found.get(key);
        if (prev) prev.sizes.add(`${w}×${h}`);
        else found.set(key, { url, ...it, sizes: new Set([`${w}×${h}`]), y });
      }
    }
  }
  await ctx.close();
}
await browser.close();

const list = [...found.values()];
const order = { 'kutu dışı': 0, kırpılmış: 1, 'kelime bölünmüş': 2, 'yatay taşma': 3, örtülü: 4 };
list.sort((a, b) => a.url.localeCompare(b.url) || (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
console.log(`Kesilen/taşan yazı taraması — ${pages.length} sayfa × ${SIZES.length} ekran, ${checks} kare`);
let errors = 0;
for (const it of list) {
  const warn = it.kind === 'örtülü' || it.kind.startsWith('kırpılmış (bilerek');
  if (!warn) errors++;
  const amount = it.lines ? ` (${it.lines} satıra bölünmüş)` : it.d ? ` (${it.d}px)` : '';
  console.log(`  ${warn ? '⚠' : '✘'} ${it.url} · ${it.kind}${amount} · ${it.el}${it.by ? ` ← ${it.by}` : ''} · «${it.text}» · ${[...it.sizes].join(', ')}`);
}
if (!list.length) console.log('  ✔ sorun yok');
console.log(errors ? `\n✖ ${errors} sorun` : '\nTümü geçti');
process.exit(errors ? 1 : 0);
