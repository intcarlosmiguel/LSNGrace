import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTable, mapColumns } from '../src/core/import/tabular';
import { createBlank, createSet } from '../src/core/scene/defaults';
import { autoscaleGraph } from '../src/core/geometry/autoscale';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';

const input = readFileSync(new URL('./fixtures/susceptibility.csv', import.meta.url), 'utf8');

test('Reported CSV preserves all 208 XY pairs and the genuine initial jump', () => {
  const table = parseTable(input);
  assert.deepEqual(table.headers, ['removed_edges', 'susceptibility']);
  assert.equal(table.delimiter, ',');
  const rows = mapColumns(table, 0, 1, null);
  const independent = input
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(',').map(Number));
  assert.deepEqual(rows, independent);
  assert.equal(rows.length, 208);
  assert.deepEqual(rows[0], [20, 2209.516416531108]);
  assert.deepEqual(rows[1], [40, 9106.0208717108]);
  assert.deepEqual(rows.at(-1), [4147, 4770.61017520463]);
  assert.equal(Math.max(...rows.map((r) => r[1])), 10760.396870411329);
  assert.ok(rows.every((r, i) => i === 0 || r[0] > rows[i - 1][0]));
  const scene = createBlank(),
    g = scene.graphs[0],
    set = createSet();
  set.rows = rows;
  g.sets = [set];
  autoscaleGraph(g);
  assert.deepEqual(g.world, [-227.62, 1696.4635893, 4394.62, 11273.4496976]);
  assert.equal(g.axes.xaxis.ticks.major, 1000);
  assert.equal(g.axes.yaxis.ticks.major, 2000);
  assert.deepEqual(parseAgr(serializeAgr(scene)).graphs[0].sets[0].rows, independent);
});
