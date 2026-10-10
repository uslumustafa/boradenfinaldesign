// Sözlük bağlantıları (U-42): kısaltmanın sayfadaki ilk geçişi sözlük maddesine bağlanır; başlık, bağlantı, menü, künye,
// aydınlanan metin, tablo ve betik içinde bağlanmaz. Derleme çıktısı varsa (BORADEN_DIST ya da dist/) sayfalar da denetlenir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glossaryAbbrs, linkGlossary } from '../scripts/gloss-link.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
const HAS_DIST = fs.existsSync(path.join(DIST, 'index.html'));

const G = [
  { slug: 'kdv', term: 'KDV (Katma Değer Vergisi)' },
  { slug: 'kdv-iadesi', term: 'KDV iadesi' },
  { slug: 'mersis', term: 'MERSİS' },
  { slug: 'ufrs-tfrs', term: 'UFRS / TFRS' },
  { slug: 'bobi-frs', term: 'BOBİ FRS' },
  { slug: 'tms-29', term: 'TMS 29 (yüksek enflasyonlu ekonomiler)' },
  { slug: 'tds', term: 'Türkiye Denetim Standartları (TDS)' },
  { slug: 'sgk-primi', term: 'SGK primi' },
  { slug: 'bordro', term: 'Bordro' },
];

test('sözlükten kısaltmalar: kendi maddesi olanlar; «SGK primi» gibi kısaltmayla başlayan başka madde kısaltmayı sahiplenmez', () => {
  const m = Object.fromEntries(glossaryAbbrs(G).map((x) => [x.abbr, x.slug]));
  assert.deepEqual(m, { 'BOBİ FRS': 'bobi-frs', MERSİS: 'mersis', 'TMS 29': 'tms-29', UFRS: 'ufrs-tfrs', TFRS: 'ufrs-tfrs', KDV: 'kdv', TDS: 'tds' });
});

const page = (main) => `<!doctype html><html><head><title>KDV</title><script type="application/ld+json">{"x":"KDV"}</script></head><body><header>KDV</header><main id="main">${main}</main><footer>KDV</footer></body></html>`;
const links = (html) => [...html.matchAll(/<a class="gl-abbr" href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1].split('#')[1], m[2]]);

test('ilk geçiş bağlanır, ikincisi bağlanmaz; ek («KDV’nin») bağlantının dışında kalır; <main> dışına dokunulmaz', () => {
  const out = linkGlossary(page('<p>Bu KDV’nin iadesi. Yine KDV ve MERSİS kaydı; sonra MERSİS.</p><p>KDV tekrar.</p>'), glossaryAbbrs(G));
  assert.deepEqual(links(out), [['kdv', 'KDV'], ['mersis', 'MERSİS']]);
  assert.match(out, />KDV<\/a>’nin iadesi/);
  assert.match(out, /<title>KDV<\/title>/);
  assert.match(out, /<header>KDV<\/header>/);
  assert.match(out, /<footer>KDV<\/footer>/);
  assert.match(out, /title="Sözlük: KDV \(Katma Değer Vergisi\)"/);
});

test('başlık, bağlantı, düğme, içindekiler, künye, aydınlanan metin, tablo ve betik içinde bağlanmaz', () => {
  const main = [
    '<h2>KDV başlıkta</h2>',
    '<a href="/x/">KDV bağlantıda</a>',
    '<button>KDV</button>',
    '<nav class="toc"><p>KDV</p></nav>',
    '<dl class="kunye"><dd>KDV</dd></dl>',
    '<p data-lit>KDV aydınlanan</p>',
    '<table><tr><td>KDV</td></tr></table>',
    '<script type="application/json">{"a":"<b>KDV</b>"}</script>',
    '<p class="eyebrow mono">KDV</p>',
    '<p>Burada KDV bağlanır.</p>',
  ].join('');
  const out = linkGlossary(page(main), glossaryAbbrs(G));
  assert.deepEqual(links(out), [['kdv', 'KDV']]);
  assert.match(out, /Burada <a class="gl-abbr"[^>]*>KDV<\/a> bağlanır/);
  assert.match(out, /\{"a":"<b>KDV<\/b>"\}/, 'betik içeriği değişmez');
});

test('çok kelimeli kısaltma ve aynı maddenin iki kısaltması (UFRS / TFRS yalnızca bir kez); sözcük içinde eşleşmez', () => {
  const out = linkGlossary(page('<p>BOBİ FRS ile TMS/TFRS ve UFRS; TMS 29 uygulaması. KDVLİ değil, AKDV değil.</p>'), glossaryAbbrs(G));
  assert.deepEqual(links(out), [['bobi-frs', 'BOBİ FRS'], ['ufrs-tfrs', 'TFRS'], ['tms-29', 'TMS 29']]);
});

test('derleme çıktısı: madde başına sayfada en çok bir bağlantı, hedef var, başlıkta ve sözlük sayfasında yok', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  const gl = fs.readFileSync(path.join(DIST, 'bilgi-merkezi/sozluk/index.html'), 'utf8');
  const ids = new Set([...gl.matchAll(/<article class="gl-term" id="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(ids.size >= 50);
  assert.equal((gl.match(/class="gl-abbr"/g) || []).length, 0, 'sözlük kendine bağlanmaz');
  let total = 0;
  const problems = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!(rel === '' && e.name === 'assets')) walk(path.join(d, e.name), `${rel}/${e.name}`);
      } else if (e.name === 'index.html') {
        const html = fs.readFileSync(path.join(d, e.name), 'utf8');
        const ls = links(html);
        total += ls.length;
        const seen = new Set();
        for (const [slug] of ls) {
          if (seen.has(slug)) problems.push(`${rel}/: ${slug} iki kez`);
          seen.add(slug);
          if (!ids.has(slug)) problems.push(`${rel}/: #${slug} sözlükte yok`);
        }
        if (/<h[1-6][^>]*>[^<]*(<[^/][^>]*>[^<]*)*<a class="gl-abbr"/.test(html)) problems.push(`${rel}/: başlıkta sözlük bağlantısı`);
      }
    }
  })(DIST, '');
  assert.ok(total >= 20, `bağlantı sayısı ${total}`);
  assert.deepEqual(problems, []);
});
