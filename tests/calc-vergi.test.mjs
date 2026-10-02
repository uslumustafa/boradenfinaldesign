/* Vergi hesaplayıcıları + vergi takvimi testleri.
   Çalıştırma (proje kökünden):  node --test tests/calc-vergi.test.mjs
   Araştırma test vektörleri docs/research/other-params-2026.json'dan DOĞRUDAN okunur (kopyalanmaz). */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculate, ENGINES } from '../src/calc/core.mjs';
import { addDays, addMonths, weekday, parseISO, pickEffective } from '../src/calc/util.mjs';

const ROOT = new URL('../', import.meta.url);
const readJSON = (rel) => JSON.parse(fs.readFileSync(new URL(rel, ROOT), 'utf8'));
const research = readJSON('docs/research/other-params-2026.json');
/* Araştırma vektörleri ve özellik testleri 2026-10-01 anlık görüntüsüne ait olduğundan 2026 dosyasına SABİTTİR.
   Hesaplayıcı tanım denetimleri ve takvim ise `src/data/params/` altındaki EN SON yıl dosyasına (`latest`) karşı çalışır;
   böylece yeni yıl için `2027-vergi.json` eklenince bu denetimler yeni dosyayı izler. */
const params = readJSON('src/data/params/2026-vergi.json');
const latestFile = fs.readdirSync(new URL('src/data/params/', ROOT)).filter((f) => /^\d{4}-vergi\.json$/.test(f)).sort().at(-1);
const latest = readJSON(`src/data/params/${latestFile}`);
const TODAY = '2026-10-01'; // "today" jetonları bu tarihe göre çözülür
const kurus = (x) => Math.round(x * 100);

