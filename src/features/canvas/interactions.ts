import { immutableRows } from '../../core/scene/immutableRows';
const hitPaths = new WeakMap<number[][], Map<string, string>>();
import type { Graph, Scale } from '../../core/scene/types';
import { normalized, scaled } from '../../core/geometry/coordinates';
const inverse = (v: number, scale: Scale) =>
  scale === 'Logarithmic' ? 10 ** v : scale === 'Reciprocal' ? 1 / v : v;
export function worldAt(graph: Graph, x: number, y: number): [number, number] {
  return [graph.axes.xaxis, graph.axes.yaxis].map((axis, i) => {
    const ratio = axis.inverted ? 1 - (i ? y : x) : i ? y : x;
    const low = scaled(graph.world[i], axis),
      high = scaled(graph.world[i + 2], axis);
    return inverse(low + (high - low) * ratio, axis.scale);
  }) as [number, number];
}
export function updateTicks(graph: Graph) {
  [graph.axes.xaxis, graph.axes.yaxis].forEach((axis, i) => {
    const span =
      axis.scale === 'Logarithmic'
        ? Math.log10(graph.world[i + 2] / graph.world[i])
        : graph.world[i + 2] - graph.world[i];
    const raw = span / 6,
      power = 10 ** Math.floor(Math.log10(raw));
    const step = ([1, 2, 2.5, 5, 10].find((n) => n >= raw / power) ?? 10) * power;
    axis.ticks.major = axis.scale === 'Logarithmic' ? 10 ** Math.max(0.1, step) : step;
  });
}
export function zoomGraph(graph: Graph, x: number, y: number, factor: number) {
  const anchor = worldAt(graph, x, y);
  const next = [...graph.world] as Graph['world'];
  [graph.axes.xaxis, graph.axes.yaxis].forEach((axis, i) => {
    const center = scaled(anchor[i], axis);
    next[i] = inverse(center + (scaled(graph.world[i], axis) - center) * factor, axis.scale);
    next[i + 2] = inverse(
      center + (scaled(graph.world[i + 2], axis) - center) * factor,
      axis.scale,
    );
    if (
      !Number.isFinite(next[i]) ||
      !Number.isFinite(next[i + 2]) ||
      next[i] >= next[i + 2] ||
      (axis.scale === 'Reciprocal' && next[i] * next[i + 2] <= 0)
    )
      throw Error('Esse zoom ultrapassa o domínio do eixo.');
  });
  graph.world = next;
  updateTicks(graph);
}
export function panGraph(graph: Graph, from: [number, number], to: [number, number]) {
  const a = worldAt(graph, ...from),
    b = worldAt(graph, ...to);
  const next = [...graph.world] as Graph['world'];
  [graph.axes.xaxis, graph.axes.yaxis].forEach((axis, i) => {
    const delta = scaled(a[i], axis) - scaled(b[i], axis);
    next[i] = inverse(scaled(graph.world[i], axis) + delta, axis.scale);
    next[i + 2] = inverse(scaled(graph.world[i + 2], axis) + delta, axis.scale);
    if (
      !Number.isFinite(next[i]) ||
      !Number.isFinite(next[i + 2]) ||
      next[i] >= next[i + 2] ||
      (axis.scale === 'Reciprocal' && next[i] * next[i + 2] <= 0)
    )
      throw Error('Esse movimento ultrapassa o domínio do eixo.');
  });
  graph.world = next;
}
/** Native drawing stays untouched; paths here exist solely for pointer hit testing. */
export function hitPath(
  graph: Graph,
  rows: number[][],
  width: number,
  height: number,
  left: number,
  top: number,
  pointsOnly = false,
) {
  const cacheable = immutableRows(rows);
  const key = [
    width,
    height,
    left,
    top,
    ...graph.world,
    graph.axes.xaxis.scale,
    graph.axes.xaxis.inverted,
    graph.axes.yaxis.scale,
    graph.axes.yaxis.inverted,
    pointsOnly,
  ].join(',');
  const cached = cacheable ? hitPaths.get(rows)?.get(key) : undefined;
  if (cached !== undefined) return cached;
  let path = '',
    connected = false;
  for (const row of rows) {
    const x = left + normalized(row[0], graph.world[0], graph.world[2], graph.axes.xaxis) * width;
    const y =
      top + (1 - normalized(row[1], graph.world[1], graph.world[3], graph.axes.yaxis)) * height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      connected = false;
      continue;
    }
    path += pointsOnly ? `M${x} ${y}h0.001` : `${connected ? 'L' : 'M'}${x} ${y}`;
    connected = true;
  }
  if (cacheable) {
    let paths = hitPaths.get(rows);
    if (!paths) hitPaths.set(rows, (paths = new Map()));
    // Zoom must not accumulate a full-sized path for every history entry.
    if (paths.size >= 2) paths.delete(paths.keys().next().value!);
    paths.set(key, path);
  }
  return path;
}
