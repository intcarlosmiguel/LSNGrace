import type { Axis, DataSet, Graph, Scene, TextStyle } from './types';
const text = (size = 1): TextStyle => ({ text: '', font: 0, size, color: 1 });
const stroke = () => ({ color: 1, width: 1, style: 1 as const });
export const palette = [
  'FFFFFF',
  '000000',
  'FF0000',
  '00FF00',
  '0000FF',
  'FFFF00',
  'BC8F8F',
  'DCDCDC',
  '9400D3',
  '00FFFF',
  'FF00FF',
  'FFA500',
  '7221BC',
  '670748',
  '40E0D0',
  '008B00',
];
const names = [
  'white',
  'black',
  'red',
  'green',
  'blue',
  'yellow',
  'brown',
  'grey',
  'violet',
  'cyan',
  'magenta',
  'orange',
  'indigo',
  'maroon',
  'turquoise',
  'green4',
];
export function createAxis(enabled = true): Axis {
  return {
    enabled,
    scale: 'Normal',
    inverted: false,
    label: text(),
    bar: { ...stroke(), enabled: true },
    ticks: {
      enabled: true,
      major: 0.2,
      minorCount: 1,
      rounded: true,
      direction: 'in',
      place: 'both',
      majorSize: 1,
      minorSize: 0.5,
      majorStroke: stroke(),
      minorStroke: stroke(),
      majorGrid: false,
      minorGrid: false,
    },
    tickLabels: {
      ...text(),
      enabled: true,
      format: 'general',
      precision: 5,
      place: 'normal',
      angle: 0,
      prepend: '',
      append: '',
    },
  };
}
export function createSet(id = 0): DataSet {
  return {
    id,
    type: 'xy',
    hidden: false,
    rows: [],
    legend: '',
    comment: '',
    line: { ...stroke(), connection: 1 },
    symbol: {
      type: 0,
      size: 1,
      color: 1,
      width: 1,
      style: 1,
      fill: { color: 1, pattern: 0 },
      character: 65,
      font: 0,
      skip: 0,
    },
    fill: { type: 0, rule: 0, color: 1, pattern: 1 },
    errorBars: {
      enabled: true,
      place: 'both',
      color: 1,
      pattern: 1,
      size: 1,
      width: 1,
      style: 1,
      riserWidth: 1,
      riserStyle: 1,
      clip: false,
      clipLength: 0.1,
    },
  };
}
export function createGraph(id = 0): Graph {
  return {
    id,
    enabled: true,
    hidden: false,
    type: 'XY',
    world: [0, 0, 1, 1],
    viewport: [0.15, 0.15, 1.15, 0.85],
    title: text(1.5),
    subtitle: text(),
    axes: {
      xaxis: createAxis(),
      yaxis: createAxis(),
      altxaxis: createAxis(false),
      altyaxis: createAxis(false),
    },
    frame: { ...stroke(), type: 0, pattern: 1, background: { color: 0, pattern: 0 } },
    sets: [],
    annotations: [],
    legend: {
      enabled: true,
      coordinates: 'view',
      position: [0.85, 0.8],
      font: 0,
      size: 1,
      color: 1,
      length: 4,
      vgap: 1,
      hgap: 1,
      inverted: false,
      box: { ...stroke(), pattern: 1, fill: { color: 0, pattern: 1 } },
    },
  };
}
export function createScene(): Scene {
  const fonts = [
    'Times-Roman',
    'Times-Italic',
    'Times-Bold',
    'Times-BoldItalic',
    'Helvetica',
    'Helvetica-Oblique',
    'Helvetica-Bold',
    'Helvetica-BoldOblique',
    'Courier',
    'Courier-Oblique',
    'Courier-Bold',
    'Courier-BoldOblique',
    'Symbol',
    'ZapfDingbats',
  ];
  return {
    schemaVersion: 1,
    graceVersion: 50122,
    page: { size: [792, 612], background: 0, fill: true },
    colors: palette.map((hex, id) => ({
      id,
      name: names[id],
      rgb: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number],
    })),
    fonts: fonts.map((name, id) => ({ id, name, fallback: name })),
    graphs: [],
    annotations: [],
    compatibility: { preserved: [], diagnostics: [] },
  };
}
export function createDemo(): Scene {
  const scene = createScene(),
    graph = createGraph();
  graph.world = [0, -0.15, 10, 1.25];
  graph.axes.xaxis.ticks.major = 2;
  graph.axes.yaxis.ticks.major = 0.2;
  graph.title.text = 'Relaxation dynamics';
  graph.subtitle.text = 'Experiment and exponential model';
  graph.axes.xaxis.label.text = 'Time (s)';
  graph.axes.yaxis.label.text = 'Normalized amplitude';
  const model = createSet(0);
  model.legend = 'Exponential model';
  model.line.color = 4;
  model.line.width = 1.5;
  model.rows = Array.from({ length: 201 }, (_, i) => [i / 20, Math.exp(-i / 55)]);
  const measured = createSet(1);
  measured.type = 'xydy';
  measured.legend = 'Measured signal';
  measured.line.connection = 0;
  measured.symbol = {
    ...measured.symbol,
    type: 1,
    size: 0.7,
    color: 2,
    fill: { color: 0, pattern: 1 },
  };
  measured.errorBars.color = 2;
  measured.rows = Array.from({ length: 17 }, (_, i) => [
    i * 0.6,
    Math.exp((-i * 0.6) / 2.75) + 0.025 * Math.sin(i * 2.3),
    0.035,
  ]);
  graph.sets = [model, measured];
  graph.legend.position = [0.79, 0.76];
  scene.graphs = [graph];
  return scene;
}

export function createBlank(): Scene {
  const scene = createScene(),
    graph = createGraph();
  graph.axes.xaxis.label.text = 'X';
  graph.axes.yaxis.label.text = 'Y';
  scene.graphs = [graph];
  return scene;
}
