// Ekip modeli (scripts/team.mjs): atama kuralları, gizli iletişim bilgisi, veri bütünlüğü. DOM/tarayıcı gerekmez.
//   node --test tests/team.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeam, initialsOf, shortTitle } from '../scripts/team.mjs';
import { loadData } from '../scripts/build.mjs';
import { buildModel } from '../scripts/model.mjs';

// ——— Yapay veri: iki alan (a, b), dört hizmet, üç sektör
const mk = () => {
  const groups = [
    { id: 'a', name: 'Alan A', short: 'A', url: '/hizmetler/a/', number: '01' },
    { id: 'b', name: 'Alan B', short: 'B', url: '/hizmetler/b/', number: '02' },
  ];
  const svc = (id, group) => ({ id, group, title: id.toUpperCase(), url: `/hizmetler/${group}/${id}/`, groupName: group, groupNumber: '00' });
  const services = [svc('s1', 'a'), svc('s2', 'a'), svc('s3', 'b'), svc('s4', 'b')];
  const sectors = [
    { slug: 'x', name: 'X', short: '', url: '/sektorler/x/', services: ['s1', 's2', 's3'] },
    { slug: 'y', name: 'Y', short: '', url: '/sektorler/y/', services: ['s3', 's4'] },
    { slug: 'z', name: 'Z', short: '', url: '/sektorler/z/', services: ['s1'] },
  ];
  return { groups, services, sectors };
};
const person = (slug, extra = {}) => ({ slug, name: `Kişi ${slug}`, role: 'Uzman', areas: [], services: [], sectors: [], status: 'published', ...extra });

test('baş harfler Türkçe büyük harf kuralıyla çıkar', () => {
  assert.equal(initialsOf('Cengiz Turmaz'), 'CT');
  assert.equal(initialsOf('ismail yılmaz'), 'İY');
  assert.equal(initialsOf('ışık şahin'), 'IŞ');
  assert.equal(initialsOf('Çisem Güler'), 'ÇG');
  assert.equal(initialsOf('Gamze Gül Çokan Çelik'), 'GÇ'); // ikiden çok parça: ilk ve son
  assert.equal(initialsOf('Madonna'), 'M');
  assert.equal(initialsOf(''), '');
});

test('unvanın parantez içi kurum adı kısa biçimde atılır', () => {
  assert.equal(shortTitle('Serbest Muhasebeci Mali Müşavir (TÜRMOB)'), 'Serbest Muhasebeci Mali Müşavir');
  assert.equal(shortTitle('Bilirkişi (İstanbul Adli Yargı İlk Derece Mahkemesi Adalet Komisyonu Başkanlığı)'), 'Bilirkişi');
  assert.equal(shortTitle('Bağımsız Denetçi'), 'Bağımsız Denetçi');
});

test('hizmet kişileri: açık atananlar önce, sonra alan sorumluları', () => {
  const ctx = mk();
  const t = buildTeam({ members: [person('m1', { services: ['s1', 's2'] }), person('m2', { areas: ['b'] }), person('m3', { services: ['s4'] })] }, ctx);
  const byId = Object.fromEntries(ctx.services.map((s) => [s.id, s]));
  assert.deepEqual(byId.s1.people.map((p) => [p.slug, p.via]), [['m1', 'service']]);
  assert.deepEqual(byId.s4.people.map((p) => [p.slug, p.via]), [['m3', 'service'], ['m2', 'area']]);
  assert.deepEqual(byId.s3.people.map((p) => [p.slug, p.via]), [['m2', 'area']]);
  assert.equal(t.issues.length, 0);
});

test('alan kişileri: sorumlular önce; ≥2 hizmete atananlar eklenir; en az 2 kişiye tamamlanır', () => {
  const ctx = mk();
  buildTeam({ members: [person('m1', { services: ['s1', 's2'] }), person('m2', { areas: ['b'] }), person('m3', { services: ['s4'] })] }, ctx);
  const [a, b] = ctx.groups;
  assert.deepEqual(a.people.map((p) => p.slug), ['m1']); // tek aday: tamamlanacak başka kişi yok
  assert.deepEqual(b.people.map((p) => [p.slug, p.via]), [['m2', 'area'], ['m3', 'service']]); // 1 sorumlu + tamamlama
  assert.deepEqual(a.people[0].topics.map((x) => x.id), ['s1', 's2']);
});

