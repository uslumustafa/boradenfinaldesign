// Destek sayfaları: yasal metinler (4), site içi arama, HTML site haritası.
// Wagtail karşılığı: LegalPage (data.legal şeması: başlık, durum, güncelleme tarihi, giriş, bölümler, yer tutucular,
//   inceleme notları), SearchPage (istemci tarafı dizin; ileride wagtail.search), SitemapPage (sayfa ağacından üretilir).
// Bu modül yalnızca türetilmiş alanları hesaplar (bölüm numaraları, kısa açıklama, site ağacı, sayaçlar).
import { baseOf, breadcrumbLd, graph, webPageLd } from '../ld.mjs';
import { PAGE } from '../scenes.mjs';
import { plainInline } from '../filters.mjs';
import { PUB_TYPES } from '../model.mjs';
import { NOTES_URL, REPORTS_URL, notesModel } from './reading.mjs';

const DRAFT = 'Taslak';
const SEARCH_URL = '/arama/';
const SITEMAP_URL = '/site-haritasi/';
const NUM = /^(\d+)[.)]\s*(.+)$/;
const pad2 = (n) => String(n).padStart(2, '0');

// meta açıklaması: düz metin, kelime sınırında kısaltılır
function clip(s, n = 158) {
  const t = plainInline(s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.(–-]+$/, '') + '…';
}

// Sayfa metinleri (Wagtail: SearchPage / SitemapPage alanları)
const SEARCH_COPY = {
  title: 'Site içi arama',
  h1: 'Sitede arayın',
  description: 'Hizmetler, sektörler, yayınlar, sözlük, hesaplayıcılar ve sirküler arşivinde arama.',
  placeholder: 'Hizmet, terim, hesaplayıcı, sirküler…',
  // örnek aramalar (her biri sonuç verir; derlemeden sonra denetlendi)
  examples: ['KDV', 'kıdem tazminatı', 'bordro', 'e-defter', 'değerleme', 'bağımsız denetim'],
};
const SITEMAP_COPY = {
  title: 'Site Haritası',
  lead: 'Sitedeki tüm sayfalar tek bakışta: hizmetler, sektörler, bilgi merkezi, araçlar, kurumsal sayfalar ve yasal metinler.',
  description: 'Boraden web sitesindeki tüm sayfaların listesi: hizmet alanları ve hizmetler, sektörler, bilgi merkezi, hesaplayıcılar, kurumsal sayfalar ve yasal metinler.',
};

