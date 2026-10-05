// Fontsource paketlerinden yalnızca gereken (latin + latin-ext) woff2 dosyalarını src/assets/fonts içine alır
// ve 00-fonts.css dosyasını üretir. Türkçe karakterler ve ₺ latin-ext aralığındadır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules/@fontsource');
const OUT_FONTS = path.join(ROOT, 'src/assets/fonts');
const OUT_CSS = path.join(ROOT, 'src/assets/css/00-fonts.css');
fs.mkdirSync(OUT_FONTS, { recursive: true });

const FAMILIES = [
  { pkg: 'montserrat', variants: ['300', '300-italic', '400', '400-italic', '500', '600', '600-italic', '700'] },
  { pkg: 'open-sans', variants: ['300', '400', '400-italic', '500', '600', '700'] },
  { pkg: 'asap', variants: ['400', '500', '600', '700'] },
];

let css = '/* Otomatik üretildi: scripts/vendor-fonts.mjs — Montserrat, Open Sans, Asap (SIL OFL) — boraden.com.tr yazı tipi ailesi */\n';
for (const fam of FAMILIES) {
  fs.copyFileSync(path.join(NM, fam.pkg, 'LICENSE'), path.join(OUT_FONTS, `${fam.pkg}.LICENSE`));
  for (const v of fam.variants) {
    const src = fs.readFileSync(path.join(NM, fam.pkg, `${v}.css`), 'utf8');
    const rules = src.match(/@font-face\s*\{[^}]*\}/g) || [];
    for (const rule of rules) {
      const m = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(rule);
      if (!m) continue;
      const file = m[1];
      if (!/-latin(-ext)?-\d{3}-(normal|italic)\.woff2$/.test(file)) continue;
      fs.copyFileSync(path.join(NM, fam.pkg, 'files', file), path.join(OUT_FONTS, file));
      const out = rule.replace(/src:[^;]+;/, `src: url(/assets/fonts/${file}) format('woff2');`);
      css += `\n${out}\n`;
    }
  }
}
fs.writeFileSync(OUT_CSS, css);
console.log('fonts ->', fs.readdirSync(OUT_FONTS).length, 'dosya; css', css.length, 'bayt');
