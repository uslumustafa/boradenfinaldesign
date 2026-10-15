// Hesaplayıcı duman testi (geliştirme aracı; test paketine dahil değildir): gerçek Chrome'da her hesaplayıcı sayfasını açar,
// varsayılan değerlerle sonucun üretildiğini, hazır örneklerin ve seçenek geçişlerinin hata vermediğini denetler.
//   node tests/calc-smoke.mjs [--base=http://127.0.0.1:4181] [--only=maas-hesaplama]
import { chromium } from 'playwright-core';
import { guardContext } from './safe-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const base = args.base || 'http://127.0.0.1:4181';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defs = ['bordro', 'vergi'].flatMap((k) => JSON.parse(fs.readFileSync(path.join(root, `src/data/calculators-${k}.json`), 'utf8')));
const list = defs.filter((d) => !args.only || d.slug === args.only);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await guardContext(await browser.newContext({ viewport: { width: 1280, height: 900 } })); // mailto:/tel: işletim sistemine gitmesin (safe-context.mjs)
let problems = 0;
const DESIGNED = /^Hesaplanamadı(\s|$)/; // «Hesaplanamadı» (nokta kuralı: cümle sonu noktası yazılmaz)
const say = (ok, ...m) => { if (!ok) problems++; console.log(ok ? '  ok ' : '  !! ', ...m); };

for (const def of list) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  console.log(`\n▸ ${def.slug}  (${def.engine})`);
  await page.goto(`${base}/hesaplayicilar/${def.slug}/`, { waitUntil: 'load' });
  const read = async () => {
    await page.waitForTimeout(320);
    return page.evaluate(() => {
      const err = document.querySelector('[data-calc-res] .calc__err');
      const main = document.querySelector('[data-calc-res] .calc__main dd');
      const bad = document.querySelector('[data-calc] .field.is-invalid .field__err');
      return { error: err ? err.textContent.trim() : bad ? bad.textContent.trim() : '', main: main ? main.textContent.trim() : '' };
    });
  };
  try {
    await page.waitForSelector('[data-calc] .calc__sum:not(.calc__sum--idle), [data-calc] .calc__err', { timeout: 9000 });
  } catch {
    say(false, 'sonuç alanı oluşmadı');
  }
  let r = await read();
  say(!r.error && !!r.main, `varsayılan → ${r.main || '—'}${r.error ? '  HATA: ' + r.error : ''}`);

  // hazır örnekler
  const nPresets = await page.locator('[data-preset]').count();
  for (let i = 0; i < nPresets; i++) {
    const btn = page.locator('[data-preset]').nth(i);
    const label = (await btn.textContent()).trim();
    await btn.click();
    r = await read();
    say(!r.error && !!r.main, `örnek “${label}” → ${r.main || '—'}${r.error ? '  HATA: ' + r.error : ''}`);
  }

  // seçenekli girdiler: her seçeneği dene (gelişmiş bölümü aç)
  await page.evaluate(() => document.querySelectorAll('[data-adv]').forEach((d) => (d.open = true)));
  for (const inp of def.inputs.filter((i) => i.type === 'select' || i.type === 'segment')) {
    // başka bir girdiye bağlı olarak gizli olan alanlar atlanır
    if (!(await page.locator(`[data-field="${inp.id}"]`).isVisible())) continue;
    const choose = async (value) => {
      if (inp.type === 'select') await page.selectOption(`select[name="${inp.id}"]`, String(value), { timeout: 2500 }).catch(() => {});
      else await page.locator(`input[name="${inp.id}"][value="${value}"]`).evaluate((el) => el.click()).catch(() => {});
    };
    for (const op of inp.options || []) {
      await choose(op.value);
      r = await read();
      // «Hesaplanamadı. …» tasarım gereği bir reddedişdir (ör. %0 KDV'de KDV'den matrah, yürürlüğe girmemiş oran sınıfı): sorun sayılmaz
      if (r.error && DESIGNED.test(r.error)) console.log(`  ~~  ${inp.id}=${op.value} → tasarım gereği hesaplanmadı (${r.error})`);
      else say(!r.error && !!r.main, `${inp.id}=${op.value} → ${r.main || '—'}${r.error ? '  (uyarı: ' + r.error + ')' : ''}`);
    }
    // sonraki girdiler önceki girdinin seçeneğinden etkilenmesin: varsayılana dön
    const dv = inp.default ?? (inp.options && inp.options[0] && inp.options[0].value);
    if (dv !== undefined) await choose(dv);
  }
  r = await read();
  say(!r.error && !!r.main, `seçenekli girdiler varsayılana dönünce (sayısal girdiler son örnekte kalır) → ${r.main || '—'}${r.error ? '  HATA: ' + r.error : ''}`);

  // sayfa içi yapı: açıklama/SSS/kaynak bölümleri
  const struct = await page.evaluate(() => ({
    explain: document.querySelectorAll('#nasil .calcdoc__block').length,
    faq: document.querySelectorAll('#sss details').length,
    src: document.querySelectorAll('#kaynaklar a').length,
    params: !!document.querySelector('[data-params]'),
  }));
  say(struct.explain > 0 && struct.faq > 0 && struct.src > 0, `sayfa yapısı: ${JSON.stringify(struct)}`);
  say(errs.length === 0, errs.length ? 'konsol: ' + errs.slice(0, 4).join(' | ') : 'konsol temiz');
  await page.close();
}
await browser.close();
console.log(`\n${problems ? '✖ ' + problems + ' sorun' : '✔ tümü geçti'}`);
process.exit(problems ? 1 : 0);
