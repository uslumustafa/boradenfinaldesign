// Sahne başına 3B şeklin ekrandaki sol erimi → sayfa kahramanında başlık sütunu (30-layout.css › .phero --phero-col).
//
// Her formasyonun noktaları (formations.js) dünyanın kendi kamera yerleşimiyle (world.js › pose, VM'de çalışır) ekrana izdüşürülür.
// Şeklin dönerken (salınımın ya da tam turun her evresinde; fare paralaksının ±0,1 rad'ı dahil) ulaştığı en sol kenar bulunur:
// noktaların soldan %0,1'lik dilimi (tek tük nokta kenar sayılmaz). Tarayıcıda 12 evreyle ölçülen kenarlarla karşılaştırıldı
// (12 sayfa × 10 ekran, 120 ölçüm): hesap en çok 14 px iyimser → safetyPx kadar sola alınır.
//
// İki sütunlu düzende kenar ekran genişliği W ve yüksekliği H ile şöyle değişir (pose: şekil genişliğin sabit oranında durur,
// boyu ekran yüksekliğiyle ölçeklenir; en-boy 1,6'dan darsa kamera dm kadar uzaklaşır):
//     sol ≈ a·W − b·H/dm,   dm = clamp(1,6 / en-boy, 1, 1,25)
// Her sahne için ızgaradaki bütün ekranlarda kenarın solunda kalan en sıkı (a, b) çifti seçilir ve yüzde olarak yazılır
// (a aşağı, b yukarı yuvarlanır: sütun hiçbir ızgara ekranında kenarı geçmez) → src/data/scene-reach.json.
// CSS'te aynı ifade: max(a·vw − b·vh, min(a·vw − b/1,6·vw, a·vw − b/1,25·vh)).
//
// Şekiller, sahne yerleşimleri (formations.js › pose) ya da world.js › pose değişince yeniden üretin:
//     node scripts/scene-reach.mjs
// tests/scene-reach.test.mjs, verinin güncel şekillerle uyuştuğunu denetler.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { buildFormation, FORMATIONS, POSES, SPIN, SWAY } from '../src/assets/js/world/formations.js';
import { clamp, smoothstep } from '../src/assets/js/util.js';

export const OUT = new URL('../src/data/scene-reach.json', import.meta.url);
export const SETTINGS = { points: 4000, quantile: 0.001, phases: 36, safetyPx: 14, pointerTurn: 0.1 };
// Izgara: iki sütunlu düzen (> 900 px), en-boy 0,75–3
export const GRID = [];
for (const W of [960, 1024, 1100, 1180, 1280, 1366, 1440, 1536, 1600, 1680, 1920, 2240, 2560])
  for (const H of [600, 650, 700, 768, 800, 864, 900, 960, 1050, 1080, 1200, 1440]) if (W / H >= 0.75 && W / H <= 3) GRID.push([W, H]);
// Sağda şekil olmayan sahneler: ufuk arazisi tam genişlikte, yazının arkasında (404 ve ana sayfa)
export const SKIP = new Set(['ufuk']);

const worldSource = await readFile(new URL('../src/assets/js/world/world.js', import.meta.url), 'utf8');
const poseSource = worldSource.slice(worldSource.indexOf('  function pose('), worldSource.indexOf('  function frame('));
if (!poseSource.startsWith('  function pose(')) throw new Error('world.js › pose bulunamadı');

/** Sahnenin dönüş açıları: salınım ±(SWAY + fare), tam tur ya da sabit. */
export function anglesOf(k, n = SETTINGS.phases) {
  if (SWAY[k] > 0) {
    const m = SWAY[k] + SETTINGS.pointerTurn;
    return Array.from({ length: n + 1 }, (_, i) => -m + (2 * m * i) / n);
  }
  if (!SPIN[k]) return [0];
  return Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2);
}

