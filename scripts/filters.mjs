// Nunjucks süzgeçleri — Django şablon süzgeçleriyle bire bir karşılık gelecek şekilde adlandırıldı.
import nunjucks from 'nunjucks';
import { sceneOf, reachOf } from './scenes.mjs';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u' };

export function slugify(s) {
  return String(s || '')
    .replace(/[çğıiöşüÇĞİIÖŞÜ]/g, (c) => TR_MAP[c] || c)
    .toLowerCase()
    .replace(/&/g, ' ve ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// Satır içi işaretleme (içerik alanlarında): **kalın**, [etiket](bağ), [[Yer tutucu]].
// Önce tüm metin kaçışlanır; ardından yalnızca bu üç yapı HTML'e dönüştürülür. Bağlar yalnızca
// /iç-yol, https://, mailto: ve tel: olabilir. Wagtail karşılığı: RichText / StreamField blokları.
export function richInline(s) {
  const esc = nunjucks.lib.escape;
  let t = esc(String(s ?? ''));
  t = t.replace(/\[\[([^\]]+?)\]\]/g, '<mark class="ph">$1</mark>');
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+?)\]\(([^)\s]+)\)/g, (m, label, url) => {
    if (/^\/(?!\/)/.test(url) || /^(mailto:|tel:)/.test(url)) return `<a href="${url}">${label}</a>`;
    if (/^https?:\/\//.test(url)) return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (yeni sekmede açılır)</span></a>`;
    return m;
  });
  return new nunjucks.runtime.SafeString(t);
}

// JSON-LD gibi düz metin gereken yerler için işaretlemeyi temizler
export function plainInline(s) {
  return String(s ?? '')
    .replace(/\[\[([^\]]+?)\]\]/g, '$1')
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\[([^\]]+?)\]\(([^)\s]+)\)/g, '$1');
}

