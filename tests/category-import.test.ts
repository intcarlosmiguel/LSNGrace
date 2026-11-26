import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMixedTable } from '../src/core/import/tabular';
import { mapSeries, insertSeries, type ImportStyle } from '../src/core/import/series';
import { createBlank, createDemo } from '../src/core/scene/defaults';
import { serializeAgr } from '../src/core/agr/serializer';
import { parseAgr } from '../src/core/agr/parser';
import { useDocument } from '../src/state/document';
const source =
  'Tempo,Valor,Erro,Grupo,Cor\n0,1,0.1,"Grupo, A",#e41a1c\n0,2,0.2,B,blue\n1,1.5,0.1,"Grupo, A",#E41A1C\n1,2.5,0.2,B,#00f';
const columns = { x: 0, y: 1, dy: 2, category: 3, color: 4 };
const style: ImportStyle = { line: 3, symbol: 2, color: null };
test('Categorical CSV groups interleaved rows in first-seen order with exact labels, errors and colors', () => {
  const table = parseMixedTable(source),
    result = mapSeries(table, columns, 'Importação', style);
  assert.deepEqual(
    result.map((s) => s.name),
    ['Grupo, A', 'B'],
  );
  assert.deepEqual(result[0].rows, [
    [0, 1, 0.1],
    [1, 1.5, 0.1],
  ]);
  assert.deepEqual(result[1].rows, [
    [0, 2, 0.2],
    [1, 2.5, 0.2],
  ]);
  assert.equal(result[0].style.color, '#E41A1C');
  assert.equal(result[1].style.color, 4);
  assert.equal(result[0].type, 'xydy');
});
test('Numeric category labels remain categorical strings and unused text is allowed', () => {
  const table = parseMixedTable('x;y;categoria;nota\n0;1,5;01;teste\n1;2,5;1;outro');
  const result = mapSeries(table, { x: 0, y: 1, dy: null, category: 2, color: null }, '', style);
  assert.deepEqual(
    result.map((s) => s.name),
    ['01', '1'],
  );
  assert.deepEqual(result[0].rows, [[0, 1.5]]);
});
test('Selected numeric columns, empty categories and color conflicts report errors without dropping rows', () => {
  assert.throws(
    () => mapSeries(parseMixedTable(source.replace('1,1.5', '1,ruim')), columns, '', style),
    /Linha 4, coluna 2/,
  );
  assert.throws(
    () => mapSeries(parseMixedTable(source.replace(',B,blue', ',,blue')), columns, '', style),
    /categoria/,
  );
  assert.throws(
    () => mapSeries(parseMixedTable(source.replace(',B,#00f', ',B,red')), columns, '', style),
    /cores diferentes/,
  );
  assert.throws(
    () => mapSeries(parseMixedTable(source.replace('#00f', 'invalid')), columns, '', style),
    /Cor/,
  );
  assert.throws(
    () => mapSeries(parseMixedTable(source), { ...columns, color: 3 }, '', style),
    /diferentes/,
  );
  assert.throws(
    () => mapSeries(parseMixedTable(source), { ...columns, category: null }, '', style),
    /categorias/,
  );
});
test('Line and symbols can be independently disabled; custom colors and category legends survive AGR', () => {
  const scene = createBlank(),
    g = scene.graphs[0];
  const inputs = mapSeries(parseMixedTable(source), columns, '', style);
  inputs[0].style.line = 0;
  inputs[1].style.symbol = 0;
  insertSeries(scene, g, inputs);
  const round = parseAgr(serializeAgr(scene));
  assert.equal(round.graphs[0].sets[0].line.style, 0);
  assert.equal(round.graphs[0].sets[1].symbol.type, 0);
  assert.deepEqual(
    round.graphs[0].sets.map((s) => s.legend),
    ['Grupo, A', 'B'],
  );
  const custom = round.colors.find((c) => c.id === round.graphs[0].sets[0].line.color)!;
  assert.deepEqual(custom.rgb, [228, 26, 28]);
  assert.equal(g.sets[0].symbol.color, g.sets[0].line.color);
  assert.equal(g.sets[0].errorBars.color, g.sets[0].line.color);
});
test('Automatic colors differ across categories and a batch is a single undo/redo operation', () => {
  const inputs = mapSeries(parseMixedTable(source), { ...columns, color: null }, '', style);
  const store = useDocument;
  store.getState().load(createBlank(), 'Categories');
  const original = store.getState().scene;
  store.getState().edit((s) => {
    insertSeries(s, s.graphs[0], inputs);
  });
  const added = store.getState().scene;
  assert.equal(added.graphs[0].sets.length, 2);
  assert.notEqual(added.graphs[0].sets[0].line.color, added.graphs[0].sets[1].line.color);
  store.getState().undo();
  assert.equal(store.getState().scene, original);
  store.getState().redo();
  assert.equal(store.getState().scene, added);
});
test('Editing numeric data preserves existing independent colors and rejects grouped replacement', () => {
  const scene = createDemo(),
    g = scene.graphs[0],
    s = g.sets[0];
  s.symbol.color = 2;
  s.symbol.fill.color = 15;
  const input = mapSeries(
    parseMixedTable('x,y\n0,3\n1,4'),
    { x: 0, y: 1, dy: null, category: null, color: null },
    s.legend,
    { line: s.line.style, symbol: s.symbol.type, color: s.line.color },
  );
  insertSeries(scene, g, input, s.id);
  assert.equal(g.sets.length, 2);
  assert.equal(s.symbol.color, 2);
  assert.equal(s.symbol.fill.color, 15);
  assert.deepEqual(s.rows, [
    [0, 3],
    [1, 4],
  ]);
  assert.throws(() => insertSeries(scene, g, [...input, ...input], s.id), /uma série/);
});
