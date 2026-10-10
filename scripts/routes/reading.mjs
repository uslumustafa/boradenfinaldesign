// Okuma sayfaları: sektör raporları, okuma notları (perspectives).
// Wagtail karşılığı: ReportIndexPage + Report snippet'i (content.json → sectorReports şeması),
//   ReadingNoteIndexPage + ReadingNotePage (content.json → perspectives şeması).
// Bu modül yalnızca türetilmiş alanları hesaplar (sıra numarası, tür sayıları, komşu notlar, ilgili hizmet, alan adı);
// metinler veriden gelir, şablonlar yalnızca sunar.
import { baseOf, breadcrumbLd, graph, orgRef, webPageLd } from '../ld.mjs';
import { PAGE } from '../scenes.mjs';
import { slugify } from '../filters.mjs';

export const HUB = { label: 'Bilgi Merkezi', url: '/bilgi-merkezi/' };
export const REPORTS_URL = '/bilgi-merkezi/sektor-raporlari/';
export const NOTES_URL = '/bilgi-merkezi/okuma-notlari/';
export const noteUrl = (id) => `${NOTES_URL}${id}/`;

// Sayfa metinleri (Wagtail: ilgili Page modelindeki alanlar)
const REPORTS_COPY = {
  title: 'Sektör Raporları',
  lead: 'Kamu kurumları ve meslek kuruluşlarının yayımladığı sektör raporları ve istatistikleri; dönemi, yayın tarihi ve bağlantının son kontrol tarihiyle birlikte.',
  description: 'Kamu kurumları ve meslek kuruluşlarının sektör raporları ve istatistiklerine dönem, yayın tarihi ve son kontrol tarihiyle birlikte bağlantılar.',
  note: 'Bu sayfa kurumların kendi yayınlarına bağlantı verir; içerikler ilgili kurumlara aittir ve Boraden görüşü değildir. Bağlantıların içeriği değişmiş olabilir.',
};
const NOTES_COPY = {
  title: 'Okuma Notları',
  lead: 'Ekonomi ve yönetim alanındaki temel metinlerden işletmelerin günlük sorularına uzanan kısa okumalar; her notta kaynak metne bağlantı verilir.',
  description: 'Ekonomi ve yönetim alanındaki temel metinlerden yola çıkan, işletme sorularına odaklanan kısa okuma notları; her notta kaynak bağlantısı.',
  disclaimer: 'Bu yazı, kaynağın kendi sözlerinin yerine geçmez; kaynak metin bağlantıdadır ve esas alınmalıdır. Genel bilgilendirme amaçlıdır.',
};
// Rapor türlerinin görünüm sırası (veride olmayan tür sona eklenir)
const KIND_ORDER = ['İstatistik', 'Rapor', 'Araştırma'];

