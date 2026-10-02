// Küçük statik sunucu: temiz URL (/yol/ → /yol/index.html), HTTP Range, 404.html, geliştirme için no-cache.
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

export function serve({ root = process.env.BORADEN_DIST ? path.resolve(process.env.BORADEN_DIST) : path.join(ROOT, 'dist'), port = Number(process.env.PORT) || 4181, quiet = false } = {}) {
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      let p = decodeURIComponent(u.pathname);
      let file = path.join(root, p);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        return res.end('403');
      }
      let stat = fs.existsSync(file) ? fs.statSync(file) : null;
      if (stat && stat.isDirectory()) {
        if (!p.endsWith('/')) {
          res.writeHead(301, { Location: p + '/' + u.search });
          return res.end();
        }
        file = path.join(file, 'index.html');
        stat = fs.existsSync(file) ? fs.statSync(file) : null;
      }
      let status = 200;
      if (!stat) {
        const nf = path.join(root, '404.html');
        if (fs.existsSync(nf)) {
          file = nf;
          stat = fs.statSync(nf);
          status = 404;
        } else {
          res.writeHead(404);
          return res.end('404');
        }
      }
      const size = stat.size;
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
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
    if (!quiet) console.log(`Boraden → http://127.0.0.1:${port}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
