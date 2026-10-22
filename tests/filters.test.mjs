// Şablon süzgeçleri (scripts/filters.mjs): ana sayfa başlık satırları, başlıklardaki en uzun kelime. DOM/tarayıcı gerekmez.
//   node --test tests/filters.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { taglineWords, taglineEm, longestWord, longestWordEm, makeFilters, phoneNbsp } from '../scripts/filters.mjs';
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

test('en uzun kelime: Türkçe harfler tek sayılır, noktalama ve işaretleme atılır, tire/eğik çizgi kelime ayırır', () => {
  assert.equal(longestWord('Kiminle görüşeceğinizden emin değil misiniz?'), 16);
  assert.equal(longestWord('Teknoloji, Medya ve Telekomünikasyon'), 16);
  assert.equal(longestWord('Görüşelim.'), 9);
  assert.equal(longestWord('İK/Bordro — **kısa** [bağlantı](/a/)'), 8);
  assert.equal(longestWord('Ar-Ge hizmetleri'), 10);
  assert.equal(longestWord(''), 0);
  assert.equal(longestWord(undefined), 0);
});

test('longest_word süzgeci dizide en uzununu verir (kart ızgarası için ortak değer)', () => {
  const { longest_word } = makeFilters();
  assert.equal(longest_word([{ title: 'Planlama' }, { title: 'Dokümantasyon hazırlığı' }, {}], 'title'), 13);
  assert.equal(longest_word(['kısa', 'değerlendirilmesi']), 17);
  assert.equal(longest_word([]), 0);
});

test('telefon numarası yalnızca alan kodundan sonra kırılabilir (gruplar bölünmez boşlukla bağlı)', () => {
  const NB = '\u00a0';
  assert.equal(phoneNbsp('+90 (212) 483 26 11'), `+90${NB}(212) 483${NB}26${NB}11`);
  assert.equal(phoneNbsp('  0212  483 26 11 '), `0212${NB}483${NB}26${NB}11`);
  assert.equal(phoneNbsp(''), '');
  assert.equal(makeFilters().phone('+90 (532) 000 00 00').split(' ').length, 2);
});

// 22 Ekim 2026: slogan Montserrat 700 (boraden.com.tr'deki gibi); ana sayfa başlığının yazı boyu en geniş satıra göre sınırlanır
// (--twe). Ölçü satır içindeki en uzun kelimenin Montserrat 700 genişliğidir; sayfa kahramanı başlıkları Montserrat 600 ölçüsüyle.
test('tagline_em: sloganın en geniş satırı (Montserrat 700, em); longest_word_em Montserrat 600', () => {
  assert.equal(taglineEm('Tam, doğru, zamanında.'), 5.82);
  assert.equal(taglineEm(''), 0);
  assert.ok(taglineEm('Tam, doğru, zamanında.') > longestWordEm('zamanında'), '700 kalınlık 600\'den geniş');
  assert.ok(taglineEm('Güvenilir danışmanlık ortağınız') > taglineEm('Tam, doğru, zamanında.'), 'uzun kelimeli slogan daha geniş');
  const f = makeFilters();
  assert.equal(f.tagline_em('Tam, doğru, zamanında.'), 5.82);
});
