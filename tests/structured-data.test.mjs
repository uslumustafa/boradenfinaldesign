// Yapılandırılmış veri (JSON-LD) ve paylaşım etiketleri — derleme çıktısı üzerinde (BORADEN_DIST ya da dist/).
// Her sayfa: geçerli JSON, schema.org bağlamı, @type'lı düğümler, boş değer yok, iç adresler var olan sayfalara gider,
// @id başvuruları aynı sayfada çözülür; ana sayfa WebSite + Organization, hizmetler dizini CollectionPage + ItemList taşır;
// yazılar og:type=article (tarihi olanlarda article:published_time).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
const HAS_DIST = fs.existsSync(path.join(DIST, 'index.html'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const BASE = site.url.replace(/\/$/, '');

function pages() {
  const out = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!(rel === '' && e.name === 'assets')) walk(path.join(d, e.name), `${rel}/${e.name}`);
      } else if (e.name === 'index.html') out.push({ url: `${rel}/`, html: fs.readFileSync(path.join(d, e.name), 'utf8') });
    }
  })(DIST, '');
  return out;
}
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const meta = (html, key) => {
  const m = new RegExp(`<meta (?:property|name)="${key.replace(/[:]/g, '\\$&')}" content="([^"]*)">`).exec(html);
  return m ? m[1] : null;
};
function walkNodes(v, fn, pathKey = '') {
  if (Array.isArray(v)) v.forEach((x, i) => walkNodes(x, fn, `${pathKey}[${i}]`));
  else if (v && typeof v === 'object') {
    fn(v, pathKey);
    for (const [k, x] of Object.entries(v)) walkNodes(x, fn, `${pathKey}.${k}`);
  }
}

