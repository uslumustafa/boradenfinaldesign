# Boraden v2 — Devir Notu

Güncellendi: 2026-10-05 (parçacık formasyonları: 46 içerik şekli + sayfa → şekil eşlemesi + beyaz sayfalarda «Şekil» kutuları; yazı tipleri boraden.com.tr ailesine; kesilen/taşan yazı ve kelime bölünmesi taraması + düzeltmeleri; son UI/UX değerlendirmesi → `docs/UX-DENETIMI-2026-10.md` §7). Önceki: 2026-10-02 (ana sayfa v2.1 + etkileşim cilası, Ekibimiz, hizmet/alan/sektör zenginleştirme, mobil şerit). Bu belge çalışmanın nerede olduğunu, nasıl çalıştırılıp doğrulanacağını ve sırada neyin beklendiğini anlatır.
Ana sayfa tasarım özeti ve ayar rehberi: `docs/HOME-REDESIGN.md`. Parçacık şekilleri, sayfa eşlemesi ve Şekil kutuları: `docs/FORMASYONLAR.md`. Tüm sayfa tiplerinin UX denetimi ve ne yapıldığı: `docs/UX-DENETIMI-2026-10.md`. Wagtail'e taşıma (blog yayın akışı dahil): `WAGTAIL_MAP.md` (kök; bileşenler/ilişkiler/ekip §12). Hesaplayıcı belgeleri: `docs/CALCULATORS-*.md`. Müşteri önizlemesi (Vercel): `docs/VERCEL.md`.

## 1. Durum özeti

- **Ön yüz tamam:** 128 sayfa (+353 yalnızca arama kaydı). Ana sayfa, 6 hizmet alanı + 47 hizmet, 10 sektör, **Ekibimiz (4 üye) + profil sayfaları**, bilgi merkezi (sirküler arşivi 247 PDF, duyuru/blog/haber,
  sektör raporları, 14 okuma notu, 60 terimlik sözlük, SSS), 11 hesaplayıcı + vergi takvimi, hakkımızda, kariyer, iletişim, arama, site haritası, 4 yasal metin (taslak), 404.
- **Doğrulama (son tur, 2026-10-02):** prod derleme (sert hata modu) yeşil — 128 sayfa; 17 bin iç bağlantıda 0 kırık; 202 birim testi geçti (146 hesaplayıcı + arama + logo bütünlüğü + ekip + ters ilişkiler + hizmet/alan/dizin/sektör çıktısı + slogan satırları);
  form, router/klavye/mobil menü/efekt anahtarı, bölüm göstergesi (HUD), ana sayfa başlık tikleri (hero), hizmet/mobil (tik animasyonu, kademeler, yerleşim, gezinme, mobil şerit, dokunma hedefleri) ve hesaplayıcı e2e hem dev hem prod sunucuda geçti; açılış sekansı senaryoları dev ve prodda geçti;
  Sayfa taraması (`tests/audit.mjs`, gerçek Chrome): 129 sayfa × 5 profil (390 hafif, 390 kapalı, 768, 1100 hafif, 1440 tam) son hâlde — yatay taşma, konsol/ağ hatası, kırık görsel, başlık atlaması, adsız bağlantı, etiketsiz alan, yinelenen id ve 24 px'ten küçük dokunma hedefi = 0; ana sayfa/Ekibimiz/alan/sektör/bilgi merkezi ayrıca 1920 tam ile 1440 hafif/kapalı profillerinde de 0.
  Gözle kontrol: 1920×1080, 1440×900, 768×1024 ve 390×844 (Hafif), Kapalı katman; ana sayfa başlığı tikleri ve bölüm adı etiketi (koyu/açık ton). Not: `forms.e2e.mjs` içindeki «forma kaydırıldı» denetimi yumuşak kaydırmayı bekleyecek biçimde düzeltildi (önceden ara sıra zamanlama yarışına giriyordu; ürün hatası değildi).
