// Servidor EXCLUSIVO de teste de interface. Não é usado por npm start nem pelo Vercel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const stop = { cp: 340015329, np: 'PAULISTA - PONTO DE TESTE', ed: 'Avenida de exemplo - dados fictícios' };
const args = process.argv;
const port = Number(args[args.indexOf('--port') + 1]) || 4173;
const forecast = { hr: '10:15', p: { ...stop, l: [{ c: '8000-10', lt0: 'DESTINO DE TESTE', vs: [{ p: '11111', t: '10:21', a: true }, { p: '22222', t: '10:30', a: false }] }] } };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/responsive') {
    const width = [360, 390, 768, 1280].includes(Number(url.searchParams.get('width'))) ? Number(url.searchParams.get('width')) : 360;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html lang="pt-BR"><title>Teste responsivo ${width}px</title><body style="margin:0;background:#ddd;font:14px Arial"><p style="text-align:center">TESTE RESPONSIVO: ${width}px - dados fictícios</p><iframe title="Aplicativo a ${width} pixels" src="/" style="display:block;width:${width}px;height:1100px;border:1px solid #999;margin:0 auto"></iframe></body></html>`);
  }
  if (url.pathname === '/api/sptrans') {
    const resource = url.searchParams.get('resource');
    const term = url.searchParams.get('termo') || '';
    let data;
    if (resource === 'status') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ configured: true })); }
    if (term.toLowerCase() === 'erro') { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Falha de conexão simulada para teste.' })); }
    if (term.toLowerCase() === 'vazio') data = [];
    else if (resource === 'linhas') data = [{ cl: 1234, lt: '8000', tl: 10, sl: 1, tp: 'ORIGEM DE TESTE', ts: 'DESTINO DE TESTE' }];
    else if (resource === 'previsao') data = url.searchParams.get('codigo') === '999' ? { hr: '10:15', p: null } : forecast;
    else data = [stop, { cp: 999, np: 'PONTO SEM PREVISÃO - TESTE', ed: 'Sem veículos simulados' }];
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ data, consultedAt: '2026-11-11T13:15:00Z', source: 'FIXTURE DE TESTE' }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + '/')) { res.writeHead(403); return res.end(); }
    let bytes = await readFile(file);
    if (extname(file) === '.html') bytes = Buffer.from(bytes.toString().replace('<body>', '<body><p style="background:#fff3cf;color:#111;margin:0;padding:10px;text-align:center">TESTE DE INTERFACE - DADOS FICTÍCIOS</p>'));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`Teste com dados fictícios: http://127.0.0.1:${port}/`));
