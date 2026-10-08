// Hizmet / hizmet alanı / hizmetler dizini / sektör sayfalarının DERLENMİŞ çıktısı (dist) ile model tutarlılığı.
// Tarayıcı gerekmez; ortak bloklar (partials/blocks.njk) veri yokken hiçbir şey çizmemeli, veri varken eksiksiz çizmelidir.
//   node --test tests/services.test.mjs        (önce: npm run build — dev sunucusu çalışıyorsa dist zaten güncel)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../scripts/build.mjs';
import { buildModel } from '../scripts/model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, process.env.BORADEN_DIST || 'dist');
const model = buildModel(loadData());

const page = (url) => {
  const f = path.join(dist, url, 'index.html');
  assert.ok(fs.existsSync(f), `${url}: derlenmiş sayfa yok (${f})`);
  return fs.readFileSync(f, 'utf8');
};
const count = (s, re) => (s.match(re) || []).length;
const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const has = (s, id) => new RegExp(`\\sid="${id}"`).test(s);
// Görünür metin (betik/stil dışı) — şablon sızıntıları için
const visible = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const toc = (s) => (s.match(/<nav class="toc" data-toc[\s\S]*?<\/nav>/) || [''])[0];
const tocIds = (s) => [...toc(s).matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const kunyeRef = (s) => (s.match(/<div class="kunye__ref"><dt>Ref\.<\/dt><dd class="tnum">([^<]+)<\/dd>/) || [])[1];

test('her hizmet sayfası: tek h1, benzersiz kimlikler, «Bu sayfada» menüsü bölümlerle birebir', () => {
  assert.equal(model.services.length, 60);
  for (const s of model.services) {
    const h = page(s.url);
    assert.equal(count(h, /<h1[\s>]/g), 1, `${s.id}: tek h1 olmalı`);
    const all = ids(h);
    assert.equal(new Set(all).size, all.length, `${s.id}: yinelenen id: ${all.filter((x, i) => all.indexOf(x) !== i).join(', ')}`);
    const t = tocIds(h);
    assert.ok(t.length >= 4, `${s.id}: menüde en az 4 bölüm olmalı (${t.length})`);
    for (const id of t) assert.ok(has(h, id), `${s.id}: menü bağlantısı #${id} bir bölüme gitmiyor`);
    // menüdeki her bölüm sayfada, sayfadaki her svc__sec menüde
    const secIds = [...h.matchAll(/<section class="svc__sec" id="([^"]+)"/g)].map((m) => m[1]);
    for (const id of secIds) assert.ok(t.includes(id), `${s.id}: #${id} bölümü menüde yok`);
  }
});

test('hizmet sayfası bölümleri veriyle birlikte açılıp kapanır (boş bölüm çizilmez)', () => {
  for (const s of model.services) {
    const h = page(s.url);
    const nScope = s.scopeItems.length;
    const nSteps = (s.steps || []).length;
    const nFaq = (s.faqs || []).length + model.generalFaq.length;
    assert.equal(has(h, 'surec'), nSteps > 0, `${s.id}: süreç bölümü`);
    assert.equal(has(h, 'not'), !!s.note, `${s.id}: not bölümü`);
    assert.equal(has(h, 'sss'), nFaq > 0, `${s.id}: SSS bölümü`);
    assert.equal(has(h, 'kaynaklar'), s.srcList.length > 0, `${s.id}: kaynaklar bölümü`);
    assert.equal(has(h, 'ilgili'), s.related.total > 0, `${s.id}: ilgili içerik bölümü`);
    assert.equal(has(h, 'ekip'), (s.people || []).length > 0, `${s.id}: ekip bandı`);
    // kapsam ızgarası: madde sayısı kadar kart ve eşleşen sütun sınıfı
    assert.equal(count(h, /class="sc sc--[brg]"/g), nScope, `${s.id}: kapsam kartı sayısı`);
    assert.ok(h.includes(`sgrid sgrid--${nScope}`), `${s.id}: sgrid--${nScope} sınıfı`);
    if (nSteps) {
      assert.equal(count(h, /class="flow__i"/g), nSteps, `${s.id}: süreç adımı sayısı`);
      assert.ok(h.includes(`flow flow--${nSteps}`) && h.includes(`--n: ${nSteps}`), `${s.id}: flow--${nSteps}`);
    } else assert.ok(!/class="flow\b/.test(h), `${s.id}: adımsız hizmette süreç çizilmemeli`);
    if (s.related.total) assert.ok(count(h, /class="rel__row/g) >= 1, `${s.id}: ilgili içerik satırı yok`);
    const sss = (h.match(/<section class="svc__sec" id="sss">[\s\S]*?<\/section>/) || [''])[0];
    assert.equal(count(sss, /<details>/g), nFaq, `${s.id}: SSS öğesi sayısı`);
    assert.equal(count(h, /class="srclink"/g), s.srcList.length, `${s.id}: kaynak bağlantısı sayısı`);
  }
});

test('hizmet sayfası: künye numarası modelle aynı, alan bağlantısı doğru, fotoğraf süs görseli (alt boş)', () => {
  for (const s of model.services) {
    const h = page(s.url);
    assert.equal(count(h, /<dl class="kunye"/g), 1, `${s.id}: tek künye`);
    assert.equal(kunyeRef(h), s.ref, `${s.id}: künye numarası`);
    assert.ok(h.includes(`<a href="${s.groupSlug ? `/hizmetler/${s.groupSlug}/` : ''}">`), `${s.id}: künyede alan bağlantısı`);
    assert.equal(count(h, /<figure class="sfig/g), 1, `${s.id}: tek fotoğraf bandı`);
    const fig = h.match(/<figure class="sfig[\s\S]*?<\/figure>/)[0];
    assert.match(fig, /\salt=""/, `${s.id}: fotoğraf alt metni boş (süs) olmalı`);
    assert.ok(fig.includes(`/assets/img/photos/${s.photo}-`), `${s.id}: fotoğraf ${s.photo} kullanılmıyor`);
    assert.doesNotMatch(fig, /<figcaption/, `${s.id}: fotoğrafın altında yazı olmamalı (müşteri isteği)`);
  }
});

test('«Çalışma biçimimiz» bandı: her hizmet ve alan sayfasında, alanın sahnesiyle', () => {
  const pages = [...model.services.map((s) => [s.url, s.scene]), ...model.groups.map((g) => [g.url, g.scene])];
  for (const [url, scene] of pages) {
    const h = page(url);
    assert.equal(count(h, /class="ab-method mth sec--dark"/g), 1, `${url}: tek bant`);
    assert.match(h, new RegExp(`class="ab-method mth sec--dark" data-world="${scene}"`), `${url}: sahne ${scene}`);
    assert.equal(count(h, /class="ab-princ__i mth__i/g), model.approach.steps.length, `${url}: adım sayısı`);
  }
});

test('hizmet alanı sayfaları: kart sayısı hizmet sayısına eşit, künye alan numarası, ≥4 HUD bölümü', () => {
  assert.equal(model.groups.length, 8);
  for (const g of model.groups) {
    const h = page(g.url);
    assert.equal(count(h, /<h1[\s>]/g), 1, `${g.id}: tek h1`);
    assert.equal(count(h, /class="acard acard--[brg]"/g), g.services.length, `${g.id}: hizmet kartı sayısı`);
    for (const s of g.services) assert.ok(h.includes(`href="${s.url}"`), `${g.id}: ${s.id} kartı yok`);
    assert.equal(kunyeRef(h), g.number, `${g.id}: künye numarası`);
    assert.equal(count(h, /<figure class="sfig sfig--wide/g), 1, `${g.id}: alan fotoğrafı`);
    // HUD: elle işaretli bölümler (Hizmetler, Sorular?, İlgili?, Ekip, İletişim) ≥4 olmalı
    const chapters = count(h, /data-chapter="/g);
    assert.ok(chapters >= 4, `${g.id}: ${chapters} işaretli bölüm (≥4 olmalı)`);
    assert.equal(has(h, 'sss'), g.related.faq.length + model.generalFaq.length > 0, `${g.id}: SSS`);
    assert.equal(has(h, 'ilgili'), g.related.sectors.length + g.related.calculators.length > 0, `${g.id}: ilgili`);
    const all = ids(h);
    assert.equal(new Set(all).size, all.length, `${g.id}: yinelenen id`);
    // alandaki SSS'ler tekrarsız (aynı soru iki kez gelmez)
    const qs = [...h.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1].trim().toLocaleLowerCase('tr-TR'));
    assert.equal(new Set(qs).size, qs.length, `${g.id}: yinelenen soru`);
  }
});

test('hizmetler dizini: sekiz alan kartı, her biri alan sayfasına ve fotoğrafa sahip', () => {
  const h = page('/hizmetler/');
  assert.equal(count(h, /<h1[\s>]/g), 1);
  assert.equal(count(h, /class="agc agc--[brg]"/g), model.groups.length);
  for (const g of model.groups) {
    assert.ok(h.includes(`href="${g.url}"`), `dizinde ${g.id} kartı yok`);
    assert.ok(h.includes(`/assets/img/photos/${g.photo}-`), `dizinde ${g.id} fotoğrafı (${g.photo}) yok`);
  }
  // kart fotoğrafları süstür (alt boş); filtre/arama listesi (eski yapı) yerinde
  const card = h.match(/<span class="agc__media"[\s\S]*?<\/span>/)[0];
  assert.match(card, /\salt=""/);
  assert.match(h, /data-listing="services"/);
});

test('sektör sayfaları: bölüm başlıkları animasyona bağlı, hizmet ızgarası tek sayıda da düzenli', () => {
  for (const sec of model.sectors) {
    const h = page(sec.url);
    assert.equal(count(h, /<h1[\s>]/g), 1, `${sec.slug}: tek h1`);
    const labels = h.match(/<h2 class="svc__label[^>]*>/g) || [];
    assert.ok(labels.length >= 4, `${sec.slug}: bölüm başlığı sayısı`);
    for (const l of labels) assert.ok(l.includes('data-reveal'), `${sec.slug}: ${l} data-reveal taşımıyor`);
    assert.equal(count(h, /<a class="sx-svc"/g), (sec.services || []).length, `${sec.slug}: hizmet kartı sayısı`);
  }
  // tek sayıda kart için son hücrenin tam genişliğe yayılması CSS'te tanımlı
  const css = fs.readFileSync(path.join(root, 'src/assets/css/72-sectors.css'), 'utf8');
  assert.match(css, /\.sx-svcs > li:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1 \/ -1/);
});

test('tüm sitede: her .svc__label animasyona bağlı (data-reveal) — şablon eklenirken unutulmaz', () => {
  const bad = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html' || e.name.endsWith('.html')) {
        const h = fs.readFileSync(p, 'utf8');
        for (const m of h.matchAll(/<h2 class="svc__label[^>]*>/g)) if (!m[0].includes('data-reveal')) bad.push(`${path.relative(dist, p)}: ${m[0]}`);
      }
    }
  };
  walk(dist);
  assert.deepEqual(bad.slice(0, 5), []);
});

test('şablon sızıntısı yok: undefined, [object Object], NaN, süslü parantez görünür metinde çıkmaz', () => {
  const urls = ['/hizmetler/', ...model.groups.map((g) => g.url), ...model.services.map((s) => s.url), ...model.sectors.map((s) => s.url)];
  for (const url of urls) {
    const t = visible(page(url));
    for (const re of [/\bundefined\b/, /\[object Object\]/, /\bNaN\b/, /\{\{|\}\}/, /\{%|%\}/]) assert.ok(!re.test(t), `${url}: ${re} bulundu`);
  }
});

test('şekillerin ve fotoğrafların altında «Şekil NN · …» ya da «Boraden arşivi» alt yazısı yok (müşteri isteği, Ekim 2026)', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' ? [path.join(d, e.name)] : []));
  const files = walk(dist);
  assert.ok(files.length > 100, `derlenmiş sayfa sayısı ${files.length}`);
  for (const f of files) {
    const h = visible(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(dist, f);
    assert.doesNotMatch(h, /class="(?:fig__cap|sfig__cap|areas__cap|hero__fig)\b/, `${rel}: şekil/fotoğraf alt yazısı öğesi`);
    assert.doesNotMatch(h, /Şekil (?:\d{2} )?·/, `${rel}: «Şekil · …» yazısı`);
    assert.doesNotMatch(h, />Boraden arşivi</, `${rel}: «Boraden arşivi» alt yazısı`);
  }
  const figJs = fs.readFileSync(path.join(root, 'src/assets/js/modules/figure.js'), 'utf8');
  assert.ok(!figJs.includes('Şekil ·'), 'figure.js alt yazı üretmemeli');
});
