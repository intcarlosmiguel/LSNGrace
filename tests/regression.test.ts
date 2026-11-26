import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, createSet } from '../src/core/scene/defaults';
import { fitRegression, insertRegression } from '../src/core/analysis/regression';
import type { RegressionMethod } from '../src/core/analysis/types';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { useDocument } from '../src/state/document';
import { readDraft, serializeDraft } from '../src/state/draft';
const close = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
const series = (f: (x: number) => number, start = 1, step = 0.2, count = 41) => {
  const set = createSet(0);
  set.rows = Array.from({ length: count }, (_, i) => {
    const x = start + i * step;
    return [x, f(x)];
  });
  return set;
};
for (const [method, f, expected] of [
  ['linear', (x: number) => 3 + 2 * x, [3, 2]],
  ['polynomial', (x: number) => 3 + 2 * x - 0.4 * x * x, [3, 2, -0.4]],
  ['power', (x: number) => 2 * x ** 1.7, [2, 1.7]],
  ['exponential', (x: number) => 2 * Math.exp(0.3 * x), [2, 0.3]],
  ['logarithmic', (x: number) => 3 + 2 * Math.log(x), [3, 2]],
  ['inverse', (x: number) => 1 / (3 + 2 * x), [3, 2]],
] as const)
  test(`Grace regression: ${method}`, () => {
    const { report, curveRows, residualRows } = fitRegression(series(f), {
      method: method as RegressionMethod,
      degree: 2,
    });
    expected.forEach((v, i) => close(report.parameters[i].value, v));
    close(report.rSquared!, 1);
    assert.equal(curveRows.length, 300);
    assert.equal(residualRows.length, 41);
    for (const [x, y] of curveRows) close(y, f(x));
  });
for (const method of ['gaussian', 'lorentzian'] as const)
  test(`LM ${method} recovers baseline, amplitude, center and width`, () => {
    const f = (x: number) =>
      2 +
      5 *
        (method === 'gaussian'
          ? Math.exp(-0.5 * ((x - 1.2) / 0.8) ** 2)
          : 1 / (1 + ((x - 1.2) / 0.8) ** 2));
    const { report } = fitRegression(series(f, -3, 0.1, 81), { method });
    [2, 5, 1.2, 0.8].forEach((v, i) => close(report.parameters[i].value, v, 1e-5));
    close(report.rSquared!, 1);
  });
