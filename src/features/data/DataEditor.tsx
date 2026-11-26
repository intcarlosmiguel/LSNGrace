import { useMemo, useState } from 'react';
import { parseMixedTable, type Delimiter } from '../../core/import/tabular';
import { mapSeries, importColors, type SeriesInput } from '../../core/import/series';
import { ColorPicker } from '../../components/ColorPicker';
import { resolveColor, hexColor } from '../../core/style/colors';
import { palette as gracePalette } from '../../core/scene/defaults';
import type { DataSet, Scene } from '../../core/scene/types';
import { Icon } from '../../components/Icon';
const example =
  'Tempo (s)\tAmplitude\tErro\n0\t1.00\t0.05\n1\t0.78\t0.04\n2\t0.54\t0.04\n3\t0.39\t0.03\n4\t0.25\t0.02\n5\t0.18\t0.02';
const categoryExample =
  'Tempo (s),Resposta,Erro,Grupo,Cor\n0,1,0.1,Controle,#377EB8\n0,1.2,0.1,Tratamento,#E41A1C\n1,1.5,0.12,Controle,#377EB8\n1,2.1,0.15,Tratamento,#E41A1C\n2,1.8,0.13,Controle,#377EB8\n2,3.2,0.2,Tratamento,#E41A1C';
export function DataEditor({
  scene,
  colorOffset = 0,
  initialText = '',
  initialName = '',
  existing,
  onApply,
  onClose,
  onFile,
}: {
  scene: Scene;
  colorOffset?: number;
  initialText?: string;
  initialName?: string;
  existing?: DataSet;
  onApply: (series: SeriesInput[]) => boolean;
  onClose: () => void;
  onFile: () => void;
}) {
  const [text, setText] = useState(
    initialText || existing?.rows.map((row) => row.join('\t')).join('\n') || '',
  );
  const [name, setName] = useState(existing?.legend || initialName || 'Série 1');
  const [delimiter, setDelimiter] = useState<Delimiter>('auto');
  const [x, setX] = useState(0),
    [y, setY] = useState(1),
    [dy, setDy] = useState<number | null>(existing?.type === 'xydy' ? 2 : null),
    [error, setError] = useState('');
  const [category, setCategory] = useState<number | null>(null),
    [colorColumn, setColorColumn] = useState<number | null>(null);
  const [lineEnabled, setLineEnabled] = useState(
    existing ? existing.line.style !== 0 && existing.line.connection !== 0 : true,
  );
  const [lineStyle, setLineStyle] = useState<DataSet['line']['style']>(existing?.line.style || 1);
  const [symbolEnabled, setSymbolEnabled] = useState(existing ? existing.symbol.type !== 0 : true);
  const [symbolStyle, setSymbolStyle] = useState<DataSet['symbol']['type']>(
    existing?.symbol.type || 1,
  );
  const [color, setColor] = useState<number | string | null>(existing?.line.color ?? null);
  const palette = useMemo(() => {
    const copy = { ...scene, colors: [...scene.colors] };
    const id = resolveColor(copy, color ?? importColors[colorOffset % importColors.length]);
    return { scene: copy, id };
  }, [scene, color, colorOffset]);
  const parsed = useMemo(() => {
    if (!text.trim()) return { table: null, error: '' };
    try {
      return { table: parseMixedTable(text, delimiter), error: '' };
    } catch (e) {
      return { table: null, error: (e as Error).message };
    }
  }, [text, delimiter]);
  const table = parsed.table;
  const mapping = useMemo(() => {
    if (!table) return { series: null, error: '' };
    try {
      return {
        series: mapSeries(table, { x, y, dy, category, color: colorColumn }, name, {
          line: lineEnabled ? lineStyle : 0,
          symbol: symbolEnabled ? symbolStyle : 0,
          color,
        }),
        error: '',
      };
    } catch (e) {
      return { series: null, error: (e as Error).message };
    }
  }, [
    table,
    x,
    y,
    dy,
    category,
    colorColumn,
    name,
    lineEnabled,
    lineStyle,
    symbolEnabled,
    symbolStyle,
    color,
  ]);
  const apply = () => {
    if (!mapping.series) return;
    if (onApply(mapping.series)) onClose();
  };
  return (
    <section className="data-editor" aria-label="Editor de dados">
      <header className="editor-heading">
        <div>
          <span className="eyebrow">{existing ? 'EDITAR SÉRIE' : 'ADICIONAR DADOS'}</span>
          <h2>{existing ? 'Atualize os dados da curva' : 'Crie o seu gráfico'}</h2>
          {existing?.worksheet && (
            <p>
              Atualizar aqui substitui os dados visíveis e remove a tabela de transformações,
              incluindo linhas ocultas. Para preservá-la, use Transformações no menu da série.
              Ctrl+Z recupera a substituição.
            </p>
          )}
          <p>Cole uma tabela do Excel, digite os valores ou importe um arquivo.</p>
        </div>
        <button className="icon-button" aria-label="Fechar editor de dados" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="editor-columns">
        <div className="data-input">
          <div className="input-tools">
            <label htmlFor="data-text">Tabela de dados</label>
            <div>
              <button
                className="text-button"
                onClick={() => {
                  setText(example);
                  setName('Medição');
                  setX(0);
                  setY(1);
                  setDy(2);
                  setDelimiter('auto');
                  setCategory(null);
                  setColorColumn(null);
                  setError('');
                }}
              >
                Usar exemplo
              </button>
              <button className="button small" onClick={onFile}>
                <Icon name="upload" size={15} />
                Importar arquivo
              </button>
            </div>
          </div>
          <textarea
            id="data-text"
            aria-label="Tabela de dados"
            spellCheck={false}
            placeholder={'X\tY\n0\t1.2\n1\t2.4\n2\t3.1'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
          />
          <div className="table-help">
            <span>CSV, TSV, DAT ou TXT · AGR/PAR abre o projeto completo</span>
            <label>
              Separador{' '}
              <select
                aria-label="Separador"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as Delimiter)}
              >
                <option value="auto">Automático</option>
                <option value=",">Vírgula</option>
                <option value=";">Ponto e vírgula</option>
                <option value={'\t'}>Tabulação</option>
                <option value="whitespace">Espaços</option>
              </select>
            </label>
          </div>
          <details className="import-style axis-group" open>
            <summary>Aparência das curvas</summary>
            <div>
              <label className="check-field">
                <input
                  type="checkbox"
                  aria-label="Desenhar linha"
                  checked={lineEnabled}
                  onChange={(e) => setLineEnabled(e.target.checked)}
                />
                Desenhar linha
              </label>
              {lineEnabled && (
                <label className="form-field">
                  Estilo da linha
                  <select
                    aria-label="Estilo da linha na importação"
                    value={lineStyle}
                    onChange={(e) => setLineStyle(+e.target.value as DataSet['line']['style'])}
                  >
                    {['Contínua', 'Pontilhada', 'Tracejada', 'Traços longos', 'Traço e ponto'].map(
                      (v, i) => (
                        <option key={i} value={i + 1}>
                          {v}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label className="check-field">
                <input
                  type="checkbox"
                  aria-label="Desenhar símbolos"
                  checked={symbolEnabled}
                  onChange={(e) => setSymbolEnabled(e.target.checked)}
                />
                Desenhar símbolos
              </label>
              {symbolEnabled && (
                <label className="form-field">
                  Tipo de símbolo
                  <select
                    aria-label="Tipo de símbolo na importação"
                    value={symbolStyle}
                    onChange={(e) => setSymbolStyle(+e.target.value as DataSet['symbol']['type'])}
                  >
                    {[
                      'Círculo',
                      'Quadrado',
                      'Losango',
                      'Triângulo para cima',
                      'Triângulo para esquerda',
                      'Triângulo para baixo',
                      'Triângulo para direita',
                      'Mais (+)',
                      'X',
                      'Estrela',
                      'Caractere A',
                    ].map((v, i) => (
                      <option key={i} value={i + 1}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {colorColumn === null ? (
                <>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      aria-label="Cores automáticas por série"
                      checked={color === null}
                      onChange={(e) => setColor(e.target.checked ? null : palette.id)}
                    />
                    Cores automáticas por série
                  </label>
                  {color !== null && (
                    <ColorPicker
                      label="Cor das curvas"
                      scene={palette.scene}
                      value={palette.id}
                      onChange={setColor}
                    />
                  )}
                </>
              ) : (
                <p className="field-hint">As cores serão lidas da coluna selecionada.</p>
              )}
              {!lineEnabled && !symbolEnabled && (
                <p className="field-hint">
                  Linha e símbolos desligados: os pontos não serão desenhados; barras de erro, se
                  configuradas, continuam visíveis.
                </p>
              )}
            </div>
          </details>
        </div>
        <div className="data-mapping">
          <label className="form-field">
            {category === null ? 'Nome da série' : 'Nome da importação'}
            <input
              aria-label="Nome da série"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
            />
          </label>
          <div className="mapping-grid">
            {[
              { label: 'Coluna X', value: x, set: setX, optional: false },
              { label: 'Coluna Y', value: y, set: setY, optional: false },
              {
                label: 'Erro em Y (±)',
                value: dy ?? -1,
                set: (v: number) => setDy(v === -1 ? null : v),
                optional: true,
              },
            ].map((field) => (
              <label className="form-field" key={field.label}>
                {field.label}
                <select
                  aria-label={field.label}
                  value={field.value}
                  disabled={!table}
                  onChange={(e) => field.set(Number(e.target.value))}
                >
                  {field.optional && <option value={-1}>Sem barras de erro</option>}
                  {(table?.headers ?? ['Coluna 1', 'Coluna 2']).map((h, i) => (
                    <option key={i} value={i}>
                      {i + 1} · {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {!existing && (
            <div className="mapping-grid">
              <label className="form-field">
                Legenda por categoria
                <select
                  aria-label="Coluna de categorias da legenda"
                  value={category ?? -1}
                  disabled={!table}
                  onChange={(e) => {
                    const v = +e.target.value;
                    setCategory(v < 0 ? null : v);
                    if (v < 0) setColorColumn(null);
                  }}
                >
                  <option value={-1}>Uma única série</option>
                  {table?.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {i + 1} · {h}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Cor por categoria
                <select
                  aria-label="Coluna de cores das categorias"
                  value={colorColumn ?? -1}
                  disabled={!table || category === null}
                  onChange={(e) => setColorColumn(+e.target.value < 0 ? null : +e.target.value)}
                >
                  <option value={-1}>Usar estilo abaixo</option>
                  {table?.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {i + 1} · {h}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-hint">
                Cada categoria cria uma curva independente no mesmo gráfico e uma entrada na
                legenda. A coluna de cor aceita #RRGGBB, #RGB, nomes ou índices Grace (0–15); use
                uma cor por categoria.
              </p>
              <button
                className="text-button"
                onClick={() => {
                  setText(categoryExample);
                  setName('Comparação por grupo');
                  setDelimiter('auto');
                  setX(0);
                  setY(1);
                  setDy(2);
                  setCategory(3);
                  setColorColumn(4);
                  setError('');
                }}
              >
                Usar exemplo com categorias
              </button>
            </div>
          )}
          <div className="preview-heading">
            Prévia{' '}
            <span>
              {table
                ? `${table.rows.length.toLocaleString('pt-BR')} pontos · ${mapping.series?.length ?? 0} séries · ${dy === null ? 'XY' : 'XYDY'}`
                : 'Aguardando dados'}
            </span>
          </div>
          {category !== null && mapping.series && (
            <div className="category-preview" aria-label="Categorias a importar">
              {mapping.series.slice(0, 12).map((s, i) => {
                const value =
                  s.style.color ?? importColors[(i + colorOffset) % importColors.length];
                const color =
                  typeof value === 'string'
                    ? value
                    : scene.colors.find((c) => c.id === value)
                      ? hexColor(scene.colors.find((c) => c.id === value)!.rgb)
                      : '#' + gracePalette[value];
                return (
                  <span key={s.name}>
                    <i style={{ backgroundColor: color }} />
                    {s.name} · {s.rows.length} pontos
                  </span>
                );
              })}
              {mapping.series.length > 12 && <span>+ {mapping.series.length - 12} categorias</span>}
            </div>
          )}
          {table && mapping.series ? (
            <div className="table-preview">
              <table>
                <thead>
                  <tr>
                    {category !== null && <th>Categoria</th>}
                    <th>X</th>
                    <th>Y</th>
                    {dy !== null && <th>± Y</th>}
                  </tr>
                </thead>
                <tbody>
                  {mapping.series
                    .flatMap((s) => s.rows.slice(0, 6).map((row) => ({ row, name: s.name })))
                    .slice(0, 6)
                    .map(({ row, name }, i) => (
                      <tr key={i}>
                        {category !== null && <td>{name}</td>}
                        {row.map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="preview-placeholder">
              <Icon name="data" size={28} />
              <p>As primeiras linhas aparecem aqui.</p>
            </div>
          )}
        </div>
      </div>
      {(parsed.error || mapping.error || error) && (
        <p className="inline-error" role="alert">
          {parsed.error || mapping.error || error}
        </p>
      )}
      <footer className="editor-footer">
        <span>
          {existing
            ? 'Os dados e a aparência selecionada serão aplicados à série.'
            : 'Os eixos serão ajustados aos seus dados automaticamente.'}
        </span>
        <div>
          <button className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={!mapping.series} onClick={apply}>
            <Icon name="check" size={17} />
            {existing
              ? 'Atualizar série'
              : mapping.series && mapping.series.length > 1
                ? `Criar ${mapping.series.length} curvas`
                : 'Criar curva'}
          </button>
        </div>
      </footer>
    </section>
  );
}
