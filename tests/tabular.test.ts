import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTable, mapColumns } from '../src/core/import/tabular';
import { autoscaleGraph } from '../src/core/geometry/autoscale';
import { createBlank, createSet } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { readDraft } from '../src/state/draft';
test('Import semicolon tables with decimal commas, headers and original error lines', () => {
  const table = parseTable('# comment\nTempo (s);Amplitude;Erro\n0;1,2;0,1\n1;2,4;0,2\n');
  assert.deepEqual(table.rows, [
    [0, 1.2, 0.1],
    [1, 2.4, 0.2],
  ]);
  assert.deepEqual(mapColumns(table, 0, 1, 2), table.rows);
  assert.equal(table.headers[0], 'Tempo (s)');
  assert.equal(table.delimiter, ';');
  assert.throws(() => parseTable('# comment\nX;Y\n0;1\n1;invalid'), /Linha 4, coluna 2/);
});
test('CSV quoting, quoted delimiters and escaped header quotes', () => {
  const table = parseTable('"Time, seconds","Value ""A"""\n"0","1.2"\n1,2.4');
  assert.deepEqual(table.headers, ['Time, seconds', 'Value "A"']);
  assert.deepEqual(table.rows, [
    [0, 1.2],
    [1, 2.4],
  ]);
});
test('Pasted Excel TSV and whitespace data with Fortran notation', () => {
  assert.deepEqual(parseTable('X\tY\n0\t1,5\n1\t2,3').rows, [
    [0, 1.5],
    [1, 2.3],
  ]);
  assert.deepEqual(parseTable('@ ignored\n0 1D-3\n1 2d0').rows, [
    [0, 0.001],
    [1, 2],
  ]);
});
test('Missing cells, unequal rows, nonfinite values and mixed invalid numeric rows fail', () => {
  for (const text of ['X,Y\n0,', '0,1\n1,2,3', '0,Infinity', '0,NaN', '0,no', 'X,Y', '"X,Y\n0,1'])
    assert.throws(() => parseTable(text));
});
test('Mapping handles multi-column input and rejects duplicate/out-of-range columns and negative uncertainties', () => {
  const table = parseTable('t,a,b,e\n0,10,20,1\n1,11,22,2');
  assert.deepEqual(mapColumns(table, 0, 2, 3), [
    [0, 20, 1],
    [1, 22, 2],
  ]);
  assert.throws(() => mapColumns(table, 0, 0, null), /diferentes/);
  assert.throws(() => mapColumns(table, 0, 9, null), /válidas/);
  assert.throws(() => mapColumns(parseTable('0,1,-2'), 0, 1, 2), /incertezas/);
});
test('Autoscale fits new XYDY data and error bars while ignoring hidden curves', () => {
  const scene = createBlank(),
    g = scene.graphs[0],
    s = createSet(0);
  s.type = 'xydy';
  s.rows = [
    [10, 20, 5],
    [20, 40, 6],
  ];
  const hidden = createSet(1);
  hidden.rows = [[10000, 10000]];
  hidden.hidden = true;
  g.sets = [s, hidden];
  autoscaleGraph(g);
  assert.ok(g.world[0] < 10 && g.world[2] > 20 && g.world[2] < 100);
  assert.ok(g.world[1] < 15 && g.world[3] > 46);
  assert.ok(g.axes.xaxis.ticks.major > 0);
  const round = parseAgr(serializeAgr(scene));
  assert.deepEqual(round.graphs[0].sets[0].rows, s.rows);
});
test('Autoscale accepts single points and flat series', () => {
  const g = createBlank().graphs[0],
    s = createSet();
  s.rows = [[0, 0]];
  g.sets = [s];
  autoscaleGraph(g);
  assert.ok(g.world[0] < 0 && g.world[2] > 0 && g.world[1] < 0 && g.world[3] > 0);
});
test('Log autoscale uses drawable pairs and reciprocal failures are atomic', () => {
  const g = createBlank().graphs[0],
    s = createSet();
  g.axes.xaxis.scale = 'Logarithmic';
  s.rows = [
    [-1, 999],
    [1, 2],
    [10, 3],
  ];
  g.sets = [s];
  autoscaleGraph(g);
  assert.equal(g.world[0], 1);
  assert.ok(g.world[3] < 10);
  assert.equal(g.axes.xaxis.ticks.major, 10);
  const before = structuredClone(g);
  g.axes.yaxis.scale = 'Reciprocal';
  s.rows = [
    [1, -1],
    [2, 1],
  ];
  assert.throws(() => autoscaleGraph(g), /atravessar zero/);
  assert.deepEqual(g.world, before.world);
});
test('Local drafts restore valid documents and reject corrupted or incompatible data', () => {
  const scene = createBlank();
  const value = JSON.stringify({ scene, name: 'Meu gráfico.agr' });
  assert.deepEqual(readDraft(value), { scene, name: 'Meu gráfico.agr' });
  assert.equal(readDraft('not json'), null);
  assert.equal(readDraft('{"scene":{}}'), null);
  scene.graphs[0].world = [1, 0, 0, 1];
  assert.equal(readDraft(JSON.stringify({ scene, name: 'bad' })), null);
});
test('Decimal commas in whitespace numeric files do not become CSV delimiters', () => {
  assert.deepEqual(parseTable('0 1,25\n1 2,50').rows, [
    [0, 1.25],
    [1, 2.5],
  ]);
  assert.deepEqual(parseTable('0, 1\n1,2').rows, [
    [0, 1],
    [1, 2],
  ]);
});
test('Grace Latin-1 files and modern UTF-8 tables preserve accented labels', async () => {
  const { decodeScientificText } = await import('../src/core/import/encoding');
  const latin = Buffer.from('@title "função"', 'latin1');
  assert.equal(decodeScientificText(latin), '@title "função"');
  assert.equal(decodeScientificText(Buffer.from('Tempo;Medição', 'utf8')), 'Tempo;Medição');
  assert.equal(decodeScientificText(Buffer.from('\ufeffX\tY\n0\t1', 'utf16le')), 'X\tY\n0\t1');
});
