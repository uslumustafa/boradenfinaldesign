# Parçacık formasyonları (şekiller)

Sitenin imza görseli, noktalardan oluşan ve kaydırdıkça biri diğerine dönüşen **formasyonlardır**. Aynı şekil üreticileri iki yerde çizilir:

| Yer | Çizici | Görünüm |
| --- | --- | --- |
| Koyu bölümler (ana sayfa, alt sayfa kahramanları, «Çalışma biçimimiz», iletişim çağrısı) | `src/assets/js/world/world.js` (three.js, WebGL) | Koyu zeminde parıltı; sayfalar arasında kalıcı «dünya» |
| Beyaz sayfalardaki **Şekil kutuları** | `src/assets/js/modules/figure.js` → `world/ink.js` (2B tuval) | Açık zeminde mürekkep renkleri (lacivert, mavi, kırmızı, yeşil) |

## İlke: şekil, sayfanın kendi içeriğinden gelir

Her şekil, bağlı olduğu sayfanın metninde geçen bir şeyi anlatır: *Cari Hesap Mutabakatları* → iki defterin satırlarını eşleyen **mutabakat**; *KDV İade İşlemleri* → yüklenilen/hesaplanan vergiyi gösteren **KDV zinciri**; *Vergi Takvimi* → gerçek son gün tarihleriyle **takvim**; *Hakkımızda* → Orhun Abideleri tarzında **yazıt**. İlgisiz endüstri simgeleri (DNA, dişli, türbin…) kullanılmaz. Rakam taşıyan şekiller (ör. `petek`: 10·8·6·15·3·5 = 47 hizmet; `arsiv`: yıllara göre sirküler sayısı; `soru`: 6·5·5·5·6 = 27 soru) `src/data` altındaki gerçek verilerden alınmıştır; veri değişirse şekil dosyasındaki dizi de güncellenmelidir.

`yazit` şeklindeki işaretler runik **izlenimi** veren soyut çizgilerdir; gerçek bir Göktürk metnini okumaz (yanlış okunabilecek uydurma yazı olmasın diye).

## Şekil kutusu (beyaz sayfalar)

Şekil yazının **arkasına değil, kendi yerine** çizilir; yazıyla, kartla, fotoğrafla çakışmaz. Makro: `{{ m.fig(kind, shapes) }}` (`partials/macros.njk`).

| Tür | Nerede | Davranış |
| --- | --- | --- |
| `side` | Yapışkan yan sütunda «Bu sayfada» menüsünün altında (hizmet, sektör, hesaplayıcı, kişi, okuma notu, yayın, yasal metin, SSS, arama, Hakkımızda bölümleri) | Yan sütunda kalan boşluk kadar yükseklik alır; yer yoksa (kısa ekran) ya da mobil düzende kendini gizler |
| `pv` | Hizmetler ve Hesaplayıcılar dizininde sağda, alan sayfasında hizmet kartlarının solunda | Yapışkan önizleme: bölüme göre alanın/grubun şekli, satırın üzerine gelince o hizmetin/hesaplayıcının şekli |
| `lead` | Bölüm içinde metnin yanında (Hakkımızda › Kuruluş, Kariyer girişi, İletişim kanalları) | Sabit; görünür olunca toplanır, yavaşça salınır |

Sektörler dizininde önizleme panelinin üstündeki kutu üzerine gelinen sektörün şeklini gösterir.

**Şekil dizisi:** kutunun `data-shapes` değeri → yoksa `main[data-shapes]` (rotadan) → yoksa `main[data-scene]`.

**Bölüm işaretleri:** aynı beyaz bölümde (`.sheet`) `[data-shape-at="kimlik"]` taşıyan bölüm ekranın ortasına geldikçe şekil sırayla o şekle döner. Dönüşüm zamana yayılır (hızlı kaydırmada bile ≈1 sn). Örnek: hizmet sayfasında *Süreç* → `akis`, komşu hizmetler → alanın şekli; sektör sayfasında *İlgili hizmetler* → `petek`, *SSS* → `soru`, *Diğer sektörler* → `matris`.

