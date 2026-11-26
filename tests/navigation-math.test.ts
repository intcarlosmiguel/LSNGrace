import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeze, produce } from 'immer';
import { createBlank, createSet } from '../src/core/scene/defaults';
import { panGraph, zoomGraph } from '../src/features/canvas/interactions';
import { legendAnchor, setLegendAnchor, snapLegend } from '../src/features/canvas/guides';
import { canLiveZoom } from '../src/features/canvas/liveZoom';
import { graphBox, normalized } from '../src/core/geometry/coordinates';
import { latexParts, latexToGrace, readLatexMetadata } from '../src/core/text/latex';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { prepareMath, applyMath } from '../server/math';

test('Hand panning follows pointer direction, while view legends stay anchored', () => {
  const scene = createBlank(),
    g = scene.graphs[0],
    s = createSet();
  s.rows = [[5, 5]];
  s.legend = 'Signal';
  g.sets = [s];
  g.world = [0, 0, 10, 10];
  const base = freeze(scene, true),
    anchor = legendAnchor(base, g);
  const preview = produce(base, (d) => panGraph(d.graphs[0], [0.5, 0.5], [0.6, 0.4]));
  const moved = preview.graphs[0];
  assert.deepEqual(moved.world, [-1, 1, 9, 11]);
  assert.equal(normalized(5, moved.world[0], moved.world[2], moved.axes.xaxis), 0.6);
  assert.equal(normalized(5, moved.world[1], moved.world[3], moved.axes.yaxis), 0.4);
  assert.deepEqual(legendAnchor(preview, moved), anchor);
  assert.equal(preview.graphs[0].sets[0].rows, base.graphs[0].sets[0].rows);
  assert.deepEqual(base.graphs[0].world, [0, 0, 10, 10]);
  assert.equal(canLiveZoom(base, preview), true);
});

test('Legend drag preserves world/view coordinate modes and triggers a live preview', () => {
  const scene = createBlank(),
    g = scene.graphs[0];
  g.legend.coordinates = 'world';
  g.world = [1, 1, 100, 100];
  g.axes.xaxis.scale = 'Logarithmic';
  g.legend.position = [10, 20];
  const before = legendAnchor(scene, g),
    next: [number, number] = [before[0] + 35, before[1] - 20];
  setLegendAnchor(scene, g, next);
  assert.equal(g.legend.coordinates, 'world');
  const after = legendAnchor(scene, g);
  assert.ok(Math.abs(after[0] - next[0]) < 1e-9 && Math.abs(after[1] - next[1]) < 1e-9);
  const base = freeze(scene, true),
    moved = produce(base, (s) => {
      s.graphs[0].legend.position = [20, 40];
    });
  assert.equal(canLiveZoom(base, moved), true);
});

test('Smart guides snap legend edges and centers within tolerance, without coarse rounding', () => {
  const scene = createBlank(),
    b = graphBox(scene, scene.graphs[0].viewport),
    box = { x: b.left + 2, y: b.top + 1, width: 80, height: 30 };
  const snap = snapLegend(scene, 0, box, 3);
  assert.equal(snap.box.x, b.left);
  assert.equal(snap.box.y, b.top);
  assert.ok(snap.guides.some((g) => g.axis === 'x') && snap.guides.some((g) => g.axis === 'y'));
  const center = (b.left + b.right) / 2,
    mid = snapLegend(scene, 0, { x: center - 40 + 1.4, y: 220.123, width: 80, height: 30 }, 3);
  assert.ok(Math.abs(mid.box.x + 40 - center) < 1e-9);
  assert.equal(mid.box.y, 220.123);
  const off = snapLegend(scene, 0, { x: 225.123, y: 240.789, width: 48, height: 21 }, 0.01);
  assert.equal(off.box.x, 225.123);
  assert.equal(off.box.y, 240.789);
  assert.equal(off.guides.length, 0);
});

