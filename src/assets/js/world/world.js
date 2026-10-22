// Kalıcı 3B "dünya": tek WebGL tuvali, sayfalar arasında yaşar. Noktalar bir formasyondan diğerine akar.
// Efekt katmanı (Tam/Hafif/Kapalı) ve görünürlüğe göre çalışır; görünmezken 0 fps.
//
// Görünürlük (v3): iri, parıltılı noktalar; ufuk arazisinde yavaş dalga; «Tam» katmanda fare lensi (ekran uzayında itme + parlama);
// açılışta (opts.intro) noktalar dağınık hâlden formasyona toplanır — assemble() ile başlatılır.
//
// Sahne değişimi (müşteri geri bildirimi, Ekim 2026: «kaydırdıkça belirgin değişim animasyonu; hangi bölümse onun şekli doğrudan
// gelsin, araya önceki/ilk şekil girmesin»):
//   · görünürken hedef değişince şekil, ekrandaki hâlinden hedef şekle DOĞRUDAN dönüşür (herhangi iki şekil; ara sahne, solma yok):
//     noktalar kendi gecikmeleriyle hafif girdaplı bir yay çizerek akar (MORPH_S). Dönüşüm sürerken hedef yine değişirse ekrandaki
//     ara hâl dondurulur (freeze) ve oradan yeni hedefe gidilir — önceki şekle dönülmez.
//   · dünya görünmezken (araya beyaz bölümler girince) tuval boşaltılır; sonraki koyu bölüm ekrana girerken eski şekil hiç
//     görünmez, bölümün kendi şekli toplanarak belirir (FORM_S). Aynı bölüme dönülünce şekil zaten oradadır (yeniden toplanmaz).
//   · tam sayfa yüklemesinde ilk kare sayfanın şekliyle başlar ve toplanarak belirir; sayfa geçişinde noktalar dışarı akar, yeni
//     sayfanın şekli noktalar dışarıdayken oturur ve içeri akar.
import { WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Sphere, Vector2, Vector3 } from 'three';
import { lazyFormations, mulberry32, POSES, SPIN, SWAY, FORMATION_COUNT } from './formations.js';
import { clamp, smoothstep } from '../util.js';

// Fare lensi (yalnızca «Tam» katman): imlecin hemen çevresindeki noktalar hafifçe itilir, biraz büyür ve parlar.
// Bilerek küçük ve ince tutulur — yalnızca imleç ucunda küçük bir parıltı; model okunur kalır. Hepsi buradan ayarlanır:
//   falloff — düşüş sertliği; etki yarıçapı (%10 şiddet) ≈ √(2,3 / falloff) × ekran yüksekliğinin yarısı (120 → ≈ %14 → 900 px'te ≈ 62 px)
//   push    — merkezde en fazla itme, NDC birimi (0,022 → 900 px'te ≈ 10 px)
//   grow    — merkezde nokta boyutu artışı (katsayı)      glow — merkezde parlaklık artışı (katsayı)
const LENS = { falloff: 120, push: 0.012, grow: 0.5, glow: 0.7 }; // Ekim 2026 (okunurluk): itme 0,022 → 0,012
const glf = (n) => n.toFixed(3); // GLSL ondalık sabiti

// Sahne dönüşümü ve toplanma — hepsi buradan ayarlanır (CPU'daki freeze() aynı sabitleri kullanır):
const MORPH_S = 0.8; // dönüşüm süresi (sn) — Ekim 2026: 1,15 sn önizlemesinden sonra «daha hızlı» istendi
const MORPH_ST = 0.3; // noktaya özgü gecikme payı: dönüşüm şeklin üzerinden dalga gibi geçer (her nokta ≈ 0,56 sn yol alır)
const SWIRL = 0.75; // dönüşüm yolundaki girdap: dikey eksen çevresinde en çok dönüş (rad, yolun ortasında)
const BULGE = 0.7; // yolun noktaya özgü sabit sapması (dünya birimi, yolun ortasında)
const FORM_S = 0.8; // bölüm ekrana girince şeklin toplanma süresi (sn)
const FORM_COVER = 0.4; // toplanma, bölümün görünen kısmı min(ekran, bölüm) yüksekliğinin bu oranına varınca başlar

