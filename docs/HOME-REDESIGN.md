# Ana sayfa v2.1 — tasarım özeti ve ayar rehberi

Güncellendi: 2026-10-02. Ana sayfa yeniden kuruldu (`src/templates/pages/home.njk`, `src/assets/css/50-home.css`). Diğer sayfalar aynı «dünya» (parçacık tuvali) ve tasarım sistemini kullanır.

## 1. Neden yeniden kuruldu

Geri bildirim: (1) ana sayfa bitmiyordu (≈15,5 ekran), (2) ilk bakışta «vay» dedirtmiyordu, (3) arka plandaki parçacık geçişi güzel ama net görünmüyordu,
(4) Deloitte benzeri kurumsal öğeler (film kahraman alanı, açılış anı) yoktu, (5) Boraden videosu/girişi yoktu.

İlkeler (araştırmadan): Deloitte/EY/PwC/KPMG ana sayfaları ≈ 6–8 ekran; masaüstünde bütçe ≤ 7–10 ekran ve ≤ 3 sabitlenen sahne; açılış ≤ 2,5 sn, atlanabilir, ziyaret başına bir kez;
tek vurgu (marka üç rengi yalnızca ince çizgi/nokta); parçacık alanı «anlatıcı» — metni bastırmaz, bölümle birlikte değişir; içerik hiçbir zaman animasyona bağımlı değildir.

Ölçüm (1440×900): ≈ 9,8 ekran (öncesi 15,5); 390×844 mobil ≈ 10,4; «Kapalı» ≈ 9,2. Sabitlenen sahne: yalnızca «Hizmet alanları» (≈ 2,1 ekran).

## 2. Bölümler (yukarıdan aşağı)

