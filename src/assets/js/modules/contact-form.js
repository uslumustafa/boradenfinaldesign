// İletişim formu — sayfa modülü (<div data-module="contact-form"> … <form> …).
// • ?hizmet=<hizmet-id> → hizmetin konusu seçilir (eşleme sayfaya gömülü JSON: { id: { t: başlık, k: konu-id } }) ve
//   «Seçilen hizmet» çipi gösterilir (kaldırılabilir). ?konu=<konu-id> → konu doğrudan seçilir.
// • ?kisi=<kişi-slug> (kişi kartlarından) ve ?sektor=<sektör-slug> (sektör sayfalarından): «Görüşmek istediğiniz kişi» / «Seçilen sektör»
//   çipleri gösterilir (kaldırılabilir) ve taslağın gövdesine ayrı satır olarak yazılır. Alıcı değişmez: mesaj kurumun tek adresine gider.
// • Doğrulama ve «taslak hazır» paneli form-kit.js'tedir. Geçerli gönderimde mailto: taslağı açılır; ağ isteği yok, saklama yok.
//   Konu satırı: "[Web sitesi] <konu> — <ad>". Gövde: alanlar + (varsa) ilgili hizmet + mesaj (~1800 karaktere güvenle kısaltılır).
// • Wagtail'e geçişte: aynı işaretleme; gönderim AbstractEmailForm'a gider, ön seçim mantığı aynen kalır.
import { createFormKit, composeMail, mailtoHref } from './form-kit.js';