// Arama sonucu açıklaması (meta description, og:description): en çok `max` karakter. Uzunsa cümle sınırında kısaltılır
// (ilk cümleler sığdığı kadar; en az 70 karakter kalmalı); cümle sınırı yoksa kelime sınırında «…» ile. Sayfadaki görünür
// metin değişmez; yalnızca arama/paylaşım önizlemesinde kesik cümle görünmesin diye. Wagtail karşılığı: search_description.
export function metaDesc(s, max = 160) {
  const t = plainInline(s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const ends = [...t.slice(0, max + 1).matchAll(/[.!?…](?=\s)/g)].map((m) => m.index + 1);
  const cut = ends.filter((i) => i >= 70).pop();
  if (cut) return t.slice(0, cut);
  const word = t.slice(0, max).replace(/\s+\S*$/, '').replace(/[\s,;:–—-]+$/u, '');
  return word + '…';
}

// «Tam, doğru, zamanında.» → ['Tam', 'doğru', 'zamanında']: ana sayfa başlığının satırları (en çok 4).
// Virgülle ayrılır; virgül yoksa boşlukla; sondaki noktalama atılır. Tek kaynak `site.tagline`dır (Wagtail: SiteSettings.tagline).
// Wagtail karşılığı: boraden_tags içinde aynı adlı süzgeç (`{{ site.tagline|tagline_words }}`).
export function taglineWords(s, max = 4) {
  const clean = (x) => x.trim().replace(/[\s.,;:!?…]+$/u, '');
  let parts = String(s ?? '').split(',').map(clean).filter(Boolean);
  if (parts.length < 2) parts = String(s ?? '').split(/\s+/).map(clean).filter(Boolean);
  if (parts.length > max) parts = [...parts.slice(0, max - 1), parts.slice(max - 1).join(' ')];
  return parts;
}

// En uzun kelimenin harf sayısı (noktalama ve satır içi işaretleme hariç; tire, eğik çizgi ve uzun çizgi kelime ayırır).
// Büyük başlıklar yazı boyunu buna göre sınırlar (style="--lw: …"): «görüşeceğinizden», «Telekomünikasyon» gibi uzun Türkçe
// kelimeler dar sütunda harf ortasından bölünmez, başlık biraz küçülür. Wagtail karşılığı: boraden_tags › longest_word.
export function longestWord(s) {
  let max = 0;
  for (const w of plainInline(String(s ?? '')).split(/[\s\u2010-\u2015/-]+/)) {
    const n = [...w.replace(/[^\p{L}\p{N}]/gu, '')].length;
    if (n > max) max = n;
  }
  return max;
}

// Kahraman başlığı yazı tipinde (Montserrat 300, harf aralığı −0,018em) harf başına ilerleme genişliği (em; tarayıcıda ölçüldü,
// kerning hariç — gerçek çizim bu toplamdan en çok %1 dardır). Tabloda olmayan karakter 0,70em sayılır.
const HERO_ADV = {
  a: 0.565, b: 0.657, c: 0.5285, ç: 0.5285, d: 0.657, e: 0.579, f: 0.3129, g: 0.664, ğ: 0.664, h: 0.655, ı: 0.243, i: 0.243, j: 0.248, k: 0.565,
  l: 0.243, m: 1.046, n: 0.655, o: 0.602, ö: 0.602, p: 0.657, q: 0.657, r: 0.3675, s: 0.46, ş: 0.46, t: 0.3667, u: 0.651, ü: 0.651, v: 0.5072,
  w: 0.8412, x: 0.501, y: 0.5072, z: 0.485, â: 0.565, î: 0.243, û: 0.651,
  A: 0.6917, B: 0.734, C: 0.6547, Ç: 0.6547, D: 0.808, E: 0.651, F: 0.613, G: 0.755, Ğ: 0.755, H: 0.796, I: 0.277, İ: 0.277, J: 0.473, K: 0.685,
  L: 0.567, M: 0.938, N: 0.796, O: 0.82, Ö: 0.82, P: 0.6875, Q: 0.82, R: 0.702, S: 0.591, Ş: 0.591, T: 0.5545, U: 0.775, Ü: 0.775, V: 0.669,
  W: 1.08, X: 0.5993, Y: 0.6355, Z: 0.628, Â: 0.6917, Î: 0.277, Û: 0.775,
  0: 0.64, 1: 0.335, 2: 0.545, 3: 0.5353, 4: 0.636, 5: 0.5353, 6: 0.584, 7: 0.563, 8: 0.614, 9: 0.584,
  '.': 0.182, ',': 0.182, ':': 0.182, ';': 0.182, '!': 0.234, '?': 0.4984, '(': 0.303, ')': 0.304, '’': 0.2039, "'": 0.2188, '"': 0.3817,
  '«': 0.4275, '»': 0.4275, '&': 0.6285, '%': 0.6879, '+': 0.551,
};
// En uzun kelimenin kahraman başlığı yazı tipindeki genişliği (em, iki ondalık). Kelimeler longestWord ile aynı kuralla ayrılır;
// kelimeye bitişik noktalama (virgül, nokta, parantez…) genişliğe katılır.
// .phero h1 yazı boyunu buna göre sınırlar (style="--lwe: …"): sütuna sığmayan uzun kelime harf ortasından bölünmez, başlık
// yalnızca gerektiği kadar küçülür (harf sayısı × sabit katsayı tahmininden daha az). Wagtail karşılığı: boraden_tags › longest_word_em.
export function longestWordEm(s) {
  let max = 0;
  for (const w of plainInline(String(s ?? '')).split(/[\s‐-―/-]+/)) {
    let em = 0;
    for (const ch of w) em += HERO_ADV[ch] ?? 0.7; // noktalama da sayılır: tarayıcı «Perakende,» kelimesini virgülüyle birlikte taşır
    if (em > max) max = em;
  }
  return Math.round(max * 100) / 100;
}

// Telefon numarası: rakam grupları arasında bölünmez boşluk (U+00A0); satır yalnızca alan kodundan sonra kırılabilir.
// «+90 (212) 483 26 11» → «+90 (212)» | «483 26 11» — «483 26 / 11» gibi kırılmaz; büyütülmüş metinde (200 %) yine taşmaz.
export function phoneNbsp(s) {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  const nb = (x) => x.replace(/ /g, '\u00a0');
  const m = t.match(/^(.*?\))\s+(\S.*)$/);
  return m ? `${nb(m[1])} ${nb(m[2])}` : nb(t);
}