- **Doğrulama (2026-10-05, formasyonlar + yazı taramasından sonra):** `npm test` 229/229; `npm run test:e2e` (9 betik: form, router, HUD, kahraman, hizmetler, 11 hesaplayıcı, efekt kademeleri, router regresyonu, %200 metin) geçti;
  prod derleme 128 sayfa (+353 arama kaydı); `npm run links` 17 058 iç bağlantı, 0 kırık; yazı taraması 31 sayfa × 8 ekran (5 219 kare), **125 sayfanın tamamı** × 1440/390 kaydırmalı (4 753 kare) ve 125 sayfa × 7 genişlik kelime bölünmesi — sorun yok.
  Kapanış bandındaki iletişim satırı (adres · e-posta · telefon) artık kutu genişliğine göre dizilir (container query); telefon numaralarında rakam grupları bölünmez boşlukla bağlı (`phone` süzgeci: yalnızca alan kodundan sonra kırılabilir; `white-space: nowrap` kullanılmadı çünkü %200 metinde 320 px'te taşıyordu — `text-resize.e2e` bunu yakaladı).
- **Ana sayfa v2.1 (2026-10-02):** yeniden kuruldu — ≈ 9,8 ekran (öncesi ≈ 15,5), tek sabit sahne (Hizmet alanları), **açılış sekansı** (yıl sayacı + piksel piksel çözülme; ilk gelişte, atlanabilir),
  **ofis filmi** bölümü (kaydırdıkça açılan çerçeve; 4,2 MB sessiz döngü), daha iri/parlak parçacık alanı (26 bin nokta) ve her bölümde metinden uzak yerleşen şekiller; «Kapalı» katman ve mobil için ayrı düz düzen.
  Ayrıntı ve ayar rehberi: `docs/HOME-REDESIGN.md`. Eski ana sayfanın (v2.0) yedeği: `docs/archive/home-v2.0/` (geri dönüş tablosu orada).
- **Etkileşim cilası (2026-10-02):** büyütülmüş, kaydırınca kendiliğinden saklanan header; üstte ince ilerleme çizgisi; sağ kenarda bölüm noktaları (HUD: elle `data-chapter` ya da «Bu sayfada» menüsünden otomatik);
  sayfa geçişinde «3B noktalar akar»; ana sayfada hızlı fare sallamayla beliren **BORADEN** yazısı; ana sayfa başlığında «Tam ✓ doğru ✓ zamanında ✓» denetçi tikleri (satırlar `site.tagline`dan türer). Ayrıntı: `WAGTAIL_MAP.md` §7.
- **Ekibimiz (2026-10-02):** `src/data/team.json` → `/hakkimizda/ekibimiz/` + 4 kişi profil sayfası, her sektör/hizmet alanı/hizmet sayfasının altında «İlgili ekip» kartı, iletişim formunda `?kisi=`. Atama kuralları ve gizli iletişim kuralları `scripts/team.mjs` başlığında; testler `tests/team.test.mjs`.
  Dört kişinin de bilgisi eski siteden derlendi ve `needsVerification: true` — yayın öncesi kişilerle doğrulanmalı (derlemede sarı uyarı).
- **Hizmet/alan/sektör zenginleştirme (2026-10-02):** «düz yazı, boş» uyarısına yanıt olarak ortak bileşenler: künye şeridi, kapsam kartları, ilerleyen süreç, «İlgili içerik» şeridi (sektör · araç · terim · yazı — hesaplanır), arşiv fotoğrafı, «Çalışma biçimimiz» bandı, alan sayfasında birleşik SSS, dizinde 6 alan kartı.
  Hiçbiri elle yazılmış bilgi taşımaz; veri `relations.mjs`/`model.mjs`'ten gelir. «Denetçi tiki» tasarım dili (logodaki üç tike gönderme; resmî logoya dokunmaz). Mobilde ≥ 4 bölümlü sayfalarda yapışkan yatay «Bu sayfada» şeridi. Bileşen kataloğu: `WAGTAIL_MAP.md` §12; plan ve durum: `docs/UX-DENETIMI-2026-10.md`.
- **Formasyonlar ve Şekil kutuları (2026-10-05):** «iç sayfalar düz yazı gibi» geri bildirimine yanıt. Kayıt defteri 8 → **46 şekil**; her şekil sayfanın kendi içeriğinden türer
  (mutabakat, KDV zinciri, mühür, hakediş eğrisi, vergi takvimi, sirküler arşivi, sözlük ağı, Orhun Abideleri tarzında yazıt…; ilgisiz endüstri simgesi yok). Eşleme tek dosyada: `scripts/scenes.mjs`
  (47 hizmet, 10 sektör, 11 hesaplayıcı, sayfa türleri, SSS başlıkları, Hakkımızda bölümleri; bilinmeyen kimlik derlemeyi durdurur). Koyu kahramanlarda 3B dünya bu şekli gösterir;
  beyaz sayfalarda şekil **yazının arkasına değil, kendi kutusuna** çizilir (`modules/figure.js` + `world/ink.js`, 2B tuval): yan sütunda «Bu sayfada» menüsünün altında yapışkan kenar şekli
  (bölümlere indikçe dönüşür), Hizmetler/Hesaplayıcılar dizininde ve alan sayfasında yapışkan önizleme (satırın üzerine gelince o hizmetin şekli), Sektörler dizininde önizleme panelinde,
  Hakkımızda/Kariyer/İletişim'de bölüm yanında. (Yazı arkasına çizilen ilk deneme çirkin bulunduğu için kaldırıldı.) Ayrıntı: `docs/FORMASYONLAR.md`.
- **Yazı tipleri (2026-10-05):** tamamen boraden.com.tr ailesi — Montserrat (başlık), Open Sans (metin), Asap (etiket/düğme; eşit genişlikli rakam). IBM Plex Mono kaldırıldı (`--f-mono` belirteci artık Asap; ad tarihsel).
  Kullanılmayan Newsreader / IBM Plex Sans dosyaları (18 dosya, ≈ 376 KB; yayın paketine kopyalanıyordu) `_to_delete/fonts/` altına alındı; `@fontsource/{ibm-plex-mono, ibm-plex-sans, newsreader}` paketleri kaldırıldı.
- **Kesilen/taşan yazı taraması (2026-10-05):** `tests/text-clip.e2e.mjs` görünen her satırı bölümü/sahnesi dışına taşma, kenarda kesilme, yatay taşma ve opak öğe altında kalma açısından denetler.
  Bulunup düzeltilenler: ana sayfa «Hizmet alanları» sabit sahnesinin dizüstü boylarında sığmaması (başlık önceki bölümün altında kesiliyordu), yasal metinlerde kenar şeklinin taşması,
  bölüm göstergesi (HUD) etiketinin içeriğin üstüne binmesi, üst kenardan çağrılan header'ın 0,7 sn sonra yeniden kaçması (router e2e'deki ara sıra hatanın da nedeni).
  İkinci tur (31 sayfa × 8 ekran) **kelimelerin harf ortasından bölündüğünü** gösterdi (32 yer: maaş tablosunda «O/c/a/k», «görüşeceğinizde/n», «DANIŞMAN/LIK», «Telekomünikasyon»…).
  Kök neden gövdedeki `overflow-wrap: anywhere` (200 % metin büyütme için; bilerek korundu): dar sütunları harf genişliğine daraltıyor. Düzeltmeler: tablolarda kelime bölünmez (tablo kayar);
  büyük başlıklar en uzun kelimeye göre küçülür (`--lw` + `longest_word` süzgeci: `phero` h1, kapanış bandı, kapsam kartları); matris etiketleri ≤ 1240 px dikey; `cqi` ile sütuna göre başlık
  (Bilgi Merkezi koleksiyonları); yan şekil, yan sütunun öğe aralığını ve yükseklik sınırını hesaba katar. Yeni `--words` kipi site haritasındaki **tüm sayfaları** 7 genişlikte tarar (≈ 5 dk).
