import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAgr } from '../src/core/agr/parser';
import { serializeAgr } from '../src/core/agr/serializer';
import { createDemo } from '../src/core/scene/defaults';
import { validateScene } from '../src/core/scene/validate';
for (const name of ['grace-reference', 'grace-multigraph']) {
  test(`${name}: semantic and deterministic round trip of a real Grace file`, () => {
    const scene = parseAgr(
      readFileSync(new URL(`./fixtures/${name}.agr`, import.meta.url), 'utf8'),
    );
    assert.deepEqual(
      scene.compatibility.diagnostics.filter((d) => d.severity === 'error'),
      [],
    );
    assert.deepEqual(validateScene(scene), []);
    const output = serializeAgr(scene),
      reparsed = parseAgr(output);
    assert.deepEqual(reparsed.graphs, scene.graphs);
    assert.deepEqual(reparsed.colors, scene.colors);
    assert.deepEqual(reparsed.fonts, scene.fonts);
    assert.deepEqual(reparsed.page, scene.page);
    assert.deepEqual(reparsed.compatibility.preserved, scene.compatibility.preserved);
    assert.equal(serializeAgr(reparsed), output);
    assert.ok(output.includes('@version 50122'));
  });
}
test('Demo retains precision, set styles, data and model fields', () => {
  const scene = createDemo(),
    out = serializeAgr(scene),
    parsed = parseAgr(out);
  assert.deepEqual(parsed.graphs, scene.graphs);
  assert.deepEqual(parsed.page, scene.page);
  assert.deepEqual(parsed.colors, scene.colors);
});
test('Fortran exponents, CRLF, sparse IDs, component bounds and quoted strings', () => {
  const scene = parseAgr(
    '@version 50122\r\n@with g3\r\n@world xmin -2\r\n@world xmax 5\r\n@title "A \\"quote\\" and \\S2\\N"\r\n@target G3.S7\r\n@type xydy\r\n1D-3 2d0 3D-2\r\n&\r\n',
  );
  assert.equal(scene.graphs[0].id, 3);
  assert.equal(scene.graphs[0].world[0], -2);
  assert.deepEqual(scene.graphs[0].sets[0].rows, [[0.001, 2, 0.03]]);
  assert.equal(scene.graphs[0].title.text, 'A "quote" and \\S2\\N');
  assert.deepEqual(parseAgr(serializeAgr(scene)).graphs, scene.graphs);
});
test('Unknown scoped directives and annotation blocks survive serialization', () => {
  const scene = parseAgr(
    '@with string\n@string on\n@string def "note"\n@with g2\n@s4 avalue on\n@xaxis ticklabel offset 0.01, 0.02\n',
  );
  const round = parseAgr(serializeAgr(scene));
  assert.deepEqual(round.compatibility.preserved, scene.compatibility.preserved);
  assert.equal(scene.compatibility.preserved[3].graphId, 2);
  assert.equal(scene.compatibility.diagnostics.filter((d) => d.severity === 'error').length, 0);
});
test('Bad data reports exact line and cannot be silently saved', () => {
  const scene = parseAgr('@target G0.S0\n@type xydy\n1 2\n&\n');
  assert.equal(scene.compatibility.diagnostics[0].line, 3);
  assert.equal(scene.compatibility.diagnostics[0].severity, 'error');
  assert.throws(() => serializeAgr(scene), /evitar perda de dados/);
});
test('Missing terminators, nonfinite numbers and orphan data produce errors', () => {
  for (const source of [
    '1 2',
    '@target G0.S0\n@type xy\n1 Infinity\n&',
    '@target G0.S0\n@type xy\n1 2',
  ]) {
    assert.ok(parseAgr(source).compatibility.diagnostics.some((d) => d.severity === 'error'));
  }
});
test('Parameter export omits all numeric blocks', () => {
  const output = serializeAgr(createDemo(), true);
  assert.ok(!output.includes('@target'));
  assert.ok(parseAgr(output).graphs[0].sets.every((s) => !s.rows.length));
});
test('Editing recognized properties overrides originals without accumulation', () => {
  const scene = parseAgr(
    readFileSync(new URL('./fixtures/grace-reference.agr', import.meta.url), 'utf8'),
  );
  scene.graphs[0].title.text = 'New title';
  scene.graphs[0].sets[0].line.color = 16;
  const output = serializeAgr(scene);
  const round = parseAgr(output);
  assert.equal(round.graphs[0].title.text, 'New title');
  assert.equal(round.graphs[0].sets[0].line.color, 16);
  assert.equal((output.match(/@    title "/g) || []).length, 1);
});
test('Large numeric Sets export without exhausting the JS argument limit', () => {
  const scene = createDemo();
  scene.graphs[0].sets = [scene.graphs[0].sets[0]];
  scene.graphs[0].sets[0].rows = Array.from({ length: 150_001 }, (_, i) => [i, i / 10]);
  const output = serializeAgr(scene);
  assert.ok(output.includes('150000 15000\n&'));
});
