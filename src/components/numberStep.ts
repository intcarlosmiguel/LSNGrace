/** Use explicit scientific-field increments, with a useful default for free numeric input. */
export function stepNumber(
  value: number,
  direction: -1 | 1,
  step = 'any',
  min?: number,
  max?: number,
): number {
  const parsed = Number(step);
  const increment = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const next = Number((value + direction * increment).toPrecision(14));
  return Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next));
}
