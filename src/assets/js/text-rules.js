// Metin kuralları — tarayıcıda ve derlemede (scripts/final-period.mjs) aynı kaynak.
// Cümle sonu noktası (müşteri isteği, Ekim 2026): görünen hiçbir metin bloğu noktayla bitmez; bloğun SON noktası kaldırılır,
// blok içindeki cümleleri ayıran noktalar okunurluk için kalır. Dokunulmayanlar: kısaltmayla biten metin («A.Ş.», «vb.»,
// «Ltd. Şti.», «Ref.»), üç nokta, yalnızca sıra numarası olan metin («1.»).

// noktalı kısaltmalar (küçük harf, noktasız): metin bunlardan biriyle bitiyorsa nokta kısaltmanındır
const ABBR = new Set([
  'vb', 'vs', 'vd', 'bkz', 'krş', 'ltd', 'şti', 'no', 'nr', 'md', 'mad', 'fık', 'bnt', 's', 'sf', 'sy', 'dr', 'prof', 'doç', 'av',
  'mah', 'sok', 'sk', 'cad', 'cd', 'bulv', 'apt', 'blv', 'inc', 'co', 'corp', 'ör', 'yy', 'böl', 'tic', 'san', 'müd', 'gn',
  'koop', 'hz', 'st', 'etc', 'ref', 'tel', 'faks', 'örn', 'yrd', 'arş', 'gör', 'öğr', 'uzm', 'müh', 'dk', 'sn', 'sa',
]);

/** Düz metnin sonundaki noktayı kurala göre kaldırır (sondaki boşluk korunur). */
export function dropFinalPeriod(text) {
  const m = /^([\s\S]*?)(\.)(\s*)$/.exec(text);
  if (!m) return text;
  const body = m[1];
  if (/\.$/.test(body)) return text; // «...»
  const w = (/(\S+)$/.exec(body) || [])[1] || '';
  if (!w) return body + m[3]; // satır içi öğeden sonra tek başına kalan nokta: «<a>…</a>.»
  if (/[)»"”’']$/.test(w)) return body + m[3]; // «… (Tebliğ m.5/1-ç).»: nokta parantez/tırnaktan sonra
  const bare = w.replace(/^[(«"“'‘]+/, '');
  if (/^\d+$/.test(bare) && body.trim() === w) return text; // «1.» sıra numarası
  if (/[.]/.test(bare)) return text; // «A.Ş.», «T.C.»
  if (/^\p{Lu}$/u.test(bare)) return text; // baş harf: «M.»
  if (ABBR.has(bare.toLocaleLowerCase('tr'))) return text;
  return body + m[3];
}

// Blok: satır içi olmayan her öğe metni böler; satır içi öğeler bölmez
export const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's', 'samp', 'small',
  'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'br', 'img', 'picture', 'source', 'label', 'output',
]);
// içeriği metin sayılmayan öğeler
export const RAW_TAGS = new Set(['script', 'style', 'template', 'textarea', 'pre', 'svg', 'noscript', 'title']);

/** Tarayıcıda: JS'in çizdiği bir bölümde (ör. hesaplayıcı sonucu) metin bloklarının son noktasını kaldırır. */
export function dropFinalPeriodsIn(root) {
  if (!root) return;
  let last = null;
  const flush = () => {
    if (last) {
      const t = dropFinalPeriod(last.nodeValue);
      if (t !== last.nodeValue) last.nodeValue = t;
    }
    last = null;
  };
  const visit = (n) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        if (/\S/.test(c.nodeValue.replace(/ /g, ''))) last = c;
      } else if (c.nodeType === 1) {
        const tag = c.localName;
        const block = !INLINE_TAGS.has(tag);
        if (block) flush();
        if (RAW_TAGS.has(tag) || c.hasAttribute('data-keep-period')) continue;
        visit(c);
        if (block) flush();
      }
    }
  };
  visit(root);
  flush();
}