const VERT = /* glsl */ `
  attribute vec3 aB;
  attribute vec2 aSA;
  attribute vec2 aSB;
  attribute vec2 aR;
  attribute vec4 aM;
  attribute vec2 aW;
  attribute float aK;
  uniform float uWord;
  uniform float uSurge;
  uniform vec2 uSurgeO;
  uniform float uMix;
  uniform float uTime;
  uniform float uPx;
  uniform float uFade;
  uniform float uBright;
  uniform float uIntro;
  uniform float uWave;
  uniform vec2 uWv;
  uniform float uForm;
  uniform float uAspect;
  uniform vec3 uPtr;
  varying float vA;
  varying vec3 vC;
  varying vec3 vS;

  vec3 tintOf(float t) {
    if (t < 0.5) return vec3(0.84, 0.91, 1.00);
    if (t < 1.5) return vec3(0.36, 0.72, 0.98);
    if (t < 2.5) return vec3(1.00, 0.46, 0.34);
    return vec3(0.34, 0.86, 0.50);
  }
  float h11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
  // ufuk arazisinin yavaş dalgası (world.js › waveY ile aynı)
  float waveY(vec3 q) {
    return sin(q.x * 0.33 + uTime * 0.7) * cos(q.z * 0.27 - uTime * 0.5) * 0.30 + sin(q.x * 0.9 - uTime * 1.1 + q.z * 0.4) * 0.07;
  }
  vec2 rot(vec2 v, float a) {
    float c = cos(a);
    float n = sin(a);
    return vec2(c * v.x - n * v.y, n * v.x + c * v.y);
  }

  void main() {
    float s = aR.y;
    // Sahne dönüşümü: A (position) → B (aB). Her nokta kendi gecikmesiyle (aR.x) yola çıkar; yol, dikey eksen çevresinde hafif
    // girdaplı bir yaydır (aM: noktaya özgü sabitler). Yol zamandan bağımsızdır: yarıda kesilen dönüşüm world.js › freeze()
    // ile CPU'da birebir dondurulur ve yeni hedefe oradan devam edilir.
    float t = clamp((uMix - aR.x * ${glf(MORPH_ST)}) / ${glf(1 - MORPH_ST)}, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 pa = position;
    pa.y += uWv.x * waveY(pa);
    vec3 pb = aB;
    pb.y += uWv.y * waveY(pb);
    vec3 p = mix(pa, pb, t);
    float w = sin(t * 3.14159265);
    // girdap: uzak noktalar (ufuk arazisi) daha az döner — yer değiştirme sınırlı kalır
    p.xz = rot(p.xz, w * aM.x * ${glf(SWIRL)} / (1.0 + length(p.xz) * 0.08));
    p += aM.yzw * w * ${glf(BULGE)};
    p += vec3(sin(uTime * 0.28 + s * 40.0), cos(uTime * 0.25 + s * 31.0), sin(uTime * 0.2 + s * 17.0)) * 0.05;
    // Toplanma (uForm 0 → 1): bölüm ekrana girince şekil, çevresindeki gevşek bir buluttan dönerek kendi yerine süzülür;
    // önceki sahnenin şekli hiç görünmez. uForm = 0 iken noktalar görünmez.
    float g = clamp((uForm - aR.x * 0.4) / 0.6, 0.0, 1.0);
    float ge = 1.0 - pow(1.0 - g, 3.0);
    if (ge < 1.0) {
      vec3 gd = normalize(aM.yzw + vec3(0.001, 0.0, 0.0));
      p.xz = rot(p.xz, (1.0 - ge) * 0.9);
      p += gd * (2.2 + 2.6 * aM.x) * (1.0 - ge);
    }

    // açılış: dağınık hâlden formasyona toplanma (noktaya özgü gecikme, yavaşlayan varış)
    float it = clamp((uIntro - aR.x * 0.5) / 0.5, 0.0, 1.0);
    it = 1.0 - pow(1.0 - it, 3.0);
    vec3 sc = (vec3(h11(s * 3.1), h11(s * 5.7), h11(s * 7.9)) - 0.5) * vec3(78.0, 46.0, 64.0) + vec3(0.0, 2.0, -8.0);
    p = mix(sc, p, it);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;

    // fare lensi: ekran uzayında hafif itme + parlama
    vec2 ndc = clip.xy / clip.w;
    // «BORADEN» anı: noktalar ekran uzayında kelimeye dizilir (aW: yükseklik birimi, x ∈ [-aspect, aspect]); %10'u şekilde kalır
    float wt = clamp((uWord - aR.x * 0.5) / 0.5, 0.0, 1.0);
    wt = wt * wt * (3.0 - 2.0 * wt) * step(0.1, s);
    if (wt > 0.0) {
      vec2 tgt = vec2(aW.x / uAspect, aW.y);
      float ww = sin(wt * 3.14159265);
      ndc = mix(ndc, tgt, wt)
          + vec2(sin(s * 6.2831 + uTime * 0.9), cos(s * 9.4 + uTime * 0.7)) * ww * 0.2
          + vec2(sin(uTime * 1.3 + s * 40.0), cos(uTime * 1.1 + s * 31.0)) * 0.004 * wt;
    }
    vec2 d = (ndc - uPtr.xy) * vec2(uAspect, 1.0);
    float push = exp(-dot(d, d) * ${glf(LENS.falloff)}) * uPtr.z;
    ndc += normalize(d + vec2(1e-4)) * push * ${glf(LENS.push)} / vec2(uAspect, 1.0);

    // sayfa geçişi: noktalar tıklanan noktadan dışarı akar (uSurge 0→1); yeni sayfada içeri akıp şekle oturur (1→0).
    // Ekran uzayında ölçekleme + uzayan parıltı (hız çizgisi); noktaya özgü hız → derinlik hissi.
    float sg = 0.0;
    float sp = 0.0;
    vec2 sdir = vec2(1.0, 0.0);
    if (uSurge > 0.001) {
      sp = 0.55 + 1.65 * h11(s * 11.3);
      sg = uSurge * (0.94 + 0.06 * sin(uTime * 3.0 + s * 20.0));
      // dışarı akarken hafif girdap: noktaya özgü hızla dönerek uzaklaşır (girişte tersine, yerine dönerek oturur)
      float ang = sg * sp * 0.2;
      vec2 dp = (ndc - uSurgeO) * vec2(uAspect, 1.0);
      dp = vec2(cos(ang) * dp.x - sin(ang) * dp.y, sin(ang) * dp.x + cos(ang) * dp.y);
      sdir = normalize(dp + vec2(1e-4, 0.0));
      ndc = uSurgeO + dp / vec2(uAspect, 1.0) * (1.0 + sg * sp * 2.2);
    }
    vS = vec3(sdir.x, -sdir.y, sg * sp * 1.1);
    gl_Position = vec4(ndc * clip.w, clip.zw);

    float dist = max(1.0, -mv.z);
    float size = mix(aSA.x, aSB.x, t);
    float tn = t < 0.5 ? aSA.y : aSB.y;
    // dönüşüm ve toplanma yolundaki noktalar biraz iri ve parlak: akış belirgin görünür
    float psz = max(2.1, size * uPx * 1.12 * (96.0 / dist) * (1.0 + w * 0.25 + (1.0 - ge) * 0.3 + push * ${glf(LENS.grow)}));
    gl_PointSize = mix(psz, max(2.2, 2.6 * uPx), wt);
    gl_PointSize = min(gl_PointSize * (1.0 + sg * (0.9 + 1.2 * sp)), 90.0);
    // okunurluk (Ekim 2026): titreme ve nokta başına parlaklık farkı azaltıldı; şekil daha dolu ve sabit görünür
    float tw = 0.86 + 0.14 * sin(uTime * (0.6 + fract(s * 13.7)) + s * 50.0);
    vA = (0.72 + 0.28 * fract(s * 7.31)) * tw * smoothstep(170.0, 12.0, dist) * uBright * uFade * (1.0 + push * ${glf(LENS.glow)}) * smoothstep(0.0, 0.22, it);
    vA *= (1.0 + w * 0.12) * smoothstep(0.0, 0.4, g);
    vA = mix(vA, 0.95 * uFade * (1.0 + push * ${glf(LENS.glow * 0.8)}), wt);
    vA *= (1.0 + sg * 1.5) * (1.0 - smoothstep(0.95, 1.0, uSurge));
    // kahraman (uWave>0): ekranın alt kısmı sakinleşir → alt bilgi metni ve düğmeler okunur kalır
    vA *= 1.0 - uWave * 0.9 * (1.0 - smoothstep(-0.85, -0.25, ndc.y));
    // kenar (müşteri geri bildirimi, Ekim 2026: «kenarlarda uçuşan noktalar»): şekil noktaları ekranın kenarına yaklaşırken söner;
    // kenarda yarım kalmış şekil parçası görünmez. «BORADEN» kelimesi (wt) ve sayfa geçişindeki akış (uSurge) olduğu gibi kalır.
    float edge = (1.0 - smoothstep(0.80, 0.98, abs(ndc.x))) * (1.0 - smoothstep(0.86, 1.0, abs(ndc.y)));
    vA *= mix(1.0, edge, aK * (1.0 - wt) * (1.0 - smoothstep(0.0, 0.15, uSurge)));
    // arka plan tozu (aK = 0, ekranın her yerinde süzülen sönük «yıldızlar»): müşteri isteğiyle görünmez. Yalnızca «BORADEN»
    // kelimesine katılırken ve sayfa geçişi akışında görünür (kelime ve akış seyrekleşmesin), sonra yumuşakça söner.
    vA *= mix(max(wt, smoothstep(0.0, 0.15, uSurge)), 1.0, aK);
    vC = tintOf(tn);
  }
`;

