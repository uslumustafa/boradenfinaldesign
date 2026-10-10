// 404 sayfası adres düzeltmesi (T-36): elle yazılmış büyük harfli / Türkçe karakterli adresler → sitedeki yazım.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath } from '../src/assets/js/modules/not-found.js';

test('büyük harf, Türkçe karakter, çift/ters eğik çizgi ve eksik «/» düzeltilir', () => {
  const cases = {
    '/Hizmetler/': '/hizmetler/',
    '/HIZMETLER/VERGI/': '/hizmetler/vergi/',
    '/HİZMETLER/VERGİ/': '/hizmetler/vergi/',
    '/hakk%C4%B1m%C4%B1zda/': '/hakkimizda/',
    '/hakkımızda/': '/hakkimizda/',
    '/hizmetler/te%C5%9Fvik/': '/hizmetler/tesvik/',
    '/İLETİŞİM': '/iletisim/',
    '/Sektörler//Sağlık-ve-İlaç/': '/sektorler/saglik-ve-ilac/',
    '/hesaplayıcılar\\kdv-hesaplama': '/hesaplayicilar/kdv-hesaplama/',
    '/Bilgi-Merkezi/SSS': '/bilgi-merkezi/sss/',
    '/dokuman/Rapor.PDF': '/dokuman/rapor.pdf',
    '/hizmetler/': '/hizmetler/',
    '/%E0%A4%A': '/%e0%a4%a/',
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(normalizePath(from), to, from);
});
