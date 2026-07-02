// Minimal static file server for Playwright fixtures.
// Serves the repo root (so fixtures can import ../../scripts/*.js and
// ../../blocks/*/*.js with correct relative paths, and so /nav.plain.html
// can be requested the same way header.js's loadFragment() does in real EDS)
// with correct MIME types for ES module imports, which `file://` cannot provide.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

// Fixture-only route aliases: lets fixture HTML request paths the way real
// EDS pages do (e.g. header.js always fetches "/nav.plain.html") while the
// actual file lives under test/fixtures/ instead of the repo root.
const ALIASES = {
  '/nav.plain.html': '/test/fixtures/nav.plain.html',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const aliasedPath = ALIASES[urlPath] || urlPath;
  const filePath = path.join(ROOT, aliasedPath);

  // prevent path traversal outside the repo root
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Test static server listening on http://localhost:${PORT}`);
});
