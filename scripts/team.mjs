// Ekip modeli: team.json → kişi listesi + bölümler + hizmet alanı / hizmet / sektör ilişkileri.
// Wagtail karşılığı: TeamIndexPage (title, lead, intro) → TeamMemberPage (status = yayında/taslak; department = TeamDepartment snippet'i (sıralı);
//   has_profile = kendi sayfası var mı (false ise yalnızca Ekibimiz'de bölümü altında satırdır; adresi `/hakkimizda/ekibimiz/#<slug>`);
//   areas / services / sectors = ParentalManyToManyField; photo = FK Image + yazılı izin onayı; contact = isteğe bağlı alanlar + show_contact).
//   Aşağıdaki atama kuralları Wagtail'de aynen sayfa get_context() / model yöntemi olarak kurulur; veri değişince kural değişmez.
//
// BÖLÜMLER: team.json › departments (sıra = kurum şemasındaki sıra); her üye `department` ile birine bağlanır. Bölüm tanımı yoksa tek, adsız grup.
//   Bölümün `areas` listesi bölümü hizmet alan(lar)ına bağlar (Wagtail: TeamDepartment.areas → ServiceAreaPage, ParentalManyToManyField):
//   bölümdeki herkes o alanın ve alandaki hizmetlerin ekip listelerine girer. Bu bağ kişinin profilindeki hizmet listesini ve sektör
//   türetmesini genişletmez (onlar yalnızca kişinin kendi areas/services atamalarından gelir).
// PROFİL: `profile: false` olan üyenin sayfası/JSON-LD'si yoktur; `profiles` yalnızca kendi sayfası olanları verir.
//
// ATAMA KURALLARI (kod değişmeden veriyle yönetilir)
//   hizmet kişileri : o hizmete açıkça atananlar (services) + hizmetin alanının sorumluları (areas)
//                     + bölümü o alana bağlı kişiler — en çok 3
//   alan kişileri   : alan sorumluları (areas) + alandaki hizmetlerin en az ikisine açıkça atananlar
//                     + bölümü o alana bağlı kişiler — en çok 4 (bir alana birden çok bölüm bağlanır); toplam 2'den azsa
//                     en yakın atamalarla tamamlanır
//   bölüm bağıyla gelenler bölümler arasında dönüşümlü sıralanır (her bölümün şemadaki ilk kişisi önce; bölüm içinde kayıt sırası)
//   sektör kişileri : sectors ile AÇIKÇA atanmış kişi varsa yalnızca onlar (editör önceliği, en çok 4);
//                     yoksa sektörün hizmetlerini üstlenenlerden TÜRETİLİR (en az 2 hizmet; en çok 3; toplam 2'den azsa tamamlanır)
// Her kişi kaydı: { …üye, via: 'service' | 'area' | 'department' | 'sector' | 'derived', topics: [{ id, title, url, … }] }.
// Çevrimsel başvuru yoktur: kayıtlarda yalnızca düz özetler (kimlik/ad/adres) taşınır.
export const TEAM_URL = '/hakkimizda/ekibimiz/';

