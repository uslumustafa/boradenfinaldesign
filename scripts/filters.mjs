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
// /iç-yol, #sayfa-içi-çapa, https://, mailto: ve tel: olabilir. Wagtail karşılığı: RichText / StreamField blokları.
export function richInline(s) {
  const esc = nunjucks.lib.escape;
  let t = esc(String(s ?? ''));
  t = t.replace(/\[\[([^\]]+?)\]\]/g, '<mark class="ph">$1</mark>');
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+?)\]\(([^)\s]+)\)/g, (m, label, url) => {
    if (/^\/(?!\/)/.test(url) || /^#[\w-]+$/.test(url) || /^(mailto:|tel:)/.test(url)) return `<a href="${url}">${label}</a>`;
    if (/^https?:\/\//.test(url)) return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (yeni sekmede açılır)</span></a>`;
    return m;
  });
  return new nunjucks.runtime.SafeString(t);
}

// JSON-LD gibi düz metin gereken yerler için işaretlemeyi temizler. Yer tutucu köşeli parantezle kalır («[E-posta adresi]»):
// arama sonucu açıklamasında doldurulmamış alan, cümlenin parçası gibi okunmaz.
export function plainInline(s) {
  return String(s ?? '')
    .replace(/\[\[([^\]]+?)\]\]/g, '[$1]')
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

// Sayfa kahramanı başlığı yazı tipinde (Montserrat 600) harf başına ilerleme genişliği (em; tarayıcıda ölçüldü, kerning ve harf aralığı
// hariç — başlığın eksi harf aralığı genişliği yalnızca azaltır). Tabloda olmayan karakter 0,70em sayılır. Yazı tipi değişirse yeniden
// ölçülür (14 Ekim 2026: Montserrat → Open Sans 300; 22 Ekim 2026: boraden.com.tr'deki gibi Montserrat 600).
const HERO_ADV = {
  0: 0.673, 1: 0.381, 2: 0.582, 3: 0.582, 4: 0.679, 5: 0.584, 6: 0.627, 7: 0.608, 8: 0.652, 9: 0.627, a: 0.607, b: 0.686, c: 0.581,
  ç: 0.581, d: 0.687, e: 0.622, f: 0.369, g: 0.694, ğ: 0.694, h: 0.685, ı: 0.289, i: 0.289, j: 0.295, k: 0.635, l: 0.289, m: 1.053,
  n: 0.685, o: 0.645, ö: 0.645, p: 0.686, q: 0.686, r: 0.42, s: 0.515, ş: 0.515, t: 0.424, u: 0.681, ü: 0.681, v: 0.578, w: 0.919,
  x: 0.573, y: 0.578, z: 0.532, â: 0.607, î: 0.289, û: 0.681, A: 0.749, B: 0.761, C: 0.718, Ç: 0.718, D: 0.826, E: 0.67, F: 0.637,
  G: 0.772, Ğ: 0.772, H: 0.81, I: 0.319, İ: 0.319, J: 0.527, K: 0.729, L: 0.599, M: 0.955, N: 0.81, O: 0.842, Ö: 0.842, P: 0.726,
  Q: 0.842, R: 0.731, S: 0.629, Ş: 0.629, T: 0.602, U: 0.789, Ü: 0.789, V: 0.729, W: 1.144, X: 0.693, Y: 0.661, Z: 0.663, Â: 0.749,
  Î: 0.319, Û: 0.789, '.': 0.244, ',': 0.244, ':': 0.244, ';': 0.244, '!': 0.278, '?': 0.581, '(': 0.347, ')': 0.348, '’': 0.244,
  "'": 0.22, '"': 0.413, '«': 0.535, '»': 0.535, '&': 0.706, '%': 0.86, '+': 0.59, '-': 0.385, '–': 0.5, '—': 1, '/': 0.371,
};
// Ana sayfa sloganı yazı tipinde (Montserrat 700, «Tam, doğru, zamanında» — müşteri: «Google yazı karakteri gibi kalın») aynı ölçüm.
const TAGLINE_ADV = {
  0: 0.679, 1: 0.392, 2: 0.59, 3: 0.592, 4: 0.689, 5: 0.595, 6: 0.637, 7: 0.62, 8: 0.66, 9: 0.637, a: 0.617, b: 0.69, c: 0.591,
  ç: 0.591, d: 0.692, e: 0.631, f: 0.387, g: 0.7, ğ: 0.7, h: 0.691, ı: 0.301, i: 0.301, j: 0.307, k: 0.655, l: 0.301, m: 1.049,
  n: 0.691, o: 0.655, ö: 0.655, p: 0.69, q: 0.69, r: 0.431, s: 0.531, ş: 0.531, t: 0.435, u: 0.687, ü: 0.687, v: 0.598, w: 0.937,
  x: 0.595, y: 0.598, z: 0.543, â: 0.617, î: 0.301, û: 0.687, A: 0.766, B: 0.765, C: 0.724, Ç: 0.724, D: 0.826, E: 0.671, F: 0.639,
  G: 0.771, Ğ: 0.771, H: 0.808, I: 0.328, İ: 0.328, J: 0.541, K: 0.74, L: 0.604, M: 0.955, N: 0.808, O: 0.844, Ö: 0.844, P: 0.732,
  Q: 0.844, R: 0.735, S: 0.638, Ş: 0.638, T: 0.618, U: 0.788, Ü: 0.788, V: 0.746, W: 1.163, X: 0.714, Y: 0.676, Z: 0.671, Â: 0.766,
  Î: 0.328, Û: 0.788, '.': 0.262, ',': 0.262, ':': 0.262, ';': 0.262, '!': 0.289, '?': 0.589, '(': 0.357, ')': 0.358, '’': 0.262,
  "'": 0.23, '"': 0.437, '«': 0.568, '»': 0.568, '&': 0.728, '%': 0.877, '+': 0.599, '-': 0.386, '–': 0.5, '—': 1, '/': 0.392,
};
// En uzun kelimenin kahraman başlığı yazı tipindeki genişliği (em, iki ondalık). Kelimeler longestWord ile aynı kuralla ayrılır;
// kelimeye bitişik noktalama (virgül, nokta, parantez…) genişliğe katılır.
// .phero h1 yazı boyunu buna göre sınırlar (style="--lwe: …"): sütuna sığmayan uzun kelime harf ortasından bölünmez, başlık
// yalnızca gerektiği kadar küçülür (harf sayısı × sabit katsayı tahmininden daha az). Wagtail karşılığı: boraden_tags › longest_word_em.
export function longestWordEm(s, adv = HERO_ADV) {
  let max = 0;
  for (const w of plainInline(String(s ?? '')).split(/[\s‐-―/-]+/)) {
    let em = 0;
    for (const ch of w) em += adv[ch] ?? 0.7; // noktalama da sayılır: tarayıcı «Perakende,» kelimesini virgülüyle birlikte taşır
    if (em > max) max = em;
  }
  return Math.round(max * 100) / 100;
}

