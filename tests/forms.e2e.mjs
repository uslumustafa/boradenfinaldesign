// Form uçtan uca denetimi (iletişim + kariyer; gerçek Chrome, Playwright) — çalışan bir sunucu gerekir (npm run dev).
//   node tests/forms.e2e.mjs [--base=http://127.0.0.1:4181] [--only=contact|careers|mailto|layout|nojs]
// Denetlenenler: doğrulama (satır içi hata, aria-invalid, ilk hatalı alana odak, özet), ?hizmet= / ?konu= ön seçimi ve çip,
// ?kisi= / ?sektor= bağlam çipleri (kişi kartı + sektör sayfası → form; e-posta gövdesi; çip kaldırma; geçersiz değer),
// mailto taslağı (konu/gövde/kısaltma), ağ isteği olmaması, kariyer alan seçimi + dosya denetimi, yatay taşma, konsol.
// E-POSTA GÜVENLİĞİ: gerçek Chrome, mailto: gezinmesini işletim sistemine (Mail.app) devreder; hiçbir koşu e-posta uygulamasını açmamalıdır.
//   (1) uygulama, otomasyonda (navigator.webdriver) openMail'i atlar; (2) tüm bağlamlar guardContext ile sarılıdır: mailto: gezinmesi
//   iptal edilip kaydedilir; (3) «mailto» bölümü ziyaretçi yolunu (webdriver=false) bu güvenlik ağı altında dener.
import { chromium } from 'playwright-core';
import { guardContext, actHuman } from './safe-context.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://127.0.0.1:4181');
const ONLY = arg('only', '');
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) fails++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3-'));

async function newPage(opts = {}) {
  const ctx = await guardContext(await browser.newContext({ viewport: { width: opts.w || 1440, height: opts.h || 900 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, javaScriptEnabled: opts.js !== false }));
  if (opts.human) await actHuman(ctx);
  await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), opts.fx || 'off');
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
  });
  return { ctx, page, logs };
}
const decodeMailto = (href) => {
  const u = new URL(href);
  // mailto satır sonları %0D%0A → karşılaştırma için \n
  return { to: u.pathname, subject: u.searchParams.get('subject') || '', body: (u.searchParams.get('body') || '').replace(/\r\n/g, '\n') };
};
// otomasyonda (navigator.webdriver=true) geçerli gönderim e-posta uygulamasını AÇMAZ: mailto: gezinmesi hiç denenmemiş olmalı
const noMail = async (page, where) => {
  const r = await page.evaluate(() => ({ wd: navigator.webdriver, net: !!window.navigation, tried: window.__blockedExternal || [] }));
  ok(r.wd === true && r.net && r.tried.length === 0, `${where}: otomasyonda e-posta uygulaması açılmaz (webdriver=${r.wd}, güvenlik ağı=${r.net ? 'var' : 'YOK'}, denenen mailto: ${r.tried.length})`);
};

