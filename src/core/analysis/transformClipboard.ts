import type { DataSet } from '../scene/types';
import { transformSeries, worksheetFor } from './worksheet';
export interface TransformRecipe {
  kind: 'lsngrace-transformations';
  version: 1;
  steps: { id: string; expression: string; target: 'x' | 'y' }[];
}
const references = (expression: string) =>
  [...expression.matchAll(/\bc[1-9]\d*\b/gi)].map((m) => m[0].toLowerCase());
/** Copy expressions, never source values or row masks. Include referenced columns. */
export function copyTransformRecipe(set: DataSet, columnId?: string): TransformRecipe {
  const sheet = worksheetFor(set),
    selected = columnId ? sheet.columns.filter((c) => c.id === columnId) : sheet.columns;
  if (!selected.length) throw Error('Esta série não possui transformações para copiar.');
  const needed = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string) => {
    if (needed.has(id)) return;
    if (visiting.has(id)) throw Error('Dependência circular entre transformações.');
    const column = sheet.columns.find((c) => c.id === id);
    if (!column)
      throw Error(
        `A expressão depende da coluna ${id.toUpperCase()}, que foi excluída. Essa transformação não pode ser reaplicada sem a fórmula da coluna original.`,
      );
    visiting.add(id);
    references(column.expression).forEach(visit);
    visiting.delete(id);
    needed.add(id);
  };
  selected.forEach((c) => visit(c.id));
  return {
    kind: 'lsngrace-transformations',
    version: 1,
    steps: sheet.columns
      .filter((c) => needed.has(c.id))
      .map((c) => ({
        id: c.id,
        expression: c.expression,
        target: c.target ?? (/^\s*x\s*=/i.test(c.expression) || sheet.x === c.id ? 'x' : 'y'),
      })),
  };
}
export function serializeTransformRecipe(recipe: TransformRecipe): string {
  if (recipe.steps.length === 1) {
    const step = recipe.steps[0];
    return /^\s*[xy]\s*=/i.test(step.expression)
      ? step.expression
      : `${step.target} = ${step.expression}`;
  }
  return JSON.stringify(recipe, null, 2);
}
export function readTransformRecipe(text: string): TransformRecipe {
  if (text.length > 500000) throw Error('O conteúdo copiado é muito grande.');
  if (!text.trim().startsWith('{')) {
    if (!text.trim() || text.length > 4096)
      throw Error('Copie uma expressão de transformação válida.');
    return {
      kind: 'lsngrace-transformations',
      version: 1,
      steps: [{ id: 'c1', expression: text.trim(), target: /^\s*x\s*=/i.test(text) ? 'x' : 'y' }],
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error('A receita de transformações copiada é inválida.');
  }
  const r = value as TransformRecipe;
  if (
    !r ||
    r.kind !== 'lsngrace-transformations' ||
    r.version !== 1 ||
    !Array.isArray(r.steps) ||
    !r.steps.length ||
    r.steps.length > 100 ||
    r.steps.some(
      (s) =>
        !s ||
        typeof s.id !== 'string' ||
        !/^c[1-9]\d*$/.test(s.id) ||
        typeof s.expression !== 'string' ||
        !s.expression.trim() ||
        s.expression.length > 4096 ||
        !['x', 'y'].includes(s.target),
    ) ||
    new Set(r.steps.map((s) => s.id)).size !== r.steps.length
  )
    throw Error('A receita de transformações copiada é inválida.');
  return r;
}
export function pasteTransformRecipe(set: DataSet, recipe: TransformRecipe): string[] {
  const valid = readTransformRecipe(JSON.stringify(recipe));
  const working: DataSet = {
    ...set,
    worksheet: set.worksheet
      ? {
          ...set.worksheet,
          columns: [...set.worksheet.columns],
          hiddenRows: [...set.worksheet.hiddenRows],
        }
      : undefined,
  };
  const remap = new Map<string, string>(),
    ids: string[] = [];
  for (const step of valid.steps) {
    const expression = step.expression.replace(/\bc[1-9]\d*\b/gi, (reference) => {
      const mapped = remap.get(reference.toLowerCase());
      if (!mapped)
        throw Error(
          `Falta a transformação de origem ${reference.toUpperCase()}. Copie a transformação com suas dependências.`,
        );
      return mapped;
    });
    const id = transformSeries(working, expression, step.target);
    remap.set(step.id, id);
    ids.push(id);
  }
  set.rows = working.rows;
  set.worksheet = working.worksheet;
  return ids;
}
