# Boraden — Wagtail Taşıma Haritası

Bu belge, statik ön yüzün (`boradendesign8/`) Python/Wagtail arka ucuna **olduğu gibi** taşınması için eşleme tablosudur.
Her şablonun ve rota modülünün başında ayrıca «Wagtail karşılığı» yorumu vardır; bu belge onları tek yerde toplar.

**İlke:** HTML/CSS/JS değişmez; Nunjucks şablonları Django şablonlarına çevrilir, `scripts/routes/*.mjs` içindeki sayfa tablosu
Page modellerine, `src/data/*.json` dosyaları snippet / StreamField / site ayarlarına dönüşür. Tüm metin zaten düz JSON'dadır
(HTML ve yerleşim ipucu yok); yalnızca satır içi işaretleme vardır (`**kalın**`, `[etiket](/yol)`, `[[Yer tutucu]]` → `rich` süzgeci).

---

## 1. Önerilen yığın

| Parça | Seçim | Not |
|---|---|---|
| Çatı | Django + Wagtail (güncel LTS) | Türkçe öncelikli; ileride `wagtail-localize` ile EN ağacı eklenebilsin diye modeller `TranslatableMixin` ile başlatılmalı |
| Formlar | `wagtail.contrib.forms` (`AbstractEmailForm`) | İletişim ve Kariyer formları |
| Yönlendirmeler | `wagtail.contrib.redirects` | URL'ler on yıl sabit kalmalı; eski adresler için kalıcı yönlendirme |
| Site ayarları | `wagtail.contrib.settings` (`BaseSiteSetting`) | `site.json` + iletişim/kurum bilgileri |
| Sitemap | `wagtail.contrib.sitemaps` | `lastmod = last_published_at`; `noindex` sayfalar listeden çıkar |
| Arama | `wagtail.search` (başta DB arka ucu) | Şimdilik istemci tarafı dizin (§7) |
| Görseller | Wagtail Image + `{% image %}` renditions | `photos.json` → görsel + `alt` |
| Belgeler | `wagtaildocs` | 247 sirküler PDF'i (≈156 MB) |
| Statik | `ManifestStaticFilesStorage` | Statik sürümdeki içerik özetli `?v=` (`asset_v`) yerine dosya adında özet |
| Ön yüz derlemesi | `npm run build:assets` (esbuild, değişmez) | CSS birleştirme + JS paketi → `static/` |

Önerilen Django uygulamaları: `core` (SiteSettings, HomePage, taban sayfa), `services`, `sectors`, `insights`, `reference` (sözlük, SSS),
`tools` (hesaplayıcılar, takvim), `company` (hakkımızda, kariyer, iletişim), `support` (yasal, arama, site haritası).

---

## 2. Sayfa ağacı ve URL'ler (127 sayfa)

URL'ler Türkçe-ASCII, küçük harf, sonda `/`; **değişmez** (Wagtail'de `slug` aynen kullanılır). Kökte `HomePage`.

```
/                                   HomePage
├─ hizmetler/                       ServiceIndexPage
│  └─ <alan>/                       ServiceAreaPage        ×6   (vergi, denetim, danismanlik, insan-kaynaklari, sistemler, akademi)
│     └─ <hizmet>/                  ServicePage            ×47
├─ sektorler/                       SectorIndexPage
│  └─ <sektor>/                     SectorPage             ×10  (2'si müşteri segmenti: is_segment)
├─ bilgi-merkezi/                   InsightsHubPage
│  ├─ sirkulerler/                  CircularIndexPage      (+ PublicationPage ×2, ArchiveCircular ×247 snippet)
│  ├─ duyurular/                    PublicationIndexPage   → PublicationPage ×1
│  ├─ blog/                         PublicationIndexPage   → PublicationPage ×3
│  ├─ haberler/                     PublicationIndexPage   → PublicationPage ×6
│  ├─ sektor-raporlari/             ReportIndexPage        (+ Report ×10 snippet)
│  ├─ okuma-notlari/                ReadingNoteIndexPage   → ReadingNotePage ×14
│  ├─ sozluk/                       GlossaryPage           (+ GlossaryTerm ×60 snippet)
│  └─ sss/                          FaqPage                (+ FaqGroup ×5 / FaqItem snippet)
├─ hesaplayicilar/                  CalculatorIndexPage    → CalculatorPage ×11
├─ vergi-takvimi/                   TaxCalendarPage        (+ CalendarItem ×27 snippet)
├─ hakkimizda/                      AboutPage
│  └─ ekibimiz/                     TeamIndexPage
│     └─ <kisi>/                    TeamMemberPage         ×3   (yalnızca özgeçmişi yayımlanan üyeler; diğer 22 kişi Ekibimiz'de bölümü altında satırdır: `has_profile` = false)
├─ kariyer/                         CareersPage
├─ iletisim/                        ContactPage            (AbstractEmailForm)
├─ arama/                           SearchPage
├─ site-haritasi/                   SitemapPage
└─ yasal/                           LegalFolderPage        (kapsayıcı; statik sürümde dizin sayfası yok → ilk çocuğa yönlendir)
   └─ <slug>/                       LegalPage              ×4   (kvkk-aydinlatma-metni, gizlilik-politikasi, cerez-politikasi, kullanim-kosullari)
404.html                            Django 404.html şablonu
```

Statik sürümde üretilen ek dosyalar: `sitemap.xml`, `robots.txt`, `/assets/data/search-index.json`, `/assets/data/params/*.json`.

---

## 3. Şablon → model eşlemesi

