// Araçlar: hesaplayıcı dizini, hesaplayıcı sayfaları, vergi takvimi.
// Wagtail karşılığı: CalculatorIndexPage, CalculatorPage (alanlar = calculators-*.json şeması), TaxCalendarPage.
import { baseOf, breadcrumbLd, faqLd, graph, listLd, orgRef, webPageLd } from '../ld.mjs';
import { PAGE } from '../scenes.mjs';

function calculatorLd(site, cl, trail) {
  return graph(
    { ...webPageLd(site, { name: cl.title, url: cl.url, description: cl.description, dateModified: cl.updated }), about: { '@type': 'Thing', name: cl.groupLabel } },
    breadcrumbLd(site, trail),
    cl.faq && cl.faq.length ? faqLd(cl.faq) : null
  );
}

export function registerTools({ add, model, site, home }) {
  const toolsCrumb = { label: 'Hesaplayıcılar', url: '/hesaplayicilar/' };

  if (model.calculators.length) {
    const years = [...new Set(model.calculators.map((c) => c.paramsYear).filter(Boolean))];
    add({
      url: '/hesaplayicilar/',
      template: 'pages/tools/calculators-index.njk',
      title: 'Hesaplayıcılar',
      description: `Maaş, işveren maliyeti, kıdem ve ihbar tazminatı, KDV, kurumlar vergisi ve daha fazlası için ${years.join('/')} yılı parametreleriyle çalışan, hesap adımlarını gösteren araçlar.`,
      ...PAGE.calculators,
      kind: 'Araç',
      crumbs: [home],
      ctx: { ld: listLd(site, 'Hesaplayıcılar', '/hesaplayicilar/', model.calculators, [home, toolsCrumb]) },
    });
    for (const cl of model.calculators) {
      const crumbs = [home, toolsCrumb];
      // tarayıcıdaki hesap arayüzüne giden tanım (form alanları + motor + parametre dosyası adresi)
      const def = { slug: cl.slug, title: cl.title, engine: cl.engine, inputs: cl.inputs, presets: cl.presets || [], paramsUrl: cl.paramsUrl, disclaimer: cl.disclaimer || site.disclaimer };
      add({
        url: cl.url,
        template: 'pages/tools/calculator.njk',
        title: cl.title,
        titleFull: `${cl.title}${cl.paramsYear ? ' ' + cl.paramsYear : ''} — ${site.name}`,
        description: cl.description,
        scene: cl.shape,
        fig: [cl.shape],
        kind: 'Hesaplayıcı',
        crumbs,
        ctx: { calc: cl, def, ld: calculatorLd(site, cl, [...crumbs, { label: cl.title, url: cl.url }]) },
      });
    }
  }

  if (model.calendar) {
    add({
      url: '/vergi-takvimi/',
      template: 'pages/tools/tax-calendar.njk',
      title: 'Vergi Takvimi',
      description: 'KDV, muhtasar, SGK, geçici vergi, e-Defter ve yıllık beyanname tarihleri; hafta sonu ve resmî tatil kaymaları işlenmiş, kaynaklarıyla birlikte.',
      ...PAGE.calendar,
      kind: 'Araç',
      crumbs: [home],
      ctx: { ld: graph(webPageLd(site, { name: 'Vergi Takvimi', url: '/vergi-takvimi/', description: model.calendar.meta?.disclaimer, dateModified: model.calendar.meta?.verifiedOn }), breadcrumbLd(site, [home, { label: 'Vergi Takvimi', url: '/vergi-takvimi/' }])) },
    });
  }
}
