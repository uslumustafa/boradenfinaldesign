#!/bin/bash
# Boraden ofis filmi (ana sayfa «Film» bölümü) — yeniden üretim betiği.
#   Çıktı: /tmp/vcut/ofis-loop.mp4  → src/assets/video/boraden-ofis.mp4 olarak kopyalayın.
#   Poster: ffmpeg -ss 4.3 -i /tmp/vcut/ofis-loop.mp4 -frames:v 1 -q:v 3 src/assets/video/boraden-ofis-poster.jpg
#   Gereken: ffmpeg (Homebrew: /opt/homebrew/bin/ffmpeg; zscale/tonemap/hqdn3d/minterpolate/gblur/alphamerge filtreleri),
#            python3 + numpy + opencv-python (yüz maskesi), kaynak klip (aşağıdaki D klasörü).
#   Kaynak: 2022 arşivi, IMG_0376.MOV (4K HEVC 10-bit HLG) → SDR'ye (hable) çevrilir.
#   Kesit: 8,0–10,1 sn. Girişteki ahşap çıtalı bölmeden, bilgisayar başında sırtı dönük oturan çalışana kadar (müşteri isteği).
#          Klibin 0–7,5 sn aralığında BORADEN tabelası göründüğünden kesit 8,0'da başlar; 10,2 sn'den sonra yüzü açık biri girer.
#   Yüzler: arka plandaki üç kişinin ve sağdaki yürüyen kişinin yüzü 720p'de seçilebildiği için yüz bölgeleri,
#           office-film-faces.json'daki anahtarlarla takip edilen yumuşak bir bulanıklıkla kapatılır. Kesit değişirse kutular yeniden ölçülmelidir.
#   Süre: 64 kare (2,14 sn) F=2,62 ile yavaşlatılıp hareket tahminiyle (minterpolate) ara kareler üretilerek ≈5,4 sn döngüye uzatılır;
#         başta/sonda 0,7 sn solma. Sessiz, 1280×720, 30 fps, H.264 (CRF 24, bit hızı sınırı 3,2 Mb/sn) ≈ 1,2 MB.
#   Çalışma klasörü /tmp/vcut (betik oraya yazar). Yeni çekim yapıldığında SS/DUR/D ve yüz kutularını güncelleyin.
set -e
FF=/opt/homebrew/bin/ffmpeg
HERE="$(cd "$(dirname "$0")" && pwd)"
D=~/Downloads/boradenphoto/"FOTOĞRAF_ 16.11.2022"/"3_Boraden video"
SRC="$D/IMG_0376.MOV"
SS="${SS:-8.0}"            # kesit başlangıcı (sn)
DUR="${DUR:-2.1355}"       # kesit süresi (64 kare @ 29,97 fps)
F="${F:-2.62}"             # yavaşlatma çarpanı
N="${N:-175}"              # maske kare sayısı (videodan uzun olabilir)
BLUR="${BLUR:-7}"          # yüz bölgesi bulanıklık sigması
CRF="${CRF:-24}"; MAXR="${MAXR:-3200k}"; BUFS="${BUFS:-6400k}"
W=/tmp/vcut
mkdir -p $W/src && cd $W
rm -f $W/src/*.png
# 1) kesiti SDR (hable) 1280×720 PNG karelerine aç
CH="fps=30000/1001,scale=1280:720:flags=lanczos,zscale=tin=arib-std-b67:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
$FF -hide_banner -loglevel error -y -hwaccel videotoolbox -ss $SS -t 2.2 -i "$SRC" -vf "$CH" -start_number 0 $W/src/%04d.png
echo "kareler: $(ls $W/src | wc -l)"
# 2) yüz maskeleri (çıktı zaman çizelgesinde)
python3 "$HERE/office-film-masks.py" "$HERE/office-film-faces.json" $W/mask "$F" "$N" 1.15 5
# 3) ara dosya: hafif gürültü azaltma → yavaşlatma + ara kare → yüz bölgesi bulanıklığı (kayıpsız)
$FF -hide_banner -loglevel error -y \
  -framerate 30000/1001 -t $DUR -start_number 0 -i $W/src/%04d.png \
  -framerate 30 -start_number 0 -i $W/mask/%04d.png \
  -filter_complex "[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,hqdn3d=2:1.5:5:4,setpts=${F}*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:me=epzs:vsbmc=1:scd=none,split[a][b];[b]gblur=sigma=${BLUR}:steps=2[bl];[1:v]format=gray[mk];[bl][mk]alphamerge[ba];[a][ba]overlay=format=yuv420:shortest=1,setsar=1[out]" \
  -map "[out]" -an -c:v ffv1 -pix_fmt yuv420p pre.mkv
LEN=$($FF -hide_banner -i pre.mkv 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\),.*/\1/p')
SEC=$(python3 -c "h,m,s='$LEN'.split(':'); print(round(int(h)*3600+int(m)*60+float(s),3))")
FO=$(python3 -c "print(round($SEC-0.7,3))")
echo "süre: $SEC sn · solma çıkışı: $FO"
# 4) solma + H.264 (bt709 etiketli, hızlı başlangıç)
$FF -hide_banner -loglevel error -y -i pre.mkv \
  -vf "fade=t=in:st=0:d=0.7,fade=t=out:st=${FO}:d=0.7,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv" \
  -an -c:v libx264 -preset slow -crf $CRF -maxrate $MAXR -bufsize $BUFS -profile:v high -level 4.1 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart ofis-loop.mp4 && echo "ENCODE-OK"
ls -la ofis-loop.mp4
# kareler: her 0,5 sn bir (kontrol için; yüzlerin kapalı olduğunu gözle doğrulayın)
$FF -hide_banner -loglevel error -y -i ofis-loop.mp4 -vf "fps=2,scale=320:-2,tile=6x2" -frames:v 1 -q:v 4 check_sheet.jpg && echo "SHEET-OK"
echo ALLDONE-CUT
