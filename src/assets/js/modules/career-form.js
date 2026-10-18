// Kariyer genel başvuru formu — sayfa modülü (<div data-module="career-form"> … <form> …).
// • Doğrulama + «taslak hazır» paneli form-kit.js'tedir; CV alanı: .pdf/.doc/.docx, ≤ 5 MB (istemci denetimi).
// • Geçerli gönderimde mailto: taslağı açılır. Dosya bir mailto taslağına eklenemez: panel ve dosya notu «CV'nizi e-postaya ekleyin»
//   yönlendirmesini açıkça gösterir. Ağ isteği yok, hiçbir şey saklanmaz; «gönderildi» denmez.
// • ?alan=<alan-id> → «İlgilendiğiniz alan» ön seçilir (çalışma alanları listesindeki «Bu alan için başvurun» da aynı alanı seçer).
import { createFormKit, composeMail, mailtoHref } from './form-kit.js';

export function mount(el, ctx) {
  const form = el.querySelector('form');
  if (!form) return undefined;
  // alıcı sayfaya gömülü (content.json › contact.email); boşsa taslak alıcısız açılır — sabit yedek adres yok (Ekim 2026)
  const to = el.dataset.mailTo || '';
  const prefix = el.dataset.mailPrefix || '[Kariyer]';
  const areaSel = form.elements.alan;

  const kit = createFormKit(el, { fx: ctx.fx, onValid, onReset: preselect });

  function preselect() {
    const id = new URLSearchParams(location.search).get('alan');
    if (!areaSel || !id || !Array.from(areaSel.options).some((o) => o.value === id)) return;
    areaSel.value = id;
    areaSel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onValid(vals) {
    const get = (id) => vals.find((v) => v.id === id)?.value || '';
    const name = get('ad') || vals.find((v) => v.type === 'text')?.value || '';
    const area = get('alan') || 'Genel başvuru';
    const subject = `${prefix} ${area} — ${name}`.replace(/\s+/g, ' ').trim();
    const letter = vals.find((v) => v.type === 'textarea');
    const cv = vals.find((v) => v.type === 'file');
    const header = vals.filter((v) => v !== letter && v !== cv && v.value).map((v) => `${v.label}: ${v.value}`);
    header.push(`${cv ? cv.label : 'Özgeçmiş (CV)'}: ${cv && cv.value ? `${cv.value} — bu e-postaya ek olarak eklenecek` : 'bu e-postaya ek olarak eklenecek'}`);
    const mail = composeMail({ to, subject, header, message: letter ? letter.value : '', messageLabel: letter ? letter.label : 'Ön yazı' });
    const href = mailtoHref(to, subject, mail.body);
    kit.showDone({ ...mail, subject, mailto: href });
    kit.openMail(href);
  }

  preselect();
  return () => kit.destroy();
}