// ——— HTML site haritası: model'den kurulan ağaç; her adres bir kez sayılır (ilk göründüğü yerde)
function sitemapTree({ model, site, data }) {
  const seen = new Set();
  const insight = (url) => (site.insights || []).find((x) => x.url === url) || null;
  const L = (title, url) => ({ title, url });
  const sections = [];

  sections.push({
    id: 'hizmetler',
    title: 'Hizmetler',
    url: '/hizmetler/',
    groups: model.groups.map((g) => ({ title: g.name, url: g.url, items: g.services.map((s) => L(s.title, s.url)) })),
  });

  const sectors = model.sectors.filter((s) => !s.segment);
  const segments = model.sectors.filter((s) => s.segment);
  sections.push({
    id: 'sektorler',
    title: 'Sektörler',
    url: '/sektorler/',
    groups: [
      sectors.length ? { title: 'Sektör sayfaları', items: sectors.map((s) => L(s.name, s.url)) } : null,
      segments.length ? { title: 'Müşteri segmentleri', items: segments.map((s) => L(s.name, s.url)) } : null,
    ].filter(Boolean),
  });

  const { notes } = notesModel(model);
  const bm = [];
  for (const [type, meta] of Object.entries(PUB_TYPES)) {
    const url = `/bilgi-merkezi/${meta.slug}/`;
    const g = { title: insight(url)?.label || meta.label, url, items: (model.publications[type] || []).map((p) => L(p.title, p.url)) };
    if (type === 'circulars' && model.archive.length) g.note = `Ayrıca ${model.archive.length} sirkülerlik PDF arşivi`;
    bm.push(g);
  }
  // not başlıkları kısa ve edebî; site haritasında konu etiketiyle birlikte gösterilir
  bm.push({ title: 'Okuma notları', url: NOTES_URL, items: notes.map((n) => ({ ...L(n.title, n.url), meta: n.topic })) });
  bm.push({
    title: 'Başvuru kaynakları',
    items: [
      L(insight(REPORTS_URL)?.label || 'Sektör raporları', REPORTS_URL),
      L(insight('/bilgi-merkezi/sozluk/')?.label || 'Sözlük', '/bilgi-merkezi/sozluk/'),
      L('Sık sorulan sorular', '/bilgi-merkezi/sss/'),
    ],
  });
  sections.push({ id: 'bilgi-merkezi', title: 'Bilgi merkezi', url: '/bilgi-merkezi/', groups: bm });

  const tools = [];
  if (model.calculators.length) tools.push({ title: 'Hesaplayıcılar', url: '/hesaplayicilar/', items: model.calculators.map((c) => L(c.title, c.url)) });
  if (model.calendar) tools.push({ title: 'Takvim', items: [L('Vergi takvimi', '/vergi-takvimi/')] });
  if (tools.length) sections.push({ id: 'araclar', title: 'Araçlar', groups: tools });

  const corp = [L('Ana sayfa', '/'), ...((site.footerLinks && site.footerLinks.kurumsal) || []).map((x) => L(x.label, x.url))];
  const nav = [L('Site içi arama', SEARCH_URL), L('Site haritası', SITEMAP_URL)];
  sections.push({
    id: 'kurumsal',
    title: 'Kurumsal',
    groups: [
      { title: 'Kurumsal sayfalar', items: corp.filter((x) => x.url !== SEARCH_URL && x.url !== SITEMAP_URL) },
      model.team && model.team.members.length ? { title: 'Ekibimiz', url: model.team.url, items: model.team.profiles.map((p) => ({ ...L(p.name, p.url), meta: p.role })) } : null,
      { title: 'Gezinme', items: nav },
    ].filter(Boolean),
  });
  sections.push({ id: 'yasal', title: 'Yasal metinler', groups: [{ title: 'Metinler', items: model.legal.map((l) => L(l.title, l.url)) }] });

  // tekrarları ayıkla, bölüm sayaçlarını hesapla
  for (const s of sections) {
    let count = 0;
    const take = (url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      count++;
      return true;
    };
    if (s.url) take(s.url);
    for (const g of s.groups) {
      if (g.url && !take(g.url)) g.url = null;
      g.items = g.items.filter((it) => take(it.url));
    }
    s.groups = s.groups.filter((g) => g.url || g.items.length);
    s.count = count;
  }
  const out = sections.filter((s) => s.count);
  out.forEach((s, i) => (s.n = pad2(i + 1)));
  return { sections: out, total: seen.size };
}

