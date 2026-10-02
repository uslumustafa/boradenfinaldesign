// Ters ilişkiler (scripts/relations.mjs) ve model entegrasyonu: hizmet ↔ sektör/hesaplayıcı/terim/yazı, alan toplamları,
// genel SSS, fotoğraf havuzu, «Çalışma biçimimiz» verisi. DOM/tarayıcı gerekmez.
//   node --test tests/relations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateFaq, buildRelations, pickGeneralFaq, MAX_AREA_FAQ } from '../scripts/relations.mjs';
import { loadData } from '../scripts/build.mjs';
import { buildModel, GROUP_PHOTOS } from '../scripts/model.mjs';

// ——— Yapay veri: iki alan, dört hizmet
const mk = () => {
  const groups = [{ id: 'a' }, { id: 'b' }];
  const svc = (id, group, faqs) => ({ id, group, title: id.toUpperCase(), url: `/hizmetler/${group}/${id}/`, faqs });
  const services = [
    svc('s1', 'a', [['Süre ne kadar?', 'Kapsama bağlı.'], ['Belge gerekir mi?', 'Evet.']]),
    svc('s2', 'a', [['Süre ne kadar?', 'Başka yanıt (yinelenen soru).'], ['Ücret?', 'Kapsama göre.']]),
    svc('s3', 'b', []),
    svc('s4', 'b'),
  ];
  const sectors = [
    { slug: 'x', name: 'X', short: 'x kısa', url: '/sektorler/x/', services: ['s1', 's2', 's3'] },
    { slug: 'y', name: 'Y', short: 'y kısa', url: '/sektorler/y/', services: ['s3'], segment: true },
    { slug: 'z', name: 'Z', short: 'z kısa', url: '/sektorler/z/', services: ['s1', 's2'] },
  ];
  const calculators = [
    { slug: 'c1', title: 'C1', url: '/hesaplayicilar/c1/', relatedServices: ['s1'], groupLabel: 'Vergi' },
    { slug: 'c2', title: 'C2', url: '/hesaplayicilar/c2/', relatedServices: ['s1', 's3'] },
  ];
  const glossary = [
    { slug: 't1', term: 'Terim 1', short: 'k1', category: 'Genel', url: '/bilgi-merkezi/sozluk/#t1', services: ['s1'] },
    { slug: 't2', term: 'Terim 2', short: 'k2', category: 'Genel', url: '/bilgi-merkezi/sozluk/#t2', services: ['s1', 's4'] },
    { slug: 't3', term: 'Terim 3', short: 'k3', category: 'Genel', url: '/bilgi-merkezi/sozluk/#t3' },
  ];
  const publications = {
    blog: [
      { id: 'p1', status: 'published', title: 'Yazı 1', summary: 's', category: 'K', date: '2026-01-01', typeLabel: 'Blog', url: '/bilgi-merkezi/blog/p1/', service: 's1' },
      { id: 'p2', status: 'published', title: 'Yazı 2', summary: 's', category: 'K', date: '2026-01-02', typeLabel: 'Blog', url: '/bilgi-merkezi/blog/p2/', service: ['s1', 's4'] },
      { id: 'p3', status: 'draft', title: 'Taslak', summary: 's', category: 'K', date: '2026-01-03', typeLabel: 'Blog', url: '/bilgi-merkezi/blog/p3/', service: 's1' },
    ],
    news: [{ id: 'n1', title: 'Haber', url: '/bilgi-merkezi/haberler/n1/' }],
  };
  return { groups, services, sectors, calculators, glossary, publications };
};

test('hizmet ters ilişkileri: sektör, hesaplayıcı, terim, yazı — yalnızca açık bağlantılar', () => {
  const r = buildRelations(mk());
  const s1 = r.byService.s1;
  assert.deepEqual(s1.sectors.map((x) => x.slug), ['x', 'z']);
  assert.deepEqual(s1.calculators.map((x) => x.slug), ['c1', 'c2']);
  assert.deepEqual(s1.terms.map((x) => x.slug), ['t1', 't2']);
  assert.deepEqual(s1.posts.map((x) => x.id), ['p1', 'p2']); // taslak yazı sayılmaz
  assert.equal(s1.total, 2 + 2 + 2 + 2);
  assert.deepEqual(r.byService.s4.terms.map((x) => x.slug), ['t2']);
  assert.deepEqual(r.byService.s4.posts.map((x) => x.id), ['p2']); // id listesi biçimi de çalışır
  assert.equal(r.byService.s2.calculators.length, 0);
  assert.equal(r.issues.length, 0);
});

test('özetler düzdür: çevrimsel başvuru ve ağır alan yok (JSON.stringify patlamaz)', () => {
  const r = buildRelations(mk());
  assert.doesNotThrow(() => JSON.stringify(r));
  assert.deepEqual(Object.keys(r.byService.s1.sectors[0]).sort(), ['name', 'segment', 'short', 'slug', 'url']);
  assert.equal(r.byService.s1.sectors[0].services, undefined);
});

