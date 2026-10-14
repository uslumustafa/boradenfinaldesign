// Cümle sonu noktası kuralı (müşteri isteği, Ekim 2026): sitede görünen hiçbir metin bloğu noktayla bitmez. Başlık, paragraf,
// madde, açıklama, kart metni…: bloğun SON noktası kaldırılır; blok içindeki cümleleri ayıran noktalar okunurluk için kalır.
// Derlemede, üretilen her sayfanın <body> kısmına uygulanır (içerik verisi ve şablonlar değişmez; yeni içerik de kurala uyar).
// Wagtail karşılığı: aynı kuralı uygulayan bir yanıt ara katmanı (middleware) ya da şablon süzgeci; kurallar burada.
//
// Blok: satır içi olmayan her öğe (p, h1–h6, li, dd, td, div, figcaption…) metni böler. Satır içi öğeler (a, strong, em, span,
// abbr…) bölmez: «… <a>Gizlilik Politikası</a>.» sonundaki nokta da kalkar, «<strong>önemlidir.</strong> Devamı…» ortada kalır.
// Dokunulmayanlar: betik, stil, şablon, pre, textarea, svg; data-keep-period işaretli öğe ve içi; kısaltma, üç nokta ve sıra
// numarası kuralları src/assets/js/text-rules.js'te (tarayıcıda JS'in çizdiği metinler de aynı kuralla: dropFinalPeriodsIn).

import { dropFinalPeriod, INLINE_TAGS as INLINE, RAW_TAGS as RAW } from '../src/assets/js/text-rules.js';

export { dropFinalPeriod };

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Sayfa HTML'inde <body> içindeki metin bloklarının son noktasını kaldırır. */
export function dropFinalPeriods(html) {
  const a = html.indexOf('<body');
  const z = html.lastIndexOf('</body>');
  if (a < 0 || z < 0) return html;
  const parts = html.slice(a, z).split(/(<!--[\s\S]*?-->|<[^>]+>)/);
  const stack = []; // { tag, keep }
  let keepDepth = 0;
  let last = -1; // bu bloktaki son anlamlı metin parçası
  const flush = () => {
    if (last >= 0) parts[last] = dropFinalPeriod(parts[last]);
    last = -1;
  };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p.startsWith('<!--')) continue;
    if (p.startsWith('</')) {
      const tag = p.slice(2).split(/[\s>]/)[0].toLowerCase();
      if (!INLINE.has(tag)) flush();
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) {
          for (let j = stack.length - 1; j >= k; j--) if (stack[j].keep) keepDepth--;
          stack.length = k;
          break;
        }
      }
      continue;
    }
    if (p.startsWith('<')) {
      if (p.startsWith('<!')) continue;
      const tag = p.slice(1).split(/[\s/>]/)[0].toLowerCase();
      if (!tag) continue;
      if (!INLINE.has(tag)) flush();
      if (RAW.has(tag)) {
        // ham içerik olduğu gibi atlanır (betik içindeki «<…>» etiket sanılmasın)
        while (i + 1 < parts.length && !(parts[i + 1] || '').toLowerCase().startsWith(`</${tag}`)) i++;
        i++;
        continue;
      }
      if (VOID.has(tag) || p.endsWith('/>')) continue;
      const keep = /\sdata-keep-period[\s=>]/.test(p);
      stack.push({ tag, keep });
      if (keep) keepDepth++;
      continue;
    }
    if (keepDepth > 0) continue;
    if (/\S/.test(p.replace(/&nbsp;|&#160;/g, ''))) last = i;
  }
  flush();
  return html.slice(0, a) + parts.join('') + html.slice(z);
}
