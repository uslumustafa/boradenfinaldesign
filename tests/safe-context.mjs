// Test güvenliği — her Playwright betiği bağlamını (browser.newContext) bununla sarmalar:
//   const ctx = await guardContext(await browser.newContext({ … }));
//
// Neden: «gerçek Chrome» (channel: 'chrome'), bir sayfa mailto:/tel: gibi harici bir şemaya gittiğinde bunu işletim sistemine devreder.
// Geçerli bir form gönderen bir test, geliştiricinin e-posta uygulamasında (alıcı: şirketin gerçek adresi) gerçek taslak pencereleri açar
// ve her koşuda biriktirir. Bir test, kodu değişse bile bunu bir daha yapamasın diye her bağlama bir güvenlik ağı kurulur:
// http(s)/about/blob/data/file/javascript dışındaki her gezinme Navigation API ile yakalanıp İPTAL edilir ve
// window.__blockedExternal içine yazılır (testler bu listeyi okuyarak «e-posta uygulaması açılmadı / şu taslak denendi» diyebilir).
// Not: window.__blockedExternal her belge yüklemesinde sıfırlanır; denetim, eylemden hemen sonra aynı belgede yapılmalıdır.

export async function guardContext(ctx) {
  await ctx.addInitScript(() => {
    window.__blockedExternal = [];
    if (!window.navigation) return;
    window.navigation.addEventListener('navigate', (e) => {
      if (/^(https?|about|blob|data|file|javascript|chrome|chrome-error):/i.test(e.destination.url)) return;
      window.__blockedExternal.push(e.destination.url);
      if (e.cancelable) e.preventDefault();
    });
  });
  return ctx;
}

// «Gerçek ziyaretçi» gibi görünmek için (navigator.webdriver=false): yalnızca uygulamanın ziyaretçi yolunu denetleyen testlerde,
// guardContext ile BİRLİKTE kullanılır — aksi halde mailto: gerçekten işletim sistemine gider.
export async function actHuman(ctx) {
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }));
  return ctx;
}