test('bilinmeyen hizmet kimliği derleme sırasında raporlanır', () => {
  const ctx = mk();
  ctx.sectors[0].services.push('yok');
  ctx.glossary[0].services.push('yok-2');
  ctx.publications.blog[0].service = 'yok-3';
  const r = buildRelations(ctx);
  const text = r.issues.join('\n');
  assert.match(text, /sectors\.json › x: bilinmeyen hizmet «yok»/);
  assert.match(text, /glossary\.json › t1: bilinmeyen hizmet «yok-2»/);
  assert.match(text, /yayın › p1: bilinmeyen hizmet «yok-3»/);
});

test('alan toplamları: sektörler kaç hizmetle anıldığına göre sıralanır; hesaplayıcılar ve birleşik SSS gelir', () => {
  const r = buildRelations(mk());
  // a alanı (s1, s2): x → 2, z → 2 (eşitlikte sektör sırası), y → 0 (listelenmez)
  assert.deepEqual(r.byGroup.a.sectors.map((x) => [x.slug, x.n]), [['x', 2], ['z', 2]]);
  assert.deepEqual(r.byGroup.b.sectors.map((x) => [x.slug, x.n]), [['x', 1], ['y', 1]]);
  assert.deepEqual(r.byGroup.a.calculators.map((x) => x.slug), ['c1', 'c2']);
  assert.deepEqual(r.byGroup.a.calculators[1].serviceTitles, ['S1']);
  assert.deepEqual(r.byGroup.b.calculators.map((x) => x.slug), ['c2']);
  // SSS: yinelenen soru (normalize edilmiş) ilk hizmetten alınır; hizmet bilgisi taşınır
  assert.deepEqual(r.byGroup.a.faq.map((f) => [f.q, f.serviceId]), [['Süre ne kadar?', 's1'], ['Belge gerekir mi?', 's1'], ['Ücret?', 's2']]);
  assert.equal(r.byGroup.b.faq.length, 0);
});

