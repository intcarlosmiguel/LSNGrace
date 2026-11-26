import { figureMetadata, type FigureStyle, type GridPaint } from '../src/core/style/figure';
import { palette } from '../src/core/scene/defaults';
type GridToken = { hex: string; original: string; paint: GridPaint; axis: string; view: number[] };
type LegendToken = {
  id: number;
  style: NonNullable<FigureStyle['legend']>;
  fill: string;
  border: string;
  text: string;
};
const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const segment = new RegExp(`^M(${number}),(${number})L(${number}),(${number})$`);
const pair = (d: string) =>
  [...d.matchAll(new RegExp(`(${number}),(${number})`, 'g'))].map((m) => [+m[1], +m[2]]);
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
export function prepareFigure(source: string) {
  const settings = figureMetadata(source),
    colors = new Map(palette.map((hex, id) => [id, hex]));
  for (const m of source.matchAll(/^@\s*map color (\d+) to \(\s*(\d+),\s*(\d+),\s*(\d+)\)/gm))
    colors.set(
      +m[1],
      [m[2], m[3], m[4]]
        .map((v) => (+v).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
    );
  const defs: string[] = [],
    used = new Set(colors.values());
  let next = Math.max(...colors.keys()) + 1,
    token = 0x02f001;
  const allocate = () => {
    let hex;
    do {
      hex = (token++).toString(16).padStart(6, '0').toUpperCase();
    } while (used.has(hex));
    used.add(hex);
    const id = next++;
    defs.push(
      `@map color ${id} to (${[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')}), "LSNFigure${id}"`,
    );
    return { id, hex };
  };
  const page = (source.match(/^@\s*page size ([^\n]+)/m)?.[1] ?? '792,612')
      .split(/[\s,]+/)
      .map(Number),
    unit = Math.min(...page);
  const grids: GridToken[] = [],
    legends: LegendToken[] = [];
  let graph = -1,
    view = [0.15, 0.15, 1.15, 0.85];
  const patched = source
    .split('\n')
    .map((line) => {
      if (!line.trimStart().startsWith('@')) return line;
      const context = line.match(/^@\s*with g(\d+)\s*$/i);
      if (context) {
        graph = +context[1];
        view = [0.15, 0.15, 1.15, 0.85];
      }
      const v = line.match(/^@\s*view (.+)$/i);
      if (v && !/[a-z]/i.test(v[1])) view = v[1].split(/[\s,]+/).map(Number);
      const style = settings.get(graph);
      if (!style) return line;
      const grid = line.match(/^(@\s*(xaxis|yaxis) tick (major|minor) color )([0-9]+)\s*$/i);
      if (grid) {
        const paint = style.grid?.[grid[3].toLowerCase() as 'major' | 'minor'];
        if (paint) {
          const t = allocate();
          grids.push({
            hex: t.hex,
            original: colors.get(+grid[4]) ?? '000000',
            paint,
            axis: grid[2].toLowerCase(),
            view: [...view],
          });
          return grid[1] + t.id;
        }
      }
      const l = style.legend;
      if (l) {
        let entry = legends.find((l) => l.id === graph);
        if (!entry) {
          entry = {
            id: graph,
            style: l,
            fill: allocate().hex,
            border: allocate().hex,
            text: allocate().hex,
          };
          legends.push(entry);
        }
        const tokenId = (hex: string) =>
          Number(
            defs
              .find((d) =>
                d.includes(
                  `(${[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`,
                ),
              )
              ?.match(/color (\d+)/)?.[1],
          );
        if (/^@\s*legend box fill color /i.test(line))
          return line.replace(/\d+\s*$/, String(tokenId(entry.fill)));
        if (/^@\s*legend box color /i.test(line))
          return line.replace(/\d+\s*$/, String(tokenId(entry.border)));
        if (/^@\s*legend color /i.test(line))
          return line.replace(/\d+\s*$/, String(tokenId(entry.text)));
        if (/^@\s*legend box fill pattern /i.test(line)) return line.replace(/\d+\s*$/, '1');
        if (/^@\s*legend box linestyle /i.test(line)) return line.replace(/\d+\s*$/, '1');
      }
      return line;
    })
    .join('\n');
  return { source: defs.join('\n') + '\n' + patched, settings, grids, legends, colors, unit };
}
const dash = (style: number, width: number) =>
  (({ 2: [1, 3], 3: [5, 3], 4: [9, 4], 5: [7, 3, 1, 3] }) as Record<number, number[]>)[style]
    ?.map((v) => v * width)
    .join(',') ?? 'none';
export function applyFigure(svg: string, prepared: ReturnType<typeof prepareFigure>) {
  const { grids, legends, colors, unit } = prepared;
  svg = svg.replace(/<g style="([^"]*)">([\s\S]*?)<\/g>/g, (whole, style: string, body: string) => {
    const grid = grids.find((t) => style.toUpperCase().includes('STROKE:#' + t.hex));
    if (!grid) return whole;
    const [x0, y0, x1, y1] = grid.view.map((v) => v * unit);
    const changed = body.replace(
      /<path\b([^>]*?)\bd="([^"]*)"([^>]*?)\/>/g,
      (path, a: string, d: string, b: string) => {
        const m = d.match(segment);
        if (!m) return path;
        const [ax, ay, bx, by] = m.slice(1).map(Number);
        const isGrid =
          grid.axis === 'xaxis'
            ? near(ax, bx) && near(Math.min(ay, by), y0) && near(Math.max(ay, by), y1)
            : near(ay, by) && near(Math.min(ax, bx), x0) && near(Math.max(ax, bx), x1);
        if (!isGrid) return path;
        const p = grid.paint,
          width = p.width * unit * 0.0015;
        return `<path ${a}d="${d}"${b} data-lsn-grid="true" style="stroke:#${colors.get(p.color) ?? '000000'};stroke-opacity:${p.style === 0 ? 0 : p.opacity};stroke-width:${width};stroke-dasharray:${dash(p.style, width)}"/>`;
      },
    );
    return `<g style="${style.replace(new RegExp('#' + grid.hex, 'gi'), '#' + grid.original)}">${changed}</g>`;
  });
  for (const legend of legends) {
    const groups = [...svg.matchAll(/<g style="([^"]*)">([\s\S]*?)<\/g>/g)];
    const fill = groups.find((m) => m[1].toUpperCase().includes('FILL:#' + legend.fill));
    if (!fill) continue;
    const d = fill[2].match(/\bd="([^"]+)"/)?.[1],
      points = d ? pair(d) : [];
    if (points.length !== 4) continue;
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      left = Math.min(...xs),
      right = Math.max(...xs),
      top = Math.max(...ys),
      bottom = Math.min(...ys);
    const textGroups = groups.filter((m) => m[1].toUpperCase().includes('FILL:#' + legend.text));
    const labels = textGroups.flatMap((m) =>
      [...m[2].matchAll(/<text\b[^>]*transform="matrix\(([^)]+)\)"[^>]*>[\s\S]*?<\/text>/g)].map(
        (t) => ({ node: t[0], matrix: t[1].split(',').map(Number) }),
      ),
    );
    if (!labels.length) continue;
    const baselines = [...new Set(labels.map((t) => t.matrix[5]))].sort((a, b) => b - a),
      n = baselines.length;
    const step = n > 1 ? baselines[0] - baselines[1] : legend.style.size * unit * 0.04;
    const cols = Math.max(
        1,
        Math.min(
          n,
          legend.style.layout === 'horizontal'
            ? n
            : legend.style.layout === 'vertical'
              ? 1
              : (legend.style.columns ?? 1),
        ),
      ),
      rows = Math.ceil(n / cols),
      gap = legend.style.columnGap ?? 16;
    let rowWidth = right - left,
      newWidth = cols * rowWidth + (cols - 1) * gap,
      newHeight = top - bottom - (n - rows) * step;
    const endText = Math.max(...textGroups.map((m) => m.index! + m[0].length));
    let end = endText;
    // Samples follow their text; only collect shapes inside the last sample cell.
    const lastY = baselines[n - 1] + legend.style.size * unit * 0.0075,
      textX = Math.min(...labels.map((t) => t.matrix[4]));
    for (const group of groups.filter((m) => m.index! >= endText)) {
      if (group.index! > end + 10) break;
      const primitives = [
        ...group[2].matchAll(/<(path|ellipse|text)\b[^>]*(?:\/>|>[\s\S]*?<\/text>)/g),
      ];
      if (!primitives.length) break;
      const inside = primitives.every((m) => {
        if (m[1] === 'text') {
          const matrix = m[0]
            .match(/transform="matrix\(([^)]+)\)"/)?.[1]
            .split(',')
            .map(Number);
          return (
            !!matrix &&
            matrix[4] >= left &&
            matrix[4] < textX &&
            Math.abs(matrix[5] - lastY) < step * 0.55
          );
        }
        if (m[1] === 'ellipse') {
          const x = Number(m[0].match(/\bcx="([^"]+)"/)?.[1]),
            y = Number(m[0].match(/\bcy="([^"]+)"/)?.[1]);
          return x >= left && x < textX && Math.abs(y - lastY) < step * 0.55;
        }
        const p = pair(m[0].match(/\bd="([^"]+)"/)?.[1] ?? '');
        return (
          p.length > 0 &&
          p.every(([x, y]) => x >= left && x < textX && Math.abs(y - lastY) < step * 0.55)
        );
      });
      if (!inside) break;
      end = group.index! + group[0].length;
    }
    let start = fill.index!,
      content = svg.slice(start, end);
    const iconRadii = [...content.matchAll(/<ellipse\b[^>]*\/>/g)].map((m) =>
      Math.max(
        Number(m[0].match(/\brx="([^"]+)"/)?.[1] ?? 0),
        Number(m[0].match(/\bry="([^"]+)"/)?.[1] ?? 0),
      ),
    );
    for (const m of content.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g)) {
      if (!/[zZ]/.test(m[1])) continue;
      const p = pair(m[1]);
      if (p.length && p.every(([x]) => x < textX))
        iconRadii.push(
          Math.max(
            Math.max(...p.map((v) => v[0])) - Math.min(...p.map((v) => v[0])),
            Math.max(...p.map((v) => v[1])) - Math.min(...p.map((v) => v[1])),
          ) / 2,
        );
    }
    const radius = Math.max(0, ...iconRadii),
      iconPadding = radius * Math.max(0, (legend.style.symbolScale ?? 1) - 1),
      rowStep = Math.max(step, radius * 2 * (legend.style.symbolScale ?? 1) + unit * 0.005);
    rowWidth += 2 * iconPadding;
    newWidth = cols * rowWidth + (cols - 1) * gap;
    newHeight = top - bottom - (n - 1) * step + (rows - 1) * rowStep + 2 * iconPadding;
    const rect = `M${left},${top}L${left},${top - newHeight}L${left + newWidth},${top - newHeight}L${left + newWidth},${top}z`;
    content = content.replace(
      /<g style="([^"]*)">([\s\S]*?)<\/g>/g,
      (whole, style: string, body: string) => {
        const isFill = style.toUpperCase().includes('FILL:#' + legend.fill),
          isBorder = style.toUpperCase().includes('STROKE:#' + legend.border),
          isText = style.toUpperCase().includes('FILL:#' + legend.text);
        if (isFill || isBorder) {
          const visible = isFill ? legend.style.box.fill.pattern > 0 : legend.style.box.style > 0;
          const color =
            colors.get(isFill ? legend.style.box.fill.color : legend.style.box.color) ?? '000000';
          style = style.replace(
            new RegExp('#' + (isFill ? legend.fill : legend.border), 'gi'),
            '#' + color,
          );
          if (isFill)
            style += `;fill-opacity:${visible ? (legend.style.box.fill.opacity ?? 1) : 0}`;
          else
            style += `;stroke-opacity:${visible ? 1 : 0};stroke-dasharray:${dash(legend.style.box.style, legend.style.box.width * unit * 0.0015)}`;
          return `<g style="${style}">${body.replace(/\bd="[^"]+"/, `d="${rect}"`)}</g>`;
        }
        body = body.replace(
          /<(text|path|ellipse)\b[^>]*(?:\/>|>[\s\S]*?<\/text>)/g,
          (node, tag: string) => {
            let x = 0,
              y = 0;
            if (tag === 'text') {
              const matrix = node
                .match(/transform="matrix\(([^)]+)\)"/)?.[1]
                .split(',')
                .map(Number);
              if (!matrix) return node;
              x = matrix[4];
              y = matrix[5] + (isText ? 0 : legend.style.size * unit * 0.0075);
            } else if (tag === 'ellipse') {
              x = Number(node.match(/\bcx="([^"]+)"/)?.[1]);
              y = Number(node.match(/\bcy="([^"]+)"/)?.[1]);
            } else {
              const p = pair(node.match(/\bd="([^"]+)"/)?.[1] ?? '');
              if (!p.length) return node;
              x = (Math.min(...p.map((v) => v[0])) + Math.max(...p.map((v) => v[0]))) / 2;
              y = (Math.min(...p.map((v) => v[1])) + Math.max(...p.map((v) => v[1]))) / 2;
            }
            const i = baselines.reduce(
              (best, b, j) =>
                Math.abs((isText ? y : y - legend.style.size * unit * 0.0075) - b) <
                Math.abs((isText ? y : y - legend.style.size * unit * 0.0075) - baselines[best])
                  ? j
                  : best,
              0,
            );
            const dx = (i % cols) * (rowWidth + gap) + (isText ? 2 * iconPadding : iconPadding),
              dy = baselines[0] - iconPadding - Math.floor(i / cols) * rowStep - baselines[i];
            const lineMatch =
              tag === 'path' ? node.match(/\bd="([^"]+)"/)?.[1].match(segment) : null;
            const horizontalLine = !!lineMatch && near(Number(lineMatch[2]), Number(lineMatch[4]));
            const icon = !isText && !horizontalLine;
            const scale = icon ? (legend.style.symbolScale ?? 1) : 1;
            const id = legend.style.entries[legend.style.inverted ? n - 1 - i : i];
            return `<g transform="translate(${dx},${dy})"${isText ? ` data-lsn-text="g${legend.id}.s${id}.legend"` : ''}>${scale !== 1 ? `<g transform="translate(${x},${y}) scale(${scale}) translate(${-x},${-y})">${node}</g>` : node}</g>`;
          },
        );
        return `<g style="${style.replace(new RegExp('#' + legend.text, 'gi'), '#' + (colors.get(legend.style.color) ?? '000000'))}">${body}</g>`;
      },
    );
    svg = svg.slice(0, start) + content + svg.slice(end);
  }
  return svg;
}
