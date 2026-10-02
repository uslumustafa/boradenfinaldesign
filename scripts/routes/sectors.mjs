// Sektörler dizini + 10 sektör sayfası + sözlük + SSS.
// Wagtail karşılığı: SectorIndexPage → SectorPage (sectors.json şeması; services/calculators/glossary = ParentalManyToMany,
//   topics/questions/sources = Orderable/StreamField; segment = is_segment bayrağı), GlossaryPage + GlossaryTerm snippet'i
//   (glossary.json; related = kendine M2M, services = M2M ServicePage), FaqPage + FaqGroup/FaqItem (faq.json; InlinePanel).
// Türetilmiş veri (sayılar, ilgi matrisi, harf grupları, ters bağlantılar) burada hesaplanır; şablonlar yalnızca sunar.
import { baseOf, breadcrumbLd, faqLd, graph, listLd, orgRef, webPageLd } from '../ld.mjs';
import { plainInline, slugify } from '../filters.mjs';

const pad2 = (n) => String(n).padStart(2, '0');
// Türkçe harfler için çakışmayan çapa kimliği (C ≠ Ç, I ≠ İ …)
const LETTER_ID = { Ç: 'c2', Ğ: 'g2', I: 'i2', İ: 'i', Ö: 'o2', Ş: 's2', Ü: 'u2' };
const letterId = (L) => 'harf-' + (LETTER_ID[L] || slugify(L) || 'x');

function sectorLd(site, s, trail) {
  return graph(
    {
      ...webPageLd(site, { name: `${s.name}: denetim, vergi ve danışmanlık gündemi`, url: s.url, description: s.lead }),
      about: { '@type': 'Thing', name: s.name, description: s.short },
    },
    breadcrumbLd(site, trail),
    s.questions && s.questions.length ? faqLd(s.questions) : null
  );
}

