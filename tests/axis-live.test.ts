import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlank } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { validateScene } from '../src/core/scene/validate';
import { useDocument } from '../src/state/document';
import { currentEditGroup, withEditGroup } from '../src/state/editGroup';
import { readDraft, serializeDraft } from '../src/state/draft';
test('Axis position and label layout parameters round-trip through native AGR directives', () => {
  const s = createBlank(),
    a = s.graphs[0].axes.xaxis;
  a.zero = true;
  a.offset = [0.02, -0.03];
  a.bar.enabled = false;
  a.ticks.direction = 'out';
  a.ticks.place = 'both';
  a.ticks.minorCount = 4;
  a.ticks.minorGrid = true;
  a.tickLabels.format = 'scientific';
  a.tickLabels.precision = 3;
  a.tickLabels.skip = 1;
  a.tickLabels.stagger = 2;
  a.tickLabels.angle = 45;
  a.tickLabels.prepend = 't=';
  a.tickLabels.append = ' s';
  const raw = serializeAgr(s),
    parsed = parseAgr(raw);
  assert.ok(raw.includes('xaxis type zero true'));
  assert.ok(raw.includes('xaxis offset 0.02, -0.03'));
  assert.deepEqual(parsed.graphs[0].axes.xaxis, a);
  assert.deepEqual(parsed.compatibility.diagnostics, []);
});
test('Legacy v1 drafts without optional axis additions continue to load and export', () => {
  const s = createBlank();
  const restored = readDraft(serializeDraft(s, 'Legacy.agr'));
  assert.ok(restored);
  assert.doesNotThrow(() => serializeAgr(restored.scene));
  assert.equal(restored.scene.graphs[0].axes.xaxis.zero, undefined);
});
test('Accepted values from one input session form one undo operation', () => {
  const store = useDocument.getState();
  store.load(createBlank(), 'Live.agr');
  withEditGroup('field:1', () =>
    store.edit((s) => {
      s.graphs[0].axes.xaxis.ticks.major = 0.5;
    }),
  );
  withEditGroup('field:1', () =>
    store.edit((s) => {
      s.graphs[0].axes.xaxis.ticks.major = 0.7;
    }),
  );
  assert.equal(useDocument.getState().past.length, 1);
  store.undo();
  assert.equal(useDocument.getState().scene.graphs[0].axes.xaxis.ticks.major, 0.2);
  store.redo();
  assert.equal(useDocument.getState().scene.graphs[0].axes.xaxis.ticks.major, 0.7);
  withEditGroup('field:2', () =>
    store.edit((s) => {
      s.graphs[0].axes.xaxis.ticks.major = 0.9;
    }),
  );
  assert.equal(useDocument.getState().past.length, 2);
});
test('Invalid automatic values are rejected atomically and do not enter history', () => {
  const store = useDocument.getState();
  store.load(createBlank(), 'Live.agr');
  assert.throws(() =>
    withEditGroup('invalid', () =>
      store.edit((s) => {
        s.graphs[0].axes.xaxis.ticks.major = 0;
      }),
    ),
  );
  assert.equal(currentEditGroup(), undefined);
  assert.equal(useDocument.getState().past.length, 0);
  const s = createBlank();
  s.graphs[0].axes.xaxis.tickLabels.skip = 1.5;
  assert.ok(validateScene(s).length);
});
test('Optional axis extensions never mask missing required styling fields', () => {
  const s = createBlank();
  delete (s.graphs[0].axes.xaxis.bar as Partial<{ width: number }>).width;
  assert.throws(() => serializeAgr(s));
});

test('Explicit logarithmic notations preserve independent tick font sizes and precision in AGR', () => {
  for (const format of ['power', 'scientific', 'exponential', 'decimal'] as const) {
    const scene = createBlank();
    const graph = scene.graphs[0];
    graph.world = [1, 1, 1000, 1000];
    for (const axis of [graph.axes.xaxis, graph.axes.yaxis]) {
      axis.scale = 'Logarithmic';
      axis.ticks.major = 10;
      axis.tickLabels.format = format;
      axis.tickLabels.precision = 2;
    }
    graph.axes.xaxis.tickLabels.size = 0.75;
    graph.axes.yaxis.tickLabels.size = 1.25;
    const restored = parseAgr(serializeAgr(scene)).graphs[0];
    assert.equal(restored.axes.xaxis.tickLabels.size, 0.75);
    assert.equal(restored.axes.yaxis.tickLabels.size, 1.25);
    assert.equal(restored.axes.xaxis.tickLabels.format, format);
    assert.equal(restored.axes.yaxis.tickLabels.precision, 2);
  }
});
