import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGraceSvg } from '../src/rendering/native/normalizeSvg';

test('Grace CSS font sizes get explicit units without changing native text geometry', () => {
  const source = `<text style="font-family:'Times'; font-size:612.0000" transform="matrix(0.028,0,0,-0.028,10,20)">10000</text>`;
  const result = normalizeGraceSvg(source);
  assert.equal(result, source.replace('612.0000', '612.0000px'));
  assert.equal(normalizeGraceSvg(result), result);
});

test('SVG normalization preserves qualified lengths, unrelated styles and label content', () => {
  for (const source of [
    '<text style="font-size:12px">font-size:612.0000</text>',
    '<text style="font-size:1.2em; fill:#000">12</text>',
    '<text font-size="612">label</text>',
    `<text>style='font-size:612.0000'</text>`,
    '<path style="stroke-width:1.2" d="M1,2L3,4"/>',
  ])
    assert.equal(normalizeGraceSvg(source), source);
  assert.equal(
    normalizeGraceSvg('<text style="font-size: 6.12e2 ;fill:#000">x</text>'),
    '<text style="font-size: 6.12e2px ;fill:#000">x</text>',
  );
});
