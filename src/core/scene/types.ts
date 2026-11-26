import type { SeriesWorksheet } from '../analysis/worksheet';
import type { RegressionReport } from '../analysis/types';
/** Units: page = PostScript points; viewport = fraction of MIN(page width, height).
 * Numeric Grace indices are retained, including custom indexed colors and fonts. */
export type Bounds = [number, number, number, number];
export type Point = [number, number];
export type Scale = 'Normal' | 'Logarithmic' | 'Reciprocal';
export type AxisId = 'xaxis' | 'yaxis' | 'altxaxis' | 'altyaxis';
export type SetType =
  | 'xy'
  | 'xydx'
  | 'xydy'
  | 'xydxdy'
  | 'xydxdx'
  | 'xydydy'
  | 'xydxdxdydy'
  | 'bar'
  | 'bardy'
  | 'xyhilo'
  | 'xyboxplot'
  | 'xysize';
export type SymbolType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type LineStyle = 0 | 1 | 2 | 3 | 4 | 5;
export type Connection = 0 | 1 | 2 | 3 | 4 | 5;
export type NumberFormat = 'decimal' | 'exponential' | 'power' | 'scientific' | 'general';
export interface TextStyle {
  text: string;
  font: number;
  size: number;
  color: number;
}
export interface Stroke {
  color: number;
  width: number;
  style: LineStyle;
}
export interface Fill {
  opacity?: number;
  color: number;
  pattern: number;
}
export interface Axis {
  zero?: boolean;
  offset?: Point;
  enabled: boolean;
  scale: Scale;
  inverted: boolean;
  label: TextStyle;
  bar: Stroke & { enabled: boolean };
  ticks: {
    enabled: boolean;
    major: number;
    minorCount: number;
    rounded: boolean;
    direction: 'in' | 'out' | 'both';
    place: 'normal' | 'opposite' | 'both';
    majorSize: number;
    minorSize: number;
    majorStroke: Stroke;
    minorStroke: Stroke;
    majorGrid: boolean;
    minorGrid: boolean;
  };
  tickLabels: TextStyle & {
    enabled: boolean;
    format: NumberFormat;
    precision: number;
    place: 'normal' | 'opposite' | 'both';
    skip?: number;
    stagger?: number;
    angle: number;
    prepend: string;
    append: string;
  };
}
export interface DataSet {
  worksheet?: SeriesWorksheet;
  opacity?: number;
  id: number;
  type: SetType | (string & {});
  hidden: boolean;
  rows: number[][];
  legend: string;
  comment: string;
  line: Stroke & { connection: Connection };
  symbol: {
    type: SymbolType;
    size: number;
    color: number;
    width: number;
    style: LineStyle;
    fill: Fill;
    character: number;
    font: number;
    skip: number;
  };
  fill: Fill & { type: number; rule: number };
  errorBars: {
    enabled: boolean;
    place: 'normal' | 'opposite' | 'both';
    color: number;
    pattern: number;
    size: number;
    width: number;
    style: LineStyle;
    riserWidth: number;
    riserStyle: LineStyle;
    clip: boolean;
    clipLength: number;
  };
  source?: {
    path: string;
    format: string;
    columns: Record<string, number>;
    linked: boolean;
    sheet?: string;
    dataset?: string;
  };
  analysis?: {
    expression?: string;
    method?: string;
    parameters?: Record<string, number>;
    rSquared?: number;
    sourceSetIds: number[];
  };
}
export interface Legend {
  layout?: 'vertical' | 'horizontal' | 'columns';
  columns?: number;
  columnGap?: number;
  symbolScale?: number;
  enabled: boolean;
  coordinates: 'view' | 'world';
  position: Point;
  font: number;
  size: number;
  color: number;
  length: number;
  vgap: number;
  hgap: number;
  inverted: boolean;
  box: Stroke & { pattern: number; fill: Fill };
}
export type Annotation =
  | {
      kind: 'text';
      id: number;
      graphId?: number;
      coordinates: 'view' | 'world';
      position: Point;
      text: TextStyle;
      rotation: number;
    }
  | {
      kind: 'line';
      id: number;
      graphId?: number;
      coordinates: 'view' | 'world';
      bounds: Bounds;
      stroke: Stroke;
      arrow: number;
    }
  | {
      kind: 'box' | 'ellipse';
      id: number;
      graphId?: number;
      coordinates: 'view' | 'world';
      bounds: Bounds;
      stroke: Stroke;
      fill: Fill;
    };
export interface Graph {
  regressions?: RegressionReport[];
  grid?: { major?: Stroke & { opacity: number }; minor?: Stroke & { opacity: number } };
  id: number;
  enabled: boolean;
  hidden: boolean;
  type: string;
  world: Bounds;
  viewport: Bounds;
  title: TextStyle;
  subtitle: TextStyle;
  axes: Record<AxisId, Axis>;
  frame: Stroke & { type: number; pattern: number; background: Fill };
  sets: DataSet[];
  legend: Legend;
  annotations: Annotation[];
}
export interface Diagnostic {
  severity: 'warning' | 'error';
  line: number;
  message: string;
}
/** Raw statements retain order within their original scope; never evaluated as code. */
export interface PreservedDirective {
  scope: 'page' | 'graph';
  graphId?: number;
  raw: string;
}
export interface Scene {
  schemaVersion: 1;
  graceVersion: number;
  page: { size: Point; background: number; fill: boolean };
  colors: { id: number; name: string; rgb: [number, number, number] }[];
  fonts: { id: number; name: string; fallback: string }[];
  graphs: Graph[];
  annotations: Annotation[];
  compatibility: { preserved: PreservedDirective[]; diagnostics: Diagnostic[] };
}
