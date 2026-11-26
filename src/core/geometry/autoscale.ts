import { current, isDraft } from 'immer';
import type { Graph, Scale } from '../scene/types';
const niceStep = (span: number) => {
  const power = 10 ** Math.floor(Math.log10(span / 6));
  const fraction = span / 6 / power;
  return ([1, 2, 2.5, 5, 10].find((n) => n >= fraction) ?? 10) * power;
};
const clean = (v: number) => Number(v.toPrecision(12));
/** Fit visible data, including XYDY extents. Never mutate the input on failure. */
export function autoscaleGraph(graph: Graph): void {
  const ranges: { low: number; high: number; scale: Scale }[] = [
    graph.axes.xaxis,
    graph.axes.yaxis,
  ].map((axis) => ({ low: Infinity, high: -Infinity, scale: axis.scale }));
  const add = (i: number, value: number) => {
    const range = ranges[i];
    if (
      !Number.isFinite(value) ||
      (range.scale === 'Logarithmic' && value <= 0) ||
      (range.scale === 'Reciprocal' && value === 0)
    )
      return;
    range.low = Math.min(range.low, value);
    range.high = Math.max(range.high, value);
  };
  // Read immutable data directly instead of creating an Immer proxy for every point.
  const source = isDraft(graph) ? current(graph) : graph;
  for (const set of source.sets)
    if (!set.hidden && ['xy', 'xydy'].includes(set.type))
      for (const row of set.rows) {
        // Bounds must come from drawable coordinate pairs.
        if (
          !Number.isFinite(row[0]) ||
          !Number.isFinite(row[1]) ||
          (ranges[0].scale === 'Logarithmic' && row[0] <= 0) ||
          (ranges[1].scale === 'Logarithmic' && row[1] <= 0) ||
          (ranges[0].scale === 'Reciprocal' && row[0] === 0) ||
          (ranges[1].scale === 'Reciprocal' && row[1] === 0)
        )
          continue;
        add(0, row[0]);
        add(1, row[1]);
        if (set.type === 'xydy' && set.errorBars.enabled) {
          add(1, row[1] - Math.abs(row[2]));
          add(1, row[1] + Math.abs(row[2]));
        }
      }
  const fitted = ranges.map(({ low, high, scale }, i) => {
    if (!Number.isFinite(low) || !Number.isFinite(high))
      throw Error(`Sem dados válidos para ajustar o eixo ${i ? 'Y' : 'X'}.`);
    if (scale === 'Logarithmic') {
      const lower = Math.floor(Math.log10(low)),
        upper = Math.ceil(Math.log10(high));
      return {
        min: 10 ** (lower === upper ? lower - 1 : lower),
        max: 10 ** (lower === upper ? upper + 1 : upper),
        step: 10,
      };
    }
    if (scale === 'Reciprocal' && low * high <= 0)
      throw Error('A escala recíproca não pode atravessar zero. Escolha outra escala.');
    const padding = (high - low || Math.abs(low) * 0.2 || 1) * 0.06;
    const step = niceStep(high - low + 2 * padding);
    let min = low - padding,
      max = high + padding;
    if (scale === 'Reciprocal') {
      if (low > 0 && min <= 0) min = low * 0.8;
      if (high < 0 && max >= 0) max = high * 0.8;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max) || !(step > 0))
      throw Error('Os dados excedem o intervalo numérico suportado.');
    return { min: clean(min), max: clean(max), step: clean(step) };
  });
  graph.world = [fitted[0].min, fitted[1].min, fitted[0].max, fitted[1].max];
  graph.axes.xaxis.ticks.major = fitted[0].step;
  graph.axes.yaxis.ticks.major = fitted[1].step;
}
