# Ana sayfa v2.0 yedeği (2026-10-01, v2.1 yeniden kurulumundan önce)

Git'te izlenmediği için v2.0'ın ana sayfaya özgü dosyaları burada saklanır. v2.1'e dönüş yapmak yerine ayarlamak önerilir (bkz. `docs/HOME-REDESIGN.md`);
geri dönmek gerekirse dosyalar aşağıdaki yerlere kopyalanır (video, açılış ve `opening.js`/`modules/film.js` kullanılmaz hale gelir, kalabilir).

| Yedek | Hedef |
|---|---|
| `home.njk` | `src/templates/pages/home.njk` |
| `50-home.css` | `src/assets/css/50-home.css` |
| `base.njk` | `src/templates/layouts/base.njk` |
| `behaviors.js` | `src/assets/js/behaviors.js` |
| `main.js` | `src/assets/js/main.js` |
| `world.js`, `formations.js` | `src/assets/js/world/` |
| `fx.js` | `src/assets/js/fx.js` |

Not: v2.1'de `partials/cta.njk` (ilk sütun `cta__main`) ve `30-layout.css` kapanış bandı düzeni de değişti; v2.0 ana sayfası bunlarla da çalışır (yalnızca iletişim bilgileri soldaki sütunda kalır).