test('her sayfada geçerli JSON-LD: bağlam, tür, boş değer yok, iç adresler var, @id başvuruları çözülür', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  const all = pages();
  const urls = new Set(all.map((p) => BASE + p.url));
  const problems = [];
  let blocks = 0;
  for (const p of all) {
    const lds = ldOf(p.html);
    if (!lds.length) problems.push(`${p.url}: JSON-LD yok`);
    for (const ld of lds) {
      blocks++;
      if (ld['@context'] !== 'https://schema.org') problems.push(`${p.url}: @context`);
      const nodes = ld['@graph'] || [ld];
      const ids = new Set();
      walkNodes(nodes, (o) => o['@id'] && o['@type'] && ids.add(o['@id']));
      for (const n of nodes) if (!n['@type']) problems.push(`${p.url}: türsüz düğüm`);
      walkNodes(nodes, (o, k) => {
        for (const [key, val] of Object.entries(o)) {
          if (val === null || val === '' || (Array.isArray(val) && !val.length)) problems.push(`${p.url}${k}.${key}: boş değer`);
          if (typeof val === 'string' && /undefined|NaN|\[object/.test(val)) problems.push(`${p.url}${k}.${key}: ${val}`);
          // site içi sayfa adresleri var olmalı (çapa ve sorgu atılır; dosyalar ve arama kalıbı hariç)
          if (['url', 'item', '@id'].includes(key) && typeof val === 'string' && val.startsWith(BASE + '/')) {
            const u = val.replace(/[#?].*$/, '');
            if (!/\.[a-z0-9]+$/i.test(u) && !urls.has(u)) problems.push(`${p.url}${k}.${key}: ${val} sayfası yok`);
          }
        }
        // { "@id": … } yalın başvurusu aynı sayfadaki bir düğüme çözülmeli
        if (o['@id'] && !o['@type'] && Object.keys(o).length === 1 && !ids.has(o['@id']) && !urls.has(o['@id'])) problems.push(`${p.url}${k}: çözülmeyen @id ${o['@id']}`);
        if (o['@type'] === 'BreadcrumbList') o.itemListElement.forEach((it, i) => it.position !== i + 1 && problems.push(`${p.url}: içerik yolu sırası`));
        if (o['@type'] === 'ItemList') o.itemListElement.forEach((it, i) => it.position !== i + 1 && problems.push(`${p.url}: liste sırası`));
        for (const dk of ['datePublished', 'dateModified']) if (o[dk] && !/^\d{4}-\d{2}-\d{2}/.test(o[dk])) problems.push(`${p.url}: ${dk}=${o[dk]}`);
        if (/Article|BlogPosting|NewsArticle/.test(o['@type'] || '') && (!o.headline || o.headline.length > 110)) problems.push(`${p.url}: başlık (headline)`);
      });
    }
  }
  assert.ok(blocks >= all.length - 1);
  assert.deepEqual(problems, []);
});

test('ana sayfa: WebSite (site içi arama) + Organization (site ve iletişim verisinden)', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const g = ldOf(html)[0]['@graph'];
  const ws = g.find((n) => n['@type'] === 'WebSite');
  const org = g.find((n) => n['@type'] === 'Organization');
  assert.equal(ws.url, site.url);
  assert.equal(ws.potentialAction['@type'], 'SearchAction');
  assert.match(ws.potentialAction.target, /\/arama\/\?q=\{search_term_string\}$/);
  assert.equal(ws.publisher['@id'], org['@id']);
  assert.equal(org.legalName, site.legalName);
  assert.equal(org.foundingDate, String(site.founded));
  // aynı kuruluş düğümü Hakkımızda sayfasında da (tek kaynak)
  const about = ldOf(fs.readFileSync(path.join(DIST, 'hakkimizda/index.html'), 'utf8'))[0]['@graph'].find((n) => n['@type'] === 'Organization');
  assert.deepEqual(about, org);
});

test('hizmetler dizini: CollectionPage + 8 alanlık ItemList + içerik yolu', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  const g = ldOf(fs.readFileSync(path.join(DIST, 'hizmetler/index.html'), 'utf8'))[0]['@graph'];
  assert.deepEqual(g.map((n) => n['@type']), ['CollectionPage', 'ItemList', 'BreadcrumbList']);
  const items = g[1].itemListElement;
  assert.ok(items.length >= 8);
  for (const it of items) assert.match(it.url, /\/hizmetler\/[a-z-]+\/$/);
});

test('paylaşım etiketleri: yazılar article, tarihliler yayın zamanı taşır; diğer sayfalar website; küçük kart', { skip: !HAS_DIST && 'derleme çıktısı yok' }, () => {
  let articles = 0;
  let dated = 0;
  for (const p of pages()) {
    const type = meta(p.html, 'og:type');
    const isArticle = /^\/bilgi-merkezi\/(okuma-notlari|sirkulerler|duyurular|blog|haberler|sektor-raporlari)\/[^/]+\/$/.test(p.url) && ldOf(p.html).some((ld) => (ld['@graph'] || [ld]).some((n) => /Article|BlogPosting|NewsArticle|Report/.test(n['@type'])));
    assert.equal(type, isArticle ? 'article' : 'website', `${p.url}: og:type`);
    const pub = meta(p.html, 'article:published_time');
    if (pub) {
      dated++;
      assert.equal(type, 'article');
      const node = ldOf(p.html)[0]['@graph'][0];
      assert.equal(pub, node.datePublished, `${p.url}: yayın zamanı JSON-LD ile aynı`);
    }
    if (isArticle) articles++;
    assert.equal(meta(p.html, 'twitter:card'), site.shareImage.width >= 1200 ? 'summary_large_image' : 'summary');
    const d = meta(p.html, 'description');
    assert.ok(d && d.length <= 160 * 1.1 + 40, `${p.url}: açıklama`); // HTML kaçışları (&#39; vb.) hesaba katılır
  }
  assert.ok(articles >= 20, `yazı sayısı ${articles}`);
  assert.ok(dated >= 1);
});
