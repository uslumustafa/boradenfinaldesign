// Bilgi merkezi: merkez sayfa, sirküler arşivi (PDF), duyuru/blog/haber listeleri ve yayın (makale) sayfaları.
// Wagtail karşılığı:
//   /bilgi-merkezi/              → InsightsHubPage (koleksiyonlar = StreamField [başlık, sayfa, birim, açıklama]; sayılar sorgulardan)
//   /bilgi-merkezi/sirkulerler/  → CircularIndexPage (+ ArchiveCircular snippet'i: number, title, date, document → wagtaildocs)
//   /bilgi-merkezi/<tür>/        → PublicationIndexPage (tür başına bir sayfa; title/intro = TYPE_PAGES[tür])
//   /bilgi-merkezi/<tür>/<id>/   → PublicationPage (date, category, summary, body: StreamField paragraf, sources: ListBlock [etiket, url],
//                                   service: FK → ServicePage, source_date, editorial_type)
// Sektör raporları, okuma notları, sözlük ve SSS başka modüllerdedir; burada yalnızca bağlantı verilir.
import { PUB_TYPES } from '../model.mjs';
import { PAGE } from '../scenes.mjs';
import { makeFilters } from '../filters.mjs';
import { baseOf, breadcrumbLd, graph, listLd, orgRef } from '../ld.mjs';

const F = makeFilters();
const HUB = { label: 'Bilgi Merkezi', url: '/bilgi-merkezi/' };
const HUB_LIMIT = 12; // merkezdeki "Son yayınlar" listesinin en fazla kayıt sayısı

// Liste sayfalarının başlık ve tanıtım metinleri (Wagtail: PublicationIndexPage.title / intro)
const TYPE_PAGES = {
  circulars: {
    title: 'Sirkülerler',
    one: 'sirküler',
    all: 'Tüm sirkülerler',
    lead: 'Mevzuat ve uygulama değişikliklerini kaynağıyla özetleyen sirkülerler ve geçmiş dönemlere ait PDF arşivi.',
  },
  announcements: {
    title: 'Duyurular',
    one: 'duyuru',
    all: 'Tüm duyurular',
    lead: 'Mevzuat, süreç ve kaynaklarla ilgili kısa duyurular; her duyuru ilgili resmî kaynağa bağlantı verir.',
  },
  blog: {
    title: 'Blog',
    one: 'yazı',
    all: 'Tüm blog yazıları',
    lead: 'Bir karar ya da süreç öncesinde sorulabilecek soruları ele alan, kaynaklarıyla birlikte konu odaklı yazılar.',
  },
  news: {
    title: 'Haberler',
    one: 'haber',
    all: 'Tüm haberler',
    lead: 'Mevzuat, raporlama ve ekonomi gündeminden kısa notlar; her not dayandığı resmî kaynağa bağlantı verir.',
  },
};