test('sektör kişileri: hizmet sahiplerinden türetilir (en çok hizmet önce, en az 2 kişi)', () => {
  const ctx = mk();
  buildTeam({ members: [person('m1', { services: ['s1', 's2'] }), person('m2', { areas: ['b'] }), person('m3', { services: ['s4'] })] }, ctx);
  const [x, y] = ctx.sectors;
  assert.equal(x.peopleDerived, true);
  assert.deepEqual(x.people.map((p) => p.slug), ['m1', 'm2']); // m1: 2 hizmet, m2: 1 (alan sorumlusu) → 2 kişiye tamamlandı
  assert.deepEqual(y.people.map((p) => p.slug), ['m2', 'm3']); // m2: 2 hizmet (s3, s4), m3: 1
  assert.deepEqual(x.people[0].topics.map((t) => t.id), ['s1', 's2']);
});

test('sektöre açık atama varsa türetme devre dışı kalır (editör önceliği)', () => {
  const ctx = mk();
  buildTeam({ members: [person('m1', { services: ['s1', 's2'] }), person('m3', { sectors: ['z'] })] }, ctx);
  const z = ctx.sectors.find((s) => s.slug === 'z');
  assert.equal(z.peopleDerived, false);
  assert.deepEqual(z.people.map((p) => [p.slug, p.via]), [['m3', 'sector']]);
});

test('bilinmeyen alan/hizmet/sektör kimlikleri ve eksik zorunlu alanlar hata listesine yazılır', () => {
  const ctx = mk();
  const t = buildTeam({ members: [person('m1', { areas: ['yok'], services: ['yok2'], sectors: ['yok3'], photo: 'foto-yok' }), { slug: 'Kötü Slug', status: 'published' }] }, ctx);
  const text = t.issues.join('\n');
  for (const k of ['yok', 'yok2', 'yok3', 'foto-yok', 'slug', 'zorunlu']) assert.ok(text.includes(k), `${k} için hata beklenirdi:\n${text}`);
  assert.deepEqual(t.members[0].areaIds, []); // geçersiz kimlikler atanmaz
});

test('iletişim bilgisi yalnızca showContact=true iken modele girer', () => {
  const ctx = mk();
  const t = buildTeam(
    {
      members: [
        person('gizli', { contact: { email: 'gizli@ornek.com', phone: '+90 212 000 00 00', linkedin: 'https://linkedin.com/in/x' }, showContact: false }),
        person('acik', { contact: { email: 'acik@ornek.com', phone: '', linkedin: '' }, showContact: true }),
        person('bos', { contact: { email: '', phone: '', linkedin: '' }, showContact: true }),
      ],
    },
    ctx
  );
  assert.equal(t.bySlug.gizli.contact, null);
  assert.deepEqual(t.bySlug.acik.contact, { email: 'acik@ornek.com', phone: '', linkedin: '' });
  assert.equal(t.bySlug.bos.contact, null, 'izin açık ama alanlar boşsa kutu çizilmez');
  assert.ok(!JSON.stringify(t).includes('gizli@ornek.com'), 'gizli e-posta hiçbir yerde bulunmamalı');
  assert.ok(!JSON.stringify(ctx).includes('gizli@ornek.com'), 'alan/hizmet/sektör kayıtlarına da sızmamalı');
});

test('taslak kişiler yayımlanmaz; çevrimsel başvuru yok (JSON.stringify çalışır)', () => {
  const ctx = mk();
  const t = buildTeam({ members: [person('m1', { services: ['s1'] }), person('taslak', { status: 'draft', services: ['s1'] })] }, ctx);
  assert.deepEqual(t.members.map((m) => m.slug), ['m1']);
  assert.ok(!ctx.services[0].people.some((p) => p.slug === 'taslak'));
  assert.doesNotThrow(() => JSON.stringify([t, ctx]));
});

