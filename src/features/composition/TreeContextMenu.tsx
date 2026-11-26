import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import type { Scene } from '../../core/scene/types';
export type TreeTarget =
  | { kind: 'image' }
  | { kind: 'graph'; graphId: number }
  | { kind: 'set'; graphId: number; setId: number };
export function TreeContextMenu({
  scene,
  target,
  x,
  y,
  onConfigure,
  onRegression,
  onData,
  onTransform,
  onCopyTransform,
  onPasteTransform,
  onDelete,
  onClose,
}: {
  scene: Scene;
  target: TreeTarget;
  x: number;
  y: number;
  onConfigure: () => void;
  onRegression: (g: number, s: number, x: number, y: number) => void;
  onData: (g: number, s?: number) => void;
  onTransform: (g: number, s: number) => void;
  onCopyTransform: (g: number, s: number) => void;
  onPasteTransform: (g: number, s: number) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'root' | 'regression' | 'data'>('root');
  const [position, setPosition] = useState({ x, y });
  const graphs =
    target.kind === 'image' ? scene.graphs : scene.graphs.filter((g) => g.id === target.graphId);
  const series = graphs.flatMap((g) => g.sets.map((s) => ({ g, s })));
  const label =
    target.kind === 'image'
      ? 'imagem'
      : target.kind === 'graph'
        ? `gráfico G${target.graphId}`
        : `série G${target.graphId}.S${target.setId}`;
  useLayoutEffect(() => {
    const place = () => {
      const bounds = ref.current?.getBoundingClientRect();
      if (bounds)
        setPosition({
          x: Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)),
          y: Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)),
        });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [x, y, view]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [view]);
  const run = (action: () => void) => {
    onClose();
    action();
  };
  return createPortal(
    <div
      ref={ref}
      className="tree-context-menu"
      role="menu"
      aria-label={`Ações: ${label}`}
      style={{ left: position.x, top: position.y }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && view !== 'root') {
          event.preventDefault();
          setView('root');
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(
          ref.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
        );
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      <div className="tree-context-title">
        {view === 'root'
          ? label
          : view === 'regression'
            ? 'Regressão · escolha a série'
            : 'Dados · escolha a série'}
      </div>
      {view === 'root' ? (
        <>
          <button role="menuitem" onClick={() => run(onConfigure)}>
            <Icon name="settings" size={16} />
            Configurações
          </button>
          <button
            role="menuitem"
            disabled={!series.length}
            aria-haspopup={target.kind === 'set' ? undefined : 'menu'}
            onClick={() => {
              if (target.kind === 'set')
                run(() => onRegression(target.graphId, target.setId, position.x, position.y));
              else setView('regression');
            }}
          >
            <Icon name="chart" size={16} />
            Regressão{target.kind !== 'set' && <Icon name="chevron" size={13} />}
          </button>
          <button
            role="menuitem"
            aria-haspopup={target.kind === 'set' ? undefined : 'menu'}
            onClick={() => {
              if (target.kind === 'set') run(() => onData(target.graphId, target.setId));
              else setView('data');
            }}
          >
            <Icon name="data" size={16} />
            Dados{target.kind !== 'set' && <Icon name="chevron" size={13} />}
          </button>
          {target.kind === 'set' && (
            <button
              role="menuitem"
              onClick={() => run(() => onTransform(target.graphId, target.setId))}
            >
              <Icon name="edit" size={16} />
              Transformações
            </button>
          )}
          {target.kind === 'set' && (
            <>
              <button
                role="menuitem"
                disabled={
                  !series.find(({ s }) => s.id === target.setId)?.s.worksheet?.columns.length
                }
                onClick={() => run(() => onCopyTransform(target.graphId, target.setId))}
              >
                <Icon name="copy" size={16} />
                Copiar transformações <kbd>Ctrl+C</kbd>
              </button>
              <button
                role="menuitem"
                onClick={() => run(() => onPasteTransform(target.graphId, target.setId))}
              >
                <Icon name="paste" size={16} />
                Colar transformação <kbd>Ctrl+V</kbd>
              </button>
            </>
          )}
          <div role="separator" />
          <button role="menuitem" className="tree-context-delete" onClick={() => run(onDelete)}>
            <Icon name="trash" size={16} />
            Excluir{' '}
            {target.kind === 'image' ? 'imagem' : target.kind === 'graph' ? 'gráfico' : 'série'}
          </button>
        </>
      ) : (
        <>
          <button role="menuitem" onClick={() => setView('root')}>
            <Icon name="undo" size={16} />
            Voltar
          </button>
          {series.map(({ g, s }) => (
            <button
              role="menuitem"
              key={`${g.id}:${s.id}`}
              onClick={() =>
                run(() =>
                  view === 'regression'
                    ? onRegression(g.id, s.id, position.x, position.y)
                    : onData(g.id, s.id),
                )
              }
            >
              <Icon name={view === 'regression' ? 'chart' : 'data'} size={16} />
              <span>
                {s.legend || `Série ${s.id + 1}`}
                <small>
                  G{g.id}.S{s.id}
                </small>
              </span>
            </button>
          ))}
          {view === 'data' &&
            graphs.map((g) => (
              <button role="menuitem" key={`add:${g.id}`} onClick={() => run(() => onData(g.id))}>
                <Icon name="plus" size={16} />
                Adicionar dados a G{g.id}
              </button>
            ))}
        </>
      )}
    </div>,
    document.body,
  );
}