export function registerSupport(ctx) {
  const { add, model, site, home } = ctx;
  const base = baseOf(site);

  // ——— Yasal metinler ×4
  for (const l of model.legal) {
    const draft = l.status === DRAFT;
    const description = clip(l.intro);
    const crumbs = [home];
    const sections = (l.sections || []).map((s, i) => {
      const m = NUM.exec(String(s.heading || ''));
      return { ...s, num: pad2(m ? m[1] : i + 1), label: m ? m[2] : s.heading };
    });
    add({
      url: l.url,
      template: 'pages/support/legal.njk',
      title: l.title,
      description,
      ...PAGE.legal,
      kind: 'Yasal',
      crumbs,
      // taslak metin arama motorlarına ve sitemap.xml'e girmez; site içi aramada bulunur (aşağıdaki kayıt)
      noindex: draft,
      ctx: {
        doc: { ...l, sections },
        draft,
        draftNotice: 'Bu metin taslaktır; hukuk müşaviri incelemesinden geçtikten sonra yayımlanacaktır.',
        others: model.legal.filter((x) => x.slug !== l.slug),
        ld: graph(webPageLd(site, { name: l.title, url: l.url, description, dateModified: l.updatedAt }), breadcrumbLd(site, [...crumbs, { label: l.title, url: l.url }])),
      },
    });
    if (draft) add({ url: l.url, title: l.title, description, kind: 'Yasal', searchOnly: true });
  }

  // ——— Site içi arama
  const insight = (url) => (site.insights || []).find((x) => x.url === url) || null;
  const years = model.archiveYears || [];
  const paths = [
    { label: 'Hizmetler', url: '/hizmetler/', count: model.services.length, unit: 'hizmet başlığı', desc: `${model.groups.length} hizmet alanında kapsam, süreç ve sık sorulanlar.` },
    model.calculators.length ? { label: 'Hesaplayıcılar', url: '/hesaplayicilar/', count: model.calculators.length, unit: 'hesaplayıcı', desc: 'Ücret, maliyet, tazminat ve vergi hesapları; hesap adımlarıyla.' } : null,
    model.calendar ? { label: 'Vergi takvimi', url: '/vergi-takvimi/', count: model.calendar.count, unit: 'kayıt', desc: insight('/vergi-takvimi/')?.desc || 'Beyan ve ödeme tarihleri.' } : null,
    { label: 'Sözlük', url: '/bilgi-merkezi/sozluk/', count: model.glossary.length, unit: 'terim', desc: insight('/bilgi-merkezi/sozluk/')?.desc || 'Terimler ve kısa tanımlar.' },
    { label: 'Sirküler arşivi', url: '/bilgi-merkezi/sirkulerler/', count: model.archive.length, unit: 'sirküler', desc: years.length ? `${years[years.length - 1]}–${years[0]} yılları arasındaki sirkülerler (PDF).` : 'Sirkülerler.' },
    { label: 'İletişim', url: '/iletisim/', count: null, unit: '', desc: 'Aradığınızı bulamadıysanız sorunuzu doğrudan iletin.' },
  ]
    .filter(Boolean)
    .map((p) => ({ ...p, desc: /[.!?…]$/.test(p.desc) ? p.desc : `${p.desc}.` }));
  const searchTrail = [home, { label: SEARCH_COPY.title, url: SEARCH_URL }];
  add({
    url: SEARCH_URL,
    template: 'pages/support/search.njk',
    title: SEARCH_COPY.title,
    description: SEARCH_COPY.description,
    ...PAGE.search,
    kind: 'Sayfa',
    crumbs: [home],
    noindex: true,
    searchable: false,
    ctx: {
      copy: SEARCH_COPY,
      paths,
      ld: graph(
        {
          ...webPageLd(site, { name: SEARCH_COPY.title, url: SEARCH_URL, description: SEARCH_COPY.description }),
          potentialAction: { '@type': 'SearchAction', target: `${base}${SEARCH_URL}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
        },
        breadcrumbLd(site, searchTrail)
      ),
    },
  });

  // ——— HTML site haritası
  const tree = sitemapTree(ctx);
  add({
    url: SITEMAP_URL,
    template: 'pages/support/sitemap.njk',
    title: SITEMAP_COPY.title,
    description: SITEMAP_COPY.description,
    ...PAGE.sitemap,
    kind: 'Sayfa',
    crumbs: [home],
    ctx: {
      copy: SITEMAP_COPY,
      sections: tree.sections,
      total: tree.total,
      ld: graph(webPageLd(site, { name: SITEMAP_COPY.title, url: SITEMAP_URL, description: SITEMAP_COPY.description }), breadcrumbLd(site, [home, { label: SITEMAP_COPY.title, url: SITEMAP_URL }])),
    },
  });
}
