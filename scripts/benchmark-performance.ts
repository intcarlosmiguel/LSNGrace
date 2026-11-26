import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { createBlank, createSet } from '../src/core/scene/defaults';
import { useDocument } from '../src/state/document';
import { serializeAgr } from '../src/core/agr/serializer';
import { graceEncoding, renderGraceDetailed } from '../server/grace';
import { hitPath } from '../src/features/canvas/interactions';
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
function measure(fn: () => unknown, count = 5) {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    fn();
    values.push(performance.now() - start);
  }
  return +median(values).toFixed(2);
}
const report = [];
for (const count of [208, 10000, 100000]) {
  const scene = createBlank(),
    graph = scene.graphs[0],
    curve = createSet();
  curve.rows = Array.from({ length: count }, (_, i) => [i, Math.sin(i * 0.01)]);
  graph.sets = [curve];
  graph.world = [0, -1.2, count, 1.2];
  graph.axes.xaxis.ticks.major = count / 5;
  graph.axes.yaxis.ticks.major = 0.5;
  useDocument.getState().load(scene, 'benchmark.agr');
  const editMs = measure(() =>
    useDocument.getState().edit((s) => {
      s.graphs[0].title.text = `${performance.now()}`;
    }),
  );
  const agr = serializeAgr(useDocument.getState().scene);
  const row = {
    points: count,
    editMs,
    serializeMs: measure(() => serializeAgr(useDocument.getState().scene)),
    encodingMs: measure(() => graceEncoding(agr)),
    hitPathMs: measure(() => hitPath(graph, curve.rows, 612, 428, 92, 92)),
    nativeMs: 0,
  };
  const start = performance.now();
  await renderGraceDetailed(agr);
  row.nativeMs = +(performance.now() - start).toFixed(2);
  report.push(row);
}
console.table(report);
const destination = process.argv[2];
if (destination) await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
