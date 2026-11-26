import type { Graph, Point, Scene, Bounds } from '../../core/scene/types';
import { graphBox } from '../../core/geometry/coordinates';
import { graphParents } from '../composition/layout';
import { snapBox } from './guides';
/** Translate a viewport, leaving data/worlds untouched; moving descendants are not targets. */
export function graphMove(
  scene: Scene,
  graph: Graph,
  from: Point,
  to: Point,
  tolerance: number,
  free = false,
) {
  const unit = Math.min(...scene.page.size),
    original = graphBox(scene, graph.viewport);
  const box = {
    x: original.left + to[0] - from[0],
    y: original.top + to[1] - from[1],
    width: original.width,
    height: original.height,
  };
  const parents = graphParents(scene);
  const moving = (id: number) => {
    let current: number | undefined = id;
    while (current !== undefined) {
      if (current === graph.id) return true;
      current = parents.get(current);
    }
    return false;
  };
  const targets = scene.graphs
    .filter((g) => g.enabled && !g.hidden && !moving(g.id))
    .map((g) => {
      const b = graphBox(scene, g.viewport);
      return { x: b.left, y: b.top, width: b.width, height: b.height };
    });
  targets.push({ x: 0, y: 0, width: scene.page.size[0], height: scene.page.size[1] });
  const result = free ? { box, guides: [] } : snapBox(box, targets, tolerance);
  const dx = (result.box.x - original.left) / unit,
    dy = -(result.box.y - original.top) / unit;
  return { ...result, bounds: graph.viewport.map((v, i) => v + (i % 2 === 0 ? dx : dy)) as Bounds };
}
