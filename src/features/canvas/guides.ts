import type { Graph, Point, Scene } from '../../core/scene/types';
import { graphBox, normalized } from '../../core/geometry/coordinates';
import { worldAt } from './interactions';
import type { HitBox } from './nativeTextTargets';
export type SmartGuide = { axis: 'x' | 'y'; position: number; from: number; to: number };
export function legendAnchor(scene: Scene, graph: Graph): Point {
  const unit = Math.min(...scene.page.size),
    b = graphBox(scene, graph.viewport);
  return graph.legend.coordinates === 'view'
    ? [graph.legend.position[0] * unit, scene.page.size[1] - graph.legend.position[1] * unit]
    : [
        b.left +
          normalized(graph.legend.position[0], graph.world[0], graph.world[2], graph.axes.xaxis) *
            b.width,
        b.bottom -
          normalized(graph.legend.position[1], graph.world[1], graph.world[3], graph.axes.yaxis) *
            b.height,
      ];
}
export function setLegendAnchor(scene: Scene, graph: Graph, point: Point) {
  const unit = Math.min(...scene.page.size),
    b = graphBox(scene, graph.viewport);
  graph.legend.position =
    graph.legend.coordinates === 'view'
      ? [point[0] / unit, (scene.page.size[1] - point[1]) / unit]
      : worldAt(graph, (point[0] - b.left) / b.width, 1 - (point[1] - b.top) / b.height);
}
export function estimatedLegendBox(scene: Scene, g: Graph): HitBox {
  const unit = Math.min(...scene.page.size),
    [x, y] = legendAnchor(scene, g),
    sets = g.sets.filter((s) => !s.hidden && s.legend);
  return {
    x,
    y,
    width: Math.max(
      40,
      42 + Math.max(0, ...sets.map((s) => s.legend.length)) * g.legend.size * unit * 0.0145,
    ),
    height: Math.max(20, sets.length * g.legend.size * unit * 0.04 + unit * 0.015),
  };
}
/** Snap within a screen-sized tolerance, never to a coarse fixed page grid. */
export function snapLegend(scene: Scene, graphId: number, box: HitBox, tolerance: number) {
  const [width, height] = scene.page.size;
  const targets: { box: HitBox }[] = scene.graphs
    .filter((g) => g.enabled && !g.hidden)
    .map((g) => {
      const b = graphBox(scene, g.viewport);
      return { box: { x: b.left, y: b.top, width: b.width, height: b.height } };
    });
  for (const g of scene.graphs)
    if (g.id !== graphId && g.enabled && !g.hidden && g.legend.enabled)
      targets.push({ box: estimatedLegendBox(scene, g) });
  targets.push({ box: { x: 0, y: 0, width, height } });
  return snapBox(
    box,
    targets.map((t) => t.box),
    tolerance,
  );
}
export function snapBox(box: HitBox, targetBoxes: HitBox[], tolerance: number) {
  const guides: SmartGuide[] = [];
  const targets = targetBoxes.map((box) => ({ box }));
  let dx = 0,
    dy = 0;
  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? 'width' : 'height',
      other = axis === 'x' ? 'y' : 'x',
      otherSize = axis === 'x' ? 'height' : 'width';
    let best: { delta: number; position: number; from: number; to: number } | undefined;
    for (const target of targets)
      for (const sourceOffset of [0, 0.5, 1])
        for (const targetOffset of [0, 0.5, 1]) {
          const position = target.box[axis] + target.box[size] * targetOffset,
            delta = position - (box[axis] + box[size] * sourceOffset);
          if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta)))
            best = {
              delta,
              position,
              from: Math.min(target.box[other], box[other]) - 10,
              to:
                Math.max(target.box[other] + target.box[otherSize], box[other] + box[otherSize]) +
                10,
            };
        }
    if (best) {
      if (axis === 'x') dx = best.delta;
      else dy = best.delta;
      guides.push({ axis, position: best.position, from: best.from, to: best.to });
    }
  }
  return { box: { ...box, x: box.x + dx, y: box.y + dy }, guides };
}
