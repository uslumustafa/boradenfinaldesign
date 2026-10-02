// Yapılandırılmış veri (JSON-LD) yardımcıları.
// Wagtail karşılığı: sayfa modellerindeki get_context() / şablon etiketleri (aynı şemalar).
import { plainInline } from './filters.mjs';

export const baseOf = (site) => site.url.replace(/\/$/, '');

export function orgRef(site) {
  return { '@type': 'Organization', name: site.legalName, url: site.url };
}

export function breadcrumbLd(site, trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: baseOf(site) + c.url })),
  };
}

// Liste/koleksiyon sayfası: CollectionPage + ItemList + BreadcrumbList
export function listLd(site, name, url, items, trail) {
  const base = baseOf(site);
  return graph(
    { '@type': 'CollectionPage', name, url: base + url, isPartOf: { '@type': 'WebSite', name: site.name, url: site.url } },
    { '@type': 'ItemList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.title, url: base + x.url })) },
    breadcrumbLd(site, trail)
  );
}

// SSS: [[soru, cevap], …] — cevaplardaki satır içi işaretleme düz metne çevrilir
export function faqLd(pairs) {
  return {
    '@type': 'FAQPage',
    mainEntity: pairs.map(([q, a]) => ({ '@type': 'Question', name: plainInline(q), acceptedAnswer: { '@type': 'Answer', text: plainInline(a) } })),
  };
}

// Sıradan içerik sayfası
export function webPageLd(site, { name, url, description, type = 'WebPage', dateModified }) {
  const o = {
    '@type': type,
    name,
    url: baseOf(site) + url,
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
    publisher: orgRef(site),
  };
  if (description) o.description = description;
  if (dateModified) o.dateModified = dateModified;
  return o;
}

export function graph(...nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}
