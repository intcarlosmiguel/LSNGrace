import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo } from '../src/core/scene/defaults';
import { axisBarVisible, setAxisBar } from '../src/core/geometry/graphSettings';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { useDocument } from '../src/state/document';
test('Axis bar control reflects overlapping frame and removes both lines without changing ticks or data', () => {
  const s = createDemo(),
    g = s.graphs[0];
  g.axes.xaxis.bar.enabled = false;
  assert.equal(axisBarVisible(g, 'xaxis'), true);
  const ticks = structuredClone(g.axes.xaxis.ticks),
    sets = structuredClone(g.sets);
  setAxisBar(g, 'xaxis', false);
  assert.equal(axisBarVisible(g, 'xaxis'), false);
  assert.equal(axisBarVisible(g, 'yaxis'), true);
  assert.deepEqual(g.axes.xaxis.ticks, ticks);
  assert.deepEqual(g.sets, sets);
  const round = parseAgr(serializeAgr(s)).graphs[0];
  assert.equal(round.frame.style, 0);
  assert.equal(round.axes.xaxis.bar.enabled, false);
  setAxisBar(g, 'xaxis', true);
  assert.equal(axisBarVisible(g, 'xaxis'), true);
  assert.equal(g.frame.style, 0);
});
test('Imported frame-only outline preserves the other pair of sides', () => {
  const g = createDemo().graphs[0];
  g.axes.yaxis.bar.enabled = false;
  g.frame.color = 4;
  g.frame.width = 2;
  setAxisBar(g, 'xaxis', false);
  assert.deepEqual(g.axes.yaxis.bar, { enabled: true, color: 4, width: 2, style: 1 });
});
test('One undo restores both frame and axis bar after hiding a bar', () => {
  const store = useDocument;
  store.getState().load(createDemo(), 'Bar regression');
  store.getState().edit((s) => setAxisBar(s.graphs[0], 'xaxis', false));
  store.getState().undo();
  assert.equal(store.getState().scene.graphs[0].frame.style, 1);
  assert.equal(store.getState().scene.graphs[0].axes.xaxis.bar.enabled, true);
});
