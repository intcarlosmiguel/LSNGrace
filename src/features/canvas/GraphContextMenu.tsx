import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Graph } from '../../core/scene/types';
import { GraphSettings } from './GraphSettings';
import { autoscaleGraph } from '../../core/geometry/autoscale';
import { Icon } from '../../components/Icon';
export function GraphContextMenu({
  graph,
  x,
  y,
  onChange,
  onProperties,
  onClose,
}: {
  graph: Graph;
  x: number;
  y: number;
  onChange: (fn: (g: Graph) => void) => boolean;
  onProperties: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector('button')?.focus();
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key, true);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  const left = Math.max(8, Math.min(x, window.innerWidth - 294)),
    top = Math.max(8, Math.min(y, window.innerHeight - 550));
  return createPortal(
    <div
      ref={ref}
      className="graph-context-menu"
      role="dialog"
      aria-label="Configurar gráfico"
      style={{ left, top, maxHeight: 'calc(100dvh - 16px)' }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <header>
        <div>
          <strong>Configurar gráfico</strong>
          <small>G{graph.id} · alterações em tempo real</small>
        </div>
        <button className="icon-button" aria-label="Fechar menu do gráfico" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <GraphSettings graph={graph} onChange={onChange} />
      <div className="graph-context-actions">
        <button onClick={() => onChange((g) => autoscaleGraph(g))}>
          <Icon name="fit" size={16} />
          Ajustar aos dados
        </button>
        <button onClick={onProperties}>
          <Icon name="settings" size={16} />
          Todas as propriedades
        </button>
      </div>
    </div>,
    document.body,
  );
}