**Üzerine gelme:** `[data-shape-hover="kimlik"]` taşıyan satır/kartın üzerine fareyle gelince (ya da klavyeyle odaklanınca) şekil geçici olarak o şekle döner; ayrılınca geri gelir. Dokunmatik ekranda devre dışıdır.

**Katmanlar:** Tam = canlı, 60 fps, küçük fare lensi · Hafif = canlı, 30 fps, daha az nokta · Kapalı (ve `prefers-reduced-motion`) = hareketsiz tek kare, dönüşüm anlık. Görünmeyen kutu çizilmez; yazdırmada ve yüksek karşıtlık tercihinde gizlenir; JS yoksa görünmez.

> Not: form alanlarının sınıfı `.field`'dır (form-kit). Şekil bileşeni bilerek `.fig` adını taşır; bu iki adı karıştırmayın.

## Sayfa → şekil eşlemesi

Tek kaynak: `scripts/scenes.mjs`.

- `AREA_SHAPE` — 6 hizmet alanı (ana sayfadaki alan şekilleri)
- `SERVICE_SHAPE` — 47 hizmet (her satırın yanında gerekçesi yazılıdır)
- `SECTOR_SHAPE` — 10 sektör / müşteri segmenti
- `CALC_SHAPE`, `CALC_GROUP_SHAPE` — 11 hesaplayıcı ve grupları
- `FAQ_SHAPE`, `ABOUT_SHAPE` — SSS başlıkları ve Hakkımızda bölümleri
- `PAGE` — sayfa türleri (`{ scene, fig }`)

Rotalar `scene` (kahraman sahnesi) ve `fig` (şekil kutusunun varsayılan dizisi) alanlarını **kimlikle** verir; `routes.mjs › add` bunları doğrular. Bilinmeyen kimlik ya da şekli tanımlanmamış yeni bir hizmet/sektör/hesaplayıcı **derlemeyi durdurur** (sessizce boş sayfa üretilmez).

Wagtail karşılığı: `Page.scene` ve `Page.fig` (formasyon seçici, kimliğe göre); `ServicePage.shape`, `SectorPage.shape`, `CalculatorPage.shape`. Bölüm işaretleri şablondadır; veri gerekmez.

**Koyu bantlar** (sayfa içindeki `sec--dark` bölümleri) sahneyi şablonda kimlikle seçer: `data-world="{{ 'matris' | scene }}"` (`scene` süzgeci = `scenes.mjs › sceneOf`; bilinmeyen kimlik derlemeyi durdurur). Eski bantlarda sıra numarası (`data-world="7"`) kalabilir — sıra kalıcıdır.
Kural: sık metin/sayı ızgarası taşıyan bantta şekil yazının arkasına düşmemeli; o zaman sakin `ufuk` arazisi kullanılır (Bilgi Merkezi «Koleksiyonlar», Sektörler «İlgi matrisi»). Ana sayfa «Sektörler» bandı `matris`tir (önceden `katman` idi; «Sistemler» alanıyla aynı şekil tekrarlanıyordu).

## Kayıt defteri

`src/assets/js/world/formations.js › FORMATIONS`. **Sıra kalıcıdır** (sayfalar sahneyi sıra numarasıyla da seçebilir: `data-world="7"`); yeni şekil yalnızca **sona** eklenir, araya eklenmez, silinmez.

