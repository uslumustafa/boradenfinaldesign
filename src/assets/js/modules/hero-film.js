// Kahraman videosu (ana sayfa, «Tam doğru zamanında»): ofis girişinden açık ofise uzanan kısa, sessiz döngü.
// Müşteri isteği (Ekim 2026): eski «Ofisimiz» filmi kaldırıldı, video kahramanın zemini oldu. Kurgu: scripts/tools/hero-film.py.
//
// Oynatma kuralları (bütçe + erişilebilirlik):
//   • Kendiliğinden oynatma: «Tam» ya da «Hafif» katman, geniş ekran (≥900 px) ve veri tasarrufu kapalı. Video sessiz ve döngülüdür;
//     beyaz sayfa kahramanın üstünü tamamen örtünce ve sekme gizlenince DURUR (pil/CPU), kahraman yeniden görünce sürer.
//   • «Kapalı» katman (hareket azaltma tercihi dahil), dar ekran ve veri tasarrufu: yalnızca poster (video dosyası hiç indirilmez);
//     «Videoyu oynat» düğmesi oynatmayı ziyaretçiye bırakır.
//   • «Duraklat / Videoyu oynat» düğmesi her zaman vardır (WCAG 2.2.2). Ziyaretçi duraklattıysa kaydırma ya da katman değişimi
//     videoyu kendiliğinden yeniden başlatmaz.
//   • İlk oynatma posterin karesinden başlar (POSTER_T): poster ile videonun ilk görünen karesi aynıdır, video posterin üstüne
//     yumuşakça açılır (sıçrama yok). Döngünün sonu ve başı laciverde geçişlidir (kesik görünmez).
//   • Dosya ekran genişliğine göre seçilir: cihaz pikseli genişliği (CSS px × DPR, DPR en çok 2) 1400'ü aşarsa 1080p, değilse 720p.
//     Dosya ilk oynatmada yüklenir (preload="none" + data-src).
// Depolama yok; sunucuya istek yok (yalnızca video dosyası).
const POSTER_T = 0.9; // sn — poster karesi (hero-film.py › POSTER_AT: 27. kare)

export function mount(el, { fx, scroll, on }) {
  const video = el.querySelector('.hero__video');
  const ctl = el.querySelector('[data-film-ctl]');
  const ctlT = el.querySelector('[data-film-ctl-t]');
  if (!video || !ctl || !video.dataset.src) return undefined;
  // kahramanın üstüne binen beyaz sayfa (giriş): üstü ekranın üstüne değince kahraman tamamen örtülmüştür
  const sheet = el.nextElementSibling;

  const saveData = !!navigator.connection?.saveData;
  const wide = matchMedia('(min-width: 900px)');
  const auto = () => fx.tier !== 'off' && !saveData && wide.matches; // kendiliğinden oynatma izni
  let wantPlay = auto();
  let userPaused = false;
  let covered = false;
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
      /* otomatik oynatma engellendi / hızlı duraklatma: poster + düğme kalır */
    }
  }
  const canRun = () => wantPlay && !userPaused && !covered && !document.hidden;

  const onPlaying = () => {
    el.classList.add('has-video'); // poster karesinden başlar; duraklatınca son kare kalır
    ui(true);
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
