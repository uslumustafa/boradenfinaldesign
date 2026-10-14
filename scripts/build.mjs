// Statik üretim: src/ → dist/
//   node scripts/build.mjs [--prod]      tam site (sayfalar + varlıklar)
//   node scripts/build.mjs --assets      yalnızca CSS/JS/yazı tipi/görsel (Wagtail hattı için)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import * as esbuild from 'esbuild';
import { makeFilters, metaDesc } from './filters.mjs';
import { buildModel } from './model.mjs';
import { buildRoutes } from './routes.mjs';
import { glossaryAbbrs, linkGlossary } from './gloss-link.mjs';
import { dropFinalPeriod, dropFinalPeriods } from './final-period.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
// BORADEN_DIST: paralel çalışan geliştiricilerin kendi çıktı klasörünü kullanması için (varsayılan: ROOT/dist)
const DIST = process.env.BORADEN_DIST ? path.resolve(process.env.BORADEN_DIST) : path.join(ROOT, 'dist');
export { DIST };

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, s) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
};
// önbellek kırıcı (T-16, T-38): içerik özeti — dosya değişmedikçe adresi (?v=) derlemeden derlemeye aynı kalır
export const contentHash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

export function loadData() {
  const dir = path.join(SRC, 'data');
  const data = {};
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isFile() && f.endsWith('.json')) data[f.replace(/\.json$/, '')] = readJSON(full);
  }
  data.params = {};
  const pdir = path.join(dir, 'params');
  if (fs.existsSync(pdir)) {
    for (const f of fs.readdirSync(pdir)) if (f.endsWith('.json')) data.params[f.replace(/\.json$/, '')] = readJSON(path.join(pdir, f));
  }
  // yasal metinler: data.legal['kvkk-aydinlatma-metni'] …
  data.legal = {};
  const ldir = path.join(dir, 'legal');
  if (fs.existsSync(ldir)) {
    for (const f of fs.readdirSync(ldir)) if (f.endsWith('.json')) data.legal[f.replace(/\.json$/, '')] = readJSON(path.join(ldir, f));
  }
  return data;
}

