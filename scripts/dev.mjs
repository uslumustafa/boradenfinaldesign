// Geliştirme: derle → sunucuyu başlat → src/ ve scripts/ değişince yeniden derle.
// Her derleme AYRI bir Node sürecinde çalışır: rota/model/filtre modülleri önbellekte kalmaz, değişiklikler anında yansır.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './build.mjs';
import { serve } from './serve.mjs';

const SRC = path.join(ROOT, 'src');
const SCRIPTS = path.join(ROOT, 'scripts');
let timer = null;
let running = false;
let again = false;

function buildOnce() {
  return new Promise((resolve) => {
    const t = Date.now();
    const child = spawn(process.execPath, [path.join(SCRIPTS, 'build.mjs')], { cwd: ROOT, env: process.env, stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', (e) => {
      console.error('[build] başlatılamadı', e.message || e);
      resolve();
    });
    child.on('close', (code) => {
      if (code) console.error(`[build] HATA (çıkış kodu ${code}) — ${Date.now() - t} ms`);
      resolve();
    });
  });
}

async function run() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  await buildOnce();
  running = false;
  if (again) {
    again = false;
    run();
  }
}

await run();
serve({});
const onChange = (_evt, file) => {
  if (file && /(^|\/)\./.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(run, 120);
};
fs.watch(SRC, { recursive: true }, onChange);
fs.watch(SCRIPTS, { recursive: true }, onChange);
