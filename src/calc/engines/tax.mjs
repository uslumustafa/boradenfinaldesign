/* Vergi hesaplayıcı motorları — KDV, kurumlar vergisi, geçici vergi, serbest meslek makbuzu, gecikme zammı.
   Saf fonksiyonlar: oranlar, limitler ve tatil listesi params'tan (src/data/params/<yıl>-vergi.json) okunur;
   "bugün" yalnızca girdiyle gelir. Yuvarlama: kuruşa yarım yukarı (util.round2). Sonuç biçimi: ../core.mjs başlığı. */
import {
  InputError, round2, needNum, optNum, needChoice, needDate, bool,
  parseISO, toISO, daysInMonth, daysBetween, addDays, addMonths, weekday, ymdDiff, pickEffective, S, col,
} from '../util.mjs';

const BIG = 1e12;

/* ---------- Bu dosyaya özel yardımcılar ---------- */

/** 1234.5 → "1.234,50" (adım formülleri için; arayüz biçimlendirmesi ayrıdır). */
function fmt(x, digits = 2) {
  const n = Number.isFinite(x) ? x : 0;
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + (f ? `${g},${f}` : g);
}
/** kesir → "%20", "%12,5", "%3,7" */
const pct = (r) => '%' + String(+(r * 100).toFixed(4)).replace('.', ',');
/** kesir → yüzde birimi (kind:'percent' satırları için): 0.037 → 3.7 */
const pctUnit = (r) => +(r * 100).toFixed(6);
/** "2026-10-01" → "01.10.2026" */
function trDate(iso) {
  const p = parseISO(iso);
  return p ? `${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}` : String(iso);
}
const byId = (list, id) => (list || []).find((x) => x.id === id);

/** Tarih girdisi yoksa parametrelerin doğrulandığı tarih kullanılır (saat okunmaz). */
function refDate(inputs, id, P, label) {
  const raw = inputs ? inputs[id] : undefined;
  if (raw === undefined || raw === null || raw === '') return P.meta.verifiedOn;
  return needDate(inputs, id, { label });
}
/** needsVerification işaretli kaydın Türkçe uyarısını listeye ekler. */
function flag(rec, out) {
  if (rec && rec.needsVerification && rec.warn) out.push(rec.warn);
}
function finish(P, parts) {
  const warnings = [...new Set(parts.warnings || [])];
  return {
    summary: parts.summary,
    tables: parts.tables || [],
    steps: parts.steps || [],
    notes: parts.notes || [],
    warnings,
    paramsUsed: { id: P.meta.id, items: (parts.used || []).slice(0, 12) },
  };
}

/* Hafta sonu / tam gün resmî tatil → izleyen ilk iş günü (VUK m.17 uygulaması; yarım gün tatiller kaydırmaz). */
function isWorkday(iso, H) {
  const wd = weekday(iso);
  return wd !== 0 && wd !== 6 && !((H && H.fullDay) || []).includes(iso);
}
function nextWorkday(iso, H) {
  let d = iso;
  for (let i = 0; i < 20 && !isWorkday(d, H); i++) d = addDays(d, 1);
  return d;
}

