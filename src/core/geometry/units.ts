export type LengthUnit = 'pt' | 'px' | 'cm' | 'mm' | 'in' | '%';
export type FontUnit = LengthUnit | 'grace';
// CSS/reference pixels, independent of display scaling and export raster DPI.
const pointsPerUnit = { pt: 1, px: 72 / 96, cm: 72 / 2.54, mm: 72 / 25.4, in: 72 };
export function toPoints(value: number, unit: LengthUnit, percentBase: number): number {
  return unit === '%' ? (value * percentBase) / 100 : value * pointsPerUnit[unit];
}
export function fromPoints(value: number, unit: LengthUnit, percentBase: number): number {
  return unit === '%' ? (value / percentBase) * 100 : value / pointsPerUnit[unit];
}
/** Grace's native character scale: 1 = 2.8% of the shorter page side. */
export const fontBasePoints = (page: [number, number]) => Math.min(...page) * 0.028;
export function fontToDisplay(size: number, unit: FontUnit, page: [number, number]): number {
  return unit === 'grace'
    ? size
    : fromPoints(size * fontBasePoints(page), unit, fontBasePoints(page));
}
export function fontFromDisplay(value: number, unit: FontUnit, page: [number, number]): number {
  return unit === 'grace'
    ? value
    : toPoints(value, unit, fontBasePoints(page)) / fontBasePoints(page);
}
export const displayNumber = (n: number) => Number(n.toPrecision(10));
export const sameSize = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;
