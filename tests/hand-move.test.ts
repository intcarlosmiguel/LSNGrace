import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlank, createGraph, createSet } from '../src/core/scene/defaults';
import { graphMove } from '../src/features/canvas/moveGraph';
import { panGraph } from '../src/features/canvas/interactions';
import { moveViewport, addGraph } from '../src/features/composition/layout';
import { canLiveZoom } from '../src/features/canvas/liveZoom';
import { produce, freeze } from 'immer';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9);
test('Hand inside pans world; hand above translates viewport without changing data or scales', () => {
  const s = createBlank();
  s.page.size = [900, 600];
  s.graphs[0].sets = [
    {
      ...createSet(),
      rows: [
        [0, 0],
        [1, 1],
      ],
    },
  ];
  const base = freeze(s, true),
    g = base.graphs[0];
  const pan = produce(base, (d) => panGraph(d.graphs[0], [0.4, 0.4], [0.5, 0.5]));
  assert.notDeepEqual(pan.graphs[0].world, g.world);
  assert.deepEqual(pan.graphs[0].viewport, g.viewport);
  const motion = graphMove(base, g, [20, 30], [55, 50], 0, true);
  const translated = produce(base, (d) => moveViewport(d, 0, motion.bounds));
  assert.deepEqual(translated.graphs[0].world, g.world);
  assert.equal(translated.graphs[0].sets[0].rows, g.sets[0].rows);
  near((translated.graphs[0].viewport[0] - g.viewport[0]) * 600, 35);
  near((translated.graphs[0].viewport[1] - g.viewport[1]) * 600, -20);
  assert.equal(canLiveZoom(base, translated), true);
});
test('Moving a graph snaps its edge/top to another graph within screen tolerance', () => {
  const s = createBlank();
  s.page.size = [900, 600];
  s.graphs[0].viewport = [0.12, 0.16, 0.7, 0.82];
  const other = createGraph(1);
  other.viewport = [0.91, 0.16, 1.44, 0.82];
  s.graphs.push(other);
  const r = graphMove(s, s.graphs[0], [0, 0], [124, 2], 6);
  near(r.bounds[2] * 600, 546);
  near((1 - r.bounds[3]) * 600, 108);
  assert.ok(r.guides.some((g) => g.axis === 'x' && g.position === 546));
  assert.ok(r.guides.some((g) => g.axis === 'y'));
});
test('Move excludes its moving inset family and transforms it together with view legends', () => {
  const s = createBlank();
  s.page.size = [600, 600];
  s.graphs[0].viewport = [0.1, 0.1, 0.4, 0.4];
  const id = addGraph(s, 0, 'inset');
  const before = structuredClone(s),
    motion = graphMove(s, s.graphs[0], [0, 0], [1, 1], 6);
  near((motion.bounds[0] - 0.1) * 600, 1);
  moveViewport(s, 0, motion.bounds);
  s.graphs.forEach((g, i) => {
    near((g.viewport[0] - before.graphs[i].viewport[0]) * 600, 1);
    assert.deepEqual(g.world, before.graphs[i].world);
  });
  assert.notDeepEqual(
    s.graphs.find((g) => g.id === id)!.legend.position,
    before.graphs.find((g) => g.id === id)!.legend.position,
  );
});
test('Free move bypasses snapping and viewport scaling still rejects the navigation preview', () => {
  const s = createBlank();
  s.page.size = [600, 600];
  s.graphs[0].viewport = [0.1, 0.1, 0.4, 0.4];
  const g = createGraph(1);
  g.viewport = [0.6, 0.1, 0.9, 0.4];
  s.graphs.push(g);
  const r = graphMove(s, s.graphs[0], [0, 0], [117, 2], 6, true);
  assert.equal(r.guides.length, 0);
  near(r.bounds[2] * 600, 357);
  const base = freeze(s, true),
    resized = produce(base, (d) => {
      d.graphs[0].viewport[2] += 0.1;
    });
  assert.equal(canLiveZoom(base, resized), false);
});