- **Vergi ve Denetim alan şekilleri (2026-10-05, müşteri geri bildirimi):** «Vergi ve Mali Müşavirlik» (`defter`) artık yelpaze gibi açılmış, kameraya eğik dört yaprak (üstteki defter sayfası: mavi satırlar,
  kırmızı tutar sütunları, yeşil toplam, kıvrık köşe); «Denetim ve Raporlama» (`ornekleme`, kimlik tarihsel) küp/örnekleme kafesi yerine **denetim dosyası**: finansal tablo + arkasında yaprak, örneklenen satırlarda
  mavi · kırmızı · yeşil denetçi tikleri, rapor çubukları ve büyüteç. Üst üste binen kâğıtlarda arkadaki çizgiler çizilmez (`draw.js › lineVis/polyVis`). Sıra numaraları değişmedi (ana sayfa 1–6 aralığı aynı).
- **Düğümler ve koyu bantlar (2026-10-05):** düğüm (`draw.js › node`) başına nokta tavanı — çok noktalı katmanda düz beyaz diske dönüşmüyor, ana sayfa «Yapı ağacı» gibi seyrek parlak noktalar;
  ana sayfa «Sektörler» bandı `katman` yerine `matris` (Sistemler alanıyla aynı şekil tekrarlanıyordu); Bilgi Merkezi «Koleksiyonlar» bandında şekil ızgaranın arkasına düşmesin diye sakin `ufuk`.
  Koyu bantlar sahneyi kimlikle seçer: `data-world="{{ 'matris' | scene }}"`.
