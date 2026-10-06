# Boraden web sitesi — UX denetimi ve zenginleştirme planı

Tarih: 2 Ekim 2026 · Kapsam: tüm sayfa tipleri (masaüstü 1440 px ve mobil 390 px ekran görüntüleri üzerinden) · Durum: **uygulandı** (ayrıntı §6); bu belge «neden böyle yaptık» kaydıdır.
**Son değerlendirme: 5 Ekim 2026 — §7** (eklenecek / çıkarılacak / güncellenecek listesi).

Bu belge iki soruyu yanıtlar: (1) Siteye ziyaretçi gözüyle baktığımızda neyi düzeltmeliyiz? (2) Hizmet, alan ve diğer «düz» sayfalar, **hiçbir bilgi uydurmadan** nasıl zenginleşir?

---

## 1. Genel değerlendirme

**Güçlü olanlar.** Tipografi (o tarihte Newsreader başlık, IBM Plex gövde; 5 Ekim'den beri boraden.com.tr ailesi — Montserrat, Open Sans, Asap; bkz. §7) ve renk disiplini (lacivert zemin + mavi/kırmızı/yeşil üç vurgu) tutarlı. Kalıcı 3B nokta «dünyası», sayfa geçişi, ilerleme çizgisi ve gerçek arşiv fotoğrafları kurumsal ama canlı bir ton veriyor. Menü, arama, form, erişilebilirlik (atlama bağlantısı, odak yönetimi, azaltılmış hareket) ve hız (statik çıktı) sağlam.

**Ana sorun: «düzlük».** Hizmet ve hizmet alanı sayfalarında bölümler birbirinin aynısı: beyaz zemin, ince çizgi, 1–2 cümlelik metin, bölümler arası ~150–200 px boşluk. Ziyaretçi 47 hizmet sayfasından birini açtığında «ilginç bir şey olacak» hissini yaşamıyor; bir sonraki bölüme geçmek için görsel bir ödül yok. Kısa sayfa içeriği (az metin) bu düzlükte daha da boş görünüyor. Müşterinin dediği «düz yazı, boş gelecek» uyarısı doğru.

**İkinci sorun: sayfalar birbirine bağlanmıyor.** Bir hizmetten ilgili sektöre, araca, terime ya da kişiye geçiş yolu zayıftı. (Planlama anında böyleydi; kişi bağlantısı ve sektör/araç/terim/yazı ters ilişkileri sonradan eklendi — bkz. §6.)

---

## 2. Sayfa tiplerine göre bulgular

| Sayfa tipi | Ne iyi | Ne eksik | Öncelik |
|---|---|---|---|
| **Hizmet sayfası** (47) | Sol yapışkan «Bu sayfada» menüsü, «Şu durumlarda» etiketleri, Süreç/SSS/Kaynaklar yapısı tam | Tüm bölümler aynı beyaz zeminde; «Kapsam» tablo satırı, «Süreç» küçük 4 sütun, görsel çapa yok; sayfa sonunda yalnızca CTA | Yüksek |
| **Hizmet alanı** (6) | Güçlü hero ve büyük ifade cümlesi | Altı yalnızca numaralı liste; fotoğraf, SSS, ilgili sektör/araç yok | Yüksek |
| **Hizmetler dizini** | Filtre + arama çalışıyor | 47 satırlık tek uzun liste; alanlar arası ayrım zayıf | Orta |
| **Sektör sayfası** (10) | Gündem başlıkları, hizmet ızgarası, terimler, SSS, kaynaklar tam | Fotoğraf/koyu bant yok; ilgili araç ve içerik bağlantısı yok | Orta |
| **Sektörler dizini** | Üzerine gelince sağda konu önizlemesi — güzel | — | Düşük |
| **Bilgi Merkezi (merkez)** | Koyu «Koleksiyonlar» bandı, sayaçlar, sağda bölüm noktaları | Az içerikte (3 yazı, 1 duyuru) boş görünme riski → «boş durum» tasarımı gerekli | Orta |
| **Makale/Blog** | Hero + «Yayın bilgileri» kenar paneli | Yazar kartı (ekip üyesi profiline bağlı), «ilgili hizmet/araç» bandı yok | Orta |
| **Sirküler arşivi, Sözlük** | Yıl gruplama, A–Z ızgara, her terimin kalıcı adresi | — | Düşük |
| **Hesaplayıcılar dizini** | Filtre, arama, kategori sayaçları | Metin satırları; «en çok kullanılan» vitrin yok | Düşük |
| **Hakkımızda / Ekibimiz** | Fotoğraf bandı, koyu «Yaklaşım» bandı, ekip kartları | Müşteri onaylı portre/biyografi bekleniyor | — |
| **Mobil** | Hamburger menü, inert arka plan, kompakt ekip kartları | Uzun sayfalarda «Bu sayfada» menüsünün mobil karşılığı yoktu (kayan çip şeridi önerildi; §6'da yapıldı) | Orta |

**İlerleme çizgisi ve bölüm noktaları.** Üstteki ince ilerleme çizgisi her sayfada var. Sağdaki bölüm noktaları ise yalnızca `data-chapter` taşıyan ≥4 bölümü olan sayfalarda (ana sayfa, bilgi merkezi) çıkıyor; hizmet, sektör, makale, ekip profili gibi uzun sayfalarda çıkmıyor. **Çözüm** (şablon başına elle işaret koymak yerine): HUD, sayfada `data-chapter` bulamazsa sol «Bu sayfada» (`[data-toc]`) bağlantılarından bölümleri **otomatik** türetsin. Wagtail'de de aynı şablonlar kullanıldığı için editör hiçbir şey yapmak zorunda kalmaz.

---

## 3. Bileşen kütüphanesi (veriden türeyen, uydurma içermeyen)

Her bileşen **zaten var olan alanlardan** beslenir; yeni bilgi yazılmaz. Wagtail'de her biri bir `StreamField` bloğu ya da sayfa alanıdır, yani editör kapatıp açabilir.

| Bileşen | Hangi veriyi gösterir | Görünüm | Wagtail karşılığı |
|---|---|---|---|
| **Hızlı bakış şeridi** | Hizmetin kapsam / adım / çıktı / SSS sayıları + «Şu durumlarda» etiketleri | Hero altında 4 sayaçlı ince şerit | Otomatik (alan sayımı) |
| **Kapsam ızgarası** | `scope` maddeleri | Numaralı bento kartlar (2–3 sütun), üzerine gelince vurgu | `ScopeBlock` (liste) |
| **Süreç adımları** | `steps` | Koyu bant, yatay adım çizgisi; kaydırdıkça dolan çizgi; arkada `data-world` formasyonu | `ProcessBlock` |
| **Çıktı / hazırlık** | Çıktılar + «sizden istediklerimiz» | İki kart, onay işaretli liste | `DeliverablesBlock` |
| **İlgili şeridi** | Ters ilişkiler: aynı alandaki hizmetler, hizmeti anan sektörler, ilgili araç ve terimler | Alt alta değil, tek yatay «Bunlar da ilginizi çekebilir» şeridi | Otomatik (ilişki alanları) |
| **Alan SSS toplamı** | Alandaki hizmetlerin SSS'lerinden tekrarsız ilk 4–6 soru | Alan sayfasında akordeon | Otomatik |
| **Fotoğraf bandı** | `photos.json` içindeki **gerçek arşiv fotoğrafları** (masa üstü, ofis, toplantı odası, resepsiyon; insan yüzü içeren kareler kullanılmaz — müşteri talebi, 2026-10-06) | Tam genişlik, kaydırırken hafif açılan görsel; alt yazı | `hero_photo` (görsel seçici) |
| **Kişi kartı** | Alanı/sektörü yürüten kişi | Yapıldı (sayfa altı bantları) | `TeamMemberPage` ilişkisi |
| **Yazar kartı** | Makalenin yazarı = ekip üyesi | Makale sonunda kompakt kart + profil bağlantısı | `author` → `TeamMemberPage` |
| **Boş durum** | İçerik yokken | «Bu koleksiyona yakında yayın eklenecek» yerine ilgili araç/hizmete yönlendirme | Şablon koşulu |

**Fotoğraf eşleştirme önerisi (editör sonradan değiştirebilir).** Vergi ve muhasebe → defter/hesap makinesi/kalem (`desk-calc-chart`, `pen-closeup`, `office-0301`, `table-top-3`, `desk-keyboard-chart`); Denetim → açık ofis ve masa üstü (`open-office-wide`, `table-top-1`, `open-office-slats`, `desk-keyboard-chart`); Danışmanlık → toplantı odası (`meeting-room-long`, `table-top-2`, `meeting-room-glass`, `reception-lounge`); İnsan Kaynakları → okuma/resepsiyon/detay (`reading-coffee`, `reception-lounge`, `office-0301`, `pen-closeup`, `table-top-3`); Sistemler → ekranlı masa (`desk-monitor-top`, `open-office-desk`, `desk-keyboard-chart`); Akademi → masa üstü ve okuma (`table-top-2`, `reading-coffee`, `meeting-room-glass`, `open-office-slats`, `table-top-1`) — güncel hâli `scripts/model.mjs › GROUP_PHOTOS` (2026-10-06'da yüzlü kareler çıkarıldı: `team-lobby`, `office-0313/0316/0329`, `handshake-close` vb.). Sektörlerde fotoğraf **kullanılmaz** ya da yalnızca genel (sektöre özgü iddia taşımayan) kareler kullanılır.

---

## 4. Uygulama sırası

1. **İlerleme noktaları (HUD) otomasyonu** — `[data-toc]`'tan bölüm türetme; ≥4 bölümlü tüm uzun sayfalar (hizmet, sektör, makale, profil, hukuki).
2. **Hizmet sayfası zenginleştirme** — hızlı bakış şeridi, kapsam ızgarası, koyu süreç bandı, çıktı kartları, ilgili şeridi. Tek şablon (`service.njk`) → 47 sayfa birden.
3. **Hizmet alanı sayfası** — fotoğraf bandı, SSS toplamı, ilgili sektör/araç.
4. **Hizmetler dizini** — üstte 6 alan kartı (bento), altta mevcut liste.
5. **Sektör sayfası ve makale** — ilgili araç/içerik şeridi, yazar kartı, boş durumlar.
6. **Mobil** — «Bu sayfada» için yatay kayan çip şeridi.

**Kabul ölçütleri.** (a) Hiçbir yeni metin/rakam uydurulmaz; sayaçlar veriden sayılır. (b) Yalnızca arşiv fotoğrafları. (c) Efekt kademeleri (Tam / Hafif / Kapalı) ve «azaltılmış hareket» çalışır; Kapalı modda tüm içerik görünür. (d) Resmi logoya JS dokunmaz (`tests/logo.test.mjs`). (e) 390 / 768 / 1100 / 1440 px'te yatay taşma yok; tek `h1`. (f) Mevcut tüm testler (birim + e2e + bağlantı denetimi) yeşil kalır; her yeni bileşen için birim/tarayıcı testi eklenir.

---

## 5. Müşteriye sorulacaklar

- Ekip: üç kişinin biyografisi eski siteden, 22 kişinin ad/unvan/bölümü müşteri şemasından (2026-10-06); hepsi «doğrulanacak» işaretli, yayından önce onay gerekiyor. Portre fotoğrafı yalnızca yazılı rıza (KVKK) ile eklenir (6 kişi için arşivden eklendi, rıza doğrulanmalı).
- Alan/hizmet ↔ kişi eşleşmeleri **öneridir**; kimin hangi alanda görüşmeye çıkacağı müşteri tarafından onaylanmalı.
- Fotoğraf eşleştirme önerisi (yukarıda) onay bekliyor.

---

## 6. Uygulama durumu (2026-10-02)

Plan, bu belgedeki sırayla uygulandı. Her bileşen mevcut alanlardan beslenir (yeni metin/rakam yazılmadı), tek şablondan çıkar ve Wagtail'de aynı şablonlarla çalışır (`WAGTAIL_MAP.md` §12).

| Madde | Durum | Nerede / not |
|---|---|---|
| İlerleme noktaları (HUD) otomasyonu | **Yapıldı** | `behaviors.js › hud`: elle işaretli `[data-chapter]` ≥ 4 ise etiketli nokta; yoksa `[data-toc]` bağlantılarından 4–10 sessiz nokta (≥ 1360 px). «Kapalı» ve mobilde gösterilmez. `tests/hud.e2e.mjs`, `tests/services.e2e.mjs › hud` |
| Hizmet sayfası zenginleştirme | **Yapıldı** | Künye şeridi (Ref. · alan · kapsam/adım/SSS sayıları), kapsam bento kartları, ilerleyen süreç/yöntem bandı, çıktı kartları, «İlgili» şeridi (sektör · araç · terim · yazı), arşiv fotoğrafı, ilgili ekip. `service.njk` + `partials/blocks.njk` → 47 sayfa |
| Hizmet alanı sayfası | **Yapıldı** | Geniş fotoğraf bandı, alan SSS toplamı (en çok 6, tekrarsız), ilgili sektör/araç, ekip, yöntem bandı |
| Hizmetler dizini | **Yapıldı** | Üstte 6 fotoğraflı alan kartı (bento), altta filtreli liste |
| Sektör sayfası | **Yapıldı (fotoğrafsız)** | Tek kalan hizmet hücresi tam genişlik; ilgili araç, ekip. Sektörlerde fotoğraf bilerek kullanılmadı (sektöre özgü iddia riski) |
| Makale / blog | **Kısmen** | «İlgili hizmet» kartı, kaynaklar ve «Bilgi merkezinden» var. **Yazar kartı yapılmadı:** yazar verisi yok; müşteri kimlerin yazdığını bildirince `author` alanı → `TeamMemberPage` |
| Boş durumlar (bilgi merkezi) | **Yapıldı** | Boş koleksiyon «Henüz yayın yok» bloğu + diğer koleksiyonlara bağlantı gösterir (`pub-list.njk`); süzgeçte sonuç yoksa ayrı bir «bulunamadı» satırı |
| Mobil «Bu sayfada» şeridi | **Yapıldı** | ≤ 900 px ve ≥ 4 bölümde yapışkan yatay çip şeridi; aktif çip ortalanır; içerik şeridin altında kalır. `tests/services.e2e.mjs › mobile` |

**Plana ek olarak yapılanlar.**

- **Denetçi tiki + çalışma kâğıdı künyesi** («firmaya yakışan, özgün bir şey» isteği): logonun üç çizgisine gönderme yapan tik, bölüm başlıklarında belirince çizilir, süreç adımlarında kaydırdıkça dolar; künye bir denetim çalışma kâğıdının üst bilgisini andırır. Resmî logoya dokunulmaz. Her `.svc__label` tik taşır (`data-reveal`; `tests/services.test.mjs` zorunlu kılar).
- **Ana sayfa başlığında tikler:** «Tam ✓ doğru ✓ zamanında ✓» — slogandaki üç noktalama yerine denetçi tikleri (mavi · kırmızı · yeşil, sırayla çizilir). Sunumda şöyle anlatılabilir: denetçinin çalışma kâğıdında «eksiksiz mi, doğru mu, zamanında mı?» diye tek tek işaretlediği kontrolü hatırlatır. Metin uydurulmadı, yalnızca işaret eklendi. `tests/hero.e2e.mjs`.
- **Ekip:** `/hakkimizda/ekibimiz/` (bölümlere göre dizin, 25 kişi), profil sayfası olan 3 kişi, her sektör/alan/hizmet sayfasının altında «İlgili ekip» kartı (yalnızca ataması olan kişiler), iletişim formunda `?kisi=`.
- **Fotoğraf politikası:** ekranında eski logo görünen kareler `photos.json` içinde `logo: true` ile işaretlidir ve hiçbir yerde seçilemez (`tests/logo.test.mjs`, `tests/relations.test.mjs`).
- **Etkileşim cilası:** büyütülmüş ve kaydırınca kendiliğinden saklanan üst çubuk, üstte ince ilerleme çizgisi, «3B noktalar akar» sayfa geçişi, ana sayfada hızlı fare sallamayla beliren BORADEN yazısı.
- **Dokunma hedefleri:** 390 px taramasında ekip bileşenlerinde ve künyede 20–22 px'lik bağlantılar bulundu (62 sayfa); iç boşluk/eksi dış boşlukla ≥ 24 px'e çıkarıldı, görünüm değişmedi (`75-team.css` sonu, `65-services.css › .kunye dd a`). `tests/audit.mjs` ve `services.e2e.mjs › mobile` korur.
- **Bölüm adı etiketi:** sağ kenardaki noktalarda bölüm değişince beliren ad, içeriğin üstüne bindiğinde (ör. Ekibimiz'de sağ sütun) okunmuyordu; yarı saydam «hap» zemin eklendi (koyu bölümde lacivert, açık bölümde beyaz; `50-home.css › .hud__label`). `tests/hud.e2e.mjs` geçer.

**Hâlâ açık.** Yazar kartı (veri yok); ekip biyografileri ve alan ↔ kişi eşleşmeleri «doğrulanacak»; portre fotoğrafı yalnızca yazılı rıza (KVKK) ile; fotoğraf ↔ alan eşleşmesi (`GROUP_PHOTOS`, `model.mjs`) ve «yaklaşım» metni (`approach.json`) müşteri onayı bekliyor.

---

## 7. Son değerlendirme (2026-10-05): eklenecek · çıkarılacak · güncellenecek

**Kapsam.** Parçacık formasyonları ve beyaz sayfalardaki «Şekil» kutuları, yazı tipi değişikliği (Montserrat / Open Sans / Asap), ana sayfa «Hizmet alanları» ayarı ve Hakkımızda yazıtından sonra tüm sayfa tiplerine yeniden bakıldı: 1920 / 1440 / 1280 / 1024 / 390 px ekran görüntüleri (Tam, Hafif, Kapalı), kesilen/taşan yazı taraması (31 sayfa × 8 ekran boyu, sayfalar baştan sona kaydırılarak ≈ 5 200 kare) ve **sitedeki 125 sayfanın tamamında** kelime bölünmesi taraması (7 genişlik). Bu bölüm uzman değerlendirmesidir; kullanıcı araştırması ya da analitik veri yoktur.

### 7.1 Kısa sonuç

Site tutarlı ve kurumsal bir dile oturdu: koyu «dünya» bantları ile beyaz kâğıt sayfaların ritmi, her sayfada o sayfanın içeriğinden türeyen tek bir parçacık şekli (koyu kahramanda 3B, beyaz sayfada kendi kutusunda), boraden.com.tr yazı ailesi ve denetçi tikleri. Bu turda bulunan yerleşim hataları düzeltildi; büyük bir tasarım sorunu kalmadı. **Kalan işlerin çoğu tasarım değil, içerik ve onay işidir** (ekip bilgileri, İK hizmet kapsamları, yasal metinler, site simgesi ve paylaşım görseli, güncel fotoğraflar).

### 7.2 Bu turda bulunan ve düzeltilenler

| Bulgu | Neden | Düzeltme |
|---|---|---|
| Kelimeler harf ortasından bölünüyordu (32 yer): maaş tablosunda «Ocak» → O/c/a/k, vergi takviminde gün adları, Ekibimiz kapanış başlığında «görüşeceğinizde/n», sektör matrisinde «DANIŞMAN/LIK», mobilde «Telekomünikasyon», kapsam kartlarında «Dokümantasyon», Bilgi Merkezi'nde «Hesaplayıcıla/r» | Gövdedeki `overflow-wrap: anywhere` (200 % metin büyütmede taşmayı önlemek için eklenmişti) dar sütun ve tablo hücrelerini harf genişliğine kadar daraltıyor | Tablolarda kelime bölünmez, sığmazsa tablo yatay kayar (`40-components.css › .table`). Büyük başlıklar (sayfa başlığı, kapanış bandı, kapsam kartları) **en uzun kelimeye göre** gerekirse biraz küçülür: şablon `--lw` değişkenini `longest_word` süzgeciyle yazar, CSS kutuya sığacak boyu hesaplar. Matris etiketleri ≤ 1240 px'te dikey; «Koleksiyonlar» başlıkları sütun genişliğine göre (`cqi`); ilgili içerik ve rapor künyesi etiketleri daralmaz; tarihi teyit bekleyen yayın etiketi künye diliyle ve daha geniş sütunda. Gövdedeki genel ayar bilerek korundu (büyütülmüş metin testleri ona dayanıyor). |
| Gizlilik politikasında yan şeklin alt yazısı kutusundan 17 px taşıyordu (1920 × 1080) | Yan sütunun öğe aralığı ve kendi yükseklik sınırı hesaba katılmıyordu | `modules/figure.js › fitSide` |
| Kapanış bandındaki iletişim satırı 900–1500 px arasında sıkışıyordu: adres 6–12 satıra, e-posta adresi ikiye bölünüyor, telefon «483 26 / 11» diye kırılıyordu | Üç sütun her genişlikte sabit oranlıydı | Kutunun kendi genişliğine göre (container query): dar kutuda adres tam satır, altında e-posta \| telefon; telefonda tek sütun. Telefon numaralarında rakam grupları bölünmez boşlukla bağlı (`phone` süzgeci): numara en çok alan kodundan sonra kırılır, «483 26 / 11» olmaz; büyütülmüş metinde yine taşmaz |
| Koyu bantlarda «düğümler» düz, ağır beyaz disklere dönüşüyordu (Ekibimiz, Sektörler, terazi, abaküs…) | Çok noktalı katmanda düğüme yüzlerce nokta düşüyor, toplamalı karışımda doyuyordu | Düğüm başına nokta tavanı (`world/draw.js › node`); artan pay çizgilere gider — ana sayfadaki «Yapı ağacı» gibi seyrek, parlak noktalar |
| Ana sayfa «Sektörler» bandı, iki bölüm yukarıdaki «Sistemler» alanıyla aynı şekli (veri katmanı) tekrarlıyordu | Eski sahne numarası | Sektör × hizmet alanı matrisi (`data-world="{{ 'matris' \| scene }}"`) |
| (Müşteri geri bildirimi) «Vergi ve Mali Müşavirlik» şeklinde yapraklar seçilmiyordu; «Denetim ve Raporlama»daki küp anlaşılmıyordu | Altı yaprak aynı yerde üst üste duruyor, üstten bakışta tek kutuya dönüşüyordu; örnekleme kafesi soyut kalıyordu | Vergi: yelpaze gibi açılmış dört yaprak, kameraya eğik; üstteki defter sayfasında mavi satırlar, kırmızı tutar sütunları, yeşil toplam, kıvrık köşe. Denetim: öndeki finansal tablo ve arkasındaki yaprak, örneklenen satırlarda mavi · kırmızı · yeşil denetçi tikleri, altta rapor çubukları ve üstünde büyüteç (merceğin içinde satır büyür, kontrol tiki). Üst üste binen kâğıtlarda arkadaki çizgiler çizilmez (`draw.js › lineVis`) |
| Bilgi Merkezi «Koleksiyonlar» bandında şekil, sayı/metin ızgarasının arkasına düşüyordu | Şekil sağda, ızgara da sağda | Sakin ufuk arazisi (yazının arkasında şekil yok) |
| (Aynı gün, önceki tur) form alanlarının kaybolması, ana sayfa alan listesinin şişip başlığın kesilmesi, üst çubuğun yeniden kaçması, bölüm etiketinin içeriğe binmesi | Sınıf/öznitelik çakışmaları, zamanlayıcı yarışı | Düzeltildi; bkz. `docs/HANDOFF.md` |

Tarama aracı: `npm run test:text` (varsayılan 20 sayfa × 4 ekran), `--full` (31 × 8), `--all --sizes=…` (tüm sayfalar, kaydırmalı) ve `npm run test:words` (site haritasındaki tüm sayfalar × 7 genişlik, ≈ 5 dk). Yeni bir şablon ya da uzun başlıklı içerik eklendiğinde `test:words` çalıştırılmalı. Son durum: 31 sayfa × 8 ekranda (5 219 kare), sitedeki 125 sayfanın tamamında 1440 ve 390 px'te baştan sona kaydırarak (4 753 kare) ve 125 sayfa × 7 genişlikte kelime bölünmesi açısından sorun yok.

### 7.3 Eklenecekler

| Öncelik | Ne | Neden | Ne gerekiyor |
|---|---|---|---|
| Yüksek | **Site simgesi** (favicon) + Apple dokunma simgesi + web manifest | Şu an boş (`<link rel="icon" href="data:,">`): sekmede, yer imlerinde ve telefonun ana ekranında simge yok | Resmî logodaki tik işaretinden, logo dosyasına dokunmadan ayrı simge dosyaları; marka sahibinin onayı |
| Yüksek | **Paylaşım görseli** (1200 × 630) | `og:image` şu an 211 × 48 px logo; LinkedIn/WhatsApp önizlemesi küçük ve boş görünür | Arşivden bir ofis fotoğrafı + logo; onay sonrası `site.shareImage` |
| Orta | Makale **yazar kartı** | Yazının kimden geldiği güven verir; kişi bileşenleri (`partials/people.njk`) hazır, eksik olan veri | Hangi yazıyı kimin yazdığı bilgisi |
| Orta | **Ekip portreleri** | **Kısmen yapıldı (2026-10-06):** kartlar bölümlere göre kompakt satırlara çevrildi; arşivdeki etiketli karelerden 6 kişiye portre eklendi | Kalan 19 kişi için fotoğraf ve hepsi için yazılı rıza (KVKK) |
| Orta | Mobilde **tablo kaydırma ipucu** | Maaş tablosu dar ekranda artık bölünmeden yatay kayıyor; kaydırılabildiği görünür olmalı | **Yapıldı:** kayan tablonun sağ kenarı yumuşakça söner, sona gelince söner kalkar (kaydırma zaman çizelgesi; desteklemeyen tarayıcıda tablo yine kayar). Telefonda tablolar biraz sıkılaştı: takvimdeki tatiller tablosu artık kaymadan sığıyor |
| Orta (test) | Ana sayfada **hızlı görev kısayolları** (Hizmet bul · Hesapla · Kaynak ara · İletişim) | Hızlı bir iş için gelen ziyaretçi uzun kaydırmaya bağlı kalmaz | Mevcut bağlantıların yeniden düzeni; 5–8 kişilik görev testiyle karşılaştırılmalı |
| Düşük | Sirküler/duyuru **e-posta bildirimi** | Müşterinin mevzuat takibini kolaylaştırır | Arka uç (Wagtail) ve açık rıza; tasarım onayından sonra |
| Düşük | **İngilizce sürüm** | Transfer fiyatlandırması, yabancı uyruklu ikamet/çalışma izni, yurtdışına işçi gönderimi gibi hizmetler yabancı ziyaretçiye de hitap ediyor | İş kararı ve çeviri; Wagtail'de `wagtail-localize` |

### 7.4 Çıkarılacaklar

| Ne | Durum |
|---|---|
| Kullanılmayan yazı tipi dosyaları (Newsreader, IBM Plex Sans — 18 dosya, ≈ 376 KB; yayın paketine kopyalanıyordu) ve `@fontsource/{ibm-plex-mono, ibm-plex-sans, newsreader}` paketleri | **Yapıldı:** dosyalar `_to_delete/fonts/` altında, paketler `package.json` ve kilit dosyasından çıkarıldı |
| `_to_delete/` klasörü (eski `field.js`, `pointer-fx.js`, eski yazı tipleri) | Depoya girmez; gözden geçirip silebilirsiniz |
| **İK hizmetlerinde tekrar eden genel kapsam maddeleri** — 15 İK hizmetinin 14'ünde aynı üç madde («İhtiyacı belirleme · Süreç hazırlığı · Kontrol ve takip») | Hizmete özgü maddelerle değişmeli (içerik işi). Gelene kadar alan sayfasındaki kartlarda bu üç satırın gizlenmesi daha az «boş» görünür — karar sizin |
| Koyu bantlarda yazının arkasına düşen şekiller | Bu turda Bilgi Merkezi «Koleksiyonlar» bandında kaldırıldı; diğer bantlarda şekil metnin yanında |

### 7.5 Güncellenecekler

| Öncelik | Ne | Neden / öneri |
|---|---|---|
| Yüksek (içerik) | Ekip bilgileri (25 kişi `needsVerification`; 22'sinin yalnızca ad/unvan/bölümü var), yasal metinler (taslak), üç blog yazısının yayın tarihi | Yayın öncesi kişilerin, hukuk müşavirinin ve editörün onayı |
| Yüksek (içerik) | İK hizmet kapsamları | Yukarıda (7.4) |
| Orta | Yıllık güncelleme: hesaplayıcı parametreleri (`src/data/params/2027-*.json`) ve vergi takvimi | Sayfalar «2026 yılı parametreleri · Doğrulama: 1 Ekim 2026» gösteriyor; Ocak 2027'de yeni yıl dosyaları eklenmeli |
| Orta | Ekibimiz monogram kutuları | **Yapıldı (2026-10-06):** büyük kartlar 72 px'lik satır avatarlarına indirildi; bölüm başına dizin |
| Düşük (test) | Mobilde iletişim ve Ekibimiz kahramanı | Kahraman en az ekranın %64'ü (şekil üstte, metin altta): iletişim bilgileri ilk ekranın altında kalıyor. Görev sayfaları için kısa kahraman varyantı denenebilir |
| Düşük | Mobil SSS kahramanı | Şekil metnin arkasında; koyulaştırıldı, okunuyor. İstenirse mobilde şekil başlığın üstüne alınır |
| Düşük | Kısa blog yazıları | Kısa metne göre büyük kahraman: «kısa başlık + üç temel nokta + kaynaklar» düzeni (bkz. depo dışı `SITE_AUDIT_REPORT.md` §G) |

### 7.6 Bilerek korunanlar

Koyu bant + beyaz kâğıt ritmi; şekillerin yazının arkasına değil kendi yerine çizilmesi; tek H1; Tam / Hafif / Kapalı kademeleri ve «hareket azaltma»; gerçek arşiv fotoğrafları; fotoğrafsız uzmanlarda monogram; formların «taslak hazırlanır» dürüstlüğü; resmî logoya dokunulmaması; hiçbir bilginin uydurulmaması.
