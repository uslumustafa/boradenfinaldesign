// Kısaltmaların sayfadaki ilk geçişini sözlük maddesine bağlar (U-42). Derlemede, yalnızca <main> içindeki düz metinde çalışır.
// Hangi kısaltmalar: sözlükte kendi maddesi olanlar — madde adı kısaltmanın kendisi («MERSİS»), kısaltmayla başlayıp açılımı
// parantezde verilenler («KDV (Katma Değer Vergisi)»), açılımdan sonra parantezde kısaltma taşıyanlar («… (TDS)») ve «UFRS / TFRS».
// Sözlükte maddesi olmayan kısaltmaya (SGK, GİB, ETDS…) dokunulmaz; tanım uydurulmaz.
// Bağlanmayan yerler: başlıklar, bağlantı/düğme/form öğeleri, menü ve içindekiler, künye, çipler, etiket satırları, tablolar,
// aydınlanan metin (data-lit: JS kelimelere böler), kod ve betikler. Wagtail karşılığı: zengin metin için bir şablon süzgeci
// (ya da kayıt anında çalışan bir işleyici); kurallar burada.

const ACR = '[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9]+';

// sözlük → [{ abbr, slug, term }]
export function glossaryAbbrs(glossary) {
  const out = [];
  const add = (abbr, t) => {
    if (abbr && !out.some((x) => x.abbr === abbr)) out.push({ abbr, slug: t.slug, term: t.term });
  };
  for (const t of glossary || []) {
    const name = String(t.term || '').trim();
    let m;
    if (new RegExp(`^${ACR}$`, 'u').test(name)) add(name, t); // «MERSİS»
    else if ((m = new RegExp(`^(${ACR}(?: ${ACR}| \\d+)?) \\(`, 'u').exec(name))) add(m[1], t); // «KDV (…)», «TMS 29 (…)»
    else if ((m = new RegExp(`^(${ACR}) / (${ACR})$`, 'u').exec(name))) {
      add(m[1], t);
      add(m[2], t);
    } else if (new RegExp(`^${ACR} ${ACR}$`, 'u').test(name)) add(name, t); // «BOBİ FRS»
    else if ((m = new RegExp(`\\((${ACR})\\)$`, 'u').exec(name))) add(m[1], t); // «Türkiye Denetim Standartları (TDS)»
  }
  // uzun olan önce: «BOBİ FRS» «FRS»den, «TMS 29» «TMS»den önce denenir
  return out.sort((a, b) => b.abbr.length - a.abbr.length);
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP_TAGS = new Set(['a', 'button', 'label', 'select', 'option', 'textarea', 'script', 'style', 'code', 'pre', 'kbd', 'samp', 'title', 'svg', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary', 'dt', 'nav', 'header', 'footer', 'table', 'template', 'noscript', 'form']);
const SKIP_CLASS = /(?:^|\s)(?:toc|kunye|chips?|eyebrow|mono|svc__label|sr-only|phero__meta|calc|ic-col|srclink|rel|gl-term|needs__list|art__dl)(?:\s|$|__)/;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// html: tam sayfa; yalnızca ilk <main>…</main> işlenir. used: sayfada bağlanmış kısaltmalar (dışarıdan da verilebilir).
export function linkGlossary(html, abbrs, { base = '/bilgi-merkezi/sozluk/', used = new Set() } = {}) {
  const a = html.indexOf('<main');
  const z = html.lastIndexOf('</main>');
  if (a < 0 || z < 0 || !abbrs.length) return html;
  const res = abbrs.map((x) => ({ ...x, re: new RegExp(`(?<![\\p{L}\\p{N}])${x.abbr.replace(/ /g, '\\s')}(?![\\p{L}\\p{N}])`, 'u') }));
  // hızlı ön eleme: metin parçalarının çoğunda hiçbir kısaltma yoktur
  const any = new RegExp(abbrs.map((x) => x.abbr.replace(/ /g, '\\s')).join('|'), 'u');
  const stack = []; // { tag, skip }
  let skipDepth = 0;
  const parts = html.slice(a, z).split(/(<!--[\s\S]*?-->|<[^>]+>)/);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (p.startsWith('<!--')) continue;
    if (p.startsWith('</')) {
      const tag = p.slice(2).split(/[\s>]/)[0].toLowerCase();
      // en yakın eşleşen açılışı kapat (bozuk iç içe yazım olursa yığın kendini toparlar)
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) {
          for (let j = stack.length - 1; j >= k; j--) if (stack[j].skip) skipDepth--;
          stack.length = k;
          break;
        }
      }
      continue;
    }
    if (p.startsWith('<')) {
      const tag = p.slice(1).split(/[\s/>]/)[0].toLowerCase();
      if (!tag || p.startsWith('<!') || VOID.has(tag) || p.endsWith('/>')) continue;
      // betik, stil ve şablon içeriği olduğu gibi atlanır (içindeki «<…>» dizgeleri etiket sanılmasın)
      if (tag === 'script' || tag === 'style' || tag === 'template') {
        while (i + 1 < parts.length && !(parts[i + 1] || '').toLowerCase().startsWith(`</${tag}`)) i++;
        i++;
        continue;
      }
      const cls = (/\sclass="([^"]*)"/.exec(p) || [])[1] || '';
      const skip = SKIP_TAGS.has(tag) || SKIP_CLASS.test(cls) || /\sdata-lit[\s=>]/.test(p) || /\sdata-no-gloss[\s=>]/.test(p);
      stack.push({ tag, skip });
      if (skip) skipDepth++;
      continue;
    }
    if (skipDepth > 0 || stack.length === 0 || !any.test(p)) continue;
    // bu metin parçasında henüz bağlanmamış kısaltmaların en öndeki geçişi (eşit konumda uzun olan önce)
    let hit = null;
    for (const x of res) {
      if (used.has(x.abbr)) continue;
      const m = x.re.exec(p);
      if (m && (!hit || m.index < hit.m.index)) hit = { x, m };
    }
    if (!hit) continue;
    const { x, m } = hit;
    // aynı maddenin diğer kısaltması da bu sayfada bağlanmış sayılır (UFRS / TFRS)
    for (const y of res) if (y.slug === x.slug) used.add(y.abbr);
    const open = `<a class="gl-abbr" href="${base}#${x.slug}" title="Sözlük: ${esc(x.term)}">`;
    // bağlantı ayrı parçalar olarak yerleşir: ayrıştırıcı onu etiket olarak tanır, içinde arama yapmaz; kalan metin işlenmeye devam eder
    parts.splice(i, 1, p.slice(0, m.index), open, m[0], '</a>', p.slice(m.index + m[0].length));
    i--;
  }
  return html.slice(0, a) + parts.join('') + html.slice(z);
}