test('bölümler: sıra team.json sırasıdır; bilinmeyen/yinelenen bölüm ve eksik ad hata listesine yazılır', () => {
  const ctx = mk();
  const raw = {
    departments: [{ id: 'bir', name: 'Bir' }, { id: 'iki', name: 'İki' }, { id: 'bos', name: 'Boş' }],
    members: [person('a', { department: 'iki' }), person('b', { department: 'bir' }), person('c', { department: 'iki' })],
  };
  const t = buildTeam(raw, ctx);
  assert.deepEqual(t.issues, []);
  assert.deepEqual(t.departments.map((d) => [d.id, d.name, d.members.map((m) => m.slug)]), [['bir', 'Bir', ['b']], ['iki', 'İki', ['a', 'c']]]); // boş bölüm çizilmez
  assert.equal(t.bySlug.a.departmentName, 'İki');
  const bad = buildTeam({ departments: [{ id: 'x', name: 'X' }, { id: 'x', name: '' }, { id: 'Kötü Id', name: 'Y' }], members: [person('a', { department: 'yok' }), person('b')] }, mk());
  const text = bad.issues.join('\n');
  for (const k of ['yinelenen', 'ad zorunludur', 'id küçük harf', 'bilinmeyen bölüm «yok»', 'bilinmeyen bölüm «»']) assert.ok(text.includes(k), `${k} için hata beklenirdi:\n${text}`);
});

test('bölüm tanımı yoksa tek, adsız grup; profile: false olan üyenin adresi Ekibimiz sayfasındaki satırıdır ve profiles listesine girmez', () => {
  const t = buildTeam({ members: [person('a'), person('b', { profile: false })] }, mk());
  assert.deepEqual(t.issues, []);
  assert.equal(t.departments.length, 1);
  assert.equal(t.departments[0].name, '');
  assert.deepEqual(t.departments[0].members.map((m) => m.slug), ['a', 'b']);
  assert.equal(t.bySlug.a.url, '/hakkimizda/ekibimiz/a/');
  assert.equal(t.bySlug.b.url, '/hakkimizda/ekibimiz/#b');
  assert.deepEqual(t.profiles.map((m) => m.slug), ['a']);
});

test('bölüm → alan bağı: bölümdeki herkes alanın ve hizmetlerinin ekibinde; açık atamalar önce, bölümler dönüşümlü; profil ve sektör genişlemez', () => {
  const ctx = mk();
  const raw = {
    departments: [{ id: 'd1', name: 'Bir', areas: ['a'] }, { id: 'd2', name: 'İki', areas: ['a'] }, { id: 'd3', name: 'Üç' }],
    members: [
      person('p1', { department: 'd1' }),
      person('p2', { department: 'd1' }),
      person('p3', { department: 'd2' }),
      person('p4', { department: 'd2', services: ['s2'] }),
      person('p5', { department: 'd3', services: ['s1'] }),
    ],
  };
  const t = buildTeam(raw, ctx);
  assert.deepEqual(t.issues, []);
  const byId = Object.fromEntries(ctx.services.map((s) => [s.id, s]));
  const [a, b] = ctx.groups;
  // hizmet: açık atanan önce, sonra bölüm bağıyla gelenler dönüşümlü (d1'in ilki, d2'nin ilki, …) — en çok 3
  assert.deepEqual(byId.s1.people.map((p) => [p.slug, p.via]), [['p5', 'service'], ['p1', 'department'], ['p3', 'department']]);
  assert.deepEqual(byId.s2.people.map((p) => [p.slug, p.via]), [['p4', 'service'], ['p1', 'department'], ['p3', 'department']]);
  assert.deepEqual(byId.s3.people, []);
  // alan: bölüm bağıyla dönüşümlü, en çok 4; kişinin alandaki açık hizmetleri kartta konu olarak kalır
  assert.deepEqual(a.people.map((p) => [p.slug, p.via]), [['p1', 'department'], ['p3', 'department'], ['p2', 'department'], ['p4', 'department']]);
  assert.deepEqual(a.people[3].topics.map((x) => x.id), ['s2']);
  assert.deepEqual(b.people, []);
  // bölüm bağı profil hizmet listesini ve sektör türetmesini genişletmez
  assert.deepEqual(t.bySlug.p1.svcGroups, []);
  assert.deepEqual(ctx.sectors[0].people.map((p) => p.slug), ['p4', 'p5']);
  // bölüm kaydı bağlı alanları taşır (Ekibimiz'de bölüm başlığının altında bağlantı)
  assert.deepEqual(t.departments.map((d) => [d.id, d.areas.map((g) => g.id)]), [['d1', ['a']], ['d2', ['a']], ['d3', []]]);
  // bilinmeyen alan kimliği hata listesine yazılır ve bağlanmaz
  const bad = buildTeam({ departments: [{ id: 'd', name: 'D', areas: ['yok'] }], members: [person('k', { department: 'd' })] }, mk());
  assert.ok(bad.issues.join('\n').includes('bölüm «d»: bilinmeyen hizmet alanı «yok»'), bad.issues.join('\n'));
  assert.deepEqual(bad.bySlug.k.deptAreaIds, []);
});

