#!/usr/bin/env python3
"""Boraden ana sayfa kahraman videosu («Tam doğru zamanında» alanı) — yeniden üretim betiği (Ekim 2026).

Kaynak: müşterinin gönderdiği ofis çekimi (boradenkirpilmis.mp4 — 4K HEVC 10 bit HLG, 10,6 sn, 180° döndürülmüş kayıt;
depoda tutulmaz). Kurgu kararları — 20 Ekim 2026 (müşteri: «insan yüzü görünmesin; tam ofise girdiğimizde, kapıdan giriş anında dursun»;
proje sahibinin seçtiği an: ofis alanına geçerken, kimse görünmeden):
  • Süre: 0.–229. kareler (≈ 7,7 sn; END). Video, resepsiyondan ofis alanına açılan geçişin önünde biter; ilk kişi 235. karede belirmeye
    başlar (bölmenin üstünde bir baş), 237. karede açıkça görünür. Bitiş karesi ilk kişiden 6 kare önce ve yakınındaki en net karedir
    (kamera hareketli; 230–234. kareler daha bulanık). Döngü yok: video bir kez oynar ve son karede durur (hero-film.js), bu yüzden
    sonda lacivert geçiş yoktur; başta 0,35 sn lacivertten açılış kalır (ziyaretçi yeniden oynatınca baştan başlar).
  • Önceki karar (15 Ekim 2026: «eski çalışanlar görünmesin», «kısaltma»): 10,6 sn'nin tamamı, eski çalışan kadrajla dışarıda; aşağıdaki
    kadraj ve renk ayarları aynen sürer (ilk 230 kare önceki videoyla birebir aynıdır).
  • SDR: HLG → doğrusal → BT.709 ana renkler, mobius ton eşleme; 8 bit'e hata yayınımlı titreme (ekranlarda bantlanma olmasın).
  • Kadraj: ilk 5 sn tam kare (giriş tabelası «BORADEN · Bağımsız Denetim ve Danışmanlık A.Ş.» eksiksiz görünür); 150. kareden (≈ 5,0 sn)
    sonra sola yaslı, yavaş bir itme (150.–258. karelere yayılan 1,0× → 1,52× itme; video 229. karede, ≈ 1,46×'dayken biter). Önceki
    tam süreli kurguda itme, klibin sonunda sağda kalan eski çalışanı (x ≥ 1308/1920), yanındaki çocuğu ve sağdan yürüyen kişiyi kadraj
    dışında tutuyordu. Görüntüde rötuş yoktur, yalnızca kadraj. Kırpma alt piksel hassastır (OpenCV warpAffine): ffmpeg'in crop/zoompan
    süzgeçleri tam piksele yuvarladığı için itme sırasında görüntü titrer.
  • Renk: sitenin laciverdiyle uyumlu, hafif soğuk ve az doygun (eq + colorbalance). Başta 0,35 sn lacivert (#08132a) açılış.
  • Çıktı (src/assets/video/): boraden-giris-v2-1080.mp4 ve boraden-giris-v2-720.mp4 (H.264 High, sessiz, BT.709 etiketli, faststart;
    adı her yeni kurguda değişir: /assets/video/ bir gün önbellekte kalır — vercel.json);
    boraden-giris-poster-1920/1280/768.webp (videonun 27. karesi ≈ 0,9 sn — ilk oynatma bu kareden başlar: hero-film.js › POSTER_T).
Gereken: ffmpeg (zscale + tonemap süzgeçleri; Homebrew: /opt/homebrew/bin/ffmpeg), python3 + numpy + opencv-python.
Kullanım: python3 scripts/tools/hero-film.py [kaynak.mp4] [--out=klasör]
          (varsayılan kaynak ~/Downloads/boradenkirpilmis.mp4; ffmpeg yolu FFMPEG ortam değişkeniyle değiştirilebilir)
"""
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
FF = os.environ.get('FFMPEG', '/opt/homebrew/bin/ffmpeg')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
SRC = args[0] if args else os.path.expanduser('~/Downloads/boradenkirpilmis.mp4')
OUT = next((a[6:] for a in sys.argv[1:] if a.startswith('--out=')), os.path.join(REPO, 'src', 'assets', 'video'))

W4, H4 = 3840, 2160          # kaynak (döndürme düzeltildikten sonra)
OW, OH = 1920, 1080          # çıktı
ZA, ZB = 150, 258            # itmenin başladığı / bittiği kare (itme eğrisi önceki tam süreli kurguyla aynı kalsın diye 258)
END = 229                    # son kare (dahil): ofis alanına geçiş, kimse görünmeden (ilk kişi 235. karede belirmeye başlar)
Z0, ZMAX = 1.0, 1.52         # yakınlık: başta (tam kare) / itmeden sonra
FPS_IN = '29.934'            # kaynak kare hızı (318 kare / 10,62 sn); çıktı 29,97 sabit
POSTER_AT = 27               # poster karesi (≈ 0,9 sn)
NAVY = '0x08132a'            # --navy-950
TONEMAP = ('zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=250,format=gbrpf32le,'
           'zscale=p=bt709,tonemap=mobius:param=0.5:desat=0,'
           'zscale=t=bt709:m=bt709:r=pc:d=error_diffusion,format=rgb24')
