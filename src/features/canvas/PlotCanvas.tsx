import { CanvasInput, type CanvasInputTarget } from './CanvasInput';
import {
  nearestPoint,
  insertPoint,
  deletePoint,
  addCanvasText,
  type PointHit,
} from './pointEditing';
import { useRegressionModifier } from '../../components/useRegressionModifier';
import { produce } from 'immer';
import { NativeDecorations } from './NativeDecorations';
import {
  legendAnchor,
  setLegendAnchor,
  estimatedLegendBox,
  snapLegend,
  type SmartGuide,
} from './guides';
import { nativeTextTargets, type HitBox } from './nativeTextTargets';
import { createPortal } from 'react-dom';
import { GraphContextMenu } from './GraphContextMenu';
import { Icon } from '../../components/Icon';
import { LiveZoom } from './LiveZoom';
import { canLiveZoom } from './liveZoom';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useId,
} from 'react';
import type { Graph, Scene } from '../../core/scene/types';
import { graphBox, viewportPoint, normalized } from '../../core/geometry/coordinates';
import { cameraPoint, framedSvg, type CanvasCamera } from './camera';
import { moveViewport } from '../composition/layout';
import { resizeGraphBounds } from './resize';
import { snapGraphResize } from './resizeGuides';
import { graphMove } from './moveGraph';
import { worldAt, hitPath, zoomGraph, panGraph, updateTicks } from './interactions';
// Keep the native document DOM out of pointer drags and sidebar updates.
const NativePage = memo(function NativePage({
  svg,
  camera,
  id,
}: {
  svg: string;
  camera: CanvasCamera;
  id: string;
}) {
  const html = useMemo(
    () => ({ __html: framedSvg(svg, camera).replace(/<svg\b/, `<svg id="${id}"`) }),
    [svg, camera.x, camera.y, camera.width, camera.height, id],
  );
  return <div className="svg-page" dangerouslySetInnerHTML={html} />;
});
export type CanvasMode = 'select' | 'zoom' | 'pan' | 'text' | 'addPoint' | 'deletePoint';
export type InspectTarget =
  'xaxis' | 'yaxis' | 'xlabel' | 'ylabel' | 'title' | 'subtitle' | 'legend' | 'graph';
