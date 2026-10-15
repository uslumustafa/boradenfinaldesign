// Metin kuralları — tarayıcıda ve derlemede (scripts/final-period.mjs) aynı kaynak.
// Cümle sonu noktası (müşteri isteği, Ekim 2026): sitede görünen metinde hiçbir cümle noktayla bitmez — bloğun sonundaki nokta da,
// paragraf içinde cümleleri ayıran noktalar da kaldırılır (cümleler yalnızca boşlukla ayrılır). Kalanlar: kısaltma noktaları
// («A.Ş.», «vb.», «Ltd. Şti.», «Ref.», «m.5»), sayı içindeki nokta («1.250.000», «3.5»), adres ve dosya adı («boraden.com.tr»),
// üç nokta, sıra numarası («1. Giriş»), baş harf («M. Yılmaz»).

// noktalı kısaltmalar (küçük harf, noktasız): sözcük bunlardan biriyse ardındaki nokta kısaltmanındır
const ABBR = new Set([
  'vb', 'vs', 'vd', 'bkz', 'krş', 'ltd', 'şti', 'no', 'nr', 'md', 'mad', 'fık', 'bnt', 's', 'sf', 'sy', 'dr', 'prof', 'doç', 'av',
  'mah', 'sok', 'sk', 'cad', 'cd', 'bulv', 'apt', 'blv', 'inc', 'co', 'corp', 'ör', 'yy', 'böl', 'tic', 'san', 'müd', 'gn',
  'koop', 'hz', 'st', 'etc', 'ref', 'tel', 'faks', 'örn', 'yrd', 'arş', 'gör', 'öğr', 'uzm', 'müh', 'dk', 'sn', 'sa', 'm', 'f',
]);

// nokta kısaltmaya mı ait: kelime (noktasız) kısaltma listesinde, içinde nokta var («A.Ş»), tek büyük harf («M») ya da
// metnin başındaki sıra numarası («1.»)
function abbrPeriod(word, atStart) {
  const bare = word.replace(/^[(«"“'‘[]+/, '');
  if (!bare) return false;
  if (/@|\.(com|tr|org|net|gov|edu|io|info|biz|eu|uk|de)$/i.test(bare)) return false; // e-posta / adres sonundaki nokta cümlenindir
  if (/\./.test(bare)) return true; // «A.Ş.», «T.C.», «m.5»
  if (/^\p{Lu}$/u.test(bare)) return true; // baş harf
  if (/^\d+$/.test(bare) && atStart) return true; // «1. Giriş»
  if (ABBR.has(bare.toLocaleLowerCase('tr'))) return true;
  return false;
}

/** Metindeki cümle sonu noktalarını kaldırır. next: aynı blokta bu metni izleyen metin (satır içi öğe sınırından sonra);
 *  blok burada bitiyorsa null. Sondaki nokta, blok sonunda ya da ardından gelen metin boşluk/büyük harf/tırnak ile başlıyorsa
 *  cümle sonu sayılır. */
export function dropSentencePeriods(text, next = null) {
  if (!text || text.indexOf('.') < 0) return text;
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c !== '.') {
      out += c;
      i++;
      continue;
    }
    // üç nokta: olduğu gibi
    if (text[i + 1] === '.' ) {
      let j = i;
      while (text[j] === '.') j++;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    const prev = text[i - 1] || '';
    const after = text.slice(i + 1);
    // önceki sözcük
    const wm = /(\S+)$/.exec(out);
    const word = wm ? wm[1] : '';
    const atStart = !wm || /^\s*$/.test(out.slice(0, out.length - word.length));
    // sayı içi nokta («1.250», «3.5») ya da adres («boraden.com.tr», «m.5»): iki yanı boşluksuz
    if (prev && /\S/.test(prev) && after && /\S/.test(after[0])) {
      out += '.';
      i++;
      continue;
    }
    // parantez/tırnaktan sonraki nokta: «… (m.5/1-ç).» → kalkar
    if (/[)»"”’'\]]$/.test(word)) {
      i++;
      continue;
    }
    if (abbrPeriod(word, atStart)) {
      out += '.';
      i++;
      continue;
    }
    // cümle sonu mu: metnin sonunda (blok sonu ya da devamı boşlukla/büyük harfle başlıyor) ya da ardından boşluk geliyor
    const rest = after.replace(/^\s+/, '');
    // sıra sayısı («Kanun'un 3. maddesi», «5. fıkra»): rakamdan sonraki nokta, devamı küçük harfle başlıyorsa korunur
    const bareWord = word.replace(/^[(«"“'‘[]+/, '');
    if (/^\d+$/.test(bareWord)) {
      const follow = after === '' ? (next == null ? '' : next) : after;
      if (/^\s*\p{Ll}/u.test(follow)) {
        out += '.';
        i++;
        continue;
      }
    }
    if (after === '') {
      // metin burada bitiyor: blok sonu ya da satır içi öğe sınırı. Devamı aynı kelimeyi sürdürmüyorsa («ör.<i>neğin</i>» gibi
      // boşluksuz küçük harf) cümle sonudur — ardından «→» oku, büyük harf ya da boşluk gelse de
      const nx = next == null ? '' : next;
      if (/^\p{Ll}/u.test(nx)) out += '.';
      i++;
      continue;
    }
    if (/^\s/.test(after)) {
      // «vb. kitaplar»: küçük harfle devam eden nadir kısaltma zaten listede; devamı ne olursa olsun cümle sonu sayılır
      i++;
      continue;
    }
    out += '.';
    i++;
  }
  return out;
}

/** Düz metnin (tek blok) cümle sonu noktalarını kaldırır. */
export function dropFinalPeriod(text) {
  return dropSentencePeriods(text, null);
}

// Blok: satır içi olmayan her öğe metni böler; satır içi öğeler bölmez
export const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's', 'samp', 'small',
  'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'br', 'img', 'picture', 'source', 'label', 'output',
]);
// içeriği metin sayılmayan öğeler
export const RAW_TAGS = new Set(['script', 'style', 'template', 'textarea', 'pre', 'svg', 'noscript', 'title']);

/** Tarayıcıda: JS'in çizdiği bir bölümde (ör. hesaplayıcı sonucu) metin bloklarının cümle noktalarını kaldırır. */
export function dropFinalPeriodsIn(root) {
  if (!root) return;
  let nodes = [];
  const flush = () => {
    for (let k = 0; k < nodes.length; k++) {
      const t = dropSentencePeriods(nodes[k].nodeValue, k + 1 < nodes.length ? nodes[k + 1].nodeValue : null);
      if (t !== nodes[k].nodeValue) nodes[k].nodeValue = t;
    }
    nodes = [];
  };
  const visit = (n) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        if (/\S/.test(c.nodeValue.replace(/ /g, ''))) nodes.push(c);
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
