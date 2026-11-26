import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../desktop/server';

test('desktop serves UI and original Grace API, rejects cross-origin render requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lsngrace-desktop-'));
  await writeFile(join(root, 'index.html'), '<title>LSNGrace</title>');
  const { server, url } = await startServer(root);
  try {
    const page = await fetch(url);
    assert.match(await page.text(), /LSNGrace/);
    assert.match(page.headers.get('Content-Security-Policy') ?? '', /script-src 'self'/);
    const status = await fetch(`${url}/api/grace/status`);
    assert.equal(status.status, 200);
    assert.equal(typeof (await status.json()).available, 'boolean');
    const denied = await fetch(`${url}/api/grace/render`, {
      method: 'POST',
      headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(denied.status, 403);
    assert.equal((await fetch(`${url}/missing.js`)).status, 404);
    const traversal = await fetch(`${url}/..%2f..%2fetc%2fpasswd`);
    assert.equal(traversal.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
