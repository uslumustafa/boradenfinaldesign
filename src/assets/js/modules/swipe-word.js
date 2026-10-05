// «BORADEN» anı (yalnızca ana sayfa kahramanı): fare yatayda hızla sağa-sola sallanırsa parçacıklar site yazı tipiyle
// BORADEN kelimesini oluşturur, ~3,6 sn durur (oluşum dahil), sonra çözülüp kahraman şekline döner.
//   • Hassas işaretçi + Tam/Hafif katman gerekir; dokunmatik/«Kapalı»/hareket azaltmada kurulmaz.
//   • Kelime resmî logodan değil, site yazı tipinden üretilir (logo kuralı: tek ve değişmez resmî dosya).
//   • Tetik: ~0,9 sn içinde ekran genişliğinin ≥ %20'si kadar en az 3 yatay kulaç + az dikey hareket. Bekleme: 6 sn.
//   • Her şey vazgeçilebilir: tıklama, tekerlek/kaydırma, klavye, imlecin kahraman dışına çıkması kelimeyi çözer.
export function mount(el, { fx, on, world }) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
  const html = document.documentElement;
  const WINDOW = 900; // ms
  const HOLD = 3600; // kelime ekranda kalma süresi (ms)
  const COOL = 6000; // sonraki tetik için bekleme (ms)
  let samples = [];
  let active = false;
  let holdT = 0;
  let outT = 0;
  let coolUntil = 0;
  let y0 = 0;

  function strokes(list, minLen) {
    let ext = list[0].x;
    let start = ext;
    let dir = 0;
    let n = 0;
    for (const s of list) {
      const d = s.x - ext;
      if (dir === 0) {
        if (Math.abs(d) > 40) {
          dir = Math.sign(d);
          start = ext;
          ext = s.x;
        }
      } else if (d * dir > 0) ext = s.x; // aynı yönde sürüyor
      else if (Math.abs(d) > 40) {
        // yön değişti: önceki kulacı say
        if (Math.abs(ext - start) >= minLen) n++;
        dir = -dir;
        start = ext;
        ext = s.x;
      }
    }
    if (dir !== 0 && Math.abs(ext - start) >= minLen) n++;
    return n;
  }

  function show() {
    if (active) return;
    active = true;
    y0 = scrollY;
    clearTimeout(outT);
    html.classList.remove('is-word-out');
    html.classList.add('is-word');
    world.word(true);
    holdT = setTimeout(hide, HOLD);
  }
  function hide() {
    if (!active) return;
    active = false;
    clearTimeout(holdT);
    coolUntil = performance.now() + COOL;
    samples = [];
    world.word(false);
    html.classList.add('is-word-out');
    html.classList.remove('is-word');
    outT = setTimeout(() => html.classList.remove('is-word-out'), 1300);
  }

  const onMove = (e) => {
    if (fx.tier === 'off' || e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (active) {
      // kahraman dışına çıkılırsa kelime çözülür
      if (e.clientY > innerHeight * 0.96 || e.clientY < 0) hide();
      return;
    }
    if (now < coolUntil || html.classList.contains('is-opening') || !html.classList.contains('is-ready')) return;
    if (scrollY > innerHeight * 0.45 || e.clientY < 60) return; // yalnızca ilk ekran; üst çubuk bölgesinde değil
    samples.push({ t: now, x: e.clientX, y: e.clientY });
    while (samples.length && now - samples[0].t > WINDOW) samples.shift();
    if (samples.length < 8) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of samples) {
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    if (maxY - minY > innerHeight * 0.4) return;
    if (strokes(samples, innerWidth * 0.2) >= 3) show();
  };
  const cancel = () => active && hide();
  const onScroll = () => active && Math.abs(scrollY - y0) > 40 && hide();
  const onKey = () => cancel();
  const offFx = fx.onChange(() => cancel());

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', cancel, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('keydown', onKey);
  const unmount = () => {
    offFx();
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', cancel);
    removeEventListener('scroll', onScroll);
    removeEventListener('keydown', onKey);
    clearTimeout(holdT);
    clearTimeout(outT);
    if (active) world.word(false);
    html.classList.remove('is-word', 'is-word-out');
  };
  on(unmount);
  return undefined;
}
