import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropFinalPeriod, dropFinalPeriods } from '../scripts/final-period.mjs';

const body = (s) => `<html><head><title>A.</title></head><body>${s}</body></html>`;
const run = (s) => dropFinalPeriods(body(s)).replace(/^.*<body>|<\/body>.*$/gs, '');

test('blok sonundaki nokta kalkar, blok içindeki cümle noktaları kalır', () => {
  assert.equal(run('<p>Bir. İki.</p>'), '<p>Bir. İki</p>');
  assert.equal(run('<h2>Ofisimiz.</h2><p>Metin.</p>'), '<h2>Ofisimiz</h2><p>Metin</p>');
  assert.equal(run('<ul><li>Bir.</li><li>İki</li></ul>'), '<ul><li>Bir</li><li>İki</li></ul>');
});

test('satır içi öğe bloğu bölmez', () => {
  assert.equal(run('<p>Bkz. <a href="/x">Gizlilik Politikası</a>.</p>'), '<p>Bkz. <a href="/x">Gizlilik Politikası</a></p>');
  assert.equal(run('<p><strong>Önemli.</strong> Devamı burada.</p>'), '<p><strong>Önemli.</strong> Devamı burada</p>');
  assert.equal(run('<p>Son <em>kelime.</em></p>'), '<p>Son <em>kelime</em></p>');
  assert.equal(run('<p>Bir.<br>İki.</p>'), '<p>Bir.<br>İki</p>');
});

test('blok öğe açılınca önceki metin biter', () => {
  assert.equal(run('<div>Giriş cümlesi.<div>İç.</div></div>'), '<div>Giriş cümlesi<div>İç</div></div>');
});

test('kısaltma, üç nokta, sıra numarası, boşluk', () => {
  assert.equal(dropFinalPeriod('Boraden A.Ş.'), 'Boraden A.Ş.');
  assert.equal(dropFinalPeriod('Ltd. Şti.'), 'Ltd. Şti.');
  assert.equal(dropFinalPeriod('kitaplar vb.'), 'kitaplar vb.');
  assert.equal(dropFinalPeriod('Devam edecek...'), 'Devam edecek...');
  assert.equal(dropFinalPeriod('1.'), '1.');
  assert.equal(dropFinalPeriod('Madde 5.'), 'Madde 5');
  assert.equal(dropFinalPeriod('Metin.\n  '), 'Metin\n  ');
  assert.equal(dropFinalPeriod('Soru?'), 'Soru?');
  assert.equal(dropFinalPeriod('uyumlu olmalıdır (Tebliğ m.5/1-ç).'), 'uyumlu olmalıdır (Tebliğ m.5/1-ç)');
});

test('betik, stil, pre, svg, data-keep-period ve head dokunulmaz', () => {
  const src = body('<script>var a="x.";</script><style>a{}.</style><pre>kod.</pre><svg><text>1.</text></svg><p data-keep-period>Kalır.</p>');
  const out = dropFinalPeriods(src);
  assert.equal(out, src);
  assert.match(dropFinalPeriods(body('<p>x.</p>')), /<title>A\.<\/title>/);
});

test('öznitelikler değişmez', () => {
  assert.equal(run('<p title="Başlık.">Metin.</p>'), '<p title="Başlık.">Metin</p>');
  assert.equal(run('<img alt="Resim."><p>a.</p>'), '<img alt="Resim."><p>a</p>');
});
