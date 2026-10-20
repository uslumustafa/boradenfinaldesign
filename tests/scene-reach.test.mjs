// Sayfa kahramanı başlık sütunu (T-22): src/data/scene-reach.json, güncel şekillerle (formations.js) ve kamera yerleşimiyle
// (world.js › pose) uyuşuyor mu? Uyuşmuyorsa: node scripts/scene-reach.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildFormation, FORMATIONS } from '../src/assets/js/world/formations.js';
import { edgeOf, modelEdge, SETTINGS, SKIP } from '../scripts/scene-reach.mjs';
import { reachOf } from '../scripts/scenes.mjs';
import { makeFilters } from '../scripts/filters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/scene-reach.json'), 'utf8'));
const REGEN = 'şekiller ya da yerleşim değişmiş: node scripts/scene-reach.mjs ile yeniden üretin';
// İki katsayılı modelin gevşek kaldığı sahneler (veri güvenli yönde, çizgi şeklin solunda; yalnızca sıkılık denetlenmez). Ekim 2026'ya
// kadar kapı kemeri (`kapi`) buradaydı; yerini alan `diyalog` balonları sahne ölçüsündedir, gevşek sahne kalmadı.
const LOOSE = new Set([]);

test('her sahnenin (sağda şekli olan) verisi var, fazlası yok', () => {
  const want = FORMATIONS.map((f) => f.id).filter((id) => !SKIP.has(id)).sort();
  assert.deepEqual(Object.keys(data.scenes).sort(), want, REGEN);
  assert.deepEqual(data.settings, SETTINGS, REGEN);
});

test('CSS ifadesi (max/min) modelle aynı: sol ≈ a·W − b·H/dm', () => {
  const css = (a, b, W, H) => Math.max((a * W) / 100 - (b * H) / 100, Math.min((a * W) / 100 - ((b / 1.6) * W) / 100, (a * W) / 100 - ((b / 1.25) * H) / 100));
  for (const [W, H] of [[960, 900], [1024, 768], [1100, 800], [1280, 720], [1280, 1024], [1440, 900], [1920, 1080], [2560, 1080]]) {
    for (const [a, b] of [[67.6, 39.8], [68.3, 32.7], [66, 39.2]]) assert.ok(Math.abs(css(a, b, W, H) - modelEdge(a, b, W, H)) < 1e-9, `${W}×${H}`);
  }
});

test('veri güncel şekillerle uyuşuyor: sütun çizgisi her sahnede şeklin solunda, gereğinden fazla solda da değil', () => {
  const sizes = [[1024, 768], [1280, 720], [1440, 900], [1920, 1080]];
  const errs = [];
  for (const [id, [a, b]] of Object.entries(data.scenes)) {
    const k = FORMATIONS.findIndex((f) => f.id === id);
    const F = buildFormation(k, SETTINGS.points);
    for (const [W, H] of sizes) {
      const slack = edgeOf(k, F, W, H) - modelEdge(a, b, W, H); // şekil kenarı ile çizgi arası (px)
      if (slack < SETTINGS.safetyPx - 1) errs.push(`${id} ${W}×${H}: çizgi şekle ${(SETTINGS.safetyPx - slack).toFixed(0)} px fazla yakın`);
      if (slack > SETTINGS.safetyPx + 40 && !LOOSE.has(id)) errs.push(`${id} ${W}×${H}: çizgi şeklin ${slack.toFixed(0)} px solunda (veri eski)`);
    }
  }
  assert.deepEqual(errs, [], REGEN);
});

test('şablon süzgeci: sahne → --sa/--sb; arazi sahnesi ve bilinmeyen sahne boş', () => {
  const f = makeFilters();
  const [a, b] = data.scenes.arama;
  assert.equal(f.scene_reach('arama'), `--sa:${a};--sb:${b}`);
  assert.equal(f.scene_reach(FORMATIONS.findIndex((x) => x.id === 'arama')), `--sa:${a};--sb:${b}`);
  assert.equal(f.scene_reach('ufuk'), '');
  assert.equal(f.scene_reach(null), '');
  assert.equal(reachOf(undefined), null);
});

// Derleme çıktısı: sayfa kahramanları sahnelerinin katsayılarını taşıyor (BORADEN_DIST ya da dist/)
const DIST = path.resolve(ROOT, process.env.BORADEN_DIST || 'dist');
test('derlemede sayfa kahramanları sahne katsayılarını taşıyor', { skip: !fs.existsSync(path.join(DIST, 'arama/index.html')) && 'derleme çıktısı yok' }, () => {
  const html = fs.readFileSync(path.join(DIST, 'arama/index.html'), 'utf8');
  const m = html.match(/<section class="phero[^"]*"[^>]*data-world="(\d+)"[^>]*style="--sa:([\d.]+);--sb:([\d.]+)"/);
  assert.ok(m, 'arama: phero bölümünde style="--sa:…;--sb:…" yok');
  assert.deepEqual([Number(m[2]), Number(m[3])], data.scenes[FORMATIONS[Number(m[1])].id]);
  const notFound = fs.readFileSync(path.join(DIST, '404.html'), 'utf8');
  assert.match(notFound, /<section class="phero phero--wide/, '404: arazi sahnesinde sütun daralmamalı');
});
