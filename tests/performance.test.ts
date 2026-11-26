import { autoscaleGraph } from '../src/core/geometry/autoscale';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeze, produce } from 'immer';
import { BudgetCache } from '../src/core/cache';
import { createBlank, createSet } from '../src/core/scene/defaults';
import { useDocument } from '../src/state/document';
import { validateScene } from '../src/core/scene/validate';
import { serializeAgr } from '../src/core/agr/serializer';
import { readDraft, serializeDraft } from '../src/state/draft';
import { zoomGraph, panGraph, hitPath } from '../src/features/canvas/interactions';
import { previewFormat, rasterPreview } from '../src/rendering/native/preview';
import { RenderGate } from '../server/renderGate';

function largeScene(count = 10000) {
  const scene = createBlank(),
    set = createSet();
  set.rows = Array.from({ length: count }, (_, i) => [i, Math.sin(i)]);
  scene.graphs[0].sets = [set];
  scene.graphs[0].world = [0, -2, count, 2];
  return scene;
}

test('Style history shares every point; direct row edits copy only the edited row', () => {
  const store = useDocument;
  store.getState().load(largeScene(), 'large.agr');
  const original = store.getState().scene,
    rows = original.graphs[0].sets[0].rows;
  for (let i = 0; i < 20; i++)
    store.getState().edit((s) => {
      s.graphs[0].title.text = `Title ${i}`;
    });
  assert.ok(store.getState().past.every((s) => s.graphs[0].sets[0].rows === rows));
  assert.equal(store.getState().scene.graphs[0].sets[0].rows, rows);
  const count = store.getState().past.length;
  store.getState().edit(() => {});
  assert.equal(store.getState().past.length, count);
  store.getState().edit((s) => {
    s.graphs[0].sets[0].rows[0][1] = 2;
  });
  const changed = store.getState().scene.graphs[0].sets[0].rows;
  assert.notEqual(changed, rows);
  assert.notEqual(changed[0], rows[0]);
  assert.equal(changed[1], rows[1]);
  assert.equal(rows[0][1], 0);
  store.getState().undo();
  assert.equal(store.getState().scene.graphs[0].sets[0].rows, rows);
});

test('Zoom and pan work inside copy-on-write edits and preserve all numeric rows', () => {
  const store = useDocument;
  store.getState().load(largeScene(), 'zoom.agr');
  const original = store.getState().scene;
  store.getState().edit((s) => zoomGraph(s.graphs[0], 0.5, 0.5, 0.8));
  store.getState().edit((s) => panGraph(s.graphs[0], [0.5, 0.5], [0.6, 0.6]));
  assert.equal(store.getState().scene.graphs[0].sets[0].rows, original.graphs[0].sets[0].rows);
  assert.notDeepEqual(store.getState().scene.graphs[0].world, original.graphs[0].world);
  assert.deepEqual(validateScene(store.getState().scene), []);
});

test('Validation and serialization never cache mutable numeric inputs or stale set types', () => {
  const scene = largeScene(2),
    set = scene.graphs[0].sets[0];
  assert.deepEqual(validateScene(scene), []);
  serializeAgr(scene);
  serializeDraft(scene, 'test');
  set.rows[0][1] = 42;
  assert.match(serializeAgr(scene), /0 42/);
  assert.equal(JSON.parse(serializeDraft(scene, 'test')).scene.graphs[0].sets[0].rows[0][1], 42);
  set.rows[0][1] = NaN;
  assert.ok(validateScene(scene).length);
  assert.throws(() => serializeAgr(scene));
  const frozen = freeze(largeScene(2), true);
  assert.deepEqual(validateScene(frozen), []);
  const changed = produce(frozen, (s) => {
    s.graphs[0].sets[0].type = 'xydy';
  });
  assert.ok(validateScene(changed).some((e) => e.includes('dados inválidos')));
});

