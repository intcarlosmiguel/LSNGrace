import type { Graph, Scale } from '../../core/scene/types';
import { setGraphScale, setGraphBorder } from '../../core/geometry/graphSettings';
/** Shared by the contextual menu and inspector so both edit the same scene fields. */
export function GraphSettings({
  graph,
  onChange,
}: {
  graph: Graph;
  onChange: (fn: (g: Graph) => void) => boolean;
}) {
  return (
    <div className="graph-settings-fields">
      <label className="check-field">
        <input
          type="checkbox"
          aria-label="Mostrar borda do gráfico"
          checked={graph.frame.style !== 0 && graph.frame.pattern !== 0}
          onChange={(e) =>
            onChange((g) => {
              setGraphBorder(g, e.target.checked);
              if (e.target.checked) g.frame.pattern = 1;
            })
          }
        />
        Borda do gráfico
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          aria-label="Mostrar legenda do gráfico"
          checked={graph.legend.enabled}
          onChange={(e) =>
            onChange((g) => {
              g.legend.enabled = e.target.checked;
            })
          }
        />
        Legenda
      </label>
      {(['xaxis', 'yaxis'] as const).map((axis, i) => (
        <div className="graph-settings-axis" key={axis}>
          <div className="graph-settings-axis-heading">
            <strong>Eixo {i ? 'Y' : 'X'}</strong>
            <label className="check-field">
              <input
                type="checkbox"
                aria-label={`Mostrar eixo ${i ? 'Y' : 'X'}`}
                checked={graph.axes[axis].enabled}
                onChange={(e) =>
                  onChange((g) => {
                    g.axes[axis].enabled = e.target.checked;
                  })
                }
              />
              Visível
            </label>
          </div>
          <label className="form-field">
            Escala {i ? 'Y' : 'X'}
            <select
              aria-label={`Escala ${i ? 'Y' : 'X'}`}
              value={graph.axes[axis].scale}
              onChange={(e) => onChange((g) => setGraphScale(g, axis, e.target.value as Scale))}
            >
              <option value="Normal">Linear</option>
              <option value="Logarithmic">Logarítmica</option>
              <option value="Reciprocal">Recíproca</option>
            </select>
          </label>
          <div className="graph-settings-checks">
            <label className="check-field">
              <input
                type="checkbox"
                aria-label={`Grade principal ${i ? 'Y' : 'X'}`}
                checked={graph.axes[axis].ticks.majorGrid}
                onChange={(e) =>
                  onChange((g) => {
                    g.axes[axis].ticks.majorGrid = e.target.checked;
                  })
                }
              />
              Grade
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                aria-label={`Grade secundária ${i ? 'Y' : 'X'}`}
                checked={graph.axes[axis].ticks.minorGrid}
                onChange={(e) =>
                  onChange((g) => {
                    g.axes[axis].ticks.minorGrid = e.target.checked;
                  })
                }
              />
              Subgrade
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                aria-label={`Inverter eixo ${i ? 'Y' : 'X'}`}
                checked={graph.axes[axis].inverted}
                onChange={(e) =>
                  onChange((g) => {
                    g.axes[axis].inverted = e.target.checked;
                  })
                }
              />
              Inverter
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