| Şablon (`src/templates/…`) | Rota modülü | Wagtail modeli | Veri kaynağı (`src/data/`) |
|---|---|---|---|
| `pages/home.njk` | `routes/core.mjs` | `HomePage` | `content.json` (about, world, groups), `site.json`; hesaplayıcı seçkisi = `HomePage.featured_calculators` (CalculatorPage ilişkisi) |
| `pages/services-index.njk` | `core.mjs` | `ServiceIndexPage` | `content.json › groups, services`; üstteki alan kartları = `ServiceAreaPage.photo` + alt sayfa sayımı (§12) |
| `pages/service-area.njk` | `core.mjs` | `ServiceAreaPage` (alt: `ServicePage`) | `content.json › groups` (`id, name, short, description, number`); hizmet kartları, birleşik SSS, ilgili sektör/hesaplayıcı **hesaplanır** (§12) |
| `pages/service.njk` | `core.mjs` | `ServicePage` — StreamField bölümleri: kısaca, kapsam, süreç, çıktı, not, SSS, kaynaklar; `photo` (isteğe bağlı görsel seçici) | `content.json › services` + `content.json › sources` (`sourceKeys`); künye, ilgili içerik, genel SSS ve «Çalışma biçimimiz» bandı **hesaplanır / site ayarıdır** (§12) |
| `pages/sectors/index.njk` | `routes/sectors.mjs` | `SectorIndexPage` | `sectors.json` (ilgi matrisi sorgudan sayılır) |
| `pages/sectors/sector.njk` | `sectors.mjs` | `SectorPage` | `sectors.json`: `name, short, segment, lead, overview[], topics[], services[] (M2M), calculators[] (M2M), glossary[] (M2M), questions[], sources[]` |
| `pages/reference/glossary.njk` | `sectors.mjs` | `GlossaryPage` + `GlossaryTerm` snippet | `glossary.json`: `slug, term, category, short, long[], related[] (kendine M2M), services[] (M2M), sources[]` |
| `pages/reference/faq.njk` | `sectors.mjs` | `FaqPage` + `FaqGroup`/`FaqItem` (InlinePanel) | `faq.json`: `id, title, intro, items[{q,a}]` |
| `pages/insights/hub.njk` | `routes/insights.mjs` | `InsightsHubPage` | koleksiyonlar = StreamField; sayılar sorgudan |
| `pages/insights/circulars.njk` | `insights.mjs` | `CircularIndexPage` + `ArchiveCircular` snippet | `archive.json`: `id, title, date, year, number, file, source, bytes` (4 kaydın tarihi, 2'sinin numarası yok → alanlar boş olabilir) |
| `pages/insights/pub-list.njk`, `_type-tabs.njk` | `insights.mjs` | `PublicationIndexPage` (kardeşler = sekmeler) | `content.json › publications` |
| `pages/insights/article.njk` | `insights.mjs` | `PublicationPage` — `date, category, summary, body (StreamField), sources (ListBlock), service (FK), source_date, editorial_type, date_verified` | `content.json › publications.{circulars,announcements,blog,news}` |
| `pages/reading/reports.njk` | `routes/reading.mjs` | `ReportIndexPage` + `Report` snippet | `content.json › sectorReports` |
| `pages/reading/notes-index.njk`, `note.njk` | `reading.mjs` | `ReadingNoteIndexPage` → `ReadingNotePage` | `content.json › perspectives` (`source_date_verified` yalnızca doğrulanmışsa tarih gösterir) |
| `pages/tools/calculators-index.njk` | `routes/tools.mjs` | `CalculatorIndexPage` | `calculators-*.json` |
| `pages/tools/calculator.njk` | `tools.mjs` | `CalculatorPage` — `engine` (seçim), `params` (→ `ParameterSet`), girdiler/ön ayarlar/açıklama/varsayımlar/SSS/kaynaklar StreamField | `calculators-bordro.json`, `calculators-vergi.json` |
| `pages/tools/tax-calendar.njk` | `tools.mjs` | `TaxCalendarPage` + `CalendarItem` snippet | `calendar.json` (`meta, categories, rules, holidays, items`); şablon ayrıca `cal.next` bekler: bugünden itibaren ilk 3 kayıt («Sıradaki tarihler» şeridi sayfayla gelir, tarayıcı yeniler — Django'da istek gününe göre hesaplanır) |
| `pages/company/about.njk` | `routes/company.mjs` | `AboutPage` | `aboutpage.json`: `title, lead, sections[], facts[], closing` |
| `pages/company/team.njk` | `routes/team.mjs` | `TeamIndexPage` (AboutPage'in alt sayfası) + `TeamDepartment` (sıralı bölümler: `id`, `name`, `areas` → `ServiceAreaPage` (ParentalManyToManyField); InlinePanel) | `team.json`: `title, lead, intro, departments[]` |
| `pages/company/person.njk` | `team.mjs` | `TeamMemberPage` — `role, titles, summary, bio, education, expertise`, `department` (FK → `TeamDepartment`), `has_profile`, `areas/services/sectors` (ParentalManyToManyField), `photo` (FK Image + kişinin izni (KVKK) onayı), `contact` + `show_contact`, `status`, `needs_verification` + `verify_note` (editoryal; sitede gösterilmez) | `team.json › members[]` |
| `pages/company/careers.njk` | `company.mjs` | `CareersPage` (+ `JobPosting` snippet, form) | `careers.json` |
| `pages/company/contact.njk` | `company.mjs` | `ContactPage` (`AbstractEmailForm`; konular = `ContactTopic` snippet; «Doğrudan iletişim» kanalları = `ContactChannel` InlinePanel: `kind` (e-posta/telefon/WhatsApp/adres), `label`, `value`, `href` — değeri boş satır bağlantısız çizilir; bağlantısız adres satırı haritaya bağlanır: önce ofis adresi, yoksa satırın metni) | `contactpage.json` |
| `pages/company/kit.njk` | — | form alanı şablonu (`field_type` dalları) | — |
| `pages/support/legal.njk` | `routes/support.mjs` | `LegalPage` — `status` (Taslak/Yayında), `updated_at`, `intro`, `sections`, `placeholders`, `review_notes` | `legal/*.json` |
| `pages/support/search.njk` | `support.mjs` | `SearchPage` | `/assets/data/search-index.json` (§7) |
| `pages/support/sitemap.njk` | `support.mjs` (`sitemapTree`) | `SitemapPage` (sayfa ağacından üretilir) | — |
| `pages/404.njk` | `build.mjs` | Django `404.html` | — |
| `layouts/base.njk` | — | `base.html` (`{% block %}` yapısı aynı) | — |
| `partials/header.njk`, `footer.njk`, `cta.njk`, `logo.njk`, `macros.njk` | — | `{% include %}` / kapsayıcı etiketler | `site.json` (nav, insights, footerLinks) |
| `partials/people.njk` (ekip bandı), `partials/blocks.njk` (künye · fotoğraf bandı · ilgili içerik · çalışma biçimimiz) | — | kapsayıcı etiketler (`@register.inclusion_tag`); veri sayfa modelinin `get_context()` içinde hesaplanır | `team.json`, `approach.json`, ilişki sorguları (§12) |

---

## 4. Site ayarları ve snippet'ler

**`SiteSettings` (`BaseSiteSetting`)** — her sayfada ortak olan bilgiler (şablonlarda `site`, `contact`, `about` küreselleri):

| Alan grubu | Kaynak | Not |
|---|---|---|
| Kimlik | `site.json › name, legalName, tagline, description, url, founded, year` | `year` = çalışma zamanında `now.year` |
| Menü | `site.json › nav[{label,url,panel}]`, `cta{label,url}`, `insights[{label,url,desc}]` | `panel` = mega menü kimliği (`services` / `insights`); Orderable satırlar |
| Alt bilgi | `site.json › footerLinks.{kurumsal,yasal}` | Orderable bağlantılar |
| Metinler | `site.json › independenceNote`, `disclaimer` | `independenceNote` şablonda `data-legal-review="BDY m.22"` ile işaretli — **avukat onayı olmadan değiştirilmez** |
| İletişim | `content.json › contact` (`email, phone, phoneHref, whatsapp, street, postcode, district, city, country`) | JSON-LD ve iletişim sayfası aynı kaynaktan. Tüm alanlar isteğe bağlı: boş alan hiçbir yerde çizilmez (bağlantı, etiket, ayraç ya da JSON-LD alanı olarak); `model.mjs › contactOf` türetilmiş `line2`, `full`, `hasAddress` üretir. Ekim 2026: hepsi boş (müşteri: kişiye özel doldurulacak — `TeamMemberPage.contact` + `show_contact`) |
| Kurum | `content.json › about` (`name, foundation, overview, scope, method, principles`) | Ana sayfa ve Hakkımızda ortak kaynak |
| 3B sahne alt yazıları | `src/assets/js/world/formations.js` (`figure` alanı; alan şekilleri `scripts/scenes.mjs › AREA_SHAPE`) | Şekil seçiciyle birlikte gelir (`FORMATIONS` kaydı); ayrı alan gerekmez |
| «Çalışma biçimimiz» bandı | `approach.json`: `eyebrow, title, stepsLabel, steps[{title,text}], principlesLabel, linkLabel, linkUrl, ctaLabel` (+ `content.json › about.principles`) | `ApproachSettings` (site ayarı; yalnızca editör düzenler). Metin, SSS yanıtlarından derlendi → **müşteri onayı gerekir** |
| (kullanılmayan) | `content.json › world` | Eski siteden kalan «ORBIST/İngiltere» verisi **sitede kullanılmıyor** (doğrulanamadı); taşınmasın |

**Snippet'ler** (`register_snippet`, mümkünse `DraftStateMixin` + `RevisionMixin`): `ArchiveCircular`, `Report`, `GlossaryTerm`, `FaqGroup`/`FaqItem`,
`CalendarItem`, `ContactTopic`, `JobPosting`, `ParameterSet`, `SourceList` (`content.json › sources`; hizmetlerin `sourceKeys` alanı buna bağlanır).
Kişi snippet'i **yok**: her ekip üyesi bir **sayfadır** (`TeamMemberPage`, §12.5). Başlangıç içeriği: üç kişi için eski sitedeki herkese açık özgeçmişler, 22 kişi için müşterinin kurum şeması (Ekim 2026; yalnızca ad/unvan/bölüm); tüm kayıtlar `needsVerification: true` (yayından önce kişiyle doğrulanmalı). Portre fotoğrafı yalnızca yazılı izinle (KVKK) eklenir (`photos.json › person: true`); yoksa baş harfli kutu görünür.

**`ParameterSet`** (hesaplayıcı parametreleri, yıl başına): `params/2026-bordro.json`, `params/2026-vergi.json` →
`id, year, verified_on, notes` + bölüm başına `source, confidence, needs_verification, warn`. Yönetim panelinde «doğrulanmadı» işaretli
alanlar sarı uyarıyla gösterilmeli; `needs_verification` doluyken ilgili hesaplayıcı sayfasında uyarı çıkar. Yayına yalnızca `meta.id, year, verifiedOn` gider (iç notlar gitmez).

---

## 5. Nunjucks → Django şablon dönüşümü

| Nunjucks | Django | Not |
|---|---|---|
| `{% extends "layouts/base.njk" %}` / `{% block %}` | aynı söz dizimi (`base.html`) | blok adları korunur |
| `{% include "partials/x.njk" %}` | `{% include "partials/x.html" %}` | `logo.njk` → `logo.html` **tek satır, değişmeden** |
| `{% set a = … %}` | `{% with a=… %}` ya da görünüm/`get_context()` içinde hesapla | uzun `set` zincirleri Page modeline özellik (`@property`) olur |
| `{% macro %}` (macros.njk) | kapsayıcı etiket (`@register.inclusion_tag`) | `m.phero(...)`, `m.photo(...)`, `m.arrow()` → `{% phero page %}`, `{% photo 'key' %}`, `{% arrow %}` |
| `{{ x \| filter }}` | `{{ x\|filter }}` | süzgeç karşılıkları aşağıda |
| `autoescape: true` | varsayılan | `\| safe` yalnızca `rich`/`json_script` çıktısında |
| `{{ asset('…') }}` | `{% static '…' %}` | |
| `{{ asset_v.css }}`, `{{ asset_v.js }}` (`?v=` içerik özeti) | `{% static %}` + `ManifestStaticFilesStorage` | önbellek kırıcı; dosya değişmedikçe adres aynı kalır |
| `{{ search_v }}` (arama dizini `?v=`) | dizini üreten görünüm (yayın sinyaliyle önbellek) | §7 |
| `{{ font_url('montserrat-300-normal') }}` | `{% static 'fonts/…' %}` (`src/assets/fonts/fonts.json`'daki ad) | yalnızca `<link rel=preload>` |
| `data`, `site`, `model`, `groups`, `services`, `contact` (küresel) | bağlam işlemcisi + `SiteSettings` | `model.*` sorguları sayfa modellerinin `get_context()` içinde |
| `page` (url, title, titleFull, description, scene, kind, crumbs, bodyClass, noindex, canonical) | Page alanları: `seo_title`, `search_description`, `scene` (seçim), `body_class`, `noindex` (`Page` → `robots`), `full_url` | `crumbs` = `page.get_ancestors()` |

**Süzgeçler** (`scripts/filters.mjs` → `templatetags/boraden_tags.py`; adlar bilerek aynıdır):
`rich`, `paras_rich`, `plain`, `paragraphs`, `strip_tags`, `truncate_words`, `date_tr`, `date_short`, `date_long`, `day_of`, `weekday_tr`, `month_short`,
`year_of`, `pad2`, `upper_tr`, `lower_tr`, `money_tr`, `int_tr`, `where`, `limit`, `slugify` (Türkçe harf tablosuyla), `json_script`,
`tagline_words` (slogan → ana sayfa başlık satırları: virgülle ayır, sondaki noktalamayı at, en çok 4 satır; mantık `taglineWords()`, testi `tests/filters.test.mjs`),
`longest_word` (en uzun kelimenin harf sayısı; dizi + alan adıyla en uzunu: `items|longest_word:"title"`. Büyük başlıklar bunu `style="--lw: …"` olarak taşır —
`phero` başlığı, kapanış bandı başlığı, kapsam kartları ızgarası — ve CSS uzun Türkçe kelime kutuya sığacak kadar yazıyı küçültür; editör uzun başlık girse de kelime harf ortasından bölünmez.
Mantık `longestWord()`; noktalama ve `**…**`/`[…](…)` işaretlemesi sayılmaz, tire/eğik çizgi kelime ayırır),
`scene` (formasyon kimliği → 3B dünya sıra numarası, koyu bantlarda: `data-world="{{ 'matris'|scene }}"`; bilinmeyen kimlik hata verir),
`longest_word_em` (en uzun kelimenin kahraman başlığı yazı tipindeki genişliği, em; kelimeye bitişik noktalama dahil; `phero` başlığı `style="--lwe: …"` taşır, başlık sütununa sığacak kadar küçülür; mantık `longestWordEm()`),
`scene_reach` (sahne → `--sa:…;--sb:…`: 3B şeklin ekrandaki sol erimi; `phero` bölümü taşır, başlık sütunu bu çizginin solunda kalır; veri `src/data/scene-reach.json`, `scripts/scene-reach.mjs` üretir — Django süzgeci aynı JSON'u okur; verisiz sahnede boş),
`phone` (telefon numarası: rakam grupları U+00A0 ile bağlı, yalnızca alan kodundan sonra satır kırılabilir; header, footer, kapanış bandı, SSS, iletişim kanalları, kişi profili).

- **`rich`** düzenleyici içeriğinde RichText'e dönüşür: `**kalın**` → `bold`, `[etiket](url)` → `link`; **`[[Yer tutucu]]`** için özel bir
  Draftail satır içi stili (`placeholder` → `<mark class="ph">`) tanımlayın. İlk içe aktarmada JSON metni `rich` ile aynı regex'ten geçirilerek RichText HTML'ine çevrilir.
  Düz metne çevrilirken (`plain`: arama sonucu açıklaması, meta açıklama) yer tutucu köşeli parantezle kalır («[E-posta adresi]»); yer tutucu içeren SSS sorusu `FAQPage` JSON-LD'sine yazılmaz (`ld.mjs › faqLd`). Ekim 2026: metinlerdeki iletişim bilgileri `[[E-posta adresi]]`, `[[Telefon numarası]]`, `[[WhatsApp numarası]]`, `[[Adres]]` yer tutucularıdır.
  Dış bağlantılar `target="_blank" rel="noopener noreferrer"` + `<span class="sr-only"> (yeni sekmede açılır)</span>` alır (Wagtail link işleyicisiyle).
- **Tarihler** ISO (`YYYY-MM-DD`) saklanır; gösterim Türkçe ay adlarıyla (`date_tr` → «6 Eylül 2026»). `date: null` kayıtları (arşivde 4) boş tarih gösterir.
- **JSON-LD** (`scripts/ld.mjs`: `graph, listLd, faqLd, webPageLd, breadcrumbLd, orgRef, baseOf`) → her Page modelinin `get_context()` içinde aynı şemalar.
  Şablonlardaki `<script type="application/ld+json">{{ ld | json_script }}</script>` satırı aynı kalır.
  **Dikkat:** buradaki `json_script` süzgeci Django'nun yerleşik `json_script`'i değildir (o, `<script id=…>` etiketi üretir); yalnızca `< > & U+2028 U+2029`
  karakterlerini kaçışlanmış güvenli JSON metni döndürür. Çakışmayı önlemek için Django'da adı `json_safe` yapın ve şablonlarda (`ld`, `[data-calc-def]`, sayfa içi JSON) değiştirin.

---

## 6. Veri/sözleşme notları (modelleme sırasında dikkat)

- **Taslak durumu (`status: "Taslak"`)** — 4 yasal sayfa. Taslak iken: `noindex`, «doldurulacak alanlar» ve «hukuki inceleme notları» panelleri görünür; yayımlanınca kendiliğinden kalkar. `LegalPage.status` seçim alanı olmalı; `Taslak` ise `robots` meta `noindex`.
- **Doğrulama bayrakları:** `publicationDateVerified` (blog), `sourceDateVerified` (okuma notları), `needsVerification` / `confidence` (parametreler). Bayrak `false` ise tarih yayımlanmaz / uyarı gösterilir.
- **Boş ilişkiler** bölümü ve içindekiler satırını gizler (ör. sektörde hesaplayıcı yoksa «Hesaplayıcılar» bölümü çıkmaz).
- **Anchor kimlikleri** kalıcıdır: sözlük `#<slug>`, SSS `#<grup-id>-<sıra>`, sektör raporları `#<id>`, arşiv yılı `#arc-y<yıl>`. Arama dizini bunlara doğrudan bağlanır; kimlikler değişirse yönlendirme/eşleme gerekir.
- **Sayılar sorgudan gelir** (kayıt sayıları, ilgi matrisi, yıllık dağılım, komşu notlar): şablonlarda sabit sayı yoktur.
- **Hizmet kimlikleri** (`content.json › services[].id`) iletişim formunda `?hizmet=<id>` ön seçimi için kullanılır; `ContactTopic.services` ilişkisinden üretilir.
- **Hukuki duruş:** metinler bilgilendiricidir; üstünlük/söz yok; Boraden hakkında doğrulanmamış bilgi yok; reklam yasağı (BDY m.23) ve bağımsızlık notu (BDY m.22) için her yerde aynı metin (`SiteSettings`).

---

## 7. İstemci tarafı sözleşmeler (JS değişmez; sunucu yalnızca işaretlemeyi ve birkaç JSON uç noktasını sağlar)

| Mekanizma | İşaretleme / uç nokta | Wagtail'de |
|---|---|---|
| Sayfa yönlendirici (fetch-and-swap + perde geçişi) | `#main` içeriği değiştirilir; `#main` üzerindeki `data-scene`, `data-url`, `data-title`, `data-body-class`; `#curtain`, `#live`; istek başlığı `X-Requested-With: boraden-swap`; `data-no-swap` bağlantılar tam gezinir; PDF/`/assets/` tam gezinir | Aynı tam HTML döner (kısmi şablon gerekmez). **Staff/önizleme oturumlarında yönlendirici kapatılmalı** (Wagtail kullanıcı çubuğu ve önizleme için `<html data-no-router>` + `router.js` başlangıç koşulu). Statik dosya yolu `/assets/` ise `STATIC_URL = "/assets/"` yapın; değilse `router.js` içindeki `/assets/` atlama koşulunu yeni önekle güncelleyin |
| Liste motoru `listing.js` | `[data-listing]`, `[data-filter-by]`/`[data-filter]`, `[data-search]`, `[data-item][data-text]`, `[data-group]`, `[data-empty]`, `[data-result-count]`, `[data-pager]`, `[data-per-page]`; URL eşitleme `?q= &key= &p=` | Sirküler arşivi (247), sözlük (60), sektör raporları, okuma notları, SSS bu motoru kullanır. Kayıt sayısı büyürse aynı parametrelerle sunucu tarafı süzgece geçilebilir; işaretleme aynı kalır |
| Sayfa modülleri | `[data-module="ad"]` → `src/assets/js/modules/ad.js` (`export function mount(el, ctx)`); yeni modül eklemek için `main.js`'e dokunulmaz (glob dinamik içe aktarma) | Şablonda yalnızca `data-module` yazılır |
| Hesaplayıcılar | `<script type="application/json" data-calc-def>{{ def\|json_safe }}</script>`; parametre dosyası `/assets/data/params/<yıl>-<alan>.json`; hesap çekirdeği `src/calc/*` (saf JS, pakete dahil) | `ParameterSet` → aynı yolda JSON uç noktası (önbellekli) ya da yayımlanınca statik dışa aktarma. Hesap motoru sunucuya taşınmaz |
| Arama | `data-index="/assets/data/search-index.json"` → `[{t, u, d, k}]` (başlık, adres, açıklama, tür); 127 sayfa + 353 yalnızca-arama kaydı (sözlük, SSS soruları, rapor/arşiv/PDF, çapalar) | Görünüm: `Page.objects.live().public()` + snippet'lerden aynı dizini üretir (yayın sinyali ile önbelleğe alınır). İleride `wagtail.search` sunucu aramasına geçilebilir; `search.js` işaretlemesi aynı kalır. `noindex` (Taslak) sayfalar dizine girmez |
| Formlar (iletişim, kariyer) | `.ct-field[data-field][data-type]`, `form-kit.js` (doğrulama, mailto: taslağı), `contact-form.js`, `career-form.js`; `?hizmet=<id>` / `?konu=<id>` ön seçim | `AbstractEmailForm` + `FormField`'lar (alan kimlikleri JSON'daki `fields[].id`). **Yalnızca gönderim adımı değişir:** `form-kit.js` içindeki mailto: üretimi, form sayfasına `fetch` POST (CSRF belirteci + KVKK onayı) ile değiştirilir; başarı/hata metinleri `landing` alanlarından gelir. CV yükleme için dosya türü/boyut doğrulaması sunucuda tekrarlanmalı |
| Efekt kademeleri | `html[data-fx="full\|lite\|off"]`; tek depolama `localStorage['boraden-fx']`; çerez yok | Değişmez. (Çerez politikası metni bu gerçeğe göre yazıldı — çerez/izleme eklenirse yeniden gözden geçirilmeli) |
| 3B dünya | `[data-world]`, `data-chapter`, `world.js` + `formations.js` (three.js, tembel; 46 şekil) | Sayfa modelinde `scene` seçim alanı (formasyon **kimliği**, ör. `mutabakat`; şablonda sıra numarasına çevrilir); HTML'e `data-scene` olarak yazılır. Liste ve eşleme: `docs/FORMASYONLAR.md`, `scripts/scenes.mjs` |
| Şekil kutuları (beyaz sayfa) | `figure.fig[data-shapes]` (`partials/macros.njk › fig`), `main[data-shapes]`, bölüm işareti `[data-shape-at]`, üzerine gelme `[data-shape-hover]`; `modules/figure.js` | Şablon parçası (`{% include "partials/fig.html" with kind="side" %}`); varsayılan dizi sayfa modelinin `fig` alanından (formasyon kimlikleri, çoklu seçim). Hizmet/sektör/hesaplayıcı sayfalarında `shape` alanı (tek seçim) hem kahraman hem kutu için kullanılır. İşaretler şablondadır, veri gerektirmez |
| Metin animasyonları | `data-reveal`, `data-lit`, `data-count`, `data-steps`, `data-toc`, `data-parallax` | Şablon sözleşmesi; veri bağımlılığı yok. **Her `.svc__label` başlığı `data-reveal` taşır** (tik çizimi buna bağlı; `tests/services.test.mjs` denetler) |
| Bölüm göstergesi (HUD; sağ kenar noktaları) | `[data-chapter]` + `id` (≥4 işaretli bölüm → bölüm adı değişimde yanar) **ya da** yoksa «Bu sayfada» menüsünden (`[data-toc] a[href^="#"]`, 4–10 bağlantı → sessiz gösterge); yalnızca Tam/Hafif, ≥1200 px (menüden türeyen ≥1360 px) | Değişmez. Editör bir şey yapmaz: menü şablonda zaten var olan bölümlerden üretilir, boş bölüm menüden ve göstergeden düşer. Beliren bölüm adı içeriğin üstüne bindiğinde okunsun diye yarı saydam «hap» zemin taşır (açık bölümde beyaz, koyu bölümde lacivert; `50-home.css › .hud__label`) |
| Mobil «Bu sayfada» şeridi | ≤ 900 px ve ≥ 4 bağlantılı `[data-toc]` (`.svc__side:not(.lg-side)`): `65-services.css` menüyü ekranın üstüne yapışan yatay çip şeridine çevirir (`:has()`); `behaviors.js › toc` aktif çipi şeritte ortalar; header gizlenince şerit en üste çıkar | Değişmez. Hukuki metinlerin `.lg-side` kutusu şeride dönüşmez. Menü şablonda zaten var olan bölümlerden üretildiği için editör bir şey yapmaz |
| Yüzen «Bu sayfada» şeridi (2026-10-18) | ≥ 4 bağlantılı ilk `[data-toc]`: `behaviors.js › toc` menünün bağlantılarından `nav.tocdock` üretir (gövdeye eklenir, sayfa değişince silinir); menü kaydırmayla ekrandan çıkınca ekranın üstünde görünür, sayfa sonuna kadar kalır; «Başa dön» düğmesi. Stil: `60-pages.css › .tocdock` | Değişmez; şablon gerekmez (menüden türer). Editör bir şey yapmaz |
| Akıllı header + ilerleme çizgisi | `html.hdr-hidden`, `.hdr-hot` (üst kenar), `.prog > .prog__fill`; aşağı kaydırınca gizlenir, yukarı/üst kenar/fare/odak ile geri gelir | Değişmez. Wagtail kullanıcı çubuğu (staff) açıksa header `top` değeri buna göre ayarlanır |
| Ana sayfa başlığı + denetçi tikleri | `h1.hero__title[aria-label]` = `site.tagline`; satırlar `{% for w in site.tagline\|tagline_words %}` ile üretilir, her satır sonunda süs amaçlı `<i class="p" aria-hidden>` (tik; renk ve çizilme sırası CSS'te satır sırasına göre: mavi → kırmızı → yeşil) | Slogan `SiteSettings.tagline` (2–4 kısa öbek, virgülle ayrılı). Editör sloganı değiştirir; satır/tik kendiliğinden uyar. «Kapalı» katmanda ve JS yokken tikler hazır durur. `tests/hero.e2e.mjs` |
| Fare lensi (3B) | `world.js › LENS` (yalnızca «Tam» katman, hassas işaretçi); imleç ucunda küçük itme + parıltı; özel imleç/halka yok. Düğmelerde mıknatıs efekti yoktur | Değişmez. Boyutu `LENS` sabitlerinden ayarlanır |
| Sayfa geçişi («3B noktalar akar») | router: `world.surge` tıklanan noktadan dışa akar, yeni sayfanın şekline oturur («BORADEN» anı 2026-10-16'da ana sayfa kahramanı videoya geçince kaldırıldı) | Değişmez; «Kapalı» katmanda yoktur |
| İletişim bağlamı | `?hizmet=<id>`, `?sektor=<slug>`, `?kisi=<slug>` → formda «Seçilen hizmet / sektör / Görüşmek istenen kişi» satırı | Kimlikler sayfa slug'larıdır; `ContactTopic` + sayfa tipine göre bağlantı. Ön yüz değişmez |

---

## 8. SEO, erişilebilirlik ve yayın

- **Her sayfa tam, sunucuda üretilmiş HTML'dir** (JS olmadan okunur): tekil `<title>` (`titleFull`), `meta description`, tek `h1`, `canonical` (`full_url`), Open Graph, JSON-LD.
  Taslak/`noindex` sayfalar sitemap'e ve arama dizinine girmez.
- **Sitemap/robots:** statik sürümde `sitemap.xml` + `robots.txt` üretilir; `lastmod` yalnızca içeriğin kendi tarihi olan sayfalarda yazılır (yayın tarihi, hesaplayıcı parametre tarihi, vergi takvimi doğrulama tarihi, rapor kontrol tarihi — rota › `lastmod`), yapım günü kullanılmaz. Wagtail'de `wagtail.contrib.sitemaps` ile `last_published_at` kullanılmalı.
- **Arama açıklaması:** `meta description` / `og:description` en çok 160 karakter (`filters.mjs › metaDesc`: cümle sınırında kısaltır, görünür metin değişmez) → Wagtail `search_description` (boşsa aynı kısaltma bir şablon süzgeciyle). Sektör sayfası başlığı: «{ad}: Denetim ve Vergi — Boraden».
- **Yapılandırılmış veri ve paylaşım:** ana sayfa `WebSite` (+ `SearchAction` → `/arama/?q=`) ve `Organization` (`@id …/#organization`; Hakkımızda/İletişim ile aynı düğüm, `ld.mjs › orgNode`), `/hizmetler/` `CollectionPage` + `ItemList`; yazılar `og:type=article` (+ tarihi olanlarda `article:published_time`); `twitter:card` paylaşım görseli ≥ 1200 px ise `summary_large_image`, değilse `summary`.
- **Güvenlik başlıkları:** statik sürümde `vercel.json`. Wagtail'de aynı değerler: `django-csp` (veya ara katman) ile `Content-Security-Policy` — `default-src 'self'; script-src 'self' 'sha256-…'` (erken betik özeti; Wagtail'de nonce'a geçilebilir), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `font-src/connect-src/media-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` (mailto: kalkınca), `frame-ancestors 'self'`, `upgrade-insecure-requests`; **Wagtail yönetim paneli ve önizleme için ayrı, gevşek politika** (yönetim arayüzü satır içi betik kullanır). Ayrıca `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy`. `X-Robots-Tag: noindex` yalnızca canlı olmayan ortamlarda.
- **Yönlendirmeler:** `vercel.json › redirects` (sitenin kendi yeniden yapılanması + eski siteden 42 adres) → `wagtail.contrib.redirects` içine aktarılır (kalıcı/geçici ayrımı korunur; `/en/…` geçici). Büyük harfli/Türkçe karakterli elle yazılmış adresler statik sürümde 404 sayfasında istemcide düzeltilir (`modules/not-found.js`); Wagtail'de aynı kural bir ara katmanda (küçük harf + Türkçe karakter sadeleştirme → sayfa varsa 301) yapılabilir.
- **Erişilebilirlik güvenceleri** (testlerle doğrulanır, bkz. §10): sayfa başına tek `h1`, başlık atlaması yok, etiketsiz alan/adsız bağlantı yok, alt metin, dokunmatik hedef ≥ 24 px (düğme/çip/alan ≥ 40–44 px),
  klavye ile kullanılabilir menü/arama/SSS, `prefers-reduced-motion` → efektler «Kapalı», `aria-live` duyuruları (`#live`).
  Satır içi olmayan bağlantılar (kart/kişi adı, liste bağlantısı) 24 px altında kalıyorsa kalıp: `display:inline-block; padding-block:.3rem; margin-block:-.3rem; background-origin:content-box` — satır düzeni değişmez, yalnızca dokunma alanı büyür (`75-team.css` sonu, `65-services.css › .kunye dd a`).
- **Logo kuralı:** logo yalnızca `partials/logo.njk` ile (`logo.html`) gösterilir; resmî dosya değişmeden kullanılır. Vektörlü resmî dosya (SVG/PDF/Illustrator) geldiğinde yalnızca bu bileşen güncellenir.
- **Fotoğraflar:** `photos.json` (anahtar → boyutlar, `alt`, `old`) → Wagtail Image. `old: true` olanlar 2022 tarihli yer tutucudur; yeni fotoğraflar gelince Image koleksiyonunda değiştirilir (hizmet/alan/sayfa görsellerinde **insan yüzü yoktur**; ekip portreleri `person: true` ile işaretlidir ve yalnızca ekip sayfalarında kullanılır → Wagtail'de ayrı «Ekip portreleri» Image koleksiyonu).
  `makros.photo` → `{% image %}` + `srcset` (640/1200/1800/2400).
- **Çok dillilik:** TR öncelikli. EN ağacı için `wagtail-localize`; `hreflang` ve dil anahtarı ancak EN içerik hazır olunca açılmalı (ince/otomatik çeviri sayfa yayımlanmaz).

---

## 9. Önerilen taşıma sırası

1. Django + Wagtail iskeleti; `SiteSettings`; `base.html` + `header/footer/cta/logo` parçaları; `boraden_tags` (süzgeçler, `phero/photo/arrow` etiketleri).
2. Statik varlıklar: `npm run build:assets` (CSS birleştirme + esbuild JS paketi) → `static/`; yazı tipleri (`src/assets/fonts/`, adında içerik özeti; yeniden üretim `npm run fonts`) ve fotoğraflar.
3. Snippet modelleri + **içe aktarma komutları** (`manage.py import_boraden <json>`): her JSON dosyası için bir komut; `rich` regex'i RichText'e çevirir. Kimlikler (`id`, `slug`) olduğu gibi korunur.
4. Sayfa ağacı: §2'deki modeller, URL'ler birebir; `get_context()` içinde rota modüllerindeki türetilmiş veriler (sayılar, komşu notlar, ilgi matrisi, site ağacı).
5. Şablon dönüşümü: sıra → ana sayfa, hizmetler, sektörler, bilgi merkezi, araçlar, kurumsal, destek. Her şablonun başındaki «Wagtail karşılığı» yorumu alan listesidir.
6. Formlar (`AbstractEmailForm`), KVKK onayı, e-posta yönlendirme kuralı (`ContactTopic` → alıcı); `form-kit.js` gönderim adımı.
7. Arama dizini görünümü, `ParameterSet` JSON uç noktası, belge (PDF) koleksiyonu ve `wagtail.contrib.redirects` (eski adresler: boraden.com.tr).
8. Uçtan uca doğrulama (§10), ardından hukuki incelemeden geçen metinlerle `status = Yayında`.

---

## 10. Testleri Wagtail'de yeniden kullanma

| Araç | Ne yapar | Wagtail'de |
|---|---|---|
| `node tests/links.mjs` | `dist/` içindeki tüm iç bağlantıları/çapaları denetler | Statik dışa aktarma (`wagtail-bakery`/`wget --mirror`) ya da tarama sürümü ile |
| `node tests/audit.mjs --base=<url>` | Her sayfa için taşma, konsol/ağ hatası, başlık düzeni, alt metin, adsız bağlantı, yinelenen id, hedef boyutu | URL listesi `dist/` yerine `sitemap.xml`'den okunacak biçimde genişletilebilir (`--dist=` yerine liste dosyası) |
| `node tests/sheet.mjs` / `shot.mjs` | Tam sayfa/kaydırmalı ekran görüntüsü | Aynı |
| `node --test tests/*.test.mjs` | Hesaplayıcı motorları (146 test), arama puanlama, logo bütünlüğü (logolu fotoğraflar dahil), ekip kuralları (`team.test.mjs`), ters ilişkiler/fotoğraf havuzu/künye (`relations.test.mjs`), hizmet-alan-dizin-sektör çıktısı ↔ model (`services.test.mjs`) | Hesaplayıcı ve arama testleri aynen; `logo.test.mjs` şablon yollarını `logo.html`'e göre günceller; `services.test.mjs` `dist/` yerine dışa aktarılan çıktıya yöneltilir (`BORADEN_DIST`) |
| `node tests/hud.e2e.mjs`, `node tests/hero.e2e.mjs`, `node tests/services.e2e.mjs` | Bölüm göstergesi (elle/menüden türeyen, genişlik ve kademeler, router); ana sayfa başlığı tikleri (sırayla çizilme, kademeler, erişilebilirlik, yerleşim); hizmet/alan/dizin/sektör: tik animasyonu, Tam/Hafif/Kapalı/hareket azaltma, 390–1440 px taşma ve ızgara sütunları, gezinme, mobil «Bu sayfada» şeridi ve ≥ 24 px dokunma hedefleri | Aynı (URL tabanı değişir) |
| `node tests/forms.e2e.mjs` | Form doğrulama/mailto akışı (gerçek tarayıcı) | Gönderim adımı sunucuya taşınınca uç nokta beklentisi güncellenir |

---

## 11. Bilinen açık maddeler (taşımadan önce karara bağlanmalı)

- **Hukuki inceleme:** 4 yasal metin «Taslak»; BDY m.22 (bağımsızlık notu) ve m.23 (reklam yasağı) ifadeleri, KVKK/çerez/ETK metinleri, form onay metni, `[[Yer tutucu]]` alanları ve `reviewNotes` listeleri avukata gidecek.
- **Doğrulanacak parametreler** (`needsVerification`): tevkifat sınırı, asgari kurumlar vergisi tabanı, KDV Eylül tarihi, e-Defter tarihleri, kıdem/ihbar vergi ikincil kaynağı, SGDP vb.
- **Okuma notları** gerçek kişi adlarını (iktisatçılar) anar → editoryal/hukuki gözden geçirme; **blog** için `publicationDateVerified: false`.
- **Arşiv:** 4 kaydın tarihi, 2 kaydın numarası yok (`null`); gerçek belge üst verisinden tamamlanmalı.
- **Fotoğraflar** 2022 tarihli yer tutucudur. Ekranda logo görünen dört toplantı odası karesi (`meeting-logo`, `meeting-wide`, `handshake-group`, `handshake-group-2`) `photos.json` içinde `logo: true` ile işaretlidir → sitede hiçbir yerde kullanılmaz (`model.mjs` seçmez, `tests/logo.test.mjs` korur).
- **Ekip:** 25 kişi (3'ünün özgeçmişi eski siteden, 22'si kurum şemasından yalnızca ad/unvan/bölümle); hepsi `needsVerification: true`; kişiler hizmet alanlarına bölümleri üzerinden bağlıdır (`departments[].areas`); görev adından türetilen 8 açık hizmet ataması ve kimin hangi alan/hizmet/sektörde görüşmeye çıkacağı **öneridir** — müşteri onayı. Portre fotoğrafı: 6 kişi için arşivden etiketle eşleştirildi (çalışanların isteğiyle — proje sahibi bildirdi); kalan kişiler baş harf avatarıyla görünür.
- **Hizmet alanı fotoğraf eşleştirmesi** (`GROUP_PHOTOS`, `scripts/model.mjs`) ve **«Çalışma biçimimiz» metni** (`approach.json`) müşteri onayına tabidir.
- **Büyük dosyalar:** `src/assets/documents` ≈ 156 MB ve `dist` ≈ 181 MB → depoya eklemeden önce `.gitignore`/LFS veya harici depolama kararı.

---

## 12. Hizmet sayfası bileşenleri, ilişkiler ve ekip (Wagtail'de nasıl kurulur)

Hizmet, hizmet alanı, hizmetler dizini ve sektör sayfaları «düz yazı» görünmesin diye ortak bileşenlerle zenginleştirildi (`src/templates/partials/blocks.njk`, `65-services.css`).
**İlke: hiçbir bileşen elle yazılmış bilgi taşımaz** — her biri var olan bir alandan ya da sorgudan beslenir; Wagtail'de de aynı alanlar/sorgular kullanılır, editör yeni bir şey girmek zorunda kalmaz.
Bir bölümün verisi yoksa bölüm hiç çizilmez ve «Bu sayfada» menüsünden / bölüm göstergesinden de düşer.

### 12.1 Bileşenler

| Bileşen | Şablon | Beslendiği veri | Wagtail karşılığı | Editör ne yapar? |
|---|---|---|---|---|
| Künye şeridi («Ref. 01.06 · Alan · Kapsam · Süreç · Dayanak») | `blocks.kunye` | `ref` = alan no + hizmetin alandaki sırası; sayılar kapsam/adım/kaynak listelerinden | `ServicePage.get_context()` (sıra = kardeşler arasındaki yeri; sayılar liste uzunlukları) | Hiçbir şey; boş hücre görünmez. `Ref.` yalnızca gezinme etiketidir (hukuki/ticari anlamı yok) |
| Kapsam kartları (`.sgrid`) | `service.njk` | `scope[]` | StreamField/Orderable `ScopeItem` (başlık + metin) | Madde ekler/siler; 1–6 madde için ızgara kendini düzenler (`sgrid--N`) |
| Fotoğraf bandı (`.sfig`) | `blocks.figure` | `photo` (isteğe bağlı) → yoksa alanın havuzundan sırayla (§12.3) | `ServicePage.photo` / `ServiceAreaPage.photo` (görsel seçici) | İsterse seçer; boş bırakırsa havuzdan gelir |
| Süreç (`.flow`) | `service.njk` | `steps[]` (varsa) | Orderable `ProcessStep` | Madde ekler; hiç yoksa bölüm çizilmez |
| Çıktı / hazırlık | `service.njk` | `output`, `prepare[]` | `output` (metin) + `prepare` (liste) | — |
| Sık sorulanlar | `service.njk` | hizmetin kendi SSS'i + **genel SSS** (`faq.json › items[].onServices: true`) | kendi SSS: InlinePanel; genel: `FaqItem.show_on_services` (onay kutusu) | Genel bir soruyu işaretler → tüm hizmet ve alan sayfalarında «Çalışma biçimimiz hakkında» altında çıkar |
| İlgili içerik (`.rel`) | `blocks.related` | **hesaplanır**: sektör (SectorPage.services tersi), hesaplayıcı (`relatedServices`), terim (`GlossaryTerm.services`), yazı (`PublicationPage.service`; yalnızca yayımlanmış) | ters ilişki sorguları (`ServicePage.get_context()`; mantık: `scripts/relations.mjs`) | Hiçbir şey: ilişkiyi karşı tarafta (sektör/araç/terim/yazı) kurar, bu sayfada kendiliğinden görünür |
| Alan sayfası: birleşik SSS | `service-area.njk` | alandaki hizmetlerin SSS'lerinden tekrarsız ilk 6 soru (`MAX_AREA_FAQ`) + genel SSS | `ServiceAreaPage.get_context()` | — |
| Alan sayfası: ilgili sektör/hesaplayıcı | `blocks.related` (`showCount`) | alandaki hizmetleri anan sektörler (kaç hizmetle anıldığı sayaçlı) + ilgili araçlar | ters ilişki sorgusu | — |
| «Çalışma biçimimiz» bandı | `blocks.method` | `approach.json` (3 adım) + `about.principles` | site ayarı `ApproachSettings` | Site ayarlarından düzenler; tüm hizmet/alan sayfalarında değişir |
| «İlgili ekip» bandı | `people.band` | atama kuralları (§12.5) | `TeamMemberPage` ilişkileri | Kişiyi hizmet/alan/sektöre atar |
| Alan kartları (dizin) | `services-index.njk` | `groups[]` + hizmet sayısı + alan fotoğrafı | `ServiceIndexPage.get_context()` (alt sayfa sayımı) | — |

### 12.2 İlişkiler hesaplanır, girilmez

`scripts/relations.mjs` yalnızca **tek yönlü** kaynak kayıtlarından (sektör → hizmetler, hesaplayıcı → hizmetler, terim → hizmetler, yazı → hizmet) ters ilişkileri üretir. Wagtail'de bunlar gerçek FK/M2M olduğundan
ters sorgu (`related_name`) yeterlidir. Kurallar: yalnızca **yayımlanmış** sayfalar (`.live().public()`); aynı soru iki kez gelmez (küçük harf, sondaki `?`/`.` atılarak karşılaştırılır); alan sayfası SSS'i en çok 6 soru;
sayılar her zaman sorgudan gelir. Statik derlemede bilinmeyen bir hizmet kimliği derlemeyi hatayla durdurur (`relationIssues`); Wagtail'de bu denetim zaten yabancı anahtar kısıtıdır.

### 12.3 Fotoğraflar

Alan karesi ve hizmet karesi **arşiv fotoğraflarıdır** (süs amaçlı: `alt=""`, bilgi taşımaz; altyazı «Boraden arşivi»). Seçim sırası: hizmette açık `photo` → yoksa alanın havuzundan sırayla (`i % havuz`) (`GROUP_PHOTOS`, `scripts/model.mjs`).
Wagtail'de: `ServiceAreaPage.photo` ve `ServicePage.photo` (görsel seçici, zorunlu değil); boşsa görünüm havuzdan seçer. Havuz eşleştirmesi bir **öneridir** (müşteri onayı). Ekranda logo görünen kareler (`photos.json › logo: true`) hiçbir koşulda seçilemez;
Wagtail'de bunlar ayrı bir «Logolu kareler (kullanılmaz)» Image koleksiyonuna konmalı ve görsel seçici bu koleksiyonu dışlamalıdır. Hizmet/alan görsellerinde insan yüzü bulunmaz; ekip portreleri (`photos.json › person: true`) alan/hizmet fotoğrafı olarak seçilemez (`model.mjs › photoOk`).

### 12.4 «Denetçi tiki» tasarım dili

Firmanın logosundaki üç tikten esinlenen, denetçilerin çalışma kâğıdındaki «kontrol edildi» işaretidir: ana sayfa başlığında («Tam ✓ doğru ✓ zamanında ✓» — sloganın üç öbeğinin sonunda), bölüm başlıklarının önünde (mavi → kırmızı → yeşil döngüsü), künyedeki `Ref.` hücresinde, fotoğraf altyazısında, kapsam/hazırlık listelerinde ve
«Nasıl başlarız?» adımlarında. CSS maskesidir (`--tick`, `65-services.css`) — **resmî logo dosyasına dokunulmaz**, logo yalnızca `partials/logo.njk` ile gösterilir. Başlıktaki tik görünür olunca soldan sağa çizilir (`.svc__label[data-reveal].is-in`),
süreç adımlarındaki tikler kaydırdıkça dolar (`[data-steps]` → `--p`). «Kapalı» katmanda ve JS yokken hepsi çizili görünür. Yeni bir şablonda bölüm başlığı `class="svc__label mono" data-reveal` olmalıdır.

### 12.5 Ekip: bileşenler ve atama kuralları

`team.json` → `TeamIndexPage` + `TeamMemberPage` (§3). Atama kuralları kodla değil **veriyle** yönetilir (`scripts/team.mjs` başlık yorumu; Wagtail'de model yöntemi olarak aynen kurulur):
hizmet kişileri = hizmete açıkça atananlar + hizmetin alanının sorumluları + bölümü o alana bağlı kişiler (en çok 3); alan kişileri = alan sorumluları + alandaki hizmetlerin en az ikisine atananlar + bölümü o alana bağlı kişiler (en çok 4, en az 2'ye tamamlanır); bölüm bağıyla gelenler bölümler arasında dönüşümlü sıralanır (her bölümün ilk kişisi önce);
sektör kişileri = sektöre açıkça atananlar (en çok 4); yoksa sektörün hizmetlerini üstlenenlerden türetilir. Kimsesi olmayan alanda ekip bandı çizilmez. Bağlantılar iletişim formunu `?kisi=<slug>` ile açar.
Yayın durumu üye başına (`status`); `needsVerification` olan kayıtlar yönetim panelinde sarı uyarıyla gösterilmelidir (`verify_note` yalnızca editörde görünür).
Ekibimiz sayfası `departments` sırasıyla (sıra = listedeki sıra) bölüm başlıkları altında kompakt kişi satırlarıdır (`.tm-dept` / `.prow`); `has_profile: false` kişinin kendi sayfası/URL'si yoktur (`/hakkimizda/ekibimiz/#<slug>`), Wagtail'de `serve()` bu kişiler için dizin sayfasına yönlendirir; site haritası, JSON-LD listesi ve önceki/sonraki gezinmesi yalnızca profil sayfası olanları kullanır (`team.profiles`).
«İlgili ekip» bandı yalnızca ataması ya da bölüm bağı olan kişilerden oluşur; kimsesi olmayan alan/hizmette bant çizilmez, «Kimle görüşmeli?» listesinde «İletişim formu» bağlantısı görünür (2026-10-06 itibarıyla her alanda en az bir kişi var). Ekibimiz sayfasında bölüm başlığının altında bağlı hizmet alanının bağlantısı yer alır (`TeamDepartment.areas`).

### 12.6 Blog yazıları nasıl yayınlanır (editör akışı)

Blog, duyuru, haber ve sirküler aynı sayfa türüdür: `PublicationPage` (§3). Editör akışı:

1. Wagtail yönetim paneli › **Sayfalar › Bilgi Merkezi › Blog** › «Alt sayfa ekle» › **Yayın sayfası**.
2. Alanlar: başlık, özet, tarih (+ «tarih doğrulandı» onay kutusu), kategori, **gövde** (StreamField: paragraf, ara başlık, alıntı, liste — satır içi `**kalın**` ve `[etiket](adres)` işaretlemesi), kaynaklar (etiket + adres listesi), **ilgili hizmet** (ServicePage seçici), yayın türü, SEO başlığı/açıklaması.
3. «Taslak olarak kaydet» → **Önizleme** (aynı şablonla canlı görünüm) → **Yayınla**; isteğe bağlı yayın/yayından kaldırma zamanlaması.
4. Yayımlanınca blog listesi, sekmeler, arama dizini, sitemap ve **ilgili hizmet sayfasındaki «İlgili içerik › Yazılar» satırı** kendiliğinden güncellenir (elle bağlantı eklenmez).

Tasarım korunur: editör HTML/yerleşim görmez, gövde bloğu yalnızca onaylı bileşenleri sunar. Yazar kartı için `PublicationPage.author → TeamMemberPage` (isteğe bağlı FK) eklenebilir; şablonda kompakt kişi kartı (`people.njk › mini` ve `inline`) hazırdır, bugünkü yazılarda yazar verisi olmadığı için gösterilmez.
