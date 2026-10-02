// Tam sayfa temas çizelgesi (geliştirme): sayfayı baştan sona kaydırıp (reveal tetiklensin) tam boy görüntü alır,
// uzun görüntüyü yan yana sütunlara bölüp tek bir JPEG'e dizer → tek bakışta tüm sayfa.
//   node tests/sheet.mjs --paths=/sektorler/,/bilgi-merkezi/sozluk/ [--w=390] [--h=844] [--mobile] [--fx=lite|full|off]
//                        [--col=1500] [--cols=5] [--name=sh]
// Çıktı: tests/shots/<name>-<w>-<yol>.jpg  (gerekir: python3 + Pillow)
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });
const base = args.base || 'http://127.0.0.1:4181';
const w = +(args.w || 390);
const h = +(args.h || 844);
const mobile = !!args.mobile || w < 700;
const paths = String(args.paths || '/').split(',').filter(Boolean);
const colH = +(args.col || 1500);
const maxCols = +(args.cols || 5);
const name = args.name || 'sh';

const py = `
import sys
from PIL import Image
src, dst, colh, maxcols = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGB')
W, H = im.size
n = min(maxcols, max(1, -(-H // colh)))
gap = 12
sheet = Image.new('RGB', (n * W + (n - 1) * gap, colh), (120, 120, 130))
for i in range(n):
    part = im.crop((0, i * colh, W, min(H, (i + 1) * colh)))
    sheet.paste(part, (i * (W + gap), 0))
sheet.save(dst, 'JPEG', quality=72)
print(f'{W}x{H} -> {n} sütun, {sheet.size[0]}x{sheet.size[1]}' + (' (KESİLDİ)' if H > n * colh else ''))
`;
fs.writeFileSync(path.join(out, '_stitch.py'), py);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
const ctx = await guardContext(await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile }));
if (args.fx) await ctx.addInitScript((v) => localStorage.setItem('boraden-fx', v), args.fx);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
for (const p of paths) {
  await page.goto(base + p, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y < total; y += innerHeight * 0.6) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.waitForTimeout(500);
  const tmp = path.join(out, '_full.png');
  await page.screenshot({ path: tmp, fullPage: true, type: 'png' });
  const dst = path.join(out, `${name}-${w}-${p.replace(/[^a-z0-9]+/gi, '_') || 'home'}.jpg`);
  const res = execFileSync('python3', [path.join(out, '_stitch.py'), tmp, dst, String(colH), String(maxCols)]).toString().trim();
  console.log(path.basename(dst), res);
}
if (logs.length) console.log('--- konsol ---\n' + [...new Set(logs)].slice(0, 20).join('\n'));
await browser.close();