/* ─── İletişim formu ─── */
async function contact() {
  console.log('İletişim formu');
  const { ctx, page, logs } = await newPage();
  await page.goto(`${BASE}/iletisim/?hizmet=kdv-iade-islemleri`, { waitUntil: 'load' });
  await page.waitForSelector('[data-ct-svc]:not([hidden])', { timeout: 5000 });
  ok((await page.textContent('[data-ct-svc-name]')) === 'KDV İade İşlemleri', '?hizmet= → «Seçilen hizmet» çipi');
  ok((await page.inputValue('#ct-f-konu')) === 'vergi-ve-mali-musavirlik', '?hizmet= → konu: vergi ve mali müşavirlik');
  ok(await page.isVisible('#ct-f-konu-d'), 'konu açıklaması görünür');
  ok((await page.getAttribute('#ct-f-konu', 'aria-describedby')).includes('ct-f-konu-d'), 'konu açıklaması aria-describedby ile bağlı');

  // ağ isteklerini bundan sonra say
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));

  // boş gönderim
  await page.click('.ct-submit');
  const invalid = await page.$$eval('#ct-form .ct-field.is-invalid', (els) => els.map((e) => e.dataset.field));
  ok(JSON.stringify(invalid) === JSON.stringify(['ad', 'eposta', 'mesaj', 'kvkk-onay']), `boş gönderimde hatalı alanlar: ${invalid.join(', ')}`);
  ok((await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'ct-f-ad', 'odak ilk hatalı alanda (ad)');
  ok((await page.getAttribute('#ct-f-ad', 'aria-invalid')) === 'true', 'aria-invalid=true');
  ok(((await page.textContent('#ct-f-ad-e')) || '').length > 5 && (await page.isVisible('#ct-f-ad-e')), 'satır içi hata metni görünür');
  ok(((await page.textContent('[data-fk-status]')) || '').includes('Düzeltilmesi gereken alan sayısı: 4'), 'form özeti (role=alert) dolu');

  // geçersiz e-posta ve kısa mesaj
  await page.fill('#ct-f-ad', 'Ayşe Yılmaz');
  await page.fill('#ct-f-eposta', 'ayse@ornek');
  await page.fill('#ct-f-mesaj', 'Kısa mesaj');
  await page.click('.ct-submit');
  ok(((await page.textContent('#ct-f-eposta-e')) || '').includes('Geçerli bir e-posta'), 'geçersiz e-posta hatası');
  ok(((await page.textContent('#ct-f-mesaj-e')) || '').includes('En az 20 karakter'), 'mesaj ≥ 20 karakter hatası');
  ok(!(await page.$eval('[data-field="ad"]', (e) => e.classList.contains('is-invalid'))), 'düzeltilen alanın hatası kalktı');
  await page.fill('#ct-f-telefon', 'abc');
  await page.locator('#ct-f-telefon').blur();
  ok(((await page.textContent('#ct-f-telefon-e')) || '').includes('telefon'), 'geçersiz telefon (alandan çıkınca)');
  await page.fill('#ct-f-telefon', '+90 212 000 00 00');
  await page.locator('#ct-f-telefon').blur();
  ok(!(await page.isVisible('#ct-f-telefon-e')), 'telefon düzeltildi');

  // geçerli gönderim
  await page.fill('#ct-f-eposta', 'ayse@ornek.com.tr');
  await page.fill('#ct-f-sirket', 'Örnek A.Ş.');
  await page.fill('#ct-f-mesaj', 'KDV iade sürecimiz hakkında bilgi almak istiyoruz. Uygun bir zamanda dönüş rica ederiz.');
  await page.check('#ct-f-kvkk-onay');
  await page.click('.ct-submit');
  await page.waitForSelector('[data-fk-done]:not([hidden])', { timeout: 5000 });
  ok(await page.isHidden('#ct-form'), 'geçerli gönderimde form gizlendi, panel açıldı');
  ok((await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-fk-done]'))), 'odak «taslak hazır» panelinde');
  const href = await page.getAttribute('[data-fk-mailto]', 'href');
  const m = decodeMailto(href);
  ok(m.to === 'info@boraden.com.tr', 'mailto alıcısı');
  ok(m.subject === '[Web sitesi] Vergi denetim ve danışmanlık — Ayşe Yılmaz', `konu satırı: ${m.subject}`);
  ok(m.body.includes('İlgili hizmet: KDV İade İşlemleri') && m.body.includes('Şirket veya kurum: Örnek A.Ş.') && m.body.includes('Mesajınız:\nKDV iade'), 'gövde: alanlar + ilgili hizmet + mesaj');
  ok(href.includes('%0D%0A'), 'satır sonları %0D%0A');
  const wa = await page.getAttribute('[data-fk-wa]', 'href');
  ok(wa.startsWith('https://wa.me/905532380335?text='), 'WhatsApp bağlantısı');
  ok(!/gönderildi/i.test(await page.textContent('[data-fk-done]')), '«gönderildi» denmiyor');
  const net = reqs.filter((u) => !u.startsWith('mailto:') && !u.startsWith('data:'));
  ok(net.length === 0, `gönderimde ağ isteği yok (${net.length})`);
  await noMail(page, 'iletişim');

  // kopyala, düzenle, sıfırla
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.click('[data-fk-copy]');
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.startsWith('Alıcı: info@boraden.com.tr\nKonu: [Web sitesi]'), 'Mesajı kopyala → panoda tam metin');
  await page.click('[data-fk-edit]');
  ok((await page.isVisible('#ct-form')) && (await page.inputValue('#ct-f-ad')) === 'Ayşe Yılmaz', 'Forma dön: veriler korunuyor');
  await page.click('.ct-submit');
  await page.waitForSelector('[data-fk-done]:not([hidden])');
  await page.click('[data-fk-reset]');
  await page.waitForTimeout(100);
  ok((await page.inputValue('#ct-f-ad')) === '' && (await page.inputValue('#ct-f-konu')) === 'vergi-ve-mali-musavirlik', 'Formu sıfırla: alanlar boş, ön seçim yeniden uygulandı');

  // çipi kaldır
  await page.click('[data-ct-svc-x]');
  ok((await page.isHidden('[data-ct-svc]')) && !page.url().includes('hizmet='), 'çip kaldırıldı, ?hizmet= adresten silindi');

  // uzun mesaj → kısaltma
  await page.fill('#ct-f-ad', 'Ali Veli');
  await page.fill('#ct-f-eposta', 'ali@ornek.com');
  await page.fill('#ct-f-mesaj', ('Uzun mesaj denemesi çğıöşü İĞÜŞÖÇ 🙂 '.repeat(120)).trim());
  await page.check('#ct-f-kvkk-onay');
  await page.click('.ct-submit');
  await page.waitForSelector('[data-fk-done]:not([hidden])');
  const m2 = decodeMailto(await page.getAttribute('[data-fk-mailto]', 'href'));
  ok(m2.body.length <= 1800 && m2.body.includes('kısaltıldı'), `uzun mesaj ≤ 1800 karaktere kısaltıldı (${m2.body.length})`);
  ok(!/[\uD800-\uDBFF]$/.test(m2.body.split('…')[0]), 'kısaltma vekil çifti bölmüyor');
  ok(await page.isVisible('[data-fk-cut]'), 'kısaltma notu görünür');
  await noMail(page, 'iletişim (uzun mesaj)');

  // ?konu=
  await page.goto(`${BASE}/iletisim/?konu=kariyer`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#ct-f-konu').value === 'kariyer', null, { timeout: 5000 }).catch(() => {});
  ok((await page.inputValue('#ct-f-konu')) === 'kariyer', '?konu=kariyer → konu seçildi');
  ok(await page.isHidden('[data-ct-svc]'), '?konu= tek başına çip göstermez');

  // KVKK bağlantısı yeni sekmede (form verisi kaybolmasın)
  ok((await page.getAttribute('.ct-consent a', 'target')) === '_blank', 'onay metnindeki bağlantı yeni sekmede');

  // yönlendirici (fetch-and-swap) ile hizmet sayfasından geçiş: «Görüşme talep edin»
  await page.goto(`${BASE}/hizmetler/vergi/kdv-iade-islemleri/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('a.toc__cta');
  await page.waitForFunction(() => location.pathname === '/iletisim/' && document.querySelector('[data-ct-svc]') && !document.querySelector('[data-ct-svc]').hidden, null, { timeout: 6000 }).catch(() => {});
  ok(page.url().includes('/iletisim/?hizmet=kdv-iade-islemleri'), 'yönlendirici ile /iletisim/?hizmet= adresine geçildi');
  ok((await page.textContent('[data-ct-svc-name]')) === 'KDV İade İşlemleri' && (await page.inputValue('#ct-f-konu')) === 'vergi-ve-mali-musavirlik', 'sayfa değişiminden sonra da ön seçim + çip');
  // Kaydırma «smooth» ve eşzamansız: anında okumak yarışa girer; en çok 3 sn beklenir.
  await page.waitForFunction(() => scrollY > 300, null, { timeout: 3000 }).catch(() => {});
  ok((await page.evaluate(() => scrollY)) > 300, 'ön seçimle gelince forma kaydırıldı');

  // ?kisi= / ?sektor= : kişi kartı ve sektör sayfasından gelen bağlam çipleri (kişiye özel adres YOK: alıcı hep şirketin tek adresi)
  {
    const { ctx: c2, page: p2, logs: l2 } = await newPage();
    await p2.goto(`${BASE}/iletisim/?kisi=adem-baser&sektor=saglik-ve-ilac`, { waitUntil: 'load' });
    await p2.waitForSelector('[data-ct-person]:not([hidden])', { timeout: 5000 });
    ok((await p2.textContent('[data-ct-person] [data-ct-name]')).startsWith('Adem Başer'), '?kisi= → «Görüşmek istediğiniz kişi» çipi (ad + unvan)');
    ok((await p2.textContent('[data-ct-sector] [data-ct-name]')) === 'Sağlık ve İlaç', '?sektor= → «Seçilen sektör» çipi');
    ok(await p2.isHidden('[data-ct-svc]'), 'kişi/sektör çipleri hizmet çipini açmaz');

    // sayfa yüklendikten sonraki ağ istekleri sayılır
    const reqs2 = [];
    p2.on('request', (r) => reqs2.push(r.url()));
    // geçerli gönderim: gövdede iki satır, alıcı değişmez, kişisel e-posta adresi geçmez
    const topic = await p2.$eval('#ct-f-konu', (sel) => [...sel.options].find((o) => o.value)?.value);
    await p2.selectOption('#ct-f-konu', topic);
    await p2.fill('#ct-f-ad', 'Ayşe Yılmaz');
    await p2.fill('#ct-f-eposta', 'ayse@ornek.com.tr');
    await p2.fill('#ct-f-mesaj', 'Sağlık alanındaki denetim sürecimiz hakkında görüşmek istiyoruz. Uygun bir zamanda dönüş rica ederiz.');
    await p2.check('#ct-f-kvkk-onay');
    await p2.click('.ct-submit');
    await p2.waitForSelector('[data-fk-done]:not([hidden])', { timeout: 5000 });
    const km = decodeMailto(await p2.getAttribute('[data-fk-mailto]', 'href'));
    ok(km.to === 'info@boraden.com.tr', 'kişi/sektör bağlamında alıcı yine şirketin tek adresi');
    // görev veriden okunur (ekip şeması değişince test kırılmasın): «Ad (görev)»
    const adem = JSON.parse(fs.readFileSync(new URL('../src/data/team.json', import.meta.url), 'utf8')).members.find((m) => m.slug === 'adem-baser');
    ok(km.body.includes(`Görüşmek istenen kişi: ${adem.name} (${adem.role})`), `gövde: «Görüşmek istenen kişi» satırı (ad + unvan: ${adem.role})`);
    ok(km.body.includes('İlgili sektör: Sağlık ve İlaç'), 'gövde: «İlgili sektör» satırı');
    const others = (km.body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).filter((a) => a !== 'ayse@ornek.com.tr');
    ok(others.length === 0, `gövdede başka e-posta adresi yok (${others.join(', ') || '—'})`);
    ok(reqs2.filter((u) => !u.startsWith('mailto:') && !u.startsWith('data:')).length === 0, 'kişi/sektör gönderiminde ağ isteği yok');
    await noMail(p2, 'iletişim (kişi/sektör)');

    // formu sıfırla: çipler adresten yeniden uygulanır; sonra tek tek kaldırılır
    await p2.click('[data-fk-reset]');
    await p2.waitForTimeout(150);
    ok((await p2.isVisible('[data-ct-person]')) && (await p2.isVisible('[data-ct-sector]')), 'Formu sıfırla: kişi + sektör çipleri yeniden uygulandı');
    await p2.click('[data-ct-person] [data-ct-x]');
    ok((await p2.isHidden('[data-ct-person]')) && !p2.url().includes('kisi=') && p2.url().includes('sektor=saglik-ve-ilac'), 'kişi çipi kaldırıldı: ?kisi= adresten silindi, sektör kaldı');
    await p2.click('[data-ct-sector] [data-ct-x]');
    ok((await p2.isHidden('[data-ct-sector]')) && !/[?&](kisi|sektor)=/.test(p2.url()), 'sektör çipi kaldırıldı: adres temiz');

    // geçersiz / sahte değerler çip açmaz (Object.prototype anahtarları dahil)
    for (const bad of ['yok-boyle-biri', 'constructor', '__proto__']) {
      await p2.goto(`${BASE}/iletisim/?kisi=${bad}&sektor=${bad}`, { waitUntil: 'load' });
      await p2.waitForFunction(() => document.querySelector('#ct-form')?.noValidate, null, { timeout: 5000 });
      ok((await p2.isHidden('[data-ct-person]')) && (await p2.isHidden('[data-ct-sector]')), `geçersiz ?kisi=/?sektor= (${bad}) çip göstermez`);
    }

    // sektör sayfası → yönlendirici ile forma: «Görüşme talep edin»
    await p2.goto(`${BASE}/sektorler/saglik-ve-ilac/`, { waitUntil: 'load' });
    await p2.waitForTimeout(400);
    await p2.click('a.toc__cta');
    await p2.waitForFunction(() => location.pathname === '/iletisim/' && document.querySelector('[data-ct-sector]') && !document.querySelector('[data-ct-sector]').hidden, null, { timeout: 6000 }).catch(() => {});
    ok(p2.url().includes('/iletisim/?sektor=saglik-ve-ilac') && (await p2.textContent('[data-ct-sector] [data-ct-name]')) === 'Sağlık ve İlaç' && (await p2.isHidden('[data-ct-person]')), 'sektör sayfasından yönlendirici ile geçiş: yalnızca sektör çipi');

    // sektör sayfasının altındaki kişi kartı → forma: kişi + sektör birlikte
    await p2.goto(`${BASE}/sektorler/saglik-ve-ilac/`, { waitUntil: 'load' });
    await p2.waitForTimeout(400);
    const card = p2.locator('#ekip .pp').first();
    ok((await card.count()) === 1, 'sektör sayfasının altında «ilgili ekip» kartları var');
    const who = ((await card.locator('.pp__name').textContent()) || '').trim();
    await card.locator('a.btn').scrollIntoViewIfNeeded();
    await card.locator('a.btn').click();
    await p2.waitForFunction(() => location.pathname === '/iletisim/' && document.querySelector('[data-ct-person]') && !document.querySelector('[data-ct-person]').hidden, null, { timeout: 6000 }).catch(() => {});
    ok(who.length > 3 && (await p2.textContent('[data-ct-person] [data-ct-name]')).startsWith(who) && (await p2.isVisible('[data-ct-sector]')), `kişi kartından forma: «${who}» + sektör çipleri birlikte`);

    // profil sayfası → forma: yalnızca kişi
    await p2.goto(`${BASE}/hakkimizda/ekibimiz/adem-baser/`, { waitUntil: 'load' });
    await p2.waitForTimeout(400);
    await p2.click('.pf-card__cta');
    await p2.waitForFunction(() => location.pathname === '/iletisim/' && document.querySelector('[data-ct-person]') && !document.querySelector('[data-ct-person]').hidden, null, { timeout: 6000 }).catch(() => {});
    ok(p2.url().includes('/iletisim/?kisi=adem-baser') && (await p2.textContent('[data-ct-person] [data-ct-name]')).startsWith('Adem Başer') && (await p2.isHidden('[data-ct-sector]')), 'profil sayfasından forma: yalnızca kişi çipi');
    ok(l2.length === 0, `kişi/sektör akışı: konsol/HTTP temiz${l2.length ? ': ' + l2.join(' | ') : ''}`);
    await c2.close();
  }
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

/* ─── Kariyer formu ─── */
async function careers() {
  console.log('Kariyer formu');
  const { ctx, page, logs } = await newPage();
  await page.goto(`${BASE}/kariyer/`, { waitUntil: 'load' });
  await page.waitForSelector('.cr-areas.is-live', { timeout: 5000 });
  // önizleme paneli: üzerine gelince etkinleşir
  await page.hover('[data-cr-area="sistem"] .cr-area__row');
  ok(await page.$eval('[data-cr-area="sistem"]', (e) => e.classList.contains('is-active')), 'alan satırı üzerine gelince etkin');
  const box = await page.$eval('[data-cr-area="sistem"] .cr-area__body', (e) => {
    const r = e.getBoundingClientRect();
    const list = e.closest('.cr-areas').getBoundingClientRect();
    return { left: r.left, right: r.right, listRight: list.right, op: getComputedStyle(e).opacity };
  });
  ok(Math.abs(box.right - box.listRight) < 2 && box.left > 700, `önizleme paneli sağda (${Math.round(box.left)}–${Math.round(box.right)})`);
  // alan seçip forma geç
  await page.click('[data-cr-area="sistem"] [data-cr-pick]');
  await page.waitForTimeout(900);
  ok((await page.inputValue('#cr-f-alan')) === 'sistem', '«Bu alan için başvurun» → alan seçildi');
  ok((await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'cr-f-ad', 'odak ilk alanda');
  ok(page.url().endsWith('#basvuru'), 'adres #basvuru');

  await page.click('#cr-form .ct-submit');
  const invalid = await page.$$eval('#cr-form .ct-field.is-invalid', (els) => els.map((e) => e.dataset.field));
  ok(JSON.stringify(invalid) === JSON.stringify(['ad', 'eposta', 'deneyim', 'kvkk-onay']), `boş gönderimde hatalı alanlar: ${invalid.join(', ')}`);

  // dosya denetimi
  const txt = path.join(tmp, 'cv.txt');
  fs.writeFileSync(txt, 'deneme');
  await page.setInputFiles('#cr-f-cv', txt);
  ok(((await page.textContent('#cr-f-cv-e')) || '').includes('PDF, DOC veya DOCX'), 'yanlış dosya türü hatası');
  const big = path.join(tmp, 'buyuk.pdf');
  fs.writeFileSync(big, Buffer.alloc(6 * 1024 * 1024, 1));
  await page.setInputFiles('#cr-f-cv', big);
  ok(((await page.textContent('#cr-f-cv-e')) || '').includes('en fazla 5 MB'), '5 MB üstü dosya hatası');
  const pdf = path.join(tmp, 'ozgecmis.pdf');
  fs.writeFileSync(pdf, Buffer.alloc(200 * 1024, 1));
  await page.setInputFiles('#cr-f-cv', pdf);
  ok(!(await page.isVisible('#cr-f-cv-e')) && ((await page.textContent('[data-fk-file]')) || '').includes('e-postaya ekleyin'), 'geçerli PDF: hata yok, «e-postaya ekleyin» notu');
  ok((await page.textContent('[data-fk-filename]')) === 'ozgecmis.pdf', 'Türkçe dosya kutusunda dosya adı');

  await page.fill('#cr-f-ad', 'Deniz Kaya');
  await page.fill('#cr-f-eposta', 'deniz@ornek.com');
  await page.fill('#cr-f-sehir', 'İstanbul');
  await page.check('input[name="deneyim"][value="1-3-yil"]', { force: true });
  await page.fill('#cr-f-on-yazi', 'Muhasebe sistemleri alanında çalışmak istiyorum.');
  await page.check('#cr-f-kvkk-onay');
  await page.click('#cr-form .ct-submit');
  await page.waitForSelector('#cr-form ~ [data-fk-done]:not([hidden])', { timeout: 5000 });
  const m = decodeMailto(await page.getAttribute('[data-fk-mailto]', 'href'));
  ok(m.subject === '[Kariyer] Dijital Dönüşüm — Deniz Kaya', `konu satırı: ${m.subject}`);
  ok(m.body.includes('Deneyim düzeyi: 1–3 yıl') && m.body.includes('ozgecmis.pdf') && m.body.includes('ek olarak eklenecek'), 'gövde: deneyim + CV yönlendirmesi');
  ok(((await page.textContent('[data-fk-done]')) || '').includes("CV'nizi e-postaya ekleyin"), 'panelde «CV\'nizi e-postaya ekleyin»');
  ok(!/gönderildi/i.test(await page.textContent('[data-fk-done]')), '«gönderildi» denmiyor');
  await noMail(page, 'kariyer');
  // ?alan= ön seçimi
  await page.goto(`${BASE}/kariyer/?alan=akademi`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#cr-f-alan').value === 'akademi', null, { timeout: 5000 }).catch(() => {});
  ok((await page.inputValue('#cr-f-alan')) === 'akademi', '?alan=akademi → alan seçildi');
  ok(logs.length === 0, `konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
  await ctx.close();
}

/* ─── Ziyaretçi yolu: geçerli gönderim mailto: taslağını AÇMAYA çalışır (navigator.webdriver=false).
       Güvenlik ağı (guardContext) gezinmeyi iptal eder → bu bölümde de e-posta uygulaması AÇILMAZ; denenen adres panelle karşılaştırılır ─── */
async function humanMail() {
  console.log('Ziyaretçi yolu: mailto: gezinmesi (güvenlik ağı iptal eder)');
  const same = async (page, tried) => {
    const href = await page.getAttribute('[data-fk-mailto]', 'href');
    const norm = await page.evaluate((u) => new URL(u).href, href);
    return tried.length === 1 && tried[0] === norm;
  };
  {
    const { ctx, page, logs } = await newPage({ human: true });
    await page.goto(`${BASE}/iletisim/?konu=kariyer`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#ct-form')?.noValidate && document.querySelector('#ct-f-konu').value === 'kariyer', null, { timeout: 5000 });
    const env = await page.evaluate(() => ({ wd: navigator.webdriver, net: !!window.navigation }));
    ok(env.wd === false && env.net, 'bağlam: ziyaretçi gibi (webdriver=false) + güvenlik ağı (Navigation API) hazır');
    await page.fill('#ct-f-ad', 'Test Kişi');
    await page.fill('#ct-f-eposta', 'test@ornek.com.tr');
    await page.fill('#ct-f-mesaj', 'Bu bir otomatik testtir: hiçbir yere gönderilmez, e-posta uygulaması açılmaz.');
    await page.check('#ct-f-kvkk-onay');
    await page.click('.ct-submit');
    await page.waitForSelector('[data-fk-done]:not([hidden])', { timeout: 5000 });
    ok(await same(page, await page.evaluate(() => window.__blockedExternal)), 'iletişim: geçerli gönderim tam 1 mailto: gezinmesi dener, adresi «taslak hazır» bağlantısıyla aynıdır');
    ok(page.url().includes('/iletisim/') && (await page.isVisible('[data-fk-done]')), 'iletişim: sayfa yerinde kalır, «taslak hazır» paneli görünür');
    ok(logs.length === 0, `iletişim: konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
    await ctx.close();
  }
  {
    const { ctx, page, logs } = await newPage({ human: true });
    await page.goto(`${BASE}/kariyer/?alan=sistem`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#cr-form')?.noValidate && document.querySelector('#cr-f-alan').value === 'sistem', null, { timeout: 5000 });
    await page.fill('#cr-f-ad', 'Test Kişi');
    await page.fill('#cr-f-eposta', 'test@ornek.com.tr');
    await page.check('input[name="deneyim"][value="1-3-yil"]', { force: true });
    await page.check('#cr-f-kvkk-onay');
    await page.click('#cr-form .ct-submit');
    await page.waitForSelector('#cr-form ~ [data-fk-done]:not([hidden])', { timeout: 5000 });
    ok(await same(page, await page.evaluate(() => window.__blockedExternal)), 'kariyer: geçerli gönderim tam 1 mailto: gezinmesi dener, adresi «taslak hazır» bağlantısıyla aynıdır');
    ok(logs.length === 0, `kariyer: konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
    await ctx.close();
  }
}

/* ─── Düzen: yatay taşma, tek h1, JSON-LD ─── */
async function layout() {
  console.log('Düzen');
  for (const vp of [{ w: 1440, h: 900 }, { w: 1024, h: 768 }, { w: 390, h: 844, mobile: true }]) {
    const { ctx, page, logs } = await newPage(vp);
    for (const p of ['/hakkimizda/', '/hakkimizda/ekibimiz/', '/hakkimizda/ekibimiz/adem-baser/', '/sektorler/saglik-ve-ilac/', '/kariyer/', '/iletisim/']) {
      await page.goto(BASE + p, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const over = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed').map((e) => e.className || e.tagName).slice(0, 5);
        const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
        return { sw: document.documentElement.scrollWidth, iw: innerWidth, h1: document.querySelectorAll('h1').length, over, types: ld.flatMap((g) => (g['@graph'] || []).map((n) => n['@type'])) };
      });
      ok(r.sw <= r.iw && r.h1 === 1, `${vp.w}px ${p}: taşma yok (${r.sw}/${r.iw}), h1=${r.h1}${r.over.length ? ' · taşan: ' + r.over.join(',') : ''} · LD: ${r.types.join(',')}`);
      if (p === '/hakkimizda/ekibimiz/adem-baser/') ok(r.types.includes('ProfilePage') && r.types.includes('Person') && r.types.includes('BreadcrumbList'), `${vp.w}px ${p}: JSON-LD ProfilePage + Person + BreadcrumbList`);
    }
    ok(logs.length === 0, `${vp.w}px konsol/HTTP temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
    await ctx.close();
  }
}

/* ─── JS kapalı: içerik görünür, form mailto ile çalışır ─── */
async function nojs() {
  console.log('JS kapalı');
  const { ctx, page } = await newPage({ js: false });
  await page.goto(`${BASE}/iletisim/`, { waitUntil: 'load' });
  const f = await page.$eval('#ct-form', (e) => ({ a: e.getAttribute('action'), m: e.getAttribute('method'), t: e.getAttribute('enctype'), req: [...e.querySelectorAll('[required]')].map((x) => x.name) }));
  ok(f.a === 'mailto:info@boraden.com.tr' && f.m === 'post' && f.t === 'text/plain', 'form action=mailto, method=post, enctype=text/plain');
  ok(['ad', 'eposta', 'konu', 'mesaj', 'kvkk-onay'].every((n) => f.req.includes(n)), `yerel doğrulama öznitelikleri: ${f.req.join(', ')}`);
  ok(await page.isVisible('.ct-channel'), 'kanallar görünür');
  await page.goto(`${BASE}/kariyer/`, { waitUntil: 'load' });
  ok((await page.isVisible('[data-cr-area="akademi"] .cr-area__d')) && (await page.isVisible('#cr-form')), 'JS yokken alan metinleri ve form görünür');
  await ctx.close();
}

/* ─── Görüntüler: hata durumu ve «taslak hazır» paneli (tests/shots/c3-state-*.jpg) ─── */
async function shots() {
  console.log('Durum görüntüleri');
  const dir = new URL('./shots/', import.meta.url).pathname;
  for (const vp of [{ w: 1440, h: 900, n: 'd' }, { w: 390, h: 844, mobile: true, n: 'm' }]) {
    const { ctx, page, logs } = await newPage({ ...vp, fx: 'lite' });
    await page.goto(`${BASE}/iletisim/?hizmet=sirket-degerlemesi`, { waitUntil: 'load' });
    await page.waitForSelector('[data-ct-svc]:not([hidden])');
    await page.fill('#ct-f-eposta', 'ayse@ornek');
    await page.click('.ct-submit');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}c3-state-${vp.n}-error.jpg`, type: 'jpeg', quality: 74 });
    await page.fill('#ct-f-ad', 'Ayşe Yılmaz');
    await page.fill('#ct-f-eposta', 'ayse@ornek.com.tr');
    await page.fill('#ct-f-mesaj', 'Şirketimizin değerlemesi için süreç hakkında bilgi almak istiyoruz.');
    await page.check('#ct-f-kvkk-onay');
    await page.click('.ct-submit');
    await page.waitForSelector('[data-fk-done]:not([hidden])');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${dir}c3-state-${vp.n}-done.jpg`, type: 'jpeg', quality: 74 });
    await page.goto(`${BASE}/kariyer/#basvuru`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.click('#cr-form .ct-submit');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}c3-state-${vp.n}-cr-error.jpg`, type: 'jpeg', quality: 74 });
    ok(logs.length === 0, `${vp.n} konsol temiz${logs.length ? ': ' + logs.join(' | ') : ''}`);
    await ctx.close();
  }
}

try {
  if (ONLY === 'shots') await shots();
  if (!ONLY || ONLY === 'contact') await contact();
  if (!ONLY || ONLY === 'careers') await careers();
  if (!ONLY || ONLY === 'mailto') await humanMail();
  if (!ONLY || ONLY === 'layout') await layout();
  if (!ONLY || ONLY === 'nojs') await nojs();
} catch (e) {
  fails++;
  console.log('  ✘ HATA', e.message.split('\n')[0]);
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} başarısız` : '\nTümü geçti');
process.exit(fails ? 1 : 0);
