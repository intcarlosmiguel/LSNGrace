import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useDocument } from '../src/state/document';
import { createDemo } from '../src/core/scene/defaults';
test('Edits are immutable, undo/redo restores data and new branches clear redo', () => {
  const store = useDocument;
  store.getState().load(createDemo(), 'test.agr');
  const original = store.getState().scene;
  store.getState().edit((s) => {
    s.graphs[0].title.text = 'Changed';
  });
  assert.equal(original.graphs[0].title.text, 'Relaxation dynamics');
  store.getState().undo();
  assert.equal(store.getState().scene, original);
  store.getState().redo();
  assert.equal(store.getState().scene.graphs[0].title.text, 'Changed');
  store.getState().undo();
  store.getState().edit((s) => {
    s.graphs[0].title.text = 'Branch';
  });
  assert.equal(store.getState().future.length, 0);
});
test('Invalid inspector updates cannot erase the current figure', () => {
  const store = useDocument;
  store.getState().load(createDemo(), 'test.agr');
  const original = store.getState().scene;
  assert.throws(
    () =>
      store.getState().edit((s) => {
        s.graphs[0].world[2] = -1;
      }),
    /world inválido/,
  );
  assert.equal(store.getState().scene, original);
  assert.equal(store.getState().past.length, 0);
});
