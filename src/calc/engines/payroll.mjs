/* Boraden — bordro, gelir vergisi ve tazminat motorları.
   Motorlar: grossNet · employerCost · minWage · incomeTax · severance · notice

   • Oranlar, limitler, tarifeler, tavanlar yalnızca `params` (src/data/params/<yıl>-bordro.json) içinden okunur; kodda yıl/oran gömülü değildir.
   • Aritmetik: para kuruş cinsinden BigInt, oranlar 1e-8 ölçekli BigInt; yuvarlama "yarım yukarı" (Python Decimal ROUND_HALF_UP ile aynı).
     Kayan nokta kayması yoktur; sonuçlar docs/research/payroll_check.py ile kuruşu kuruşuna eşleşir.
   • Yalnızca '../util.mjs' içe aktarılır (JSON/Node API/Date yok); "bugün" girdiyle gelir. Kullanıcı girdisi sorunu → InputError. */
import { InputError, round2, optNum, needNum, needChoice, needDate, bool, pickEffective, ymdDiff, addDays, S, col } from '../util.mjs';

/* ---------- Kesin aritmetik (BigInt, kuruş) ---------- */
const ZERO = 0n;
const RS = 100000000n; // oran ölçeği 1e8
const K = (tl) => BigInt(Math.round(round2(tl) * 100)); // TL (sayı) → kuruş
const TL = (k) => Number(k) / 100; // kuruş → TL (2 haneli sayı)
const R = (x) => BigInt(Math.round(x * 1e8)); // kesir oran → ölçekli tamsayı

/** a / b, yarım yukarı (sıfırdan uzağa); b > 0. */
function divR(a, b) {
  const neg = a < ZERO;
  const x = neg ? -a : a;
  const q = (2n * x + b) / (2n * b);
  return neg ? -q : q;
}
const mulR = (k, r) => divR(k * r, RS); // kuruş × oran → kuruş
const bmin = (a, b) => (a < b ? a : b);
const bmax = (a, b) => (a > b ? a : b);
const babs = (a) => (a < ZERO ? -a : a);
const clampK = (v, lo, hi) => bmax(lo, bmin(v, hi));