test('birleşik SSS: tekrarsız, sınırlı ve soru işareti/büyük-küçük harf farkını yok sayar', () => {
  const mkf = (id, qs) => ({ id, title: id, url: `/${id}/`, faqs: qs.map((q) => [q, 'yanıt']) });
  const list = [mkf('a', ['Süre ne kadar?', 'İlk soru']), mkf('b', ['SÜRE ne kadar', 'Ücret?']), mkf('c', ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'])];
  const all = aggregateFaq(list, 99);
  assert.deepEqual(all.map((f) => f.q), ['Süre ne kadar?', 'İlk soru', 'Ücret?', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
  assert.equal(aggregateFaq(list).length, MAX_AREA_FAQ);
  assert.equal(aggregateFaq(list, 2).length, 2);
  assert.deepEqual(aggregateFaq([{ id: 'x', title: 'x', faqs: null }]), []);
  assert.deepEqual(aggregateFaq([{ id: 'x', title: 'x', faqs: [['', 'yanıt'], ['soru', '']] }]), []);
});

test('genel SSS: yalnızca onServices işaretli öğeler, veri sırasıyla', () => {
  const groups = [
    { title: 'G1', items: [{ q: 'q1', a: 'a1' }, { q: 'q2', a: 'a2', onServices: true }] },
    { title: 'G2', items: [{ q: 'q3', a: 'a3', onServices: true }, { q: 'q4', a: '', onServices: true }] },
  ];
  assert.deepEqual(pickGeneralFaq(groups), [{ q: 'q2', a: 'a2', from: 'G1' }, { q: 'q3', a: 'a3', from: 'G2' }]);
  assert.deepEqual(pickGeneralFaq(null), []);
  assert.deepEqual(pickGeneralFaq([{ title: 'x' }]), []);
});

// ——— Gerçek veri
const data = loadData();
const model = buildModel(data);

test('gerçek veri: ilişki verisi tutarlı (bilinmeyen kimlik yok)', () => {
  assert.deepEqual(model.relationIssues, []);
});

test('gerçek veri: ilişkiler iki yönlü tutarlı (sektör → hizmet ↔ hizmet → sektör)', () => {
  for (const sec of model.sectors) {
    for (const id of sec.services || []) {
      const s = model.servicesById[id];
      assert.ok(s, `${sec.slug}: ${id} yok`);
      assert.ok(s.related.sectors.some((x) => x.slug === sec.slug), `${id} → ${sec.slug} ilişkisi eksik`);
    }
  }
  for (const s of model.services) {
    for (const x of s.related.sectors) assert.ok((model.sectors.find((k) => k.slug === x.slug).services || []).includes(s.id), `${s.id} ← ${x.slug}`);
    for (const c of s.related.calculators) assert.ok(model.calcBySlug[c.slug].relatedServices.includes(s.id));
    for (const t of s.related.terms) assert.ok((model.glossaryBySlug[t.slug].services || []).includes(s.id));
    assert.equal(s.related.total, s.related.sectors.length + s.related.calculators.length + s.related.terms.length + s.related.posts.length);
  }
});

test('gerçek veri: ilişki adresleri model adresleriyle eşleşir', () => {
  const urls = new Set([
    ...model.sectors.map((s) => s.url),
    ...model.calculators.map((c) => c.url),
    ...model.glossary.map((t) => t.url),
    ...Object.values(model.publications).flat().map((p) => p.url),
  ]);
  for (const s of model.services) {
    for (const k of ['sectors', 'calculators', 'terms', 'posts']) for (const x of s.related[k]) assert.ok(urls.has(x.url), `${s.id}.${k}: ${x.url}`);
  }
});

test('gerçek veri: her alan ve her hizmetin fotoğrafı manifestte var; havuz dışına çıkılmaz', () => {
  for (const g of model.groups) {
    assert.ok(g.photo && data.photos[g.photo], `${g.id} alan fotoğrafı yok`);
    assert.ok(g.photoPool.length >= 1);
    for (const key of GROUP_PHOTOS[g.id] || []) assert.ok(data.photos[key], `${g.id}: photos.json içinde «${key}» yok`);
    g.services.forEach((s, i) => {
      assert.ok(s.photo && data.photos[s.photo], `${s.id} fotoğrafı yok`);
      assert.equal(s.photo, g.photoPool[i % g.photoPool.length]); // açık photo alanı yoksa havuzdan sırayla
    });
  }
});

test('gerçek veri: hizmet kaydındaki açık photo havuza göre önceliklidir; geçersiz anahtar yok sayılır', () => {
  const d = structuredClone(data);
  d.content.services[0].photo = 'office-0316';
  d.content.services[1].photo = 'bu-kare-yok';
  const m = buildModel(d);
  assert.equal(m.services[0].photo, 'office-0316');
  const g = m.groups.find((x) => x.id === m.services[1].group);
  assert.ok(g.photoPool.includes(m.services[1].photo)); // geçersiz anahtar → havuz
});

test('ekranda logo görünen kareler (logo: true) ne havuzlarda ne açık seçimde kullanılır', () => {
  const logoKeys = Object.entries(data.photos).filter(([, v]) => v && typeof v === 'object' && v.logo).map(([k]) => k);
  assert.ok(logoKeys.length >= 4, 'logolu kareler photos.json içinde işaretli olmalı');
  for (const k of Object.values(GROUP_PHOTOS).flat()) assert.ok(!logoKeys.includes(k), `${k} logolu kare, havuzda olmamalı`);
  const d = structuredClone(data);
  d.content.services[0].photo = logoKeys[0]; // editör yanlışlıkla logolu kareyi seçse bile kullanılmaz
  d.content.groups[0].photo = logoKeys[1];
  const m = buildModel(d);
  assert.ok(!logoKeys.includes(m.services[0].photo));
  for (const g of m.groups) {
    assert.ok(!logoKeys.includes(g.photo), `${g.id} alan karesi logolu`);
    for (const x of g.services) assert.ok(!logoKeys.includes(x.photo), `${x.id} karesi logolu`);
  }
});

test('gerçek veri: künye numarası (alan.sıra) benzersiz; kaynak listesi tablodan çözülür', () => {
  for (const g of model.groups) {
    g.services.forEach((s, i) => {
      assert.equal(s.number, String(i + 1).padStart(2, '0'));
      assert.equal(s.ref, `${g.number}.${s.number}`);
      assert.match(s.ref, /^\d{2}\.\d{2}$/);
    });
  }
  const refs = model.services.map((s) => s.ref);
  assert.equal(new Set(refs).size, refs.length, 'künye numaraları benzersiz olmalı');
  const table = data.content.sources || {};
  for (const s of model.services) {
    assert.ok(Array.isArray(s.srcList));
    assert.equal(s.srcList.length, (s.sourceKeys || []).filter((k) => table[k]).length);
    for (const x of s.srcList) assert.ok(x.label && /^https?:\/\//.test(x.url), `${s.id}: kaynak adresi geçersiz`);
  }
});

test('gerçek veri: genel SSS ve «Çalışma biçimimiz» verisi bandı besleyecek kadar dolu', () => {
  assert.ok(model.generalFaq.length >= 3 && model.generalFaq.length <= 6);
  for (const f of model.generalFaq) assert.ok(f.q && f.a);
  const ap = model.approach;
  assert.ok(ap && ap.title && ap.eyebrow);
  assert.equal(ap.steps.length, 3);
  assert.ok(ap.steps.every((s) => s.title && s.text));
  assert.ok(ap.principles.length >= 3 && ap.principles.every((p) => p.title && p.text));
});

test('gerçek veri: alan toplamları yalnızca alandaki hizmetleri sayar', () => {
  for (const g of model.groups) {
    const ids = new Set(g.services.map((s) => s.id));
    for (const x of g.related.sectors) {
      const sec = model.sectors.find((k) => k.slug === x.slug);
      assert.equal(x.n, (sec.services || []).filter((id) => ids.has(id)).length);
      assert.ok(x.n > 0);
    }
    assert.ok(g.related.faq.length <= MAX_AREA_FAQ);
  }
});
