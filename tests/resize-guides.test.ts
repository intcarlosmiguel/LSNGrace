import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlank, createGraph } from '../src/core/scene/defaults';
import { snapGraphResize } from '../src/features/canvas/resizeGuides';
import { addGraph, moveViewport } from '../src/features/composition/layout';
import { freeze, produce } from 'immer';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function pair() {
  const scene = createBlank();
  scene.page.size = [600, 600];
  scene.graphs[0].viewport = [0.1, 0.1, 0.4, 0.4];
  const other = createGraph(1);
  other.viewport = [0.6, 0.1, 0.9, 0.4];
  scene.graphs.push(other);
  return scene;
}
test('Resize snaps moving edges to nearby graph edges with the opposite corner fixed', () => {
  const s = pair(),
    g = s.graphs[0],
    r = snapGraphResize(s, g, [0.1, 0.1, 0.598, 0.395], { corner: 3, tolerance: 4 });
  [0.1, 0.1, 0.6, 0.4].forEach((v, i) => near(r.bounds[i], v));
  assert.ok(r.guides.some((g) => g.axis === 'x' && g.position === 360));
  assert.ok(r.guides.some((g) => g.axis === 'y' && g.position === 360));
});
test('Resize honors screen-sized tolerance, without broad attraction or rounding', () => {
  const s = pair(),
    proposed: [number, number, number, number] = [0.1, 0.1, 0.5891234, 0.39];
  const r = snapGraphResize(s, s.graphs[0], proposed, { corner: 3, tolerance: 2 });
  proposed.forEach((v, i) => near(r.bounds[i], v));
});
test('Proportional snapping adjusts one common scale and preserves the opposite corner', () => {
  const s = pair(),
    r = snapGraphResize(s, s.graphs[0], [0.1, 0.1, 0.598, 0.598], {
      corner: 3,
      proportional: true,
      tolerance: 4,
    });
  near(r.bounds[0], 0.1);
  near(r.bounds[1], 0.1);
  near(r.bounds[2], 0.6);
  near(r.bounds[3], 0.6);
  near((r.bounds[2] - r.bounds[0]) / (r.bounds[3] - r.bounds[1]), 1);
});
test('Centered scale retains center and ratio and reports aligned centers for buttons', () => {
  const s = pair(),
    r = snapGraphResize(s, s.graphs[0], [0.085, 0.085, 0.415, 0.415], {
      corner: 3,
      centered: true,
      proportional: true,
      tolerance: 6,
    });
  near(r.bounds[0] + r.bounds[2], 0.5);
  near(r.bounds[1] + r.bounds[3], 0.5);
  near((r.bounds[2] - r.bounds[0]) / (r.bounds[3] - r.bounds[1]), 1);
  assert.ok(r.guides.some((g) => g.axis === 'y' && g.position === 450));
});
test('Moving inset graphs and hidden graphs never attract their resizing parent', () => {
  const s = pair();
  s.graphs[1].hidden = true;
  const id = addGraph(s, 0, 'inset');
  s.graphs.find((g) => g.id === id)!.viewport = [0.2, 0.2, 0.3, 0.3];
  const proposed: [number, number, number, number] = [0.1, 0.1, 0.201, 0.4];
  const r = snapGraphResize(s, s.graphs[0], proposed, { corner: 3, tolerance: 4 });
  proposed.forEach((v, i) => near(r.bounds[i], v));
  assert.equal(r.guides.length, 0);
});
test('Free resize bypasses both attraction and guides', () => {
  const s = pair(),
    bounds: [number, number, number, number] = [0.1, 0.1, 0.598, 0.395];
  const r = snapGraphResize(s, s.graphs[0], bounds, { corner: 3, tolerance: 6, free: true });
  assert.equal(r.bounds, bounds);
  assert.equal(r.guides.length, 0);
});
test('Snapped viewport transforms insets and remains undoable with immutable input', () => {
  const s = pair(),
    id = addGraph(s, 0, 'inset'),
    base = freeze(s, true),
    g = base.graphs[0];
  const r = snapGraphResize(base, g, [0.1, 0.1, 0.598, 0.395], { corner: 3, tolerance: 4 });
  const next = produce(base, (d) => moveViewport(d, 0, r.bounds));
  assert.deepEqual(base.graphs[0].viewport, [0.1, 0.1, 0.4, 0.4]);
  assert.notDeepEqual(
    next.graphs.find((g) => g.id === id)!.viewport,
    base.graphs.find((g) => g.id === id)!.viewport,
  );
  assert.deepEqual(next.graphs[0].world, base.graphs[0].world);
});
test('Repeated button steps progress past an already snapped edge instead of getting stuck', () => {
  const s = createBlank();
  s.page.size = [600, 600];
  s.graphs[0].viewport = [245 / 600, 245 / 600, 355 / 600, 355 / 600];
  const reference = createGraph(1);
  reference.viewport = [245 / 600, 0.1, 260 / 600, 0.2];
  s.graphs.push(reference);
  const r = snapGraphResize(s, s.graphs[0], [239.5 / 600, 239.5 / 600, 360.5 / 600, 360.5 / 600], {
    corner: 3,
    centered: true,
    proportional: true,
    tolerance: 6,
    direction: 1,
  });
  assert.ok(r.bounds[2] - r.bounds[0] > 110 / 600);
});
