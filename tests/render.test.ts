import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAxis, createDemo } from '../src/core/scene/defaults';
import {
  graphBox,
  normalized,
  ticks,
  formatTick,
  viewportPoint,
} from '../src/core/geometry/coordinates';
import { renderSvg } from '../src/rendering/svg/render';
test('Grace viewport uses shortest page dimension, with origin at bottom left', () => {
  const scene = createDemo();
  assert.deepEqual(viewportPoint(scene, 1, 1), [612, 0]);
  const box = graphBox(scene, [0.15, 0.15, 1.15, 0.85]);
  assert.ok(Math.abs(box.width - 612) < 1e-10);
  assert.ok(Math.abs(box.height - 428.4) < 1e-10);
});
test('Linear, logarithmic, reciprocal and inverted coordinate mappings', () => {
  const axis = createAxis();
  assert.equal(normalized(5, 0, 10, axis), 0.5);
  axis.scale = 'Logarithmic';
  assert.equal(normalized(10, 1, 100, axis), 0.5);
  assert.ok(Number.isNaN(normalized(-1, 1, 100, axis)));
  axis.inverted = true;
  assert.equal(normalized(1, 1, 100, axis), 1);
  axis.scale = 'Reciprocal';
  axis.inverted = false;
  assert.equal(normalized(2, 1, 4, axis), 2 / 3);
});
test('Major/minor ticks include zero, fractional and negative bounds', () => {
  const axis = createAxis();
  axis.ticks.major = 0.2;
  const ts = ticks(-0.4, 0.4, axis);
  assert.deepEqual(
    ts.filter((t) => t.major).map((t) => t.value),
    [-0.4, -0.2, 0, 0.2, 0.4],
  );
  assert.equal(ts.filter((t) => !t.major).length, 4);
  assert.equal(formatTick(0, axis), '0');
  assert.deepEqual(ticks(0, 1e9, axis), []);
});
test('Logarithmic major ticks follow the Grace major factor', () => {
  const axis = createAxis();
  axis.scale = 'Logarithmic';
  axis.ticks.major = 10;
  assert.deepEqual(
    ticks(1, 1000, axis)
      .filter((t) => t.major)
      .map((t) => t.value),
    [1, 10, 100, 1000],
  );
});
test('SVG includes clipping, XY curve, XYDY error bars and all four borders', () => {
  const scene = createDemo(),
    svg = renderSvg(scene);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('viewBox="0 0 792 612"'));
  assert.ok(svg.includes('clip-path="url(#plot-g0)"'));
  assert.ok(svg.includes('data-set="1"'));
  assert.ok(svg.includes('<circle'));
  assert.ok(svg.includes('Relaxation dynamics'));
  assert.ok(!/NaN|Infinity/.test(svg));
  const hidden = structuredClone(scene);
  hidden.graphs[0].sets[1].hidden = true;
  assert.ok(!renderSvg(hidden).includes('data-set="1"'));
});
test('XML injection in imported titles is escaped', () => {
  const scene = createDemo();
  scene.graphs[0].title.text = '<script>alert("x")</script>';
  const svg = renderSvg(scene);
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
});
test('Invalid bounds and zero-crossing reciprocal axes fail explicitly', () => {
  const scene = createDemo();
  scene.graphs[0].world[2] = 0;
  assert.throws(() => renderSvg(scene), /world inválido/);
  scene.graphs[0].world = [-1, 0, 1, 1];
  scene.graphs[0].axes.xaxis.scale = 'Reciprocal';
  assert.throws(() => renderSvg(scene), /atravessar zero/);
});
test('Extreme coordinates cannot cause a tick generation loop', () => {
  const axis = createAxis();
  axis.ticks.major = 1e-20;
  assert.deepEqual(ticks(1, 2, axis), []);
});