/* ---------- 1) KDV ---------- */
function vat(inputs, P) {
  const K = P.kdv;
  const mode = needChoice(inputs, 'mode', ['haric', 'dahil', 'kdv'], { label: 'Hesaplama yönü', def: 'haric' });
  const amount = needNum(inputs, 'amount', { label: 'Tutar', min: 0, max: BIG });
  const date = refDate(inputs, 'date', P, 'İşlem tarihi');
  const tierId = needChoice(inputs, 'rate', K.tiers.map((t) => t.id), { label: 'KDV oranı', def: 'genel' });
  const rec = pickEffective(byId(K.tiers, tierId).rates, date);
  if (!rec) throw new InputError(`Seçilen KDV oranı ${trDate(date)} tarihinde tanımlı değil.`, 'rate');
  const r = rec.rate;
  const tevId = needChoice(inputs, 'tevkifat', ['yok', ...K.tevkifat.map((t) => t.id)], { label: 'Kısmi tevkifat', def: 'yok' });
  const tev = tevId === 'yok' ? null : byId(K.tevkifat, tevId);

  let matrah;
  let kdv;
  let dahil;
  if (mode === 'haric') {
    matrah = round2(amount);
    kdv = round2(matrah * r);
    dahil = round2(matrah + kdv);
  } else if (mode === 'dahil') {
    dahil = round2(amount);
    matrah = round2(dahil / (1 + r));
    kdv = round2(dahil - matrah);
  } else {
    if (r === 0) throw new InputError('KDV oranı %0 iken KDV tutarından matrah hesaplanamaz.', 'rate');
    kdv = round2(amount);
    matrah = round2(kdv / r);
    dahil = round2(matrah + kdv);
  }
  const tevkif = tev ? round2((kdv * tev.num) / tev.den) : 0;
  const kalanKdv = round2(kdv - tevkif);
  const saticiya = round2(matrah + kalanKdv);

  const divisor = fmt(1 + r, Number.isInteger(+(r * 100).toFixed(6)) ? 2 : 4);
  const steps = [S.percent('Uygulanan KDV oranı', pctUnit(r))];
  if (mode === 'haric') {
    steps.push(S.money('KDV tutarı', kdv, { formula: `${fmt(matrah)} × ${pct(r)}` }));
    steps.push(S.money('KDV dahil toplam', dahil, { formula: `${fmt(matrah)} + ${fmt(kdv)}` }));
  } else if (mode === 'dahil') {
    steps.push(S.money('Matrah (KDV hariç)', matrah, { formula: `${fmt(dahil)} ÷ ${divisor}` }));
    steps.push(S.money('KDV tutarı', kdv, { formula: `${fmt(dahil)} − ${fmt(matrah)}` }));
  } else {
    steps.push(S.money('Matrah (KDV hariç)', matrah, { formula: `${fmt(kdv)} ÷ ${pct(r)}` }));
    steps.push(S.money('KDV dahil toplam', dahil, { formula: `${fmt(matrah)} + ${fmt(kdv)}` }));
  }
  if (tev) {
    steps.push(S.money('Tevkif edilen KDV', tevkif, { formula: `${fmt(kdv)} × ${tev.num}/${tev.den}` }));
    steps.push(S.money('Satıcıya ödenecek KDV', kalanKdv, { formula: `${fmt(kdv)} − ${fmt(tevkif)}` }));
  }

  const summary = [
    S.money('Matrah (KDV hariç tutar)', matrah, { main: mode !== 'haric' }),
    S.money('KDV tutarı', kdv, { main: true }),
    S.money('KDV dahil toplam', dahil, { main: mode === 'haric' }),
    S.percent('Uygulanan KDV oranı', pctUnit(r)),
  ];
  if (tev) {
    summary.push(S.money('Alıcının sorumlu sıfatıyla beyan edeceği KDV', tevkif, { hint: `Tevkifat payı ${tev.num}/${tev.den}` }));
    summary.push(S.money('Satıcıya ödenecek tutar (matrah + kalan KDV)', saticiya));
  }

  const warnings = [];
  if (date < K.verifiedFrom) warnings.push(K.beforeVerifiedWarn);
  flag(tev, warnings);
  const notes = [
    'KDV tutarı, KDV dahil tutar ile matrah arasındaki fark olarak bulunur; tutarlar kuruşa yarım yukarı yuvarlanır.',
    'Bir mal veya hizmetin hangi oranla vergilendirileceği KDV Kanunu ve ilgili Cumhurbaşkanı Kararı listelerine göre belirlenir; araç, seçtiğiniz oranı uygular.',
  ];
  const used = [
    { label: 'Uygulanan KDV oranı', value: pctUnit(r), kind: 'percent' },
    { label: 'Oranın esas alındığı tarih', value: date, kind: 'date' },
  ];
  if (tev) used.push({ label: 'Kısmi tevkifat payı', value: `${tev.num}/${tev.den}`, kind: 'text' });
  return finish(P, { summary, steps, notes, warnings, used });
}

