// render.yaml (müşteri önizlemesi, Render): vercel.json'dan üretilir ve onunla eşit kalmalı (scripts/render-config.mjs).
// Önizleme arama motorlarına kapalı, içerik güvenlik politikası canlıdaki gibi katı, eski site yönlendirmeleri eksiksiz.
// Derleme çıktısı varsa (BORADEN_DIST ya da dist/): yönlendirme kaynaklarında dosya yok (Render dosyayı yönlendirmeye tercih eder).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderYaml, renderHeaders, renderRoutes, renderPaths, loadVercelJson, RENDER_YAML } from '../scripts/render-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
const HAS_DIST = fs.existsSync(path.join(DIST, 'index.html'));
const v = loadVercelJson();
const headers = renderHeaders(v);
const routes = renderRoutes(v);
const liveCsp = v.headers.find((r) => (r.has || []).some((c) => c.type === 'host')).headers.find((h) => h.key === 'Content-Security-Policy').value;

test('render.yaml güncel (vercel.json değişince: node scripts/render-config.mjs)', () => {
  assert.equal(fs.readFileSync(RENDER_YAML, 'utf8'), renderYaml(v));
});

test('Render önizlemesi: her yolda güvenlik başlıkları, canlıdaki katı politika ve noindex', () => {
  const all = headers.filter((h) => h.path === '/*');
  const get = (n) => all.filter((h) => h.name === n).map((h) => h.value);
  assert.deepEqual(get('X-Robots-Tag'), ['noindex, nofollow']);
  assert.deepEqual(get('X-Content-Type-Options'), ['nosniff']);
  assert.deepEqual(get('Referrer-Policy'), ['strict-origin-when-cross-origin']);
  assert.deepEqual(get('X-Frame-Options'), ['SAMEORIGIN']);
  assert.deepEqual(get('Cross-Origin-Opener-Policy'), ['same-origin']);
  assert.equal(get('Permissions-Policy').length, 1);
  assert.deepEqual(get('Content-Security-Policy'), [liveCsp], 'önizlemede canlıdaki politika (Vercel araç çubuğu izinleri yok)');
  assert.doesNotMatch(liveCsp, /vercel|pusher/);
  const seen = new Set();
  for (const h of headers) {
    const k = `${h.path} ${h.name.toLowerCase()}`;
    assert.ok(!seen.has(k), `${k}: iki kez`);
    seen.add(k);
  }
});

test('önbellek: özetli JS parçaları ve yazı tipleri bir yıl «immutable», görsel/video/PDF bir gün', () => {
  const cc = (p) => headers.filter((h) => h.path === p && h.name === 'Cache-Control').map((h) => h.value);
  assert.deepEqual(cc('/assets/js/chunks/*'), ['public, max-age=31536000, immutable']);
  assert.deepEqual(cc('/assets/fonts/*.woff2'), ['public, max-age=31536000, immutable']);
  for (const p of ['/assets/img/*', '/assets/video/*', '/assets/documents/*']) assert.deepEqual(cc(p), ['public, max-age=86400'], p);
  assert.ok(!headers.some((h) => /[()|]/.test(h.path)), 'çevrilmemiş kalıp kaldı');
  assert.ok(!headers.some((h) => h.path === '/*' && h.name === 'Cache-Control'), 'HTML varsayılan önbellekte kalmalı');
});

test('kalıp çevirisi (Vercel → Render)', () => {
  assert.deepEqual(renderPaths('/(.*)'), ['/*']);
  assert.deepEqual(renderPaths('/assets/js/chunks/(.*)'), ['/assets/js/chunks/*']);
  assert.deepEqual(renderPaths('/assets/fonts/(.*).woff2'), ['/assets/fonts/*.woff2']);
  assert.deepEqual(renderPaths('/assets/(img|video|documents)/(.*)'), ['/assets/img/*', '/assets/video/*', '/assets/documents/*']);
});

test('yönlendirmeler: vercel.json\'daki her kural, sonda «/» olan ve olmayan yazımla', () => {
  assert.ok(v.redirects.length > 0);
  for (const r of v.redirects) {
    const dest = r.destination.replace(/:\w+\*/g, '*');
    const src = r.source.replace(/:\w+\*\/?$/, '*');
    const bare = src.endsWith('/*') ? src.slice(0, -2) : src.slice(0, -1);
    assert.ok(routes.some((x) => x.source === src && x.destination === dest), src);
    assert.ok(routes.some((x) => x.source === bare && x.destination === dest), bare);
  }
  assert.equal(routes.length, v.redirects.length * 2);
  assert.equal(new Set(routes.map((r) => r.source)).size, routes.length, 'aynı kaynak iki kez');
  for (const r of routes) {
    assert.equal(r.type, 'redirect');
    assert.ok(r.source.startsWith('/') && r.source.length > 1, `${r.source}: kök ya da göreli olamaz`);
    assert.ok(r.destination.startsWith('/'), `${r.destination}: site içi olmalı`);
  }
});

test('derleme çıktısı: yönlendirme kaynaklarında sayfa ya da dosya yok', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  for (const r of routes) {
    if (r.source.includes('*')) continue;
    const rel = r.source.replace(/^\//, '');
    assert.ok(!fs.existsSync(path.join(DIST, rel, 'index.html')), `${r.source}: dist'te sayfa var — Render yönlendirmeyi uygulamaz`);
    if (!r.source.endsWith('/')) assert.ok(!fs.existsSync(path.join(DIST, rel)) || fs.statSync(path.join(DIST, rel)).isDirectory(), `${r.source}: dist'te dosya var`);
  }
});
