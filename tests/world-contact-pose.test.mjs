// Exercise the renderer's actual camera/rotation pose with real Three.js projection, without a GPU or waiting all day.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import { buildFormations, POSES, SPIN, SWAY, SCENE } from '../src/assets/js/world/formations.js';
import { clamp, smoothstep } from '../src/assets/js/util.js';

const source = await readFile(new URL('../src/assets/js/world/world.js', import.meta.url), 'utf8');
const pose = source.slice(source.indexOf('  function pose('), source.indexOf('  function frame('));
const F = buildFormations(500);
const K = SCENE.kapi;

for (const [width, height] of [[1512, 715], [354, 780]]) {
  test(`contact arch moves without collapsing over time at ${width}×${height}`, () => {
    const camera = new PerspectiveCamera(48, width / height, 0.1, 400);
    const points = { rotation: new Euler() };
    const context = vm.createContext({
      F, POSES, SPIN, SWAY, clamp, smoothstep, camera, points, aspect: width / height, twoCol: width > 900,
      side: 1, lift: 0, pointer: { x: 0, y: 0 }, time: 5,
      camPos: new Vector3(), camLook: new Vector3(), material: { uniforms: { uBright: { value: 1 } } },
    });
    vm.runInContext(pose + '\nglobalThis.drawPose = () => pose(' + K + ', ' + K + ', 0);', context);
    const archWidth = time => {
      context.time = time;
      context.drawPose();
      camera.updateMatrixWorld();
      const xs = [];
      for (let i = 0; i < 450; i++) {
        const p = new Vector3().fromArray(F[K].pos, i * 3);
        if (p.y < 0.6) continue; // arch crown; exclude the road and background dust
        p.applyEuler(points.rotation).project(camera);
        xs.push(p.x);
      }
      return Math.max(...xs) - Math.min(...xs);
    };
    const initial = archWidth(0), firstAngle = points.rotation.y;
    archWidth(5);
    assert.ok(Math.abs(points.rotation.y - firstAngle) > 0.1, 'the portal must visibly move within five seconds');
    for (const time of [...Array.from({ length: 61 }, (_, i) => i * 5), 3600, 86400]) {
      const ratio = archWidth(time) / initial;
      assert.ok(ratio > 0.9 && ratio < 1.1, `arch width ratio at ${time}s=${ratio.toFixed(3)}; the portal must not collapse sideways`);
      assert.ok(Math.abs(points.rotation.y) < 0.4, 'contact sway stays bounded');
    }
    context.pointer.x = 1;
    archWidth(0);
    assert.ok(points.rotation.y > 0.05 && points.rotation.y < 0.2, 'the portal also responds to the pointer');
  });
}
