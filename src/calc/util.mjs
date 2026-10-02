/* Boraden hesaplayıcıları — ortak yardımcılar (SALT OKUNUR: motor yazarları değiştirmez).
   Saf ES modülü: DOM yok, Node API'si yok, "şimdi" okuması yok → tarayıcıda ve Node'da aynı çalışır.
   Tarihler her zaman "YYYY-MM-DD" metni; tüm tarih işlemleri UTC'dir (saat dilimi etkisi yok). */

const MS_DAY = 86400000;

/** Kullanıcı girdisi hatası — core.calculate() bunu { error, field } olarak döndürür. */
export class InputError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'InputError';
    this.userMessage = message;
    this.field = field || null;
  }
}

/* ---------- Sayılar ---------- */

/** TL → kuruş yuvarlaması: yarım yukarı (mutlak değerde), kayan nokta gürültüsüne dayanıklı. */
export function round2(x) {
  if (!Number.isFinite(x)) return 0;
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(x) + 1e-9) * 100)) / 100;
}

/** Genel yuvarlama (digits hane). */
export function roundTo(x, digits = 2) {
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** digits;
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(x) + 1e-9) * f)) / f;
}

/** Girdiden sayı okur. number | boolean | "1234.5" | "1.234,56" (Türkçe biçim) kabul eder; boş/geçersiz → def. */
export function num(v, def = 0) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : def;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    let s = v.trim().replace(/\s|₺|TL|%/gi, '');
    if (s === '') return def;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : def;
  }
  return def;
}

/** Zorunlu sayı alanı + aralık denetimi. Hata → InputError. */
export function needNum(inputs, id, { label, min = 0, max = 1e12, int = false } = {}) {
  const name = label || id;
  const raw = inputs ? inputs[id] : undefined;
  const v = num(raw, NaN);
  if (!Number.isFinite(v)) throw new InputError(`${name} alanına geçerli bir sayı girin.`, id);
  if (v < min) throw new InputError(`${name} en az ${min} olmalıdır.`, id);
  if (v > max) throw new InputError(`${name} en fazla ${max} olabilir.`, id);
  if (int && !Number.isInteger(v)) throw new InputError(`${name} tam sayı olmalıdır.`, id);
  return v;
}

/** İsteğe bağlı sayı alanı (boşsa def). */
export function optNum(inputs, id, def = 0, opts = {}) {
  const raw = inputs ? inputs[id] : undefined;
  if (raw === undefined || raw === null || raw === '') return def;
  return needNum(inputs, id, opts);
}

/** Onay kutusu / evet-hayır. */
export function bool(v) {
  if (typeof v === 'string') return v === 'true' || v === '1' || v === 'on' || v === 'evet';
  return !!v;
}

/** Listeden seçim (select/segment). Geçersizse InputError; boşsa def (varsa). */
export function needChoice(inputs, id, allowed, { label, def } = {}) {
  const raw = inputs ? inputs[id] : undefined;
  const v = raw === undefined || raw === null || raw === '' ? def : String(raw);
  if (v === undefined || !allowed.map(String).includes(String(v))) {
    throw new InputError(`${label || id} için geçerli bir seçim yapın.`, id);
  }
  return String(v);
}

/* ---------- Tarihler (UTC, "YYYY-MM-DD") ---------- */

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1–12
}

export function parseISO(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export function toISO(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function dayNumber(iso) {
  const p = parseISO(iso);
  if (!p) throw new InputError(`Geçersiz tarih: ${iso}`);
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / MS_DAY);
}

export function fromDayNumber(n) {
  const dt = new Date(n * MS_DAY);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
export const addDays = (iso, n) => fromDayNumber(dayNumber(iso) + n);

/** n ay ekler; ay sonuna taşarsa ayın son gününe sabitler (31 Ocak + 1 ay = 28/29 Şubat). */
export function addMonths(iso, n) {
  const p = parseISO(iso);
  if (!p) throw new InputError(`Geçersiz tarih: ${iso}`);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return toISO(y, m, Math.min(p.d, daysInMonth(y, m)));
}

/** 0 = Pazar … 6 = Cumartesi */
export function weekday(iso) {
  return new Date(dayNumber(iso) * MS_DAY).getUTCDay();
}

/** a ≤ b için takvim farkı: { years, months, days, totalMonths } (ör. hizmet süresi). */
export function ymdDiff(a, b) {
  const pa = parseISO(a);
  const pb = parseISO(b);
  if (!pa || !pb) throw new InputError('Geçersiz tarih.');
  let months = (pb.y - pa.y) * 12 + (pb.m - pa.m);
  if (addMonths(a, months) > b) months -= 1;
  const mid = addMonths(a, months);
  return { years: Math.floor(months / 12), months: months % 12, days: daysBetween(mid, b), totalMonths: months };
}

/** Zorunlu tarih alanı. */
export function needDate(inputs, id, { label, min, max } = {}) {
  const raw = inputs ? inputs[id] : undefined;
  const name = label || id;
  if (typeof raw !== 'string' || !parseISO(raw)) throw new InputError(`${name} için geçerli bir tarih girin.`, id);
  const iso = raw.trim();
  if (min && iso < min) throw new InputError(`${name} ${min} tarihinden önce olamaz.`, id);
  if (max && iso > max) throw new InputError(`${name} ${max} tarihinden sonra olamaz.`, id);
  return iso;
}

/**
 * Tarihe göre geçerli parametre kaydı: list = [{ from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD', ... }] (from'a göre artan).
 * iso'yu kapsayan kayıtlardan sonuncuyu döndürür; yoksa null.
 */
export function pickEffective(list, iso) {
  let hit = null;
  for (const e of list || []) {
    if ((!e.from || e.from <= iso) && (!e.to || iso <= e.to)) hit = e;
  }
  return hit;
}

/* ---------- Sonuç satırı üreticileri (summary / steps / tablo hücreleri için) ---------- */

const row = (kind) => (label, value, o = {}) => ({
  label,
  value: kind === 'money' ? round2(value) : value,
  kind,
  ...o,
});
export const S = {
  money: row('money'),
  percent: row('percent'),
  int: row('int'),
  number: row('number'),
  days: row('days'),
  date: row('date'),
  text: row('text'),
};

/** Tablo sütunu tanımı. */
export const col = (key, label, kind = 'money', align) => ({ key, label, kind, align: align || (kind === 'text' ? 'left' : 'right') });
