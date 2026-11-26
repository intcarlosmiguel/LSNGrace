import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { graceStatus, renderGraceDetailed, type NativeFormat } from './grace';
export async function graceMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/api/grace/')) return next();
  const route = req.url.split('?')[0];
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const json = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
      return json(403, { error: 'Origem não autorizada.' });
    if (route === '/api/grace/status' && req.method === 'GET')
      return json(200, await graceStatus());
    if (route !== '/api/grace/render' || req.method !== 'POST')
      return json(404, { error: 'Operação não encontrada.' });
    if (!req.headers['content-type']?.startsWith('application/json'))
      return json(415, { error: 'Envie um projeto JSON.' });
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 20 * 1024 * 1024) return json(413, { error: 'Projeto maior que 20 MB.' });
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      typeof body.agr !== 'string' ||
      !['svg', 'png', 'eps', 'agr', 'pdf'].includes(body.format ?? 'svg')
    )
      return json(400, { error: 'Projeto ou formato inválido.' });
    const controller = new AbortController();
    const cancel = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', cancel);
    try {
      const result = await renderGraceDetailed(
        body.agr,
        (body.format ?? 'svg') as NativeFormat,
        controller.signal,
        { dpi: body.dpi, nativePreview: body.nativePreview === true },
      );
      res.setHeader(
        'Content-Type',
        body.format === 'pdf'
          ? 'application/pdf'
          : body.format === 'png'
            ? 'image/png'
            : body.format === 'eps'
              ? 'application/postscript'
              : body.format === 'agr'
                ? 'text/plain; charset=iso-8859-1'
                : 'image/svg+xml; charset=utf-8',
      );
      res.setHeader('X-LSNGrace-Engine', 'gracebat');
      if (result.warnings.length)
        res.setHeader('X-LSNGrace-Warnings', encodeURIComponent(JSON.stringify(result.warnings)));
      res.end(result.output);
    } finally {
      res.removeListener('close', cancel);
    }
  } catch (error) {
    if (!res.destroyed) json(422, { error: (error as Error).message });
  }
}
export function gracePlugin(): Plugin {
  return {
    name: 'lsngrace-native-engine',
    configureServer(server) {
      server.middlewares.use(graceMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(graceMiddleware);
    },
  };
}
