// Ekip modeli: team.json → kişi listesi + hizmet alanı / hizmet / sektör ilişkileri.
// Wagtail karşılığı: TeamIndexPage (title, lead, intro, photo_caption) → TeamMemberPage (her üye bir sayfa; status = yayında/taslak;
//   areas / services / sectors = ParentalManyToManyField; photo = FK Image + yazılı izin onayı; contact = isteğe bağlı alanlar + show_contact).
//   Aşağıdaki atama kuralları Wagtail'de aynen sayfa get_context() / model yöntemi olarak kurulur; veri değişince kural değişmez.
//
// ATAMA KURALLARI (kod değişmeden veriyle yönetilir)
//   hizmet kişileri : o hizmete açıkça atananlar (services) + hizmetin alanının sorumluları (areas) — en çok 3
//   alan kişileri   : alan sorumluları (areas) + alandaki hizmetlerin en az ikisine açıkça atananlar — en çok 3;
//                     toplam 2'den azsa en yakın atamalarla tamamlanır
//   sektör kişileri : sectors ile AÇIKÇA atanmış kişi varsa yalnızca onlar (editör önceliği, en çok 4);
//                     yoksa sektörün hizmetlerini üstlenenlerden TÜRETİLİR (en az 2 hizmet; en çok 3; toplam 2'den azsa tamamlanır)
// Her kişi kaydı: { …üye, via: 'service' | 'area' | 'sector' | 'derived', topics: [{ id, title, url, … }] }.
// Çevrimsel başvuru yoktur: kayıtlarda yalnızca düz özetler (kimlik/ad/adres) taşınır.
export const TEAM_URL = '/hakkimizda/ekibimiz/';

const MAX_PEOPLE = 3;
const MAX_EXPLICIT = 4;
const MIN_PEOPLE = 2;
const ACCENTS = ['b', 'r', 'g'];
const pad2 = (n) => String(n).padStart(2, '0');

// «Ad Soyad» → «AS» (Türkçe büyük harf kuralıyla)
export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = (w) => Array.from(w)[0] || '';
  return (first(parts[0]) + (parts.length > 1 ? first(parts[parts.length - 1]) : '')).toLocaleUpperCase('tr-TR');
}

