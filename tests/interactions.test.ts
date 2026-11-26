import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo } from '../src/core/scene/defaults';
import { worldAt, zoomGraph, panGraph } from '../src/features/canvas/interactions';
import { assertDeclarativeAgr, graceEncoding } from '../server/grace';
import { serializeAgr } from '../src/core/agr/serializer';
test('Pointer mapping respects inverted and logarithmic axes', () => {
  const g = createDemo().graphs[0];
  g.world = [1, 0, 100, 10];
  g.axes.xaxis.scale = 'Logarithmic';
  assert.deepEqual(worldAt(g, 0.5, 0.5), [10, 5]);
  g.axes.xaxis.inverted = true;
  assert.deepEqual(worldAt(g, 0, 0.5), [100, 5]);
});
test('Interactive zoom changes world and ticks without mutating data', () => {
  const g = createDemo().graphs[0],
    rows = g.sets[0].rows;
  g.world = [0, 0, 10, 10];
  zoomGraph(g, 0.5, 0.5, 0.5);
  assert.deepEqual(g.world, [2.5, 2.5, 7.5, 7.5]);
  assert.equal(g.sets[0].rows, rows);
  assert.ok(g.axes.xaxis.ticks.major < 2);
});
test('Pan and logarithmic zoom operate in the correct coordinate space', () => {
  const g = createDemo().graphs[0];
  g.world = [0, 0, 10, 10];
  panGraph(g, [0.5, 0.5], [0.7, 0.5]);
  assert.deepEqual(g.world, [-2, 0, 8, 10]);
  g.world = [1, 1, 100, 100];
  g.axes.xaxis.scale = 'Logarithmic';
  g.axes.yaxis.scale = 'Logarithmic';
  zoomGraph(g, 0.5, 0.5, 0.5);
  assert.ok(Math.abs(g.world[0] - Math.sqrt(10)) < 1e-12);
  assert.ok(Math.abs(g.world[2] - Math.sqrt(1000)) < 1e-12);
});
test('Native project input accepts declarative scientific projects and quoted text', () => {
  assert.doesNotThrow(() => assertDeclarativeAgr(serializeAgr(createDemo())));
  assert.doesNotThrow(() => assertDeclarativeAgr('@with g0\n@title "read; saveall; $math$"\n'));
});
test('Native bridge rejects scripts, external I/O and chained commands', () => {
  for (const text of [
    '@read "secret.dat"',
    '@with g0\n@system "cmd"',
    '@s0 hotlink on',
    '@world 0,0,1,1; read "x"',
    '@with g0 read "x"',
    '@page size 1,2\\\n@print',
  ])
    assert.throws(() => assertDeclarativeAgr(text));
});
test('Native encoding preserves Portuguese and translates Greek to Grace Symbol', () => {
  assert.equal(graceEncoding('@title "função"').toString('latin1'), '@title "função"');
  assert.equal(graceEncoding('@title "α"').toString('latin1'), '@title "\\f{Symbol}a\\f{}"');
  assert.throws(() => graceEncoding('🙂'), /codificação/);
});

test('Native rendering bounds raster allocation through page-size limits', () => {
  assert.throws(() => assertDeclarativeAgr('@page size 1000000, 1000000'), /4096/);
});
