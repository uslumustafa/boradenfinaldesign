/* Boraden — bordro, gelir vergisi ve tazminat hesaplayıcıları testleri.
   Çalıştırma (proje kökünden):  node --test tests/calc-bordro.test.mjs
   Kapsam: (1) araştırma test vektörlerinin TAMAMI (TV-01…TV-23, KT-1…KT-6, IH-1…IH-2) kuruşu kuruşuna;
           (2) parametre dosyası ↔ araştırma tutarlılığı; (3) özellik testleri (monotonluk, gidiş-dönüş, süreklilik, toplamlar);
           (4) sentetik 2027 ve yıl içi revizyon parametreleriyle "kodda yıl/oran gömülü değil" denetimi;
           (5) hata davranışı; (6) hesaplayıcı tanım denetimleri (calculators-bordro.json).
   Araştırma verisi test anında docs/research/*.json dosyalarından okunur (vektörler kopyalanmaz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate, ENGINES as ALL_ENGINES } from '../src/calc/core.mjs';
import { addDays, addMonths, ymdDiff } from '../src/calc/util.mjs';

/* ------------------------------------------------------------------ yardımcılar ---- */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJSON = (rel) => JSON.parse(readText(rel));
const clone = (o) => JSON.parse(JSON.stringify(o));

const PARAMS = readJSON('src/data/params/2026-bordro.json');
const RES_PAY = readJSON('docs/research/payroll-params-2026.json');
const RES_OTHER = readJSON('docs/research/other-params-2026.json');
const CONTENT = readJSON('src/data/content.json');
const TODAY = '2026-10-01'; // tarih jetonları bu sabit tarihe göre çözülür

/** Kuruş karşılaştırması: Math.round(x*100). */
const k = (x) => Math.round(x * 100);
const eqK = (actual, expected, msg = '') =>
  assert.equal(k(actual), k(expected), `${msg} beklenen ${expected}, bulunan ${actual}`.trim());

/** Motoru çağırır; hata sonucu testi düşürür. */
function run(engine, inputs, params = PARAMS) {
  const r = calculate(engine, inputs, params);
  assert.ok(!r.error, `${engine} hata verdi: ${r.error} (alan: ${r.field}) — girdi: ${JSON.stringify(inputs)}`);
  return r;
}
/** Hata beklenen çağrı. */
function runErr(engine, inputs, field, params = PARAMS) {
  const r = calculate(engine, inputs, params);
  assert.ok(r.error, `${engine} hata vermeliydi — girdi: ${JSON.stringify(inputs)}`);
  assert.equal(r.debug, undefined, `beklenmeyen istisna sızdı: ${r.debug}`);
  if (field) assert.equal(r.field, field, `hata alanı: ${r.field} (mesaj: ${r.error})`);
  return r;
}
const stepOf = (r, label) => {
  const s = r.steps.find((x) => x.label === label);
  assert.ok(s, `"${label}" adımı bulunamadı; mevcut: ${r.steps.map((x) => x.label).join(' | ')}`);
  return s.value;
};
const sumOf = (r, label) => {
  const s = r.summary.find((x) => x.label === label);
  assert.ok(s, `"${label}" özeti bulunamadı; mevcut: ${r.summary.map((x) => x.label).join(' | ')}`);
  return s.value;
};
const rowsOf = (r, i = 0) => r.tables[i].rows;
const hasWarning = (r, re) => r.warnings.some((w) => re.test(w));

/** Hizmet süresi (yıl, ay, gün) verilen çıkış tarihine göre işe giriş tarihi üretir (çıkış günü dahil). */
function startFor(end, y = 0, m = 0, d = 0) {
  const start = addMonths(addDays(addDays(end, 1), -d), -(12 * y + m));
  const back = ymdDiff(start, addDays(end, 1));
  assert.deepEqual([back.years, back.months, back.days], [y, m, d], `yardımcı: ${start}–${end} aralığı ${y}y ${m}ay ${d}g vermedi`);
  return start;
}
/** "3 yıl 6 ay 15 gün" → { y, m, d } */
function parseSpan(text) {
  const g = (re) => (re.exec(text) ? Number(re.exec(text)[1]) : 0);
  return { y: g(/(\d+)\s*yıl/), m: g(/(\d+)\s*ay/), d: g(/(\d+)\s*gün/) };
}

