// Ham JSON verisini şablonların kullandığı modele dönüştürür.
// Wagtail karşılığı: Page/Snippet modelleri + queryset'ler (bkz. WAGTAIL_MAP.md).
import { buildTeam } from './team.mjs';
import { buildRelations, pickGeneralFaq } from './relations.mjs';
import { AREA_SHAPE, CALC_GROUP_SHAPE, sceneOf, figureOf, shapeOfArea, shapeOfService, shapeOfSector, shapeOfCalc } from './scenes.mjs';

// Hizmet alanlarının adres parçası (kimlikler kalıcı; ad ve adres Ekim 2026 yapısına göre). Eski adresler vercel.json › redirects ile yönlenir.
export const GROUP_SLUG = {
  vergi: 'vergi',
  denetim: 'denetim',
  muhasebe: 'muhasebe',
  danismanlik: 'kurumsal-finansman',
  tesvik: 'tesvik',
  hukuk: 'hukuk',
  sistem: 'dijital-donusum',
  akademi: 'akademi',
};

// Hizmet alanlarının 3B sahnesi ve şekil alt yazısı: şekil kimliği scenes.mjs › AREA_SHAPE'te, sıra numarası ve açıklama formations.js'ten gelir
// (Wagtail: ServiceAreaPage.scene + figure_caption). Ana sayfa, hizmet sayfalarının «çalışma biçimimiz» bandı ve alan sayfası bunu kullanır.
export const GROUP_SCENE = Object.fromEntries(Object.entries(AREA_SHAPE).map(([id, shape]) => [id, sceneOf(shape)]));
export const GROUP_FIGURE = Object.fromEntries(Object.entries(AREA_SHAPE).map(([id, shape]) => [id, figureOf(shape)]));

// Hizmet alanı fotoğrafları: photos.json anahtarları (yalnızca gerçek arşiv kareleri; insan yüzü görünen kare ve toplu ekip fotoğrafı yok —
// müşteri geri bildirimi, Ekim 2026). İlk kare alan kartı/bandı, tamamı hizmet sayfalarında sırayla kullanılır (aynı alandaki hizmetler farklı
// kare görür). Hizmet kaydında `photo` varsa o kullanılır. Wagtail karşılığı: ServiceAreaPage.photo / ServicePage.photo (görsel seçici; boşsa
// alanın karesi). Seçim müşteri onayına tabidir. Kareler: scripts/tools/archive-photos.py.
export const GROUP_PHOTOS = {
  vergi: ['desk-calc-chart', 'pen-closeup', 'table-top-3', 'desk-keyboard-chart'],
  denetim: ['open-office-wide', 'table-top-1', 'open-office-slats', 'desk-keyboard-chart'],
  muhasebe: ['office-0301', 'reading-coffee', 'desk-calc-chart', 'table-top-3', 'pen-closeup'],
  danismanlik: ['meeting-room-long', 'table-top-2', 'meeting-room-glass'],
  tesvik: ['reception-lounge', 'open-office-desk', 'table-top-2', 'meeting-room-glass'],
  hukuk: ['meeting-room-glass', 'pen-closeup', 'meeting-room-long', 'reading-coffee'],
  sistem: ['desk-monitor-top', 'open-office-desk', 'desk-keyboard-chart'],
  akademi: ['table-top-2', 'reading-coffee', 'meeting-room-glass', 'open-office-slats', 'table-top-1'],
};

export const PUB_TYPES = {
  circulars: { slug: 'sirkulerler', label: 'Sirküler' },
  announcements: { slug: 'duyurular', label: 'Duyuru' },
  blog: { slug: 'blog', label: 'Blog' },
  news: { slug: 'haberler', label: 'Haber' },
};

// Hesaplayıcı grupları (dizin sayfası ve süzgeç). Sahne/şekil eşlemesi: scenes.mjs › CALC_SHAPE. Wagtail karşılığı: CalculatorCategory snippet'i.
export const CALC_GROUPS = [
  { id: 'bordro', label: 'Bordro ve maliyet', short: 'Bordro', blurb: 'Brüt–net ücret, işveren maliyeti ve asgari ücret hesapları.' },
  { id: 'vergi', label: 'Vergi', short: 'Vergi', blurb: 'Gelir vergisi, KDV, kurumlar vergisi, geçici vergi, serbest meslek makbuzu ve gecikme zammı.' },
  { id: 'tazminat', label: 'Tazminat', short: 'Tazminat', blurb: 'Kıdem ve ihbar tazminatı hesapları.' },
];

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const LEGAL_ORDER = ['kvkk-aydinlatma-metni', 'gizlilik-politikasi', 'cerez-politikasi', 'kullanim-kosullari'];

// src/data/params/<yıl>-<alan>.json dosyalarından her alan için en yeni yılı seçer (kod değişmeden yeni yıl eklenebilir)
function pickLatestParams(params) {
  const best = {};
  for (const key of Object.keys(params || {})) {
    const m = /^(\d{4})-(.+)$/.exec(key);
    if (!m) continue;
    const year = Number(m[1]);
    if (!best[m[2]] || year > best[m[2]].year) best[m[2]] = { key, year };
  }
  return best;
}

