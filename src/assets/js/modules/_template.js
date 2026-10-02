// Sayfa modülü şablonu — kopyalayıp yeniden adlandırın (ör. modules/contact-form.js).
//
// Şablonda:   <form data-module="contact-form"> … </form>
// Yükleme:    behaviors.js → modules(root): yalnızca sayfada [data-module] varsa bu dosya ayrı bir parça olarak indirilir.
// Sözleşme:   export function mount(el, ctx) { … }
//               el  = data-module özniteliğini taşıyan öğe
//               ctx = { fx, scroll, on, root }
//                 fx.tier  → 'full' | 'lite' | 'off'   (hareket azaltma/Kapalı ise animasyon yapmayın)
//                 on(fn)   → sayfa değişince / efekt katmanı değişince çağrılacak temizlik işlevi kaydeder
//                 root     → sayfanın <main> öğesi
//             mount bir temizlik işlevi döndürebilir (olay dinleyicileri, gözlemciler, zamanlayıcılar burada kaldırılır).
//
// Kurallar:
//   • Yalnızca DOM + standart tarayıcı API'si; sunucuya istek yok (statik site). Veri gerekiyorsa /assets/data/*.json (fetch).
//   • İlerleyici geliştirme: JS çalışmasa da sayfa içeriği ve bağlantıları kullanılabilir olmalı.
//   • Çerez/localStorage kullanmayın (çerez politikası "yalnızca boraden-fx" der); sessionStorage da kullanmayın.
//   • Erişilebilirlik: durum değişimleri aria-live bölgesiyle bildirilir, odak yönetimi korunur.
export function mount(el, ctx) {
  // örnek: el.addEventListener('click', onClick); return () => el.removeEventListener('click', onClick);
  return undefined;
}
