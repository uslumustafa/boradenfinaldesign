// Ekibimiz + kişi profilleri: /hakkimizda/ekibimiz/ ve /hakkimizda/ekibimiz/<slug>/.
// Wagtail karşılığı: TeamIndexPage (HakkımızdaPage'in alt sayfası) → TeamMemberPage (bkz. scripts/team.mjs, WAGTAIL_MAP.md «Ekip»).
// Kişi–alan/hizmet/sektör ilişkileri model aşamasında kurulur (model.team; groups/services/sectors üzerinde `people`).
import { baseOf, breadcrumbLd, graph, listLd, orgRef, webPageLd } from '../ld.mjs';
import { plainInline } from '../filters.mjs';

const KIND = 'Ekip';
const pad2 = (n) => String(n).padStart(2, '0');

export function registerTeam({ add, model, site, home }) {
  const team = model.team;
  if (!team || !team.members.length) return;
  // geçersiz kimlik/slug: üretimde derlemeyi durdurur; geliştirmede yalnızca bu modül düşer (routes.mjs → safe)
  if (team.issues.length) throw new Error(`Ekip verisi (src/data/team.json) hatalı:\n  - ${team.issues.join('\n  - ')}`);

  const base = baseOf(site);
  const aboutCrumb = { label: 'Hakkımızda', url: '/hakkimizda/' };
  const teamCrumb = { label: team.title, url: team.url };

  // ——— Ekibimiz
  add({
    url: team.url,
    template: 'pages/company/team.njk',
    title: team.title,
    titleFull: `${team.title}: Yönetici ve Uzmanlarımız — ${site.name}`,
    description: team.lead,
    scene: 3,
    kind: 'Kurumsal',
    crumbs: [home, aboutCrumb],
    ctx: {
      team,
      sectorRows: model.sectors.map((s, i) => ({ ...s, number: pad2(i + 1) })),
      ld: listLd(site, team.title, team.url, team.members.map((p) => ({ title: p.name, url: p.url })), [home, aboutCrumb, teamCrumb]),
    },
  });

  // ——— Kişi profilleri
  team.members.forEach((p, i) => {
    const crumbs = [home, aboutCrumb, teamCrumb];
    const personId = `${base}${p.url}#kisi`;
    const person = {
      '@type': 'Person',
      '@id': personId,
      name: p.name,
      jobTitle: p.role,
      url: base + p.url,
      description: plainInline(p.summary),
      worksFor: orgRef(site),
    };
    if (p.expertise.length) person.knowsAbout = p.expertise;
    // iletişim bilgisi yalnızca kişi açıkça izin verdiyse (showContact) yapılandırılmış veriye girer
    if (p.contact?.email) person.email = p.contact.email;
    if (p.contact?.phone) person.telephone = p.contact.phone;
    if (p.contact?.linkedin) person.sameAs = [p.contact.linkedin];
    add({
      url: p.url,
      template: 'pages/company/person.njk',
      title: p.name,
      titleFull: `${p.name} — ${p.role} — ${site.name}`,
      description: p.summary,
      scene: 3,
      kind: KIND,
      crumbs,
      ctx: {
        person: p,
        others: team.members.filter((x) => x.slug !== p.slug),
        prev: team.members[i - 1] || null,
        next: team.members[i + 1] || null,
        ld: graph(
          { ...webPageLd(site, { name: p.name, url: p.url, description: plainInline(p.summary), type: 'ProfilePage' }), mainEntity: { '@id': personId } },
          person,
          breadcrumbLd(site, [...crumbs, { label: p.name, url: p.url }])
        ),
      },
    });
  });
}
