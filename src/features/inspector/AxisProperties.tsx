import { useEffect, useState } from 'react';
import { FontSizeField } from '../../components/SizeFields';
import { NumberField } from '../../components/Fields';
import { TextFormat } from '../../components/TextFormat';
import { ColorPicker } from '../../components/ColorPicker';
import { resolveColor } from '../../core/style/colors';
import { setGraphScale, axisBarVisible, setAxisBar } from '../../core/geometry/graphSettings';
import type { Axis, Graph, Scene, Stroke } from '../../core/scene/types';
type Props = {
  scene: Scene;
  graph: Graph;
  axisId: 'xaxis' | 'yaxis';
  change: (fn: (s: Scene) => void) => boolean;
  focusLabel?: boolean;
};
const styles = [
  'Sem linha',
  'Contínua',
  'Pontilhada',
  'Tracejada',
  'Traços longos',
  'Traço e ponto',
];
export function AxisProperties({ scene, graph, axisId, change, focusLabel = false }: Props) {
  const [tab, setTab] = useState('scale');
  useEffect(() => {
    setTab(focusLabel ? 'label' : 'scale');
  }, [axisId, graph.id, focusLabel]);
  const sections = [
    ['scale', 'Escala e intervalo'],
    ['label', 'Nome do eixo e barra'],
    ['numbers', 'Números dos ticks'],
    ['ticks', 'Marcas e grades'],
    ['position', 'Posicionamento'],
  ] as const;
  const axis = graph.axes[axisId],
    name = axisId === 'xaxis' ? 'X' : 'Y',
    index = axisId === 'xaxis' ? 0 : 1;
  const edit = (fn: (a: Axis) => void) =>
    change((s) => fn(s.graphs.find((g) => g.id === graph.id)!.axes[axisId]));
  const check = (label: string, value: boolean, fn: (a: Axis, v: boolean) => void) => (
    <label className="check-field">
      <input
        type="checkbox"
        aria-label={`${label} ${name}`}
        checked={value}
        onChange={(e) => edit((a) => fn(a, e.target.checked))}
      />
      {label}
    </label>
  );
  const select = (
    label: string,
    value: string,
    options: readonly (readonly [string, string])[],
    fn: (a: Axis, v: string) => void,
  ) => (
    <label className="form-field">
      {label}
      <select
        aria-label={`${label} ${name}`}
        value={value}
        onChange={(e) => edit((a) => fn(a, e.target.value))}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const places = [
    ['normal', 'Normal (inferior/esquerdo)'],
    ['opposite', 'Oposto (superior/direito)'],
    ['both', 'Ambos os lados'],
  ] as const;
  const number = (
    label: string,
    value: number,
    fn: (a: Axis, v: number) => void,
    min?: number,
    max?: number,
    step = 'any',
  ) => (
    <NumberField
      label={`${label} ${name}`}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(v) => edit((a) => fn(a, v))}
    />
  );
  const stroke = (label: string, value: Stroke, path: (a: Axis) => Stroke) => (
    <div className="axis-stroke">
      <ColorPicker
        label={`Cor: ${label} ${name}`}
        scene={scene}
        value={value.color}
        onChange={(color) =>
          change((s) => {
            path(s.graphs.find((g) => g.id === graph.id)!.axes[axisId]).color = resolveColor(
              s,
              color,
            );
          })
        }
      />
      <div className="field-pair">
        {number(
          `Espessura: ${label}`,
          value.width,
          (a, v) => {
            path(a).width = v;
          },
          0,
        )}
        {select(
          `Estilo: ${label}`,
          String(value.style),
          styles.map((s, i) => [String(i), s] as const),
          (a, v) => {
            path(a).style = Number(v) as Stroke['style'];
          },
        )}
      </div>
    </div>
  );
  const textFormat = (kind: 'label' | 'tickLabels', label: string) => (
    <TextFormat
      scene={scene}
      label={`${label} ${name}`}
      value={axis[kind]}
      onChange={(update) =>
        change((s) => {
          const a = s.graphs.find((g) => g.id === graph.id)!.axes[axisId],
            { color, ...rest } = update;
          Object.assign(a[kind], rest);
          if (color !== undefined) a[kind].color = resolveColor(s, color);
        })
      }
    />
  );
  return (
    <section className="axis-properties" aria-label={`Propriedades do eixo ${name}`}>
      <h3>Eixo {name}</h3>
      <div className="property-tabs" role="tablist" aria-label={`Configurações do eixo ${name}`}>
        {sections.map(([id, label]) => (
          <button
            key={id}
            id={`${axisId}-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`${axisId}-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              const index = sections.findIndex(([key]) => key === tab);
              const next =
                e.key === 'ArrowRight'
                  ? (index + 1) % sections.length
                  : e.key === 'ArrowLeft'
                    ? (index + sections.length - 1) % sections.length
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? sections.length - 1
                        : -1;
              if (next >= 0) {
                e.preventDefault();
                setTab(sections[next][0]);
                document.getElementById(`${axisId}-tab-${sections[next][0]}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {check('Mostrar eixo', axis.enabled, (a, v) => {
        a.enabled = v;
      })}
      <div
        className="axis-tab-panel"
        role="tabpanel"
        id={`${axisId}-panel-scale`}
        aria-labelledby={`${axisId}-tab-scale`}
        hidden={tab !== 'scale'}
      >
        <div>
          <label className="form-field">
            Escala {name}
            <select
              aria-label={`Escala ${name}`}
              value={axis.scale}
              onChange={(e) =>
                change((s) =>
                  setGraphScale(
                    s.graphs.find((g) => g.id === graph.id)!,
                    axisId,
                    e.target.value as Axis['scale'],
                  ),
                )
              }
            >
              <option value="Normal">Linear</option>
              <option value="Logarithmic">Logarítmica</option>
              <option value="Reciprocal">Recíproca</option>
            </select>
          </label>
          {axis.scale === 'Logarithmic' && (
            <>
              {select(
                'Notação da potência',
                axis.tickLabels.format,
                [
                  ['power', '10ⁿ — potência de dez'],
                  ['scientific', 'a × 10ⁿ — científica'],
                  ['exponential', '1e+n — exponencial'],
                  ['decimal', 'Decimal'],
                  ['general', 'Automática'],
                ],
                (a, v) => {
                  a.tickLabels.format = v as Axis['tickLabels']['format'];
                },
              )}
              <p className="field-hint">
                Escolha como exibir as potências nos números do eixo. O intervalo define o fator
                entre marcas principais (10, 100, 1000…).
              </p>
            </>
          )}
          {axis.tickLabels.format !== 'general' && (
            <div className="number-notation-settings">
              <FontSizeField
                page={scene.page.size}
                label={`Tamanho dos números ${name}`}
                value={axis.tickLabels.size}
                onChange={(size) =>
                  edit((a) => {
                    a.tickLabels.size = size;
                  })
                }
              />
              {number(
                'Casas / algarismos',
                axis.tickLabels.precision,
                (a, v) => {
                  a.tickLabels.precision = v;
                },
                0,
                15,
                '1',
              )}
            </div>
          )}
          <div className="field-pair">
            {[0, 2].map((offset) => (
              <NumberField
                key={offset}
                label={`${name} ${offset ? 'máximo' : 'mínimo'}`}
                value={graph.world[index + offset]}
                onChange={(v) =>
                  change((s) => {
                    s.graphs.find((g) => g.id === graph.id)!.world[index + offset] = v;
                  })
                }
              />
            ))}
          </div>
          {check('Inverter eixo', axis.inverted, (a, v) => {
            a.inverted = v;
          })}
          <div className="field-pair">
            {number(
              'Intervalo',
              axis.ticks.major,
              (a, v) => {
                a.ticks.major = v;
              },
              Number.MIN_VALUE,
            )}
            {number(
              'Subdivisões menores',
              axis.ticks.minorCount,
              (a, v) => {
                a.ticks.minorCount = v;
              },
              0,
              100,
              '1',
            )}
          </div>
          <div className="axis-checks">
            <label className="check-field">
              <input
                type="checkbox"
                aria-label={`Mostrar barra ${name}`}
                checked={axisBarVisible(graph, axisId)}
                onChange={(e) =>
                  change((s) =>
                    setAxisBar(
                      s.graphs.find((g) => g.id === graph.id)!,
                      axisId,
                      e.target.checked,
                    ),
                  )
                }
              />
              Mostrar barra
            </label>
            {check('Mostrar marcas', axis.ticks.enabled, (a, v) => {
              a.ticks.enabled = v;
            })}
            {check('Mostrar números', axis.tickLabels.enabled, (a, v) => {
              a.tickLabels.enabled = v;
            })}
          </div>
          <p className="field-hint">
            Ocultar a barra também desativa a moldura sobreposta. As barras do outro eixo, marcas e
            números têm controles independentes.
          </p>
        </div>
      </div>
      <div
        className="axis-tab-panel"
        role="tabpanel"
        id={`${axisId}-panel-label`}
        aria-labelledby={`${axisId}-tab-label`}
        hidden={tab !== 'label'}
      >
        <div>
          <label className="form-field">
            Rótulo {name}
            <input
              aria-label={`Rótulo ${name}`}
              value={axis.label.text}
              onChange={(e) =>
                edit((a) => {
                  a.label.text = e.target.value;
                })
              }
            />
          </label>
          {textFormat('label', 'nome do eixo')}
          {stroke('barra', axis.bar, (a) => a.bar)}
        </div>
      </div>
      <div
        className="axis-tab-panel"
        role="tabpanel"
        id={`${axisId}-panel-numbers`}
        aria-labelledby={`${axisId}-tab-numbers`}
        hidden={tab !== 'numbers'}
      >
        <div>
          {select(
            'Formato numérico',
            axis.tickLabels.format,
            [
              ['general', 'Geral'],
              ['decimal', 'Decimal'],
              ['exponential', 'Exponencial'],
              ['scientific', 'Científico'],
              ['power', 'Potência'],
            ],
            (a, v) => {
              a.tickLabels.format = v as Axis['tickLabels']['format'];
            },
          )}
          <div className="field-pair">
            {number(
              'Precisão',
              axis.tickLabels.precision,
              (a, v) => {
                a.tickLabels.precision = v;
              },
              0,
              15,
              '1',
            )}
            {number('Ângulo dos números', axis.tickLabels.angle, (a, v) => {
              a.tickLabels.angle = v;
            })}
          </div>
          {select('Lado dos números', axis.tickLabels.place, places, (a, v) => {
            a.tickLabels.place = v as Axis['tickLabels']['place'];
          })}
          {textFormat('tickLabels', 'números do eixo')}
          <div className="field-pair">
            {(['prepend', 'append'] as const).map((key, i) => (
              <label className="form-field" key={key}>
                {i ? 'Sufixo' : 'Prefixo'}
                <input
                  aria-label={`${i ? 'Sufixo' : 'Prefixo'} ${name}`}
                  value={axis.tickLabels[key]}
                  onChange={(e) =>
                    edit((a) => {
                      a.tickLabels[key] = e.target.value;
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="field-pair">
            {number(
              'Pular rótulos',
              axis.tickLabels.skip ?? 0,
              (a, v) => {
                a.tickLabels.skip = v;
              },
              0,
              undefined,
              '1',
            )}
            {number(
              'Alternar em níveis',
              axis.tickLabels.stagger ?? 0,
              (a, v) => {
                a.tickLabels.stagger = v;
              },
              0,
              undefined,
              '1',
            )}
          </div>
        </div>
      </div>
      <div
        className="axis-tab-panel"
        role="tabpanel"
        id={`${axisId}-panel-ticks`}
        aria-labelledby={`${axisId}-tab-ticks`}
        hidden={tab !== 'ticks'}
      >
        <div>
          {select(
            'Direção das marcas',
            axis.ticks.direction,
            [
              ['in', 'Para dentro'],
              ['out', 'Para fora'],
              ['both', 'Dentro e fora'],
            ],
            (a, v) => {
              a.ticks.direction = v as Axis['ticks']['direction'];
            },
          )}
          {select('Lado das marcas', axis.ticks.place, places, (a, v) => {
            a.ticks.place = v as Axis['ticks']['place'];
          })}
          {check('Arredondar posições', axis.ticks.rounded, (a, v) => {
            a.ticks.rounded = v;
          })}
          <h4>Marcas principais</h4>
          {number(
            'Comprimento principal',
            axis.ticks.majorSize,
            (a, v) => {
              a.ticks.majorSize = v;
            },
            0,
          )}
          {stroke('marcas principais', axis.ticks.majorStroke, (a) => a.ticks.majorStroke)}
          {check('Grade principal', axis.ticks.majorGrid, (a, v) => {
            a.ticks.majorGrid = v;
          })}
          <h4>Marcas menores</h4>
          {number(
            'Comprimento menor',
            axis.ticks.minorSize,
            (a, v) => {
              a.ticks.minorSize = v;
            },
            0,
          )}
          {stroke('marcas menores', axis.ticks.minorStroke, (a) => a.ticks.minorStroke)}
          {check('Grade secundária', axis.ticks.minorGrid, (a, v) => {
            a.ticks.minorGrid = v;
          })}
        </div>
      </div>
      <div
        className="axis-tab-panel"
        role="tabpanel"
        id={`${axisId}-panel-position`}
        aria-labelledby={`${axisId}-tab-position`}
        hidden={tab !== 'position'}
      >
        <div>
          {check('Passar pela origem', axis.zero ?? false, (a, v) => {
            a.zero = v;
          })}
          <p className="field-hint">
            Deslocamentos normal e oposto em coordenadas de página do Grace.
          </p>
          <div className="field-pair">
            {number('Deslocamento normal', axis.offset?.[0] ?? 0, (a, v) => {
              a.offset = [v, a.offset?.[1] ?? 0];
            })}
            {number('Deslocamento oposto', axis.offset?.[1] ?? 0, (a, v) => {
              a.offset = [a.offset?.[0] ?? 0, v];
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
