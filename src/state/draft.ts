import { immutableRows } from '../core/scene/immutableRows';
import type { Scene } from '../core/scene/types';
import { validateScene } from '../core/scene/validate';
export const DRAFT_KEY = 'lsngrace.document.v1';
export function readDraft(value: string | null): { scene: Scene; name: string } | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value);
    if (
      draft.scene?.schemaVersion !== 1 ||
      !Array.isArray(draft.scene.colors) ||
      !Array.isArray(draft.scene.fonts) ||
      !Array.isArray(draft.scene.graphs) ||
      !Array.isArray(draft.scene.annotations) ||
      typeof draft.name !== 'string' ||
      !Array.isArray(draft.scene.compatibility?.preserved) ||
      !Array.isArray(draft.scene.compatibility?.diagnostics) ||
      validateScene(draft.scene).length
    )
      return null;
    return { scene: draft.scene, name: draft.name };
  } catch {
    return null;
  }
}

// Styling revisions share immutable row arrays. Serialize their numeric blocks
// once instead of traversing every point again for each autosave.
const draftRows = new WeakMap<number[][], string>();
function rowsJson(rows: number[][]): string {
  const cacheable = immutableRows(rows);
  const cached = cacheable ? draftRows.get(rows) : undefined;
  if (cached !== undefined) return cached;
  const json = JSON.stringify(rows);
  if (cacheable) draftRows.set(rows, json);
  return json;
}
export function serializeDraft(scene: Scene, name: string): string {
  const graphs = scene.graphs.map((graph) => {
    const sets = graph.sets.map(
      (set) =>
        JSON.stringify({ ...set, rows: undefined }).slice(0, -1) +
        ',"rows":' +
        rowsJson(set.rows) +
        '}',
    );
    return (
      JSON.stringify({ ...graph, sets: undefined }).slice(0, -1) +
      ',"sets":[' +
      sets.join(',') +
      ']}'
    );
  });
  const json =
    JSON.stringify({ ...scene, graphs: undefined }).slice(0, -1) +
    ',"graphs":[' +
    graphs.join(',') +
    ']}';
  return '{"name":' + JSON.stringify(name) + ',"scene":' + json + '}';
}
