// Kahraman videosu (ana sayfa, «Tam doğru zamanında»): giriş tabelasından cam kapıya, resepsiyondan ofis alanının geçişine uzanan çekim
// yavaşlatılmış (2/3 hız), ardından ofisin içi arşiv fotoğraflarıyla (açık ofis, cam bölmeli odalar, toplantı odası, karşılama alanı) — ≈ 29,5 sn,
// sessiz döngü. Müşteri isteği (Ekim 2026): eski «Ofisimiz» filmi kaldırıldı, video kahramanın zemini oldu; 20 Ekim: «insan yüzü
// görünmesin» (çekim kimse görünmeden ofis alanının geçişinde biter); 22 Ekim: «videoyu yavaşlat, içeriyi gösteren bir video olsun,
// fotoğraflarla birleştir» (yüz yok, bulanıklık yok). Bitince laciverde geçip başa sarar (döngü). Kurgu: scripts/tools/hero-film.py.
//
// Oynatma kuralları (bütçe + erişilebilirlik):
//   • Kendiliğinden oynatma: «Tam» ya da «Hafif» katman ve veri tasarrufu kapalı (telefon ve tablet dahil; video her ekranda başlığın
//     arkasında tam ekran zemin). Video sessiz ve döngülüdür; video alanı ekrandan çıkınca, beyaz sayfa kahramanın üstünü tamamen
//     örtünce ve sekme gizlenince DURUR (pil/CPU), yeniden görününce sürer. Tarayıcı kendiliğinden oynatmayı engellerse (ör. iPhone
//     Düşük Güç Modu) poster ve «Videoyu oynat» düğmesi kalır.
//   • «Kapalı» katman (hareket azaltma tercihi dahil) ve veri tasarrufu: yalnızca poster (video dosyası hiç indirilmez);
//     «Videoyu oynat» düğmesi oynatmayı ziyaretçiye bırakır.
//   • «Duraklat / Videoyu oynat» düğmesi her zaman vardır (WCAG 2.2.2). Ziyaretçi duraklattıysa kaydırma ya da katman değişimi
//     videoyu kendiliğinden yeniden başlatmaz.
//   • İlk oynatma posterin karesinden başlar (POSTER_T): poster ile videonun ilk görünen karesi aynıdır, video posterin üstüne
//     yumuşakça açılır (sıçrama yok). Döngünün sonu ve başı laciverde geçişlidir (kesik görünmez).
//   • Dosya ekran genişliğine göre seçilir: cihaz pikseli genişliği (CSS px × DPR, DPR en çok 2) 1400'ü aşarsa 1080p, değilse 720p.
//     Dosya ilk oynatmada yüklenir (preload="none" + data-src).
// Depolama yok; sunucuya istek yok (yalnızca video dosyası).
const POSTER_T = 1.418; // sn — poster karesi (hero-film.py › POSTER_SRC: kaynağın 28. karesi = çıktının 42. karesi; karenin ortası:
// 42,5 × 1001/30000 — konumlama karenin başına düşüp bir önceki kareyi göstermesin)

