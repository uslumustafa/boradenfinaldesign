// Site içi arama: Türkçe harf katlama, VE mantığı ve puan sırası (DOM gerektirmez)
//   node --test tests/search.test.mjs
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { fold, foldMap, tokenize, search, stems, variants, markWords, prepare } from '../src/assets/js/modules/search.js';

const rec = (t, d = '', k = 'Sayfa', u = '/x/') => ({ t, d, k, u, tf: fold(t), df: fold(d), kf: fold(k) });

test('Türkçe harf katlama: İ/I/ı/i, ş, ğ, ü, ö, ç → küçük ASCII', () => {
  assert.equal(fold('İSTANBUL'), 'istanbul');
  assert.equal(fold('ISPARTA ılık'), 'isparta ilik');
  assert.equal(fold('ŞÇĞÜÖ şçğüö'), 'scguo scguo');
  assert.equal(fold('Kıdem Tazminatı'), 'kidem tazminati');
  assert.equal(fold('  KDV   iadesi '), 'kdv iadesi');
  assert.equal(fold('Türkiye’nin — İkinci 500'), "turkiye'nin - ikinci 500");
});

test('foldMap: katlanmış her karakter özgün konuma eşlenir', () => {
  const { f, map } = foldMap('İade Ödemesi');
  assert.equal(f, 'iade odemesi');
  assert.equal(map.length, f.length);
  assert.equal(map[5], 5);
});

test('tokenize: sözcükler tekilleşir, noktalama ayırır', () => {
  assert.deepEqual(tokenize('KDV, kdv iade'), ['kdv', 'iade']);
  assert.deepEqual(tokenize('e-defter'), ['e-defter']);
  assert.deepEqual(tokenize('   '), []);
});

test('puan sırası: tam eşleşme > önek > başlıkta geçme > açıklamada geçme', () => {
  const idx = [
    rec('Kurumlar vergisi', 'KDV ile karıştırılmamalıdır'),
    rec('İndirimli KDV oranları'),
    rec('KDV oranları rehberi'),
    rec('KDV', 'Katma değer vergisi', 'Sözlük'),
  ];
  assert.deepEqual(
    search(idx, 'kdv').map((x) => x.t),
    ['KDV', 'KDV oranları rehberi', 'İndirimli KDV oranları', 'Kurumlar vergisi']
  );
});

test('başlığı eşleşen hizmet sözlük maddesinden, alan sayfası tek hizmetten önce gelir', () => {
  const idx = [
    rec('KDV', 'Katma değer vergisi', 'Sözlük'),
    rec('KDV iade işlemleri', 'İade süreci', 'Hizmet'),
    rec('Bağımsız denetim', 'Tanım', 'Sözlük'),
    rec('Bağımsız Denetim', 'Hizmet', 'Hizmet', '/hizmetler/denetim/bagimsiz-denetim/'),
    rec('Bağımsız Denetim', 'Alan', 'Hizmet alanı', '/hizmetler/denetim/'),
  ];
  assert.deepEqual(search(idx, 'kdv').map((x) => x.k), ['Hizmet', 'Sözlük']);
  assert.deepEqual(search(idx, 'bağımsız denetim').map((x) => x.k), ['Hizmet alanı', 'Hizmet', 'Sözlük']);
});

test('başlığı eşleşen alanın hizmetleri, başka alanların hizmetlerinden önce; diğer sonuçların yeri değişmez', () => {
  const idx = [
    rec('Muhasebe, Bordro ve Finansal Raporlama', '', 'Hizmet alanı', '/hizmetler/muhasebe/'),
    rec('Muhasebe ve Vergi Eğitimi', '', 'Hizmet', '/hizmetler/akademi/muhasebe-ve-vergi/'),
    rec('Mali Müşavirlik ve Muhasebe', '', 'Hizmet', '/hizmetler/muhasebe/mali-musavirlik-ve-muhasebe/'),
    rec('Muhasebe Takvimi', '', 'Araç', '/takvim/'),
  ];
  assert.deepEqual(search(idx, 'muhasebe').map((x) => x.t), ['Muhasebe, Bordro ve Finansal Raporlama', 'Muhasebe Takvimi', 'Mali Müşavirlik ve Muhasebe', 'Muhasebe ve Vergi Eğitimi']);
  // alan eşleşmezse sıra puana göre kalır
  assert.equal(search(idx.slice(1), 'muhasebe')[0].t, 'Muhasebe Takvimi');
  assert.deepEqual(variants('ik'), ['insan kaynaklari']);
  assert.deepEqual(variants('teşvik'), []); // «ik» yalnızca tek sözcük olarak
});

