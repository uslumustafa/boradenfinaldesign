// İletişim bilgileri: İletişim › «Doğrudan iletişim» kanalları (contactpage.json › channels) ve sitenin geri kalanındaki genel
// iletişim bilgileri (content.json › contact: alt bilgi, kapanış bandı, mobil menü, SSS, İletişim › Ofis, formların alıcısı, JSON-LD).
// Ekim 2026 (müşteri): kesin bilgiler gelene kadar hepsi boş; iletişim bilgileri kişiye özel doldurulacak (team.json › contact).
// Boş alan hiçbir yerde çizilmez (bağlantı, etiket, ayraç ya da yapılandırılmış veri olarak); değer girilince kendiliğinden görünür.
// Metinlerdeki adres/e-posta/telefon geçişleri görünür yer tutucudur: [[E-posta adresi]], [[Telefon numarası]], [[WhatsApp numarası]], [[Adres]].
//   node --test tests/contact-channels.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import nunjucks from 'nunjucks';
import { loadData, ROOT, templateGlobals } from '../scripts/build.mjs';
import { buildModel } from '../scripts/model.mjs';
import { buildRoutes } from '../scripts/routes.mjs';
import { makeFilters } from '../scripts/filters.mjs';

// Sayfaları (isteğe bağlı veri değişikliğiyle) çizer: { url → html }
function site(mutate) {
  const data = loadData();
  if (mutate) mutate(data);
  const model = buildModel(data);
  const routes = buildRoutes(data, model, { onError: (m) => assert.fail(m) });
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(ROOT, 'src/templates')), { autoescape: true, trimBlocks: true, lstripBlocks: true });
  for (const [k, fn] of Object.entries(makeFilters())) env.addFilter(k, fn);
  for (const [k, v] of Object.entries(templateGlobals(data, model))) env.addGlobal(k, v);
  const render = (url) => {
    const r = routes.find((x) => x.url === url && x.template);
    assert.ok(r, `${url} rotası yok`);
    return env.render(r.template, { page: { url: r.url, title: r.title, crumbs: r.crumbs || [], scene: r.scene }, ...(r.ctx || {}) });
  };
  return { data, model, routes, render };
}
const between = (html, start, end) => {
  const a = html.indexOf(start);
  assert.ok(a >= 0, `«${start}» bulunamadı`);
  return html.slice(a, html.indexOf(end, a) + end.length);
};
const channelsOf = (html) => {
  const list = between(html, 'class="ct-channels"', '</ul>');
  return { list, items: list.split('<li').slice(1) };
};
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph'] || []);

// Örnek değerler (gerçek bilgi değildir; yalnızca «doldurulunca görünür» denetimi için)
const SAMPLE = { email: 'iletisim@ornek.com.tr', phone: '+90 (212) 000 00 00', phoneHref: '+902120000000', whatsapp: '905000000000', street: 'Örnek Sokak No: 1', postcode: '34000', district: 'Örnekköy', city: 'İstanbul', country: 'Türkiye' };

test('kanallar şimdilik boş: dört satır etiketiyle çizilir, değer ve bağlantı yoktur', () => {
  const { render, model } = site();
  const { list, items } = channelsOf(render('/iletisim/'));
  assert.equal(items.length, 4, 'e-posta, telefon, WhatsApp, adres');
  for (const label of ['E-posta', 'Telefon', 'WhatsApp', 'Adres']) assert.ok(list.includes(`<span class="ct-channel__k mono">${label}</span>`), `«${label}» etiketi`);
  assert.equal((list.match(/class="ct-channel ct-channel--empty"/g) || []).length, 4, 'dört satır da boş durumda');
  assert.doesNotMatch(list, /<a\s/, 'boş satır bağlantı değildir');
  assert.doesNotMatch(list, /mailto:|tel:|wa\.me|google\.com\/maps/, 'bağlantı adresi yok');
  const c = model.contact;
  for (const v of [c.email, c.phone, c.district].filter(Boolean)) assert.ok(!list.includes(v), `«${v}» kanal listesinde görünmemeli`);
  assert.equal((list.match(/<span class="ct-channel__v" aria-hidden="true"><\/span>/g) || []).length, 4, 'değer alanları boş');
});

