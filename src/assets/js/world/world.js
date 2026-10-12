// Kalıcı 3B "dünya": tek WebGL tuvali, sayfalar arasında yaşar. Noktalar bir formasyondan diğerine akar.
// Efekt katmanı (Tam/Hafif/Kapalı) ve görünürlüğe göre çalışır; görünmezken 0 fps.
//
// Görünürlük (v3): iri, parıltılı noktalar; ufuk arazisinde yavaş dalga; «Tam» katmanda fare lensi (ekran uzayında itme + parlama);
// açılışta (opts.intro) noktalar dağınık hâlden formasyona toplanır — assemble() ile başlatılır.
import { WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Sphere, Vector2, Vector3 } from 'three';
import { lazyFormations, mulberry32, POSES, SPIN, SWAY, FORMATION_COUNT } from './formations.js';
import { clamp, smoothstep } from '../util.js';

// Fare lensi (yalnızca «Tam» katman): imlecin hemen çevresindeki noktalar hafifçe itilir, biraz büyür ve parlar.
// Bilerek küçük ve ince tutulur — yalnızca imleç ucunda küçük bir parıltı; model okunur kalır. Hepsi buradan ayarlanır:
//   falloff — düşüş sertliği; etki yarıçapı (%10 şiddet) ≈ √(2,3 / falloff) × ekran yüksekliğinin yarısı (120 → ≈ %14 → 900 px'te ≈ 62 px)
//   push    — merkezde en fazla itme, NDC birimi (0,022 → 900 px'te ≈ 10 px)
//   grow    — merkezde nokta boyutu artışı (katsayı)      glow — merkezde parlaklık artışı (katsayı)
const LENS = { falloff: 120, push: 0.022, grow: 0.6, glow: 0.7 };
const glf = (n) => n.toFixed(3); // GLSL ondalık sabiti

const VERT = /* glsl */ `
  attribute vec3 aB;
  attribute vec2 aSA;
  attribute vec2 aSB;
  attribute vec2 aR;
  attribute vec2 aW;
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

  void main() {
    float s = aR.y;
    float t = clamp((uMix - aR.x * 0.38) / (1.0 - 0.38), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    // A formasyonu ufuk arazisiyse yavaş dalga (uWave: 0..1)
    vec3 pa = position;
    pa.y += uWave * (sin(pa.x * 0.33 + uTime * 0.7) * cos(pa.z * 0.27 - uTime * 0.5) * 0.30 + sin(pa.x * 0.9 - uTime * 1.1 + pa.z * 0.4) * 0.07);
    vec3 p = mix(pa, aB, t);
    float w = sin(t * 3.14159265);
    p += vec3(sin(s * 6.2831 + uTime * 0.5), cos(s * 12.566 + uTime * 0.45), sin(s * 9.4 - uTime * 0.4)) * w * 1.25;
    p += vec3(sin(uTime * 0.28 + s * 40.0), cos(uTime * 0.25 + s * 31.0), sin(uTime * 0.2 + s * 17.0)) * 0.05;

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
    vS = vec3(sdir.x, -sdir.y, sg * sp * 1.8);
    gl_Position = vec4(ndc * clip.w, clip.zw);

    float dist = max(1.0, -mv.z);
    float size = mix(aSA.x, aSB.x, t);
    float tn = t < 0.5 ? aSA.y : aSB.y;
    float psz = max(1.9, size * uPx * (96.0 / dist) * (1.0 + w * 0.5 + push * ${glf(LENS.grow)}));
    gl_PointSize = mix(psz, max(2.2, 2.6 * uPx), wt);
    gl_PointSize = min(gl_PointSize * (1.0 + sg * (1.3 + 2.0 * sp)), 110.0);
    float tw = 0.74 + 0.26 * sin(uTime * (0.6 + fract(s * 13.7)) + s * 50.0);
    vA = (0.58 + 0.42 * fract(s * 7.31)) * tw * smoothstep(170.0, 12.0, dist) * uBright * uFade * (1.0 + push * ${glf(LENS.glow)}) * smoothstep(0.0, 0.22, it);
    vA = mix(vA, 0.95 * uFade * (1.0 + push * ${glf(LENS.glow * 0.8)}), wt);
    vA *= (1.0 + sg * 1.5) * (1.0 - smoothstep(0.95, 1.0, uSurge));
    // kahraman (uWave>0): ekranın alt kısmı sakinleşir → alt bilgi metni ve düğmeler okunur kalır
    vA *= 1.0 - uWave * 0.9 * (1.0 - smoothstep(-0.85, -0.25, ndc.y));
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
    float core = 1.0 - smoothstep(0.0, 0.5, r);
    float halo = pow(1.0 - r, 2.2);
    float a = core * 0.9 + halo * 0.5;
    gl_FragColor = vec4(vC * (0.9 + 0.5 * core), a * vA);
  }
`;

