// Araç arayüzleri: hesaplayıcı (form + sonuç) ve vergi takvimi.
// Hesaplayıcı: sayfadaki tanımdan (data-calc-def) form üretir; hesap çekirdeğini (src/calc/core.mjs) ve yıllık parametre
// dosyasını tembel yükler. Wagtail'de aynı tanım şeması CalculatorPage alanlarından gelir; bu dosya aynen kullanılır.
import { qs, qsa, fmtTR, parseTR } from './util.js';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad2 = (n) => String(n).padStart(2, '0');
const NF = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/* ── Biçimleme: sonuç satırlarının `kind` alanına göre */
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(iso ?? '');
}
export function fmt(kind, v, o = {}) {
  if (v === null || v === undefined || v === '') return '—';
  switch (kind) {
    case 'money':
      return `${fmtTR(Number(v), 2)} ₺`;
    case 'percent':
      return `%${NF.format(Number(v))}`;
    case 'int':
      return fmtTR(Number(v), 0);
    case 'number':
      return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: o.digits ?? 2 }).format(Number(v));
    case 'days':
      return `${fmtTR(Number(v), 0)} gün`;
    case 'date':
      return fmtDate(v);
    default:
      return String(v);
  }
}

/* ── Yükleyiciler: parametre dosyası (yıllık) ve hesap çekirdeği tembel yüklenir */
const paramsCache = new Map();
function loadParams(url) {
  if (!paramsCache.has(url)) {
    paramsCache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`parametre dosyası ${r.status}`);
        return r.json();
      })
    );
  }
  return paramsCache.get(url);
}
let coreP = null;
const loadCore = () => (coreP ||= import('../../calc/core.mjs'));

/* ── Girdi durumu */
// Tarih varsayılanı: ISO tarih ya da "today" / "today-5y" / "today+30d" / "today-3m" jetonu
function resolveDate(tok) {
  if (typeof tok !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) return tok;
  const m = /^today(?:([+-])(\d+)([dmy]))?$/.exec(tok);
  if (!m) return '';
  const now = new Date();
  let y = now.getFullYear();
  let mo = now.getMonth();
  let da = now.getDate();
  if (m[1]) {
    const n = Number(m[2]) * (m[1] === '-' ? -1 : 1);
    if (m[3] === 'd') {
      const t = new Date(y, mo, da + n);
      y = t.getFullYear();
      mo = t.getMonth();
      da = t.getDate();
    } else {
      const total = y * 12 + mo + (m[3] === 'y' ? n * 12 : n);
      y = Math.floor(total / 12);
      mo = total - y * 12;
      da = Math.min(da, new Date(y, mo + 1, 0).getDate());
    }
  }
  return `${y}-${pad2(mo + 1)}-${pad2(da)}`;
}
const defaultsOf = (def) => Object.fromEntries(def.inputs.map((i) => [i.id, i.type === 'date' ? resolveDate(i.default) : i.type === 'checkbox' ? !!i.default : i.default]));

function fromQuery(def) {
  const q = new URLSearchParams(location.search);
  const o = {};
  for (const i of def.inputs) {
    if (!q.has(i.id)) continue;
    const raw = q.get(i.id);
    if (i.type === 'checkbox') o[i.id] = raw === '1' || raw === 'true';
    else if (i.type === 'money' || i.type === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n)) o[i.id] = n;
    } else if (i.type === 'date') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) o[i.id] = raw;
    } else if ((i.options || []).some((op) => String(op.value) === raw)) o[i.id] = raw;
  }
  return o;
}

function syncUrl(def, vals, base) {
  const p = new URLSearchParams();
  for (const i of def.inputs) {
    const cur = vals[i.id];
    if (typeof cur === 'number' && Number.isNaN(cur)) continue;
    if (String(cur) === String(base[i.id])) continue;
    p.set(i.id, typeof cur === 'boolean' ? (cur ? '1' : '0') : String(cur));
  }
  const s = p.toString();
  const url = location.pathname + (s ? `?${s}` : '') + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
}