/** Sonuç içinde NaN/Infinity/undefined/null sayı olmamalı. */
function assertClean(value, where = 'sonuç') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${where}: sayı geçersiz (${value})`);
  else if (typeof value === 'string') assert.ok(!/NaN|Infinity|undefined|\[object/.test(value), `${where}: metinde geçersiz değer: ${value}`);
  else if (Array.isArray(value)) value.forEach((v, i) => assertClean(v, `${where}[${i}]`));
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) assertClean(v, `${where}.${key}`);
}

/** Sonuç sözleşmesi (core.mjs başlık yorumu). */
const KINDS = new Set(['money', 'percent', 'int', 'number', 'days', 'date', 'text']);
function assertContract(r, where = '') {
  assert.ok(!r.error, `${where} hata: ${r.error}`);
  assert.ok(Array.isArray(r.summary) && r.summary.length >= 1 && r.summary.length <= 6, `${where} summary 1–6 satır olmalı (${r.summary && r.summary.length})`);
  for (const s of r.summary) {
    assert.ok(typeof s.label === 'string' && s.label, `${where} summary etiketi`);
    assert.ok(KINDS.has(s.kind), `${where} summary kind: ${s.kind}`);
  }
  assert.ok(r.summary.some((s) => s.main), `${where} en az bir main özet satırı olmalı`);
  assert.ok(Array.isArray(r.tables) && r.tables.length >= 1, `${where} tablo yok`);
  for (const t of r.tables) {
    assert.ok(t.title && Array.isArray(t.columns) && Array.isArray(t.rows) && t.rows.length >= 1, `${where} tablo biçimi`);
    const keys = new Set(t.columns.map((c) => c.key));
    assert.equal(keys.size, t.columns.length, `${where} yinelenen sütun anahtarı`);
    for (const c of t.columns) assert.ok(c.label && KINDS.has(c.kind) && ['left', 'right'].includes(c.align), `${where} sütun ${c.key}`);
    for (const row of t.rows) for (const key of Object.keys(row)) assert.ok(keys.has(key), `${where} satırda tanımsız sütun: ${key}`);
    if (t.footer) for (const key of Object.keys(t.footer)) assert.ok(keys.has(key), `${where} altbilgide tanımsız sütun: ${key}`);
  }
  assert.ok(Array.isArray(r.steps) && r.steps.length >= 1, `${where} adım yok`);
  for (const s of r.steps) assert.ok(typeof s.label === 'string' && s.label && (s.kind === undefined || KINDS.has(s.kind)), `${where} adım biçimi`);
  assert.ok(Array.isArray(r.notes) && r.notes.every((n) => typeof n === 'string' && n));
  assert.ok(Array.isArray(r.warnings) && r.warnings.every((n) => typeof n === 'string' && n));
  assert.ok(r.paramsUsed && typeof r.paramsUsed.id === 'string' && Array.isArray(r.paramsUsed.items) && r.paramsUsed.items.length >= 1 && r.paramsUsed.items.length <= 12, `${where} paramsUsed`);
  for (const it of r.paramsUsed.items) assert.ok(it.label && it.value !== undefined && KINDS.has(it.kind), `${where} paramsUsed öğesi`);
  assertClean(r, where || 'sonuç');
}

/* ------------------------------------------------ bağımsız kıyas uygulaması (oracle) ----
   Motorun kodunu KULLANMAZ: BigInt kuruş, oranlar 1e-8 ölçekli tamsayı, yarım yukarı yuvarlama.
   Parametreleri aynı dosyadan (params) okur; amaç, motorun yeniden düzenlemelerinde aritmetik regresyonu yakalamaktır. */
const SC = 100000000n;
const toK = (tl) => BigInt(Math.round(tl * 100));
const toR = (x) => BigInt(Math.round(x * 1e8));
const half = (a, b) => (2n * a + b) / (2n * b); // a ≥ 0 için yarım yukarı bölme
const clampB = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const minB = (a, b) => (a < b ? a : b);
const periodAt = (list, iso) => [...list].reverse().find((p) => (!p.from || p.from <= iso) && (!p.to || iso <= p.to)) || list[list.length - 1];

function oracleTariff(list) {
  return list.map((b, i, a) => ({ lo: i ? toK(a[i - 1].upTo) : 0n, hi: b.upTo === null ? null : toK(b.upTo), r: toR(b.rate) }));
}
function oracleTaxScaled(tar, c) {
  let s = 0n;
  for (const b of tar) {
    const top = b.hi === null || c < b.hi ? c : b.hi;
    if (top > b.lo) s += (top - b.lo) * b.r;
  }
  return s;
}
/** Yıllık maaş hesabı (brüt → net) — { m, gross, sgk, iss, gv, dv, net, cum } kuruş (BigInt) satırları. */
function oracleYear(P, grossTL, { startMonth = 1, cum0 = 0, retired = false } = {}) {
  const tar = oracleTariff(P.incomeTax.wage);
  const empSgk = toR(P.employeeRates.sgk);
  const empIss = toR(P.employeeRates.unemployment);
  const stamp = toR(P.stampTax.wageRate);
  const sgdp = P.sgdp ? toR(P.sgdp.employeeRate) : 0n;
  const ym = (m) => `${P.meta.year}-${String(m).padStart(2, '0')}-01`;
  const bounds = (m) => {
    const e = periodAt(P.sgkBounds.periods, ym(m));
    return [toK(e.floor), toK(e.ceiling)];
  };
  const minWage = (m) => toK(periodAt(P.minWage.periods, ym(m)).gross);
  const exGV = [0n];
  const exDV = [0n];
  let cm = 0n;
  let pm = 0n;
  for (let m = 1; m <= 12; m++) {
    const w = minWage(m);
    const [lo, hi] = bounds(m);
    const base = clampB(w, lo, hi);
    cm += w - half(base * empSgk, SC) - half(base * empIss, SC);
    const t = oracleTaxScaled(tar, cm);
    exGV.push(half(t - pm, SC));
    pm = t;
    exDV.push(half(w * stamp, SC));
  }
  const g = toK(grossTL);
  const out = [];
  let cum = toK(cum0);
  for (let m = startMonth; m <= 12; m++) {
    const [lo, hi] = bounds(m);
    const base = clampB(g, lo, hi);
    const sgk = half(base * (retired ? sgdp : empSgk), SC);
    const iss = retired ? 0n : half(base * empIss, SC);
    const matrah = g - sgk - iss;
    const prev = cum;
    cum += matrah;
    const gvG = half(oracleTaxScaled(tar, cum) - oracleTaxScaled(tar, prev), SC);
    const gv = gvG - minB(gvG, exGV[m]);
    const dvG = half(g * stamp, SC);
    const dv = dvG - minB(dvG, exDV[m]);
    out.push({ m, gross: g, sgk, iss, gv, dv, net: g - sgk - iss - gv - dv, cum, exempt: gvG - gv + (dvG - dv), exGV: exGV[m], exDV: exDV[m] });
  }
  return out;
}
/** Gelir vergisi (yuvarlanmış), kuruş (BigInt). */
const oracleTax = (P, tariff, incomeTL) => half(oracleTaxScaled(oracleTariff(P.incomeTax[tariff]), toK(incomeTL)), SC);

/* ===================================================================================
   1) ARAŞTIRMA TEST VEKTÖRLERİ — tamamı, kuruşu kuruşuna (Math.round(x*100))
   Her araştırma kaydı için bir işleyici ZORUNLUDUR; işleyicisi olmayan ya da araştırmada karşılığı kalmayan
   kayıt testi düşürür (sessizce atlanamaz). Kaynağı hatalı çıkan satıcı/kaynak değerleri (TV-20, TV-21, TV-22)
   araştırmanın "computed_output" değerleriyle sınanır ve hatanın nedeni ayrıca doğrulanır.
   =================================================================================== */
const VEC_PAY = RES_PAY.test_vectors; // TV-01 … TV-23
const VEC_KT = RES_OTHER.test_vectors.kidem_tazminati; // KT-1 … KT-6
const VEC_IH = RES_OTHER.test_vectors.ihbar_tazminati; // IH-1 … IH-2
const handlers = {};

handlers['TV-01'] = (v) => {
  const e = v.expected_output;
  const r = run('grossNet', { mode: 'gross', gross: v.input.brut_monthly });
  assert.equal(rowsOf(r).length, 12);
  rowsOf(r).forEach((row, i) => {
    eqK(row.net, e.net_each_month, `net ay ${i + 1}`);
    eqK(row.sgk, e.sgk_isci, `SGK ay ${i + 1}`);
    eqK(row.iss, e.issizlik_isci, `işsizlik ay ${i + 1}`);
    eqK(row.gv, e.gelir_vergisi, `GV ay ${i + 1}`);
    eqK(row.dv, e.damga_vergisi, `DV ay ${i + 1}`);
  });
  /* asgari ücret hesaplayıcısı aynı resmî tutarları ve istisna programını üretir */
  const m = run('minWage', { date: TODAY });
  eqK(sumOf(m, 'Brüt asgari ücret (aylık)'), v.input.brut_monthly);
  eqK(sumOf(m, 'Net asgari ücret (aylık)'), e.net_each_month);
  eqK(sumOf(m, 'Günlük brüt asgari ücret'), RES_PAY.parameters.asgari_ucret_brut_gunluk.value);
  const sched = RES_PAY.parameters.gelir_vergisi_istisnasi_asgari_ucret_aylik.value.by_month;
  const dvIst = RES_PAY.parameters.damga_vergisi_istisnasi_asgari_ucret_aylik.value;
  rowsOf(m).forEach((row, i) => {
    eqK(row.net, e.net_each_month, `asgari ücret tablosu net ay ${i + 1}`);
    eqK(row.gvIst, sched[String(i + 1).padStart(2, '0')], `GV istisnası ay ${i + 1}`);
    eqK(row.gvGross, row.gvIst, `GV hesaplanan = istisna, ay ${i + 1}`);
    eqK(row.dvIst, dvIst, `DV istisnası ay ${i + 1}`);
    eqK(row.dvGross, row.dvIst, `DV hesaplanan = istisna, ay ${i + 1}`);
  });
  assert.equal(m.warnings.length, 0, `asgari ücret hesabında uyarı olmamalı: ${m.warnings.join(' | ')}`);
};

handlers['TV-02'] = (v) => {
  const map = { tesviksiz: 'none', imalat_disi_2_puan: 'p2', imalat_5_puan: 'p5' };
  for (const [key, incentive] of Object.entries(map)) {
    const e = v.expected_output[key];
    const r = run('employerCost', { gross: v.input.brut_monthly, incentive });
    eqK(rowsOf(r)[1].monthly, e.sgk_isveren, `${key} SGK işveren`);
    eqK(rowsOf(r)[2].monthly, e.issizlik_isveren, `${key} işsizlik işveren`);
    eqK(sumOf(r, 'Aylık toplam işveren maliyeti'), e.toplam, `${key} toplam`);
    eqK(r.tables[0].footer.monthly, e.toplam, `${key} tablo toplamı`);
    eqK(r.tables[0].footer.annual, e.toplam * 12, `${key} yıllık`);
  }
  const m = run('minWage', { date: TODAY });
  const costs = rowsOf(m, 1).map((row) => row.total);
  [v.expected_output.tesviksiz.toplam, v.expected_output.imalat_disi_2_puan.toplam, v.expected_output.imalat_5_puan.toplam].forEach((x, i) =>
    eqK(costs[i], x, `asgari ücret hesaplayıcısı işveren maliyeti ${i + 1}`)
  );
};

handlers['TV-03'] = (v) => {
  const e = v.expected_output;
  const r = run('grossNet', { mode: 'gross', gross: v.input.brut_monthly });
  const row = rowsOf(r)[0];
  eqK(row.sgk, e.sgk, 'SGK');
  eqK(row.iss, e.issizlik, 'işsizlik');
  eqK(row.matrah, e.gv_matrah, 'GV matrahı');
  eqK(stepOf(r, 'Gelir vergisi (istisna öncesi)'), e.gv_before_istisna, 'GV istisna öncesi');
  eqK(stepOf(r, 'Asgari ücret gelir vergisi istisnası'), e.gv_istisna, 'GV istisnası');
  eqK(row.gv, e.gv, 'GV');
  eqK(stepOf(r, 'Damga vergisi (istisna öncesi)'), e.dv_before_istisna, 'DV istisna öncesi');
  eqK(stepOf(r, 'Asgari ücret damga vergisi istisnası'), e.dv_istisna, 'DV istisnası');
  eqK(row.dv, e.dv, 'DV');
  eqK(row.net, e.net, 'net');
  eqK(sumOf(r, 'İlk ay net ücret'), e.net, 'özet: ilk ay net');
};

/* TV-04 … TV-18: tek ay (Ocak, kümülatif 0) satıcı tabloları — brütten nete + işveren maliyeti */
const snapshot = (v) => {
  const e = v.expected_output;
  const g = v.input.brut_monthly;
  const row = rowsOf(run('grossNet', { mode: 'gross', gross: g }))[0];
  eqK(row.sgk + row.iss, e.sgk_plus_issizlik, 'SGK + işsizlik');
  eqK(row.gv, e.gv, 'GV');
  eqK(row.dv, e.dv, 'DV');
  eqK(row.net, e.net, 'net');
  const ec = run('employerCost', { gross: g, incentive: 'none' });
  eqK(sumOf(ec, 'Aylık toplam işveren maliyeti'), e.isveren_maliyeti_tesviksiz, 'işveren maliyeti (teşviksiz)');
};
for (let i = 4; i <= 18; i++) handlers[`TV-${String(i).padStart(2, '0')}`] = snapshot;

handlers['TV-19'] = (v) => {
  const e = v.expected_output;
  const r = run('grossNet', { mode: 'gross', gross: v.input.brut_monthly });
  const rows = rowsOf(r);
  e.vendor_gv_by_month.forEach((x, i) => eqK(rows[i].gv, x, `GV ay ${i + 1}`));
  e.vendor_net_by_month.forEach((x, i) => eqK(rows[i].net, x, `net ay ${i + 1}`));
  eqK(r.tables[0].footer.net, v.computed_output.official_total_net, 'yıllık net toplam');
  eqK(sumOf(r, 'Yıllık net toplam'), v.computed_output.official_total_net, 'özet: yıllık net toplam');
  eqK(sumOf(r, 'Ortalama aylık net'), e.vendor_avg_net, 'ortalama aylık net');
  /* dilim geçişleri görünür: kümülatif matrah Mayıs'ta 190.000'i, Ekim'de 400.000'i aşar */
  assert.match(rows[4].band, /→/, 'Mayıs ayında dilim geçişi (→) görünmeli');
  assert.match(rows[9].band, /→/, 'Ekim ayında dilim geçişi (→) görünmeli');
  assert.ok(r.notes.some((n) => /Mayıs/.test(n) && /190\.000/.test(n)), 'Mayıs geçişi notlarda belirtilmeli');
  assert.ok(r.notes.some((n) => /Ekim/.test(n) && /400\.000/.test(n)), 'Ekim geçişi notlarda belirtilmeli');
};

/* TV-20 / TV-21: satıcı tablosu, ücret tarifesi yerine ücret dışı 3. dilim sınırını (1.000.000) uygulamış → o aylarda resmî değerler beklenir */
const vendorWithKnownError = (v) => {
  const g = v.input.brut_monthly;
  const differing = new Set(v.months_differing);
  assert.ok(differing.size > 0, 'araştırma farklı ayları bildirmeli');
  const e = v.expected_output;
  const c = v.computed_output;
  const r = run('grossNet', { mode: 'gross', gross: g });
  rowsOf(r).forEach((row, i) => {
    if (differing.has(i + 1)) {
      eqK(row.gv, c.official_gv_by_month[i], `resmî GV ay ${i + 1}`);
      eqK(row.net, c.official_net_by_month[i], `resmî net ay ${i + 1}`);
      assert.notEqual(k(row.gv), k(e.vendor_gv_by_month[i]), `ay ${i + 1}: satıcı değeri (hatalı) üretilmemeli`);
    } else {
      eqK(row.gv, e.vendor_gv_by_month[i], `GV ay ${i + 1}`);
      eqK(row.net, e.vendor_net_by_month[i], `net ay ${i + 1}`);
    }
  });
  eqK(r.tables[0].footer.net, c.official_total_net, 'resmî yıllık net toplam');
  /* hatanın nedeni: ücret tarifesinde 3. dilim sınırını ücret dışı tarifedeki gibi 1.000.000 yapınca satıcı tablosu birebir çıkar */
  const alt = clone(PARAMS);
  alt.incomeTax.wage[2].upTo = alt.incomeTax.other[2].upTo;
  const r2 = run('grossNet', { mode: 'gross', gross: g }, alt);
  rowsOf(r2).forEach((row, i) => {
    eqK(row.gv, e.vendor_gv_by_month[i], `satıcı GV ay ${i + 1}`);
    eqK(row.net, e.vendor_net_by_month[i], `satıcı net ay ${i + 1}`);
  });
  if (e.vendor_total_net !== undefined) eqK(r2.tables[0].footer.net, e.vendor_total_net, 'satıcı yıllık net toplam');
};
handlers['TV-20'] = vendorWithKnownError;
handlers['TV-21'] = vendorWithKnownError;

handlers['TV-22'] = (v) => {
  const e = v.expected_output;
  const c = v.computed_output;
  const r = run('grossNet', { mode: 'gross', gross: v.input.brut_monthly, retired: true });
  const row = rowsOf(r)[0];
  eqK(row.sgk, e.sgdp, 'SGDP');
  eqK(row.iss, 0, 'SGDP\'de işsizlik primi yok');
  eqK(row.matrah, e.gv_matrah, 'GV matrahı');
  eqK(stepOf(r, 'Gelir vergisi (istisna öncesi)'), e.gv_before_istisna, 'GV istisna öncesi');
  eqK(stepOf(r, 'Asgari ücret gelir vergisi istisnası'), e.gv_istisna, 'GV istisnası');
  /* kaynak "317,58" yazmış; doğru değer 4.582,91 − 4.211,33 = 371,58 (rakam yer değiştirmesi) */
  eqK(row.gv, c.gv, 'GV');
  eqK(row.gv, e.gv_before_istisna - e.gv_istisna, 'GV = istisna öncesi − istisna');
  assert.notEqual(k(row.gv), k(e.printed_kesilecek_gv), 'kaynağın hatalı basımı (317,58) üretilmemeli');
  eqK(row.dv, c.dv, 'DV');
  eqK(row.net, c.net, 'net');
  assert.notEqual(k(row.net), k(e.printed_net), 'kaynağın hatalı net değeri (30.235,17) üretilmemeli');
  assert.ok(hasWarning(r, /SGDP/), 'SGDP oranları doğrulanmadığı için uyarı verilmeli');
};

handlers['TV-23'] = (v) => {
  /* Dış kaynağı olmayan, araştırmanın kendi hesabı (confidence: unverified) — yalnızca tutarlılık ve tavan uyarısı sınanır */
  assert.equal(v.expected_output, null);
  const c = v.computed_output;
  const r = run('grossNet', { mode: 'gross', gross: v.input.brut_monthly });
  rowsOf(r).forEach((row, i) => {
    eqK(row.net, c.net_by_month[i], `net ay ${i + 1}`);
    eqK(row.gv, c.gv_by_month[i], `GV ay ${i + 1}`);
    eqK(row.sgk, c.sgk_isci_each_month, `SGK ay ${i + 1}`);
    eqK(row.iss, c.issizlik_each_month, `işsizlik ay ${i + 1}`);
    eqK(row.dv, c.dv_each_month, `DV ay ${i + 1}`);
  });
  eqK(r.tables[0].footer.net, c.total_net, 'yıllık net toplam');
  assert.ok(hasWarning(r, /üst sınır/), 'brüt SGK tavanını aştığında uyarı verilmeli');
  eqK(c.sgk_isci_each_month, v.input.sgk_base_cap * PARAMS.employeeRates.sgk, 'SGK matrahı tavanla sınırlı');
};

/* ---- kıdem tazminatı (other-params-2026.json › test_vectors.kidem_tazminati) ---- */
const sev = (end, y, m, d, gross, extra = {}, params = PARAMS) => run('severance', { start: startFor(end, y, m, d), end, gross, ...extra }, params);

handlers['KT-1'] = (v) => {
  const sp = parseSpan(v.inputs.hizmet);
  const r = sev('2026-09-30', sp.y, sp.m, sp.d, 40000);
  eqK(stepOf(r, 'Kıdem tazminatına esas gün sayısı'), v.expected.gun, 'esas gün sayısı');
};
const ktVector = (v) => {
  const i = v.inputs;
  const e = v.expected;
  const sp = parseSpan(i.hizmet);
  const r = sev(i.fesih, sp.y, sp.m, sp.d, i.giydirilmis_aylik_brut);
  eqK(stepOf(r, 'Hesaba esas aylık ücret'), e.yillik_esas, 'yıllık esas');
  assert.equal(stepOf(r, 'Hizmet yılı oranı'), e.hizmet_yili_orani, 'hizmet yılı oranı');
  eqK(sumOf(r, 'Brüt kıdem tazminatı'), e.kidem_tazminati_brut, 'brüt kıdem');
  eqK(sumOf(r, 'Damga vergisi'), e.damga_vergisi, 'damga vergisi');
  eqK(sumOf(r, 'Gelir vergisi'), 0, 'yasal tutar gelir vergisinden istisna');
  eqK(sumOf(r, 'Net kıdem tazminatı'), e.net_ele_gecen, 'net');
  assert.ok(hasWarning(r, /ikincil/), 'vergi uygulaması ikincil kaynaklara dayandığı için uyarı verilmeli');
  const capped = i.giydirilmis_aylik_brut > e.yillik_esas;
  assert.equal(hasWarning(r, /tavan/), capped, `tavan uyarısı ${capped ? 'beklenir' : 'beklenmez'}`);
};
for (const id of ['KT-2', 'KT-3', 'KT-4', 'KT-5']) handlers[id] = ktVector;
handlers['KT-6'] = (v) => {
  /* yayımlanmış damga vergisi örneği: 120.000 ₺ brüt kıdem → 910,80 ₺ damga → 119.089,20 ₺ net (3 yıl × 40.000 ₺) */
  const r = sev('2026-09-30', 3, 0, 0, v.inputs.brut_kidem / 3);
  eqK(sumOf(r, 'Brüt kıdem tazminatı'), v.inputs.brut_kidem, 'brüt');
  eqK(sumOf(r, 'Damga vergisi'), v.expected.damga_vergisi, 'damga vergisi');
  eqK(sumOf(r, 'Net kıdem tazminatı'), v.expected.net, 'net');
};

/* ---- ihbar tazminatı ---- */
handlers['IH-1'] = (v) => {
  const spans = v.inputs.hizmet;
  const weeks = v.expected.hafta;
  assert.equal(spans.length, weeks.length);
  const end = '2026-08-31';
  spans.forEach((text, i) => {
    const sp = parseSpan(text);
    const r = run('notice', { start: startFor(end, sp.y, sp.m, sp.d), end, gross: 30000 });
    assert.equal(stepOf(r, 'İhbar süresi (hafta)'), parseInt(weeks[i], 10), `${text} → ${weeks[i]} hafta`);
    const boundary = typeof weeks[i] === 'string'; // araştırma verisinde yorum olarak işaretli sınırlar
    assert.equal(hasWarning(r, /sınır yorumu/), boundary || /^(6 ay|1 yıl 6 ay|3 yıl)$/.test(text), `${text}: sınır uyarısı`);
  });
};
handlers['IH-2'] = (v) => {
  const i = v.inputs;
  const e = v.expected;
  const sp = parseSpan(i.hizmet);
  const end = '2026-08-31';
  const r = run('notice', { start: startFor(end, sp.y, sp.m, sp.d), end, gross: i.giydirilmis_aylik_brut });
  eqK(sumOf(r, 'Günlük brüt ücret'), e.gunluk, 'günlük ücret');
  assert.equal(stepOf(r, 'İhbar süresi (gün)'), e.gun, 'gün');
  eqK(sumOf(r, 'İhbar tazminatı (brüt)'), e.ihbar_tazminati_brut, 'brüt ihbar');
  eqK(sumOf(r, 'Damga vergisi'), e.damga_vergisi, 'damga vergisi');
  assert.ok(!rowsOf(r).some((row) => /SGK/i.test(row.item)), 'ihbar tazminatından SGK kesilmez (sgk: 0)');
  /* gelir vergisi: işçinin kümülatif matrahına göre — ücret tarifesinin ilk dilimi (%15) ve devreden matrahlı dilim geçişi */
  eqK(sumOf(r, 'Gelir vergisi'), e.ihbar_tazminati_brut * 0.15, 'matrah 0: %15');
  eqK(sumOf(r, 'Net ihbar tazminatı'), e.ihbar_tazminati_brut - e.damga_vergisi - e.ihbar_tazminati_brut * 0.15, 'net');
  const T = oracleTariff(PARAMS.incomeTax.wage);
  const base = 150000;
  const expectedGv = half(oracleTaxScaled(T, toK(base + e.ihbar_tazminati_brut)) - oracleTaxScaled(T, toK(base)), SC);
  const r2 = run('notice', { start: startFor(end, sp.y, sp.m, sp.d), end, gross: i.giydirilmis_aylik_brut, cumBase: base });
  assert.equal(k(sumOf(r2, 'Gelir vergisi')), Number(expectedGv), 'devreden matrahla GV (dilim geçişi)');
};

for (const v of [...VEC_PAY, ...VEC_KT, ...VEC_IH]) {
  test(`araştırma vektörü ${v.id}: ${v.description}`, () => {
    const h = handlers[v.id];
    assert.ok(h, `${v.id} için test işleyicisi yok — araştırma vektörleri atlanamaz`);
    h(v);
  });
}
test('araştırma vektörlerinin tümü işleyiciye sahip; araştırmada karşılığı olmayan işleyici yok', () => {
  const ids = [...VEC_PAY, ...VEC_KT, ...VEC_IH].map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, 'vektör kimlikleri benzersiz olmalı');
  assert.equal(ids.filter((id) => id.startsWith('TV-')).length, 23, 'TV-01…TV-23 (23 kayıt) beklenir');
  assert.equal(VEC_KT.length, 6, 'KT-1…KT-6');
  assert.equal(VEC_IH.length, 2, 'IH-1…IH-2');
  for (const id of ids) assert.ok(handlers[id], `${id} için işleyici yok`);
  for (const id of Object.keys(handlers)) assert.ok(ids.includes(id), `${id} işleyicisinin araştırmada karşılığı yok`);
});

/* ===================================================================================
   2) PARAMETRE DOSYASI ↔ ARAŞTIRMA TUTARLILIĞI
   =================================================================================== */
const RP = RES_PAY.parameters;
const KP = RES_OTHER.parameters.kidem_tazminati;
const near = (a, b, msg = '') => assert.ok(Math.abs(a - b) < 1e-9, `${msg} ${a} ≠ ${b}`.trim());

const PARAM_SECTIONS = ['incomeTax', 'revaluation', 'minWage', 'sgkBounds', 'employeeRates', 'employerRates', 'employerIncentives', 'sgdp', 'stampTax', 'minWageSupport', 'severance', 'servicePeriod', 'notice', 'compensationTax'];
/** Parametre dosyası biçimi (her yılın dosyası için geçerli): bölümler, kaynak/güven, needsVerification → Türkçe warning, oranlar kesir, tarifeler artan. */
function assertParamsShape(P, label) {
  assert.match(P.meta.verifiedOn, /^\d{4}-\d{2}-\d{2}$/, `${label}: meta.verifiedOn`);
  assert.ok(P.meta.id === `${P.meta.year}-bordro` && Number.isInteger(P.meta.year), `${label}: meta.id = <yıl>-bordro ve meta.year tam sayı olmalı`);
  const CONF = new Set(['verified-official', 'secondary', 'assumption']);
  for (const key of PARAM_SECTIONS) assert.ok(P[key] && typeof P[key] === 'object', `${label}: "${key}" bölümü eksik`);
  for (const [key, sec] of Object.entries(P)) {
    if (key === 'meta') continue;
    assert.ok(typeof sec.source === 'string' && /^https:\/\//.test(sec.source), `${label}.${key}: source (https) olmalı`);
    assert.ok(CONF.has(sec.confidence), `${label}.${key}: confidence geçersiz (${sec.confidence})`);
    if (sec.needsVerification) assert.ok(typeof sec.warning === 'string' && sec.warning.length > 20, `${label}.${key}: needsVerification için Türkçe warning gerekir`);
    else assert.equal(sec.warning, undefined, `${label}.${key}: bayrak yokken warning olmamalı`);
  }
  const rates = [
    ['employeeRates', 'sgk'], ['employeeRates', 'unemployment'], ['employerRates', 'sgk'], ['employerRates', 'unemployment'],
    ['sgdp', 'employeeRate'], ['sgdp', 'employerRate'], ['stampTax', 'wageRate'], ['compensationTax', 'stampRate'], ['revaluation', 'rate'],
  ];
  for (const [sec, key] of rates) assert.ok(P[sec][key] > 0 && P[sec][key] < 1, `${label}: ${sec}.${key} kesir (0–1) olmalı: ${P[sec][key]}`);
  assert.ok(P.employerIncentives.options.some((o) => o.id === 'none' && o.points === 0), `${label}: "none" (teşviksiz) seçeneği olmalı`);
  assert.equal(new Set(P.employerIncentives.options.map((o) => o.id)).size, P.employerIncentives.options.length, `${label}: teşvik seçenek kimlikleri benzersiz olmalı`);
  for (const o of P.employerIncentives.options) assert.ok(o.points >= 0 && o.points < 0.2 && o.label, `${label}: teşvik seçeneği ${o.id}`);
  for (const t of ['wage', 'other']) {
    const list = P.incomeTax[t];
    list.forEach((b, i) => {
      assert.ok(b.rate > 0 && b.rate < 1);
      if (i > 0) assert.ok(b.rate > list[i - 1].rate, `${label}: ${t} oranlar artan olmalı`);
      if (i < list.length - 1) assert.ok(b.upTo > (i ? list[i - 1].upTo : 0), `${label}: ${t} sınırlar artan olmalı`);
    });
    assert.equal(list[list.length - 1].upTo, null, `${label}: ${t} son dilim sınırsız (null) olmalı`);
  }
  assert.ok(P.notice.bands.length === 4 && P.notice.dailyDivisor > 0 && P.severance.minServiceYears >= 0 && P.servicePeriod.dayBase > 0, `${label}: ihbar/kıdem/hizmet süresi alanları`);
}
/** Tarih-etkili listeler: artan, çakışmasız, boşluksuz; asgari ücret ve PEK dönemleri birbirini kapsar. */
function assertPeriods(P, label) {
  const lists = { 'minWage.periods': P.minWage.periods, 'sgkBounds.periods': P.sgkBounds.periods, 'severance.ceilings': P.severance.ceilings };
  for (const [name, list] of Object.entries(lists)) {
    assert.ok(Array.isArray(list) && list.length >= 1, `${label}.${name} boş olamaz`);
    list.forEach((p, i) => {
      assert.match(p.from, /^\d{4}-\d{2}-\d{2}$/, `${label}.${name}[${i}].from`);
      assert.match(p.to, /^\d{4}-\d{2}-\d{2}$/, `${label}.${name}[${i}].to`);
      assert.ok(p.from <= p.to, `${label}.${name}[${i}]: from ≤ to`);
      if (i > 0) assert.equal(addDays(list[i - 1].to, 1), p.from, `${label}.${name}[${i}]: önceki dönemin ertesi günü başlamalı`);
    });
  }
  for (const p of P.sgkBounds.periods) assert.ok(p.ceiling > p.floor && p.floor > 0, `${label}: PEK üst sınır > alt sınır`);
  for (const p of P.minWage.periods) assert.ok(p.gross > 0 && p.net > 0 && p.net < p.gross && p.daily > 0, `${label}: asgari ücret dönemi tutarları`);
  assert.deepEqual(
    P.minWage.periods.map((p) => [p.from, p.to]),
    P.sgkBounds.periods.map((p) => [p.from, p.to]),
    `${label}: asgari ücret ve PEK dönemleri aynı tarih aralıklarını izlemeli (yıl içi revizyon ikisine de eklenir)`
  );
  P.minWage.periods.forEach((p, i) => assert.equal(P.sgkBounds.periods[i].floor, p.gross, `${label}: PEK alt sınırı = brüt asgari ücret (dönem ${i + 1})`));
}

test('params: 2026 dosyası — kimlik, boyut, bölümler, kaynak/güven, needsVerification → Türkçe warning, oranlar kesir', () => {
  assert.equal(PARAMS.meta.id, '2026-bordro');
  assert.equal(PARAMS.meta.year, 2026);
  assert.ok(fs.statSync(path.join(ROOT, 'src/data/params/2026-bordro.json')).size < 60 * 1024, 'params dosyası < 60 KB olmalı');
  assertParamsShape(PARAMS, '2026-bordro');
});

test('params: 2026 dosyası — tarih-etkili listeler artan, çakışmasız ve boşluksuz', () => {
  assertPeriods(PARAMS, '2026-bordro');
});

test('params ↔ araştırma: gelir vergisi tarifeleri birebir; her dilim sonundaki kümülatif vergi motorla aynı', () => {
  const pairs = [['wage', RP.gelir_vergisi_tarifesi_ucret_2026], ['other', RP.gelir_vergisi_tarifesi_ucret_disi_2026]];
  for (const [key, res] of pairs) {
    const list = PARAMS.incomeTax[key];
    assert.equal(list.length, res.value.length, `${key}: dilim sayısı`);
    res.value.forEach((b, i) => {
      assert.equal(list[i].upTo, b.upper, `${key} ${i + 1}. dilim sınırı`);
      assert.equal(list[i].rate, b.rate, `${key} ${i + 1}. dilim oranı`);
      if (b.cumulative_tax_at_upper !== null) {
        eqK(sumOf(run('incomeTax', { income: b.upper, tariff: key }), 'Hesaplanan gelir vergisi'), b.cumulative_tax_at_upper, `${key} ${i + 1}. dilim sonu vergisi`);
      }
    });
  }
  near(PARAMS.revaluation.rate, RP.yeniden_degerleme_orani_2026.value / 100, 'yeniden değerleme oranı');
  assert.equal(PARAMS.revaluation.year, 2026);
  assert.equal(PARAMS.incomeTax.from, RP.gelir_vergisi_tarifesi_ucret_2026.effective_from);
  assert.equal(PARAMS.incomeTax.to, RP.gelir_vergisi_tarifesi_ucret_2026.effective_to);
});

test('params ↔ araştırma: asgari ücret, PEK sınırları, prim oranları, teşvikler, SGDP, damga, destek', () => {
  /* asgari ücret dönemleri (yıl içi revizyon yoksa tek dönem) */
  const res = RP.asgari_ucret_mid_year_adjustment.value;
  assert.equal(PARAMS.minWage.periods.length, res.periods.length, 'asgari ücret dönem sayısı');
  res.periods.forEach((p, i) => {
    const q = PARAMS.minWage.periods[i];
    assert.deepEqual([q.from, q.to, q.gross, q.net], [p.from, p.to, p.brut, p.net], `asgari ücret dönemi ${i + 1}`);
  });
  eqK(PARAMS.minWage.periods[0].daily, RP.asgari_ucret_brut_gunluk.value, 'günlük asgari ücret');
  eqK(PARAMS.minWage.periods[0].gross / 30, RP.asgari_ucret_brut_gunluk.value, 'günlük = aylık / 30');
  /* PEK */
  const b = PARAMS.sgkBounds.periods[0];
  assert.equal(b.floor, RP.sgk_pek_alt_sinir_aylik.value.aylik);
  assert.equal(b.ceiling, RP.sgk_pek_ust_sinir_aylik.value.aylik);
  assert.equal(b.ceiling, b.floor * RP.sgk_pek_ust_sinir_aylik.value.multiple_of_alt_sinir, 'üst sınır = alt sınırın 9 katı');
  /* prim oranları */
  near(PARAMS.employeeRates.sgk * 100, RP.sgk_isci_payi.value.sgk_pct, 'SGK işçi');
  near(PARAMS.employeeRates.unemployment * 100, RP.sgk_isci_payi.value.issizlik_pct, 'işsizlik işçi');
  near(PARAMS.employerRates.sgk * 100, RP.sgk_isveren_payi.value.sgk_pct_before_incentive, 'SGK işveren');
  near(PARAMS.employerRates.unemployment * 100, RP.sgk_isveren_payi.value.issizlik_pct, 'işsizlik işveren');
  /* teşvikler */
  const opt = (id) => PARAMS.employerIncentives.options.find((o) => o.id === id);
  near(opt('p2').points * 100, RP.sgk_isveren_indirim_imalat_disi_2_puan.value.puan, '2 puan');
  near(opt('p5').points * 100, RP.sgk_isveren_indirim_imalat_5_puan.value.puan, '5 puan');
  assert.equal(opt('p5').to, RP.sgk_isveren_indirim_imalat_5_puan.effective_to, '5 puanlık indirimin bitiş tarihi');
  assert.equal(opt('p2').to, undefined, '2 puanlık indirim için araştırmada bitiş tarihi yok');
  assert.equal(opt('none').points, 0);
  /* SGDP */
  near(PARAMS.sgdp.employeeRate * 100, RP.sgdp_emekli_calisan.value.isci_pct, 'SGDP işçi');
  near(PARAMS.sgdp.employerRate * 100, RP.sgdp_emekli_calisan.value.isveren_pct, 'SGDP işveren');
  /* damga vergisi */
  near(PARAMS.stampTax.wageRate, RP.damga_vergisi_orani_ucret.value.rate, 'damga vergisi (ücret)');
  near(PARAMS.compensationTax.stampRate, KP.damga_vergisi.value / 1000, 'damga vergisi (tazminat)');
  /* asgari ücret desteği */
  eqK(PARAMS.minWageSupport.perDay, RP.asgari_ucret_destegi.value.gunluk, 'destek (gün)');
  eqK(PARAMS.minWageSupport.perDay * PARAMS.minWageSupport.days, RP.asgari_ucret_destegi.value.aylik_30_gun, 'destek (30 gün)');
});

test('params ↔ araştırma: kıdem tavanları ve ihbar bandları', () => {
  const find = (from) => PARAMS.severance.ceilings.find((c) => c.from === from);
  for (const key of ['tavan_2026_h1', 'tavan_2026_h2']) {
    const r = KP[key];
    const c = find(r.effective_from);
    assert.ok(c, `${key}: ${r.effective_from} başlangıçlı tavan dönemi yok`);
    assert.equal(c.to, r.effective_to);
    assert.equal(c.amount, r.value);
  }
  const ref = KP.tavan_2025_reference.value;
  assert.equal(find('2025-01-01').amount, ref['2025-01-01_to_2025-06-30']);
  assert.equal(find('2025-07-01').amount, ref['2025-07-01_to_2025-12-31']);
  const bands = RES_OTHER.parameters.ihbar_tazminati.ihbar_sureleri.value;
  assert.deepEqual(PARAMS.notice.bands.map((x) => x.weeks), bands.map((x) => x.weeks));
  assert.deepEqual(PARAMS.notice.bands.map((x) => x.weeks * 7), bands.map((x) => x.days));
  assert.equal(PARAMS.notice.dailyDivisor, 30);
  assert.equal(PARAMS.severance.minServiceYears, 1);
  assert.equal(KP.calculation_rule.value.days_per_full_year, 30);
  assert.equal(PARAMS.servicePeriod.dayBase, 365);
});

test('params: güven düzeyi araştırmadan yüksek olamaz; doğrulanmamış maddeler bayraklı', () => {
  const rank = (c) => (/^verified-official/.test(c) ? 3 : /cross-checked|single-secondary|secondary/.test(c) ? 1 : 0);
  const prank = (c) => (c === 'verified-official' ? 3 : c === 'secondary' ? 1 : 0);
  const pairs = [
    ['incomeTax', RP.gelir_vergisi_tarifesi_ucret_2026], ['incomeTax', RP.gelir_vergisi_tarifesi_ucret_disi_2026],
    ['revaluation', RP.yeniden_degerleme_orani_2026], ['minWage', RP.asgari_ucret_brut_aylik], ['minWage', RP.asgari_ucret_net_aylik],
    ['sgkBounds', RP.sgk_pek_alt_sinir_aylik], ['sgkBounds', RP.sgk_pek_ust_sinir_aylik], ['employeeRates', RP.sgk_isci_payi],
    ['employerRates', RP.sgk_isveren_payi], ['employerIncentives', RP.sgk_isveren_indirim_imalat_disi_2_puan],
    ['employerIncentives', RP.sgk_isveren_indirim_imalat_5_puan], ['sgdp', RP.sgdp_emekli_calisan], ['stampTax', RP.damga_vergisi_orani_ucret],
    ['minWageSupport', RP.asgari_ucret_destegi], ['severance', KP.tavan_2026_h1], ['severance', KP.tavan_2026_h2],
    ['servicePeriod', KP.calculation_rule], ['notice', RES_OTHER.parameters.ihbar_tazminati.ihbar_sureleri],
    ['compensationTax', KP.gelir_vergisi_status], ['compensationTax', KP.damga_vergisi],
  ];
  for (const [key, res] of pairs) assert.ok(prank(PARAMS[key].confidence) <= rank(res.confidence), `${key}: güven (${PARAMS[key].confidence}) araştırmadan (${res.confidence}) yüksek`);
  for (const key of ['sgdp', 'compensationTax', 'minWageSupport']) assert.equal(PARAMS[key].needsVerification, true, `${key} doğrulanmamıştır → needsVerification: true`);
  assert.equal(PARAMS.servicePeriod.confidence, 'secondary', 'gün tabanı yalnızca ikincil kaynağa dayanır');
});

/* ===================================================================================
   3) ÖZELLİK TESTLERİ
   =================================================================================== */
const rowKeys = ['sgk', 'iss', 'gv', 'dv', 'net'];

test('grossNet: bağımsız kıyas uygulamasıyla ay ay kuruşu kuruşuna aynı (brüt, başlangıç ayı, devreden matrah, SGDP)', () => {
  const grosses = [33030, 33030.01, 33500.55, 40000, 50000, 62345.67, 75000, 100000, 150000.5, 250000, 297270, 297270.01, 300000, 450000, 1000000];
  let n = 0;
  for (const g of grosses)
    for (const start of [1, 4, 7, 12])
      for (const cum0 of [0, 123456.78])
        for (const retired of [false, true]) {
          const r = run('grossNet', { mode: 'gross', gross: g, startMonth: String(start), cumBase: cum0, retired });
          const o = oracleYear(PARAMS, g, { startMonth: start, cum0, retired });
          const rows = rowsOf(r);
          assert.equal(rows.length, 13 - start);
          rows.forEach((row, i) => {
            for (const key of rowKeys) assert.equal(k(row[key]), Number(o[i][key]), `brüt ${g}, başlangıç ${start}, devreden ${cum0}, SGDP ${retired}, ay ${o[i].m}: ${key}`);
            assert.equal(k(row.cum), Number(o[i].cum), `kümülatif matrah ay ${o[i].m}`);
            assert.equal(k(row.exempt), Number(o[i].exempt), `istisnalar toplamı ay ${o[i].m}`);
            n++;
          });
        }
  assert.equal(n, 15 * 28 * 2 * 2, `karşılaştırma sayısı (${n})`);
});

test('grossNet: tablo toplamları = özet; brüt − kesintiler = net; kümülatif matrah ardışık; sözleşme ve NaN denetimi', () => {
  for (const g of [33030, 50000, 123456.78, 400000, 1000000]) {
    const r = run('grossNet', { mode: 'gross', gross: g });
    assertContract(r, `grossNet ${g}`);
    const rows = rowsOf(r);
    const f = r.tables[0].footer;
    assert.equal(rows.length, 12);
    let prev = 0;
    rows.forEach((row, i) => {
      eqK(row.gross - row.sgk - row.iss - row.gv - row.dv, row.net, `ay ${i + 1} kimlik`);
      eqK(row.gross - row.sgk - row.iss, row.matrah, `ay ${i + 1} matrah`);
      eqK(row.cum - prev, row.matrah, `ay ${i + 1} kümülatif`);
      prev = row.cum;
    });
    for (const key of ['gross', 'sgk', 'iss', 'matrah', 'gv', 'dv', 'exempt', 'net']) {
      assert.equal(rows.reduce((a, row) => a + k(row[key]), 0), k(f[key]), `toplam ${key}`);
    }
    eqK(sumOf(r, 'Yıllık net toplam'), f.net);
    eqK(sumOf(r, 'Yıllık brüt toplam'), f.gross);
    eqK(sumOf(r, 'Yıllık toplam kesinti'), f.gross - f.net);
    eqK(sumOf(r, 'İlk ay net ücret'), rows[0].net);
    eqK(sumOf(r, 'Son ay net ücret'), rows[11].net);
  }
});

test('grossNet: brüt arttıkça ilk ay neti ve her ayın kümülatif neti azalmaz (monotonluk); SGK tavanını aşınca uyarı verilir', () => {
  /* Not: belirli bir AYIN neti brüt arttıkça düşebilir — yüksek brüt, önceki aylarda biriken matrahı bir üst dilime taşıdığı için
     o ayın kesintisi artar (kümülatif vergi). Monoton olan nicelikler: ilk ay neti ve "yıl başından o aya kadar toplam net". */
  let prev = null;
  for (let g = 33030; g <= 420000; g += 997) {
    const rows = rowsOf(run('grossNet', { mode: 'gross', gross: g }));
    const cumNet = rows.map((_, i) => rows.slice(0, i + 1).reduce((a, row) => a + k(row.net), 0));
    if (prev) {
      assert.ok(k(rows[0].net) >= k(prev.rows[0].net), `brüt ${g}: ilk ay neti azaldı`);
      cumNet.forEach((c, i) => assert.ok(c >= prev.cumNet[i], `brüt ${g}, ay ${i + 1}: kümülatif net azaldı (${prev.cumNet[i]} → ${c})`));
    }
    prev = { rows, cumNet };
  }
  const ceiling = PARAMS.sgkBounds.periods[0].ceiling;
  assert.ok(!hasWarning(run('grossNet', { mode: 'gross', gross: ceiling }), /üst sınır/), 'tavana eşit brütte uyarı olmamalı');
  assert.ok(hasWarning(run('grossNet', { mode: 'gross', gross: ceiling + 0.01 }), /üst sınır/), 'tavanı aşan brütte uyarı verilmeli');
  /* tavan üstünde SGK ve işsizlik değişmez */
  const a = rowsOf(run('grossNet', { mode: 'gross', gross: ceiling + 1000 }))[0];
  const b = rowsOf(run('grossNet', { mode: 'gross', gross: ceiling + 90000 }))[0];
  eqK(a.sgk, b.sgk);
  eqK(a.iss, b.iss);
});

test('grossNet net→brüt: net her ay sabit ve kuruşu kuruşuna tutar; her ayın brütü bağımsız doğrulanır', () => {
  const targets = [28075.5, 28075.51, 30000, 40207.53, 55555.55, 75953.03, 100000, 250000.01, 400000];
  for (const target of targets) {
    const r = run('grossNet', { mode: 'net', net: target });
    assertContract(r, `net ${target}`);
    const rows = rowsOf(r);
    assert.equal(rows.length, 12);
    assert.ok(!hasWarning(r, /eşlenemedi/), `net ${target}: kuruşu kuruşuna eşlenemeyen ay var`);
    rows.forEach((row, i) => {
      eqK(row.net, target, `net ${target}, ay ${i + 1}`);
      const chk = run('grossNet', { mode: 'gross', gross: row.gross, startMonth: String(i + 1), cumBase: row.cum - row.matrah });
      const c0 = rowsOf(chk)[0];
      eqK(c0.net, target, `net ${target}, ay ${i + 1}: bağımsız doğrulama neti`);
      eqK(c0.gv, row.gv, `net ${target}, ay ${i + 1}: GV`);
      eqK(c0.cum, row.cum, `net ${target}, ay ${i + 1}: kümülatif`);
    });
    eqK(sumOf(r, 'Aylık net ücret (sabit)'), target);
    eqK(sumOf(r, 'İlk ay brüt ücret'), rows[0].gross);
    eqK(sumOf(r, 'Son ay brüt ücret'), rows[11].gross);
    eqK(sumOf(r, 'Yıllık brüt toplam'), r.tables[0].footer.gross);
  }
  /* brütten çıkan net, netten brüte verildiğinde aynı (ya da birkaç kuruş daha düşük) brütü bulur ve aynı neti verir */
  for (const g of [33030, 41234.56, 50000, 99999.99, 250000, 297270, 350000]) {
    const net1 = rowsOf(run('grossNet', { mode: 'gross', gross: g }))[0].net;
    const back = rowsOf(run('grossNet', { mode: 'net', net: net1 }))[0];
    eqK(back.net, net1, `brüt ${g}`);
    assert.ok(k(back.gross) <= k(g) && k(g) - k(back.gross) <= 5, `brüt ${g}: gidiş-dönüş brütü ${back.gross}`);
  }
});

test('grossNet: başlangıç ayı + devreden matrah, tam yıl hesabının ilgili aylarıyla birebir aynıdır', () => {
  for (const g of [40000, 75000, 180000]) {
    const full = rowsOf(run('grossNet', { mode: 'gross', gross: g }));
    for (const start of [2, 5, 7, 10, 12]) {
      const cum0 = full[start - 2].cum;
      const part = run('grossNet', { mode: 'gross', gross: g, startMonth: String(start), cumBase: cum0 });
      const rows = rowsOf(part);
      assert.equal(rows.length, 13 - start);
      rows.forEach((row, i) => rowKeys.forEach((key) => eqK(row[key], full[start - 1 + i][key], `brüt ${g}, başlangıç ${start}, ay ${start + i}: ${key}`)));
      assert.match(part.summary[2].label, new RegExp(`^${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][start - 1]}–Aralık net toplam$`));
    }
  }
  const r = run('grossNet', { mode: 'gross', gross: 50000, startMonth: '7' });
  assert.ok(r.notes.some((n) => /devreden matrah 0/.test(n)), 'başlangıç ayı Ocak değilken devreden matrah girilmediyse not düşülmeli');
});

test('grossNet: dilim geçişleri tabloda ve notlarda görünür', () => {
  const r = run('grossNet', { mode: 'gross', gross: 100000 });
  const bands = rowsOf(r).map((row) => row.band);
  assert.ok(bands.some((b) => b.includes('→')), 'dilim geçişi (→) görünmeli');
  assert.equal(r.tables[0].columns.find((c) => c.key === 'band').label, 'Dilim');
  assert.ok(r.notes.some((n) => /sınırını aşar/.test(n)));
  /* en yüksek dilime ulaşan brüt: ücret tarifesinde son dilimin oranı %40 görünür */
  const top = run('grossNet', { mode: 'gross', gross: 1000000 });
  assert.ok(rowsOf(top).some((row) => /%40/.test(row.band)), '%40 dilimine ulaşılmalı');
});

test('employerCost: bağımsız kıyas, toplamlar, teşvik seçenekleri, destek ve SGDP', () => {
  const b = PARAMS.sgkBounds.periods[0];
  const er = PARAMS.employerRates;
  for (const g of [33030, 33030.01, 50000, 87654.32, 297270, 297270.01, 600000]) {
    for (const opt of PARAMS.employerIncentives.options) {
      const r = run('employerCost', { gross: g, incentive: opt.id });
      assertContract(r, `employerCost ${g} ${opt.id}`);
      const base = clampB(toK(g), toK(b.floor), toK(b.ceiling));
      const sgk = half(base * (toR(er.sgk) - toR(opt.points)), SC);
      const iss = half(base * toR(er.unemployment), SC);
      const total = toK(g) + sgk + iss;
      const rows = rowsOf(r);
      assert.equal(k(rows[1].monthly), Number(sgk), `${g} ${opt.id}: SGK işveren`);
      assert.equal(k(rows[2].monthly), Number(iss), `${g} ${opt.id}: işsizlik işveren`);
      assert.equal(k(sumOf(r, 'Aylık toplam işveren maliyeti')), Number(total), `${g} ${opt.id}: toplam`);
      assert.equal(k(sumOf(r, 'Yıllık toplam işveren maliyeti')), Number(total) * 12, `${g} ${opt.id}: yıllık = 12 × aylık`);
      assert.equal(k(sumOf(r, 'İşveren payları toplamı (aylık)')), Number(sgk + iss));
      near(sumOf(r, 'Brüt ücret / maliyet oranı'), Number(((g / (Number(total) / 100)) * 100).toFixed(4)) , 'brüt/maliyet oranı');
      assert.equal(rows.reduce((a, row) => a + k(row.monthly), 0), k(r.tables[0].footer.monthly), 'tablo toplamı');
      assert.equal(rows.reduce((a, row) => a + k(row.annual), 0), k(r.tables[0].footer.annual), 'yıllık tablo toplamı');
    }
  }
  /* teşvik arttıkça maliyet azalır */
  const costs = ['none', 'p2', 'p5'].map((id) => sumOf(run('employerCost', { gross: 80000, incentive: id }), 'Aylık toplam işveren maliyeti'));
  assert.ok(costs[0] > costs[1] && costs[1] > costs[2]);
  /* asgari ücret desteği: aylık 42,33 × 30 = 1.269,90 düşer; doğrulanmamış uyarısı verilir, yoksa verilmez */
  const plain = run('employerCost', { gross: 50000 });
  const sup = run('employerCost', { gross: 50000, support: true });
  eqK(sumOf(plain, 'Aylık toplam işveren maliyeti') - sumOf(sup, 'Aylık toplam işveren maliyeti'), PARAMS.minWageSupport.perDay * PARAMS.minWageSupport.days);
  assert.ok(hasWarning(sup, /destek/i) && !hasWarning(plain, /destek/i));
  /* SGDP: işsizlik payı yok, oran %24,75, teşvik uygulanmaz; uyarı verilir */
  const sg = run('employerCost', { gross: 50000, retired: true, incentive: 'p2' });
  eqK(rowsOf(sg)[1].monthly, 50000 * PARAMS.sgdp.employerRate);
  assert.ok(!rowsOf(sg).some((row) => /İşsizlik/.test(row.item)));
  assert.ok(hasWarning(sg, /SGDP/) && sg.notes.some((n) => /teşviki uygulanmaz/.test(n)));
  /* 5 puanlık indirimin bitiş tarihi bilgi notunda görünür */
  assert.ok(run('employerCost', { gross: 50000, incentive: 'p5' }).notes.some((n) => /31\.12\.2026/.test(n)));
});

test('minWage: tarih-etkili dönem seçimi, tablo toplamları, kapsam dışı tarihte uyarı', () => {
  const first = PARAMS.minWage.periods[0];
  for (const date of [first.from, '2026-06-15', first.to]) {
    const r = run('minWage', { date });
    assertContract(r, `minWage ${date}`);
    assert.equal(r.warnings.length, 0, `${date}: uyarı olmamalı`);
    eqK(sumOf(r, 'Net asgari ücret (aylık)'), first.net);
    const f = r.tables[0].footer;
    assert.equal(rowsOf(r).reduce((a, row) => a + k(row.net), 0), k(f.net));
    eqK(f.net, first.net * 12);
    assert.ok(r.tables[0].title.includes(String(PARAMS.meta.year)));
  }
  /* parametre yılı dışı: en yakın dönem + uyarı; süresi biten teşvik seçeneği gösterilmez */
  for (const date of ['2025-12-31', '2027-03-01']) {
    const r = run('minWage', { date });
    assert.ok(hasWarning(r, /verisi bulunmuyor/), `${date}: kapsam dışı uyarısı`);
    eqK(sumOf(r, 'Net asgari ücret (aylık)'), first.net);
  }
  assert.equal(rowsOf(run('minWage', { date: '2026-12-31' }), 1).length, 3);
  const after = run('minWage', { date: '2027-03-01' });
  assert.equal(rowsOf(after, 1).length, 2, '5 puanlık seçenek 31.12.2026 sonrasında gösterilmemeli');
  assert.ok(after.notes.some((n) => /yürürlükte olmadığı/.test(n)));
  runErr('minWage', { date: 'bugün' }, 'date');
  runErr('minWage', {}, 'date');
});

test('incomeTax: dilim dilim hesap, tablo toplamı = özet, ortalama/marjinal oran, kalan alan, sınırlarda süreklilik', () => {
  for (const tariff of ['wage', 'other']) {
    const list = PARAMS.incomeTax[tariff];
    for (const income of [0, 0.01, 100000, 190000, 190000.01, 400000, 999999.99, 1000000, 1250000.5, 1500000, 1500000.01, 5300000, 5300000.01, 20000000, 1e11]) {
      const r = run('incomeTax', { income, tariff });
      assertContract(r, `incomeTax ${tariff} ${income}`);
      const total = k(sumOf(r, 'Hesaplanan gelir vergisi'));
      assert.equal(total, Number(oracleTax(PARAMS, tariff, income)), `${tariff} ${income}: vergi`);
      const rows = rowsOf(r);
      assert.equal(rows.length, list.length);
      assert.equal(rows.reduce((a, row) => a + k(row.tax), 0), total, `${tariff} ${income}: dilim vergileri toplamı`);
      assert.equal(rows.reduce((a, row) => a + k(row.base), 0), k(income), `${tariff} ${income}: dilimlerdeki matrah toplamı`);
      assert.equal(k(r.tables[0].footer.tax), total);
      if (income > 0) near(sumOf(r, 'Ortalama vergi oranı'), Number(((total / k(income)) * 100).toFixed(4)), 'ortalama oran');
      else assert.equal(sumOf(r, 'Ortalama vergi oranı'), 0);
      eqK(sumOf(r, 'Vergi sonrası kalan tutar'), income - total / 100);
      /* marjinal oran ve kalan alan */
      const idx = list.findIndex((b) => b.upTo === null || income <= b.upTo);
      near(sumOf(r, 'Marjinal vergi oranı'), list[idx].rate * 100, 'marjinal oran');
      const room = r.summary.find((s) => s.label === 'Dilimde kalan alan');
      if (list[idx].upTo === null) assert.equal(room.kind, 'text');
      else eqK(room.value, list[idx].upTo - income, `${tariff} ${income}: dilimde kalan alan`);
    }
    /* sınırlarda süreklilik: ±1 kuruş vergiyi en fazla 1 kuruş değiştirir */
    for (const b of list.filter((x) => x.upTo !== null)) {
      const t = (inc) => k(sumOf(run('incomeTax', { income: inc, tariff }), 'Hesaplanan gelir vergisi'));
      const d1 = t(b.upTo) - t(b.upTo - 0.01);
      const d2 = t(b.upTo + 0.01) - t(b.upTo);
      assert.ok(d1 >= 0 && d1 <= 1 && d2 >= 0 && d2 <= 1, `${tariff} ${b.upTo}: sınırda süreksizlik (${d1}, ${d2})`);
    }
  }
  /* ücret ve ücret dışı tarifeler yalnızca 3. dilim sınırında ayrışır: 1.000.000–1.500.000 arası vergi farkı = %8 × (matrah − 1.000.000) */
  const w = k(sumOf(run('incomeTax', { income: 1250000, tariff: 'wage' }), 'Hesaplanan gelir vergisi'));
  const o = k(sumOf(run('incomeTax', { income: 1250000, tariff: 'other' }), 'Hesaplanan gelir vergisi'));
  assert.equal(o - w, Math.round(250000 * (PARAMS.incomeTax.other[3].rate - PARAMS.incomeTax.other[2].rate) * 100));
  assert.ok(run('incomeTax', { income: 190000 }).summary.find((s) => s.label === 'Bulunulan dilim').value.startsWith('1. dilim'));
  assert.ok(run('incomeTax', { income: 190000.01 }).summary.find((s) => s.label === 'Bulunulan dilim').value.startsWith('2. dilim'));
  runErr('incomeTax', { income: -1, tariff: 'wage' }, 'income');
  runErr('incomeTax', { income: 1000, tariff: 'x' }, 'tariff');
});

const OT = oracleTariff(PARAMS.incomeTax.wage);
const STAMP_R = toR(PARAMS.compensationTax.stampRate);
/** Kıdem: brüt = esas ücret × (ay/12 + gün/365 içeren yıl oranı), kuruş. */
const severanceK = (baseK, totalMonths, days) => half(baseK * BigInt(365 * totalMonths + 12 * days), 12n * 365n);
const gvOnTop = (cumTL, amountK) => half(oracleTaxScaled(OT, toK(cumTL) + amountK) - oracleTaxScaled(OT, toK(cumTL)), SC);

test('severance: hizmet süresi, tavan, oranlama, damga vergisi — bağımsız kıyas (farklı çıkış tarihleri ve dönemler)', () => {
  const cases = [
    // [çıkış, yıl, ay, gün, brüt, yan haklar]
    ['2026-09-30', 3, 6, 15, 60000, 0],
    ['2026-09-30', 1, 0, 0, 33030, 0],
    ['2026-03-31', 2, 0, 0, 80000, 5000],
    ['2026-08-14', 7, 11, 28, 120000, 3500.55],
    ['2025-06-30', 4, 2, 3, 90000, 0],
    ['2025-12-31', 12, 0, 1, 70000.5, 1234.5],
    ['2026-12-31', 25, 9, 27, 500000, 0],
    ['2026-01-15', 1, 0, 1, 64948.76, 0.01],
  ];
  for (const [end, y, m, d, gross, benefits] of cases) {
    const r = sev(end, y, m, d, gross, { benefits });
    assertContract(r, `severance ${end}`);
    const ceil = toK(periodAt(PARAMS.severance.ceilings, end).amount);
    const giy = toK(gross) + toK(benefits);
    const base = giy < ceil ? giy : ceil;
    const legal = severanceK(base, 12 * y + m, d);
    const dv = half(legal * STAMP_R, SC);
    const ctx = `${end} ${y}y${m}a${d}g ${gross}+${benefits}`;
    assert.equal(k(sumOf(r, 'Brüt kıdem tazminatı')), Number(legal), `${ctx}: brüt`);
    assert.equal(k(sumOf(r, 'Damga vergisi')), Number(dv), `${ctx}: damga`);
    eqK(sumOf(r, 'Gelir vergisi'), 0, `${ctx}: GV`);
    assert.equal(k(sumOf(r, 'Net kıdem tazminatı')), Number(legal - dv), `${ctx}: net`);
    assert.equal(k(sumOf(r, 'Hesaba esas aylık ücret')), Number(base), `${ctx}: esas ücret`);
    assert.equal(sumOf(r, 'Hizmet süresi'), `${y} yıl ${m} ay ${d} gün`);
    assert.equal(hasWarning(r, /hesapta tavan uygulandı/), giy > ceil, `${ctx}: tavan uyarısı`);
    assert.equal(rowsOf(r).reduce((a, row) => a + k(row.amount), 0), k(r.tables[0].footer.amount), `${ctx}: tablo toplamı`);
  }
});

test('severance: tavan çıkış tarihine göre seçilir (her dönemin ilk ve son günü); dönem dışı tarih', () => {
  for (const c of PARAMS.severance.ceilings) {
    for (const end of [c.from, c.to]) {
      const high = sev(end, 1, 0, 0, 10000000);
      eqK(stepOf(high, 'Kıdem tazminatı tavanı'), c.amount, `${end}: tavan`);
      eqK(sumOf(high, 'Brüt kıdem tazminatı'), c.amount, `${end}: bir yıllık tazminat = tavan`);
      assert.ok(hasWarning(high, /hesapta tavan uygulandı/), `${end}: tavan uyarısı`);
      const low = sev(end, 1, 0, 0, 1000);
      eqK(sumOf(low, 'Brüt kıdem tazminatı'), 1000, `${end}: tavan altı`);
      assert.ok(!hasWarning(low, /tavan/), `${end}: tavan altında uyarı olmamalı`);
    }
  }
  const last = PARAMS.severance.ceilings[PARAMS.severance.ceilings.length - 1];
  const after = sev('2027-02-10', 10, 0, 0, 10000000);
  eqK(stepOf(after, 'Kıdem tazminatı tavanı'), last.amount);
  assert.ok(hasWarning(after, /son açıklanan tavan/), 'açıklanmamış döneme ait çıkış tarihinde son tavan + uyarı');
  runErr('severance', { start: '2015-01-01', end: '2024-12-31', gross: 50000 }, 'end');
});

test('severance: bir yıldan kısa hizmette tazminat doğmaz; tam bir yılda doğar', () => {
  const short = sev('2026-09-30', 0, 11, 29, 50000);
  eqK(sumOf(short, 'Brüt kıdem tazminatı'), 0);
  eqK(sumOf(short, 'Net kıdem tazminatı'), 0);
  assert.ok(hasWarning(short, /yıldan kısa/));
  const full = sev('2026-09-30', 1, 0, 0, 50000);
  eqK(sumOf(full, 'Brüt kıdem tazminatı'), 50000);
  assert.ok(!hasWarning(full, /yıldan kısa/));
});

test('severance: yasal tutarın üzerindeki ödeme ücret gibi vergilenir (devreden matrah), damga vergisi toplam tutar üzerinden', () => {
  const end = '2026-09-30';
  const legal = toK(250000); // 5 yıl × 50.000 ₺
  for (const [extra, cum] of [[100000, 0], [250000, 150000], [1000000, 300000], [0.01, 189999.99]]) {
    const r = sev(end, 5, 0, 0, 50000, { extra, cumBase: cum });
    assertContract(r, `extra ${extra}`);
    const gv = gvOnTop(cum, toK(extra));
    const dv = half((legal + toK(extra)) * STAMP_R, SC);
    assert.equal(k(sumOf(r, 'Gelir vergisi')), Number(gv), `extra ${extra}, devreden ${cum}: GV`);
    assert.equal(k(sumOf(r, 'Damga vergisi')), Number(dv), `extra ${extra}: damga`);
    eqK(sumOf(r, 'Toplam brüt tutar'), 250000 + extra);
    assert.equal(k(sumOf(r, 'Net kıdem tazminatı')), Number(legal + toK(extra) - gv - dv), `extra ${extra}: net`);
  }
  /* devreden matrah yalnızca yasal tutarı aşan kısmın vergisini etkiler */
  const a = sev(end, 5, 0, 0, 50000, { cumBase: 500000 });
  eqK(sumOf(a, 'Gelir vergisi'), 0);
});

test('notice: ihbar süresi bandı (ay/gün sınırları), tutar, gelir vergisi, damga vergisi — bağımsız kıyas', () => {
  const weeksFor = (months, days) => (months < 6 ? 2 : months < 18 ? 4 : months < 36 || (months === 36 && days === 0) ? 6 : 8);
  const end = '2026-08-15';
  let n = 0;
  for (let months = 0; months <= 60; months++) {
    for (const d of [0, 1, 15]) {
      if (months === 0 && d === 0) continue;
      const y = Math.floor(months / 12);
      const m = months % 12;
      const r = run('notice', { start: startFor(end, y, m, d), end, gross: 45000, benefits: 1500.5 });
      const w = weeksFor(months, d);
      assert.equal(stepOf(r, 'İhbar süresi (hafta)'), w, `${months} ay ${d} gün → ${w} hafta`);
      assert.equal(hasWarning(r, /sınır yorumu/), d === 0 && [6, 18, 36].includes(months), `${months} ay ${d} gün: sınır uyarısı`);
      n++;
    }
  }
  assert.equal(n, 61 * 3 - 1);
  for (const cum of [0, 189000, 399000, 1499000, 5299000]) {
    for (const [months, d] of [[3, 2], [10, 0], [26, 9], [48, 1]]) {
      const y = Math.floor(months / 12);
      const r = run('notice', { start: startFor(end, y, months % 12, d), end, gross: 45000, benefits: 1500.5, cumBase: cum });
      assertContract(r, `notice ${months} ay`);
      const days = weeksFor(months, d) * 7;
      const amount = half((toK(45000) + toK(1500.5)) * BigInt(days), 30n);
      const gv = gvOnTop(cum, amount);
      const dv = half(amount * STAMP_R, SC);
      assert.equal(k(sumOf(r, 'İhbar tazminatı (brüt)')), Number(amount), `${months} ay, devreden ${cum}: brüt`);
      assert.equal(k(sumOf(r, 'Gelir vergisi')), Number(gv), `${months} ay, devreden ${cum}: GV`);
      assert.equal(k(sumOf(r, 'Damga vergisi')), Number(dv), `${months} ay: damga`);
      assert.equal(k(sumOf(r, 'Net ihbar tazminatı')), Number(amount - gv - dv), `${months} ay, devreden ${cum}: net`);
      assert.equal(k(sumOf(r, 'Günlük brüt ücret')), Number(half(toK(45000) + toK(1500.5), 30n)), 'günlük ücret');
      assert.equal(rowsOf(r).reduce((a, row) => a + k(row.amount), 0), k(r.tables[0].footer.amount), 'tablo toplamı');
      assert.ok(hasWarning(r, /ikincil/), 'vergi uygulaması ikincil kaynaklara dayanır');
    }
  }
  /* kıdem tavanı ihbar tazminatına uygulanmaz */
  const big = run('notice', { start: startFor(end, 5), end, gross: 1000000 });
  eqK(sumOf(big, 'İhbar tazminatı (brüt)'), (1000000 / 30) * 56);
});

test('severance / notice: hata davranışı (sıra dışı tarih, geçersiz ücret)', () => {
  for (const engine of ['severance', 'notice']) {
    runErr(engine, { start: '2026-05-01', end: '2026-04-01', gross: 50000 }, 'end');
    runErr(engine, { start: 'x', end: '2026-04-01', gross: 50000 }, 'start');
    runErr(engine, { start: '2020-01-01', end: '2026-02-30', gross: 50000 }, 'end');
    runErr(engine, { start: '2020-01-01', end: '2026-04-01', gross: 0 }, 'gross');
    runErr(engine, { start: '2020-01-01', end: '2026-04-01', gross: -5 }, 'gross');
    runErr(engine, { start: '2020-01-01', end: '2026-04-01' }, 'gross');
    runErr(engine, { start: '2020-01-01', end: '2026-04-01', gross: 5000, benefits: -1 }, 'benefits');
    runErr(engine, { start: '2020-01-01', end: '2026-04-01', gross: 5000, cumBase: -1 }, 'cumBase');
    /* gün sayısı: başlangıç = bitiş aynı gün → 1 günlük hizmet (çıkış günü dahil) */
    assert.ok(!calculate(engine, { start: '2026-04-01', end: '2026-04-01', gross: 5000 }, PARAMS).error);
  }
});

test('grossNet / employerCost: hata davranışı ve alan adları', () => {
  const floor = PARAMS.sgkBounds.periods[0].floor;
  runErr('grossNet', { mode: 'gross', gross: floor - 0.01 }, 'gross');
  runErr('grossNet', { mode: 'gross', gross: 'abc' }, 'gross');
  runErr('grossNet', { mode: 'gross', gross: -100 }, 'gross');
  runErr('grossNet', { mode: 'gross', gross: 2e9 }, 'gross');
  runErr('grossNet', { mode: 'gross' }, 'gross');
  runErr('grossNet', { mode: 'sideways', gross: 50000 }, 'mode');
  runErr('grossNet', { mode: 'gross', gross: 50000, startMonth: '13' }, 'startMonth');
  runErr('grossNet', { mode: 'gross', gross: 50000, startMonth: '0' }, 'startMonth');
  runErr('grossNet', { mode: 'gross', gross: 50000, cumBase: -1 }, 'cumBase');
  runErr('grossNet', { mode: 'net', net: 20000 }, 'net');
  runErr('grossNet', { mode: 'net', net: 20000, retired: true }, 'net');
  runErr('grossNet', { mode: 'net' }, 'net');
  runErr('employerCost', { gross: floor - 1 }, 'gross');
  runErr('employerCost', { gross: 50000, incentive: 'p9' }, 'incentive');
  runErr('employerCost', {}, 'gross');
  /* varsayılanlar: mode boşsa brütten nete, startMonth boşsa Ocak */
  assert.equal(rowsOf(run('grossNet', { gross: 50000 })).length, 12);
  /* bilinmeyen motor ve geçersiz parametre dosyası */
  assert.ok(calculate('yok', {}, PARAMS).error);
  assert.ok(calculate('grossNet', { gross: 50000 }, null).error);
  const broken = clone(PARAMS);
  delete broken.incomeTax;
  const r = calculate('grossNet', { gross: 50000 }, broken);
  assert.ok(r.error && r.debug === undefined, `eksik parametre bölümü InputError olmalı: ${r.debug || r.error}`);
});

test('rastgele ve bozuk girdilerde yalnızca geçerli sonuç ya da { error } döner; başka istisna sızmaz', () => {
  let a = 20261001; // sabit tohum (tekrarlanabilir)
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const pool = [undefined, null, '', ' ', 'abc', '1e309', -1, 0, 0.004, 0.01, 1, 33029.99, 33030, 50000, 123456.789, 1e6, 1e9, 1e9 + 1, 1e11, 1e12, NaN, Infinity, -Infinity, '1.234,56', '40.000', true, false, [], {}, '2026-10-01', '2026-02-30', '2026-13-01', '1949-12-31', '2101-01-01', '2020-01-01', '2026-12-31', '0000-00-00', 'today'];
  const fields = {
    grossNet: { mode: ['gross', 'net', 'x'], gross: 0, net: 0, startMonth: ['1', '7', '12', '0', '13', 'a'], cumBase: 0, retired: 0 },
    employerCost: { gross: 0, incentive: ['none', 'p2', 'p5', 'zz'], support: 0, retired: 0 },
    minWage: { date: 0 },
    incomeTax: { income: 0, tariff: ['wage', 'other', 'z'] },
    severance: { start: 0, end: 0, gross: 0, benefits: 0, extra: 0, cumBase: 0 },
    notice: { start: 0, end: 0, gross: 0, benefits: 0, cumBase: 0 },
  };
  const valid = {
    grossNet: { mode: 'gross', gross: 50000 },
    employerCost: { gross: 50000, incentive: 'p2' },
    minWage: { date: '2026-10-01' },
    incomeTax: { income: 900000, tariff: 'wage' },
    severance: { start: '2018-01-01', end: '2026-09-30', gross: 60000 },
    notice: { start: '2023-01-01', end: '2026-09-30', gross: 60000 },
  };
  let ok = 0;
  let err = 0;
  for (const [engine, spec] of Object.entries(fields)) {
    for (let i = 0; i < 1200; i++) {
      const inputs = i % 2 ? { ...valid[engine] } : {};
      const names = Object.keys(spec);
      const touch = i % 2 ? 1 + Math.floor(rnd() * 2) : names.length;
      for (let j = 0; j < touch; j++) {
        const f = pick(names);
        if (rnd() < 0.1) delete inputs[f];
        else inputs[f] = Array.isArray(spec[f]) && rnd() < 0.7 ? pick(spec[f]) : pick(pool);
      }
      const r = calculate(engine, inputs, PARAMS);
      assert.equal(r.debug, undefined, `${engine}: beklenmeyen istisna "${r.debug}" — girdi: ${JSON.stringify(inputs)}`);
      if (r.error) {
        err++;
        assert.ok(typeof r.error === 'string' && r.error.length > 8, `${engine}: hata iletisi anlamlı olmalı`);
      } else {
        ok++;
        assertContract(r, `${engine} ${JSON.stringify(inputs)}`);
      }
    }
  }
  assert.ok(ok > 500 && err > 500, `fuzz dengesi: ${ok} geçerli, ${err} hatalı`);
});

/* ===================================================================================
   4) "KODDA YIL / ORAN / LİMİT GÖMÜLÜ DEĞİL": sentetik 2027 parametreleri ve yıl içi revizyon
   =================================================================================== */
const P27 = (() => {
  const P = clone(PARAMS);
  P.meta = { id: '2027-bordro', year: 2027, verifiedOn: '2027-01-10', notes: 'sentetik test parametreleri' };
  P.incomeTax.from = '2027-01-01';
  P.incomeTax.to = '2027-12-31';
  P.incomeTax.wage = [{ upTo: 230000, rate: 0.15 }, { upTo: 480000, rate: 0.2 }, { upTo: 1800000, rate: 0.27 }, { upTo: 6400000, rate: 0.35 }, { upTo: null, rate: 0.4 }];
  P.incomeTax.other = [{ upTo: 230000, rate: 0.15 }, { upTo: 480000, rate: 0.2 }, { upTo: 1200000, rate: 0.27 }, { upTo: 6400000, rate: 0.35 }, { upTo: null, rate: 0.4 }];
  P.revaluation = { ...P.revaluation, year: 2027, rate: 0.19 };
  P.minWage.periods = [{ from: '2027-01-01', to: '2027-12-31', gross: 41000, net: 34850, daily: 1366.67 }];
  P.sgkBounds.periods = [{ from: '2027-01-01', to: '2027-12-31', floor: 41000, ceiling: 369000 }];
  P.employerRates = { ...P.employerRates, sgk: 0.2275 };
  P.employerIncentives.options = [
    { id: 'none', label: 'Teşviksiz', points: 0 },
    { id: 'p2', label: '2 puan indirim (imalat dışı)', points: 0.02, from: '2027-01-01' },
    { id: 'p3', label: '3 puan indirim (yeni)', points: 0.03, from: '2027-01-01', to: '2027-12-31' },
  ];
  P.severance.ceilings = [{ from: '2027-01-01', to: '2027-06-30', amount: 80000 }, { from: '2027-07-01', to: '2027-12-31', amount: 90000 }];
  return P;
})();
const strings = (o, acc = []) => {
  if (typeof o === 'string') acc.push(o);
  else if (Array.isArray(o)) o.forEach((x) => strings(x, acc));
  else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, acc));
  return acc;
};

test('sentetik 2027 parametreleri: tüm motorlar değerleri params dosyasından okur (kıyas uygulamasıyla aynı sonuç)', () => {
  /* maaş: yeni asgari ücret, PEK sınırları ve tarife ile */
  for (const g of [41000, 41000.5, 60000, 100000, 369000, 400000, 1200000])
    for (const start of [1, 7]) {
      const r = run('grossNet', { mode: 'gross', gross: g, startMonth: String(start), cumBase: start === 1 ? 0 : 111111.11 }, P27);
      const o = oracleYear(P27, g, { startMonth: start, cum0: start === 1 ? 0 : 111111.11 });
      rowsOf(r).forEach((row, i) => rowKeys.forEach((key) => assert.equal(k(row[key]), Number(o[i][key]), `2027 brüt ${g}, ay ${o[i].m}: ${key}`)));
      assert.equal(r.paramsUsed.id, '2027-bordro');
      assert.ok(r.tables[0].title.includes(start === 1 ? '2027' : 'Temmuz'));
    }
  /* net → brüt */
  const net = run('grossNet', { mode: 'net', net: 52000 }, P27);
  rowsOf(net).forEach((row, i) => eqK(row.net, 52000, `2027 net→brüt ay ${i + 1}`));
  runErr('grossNet', { mode: 'gross', gross: 40999.99 }, 'gross', P27); // 2027 alt sınırının altında
  /* asgari ücret */
  const mw = run('minWage', { date: '2027-03-15' }, P27);
  eqK(sumOf(mw, 'Brüt asgari ücret (aylık)'), 41000);
  eqK(sumOf(mw, 'Net asgari ücret (aylık)'), 34850);
  rowsOf(mw).forEach((row) => eqK(row.net, 34850));
  assert.equal(mw.warnings.length, 0, mw.warnings.join(' | '));
  assert.ok(mw.tables[0].title.includes('2027'));
  assert.equal(rowsOf(mw, 1).length, 3, 'yeni teşvik seçeneği (p3) tabloda görünmeli');
  /* işveren maliyeti: yeni oran ve yeni teşvik seçeneği */
  const ec = run('employerCost', { gross: 60000, incentive: 'p3' }, P27);
  eqK(rowsOf(ec)[1].monthly, 60000 * (0.2275 - 0.03));
  eqK(rowsOf(ec)[2].monthly, 60000 * 0.02);
  assert.ok(ec.notes.some((n) => /31\.12\.2027/.test(n)));
  runErr('employerCost', { gross: 60000, incentive: 'p5' }, 'incentive', P27); // p5 artık yok
  /* gelir vergisi: yeni dilimler (elle hesap) */
  eqK(sumOf(run('incomeTax', { income: 300000, tariff: 'wage' }, P27), 'Hesaplanan gelir vergisi'), 230000 * 0.15 + 70000 * 0.2);
  eqK(sumOf(run('incomeTax', { income: 1000000, tariff: 'other' }, P27), 'Hesaplanan gelir vergisi'), 230000 * 0.15 + 250000 * 0.2 + 520000 * 0.27);
  assert.ok(run('incomeTax', { income: 1000000 }, P27).notes.some((n) => /%19/.test(n)), 'yeniden değerleme oranı params\'tan okunur');
  /* kıdem: çıkış tarihine göre yeni tavan */
  eqK(stepOf(sev('2027-02-10', 1, 0, 0, 1000000, {}, P27), 'Kıdem tazminatı tavanı'), 80000);
  eqK(stepOf(sev('2027-08-01', 1, 0, 0, 1000000, {}, P27), 'Kıdem tazminatı tavanı'), 90000);
  eqK(sumOf(sev('2027-08-01', 2, 6, 0, 1000000, {}, P27), 'Brüt kıdem tazminatı'), 90000 * 2.5);
  /* ihbar: yeni tarife */
  const nt = run('notice', { start: startFor('2027-05-15', 2, 0, 0), end: '2027-05-15', gross: 30000, cumBase: 200000 }, P27);
  const gv27 = (cum, amt) => {
    const T27 = oracleTariff(P27.incomeTax.wage);
    return half(oracleTaxScaled(T27, toK(cum) + amt) - oracleTaxScaled(T27, toK(cum)), SC);
  };
  assert.equal(k(sumOf(nt, 'Gelir vergisi')), Number(gv27(200000, toK(30000 * 1.4))), 'ihbar GV (6 hafta = 42 gün)');
  /* hiçbir metin parametre yılı olan 2026'yı taşımaz */
  for (const r of [mw, ec, nt, net]) for (const s of strings(r)) assert.ok(!/2026/.test(s), `2027 sonucunda 2026 geçmemeli: ${s}`);
});

test('yıl içi asgari ücret revizyonu (Temmuz): dönemler, SGK sınırları ve istisnalar yeniden hesaplanır', () => {
  const PMID = clone(PARAMS);
  PMID.minWage.periods = [
    { from: '2026-01-01', to: '2026-06-30', gross: 33030, net: 28075.5, daily: 1101 },
    { from: '2026-07-01', to: '2026-12-31', gross: 40000, net: 34000, daily: 1333.33 },
  ];
  PMID.sgkBounds.periods = [
    { from: '2026-01-01', to: '2026-06-30', floor: 33030, ceiling: 297270 },
    { from: '2026-07-01', to: '2026-12-31', floor: 40000, ceiling: 360000 },
  ];
  const early = run('minWage', { date: '2026-03-15' }, PMID);
  const late = run('minWage', { date: '2026-09-15' }, PMID);
  eqK(sumOf(early, 'Brüt asgari ücret (aylık)'), 33030);
  eqK(sumOf(late, 'Brüt asgari ücret (aylık)'), 40000);
  eqK(sumOf(early, 'Net asgari ücret (aylık)'), 28075.5);
  eqK(sumOf(late, 'Net asgari ücret (aylık)'), 34000);
  eqK(sumOf(late, 'Günlük brüt asgari ücret'), 1333.33);
  assert.equal(early.warnings.length + late.warnings.length, 0, `uyarı olmamalı: ${[...early.warnings, ...late.warnings].join(' | ')}`);
  const o = oracleYear(PMID, 40000);
  const rows = rowsOf(late);
  rows.forEach((row, i) => {
    eqK(row.gross, i < 6 ? 33030 : 40000, `ay ${i + 1} brüt`);
    eqK(row.net, i < 6 ? 28075.5 : 34000, `ay ${i + 1} net`);
    assert.equal(k(row.gvIst), Number(o[i].exGV), `ay ${i + 1} GV istisnası`);
    eqK(row.gvGross, row.gvIst, `ay ${i + 1}: hesaplanan GV = istisna`);
  });
  /* 40.000 ₺ asgari ücretin istisnası, ilk altı ay 33.030 ₺ ile birikmiş matraha göre ayrı hesaplanır (toplu kümülatif) */
  assert.notEqual(k(rows[6].gvIst), k(rowsOf(run('minWage', { date: '2026-03-15' }))[6].gvIst));
  /* maaş: dönem içi değişen sınırlar ve istisnalarla bağımsız kıyas */
  for (const g of [40000, 50000, 120000, 300000, 370000]) {
    const r = run('grossNet', { mode: 'gross', gross: g }, PMID);
    const oo = oracleYear(PMID, g);
    rowsOf(r).forEach((row, i) => rowKeys.forEach((key) => assert.equal(k(row[key]), Number(oo[i][key]), `revizyon brüt ${g}, ay ${i + 1}: ${key}`)));
  }
  runErr('grossNet', { mode: 'gross', gross: 35000, startMonth: '7' }, 'gross', PMID); // Temmuz'dan itibaren alt sınır 40.000
  assert.ok(!calculate('grossNet', { mode: 'gross', gross: 35000, startMonth: '3' }, PMID).error);
});

test('needsVerification: bayraklı parametre sonuca uyarı ekler; bayrak ve uyarı kaldırılınca uyarı kaybolur', () => {
  const cases = [
    ['compensationTax', 'severance', { start: '2016-10-01', end: '2026-09-30', gross: 40000 }],
    ['compensationTax', 'notice', { start: '2023-01-01', end: '2026-09-30', gross: 40000 }],
    ['sgdp', 'grossNet', { gross: 50000, retired: true }],
    ['sgdp', 'employerCost', { gross: 50000, retired: true }],
    ['minWageSupport', 'employerCost', { gross: 50000, support: true }],
  ];
  for (const [key, engine, inputs] of cases) {
    const P = clone(PARAMS);
    const before = run(engine, inputs, P);
    assert.ok(before.warnings.includes(PARAMS[key].warning), `${engine}: ${key} uyarısı sonuçta görünmeli`);
    delete P[key].needsVerification;
    delete P[key].warning;
    const after = run(engine, inputs, P);
    assert.ok(!after.warnings.includes(PARAMS[key].warning), `${engine}: bayrak kalkınca ${key} uyarısı kalmamalı`);
  }
  /* bayraksız kullanımda uyarı yok: emekli değil, destek seçilmedi */
  assert.equal(run('grossNet', { gross: 50000 }).warnings.length, 0);
  assert.equal(run('employerCost', { gross: 50000 }).warnings.length, 0);
  assert.equal(run('incomeTax', { income: 1000000 }).warnings.length, 0);
});

test('motor kaynağı: yıl, oran ve limit gömülü değil; yalnızca ../util.mjs içe aktarılır; Node/Date API kullanılmaz', () => {
  const src = readText('src/calc/engines/payroll.mjs');
  const imports = [...src.matchAll(/^\s*import\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../util.mjs'], 'yalnızca ../util.mjs içe aktarılabilir');
  assert.doesNotMatch(src, /\bimport\s*\(/, 'dinamik import yok');
  assert.doesNotMatch(src, /\brequire\s*\(/, 'require yok');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
  for (const re of [/Date\.now/, /new\s+Date/, /\bDate\s*\(/, /\bprocess\b/, /Math\.random/, /\bfetch\s*\(/, /localStorage/, /\bdocument\b/, /\bwindow\b/, /\bfs\b/, /\bBuffer\b/]) {
    assert.doesNotMatch(code, re, `yasak API: ${re}`);
  }
  assert.doesNotMatch(code, /\b202\d\b/, 'parametre yılı (202x) motorda gömülü olmamalı');
  assert.doesNotMatch(code, /(?<![\w.])\d+\.\d+(?![\w])/, 'kodda ondalık sabit (oran/tutar) olmamalı');
  for (const n of ['33030', '28075', '297270', '1101', '0.2175', '21.75', '0.00759', '7.59', '73729', '64948', '53919', '46655', '190000', '400000', '1500000', '5300000', '1000000', '4211', '4537', '5615', '250.7', '42.33', '0.2549', '25.49', '0.075', '0.2475']) {
    assert.ok(!new RegExp(`(?<![\\w.])${n.replace('.', '\\.')}(?![\\w.])`).test(code), `araştırmadan gelen sayı kodda gömülü olmamalı: ${n}`);
  }
  assert.ok(Object.keys(ALL_ENGINES).length >= 6);
  for (const id of ['grossNet', 'employerCost', 'minWage', 'incomeTax', 'severance', 'notice']) assert.equal(typeof ALL_ENGINES[id], 'function', `core.mjs ENGINES içinde ${id} yok`);
});

/* ===================================================================================
   5) HESAPLAYICI TANIMLARI (src/data/calculators-bordro.json) — sözleşme denetimleri
   =================================================================================== */
const DEFS = readJSON('src/data/calculators-bordro.json');
const ALL_SLUGS = [
  'maas-hesaplama', 'isveren-maliyeti-hesaplama', 'asgari-ucret-hesaplama', 'gelir-vergisi-hesaplama', 'kdv-hesaplama', 'kurumlar-vergisi-hesaplama',
  'gecici-vergi-hesaplama', 'serbest-meslek-makbuzu-hesaplama', 'kidem-tazminati-hesaplama', 'ihbar-tazminati-hesaplama', 'gecikme-zammi-hesaplama',
];
const SERVICE_IDS = new Set((CONTENT.services || []).map((s) => s.id));
const ENGINE_INPUTS = {
  grossNet: ['mode', 'gross', 'net', 'startMonth', 'cumBase', 'retired'],
  employerCost: ['gross', 'incentive', 'support', 'retired'],
  minWage: ['date'],
  incomeTax: ['income', 'tariff'],
  severance: ['start', 'end', 'gross', 'benefits', 'extra', 'cumBase'],
  notice: ['start', 'end', 'gross', 'benefits', 'cumBase'],
};
const OWN = { 1: 'maas-hesaplama', 2: 'isveren-maliyeti-hesaplama', 3: 'asgari-ucret-hesaplama', 4: 'gelir-vergisi-hesaplama', 9: 'kidem-tazminati-hesaplama', 10: 'ihbar-tazminati-hesaplama' };
const GROUPS = { 'maas-hesaplama': 'bordro', 'isveren-maliyeti-hesaplama': 'bordro', 'asgari-ucret-hesaplama': 'bordro', 'gelir-vergisi-hesaplama': 'vergi', 'kidem-tazminati-hesaplama': 'tazminat', 'ihbar-tazminati-hesaplama': 'tazminat' };
const ENGINE_OF = { 'maas-hesaplama': 'grossNet', 'isveren-maliyeti-hesaplama': 'employerCost', 'asgari-ucret-hesaplama': 'minWage', 'gelir-vergisi-hesaplama': 'incomeTax', 'kidem-tazminati-hesaplama': 'severance', 'ihbar-tazminati-hesaplama': 'notice' };
/** Yasak ifadeler (Unicode sınırlı: "kesinti" yanlış eşleşmez). */
const FORBIDDEN = /(?<![\p{L}\p{N}])(en iyi|lider\p{L}*|garanti\p{L}*|kesin sonuç\p{L}*|hızlı\p{L}*|ücretsiz teklif\p{L}*)(?![\p{L}\p{N}])/iu;
const ASCII_TURKISH = /(?<![\p{L}\p{N}-])(ucret\p{L}*|maas\p{L}*|isveren\p{L}*|kidem|gecici|odeme\p{L}*|yillik|aylik|hesaplayici\p{L}*|tazminati)(?![\p{L}\p{N}-])/iu;

function resolveToken(v, today = TODAY) {
  if (typeof v !== 'string') return v;
  const m = /^today(?:([+-])(\d+)([dmy]))?$/.exec(v);
  if (!m) return v;
  if (!m[1]) return today;
  const n = (m[1] === '-' ? -1 : 1) * Number(m[2]);
  return m[3] === 'd' ? addDays(today, n) : m[3] === 'm' ? addMonths(today, n) : addMonths(today, 12 * n);
}
const defaultsOf = (def, today = TODAY) => Object.fromEntries(def.inputs.map((i) => [i.id, resolveToken(i.default, today)]));
/** Görünür metinler (URL, slug ve kimlikler hariç). */
function visibleStrings(def) {
  const out = [def.title, def.short, def.description, def.lead, def.disclaimer];
  for (const i of def.inputs) out.push(i.label, i.help, i.unit, i.group, ...(i.options || []).flatMap((o) => [o.label, o.help]));
  for (const p of def.presets) out.push(p.label);
  for (const e of def.explain) out.push(e.heading, ...e.paragraphs);
  out.push(...def.assumptions);
  for (const [q, a] of def.faq) out.push(q, a);
  for (const [label] of def.sources) out.push(label);
  return out.filter((s) => typeof s === 'string');
}

test('tanım dosyası: 6 hesaplayıcı (sıra 1, 2, 3, 4, 9, 10), benzersiz slug ve sıra, doğru grup/motor/params', () => {
  assert.ok(Array.isArray(DEFS));
  assert.equal(DEFS.length, 6);
  assert.deepEqual(DEFS.map((d) => d.order), [1, 2, 3, 4, 9, 10]);
  assert.deepEqual(DEFS.map((d) => d.slug), Object.values(OWN));
  for (const d of DEFS) {
    assert.ok(ALL_SLUGS.includes(d.slug), `${d.slug}: 11 hesaplayıcıdan biri olmalı`);
    assert.equal(OWN[d.order], d.slug);
    assert.equal(d.group, GROUPS[d.slug], `${d.slug}: grup`);
    assert.equal(d.engine, ENGINE_OF[d.slug], `${d.slug}: motor`);
    assert.equal(d.params, 'bordro', `${d.slug}: params`);
    assert.equal(typeof ALL_ENGINES[d.engine], 'function', `${d.slug}: motor core.mjs ENGINES içinde yok`);
    assert.equal(d.updated, PARAMS.meta.verifiedOn, `${d.slug}: updated, parametrelerin doğrulandığı tarih olmalı`);
    assert.match(d.updated, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(new Set(DEFS.map((d) => d.slug)).size, DEFS.length);
  assert.ok(fs.existsSync(path.join(ROOT, 'src/data/params', `${PARAMS.meta.year}-${DEFS[0].params}.json`)), 'params dosyası <yıl>-<alan>.json biçiminde var olmalı');
});

test('tanımlar: metin uzunlukları ve madde sayıları sözleşme sınırları içinde', () => {
  for (const d of DEFS) {
    const w = d.slug;
    const lim = (key, max) => {
      assert.ok(typeof d[key] === 'string' && d[key].trim().length > 0, `${w}: ${key} boş`);
      assert.ok(d[key].length <= max, `${w}: ${key} ${d[key].length} > ${max} karakter`);
    };
    lim('title', 48);
    lim('short', 110);
    lim('description', 155);
    lim('lead', 300);
    assert.ok(d.disclaimer.trim().length >= 40 && /[.!]$/.test(d.disclaimer.trim()), `${w}: disclaimer en az bir tam cümle olmalı`);
    assert.ok(d.explain.length >= 2 && d.explain.length <= 4, `${w}: explain 2–4 blok`);
    for (const e of d.explain) {
      assert.ok(e.heading && e.heading.length <= 80, `${w}: explain başlığı`);
      assert.ok(e.paragraphs.length >= 1 && e.paragraphs.every((p) => typeof p === 'string' && p.length > 30 && p.length <= 700), `${w}: explain paragrafı (30–700 karakter)`);
    }
    assert.ok(d.assumptions.length >= 3 && d.assumptions.length <= 7, `${w}: assumptions 3–7 madde`);
    assert.ok(d.assumptions.every((a) => typeof a === 'string' && a.length > 20 && a.length <= 400), `${w}: varsayım uzunluğu`);
    assert.ok(d.faq.length >= 3 && d.faq.length <= 5, `${w}: faq 3–5 çift`);
    for (const pair of d.faq) {
      assert.ok(Array.isArray(pair) && pair.length === 2 && pair.every((s) => typeof s === 'string' && s.trim()), `${w}: faq çifti`);
      assert.ok(pair[0].endsWith('?'), `${w}: soru "?" ile bitmeli: ${pair[0]}`);
      assert.ok(pair[1].length <= 500, `${w}: cevap ≤ 500 karakter`);
    }
    assert.ok(d.sources.length >= 1 && d.sources.length <= 4, `${w}: kaynak sayısı`);
    for (const [label, url] of d.sources) {
      assert.ok(label && url && /^https:\/\//.test(url), `${w}: kaynak biçimi (${label})`);
      assert.ok(/\.(gov\.tr|org\.tr)\//.test(url), `${w}: kaynak resmî bir sitede olmalı: ${url}`);
    }
    assert.ok(d.related.length >= 2 && d.related.length <= 3, `${w}: related 2–3 slug`);
    assert.ok(d.related.every((s) => ALL_SLUGS.includes(s) && s !== d.slug), `${w}: related slug'ları 11'in içinde ve kendisi olmayan`);
    assert.ok(d.relatedServices.length >= 1 && d.relatedServices.length <= 3, `${w}: relatedServices 1–3`);
    assert.ok(d.relatedServices.every((s) => SERVICE_IDS.has(s)), `${w}: relatedServices id'leri content.json'da olmalı`);
    assert.ok(d.presets.length <= 4, `${w}: preset ≤ 4`);
    for (const p of d.presets) assert.ok(p.label && p.label.length <= 40 && p.values && typeof p.values === 'object', `${w}: preset biçimi`);
  }
});

test('tanımlar: girdi kimlikleri benzersiz ve motorun tanıdığı alanlar; showIf, seçenekler, varsayılanlar tutarlı', () => {
  for (const d of DEFS) {
    const w = d.slug;
    const ids = d.inputs.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${w}: yinelenen girdi kimliği`);
    for (const id of ids) assert.ok(ENGINE_INPUTS[d.engine].includes(id), `${w}: "${id}" girdisini ${d.engine} motoru tanımıyor`);
    assert.ok(d.inputs.filter((i) => !i.group).length <= 6, `${w}: görünür girdi ≤ 6`);
    assert.ok(d.inputs.filter((i) => !i.group).length >= 1, `${w}: görünür girdi yok`);
    assert.ok(new Set(d.inputs.filter((i) => i.group).map((i) => i.group)).size <= 1, `${w}: gelişmiş girdiler tek grupta olmalı`);
    for (const i of d.inputs) {
      const at = `${w}.${i.id}`;
      assert.ok(['money', 'number', 'select', 'segment', 'checkbox', 'date'].includes(i.type), `${at}: tür`);
      assert.ok(i.label && i.label.length <= 80, `${at}: etiket`);
      if (i.help !== undefined) assert.ok(i.help.length > 0 && i.help.length <= 140, `${at}: help ≤ 140 karakter (${i.help.length})`);
      assert.ok(i.default !== null && i.default !== undefined, `${at}: varsayılan değer olmalı (null olamaz)`);
      if (i.type === 'date') {
        assert.match(String(i.default), /^(\d{4}-\d{2}-\d{2}|today([+-]\d+[dmy])?)$/, `${at}: tarih varsayılanı ISO tarih ya da today±N(d|m|y) olmalı`);
        assert.match(resolveToken(i.default), /^\d{4}-\d{2}-\d{2}$/);
      } else assert.ok(!(typeof i.default === 'string' && /^today/.test(i.default)), `${at}: jeton yalnızca tarih alanında`);
      if (i.type === 'money' || i.type === 'number') {
        assert.equal(typeof i.default, 'number', `${at}: sayısal varsayılan`);
        assert.ok(i.min !== undefined && i.max !== undefined && i.min <= i.default && i.default <= i.max, `${at}: min ≤ varsayılan ≤ max`);
        assert.ok(i.step > 0, `${at}: step`);
      }
      if (i.type === 'checkbox') assert.equal(typeof i.default, 'boolean', `${at}: onay kutusu varsayılanı boolean`);
      if (i.type === 'select' || i.type === 'segment') {
        assert.ok(Array.isArray(i.options) && i.options.length >= 2, `${at}: en az 2 seçenek`);
        if (i.type === 'segment') assert.ok(i.options.length <= 4, `${at}: segment ≤ 4 seçenek`);
        const vals = i.options.map((o) => String(o.value));
        assert.equal(new Set(vals).size, vals.length, `${at}: seçenek değerleri benzersiz`);
        assert.ok(i.options.every((o) => o.label && (o.help === undefined || o.help.length <= 140)), `${at}: seçenek etiketi/help`);
        assert.ok(vals.includes(String(i.default)), `${at}: varsayılan seçeneklerden biri olmalı`);
      }
      if (i.showIf) {
        const s = i.showIf;
        const target = d.inputs.find((x) => x.id === s.id);
        assert.ok(target, `${at}: showIf, tanımsız girdiye bağlı (${s.id})`);
        assert.notEqual(s.id, i.id, `${at}: showIf kendine bağlı olamaz`);
        assert.equal(['eq' in s, 'in' in s, 'truthy' in s].filter(Boolean).length, 1, `${at}: showIf yalnızca eq | in | truthy içermeli`);
        if ('eq' in s) assert.ok(target.options ? target.options.some((o) => String(o.value) === String(s.eq)) : true, `${at}: showIf.eq seçeneklerde yok`);
        if ('in' in s) assert.ok(Array.isArray(s.in) && s.in.length > 0 && (!target.options || s.in.every((v) => target.options.some((o) => String(o.value) === String(v)))), `${at}: showIf.in`);
      }
    }
  }
});