/* ---------- 2) Kurumlar vergisi ---------- */
function corpTax(inputs, P) {
  const C = P.corpTax;
  const date = refDate(inputs, 'date', P, 'Vergilendirme dönemi tarihi');
  if (date < C.supportedFrom) {
    throw new InputError(`Bu araç ${trDate(C.supportedFrom)} ve sonrasındaki vergilendirme dönemleri için hazırlanmıştır.`, 'date');
  }
  const clsId = needChoice(inputs, 'rateClass', C.classes.map((c) => c.id), { label: 'Oran türü', def: 'genel' });
  const cls = byId(C.classes, clsId);
  const rec = pickEffective(cls.rates, date);
  if (!rec) {
    const first = cls.rates[0] && cls.rates[0].from;
    throw new InputError(
      `"${cls.label}" ${trDate(date)} tarihli dönem için geçerli değildir.${first ? ` Bu oran ${trDate(first)} tarihinden itibaren uygulanır.` : ''}`,
      'rateClass',
    );
  }
  const profit = needNum(inputs, 'profit', { label: 'Ticari bilanço kârı', min: -BIG, max: BIG });
  const kkeg = optNum(inputs, 'kkeg', 0, { label: 'Kanunen kabul edilmeyen giderler', min: 0, max: BIG });
  const exempt = optNum(inputs, 'exempt', 0, { label: 'İstisna ve indirimler', min: 0, max: BIG });
  const loss = optNum(inputs, 'priorLoss', 0, { label: 'Geçmiş yıl zararları', min: 0, max: BIG });
  const paid = optNum(inputs, 'provisional', 0, { label: 'Mahsup edilecek geçici vergi', min: 0, max: BIG });

  const maliKar = round2(profit + kkeg - exempt);
  const usedLoss = round2(Math.min(loss, Math.max(0, maliKar)));
  const matrah = round2(Math.max(0, maliKar - usedLoss));
  const normal = round2(matrah * rec.rate);

  const wantMin = bool(inputs ? inputs.minTax : false);
  let minRec = null;
  let minBase = 0;
  let minAmt = 0;
  if (wantMin) {
    minRec = pickEffective(C.minTax.rates, date);
    if (!minRec) throw new InputError('Yurt içi asgari kurumlar vergisi bu dönem için tanımlı değil.', 'minTax');
    minBase = needNum(inputs, 'minBase', { label: 'Asgari vergi matrahı', min: 0, max: BIG });
    minAmt = round2(minBase * minRec.rate);
  }
  const hesaplanan = wantMin ? Math.max(normal, minAmt) : normal;
  const minApplies = wantMin && minAmt > normal;
  const net = round2(hesaplanan - paid);

  const steps = [
    S.money('Ticari bilanço kârı', profit),
    S.money('Mali kâr', maliKar, { formula: `${fmt(profit)} + ${fmt(kkeg)} (KKEG) − ${fmt(exempt)} (istisna ve indirimler)` }),
    S.money('İndirilen geçmiş yıl zararı', usedLoss),
    S.money('Kurumlar vergisi matrahı', matrah, { formula: `${fmt(Math.max(0, maliKar))} − ${fmt(usedLoss)}` }),
    S.money('Normal hesapla kurumlar vergisi', normal, { formula: `${fmt(matrah)} × ${pct(rec.rate)}` }),
  ];
  if (wantMin) {
    steps.push(S.money('Asgari kurumlar vergisi', minAmt, { formula: `${fmt(minBase)} × ${pct(minRec.rate)}` }));
    steps.push(S.money('Hesaplanan kurumlar vergisi', hesaplanan, { formula: 'Normal hesap ile asgari vergiden büyük olan' }));
  }
  steps.push(S.money(net >= 0 ? 'Ödenecek kurumlar vergisi' : 'Mahsup edilemeyen geçici vergi', Math.abs(net), { formula: `${fmt(hesaplanan)} − ${fmt(paid)} (geçici vergi)` }));

  const summary = [
    S.money('Kurumlar vergisi matrahı', matrah),
    S.percent('Uygulanan oran', pctUnit(rec.rate)),
    S.money('Hesaplanan kurumlar vergisi', hesaplanan, { main: true, ...(minApplies ? { hint: 'Asgari kurumlar vergisi uygulandı' } : {}) }),
  ];
  if (wantMin) summary.push(S.money('Asgari kurumlar vergisi (karşılaştırma)', minAmt));
  summary.push(S.money('Mahsup edilen geçici vergi', paid));
  summary.push(S.money(net >= 0 ? 'Ödenecek kurumlar vergisi' : 'Mahsup edilemeyen geçici vergi (iade / devir)', Math.abs(net), { main: true }));

  const tables = [];
  if (wantMin) {
    tables.push({
      title: 'Normal hesap ve asgari vergi karşılaştırması',
      note: 'Asgari vergi matrahını siz girersiniz; araç matrahın içeriğini denetlemez.',
      columns: [col('method', 'Yöntem', 'text'), col('base', 'Matrah', 'money'), col('rate', 'Oran', 'percent'), col('tax', 'Vergi', 'money')],
      rows: [
        { method: 'Normal hesap (vergilendirilecek kazanç)', base: matrah, rate: pctUnit(rec.rate), tax: normal },
        { method: 'Asgari kurumlar vergisi (KVK m.32/C)', base: round2(minBase), rate: pctUnit(minRec.rate), tax: minAmt },
      ],
      footer: { method: 'Hesaplanan (yüksek olan)', tax: hesaplanan },
    });
  }

  const warnings = [];
  if (cls.partial) {
    warnings.push('İndirimli oranlar yalnızca ilgili kazanç kısmına uygulanır; kazancın paylaştırılması bu araçta hesaplanmaz. Karma kazançlarda matrahı kazanç türüne göre ayırıp her biri için ayrı hesaplayın.');
  }
  flag(cls, warnings);
  flag(rec, warnings);
  if (wantMin) flag(C.minTax, warnings);
  const notes = [
    '2025, 2026 ve 2027 hesap dönemlerinde enflasyon düzeltmesi yapılmaz (7571 sayılı Kanun); kâr, düzeltme yapılmamış finansal tablolara göre girilmelidir.',
  ];
  if (maliKar < 0) notes.push(`Dönem mali zararı ${fmt(-maliKar)} TL'dir; matrah sıfır alınmıştır. Zararın sonraki dönemlerde indirilmesi mevzuattaki koşul ve sürelere bağlıdır.`);
  if (loss > usedLoss) notes.push(`Girilen geçmiş yıl zararının ${fmt(round2(loss - usedLoss))} TL'lik kısmı bu dönemde kullanılamamıştır.`);
  if (net < 0) notes.push('Mahsup edilen geçici vergi hesaplanan vergiden fazladır; fark, mevzuattaki usullere göre iade veya sonraki dönem mahsubu konusu olur.');
  const used = [
    { label: 'Oran türü', value: cls.label, kind: 'text' },
    { label: 'Kurumlar vergisi oranı', value: pctUnit(rec.rate), kind: 'percent' },
    { label: 'Oranın esas alındığı tarih', value: date, kind: 'date' },
  ];
  if (wantMin) used.push({ label: 'Asgari kurumlar vergisi oranı', value: pctUnit(minRec.rate), kind: 'percent' });
  return finish(P, { summary, tables, steps, notes, warnings, used });
}