const MAX_PEOPLE = 3; // hizmet sayfası
const MAX_AREA = 4; // alan sayfası (2 × 2 kart)
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

  // Bölümler: { id, name } listesi (kurum şemasındaki sıra)
  const rawDepts = Array.isArray(raw.departments) ? raw.departments : [];
  const deptName = new Map();
  for (const d of rawDepts) {
    if (!d || !/^[a-z0-9-]+$/.test(d.id || '')) issues.push(`team.json › bölüm «${d?.id || d?.name || '?'}»: id küçük harf, rakam ve tireden oluşmalı`);
    else if (deptName.has(d.id)) issues.push(`team.json › bölüm «${d.id}»: yinelenen id`);
    if (!d?.name) issues.push(`team.json › bölüm «${d?.id || '?'}»: ad zorunludur`);
    if (d?.id) deptName.set(d.id, d.name || '');
  }
  // bölüm → bağlı hizmet alanları (bilinmeyen alan kimliği hata listesine yazılır)
  const deptAreas = new Map(rawDepts.filter((d) => d?.id).map((d) => [d.id, only(d.areas, groupById, 'hizmet alanı', `bölüm «${d.id}»`)]));
  const deptRank = new Map(rawDepts.filter((d) => d?.id).map((d, i) => [d.id, i]));

  const slugs = new Set();
  const verifyNotes = []; // [{ slug, note }]: yayından önce neyin doğrulanacağı (derlemede uyarı olarak yazılır; sitede gösterilmez)
  const members = raw.members
    .filter((m) => (m.status || 'published') === 'published')
    .map((m, i) => {
      const who = m.slug || m.name || `#${i + 1}`;
      if (!m.slug || !/^[a-z0-9-]+$/.test(m.slug)) issues.push(`team.json › ${who}: slug küçük harf, rakam ve tireden oluşmalı`);
      if (slugs.has(m.slug)) issues.push(`team.json › ${who}: yinelenen slug`);
      slugs.add(m.slug);
      if (!m.name || !m.role) issues.push(`team.json › ${who}: ad ve görev zorunludur`);
      if (m.photo && !photos[m.photo]) issues.push(`team.json › ${who}: photos.json içinde «${m.photo}» yok`);
      if (rawDepts.length && !deptName.has(m.department)) issues.push(`team.json › ${who}: bilinmeyen bölüm «${m.department || ''}»`);
      const c = m.contact || {};
      const contact = m.showContact && (c.email || c.phone || c.linkedin) ? { email: c.email || '', phone: c.phone || '', linkedin: c.linkedin || '' } : null;
      const profile = m.profile !== false; // varsayılan: kendi sayfası var
      // `verifyNote` (neyin doğrulanacağı) ve `source` (kaynak) editoryal üst veridir; kişi kaydına/şablonlara taşınmaz
      const { verifyNote, ...pub } = m;
      delete pub.source;
      if (verifyNote) verifyNotes.push({ slug: m.slug, note: verifyNote });
      return {
        ...pub,
        profile,
        department: m.department || '',
        departmentName: deptName.get(m.department) || '',
        titles: m.titles || [],
        titlesShort: (m.titles || []).map(shortTitle),
        bio: m.bio || [],
        expertise: m.expertise || [],
        education: m.education || [],
        areaIds: only(m.areas, groupById, 'hizmet alanı', who),
        svcIds: only(m.services, svcById, 'hizmet', who),
        sectorIds: only(m.sectors, sectorBySlug, 'sektör', who),
        // bölümünden gelen alan bağı (yalnızca alan/hizmet ekip listeleri için; profil ve sektör türetmesine girmez)
        deptAreaIds: deptAreas.get(m.department) || [],
        // kendi sayfası olmayan üyenin adresi: Ekibimiz sayfasındaki satırı (listelerdeki bağlantılar oraya gider)
        url: profile ? `${TEAM_URL}${m.slug}/` : `${TEAM_URL}#${m.slug}`,
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

  // Bölüm bağıyla alana gelen kişiler: bölümler dönüşümlü (her bölümün ilk kişisi önce), bölüm içinde kayıt sırası
  const viaDept = new Map(
    groups.map((g) => {
      const byDept = new Map();
      for (const m of members) if (m.deptAreaIds.includes(g.id)) byDept.set(m.department, [...(byDept.get(m.department) || []), m]);
      const lists = [...byDept.entries()].sort((a, b) => (deptRank.get(a[0]) ?? 0) - (deptRank.get(b[0]) ?? 0)).map(([, l]) => l);
      const out = [];
      for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
      return [g.id, out];
    })
  );

  // ——— Hizmetler
  for (const s of services) {
    const explicit = members.filter((m) => m.svcIds.includes(s.id));
    const leads = members.filter((m) => m.areaIds.includes(s.group) && !m.svcIds.includes(s.id));
    const dept = (viaDept.get(s.group) || []).filter((m) => !explicit.includes(m) && !leads.includes(m));
    s.people = [
      ...explicit.map((m) => asPerson(m, 'service')),
      ...leads.map((m) => asPerson(m, 'area')),
      ...dept.map((m) => asPerson(m, 'department')),
    ].slice(0, MAX_PEOPLE);
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
    ];
    for (const m of viaDept.get(g.id) || []) if (!chosen.some((c) => c.m === m)) chosen.push({ m, via: 'department', list: explicitIn(m) });
    chosen.splice(MAX_AREA);
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

  // Bölümlere göre gruplama (bölüm sırası = team.json sırası; üye sırası = kayıt sırası). Bölüm tanımı yoksa tek, adsız grup.
  const departments = (
    rawDepts.length
      ? rawDepts.filter((d) => d?.id).map((d, i) => ({
          id: d.id,
          name: d.name || '',
          number: pad2(i + 1),
          areas: (deptAreas.get(d.id) || []).map((id) => brief.group(groupById.get(id))),
          members: members.filter((m) => m.department === d.id),
        }))
      : [{ id: 'ekip', name: '', number: '01', areas: [], members }]
  ).filter((d) => d.members.length);

  return {
    title: raw.title || 'Ekibimiz',
    lead: raw.lead || '',
    intro: raw.intro || '',
    url: TEAM_URL,
    members,
    // kendi profil sayfası olanlar (sayfa yolları, komşu profiller, Hakkımızda özeti, site haritası)
    profiles: members.filter((m) => m.profile),
    departments,
    bySlug: Object.fromEntries(members.map((m) => [m.slug, m])),
    // yayından önce doğrulanması gerekenler (derlemede uyarı olarak yazılır)
    unverified: members.filter((m) => m.needsVerification).map((m) => m.slug),
    verifyNotes,
    issues,
  };
}
