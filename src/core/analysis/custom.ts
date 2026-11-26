import { compileExpression } from './expression';
import { leastSquares } from './leastSquares';
import type { CustomFitSettings } from './types';
export function customFitDefinition(settings: CustomFitSettings | undefined) {
  if (!settings) throw Error('Informe a fórmula e os valores iniciais.');
  const expression = compileExpression(settings.formula);
  const tolerance = settings.tolerance ?? 1e-8,
    maxIterations = settings.maxIterations ?? 250;
  if (!Number.isFinite(tolerance) || tolerance < 1e-12 || tolerance > 1e-2)
    throw Error('A tolerância deve estar entre 1e-12 e 0,01.');
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000)
    throw Error('Use de 1 a 1000 iterações.');
  const parameters = expression.parameters.map((name) => {
    const config = settings.parameters?.[name];
    if (!config || !Number.isFinite(config.initial))
      throw Error(`Informe o valor inicial de ${name}.`);
    const min = config.min ?? -Infinity,
      max = config.max ?? Infinity;
    if (
      (config.min !== undefined && !Number.isFinite(min)) ||
      (config.max !== undefined && !Number.isFinite(max)) ||
      min > max
    )
      throw Error(`Limites inválidos para ${name}.`);
    if (config.initial < min || config.initial > max)
      throw Error(`O valor inicial de ${name} está fora dos limites.`);
    return { name, ...config, min, max, fixed: !!config.fixed || min === max };
  });
  const free = parameters.map((p, i) => (p.fixed ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) throw Error('Deixe pelo menos um parâmetro livre para ajustar.');
  return { expression, parameters, free, tolerance, maxIterations };
}
export function fitCustom(rows: number[][], settings: CustomFitSettings) {
  const { expression, parameters, free, tolerance, maxIterations } = customFitDefinition(settings);
  let ymin = Infinity,
    ymax = -Infinity;
  for (const [, y] of rows) {
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  const sy = ymax - ymin || Math.max(1, Math.abs(ymin));
  const scales = parameters.map((p) => Math.max(Math.abs(p.initial), 1));
  const lower = free.map((i) => parameters[i].min / scales[i]),
    upper = free.map((i) => parameters[i].max / scales[i]);
  const unpack = (q: number[]) => {
    const values = parameters.map((p) => p.initial);
    free.forEach((i, k) => (values[i] = q[k] * scales[i]));
    return values;
  };
  let q = free.map((i) => parameters[i].initial / scales[i]);
  const predictions = (q: number[]) => {
    const p = unpack(q);
    return rows.map(([x]) => (expression.evaluate(x, p) - ymin) / sy);
  };
  const target = rows.map(([, y]) => (y - ymin) / sy);
  const costOf = (prediction: number[]) =>
    prediction.reduce((s, v, i) => s + (target[i] - v) ** 2, 0);
  let prediction = predictions(q),
    cost = costOf(prediction);
  if (!Number.isFinite(cost))
    throw Error(
      'A fórmula não é finita nos dados com os valores iniciais. Revise divisões, raízes e logaritmos.',
    );
  const jacobian = (q: number[], base: number[]) => {
    const columns = q.map((v, k) => {
      const h = 1e-5 * (1 + Math.abs(v)),
        plus = [...q],
        minus = [...q];
      plus[k] = Math.min(upper[k], v + h);
      minus[k] = Math.max(lower[k], v - h);
      const yp = predictions(plus),
        ym = predictions(minus);
      return base.map((value, i) => {
        if (Number.isFinite(yp[i]) && Number.isFinite(ym[i]) && plus[k] > minus[k])
          return (yp[i] - ym[i]) / (plus[k] - minus[k]);
        if (Number.isFinite(yp[i]) && plus[k] > v) return (yp[i] - value) / (plus[k] - v);
        if (Number.isFinite(ym[i]) && v > minus[k]) return (value - ym[i]) / (v - minus[k]);
        throw Error(
          'Não foi possível estimar as derivadas. Revise os valores iniciais e os limites.',
        );
      });
    });
    return rows.map((_, i) => columns.map((col) => col[i]));
  };
  let lambda = 1e-3,
    converged = false,
    iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    const j = jacobian(q, prediction),
      residual = target.map((v, i) => v - prediction[i]);
    const gradient = q.map((_, k) => j.reduce((s, row, i) => s + row[k] * residual[i], 0));
    const projected = gradient.map((g, k) =>
      (q[k] <= lower[k] + 1e-12 && g < 0) || (q[k] >= upper[k] - 1e-12 && g > 0) ? 0 : g,
    );
    if (Math.max(...projected.map(Math.abs)) <= tolerance) {
      converged = true;
      break;
    }
    const augmented = [
      ...j,
      ...q.map((_, i) =>
        q.map((_, k) =>
          i === k
            ? Math.sqrt(
                lambda *
                  Math.max(
                    j.reduce((s, row) => s + row[k] ** 2, 0),
                    1e-8,
                  ),
              )
            : 0,
        ),
      ),
    ];
    const step = leastSquares(augmented, [...residual, ...q.map(() => 0)]).coefficients;
    const candidate = q.map((v, k) => Math.max(lower[k], Math.min(upper[k], v + step[k])));
    const nextPrediction = predictions(candidate),
      nextCost = costOf(nextPrediction);
    if (Number.isFinite(nextCost) && nextCost < cost) {
      const improvement = cost - nextCost,
        delta = Math.max(...candidate.map((v, k) => Math.abs(v - q[k]) / (1 + Math.abs(q[k]))));
      q = candidate;
      prediction = nextPrediction;
      cost = nextCost;
      lambda = Math.max(lambda / 3, 1e-12);
      if (improvement <= tolerance * (1 + cost) && delta <= Math.sqrt(tolerance)) {
        converged = true;
        iterations++;
        break;
      }
    } else {
      lambda *= 10;
      if (lambda > 1e16) break;
    }
  }
  if (!converged)
    throw Error(
      `O ajuste personalizado não convergiu em ${iterations} iterações. Revise iniciais, limites ou aumente o máximo de iterações.`,
    );
  const values = unpack(q),
    variance = (cost * sy ** 2) / (rows.length - free.length);
  const covariance = leastSquares(
    jacobian(q, prediction),
    rows.map(() => 0),
  ).covariance;
  const standardErrors: (number | null)[] = parameters.map(() => null);
  const warnings: string[] = [];
  free.forEach((i, k) => {
    if (q[k] <= lower[k] + 1e-8 || q[k] >= upper[k] - 1e-8)
      warnings.push(
        `${parameters[i].name} atingiu um limite; erro padrão não estimado nesse limite.`,
      );
    else
      standardErrors[i] = Math.sqrt(
        Math.max(0, ((covariance[k][k] * scales[i] ** 2) / sy ** 2) * variance),
      );
  });
  if (parameters.some((p) => p.fixed))
    warnings.push(
      'Parâmetros fixos não entram nos graus de liberdade e não têm erro padrão estimado.',
    );
  return {
    values,
    standardErrors,
    evaluate: (x: number) => expression.evaluate(x, values),
    equation: settings.formula,
    normalizedExpression: expression.normalized,
    iterations,
    warnings,
    freeCount: free.length,
    names: expression.parameters,
  };
}
