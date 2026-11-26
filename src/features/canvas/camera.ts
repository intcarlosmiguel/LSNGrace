import type { Scene } from '../../core/scene/types';
import { graphBox } from '../../core/geometry/coordinates';
import { hasLatex } from '../../core/text/latex';
export interface CanvasCamera {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** A presentation camera only: no world, viewport or export parameters are changed. */
export function canvasCamera(scene: Scene, wholePage = false): CanvasCamera {
  const [width, height] = scene.page.size;
  const page = { x: 0, y: 0, width, height };
  const graphs = scene.graphs.filter((g) => g.enabled && !g.hidden);
  // Annotations may lie outside the viewports; retain the full page in that case.
  if (
    wholePage ||
    !graphs.length ||
    scene.annotations.length ||
    graphs.some((g) => g.annotations.length) ||
    scene.compatibility.preserved.some((d) =>
      /^@\s*with\s+(?:string|box|ellipse|line)\b/i.test(d.raw),
    )
  )
    return page;
  const unit = Math.min(width, height);
  let left = width,
    right = 0,
    top = height,
    bottom = 0;
  for (const graph of graphs) {
    const box = graphBox(scene, graph.viewport);
    left = Math.min(left, box.left - unit * 0.115);
    right = Math.max(right, box.right + unit * 0.035);
    top = Math.min(
      top,
      box.top -
        unit * (graph.title.text ? (hasLatex(graph.title.text) ? 0.12 : 0.09) : 0.035) -
        (graph.subtitle.text ? unit * 0.025 : 0),
    );
    bottom = Math.max(bottom, box.bottom + unit * 0.1);
    if (
      graph.legend.enabled &&
      graph.legend.coordinates === 'view' &&
      graph.sets.some((s) => !s.hidden && s.legend)
    ) {
      const x = graph.legend.position[0] * unit,
        y = height - graph.legend.position[1] * unit;
      right = Math.max(
        right,
        x +
          unit *
            (0.07 +
              Math.max(...graph.sets.map((s) => s.legend.length)) * graph.legend.size * 0.0145),
      );
      left = Math.min(left, x - unit * 0.015);
      top = Math.min(top, y - unit * 0.03);
      bottom = Math.max(
        bottom,
        y +
          graph.sets.filter((s) => !s.hidden && s.legend).length * graph.legend.size * unit * 0.04,
      );
    }
  }
  left = Math.max(0, left);
  right = Math.min(width, right);
  top = Math.max(0, top);
  bottom = Math.min(height, bottom);
  if (!(right > left) || !(bottom > top)) return page;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function cameraPoint(
  camera: CanvasCamera,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): [number, number] {
  return [
    camera.x + ((clientX - rect.left) * camera.width) / rect.width,
    camera.y + ((clientY - rect.top) * camera.height) / rect.height,
  ];
}
export function framedSvg(source: string, camera: CanvasCamera): string {
  // Only the root viewBox changes; the original native SVG remains the export source.
  return source.replace(
    /(<svg\b[^>]*\bviewBox=")[^"]*(")/i,
    `$1${camera.x} ${camera.y} ${camera.width} ${camera.height}$2`,
  );
}