function visible(i, vals) {
  const s = i.showIf;
  if (!s) return true;
  const cur = vals[s.id];
  if ('eq' in s) return String(cur) === String(s.eq);
  if (Array.isArray(s.in)) return s.in.map(String).includes(String(cur));
  if ('truthy' in s) return !!cur === !!s.truthy;
  return true;
}

/* ── Form */
function fieldHTML(i, val, uid) {
  const id = `${uid}-${i.id}`;
  const help = i.help ? `<span class="field__help" id="${id}-h">${esc(i.help)}</span>` : '';
  const err = `<span class="field__err" id="${id}-e" role="alert" hidden></span>`;
  const desc = `${i.help ? `${id}-h ` : ''}${id}-e`;
  const lab = `<span class="field__label">${esc(i.label)}</span>`;
  switch (i.type) {
    case 'segment':
      return `<div class="field" data-field="${esc(i.id)}" data-type="${esc(i.type)}"><span class="field__label" id="${id}-l">${esc(i.label)}</span><div class="seg" role="radiogroup" aria-labelledby="${id}-l">${(i.options || [])
        .map((o) => `<label><input type="radio" name="${esc(i.id)}" value="${esc(o.value)}"${String(o.value) === String(val) ? ' checked' : ''}><span>${esc(o.label)}</span></label>`)
        .join('')}</div>${help}${err}</div>`;
    case 'select':
      return `<label class="field" data-field="${esc(i.id)}" data-type="${esc(i.type)}">${lab}<span class="field__box"><select name="${esc(i.id)}" aria-describedby="${desc}">${(i.options || [])
        .map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(val) ? ' selected' : ''}>${esc(o.label)}</option>`)
        .join('')}</select></span>${help}${err}</label>`;
    case 'checkbox':
      return `<div class="field" data-field="${esc(i.id)}" data-type="${esc(i.type)}"><label class="check"><input type="checkbox" name="${esc(i.id)}"${val ? ' checked' : ''} aria-describedby="${desc}"><span>${esc(i.label)}</span></label>${help}${err}</div>`;
    case 'date':
      return `<label class="field" data-field="${esc(i.id)}" data-type="${esc(i.type)}">${lab}<span class="field__box"><input type="date" name="${esc(i.id)}" value="${esc(val)}" aria-describedby="${desc}"></span>${help}${err}</label>`;
    default: {
      const shown = typeof val === 'number' && Number.isFinite(val) ? NF.format(val) : '';
      return `<label class="field" data-field="${esc(i.id)}" data-type="${esc(i.type)}">${lab}<span class="field__box"><input type="text" inputmode="decimal" autocomplete="off" name="${esc(i.id)}" value="${esc(shown)}" aria-describedby="${desc}">${i.unit ? `<i>${esc(i.unit)}</i>` : ''}</span>${help}${err}</label>`;
    }
  }
}

function buildForm(def, vals, base, uid) {
  const plain = def.inputs.filter((i) => !i.group);
  const groups = new Map();
  def.inputs.filter((i) => i.group).forEach((i) => {
    if (!groups.has(i.group)) groups.set(i.group, []);
    groups.get(i.group).push(i);
  });
  const presets = (def.presets || []).length
    ? `<div class="calc__presets" role="group" aria-label="Örnek değerler"><span class="field__label">Örnekler</span><div class="chips">${def.presets
        .map((p, n) => `<button class="chip" type="button" data-preset="${n}">${esc(p.label)}</button>`)
        .join('')}</div></div>`
    : '';
  const adv = [...groups]
    .map(([name, list]) => {
      const changed = list.some((i) => String(vals[i.id]) !== String(base[i.id]));
      return `<details class="calc__adv" data-adv${changed ? ' open' : ''}><summary>${esc(name)}</summary><div class="calc__advbody">${list.map((i) => fieldHTML(i, vals[i.id], uid)).join('')}</div></details>`;
    })
    .join('');
  const simple = plain.filter((i) => i.type === 'money' || i.type === 'number' || i.type === 'date').length;
  return `<div class="calc__fields${simple >= 3 ? ' calc__fields--2' : ''}">${presets}${plain.map((i) => fieldHTML(i, vals[i.id], uid)).join('')}${adv}<div class="calc__formfoot"><button class="tbtn" type="button" data-reset>Varsayılanlara dön</button></div></div>`;
}

function readValues(form, def) {
  const v = {};
  for (const i of def.inputs) {
    const el = form.elements[i.id];
    if (!el) continue;
    if (i.type === 'checkbox') v[i.id] = !!el.checked;
    else if (i.type === 'money' || i.type === 'number') v[i.id] = parseTR(el.value);
    else v[i.id] = el.value;
  }
  return v;
}

function setValue(form, i, v) {
  const el = form.elements[i.id];
  if (!el) return;
  if (i.type === 'checkbox') el.checked = !!v;
  else if (i.type === 'segment') qsa(`input[name="${i.id}"]`, form).forEach((r) => (r.checked = String(r.value) === String(v)));
  else if (i.type === 'money' || i.type === 'number') el.value = Number.isFinite(Number(v)) ? NF.format(Number(v)) : '';
  else el.value = v ?? '';
}

function applyShowIf(form, def, vals) {
  for (const i of def.inputs) {
    const f = qs(`[data-field="${i.id}"]`, form);
    if (f) f.hidden = !visible(i, vals);
  }
  qsa('[data-adv]', form).forEach((d) => {
    d.hidden = !qsa('[data-field]', d).some((f) => !f.hidden);
  });
}

function paintErrors(form, res) {
  qsa('.field.is-invalid', form).forEach((f) => {
    f.classList.remove('is-invalid');
    const e = qs('.field__err', f);
    if (e) {
      e.hidden = true;
      e.textContent = '';
    }
  });
  if (!res.error || !res.field) return;
  const f = qs(`[data-field="${res.field}"]`, form);
  if (!f) return;
  f.classList.add('is-invalid');
  const e = qs('.field__err', f);
  if (e) {
    e.textContent = res.error;
    e.hidden = false;
  }
  const d = f.closest('details');
  if (d) d.open = true;
}

/* ── Sonuç */
function tableHTML(t) {
  const cols = t.columns || [];
  const th = cols.map((c) => `<th scope="col"${c.align === 'right' ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('');
  const cell = (c, v) => `<td${c.align === 'right' ? ' class="num"' : ''}>${esc(fmt(c.kind, v, c))}</td>`;
  const body = (t.rows || []).map((r) => `<tr>${cols.map((c) => cell(c, r[c.key])).join('')}</tr>`).join('');
  const foot = t.footer ? `<tfoot><tr>${cols.map((c) => (t.footer[c.key] === undefined ? '<td></td>' : cell(c, t.footer[c.key]))).join('')}</tr></tfoot>` : '';
  return `<section class="calc__sec"><h2 class="calc__h">${esc(t.title)}</h2>${t.note ? `<p class="calc__tnote">${esc(t.note)}</p>` : ''}<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t.title)}"><table class="table calc__table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div></section>`;
}

