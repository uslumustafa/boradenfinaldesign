# Parçacık formasyonları (şekiller)

Sitenin imza görseli, noktalardan oluşan ve kaydırdıkça biri diğerine dönüşen **formasyonlardır**. Aynı şekil üreticileri iki yerde çizilir:

| Yer | Çizici | Görünüm |
| --- | --- | --- |
| Koyu bölümler (ana sayfa, alt sayfa kahramanları, «Çalışma biçimimiz», iletişim çağrısı) | `src/assets/js/world/world.js` (three.js, WebGL) | Koyu zeminde parıltı; sayfalar arasında kalıcı «dünya» |
| Beyaz sayfalardaki **Şekil kutuları** | `src/assets/js/modules/figure.js` → `world/ink.js` (2B tuval) | Açık zeminde mürekkep renkleri (lacivert, mavi, kırmızı, yeşil) |

## İlke: şekil, sayfanın kendi içeriğinden gelir

Her şekil, bağlı olduğu sayfanın metninde geçen bir şeyi anlatır: *Cari Hesap Mutabakatları* → iki defterin satırlarını eşleyen **mutabakat**; *KDV İade İşlemleri* → yüklenilen/hesaplanan vergiyi gösteren **KDV zinciri**; *Vergi Takvimi* → gerçek son gün tarihleriyle **takvim**; *Hakkımızda* → Orhun Abideleri tarzında **yazıt**. İlgisiz endüstri simgeleri (DNA, dişli, türbin…) kullanılmaz. Rakam taşıyan şekiller (ör. `petek`: 7·6·19·5·7·7·4·5 = 60 hizmet; `arsiv`: yıllara göre sirküler sayısı; `soru`: 6·5·5·5·6 = 27 soru) `src/data` altındaki gerçek verilerden alınmıştır; veri değişirse şekil dosyasındaki dizi de güncellenmelidir.

`yazit` şeklindeki işaretler runik **izlenimi** veren soyut çizgilerdir; gerçek bir Göktürk metnini okumaz (yanlış okunabilecek uydurma yazı olmasın diye).

## Şekil kutusu (beyaz sayfalar)

Şekil yazının **arkasına değil, kendi yerine** çizilir; yazıyla, kartla, fotoğrafla çakışmaz. Makro: `{{ m.fig(kind, shapes) }}` (`partials/macros.njk`).

| Tür | Nerede | Davranış |
| --- | --- | --- |
| `side` | Yapışkan yan sütunda «Bu sayfada» menüsünün altında (hizmet, sektör, hesaplayıcı, kişi, okuma notu, yayın, yasal metin, SSS, arama, Hakkımızda bölümleri) | Yan sütunda kalan boşluk kadar yükseklik alır; yer yoksa (kısa ekran) ya da mobil düzende kendini gizler |
| `pv` | Hizmetler ve Hesaplayıcılar dizininde sağda, alan sayfasında hizmet kartlarının solunda | Yapışkan önizleme: bölüme göre alanın/grubun şekli, satırın üzerine gelince o hizmetin/hesaplayıcının şekli |
| `lead` | Bölüm içinde metnin yanında (Hakkımızda › Kuruluş, Kariyer girişi, İletişim kanalları) | Sabit; görünür olunca toplanır, yavaşça salınır |

Sektörler dizininde önizleme panelinin üstündeki kutu üzerine gelinen sektörün şeklini gösterir. Ana sayfanın koyu «Sektörler» bandında kutu yoktur: bandın kendi 3B şekli (matris) bir sektörün üzerine gelince o sektörün şekline döner (aşağıda, «Koyu bantlar»).

**Şekil dizisi:** kutunun `data-shapes` değeri → yoksa `main[data-shapes]` (rotadan) → yoksa `main[data-scene]`.

**Bölüm işaretleri:** aynı beyaz bölümde (`.sheet`) `[data-shape-at="kimlik"]` taşıyan bölüm ekranın ortasına geldikçe şekil sırayla o şekle döner. Dönüşüm zamana yayılır (hızlı kaydırmada bile ≈1 sn). Örnek: hizmet sayfasında *Süreç* → `akis`, komşu hizmetler → alanın şekli; sektör sayfasında *İlgili hizmetler* → `petek`, *SSS* → `soru`, *Diğer sektörler* → `matris`.