test('doğrulama notu ve kaynak üst veridir: kişi kaydına geçmez, yalnızca verifyNotes listesine yazılır', () => {
  const t = buildTeam({ members: [person('a', { needsVerification: true, verifyNote: 'Soyadı doğrulanmalı', source: 'Şema' }), person('b')] }, mk());
  assert.deepEqual(t.verifyNotes, [{ slug: 'a', note: 'Soyadı doğrulanmalı' }]);
  assert.deepEqual(t.unverified, ['a']);
  assert.ok(!('verifyNote' in t.bySlug.a) && !('source' in t.bySlug.a));
  assert.ok(!JSON.stringify(t.members).includes('Soyadı doğrulanmalı'));
});

// ——— Gerçek veri: src/data/team.json + hizmetler + sektörler
const data = loadData();
const model = buildModel(data);
const team = model.team;

test('gerçek veri: team.json hatasız ve en az bir kişi içerir', () => {
  assert.ok(team, 'model.team yok');
  assert.deepEqual(team.issues, []);
  assert.ok(team.members.length >= 1);
});

test('gerçek veri: adresler ve slug\'lar tektir; profil adresi /hakkimizda/ekibimiz/<slug>/, profilsiz kişinin adresi #<slug>', () => {
  const urls = team.members.map((m) => m.url);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(new Set(team.members.map((m) => m.slug)).size, team.members.length);
  for (const m of team.members) assert.equal(m.url, m.profile ? `/hakkimizda/ekibimiz/${m.slug}/` : `/hakkimizda/ekibimiz/#${m.slug}`);
  assert.ok(team.members[0].profile, 'ilk kişinin profil sayfası olmalı (testler/e2e ilk kişiye gider)');
});

test('gerçek veri: kadro bölümlere göre; her kişi bir bölümde; profili olmayan kişiye özgeçmiş uydurulmaz', () => {
  assert.ok(team.departments.length >= 2);
  const inDept = team.departments.flatMap((d) => d.members.map((m) => m.slug));
  assert.deepEqual([...inDept].sort(), team.members.map((m) => m.slug).sort(), 'her kişi tam bir bölümde olmalı');
  for (const d of team.departments) {
    assert.ok(d.name && d.members.length, `${d.id}: ad ve en az bir kişi`);
    for (const m of d.members) assert.equal(m.departmentName, d.name);
  }
  assert.deepEqual(team.profiles.map((m) => m.slug), team.members.filter((m) => m.profile).map((m) => m.slug));
  for (const m of team.members) {
    if (m.profile) assert.ok(m.summary && m.bio.length, `${m.slug}: profil sayfası için özet ve özgeçmiş gerekir`);
    else assert.ok(!m.summary && !m.bio.length && !m.education.length && !m.expertise.length, `${m.slug}: profili olmayan kişiye özgeçmiş bilgisi eklenmemeli`);
  }
});

test('gerçek veri: ayrılan çalışan listede yok; çalışan kimlik numaraları (BRD-…) hiçbir kayıtta yok', () => {
  assert.ok(!team.bySlug['aysenur-kansiz'], 'Ayşenur Kansız ayrıldı; ekipte olmamalı');
  assert.ok(!/BRD-[A-Z]{2}-\d{3,}/.test(JSON.stringify(team)), 'sicil/kimlik numaraları yayımlanmaz');
});

