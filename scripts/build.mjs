// Statik üretim: src/ → dist/
//   node scripts/build.mjs [--prod]      tam site (sayfalar + varlıklar)
//   node scripts/build.mjs --assets      yalnızca CSS/JS/yazı tipi/görsel (Wagtail hattı için)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import * as esbuild from 'esbuild';
import { makeFilters } from './filters.mjs';
import { buildModel } from './model.mjs';
import { buildRoutes } from './routes.mjs';

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

export function sitemapXML(routes, base) {
  // Bu statik modelde güvenilir içerik revision tarihi yok; build günü lastmod değildir.
  const urls = routes.filter((r) => !r.noindex && !r.searchOnly).map((r) => `  <url><loc>${base}${r.url}</loc></url>`);
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
  const buildId = Date.now().toString(36);
  env.addGlobal('asset', (p) => `/assets/${p}`);
  env.addGlobal('build_id', buildId);
  env.addGlobal('data', data);
  env.addGlobal('site', data.site);
  env.addGlobal('share_image', { ...data.site.shareImage, url: new URL(data.site.shareImage.path, data.site.url).href });
  env.addGlobal('model', model);
  env.addGlobal('groups', model.groups);
  env.addGlobal('services', model.services);
  env.addGlobal('contact', model.contact);

  await Promise.all([
    buildCSS(prod),
    buildJS(prod).catch((e) => {
      if (!lenient) throw e;
      errors++;
      console.error(`[js] HATA: ${String(e.message || e).split('\n').slice(0, 6).join(' | ')}`);
    }),
  ]);
  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'), ['css', 'js']);

  // hesaplayıcı parametre dosyaları (tarayıcıda hesap için yüklenir): /assets/data/params/<yıl>-<alan>.json
  // (iç çalışma notları meta.notes yayına gitmez)
  for (const [key, val] of Object.entries(data.params)) {
    const m = val.meta || {};
    write(path.join(DIST, 'assets/data/params', `${key}.json`), JSON.stringify({ ...val, meta: { id: m.id, year: m.year, verifiedOn: m.verifiedOn } }));
  }

  // sayfalar
  const search = [];
  for (const r of routes) {
    // yalnızca arama dizinine girecek kayıtlar (ör. sözlük terimleri): sayfa üretilmez
    if (r.searchOnly) {
      search.push({ t: r.title, u: r.url, d: (r.description || '').slice(0, 220), k: r.kind || 'Sayfa' });
      continue;
    }
    const page = {
      url: r.url,
      title: r.title,
      titleFull: r.titleFull || `${r.title} — ${data.site.name}`,
      description: r.description || data.site.description,
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
    if (r.searchable && !r.noindex) search.push({ t: r.title, u: r.url, d: (r.description || '').slice(0, 220), k: r.kind || 'Sayfa' });
  }

  // 404
  write(
    path.join(DIST, '404.html'),
    env.render('pages/404.njk', {
      page: { url: '/404.html', title: 'Sayfa bulunamadı', titleFull: 'Sayfa bulunamadı — Boraden', description: '', scene: 0, crumbs: [], bodyClass: 'is-404', noindex: true, canonical: '' },
    })
  );

  // sitemap, robots, arama dizini
  const base = data.site.url.replace(/\/$/, '');
  write(path.join(DIST, 'sitemap.xml'), sitemapXML(routes, base));
  write(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  write(path.join(DIST, 'assets/data/search-index.json'), JSON.stringify(search));

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
