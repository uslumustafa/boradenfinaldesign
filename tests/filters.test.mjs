// Şablon süzgeçleri (scripts/filters.mjs): ana sayfa başlık satırları. DOM/tarayıcı gerekmez.
//   node --test tests/filters.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { taglineWords } from '../scripts/filters.mjs';
import { loadData } from '../scripts/build.mjs';

test('slogan ana sayfa başlığının satırlarına ayrılır (virgülle), sondaki noktalama atılır', () => {
  assert.deepEqual(taglineWords('Tam, doğru, zamanında.'), ['Tam', 'doğru', 'zamanında']);
  assert.deepEqual(taglineWords('  Tam ,doğru,  zamanında!  '), ['Tam', 'doğru', 'zamanında']);
});

test('virgül yoksa boşlukla ayrılır; en çok 4 satır (kalanı son satırda birleşir)', () => {
  assert.deepEqual(taglineWords('Güvenilir danışmanlık ortağınız'), ['Güvenilir', 'danışmanlık', 'ortağınız']);
  assert.deepEqual(taglineWords('bir iki üç dört beş altı'), ['bir', 'iki', 'üç', 'dört beş altı']);
  assert.deepEqual(taglineWords('a, b, c, d, e'), ['a', 'b', 'c', 'd e']);
  assert.deepEqual(taglineWords('a, b, c, d, e', 5), ['a', 'b', 'c', 'd', 'e']);
});

test('boş ya da tek sözcüklü slogan çökmez', () => {
  assert.deepEqual(taglineWords(''), []);
  assert.deepEqual(taglineWords(undefined), []);
  assert.deepEqual(taglineWords('...'), []);
  assert.deepEqual(taglineWords('Boraden.'), ['Boraden']);
});

test('gerçek veri: slogan 2–4 satıra bölünür (başlık tasarımı üç tikli düzen için kurulu)', () => {
  const lines = taglineWords(loadData().site.tagline);
  assert.ok(lines.length >= 2 && lines.length <= 4, `slogan ${lines.length} satır: ${lines.join(' | ')}`);
  assert.ok(lines.every((l) => l.length <= 14), 'her satır kısa olmalı (başlık yatayda kaydırılmaz; mobilde taşar)');
});
