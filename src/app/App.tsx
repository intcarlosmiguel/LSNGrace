import {
  copyTransformRecipe,
  pasteTransformRecipe,
  serializeTransformRecipe,
  type TransformRecipe,
} from '../core/analysis/transformClipboard';
import { TransformPanel } from '../features/data/TransformPanel';
import { removeSeries } from '../core/scene/operations';
import type { TreeTarget } from '../features/composition/TreeContextMenu';
import { RegressionPanel } from '../features/analysis/RegressionPanel';
import { insertRegression } from '../core/analysis/regression';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocument } from '../state/document';
import { currentEditGroup } from '../state/editGroup';
import { DRAFT_KEY, serializeDraft } from '../state/draft';
import { parseAgr } from '../core/agr/parser';
import { decodeScientificText } from '../core/import/encoding';
import { useGrace } from '../rendering/native/useGrace';
import { requestGraceOutput } from '../rendering/native/client';
import { ExportSettings } from '../features/export/ExportSettings';
import type { RasterOptions } from '../core/export/raster';
import { useTheme, themePalettes } from './useTheme';
import { HomeScreen } from '../features/home/HomeScreen';
import { recentFigures, saveRecent, deleteRecent, type RecentFigure } from '../state/recent';
import { canvasCamera } from '../features/canvas/camera';
import { zoomGraph } from '../features/canvas/interactions';
import { snapGraphResize } from '../features/canvas/resizeGuides';
import type { SmartGuide } from '../features/canvas/guides';
import { PlotCanvas, type CanvasMode, type InspectTarget } from '../features/canvas/PlotCanvas';
import { AgrEditor } from '../features/project/AgrEditor';
import { createBlank, createDemo, createGraph } from '../core/scene/defaults';
import { createCompositionExample } from '../core/examples/composition';
import { autoscaleGraph } from '../core/geometry/autoscale';
import type { Scene } from '../core/scene/types';
import { Icon } from '../components/Icon';
import { ResizableProperties } from '../components/ResizableProperties';
import { DataEditor } from '../features/data/DataEditor';
import { insertSeries, type SeriesInput } from '../core/import/series';
import { Inspector } from '../features/inspector/Inspector';
import { ExamplePicker } from '../features/composition/ExamplePicker';
import { FigureTree } from '../features/composition/FigureTree';
import { ImageProperties, GraphPlacement } from '../features/composition/CompositionProperties';
import {
  addGraph,
  removeGraph,
  moveViewport,
  type Placement,
} from '../features/composition/layout';
function download(content: Blob, name: string) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
interface Editor {
  key: number;
  text?: string;
  name?: string;
  setId?: number;
  graphId: number;
}
export default function App() {
  const state = useDocument();
  const { theme, palette, setPalette, toggleTheme } = useTheme();
  const [home, setHome] = useState(true);
  const [recents, setRecents] = useState<RecentFigure[]>([]);
  const figureId = useRef<string>(
    (() => {
      try {
        return localStorage.getItem('lsngrace.active-figure') || crypto.randomUUID();
      } catch {
        return crypto.randomUUID();
      }
    })(),
  );
  const thumbnails = useRef(new Map<string, string>());
  const refreshRecents = () => recentFigures().then(setRecents);
  useEffect(() => {
    void refreshRecents().catch(() =>
      notify('Histórico local indisponível neste navegador.', true),
    );
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
      () => window.matchMedia('(max-width: 700px)').matches,
    ),
    [propertiesOpen, setPropertiesOpen] = useState(false),
    [imageSelected, setImageSelected] = useState(false),
    [menu, setMenu] = useState<'file' | 'export' | null>(null),
    [wholePage, setWholePage] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CanvasMode>('select'),
    [agrOpen, setAgrOpen] = useState(false),
    [examplesOpen, setExamplesOpen] = useState(false),
    [keepGraphAspect, setKeepGraphAspect] = useState(false),
    [exporting, setExporting] = useState(false),
    [focusTarget, setFocusTarget] = useState<{ kind: InspectTarget; key: number }>();
  const { scene, name, graphId: requestedId, setId, edit, select } = state;
  const graph = scene.graphs.find((g) => g.id === requestedId) ?? scene.graphs[0];
  const graphId = graph?.id ?? 0;
  const selectedSet = graph?.sets.find((s) => s.id === setId);
  const [regression, setRegression] = useState<{
    graphId: number;
    sourceId?: number;
    reportId?: number;
    x: number;
    y: number;
  } | null>(null);
  const closeRegression = useCallback(() => setRegression(null), []);
  const openRegression = (id: number, sourceId: number, x: number, y: number) => {
    select(id, sourceId);
    setImageSelected(false);
    setRegression({ graphId: id, sourceId, x, y });
  };
  const regressionGraph = scene.graphs.find((g) => g.id === regression?.graphId);
  const regressionSource = regressionGraph?.sets.find((s) => s.id === regression?.sourceId);
  const regressionReport = regressionGraph?.regressions?.find((r) => r.id === regression?.reportId);
  const [transformClipboard, setTransformClipboard] = useState<TransformRecipe | null>(null);
  const [transformTarget, setTransformTarget] = useState<{ graphId: number; setId: number } | null>(
    null,
  );
  const transformSet = scene.graphs
    .find((g) => g.id === transformTarget?.graphId)
    ?.sets.find((s) => s.id === transformTarget?.setId);
  const [editor, setEditor] = useState<Editor | null>(null),
    [status, setStatus] = useState({
      text: '',
      error: false,
    }),
    [dragging, setDragging] = useState(false),
    [diagnosticsOpen, setDiagnosticsOpen] = useState(false),
    [saveState, setSaveState] = useState('Rascunho local');
  const fileRef = useRef<HTMLInputElement>(null),
    editorRef = useRef(editor),
    stageRef = useRef<HTMLDivElement>(null);
  const [paperWidth, setPaperWidth] = useState(700);
  const [resizeFeedback, setResizeFeedback] = useState<{
    scene: Scene;
    guides: SmartGuide[];
  } | null>(null);
  useEffect(() => {
    if (!resizeFeedback) return;
    const timer = setTimeout(() => setResizeFeedback(null), 1600);
    return () => clearTimeout(timer);
  }, [resizeFeedback]);
  editorRef.current = editor;
  const notify = (text: string, error = false) => setStatus({ text, error });
  const undo = () => {
    state.undo();
    notify('Última alteração desfeita.');
  };
  const redo = () => {
    state.redo();
    notify('Alteração refeita.');
  };
  const change = (fn: (scene: Scene) => void): boolean => {
    try {
      edit(fn);
      return true;
    } catch (e) {
      if (!currentEditGroup()) notify((e as Error).message, true);
      return false;
    }
  };
  const rendering = useGrace(scene);
  const warnings = rendering.warnings;
  const errors = scene.compatibility.diagnostics.filter((d) => d.severity === 'error');
  const preservedCount = scene.compatibility.preserved.length;
  const pointCount = graph?.sets.reduce((total, s) => total + s.rows.length, 0) ?? 0;
  const seriesCount = graph?.sets.length ?? 0;
  const hasFigure =
    mode === 'text' ||
    mode === 'addPoint' ||
    scene.compatibility.preserved.some((d) => /^@\s*with string\b/i.test(d.raw)) ||
    imageSelected ||
    scene.graphs.length > 1 ||
    scene.graphs.some((g) => g.sets.some((s) => s.rows.length || s.worksheet?.baseRows.length));
  const camera = useMemo(
    () => canvasCamera(scene, wholePage || scene.graphs.length > 1),
    [scene, wholePage],
  );
  const showProperties = (id: number = graphId, series: number | null = null) => {
    setTransformTarget(null);
    setFocusTarget(undefined);
    setImageSelected(false);
    setEditor(null);
    setExamplesOpen(false);
    setAgrOpen(false);
    select(id, series);
    setPropertiesOpen(true);
    setMenu(null);
  };
  const showImage = () => {
    setTransformTarget(null);
    setImageSelected(true);
    setPropertiesOpen(true);
    setSidebarCollapsed(false);
    setFocusTarget(undefined);
    setEditor(null);
    setExamplesOpen(false);
    setAgrOpen(false);
    setMenu(null);
    select(graphId, null);
  };
  const insertGraph = (placement: Placement) => {
    let id = graphId;
    if (
      change((s) => {
        id = addGraph(s, graphId, placement);
      })
    ) {
      showProperties(id);
      notify(
        placement === 'inset'
          ? `Gráfico G${id} criado dentro de G${graphId}.`
          : `Gráfico G${id} adicionado à imagem.`,
      );
    }
  };
  const deleteGraph = (id = graphId) => {
    if (change((s) => removeGraph(s, id))) {
      const next = useDocument.getState().scene.graphs[0].id;
      showProperties(next);
      notify('Gráfico removido. Use Desfazer para recuperar.');
    }
  };
  const deleteSeries = (id: number, seriesId: number) => {
    setTransformTarget(null);
    if (change((s) => removeSeries(s, id, seriesId))) {
      select(id, null);
      setPropertiesOpen(false);
      setEditor(null);
      setRegression(null);
      notify('Série removida. Use Desfazer para recuperar.');
    }
  };
  const deleteTreeTarget = (target: TreeTarget) => {
    setTransformTarget(null);
    if (target.kind === 'set') deleteSeries(target.graphId, target.setId);
    else if (target.kind === 'graph') {
      setRegression(null);
      setEditor(null);
      deleteGraph(target.graphId);
    } else if (change((s) => Object.assign(s, createBlank()))) {
      select(0, null);
      setImageSelected(false);
      setPropertiesOpen(false);
      setEditor(null);
      setRegression(null);
      notify('Imagem excluída. Use Desfazer para recuperar.');
    }
  };
  const scaleGraphArea = (factor: number) => {
    if (!graph) return;
    const b = graph.viewport,
      cx = (b[0] + b[2]) / 2,
      cy = (b[1] + b[3]) / 2,
      hw = ((b[2] - b[0]) * factor) / 2,
      hh = ((b[3] - b[1]) * factor) / 2;
    const result = snapGraphResize(scene, graph, [cx - hw, cy - hh, cx + hw, cy + hh], {
      corner: 3,
      centered: true,
      proportional: true,
      tolerance: (6 * camera.width) / paperWidth,
      direction: Math.sign(factor - 1),
    });
    if (change((s) => moveViewport(s, graphId, result.bounds)))
      setResizeFeedback({ scene: useDocument.getState().scene, guides: result.guides });
  };
  const zoom = (factor: number) => {
    if (
      graph &&
      change((s) =>
        zoomGraph(
          s.graphs.find((g) => g.id === graphId)!,
          0.5,
          0.5,
          factor,
        ),
      )
    )
      setStatus({ text: '', error: false });
  };
  const closeEditors = () => {
    setTransformTarget(null);
    setEditor(null);
    setExamplesOpen(false);
    setAgrOpen(false);
  };
  useEffect(() => {
    if (!status.text || status.error) return;
    const timer = setTimeout(() => setStatus({ text: '', error: false }), 3500);
    return () => clearTimeout(timer);
  }, [status]);
  useEffect(() => {
    if (!menu) return;
    const handler = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [menu]);
  const showTransform = (id: number, seriesId: number) => {
    setEditor(null);
    setAgrOpen(false);
    setExamplesOpen(false);
    setPropertiesOpen(false);
    setRegression(null);
    setImageSelected(false);
    select(id, seriesId);
    setTransformTarget({ graphId: id, setId: seriesId });
  };
  const copyTransformation = async (id: number, seriesId: number, columnId?: string) => {
    try {
      const set = scene.graphs.find((g) => g.id === id)?.sets.find((s) => s.id === seriesId);
      if (!set) throw Error('Série indisponível.');
      const recipe = copyTransformRecipe(set, columnId);
      setTransformClipboard(recipe);
      try {
        await navigator.clipboard.writeText(serializeTransformRecipe(recipe));
      } catch {
        /* Internal copy remains available through the series menu. */
      }
      notify(
        `${recipe.steps.length === 1 ? 'Transformação copiada' : 'Transformações copiadas'}. Use Colar transformação na série de destino.`,
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const pasteTransformation = async (id: number, seriesId: number) => {
    try {
      const recipe = transformClipboard;
      if (!recipe) throw Error('Copie uma transformação na lateral antes de colar.');
      let count = 0;
      edit((s) => {
        const graph = s.graphs.find((g) => g.id === id),
          set = graph?.sets.find((s) => s.id === seriesId);
        if (!set || !graph) throw Error('Série indisponível.');
        count = pasteTransformRecipe(set, recipe!).length;
        try {
          autoscaleGraph(graph);
        } catch {
          /* Preserve bounds when no drawable data remains. */
        }
      });
      showTransform(id, seriesId);
      notify(
        `${count} ${count === 1 ? 'transformação aplicada' : 'transformações aplicadas'} à série de destino. Ctrl+Z desfaz.`,
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const startEditor = (setToEdit?: number, targetId = graphId) => {
    setTransformTarget(null);
    setImageSelected(false);
    setExamplesOpen(false);
    setMenu(null);
    setPropertiesOpen(false);
    setAgrOpen(false);
    select(targetId, setToEdit ?? null);
    setEditor({ key: Date.now(), graphId: targetId, setId: setToEdit });
  };
  const fit = () => {
    if (!graph) return;
    if (change((s) => autoscaleGraph(s.graphs.find((g) => g.id === graphId)!)))
      notify('Eixos ajustados aos dados visíveis.');
  };
  const openExamples = () => {
    setHome(false);
    closeEditors();
    setPropertiesOpen(false);
    setMenu(null);
    setExamplesOpen(true);
  };
  const loadExample = (multiple: boolean) => {
    if (change((s) => Object.assign(s, multiple ? createCompositionExample() : createDemo()))) {
      select(0, null);
      closeEditors();
      setImageSelected(multiple);
      setSidebarCollapsed(false);
      setPropertiesOpen(false);
      setFocusTarget(undefined);
      setMenu(null);
      notify(
        multiple
          ? 'Imagem de exemplo criada com 3 gráficos: dois lado a lado e um interno.'
          : 'Imagem de exemplo criada com um gráfico.',
      );
    }
  };
  const remember = async () => {
    const current = useDocument.getState();
    const svg = rendering.revision === current.scene ? rendering.svg : '';
    if (svg)
      thumbnails.current.set(
        figureId.current,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      );
    try {
      localStorage.setItem('lsngrace.active-figure', figureId.current);
    } catch {
      /* IndexedDB still works independently. */
    }
    if (!current.scene.graphs.some((g) => g.sets.some((s) => s.rows.length))) return;
    await saveRecent({
      id: figureId.current,
      scene: current.scene,
      name: current.name,
      updated: Date.now(),
      thumbnail: thumbnails.current.get(figureId.current),
    });
    await refreshRecents();
  };
  const goHome = async () => {
    try {
      await remember();
    } catch {
      notify(
        'Não foi possível salvar esta imagem no histórico local. Exporte o projeto para preservá-la.',
        true,
      );
    }
    closeEditors();
    setMenu(null);
    setHome(true);
  };
  const newDocument = async () => {
    try {
      await remember();
    } catch {
      notify(
        'Histórico local indisponível. O rascunho atual continua disponível até criar a nova imagem.',
        true,
      );
      return;
    }
    figureId.current = crypto.randomUUID();
    setHome(false);
    setExamplesOpen(false);
    if (change((s) => Object.assign(s, createBlank()))) {
      setMenu(null);
      setImageSelected(false);
      setPropertiesOpen(false);
      setAgrOpen(false);
      state.rename('Minha imagem.agr');
      select(0, null);
      setEditor({ key: Date.now(), graphId: 0 });
      notify(
        'Nova imagem. Cole sua tabela ou importe um arquivo. O gráfico anterior pode ser recuperado com Desfazer.',
      );
    }
  };
  const applySeries = (inputs: SeriesInput[]) => {
    if (!editor) return false;
    const targetGraphId = editor.graphId;
    let targetSetId = editor.setId;
    const success = change((s) => {
      let g = s.graphs.find((g) => g.id === targetGraphId);
      if (!g) {
        g = createGraph(targetGraphId);
        s.graphs.push(g);
      }
      const first = g.sets.length === 0;
      targetSetId = insertSeries(s, g, inputs, editor.setId);
      const input = inputs[0];
      if (first) {
        if (!g.title.text.trim())
          g.title.text = input.importName || input.name.trim() || 'Meu gráfico';
        g.axes.xaxis.label.text = input.xLabel.startsWith('Coluna ') ? 'X' : input.xLabel;
        g.axes.yaxis.label.text = input.yLabel.startsWith('Coluna ') ? 'Y' : input.yLabel;
      }
      autoscaleGraph(g);
    });
    if (success) {
      select(targetGraphId, targetSetId ?? null);
      notify(
        `${inputs.length} ${inputs.length === 1 ? 'curva' : 'curvas'}: ${inputs.reduce((n, s) => n + s.rows.length, 0).toLocaleString('pt-BR')} pontos ${editor.setId === undefined ? 'adicionados' : 'atualizados'}.`,
      );
    }
    return success;
  };
  const openFile = async (file: File) => {
    try {
      setMenu(null);
      setPropertiesOpen(false);
      setExamplesOpen(false);
      setImageSelected(false);
      const text = decodeScientificText(new Uint8Array(await file.arrayBuffer()));
      if (/\.(agr|par)$/i.test(file.name)) {
        const parsed = parseAgr(text);
        if (!parsed.graphs.length)
          throw Error(
            'Nenhum gráfico encontrado no projeto. Para tabelas, use CSV, TSV, DAT ou TXT.',
          );
        await remember();
        figureId.current = crypto.randomUUID();
        state.load(parsed, file.name);
        setHome(false);
        setEditor(null);
        setAgrOpen(false);
        notify(
          `${file.name} aberto.`,
          parsed.compatibility.diagnostics.some((d) => d.severity === 'error'),
        );
      } else if (/\.(csv|tsv|dat|txt)$/i.test(file.name)) {
        setHome(false);
        const active = editorRef.current;
        setEditor({
          key: Date.now(),
          graphId: active?.graphId ?? graphId,
          setId: active?.setId,
          text,
          name: file.name.replace(/\.[^.]+$/, ''),
        });
        notify(`${file.name} carregado. Confira as colunas e clique em Criar curva.`);
      } else throw Error('Abra um arquivo CSV, TSV, DAT, TXT, AGR ou PAR.');
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const save = async (
    format: 'agr' | 'svg' | 'png' | 'eps' | 'pdf',
    options: RasterOptions = {},
  ) => {
    if (exporting) return;
    setMenu(null);
    setExporting(true);
    try {
      const { blob: content, warnings: exportWarnings } = await requestGraceOutput(
        scene,
        format,
        undefined,
        options,
      );
      const basename = (name.replace(/\.(agr|par|svg)$/i, '').trim() || 'Meu gráfico').replace(
        /[\\/]/g,
        '-',
      );
      download(content, `${basename}.${format}`);
      notify(
        exportWarnings.length
          ? `${basename}.${format} exportado. ${exportWarnings.join(' ')}`
          : `${basename}.${format} exportado pelo Grace original.`,
      );
    } catch (e) {
      notify((e as Error).message, true);
      setDiagnosticsOpen(true);
    } finally {
      setExporting(false);
    }
  };
  useEffect(() => {
    setSaveState('Salvando rascunho…');
    let idle: number | undefined;
    const persist = () => {
      try {
        localStorage.setItem(DRAFT_KEY, serializeDraft(scene, name));
        setSaveState('Rascunho salvo neste navegador');
      } catch {
        setSaveState('Exporte para salvar: armazenamento local indisponível');
      }
    };
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window)
        idle = window.requestIdleCallback(persist, { timeout: 1500 });
      else persist();
    }, 600);
    const flushDraft = () => {
      try {
        localStorage.setItem(DRAFT_KEY, serializeDraft(scene, name));
      } catch {
        /* The storage status already asks the user to export. */
      }
    };
    window.addEventListener('pagehide', flushDraft);
    return () => {
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.removeEventListener('pagehide', flushDraft);
    };
  }, [scene, name]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () => {
      const style = getComputedStyle(stage);
      const availableWidth =
        stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const availableHeight =
        stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setPaperWidth(
        Math.max(100, Math.min(availableWidth, (availableHeight * camera.width) / camera.height)),
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [camera.x, camera.y, camera.width, camera.height, sidebarCollapsed, hasFigure, home]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileRef.current?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save('agr');
      }
      if (!typing && (e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
        else undo();
      }
      if (!typing && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        fit();
      }
      if (e.key === 'Escape') {
        setDragging(false);
        setDiagnosticsOpen(false);
        setMenu(null);
        setPropertiesOpen(false);
        setExamplesOpen(false);
        if (!typing) {
          setEditor(null);
          setAgrOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  useEffect(() => {
    if (home) return;
    const timer = setTimeout(() => {
      void remember().catch(() =>
        notify(
          'Não foi possível atualizar o histórico local. Exporte o projeto para salvá-lo.',
          true,
        ),
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [scene, name, home, rendering.svg]);
  return (
    <div
      className={`application focus-layout ${sidebarCollapsed ? 'is-collapsed' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (
          !e.relatedTarget ||
          !(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget)
        )
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void openFile(file);
      }}
    >
      <header className="topbar">
        <div className="project-controls" ref={menuRef}>
          <button
            className="icon-button"
            aria-label="Tela inicial"
            title="Tela inicial"
            onClick={() => void goHome()}
          >
            <Icon name="home" size={20} />
          </button>
          <button
            className={`icon-button file-toggle ${menu === 'file' ? 'active' : ''}`}
            aria-label="Menu do projeto"
            title="Menu do projeto"
            aria-expanded={menu === 'file'}
            onClick={() => setMenu(menu === 'file' ? null : 'file')}
          >
            <Icon name="menu" size={20} />
          </button>
          <input
            hidden={home}
            className="project-name"
            aria-label="Nome do projeto"
            title="Nome do projeto"
            value={name.replace(/\.agr$/i, '')}
            onChange={(e) => state.rename(e.target.value + '.agr')}
          />
          <span className="draft-indicator" title={saveState} aria-label={saveState} />
          {menu === 'file' && (
            <div className="project-menu popover" aria-label="Opções do projeto">
              <button onClick={newDocument}>
                <Icon name="plus" />
                Nova imagem
              </button>
              <button
                onClick={() => {
                  setMenu(null);
                  fileRef.current?.click();
                }}
              >
                <Icon name="upload" />
                Importar arquivo<kbd>Ctrl O</kbd>
              </button>
              <div className="menu-rule" />
              <button
                onClick={() => {
                  setEditor(null);
                  setPropertiesOpen(false);
                  setAgrOpen(true);
                  setHome(false);
                  setMenu(null);
                }}
              >
                <Icon name="file" />
                Parâmetros AGR
              </button>
              <button
                onClick={() => {
                  setWholePage((v) => !v);
                  setHome(false);
                  setMenu(null);
                }}
              >
                <Icon name="fit" />
                {wholePage ? 'Focar no gráfico' : 'Ver página inteira'}
              </button>
              <button
                onClick={() => {
                  toggleTheme();
                  setMenu(null);
                }}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
                {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </button>
              <label className="theme-picker">
                Tema
                <select
                  aria-label="Tema de cores"
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                >
                  {themePalettes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tema}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => {
                  setDiagnosticsOpen(true);
                  setMenu(null);
                }}
              >
                <Icon name="check" />
                Compatibilidade
                {errors.length > 0 && <span className="error-count">{errors.length}</span>}
              </button>
              <div className="menu-rule" />
              <button onClick={openExamples}>
                <Icon name="image" />
                Criar exemplo
              </button>
              <span className="menu-footnote">
                {rendering.engine.available ? rendering.engine.version : 'Grace desconectado'} ·
                processamento local
              </span>
            </div>
          )}
        </div>
        <div className="brand">
          <Icon name="chart" size={19} />
          <strong>
            LSN<span>Grace</span>
          </strong>
        </div>
        <div className="export-control">
          <button
            className="button export-toggle"
            aria-expanded={menu === 'export'}
            onClick={(event) => {
              event.stopPropagation();
              setMenu(menu === 'export' ? null : 'export');
            }}
            disabled={exporting}
          >
            <Icon name="download" size={16} />
            {exporting ? 'Exportando…' : 'Exportar'}
          </button>
          {
            <div
              className="export-menu popover"
              hidden={menu !== 'export'}
              aria-label="Exportar projeto"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span className="menu-label">SALVAR PROJETO</span>
              <button disabled={!rendering.engine.available} onClick={() => void save('agr')}>
                <Icon name="file" />
                Projeto Grace <small>.agr</small>
              </button>
              <div className="menu-rule" />
              <span className="menu-label">EXPORTAR FIGURA</span>
              <ExportSettings
                page={scene.page.size}
                disabled={!hasFigure || !rendering.engine.available || exporting}
                onExport={(format, options) => void save(format, options)}
              />
            </div>
          }
        </div>
      </header>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".agr,.par,.csv,.tsv,.dat,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void openFile(file);
          e.target.value = '';
        }}
      />
      {home && (
        <HomeScreen
          figures={recents}
          onNew={() => void newDocument()}
          onOpen={() => fileRef.current?.click()}
          onResume={() => setHome(false)}
          onChoose={(figure) => {
            void (async () => {
              try {
                await remember();
                state.load(figure.scene, figure.name);
                figureId.current = figure.id;
                closeEditors();
                setPropertiesOpen(false);
                setHome(false);
              } catch (e) {
                notify((e as Error).message, true);
              }
            })();
          }}
          onDelete={(id) => {
            void deleteRecent(id)
              .then(refreshRecents)
              .catch(() => notify('Não foi possível remover a imagem do histórico.', true));
          }}
        />
      )}
      <div className="workbench" hidden={home}>
        {!sidebarCollapsed && (
          <aside className="navigator">
            <div className="list-toolbar">
              <span className="navigator-title">COMPOSIÇÃO</span>
              <div className="history-controls">
                <button
                  className="icon-button"
                  aria-label="Desfazer"
                  title="Desfazer (Ctrl+Z)"
                  disabled={!state.past.length}
                  onClick={undo}
                >
                  <Icon name="undo" size={19} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Refazer"
                  title="Refazer (Ctrl+Y)"
                  disabled={!state.future.length}
                  onClick={redo}
                >
                  <Icon name="redo" size={19} />
                </button>
              </div>
              <button
                className="icon-button"
                aria-label="Ocultar hierarquia"
                title="Ocultar lateral"
                onClick={() => setSidebarCollapsed(true)}
              >
                <Icon name="collapse" size={20} />
              </button>
            </div>
            <FigureTree
              scene={scene}
              graphId={graphId}
              setId={setId}
              imageSelected={imageSelected}
              onImage={showImage}
              onGraph={(id, series) => showProperties(id, series ?? null)}
              onAdd={insertGraph}
              onRegression={openRegression}
              onRegressionReport={(id, reportId, x, y) =>
                setRegression({ graphId: id, reportId, x, y })
              }
              onData={(id, seriesId) => startEditor(seriesId, id)}
              onTransform={showTransform}
              onCopyTransform={copyTransformation}
              onPasteTransform={pasteTransformation}
              onContextSelect={(target) => {
                setImageSelected(target.kind === 'image');
                if (target.kind !== 'image')
                  select(target.graphId, target.kind === 'set' ? target.setId : null);
              }}
              onDelete={deleteTreeTarget}
              change={change}
            />
          </aside>
        )}
        {regression && regressionGraph && (regressionSource || regressionReport) && (
          <RegressionPanel
            key={`${regression.graphId}:${regression.sourceId}:${regression.reportId}`}
            source={regressionSource}
            report={regressionReport}
            x={regression.x}
            y={regression.y}
            onClose={closeRegression}
            onMove={(x, y) =>
              setRegression((current) => (current ? { ...current, x, y } : current))
            }
            onFit={(options) => {
              let reportId = -1,
                curveId = -1;
              edit((s) => {
                const g = s.graphs.find((g) => g.id === regression.graphId);
                if (!g || regression.sourceId === undefined)
                  throw Error('Série de origem indisponível.');
                const report = insertRegression(g, regression.sourceId, options);
                reportId = report.id;
                curveId = report.curveSetId;
              });
              select(regression.graphId, curveId);
              setRegression({ ...regression, sourceId: undefined, reportId });
              notify('Curva e informações da regressão criadas. Ctrl+Z desfaz o ajuste.');
            }}
            onDelete={
              regressionReport
                ? () => {
                    if (
                      change((s) => {
                        const g = s.graphs.find((g) => g.id === regression.graphId)!;
                        g.regressions = g.regressions?.filter((r) => r.id !== regressionReport.id);
                      })
                    )
                      closeRegression();
                  }
                : undefined
            }
          />
        )}
        <main className={`workspace ${propertiesOpen ? 'has-bottom-properties' : ''}`}>
          <div className="canvas-stage" ref={stageRef}>
            {!hasFigure ? (
              <div className="empty-state">
                <Icon name="chart" size={35} />
                <h1>Seu próximo gráfico começa aqui.</h1>
                <button className="button primary" onClick={() => startEditor()}>
                  <Icon name="plus" size={17} />
                  Adicionar dados
                </button>
                <button className="text-button" onClick={() => fileRef.current?.click()}>
                  Importar CSV, TXT ou AGR
                </button>
                <button className="text-button" onClick={openExamples}>
                  Criar exemplo
                </button>
              </div>
            ) : rendering.error ? (
              <div className="render-error" role="alert">
                <h2>Não foi possível desenhar o gráfico</h2>
                <p>{rendering.error}</p>
                <button className="button" onClick={rendering.reconnect}>
                  Reconectar ao Grace
                </button>
              </div>
            ) : (
              <PlotCanvas
                scene={scene}
                renderedScene={rendering.revision}
                svg={rendering.svg}
                camera={camera}
                width={paperWidth}
                graphId={graphId}
                setId={setId}
                mode={mode}
                keepAspect={keepGraphAspect}
                resizeGuides={resizeFeedback?.scene === scene ? resizeFeedback.guides : []}
                onResizeGuides={(guides) =>
                  setResizeFeedback({ scene: useDocument.getState().scene, guides })
                }
                showHandles={propertiesOpen && !imageSelected && !selectedSet}
                disabled={rendering.pending || rendering.stale}
                onSelect={(id, series) => {
                  setImageSelected(false);
                  select(id, series);
                }}
                onRegression={openRegression}
                onEditSet={(id, series) => showProperties(id, series)}
                onEditData={(id, series) => {
                  select(id, series);
                  setPropertiesOpen(false);
                  setAgrOpen(false);
                  setMenu(null);
                  setEditor({ key: Date.now(), graphId: id, setId: series });
                }}
                onChange={(fn) => {
                  const ok = change(fn);
                  if (ok) setStatus({ text: '', error: false });
                  return ok;
                }}
                onInspect={(id, kind) => {
                  showProperties(id);
                  setFocusTarget({ kind, key: Date.now() });
                }}
              />
            )}
          </div>
          {transformTarget && transformSet && (
            <TransformPanel
              key={`${transformTarget.graphId}:${transformTarget.setId}`}
              set={transformSet}
              onClose={() => setTransformTarget(null)}
              onEdit={(fn) =>
                edit((s) => {
                  const set = s.graphs
                    .find((g) => g.id === transformTarget.graphId)
                    ?.sets.find((s) => s.id === transformTarget.setId);
                  if (!set) throw Error('Série indisponível.');
                  fn(set);
                  const graph = s.graphs.find((g) => g.id === transformTarget.graphId)!;
                  try {
                    autoscaleGraph(graph);
                  } catch {
                    /* Keep valid existing bounds when no drawable data remains. */
                  }
                })
              }
            />
          )}
          {propertiesOpen && (
            <ResizableProperties>
              <div className="properties-bar">
                <strong>
                  {imageSelected
                    ? 'Imagem'
                    : selectedSet
                      ? `G${graphId} · Série ${selectedSet.id + 1}`
                      : `Gráfico ${graphId + 1} · G${graphId}`}
                </strong>
                <button
                  className="icon-button"
                  aria-label="Ocultar configurações"
                  onClick={() => setPropertiesOpen(false)}
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
              <div className="properties-content">
                {imageSelected ? (
                  <ImageProperties scene={scene} change={change} onAdd={insertGraph} />
                ) : (
                  <Inspector
                    scene={scene}
                    focusTarget={focusTarget}
                    graph={graph}
                    selectedSet={selectedSet}
                    change={change}
                    graphControls={
                      graph && (
                        <GraphPlacement
                          scene={scene}
                          graph={graph}
                          change={change}
                          onAdd={insertGraph}
                          onDelete={() => deleteGraph()}
                          locked={keepGraphAspect}
                          onLockedChange={setKeepGraphAspect}
                          onScale={scaleGraphArea}
                        />
                      )
                    }
                    onSelectImage={showImage}
                    onSelectGraph={() => {
                      setFocusTarget(undefined);
                      select(graphId, null);
                    }}
                    onRegression={
                      selectedSet
                        ? (x, y) => openRegression(graphId, selectedSet.id, x, y)
                        : undefined
                    }
                    onEditData={() => startEditor(selectedSet?.id)}
                    onDelete={() => {
                      if (selectedSet) deleteSeries(graphId, selectedSet.id);
                    }}
                  />
                )}
              </div>
            </ResizableProperties>
          )}
          {!propertiesOpen && (
            <button
              className="properties-reopen button"
              aria-label="Mostrar configurações"
              onClick={() => {
                closeEditors();
                setPropertiesOpen(true);
              }}
            >
              <Icon name="settings" size={16} /> Configurações
            </button>
          )}
          {sidebarCollapsed && (
            <button
              className="canvas-sidebar-toggle floating-button"
              aria-label="Mostrar hierarquia"
              title="Mostrar hierarquia"
              onClick={() => setSidebarCollapsed(false)}
            >
              <Icon name="expand" size={20} />
            </button>
          )}
          {!editor && !agrOpen && !examplesOpen && !transformTarget && (
            <div
              className="canvas-tools"
              role="toolbar"
              aria-label="Ferramentas da imagem e do gráfico"
            >
              {(
                [
                  { value: 'select', icon: 'cursor', label: 'Selecionar elementos' },
                  { value: 'pan', icon: 'hand', label: 'Mover gráfico' },
                  { value: 'zoom', icon: 'zoom', label: 'Zoom por área' },
                  { value: 'text', icon: 'text', label: 'Criar texto' },
                  { value: 'addPoint', icon: 'pointAdd', label: 'Adicionar ponto' },
                  { value: 'deletePoint', icon: 'pointDelete', label: 'Excluir ponto' },
                ] as const
              ).map((tool) => (
                <button
                  key={tool.value}
                  className={`tool-button ${mode === tool.value ? 'active' : ''}`}
                  aria-label={tool.label}
                  aria-pressed={mode === tool.value}
                  title={tool.label}
                  onClick={() => setMode(tool.value)}
                >
                  <Icon name={tool.icon} size={25} />
                </button>
              ))}
              <button
                className={`tool-button ${propertiesOpen && !imageSelected ? 'active' : ''}`}
                aria-label="Configurações do gráfico"
                title={`Configurar G${graphId}`}
                onClick={() => showProperties()}
              >
                <Icon name="settings" size={25} />
              </button>
              <button
                className="tool-button"
                aria-label="Ampliar gráfico"
                title={`Zoom nos dados de G${graphId}: aproximar (não altera a área da imagem)`}
                disabled={!pointCount}
                onClick={() => zoom(1 / 1.25)}
              >
                <Icon name="plus" size={27} />
              </button>
              <button
                className="tool-button"
                aria-label="Afastar gráfico"
                title={`Zoom nos dados de G${graphId}: afastar (não altera a área da imagem)`}
                disabled={!pointCount}
                onClick={() => zoom(1.25)}
              >
                <Icon name="minus" size={27} />
              </button>
              <button
                className="tool-button autoscale-button"
                aria-label="Ajustar eixos aos dados"
                title={`Autoscale G${graphId} (A)`}
                disabled={!pointCount}
                onClick={fit}
              >
                AS
              </button>
              <button
                className={`tool-button ${imageSelected && propertiesOpen ? 'active' : ''}`}
                aria-label="Configurações da imagem"
                title="Configurar imagem"
                onClick={showImage}
              >
                <Icon name="image" size={25} />
              </button>
            </div>
          )}
          {examplesOpen && (
            <div className="editor-panel" aria-label="Exemplos de imagem">
              <ExamplePicker onChoose={loadExample} onClose={() => setExamplesOpen(false)} />
            </div>
          )}
          {agrOpen && (
            <div className="editor-panel" aria-label="Painel de parâmetros AGR">
              <AgrEditor
                scene={scene}
                onApply={(next) => {
                  if (change((s) => Object.assign(s, next))) notify('Parâmetros atualizados.');
                }}
                onClose={() => setAgrOpen(false)}
              />
            </div>
          )}
          {editor && (
            <div className="editor-panel" aria-label="Painel de dados">
              <DataEditor
                scene={scene}
                colorOffset={scene.graphs.find((g) => g.id === editor.graphId)?.sets.length ?? 0}
                key={editor.key}
                initialText={editor.text}
                initialName={editor.name || `Série ${seriesCount + 1}`}
                existing={scene.graphs
                  .find((g) => g.id === editor.graphId)
                  ?.sets.find((s) => s.id === editor.setId)}
                onApply={applySeries}
                onClose={() => setEditor(null)}
                onFile={() => fileRef.current?.click()}
              />
            </div>
          )}
          {rendering.pending && hasFigure && (
            <span className="render-progress" role="status">
              Atualizando…
            </span>
          )}
          {!!warnings.length && !rendering.pending && !editor && !agrOpen && !examplesOpen && (
            <button
              className="render-warning"
              title={warnings.join('\n')}
              onClick={() => setDiagnosticsOpen(true)}
            >
              <Icon name="warning" size={15} />
              {warnings.some((w) => w.includes('fora da página'))
                ? 'Conteúdo fora da página'
                : 'Aviso de composição'}
            </button>
          )}
          {status.text && (
            <div
              className={`status-message ${status.error ? 'is-error' : ''}`}
              role={status.error ? 'alert' : 'status'}
            >
              <span>{status.text}</span>
              <button
                className="icon-button"
                aria-label="Fechar mensagem"
                onClick={() => setStatus({ text: '', error: false })}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
        </main>
      </div>
      {home && status.text && (
        <div className="home-status" role={status.error ? 'alert' : 'status'}>
          {status.text}
        </div>
      )}
      {diagnosticsOpen && (
        <aside className="diagnostics" aria-label="Diagnósticos">
          <header>
            <h2>Compatibilidade do projeto</h2>
            <button
              className="icon-button"
              aria-label="Fechar diagnósticos"
              onClick={() => setDiagnosticsOpen(false)}
            >
              <Icon name="close" />
            </button>
          </header>
          {!errors.length && !warnings.length && !preservedCount && (
            <p>Nenhum problema encontrado.</p>
          )}
          {errors.map((d, i) => (
            <p className="inline-error" key={i}>
              Linha {d.line}: {d.message}
            </p>
          ))}
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          {!!warnings.length && (
            <button
              className="button"
              onClick={() => {
                setDiagnosticsOpen(false);
                if (warnings.some((w) => w.includes('fora da página'))) setWholePage(true);
                showProperties();
              }}
            >
              {warnings.some((w) => w.includes('fora da página'))
                ? 'Conferir página e propriedades'
                : 'Revisar textos e propriedades'}
            </button>
          )}
          {!!preservedCount && (
            <details>
              <summary>{preservedCount} diretivas mantidas no arquivo original</summary>
              <p>
                Essas diretivas são encaminhadas ao interpretador do Grace original, incluindo
                opções sem controles dedicados no inspetor.
              </p>
              <ul>
                {scene.compatibility.preserved.map((d, i) => (
                  <li key={i}>
                    <code>{d.raw}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Icon name="upload" size={40} />
          <h2>Solte seu arquivo aqui</h2>
          <p>Tabelas CSV, TSV, DAT, TXT ou projetos AGR</p>
        </div>
      )}
    </div>
  );
}
