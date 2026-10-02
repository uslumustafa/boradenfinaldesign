#!/bin/zsh
# Boraden ofis filmi (ana sayfa «Film» bölümü) — yeniden üretim betiği.
#   Çıktı: ofis-loop.mp4 (bu klasörde) → src/assets/video/boraden-ofis.mp4 olarak kopyalayın.
#   Poster: ffmpeg -ss 2.2 -i ofis-loop.mp4 -frames:v 1 -q:v 3 boraden-ofis-poster.jpg  (src/assets/video/ içine)
#   Gereken: ffmpeg (Homebrew: /opt/homebrew/bin/ffmpeg; zscale/tonemap/hqdn3d/xfade filtreleri), kaynak klipler (aşağıdaki D klasörü).
#   Boyut hedefi ≤ 4–5 MB (yayındaki dosya: 4,17 MB, 22,4 sn, 1280×720, sessiz, CRF≈29 + bit hızı sınırı); ayar: CRF=29 MAXR=1700k BUFS=3400k zsh scripts/tools/office-film.sh
#   Kaynak: 2022 arşivi, 4K HEVC 10-bit HLG → SDR'ye (hable) çevrilir. Kesitler logosuz, tek kişilik yakın plansızdır.
#   Çalışma klasörü /tmp/vcut (betik oraya yazar). Yeni çekim yapıldığında S1..S4 kesitlerini ve D klasörünü güncelleyin.
# Boraden ofis filmi: 3 gerçek arşiv klibinden (2022, 4K HLG) logosuz, tek kişilik yakın plansız kısa kurgu → 720p SDR H.264 döngü.
FF=/opt/homebrew/bin/ffmpeg
D=~/Downloads/boradenphoto/"FOTOĞRAF_ 16.11.2022"/"3_Boraden video"
mkdir -p /tmp/vcut && cd /tmp/vcut
SL=1.11          # %10 yavaşlatma (el kamerası titremesini yumuşatır)
XF=0.9           # çapraz geçiş süresi
# kaynak kesitleri (başlangıç, süre)
S1="8.0 5.6"; F1="0376"
S2="24.0 6.0"; F2="0375"
S3="18.0 5.0"; F3="0377"
S4="14.0 6.0"; F4="0376"
CH="setpts=${SL}*PTS,fps=30,scale=1280:720:flags=lanczos,zscale=tin=arib-std-b67:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,hqdn3d=2.5:2:6:5,setsar=1"
set -- ${=S1}; a1=$1; l1=$2
set -- ${=S2}; a2=$1; l2=$2
set -- ${=S3}; a3=$1; l3=$2
set -- ${=S4}; a4=$1; l4=$2
d1=$(python3 -c "print(round($l1*$SL,3))"); d2=$(python3 -c "print(round($l2*$SL,3))"); d3=$(python3 -c "print(round($l3*$SL,3))"); d4=$(python3 -c "print(round($l4*$SL,3))")
o1=$(python3 -c "print(round($d1-$XF,3))")
o2=$(python3 -c "print(round($d1+$d2-2*$XF,3))")
o3=$(python3 -c "print(round($d1+$d2+$d3-3*$XF,3))")
tot=$(python3 -c "print(round($d1+$d2+$d3+$d4-3*$XF,3))")
fo=$(python3 -c "print(round($tot-0.7,3))")
echo "dur: $d1 $d2 $d3 $d4 offsets: $o1 $o2 $o3 total: $tot"
$FF -hide_banner -loglevel error -y \
  -hwaccel videotoolbox -ss $a1 -t $l1 -i "$D/IMG_$F1.MOV" \
  -hwaccel videotoolbox -ss $a2 -t $l2 -i "$D/IMG_$F2.MOV" \
  -hwaccel videotoolbox -ss $a3 -t $l3 -i "$D/IMG_$F3.MOV" \
  -hwaccel videotoolbox -ss $a4 -t $l4 -i "$D/IMG_$F4.MOV" \
  -filter_complex "[0:v]${CH}[v0];[1:v]${CH}[v1];[2:v]${CH}[v2];[3:v]${CH}[v3];[v0][v1]xfade=transition=fade:duration=${XF}:offset=${o1}[x1];[x1][v2]xfade=transition=fade:duration=${XF}:offset=${o2}[x2];[x2][v3]xfade=transition=fade:duration=${XF}:offset=${o3}[x3];[x3]fade=t=in:st=0:d=0.7,fade=t=out:st=${fo}:d=0.7[out]" \
  -map "[out]" -an -c:v libx264 -preset slow -crf ${CRF:-28} -maxrate ${MAXR:-1700k} -bufsize ${BUFS:-3400k} -profile:v high -level 4.1 -pix_fmt yuv420p -movflags +faststart ofis-loop.mp4 && echo "ENCODE-OK"
ls -la ofis-loop.mp4
# kareler: her 2 sn bir (kontrol için)
$FF -hide_banner -loglevel error -y -i ofis-loop.mp4 -vf "fps=1/2,scale=320:-2,tile=6x2" -frames:v 1 -q:v 4 check_sheet.jpg && echo "SHEET-OK"
echo ALLDONE-CUT
