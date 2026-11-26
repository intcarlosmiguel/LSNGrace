import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, createBlank, createSet } from '../src/core/scene/defaults';
import {
  nearestPoint,
  insertPoint,
  deletePoint,
  addCanvasText,
} from '../src/features/canvas/pointEditing';
import { graphBox, normalized } from '../src/core/geometry/coordinates';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { useDocument } from '../src/state/document';
import { freeze } from 'immer';
test('Point hit tests match logarithmic and inverted axis coordinates, ignore hidden series and preserve exact values', () => {
  const scene = createDemo(),
    g = scene.graphs[0];
  g.world = [1, 1, 100, 100];
  g.axes.xaxis.scale = 'Logarithmic';
  g.axes.yaxis.inverted = true;
  g.sets = [createSet(0)];
  g.sets[0].rows = [
    [10, 20],
    [80, 30],
  ];
  const b = graphBox(scene, g.viewport);
  const pos: [number, number] = [
    b.left + normalized(10, 1, 100, g.axes.xaxis) * b.width,
    b.bottom - normalized(20, 1, 100, g.axes.yaxis) * b.height,
  ];
  freeze(scene, true);
  const hit = nearestPoint(scene, g, pos, 1)!;
  assert.equal(hit.x, 10);
  assert.equal(hit.y, 20);
  assert.equal(hit.index, 0);
  assert.equal(nearestPoint(scene, g, [pos[0] + 11, pos[1]], 1), null);
  const mutable = createDemo();
  mutable.graphs[0].sets.forEach((s) => (s.hidden = true));
  assert.equal(nearestPoint(mutable, mutable.graphs[0], pos, 1), null);
});
test('Append or ordered insertion preserves other columns, descending order, and independent series', () => {
  const scene = createBlank(),
    g = scene.graphs[0];
  const id = insertPoint(g, null, [2, 4]);
  insertPoint(g, id, [1, 3]);
  insertPoint(g, id, [3, 5]);
  assert.deepEqual(g.sets[0].rows, [
    [1, 3],
    [2, 4],
    [3, 5],
  ]);
  g.sets[0].type = 'xydy';
  g.sets[0].rows = [
    [3, 5, 0.1],
    [1, 3, 0.2],
  ];
  insertPoint(g, id, [2, 4, 0.3]);
  assert.deepEqual(g.sets[0].rows, [
    [3, 5, 0.1],
    [2, 4, 0.3],
    [1, 3, 0.2],
  ]);
  assert.throws(() => insertPoint(g, id, [4, 5]), /coordenadas/);
  assert.throws(() => insertPoint(g, id, [4, 5, -1]), /coordenadas/);
  deletePoint(g, id, 1);
  assert.deepEqual(g.sets[0].rows, [
    [3, 5, 0.1],
    [1, 3, 0.2],
  ]);
  assert.throws(() => deletePoint(g, id, 8), /indisponível/);
});
test('Point edits and text annotations support undo/redo and native AGR round-trip', async () => {
  const scene = createDemo();
  useDocument.getState().load(scene, 'point-edit');
  const before = useDocument.getState().scene;
  useDocument.getState().edit((s) => {
    deletePoint(s.graphs[0], s.graphs[0].sets[0].id, 0);
    addCanvasText(s, [150, 100], 'Texto de teste', 1);
  });
  const after = useDocument.getState().scene;
  const agr = serializeAgr(after);
  assert.ok(agr.includes('string def "Texto de teste"'));
  assert.ok(serializeAgr(parseAgr(agr)).includes('string def "Texto de teste"'));
  const { renderGraceDetailed } = await import('../server/grace');
  const svg = (await renderGraceDetailed(agr, 'svg')).output.toString('utf8');
  assert.ok(svg.includes('Texto de teste'));
  const native = (await renderGraceDetailed(agr, 'agr')).output.toString('latin1');
  assert.ok(native.includes('Texto de teste'));
  useDocument.getState().undo();
  assert.equal(useDocument.getState().scene, before);
  useDocument.getState().redo();
  assert.equal(useDocument.getState().scene, after);
});
