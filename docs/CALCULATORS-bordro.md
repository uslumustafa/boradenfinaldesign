# Bordro, gelir vergisi ve tazminat hesaplayıcıları — teknik not

Kapsam: `maas-hesaplama`, `isveren-maliyeti-hesaplama`, `asgari-ucret-hesaplama`, `gelir-vergisi-hesaplama`, `kidem-tazminati-hesaplama`, `ihbar-tazminati-hesaplama`.
Bu not; motorların uyguladığı kuralları, parametre dosyasını, varsayımları, yıllık güncelleme adımlarını ve açık doğrulama maddelerini özetler.
(English summary: six calculators run on one engine file and one yearly parameter file; amounts are exact to the kuruş; nothing year-specific lives in code.)

## 1. Dosyalar

| Dosya | Görev |
|---|---|
| `src/calc/engines/payroll.mjs` | Altı motor: `grossNet`, `employerCost`, `minWage`, `incomeTax`, `severance`, `notice`. Yalnızca `../util.mjs` içe aktarır; yıl, oran ve limit içermez. |
| `src/data/params/2026-bordro.json` | Yıllık parametreler (oranlar, limitler, tarifeler, dönemler). Her yıl yeni bir `<yıl>-bordro.json` eklenir. |
| `src/data/calculators-bordro.json` | Altı hesaplayıcının tanımı (girdiler, açıklamalar, SSS, kaynaklar). |
| `tests/calc-bordro.test.mjs` | Testler. Çalıştırma: proje kökünde `node --test tests/calc-bordro.test.mjs` (`node --test tests/` kullanmayın). |
| `docs/research/*.json`, `payroll_check.py` | Araştırma verisi ve Python referans uygulaması (salt okunur; testler JSON'u doğrudan okur). |

## 2. Uygulanan kurallar

### 2.1 Ortak ilkeler
- **Kesin aritmetik:** tutarlar kuruş cinsinden `BigInt`, oranlar 10⁻⁸ ölçekli tamsayıdır; yuvarlama "yarım yukarı"dır (Python `Decimal` `ROUND_HALF_UP` ile aynı). Kayan nokta kayması yoktur; sonuçlar `payroll_check.py` ile kuruşu kuruşuna aynıdır.
- **Yuvarlama sırası:** SGK, işsizlik, gelir vergisi, damga vergisi ve istisna tutarlarının her biri ayrı yuvarlanır. Bir ayın gelir vergisi, *yuvarlanmamış* kümülatif vergilerin farkının yuvarlanmışıdır.
- **Parametreler:** motor her değeri `params` içinden okur. Tarih-etkili listeler (`minWage.periods`, `sgkBounds.periods`, `severance.ceilings`, teşvik seçeneklerinin `from`/`to` alanları) girdi tarihine göre seçilir; kapsam dışı tarihte en yakın dönem kullanılır ve sonuçta uyarı verilir.
- **Doğrulanmamış parametre:** `needsVerification: true` olan bölüm, kullanıldığında sonuca kendi `warning` metnini ekler. Bayrak ve uyarı kaldırılınca uyarı da kalkar (testle doğrulanır).
- **Hata:** kullanıcı girdisi sorunu `InputError` ile (`{ error, field }`) döner; başka istisna sızmaz (rastgele girdi testiyle doğrulanır).

### 2.2 `grossNet` — maaş hesaplama
Her ay için (başlangıç ayından Aralık'a):
1. SGK matrahı = brüt ücret, o aydaki prime esas kazanç alt ve üst sınırları arasına çekilmiş tutar.
2. SGK işçi payı = matrah × %14; işsizlik işçi payı = matrah × %1. Emekli (SGDP) seçilirse SGDP işçi payı %7,5 olur ve işsizlik primi kesilmez.
3. Gelir vergisi matrahı = brüt − SGK − işsizlik; kümülatif matrah = devreden matrah + ay matrahları toplamı.
4. Gelir vergisi (istisna öncesi) = ücret tarifesiyle `vergi(kümülatif) − vergi(önceki kümülatif)`.
5. Damga vergisi = brüt × binde 7,59 (brüt üzerinden; SGK üst sınırıyla sınırlanmaz).
6. Asgari ücret istisnaları: gelir vergisi istisnası, **asgari ücretin kendi kümülatif matrahı** üzerinden aynı yöntemle hesaplanan aylık vergidir (2026: Ocak–Haziran 4.211,33; Temmuz 4.537,75; Ağustos–Aralık 5.615,10 — araştırmadaki resmî program yeniden üretilir). Damga vergisi istisnası, asgari ücret × binde 7,59 = 250,70 ₺'dir. Her istisna, hesaplanan tutarı aşamaz. İstisnalar saklanmaz, her seferinde asgari ücret dönemlerinden hesaplanır; yıl içi revizyonda otomatik doğru kalır.
7. Net = brüt − SGK − işsizlik − gelir vergisi − damga vergisi.

Çıktı: aylık tablo (Ay, Brüt, SGK işçi, İşsizlik, GV matrahı, Kümülatif matrah, Dilim, Gelir vergisi, Damga vergisi, İstisnalar, Net) ve toplam satırı. **Dilim** sütunu ay sonundaki kümülatif matrahın vergi oranını gösterir; ay içinde dilim değişirse `%15 → %20` biçiminde görünür ve notlarda "X ayında kümülatif matrah N ₺ sınırını aşar" yazılır.
Özet (6 satır): ilk ay net, son ay net, yıllık net toplam, yıllık brüt toplam, yıllık toplam kesinti, ortalama aylık net.

**Netten brüte:** net ücret her ay SABİT tutulur; her ay için o ayın kümülatif matrahı dikkate alınarak brüt çözülür (bordro pratiği). Bir ay içinde (devreden matrah sabitken) net, brütün artan bir fonksiyonudur; bu yüzden "net ≥ hedef" koşuluyla ikili arama yapılır, ardından bulunan noktanın ±16 kuruş çevresi taranır ve hedefi tam veren **en küçük brüt** seçilir. Net bir kuruşluk brüt artışında en fazla 1 kuruş arttığı için her net tutar tam karşılanır; testlerde farklı net düzeylerinde 12 ayın tamamı kuruşu kuruşuna hedefe eşittir ve her ay bağımsız brütten nete hesapla doğrulanır. Özet: sabit net, ilk ay brüt, son ay brüt, brüt toplam, net toplam, toplam kesinti.

Gelişmiş girdiler: başlangıç ayı + önceki aylardan devreden kümülatif matrah; emekli (SGDP).
Not: aynı brüt ücretle bile aylık net değişir; ayrıca yüksek brüt, önceki aylarda biriken matrahı bir üst dilime taşıdığı için *belirli bir ayın* neti brüt arttıkça düşebilir. Monoton olanlar ilk ay neti ve "yıl başından o aya kadar toplam net"tir.
Hatalar: brüt, prime esas kazanç alt sınırının altındaysa (`gross`); net, asgari ücret düzeyindeki netin altındaysa (`net`).

### 2.3 `employerCost` — işveren maliyeti
SGK işveren payı = SGK matrahı × (%21,75 − teşvik puanı); işsizlik işveren payı = matrah × %2; toplam maliyet = brüt + paylar (− isteğe bağlı asgari ücret desteği). Yıllık tutar = aylık × 12 (brüt sabit varsayımı).
- Teşvik seçenekleri `employerIncentives.options` listesindedir (`none`, `p2` = 2 puan imalat dışı, `p5` = 5 puan yalnızca imalat; `from`/`to` ile). Yeni seçenek eklemek kod gerektirmez.
- Asgari ücret desteği (isteğe bağlı, varsayılan kapalı): gün başına 42,33 ₺ × 30 gün = 1.269,90 ₺ düşülür; `needsVerification` uyarısı verilir.
- SGDP (emekli): işveren payı %24,75, işsizlik payı ve teşvik yoktur.
- Özet: aylık toplam maliyet, yıllık toplam maliyet, işveren payları toplamı, brüt/maliyet oranı, SGK işveren payı, işsizlik işveren payı (destek seçiliyse destek tutarı).

### 2.4 `minWage` — asgari ücret
Girdi: tarih. Tarihe göre `minWage.periods` dönemi seçilir. Tablo 1: parametre yılının 12 ayı, brütten nete (her ayın kendi dönemindeki brüt tutarla); hesaplanan GV/DV ile istisnaları ayrı sütunlarda gösterilir, net her ay aynıdır. Tablo 2: seçilen tarihte yürürlükte olan teşvik seçeneklerine göre işveren maliyeti (ÇSGB tablosundaki gibi destek düşülmeden). Günlük brüt = yayımlanan günlük tutar. Hesaplanan net, yayımlanan resmî netten farklıysa uyarı verilir. Parametre yılı dışındaki tarihte en yakın dönem ve uyarı gösterilir.

### 2.5 `incomeTax` — gelir vergisi
Girdi: yıllık matrah ve tarife türü (ücret / ücret dışı). Dilim vergisi = yuvarlanmış kümülatif vergilerin farkıdır; dilim vergileri toplamı özetteki vergiye eşittir. Ortalama oran = vergi / matrah; marjinal oran = matrahın bulunduğu dilimin oranı (sınır tutarı alt dilimde sayılır); dilimde kalan alan = dilim üst sınırı − matrah (son dilimde "üst sınır yok"). Tarife sınırları yeniden değerleme oranından türetilmez; ilan edilen tutarlar `params` içindedir (oran yalnızca bilgi notudur).

### 2.6 `severance` — kıdem tazminatı
- Hizmet süresi: `ymdDiff(işe giriş, çıkış + 1 gün)` — çıkış günü dahil. Yıl oranı = yıl + ay/12 + gün/365 (tam rasyonel: `(365×toplam ay + 12×gün) / (12×365)`).
- Giydirilmiş ücret = aylık brüt + aylık yan haklar. Esas ücret = `min(giydirilmiş ücret, çıkış tarihindeki tavan)`. Brüt kıdem = esas ücret × yıl oranı. Hizmet bir yıldan kısaysa tutar 0'dır ve uyarı verilir.
- Damga vergisi = toplam brüt tutar × binde 7,59. Gelir vergisi: yasal tutar istisnadır (GVK md.25/7); gelişmiş alandaki "yasal tutarın üzerinde ödenen" kısım, devreden kümülatif matrahın üzerine eklenerek ücret tarifesiyle vergilenir. SGK primi yoktur.
- Tavan çıkış tarihine göre seçilir. İlk tanımlı dönemden önceki çıkış tarihi hata verir; son tanımlı dönemden sonrası için son tavan kullanılır ve uyarı verilir. Tavan uygulandığında `warnings[]` içinde belirtilir.
- Vergi uygulaması ikincil kaynaklara dayandığı için sonuçta her zaman ilgili uyarı bulunur (`compensationTax`).

### 2.7 `notice` — ihbar tazminatı
- İhbar süresi (4857 sayılı Kanun md.17; `notice.bands`): 6 aydan az 2 hafta; 6 aydan 1,5 yıla kadar 4 hafta; 1,5 yıldan 3 yıla kadar 6 hafta; 3 yıldan fazla 8 hafta. **Sınır yorumu:** tam 6 ay → 4 hafta; tam 1,5 yıl → 6 hafta; tam 3 yıl (gün 0) → 6 hafta. Resmî kaynak bu günleri belirtmediği için yorumdur; bu sürelerde sonuçta uyarı verilir.
- Tazminat = giydirilmiş aylık brüt ücret / 30 × (hafta × 7). Kıdem tavanı uygulanmaz.
- SGK primi yoktur. Gelir vergisi: tutar devreden kümülatif matrahın üzerine eklenerek ücret tarifesiyle vergilenir; damga vergisi binde 7,59. Asgari ücret istisnası uygulanmaz (bordroya yansıtılış biçimine göre fark olabilir).

## 3. Parametre tablosu

Dosya: `src/data/params/<yıl>-bordro.json`. Her bölümde `source` (URL), `confidence` ve `note` vardır; doğrulanmamış bölümde ayrıca `needsVerification: true` ve Türkçe `warning` bulunur. Oranlar kesir olarak saklanır (`0.15` = %15). Dönem listeleri `from`/`to` (ISO tarih) ile tanımlanır. `meta.id` = `<yıl>-bordro`, `meta.year` dosya adındaki yıla eşittir; dosya 60 KB'ı aşmaz (testle denetlenir). Sonuçta kullanılan değerler `paramsUsed` alanında (parametre kümesi kimliği + en çok 12 kalem) listelenir.

| Anahtar | İçerik | Kaynak | Güven | Bayrak |
|---|---|---|---|---|
| `incomeTax` | Ücret ve ücret dışı tarife dilimleri (`upTo`, `rate`) ve geçerlilik aralığı | GİB, 2026 gelir vergisi tarifesi (GV Genel Tebliği Seri No: 332) | verified-official | — |
| `revaluation` | Yeniden değerleme oranı (0,2549); yalnızca bilgi, hesapta kullanılmaz | HMB, VUK Genel Tebliği Sıra No: 585 | verified-official | — |
| `minWage` | `periods`: brüt, net ve günlük asgari ücret | ÇSGB duyurusu; Asgari Ücret Tespit Komisyonu Kararı 2025/1 | verified-official | — |
| `sgkBounds` | `periods`: prime esas kazanç alt ve üst sınırı | SGK, Prime Esas Kazanç Miktarları 2026 | verified-official | — |
| `employeeRates` | SGK işçi payı %14; işsizlik işçi payı %1 | ÇSGB, 2026 asgari ücret işveren maliyeti tablosu | verified-official | — |
| `employerRates` | SGK işveren payı %21,75; işsizlik işveren payı %2 | ÇSGB (aynı tablo) | verified-official | — |
| `employerIncentives` | `options`: teşviksiz, 2 puan, 5 puan (`points`, `from`, `to`) ve `conditions` | SGK, 5510 md.81/1-(ı) duyurusu | verified-official | — |
| `sgdp` | Emekli çalışan oranları: işçi %7,5; işveren %24,75 | Lebib Yalkın makalesi (ikincil) | secondary | `needsVerification` |
| `stampTax` | Ücrette damga vergisi (binde 7,59) | Cott Group (ikincil); oran ÇSGB'nin asgari ücret hesabıyla uyumlu | secondary | — |
| `minWageSupport` | Asgari ücret desteği: günlük 42,33 ₺ × 30 gün | SGK duyurusu | verified-official | `needsVerification` |
| `severance` | `ceilings`: kıdem tazminatı tavanı dönemleri; `minServiceYears` | ÇSGB, kıdem tazminatı tavanı tablosu (1980–2026) | verified-official | — |
| `servicePeriod` | Gün tabanı 365; çıkış günü dahil | Alomaliye (Yargıtay 9. HD kararını aktaran ikincil kaynak) | secondary | — |
| `notice` | İhbar süresi bantları, 30 günlük bölen, sınır uyarısı (`boundaryWarning`) | ÇSGB SSS (4857 sayılı Kanun md.17) | verified-official (süreler) | sınır günleri yorumdur |
| `compensationTax` | Kıdem ve ihbar tazminatı vergilendirmesi (damga oranı) | Hukuk bürosu yazısı (ikincil) | secondary | `needsVerification` |

Güven etiketleri: araştırma dosyalarındaki `verified-official` → `verified-official`; `cross-checked` ve `single-secondary-source` → `secondary`; `unverified` → `assumption` (şu an kullanılan yok). Resmî metni doğrudan okunmamış her madde en çok `secondary` sayılır; testler bu sırayı denetler.
Tarih-etkili öğeler: `minWage.periods`, `sgkBounds.periods`, `severance.ceilings`, `employerIncentives.options[].from/to`, `incomeTax.from/to`, `stampTax.from/to`, `minWageSupport.from/to`.

## 4. Varsayımlar ve bilinçli sadeleştirmeler

- **Sabit brüt:** maaş ve işveren maliyeti hesaplarında brüt ücret yıl boyunca sabittir; zam, ikramiye, fazla mesai, eksik gün ve ay içi giriş/çıkış girilmez. Yıl ortası başlangıç için başlangıç ayı ve devreden kümülatif matrah girilebilir. Yıllık işveren maliyeti = aylık × 12.
- **Çalışan tipi:** çalışan 4/a (özel sektör, hizmet akdi) kapsamındadır; işveren payı %21,75 (kısa vadeli sigorta kolları dahil, ÇSGB tablosundaki oran) alınır. İşyerinin tehlike sınıfı, ek sigorta (BES, özel sağlık) ve kısmi ay girdisi yoktur. Emekli (SGDP) seçeneği yalnızca oran farkını uygular.
- **Uygulanmayan indirim ve istisnalar:** asgari geçim indirimi, engellilik indirimi, yemek ve yol yardımı, sendika aidatı, nafaka ve icra kesintileri hesaplanmaz. Bu durum hesaplayıcı metinlerinde açıkça yazılıdır. Asgari geçim indirimi için "2026'da değişiklik yok" bulgusu kaynak yokluğuna dayanır (bkz. açık madde 13).
- **Asgari ücret istisnaları:** asgari ücretin kendi kümülatif matrahı üzerinden, ay ay hesaplanır; çalışanın devreden matrahından bağımsızdır; her istisna hesaplanan vergiyle sınırlıdır. 2026 tutarları ÇSGB programıyla eşleşir (TV-01).
- **Asgari ücret desteği:** isteğe bağlı, varsayılan kapalıdır; çalışanın koşulları sağladığı varsayılır (`needsVerification`, açık madde 3). ÇSGB'nin resmî işveren maliyeti tablosuna dahil değildir.
- **Alt sınır kuralı:** aylık brüt, prime esas kazanç alt sınırının altındaysa `InputError` (alan `gross`) döner; tam zamanlı çalışan varsayılır. Net → brüt modunda net, asgari ücret düzeyindeki netin altındaysa `InputError` (alan `net`) döner.
- **Aylık net değişimi:** aynı brütle bile ay ay net değişir (kümülatif matrah, dilim geçişi). Yüksek brütte belirli bir ayın neti brüt arttıkça düşebilir; bu bir hata değil, kümülatif matrah etkisidir.
- **Kıdem ve ihbar:** giydirilmiş ücret kullanıcı tarafından girilir (aylık brüt + aylık yan haklar); değişken ücret ortalaması, ikramiye payı ve fesih nedeni (hak kazanma koşulları) sorgulanmaz. Kıdem tazminatı tavanı fesih tarihine göre alınır; ihbar tazminatında tavan yoktur. Hizmet süresi `ymdDiff` ile hesaplanır, gün oranı 365 tabanıyla yapılır, çıkış günü dahildir (açık madde 2).
- **Tarih:** motor sistem saatini okumaz. "Bugün" ifadesi tanım dosyasındaki varsayılan değerlerde (`today`, `today-5y` gibi) arayüz tarafından çözülür; testler 2026-10-01'e göre çözer.
- **Tarife sınırları:** `incomeTax` içindeki tutarlar yayımlanan tutarlardır; yeniden değerleme oranından türetilmez (açık madde 8).
- **Yuvarlama:** her kalem ayrı yuvarlanır (yarım yukarı). Yuvarlak olmayan brüt tutarlarda başka bordro yazılımlarıyla ±0,01 ₺ fark çıkabilir (araştırma: 41.234,56 ₺ brütte 12 aydan 6'sı iki yöntemde 1 kuruş farklıdır); doğrulama yapılırken bu tolerans uygulanır.
- **Gelir vergisi hesaplayıcısı:** girilen tutar, istisna ve indirimler düşüldükten sonraki vergi matrahı kabul edilir; mahsup edilecek stopaj, geçici vergi ve diğer vergiler hesaba katılmaz.

## 5. Testler

Çalıştırma (proje kökü): `node --test tests/calc-bordro.test.mjs`. Dosya `node:test` ve `node:assert/strict` kullanır; paket kurulumu gerekmez. Hesaplar gerçek `src/calc/core.mjs` üzerinden `calculate()` ile çağrılır; böylece motor kaydı ve hata dönüşümü de sınanır. Parametreler `src/data/params/2026-bordro.json`, araştırma verisi `docs/research/*.json` dosyasından doğrudan okunur.

1. **Araştırma vektörleri:** TV-01…TV-23, KT-1…KT-6 ve IH-1…IH-2 kuruşu kuruşuna sınanır. Kayıt testi her vektörün işleyicisi olmasını ister; vektör sessizce atlanamaz.
   - TV-20 ve TV-21 (eleman.net): kaynak tablo, ücret tarifesinin 3. dilim sınırı (1.500.000 ₺) yerine ücret dışı tarifenin sınırını (1.000.000 ₺) uygulamıştır (TV-20'de Aralık, TV-21'de Mayıs–Ağustos). Testler bu aylarda resmî tarifeyle hesaplanan değeri bekler; kaynak tablodaki hatalı ayları ayrıca doğrular.
   - TV-22 (SGDP): kaynak metin 4.582,91 − 4.211,33 işlemini 317,58 olarak yazmıştır; doğrusu 371,58 ₺, net 30.181,17 ₺'dir (30.235,17 kullanılmaz).
   - TV-23 yalnızca araştırmacının kendi hesabıdır (dış kaynak yok); motorun bu hesapla tutarlı olduğunu gösterir, bağımsız doğrulama sayılmaz.
2. **Params ↔ araştırma:** tarife dilimleri, asgari ücret, PEK sınırları, prim oranları, teşvikler, SGDP, damga, destek, kıdem tavanları ve ihbar bantları araştırma dosyasıyla birebir karşılaştırılır. Params'taki güven düzeyi araştırmadakinden yüksek olamaz; doğrulanmamış maddeler bayraklıdır ve Türkçe `warning` taşır.
3. **Bağımsız kıyas (oracle):** test dosyasında motordan ayrı yazılmış bir BigInt hesaplayıcısı vardır. `grossNet` için 15 brüt × 4 başlangıç ayı × 2 devreden matrah × SGDP açık/kapalı = 1.680 ay satırı her sütunda kuruşu kuruşuna karşılaştırılır; `employerCost`, `minWage`, `incomeTax`, `severance` ve `notice` de aynı yöntemle sınanır.
4. **Özellik testleri:** tablo toplamı = özet; brüt − kesintiler = net; kümülatif matrah ardışık; dilim geçişleri tabloda ve notlarda görünür; ilk ay neti ve kümülatif net brütle azalmaz; net → brüt turunda her ay net hedefe kuruşu kuruşuna eşittir ve her ayın brütü bağımsız doğrulanır; başlangıç ayı + devreden matrah, tam yıl hesabının ilgili aylarıyla aynıdır; kıdem tavanı çıkış tarihine göre seçilir (her dönemin ilk ve son günü); bir yıldan kısa hizmette tazminat doğmaz.
5. **Hata ve rastgele girdi:** bozuk, eksik veya sıra dışı girdiler `{ error, field }` döner; sabit tohumlu (20261001) 7.200 rastgele çağrıda başka istisna sızmaz.
6. **Yıllık güncelleme güvencesi:** (a) sentetik 2027 parametreleriyle tüm motorlar değerleri params'tan okur; (b) yıl içi (Temmuz) asgari ücret revizyonunda dönemler, SGK sınırları ve istisnalar yeniden hesaplanır; (c) bayraklı parametre sonuca uyarı ekler, bayrak ve `warning` kaldırılınca uyarı kalkar; (d) motor kaynağında yıl, oran ve limit sabiti ile `Date`, `Math.random`, dinamik içe aktarma yoktur ve yalnızca `../util.mjs` içe aktarılır; (e) en güncel `<yıl>-bordro.json` dosyasında biçim, dönem listeleri ve tüm hesaplayıcıların varsayılan ve hazır değerleri hatasız hesaplanır.
7. **Tanım dosyası:** 6 hesaplayıcı (sıra 1, 2, 3, 4, 9, 10), benzersiz slug, sözleşme sınırları, girdi kimliklerinin motorun tanıdığı alanlarla eşleşmesi, her girdinin sonucu etkilemesi, ses ve hukuki duruş denetimi (yasak ifade, HTML ve ASCII-Türkçe yok), varsayımların kullanıcıya görünür olması.
8. **Belge:** bu dosyanın zorunlu bölümleri ve her params anahtarının, motorun ve hesaplayıcının adı.

Başka yazılımlarla karşılaştırırken ±0,01 ₺ tolerans uygulanır (4. bölüm). Satıcı tablolarında hata bulunursa kaynak tablo değil, resmî tarifeyle hesaplanan değer esas alınır.

## 6. Yıllık güncelleme kontrol listesi

Yıl değişiminde kod değişmez; yalnızca veri dosyası yenilenir. Komutlar proje kökünde (`boradendesign8` klasörü) çalıştırılır. Her değer resmî kaynaktan alınır. Doğrulanamayan değer için `confidence` alanı `secondary` ya da `assumption` yapılır, `"needsVerification": true` ve Türkçe bir `"warning"` eklenir; uyarı sonuç sayfasında görünür.

### A. Ocak: yeni yıl dosyası
Site, en yüksek yıllı `<yıl>-bordro.json` dosyasını hemen kullanır; resmî tutarlar açıklanmadan yeni dosya eklemeyin.

1. Dosyayı kopyalayın (örnek: 2027):
   ```
   cp src/data/params/2026-bordro.json src/data/params/2027-bordro.json
   ```
2. `2027-bordro.json` dosyasını açın. `meta` içinde `id` değerini `2027-bordro`, `year` değerini `2027`, `verifiedOn` değerini doğrulama tarihi yapın.
3. Bölümleri tek tek resmî kaynaktan güncelleyin ve her bölümün `source` adresini yeni kaynakla değiştirin. Oranları kesir (%15 → `0.15`), tutarları sayı (`33030` ya da `33030.5`; tırnak ve binlik ayırıcı yok) olarak yazın.
   - `incomeTax`: GİB'in yayımladığı ücret (`wage`) ve ücret dışı (`other`) tarife sınırları ile `from`/`to`. Sınırları yeniden değerleme oranıyla kendiniz hesaplamayın; yayımlanan tutarları yazın. `revaluation` yalnızca bilgi alanıdır.
   - `minWage.periods`: yeni brüt, net ve günlük tutar. `sgkBounds.periods`: SGK'nın prime esas kazanç alt ve üst sınırı. Önceki yılın satırlarını silebilirsiniz; geçmiş tarih seçilirse sonuç uyarıyla en yakın dönemi gösterir.
   - `employeeRates`, `employerRates`, `sgdp`, `stampTax`: oranlar.
   - `employerIncentives.options`: seçenekler (`points`, `from`, `to`) ve koşullar. 5 puanlık imalat teşvikinin 2027'deki durumunu SGK duyurusundan kontrol edin (2026 dosyasında `to` değeri 2026-12-31'dir).
   - `minWageSupport`: günlük tutar, gün sayısı, koşullar.
   - `severance.ceilings`: eski satırları **silmeyin** (geçmiş tarihli fesihler ve hazır değerler için gerekir); yeni yarıyılın tavanını yeni satır olarak ekleyin; dönemler çakışmaz, boşluk bırakmaz.
   - `notice`, `servicePeriod`, `compensationTax`: mevzuat değişikliği var mı bakın. Resmî kaynaktan teyit edilen madde için `needsVerification` ve `warning` satırlarını silin, `confidence` değerini `verified-official` yapın.
4. JSON'un geçerli olduğunu denetleyin (hata yazmazsa geçerlidir):
   ```
   node -e "JSON.parse(require('fs').readFileSync('src/data/params/2027-bordro.json','utf8'))"
   ```
5. `src/data/calculators-bordro.json` içinde `updated` tarihini, `sources` listesini ve metinlerdeki yıl ve tutar ifadelerini güncelleyin. Hazır değerlerin (`presets`) brütleri yeni asgari ücretin üzerinde kalsın; kıdem ve ihbar hazır değerlerinin tarihleri tanımlı tavan dönemleri içinde olsun.
6. Testleri çalıştırın; hepsi geçmelidir:
   ```
   node --test tests/calc-bordro.test.mjs
   ```
   Test dosyası en güncel `<yıl>-bordro.json` dosyasını kendisi bulur; varsayılan ve hazır değerlerin hatasız hesaplandığını denetler. 2026 dosyasını silmeyin (2026 araştırma vektörleri onunla sınanır).
7. Elle kontrol: asgari ücret hesaplayıcısında sonuç, parametre kümesi olarak `2027-bordro` göstermeli; net asgari ücret ÇSGB'nin açıkladığı netle aynı olmalı; hesaplayıcı sayfalarındaki metinlerde eski yıla ait tutar kalmamalı.

### B. Temmuz ve yıl içi değişiklikler
1. Her yarıyıl yeni kıdem tazminatı tavanını `severance.ceilings` listesine yeni satır olarak ekleyin (`from`, `to`, `amount`).
2. Yıl içinde asgari ücret değişirse: önceki dönemin `to` tarihini değişiklikten bir gün öncesine çekin; yeni dönemi **hem** `minWage.periods` **hem** `sgkBounds.periods` listesine ekleyin. Gelir ve damga vergisi istisnaları dönemlerden her seferinde hesaplanır; ayrıca değer girilmez (test dosyasındaki Temmuz revizyonu testi bu akışı sınar).
3. Teşvik, oran ya da tutar yıl içinde değişirse ilgili bölümün öğesini `from`/`to` ile aynı yöntemle bölün.
4. Her değişiklikten sonra A-4 ve A-6 adımlarını tekrarlayın.

(English summary: each January copy the latest params file to the new year, update every section from official sources, keep old severance-ceiling rows, validate the JSON, refresh the calculator definitions and run the test file; in July append the new severance ceiling, and add any mid-year minimum wage revision to both `minWage.periods` and `sgkBounds.periods`.)

## 7. Açık doğrulama maddeleri

Etkiye göre sıralıdır. Kaynak: araştırma notları ve bu çalışmada eklenenler. Bir madde teyit edilince ilgili params bölümünde `needsVerification` ve `warning` kaldırılır, `confidence` güncellenir.

1. **Kıdem ve ihbar tazminatının vergilendirmesi** (`compensationTax`): damga vergisi (binde 7,59), kıdemde gelir vergisi istisnası (GVK md.25/7) ve ihbarda gelir vergisi uygulaması iki ikincil kaynağa dayanır; GİB'in ücret rehberi okunamadı. Kıdem tavanının ihbar tazminatına uygulanmaması da doğrulanmamış genel bilgidir. Etki: iki hesaplayıcının net tutarı. Kapatma: GİB ücret rehberi ve 488 sayılı Kanun (2) sayılı tablo metni.
2. **Hizmet süresinin oranlanması** (`servicePeriod`): 365 gün tabanı ve çıkış gününün dahil olması ÇSGB tarafından belirtilmez; dayanak, Yargıtay 9. HD E.2024/5138 K.2024/6724 kararını aktaran ikincil kaynaktır. Etki: kısmi yıllı hizmetlerde kıdem tutarı. Kapatma: karar metni ya da ÇSGB görüşü.
3. **Asgari ücret desteği** (`minWageSupport`): yasal dayanak (7573 sayılı Kanun'a atıf açılamadı; bir kaynakta Resmî Gazete tarihi tutarsız) ve yararlanma koşulları doğrulanmadı. Hesaplayıcıda isteğe bağlıdır ve varsayılan kapalıdır. Kapatma: Resmî Gazete metni ve SGK genelgesi.
4. **SGDP (emekli çalışan) oranları** (`sgdp`): işçi %7,5 ve işveren %24,75 iki ikincil kaynaktadır; SGK'nın birincil metni okunmadı, prime esas kazanç sınırlarının aynı olduğu varsayıldı. Kaynak makaledeki örnekte aritmetik hata vardır (TV-22: 317,58 yazılmış, doğrusu 371,58). Kapatma: SGK duyurusu.
5. **İhbar süresi sınır günleri** (`notice`): tam 6 ay → 4 hafta, tam 1,5 yıl → 6 hafta, tam 3 yıl → 6 hafta yorumdur; ÇSGB belirtmez. Sonuçta uyarı verilir. Kapatma: ÇSGB ya da Yargıtay uygulaması.
6. **5 puanlık imalat teşviki** (`employerIncentives`): 31.12.2026 sonrası için düzenleme bulunamadı; 2 ve 5 puan koşullarının ayrıntısı SGK ve ikincil özetlere dayanır. 2027 dosyası hazırlanırken SGK duyurusu okunmalıdır.
7. **SGK işveren payı ayrışımı** (`employerRates`): %21,75 ÇSGB tablosundandır; 12 + 7,5 + 2,25 ayrışımı ikincildir ve hesapta kullanılmaz. Kısa vadeli sigorta kolları primi işyerinin tehlike sınıfına göre değişir; hesaplayıcıda tehlike sınıfı girdisi yoktur.
8. **2026 tarife sınırlarının oluşumu** (`incomeTax`, `revaluation`): sınırlar yeniden değerleme oranının (%25,49) tek tek uygulanmasıyla bulunmaz; Tebliğ metni okunamadı (Resmî Gazete PDF'si robots.txt nedeniyle açılamadı). Hesap GİB'in yayımladığı tutarlarla yapılır; yıllık güncellemede sınırlar oranla türetilmemelidir.
9. **Yıl içi asgari ücret değişikliği** (`minWage`): 2026 için değişiklik bulunmadığı bilgisi 19.08.2026'ya kadar olan kaynaklara dayanır. Değişiklik olursa B bölümündeki adımlar uygulanır.
10. **Damga vergisi oranının birincil metni** (`stampTax`): 488 sayılı Kanun (2) sayılı tablo okunmadı; oran birden çok kaynakta ve ÇSGB'nin resmî asgari ücret hesabında aynıdır.
11. **Yarım kuruş yuvarlama kuralları**: kaynaklı vektör yoktur; yarım yukarı ve "yuvarlanmamış kümülatif farkın yuvarlanması" seçilmiştir. Başka yazılımlarla ±0,01 ₺ fark olabilir.
12. **TV-23** (350.000 ₺ brüt, SGK üst sınırının üstü): yalnızca araştırmacının kendi hesabıdır; kaynaklı 12 aylık vektör bulunamadı.
13. **Asgari geçim indirimi** (AGİ): kaldırılmasına ilişkin madde numarası tek kaynaklıdır; "2026'da değişiklik yok" bulgusu kaynak yokluğuna dayanır. Hesaplayıcı AGİ uygulamaz ve metinlerde bunu belirtir.

(English summary: the most consequential open points are that kıdem/ihbar tax treatment rests on secondary sources, the 365-day basis for partial years is not stated by ÇSGB, and the asgari ücret desteği and SGDP details are unverified. All affected results carry a visible warning.)
