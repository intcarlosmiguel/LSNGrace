import { compileExpression } from './expression';
import { columns as nativeColumns } from '../scene/datasets';
import type { DataSet } from '../scene/types';
export interface SeriesWorksheet {
  baseRows: number[][];
  columns: { id: string; expression: string; values: number[]; target?: 'x' | 'y' }[];
  x: string;
  y: string;
  hiddenRows: number[];
  nextColumn: number;
}
export function worksheetFor(set: DataSet): SeriesWorksheet {
  return (
    set.worksheet ?? {
      baseRows: set.rows,
      columns: [],
      x: 'x0',
      y: 'y0',
      hiddenRows: [],
      nextColumn: 1,
    }
  );
}
export function worksheetColumn(sheet: SeriesWorksheet, id: string): number[] {
  if (id === 'x0' || id === 'y0') return sheet.baseRows.map((row) => row[id === 'x0' ? 0 : 1]);
  if (/^d[1-9]\d*$/.test(id)) return sheet.baseRows.map((row) => row[Number(id.slice(1)) + 1]);
  const column = sheet.columns.find((c) => c.id === id);
  if (!column) throw Error(`Coluna ${id} não encontrada.`);
  return column.values;
}
export function projectWorksheet(sheet: SeriesWorksheet): number[][] {
  const x = worksheetColumn(sheet, sheet.x),
    y = worksheetColumn(sheet, sheet.y),
    hidden = new Set(sheet.hiddenRows);
  return sheet.baseRows.flatMap((row, i) => (hidden.has(i) ? [] : [[x[i], y[i], ...row.slice(2)]]));
}
export function syncWorksheet(set: DataSet) {
  if (set.worksheet) set.rows = projectWorksheet(set.worksheet);
}
function ensureWorksheet(set: DataSet) {
  return set.worksheet ?? (set.worksheet = worksheetFor(set));
}
export function transformSeries(set: DataSet, expression: string, target: 'x' | 'y' = 'y'): string {
  const sheet = worksheetFor(set),
    count = sheet.baseRows.length;
  if (!count) throw Error('A série não contém linhas para transformar.');
  if (sheet.columns.length >= 100)
    throw Error('Limite de 100 colunas por série. Exclua uma coluna para continuar.');
  let source = expression.trim();
  const assignment = source.match(/^([xy])\s*=\s*(.+)$/i);
  if (assignment) {
    target = assignment[1].toLowerCase() as 'x' | 'y';
    source = assignment[2];
  }
  const vectors: Record<string, number[]> = {
    x: worksheetColumn(sheet, sheet.x),
    y: worksheetColumn(sheet, sheet.y),
    x0: worksheetColumn(sheet, 'x0'),
    y0: worksheetColumn(sheet, 'y0'),
    i: Array.from({ length: count }, (_, i) => i + 1),
  };
  for (let i = 2; i < (sheet.baseRows[0]?.length ?? 2); i++)
    vectors[`d${i - 1}`] = sheet.baseRows.map((row) => row[i]);
  sheet.columns.forEach((c) => (vectors[c.id] = c.values));
  // Aggregates accept a single column name; no execution of user code.
  source = source.replace(
    /\b(mean|avg|sum|min|max|std|sd|norm)\s*\(\s*([a-z][a-z0-9]*)\s*\)/gi,
    (_, fn: string, name: string) => {
      name = name.toLowerCase();
      const v = vectors[name];
      if (!v) throw Error(`Coluna ${name} não encontrada.`);
      let sum = 0,
        min = Infinity,
        max = -Infinity,
        maxAbs = 0;
      for (const n of v) {
        sum += n;
        min = Math.min(min, n);
        max = Math.max(max, n);
        maxAbs = Math.max(maxAbs, Math.abs(n));
      }
      const mean = sum / count;
      const result =
        fn.toLowerCase() === 'min'
          ? min
          : fn.toLowerCase() === 'max'
            ? max
            : fn.toLowerCase() === 'sum'
              ? sum
              : fn.toLowerCase() === 'std' || fn.toLowerCase() === 'sd'
                ? Math.sqrt(v.reduce((s, n) => s + (n - mean) ** 2, 0) / Math.max(1, count - 1))
                : mean;
      return fn.toLowerCase() === 'norm' ? `(${name}/(${maxAbs || 1}))` : `(${result})`;
    },
  );
  const compiled = compileExpression(source, {
    variables: Object.keys(vectors),
    allowConstant: true,
  });
  const values = Array.from({ length: count }, (_, i) => {
    const value = compiled.evaluate(
      vectors.x[i],
      compiled.parameters.map((name) => vectors[name][i]),
    );
    if (!Number.isFinite(value))
      throw Error(`Resultado não finito na linha ${i + 1}. Revise o domínio da expressão.`);
    return value;
  });
  const initialized = ensureWorksheet(set),
    id = `c${initialized.nextColumn++}`;
  initialized.columns.push({ id, expression: expression.trim(), values, target });
  initialized[target] = id;
  syncWorksheet(set);
  return id;
}
export function bindWorksheet(set: DataSet, axis: 'x' | 'y', id: string) {
  const sheet = ensureWorksheet(set);
  worksheetColumn(sheet, id);
  sheet[axis] = id;
  syncWorksheet(set);
}
export function removeWorksheetColumn(set: DataSet, id: string) {
  const sheet = ensureWorksheet(set);
  if (!sheet.columns.some((c) => c.id === id))
    throw Error('Somente colunas de transformação podem ser excluídas.');
  sheet.columns = sheet.columns.filter((c) => c.id !== id);
  if (sheet.x === id) sheet.x = 'x0';
  if (sheet.y === id) sheet.y = 'y0';
  syncWorksheet(set);
}
export function setWorksheetRowHidden(set: DataSet, index: number, hidden: boolean) {
  const sheet = ensureWorksheet(set);
  if (!Number.isInteger(index) || index < 0 || index >= sheet.baseRows.length)
    throw Error('Linha inválida.');
  sheet.hiddenRows = sheet.hiddenRows.filter((i) => i !== index);
  if (hidden) sheet.hiddenRows.push(index);
  sheet.hiddenRows.sort((a, b) => a - b);
  syncWorksheet(set);
}
export function showAllWorksheetRows(set: DataSet) {
  const sheet = ensureWorksheet(set);
  sheet.hiddenRows = [];
  syncWorksheet(set);
}
export function isSeriesWorksheet(value: unknown, type?: string): value is SeriesWorksheet {
  if (!value || typeof value !== 'object') return false;
  const s = value as SeriesWorksheet;
  const valid = (id: unknown) =>
    id === 'x0' || id === 'y0' || (typeof id === 'string' && s.columns.some((c) => c.id === id));
  return (
    Array.isArray(s.baseRows) &&
    Array.isArray(s.columns) &&
    s.columns.length <= 100 &&
    s.baseRows.every(
      (row) =>
        Array.isArray(row) &&
        row.length >= 2 &&
        row.length === ((type && nativeColumns[type]) || s.baseRows[0]?.length) &&
        row.every((n) => typeof n === 'number' && Number.isFinite(n)),
    ) &&
    s.columns.every(
      (c) =>
        c &&
        /^c[1-9]\d*$/.test(c.id) &&
        typeof c.expression === 'string' &&
        (c.target === undefined || c.target === 'x' || c.target === 'y') &&
        c.expression.length <= 4096 &&
        Array.isArray(c.values) &&
        c.values.length === s.baseRows.length &&
        c.values.every((n) => typeof n === 'number' && Number.isFinite(n)),
    ) &&
    new Set(s.columns.map((c) => c.id)).size === s.columns.length &&
    valid(s.x) &&
    valid(s.y) &&
    Number.isSafeInteger(s.nextColumn) &&
    s.nextColumn > 0 &&
    s.columns.every((c) => Number(c.id.slice(1)) < s.nextColumn) &&
    Array.isArray(s.hiddenRows) &&
    new Set(s.hiddenRows).size === s.hiddenRows.length &&
    s.hiddenRows.every((i) => Number.isSafeInteger(i) && i >= 0 && i < s.baseRows.length)
  );
}
export function worksheetMetadata(source: string) {
  return source.split(/\r?\n/).flatMap((line) => {
    const m = line.match(/^# LSNGrace worksheet G(\d+)\.S(\d+) (.+)$/);
    if (!m) return [];
    try {
      const value: unknown = JSON.parse(m[3]);
      return isSeriesWorksheet(value) ? [{ graphId: +m[1], setId: +m[2], sheet: value }] : [];
    } catch {
      return [];
    }
  });
}
