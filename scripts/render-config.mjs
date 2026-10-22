// Müşteri önizlemesi Render'da (22 Ekim 2026): Türkiye'deki servis sağlayıcılar *.vercel.app adreslerini ada göre engelliyor
// (müşteri önizlemeyi açamıyordu); *.onrender.com açılıyor. Render, Vercel gibi `main`'e her push'ta kendiliğinden derleyip yayınlar.
// Bu betik render.yaml'ı vercel.json'dan üretir: derleme, güvenlik başlıkları, noindex, önbellek ve eski site yönlendirmeleri tek
// yerde (vercel.json) kalır. vercel.json değişince: node scripts/render-config.mjs (tests/render-config.test.mjs eşitliği denetler).
//   • Render önizlemesi canlı alan adı değildir: canlıdaki katı içerik güvenlik politikası (Vercel araç çubuğu izinleri olmadan)
//     + X-Robots-Tag: noindex (arama motorlarına kapalı).
//   • Render başlık kuralları sorgu koşulu bilmez: yalnızca ?v= ile istenen site.css / main.js / arama dizini için uzun önbellek
//     atlanır (her ziyarette doğrulanır).
//   • Render yönlendirmeleri her zaman 301'dir ve yalnızca o adreste dosya yoksa uygulanır; sonda «/» olan ve olmayan yazım için
//     ayrı kural yazılır (Vercel önce «/» ekler, sonra yönlendirir).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RENDER_YAML = path.join(ROOT, 'render.yaml');

const q = (s) => JSON.stringify(String(s)); // YAML çift tırnaklı dizgi (JSON dizgisi geçerli YAML'dır)
const isHostRule = (r, key) => (r[key] || []).some((c) => c.type === 'host');

// Vercel kaynak kalıbı → Render yolları: "/(.*)" → "/*"; "/x/(.*).woff2" → "/x/*.woff2"; "(a|b)" grubu → her biri ayrı yol
export function renderPaths(source) {
  const alt = /\(([a-z]+(?:\|[a-z]+)+)\)/i.exec(source);
  if (alt) return alt[1].split('|').flatMap((a) => renderPaths(source.replace(alt[0], a)));
  return [source.replace(/\(\.\*\)/g, '*')];
}

// Önizleme başlıkları: canlıya özel kurallar (host: boraden.com.tr) ve sorgu koşullu kurallar dışarıda; içerik güvenlik politikası
// canlıdakiyle aynı (katı)
export function renderHeaders(v) {
  const liveCsp = v.headers.find((r) => isHostRule(r, 'has'))?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
  if (!liveCsp) throw new Error('vercel.json: canlı alan adının içerik güvenlik politikası bulunamadı');
  const out = [];
  for (const r of v.headers) {
    if (isHostRule(r, 'has')) continue;
    if ((r.has || []).some((c) => c.type !== 'host')) continue;
    for (const p of renderPaths(r.source)) {
      for (const h of r.headers) out.push({ path: p, name: h.key, value: h.key === 'Content-Security-Policy' ? liveCsp : h.value });
    }
  }
  return out;
}

// Yönlendirmeler: ":ad*" → "*"; sonda «/» olan kaynağın «/»suz yazımı da
export function renderRoutes(v) {
  const out = [];
  for (const r of v.redirects || []) {
    const dest = r.destination.replace(/:\w+\*/g, '*');
    const src = r.source.replace(/:\w+\*\/?$/, '*');
    out.push({ type: 'redirect', source: src, destination: dest });
    if (src.endsWith('/') && src.length > 1) out.push({ type: 'redirect', source: src.slice(0, -1), destination: dest });
    else if (src.endsWith('/*')) out.push({ type: 'redirect', source: src.slice(0, -2), destination: dest });
  }
  return out;
}

export function renderYaml(v) {
  const L = [
    '# Bu dosya üretilir — elle değiştirmeyin: node scripts/render-config.mjs (kaynak: vercel.json).',
    '# Müşteri önizlemesi (Render, statik site): Türkiye\'den *.vercel.app açılmıyor, *.onrender.com açılıyor. Ayrıntı: docs/RENDER.md',
    'services:',
    '  - type: web',
    '    runtime: static',
    '    name: boraden-onizleme',
    '    branch: main',
    '    autoDeployTrigger: commit',
    `    buildCommand: ${q('npm ci --ignore-scripts --no-audit --no-fund && npm run build:prod')}`,
    `    staticPublishPath: ${q('./' + (v.outputDirectory || 'dist'))}`,
    '    buildFilter:',
    '      ignoredPaths:',
    ...['docs/**', 'tests/**', '.github/**', 'README.md', 'WAGTAIL_MAP.md'].map((p) => `        - ${q(p)}`),
    '    envVars:',
    '      - key: NODE_VERSION',
    `        value: ${q('22')}`,
    '      - key: SKIP_INSTALL_DEPS',
    `        value: ${q('true')}`,
    '    headers:',
  ];
  for (const h of renderHeaders(v)) L.push(`      - path: ${q(h.path)}`, `        name: ${q(h.name)}`, `        value: ${q(h.value)}`);
  L.push('    routes:');
  for (const r of renderRoutes(v)) L.push(`      - type: ${r.type}`, `        source: ${q(r.source)}`, `        destination: ${q(r.destination)}`);
  return L.join('\n') + '\n';
}

export const loadVercelJson = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const v = loadVercelJson();
  fs.writeFileSync(RENDER_YAML, renderYaml(v));
  console.log(`✔ render.yaml: ${renderHeaders(v).length} başlık, ${renderRoutes(v).length} yönlendirme`);
}
