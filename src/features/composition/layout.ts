import { createGraph } from '../../core/scene/defaults';
import type { Bounds, Graph, Scene } from '../../core/scene/types';
export type Placement = 'beside' | 'below' | 'inset';
export type Arrangement = 'row' | 'column' | 'grid';
const area = (v: Bounds) => (v[2] - v[0]) * (v[3] - v[1]);
/** Grace stores all graphs on the page; containment is derived from viewports. */
export function graphParents(scene: Scene): Map<number, number> {
  const result = new Map<number, number>();
  for (const child of scene.graphs) {
    const c = child.viewport;
    const parent = scene.graphs
      .filter((g) => {
        const p = g.viewport;
        return (
          g.id !== child.id &&
          area(p) > area(c) + 1e-9 &&
          p[0] <= c[0] + 1e-9 &&
          p[1] <= c[1] + 1e-9 &&
          p[2] >= c[2] - 1e-9 &&
          p[3] >= c[3] - 1e-9
        );
      })
      .sort((a, b) => area(a.viewport) - area(b.viewport))[0];
    if (parent) result.set(child.id, parent.id);
  }
  return result;
}
function transformGraph(g: Graph, from: Bounds, to: Bounds) {
  const x = (v: number) => to[0] + ((v - from[0]) * (to[2] - to[0])) / (from[2] - from[0]);
  const y = (v: number) => to[1] + ((v - from[1]) * (to[3] - to[1])) / (from[3] - from[1]);
  g.viewport = [x(g.viewport[0]), y(g.viewport[1]), x(g.viewport[2]), y(g.viewport[3])];
  if (g.legend.coordinates === 'view')
    g.legend.position = [x(g.legend.position[0]), y(g.legend.position[1])];
  for (const a of g.annotations) {
    if (a.coordinates !== 'view') continue;
    if ('position' in a) a.position = [x(a.position[0]), y(a.position[1])];
    else a.bounds = [x(a.bounds[0]), y(a.bounds[1]), x(a.bounds[2]), y(a.bounds[3])];
  }
}
export function moveViewport(scene: Scene, id: number, bounds: Bounds) {
  const graph = scene.graphs.find((g) => g.id === id);
  if (!graph) throw Error('Gráfico não encontrado.');
  if (bounds.some((n) => !Number.isFinite(n)) || bounds[2] <= bounds[0] || bounds[3] <= bounds[1])
    throw Error('A área do gráfico precisa ter largura e altura positivas.');
  const parents = graphParents(scene),
    from = [...graph.viewport] as Bounds;
  const belongs = (g: Graph) => {
    let parent: number | undefined = g.id;
    while (parent !== undefined) {
      if (parent === id) return true;
      parent = parents.get(parent);
    }
    return false;
  };
  for (const g of scene.graphs.filter(belongs)) transformGraph(g, from, bounds);
}
export function arrangeGraphs(scene: Scene, layout: Arrangement) {
  const parents = graphParents(scene),
    roots = scene.graphs.filter((g) => !parents.has(g.id));
  const count = roots.length;
  if (!count) return;
  const columns = layout === 'row' ? count : layout === 'column' ? 1 : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns),
    unit = Math.min(...scene.page.size);
  const [w, h] = scene.page.size.map((n) => n / unit);
  const cellW = w / columns,
    cellH = h / rows;
  // Snapshot membership before changing any viewport: geometric containment can change mid-layout.
  const plans = roots.map((g, i) => {
    const col = i % columns,
      row = Math.floor(i / columns);
    const to: Bounds = [
      col * cellW + cellW * 0.18,
      h - (row + 1) * cellH + cellH * 0.18,
      (col + 1) * cellW - cellW * 0.08,
      h - row * cellH - cellH * 0.17,
    ];
    const members = scene.graphs.filter((item) => {
      let id: number | undefined = item.id;
      while (id !== undefined) {
        if (id === g.id) return true;
        id = parents.get(id);
      }
      return false;
    });
    return { from: [...g.viewport] as Bounds, to, members };
  });
  for (const p of plans) for (const g of p.members) transformGraph(g, p.from, p.to);
}
export function addGraph(scene: Scene, anchorId: number, placement: Placement): number {
  const id = Math.max(-1, ...scene.graphs.map((g) => g.id)) + 1;
  const g = createGraph(id),
    parent = scene.graphs.find((g) => g.id === anchorId);
  g.title.text = `Gráfico ${id + 1}`;
  if (placement === 'inset' && parent) {
    const p = parent.viewport,
      w = p[2] - p[0],
      h = p[3] - p[1];
    g.viewport = [p[0] + w * 0.53, p[1] + h * 0.52, p[0] + w * 0.94, p[1] + h * 0.93];
    g.title.size = 0.8;
    g.legend.size = 0.65;
    for (const axis of Object.values(g.axes)) {
      axis.tickLabels.size = 0.65;
      axis.label.size = 0.75;
    }
    g.frame.background.pattern = 1;
    g.frame.background.color = scene.page.background;
  } else {
    // Place outside existing viewports temporarily so it cannot be mistaken for an inset.
    g.viewport = [-2, -2, -1, -1];
  }
  g.legend.position = [
    g.viewport[0] + (g.viewport[2] - g.viewport[0]) * 0.05,
    g.viewport[3] - (g.viewport[3] - g.viewport[1]) * 0.08,
  ];
  scene.graphs.push(g);
  if (placement !== 'inset' || !parent)
    arrangeGraphs(scene, placement === 'below' ? 'column' : 'row');
  return id;
}
export function resizeImage(scene: Scene, width: number, height: number) {
  if (![width, height].every((v) => Number.isFinite(v) && v > 0 && v <= 4096))
    throw Error('Use dimensões de imagem entre 1 e 4096 pt.');
  const oldUnit = Math.min(...scene.page.size),
    unit = Math.min(width, height);
  const sx = ((width / scene.page.size[0]) * oldUnit) / unit,
    sy = ((height / scene.page.size[1]) * oldUnit) / unit;
  for (const g of scene.graphs) {
    g.viewport = [g.viewport[0] * sx, g.viewport[1] * sy, g.viewport[2] * sx, g.viewport[3] * sy];
    if (g.legend.coordinates === 'view')
      g.legend.position = [g.legend.position[0] * sx, g.legend.position[1] * sy];
  }
  for (const a of [...scene.annotations, ...scene.graphs.flatMap((g) => g.annotations)]) {
    if (a.coordinates !== 'view') continue;
    if ('position' in a) a.position = [a.position[0] * sx, a.position[1] * sy];
    else a.bounds = [a.bounds[0] * sx, a.bounds[1] * sy, a.bounds[2] * sx, a.bounds[3] * sy];
  }
  scene.page.size = [width, height];
}
export function removeGraph(scene: Scene, id: number) {
  scene.graphs = scene.graphs.filter((g) => g.id !== id);
  scene.annotations = scene.annotations.filter((a) => a.graphId !== id);
  scene.compatibility.preserved = scene.compatibility.preserved.filter((d) => d.graphId !== id);
  if (!scene.graphs.length) scene.graphs.push(createGraph(0));
}
