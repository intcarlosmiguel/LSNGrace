import type { Scene } from '../../core/scene/types';
/** Use the original Grace PNG driver for dense on-screen figures. Export stays vector. */
export function previewFormat(scene: Scene): 'svg' | 'png' {
  let points = 0;
  for (const graph of scene.graphs) {
    if (!graph.enabled || graph.hidden) continue;
    for (const set of graph.sets) {
      if (!set.hidden) points += set.rows.length;
      if (points >= 100_000) return 'png';
    }
  }
  return 'svg';
}
export function rasterPreview(scene: Scene, url: string): string {
  const [width, height] = scene.page.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico renderizado pelo Grace original"><image href="${url}" width="${width}" height="${height}"/></svg>`;
}
