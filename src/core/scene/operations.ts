import type { Scene } from './types';
/** Reports belong to the fitted curve. Reports of other fits remain historical snapshots. */
export function removeSeries(scene: Scene, graphId: number, setId: number) {
  const graph = scene.graphs.find((g) => g.id === graphId);
  if (!graph) return;
  graph.sets = graph.sets.filter((s) => s.id !== setId);
  if (graph.regressions)
    graph.regressions = graph.regressions.filter((r) => r.curveSetId !== setId);
  scene.compatibility.preserved = scene.compatibility.preserved.filter(
    (d) => !(d.graphId === graphId && new RegExp(`^@\\s*s${setId}\\b`, 'i').test(d.raw)),
  );
}
