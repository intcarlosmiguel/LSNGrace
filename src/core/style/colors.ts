import type { Scene } from '../scene/types';
export function hexColor(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}
/** Reuse indexed RGB values; never recolor another dataset through a shared entry. */
export function resolveColor(scene: Scene, value: number | string): number {
  if (typeof value === 'number') {
    if (!scene.colors.some((c) => c.id === value)) throw Error('Cor inexistente.');
    return value;
  }
  if (!/^#[\da-f]{6}$/i.test(value)) throw Error('Use uma cor no formato #RRGGBB.');
  const rgb = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
  const existing = scene.colors.find((c) => c.rgb.every((v, i) => v === rgb[i]));
  if (existing) return existing.id;
  const id = Math.max(15, ...scene.colors.map((c) => c.id)) + 1;
  scene.colors.push({ id, rgb, name: value.toUpperCase() });
  return id;
}
