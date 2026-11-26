import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist-desktop', { recursive: true });
await build({
  entryPoints: ['desktop/main.ts'],
  outfile: 'dist-desktop/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  packages: 'external',
});
await copyFile('desktop/preload.cjs', 'dist-desktop/preload.cjs');