/* ---------- 3) Geçici vergi (kurumlar ve gelir vergisi mükellefi; kümülatif matrah) ---------- */
function provisionalTax(inputs, P) {
  const G = P.provisional;
  const H = P.holidays;
  const taxpayer = needChoice(inputs, 'taxpayer', ['kurum', 'gelir'], { label: 'Mükellef türü', def: 'kurum' });
  const nStr = needChoice(inputs, 'period', G.periods.map((p) => String(p.n)), { label: 'Geçici vergi dönemi', def: '1' });
  const per = G.periods.find((p) => String(p.n) === nStr);
  const asOf = refDate(inputs, 'date', P, 'Dönem yılı için tarih');
  const year = parseISO(asOf).y;
  const endOf = (p, y) => toISO(y, p.endMonth, daysInMonth(y, p.endMonth));
  const endISO = endOf(per, year);
  if (per.from && endISO < per.from) {
    throw new InputError(`${per.n}. geçici vergi dönemi ${trDate(per.from)} ve sonrasındaki dönemler için geçerlidir.`, 'period');
  }

  let rate;
  let rateLabel;
  const warnings = [];
  if (taxpayer === 'kurum') {
    const ids = P.corpTax.classes.filter((c) => c.provisional).map((c) => c.id);
    const clsId = needChoice(inputs, 'rateClass', ids, { label: 'Oran türü', def: 'genel' });
    const cls = byId(P.corpTax.classes, clsId);
    const rec = pickEffective(cls.rates, endISO);
    if (!rec) throw new InputError(`"${cls.label}" bu dönem için geçerli değildir.`, 'rateClass');
    rate = rec.rate;
    rateLabel = cls.label;
    if (cls.partial) {
      warnings.push('İndirimli oranlar yalnızca ilgili kazanç kısmına uygulanır; kazancın paylaştırılması bu araçta hesaplanmaz. Karma kazançlarda kümülatif matrahı ayırıp ayrı hesaplayın.');
    }
    flag(cls, warnings);
  } else {
    const rec = pickEffective(G.gelirRates, endISO);
    if (!rec) throw new InputError('Gelir vergisi mükellefi geçici vergi oranı bu dönem için tanımlı değil.', 'taxpayer');
    rate = rec.rate;
    rateLabel = 'Gelir vergisi mükellefi geçici vergi oranı';
  }

  const cum = needNum(inputs, 'cumProfit', { label: 'Kümülatif dönem kârı', min: -BIG, max: BIG });
  const paid = optNum(inputs, 'paid', 0, { label: 'Önceki dönemlerde ödenen geçici vergi', min: 0, max: BIG });
  const base = Math.max(0, round2(cum));
  const calc = round2(base * rate);
  const toPay = Math.max(0, round2(calc - paid));
  const excess = Math.max(0, round2(paid - calc));

  const dueOf = (p, y) => nextWorkday(toISO(y + p.dueYearOffset, p.dueMonth, p.dueDay), H);
  const nominal = toISO(year + per.dueYearOffset, per.dueMonth, per.dueDay);
  const due = dueOf(per, year);
  if (nominal < H.coveredFrom || nominal > H.coveredThrough) warnings.push(H.outsideWarn);
  flag(per, warnings);

  const rows = G.periods
    .filter((p) => !p.from || endOf(p, year) >= p.from)
    .map((p) => ({ period: p.label, end: endOf(p, year), due: dueOf(p, year) }));

  const summary = [
    S.money('Kümülatif geçici vergi matrahı', base),
    S.percent('Uygulanan geçici vergi oranı', pctUnit(rate)),
    S.money('Dönem sonuna kadar hesaplanan geçici vergi', calc),
    S.money('Önceki dönemlerde ödenen geçici vergi', paid),
    S.money('Bu dönemde ödenecek geçici vergi', toPay, { main: true }),
    S.date('Beyan ve ödeme son günü', due, { main: true, ...(due !== nominal ? { hint: `Asıl tarih ${trDate(nominal)}; hafta sonu veya tatil nedeniyle ertelendi` } : {}) }),
  ];
  const steps = [
    S.money('Kümülatif matrah', base, { formula: 'Dönem başından itibaren toplam kâr (zarar ise 0)' }),
    S.money('Hesaplanan geçici vergi', calc, { formula: `${fmt(base)} × ${pct(rate)}` }),
    S.money('Bu dönemde ödenecek', toPay, { formula: `${fmt(calc)} − ${fmt(paid)} (önceki dönemlerde ödenen)` }),
  ];
  const tables = [{
    title: `${year} yılı geçici vergi beyan ve ödeme günleri`,
    note: 'Son gün; dönemi izleyen 2. ayın 17. günüdür. Hafta sonu ve tam gün resmî tatilde izleyen ilk iş günü esas alınır.',
    columns: [col('period', 'Dönem', 'text'), col('end', 'Dönem sonu', 'date'), col('due', 'Son gün', 'date')],
    rows,
  }];
  const notes = [
    'Geçici vergi kümülatif matrah üzerinden hesaplanır: dönem başından itibaren toplam kâr, oranla çarpılır ve önceki dönemlerde ödenen geçici vergi düşülür.',
  ];
  if (taxpayer === 'kurum') {
    notes.push('Yurt içi asgari kurumlar vergisinin geçici vergi dönemlerinde de hesaplandığı ikincil kaynaklarda belirtilmektedir; bu araç yalnızca normal hesabı yapar.');
  } else {
    notes.push('Gelir vergisi mükellefi için burada yalnızca geçici vergi oranı (birinci dilim oranı) gösterilir; yıllık vergi tarifeye göre ayrıca hesaplanır (Gelir Vergisi Hesaplama aracına bakın).');
  }
  if (excess > 0) {
    notes.push(`Kümülatif matrahtan hesaplanan vergi, önceki dönemlerde ödenenin ${fmt(excess)} TL altında kaldığı için bu dönemde ödenecek geçici vergi yoktur; fark mevzuattaki usullerle sonraki dönemlerde veya yıllık beyannamede mahsup konusu olur.`);
  }
  const used = [
    { label: 'Oran türü', value: rateLabel, kind: 'text' },
    { label: 'Geçici vergi oranı', value: pctUnit(rate), kind: 'percent' },
    { label: 'Dönem sonu', value: endISO, kind: 'date' },
    { label: 'Asıl son gün', value: nominal, kind: 'date' },
  ];
  return finish(P, { summary, tables, steps, notes, warnings, used });
}

