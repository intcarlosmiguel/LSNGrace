import { nativeTextId } from './NativeDecorations';
import { legendAnchor } from './guides';
import type { Scene } from '../../core/scene/types';
import { graphBox } from '../../core/geometry/coordinates';
import { cameraPoint, type CanvasCamera } from './camera';
export type HitBox = { x: number; y: number; width: number; height: number };
/** Read native text metrics once per displayed SVG, never during pointer motion. */
export function nativeTextTargets(
  paper: HTMLElement,
  scene: Scene,
  camera: CanvasCamera,
  nativeId?: string,
): Record<string, HitBox> {
  const bounds = paper.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return {};
  const texts = [...paper.querySelectorAll<SVGTextElement>('.svg-page text')];
  const boxes: Record<string, HitBox> = {},
    unit = Math.min(...scene.page.size);
  const matching = (text: string, x: number, y: number) => {
    const expected = {
      x: bounds.left + ((x - camera.x) * bounds.width) / camera.width,
      y: bounds.top + ((y - camera.y) * bounds.height) / camera.height,
    };
    return texts
      .filter((t) => t.textContent === text)
      .map((t) => ({ node: t, rect: t.getBoundingClientRect() }))
      .filter(({ rect: r }) => r.width && r.height)
      .sort(
        (a, b) =>
          Math.hypot(
            a.rect.left + a.rect.width / 2 - expected.x,
            a.rect.top + a.rect.height / 2 - expected.y,
          ) -
          Math.hypot(
            b.rect.left + b.rect.width / 2 - expected.x,
            b.rect.top + b.rect.height / 2 - expected.y,
          ),
      )[0];
  };
  const record = (key: string, r: { left: number; top: number; right: number; bottom: number }) => {
    const [x, y] = cameraPoint(camera, bounds, r.left, r.top),
      [right, bottom] = cameraPoint(camera, bounds, r.right, r.bottom);
    boxes[key] = { x: x - 4, y: y - 3, width: right - x + 8, height: bottom - y + 6 };
  };
  for (const g of scene.graphs) {
    const b = graphBox(scene, g.viewport),
      cx = (b.left + b.right) / 2,
      cy = (b.top + b.bottom) / 2;
    for (const [kind, value, x, y] of [
      ['title', g.title.text, cx, b.top - unit * 0.08],
      ['subtitle', g.subtitle.text, cx, b.top - unit * 0.035],
      ['xlabel', g.axes.xaxis.label.text, cx, b.bottom + unit * 0.06],
      ['ylabel', g.axes.yaxis.label.text, b.left - unit * 0.08, cy],
    ] as const) {
      if (!value) continue;
      const semantic = `g${g.id}.${kind === 'xlabel' ? 'xaxis.label' : kind === 'ylabel' ? 'yaxis.label' : kind}`;
      const math = paper.querySelector<SVGElement>(`[data-lsn-text="${semantic}"]`);
      const match = matching(value, x, y),
        node = math ?? match?.node,
        r = math?.getBoundingClientRect() ?? match?.rect;
      if (r) {
        record(`${g.id}:${kind}`, r);
        if (nativeId && node) node.id = nativeTextId(nativeId, `${g.id}:${kind}`);
      }
    }
    if (g.legend.enabled) {
      const [lx, ly] = legendAnchor(scene, g);
      const legend = g.sets
        .filter((s) => !s.hidden && s.legend)
        .map(
          (s, i) =>
            paper
              .querySelector<SVGElement>(`[data-lsn-text="g${g.id}.s${s.id}.legend"]`)
              ?.getBoundingClientRect() ??
            matching(s.legend, lx + unit * 0.1, ly + unit * 0.04 * i)?.rect,
        )
        .filter((r): r is DOMRect => !!r);
      if (legend.length) {
        const left = bounds.left + ((lx - camera.x) * bounds.width) / camera.width,
          top = bounds.top + ((ly - camera.y) * bounds.height) / camera.height;
        record(`${g.id}:legend`, {
          left: left - 6,
          top: top - 6,
          right: Math.max(...legend.map((r) => r.right)) + 6,
          bottom: Math.max(...legend.map((r) => r.bottom)) + 6,
        });
        const textBounds = {
          left: Math.min(...legend.map((r) => r.left)),
          top: Math.min(...legend.map((r) => r.top)),
          right: Math.max(...legend.map((r) => r.right)),
          bottom: Math.max(...legend.map((r) => r.bottom)),
        };
        const candidates = [...paper.querySelectorAll<SVGPathElement>('.svg-page path')]
          .filter((path) => {
            const d = path.getAttribute('d') ?? '';
            return (
              d.length < 220 &&
              /^M/i.test(d) &&
              /z$/i.test(d) &&
              (d.match(/L/gi)?.length ?? 0) === 3
            );
          })
          .filter((path) => {
            const nums = (
              path.getAttribute('d')!.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
            ).map(Number);
            return (
              nums.length === 8 &&
              Math.max(nums[0], nums[2], nums[4], nums[6]) -
                Math.min(nums[0], nums[2], nums[4], nums[6]) >
                20
            );
          })
          .map((path) => path.getBoundingClientRect())
          .filter(
            (r) =>
              r.left <= left + 2 &&
              r.top <= top + 4 &&
              r.left <= textBounds.left &&
              r.top <= textBounds.top &&
              r.right >= textBounds.right &&
              r.bottom >= textBounds.bottom,
          )
          .sort((a, b) => a.width * a.height - b.width * b.height);
        if (candidates[0]) {
          const r = candidates[0],
            [x, y] = cameraPoint(camera, bounds, r.left, r.top),
            [right, bottom] = cameraPoint(camera, bounds, r.right, r.bottom);
          boxes[`${g.id}:legend-box`] = { x, y, width: right - x, height: bottom - y };
          boxes[`${g.id}:legend-art`] = {
            x: x - 0.6,
            y: y - 0.6,
            width: right - x + 1.2,
            height: bottom - y + 1.2,
          };
        }
      }
    }
  }
  return boxes;
}
