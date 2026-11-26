import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { prepareFigure, applyFigure } from '../server/figureStyle';
import { validateScene } from '../src/core/scene/validate';
function styled() {
  const s = createDemo(),
    g = s.graphs[0];
  s.page.size = [600, 600];
  g.viewport = [0.1, 0.1, 0.9, 0.9];
  g.grid = { major: { color: 4, width: 2, style: 3, opacity: 0.3 } };
  g.axes.xaxis.ticks.majorGrid = true;
  g.legend.layout = 'horizontal';
  g.legend.columns = 2;
  g.legend.symbolScale = 2;
  g.legend.box.fill.opacity = 0.4;
  return s;
}
test('Grid and modern legend appearance survive AGR round trip without changing curves', () => {
  const s = styled(),
    p = parseAgr(serializeAgr(s));
  assert.deepEqual(p.graphs[0].grid, s.graphs[0].grid);
  assert.deepEqual(p.graphs[0].legend, s.graphs[0].legend);
  assert.deepEqual(p.graphs[0].sets, s.graphs[0].sets);
});
test('Grid style uses unique native colors and modifies only full grid segments', () => {
  const s = styled(),
    p = prepareFigure(serializeAgr(s)),
    t = p.grids.find((g) => g.axis === 'xaxis')!;
  const svg = `<svg><g style="fill:none;stroke:#${t.hex};stroke-width:0.9"><path d="M60,60L60,540"/><path d="M60,60L60,72"/></g></svg>`;
  const result = applyFigure(svg, p);
  assert.ok(result.includes('stroke:#000000'));
  assert.ok(result.includes('data-lsn-grid="true"'));
  assert.ok(result.includes('stroke:#0000FF;stroke-opacity:0.3'));
  assert.ok(result.includes('<path d="M60,60L60,72"/>'));
  assert.ok(!result.includes(t.hex));
});
test('Legend recoloring and layout retain native text and samples, and scale symbols independently', () => {
  const s = styled(),
    p = prepareFigure(serializeAgr(s)),
    l = p.legends[0];
  const svg = `<svg><g style="fill:#${l.fill}"><path d="M100,400L100,340L300,340L300,400z"/></g><g style="fill:none;stroke:#${l.border}"><path d="M100,400L100,340L300,340L300,400z"/></g><g style="fill:#${l.text}"><text transform="matrix(.028,0,0,-.028,150,380)">Model</text></g><g style="stroke:#0000FF"><path d="M110,384L140,384"/></g><g style="fill:#${l.text}"><text transform="matrix(.028,0,0,-.028,150,360)">Data</text></g><g style="stroke:#FF0000"><ellipse rx="4" ry="4" cx="125" cy="364"/></g></svg>`;
  const result = applyFigure(svg, p);
  assert.ok(result.includes('fill-opacity:0.4'));
  assert.ok(result.includes('scale(2)'));
  assert.ok(result.includes('data-lsn-text="g0.s1.legend"'));
  assert.ok(result.includes('>Model</text>'));
  assert.ok(!result.includes(l.text));
  assert.ok(!result.includes('L300,340'));
});
test('Invalid legend and grid numeric values are rejected before rendering', () => {
  const s = styled();
  s.graphs[0].legend.columns = 1.5;
  assert.ok(validateScene(s).length);
  s.graphs[0].legend.columns = 2;
  s.graphs[0].grid!.major!.opacity = 1.5;
  assert.ok(validateScene(s).length);
});
