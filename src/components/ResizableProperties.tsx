import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
const storageKey = 'lsngrace.properties-height';
export function panelLimits(available: number) {
  const max = Math.max(100, available - 140);
  return { min: Math.min(180, max), max };
}
export function ResizableProperties({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [limits, setLimits] = useState(() => panelLimits(window.innerHeight - 46));
  const [height, setHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0) return stored;
    } catch {
      /* Sizing is also available without local storage. */
    }
    return Math.round(window.innerHeight * 0.4);
  });
  const clamp = (value: number) => Math.max(limits.min, Math.min(limits.max, value));
  const visibleHeight = clamp(height);
  useLayoutEffect(() => {
    const parent = panel.current?.parentElement;
    if (!parent) return;
    const resize = () => {
      if (parent.clientHeight > 0) setLimits(panelLimits(parent.clientHeight));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (resizing) return;
    try {
      localStorage.setItem(storageKey, String(visibleHeight));
    } catch {
      /* Optional preference. */
    }
  }, [visibleHeight, resizing]);
  const end = () => {
    drag.current = null;
    setResizing(false);
  };
  return (
    <section
      ref={panel}
      className={`bottom-properties ${resizing ? 'is-resizing' : ''}`}
      aria-label="Configurações da seleção"
      style={{ height: visibleHeight, maxHeight: 'none' }}
    >
      <div
        className="properties-resize-handle"
        role="separator"
        aria-label="Altura das configurações"
        aria-orientation="horizontal"
        tabIndex={0}
        aria-valuemin={limits.min}
        aria-valuemax={limits.max}
        aria-valuenow={Math.round(visibleHeight)}
        aria-valuetext={`${Math.round(visibleHeight)} pixels`}
        title="Arraste para ajustar a altura. Use ↑ e ↓ pelo teclado; duplo clique para restaurar."
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, height: visibleHeight };
          setResizing(true);
        }}
        onPointerMove={(e) => {
          if (drag.current) setHeight(clamp(drag.current.height + drag.current.y - e.clientY));
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          end();
        }}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onDoubleClick={() => setHeight(clamp(window.innerHeight * 0.4))}
        onKeyDown={(e) => {
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          setHeight(
            clamp(
              e.key === 'Home'
                ? limits.min
                : e.key === 'End'
                  ? limits.max
                  : visibleHeight + (e.key === 'ArrowUp' ? 24 : -24),
            ),
          );
        }}
      >
        <span />
      </div>
      {children}
    </section>
  );
}
