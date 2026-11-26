import type { Bounds, Graph, Scene } from '../../core/scene/types';
import { graphBox } from '../../core/geometry/coordinates';
import { graphParents } from '../composition/layout';
import type { SmartGuide } from './guides';
type Options = {
  corner: number;
  centered?: boolean;
  proportional?: boolean;
  tolerance: number;
  free?: boolean;
  direction?: number;
};
/** Resize one dimension (or one common scale) while preserving the original anchor. */
export function snapGraphResize(
  scene: Scene,
  graph: Graph,
  proposed: Bounds,
  options: Options,
): { bounds: Bounds; guides: SmartGuide[] } {
  if (options.free) return { bounds: proposed, guides: [] };
  const unit = Math.min(...scene.page.size),
    original = graphBox(scene, graph.viewport),
    box = graphBox(scene, proposed);
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
    .map((g) => graphBox(scene, g.viewport));
  targets.push({
    left: 0,
    top: 0,
    right: scene.page.size[0],
    bottom: scene.page.size[1],
    width: scene.page.size[0],
    height: scene.page.size[1],
  });
  const left = options.corner % 2 === 0,
    bottom = options.corner < 2;
  const anchor = {
    x: options.centered
      ? (original.left + original.right) / 2
      : left
        ? original.right
        : original.left,
    y: options.centered
      ? (original.top + original.bottom) / 2
      : bottom
        ? original.top
        : original.bottom,
  };
  const coefficient = (axis: 'x' | 'y', offset: number) =>
    options.centered
      ? offset - 0.5
      : axis === 'x'
        ? offset - (left ? 1 : 0)
        : offset - (bottom ? 0 : 1);
  let w = box.width,
    h = box.height;
  type Candidate = { axis: 'x' | 'y'; size: number; distance: number };
  const candidates: Candidate[] = [];
  for (const axis of ['x', 'y'] as const) {
    const dimension = axis === 'x' ? w : h;
    for (const target of targets)
      for (const offset of [0, 0.5, 1]) {
        const c = coefficient(axis, offset);
        if (!c) continue; // The fixed anchor must not prevent further resizing.
        for (const targetOffset of [0, 0.5, 1]) {
          const position =
            (axis === 'x' ? target.left : target.top) +
            (axis === 'x' ? target.width : target.height) * targetOffset;
          const distance = Math.abs(position - (anchor[axis] + c * dimension)),
            size = (position - anchor[axis]) / c;
          if (distance > options.tolerance || size < 2) continue;
          const dw = axis === 'x' ? size - w : options.proportional ? w * (size / h - 1) : 0;
          const dh = axis === 'y' ? size - h : options.proportional ? h * (size / w - 1) : 0;
          const maxMovement = Math.max(Math.abs(dw), Math.abs(dh)) * (options.centered ? 0.5 : 1);
          const nextW = axis === 'x' ? size : options.proportional ? (w * size) / h : w;
          const nextH = axis === 'y' ? size : options.proportional ? (h * size) / w : h;
          const progresses =
            !options.direction ||
            (options.direction > 0
              ? nextW > original.width + 1e-7 && nextH > original.height + 1e-7
              : nextW < original.width - 1e-7 && nextH < original.height - 1e-7);
          if (progresses && Math.min(nextW, nextH) >= 2 && maxMovement <= options.tolerance + 1e-9)
            candidates.push({ axis, size, distance });
        }
      }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  if (options.proportional) {
    const best = candidates[0];
    if (best) {
      const factor = best.size / (best.axis === 'x' ? w : h);
      w *= factor;
      h *= factor;
    }
  } else
    for (const axis of ['x', 'y'] as const) {
      const best = candidates.find((c) => c.axis === axis);
      if (best) {
        if (axis === 'x') w = best.size;
        else h = best.size;
      }
    }
  const x = anchor.x + coefficient('x', 0) * w,
    y = anchor.y + coefficient('y', 0) * h;
  const result = { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
  const guides: SmartGuide[] = [];
  // Show only alignments that actually exist after snapping, including unchanged edges/centers.
  for (const axis of ['x', 'y'] as const)
    for (const offset of [0, 0.5, 1]) {
      const position = (axis === 'x' ? result.left : result.top) + (axis === 'x' ? w : h) * offset;
      for (const target of targets)
        for (const targetOffset of [0, 0.5, 1]) {
          const targetPosition =
            (axis === 'x' ? target.left : target.top) +
            (axis === 'x' ? target.width : target.height) * targetOffset;
          if (Math.abs(position - targetPosition) > 1e-7) continue;
          const from =
            Math.min(
              axis === 'x' ? result.top : result.left,
              axis === 'x' ? target.top : target.left,
            ) - 8;
          const to =
            Math.max(
              axis === 'x' ? result.bottom : result.right,
              axis === 'x' ? target.bottom : target.right,
            ) + 8;
          const existing = guides.find(
            (g) => g.axis === axis && Math.abs(g.position - position) < 1e-7,
          );
          if (existing) {
            existing.from = Math.min(existing.from, from);
            existing.to = Math.max(existing.to, to);
          } else guides.push({ axis, position, from, to });
        }
    }
  return {
    bounds: [
      result.left / unit,
      (scene.page.size[1] - result.bottom) / unit,
      result.right / unit,
      (scene.page.size[1] - result.top) / unit,
    ],
    guides,
  };
}
