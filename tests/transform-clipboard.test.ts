import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSet, createDemo } from '../src/core/scene/defaults';
import {
  transformSeries,
  removeWorksheetColumn,
  setWorksheetRowHidden,
} from '../src/core/analysis/worksheet';
import {
  copyTransformRecipe,
  pasteTransformRecipe,
  readTransformRecipe,
  serializeTransformRecipe,
} from '../src/core/analysis/transformClipboard';
import { useDocument } from '../src/state/document';
const set = (y: number) => {
  const s = createSet(0);
  s.rows = [
    [1, y],
    [2, y * 2],
    [3, y * 3],
  ];
  return s;
};
test('Copied transformation recomputes on target data and leaves source unchanged', () => {
  const source = set(10),
    target = set(2);
  transformSeries(source, 'y=y-5');
  setWorksheetRowHidden(source, 0, true);
  const before = structuredClone(source);
  const recipe = copyTransformRecipe(source, 'c1');
  assert.deepEqual(pasteTransformRecipe(target, recipe), ['c1']);
  assert.deepEqual(target.rows, [
    [1, -3],
    [2, -1],
    [3, 1],
  ]);
  assert.deepEqual(source, before);
  assert.deepEqual(target.worksheet?.hiddenRows, []);
  assert.equal(serializeTransformRecipe(recipe), 'y=y-5');
});
test('Copy includes column dependencies and remaps their IDs when target already has columns', () => {
  const source = set(10),
    target = set(2);
  transformSeries(source, 'y=y-5');
  transformSeries(source, 'y=c1*2');
  transformSeries(target, 'y=y+1');
  const recipe = copyTransformRecipe(source, 'c2');
  assert.equal(recipe.steps.length, 2);
  assert.deepEqual(pasteTransformRecipe(target, recipe), ['c2', 'c3']);
  assert.deepEqual(
    target.rows.map((r) => r[1]),
    [-4, 0, 4],
  );
  assert.equal(target.worksheet?.columns[2].expression, 'y=c2*2');
  assert.deepEqual(readTransformRecipe(serializeTransformRecipe(recipe)), recipe);
});
test('Bare expressions retain the chosen X target', () => {
  const source = set(10),
    target = set(2);
  transformSeries(source, 'x * 1e-3', 'x');
  const recipe = copyTransformRecipe(source);
  assert.equal(recipe.steps[0].target, 'x');
  assert.equal(serializeTransformRecipe(recipe), 'x = x * 1e-3');
  pasteTransformRecipe(target, recipe);
  assert.deepEqual(
    target.rows.map((r) => r[0]),
    [0.001, 0.002, 0.003],
  );
});
test('Missing source dependency, invalid clipboard, and failed multi-step paste cannot corrupt target', () => {
  const source = set(10),
    target = set(2);
  transformSeries(source, 'y=y-5');
  transformSeries(source, 'y=c1*2');
  removeWorksheetColumn(source, 'c1');
  assert.throws(() => copyTransformRecipe(source, 'c2'), /excluída/);
  assert.throws(() => readTransformRecipe('{"steps":[]}'), /inválida/);
  const before = structuredClone(target);
  assert.throws(
    () =>
      pasteTransformRecipe(target, {
        kind: 'lsngrace-transformations',
        version: 1,
        steps: [
          { id: 'c1', expression: 'y=y-100', target: 'y' },
          { id: 'c2', expression: 'y=log10(y)', target: 'y' },
        ],
      }),
    /não finito/,
  );
  assert.deepEqual(target, before);
  assert.throws(() => pasteTransformRecipe(target, readTransformRecipe('y=process.exit()')));
  assert.deepEqual(target, before);
});
test('A pasted recipe is one undoable edit', () => {
  const source = set(10);
  transformSeries(source, 'y=y-5');
  transformSeries(source, 'y=c1*2');
  const recipe = copyTransformRecipe(source);
  const scene = createDemo();
  scene.graphs[0].sets = [set(2)];
  useDocument.getState().load(scene, 'paste');
  const before = useDocument.getState().scene;
  useDocument.getState().edit((s) => pasteTransformRecipe(s.graphs[0].sets[0], recipe));
  const after = useDocument.getState().scene;
  assert.equal(after.graphs[0].sets[0].worksheet?.columns.length, 2);
  useDocument.getState().undo();
  assert.equal(useDocument.getState().scene, before);
  useDocument.getState().redo();
  assert.equal(useDocument.getState().scene, after);
});
