// Formasyon kayıt defteri ve sayfa eşlemesi (birim testi):
//   • her şekil üretilebilir, sonlu, sahne ölçüsünde ve tohumla tekrarlanabilir (aynı tohum → aynı noktalar)
//   • kimlikler tekil, sıra kalıcı (ilk sekiz ana sayfa sahnesi yerinde), her içerik şeklinin «Şekil» açıklaması var
//   • scripts/scenes.mjs içindeki her eşleme var olan bir şekle gider; Hakkımızda terazi değil yazıt kullanır
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS, FORMATION_COUNT, SCENE, FIGURES, POSES, SPIN, SWAY, buildFormation } from '../src/assets/js/world/formations.js';
import { AREA_SHAPE, SERVICE_SHAPE, SECTOR_SHAPE, CALC_SHAPE, CALC_GROUP_SHAPE, FAQ_SHAPE, ABOUT_SHAPE, PAGE, sceneOf, figOf } from '../scripts/scenes.mjs';

const N = 2400;

test('kimlikler tekil, sıra kalıcı', () => {
  const ids = FORMATIONS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'yinelenen formasyon kimliği');
  assert.equal(FORMATION_COUNT, ids.length);
  // ana sayfa sahneleri sıra numarasıyla seçilir — yerleri değişmemeli (yeni şekiller yalnızca sona eklenir)
  assert.deepEqual(ids.slice(0, 8), ['ufuk', 'defter', 'ornekleme', 'agac', 'halka', 'katman', 'sutunlar', 'kapi']);
  ids.forEach((id, i) => assert.equal(SCENE[id], i));
  assert.equal(POSES.length, ids.length);
  assert.equal(SPIN.length, ids.length);
  assert.equal(SWAY.length, ids.length);
});

test('her içerik şeklinin açıklaması ve kamera pozu var', () => {
  for (let k = 1; k < FORMATION_COUNT; k++) {
    assert.ok(FIGURES[k] && FIGURES[k].length > 8, `${FORMATIONS[k].id}: «Şekil» açıklaması yok`);
    const p = POSES[k];
    for (const v of [...p.pos, ...p.look]) assert.ok(Number.isFinite(v), `${FORMATIONS[k].id}: poz sonlu değil`);
    assert.ok(p.fov > 20 && p.fov < 80, `${FORMATIONS[k].id}: fov ${p.fov}`);
  }
});

test('her şekil sonlu, sahne ölçüsünde ve tekrarlanabilir', () => {
  for (let k = 0; k < FORMATION_COUNT; k++) {
    const f = buildFormation(k, N);
    const id = FORMATIONS[k].id;
    assert.equal(f.pos.length, N * 3);
    assert.equal(f.nf, Math.floor(N * 0.9));
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < f.nf; i++) {
      for (let a = 0; a < 3; a++) {
        const v = f.pos[i * 3 + a];
        assert.ok(Number.isFinite(v), `${id}: sonlu olmayan koordinat`);
        lo[a] = Math.min(lo[a], v);
        hi[a] = Math.max(hi[a], v);
      }
      assert.ok(f.size[i] > 0.3 && f.size[i] < 4, `${id}: nokta boyutu ${f.size[i]}`);
      assert.ok([0, 1, 2, 3].includes(f.tint[i]), `${id}: renk ${f.tint[i]}`);
    }
    if (k >= 8) {
      // içerik şekilleri aynı kamera pozuna ve «Şekil» kutusuna sığacak ölçüde kalır
      const span = hi.map((h, a) => h - lo[a]);
      assert.ok(Math.max(Math.abs(lo[0]), hi[0]) <= 7.5, `${id}: x taşıyor (${lo[0].toFixed(1)}..${hi[0].toFixed(1)})`);
      assert.ok(Math.max(Math.abs(lo[1]), hi[1]) <= 5.5, `${id}: y taşıyor (${lo[1].toFixed(1)}..${hi[1].toFixed(1)})`);
      assert.ok(Math.max(Math.abs(lo[2]), hi[2]) <= 6, `${id}: z taşıyor (${lo[2].toFixed(1)}..${hi[2].toFixed(1)})`);
      // en az iki eksende yayılır (yatay duran şekiller — ör. pay — yükseklikte basık olabilir)
      assert.ok([...span].sort((a, b) => b - a)[1] > 2, `${id}: şekil çökmüş`);
    }
    const again = buildFormation(k, N);
    assert.deepEqual(again.pos, f.pos, `${id}: aynı tohumla farklı noktalar`);
  }
});

test('sayfa eşlemeleri yalnızca var olan şekillere gider', () => {
  const maps = { AREA_SHAPE, SERVICE_SHAPE, SECTOR_SHAPE, CALC_SHAPE, CALC_GROUP_SHAPE, FAQ_SHAPE, ABOUT_SHAPE };
  for (const [name, m] of Object.entries(maps)) for (const [k, id] of Object.entries(m)) assert.doesNotThrow(() => sceneOf(id), `${name}.${k} → ${id}`);
  for (const [k, v] of Object.entries(PAGE)) {
    assert.doesNotThrow(() => sceneOf(v.scene), `PAGE.${k}.scene`);
    assert.doesNotThrow(() => figOf(v.fig), `PAGE.${k}.fig`);
  }
  assert.throws(() => sceneOf('olmayan-sekil'), RangeError);
  assert.throws(() => sceneOf(FORMATION_COUNT), RangeError);
  assert.equal(sceneOf(null), null);
});

test('Hakkımızda: terazi değil, Orhun Abideleri tarzında yazıt', () => {
  assert.equal(PAGE.about.scene, 'yazit');
  assert.ok(!PAGE.about.fig.includes('terazi'));
  assert.ok(!Object.values(ABOUT_SHAPE).includes('terazi'));
  assert.match(FIGURES[SCENE.yazit], /Orhun/);
});
