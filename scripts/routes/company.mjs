// Kurumsal sayfalar: hakkımızda, kariyer, iletişim.
// Wagtail karşılığı: AboutPage (bölümler = StreamField, olgular = InlinePanel; sayısal olgular modelden sayılır),
//   CareersPage (+ JobPosting snippet'i; başvuru formu = wagtail.contrib.forms FormField'ları),
//   ContactPage (AbstractEmailForm: FormField'lar; konular = ContactTopic snippet'i; ?hizmet= eşlemesi
//   ServicePage → ContactTopic ilişkisinden üretilir).
// Formlar statik sürümde yalnızca ön yüzdür: geçerli gönderim bir mailto: taslağı hazırlar, ağ isteği yoktur.
import { baseOf, breadcrumbLd, graph, orgNode, webPageLd } from '../ld.mjs';
import { PAGE, ABOUT_SHAPE, sceneOf } from '../scenes.mjs';
import { plainInline } from '../filters.mjs';

const KIND = 'Kurumsal';

// Form alanları: seçenek kaynağı (optionsFrom) çözülür; metin/e-posta/telefon yarım, diğerleri tam genişlik
function prepFields(fields, sources) {
  return (fields || []).map((f) => {
    const options = (f.optionsFrom ? sources[f.optionsFrom] : f.options) || [];
    return { ...f, options, wide: !['text', 'email', 'tel'].includes(f.type), hasDesc: options.some((o) => o.desc) };
  });
}

// Metindeki düz e-posta adresini satır içi bağlantıya çevirir (rich süzgeciyle işlenecek metinler için)
const linkMail = (s, email) => (s && email && !s.includes(`](mailto:${email})`) ? s.split(email).join(`[${email}](mailto:${email})`) : s || '');

// Harici harita bağlantısı (betik/iframe yok): adres metniyle arama. Adres boşsa '' (bağlantı çizilmez; «/, Türkiye» gibi
// anlamsız bir arama üretilmez).
const mapsUrl = (q) => (q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '');

