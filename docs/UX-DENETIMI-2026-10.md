# Boraden web sitesi — UX denetimi ve zenginleştirme planı

Tarih: 2 Ekim 2026 · Kapsam: tüm sayfa tipleri (masaüstü 1440 px ve mobil 390 px ekran görüntüleri üzerinden) · Durum: **uygulandı** (ayrıntı §6); bu belge «neden böyle yaptık» kaydıdır.

Bu belge iki soruyu yanıtlar: (1) Siteye ziyaretçi gözüyle baktığımızda neyi düzeltmeliyiz? (2) Hizmet, alan ve diğer «düz» sayfalar, **hiçbir bilgi uydurmadan** nasıl zenginleşir?

---

## 1. Genel değerlendirme

**Güçlü olanlar.** Tipografi (Newsreader başlık, IBM Plex gövde) ve renk disiplini (lacivert zemin + mavi/kırmızı/yeşil üç vurgu) tutarlı. Kalıcı 3B nokta «dünyası», sayfa geçişi, mıknatıslı düğmeler, ilerleme çizgisi ve gerçek arşiv fotoğrafları kurumsal ama canlı bir ton veriyor. Menü, arama, form, erişilebilirlik (atlama bağlantısı, odak yönetimi, azaltılmış hareket) ve hız (statik çıktı) sağlam.

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
| **Fotoğraf bandı** | `photos.json` içindeki **gerçek arşiv fotoğrafları** (toplantı, ofis, masa üstü, ekip; tek kişilik/portre kareler kullanılmaz) | Tam genişlik, kaydırırken hafif açılan görsel; alt yazı | `hero_photo` (görsel seçici) |
| **Kişi kartı** | Alanı/sektörü yürüten kişi | Yapıldı (sayfa altı bantları) | `TeamMemberPage` ilişkisi |
| **Yazar kartı** | Makalenin yazarı = ekip üyesi | Makale sonunda kompakt kart + profil bağlantısı | `author` → `TeamMemberPage` |
| **Boş durum** | İçerik yokken | «Bu koleksiyona yakında yayın eklenecek» yerine ilgili araç/hizmete yönlendirme | Şablon koşulu |

**Fotoğraf eşleştirme önerisi (editör sonradan değiştirebilir).** Vergi ve muhasebe → defter/kalem yakın çekimi (`office-0301`, `pen-closeup`); Denetim → masa üstü (`table-top-*`); Danışmanlık → toplantı/el sıkışma (`meeting-*`, `handshake-*`); İnsan → ekip (`team-lobby`, `office-0329`); Sistemler → ekranlı ofis (`office-0313`, `office-0316`); Akademi → masa üstü + dizüstü (`table-top-2`). Sektörlerde fotoğraf **kullanılmaz** ya da yalnızca genel (sektöre özgü iddia taşımayan) kareler kullanılır.

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

- Ekip biyografileri eski siteden derlendi ve «doğrulanacak» işaretli; yayından önce onay gerekiyor. Portre fotoğrafı yalnızca yazılı rıza (KVKK) ile eklenir.
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
- **Ekip:** `/hakkimizda/ekibimiz/`, kişi profil sayfaları, her sektör/alan/hizmet sayfasının altında «İlgili ekip» kartı, iletişim formunda `?kisi=`.
- **Fotoğraf politikası:** ekranında eski logo görünen kareler `photos.json` içinde `logo: true` ile işaretlidir ve hiçbir yerde seçilemez (`tests/logo.test.mjs`, `tests/relations.test.mjs`).
- **Etkileşim cilası:** büyütülmüş ve kaydırınca kendiliğinden saklanan üst çubuk, üstte ince ilerleme çizgisi, mıknatıslı düğmeler, «3B noktalar akar» sayfa geçişi, ana sayfada hızlı fare sallamayla beliren BORADEN yazısı.
- **Dokunma hedefleri:** 390 px taramasında ekip bileşenlerinde ve künyede 20–22 px'lik bağlantılar bulundu (62 sayfa); iç boşluk/eksi dış boşlukla ≥ 24 px'e çıkarıldı, görünüm değişmedi (`75-team.css` sonu, `65-services.css › .kunye dd a`). `tests/audit.mjs` ve `services.e2e.mjs › mobile` korur.
- **Bölüm adı etiketi:** sağ kenardaki noktalarda bölüm değişince beliren ad, içeriğin üstüne bindiğinde (ör. Ekibimiz'de sağ sütun) okunmuyordu; yarı saydam «hap» zemin eklendi (koyu bölümde lacivert, açık bölümde beyaz; `50-home.css › .hud__label`). `tests/hud.e2e.mjs` geçer.

**Hâlâ açık.** Yazar kartı (veri yok); ekip biyografileri ve alan ↔ kişi eşleşmeleri «doğrulanacak»; portre fotoğrafı yalnızca yazılı rıza (KVKK) ile; fotoğraf ↔ alan eşleşmesi (`GROUP_PHOTOS`, `model.mjs`) ve «yaklaşım» metni (`approach.json`) müşteri onayı bekliyor.
