/** Integration oracle: Grace must read LSNGrace output without diagnostics,
 * then save it back, preserving modeled fields and every numeric column. */
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { parseAgr } from '../src/core/agr/parser';
import { serializeAgr } from '../src/core/agr/serializer';
import { createDemo, createBlank, createSet } from '../src/core/scene/defaults';
import { parseTable, mapColumns } from '../src/core/import/tabular';
import { autoscaleGraph } from '../src/core/geometry/autoscale';
function importedTable() {
  const scene = createBlank(),
    graph = scene.graphs[0],
    series = createSet();
  const table = parseTable(
    readFileSync(new URL('../tests/fixtures/measurement.csv', import.meta.url), 'utf8'),
  );
  series.type = 'xydy';
  series.rows = mapColumns(table, 0, 1, 2);
  series.legend = 'Importação CSV';
  graph.sets = [series];
  graph.axes.xaxis.label.text = table.headers[0];
  graph.axes.yaxis.label.text = table.headers[1];
  autoscaleGraph(graph);
  return scene;
}
const dir = mkdtempSync(join(tmpdir(), 'lsngrace-'));
try {
  const version = spawnSync('gracebat', ['-version'], { encoding: 'utf8', timeout: 10000 });
  if (version.error)
    throw Error('gracebat não encontrado: instale Grace para executar esta verificação.');
  console.log((version.stdout + version.stderr).split('\n').find((l) => l.includes('Grace')));
  for (const name of ['demo', 'grace-reference', 'grace-multigraph', 'table-import']) {
    const scene =
      name === 'table-import'
        ? importedTable()
        : name === 'demo'
          ? createDemo()
          : parseAgr(
              readFileSync(new URL(`../tests/fixtures/${name}.agr`, import.meta.url), 'utf8'),
            );
    const input = join(dir, `${name}.agr`),
      output = join(dir, `${name}-grace.agr`),
      figure = join(dir, `${name}.svg`);
    writeFileSync(input, serializeAgr(scene));
    const result = spawnSync(
      'gracebat',
      ['-noask', input, '-saveall', output, '-hdevice', 'SVG', '-printfile', figure, '-hardcopy'],
      { encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr.trim(), '');
    const actual = parseAgr(readFileSync(output, 'utf8'));
    for (const g of scene.graphs) {
      const saved = actual.graphs.find((x) => x.id === g.id)!;
      assert.deepEqual(saved.world, g.world);
      assert.deepEqual(saved.viewport, g.viewport);
      assert.equal(saved.title.text, g.title.text);
      assert.deepEqual(saved.axes, g.axes);
      assert.deepEqual(saved.frame, g.frame);
      assert.deepEqual(saved.legend, g.legend);
      assert.deepEqual(saved.subtitle, g.subtitle);
      for (const s of g.sets) {
        const set = saved.sets.find((x) => x.id === s.id)!;
        assert.equal(set.type, s.type);
        assert.equal(set.legend, s.legend);
        assert.deepEqual(set.line, s.line);
        assert.deepEqual(set.symbol, s.symbol);
        assert.deepEqual(set.errorBars, s.errorBars);
        assert.deepEqual(set.fill, s.fill);
        assert.equal(set.rows.length, s.rows.length);
        s.rows.forEach((row, i) =>
          row.forEach((v, j) =>
            assert.ok(
              Math.abs(set.rows[i][j] - v) <= Math.max(1, Math.abs(v)) * 1e-7,
              `G${g.id}.S${s.id} row ${i} col ${j}`,
            ),
          ),
        );
      }
    }
    assert.ok(readFileSync(figure, 'utf8').includes('<svg'));
    console.log(`✓ ${name}: exportação aceita, dados/estilos preservados e SVG gerado pelo Grace`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