test('Cached drafts preserve every field, quotes, names and edited numeric data', () => {
  const original = freeze(largeScene(4), true);
  const styled = produce(original, (s) => {
    s.graphs[0].title.text = 'Título "A"\nstyle=\'font-size:612\'';
  });
  for (const scene of [original, styled])
    assert.deepEqual(readDraft(serializeDraft(scene, '"nome"\n.agr')), {
      scene,
      name: '"nome"\n.agr',
    });
  const changed = produce(styled, (s) => {
    s.graphs[0].sets[0].rows[2][1] = 999;
  });
  assert.equal(readDraft(serializeDraft(changed, 'data'))!.scene.graphs[0].sets[0].rows[2][1], 999);
  assert.equal(
    readDraft(serializeDraft(styled, 'data'))!.scene.graphs[0].sets[0].rows[2][1],
    Math.sin(2),
  );
});

test('Hit geometry updates on world, inversion and row changes; isolated points are disconnected', () => {
  const scene = freeze(largeScene(3), true),
    g = scene.graphs[0];
  const path = hitPath(g, g.sets[0].rows, 100, 100, 0, 0);
  assert.equal(hitPath(g, g.sets[0].rows, 100, 100, 0, 0), path);
  const moved = produce(g, (d) => {
    d.world[2] *= 2;
  });
  assert.notEqual(hitPath(moved, moved.sets[0].rows, 100, 100, 0, 0), path);
  const inverse = produce(g, (d) => {
    d.axes.xaxis.inverted = true;
  });
  assert.notEqual(hitPath(inverse, inverse.sets[0].rows, 100, 100, 0, 0), path);
  const points = hitPath(g, g.sets[0].rows, 100, 100, 0, 0, true);
  assert.equal((points.match(/M/g) ?? []).length, 3);
  assert.ok(!points.includes('L'));
});

test('Preview switches only dense visible figures to the real Grace PNG driver', () => {
  const scene = largeScene(100000);
  assert.equal(previewFormat(scene), 'png');
  scene.graphs[0].sets[0].hidden = true;
  assert.equal(previewFormat(scene), 'svg');
  scene.graphs[0].sets[0].hidden = false;
  scene.graphs[0].hidden = true;
  assert.equal(previewFormat(scene), 'svg');
  assert.match(rasterPreview(scene, 'blob:test'), /viewBox="0 0 792 612"/);
  assert.equal(largeScene(208).graphs[0].sets[0].rows.length, 208);
  assert.equal(previewFormat(largeScene(208)), 'svg');
});

test('Render caches obey byte/count budgets, evict oldest entries and release resources', () => {
  const disposed: string[] = [];
  const cache = new BudgetCache<string, string>(10, 2, (v) => disposed.push(v));
  cache.set('a', 'A', 4);
  cache.set('b', 'B', 4);
  assert.equal(cache.get('a'), 'A');
  cache.set('c', 'C', 4);
  assert.equal(cache.get('b'), undefined);
  assert.deepEqual(disposed, ['B']);
  assert.equal(cache.set('oversize', 'X', 11), false);
  assert.equal(cache.get('a'), 'A');
  cache.clear();
  assert.equal(cache.get('a'), undefined);
  assert.equal(disposed.length, 3);
});

test('Native render gate queues bursts, cancels obsolete work and never leaks a slot', async () => {
  const gate = new RenderGate(1),
    release = await gate.acquire(),
    controller = new AbortController();
  const cancelled = gate.acquire(controller.signal);
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  controller.abort();
  await rejected;
  let entered = false;
  const pending = gate.acquire().then((done) => {
    entered = true;
    return done;
  });
  await Promise.resolve();
  assert.equal(entered, false);
  release();
  const finish = await pending;
  assert.equal(entered, true);
  finish();
  finish();
  const last = await gate.acquire();
  last();
});

test('Autoscale sees numeric changes made earlier in the same transaction', () => {
  const scene = freeze(largeScene(10), true);
  const changed = produce(scene, (s) => {
    s.graphs[0].sets[0].rows[0][1] = 500;
    autoscaleGraph(s.graphs[0]);
  });
  assert.ok(changed.graphs[0].world[3] > 500);
  assert.ok(scene.graphs[0].world[3] < 500);
  assert.deepEqual(validateScene(changed), []);
});
