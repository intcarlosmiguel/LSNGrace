import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasterSize } from '../src/core/export/raster';
import { pngResolution } from '../server/pngResolution';
import { Resvg } from '@resvg/resvg-js';
test('PNG resolution uses physical page dimensions and accepts publication DPI', () => {
  assert.deepEqual(rasterSize([792, 612], 300), { width: 3300, height: 2550 });
  assert.deepEqual(rasterSize([792, 612], 1200), { width: 13200, height: 10200 });
  assert.throws(() => rasterSize([792, 612], 0));
  assert.throws(() => rasterSize([792, 612], NaN));
  assert.throws(() => rasterSize([4096, 4096], 1200));
});
test('PNG pHYs records actual DPI without changing pixels or duplicating metadata', () => {
  const original = Buffer.from(
    new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>',
    )
      .render()
      .asPng(),
  );
  const output = pngResolution(pngResolution(original, 300), 600);
  const chunks = new Map<string, Buffer[]>();
  for (let offset = 8; offset < output.length;) {
    const size = output.readUInt32BE(offset),
      type = output.toString('ascii', offset + 4, offset + 8);
    chunks.set(type, [...(chunks.get(type) ?? []), output.subarray(offset + 8, offset + 8 + size)]);
    offset += size + 12;
  }
  assert.equal(output.toString('ascii', 12, 16), 'IHDR');
  assert.equal(chunks.get('pHYs')!.length, 1);
  assert.equal(chunks.get('pHYs')![0].readUInt32BE(0), Math.round(600 / 0.0254));
  assert.equal(chunks.get('pHYs')![0][8], 1);
  assert.equal(chunks.get('IHDR')![0].readUInt32BE(0), 20);
  assert.equal(chunks.get('IHDR')![0].readUInt32BE(4), 10);
});
