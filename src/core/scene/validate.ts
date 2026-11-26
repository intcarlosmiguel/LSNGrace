import { isSeriesWorksheet } from '../analysis/worksheet';
import { isRegressionReport } from '../analysis/metadata';
import type { Scene } from './types';
import { columns } from './datasets';
import { immutableRows } from './immutableRows';
const rowChecks = new WeakMap<number[][], Map<string, boolean>>();
function invalidRows(rows: number[][], type: string): boolean {
  const cacheable = immutableRows(rows);
  const cached = cacheable ? rowChecks.get(rows)?.get(type) : undefined;
  if (cached !== undefined) return cached;
  const invalid = rows.some(
    (row) =>
      row.some((v) => !Number.isFinite(v)) || (columns[type] && row.length !== columns[type]),
  );
  if (cacheable) {
    let checks = rowChecks.get(rows);
    if (!checks) rowChecks.set(rows, (checks = new Map()));
    checks.set(type, !!invalid);
  }
  return !!invalid;
}
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  if (scene.page.size.some((v) => !Number.isFinite(v) || v <= 0))
    errors.push('Dimensões de página inválidas.');
  const ids = new Set<number>();
  for (const graph of scene.graphs) {
    if (ids.has(graph.id)) errors.push(`G${graph.id} duplicado.`);
    ids.add(graph.id);
    const regressionIds = new Set<number>();
    for (const report of graph.regressions ?? []) {
      if (!isRegressionReport(report) || regressionIds.has(report.id))
        errors.push(`G${graph.id}: informações da regressão inválidas.`);
      regressionIds.add(report.id);
    }
    for (const [name, bounds] of [
      ['world', graph.world],
      ['viewport', graph.viewport],
    ] as const)
      if (
        bounds.some((v) => !Number.isFinite(v)) ||
        bounds[0] >= bounds[2] ||
        bounds[1] >= bounds[3]
      )
        errors.push(
          `G${graph.id}: ${name} inválido. Os limites devem ser finitos e cada mínimo deve ser menor que o máximo.`,
        );
    for (const [key, axis] of Object.entries(graph.axes)) {
      if (!(axis.ticks.major > 0) || !Number.isFinite(axis.ticks.major))
        errors.push(`${key}: espaçamento de ticks deve ser positivo.`);
      if (
        !Number.isInteger(axis.ticks.minorCount) ||
        axis.ticks.minorCount < 0 ||
        axis.ticks.minorCount > 100
      )
        errors.push(`${key}: subdivisões devem estar entre 0 e 100.`);
      if (axis.offset && (axis.offset.length !== 2 || axis.offset.some((v) => !Number.isFinite(v))))
        errors.push(`${key}: deslocamentos inválidos.`);
      for (const [label, v, max] of [
        ['precisão', axis.tickLabels.precision, 15],
        ['rótulos omitidos', axis.tickLabels.skip ?? 0, Infinity],
        ['níveis', axis.tickLabels.stagger ?? 0, Infinity],
      ] as const)
        if (!Number.isInteger(v) || v < 0 || v > max)
          errors.push(`${key}: ${label} deve ser um inteiro válido.`);
      const i = key.includes('x') ? 0 : 1,
        a = graph.world[i],
        b = graph.world[i + 2];
      if (axis.enabled && axis.scale === 'Logarithmic' && a <= 0)
        errors.push(`${key}: escala logarítmica requer limites positivos.`);
      if (axis.enabled && axis.scale === 'Reciprocal' && a * b <= 0)
        errors.push(`${key}: escala recíproca não pode atravessar zero.`);
    }
    for (const p of [graph.grid?.major, graph.grid?.minor])
      if (
        p &&
        (![p.width, p.color, p.style, p.opacity].every(Number.isFinite) ||
          p.width < 0 ||
          p.opacity < 0 ||
          p.opacity > 1 ||
          !Number.isInteger(p.style) ||
          p.style < 0 ||
          p.style > 5)
      )
        errors.push(`G${graph.id}: estilo de grade inválido.`);
    const l = graph.legend;
    if (
      !Number.isInteger(l.columns ?? 1) ||
      (l.columns ?? 1) < 1 ||
      !Number.isFinite(l.symbolScale ?? 1) ||
      (l.symbolScale ?? 1) < 0 ||
      !Number.isFinite(l.columnGap ?? 16) ||
      (l.columnGap ?? 16) < 0 ||
      !Number.isFinite(l.box.fill.opacity ?? 1) ||
      (l.box.fill.opacity ?? 1) < 0 ||
      (l.box.fill.opacity ?? 1) > 1
    )
      errors.push(`G${graph.id}: configuração da legenda inválida.`);
    const sets = new Set<number>();
    for (const set of graph.sets) {
      if (set.worksheet && !isSeriesWorksheet(set.worksheet, set.type))
        errors.push(`G${graph.id}.S${set.id}: tabela de transformações inválida.`);
      if (sets.has(set.id)) errors.push(`G${graph.id}.S${set.id} duplicado.`);
      sets.add(set.id);
      if (!/^\w+$/.test(set.type)) errors.push('Tipo de Set inválido.');
      if (
        [set.opacity ?? 1, set.symbol.fill.opacity ?? 1].some(
          (v) => !Number.isFinite(v) || v < 0 || v > 1,
        )
      )
        errors.push(`G${graph.id}.S${set.id}: alpha deve estar entre 0 e 1.`);
      if (invalidRows(set.rows, set.type)) errors.push(`G${graph.id}.S${set.id}: dados inválidos.`);
    }
  }
  return errors;
}