**Üzerine gelme:** `[data-shape-hover="kimlik"]` taşıyan satır/kartın üzerine fareyle gelince (ya da klavyeyle odaklanınca) şekil geçici olarak o şekle döner. Satırdan satıra geçince şekil ekrandaki hâlinden **doğrudan** yeni satırın şekline döner (0,7 sn); araya sayfanın ya da önceki satırın şekli girmez. Dönüşüm sürerken başka satıra geçilirse ara hâl dondurulur ve oradan yeni şekle gidilir (`world/ink.js › pose`). İmleç liste bölgesinde (satırların en yakın ortak atası: satır araları, grup başlıkları) kaldıkça son şekil kalır; bölgeden çıkınca sayfanın şekline döner. Dokunmatik ekranda devre dışıdır. Test: `tests/figure-hover.e2e.mjs` (her çizilen kare `fig.__ink` izinden denetlenir).

**Katmanlar:** Tam = canlı, 60 fps, küçük fare lensi · Hafif = canlı, 30 fps, daha az nokta · Kapalı (ve `prefers-reduced-motion`) = hareketsiz tek kare, dönüşüm anlık. Görünmeyen kutu çizilmez; yazdırmada ve yüksek karşıtlık tercihinde gizlenir; JS yoksa görünmez.

> Not: form alanlarının sınıfı `.field`'dır (form-kit). Şekil bileşeni bilerek `.fig` adını taşır; bu iki adı karıştırmayın.

## Sayfa → şekil eşlemesi

Tek kaynak: `scripts/scenes.mjs`.

- `AREA_SHAPE` — 8 hizmet alanı (ana sayfadaki alan şekilleri; kayıtta 1…8 sırasıyla ardışık olmalı)
- `SERVICE_SHAPE` — 60 hizmet (her satırın yanında gerekçesi yazılıdır)
- `SECTOR_SHAPE` — 10 sektör / müşteri segmenti
- `CALC_SHAPE`, `CALC_GROUP_SHAPE` — 11 hesaplayıcı ve grupları
- `FAQ_SHAPE`, `ABOUT_SHAPE` — SSS başlıkları ve Hakkımızda bölümleri
- `PAGE` — sayfa türleri (`{ scene, fig }`)

Rotalar `scene` (kahraman sahnesi) ve `fig` (şekil kutusunun varsayılan dizisi) alanlarını **kimlikle** verir; `routes.mjs › add` bunları doğrular. Bilinmeyen kimlik ya da şekli tanımlanmamış yeni bir hizmet/sektör/hesaplayıcı **derlemeyi durdurur** (sessizce boş sayfa üretilmez).

Wagtail karşılığı: `Page.scene` ve `Page.fig` (formasyon seçici, kimliğe göre); `ServicePage.shape`, `SectorPage.shape`, `CalculatorPage.shape`. Bölüm işaretleri şablondadır; veri gerekmez.

**Koyu bantlar** (sayfa içindeki `sec--dark` bölümleri) sahneyi şablonda kimlikle seçer: `data-world="{{ 'matris' | scene }}"` (`scene` süzgeci = `scenes.mjs › sceneOf`; bilinmeyen kimlik derlemeyi durdurur). Sabit sıra numarası yazılmaz (yalnızca `ufuk` için `0`); Ekim 2026'da kalan sayılar da kimliğe çevrildi.
Kural: sık metin/sayı ızgarası taşıyan bantta şekil yazının arkasına düşmemeli; o zaman sakin `ufuk` arazisi kullanılır (Bilgi Merkezi «Koleksiyonlar», Sektörler «İlgi matrisi»). Ana sayfa «Sektörler» bandı `matris`tir (önceden `katman` idi; «Sistemler» alanıyla aynı şekil tekrarlanıyordu).

