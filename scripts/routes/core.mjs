// Ana sayfa + hizmet alanları + hizmet sayfaları.
// Wagtail karşılığı: HomePage, ServiceIndexPage, ServiceAreaPage, ServicePage.
import { breadcrumbLd, faqLd, graph, listLd, orgNode, orgRef, baseOf, websiteNode } from '../ld.mjs';
import { PAGE } from '../scenes.mjs';

const SITE_TITLE = 'Boraden';

function serviceLd(site, group, s, trail) {
  const nodes = [
    {
      '@type': 'Service',
      name: s.title,
      description: s.description || s.lead,
      url: baseOf(site) + s.url,
      serviceType: group.name,
      provider: orgRef(site),
      areaServed: { '@type': 'Country', name: 'Türkiye' },
    },
    breadcrumbLd(site, trail),
  ];
  if (s.faqs && s.faqs.length) nodes.push(faqLd(s.faqs));
  return graph(...nodes);
}

export function registerCore({ add, model, site, home }) {
  // ——— Ana sayfa
  add({
    url: '/',
    template: 'pages/home.njk',
    title: 'Bağımsız Denetim, Vergi ve Danışmanlık',
    titleFull: 'Boraden — Bağımsız Denetim, Vergi ve Danışmanlık',
    description: site.description,
    scene: 0,
    kind: 'Sayfa',
    bodyClass: 'is-home',
    ctx: { ld: graph(websiteNode(site), orgNode(site, model.contact || {})) },
  });

  // ——— Hizmetler
  add({
    url: '/hizmetler/',
    template: 'pages/services-index.njk',
    title: 'Hizmetler',
    description: 'Vergi, bağımsız denetim, muhasebe ve bordro, kurumsal finansman, teşvik, hukuk, dijital dönüşüm ve eğitim alanlarında 60 hizmet başlığı.',
    ...PAGE.services,
    kind: 'Hizmet',
    crumbs: [home],
    ctx: {
      ld: listLd(
        site,
        'Hizmetler',
        '/hizmetler/',
        model.groups.map((g) => ({ title: g.name, url: g.url })),
        [home, { label: 'Hizmetler', url: '/hizmetler/' }]
      ),
    },
  });
  for (const g of model.groups) {
    const areaCrumbs = [home, { label: 'Hizmetler', url: '/hizmetler/' }];
    add({
      url: g.url,
      template: 'pages/service-area.njk',
      title: g.name,
      description: g.description,
      scene: g.shape,
      fig: [g.shape],
      kind: 'Hizmet alanı',
      crumbs: areaCrumbs,
      ctx: {
        group: g,
        prevGroup: model.groups[g.index - 1] || null,
        nextGroup: model.groups[g.index + 1] || null,
        ld: listLd(site, g.name, g.url, g.services, [...areaCrumbs, { label: g.name, url: g.url }]),
      },
    });
    g.services.forEach((s, i) => {
      const crumbs = [home, { label: 'Hizmetler', url: '/hizmetler/' }, { label: g.name, url: g.url }];
      add({
        url: s.url,
        template: 'pages/service.njk',
        title: s.title,
        titleFull: s.seoTitle || `${s.title} — ${SITE_TITLE}`,
        description: s.description || s.lead,
        scene: s.shape,
        fig: [s.shape],
        kind: 'Hizmet',
        crumbs,
        ctx: {
          group: g,
          service: s,
          prev: g.services[i - 1] || null,
          next: g.services[i + 1] || null,
          ld: serviceLd(site, g, s, [...crumbs, { label: s.title, url: s.url }]),
        },
      });
    });
  }
}
