// Kalıcı 3B "dünya": tek WebGL tuvali, sayfalar arasında yaşar. Noktalar bir formasyondan diğerine akar.
// Efekt katmanı (Tam/Hafif/Kapalı) ve görünürlüğe göre çalışır; görünmezken 0 fps.
import { WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Sphere, Vector3 } from 'three';
import { buildFormations, mulberry32 } from './formations.js';
import { clamp, smoothstep } from '../util.js';

const VERT = /* glsl */ `
  attribute vec3 aB;
  attribute vec2 aSA;
  attribute vec2 aSB;
  attribute vec2 aR;
  uniform float uMix;
  uniform float uTime;
  uniform float uPx;
  uniform float uFade;
  uniform float uBright;
  varying float vA;
  varying vec3 vC;

  vec3 tintOf(float t) {
    if (t < 0.5) return vec3(0.80, 0.88, 1.00);
    if (t < 1.5) return vec3(0.33, 0.66, 0.86);
    if (t < 2.5) return vec3(0.96, 0.43, 0.33);
    return vec3(0.30, 0.78, 0.42);
  }

  void main() {
    float s = aR.y;
    float t = clamp((uMix - aR.x * 0.38) / (1.0 - 0.38), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(position, aB, t);
    float w = sin(t * 3.14159265);
    p += vec3(sin(s * 6.2831 + uTime * 0.5), cos(s * 12.566 + uTime * 0.45), sin(s * 9.4 - uTime * 0.4)) * w * 1.25;
    p += vec3(sin(uTime * 0.28 + s * 40.0), cos(uTime * 0.25 + s * 31.0), sin(uTime * 0.2 + s * 17.0)) * 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(1.0, -mv.z);
    float size = mix(aSA.x, aSB.x, t);
    float tn = t < 0.5 ? aSA.y : aSB.y;
    gl_PointSize = max(1.0, size * uPx * (58.0 / dist) * (1.0 + w * 0.5));
    float tw = 0.72 + 0.28 * sin(uTime * (0.6 + fract(s * 13.7)) + s * 50.0);
    vA = (0.5 + 0.5 * fract(s * 7.31)) * tw * smoothstep(165.0, 12.0, dist) * uBright * uFade;
    vC = tintOf(tn);
  }
`;

const FRAG = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, r);
    a *= a;
    gl_FragColor = vec4(vC * (0.7 + 0.5 * a), a * vA);
  }
`;

const SPIN = [0, 1, 1, 1, 1, 1, 0.8, 0.25];

export async function createWorld({ fx, canvas }) {
  const html = document.documentElement;
  const P = fx.params();
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setClearColor(0x000000, 0);

  const N = P.points;
  const F = buildFormations(N);
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
  geo.setAttribute('aR', new BufferAttribute(rArr, 2));
  geo.boundingSphere = new Sphere(new Vector3(), 1e4);

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uMix: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uFade: { value: 1 }, uBright: { value: 1 } },
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
  let dissolve = null; // {phase:'out'|'in', to, v}
  let visible = false;
  let running = false;
  let rafId = 0;
  let last = performance.now();
  let time = 0;
  let aspect = 1;
  let firstFrame = true;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const dt_samples = [];
  let slowWindows = 0;
  const camPos = new Vector3();
  const camLook = new Vector3();

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(P.dpr);
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
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
    const PA = F[a].pose;
    const PB = F[b].pose;
    const k = clamp((aspect - 1.0) / 0.75); // dar ekranda formasyon ortalanır
    const L = (u, v) => u + (v - u) * e;
    const fovNow = L(PA.fov, PB.fov) + (aspect < 1 ? 8 : 0);
    const viewH = 2 * 19 * Math.tan((fovNow * Math.PI) / 360); // formasyon düzleminde görüntü yüksekliği (dünya birimi)
    const dy = -lift * viewH;
    camPos.set(L(PA.pos[0], PB.pos[0]) * k + pointer.x * 0.9, L(PA.pos[1], PB.pos[1]) + pointer.y * 0.5 + dy, L(PA.pos[2], PB.pos[2]) + (aspect < 1 ? 4 : 0));
    camLook.set(L(PA.look[0], PB.look[0]) * k, L(PA.look[1], PB.look[1]) + dy, L(PA.look[2], PB.look[2]));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const fov = L(PA.fov, PB.fov) + (aspect < 1 ? 8 : 0);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    material.uniforms.uBright.value = L(PA.bright, PB.bright);
    points.rotation.y = L(SPIN[a] ?? 1, SPIN[b] ?? 1) * (time * 0.035 + pointer.x * 0.1);
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    const moving = Math.abs(sTarget - s) > 0.003 || dissolve || Math.abs(pointer.tx - pointer.x) > 0.002 || Math.abs(liftT - lift) > 0.0015;
    const minDt = 1000 / (moving ? P.fps : 30);
    if (now - last < minDt - 2) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    // uyarlanabilir kalite
    if (moving) {
      dt_samples.push(now - last);
      if (dt_samples.length >= 100) {
        const mean = dt_samples.reduce((x, y) => x + y, 0) / dt_samples.length;
        dt_samples.length = 0;
        const limit = fx.tier === 'full' ? 32 : 58;
        slowWindows = mean > limit ? slowWindows + 1 : 0;
        if (slowWindows >= 2) {
          slowWindows = 0;
          fx.downgrade();
          return;
        }
      }
    }
    last = now;
    time += dt;
    lift += (liftT - lift) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(liftT - lift) < 0.0008) lift = liftT;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);

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
      s += (sTarget - s) * (1 - Math.exp(-dt * 3.4));
      if (Math.abs(sTarget - s) < 0.0005) s = sTarget;
    }

    const a = clamp(Math.floor(s), 0, 7);
    const b = clamp(a + 1, 0, 7);
    const f = a === 7 ? 0 : s - a;
    fillPair(a, b);
    material.uniforms.uMix.value = f;
    material.uniforms.uTime.value = time;
    pose(a, b, f);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      html.classList.add('fx-live');
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

  return {
    target(v, l = 0) {
      sTarget = clamp(v, 0, 7);
      liftT = clamp(l, -0.45, 0.45);
    },
    setVisible(b) {
      if (b === visible) return;
      visible = b;
      b ? start() : stop();
    },
    destroy() {
      stop();
      ro.disconnect();
      removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      document.removeEventListener('visibilitychange', onVis);
      geo.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      html.classList.remove('fx-live');
    },
  };
}