// «Serbest Muhasebeci Mali Müşavir (TÜRMOB)» → «Serbest Muhasebeci Mali Müşavir»
export const shortTitle = (t) => String(t || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

const brief = {
  group: (g) => ({ id: g.id, name: g.name, short: g.short, url: g.url, number: g.number }),
  service: (s) => ({ id: s.id, title: s.title, url: s.url, groupName: s.groupName, groupNumber: s.groupNumber }),
  sector: (s) => ({ slug: s.slug, name: s.name, short: s.short, url: s.url, segment: !!s.segment }),
};

export function buildTeam(raw, { groups = [], services = [], sectors = [], photos = {} } = {}) {
  if (!raw || !Array.isArray(raw.members)) return null;
  const issues = [];
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const svcById = new Map(services.map((s) => [s.id, s]));
  const sectorBySlug = new Map(sectors.map((s) => [s.slug, s]));
  const only = (ids, map, what, who) =>
    (Array.isArray(ids) ? ids : []).filter((id) => {
      if (map.has(id)) return true;
      issues.push(`team.json › ${who}: bilinmeyen ${what} «${id}»`);
      return false;
    });

  const slugs = new Set();
  const members = raw.members
    .filter((m) => (m.status || 'published') === 'published')
    .map((m, i) => {
      const who = m.slug || m.name || `#${i + 1}`;
      if (!m.slug || !/^[a-z0-9-]+$/.test(m.slug)) issues.push(`team.json › ${who}: slug küçük harf, rakam ve tireden oluşmalı`);
      if (slugs.has(m.slug)) issues.push(`team.json › ${who}: yinelenen slug`);
      slugs.add(m.slug);
      if (!m.name || !m.role) issues.push(`team.json › ${who}: ad ve görev zorunludur`);
      if (m.photo && !photos[m.photo]) issues.push(`team.json › ${who}: photos.json içinde «${m.photo}» yok`);
      const c = m.contact || {};
      const contact = m.showContact && (c.email || c.phone || c.linkedin) ? { email: c.email || '', phone: c.phone || '', linkedin: c.linkedin || '' } : null;
      return {
        ...m,
        titles: m.titles || [],
        titlesShort: (m.titles || []).map(shortTitle),
        bio: m.bio || [],
        expertise: m.expertise || [],
        education: m.education || [],
        areaIds: only(m.areas, groupById, 'hizmet alanı', who),
        svcIds: only(m.services, svcById, 'hizmet', who),
        sectorIds: only(m.sectors, sectorBySlug, 'sektör', who),
        url: `${TEAM_URL}${m.slug}/`,
        number: pad2(i + 1),
        initials: initialsOf(m.name),
        accent: ACCENTS[i % ACCENTS.length],
        photoKey: m.photo && photos[m.photo] ? m.photo : null,
        // gizli iletişim bilgileri hiçbir şablona ulaşmaz: yalnızca showContact açıkken dolu
        contact,
      };
    });

  const owns = (m, s) => m.svcIds.includes(s.id) || m.areaIds.includes(s.group);
  const asPerson = (m, via, list = []) => ({ ...m, via, topics: list.map(brief.service) });

  // ——— Hizmetler
  for (const s of services) {
    const explicit = members.filter((m) => m.svcIds.includes(s.id));
    const leads = members.filter((m) => m.areaIds.includes(s.group) && !m.svcIds.includes(s.id));
    s.people = [...explicit.map((m) => asPerson(m, 'service')), ...leads.map((m) => asPerson(m, 'area'))].slice(0, MAX_PEOPLE);
  }

  // ——— Hizmet alanları
  for (const g of groups) {
    const gs = services.filter((s) => s.group === g.id);
    const explicitIn = (m) => gs.filter((s) => m.svcIds.includes(s.id));
    const leads = members.filter((m) => m.areaIds.includes(g.id));
    const ranked = members
      .filter((m) => !leads.includes(m))
      .map((m) => ({ m, list: explicitIn(m) }))
      .filter((x) => x.list.length)
      .sort((a, b) => b.list.length - a.list.length);
    const chosen = [
      ...leads.map((m) => ({ m, via: 'area', list: explicitIn(m) })),
      ...ranked.filter((x) => x.list.length >= 2).map((x) => ({ m: x.m, via: 'service', list: x.list })),
    ].slice(0, MAX_PEOPLE);
    for (const x of ranked) {
      if (chosen.length >= MIN_PEOPLE) break;
      if (!chosen.some((c) => c.m === x.m)) chosen.push({ m: x.m, via: 'service', list: x.list });
    }
    g.people = chosen.map((c) => asPerson(c.m, c.via, c.list));
  }

  // ——— Sektörler
  for (const sec of sectors) {
    const ss = (sec.services || []).map((id) => svcById.get(id)).filter(Boolean);
    const explicit = members.filter((m) => m.sectorIds.includes(sec.slug));
    if (explicit.length) {
      sec.people = explicit.slice(0, MAX_EXPLICIT).map((m) => asPerson(m, 'sector', ss.filter((s) => owns(m, s))));
      sec.peopleDerived = false;
      continue;
    }
    const ranked = members
      .map((m) => ({ m, list: ss.filter((s) => owns(m, s)), ex: ss.filter((s) => m.svcIds.includes(s.id)).length }))
      .filter((x) => x.list.length)
      .sort((a, b) => b.list.length - a.list.length || b.ex - a.ex);
    const strong = ranked.filter((x) => x.list.length >= 2).slice(0, MAX_PEOPLE);
    sec.people = (strong.length >= MIN_PEOPLE ? strong : ranked.slice(0, MIN_PEOPLE)).map((x) => asPerson(x.m, 'derived', x.list));
    sec.peopleDerived = true;
  }

  // ——— Ters ilişkiler (profil sayfası): alanlar, hizmetler (alana göre), sektörler
  for (const m of members) {
    m.groupList = groups.filter((g) => g.people.some((p) => p.slug === m.slug)).map(brief.group);
    m.sectorList = sectors.filter((s) => s.people.some((p) => p.slug === m.slug)).map(brief.sector);
    m.svcGroups = groups
      .map((g) => ({ group: brief.group(g), lead: m.areaIds.includes(g.id), items: services.filter((s) => s.group === g.id && owns(m, s)).map(brief.service) }))
      .filter((x) => x.items.length);
  }

  return {
    title: raw.title || 'Ekibimiz',
    lead: raw.lead || '',
    intro: raw.intro || '',
    photoCaption: raw.photoCaption || '',
    url: TEAM_URL,
    members,
    bySlug: Object.fromEntries(members.map((m) => [m.slug, m])),
    // yayından önce kişiyle doğrulanması gerekenler (derlemede uyarı olarak yazılır)
    unverified: members.filter((m) => m.needsVerification).map((m) => m.slug),
    issues,
  };
}
