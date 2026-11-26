import type { Graph, Legend, Stroke } from '../scene/types';
import { asciiJson } from '../text/latex';
export type GridPaint = Stroke & { opacity: number };
export type FigureStyle = { grid?: Graph['grid']; legend?: Legend & { entries: number[] } };
export function figureStyle(g: Graph): FigureStyle | undefined {
  const enhanced =
    g.legend.layout !== undefined ||
    g.legend.columns !== undefined ||
    g.legend.columnGap !== undefined ||
    g.legend.symbolScale !== undefined ||
    g.legend.box.fill.opacity !== undefined;
  return g.grid || enhanced
    ? {
        grid: g.grid,
        legend: enhanced
          ? { ...g.legend, entries: g.sets.filter((s) => !s.hidden && s.legend).map((s) => s.id) }
          : undefined,
      }
    : undefined;
}
export function figureMetadata(source: string): Map<number, FigureStyle> {
  const map = new Map<number, FigureStyle>();
  for (const m of source.matchAll(/^# LSNGrace figure G(\d+) (.+)$/gm)) {
    if (m[2].length > 32768) throw Error('Configuração visual muito grande.');
    const v = JSON.parse(m[2]) as FigureStyle;
    for (const p of [v.grid?.major, v.grid?.minor])
      if (
        p &&
        (![p.width, p.color, p.style, p.opacity].every(Number.isFinite) ||
          p.width < 0 ||
          p.opacity < 0 ||
          p.opacity > 1 ||
          !Number.isInteger(p.style) ||
          p.style < 0 ||
          p.style > 5)
      )
        throw Error('Estilo de grade inválido.');
    if (v.legend) {
      const l = v.legend;
      if (
        !Number.isInteger(l.columns ?? 1) ||
        (l.columns ?? 1) < 1 ||
        !Number.isFinite(l.symbolScale ?? 1) ||
        (l.symbolScale ?? 1) < 0 ||
        !Number.isFinite(l.columnGap ?? 16) ||
        (l.columnGap ?? 16) < 0 ||
        !Number.isFinite(l.box.fill.opacity ?? 1) ||
        (l.box.fill.opacity ?? 1) < 0 ||
        (l.box.fill.opacity ?? 1) > 1 ||
        !Array.isArray(l.entries) ||
        l.entries.some((id) => !Number.isInteger(id) || id < 0)
      )
        throw Error('Configuração de legenda inválida.');
    }
    map.set(+m[1], v);
  }
  return map;
}
export function figureComments(settings: Map<number, FigureStyle>) {
  return [...settings].map(([id, s]) => `# LSNGrace figure G${id} ${asciiJson(s)}`).join('\n');
}