type HoverTarget = {
  graphId: number;
  kind: InspectTarget | 'set';
  label: string;
  setId?: number;
  x: number;
  y: number;
};
type Drag = {
  kind: 'zoom' | 'pan' | 'legend' | 'corner' | 'move';
  graphId: number;
  start: [number, number];
  current: [number, number];
  corner?: number;
  proportional?: boolean;
  centered?: boolean;
  free?: boolean;
  legendBox?: HitBox;
};
export function PlotCanvas({
  scene,
  renderedScene,
  svg,
  width,
  graphId,
  setId,
  mode,
  keepAspect = false,
  resizeGuides = [],
  onResizeGuides,
  onSelect,
  onChange,
  onInspect,
  disabled = false,
  camera,
  showHandles = false,
  onEditSet,
  onEditData,
  onRegression,
}: {
  scene: Scene;
  renderedScene?: Scene;
  svg: string;
  width: number;
  graphId: number;
  setId: number | null;
  mode: CanvasMode;
  keepAspect?: boolean;
  resizeGuides?: SmartGuide[];
  onResizeGuides?: (guides: SmartGuide[]) => void;
  onSelect: (g: number, s: number | null) => void;
  onChange: (change: (scene: Scene) => void) => boolean;
  onInspect: (g: number, target: InspectTarget) => void;
  disabled?: boolean;
  camera: CanvasCamera;
  showHandles?: boolean;
  onRegression?: (graphId: number, setId: number, x: number, y: number) => void;
  onEditSet?: (graphId: number, setId: number) => void;
  onEditData?: (graphId: number, setId: number) => void;
}) {
  const [pointHover, setPointHover] = useState<PointHit | null>(null);
  const [input, setInput] = useState<CanvasInputTarget | null>(null);
  const pointScreen = useRef({ x: 0, y: 0 });
  const regressionModifier = useRegressionModifier();
  const showRegressionMode = regressionModifier && mode === 'select';
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const regressionHover = showRegressionMode && hover?.kind === 'set' && !!onRegression;
  const [handHover, setHandHover] = useState<{
    graphId: number;
    action: 'pan' | 'move' | 'legend';
    x: number;
    y: number;
  } | null>(null);
  const handFeedback = (
    graph: Graph,
    action: 'pan' | 'move' | 'legend',
    event: React.PointerEvent<SVGElement>,
  ) => {
    if (mode !== 'pan' || disabled || dragRef.current) return;
    setHandHover({
      graphId: graph.id,
      action,
      x: Math.min(event.clientX + 12, window.innerWidth - 260),
      y: Math.min(event.clientY + 16, window.innerHeight - 45),
    });
  };
  useEffect(() => {
    setHandHover(null);
  }, [mode, disabled]);
  const [textBoxes, setTextBoxes] = useState<Record<string, HitBox>>({});
  const [context, setContext] = useState<{ graphId: number; x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClick = useRef(false);
  const closeContext = useCallback(() => setContext(null), []);
  const keepHover = () => {
    if (hoverTimer.current !== undefined) clearTimeout(hoverTimer.current);
  };
  const leaveHover = () => {
    setHandHover(null);
    keepHover();
    hoverTimer.current = setTimeout(() => setHover(null), 180);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current !== undefined) clearTimeout(hoverTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (disabled) setHover(null);
  }, [disabled]);
  const configure = (target: HoverTarget) => {
    setHover(null);
    if (target.kind === 'set' && target.setId !== undefined)
      onEditSet?.(target.graphId, target.setId);
    else if (target.kind !== 'set') onInspect(target.graphId, target.kind);
  };
  const targetProps = (
    graph: Graph,
    kind: HoverTarget['kind'],
    label: string,
    seriesId?: number,
  ) => {
    const show = (event: React.PointerEvent<SVGElement> | React.FocusEvent<SVGElement>) => {
      if (mode === 'pan' && kind === 'legend' && 'clientX' in event)
        handFeedback(graph, 'legend', event);
      if (disabled || mode !== 'select' || dragRef.current || context) return;
      keepHover();
      const rect = event.currentTarget.getBoundingClientRect();
      setHover({
        graphId: graph.id,
        kind,
        label,
        setId: seriesId,
        x: Math.max(
          8,
          Math.min(
            'clientX' in event ? event.clientX + 10 : rect.left + rect.width / 2,
            window.innerWidth - 265,
          ),
        ),
        y: Math.max(
          8,
          Math.min(
            'clientY' in event ? event.clientY + 15 : rect.bottom + 8,
            window.innerHeight - 75,
          ),
        ),
      });
    };
    const activate = (event: React.MouseEvent<SVGElement>) => {
      event.stopPropagation();
      if (mode !== 'select' || disabled) return;
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      if (kind === 'set') {
        onSelect(graph.id, seriesId ?? null);
        if ((event.ctrlKey || event.metaKey) && seriesId !== undefined)
          onRegression?.(graph.id, seriesId, event.clientX, event.clientY);
      } else configure({ graphId: graph.id, kind, label, setId: seriesId, x: 0, y: 0 });
    };
    return {
      'data-graph-id': graph.id,
      'data-context-kind': kind,
      role: 'button',
      tabIndex: mode === 'select' ? 0 : -1,
      'aria-label': `${label}: configurar`,
      onPointerEnter: show,
      onPointerLeave: leaveHover,
      onFocus: show,
      onBlur: leaveHover,
      onClick: activate,
      onDoubleClick: (event: React.MouseEvent<SVGElement>) => {
        event.stopPropagation();
        configure({ graphId: graph.id, kind, label, setId: seriesId, x: 0, y: 0 });
      },
      onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (kind === 'set' && seriesId !== undefined && (event.ctrlKey || event.metaKey)) {
            const rect = event.currentTarget.getBoundingClientRect();
            onRegression?.(graph.id, seriesId, rect.left, rect.bottom);
          } else configure({ graphId: graph.id, kind, label, setId: seriesId, x: 0, y: 0 });
        }
      },
    };
  };
  useEffect(() => {
    setPointHover(null);
    setHover(null);
    setInput(null);
  }, [mode, disabled]);
  const nativeId = 'lsn-native-' + useId().replace(/[^\w-]/g, '');
  const wheelInput = useRef<{ graphId: number; x: number; y: number; log: number } | null>(null);
  const wheelFrame = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (wheelFrame.current !== undefined) cancelAnimationFrame(wheelFrame.current);
    },
    [],
  );
  const ref = useRef<HTMLDivElement>(null),
    dragRef = useRef<Drag | null>(null),
    [drag, setDrag] = useState<Drag | null>(null);
  const [pageWidth, pageHeight] = scene.page.size,
    unit = Math.min(pageWidth, pageHeight);
  const point = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = ref.current!.getBoundingClientRect();
    return cameraPoint(camera, rect, event.clientX, event.clientY);
  };
  const graphAt = (p: [number, number]) =>
    [...scene.graphs].reverse().find((g) => {
      if (!g.enabled || g.hidden) return false;
      const b = graphBox(scene, g.viewport);
      return p[0] >= b.left && p[0] <= b.right && p[1] >= b.top && p[1] <= b.bottom;
    });
  const hitAt = (p: [number, number]) => {
    const g = graphAt(p);
    return g
      ? nearestPoint(
          scene,
          g,
          p,
          camera.width / (ref.current?.getBoundingClientRect().width || width),
          g.id === graphId ? setId : null,
        )
      : null;
  };
  useLayoutEffect(() => {
    if (ref.current)
      setTextBoxes(nativeTextTargets(ref.current, renderedScene ?? scene, camera, nativeId));
  }, [svg, width, camera.x, camera.y, camera.width, camera.height]);
  const fraction = (graph: Graph, p: [number, number]): [number, number] => {
    const b = graphBox(scene, graph.viewport);
    return [(p[0] - b.left) / b.width, 1 - (p[1] - b.top) / b.height];
  };
  const legendMotion = (base: Scene, g: Graph, action: Drag) => {
    const original = action.legendBox ?? estimatedLegendBox(base, g),
      dx = action.current[0] - action.start[0],
      dy = action.current[1] - action.start[1];
    const proposed = { ...original, x: original.x + dx, y: original.y + dy };
    const tolerance = (6 * camera.width) / (ref.current?.clientWidth || width);
    const snapped = action.free
      ? { box: proposed, guides: [] as SmartGuide[] }
      : snapLegend(base, g.id, proposed, tolerance);
    const anchor = legendAnchor(base, g);
    return {
      point: [anchor[0] + snapped.box.x - original.x, anchor[1] + snapped.box.y - original.y] as [
        number,
        number,
      ],
      ...snapped,
    };
  };
  const cornerMotion = (base: Scene, graph: Graph, action: Drag) =>
    snapGraphResize(
      base,
      graph,
      resizeGraphBounds(
        base,
        graph,
        action.corner!,
        action.start,
        action.current,
        action.proportional,
        action.centered,
      ),
      {
        corner: action.corner!,
        proportional: action.proportional,
        centered: action.centered,
        free: action.free,
        tolerance: (6 * camera.width) / (ref.current?.clientWidth || width),
      },
    );
  const moveMotion = (base: Scene, graph: Graph, action: Drag) =>
    graphMove(
      base,
      graph,
      action.start,
      action.current,
      (6 * camera.width) / (ref.current?.clientWidth || width),
      action.free,
    );
  const preview = useMemo(() => {
    if (
      !drag ||
      !['pan', 'legend', 'corner', 'move'].includes(drag.kind) ||
      Math.hypot(drag.current[0] - drag.start[0], drag.current[1] - drag.start[1]) <
        (['corner', 'move'].includes(drag.kind) ? 0.1 : 2)
    )
      return { scene, guides: [] as SmartGuide[], box: undefined as HitBox | undefined };
    const graph = scene.graphs.find((g) => g.id === drag.graphId)!;
    const motion = drag.kind === 'legend' ? legendMotion(scene, graph, drag) : undefined;
    const resizing = drag.kind === 'corner' ? cornerMotion(scene, graph, drag) : undefined;
    const moving = drag.kind === 'move' ? moveMotion(scene, graph, drag) : undefined;
    try {
      return {
        scene: produce(scene, (draft) => {
          const g = draft.graphs.find((g) => g.id === drag.graphId)!;
          if (motion) setLegendAnchor(draft, g, motion.point);
          else if (resizing) moveViewport(draft, g.id, resizing.bounds);
          else if (moving) moveViewport(draft, g.id, moving.bounds);
          else panGraph(g, fraction(graph, drag.start), fraction(graph, drag.current));
        }),
        guides: motion?.guides ?? resizing?.guides ?? moving?.guides ?? [],
        box: motion?.box ?? moving?.box,
      };
    } catch {
      return { scene, guides: [] as SmartGuide[], box: undefined };
    }
  }, [scene, drag, camera.width, width]);
  const displayScene = preview.scene;
  const canReuseText = displayScene.graphs.every((g) =>
    (
      [
        ['title', g.title.text],
        ['subtitle', g.subtitle.text],
        ['xlabel', g.axes.xaxis.label.text],
        ['ylabel', g.axes.yaxis.label.text],
      ] as const
    ).every(([kind, text]) => !/[\\$]/.test(text) || !!textBoxes[`${g.id}:${kind}`]),
  );
  const liveZoom =
    !!svg && !!renderedScene && canReuseText && canLiveZoom(renderedScene, displayScene);
  const begin = (event: React.PointerEvent, kind: Drag['kind'], g: Graph, corner?: number) => {
    if (disabled || event.button !== 0) return;
    setHover(null);
    setHandHover(null);
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
    onSelect(g.id, null);
    const p = point(event);
    const current: Drag = {
      kind,
      graphId: g.id,
      start: p,
      current: p,
      corner,
      proportional: keepAspect || event.shiftKey,
      centered: event.altKey,
      free: kind === 'corner' || kind === 'move' ? event.ctrlKey || event.metaKey : event.altKey,
      legendBox:
        kind === 'legend'
          ? (textBoxes[`${g.id}:legend-box`] ??
            textBoxes[`${g.id}:legend`] ??
            estimatedLegendBox(scene, g))
          : undefined,
    };
    dragRef.current = current;
    setDrag(current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const end = () => {
    const action = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!action) return;
    if (
      Math.hypot(action.current[0] - action.start[0], action.current[1] - action.start[1]) <
      (['corner', 'move'].includes(action.kind) ? 0.1 : 2)
    )
      return;
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const success = onChange((s) => {
      const graph = s.graphs.find((g) => g.id === action.graphId)!;
      if (action.kind === 'zoom') {
        const a = worldAt(graph, ...fraction(graph, action.start)),
          b = worldAt(graph, ...fraction(graph, action.current));
        graph.world = [
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1]),
        ];
        updateTicks(graph);
      } else if (action.kind === 'pan')
        panGraph(graph, fraction(graph, action.start), fraction(graph, action.current));
      else if (action.kind === 'legend') {
        const base = scene.graphs.find((g) => g.id === action.graphId)!;
        setLegendAnchor(s, graph, legendMotion(scene, base, action).point);
      } else if (action.kind === 'move') {
        moveViewport(
          s,
          graph.id,
          moveMotion(
            scene,
            scene.graphs.find((g) => g.id === action.graphId)!,
            action,
          ).bounds,
        );
      } else {
        moveViewport(
          s,
          graph.id,
          cornerMotion(
            scene,
            scene.graphs.find((g) => g.id === action.graphId)!,
            action,
          ).bounds,
        );
      }
    });
    if (success && action.kind === 'move')
      onResizeGuides?.(
        moveMotion(
          scene,
          scene.graphs.find((g) => g.id === action.graphId)!,
          action,
        ).guides,
      );
    if (success && action.kind === 'corner')
      onResizeGuides?.(
        cornerMotion(
          scene,
          scene.graphs.find((g) => g.id === action.graphId)!,
          action,
        ).guides,
      );
  };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      // Wheel zoom can accumulate against the latest scene while Grace catches up.
      const p = point(event),
        g = [...scene.graphs].reverse().find((g) => {
          const b = graphBox(scene, g.viewport);
          return (
            g.enabled &&
            !g.hidden &&
            g.type.toUpperCase() === 'XY' &&
            p[0] >= b.left &&
            p[0] <= b.right &&
            p[1] >= b.top &&
            p[1] <= b.bottom
          );
        });
      if (!g) return;
      if (g.id !== graphId) onSelect(g.id, null);
      event.preventDefault();
      const pos = fraction(g, p);
      const pixels =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const log = Math.max(-0.35, Math.min(0.35, pixels * 0.0015));
      const previous = wheelInput.current;
      wheelInput.current = {
        graphId: g.id,
        x: pos[0],
        y: pos[1],
        log: log + (previous?.graphId === g.id ? previous.log : 0),
      };
      if (wheelFrame.current === undefined)
        wheelFrame.current = requestAnimationFrame(() => {
          wheelFrame.current = undefined;
          const input = wheelInput.current;
          wheelInput.current = null;
          if (!input) return;
          onChange((scene) => {
            const graph = scene.graphs.find((g) => g.id === input.graphId);
            if (graph)
              zoomGraph(
                graph,
                input.x,
                input.y,
                Math.exp(Math.max(-0.8, Math.min(0.8, input.log))),
              );
          });
        });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  });
  return (
    <div
      ref={ref}
      tabIndex={0}
      aria-label="Editor do gráfico"
      onPointerLeave={() => setPointHover(null)}
      onPointerMoveCapture={(event) => {
        if (!ref.current?.contains(event.target as Node)) return;
        if (disabled || dragRef.current || !['select', 'deletePoint'].includes(mode)) {
          if (pointHover) setPointHover(null);
          return;
        }
        pointScreen.current = {
          x: Math.max(8, Math.min(event.clientX + 14, window.innerWidth - 300)),
          y: Math.max(8, Math.min(event.clientY + 20, window.innerHeight - 105)),
        };
        const hit = hitAt(point(event));
        setPointHover((old) =>
          old?.graphId === hit?.graphId && old?.setId === hit?.setId && old?.index === hit?.index
            ? old
            : hit,
        );
      }}
      onPointerDownCapture={(event) => {
        if (!ref.current?.contains(event.target as Node)) return;
        if (disabled || event.button !== 0 || !['text', 'addPoint', 'deletePoint'].includes(mode))
          return;
        event.preventDefault();
        event.stopPropagation();
        const position = point(event),
          g = graphAt(position) ?? scene.graphs.find((g) => g.id === graphId);
        if (!g) return;
        if (mode === 'deletePoint') {
          const hit = hitAt(position);
          if (
            hit &&
            onChange((s) =>
              deletePoint(
                s.graphs.find((g) => g.id === hit.graphId)!,
                hit.setId,
                hit.index,
              ),
            )
          ) {
            onSelect(hit.graphId, hit.setId);
            setPointHover(null);
          }
        } else {
          const coordinates = worldAt(g, ...fraction(g, position));
          setInput({
            kind: mode as 'text' | 'addPoint',
            graphId: g.id,
            position,
            world: coordinates,
            x: event.clientX + 12,
            y: event.clientY + 12,
          });
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setHover(null);
        const p = point(event),
          target = (event.target as Element).closest('[data-graph-id]');
        const id = target ? Number(target.getAttribute('data-graph-id')) : undefined;
        const graph =
          scene.graphs.find((g) => g.id === id) ??
          [...scene.graphs].reverse().find((g) => {
            const box = graphBox(scene, g.viewport);
            return (
              g.enabled &&
              !g.hidden &&
              p[0] >= box.left &&
              p[0] <= box.right &&
              p[1] >= box.top &&
              p[1] <= box.bottom
            );
          }) ??
          scene.graphs.find((g) => g.id === graphId);
        if (graph) {
          onSelect(graph.id, null);
          setContext({ graphId: graph.id, x: event.clientX, y: event.clientY });
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && input) {
          event.preventDefault();
          event.stopPropagation();
          setInput(null);
          return;
        }
        if (event.key === 'Escape' && dragRef.current) {
          event.preventDefault();
          event.stopPropagation();
          dragRef.current = null;
          setDrag(null);
          return;
        }
        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
          event.preventDefault();
          const rect = ref.current!.getBoundingClientRect();
          setContext({ graphId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      }}
      className={`paper live-paper ${drag ? 'is-dragging' : ''} mode-${mode} ${disabled ? 'is-pending' : ''} ${liveZoom ? 'has-live-zoom' : ''}`}
      style={{ width, aspectRatio: `${camera.width} / ${camera.height}` }}
    >
      <NativePage svg={svg} camera={camera} id={nativeId} />
      {liveZoom && (
        <>
          <LiveZoom
            scene={displayScene}
            camera={camera}
            width={width}
            nativeBoxes={textBoxes}
            preserveLegend
          />
          <NativeDecorations
            id={nativeId}
            scene={displayScene}
            renderedScene={renderedScene!}
            camera={camera}
            boxes={textBoxes}
          />
        </>
      )}
      <svg
        className="interaction-layer"
        viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
        aria-label="Área de edição interativa"
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          const next = {
            ...dragRef.current,
            current: point(event),
            free: ['corner', 'move'].includes(dragRef.current.kind)
              ? event.ctrlKey || event.metaKey
              : event.altKey,
            proportional: keepAspect || event.shiftKey,
            centered: event.altKey,
          };
          dragRef.current = next;
          setDrag(next);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          dragRef.current = null;
          setDrag(null);
        }}
      >
        {['text', 'addPoint', 'deletePoint'].includes(mode) && (
          <rect
            x={camera.x}
            y={camera.y}
            width={camera.width}
            height={camera.height}
            fill="transparent"
          />
        )}
        <defs>
          {scene.graphs.map((g) => {
            const b = graphBox(scene, g.viewport);
            return (
              <clipPath id={`hit-clip-${g.id}`} key={g.id}>
                <rect x={b.left} y={b.top} width={b.width} height={b.height} />
              </clipPath>
            );
          })}
        </defs>
        {displayScene.graphs
          .filter((g) => g.enabled && !g.hidden && g.type.toUpperCase() === 'XY')
          .map((g) => {
            const b = graphBox(scene, g.viewport),
              [lx, ly] =
                g.legend.coordinates === 'view'
                  ? viewportPoint(scene, ...g.legend.position)
                  : [
                      b.left +
                        normalized(g.legend.position[0], g.world[0], g.world[2], g.axes.xaxis) *
                          b.width,
                      b.bottom -
                        normalized(g.legend.position[1], g.world[1], g.world[3], g.axes.yaxis) *
                          b.height,
                    ];
            const labelWidth = (value: string, size: number) =>
              Math.min(b.width, Math.max(40, value.length * unit * 0.017 * size + 12));
            const xLabelWidth = labelWidth(g.axes.xaxis.label.text, g.axes.xaxis.label.size),
              yLabelHeight = labelWidth(g.axes.yaxis.label.text, g.axes.yaxis.label.size);
            const textTarget = (kind: string, fallback: HitBox) =>
              textBoxes[`${g.id}:${kind}`] ?? fallback;
            const hasLegend = g.legend.enabled && g.sets.some((s) => !s.hidden && s.legend),
              legendWidth = Math.min(
                b.width,
                30 +
                  Math.max(0, ...g.sets.map((s) => s.legend.length)) *
                    g.legend.size *
                    unit *
                    0.0145,
              ),
              legendHeight =
                g.sets.filter((s) => !s.hidden && s.legend).length * g.legend.size * unit * 0.032;
            const pixel = camera.width / width;
            const nativeGraph = renderedScene?.graphs.find((item) => item.id === g.id) ?? g;
            const deltaY = b.top - graphBox(renderedScene ?? scene, nativeGraph.viewport).top;
            const headerTop = Math.max(
              camera.y,
              Math.min(
                b.top - 24 * pixel,
                g.title.text
                  ? (textBoxes[`${g.id}:title`]?.y ?? b.top - 45 * pixel) + deltaY - 6 * pixel
                  : b.top,
                g.subtitle.text
                  ? (textBoxes[`${g.id}:subtitle`]?.y ?? b.top - 25 * pixel) + deltaY - 6 * pixel
                  : b.top,
              ),
            );
            return (
              <g key={g.id} data-graph-id={g.id}>
                {mode === 'pan' && (
                  <rect
                    className={`graph-move-target ${handHover?.graphId === g.id && handHover.action === 'move' ? 'is-highlighted' : ''}`}
                    data-graph-move={g.id}
                    aria-label={`Mover gráfico G${g.id} na imagem`}
                    x={b.left}
                    y={headerTop}
                    width={b.width}
                    height={Math.max(0, b.top - headerTop)}
                    onPointerEnter={(e) => handFeedback(g, 'move', e)}
                    onPointerMove={(e) => handFeedback(g, 'move', e)}
                    onPointerLeave={() => setHandHover(null)}
                    onPointerDown={(e) => begin(e, 'move', g)}
                  />
                )}

                <rect
                  className={`plot-target ${mode === 'pan' && handHover?.graphId === g.id && handHover.action === 'pan' ? 'is-hand-hovered' : ''}`}
                  x={b.left}
                  y={b.top}
                  width={b.width}
                  height={b.height}
                  fill="transparent"
                  onPointerEnter={(e) => handFeedback(g, 'pan', e)}
                  onPointerMove={(e) => handFeedback(g, 'pan', e)}
                  onPointerLeave={() => setHandHover(null)}
                  onPointerDown={(event) => {
                    if (mode === 'select') {
                      onSelect(g.id, null);
                      return;
                    }
                    if (mode === 'pan' || mode === 'zoom') begin(event, mode, g);
                  }}
                />
                {mode === 'select' && !disabled && (
                  <g clipPath={`url(#hit-clip-${g.id})`}>
                    {g.sets
                      .filter((s) => !s.hidden)
                      .map((s) => {
                        const pointsOnly = s.line.connection === 0 || s.line.style === 0;
                        if (pointsOnly && s.symbol.type === 0) return null;
                        return (
                          <path
                            key={s.id}
                            className={`curve-target ${regressionModifier && onRegression ? 'regression-target' : ''}`}
                            {...targetProps(g, 'set', s.legend || `Série ${s.id + 1}`, s.id)}
                            d={hitPath(g, s.rows, b.width, b.height, b.left, b.top, pointsOnly)}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={pointsOnly ? 14 : 8}
                            strokeLinecap="round"
                            pointerEvents="stroke"
                          >
                            <title>
                              {s.legend || `S${s.id}`} · selecionar série · Ctrl+clique: regressão
                            </title>
                          </path>
                        );
                      })}
                  </g>
                )}
                {g.axes.xaxis.enabled && (
                  <>
                    <rect
                      className="axis-target context-box"
                      {...targetProps(g, 'xaxis', 'Eixo X')}
                      x={b.left}
                      y={b.bottom - 5}
                      width={b.width}
                      height={unit * 0.055}
                    >
                      <title>Clique para configurar o eixo X</title>
                    </rect>
                    <rect
                      className="axis-target context-box"
                      {...targetProps(g, 'xaxis', 'Eixo X superior')}
                      x={b.left}
                      y={b.top - 5}
                      width={b.width}
                      height={unit * 0.026}
                    />
                    <rect
                      className="text-target context-box"
                      {...targetProps(g, 'xlabel', 'Nome do eixo X')}
                      {...textTarget('xlabel', {
                        x: (b.left + b.right - xLabelWidth) / 2,
                        y: b.bottom + unit * 0.03,
                        width: xLabelWidth,
                        height: unit * 0.055,
                      })}
                    />
                  </>
                )}
                {g.axes.yaxis.enabled && (
                  <>
                    <rect
                      className="axis-target context-box"
                      {...targetProps(g, 'yaxis', 'Eixo Y')}
                      x={b.left - unit * 0.065}
                      y={b.top}
                      width={unit * 0.075}
                      height={b.height}
                    />
                    <rect
                      className="axis-target context-box"
                      {...targetProps(g, 'yaxis', 'Eixo Y direito')}
                      x={b.right - 5}
                      y={b.top}
                      width={unit * 0.03}
                      height={b.height}
                    />
                    <rect
                      className="text-target context-box"
                      {...targetProps(g, 'ylabel', 'Nome do eixo Y')}
                      {...textTarget('ylabel', {
                        x: b.left - unit * 0.1,
                        y: (b.top + b.bottom - yLabelHeight) / 2,
                        width: unit * 0.05,
                        height: yLabelHeight,
                      })}
                    />
                  </>
                )}
                <rect
                  className="text-target context-box"
                  {...targetProps(g, 'title', g.title.text ? 'Título' : 'Adicionar título')}
                  {...textTarget('title', {
                    x: b.left,
                    y: b.top - unit * 0.12,
                    width: b.width,
                    height: unit * 0.085,
                  })}
                />
                {!!g.subtitle.text && (
                  <rect
                    className="text-target context-box"
                    {...targetProps(g, 'subtitle', 'Subtítulo')}
                    {...textTarget('subtitle', {
                      x: b.left,
                      y: b.top - unit * 0.055,
                      width: b.width,
                      height: unit * 0.045,
                    })}
                  />
                )}
                {hasLegend && mode !== 'zoom' && (
                  <rect
                    className="legend-target context-box"
                    {...targetProps(g, 'legend', 'Legenda')}
                    {...textTarget('legend', {
                      x: lx - 6,
                      y: ly - 6,
                      width: legendWidth + 12,
                      height: Math.max(legendHeight + unit * 0.02, 25),
                    })}
                    onPointerDown={(event) => begin(event, 'legend', g)}
                  >
                    <title>Arraste para mover; clique para configurar a legenda</title>
                  </rect>
                )}
                {showHandles &&
                  mode === 'select' &&
                  g.id === graphId &&
                  [
                    [b.left, b.bottom],
                    [b.right, b.bottom],
                    [b.left, b.top],
                    [b.right, b.top],
                  ].map(([x, y], i) => (
                    <rect
                      className="viewport-handle"
                      key={i}
                      data-corner={i}
                      aria-label={`Redimensionar G${g.id}: ${['inferior esquerdo', 'inferior direito', 'superior esquerdo', 'superior direito'][i]}`}
                      x={x - (5.5 * camera.width) / width}
                      y={y - (5.5 * camera.width) / width}
                      width={(11 * camera.width) / width}
                      height={(11 * camera.width) / width}
                      style={{ cursor: i === 0 || i === 3 ? 'nesw-resize' : 'nwse-resize' }}
                      onPointerDown={(event) => begin(event, 'corner', g, i)}
                    >
                      <title>Arraste para redimensionar a área do gráfico</title>
                    </rect>
                  ))}
              </g>
            );
          })}
        {drag?.kind === 'corner' &&
          displayScene.graphs
            .filter((g) => g.id === drag.graphId)
            .map((g) => {
              const box = graphBox(displayScene, g.viewport),
                pixel = camera.width / width;
              return (
                <g key={`resize-${g.id}`} className="resize-preview" pointerEvents="none">
                  <rect
                    x={box.left}
                    y={box.top}
                    width={box.width}
                    height={box.height}
                    className="resize-outline"
                  />
                  <rect
                    x={box.left}
                    y={box.bottom + 10 * pixel}
                    width={170 * pixel}
                    height={25 * pixel}
                    rx={4 * pixel}
                    className="resize-caption-bg"
                  />
                  <text
                    x={box.left + 8 * pixel}
                    y={box.bottom + 27 * pixel}
                    fontSize={12 * pixel}
                    className="resize-caption"
                  >
                    {box.width.toFixed(2)} × {box.height.toFixed(2)} pt
                  </text>
                </g>
              );
            })}
        {(drag ? preview.guides : resizeGuides).map((guide, i) => (
          <line
            className="smart-guide"
            key={i}
            x1={guide.axis === 'x' ? guide.position : guide.from}
            y1={guide.axis === 'x' ? guide.from : guide.position}
            x2={guide.axis === 'x' ? guide.position : guide.to}
            y2={guide.axis === 'x' ? guide.to : guide.position}
          />
        ))}
        {preview.box && (
          <rect
            className={
              drag?.kind === 'move'
                ? 'legend-drag-outline viewport-move-outline'
                : 'legend-drag-outline'
            }
            x={preview.box.x}
            y={preview.box.y}
            width={preview.box.width}
            height={preview.box.height}
          />
        )}
        {pointHover && !disabled && (
          <circle
            className={`point-hover-ring ${mode === 'deletePoint' ? 'is-delete' : ''} ${showRegressionMode ? 'is-regression' : ''}`}
            cx={pointHover.pageX}
            cy={pointHover.pageY}
            r={(7 * camera.width) / width}
            fill="none"
            pointerEvents="none"
          />
        )}
        {drag?.kind === 'zoom' && (
          <rect
            className="drag-guide"
            x={Math.min(drag.start[0], drag.current[0])}
            y={Math.min(drag.start[1], drag.current[1])}
            width={Math.max(2, Math.abs(drag.current[0] - drag.start[0]))}
            height={Math.max(2, Math.abs(drag.current[1] - drag.start[1]))}
          />
        )}
      </svg>
      {(showRegressionMode || ['text', 'addPoint', 'deletePoint'].includes(mode)) && (
        <div
          className={`canvas-mode-hint ${showRegressionMode ? 'is-regression' : ''}`}
          role="status"
        >
          <Icon
            name={
              showRegressionMode
                ? 'chart'
                : mode === 'text'
                  ? 'text'
                  : mode === 'addPoint'
                    ? 'pointAdd'
                    : 'pointDelete'
            }
            size={18}
          />
          <span>
            {showRegressionMode
              ? 'REGRESSÃO · Ctrl/Cmd + clique na série'
              : mode === 'text'
                ? 'TEXTO · clique na posição da anotação'
                : mode === 'addPoint'
                  ? 'ADICIONAR PONTO · clique no gráfico'
                  : 'EXCLUIR PONTO · clique no ponto destacado'}
          </span>
        </div>
      )}
      {pointHover &&
        !disabled &&
        createPortal(
          <div
            className={`point-coordinate-tip ${mode === 'deletePoint' ? 'is-delete' : ''}`}
            role="tooltip"
            style={{
              left: pointScreen.current.x,
              top: Math.min(
                pointScreen.current.y + (regressionHover ? 48 : 0),
                window.innerHeight - 110,
              ),
            }}
          >
            <strong>
              {pointHover.label} · ponto {pointHover.index + 1}
            </strong>
            <span>X = {String(pointHover.x)}</span>
            <span>Y = {String(pointHover.y)}</span>
            <small>
              {mode === 'deletePoint'
                ? 'Clique para excluir · Ctrl+Z desfaz'
                : 'Ctrl + clique na série para regressão'}
            </small>
          </div>,
          document.body,
        )}
      {input && scene.graphs.some((g) => g.id === input.graphId) && (
        <CanvasInput
          key={`${input.kind}:${input.x}:${input.y}`}
          target={input}
          graph={scene.graphs.find((g) => g.id === input.graphId)!}
          setId={graphId === input.graphId ? setId : null}
          onClose={() => setInput(null)}
          onText={(text, size) => {
            if (onChange((s) => addCanvasText(s, input.position, text, size))) setInput(null);
          }}
          onPoint={(id, row) => {
            let nextId = id;
            if (
              onChange((s) => {
                nextId = insertPoint(
                  s.graphs.find((g) => g.id === input.graphId)!,
                  id,
                  row,
                );
              })
            ) {
              onSelect(input.graphId, nextId);
              setInput(null);
            }
          }}
        />
      )}
      {handHover &&
        mode === 'pan' &&
        !drag &&
        !disabled &&
        createPortal(
          <div
            className="hand-hover-hint"
            role="status"
            style={{ left: Math.max(8, handHover.x), top: Math.max(8, handHover.y) }}
          >
            <Icon name={handHover.action === 'move' ? 'move' : 'hand'} size={16} />
            <span>
              {handHover.action === 'move'
                ? 'Mover gráfico na imagem'
                : handHover.action === 'legend'
                  ? 'Mover legenda'
                  : 'Mover dados dentro do gráfico'}
            </span>
          </div>,
          document.body,
        )}
      {hover &&
        (!pointHover || regressionHover) &&
        !disabled &&
        createPortal(
          <div
            className={`canvas-hover-actions ${regressionHover ? 'regression-hover-actions' : ''}`}
            role="toolbar"
            aria-label={`Ações: ${hover.label}`}
            style={{ left: hover.x, top: hover.y }}
            onPointerEnter={keepHover}
            onPointerLeave={leaveHover}
            onFocus={keepHover}
            onBlur={leaveHover}
          >
            <span>{hover.label}</span>
            {regressionHover && hover.setId !== undefined ? (
              <button
                onClick={() => {
                  onRegression?.(hover.graphId, hover.setId!, hover.x, hover.y);
                  setHover(null);
                }}
                aria-label={`Regressão de ${hover.label}`}
              >
                <Icon name="chart" size={14} />
                Regressão
              </button>
            ) : (
              <>
                {hover.kind === 'set' && hover.setId !== undefined && onRegression && (
                  <button
                    className="regression-shortcut"
                    onClick={() => {
                      onRegression(hover.graphId, hover.setId!, hover.x, hover.y);
                      setHover(null);
                    }}
                  >
                    <Icon name="chart" size={16} />
                    Regressão <kbd>Ctrl</kbd>
                  </button>
                )}
                <button onClick={() => configure(hover)} aria-label={`Configurar ${hover.label}`}>
                  <Icon name="settings" size={14} />
                  Configurar
                </button>
                {hover.kind === 'set' && hover.setId !== undefined && (
                  <button
                    onClick={() => {
                      onEditData?.(hover.graphId, hover.setId!);
                      setHover(null);
                    }}
                  >
                    <Icon name="data" size={14} />
                    Dados
                  </button>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
      {context && scene.graphs.some((g) => g.id === context.graphId) && (
        <GraphContextMenu
          graph={scene.graphs.find((g) => g.id === context.graphId)!}
          x={context.x}
          y={context.y}
          onClose={closeContext}
          onChange={(fn) =>
            onChange((scene) => fn(scene.graphs.find((g) => g.id === context.graphId)!))
          }
          onProperties={() => {
            closeContext();
            onInspect(context.graphId, 'graph');
          }}
        />
      )}
    </div>
  );
}