export function registerSectors({ add, data, model, site, home }) {
  const base = baseOf(site);
  const groups = model.groups;
  const sectorsCrumb = { label: 'Sektörler', url: '/sektorler/' };
  const kmCrumb = { label: 'Bilgi Merkezi', url: '/bilgi-merkezi/' };

  // ——— Sektörler: ilişkili kayıtlar + hizmet alanına göre dağılım (yalnızca sectors.json listelerinden sayılır)
  const sectors = model.sectors.map((s, i, arr) => {
    const svcList = (s.services || []).map((id) => model.servicesById[id]).filter(Boolean);
    const calcList = (s.calculators || []).map((slug) => model.calcBySlug[slug]).filter(Boolean);
    const termList = (s.glossary || []).map((slug) => model.glossaryBySlug[slug]).filter(Boolean);
    const byGroup = groups.map((g) => ({ id: g.id, n: svcList.filter((x) => x.group === g.id).length }));
    return {
      ...s,
      index: i,
      number: pad2(i + 1),
      kindLabel: s.segment ? 'Müşteri segmenti' : 'Sektör',
      segStart: !!s.segment && (i === 0 || !arr[i - 1].segment),
      svcList,
      calcList,
      termList,
      byGroup,
    };
  });
  const industries = sectors.filter((s) => !s.segment);
  const segments = sectors.filter((s) => s.segment);
  const matrix = {
    cols: groups.map((g, j) => ({
      id: g.id,
      number: g.number,
      name: g.name,
      short: g.short,
      url: g.url,
      total: sectors.reduce((a, s) => a + s.byGroup[j].n, 0),
    })),
    total: sectors.reduce((a, s) => a + s.svcList.length, 0),
  };

  if (sectors.length) {
    const trail = [home, sectorsCrumb];
    add({
      url: '/sektorler/',
      template: 'pages/sectors/index.njk',
      title: 'Sektörler',
      description: `${industries.length} sektör ve ${segments.length} müşteri segmenti için denetim, vergi ve danışmanlık gündemi: öne çıkan konular, ilgili hizmetler, hesaplayıcılar ve sık sorulan sorular.`,
      scene: 0,
      kind: 'Sektör',
      crumbs: [home],
      ctx: {
        sectors,
        industries,
        segments,
        matrix,
        ld: listLd(site, 'Sektörler', '/sektorler/', sectors.map((s) => ({ title: s.name, url: s.url })), trail),
      },
    });
    sectors.forEach((s, i) => {
      const crumbs = [home, sectorsCrumb];
      add({
        url: s.url,
        template: 'pages/sectors/sector.njk',
        title: s.name,
        titleFull: `${s.name}: Denetim, Vergi ve Danışmanlık Gündemi — ${site.name}`,
        description: s.lead,
        scene: 0,
        kind: s.kindLabel,
        crumbs,
        ctx: {
          sector: s,
          sectors,
          prev: sectors[i - 1] || null,
          next: sectors[i + 1] || null,
          ld: sectorLd(site, s, [...crumbs, { label: s.name, url: s.url }]),
        },
      });
    });
  }

  // ——— Sözlük: kategori (veri sırası), harf grupları (Türkçe alfabe), ilgili terim/hizmet/sektör bağlantıları
  const glossary = model.glossary || [];
  if (glossary.length) {
    const catOrder = [];
    for (const t of data.glossary || []) if (!catOrder.includes(t.category)) catOrder.push(t.category);
    const cats = catOrder.map((label) => ({ id: slugify(label), label, n: glossary.filter((t) => t.category === label).length }));
    const catId = Object.fromEntries(cats.map((c) => [c.label, c.id]));
    const terms = glossary.map((t) => ({
      ...t,
      catId: catId[t.category],
      relatedList: (t.related || []).map((r) => model.glossaryBySlug[r]).filter(Boolean),
      svcList: (t.services || []).map((id) => model.servicesById[id]).filter(Boolean),
      sectorList: sectors.filter((s) => (s.glossary || []).includes(t.slug)),
      // arama metni: terim + kısa tanım + kategori (ayrıntı paragrafları HTML boyutunu iki katına çıkarmasın diye dışarıda)
      searchText: [t.term, t.short, t.category].join(' '),
    }));
    const letterMap = new Map();
    for (const t of terms) {
      if (!letterMap.has(t.initial)) letterMap.set(t.initial, { letter: t.initial, id: letterId(t.initial), terms: [] });
      letterMap.get(t.initial).terms.push(t);
    }
    const letters = [...letterMap.values()];
    const url = '/bilgi-merkezi/sozluk/';
    const setId = base + url + '#terimler';
    add({
      url,
      template: 'pages/reference/glossary.njk',
      title: 'Sözlük',
      titleFull: `Sözlük: Denetim, Vergi ve Bordro Terimleri — ${site.name}`,
      description: `Denetim, vergi, bordro, şirketler, değerleme, raporlama ve veri alanlarından ${terms.length} terimin kısa ve ayrıntılı açıklaması; ilgili hizmetler ve resmî kaynaklarıyla.`,
      scene: 6,
      kind: 'Sözlük',
      crumbs: [home, kmCrumb],
      ctx: {
        terms,
        cats,
        letters,
        ld: graph(
          {
            '@type': 'DefinedTermSet',
            '@id': setId,
            name: 'Boraden Sözlük — denetim, vergi, bordro ve raporlama terimleri',
            url: base + url,
            inLanguage: 'tr-TR',
            publisher: orgRef(site),
            hasDefinedTerm: terms.map((t) => ({
              '@type': 'DefinedTerm',
              name: t.term,
              description: t.short,
              termCode: t.slug,
              url: base + t.url,
              inDefinedTermSet: { '@id': setId },
            })),
          },
          breadcrumbLd(site, [home, kmCrumb, { label: 'Sözlük', url }])
        ),
      },
    });
    // her terim arama dizinine ayrı kayıt olarak girer (sayfa üretilmez)
    for (const t of terms) add({ url: t.url, title: t.term, description: t.short, kind: 'Sözlük', searchOnly: true });
  }

  // ——— SSS: 5 grup; her soru kalıcı çapa kimliği alır (grup-id + sıra)
  const faq = (model.faq || []).map((g, i) => ({
    ...g,
    number: pad2(i + 1),
    items: (g.items || []).map((it, k) => ({ ...it, id: `${g.id}-${k + 1}` })),
  }));
  if (faq.length) {
    const url = '/bilgi-merkezi/sss/';
    const pairs = faq.flatMap((g) => g.items.map((it) => [it.q, it.a]));
    add({
      url,
      template: 'pages/reference/faq.njk',
      title: 'Sık Sorulan Sorular',
      description: 'Çalışma biçimi, ücret ve kapsam, gizlilik ve bağımsızlık, hesaplayıcılar ve iletişim hakkında sık sorulan sorular ve genel yanıtları.',
      scene: 0,
      kind: 'SSS',
      crumbs: [home, kmCrumb],
      ctx: {
        faq,
        qCount: pairs.length,
        ld: graph(
          {
            ...faqLd(pairs),
            name: 'Sık Sorulan Sorular',
            url: base + url,
            inLanguage: 'tr-TR',
            isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
            publisher: orgRef(site),
          },
          breadcrumbLd(site, [home, kmCrumb, { label: 'Sık Sorulan Sorular', url }])
        ),
      },
    });
    // sorular da arama dizinine girer (#çapa ile açılır)
    for (const g of faq) for (const it of g.items) add({ url: `${url}#${it.id}`, title: it.q, description: plainInline(it.a).replace(/\s+/g, ' '), kind: 'SSS', searchOnly: true });
  }
}
