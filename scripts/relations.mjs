// Ters ilişkiler: bir hizmet / hizmet alanı sayfasından ilgili sektör, hesaplayıcı, sözlük terimi ve yazıya geçiş.
// Wagtail karşılığı (hepsi HESAPLANIR, editör elle girmez; ServicePage / ServiceAreaPage get_context() içinde):
//   sectors     = SectorPage.objects.live().filter(services=self)            (SectorPage.services = ParentalManyToMany)
//   calculators = CalculatorPage.objects.live().filter(related_services=self)
//   terms       = GlossaryTerm.objects.filter(services=self)                 (snippet; services = M2M ServicePage)
//   posts       = BlogPage.objects.live().filter(service=self)               (isteğe bağlı FK; boşsa ilişki yok)
//   general_faq = FaqItem.objects.filter(show_on_services=True)              (SSS öğesinde «Hizmet sayfalarında göster» kutusu)
// Kural: yalnızca veride AÇIKÇA yazılı bağlantılar sayılır. Hiçbir ilişki «tahmin» ya da metin eşleşmesiyle üretilmez;
// bir kayıt başka bir kayıttan silinirse bağlantı da kendiliğinden kaybolur (iki yönlü tutarlılık).
// Çevrimsel başvuru yoktur: dönen kayıtlar yalnızca şablonun ihtiyaç duyduğu düz özetlerdir.

export const MAX_AREA_FAQ = 6;

const norm = (t) => String(t || '').trim().replace(/[?.\s]+$/, '').toLocaleLowerCase('tr-TR');
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export const brief = {
  sector: (s) => ({ slug: s.slug, name: s.name, short: s.short, url: s.url, segment: !!s.segment }),
  calculator: (c) => ({ slug: c.slug, title: c.title, short: c.short || '', lead: c.lead || '', url: c.url, groupLabel: c.groupLabel || '' }),
  term: (t) => ({ slug: t.slug, term: t.term, short: t.short, category: t.category, url: t.url }),
  post: (p) => ({ id: p.id, title: p.title, summary: p.summary, category: p.category, date: p.date, dateStatus: p.dateStatus, typeLabel: p.typeLabel, url: p.url }),
};

// SSS grupları (faq.json) → hizmet sayfalarında gösterilecek genel sorular ({ q, a, from }) — `onServices: true` işaretli öğeler, veri sırasıyla
export function pickGeneralFaq(faqGroups = []) {
  const out = [];
  for (const g of faqGroups || []) {
    for (const it of g.items || []) {
      if (it && it.onServices && it.q && it.a) out.push({ q: it.q, a: it.a, from: g.title || '' });
    }
  }
  return out;
}

// Hizmetlerin kendi SSS'leri ([soru, yanıt]) → tekrarsız birleşik liste ({ q, a, serviceId, serviceTitle, serviceUrl })
export function aggregateFaq(serviceList = [], limit = MAX_AREA_FAQ) {
  const seen = new Set();
  const out = [];
  for (const s of serviceList) {
    for (const f of s.faqs || []) {
      const [q, a] = Array.isArray(f) ? f : [f?.q, f?.a];
      const key = norm(q);
      if (!key || !a || seen.has(key)) continue;
      seen.add(key);
      out.push({ q, a, serviceId: s.id, serviceTitle: s.title, serviceUrl: s.url });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * @param {object} o
 * @param {Array} o.groups        model.groups (id, services[])
 * @param {Array} o.services      model.services
 * @param {Array} o.sectors       model.sectors (slug, services: id[])
 * @param {Array} o.calculators   model.calculators (relatedServices: id[])
 * @param {Array} o.glossary      model.glossary (services: id[])
 * @param {object} o.publications model.publications ({ blog: [...], … } — `service` alanı bir id ya da id listesi)
 * @returns {{ byService: Record<string, object>, byGroup: Record<string, object>, issues: string[] }}
 */
export function buildRelations({ groups = [], services = [], sectors = [], calculators = [], glossary = [], publications = {} } = {}) {
  const issues = [];
  const ids = new Set(services.map((s) => s.id));
  const check = (list, from) => {
    for (const id of list) if (!ids.has(id)) issues.push(`${from}: bilinmeyen hizmet «${id}»`);
  };

  const posts = Object.values(publications || {})
    .flat()
    .filter((p) => p && (p.status || 'published') === 'published');

  const byService = {};
  for (const s of services) {
    const sec = sectors.filter((x) => asList(x.services).includes(s.id)).map(brief.sector);
    const calc = calculators.filter((x) => asList(x.relatedServices).includes(s.id)).map(brief.calculator);
    const terms = glossary.filter((x) => asList(x.services).includes(s.id)).map(brief.term);
    const pst = posts.filter((p) => asList(p.service).concat(asList(p.services)).includes(s.id)).map(brief.post);
    byService[s.id] = { sectors: sec, calculators: calc, terms, posts: pst, total: sec.length + calc.length + terms.length + pst.length };
  }

  // Veri tutarlılığı: ilişkilerde bilinmeyen hizmet kimliği derleme sırasında uyarı olarak raporlanır
  for (const x of sectors) check(asList(x.services), `sectors.json › ${x.slug}`);
  for (const x of calculators) check(asList(x.relatedServices), `calculators › ${x.slug}`);
  for (const x of glossary) check(asList(x.services), `glossary.json › ${x.slug}`);
  for (const p of posts) check(asList(p.service).concat(asList(p.services)), `yayın › ${p.id}`);

  // Alan düzeyi: alandaki hizmetleri anan sektörler (kaç hizmetle), ilgili hesaplayıcılar, birleşik SSS
  const byGroup = {};
  for (const g of groups) {
    const gs = services.filter((s) => s.group === g.id);
    const gids = new Set(gs.map((s) => s.id));
    const sec = sectors
      .map((x, i) => ({ x, i, n: asList(x.services).filter((id) => gids.has(id)).length }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((r) => ({ ...brief.sector(r.x), n: r.n }));
    const calc = calculators
      .filter((x) => asList(x.relatedServices).some((id) => gids.has(id)))
      .map((x) => ({ ...brief.calculator(x), serviceTitles: asList(x.relatedServices).map((id) => gs.find((s) => s.id === id)?.title).filter(Boolean) }));
    byGroup[g.id] = { sectors: sec, calculators: calc, faq: aggregateFaq(gs) };
  }

  return { byService, byGroup, issues };
}
