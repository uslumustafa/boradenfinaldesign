// Ortak form yardımcıları — iletişim (contact-form.js) ve kariyer (career-form.js) formları içe aktarır.
// Bu dosya tek başına sayfa modülü değildir (mount yok).
//
// İşaretleme: pages/company/kit.njk (.ct-field[data-field][data-type] > .field__box > input|select|textarea, .field__err …).
// İlerleyici geliştirme: JS yoksa form tarayıcının kendi doğrulaması ve action="mailto:" ile çalışır. JS varsa doğrulama burada
// yapılır (satır içi hata, aria-invalid, aria-describedby, ilk hatalı alana odak) ve geçerli gönderim bir mailto: taslağı açar
// (otomasyonla sürülen tarayıcıda açılmaz: bkz. openMail). Ağ isteği YOK, hiçbir şey saklanmaz (çerez/depolama yok).
// Wagtail'e geçişte yalnızca gönderim adımı sunucuya taşınır.

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export const MAIL_MAX = 1800; // mailto gövdesi için güvenli üst sınır (karakter)

const MSG = {
  required: 'Lütfen bu alanı doldurun.',
  select: 'Lütfen listeden bir seçim yapın.',
  radio: 'Lütfen seçeneklerden birini işaretleyin.',
  email: 'Geçerli bir e-posta adresi yazın (ör. ad@alanadi.com).',
  tel: 'Geçerli bir telefon numarası yazın (ör. 0 212 000 00 00).',
  short: 'Lütfen en az 2 karakter yazın.',
  min: (n, cur) => `En az ${n} karakter yazın (şu an ${cur}).`,
  consent: "Devam etmek için KVKK Aydınlatma Metni'ni okuduğunuzu onaylayın.",
  fileType: (list) => `Yalnızca ${list} biçiminde bir dosya seçebilirsiniz.`,
  fileSize: (max, cur) => `Dosya en fazla ${max} MB olabilir (seçilen: ${cur} MB).`,
};

const mb = (bytes) => (bytes / (1024 * 1024)).toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const extList = (acc) =>
  acc
    .map((x) => x.replace(/^\./, '').toUpperCase())
    .join(', ')
    .replace(/, ([^,]*)$/, ' veya $1');

