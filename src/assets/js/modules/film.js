// Film bölümü (ana sayfa): ofis görüntüsü. Kaydırdıkça çerçeve genişleyip tam ekrana açılır.
//
// Oynatma kuralları (bütçe + erişilebilirlik):
//   • Otomatik oynatma yalnızca «Tam» efekt katmanında, geniş ekranda (≥900 px) ve veri tasarrufu kapalıyken; video sessiz ve döngülüdür,
//     görünür alan dışında DURUR (pil/CPU), sekme gizlenince durur.
//   • Diğer her durumda (Hafif/Kapalı katman, mobil, hareket azaltma, veri tasarrufu) yalnızca poster yüklenir (video dosyası hiç indirilmez);
//     «Videoyu oynat» düğmesi oynatmayı ziyaretçiye bırakır.
//   • «Duraklat/Oynat» düğmesi her zaman vardır (WCAG 2.2.2); ziyaretçi duraklattıysa kaydırma onu kendiliğinden yeniden başlatmaz.
//   • Video dosyası ilk gerektiğinde (görünür alana yaklaşınca) yüklenir: preload="none" + data-src.
// Depolama yok; sunucuya istek yok (yalnızca video dosyası).
import { smoothstep } from '../util.js';

export function mount(el, { fx, scroll, on }) {
  const video = el.querySelector('.film__video');
  const ctl = el.querySelector('[data-film-ctl]');
  const ctlT = el.querySelector('[data-film-ctl-t]');
  if (!video || !ctl || !video.dataset.src) return undefined;

  // ── çerçeve genişlemesi (--e: 0 → 1)
  if (fx.tier === 'off') el.style.setProperty('--e', '1');
  on(scroll.add(el, 'enter', (p) => el.style.setProperty('--e', fx.tier === 'off' ? '1' : smoothstep(0.06, 0.42, p).toFixed(4))));

  const saveData = !!navigator.connection?.saveData;
  const wide = matchMedia('(min-width: 900px)');
  let wantPlay = fx.tier === 'full' && !saveData && wide.matches; // otomatik oynatma izni
  let userPaused = false;
  let inView = false;
  let loaded = false;

  function ui(playing) {
    ctl.classList.toggle('is-playing', playing);
    ctl.setAttribute('aria-label', playing ? 'Videoyu duraklat' : 'Videoyu oynat');
    if (ctlT) ctlT.textContent = playing ? 'Duraklat' : 'Videoyu oynat';
  }
  function load() {
    if (loaded) return;
    loaded = true;
    video.src = video.dataset.src;
    video.preload = 'auto';
  }
  async function play() {
    load();
    try {
      await video.play();
    } catch (e) {
      /* otomatik oynatma engellendi / hızlı duraklatma: poster + düğme kalır */
    }
  }
  const onPlaying = () => {
    el.classList.add('has-video'); // ilk karede poster'ın üstüne açılır; duraklatınca son kare kalır
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

  const io = new IntersectionObserver(
    ([en]) => {
      inView = en.isIntersecting;
      if (inView && wantPlay && !userPaused) play();
      else if (!inView) video.pause();
    },
    { rootMargin: '120px 0px', threshold: 0.1 }
  );
  io.observe(el);

  const onVis = () => {
    if (document.hidden) video.pause();
    else if (inView && wantPlay && !userPaused) play();
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
    wantPlay = fx.tier === 'full' && !saveData && wide.matches;
    if (fx.tier === 'off') el.style.setProperty('--e', '1');
    if (inView && wantPlay && !userPaused) play();
    else video.pause();
  });
  ui(false);
  ctl.hidden = false;

  return () => {
    offFx();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    ctl.removeEventListener('click', onClick);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('error', onError);
    video.pause();
    if (loaded) {
      // indirmeyi bırak (sayfa değişti / efekt katmanı değişti)
      video.removeAttribute('src');
      video.load();
    }
  };
}
