import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, createSet } from '../src/core/scene/defaults';
import {
  transformSeries,
  worksheetFor,
  bindWorksheet,
  removeWorksheetColumn,
  setWorksheetRowHidden,
  showAllWorksheetRows,
} from '../src/core/analysis/worksheet';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { readDraft, serializeDraft } from '../src/state/draft';
import { useDocument } from '../src/state/document';
import { insertPoint, deletePoint } from '../src/features/canvas/pointEditing';
const source = () => {
  const s = createSet(0);
  s.rows = [
    [1, 4],
    [2, 8],
    [3, 12],
    [4, 16],
  ];
  return s;
};
test('Transforms create independent columns, chain active Y and reference original and earlier columns', () => {
  const set = source(),
    original = set.rows;
  assert.equal(transformSeries(set, 'y = y - 4'), 'c1');
  assert.deepEqual(set.rows, [
    [1, 0],
    [2, 4],
    [3, 8],
    [4, 12],
  ]);
  assert.equal(transformSeries(set, 'y = c1*2 + y0'), 'c2');
  assert.deepEqual(set.rows, [
    [1, 4],
    [2, 16],
    [3, 28],
    [4, 40],
  ]);
  assert.equal(set.worksheet?.baseRows, original);
  assert.deepEqual(set.worksheet?.columns[0].values, [0, 4, 8, 12]);
  transformSeries(set, 'x = x * 1e-3');
  assert.deepEqual(
    set.rows.map((r) => r[0]),
    [0.001, 0.002, 0.003, 0.004],
  );
  removeWorksheetColumn(set, 'c1');
  assert.deepEqual(
    set.rows.map((r) => r[1]),
    [4, 16, 28, 40],
  );
  removeWorksheetColumn(set, 'c2');
  assert.deepEqual(
    set.rows.map((r) => r[1]),
    [4, 8, 12, 16],
  );
  bindWorksheet(set, 'x', 'x0');
  assert.deepEqual(set.rows, original);
  assert.equal(transformSeries(set, 'y = 5'), 'c4');
  assert.deepEqual(
    set.rows.map((r) => r[1]),
    [5, 5, 5, 5],
  );
});
test('Aggregates, normalization, row number, scientific functions and error columns', () => {
  const set = source();
  transformSeries(set, 'y=y-mean(y)');
  assert.deepEqual(
    set.rows.map((r) => r[1]),
    [-6, -2, 2, 6],
  );
  transformSeries(set, 'y=norm(y0)');
  assert.deepEqual(
    set.rows.map((r) => r[1]),
    [0.25, 0.5, 0.75, 1],
  );
  transformSeries(set, 'y = i + sum(x0)');
  assert.deepEqual(
    set.rows.map((r) => r[1]),
    [11, 12, 13, 14],
  );
  const errors = source();
  errors.type = 'xydy';
  errors.rows = errors.rows.map((row) => [...row, 0.2]);
  transformSeries(errors, 'y=y0+d1');
  assert.equal(errors.rows[0][1], 4.2);
  assert.equal(errors.rows[0][2], 0.2);
});
test('Hidden rows remain in every column, are reversible, and are omitted from plotted rows', () => {
  const set = source();
  transformSeries(set, 'y = y*2');
  setWorksheetRowHidden(set, 1, true);
  assert.equal(set.rows.length, 3);
  assert.deepEqual(set.worksheet?.baseRows[1], [2, 8]);
  transformSeries(set, 'y = y+1');
  assert.deepEqual(set.worksheet?.columns[1].values, [9, 17, 25, 33]);
  setWorksheetRowHidden(set, 1, false);
  assert.deepEqual(set.rows[1], [2, 17]);
  setWorksheetRowHidden(set, 0, true);
  setWorksheetRowHidden(set, 3, true);
  showAllWorksheetRows(set);
  assert.equal(set.rows.length, 4);
});
test('Invalid domains and code are rejected atomically through document edits', () => {
  const scene = createDemo();
  scene.graphs[0].sets = [source()];
  useDocument.getState().load(scene, 'transform');
  const before = useDocument.getState().scene;
  for (const expression of ['y=log10(y-8)', 'y=process.exit()', 'y=missing+1', 'y=a0*x'])
    assert.throws(() =>
      useDocument.getState().edit((s) => transformSeries(s.graphs[0].sets[0], expression)),
    );
  assert.equal(useDocument.getState().scene, before);
  useDocument.getState().edit((s) => {
    transformSeries(s.graphs[0].sets[0], 'y=y/4');
    setWorksheetRowHidden(s.graphs[0].sets[0], 2, true);
  });
  const after = useDocument.getState().scene;
  useDocument.getState().undo();
  assert.equal(useDocument.getState().scene, before);
  useDocument.getState().redo();
  assert.equal(useDocument.getState().scene, after);
});
test('Point removal from a transformed series hides its original row and additions cannot corrupt the table', () => {
  const s = source();
  transformSeries(s, 'y=y*2');
  const scene = createDemo();
  scene.graphs[0].sets = [s];
  deletePoint(scene.graphs[0], 0, 1);
  assert.deepEqual(s.worksheet?.hiddenRows, [1]);
  assert.equal(s.worksheet?.baseRows.length, 4);
  assert.throws(() => insertPoint(scene.graphs[0], 0, [3, 4]), /transformações/);
  showAllWorksheetRows(s);
  assert.equal(s.rows.length, 4);
});
test('AGR, drafts and native Grace retain full transformation table and hidden rows', async () => {
  const scene = createDemo();
  scene.graphs[0].sets = [source()];
  const s = scene.graphs[0].sets[0];
  transformSeries(s, 'y=norm(y)');
  setWorksheetRowHidden(s, 1, true);
  const agr = serializeAgr(scene),
    parsed = parseAgr(agr);
  assert.deepEqual(parsed.graphs[0].sets[0].worksheet, s.worksheet);
  assert.deepEqual(parsed.graphs[0].sets[0].rows, s.rows);
  assert.deepEqual(
    readDraft(serializeDraft(scene, 'test'))?.scene.graphs[0].sets[0].worksheet,
    s.worksheet,
  );
  assert.ok(!serializeAgr(scene, true).includes('LSNGrace worksheet'));
  const { renderGraceDetailed } = await import('../server/grace');
  const exported = (await renderGraceDetailed(agr, 'agr')).output.toString('latin1');
  assert.deepEqual(parseAgr(exported).graphs[0].sets[0].worksheet, s.worksheet);
  for (let i = 0; i < 4; i++) setWorksheetRowHidden(s, i, true);
  const empty = await renderGraceDetailed(serializeAgr(scene), 'agr');
  assert.deepEqual(
    parseAgr(empty.output.toString('latin1')).graphs[0].sets[0].worksheet,
    s.worksheet,
  );
});
test('Stale worksheet metadata never overwrites manually edited visible data', () => {
  const scene = createDemo();
  scene.graphs[0].sets = [source()];
  transformSeries(scene.graphs[0].sets[0], 'y=y*2');
  const agr = serializeAgr(scene).replace('1 8\n', '1 9\n'),
    parsed = parseAgr(agr);
  assert.equal(parsed.graphs[0].sets[0].rows[0][1], 9);
  assert.equal(parsed.graphs[0].sets[0].worksheet, undefined);
});