/* ---------- 4) Serbest meslek makbuzu ---------- */
function smm(inputs, P) {
  const M = P.smm;
  const K = P.kdv;
  const mode = needChoice(inputs, 'mode', ['brut', 'net', 'tahsilat', 'kdvDahil'], { label: 'Hesaplama yönü', def: 'brut' });
  const amount = needNum(inputs, 'amount', { label: 'Tutar', min: 0, max: BIG });
  const date = refDate(inputs, 'date', P, 'İşlem tarihi');
  const sRec = byId(M.stopaj, needChoice(inputs, 'stopaj', M.stopaj.map((s) => s.id), { label: 'Stopaj', def: 'standart' }));
  const tier = byId(K.tiers, needChoice(inputs, 'kdv', K.tiers.map((t) => t.id), { label: 'KDV oranı', def: M.defaultKdvTier }));
  const kRec = pickEffective(tier.rates, date);
  if (!kRec) throw new InputError(`Seçilen KDV oranı ${trDate(date)} tarihinde tanımlı değil.`, 'kdv');
  const tevId = needChoice(inputs, 'tevkifat', ['yok', ...K.tevkifat.map((t) => t.id)], { label: 'Kısmi tevkifat', def: 'yok' });
  const tev = tevId === 'yok' ? null : byId(K.tevkifat, tevId);
  const s = sRec.rate;
  const k = kRec.rate;
  const t = tev ? tev.num / tev.den : 0;

  const forward = (B) => {
    const stopaj = round2(B * s);
    const kdv = round2(B * k);
    const tevkif = round2(kdv * t);
    return { brut: round2(B), stopaj, kdv, tevkif, net: round2(B - stopaj), tahsil: round2(B - stopaj + kdv - tevkif) };
  };

  let B;
  let diff = 0;
  if (mode === 'brut') {
    B = round2(amount);
  } else if (mode === 'kdvDahil') {
    B = round2(amount / (1 + k));
  } else {
    // net ücret veya tahsilattan brüt: kuruş kuruş yuvarlamayla birebir tutan en yakın brüt bulunur.
    const target = round2(amount);
    const denom = mode === 'net' ? 1 - s : 1 - s + k * (1 - t);
    const base = Math.round(round2(amount / denom) * 100);
    let best = null;
    for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      const x = (base + d) / 100;
      if (x < 0) continue;
      const f = forward(x);
      const gap = Math.abs(round2((mode === 'net' ? f.net : f.tahsil) - target));
      if (best === null || gap < best.gap - 1e-9) best = { x, gap };
    }
    B = best.x;
    diff = best.gap;
  }
  const f = forward(B);

  const summary = [
    S.money('Brüt serbest meslek ücreti (KDV hariç)', f.brut, { main: mode !== 'brut' }),
    S.money(`Gelir vergisi stopajı (${pct(s)})`, f.stopaj),
    S.money(`KDV (${pct(k)})`, f.kdv),
  ];
  if (tev) summary.push(S.money(`Alıcıca tevkif edilen KDV (${tev.num}/${tev.den})`, f.tevkif));
  summary.push(S.money('Net ücret (stopaj sonrası, KDV hariç)', f.net));
  summary.push(S.money('Tahsil edilecek tutar', f.tahsil, { main: true }));

  const rows = [
    { item: 'Brüt serbest meslek ücreti (KDV hariç)', rate: '', amount: f.brut },
    { item: '(−) Gelir vergisi stopajı', rate: pct(s), amount: f.stopaj },
    { item: '(=) Net ücret', rate: '', amount: f.net },
    { item: '(+) KDV', rate: pct(k), amount: f.kdv },
  ];
  if (tev) rows.push({ item: '(−) Alıcıca tevkif edilen KDV', rate: `${tev.num}/${tev.den}`, amount: f.tevkif });
  const tables = [{
    title: 'Makbuz dökümü',
    columns: [col('item', 'Kalem', 'text'), col('rate', 'Oran / pay', 'text'), col('amount', 'Tutar', 'money')],
    rows,
    footer: { item: '(=) Tahsil edilecek tutar', amount: f.tahsil },
  }];

  const steps = [];
  if (mode === 'net') steps.push(S.money('Brüt ücret', f.brut, { formula: `${fmt(round2(amount))} ÷ (1 − ${pct(s)})` }));
  if (mode === 'tahsilat') {
    steps.push(S.money('Brüt ücret', f.brut, { formula: `${fmt(round2(amount))} ÷ (1 − ${pct(s)} + ${pct(k)}${t ? ` × ${fmt(1 - t, 1)}` : ''})` }));
  }
  if (mode === 'kdvDahil') steps.push(S.money('Brüt ücret', f.brut, { formula: `${fmt(round2(amount))} ÷ ${fmt(1 + k, 2)}` }));
  steps.push(S.money('Stopaj', f.stopaj, { formula: `${fmt(f.brut)} × ${pct(s)}` }));
  steps.push(S.money('KDV', f.kdv, { formula: `${fmt(f.brut)} × ${pct(k)}` }));
  if (tev) steps.push(S.money('Tevkif edilen KDV', f.tevkif, { formula: `${fmt(f.kdv)} × ${tev.num}/${tev.den}` }));
  steps.push(S.money('Tahsil edilecek tutar', f.tahsil, {
    formula: `${fmt(f.brut)} − ${fmt(f.stopaj)} + ${fmt(f.kdv)}${tev ? ` − ${fmt(f.tevkif)}` : ''}`,
  }));

  const warnings = [];
  flag(sRec, warnings);
  flag(tev, warnings);
  const notes = [
    'Stopaj ve KDV, KDV hariç brüt ücret üzerinden hesaplanır; tahsil edilecek tutar = brüt − stopaj + KDV − tevkif edilen KDV.',
    'Stopaj, yalnızca ödemeyi yapan stopaj sorumlusu ise kesilir (ör. şirketler, kamu idareleri); bireysel müşteriye düzenlenen makbuzda stopaj uygulanmaz. KDV tevkifatı da yalnızca belirlenen alıcılara karşı uygulanır.',
    'Vergiden muaf olmayan serbest meslek erbabı makbuzu 01.06.2020\'den itibaren elektronik (e-SMM) düzenler.',
  ];
  if (diff > 0) notes.push(`Kuruş yuvarlamaları nedeniyle girilen tutarla birebir tutan bir brüt tutar bulunamadı; en yakın sonuç gösterilmiştir (fark ${fmt(diff)} TL).`);
  const used = [
    { label: 'Stopaj oranı', value: pctUnit(s), kind: 'percent' },
    { label: 'KDV oranı', value: pctUnit(k), kind: 'percent' },
    { label: 'Oranların esas alındığı tarih', value: date, kind: 'date' },
  ];
  if (tev) used.push({ label: 'Kısmi tevkifat payı', value: `${tev.num}/${tev.den}`, kind: 'text' });
  return finish(P, { summary, tables, steps, notes, warnings, used });
}

