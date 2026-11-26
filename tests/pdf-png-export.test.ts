import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createDemo } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { renderGraceDetailed } from '../server/grace';
import { rasterSize } from '../src/core/export/raster';
function pngInfo(png: Buffer) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const chunks = new Map<string, Buffer[]>();
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset),
      end = offset + size + 12;
    assert.ok(end <= png.length);
    const kind = png.toString('ascii', offset + 4, offset + 8),
      data = png.subarray(offset + 8, offset + 8 + size);
    let crc = 0xffffffff;
    for (const byte of png.subarray(offset + 4, offset + 8 + size)) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    assert.equal(png.readUInt32BE(offset + size + 8), (crc ^ 0xffffffff) >>> 0, `${kind} CRC`);
    chunks.set(kind, [...(chunks.get(kind) ?? []), data]);
    offset = end;
  }
  assert.ok(inflateSync(Buffer.concat(chunks.get('IDAT')!)).length > 0);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(chunks.get('pHYs')?.length, 1);
  assert.ok(chunks.has('IEND'));
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    ppm: chunks.get('pHYs')![0].readUInt32BE(0),
  };
}
test('PNG exports have valid chunks, exact rounded dimensions and physical resolution at 96/300/600/1200 DPI', async () => {
  const scene = createDemo();
  scene.page.size = [145, 78];
  const agr = serializeAgr(scene);
  for (const dpi of [96, 96.2, 300, 600, 1200]) {
    const output = await renderGraceDetailed(agr, 'png', undefined, { dpi });
    const info = pngInfo(output.output);
    assert.equal(info.width, rasterSize(scene.page.size, dpi).width);
    assert.equal(info.height, rasterSize(scene.page.size, dpi).height);
    assert.equal(info.ppm, Math.round(dpi / 0.0254));
  }
  const defaultPng = await renderGraceDetailed(agr, 'png');
  assert.equal(pngInfo(defaultPng.output).ppm, Math.round(96 / 0.0254));
});
test('PDF uses native vector geometry and embedded fonts at the physical page size', async () => {
  const scene = createDemo();
  scene.graphs[0].title.text = String.raw`$\alpha_0^2$ — Relaxação`;
  scene.graphs[0].sets[0].opacity = 0.4;
  const { output, warnings } = await renderGraceDetailed(serializeAgr(scene), 'pdf');
  const pdf = output.toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  const directory = await mkdtemp(join(tmpdir(), 'lsngrace-pdf-test-'));
  try {
    const path = join(directory, 'figure.pdf');
    await writeFile(path, output);
    const { stdout } = await promisify(execFile)('pdfinfo', [path], {
      env: { ...process.env, LC_ALL: 'C' },
    });
    assert.match(stdout, /Pages:\s+1/);
    assert.match(stdout, /Page size:\s+792 x 612 pts/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  assert.match(pdf, /\/FontDescriptor/);
  assert.ok(!pdf.includes('/Subtype /Image'));
  assert.deepEqual(warnings, []);
  const cached = await renderGraceDetailed(serializeAgr(scene), 'pdf');
  assert.equal(cached.output, output);
});
test('PNG preserves transparent figures and LaTeX; dense native preview remains available', async () => {
  const scene = createDemo();
  scene.page.size = [144, 72];
  scene.graphs[0].title.text = String.raw`$\alpha_0$`;
  scene.graphs[0].sets[0].opacity = 0.3;
  scene.page.fill = false;
  const { output } = await renderGraceDetailed(serializeAgr(scene), 'png', undefined, { dpi: 150 });
  assert.equal(pngInfo(output).width, 300);
  const preview = await renderGraceDetailed(serializeAgr(createDemo()), 'png', undefined, {
    nativePreview: true,
  });
  assert.equal(preview.output.subarray(1, 4).toString(), 'PNG');
  await assert.rejects(
    renderGraceDetailed(serializeAgr(scene), 'pdf', undefined, { dpi: 300 }),
    /DPI/,
  );
  assert.throws(() => rasterSize([1e-12, 1e-12], 1e15), /limite/);
});
