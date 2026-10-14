// Run the real async word/start/stop/destroy flow without Three.js or a GPU.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { clamp } from '../src/assets/js/util.js';
import { mulberry32 } from '../src/assets/js/world/formations.js';

const source = process.env.BORADEN_TEST_BASELINE === '1'
  ? execFileSync('git', ['show', 'HEAD:src/assets/js/world/world.js'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
  : await readFile(new URL('../src/assets/js/world/world.js', import.meta.url), 'utf8');
const startStop = source.slice(source.indexOf('  function start()'), source.indexOf('  // ilk durumu hazırla'));
const word = source.slice(source.indexOf('  let wordReq = 0;'), source.indexOf('\n  return {\n    target'));
const destroyStart = source.indexOf('    destroy() {');
const destroy = source.slice(destroyStart, source.indexOf('\n    },\n  };', destroyStart) + 6);

test('destroy cancels a pending word and prevents restarting the disposed renderer', async () => {
  let release;
  let scheduled = 0;
  let disposed = 0;
  const context = vm.createContext({
    document: { hidden: false, removeEventListener() {} }, canvas: { removeEventListener() {} }, html: { classList: { remove() {} } },
    performance: { now: () => 1 }, requestAnimationFrame: () => ++scheduled, cancelAnimationFrame() {}, clearTimeout() {}, removeEventListener() {},
    ro: { disconnect() {} }, geo: { dispose() {} }, material: { dispose() {} }, renderer: { dispose() { disposed++; }, forceContextLoss() {} },
    onPointer() {}, onLost() {}, onVis() {}, failsafe: 0, running: false, rafId: 0, last: 0, frame() {}, wordT: 0,
    buildWord: () => new Promise((resolve) => { release = resolve; }),
  });
  vm.runInContext(startStop + word + '\nconst api = {' + destroy + '};globalThis.pendingWord = word(true);api.destroy();', context);
  release(true);
  await context.pendingWord;
  assert.equal(disposed, 1);
  assert.equal(scheduled, 0);
  assert.equal(context.running, false);
  assert.equal(context.wordT, 0);
});

test('3D word loads and draws with the current display font', async () => {
  const family = "'Open Sans', 'Segoe UI', Arial, sans-serif";
  let loaded, painted;
  const pixels = new Uint8ClampedArray(1600 * 420 * 4);
  pixels[(200 * 1600 + 800) * 4 + 3] = 255;
  const g = { measureText: () => ({ width: 100 }), fillText() { painted = this.font; }, getImageData: () => ({ data: pixels }) };
  const context = vm.createContext({
    html: {}, getComputedStyle: () => ({ getPropertyValue: () => family }), clamp, mulberry32,
    document: { fonts: { load: async font => { loaded = font; } }, createElement: () => ({ getContext: () => g }) },
    N: 4, aspect: 1.6, aW: { array: new Float32Array(8), needsUpdate: false },
  });
  const buildWord = source.slice(source.indexOf('  async function buildWord('), source.indexOf('  let wordReq = 0;'));
  assert.equal(await vm.runInContext(buildWord + '\nbuildWord("BORADEN");', context), true);
  assert.equal(loaded, `400 220px ${family}`);
  assert.ok(painted.endsWith(family));
  assert.equal(context.aW.needsUpdate, true);
});
