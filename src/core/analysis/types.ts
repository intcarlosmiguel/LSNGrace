export type RegressionMethod =
  | 'linear'
  | 'polynomial'
  | 'power'
  | 'exponential'
  | 'logarithmic'
  | 'inverse'
  | 'gaussian'
  | 'lorentzian'
  | 'custom';
export interface CustomFitSettings {
  formula: string;
  parameters: Record<string, { initial: number; min?: number; max?: number; fixed?: boolean }>;
  tolerance?: number;
  maxIterations?: number;
}
export interface RegressionOptions {
  custom?: CustomFitSettings;
  method: RegressionMethod;
  degree?: number;
  fitMin?: number;
  fitMax?: number;
  sampling?: 'source' | 'uniform';
  curveMin?: number;
  curveMax?: number;
  samples?: number;
  residuals?: boolean;
  initial?: number[];
}
/** Immutable snapshot of a fit; separate from the Grace XY dataset type. */
export interface RegressionReport {
  kind: 'regression';
  custom?: CustomFitSettings & { normalizedExpression: string };
  id: number;
  sourceSetId: number;
  curveSetId: number;
  residualSetId?: number;
  sourceLabel: string;
  method: RegressionMethod;
  algorithm: string;
  equation: string;
  parameters: { name: string; value: number; standardError: number | null }[];
  count: number;
  degreesOfFreedom: number;
  sse: number;
  rmse: number;
  residualStandardError: number | null;
  rSquared: number | null;
  adjustedRSquared: number | null;
  objectiveSse: number;
  objectiveScale: string;
  fitRange: [number, number];
  iterations: number;
  warnings: string[];
}
