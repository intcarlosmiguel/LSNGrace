import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlank, createSet, createGraph } from '../src/core/scene/defaults';
import { setGraphBorder, setGraphScale } from '../src/core/geometry/graphSettings';
import { useDocument } from '../src/state/document';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';

test('Context settings round-trip border, axis visibility, grids, inversion and legend', () => {
  const scene = createBlank(),
    g = scene.graphs[0];
  setGraphBorder(g, false);
  g.axes.xaxis.enabled = false;
  g.axes.yaxis.ticks.majorGrid = true;
  g.axes.yaxis.ticks.minorGrid = true;
  g.axes.yaxis.inverted = true;
  g.legend.enabled = false;
  const output = serializeAgr(scene),
    round = parseAgr(output).graphs[0];
  assert.match(output, /@    frame linestyle 0/);
  assert.equal(round.frame.style, 0);
  assert.equal(round.axes.xaxis.enabled, false);
  assert.equal(round.axes.yaxis.ticks.majorGrid, true);
  assert.equal(round.axes.yaxis.ticks.minorGrid, true);
  assert.equal(round.axes.yaxis.inverted, true);
  assert.equal(round.legend.enabled, false);
  setGraphBorder(round, true);
  assert.equal(round.frame.style, 1);
});

test('Log and reciprocal scale changes reject unsupported domains before mutating plain graphs', () => {
  const g = createBlank().graphs[0],
    s = createSet();
  s.rows = [
    [-3, -2],
    [-2, -1],
  ];
  g.sets = [s];
  let original = structuredClone(g);
  assert.throws(() => setGraphScale(g, 'xaxis', 'Logarithmic'), /Sem dados válidos/);
  assert.deepEqual(g, original);
  s.rows = [
    [-1, 1],
    [1, 2],
  ];
  original = structuredClone(g);
  assert.throws(() => setGraphScale(g, 'xaxis', 'Reciprocal'), /atravessar zero/);
  assert.deepEqual(g, original);
});

test('Context log scale fits positive pairs and keeps points and other graphs unchanged through undo/redo', () => {
  const scene = createBlank(),
    g = scene.graphs[0],
    s = createSet();
  s.rows = [
    [-1, 100],
    [1, 2],
    [10, 3],
    [100, 4],
  ];
  g.sets = [s];
  scene.graphs.push(createGraph(7));
  const store = useDocument;
  store.getState().load(scene, 'context.agr');
  const original = store.getState().scene,
    rows = original.graphs[0].sets[0].rows;
  store.getState().edit((s) => setGraphScale(s.graphs[0], 'xaxis', 'Logarithmic'));
  const current = store.getState().scene;
  assert.equal(current.graphs[0].axes.xaxis.scale, 'Logarithmic');
  assert.ok(current.graphs[0].world[0] > 0);
  assert.ok(current.graphs[0].world[3] < 100);
  assert.equal(current.graphs[0].sets[0].rows, rows);
  assert.equal(current.graphs[1], original.graphs[1]);
  store.getState().undo();
  assert.equal(store.getState().scene, original);
  store.getState().redo();
  assert.equal(store.getState().scene, current);
  const round = parseAgr(serializeAgr(current));
  assert.equal(round.graphs[0].axes.xaxis.scale, 'Logarithmic');
  assert.deepEqual(round.graphs[0].sets[0].rows, rows);
});

test('Empty graphs get valid scale defaults and failures in the store do not create history entries', () => {
  const g = createBlank().graphs[0];
  setGraphScale(g, 'xaxis', 'Logarithmic');
  assert.deepEqual([g.world[0], g.world[2]], [1, 10]);
  assert.equal(g.axes.xaxis.ticks.major, 10);
  const scene = createBlank(),
    s = createSet();
  s.rows = [
    [1, -1],
    [2, -2],
  ];
  scene.graphs[0].sets = [s];
  const store = useDocument;
  store.getState().load(scene, 'invalid.agr');
  const original = store.getState().scene;
  assert.throws(() =>
    store.getState().edit((scene) => setGraphScale(scene.graphs[0], 'yaxis', 'Logarithmic')),
  );
  assert.equal(store.getState().scene, original);
  assert.equal(store.getState().past.length, 0);
});
