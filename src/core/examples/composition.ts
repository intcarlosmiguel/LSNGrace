import { createGraph, createScene, createSet } from '../scene/defaults';
import type { Graph, Scene } from '../scene/types';
function panel(graph: Graph, title: string, yLabel: string) {
  graph.title.text = title;
  graph.title.size = 1.2;
  graph.axes.xaxis.label.text = 'Tempo (s)';
  graph.axes.yaxis.label.text = yLabel;
  graph.axes.xaxis.label.size = graph.axes.yaxis.label.size = 0.9;
  graph.axes.xaxis.tickLabels.size = graph.axes.yaxis.tickLabels.size = 0.8;
  graph.axes.xaxis.ticks.major = 2;
  graph.axes.yaxis.ticks.major = 0.2;
  graph.legend.size = 0.75;
}
/** Deterministic synthetic data: two independent panels and a zoomed inset. */
export function createCompositionExample(): Scene {
  const scene = createScene();
  scene.page.size = [900, 600];
  const relaxation = createGraph(0);
  relaxation.viewport = [0.12, 0.16, 0.7, 0.82];
  relaxation.world = [0, -0.06, 10, 1.15];
  panel(relaxation, 'Relaxação', 'Amplitude');
  relaxation.subtitle.text = 'Dados sintéticos e modelo';
  relaxation.subtitle.size = 0.75;
  relaxation.legend.position = [0.16, 0.35];
  const model = createSet(0);
  model.legend = 'Modelo exponencial';
  model.line.color = 4;
  model.line.width = 1.5;
  model.rows = Array.from({ length: 201 }, (_, i) => [i / 20, Math.exp(-i / 55)]);
  const observations = createSet(1);
  observations.type = 'xydy';
  observations.legend = 'Medições simuladas';
  observations.line.connection = 0;
  observations.symbol.type = 1;
  observations.symbol.size = 0.45;
  observations.symbol.color = observations.errorBars.color = 2;
  observations.symbol.fill.pattern = 1;
  observations.errorBars.size = 0.5;
  observations.rows = Array.from({ length: 17 }, (_, i) => [
    i * 0.6,
    Math.exp((-i * 0.6) / 2.75) + 0.018 * Math.sin(i * 2.3),
    0.025,
  ]);
  relaxation.sets = [model, observations];

  const oscillation = createGraph(1);
  oscillation.viewport = [0.91, 0.16, 1.44, 0.82];
  oscillation.world = [0, -0.85, 10, 1.15];
  panel(oscillation, 'Oscilação amortecida', 'Deslocamento');
  oscillation.subtitle.text = 'Envelope e resposta temporal';
  oscillation.subtitle.size = 0.75;
  oscillation.axes.yaxis.ticks.major = 0.5;
  oscillation.legend.position = [0.96, 0.76];
  const response = createSet(0);
  response.legend = 'Sinal';
  response.line.color = 15;
  response.line.width = 1.6;
  response.rows = Array.from({ length: 401 }, (_, i) => {
    const t = i / 40;
    return [t, Math.exp(-t / 4) * Math.cos(2 * Math.PI * 0.65 * t)];
  });
  const envelope = createSet(1);
  envelope.legend = 'Envelope';
  envelope.line.color = 11;
  envelope.line.style = 3;
  envelope.line.width = 1.3;
  envelope.rows = Array.from({ length: 201 }, (_, i) => [i / 20, Math.exp(-i / 80)]);
  oscillation.sets = [response, envelope];

  const inset = createGraph(2);
  inset.viewport = [0.4, 0.47, 0.66, 0.69];
  inset.world = [0, 0.6, 1.2, 1.03];
  inset.title.text = 'Detalhe inicial';
  inset.title.size = 0.65;
  inset.legend.enabled = false;
  inset.frame.background.pattern = 1;
  for (const axis of Object.values(inset.axes)) {
    axis.tickLabels.size = 0.55;
    axis.ticks.majorSize = 0.55;
    axis.ticks.minorSize = 0.3;
  }
  inset.axes.xaxis.ticks.major = 0.4;
  inset.axes.yaxis.ticks.major = 0.2;
  const detail = createSet(0);
  detail.line.color = 4;
  detail.line.width = 1.3;
  detail.rows = model.rows.filter(([x]) => x <= 1.2).map((row) => [...row]);
  inset.sets = [detail];
  scene.graphs = [relaxation, oscillation, inset];
  return scene;
}
