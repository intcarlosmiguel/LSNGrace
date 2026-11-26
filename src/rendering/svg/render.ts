import type { Axis, DataSet, Scene, Stroke, TextStyle } from '../../core/scene/types';
import {
  formatTick,
  graphBox,
  normalized,
  ticks,
  viewportPoint,
} from '../../core/geometry/coordinates';
import { validateScene } from '../../core/scene/validate';
export const escapeXml = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
const n = (value: number) => Number(value.toFixed(5));
const dash: Record<number, string> = { 2: '1 3', 3: '5 3', 4: '9 4', 5: '7 3 1 3' };
export function renderSvg(scene: Scene): string {
  const errors = validateScene(scene);
  if (errors.length) throw Error(errors.join('\n'));
  const [width, height] = scene.page.size,
    unit = Math.min(width, height);
  const color = (id: number) => {
    const c = scene.colors.find((c) => c.id === id);
    return c ? `rgb(${c.rgb.join(',')})` : '#000';
  };
  const stroke = (s: Stroke) =>
    `stroke="${color(s.color)}" stroke-width="${n(s.width * 0.5)}"${dash[s.style] ? ` stroke-dasharray="${dash[s.style]}"` : ''}${s.style === 0 ? ' stroke-opacity="0"' : ''}`;
  const text = (x: number, y: number, t: TextStyle, anchor = 'middle', extra = '') => {
    const font = scene.fonts.find((f) => f.id === t.font)?.name ?? 'Times-Roman';
    const family = /Helvetica|Sans/i.test(font)
      ? 'Helvetica, Arial, sans-serif'
      : /Courier|Mono/i.test(font)
        ? 'Courier New, monospace'
        : 'Nimbus Roman, Times New Roman, serif';
    return `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${family}" font-style="${/Italic|Oblique/i.test(font) ? 'italic' : 'normal'}" font-weight="${/Bold/i.test(font) ? 'bold' : 'normal'}" font-size="${n(t.size * unit * 0.025)}" fill="${color(t.color)}" ${extra}>${escapeXml(t.text)}</text>`;
  };
  const line = (x1: number, y1: number, x2: number, y2: number, s: Stroke, extra = '') =>
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${stroke(s)} ${extra}/>`;
  const symbol = (x: number, y: number, s: DataSet) => {
    if (!s.symbol.type) return '';
    const r = s.symbol.size * unit * 0.005;
    const attrs = `stroke="${color(s.symbol.color)}" stroke-width="${s.symbol.width * 0.5}" fill="${s.symbol.fill.pattern ? color(s.symbol.fill.color) : 'none'}"`;
    if (s.symbol.type === 1) return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${attrs}/>`;
    if (s.symbol.type === 2)
      return `<rect x="${n(x - r)}" y="${n(y - r)}" width="${n(r * 2)}" height="${n(r * 2)}" ${attrs}/>`;
    if (s.symbol.type === 3)
      return `<path d="M${n(x)} ${n(y - r)}l${n(r)} ${n(r)}l${n(-r)} ${n(r)}l${n(-r)} ${n(-r)}Z" ${attrs}/>`;
    return ''; // Remaining symbols are scheduled for milestone 2.
  };
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico científico LSNGrace">`,
  ];
  if (scene.page.fill)
    out.push(`<rect width="${width}" height="${height}" fill="${color(scene.page.background)}"/>`);
  for (const g of scene.graphs) {
    if (!g.enabled || g.hidden || g.type.toUpperCase() !== 'XY') continue;
    const box = graphBox(scene, g.viewport),
      { left, right, top, bottom } = box;
    const X = (x: number) => left + normalized(x, g.world[0], g.world[2], g.axes.xaxis) * box.width;
    const Y = (y: number) =>
      bottom - normalized(y, g.world[1], g.world[3], g.axes.yaxis) * box.height;
    const clip = `plot-g${g.id}`;
    out.push(
      `<g data-graph="${g.id}"><defs><clipPath id="${clip}"><rect x="${n(left)}" y="${n(top)}" width="${n(box.width)}" height="${n(box.height)}"/></clipPath></defs>`,
    );
    if (g.frame.background.pattern)
      out.push(
        `<rect x="${n(left)}" y="${n(top)}" width="${n(box.width)}" height="${n(box.height)}" fill="${color(g.frame.background.color)}"/>`,
      );
    const drawAxis = (axis: Axis, horizontal: boolean) => {
      if (!axis.enabled) return;
      const i = horizontal ? 0 : 1,
        position = horizontal ? X : Y;
      for (const tick of ticks(g.world[i], g.world[i + 2], axis)) {
        const p = position(tick.value);
        if (!Number.isFinite(p)) continue;
        const ts = tick.major ? axis.ticks.majorStroke : axis.ticks.minorStroke;
        if (tick.major ? axis.ticks.majorGrid : axis.ticks.minorGrid)
          out.push(
            horizontal
              ? line(p, top, p, bottom, ts, `clip-path="url(#${clip})"`)
              : line(left, p, right, p, ts, `clip-path="url(#${clip})"`),
          );
        const size = (tick.major ? axis.ticks.majorSize : axis.ticks.minorSize) * unit * 0.01;
        const inside = axis.ticks.direction === 'out' ? 0 : size,
          outside = axis.ticks.direction === 'in' ? 0 : size;
        if (axis.ticks.enabled)
          for (const side of [0, 1]) {
            if (
              (axis.ticks.place === 'normal' && side === 1) ||
              (axis.ticks.place === 'opposite' && side === 0)
            )
              continue;
            const base = horizontal ? (side ? top : bottom) : side ? right : left,
              sign = side ? -1 : 1;
            out.push(
              horizontal
                ? line(p, base + sign * outside, p, base - sign * inside, ts)
                : line(base - sign * outside, p, base + sign * inside, p, ts),
            );
          }
        if (tick.major && axis.tickLabels.enabled)
          for (const side of [0, 1]) {
            if (
              (axis.tickLabels.place === 'normal' && side === 1) ||
              (axis.tickLabels.place === 'opposite' && side === 0)
            )
              continue;
            const x = horizontal ? p : side ? right + unit * 0.018 : left - unit * 0.018;
            const y = horizontal
              ? side
                ? top - unit * 0.015
                : bottom + unit * 0.032
              : p + axis.tickLabels.size * unit * 0.008;
            out.push(
              text(
                x,
                y,
                { ...axis.tickLabels, text: formatTick(tick.value, axis) },
                horizontal ? 'middle' : side ? 'start' : 'end',
                axis.tickLabels.angle
                  ? `transform="rotate(${-axis.tickLabels.angle} ${n(x)} ${n(y)})"`
                  : '',
              ),
            );
          }
      }
      if (axis.bar.enabled)
        out.push(
          horizontal
            ? line(left, bottom, right, bottom, axis.bar)
            : line(left, top, left, bottom, axis.bar),
        );
      if (axis.label.text)
        out.push(
          horizontal
            ? text((left + right) / 2, bottom + unit * 0.085, axis.label)
            : text(
                left - unit * 0.09,
                (top + bottom) / 2,
                axis.label,
                'middle',
                `transform="rotate(-90 ${n(left - unit * 0.09)} ${n((top + bottom) / 2)})"`,
              ),
        );
    };
    drawAxis(g.axes.xaxis, true);
    drawAxis(g.axes.yaxis, false);
    for (const s of g.sets) {
      if (s.hidden || !['xy', 'xydy'].includes(s.type)) continue;
      out.push(`<g data-set="${s.id}" clip-path="url(#${clip})">`);
      let path = '',
        connected = false;
      for (const row of s.rows) {
        const x = X(row[0]),
          y = Y(row[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          connected = false;
          continue;
        }
        path += `${connected ? 'L' : 'M'}${n(x)} ${n(y)} `;
        connected = true;
      }
      if (s.line.connection === 1 && s.line.style)
        out.push(`<path d="${path}" fill="none" ${stroke(s.line)} stroke-linejoin="round"/>`);
      s.rows.forEach((row, index) => {
        const x = X(row[0]),
          y = Y(row[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (s.type === 'xydy' && s.errorBars.enabled) {
          const e = s.errorBars,
            cap = e.size * unit * 0.005,
            y1 = Y(row[1] - Math.abs(row[2])),
            y2 = Y(row[1] + Math.abs(row[2]));
          if (Number.isFinite(y1) && Number.isFinite(y2)) {
            const riser = { color: e.color, width: e.riserWidth, style: e.riserStyle },
              caps = { color: e.color, width: e.width, style: e.style };
            const normal = e.place !== 'opposite',
              opposite = e.place !== 'normal';
            out.push(line(x, normal ? y1 : y, x, opposite ? y2 : y, riser));
            if (normal) out.push(line(x - cap, y1, x + cap, y1, caps));
            if (opposite) out.push(line(x - cap, y2, x + cap, y2, caps));
          }
        }
        if (index % (s.symbol.skip + 1) === 0) out.push(symbol(x, y, s));
      });
      out.push('</g>');
    }
    if (g.frame.type === 0)
      out.push(
        `<rect x="${n(left)}" y="${n(top)}" width="${n(box.width)}" height="${n(box.height)}" fill="none" ${stroke(g.frame)}/>`,
      );
    if (g.title.text) out.push(text((left + right) / 2, top - unit * 0.055, g.title));
    if (g.subtitle.text) out.push(text((left + right) / 2, top - unit * 0.023, g.subtitle));
    if (g.legend.enabled) {
      let entries = g.sets.filter((s) => !s.hidden && s.legend);
      if (g.legend.inverted) entries = [...entries].reverse();
      const [lx, ly] =
        g.legend.coordinates === 'view'
          ? viewportPoint(scene, ...g.legend.position)
          : [X(g.legend.position[0]), Y(g.legend.position[1])];
      const fs = g.legend.size * unit * 0.025,
        gap = fs * (1 + 0.3 * g.legend.vgap),
        sample = g.legend.length * unit * 0.01;
      if (entries.length && Number.isFinite(lx) && Number.isFinite(ly)) {
        const w =
          sample + unit * 0.02 + Math.max(...entries.map((s) => s.legend.length)) * fs * 0.58;
        out.push(
          `<rect x="${n(lx - unit * 0.01)}" y="${n(ly - fs)}" width="${n(w + unit * 0.02)}" height="${n(entries.length * gap + fs * 0.4)}" fill="${g.legend.box.fill.pattern ? color(g.legend.box.fill.color) : 'none'}" ${g.legend.box.pattern ? stroke(g.legend.box) : 'stroke="none"'}/>`,
        );
        entries.forEach((s, i) => {
          const y = ly + i * gap;
          if (s.line.connection && s.line.style)
            out.push(line(lx, y - fs * 0.3, lx + sample, y - fs * 0.3, s.line));
          out.push(symbol(lx + sample / 2, y - fs * 0.3, s));
          out.push(
            text(
              lx + sample + unit * 0.015,
              y,
              { text: s.legend, font: g.legend.font, size: g.legend.size, color: g.legend.color },
              'start',
            ),
          );
        });
      }
    }
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('');
}
export function renderWarnings(scene: Scene): string[] {
  const warnings = new Set<string>();
  for (const g of scene.graphs) {
    if (g.type.toUpperCase() !== 'XY')
      warnings.add(`G${g.id}: tipo de gráfico ${g.type} ainda não renderizado.`);
    if (g.axes.altxaxis.enabled || g.axes.altyaxis.enabled)
      warnings.add('Eixos alternativos preservados; renderização prevista para o próximo marco.');
    for (const s of g.sets) {
      if (!['xy', 'xydy'].includes(s.type))
        warnings.add(
          `G${g.id}.S${s.id}: ${s.type} preservado; renderização disponível para XY e XYDY.`,
        );
      if (s.symbol.type > 3)
        warnings.add('Símbolos 4–11 preservados; renderização prevista para o Marco 2.');
      if (s.line.connection > 1)
        warnings.add('Conexões especiais preservadas; renderização prevista para o Marco 2.');
      if (s.fill.type)
        warnings.add('Preenchimentos de curvas preservados, ainda não renderizados.');
    }
    if (
      [g.title, g.subtitle, g.axes.xaxis.label, g.axes.yaxis.label].some((t) =>
        /\\|\$/.test(t.text),
      )
    )
      warnings.add(
        'Texto científico exibido como sintaxe original; composição vetorial prevista para o Marco 2.',
      );
  }
  return [...warnings];
}