function recapHTML(def, vals) {
  const rows = def.inputs
    .filter((i) => visible(i, vals))
    .map((i) => {
      const v = vals[i.id];
      let shown;
      if (i.type === 'checkbox') shown = v ? 'Evet' : 'Hayır';
      else if (i.options) shown = ((i.options.find((o) => String(o.value) === String(v)) || {}).label) ?? v;
      else if (i.type === 'date') shown = fmtDate(v);
      else if (i.type === 'money') shown = fmt('money', v);
      else shown = `${Number.isFinite(v) ? NF.format(v) : '—'}${i.unit ? ` ${i.unit}` : ''}`;
      return `<div><dt>${esc(i.label)}</dt><dd>${esc(shown)}</dd></div>`;
    })
    .join('');
  return `<dl class="calc__recap" aria-hidden="true">${rows}</dl>`;
}

function renderParts(res, def, vals, st) {
  if (res.error) {
    return { top: `<div class="notice notice--warn calc__err" role="status"><p><strong>Hesaplanamadı.</strong> ${esc(res.error)}</p></div>`, detail: '' };
  }
  const sum = res.summary || [];
  const hasMain = sum.some((s) => s.main);
  const head = hasMain ? sum.filter((s) => s.main) : sum.slice(0, 1);
  const tail = hasMain ? sum.filter((s) => !s.main) : sum.slice(1);
  const val = (s) => esc(fmt(s.kind, s.value, s));
  const hint = (s) => (s.hint ? `<small>${esc(s.hint)}</small>` : '');
  const mainHTML = head.map((s) => `<div><dt>${esc(s.label)}</dt><dd class="tnum">${val(s)}${hint(s)}</dd></div>`).join('');
  const rowsHTML = tail.map((s) => `<div><dt>${esc(s.label)}${hint(s)}</dt><dd class="tnum">${val(s)}</dd></div>`).join('');
  const actions = `<div class="calc__actions"><button class="tbtn" type="button" data-copy-text>Sonucu kopyala</button><button class="tbtn" type="button" data-copy-link>Bağlantıyı kopyala</button><button class="tbtn" type="button" data-print>Yazdır</button></div>`;
  const top = `<div class="calc__sum"><dl class="calc__main">${mainHTML}</dl>${rowsHTML ? `<dl class="calc__rows">${rowsHTML}</dl>` : ''}</div>${actions}`;

  const warn = (res.warnings || []).map((w) => `<div class="notice notice--warn"><p>${esc(w)}</p></div>`).join('');
  const tables = (res.tables || []).map(tableHTML).join('');
  const stepRow = (s, n) =>
    `<li><span class="calc__stepn mono tnum">${pad2(n + 1)}</span><span class="calc__stept">${esc(s.label)}${s.formula ? `<em>${esc(s.formula)}</em>` : ''}</span>${
      s.value !== undefined && s.value !== null ? `<strong class="tnum">${esc(fmt(s.kind || 'money', s.value, s))}</strong>` : ''
    }</li>`;
  const steps = (res.steps || []).length ? `<section class="calc__sec"><h2 class="calc__h">Hesap adımları</h2><ol class="calc__steps">${res.steps.map(stepRow).join('')}</ol></section>` : '';
  const notes = (res.notes || []).length ? `<section class="calc__sec"><h2 class="calc__h">Bu hesaba ilişkin notlar</h2><ul class="ticklist">${res.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>` : '';
  const pu = res.paramsUsed;
  const paramRow = (p) => `<div><dt>${esc(p.label)}</dt><dd class="tnum">${esc(fmt(p.kind, p.value, p))}</dd></div>`;
  const params =
    pu && (pu.items || []).length
      ? `<details class="calc__params" data-params${st.paramsOpen ? ' open' : ''}><summary>Kullanılan parametreler${pu.id ? ` · ${esc(pu.id)}` : ''}</summary><dl class="calc__rows calc__rows--light">${pu.items.map(paramRow).join('')}</dl></details>`
      : '';
  const detail = `${warn}${recapHTML(def, vals)}${tables}${steps}${notes}${params}<p class="calc__foot">${esc(def.disclaimer || 'Sonuçlar tahminidir; genel bilgilendirme amaçlıdır.')}</p>`;
  return { top, detail };
}