export function mount(el, { fx, scroll, on }) {
  const video = el.querySelector('.hero__video');
  const ctl = el.querySelector('[data-film-ctl]');
  const ctlT = el.querySelector('[data-film-ctl-t]');
  if (!video || !ctl || !video.dataset.src) return undefined;
  // kahramanın üstüne binen beyaz sayfa (giriş): üstü ekranın üstüne değince kahraman tamamen örtülmüştür
  const sheet = el.nextElementSibling;

  const media = el.querySelector('.hero__media') || video;
  const saveData = !!navigator.connection?.saveData;
  const auto = () => fx.tier !== 'off' && !saveData; // kendiliğinden oynatma izni
  let wantPlay = auto();
  let userPaused = false;
  let covered = false;
  let inView = true;
  let loaded = false;
  let started = false;

  function ui(playing) {
    ctl.classList.toggle('is-playing', playing);
    ctl.setAttribute('aria-label', playing ? 'Videoyu duraklat' : 'Videoyu oynat');
    if (ctlT) ctlT.textContent = playing ? 'Duraklat' : 'Videoyu oynat';
  }
  function load() {
    if (loaded) return;
    loaded = true;
    const px = innerWidth * Math.min(devicePixelRatio || 1, 2);
    video.src = px > 1400 ? video.dataset.src : video.dataset.srcSm || video.dataset.src;
    video.preload = 'auto';
  }
  async function play() {
    load();
    if (!started) {
      // ilk oynatma posterin karesinden (veri gelmeden verilen konum, üst veriler yüklenince uygulanır)
      started = true;
      try {
        video.currentTime = POSTER_T;
      } catch (e) {
        /* yoksay: baştan oynar */
      }
    }
    try {
      await video.play();
    } catch (e) {
      // Safari (iPhone/iPad): sayfa açılırken videonun görünürlüğü henüz hesaplanmadan gelen play() «NotAllowedError» ile reddedilir.
      // Kısa aralıklarla birkaç kez yeniden denenir; yine olmazsa (ör. Düşük Güç Modu) ilk dokunuşta açılır (unlock). Başka hata
      // (hızlı duraklatma, dosya yok) yoksayılır: poster + düğme kalır.
      if (e?.name === 'NotAllowedError' && retries < 5) {
        retries++;
        setTimeout(() => {
          if (canRun() && video.paused) play();
        }, 350 * retries);
      }
    }
  }
  let retries = 0;
  const canRun = () => wantPlay && !userPaused && !covered && inView && !document.hidden;
  // ilk dokunuş (tıklama) / tuş: tarayıcı kendiliğinden oynatmayı engellediyse ziyaretçinin etkileşimiyle açılır. Dinleyici pencerede
  // ve kabarcık aşamasında: oynat/duraklat düğmesinin kendi işleyicisi önce çalışır (duraklattıysa canRun yanlış, oynattıysa video
  // zaten oynuyor). «touchend» kullanılmaz: dokunuşta önce o gelir, düğmeye dokunuş videoyu başlatıp ardından gelen tıklama durdururdu.
  const unlock = () => {
    if (video.paused && canRun()) play();
  };
  const UNLOCK = ['click', 'keydown'];
  UNLOCK.forEach((t) => addEventListener(t, unlock, { passive: true }));
  const dropUnlock = () => UNLOCK.forEach((t) => removeEventListener(t, unlock));

  const onPlaying = () => {
    el.classList.add('has-video'); // poster karesinden başlar; duraklatınca son kare kalır
    ui(true);
    dropUnlock(); // bir kez oynadı: tarayıcı izni var
  };
  const onPause = () => ui(false);
  const onError = () => {
    el.classList.remove('has-video');
    ctl.hidden = true;
  };
  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);
  video.addEventListener('error', onError);

  // örtülme: beyaz sayfa kahramanın tamamını kapatınca dur, açılınca (izin varsa) sür
  const check = () => {
    const now = !!sheet && sheet.getBoundingClientRect().top <= 0;
    if (now === covered) return;
    covered = now;
    if (covered) video.pause();
    else if (canRun()) play();
  };
  on(scroll.onFrame(check));
  // video alanı ekrandan çıkınca dur, görününce (izin varsa) sür
  const io = new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    if (!inView) video.pause();
    else if (canRun()) play();
  }, { threshold: 0.15 });
  io.observe(media);

  const onVis = () => {
    if (document.hidden) video.pause();
    else if (canRun()) play();
  };
  document.addEventListener('visibilitychange', onVis);

  const onClick = () => {
    if (video.paused) {
      userPaused = false;
      wantPlay = true;
      play();
    } else {
      userPaused = true;
      video.pause();
    }
  };
  ctl.addEventListener('click', onClick);

  const offFx = fx.onChange(() => {
    wantPlay = auto();
    if (canRun()) play();
    else if (!userPaused) video.pause();
  });

  ui(false);
  ctl.hidden = false;
  check();
  if (canRun()) play();

  return () => {
    offFx();
    io.disconnect();
    dropUnlock();
    document.removeEventListener('visibilitychange', onVis);
    ctl.removeEventListener('click', onClick);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('error', onError);
    video.pause();
    el.classList.remove('has-video');
    if (loaded) {
      // indirmeyi bırak (sayfa değişti)
      video.removeAttribute('src');
      video.load();
    }
  };
}
