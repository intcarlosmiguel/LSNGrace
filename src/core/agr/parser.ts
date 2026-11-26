import { worksheetMetadata, isSeriesWorksheet, projectWorksheet } from '../analysis/worksheet';
import { isRegressionReport } from '../analysis/metadata';
import { figureMetadata } from '../style/figure';
import { readLatexMetadata, restoreLatex } from '../text/latex';
import { createGraph, createScene, createSet } from '../scene/defaults';
import type { Graph, Scene, DataSet, AxisId } from '../scene/types';
import { graphFields, pageFields, setFields, numeric, quoted, readField } from './fields';
import { columns } from '../scene/datasets';
export function parseAgr(source: string): Scene {
  const scene = createScene();
  let graph: Graph | undefined,
    target: DataSet | undefined,
    objectScope = false;
  const ensureGraph = (id: number) => {
    let g = scene.graphs.find((g) => g.id === id);
    if (!g) {
      g = createGraph(id);
      scene.graphs.push(g);
    }
    return g;
  };
  const ensureSet = (g: Graph, id: number) => {
    let s = g.sets.find((s) => s.id === id);
    if (!s) {
      s = createSet(id);
      g.sets.push(s);
    }
    return s;
  };
  const diagnostic = (line: number, message: string, severity: 'warning' | 'error' = 'warning') =>
    scene.compatibility.diagnostics.push({ line, message, severity });
  const preserve = (raw: string, line: number) => {
    scene.compatibility.preserved.push({
      scope: graph && !objectScope ? 'graph' : 'page',
      graphId: graph && !objectScope ? graph.id : undefined,
      raw,
    });
    diagnostic(line, `Diretiva preservada sem interpretação: ${raw}`);
  };
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = index + 1,
      trimmed = raw.trim();
    const regression = trimmed.match(/^# LSNGrace regression G(\d+) (.+)$/);
    if (regression) {
      try {
        const report: unknown = JSON.parse(regression[2]);
        if (!isRegressionReport(report)) throw Error('Informações da regressão inválidas.');
        const g = ensureGraph(+regression[1]);
        if (g.regressions?.some((r) => r.id === report.id))
          throw Error('Identificador da regressão duplicado.');
        (g.regressions ??= []).push(report);
      } catch {
        diagnostic(line, 'Metadados de regressão inválidos; curva preservada.');
      }
      return;
    }
    const alpha = trimmed.match(/^# LSNGrace alpha G(\d+)\.S(\d+) (\S+) (\S+)$/);
    if (alpha) {
      const opacity = Number(alpha[3]),
        fillOpacity = Number(alpha[4]);
      if ([opacity, fillOpacity].some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
        diagnostic(line, 'Alpha deve estar entre 0 e 1.', 'error');
        return;
      }
      const set = ensureSet(ensureGraph(+alpha[1]), +alpha[2]);
      set.opacity = opacity;
      set.symbol.fill.opacity = fillOpacity;
      return;
    }
    if (!trimmed || trimmed.startsWith('#')) return;
    if (trimmed === '&') {
      target = undefined;
      return;
    }
    if (!trimmed.startsWith('@')) {
      if (!target) {
        diagnostic(line, 'Dados sem @target.', 'error');
        return;
      }
      try {
        const row = trimmed.split(/[\s,]+/).map((s) => numeric.read(s) as number);
        const count = columns[target.type];
        if (count && row.length !== count)
          throw Error(`Tipo ${target.type}: esperadas ${count} colunas, recebidas ${row.length}.`);
        target.rows.push(row);
      } catch (e) {
        diagnostic(line, String(e), 'error');
      }
      return;
    }
    // Normalize command whitespace while retaining original string contents.
    const statement =
      trimmed
        .slice(1)
        .trim()
        .match(/(?:"(?:\\.|[^"\\])*"|[^\s"]+)+/g)
        ?.join(' ') ?? '';
    let match: RegExpMatchArray | null;
    try {
      if ((match = statement.match(/^version (\d+)$/i))) {
        scene.graceVersion = +match[1];
        return;
      }
      if ((match = statement.match(/^target G(\d+)\.S(\d+)$/i))) {
        if (target) diagnostic(line, 'Bloco anterior sem terminador &.', 'error');
        target = ensureSet(ensureGraph(+match[1]), +match[2]);
        return;
      }
      if (target && (match = statement.match(/^type (\w+)$/i))) {
        target.type = match[1].toLowerCase();
        if (!columns[target.type])
          diagnostic(line, `Tipo de dados ${target.type} preservado; renderização indisponível.`);
        return;
      }
      if ((match = statement.match(/^with g(\d+)$/i))) {
        graph = ensureGraph(+match[1]);
        objectScope = false;
        return;
      }
      if (/^with /i.test(statement)) {
        objectScope = true;
        preserve(trimmed, line);
        return;
      }
      if ((match = statement.match(/^g(\d+) (on|off|hidden (?:true|false)|type \w+)$/i))) {
        const g = ensureGraph(+match[1]),
          value = match[2].toLowerCase();
        if (value.startsWith('hidden')) g.hidden = value.endsWith('true');
        else if (value.startsWith('type')) g.type = match[2].slice(5);
        else g.enabled = value === 'on';
        return;
      }
      if (objectScope) {
        preserve(trimmed, line);
        return;
      }
      if (
        (match = statement.match(/^map color (\d+) to \(\s*(\d+),\s*(\d+),\s*(\d+)\),\s*(".*")$/i))
      ) {
        const rgb = [+match[2], +match[3], +match[4]] as [number, number, number];
        if (rgb.some((v) => v > 255)) throw Error('RGB fora de 0–255.');
        scene.colors = scene.colors.filter((c) => c.id !== +match![1]);
        scene.colors.push({ id: +match[1], rgb, name: quoted.read(match[5]) as string });
        return;
      }
      if (
        (match = statement.match(/^map font (\d+) to ("(?:\\.|[^"\\])*"),\s*("(?:\\.|[^"\\])*")$/i))
      ) {
        scene.fonts = scene.fonts.filter((f) => f.id !== +match![1]);
        scene.fonts.push({
          id: +match[1],
          name: quoted.read(match[2]) as string,
          fallback: quoted.read(match[3]) as string,
        });
        return;
      }
      if (readField(scene, statement, pageFields)) return;
      if (!graph) {
        preserve(trimmed, line);
        return;
      }
      if ((match = statement.match(/^(world|view) (xmin|ymin|xmax|ymax) (.+)$/i))) {
        const bounds = match[1].toLowerCase() === 'world' ? graph.world : graph.viewport;
        bounds[['xmin', 'ymin', 'xmax', 'ymax'].indexOf(match[2].toLowerCase())] = numeric.read(
          match[3],
        ) as number;
        return;
      }
      if ((match = statement.match(/^(xaxis|yaxis|altxaxis|altyaxis) tick (in|out|both)$/i))) {
        graph.axes[match[1].toLowerCase() as AxisId].ticks.direction = match[2].toLowerCase() as
          'in' | 'out' | 'both';
        return;
      }
      if ((match = statement.match(/^legend ([+\-.\d][^a-z]*)$/i))) {
        const values = match[1].split(/[\s,]+/).map((v) => numeric.read(v) as number);
        if (values.length !== 2) throw Error('Posição de legenda inválida');
        graph.legend.position = values as [number, number];
        return;
      }
      if ((match = statement.match(/^s(\d+) (.+)$/i))) {
        if (readField(ensureSet(graph, +match[1]), match[2], setFields)) return;
      } else if (readField(graph, statement, graphFields)) return;
      preserve(trimmed, line);
    } catch (error) {
      scene.compatibility.preserved.push({
        scope: graph && !objectScope ? 'graph' : 'page',
        graphId: graph?.id,
        raw: trimmed,
      });
      diagnostic(line, `${statement}: ${String(error)}`, 'error');
    }
  });
  for (const metadata of worksheetMetadata(source)) {
    const set = scene.graphs
      .find((g) => g.id === metadata.graphId)
      ?.sets.find((s) => s.id === metadata.setId);
    if (!set || !isSeriesWorksheet(metadata.sheet, set.type)) continue;
    const projected = projectWorksheet(metadata.sheet);
    if (
      projected.length !== set.rows.length ||
      projected.some(
        (row, i) =>
          row.length !== set.rows[i].length ||
          row.some((n, j) => Math.abs(n - set.rows[i][j]) > 1e-12 * Math.max(1, Math.abs(n))),
      )
    ) {
      diagnostic(0, 'Tabela de transformações não corresponde aos dados; metadados ignorados.');
      continue;
    }
    set.worksheet = metadata.sheet;
  }
  if (target) diagnostic(lines.length, 'Bloco de dados sem terminador &.', 'error');
  try {
    restoreLatex(scene, readLatexMetadata(source));
  } catch (error) {
    diagnostic(0, (error as Error).message, 'error');
  }
  scene.colors.sort((a, b) => a.id - b.id);
  scene.fonts.sort((a, b) => a.id - b.id);
  for (const [id, style] of figureMetadata(source)) {
    const g = ensureGraph(id);
    if (style.grid) g.grid = style.grid;
    if (style.legend) {
      const { entries: _, ...legend } = style.legend;
      g.legend = legend;
    }
  }
  return scene;
}