export function mount(el, ctx) {
  const form = el.querySelector('form');
  if (!form) return undefined;
  // alıcı sayfaya gömülü (content.json › contact.email); boşsa taslak alıcısız açılır — sabit yedek adres yok (Ekim 2026)
  const to = el.dataset.mailTo || '';
  const prefix = el.dataset.mailPrefix || '[Web sitesi]';
  const wa = el.dataset.wa || '';
  let svcMap = {};
  try {
    svcMap = JSON.parse(el.querySelector('[data-ct-services]')?.textContent || '{}');
  } catch (e) {
    svcMap = {};
  }
  const chip = el.querySelector('[data-ct-svc]');
  const chipName = el.querySelector('[data-ct-svc-name]');
  const chipX = el.querySelector('[data-ct-svc-x]');
  const topicSel = form.elements.konu;
  const motion = () => ctx.fx && ctx.fx.tier !== 'off';
  let service = null; // { id, t, k }

  // bağlam çipleri (kişi, sektör): eşleme sayfaya gömülü JSON; her çip kaldırılabilir ve adres çubuğundan da silinir
  const extras = [
    { key: 'person', param: 'kisi', line: 'Görüşmek istenen kişi', removed: 'Seçilen kişi kaldırıldı', text: (e) => (e.r ? `${e.t} (${e.r})` : e.t) },
    { key: 'sector', param: 'sektor', line: 'İlgili sektör', removed: 'Seçilen sektör kaldırıldı', text: (e) => e.t },
  ]
    .map((x) => {
      const box = el.querySelector(`[data-ct-${x.key}]`);
      if (!box) return null;
      let map = {};
      try {
        map = JSON.parse(el.querySelector(`[data-ct-${x.key}-map]`)?.textContent || '{}');
      } catch (e) {
        map = {};
      }
      return { ...x, box, map, name: box.querySelector('[data-ct-name]'), btn: box.querySelector('[data-ct-x]'), value: null, off: null };
    })
    .filter(Boolean);

  const kit = createFormKit(el, { fx: ctx.fx, onValid, onReset: () => applyParams() });

  function showExtra(x, entry) {
    const was = !x.box.hidden;
    x.box.hidden = !entry;
    if (x.name) x.name.textContent = entry ? x.text(entry) : '';
    if (entry && !was && motion() && x.box.animate) {
      x.box.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }
  for (const x of extras) {
    const remove = () => {
      x.value = null;
      showExtra(x, null);
      const u = new URL(location.href);
      u.searchParams.delete(x.param);
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      kit.say(x.removed);
      if (topicSel) topicSel.focus();
    };
    x.btn?.addEventListener('click', remove);
    x.off = () => x.btn?.removeEventListener('click', remove);
  }

  function setTopic(id) {
    if (!topicSel || !id || !Array.from(topicSel.options).some((o) => o.value === id)) return false;
    topicSel.value = id;
    topicSel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function showChip(s) {
    if (!chip) return;
    const was = !chip.hidden;
    chip.hidden = !s;
    if (chipName) chipName.textContent = s ? s.t : '';
    if (s && !was && motion() && chip.animate) {
      chip.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }

  // adres çubuğundaki ön seçimleri uygular; bir şey seçildiyse true
  function applyParams() {
    const q = new URLSearchParams(location.search);
    const hid = q.get('hizmet');
    const kid = q.get('konu');
    service = hid && svcMap[hid] ? { id: hid, ...svcMap[hid] } : null;
    showChip(service);
    let picked = false;
    if (kid) picked = setTopic(kid);
    if (!picked && service) picked = setTopic(service.k);
    if (picked && topicSel) {
      const label = topicSel.selectedOptions[0]?.textContent.trim() || '';
      kit.say(service ? `Seçilen hizmet: ${service.t} Konu: ${label}` : `Konu seçildi: ${label}`);
    }
    let extra = false;
    for (const x of extras) {
      const id = q.get(x.param);
      x.value = id && Object.prototype.hasOwnProperty.call(x.map, id) ? { id, ...x.map[id] } : null;
      showExtra(x, x.value);
      if (x.value) extra = true;
    }
    return !!service || picked || extra;
  }

  const removeChip = () => {
    service = null;
    showChip(null);
    const u = new URL(location.href);
    u.searchParams.delete('hizmet');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    kit.say('Seçilen hizmet kaldırıldı');
    if (topicSel) topicSel.focus();
  };
  chipX?.addEventListener('click', removeChip);

  function onValid(vals) {
    const get = (id) => vals.find((v) => v.id === id)?.value || '';
    const name = get('ad') || vals.find((v) => v.type === 'text')?.value || '';
    const topic = get('konu') || 'İletişim';
    const subject = `${prefix} ${topic} — ${name}`.replace(/\s+/g, ' ').trim();
    const msgField = vals.find((v) => v.id === 'mesaj' || v.type === 'textarea');
    const header = [];
    for (const v of vals) {
      if (v === msgField || !v.value) continue;
      header.push(`${v.label}: ${v.value}`);
      if (v.id === 'konu' && service) header.push(`İlgili hizmet: ${service.t}`);
    }
    if (service && !header.some((h) => h.startsWith('İlgili hizmet:'))) header.push(`İlgili hizmet: ${service.t}`);
    for (const x of extras) if (x.value) header.push(`${x.line}: ${x.text(x.value)}`);
    const mail = composeMail({ to, subject, header, message: msgField ? msgField.value : '', messageLabel: msgField ? msgField.label : 'Mesaj' });
    const href = mailtoHref(to, subject, mail.body);
    const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`${subject}\n\n${mail.body}`)}` : '';
    kit.showDone({ ...mail, subject, mailto: href, wa: waHref });
    kit.openMail(href);
  }

  // ön seçim varsa ve form ekranın altında kalıyorsa forma kaydır (hizmet sayfasından «Görüşme talep edin» geçişi)
  let raf = 0;
  if (applyParams()) {
    raf = requestAnimationFrame(() => {
      const sec = el.closest('.ct-main') || form;
      if (sec.getBoundingClientRect().top > innerHeight * 0.6) sec.scrollIntoView({ block: 'start', behavior: motion() ? 'smooth' : 'auto' });
    });
  }

  return () => {
    cancelAnimationFrame(raf);
    chipX?.removeEventListener('click', removeChip);
    for (const x of extras) x.off && x.off();
    kit.destroy();
  };
}