test('tanımlar: varsayılanlar, hazır değerler, her seçenek ve onay kutusu hatasız hesaplanır (tarih jetonları 2026-10-01\'e göre)', () => {
  for (const d of DEFS) {
    const base = defaultsOf(d);
    const check = (label, values) => {
      const r = calculate(d.engine, values, PARAMS);
      assert.ok(!r.error, `${d.slug}: ${label} → hata: ${r.error} (alan: ${r.field}); girdi: ${JSON.stringify(values)}`);
      assertContract(r, `${d.slug} ${label}`);
      return r;
    };
    check('varsayılan', base);
    for (const p of d.presets) {
      for (const key of Object.keys(p.values)) assert.ok(d.inputs.some((i) => i.id === key), `${d.slug}: preset "${p.label}" tanımsız girdi içeriyor: ${key}`);
      check(`preset "${p.label}"`, { ...base, ...p.values });
    }
    for (const i of d.inputs) {
      for (const o of i.options || []) check(`${i.id}=${o.value}`, { ...base, [i.id]: o.value });
      if (i.type === 'checkbox') check(`${i.id}=${!i.default}`, { ...base, [i.id]: !i.default });
      if (i.type === 'money' || i.type === 'number') check(`${i.id}=max`, { ...base, [i.id]: i.max });
    }
  }
});

