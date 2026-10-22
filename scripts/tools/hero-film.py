#!/usr/bin/env python3
"""Boraden ana sayfa kahraman videosu («Tam doğru zamanında» alanı) — yeniden üretim betiği (Ekim 2026).

Kurgu — 22 Ekim 2026 (müşteri: «videoyu yavaşlat ve içeriyi gösteren bir video olsun, fotoğraflarla birleştir; içeriyi görelim»;
proje sahibi: «içeride yüzler görünsün istenmedi, bulanıklık istenmedi; video nasıl olacak sana bırakıyorum»; aynı gün ilk sürümden
sonra: «cızırtılar var, başlangıcı bir tık daha hızlandırabilirsin»):
  1) Giriş (2/3 hızda; ilk sürümde yarı hızdı): müşterinin çekimi (boradenkirpilmis.mp4 — 4K HEVC 10 bit HLG, 10,6 sn, 180° döndürülmüş kayıt; depoda
     tutulmaz), 0.–229. kareler: giriş tabelası → cam kapı → resepsiyondaki logo ekranı → ofis alanının geçişi. İlk kişi 235. karede
     belirir (bölmenin üstünde bir baş), o yüzden çekimin devamı kullanılmaz (20 Ekim kararı: «tam kapıdan giriş anında dursun»).
     Yavaşlatma kare tekrarı ya da harmanlama değildir: çıktının her karesi kaynağın 2/3 kare ilerisidir; kaynak karesine denk
     gelmeyenler iki komşu kareden optik akışla üretilir (OpenCV DIS, iki yönlü akış, doğrusal hareket yaklaşımı, örtülme ağırlıklı
     karışım) — 344 kare ≈ 11,5 sn, hareket akıcı.
  2) İç mekân (fotoğraflar): arşivdeki insansız mimari çekimler (FOTOĞRAF_ 01.01.2019/Karma — sitedeki «open-office-…»,
     «meeting-room-…», «reception-lounge» görsellerinin özgün kareleri): açık ofis, açık ofisin karşı açısı, cam bölmeli odalar,
     toplantı odası, karşılama alanı. Her biri ≈ 4,4 sn, yavaş kamera hareketiyle (itme ya da yatay kaydırma; alt piksel hassas,
     warpAffine), aralarında 1 sn çapraz geçiş. Videodan ilk fotoğrafa lacivert üzerinden geçilir (0,4 sn kararma + 0,4 sn açılma):
     resepsiyonun sıcak ışığından fotoğrafların gün ışığına çapraz geçiş çamurlu görünüyordu; ilk fotoğrafta (açık ofis) videonun
     ileri yürüyüşü itmeyle sürer. Fotoğraflar videoya göre çok aydınlık olduğundan pozları biraz kısılır (PHOTO_GAMMA/PHOTO_GAIN):
     kahramandaki yazılar en aydınlık karede de okunur kalır.
  Yüz yok: videonun kullanılan kısmında kimse görünmez, fotoğraflar insansızdır (Apple Vision yüz ve insan taraması + gözle denetim;
  ekranlarda ya da camda yansıyan kişi yok). Görüntüde rötuş ya da bulanıklık yoktur (küçültmedeki süzme yalnızca örtüşmeyi önler).
  Döngü: video başa sarar (20 Ekim, proje sahibi: «video bitince eskisi gibi başa sarıyordu, tekrar öyle»); başı 0,5 sn lacivertten
  açılır, sonu 0,6 sn laciverde kararır — başa dönüş kesik görünmez.
  Titreşim («cızırtı», ilk sürümde): ahşap çıtalar, storlar, taş duvar ve tavan ışıkları gibi ince desenler kare kare kaynıyordu.
  Ölçülen nedenler ve çözümler:
   • Küçültmede örtüşme: giriş iki adımda (alan ortalaması + doğrusal kaydırma), fotoğraflar kübik ara değerlemeyle alınıyordu;
     ölçek ve alt piksel konumu her karede değiştiği için desen titriyordu. Artık her kare tek adımda, küçültme oranına göre
     süzülüp (Gauss σ = AA / ölçek) Lanczos ile alınır. Süzme payı AA = 0,6 çıktı pikseli: 0,45'te kodlayıcı en ince dokuyu her
     karede farklı siliyordu — bit artırmak (crf 21) bunu çözmüyor, süzme payı çözüyor; keskinlik ilk sürümle aynı düzeyde.
   • Kodlayıcı: psy-rd 0,6 (x264'ün ince dokuyu «canlı tutmak» için her karede yeniden ürettiği doku azalır), crf 23 / 24.
     Anahtar kareler (I) çekimin ortasında keskinlik sıçraması yapıyordu: anahtar kareler yalnızca lacivert geçişte ve fotoğraflar
     arası çapraz geçişlerin ortasında (KEYS; otomatik sahne kesmesi kapalı).
   • Ara kareler gerçek karelerden yumuşaktı (between: Lanczos örnekleme, karesel yakınlık ağırlığı).
  Ölçü (fotoğraf bölümlerinde kamera hareketi bilindiği için aynı içerik izlenir; 8 ardışık kare hizalanıp piksel başına zamansal
  sapma, 0–255): ilk sürüm 0,96 → 0,67 (kodlamadan önce 0,48).

  Önceki kararlar (aynen sürer): SDR'ye çevirme (HLG → doğrusal → BT.709 ana renkler, mobius ton eşleme; 8 bit'e hata yayınımlı
  titreme), kadraj (ilk 5 sn tam kare — giriş tabelası «BORADEN · Bağımsız Denetim ve Danışmanlık A.Ş.» eksiksiz; 150. kareden sonra
  sola yaslı yavaş itme, 229. karede ≈ 1,46×), renk (sitenin laciverdiyle uyumlu, hafif soğuk, az doygun: eq + colorbalance; video ve
  fotoğraflar aynı ayarla). Kırpma alt piksel hassastır (OpenCV warpAffine): ffmpeg'in crop/zoompan süzgeçleri tam piksele yuvarladığı
  için itme ve kaydırma sırasında görüntü titrer.

Çıktı (src/assets/video/): boraden-giris-v5-1080.mp4 ve boraden-giris-v5-720.mp4 (H.264 High, sessiz, BT.709 etiketli, faststart;
  adı her yeni kurguda değişir: /assets/video/ bir gün önbellekte kalır — vercel.json); boraden-giris-poster-1920/1280/768.webp
  (kaynağın 28. karesi = çıktının 42. karesi ≈ 1,4 sn — ilk oynatma bu kareden başlar: hero-film.js › POSTER_T).
Gereken: ffmpeg (zscale + tonemap süzgeçleri; Homebrew: /opt/homebrew/bin/ffmpeg), python3 + numpy + opencv-python (DIS optik akış).
Kullanım: python3 scripts/tools/hero-film.py [kaynak.mp4] [--out=klasör] [--archive=fotoğraf-arşivi] [--frames=klasör] [--master=dosya.mp4]
          (varsayılan kaynak ~/Downloads/boradenkirpilmis.mp4, arşiv ~/Downloads/boradenphoto; --frames=klasör: denetim için her 6.
          çıktı karesini 960 px JPEG olarak da yazar — yüz taraması ve gözle kontrol; --master: kodlamadan önceki 1080p kareleri
          kayıpsız da yazar (x264 qp 0, ≈ 0,6 GB) — kodlayıcı ayarı denemeleri bu kopyadan yapılır; ffmpeg yolu FFMPEG ortam değişkeniyle)
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
opt = {a[2:].split('=', 1)[0]: (a.split('=', 1)[1] if '=' in a else '1') for a in sys.argv[1:] if a.startswith('--')}
SRC = args[0] if args else os.path.expanduser('~/Downloads/boradenkirpilmis.mp4')
OUT = opt.get('out', os.path.join(REPO, 'src', 'assets', 'video'))
ARCHIVE = os.path.expanduser(opt.get('archive', os.environ.get('BORADEN_ARCHIVE', '~/Downloads/boradenphoto')))
FRAMES = opt.get('frames')
MASTER = opt.get('master')

W4, H4 = 3840, 2160          # kaynak (döndürme düzeltildikten sonra)
OW, OH = 1920, 1080          # çıktı
ZA, ZB = 150, 258            # itmenin başladığı / bittiği kaynak karesi (itme eğrisi önceki kurgularla aynı kalsın diye 258)
END = 229                    # son kaynak karesi (dahil): ofis alanına geçiş, kimse görünmeden (ilk kişi 235. karede belirmeye başlar)
Z0, ZMAX = 1.0, 1.52         # yakınlık: başta (tam kare) / itmeden sonra
SPEED = 2 / 3                # giriş hızı (kaynağa göre; çıktının her karesi kaynağın SPEED kare ilerisi). İlk sürüm 1/2 idi
NV = int(END / SPEED + 1e-9) + 1  # giriş bölümünün çıktı kare sayısı (344)
POSTER_SRC = 28              # poster: kaynağın 28. karesi = çıktının 42. karesi (SPEED ile tam denk gelir, ara kare değil)
POSTER_OUT = round(POSTER_SRC / SPEED)
AA = 0.6                     # küçültmede örtüşme süzgeci: Gauss σ = AA / ölçek (kaynak pikseli; ölçek = çıktı/kaynak) — «Titreşim»
FPS = '30000/1001'           # çıktı kare hızı (29,97 sabit; kaynak 29,934 — fark ≈ % 0,1)
NAVY = '0x08132a'            # --navy-950
TONEMAP = ('zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=250,format=gbrpf32le,'
           'zscale=p=bt709,tonemap=mobius:param=0.5:desat=0,'
           'zscale=t=bt709:m=bt709:r=pc:d=error_diffusion,format=rgb24')
GRADE = ('eq=contrast=1.06:brightness=-0.02:saturation=0.88:gamma=0.96,'
         'colorbalance=rs=-0.03:bs=0.04:rm=-0.015:bm=0.015')

# İç mekân çekimleri: (dosya, başlangıç kadrajı, bitiş kadrajı). Kadraj = (merkez x, merkez y, genişlik) — fotoğraf boyutuna oranla;
# yükseklik 16:9'dan gelir. Görüntünün sol yarısı ve altı kahramanda yazının arkasında koyulaşır: ilgi çeken kısım ortada/sağda.
PHOTO_DIR = 'FOTOĞRAF_ 01.01.2019/Karma'
PHOTOS = [
    ('_76A9727a_8a_9a_Natural.jpg', (0.52, 0.54, 0.96), (0.57, 0.57, 0.84)),   # açık ofis: girişin ileri hareketi itmeyle sürer
    ('_76A9742a_3a_4a_Natural.jpg', (0.45, 0.55, 0.88), (0.56, 0.55, 0.86)),   # açık ofis, karşı açı: soldan sağa kaydırma
    ('_76A9762a_3a_4a_Natural.jpg', (0.58, 0.55, 0.88), (0.47, 0.54, 0.86)),   # cam bölmeli odalar: sağdan sola kaydırma
    ('_76A9673a_4a_5a_Natural.jpg', (0.50, 0.55, 0.98), (0.55, 0.58, 0.85)),   # toplantı odası (cam ve ahşap çıtalar): itme
    ('_76A9700a_1a_2a_Natural.jpg', (0.57, 0.56, 0.84), (0.51, 0.54, 0.95)),   # karşılama alanı: yavaş geri çekilme
]
SHOT = 132                   # her fotoğrafın ekranda kaldığı süre (kare; ≈ 4,4 sn, geçişler dahil)
XF = 30                      # fotoğraflar arası çapraz geçiş (kare; ≈ 1 sn)
DIP = 12                     # videodan ilk fotoğrafa lacivert üzerinden geçiş: video 12 karede kararır, fotoğraf 12 karede açılır
# Fotoğrafların pozu: arşivdeki mimari çekimler (HDR, beyaz tavan ve pencereler) videodan çok daha aydınlık; kahramandaki yazılar
# (üst etiket, başlık) zeminin en parlak anına göre okunur olmalı (tests/hero-contrast.e2e.mjs). Orta tonlar ve parlak alanlar
# biraz koyulaşır (gama + kazanç), renk değişmez.
PHOTO_GAMMA, PHOTO_GAIN = 1.12, 0.88
STARTS = [NV + k * (SHOT - XF) for k in range(len(PHOTOS))]
N = STARTS[-1] + SHOT        # toplam kare
DUR = N * 1001 / 30000       # süre (sn)
FADE_IN, FADE_OUT = 0.5, 0.6
FADES = f'fade=t=in:st=0:d={FADE_IN}:color={NAVY},fade=t=out:st={DUR - FADE_OUT:.3f}:d={FADE_OUT}:color={NAVY}'
TO_YUV = ('scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,'
          'setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709')  # VUI: üçü de BT.709
TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
# Kodlayıcı («Titreşim»): anahtar kareler yalnızca KEYS'te — başta, lacivert geçişte ve fotoğraflar arası çapraz geçişlerin ortasında
# (geçişte keskinlik değişimi görünmez; en uzun GOP ≈ 11,5 sn, başa sarma ve ilk oynatmadaki konumlama hızlı kalır).
KEYS = [0, NV] + [s + XF // 2 for s in STARTS[1:]]
X264_TUNE = 'psy-rd=0.6,0:keyint=900:scenecut=0'
CRF_1080, CRF_720 = 23, 24
X264 = ['-c:v', 'libx264', '-preset', 'veryslow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', *TAGS,
        '-movflags', '+faststart', '-map_metadata', '-1', '-an', '-r', FPS,
        '-force_key_frames', 'expr:' + '+'.join(f'eq(n,{k})' for k in KEYS), '-x264-params', X264_TUNE]


def ease(x):
    """Yumuşak başlayıp yumuşak biten geçiş (smootherstep)."""
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (x * 6 - 15) + 10)


def glide(x):
    """Fotoğraflarda kamera hızı: ortası neredeyse sabit hızlı, uçları yumuşak (doğrusal + smoothstep karışımı)."""
    x = min(1.0, max(0.0, x))
    return 0.5 * x + 0.5 * x * x * (3 - 2 * x)


def reframe(big, f):
    """4K kareden sola yaslı, alt piksel hassas 1080p kadraj: tek adımda, küçültme oranına göre süzülmüş (örtüşme yok) Lanczos.
    Önceden iki adımdı (alan ortalamasıyla küçültme + doğrusal kaydırma): ölçek kare kare biraz değiştiği için ince çıta deseni
    örtüşüp titriyordu."""
    e = ease((f - ZA) / (ZB - ZA)) if f >= ZA else 0.0
    z = Z0 + (ZMAX - Z0) * e
    cw, ch = W4 / z, H4 / z
    x0, y0 = 0.0, (H4 - ch) * (0.5 + 0.05 * e)  # itmede kadraj çok az aşağı iner (masalar kadrajda kalsın)
    s = OW / cw                                   # 0,5 (tam kare) … ≈ 0,73 (itme sonu)
    src = cv2.GaussianBlur(big, (0, 0), AA / s)
    m = np.float32([[s, 0, -x0 * s], [0, s, -y0 * s]])
    return cv2.warpAffine(src, m, (OW, OH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)


_dis = None
_grid = None


def flows(a, b):
    """a ile b arasındaki iki yönlü optik akış (DIS, yarım çözünürlükte) ve ileri-geri tutarlılığından görünürlük ağırlıkları."""
    global _dis, _grid
    if _dis is None:
        _dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        _dis.setFinestScale(0)
    h, w = a.shape[:2]
    if _grid is None:
        _grid = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    xs, ys = _grid
    half = (w // 2, h // 2)
    ga = cv2.cvtColor(cv2.resize(a, half, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    gb = cv2.cvtColor(cv2.resize(b, half, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    fab = cv2.resize(_dis.calc(ga, gb, None), (w, h), interpolation=cv2.INTER_LINEAR) * 2.0
    fba = cv2.resize(_dis.calc(gb, ga, None), (w, h), interpolation=cv2.INTER_LINEAR) * 2.0

    def visible(f1, f2):
        back = cv2.remap(f2, xs + f1[..., 0], ys + f1[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        err = np.sum((f1 + back) ** 2, axis=2)
        return np.exp(-err / (2 * 1.5 ** 2)).astype(np.float32)

    return fab, fba, visible(fab, fba), visible(fba, fab)


def between(a, b, t, fl):
    """a (t = 0) ile b (t = 1) arasında t anındaki kare: doğrusal hareket yaklaşımıyla ara kareden iki kaynağa geri akış
    (Ft→0 = −(1−t)·t·F01 + t²·F10; Ft→1 = (1−t)²·F01 − t·(1−t)·F10), görünürlük ve yakınlık ağırlıklı karışım.
    Örnekleme Lanczos, yakınlık ağırlığı karesel (t = 1/3'te 0,8 / 0,2): iki kaynağın üst üste binmesi ara kareyi yumuşatıyordu —
    ara kareler gerçek karelerden belirgin yumuşak olunca doku saniyede 10 kez «nabız» atıyordu (ince ayrıntı, gerçek karelere
    göre: kübik + doğrusal ağırlıkta % 8,7 az, şimdi % 6,1 az — 22 Ekim ölçümü)."""
    fab, fba, va, vb = fl
    xs, ys = _grid
    f0 = -(1 - t) * t * fab + t * t * fba
    f1 = (1 - t) * (1 - t) * fab - t * (1 - t) * fba
    m0x, m0y = xs + f0[..., 0], ys + f0[..., 1]
    m1x, m1y = xs + f1[..., 0], ys + f1[..., 1]
    wa = cv2.remap(a, m0x, m0y, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
    wb = cv2.remap(b, m1x, m1y, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
    ka = (1 - t) ** 2 * cv2.remap(va, m0x, m0y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE) + 1e-3
    kb = t ** 2 * cv2.remap(vb, m1x, m1y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE) + 1e-3
    out = (wa * ka[..., None] + wb * kb[..., None]) / (ka + kb)[..., None]
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def entrance(poster_png):
    """Giriş bölümü (NV kare): çıktının k. karesi kaynağın k·SPEED anıdır; tam kaynak karesine düşen kare olduğu gibi, arada kalan
    komşu iki kareden optik akışla."""
    dec = subprocess.Popen([FF, '-v', 'error', '-i', SRC, '-an', '-vf', TONEMAP, '-frames:v', str(END + 1),
                            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, bufsize=W4 * H4 * 3)
    size = W4 * H4 * 3
    cache = {}  # kaynak karesi → 1080p kadraj (yalnızca son iki kare tutulur)
    fl = {}     # (i, i+1) → akışlar

    def src(i):
        while i not in cache:
            f = max(cache) + 1 if cache else 0
            buf = dec.stdout.read(size)
            if not buf or len(buf) < size:
                sys.exit('kaynak beklenenden kısa: kadraj ve bitiş kareleri bu kaynağa göre yeniden seçilmeli')
            cache[f] = reframe(np.frombuffer(buf, np.uint8).reshape(H4, W4, 3), f)
            for old in [k for k in cache if k < f - 1]:
                del cache[old]
        return cache[i]

    for k in range(NV):
        tau = k * SPEED
        i = int(tau + 1e-9)
        t = tau - i
        if t < 1e-6 or i >= END:
            im = src(min(i, END))
        else:
            a, b = src(i), src(i + 1)
            if (i, i + 1) not in fl:
                fl.clear()
                fl[(i, i + 1)] = flows(a, b)
            im = between(a, b, t, fl[(i, i + 1)])
        if k == POSTER_OUT:
            cv2.imwrite(poster_png, cv2.cvtColor(im, cv2.COLOR_RGB2BGR))
        yield im
    dec.stdout.close()
    dec.wait()


def load_photo(name, a, b):
    """Fotoğrafı, en dar kadraj çıktıya 1:1 düşecek boya indirir (alan ortalamasıyla); pozu biraz kısar."""
    path = os.path.join(ARCHIVE, PHOTO_DIR, name)
    im = cv2.imread(path, cv2.IMREAD_COLOR)
    if im is None:
        sys.exit(f'fotoğraf yok: {path}')
    im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
    h, w = im.shape[:2]
    s = OW / (min(a[2], b[2]) * w)
    im = cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    lut = np.clip(255 * PHOTO_GAIN * (np.arange(256) / 255) ** PHOTO_GAMMA + 0.5, 0, 255).astype(np.uint8)
    return cv2.LUT(im, lut)


def photo_frame(im, a, b, u):
    """u ∈ [0, 1] anındaki kadraj (alt piksel hassas): küçültme oranına göre süzülür (σ = AA / ölçek), Lanczos ile alınır —
    storlar, tavan ışıkları ve taş doku kaydırmada titremez."""
    e = glide(u)
    cx, cy, cwf = (a[i] + (b[i] - a[i]) * e for i in range(3))
    ph, pw = im.shape[:2]
    cw = cwf * pw
    ch = cw * OH / OW
    x0 = min(max(cx * pw - cw / 2, 0.0), pw - cw)
    y0 = min(max(cy * ph - ch / 2, 0.0), ph - ch)
    s = OW / cw
    m = np.float32([[s, 0, -x0 * s], [0, s, -y0 * s]])
    return cv2.warpAffine(cv2.GaussianBlur(im, (0, 0), AA / s), m, (OW, OH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)


def navy_before_grade():
    """GRADE'den geçince sitenin laciverdine (NAVY) düşen giriş rengi: ortadaki lacivert geçiş, baştaki ve sondaki (ffmpeg fade,
    GRADE'den sonra) ile aynı tonda olsun diye birkaç adımda bulunur."""
    want = np.array([int(NAVY[2:4], 16), int(NAVY[4:6], 16), int(NAVY[6:8], 16)], np.float64)
    p = want.copy()
    for _ in range(4):
        q = np.clip(np.round(p), 0, 255).astype(np.uint8)
        img = np.tile(q, (16, 16, 1)).astype(np.uint8)
        r = subprocess.run([FF, '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '16x16', '-i', '-', '-vf', GRADE,
                            '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], input=img.tobytes(), capture_output=True, check=True)
        got = np.frombuffer(r.stdout, np.uint8).reshape(16, 16, 3)[8, 8].astype(np.float64)
        p += want - got
    return np.tile(np.clip(np.round(p), 0, 255).astype(np.uint8), (OH, OW, 1))


def mix(a, b, alpha):
    return np.clip(a.astype(np.float32) * (1 - alpha) + b.astype(np.float32) * alpha + 0.5, 0, 255).astype(np.uint8)


def main():
    if not os.path.isfile(SRC):
        sys.exit(f'kaynak yok: {SRC}')
    os.makedirs(OUT, exist_ok=True)
    if FRAMES:
        os.makedirs(FRAMES, exist_ok=True)
    work = tempfile.mkdtemp(prefix='boraden-hero-')
    v1080 = os.path.join(OUT, 'boraden-giris-v5-1080.mp4')
    v720 = os.path.join(OUT, 'boraden-giris-v5-720.mp4')
    poster_png = os.path.join(work, 'poster.png')
    photos = [load_photo(n, a, b) for n, a, b in PHOTOS]
    navy = navy_before_grade()

    graph = [f'[0:v]{GRADE},split={3 if MASTER else 2}[a][b]{"[m]" if MASTER else ""}',
             f'[a]{FADES},{TO_YUV}[o1]', f'[b]scale=1280:720:flags=lanczos,{FADES},{TO_YUV}[o2]']
    outs = ['-map', '[o1]', *X264, '-crf', str(CRF_1080), '-level', '4.1', v1080,
            '-map', '[o2]', *X264, '-crf', str(CRF_720), '-level', '4.0', v720]
    if MASTER:  # kayıpsız ana kopya (1080p, kodlayıcı denemeleri ve ölçüm için; depoya girmez)
        graph.append(f'[m]{FADES},{TO_YUV}[om]')
        outs += ['-map', '[om]', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'yuv420p', *TAGS,
                 '-an', '-r', FPS, MASTER]
    enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}',
                            '-framerate', FPS, '-i', '-', '-filter_complex', ';'.join(graph), *outs],
                           stdin=subprocess.PIPE)
    vid = entrance(poster_png)
    for n in range(N):
        layers = []
        if n < NV:
            v = next(vid)
            if n >= NV - DIP:  # giriş videosu laciverde kararır
                v = mix(v, navy, ease((n - (NV - DIP) + 1) / DIP))
            layers.append((v, -10 ** 9))
        for k, s0 in enumerate(STARTS):
            if s0 <= n < s0 + SHOT:
                a, b = PHOTOS[k][1], PHOTOS[k][2]
                im = photo_frame(photos[k], a, b, (n - s0) / (SHOT - 1))
                if k == 0 and n < s0 + DIP:  # ilk fotoğraf lacivertten açılır
                    im = mix(navy, im, ease((n - s0 + 1) / (DIP + 1)))
                layers.append((im, s0))
        if len(layers) == 1:
            im = layers[0][0]
        else:  # çapraz geçiş: yeni gelen çekim üstte, XF kare boyunca belirir
            (base, _), (top, s0) = layers[-2], layers[-1]
            im = mix(base, top, ease((n - s0 + 1) / (XF + 1)))
        if FRAMES and n % 6 == 0:
            cv2.imwrite(os.path.join(FRAMES, f'k{n:04d}.jpg'), cv2.cvtColor(cv2.resize(im, (960, 540), interpolation=cv2.INTER_AREA),
                                                                             cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
        enc.stdin.write(im.tobytes())
    enc.stdin.close()
    if enc.wait() != 0:
        sys.exit('ffmpeg (kodlayıcı) hata verdi')
    print(f'kare: {N} ({DUR:.2f} sn; giriş {NV} kare, iç mekân {len(PHOTOS)} çekim)')

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