GRADE = ('eq=contrast=1.06:brightness=-0.02:saturation=0.88:gamma=0.96,'
         'colorbalance=rs=-0.03:bs=0.04:rm=-0.015:bm=0.015')
FADES = f'fade=t=in:st=0:d=0.35:color={NAVY}'  # yalnızca açılış: video son karede durur (döngü yok)
TO_YUV = ('scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,'
          'setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709')  # VUI: üçü de BT.709
TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
X264 = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', *TAGS,
        '-movflags', '+faststart', '-map_metadata', '-1', '-an', '-r', '29.97']


def ease(x):
    """Yumuşak başlayıp yumuşak biten geçiş (smootherstep)."""
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (x * 6 - 15) + 10)


def reframe(big, f):
    """4K kareden sola yaslı, alt piksel hassas 1080p kadraj."""
    e = ease((f - ZA) / (ZB - ZA)) if f >= ZA else 0.0
    z = Z0 + (ZMAX - Z0) * e
    cw, ch = W4 / z, H4 / z
    x0, y0 = 0.0, (H4 - ch) * (0.5 + 0.05 * e)  # itmede kadraj çok az aşağı iner (masalar kadrajda kalsın)
    s = OW / cw
    sw, sh = int(np.ceil(W4 * s)) + 2, int(np.ceil(H4 * s)) + 2
    small = cv2.resize(big, (sw, sh), interpolation=cv2.INTER_AREA)
    rx, ry = sw / W4, sh / H4
    m = np.float32([[s / rx, 0, -x0 * s], [0, s / ry, -y0 * s]])
    return cv2.warpAffine(small, m, (OW, OH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def main():
    if not os.path.isfile(SRC):
        sys.exit(f'kaynak yok: {SRC}')
    os.makedirs(OUT, exist_ok=True)
    work = tempfile.mkdtemp(prefix='boraden-hero-')
    v1080 = os.path.join(OUT, 'boraden-giris-v2-1080.mp4')
    v720 = os.path.join(OUT, 'boraden-giris-v2-720.mp4')
    poster_png = os.path.join(work, 'poster.png')

    # çözücü yalnızca END'e kadar olan kareleri verir (sonrası hiç çözülmez)
    dec = subprocess.Popen([FF, '-v', 'error', '-i', SRC, '-an', '-vf', TONEMAP, '-frames:v', str(END + 1), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                           stdout=subprocess.PIPE, bufsize=W4 * H4 * 3)
    enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}',
                            '-framerate', FPS_IN, '-i', '-',
                            '-filter_complex', f'[0:v]{GRADE},split=2[a][b];[a]{FADES},{TO_YUV}[o1];'
                                               f'[b]scale=1280:720:flags=lanczos,{FADES},{TO_YUV}[o2]',
                            '-map', '[o1]', *X264, '-crf', '25', '-level', '4.1', v1080,
                            '-map', '[o2]', *X264, '-crf', '26', '-level', '4.0', v720],
                           stdin=subprocess.PIPE)
    size = W4 * H4 * 3
    n = 0
    while n <= END:
        buf = dec.stdout.read(size)
        if not buf or len(buf) < size:
            break
        big = np.frombuffer(buf, np.uint8).reshape(H4, W4, 3)
        im = reframe(big, n)
        if n == POSTER_AT:
            cv2.imwrite(poster_png, cv2.cvtColor(im, cv2.COLOR_RGB2BGR))
        enc.stdin.write(im.tobytes())
        n += 1
    enc.stdin.close()
    if enc.wait() != 0 or dec.wait() != 0:
        sys.exit('ffmpeg hata verdi')
    print(f'kare: {n}')
    if n <= END:
        sys.exit('kaynak beklenenden kısa: kadraj ve bitiş kareleri bu kaynağa göre yeniden seçilmeli')

    for w in (1920, 1280, 768):
        h = round(w * 9 / 16 / 2) * 2
        dst = os.path.join(OUT, f'boraden-giris-poster-{w}.webp')
        subprocess.run([FF, '-v', 'error', '-y', '-i', poster_png,
                        '-vf', f'{GRADE},scale={w}:{h}:flags=lanczos,format=bgra',
                        '-c:v', 'libwebp', '-quality', '78', '-compression_level', '6', '-map_metadata', '-1', dst], check=True)
    for p in (v1080, v720, *(os.path.join(OUT, f'boraden-giris-poster-{w}.webp') for w in (1920, 1280, 768))):
        print(f'{os.path.relpath(p, REPO)}: {os.path.getsize(p) / 1024:.1f} KB')
    print(f'ara dosyalar: {work}')


if __name__ == '__main__':
    main()
