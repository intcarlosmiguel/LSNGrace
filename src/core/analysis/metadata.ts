import { customFitDefinition } from './custom';
import type { RegressionReport } from './types';
import { regressionMethods } from './regression';
/** Guard the optional application metadata in imported, potentially untrusted AGR. */
export function isRegressionReport(value: unknown): value is RegressionReport {
  if (!value || typeof value !== 'object') return false;
  const r = value as RegressionReport;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const id = (n: unknown) => finite(n) && Number.isSafeInteger(n) && n >= 0;
  const nullable = (n: unknown) => n === null || finite(n);
  return (
    r.kind === 'regression' &&
    (r.method !== 'custom' || validCustomReport(r)) &&
    Object.hasOwn(regressionMethods, r.method) &&
    [r.id, r.sourceSetId, r.curveSetId].every(id) &&
    (r.residualSetId === undefined || id(r.residualSetId)) &&
    typeof r.sourceLabel === 'string' &&
    typeof r.algorithm === 'string' &&
    typeof r.equation === 'string' &&
    typeof r.objectiveScale === 'string' &&
    Array.isArray(r.parameters) &&
    r.parameters.length > 0 &&
    r.parameters.length <= 11 &&
    r.parameters.every(
      (p) => p && typeof p.name === 'string' && finite(p.value) && nullable(p.standardError),
    ) &&
    [r.count, r.degreesOfFreedom, r.iterations].every(
      (n) => finite(n) && Number.isInteger(n) && n >= 0,
    ) &&
    [r.sse, r.rmse, r.objectiveSse].every((n) => finite(n) && n >= 0) &&
    [r.rSquared, r.adjustedRSquared, r.residualStandardError].every(nullable) &&
    Array.isArray(r.fitRange) &&
    r.fitRange.length === 2 &&
    r.fitRange.every(finite) &&
    r.fitRange[0] < r.fitRange[1] &&
    Array.isArray(r.warnings) &&
    r.warnings.every((w) => typeof w === 'string')
  );
}

function validCustomReport(report: RegressionReport): boolean {
  try {
    if (!report.custom || typeof report.custom.normalizedExpression !== 'string') return false;
    if (report.equation !== report.custom.formula) return false;
    const definition = customFitDefinition(report.custom);
    if (definition.expression.normalized !== report.custom.normalizedExpression) return false;
    if (
      !Array.isArray(report.parameters) ||
      report.parameters.length !== definition.parameters.length
    )
      return false;
    return definition.parameters.every(
      (p, i) =>
        report.parameters[i]?.name === p.name &&
        (report.custom!.parameters[p.name].fixed === undefined ||
          typeof report.custom!.parameters[p.name].fixed === 'boolean'),
    );
  } catch {
    return false;
  }
}
