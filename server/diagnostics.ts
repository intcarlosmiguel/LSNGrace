export const TRUNCATION_WARNING =
  'Há elementos fora da página de publicação. Confira a posição da legenda, o viewport e as dimensões da página antes de exportar.';
/** Grace emits this layout warning on stderr even when it successfully produces a drawing.
 * Unknown messages remain errors: a partial drawing must not hide invalid AGR syntax. */
export function graceDiagnostics(stderr: string): { warnings: string[]; errors: string[] } {
  const warnings = new Set<string>(),
    errors: string[] = [];
  for (const line of stderr
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (
      /^(?:(?:warning|grace):\s*)?Output is truncated\s*-\s*tune device dimensions[.!]?$/i.test(
        line,
      )
    )
      warnings.add(TRUNCATION_WARNING);
    else errors.push(line);
  }
  return { warnings: [...warnings], errors };
}
