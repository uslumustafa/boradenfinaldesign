// Yazı tipleri (npm run fonts): scripts/tools/subset-fonts.py çalıştırılır — Fontsource latin + latin-ext dosyaları yüz başına
// tek dosyada birleştirilir ve Türkçe içeriğin karakterlerine indirilir; dosya adında içerik özeti olur. Çıktılar:
// src/assets/fonts/*.woff2, src/assets/fonts/fonts.json (önyükleme için), src/assets/css/00-fonts.css.
// Gerekenler: python3, fonttools, brotli (pip install fonttools brotli). PYTHON ortam değişkeni başka yorumlayıcı seçer.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.env.PYTHON || 'python3', [path.join(ROOT, 'scripts/tools/subset-fonts.py')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