test('Türkçe ekler: kök sözcük başında eşleşir («iadesi», «kuruluşu», «kurmak», «muhasebeci»)', () => {
  assert.deepEqual(stems('iadesi').includes('iade'), true);
  assert.deepEqual(stems('kurulusu').includes('kurulus'), true);
  assert.deepEqual(stems('kurmak').includes('kur'), true);
  assert.deepEqual(stems('muhasebeci').includes('muhasebe'), true);
  assert.deepEqual(stems('kdv'), []); // kısa sözcük ve kısaltma kesilmez
  const idx = [rec('KDV İade İşlemleri', '', 'Hizmet'), rec('Şirket Kuruluş Danışmanlığı', '', 'Hizmet'), rec('Kurumlar Vergisi', '', 'Hizmet')];
  assert.equal(search(idx, 'kdv iadesi')[0].t, 'KDV İade İşlemleri');
  assert.equal(search(idx, 'şirket kurmak')[0].t, 'Şirket Kuruluş Danışmanlığı');
  assert.equal(search(idx, 'şirket kurmak').length, 1);
});

test('eş anlamlılar sorgunun varyantını üretir, özgün eşleşme önde kalır', () => {
  assert.deepEqual(variants('YMM'), ['tam tasdik']);
  assert.deepEqual(variants('staj başvurusu'), ['kariyer basvurusu']);
  assert.deepEqual(variants('ofis adresi'), []); // yalnızca sözcük sınırında
  const idx = [rec('Tam Tasdik ve Yeminli Mali Müşavirlik', '', 'Hizmet'), rec('YMM (Yeminli Mali Müşavir)', '', 'Sözlük'), rec('Kariyer', '', 'Kurumsal', '/kariyer/')];
  assert.deepEqual(search(idx, 'ymm').map((x) => x.k), ['Hizmet', 'Sözlük']);
  assert.equal(search(idx, 'staj')[0].u, '/kariyer/');
  assert.ok(markWords('kdv iadesi').includes('iade'), 'kök de vurgulanır');
});

test('VE mantığı ve harf katlamalı eşleşme', () => {
  const idx = [rec('KDV iade işlemleri', 'İade süreci'), rec('KDV', 'Katma değer vergisi'), rec('Bordro', 'Ücret ve kesintiler'), rec('Kıdem tazminatı')];
  assert.equal(search(idx, 'kdv iade').length, 1);
  assert.equal(search(idx, 'KIDEM')[0].t, 'Kıdem tazminatı');
  assert.equal(search(idx, 'kidem TAZMİNATI')[0].t, 'Kıdem tazminatı');
  assert.equal(search(idx, 'ucret')[0].t, 'Bordro');
  assert.equal(search(idx, 'olmayan sözcük').length, 0);
  assert.equal(search(idx, '').length, 0);
});

test('PDF kayıtları eşit puanda sayfalardan sonra gelir', () => {
  const idx = [rec('KDV oranları', '', 'Sirküler (PDF)', '/assets/documents/archive/a.pdf'), rec('KDV oranları', '', 'Sözlük', '/bilgi-merkezi/sozluk/#kdv')];
  assert.equal(search(idx, 'kdv')[0].k, 'Sözlük');
});

