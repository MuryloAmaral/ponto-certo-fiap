import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/sptrans.js';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const port = Number(argument('--port') || process.env.PORT) || 3000;
const host = argument('--host') || '0.0.0.0';

createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/sptrans') return handler(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  try {
    const name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const file = resolve(publicDir, name);
    if (!file.startsWith(publicDir + sep)) { res.writeHead(403); return res.end(); }
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada.');
  }
}).listen(port, host, () => console.log(`Ponto Certo: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
