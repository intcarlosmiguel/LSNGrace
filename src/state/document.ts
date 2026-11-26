import { produce, freeze } from 'immer';
import { create } from 'zustand';
import { createBlank } from '../core/scene/defaults';
import { validateScene } from '../core/scene/validate';
import type { Scene } from '../core/scene/types';
import { DRAFT_KEY, readDraft } from './draft';
import { currentEditGroup } from './editGroup';
let lastEditGroup: string | undefined;
function initialDraft() {
  try {
    return typeof localStorage === 'undefined' ? null : readDraft(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}
const restored = initialDraft();
interface DocumentState {
  scene: Scene;
  name: string;
  graphId: number;
  setId: number | null;
  past: Scene[];
  future: Scene[];
  dirty: boolean;
  rename: (name: string) => void;
  load: (scene: Scene, name: string) => void;
  select: (graphId: number, setId: number | null) => void;
  edit: (mutation: (scene: Scene) => void) => void;
  undo: () => void;
  redo: () => void;
}
export const useDocument = create<DocumentState>((set, get) => ({
  scene: freeze(restored?.scene ?? createBlank(), true),
  name: restored?.name ?? 'Meu gráfico.agr',
  graphId: 0,
  setId: null,
  past: [],
  future: [],
  dirty: false,
  rename: (name) => set({ name, dirty: true }),
  load: (scene, name) => {
    lastEditGroup = undefined;
    set({
      scene: freeze(scene, true),
      name,
      graphId: scene.graphs[0]?.id ?? 0,
      setId: null,
      past: [],
      future: [],
      dirty: false,
    });
  },
  select: (graphId, setId) => set({ graphId, setId }),
  edit: (mutation) => {
    const current = get();
    const scene = produce(current.scene, (draft) => {
      mutation(draft);
    });
    if (scene === current.scene) return;
    const errors = validateScene(scene);
    if (errors.length) throw Error(errors.join('\n'));
    const group = currentEditGroup(),
      coalesce = group !== undefined && group === lastEditGroup && current.future.length === 0;
    lastEditGroup = group;
    set({
      scene,
      past: coalesce ? current.past : [...current.past, current.scene],
      future: [],
      dirty: true,
    });
  },
  undo: () => {
    lastEditGroup = undefined;
    const s = get(),
      scene = s.past.at(-1);
    if (scene)
      set({ scene, past: s.past.slice(0, -1), future: [s.scene, ...s.future], dirty: true });
  },
  redo: () => {
    lastEditGroup = undefined;
    const s = get(),
      scene = s.future[0];
    if (scene) set({ scene, past: [...s.past, s.scene], future: s.future.slice(1), dirty: true });
  },
}));