// mailto: RFC 6068 — satır sonları %0D%0A
const enc = (s) => encodeURIComponent(String(s).replace(/\r?\n/g, '\r\n'));
export const mailtoHref = (to, subject, body) => `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;

/* Gövdeyi oluşturur; uzun mesajı kelime sınırında güvenle kısaltır (kod noktası bazında: emoji/vekil çiftleri bölünmez).
   header: ["Etiket: değer", …] · message: serbest metin · döner: { body, full, cut } */
export function composeMail({ to, subject, header, message, messageLabel = 'Mesaj', max = MAIL_MAX }) {
  const head = header.join('\n');
  const join = (m) => head + (m ? `\n\n${messageLabel}:\n${m}` : '');
  const fullBody = join(message);
  const full = `Alıcı: ${to}\nKonu: ${subject}\n\n${fullBody}`;
  if (fullBody.length <= max) return { body: fullBody, full, cut: false };
  const note = '\n\n[Metnin devamı, e-posta bağlantısının uzunluk sınırı nedeniyle kısaltıldı. Tam metni formdaki «kopyala» düğmesiyle alabilirsiniz.]';
  const room = Math.max(0, max - join('x').length - note.length - 2);
  // kod noktası kod noktası ekle (vekil çiftleri bölünmez), uzunluğu UTF-16 birimiyle ölç
  let part = '';
  for (const ch of message) {
    if (part.length + ch.length > room) break;
    part += ch;
  }
  const sp = part.lastIndexOf(' ');
  if (sp > room * 0.6) part = part.slice(0, sp);
  return { body: join(part.trimEnd() + '…') + note, full, cut: true };
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* izin yoksa eski yönteme düş */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  ta.remove();
  return ok;
}

/* wrap: [data-module] öğesi (form + [data-fk-done] + [data-fk-live] içerir)
   opts: { fx, onValid(values), onReset() } → { say, showDone, openMail, destroy } */
export function createFormKit(wrap, { fx, onValid, onReset } = {}) {
  const form = wrap.querySelector('form');
  const status = wrap.querySelector('[data-fk-status]');
  const live = wrap.querySelector('[data-fk-live]');
  const done = wrap.querySelector('[data-fk-done]');
  const fields = Array.from(form.querySelectorAll('.ct-field'));
  const touched = new WeakSet();
  const offs = [];
  const timers = new Set();
  let submitted = false;
  let copyPayload = '';
  const motion = () => fx && fx.tier !== 'off';
  const on = (el, ev, fn, opt) => {
    if (!el) return;
    el.addEventListener(ev, fn, opt);
    offs.push(() => el.removeEventListener(ev, fn, opt));
  };
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  form.noValidate = true; // doğrulamayı biz yapıyoruz (JS yokken tarayıcınınki çalışır)

  // Formdaki iç bağlantılar (KVKK metni vb.) yeni sekmede açılsın: sayfa geçişi doldurulan formu silmesin
  form.querySelectorAll('a[href^="/"]').forEach((a) => {
    if (a.target) return;
    a.target = '_blank';
    a.rel = 'noopener';
    const s = document.createElement('span');
    s.className = 'sr-only';
    s.textContent = ' (yeni sekmede açılır)';
    a.append(s);
  });

  const controlsOf = (f) => Array.from(f.querySelectorAll('input, select, textarea'));
  const labelOf = (f) => {
    const l = f.querySelector('.field__label');
    return l ? (l.firstChild ? l.firstChild.textContent : l.textContent).trim() : f.dataset.field;
  };
  const say = (text) => {
    if (!live) return;
    live.textContent = '';
    later(() => (live.textContent = text), 40);
  };

  /* ── Doğrulama */
  function message(f) {
    const type = f.dataset.type;
    const ctrls = controlsOf(f);
    const c = ctrls[0];
    if (!c) return '';
    if (type === 'radio') return ctrls.some((x) => x.required) && !ctrls.some((x) => x.checked) ? MSG.radio : '';
    if (type === 'checkbox') return c.required && !c.checked ? MSG.consent : '';
    if (type === 'file') {
      const file = c.files && c.files[0];
      if (!file) return c.required ? MSG.required : '';
      const acc = (c.getAttribute('accept') || '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      const name = file.name.toLowerCase();
      if (acc.length && !acc.some((x) => (x.startsWith('.') ? name.endsWith(x) : file.type === x))) return MSG.fileType(extList(acc));
      const max = Number(c.dataset.maxMb || 0);
      if (max && file.size > max * 1024 * 1024) return MSG.fileSize(max, mb(file.size));
      return '';
    }
    const v = String(c.value || '').trim();
    if (!v) return c.required ? (type === 'select' ? MSG.select : MSG.required) : '';
    if (type === 'email' && !EMAIL_RE.test(v)) return MSG.email;
    if (type === 'tel') {
      const digits = v.replace(/\D/g, '').length;
      if (digits < 7 || digits > 15 || /[^\d\s()+\-./]/.test(v)) return MSG.tel;
    }
    const min = Number(c.getAttribute('minlength') || 0);
    if (min && v.length < min) return MSG.min(min, v.length);
    if (c.required && type === 'text' && v.length < 2) return MSG.short;
    return '';
  }

  function paint(f, msg) {
    const err = f.querySelector('.field__err');
    f.classList.toggle('is-invalid', !!msg);
    controlsOf(f).forEach((c) => (msg ? c.setAttribute('aria-invalid', 'true') : c.removeAttribute('aria-invalid')));
    if (err) {
      err.textContent = msg; // gizliyken metin boş kalır (aria-describedby gereksiz okumasın)
      err.hidden = !msg;
    }
  }
  const check = (f) => {
    const msg = message(f);
    paint(f, msg);
    return !msg;
  };
  const invalidFields = () => fields.filter((f) => f.classList.contains('is-invalid'));

  function focusField(f) {
    const ctrls = controlsOf(f);
    const target = ctrls.find((c) => c.checked) || ctrls[0];
    if (!target) return;
    target.focus({ preventScroll: true });
    f.scrollIntoView({ block: 'center', behavior: motion() ? 'smooth' : 'auto' });
  }

  /* ── Değerler: alan sırasıyla [{ id, type, label, value }] (onay kutusu hariç) */
  function values() {
    const out = [];
    for (const f of fields) {
      const type = f.dataset.type;
      if (type === 'checkbox') continue;
      const ctrls = controlsOf(f);
      let value = '';
      let raw = '';
      if (type === 'radio') {
        const x = ctrls.find((c) => c.checked);
        raw = x ? x.value : '';
        value = x ? x.closest('label').textContent.trim() : '';
      } else if (type === 'select') {
        const s = ctrls[0];
        raw = s.value;
        value = s.value && s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : '';
      } else if (type === 'file') {
        const file = ctrls[0].files && ctrls[0].files[0];
        value = file ? `${file.name} (${mb(file.size)} MB)` : '';
        raw = file ? file.name : '';
      } else {
        value = String(ctrls[0].value || '').trim();
        raw = value;
      }
      out.push({ id: f.dataset.field, type, label: labelOf(f), value, raw });
    }
    return out;
  }

  /* ── Seçenek açıklaması, karakter sayacı, dosya notu */
  const repaints = [];
  form.querySelectorAll('[data-fk-desc]').forEach((d) => {
    const sel = d.closest('.ct-field').querySelector('select');
    if (!sel) return;
    const paintDesc = (animate) => {
      const o = sel.selectedOptions[0];
      const t = (o && o.dataset.desc) || '';
      d.textContent = t;
      d.hidden = !t;
      if (animate && t && motion() && d.animate) {
        d.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    };
    on(sel, 'change', () => paintDesc(true));
    repaints.push(() => paintDesc(false));
  });
  form.querySelectorAll('[data-fk-count]').forEach((el) => {
    const ta = el.closest('.ct-field').querySelector('textarea');
    const min = Number(el.dataset.fkCount) || 0;
    const paintCount = () => {
      const n = ta.value.trim().length;
      el.hidden = false;
      el.textContent = n >= min ? `${n} karakter` : `${n} / en az ${min} karakter`;
      el.classList.toggle('is-ok', n >= min);
    };
    on(ta, 'input', paintCount);
    repaints.push(paintCount);
  });
  form.querySelectorAll('[data-fk-file]').forEach((note) => {
    const f = note.closest('.ct-field');
    const inp = f.querySelector('input[type="file"]');
    const nameEl = f.querySelector('[data-fk-filename]');
    f.classList.add('is-enh');
    const paintFile = () => {
      note.textContent = '';
      const file = inp.files && inp.files[0];
      f.classList.toggle('has-file', !!file);
      if (nameEl) nameEl.textContent = file ? file.name : 'Dosya seçilmedi';
      if (!file || message(f)) return;
      const b = document.createElement('b');
      b.textContent = file.name;
      note.append(b, ` (${mb(file.size)} MB) seçildi. Bu dosya e-posta taslağına otomatik eklenemez; taslak açıldığında e-postaya ekleyin.`);
    };
    on(inp, 'change', paintFile);
    repaints.push(paintFile);
  });
  const repaint = () => repaints.forEach((fn) => fn());
  repaint();

  /* ── Canlı doğrulama: yazarken yalnızca hatalı alanı yeniden denetle; alandan çıkınca dokunulmuşsa denetle */
  const fieldOf = (el) => (el && el.closest ? el.closest('.ct-field') : null);
  const afterChange = (f) => {
    touched.add(f);
    if (f.classList.contains('is-invalid')) check(f);
    if (submitted && status && !invalidFields().length) status.textContent = '';
  };
  on(form, 'input', (e) => {
    const f = fieldOf(e.target);
    if (f) afterChange(f);
  });
  on(form, 'change', (e) => {
    const f = fieldOf(e.target);
    if (!f) return;
    afterChange(f);
    // seçim/dosya/onay gibi tek adımlı alanlar değişince hemen denetlenir
    if (['select', 'radio', 'checkbox', 'file'].includes(f.dataset.type)) check(f);
  });
  on(form, 'focusout', (e) => {
    const f = fieldOf(e.target);
    if (!f || f.contains(e.relatedTarget)) return;
    if (touched.has(f) || submitted) {
      check(f);
      if (submitted && status && !invalidFields().length) status.textContent = '';
    }
  });

  /* ── Gönderim */
  on(form, 'submit', (e) => {
    e.preventDefault();
    submitted = true;
    const bad = fields.filter((f) => !check(f));
    if (bad.length) {
      if (status) status.textContent = `${status.dataset.error || 'Lütfen işaretli alanları kontrol edin.'} Düzeltilmesi gereken alan sayısı: ${bad.length}.`;
      focusField(bad[0]);
      return;
    }
    if (status) status.textContent = '';
    if (typeof onValid === 'function') onValid(values());
  });

  /* ── «Taslak hazır» paneli */
  function showDone({ subject, body, full, cut, mailto, wa }) {
    if (!done) return;
    const q = (s) => done.querySelector(s);
    q('[data-fk-subject]').textContent = subject;
    q('[data-fk-body]').textContent = body;
    const cutEl = q('[data-fk-cut]');
    if (cutEl) cutEl.hidden = !cut;
    q('[data-fk-mailto]').href = mailto;
    const waEl = q('[data-fk-wa]');
    if (waEl && wa) waEl.href = wa;
    copyPayload = full;
    form.hidden = true;
    done.hidden = false;
    if (motion() && done.animate) {
      done.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    done.focus({ preventScroll: true });
    done.scrollIntoView({ block: 'start', behavior: motion() ? 'smooth' : 'auto' });
  }
  // e-posta uygulamasında taslağı aç (mailto); sayfa yerinde kalır.
  // Otomasyonla sürülen tarayıcı (Playwright/Selenium: navigator.webdriver) gerçek bir ziyaretçi değildir; test koşuları geliştiricinin
  // e-posta uygulamasını açıp şirket adresine gerçek taslak pencereleri biriktirmesin diye burada atlanır. «Taslak hazır» paneli ve
  // [data-fk-mailto] bağlantısı yerinde kalır, ziyaretçi tarafında davranış değişmez.
  function openMail(href) {
    if (navigator.webdriver) return;
    try {
      window.location.href = href;
    } catch (err) {
      /* bazı ortamlarda mailto işleyicisi yoktur; panel alternatifleri gösterir */
    }
  }
  function backToForm(reset) {
    if (reset) form.reset();
    if (done) done.hidden = true;
    form.hidden = false;
    const first = fields[0] && controlsOf(fields[0])[0];
    if (first) {
      first.focus({ preventScroll: true });
      form.scrollIntoView({ block: 'start', behavior: motion() ? 'smooth' : 'auto' });
    }
  }
  if (done) {
    on(done.querySelector('[data-fk-copy]'), 'click', async (e) => {
      const btn = e.currentTarget;
      const ok = await copyText(copyPayload);
      if (ok) {
        btn.textContent = 'Kopyalandı';
        btn.classList.add('is-done');
        say('Metin panoya kopyalandı.');
        later(() => {
          btn.textContent = btn.dataset.label || 'Kopyala';
          btn.classList.remove('is-done');
        }, 2400);
      } else {
        // kopyalanamadıysa metni seçili göster
        const pre = done.querySelector('[data-fk-body]');
        const r = document.createRange();
        r.selectNodeContents(pre);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        say('Metin kopyalanamadı; seçili metni kendiniz kopyalayabilirsiniz.');
      }
    });
    on(done.querySelector('[data-fk-edit]'), 'click', () => backToForm(false));
    on(done.querySelector('[data-fk-reset]'), 'click', () => {
      backToForm(true);
      say('Form sıfırlandı.');
    });
  }

  // form.reset() sonrası: hata, sayaç, açıklama ve dosya notlarını temizle; sayfaya özgü ön seçimleri yeniden uygula
  on(form, 'reset', () => {
    later(() => {
      submitted = false;
      fields.forEach((f) => paint(f, ''));
      if (status) status.textContent = '';
      repaint();
      if (typeof onReset === 'function') onReset();
    }, 0);
  });

  return {
    form,
    say,
    showDone,
    openMail,
    destroy() {
      offs.forEach((fn) => fn());
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    },
  };
}