| # | Kimlik | Açıklama (ekrandaki «Şekil ·» yazısı) |
| --- | --- | --- |
| 0 | `ufuk` | Ufuk — veri arazisi (ana sayfa açılışı) |
| 1 | `defter` | Defter ve beyan yaprakları — kayıt düzeni, tutar sütunları (yelpaze gibi açılmış yapraklar; üsttekinin altında kalan kenarlar çizilmez — `draw.js › lineVis`) |
| 2 | `ornekleme` | Denetim dosyası — finansal tablo, büyüteç ve denetçi tikleri (örneklenen satırlar mavi · kırmızı · yeşil tikle işaretli, merceğin içinde büyür; altta rapor çubukları). Kimlik tarihsel: 2026-10-05'e kadar 3B örnekleme kafesiydi |
| 3 | `agac` | Yapı ağacı — karar ve organizasyon yapısı |
| 4 | `halka` | Yıl halkası — on iki aylık bordro döngüsü |
| 5 | `katman` | Veri katmanları — sistem ve raporlama |
| 6 | `sutunlar` | Sütunlar — bilgi ve öğrenme |
| 7 | `kapi` | Kapı — görüşmeye açılan yol (iletişim çağrısı) |
| 8 | `kayip` | Kayıp dağılımı — beklenen kredi zararı ve kuyruk riski |
| 9 | `maliyet` | Maliyet akışı — hammadde, işçilik ve genel üretim gideri |
| 10 | `varlik` | Varlık ömrü — aktifleştirme, amortisman ve değer düşüklüğü |
| 11 | `sube` | Şube ağı — merkez kayda bağlanan çok noktalı yapı |
| 12 | `edim` | Edimler — sözleşmenin zamana yayılan gelir dilimleri |
| 13 | `alacak` | Alacak akışı — hasta, özel sigorta ve kurum gelirleri |
| 14 | `hakedis` | Hakediş eğrisi — yıllara yaygın işte ilerleme |
| 15 | `sezon` | Sezon eğrisi — aylık gelir ve sabit gider |
| 16 | `uc-halka` | Üç halka — aile, mülkiyet ve işletme |
| 17 | `savunma` | Üç savunma hattı — yönetim, risk ve uyum, iç denetim |
| 18 | `terazi` | Terazi — bağımsızlık ve denge |
| 19 | `bilanco` | Bilanço — aktif ile pasifin dengesi |
| 20 | `muhur` | Mühür — tasdik ve onaylı belge |
| 21 | `mutabakat` | Mutabakat — karşılıklı kayıtların eşleşmesi |
| 22 | `dilimler` | Dilimler — kademeli oran ve hesap |
| 23 | `kdv-zinciri` | KDV zinciri — yüklenilen ve hesaplanan vergi |
| 24 | `nakit` | Akış şelalesi — başlangıçtan kapanışa kalem kalem değişim |
| 25 | `rasyo` | Rasyo radarı — finansal oranların dengesi |
| 26 | `hile` | Hile üçgeni — baskı, fırsat, gerekçelendirme |
| 27 | `kup` | Veri küpü — boyutlara göre dilimlenen veri |
| 28 | `akis` | Süreç akışı — adım, karar ve kontrol noktası |
| 29 | `pay` | Pay dağılımı — ortaklık ve sermaye yapısı |
| 30 | `petek` | Hizmet alanları — altı alan, kırk yedi hizmet başlığı |
| 31 | `matris` | Sektör ve hizmet alanı — her sektörde öne çıkan hizmetler |
| 32 | `ag` | Uzmanlık ağı — kişiler ve çalıştıkları alanlar |
| 33 | `yayin` | Yayınlar — sirküler, duyuru, blog ve haber |
| 34 | `kitap` | Okuma notları — kitaplardan alınan notlar |
| 35 | `abakus` | Abaküs — kalem kalem hesap |
| 36 | `takvim` | Takvim — aylara yayılan beyan ve ödeme günleri |
| 37 | `basvuru` | Başvuru yolu — adım adım daralan kapılar |
| 38 | `yonlendirme` | Yönlendirme — mesajınız konuya göre ilgili alana ulaşır |
| 39 | `arama` | Arama — sitedeki sayfalar arasında eşleşenler |
| 40 | `arsiv` | Arşiv — yıllara göre sirküler dosyaları |
| 41 | `sozluk` | Sözlük — birbirine bağlı terimler |
| 42 | `gizlilik` | Gizlilik — kişisel verinin korunması |
| 43 | `sure` | Hizmet süreleri — yıllara yayılan çalışma ve sigortalılık dönemleri |
| 44 | `soru` | Sorular — başlıklara göre toplanan sorular ve yanıtlar |
| 45 | `yazit` | Yazıt — Orhun Abideleri tarzında dikili taşlar |

