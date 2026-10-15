import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropFinalPeriod, dropSentencePeriods, dropFinalPeriods } from '../scripts/final-period.mjs';

const body = (s) => `<html><head><title>A.</title></head><body>${s}</body></html>`;
const run = (s) => dropFinalPeriods(body(s)).replace(/^.*<body>|<\/body>.*$/gs, '');

test('blok sonundaki ve paragraf içindeki cümle noktaları kalkar', () => {
  assert.equal(run('<p>Bir. İki.</p>'), '<p>Bir İki</p>');
  assert.equal(run('<h2>Ofisimiz.</h2><p>Metin.</p>'), '<h2>Ofisimiz</h2><p>Metin</p>');
  assert.equal(run('<ul><li>Bir.</li><li>İki</li></ul>'), '<ul><li>Bir</li><li>İki</li></ul>');
  assert.equal(run('<p>Uygun görülen adaylarla iletişime geçilir. Görüşmelerin biçimi alana göre değişebilir.</p>'), '<p>Uygun görülen adaylarla iletişime geçilir Görüşmelerin biçimi alana göre değişebilir</p>');
});

test('satır içi öğe bloğu bölmez; öğe sınırındaki nokta da cümle sonu', () => {
  assert.equal(run('<p>Bkz. <a href="/x">Gizlilik Politikası</a>.</p>'), '<p>Bkz. <a href="/x">Gizlilik Politikası</a></p>');
  assert.equal(run('<p><strong>Önemli.</strong> Devamı burada.</p>'), '<p><strong>Önemli</strong> Devamı burada</p>');
  assert.equal(run('<p>Son <em>kelime.</em></p>'), '<p>Son <em>kelime</em></p>');
  assert.equal(run('<p>Bir.<br>İki.</p>'), '<p>Bir<br>İki</p>');
  assert.equal(run('<p>Boraden A.<abbr>Ş.</abbr> kurdu.</p>'), '<p>Boraden A.<abbr>Ş.</abbr> kurdu</p>');
});

test('blok öğe açılınca önceki metin biter', () => {
  assert.equal(run('<div>Giriş cümlesi.<div>İç.</div></div>'), '<div>Giriş cümlesi<div>İç</div></div>');
});

test('kısaltma, sayı, adres, üç nokta, sıra numarası, baş harf korunur', () => {
  assert.equal(dropFinalPeriod('Boraden A.Ş.'), 'Boraden A.Ş.');
  assert.equal(dropFinalPeriod('Ltd. Şti. olarak kuruldu. Sonra büyüdü.'), 'Ltd. Şti. olarak kuruldu Sonra büyüdü');
  assert.equal(dropFinalPeriod('kitaplar vb. alınır. Sonra'), 'kitaplar vb. alınır Sonra');
  assert.equal(dropFinalPeriod('Devam edecek...'), 'Devam edecek...');
  assert.equal(dropFinalPeriod('1. Giriş'), '1. Giriş');
  assert.equal(dropFinalPeriod('1.'), '1.');
  assert.equal(dropFinalPeriod('Madde 5.'), 'Madde 5');
  assert.equal(dropFinalPeriod('Tutar 1.250.000 TL. KDV 3.5 puan.'), 'Tutar 1.250.000 TL KDV 3.5 puan');
  assert.equal(dropFinalPeriod('Adres boraden.com.tr sitesidir.'), 'Adres boraden.com.tr sitesidir');
  assert.equal(dropFinalPeriod('M. Yılmaz imzaladı.'), 'M. Yılmaz imzaladı');
  assert.equal(dropFinalPeriod('Metin.\n  '), 'Metin\n  ');
  assert.equal(dropFinalPeriod('Soru?'), 'Soru?');
  assert.equal(dropFinalPeriod('uyumlu olmalıdır (Tebliğ m.5/1-ç). Bu nedenle'), 'uyumlu olmalıdır (Tebliğ m.5/1-ç) Bu nedenle');
  assert.equal(dropSentencePeriods('kalır.', ' Devamı'), 'kalır');
  assert.equal(dropSentencePeriods('A.Ş.', ' ile'), 'A.Ş.');
  assert.equal(dropSentencePeriods('ay ay hesaplar.', '→'), 'ay ay hesaplar');
  assert.equal(dropSentencePeriods('ör.', 'neğin'), 'ör.');
  assert.equal(dropFinalPeriod("Kanun'un 3. maddesine dayanır. 2026. Yıl"), "Kanun'un 3. maddesine dayanır 2026 Yıl");
  assert.equal(dropFinalPeriod('E-posta: info@boraden.com.tr. Telefon: 1'), 'E-posta: info@boraden.com.tr Telefon: 1');
  assert.equal(dropSentencePeriods('5.', ' fıkra'), '5.');
});

test('betik, stil, pre, svg, data-keep-period ve head dokunulmaz', () => {
  const src = body('<script>var a="x.";</script><style>a{}.</style><pre>kod.</pre><svg><text>1.</text></svg><p data-keep-period>Kalır. Burada da.</p>');
  const out = dropFinalPeriods(src);
  assert.equal(out, src);
  assert.match(dropFinalPeriods(body('<p>x.</p>')), /<title>A\.<\/title>/);
});

test('öznitelikler değişmez', () => {
  assert.equal(run('<p title="Başlık.">Metin.</p>'), '<p title="Başlık.">Metin</p>');
  assert.equal(run('<img alt="Resim."><p>a.</p>'), '<img alt="Resim."><p>a</p>');
});
