import type { Bounds, Graph, Scene, Point } from '../../core/scene/types';
/** Delta-based resizing avoids jumping from the grabbed handle edge to its center. */
export function resizeGraphBounds(
  scene: Scene,
  graph: Graph,
  corner: number,
  start: Point,
  current: Point,
  proportional = false,
  centered = false,
): Bounds {
  const v = graph.viewport,
    unit = Math.min(...scene.page.size),
    left = corner % 2 === 0,
    bottom = corner < 2;
  const dx = (current[0] - start[0]) / unit,
    dy = -(current[1] - start[1]) / unit;
  const ow = v[2] - v[0],
    oh = v[3] - v[1],
    multiplier = centered ? 2 : 1,
    min = 2 / unit;
  let w = Math.max(min, ow + (left ? -dx : dx) * multiplier),
    h = Math.max(min, oh + (bottom ? -dy : dy) * multiplier);
  if (proportional) {
    const factor = Math.max(
      min / ow,
      min / oh,
      Math.abs(w / ow - 1) >= Math.abs(h / oh - 1) ? w / ow : h / oh,
    );
    w = ow * factor;
    h = oh * factor;
  }
  const ax = centered ? (v[0] + v[2]) / 2 : left ? v[2] : v[0],
    ay = centered ? (v[1] + v[3]) / 2 : bottom ? v[3] : v[1];
  return centered
    ? [ax - w / 2, ay - h / 2, ax + w / 2, ay + h / 2]
    : [left ? ax - w : ax, bottom ? ay - h : ay, left ? ax : ax + w, bottom ? ay : ay + h];
}
