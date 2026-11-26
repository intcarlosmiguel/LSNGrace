import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeze, produce } from 'immer';
import { resolveColor, hexColor } from '../src/core/style/colors';
import { createBlank, createSet } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { validateScene } from '../src/core/scene/validate';
import { zoomGraph } from '../src/features/canvas/interactions';
import { zoomRows, canLiveZoom } from '../src/features/canvas/liveZoom';
import { alphaSettings, prepareAlpha, applyAlpha } from '../server/appearance';

test('Custom colors reuse RGB entries without changing indexed palette colors', () => {
  const s = createBlank(),
    original = structuredClone(s.colors);
  const custom = resolveColor(s, '#123456');
  assert.ok(custom >= 16);
  assert.equal(resolveColor(s, '#123456'), custom);
  assert.equal(resolveColor(s, '#ff0000'), 2);
  assert.equal(hexColor(s.colors.find((c) => c.id === custom)!.rgb), '#123456');
  assert.deepEqual(s.colors.slice(0, 16), original);
  assert.throws(() => resolveColor(s, '#ab'));
  assert.throws(() => resolveColor(s, 999));
});

test('Independent fill color and alpha round-trip in native-compatible AGR comments', () => {
  const s = createBlank(),
    set = createSet();
  set.rows = [
    [0, 1],
    [1, 2],
  ];
  set.line.color = 4;
  set.symbol.fill.color = resolveColor(s, '#19bc9d');
  set.symbol.fill.pattern = 1;
  set.opacity = 0.6;
  set.symbol.fill.opacity = 0.25;
  s.graphs[0].sets = [set];
  const agr = serializeAgr(s),
    round = parseAgr(agr).graphs[0].sets[0];
  assert.equal(round.line.color, 4);
  assert.equal(round.symbol.fill.color, 16);
  assert.equal(round.opacity, 0.6);
  assert.equal(round.symbol.fill.opacity, 0.25);
  const prepared = prepareAlpha(agr);
  assert.ok(prepared.paints.size >= 2);
  assert.equal(alphaSettings(agr).size, 1);
  const fill = [...prepared.paints].find(([, p]) => p.alpha === 0.15)!;
  assert.ok(fill);
  const svg = applyAlpha(
    `<g style="fill:#${fill[0]};stroke:#000000"><circle/></g>`,
    prepared.paints,
  );
  assert.match(svg, /fill:#19BC9D;fill-opacity:0.15/);
  assert.match(svg, /stroke:#000000/);
  for (const invalid of [-0.1, 1.1, NaN]) {
    set.opacity = invalid;
    assert.ok(validateScene(s).length);
    assert.throws(() => serializeAgr(s));
  }
  assert.throws(() => alphaSettings('# LSNGrace alpha G0.S0 2 1'));
});

test('Live zoom starts for coordinate changes and never replaces style or data edits', () => {
  const s = createBlank(),
    set = createSet();
  set.rows = [
    [0, 0],
    [1, 1],
  ];
  s.graphs[0].sets = [set];
  const base = freeze(s, true);
  const zoomed = produce(base, (s) => {
    zoomGraph(s.graphs[0], 0.5, 0.5, 0.8);
  });
  assert.equal(canLiveZoom(base, zoomed), true);
  const styled = produce(base, (s) => {
    s.graphs[0].sets[0].line.color = 2;
  });
  assert.equal(canLiveZoom(base, styled), false);
  const edited = produce(zoomed, (s) => {
    s.graphs[0].sets[0].rows[0][1] = 10;
  });
  assert.equal(canLiveZoom(base, edited), false);
  const log = produce(zoomed, (s) => {
    s.graphs[0].axes.xaxis.scale = 'Logarithmic';
  });
  assert.equal(canLiveZoom(base, log), false);
  assert.equal(canLiveZoom(base, base), false);
});

test('Dense gesture preview keeps endpoints, outliers and original order without changing stored data', () => {
  const rows = freeze(
    Array.from({ length: 100000 }, (_, i) => [i, 0]),
    true,
  ); // Make outliers before freezing in the actual source.
  const input = rows.map((r) => [...r]);
  input[12345][1] = 1000;
  input[54321][1] = -1000;
  freeze(input, true);
  const sample = zoomRows(input);
  assert.ok(sample.length <= 2400);
  assert.equal(sample[0], input[0]);
  assert.equal(sample.at(-1), input.at(-1));
  assert.ok(sample.includes(input[12345]) && sample.includes(input[54321]));
  assert.ok(sample.every((r, i) => !i || r[0] > sample[i - 1][0]));
  assert.equal(input.length, 100000);
  assert.equal(zoomRows(input), sample);
});