test('gerçek veri: portre fotoğrafı yalnızca person: true kareler; her portre bir kişiye bağlı', () => {
  const personKeys = Object.entries(data.photos).filter(([, v]) => v && typeof v === 'object' && v.person).map(([k]) => k);
  const used = team.members.map((m) => m.photoKey).filter(Boolean);
  for (const k of used) assert.ok(personKeys.includes(k), `${k} person: true olmalı`);
  assert.equal(new Set(used).size, used.length, 'aynı portre iki kişiye bağlanmamış olmalı');
  for (const k of personKeys) assert.ok(used.includes(k), `${k} portresi hiçbir kişiye bağlı değil`);
});

test('gerçek veri: her sektörde en az bir ilgili kişi var; kimsesiz hizmet sayfaları kart çizmez', () => {
  for (const s of model.sectors) assert.ok(s.people.length >= 1, `${s.slug}: ilgili kişi yok`);
  for (const g of model.groups) for (const p of g.people) assert.ok(['area', 'service', 'department'].includes(p.via));
  for (const s of model.services) assert.ok(s.people.length <= 3, `${s.id}: en çok 3 kişi`);
});

test('gerçek veri: her hizmet alanında 1–4 kişi; bölüm bağı şemadaki bölümden gelir; profil sayfası genişlemez', () => {
  for (const g of model.groups) assert.ok(g.people.length >= 1 && g.people.length <= 4, `${g.id}: alan ekibi 1–4 kişi olmalı (${g.people.length})`);
  const deptAreas = Object.fromEntries(team.departments.map((d) => [d.id, d.areas.map((x) => x.id)]));
  for (const g of model.groups) {
    for (const p of g.people.filter((x) => x.via === 'department')) assert.ok(deptAreas[p.department].includes(g.id), `${p.slug} → ${g.id}: bölüm bu alana bağlı değil`);
  }
  // Muhasebe, Bordro ve Finansal Raporlama: bordro/SGK hizmetleri İş ve Sosyal Güvenlik bölümünden kişilerle görünür
  const muhasebe = model.groups.find((g) => g.id === 'muhasebe');
  assert.ok(muhasebe.people.some((p) => p.department === 'is-ve-sosyal-guvenlik'), 'Muhasebe/Bordro alanında İş ve Sosyal Güvenlik bölümünden kişi olmalı');
  // Teşvik birimi: Umut Kutlu bu alanda (proje sahibinin isteği, Ekim 2026)
  const tesvik = model.groups.find((g) => g.id === 'tesvik');
  assert.ok(tesvik.people.some((p) => p.slug === 'umut-kutlu' && p.department === 'tesvik'), 'Teşvik alanında Umut Kutlu olmalı');
  for (const m of team.profiles) {
    for (const sg of m.svcGroups) for (const s of sg.items) assert.ok(m.svcIds.includes(s.id) || m.areaIds.includes(sg.group.id), `${m.slug}: ${s.id} kişinin kendi ataması değil`);
  }
});

test('gerçek veri: gizli iletişim bilgisi ve kişisel e-posta metinlere sızmamış', () => {
  for (const m of team.members) {
    if (!m.showContact) assert.equal(m.contact, null, `${m.slug}: showContact=false iken contact boş olmalı`);
    const prose = [m.summary, ...(m.bio || []), ...(m.expertise || []), ...(m.titles || [])].join(' ');
    assert.ok(!/@/.test(prose), `${m.slug}: özgeçmiş metninde e-posta adresi var`);
    assert.ok(!/\+?\d[\d\s()-]{8,}\d/.test(prose), `${m.slug}: özgeçmiş metninde telefon numarası var`);
  }
});

test('gerçek veri: yayından önce doğrulanacak kişiler işaretli (needsVerification)', () => {
  // Bu test bilgilendiricidir: doğrulanan kişiler bayrağı kaldırınca listeden düşer; bayrak varken kişi sayfada yayınlanır.
  assert.ok(Array.isArray(team.unverified));
});