**Ana sayfa «Sektörler» bandında üzerine gelme (20 Ekim 2026, müşteri: «Sektörlerde tek bir 3B şekil var; öbür sayfalarda olduğu gibi mouse ile üzerine geldiğinde o sektörün şekli olması gerekiyor»):** listedeki her satır sektörün şeklini taşır (`data-world-shape="{{ s.shape | scene }}"`; şekil `scenes.mjs › SECTOR_SHAPE` — sektör sayfasının kahramanındaki şekil). Satırın üzerine gelince (ya da klavyeyle odaklanınca) bant `data-world-force` ile hedefi o şekle çevirir ve `scroll.refresh()` yönetmeni kaydırma beklemeden çalıştırır (`behaviors.js › sectors`); dönüşüm, kaydırmadaki gibi ekrandaki hâlden doğrudan yeni şekle akar. Satırdan satıra geçişte şekil imleç satırda 120 ms kalınca değişir (hızlı geçişte aradakiler görünmez); listeden çıkınca 220 ms sonra matrise döner; dokunmatikte şekil değişmez (yalnızca tanım yazısı), «Kapalı» katmanda dünya yoktur. Yerleşim: şekiller solda (`data-world-side="-1"`), sol üstteki tanım yazısının altında — `formations.js › SECTOR_LEFT` (`lx` 1,64 sol kaydırma kazancı, `ls` 1,28 uzaklık çarpanı, `ll` −0,14 ek aşağı kayma; `ll` yalnızca iki sütunda, `world.js › pose`), sektör sayfasındaki sağ yerleşimleri değişmez. Bant bağlama `data-world-anchor="band"` (> 900 px): şekil bandın görünen kısmının değil kendi ortasının hizasında durur, kaydırırken yazıyla birlikte kayar; soldaki yerleşimde kaydırma payı kameranın gerçek uzaklığıyla hesaplanır (`pose` › `dist`). Ölçüm: `tests/sectors-hover.e2e.mjs`.

**Ana sayfa «Hizmet alanları» bandında üzerine gelme (21 Ekim 2026, müşteri: «mouse ile hizmetin üzerine gelindiğinde de şekil değişmeli; hem scroll ile hem mouse ile»):** sabit sahnede imleç bir alanın satırında 120 ms kalınca bant `data-world-force` ile hedefi o alanın şekline (1…8) çevirir; seçili (açık) alan değişmez. Listeden çıkınca 220 ms sonra, imleç listedeyken kaydırma seçili alanı değiştirince hemen şekil kaydırmayı izler (gerçek imleç hareketiyle önizleme yeniden başlar). Tıklamayla başlayan kaydırmada hedef tıklanan alan (1,2 sn). Ayrıntı: `behaviors.js › areas`; ölçüm `tests/areas-hover.e2e.mjs`.

## Kayıt defteri

