# Boraden — web sitesi (ön yüz)

Boraden Bağımsız Denetim ve Danışmanlık A.Ş. kurumsal web sitesinin ön yüzü.
Statik üretim (Nunjucks + esbuild); şablon ve veri yapısı Wagtail'e birebir taşınabilecek biçimde kurulmuştur.

- 142 sayfa: ana sayfa, 8 hizmet alanı + 60 hizmet, 10 sektör, ekip, bilgi merkezi, 11 hesaplayıcı, hakkımızda, kariyer, iletişim, arama.
- Kalıcı 3B parçacık «dünya» (three.js), sayfa geçişleri, efekt kademeleri (Tam / Hafif / Kapalı) ve erişilebilirlik kuralları.
- Fotoğraflar yalnızca şirket arşivinden; resmî logo tek bileşenle gösterilir.

## Çalıştırma

Gereksinim: Node 22+.

```
npm install
npm run dev          # http://127.0.0.1:4181 — src/ ve scripts/ değişince yeniden derler
npm run build:prod   # dist/ (küçültülmüş; her hatada durur)
npm test             # birim testleri
npm run test:e2e     # tarayıcı testleri (çalışan bir sunucu gerekir; Chrome kurulu olmalı)
npm run links        # dist/ içindeki tüm iç bağlantıları denetler
npm run audit        # tüm sayfaları tarayıcıda tarar (taşma, konsol, erişilebilirlik)
```

## Klasörler

| Yol | İçerik |
|---|---|
| `src/templates/` | Nunjucks şablonları (`layouts`, `pages`, `partials`) |
| `src/data/` | Tüm içerik JSON olarak (hizmetler, sektörler, ekip, sözlük, SSS, hesaplayıcı tanımları, yıllık parametreler) |
| `src/assets/` | CSS (`css/`), JS (`js/`), yazı tipleri, görseller, video, sirküler PDF arşivi |
| `src/calc/` | Hesaplayıcı çekirdeği (saf JS; bordro ve vergi motorları) |
| `scripts/` | Derleme, geliştirme sunucusu, rotalar, model ve ilişkiler |
| `tests/` | Birim, tarayıcı (e2e) ve tarama araçları |
| `docs/` | Devir notu, tasarım özeti, UX denetimi, hesaplayıcı belgeleri |
| `WAGTAIL_MAP.md` | Şablon/veri → Wagtail modeli eşlemesi ve blog yayın akışı |

## Belgeler

- `docs/HANDOFF.md` — durum, doğrulama araçları, değişmeyen kurallar, müşteriden beklenenler
- `docs/HOME-REDESIGN.md` — ana sayfa tasarımı ve ayar rehberi
- `docs/FORMASYONLAR.md` — parçacık şekilleri (formasyonlar) kataloğu ve sahne eşlemesi
- `docs/VERCEL.md` — müşteri önizlemesi için Vercel yayını (kurulum, erişim, güncelleme)
- `docs/UX-DENETIMI-2026-10.md` — sayfa tipleri için UX denetimi ve uygulama durumu
- `docs/CALCULATORS-bordro.md`, `docs/CALCULATORS-vergi.md` — hesaplayıcı kuralları ve yıllık güncelleme listesi
- `WAGTAIL_MAP.md` — Wagtail'e taşıma haritası

## Durum

Ön yüz tamamdır. Arka uç (Python/Wagtail) bilerek yazılmamıştır; müşteri tasarımı onayladıktan sonra başlanacaktır.
Ekip bilgileri, hukuki metinler ve bazı parametreler yayın öncesi doğrulama bekler (ayrıntı: `docs/HANDOFF.md` §6).
