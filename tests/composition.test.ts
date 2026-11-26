import { test } from 'node:test';
import assert from 'node:assert/strict';
import { produce, freeze } from 'immer';
import { createBlank, createGraph, createSet } from '../src/core/scene/defaults';
import {
  addGraph,
  arrangeGraphs,
  graphParents,
  moveViewport,
  removeGraph,
  resizeImage,
} from '../src/features/composition/layout';
import { validateScene } from '../src/core/scene/validate';
import { parseAgr } from '../src/core/agr/parser';
import { serializeAgr } from '../src/core/agr/serializer';
import { useDocument } from '../src/state/document';

test('Side-by-side and stacked graphs are independent and stay on the publication page', () => {
  const scene = createBlank();
  addGraph(scene, 0, 'beside');
  assert.equal(scene.graphs.length, 2);
  assert.equal(graphParents(scene).size, 0);
  const [a, b] = scene.graphs;
  assert.ok(a.viewport[2] < b.viewport[0]);
  arrangeGraphs(scene, 'column');
  assert.ok(a.viewport[1] > b.viewport[3]);
  assert.deepEqual(validateScene(scene), []);
  const unit = Math.min(...scene.page.size);
  for (const g of scene.graphs)
    assert.ok(
      g.viewport[0] >= 0 &&
        g.viewport[1] >= 0 &&
        g.viewport[2] <= scene.page.size[0] / unit &&
        g.viewport[3] <= scene.page.size[1] / unit,
    );
});

test('Inset hierarchy follows the smallest containing graph, including nested insets', () => {
  const s = createBlank(),
    child = addGraph(s, 0, 'inset'),
    grandchild = addGraph(s, child, 'inset');
  assert.equal(graphParents(s).get(child), 0);
  assert.equal(graphParents(s).get(grandchild), child);
  assert.ok(s.graphs[1].frame.background.pattern);
  s.graphs.push({ ...createGraph(12), viewport: [...s.graphs[0].viewport] });
  // Equal viewports do not create parent cycles.
  assert.equal(graphParents(s).has(0), false);
  assert.equal(graphParents(s).has(12), false);
});

test('Composition changes move insets and view legends together without copying data', () => {
  const s = createBlank(),
    set = createSet();
  set.rows = [
    [1, 2],
    [2, 3],
  ];
  s.graphs[0].sets = [set];
  const child = addGraph(s, 0, 'inset');
  s.graphs[1].legend.coordinates = 'world';
  s.graphs[1].legend.position = [0.3, 0.8];
  const base = freeze(s, true),
    old = s.graphs[0].viewport,
    c = s.graphs[1].viewport;
  const moved = produce(base, (d) =>
    moveViewport(d, 0, [old[0] + 0.1, old[1] + 0.1, old[2] + 0.1, old[3] + 0.1]),
  );
  moved.graphs[1].viewport.forEach((n, i) => assert.ok(Math.abs(n - c[i] - 0.1) < 1e-10));
  assert.deepEqual(moved.graphs[1].legend.position, [0.3, 0.8]);
  assert.equal(graphParents(moved).get(child), 0);
  assert.equal(moved.graphs[0].sets[0].rows, base.graphs[0].sets[0].rows);
  assert.ok(
    Math.abs(moved.graphs[0].legend.position[0] - base.graphs[0].legend.position[0] - 0.1) < 1e-10,
  );
});

test('Grid layout preserves inset geometry even if moving roots temporarily overlap', () => {
  const s = createBlank();
  const child = addGraph(s, 0, 'inset');
  addGraph(s, 0, 'beside');
  addGraph(s, 0, 'below');
  arrangeGraphs(s, 'grid');
  assert.equal(s.graphs.length, 4);
  assert.deepEqual([...graphParents(s)], [[child, 0]]);
  assert.deepEqual(validateScene(s), []);
});

test('Image resize keeps relative graph and legend positions, including portrait orientation', () => {
  const s = createBlank();
  addGraph(s, 0, 'inset');
  const before = structuredClone(s),
    [ow, oh] = s.page.size,
    ou = Math.min(ow, oh);
  resizeImage(s, 612, 792);
  const [w, h] = s.page.size,
    unit = Math.min(w, h);
  s.graphs.forEach((g, i) => {
    for (const j of [0, 2])
      assert.ok(
        Math.abs((g.viewport[j] * unit) / w - (before.graphs[i].viewport[j] * ou) / ow) < 1e-10,
      );
    for (const j of [1, 3])
      assert.ok(
        Math.abs((g.viewport[j] * unit) / h - (before.graphs[i].viewport[j] * ou) / oh) < 1e-10,
      );
  });
  assert.throws(() => resizeImage(s, 0, 500));
  assert.throws(() => resizeImage(s, 500, 4097));
  assert.deepEqual(validateScene(s), []);
});

test('AGR round trip preserves image dimensions and independent/inset graph viewports', () => {
  const s = createBlank();
  addGraph(s, 0, 'beside');
  addGraph(s, 1, 'inset');
  resizeImage(s, 900, 600);
  const restored = parseAgr(serializeAgr(s));
  assert.deepEqual(restored.page, s.page);
  assert.deepEqual(
    restored.graphs.map((g) => [g.id, g.viewport]),
    s.graphs.map((g) => [g.id, g.viewport]),
  );
  assert.deepEqual([...graphParents(restored)], [...graphParents(s)]);
});

test('Removing a graph removes its scoped directives, leaves insets and can be undone', () => {
  const s = createBlank();
  addGraph(s, 0, 'inset');
  s.compatibility.preserved.push({ scope: 'graph', graphId: 0, raw: '@with g0' });
  useDocument.getState().load(s, 'Composition.agr');
  useDocument.getState().edit((s) => removeGraph(s, 0));
  assert.equal(useDocument.getState().scene.graphs.length, 1);
  assert.equal(useDocument.getState().scene.graphs[0].id, 1);
  assert.equal(useDocument.getState().scene.compatibility.preserved.length, 0);
  useDocument.getState().undo();
  assert.equal(useDocument.getState().scene.graphs.length, 2);
  useDocument.getState().redo();
  assert.equal(useDocument.getState().scene.graphs.length, 1);
  useDocument.getState().edit((s) => removeGraph(s, 1));
  assert.equal(useDocument.getState().scene.graphs[0].id, 0);
});
