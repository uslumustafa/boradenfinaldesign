// Araç sayfaları (hesaplayıcı, vergi takvimi) yalnızca gerektiğinde yüklenir: ağır kod ve hesap çekirdeği ayrı parçalardadır.
export function initCalculators(root, ctx) {
  const needCalc = root.querySelector('[data-calc]');
  const needCal = root.querySelector('[data-cal]');
  if (!needCalc && !needCal) return;
  let dead = false;
  ctx.on(() => {
    dead = true;
  });
  import('./calc-ui.js')
    .then((m) => {
      if (dead) return;
      if (needCalc) m.mountCalculators(root, ctx);
      if (needCal) m.mountCalendar(root, ctx);
    })
    .catch((err) => console.warn('[araçlar] yüklenemedi:', err));
}
