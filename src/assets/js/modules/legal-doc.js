// Yasal metin sayfası: yazdır düğmesi + dar ekranda katlanan içindekiler.
// Şablon: pages/support/legal.njk — <div data-module="legal-doc"> içinde <details class="lg-tocbox"> ve [data-print].
// Wagtail karşılığı: LegalPage şablonu + bu modül (değişiklik gerekmez).
// İlerleyici geliştirme: JS yoksa içindekiler açık kalır, yazdır düğmesi gizli kalır (tarayıcının kendi yazdırması çalışır).
export function mount(el) {
  const box = el.querySelector('.lg-tocbox');
  const printBtn = el.querySelector('[data-print]');
  const mq = matchMedia('(max-width: 900px)');

  // geniş ekranda içindekiler her zaman açık (özet satırı gizlidir); dar ekranda kapalı başlar
  const fit = () => {
    if (box) box.open = !mq.matches;
  };
  fit();
  const onMq = () => fit();
  mq.addEventListener?.('change', onMq);

  // dar ekranda bir bölüme gidince içindekileri kapat (yakalama evresinde: kaydırma hedefi kapanmış düzene göre hesaplansın)
  const onTocClick = (e) => {
    if (mq.matches && box && e.target.closest('a[href^="#"]')) box.open = false;
  };
  box?.addEventListener('click', onTocClick, true);

  const onPrint = () => window.print();
  if (printBtn) {
    printBtn.hidden = false;
    printBtn.addEventListener('click', onPrint);
  }

  return () => {
    mq.removeEventListener?.('change', onMq);
    box?.removeEventListener('click', onTocClick, true);
    printBtn?.removeEventListener('click', onPrint);
  };
}
