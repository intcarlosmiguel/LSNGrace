import { setWorksheetRowHidden } from '../../core/analysis/worksheet';
import { immutableRows } from '../../core/scene/immutableRows';
import { normalized, graphBox } from '../../core/geometry/coordinates';
import { createSet } from '../../core/scene/defaults';
import { quoted } from '../../core/agr/fields';
import { latexToGrace } from '../../core/text/latex';
import type { Graph, Scene, Point } from '../../core/scene/types';
export const pointExtras: Record<string, string[]> = {
  xy: [],
  bar: [],
  xydx: ['DX'],
  xydy: ['DY'],
  xydxdy: ['DX', 'DY'],
  xydxdx: ['DX−', 'DX+'],
  xydydy: ['DY−', 'DY+'],
  xydxdxdydy: ['DX−', 'DX+', 'DY−', 'DY+'],
  bardy: ['DY'],
  xysize: ['Tamanho'],
};
export function insertPoint(graph: Graph, setId: number | null, row: number[]): number {
  let set = setId === null ? undefined : graph.sets.find((s) => s.id === setId);
  if (setId !== null && !set) throw Error('A série não existe mais.');
  if (!set) {
    set = createSet(graph.sets.reduce((n, s) => Math.max(n, s.id), -1) + 1);
    set.legend = `Série ${set.id + 1}`;
    set.symbol.type = 1;
  }
  if (set.worksheet)
    throw Error(
      'Esta série tem uma tabela de transformações. Crie uma nova série para adicionar pontos, ou use Dados para substituir a tabela.',
    );
  const extras = pointExtras[set.type];
  if (!extras) throw Error('Adicionar pontos está disponível para XY, BAR, erros em X/Y e XYSIZE.');
  if (
    row.length !== 2 + extras.length ||
    !row.every(Number.isFinite) ||
    row.slice(2).some((v) => v < 0)
  )
    throw Error('Informe coordenadas finitas e erros/tamanhos não negativos.');
  if (setId === null) graph.sets.push(set);
  const ascending = set.rows.every((r, i) => !i || r[0] >= set!.rows[i - 1][0]);
  const descending = set.rows.every((r, i) => !i || r[0] <= set!.rows[i - 1][0]);
  let at = ascending
    ? set.rows.findIndex((r) => r[0] > row[0])
    : descending
      ? set.rows.findIndex((r) => r[0] < row[0])
      : -1;
  if (at < 0) at = set.rows.length;
  set.rows.splice(at, 0, [...row]);
  return set.id;
}
export function deletePoint(graph: Graph, setId: number, index: number) {
  const set = graph.sets.find((s) => s.id === setId);
  if (!set || !Number.isInteger(index) || index < 0 || index >= set.rows.length)
    throw Error('Ponto indisponível.');
  if (set.worksheet) {
    const hidden = new Set(set.worksheet.hiddenRows);
    const original = set.worksheet.baseRows.map((_, i) => i).filter((i) => !hidden.has(i))[index];
    setWorksheetRowHidden(set, original, true);
  } else set.rows.splice(index, 1);
}
/** Grace annotations remain native declarative statements in the shared scene. */
export function addCanvasText(scene: Scene, position: Point, text: string, size = 1) {
  if (
    !text.trim() ||
    text.length > 4096 ||
    !position.every(Number.isFinite) ||
    !Number.isFinite(size) ||
    size <= 0
  )
    throw Error('Informe um texto de até 4096 caracteres e tamanho positivo.');
  const unit = Math.min(...scene.page.size);
  const [x, y] = [position[0] / unit, (scene.page.size[1] - position[1]) / unit];
  const statements = [
    '@with string',
    '@    string on',
    '@    string loctype view',
    `@    string ${x}, ${y}`,
    '@    string color 1',
    '@    string rot 0',
    '@    string font 0',
    '@    string just 0',
    `@    string char size ${size}`,
    `@    string def ${quoted.write(latexToGrace(text))}`,
  ];
  scene.compatibility.preserved.push(...statements.map((raw) => ({ scope: 'page' as const, raw })));
}
export interface PointHit {
  graphId: number;
  setId: number;
  index: number;
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  label: string;
  distance: number;
}
type Entry = { index: number; px: number; py: number };
const indexes = new WeakMap<number[][], Map<string, Map<string, Entry[]>>>();
/** Grid hit testing avoids one DOM element per point and full scans on pointer motion. */
export function nearestPoint(
  scene: Scene,
  graph: Graph,
  position: Point,
  unitsPerPixel: number,
  selectedId: number | null = null,
): PointHit | null {
  const box = graphBox(scene, graph.viewport),
    cell = 12 * unitsPerPixel,
    radius = 10 * unitsPerPixel;
  let best: PointHit | null = null;
  for (const set of [...graph.sets].sort(
    (a, b) => Number(b.id === selectedId) - Number(a.id === selectedId),
  )) {
    if (
      set.hidden ||
      ((set.line.connection === 0 || set.line.style === 0) && set.symbol.type === 0)
    )
      continue;
    const key = [
      ...graph.world,
      box.left,
      box.top,
      box.width,
      box.height,
      graph.axes.xaxis.scale,
      graph.axes.xaxis.inverted,
      graph.axes.yaxis.scale,
      graph.axes.yaxis.inverted,
      cell,
    ].join(',');
    const cacheable = immutableRows(set.rows);
    let maps = cacheable ? indexes.get(set.rows) : undefined;
    if (!maps) {
      maps = new Map();
      if (cacheable) indexes.set(set.rows, maps);
    }
    let grid = maps.get(key);
    if (!grid) {
      grid = new Map();
      set.rows.forEach(([x, y], index) => {
        const px =
          box.left + normalized(x, graph.world[0], graph.world[2], graph.axes.xaxis) * box.width;
        const py =
          box.bottom - normalized(y, graph.world[1], graph.world[3], graph.axes.yaxis) * box.height;
        if (
          !Number.isFinite(px) ||
          !Number.isFinite(py) ||
          px < box.left ||
          px > box.right ||
          py < box.top ||
          py > box.bottom
        )
          return;
        const cellKey = `${Math.floor(px / cell)},${Math.floor(py / cell)}`;
        const entries = grid!.get(cellKey) ?? [];
        entries.push({ index, px, py });
        grid!.set(cellKey, entries);
      });
      if (maps.size >= 2) maps.delete(maps.keys().next().value!);
      maps.set(key, grid);
    }
    const cx = Math.floor(position[0] / cell),
      cy = Math.floor(position[1] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const entry of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const distance = Math.hypot(entry.px - position[0], entry.py - position[1]);
          if (distance <= radius && (!best || distance < best.distance - 1e-8)) {
            const [x, y] = set.rows[entry.index];
            best = {
              graphId: graph.id,
              setId: set.id,
              index: entry.index,
              x,
              y,
              pageX: entry.px,
              pageY: entry.py,
              label: set.legend || `S${set.id}`,
              distance,
            };
          }
        }
  }
  return best;
}
