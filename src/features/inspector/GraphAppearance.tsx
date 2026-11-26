import { ColorPicker } from '../../components/ColorPicker';
import { NumberField } from '../../components/Fields';
import { resolveColor } from '../../core/style/colors';
import type { Graph, Scene } from '../../core/scene/types';
import type { GridPaint } from '../../core/style/figure';
export function GridProperties({
  scene,
  graph,
  change,
}: {
  scene: Scene;
  graph: Graph;
  change: (fn: (s: Scene) => void) => boolean;
}) {
  const edit = (fn: (g: Graph) => void) =>
    change((s) => fn(s.graphs.find((g) => g.id === graph.id)!));
  const defaults: GridPaint = { color: 7, width: 0.7, style: 3, opacity: 0.65 };
  return (
    <section className="property-section">
      <h3>Grade</h3>
      {(['major', 'minor'] as const).map((kind, i) => {
        const label = i ? 'Grade secundária' : 'Grade principal',
          key = i ? 'minorGrid' : 'majorGrid',
          paint = graph.grid?.[kind] ?? defaults;
        const update = (fn: (p: GridPaint) => void) =>
          edit((g) => {
            g.grid ??= {};
            g.grid[kind] ??= { ...defaults };
            fn(g.grid[kind]!);
          });
        return (
          <details className="axis-group" key={kind} open={!i || undefined}>
            <summary>{label}</summary>
            <div className="grid-paint-controls">
              <div className="check-row">
                {(['xaxis', 'yaxis'] as const).map((axis, j) => (
                  <label className="check-field" key={axis}>
                    <input
                      type="checkbox"
                      aria-label={`${label} ${j ? 'horizontal' : 'vertical'}`}
                      checked={graph.axes[axis].ticks[key]}
                      onChange={(e) =>
                        edit((g) => {
                          g.axes[axis].ticks[key] = e.target.checked;
                          g.grid ??= {};
                          g.grid[kind] ??= { ...defaults };
                        })
                      }
                    />
                    {j ? 'Horizontal' : 'Vertical'}
                  </label>
                ))}
              </div>
              <label className="form-field">
                Linha
                <select
                  aria-label={`Linha: ${label}`}
                  value={paint.style}
                  onChange={(e) =>
                    update((p) => {
                      p.style = Number(e.target.value) as GridPaint['style'];
                    })
                  }
                >
                  {[
                    'Sem linha',
                    'Contínua',
                    'Pontilhada',
                    'Tracejada',
                    'Traços longos',
                    'Traço e ponto',
                  ].map((s, k) => (
                    <option value={k} key={k}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <ColorPicker
                scene={scene}
                label={`Cor: ${label}`}
                value={paint.color}
                onChange={(color) =>
                  change((s) => {
                    const g = s.graphs.find((g) => g.id === graph.id)!;
                    g.grid ??= {};
                    g.grid[kind] ??= { ...defaults };
                    g.grid[kind]!.color = resolveColor(s, color);
                  })
                }
              />
              <div className="field-pair">
                <NumberField
                  label={`Espessura: ${label}`}
                  value={paint.width}
                  min={0}
                  step=".1"
                  onChange={(v) =>
                    update((p) => {
                      p.width = v;
                    })
                  }
                />
                <NumberField
                  label={`Alpha: ${label}`}
                  value={paint.opacity}
                  min={0}
                  max={1}
                  step=".05"
                  onChange={(v) =>
                    update((p) => {
                      p.opacity = v;
                    })
                  }
                />
              </div>
            </div>
          </details>
        );
      })}
    </section>
  );
}
