// vercel.json: güvenlik başlıkları, içerik güvenlik politikası (CSP), noindex koşulu, eski site yönlendirmeleri ve yerel
// sunucunun (scripts/serve.mjs) bu kuralları yayındaki gibi uygulaması. Derleme çıktısı varsa (BORADEN_DIST ya da dist/)
// sayfalar da taranır: satır içi betiklerin özeti politikada, satır içi olay işleyicisi ve dış kaynak yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { loadVercel, route, serve } from '../scripts/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
const HAS_DIST = fs.existsSync(path.join(DIST, 'index.html'));
const cfg = loadVercel();

const LIVE = ['boraden.com.tr', 'www.boraden.com.tr'];
const PREVIEW = ['boraden-onizleme.vercel.app', 'boraden-onizleme-git-main-ekip.vercel.app', '127.0.0.1', 'localhost'];
// Vercel araç çubuğunun (önizleme yorumları) belgelenmiş izinleri — yalnızca canlı olmayan adreslerde
const TOOLBAR = new Set(['https://vercel.live', 'https://vercel.com', 'https://assets.vercel.com', 'wss://ws-us3.pusher.com', 'blob:']);

const headersFor = (host, pathname = '/') => route(cfg, { pathname, host }).headers;
const parseCSP = (s) =>
  Object.fromEntries(
    s
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((d) => {
        const [k, ...v] = d.split(/\s+/);
        return [k, v];
      })
  );
const sha = (s) => `'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`;
// çalıştırılan satır içi betikler (src yok; tür yok, text/javascript ya da module). JSON veri blokları CSP'ye tabi değildir.
const inlineScripts = (html) =>
  [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs = '']) => !/\ssrc\s*=/.test(attrs))
    .filter(([, attrs = '']) => {
      const t = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
      return !t || /^(text\/javascript|module)$/i.test(t[1]);
    })
    .map((m) => m[2]);

test('noindex yalnızca canlı alan adında kalkar; temel güvenlik başlıkları her yerde', () => {
  for (const host of [...LIVE, ...PREVIEW]) {
    for (const p of ['/', '/hizmetler/', '/assets/css/site.css', '/olmayan/']) {
      const h = headersFor(host, p);
      if (LIVE.includes(host)) assert.equal(h['X-Robots-Tag'], undefined, `${host}${p}: noindex olmamalı`);
      else assert.equal(h['X-Robots-Tag'], 'noindex, nofollow', `${host}${p}: noindex olmalı`);
      assert.equal(h['X-Content-Type-Options'], 'nosniff');
      assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
      assert.equal(h['X-Frame-Options'], 'SAMEORIGIN');
      assert.equal(h['Cross-Origin-Opener-Policy'], 'same-origin');
      assert.match(h['Permissions-Policy'], /camera=\(\)/);
      assert.ok(h['Content-Security-Policy'], `${host}${p}: CSP yok`);
    }
  }
});

