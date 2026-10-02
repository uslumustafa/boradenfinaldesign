// Nunjucks süzgeçleri — Django şablon süzgeçleriyle bire bir karşılık gelecek şekilde adlandırıldı.
import nunjucks from 'nunjucks';

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

export function makeFilters() {
  const dateParts = (iso) => {
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
    truncate_words: (s, n = 24) => {
      const w = String(s || '').split(/\s+/);
      return w.length <= n ? w.join(' ') : w.slice(0, n).join(' ') + '…';
    },
  };
}