export function buildModel(data) {
  const c = data.content || {};
  const groups = (c.groups || []).map((g, i) => ({
    ...g,
    slug: GROUP_SLUG[g.id] || g.id,
    url: `/hizmetler/${GROUP_SLUG[g.id] || g.id}/`,
    index: i,
    shape: shapeOfArea(g.id), // şekil kimliği (data-field işaretlerinde kullanılır)
    scene: GROUP_SCENE[g.id],
    figure: GROUP_FIGURE[g.id] || '',
    scope: c.about?.scope?.[g.id] || '',
  }));
  const norm = (t) => String(t || '').trim().replace(/[.\s]+$/, '').toLocaleLowerCase('tr-TR');
  const services = (c.services || []).map((s) => {
    const g = groups.find((x) => x.id === s.group);
    // Kapsam: başlıkla aynı metni tekrar eden satırlarda açıklama gösterilmez
    const scopeItems = (s.scope || []).map(([title, text]) => ({ title, text: norm(text) === norm(title) ? '' : text }));
    // Hazırlık: kapsam satırlarının kopyası ise tekrar etme
    const pairs = (s.scope || []).map(([a, b]) => `${a}: ${b}`);
    const prepare = s.prepare || [];
    const dupe = !prepare.length || JSON.stringify(pairs) === JSON.stringify(prepare) || prepare.every((p) => /^\d\d \/ /.test(p));
    return {
      ...s,
      scopeItems,
      prepareList: dupe ? [] : prepare,
      groupSlug: g.slug,
      groupName: g.name,
      groupShort: g.short,
      groupNumber: g.number,
      groupShape: g.shape,
      scene: g.scene, // alanın sahnesi (sayfa altındaki «çalışma biçimimiz» bandı)
      // hizmetin kendi şekli: kahraman sahnesi + beyaz sayfa alanının açılışı (scenes.mjs › SERVICE_SHAPE)
      shape: shapeOfService(s.id, s.group),
      url: `${g.url}${s.id}/`,
    };
  });
  const photos = data.photos || {};
  // Ekranda logo görünen kareler (logo: true) ve tek kişilik ekip portreleri (person: true; yalnızca ekip sayfalarında) hiçbir koşulda
  // alan/hizmet fotoğrafı olarak seçilmez.
  const photoOk = (k) => (k && photos[k] && !photos[k].logo && !photos[k].person && !String(k).startsWith('_') ? k : null);
  for (const g of groups) {
    g.services = services.filter((s) => s.group === g.id);
    g.photoPool = (GROUP_PHOTOS[g.id] || []).filter(photoOk);
    g.photo = photoOk(g.photo) || g.photoPool[0] || null;
    g.services.forEach((s, i) => {
      s.photo = photoOk(s.photo) || (g.photoPool.length ? g.photoPool[i % g.photoPool.length] : null);
      s.number = String(i + 1).padStart(2, '0'); // alandaki sırası
      s.ref = `${g.number}.${s.number}`; // «01.03»: alan.sıra — yalnızca gezinme etiketi (künyede)
    });
  }
  const byId = Object.fromEntries(services.map((s) => [s.id, s]));
  const sources = c.sources || {};
  // Hizmetin kaynak listesi: sourceKeys → sources tablosu ([etiket, adres]); tabloda olmayan anahtar sessizce atlanır
  for (const s of services) s.srcList = (s.sourceKeys || []).map((k) => sources[k]).filter(Boolean).map(([label, url]) => ({ label, url }));

  // Yayınlar (sirküler/duyuru/blog/haber)
  const publications = {};
  const pubsAll = [];
  for (const [type, meta] of Object.entries(PUB_TYPES)) {
    const items = (c.publications?.[type] || [])
      .filter((p) => (p.status || 'published') === 'published')
      .map((p) => ({ ...p, date: p.publicationDateVerified === false ? null : p.date || null, dateStatus: p.publicationDateVerified === false ? 'Tarih teyit bekliyor' : 'Tarih belirtilmedi', type, typeLabel: meta.label, typeSlug: meta.slug, url: `/bilgi-merkezi/${meta.slug}/${p.id}/` }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    publications[type] = items;
    pubsAll.push(...items);
  }
  pubsAll.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const archive = (data.archive || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.year || '').localeCompare(String(a.year || '')));
  const years = [...new Set(archive.map((a) => a.year))].sort((a, b) => b - a);
  const sectors = (data.sectors || []).map((s) => ({ ...s, url: `/sektorler/${s.slug}/`, shape: shapeOfSector(s.slug) }));

  // ——— Ekip: kişiler + alan/hizmet/sektör ilişkileri (groups/services/sectors üzerine `people` yazılır; bkz. scripts/team.mjs)
  const team = buildTeam(data.team, { groups, services, sectors, photos });

  // ——— Hesaplayıcılar (bordro + vergi dosyaları birleştirilir)
  const latestParams = pickLatestParams(data.params);
  const calcGroups = CALC_GROUPS.map((g) => ({ ...g, shape: CALC_GROUP_SHAPE[g.id] }));
  const calculators = [...(data['calculators-bordro'] || []), ...(data['calculators-vergi'] || [])]
    .sort((a, b) => (a.order || 99) - (b.order || 99))
    .map((cl) => {
      const lp = latestParams[cl.params];
      const meta = lp ? data.params[lp.key]?.meta : null;
      const shape = shapeOfCalc(cl.slug, cl.group);
      return {
        ...cl,
        url: `/hesaplayicilar/${cl.slug}/`,
        shape,
        scene: sceneOf(shape),
        groupLabel: CALC_GROUPS.find((g) => g.id === cl.group)?.label || cl.group,
        paramsKey: lp ? lp.key : null,
        paramsYear: lp ? lp.year : null,
        paramsUrl: lp ? `/assets/data/params/${lp.key}.json` : null,
        paramsVerifiedOn: meta?.verifiedOn || null,
      };
    });
  const calcBySlug = Object.fromEntries(calculators.map((cl) => [cl.slug, cl]));
  for (const cl of calculators) {
    cl.relatedCalcs = (cl.related || []).map((s) => calcBySlug[s]).filter(Boolean);
    cl.relatedSvc = (cl.relatedServices || []).map((id) => byId[id]).filter(Boolean);
  }
  for (const g of calcGroups) g.items = calculators.filter((cl) => cl.group === g.id);

  // ——— Vergi takvimi (aya göre gruplanır)
  let calendar = null;
  if (data.calendar) {
    const cal = data.calendar;
    const catById = Object.fromEntries((cal.categories || []).map((x) => [x.id, x]));
    const items = (cal.items || [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.title).localeCompare(String(b.title), 'tr'))
      .map((it) => ({ ...it, catLabel: catById[it.category]?.label || it.category }));
    const months = [];
    for (const it of items) {
      const key = it.date.slice(0, 7);
      let m = months[months.length - 1];
      if (!m || m.key !== key) {
        m = { key, label: `${MONTHS_TR[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, items: [] };
        months.push(m);
      }
      m.items.push(it);
    }
    calendar = { ...cal, items, months, catById, count: items.length };
  }

  // ——— Sözlük, SSS, kurumsal sayfalar
  const glossary = (data.glossary || [])
    .slice()
    .sort((a, b) => a.term.localeCompare(b.term, 'tr'))
    .map((t) => ({ ...t, initial: t.term.charAt(0).toLocaleUpperCase('tr-TR'), url: `/bilgi-merkezi/sozluk/#${t.slug}` }));
  const glossaryBySlug = Object.fromEntries(glossary.map((t) => [t.slug, t]));
  const legal = Object.values(data.legal || {})
    .map((l) => ({ ...l, url: `/yasal/${l.slug}/` }))
    .sort((a, b) => LEGAL_ORDER.indexOf(a.slug) - LEGAL_ORDER.indexOf(b.slug));

  // ——— Ters ilişkiler: hizmet ↔ sektör / hesaplayıcı / terim / yazı; alan düzeyinde toplamlar (scripts/relations.mjs)
  const rel = buildRelations({ groups, services, sectors, calculators, glossary, publications });
  const noRel = { sectors: [], calculators: [], terms: [], posts: [], total: 0 };
  for (const s of services) s.related = rel.byService[s.id] || noRel;
  for (const g of groups) g.related = rel.byGroup[g.id] || { sectors: [], calculators: [], faq: [] };

  // ——— «Çalışma biçimimiz» bandı (approach.json + about.principles) ve hizmet sayfalarının genel SSS'si (faq.json › onServices)
  const ap = data.approach;
  const approach = ap
    ? {
        eyebrow: ap.eyebrow || '',
        title: ap.title || '',
        stepsLabel: ap.stepsLabel || '',
        steps: (ap.steps || []).map(([title, text]) => ({ title, text })),
        principlesLabel: ap.principlesLabel || '',
        principles: (c.about?.principles || []).map(([title, text]) => ({ title, text })),
        linkLabel: ap.linkLabel || '',
        linkUrl: ap.linkUrl || '',
        ctaLabel: ap.ctaLabel || '',
      }
    : null;
  const generalFaq = pickGeneralFaq(data.faq);

  return {
    groups,
    services,
    servicesById: byId,
    sources,
    publications,
    latest: pubsAll,
    archive,
    archiveYears: years,
    sectors,
    team,
    contact: c.contact || {},
    about: c.about || {},
    perspectives: c.perspectives || [],
    sectorReports: c.sectorReports || [],
    calculators,
    calcGroups,
    calcBySlug,
    paramsLatest: latestParams,
    calendar,
    glossary,
    glossaryBySlug,
    faq: data.faq || [],
    careers: data.careers || null,
    contactPage: data.contactpage || null,
    aboutPage: data.aboutpage || null,
    legal,
    approach,
    generalFaq,
    relationIssues: rel.issues,
  };
}
