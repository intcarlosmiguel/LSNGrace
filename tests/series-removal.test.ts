import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, createGraph } from '../src/core/scene/defaults';
import { insertRegression } from '../src/core/analysis/regression';
import { removeSeries } from '../src/core/scene/operations';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { useDocument } from '../src/state/document';
test('Removing a fitted series removes its child report atomically and supports undo/redo', () => {
  const scene = createDemo(),
    graph = scene.graphs[0];
  const report = insertRegression(graph, graph.sets[0].id, { method: 'linear' });
  const other = createGraph(7);
  other.sets = [structuredClone(graph.sets.find((s) => s.id === report.curveSetId)!)];
  scene.graphs.push(other);
  scene.compatibility.preserved.push({
    scope: 'graph',
    graphId: 0,
    raw: `@ s${report.curveSetId} avalue on`,
  });
  useDocument.getState().load(scene, 'removal');
  const before = useDocument.getState().scene;
  useDocument.getState().edit((s) => removeSeries(s, 0, report.curveSetId));
  const after = useDocument.getState().scene;
  assert.ok(!after.graphs[0].sets.some((s) => s.id === report.curveSetId));
  assert.equal(after.graphs[0].regressions?.length, 0);
  assert.equal(after.graphs[1], before.graphs[1]);
  assert.equal(after.compatibility.preserved.length, 0);
  assert.ok(!parseAgr(serializeAgr(after)).graphs[0].sets.some((s) => s.id === report.curveSetId));
  useDocument.getState().undo();
  assert.equal(useDocument.getState().scene, before);
  useDocument.getState().redo();
  assert.equal(useDocument.getState().scene, after);
});
test('Removing source keeps the historical report attached to the surviving fitted curve', () => {
  const scene = createDemo(),
    g = scene.graphs[0];
  const report = insertRegression(g, g.sets[0].id, { method: 'linear' });
  removeSeries(scene, 0, report.sourceSetId);
  assert.equal(g.regressions?.[0], report);
  assert.ok(g.sets.some((s) => s.id === report.curveSetId));
});
