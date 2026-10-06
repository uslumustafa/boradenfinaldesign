#!/usr/bin/env python3
"""Arşiv fotoğraflarından site görsellerini üretir (webp, birden çok genişlik) ve src/data/photos.json'u günceller.

kullanım: python3 scripts/tools/archive-photos.py [anahtar ...]     (anahtar verilmezse SPECS'in tamamı)
  Kaynak: BORADEN_ARCHIVE ortam değişkeni, yoksa ~/Downloads/boradenphoto (kullanıcının arşiv klasörü).
  Çıktı : src/assets/img/photos/<anahtar>-<genişlik>.webp  +  photos.json satırı (w/h en-boy oranını korur).
Gereken: python3 + Pillow (webp desteğiyle).

Seçim kuralları (müşteri geri bildirimi, Ekim 2026): hizmet alanı görsellerinde insan yüzü olmaz; toplu ekip fotoğrafı kullanılmaz;
ekranda/duvarda logo görünen kareler seçilmez (kâğıt/kırtasiye üstündeki küçük resmî logo sorun değildir).
Fotoğraflar arşivdeki gerçek karelerdir; yeni fotoğraflar geldiğinde yalnızca SPECS güncellenir."""
import json
import os
import sys

from PIL import Image, ImageOps

ARCHIVE = os.path.expanduser(os.environ.get("BORADEN_ARCHIVE", "~/Downloads/boradenphoto"))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "src/assets/img/photos")
MANIFEST = os.path.join(ROOT, "src/data/photos.json")
Y19 = "FOTOĞRAF_ 01.01.2019/Karma/"
Y22 = "FOTOĞRAF_ 16.11.2022/"

# anahtar → kaynak (arşive göre), alt metin, genişlikler; isteğe bağlı: crop = (sol, üst, sağ, alt) oranları, old = eski çekim işareti
SPECS = {
    "desk-calc-chart": dict(src=Y19 + "_76A0091a.jpg", alt="Masa üstünde klavye, hesap makinesi ve grafikli bir rapor; yukarıdan görünüm"),
    "desk-keyboard-chart": dict(src=Y19 + "_76A0101a.jpg", alt="Klavye, hesap makinesi ve grafikli rapor üzerinde kalemle çalışan el; detay"),
    "reading-coffee": dict(src=Y19 + "_76A0115aa.jpg", alt="Pencere önünde elinde kahve ve rapor kitapçığı tutan çalışan; detay"),
    "meeting-room-long": dict(src=Y19 + "_76A9664a_5a_6a_Interior.jpg", alt="Uzun toplantı masası, telefon ve duvarda ekran bulunan boş toplantı odası"),
    "meeting-room-glass": dict(src=Y19 + "_76A9673a_4a_5a_Natural.jpg", alt="Cam ve ahşap çıtalı bölmeli toplantı odası; toplantı masası ve sandalyeler"),
    "reception-lounge": dict(src=Y19 + "_76A9700a_1a_2a_Natural.jpg", alt="Karşılama alanı: resepsiyon bankosu, renkli koltuklar ve taş kaplı duvarda ekran"),
    "open-office-wide": dict(src=Y19 + "_76A9718a_19a_20a_Natural.jpg", alt="Açık ofis çalışma alanı; çalışma masaları, bilgisayar ekranları ve geniş pencereler"),
    "open-office-desk": dict(src=Y19 + "_76A9709a_10a_11a_Natural.jpg", alt="Açık ofiste çalışma masaları, bilgisayar ekranları ve dolaplar"),
    "open-office-slats": dict(src=Y19 + "_76A9724a_5a_6a_Natural.jpg", alt="Ahşap çıtalı bölmenin yanında açık ofis çalışma alanı"),
    "desk-monitor-top": dict(src=Y22 + "2_Kurumsal Kimlik/DSC_9588.JPG", alt="Çalışma masasında hesap tablosu açık ekran, klavye, hesap makinesi ve kalemlik; yukarıdan görünüm"),
}