- **Arka uç (Python/Wagtail) henüz yok** — bilerek: müşteri tasarımı beğenip onaylayana ve proje sahibi açıkça «başla» diyene kadar Django/Wagtail/Python kodu yazılmaz. Şablonlar/JSON'lar kolay taşınacak biçimde: bkz. `WAGTAIL_MAP.md`.
- **Depo:** GitHub `uslumustafa/boradenfinaldesign` (özel). `dist/`, `node_modules/` ve `tests/shots/` depoya girmez;
  `src/assets/documents` ≈ 156 MB (247 PDF) depoda tutulur — büyüklük için Git LFS/harici depolama kararı §7'de.

## 2. Çalıştırma

```
npm install                 # bir kez
npm run dev                 # derle + sun (http://127.0.0.1:4181) + src/ ve scripts/ değişince yeniden derle
npm run build               # dev derleme (hata yalıtımlı: bir sayfa bozulsa diğerleri üretilir; hatalar konsola/kırmızı sayfaya yazılır)
npm run build:prod          # prod: dist/'i siler, küçültür, HER hatada durur
npm run build:assets        # yalnızca CSS/JS/yazı tipi/görsel (Wagtail hattı için; BORADEN_DIST ile hedef klasör)
npm run serve               # dist/'i sunar (PORT, BORADEN_DIST ortam değişkenleri)
```

Mac uyuyunca/yeniden başlayınca sunucu gider; yeniden `npm run dev`. `BORADEN_DIST=/yol` çıktı klasörünü değiştirir (paralel çalışmalar için).

## 3. Doğrulama araçları (`tests/`)

| Komut | Ne yapar |
|---|---|
| `npm test` | Birim testleri (229): `formations` (46 şekil üretilebilir/sonlu/sahne ölçüsünde/tekrarlanabilir; eşlemeler yalnızca var olan şekillere; Hakkımızda yazıt), `calc-bordro`, `calc-vergi` (146), `search` (arama), `logo` (md5, tek bileşen, süs yok, `logo: true` fotoğraflar hiçbir yerde kullanılmaz), `filters` (slogan → başlık satırları, başlıklardaki en uzun kelime, telefon gruplaması), `team` (atama kuralları, gizli iletişim, veri bütünlüğü), `relations` (ters ilişkiler, fotoğraf havuzu, künye), `services` (hizmet/alan/dizin/sektör çıktısı ↔ model; her `.svc__label` `data-reveal` taşır) |
| `npm run links` | `dist/` içindeki tüm iç bağlantı ve #çapaları denetler (`--dist=`, `--only=`) |
| `npm run test:e2e` | `forms.e2e.mjs` (iletişim/kariyer formu + ziyaretçi yolunda `mailto:` denemesi, gerçek Chrome) + `router.e2e.mjs` (sayfa geçişi/geri-ileri/modüllerin yeniden kurulması, «İçeriğe geç», mega menü klavyesi, mobil menü inert/Esc, efekt anahtarı/depolama) + `hud.e2e.mjs` (bölüm göstergesi: elle/menüden türeyen, genişlik ve kademeler) + `hero.e2e.mjs` (ana sayfa başlığı tikleri: sırayla çizilme, kademeler, erişilebilirlik, yerleşim) + `services.e2e.mjs` (hizmet/alan/dizin/sektör: tik animasyonu, Tam/Hafif/Kapalı/hareket azaltma, 390–1440 px taşma ve ızgara, gezinme, mobil «Bu sayfada» şeridi, ≥ 24 px dokunma hedefleri) + `calc-smoke.mjs` (11 hesaplayıcı, örnekler, seçenek geçişleri) — çalışan sunucu gerekir; her betik `--base=http://127.0.0.1:PORT` kabul eder |
| `npm run audit -- --w=390 --mobile --fx=lite` | Tüm sayfaları gerçek Chrome'da tarar: taşma, konsol/ağ, başlık düzeni, alt metin, adsız bağlantı, yinelenen id, etiketsiz alan, hedef boyutu. `--only=/yol/,/yol/*`, `--shots=` |
| `node tests/sheet.mjs --paths=/sektorler/ --w=390` | Tam sayfa görüntüsünü sütunlara bölüp tek JPEG'e dizer (Pillow gerekir) |
| `node tests/shot.mjs --path=/ --scroll=0,25%,#alanlar --name=home [--fx=full|lite|off] [--mobile]` | Kaydırmalı ekran görüntüsü (headless Chrome; sekme arka plandayken rAF/3B durduğu için bunu kullanın) |
| `node tests/menus.mjs` | Mega menü panelleri + alt bilgi görüntüsü |
| `node tests/probe.mjs /yol "<seçici>"` | Seçicinin boyut/konum/ata zincirini yazar (hata ayıklama) |
| `npm run test:text` (`node tests/text-clip.e2e.mjs [--full] [--only=/,/hizmetler/] [--sizes=1440x900,390x844]`) | Kesilen / taşan / örtülen yazı ve harf ortasından bölünen kelime taraması: sayfaları baştan sona kaydırıp görünen her satırı denetler (✘ hata, ⚠ uyarı). Varsayılan 20 sayfa × 4 ekran (≈ 6 dk); `--full` 31 sayfa × 8 ekran (≈ 17 dk) |
| `npm run test:words` (`… --words`) | Site haritasındaki **tüm** sayfalarda (kaydırmadan) yalnızca kelime bölünmesi — 7 genişlik, ≈ 5 dk. Yeni şablon ya da uzun başlıklı içerikten sonra çalıştırın. `--all --sizes=1440x900,390x844`: tüm sayfalarda kaydırmalı tam denetim |
| `node tests/shots/formation-sheet.mjs --ids=23,24 --tag=x` | (geliştirme, depoya girmez) Formasyonların iletişim tablosu: mürekkep üç açı + koyu parıltı; yeni şekil eklerken |

