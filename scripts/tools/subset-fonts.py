#!/usr/bin/env python3
"""Yazı tipleri (T-17): Fontsource'un latin ve latin-ext dosyaları her yüz için tek bir dosyada birleştirilir ve Türkçe
içeriğin gerektirdiği karakterlere indirilir. Önceden her yüz iki dosyaydı (Türkçe metinde ğ, ş, ı, İ latin-ext'ten gelir):
sayfa başına 13–16 dosya ≈ 240–310 KB. Şimdi yüz başına bir dosya.

Aileler: aşağıdaki FAMILIES (Open Sans + STIX Two Text italik). Kapsam: Temel Latin + Latin-1 (Ç Ö Ü Â Î Û…), Latin Genişletilmiş-A (Ğ ğ İ ı Ş ş ve Avrupa dilleri), genel noktalama
(– — ‘ ’ “ ” … ‐ ‑), para birimleri (₺ €), ™, ok ve eksi işaretleri, birleşik işaretler. Glif biçimleri değişmez (aynı
yazı tipinden alt küme); harf aralığı (kerning) ve OpenType özellikleri korunur.

Çıktı: src/assets/fonts/<aile>-<ağırlık>-<biçem>.<özet8>.woff2 (adında içerik özeti: tarayıcı süresiz önbellekleyebilir),
src/assets/fonts/fonts.json (yüz → dosya; derleme önyükleme bağlantıları için okur) ve src/assets/css/00-fonts.css.
Gerekenler: Python 3, fonttools, brotli (pip install fonttools brotli). Çalıştırma: npm run fonts
"""
import hashlib
import io
import json
import os
import sys
import tempfile

try:
    import brotli  # noqa: F401 — woff2 sıkıştırması için gerekli
    from fontTools import merge, subset
    from fontTools.ttLib import TTFont
except ImportError as e:  # pragma: no cover
    sys.exit(f'Gerekli Python paketi yok ({e}). Kurulum: pip install fonttools brotli')

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NM = os.path.join(ROOT, 'node_modules', '@fontsource')
OUT_FONTS = os.path.join(ROOT, 'src', 'assets', 'fonts')
OUT_CSS = os.path.join(ROOT, 'src', 'assets', 'css', '00-fonts.css')

# Yazı tipleri Deloitte'un sitesindekilerle aynı aileler (müşteri isteği, Ekim 2026; deloitte.com stil dosyası incelendi):
# Open Sans her yerde (başlık, metin, düğme, etiket) ve vurgu için STIX Two Text italik (Deloitte'ta «secondary-font»).
# İkisi de SIL Open Font License; Deloitte'un kendi simge yazı tipi (Dcom-EDE) kullanılmaz.
FAMILIES = [
    ('Open Sans', 'open-sans', ['300', '300-italic', '400', '400-italic', '500', '600', '600-italic', '700']),
    ('STIX Two Text', 'stix-two-text', ['400-italic']),
]

# unicode-range ile aynı kapsam (tarayıcı bu aralık dışındaki karakter için yedek yazı tipine geçer)
RANGES = [
    (0x0000, 0x00FF), (0x0100, 0x017F), (0x0192, 0x0192), (0x0218, 0x021B), (0x02BB, 0x02BC), (0x02C6, 0x02C7),
    (0x02D8, 0x02DD), (0x0300, 0x0308), (0x030A, 0x030C), (0x0327, 0x0329), (0x2000, 0x206F), (0x20A0, 0x20C0),
    (0x2113, 0x2113), (0x2116, 0x2116), (0x2122, 0x2122), (0x2190, 0x2193), (0x2212, 0x2212), (0x2215, 0x2215),
    (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD),
]
UNICODE_RANGE = ','.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in RANGES)


def build_face(pkg, variant, tmp):
    weight, _, style = variant.partition('-')
    style = style or 'normal'
    parts = []
    for sub in ('latin', 'latin-ext'):
        src = os.path.join(NM, pkg, 'files', f'{pkg}-{sub}-{weight}-{style}.woff2')
        f = TTFont(src, recalcTimestamp=False)  # ara dosyada da kaynak zamanı korunur
        f.flavor = None
        p = os.path.join(tmp, f'{pkg}-{sub}-{weight}-{style}.ttf')
        f.save(p)
        parts.append(p)
    merged = merge.Merger().merge(parts)
    # Tekrar üretilebilirlik: birleştirici ve kaydetme head.created/modified alanlarına o anki zamanı yazar; kaynak yazı
    # tipinin zamanı korunur. Aynı girdi → aynı dosya → aynı ad (yoksa her çalıştırmada adlar ve önbellek boşuna değişir).
    head0 = TTFont(parts[0])['head']
    merged['head'].created = head0.created
    merged['head'].modified = head0.modified
    merged.recalcTimestamp = False
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.recalc_timestamp = False
    opts.flavor = 'woff2'
    unicodes = [u for a, b in RANGES for u in range(a, b + 1)]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(merged)
    buf = io.BytesIO()
    merged.flavor = 'woff2'
    merged.save(buf)
    data = buf.getvalue()
    digest = hashlib.sha256(data).hexdigest()[:8]
    name = f'{pkg}-{weight}-{style}.{digest}.woff2'
    with open(os.path.join(OUT_FONTS, name), 'wb') as fh:
        fh.write(data)
    return weight, style, name, len(data)


def main():
    os.makedirs(OUT_FONTS, exist_ok=True)
    # eski çıktılar (bu betiğin ya da eski vendor-fonts.mjs'in) kaldırılır: yalnızca .woff2 ve fonts.json
    old = [f for f in os.listdir(OUT_FONTS) if f.endswith('.woff2') or f == 'fonts.json']
    css = ['/* Otomatik üretildi: scripts/tools/subset-fonts.py (npm run fonts) — Open Sans ve STIX Two Text italik (SIL OFL),',
           '   Deloitte sitesindeki yazı tipi aileleri. Yüz başına tek dosya: latin + latin-ext birleşik, Türkçe için alt küme;',
           '   dosya adında içerik özeti var (süresiz önbellek). */']
    manifest = {}
    total = 0
    new = set()
    with tempfile.TemporaryDirectory() as tmp:
        for family, pkg, variants in FAMILIES:
            lic = os.path.join(NM, pkg, 'LICENSE')
            with open(lic, 'rb') as a, open(os.path.join(OUT_FONTS, f'{pkg}.LICENSE'), 'wb') as b:
                b.write(a.read())
            for v in variants:
                weight, style, name, size = build_face(pkg, v, tmp)
                new.add(name)
                total += size
                manifest[f'{pkg}-{weight}-{style}'] = f'/assets/fonts/{name}'
                css.append('')
                css.append('@font-face {')
                css.append(f"  font-family: '{family}';")
                css.append(f'  font-style: {style};')
                css.append('  font-display: swap;')
                css.append(f'  font-weight: {weight};')
                css.append(f"  src: url(/assets/fonts/{name}) format('woff2');")
                css.append(f'  unicode-range: {UNICODE_RANGE};')
                css.append('}')
    for f in old:
        if f not in new and f != 'fonts.json':
            os.remove(os.path.join(OUT_FONTS, f))
    with open(os.path.join(OUT_FONTS, 'fonts.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    with open(OUT_CSS, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(css) + '\n')
    print(f'yazı tipleri: {len(new)} dosya, {total // 1024} KB; css {OUT_CSS}')


if __name__ == '__main__':
    main()