// Gerçek dizinle 44 sorgu (UI/UX testi Ek B): beklenen sayfa ilk üçte. Derleme çıktısı gerekir (BORADEN_DIST ya da dist/).
const indexFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.BORADEN_DIST || 'dist', 'assets/data/search-index.json');
const QUERIES = [
  ['muhasebe', /^\/hizmetler\/muhasebe\/(mali-musavirlik-ve-muhasebe\/)?$/],
  ['muhasebeci', /^\/hizmetler\/muhasebe\/mali-musavirlik-ve-muhasebe\//],
  ['mali müşavir', /^\/hizmetler\/(muhasebe\/mali-musavirlik|vergi\/tam-tasdik)/],
  ['bordro', /^\/hizmetler\/muhasebe\/(bordrolama|insan-kaynaklari-ve-bordro)\//],
  ['maaş hesaplama', /^\/hesaplayicilar\/maas-hesaplama\//],
  ['net maaş', /^\/hesaplayicilar\/maas-hesaplama\//],
  ['vergi takvimi', /^\/vergi-takvimi\//],
  ['beyanname tarihleri', /^\/vergi-takvimi\//],
  ['kdv iadesi', /^\/hizmetler\/vergi\/kdv-iade-islemleri\//],
  ['kdv hesaplama', /^\/hesaplayicilar\/kdv-hesaplama\//],
  ['bağımsız denetim', /^\/hizmetler\/denetim\//],
  ['denetim', /^\/hizmetler\/denetim\//],
  ['tfrs', /^\/hizmetler\/muhasebe\/ufrs-tfrs-raporlama\//],
  ['transfer fiyatlandırması', /^\/hizmetler\/vergi\/transfer-fiyatlandirma\//],
  ['teşvik', /^\/hizmetler\/tesvik\//],
  ['devlet teşviki', /^\/hizmetler\/tesvik\//],
  ['hibe', /^\/hizmetler\/tesvik\/ab-hibe-projeleri\//],
  ['kosgeb', /^\/hizmetler\/tesvik\/tubitak-kosgeb-destekleri\//],
  ['tübitak', /^\/hizmetler\/tesvik\/tubitak-kosgeb-destekleri\//],
  ['şirket kuruluşu', /^\/hizmetler\/hukuk\/sirket-kurulus-danismanligi\//],
  ['şirket kurmak', /^\/hizmetler\/(hukuk\/sirket-kurulus-danismanligi|tesvik\/startup-danismanligi)/],
  ['startup', /^\/hizmetler\/tesvik\/startup-danismanligi\//],
  ['kvkk', /^\/hizmetler\/hukuk\/kvkk-uyum\//],
  ['icra takibi', /^\/hizmetler\/hukuk\/alacak-ve-icra-takibi\//],
  ['alacak tahsili', /^\/hizmetler\/hukuk\/alacak-ve-icra-takibi\//],
  ['iş hukuku', /^\/hizmetler\/hukuk\/is-ve-sgk-hukuku\//],
  ['işçi davası', /^\/hizmetler\/hukuk\/is-ve-sgk-hukuku\//],
  ['şirket değerleme', /^\/hizmetler\/kurumsal-finansman\/sirket-degerlemesi\//],
  ['kariyer', /^\/kariyer\//],
  ['iş başvurusu', /^\/kariyer\//],
  ['staj', /^\/kariyer\//],
  ['eğitim', /^\/hizmetler\/akademi\//],
  ['ufrs eğitimi', /^\/hizmetler\/akademi\/ufrs\//],
  ['iletişim', /^\/iletisim\//],
  ['adres', /^\/iletisim\//],
  ['e-fatura', /^\/hizmetler\/dijital-donusum\/e-donusum\//],
  ['e-defter', /^\/hizmetler\/dijital-donusum\/e-donusum\//],
  ['çalışma izni', /^\/hizmetler\/muhasebe\/calisma-izni-alma-ve-iptali\//],
  ['oturma izni', /^\/hizmetler\/muhasebe\/yabanci-uyruklu-ikamet-izini\//],
  ['emeklilik', /^\/hizmetler\/muhasebe\/emeklilik-danismanligi\//],
  ['kıdem tazminatı', /^\/hesaplayicilar\/kidem-tazminati-hesaplama\//],
  ['sgk', /^\/hizmetler\/muhasebe\/(sgk|ev-hizmetlisi)/],
  ['tam tasdik', /^\/hizmetler\/vergi\/tam-tasdik-islemleri\//],
  ['ymm', /^\/hizmetler\/vergi\/tam-tasdik-islemleri\//],
];
test('gerçek dizin: 44 sorguda beklenen sayfa ilk üç sonuç arasında', { skip: !fs.existsSync(indexFile) && 'derleme çıktısı yok (önce npm run build:prod)' }, () => {
  const idx = prepare(JSON.parse(fs.readFileSync(indexFile, 'utf8')));
  const miss = [];
  let first = 0;
  for (const [q, re] of QUERIES) {
    const rank = search(idx, q).findIndex((it) => re.test(it.u)) + 1;
    if (rank === 1) first++;
    if (!rank || rank > 3) miss.push(`${q} → ${rank || 'yok'}`);
  }
  assert.deepEqual(miss, [], 'ilk üçe giremeyen sorgular');
  assert.ok(first >= 40, `ilk sırada ${first}/44 (en az 40 beklenir)`);
});