export function registerCompany({ add, model, site, home }) {
  const c = model.contact || {};
  // formların alıcısı kurumun genel e-posta adresidir; boşsa (Ekim 2026: kişiye özel doldurulacak) taslak alıcısız hazırlanır
  const mailTo = c.email || '';
  const crumbs = [home];
  const orgId = { '@id': `${baseOf(site)}/#organization` };

  // ——— Hakkımızda
  const ap0 = model.aboutPage;
  // bölüm şekilleri (scenes.mjs › ABOUT_SHAPE): ilki sayfanın ikinci beyaz bölümünün açılış şekli, diğerleri bölüm işareti
  const ap = ap0 && { ...ap0, sections: (ap0.sections || []).map((s) => ({ ...s, shape: ABOUT_SHAPE[s.id] ? (sceneOf(ABOUT_SHAPE[s.id]), ABOUT_SHAPE[s.id]) : null })) };
  if (ap) {
    const url = '/hakkimizda/';
    const title = ap.title || 'Hakkımızda';
    const facts = (ap.facts || []).map((f) => {
      const src = f.from && Array.isArray(model[f.from]) ? model[f.from] : null;
      const value = src ? String(src.length) : String(f.value ?? '');
      const num = /^\d+$/.test(value);
      // yıl gibi değerler sayaçla saydırılmaz; yalnızca miktarlar (data-count)
      return { label: f.label, value, num, count: num && !/^(19|20)\d\d$/.test(value) };
    });
    add({
      url,
      template: 'pages/company/about.njk',
      title,
      description: model.about?.foundation || site.description,
      ...PAGE.about,
      kind: KIND,
      crumbs,
      ctx: {
        about: model.about || {},
        ap,
        facts,
        ld: graph(
          { ...webPageLd(site, { name: title, url, description: plainInline(ap.lead), type: 'AboutPage' }), about: orgId },
          orgNode(site, c),
          breadcrumbLd(site, [...crumbs, { label: title, url }])
        ),
      },
    });
    // bölümler arama dizinine çapalı kayıt olarak girer
    for (const s of ap.sections || []) {
      add({ url: `${url}#${s.id}`, title: s.heading, description: plainInline((s.paragraphs || [])[0] || ''), kind: KIND, searchOnly: true });
    }
  }

  // ——— Kariyer
  const cr = model.careers;
  if (cr) {
    const url = '/kariyer/';
    const title = cr.title || 'Kariyer';
    const fields = prepFields(cr.form?.fields, { areas: (cr.areas || []).map((a) => ({ value: a.id, label: a.title })) });
    add({
      url,
      template: 'pages/company/careers.njk',
      title,
      description: cr.lead,
      ...PAGE.careers,
      kind: KIND,
      crumbs,
      ctx: {
        cr,
        fields,
        fallbackNote: linkMail(cr.form?.fallbackNote, mailTo),
        successText: linkMail(cr.form?.successText, mailTo),
        mail: { to: mailTo, prefix: '[Kariyer]' },
        ld: graph(webPageLd(site, { name: title, url, description: cr.lead }), breadcrumbLd(site, [...crumbs, { label: title, url }])),
      },
    });
  }

  // ——— İletişim
  const cp = model.contactPage;
  if (cp) {
    const url = '/iletisim/';
    const title = cp.title || 'İletişim';
    const topics = cp.topics || [];
    const fields = prepFields(cp.form?.fields, { topics: topics.map((t) => ({ value: t.id, label: t.label, desc: t.description })) });
    // ?hizmet=<id> ön seçimi: önce konunun açık hizmet listesi, sonra hizmetin alanı (topics[].groups)
    const topicOf = (s) => topics.find((t) => (t.services || []).includes(s.id)) || topics.find((t) => (t.groups || []).includes(s.group));
    const svcMap = Object.fromEntries(model.services.map((s) => [s.id, { t: s.title, k: topicOf(s)?.id || '' }]));
    // ?kisi=<slug> (kişi kartlarından) ve ?sektor=<slug> (sektör sayfalarından) bağlam çipleri: eşlemeler sayfaya gömülür.
    // Mesaj yine kurumun tek adresine gider; kişi/sektör yalnızca gövdeye yazılır (kişiye özel e-posta adresi kullanılmaz).
    const peopleMap = Object.fromEntries((model.team?.members || []).map((p) => [p.slug, { t: p.name, r: p.role }]));
    const sectorMap = Object.fromEntries((model.sectors || []).map((x) => [x.slug, { t: x.name }]));
    // kapanış bölümü: yanıtı kaynaklarıyla sunan sayfalar (sayılar modelden; boş olan gösterilmez)
    const faqCount = (model.faq || []).reduce((n, g) => n + (g.items || []).length, 0);
    const more = [
      { label: 'Sık sorulan sorular', url: '/bilgi-merkezi/sss/', n: faqCount, unit: 'soru' },
      { label: 'Sözlük', url: '/bilgi-merkezi/sozluk/', n: (model.glossary || []).length, unit: 'terim' },
      { label: 'Hesaplayıcılar', url: '/hesaplayicilar/', n: (model.calculators || []).length, unit: 'araç' },
      { label: 'Vergi takvimi', url: '/vergi-takvimi/', n: model.calendar?.count || 0, unit: 'kayıt' },
      { label: 'Kariyer ve genel başvuru', url: '/kariyer/', n: (model.careers?.areas || []).length, unit: 'çalışma alanı' },
    ]
      .filter((x) => x.n > 0)
      .map((x) => ({ label: x.label, url: x.url, meta: `${x.n} ${x.unit}` }));
    // «Doğrudan iletişim» kanalları: bağlantı girilmemiş adres satırı haritaya bağlanır (önce ofis adresi, yoksa satırın kendi metni).
    // Değeri boş kanal bağlantısız kalır (şablon boş durumda çizer).
    const officeMap = c.hasAddress ? mapsUrl([c.street, c.line2, c.country].filter(Boolean).join(', ')) : '';
    const channels = (cp.channels || []).map((ch) => ({
      ...ch,
      href: ch.value ? ch.href || (ch.id === 'address' ? officeMap || mapsUrl(ch.value) : '') : '',
    }));
    add({
      url,
      template: 'pages/company/contact.njk',
      title,
      description: cp.lead,
      ...PAGE.contact,
      kind: KIND,
      crumbs,
      ctx: {
        cp,
        channels,
        fields,
        svcMap,
        peopleMap,
        sectorMap,
        more,
        successText: linkMail(cp.form?.successText, mailTo),
        mapsUrl: officeMap,
        mail: { to: mailTo, prefix: '[Web sitesi]', wa: c.whatsapp || '' },
        ld: graph(
          { ...webPageLd(site, { name: title, url, description: cp.lead, type: 'ContactPage' }), about: orgId },
          orgNode(
            site,
            c,
            // iletişim noktası yalnızca e-posta ya da telefon tanımlıysa (boş alan yapılandırılmış veriye yazılmaz)
            c.email || c.phoneHref
              ? {
                  contactPoint: [
                    {
                      '@type': 'ContactPoint',
                      contactType: 'customer service',
                      ...(c.email ? { email: c.email } : {}),
                      ...(c.phoneHref ? { telephone: c.phoneHref } : {}),
                      areaServed: 'TR',
                      availableLanguage: ['Turkish'],
                    },
                  ],
                }
              : {}
          ),
          breadcrumbLd(site, [...crumbs, { label: title, url }])
        ),
      },
    });
  }
}
