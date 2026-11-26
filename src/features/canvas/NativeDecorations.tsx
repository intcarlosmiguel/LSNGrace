import { graphBox } from '../../core/geometry/coordinates';
import type { Scene } from '../../core/scene/types';
import type { CanvasCamera } from './camera';
import type { HitBox } from './nativeTextTargets';
import { estimatedLegendBox, legendAnchor } from './guides';
export const nativeTextId = (id: string, key: string) => `${id}-${key.replace(/[^\w-]/g, '-')}`;
/** Reuse original native glyphs and legend artwork, instead of approximating them on Canvas. */
export function NativeDecorations({
  id,
  scene,
  renderedScene,
  camera,
  boxes,
}: {
  id: string;
  scene: Scene;
  renderedScene: Scene;
  camera: CanvasCamera;
  boxes: Record<string, HitBox>;
}) {
  const color = (index: number) =>
    `rgb(${renderedScene.colors.find((c) => c.id === index)?.rgb.join(',') ?? '0,0,0'})`;
  return (
    <svg
      className="live-native-decorations"
      viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
      aria-hidden="true"
    >
      {scene.graphs
        .filter((g) => g.enabled && !g.hidden)
        .map((g) => {
          const previous = renderedScene.graphs.find((p) => p.id === g.id);
          if (!previous) return null;
          const [beforeX, beforeY] = legendAnchor(renderedScene, previous),
            [afterX, afterY] = legendAnchor(scene, g);
          const box =
              boxes[`${g.id}:legend-art`] ??
              boxes[`${g.id}:legend`] ??
              estimatedLegendBox(renderedScene, previous),
            clip = `${id}-legend-${g.id}`;
          const labels = [
            ['title', previous.title.color],
            ['subtitle', previous.subtitle.color],
            ['xlabel', previous.axes.xaxis.label.color],
            ['ylabel', previous.axes.yaxis.label.color],
          ] as const;
          return (
            <g key={g.id}>
              <g
                transform={`translate(${graphBox(scene, g.viewport).left - graphBox(renderedScene, previous.viewport).left},${graphBox(scene, g.viewport).top - graphBox(renderedScene, previous.viewport).top}) translate(0,${renderedScene.page.size[1]}) scale(1,-1)`}
              >
                {labels
                  .filter(([kind]) => boxes[`${g.id}:${kind}`])
                  .map(([kind, c]) => (
                    <use
                      key={kind}
                      href={`#${nativeTextId(id, `${g.id}:${kind}`)}`}
                      fill={color(c)}
                    />
                  ))}
              </g>
              {g.legend.enabled && g.sets.some((s) => !s.hidden && s.legend) && (
                <g transform={`translate(${afterX - beforeX},${afterY - beforeY})`}>
                  <defs>
                    <clipPath id={clip}>
                      <rect x={box.x} y={box.y} width={box.width} height={box.height} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clip})`}>
                    <use
                      href={`#${id}`}
                      x={camera.x}
                      y={camera.y}
                      width={camera.width}
                      height={camera.height}
                    />
                  </g>
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}
