import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graceDiagnostics, TRUNCATION_WARNING } from '../server/diagnostics';
import { readNativeWarnings } from '../src/rendering/native/client';
test('Grace truncation is a recoverable layout warning, not a fatal render error', () => {
  assert.deepEqual(graceDiagnostics('Output is truncated - tune device dimensions\n'), {
    warnings: [TRUNCATION_WARNING],
    errors: [],
  });
});
test('Warnings never mask actual syntax errors in the same render', () => {
  assert.deepEqual(
    graceDiagnostics('Output is truncated - tune device dimensions\nsyntax error at line 8\n'),
    { warnings: [TRUNCATION_WARNING], errors: ['syntax error at line 8'] },
  );
  assert.deepEqual(graceDiagnostics('Warning: invalid tick expression'), {
    warnings: [],
    errors: ['Warning: invalid tick expression'],
  });
});
test('Empty stderr and repeated layout warnings are handled deterministically', () => {
  assert.deepEqual(graceDiagnostics(' \r\n'), { warnings: [], errors: [] });
  assert.deepEqual(
    graceDiagnostics(
      'Warning: Output is truncated - tune device dimensions\nOutput is truncated - tune device dimensions',
    ),
    { warnings: [TRUNCATION_WARNING], errors: [] },
  );
});
test('Native warnings round-trip through the HTTP header, including Portuguese accents', () => {
  assert.deepEqual(readNativeWarnings(encodeURIComponent(JSON.stringify([TRUNCATION_WARNING]))), [
    TRUNCATION_WARNING,
  ]);
  for (const header of [null, 'invalid json', '%', '{}'])
    assert.deepEqual(readNativeWarnings(header), []);
  assert.deepEqual(readNativeWarnings(encodeURIComponent('[7,"warning"]')), ['warning']);
});
