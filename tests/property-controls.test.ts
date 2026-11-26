import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepNumber } from '../src/components/numberStep';
import { panelLimits } from '../src/components/ResizableProperties';

test('Numeric buttons respect fractional scientific increments and bounds', () => {
  assert.equal(stepNumber(0.2, 1, '0.1'), 0.3);
  assert.equal(stepNumber(0.3, -1, '0.1'), 0.2);
  assert.equal(stepNumber(0.98, 1, '.05', 0, 1), 1);
  assert.equal(stepNumber(0.02, -1, '.05', 0, 1), 0);
  assert.equal(stepNumber(17.136, 1), 18.136);
  assert.equal(stepNumber(5, -1, '1', 5), 5);
  assert.equal(stepNumber(1e-5, 1, '1e-5'), 2e-5);
});
test('Inspector resize limits reserve canvas space, including small windows', () => {
  assert.deepEqual(panelLimits(800), { min: 180, max: 660 });
  assert.deepEqual(panelLimits(314), { min: 174, max: 174 });
  for (const available of [314, 500, 800, 1600]) {
    const { min, max } = panelLimits(available);
    assert.ok(min <= max && min > 0);
    assert.ok(available - max >= 140);
  }
});