test('CSP: canlıda katı; önizleme adreslerinde yalnızca Vercel araç çubuğu izinleri eklenir', () => {
  const live = parseCSP(headersFor('www.boraden.com.tr')['Content-Security-Policy']);
  const prev = parseCSP(headersFor('boraden-onizleme.vercel.app')['Content-Security-Policy']);
  assert.deepEqual(live['default-src'], ["'self'"]);
  assert.deepEqual(live['object-src'], ["'none'"]);
  assert.deepEqual(live['base-uri'], ["'self'"]);
  assert.deepEqual(live['frame-ancestors'], ["'self'"]);
  assert.deepEqual(live['form-action'], ["'self'", 'mailto:']);
  assert.ok('upgrade-insecure-requests' in live);
  assert.ok(!live['script-src'].some((s) => /unsafe-(inline|eval)|^\*$|^https?:$|^data:$|^blob:$/.test(s)), 'script-src gevşek');
  for (const [k, v] of Object.entries(live)) {
    assert.ok(!v.some((s) => /^https?:\/\//.test(s) || s === '*'), `canlı ${k}: dış kaynak izni olmamalı`);
    assert.ok(k in prev, `önizlemede ${k} eksik`);
    for (const s of v) assert.ok(prev[k].includes(s), `önizleme ${k}: ${s} eksik`);
  }
  for (const [k, v] of Object.entries(prev)) {
    for (const s of v) if (!(live[k] || live['default-src']).includes(s)) assert.ok(TOOLBAR.has(s), `önizleme ${k}: beklenmeyen izin ${s}`);
  }
});

test('CSP özeti, şablondaki satır içi betikle aynı (base.njk)', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'src/templates/layouts/base.njk'), 'utf8');
  const scripts = inlineScripts(tpl);
  assert.ok(scripts.length >= 1, 'base.njk satır içi betik bulunamadı');
  assert.ok(scripts.every((s) => !/\{\{|\{%/.test(s)), 'satır içi betik şablon ifadesi içermemeli (özet sabit kalmalı)');
  for (const host of ['www.boraden.com.tr', 'boraden-onizleme.vercel.app']) {
    const src = parseCSP(headersFor(host)['Content-Security-Policy'])['script-src'];
    for (const s of scripts) assert.ok(src.includes(sha(s)), `${host}: ${sha(s)} script-src'de yok — base.njk betiği değiştiyse vercel.json özetini güncelleyin`);
  }
});

test('derleme çıktısı CSP ile uyumlu: özetler, satır içi işleyici, dış kaynak, form hedefleri', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  const live = parseCSP(headersFor('www.boraden.com.tr')['Content-Security-Policy']);
  const htmls = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.html')) htmls.push(f);
    }
  })(DIST);
  assert.ok(htmls.length > 100);
  const problems = [];
  for (const f of htmls) {
    const html = fs.readFileSync(f, 'utf8');
    const rel = path.relative(DIST, f);
    for (const s of inlineScripts(html)) if (!live['script-src'].includes(sha(s))) problems.push(`${rel}: özeti olmayan satır içi betik`);
    const tags = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '<$1>').match(/<[a-z][a-z0-9-]*\b[^>]*>/gi) || [];
    for (const tag of tags) {
      for (const [, name, value = ''] of tag.matchAll(/\s([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
        const n = name.toLowerCase();
        const v = value.replace(/^["']|["']$/g, '').trim();
        if (/^on[a-z]+$/.test(n)) problems.push(`${rel}: satır içi olay işleyicisi ${n}`);
        if (/^javascript:/i.test(v)) problems.push(`${rel}: javascript: adresi`);
        // tarayıcının yükleyeceği kaynaklar aynı kökenden olmalı (bağlantılar — a[href] — gezinmedir, CSP'ye tabi değil)
        const loads = (n === 'src' || n === 'poster' || n === 'srcset' || n === 'data') && !/^<a\b/i.test(tag);
        const linkLoad = n === 'href' && /^<link\b/i.test(tag) && /rel\s*=\s*["']?(stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest|prefetch)/i.test(tag);
        if ((loads || linkLoad) && /(^|,\s*)(https?:)?\/\//i.test(v)) problems.push(`${rel}: dış kaynak ${n}=${v.slice(0, 80)}`);
        if (n === 'action' && /^<form\b/i.test(tag) && !(v.startsWith('/') && !v.startsWith('//')) && !/^mailto:/i.test(v) && v !== '') problems.push(`${rel}: form hedefi ${v}`);
      }
    }
    if (/<style\b/i.test(html) && !live['style-src'].includes("'unsafe-inline'")) problems.push(`${rel}: <style> öğesi`);
    if (/<(iframe|object|embed)\b/i.test(html)) problems.push(`${rel}: iframe/object/embed`);
  }
  assert.deepEqual(problems, []);
});

test('CSS dosyaları dış kaynak yüklemez (font-src/img-src aynı köken + data:)', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  const dir = path.join(DIST, 'assets');
  const css = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.css')) css.push(f);
    }
  })(dir);
  for (const f of css) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/@import\s+(url\()?["']?(https?:)?\/\//i.test(s), `${f}: dış @import`);
    assert.ok(!/url\(\s*["']?(https?:)?\/\//i.test(s), `${f}: dış url()`);
    assert.ok(!/url\(\s*["']?data:(font|application\/(x-)?font)/i.test(s), `${f}: data: yazı tipi (font-src izin vermez)`);
  }
});

test('eski site ve yapı yönlendirmeleri: eğik çizgili kaynak, zincir yok, hedef var, en çok 2 adım', () => {
  const rules = cfg.redirects;
  const sources = rules.map((r) => r.source);
  assert.equal(new Set(sources).size, sources.length, 'yinelenen kaynak');
  const follow = (p) => {
    const hops = [];
    for (let i = 0; i < 5; i++) {
      const r = route(cfg, { pathname: p, host: 'www.boraden.com.tr' });
      if (!r.redirect) return { final: p, hops };
      hops.push(r.redirect.status);
      p = r.redirect.location;
    }
    return { final: p, hops, loop: true };
  };
  const page = (p) => fs.existsSync(path.join(DIST, p, 'index.html'));
  for (const r of rules) {
    assert.ok(r.source.endsWith('/'), `${r.source}: trailingSlash:true olduğundan kaynak / ile bitmeli (yoksa hiç eşleşmez)`);
    assert.ok(!sources.includes(r.destination), `${r.source} → ${r.destination}: zincir`);
    if (HAS_DIST) {
      if (!r.source.includes(':')) assert.ok(!page(r.source), `${r.source}: var olan bir sayfayı gölgeliyor`);
      assert.ok(r.destination === '/' || page(r.destination), `${r.destination}: hedef sayfa yok`);
    }
    const sample = r.source.replace(/:\w+\*\/$/, 'ornek/');
    for (const p of [sample, sample.slice(0, -1)]) {
      const f = follow(p);
      assert.ok(!f.loop, `${p}: döngü`);
      assert.equal(f.final, r.destination, `${p}: yanlış hedef`);
      assert.ok(f.hops.length <= 2, `${p}: ${f.hops.length} adım`);
    }
  }
  // eski siteden doğrulanmış örnekler (Ek B): Akademi eğitimleri, elle eşlenen danışmanlık, İngilizce sayfalar geçici
  const to = (p) => follow(p).final;
  for (const s of ['ic-denetim', 'ufrs', 'finansal-analiz', 'muhasebe-ve-vergi', 'insan-kiymetleri-egitimi']) assert.equal(to(`/${s}`), `/hizmetler/akademi/${s}/`);
  assert.equal(to('/danismanlik'), '/hizmetler/kurumsal-finansman/');
  assert.equal(to('/bagimsiz-denetim'), '/hizmetler/denetim/bagimsiz-denetim/');
  for (const p of ['/en', '/en/', '/en/about-us/']) {
    const f = follow(p);
    assert.equal(f.final, '/');
    assert.equal(f.hops.at(-1), 307, `${p}: İngilizce sayfa yönlendirmesi geçici olmalı`);
  }
  assert.equal(route(cfg, { pathname: '/dokuman/7326_Hesaplama.xlsx' }).redirect, undefined, 'xlsx için karar bekleniyor; kural eklenmemeli');
  assert.ok(rules.filter((r) => !r.source.startsWith('/hizmetler/')).length >= 42, 'eski site kuralları eksik');
});

test('yerel sunucu vercel.json kurallarını uygular (başlık, koşul, yönlendirme, 404)', async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'boraden-vercel-'));
  fs.mkdirSync(path.join(fixture, 'yeni'));
  fs.writeFileSync(path.join(fixture, 'yeni/index.html'), 'yeni');
  fs.writeFileSync(path.join(fixture, '404.html'), 'yok');
  const vercel = {
    trailingSlash: true,
    headers: [
      { source: '/(.*)', headers: [{ key: 'X-A', value: '1' }, { key: 'Content-Security-Policy', value: "default-src 'self'; upgrade-insecure-requests" }] },
      { source: '/(.*)', missing: [{ type: 'host', value: { inc: ['canli.example'] } }], headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/(.*)', has: [{ type: 'host', value: '(www\\.)?canli\\.example' }], headers: [{ key: 'X-Live', value: 'evet' }] },
    ],
    redirects: [
      { source: '/eski/', destination: '/yeni/', permanent: true },
      { source: '/en/:path*/', destination: '/', permanent: false },
      { source: '/kat/:slug/', destination: '/yeni/?k=:slug' },
    ],
  };
  const servers = [serve({ root: fixture, port: 0, quiet: true, vercel }), serve({ root: fixture, port: 0, quiet: true, vercel, host: 'canli.example' })];
  await Promise.all(servers.map((s) => once(s, 'listening')));
  t.after(async () => {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  const get = (server, url, headers = {}) =>
    new Promise((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port: server.address().port, path: url, headers }, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        })
        .on('error', reject);
    });
  const [plain, live] = servers;
  let r = await get(plain, '/yeni/');
  assert.equal(r.status, 200);
  assert.equal(r.headers['x-a'], '1');
  assert.equal(r.headers['x-robots-tag'], 'noindex');
  assert.equal(r.headers['x-live'], undefined);
  assert.equal(r.headers['cache-control'], 'no-cache');
  // yerel sunucu düz http: upgrade-insecure-requests yalnızca yerelde çıkarılır (Chrome fetch yönlendirmesini https'e çevirmesin)
  assert.equal(r.headers['content-security-policy'], "default-src 'self'");
  assert.match(route(vercel, { pathname: '/yeni/' }).headers['Content-Security-Policy'], /upgrade-insecure-requests/);
  r = await get(plain, '/yeni/', { Host: 'www.canli.example' });
  assert.equal(r.headers['x-live'], 'evet', 'Host başlığına göre has koşulu');
  r = await get(live, '/yeni/');
  assert.equal(r.headers['x-robots-tag'], undefined, 'öykünülen canlı alan adında missing koşulu');
  assert.equal(r.headers['x-live'], 'evet');
  r = await get(plain, '/yok/');
  assert.equal(r.status, 404);
  assert.equal(r.headers['x-a'], '1', '404 yanıtında da başlıklar');
  r = await get(plain, '/eski?x=1');
  assert.deepEqual([r.status, r.headers.location], [308, '/eski/?x=1'], 'önce eğik çizgi');
  r = await get(plain, '/eski/?x=1');
  assert.deepEqual([r.status, r.headers.location], [308, '/yeni/?x=1'], 'sonra yeni adres (sorgu korunur)');
  r = await get(plain, '/en/a/b/');
  assert.deepEqual([r.status, r.headers.location], [307, '/']);
  r = await get(plain, '/kat/vergi/');
  assert.deepEqual([r.status, r.headers.location], [308, '/yeni/?k=vergi'], 'adlandırılmış parametre hedefe aktarılır');
  r = await get(plain, '/dosya.pdf/');
  assert.deepEqual([r.status, r.headers.location], [308, '/dosya.pdf'], 'dosya adresinden sondaki / kaldırılır');
});