// schema.org türü (yayın türüne göre)
const LD_TYPE = { circulars: 'Article', announcements: 'Article', blog: 'BlogPosting', news: 'NewsArticle' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const countWords = (arr) => (arr || []).join(' ').split(/\s+/).filter(Boolean).length;
const mb = (bytes) => `${(Number(bytes) / 1048576).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
const stripDot = (t) => String(t || '').replace(/\.\s*$/, '');
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

// Yayın: kaynaklara alan adı eklenir (şeffaflık: bağlantının nereye gittiği görünür)
const withSources = (p) => ({ ...p, sourceList: (p.sources || []).map(([label, url]) => ({ label, url, host: hostOf(url) })) });

function articleLd(site, p, type, svc, trail) {
  const base = baseOf(site);
  const url = base + p.url;
  const node = {
    '@type': type,
    headline: p.title.length > 110 ? p.title.slice(0, 109) + '…' : p.title,
    description: p.summary,
    inLanguage: 'tr-TR',
    articleSection: p.category,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
    author: orgRef(site),
    publisher: orgRef(site),
  };
  if (p.date) node.datePublished = p.date;
  if (p.sources && p.sources.length) node.citation = p.sources.map(([name, u]) => ({ '@type': 'CreativeWork', name, url: u }));
  if (svc) node.about = { '@type': 'Service', name: svc.title, url: base + svc.url };
  return graph(node, breadcrumbLd(site, trail));
}

export function registerInsights({ add, model, site, home }) {
  const pubs = model.publications || {};
  const types = Object.entries(PUB_TYPES).map(([key, meta]) => ({
    key,
    slug: meta.slug,
    label: meta.label,
    title: TYPE_PAGES[key].title,
    one: TYPE_PAGES[key].one,
    all: TYPE_PAGES[key].all,
    lead: TYPE_PAGES[key].lead,
    url: `/bilgi-merkezi/${meta.slug}/`,
    count: (pubs[key] || []).length,
  }));
  const typeByKey = Object.fromEntries(types.map((t) => [t.key, t]));
  const latest = (model.latest || []).map(withSources);

  // ——— Arşiv: yıllara göre gruplar (yeni → eski) ve yıllık dağılım (eski → yeni; zaman ekseni)
  // Tarihi/numarası eksik kayıtlar (veride date: null) grubun sonuna alınır ve "tarihsiz" gösterilir.
  const archive = model.archive || [];
  const seq = (n) => Number(String(n || '').split('/')[1]) || 0;
  const archiveGroups = (model.archiveYears || []).map((y) => ({
    year: String(y),
    items: archive
      .filter((a) => String(a.year) === String(y))
      .map((a) => ({ ...a, date: ISO_DATE.test(String(a.date)) ? a.date : null, number: a.number || '', size: mb(a.bytes) }))
      .sort((p, q) => String(q.date || '').localeCompare(String(p.date || '')) || seq(q.number) - seq(p.number)),
  }));
  const maxCount = Math.max(1, ...archiveGroups.map((g) => g.items.length));
  const yearStats = archiveGroups
    .map((g) => ({
      year: g.year,
      count: g.items.length,
      ratio: +(g.items.length / maxCount).toFixed(4),
      share: archive.length ? Math.round((g.items.length / archive.length) * 100) : 0,
    }))
    .reverse();
  const yearRange = yearStats.length > 1 ? `${yearStats[0].year}–${yearStats[yearStats.length - 1].year}` : yearStats[0]?.year || '';
  const peak = yearStats.reduce((a, b) => (!a || b.count > a.count ? b : a), null);
  const arc = { total: archive.length, groups: archiveGroups, years: yearStats, range: yearRange, peak };

  // ——— Merkez: koleksiyonlar (Wagtail: InsightsHubPage.collections; sayılar canlı sorgulardan)
  const faqCount = (model.faq || []).reduce((s, g) => s + (g.items || []).length, 0);
  const cal = model.calendar;
  const collections = [
    {
      id: 'yayinlar',
      label: 'Yayınlar',
      items: [
        { title: 'Sirkülerler', url: typeByKey.circulars.url, count: archive.length, unit: 'arşiv PDF’i', desc: `Güncel sirkülerler ve ${yearRange} dönemine ait PDF arşivi; numara ve başlıkla aranabilir.` },
        { title: 'Duyurular', url: typeByKey.announcements.url, count: typeByKey.announcements.count, unit: 'duyuru', desc: 'Mevzuat, süreç ve kaynaklarla ilgili kısa duyurular.' },
        { title: 'Blog', url: typeByKey.blog.url, count: typeByKey.blog.count, unit: 'yazı', desc: 'Karar ve süreç öncesinde sorulabilecek soruları ele alan yazılar.' },
        { title: 'Haberler', url: typeByKey.news.url, count: typeByKey.news.count, unit: 'haber', desc: 'Mevzuat, raporlama ve ekonomi gündeminden kaynaklı kısa notlar.' },
      ],
    },
    {
      id: 'basvuru',
      label: 'Başvuru',
      items: [
        { title: 'Sektör raporları', url: '/bilgi-merkezi/sektor-raporlari/', count: (model.sectorReports || []).length, unit: 'kurum yayını', desc: 'Kamu kurumları ve meslek kuruluşlarının sektör istatistik ve raporlarına bağlantılar.' },
        { title: 'Okuma notları', url: '/bilgi-merkezi/okuma-notlari/', count: (model.perspectives || []).length, unit: 'okuma notu', desc: 'Değer, karar ve yönetişim gibi konularda seçilmiş kaynaklardan notlar.' },
        { title: 'Sözlük', url: '/bilgi-merkezi/sozluk/', count: (model.glossary || []).length, unit: 'terim', desc: 'Denetim, vergi, bordro ve raporlama terimleri, kısa tanımlarıyla.' },
        { title: 'Sık sorulan sorular', url: '/bilgi-merkezi/sss/', count: faqCount, unit: 'soru', desc: 'Çalışma biçimi, kapsam, gizlilik ve iletişim üzerine sorular.' },
      ],
    },
    {
      id: 'araclar',
      label: 'Araçlar',
      items: [
        { title: 'Vergi takvimi', url: '/vergi-takvimi/', count: cal ? cal.count : 0, unit: 'takvim kaydı', desc: cal && cal.meta ? `Beyan, ödeme ve bildirim tarihleri (${F.date_short(cal.meta.from)} – ${F.date_short(cal.meta.to)}); tatil kaymaları işlenmiş.` : 'Beyan, ödeme ve bildirim tarihleri.' },
        { title: 'Hesaplayıcılar', url: '/hesaplayicilar/', count: (model.calculators || []).length, unit: 'hesaplayıcı', desc: 'Maaş, işveren maliyeti, tazminat, KDV ve vergi hesapları; hesap adımlarıyla.' },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((x) => x.count > 0) }))
    .filter((g) => g.items.length);
  const collectionCount = collections.reduce((s, g) => s + g.items.length, 0);

  // ——— Merkez sayfa (son yayınlar listesi en fazla HUB_LIMIT kayıt; tür çiplerindeki sayılar bu listeden)
  const hubList = latest.slice(0, HUB_LIMIT);
  const hubTypes = types.map((t) => ({ ...t, inList: hubList.filter((p) => p.type === t.key).length }));
  const hubDesc = `Sirkülerler, duyurular, blog ve haberler; ${archive.length} sirkülerlik PDF arşivi, sektör raporları, okuma notları, sözlük, SSS, vergi takvimi ve hesaplayıcılar.`;
  const hubLd = listLd(site, 'Bilgi Merkezi', HUB.url, hubList, [home, HUB]);
  hubLd['@graph'][0].description = hubDesc;
  add({
    url: HUB.url,
    template: 'pages/insights/hub.njk',
    title: 'Bilgi Merkezi',
    titleFull: `Bilgi Merkezi: Sirkülerler, Yayınlar ve Araçlar — ${site.name}`,
    description: hubDesc,
    ...PAGE.hub,
    kind: 'Bilgi merkezi',
    crumbs: [home],
    ctx: { latest: hubList, total: latest.length, types: hubTypes, collections, collectionCount, arc, ld: hubLd },
  });

  // ——— Sirkülerler: yayımlanan sirkülerler + PDF arşivi
  const circ = typeByKey.circulars;
  const circItems = (pubs.circulars || []).map(withSources);
  const circLd = listLd(site, circ.title, circ.url, circItems, [home, HUB, { label: circ.title, url: circ.url }]);
  circLd['@graph'][0].description = `${circ.lead} Arşivde ${archive.length} sirküler (${yearRange}).`;
  add({
    url: circ.url,
    template: 'pages/insights/circulars.njk',
    title: circ.title,
    titleFull: `Sirkülerler ve Sirküler Arşivi (${yearRange}) — ${site.name}`,
    description: `${circ.lead} Arşivde ${archive.length} sirküler (${yearRange}), yıla, numaraya ve başlığa göre aranabilir.`,
    ...PAGE.circulars,
    kind: 'Bilgi merkezi',
    crumbs: [home, HUB],
    ctx: { type: circ, items: circItems, arc, types, ld: circLd },
  });
  // Arşivdeki her PDF yalnızca arama dizinine girer (sayfa üretilmez)
  for (const g of archiveGroups) {
    for (const a of g.items) {
      const parts = [a.number ? `Sirküler ${a.number}` : `Sirküler (${g.year})`, a.date ? F.date_tr(a.date) : '', `PDF, ${a.size}`];
      add({
        url: a.file,
        title: a.title,
        description: parts.filter(Boolean).join(' · '),
        kind: 'Sirküler (PDF)',
        searchOnly: true,
      });
    }
  }

  // ——— Duyurular, blog, haberler: tek şablon
  for (const t of types) {
    if (t.key === 'circulars') continue;
    const items = (pubs[t.key] || []).map(withSources);
    const catMap = new Map();
    for (const p of items) {
      const slug = F.slugify(p.category);
      if (!catMap.has(slug)) catMap.set(slug, { slug, label: p.category, count: 0 });
      catMap.get(slug).count++;
    }
    const crumbs = [home, HUB];
    const ld = listLd(site, t.title, t.url, items, [...crumbs, { label: t.title, url: t.url }]);
    ld['@graph'][0].description = t.lead;
    add({
      url: t.url,
      template: 'pages/insights/pub-list.njk',
      title: t.title,
      titleFull: `${t.title} — Bilgi Merkezi — ${site.name}`,
      description: t.lead,
      ...PAGE.pubs,
      kind: 'Bilgi merkezi',
      crumbs,
      ctx: {
        type: t,
        types,
        items,
        cats: [...catMap.values()],
        others: latest.filter((p) => p.type !== t.key).slice(0, 3),
        ld,
      },
    });
  }

  // ——— Yayın sayfaları (12): /bilgi-merkezi/<tür>/<id>/
  for (const t of types) {
    const list = (pubs[t.key] || []).map(withSources);
    list.forEach((p, i) => {
      const crumbs = [home, HUB, { label: t.title, url: t.url }];
      const svc = p.service ? model.servicesById[p.service] || null : null;
      const words = countWords([...(p.body || []), p.questions?.title || '', ...(p.questions?.items || []).flatMap(q => [q.title, q.text])]);
      add({
        url: p.url,
        template: 'pages/insights/article.njk',
        title: p.title,
        titleFull: `${stripDot(p.title)} — ${site.name}`,
        description: p.summary,
        ...PAGE.article,
        kind: t.label,
        crumbs,
        ctx: {
          pub: p,
          type: t,
          older: list[i + 1] || null,
          newer: list[i - 1] || null,
          service: svc,
          words,
          minutes: Math.max(1, Math.round(words / 180)),
          others: latest.filter((x) => x.type !== t.key).slice(0, 3),
          ld: articleLd(site, p, LD_TYPE[t.key] || 'Article', svc, [...crumbs, { label: p.title, url: p.url }]),
        },
      });
    });
  }
}
