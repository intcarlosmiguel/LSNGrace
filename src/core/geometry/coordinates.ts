import type { Axis, Bounds, Scene } from '../scene/types';
export function viewportPoint(scene: Scene, x: number, y: number): [number, number] {
  const unit = Math.min(...scene.page.size);
  return [x * unit, scene.page.size[1] - y * unit];
}
export function scaled(value: number, axis: Pick<Axis, 'scale'>): number {
  return axis.scale === 'Logarithmic'
    ? value > 0
      ? Math.log10(value)
      : NaN
    : axis.scale === 'Reciprocal'
      ? value !== 0
        ? 1 / value
        : NaN
      : value;
}
export function normalized(
  value: number,
  min: number,
  max: number,
  axis: Pick<Axis, 'scale' | 'inverted'>,
): number {
  const a = scaled(min, axis),
    b = scaled(max, axis),
    t = (scaled(value, axis) - a) / (b - a);
  return axis.inverted ? 1 - t : t;
}
export function graphBox(scene: Scene, viewport: Bounds) {
  const [left, bottom] = viewportPoint(scene, viewport[0], viewport[1]);
  const [right, top] = viewportPoint(scene, viewport[2], viewport[3]);
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}
export interface Tick {
  value: number;
  major: boolean;
}
export function ticks(min: number, max: number, axis: Axis): Tick[] {
  const result: Tick[] = [],
    step = axis.ticks.major,
    minor = Math.min(100, Math.max(0, Math.floor(axis.ticks.minorCount)));
  if (!(max > min) || !(step > 0) || !Number.isFinite(step)) return result;
  if (axis.scale === 'Logarithmic') {
    if (min <= 0 || step <= 1) return result;
    const a = Math.floor(Math.log(min) / Math.log(step)),
      b = Math.ceil(Math.log(max) / Math.log(step));
    if (b - a > 2000) return result;
    for (let i = a; i <= b; i++) {
      const value = step ** i;
      if (value >= min * (1 - 1e-12) && value <= max * (1 + 1e-12))
        result.push({ value, major: true });
      for (let j = 1; j <= minor; j++) {
        const v = value + ((value * step - value) * j) / (minor + 1);
        if (v >= min && v <= max) result.push({ value: v, major: false });
      }
    }
  } else {
    const start = Math.floor(min / step),
      end = Math.ceil(max / step);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      end - start > 2000 ||
      end - start < 0
    )
      return result;
    for (let i = start; i <= end; i++)
      for (let j = 0; j <= minor; j++) {
        const value = (i + j / (minor + 1)) * step;
        if (value >= min - step * 1e-10 && value <= max + step * 1e-10)
          result.push({ value: Math.abs(value) < step * 1e-12 ? 0 : value, major: j === 0 });
      }
  }
  return result;
}
export function formatTick(value: number, axis: Axis): string {
  const p = Math.min(12, Math.max(0, Math.round(axis.tickLabels.precision)));
  let label: string;
  switch (axis.tickLabels.format) {
    case 'decimal':
      label = value.toFixed(p);
      break;
    case 'exponential':
      label = value.toExponential(p);
      break;
    case 'scientific': {
      const [m, e] = value.toExponential(p).split('e');
      label = `${m} × 10^${Number(e)}`;
      break;
    }
    case 'power':
      label =
        value > 0 ? `10^${Number(Math.log10(value).toPrecision(Math.max(1, p)))}` : String(value);
      break;
    default:
      label = String(Number(value.toPrecision(Math.max(1, p))));
  }
  return axis.tickLabels.prepend + label + axis.tickLabels.append;
}