export function makeFilters() {
  const dateParts = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return {
    rich: (s) => richInline(s),
    // boş satırla ayrılmış paragraflar; her biri satır içi işaretlemeyle
    paras_rich: (s) =>
      new nunjucks.runtime.SafeString(
        String(s || '')
          .split(/\n{2,}/)
          .map((p) => `<p>${richInline(p.trim())}</p>`)
          .join('')
      ),
    plain: (s) => plainInline(s),
    day_of: (iso) => {
      const d = dateParts(iso);
      return d ? d.getUTCDate() : '';
    },
    weekday_tr: (iso) => {
      const d = dateParts(iso);
      return d ? WEEKDAYS[d.getUTCDay()] : '';
    },
    month_short: (iso) => {
      const d = dateParts(iso);
      return d ? SHORT[d.getUTCMonth()] : '';
    },
    date_long: (iso) => {
      const d = dateParts(iso);
      return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${WEEKDAYS[d.getUTCDay()]}` : iso || '';
    },
    date_tr: (iso) => {
      const d = dateParts(iso);
      return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso || '';
    },
    date_short: (iso) => {
      const d = dateParts(iso);
      return d ? `${d.getUTCDate()} ${SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso || '';
    },
    year_of: (iso) => {
      const d = dateParts(iso);
      return d ? d.getUTCFullYear() : '';
    },
    pad2: (n) => String(n).padStart(2, '0'),
    upper_tr: (s) => String(s || '').toLocaleUpperCase('tr-TR'),
    lower_tr: (s) => String(s || '').toLocaleLowerCase('tr-TR'),
    money_tr: (n, digits = 2) =>
      new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(n)),
    int_tr: (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(n)),
    where: (arr, key, val) => (arr || []).filter((x) => x && x[key] === val),
    limit: (arr, n) => (arr || []).slice(0, n),
    slugify,
    // <script type="application/json"> içinde güvenle kullanılabilir
    json_script: (obj) =>
      new nunjucks.runtime.SafeString(
        JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
      ),
    // Düz metin → güvenli <p> blokları (boş satırla ayrılmış paragraflar)
    paragraphs: (s) => {
      const esc = nunjucks.lib.escape;
      return new nunjucks.runtime.SafeString(
        String(s || '')
          .split(/\n{2,}/)
          .map((p) => `<p>${esc(p.trim())}</p>`)
          .join('')
      );
    },
    strip_tags: (s) => String(s || '').replace(/<[^>]*>/g, ''),
    tagline_words: (s, max) => taglineWords(s, max),
    phone: (s) => phoneNbsp(s),
    // dizi verilirse en uzunu (key: öğe alanı) — ör. kart ızgarasında ortak yazı boyu: {{ items | longest_word('title') }}
    // formasyon kimliği → 3B dünya sahne numarası (koyu bantlarda): data-world="{{ 'matris' | scene }}"; bilinmeyen kimlik derlemeyi durdurur
    scene: (id) => sceneOf(id),
    // sahne → sayfa kahramanı başlık sütunu katsayıları (T-22): style="{{ sahne | scene_reach }}" → «--sa:68.3;--sb:32.7»; veri yoksa boş
    // (CSS genel değerleri kullanır). Wagtail karşılığı: boraden_tags › scene_reach (aynı JSON).
    scene_reach: (id) => {
      const r = reachOf(id);
      return r ? `--sa:${r[0]};--sb:${r[1]}` : '';
    },
    longest_word: (s, key) => (Array.isArray(s) ? Math.max(0, ...s.map((x) => longestWord(key ? x && x[key] : x))) : longestWord(s)),
    // kahraman başlığı: en uzun kelimenin genişliği (em) — {{ title | longest_word_em }}
    longest_word_em: (s) => longestWordEm(s),
    truncate_words: (s, n = 24) => {
      const w = String(s || '').split(/\s+/);
      return w.length <= n ? w.join(' ') : w.slice(0, n).join(' ') + '…';
    },
  };
}