test('tanımlar: her girdi sonucu gerçekten etkiler (yanlış yazılmış kimlik yakalanır)', () => {
  for (const d of DEFS) {
    const base = defaultsOf(d);
    for (const i of d.inputs) {
      /* showIf'li girdiyi görünür kılan değerler */
      const over = {};
      if (i.showIf) {
        const s = i.showIf;
        over[s.id] = 'eq' in s ? s.eq : 'in' in s ? s.in[0] : (d.inputs.find((x) => x.id === s.id).type === 'checkbox' ? true : 500000);
      }
      const start = { ...base, ...over };
      let alt;
      if (i.type === 'select' || i.type === 'segment') alt = i.options.map((o) => o.value).find((v) => String(v) !== String(start[i.id]));
      else if (i.type === 'checkbox') alt = !start[i.id];
      else if (i.type === 'date') alt = addDays(start[i.id], 40);
      else alt = start[i.id] === 0 ? 100000 : Math.round(start[i.id] * 1.5 + 1000);
      const a = JSON.stringify(calculate(d.engine, start, PARAMS));
      const b = JSON.stringify(calculate(d.engine, { ...start, [i.id]: alt }, PARAMS));
      assert.notEqual(a, b, `${d.slug}: "${i.id}" girdisi sonucu etkilemiyor (${JSON.stringify(start[i.id])} → ${JSON.stringify(alt)})`);
    }
  }
});

