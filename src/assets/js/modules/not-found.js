// 404 sayfası: elle yazılmış adresin yaygın biçimlerini doğru sayfaya taşır (T-36). Büyük harf («/HIZMETLER/VERGI/»),
// Türkçe karakter («/hakkımızda/», «/hizmetler/teşvik/»), ters ya da çift eğik çizgi, sonda eksik «/» düzeltilir.
// Düzeltilmiş adres sitede varsa (aynı kökene HEAD isteği: 200 ya da yönlendirme) location.replace ile gidilir —
// geri tuşu 404'e dönmez. Yoksa sayfa olduğu gibi kalır. Sunucu kuralı gerekmez (Vercel büyük/küçük harfe duyarlıdır);
// Wagtail'de aynı iş sunucuda bir ara katmanla yapılabilir.
// Şablon: pages/404.njk — <section data-module="not-found">.

// «/HİZMETLER/Teşvik» → «/hizmetler/tesvik/». Türkçe küçük harf (I → ı, İ → i), aksanlar atılır, ı → i.
export function normalizePath(p) {
  let s = String(p || '/');
  try {
    s = decodeURIComponent(s);
  } catch (e) {
    /* bozuk kodlama: olduğu gibi */
  }
  s = s
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');
  if (!s.startsWith('/')) s = '/' + s;
  // dosya adı (uzantılı son parça) değilse sonda «/»
  if (!/\.[a-z0-9]{1,5}$/.test(s) && !s.endsWith('/')) s += '/';
  return s;
}

export function mount() {
  const here = location.pathname;
  const want = normalizePath(here);
  if (want === here) return undefined;
  let dead = false;
  const ctrl = new AbortController();
  // yönlendirme izlenmez: 200 → sayfa var; opaqueredirect → sunucu yönlendiriyor (ör. eski site adresi), tarayıcı gezinmesi izler
  fetch(want, { method: 'HEAD', redirect: 'manual', signal: ctrl.signal, credentials: 'same-origin' })
    .then((r) => {
      if (dead || !(r.ok || r.type === 'opaqueredirect')) return;
      location.replace(want + location.search + location.hash);
    })
    .catch(() => {});
  return () => {
    dead = true;
    ctrl.abort();
  };
}
