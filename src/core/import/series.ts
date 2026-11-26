import { createSet, palette } from '../scene/defaults';
import type { Scene, Graph, DataSet } from '../scene/types';
import { resolveColor } from '../style/colors';
import { valueOf, type MixedTable } from './tabular';
export interface ImportStyle {
  line: DataSet['line']['style'];
  symbol: DataSet['symbol']['type'];
  color: number | string | null;
}
export interface SeriesInput {
  importName?: string;
  name: string;
  rows: number[][];
  type: 'xy' | 'xydy';
  xLabel: string;
  yLabel: string;
  style: ImportStyle;
}
export const importColors = [4, 2, 15, 11, 8, 13, 9, 10, 12, 14];
const colorNames: Record<string, number> = {
  white: 0,
  branco: 0,
  black: 1,
  preto: 1,
  red: 2,
  vermelho: 2,
  green: 3,
  verde: 3,
  blue: 4,
  azul: 4,
  yellow: 5,
  amarelo: 5,
  brown: 6,
  marrom: 6,
  grey: 7,
  gray: 7,
  cinza: 7,
  violet: 8,
  violeta: 8,
  cyan: 9,
  ciano: 9,
  magenta: 10,
  orange: 11,
  laranja: 11,
  indigo: 12,
  índigo: 12,
  maroon: 13,
  bordô: 13,
  turquoise: 14,
  turquesa: 14,
  green4: 15,
  'verde escuro': 15,
};
export function categoryColor(value: string): number | string {
  if (/^\d+$/.test(value) && +value <= 15) return +value;
  const named = colorNames[value.toLowerCase()];
  if (named !== undefined) return named;
  if (/^#[\da-f]{3}$/i.test(value))
    return (
      '#' +
      [...value.slice(1)]
        .map((v) => v + v)
        .join('')
        .toUpperCase()
    );
  if (/^#[\da-f]{6}$/i.test(value)) return value.toUpperCase();
  throw Error(`Cor “${value}” inválida. Use #RRGGBB, #RGB, nome de cor ou índice Grace de 0 a 15.`);
}
export function mapSeries(
  table: MixedTable,
  columns: {
    x: number;
    y: number;
    dy: number | null;
    category: number | null;
    color: number | null;
  },
  name: string,
  style: ImportStyle,
): SeriesInput[] {
  const { x, y, dy, category, color } = columns;
  const indices = [x, y, ...[dy, category, color].filter((v): v is number => v !== null)];
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= table.headers.length))
    throw Error('Escolha colunas válidas.');
  if (new Set(indices).size !== indices.length)
    throw Error('X, Y, erro, categoria e cor devem usar colunas diferentes.');
  if (color !== null && category === null)
    throw Error('Escolha a coluna de categorias antes da coluna de cores.');
  const groups = new Map<string, SeriesInput>();
  const groupColors = new Map<string, number | string>();
  table.rows.forEach((row, r) => {
    const numeric = (i: number) => {
      const n = valueOf(row[i], table.delimiter);
      if (!Number.isFinite(n))
        throw Error(
          `Linha ${table.lines[r]}, coluna ${i + 1}: “${row[i]}” não é um número válido.`,
        );
      return n;
    };
    const values = [numeric(x), numeric(y)];
    if (dy !== null) {
      const error = numeric(dy);
      if (error < 0)
        throw Error(`Linha ${table.lines[r]}: a incerteza em Y deve ser positiva ou zero.`);
      values.push(error);
    }
    const label = category === null ? name.trim() : row[category].trim();
    if (!label) throw Error(`Linha ${table.lines[r]}: categoria ou nome da série vazio.`);
    let paint: number | string | undefined;
    if (color !== null) {
      try {
        paint = categoryColor(row[color]);
      } catch (e) {
        throw Error(`Linha ${table.lines[r]}: ${(e as Error).message}`);
      }
      const previous = groupColors.get(label);
      const canonical = typeof paint === 'number' ? '#' + palette[paint] : paint;
      if (previous !== undefined && previous !== canonical)
        throw Error(
          `Linha ${table.lines[r]}: categoria “${label}” tem cores diferentes. Use uma única cor por categoria.`,
        );
      groupColors.set(label, canonical);
    }
    let series = groups.get(label);
    if (!series) {
      series = {
        importName: name.trim() || undefined,
        name: label,
        rows: [],
        type: dy === null ? 'xy' : 'xydy',
        xLabel: table.headers[x],
        yLabel: table.headers[y],
        style: { ...style, color: paint ?? style.color },
      };
      groups.set(label, series);
    }
    series.rows.push(values);
  });
  return [...groups.values()];
}
/** Called inside one document edit, so a batch import is atomic and undoable. */
export function insertSeries(
  scene: Scene,
  graph: Graph,
  inputs: SeriesInput[],
  existingId?: number,
): number {
  if (!inputs.length) throw Error('Nenhuma série para importar.');
  if (existingId !== undefined && inputs.length !== 1) throw Error('Edite uma série por vez.');
  let firstId = -1;
  for (const input of inputs) {
    let s = existingId === undefined ? undefined : graph.sets.find((s) => s.id === existingId);
    if (existingId !== undefined && !s)
      throw Error('A série foi removida. Abra novamente o editor de dados.');
    if (!s) {
      s = createSet(Math.max(-1, ...graph.sets.map((s) => s.id)) + 1);
      s.line.width = 1.8;
      s.symbol.size = 0.7;
      graph.sets.push(s);
    }
    if (firstId < 0) firstId = s.id;
    const color = resolveColor(
      scene,
      input.style.color ?? importColors[graph.sets.indexOf(s) % importColors.length],
    );
    delete s.worksheet;
    s.rows = input.rows;
    s.type = input.type;
    s.legend = input.name;
    s.line.style = input.style.line;
    if (input.style.line !== 0 && s.line.connection === 0) s.line.connection = 1;
    s.symbol.type = input.style.symbol;
    if (existingId === undefined || color !== s.line.color) {
      s.line.color = color;
      s.symbol.color = color;
      s.symbol.fill.color = color;
      s.errorBars.color = color;
      s.fill.color = color;
    }
  }
  return firstId;
}
