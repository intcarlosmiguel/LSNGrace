import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlank, createSet } from '../src/core/scene/defaults';
import {
  fontFromDisplay,
  fontToDisplay,
  fromPoints,
  toPoints,
  type FontUnit,
} from '../src/core/geometry/units';
import { resizeGraphBounds } from '../src/features/canvas/resize';
import { addGraph, moveViewport } from '../src/features/composition/layout';
import { parseAgr } from '../src/core/agr/parser';
import { serializeAgr } from '../src/core/agr/serializer';
import { produce, freeze } from 'immer';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test('Physical units and CSS pixels use exact publication units independent of screen zoom', () => {
  near(toPoints(2.54, 'cm', 600), 72);
  near(toPoints(25.4, 'mm', 600), 72);
  near(toPoints(96, 'px', 600), 72);
  near(fromPoints(72, 'px', 600), 96);
  near(toPoints(50, '%', 900), 450);
  near(fromPoints(150, '%', 600), 25);
});
test('All font units round trip without restricting large sizes', () => {
  for (const page of [
    [792, 612],
    [900, 600],
  ] as [number, number][])
    for (const unit of ['pt', 'px', 'cm', 'mm', 'in', '%', 'grace'] as FontUnit[])
      for (const size of [0.001, 1.5, 10, 1000])
        near(fontFromDisplay(fontToDisplay(size, unit, page), unit, page), size);
  near(fontFromDisplay(96, 'px', [900, 600]), 72 / 16.8);
  near(fontToDisplay(1, '%', [792, 612]), 100);
  const s = createBlank();
  s.graphs[0].title.size = 25;
  s.graphs[0].legend.size = 30;
  const restored = parseAgr(serializeAgr(s));
  assert.equal(restored.graphs[0].title.size, 25);
  assert.equal(restored.graphs[0].legend.size, 30);
});
test('Every resize corner follows sub-point deltas and keeps the opposite corner fixed', () => {
  const s = createBlank(),
    g = s.graphs[0],
    b = g.viewport,
    u = Math.min(...s.page.size);
  for (let corner = 0; corner < 4; corner++) {
    const next = resizeGraphBounds(s, g, corner, [123.1, 456.2], [123.35, 456.7]);
    near(next[corner % 2 === 0 ? 0 : 2] - b[corner % 2 === 0 ? 0 : 2], 0.25 / u);
    near(next[corner < 2 ? 1 : 3] - b[corner < 2 ? 1 : 3], -0.5 / u);
    near(next[corner % 2 === 0 ? 2 : 0], b[corner % 2 === 0 ? 2 : 0]);
    near(next[corner < 2 ? 3 : 1], b[corner < 2 ? 3 : 1]);
  }
});
test('Resize cannot flip bounds when dragged across the opposite corner', () => {
  const s = createBlank(),
    g = s.graphs[0];
  for (let c = 0; c < 4; c++)
    for (const p of [
      [1e5, 1e5],
      [-1e5, -1e5],
    ] as [number, number][]) {
      const b = resizeGraphBounds(s, g, c, [0, 0], p);
      assert.ok(b[2] > b[0] && b[3] > b[1]);
    }
});
test('Shift preserves aspect ratio and Alt preserves the graph center', () => {
  const s = createBlank(),
    g = s.graphs[0],
    v = g.viewport;
  for (let c = 0; c < 4; c++) {
    const b = resizeGraphBounds(s, g, c, [20, 30], [70, 50], true, true);
    near((b[2] - b[0]) / (b[3] - b[1]), (v[2] - v[0]) / (v[3] - v[1]));
    near(b[0] + b[2], v[0] + v[2]);
    near(b[1] + b[3], v[1] + v[3]);
  }
});
test('Resize preserves data and worlds and moves inset graphs and view legends together', () => {
  const s = createBlank();
  s.graphs[0].sets = [
    {
      ...createSet(),
      rows: [
        [0, 1],
        [1, 2],
      ],
    },
  ];
  addGraph(s, 0, 'inset');
  const base = freeze(s, true),
    g = base.graphs[0];
  const next = produce(base, (d) =>
    moveViewport(d, 0, resizeGraphBounds(base, g, 3, [0, 0], [25, -30])),
  );
  assert.deepEqual(next.graphs[0].world, g.world);
  assert.equal(next.graphs[0].sets[0].rows, g.sets[0].rows);
  assert.notDeepEqual(next.graphs[1].viewport, base.graphs[1].viewport);
  assert.notDeepEqual(next.graphs[0].legend.position, g.legend.position);
});