function resultToText(def, res) {
  const lines = [def.title, location.origin + location.pathname + location.search, ''];
  for (const s of res.summary || []) lines.push(`${s.label}: ${fmt(s.kind, s.value, s)}`);
  lines.push('', 'Sonuçlar tahminidir; genel bilgilendirme amaçlıdır. — Boraden');
  return lines.join('\n');
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e2) {
      /* yoksay */
    }
    ta.remove();
    return ok;
  }
}

/* ── Hesaplayıcı */
export function mountCalculators(root, ctx) {
  qsa('[data-calc]', root).forEach((el) => setupCalc(el, ctx));
}

function setupCalc(el, { fx, on, scroll }) {
  const def = JSON.parse(qs('[data-calc-def]', el).textContent);
  const form = qs('[data-calc-form]', el);
  const res = qs('[data-calc-res]', el);
  const detail = qs('[data-calc-detail]', el);
  const live = qs('[data-calc-live]', el);
  const uid = `c-${def.slug}`;
  const base = defaultsOf(def);
  const vals = { ...base, ...fromQuery(def) };
  const st = { paramsOpen: false };
  let seq = 0;
  let timer = 0;
  let lastLive = '';
  let last = null;

  form.innerHTML = buildForm(def, vals, base, uid);
  applyShowIf(form, def, vals);

  // dar ekranda: sonuç görünmüyorken altta küçük bir özet çubuğu (dokununca sonuca gider)
  const peek = document.createElement('button');
  peek.type = 'button';
  peek.className = 'calc__peek';
  peek.hidden = true; // ad: görünen etiket ve tutar + «sonuca git» (T-12, WCAG 2.5.3)
  el.appendChild(peek);
  let formIn = false;
  let resIn = true;
  const syncPeek = () => {
    peek.hidden = !(formIn && !resIn && last && !last.error);
  };
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              if (en.target === form) formIn = en.isIntersecting;
              else resIn = en.isIntersecting;
            }
            syncPeek();
          },
          { threshold: 0.05 }
        )
      : null;
  io?.observe(form);
  io?.observe(res);
  const onPeek = () => res.scrollIntoView({ behavior: fx && fx.tier === 'off' ? 'auto' : 'smooth', block: 'start' });
  peek.addEventListener('click', onPeek);

  async function run() {
    const my = ++seq;
    const v = readValues(form, def);
    Object.assign(vals, v);
    applyShowIf(form, def, vals);
    let out;
    try {
      const [params, core] = await Promise.all([loadParams(def.paramsUrl), loadCore()]);
      out = core.calculate(def.engine, v, params);
    } catch (err) {
      console.warn('[hesaplayıcı]', err);
      out = { error: 'Parametre dosyası veya hesaplama modülü yüklenemedi. Sayfayı yenileyip tekrar deneyin.' };
    }
    if (my !== seq) return;
    last = out;
    paintErrors(form, out);
    const parts = renderParts(out, def, vals, st);
    res.innerHTML = parts.top;
    detail.innerHTML = parts.detail;
    res.classList.remove('is-updated');
    void res.offsetWidth;
    res.classList.add('is-updated');
    el.setAttribute('aria-busy', 'false');
    if (!out.error) syncUrl(def, vals, base);
    const first = !out.error ? (out.summary || []).find((s) => s.main) || (out.summary || [])[0] : null;
    peek.innerHTML = first ? `<span class="calc__peekl mono">${esc(first.label)}</span><span class="calc__peekv tnum">${esc(fmt(first.kind, first.value, first))}</span><span class="sr-only">, sonuca git</span><span class="calc__peeka" aria-hidden="true">↑</span>` : '';
    syncPeek();
    // ekran okuyucu için kısa özet (yalnızca değişince)
    if (live) {
      const msg = out.error ? out.error : (out.summary || []).filter((s) => s.main).map((s) => `${s.label}: ${fmt(s.kind, s.value, s)}`).join('. ');
      if (msg && msg !== lastLive) {
        lastLive = msg;
        live.textContent = msg;
      }
    }
    scroll?.refresh?.();
  }
  const schedule = (d = 110) => {
    clearTimeout(timer);
    timer = setTimeout(run, d);
  };

  const onInput = (e) => {
    const t = e.target;
    if (t.matches('input[type="text"]')) schedule();
    else run();
  };
  const onFocusOut = (e) => {
    const t = e.target;
    if (t.matches && t.matches('input[type="text"]')) {
      const n = parseTR(t.value);
      if (Number.isFinite(n)) t.value = NF.format(n);
    }
  };
  const onFormClick = (e) => {
    const p = e.target.closest('[data-preset]');
    if (p) {
      const preset = def.presets[Number(p.dataset.preset)];
      for (const [k, v] of Object.entries(preset.values || {})) {
        const i = def.inputs.find((x) => x.id === k);
        if (i) setValue(form, i, v);
      }
      run();
      return;
    }
    if (e.target.closest('[data-reset]')) {
      for (const i of def.inputs) setValue(form, i, base[i.id]);
      run();
    }
  };
  const onActions = async (e) => {
    const b = e.target.closest('button');
    if (!b || !(b.hasAttribute('data-copy-text') || b.hasAttribute('data-copy-link') || b.hasAttribute('data-print'))) return;
    const flash = (label) => {
      const old = b.textContent;
      b.textContent = label;
      b.classList.add('is-done');
      setTimeout(() => {
        b.textContent = old;
        b.classList.remove('is-done');
      }, 1600);
    };
    if (b.hasAttribute('data-copy-text') && last && !last.error) flash((await copy(resultToText(def, last))) ? 'Kopyalandı' : 'Kopyalanamadı');
    else if (b.hasAttribute('data-copy-link')) flash((await copy(location.origin + location.pathname + location.search)) ? 'Kopyalandı' : 'Kopyalanamadı');
    else if (b.hasAttribute('data-print')) window.print();
  };
  const onToggle = (e) => {
    if (e.target.matches && e.target.matches('[data-params]')) st.paramsOpen = e.target.open;
  };

  // Enter tuşu formu göndermesin: hesap yazdıkça yapılır. Satır içi onsubmit yerine burada (CSP satır içi işleyicileri engeller).
  const onSubmit = (e) => e.preventDefault();
  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', onInput);
  form.addEventListener('focusout', onFocusOut);
  form.addEventListener('click', onFormClick);
  el.addEventListener('click', onActions);
  detail.addEventListener('toggle', onToggle, true);
  on(() => {
    clearTimeout(timer);
    seq++;
    io?.disconnect();
    peek.removeEventListener('click', onPeek);
    peek.remove();
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('input', onInput);
    form.removeEventListener('focusout', onFocusOut);
    form.removeEventListener('click', onFormClick);
    el.removeEventListener('click', onActions);
    detail.removeEventListener('toggle', onToggle, true);
  });
  run();
}

