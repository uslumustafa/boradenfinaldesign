# Vergi hesaplayıcıları ve vergi takvimi / Tax calculators and tax calendar

Parametrelerin doğrulandığı tarih: **2026-10-01**. Kaynak veri: `docs/research/other-params-2026.json`.

| Dosya | İçerik |
|---|---|
| `src/calc/engines/tax.mjs` | Beş motor: `vat`, `corpTax`, `provisionalTax`, `smm`, `lateFee`. Saf fonksiyonlardır; oran, limit ve tatil verisi yalnızca params'tan okunur. |
| `src/data/params/2026-vergi.json` | Oranlar, tarih aralıkları, tatil listesi ve uyarı metinleri. Yıllık güncellenen dosya. |
| `src/data/calculators-vergi.json` | Beş hesaplayıcının tanımı: form, açıklama, varsayımlar, SSS, kaynaklar. |
| `src/data/calendar.json` | Vergi takvimi, 01.10.2026 – 31.03.2027, 27 kalem. |
| `tests/calc-vergi.test.mjs` | 78 test: araştırma vektörleri, özellik testleri, takvim ve tanım denetimleri. |

Testi proje kökünden çalıştırın: `node --test tests/calc-vergi.test.mjs` (Node 22). `node --test tests/` kullanmayın.

## 1. Uygulanan kurallar / Rules implemented

Ortak: tutarlar kuruşa **yarım yukarı** yuvarlanır. Oranlar params'ta kesirdir (0,20 = %20). Tarih-etkili kayıtlarda `from` ve `to` günleri dahildir; motor girdi tarihine uyan kaydı seçer. "Bugün" motora girdiyle gelir; tarih verilmezse params `meta.verifiedOn` kullanılır. `needsVerification` işaretli bir kayıt kullanılırsa kaydın `warn` metni sonuçta uyarı olarak çıkar.

**KDV (`vat`, kdv-hesaplama).**
- `haric`: KDV = matrah × oran; dahil = matrah + KDV. `dahil`: matrah = dahil ÷ (1 + oran); KDV = dahil − matrah, böylece parçalar tutarla birebir toplanır. `kdv`: matrah = KDV ÷ oran (oran %0 ise hata).
- Oran, seçilen oran türünün işlem tarihindeki kaydıdır. 10.07.2023 öncesi için eski oranlar (%18, %8) yalnızca bilgi olarak tanımlıdır ve uyarı verir.
- İsteğe bağlı kısmi tevkifat yalnızca **9/10**: tevkif edilen KDV = KDV × 9/10; satıcıya ödenecek = matrah + KDV − tevkif. Alıcı listesi ve tutar sınırı denetlenmez (uyarı verilir).

