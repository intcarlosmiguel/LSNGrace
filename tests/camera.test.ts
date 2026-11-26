import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo } from '../src/core/scene/defaults';
import { graphBox } from '../src/core/geometry/coordinates';
import { canvasCamera, cameraPoint, framedSvg } from '../src/features/canvas/camera';
import { serializeAgr } from '../src/core/agr/serializer';
test('Focus camera contains the plot and labels without modifying publication parameters', () => {
  const scene = createDemo(),
    before = serializeAgr(scene),
    view = canvasCamera(scene),
    plot = graphBox(scene, scene.graphs[0].viewport);
  assert.ok(view.width < scene.page.size[0] && view.height < scene.page.size[1]);
  assert.ok(
    view.x < plot.left &&
      view.y < plot.top &&
      view.x + view.width > plot.right &&
      view.y + view.height > plot.bottom,
  );
  assert.equal(serializeAgr(scene), before);
  assert.deepEqual(canvasCamera(scene, true), { x: 0, y: 0, width: 792, height: 612 });
});
test('Pointer coordinates in cropped preview still map to original Grace page coordinates', () => {
  const camera = { x: 20, y: 30, width: 700, height: 500 },
    rect = { left: 200, top: 50, width: 1400, height: 1000 };
  assert.deepEqual(cameraPoint(camera, rect, 200, 50), [20, 30]);
  assert.deepEqual(cameraPoint(camera, rect, 900, 550), [370, 280]);
  assert.deepEqual(cameraPoint(camera, rect, 1600, 1050), [720, 530]);
});
test('Existing annotation blocks retain the full page so content cannot be cut off', () => {
  const scene = createDemo();
  scene.compatibility.preserved.push({ scope: 'page', raw: '@with string' });
  assert.deepEqual(canvasCamera(scene), { x: 0, y: 0, width: 792, height: 612 });
});
test('Presentation changes only the SVG root viewBox; exported native source remains untouched', () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 792 612"><path d="M92 92L700 520"/><text>Native Grace</text></svg>';
  const view = framedSvg(source, { x: 20, y: 30, width: 700, height: 500 });
  assert.ok(view.includes('viewBox="20 30 700 500"'));
  assert.equal(view.slice(view.indexOf('><path')), source.slice(source.indexOf('><path')));
  assert.ok(source.includes('viewBox="0 0 792 612"'));
});
test('Math titles reserve extra camera height for fractions and roots', () => {
  const scene = createDemo();
  scene.graphs[0].subtitle.text = '';
  scene.graphs[0].title.text = 'Experiment';
  const plain = canvasCamera(scene);
  scene.graphs[0].title.text = 'Experiment $\\frac{\\alpha_0^2}{\\sqrt{x}}$';
  const math = canvasCamera(scene);
  assert.ok(math.y < plain.y);
  assert.equal(math.x, plain.x);
  assert.equal(math.width, plain.width);
  assert.equal(math.y + math.height, plain.y + plain.height);
});
