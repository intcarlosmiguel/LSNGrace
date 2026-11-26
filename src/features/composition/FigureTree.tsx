import { useRegressionModifier } from '../../components/useRegressionModifier';
import { useCallback, useState, type MouseEvent } from 'react';
import { TreeContextMenu, type TreeTarget } from './TreeContextMenu';
import { Icon } from '../../components/Icon';
import type { Scene } from '../../core/scene/types';
import { graphParents, type Placement } from './layout';
type Props = {
  scene: Scene;
  graphId: number;
  setId: number | null;
  imageSelected: boolean;
  onImage: () => void;
  onGraph: (id: number, setId?: number) => void;
  onAdd: (placement: Placement) => void;
  onData: (id: number, setId?: number) => void;
  onTransform: (g: number, s: number) => void;
  onCopyTransform: (g: number, s: number, columnId?: string) => void;
  onPasteTransform: (g: number, s: number) => void;
  onContextSelect?: (target: TreeTarget) => void;
  onDelete: (target: TreeTarget) => void;
  onRegression?: (g: number, s: number, x: number, y: number) => void;
  onRegressionReport?: (g: number, id: number, x: number, y: number) => void;
  change: (fn: (s: Scene) => void) => boolean;
};
export function FigureTree({
  scene,
  graphId,
  setId,
  imageSelected,
  onImage,
  onGraph,
  onAdd,
  onData,
  onTransform,
  onCopyTransform,
  onPasteTransform,
  onContextSelect,
  onDelete,
  onRegression,
  onRegressionReport,
  change,
}: Props) {
  const [context, setContext] = useState<{ target: TreeTarget; x: number; y: number } | null>(null);
  const closeContext = useCallback(() => setContext(null), []);
  const openContext = (event: MouseEvent, target: TreeTarget) => {
    event.preventDefault();
    event.stopPropagation();
    onContextSelect?.(target);
    const rect = event.currentTarget.getBoundingClientRect();
    setContext({ target, x: event.clientX || rect.left, y: event.clientY || rect.bottom });
  };
  const regressionModifier = useRegressionModifier();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const parents = graphParents(scene);
  const renderGraph = (id: number, depth: number) => {
    const g = scene.graphs.find((g) => g.id === id)!;
    const open = !collapsed.has(id),
      selected = !imageSelected && graphId === id;
    return (
      <div key={id} className="graph-branch">
        <div
          className={`hierarchy-row ${selected && setId === null ? 'selected' : ''} ${g.hidden || !g.enabled ? 'is-hidden' : ''}`}
          style={{ paddingLeft: 10 + depth * 13 }}
          onContextMenu={(e) => openContext(e, { kind: 'graph', graphId: id })}
        >
          <button
            className={`tree-disclosure ${open ? 'is-open' : ''}`}
            aria-label={`${open ? 'Recolher' : 'Expandir'} G${id}`}
            aria-expanded={open}
            onClick={() =>
              setCollapsed((old) => {
                const next = new Set(old);
                if (open) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          >
            <Icon name="chevron" size={13} />
          </button>
          <button
            className="hierarchy-select"
            aria-label={`Configurar gráfico G${id}`}
            aria-current={selected && setId === null ? 'true' : undefined}
            onClick={() => onGraph(id)}
          >
            <Icon name="chart" size={17} />
            <span>
              <strong>Gráfico {id + 1}</strong>
              <small>
                {parents.has(id) ? `Dentro de G${parents.get(id)}` : `G${id}`} · {g.sets.length}{' '}
                {g.sets.length === 1 ? 'série' : 'séries'}
              </small>
            </span>
          </button>
          <button
            className="icon-button tree-visibility"
            aria-label={`${g.hidden || !g.enabled ? 'Mostrar' : 'Ocultar'} gráfico G${id}`}
            title="Visibilidade do gráfico"
            onClick={() =>
              change((s) => {
                const item = s.graphs.find((g) => g.id === id)!;
                if (!item.enabled) {
                  item.enabled = true;
                  item.hidden = false;
                } else item.hidden = !item.hidden;
              })
            }
          >
            <Icon name={g.hidden || !g.enabled ? 'eyeOff' : 'eye'} size={16} />
          </button>
        </div>
        {open && (
          <>
            {g.sets.map((s) => {
              const color = `rgb(${scene.colors.find((c) => c.id === (s.line.connection === 0 ? s.symbol.color : s.line.color))?.rgb.join(',') ?? '0,0,0'})`;
              const toggleVisibility = () =>
                change((scene) => {
                  const item = scene.graphs
                    .find((g) => g.id === id)!
                    .sets.find((set) => set.id === s.id)!;
                  item.hidden = !item.hidden;
                });
              return (
                <div key={s.id} className="series-branch">
                  <div
                    onContextMenu={(e) => openContext(e, { kind: 'set', graphId: id, setId: s.id })}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && ['c', 'v'].includes(e.key.toLowerCase())) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.key.toLowerCase() === 'c') onCopyTransform(id, s.id);
                        else onPasteTransform(id, s.id);
                      }
                    }}
                    className={`hierarchy-row series-node ${selected && setId === s.id ? 'selected' : ''} ${s.hidden ? 'is-hidden' : ''}`}
                    style={{ paddingLeft: 37 + depth * 13 }}
                  >
                    <button
                      className="series-dot"
                      style={{ background: s.hidden ? 'transparent' : color, borderColor: color }}
                      aria-label={`Alternar visibilidade pela cor da série G${id}.S${s.id}`}
                      title={s.hidden ? 'Mostrar série' : 'Ocultar série'}
                      onClick={toggleVisibility}
                    />
                    <button
                      className="hierarchy-select"
                      aria-label={`Configurar série G${id}.S${s.id}`}
                      title={
                        regressionModifier
                          ? 'Clique para abrir regressão'
                          : 'Ctrl+clique para regressão'
                      }
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) onRegression?.(id, s.id, e.clientX, e.clientY);
                        else onGraph(id, s.id);
                      }}
                    >
                      <span>
                        <strong>{s.legend || `Série ${s.id + 1}`}</strong>
                        <small>
                          <span className="series-data-hint">
                            {s.type.toUpperCase()} · {s.rows.length.toLocaleString('pt-BR')} pontos
                          </span>
                          <span className="series-regression-hint">Regressão · Ctrl+clique</span>
                        </small>
                      </span>
                    </button>
                    <button
                      className="icon-button tree-visibility"
                      aria-label={`${s.hidden ? 'Mostrar' : 'Ocultar'} série G${id}.S${s.id}`}
                      title={s.hidden ? 'Mostrar série' : 'Ocultar série'}
                      onClick={toggleVisibility}
                    >
                      <Icon name={s.hidden ? 'eyeOff' : 'eye'} size={16} />
                    </button>
                  </div>
                  {s.worksheet?.columns.map((column) => (
                    <div
                      key={column.id}
                      className="transformation-tree-node"
                      style={{ marginLeft: 56 + depth * 13 }}
                    >
                      <button
                        className="transformation-tree-label"
                        title={column.expression}
                        aria-label={`Transformação ${column.id.toUpperCase()} de G${id}.S${s.id}: ${column.expression}`}
                        onClick={() => onTransform(id, s.id)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                            e.preventDefault();
                            e.stopPropagation();
                            onCopyTransform(id, s.id, column.id);
                          }
                        }}
                      >
                        <Icon name="edit" size={13} />
                        <span>
                          <strong>{column.id.toUpperCase()}</strong> · {column.expression}
                        </span>
                      </button>
                      <button
                        className="icon-button"
                        title="Copiar transformação para outra série"
                        aria-label={`Copiar transformação ${column.id.toUpperCase()} de G${id}.S${s.id}`}
                        onClick={() => onCopyTransform(id, s.id, column.id)}
                      >
                        <Icon name="copy" size={14} />
                      </button>
                    </div>
                  ))}
                  {g.regressions
                    ?.filter((report) => report.curveSetId === s.id)
                    .map((report) => (
                      <button
                        key={`regression-${report.id}`}
                        className="regression-report-node"
                        style={{ marginLeft: 56 + depth * 13 }}
                        aria-label={`Informações da regressão G${id}.S${s.id}`}
                        onClick={(e) => onRegressionReport?.(id, report.id, e.clientX, e.clientY)}
                      >
                        <Icon name="file" size={13} /> Informações da regressão
                      </button>
                    ))}
                </div>
              );
            })}
            {scene.graphs
              .filter((child) => parents.get(child.id) === id)
              .map((g) => renderGraph(g.id, depth + 1))}
            <button
              className="tree-add-data"
              style={{ paddingLeft: 38 + depth * 13 }}
              onClick={() => onData(id)}
            >
              <Icon name="plus" size={14} />
              Adicionar dados a G{id}
            </button>
          </>
        )}
      </div>
    );
  };
  return (
    <div
      className={`figure-tree ${regressionModifier && onRegression ? 'regression-modifier' : ''}`}
      aria-label="Hierarquia da imagem"
    >
      <button
        className={`image-node ${imageSelected ? 'selected' : ''}`}
        onClick={onImage}
        onContextMenu={(e) => openContext(e, { kind: 'image' })}
        aria-label="Configurar imagem"
        aria-current={imageSelected ? 'true' : undefined}
      >
        <Icon name="image" size={22} />
        <span>
          <strong>Imagem</strong>
          <small>
            {scene.page.size.join(' × ')} pt · {scene.graphs.length}{' '}
            {scene.graphs.length === 1 ? 'gráfico' : 'gráficos'}
          </small>
        </span>
        <Icon name="settings" size={16} />
      </button>
      <div className="tree-regression-hint">
        <Icon name="chart" size={15} />
        <span>
          <kbd>Ctrl</kbd> + clique na série
          <br />
          <strong>Abrir regressão</strong>
        </span>
      </div>
      <div className="hierarchy-graphs">
        {scene.graphs.filter((g) => !parents.has(g.id)).map((g) => renderGraph(g.id, 0))}
      </div>
      {context && (
        <TreeContextMenu
          scene={scene}
          target={context.target}
          x={context.x}
          y={context.y}
          onClose={closeContext}
          onConfigure={() => {
            const target = context.target;
            if (target.kind === 'image') onImage();
            else onGraph(target.graphId, target.kind === 'set' ? target.setId : undefined);
          }}
          onRegression={(g, s, x, y) => onRegression?.(g, s, x, y)}
          onData={onData}
          onTransform={onTransform}
          onCopyTransform={onCopyTransform}
          onPasteTransform={onPasteTransform}
          onDelete={() => onDelete(context.target)}
        />
      )}
      <div className="tree-add-actions">
        <button onClick={() => onAdd('beside')} title="Adicionar gráfico ao lado">
          <Icon name="plus" size={15} />
          Gráfico
        </button>
        <button onClick={() => onAdd('inset')} title={`Adicionar gráfico dentro de G${graphId}`}>
          <Icon name="inset" size={15} />
          Interno
        </button>
      </div>
    </div>
  );
}
