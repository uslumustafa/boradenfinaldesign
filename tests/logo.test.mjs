// Logo bütünlüğü: patron logodaki üç tikin bozulmasını istemiyor.
// Kural: TEK resmî dosya (değişmemiş), TEK bileşen (partials/logo.njk), hiçbir yerde yeniden renk/esnetme/kırpma/filtre yok.
//   node --test tests/logo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OFFICIAL = 'src/assets/img/boraden-logo.png';
const OFFICIAL_MD5 = '58d548f4618ac1a8df50151c5110088a';
const OFFICIAL_SIZE = { w: 211, h: 48 };
const PARTIAL = 'src/templates/partials/logo.njk';
const dist = path.resolve(root, process.env.BORADEN_DIST || 'dist');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const md5 = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

test('resmî logo dosyası değişmemiş (md5) ve doğal boyutu 211×48', () => {
  const file = path.join(root, OFFICIAL);
  assert.ok(fs.existsSync(file), 'resmî logo dosyası yok');
  assert.equal(md5(file), OFFICIAL_MD5, 'logo dosyası değiştirilmiş — resmî dosya bozulmamalı');
  const buf = fs.readFileSync(file);
  assert.equal(buf.toString('latin1', 1, 4), 'PNG');
  assert.equal(buf.readUInt32BE(16), OFFICIAL_SIZE.w);
  assert.equal(buf.readUInt32BE(20), OFFICIAL_SIZE.h);
});

test('src/assets/img altında (fotoğraflar hariç) başka logo/işaret türevi yok', () => {
  const imgRoot = path.join(root, 'src/assets/img');
  const files = walk(imgRoot, (p) => !p.startsWith(path.join(imgRoot, 'photos') + path.sep)).map((p) => path.relative(imgRoot, p));
  const extra = files.filter((f) => /(logo|mark|brand|tick|tik|favicon|icon)/i.test(path.basename(f)) && f !== 'boraden-logo.png');
  assert.deepEqual(extra, [], 'resmî dosyanın türevleri/yeniden çizimleri bulundu: ' + extra.join(', '));
});

// Ekranda logonun göründüğü fotoğraflar (toplantı odası) sitede kullanılmaz: logo yalnızca resmî dosyayla gösterilir.
// Bu kareler photos.json'da `logo: true` ile işaretlidir (model.mjs de bunları hiçbir havuza/seçime almaz).
test('içinde logo görünen fotoğraflar hiçbir şablon/veri/betikte kullanılmaz', () => {
  const manifest = JSON.parse(read('src/data/photos.json'));
  const LOGO_PHOTOS = Object.entries(manifest).filter(([, v]) => v && typeof v === 'object' && v.logo).map(([k]) => k);
  for (const k of ['meeting-logo', 'meeting-wide', 'handshake-group', 'handshake-group-2'])
    assert.ok(LOGO_PHOTOS.includes(k), `${k} fotoğrafında ekranda logo görünür; photos.json'da logo: true olmalı`);
  const scan = [
    ...walk(path.join(root, 'src/templates'), (p) => p.endsWith('.njk')),
    ...walk(path.join(root, 'src/assets/js'), (p) => p.endsWith('.js')),
    ...walk(path.join(root, 'src/assets/css'), (p) => p.endsWith('.css')),
    ...walk(path.join(root, 'scripts'), (p) => p.endsWith('.mjs')),
    ...walk(path.join(root, 'src/data'), (p) => p.endsWith('.json') && path.basename(p) !== 'photos.json'),
  ];
  const used = [];
  for (const p of scan) {
    const txt = fs.readFileSync(p, 'utf8');
    for (const k of LOGO_PHOTOS) if (txt.includes(k)) used.push(`${path.relative(root, p)} → ${k}`);
  }
  assert.deepEqual(used, []);
});

