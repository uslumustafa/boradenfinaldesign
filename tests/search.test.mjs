// Site içi arama: Türkçe harf katlama, VE mantığı ve puan sırası (DOM gerektirmez)
//   node --test tests/search.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, foldMap, tokenize, search } from '../src/assets/js/modules/search.js';

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
    rec('KDV iade işlemleri', 'İade süreci', 'Hizmet'),
    rec('KDV', 'Katma değer vergisi', 'Sözlük'),
  ];
  assert.deepEqual(
    search(idx, 'kdv').map((x) => x.t),
    ['KDV', 'KDV iade işlemleri', 'İndirimli KDV oranları', 'Kurumlar vergisi']
  );
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