**Kurumlar vergisi (`corpTax`, kurumlar-vergisi-hesaplama).**
- Mali kâr = ticari kâr + KKEG − istisna ve indirimler. İndirilen geçmiş yıl zararı = min(girilen zarar, pozitif mali kâr). Matrah = mali kâr − indirilen zarar (en az 0). Vergi = matrah × oran. Ödenecek = vergi − mahsup edilen geçici vergi; sonuç negatifse "mahsup edilemeyen geçici vergi" gösterilir.
- Oran sınıfları: genel %25, finans %30, imalat %24, ihracat %20, halka arz %23 (01.01.2025'ten itibaren); üretim kazancı %12,5 yalnızca 01.01.2027 ve sonrası (daha önceki dönem için hata). Desteklenen dönem 01.01.2025 ve sonrasıdır. İndirimli sınıflar için kazanç paylaştırması **yapılmaz** (uyarı).
- İsteğe bağlı yurt içi asgari kurumlar vergisi (KVK m.32/C): asgari vergi = kullanıcının girdiği matrah × %10; hesaplanan vergi = normal hesap ile asgari verginin büyüğü. Matrahın içeriğini araç denetlemez (uyarı).

**Geçici vergi (`provisionalTax`, gecici-vergi-hesaplama).**
- Kümülatif matrah = kümülatif dönem kârı (zararsa 0). Hesaplanan vergi = matrah × oran. Bu dönemde ödenecek = hesaplanan − önceki dönemlerde ödenen (en az 0); fark negatifse not düşülür.
- Oran: kurumlarda seçilen sınıfın dönem sonunda geçerli oranı (`uretim` hariç); gelir vergisi mükelleflerinde `provisional.gelirRates` (%15). Gelir vergisi tarifesi hesaplanmaz; araç Gelir Vergisi Hesaplama'ya yönlendirir.
- Son gün: dönemi izleyen 2. ayın 17'si (17 Mayıs, 17 Ağustos, 17 Kasım, izleyen yıl 17 Şubat); hafta sonu veya tam gün tatilde izleyen ilk iş günü. Sonuç tablosu seçilen yılın dört dönemini gösterir. 4. dönem `needsVerification` taşır.

**Serbest meslek makbuzu (`smm`, serbest-meslek-makbuzu-hesaplama).**
- Stopaj = brüt × stopaj oranı; KDV = brüt × KDV oranı; tevkif = KDV × pay; net = brüt − stopaj; **tahsil edilecek = brüt − stopaj + KDV − tevkif**. Stopaj seçenekleri %20 (GVK m.94/2-b), %17 (GVK m.18 kapsamı doğrulanmadı, uyarı) ve %0.
- Tersine hesap: net ücretten brüt ≈ net ÷ (1 − s); tahsilattan brüt ≈ tahsilat ÷ (1 − s + k × (1 − t)); ardından ±5 kuruş içinde ileri hesabı girilen tutarla birebir tutan brüt aranır. Birebir eşleşme yoksa en yakın sonuç ve fark notta gösterilir. KDV dahil tutardan brüt = tutar ÷ (1 + k).

**Gecikme zammı (`lateFee`, gecikme-zammi-hesaplama).**
- Vade ile ödeme tarihi arası tam aylara ve kalan günlere bölünür (`ymdDiff`). Her tam ay için anapara × aylık oran; kalan günler için anapara × aylık oran ÷ 30 × gün. Aylık oran, ayın başlangıç tarihine göre `lateFee.monthlyRates` tablosundan alınır (21.05.2024 – 12.11.2025 %4,5; 13.11.2025'ten itibaren %3,7).
- Tablo satırları, birikmiş toplamın kuruşa yuvarlanmış farklarıdır; satır toplamı özetteki gecikme zammına eşittir.
- Desteklenen vade: 21.05.2024 ve sonrası. Ödeme vadeden önce olamaz. Ödeme tarihi `meta.verifiedOn` tarihinden sonraysa "oran değişmiş olabilir" uyarısı çıkar.

**Takvim (`calendar.json`).** Her kalemde asıl tarih (`nominalDate`) kuraldan gelir; etkin tarih (`date`) asıl tarih hafta sonuna veya **tam gün** resmî tatile (Cumhuriyet Bayramı, Yılbaşı, Ramazan Bayramı günleri) rastlarsa izleyen ilk iş günüdür (VUK m.17). Arife yarım günleri ve idari izin kaydırmaz. Gün kuralları: KDV ayın 28'i; Muhtasar ve Prim Hizmet ile damga vergisi 26'sı; geçici vergi 17'si; SGK primi ay sonu; yıllık gelir vergisi 1–31 Mart.

## 2. Parametre tablosu / Parameter table

Güven değerleri araştırmadaki etiketlerin eşlemesidir: resmî belgeden okunan → `verified-official`; birden çok ikincil kaynakla örtüşen veya tek ikincil kaynak → `secondary`; doğrulanamayan → `assumption` (şu an yok). `needsVerification` işaretli kayıtlar sonuçta uyarı üretir. Resmî Gazete ve mevzuat.gov.tr metinleri araştırmada doğrudan okunamamıştır; ilgili satırlar GİB belgeleri ve ikincil bültenlere dayanır.

| Ad | params anahtarı | Kaynak | Güven |
|---|---|---|---|
| KDV oranları: genel %20, indirimli %10 ve %1, %0; 10.07.2023 öncesi %18 ve %8 (bilgi) | `kdv.tiers[]` | PwC, CK 7346 bülteni | secondary |
| Kısmi KDV tevkifatı 9/10 | `kdv.tevkifat[]` | GİB özelgesi, 03.02.2023 | secondary, `needsVerification` |
| Kurumlar vergisi oranları: %25, %30, %24, %20, %23 | `corpTax.classes[]` | GİB, Kurumlar Vergisinde Oran Uygulamaları (Mart 2026, Yayın 605) | verified-official |
| Üretim kazancı %12,5 (2027 ve sonrası) | `corpTax.classes[]`, `id: uretim` | PwC ve KPMG, 7582 sayılı Kanun | secondary, `needsVerification` |
| Yurt içi asgari kurumlar vergisi %10 | `corpTax.minTax` | EY, PwC, BDO/İTO | secondary, `needsVerification` |
| Geçici vergi oranı: kurumlarda KV oranı, gelir vergisi mükelleflerinde %15 | `provisional.gelirRates[]`, `corpTax.classes[].provisional` | GİB, Geçici Vergi Oranları | verified-official |
| Geçici vergi dönemleri ve 17. gün kuralı | `provisional.periods[]` | GİB, Beyanname Verme ve Ödeme Süreleri | verified-official; 4. dönem secondary, `needsVerification` |
| Stopaj %20, %17, %0 | `smm.stopaj[]` | GİB, Serbest Meslek Vergi Rehberi (Şubat 2025) | verified-official; %17 `needsVerification` |
| Gecikme zammı aylık oranı: %4,5 ve %3,7 | `lateFee.monthlyRates[]` | TBB ve KPMG duyuruları (CK 10556), CK 8484 | secondary |
| Ay kesri böleni (30) | `lateFee.daysPerMonth` | 6183 sayılı Kanun m.51; T24 yazısı | secondary |
| Tam ve yarım gün tatiller | `holidays` | Milli Gazete, CNN Türk, Dünya (Diyanet tabanlı) | secondary |

## 3. Varsayımlar ve bilinçli sadeleştirmeler / Assumptions and simplifications

1. **Kurumlar vergisi matrahı kullanıcıdan gelir.** Ticari kâr, KKEG ve istisnalar girilir; araç bunların içeriğini denetlemez. Enflasyon düzeltmesi 2025–2027 dönemlerinde yoktur (7571 sayılı Kanun m.34).
2. **İndirimli oranlarda kazanç paylaştırması yok.** İhracat, imalat ve halka arz oranları yalnızca ilgili kazanca uygulanır; karma kazançta kullanıcı matrahı ayırır. Üretim kazancı %12,5'in mevcut indirimli oranlarla ilişkisi doğrulanmamıştır.
3. **Asgari kurumlar vergisi:** matrah kullanıcıdan gelir; araç %10'u uygular. Geçici vergi dönemlerinde asgari vergi hesaplanmaz (ikincil kaynaklar hesaplandığını söylüyor; uyarı notu var).
4. **Gelir vergisi mükellefi geçici vergisi:** araştırma %15 oranını içerdiği için dahil edildi. Yıllık vergi tarifesi hesaplanmaz; hesaplayıcı Gelir Vergisi Hesaplama'ya yönlendirir.
5. **KDV:** oranı kullanıcı seçer. Yalnızca 9/10 tevkifat vardır (yapım işleri için 4/10 gibi diğer paylar araştırmada tek bir kaynakta geçtiği için eklenmedi). Tutar sınırı ve alıcı listesi uygulanmaz. KDV iadesi, ÖTV ve damga vergisi kapsam dışıdır.
6. **Gecikme zammında ay sayımı:** vade gününden başlayan takvim ayıdır; vade günü olmayan ayda ayın son günü esas alınır (31 Ocak + 1 ay = 28 Şubat). Bu nedenle ay sonuna yakın vadelerde günlük birikim bir ay içinde sabit kalabilir veya bir günde birkaç günlük zam eklenebilir (testte en çok 3 günlük sıçrama kabul edilir). Kaynaklarda tek bir ay kesri yöntemi doğrulanmamıştır.
7. **13.11.2025'i kapsayan gecikmeler:** oranın değiştiği ay, iki oranın gün esasıyla ağırlıklandırılmasıyla hesaplanır ve uyarı verilir. Araştırmada bu kural çözülmemiş bırakılmıştır (GZ-4 vektörü bilerek boş).
8. **Kapsam dışı:** gecikme faizi (VUK m.112), pişmanlık zammı (VUK m.371), tecil faizi.
9. **Serbest meslek makbuzu:** alıcının stopaj sorumlusu olup olmadığı denetlenmez; stopajsız makbuz için "Stopaj yok" seçilir. Araç belge düzenlemez.
10. **Tatil listesi** yalnızca 01.10.2026 – 31.03.2027 aralığını kapsar. Bu aralığın dışındaki son günlerde yalnızca hafta sonu kaydırması uygulanır ve uyarı çıkar (ör. 1. ve 2. geçici vergi dönemleri).
11. **Ek "gelişmiş" tarih girdisi:** KDV, makbuz, kurumlar ve geçici vergi hesaplayıcılarında, tarih-etkili oranları seçmek için varsayılanı "bugün" olan bir tarih alanı vardır.
12. Seçenek etiketleri güncel oran rakamını içerir ("%20 — genel oran"). Bir test, etiketlerin params ile uyumunu denetler; oran değişince etiketler de güncellenmelidir.

## 4. Yıllık güncelleme kontrol listesi / Annual update checklist

Kod değiştirilmez. Motor hiçbir yerde 2026'yı gömmez; site, `src/data/params/` altındaki **en son yıl** dosyasını (`<yıl>-vergi.json`) kullanır. JSON düzenlerken: UTF-8, 2 boşluk girinti, son öğeden sonra virgül yok, Türkçe karakterler olduğu gibi. Her dosya kaydedildikten sonra `node -e "JSON.parse(require('fs').readFileSync('<dosya>','utf8'))"` hatasız çalışmalıdır.

**A. Parametre dosyası (oran veya kural değiştiğinde, en geç her yıl sonu)**
1. `src/data/params/2026-vergi.json` dosyasını kopyalayıp adını `2027-vergi.json` yapın. Eski dosyayı silmeyin.
2. Yeni dosyada `meta` bölümünde `id` ("2027-vergi"), `year`, `verifiedOn` (kontrolü yaptığınız gün) ve `notes` alanlarını güncelleyin.
3. Aşağıdaki bölümleri sırayla, ilgili resmî kaynağı açarak kontrol edin. Değer değiştiyse **yeni kayıt ekleyin**: eski kayda `"to": "<son geçerli gün>"`, yeni kayda `"from": "<yürürlük günü>"` yazın (ikisi de dahildir; kayıtlar artan sırada kalır). Eski kaydı silmeyin; geçmiş tarihli hesaplar ona dayanır.
   - `kdv.tiers`: KDV oranları (Resmî Gazete, Cumhurbaşkanı Kararı). Değişiklik varsa `kdv.verifiedFrom` ve `beforeVerifiedWarn` metnini de gözden geçirin.
   - `corpTax.classes` ve `corpTax.minTax`: kurumlar vergisi ve asgari vergi oranları (GİB oran duyurusu). 2027'de `uretim` sınıfı yürürlüğe girer; doğrulanınca `needsVerification`, `warn` ve `provisional: false` alanlarını gözden geçirin.
   - `provisional.gelirRates` ve `provisional.periods`: geçici vergi oranı ve dönem son günleri (GİB tablosu).
   - `smm.stopaj`: stopaj oranları (GVK m.94).
   - `lateFee.monthlyRates`: gecikme zammı oranı. Her Cumhurbaşkanı Kararı için eski kaydı `to` ile kapatıp yenisini `from` ile ekleyin. `supportedFrom` alanını değiştirmeyin; ilk kaydın `from` değerinden önceki vadeler desteklenmez.
   - `holidays`: yeni dönemin tam gün (`fullDay`) ve yarım gün (`halfDay`) tatilleri, `coveredFrom` ve `coveredThrough`, kaynak ve güven.
4. Kaynakta doğruladığınız her kayıttan `needsVerification` ve `warn` alanlarını kaldırın; doğrulayamadıklarınızda bırakın. `source` ve `confidence` alanlarını yeni kaynağa göre güncelleyin.

**B. Hesaplayıcı metinleri: `src/data/calculators-vergi.json`**
1. Oran rakamı içeren yerleri bulun (dosyada `%` ve `01.10.2026` arayın): seçenek etiketleri ("%20 — genel oran", "%25 — genel oran", "%20 — standart stopaj"), `explain`, `assumptions`, `faq` metinleri, hızlı doldurma etiketleri ("1.000 ₺ + %20 KDV") ve gecikme zammı metinlerindeki %4,5 ve %3,7.
2. Her hesaplayıcıda `updated` alanını params `meta.verifiedOn` tarihine eşitleyin. Bu alan ile seçenek etiketlerindeki oranlar test tarafından denetlenir.
3. `sources` listesindeki bağlantıların hâlâ açıldığını kontrol edin.

**C. Vergi takvimi: `src/data/calendar.json`**
1. `meta.from`, `meta.to`, `meta.verifiedOn` ve `disclaimer` içindeki tarihi güncelleyin. Aralık, params `holidays.coveredFrom` ve `coveredThrough` içinde kalmalıdır.
2. `holidays` listesini yeni dönemin resmî tatilleriyle değiştirin (tam gün: `"kind": "official"`, arife: `"half-day"`). Liste, params `holidays` ile aynı olmalıdır.
3. `items` listesini yeni dönem için yenileyin (geçmiş kalemleri çıkarın). Her kalem için: (a) asıl tarihi `nominalDate` olarak yazın (KDV ayın 28'i; Muhtasar ve damga vergisi 26'sı; geçici vergi 17 Mayıs, Ağustos, Kasım ve Şubat; SGK primi ay sonu; yıllık gelir vergisi 1–31 Mart; kurumlar vergisi 1–30 Nisan); (b) asıl tarih hafta sonuna veya tam gün tatile denk geliyorsa `date` alanına izleyen ilk iş gününü yazın, `"shifted": true` yapın ve `shiftNote` ekleyin; denk gelmiyorsa `date` = `nominalDate`, `"shifted": false`, `shiftNote` yok; (c) kalemleri `date` değerine göre artan sıraya dizin; (d) `source` bağlantısını ve `confidence` değerini yazın (yalnızca resmî belgeden okuduysanız `verified-official`); emin değilseniz `"needsVerification": true`.
4. Önceki dönemde işaretlenmiş kalemleri (`needsVerification`) GİB sayfasından teyit edin; teyit edilenlerden işareti kaldırın.
5. Takvim kalemlerini üreten bir betik teslim edilmemiştir; takvim elle güncellenir, testler hataları yakalar.

**D. Testler (bir geliştirici çalıştırır)**
1. `node --test tests/calc-vergi.test.mjs`. Hata iletisi hangi dosyada hangi kaydın düzeltileceğini söyler (ör. "asıl tarih … kuralla … olmalı, dosyada …").
2. Araştırma vektörleri 2026 params dosyasına ve 2026 araştırma anlık görüntüsüne sabittir; hesaplayıcı tanımı ve takvim denetimleri en son params dosyasını izler. Takvim yenilenince araştırmayla karşılaştıran iki test otomatik atlanır. Test dosyasındaki `TODAY` sabiti (2026-10-01), tarih jetonlarını çözmek için kullanılır; yeni yılın params dosyası bu tarihi kapsamıyorsa güncellenmelidir.
3. Yeni yıl için hızlı doldurma örneklerinin tutarları değiştiyse "hızlı doldurma örnekleri" testi (2026 oranlarına sabit) atlanır; örneklerin geçerliliği başka bir testle denetlenmeye devam eder.

## 5. Açık doğrulama maddeleri / Open verification items (etkiye göre sıralı)

1. **Gecikme zammı oranı (%3,7):** 13.11.2025 sonrası yeni bir Cumhurbaşkanı Kararı olup olmadığı Resmî Gazete'den kontrol edilmeli. Tüm gecikme zammı sonuçlarını etkiler. Oranın değiştiği 13.11.2025'i kapsayan dönemlerde aylık ve günlük esaslı iki yöntem anlatılmaktadır; araç gün esaslı ağırlıklandırma kullanır ve uyarı verir (çözülmedi).
2. **KDV:** Cumhurbaşkanı Kararı 7346 ve sonrası oran kararları Resmî Gazete'den doğrulanmalı; 10.07.2023 öncesi %18 ve %8 oranlarının başlangıç tarihleri doğrulanmadı. Kısmi tevkifat tutar sınırı kaynaklarda 2.000 TL ve 12.000 TL olarak çelişiyor; alıcı listesi ve diğer tevkifat payları (ör. yapım işlerinde 4/10) uygulanmıyor.
3. **Yurt içi asgari kurumlar vergisi:** matrah kapsamı, 7582 değişikliği, yeni kurulan şirketler ve istisnalar doğrulanmadı; araç matrahı kullanıcıdan alır. Geçici vergi dönemlerinde hesaplanıp hesaplanmadığı da ikincil kaynaklara dayanıyor.
4. **Üretim kazancı %12,5 (2027):** 7582 sayılı Kanun madde metni, mevcut indirimli oranlarla ilişkisi ve karma kazançlarda paylaştırma kuralı doğrulanmadı. İhracat ve imalat indirimli oranlarının paylaştırma kuralları da aynı şekilde.
5. **4. geçici vergi dönemi:** kurumlar için kapsamı kaynaklar arasında çelişkili; 17 Şubat son günü GİB kuralına göredir.
6. **Takvim:** KDV Eylül 2026 son günü 28 Ekim (arife yarım günü, kaydırma yok) olarak alındı; bir kaynak 26–27 Ekim gösteriyor. e-Defter berat tarihleri (10 ve 14 Aralık 2026) TÜRMOB ifadesinden türetildi. 3 aylık Muhtasar tarihleri tek kaynaklı. Yılbaşı 2027 ve Ramazan Bayramı 2027 tatilleri Diyanet tabanlı rakamlara dayanıyor, resmî 2027 tatil kararı bekleniyor. Tüm takvim kalemleri gib.gov.tr/vergi-takvimi sayfasından teyit edilmeli (sayfa JavaScript olduğu için araştırmada okunamadı).
7. **Stopaj:** %17 seçeneğinin kapsadığı işler (GVK m.18) ve stopaj sorumlusu listesi (GVK m.94/1) incelenmedi.
8. **Kapsam dışı bırakılanlar:** gecikme faizi, pişmanlık zammı ve tecil faizinin ay kesri ve hesap kuralları doğrulanamadı.
9. **Tatil listesi** 31.03.2027 sonrasını kapsamıyor; 2027 ikinci yarısı ve sonrası için yeni liste gerekir (bkz. bölüm 4-A).
10. **Resmî Gazete/GİB teyidi (genel):** bu çalışmadaki oranların çoğu ikincil kaynaklardan ve GİB'in statik belgelerinden doğrulandı; Resmî Gazete ve mevzuat.gov.tr metinleri doğrudan okunamadı. Yayına almadan önce bölüm 2'deki `secondary` satırlar teyit edilmelidir.
