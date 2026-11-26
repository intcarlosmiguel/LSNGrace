import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { graceMiddleware } from '../server/plugin';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
export async function startServer(root: string, port = 0) {
  const server = createServer((req, res) => {
    void graceMiddleware(req, res, () => {
      void (async () => {
        const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
        if (!file.startsWith(resolve(root) + sep)) {
          res.writeHead(403).end();
          return;
        }
        const bytes = await readFile(file);
        res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'",
        );
        res.end(bytes);
      })().catch(() => {
        if (!res.headersSent) res.writeHead(404);
        res.end();
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Servidor local indisponível.');
  return { server, url: `http://127.0.0.1:${address.port}` };
}