const isPdf = (u) => /\.pdf($|[?#])/i.test(String(u || ''));
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const maxOf = (arr) => arr.filter(Boolean).sort().pop() || null;

// Sektör raporları: yeni → eski (tarihi olmayanlar sonda), tür sayıları, ek bağlantılar
export function reportsModel(model) {
  const items = (model.sectorReports || [])
    .map((r, i) => {
      const extra = [];
      if (r.reportUrl) extra.push({ label: isPdf(r.reportUrl) ? 'Rapor dosyası (PDF)' : 'Rapor dosyası', url: r.reportUrl });
      if (r.announcementUrl) extra.push({ label: 'Duyuru', url: r.announcementUrl });
      // ortak yayınlarda kurumlar "A · B" biçiminde yazılır → ayrı çipler
      const publishers = String(r.publisher || '').split(/\s*·\s*/).filter(Boolean);
      return { ...r, i, kindSlug: slugify(r.kind), host: hostOf(r.url), extra, publishers };
    })
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || a.i - b.i);
  const kinds = [...new Set(items.map((r) => r.kind))]
    .sort((a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99))
    .map((k) => ({ label: k, slug: slugify(k), count: items.filter((r) => r.kind === k).length }));
  return { items, kinds, lastChecked: maxOf(items.map((r) => r.checkedAt)) };
}

// Okuma notları: sıra numarası, adres, ilgili hizmet, bölüm çapaları
export function notesModel(model) {
  const notes = (model.perspectives || []).map((p, i) => {
    const used = new Set();
    const secs = (p.sections || []).map(([title, text], k) => {
      let id = slugify(title) || `bolum-${k + 1}`;
      if (used.has(id) || ['giris', 'onemli-nokta', 'sorular', 'kaynak'].includes(id)) id = `${id}-${k + 1}`;
      used.add(id);
      return { id, title, text };
    });
    const svc = p.service ? model.servicesById[p.service] || null : null;
    return {
      ...p,
      n: i + 1,
      url: noteUrl(p.id),
      secs,
      svc,
      sourceIsPdf: isPdf(p.source),
      sourceHost: hostOf(p.source),
      // kaynak tarihi yalnızca doğrulanmışsa gösterilir
      sourceDateShown: p.sourceDate && p.sourceDateVerified === true ? p.sourceDate : null,
    };
  });
  // süzgeç: ilgili hizmete göre (ilk görünüş sırasıyla, adetli)
  const filters = [];
  for (const n of notes) {
    if (!n.svc) continue;
    const f = filters.find((x) => x.id === n.svc.id);
    if (f) f.count++;
    else filters.push({ id: n.svc.id, label: n.svc.title, count: 1 });
  }
  return { notes, filters };
}

export function registerReading({ add, model, site, home }) {
  const base = baseOf(site);

  // ——— Sektör raporları
  const rep = reportsModel(model);
  const repCrumbs = [home, HUB];
  const repTrail = [...repCrumbs, { label: REPORTS_COPY.title, url: REPORTS_URL }];
  add({
    url: REPORTS_URL,
    template: 'pages/reading/reports.njk',
    title: REPORTS_COPY.title,
    description: REPORTS_COPY.description,
    lastmod: rep.lastChecked,
    ...PAGE.reports,
    kind: 'Bilgi merkezi',
    crumbs: repCrumbs,
    ctx: {
      copy: REPORTS_COPY,
      reports: rep.items,
      kinds: rep.kinds,
      kindsLabel: rep.kinds.map((k) => k.label).join(' · '),
      lastChecked: rep.lastChecked,
      ld: graph(
        webPageLd(site, { name: REPORTS_COPY.title, url: REPORTS_URL, description: REPORTS_COPY.description, type: 'CollectionPage', dateModified: rep.lastChecked }),
        { '@type': 'ItemList', name: REPORTS_COPY.title, itemListElement: rep.items.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `${r.title} (${r.period})`, url: r.url })) },
        breadcrumbLd(site, repTrail)
      ),
    },
  });
  // her rapor aramada bulunsun: kayıt sayfadaki satıra (çapa) gider, dış bağlantı ve tarafsız not orada görünür
  for (const r of rep.items) {
    add({ url: `${REPORTS_URL}#${r.id}`, title: `${r.title} (${r.period})`, description: `${r.publisher} · ${r.kind}. ${r.summary}`, kind: 'Sektör raporu', searchOnly: true });
  }

  // ——— Okuma notları
  const { notes, filters } = notesModel(model);
  const noteCrumbs = [home, HUB];
  const notesCrumb = { label: NOTES_COPY.title, url: NOTES_URL };
  add({
    url: NOTES_URL,
    template: 'pages/reading/notes-index.njk',
    title: NOTES_COPY.title,
    description: NOTES_COPY.description,
    ...PAGE.notes,
    kind: 'Bilgi merkezi',
    crumbs: noteCrumbs,
    ctx: {
      copy: NOTES_COPY,
      notes,
      filters,
      ld: graph(
        webPageLd(site, { name: NOTES_COPY.title, url: NOTES_URL, description: NOTES_COPY.description, type: 'CollectionPage' }),
        { '@type': 'ItemList', itemListElement: notes.map((n, i) => ({ '@type': 'ListItem', position: i + 1, name: n.title, url: base + n.url })) },
        breadcrumbLd(site, [...noteCrumbs, notesCrumb])
      ),
    },
  });

  notes.forEach((n, i) => {
    const crumbs = [home, HUB, notesCrumb];
    const prev = notes[i - 1] || null;
    const next = notes[i + 1] || null;
    const article = {
      '@type': 'Article',
      headline: n.title,
      description: n.summary,
      url: base + n.url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': base + n.url },
      inLanguage: 'tr-TR',
      articleSection: NOTES_COPY.title,
      author: orgRef(site),
      publisher: orgRef(site),
      isBasedOn: { '@type': 'CreativeWork', name: n.sourceTitle, url: n.source, ...(n.sourceDateShown ? { datePublished: n.sourceDateShown } : {}) },
    };
    if (n.svc) article.about = { '@type': 'Service', name: n.svc.title, url: base + n.svc.url };
    add({
      url: n.url,
      template: 'pages/reading/note.njk',
      title: n.title,
      titleFull: `${n.title} — Okuma notu — ${site.name}`,
      description: n.summary,
      ogType: 'article',
      ...PAGE.note,
      kind: 'Okuma notu',
      crumbs,
      ctx: {
        note: n,
        total: notes.length,
        disclaimer: NOTES_COPY.disclaimer,
        indexUrl: NOTES_URL,
        prev: prev && { title: prev.title, url: prev.url, topic: prev.topic },
        next: next && { title: next.title, url: next.url, topic: next.topic },
        ld: graph(article, breadcrumbLd(site, [...crumbs, { label: n.title, url: n.url }])),
      },
    });
  });
}
