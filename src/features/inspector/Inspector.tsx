import { GridProperties } from './GraphAppearance';
import { LegendProperties } from './LegendProperties';
import { AxisProperties } from './AxisProperties';
import { TextFormat, type TextUpdate } from '../../components/TextFormat';
import { setGraphBorder } from '../../core/geometry/graphSettings';
import { ColorPicker } from '../../components/ColorPicker';
import { resolveColor } from '../../core/style/colors';
import { useEffect, useState, type ReactNode } from 'react';
import type { InspectTarget } from '../canvas/PlotCanvas';
import type { Graph, Scene, DataSet } from '../../core/scene/types';
import { NumberField } from '../../components/Fields';
import { FontSizeField } from '../../components/SizeFields';
import { Icon } from '../../components/Icon';
type Props = {
  graphControls?: ReactNode;
  scene: Scene;
  graph: Graph | undefined;
  selectedSet: DataSet | undefined;
  change: (fn: (scene: Scene) => void) => boolean;
  onSelectGraph: () => void;
  onSelectImage?: () => void;
  onEditData: () => void;
  onRegression?: (x: number, y: number) => void;
  onDelete: () => void;
  focusTarget?: { kind: InspectTarget; key: number };
};
export function Inspector({
  scene,
  graph,
  selectedSet,
  change,
  onSelectGraph,
  onSelectImage,
  onEditData,
  onRegression,
  onDelete,
  focusTarget,
  graphControls,
}: Props) {
  const [view, setView] = useState('graph');
  useEffect(() => {
    setView(
      focusTarget?.kind === 'xlabel'
        ? 'xaxis'
        : focusTarget?.kind === 'ylabel'
          ? 'yaxis'
          : focusTarget?.kind === 'subtitle'
            ? 'title'
            : (focusTarget?.kind ?? 'graph'),
    );
  }, [focusTarget, graph?.id]);
  useEffect(() => {
    if (!focusTarget) return;
    const labels = {
      xaxis: 'Escala X',
      yaxis: 'Escala Y',
      xlabel: 'Rótulo X',
      ylabel: 'Rótulo Y',
      subtitle: 'Subtítulo',
      graph: 'Mostrar borda do gráfico',
      title: 'Título',
      legend: 'Posição da legenda',
    };
    const targetView =
      focusTarget.kind === 'xlabel'
        ? 'xaxis'
        : focusTarget.kind === 'ylabel'
          ? 'yaxis'
          : focusTarget.kind === 'subtitle'
            ? 'title'
            : focusTarget.kind;
    if (view !== targetView) return;
    const element = document.querySelector<HTMLElement>(
      `.inspector [aria-label="${labels[focusTarget.kind]}"]`,
    );
    element?.scrollIntoView({ block: 'nearest' });
    element?.focus();
  }, [focusTarget, view]);
  useEffect(() => {
    if (selectedSet) {
      const input = document.querySelector<HTMLInputElement>(
        '.inspector [aria-label="Nome na legenda"]',
      );
      input?.scrollIntoView({ block: 'nearest' });
      input?.focus();
    }
  }, [selectedSet?.id, graph?.id]);
  if (!graph)
    return (
      <aside className="inspector">
        <p>Selecione um gráfico.</p>
      </aside>
    );
  const contextual = view !== 'graph';
  const kind = view;
  const edit = (fn: (g: Graph) => void) =>
    change((s) => fn(s.graphs.find((g) => g.id === graph.id)!));
  const editSet = (fn: (s: DataSet) => void) =>
    edit((g) => fn(g.sets.find((s) => s.id === selectedSet!.id)!));
  const editText = (
    kind: 'title' | 'subtitle' | 'xlabel' | 'ylabel' | 'legend',
    update: TextUpdate,
  ) =>
    change((scene) => {
      const g = scene.graphs.find((g) => g.id === graph.id)!;
      const target =
        kind === 'xlabel' ? g.axes.xaxis.label : kind === 'ylabel' ? g.axes.yaxis.label : g[kind];
      const { color, ...rest } = update;
      Object.assign(target, rest);
      if (color !== undefined) target.color = resolveColor(scene, color);
    });
  return (
    <aside className="inspector">
      <div className="panel-title">
        <span>PROPRIEDADES</span>
        <Icon name={selectedSet ? 'chart' : 'edit'} size={15} />
      </div>
      {!selectedSet && (
        <div
          className="property-tabs inspector-navigation"
          role="tablist"
          aria-label="Propriedades do gráfico"
        >
          {[
            ['graph', 'Gráfico'],
            ['title', 'Título e subtítulo'],
            ['xaxis', 'Eixo X'],
            ['yaxis', 'Eixo Y'],
            ['legend', 'Legenda'],
            ['grid', 'Grade'],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              id={`inspector-tab-${id}`}
              aria-controls={`inspector-panel-${id}`}
              aria-selected={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!selectedSet && view === 'graph' && graphControls}
      {selectedSet && (
        <button className="text-button" onClick={onSelectGraph}>
          Voltar às propriedades do gráfico
        </button>
      )}
      {selectedSet ? (
        <>
          <section className="property-section">
            <h3>Dados da série</h3>
            <label className="form-field">
              Nome na legenda
              <input
                aria-label="Nome na legenda"
                value={selectedSet.legend}
                onChange={(e) =>
                  editSet((s) => {
                    s.legend = e.target.value;
                  })
                }
              />
            </label>
            <div className="series-info">
              <span className="type-badge">{selectedSet.type.toUpperCase()}</span>
              <span>{selectedSet.rows.length.toLocaleString('pt-BR')} pontos</span>
            </div>
            <button className="button full" onClick={onEditData}>
              <Icon name="data" size={16} />
              Editar dados
            </button>
            {onRegression && (
              <button
                className="button full"
                title="Ctrl+clique na série também abre a regressão"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onRegression(rect.left, rect.top);
                }}
              >
                Regressão…
              </button>
            )}
          </section>
          <section className="property-section">
            <h3>Aparência</h3>
            <ColorPicker
              label="Cor da série"
              scene={scene}
              value={
                selectedSet.line.connection === 0
                  ? selectedSet.symbol.color
                  : selectedSet.line.color
              }
              onChange={(value) =>
                change((scene) => {
                  const color = resolveColor(scene, value),
                    set = scene.graphs
                      .find((g) => g.id === graph.id)!
                      .sets.find((s) => s.id === selectedSet.id)!;
                  set.line.color = color;
                  set.symbol.color = color;
                  set.errorBars.color = color;
                })
              }
            />
            <NumberField
              label="Alpha da série"
              value={selectedSet.opacity ?? 1}
              min={0}
              max={1}
              step="0.05"
              onChange={(v) =>
                editSet((s) => {
                  s.opacity = v;
                })
              }
            />
            <label className="check-field">
              <input
                type="checkbox"
                checked={!!selectedSet.symbol.fill.pattern}
                onChange={(e) =>
                  editSet((s) => {
                    s.symbol.fill.pattern = e.target.checked ? 1 : 0;
                  })
                }
              />
              Preencher símbolos
            </label>
            {!!selectedSet.symbol.fill.pattern && (
              <>
                <ColorPicker
                  label="Cor interna dos símbolos"
                  scene={scene}
                  value={selectedSet.symbol.fill.color}
                  onChange={(value) =>
                    change((scene) => {
                      const color = resolveColor(scene, value),
                        set = scene.graphs
                          .find((g) => g.id === graph.id)!
                          .sets.find((s) => s.id === selectedSet.id)!;
                      set.symbol.fill.color = color;
                    })
                  }
                />
                <NumberField
                  label="Alpha do preenchimento"
                  value={selectedSet.symbol.fill.opacity ?? 1}
                  min={0}
                  max={1}
                  step="0.05"
                  onChange={(v) =>
                    editSet((s) => {
                      s.symbol.fill.opacity = v;
                    })
                  }
                />
              </>
            )}
            <p className="field-hint">Alpha: 0 é transparente; 1 é opaco.</p>
            <label className="form-field">
              Conectar pontos
              <select
                aria-label="Conectar pontos"
                value={selectedSet.line.connection}
                onChange={(e) =>
                  editSet((s) => {
                    s.line.connection = +e.target.value as 0 | 1 | 2 | 3 | 4 | 5;
                  })
                }
              >
                <option value="1">Com linha</option>
                <option value="0">Somente pontos</option>
                <option value="2">Degraus à esquerda</option>
                <option value="3">Degraus à direita</option>
                <option value="4">Segmentos</option>
                <option value="5">Spline de 3 pontos</option>
              </select>
            </label>
            <NumberField
              label="Espessura da linha"
              value={selectedSet.line.width}
              min={0.25}
              max={10}
              step="0.25"
              onChange={(v) =>
                editSet((s) => {
                  s.line.width = v;
                })
              }
            />
            <label className="form-field">
              Traçado
              <select
                aria-label="Traçado"
                value={selectedSet.line.style}
                onChange={(e) =>
                  editSet((s) => {
                    s.line.style = +e.target.value as 0 | 1 | 2 | 3 | 4 | 5;
                  })
                }
              >
                {[
                  'Nenhum',
                  'Contínuo',
                  'Pontilhado',
                  'Tracejado',
                  'Traços longos',
                  'Traço-ponto',
                ].map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Símbolo
              <select
                aria-label="Símbolo"
                value={selectedSet.symbol.type}
                onChange={(e) =>
                  editSet((s) => {
                    s.symbol.type = +e.target.value as DataSet['symbol']['type'];
                  })
                }
              >
                {[
                  'Nenhum',
                  'Círculo',
                  'Quadrado',
                  'Losango',
                  'Triângulo acima',
                  'Triângulo à esquerda',
                  'Triângulo abaixo',
                  'Triângulo à direita',
                  'Mais (+)',
                  'X',
                  'Estrela',
                  'Caractere',
                ].map((name, index) => (
                  <option key={index} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {selectedSet.symbol.type === 11 && (
              <label className="form-field">
                Caractere
                <input
                  aria-label="Caractere do símbolo"
                  maxLength={1}
                  value={String.fromCharCode(selectedSet.symbol.character)}
                  onChange={(e) => {
                    if (e.target.value)
                      editSet((s) => {
                        const char = e.target.value.charCodeAt(0);
                        if (char > 255)
                          throw Error(
                            'Use um caractere Latin-1 e escolha a fonte Symbol para letras gregas.',
                          );
                        s.symbol.character = char;
                      });
                  }}
                />
              </label>
            )}
            <NumberField
              label="Tamanho do símbolo"
              value={selectedSet.symbol.size}
              min={0.1}
              max={5}
              step="0.1"
              onChange={(v) =>
                editSet((s) => {
                  s.symbol.size = v;
                })
              }
            />
            {selectedSet.type === 'xydy' && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={selectedSet.errorBars.enabled}
                  onChange={(e) =>
                    editSet((s) => {
                      s.errorBars.enabled = e.target.checked;
                    })
                  }
                />
                Mostrar barras de erro
              </label>
            )}
          </section>
          <section className="property-section">
            <button className="button danger full" onClick={onDelete}>
              <Icon name="trash" size={16} />
              Remover série
            </button>
            <p className="field-help">Você pode recuperar com Desfazer.</p>
          </section>
        </>
      ) : (
        <>
          <section
            className="property-section"
            role="tabpanel"
            id="inspector-panel-graph"
            aria-labelledby="inspector-tab-graph"
            hidden={contextual}
          >
            <h3>Área do gráfico</h3>
            <label className="check-field">
              <input
                type="checkbox"
                aria-label="Mostrar borda do gráfico"
                checked={graph.frame.style !== 0 && graph.frame.pattern !== 0}
                onChange={(e) =>
                  edit((g) => {
                    setGraphBorder(g, e.target.checked);
                    if (e.target.checked) g.frame.pattern = 1;
                  })
                }
              />
              Mostrar borda
            </label>
            <NumberField
              label="Espessura da borda"
              value={graph.frame.width}
              min={0.25}
              max={10}
              step="0.25"
              onChange={(v) =>
                edit((g) => {
                  g.frame.width = v;
                })
              }
            />
          </section>
          <section
            className="property-section"
            role="tabpanel"
            id="inspector-panel-title"
            aria-labelledby="inspector-tab-title"
            hidden={kind !== 'title' && kind !== 'subtitle'}
          >
            <h3>Texto da figura</h3>
            <label className="form-field">
              Título
              <input
                aria-label="Título"
                placeholder={'Ex.: Medição $\\alpha_0^2$'}
                value={graph.title.text}
                onChange={(e) =>
                  edit((g) => {
                    g.title.text = e.target.value;
                  })
                }
              />
            </label>
            <label className="form-field">
              Subtítulo
              <input
                aria-label="Subtítulo"
                placeholder="Opcional"
                value={graph.subtitle.text}
                onChange={(e) =>
                  edit((g) => {
                    g.subtitle.text = e.target.value;
                  })
                }
              />
            </label>
            <FontSizeField
              page={scene.page.size}
              label="Tamanho do título"
              value={graph.title.size}
              onChange={(v) =>
                edit((g) => {
                  g.title.size = v;
                })
              }
            />
          </section>
          {kind === 'title' && (
            <section className="property-section">
              <TextFormat
                label="título"
                scene={scene}
                value={graph.title}
                withSize={false}
                onChange={(u) => editText('title', u)}
              />
            </section>
          )}
          {(kind === 'title' || kind === 'subtitle') && (
            <section className="property-section">
              <TextFormat
                label="subtítulo"
                scene={scene}
                value={graph.subtitle}
                onChange={(u) => editText('subtitle', u)}
              />
            </section>
          )}
          {view === 'grid' && (
            <div role="tabpanel" id="inspector-panel-grid" aria-labelledby="inspector-tab-grid">
              <GridProperties scene={scene} graph={graph} change={change} />
            </div>
          )}
          {(['xaxis', 'yaxis'] as const).map((axis, i) => (
            <div
              key={`${graph.id}:${axis}`}
              role="tabpanel"
              id={`inspector-panel-${axis}`}
              aria-labelledby={`inspector-tab-${axis}`}
              hidden={kind !== axis && kind !== (i ? 'ylabel' : 'xlabel')}
            >
              <AxisProperties
                scene={scene}
                graph={graph}
                axisId={axis}
                change={change}
                focusLabel={kind === (i ? 'ylabel' : 'xlabel')}
              />
            </div>
          ))}
          <div
            role="tabpanel"
            id="inspector-panel-legend"
            aria-labelledby="inspector-tab-legend"
            hidden={kind !== 'legend'}
          >
            <LegendProperties scene={scene} graph={graph} change={change} />
          </div>
        </>
      )}
      <section className="property-section page-info" hidden={contextual && !selectedSet}>
        <h3>Imagem</h3>
        {onSelectImage && (
          <button className="text-button" onClick={onSelectImage}>
            Configurar imagem
          </button>
        )}
        <small>{scene.page.size.join(' × ')} pt · SVG vetorial</small>
      </section>
    </aside>
  );
}
