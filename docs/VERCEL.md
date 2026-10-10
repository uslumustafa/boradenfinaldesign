# Vercel önizleme yayını

Bu belge, statik ön yüzün müşteriye **tasarım onayı için** Vercel üzerinden gösterilmesini anlatır.
Nihai site Wagtail ile ayrı bir sunucuda çalışacak; buradaki yayın yalnızca önizlemedir.

## Depoda hazır olanlar

| Dosya | Ne yapar |
|---|---|
| `vercel.json` | Kurulum `npm ci`, derleme `npm run build:prod`, çıktı `dist/`. Adresleri sonda `/` ile sabitler (`/hakkimizda` → `/hakkimizda/`). |
| `vercel.json › headers` | Her yanıtta temel güvenlik başlıkları (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`) ve zorunlu içerik güvenlik politikası (`Content-Security-Policy`). `X-Robots-Tag: noindex, nofollow` yalnızca canlı alan adı (boraden.com.tr, www.boraden.com.tr) **dışındaki** adreslerde: `….vercel.app` ve önizlemeler arama motorlarına kapalı kalır, alan adı bağlanınca site kendiliğinden açılır. Adında içerik özeti olan JS parçalarına (`/assets/js/chunks/`) uzun süreli önbellek. |
| `vercel.json › redirects` | Sitenin kendi adres değişiklikleri (32) ve eski siteden 42 adres: ör. `/bordrolama` → `/hizmetler/muhasebe/bordrolama/` (kalıcı), `/en/…` → ana sayfa (geçici; İngilizce sayfa yok). |
| `package.json › engines` | Node 22.x (yerel geliştirmeyle aynı ana sürüm). |

Ayarlar bu dosyalardan okunur; Vercel panelinde derleme ayarı değiştirmeye gerek yoktur.
Vercel yalnızca depodaki dosyalardan derler: `.gitignore`'daki klasörler (`dist/`, `research/`, `audit-evidence/`, `_to_delete/`, `tests/shots/`) yüklenmez.

**Doğrulama (5 Ekim 2026):** temiz Linux ortamında (Node 22) `npm ci` + `npm run build:prod` → 128 sayfa, 497 dosya (≈ 171 MB; çoğu sirküler PDF arşivi).
Çıktı Mac derlemesiyle birebir aynı; büyük/küçük harf duyarlı dosya sisteminde 17 058 iç bağlantı, 0 kırık; birim testleri 229/229.

## Plan seçimi

- **Hobby (ücretsiz)** yalnızca kişisel, ticari olmayan kullanım içindir. Vercel'in tanımına göre siteyi ücret karşılığı yapmak, güncellemek veya barındırmak ticari kullanımdır; müşteri işi için **Pro** gerekir.
- **Pro:** aylık 20 $ (1 dağıtım koltuğu ve 20 $ kullanım kredisi dahil). Salt görüntüleme (Viewer) koltukları ücretsizdir.
- **Şifre koruması** yalnızca Pro'da, korunan proje başına aylık 20 $ ek ücretle.

Kaynaklar: [Fair Use Guidelines › Commercial usage](https://vercel.com/docs/limits/fair-use-guidelines) · [Pro plan](https://vercel.com/docs/plans/pro-plan) · [Deployment Protection](https://vercel.com/docs/deployment-protection)

## İlk kurulum (bir kez)

1. **Değişiklikleri GitHub'a gönderin.** Vercel `main` dalındaki son commit'i yayınlar; yerelde commit edilmemiş değişiklikler yayına girmez.
2. [vercel.com](https://vercel.com) → **Add New… → Project** → **Import Git Repository** → GitHub.
   Vercel'in GitHub uygulamasına erişim verirken **Only select repositories → `boradenfinaldesign`** seçin; diğer depolar Vercel'e açılmaz.
3. **Configure Project** ekranı:
   - **Project Name:** `boraden-onizleme` → adres `https://boraden-onizleme.vercel.app` olur. Ad alınmışsa Vercel sonuna ek getirir; daha sonra Settings → Domains'ten boştaki başka bir `*.vercel.app` adı eklenebilir.
   - **Framework Preset:** Other · **Root Directory:** `./` (depo kökü).
   - **Build and Output Settings** ve **Environment Variables:** dokunmayın.
4. **Deploy.** Derleme yaklaşık bir dakika sürer. Bitince proje sayfasındaki **Domains** satırında görünen kısa adres, müşteriye gönderilecek adrestir.

> Müşteriye yalnızca kısa adresi (`….vercel.app`) gönderin. Dağıtım listesindeki uzun adresler (`boraden-onizleme-a1b2c3d-….vercel.app`) varsayılan korumada Vercel girişi ister.

## Erişim: üç seçenek

| Seçenek | Kim görür | Ücret | Ayar |
|---|---|---|---|
| **A. Açık bağlantı** (varsayılan) | Adresi bilen herkes; arama sonuçlarında çıkmaz | Plan ücreti dışında yok | Hiçbir şey yapmayın — varsayılan «Standard Protection» üretim adresini açık bırakır |
| **B. Paylaşım bağlantısı** | Yalnızca özel bağlantıyı alan | Ücretsiz | Aşağıdaki adımlar |
| **C. Şifre** | Şifreyi bilen herkes | Pro + proje başına 20 $/ay | Settings → Deployment Protection → Password Protection |

**B için adımlar:**

1. Settings → **Deployment Protection** → **Vercel Authentication** açık, kapsam **All Deployments** → Save.
2. **Deployments** → en üstteki üretim dağıtımı (`main`) → **Share** → **Anyone with the link** → bağlantıyı kopyalayın (adreste `_vercel_share=` parametresi bulunur).
3. Gizli pencerede açıp deneyin, sonra müşteriye gönderin. Bağlantı bir kez açıldıktan sonra o tarayıcıda site normal gezilir.
4. Erişimi kapatmak için aynı menüde **Only people with access** seçin.

Hobby hesapta toplamda yalnızca **bir** paylaşım bağlantısı oluşturulabilir. Pro'da müşteri ücretsiz **Viewer** koltuğuyla ekibe de eklenebilir (görüntüleme ve önizlemelere yorum).
Kaynak: [Sharable Links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links)

## Göndermeden önce kontrol (2 dakika)

- Gizli pencerede ana sayfa, bir hizmet sayfası, iletişim ve bir hesaplayıcı; telefonda da bir kez.
- Tarayıcının geliştirici araçları → Network → sayfa isteği → yanıt başlıklarında `x-robots-tag: noindex, nofollow` görünmeli.
- Aynı yanıtta `content-security-policy` başlığı görünmeli; Console sekmesinde «Refused to …» ile başlayan satır olmamalı.
- `/olmayan-sayfa/` adresi Boraden'in 404 sayfasını açmalı; `/HIZMETLER/` gibi büyük harfli yazım doğru sayfaya geçmeli; eski bir adres (`/bordrolama`) yeni hizmet sayfasına gitmeli.

## Güncelleme ve geri alma

- `main` dalına her push otomatik olarak yeni yayın üretir; adres değişmez. Diğer dallar ayrı bir önizleme (preview) yayını üretir; bunlar korumalıdır, müşteriye göstermek için B'deki gibi paylaşım bağlantısı gerekir.
- **Geri alma:** proje ana sayfası → Production Deployment kutusu → **Instant Rollback** (Hobby: yalnızca bir önceki yayına; Pro: önceki herhangi bir üretim yayınına).
  Geri almadan sonra yeni push'lar kendiliğinden yayına girmez; aynı kutudaki **Undo Rollback** ile normale dönülür.
  Kaynak: [Instant Rollback](https://vercel.com/docs/instant-rollback)

## Önizlemenin bilinen sınırları (müşteriye söylenebilir)

- Formlar sunucuya bir şey göndermez; e-posta uygulamasında doldurulmuş bir taslak açar. Sunucu tarafı Wagtail aşamasında yazılacak.
- Favicon ve paylaşım görseli yer tutucudur; resmî vektör logo bekleniyor.
- 3 ekip profili, hukuki metinler ve bazı hesaplayıcı parametreleri onay/doğrulama bekliyor (ayrıntı: `docs/HANDOFF.md` §6).

## Canlıya geçiş notu

Statik site gerçek alan adıyla Vercel'de yayınlanırsa: alan adı Settings → Domains'ten eklenir ve DNS kayıtları Vercel'in gösterdiği gibi girilir. `X-Robots-Tag` için dosyada değişiklik gerekmez: başlık boraden.com.tr ve www.boraden.com.tr'de kendiliğinden gönderilmez (diğer adreslerde sürer). www ya da www'suz tercih yapılınca (T-02) diğer adres Domains ekranından tercih edilene yönlendirilir; `site.json › url` ve `sitemap.xml` aynı tercihe göre güncellenir.

**Vercel araç çubuğu (yorumlar):** önizleme adreslerindeki içerik güvenlik politikası Vercel'in belgelediği araç çubuğu izinlerini (`vercel.live` …) içerir; canlı alan adında politika katıdır ve araç çubuğu yüklenmez. Üretimde araç çubuğu kullanılmak istenirse aynı izinler canlı politikaya da eklenmeli. Kaynak: [Vercel Toolbar › Using a Content Security Policy](https://vercel.com/docs/vercel-toolbar/managing-toolbar)

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Derleme `npm ci` adımında duruyor | `package-lock.json` ile `package.json` uyumsuz → yerelde `npm install`, iki dosyayı birlikte commit edin. |
| Yeni değişiklik görünmüyor | Push `main` dalına gitmedi ya da derleme hata verdi (Deployments → ilgili dağıtım → Build Logs). Sayfalar her ziyarette yeniden doğrulanır; gerekirse sert yenileme. |
| Müşteri giriş ekranı görüyor | Uzun dağıtım adresi gönderilmiş ya da kapsam «All Deployments» yapılmış → kısa adresi ya da paylaşım bağlantısını gönderin. |