/* ---------- Yardımcılar ---------- */
function run(engine, inputs) {
  const r = calculate(engine, inputs, params);
  assert.ok(!r.error, `${engine} beklenmedik hata verdi: ${r.error} (alan: ${r.field}) girdi=${JSON.stringify(inputs)}`);
  return r;
}
function row(rows, startsWith, where = 'summary') {
  const hit = rows.find((s) => s.label.startsWith(startsWith));
  assert.ok(hit, `"${startsWith}" ile başlayan ${where} satırı yok. Mevcut: ${rows.map((s) => s.label).join(' | ')}`);
  return hit.value;
}
const sumv = (r, label) => row(r.summary, label);
function eqMoney(actual, expected, msg) {
  assert.equal(kurus(actual), kurus(expected), `${msg}: beklenen ${expected}, bulunan ${actual}`);
}
function walk(o, fn, path = '') {
  if (Array.isArray(o)) o.forEach((x, i) => walk(x, fn, `${path}[${i}]`));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, fn, `${path}.${k}`);
  else fn(o, path);
}
function assertFiniteDeep(res, ctx) {
  walk(res, (v, p) => {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${ctx}: sonlu olmayan sayı (${v}) @ ${p}`);
    assert.notEqual(v, undefined, `${ctx}: tanımsız değer @ ${p}`);
  });
}
const tierFor = (percent, date = TODAY) => {
  const t = params.kdv.tiers.find((x) => {
    const rec = pickEffective(x.rates, date);
    return rec && Math.abs(rec.rate * 100 - percent) < 1e-9;
  });
  assert.ok(t, `%${percent} KDV oranı params'ta yok`);
  return t.id;
};
const classFor = (percent, date) => {
  const c = params.corpTax.classes.find((x) => {
    const rec = pickEffective(x.rates, date);
    return rec && Math.abs(rec.rate * 100 - percent) < 1e-9;
  });
  assert.ok(c, `%${percent} kurumlar vergisi oranı ${date} için params'ta yok`);
  return c.id;
};
const stopajFor = (percent) => params.smm.stopaj.find((s) => Math.abs(s.rate * 100 - percent) < 1e-9).id;

/* Takvim kaydırma kuralı (testin kendi uygulaması): hafta sonu / tam gün resmî tatil → izleyen ilk iş günü. */
const calendar = readJSON('src/data/calendar.json');
const fullHolidays = calendar.holidays.filter((h) => h.kind === 'official').map((h) => h.date);
const shiftDate = (iso, holidays = fullHolidays) => {
  let d = iso;
  while (weekday(d) === 0 || weekday(d) === 6 || holidays.includes(d)) d = addDays(d, 1);
  return d;
};

describe('Araştırma test vektörleri — KDV (KDV-1..6)', () => {
  for (const v of research.test_vectors.kdv) {
    test(`${v.id}: ${v.description}`, () => {
      const i = v.inputs;
      const mode = i.mode === 'dahil' ? 'dahil' : 'haric';
      const amount = i.tutar !== undefined ? i.tutar : i.haric;
      const r = run('vat', {
        mode, amount, rate: tierFor(i.oran), tevkifat: i.tevkifat || 'yok', date: TODAY,
      });
      const e = v.expected;
      if (e.haric !== undefined) eqMoney(sumv(r, 'Matrah'), e.haric, `${v.id} matrah`);
      if (e.kdv !== undefined) eqMoney(sumv(r, 'KDV tutarı'), e.kdv, `${v.id} KDV`);
      if (e.dahil !== undefined) eqMoney(sumv(r, 'KDV dahil toplam'), e.dahil, `${v.id} KDV dahil`);
      if (e.hesaplanan_kdv !== undefined) eqMoney(sumv(r, 'KDV tutarı'), e.hesaplanan_kdv, `${v.id} hesaplanan KDV`);
      if (e.tevkif_edilen_kdv !== undefined) eqMoney(sumv(r, 'Alıcının sorumlu'), e.tevkif_edilen_kdv, `${v.id} tevkif edilen KDV`);
      if (e.saticiya_odenecek_kdv !== undefined) eqMoney(row(r.steps, 'Satıcıya ödenecek KDV', 'steps'), e.saticiya_odenecek_kdv, `${v.id} satıcıya ödenecek KDV`);
      if (e.saticiya_toplam_odeme !== undefined) eqMoney(sumv(r, 'Satıcıya ödenecek tutar'), e.saticiya_toplam_odeme, `${v.id} satıcıya toplam ödeme`);
    });
  }
});

describe('Araştırma test vektörleri — kurumlar vergisi ve geçici vergi (KV-1..7)', () => {
  for (const v of research.test_vectors.kurumlar_vergisi) {
    if (v.id === 'KV-4') {
      test('KV-4: kümülatif geçici vergi (4 dönem) ve yıllık mahsup', () => {
        let paid = 0;
        v.inputs.cumulative_kar.forEach((cum, idx) => {
          const r = run('provisionalTax', {
            taxpayer: 'kurum', period: String(idx + 1), cumProfit: cum, paid, rateClass: classFor(v.inputs.oran, TODAY), date: TODAY,
          });
          const due = sumv(r, 'Bu dönemde ödenecek');
          eqMoney(due, v.expected.odenecek[idx], `KV-4 ${idx + 1}. dönem ödenecek`);
          paid += due;
        });
        const annual = run('corpTax', { profit: v.inputs.cumulative_kar.at(-1), provisional: paid, date: TODAY });
        eqMoney(sumv(annual, 'Ödenecek kurumlar vergisi'), v.expected.yillik_kv_after_mahsup, 'KV-4 yıllık KV mahsuptan sonra');
      });
    } else if (v.id === 'KV-5') {
      test('KV-5: yurt içi asgari kurumlar vergisi karşılaştırması', () => {
        const r = run('corpTax', {
          profit: v.inputs.vergilendirilecek_kazanc_after_indirim_istisna, minTax: true, minBase: v.inputs.kurum_kazanci_oncesi, date: TODAY,
        });
        eqMoney(sumv(r, 'Asgari kurumlar vergisi'), v.expected.asgari_kv, 'KV-5 asgari KV');
        const normalRow = r.tables[0].rows[0];
        eqMoney(normalRow.tax, v.expected.normal_kv, 'KV-5 normal KV');
        eqMoney(sumv(r, 'Ödenecek kurumlar vergisi'), v.expected.odenecek, 'KV-5 ödenecek');
        assert.ok(r.warnings.some((w) => /asgari/i.test(w)), 'KV-5: asgari vergi doğrulanmamış uyarısı bekleniyordu');
      });
    } else {
      test(`${v.id}: ${v.description}`, () => {
        const date = v.inputs.tax_year ? `${v.inputs.tax_year}-06-30` : TODAY;
        const r = run('corpTax', { profit: v.inputs.matrah, rateClass: classFor(v.inputs.oran, date), date });
        eqMoney(sumv(r, 'Hesaplanan kurumlar vergisi'), v.expected.kurumlar_vergisi, `${v.id} hesaplanan KV`);
      });
    }
  }
});

describe('Araştırma test vektörleri — serbest meslek makbuzu (SMM-1..8)', () => {
  for (const v of research.test_vectors.smm) {
    test(`${v.id}: ${v.description}`, () => {
      const i = v.inputs;
      let mode;
      let amount;
      if (i.brut !== undefined) { mode = 'brut'; amount = i.brut; }
      else if (i.net_ucret !== undefined) { mode = 'net'; amount = i.net_ucret; }
      else { mode = 'tahsilat'; amount = i.tahsil; }
      const r = run('smm', {
        mode, amount, stopaj: stopajFor(i.stopaj), kdv: tierFor(i.kdv !== undefined ? i.kdv : 20), tevkifat: i.tevkifat ? String(i.tevkifat) : 'yok', date: TODAY,
      });
      const e = v.expected;
      if (e.brut !== undefined) eqMoney(sumv(r, 'Brüt serbest meslek'), e.brut, `${v.id} brüt`);
      if (e.stopaj !== undefined) eqMoney(sumv(r, 'Gelir vergisi stopajı'), e.stopaj, `${v.id} stopaj`);
      if (e.kdv !== undefined) eqMoney(sumv(r, 'KDV ('), e.kdv, `${v.id} KDV`);
      if (e.tevkif_edilen_kdv !== undefined) eqMoney(sumv(r, 'Alıcıca tevkif edilen KDV'), e.tevkif_edilen_kdv, `${v.id} tevkif edilen KDV`);
      if (e.net_ucret !== undefined) eqMoney(sumv(r, 'Net ücret'), e.net_ucret, `${v.id} net ücret`);
      if (e.tahsil_edilecek !== undefined) eqMoney(sumv(r, 'Tahsil edilecek tutar'), e.tahsil_edilecek, `${v.id} tahsil edilecek`);
    });
  }
});

describe('Araştırma test vektörleri — gecikme zammı (GZ-1..4)', () => {
  for (const v of research.test_vectors.gecikme_zammi) {
    if (v.expected === null) {
      test(`${v.id}: araştırmada bilinçli olarak boş (oran değişimi kuralı çözülmedi)`, () => assert.equal(v.expected, null));
      continue;
    }
    test(`${v.id}: ${v.description}`, () => {
      const due = '2025-12-01'; // 13.11.2025 sonrası: tek oran (%3,7)
      const pay = addDays(addMonths(due, v.inputs.tam_ay), v.inputs.gun);
      const r = run('lateFee', { principal: v.inputs.anapara, dueDate: due, payDate: pay });
      eqMoney(sumv(r, 'Gecikme zammı'), v.expected.gecikme_zammi, `${v.id} gecikme zammı`);
      eqMoney(sumv(r, 'Ödenecek toplam'), v.expected.toplam, `${v.id} toplam`);
      assert.equal(sumv(r, 'Aylık gecikme zammı oranı'), v.inputs.aylik_oran, `${v.id} oran (yüzde birimi)`);
    });
  }
  test('GZ-1 (T24 örneği, gerçek tarihlerle): vade 30.11.2025, ödeme 05.03.2026 → 3 ay 5 gün', () => {
    const r = run('lateFee', { principal: 10000, dueDate: '2025-11-30', payDate: '2026-03-05' });
    assert.equal(sumv(r, 'Gecikme süresi'), '3 ay 5 gün');
    eqMoney(sumv(r, 'Gecikme zammı'), 1171.67, 'T24 örneği');
  });
});

describe('Araştırma test vektörleri — takvim kaydırma (CAL-1..9)', () => {
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Vektörler araştırmanın tatil listesine göre yazıldığından kaydırma, calendar.json yenilense de araştırma tatilleriyle denenir.
  const researchFullDays = research.holidays.filter((h) => h.type !== 'half-day').map((h) => h.date);
  for (const v of research.test_vectors.vergi_takvimi) {
    test(`${v.id}: ${v.description}`, () => {
      const nominal = v.inputs.nominal_due_date;
      assert.equal(dayName[weekday(nominal)], v.expected.nominal_weekday, `${v.id} asıl gün adı`);
      const eff = shiftDate(nominal, researchFullDays);
      assert.equal(eff, v.expected.effective, `${v.id}: etkin tarih`);
      assert.equal(dayName[weekday(eff)], v.expected.effective_weekday, `${v.id} etkin gün adı`);
    });
  }
});

/* ---------- Özellik testleri ---------- */
let seed = 20261001;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const money = (max) => Math.round(rnd() * max * 100) / 100;

describe('Özellikler — KDV', () => {
  const tiers = params.kdv.tiers.map((t) => t.id);
  test('monotonluk: tutar arttıkça matrah, KDV ve toplam azalmaz (her yön, her oran)', () => {
    const amounts = [0, 0.01, 0.99, 1, 10, 99.99, 100, 1234.56, 99999.99, 1e6, 123456789.12];
    for (const mode of ['haric', 'dahil', 'kdv']) {
      for (const rate of tiers) {
        if (mode === 'kdv' && rate === 'sifir') continue;
        let prev = null;
        for (const amount of amounts) {
          const r = run('vat', { mode, amount, rate, date: TODAY });
          const cur = [sumv(r, 'Matrah'), sumv(r, 'KDV tutarı'), sumv(r, 'KDV dahil toplam')];
          if (prev) cur.forEach((x, k) => assert.ok(kurus(x) >= kurus(prev[k]), `${mode}/${rate}: ${amount} için ${k}. değer geriledi (${prev[k]} → ${x})`));
          prev = cur;
        }
      }
    }
  });
  test('toplam = matrah + KDV; hariç → dahil → hariç gidiş-dönüşü en çok 1 kuruş sapar', () => {
    for (let n = 0; n < 300; n++) {
      const x = money(1e6);
      const rate = tiers[n % tiers.length];
      const a = run('vat', { mode: 'haric', amount: x, rate, date: TODAY });
      eqMoney(sumv(a, 'Matrah') + sumv(a, 'KDV tutarı'), sumv(a, 'KDV dahil toplam'), `matrah+KDV=toplam (${x}, ${rate})`);
      const b = run('vat', { mode: 'dahil', amount: sumv(a, 'KDV dahil toplam'), rate, date: TODAY });
      assert.ok(Math.abs(kurus(sumv(b, 'Matrah')) - kurus(x)) <= 1, `gidiş-dönüş: ${x} → ${sumv(b, 'Matrah')} (${rate})`);
      eqMoney(sumv(b, 'Matrah') + sumv(b, 'KDV tutarı'), sumv(b, 'KDV dahil toplam'), `dahil yönü toplam (${x}, ${rate})`);
    }
  });
  test('tarih-etkili oran: 10.07.2023 öncesi %18/%8, sonrası %20/%10; öncesi için doğrulama uyarısı', () => {
    const rate = (iso, tier) => sumv(run('vat', { mode: 'haric', amount: 100, rate: tier, date: iso }), 'Uygulanan KDV oranı');
    assert.equal(rate('2023-07-09', 'genel'), 18);
    assert.equal(rate('2023-07-10', 'genel'), 20);
    assert.equal(rate('2023-07-09', 'indirimli'), 8);
    assert.equal(rate('2023-07-10', 'indirimli'), 10);
    assert.ok(run('vat', { mode: 'haric', amount: 100, rate: 'genel', date: '2023-07-09' }).warnings.length > 0);
    assert.equal(run('vat', { mode: 'haric', amount: 100, rate: 'genel', date: TODAY }).warnings.length, 0);
  });
  test('tevkifat 9/10: sorumlu sıfatıyla KDV + satıcıya kalan KDV = hesaplanan KDV; doğrulama uyarısı var', () => {
    const r = run('vat', { mode: 'haric', amount: 1234.57, rate: 'genel', tevkifat: '9/10', date: TODAY });
    eqMoney(sumv(r, 'Alıcının sorumlu') + row(r.steps, 'Satıcıya ödenecek KDV', 'steps'), sumv(r, 'KDV tutarı'), 'tevkifat bölünmesi');
    assert.ok(r.warnings.some((w) => /tevkifat/i.test(w)));
  });
  test('hatalı girdi → { error, field }: negatif tutar, bilinmeyen yön, %0 iken KDV tutarından matrah', () => {
    assert.equal(calculate('vat', { mode: 'haric', amount: -1, rate: 'genel' }, params).field, 'amount');
    assert.equal(calculate('vat', { mode: 'xyz', amount: 1, rate: 'genel' }, params).field, 'mode');
    assert.equal(calculate('vat', { mode: 'kdv', amount: 10, rate: 'sifir', date: TODAY }, params).field, 'rate');
    assert.equal(calculate('vat', { mode: 'haric', amount: 'abc', rate: 'genel' }, params).field, 'amount');
  });
});

describe('Özellikler — serbest meslek makbuzu', () => {
  const stopajs = params.smm.stopaj.map((s) => s.id);
  const kdvs = ['genel', 'indirimli', 'cokIndirimli', 'sifir'];
  test('net ücret ve tahsilattan brüte gidiş-dönüş kuruşu kuruşuna tutar', () => {
    for (let n = 0; n < 400; n++) {
      const B = money(5e6);
      const stopaj = stopajs[n % stopajs.length];
      const kdv = kdvs[n % kdvs.length];
      const tevkifat = n % 3 === 0 ? '9/10' : 'yok';
      const base = { stopaj, kdv, tevkifat, date: TODAY };
      const f = run('smm', { ...base, mode: 'brut', amount: B });
      const net = sumv(f, 'Net ücret');
      const tahsil = sumv(f, 'Tahsil edilecek tutar');
      const fromNet = run('smm', { ...base, mode: 'net', amount: net });
      eqMoney(sumv(fromNet, 'Net ücret'), net, `net → brüt → net (B=${B}, ${stopaj})`);
      assert.ok(Math.abs(kurus(sumv(fromNet, 'Brüt serbest meslek')) - kurus(B)) <= 1, `net → brüt: ${B} → ${sumv(fromNet, 'Brüt serbest meslek')}`);
      const fromT = run('smm', { ...base, mode: 'tahsilat', amount: tahsil });
      eqMoney(sumv(fromT, 'Tahsil edilecek tutar'), tahsil, `tahsilat → brüt → tahsilat (B=${B}, ${stopaj}/${kdv}/${tevkifat})`);
      assert.ok(Math.abs(kurus(sumv(fromT, 'Brüt serbest meslek')) - kurus(B)) <= 3, `tahsilat → brüt: ${B} → ${sumv(fromT, 'Brüt serbest meslek')}`);
    }
  });
  test('tablo toplamı = özet: brüt − stopaj + KDV − tevkif = tahsil edilecek tutar', () => {
    for (let n = 0; n < 100; n++) {
      const r = run('smm', { mode: 'brut', amount: money(1e6), stopaj: stopajs[n % 3], kdv: kdvs[n % 4], tevkifat: n % 2 ? '9/10' : 'yok', date: TODAY });
      const t = r.tables[0];
      const get = (p) => (t.rows.find((x) => x.item.includes(p)) || { amount: 0 }).amount;
      eqMoney(get('Brüt') - get('stopaj') + get('(+) KDV') - get('tevkif'), t.footer.amount, 'tablo hesabı');
      eqMoney(t.footer.amount, sumv(r, 'Tahsil edilecek tutar'), 'tablo altbilgisi = özet');
      eqMoney(get('Brüt') - get('stopaj'), get('Net'), 'net ücret satırı');
    }
  });
  test('girdi hataları: stopaj ve KDV seçimleri, negatif tutar', () => {
    assert.equal(calculate('smm', { mode: 'brut', amount: 100, stopaj: 'abc' }, params).field, 'stopaj');
    assert.equal(calculate('smm', { mode: 'brut', amount: -5 }, params).field, 'amount');
    assert.equal(calculate('smm', { mode: 'brut', amount: 100, kdv: 'yok' }, params).field, 'kdv');
  });
});

describe('Özellikler — kurumlar vergisi', () => {
  test('matrah negatif olmaz; vergi kâr arttıkça azalmaz; hesaplanan = matrah × oran', () => {
    let prev = -1;
    for (const profit of [-5e6, -1, 0, 0.01, 1000, 999999.99, 1e6, 2.5e7, 1e9]) {
      const r = run('corpTax', { profit, kkeg: 1000, exempt: 500, priorLoss: 2000, rateClass: 'genel', date: TODAY });
      const matrah = sumv(r, 'Kurumlar vergisi matrahı');
      assert.ok(matrah >= 0, `negatif matrah (${profit})`);
      eqMoney(sumv(r, 'Hesaplanan kurumlar vergisi'), matrah * 0.25, `vergi = matrah × %25 (${profit})`);
      assert.ok(kurus(sumv(r, 'Hesaplanan kurumlar vergisi')) >= prev, `vergi geriledi (${profit})`);
      prev = kurus(sumv(r, 'Hesaplanan kurumlar vergisi'));
    }
  });
  test('mali kâr ve geçmiş yıl zararı: zarar yalnızca pozitif mali kârdan düşer, artan zarar notlanır', () => {
    const r = run('corpTax', { profit: 100000, kkeg: 20000, exempt: 10000, priorLoss: 500000, date: TODAY });
    eqMoney(sumv(r, 'Kurumlar vergisi matrahı'), 0, 'zarar kârı aştı');
    assert.ok(r.notes.some((n) => /kullanılamamıştır/.test(n)), 'kullanılamayan zarar notu bekleniyordu');
    const z = run('corpTax', { profit: -50000, date: TODAY });
    eqMoney(sumv(z, 'Kurumlar vergisi matrahı'), 0, 'mali zarar → matrah 0');
    assert.ok(z.notes.some((n) => /mali zarar/i.test(n)));
    const m = run('corpTax', { profit: 1000000, kkeg: 100000, exempt: 50000, priorLoss: 250000, date: TODAY });
    eqMoney(sumv(m, 'Kurumlar vergisi matrahı'), 800000, '1.000.000 + 100.000 − 50.000 − 250.000');
    eqMoney(sumv(m, 'Hesaplanan kurumlar vergisi'), 200000, '800.000 × %25');
  });
  test('mahsup: geçici vergi fazlaysa "mahsup edilemeyen" etiketi ve not; asgari vergi daha büyükse seçilir', () => {
    const r = run('corpTax', { profit: 1000000, provisional: 300000, date: TODAY });
    assert.ok(r.summary.some((s) => /Mahsup edilemeyen/.test(s.label)));
    eqMoney(row(r.summary, 'Mahsup edilemeyen'), 50000, 'iade/devir tutarı');
    const lowMin = run('corpTax', { profit: 1000000, minTax: true, minBase: 1000000, date: TODAY });
    eqMoney(sumv(lowMin, 'Hesaplanan kurumlar vergisi'), 250000, 'normal vergi asgariden büyük');
    const hiMin = run('corpTax', { profit: 1000000, minTax: true, minBase: 8000000, date: TODAY });
    eqMoney(sumv(hiMin, 'Hesaplanan kurumlar vergisi'), 800000, 'asgari vergi seçildi');
    assert.equal(hiMin.tables[0].footer.tax, 800000);
  });
  test('girdi hataları ve uyarılar: erken dönem, 2027 öncesi üretim oranı, indirimli oran uyarısı', () => {
    assert.equal(calculate('corpTax', { profit: 1, date: '2024-12-31' }, params).field, 'date');
    assert.equal(calculate('corpTax', { profit: 1, rateClass: 'uretim', date: '2026-12-31' }, params).field, 'rateClass');
    assert.ok(!calculate('corpTax', { profit: 1, rateClass: 'uretim', date: '2027-01-01' }, params).error);
    assert.equal(calculate('corpTax', { profit: 1, rateClass: 'yok', date: TODAY }, params).field, 'rateClass');
    assert.equal(calculate('corpTax', { profit: 1, minTax: true, minBase: -1, date: TODAY }, params).field, 'minBase');
    assert.ok(run('corpTax', { profit: 1000, rateClass: 'ihracat', date: TODAY }).warnings.some((w) => /ilgili kazanç kısmına/.test(w)));
    assert.equal(run('corpTax', { profit: 1000, rateClass: 'genel', date: TODAY }).warnings.length, 0);
  });
});

describe('Özellikler — geçici vergi', () => {
  test('kümülatif matrah arttıkça ödenecek vergi azalmaz; sıfır kârda ödenecek vergi yok', () => {
    let prev = -1;
    for (const cum of [-1000, 0, 100, 5000, 123456.78, 1e7]) {
      const r = run('provisionalTax', { taxpayer: 'kurum', period: '3', cumProfit: cum, paid: 0, date: TODAY });
      const due = kurus(sumv(r, 'Bu dönemde ödenecek'));
      assert.ok(due >= prev && due >= 0, `ödenecek vergi geriledi/negatif (${cum})`);
      prev = due;
    }
  });
  test('önceki ödemeler hesaplanandan büyükse ödenecek 0 ve açıklayıcı not', () => {
    const r = run('provisionalTax', { taxpayer: 'kurum', period: '2', cumProfit: 100000, paid: 40000, date: TODAY });
    eqMoney(sumv(r, 'Bu dönemde ödenecek'), 0, 'fazla ödeme');
    assert.ok(r.notes.some((n) => /mahsup/.test(n)));
  });
  test('gelir vergisi mükellefi %15; beyan günleri iş günüdür ve tablo artandır', () => {
    const r = run('provisionalTax', { taxpayer: 'gelir', period: '3', cumProfit: 200000, paid: 0, date: TODAY });
    assert.equal(sumv(r, 'Uygulanan geçici vergi oranı'), 15);
    eqMoney(sumv(r, 'Bu dönemde ödenecek'), 30000, '%15');
    for (const year of [2025, 2026, 2027]) {
      const t = run('provisionalTax', { taxpayer: 'kurum', period: '1', cumProfit: 1, date: `${year}-06-15` }).tables[0];
      let last = '';
      for (const x of t.rows) {
        assert.ok(weekday(x.due) !== 0 && weekday(x.due) !== 6, `${year}: son gün hafta sonu (${x.due})`);
        assert.ok(x.due > last && x.due > x.end, `${year}: tablo sırası/son gün dönem sonundan sonra olmalı (${x.due})`);
        last = x.due;
      }
    }
    assert.equal(sumv(run('provisionalTax', { taxpayer: 'kurum', period: '3', cumProfit: 1, date: TODAY }), 'Beyan ve ödeme son günü'), '2026-11-17');
    assert.equal(sumv(run('provisionalTax', { taxpayer: 'kurum', period: '4', cumProfit: 1, date: TODAY }), 'Beyan ve ödeme son günü'), '2027-02-17');
  });
  test('girdi hataları: 4. dönem 2025 öncesi, bilinmeyen dönem, 2027 üretim oranı seçilemez', () => {
    assert.equal(calculate('provisionalTax', { taxpayer: 'kurum', period: '4', cumProfit: 1, date: '2024-06-01' }, params).field, 'period');
    assert.equal(calculate('provisionalTax', { taxpayer: 'kurum', period: '9', cumProfit: 1, date: TODAY }, params).field, 'period');
    assert.equal(calculate('provisionalTax', { taxpayer: 'kurum', period: '1', cumProfit: 1, rateClass: 'uretim', date: TODAY }, params).field, 'rateClass');
    assert.equal(calculate('provisionalTax', { taxpayer: 'kurum', period: '1', date: TODAY }, params).field, 'cumProfit');
  });
});

describe('Özellikler — gecikme zammı', () => {
  const base = { principal: 123456.78 };
  test('ödeme tarihi ilerledikçe gecikme zammı azalmaz; günlük artış sınırlıdır', () => {
    // "Tam ay = aylık oran; kalan gün = oran/30" kuralı gereği 28 günlük bir ay (Şubat) tamamlanırken artış tek günde en çok 3 günlük,
    // 31 günlük ayda ise bir gün sabit kalır; azalma olmaz.
    for (const [due, maxDays] of [['2025-12-15', 3], ['2025-12-31', 3]]) {
      let prev = 0;
      for (let d = 0; d <= 400; d++) {
        const r = run('lateFee', { ...base, dueDate: due, payDate: addDays(due, d) });
        const z = sumv(r, 'Gecikme zammı');
        assert.ok(kurus(z) >= kurus(prev), `${due} +${d} gün: ${prev} → ${z}`);
        assert.ok(kurus(z) - kurus(prev) <= kurus((base.principal * 0.037 * maxDays) / 30) + 2, `${due} +${d} gün: günlük artış çok büyük (${prev} → ${z})`);
        prev = z;
      }
    }
  });
  test('tablo toplamı = özet = birikmiş son satır; anapara ile doğrusal', () => {
    for (const [due, pay] of [['2025-12-01', '2026-09-30'], ['2024-06-15', '2026-10-01'], ['2026-01-31', '2026-03-30'], ['2026-05-05', '2026-05-05']]) {
      const r = run('lateFee', { ...base, dueDate: due, payDate: pay });
      const t = r.tables[0];
      const total = sumv(r, 'Gecikme zammı');
      eqMoney(t.rows.reduce((a, x) => a + x.amount, 0), total, `satır toplamı (${due} → ${pay})`);
      eqMoney(t.footer.amount, total, 'altbilgi = özet');
      if (t.rows.length) eqMoney(t.rows.at(-1).cumulative, total, 'son birikmiş');
      eqMoney(sumv(r, 'Ödenecek toplam'), base.principal + total, 'toplam = anapara + zam');
    }
    const a = sumv(run('lateFee', { principal: 50000, dueDate: '2025-12-01', payDate: '2026-06-17' }), 'Gecikme zammı');
    const b = sumv(run('lateFee', { principal: 100000, dueDate: '2025-12-01', payDate: '2026-06-17' }), 'Gecikme zammı');
    assert.ok(Math.abs(kurus(b) - 2 * kurus(a)) <= 1, `doğrusallık: ${a} × 2 ≠ ${b}`);
  });
  test('oran tablosu: 13.11.2025 öncesi %4,5; tek orana düşen aralıkta uyarı yok, değişimi kapsayan aralıkta uyarı var', () => {
    const old = run('lateFee', { principal: 100000, dueDate: '2025-01-10', payDate: '2025-03-10' });
    eqMoney(sumv(old, 'Gecikme zammı'), 9000, '2 ay × %4,5');
    assert.equal(sumv(old, 'Aylık gecikme zammı oranı'), 4.5);
    assert.equal(old.warnings.filter((w) => /ağırlıklandırıldı/.test(w)).length, 0);
    const mixed = run('lateFee', { principal: 100000, dueDate: '2025-10-20', payDate: '2026-01-25' });
    assert.ok(mixed.warnings.some((w) => /ağırlıklandırıldı/.test(w)), 'oran değişimi uyarısı bekleniyordu');
    assert.ok(kurus(sumv(mixed, 'Gecikme zammı')) > kurus(sumv(run('lateFee', { principal: 100000, dueDate: '2025-12-20', payDate: '2026-03-25' }), 'Gecikme zammı')), 'eski oran daha yüksek olduğundan zam daha büyük olmalı');
    const first = mixed.tables[0].rows[0];
    assert.match(first.rate, /%4,5 \/ %3,7/);
  });
  test('ay sonu vade tarihleri ve girdi hataları', () => {
    const r = run('lateFee', { principal: 1000, dueDate: '2026-01-31', payDate: '2026-03-30' });
    assert.equal(sumv(r, 'Gecikme süresi'), '1 ay 30 gün');
    assert.equal(calculate('lateFee', { principal: 1, dueDate: '2024-05-20', payDate: '2026-01-01' }, params).field, 'dueDate');
    assert.equal(calculate('lateFee', { principal: 1, dueDate: '2026-02-01', payDate: '2026-01-01' }, params).field, 'payDate');
    assert.equal(calculate('lateFee', { principal: 1, dueDate: 'x', payDate: '2026-01-01' }, params).field, 'dueDate');
    assert.equal(calculate('lateFee', { principal: -1, dueDate: '2026-01-01', payDate: '2026-02-01' }, params).field, 'principal');
    assert.ok(run('lateFee', { principal: 1000, dueDate: '2026-09-01', payDate: '2026-12-01' }).warnings.some((w) => /doğrulandığı tarihten/.test(w)), 'ileri tarihli ödeme uyarısı');
  });
});

describe('Özellikler — tüm motorlar: NaN / Infinity / tanımsız değer yok', () => {
  const grid = {
    vat: [{ mode: 'haric', amount: 0 }, { mode: 'dahil', amount: 1e12, rate: 'cokIndirimli' }, { mode: 'kdv', amount: 0.01, rate: 'indirimli', tevkifat: '9/10' }],
    corpTax: [{ profit: 0 }, { profit: 1e12, kkeg: 1e12, minTax: true, minBase: 1e12 }, { profit: -1e12, priorLoss: 1e12 }],
    provisionalTax: [{ cumProfit: 0, period: '1' }, { cumProfit: 1e12, period: '4', taxpayer: 'gelir', paid: 1e12 }],
    smm: [{ mode: 'brut', amount: 0 }, { mode: 'net', amount: 1e9, stopaj: 'gvk18', tevkifat: '9/10' }, { mode: 'tahsilat', amount: 0.01, kdv: 'sifir' }],
    lateFee: [{ principal: 0, dueDate: '2026-01-01', payDate: '2026-01-01' }, { principal: 1e12, dueDate: '2024-05-21', payDate: '2026-10-01' }],
  };
  for (const [engine, cases] of Object.entries(grid)) {
    test(engine, () => {
      for (const c of cases) {
        const r = calculate(engine, { date: TODAY, ...c }, params);
        assert.ok(!r.error, `${engine} ${JSON.stringify(c)} → ${r.error}`);
        assertFiniteDeep(r, `${engine} ${JSON.stringify(c)}`);
        assert.ok(r.summary.length >= 1 && r.summary.length <= 6, `özet satır sayısı 1–6 olmalı (${r.summary.length})`);
        assert.ok(r.summary.filter((s) => s.main).length <= 2, 'en çok 2 vurgulanan satır');
        assert.ok(r.paramsUsed.items.length <= 12 && r.paramsUsed.id === params.meta.id);
      }
    });
  }
});

/* ---------- Vergi takvimi denetimi ---------- */
describe('Vergi takvimi (src/data/calendar.json)', () => {
  const items = calendar.items;
  const isoOK = (s) => typeof s === 'string' && !!parseISO(s);
  const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

  test('yapı: meta, 5–7 kategori, kurallar, tatiller, kalemler', () => {
    assert.ok(isoOK(calendar.meta.from) && isoOK(calendar.meta.to) && isoOK(calendar.meta.verifiedOn), 'meta tarihleri');
    assert.ok(calendar.meta.from < calendar.meta.to);
    assert.ok(nonEmpty(calendar.meta.disclaimer));
    assert.ok(calendar.categories.length >= 5 && calendar.categories.length <= 7, `kategori sayısı ${calendar.categories.length}`);
    assert.equal(new Set(calendar.categories.map((c) => c.id)).size, calendar.categories.length, 'yinelenen kategori id');
    for (const c of calendar.categories) assert.ok(/^[a-z0-9-]+$/.test(c.id) && nonEmpty(c.label), `kategori ${JSON.stringify(c)}`);
    assert.ok(Array.isArray(calendar.rules) && calendar.rules.length >= 3 && calendar.rules.every(nonEmpty));
    assert.ok(items.length > 0);
  });
  test('kalemler date alanına göre artan sırada ve benzersiz kebab-case id taşır', () => {
    for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].date <= items[i].date, `sıra bozuk: ${items[i - 1].id} (${items[i - 1].date}) → ${items[i].id} (${items[i].date})`);
    assert.equal(new Set(items.map((x) => x.id)).size, items.length, 'yinelenen id');
    for (const x of items) assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id), `id kebab-case değil: ${x.id}`);
  });
  test('her kalem: geçerli tarihler, kategori var, metinler dolu, kaynak çifti, güven değeri', () => {
    const cats = new Set(calendar.categories.map((c) => c.id));
    for (const x of items) {
      assert.ok(isoOK(x.date) && isoOK(x.nominalDate), `${x.id}: geçersiz tarih`);
      assert.ok(x.date >= calendar.meta.from && x.date <= calendar.meta.to, `${x.id}: tarih meta aralığı dışında (${x.date})`);
      assert.ok(cats.has(x.category), `${x.id}: bilinmeyen kategori ${x.category}`);
      for (const k of ['title', 'who', 'period']) assert.ok(nonEmpty(x[k]), `${x.id}: ${k} boş`);
      assert.ok(x.note === undefined || nonEmpty(x.note), `${x.id}: note boş`);
      assert.ok(Array.isArray(x.source) && x.source.length === 2 && nonEmpty(x.source[0]) && /^https:\/\//.test(x.source[1]), `${x.id}: source ["etiket","https://…"] olmalı`);
      assert.ok(['verified-official', 'secondary'].includes(x.confidence), `${x.id}: güven ${x.confidence}`);
      assert.ok(x.needsVerification === undefined || x.needsVerification === true, `${x.id}: needsVerification yalnızca true olabilir`);
      assert.ok(!/<[a-z][^>]*>/i.test(JSON.stringify(x)), `${x.id}: HTML var`);
    }
  });
  test('etkin tarih hafta sonuna veya tam gün resmî tatile düşmez; yarım gün tatil kaydırmaz', () => {
    for (const x of items) {
      assert.ok(weekday(x.date) !== 0 && weekday(x.date) !== 6, `${x.id}: etkin tarih hafta sonu (${x.date})`);
      assert.ok(!fullHolidays.includes(x.date), `${x.id}: etkin tarih tatil (${x.date})`);
    }
    for (const h of calendar.holidays.filter((x) => x.kind === 'half-day')) {
      for (const x of items.filter((y) => y.nominalDate === h.date && weekday(h.date) !== 0 && weekday(h.date) !== 6)) {
        assert.equal(x.date, h.date, `${x.id}: yarım gün tatil (${h.name}) kaydırma yapmamalı`);
        assert.equal(x.shifted, false, `${x.id}: yarım gün tatilde shifted=false olmalı`);
      }
    }
    const kdv = items.find((x) => x.id === 'kdv-2026-09');
    if (kdv) {
      assert.equal(kdv.date, '2026-10-28', 'arife yarım günü kaydırma yapmamalı');
      assert.equal(kdv.shifted, false);
    }
  });
  test('shifted ↔ nominalDate ↔ shiftNote tutarlı ve kaydırma kuralıyla yeniden üretilebilir', () => {
    for (const x of items) {
      assert.equal(x.shifted, x.nominalDate !== x.date, `${x.id}: shifted/nominalDate tutarsız`);
      assert.equal(shiftDate(x.nominalDate), x.date, `${x.id}: asıl tarih ${x.nominalDate} kuralla ${shiftDate(x.nominalDate)} olmalı, dosyada ${x.date}`);
      if (x.shifted) {
        assert.ok(nonEmpty(x.shiftNote), `${x.id}: kaydırılan kalemde shiftNote gerekli`);
        assert.ok(x.nominalDate < x.date, `${x.id}: kaydırma ileri tarihe olmalı`);
      } else assert.equal(x.shiftNote, undefined, `${x.id}: kaydırılmayan kalemde shiftNote olmamalı`);
    }
  });
  test('tatiller: geçerli tarih, tür, ad; en son params.holidays ile tutarlı; takvim aralığı tatil listesinin kapsamında', () => {
    for (const h of calendar.holidays) {
      assert.ok(isoOK(h.date) && nonEmpty(h.name) && ['official', 'half-day'].includes(h.kind), `tatil ${JSON.stringify(h)}`);
    }
    for (let i = 1; i < calendar.holidays.length; i++) assert.ok(calendar.holidays[i - 1].date < calendar.holidays[i].date, 'tatiller artan olmalı');
    assert.deepEqual([...fullHolidays].sort(), [...latest.holidays.fullDay].sort(), `${latestFile} holidays.fullDay ile calendar.json tam gün tatilleri aynı olmalı`);
    assert.deepEqual(calendar.holidays.filter((h) => h.kind === 'half-day').map((h) => h.date), latest.holidays.halfDay, `${latestFile} holidays.halfDay ile calendar.json yarım gün tatilleri aynı olmalı`);
    assert.ok(
      calendar.meta.from >= latest.holidays.coveredFrom && calendar.meta.to <= latest.holidays.coveredThrough,
      `takvim aralığı (${calendar.meta.from}–${calendar.meta.to}), ${latestFile} holidays kapsamının (${latest.holidays.coveredFrom}–${latest.holidays.coveredThrough}) içinde olmalı`,
    );
  });
  /* Aşağıdaki iki karşılaştırma, calendar.json hâlâ araştırmanın 2026-10-01 anlık görüntüsüyse anlamlıdır;
     takvim sonradan yenilenirse (meta.verifiedOn değişir) atlanır — yapı, kural ve tatil denetimleri yine çalışır. */
  const snapshot = calendar.meta.verifiedOn === research.meta.as_of
    ? false
    : `calendar.json araştırma anlık görüntüsünden (${research.meta.as_of}) sonra yenilenmiş; araştırma karşılaştırması atlandı`;
  test('tatiller araştırmadaki listeyle aynı', { skip: snapshot }, () => {
    const rd = research.holidays.map((h) => `${h.date}|${h.type === 'half-day' ? 'half-day' : 'official'}`).sort();
    const cd = calendar.holidays.map((h) => `${h.date}|${h.kind}`).sort();
    assert.deepEqual(cd, rd, 'tatil listesi araştırmayla aynı olmalı');
  });
  test('araştırma tax_calendar kalemlerinin HEPSİ dahil (tarih, asıl tarih) ve işaretli kalemler needsVerification taşır', { skip: snapshot }, () => {
    const rs = research.tax_calendar;
    assert.equal(items.length, rs.length, `kalem sayısı: dosyada ${items.length}, araştırmada ${rs.length}`);
    rs.forEach((r, i) => {
      assert.equal(items[i].date, r.date, `#${i + 1} etkin tarih (${r.title})`);
      assert.equal(items[i].nominalDate, r.nominal_date || r.date, `#${i + 1} asıl tarih (${r.title})`);
      if (r.verify_before_publishing) assert.equal(items[i].needsVerification, true, `#${i + 1} "${items[i].id}" araştırmada "yayımlamadan önce doğrula" işaretli`);
      if (r.confidence === 'verified-official') assert.equal(items[i].confidence, 'verified-official', `#${i + 1} güven düşürülmemeli`);
      else assert.equal(items[i].confidence, 'secondary', `#${i + 1} ikincil kaynak güveni şişirilmemeli`);
    });
  });
  test('beyan günü kuralları: KDV 28, MPHB 26, geçici vergi 17, SGK ay sonu (asıl tarihler)', () => {
    const day = (iso) => parseISO(iso).d;
    for (const x of items) {
      if (x.id.startsWith('kdv-')) assert.equal(day(x.nominalDate), 28, x.id);
      if (x.id.startsWith('muhtasar-')) assert.equal(day(x.nominalDate), 26, x.id);
      if (x.id.startsWith('gecici-vergi-')) assert.equal(day(x.nominalDate), 17, x.id);
      if (x.id.startsWith('sgk-')) assert.equal(x.nominalDate, addDays(addMonths(`${x.nominalDate.slice(0, 7)}-01`, 1), -1), `${x.id}: ayın son günü olmalı`);
    }
  });
});