test('tanımlar: ses ve hukuki duruş — yasak ifade yok, HTML yok, yalnızca izinli satır içi işaretleme, ASCII-Türkçe yok', () => {
  const urlMap = /^\/(hizmetler|sektorler|bilgi-merkezi|hesaplayicilar|vergi-takvimi|hakkimizda|kariyer|iletisim|arama|yasal)(\/|$)/;
  for (const d of DEFS) {
    for (const s of visibleStrings(d)) {
      assert.doesNotMatch(s, FORBIDDEN, `${d.slug}: yasak ifade → ${s}`);
      assert.doesNotMatch(s, /<[a-z/!][^>]*>/i, `${d.slug}: HTML olmamalı → ${s}`);
      assert.doesNotMatch(s, /`|(?<!\*)\*(?!\*)|(^|\s)#{1,6}\s|\n/, `${d.slug}: yalnızca **kalın**, [etiket](yol) ve [[Yer tutucu]] kullanılabilir → ${s}`);
      assert.doesNotMatch(s, ASCII_TURKISH, `${d.slug}: Türkçe karakterler korunmalı → ${s}`);
      assert.ok(!/\s{2,}/.test(s) && s === s.trim(), `${d.slug}: gereksiz boşluk → "${s}"`);
      for (const m of s.matchAll(/\]\(([^)]*)\)/g)) assert.ok(m[1].startsWith('https://') || urlMap.test(m[1]), `${d.slug}: bağlantı hedefi tanınmıyor: ${m[1]}`);
      assert.doesNotMatch(s, /\[\[/, `${d.slug}: bu hesaplayıcılarda yer tutucu olmamalı`);
    }
    for (const s of visibleStrings(d)) assert.ok(!/Boraden/.test(s), `${d.slug}: hesaplayıcı metni firma hakkında iddia içermemeli → ${s}`);
  }
  /* motor çıktıları da aynı kurallara uyar */
  for (const d of DEFS) {
    const r = calculate(d.engine, defaultsOf(d), PARAMS);
    for (const s of strings(r)) {
      assert.doesNotMatch(s, FORBIDDEN, `${d.slug} çıktısı: yasak ifade → ${s}`);
      assert.doesNotMatch(s, /<[a-z/!][^>]*>/i, `${d.slug} çıktısı: HTML → ${s}`);
    }
  }
});

test('tanımlar: doğrulanmamış varsayımlar kullanıcıya görünür (SGDP, ikincil kaynak, teşvik koşulu, gün tabanı)', () => {
  const by = Object.fromEntries(DEFS.map((d) => [d.slug, d]));
  const text = (d) => d.assumptions.join(' ');
  for (const d of DEFS) if (d.inputs.some((i) => i.id === 'retired')) assert.match(text(d), /SGDP[\s\S]*teyit/, `${d.slug}: SGDP oranlarının teyit gerektirdiği belirtilmeli`);
  for (const slug of ['kidem-tazminati-hesaplama', 'ihbar-tazminati-hesaplama']) assert.match(text(by[slug]), /ikincil kaynak/, `${slug}: vergi uygulamasının ikincil kaynağa dayandığı belirtilmeli`);
  assert.match(text(by['kidem-tazminati-hesaplama']), /365/, 'kıdem: 365 gün tabanı belirtilmeli');
  assert.match(text(by['ihbar-tazminati-hesaplama']), /1,5 yıl/, 'ihbar: sınır yorumu belirtilmeli');
  assert.match(text(by['isveren-maliyeti-hesaplama']), /[Tt]eşvik/, 'işveren maliyeti: teşvik koşulları belirtilmeli');
  assert.match(text(by['maas-hesaplama']), /[Aa]sgari geçim indirimi/, 'maaş: AGİ uygulanmadığı belirtilmeli');
});

test('en güncel parametre dosyası (<yıl>-bordro.json): biçim, dönem listeleri ve tüm hesaplayıcılar hesaplanır (yıllık güncelleme güvencesi)', () => {
  const dir = path.join(ROOT, 'src/data/params');
  const years = fs.readdirSync(dir).map((f) => /^(\d{4})-bordro\.json$/.exec(f)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  assert.ok(years.includes(2026), '2026-bordro.json bulunmalı');
  const year = years[years.length - 1];
  const P = readJSON(`src/data/params/${year}-bordro.json`);
  assert.equal(P.meta.year, year, 'meta.year dosya adındaki yılla aynı olmalı');
  assert.ok(fs.statSync(path.join(dir, `${year}-bordro.json`)).size < 60 * 1024, 'params dosyası < 60 KB olmalı');
  assertParamsShape(P, `${year}-bordro`);
  assertPeriods(P, `${year}-bordro`);
  for (const d of DEFS) {
    for (const today of [`${year}-03-15`, `${year}-10-01`]) {
      const base = defaultsOf(d, today);
      const r = calculate(d.engine, base, P);
      assert.ok(!r.error, `${d.slug}: ${year} parametreleriyle (bugün = ${today}) varsayılan hesap hata verdi: ${r.error} (alan: ${r.field})`);
      assertContract(r, `${d.slug} ${year}`);
      assert.equal(r.paramsUsed.id, P.meta.id);
      for (const p of d.presets) {
        const rp = calculate(d.engine, { ...base, ...p.values }, P);
        assert.ok(!rp.error, `${d.slug}: hazır değer "${p.label}" ${year} parametreleriyle hata verdi: ${rp.error} (alan: ${rp.field}) — hazır değerleri/tarihlerini güncelleyin`);
      }
    }
  }
});

test('belgeler: docs/CALCULATORS-bordro.md var ve zorunlu bölümleri içerir', () => {
  const md = readText('docs/CALCULATORS-bordro.md');
  assert.ok(md.length > 4000, 'belge kısa kalmamalı');
  for (const heading of ['Yıllık güncelleme kontrol listesi', 'Parametre tablosu', 'Açık doğrulama maddeleri', 'Varsayımlar']) assert.ok(md.includes(heading), `belgede "${heading}" bölümü yok`);
  for (const key of Object.keys(PARAMS).filter((x) => x !== 'meta')) assert.ok(md.includes(key), `parametre tablosunda "${key}" anahtarı yok`);
  for (const engine of Object.keys(ENGINE_INPUTS)) assert.ok(md.includes(engine), `belgede "${engine}" motoru yok`);
  for (const d of DEFS) assert.ok(md.includes(d.slug), `belgede "${d.slug}" yok`);
});