test('değer girilince satır bağlantı olur; adres satırı haritaya bağlanır (ofis adresi boşsa satırın kendi metniyle)', () => {
  const fill = (data) => {
    const by = Object.fromEntries(data.contactpage.channels.map((ch) => [ch.id, ch]));
    Object.assign(by.email, { value: SAMPLE.email, href: `mailto:${SAMPLE.email}` });
    Object.assign(by.phone, { value: SAMPLE.phone, href: `tel:${SAMPLE.phoneHref}` });
    Object.assign(by.whatsapp, { value: '+90 500 000 00 00', href: `https://wa.me/${SAMPLE.whatsapp}` });
    Object.assign(by.address, { value: 'Örnekköy / İstanbul', href: '' });
  };
  const { list, items } = channelsOf(site(fill).render('/iletisim/'));
  assert.equal(items.length, 4);
  assert.doesNotMatch(list, /ct-channel--empty/, 'dolu satır boş durumda çizilmez');
  assert.match(items[0], /<a class="ct-channel" href="mailto:iletisim@ornek\.com\.tr">/);
  assert.match(items[1], /<a class="ct-channel" href="tel:\+902120000000">/);
  assert.match(items[2], /<a class="ct-channel" href="https:\/\/wa\.me\/905000000000" target="_blank" rel="noopener noreferrer">/);
  assert.match(items[3], /Adres · haritada aç/);
  assert.match(items[3], /Örnekköy \/ İstanbul/);
  assert.match(items[0], /iletisim@ornek\.com\.tr<\/span>/);
  // ofis adresi boş: harita araması satırın kendi metniyle yapılır (anlamsız «/, Türkiye» araması üretilmez)
  const q = (s) => decodeURIComponent((s.match(/maps\/search\/\?api=1&amp;query=([^"]+)"/) || [])[1] || '');
  assert.equal(q(items[3]), 'Örnekköy / İstanbul');
  // ofis adresi doluysa bağlantı tam ofis adresine gider
  const both = channelsOf(
    site((data) => {
      fill(data);
      Object.assign(data.content.contact, SAMPLE);
    }).render('/iletisim/')
  );
  assert.equal(q(both.items[3]), 'Örnek Sokak No: 1, 34000 Örnekköy / İstanbul, Türkiye');
});

test('genel iletişim bilgileri boş: alt bilgi, kapanış bandı, mobil menü, SSS, Ofis, form ve JSON-LD bilgi göstermez', () => {
  const { render, model } = site();
  assert.deepEqual(
    Object.fromEntries(Object.entries(model.contact).filter(([k]) => !['country', 'hasAddress'].includes(k))),
    { email: '', phone: '', phoneHref: '', whatsapp: '', street: '', postcode: '', district: '', city: '', place: '', line2: '', full: '' },
    'content.json › contact boş'
  );
  for (const url of ['/', '/hizmetler/', '/hakkimizda/', '/bilgi-merkezi/sss/', '/iletisim/', '/kariyer/']) {
    const html = render(url);
    assert.doesNotMatch(html, /href="tel:|wa\.me\//, `${url}: telefon/WhatsApp bağlantısı yok`);
    // mailto: yalnızca form taslağı (alıcısız) — sayfada görünen bir e-posta bağlantısı yok
    assert.deepEqual([...html.matchAll(/href="mailto:([^"]*)"/g)].map((m) => m[1]), url === '/iletisim/' || url === '/kariyer/' ? [''] : [], `${url}: görünen e-posta bağlantısı yok`);
    assert.doesNotMatch(html, /class="ftr__addr"/, `${url}: alt bilgide adres bloğu çizilmez`);
    assert.doesNotMatch(html, /class="cta__side"/, `${url}: kapanış bandında iletişim sütunu çizilmez`);
    assert.doesNotMatch(html, / ·\s*<\/address>|<dt>(Adres|E-posta|Telefon)<\/dt>\s*<dd>\s*<\/dd>/, `${url}: boş etiket ya da ayraç kalmaz`);
    const org = ldOf(html).find((n) => n['@type'] === 'Organization' && n['@id']);
    if (org) assert.ok(!org.address && !org.email && !org.telephone && !org.contactPoint, `${url}: JSON-LD kuruluşunda boş iletişim alanı yok`);
  }
  // İletişim › Ofis: yalnızca unvan; «Haritada aç» yok; form alıcısız mailto
  const ct = render('/iletisim/');
  const office = between(ct, '<address class="ct-office__addr">', '</address>');
  assert.doesNotMatch(office, /<br>/, 'Ofis kutusunda adres satırı yok');
  assert.doesNotMatch(ct, /Haritada aç/);
  assert.match(ct, /<form class="ct-form ct-form--card" id="ct-form" action="mailto:" /);
  assert.match(ct, /data-mail-to="" /);
  // SSS: metindeki iletişim bilgileri görünür yer tutucu; bu sorular yapılandırılmış veriye girmez
  const faq = render('/bilgi-merkezi/sss/');
  for (const t of ['E-posta adresi', 'Telefon numarası', 'WhatsApp numarası', 'Adres']) assert.ok(faq.includes(`<mark class="ph">${t}</mark>`), `SSS: «${t}» yer tutucusu`);
  const qa = ldOf(faq).find((n) => n['@type'] === 'FAQPage');
  assert.ok(qa && qa.mainEntity.length > 0, 'SSS JSON-LD var');
  const names = qa.mainEntity.map((q) => q.name);
  assert.ok(!names.includes('Boraden’e nasıl ulaşabilirim?') && !names.includes('Boraden’in adresi nedir?'), 'yer tutuculu sorular JSON-LD’de yok');
  assert.ok(!JSON.stringify(qa).includes('[E-posta adresi]'), 'JSON-LD’de yer tutucu metni yok');
});

test('genel iletişim bilgileri girilince her yerde kendiliğinden görünür', () => {
  const { render } = site((data) => Object.assign(data.content.contact, SAMPLE));
  const home = render('/');
  const addr = between(home, '<address class="ftr__addr">', '</address>');
  assert.match(addr, /Örnek Sokak No: 1/);
  assert.match(addr, /href="tel:\+902120000000"/);
  assert.match(addr, /href="mailto:iletisim@ornek\.com\.tr"/);
  assert.match(addr, /<\/a> ·/, 'telefon ve e-posta arasında ayraç');
  const side = between(home, 'class="cta__side"', '</dl>');
  for (const k of ['Adres', 'E-posta', 'Telefon']) assert.match(side, new RegExp(`<dt>${k}</dt>`));
  const ct = render('/iletisim/');
  const office = between(ct, '<address class="ct-office__addr">', '</address>');
  assert.match(office, /Örnek Sokak No: 1<br>\s*34000 Örnekköy \/ İstanbul/);
  assert.match(ct, /Haritada aç/);
  assert.match(ct, /action="mailto:iletisim@ornek\.com\.tr"/);
  const org = ldOf(ct).find((n) => n['@type'] === 'Organization' && n['@id']);
  assert.equal(org.email, SAMPLE.email);
  assert.equal(org.telephone, SAMPLE.phoneHref);
  assert.equal(org.address.streetAddress, SAMPLE.street);
  assert.equal(org.contactPoint[0].email, SAMPLE.email);
  assert.match(render('/bilgi-merkezi/sss/'), /class="btn btn--ghost" href="tel:\+902120000000"/, 'SSS yardım kutusunda telefon düğmesi');
});