test('Zoom preview rejects legend style changes, but accepts navigation without mutating legend styling', () => {
  const scene = createBlank(),
    s = createSet();
  s.legend = 'Measured';
  s.rows = [
    [0, 1],
    [1, 2],
  ];
  scene.graphs[0].sets = [s];
  const base = freeze(scene, true),
    zoom = produce(base, (s) => zoomGraph(s.graphs[0], 0.5, 0.5, 0.8));
  assert.equal(canLiveZoom(base, zoom), true);
  assert.equal(zoom.graphs[0].legend, base.graphs[0].legend);
  const styled = produce(zoom, (s) => {
    s.graphs[0].legend.size = 2;
  });
  assert.equal(canLiveZoom(base, styled), false);
});

test('LaTeX mixed text, delimiters, partial input and escaped dollars are handled', () => {
  assert.deepEqual(latexParts('Medição $\\alpha_0^2$'), [
    { math: false, text: 'Medição ' },
    { math: true, text: '\\alpha_0^2' },
  ]);
  assert.equal(latexParts('Preço \\$10'), null);
  assert.equal(latexParts('$incompleto'), null);
  assert.equal(latexToGrace('Preço $10'), 'Preço $10');
  assert.ok(latexParts('\\(x^2\\)')?.[0].math);
  assert.ok(latexParts('\\[\\sqrt{x}\\]')?.[0].math);
  assert.ok(latexParts('$$\\frac{a}{b}$$')?.[0].math);
  assert.equal(latexToGrace('Tempo'), 'Tempo');
  assert.equal(latexToGrace('\\f{Symbol}a\\f{}'), '\\f{Symbol}a\\f{}');
  assert.match(latexToGrace('$\\alpha_0^2$'), /α\\s0\\N\\S2\\N/);
});

test('LaTeX raw strings round-trip through ASCII-safe AGR metadata, including Greek and accents', () => {
  const scene = createBlank(),
    g = scene.graphs[0],
    s = createSet();
  s.legend = '$\\alpha_0$';
  s.rows = [[0, 1]];
  g.sets = [s];
  g.title.text = 'Medição $α^2$';
  g.axes.xaxis.label.text = 'Tempo $t$';
  g.axes.yaxis.label.text = '$\\frac{1}{\\sqrt{x}}$';
  const agr = serializeAgr(scene),
    metadata = readLatexMetadata(agr),
    round = parseAgr(agr);
  assert.equal(metadata.size, 4);
  assert.ok([...metadata.values()].includes(g.title.text));
  assert.match(agr, /# LSNGrace latex g0.title "Medi\\u00e7/);
  assert.equal(round.graphs[0].title.text, g.title.text);
  assert.equal(round.graphs[0].sets[0].legend, s.legend);
  assert.equal(round.graphs[0].axes.yaxis.label.text, g.axes.yaxis.label.text);
  assert.deepEqual(round.graphs[0].sets[0].rows, s.rows);
});

test('Math composition produces self-contained paths, restores native text color and fits labels', async () => {
  const scene = createBlank();
  scene.graphs[0].title.text = 'Medição $\\frac{\\alpha_0^2}{\\sqrt{x}}$';
  const project = await prepareMath(serializeAgr(scene));
  assert.equal(project.warnings.length, 0);
  assert.equal(project.replacements.length, 1);
  const entry = project.replacements[0];
  assert.ok(entry.formula.body.includes('<path'));
  assert.ok(entry.formula.view[3] * entry.formula.factor <= 1350.001);
  const source = `<svg><g style="fill:#9400D3;fill-rule:nonzero"><text style="font-size:612.0000" transform="matrix(.04,0,0,-.04,100,200)">${entry.marker}</text></g></svg>`;
  const output = applyMath(source, project.replacements);
  assert.match(output, /data-lsn-text="g0.title"/);
  assert.match(output, /color="#9400D3"/);
  assert.ok(!output.includes(`>${entry.marker}<`));
  assert.ok(!/foreignObject|<script|href="https?:/.test(output));
});
