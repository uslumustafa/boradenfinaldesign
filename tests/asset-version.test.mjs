// Önbellek sürümleri (T-16, T-38): sayfalardaki ?v= değeri dosyanın içerik özetidir (derleme zamanı değil); uzun süre
// («immutable») önbelleğe alınan her dosyanın ya adında özet vardır ya da yalnızca ?v= ile istenir. Derleme çıktısı gerekir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentHash } from '../scripts/build.mjs';
import { loadVercel, route } from '../scripts/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
const skip = !fs.existsSync(path.join(DIST, 'index.html')) && 'derleme çıktısı yok';
const read = (rel) => fs.readFileSync(path.join(DIST, rel));
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

test('?v= = içerik özeti: CSS ve JS her sayfada aynı, dosyanın özetiyle eşit', { skip }, () => {
  const want = { css: contentHash(read('assets/css/site.css')), js: contentHash(read('assets/js/main.js')) };
  assert.match(want.css, /^[0-9a-f]{10}$/);
  const pages = walk(DIST).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length > 100, `sayfa sayısı: ${pages.length}`);
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8');
    const rel = path.relative(DIST, f);
    const css = [...html.matchAll(/href="\/assets\/css\/site\.css(\?v=[^"]*)?"/g)].map((m) => m[1]);
    const js = [...html.matchAll(/src="\/assets\/js\/main\.js(\?v=[^"]*)?"/g)].map((m) => m[1]);
    assert.deepEqual(css, [`?v=${want.css}`], `${rel}: site.css`);
    assert.deepEqual(js, [`?v=${want.js}`], `${rel}: main.js`);
  }
});

test('arama dizininin adresi içerik özetiyle sürümlü', { skip }, () => {
  const html = read('arama/index.html').toString();
  const m = /data-index="\/assets\/data\/search-index\.json\?v=([0-9a-f]+)"/.exec(html);
  assert.ok(m, 'arama sayfasında data-index yok');
  assert.equal(m[1], contentHash(read('assets/data/search-index.json')));
});

test('uzun önbelleğe alınan dosyaların adında içerik özeti var; yazı tipi listesi yayına gitmez', { skip }, () => {
  const cfg = loadVercel();
  const IMM = /immutable/;
  const files = walk(path.join(DIST, 'assets')).map((f) => '/' + path.relative(DIST, f).split(path.sep).join('/'));
  let n = 0;
  for (const p of files) {
    const cc = route(cfg, { pathname: p, host: 'www.boraden.com.tr' }).headers['Cache-Control'] || '';
    if (!IMM.test(cc)) continue;
    n++;
    // esbuild parçaları: ad-XXXXXXXX.js; yazı tipleri: ad.xxxxxxxx.woff2 (scripts/tools/subset-fonts.py)
    assert.match(p, /-[A-Z0-9]{8}\.js(\.map)?$|\.[0-9a-f]{8}\.woff2$/, `${p}: adında özet yok ama «immutable»`);
  }
  assert.ok(n > 10, `immutable dosya sayısı: ${n}`);
  assert.ok(!fs.existsSync(path.join(DIST, 'assets/fonts/fonts.json')), 'fonts.json yayına gitmemeli');
  // CSS'teki yazı tipi adresleri var olan dosyalara gider
  const css = read('assets/css/site.css').toString();
  const urls = [...css.matchAll(/url\((["']?)(\/assets\/fonts\/[^)"']+)\1\)/g)].map((m) => m[2]);
  // her yazı tipi yüzü (src/assets/fonts/fonts.json) CSS'te en az bir kez adreslenir
  const faces = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/fonts/fonts.json'), 'utf8'))).length;
  assert.ok(faces > 0 && urls.length >= faces, `yazı tipi adresi: ${urls.length}, yüz: ${faces}`);
  for (const u of urls) assert.ok(fs.existsSync(path.join(DIST, u)), `${u} yok`);
});