Görüntüler `tests/shots/` altına yazılır (git'e girmez).

**Test sırasında `src/` ve `scripts/` altında dosya düzenlemeyin:** `npm run dev` bunları izleyip yeniden derler; derleme ortasındaki sayfa testi yanlış sonuç verir. Prod doğrulaması için ayrı klasörde derleyin: `BORADEN_DIST=/tmp/prod node scripts/build.mjs --prod`, sonra `BORADEN_DIST=/tmp/prod PORT=4182 node scripts/serve.mjs` ve testlere `--base=http://127.0.0.1:4182`.

**Test güvenliği — e-posta uygulaması açılmamalı.** «Gerçek Chrome» (`channel: 'chrome'`) `mailto:` gezinmesini işletim sistemine devreder: geçerli bir iletişim/kariyer formu gönderen
bir test, geliştiricinin Mail'inde `info@boraden.com.tr` alıcılı gerçek taslak pencereleri açar ve her koşuda biriktirir (ilk e2e koşularında ~40 pencere birikti; hiçbiri gönderilmedi — `mailto:` yalnızca taslak açar).
Önlem üç katmanlıdır: (1) `form-kit.js` → `openMail`, otomasyonla sürülen tarayıcıda (`navigator.webdriver`) `mailto:` açmaz; ziyaretçide davranış aynıdır, «taslak hazır» paneli ve bağlantısı yerindedir.
(2) `tests/safe-context.mjs` → `guardContext(ctx)`: Navigation API ile http(s)/about/blob/data/file/javascript dışındaki her gezinmeyi iptal eder ve `window.__blockedExternal` içine yazar;
`forms.e2e`, `router.e2e` ve `calc-smoke` bağlamları bununla sarılıdır — **yeni her Playwright betiği de bağlamını `guardContext` ile sarmalıdır** (`audit`, `shot`, `probe`, `menus`, `sheet` araçları da artık sarılıdır). (3) `node tests/forms.e2e.mjs --only=mailto`: ziyaretçi yolunu
(`actHuman`: `webdriver=false`) güvenlik ağı altında dener ve tam bir `mailto:` gezinmesinin «taslak hazır» bağlantısıyla aynı adrese denendiğini doğrular (Mail yine açılmaz).

## 4. Mimari özeti

- `scripts/build.mjs` — `src/data/*.json` → `data.<ad>` (+ `data.params`, `data.legal`); `scripts/model.mjs` türetilmiş model; `scripts/routes.mjs` + `scripts/routes/*.mjs`
  sayfa tablosu (`add({url, template, title, …, ctx})`); Nunjucks şablonları `src/templates/`; CSS = `src/assets/css/*.css` sıralı birleştirme;
  JS = esbuild paketi (`src/assets/js/main.js`, bölünmüş parçalar, `[data-module]` tembel yükleyici); sitemap/robots/arama dizini üretilir.
- Ekip ve ilişkiler: `scripts/team.mjs` (kişi ↔ alan/hizmet/sektör atama kuralları), `scripts/relations.mjs` (yalnızca tek yönlü kaynaklardan ters ilişkiler: sektör/araç/terim/yazı ↔ hizmet; bilinmeyen kimlik derlemeyi durdurur), `scripts/model.mjs` (`GROUP_PHOTOS` alan fotoğraf havuzu, `photoOk`: `logo: true` kareler seçilmez);
  şablon parçaları `partials/blocks.njk` (`kunye`, `figure`, `related`, `method`) ve `partials/people.njk` (`avatar`, `card`, `person`, `band`, `mini`, `inline`); CSS `65-services.css` (künye, kapsam/süreç, ilgili, fotoğraf, alan kartları, tik, mobil şerit) ve `75-team.css`.
- Tasarım sistemi: `10-tokens.css` (renk/yazı/boşluk); beyaz «kâğıt» sayfalar + koyu şeffaf «dünya» bölümleri; marka renkleri yalnızca ince çizgi/noktalama; yazı tipleri boraden.com.tr ailesi: Montserrat (başlık) / Open Sans (metin) / Asap (etiket, düğme).
  CSS önekleri: `.ab- .cr- .ct-` (kurumsal), `.sx- .gl- .qa-` (sektör/sözlük/SSS), `.ic- .arc- .pub- .art-` (bilgi merkezi), `.lg- .sr- .sm- .rp- .rn-` (destek/okuma), `.calc` (araçlar), `.pcard .pp .pband .pf- .who` (ekip), `.kunye .sgrid .sc .flow .rel .sfig .agc .acard` (hizmet bileşenleri).
- Hareket: kendi `scroll.js` motoru, `data-reveal/lit/count/steps/toc/parallax`, fetch-and-swap yönlendirici + perde geçişi, kalıcı 3B tuval (three.js, 46 formasyon; şekiller ilk kullanımda üretilir) + beyaz sayfalarda «Şekil» kutuları (`modules/figure.js`, 2B mürekkep; eşleme `scripts/scenes.mjs`; bkz. `docs/FORMASYONLAR.md`). Efekt kademeleri **Tam / Hafif / Kapalı**
  (`html[data-fx]`, tek depolama `localStorage['boraden-fx']`, çerez yok; `prefers-reduced-motion` → Kapalı; kullanıcının açıkça seçtiği kademe hareket azaltma tercihini geçersiz kılar).
  Etkileşim: header gizleme + ilerleme çizgisi `chrome.js`; bölüm göstergesi (HUD), «Bu sayfada» izleme ve mobil şerit ortalama `behaviors.js`; fare lensi (imleç ucunda küçük parıltı; boyutu `world.js › LENS` sabitlerinden) `world.js`; geçişte `world.surge` `router.js`; BORADEN yazısı `modules/swipe-word.js`.
  Ana sayfaya özel: açılış perdesi `opening.js` (karar `layouts/base.njk` erken betiğinde), film modülü `modules/film.js`, dünya motoru `world/world.js` + `world/formations.js` (pozlar: `lx`/`ls`, shader: `uIntro/uWave/uPtr`).
- Klavye/erişilebilirlik: «İçeriğe geç» bağlantısı odağı `<main>`'e taşır; yönlendirici her geçişte odağı `<main>`'e alır ve başlığı `#live` bölgesinde duyurur (`<main>` çerçevesizdir);
  sayfa içi #çapa bağlantıları odağı da hedefe taşır; mega menü: odak ile açılır, ↓ panele girer, Esc kapatıp odağı tetikleyiciye döndürür, Tab ile başka öğeye geçince kapanır;
  mobil menü `<nav aria-label="Mobil menü">`, açıkken skip bağlantısı/`<main>`/footer `inert` olur ve Esc odağı menü düğmesine döndürür (`src/assets/js/chrome.js`, `router.js`).
- Hesaplayıcılar: `src/calc/` (saf JS çekirdek + `engines/payroll.mjs`, `engines/tax.mjs`), yıllık parametre dosyaları `src/data/params/2026-*.json`, tarayıcı arayüzü `src/assets/js/calc-ui.js`.
- Yeni sayfa modülü eklemek: `src/assets/js/modules/_template.js` şablonunu kopyalayın; şablonda `data-module="ad"` yazın.

## 5. Değişmeyen kararlar ve kurallar

- **Logo:** tek resmî dosya `src/assets/img/boraden-logo.png` (md5 `58d548f4618ac1a8df50151c5110088a`), tek bileşen `partials/logo.njk`. Üç tik bozulmaz: yeniden renk/esnetme/kırpma/filtre yok. `tests/logo.test.mjs` korur.
- **Fotoğraflar:** yalnızca arşivdeki gerçek fotoğraflar; tek kişilik/portre fotoğraf kullanılmaz; adı anılan personel yok; ekranında eski logo görünen dört kare (`meeting-logo`, `meeting-wide`, `handshake-group`, `handshake-group-2`) `photos.json` içinde `logo: true` ile işaretlidir ve hiçbir yerde seçilmez (`tests/logo.test.mjs`). Eskiler 2022 tarihlidir, yer tutucudur.
- **Ekip ve içerik bilgisi uydurulmaz:** kişi/unvan/biyografi yalnızca `team.json`'dan (eski siteden derlenmiş, `needsVerification`); portre fotoğrafı yalnızca yazılı rıza (KVKK) ile; hizmet/alan/sektör sayfalarındaki her sayaç ve ilişki veriden hesaplanır.
- **Tasarım dili:** her bölüm başlığı `class="svc__label mono" data-reveal` (denetçi tiki buna bağlı; test denetler); resmî logo dosyasına/`.brand` bileşenine JS ve CSS efekti uygulanmaz (`tests/logo.test.mjs`).
- **Dokunma hedefi ≥ 24 px (WCAG 2.5.8):** satır içi olmayan bağlantılarda `display:inline-block; padding-block:.3rem; margin-block:-.3rem; background-origin:content-box` kalıbı (düzen değişmez); `tests/audit.mjs --w=390 --mobile` ve `services.e2e.mjs › mobile` denetler.
- **Hukuki duruş:** bilgilendirici metin, üstünlük/söz yok; Boraden hakkında bilgi uydurma yok (yalnızca `content.json`/`site.json`); bağımsızlık notu `site.independenceNote` (`data-legal-review="BDY m.22"`),
  reklam yasağı (BDY m.23), KVKK/çerez/ETK; yasal sayfalar «Taslak» (noindex); formlar yalnızca ön yüz (mailto: taslağı, «gönderildi» denmez).
- **Tasarım yönü:** Deloitte gibi sade ama modern, animasyonlu geçişli, kaydırdıkça değişen; beklenen ömür ~10 yıl.
- **Müşteri ürün özeti:** `BORADEN_PRODUCT_SPEC.md` (proje sahibinde; depoda yok) — premium/global/teknolojik his; zorunlu hizmetler: Şirket Değerlemesi, Şirket Kuruluş Danışmanlığı, İK ve Bordro; başka firmaların metin/iddialarını kopyalama.
- **Video:** `src/assets/video/boraden-ofis.mp4` yalnızca arşiv görüntülerinden kurgulanır (betik: `scripts/tools/office-film.sh`); sessiz, döngü, logosuz; otomatik oynatma yalnızca «Tam» katmanda ≥ 900 px; «Duraklat/Oynat» düğmesi her zaman var. Duvarda eski logo varyantı bulunan kareler dışlandı.
- **Açılış sekansı:** ≤ ~2,5 sn, ziyaret başına bir kez (gezinme türü + yönlendiren ile; depolama yok), her zaman atlanabilir, logo kullanmaz. Davranışı değiştiren her iş `/?intro` ile (otomasyonda) yeniden denenmeli.
- **Git:** commit/push yalnızca proje sahibinin isteğiyle yapılır.
- **Arka uç:** tasarım onayı gelmeden backend (Django/Wagtail/Python) yazılmaz; şimdilik yalnızca statik ön yüz + taşıma haritası (`WAGTAIL_MAP.md`).

## 6. Kullanıcıdan beklenenler

- **Ekip onayı:** 4 kişinin biyografi, unvan ve alan/hizmet/sektör atamaları doğrulanmalı (atamalar öneridir); portre için yazılı izin (KVKK); makale/blog yazarı kimler (yazar kartı için veri yok).
- **Onay bekleyen öneriler:** alan ↔ fotoğraf eşleştirmesi (`GROUP_PHOTOS`, `scripts/model.mjs`) ve «Çalışma biçimimiz» metni (`src/data/approach.json`).
- Yeni, güncel fotoğraflar (çok kişili/detay kareler tercih; portre/tek kişilik değil).
- **Vektörlü resmî logo** (SVG/PDF/Illustrator), **favicon** (şu an `data:,` yer tutucu) ve **paylaşım görseli** (1200 × 630; şu an `og:image` 211 × 48 logo).
- **İK hizmet kapsamları:** 15 İK hizmetinin 14'ünde kapsam maddeleri aynı ve genel («İhtiyacı belirleme · Süreç hazırlığı · Kontrol ve takip») → hizmete özgü maddeler.
- **Hukuk müşaviri incelemesi:** 4 yasal metin, bağımsızlık notu, reklam yasağı ifadesi, form onay metni, `[[Yer tutucu]]` alanları, `reviewNotes` listeleri.
- **Doğrulanacak parametreler** (`needsVerification`): tevkifat sınırı, asgari kurumlar vergisi tabanı ve 7582 üretim kazancı oranı (2027 başlangıcı), KDV Eylül tarihi, e-Defter tarihleri, kıdem/ihbar vergi ikincil kaynağı, SGDP vb.
  Ayrıntı: `docs/CALCULATORS-*.md` ve `src/data/params/*.json` (`confidence`, `needsVerification`, `warn`).
- **Ofis filmi (ana sayfa):** 2022 arşiv görüntüsü — çalışanların yüzleri seçilebilir. Yayın öncesi çalışan rızası/KVKK aydınlatması; mümkünse yeni çekim (çok kişili, güncel ofis, logosuz). Yeni görüntüyle `scripts/tools/office-film.sh` yeniden çalıştırılır.
- **Okuma notları** gerçek kişi adlarını (iktisatçılar) anar → editoryal/hukuki gözden geçirme. Blog yazılarında `publicationDateVerified: false`.
- **Sirküler arşivi:** 4 kaydın tarihi, 2 kaydın numarası yok → gerçek belgeden tamamlanmalı.

## 7. Karar bekleyen konular

- **Git/depolama:** `dist/` ve `tests/shots/` `.gitignore` ile dışarıda. 247 PDF (≈156 MB) şu an depoda: Git LFS mi, harici depolama mı (Wagtail'de `wagtaildocs`)? Depo büyüklüğü bakımından karar verilmeli.
- **Alan adı/barındırma:** müşteri önizlemesi Vercel'e hazır (`vercel.json`, rehber: `docs/VERCEL.md`); plan (Hobby/Pro) ve erişim biçimi (açık bağlantı / paylaşım bağlantısı / şifre) seçilmeli. Canlıya Wagtail ile geçiş planı ayrıca belirlenecek.
- **Form gönderimi:** Wagtail gelene kadar mailto: taslağıdır; geçici olarak bir form servisi kullanılacaksa KVKK metni ve veri işleyen bilgisi hukuken netleşmeli.

## 8. Sonraki adımlar (öneri sırası)

1. Yukarıdaki beklenenlerin toplanması (fotoğraf, vektör logo, hukuk incelemesi).
2. Wagtail geçişi: `WAGTAIL_MAP.md` §9 sırası (iskelet → varlıklar → içe aktarma komutları → sayfa modelleri → şablonlar → formlar → arama/SEO → doğrulama).
3. Gerçek cihaz testi (iOS Safari/Android Chrome: 3B tuval, kaydırma motoru, perde geçişi) ve Lighthouse/CrUX bütçesi; gerekirse varsayılan efekt kademesini «Hafif» yapın.
4. İngilizce ağaç ancak içerik hazır olunca (`wagtail-localize`).