// lastmod: yalnızca içeriğin kendi tarihi olan sayfalarda (yayın tarihi, parametre/metin güncelleme tarihi — rota › lastmod).
// Derleme günü lastmod değildir; tarihi olmayan sayfada etiket yazılmaz.
export const isoDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(d) ? d : '');
export function sitemapXML(routes, base) {
  const urls = routes
    .filter((r) => !r.noindex && !r.searchOnly)
    .map((r) => {
      const lm = isoDate(r.lastmod);
      return `  <url><loc>${base}${r.url}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function copyDir(src, dest, skip = []) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(e.name) || e.name.startsWith('.')) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else {
      // Değişmeyen dosyaları (ör. 150 MB PDF arşivi) yeniden kopyalama
      let same = false;
      try {
        const ss = fs.statSync(s);
        const ds = fs.statSync(d);
        same = ds.size === ss.size && ds.mtimeMs >= ss.mtimeMs;
      } catch {}
      if (!same) fs.copyFileSync(s, d);
    }
  }
}

async function buildCSS(prod) {
  const dir = path.join(SRC, 'assets/css');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort();
  const css = files.map((f) => `/* ── ${f} */\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const out = prod ? (await esbuild.transform(css, { loader: 'css', minify: true })).code : css;
  write(path.join(DIST, 'assets/css/site.css'), out);
  return out;
}

async function buildJS(prod) {
  await esbuild.build({
    entryPoints: [path.join(SRC, 'assets/js/main.js')],
    bundle: true,
    splitting: true,
    format: 'esm',
    outdir: path.join(DIST, 'assets/js'),
    chunkNames: 'chunks/[name]-[hash]',
    minify: prod,
    sourcemap: !prod,
    target: ['es2021'],
    logLevel: 'warning',
    legalComments: 'none',
  });
}

// Yalnızca ön yüz varlıkları (CSS birleştirme + JS paketi + yazı tipi/görsel kopyası): sayfa üretmez.
// Wagtail/Django hattı için: BORADEN_DIST=../backend/frontend node scripts/build.mjs --assets --prod
// → <çıktı>/assets/{css,js,img,fonts}; Django'da STATICFILES_DIRS = ["<çıktı>/assets"]. PDF arşivi (documents) kopyalanmaz:
// Wagtail'de belgeler wagtaildocs'a aktarılır (bkz. WAGTAIL_MAP.md).
export async function buildAssets({ prod = false, quiet = false } = {}) {
  const t0 = Date.now();
  fs.mkdirSync(DIST, { recursive: true });
  await Promise.all([buildCSS(prod), buildJS(prod)]);
  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'), ['css', 'js', 'documents']);
  if (!quiet) console.log(`✔ varlıklar → ${DIST} (${Date.now() - t0} ms${prod ? ', prod' : ''})`);
}

// Şablon genelleri (derleme ve şablon testleri aynı listeyi kullanır). Sürümler (asset_v, search_v) derleme sırasında eklenir.
export function templateGlobals(data, model) {
  // yazı tipi dosyalarının adında içerik özeti var (scripts/tools/subset-fonts.py → src/assets/fonts/fonts.json)
  const fontManifest = readJSON(path.join(SRC, 'assets/fonts/fonts.json'));
  return {
    asset: (p) => `/assets/${p}`,
    font_url: (key) => {
      if (!fontManifest[key]) throw new Error(`Yazı tipi yok: ${key} (npm run fonts)`);
      return fontManifest[key];
    },
    data,
    site: data.site,
    share_image: { ...data.site.shareImage, url: new URL(data.site.shareImage.path, data.site.url).href },
    model,
    groups: model.groups,
    services: model.services,
    contact: model.contact,
  };
}

export async function build({ prod = false, quiet = false } = {}) {
  const t0 = Date.now();
  if (prod) {
    fs.rmSync(DIST, { recursive: true, force: true });
  } else if (fs.existsSync(DIST)) {
    // Geliştirme: ağır varlıklar (img, fonts, documents) yerinde kalır
    for (const e of fs.readdirSync(DIST)) if (e !== 'assets') fs.rmSync(path.join(DIST, e), { recursive: true, force: true });
    // css/js yerinde kalır (JS derlemesi hata verirse önceki paket çalışmaya devam eder); yalnızca üretilen veri yenilenir
    fs.rmSync(path.join(DIST, 'assets', 'data'), { recursive: true, force: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const data = loadData();
  const model = buildModel(data);
  if (model.relationIssues?.length) throw new Error(`İlişki verisi hatalı:\n  - ${model.relationIssues.join('\n  - ')}`);
  // Yayın öncesi uyarı: ekip kayıtları eski siteden ve kurum şemasından derlendi; müşteri onayı (needsVerification) kalkmadan yayına çıkmamalı
  if (prod && !quiet && model.team?.unverified?.length) {
    const noted = model.team.verifyNotes.map((n) => n.slug);
    console.warn(`⚠ Ekip: ${model.team.unverified.length} kişi kaydı müşteri onayı bekliyor (src/data/team.json → needsVerification)${noted.length ? `; doğrulama notu (verifyNote) olanlar: ${noted.join(', ')}` : ''}`);
  }
  // Geliştirmede (lenient) bir alanın hatası diğer sayfaların derlenmesini engellemez; hata konsola ve ilgili sayfaya yazılır
  const lenient = !prod;
  let errors = 0;
  const routes = buildRoutes(data, model, { lenient, onError: (m) => { errors++; console.error(m); } });

  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(SRC, 'templates')), {
    autoescape: true,
    trimBlocks: true,
    lstripBlocks: true,
  });
  for (const [k, fn] of Object.entries(makeFilters())) env.addFilter(k, fn);
  for (const [k, v] of Object.entries(templateGlobals(data, model))) env.addGlobal(k, v);

  const [css] = await Promise.all([
    buildCSS(prod),
    buildJS(prod).catch((e) => {
      if (!lenient) throw e;
      errors++;
      console.error(`[js] HATA: ${String(e.message || e).split('\n').slice(0, 6).join(' | ')}`);
    }),
  ]);
  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'), ['css', 'js']);
  // yazı tipi dosyalarının adı içerikle değişir: kaynakta artık olmayanlar (geliştirme çıktısında kalanlar) silinir.
  // Yazı tipi listesi (fonts.json) yalnızca derlemede okunur; yayına gitmez.
  const fontsOut = path.join(DIST, 'assets/fonts');
  if (fs.existsSync(fontsOut)) for (const f of fs.readdirSync(fontsOut)) if (!fs.existsSync(path.join(SRC, 'assets/fonts', f))) fs.rmSync(path.join(fontsOut, f), { force: true });
  fs.rmSync(path.join(fontsOut, 'fonts.json'), { force: true });

  // Sürüm (?v=): CSS ve JS giriş dosyasının içerik özeti. vercel.json bu adresleri bir yıl «immutable» önbelleğe alır;
  // dosya değişince özet, dolayısıyla adres değişir. JS parçalarının adında zaten özet var (esbuild chunkNames).
  // JS derlenemediyse (yalnız geliştirmede) zaman damgası: eski dosya önbellekte kalmasın.
  const mainJS = path.join(DIST, 'assets/js/main.js');
  env.addGlobal('asset_v', { css: contentHash(css), js: fs.existsSync(mainJS) ? contentHash(fs.readFileSync(mainJS)) : Date.now().toString(36) });

  // hesaplayıcı parametre dosyaları (tarayıcıda hesap için yüklenir): /assets/data/params/<yıl>-<alan>.json
  // (iç çalışma notları meta.notes yayına gitmez)
  for (const [key, val] of Object.entries(data.params)) {
    const m = val.meta || {};
    write(path.join(DIST, 'assets/data/params', `${key}.json`), JSON.stringify({ ...val, meta: { id: m.id, year: m.year, verifiedOn: m.verifiedOn } }));
  }

  // sözlük bağlantıları (U-42): hizmet, sektör, bilgi merkezi, hesaplayıcı ve takvim sayfaları; sözlük, arama, hukuki metin hariç
  const GLOSS_PAGES = /^\/(hizmetler|sektorler|bilgi-merkezi|hesaplayicilar|vergi-takvimi)\//;
  const GLOSS_SKIP = /^\/bilgi-merkezi\/sozluk\//;
  const glossAbbrs = glossaryAbbrs(model.glossary);

  // arama dizini: sayfalardan önce hazırlanır, adresindeki sürüm (?v=, arama sayfası › data-index) içeriğin özeti olsun
  // (yalnızca-arama kayıtları — sözlük terimleri, SSS soruları… — ve aranabilir, noindex olmayan sayfalar; rota sırasıyla)
  const searchJSON = JSON.stringify(
    routes.filter((r) => r.searchOnly || (r.searchable && !r.noindex)).map((r) => ({ t: dropFinalPeriod(r.title || ''), u: r.url, d: dropFinalPeriod((r.description || '').slice(0, 220)), k: r.kind || 'Sayfa' }))
  );
  env.addGlobal('search_v', contentHash(searchJSON));

  // sayfalar
  for (const r of routes) {
    // yalnızca arama dizinine girecek kayıtlar (ör. sözlük terimleri): sayfa üretilmez
    if (r.searchOnly) continue;
    const page = {
      url: r.url,
      title: r.title,
      titleFull: r.titleFull || `${r.title} — ${data.site.name}`,
      description: metaDesc(r.description || data.site.description),
      ogType: r.ogType || 'website',
      published: isoDate(r.published),
      scene: r.scene,
      fig: r.fig || null,
      kind: r.kind,
      crumbs: r.crumbs,
      bodyClass: r.bodyClass || '',
      noindex: !!r.noindex,
      canonical: data.site.url.replace(/\/$/, '') + r.url,
    };
    let html;
    try {
      html = env.render(r.template, { page, ...(r.ctx || {}) });
      // U-42: kısaltmaların sayfadaki ilk geçişi sözlüğe bağlanır (içerik sayfalarında; sözlüğün kendisi hariç)
      if (GLOSS_PAGES.test(r.url) && !GLOSS_SKIP.test(r.url)) html = linkGlossary(html, glossAbbrs);
      // cümle sonu noktası kuralı (müşteri isteği, Ekim 2026): metin bloklarının son noktası kalkar (final-period.mjs)
      html = dropFinalPeriods(html);
    } catch (e) {
      if (!lenient) throw e;
      errors++;
      const msg = String(e.message || e).split('\n').slice(0, 4).join(' | ');
      console.error(`[sayfa] ${r.url} HATA: ${msg}`);
      const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
      html = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Derleme hatası</title><body style="margin:0;padding:2rem;background:#300;color:#fdd;font:14px/1.5 ui-monospace,monospace"><h1 style="font:600 18px sans-serif">Derleme hatası: ${esc(r.url)}</h1><pre style="white-space:pre-wrap">${esc(e.message || e)}</pre></body></html>`;
    }
    const out = r.url.endsWith('.html') ? path.join(DIST, r.url) : path.join(DIST, r.url, 'index.html');
    write(out, html);
  }

  // 404
  write(
    path.join(DIST, '404.html'),
    dropFinalPeriods(env.render('pages/404.njk', {
      page: { url: '/404.html', title: 'Sayfa bulunamadı', titleFull: 'Sayfa bulunamadı — Boraden', description: '', scene: 0, crumbs: [], bodyClass: 'is-404', noindex: true, canonical: '' },
    }))
  );

  // sitemap, robots, arama dizini
  const base = data.site.url.replace(/\/$/, '');
  write(path.join(DIST, 'sitemap.xml'), sitemapXML(routes, base));
  write(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  write(path.join(DIST, 'assets/data/search-index.json'), searchJSON);

  const pages = routes.filter((r) => !r.searchOnly).length;
  if (!quiet) console.log(`✔ ${pages} sayfa (+${routes.length - pages} yalnızca arama kaydı), ${Date.now() - t0} ms${prod ? ' (prod)' : ''}${errors ? ` — ${errors} HATA` : ''}`);
  return { routes: routes.length, pages, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prod = process.argv.includes('--prod');
  (process.argv.includes('--assets') ? buildAssets({ prod }) : build({ prod })).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
