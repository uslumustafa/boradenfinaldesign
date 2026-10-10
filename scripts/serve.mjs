// Küçük statik sunucu: temiz URL (/yol/ → /yol/index.html), HTTP Range, 404.html, geliştirme için no-cache.
// vercel.json'daki kuralları da uygular (trailingSlash, redirects, headers; has/missing koşullarıyla) — yerel testler
// yayındaki yanıtı görsün diye: içerik güvenlik politikası (CSP), noindex, eski site yönlendirmeleri. Önbellek başlığı
// yerelde «no-cache» kalır (geliştirmede eski dosya görülmesin).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.map': 'application/json',
};

/* ── vercel.json öykünmesi ─────────────────────────────────────────────────────────────────────────────────────────── */

export function loadVercel(file = path.join(ROOT, 'vercel.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Vercel kaynak kalıbı (path-to-regexp alt kümesi, «strict»: sondaki / isteğe bağlı değildir):
// düz metin, (düzenli ifade) grupları, :ad, :ad?, :ad*, :ad+
const reCache = new Map();
export function sourceRegex(source) {
  if (reCache.has(source)) return reCache.get(source);
  const names = [];
  let re = '';
  for (let i = 0; i < source.length; ) {
    const c = source[i];
    if (c === '(') {
      let depth = 0;
      let j = i;
      for (; j < source.length; j++) {
        if (source[j] === '\\') j++;
        else if (source[j] === '(') depth++;
        else if (source[j] === ')' && --depth === 0) break;
      }
      re += source.slice(i, j + 1);
      names.push(String(names.length));
      i = j + 1;
      continue;
    }
    const m = c === ':' && /^:([A-Za-z_]\w*)([?*+])?/.exec(source.slice(i));
    if (m) {
      names.push(m[1]);
      const mod = m[2] || '';
      const slash = re.endsWith('\\/');
      if (slash) re = re.slice(0, -2);
      const seg = '[^\\/]+?';
      const many = `(${seg}(?:\\/${seg})*)`;
      const pre = slash ? '\\/' : '';
      if (mod === '*') re += `(?:${pre}${many})?`;
      else if (mod === '+') re += `${pre}${many}`;
      else if (mod === '?') re += `(?:${pre}(${seg}))?`;
      else re += `${pre}(${seg})`;
      i += m[0].length;
      continue;
    }
    re += c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    i++;
  }
  const out = { re: new RegExp(`^${re}$`), names };
  reCache.set(source, out);
  return out;
}

function matchSource(source, pathname) {
  const { re, names } = sourceRegex(source);
  const m = re.exec(pathname);
  if (!m) return null;
  const params = {};
  names.forEach((n, k) => {
    params[n] = m[k + 1] ?? '';
    params[`$${k + 1}`] = m[k + 1] ?? '';
  });
  return params;
}

// has/missing koşulu: değer düzenli ifade (dizgi, baştan sona) ya da { eq, neq, inc, ninc, pre, suf, re } nesnesi
function valueOk(v, actual) {
  if (actual === undefined || actual === null) return false;
  if (v === undefined) return true;
  if (typeof v === 'string') return new RegExp(`^${v}$`).test(actual);
  const n = Number(actual);
  const ops = {
    eq: (x) => actual === String(x),
    neq: (x) => actual !== x,
    inc: (x) => x.includes(actual),
    ninc: (x) => !x.includes(actual),
    pre: (x) => actual.startsWith(x),
    suf: (x) => actual.endsWith(x),
    re: (x) => new RegExp(x).test(actual),
    gt: (x) => n > x,
    gte: (x) => n >= x,
    lt: (x) => n < x,
    lte: (x) => n <= x,
  };
  return Object.entries(v).every(([k, x]) => {
    if (!ops[k]) throw new Error(`vercel.json: desteklenmeyen koşul işleci «${k}»`);
    return ops[k](x);
  });
}

function conditionOk(c, ctx) {
  const cookie = (k) => {
    const hit = (ctx.headers.cookie || '').split(/;\s*/).find((s) => s.startsWith(k + '='));
    return hit ? decodeURIComponent(hit.slice(k.length + 1)) : undefined;
  };
  const actual = { host: ctx.host, header: ctx.headers[String(c.key).toLowerCase()], query: ctx.query.get(c.key) ?? undefined, cookie: c.key && cookie(c.key) }[c.type];
  if (!(c.type in { host: 1, header: 1, query: 1, cookie: 1 })) throw new Error(`vercel.json: desteklenmeyen koşul türü «${c.type}»`);
  return valueOk(c.value, actual);
}

const applies = (rule, ctx) => (rule.has || []).every((c) => conditionOk(c, ctx)) && !(rule.missing || []).some((c) => conditionOk(c, ctx));

// Bir istek için vercel.json yanıtı: { redirect: {status, location} } ya da { headers }
export function route(cfg, { pathname, search = '', host = 'localhost', headers = {} }) {
  const ctx = { host, headers, query: new URLSearchParams(search) };
  // 1) trailingSlash (Vercel bunu özel yönlendirmelerden ÖNCE uygular)
  if (cfg.trailingSlash === true && !/^\/\.well-known(?:\/.*)?$/.test(pathname)) {
    if (/^\/((?:[^/]+\/)*[^/.]+)$/.test(pathname)) return { redirect: { status: 308, location: pathname + '/' + search } };
    if (/^\/((?:[^/]+\/)*[^/]+\.\w+)\/$/.test(pathname)) return { redirect: { status: 308, location: pathname.slice(0, -1) + search } };
  }
  // 2) redirects (ilk eşleşen)
  for (const r of cfg.redirects || []) {
    const params = matchSource(r.source, pathname);
    if (!params || !applies(r, ctx)) continue;
    let dest = r.destination.replace(/:([A-Za-z_]\w*)\*?/g, (_, n) => params[n] ?? '').replace(/\$(\d+)/g, (_, k) => params[`$${k}`] ?? '');
    if (search) dest += (dest.includes('?') ? '&' : '?') + search.slice(1);
    return { redirect: { status: r.statusCode || (r.permanent === false ? 307 : 308), location: dest } };
  }
  // 3) headers (eşleşen tüm kurallar; aynı başlıkta sonraki kazanır)
  const out = {};
  for (const rule of cfg.headers || []) {
    if (!matchSource(rule.source, pathname) || !applies(rule, ctx)) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return { headers: out };
}

/* ── Sunucu ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

// host: has/missing koşulları için ziyaret edilen alan adını öykünür (ör. 'www.boraden.com.tr' → yayındaki başlıklar);
// verilmezse isteğin Host başlığı kullanılır. vercel: yapılandırma nesnesi (false → vercel.json uygulanmaz).
export function serve({
  root = process.env.BORADEN_DIST ? path.resolve(process.env.BORADEN_DIST) : path.join(ROOT, 'dist'),
  port = Number(process.env.PORT) || 4181,
  quiet = false,
  host = process.env.BORADEN_HOST || '',
  vercel = loadVercel(),
} = {}) {
  root = fs.realpathSync.native(path.resolve(root));
  const cfg = vercel || {};
  // Vercel büyük/küçük harfe duyarlıdır; macOS diski değildir. Diskteki yazımla birebir aynı olmayan yol bulunamamış sayılır
  // (yoksa yerelde «/Hizmetler/» açılır, yayında 404 olur).
  const sameCase = (file) => {
    try {
      const real = fs.realpathSync.native(file);
      return real === file || real.toLowerCase() !== file.toLowerCase();
    } catch {
      return false;
    }
  };
  const outside = (file) => {
    const rel = path.relative(root, file);
    return rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel);
  };
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      const reqHost = host || String(req.headers.host || '').replace(/:\d+$/, '');
      const r = route(cfg, { pathname: u.pathname, search: u.search, host: reqHost, headers: req.headers });
      if (r.redirect) {
        res.writeHead(r.redirect.status, { Location: r.redirect.location });
        return res.end();
      }
      const extra = { ...r.headers };
      delete extra['Cache-Control'];
      // Yerel sunucu düz http'dir. upgrade-insecure-requests yayında (https) etkisizdir; yerelde ise Chrome, fetch'in izlediği
      // yönlendirmeyi https'e çevirip isteği kırar (yayında olmayan bir davranış). Bu yüzden yalnızca yerelde çıkarılır.
      if (extra['Content-Security-Policy']) {
        extra['Content-Security-Policy'] = extra['Content-Security-Policy']
          .split(';')
          .map((d) => d.trim())
          .filter((d) => d && d !== 'upgrade-insecure-requests')
          .join('; ');
      }
      let p = decodeURIComponent(u.pathname);
      let file = path.join(root, p);
      if (outside(file)) {
        res.writeHead(403);
        return res.end('403');
      }
      let stat = fs.existsSync(file) && sameCase(file) ? fs.statSync(file) : null;
      if (stat && outside(fs.realpathSync(file))) {
        res.writeHead(403);
        return res.end('403');
      }
      if (stat && stat.isDirectory()) {
        if (!p.endsWith('/')) {
          res.writeHead(301, { Location: p + '/' + u.search });
          return res.end();
        }
        file = path.join(file, 'index.html');
        stat = fs.existsSync(file) && sameCase(file) ? fs.statSync(file) : null;
      }
      let status = 200;
      if (!stat) {
        const nf = path.join(root, '404.html');
        if (fs.existsSync(nf)) {
          file = nf;
          stat = fs.statSync(nf);
          status = 404;
        } else {
          res.writeHead(404, extra);
          return res.end('404');
        }
      }
      if (outside(fs.realpathSync(file))) {
        res.writeHead(403);
        return res.end('403');
      }
      const size = stat.size;
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const base = { ...extra, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
      const range = req.headers.range;
      if (range && status === 200) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let s = m && m[1] ? Number(m[1]) : 0;
        let e = m && m[2] ? Number(m[2]) : size - 1;
        if (e >= size) e = size - 1;
        res.writeHead(206, { ...base, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Content-Length': e - s + 1 });
        fs.createReadStream(file, { start: s, end: e }).pipe(res);
      } else {
        res.writeHead(status, { ...base, 'Content-Length': size });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(file).pipe(res);
      }
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  server.listen(port, '127.0.0.1', () => {
    if (!quiet) console.log(`Boraden → http://127.0.0.1:${server.address().port}${host ? ` (alan adı öykünmesi: ${host})` : ''}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