const FRAG = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  varying vec3 vS;
  void main() {
    // geçiş sırasında nokta, hareket yönünde uzayan ince çizgiye dönüşür (vS.xy: yön, vS.z: uzama)
    vec2 c = (gl_PointCoord - 0.5) * 2.0;
    float r = length(vec2(dot(c, vS.xy), dot(c, vec2(-vS.y, vS.x)) * (1.0 + vS.z)));
    if (r > 1.0) discard;
    // daha net nokta (Ekim 2026): çekirdek biraz daha geniş ve sert, hale daha dar ve sönük
    float core = 1.0 - smoothstep(0.1, 0.6, r);
    float halo = pow(1.0 - r, 3.2);
    float a = core * 1.0 + halo * 0.3;
    gl_FragColor = vec4(vC * (0.9 + 0.5 * core), a * vA);
  }
`;

const LAST = FORMATION_COUNT - 1; // son sahne sırası
const INTRO_S = 2.2; // toplanma süresi (sn)
const SURGE_OUT = 350; // sayfa geçişi: noktaların ekran dışına akma süresi (ms) — yönlendirici bu süre dolunca içeriği değiştirir (U-20)
const SURGE_IN = 850; // sayfa geçişi: yeni sayfada noktaların içeri akıp şekle oturma süresi (ms)
const FROZEN = -2; // dondurulmuş ara hâl (yarıda kesilen dönüşüm): A tamponunda, kendi duruşuyla (frozen)
const PI = Math.PI;

// ufuk arazisinin dalgası — VERT › waveY ile birebir aynı (freeze() dalgalı A/B konumunu dondururken kullanır)
const waveY = (x, z, T) => Math.sin(x * 0.33 + T * 0.7) * Math.cos(z * 0.27 - T * 0.5) * 0.3 + Math.sin(x * 0.9 - T * 1.1 + z * 0.4) * 0.07;
const lerpPose = (PA, PB, e) => {
  const L = (u, v) => u + (v - u) * e;
  return {
    pos: [0, 1, 2].map((i) => L(PA.pos[i], PB.pos[i])),
    look: [0, 1, 2].map((i) => L(PA.look[i], PB.look[i])),
    fov: L(PA.fov, PB.fov),
    bright: L(PA.bright, PB.bright),
    lx: L(PA.lx ?? 1, PB.lx ?? 1),
    ls: L(PA.ls ?? 1, PB.ls ?? 1),
    ll: L(PA.ll ?? 0, PB.ll ?? 0),
  };
};

// WebGL 2 desteği önce küçük, atılan bir tuvalde sınanır (T-35): yoksa three.js çiziciyi kurmaya çalışıp konsola hata yazmaz;
// dünya kurulmaz ve efektler «Kapalı»ya düşer (main.js › bootWorld). Sınama bağlamı hemen bırakılır.
// Ekran kartı yoksa (ya da sürücü engelliyse) tarayıcı WebGL'i işlemciyle çizer (SwiftShader, llvmpipe, Windows'un temel görüntü
// sürücüsü): 3B dünya o makinede çok ağır kalır — tarayıcının «büyük başarım kaybı» işareti ya da çizicinin adı yazılımı
// gösteriyorsa dünya kurulmaz, efektler kendiliğinden «Kapalı» (22 Ekim 2026: GitHub'ın ekran kartı olmayan sunucusunda Chrome
// WebGL 2'yi yazılımla açınca dünya kurulup yalnızca yavaşlık ölçüsüyle, saniyeler sonra düşüyordu).
const SOFT_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;
function webgl2Ok() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !SOFT_GL.test(name);
  } catch (e) {
    return false;
  }
}

export async function createWorld({ fx, canvas, intro = false }) {
  const html = document.documentElement;
  const P = fx.params();
  if (!webgl2Ok()) return null;
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setClearColor(0x000000, 0);

  const N = P.points;
  const F = lazyFormations(N); // formasyonlar ilk erişimde üretilir (şekillerin tamamı açılışta değil)
  const scene = new Scene();
  const camera = new PerspectiveCamera(48, 1, 0.1, 400);

  // ── geometri: A formasyonu "position", B formasyonu aB
  const geo = new BufferGeometry();
  const aPos = new BufferAttribute(new Float32Array(N * 3), 3);
  const aB = new BufferAttribute(new Float32Array(N * 3), 3);
  const aSA = new BufferAttribute(new Float32Array(N * 2), 2);
  const aSB = new BufferAttribute(new Float32Array(N * 2), 2);
  const rnd = mulberry32(777);
  const rArr = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    rArr[i * 2] = rnd();
    rArr[i * 2 + 1] = rnd();
  }
  geo.setAttribute('position', aPos);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aSA', aSA);
  geo.setAttribute('aSB', aSB);
  const aW = new BufferAttribute(new Float32Array(N * 2), 2); // «BORADEN» hedefleri (ekran uzayı)
  geo.setAttribute('aR', new BufferAttribute(rArr, 2));
  // aK: 1 = şekil noktası, 0 = arka plan tozu (formations.js › buildFormation: ilk %90 şekil, kalanı her sahnede aynı toz)
  const kArr = new Float32Array(N);
  kArr.fill(1, 0, Math.floor(N * 0.9));
  geo.setAttribute('aK', new BufferAttribute(kArr, 1));
  geo.setAttribute('aW', aW);
  // aM: dönüşüm yolunun noktaya özgü sabitleri — x: girdap kazancı (0,5–1), yzw: yay sapması / toplanma yönü (−1..1)
  const rm = mulberry32(31337);
  const mArr = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    mArr[i * 4] = 0.5 + 0.5 * rm();
    mArr[i * 4 + 1] = rm() * 2 - 1;
    mArr[i * 4 + 2] = rm() * 2 - 1;
    mArr[i * 4 + 3] = rm() * 2 - 1;
  }
  geo.setAttribute('aM', new BufferAttribute(mArr, 4));
  geo.boundingSphere = new Sphere(new Vector3(), 1e4);

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uPx: { value: 1 },
      uFade: { value: 1 },
      uBright: { value: 1 },
      uIntro: { value: intro ? 0 : 1 },
      uWave: { value: 0 },
      uWv: { value: new Vector2(0, 0) },
      uForm: { value: 1 },
      uAspect: { value: 1 },
      uPtr: { value: new Vector3(0, 0, 0) },
      uWord: { value: 0 },
      uSurge: { value: 0 },
      uSurgeO: { value: new Vector2(0, 0) },
    },
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  let pairA = -1;
  let pairB = -1;
  function fillPair(a, b) {
    // FROZEN: A tamponunu freeze() doldurdu (yarıda kesilen dönüşümün ekrandaki hâli)
    if (a !== pairA && a !== FROZEN) {
      aPos.array.set(F[a].pos);
      for (let i = 0; i < N; i++) {
        aSA.array[i * 2] = F[a].size[i];
        aSA.array[i * 2 + 1] = F[a].tint[i];
      }
      aPos.needsUpdate = true;
      aSA.needsUpdate = true;
      pairA = a;
    }
    if (b !== pairB) {
      aB.array.set(F[b].pos);
      for (let i = 0; i < N; i++) {
        aSB.array[i * 2] = F[b].size[i];
        aSB.array[i * 2 + 1] = F[b].tint[i];
      }
      aB.needsUpdate = true;
      aSB.needsUpdate = true;
      pairB = b;
    }
  }

  // ── durum
  // Sahne: sFrom → sTo dönüşümü, m ∈ [0, 1] (0: sFrom, 1: sTo); durağanken sFrom === sTo. sFrom = FROZEN: yarıda kesilen
  // dönüşümün ekrandaki hâli (A tamponunda; duruşu, dönüşü ve dalga payı `frozen` içinde).
  let sFrom = 0;
  let sTo = 0;
  let m = 0;
  let mDir = 1; // 1: sTo'ya, -1: geri sFrom'a (hedef eski şekle dönerse aynı yoldan geri)
  let sTarget = 0;
  let frozen = null; // { pose, turn, dim }
  let lastFreeze = -1;
  let lift = 0; // formasyonun ekranda yukarı kayması (görüntü yüksekliğinin oranı); bölümün görünen ortasına hizalar
  let liftT = 0;
  let side = 1; // formasyonun ekrandaki tarafı: 1 sağ, -1 sol (düzen değişince süzülür)
  let sideT = 1;
  // Toplanma: 1 oturmuş; 0..1 bölüm ekrana girerken şekil toplanıyor. formWait: bölümün yeterince görünmesi bekleniyor (görünmez)
  let formV = 1;
  let formRun = false;
  let formWait = false;
  let cover = 1; // seçili bölümün görünen kısmı / min(ekran, bölüm) yüksekliği (director)
  let blank = false; // tuval boşaltıldı (dünya görünmezken): sonraki görünüşte eski kare değil, bölümün şekli gelir
  let appear = false; // görünmezlikten sonra ilk hedef bekleniyor
  let cutV = -1; // ≥ 0: bitişik olmayan bölüme geçiş — eski şekil hızla söner (uFade 1 → 0), sonra yeni bölümün şekli toplanır
  let lastScene = -1; // görünürken en son çizilen sahne (dönüşüm sürüyorsa hedefi); aynı bölüme dönülünce yeniden toplanmaz
  let visible = false;
  let running = false;
  let rafId = 0;
  let last = performance.now();
  let time = 0;
  let aspect = 1;
  // sayfa iki sütunlu mu (> 900 px; ya da yan çevrilmiş telefon: 601–900 px, en-boy ≥ 1,5): şekil sağ/sol sütunda durur, başlık
  // sütunu ona göre daralır (30-layout.css › .phero, aynı koşul); değilse metnin arkasında ortalanır
  let twoCol = true;
  let firstFrame = true;
  let introV = intro ? 0 : 1; // 0: dağınık/görünmez → 1: toplanmış
  let introRun = false;
  let introT = 0;
  let wordV = 0; // «BORADEN» anı ilerlemesi 0..1
  let wordT = 0; // hedef
  // Sayfa geçişi akışı 0..1 (0: şekilde, 1: noktalar ekran dışına akmış). Kare hızından bağımsız, SAATLE ilerler: kareler takılsa da
  // (ağır sayfa, yavaş GPU, sayfa değişimi) çıkış SURGE_OUT ms'de tamamlanır; yeni sayfanın şekli her seferinde noktalar dışarıdayken
  // oturur. (Önceden kare başına en çok 0,1 sn sayılıyordu: takılan karelerde noktalar dışarı varamadan sayfa değişiyor, yeni şekil
  // içeri akmak yerine eski şekil geri toplanıp çözülerek değişiyordu — «geçiş bazen gelmiyor».)
  let surgeV = 0;
  let surgeT = 0; // hedef
  let surgeFrom = 0; // geçerli ayağın başlangıç değeri
  let surgeAt = 0; // geçerli ayağın başlangıç anı (ms); NaN: giriş, yeni şeklin hazırlanıp ilk kez çizileceği kareyi bekliyor
  let snapOpen = false; // girişte (noktalar hâlâ dışarıdayken) gelen sahne hedefi çözülmeden/süzülmeden doğrudan oturur
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }; // kamera paralaksı (-1..1)
  const lens = { x: 0, y: 0, tx: 0, ty: 0, k: 0, kt: 0, at: 0 }; // fare lensi (NDC)
  const dt_samples = [];
  let slowWindows = 0;
  const camPos = new Vector3();
  const camLook = new Vector3();

  // akışın verilen andaki değeri (saatle)
  function surgeAtTime(now) {
    if (surgeT > 0) return clamp(surgeFrom + Math.max(0, now - surgeAt) / SURGE_OUT);
    if (Number.isNaN(surgeAt)) return surgeFrom;
    return clamp(surgeFrom - Math.max(0, now - surgeAt) / SURGE_IN);
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(P.dpr);
    renderer.setSize(w, h, false);
    aspect = w / h;
    twoCol = w > 900 || (w > 600 && aspect >= 1.5);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    material.uniforms.uAspect.value = aspect;
    material.uniforms.uPx.value = P.dpr * clamp(h / 900, 0.7, 1.45);
  }
  const ro = new ResizeObserver(() => {
    clearTimeout(resize._t);
    resize._t = setTimeout(resize, 120);
  });
  ro.observe(canvas.parentElement);
  resize();

  const onPointer = (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
    lens.tx = pointer.tx;
    lens.ty = pointer.ty;
    lens.at = performance.now();
    if (!lens.k) {
      lens.x = lens.tx;
      lens.y = lens.ty;
    }
  };
  if (P.pointer) addEventListener('pointermove', onPointer, { passive: true });
  const onLost = (e) => {
    e.preventDefault();
    fx.set('off');
  };
  canvas.addEventListener('webglcontextlost', onLost);
  const onVis = () => (document.hidden ? stop() : visible && start());
  document.addEventListener('visibilitychange', onVis);

  function pose(a, b, f) {
    const e = smoothstep(0, 1, f);
    const PA = poseOf(a);
    const PB = poseOf(b);
    const k0 = twoCol ? aspect * 0.5 : clamp((aspect - 1.0) / 0.75); // iki sütunda formasyon genişliğin sabit oranında (≈ %68) durur; dar ekranda ortalanır ve metnin arkasında söner
    const k = k0 * (side < 0 ? side * (PA.lx ?? 1) * (1 - e) + side * (PB.lx ?? 1) * e : side); // side<0 → solda (lx: sol yerleşim kazancı)
    const L = (u, v) => u + (v - u) * e;
    const fovNow = L(PA.fov, PB.fov) + (aspect < 1 ? 8 : 0);
    // ls: solda yerleşimde kamera uzaklığı çarpanı (formasyon biraz küçülür; metin sütununa taşmaz)
    // dm: iki sütunda ekran en-boy oranı 1,6'dan darsa (ör. 1100×800) formasyon sütununa sığsın diye biraz uzaklaşılır (merkez oranı korunur)
    const dm = twoCol ? clamp(1.6 / aspect, 1, 1.25) : 1;
    const left = Math.max(0, -side);
    const zs = dm * (1 + left * (L(PA.ls ?? 1, PB.ls ?? 1) - 1));
    const ly = L(PA.look[1], PB.look[1]);
    const lz = L(PA.look[2], PB.look[2]);
    // formasyon düzleminde görüntü yüksekliği (dünya birimi): sağda yerleşimde sabit 19 birim uzaklıkla (tarihsel; kahraman ve bant
    // ayarları buna göre), solda yerleşimde kameranın gerçek uzaklığıyla — şekil, bant bağlamalı bölümde (data-world-anchor) kaydırırken
    // bandın yazısıyla aynı ölçüde kayar (uzak kamerada sabit 19 birim, şeklin yazının gerisinde kalmasına yol açıyordu)
    const dist = 19 + left * ((L(PA.pos[2], PB.pos[2]) - lz) * zs - 19);
    const viewH = 2 * dist * Math.tan((fovNow * Math.PI) / 360);
    // ll: solda yerleşimde ek yukarı kayma (görüntü yüksekliğinin oranı; eksi → aşağı), yalnızca iki sütunda. Ana sayfa Sektörler
    // bandında sol üstte tanım yazısı durur; sektör şekilleri onun altına iner (sağda yerleşimi — sektör sayfası kahramanı — ve tek
    // sütunlu dar düzeni — şekil görünen bandın ortasında, yazının arkasında söner — değiştirmez)
    const ll = twoCol ? left * L(PA.ll ?? 0, PB.ll ?? 0) : 0;
    const dy = -(lift + ll) * viewH;
    camPos.set(L(PA.pos[0], PB.pos[0]) * k * dm + pointer.x * 0.9, ly + (L(PA.pos[1], PB.pos[1]) - ly) * zs + pointer.y * 0.5 + dy, lz + (L(PA.pos[2], PB.pos[2]) - lz) * zs + (aspect < 1 ? 4 : 0));
    camLook.set(L(PA.look[0], PB.look[0]) * k * dm, ly + dy, lz);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const fov = L(PA.fov, PB.fov) + (aspect < 1 ? 8 : 0);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    material.uniforms.uBright.value = L(PA.bright, PB.bright) * (0.5 + 0.5 * Math.min(1, k0));
    points.rotation.y = turnMix(turnOf(a), turnOf(b), e);
  }

  // pose yardımcıları (sc < 0: dondurulmuş ara hâl — FROZEN). İşlev bildirimi olarak pose'un hemen ardında durur:
  // scripts/scene-reach.mjs ve tests/world-contact-pose.test.mjs pose'u «function pose( … function frame(» dilimiyle VM'de çalıştırır.
  function poseOf(sc) {
    return sc < 0 ? frozen.pose : POSES[sc];
  }
  // SWAY > 0: sürekli dönmek yerine ±SWAY rad salınır (kapı, düzlemsel şekiller); aksi hâlde SPIN çarpanıyla yavaş dönüş.
  // Salınım genliği %60 (Ekim 2026, okunurluk): yazı ve tablo gibi düzlemsel şekiller daha önden görünür.
  function turnOf(sc) {
    if (sc < 0) return frozen.turn;
    return SWAY[sc] > 0 ? Math.sin(time * 0.24) * SWAY[sc] * 0.6 + pointer.x * 0.1 : (SPIN[sc] ?? 1) * (time * 0.035 + pointer.x * 0.1);
  }
  // iki dönüş açısı arasında en kısa yoldan geçiş: sürekli dönen (SPIN, açı zamanla büyür) şekilden salınan (SWAY) şekle geçerken
  // nesne birkaç tur dönmesin (görünüm 2π'ye göre aynıdır; geçiş bitince açı tam 2π katı kadar sıçrar, görünmez)
  function turnMix(u, v, e) {
    const d = v - u;
    return u + (d - 2 * Math.PI * Math.round(d / (2 * Math.PI))) * e;
  }
  // ufuk arazisi (sahne 0): dalga yer değiştirmesi; dondurulmuş hâlde dalga konuma işlenmiştir
  function waveOf(sc) {
    return sc === 0 ? 1 : 0;
  }
  // kahramanın (ufuk arazisi) alt kısmını sakinleştirme payı
  function dimOf(sc) {
    return sc < 0 ? frozen.dim : sc === 0 ? 1 : 0;
  }

  // Yarıda kesilen dönüşümün ekrandaki hâlini (VERT ile birebir aynı hesap) A tamponuna dondurur; dönüşüm oradan sTarget'a sürer.
  // Böylece hızlı kaydırmada şekil önce eski hedefe varıp sonra dönmez, ekrandaki hâlinden doğrudan yeni hedefe akar.
  function freeze() {
    const A = aPos.array;
    const B = aB.array;
    const SA = aSA.array;
    const SB = aSB.array;
    const wa = waveOf(sFrom);
    const wb = waveOf(sTo);
    for (let i = 0; i < N; i++) {
      let t = clamp((m - rArr[i * 2] * MORPH_ST) / (1 - MORPH_ST));
      t = t * t * (3 - 2 * t);
      const i3 = i * 3;
      const ax = A[i3];
      const az = A[i3 + 2];
      const ay = A[i3 + 1] + (wa ? waveY(ax, az, time) : 0);
      const bx = B[i3];
      const bz = B[i3 + 2];
      const by = B[i3 + 1] + (wb ? waveY(bx, bz, time) : 0);
      let px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      let pz = az + (bz - az) * t;
      const w = Math.sin(t * PI);
      const i4 = i * 4;
      const ang = (w * mArr[i4] * SWIRL) / (1 + Math.hypot(px, pz) * 0.08);
      const c = Math.cos(ang);
      const n = Math.sin(ang);
      const rx = c * px - n * pz;
      pz = n * px + c * pz;
      px = rx;
      A[i3] = px + mArr[i4 + 1] * w * BULGE;
      A[i3 + 1] = py + mArr[i4 + 2] * w * BULGE;
      A[i3 + 2] = pz + mArr[i4 + 3] * w * BULGE;
      SA[i * 2] += (SB[i * 2] - SA[i * 2]) * t;
      if (t >= 0.5) SA[i * 2 + 1] = SB[i * 2 + 1];
    }
    aPos.needsUpdate = true;
    aSA.needsUpdate = true;
    const e = smoothstep(0, 1, m);
    const L = (u, v) => u + (v - u) * e;
    frozen = { pose: lerpPose(poseOf(sFrom), poseOf(sTo), e), turn: turnMix(turnOf(sFrom), turnOf(sTo), e), dim: L(dimOf(sFrom), dimOf(sTo)) };
    pairA = FROZEN;
    sFrom = FROZEN;
    sTo = sTarget;
    m = 0;
    mDir = 1;
    lastFreeze = time;
  }

  // Sahne durumunu hedefe göre ilerletir (her karede)
  function stepScene(dt) {
    if (sFrom === sTo) {
      if (sTarget !== sTo) {
        sTo = sTarget; // dönüşüm başlar: ekrandaki şekilden doğrudan hedefe
        m = 0;
        mDir = 1;
      }
    } else if (sTarget === sFrom) {
      mDir = -1; // eski şekle dönüldü: aynı yoldan geri
    } else if (sTarget === sTo) {
      mDir = 1;
    } else if (time - lastFreeze > 0.08) {
      freeze(); // üçüncü bir hedef: ekrandaki ara hâlden doğrudan ona (en çok 80 ms'de bir)
    }
    if (sFrom !== sTo) {
      m = clamp(m + (mDir * dt) / MORPH_S);
      if (mDir > 0 && m >= 1) {
        sFrom = sTo;
        m = 0;
      } else if (mDir < 0 && m <= 0) {
        sTo = sFrom;
        m = 0;
        mDir = 1;
      }
    }
  }

  // Sahneyi dönüşümsüz yerleştirir (ilk kare, sayfa geçişi, görünmezlikten sonra). gather: şekil toplanarak belirsin
  function settle(sc, gather) {
    sFrom = sTo = sTarget = sc;
    m = 0;
    mDir = 1;
    lift = liftT;
    side = sideT;
    formV = gather ? 0 : 1;
    formWait = gather;
    formRun = false;
    cutV = -1;
    material.uniforms.uForm.value = formV;
    material.uniforms.uFade.value = 1;
  }

  // Görünmez dünya: tuval boşaltılır — sonraki koyu bölüm ekrana girerken eski şeklin son karesi görünmesin
  function clearCanvas() {
    renderer.setRenderTarget(null);
    renderer.clear();
    blank = true;
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    const lensLive = lens.k > 0.01 || now - lens.at < 2300;
    const moving = sFrom !== sTo || sTarget !== sTo || formRun || cutV >= 0 || introRun || lensLive || Math.abs(pointer.tx - pointer.x) > 0.002 || Math.abs(liftT - lift) > 0.0015 || Math.abs(sideT - side) > 0.004 || wordV !== wordT || wordV > 0.002 || surgeV !== surgeT || surgeV > 0.002;
    const minDt = 1000 / (moving ? P.fps : 30);
    if (now - last < minDt - 2) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    // uyarlanabilir kalite. Sayfa geçişi kareleri ölçülmez: akış kısa sürer, noktalar iri çizilir ve sayfa değişimi (DOM) kareyi
    // uzatır — kalite yalnızca olağan karelerle ayarlanır (yoksa geçişler kendiliğinden efekt kademesini düşürebiliyordu).
    const transit = surgeT > 0 || surgeV > 0 || Number.isNaN(surgeAt);
    if (moving && !transit && !document.hidden && now > 6000) {
      // ilk 6 sn (açılış, video, yazı tipi, ilk boyama) ölçülmez; seyrek takılma kaliteyi düşürmesin
      dt_samples.push(now - last);
      if (dt_samples.length >= 120) {
        const mean = dt_samples.reduce((x, y) => x + y, 0) / dt_samples.length;
        dt_samples.length = 0;
        const limit = fx.tier === 'full' ? 44 : 60;
        slowWindows = mean > limit ? slowWindows + 1 : 0;
        if (slowWindows >= 3) {
          slowWindows = 0;
          // önce yalnızca çözünürlüğü düşür (görünüm aynı kalır), sonra gerekirse katmanı
          if (fx.tier === 'full' && P.dpr > 1.25) {
            P.dpr = 1.25;
            resize();
          } else {
            fx.downgrade();
            return;
          }
        }
      }
    } else if (!moving) dt_samples.length = 0;
    last = now;
    time += dt;
    // (eski şekil sönerken yerinde kalır: yeni bölüme kayıp orada görünmesin — yeni konuma settle() ile oturulur)
    if (cutV < 0) {
      lift += (liftT - lift) * (1 - Math.exp(-dt * 4.5));
      if (Math.abs(liftT - lift) < 0.0008) lift = liftT;
      side += (sideT - side) * (1 - Math.exp(-dt * 3.2));
      if (Math.abs(sideT - side) < 0.003) side = sideT;
    }
    if (wordV !== wordT) {
      wordV = clamp(wordV + Math.sign(wordT - wordV) * (dt / 1.15), 0, 1);
      if (Math.abs(wordT - wordV) < 0.001) wordV = wordT;
      material.uniforms.uWord.value = wordV;
    }
    if (surgeV !== surgeT) {
      surgeV = surgeAtTime(now);
      if (Math.abs(surgeT - surgeV) < 0.001) surgeV = surgeT;
      if (surgeV === 0 && !surgeT && !Number.isNaN(surgeAt)) snapOpen = false; // giriş bitti
    }
    // çıkış: hızlı başlar (tıklamaya anında tepki), girişte hızlı gelir ve yumuşak oturur
    material.uniforms.uSurge.value = surgeT > 0 ? 1 - (1 - surgeV) * (1 - surgeV) : surgeV * surgeV;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);

    // açılış toplanması
    if (introRun) {
      introT += dt;
      introV = Math.min(1, introT / INTRO_S);
      if (introV >= 1) introRun = false;
      material.uniforms.uIntro.value = introV;
    }
    // fare lensi: yalnızca yakın zamanda hareket varsa açık; sönerek kapanır
    lens.kt = now - lens.at < 2300 && introV >= 1 ? 1 : 0;
    lens.k += (lens.kt - lens.k) * Math.min(1, dt * 3.2);
    if (lens.k < 0.004 && !lens.kt) lens.k = 0;
    lens.x += (lens.tx - lens.x) * Math.min(1, dt * 12);
    lens.y += (lens.ty - lens.y) * Math.min(1, dt * 12);
    material.uniforms.uPtr.value.set(lens.x, lens.y, lens.k);

    // Sahne: hedefe doğrudan dönüşüm (bkz. dosya başı). Görünmezlikten sonraki ilk hedef target() içinde yerleşir; hedef
    // gelmeden kare çizilecek olursa son bilinen hedefle burada yerleşir.
    if (appear) handleAppear();
    // şekil henüz görünmüyorken (toplanma bekleniyor) hedef değişirse dönüşüm değil, yeni sahneyle beklemeye devam
    if (formWait && sTarget !== sTo) settle(sTarget, true);
    if (cutV >= 0) {
      // bitişik olmayan bölüme geçiş: eski şekil 0,18 sn'de söner, ardından yeni bölümün şekli yerinde toplanır
      cutV = Math.max(0, cutV - dt / 0.18);
      material.uniforms.uFade.value = cutV;
      if (cutV <= 0) settle(sTarget, introV >= 1);
    } else stepScene(dt);
    // toplanma: bölüm yeterince göründüğünde başlar (ekranın altında yarım görünürken oynayıp kaçmasın)
    if (formWait && cover >= FORM_COVER) {
      formWait = false;
      formRun = true;
    }
    if (formRun) {
      formV = Math.min(1, formV + dt / FORM_S);
      if (formV >= 1) formRun = false;
    }
    material.uniforms.uForm.value = formV;

    fillPair(sFrom, sTo);
    // giriş: yeni sahnenin şekli hazır (ilk kullanımda üretilir; bu kare uzun sürebilir) — akış bu kareden sonra sayılmaya başlar
    if (Number.isNaN(surgeAt)) surgeAt = performance.now();
    material.uniforms.uMix.value = m;
    material.uniforms.uTime.value = time;
    pose(sFrom, sTo, m);
    material.uniforms.uWave.value = dimOf(sFrom) + (dimOf(sTo) - dimOf(sFrom)) * smoothstep(0, 1, m);
    material.uniforms.uWv.value.set(waveOf(sFrom), waveOf(sTo));
    if (!visible && surgeV === 0 && surgeT === 0) {
      // görünmez + akış bitti: tuval boşaltılır (eski şeklin karesi sonraki bölümde görünmesin), döngü durur
      clearCanvas();
      running = false;
      return;
    }
    renderer.render(scene, camera);
    blank = false;
    if (visible) lastScene = sTo;
    if (firstFrame) {
      firstFrame = false;
      html.classList.add('fx-live');
    }
    rafId = requestAnimationFrame(frame);
  }

  // Görünmezlikten sonra ilk hedef: aynı bölüme dönüldüyse şekil zaten odur, yerinde görünür; başka bölümse eski şeklin
  // karesi hiç çizilmez — bölümün şekli doğrudan yerleşir ve bölüm yeterince görününce toplanarak belirir.
  function handleAppear() {
    appear = false;
    settle(sTarget, sTarget !== lastScene && introV >= 1);
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ilk durumu hazırla: kamera hazır; formasyon tamponları ilk karede, sayfanın sahnesiyle doldurulur (önce ana sayfa şekli üretilmez)
  pose(0, 0, 0);

  // açılış toplanmasını başlat (yoksa güvenlik ağı: 5 sn sonra kendiliğinden)
  function assemble() {
    if (introV >= 1 || introRun) return;
    introRun = true;
    introT = 0;
    if (visible) start();
  }
  let failsafe = 0;
  if (intro) failsafe = setTimeout(assemble, 5000);

  // Kelimeyi site yazı tipiyle (resmî logo görseli/harfleri KULLANILMAZ) 2B tuvale çizip piksellerinden hedef noktalar üretir.
  // Koordinat: yükseklik birimi (y ∈ [-1,1], x ∈ [-aspect, aspect]); genişlik ekranın ≈ %62'si.
  async function buildWord(text) {
    const family = getComputedStyle(html).getPropertyValue('--f-display').trim() || "'Montserrat', 'Segoe UI', Arial, sans-serif";
    try {
      await document.fonts?.load?.(`400 220px ${family}`);
    } catch (e) {
      /* yazı tipi yoksa sistem fontu */
    }
    const CW = 1600;
    const CH = 420;
    const cv = document.createElement('canvas');
    cv.width = CW;
    cv.height = CH;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const track = 0.2; // harf aralığı (em)
    const fs0 = 300;
    g.font = `400 ${fs0}px ${family}`;
    const letters = [...text];
    const wid = letters.map((ch) => g.measureText(ch).width);
    const total = wid.reduce((a, b) => a + b, 0) + fs0 * track * (letters.length - 1);
    const fs = Math.floor((fs0 * (CW * 0.94)) / total);
    g.font = `400 ${fs}px ${family}`;
    const wid2 = letters.map((ch) => g.measureText(ch).width);
    const tot2 = wid2.reduce((a, b) => a + b, 0) + fs * track * (letters.length - 1);
    g.fillStyle = '#fff';
    g.textBaseline = 'alphabetic';
    let px = (CW - tot2) / 2;
    const base = CH * 0.5 + fs * 0.35; // büyük harfler: x-yüksekliği değil, kap yüksekliği ≈ 0,7em
    letters.forEach((ch, i) => {
      g.fillText(ch, px, base);
      px += wid2[i] + fs * track;
    });
    const img = g.getImageData(0, 0, CW, CH).data;
    const pts = [];
    let minX = CW;
    let maxX = 0;
    let minY = CH;
    let maxY = 0;
    const STEP = 2;
    for (let y = 0; y < CH; y += STEP) {
      for (let x = 0; x < CW; x += STEP) {
        if (img[(y * CW + x) * 4 + 3] > 128) {
          pts.push(x, y);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const cnt = pts.length / 2;
    if (!cnt) return false;
    const bw = Math.max(1, maxX - minX);
    const cx = (minX + maxX) / 2;
    const cyy = (minY + maxY) / 2;
    // kelime genişliği (yükseklik birimi): ekranın ≈ %62'si; dar/dikey pencerede en fazla %84'ü (ekran genişliği = 2 × aspect)
    const wh = Math.min(clamp(aspect * 1.24, 1.1, 2.6), aspect * 2 * 0.84);
    const sc = wh / bw;
    const rr = mulberry32(4242);
    for (let i = 0; i < N; i++) {
      const k = Math.floor(rr() * cnt) * 2;
      aW.array[i * 2] = (pts[k] - cx + (rr() - 0.5) * STEP) * sc;
      aW.array[i * 2 + 1] = -(pts[k + 1] - cyy + (rr() - 0.5) * STEP) * sc;
    }
    aW.needsUpdate = true;
    return true;
  }
  let wordReq = 0;
  async function word(on, text = 'BORADEN') {
    const id = ++wordReq;
    if (on) {
      if (!(await buildWord(text)) || id !== wordReq) return;
      wordT = 1;
      start();
    } else wordT = 0;
  }

  return {
    target(v, l = 0, sd = 1, cov = 1, cut = false) {
      // v: sahne; l: yukarı kayma; sd: taraf; cov: seçili bölümün görünen kısmı / min(ekran, bölüm) yüksekliği (toplanma eşiği);
      // cut: seçim araya beyaz bölüm giren başka bir koyu bölüme geçti — dönüşüm yok, eski şekil söner, yenisi orada toplanır
      sTarget = Math.round(clamp(v, 0, LAST)); // sahneler tam sayı: her değişim bir şekilden ötekine tam bir dönüşüm
      liftT = clamp(l, -0.45, 0.45);
      sideT = sd < 0 ? -1 : 1;
      cover = cov;
      if ((surgeT > 0 || snapOpen) && surgeAtTime(performance.now()) > 0.5) {
        // sayfa geçişi: noktalar ekran dışında — yeni sahne dönüşümsüz oturur, noktalar sonra bu şekle içeri akar
        appear = false;
        settle(sTarget, false);
      } else if (firstFrame) {
        // tam yükleme: ilk kare sayfanın şekliyle başlar (önce ana sayfa şekli görünmez) ve toplanarak belirir
        // (açılış perdesi varsa noktaları açılış toplar: uIntro)
        appear = false;
        settle(sTarget, introV >= 1);
      } else if (appear) handleAppear();
      else if (cut && cutV < 0) cutV = material.uniforms.uFade.value;
    },
    setVisible(b) {
      if (b === visible) return;
      visible = b;
      if (b) {
        if (blank) appear = true;
        start();
      } else if (surgeV === 0 && surgeT === 0) {
        stop();
        clearCanvas();
      }
    },
    // Sayfa geçişi akışı: on=true noktalar (nx, ny) NDC noktasından dışarı akar; on=false yeni şekle içeri akıp oturur.
    // Döndürür (on=true): noktaların ekran dışına varmasına kalan süre (ms) — yönlendirici içeriği bu süre dolunca değiştirir.
    surge(on, nx = 0, ny = 0) {
      const now = performance.now();
      const v = surgeAtTime(now);
      // yön değişince ekrandaki konum sıçramasın: uSurge çıkışta 1-(1-v)², girişte v² — aynı uSurge'ü veren başlangıç değeri
      const u = surgeT > 0 ? 1 - (1 - v) * (1 - v) : v * v;
      if (on) {
        material.uniforms.uSurgeO.value.set(clamp(nx, -1.2, 1.2), clamp(ny, -1.2, 1.2));
        surgeFrom = surgeT > 0 ? v : 1 - Math.sqrt(1 - u);
        surgeT = 1;
        surgeAt = now;
        snapOpen = false;
      } else {
        surgeFrom = surgeT > 0 ? Math.sqrt(u) : v;
        surgeT = 0;
        surgeAt = NaN;
        snapOpen = surgeFrom > 0.5;
      }
      surgeV = surgeFrom;
      start();
      return on ? Math.ceil((1 - surgeFrom) * SURGE_OUT) : 0;
    },
    get surging() {
      return surgeT > 0 || Number.isNaN(surgeAt) || surgeAtTime(performance.now()) > 0.002;
    },
    assemble,
    word,
    destroy() {
      ++wordReq; // bekleyen font/kelime hazırlığı dispose edilmiş renderer'ı yeniden başlatmasın
      clearTimeout(failsafe);
      stop();
      ro.disconnect();
      removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      document.removeEventListener('visibilitychange', onVis);
      geo.dispose();
      material.dispose();
      renderer.dispose();
      // Aynı kalıcı tuval sonraki FX kademesinde yeniden kurulur; GPU kaynaklarını temizle, bağlamı kaybetme.
      html.classList.remove('fx-live');
    },
  };
}
