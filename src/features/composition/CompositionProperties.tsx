import { useState } from 'react';
import { UnitSelect } from '../../components/SizeFields';
import {
  fromPoints,
  toPoints,
  displayNumber,
  sameSize,
  type LengthUnit,
} from '../../core/geometry/units';
import { NumberField } from '../../components/Fields';
import { ColorPicker } from '../../components/ColorPicker';
import { resolveColor } from '../../core/style/colors';
import { Icon } from '../../components/Icon';
import type { Bounds, Graph, Scene } from '../../core/scene/types';
import { arrangeGraphs, moveViewport, resizeImage, type Placement } from './layout';
type Props = {
  scene: Scene;
  change: (fn: (s: Scene) => void) => boolean;
  onAdd: (placement: Placement) => void;
};
export function ImageProperties({ scene, change, onAdd }: Props) {
  const [unit, setUnit] = useState<LengthUnit>('pt');
  const [reference, setReference] = useState<[number, number]>([...scene.page.size]);
  const [locked, setLocked] = useState(false);
  const dimension = (index: number, value: number) =>
    change((s) => {
      const next = toPoints(value, unit, reference[index]);
      if (sameSize(next, s.page.size[index])) return;
      const factor = next / s.page.size[index];
      resizeImage(
        s,
        index === 0 ? next : locked ? s.page.size[0] * factor : s.page.size[0],
        index === 1 ? next : locked ? s.page.size[1] * factor : s.page.size[1],
      );
    });
  return (
    <div className="image-properties">
      <section className="property-section">
        <h3>Dimensões da imagem</h3>
        <UnitSelect
          label="Unidade da imagem"
          value={unit}
          onChange={(u) => {
            if (u === '%') setReference([...scene.page.size]);
            setUnit(u as LengthUnit);
          }}
        />
        <p className="field-hint">
          {unit === '%'
            ? `100% = ${reference.join(' × ')} pt ao selecionar esta unidade.`
            : unit === 'px'
              ? 'Pixels de referência a 96 px por polegada. O zoom da tela não altera esta medida.'
              : 'Dimensão física da imagem de publicação.'}
        </p>
        <div className="field-pair">
          <NumberField
            label="Largura da imagem"
            value={displayNumber(fromPoints(scene.page.size[0], unit, reference[0]))}
            min={0}
            onChange={(v) => dimension(0, v)}
          />
          <NumberField
            label="Altura da imagem"
            value={displayNumber(fromPoints(scene.page.size[1], unit, reference[1]))}
            min={0}
            onChange={(v) => dimension(1, v)}
          />
        </div>
        <label className="check-field">
          <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
          Manter proporção da imagem
        </label>
        <button
          className="button full"
          onClick={() => change((s) => resizeImage(s, s.page.size[1], s.page.size[0]))}
        >
          <Icon name="image" size={16} />
          Trocar orientação
        </button>
      </section>
      <section className="property-section">
        <h3>Fundo da imagem</h3>
        <ColorPicker
          scene={scene}
          label="Cor de fundo da imagem"
          value={scene.page.background}
          onChange={(color) =>
            change((s) => {
              s.page.background = resolveColor(s, color);
            })
          }
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={scene.page.fill}
            onChange={(e) =>
              change((s) => {
                s.page.fill = e.target.checked;
              })
            }
          />
          Preencher fundo da imagem
        </label>
      </section>
      <section className="property-section">
        <h3>Composição dos gráficos</h3>
        <p className="field-hint">
          Organize os gráficos na imagem. Gráficos internos acompanham o gráfico que os contém.
        </p>
        <div className="layout-actions">
          <button className="button" onClick={() => change((s) => arrangeGraphs(s, 'row'))}>
            Lado a lado
          </button>
          <button className="button" onClick={() => change((s) => arrangeGraphs(s, 'column'))}>
            Empilhados
          </button>
          <button className="button" onClick={() => change((s) => arrangeGraphs(s, 'grid'))}>
            Grade
          </button>
        </div>
        <button className="button full" onClick={() => onAdd('beside')}>
          <Icon name="plus" size={16} />
          Adicionar gráfico ao lado
        </button>
        <button className="button full" onClick={() => onAdd('below')}>
          <Icon name="plus" size={16} />
          Adicionar gráfico abaixo
        </button>
      </section>
    </div>
  );
}
export function GraphPlacement({
  scene,
  graph,
  change,
  onAdd,
  onDelete,
  locked,
  onLockedChange,
  onScale,
}: Props & {
  graph: Graph;
  onDelete: () => void;
  locked: boolean;
  onLockedChange: (value: boolean) => void;
  onScale: (factor: number) => void;
}) {
  const [sizeUnit, setSizeUnit] = useState<LengthUnit>('%');
  const unit = Math.min(...scene.page.size),
    [w, h] = scene.page.size,
    v = graph.viewport;
  const points = [v[0] * unit, h - v[3] * unit, (v[2] - v[0]) * unit, (v[3] - v[1]) * unit];
  const values = points.map((n, i) => fromPoints(n, sizeUnit, i % 2 === 0 ? w : h));
  const update = (index: number, value: number) =>
    change((s) => {
      const g = s.graphs.find((g) => g.id === graph.id)!,
        next = [...g.viewport] as Bounds;
      const n = toPoints(value, sizeUnit, index % 2 === 0 ? w : h) / unit;
      if (index === 0) {
        const dx = n - next[0];
        next[0] += dx;
        next[2] += dx;
      }
      if (index === 1) {
        const dy = h / unit - n - next[3];
        next[1] += dy;
        next[3] += dy;
      }
      if (index === 2) {
        next[2] = next[0] + n;
        if (locked)
          next[1] =
            next[3] - (n * (g.viewport[3] - g.viewport[1])) / (g.viewport[2] - g.viewport[0]);
      }
      if (index === 3) {
        next[1] = next[3] - n;
        if (locked)
          next[2] =
            next[0] + (n * (g.viewport[2] - g.viewport[0])) / (g.viewport[3] - g.viewport[1]);
      }
      moveViewport(s, graph.id, next);
    });
  return (
    <section className="property-section graph-placement">
      <h3>Posição na imagem</h3>
      <p className="field-hint">
        Altere a área ocupada na imagem. O zoom dos dados é controlado pelos botões + e − do canvas.
      </p>
      <UnitSelect
        label="Unidade do gráfico"
        value={sizeUnit}
        onChange={(u) => setSizeUnit(u as LengthUnit)}
      />
      {sizeUnit === '%' && (
        <p className="field-hint">Percentuais da largura e da altura da imagem.</p>
      )}
      <div className="field-pair">
        {['Esquerda', 'Topo', 'Largura', 'Altura'].map((name, i) => {
          const label = `${name} (${sizeUnit})`;
          return (
            <NumberField
              key={label}
              label={label}
              value={displayNumber(values[i])}
              min={i > 1 ? 0 : undefined}
              step="any"
              onChange={(n) => update(i, n)}
            />
          );
        })}
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={locked}
          onChange={(e) => onLockedChange(e.target.checked)}
        />
        Manter proporção do gráfico
      </label>
      <p className="field-hint">
        Arraste os cantos para redimensionar. Shift mantém a proporção; Alt redimensiona pelo
        centro. Guias inteligentes alinham à imagem e aos outros gráficos; Ctrl/Cmd permite arrastar
        livremente.
      </p>
      <div className="layout-actions">
        <button
          className="button"
          aria-label="Reduzir área do gráfico"
          onClick={() => onScale(1 / 1.1)}
        >
          Reduzir
        </button>
        <button
          className="button"
          aria-label="Aumentar área do gráfico"
          onClick={() => onScale(1.1)}
        >
          Aumentar
        </button>
      </div>
      <button className="button full" onClick={() => onAdd('inset')}>
        <Icon name="inset" size={16} />
        Adicionar gráfico interno
      </button>
      <button className="text-button danger" onClick={onDelete}>
        <Icon name="trash" size={14} />
        Remover gráfico
      </button>
    </section>
  );
}
