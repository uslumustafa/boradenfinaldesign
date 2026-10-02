/**
 * Boraden hesaplayıcı çekirdeği — saf ES modülü (tarayıcı + Node), bağımlılık yok.
 *
 *   calculate(engine, inputs, params) → Sonuç | { error, field? }
 *
 *   engine : calculators-*.json içindeki `engine` alanı (ör. "grossNet").
 *   inputs : { [inputId]: number | string | boolean }   (para/sayı: number · tarih: "YYYY-MM-DD" · onay kutusu: boolean)
 *   params : ilgili parametre dosyasının JSON içeriği (src/data/params/<yıl>-<alan>.json; alan: "bordro" | "vergi").
 *
 * Sonuç (her motor aynı biçimi döndürür; arayüz yalnızca bunu bilir):
 * {
 *   summary:  [{ label, value, kind, main?, hint? }],     // ≤ 6 satır; main=true → vurgulanan 1–2 değer
 *   tables:   [{ title, note?, columns:[{ key, label, kind, align? }], rows:[{ [key]: value }], footer?:{ [key]: value } }],
 *   steps:    [{ label, value?, kind?, formula? }],        // "Hesap adımları" (sıralı, kısa; formula düz metin: "33.030,00 × %14")
 *   notes:    [string],                                    // bu hesaba özgü varsayımlar / bilgiler
 *   warnings: [string],                                    // dikkat edilmesi gerekenler (tavan uygulandı, doğrulanmamış parametre…)
 *   paramsUsed: { id: "2026-bordro", items: [{ label, value, kind }] }   // uygulanan başlıca parametreler (≤ 12)
 * }
 *   kind: 'money' (TL, 2 hane) | 'percent' (yüzde BİRİMİ: 15 → %15; binde 7,59 → 0.759) | 'int' | 'number'
 *         | 'days' | 'date' (YYYY-MM-DD) | 'text'
 *
 * Hatalı kullanıcı girdisi için motor InputError fırlatır (util.mjs) → { error, field } döner.
 * Hiçbir motor başka istisna sızdırmaz; beklenmeyen hata genel bir mesajla döner.
 *
 * Motor dosyaları: ./engines/payroll.mjs (bordro, gelir vergisi, tazminatlar) · ./engines/tax.mjs (KDV, kurumlar, geçici vergi,
 * serbest meslek makbuzu, gecikme zammı). Her biri `export const ENGINES = { engineId: (inputs, params) => Sonuç }` verir.
 */
import { InputError } from './util.mjs';
import { ENGINES as PAYROLL } from './engines/payroll.mjs';
import { ENGINES as TAX } from './engines/tax.mjs';

export { InputError };
export const ENGINES = Object.freeze({ ...PAYROLL, ...TAX });
export const ENGINE_IDS = Object.freeze(Object.keys(ENGINES));

export function calculate(engine, inputs, params) {
  const fn = ENGINES[engine];
  if (!fn) return { error: `Bilinmeyen hesaplama motoru: ${engine}` };
  if (!params || typeof params !== 'object') return { error: 'Parametre dosyası yüklenemedi.' };
  try {
    const res = fn(inputs || {}, params);
    if (!res || typeof res !== 'object') return { error: 'Hesaplama sonuç üretmedi.' };
    return res;
  } catch (e) {
    if (e instanceof InputError || (e && e.userMessage)) return { error: e.userMessage, field: e.field || null };
    return { error: 'Hesaplama sırasında beklenmeyen bir hata oluştu.', debug: String((e && e.message) || e) };
  }
}
