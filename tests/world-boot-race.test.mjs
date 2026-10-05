// Exercise the real main.js lifecycle without a GPU or a production build.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const raw = process.env.BORADEN_TEST_BASELINE === '1'
  ? execFileSync('git', ['show', 'HEAD:src/assets/js/main.js'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
  : await readFile(new URL('../src/assets/js/main.js', import.meta.url), 'utf8');
const source = raw
  .replace(/^import .*;$/gm, '')
  .replace("import('./world/world.js')", '__loadWorld()');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness({ delayFirstCreation = false } = {}) {
  const imports = [], instances = [], warnings = [], classes = new Set(), listeners = new Set();
  const firstCreation = deferred();
  const fx = {
    tier: 'full',
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(tier) { const changed = this.tier !== tier; this.tier = tier; if (changed) for (const fn of listeners) fn(tier); },
  };
  const module = {
    async createWorld({ fx }) {
      const instance = { tier: fx.tier, destroyed: 0, target() {}, setVisible() {}, assemble() {}, destroy() { this.destroyed++; } };
      instances.push(instance);
      if (delayFirstCreation && instances.length === 1) return firstCreation.promise.then(() => instance);
      return instance;
    },
  };
  const context = vm.createContext({
    initFx: () => fx, createScroll: () => ({}), initChrome: () => ({ onNavigate() {} }),
    createBehaviors: () => ({ mount() {}, refreshMotion() {} }), initRouter() {},
    window: {}, location: { pathname: '/' }, document: { documentElement: { classList: {
      contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name),
    } }, getElementById: () => ({}) },
    requestAnimationFrame: (fn) => fn(), console: { warn: (...args) => warnings.push(args.join(' ')) },
    __loadWorld: () => { const next = deferred(); imports.push(next); return next.promise; },
  });
  vm.runInContext(source + '\n globalThis.__testWorld = world;', context, { filename: 'main.js' });
  return { fx, imports, instances, warnings, module, firstCreation, world: context.__testWorld };
}

test('FX off during pending world import creates no renderer', async () => {
  const h = harness();
  h.fx.set('off');
  h.imports[0].resolve(h.module);
  await flush();
  assert.equal(h.instances.length, 0);
  assert.equal(h.world.impl, null);
  assert.equal(h.fx.tier, 'off');
});

test('latest full/lite generation wins when imports resolve out of order', async () => {
  const h = harness();
  h.fx.set('lite');
  h.imports[1].resolve(h.module);
  await flush();
  const latest = h.world.impl;
  h.imports[0].resolve(h.module);
  await flush();
  assert.equal(h.instances.length, 1);
  assert.equal(h.world.impl, latest);
  assert.equal(latest.tier, 'lite');
});

test('a renderer completed by an obsolete generation is disposed', async () => {
  const h = harness({ delayFirstCreation: true });
  h.imports[0].resolve(h.module);
  await flush();
  h.fx.set('lite');
  h.imports[1].resolve(h.module);
  await flush();
  const latest = h.world.impl;
  h.firstCreation.resolve();
  await flush();
  assert.equal(h.world.impl, latest);
  assert.equal(h.instances[0].destroyed, 1);
  assert.equal(latest.destroyed, 0);
});

test('an obsolete world import failure cannot turn off the latest tier', async () => {
  const h = harness();
  h.fx.set('lite');
  h.imports[1].resolve(h.module);
  await flush();
  const latest = h.world.impl;
  h.imports[0].reject(new Error('synthetic stale import failure'));
  await flush();
  assert.equal(h.fx.tier, 'lite');
  assert.equal(h.world.impl, latest);
  assert.equal(latest.destroyed, 0);
  assert.equal(h.warnings.length, 0);
});

test('a current world import failure retains the off fallback', async () => {
  const h = harness();
  h.imports[0].reject(new Error('synthetic current import failure'));
  await flush();
  assert.equal(h.fx.tier, 'off');
  assert.equal(h.world.impl, null);
  assert.equal(h.warnings.length, 1);
});
