import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const vocabularyRoot = resolve(process.env.IENGLISH_VOCABULARY_DIR || resolve(root, '..', 'iEnglish-vocabulary'));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const vocabularyFile = path.startsWith('/vocabulary/');
    const publicPath = vocabularyFile ? path.slice('/vocabulary'.length) : path === '/' ? '/index.html' : path;
    const fileRoot = vocabularyFile ? vocabularyRoot : root;
    const file = resolve(fileRoot, '.' + publicPath);
    const permittedVocabulary = !vocabularyFile || /^\/(?:manifest\.json|words\.json|licenses\/[A-Za-z0-9._-]+\.txt)$/.test(publicPath);
    if (!permittedVocabulary || !file.startsWith(fileRoot + sep) || publicPath.split('/').some(part => part.startsWith('.')) || !(await stat(file)).isFile()) {
      res.writeHead(404).end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`iEnglish is ready at http://localhost:${port}`));