`src/assets/js/world/formations.js › FORMATIONS`. Şablonlar sahneyi **kimlikle** seçer (`data-world="{{ 'diyalog' | scene }}"`; sayı yazılmaz — Ekim 2026'da sıra değişti). Tek sıra kuralı: ana sayfa «Hizmet alanları» sahnesi `data-world-range="1,8"` iki komşu şekil arasında geçiş yaptığından **alan şekilleri 1…8 numarada, ana sayfa alan sırasıyla ardışık** durur (`tests/formations.test.mjs` denetler). Diğer yeni şekiller sona eklenir. Ekim 2026 sekiz alanlı yapı: `rakamlar` (Vergi), `tesvik`, `hukuk` eklendi; `agac` ve `sutunlar` (okul binası) yeniden çizildi; `halka` alan şekli olmaktan çıktı (bordro hizmetlerinde kullanılır). Aynı ay Hukuk ve Teşvik hizmetlerine kendi şekilleri verildi (`shapes-legal.js`: sözleşme, sicil gazetesi, arabuluculuk masası, uzlaşma/dava yolu, KVKK envanteri, icra takibi, şirket kuruluşu; teşvik belgesi, iş planı, Ar-Ge ampulü, AB hibesi, istihdam, ihracat). Yazılı şekillerde harfler `draw.js › GLYPHS` çizgi harfleridir (Türkçe harfler, €, /, : dahil); harf titreşimi boyla orantılıdır. Ekim 2026 sonu (müşteri geri bildirimi): Dijital Dönüşüm alanı yeni `dijital` şeklini aldı (`katman` alan dizisinden çıktı, `halka`dan sonraya taşındı); `agac` eski çizgi dallı biçimine döndü; `defter` üst sayfasına okunur mizan rakamları eklendi. `view.zoom` (2B mürekkep kutusunda şekle özgü küçültme) artık `ink.js` tarafından uygulanır.

| # | Kimlik | Açıklama (`figure`; yalnızca veride — Ekim 2026'dan beri ekranda «Şekil NN · …» alt yazısı gösterilmez, müşteri isteği) |
| --- | --- | --- |
| 0 | `ufuk` | Ufuk — veri arazisi (ana sayfa açılışı) |
| 1 | `rakamlar` | Beyan rakamları — matrah, oran ve hesaplanan vergi (Vergi; KDV beyannamesi üzerinde matrah × oran = vergi, ₺ ve oranlar — `draw.js › text` rakam glifleri) |
| 2 | `ornekleme` | Denetim dosyası — finansal tablo, büyüteç ve denetçi tikleri (örneklenen satırlar mavi · kırmızı · yeşil tikle işaretli, merceğin içinde büyür; altta rapor çubukları). Kimlik tarihsel: 2026-10-05'e kadar 3B örnekleme kafesiydi |
| 3 | `defter` | Defter ve beyan yaprakları — üstteki sayfada mizan: hesap kodları (100 · 120 · 320), borç/alacak tutarları ve eşit toplam (24.450). Yelpaze gibi açılmış yapraklar; üsttekinin altında kalan kenarlar çizilmez — `draw.js › lineVis`. Rakamlar nokta bulutunda okunacak boyda (Ekim 2026, müşteri isteği: «sayılar olacaktı, kâğıt yapısı devam edecekti») |
| 4 | `agac` | Karar ağacı — kurumsal finansman; çizgi dallı ağaç: kökler, gövde, üçerli/ikişerli çatallanan dallar, çatallarda renkli karar düğümleri, uçlarda ışık kümeleri. Ekim 2026: yuvarlak taçlı sürüm beğenilmedi; eski çizgi biçimine dönüldü, daha büyük ve daha çok dallı. 2B kutuda `view.zoom: 0.85` (seyrek taç uçları kutudan taşmasın) |
| 5 | `tesvik` | Destek basamakları — teşvik, hibe ve yatırım |
| 6 | `hukuk` | Hukuki çerçeve — kanun maddesi ve karar |
| 7 | `dijital` | Dijital dönüşüm — solda kâğıt fatura («FATURA», ₺ 12.500), ekrana yukarı doğru akan 0/1 şeritleri, ekranda aynı tutarla «E-FATURA», rapor çubukları ve onay işareti; üstte eşitleme bulutu (e-arşiv). Ekim 2026; önceki alan şekli `katman` (çubuk şehri) anlaşılmadı |
| 8 | `sutunlar` | Akademi — antik okul binası: sütunlar, kiriş ve alınlık (Akademi; sütunlar tek bir antik okul binasında birleşir — Ekim 2026) |
| 9 | `diyalog` | Diyalog — iki kabarık konuşma balonu: önde sizin mesajınız (üç nokta: mavi · kırmızı · yeşil), arkada yanıtımız (üç satır); kapanış çağrı bandı («Size nasıl yardımcı olabiliriz?»; 20 Ekim 2026'ya dek «Görüşelim») (`shapes-cta.js`; 20 Ekim 2026'ya kadar `kapi`: kemer ve ona uzanan yol) |
| 10 | `halka` | Yıl halkası — on iki aylık bordro döngüsü |
| 11 | `katman` | Veri katmanları — sistem ve raporlama (Ekim 2026'dan beri alan şekli değil; «Muhasebe Sistemleri» hizmetinde) |
| 12 | `kasa` | Finansal Hizmetler — çarklı kasa kapısı ve yükselen para kuleleri (`shapes-sector.js`; 20 Ekim 2026'ya kadar `kayip`, kayıp dağılımı) |
| 13 | `fabrika` | Üretim ve Sanayi — testere dişi çatılı fabrika, bacalar ve dişli çark (önce `maliyet`, maliyet akışı) |
| 14 | `enerji` | Enerji ve Doğal Kaynaklar — rüzgâr türbinleri ve güneş panelleri (önce `varlik`, varlık ömrü) |
| 15 | `sube` | Şube ağı — merkez kayda bağlanan çok noktalı yapı (Yurt dışına işçi gönderimi; 20 Ekim 2026'ya kadar Perakende'nin de şekli; `shapes-service.js`) |
| 16 | `kule` | Teknoloji, Medya ve Telekomünikasyon — iletişim kulesi, sinyal halkaları ve akıllı telefon (önce `edim`, edimler) |
| 17 | `ilac` | Sağlık ve İlaç — ilaç şişesi, kapsüller, tabletler ve kalp ritmi (önce `alacak`, alacak akışı) |
| 18 | `hakedis` | Hakediş eğrisi — yıllara yaygın işte ilerleme (Asgari işçilik ve ilişiksizlik belgesi; 20 Ekim 2026'ya kadar İnşaat'ın da şekli; `shapes-service.js`) |
| 19 | `otel` | Turizm, Ulaştırma ve Lojistik — deniz kıyısında otel, palmiyeler, güneş ve dalgalar (önce `sezon`, sezon eğrisi) |
| 20 | `aile` | Aile Şirketleri ve KOBİ'ler — üç kuşak aile (bastonlu büyük, ebeveyn, çocuk) ve küçük işletme binası (önce `uc-halka`, üç halka) |
| 21 | `savunma` | Üç savunma hattı — yönetim, risk ve uyum, iç denetim (İç denetim; 20 Ekim 2026'ya kadar Kamu'nun da şekli; `shapes-service.js`) |
| 22 | `terazi` | Terazi — bağımsızlık ve denge |
| 23 | `bilanco` | Bilanço — aktif ile pasifin dengesi |
| 24 | `muhur` | Mühür — tasdik ve onaylı belge |
| 25 | `mutabakat` | Mutabakat — karşılıklı kayıtların eşleşmesi |
| 26 | `dilimler` | Dilimler — kademeli oran ve hesap |
| 27 | `kdv-zinciri` | KDV zinciri — yüklenilen ve hesaplanan vergi |
| 28 | `nakit` | Akış şelalesi — başlangıçtan kapanışa kalem kalem değişim |
| 29 | `rasyo` | Rasyo radarı — finansal oranların dengesi |
| 30 | `hile` | Hile üçgeni — baskı, fırsat, gerekçelendirme |
| 31 | `kup` | Veri küpü — boyutlara göre dilimlenen veri |
| 32 | `akis` | Süreç akışı — adım, karar ve kontrol noktası |
| 33 | `pay` | Pay dağılımı — ortaklık ve sermaye yapısı |
| 34 | `petek` | Hizmet alanları — sekiz alan, altmış hizmet başlığı |
| 35 | `matris` | Sektör ve hizmet alanı — her sektörde öne çıkan hizmetler |
| 36 | `ag` | Uzmanlık ağı — kişiler ve çalıştıkları alanlar |
| 37 | `yayin` | Yayınlar — sirküler, duyuru, blog ve haber |
| 38 | `kitap` | Okuma notları — kitaplardan alınan notlar |
| 39 | `abakus` | Abaküs — kalem kalem hesap |
| 40 | `takvim` | Takvim — aylara yayılan beyan ve ödeme günleri |
| 41 | `basvuru` | Başvuru yolu — adım adım daralan kapılar |
| 42 | `yonlendirme` | Yönlendirme — mesajınız konuya göre ilgili alana ulaşır |
| 43 | `arama` | Arama — sitedeki sayfalar arasında eşleşenler |
| 44 | `arsiv` | Arşiv — yıllara göre sirküler dosyaları |
| 45 | `sozluk` | Sözlük — birbirine bağlı terimler |
| 46 | `gizlilik` | Gizlilik — kişisel verinin korunması |
| 47 | `sure` | Hizmet süreleri — yıllara yayılan çalışma ve sigortalılık dönemleri |
| 48 | `soru` | Sorular — başlıklara göre toplanan sorular ve yanıtlar |
| 49 | `yazit` | Yazıt — Orhun Abideleri tarzında dikili taşlar |
| 50 | `sozlesme` | Sözleşme — maddeler, imzalar ve kalem (`shapes-legal.js`; Ekim 2026) |
| 51 | `sicil` | Ticaret sicili — gazete ilanı ve tescil mührü (`shapes-legal.js`; Ekim 2026) |
| 52 | `arabulucu` | Arabuluculuk masası — taraflar, arabulucu ve iş kanunları (`shapes-legal.js`; Ekim 2026) |
| 53 | `uyusmazlik` | Vergi uyuşmazlığı — ihbarnameden uzlaşma ya da dava yoluna (`shapes-legal.js`; Ekim 2026) |
| 54 | `kvkk` | KVKK uyumu — veri envanteri ve koruma kalkanı (`shapes-legal.js`; Ekim 2026) |
| 55 | `icra` | Alacak takibi — vadesi geçen fatura, ihtar, arabuluculuk, icra ve tahsil (`shapes-legal.js`; Ekim 2026) |
| 56 | `kurulus` | Şirket kuruluşu — temel, katlar ve yerine inen «A.Ş.» (`shapes-legal.js`; Ekim 2026) |
| 57 | `belge` | Yatırım teşvik belgesi — belge, mühür ve fabrika (`shapes-legal.js`; Ekim 2026) |
| 58 | `proje` | Proje iş planı — iş paketleri, takvim ve kilometre taşları (`shapes-legal.js`; Ekim 2026) |
| 59 | `arge` | Ar-Ge — fikir ampulü ve dişli (`shapes-legal.js`; Ekim 2026) |
| 60 | `hibe` | AB hibesi — on iki yıldız, avro ve başvuru dosyası (`shapes-legal.js`; Ekim 2026) |
| 61 | `istihdam` | İstihdam teşviki — yeni koltuklar ve prim desteği (`shapes-legal.js`; Ekim 2026) |
| 62 | `ihracat` | İhracat — dünya, rota ve konteyner (`shapes-legal.js`; Ekim 2026) |
| 63 | `tasdik` | Tasdik — «TASDİK» başlıklı rapor, kırmızı mühür izi ve yeşil onay; solunda saplı kaşe (`shapes-vergi.js`; 16 Ekim 2026) |
| 64 | `kdv-iade` | KDV iadesi — dik duran ₺ madeni para, çevresinde geri dönen yeşil ok, altta «KDV» (`shapes-vergi.js`) |
| 65 | `kurumlar` | Kurumlar vergisi denetimi — şirket binası ve önünde merceğinde onay olan büyüteç (`shapes-vergi.js`) |
| 66 | `transfer` | Transfer fiyatlandırması — iki grup şirketi, aralarında iki yönlü ok ve ₺ fiyat etiketi (`shapes-vergi.js`) |
| 67 | `dolayli` | Dolaylı vergiler — alışveriş arabası (ürünlerle) ve % etiketi: vergi fiyatın içinde (`shapes-vergi.js`) |
| 68 | `otv` | ÖTV — otomobil ve «ÖTV» levhalı akaryakıt pompası, tabanca aracın deposunda (`shapes-vergi.js`) |
| 69 | `bireysel` | Bireysel vergi — kişi (kravatlı büst), evi ve madeni para yığını (`shapes-vergi.js`) |
| 70 | `magaza` | Perakende, Tüketici ve Gıda — çizgili tenteli mağaza vitrini ve alışveriş poşetleri (`shapes-sector.js`; 20 Ekim 2026) |
| 71 | `vinc` | İnşaat, Gayrimenkul ve Altyapı — kule vinç, yükselen bina iskeleti ve bitmiş binalar (`shapes-sector.js`) |
| 72 | `kamu` | Kamu İştirakleri ve Sivil Toplum — kubbeli, sütunlu kamu binası ve el ele tutuşan insanlar (`shapes-sector.js`) |

**Vergi hizmetleri (16 Ekim 2026, müşteri geri bildirimi «buradaki 3B şekiller çok mantıksız; buraya uygun, daha belirgin, net görünen şekiller»):** Vergi alanının yedi hizmeti önceden soyut çizelgeler taşıyordu (KDV zinciri basamakları, dilim çubukları, pasta dilimi, bilanço rafları, araba tekerleği gibi okunan mühür halkası) ve iki çift aynı şekli paylaşıyordu (KDV İade ile Dolaylı Vergiler `kdv-zinciri`; ÖTV ile Bireysel `dilimler`). Artık her hizmet bir bakışta tanınan tek nesne gösterir (63–69). Okunurluk kuralları (`shapes-vergi.js` başı): dış hat yoğun ve iri noktalı, iç ayrıntı seyrek; nesne kameraya dönük (salınım, tam tur yok); yalnızca birkaç iri harf/simge (TASDİK, KDV, ÖTV, ₺, %); renk parçaları ayırır (lacivert gövde, mavi ayrıntı, kırmızı vergi/fiyat, yeşil onay/iade). Kişi ve kaşe topuzu gibi yuvarlak hacimler tel çerçeve değil, yüzeyde noktalar + çevre çizgisiyle çizilir (`ball`; tel küre «kafes» gibi görünüyordu). Kompozisyon kuralı: uzun parça sağda (rapor, bina, merkez şirket) — kahramanda soldaki sayfa yolu ve başlık sütunu boş kalır. Eski şekiller (`muhur`, `kdv-zinciri`, `dilimler`, `bilanco`, `pay`) kayıtta durur; hesaplayıcılar ve diğer alanlar kullanmaya devam eder. `tests/formations.test.mjs` Vergi hizmetlerinin şekil paylaşmadığını ve eski şekillere dönmediğini, `tests/hero-overlap.e2e.mjs` şekillerin kahraman yazısına binmediğini (11 ekran, 1920×1080 … 667×375) ve dikey telefonda kırpılmadığını denetler.

**Sektörler (20 Ekim 2026, müşteri geri bildirimi «yaptığın şekiller çok alakasız; turizm için deniz, otel tarzı, palmiye ağaçları; inşaata binalar — şekiller doğrudan bağlantılı olmalı»; nesne listesini proje sahibi onayladı):** sektör şekilleri önceden her sektörün ilk muhasebe konusundan çiziliyordu (beklenen kredi zararı dağılımı, maliyet akışı, amortisman, şube ağı, gelir dilimleri, alacak akışı, hakediş eğrisi, sezon eğrisi, üç halka modeli, üç savunma hattı) — sektörü tanımayan biri için soyut kalıyordu. Şimdi her sektöre herkesin bir bakışta tanıdığı nesneler (`shapes-sector.js`; Vergi şekilleriyle aynı okunurluk ilkeleri — yoğun dış hat, seyrek iç ayrıntı, kameraya dönük salınım, yazı yok, renk parçaları ayırır): kasa kapısı ve para kuleleri, fabrika ve dişli, rüzgâr türbinleri ve güneş panelleri, tenteli mağaza ve alışveriş poşetleri, iletişim kulesi ve akıllı telefon, ilaç şişesi, kapsüller ve kalp ritmi, kule vinç ve binalar, deniz kıyısında otel ve palmiyeler, üç kuşak aile ve işletme binası, kubbeli kamu binası ve el ele insanlar. Her şekil iki nesneyi yan yana taşır; genişlik ±5,3 birime sığdırılır (`fitX`, zemine göre orantılı küçültme): daha genişi dikey telefonda yanlardan kırpılıyor, yan çevrilmiş telefonda başlık sütununa giriyordu. Sıra: sektöre özgü yedi eski şeklin yuvası yerinde değiştirildi; hizmetlerin de kullandığı `sube`, `hakedis`, `savunma` yerinde kaldı (`shapes-service.js`'e taşındı), Perakende, İnşaat ve Kamu'nun yeni şekilleri sonda (70–72). Kahraman başlık sütunu verisi: `node scripts/scene-reach.mjs`. Ölçüm: `tests/hero-overlap.e2e.mjs --set=sektorler`, `tests/sectors-hover.e2e.mjs` (`npm run test:sectors`), `tests/formations.test.mjs`.

**Kapanış çağrı bandı (20 Ekim 2026, müşteri geri bildirimi «Görüşelim kısmını beğenmediler, daha uygun 3B şekil»):** tüm sayfaların sonundaki kapanış çağrı bandında (başlığı o gün «Görüşelim» idi, aynı gün kurumsal «Size nasıl yardımcı olabiliriz?» oldu) kemer ve ona uzanan yol (`kapi`) soyut kalıyordu (dikey telefonda yolun çizgileri düğmenin altında çizik gibi duruyordu). Yerine bandın kendi metninden («Size nasıl yardımcı olabiliriz?» … «ilk görüşmede nasıl ilerleyeceğimizi belirleyelim») gelen tek nesne: **iki konuşma balonu** (`diyalog`, `shapes-cta.js`; kayıtta aynı sıra, 9). Önde solda sizin balonunuz (beyaz, kuyruğu sola): üç nokta — «yazıyor» — Boraden'in mavi · kırmızı · yeşil renkleri; arkada sağda yanıt balonu (mavi, kuyruğu sağa): üç satır. Balonlar **kabarıktır** (yastık gibi): yüz seyrek noktalı levha, kenar yarım daire kesitli yuvarlak bordür, dışta yoğun siluet — tel çerçeve değil, hacim olarak okunur (`ball` ile aynı yaklaşım). Kuyruk sivri değil, uca doğru incelen kalın eğri ve yuvarlak uç (sivri uçta bordür üst üste biniyordu); kuyruk ile gövde arasındaki dar oyukta iki yanın bordürünün kesiştiği kısım çizilmez; öndeki balonun arkasında kalan kısım çizilmez. Salınım sakin (`sway: 0.25`; balonlar önden okunur), şekil %92 ölçekte (dikey telefonda kenarlardan taşmaz). Yan çevrilmiş telefonda bant artık bütünüyle koyulaşmaz, yalnızca yazı tarafı (şekil sönük görünüyordu) ve yazı sütunu 50vw (`30-layout.css`). İletişim sayfasının sonundaki «Bilgi merkezi ve araçlar» bandı (sağ yarıda liste ve sayılar) kemeri paylaşıyordu, kemer liste satırlarının üstüne biniyordu: o bant artık sakin `ufuk` arazisini kullanır (yukarıdaki «Koyu bantlar» kuralı). Test: `tests/cta-overlap.e2e.mjs` (yeni). Taslakta denenip seçilmeyen iki şekil (açık zarf ve içinden yükselen mektup — «Bize yazın»; ilk görüşme masası: «GÜNDEM / İHTİYAÇ ✓ · KAPSAM ✓ · PLAN» not defteri, kalem ve ince belli çay bardağı) kayda eklenmedi.

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

- `tests/formations.test.mjs` — kayıttaki her şekil üretilebilir, sonlu, sahne ölçüsünde (içerik şekilleri |x| ≤ 7,5, |y| ≤ 5,5, |z| ≤ 6) ve aynı tohumla tekrarlanabilir; kimlikler tekil, ilk 8 ana sayfa sahnesi yerinde; `scenes.mjs` eşlemeleri yalnızca var olan şekillere gider; Hakkımızda terazi değil yazıt
- `tests/world-contact-pose.test.mjs` — kahraman kamerası/dönüşü (gerçek three.js izdüşümü): kapanış bandının balonları salınır, sınırlı kalır, yana çökmez
- `tests/cta-overlap.e2e.mjs` — kapanış çağrı bandı: balonların noktaları bandın yazısına (üst etiket, başlık, öz, düğmeler, iletişim satırları) düşmez — 6 sayfa (kısa ve uzun başlıklar) × 11 iki sütunlu ekran × 3 kaydırma konumu, ≤ %0,2; 5 dikey ekranda kırpılma ≤ %2
- `tests/services.test.mjs` — hizmet ve alan sayfalarında «Çalışma biçimimiz» bandının alan sahnesi
- `tests/hero-overlap.e2e.mjs` — Vergi hizmet sayfalarında 3B şeklin noktaları dünyanın kendi kamerasıyla izdüşürülür: iki sütunlu düzende (1920×1080 … 667×375) sayfa yolu, üst etiket, başlık ve öze düşen nokta ≤ %0,2; dar düzende (dikey telefon/tablet) ekran dışında kalan ≤ %2
- `tests/figure-hover.e2e.mjs` — şekil kutusunda üzerine gelme: yalnızca gelinen satırın şekli, araya sayfanın/önceki satırın şekli girmez
- `tests/hero-overlap.e2e.mjs --set=sektorler` (`npm run test:sectors`; `test:e2e` zincirinde `--set=hepsi`) — on sektör sayfasının kahramanı: şekil başlık sütununa binmez (iki sütun ve yatay ≤ %0,2), dikey telefonda kırpılmaz (≤ %2)
- `tests/sectors-hover.e2e.mjs` (`npm run test:sectors`) — ana sayfa Sektörler bandı: matris ve 8 sektörün şekli solda bandın yazısına (tanım, başlık, liste, «Tüm sektörler») düşmez — 12 ekran (iki sütun ve yatay) × 4 kaydırma konumu × salınım uçları, ≤ %0,2; fareyle üzerine gelince o sektörün şekli (kaydırmadan), hızlı geçiş, listeden çıkış, klavye, dokunma, «Kapalı» katman
- `npm run test:e2e` — gezinme, kahraman, metin büyütme, efekt katmanları
