import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import { pointExtras } from './pointEditing';
import type { Graph, Point } from '../../core/scene/types';
export type CanvasInputTarget = {
  kind: 'text' | 'addPoint';
  graphId: number;
  position: Point;
  world: Point;
  x: number;
  y: number;
};
export function CanvasInput({
  target,
  graph,
  setId,
  onText,
  onPoint,
  onClose,
}: {
  target: CanvasInputTarget;
  graph: Graph;
  setId: number | null;
  onText: (text: string, size: number) => void;
  onPoint: (id: number | null, row: number[]) => void;
  onClose: () => void;
}) {
  const eligible = graph.sets.filter((s) => !s.hidden && Object.hasOwn(pointExtras, s.type));
  const [series, setSeries] = useState(() =>
    eligible.some((s) => s.id === setId)
      ? String(setId)
      : eligible.length === 1
        ? String(eligible[0].id)
        : eligible.length
          ? ''
          : 'new',
  );
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const type = eligible.find((s) => String(s.id) === series)?.type ?? 'xy';
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input,textarea,select')?.focus();
  }, []);
  return createPortal(
    <div
      ref={ref}
      className="canvas-input-panel"
      role="dialog"
      aria-label={target.kind === 'text' ? 'Criar texto' : 'Adicionar ponto'}
      style={{
        left: Math.max(8, Math.min(target.x, window.innerWidth - 300)),
        top: Math.max(8, Math.min(target.y, window.innerHeight - 400)),
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <header>
        <strong>{target.kind === 'text' ? 'Criar texto' : 'Adicionar ponto'}</strong>
        <button className="icon-button" aria-label="Cancelar edição no canvas" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          const data = new FormData(e.currentTarget);
          try {
            if (target.kind === 'text') onText(String(data.get('text')), Number(data.get('size')));
            else
              onPoint(series === 'new' ? null : Number(series), [
                Number(data.get('x')),
                Number(data.get('y')),
                ...(pointExtras[type] ?? []).map((_, i) => Number(data.get(`extra${i}`))),
              ]);
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      >
        {target.kind === 'text' ? (
          <>
            <label>
              Texto
              <textarea
                name="text"
                rows={3}
                maxLength={4096}
                required
                placeholder="Digite o texto da anotação"
              />
            </label>
            <label>
              Tamanho
              <input
                name="size"
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                defaultValue="1"
                required
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Série
              <select value={series} onChange={(e) => setSeries(e.target.value)} required>
                <option value="" disabled>
                  Escolha a série
                </option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legend || `S${s.id}`} · G{graph.id}.S{s.id}
                  </option>
                ))}
                <option value="new">Nova série XY</option>
              </select>
            </label>
            <div className="regression-grid">
              <label>
                X<input name="x" type="number" step="any" defaultValue={target.world[0]} required />
              </label>
              <label>
                Y<input name="y" type="number" step="any" defaultValue={target.world[1]} required />
              </label>
            </div>
            {(pointExtras[type] ?? []).map((name, i) => (
              <label key={`${type}:${i}`}>
                {name}
                <input
                  name={`extra${i}`}
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={type === 'xysize' ? 1 : 0}
                  required
                />
              </label>
            ))}
            <small>O ponto entra na ordem de X se a série estiver ordenada.</small>
          </>
        )}
        {error && (
          <p role="alert" className="regression-error">
            {error}
          </p>
        )}
        <button className="button primary" type="submit">
          {target.kind === 'text' ? 'Inserir texto' : 'Adicionar ponto'}
        </button>
      </form>
    </div>,
    document.body,
  );
}
