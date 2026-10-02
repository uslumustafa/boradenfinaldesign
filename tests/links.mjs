// Bağlantı denetleyicisi (geliştirme aracı; test değil): dist/ içindeki tüm HTML'lerde iç bağlantıları ve #bağlantıları doğrular.
//   node tests/links.mjs [--dist=/yol/dist] [--only=/bilgi-merkezi/] [--quiet]
//   BORADEN_DIST ortam değişkeni de kullanılır. Çıkış kodu: kırık bağlantı varsa 1.
//   --only=<önek>: yalnızca bu URL önekiyle başlayan SAYFALARDAKİ bağlantıları denetler (hedefler her zaman tüm dist'te aranır).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const DIST = path.resolve(arg('dist') || process.env.BORADEN_DIST || path.join(ROOT, 'dist'));
const ONLY = arg('only');
const QUIET = process.argv.includes('--quiet');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p === path.join(DIST, 'assets')) continue; // varlıklar: HTML yok
      walk(p, out);
    } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const urlOf = (file) => {
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
};

const files = walk(DIST);
const pages = new Map(); // url → { ids:Set, html }
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  pages.set(urlOf(f), { ids, html });
}

const exists = (p) => {
  const clean = decodeURI(p);
  if (pages.has(clean)) return true;
  if (pages.has(clean.endsWith('/') ? clean : clean + '/')) return true;
  const file = path.join(DIST, clean);
  return fs.existsSync(file) && fs.statSync(file).isFile();
};

const broken = [];
let checked = 0;
for (const [url, { html }] of pages) {
  if (ONLY && !url.startsWith(ONLY)) continue;
  if (url === '/404.html') continue;
  // JSON-LD ve script içeriği değil, yalnızca HTML öznitelikleri
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of body.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    const raw = m[1].replace(/&amp;/g, '&');
    if (!raw || /^(mailto:|tel:|https?:|\/\/|javascript:|data:)/.test(raw)) continue;
    let target = raw;
    let hash = '';
    const hi = target.indexOf('#');
    if (hi >= 0) {
      hash = target.slice(hi + 1);
      target = target.slice(0, hi);
    }
    const q = target.indexOf('?');
    if (q >= 0) target = target.slice(0, q);
    if (target === '') target = url; // yalnızca #hash
    if (!target.startsWith('/')) target = new URL(target, 'http://x' + url).pathname;
    checked++;
    if (!exists(target)) {
      broken.push({ from: url, href: raw, why: 'sayfa yok' });
      continue;
    }
    if (hash && pages.has(target.endsWith('/') ? target : target + '/') || (hash && pages.has(target))) {
      const pg = pages.get(target) || pages.get(target + '/');
      if (pg && !pg.ids.has(decodeURIComponent(hash))) broken.push({ from: url, href: raw, why: `#${hash} yok` });
    }
  }
}

// kırık bağlantıları hedefe göre grupla
const byTarget = new Map();
for (const b of broken) {
  const k = `${b.href}  [${b.why}]`;
  if (!byTarget.has(k)) byTarget.set(k, new Set());
  byTarget.get(k).add(b.from);
}
if (!QUIET) {
  for (const [k, from] of [...byTarget].sort()) {
    const list = [...from];
    console.log(`✗ ${k}\n    ← ${list.slice(0, 4).join(', ')}${list.length > 4 ? ` … (+${list.length - 4})` : ''}`);
  }
}
console.log(`${files.length} sayfa, ${checked} iç bağlantı denetlendi — ${byTarget.size} kırık hedef (${broken.length} bağlantı)`);
process.exit(broken.length ? 1 : 0);