// Ana sayfa sloganının en geniş satırı (em; Montserrat 700): satırlar taglineWords ile aynı kuralla ayrılır, satır içindeki en uzun
// kelime ölçülür. .hero__title yazı boyunu buna göre sınırlar (style="--twe: …"): «zamanında» ve tiki dar telefonda (320 px) aynı
// satırda kalır, tik alt satıra düşmez. Wagtail karşılığı: boraden_tags › tagline_em.
export function taglineEm(s) {
  return Math.max(0, ...taglineWords(s).map((w) => longestWordEm(w, TAGLINE_ADV)));
}

// Telefon numarası: rakam grupları arasında bölünmez boşluk (U+00A0); satır yalnızca alan kodundan sonra kırılabilir.
// «+90 (212) 483 26 11» → «+90 (212)» | «483 26 11» — «483 26 / 11» gibi kırılmaz; büyütülmüş metinde (200 %) yine taşmaz.
export function phoneNbsp(s) {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  const nb = (x) => x.replace(/ /g, '\u00a0');
  const m = t.match(/^(.*?\))\s+(\S.*)$/);
  return m ? `${nb(m[1])} ${nb(m[2])}` : nb(t);
}

// Kaynak listesinden yayımlayan kurumlar (künye «Dayanak» hücresi, U-28): «KGK — …» / «KGK – …» → «KGK»; tekrarsız,
// en çok `max` ad, fazlası «+N». Wagtail karşılığı: ServicePage.sources → source.issuer.
export function srcIssuers(list, max = 2) {
  const names = [];
  for (const x of list || []) {
    const n = String((x && x.label) || '').split(/\s[—–]\s/)[0].trim();
    if (n && !names.includes(n)) names.push(n);
  }
  return names.length > max ? `${names.slice(0, max).join(' · ')} +${names.length - max}` : names.join(' · ');
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
    src_issuers: (list, max) => srcIssuers(list, max),
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
    tagline_em: (s) => taglineEm(s),
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
