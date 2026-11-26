import { TextFormat } from '../../components/TextFormat';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberField } from '../../components/Fields';
import { resolveColor } from '../../core/style/colors';
import type { Graph, Scene } from '../../core/scene/types';
export function LegendProperties({
  scene,
  graph,
  change,
}: {
  scene: Scene;
  graph: Graph;
  change: (fn: (s: Scene) => void) => boolean;
}) {
  const l = graph.legend,
    edit = (fn: (g: Graph) => void) => change((s) => fn(s.graphs.find((g) => g.id === graph.id)!));
  const layout = l.layout ?? ((l.columns ?? 1) > 1 ? 'columns' : 'vertical');
  return (
    <section className="property-section">
      <h3>Legenda</h3>
      <label className="check-field">
        <input
          type="checkbox"
          aria-label="Mostrar legenda"
          checked={l.enabled}
          onChange={(e) =>
            edit((g) => {
              g.legend.enabled = e.target.checked;
            })
          }
        />
        Mostrar legenda
      </label>
      <label className="form-field">
        Posição
        <select
          aria-label="Posição da legenda"
          value=""
          onChange={(e) =>
            edit((g) => {
              const v = g.viewport,
                w = v[2] - v[0],
                h = v[3] - v[1];
              g.legend.coordinates = 'view';
              g.legend.position = [
                v[0] + w * (e.target.value.endsWith('r') ? 0.52 : 0.04),
                v[1] + h * (e.target.value.startsWith('t') ? 0.94 : 0.25),
              ];
            })
          }
        >
          <option value="" disabled>
            Escolher posição
          </option>
          <option value="tr">Superior direita</option>
          <option value="tl">Superior esquerda</option>
          <option value="br">Inferior direita</option>
          <option value="bl">Inferior esquerda</option>
        </select>
      </label>
      <details className="axis-group" open>
        <summary>Distribuição e ícones</summary>
        <div>
          <label className="form-field">
            Distribuição
            <select
              aria-label="Distribuição da legenda"
              value={layout}
              onChange={(e) =>
                edit((g) => {
                  g.legend.layout = e.target.value as typeof layout;
                  g.legend.columns =
                    e.target.value === 'vertical'
                      ? 1
                      : e.target.value === 'horizontal'
                        ? Math.max(1, g.sets.filter((s) => !s.hidden && s.legend).length)
                        : 2;
                })
              }
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
              <option value="columns">Em colunas</option>
            </select>
          </label>
          {layout === 'columns' && (
            <NumberField
              label="Colunas da legenda"
              value={l.columns ?? 2}
              min={1}
              step="1"
              onChange={(v) =>
                edit((g) => {
                  g.legend.columns = v;
                })
              }
            />
          )}
          <NumberField
            label="Tamanho dos ícones (%)"
            value={(l.symbolScale ?? 1) * 100}
            min={0}
            onChange={(v) =>
              edit((g) => {
                g.legend.symbolScale = v / 100;
              })
            }
          />
          <NumberField
            label="Comprimento da amostra"
            value={l.length}
            min={0}
            step="1"
            onChange={(v) =>
              edit((g) => {
                g.legend.length = v;
              })
            }
          />
          <div className="field-pair">
            <NumberField
              label="Espaço ícone–texto"
              value={l.hgap}
              min={0}
              step="1"
              onChange={(v) =>
                edit((g) => {
                  g.legend.hgap = v;
                })
              }
            />
            <NumberField
              label="Espaço entre linhas"
              value={l.vgap}
              min={0}
              step="1"
              onChange={(v) =>
                edit((g) => {
                  g.legend.vgap = v;
                })
              }
            />
          </div>
          {layout !== 'vertical' && (
            <NumberField
              label="Espaço entre colunas (pt)"
              value={l.columnGap ?? 16}
              min={0}
              onChange={(v) =>
                edit((g) => {
                  g.legend.columnGap = v;
                })
              }
            />
          )}
          <label className="check-field">
            <input
              type="checkbox"
              aria-label="Inverter ordem da legenda"
              checked={l.inverted}
              onChange={(e) =>
                edit((g) => {
                  g.legend.inverted = e.target.checked;
                })
              }
            />
            Inverter ordem
          </label>
        </div>
      </details>
      <details className="axis-group">
        <summary>Fundo e borda</summary>
        <div>
          <label className="check-field">
            <input
              type="checkbox"
              aria-label="Fundo transparente da legenda"
              checked={!l.box.fill.pattern || (l.box.fill.opacity ?? 1) === 0}
              onChange={(e) =>
                edit((g) => {
                  g.legend.box.fill.pattern = e.target.checked ? 0 : 1;
                  g.legend.box.fill.opacity = e.target.checked ? 0 : 1;
                })
              }
            />
            Fundo transparente
          </label>
          <ColorPicker
            label="Cor de fundo da legenda"
            scene={scene}
            value={l.box.fill.color}
            onChange={(color) =>
              change((s) => {
                s.graphs.find((g) => g.id === graph.id)!.legend.box.fill.color = resolveColor(
                  s,
                  color,
                );
              })
            }
          />
          <NumberField
            label="Alpha do fundo da legenda"
            value={l.box.fill.pattern ? (l.box.fill.opacity ?? 1) : 0}
            min={0}
            max={1}
            step=".05"
            onChange={(v) =>
              edit((g) => {
                g.legend.box.fill.pattern = v > 0 ? 1 : 0;
                g.legend.box.fill.opacity = v;
              })
            }
          />
          <label className="check-field">
            <input
              type="checkbox"
              aria-label="Mostrar borda da legenda"
              checked={l.box.style !== 0}
              onChange={(e) =>
                edit((g) => {
                  g.legend.box.style = e.target.checked ? 1 : 0;
                })
              }
            />
            Mostrar borda
          </label>
          <ColorPicker
            label="Cor da borda da legenda"
            scene={scene}
            value={l.box.color}
            onChange={(color) =>
              change((s) => {
                s.graphs.find((g) => g.id === graph.id)!.legend.box.color = resolveColor(s, color);
              })
            }
          />
          <NumberField
            label="Espessura da borda da legenda"
            value={l.box.width}
            min={0}
            onChange={(v) =>
              edit((g) => {
                g.legend.box.width = v;
              })
            }
          />
          <label className="form-field">
            Linha da borda
            <select
              aria-label="Linha da borda da legenda"
              value={l.box.style}
              onChange={(e) =>
                edit((g) => {
                  g.legend.box.style = Number(e.target.value) as typeof l.box.style;
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
              ].map((s, i) => (
                <option value={i} key={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <details className="axis-group">
        <summary>Texto e fonte</summary>
        <div>
          <TextFormat
            label="legenda"
            scene={scene}
            value={l}
            onChange={(u) =>
              change((s) => {
                const t = s.graphs.find((g) => g.id === graph.id)!.legend,
                  { color, ...rest } = u;
                Object.assign(t, rest);
                if (color !== undefined) t.color = resolveColor(s, color);
              })
            }
          />
          {graph.sets.map((s) => (
            <label className="form-field" key={s.id}>
              Série {s.id + 1}
              <input
                aria-label={`Texto da legenda S${s.id}`}
                value={s.legend}
                onChange={(e) =>
                  edit((g) => {
                    g.sets.find((set) => set.id === s.id)!.legend = e.target.value;
                  })
                }
              />
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
