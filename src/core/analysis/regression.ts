import { createSet } from '../scene/defaults';
import type { DataSet, Graph } from '../scene/types';
import type { RegressionMethod, RegressionOptions, RegressionReport } from './types';
export const regressionMethods: Record<RegressionMethod, string> = {
  linear: 'Linear',
  polynomial: 'Polinomial',
  power: 'Potência',
  exponential: 'Exponencial',
  logarithmic: 'Logarítmica',
  inverse: 'Inversa',
  gaussian: 'Gaussiana',
  lorentzian: 'Lorentziana',
  custom: 'Personalizada',
};
import { leastSquares } from './leastSquares';
import { fitCustom, customFitDefinition } from './custom';
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const polynomial = (p: number[], x: number) => p.reduceRight((s, c) => s * x + c, 0);
function originalCoefficients(p: number[], center: number, scale: number) {
  let result = [0];
  for (let j = p.length - 1; j >= 0; j--) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((v, i) => {
      next[i] -= (v * center) / scale;
      next[i + 1] += v / scale;
    });
    next[0] += p[j];
    result = next;
  }
  return result.slice(0, p.length);
}
const finite = (x: number) => Number.isFinite(x);
export function fitRegression(source: DataSet, options: RegressionOptions) {
  const method = options.method;
  if (!Object.hasOwn(regressionMethods, method)) throw Error('Método de regressão inválido.');
  if (
    (options.fitMin !== undefined && !finite(options.fitMin)) ||
    (options.fitMax !== undefined && !finite(options.fitMax))
  )
    throw Error('Intervalo de ajuste inválido.');
  if ((options.fitMin ?? -Infinity) > (options.fitMax ?? Infinity))
    throw Error('O mínimo do ajuste deve ser menor que o máximo.');
  if (source.rows.some((row) => !finite(row[0]) || !finite(row[1])))
    throw Error('A série contém valores não finitos.');
  const rows = source.rows.filter(
    (row) => row[0] >= (options.fitMin ?? -Infinity) && row[0] <= (options.fitMax ?? Infinity),
  );
  if (rows.some((r) => !finite(r[0]) || !finite(r[1])))
    throw Error('A série contém valores não finitos.');
  const degree = method === 'polynomial' ? (options.degree ?? 2) : 1;
  if (!Number.isInteger(degree) || degree < 1 || degree > 10)
    throw Error('Use grau polinomial entre 1 e 10.');
  const nonlinear = method === 'gaussian' || method === 'lorentzian' || method === 'custom';
  const customDefinition = method === 'custom' ? customFitDefinition(options.custom) : undefined;
  const parameterCount = customDefinition
    ? customDefinition.free.length
    : nonlinear
      ? 4
      : method === 'polynomial'
        ? degree + 1
        : 2;
  if (rows.length <= parameterCount)
    throw Error(
      `São necessários pelo menos ${parameterCount + 1} pontos para estimar o ajuste e sua incerteza.`,
    );
  let min = Infinity,
    max = -Infinity;
  for (const [x] of rows) {
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  if (!(max > min)) throw Error('O ajuste requer pelo menos dois valores distintos de X.');
  if (
    rows.some(
      ([x, y]) =>
        ((method === 'power' || method === 'logarithmic') && x <= 0) ||
        ((method === 'power' || method === 'exponential') && y <= 0) ||
        (method === 'inverse' && y === 0),
    )
  )
    throw Error(
      'Domínio inválido: potência exige X,Y > 0; exponencial Y > 0; logarítmica X > 0; inversa Y ≠ 0.',
    );
  const ty = (y: number) =>
    method === 'power' || method === 'exponential' ? Math.log(y) : method === 'inverse' ? 1 / y : y;
  const tx = (x: number) => (method === 'power' || method === 'logarithmic' ? Math.log(x) : x);
  let evaluate: (x: number) => number,
    values: number[],
    covariance: number[][],
    equation: string,
    iterations = 0;
  const warnings: string[] = [];
  let customResult: ReturnType<typeof fitCustom> | undefined;
  if (method === 'custom') {
    customResult = fitCustom(rows, options.custom!);
    values = customResult.values;
    evaluate = customResult.evaluate;
    equation = customResult.equation;
    iterations = customResult.iterations;
    covariance = [];
    warnings.push(...customResult.warnings);
  } else if (nonlinear) {
    // Optimize normalized X/Y and log(width), keeping the physical width positive.
    const cx = min + (max - min) / 2,
      sx = (max - min) / 2;
    let ymin = Infinity,
      ymax = -Infinity,
      peakX = min;
    for (const [x, y] of rows) {
      ymin = Math.min(ymin, y);
      if (y > ymax) {
        ymax = y;
        peakX = x;
      }
    }
    const sy = ymax - ymin || 1;
    const data = rows.map(([x, y]) => [(x - cx) / sx, (y - ymin) / sy]);
    let p = [0, 1, (peakX - cx) / sx, Math.log(0.3)];
    if (options.initial) {
      if (options.initial.length !== 4 || !options.initial.every(finite) || options.initial[3] <= 0)
        throw Error('Valores iniciais: base, amplitude, centro e largura positiva.');
      const [b, a, c, w] = options.initial;
      p = [(b - ymin) / sy, a / sy, (c - cx) / sx, Math.log(w / sx)];
    }
    const model = (x: number, a: number[]) => {
      const z = (x - a[2]) / Math.exp(a[3]);
      return a[0] + a[1] * (method === 'gaussian' ? Math.exp(-0.5 * z * z) : 1 / (1 + z * z));
    };
    const jacobian = (a: number[]) =>
      data.map(([x]) =>
        a.map((_, j) => {
          const h = 1e-5 * (1 + Math.abs(a[j])),
            plus = [...a],
            minus = [...a];
          plus[j] += h;
          minus[j] -= h;
          return (model(x, plus) - model(x, minus)) / (2 * h);
        }),
      );
    const objective = (a: number[]) => data.reduce((s, [x, y]) => s + (y - model(x, a)) ** 2, 0);
    let cost = objective(p),
      lambda = 1e-3,
      converged = false;
    for (iterations = 0; iterations < 250; iterations++) {
      const j = jacobian(p),
        residual = data.map(([x, y]) => y - model(x, p));
      const gradient = p.map((_, k) => j.reduce((sum, row, i) => sum + row[k] * residual[i], 0));
      if (Math.max(...gradient.map(Math.abs)) < 1e-9) {
        converged = true;
        break;
      }
      const diagonal = p.map((_, k) =>
        Math.sqrt(
          lambda *
            Math.max(
              j.reduce((s, row) => s + row[k] ** 2, 0),
              1e-8,
            ),
        ),
      );
      const augmented = [...j, ...p.map((_, i) => p.map((_, k) => (i === k ? diagonal[i] : 0)))];
      const step = leastSquares(augmented, [...residual, ...p.map(() => 0)]).coefficients;
      const candidate = p.map((v, i) => v + step[i]);
      const next = objective(candidate);
      if (finite(next) && next < cost) {
        const improvement = cost - next;
        p = candidate;
        cost = next;
        lambda = Math.max(lambda / 3, 1e-12);
        if (
          improvement < 1e-12 * (1 + cost) &&
          Math.sqrt(dot(step, step)) < 1e-6 * (1 + Math.sqrt(dot(p, p)))
        ) {
          converged = true;
          break;
        }
      } else {
        lambda *= 10;
        if (lambda > 1e16) break;
      }
    }
    if (!converged)
      throw Error('O ajuste não convergiu. Ajuste o intervalo ou os valores iniciais.');
    values = [ymin + sy * p[0], sy * p[1], cx + sx * p[2], sx * Math.exp(p[3])];
    evaluate = (x) => ymin + sy * model((x - cx) / sx, p);
    const factors = [sy, sy, sx, values[3]];
    covariance = leastSquares(
      jacobian(p),
      data.map(() => 0),
    ).covariance.map((row, i) => row.map((v, j) => (v * factors[i] * factors[j]) / sy ** 2));
    equation =
      method === 'gaussian'
        ? 'y = base + A exp(−(x−μ)² / (2σ²))'
        : 'y = base + A / (1 + ((x−x₀)/γ)²)';
  } else {
    const xs = rows.map(([x]) => tx(x));
    let lo = Infinity,
      hi = -Infinity;
    for (const x of xs) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    const center = lo + (hi - lo) / 2,
      scale = (hi - lo) / 2;
    if (!(scale > 0)) throw Error('X transformado não possui variação suficiente.');
    const matrix = xs.map((x) =>
      Array.from({ length: parameterCount }, (_, i) => ((x - center) / scale) ** i),
    );
    const fit = leastSquares(
      matrix,
      rows.map(([, y]) => ty(y)),
    );
    const p = fit.coefficients;
    const converted = originalCoefficients(p, center, scale);
    const transform = p.map((_, j) =>
      originalCoefficients(
        p.map((_, i) => +(i === j)),
        center,
        scale,
      ),
    );
    covariance = p.map((_, i) =>
      p.map((_, j) =>
        fit.covariance.reduce(
          (sum, row, k) =>
            sum + row.reduce((s, v, l) => s + transform[k][i] * v * transform[l][j], 0),
          0,
        ),
      ),
    );
    values = converted;
    if (method === 'power' || method === 'exponential') {
      values = [Math.exp(converted[0]), converted[1]];
      covariance = covariance.map((row, i) =>
        row.map((v, j) => v * (i === 0 ? values[0] : 1) * (j === 0 ? values[0] : 1)),
      );
    }
    evaluate = (x) => {
      if ((method === 'power' || method === 'logarithmic') && x <= 0) return NaN;
      const y = polynomial(p, (tx(x) - center) / scale);
      return method === 'power' || method === 'exponential'
        ? Math.exp(y)
        : method === 'inverse'
          ? 1 / y
          : y;
    };
    equation =
      method === 'power'
        ? 'y = A x^B'
        : method === 'exponential'
          ? 'y = A exp(B x)'
          : method === 'logarithmic'
            ? 'y = A + B ln(x)'
            : method === 'inverse'
              ? 'y = 1 / (A + B x)'
              : 'y = ' +
                converted
                  .map((_, i) => (i === 0 ? 'a0' : `a${i} x${i === 1 ? '' : `^${i}`}`))
                  .join(' + ');
    if (method === 'power' || method === 'exponential' || method === 'inverse')
      warnings.push(
        'O ajuste minimiza resíduos na escala transformada; R² e RMSE abaixo usam Y original.',
      );
  }
  const residualRows = rows.map(([x, y]) => [x, y - evaluate(x)]);
  const sse = residualRows.reduce((s, [, r]) => s + r * r, 0),
    df = rows.length - parameterCount;
  const objectiveSse = rows.reduce((s, [x, y]) => s + (ty(y) - ty(evaluate(x))) ** 2, 0);
  const mean = rows.reduce((s, [, y]) => s + y, 0) / rows.length,
    total = rows.reduce((s, [, y]) => s + (y - mean) ** 2, 0);
  const rSquared = total === 0 ? null : 1 - sse / total;
  const labels = customResult
    ? customResult.names
    : nonlinear
      ? ['base', 'A', method === 'gaussian' ? 'μ' : 'x₀', method === 'gaussian' ? 'σ' : 'γ']
      : method === 'polynomial' || method === 'linear'
        ? values.map((_, i) => `a${i}`)
        : ['A', 'B'];
  const variance = objectiveSse / df;
  const parameters = values.map((value, i) => ({
    name: labels[i],
    value,
    standardError: customResult
      ? customResult.standardErrors[i]
      : Math.sqrt(Math.max(0, covariance[i][i] * variance)),
  }));
  const curveMin = options.curveMin ?? min,
    curveMax = options.curveMax ?? max,
    samples = options.samples ?? 300;
  if (!finite(curveMin) || !finite(curveMax) || curveMin >= curveMax)
    throw Error('Intervalo da curva inválido.');
  if (!Number.isInteger(samples) || samples < 2 || samples > 10000)
    throw Error('Use de 2 a 10.000 pontos na curva.');
  if (method === 'inverse') {
    const pole = -values[0] / values[1];
    const a = options.sampling === 'source' ? min : curveMin,
      b = options.sampling === 'source' ? max : curveMax;
    if (pole >= a && pole <= b)
      throw Error(
        'A curva inversa possui um polo no intervalo. Escolha um intervalo sem singularidade.',
      );
  }
  const curveRows = (
    options.sampling === 'source'
      ? rows.map(([x]) => x).sort((a, b) => a - b)
      : Array.from(
          { length: samples },
          (_, i) => curveMin + ((curveMax - curveMin) * i) / (samples - 1),
        )
  ).map((x) => [x, evaluate(x)]);
  if (
    ![
      sse,
      objectiveSse,
      ...values,
      ...parameters.flatMap((p) => (p.standardError === null ? [] : [p.standardError])),
    ].every(finite) ||
    curveRows.some((row) => !row.every(finite))
  )
    throw Error('O ajuste produziu valores não finitos. Revise o domínio e o intervalo.');
  const report: Omit<
    RegressionReport,
    'id' | 'sourceSetId' | 'curveSetId' | 'residualSetId' | 'sourceLabel'
  > = {
    kind: 'regression',
    ...(customResult
      ? { custom: { ...options.custom!, normalizedExpression: customResult.normalizedExpression } }
      : {}),
    method,
    algorithm: nonlinear
      ? 'Levenberg–Marquardt · mínimos quadrados não ponderados'
      : 'Mínimos quadrados não ponderados · QR',
    equation,
    parameters,
    count: rows.length,
    degreesOfFreedom: df,
    sse,
    rmse: Math.sqrt(sse / rows.length),
    residualStandardError: Math.sqrt(sse / df),
    rSquared,
    adjustedRSquared: rSquared === null ? null : 1 - ((1 - rSquared) * (rows.length - 1)) / df,
    objectiveSse,
    objectiveScale:
      method === 'power' || method === 'exponential' ? 'ln(Y)' : method === 'inverse' ? '1/Y' : 'Y',
    fitRange: [min, max],
    iterations,
    warnings,
  };
  return { report, curveRows, residualRows };
}
/** Add curve + report in one document edit so undo/redo is atomic. */
export function insertRegression(
  graph: Graph,
  sourceId: number,
  options: RegressionOptions,
): RegressionReport {
  const source = graph.sets.find((s) => s.id === sourceId);
  if (!source) throw Error('A série de origem não existe mais.');
  const result = fitRegression(source, options);
  let next = graph.sets.reduce((max, s) => Math.max(max, s.id), -1) + 1;
  const curve = createSet(next++);
  curve.rows = result.curveRows;
  curve.legend = `${regressionMethods[options.method]} · ${source.legend || `S${sourceId}`}`;
  curve.comment = `Regression of S${sourceId}: ${options.method}`;
  curve.line.color = source.line.color;
  curve.line.style = 3;
  curve.symbol.type = 0;
  curve.analysis = {
    method: options.method,
    expression: options.custom?.formula,
    sourceSetIds: [sourceId],
    parameters: Object.fromEntries(result.report.parameters.map((p) => [p.name, p.value])),
    rSquared: result.report.rSquared ?? undefined,
  };
  const report: RegressionReport = {
    ...result.report,
    id: (graph.regressions ?? []).reduce((max, r) => Math.max(max, r.id), -1) + 1,
    sourceSetId: sourceId,
    curveSetId: curve.id,
    sourceLabel: source.legend || `S${sourceId}`,
  };
  graph.sets.push(curve);
  if (options.residuals) {
    const residual = createSet(next);
    residual.rows = result.residualRows;
    residual.legend = `Resíduos · ${source.legend || `S${sourceId}`}`;
    residual.line.color = source.line.color;
    residual.line.connection = 0;
    residual.symbol.type = 1;
    graph.sets.push(residual);
    report.residualSetId = residual.id;
  }
  (graph.regressions ??= []).push(report);
  return report;
}