test('logo bileşeni: tek <img>, resmî dosya, doğal en-boy oranı, süs yok', () => {
  const html = read(PARTIAL).replace(/\{#[\s\S]*?#\}/g, '');
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  assert.equal(imgs.length, 1, 'logo bileşeninde tam bir <img> olmalı');
  const img = imgs[0];
  assert.match(img, /src="\/assets\/img\/boraden-logo\.png"/);
  assert.match(img, new RegExp(`width="${OFFICIAL_SIZE.w}"`));
  assert.match(img, new RegExp(`height="${OFFICIAL_SIZE.h}"`));
  assert.doesNotMatch(img, /\bstyle=/i, 'satır içi stil yok');
  assert.doesNotMatch(html, /<svg\b|<canvas\b|<picture\b|<source\b|srcset=/i, 'alternatif çizim/kaynak yok');
});

test('görünür logo yalnızca partials/logo.njk içinde; paylaşım metadata aynı özgün dosyayı kullanır', () => {
  const scan = [
    ...walk(path.join(root, 'src/templates'), (p) => p.endsWith('.njk')),
    ...walk(path.join(root, 'src/assets/css'), (p) => p.endsWith('.css')),
    ...walk(path.join(root, 'src/assets/js'), (p) => p.endsWith('.js')),
    ...walk(path.join(root, 'scripts'), (p) => p.endsWith('.mjs')),
    ...walk(path.join(root, 'src/data'), (p) => p.endsWith('.json')),
  ];
  const metadata = 'src/data/site.json';
  const share = JSON.parse(read(metadata)).shareImage;
  assert.deepEqual(share, { path: '/assets/img/boraden-logo.png', alt: 'Boraden', width: OFFICIAL_SIZE.w, height: OFFICIAL_SIZE.h });
  const offenders = scan.filter((p) => ![PARTIAL, metadata].includes(path.relative(root, p)) && /boraden-logo/i.test(fs.readFileSync(p, 'utf8')));
  assert.deepEqual(
    offenders.map((p) => path.relative(root, p)),
    [],
    'logo dosyası bileşen dışında anılıyor'
  );
  for (const f of ['src/templates/partials/header.njk', 'src/templates/partials/footer.njk']) {
    assert.match(read(f), /\{%\s*include\s+"partials\/logo\.njk"\s*%\}/, `${f} logo bileşenini include etmeli`);
  }
});

test('CSS: logoya filtre/dönüşüm/karışım/kırpma/gölge/saydamlık/sabit en+boy uygulanmaz', () => {
  const banned = /(^|[;{\s])(filter|backdrop-filter|transform|rotate|scale|mix-blend-mode|clip-path|mask(-image)?|opacity|box-shadow|text-shadow|object-fit|object-position|aspect-ratio|zoom)\s*:/i;
  const files = walk(path.join(root, 'src/assets/css'), (p) => p.endsWith('.css'));
  const bad = [];
  for (const f of files) {
    const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const sel = m[1].trim();
      if (!/(^|[\s,>+~])(\.brand\b|\.brand__img\b)|img\[[^\]]*logo/i.test(sel) && !/\.brand__/i.test(sel)) continue;
      if (banned.test(m[2])) bad.push(`${path.relative(root, f)}: ${sel.replace(/\s+/g, ' ')}`);
      // hem sabit genişlik hem sabit yükseklik → esnetme riski (width:auto olmalı)
      const w = /(^|[;\s])width\s*:\s*([^;]+)/i.exec(m[2]);
      const h = /(^|[;\s])height\s*:\s*([^;]+)/i.exec(m[2]);
      if (/\.brand__img\b/.test(sel) && w && h && !/^auto\b/i.test(w[2].trim()) && !/^auto\b/i.test(h[2].trim())) bad.push(`${path.relative(root, f)}: ${sel} (sabit en+boy)`);
    }
  }
  assert.deepEqual(bad, []);
  // .brand__img: yükseklik değişkeni + width:auto (oran korunur)
  const layout = read('src/assets/css/30-layout.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /\.brand__img\s*\{([^}]*)\}/.exec(layout);
  assert.ok(rule, '.brand__img kuralı bulunamadı');
  assert.match(rule[1], /width\s*:\s*auto/);
  assert.match(rule[1], /height\s*:\s*var\(--logo-h\)/);
});

test('JS: logo öğesine stil/dönüşüm uygulanmaz', () => {
  const files = walk(path.join(root, 'src/assets/js'), (p) => p.endsWith('.js'));
  const bad = files.filter((f) => /(\.brand\b|brand__img)/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(bad.map((p) => path.relative(root, p)), [], 'JS logoya dokunuyor');
});

const distPages = walk(dist, (p) => /index\.html$|404\.html$/.test(p) && !p.includes(`${path.sep}assets${path.sep}`));
test('derlenmiş site: her sayfada logo tam olarak bileşen çıktısıdır (üst + alt bilgi) ve dist dosyası özgün', { skip: !distPages.length && 'dist yok (önce derleyin)' }, () => {
  const partial = read(PARTIAL).replace(/\{#[\s\S]*?#\}/g, '').trim();
  assert.ok(partial.startsWith('<a class="brand"'));
  const copy = path.join(dist, 'assets/img/boraden-logo.png');
  assert.ok(fs.existsSync(copy), 'dist içinde logo yok');
  assert.equal(md5(copy), OFFICIAL_MD5, 'dist\'teki logo özgün dosyadan farklı');
  const bad = [];
  for (const p of distPages) {
    const html = fs.readFileSync(p, 'utf8');
    const n = html.split(partial).length - 1;
    if (n !== 2) bad.push(`${path.relative(dist, p)}: bileşen ${n} kez`);
    // başka bir logo görseli/çizimi sızmasın
    const imgs = (html.match(/<img\b[^>]*>/g) || []).filter((t) => /logo/i.test(t) && !t.includes('boraden-logo.png'));
    if (imgs.length) bad.push(`${path.relative(dist, p)}: yabancı logo görseli`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});
