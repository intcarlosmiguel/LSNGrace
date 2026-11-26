import { WidthHandle } from '../../components/WidthHandle';
import { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { DataSet } from '../../core/scene/types';
import {
  worksheetFor,
  transformSeries,
  bindWorksheet,
  removeWorksheetColumn,
  setWorksheetRowHidden,
  showAllWorksheetRows,
} from '../../core/analysis/worksheet';
export function TransformPanel({
  set,
  onEdit,
  onClose,
}: {
  set: DataSet;
  onEdit: (fn: (set: DataSet) => void) => void;
  onClose: () => void;
}) {
  const sheet = worksheetFor(set);
  const helpId = useId();
  const [showHelp, setShowHelp] = useState(() => {
    try {
      return localStorage.getItem('lsngrace.transform-help') !== 'hidden';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('lsngrace.transform-help', showHelp ? 'visible' : 'hidden');
    } catch {
      /* Optional display preference. */
    }
  }, [showHelp]);
  const [widths, setWidths] = useState<{
    editor: number;
    table: number;
    columns: Record<string, number>;
  }>(() => {
    const defaults = { editor: 220, table: 340, columns: {} as Record<string, number> };
    try {
      const saved = JSON.parse(localStorage.getItem('lsngrace.transform-widths') ?? 'null');
      if (!saved) return defaults;
      const bounded = (value: unknown, min: number, max: number, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value)
          ? Math.round(Math.max(min, Math.min(max, value)))
          : fallback;
      return {
        editor: bounded(saved.editor, 180, 420, 220),
        table: bounded(saved.table, 260, 1000, 340),
        columns: Object.fromEntries(
          Object.entries(saved.columns ?? {})
            .filter(([id]) => /^(?:x0|y0|d[1-9]\d*|c[1-9]\d*)$/.test(id))
            .map(([id, value]) => [id, bounded(value, 80, 600, 90)]),
        ),
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('lsngrace.transform-widths', JSON.stringify(widths));
    } catch {
      /* Optional display preference. */
    }
  }, [widths]);
  const columnWidth = (id: string) => widths.columns[id] ?? 90;

  const [expression, setExpression] = useState('y = y - 20'),
    [axis, setAxis] = useState<'x' | 'y'>('y'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [showHidden, setShowHidden] = useState(true),
    [page, setPage] = useState(0);
  const hidden = useMemo(() => new Set(sheet.hiddenRows), [sheet.hiddenRows]);
  const indices = useMemo(
    () => sheet.baseRows.map((_, i) => i).filter((i) => showHidden || !hidden.has(i)),
    [sheet.baseRows, hidden, showHidden],
  );
  const pageCount = Math.max(1, Math.ceil(indices.length / 100)),
    currentPage = Math.min(page, pageCount - 1);
  useEffect(() => setPage(0), [showHidden]);
  const edit = (fn: (set: DataSet) => void) => {
    try {
      onEdit(fn);
      setError('');
      setNotice('');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const columns = [
    { id: 'x0', label: 'X original', values: undefined, expression: '' },
    { id: 'y0', label: 'Y original', values: undefined, expression: '' },
    ...Array.from({ length: Math.max(0, (sheet.baseRows[0]?.length ?? 2) - 2) }, (_, i) => ({
      id: `d${i + 1}`,
      label: `D${i + 1}`,
      values: undefined,
      expression: '',
    })),
    ...sheet.columns.map((c) => ({ ...c, label: c.id.toUpperCase() })),
  ];
  return (
    <section className="transform-workspace" aria-label="Transformações da série">
      <header>
        <div>
          <strong>Transformações · {set.legend || `S${set.id}`}</strong>
          <small>
            {sheet.baseRows.length.toLocaleString('pt-BR')} linhas preservadas ·{' '}
            {sheet.hiddenRows.length} ocultas · X: {sheet.x.toUpperCase()} · Y:{' '}
            {sheet.y.toUpperCase()}
          </small>
        </div>
        <div className="transform-header-actions">
          <button
            className={`button ${showHelp ? 'active' : ''}`}
            aria-label={`${showHelp ? 'Ocultar' : 'Mostrar'} Como transformar`}
            aria-expanded={showHelp}
            aria-controls={helpId}
            onClick={() => setShowHelp((value) => !value)}
          >
            <Icon name={showHelp ? 'eyeOff' : 'eye'} size={15} /> Como transformar
          </button>
          <button className="icon-button" aria-label="Fechar transformações" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>
      <div
        className="transform-layout"
        style={{
          gridTemplateColumns: showHelp
            ? `${widths.editor}px 8px ${widths.table}px 8px minmax(210px, 1fr)`
            : `${widths.editor}px 8px minmax(260px,1fr)`,
        }}
      >
        <div className="transform-controls">
          <h3>Nova transformação</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let id = '';
              if (
                edit((s) => {
                  id = transformSeries(s, expression, axis);
                })
              ) {
                setNotice(`Coluna ${id.toUpperCase()} criada e aplicada ao gráfico.`);
                setPage(0);
              }
            }}
          >
            <label>
              Expressão
              <textarea
                aria-label="Expressão de transformação"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                rows={4}
                spellCheck={false}
                required
                maxLength={4096}
              />
            </label>
            <label>
              Aplicar resultado em
              <select
                aria-label="Eixo da transformação"
                value={axis}
                onChange={(e) => setAxis(e.target.value as 'x' | 'y')}
              >
                <option value="y">Y</option>
                <option value="x">X</option>
              </select>
            </label>
            <small>Se escrever x = ou y =, a expressão determina o eixo.</small>
            <button className="button primary" type="submit" disabled={!sheet.baseRows.length}>
              Criar coluna e aplicar
            </button>
          </form>
          {error && (
            <p role="alert" className="regression-error">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <p>
            Os originais X0/Y0 são preservados. Você pode usar qualquer coluna em X ou Y pelos
            botões do cabeçalho.
          </p>
          <button
            className="button"
            onClick={() =>
              edit((s) => {
                bindWorksheet(s, 'x', 'x0');
                bindWorksheet(s, 'y', 'y0');
              })
            }
          >
            Usar X/Y originais
          </button>
        </div>
        <WidthHandle
          label="Largura do editor de transformações"
          value={widths.editor}
          min={180}
          max={420}
          initial={220}
          onChange={(editor) => setWidths((current) => ({ ...current, editor }))}
        />
        <div className="transform-table-panel">
          <div className="transform-table-tools">
            <strong>Tabela da série</strong>
            <label>
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              Mostrar linhas ocultas
            </label>
            <button
              className="text-button"
              disabled={!hidden.size}
              onClick={() => edit(showAllWorksheetRows)}
            >
              Mostrar todas
            </button>
          </div>
          <div className="transform-table-scroll">
            <table
              aria-label="Tabela de transformações"
              style={{ width: 84 + columns.reduce((sum, col) => sum + columnWidth(col.id), 0) }}
            >
              <colgroup>
                <col style={{ width: 42 }} />
                <col style={{ width: 42 }} />
                {columns.map((col) => (
                  <col key={col.id} style={{ width: columnWidth(col.id) }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Visível</th>
                  <th scope="col">Linha</th>
                  {columns.map((col) => (
                    <th key={col.id} scope="col">
                      <WidthHandle
                        column
                        label={`Largura da coluna ${col.id.toUpperCase()}`}
                        value={columnWidth(col.id)}
                        min={80}
                        max={600}
                        initial={90}
                        onChange={(value) =>
                          setWidths((current) => ({
                            ...current,
                            columns: { ...current.columns, [col.id]: value },
                          }))
                        }
                      />
                      <div className="transform-column-title">
                        <strong>{col.label}</strong>
                        {col.values && (
                          <button
                            className="icon-button"
                            aria-label={`Excluir coluna ${col.id.toUpperCase()}`}
                            title="Excluir coluna e restaurar o eixo original se estiver em uso"
                            onClick={() => edit((s) => removeWorksheetColumn(s, col.id))}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        )}
                      </div>
                      <code>{col.id}</code>
                      {col.expression && <small title={col.expression}>{col.expression}</small>}
                      {!col.id.startsWith('d') && (
                        <div className="transform-bindings">
                          <button
                            className={sheet.x === col.id ? 'active' : ''}
                            aria-label={`Usar ${col.id.toUpperCase()} em X`}
                            aria-pressed={sheet.x === col.id}
                            onClick={() => edit((s) => bindWorksheet(s, 'x', col.id))}
                          >
                            X
                          </button>
                          <button
                            className={sheet.y === col.id ? 'active' : ''}
                            aria-label={`Usar ${col.id.toUpperCase()} em Y`}
                            aria-pressed={sheet.y === col.id}
                            onClick={() => edit((s) => bindWorksheet(s, 'y', col.id))}
                          >
                            Y
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indices.slice(currentPage * 100, currentPage * 100 + 100).map((i) => (
                  <tr key={i} className={hidden.has(i) ? 'is-row-hidden' : ''}>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`${hidden.has(i) ? 'Mostrar' : 'Ocultar'} linha ${i + 1}`}
                        title="Ocultar preserva os valores da linha"
                        onClick={() => edit((s) => setWorksheetRowHidden(s, i, !hidden.has(i)))}
                      >
                        <Icon name={hidden.has(i) ? 'eyeOff' : 'eye'} size={16} />
                      </button>
                    </td>
                    <th scope="row">{i + 1}</th>
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        title={String(
                          col.values
                            ? col.values[i]
                            : sheet.baseRows[i][
                                col.id === 'x0'
                                  ? 0
                                  : col.id === 'y0'
                                    ? 1
                                    : Number(col.id.slice(1)) + 1
                              ],
                        )}
                      >
                        {String(
                          col.values
                            ? col.values[i]
                            : sheet.baseRows[i][
                                col.id === 'x0'
                                  ? 0
                                  : col.id === 'y0'
                                    ? 1
                                    : Number(col.id.slice(1)) + 1
                              ],
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!indices.length && (
              <p className="transform-empty">
                Nenhuma linha para exibir. Ative “Mostrar linhas ocultas” para recuperar as linhas.
              </p>
            )}
          </div>
          <footer>
            <button
              className="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <span>
              Página {currentPage + 1} de {pageCount} · até 100 linhas por página
            </span>
            <button
              className="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </button>
          </footer>
        </div>
        {showHelp && (
          <WidthHandle
            label="Largura da tabela de transformações"
            value={widths.table}
            min={260}
            max={1000}
            initial={340}
            onChange={(table) => setWidths((current) => ({ ...current, table }))}
          />
        )}

        <aside
          id={helpId}
          className="transform-help"
          aria-label="Como transformar dados"
          hidden={!showHelp}
        >
          <h3>Como transformar</h3>
          <p>
            Arraste as divisórias para ajustar a largura do editor e da tabela. Arraste a borda
            direita de cada cabeçalho para ajustar uma coluna; duplo clique restaura o tamanho
            inicial.
          </p>
          <p>
            <code>x</code> e <code>y</code> são os valores atualmente usados no gráfico.{' '}
            <code>x0</code> e <code>y0</code> são os originais. <code>c1</code>, <code>c2</code>…
            são as colunas criadas; <code>i</code> é o número da linha.
          </p>
          <dl>
            {[
              ['y = y - 20', 'Deslocar Y em −20'],
              ['x = x * 1e-3', 'Converter a escala de X'],
              ['y = log10(y)', 'Logaritmo decimal (Y > 0)'],
              ['y = (y - mean(y))/std(y)', 'Padronizar Y'],
              ['y = norm(y)', 'Normalizar por max(abs(Y))'],
              ['y = c1 * 2', 'Usar uma coluna anterior'],
              ['y = sin(x) + y0', 'Combinar função e originais'],
            ].map(([code, label]) => (
              <div key={code}>
                <button title="Usar exemplo" onClick={() => setExpression(code)}>
                  <code>{code}</code>
                </button>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          <p>
            Operadores: + − * / ^. Funções: sin, cos, exp, ln, log10, sqrt, abs e outras do editor
            de regressão. Agregados: mean/avg, sum, min, max, std/sd (amostral).
          </p>
          <p>
            Transformações calculam todas as linhas, inclusive ocultas. Os agregados também usam
            todas as linhas. Cada coluna guarda o resultado daquela etapa; excluir uma coluna não
            recalcula as seguintes.
          </p>
          <p>
            Ocultar uma linha exclui o ponto do gráfico, regressões e exportação de dados visíveis,
            sem apagar a linha. O projeto AGR e o rascunho preservam a tabela completa.
            Ctrl+Z/Ctrl+Y desfazem/refazem as alterações.
          </p>
        </aside>
      </div>
    </section>
  );
}
