# Render önizleme yayını (müşteriye gösterim)

Statik ön yüz müşteriye **tasarım onayı için** Render üzerinden gösterilir. Nihai site Wagtail ile ayrı bir sunucuda çalışacak; buradaki yayın yalnızca önizlemedir ve arama motorlarına kapalıdır.

**Neden Render (22 Ekim 2026):** Türkiye'deki servis sağlayıcılar `*.vercel.app` adreslerinin tümünü ada göre engelliyor: bağlantı, adres adı gönderildiği anda kesiliyor. Başka vercel.app siteleri de açılmıyor; aynı Vercel sunucusu başka bir adla açılıyor. Benzer engel Aralık 2023 ve Mart 2024'te de bildirilmişti. Müşteri `boraden-onizleme.vercel.app`'i açamıyordu. Aynı ağda `*.onrender.com` ve `*.netlify.app` açılıyor; `*.pages.dev` (Cloudflare) ise engelli. Vercel yayını sürer (yurt dışından ya da VPN ile açılır); müşteriye Render adresi gönderilir.

## Depoda hazır olanlar

| Dosya | Ne yapar |
|---|---|
| `render.yaml` | Render «Blueprint» tanımı: statik site `boraden-onizleme`. `main` dalına her push'ta derlenir (`npm ci` + `npm run build:prod`, Node 22), çıktı `dist/`. Yalnızca belge ya da test değişen push'ta derleme yapılmaz (`buildFilter`). **Üretilir, elle değiştirmeyin.** |
| `scripts/render-config.mjs` | `render.yaml`'ı `vercel.json`'dan üretir (`npm run render-config`). Her yolda güvenlik başlıkları; canlıdaki katı içerik güvenlik politikası (Vercel araç çubuğu izinleri olmadan); `X-Robots-Tag: noindex, nofollow`; önbellek; 74 eski adres yönlendirmesi (sonda «/» olan ve olmayan yazımla 148 kural). |
| `tests/render-config.test.mjs` | `render.yaml`'ın `vercel.json` ile eşit olduğunu ve kuralları denetler (`npm test`). |

**Vercel'den farklar:**

- Render yönlendirmeleri her zaman 301'dir: `/en/…` → ana sayfa da 301 (Vercel'de 302).
- Yönlendirme, yalnızca o adreste dosya yoksa uygulanır. Test, yönlendirilen eski adreslerde sayfa olmadığını denetler.
- `?v=` ile istenen `site.css`, `main.js` ve arama dizini uzun önbelleğe alınmaz, çünkü Render'ın başlık kuralları sorgu koşulu bilmez. Bu dosyalar her ziyarette doğrulanır.
- Vercel araç çubuğu (yorumlar) yok.

## Plan ve sınırlar (Hobby, ücretsiz)

- Statik siteler ücretsizdir. Çalışma alanı başına ayda **5 GB** giden trafik dahildir. Ana sayfanın ilk açılışı masaüstünde ≈ 9 MB (videonun 1080p dosyası 8 MB), telefonda ≈ 4,5 MB; yani ayda birkaç yüz ziyaret.
- Ayda **500 derleme dakikası** dahildir (bir derleme ≈ 1–2 dk). Aşımda trafik 0,15 $/GB, derleme 5 $/1000 dk.
- Kaynak: [Render Pricing](https://render.com/pricing) · [Static Sites](https://render.com/docs/static-sites) · [Blueprint YAML Reference](https://render.com/docs/blueprint-spec)

## İlk kurulum (bir kez, ≈ 3 dakika)

1. Şu bağlantıyı açın: <https://render.com/deploy?repo=https://github.com/uslumustafa/boradenfinaldesign>
2. **GitHub ile giriş yapın.** Render GitHub erişimi isterken **Only select repositories → `boradenfinaldesign`** seçin; diğer depolar Render'a açılmaz.
3. Blueprint ekranında servis adı (`boraden-onizleme`) ve dal (`main`) `render.yaml`'dan gelir → **Deploy Blueprint / Apply**. Statik site ücretsizdir.
4. İlk derleme birkaç dakika sürer. Bitince servis sayfasının üstündeki adres (`https://boraden-onizleme.onrender.com`; ad alınmışsa sonuna ek gelir) müşteriye gönderilecek adrestir.

## Göndermeden önce kontrol (2 dakika)

- Adres yeni bir pencerede açılıyor; ana sayfa videosu oynuyor; telefonda da bir kez bakın.
- Tarayıcının geliştirici araçları → Network → sayfa isteği → yanıt başlıklarında `x-robots-tag: noindex, nofollow` ve `content-security-policy` görünmeli; Console'da «Refused to …» satırı olmamalı.
- Eski bir adres (`/bordrolama`) yeni hizmet sayfasına gitmeli; `/olmayan-sayfa/` Boraden'in 404 sayfasını açmalı.

## Güncelleme

- `main` dalına her push otomatik yayın üretir; adres değişmez. Yalnızca `docs/`, `tests/`, `.github/`, `README.md` ya da `WAGTAIL_MAP.md` değiştiyse derleme yapılmaz.
- `vercel.json`'da başlık ya da yönlendirme değişirse `npm run render-config` çalıştırıp `render.yaml`'ı da commit edin. `npm test` eşitliği denetler; Render Blueprint değişikliğini kendisi uygular.
- Geri alma: istenmeyen değişikliği geri alan bir commit (`git revert`) push edilir; Render yeniden yayınlar.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Derleme `npm ci` adımında duruyor | `package-lock.json` ile `package.json` uyumsuz → yerelde `npm install`, iki dosyayı birlikte commit edin. |
| Yeni değişiklik görünmüyor | Render → servis → Events: derleme hatası ya da yalnızca belge/test değişikliği (derleme yapılmaz). |
| Adres Türkiye'den açılmıyor | `*.onrender.com` da engellenirse servise kendi alan adı bağlanır (Settings → Custom Domains; DNS'te CNAME). |