Kayıttaki diğer alanlar: `spin` (sürekli dönüş; 0 = dönmez), `sway` (>0 ise dönmek yerine ± salınım — düzlemsel şekiller yandan ince görünmesin), `pose` (WebGL kamerası; yeni şekiller için `POSE({ dx, dy, dz, ly })`), `view` (mürekkep çizimi için başlangıç bakışı: `pitch`, `yaw`).

## Yeni şekil eklemek

1. Şekli `world/shapes-*.js` dosyalarından birine saf bir işlev olarak yazın: `export function ad(p, rnd, Nf) { const d = new Draw(p, rnd); …; d.done(Nf); }`. Yerleşim kutusu: x ∈ [−6,5, 6,5], y ∈ [−4,2, 4,2], z ∈ [−3,5, 3,5]. Çizim yardımcıları (`line`, `poly`, `arc`, `curve`, `rect`, `hatch`, `box`, `grid`, `cloud`, `node`, `scatter`, `lineVis`/`polyVis`) `world/draw.js`'te; noktalar ağırlığa göre dağıtılır, şekil 2 bin ya da 26 bin noktayla aynı görünür.
   Nokta bulutunda örtme yoktur: üst üste binen yüzeyler (kâğıt yığını, öndeki yaprak) için `lineVis(a, b, vis)` kullanın — çizginin yalnızca `vis(x, y, z)` doğru olan kısmı çizilir (örn. `defter`, `ornekleme`); aksi hâlde arkadaki çizgiler öndekinin içinden görünür ve şekil karmaşık bir kutuya döner.
   **Düğüm (`node`) istisnadır:** nokta sayısının yarıçapa bağlı bir tavanı vardır (`cap ≈ 10 + 90·r`; r 0,25 → ≈ 32 nokta), artan pay çizgilere gider. Tavan olmadan çok noktalı katmanda (WebGL, toplamalı karışım) düğüm düz, ağır bir beyaz diske dönüşüyordu. Dolu görünmesi gereken boncuk gibi öğelerde tavan yükseltilebilir: `d.node(q, r, w, { cap: 72 })` (abaküs).
2. `formations.js › FORMATIONS` dizisinin **sonuna** kayıt ekleyin (kimlik, `figure` açıklaması, `pose`, `view`).
3. Önizleme: `node tests/shots/formation-sheet.mjs --ids=46 --tag=yeni` (mürekkep üç açı + parıltı). Şekil sadece bu bakışlarda değil, kahramanda da kontrol edilmelidir.
4. Eşlemeyi `scripts/scenes.mjs`'e ekleyin; `npm run build` bilinmeyen kimliği yakalar.

Performans: şekiller ilk kullanıldıklarında üretilir (`lazyFormations`); 26 bin noktada en yavaşı ≈30 ms, ortalama ≈12 ms. Şekil kutusu ayrı bir JS parçasıdır ve yalnızca sayfada kutu varsa yüklenir.

## İlgili testler

- `tests/formations.test.mjs` — 46 şeklin her biri üretilebilir, sonlu, sahne ölçüsünde (içerik şekilleri |x| ≤ 7,5, |y| ≤ 5,5, |z| ≤ 6) ve aynı tohumla tekrarlanabilir; kimlikler tekil, ilk 8 ana sayfa sahnesi yerinde; `scenes.mjs` eşlemeleri yalnızca var olan şekillere gider; Hakkımızda terazi değil yazıt
- `tests/world-contact-pose.test.mjs` — kahraman kamerası/dönüşü (gerçek three.js izdüşümü)
- `tests/services.test.mjs` — hizmet ve alan sayfalarında «Çalışma biçimimiz» bandının alan sahnesi
- `npm run test:e2e` — gezinme, kahraman, metin büyütme, efekt katmanları
