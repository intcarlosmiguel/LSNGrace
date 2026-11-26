export interface DataTable {
  headers: string[];
  rows: number[][];
  delimiter: string;
}
export type Delimiter = 'auto' | ',' | ';' | '\t' | 'whitespace';
/** CSV quotes are handled before numeric conversion. Blank cells are errors, never zeros. */
function cells(line: string, delimiter: string): string[] {
  if (delimiter === 'whitespace') return line.trim().split(/\s+/);
  const result: string[] = [];
  let value = '',
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (!quoted && value.trim()) throw Error('Aspas inválidas no campo.');
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      result.push(value.trim());
      value = '';
    } else value += ch;
  }
  if (quoted) throw Error('Aspas não fechadas.');
  result.push(value.trim());
  return result;
}
export const valueOf = (value: string, delimiter: string) => {
  if (!value.trim()) return NaN;
  const text = value.trim().replace(/[dD]/g, 'e');
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text)) return NaN;
  return Number(delimiter !== ',' ? text.replace(',', '.') : text);
};
export interface MixedTable {
  headers: string[];
  rows: string[][];
  lines: number[];
  delimiter: string;
}
export function parseMixedTable(source: string, chosen: Delimiter = 'auto'): MixedTable {
  const lines = source
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((text, i) => ({ text, line: i + 1 }))
    .filter(({ text }) => text.trim() && !/^\s*(#|@|\/\/)/.test(text));
  if (!lines.length) throw Error('Cole pelo menos uma linha com duas colunas numéricas: X e Y.');
  const whitespaceValues = lines[0].text.trim().split(/\s+/);
  const whitespaceNumbers =
    whitespaceValues.length > 1 &&
    whitespaceValues.every((v) => !v.endsWith(',') && Number.isFinite(valueOf(v, 'whitespace')));
  const delimiter =
    chosen === 'auto'
      ? lines[0].text.includes('\t')
        ? '\t'
        : lines[0].text.includes(';')
          ? ';'
          : whitespaceNumbers
            ? 'whitespace'
            : lines[0].text.includes(',')
              ? ','
              : 'whitespace'
      : chosen;
  let headers: string[] = [];
  const rows: string[][] = [],
    rowLines: number[] = [];
  let width = 0;
  lines.forEach(({ text, line }, index) => {
    let fields: string[];
    try {
      fields = cells(text, delimiter);
    } catch (e) {
      throw Error(`Linha ${line}: ${(e as Error).message}`);
    }
    if (!width) {
      width = fields.length;
      if (width < 2)
        throw Error(
          `Linha ${line}: são necessárias pelo menos duas colunas. Verifique o separador.`,
        );
    }
    if (fields.length !== width)
      throw Error(`Linha ${line}: esperadas ${width} colunas, recebidas ${fields.length}.`);
    const numeric = fields.map((v) => valueOf(v, delimiter));
    // A header must be textual in every cell; partial numeric rows indicate malformed data.
    if (index === 0 && numeric.every(Number.isNaN) && fields.every(Boolean)) {
      headers = fields;
      return;
    }
    rows.push(fields);
    rowLines.push(line);
  });
  if (!rows.length) throw Error('A tabela tem cabeçalho, mas ainda não tem dados numéricos.');
  if (!headers.length) headers = Array.from({ length: width }, (_, i) => `Coluna ${i + 1}`);
  return { headers, rows, lines: rowLines, delimiter };
}
/** Strict numeric import remains available for callers that expect only numbers. */
export function parseTable(source: string, chosen: Delimiter = 'auto'): DataTable {
  const table = parseMixedTable(source, chosen);
  const rows = table.rows.map((fields, row) =>
    fields.map((v, col) => {
      const n = valueOf(v, table.delimiter);
      if (!Number.isFinite(n))
        throw Error(`Linha ${table.lines[row]}, coluna ${col + 1}: “${v}” não é um número válido.`);
      return n;
    }),
  );
  return { headers: table.headers, rows, delimiter: table.delimiter };
}
export function mapColumns(table: DataTable, x: number, y: number, dy: number | null): number[][] {
  const indices = dy === null ? [x, y] : [x, y, dy];
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= table.headers.length))
    throw Error('Escolha colunas válidas.');
  if (new Set(indices).size !== indices.length)
    throw Error('X, Y e erro Y devem usar colunas diferentes.');
  if (dy !== null && table.rows.some((row) => row[dy] < 0))
    throw Error('As incertezas em Y devem ser positivas ou zero.');
  return table.rows.map((row) => indices.map((i) => row[i]));
}
