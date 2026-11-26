import { useLayoutEffect, useRef } from 'react';
import type { Scene, TextStyle } from '../../core/scene/types';
import { graphBox, normalized, ticks, formatTick } from '../../core/geometry/coordinates';
import type { CanvasCamera } from './camera';
import { zoomRows } from './liveZoom';
import type { HitBox } from './nativeTextTargets';
/** Short-lived interactive layer; publication drawing and export always come from Grace. */
export function LiveZoom({
  scene,
  camera,
  width,
  nativeBoxes = {},
  preserveLegend = false,
}: {
  scene: Scene;
  camera: CanvasCamera;
  width: number;
  nativeBoxes?: Record<string, HitBox>;
  preserveLegend?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current!,
      height = (width * camera.height) / camera.width,
      ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelsWide = Math.round(width * ratio),
      pixelsHigh = Math.round(height * ratio);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = (width * ratio) / camera.width;
    ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale);
    const unit = Math.min(...scene.page.size),
      color = (id: number) =>
        `rgb(${scene.colors.find((c) => c.id === id)?.rgb.join(',') ?? '0,0,0'})`;
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const text = (
      value: string,
      x: number,
      y: number,
      style: TextStyle,
      align: CanvasTextAlign = 'center',
    ) => {
      const font = scene.fonts.find((f) => f.id === style.font)?.name ?? 'Times';
      ctx.font = `${/Italic|Oblique/.test(font) ? 'italic ' : ''}${/Bold/.test(font) ? 'bold ' : ''}${style.size * unit * 0.028}px ${/Helvetica/.test(font) ? 'Arial' : /Courier/.test(font) ? 'monospace' : 'Times New Roman'}`;
      ctx.fillStyle = color(style.color);
      ctx.textAlign = align;
      ctx.fillText(value, x, y);
    };
    ctx.fillStyle = color(scene.page.background);
    ctx.fillRect(0, 0, ...scene.page.size);
    for (const g of scene.graphs) {
      if (!g.enabled || g.hidden) continue;
      const b = graphBox(scene, g.viewport),
        X = (v: number) => b.left + normalized(v, g.world[0], g.world[2], g.axes.xaxis) * b.width,
        Y = (v: number) =>
          b.bottom - normalized(v, g.world[1], g.world[3], g.axes.yaxis) * b.height;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.left, b.top, b.width, b.height);
      ctx.clip();
      if (g.frame.background.pattern) {
        ctx.fillStyle = color(g.frame.background.color);
        ctx.fillRect(b.left, b.top, b.width, b.height);
      }
      for (const horizontal of [true, false]) {
        const axis = horizontal ? g.axes.xaxis : g.axes.yaxis,
          index = horizontal ? 0 : 1;
        if (!axis.enabled) continue;
        for (const tick of ticks(g.world[index], g.world[index + 2], axis)) {
          if (!(tick.major ? axis.ticks.majorGrid : axis.ticks.minorGrid)) continue;
          const stroke = tick.major ? axis.ticks.majorStroke : axis.ticks.minorStroke;
          if (!stroke.style) continue;
          ctx.strokeStyle = color(stroke.color);
          ctx.lineWidth = stroke.width * unit * 0.0015;
          ctx.setLineDash(
            ({ 2: [1, 3], 3: [5, 3], 4: [9, 4], 5: [7, 3, 1, 3] } as Record<number, number[]>)[
              stroke.style
            ] ?? [],
          );
          const p = horizontal ? X(tick.value) : Y(tick.value);
          horizontal ? line(p, b.top, p, b.bottom) : line(b.left, p, b.right, p);
        }
      }
      ctx.setLineDash([]);
      for (const s of g.sets) {
        if (s.hidden) continue;
        const rows = zoomRows(s.rows);
        ctx.globalAlpha = s.opacity ?? 1;
        ctx.strokeStyle = color(s.line.color);
        ctx.lineWidth = s.line.width * unit * 0.0015;
        ctx.setLineDash(
          ({ 2: [1, 3], 3: [5, 3], 4: [9, 4], 5: [7, 3, 1, 3] } as Record<number, number[]>)[
            s.line.style
          ] ?? [],
        );
        if (s.line.connection && s.line.style) {
          ctx.beginPath();
          let connected = false,
            last: number[] | null = null;
          rows.forEach((r, i) => {
            const x = X(r[0]),
              y = Y(r[1]);
            if (!Number.isFinite(x + y)) {
              connected = false;
              return;
            }
            if (!connected || (s.line.connection === 4 && i % 2 === 0)) ctx.moveTo(x, y);
            else {
              if (s.line.connection === 2 && last) ctx.lineTo(x, last[1]);
              if (s.line.connection === 3 && last) ctx.lineTo(last[0], y);
              ctx.lineTo(x, y);
            }
            connected = true;
            last = [x, y];
          });
          ctx.stroke();
        }
        ctx.setLineDash([]);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i],
            x = X(row[0]),
            y = Y(row[1]);
          if (!Number.isFinite(x + y)) continue;
          if (s.type === 'xydy' && s.errorBars.enabled) {
            ctx.strokeStyle = color(s.errorBars.color);
            ctx.lineWidth = s.errorBars.width * unit * 0.0015;
            const high = Y(row[1] + Math.abs(row[2])),
              low = Y(row[1] - Math.abs(row[2])),
              cap = unit * 0.005 * s.errorBars.size;
            line(x, high, x, low);
            line(x - cap, high, x + cap, high);
            line(x - cap, low, x + cap, low);
          }
          if (!s.symbol.type || (s.symbol.skip && i % (s.symbol.skip + 1))) continue;
          const r = s.symbol.size * unit * 0.01;
          ctx.beginPath();
          ctx.strokeStyle = color(s.symbol.color);
          ctx.lineWidth = s.symbol.width * unit * 0.0015;
          if (s.symbol.type === 1) ctx.arc(x, y, r, 0, Math.PI * 2);
          else if (s.symbol.type === 2) ctx.rect(x - r, y - r, 2 * r, 2 * r);
          else if (s.symbol.type === 3) {
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r, y);
            ctx.closePath();
          } else if (s.symbol.type >= 4 && s.symbol.type <= 7) {
            const angle = (
              { 4: -Math.PI / 2, 5: Math.PI, 6: Math.PI / 2, 7: 0 } as Record<number, number>
            )[s.symbol.type];
            for (let j = 0; j < 3; j++) {
              const a = angle + (j * Math.PI * 2) / 3;
              j
                ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
                : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            }
            ctx.closePath();
          } else if (s.symbol.type === 8) {
            ctx.moveTo(x - r, y);
            ctx.lineTo(x + r, y);
            ctx.moveTo(x, y - r);
            ctx.lineTo(x, y + r);
          } else if (s.symbol.type === 9) {
            ctx.moveTo(x - r, y - r);
            ctx.lineTo(x + r, y + r);
            ctx.moveTo(x - r, y + r);
            ctx.lineTo(x + r, y - r);
          } else if (s.symbol.type === 10) {
            for (let j = 0; j < 10; j++) {
              const a = -Math.PI / 2 + (j * Math.PI) / 5,
                q = j % 2 ? r * 0.4 : r;
              j
                ? ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q)
                : ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
            }
            ctx.closePath();
          } else {
            ctx.font = `${r * 2}px serif`;
            ctx.fillStyle = color(s.symbol.color);
            ctx.fillText(String.fromCharCode(s.symbol.character), x, y);
          }
          if (s.symbol.fill.pattern && s.symbol.type < 8) {
            ctx.globalAlpha = (s.opacity ?? 1) * (s.symbol.fill.opacity ?? 1);
            ctx.fillStyle = color(s.symbol.fill.color);
            ctx.fill();
          }
          ctx.globalAlpha = s.opacity ?? 1;
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = color(g.frame.color);
      ctx.lineWidth = g.frame.width * unit * 0.0015;
      if (g.frame.style && g.frame.pattern) ctx.strokeRect(b.left, b.top, b.width, b.height);
      for (const horizontal of [true, false]) {
        const axis = horizontal ? g.axes.xaxis : g.axes.yaxis;
        if (!axis.enabled) continue;
        if (axis.bar.enabled && axis.bar.style) {
          ctx.strokeStyle = color(axis.bar.color);
          ctx.lineWidth = axis.bar.width * unit * 0.0015;
          horizontal
            ? line(b.left, b.bottom, b.right, b.bottom)
            : line(b.left, b.top, b.left, b.bottom);
        }
        const i = horizontal ? 0 : 1;
        for (const tick of ticks(g.world[i], g.world[i + 2], axis)) {
          const p = horizontal ? X(tick.value) : Y(tick.value),
            size = (tick.major ? axis.ticks.majorSize : axis.ticks.minorSize) * unit * 0.02;
          ctx.strokeStyle = color(
            (tick.major ? axis.ticks.majorStroke : axis.ticks.minorStroke).color,
          );
          ctx.lineWidth =
            (tick.major ? axis.ticks.majorStroke : axis.ticks.minorStroke).width * unit * 0.0015;
          if (axis.ticks.enabled)
            for (const side of [0, 1]) {
              if (
                (axis.ticks.place === 'normal' && side) ||
                (axis.ticks.place === 'opposite' && !side)
              )
                continue;
              const base = horizontal ? (side ? b.top : b.bottom) : side ? b.right : b.left,
                sign = side ? -1 : 1,
                inside = axis.ticks.direction === 'out' ? 0 : size,
                outside = axis.ticks.direction === 'in' ? 0 : size;
              horizontal
                ? line(p, base + sign * outside, p, base - sign * inside)
                : line(base - sign * outside, p, base + sign * inside, p);
            }
          if (tick.major && axis.tickLabels.enabled)
            text(
              formatTick(tick.value, axis),
              horizontal ? p : b.left - unit * 0.012,
              horizontal ? b.bottom + unit * 0.035 : p + unit * 0.009,
              axis.tickLabels,
              horizontal ? 'center' : 'right',
            );
        }
        if (axis.label.text && !nativeBoxes[`${g.id}:${horizontal ? 'xlabel' : 'ylabel'}`]) {
          ctx.save();
          if (horizontal)
            text(axis.label.text, (b.left + b.right) / 2, b.bottom + unit * 0.075, axis.label);
          else {
            ctx.translate(b.left - unit * 0.09, (b.top + b.bottom) / 2);
            ctx.rotate(-Math.PI / 2);
            text(axis.label.text, 0, 0, axis.label);
          }
          ctx.restore();
        }
      }
      if (g.title.text && !nativeBoxes[`${g.id}:title`])
        text(g.title.text, (b.left + b.right) / 2, b.top - unit * 0.035, g.title);
      if (g.subtitle.text && !nativeBoxes[`${g.id}:subtitle`])
        text(g.subtitle.text, (b.left + b.right) / 2, b.top - unit * 0.01, g.subtitle);
      const legends = g.sets.filter((s) => !s.hidden && s.legend);
      if (
        !preserveLegend &&
        g.legend.enabled &&
        legends.length &&
        g.legend.coordinates === 'view'
      ) {
        const x = g.legend.position[0] * unit,
          y = scene.page.size[1] - g.legend.position[1] * unit,
          style = { text: '', font: g.legend.font, size: g.legend.size, color: g.legend.color };
        text('', x, y, style);
        const rowHeight = unit * 0.037 * g.legend.size,
          w = Math.max(...legends.map((s) => ctx.measureText(s.legend).width)) + unit * 0.09,
          h = legends.length * rowHeight + unit * 0.02;
        ctx.fillStyle = color(g.legend.box.fill.color);
        if (g.legend.box.fill.pattern) ctx.fillRect(x - unit * 0.01, y - unit * 0.03, w, h);
        ctx.strokeStyle = color(g.legend.box.color);
        ctx.lineWidth = g.legend.box.width * unit * 0.0015;
        ctx.strokeRect(x - unit * 0.01, y - unit * 0.03, w, h);
        legends.forEach((s, i) => {
          ctx.globalAlpha = s.opacity ?? 1;
          ctx.strokeStyle = color(s.line.color);
          line(
            x,
            y + i * rowHeight - unit * 0.007,
            x + unit * 0.04,
            y + i * rowHeight - unit * 0.007,
          );
          ctx.globalAlpha = 1;
          text(s.legend, x + unit * 0.05, y + i * rowHeight, style, 'left');
        });
      }
    }
  }, [scene, camera.x, camera.y, camera.width, camera.height, width, nativeBoxes, preserveLegend]);
  return <canvas ref={ref} className="live-zoom-preview" aria-label="Prévia interativa do zoom" />;
}