/* ---------- 5) Gecikme zammı (6183 sayılı Kanun m.51) ---------- */
function lateFee(inputs, P) {
  const L = P.lateFee;
  const principal = needNum(inputs, 'principal', { label: 'Gecikmiş tutar (anapara)', min: 0, max: BIG });
  const due = needDate(inputs, 'dueDate', { label: 'Vade tarihi' });
  const pay = needDate(inputs, 'payDate', { label: 'Ödeme tarihi' });
  if (due < L.supportedFrom) {
    throw new InputError(`Vade tarihi ${trDate(L.supportedFrom)} veya sonrası olmalıdır; bu tarihten önceki oranlar doğrulanmamıştır.`, 'dueDate');
  }
  if (pay < due) throw new InputError('Ödeme tarihi vade tarihinden önce olamaz.', 'payDate');
  const span = ymdDiff(due, pay);
  const dpm = L.daysPerMonth;

  // [s, e) aralığında geçerli aylık oranlar ve gün sayıları
  const segments = (s, e) => {
    const out = [];
    for (const rec of L.monthlyRates) {
      const lo = rec.from && rec.from > s ? rec.from : s;
      const endEx = rec.to ? addDays(rec.to, 1) : null;
      const hi = endEx && endEx < e ? endEx : e;
      const days = lo < hi ? daysBetween(lo, hi) : 0;
      if (days > 0) out.push({ rate: rec.rate, days });
    }
    return out;
  };

  const periods = [];
  for (let i = 0; i < span.totalMonths; i++) {
    const s = addMonths(due, i);
    const e = addMonths(due, i + 1);
    periods.push({ s, e, full: true, len: '1 ay', denom: daysBetween(s, e) });
  }
  if (span.days > 0) {
    periods.push({ s: addMonths(due, span.totalMonths), e: pay, full: false, len: `${span.days} gün`, denom: dpm });
  }

  const rows = [];
  const rateSet = new Set();
  let mixed = false;
  let cum = 0;
  let prev = 0;
  for (const p of periods) {
    const segs = segments(p.s, p.e);
    if (segs.reduce((a, g) => a + g.days, 0) !== daysBetween(p.s, p.e)) {
      throw new InputError('Oran tablosu bu tarih aralığının tamamını kapsamıyor.', 'dueDate');
    }
    const frac = p.full
      ? (segs.length === 1 ? segs[0].rate : segs.reduce((a, g) => a + (g.rate * g.days) / p.denom, 0))
      : segs.reduce((a, g) => a + (g.rate * g.days) / dpm, 0);
    cum += principal * frac;
    const cumR = round2(cum);
    const rs = [...new Set(segs.map((g) => g.rate))];
    if (rs.length > 1) mixed = true;
    rs.forEach((r) => rateSet.add(r));
    rows.push({ period: `${trDate(p.s)} – ${trDate(p.e)}`, length: p.len, rate: rs.map(pct).join(' / '), amount: round2(cumR - prev), cumulative: cumR });
    prev = cumR;
  }
  const total = prev;
  if (rateSet.size === 0) {
    const cur = pickEffective(L.monthlyRates, pay);
    if (cur) rateSet.add(cur.rate);
  }
  const rates = [...rateSet];
  const parts = [];
  if (span.totalMonths > 0) parts.push(`${span.totalMonths} ay`);
  if (span.days > 0) parts.push(`${span.days} gün`);
  const duration = parts.length ? parts.join(' ') : '0 gün';

  const summary = [
    S.money('Anapara', principal),
    S.text('Gecikme süresi', duration, { hint: `${daysBetween(due, pay)} takvim günü` }),
    rates.length === 1
      ? S.percent('Aylık gecikme zammı oranı', pctUnit(rates[0]))
      : S.text('Aylık gecikme zammı oranları', rates.map(pct).join(' / ')),
    S.money('Gecikme zammı', total, { main: true }),
    S.money('Ödenecek toplam (anapara + gecikme zammı)', round2(principal + total), { main: true }),
  ];

  const steps = [];
  if (rates.length === 1 && !mixed) {
    const r = rates[0];
    if (span.totalMonths > 0) {
      steps.push(S.money(`${span.totalMonths} tam ay`, round2(principal * r * span.totalMonths), { formula: `${fmt(principal)} × ${pct(r)} × ${span.totalMonths}` }));
    }
    if (span.days > 0) {
      steps.push(S.money(`${span.days} gün`, round2((principal * r * span.days) / dpm), { formula: `${fmt(principal)} × ${pct(r)} ÷ ${dpm} × ${span.days}` }));
    }
  } else if (rows.length) {
    steps.push(S.text('Oranlar', 'Her ay için ilgili dönemin aylık oranı uygulanır; dönem dönem ayrıntı tabloda.'));
  }
  steps.push(S.money('Gecikme zammı toplamı', total));

  const tables = [{
    title: 'Dönem dönem gecikme zammı',
    note: 'Vade tarihinden başlayarak her tam ay için aylık oran, kalan günler için aylık oranın otuzda biri uygulanır.',
    columns: [
      col('period', 'Dönem', 'text'),
      col('length', 'Süre', 'text'),
      col('rate', 'Aylık oran', 'text'),
      col('amount', 'Gecikme zammı', 'money'),
      col('cumulative', 'Birikmiş', 'money'),
    ],
    rows,
    footer: { period: 'Toplam', amount: total },
  }];

  const warnings = [];
  if (mixed) warnings.push(L.straddleWarn);
  if (pay > P.meta.verifiedOn) {
    warnings.push(`Ödeme tarihi, oranların doğrulandığı tarihten (${trDate(P.meta.verifiedOn)}) sonradır; aylık oran bu tarihten sonra değişmiş olabilir. Güncel oranı Resmî Gazete'den kontrol edin.`);
  }
  const notes = [
    'Gecikme zammı, vade tarihinden ödeme tarihine kadar her ay için ayrı ayrı aylık oranla hesaplanır; ay kesirleri aylık oranın otuzda biri üzerinden günlük işlenir (6183 sayılı Kanun m.51).',
    'Gecikme faizi (VUK m.112), pişmanlık zammı (VUK m.371) ve tecil faizi bu araca dahil değildir; ay kesri kuralları ve tecil faizi hesabı doğrulanamamıştır.',
  ];
  if (span.totalMonths === 0 && span.days === 0) notes.push('Ödeme tarihi vade tarihiyle aynı olduğundan gecikme süresi oluşmamıştır.');
  const used = [
    { label: 'Aylık gecikme zammı oranı', value: rates.map(pct).join(' / ') || '—', kind: 'text' },
    { label: 'Ay kesri günlük bölen', value: dpm, kind: 'int' },
  ];
  return finish(P, { summary, tables, steps, notes, warnings, used });
}

export const ENGINES = { vat, corpTax, provisionalTax, smm, lateFee };