/** k sahnesinin W×H ekranda (iki sütun, sağda) en sol kenarı, CSS px. F: buildFormation çıktısı. */
export function edgeOf(k, F, W, H, { quantile = SETTINGS.quantile, phases = SETTINGS.phases } = {}) {
  const camera = new PerspectiveCamera(48, W / H, 0.1, 400);
  const points = { rotation: new Euler() };
  const ctx = vm.createContext({
    POSES, SPIN, SWAY, clamp, smoothstep, camera, points, aspect: W / H, twoCol: W > 900, side: 1, lift: 0,
    pointer: { x: 0, y: 0 }, time: 0, camPos: new Vector3(), camLook: new Vector3(), material: { uniforms: { uBright: { value: 1 } } },
  });
  vm.runInContext(`${poseSource}\npose(${k}, ${k}, 0);`, ctx);
  camera.updateMatrixWorld();
  const view = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const m = new Matrix4();
  const rot = new Matrix4();
  const nf = F.nf;
  const keep = Math.floor(quantile * nf) + 1; // en küçük «keep» değer; sonuncusu dilim kenarı
  const low = new Float64Array(keep);
  let edge = Infinity;
  for (const a of anglesOf(k, phases)) {
    rot.makeRotationY(a);
    const e = m.multiplyMatrices(view, rot).elements;
    low.fill(Infinity);
    for (let j = 0; j < nf; j++) {
      const x = F.pos[j * 3];
      const y = F.pos[j * 3 + 1];
      const z = F.pos[j * 3 + 2];
      const w = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (w <= 0) continue;
      const px = (((e[0] * x + e[4] * y + e[8] * z + e[12]) / w + 1) / 2) * W;
      if (px >= low[keep - 1]) continue;
      let i = keep - 1;
      while (i > 0 && low[i - 1] > px) {
        low[i] = low[i - 1];
        i--;
      }
      low[i] = px;
    }
    edge = Math.min(edge, low[keep - 1]);
  }
  return edge;
}

const dmOf = (W, H) => clamp(1.6 / (W / H), 1, 1.25);

/** Kenar ölçümlerine (W, H, kenar) en sıkı uyan güvenli (a, b): her noktada a·W − b·H/dm ≤ kenar − SAFETY_PX. Yüzde döndürür. */
export function fit(samples, safetyPx = SETTINGS.safetyPx) {
  let best = null;
  for (let a = 0.4; a <= 0.95; a += 0.0005) {
    let b = -Infinity;
    for (const [W, H, edge] of samples) b = Math.max(b, (a * W - (edge - safetyPx)) / (H / dmOf(W, H)));
    let slack = 0;
    for (const [W, H, edge] of samples) slack += edge - safetyPx - (a * W - (b * H) / dmOf(W, H));
    if (!best || slack < best.slack) best = { a, b, slack };
  }
  return [Math.floor(best.a * 1000) / 10, Math.ceil(best.b * 1000) / 10];
}

/** Model kenarı (px): CSS'teki ifadenin aynısı. a, b yüzde. */
export const modelEdge = (a, b, W, H) => (a / 100) * W - ((b / 100) * H) / dmOf(W, H);

export async function computeAll({ grid = GRID, only = null } = {}) {
  const scenes = {};
  for (let k = 0; k < FORMATIONS.length; k++) {
    const id = FORMATIONS[k].id;
    if (SKIP.has(id) || (only && !only.includes(id))) continue;
    const F = buildFormation(k, SETTINGS.points);
    scenes[id] = fit(grid.map(([W, H]) => [W, H, edgeOf(k, F, W, H)]));
  }
  return scenes;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const t0 = Date.now();
  const scenes = await computeAll();
  const data = {
    note: 'scripts/scene-reach.mjs üretir; elle düzenlemeyin. [a, b] yüzde: şeklin sol kenarı ≈ a·vw − b·vh/dm (30-layout.css › --phero-col).',
    settings: SETTINGS,
    scenes,
  };
  await writeFile(OUT, JSON.stringify(data, null, 1) + '\n');
  console.log(`✔ ${Object.keys(scenes).length} sahne, ${GRID.length} ekran, ${((Date.now() - t0) / 1000).toFixed(1)} sn → src/data/scene-reach.json`);
}