/* ---------- Metin biçimleri ---------- */
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTH_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const nf = (x, d = 2) => {
  const [i, f] = Math.abs(x).toFixed(d).split('.');
  return (x < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
};
const tl = (x) => `${nf(x)} ₺`;
const pctUnit = (rate) => Number((rate * 100).toFixed(4)); // kesir → yüzde birimi
const pc = (rate) => `%${String(pctUnit(rate)).replace('.', ',')}`;
const trDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const fmtSpan = (d) => `${d.years} yıl ${d.months} ay ${d.days} gün`;

/* ---------- Parametre erişimi ---------- */
function sect(params, key) {
  const p = params && params[key];
  if (!p || typeof p !== 'object') throw new InputError(`Parametre dosyasında "${key}" bölümü bulunamadı.`);
  return p;
}
/** Tarihe göre geçerli dönem kaydı; kapsam dışıysa en yakın dönem döner (exact=false). */
function effective(list, iso) {
  if (!Array.isArray(list) || !list.length) throw new InputError('Parametre dosyasında dönem listesi boş.');
  const hit = pickEffective(list, iso);
  if (hit) return { item: hit, exact: true };
  return { item: iso < (list[0].from || '') ? list[0] : list[list.length - 1], exact: false };
}
const monthStart = (year, m) => `${year}-${String(m).padStart(2, '0')}-01`;
const unverified = (params, keys) =>
  keys.filter((k) => params[k] && params[k].needsVerification).map((k) => params[k].warning || `"${k}" parametresi doğrulanmamıştır; sonucu teyit edin.`);

/* ---------- Gelir vergisi tarifesi ---------- */
function makeTariff(list) {
  if (!Array.isArray(list) || !list.length) throw new InputError('Gelir vergisi tarifesi parametrelerde bulunamadı.');
  const out = [];
  let lower = ZERO;
  for (const b of list) {
    const upper = b.upTo === null || b.upTo === undefined ? null : K(b.upTo);
    out.push({ lower, upper, rate: R(b.rate), rateF: b.rate });
    if (upper !== null) lower = upper;
  }
  return out;
}
/** Kümülatif matraha uygulanan tam (yuvarlanmamış) vergi; 1e-8 ölçekli kuruş. */
function taxScaled(t, cumK) {
  if (cumK <= ZERO) return ZERO;
  let sum = ZERO;
  for (const b of t) {
    const top = b.upper === null || cumK < b.upper ? cumK : b.upper;
    if (top > b.lower) sum += (top - b.lower) * b.rate;
    if (b.upper === null || cumK <= b.upper) break;
  }
  return sum;
}
/** Matrahın bulunduğu dilim (sınırdaki tutar alt dilimde sayılır). */
function bracketIdx(t, cumK) {
  for (let i = 0; i < t.length; i++) if (t[i].upper === null || cumK <= t[i].upper) return i;
  return t.length - 1;
}

/* ---------- Bağlam: parametrelerden hesap nesnesi ---------- */
function makeCtx(params, retired) {
  const year = params && params.meta && params.meta.year;
  if (!year) throw new InputError('Parametre dosyasında meta.year bulunamadı.');
  const it = sect(params, 'incomeTax');
  const er = sect(params, 'employeeRates');
  const em = sect(params, 'employerRates');
  const st = sect(params, 'stampTax');
  const bounds = sect(params, 'sgkBounds').periods;
  const mw = sect(params, 'minWage').periods;
  if (retired) sect(params, 'sgdp');
  const sg = params.sgdp;
  return {
    year,
    params,
    retired: !!retired,
    wage: makeTariff(it.wage),
    other: makeTariff(it.other),
    empSgk: R(er.sgk),
    empIss: R(er.unemployment),
    erSgk: R(em.sgk),
    erIss: R(em.unemployment),
    stamp: R(st.wageRate),
    sgdpEmp: sg ? R(sg.employeeRate) : ZERO,
    sgdpEr: sg ? R(sg.employerRate) : ZERO,
    bounds: (m) => {
      const e = effective(bounds, monthStart(year, m)).item;
      return { floor: K(e.floor), ceil: K(e.ceiling) };
    },
    minWage: (m) => {
      const e = effective(mw, monthStart(year, m)).item;
      return { gross: K(e.gross), net: e.net, daily: e.daily };
    },
  };
}

/** Asgari ücret GV ve DV istisnası, ay ay (1–12): asgari ücretin kendi kümülatif matrahı üzerindeki vergi (ücret tarifesi). */
function exemptions(ctx) {
  if (ctx.ex) return ctx.ex;
  const gv = [null];
  const dv = [null];
  let cum = ZERO;
  let prev = ZERO;
  for (let m = 1; m <= 12; m++) {
    const w = ctx.minWage(m).gross;
    const b = ctx.bounds(m);
    const base = clampK(w, b.floor, b.ceil);
    cum += w - mulR(base, ctx.empSgk) - mulR(base, ctx.empIss);
    const t = taxScaled(ctx.wage, cum);
    gv.push(divR(t - prev, RS));
    prev = t;
    dv.push(mulR(w, ctx.stamp));
  }
  ctx.ex = { gv, dv };
  return ctx.ex;
}

/** Tek ay bordrosu: brüt → net (kuruş cinsinden). cumPrevK = önceki aylardan devreden kümülatif GV matrahı. */
function calcMonth(ctx, m, grossK, cumPrevK) {
  const b = ctx.bounds(m);
  const base = clampK(grossK, b.floor, b.ceil);
  const sgk = mulR(base, ctx.retired ? ctx.sgdpEmp : ctx.empSgk);
  const iss = ctx.retired ? ZERO : mulR(base, ctx.empIss);
  const matrah = grossK - sgk - iss;
  const cum = cumPrevK + matrah;
  const gvGross = divR(taxScaled(ctx.wage, cum) - taxScaled(ctx.wage, cumPrevK), RS);
  const ex = exemptions(ctx);
  const gvIst = bmin(gvGross, ex.gv[m]);
  const dvGross = mulR(grossK, ctx.stamp);
  const dvIst = bmin(dvGross, ex.dv[m]);
  const gv = gvGross - gvIst;
  const dv = dvGross - dvIst;
  return { m, gross: grossK, base, sgk, iss, matrah, cumPrev: cumPrevK, cum, gvGross, gvIst, gv, dvGross, dvIst, dv, net: grossK - sgk - iss - gv - dv };
}

/**
 * Netten brüte (bir ay): net ücret sabit; brüt kuruş kuruşuna çözülür.
 * Net, brütün (neredeyse) artan bir fonksiyonudur; bileşen yuvarlamaları nedeniyle birkaç kuruşluk dalgalanma olabilir.
 * Bu yüzden: (1) "net ≥ hedef" koşuluyla ikili arama, (2) bulunan noktanın çevresinde ±16 kuruş taranır;
 * hedefi tam veren en küçük brüt seçilir (yoksa en yakın net).
 */
function solveGross(ctx, m, targetK, cumPrevK) {
  const lo0 = ctx.bounds(m).floor;
  const f = (g) => calcMonth(ctx, m, g, cumPrevK);
  let hi = targetK * 2n + 10000n;
  while (f(hi).net < targetK) hi *= 2n;
  let a = lo0;
  let b = hi;
  if (f(a).net >= targetK) b = a;
  else {
    while (b - a > 1n) {
      const mid = (a + b) / 2n;
      if (f(mid).net >= targetK) b = mid;
      else a = mid;
    }
  }
  let best = null;
  for (let g = bmax(lo0, b - 16n); g <= b + 16n; g++) {
    const r = f(g);
    const d = babs(r.net - targetK);
    if (best === null || d < best.d) best = { r, d };
  }
  return best.r;
}

const result = (o) => ({ summary: [], tables: [], steps: [], notes: [], warnings: [], ...o });
const used = (params, items) => ({ id: params.meta.id, items });

/* =====================================================================
   1) grossNet — Maaş hesaplama (brüt → net, net → brüt), kümülatif GV matrahlı aylık tablo
   ===================================================================== */
function eGrossNet(inputs, params) {
  const mode = needChoice(inputs, 'mode', ['gross', 'net'], { label: 'Hesap türü', def: 'gross' });
  const retired = bool(inputs.retired);
  const ctx = makeCtx(params, retired);
  const startMonth = Number(needChoice(inputs, 'startMonth', MONTH_VALUES, { label: 'Başlangıç ayı', def: '1' }));
  const cumStart = K(optNum(inputs, 'cumBase', 0, { label: 'Önceki aylardan devreden kümülatif matrah', min: 0, max: 1e11 }));
  const b0 = ctx.bounds(startMonth);
  const warnings = [];
  const notes = [];
  const rows = [];
  let targetK = null;

  if (mode === 'gross') {
    const gK = K(needNum(inputs, 'gross', { label: 'Aylık brüt ücret', min: 0, max: 1e9 }));
    if (gK < b0.floor) {
      throw new InputError(`Aylık brüt ücret, prime esas kazanç alt sınırının (asgari ücret: ${tl(TL(b0.floor))}) altında olamaz.`, 'gross');
    }
    let cum = cumStart;
    for (let m = startMonth; m <= 12; m++) {
      const r = calcMonth(ctx, m, gK, cum);
      rows.push(r);
      cum = r.cum;
    }
  } else {
    targetK = K(needNum(inputs, 'net', { label: 'Aylık net ücret', min: 0, max: 1e9 }));
    const minNet = calcMonth(ctx, startMonth, b0.floor, cumStart).net;
    if (targetK < minNet) {
      throw new InputError(`Net ücret, asgari ücret düzeyindeki brüt tutardan elde edilen netin (${tl(TL(minNet))}) altında olamaz.`, 'net');
    }
    let cum = cumStart;
    for (let m = startMonth; m <= 12; m++) {
      const r = solveGross(ctx, m, targetK, cum);
      rows.push(r);
      cum = r.cum;
    }
    if (rows.some((r) => r.net !== targetK)) {
      warnings.push('Bazı aylarda hedef net ücret kuruşu kuruşuna eşlenemedi; en yakın brüt tutar kullanıldı (en fazla 0,01 ₺ sapma).');
    }
    notes.push('Net ücret her ay sabit tutulmuş, brüt ücret her ay için ayrıca çözülmüştür; kümülatif matrah arttıkça aynı net için gereken brüt artar.');
  }
  if (rows.some((r) => r.gross > ctx.bounds(r.m).ceil)) {
    warnings.push(`Brüt ücret SGK prime esas kazanç üst sınırının (${tl(TL(ctx.bounds(startMonth).ceil))}) üzerinde; SGK ve işsizlik primi üst sınır üzerinden hesaplanmıştır.`);
  }
  warnings.push(...(retired ? unverified(params, ['sgdp']) : []));

  /* tablo */
  const T = ctx.wage;
  const trows = rows.map((r) => {
    const i0 = bracketIdx(T, r.cumPrev);
    const i1 = bracketIdx(T, r.cum);
    if (i1 > i0) {
      const limit = T[i1 - 1].upper;
      notes.push(`${MONTHS[r.m - 1]} ayında kümülatif matrah ${tl(TL(limit))} sınırını aşar; bu aydan itibaren gelir vergisi dilimi ${pc(T[i1].rateF)} olur.`);
    }
    return {
      month: MONTHS[r.m - 1],
      gross: TL(r.gross),
      sgk: TL(r.sgk),
      iss: TL(r.iss),
      matrah: TL(r.matrah),
      cum: TL(r.cum),
      band: i0 === i1 ? pc(T[i1].rateF) : `${pc(T[i0].rateF)} → ${pc(T[i1].rateF)}`,
      gv: TL(r.gv),
      dv: TL(r.dv),
      exempt: TL(r.gvIst + r.dvIst),
      net: TL(r.net),
    };
  });
  const sum = (f) => rows.reduce((a, r) => a + f(r), ZERO);
  const sGross = sum((r) => r.gross);
  const sNet = sum((r) => r.net);
  const sDed = sGross - sNet;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const period = startMonth === 1 ? 'Yıllık' : `${MONTHS[startMonth - 1]}–Aralık`;

  const summary =
    mode === 'gross'
      ? [
          S.money('İlk ay net ücret', TL(first.net), { main: true }),
          S.money('Son ay net ücret', TL(last.net)),
          S.money(`${period} net toplam`, TL(sNet), { main: true }),
          S.money(`${period} brüt toplam`, TL(sGross)),
          S.money(`${period} toplam kesinti`, TL(sDed), { hint: 'SGK, işsizlik, gelir vergisi ve damga vergisi (istisna sonrası)' }),
          S.money('Ortalama aylık net', TL(divR(sNet, BigInt(rows.length)))),
        ]
      : [
          S.money('Aylık net ücret (sabit)', TL(targetK)),
          S.money('İlk ay brüt ücret', TL(first.gross), { main: true }),
          S.money('Son ay brüt ücret', TL(last.gross), { main: true }),
          S.money(`${period} brüt toplam`, TL(sGross)),
          S.money(`${period} net toplam`, TL(sNet)),
          S.money(`${period} toplam kesinti`, TL(sDed), { hint: 'SGK, işsizlik, gelir vergisi ve damga vergisi (istisna sonrası)' }),
        ];

  /* adımlar: ilk ay */
  const er = params.employeeRates;
  const sgkRate = retired ? params.sgdp.employeeRate : er.sgk;
  const r0 = first;
  const bounds0 = ctx.bounds(r0.m);
  const steps = [];
  if (mode === 'net') steps.push(S.money('Hedef net ücret (her ay)', TL(targetK)));
  steps.push(
    S.money(mode === 'net' ? 'Brüt ücret (çözülen, ilk ay)' : 'Brüt ücret (ilk ay)', TL(r0.gross)),
    S.money('SGK işçi payı' + (retired ? ' (SGDP)' : ''), TL(r0.sgk), {
      formula: `${nf(TL(r0.base))} × ${pc(sgkRate)}` + (r0.base !== r0.gross ? ' (prime esas kazanç sınırı uygulandı)' : ''),
    })
  );
  if (!retired) steps.push(S.money('İşsizlik sigortası işçi payı', TL(r0.iss), { formula: `${nf(TL(r0.base))} × ${pc(er.unemployment)}` }));
  steps.push(
    S.money('Gelir vergisi matrahı', TL(r0.matrah), { formula: `${nf(TL(r0.gross))} − ${nf(TL(r0.sgk))} − ${nf(TL(r0.iss))}` }),
    S.money('Kümülatif matrah (ay sonu)', TL(r0.cum), { formula: `${nf(TL(r0.cumPrev))} + ${nf(TL(r0.matrah))}` }),
    S.money('Gelir vergisi (istisna öncesi)', TL(r0.gvGross), { formula: 'ücret tarifesi, kümülatif matrah farkı' }),
    S.money('Asgari ücret gelir vergisi istisnası', TL(r0.gvIst), { formula: 'asgari ücretin kendi kümülatif matrahı üzerindeki vergi' }),
    S.money('Gelir vergisi', TL(r0.gv), { formula: `${nf(TL(r0.gvGross))} − ${nf(TL(r0.gvIst))}` }),
    S.money('Damga vergisi (istisna öncesi)', TL(r0.dvGross), { formula: `${nf(TL(r0.gross))} × binde ${String(pctUnit(params.stampTax.wageRate * 10)).replace('.', ',')}` }),
    S.money('Asgari ücret damga vergisi istisnası', TL(r0.dvIst)),
    S.money('Damga vergisi', TL(r0.dv)),
    S.money('Net ücret (ilk ay)', TL(r0.net), { formula: 'brüt − SGK − işsizlik − gelir vergisi − damga vergisi' })
  );

  notes.unshift(
    'Asgari ücretin gelir vergisi ve damga vergisi istisnası her ay uygulanır; istisna, hesaplanan verginin üzerine çıkamaz. Asgari geçim indirimi (AGİ) uygulanmaz.'
  );
  if (mode === 'gross') notes.push('Brüt ücretin tüm aylarda aynı olduğu varsayılmıştır.');
  if (startMonth > 1 && cumStart === ZERO) {
    notes.push('Başlangıç ayı Ocak değil ve önceki aylardan devreden matrah 0 girildi; gelir vergisi dilimleri yılbaşından bu yana biriken matrahı yansıtmayabilir.');
  }

  const mwFirst = ctx.minWage(1);
  const ex = exemptions(ctx);
  return result({
    summary,
    tables: [
      {
        title: `Aylık döküm (${period === 'Yıllık' ? params.meta.year : period})`,
        note: 'GV ve DV sütunları asgari ücret istisnası düşüldükten sonraki tutarlardır; İstisnalar sütunu iki istisnanın toplamıdır. Dilim sütunu ayın sonundaki kümülatif matrahın bulunduğu vergi oranını gösterir.',
        columns: [
          col('month', 'Ay', 'text'),
          col('gross', 'Brüt'),
          col('sgk', retired ? 'SGDP' : 'SGK işçi'),
          col('iss', 'İşsizlik'),
          col('matrah', 'GV matrahı'),
          col('cum', 'Kümülatif matrah'),
          col('band', 'Dilim', 'text', 'right'),
          col('gv', 'Gelir vergisi'),
          col('dv', 'Damga vergisi'),
          col('exempt', 'İstisnalar'),
          col('net', 'Net'),
        ],
        rows: trows,
        footer: {
          month: 'Toplam',
          gross: TL(sGross),
          sgk: TL(sum((r) => r.sgk)),
          iss: TL(sum((r) => r.iss)),
          matrah: TL(sum((r) => r.matrah)),
          gv: TL(sum((r) => r.gv)),
          dv: TL(sum((r) => r.dv)),
          exempt: TL(sum((r) => r.gvIst + r.dvIst)),
          net: TL(sNet),
        },
      },
    ],
    steps,
    notes,
    warnings,
    paramsUsed: used(params, [
      { label: retired ? 'SGDP işçi payı' : 'SGK işçi payı', value: pctUnit(sgkRate), kind: 'percent' },
      ...(retired ? [] : [{ label: 'İşsizlik sigortası işçi payı', value: pctUnit(er.unemployment), kind: 'percent' }]),
      { label: 'Damga vergisi (ücret)', value: pctUnit(params.stampTax.wageRate), kind: 'percent' },
      { label: 'SGK prime esas kazanç alt sınırı', value: TL(bounds0.floor), kind: 'money' },
      { label: 'SGK prime esas kazanç üst sınırı', value: TL(bounds0.ceil), kind: 'money' },
      { label: 'Gelir vergisi tarifesi', value: `Ücret tarifesi (${T.length} dilim)`, kind: 'text' },
      { label: 'Asgari ücret (brüt)', value: TL(mwFirst.gross), kind: 'money' },
      { label: 'Asgari ücret GV istisnası (ilk ay)', value: TL(ex.gv[1]), kind: 'money' },
      { label: 'Asgari ücret DV istisnası', value: TL(ex.dv[1]), kind: 'money' },
    ]),
  });
}

/* =====================================================================
   2) employerCost — İşveren maliyeti (aylık/yıllık), teşvik varyantları, asgari ücret desteği
   ===================================================================== */
/** Bir ayın işveren maliyeti: brüt + SGK işveren payı (teşvik indirimli) + işsizlik işveren payı. */
function employerMonth(ctx, m, grossK, points) {
  const b = ctx.bounds(m);
  const base = clampK(grossK, b.floor, b.ceil);
  const rate = ctx.retired ? ctx.sgdpEr : ctx.erSgk - R(points);
  const sgk = mulR(base, rate);
  const iss = ctx.retired ? ZERO : mulR(base, ctx.erIss);
  return { base, rate, sgk, iss, total: grossK + sgk + iss };
}

function eEmployerCost(inputs, params) {
  const retired = bool(inputs.retired);
  const ctx = makeCtx(params, retired);
  const inc = sect(params, 'employerIncentives');
  const incId = needChoice(inputs, 'incentive', inc.options.map((o) => o.id), { label: 'Teşvik durumu', def: 'none' });
  const opt = inc.options.find((o) => o.id === incId);
  const useSupport = bool(inputs.support);
  const supp = sect(params, 'minWageSupport');
  const m = 1;
  const b = ctx.bounds(m);
  const gK = K(needNum(inputs, 'gross', { label: 'Aylık brüt ücret', min: 0, max: 1e9 }));
  if (gK < b.floor) {
    throw new InputError(`Aylık brüt ücret, prime esas kazanç alt sınırının (asgari ücret: ${tl(TL(b.floor))}) altında olamaz.`, 'gross');
  }
  const points = retired ? 0 : opt.points;
  const c = employerMonth(ctx, m, gK, points);
  const supportK = useSupport ? K(supp.perDay) * BigInt(supp.days) : ZERO;
  const total = c.total - supportK;
  const warnings = [];
  const notes = [];
  if (gK > b.ceil) {
    warnings.push(`Brüt ücret SGK prime esas kazanç üst sınırının (${tl(TL(b.ceil))}) üzerinde; işveren payları üst sınır üzerinden hesaplanmıştır.`);
  }
  if (retired) {
    warnings.push(...unverified(params, ['sgdp']));
    if (incId !== 'none') notes.push('Emekli (SGDP) çalışanlar için işveren teşviki uygulanmaz; seçilen teşvik dikkate alınmamıştır.');
  } else if (opt.points > 0) {
    notes.push(inc.conditions);
    if (opt.to) notes.push(`${opt.label}: ${trDate(opt.to)} tarihine kadar öngörülmüştür; sonrası için düzenleme izlenmelidir.`);
  }
  if (useSupport) {
    warnings.push(...unverified(params, ['minWageSupport']));
    notes.push(supp.conditions);
  }
  notes.push('SGK işveren payı, resmî standart orandan hesaplanır; işyerinin tehlike sınıfına göre kısa vadeli sigorta primi farklı olabilir. Yıllık tutar, aylık tutarın 12 ile çarpımıdır.');

  const yr = (k) => TL(k * 12n);
  const trows = [
    { item: 'Brüt ücret', monthly: TL(gK), annual: yr(gK) },
    { item: `SGK işveren payı (${pc(Number(c.rate) / 1e8)}${!retired && opt.points > 0 ? `, ${opt.label.split(' (')[0]}` : ''})`, monthly: TL(c.sgk), annual: yr(c.sgk) },
  ];
  if (!retired) trows.push({ item: `İşsizlik sigortası işveren payı (${pc(params.employerRates.unemployment)})`, monthly: TL(c.iss), annual: yr(c.iss) });
  if (useSupport) trows.push({ item: 'Asgari ücret desteği (düşülür)', monthly: -TL(supportK), annual: -yr(supportK) });

  const shares = c.sgk + c.iss;
  return result({
    summary: [
      S.money('Aylık toplam işveren maliyeti', TL(total), { main: true }),
      S.money('Yıllık toplam işveren maliyeti', yr(total), { main: true }),
      S.money('İşveren payları toplamı (aylık)', TL(shares), { hint: 'SGK işveren payı + işsizlik işveren payı' }),
      S.percent('Brüt ücret / maliyet oranı', Number(((TL(gK) / TL(total)) * 100).toFixed(4))),
      S.money('SGK işveren payı (aylık)', TL(c.sgk)),
      ...(useSupport ? [S.money('Asgari ücret desteği (aylık)', TL(supportK))] : [S.money('İşsizlik işveren payı (aylık)', TL(c.iss))]),
    ],
    tables: [
      {
        title: 'Maliyet dökümü',
        note: 'Yıllık sütun, sabit brüt ücretle 12 ayın toplamıdır.',
        columns: [col('item', 'Kalem', 'text'), col('monthly', 'Aylık'), col('annual', 'Yıllık')],
        rows: trows,
        footer: { item: 'Toplam işveren maliyeti', monthly: TL(total), annual: yr(total) },
      },
    ],
    steps: [
      S.money('Brüt ücret', TL(gK)),
      S.money('SGK prime esas kazanç', TL(c.base), { formula: c.base !== gK ? 'prime esas kazanç üst sınırı uygulandı' : 'brüt ücrete eşit' }),
      S.money('SGK işveren payı', TL(c.sgk), { formula: `${nf(TL(c.base))} × ${pc(Number(c.rate) / 1e8)}` }),
      ...(retired ? [] : [S.money('İşsizlik sigortası işveren payı', TL(c.iss), { formula: `${nf(TL(c.base))} × ${pc(params.employerRates.unemployment)}` })]),
      ...(useSupport ? [S.money('Asgari ücret desteği', -TL(supportK), { formula: `${nf(supp.perDay)} × ${supp.days} gün` })] : []),
      S.money('Toplam işveren maliyeti (aylık)', TL(total), { formula: 'brüt + işveren payları' + (useSupport ? ' − destek' : '') }),
    ],
    notes,
    warnings,
    paramsUsed: used(params, [
      { label: retired ? 'SGDP işveren payı' : 'SGK işveren payı (teşviksiz)', value: pctUnit(retired ? params.sgdp.employerRate : params.employerRates.sgk), kind: 'percent' },
      ...(retired ? [] : [{ label: 'İşsizlik işveren payı', value: pctUnit(params.employerRates.unemployment), kind: 'percent' }]),
      ...(!retired && opt.points > 0 ? [{ label: 'Uygulanan indirim (puan)', value: pctUnit(opt.points), kind: 'percent' }] : []),
      { label: 'SGK prime esas kazanç alt sınırı', value: TL(b.floor), kind: 'money' },
      { label: 'SGK prime esas kazanç üst sınırı', value: TL(b.ceil), kind: 'money' },
      ...(useSupport ? [{ label: 'Asgari ücret desteği (gün başına)', value: supp.perDay, kind: 'money' }] : []),
    ]),
  });
}

/* =====================================================================
   3) minWage — Asgari ücret dökümü (brüt → net, işveren maliyeti, günlük brüt)
   ===================================================================== */
function eMinWage(inputs, params) {
  const ctx = makeCtx(params, false);
  const year = ctx.year;
  const date = needDate(inputs, 'date', { label: 'Hesaplama tarihi', min: '1990-01-01', max: '2100-12-31' });
  const periods = sect(params, 'minWage').periods;
  const { item: period, exact } = effective(periods, date);
  const inc = sect(params, 'employerIncentives');
  const warnings = [];
  const notes = [];
  if (!exact) {
    warnings.push(
      `Seçilen tarih (${trDate(date)}) için asgari ücret verisi bulunmuyor; ${trDate(period.from)}–${trDate(period.to)} dönemi gösteriliyor. Yeni dönem açıklandığında tutarlar değişebilir.`
    );
  }
  /* 12 aylık tablo (parametre yılı) */
  let cum = ZERO;
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const r = calcMonth(ctx, m, ctx.minWage(m).gross, cum);
    rows.push(r);
    cum = r.cum;
  }
  const idx = date.slice(0, 4) === String(year) ? Number(date.slice(5, 7)) : date < `${year}-01-01` ? 1 : 12;
  const cur = rows[idx - 1];
  if (period.net !== undefined && TL(cur.net) !== period.net) {
    warnings.push(`Hesaplanan net asgari ücret (${tl(TL(cur.net))}), yayımlanan resmî net tutardan (${tl(period.net)}) farklı; parametreleri kontrol edin.`);
  }
  const sum = (f) => rows.reduce((a, r) => a + f(r), ZERO);

  /* işveren maliyeti senaryoları (seçilen tarihte yürürlükte olanlar) */
  const gK = cur.gross;
  const scen = inc.options
    .filter((o) => (!o.from || o.from <= date) && (!o.to || date <= o.to))
    .map((o) => ({ o, c: employerMonth(ctx, idx, gK, o.points) }));
  const skipped = inc.options.filter((o) => !scen.some((s) => s.o === o));
  if (skipped.length) notes.push(`${skipped.map((o) => o.label).join(', ')} seçeneği ${trDate(date)} tarihinde yürürlükte olmadığı için gösterilmemiştir.`);
  notes.push('İşveren maliyeti, ÇSGB tablosundaki gibi asgari ücret desteği düşülmeden gösterilir. Teşvik indirimleri; beyanname, ödeme ve prim borcu koşullarına bağlıdır.');
  notes.push('Asgari ücretten gelir vergisi ve damga vergisi kesilmez: istisna tutarları, asgari ücretin kendi kümülatif matrahı üzerinden hesaplanan vergiye eşittir.');

  const daily = period.daily !== undefined ? period.daily : TL(divR(gK, 30n));
  return result({
    summary: [
      S.money('Brüt asgari ücret (aylık)', TL(gK), { main: true }),
      S.money('Net asgari ücret (aylık)', TL(cur.net), { main: true }),
      S.money('Günlük brüt asgari ücret', daily),
      ...scen.slice(0, 3).map((s) => S.money(`İşveren maliyeti: ${s.o.label}`, TL(s.c.total))),
    ],
    tables: [
      {
        title: `Aylık döküm (${year}, brütten nete)`,
        note: 'Her ayın gelir vergisi ve damga vergisi, asgari ücret istisnasıyla tamamen karşılanır; net ücret her ay aynıdır. Yıl içinde asgari ücret değişirse tablo yeni döneme göre yenilenir.',
        columns: [
          col('month', 'Ay', 'text'),
          col('gross', 'Brüt'),
          col('sgk', 'SGK işçi'),
          col('iss', 'İşsizlik'),
          col('gvGross', 'GV (hesaplanan)'),
          col('gvIst', 'GV istisnası'),
          col('dvGross', 'DV (hesaplanan)'),
          col('dvIst', 'DV istisnası'),
          col('net', 'Net'),
        ],
        rows: rows.map((r) => ({
          month: MONTHS[r.m - 1],
          gross: TL(r.gross),
          sgk: TL(r.sgk),
          iss: TL(r.iss),
          gvGross: TL(r.gvGross),
          gvIst: TL(r.gvIst),
          dvGross: TL(r.dvGross),
          dvIst: TL(r.dvIst),
          net: TL(r.net),
        })),
        footer: {
          month: 'Toplam',
          gross: TL(sum((r) => r.gross)),
          sgk: TL(sum((r) => r.sgk)),
          iss: TL(sum((r) => r.iss)),
          gvGross: TL(sum((r) => r.gvGross)),
          gvIst: TL(sum((r) => r.gvIst)),
          dvGross: TL(sum((r) => r.dvGross)),
          dvIst: TL(sum((r) => r.dvIst)),
          net: TL(sum((r) => r.net)),
        },
      },
      {
        title: `İşveren maliyeti (${MONTHS[idx - 1]} ${year})`,
        note: 'Tutarlar aylıktır; asgari ücret desteği düşülmemiştir.',
        columns: [col('item', 'Teşvik durumu', 'text'), col('sgk', 'SGK işveren'), col('iss', 'İşsizlik işveren'), col('total', 'Toplam maliyet')],
        rows: scen.map((s) => ({ item: s.o.label, sgk: TL(s.c.sgk), iss: TL(s.c.iss), total: TL(s.c.total) })),
      },
    ],
    steps: [
      S.money('Brüt asgari ücret', TL(cur.gross)),
      S.money('SGK işçi payı', TL(cur.sgk), { formula: `${nf(TL(cur.base))} × ${pc(params.employeeRates.sgk)}` }),
      S.money('İşsizlik sigortası işçi payı', TL(cur.iss), { formula: `${nf(TL(cur.base))} × ${pc(params.employeeRates.unemployment)}` }),
      S.money('Gelir vergisi matrahı', TL(cur.matrah), { formula: `${nf(TL(cur.gross))} − ${nf(TL(cur.sgk))} − ${nf(TL(cur.iss))}` }),
      S.money('Gelir vergisi istisnası', TL(cur.gvIst), { formula: 'asgari ücretin kümülatif matrahı üzerindeki vergi' }),
      S.money('Damga vergisi istisnası', TL(cur.dvIst), { formula: `${nf(TL(cur.gross))} × binde ${String(pctUnit(params.stampTax.wageRate * 10)).replace('.', ',')}` }),
      S.money('Net asgari ücret', TL(cur.net), { formula: 'brüt − SGK − işsizlik' }),
    ],
    notes,
    warnings,
    paramsUsed: used(params, [
      { label: 'Asgari ücret (brüt)', value: TL(gK), kind: 'money' },
      { label: 'Geçerlilik dönemi', value: `${trDate(period.from)} – ${trDate(period.to)}`, kind: 'text' },
      { label: 'SGK işçi payı', value: pctUnit(params.employeeRates.sgk), kind: 'percent' },
      { label: 'İşsizlik işçi payı', value: pctUnit(params.employeeRates.unemployment), kind: 'percent' },
      { label: 'SGK işveren payı (teşviksiz)', value: pctUnit(params.employerRates.sgk), kind: 'percent' },
      { label: 'İşsizlik işveren payı', value: pctUnit(params.employerRates.unemployment), kind: 'percent' },
      { label: 'Damga vergisi (ücret)', value: pctUnit(params.stampTax.wageRate), kind: 'percent' },
    ]),
  });
}

