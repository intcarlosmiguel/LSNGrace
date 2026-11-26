import { current, isDraft } from 'immer';
import type { Graph, Scale } from '../scene/types';
import { autoscaleGraph } from './autoscale';
/** Compute valid bounds first: a failed log/reciprocal change never mutates the graph. */
export function setGraphScale(graph: Graph, axis: 'xaxis' | 'yaxis', scale: Scale): void {
  if (graph.axes[axis].scale === scale) return;
  const source = isDraft(graph) ? current(graph) : graph;
  const next: Graph = {
    ...source,
    axes: {
      ...source.axes,
      xaxis: { ...source.axes.xaxis, ticks: { ...source.axes.xaxis.ticks } },
      yaxis: { ...source.axes.yaxis, ticks: { ...source.axes.yaxis.ticks } },
    },
  };
  next.axes[axis].scale = scale;
  if (source.sets.some((s) => !s.hidden && s.rows.length)) autoscaleGraph(next);
  else {
    const i = axis === 'xaxis' ? 0 : 1;
    next.world = [...source.world];
    next.world[i] = scale === 'Normal' ? 0 : 1;
    next.world[i + 2] = scale === 'Normal' ? 1 : 10;
    next.axes[axis].ticks.major = scale === 'Logarithmic' ? 10 : scale === 'Reciprocal' ? 1 : 0.2;
  }
  graph.axes[axis].scale = scale;
  graph.world = next.world;
  graph.axes.xaxis.ticks.major = next.axes.xaxis.ticks.major;
  graph.axes.yaxis.ticks.major = next.axes.yaxis.ticks.major;
}
export function setGraphBorder(graph: Graph, visible: boolean) {
  graph.frame.style = visible ? graph.frame.style || 1 : 0;
}
/** A closed Grace frame draws over both axis bars, even when `axis bar off`. */
export function axisBarVisible(graph: Graph, axis: 'xaxis' | 'yaxis'): boolean {
  return (
    graph.axes[axis].bar.enabled ||
    (graph.frame.type === 0 && graph.frame.style !== 0 && graph.frame.pattern !== 0)
  );
}
export function setAxisBar(graph: Graph, axis: 'xaxis' | 'yaxis', visible: boolean): void {
  const other = axis === 'xaxis' ? 'yaxis' : 'xaxis';
  if (
    !visible &&
    graph.frame.type === 0 &&
    graph.frame.style !== 0 &&
    graph.frame.pattern !== 0 &&
    !graph.axes[other].bar.enabled
  ) {
    // An imported project may rely exclusively on the frame for the other pair
    // of sides. Preserve those sides using the same native stroke.
    graph.axes[other].bar = {
      enabled: true,
      color: graph.frame.color,
      width: graph.frame.width,
      style: graph.frame.style,
    };
  }
  graph.axes[axis].bar.enabled = visible;
  // Keep native axis bars as the single outline when hiding an edge. This also
  // exports faithfully to classic Grace without SVG-only masking or metadata.
  if (!visible && graph.frame.style !== 0) graph.frame.style = 0;
}
