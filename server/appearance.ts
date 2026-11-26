import { palette } from '../src/core/scene/defaults';
export function alphaSettings(source: string) {
  const settings = new Map<string, { opacity: number; fill: number; raw: string }>();
  for (const match of source.matchAll(/^# LSNGrace alpha G(\d+)\.S(\d+) (\S+) (\S+)\s*$/gm)) {
    const opacity = Number(match[3]),
      fill = Number(match[4]);
    if ([opacity, fill].some((v) => !Number.isFinite(v) || v < 0 || v > 1))
      throw Error('Alpha deve estar entre 0 e 1.');
    settings.set(`${+match[1]}.${+match[2]}`, { opacity, fill, raw: match[0].trim() });
  }
  return settings;
}
/** Give alpha paints unique native colors so axes and opaque series never inherit their opacity. */
export function prepareAlpha(source: string, flatten = false) {
  const settings = alphaSettings(source),
    paints = new Map<string, { hex: string; alpha: number }>();
  if (!settings.size) return { source, paints };
  const colors = new Map<number, string>(palette.map((hex, id) => [id, hex]));
  for (const m of source.matchAll(/^@\s*map color (\d+) to \(\s*(\d+),\s*(\d+),\s*(\d+)\)/gm))
    colors.set(
      +m[1],
      [m[2], m[3], m[4]]
        .map((v) => (+v).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
    );
  const used = new Set(colors.values()),
    definitions: string[] = [],
    reused = new Map<string, number>();
  const background =
    colors.get(Number(source.match(/^@\s*background color (\d+)/m)?.[1] ?? 0)) ?? 'FFFFFF';
  let next = Math.max(...colors.keys()) + 1,
    token = 0x01f001,
    graph = -1;
  const patched = source
    .split('\n')
    .map((line) => {
      const context = line.match(/^@\s*with g(\d+)\s*$/i);
      if (context) {
        graph = +context[1];
        return line;
      }
      const match = line.match(
        /^(@\s*s(\d+) (line color|symbol color|symbol fill color|fill color|errorbar color) )([0-9]+)\s*$/i,
      );
      if (!match) return line;
      const setting = settings.get(`${graph}.${+match[2]}`);
      if (!setting) return line;
      const alpha =
        setting.opacity * (match[3].toLowerCase() === 'symbol fill color' ? setting.fill : 1);
      if (alpha === 1) return line;
      const hex = colors.get(+match[4]) ?? '000000',
        key = hex + ':' + alpha;
      let id = reused.get(key);
      if (id === undefined) {
        id = next++;
        reused.set(key, id);
        let native: string;
        if (flatten)
          native = [0, 2, 4]
            .map((i) =>
              Math.round(
                parseInt(hex.slice(i, i + 2), 16) * alpha +
                  parseInt(background.slice(i, i + 2), 16) * (1 - alpha),
              )
                .toString(16)
                .padStart(2, '0'),
            )
            .join('')
            .toUpperCase();
        else {
          do {
            native = (token++).toString(16).padStart(6, '0').toUpperCase();
          } while (used.has(native));
          used.add(native);
          paints.set(native, { hex, alpha });
        }
        const rgb = [0, 2, 4].map((i) => parseInt(native.slice(i, i + 2), 16));
        definitions.push(`@map color ${id} to (${rgb.join(', ')}), "LSNAlpha${id}"`);
      }
      return match[1] + id;
    })
    .join('\n');
  return { source: definitions.join('\n') + '\n' + patched + '\n', paints };
}
export function applyAlpha(
  svg: string,
  paints: Map<string, { hex: string; alpha: number }>,
): string {
  return svg.replace(
    /\bstyle="([^"]*)"/g,
    (_attribute, style: string) =>
      'style="' +
      style.replace(/\b(fill|stroke):\s*#([\da-f]{6})/gi, (property, name: string, hex: string) => {
        const paint = paints.get(hex.toUpperCase());
        return paint ? `${name}:#${paint.hex};${name}-opacity:${paint.alpha}` : property;
      }) +
      '"',
  );
}