/* ── Vergi takvimi: geçmiş/sıradaki işaretleme, kalan gün, takvime aktarma (.ics) */
const dayNum = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const leftLabel = (n) => (n < 0 ? 'Geçti' : n === 0 ? 'Bugün' : n === 1 ? 'Yarın' : `${n} gün kaldı`);

function toICS(rows) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const t = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const nextDay = (iso) => new Date((dayNum(iso) + 1) * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Boraden//Vergi Takvimi//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Vergi takvimi'];
  rows.forEach((r) => {
    const d = r.dataset.date;
    L.push('BEGIN:VEVENT', `UID:${r.id || d}@boraden.com.tr`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(d)}`, `SUMMARY:${t(r.dataset.title)}`, `DESCRIPTION:${t(r.dataset.desc)}`, 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

export function mountCalendar(root, { on, scroll }) {
  qsa('[data-cal]', root).forEach((el) => {
    const today = isoToday();
    const rows = qsa('[data-date]', el);
    let nextSet = false;
    rows.forEach((r) => {
      const n = dayNum(r.dataset.date) - dayNum(today);
      r.classList.toggle('is-past', n < 0);
      const left = qs('[data-left]', r);
      if (left) left.textContent = leftLabel(n);
      if (n >= 0 && !nextSet) {
        r.classList.add('is-next');
        nextSet = true;
      }
    });
    const strip = qs('[data-cal-next]', el);
    if (strip) {
      const up = rows.filter((r) => dayNum(r.dataset.date) >= dayNum(today)).slice(0, 3);
      if (up.length) {
        strip.innerHTML = up
          .map((r) => {
            const n = dayNum(r.dataset.date) - dayNum(today);
            return `<a class="cal__nx" href="#${esc(r.id)}"><span class="cal__nxd">${esc(fmtDate(r.dataset.date))}</span><b>${esc(r.dataset.title)}</b><span class="cal__left">${esc(leftLabel(n))}</span></a>`;
          })
          .join('');
        strip.hidden = false;
      } else strip.hidden = true; // derlemeden bu yana takvim aralığı bittiyse
    }
    const btn = qs('[data-cal-ics]', el);
    const onIcs = () => {
      const vis = rows.filter((r) => !r.hidden);
      if (!vis.length) return;
      const blob = new Blob([toICS(vis)], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vergi-takvimi.ics';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    };
    btn?.addEventListener('click', onIcs);
    on(() => btn?.removeEventListener('click', onIcs));
    scroll?.refresh?.();
  });
}