const LAST = FORMATION_COUNT - 1; // son sahne sırası
const INTRO_S = 2.2; // toplanma süresi (sn)
const SURGE_OUT = 350; // sayfa geçişi: noktaların ekran dışına akma süresi (ms) — yönlendirici bu süre dolunca içeriği değiştirir (U-20)
const SURGE_IN = 1050; // sayfa geçişi: yeni sayfada noktaların içeri akıp şekle oturma süresi (ms)

// WebGL 2 desteği önce küçük, atılan bir tuvalde sınanır (T-35): yoksa three.js çiziciyi kurmaya çalışıp konsola hata yazmaz;
// dünya kurulmaz ve efektler «Kapalı»ya düşer (main.js › bootWorld). Sınama bağlamı hemen bırakılır.
function webgl2Ok() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
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
  geo.setAttribute('aW', aW);
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
    if (a !== pairA) {
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
  let s = 0; // geçerli sahne (kesirli)
  let sTarget = 0;
  let lift = 0; // formasyonun ekranda yukarı kayması (görüntü yüksekliğinin oranı); bölümün görünen ortasına hizalar
  let liftT = 0;
  let side = 1; // formasyonun ekrandaki tarafı: 1 sağ, -1 sol (düzen değişince süzülür)
  let sideT = 1;
  let dissolve = null; // {phase:'out'|'in', to, v}
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
    const PA = POSES[a];
    const PB = POSES[b];
    const k0 = twoCol ? aspect * 0.5 : clamp((aspect - 1.0) / 0.75); // iki sütunda formasyon genişliğin sabit oranında (≈ %68) durur; dar ekranda ortalanır ve metnin arkasında söner
    const k = k0 * (side < 0 ? side * (PA.lx ?? 1) * (1 - e) + side * (PB.lx ?? 1) * e : side); // side<0 → solda (lx: sol yerleşim kazancı)
    const L = (u, v) => u + (v - u) * e;
    const fovNow = L(PA.fov, PB.fov) + (aspect < 1 ? 8 : 0);
    const viewH = 2 * 19 * Math.tan((fovNow * Math.PI) / 360); // formasyon düzleminde görüntü yüksekliği (dünya birimi)
    const dy = -lift * viewH;
    // ls: solda yerleşimde kamera uzaklığı çarpanı (formasyon biraz küçülür; metin sütununa taşmaz)
    // dm: iki sütunda ekran en-boy oranı 1,6'dan darsa (ör. 1100×800) formasyon sütununa sığsın diye biraz uzaklaşılır (merkez oranı korunur)
    const dm = twoCol ? clamp(1.6 / aspect, 1, 1.25) : 1;
    const zs = dm * (1 + Math.max(0, -side) * (L(PA.ls ?? 1, PB.ls ?? 1) - 1));
    const ly = L(PA.look[1], PB.look[1]);
    const lz = L(PA.look[2], PB.look[2]);
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
    // SWAY > 0: sürekli dönmek yerine ±SWAY rad salınır (kapı, düzlemsel şekiller); aksi hâlde SPIN çarpanıyla yavaş dönüş
    const turn = (scene) => (SWAY[scene] > 0 ? Math.sin(time * 0.24) * SWAY[scene] + pointer.x * 0.1 : (SPIN[scene] ?? 1) * (time * 0.035 + pointer.x * 0.1));
    points.rotation.y = L(turn(a), turn(b));
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    const lensLive = lens.k > 0.01 || now - lens.at < 2300;
    const moving = Math.abs(sTarget - s) > 0.003 || dissolve || introRun || lensLive || Math.abs(pointer.tx - pointer.x) > 0.002 || Math.abs(liftT - lift) > 0.0015 || Math.abs(sideT - side) > 0.004 || wordV !== wordT || wordV > 0.002 || surgeV !== surgeT || surgeV > 0.002;
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
    lift += (liftT - lift) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(liftT - lift) < 0.0008) lift = liftT;
    side += (sideT - side) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(sideT - side) < 0.003) side = sideT;
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

    // sahne değeri: yakın geçişlerde süzülür, uzak sıçramalarda çözülerek değişir
    if (dissolve) {
      if (dissolve.phase === 'out') {
        dissolve.v = Math.max(0, dissolve.v - dt / 0.26);
        if (dissolve.v <= 0) {
          s = sTarget;
          dissolve = { phase: 'in', v: 0 };
        }
      } else {
        dissolve.v = Math.min(1, dissolve.v + dt / 0.6);
        if (dissolve.v >= 1) dissolve = null;
      }
      material.uniforms.uFade.value = dissolve ? dissolve.v : 1;
    } else if (Math.abs(sTarget - s) > 1.6) {
      dissolve = { phase: 'out', v: 1 };
    } else {
      s += (sTarget - s) * (1 - Math.exp(-dt * 2.6)); // süzülme: hızlı kaydırmada da geçiş ~1 sn sürer
      if (Math.abs(sTarget - s) < 0.0005) s = sTarget;
    }

    const a = clamp(Math.floor(s), 0, LAST);
    const f = a === LAST ? 0 : s - a;
    // tam sayı sahnede B ikinci kez üretilmez (f = 0 → yalnızca A görünür)
    const b = f === 0 ? a : clamp(a + 1, 0, LAST);
    fillPair(a, b);
    // giriş: yeni sahnenin şekli hazır (ilk kullanımda üretilir; bu kare uzun sürebilir) — akış bu kareden sonra sayılmaya başlar
    if (Number.isNaN(surgeAt)) surgeAt = performance.now();
    material.uniforms.uMix.value = f;
    material.uniforms.uTime.value = time;
    material.uniforms.uWave.value = a === 0 ? 1 - smoothstep(0, 0.9, f) : 0;
    pose(a, b, f);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      html.classList.add('fx-live');
    }
    if (!visible && surgeV === 0 && surgeT === 0) {
      // görünmez + akış bitti: son kare çizildi, döngü durur
      running = false;
      return;
    }
    rafId = requestAnimationFrame(frame);
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

  // ilk durumu hazırla (görünmese de)
  fillPair(0, 1);
  pose(0, 1, 0);

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
    target(v, l = 0, sd = 1) {
      sTarget = clamp(v, 0, LAST);
      liftT = clamp(l, -0.45, 0.45);
      sideT = sd < 0 ? -1 : 1;
      // noktalar ekran dışındayken (sayfa geçişi) yeni sahne çözülmeden/süzülmeden doğrudan oturur; noktalar sonra bu şekle içeri akar
      if ((surgeT > 0 || snapOpen) && surgeAtTime(performance.now()) > 0.5) {
        s = sTarget;
        lift = liftT;
        side = sideT;
        dissolve = null;
        material.uniforms.uFade.value = 1;
      }
    },
    setVisible(b) {
      if (b === visible) return;
      visible = b;
      if (b) start();
      else if (surgeV === 0 && surgeT === 0) stop();
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