| Bölüm | id | Dünya sahnesi | Not |
|---|---|---|---|
| Açılış perdesi | `.open` | — | yalnızca ilk gelişte; bkz. §3 |
| Kahraman | `#giris` | — (zemin ofis videosu; 2026-10-16'ya dek 0 «Ufuk») | «Tam ✓ doğru ✓ zamanında ✓» (satırlar sloganın öbeklerinden; tikler §7); zemin: ofis videosu (§4) |
| Tanıtım | `#hakkimizda` | 0 | kuruluş yılı/8 alan/60 hizmet/11 araç (modelden); 4 adımlık çalışma akışı |
| Hizmet alanları | `#alanlar` | 1–8 (`data-world-range`) | tek sabit sahne; kaydırınca ya da alan başlığına tıklayınca alan seçilir (tıklama sayfaya gitmez; gitmek için «İncele»). Fareyle bir alanın üzerine gelince (ya da klavyeyle odaklanınca) 3B şekil doğrudan o alanın şekline döner — seçili alan ve satırların yeri değişmez; listeden çıkınca ya da kaydırma alanı değiştirince şekil kaydırmayı izler (21 Ekim 2026; `behaviors.js › areas`, `data-world-force`). Her alan bir şekil: beyan rakamları, denetim dosyası, defter yaprakları (üstte okunur mizan rakamları), çizgi dallı karar ağacı, destek basamakları + AB yıldızları, § ve tokmak, kâğıt faturadan ekrandaki e-faturaya (`dijital`), antik okul binası |
| Birim şeridi | `nav.units` | — (köprü: `data-world-bridge`) | sekiz alanın adlarının aktığı şerit (hover’da durur, «Kapalı»da satırlara sarılır); «Ofisimiz» filmi 2026-10-16'da kaldırıldı, video kahramana taşındı |
| Sektörler | `#sektorler` | `matris` (solda, `data-world-side="-1"`, bandın ortasına bağlı `data-world-anchor="band"`; 2026-10-05'e kadar «veri katmanları» idi — Sistemler alanıyla aynı şekil tekrarlanıyordu). Bir sektörün üzerine gelince o sektörün şekli (sektör sayfasındaki şekil; satırda `data-world-shape`) — 20 Ekim 2026; şekiller sektörü doğrudan anlatan nesneler: kasa, fabrika, rüzgâr türbini, mağaza, iletişim kulesi, ilaç, vinç, otel (`shapes-sector.js`) | 8 sektörlük liste; üzerine gelince (ya da klavyeyle odaklanınca) kısa tanım sol üstte belirir ve 3B şekil o sektörün şekline döner; listeden çıkınca matris (`behaviors.js › sectors`: satırda 120 ms kalınca değişir, çıkışta 220 ms bekler; dokunmatikte şekil değişmez) |
| Araçlar | `#araclar` | — (açık zemin) | 4 hesaplayıcı çipi + mini KDV |
| Bilgi | `#bilgi` | — | öne çıkan + son 3 yayın + arşiv satırı |
| Kariyer | `#kariyer` | — | alan çipleri → `/kariyer/?alan=…` (açık pozisyon iddiası yok) |
| Kapanış çağrısı | `#iletisim-cagri` | `diyalog` = 9 (iki kabarık konuşma balonu; 2026-10-20'ye dek «Kapı» `kapi`) | `partials/cta.njk` — tüm sayfalarda ortak |

## 3. Açılış sekansı (`opening.js`)

~2,2 sn: koyu perde üstünde kuruluş yılı 1900 → 1993 sayaçla belirir, perde ortadan dışa **piksel piksel** çözülür (nadir marka renkli hücreler), altta kahramanın video posteri ve başlık açılır (2026-10-16'ya dek burada parçacık alanı toplanırdı — `world.assemble()`; kahraman videoya geçince kaldırıldı, dünya ilk şeklini hizmet alanlarında toplar).
Logo kullanılmaz (logo yalnızca bileşende; sayfada tam 2 kez kuralı). Başlık çubuğu perdenin üstünde kalır; HUD açılışta gizlidir.

Ne zaman çalışır (karar `layouts/base.njk` içindeki erken betikte → `html.is-opening`; depolama yok):
yalnızca `/`, `#` yok, efekt «Kapalı» değil, gezinme türü `navigate`, yönlendiren yok/başka site, veri tasarrufu kapalı; otomasyon (`navigator.webdriver`) `?intro` olmadan çalıştırmaz.
Hareket azaltma → Kapalı → açılış yok. Atlama: tıklama, Esc/Enter/Boşluk, tekerlek/dokunma, «Girişi atla» düğmesi. Güvenlik ağları: ana betik 3,5 sn içinde gelmezse perde kalkar; her durumda 7 sn'de kalkar.
Elle denemek için yeni sekmede adresi yazıp açın (yönlendiren yok); site içinden (logoya tıklayarak) dönüşte yönlendiren aynı site olduğu için görünmez. Otomasyonda `/?intro` ekleyin.

## 4. Kahraman videosu (`modules/hero-film.js`) ve video varlığı

`src/assets/video/boraden-giris-v3-1080.mp4` (2,4 MB) / `boraden-giris-v3-720.mp4` (1,0 MB) — 7,67 sn (230 kare), sessiz, **döngü**: ofis alanının geçişinde, kimse görünmeden biter ve başa sarar; sonu 0,42 sn laciverde (#08132a) kararır, başı 0,35 sn lacivertten açılır — başa dönüş kesik görünmez (20 Ekim 2026, müşteri: «insan yüzü görünmesin, tam kapıdan giriş anında dursun»; aynı gün proje sahibi: «video bitince eskisi gibi başa sarıyordu, tekrar öyle»; önceden 10,6 sn, sonunda masalarda çalışanlar görünüyordu); poster `boraden-giris-poster-768/1280/1920.webp` (≈ 19 / 36 / 60 KB; videonun 0,9 sn karesi). Kurgu `scripts/tools/hero-film.py`: müşterinin Ekim 2026 çekimi (4K HEVC HLG → SDR, mobius ton eşleme), ilk 5 sn tam kare (tabela eksiksiz), 5,0 sn'den sonra sola yaslı yavaş itme (alt piksel kırpma; video 7,67 sn'de, itme ≈ 1,46×'dayken biter — `END = 229`). Renk: hafif soğuk, az doygun.
Yerleşim: masaüstünde tam genişlik zemin; koyulaşma başlık sütununu izler (`--l` = içerik sütununun sol kenarı) ve videonun en parlak karelerinde metin karşıtlığını korur. Dikey ekranda da (telefon, dikey tablet) video başlığın arkasında tam ekran zemindir (müşteri: «webdeki gibi görünmeli»): 16:9 kareden logodaki üç tikin ve çıtalı duvarın üstüne denk gelen dikey bir dilim görünür (`object-position: 31%`), koyulaşma yukarıdan aşağı artar. Kahraman ekrandan uzunsa (telefon, yan çevrilmiş telefon) yapışma alt kenarı ekrana değince başlar (`.hero › top`, `--hero-h`, `behaviors.js › stack`): metin, düğmeler ve video düğmesi beyaz sayfa binmeden görünür. Beyaz sayfa binerken zemin çok az yaklaşır ve kararır (`--hp`).
Oynatma: kendiliğinden «Tam»/«Hafif» katmanda ve veri tasarrufu kapalıyken (telefon ve tablet dahil); video alanı ekrandan çıkınca, beyaz sayfa kahramanı örtünce ve sekme gizlenince durur; sona gelince laciverde geçip başa sarar (döngü); ziyaretçi duraklattıysa kaydırma ya da katman değişimi yeniden başlatmaz; «Duraklat/Videoyu oynat» düğmesi her zaman vardır (sağ üst). Safari açılışta erken gelen play()'i reddedebilir: kısa aralıklarla yeniden denenir, olmazsa (ör. Düşük Güç Modu) ilk dokunuşta açılır. Kapalı/hareket azaltma/veri tasarrufu → yalnızca poster (video indirilmez). İlk oynatma poster karesinden başlar (`POSTER_T`). Dosya: cihaz pikseli genişliği > 1400 → 1080p, değilse 720p.
**Hukuki not:** müşteri isteği (Ekim 2026) gereği eski çalışanlar görünmez — yalnızca kadrajla (görüntüde rötuş ya da yüz değişikliği yok). 20 Ekim 2026'dan beri video çalışanların göründüğü ofis alanına girmeden biter: videoda kimsenin yüzü görünmez.

## 5. Parçacık dünyası — ayar rehberi (`src/assets/js/world/`)

- `formations.js` → `POSES[i]`: kamera `pos/look/fov/bright`. Formasyon x=0'dadır; kamera sola kayar (`x` negatif → şekil sağda). `lx` (sol yerleşimde kaydırma kazancı), `ls` (sol yerleşimde uzaklık çarpanı) ve `ll` (sol yerleşimde, iki sütunda ek yukarı kayma — görüntü yüksekliğinin oranı; eksi → aşağı) yalnızca `data-world-side="-1"` bölümlerinde etkilidir: Sektörler bandında `matris` (`lx` 1,64, `ls` 1,16) ve üzerine gelinen sektörün şekli (`SECTOR_LEFT`: `lx` 1,64, `ls` 1,28, `ll` −0,14 — tanım yazısının altında; aynı şekillerin sektör sayfasındaki sağ yerleşimi değişmez). Soldaki yerleşimde kaydırma payı kameranın gerçek uzaklığıyla hesaplanır (`world.js › pose` › `dist`; sağda tarihsel 19 birim). `data-world-anchor="band"` (> 900 px): şekil bandın görünen kısmının değil kendi ortasının hizasında, yazıyla birlikte kayar. Denetim: `npm run test:sectors`.
- `world.js` → `pose()`: `k0` = dar ekranda (en-boy < 1,6) formasyonu ortaya çeker ve soldurur; ≥ 1,6'da `k0 = en-boy × 0,5` (formasyon merkezi genişliğin ≈ %68'inde kalır). Mobil: `uBright × 0,5`.
- Shader: `uIntro` (açılışta dağınıktan toplanma), `uWave` (kahraman arazisi dalgası + alt sis), `uAspect`/`uPtr` (imleç merceği), `gl_PointSize` en az 1,9 px. Tam: 26 000 nokta (`fx.js`), Hafif: 9 000; uyarlanabilir düşürme 34 ms'de.
- Yerleşim kuralı (1440×900): sol metin sütunu ≈ 600 px'te biter → şekil 620–1360 px aralığında (merkez ≈ 985 px). Bir pozu değiştirince 1440×900, 1920×1080 ve 1280×720'de bakın:
  `node tests/shot.mjs --path=/ --scroll=#alanlar --name=home` (veya `--scroll` ile piksel değerleri).
- CSS okunurluk katmanları: `.areas::before` (sol/mobilde dikey), `.sectors::before` (sağ), `.cta::before` (yalnızca ≤ 900 px; yan çevrilmiş telefonda yalnızca yazı tarafı — şekil yanda kalır). Şekil metinle çakışırsa önce pozu, sonra bu katmanları ayarlayın.
- «Kapalı» katmanda (ve hareket azaltmada) Hizmet alanları sabit sahne olmaz: iki sütun, tüm alanlar açık (`html[data-fx='off'] .areas…`).

## 6. Doğrulama kaydı (2026-10-02)

İlk teslim turu (v2.1): 160 birim testi, form/router/hesaplayıcı e2e, 15,2 bin iç bağlantı (0 kırık), açılış sekansı senaryoları (sayaç, çözülme, 4 atlama yolu, referrer/hash/webdriver/Kapalı/hareket azaltma/mobil), 124 sayfa × 5 profil taraması. Güncel doğrulama sayıları (128 sayfa, 198 birim testi, 5 e2e betiği, 129 sayfa × 5 profil taraması) `HANDOFF.md` §1'dedir.
Görsel kontrol: 1920×1080, 1440×900, 1280×720, 1100×800, 768×1024, 390×844 (Hafif), Kapalı.

## 7. Sonradan eklenenler (ana sayfayı da etkiler)

Ana sayfa v2.1'den sonra siteye yayılan etkileşim katmanları ana sayfada da çalışır; bu belgedeki ölçüler (≈ 9,8 ekran) etkilenmedi.

- **Header:** büyütüldü; aşağı kaydırınca kendiliğinden saklanır, yukarı kaydırma / üst kenar / fare / odak ile geri gelir; üstte ince ilerleme çizgisi (`chrome.js`, `.prog`). Açılış perdesi sırasında header perdenin üstünde kalır (§3).
- **Bölüm noktaları (HUD):** ana sayfada elle işaretli `[data-chapter]` bölümlerinden (bölüm adı belirir); diğer uzun sayfalarda «Bu sayfada» menüsünden otomatik (`behaviors.js`). Beliren bölüm adı yarı saydam bir «hap» zemin üzerindedir (koyu/açık ton otomatik; içeriğin üstüne binse de okunur). «Kapalı» katmanda ve mobilde görünmez.
- **Başlıkta denetçi tikleri:** «Tam, doğru, zamanında.» başlığındaki üç renkli noktalama, denetçilerin çalışma kâğıdına attığı kontrol işaretiyle (tik) değiştirildi — logodaki üç çizginin dili; mavi → kırmızı → yeşil sırayla «çizilir» (açılışta ≈ 1–2,3 sn). Başlık satırları `site.tagline`dan (`tagline_words` süzgeci) türer; okunan metin `h1[aria-label]`; tik süstür. «Kapalı»/hareket azaltma/JS yokken tikler hazır durur. CSS: `50-home.css › .hero__title .p`; test: `tests/hero.e2e.mjs`. **Eski görünüme dönmek için:** `50-home.css` içindeki `.hero__title .p` kurallarını kaldırıp `home.njk` başlığındaki `<i class="p" …></i>` yerine noktalama yazmak yeter.
- **Sayfa geçişi «3B noktalar akar»** (`router.js › world.surge`; Kapalı'da yok). Düğmeler fareye çekilmez (mıknatıs efekti kaldırıldı); «Tam»da yalnızca imleç ucunda küçük bir fare lensi vardır (`world.js › LENS`).
- Sözleşme ve Wagtail karşılığı: `WAGTAIL_MAP.md` §7.