/* =====================================================================
   4) incomeTax — Yıllık matrahtan gelir vergisi (ücret / ücret dışı tarife), dilim tablosu
   ===================================================================== */
function eIncomeTax(inputs, params) {
  const income = needNum(inputs, 'income', { label: 'Yıllık gelir vergisi matrahı', min: 0, max: 1e11 });
  const kind = needChoice(inputs, 'tariff', ['wage', 'other'], { label: 'Tarife türü', def: 'wage' });
  const it = sect(params, 'incomeTax');
  const T = makeTariff(kind === 'wage' ? it.wage : it.other);
  const incK = K(income);
  const totalK = divR(taxScaled(T, incK), RS);
  const idx = bracketIdx(T, incK);
  const rows = [];
  const steps = [];
  let prev = ZERO;
  T.forEach((b, i) => {
    const top = b.upper === null ? incK : bmin(incK, b.upper);
    const slice = top > b.lower ? top - b.lower : ZERO;
    const cumRounded = divR(taxScaled(T, top), RS); // dilim vergileri, yuvarlanmış kümülatiflerin farkıdır → toplam = özet
    const tax = cumRounded - prev;
    prev = cumRounded;
    rows.push({
      name: `${i + 1}. dilim`,
      range: b.upper === null ? `${nf(TL(b.lower), 0)} ₺ üzeri` : `${nf(TL(b.lower), 0)} – ${nf(TL(b.upper), 0)} ₺`,
      rate: pctUnit(b.rateF),
      base: TL(slice),
      tax: TL(tax),
    });
    if (slice > ZERO) steps.push(S.money(`${i + 1}. dilim vergisi`, TL(tax), { formula: `${nf(TL(slice))} × ${pc(b.rateF)}` }));
  });
  steps.push(S.money('Toplam gelir vergisi', TL(totalK), { formula: 'dilim vergilerinin toplamı' }));

  const avg = incK > ZERO ? Number(((Number(totalK) / Number(incK)) * 100).toFixed(4)) : 0;
  const cur = T[idx];
  const rev = params.revaluation;
  const notes = [
    kind === 'wage'
      ? 'Ücret gelirleri tarifesi uygulanmıştır. Ücret dışı gelirler (ör. ticari kazanç, serbest meslek kazancı, kira geliri) için ayrı tarife seçeneğini kullanın.'
      : 'Ücret dışı gelirler tarifesi uygulanmıştır. Ücret gelirleri için ücret tarifesi seçeneğini kullanın; üçüncü dilim sınırı farklıdır.',
    'Girilen tutarın gelir vergisi matrahı olduğu varsayılır (istisna ve indirimler düşüldükten sonraki tutar). Mahsup edilecek stopaj, geçici vergi ve diğer vergiler hesaba katılmamıştır.',
  ];
  if (rev && typeof rev.rate === 'number') {
    notes.push(`Tarife sınırları, yeniden değerleme oranı (${pc(rev.rate)}) ile türetilmeden, ilgili Gelir Vergisi Genel Tebliği'nde yayımlanan tutarlar olarak alınmıştır.`);
  }
  return result({
    summary: [
      S.money('Hesaplanan gelir vergisi', TL(totalK), { main: true }),
      S.percent('Ortalama vergi oranı', avg, { main: true, hint: 'vergi / matrah' }),
      S.percent('Marjinal vergi oranı', pctUnit(cur.rateF), { hint: 'matrahın bulunduğu dilimin oranı' }),
      S.text('Bulunulan dilim', `${idx + 1}. dilim (${pc(cur.rateF)})`),
      cur.upper === null
        ? S.text('Dilimde kalan alan', 'Son dilim; üst sınır yok')
        : S.money('Dilimde kalan alan', TL(cur.upper - incK), { hint: 'bir üst dilime geçmeden eklenebilecek matrah' }),
      S.money('Vergi sonrası kalan tutar', TL(incK - totalK)),
    ],
    tables: [
      {
        title: `${kind === 'wage' ? 'Ücret' : 'Ücret dışı'} tarifesi — dilim dilim hesap`,
        note: 'Dilim vergileri, yuvarlanmış kümülatif vergilerin farkı olarak gösterilir; toplamları özetteki vergiye eşittir.',
        columns: [col('name', 'Dilim', 'text'), col('range', 'Matrah aralığı', 'text', 'right'), col('rate', 'Oran', 'percent'), col('base', 'Dilimdeki matrah'), col('tax', 'Vergi')],
        rows,
        footer: { name: 'Toplam', base: TL(incK), tax: TL(totalK) },
      },
    ],
    steps,
    notes,
    warnings: [],
    paramsUsed: used(params, [
      { label: 'Tarife', value: kind === 'wage' ? 'Ücret gelirleri' : 'Ücret dışı gelirler', kind: 'text' },
      { label: 'Dilim sayısı', value: T.length, kind: 'int' },
      ...(rev && typeof rev.rate === 'number' ? [{ label: `Yeniden değerleme oranı (${rev.year || params.meta.year})`, value: pctUnit(rev.rate), kind: 'percent' }] : []),
      { label: 'Tarife geçerlilik dönemi', value: `${trDate(it.from)} – ${trDate(it.to)}`, kind: 'text' },
    ]),
  });
}

