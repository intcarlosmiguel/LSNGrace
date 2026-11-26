import type { Scene } from '../../core/scene/types';
import { immutableRows } from '../../core/scene/immutableRows';
const samples = new WeakMap<number[][], number[][]>();
/** Preview only: keep endpoints and extrema in source order. Never modify/export sampled data. */
export function zoomRows(rows: number[][]): number[][] {
  if (rows.length <= 2400) return rows;
  if (immutableRows(rows)) {
    const cached = samples.get(rows);
    if (cached) return cached;
  }
  const result: number[][] = [],
    stride = Math.ceil(rows.length / 600);
  for (let start = 0; start < rows.length; start += stride) {
    const end = Math.min(rows.length, start + stride);
    let low = start,
      high = start;
    for (let i = start + 1; i < end; i++) {
      if (rows[i][1] - Math.abs(rows[i][2] ?? 0) < rows[low][1] - Math.abs(rows[low][2] ?? 0))
        low = i;
      if (rows[i][1] + Math.abs(rows[i][2] ?? 0) > rows[high][1] + Math.abs(rows[high][2] ?? 0))
        high = i;
    }
    for (const i of [...new Set([start, low, high, end - 1])].sort((a, b) => a - b))
      result.push(rows[i]);
  }
  if (immutableRows(rows)) samples.set(rows, result);
  return result;
}
/** Fast feedback only for a coordinate change; the native result remains authoritative. */
export function canLiveZoom(previous: Scene, next: Scene): boolean {
  if (
    previous === next ||
    previous.page !== next.page ||
    previous.colors !== next.colors ||
    previous.graphs.length !== next.graphs.length
  )
    return false;
  if (
    next.annotations.length ||
    next.compatibility.preserved.some((d) => /^@\s*with\s+(string|line|box|ellipse)\b/i.test(d.raw))
  )
    return false;
  let changed = false;
  for (let i = 0; i < next.graphs.length; i++) {
    const a = previous.graphs[i],
      b = next.graphs[i];
    if (
      b.grid ||
      (b.legend.columns ?? 1) > 1 ||
      b.legend.layout === 'horizontal' ||
      (b.legend.symbolScale ?? 1) !== 1 ||
      (b.legend.box.fill.opacity ?? 1) < 1
    )
      return false;
    if (
      a.title !== b.title ||
      a.subtitle !== b.subtitle ||
      a.frame !== b.frame ||
      a.axes.xaxis.label !== b.axes.xaxis.label ||
      a.axes.yaxis.label !== b.axes.yaxis.label
    )
      return false;
    if (
      a.legend.font !== b.legend.font ||
      a.legend.size !== b.legend.size ||
      a.legend.color !== b.legend.color ||
      a.legend.enabled !== b.legend.enabled ||
      a.legend.box !== b.legend.box ||
      a.legend.length !== b.legend.length ||
      a.legend.hgap !== b.legend.hgap ||
      a.legend.vgap !== b.legend.vgap
    )
      return false;
    if (
      a.id !== b.id ||
      a.sets !== b.sets ||
      a.hidden !== b.hidden ||
      a.enabled !== b.enabled ||
      b.annotations.length ||
      b.type !== 'XY' ||
      b.axes.altxaxis.enabled ||
      b.axes.altyaxis.enabled
    )
      return false;
    if (
      Math.abs(a.viewport[2] - a.viewport[0] - (b.viewport[2] - b.viewport[0])) > 1e-9 ||
      Math.abs(a.viewport[3] - a.viewport[1] - (b.viewport[3] - b.viewport[1])) > 1e-9
    )
      return false;
    if (
      b.sets.some(
        (s) =>
          !s.hidden && (!['xy', 'xydy'].includes(s.type) || s.line.connection > 4 || s.fill.type),
      )
    )
      return false;
    if (b.legend.enabled && b.sets.some((s) => !s.hidden && s.legend) && !b.legend.box.fill.pattern)
      return false;
    if (
      ['xaxis', 'yaxis'].some((key) => {
        const axis = b.axes[key as 'xaxis' | 'yaxis'];
        return (
          axis.zero ||
          axis.offset?.some((v) => v !== 0) ||
          axis.tickLabels.skip ||
          axis.tickLabels.stagger ||
          axis.tickLabels.angle ||
          axis.tickLabels.place !== 'normal' ||
          axis.bar.style !== 1 ||
          axis.ticks.majorStroke.style !== 1 ||
          axis.ticks.minorStroke.style !== 1
        );
      })
    )
      return false;
    for (const axis of ['xaxis', 'yaxis'] as const)
      if (
        a.axes[axis].scale !== b.axes[axis].scale ||
        a.axes[axis].inverted !== b.axes[axis].inverted
      )
        return false;
    if (
      a.world.some((v, j) => v !== b.world[j]) ||
      a.viewport.some((v, j) => v !== b.viewport[j]) ||
      a.legend.position.some((v, j) => v !== b.legend.position[j]) ||
      a.legend.coordinates !== b.legend.coordinates
    )
      changed = true;
  }
  return changed;
}