test('QR preserves precision for large X offsets', () => {
  const { report, curveRows } = fitRegression(
    series((x) => 4 + 0.3 * (x - 1e9) + 0.2 * (x - 1e9) ** 2, 1e9, 0.1),
    { method: 'polynomial', degree: 2 },
  );
  close(report.rSquared!, 1);
  for (const [x, y] of curveRows) close(y, 4 + 0.3 * (x - 1e9) + 0.2 * (x - 1e9) ** 2, 1e-6);
});
test('Noisy linear fit agrees with known OLS estimates and standard errors', () => {
  const set = createSet(0);
  set.rows = [
    [0, 1],
    [1, 2],
    [2, 2],
    [3, 4],
    [4, 4],
  ];
  const { report } = fitRegression(set, { method: 'linear' });
  close(report.parameters[0].value, 1);
  close(report.parameters[1].value, 0.8);
  close(report.sse, 0.8);
  close(report.rSquared!, 6.4 / 7.2);
  close(report.parameters[1].standardError!, Math.sqrt(0.8 / 3 / 10));
});
test('Range restricts fit and residuals; curve uses independent sampling bounds', () => {
  const set = series((x) => 1 + 2 * x, 0, 1, 10);
  set.rows[9][1] = 100;
  const result = fitRegression(set, {
    method: 'linear',
    fitMin: 1,
    fitMax: 5,
    curveMin: -2,
    curveMax: 8,
    samples: 11,
  });
  assert.equal(result.report.count, 5);
  assert.equal(result.residualRows.length, 5);
  close(result.curveRows[0][0], -2);
  close(result.curveRows[0][1], -3);
  const fitted = fitRegression(set, { method: 'linear', fitMin: 1, fitMax: 5, sampling: 'source' });
  assert.deepEqual(
    fitted.curveRows.map((r) => r[0]),
    [1, 2, 3, 4, 5],
  );
});
test('Reject singular, underdetermined, invalid-domain and pole-crossing fits', () => {
  const constantX = createSet(0);
  constantX.rows = [
    [1, 2],
    [1, 3],
    [1, 4],
  ];
  assert.throws(() => fitRegression(constantX, { method: 'linear' }), /distintos/);
  assert.throws(
    () =>
      fitRegression(
        series((x) => x, 0, 1, 2),
        { method: 'linear' },
      ),
    /pelo menos/,
  );
  assert.throws(
    () =>
      fitRegression(
        series((x) => -x),
        { method: 'power' },
      ),
    /Domínio/,
  );
  assert.throws(
    () =>
      fitRegression(
        series((x) => x, -2),
        { method: 'logarithmic' },
      ),
    /Domínio/,
  );
  assert.throws(
    () =>
      fitRegression(
        series((x) => 1 / (x + 1)),
        { method: 'inverse', curveMin: -2, curveMax: 5 },
      ),
    /polo/,
  );
  assert.throws(
    () =>
      fitRegression(
        series((x) => x),
        { method: 'linear', samples: 10001 },
      ),
    /10.000/,
  );
  const duplicate = createSet(0);
  duplicate.rows = Array.from({ length: 10 }, (_, i) => [i % 2, i]);
  assert.throws(() => fitRegression(duplicate, { method: 'polynomial', degree: 3 }), /singular/);
});
test('Constant Y has undefined R² rather than a fabricated score', () => {
  assert.equal(
    fitRegression(
      series(() => 4),
      { method: 'linear' },
    ).report.rSquared,
    null,
  );
});
test('Curve/report/residual creation is atomic and AGR + local drafts retain reports', () => {
  const scene = createDemo(),
    g = scene.graphs[0];
  g.sets = [series((x) => 2 + x)];
  useDocument.getState().load(scene, 'regression.agr');
  useDocument.getState().edit((s) => {
    insertRegression(s.graphs[0], 0, { method: 'linear', residuals: true });
  });
  const result = useDocument.getState().scene;
  assert.equal(result.graphs[0].sets.length, 3);
  assert.equal(result.graphs[0].regressions?.length, 1);
  const agr = serializeAgr(result),
    restored = parseAgr(agr);
  assert.deepEqual(restored.graphs[0].regressions, result.graphs[0].regressions);
  assert.equal(restored.compatibility.diagnostics.filter((d) => d.severity === 'error').length, 0);
  assert.deepEqual(
    readDraft(serializeDraft(result, 'test'))?.scene.graphs[0].regressions,
    result.graphs[0].regressions,
  );
  assert.ok(!serializeAgr(result, true).includes('LSNGrace regression'));
  useDocument.getState().undo();
  assert.equal(useDocument.getState().scene.graphs[0].sets.length, 1);
  assert.equal(useDocument.getState().scene.graphs[0].regressions, undefined);
  useDocument.getState().redo();
  assert.equal(useDocument.getState().scene, result);
});
test('Malformed metadata does not break imported data', () => {
  const scene = createDemo();
  const agr = serializeAgr(scene) + '\n# LSNGrace regression G0 {"kind":"regression"}\n';
  const result = parseAgr(agr);
  assert.equal(result.graphs[0].sets.length, scene.graphs[0].sets.length);
  assert.ok(
    result.compatibility.diagnostics.some((d) => d.message.includes('regressão inválidos')),
  );
});
test('Real Grace renders a fitted project and native AGR export retains its report', async () => {
  const { renderGraceDetailed } = await import('../server/grace');
  const scene = createDemo();
  scene.graphs[0].sets = [series((x) => 2 + 3 * x)];
  insertRegression(scene.graphs[0], 0, { method: 'linear' });
  const agr = serializeAgr(scene);
  const svg = await renderGraceDetailed(agr, 'svg');
  assert.ok(svg.output.toString('utf8').includes('data-engine="grace"'));
  const saved = await renderGraceDetailed(agr, 'agr');
  const restored = parseAgr(saved.output.toString('latin1'));
  assert.deepEqual(restored.graphs[0].regressions, scene.graphs[0].regressions);
  assert.equal(restored.graphs[0].sets[1].rows.length, 300);
});