/* =====================================================================
   5) severance — Kıdem tazminatı (tavan, damga vergisi, gelir vergisi istisnası)
   ===================================================================== */
const DATE_BOUNDS = { min: '1950-01-01', max: '2100-12-31' };

function readService(inputs, params) {
  const start = needDate(inputs, 'start', { label: 'İşe giriş tarihi', ...DATE_BOUNDS });
  const end = needDate(inputs, 'end', { label: 'İşten çıkış tarihi', ...DATE_BOUNDS });
  if (end < start) throw new InputError('İşten çıkış tarihi, işe giriş tarihinden önce olamaz.', 'end');
  const sp = sect(params, 'servicePeriod');
  const d = ymdDiff(start, sp.countEndDay ? addDays(end, 1) : end);
  const giy = K(needNum(inputs, 'gross', { label: 'Aylık brüt ücret', min: 0, max: 1e9 })) + K(optNum(inputs, 'benefits', 0, { label: 'Aylık yan haklar', min: 0, max: 1e9 }));
  if (giy <= ZERO) throw new InputError('Aylık brüt ücret 0 ₺\'den büyük olmalıdır.', 'gross');
  return { start, end, sp, d, giy };
}

function eSeverance(inputs, params) {
  const { start, end, sp, d, giy } = readService(inputs, params);
  const extraK = K(optNum(inputs, 'extra', 0, { label: 'Yasal tutarın üzerinde ödenen tutar', min: 0, max: 1e11 }));
  const cumK = K(optNum(inputs, 'cumBase', 0, { label: 'Önceki aylardan devreden kümülatif matrah', min: 0, max: 1e11 }));
  const sv = sect(params, 'severance');
  const ct = sect(params, 'compensationTax');
  const T = makeTariff(sect(params, 'incomeTax').wage);
  const warnings = [];

  const eff = effective(sv.ceilings, end);
  if (!eff.exact && end < sv.ceilings[0].from) {
    throw new InputError(`Çıkış tarihi için kıdem tazminatı tavanı tanımlı değil; bu araç ${trDate(sv.ceilings[0].from)} ve sonrasındaki çıkış tarihlerini hesaplar.`, 'end');
  }
  if (!eff.exact) {
    warnings.push(
      `Çıkış tarihi (${trDate(end)}) için açıklanmış tavan bulunmuyor; son açıklanan tavan (${tl(eff.item.amount)}, ${trDate(eff.item.from)}–${trDate(eff.item.to)}) kullanıldı. Yeni tavan açıklandığında sonuç değişebilir.`
    );
  }
  const tavan = K(eff.item.amount);
  const base = bmin(giy, tavan);
  if (giy > tavan) {
    warnings.push(`Aylık brüt ücret (yan haklar dahil: ${tl(TL(giy))}), kıdem tazminatı tavanını (${tl(TL(tavan))}) aştığı için hesapta tavan uygulandı.`);
  }
  const entitled = d.totalMonths >= 12 * sv.minServiceYears;
  if (!entitled) {
    warnings.push(`Hizmet süresi ${sv.minServiceYears} yıldan kısa olduğu için kıdem tazminatı hakkı doğmaz; yasal tutar 0 gösterilmiştir.`);
  }
  warnings.push(...unverified(params, ['compensationTax']));

  const num = BigInt(sp.dayBase * d.totalMonths + 12 * d.days);
  const den = BigInt(12 * sp.dayBase);
  const ratio = Number(num) / Number(den);
  const legalK = entitled ? divR(base * num, den) : ZERO;
  const paidK = legalK + extraK;
  const dvK = mulR(paidK, R(ct.stampRate));
  const gvK = extraK > ZERO ? divR(taxScaled(T, cumK + extraK) - taxScaled(T, cumK), RS) : ZERO;
  const netK = paidK - dvK - gvK;

  const notes = [
    'Hesaplama, iş sözleşmesinin kıdem tazminatına hak kazandıran bir nedenle sona erdiğini varsayar; fesih nedeni ayrıca değerlendirilmelidir.',
    `Hizmet süresinde tam yılı aşan kısım oranlanır: ay/12 ve gün/${sp.dayBase}.` + (sp.countEndDay ? ' Çıkış günü hizmet süresine dahildir.' : ''),
    'Kıdem tazminatından SGK primi kesilmez. Yasal tutar gelir vergisinden istisnadır; yalnızca yasal tutarın üzerinde ödenen kısım ücret gibi vergilenir.',
  ];
  if (extraK > ZERO) notes.push('Yasal tutarın üzerindeki ödeme, girilen kümülatif matraha eklenerek ücret tarifesiyle vergilendirilmiştir; damga vergisi toplam tutar üzerinden hesaplanmıştır.');

  return result({
    summary: [
      S.money(extraK > ZERO ? 'Toplam brüt tutar' : 'Brüt kıdem tazminatı', TL(paidK), { main: true }),
      S.money('Damga vergisi', TL(dvK)),
      S.money('Gelir vergisi', TL(gvK), { hint: extraK > ZERO ? 'yalnızca yasal tutarın üzerindeki kısım' : 'yasal tutar gelir vergisinden istisnadır' }),
      S.money('Net kıdem tazminatı', TL(netK), { main: true }),
      S.text('Hizmet süresi', fmtSpan(d)),
      S.money('Hesaba esas aylık ücret', TL(base), { hint: giy > tavan ? 'tavan uygulandı' : 'giydirilmiş brüt ücret' }),
    ],
    tables: [
      {
        title: 'Brütten nete döküm',
        columns: [col('item', 'Kalem', 'text'), col('amount', 'Tutar')],
        rows: [
          { item: 'Yasal kıdem tazminatı (brüt)', amount: TL(legalK) },
          ...(extraK > ZERO ? [{ item: 'Yasal tutarın üzerinde ödeme (brüt)', amount: TL(extraK) }] : []),
          { item: 'Damga vergisi', amount: -TL(dvK) },
          { item: 'Gelir vergisi', amount: -TL(gvK) },
        ],
        footer: { item: 'Net ele geçen tutar', amount: TL(netK) },
      },
    ],
    steps: [
      S.text('Hizmet süresi', fmtSpan(d), { formula: `${trDate(start)} – ${trDate(end)}` + (sp.countEndDay ? ' (çıkış günü dahil)' : '') }),
      S.number('Hizmet yılı oranı', Number(ratio.toFixed(6)), { formula: `${d.years} + ${d.months}/12 + ${d.days}/${sp.dayBase}` }),
      S.days('Kıdem tazminatına esas gün sayısı', Number((ratio * 30).toFixed(2)), { formula: `30 gün × ${String(Number(ratio.toFixed(6))).replace('.', ',')}` }),
      S.money('Giydirilmiş aylık brüt ücret', TL(giy), { formula: 'brüt ücret + düzenli yan haklar' }),
      S.money('Kıdem tazminatı tavanı', TL(tavan), { formula: `çıkış tarihindeki tavan (${trDate(eff.item.from)} – ${trDate(eff.item.to)})` }),
      S.money('Hesaba esas aylık ücret', TL(base), { formula: 'giydirilmiş brüt ücret ve tavandan düşük olan' }),
      S.money('Brüt kıdem tazminatı', TL(legalK), { formula: `${nf(TL(base))} × ${String(Number(ratio.toFixed(6))).replace('.', ',')}` }),
      S.money('Damga vergisi', TL(dvK), { formula: `${nf(TL(paidK))} × binde ${String(pctUnit(ct.stampRate * 10)).replace('.', ',')}` }),
      S.money('Gelir vergisi', TL(gvK), { formula: extraK > ZERO ? 'yasal tutarın üzerindeki kısım, ücret tarifesiyle' : 'yasal tutar istisna' }),
      S.money('Net kıdem tazminatı', TL(netK), { formula: 'brüt − damga vergisi − gelir vergisi' }),
    ],
    notes,
    warnings,
    paramsUsed: used(params, [
      { label: 'Kıdem tazminatı tavanı (çıkış tarihinde)', value: TL(tavan), kind: 'money' },
      { label: 'Tavan geçerlilik dönemi', value: `${trDate(eff.item.from)} – ${trDate(eff.item.to)}`, kind: 'text' },
      { label: 'Gün tabanı (eksik yıl)', value: sp.dayBase, kind: 'int' },
      { label: 'Damga vergisi', value: pctUnit(ct.stampRate), kind: 'percent' },
      { label: 'Asgari hizmet süresi (yıl)', value: sv.minServiceYears, kind: 'int' },
    ]),
  });
}