# ——— Ekip portreleri (yalnızca ekip sayfaları). Eşleştirme YALNIZCA klasör/dosya etiketiyle yapılır (yüz tanıma yok):
#   Murat Demirtaş, Suat Bozkurt, Hazal Kesbiç → 4_Photoshoplu Fotoğraflar/FOTOĞRALAR VE ÜNVANLAR.xlsx (ad → dosya numarası)
#   Cengiz Turmaz → 8_Aktif Çalışanların Fotoğrafları/Cengiz TURMAZ · Adem Başer, Çisem Güler → FOTOĞRAF_ 01.01.2021 altında aynı adlı klasör.
#   (Arşivdeki «Çisem ESKİCİ» ve «Gönül ÖZTÜRK» klasörleri şemadaki «Çisem Güler» / «Gönül Ak» ile aynı kişi mi, müşteriden teyit gerekir;
#    teyit gelmeden kullanılmadı.) box = (yatay merkez, üst, genişlik) — görüntü genişliğine oranlar; kırpma 4:5, baş-omuz.
# Yayın şartı: kişinin yazılı rızası (KVKK) — photos.json'da person: true; team.json'da kişi kaydında doğrulama notu.
PORTRAIT_SIZES = [320, 640]
PORTRAITS = {
    "person-cengiz-turmaz": dict(src=Y22 + "8_Aktif Çalışanların Fotoğrafları/Cengiz TURMAZ/DSC_9700.JPG", box=(0.50, 0.055, 0.52)),
    "person-murat-demirtas": dict(src=Y22 + "4_Photoshoplu Fotoğraflar/DSC_8747.jpg", box=(0.47, 0.05, 0.52)),
    "person-suat-bozkurt": dict(src=Y22 + "4_Photoshoplu Fotoğraflar/DSC_8983.jpg", box=(0.50, 0.05, 0.52)),
    "person-hazal-kesbic": dict(src=Y22 + "4_Photoshoplu Fotoğraflar/DSC_9399.jpg", box=(0.50, 0.055, 0.52)),
    "person-adem-baser": dict(src="FOTOĞRAF_ 01.01.2021/Adem Başer/DSC_4935.JPG", box=(0.52, 0.10, 0.62)),
    "person-cisem-guler": dict(src="FOTOĞRAF_ 01.01.2021/Çisem Güler/DSC_4019.JPG", box=(0.54, 0.185, 0.60)),
}
NAMES = {
    "person-cengiz-turmaz": "Cengiz Turmaz", "person-murat-demirtas": "Murat Demirtaş", "person-suat-bozkurt": "Suat Bozkurt",
    "person-hazal-kesbic": "Hazal Kesbiç", "person-adem-baser": "Adem Başer", "person-cisem-guler": "Çisem Güler",
}
for _k, _s in PORTRAITS.items():
    SPECS[_k] = dict(_s, sizes=PORTRAIT_SIZES, nominal=640, quality=82, person=True, alt=f"{NAMES[_k]}, portre")
SIZES = [640, 1200, 1800]
QUALITY = 78
# photos.json'dan çıkarılan kareler (Ekim 2026 geri bildirimi): yüzleri görünen kareler ve toplu ekip fotoğrafı. Dosyaları _to_delete/ içine taşıyın.
REMOVE = ["handshake-close", "office-0313", "office-0316", "office-0329", "team-lobby"]


def render(key, spec):
    path = os.path.join(ARCHIVE, spec["src"])
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if spec.get("crop"):
        l, t, r, b = spec["crop"]
        im = im.crop((round(l * im.width), round(t * im.height), round(r * im.width), round(b * im.height)))
    if spec.get("box"):  # 4:5 baş-omuz kırpması: (yatay merkez, üst, genişlik) — hepsi görüntü boyutuna oranlı
        cx, top, wf = spec["box"]
        cw = wf * im.width
        l, t = cx * im.width - cw / 2, top * im.height
        im = im.crop((round(l), round(t), round(l + cw), round(t + cw * 1.25)))
    sizes = [s for s in spec.get("sizes", SIZES) if s <= im.width]
    for s in sizes:
        h = round(im.height * s / im.width)
        im.resize((s, h), Image.LANCZOS).save(os.path.join(OUT, f"{key}-{s}.webp"), "WEBP", quality=spec.get("quality", QUALITY), method=6)
    nominal = spec.get("nominal", 2000)
    entry = {"w": nominal, "h": round(nominal * im.height / im.width), "sizes": sizes, "alt": spec["alt"], "old": spec.get("old", True)}
    if spec.get("person"):
        entry["person"] = True
    return entry


def write_manifest(entries, remove):
    data = json.load(open(MANIFEST, encoding="utf-8"))
    for k in remove:
        data.pop(k, None)
    data.update(entries)
    lines = []
    for k, v in data.items():
        if isinstance(v, dict):
            body = ", ".join(f'"{kk}": {json.dumps(vv, ensure_ascii=False)}' for kk, vv in v.items())
            lines.append(f'  "{k}": {{ {body} }}')
        else:
            lines.append(f'  "{k}": {json.dumps(v, ensure_ascii=False)}')
    open(MANIFEST, "w", encoding="utf-8").write("{\n" + ",\n".join(lines) + "\n}\n")


if __name__ == "__main__":
    keys = sys.argv[1:] or list(SPECS)
    entries = {}
    for k in keys:
        entries[k] = render(k, SPECS[k])
        print("ok", k, entries[k]["w"], entries[k]["h"], entries[k]["sizes"])
    write_manifest(entries, REMOVE)
    print("photos.json güncellendi")
