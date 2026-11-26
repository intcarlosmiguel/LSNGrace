import type { CustomFitSettings } from '../src/core/analysis/types';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression } from '../src/core/analysis/expression';
import { fitRegression, insertRegression } from '../src/core/analysis/regression';
import { createSet, createDemo } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { serializeDraft, readDraft } from '../src/state/draft';
const close = (a: number, b: number, t = 1e-5) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const series = (f: (x: number) => number) => {
  const s = createSet(0);
  s.rows = Array.from({ length: 61 }, (_, i) => [i / 10, f(i / 10)]);
  return s;
};
test('Grace and LaTeX formulas compile to identical evaluations', () => {
  const plain = compileExpression('y = a0 * exp(-x/a1) + a2');
  const latex = compileExpression(String.raw`$y = a_0 \exp\left(-\frac{x}{a_{1}}\right)+a_2$`);
  assert.deepEqual(latex.parameters, ['a0', 'a1', 'a2']);
  for (let x = 0; x < 6; x += 0.2)
    close(latex.evaluate(x, [4, 2, 1]), plain.evaluate(x, [4, 2, 1]));
  assert.ok(latex.mathml.includes('<mfrac>'));
  assert.ok(latex.mathml.includes('<msub>'));
});
test('Arithmetic precedence, right-associative powers, implicit products and scientific notation', () => {
  const c = compileExpression('y = a0 + -x^2 + 2^3^2 + 2e-3 x');
  close(c.evaluate(3, [1]), 1 - 9 + 512 + 0.006);
  close(compileExpression('y=a0+x^-2').evaluate(2, [1]), 1.25);
  close(
    compileExpression(String.raw`y=a_0\sin^{2}(x)+\sqrt{x}+\log_{10}(x)`).evaluate(10, [2]),
    2 * Math.sin(10) ** 2 + Math.sqrt(10) + 1,
  );
});
test('Greek parameters, constants and LaTeX delimiters', () => {
  const c = compileExpression(String.raw`\(y=\alpha_0 + \beta x + a_2\cos(\pi x)\)`);
  assert.deepEqual(c.parameters, ['a2', 'alpha0', 'beta']);
  close(c.evaluate(2, [3, 1, 4]), 12);
  const d = compileExpression('y = α + β x');
  assert.deepEqual(d.parameters, ['alpha', 'beta']);
  close(d.evaluate(2, [1, 4]), 9);
});
test('Reject executable text, unknown commands, oversized or malformed formulas', () => {
  for (const f of [
    'y=process.exit()',
    'a0;alert(1)',
    'y=a0.constructor',
    'y=globalThis',
    'y=a10*x',
    'y=a0+unknown(x)',
    String.raw`y=\input{secret}`,
    String.raw`y=\frac{x}{a0`,
    'y=a0+(x',
    'y=a0+sin()',
    'y=x+2',
    'y=a0+',
    'y=a0' + '+1'.repeat(600),
  ])
    assert.throws(() => compileExpression(f), { name: 'Error' }, f);
});
for (const formula of ['y = a0*exp(-x/a1)+a2', String.raw`$y=a_0 e^{-\frac{x}{a_1}}+a_2$`])
  test(`Custom exponential fit: ${formula}`, () => {
    const source = series((x) => 4 * Math.exp(-x / 1.7) + 0.8);
    const { report, curveRows } = fitRegression(source, {
      method: 'custom',
      custom: {
        formula,
        parameters: {
          a0: { initial: 3 },
          a1: { initial: 1, min: 0.01, max: 10 },
          a2: { initial: 0 },
        },
      },
    });
    [4, 1.7, 0.8].forEach((v, i) => close(report.parameters[i].value, v));
    close(report.rSquared!, 1);
    assert.equal(report.count, 61);
    assert.equal(curveRows.length, 300);
    assert.ok(report.custom);
    assert.equal(report.objectiveScale, 'Y');
  });
test('Fixed coefficients stay fixed, bounds hold, and degrees of freedom count free parameters', () => {
  const { report } = fitRegression(
    series((x) => 2 + 3 * x),
    {
      method: 'custom',
      custom: {
        formula: 'y=a0+a1*x',
        parameters: { a0: { initial: 2, fixed: true }, a1: { initial: 1, min: 0, max: 5 } },
      },
    },
  );
  close(report.parameters[1].value, 3);
  assert.equal(report.parameters[0].value, 2);
  assert.equal(report.parameters[0].standardError, null);
  assert.equal(report.degreesOfFreedom, 60);
  const bounded = fitRegression(
    series((x) => 4 * x),
    {
      method: 'custom',
      custom: { formula: 'a0*x', parameters: { a0: { initial: 1, min: 0, max: 2 } } },
    },
  ).report;
  close(bounded.parameters[0].value, 2);
  assert.equal(bounded.parameters[0].standardError, null);
  assert.ok(bounded.warnings.some((w) => w.includes('limite')));
});
test('Custom OLS error estimates agree with linear model', () => {
  const s = series((x) => 1 + 2 * x + 0.1 * Math.sin(x));
  const a = fitRegression(s, { method: 'linear' }).report,
    b = fitRegression(s, {
      method: 'custom',
      custom: { formula: 'y=a0+a1*x', parameters: { a0: { initial: 0 }, a1: { initial: 1 } } },
    }).report;
  a.parameters.forEach((p, i) => {
    close(p.value, b.parameters[i].value);
    close(p.standardError!, b.parameters[i].standardError!);
  });
  close(a.sse, b.sse);
});
test('Invalid initials, bounds, domain, singular model and non-convergence reject without mutation', () => {
  const s = series((x) => 4 * Math.exp(-x / 1.7) + 0.8);
  const invalidSettings: CustomFitSettings[] = [
    { formula: 'a0*x', parameters: {} },
    { formula: 'a0*x', parameters: { a0: { initial: 3, min: 0, max: 2 } } },
    { formula: 'a0*x', parameters: { a0: { initial: 1, fixed: true } } },
    { formula: 'ln(a0-x)', parameters: { a0: { initial: 1 } } },
    { formula: 'a0+a1', parameters: { a0: { initial: 1 }, a1: { initial: 1 } } },
    {
      formula: 'a0*exp(-x/a1)+a2',
      parameters: { a0: { initial: 1 }, a1: { initial: 1 }, a2: { initial: 1 } },
      maxIterations: 1,
    },
  ];
  for (const custom of invalidSettings)
    assert.throws(() => fitRegression(s, { method: 'custom', custom }));
});
test('Custom formula, constraints and report survive AGR, drafts and native Grace export', async () => {
  const scene = createDemo();
  scene.graphs[0].sets = [series((x) => 2 + 3 * x)];
  const report = insertRegression(scene.graphs[0], 0, {
    method: 'custom',
    custom: {
      formula: String.raw`$y=a_0+a_1 x$`,
      parameters: { a0: { initial: 1 }, a1: { initial: 1 } },
      tolerance: 1e-8,
      maxIterations: 250,
    },
  });
  const agr = serializeAgr(scene);
  assert.deepEqual(parseAgr(agr).graphs[0].regressions?.[0], report);
  assert.deepEqual(
    readDraft(serializeDraft(scene, 'test'))?.scene.graphs[0].regressions?.[0],
    report,
  );
  const { renderGraceDetailed } = await import('../server/grace');
  const saved = await renderGraceDetailed(agr, 'agr');
  assert.deepEqual(parseAgr(saved.output.toString('latin1')).graphs[0].regressions?.[0], report);
});