/* =====================================================================
   6) notice — İhbar tazminatı (4857 sayılı Kanun md.17), gelir vergisi ve damga vergisi
   ===================================================================== */
function eNotice(inputs, params) {
  const { start, end, sp, d, giy } = readService(inputs, params);
  const cumK = K(optNum(inputs, 'cumBase', 0, { label: 'Önceki aylardan devreden kümülatif matrah', min: 0, max: 1e11 }));
  const nt = sect(params, 'notice');
  const ct = sect(params, 'compensationTax');
  const T = makeTariff(sect(params, 'incomeTax').wage);

  let band = nt.bands[0];
  for (const b of nt.bands) {
    const ok = b.exclusive ? d.totalMonths > b.minMonths || (d.totalMonths === b.minMonths && d.days > 0) : d.totalMonths >= b.minMonths;
    if (ok) band = b;
  }
  const days = band.weeks * 7;
  const amountK = divR(giy * BigInt(days), BigInt(nt.dailyDivisor));
  const dvK = mulR(amountK, R(ct.stampRate));
  const gvK = divR(taxScaled(T, cumK + amountK) - taxScaled(T, cumK), RS);
  const netK = amountK - dvK - gvK;
  const dailyK = divR(giy, BigInt(nt.dailyDivisor));

  const warnings = [...unverified(params, ['compensationTax'])];
  if (d.days === 0 && nt.bands.some((b) => b.minMonths > 0 && b.minMonths === d.totalMonths)) warnings.push(nt.boundaryWarning);

  return result({
    summary: [
      S.money('İhbar tazminatı (brüt)', TL(amountK), { main: true }),
      S.text('İhbar süresi', `${band.weeks} hafta (${days} gün)`),
      S.money('Gelir vergisi', TL(gvK)),
      S.money('Damga vergisi', TL(dvK)),
      S.money('Net ihbar tazminatı', TL(netK), { main: true }),
      S.money('Günlük brüt ücret', TL(dailyK), { hint: 'giydirilmiş aylık ücret / 30' }),
    ],
    tables: [
      {
        title: 'Brütten nete döküm',
        columns: [col('item', 'Kalem', 'text'), col('amount', 'Tutar')],
        rows: [
          { item: 'İhbar tazminatı (brüt)', amount: TL(amountK) },
          { item: 'Gelir vergisi', amount: -TL(gvK) },
          { item: 'Damga vergisi', amount: -TL(dvK) },
        ],
        footer: { item: 'Net ele geçen tutar', amount: TL(netK) },
      },
    ],
    steps: [
      S.text('Hizmet süresi', fmtSpan(d), { formula: `${trDate(start)} – ${trDate(end)}` + (sp.countEndDay ? ' (çıkış günü dahil)' : '') }),
      S.int('İhbar süresi (hafta)', band.weeks, { formula: 'hizmet süresine göre 4857 sayılı Kanun md.17 bandı' }),
      S.days('İhbar süresi (gün)', days, { formula: `${band.weeks} × 7` }),
      S.money('Giydirilmiş aylık brüt ücret', TL(giy), { formula: 'brüt ücret + düzenli yan haklar' }),
      S.money('İhbar tazminatı (brüt)', TL(amountK), { formula: `${nf(TL(giy))} / ${nt.dailyDivisor} × ${days} gün` }),
      S.money('Gelir vergisi', TL(gvK), { formula: `kümülatif matrah ${nf(TL(cumK))} → ${nf(TL(cumK + amountK))} üzerinden ücret tarifesi` }),
      S.money('Damga vergisi', TL(dvK), { formula: `${nf(TL(amountK))} × binde ${String(pctUnit(ct.stampRate * 10)).replace('.', ',')}` }),
      S.money('Net ihbar tazminatı', TL(netK), { formula: 'brüt − gelir vergisi − damga vergisi' }),
    ],
    notes: [
      'İhbar tazminatı ücret niteliğindedir: SGK primi kesilmez; gelir vergisi, tutarın kümülatif matraha eklenmesiyle ücret tarifesine göre hesaplanır; damga vergisi de uygulanır.',
      'Asgari ücretin gelir vergisi ve damga vergisi istisnası bu tutara uygulanmamıştır; bordroya yansıtılış biçimine göre fark oluşabilir.',
      'İhbar süresine hiç uyulmadığı varsayılır. Süre kısmen kullanıldıysa yalnızca kullanılmayan günlerin ücreti esas alınmalıdır. Taraflar sözleşmeyle daha uzun süre belirlemiş olabilir.',
    ],
    warnings,
    paramsUsed: used(params, [
      { label: 'İhbar süresi (hafta)', value: band.weeks, kind: 'int' },
      { label: 'Günlük ücret böleni', value: nt.dailyDivisor, kind: 'int' },
      { label: 'Damga vergisi', value: pctUnit(ct.stampRate), kind: 'percent' },
      { label: 'Gelir vergisi tarifesi', value: 'Ücret tarifesi', kind: 'text' },
    ]),
  });
}

export const ENGINES = {
  grossNet: eGrossNet,
  employerCost: eEmployerCost,
  minWage: eMinWage,
  incomeTax: eIncomeTax,
  severance: eSeverance,
  notice: eNotice,
};