/* ---------- Hesaplayıcı tanım denetimleri (src/data/calculators-vergi.json) ---------- */
describe('Hesaplayıcı tanımları (src/data/calculators-vergi.json)', () => {
  const defs = readJSON('src/data/calculators-vergi.json');
  const content = readJSON('src/data/content.json');
  const serviceIds = new Set(content.services.map((s) => s.id));
  const ALL_SLUGS = [
    'maas-hesaplama', 'isveren-maliyeti-hesaplama', 'asgari-ucret-hesaplama', 'gelir-vergisi-hesaplama',
    'kdv-hesaplama', 'kurumlar-vergisi-hesaplama', 'gecici-vergi-hesaplama', 'serbest-meslek-makbuzu-hesaplama',
    'kidem-tazminati-hesaplama', 'ihbar-tazminati-hesaplama', 'gecikme-zammi-hesaplama',
  ];
  const MINE = {
    'kdv-hesaplama': { order: 5, engine: 'vat' },
    'kurumlar-vergisi-hesaplama': { order: 6, engine: 'corpTax' },
    'gecici-vergi-hesaplama': { order: 7, engine: 'provisionalTax' },
    'serbest-meslek-makbuzu-hesaplama': { order: 8, engine: 'smm' },
    'gecikme-zammi-hesaplama': { order: 11, engine: 'lateFee' },
  };
  const INPUT_TYPES = ['money', 'number', 'select', 'segment', 'checkbox', 'date'];
  const ADV = 'Gelişmiş seçenekler';
  const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const tokenRe = /^today(?:([+-])(\d+)([dmy]))?$/;

  /* "today" jetonları arayüzde ziyaretçinin gününe göre çözülür; testte sabit TODAY'e göre. */
  function resolveDate(v, ctx) {
    if (typeof v === 'string' && isoRe.test(v)) {
      assert.ok(parseISO(v), `${ctx}: geçersiz ISO tarih ${v}`);
      return v;
    }
    const m = typeof v === 'string' ? tokenRe.exec(v) : null;
    assert.ok(m, `${ctx}: tarih varsayılanı ISO ya da "today±N(d|m|y)" olmalı, bulunan ${JSON.stringify(v)}`);
    if (!m[1]) return TODAY;
    const n = (m[1] === '-' ? -1 : 1) * Number(m[2]);
    return m[3] === 'd' ? addDays(TODAY, n) : addMonths(TODAY, m[3] === 'm' ? n : n * 12);
  }
  const defaultsOf = (d) => Object.fromEntries(d.inputs.map((i) => [i.id, i.type === 'date' ? resolveDate(i.default, `${d.slug}.${i.id}`) : i.default]));
  const optValues = (i) => (i.options || []).map((o) => o.value);
  const strings = (o) => {
    const out = [];
    walk(o, (v, p) => { if (typeof v === 'string') out.push([v, p]); });
    return out;
  };

  test('beş hesaplayıcı: slug, sıra, motor, grup, params alanı ve güncelleme tarihi beklendiği gibi', () => {
    assert.deepEqual(defs.map((d) => d.slug), Object.keys(MINE), 'dosya yalnızca vergi hesaplayıcılarını, sıra düzeninde içermeli');
    const paramFiles = fs.readdirSync(new URL('src/data/params/', ROOT));
    for (const d of defs) {
      const want = MINE[d.slug];
      assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug), `${d.slug}: slug kebab-case olmalı`);
      assert.equal(d.order, want.order, `${d.slug}: sıra`);
      assert.equal(d.engine, want.engine, `${d.slug}: motor`);
      assert.equal(d.group, 'vergi', `${d.slug}: grup`);
      assert.equal(d.params, 'vergi', `${d.slug}: params alanı`);
      assert.equal(typeof ENGINES[d.engine], 'function', `${d.slug}: motor "${d.engine}" core.mjs ENGINES içinde yok`);
      assert.ok(paramFiles.some((f) => new RegExp(`^\\d{4}-${d.params}\\.json$`).test(f)), `${d.slug}: src/data/params/<yıl>-${d.params}.json yok`);
      assert.equal(d.updated, latest.meta.verifiedOn, `${d.slug}: updated, parametrelerin doğrulandığı tarih olmalı`);
    }
  });

  test('metin uzunlukları ve madde sayıları sözleşme sınırları içinde; HTML yok', () => {
    for (const d of defs) {
      const p = d.slug;
      assert.ok(nonEmpty(d.title) && d.title.length <= 48, `${p}: title ≤ 48 (${d.title.length})`);
      assert.ok(nonEmpty(d.short) && d.short.length <= 110, `${p}: short ≤ 110 (${d.short.length})`);
      assert.ok(nonEmpty(d.description) && d.description.length <= 155, `${p}: description ≤ 155 (${d.description.length})`);
      const sentences = String(d.lead).split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim());
      assert.ok(sentences.length >= 1 && sentences.length <= 2, `${p}: lead 1–2 cümle olmalı (${sentences.length})`);
      assert.ok(d.explain.length >= 2 && d.explain.length <= 4, `${p}: explain 2–4 blok (${d.explain.length})`);
      for (const b of d.explain) {
        assert.ok(nonEmpty(b.heading) && Array.isArray(b.paragraphs) && b.paragraphs.length >= 1 && b.paragraphs.every(nonEmpty), `${p}: explain bloğu "${b.heading}" geçersiz`);
      }
      assert.ok(d.assumptions.length >= 3 && d.assumptions.length <= 7 && d.assumptions.every(nonEmpty), `${p}: assumptions 3–7 madde (${d.assumptions.length})`);
      assert.ok(d.faq.length >= 3 && d.faq.length <= 5, `${p}: faq 3–5 çift (${d.faq.length})`);
      d.faq.forEach((f, k) => assert.ok(Array.isArray(f) && f.length === 2 && f.every(nonEmpty) && f[0].trim().endsWith('?'), `${p}: faq[${k}] ["Soru?", "Cevap."] olmalı`));
      assert.ok(d.sources.length >= 1, `${p}: en az bir kaynak`);
      d.sources.forEach((s, k) => assert.ok(Array.isArray(s) && s.length === 2 && nonEmpty(s[0]) && /^https:\/\/\S+$/.test(s[1]), `${p}: sources[${k}] ["etiket","https://…"] olmalı`));
      assert.equal(new Set(d.sources.map((s) => s[1])).size, d.sources.length, `${p}: yinelenen kaynak URL'si`);
      assert.ok(d.related.length >= 2 && d.related.length <= 3, `${p}: related 2–3 slug (${d.related.length})`);
      for (const s of d.related) assert.ok(ALL_SLUGS.includes(s) && s !== p, `${p}: related "${s}" 11 hesaplayıcıdan biri olmalı (kendisi hariç)`);
      assert.ok(d.relatedServices.length >= 1 && d.relatedServices.length <= 3, `${p}: relatedServices 1–3 (${d.relatedServices.length})`);
      for (const s of d.relatedServices) assert.ok(serviceIds.has(s), `${p}: relatedServices "${s}" content.json hizmetlerinde yok`);
      assert.ok(nonEmpty(d.disclaimer) && /[.!?]$/.test(d.disclaimer.trim()), `${p}: disclaimer en az bir tam cümle olmalı`);
      assert.ok(d.presets.length <= 4, `${p}: en çok 4 hızlı doldurma (${d.presets.length})`);
      for (const [s, path] of strings(d)) assert.ok(!/<\/?[a-z!][^>]*>/i.test(s), `${p}${path}: HTML etiketi var`);
    }
  });

  test('girdiler: benzersiz id, geçerli tür, seçenekler, varsayılan aralık, showIf referansları, ≤ 6 görünür girdi', () => {
    for (const d of defs) {
      const ids = d.inputs.map((i) => i.id);
      assert.equal(new Set(ids).size, ids.length, `${d.slug}: yinelenen girdi id'si`);
      const visible = d.inputs.filter((i) => !i.group);
      assert.ok(visible.length >= 1 && visible.length <= 6, `${d.slug}: görünür girdi sayısı ≤ 6 (${visible.length})`);
      for (const i of d.inputs) {
        const at = `${d.slug}.${i.id}`;
        assert.ok(/^[a-zA-Z][a-zA-Z0-9]*$/.test(i.id), `${at}: id camelCase olmalı`);
        assert.ok(INPUT_TYPES.includes(i.type), `${at}: bilinmeyen tür ${i.type}`);
        assert.ok(nonEmpty(i.label), `${at}: label boş`);
        assert.ok(i.help === undefined || (nonEmpty(i.help) && i.help.length <= 140), `${at}: help ≤ 140 karakter (${(i.help || '').length})`);
        assert.ok(i.group === undefined || i.group === ADV, `${at}: group yalnızca "${ADV}" olabilir`);
        assert.ok(i.default !== null && i.default !== undefined, `${at}: varsayılan gerekli ve null olamaz`);
        if (i.type === 'select' || i.type === 'segment') {
          assert.ok(Array.isArray(i.options) && i.options.length >= 2, `${at}: en az 2 seçenek`);
          if (i.type === 'segment') assert.ok(i.options.length <= 4, `${at}: segment ≤ 4 seçenek`);
          for (const o of i.options) {
            assert.ok(typeof o.value === 'string' && nonEmpty(o.label) && (o.help === undefined || nonEmpty(o.help)), `${at}: seçenek ${JSON.stringify(o)} geçersiz`);
          }
          assert.equal(new Set(optValues(i)).size, i.options.length, `${at}: yinelenen seçenek değeri`);
          assert.ok(optValues(i).includes(i.default), `${at}: varsayılan "${i.default}" seçeneklerde yok`);
        } else if (i.type === 'money' || i.type === 'number') {
          assert.equal(typeof i.default, 'number', `${at}: sayısal varsayılan gerekli`);
          assert.ok(Number.isFinite(i.min) && Number.isFinite(i.max) && i.min <= i.default && i.default <= i.max, `${at}: min ≤ varsayılan ≤ max olmalı`);
          assert.ok(i.step > 0, `${at}: step > 0 olmalı`);
        } else if (i.type === 'checkbox') {
          assert.equal(typeof i.default, 'boolean', `${at}: checkbox varsayılanı boolean olmalı`);
        } else if (i.type === 'date') {
          resolveDate(i.default, at);
        }
        if (i.showIf) {
          const ref = d.inputs.find((x) => x.id === i.showIf.id);
          assert.ok(ref && ref !== i, `${at}: showIf.id "${i.showIf.id}" bu hesaplayıcıdaki başka bir girdi olmalı`);
          const ops = ['eq', 'in', 'truthy'].filter((k) => k in i.showIf);
          assert.equal(ops.length, 1, `${at}: showIf tam olarak bir işleç taşımalı (eq | in | truthy)`);
          if ('eq' in i.showIf && ref.options) assert.ok(optValues(ref).includes(i.showIf.eq), `${at}: showIf.eq "${i.showIf.eq}" ${ref.id} seçeneklerinde yok`);
          if ('in' in i.showIf) {
            assert.ok(Array.isArray(i.showIf.in) && i.showIf.in.length > 0, `${at}: showIf.in dolu bir dizi olmalı`);
            if (ref.options) for (const v of i.showIf.in) assert.ok(optValues(ref).includes(v), `${at}: showIf.in "${v}" ${ref.id} seçeneklerinde yok`);
          }
          if ('truthy' in i.showIf) assert.equal(i.showIf.truthy, true, `${at}: showIf.truthy yalnızca true olabilir`);
        }
      }
    }
  });

  test('varsayılanlar error vermeden hesaplanır (today = 2026-10-01; "today-3m" → 2026-07-01)', () => {
    assert.equal(resolveDate('today-3m', 'jeton'), '2026-07-01');
    assert.equal(resolveDate('today', 'jeton'), TODAY);
    assert.equal(resolveDate('today+10d', 'jeton'), '2026-10-11');
    assert.equal(resolveDate('today-1y', 'jeton'), '2025-10-01');
    for (const d of defs) {
      const r = calculate(d.engine, defaultsOf(d), latest);
      assert.ok(!r.error, `${d.slug}: varsayılan girdiler hata veriyor: ${r.error} (alan: ${r.field})`);
      assertFiniteDeep(r, `${d.slug} varsayılan`);
      assert.ok(r.summary.length >= 1 && r.summary.length <= 6, `${d.slug}: özet 1–6 satır olmalı`);
      assert.ok(r.summary.some((s) => s.main), `${d.slug}: en az bir vurgulanan (main) özet satırı olmalı`);
    }
  });

  test('hızlı doldurma değerleri geçerli girdilerdir ve error vermeden hesaplanır', () => {
    for (const d of defs) {
      const labels = d.presets.map((p) => p.label);
      assert.equal(new Set(labels).size, labels.length, `${d.slug}: yinelenen hızlı doldurma etiketi`);
      for (const p of d.presets) {
        const at = `${d.slug} / "${p.label}"`;
        assert.ok(nonEmpty(p.label) && p.label.length <= 40, `${at}: etiket 1–40 karakter olmalı`);
        for (const [id, v] of Object.entries(p.values)) {
          const i = d.inputs.find((x) => x.id === id);
          assert.ok(i, `${at}: bilinmeyen girdi "${id}"`);
          if (i.options) assert.ok(optValues(i).includes(v), `${at}: ${id}="${v}" seçeneklerde yok`);
          if (i.type === 'money' || i.type === 'number') assert.ok(typeof v === 'number' && v >= i.min && v <= i.max, `${at}: ${id}=${v} aralık dışı`);
          if (i.type === 'checkbox') assert.equal(typeof v, 'boolean', `${at}: ${id} boolean olmalı`);
          if (i.type === 'date') assert.ok(typeof v === 'string' && isoRe.test(v) && parseISO(v), `${at}: ${id} geçerli ISO tarih olmalı`);
        }
        const r = calculate(d.engine, { ...defaultsOf(d), ...p.values }, latest);
        assert.ok(!r.error, `${at}: hata ${r.error} (alan: ${r.field})`);
        assertFiniteDeep(r, at);
      }
    }
  });

  /* Beklenen tutarlar 2026 oranlarına (%20 KDV, %20 stopaj, %3,7 gecikme zammı, %25 kurumlar) göre yazılmıştır;
     yeni yıl params dosyası eklenip örnekler/etiketler güncellendiğinde bu test atlanır, geçerlilik testi (yukarıda) sürer. */
  const frozen2026 = latest.meta.year === 2026 ? false : `en son params ${latestFile}; örnek tutar denetimi 2026 oranlarına sabit, atlandı`;
  test('hızlı doldurma örnekleri etiketlerinin söylediği sonucu verir', { skip: frozen2026 }, () => {
    const calc = (slug, label) => {
      const d = defs.find((x) => x.slug === slug);
      const p = d.presets.find((x) => x.label === label);
      assert.ok(p, `${slug}: "${label}" hızlı doldurması yok`);
      return run(d.engine, { ...defaultsOf(d), ...p.values });
    };
    let r = calc('kdv-hesaplama', '1.000 ₺ + %20 KDV');
    eqMoney(sumv(r, 'KDV tutarı'), 200, 'KDV hariç 1.000 → KDV');
    eqMoney(sumv(r, 'KDV dahil toplam'), 1200, 'KDV hariç 1.000 → dahil');
    r = calc('kdv-hesaplama', '1.200 ₺ KDV dahil');
    eqMoney(sumv(r, 'Matrah'), 1000, 'dahil 1.200 → matrah');
    eqMoney(sumv(r, 'KDV tutarı'), 200, 'dahil 1.200 → KDV');
    r = calc('kdv-hesaplama', 'Danışmanlıkta 9/10 tevkifat');
    eqMoney(sumv(r, 'Alıcının sorumlu'), 1800, '9/10 tevkif edilen KDV');
    r = calc('serbest-meslek-makbuzu-hesaplama', '10.000 ₺ brüt, %20 stopaj');
    eqMoney(sumv(r, 'Gelir vergisi stopajı'), 2000, 'stopaj');
    eqMoney(sumv(r, 'Net ücret'), 8000, 'net ücret');
    r = calc('serbest-meslek-makbuzu-hesaplama', 'Net 8.000 ₺ için brüt');
    eqMoney(sumv(r, 'Brüt serbest meslek'), 10000, 'net 8.000 → brüt');
    r = calc('serbest-meslek-makbuzu-hesaplama', 'Stopajsız makbuz');
    eqMoney(sumv(r, 'Tahsil edilecek'), 12000, 'stopajsız tahsilat');
    r = calc('serbest-meslek-makbuzu-hesaplama', '9/10 KDV tevkifatlı');
    eqMoney(sumv(r, 'Tahsil edilecek'), 8200, '9/10 tevkifatlı tahsilat');
    r = calc('gecikme-zammi-hesaplama', '3 ay 5 gün gecikme');
    assert.equal(sumv(r, 'Gecikme süresi'), '3 ay 5 gün');
    eqMoney(sumv(r, 'Gecikme zammı'), 1171.67, '3 ay 5 gün gecikme zammı');
    r = calc('gecikme-zammi-hesaplama', '6 ay gecikme');
    eqMoney(sumv(r, 'Gecikme zammı'), 55500, '6 ay gecikme zammı');
    r = calc('gecikme-zammi-hesaplama', '1 günlük gecikme');
    eqMoney(sumv(r, 'Gecikme zammı'), 123.33, '1 günlük gecikme zammı');
    r = calc('gecici-vergi-hesaplama', '3. dönem örneği');
    eqMoney(sumv(r, 'Bu dönemde ödenecek'), 250000, '3. dönem geçici vergi');
    assert.equal(sumv(r, 'Beyan ve ödeme son günü'), '2026-11-17');
  });

  test('showIf ile gizlenen girdiler sonucu etkilemez', () => {
    let checked = 0;
    for (const d of defs) {
      for (const i of d.inputs.filter((x) => x.showIf)) {
        const ref = d.inputs.find((x) => x.id === i.showIf.id);
        const base = defaultsOf(d);
        // Referans girdiyi, i'yi GİZLEYECEK bir değere ayarla.
        if ('eq' in i.showIf) base[ref.id] = optValues(ref).find((v) => v !== i.showIf.eq);
        else if ('in' in i.showIf) base[ref.id] = optValues(ref).find((v) => !i.showIf.in.includes(v));
        else base[ref.id] = ref.type === 'checkbox' ? false : 0;
        const alt = i.options ? optValues(i).find((v) => v !== base[i.id]) : base[i.id] + 12345;
        const a = calculate(d.engine, base, latest);
        const b = calculate(d.engine, { ...base, [i.id]: alt }, latest);
        assert.ok(!a.error && !b.error, `${d.slug}.${i.id}: hata ${a.error || b.error}`);
        assert.deepEqual(a.summary, b.summary, `${d.slug}: gizli "${i.id}" girdisi sonucu değiştirdi`);
        checked++;
      }
    }
    assert.ok(checked >= 2, `showIf kullanan girdi sayısı beklenenden az (${checked})`);
  });

  test('seçenek etiketlerindeki oranlar params ile uyumlu (yıllık güncellemede etiketler de güncellenmeli)', () => {
    const trPct = (r) => String(+(r * 100).toFixed(4)).replace('.', ',');
    const last = (list) => list[list.length - 1].rate;
    const source = {
      'vat.rate': () => latest.kdv.tiers,
      'smm.kdv': () => latest.kdv.tiers,
      'corpTax.rateClass': () => latest.corpTax.classes,
      'provisionalTax.rateClass': () => latest.corpTax.classes,
      'smm.stopaj': () => latest.smm.stopaj,
    };
    let n = 0;
    for (const d of defs) {
      for (const i of d.inputs) {
        const src = source[`${d.engine}.${i.id}`];
        if (!src) continue;
        const list = src();
        for (const o of i.options) {
          const rec = list.find((x) => x.id === o.value);
          assert.ok(rec, `${d.slug}.${i.id}: seçenek "${o.value}" params'ta yok`);
          const m = /^%(\d+(?:,\d+)?)(?:\s|$)/.exec(o.label);
          if (!m) continue;
          const rate = rec.rates ? last(rec.rates) : rec.rate;
          assert.equal(m[1], trPct(rate), `${d.slug}.${i.id}: "${o.label}" etiketindeki oran params'taki %${trPct(rate)} ile uyuşmuyor`);
          n++;
        }
      }
    }
    assert.ok(n >= 15, `kontrol edilen etiket sayısı beklenenden az (${n})`);
  });

  test('metinler: yalnızca izin verilen satır içi işaretleme; abartı ve vaat ifadesi yok', () => {
    const banned = /(^|[^\p{L}])(en iyi|en büyük|en hızlı|garanti|kesinlikle|mükemmel|rakipsiz|ödüllü|sıfır risk)([^\p{L}]|$)/iu;
    for (const d of defs) {
      for (const [s, path] of strings(d)) {
        const at = `${d.slug}${path}`;
        assert.ok(!banned.test(s), `${at}: abartı/vaat ifadesi: ${s}`);
        assert.equal((s.match(/\*\*/g) || []).length % 2, 0, `${at}: ** işaretleri dengesiz`);
        const rest = s.replace(/\[\[[^\]]+\]\]/g, '').replace(/\[[^\]]+\]\((?:\/[^)\s]*|https:\/\/[^)\s]+)\)/g, '');
        assert.ok(!/\]\(/.test(rest), `${at}: bağlantı biçimi [etiket](/yol/) veya [etiket](https://…) olmalı`);
        assert.ok(s === s.trim() && !/\s{2,}/.test(s), `${at}: baştaki/sondaki ya da art arda boşluk`);
      }
    }
  });
});
