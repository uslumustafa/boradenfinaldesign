#!/bin/bash
# Boraden ofis filmi (ana sayfa «Film» bölümü) — yeniden üretim betiği.
#   Çıktı: /tmp/vcut/ofis-loop.mp4 → src/assets/video/boraden-ofis.mp4 olarak kopyalayın.
#   Poster: /tmp/vcut/poster-1280.webp ve poster-768.webp (kesitin özgün POSTER_FRAME. karesi; kişisiz giriş karesi) →
#           src/assets/video/boraden-ofis-poster-1280.webp ve boraden-ofis-poster-768.webp olarak kopyalayın (poster.jpg ara dosyadır).
#   Gereken: ffmpeg (Homebrew: /opt/homebrew/bin/ffmpeg; zscale/tonemap/hqdn3d/minterpolate filtreleri), kaynak klip (aşağıdaki D klasörü).
#   Kaynak: 2022 arşivi, IMG_0376.MOV (4K HEVC 10-bit HLG) → SDR'ye (hable) çevrilir.
#   Kesit: 8,0–9,87 sn. Girişteki ahşap çıtalı bölmeden, bilgisayar başında sırtı dönük oturan çalışanın göründüğü ana kadar (müşteri isteği).
#          Klibin 0–7,5 sn aralığında BORADEN tabelası göründüğünden kesit 8,0'da başlar; ~9,9 sn'den sonra sağdan yüzü açık biri girer.
#   Yüzler: bulanıklık/sansür uygulanmaz (müşteri geri bildirimi, 6 Ekim 2026: film yalnızca sırtı dönük çalışana kadar kesilir).
#           Arka planda, bitkinin ardında birkaç kişi uzaktan ve küçük görünür.
#   Süre: 57 kare (1,9 sn) F=2,62 ile yavaşlatılıp hareket tahminiyle (minterpolate) ara kareler üretilerek ≈5 sn döngüye uzatılır;
#         başta/sonda 0,7 sn solma. Sessiz, 1280×720, 30 fps, H.264 (CRF 24, bit hızı sınırı 3,2 Mb/sn) ≈ 1 MB.
#   Çalışma klasörü /tmp/vcut (betik oraya yazar). Yeni çekim yapıldığında SS/DUR/D değerlerini güncelleyin.
set -e
FF=/opt/homebrew/bin/ffmpeg
D=~/Downloads/boradenphoto/"FOTOĞRAF_ 16.11.2022"/"3_Boraden video"
SRC="$D/IMG_0376.MOV"
SS="${SS:-8.0}"              # kesit başlangıcı (sn)
DUR="${DUR:-1.89}"           # kesit süresi: 57 kare @ 29,97 fps (son kare 9,87 sn)
F="${F:-2.62}"               # yavaşlatma çarpanı
POSTER_FRAME="${POSTER_FRAME:-10}" # poster: kesitin özgün karesi (8,33 sn) — girişteki çıtalı bölme ve ofis, kişisiz; ara kare değil
CRF="${CRF:-24}"; MAXR="${MAXR:-3200k}"; BUFS="${BUFS:-6400k}"
W=/tmp/vcut
mkdir -p $W/src && cd $W
rm -f $W/src/*.png
# 1) kesiti SDR (hable) 1280×720 PNG karelerine aç
CH="fps=30000/1001,scale=1280:720:flags=lanczos,zscale=tin=arib-std-b67:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
$FF -hide_banner -loglevel error -y -hwaccel videotoolbox -ss $SS -t 2.2 -i "$SRC" -vf "$CH" -start_number 0 $W/src/%04d.png
echo "kareler: $(ls $W/src | wc -l)"
# 2) ara dosya: hafif gürültü azaltma → yavaşlatma + ara kare (kayıpsız)
$FF -hide_banner -loglevel error -y \
  -framerate 30000/1001 -t $DUR -start_number 0 -i $W/src/%04d.png \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,hqdn3d=2:1.5:5:4,setpts=${F}*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:me=epzs:vsbmc=1:scd=none,setsar=1" \
  -an -c:v ffv1 -pix_fmt yuv420p pre.mkv
LEN=$($FF -hide_banner -i pre.mkv 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\),.*/\1/p')
SEC=$(python3 -c "h,m,s='$LEN'.split(':'); print(round(int(h)*3600+int(m)*60+float(s),3))")
FO=$(python3 -c "print(round($SEC-0.7,3))")
echo "süre: $SEC sn · solma çıkışı: $FO"
# 3) poster (özgün kare + aynı hafif gürültü azaltma)
$FF -hide_banner -loglevel error -y -i "$W/src/$(printf %04d $POSTER_FRAME).png" -vf "hqdn3d=2:1.5:5:4" -frames:v 1 -q:v 3 poster.jpg && echo "POSTER-OK"
# 3b) sayfadaki poster WebP (srcset: 768 ve 1280 px; ≈ 21 KB / 42 KB — JPG 134 KB idi)
$FF -hide_banner -loglevel error -y -i poster.jpg -c:v libwebp -quality 78 -compression_level 6 poster-1280.webp
$FF -hide_banner -loglevel error -y -i poster.jpg -vf "scale=768:-2:flags=lanczos" -c:v libwebp -quality 78 -compression_level 6 poster-768.webp && echo "POSTER-WEBP-OK"
# 4) solma + H.264 (bt709 etiketli, hızlı başlangıç)
$FF -hide_banner -loglevel error -y -i pre.mkv \
  -vf "fade=t=in:st=0:d=0.7,fade=t=out:st=${FO}:d=0.7,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv" \
  -an -c:v libx264 -preset slow -crf $CRF -maxrate $MAXR -bufsize $BUFS -profile:v high -level 4.1 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart ofis-loop.mp4 && echo "ENCODE-OK"
ls -la ofis-loop.mp4
# kareler: her 0,5 sn bir (kontrol için)
$FF -hide_banner -loglevel error -y -i ofis-loop.mp4 -vf "fps=2,scale=320:-2,tile=5x2" -frames:v 1 -q:v 4 check_sheet.jpg && echo "SHEET-OK"
echo ALLDONE-CUT
