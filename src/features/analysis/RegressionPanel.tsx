import { compileExpression } from '../../core/analysis/expression';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import { regressionMethods } from '../../core/analysis/regression';
import type {
  RegressionMethod,
  RegressionOptions,
  RegressionReport,
} from '../../core/analysis/types';
import type { DataSet } from '../../core/scene/types';
const number = (n: number | null) =>
  n === null ? 'Indefinido' : n.toLocaleString('pt-BR', { maximumSignificantDigits: 8 });
export function RegressionPanel({
  source,
  report,
  x,
  y,
  onFit,
  onClose,
  onDelete,
  onMove,
}: {
  source?: DataSet;
  report?: RegressionReport;
  x: number;
  y: number;
  onFit: (options: RegressionOptions) => void;
  onClose: () => void;
  onDelete?: () => void;
  onMove?: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState<RegressionMethod>('linear');
  const [error, setError] = useState('');
  const [formula, setFormula] = useState('y = a0 * exp(-x / a1) + a2');
  const customExpression = useMemo(() => {
    try {
      return { compiled: compileExpression(formula), error: '' };
    } catch (e) {
      return { compiled: undefined, error: (e as Error).message };
    }
  }, [formula]);

  const [position, setPosition] = useState(() => ({ x, y }));
  const [moving, setMoving] = useState(false);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const latestPosition = useRef(position);
  const clampPosition = (x: number, y: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - (bounds?.width ?? 380) - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - (bounds?.height ?? 0) - 8)),
    };
  };
  const moveTo = (x: number, y: number) => {
    const next = clampPosition(x, y);
    latestPosition.current = next;
    setPosition(next);
    return next;
  };
  const finishMove = () => {
    if (!drag.current) return;
    drag.current = null;
    setMoving(false);
    onMove?.(latestPosition.current.x, latestPosition.current.y);
  };
  useLayoutEffect(() => {
    const resize = () => moveTo(latestPosition.current.x, latestPosition.current.y);
    resize();
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    if (ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('select, button')?.focus();
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key, true);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  const nonlinear = method === 'gaussian' || method === 'lorentzian';
  return createPortal(
    <div
      ref={ref}
      className={`regression-panel ${moving ? 'is-moving' : ''}`}
      role="dialog"
      aria-label={report ? 'Informações da regressão' : 'Regressão da série'}
      style={{
        left: position.x,
        top: position.y,
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <header
        className="regression-drag-handle"
        tabIndex={0}
        aria-label="Mover quadro de regressão"
        title="Arraste para mover o quadro. Use as setas pelo teclado."
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest('button')) return;
          event.preventDefault();
          event.currentTarget.focus();
          const bounds = ref.current!.getBoundingClientRect();
          drag.current = {
            pointerId: event.pointerId,
            dx: event.clientX - bounds.left,
            dy: event.clientY - bounds.top,
          };
          latestPosition.current = { x: bounds.left, y: bounds.top };
          event.currentTarget.setPointerCapture(event.pointerId);
          setMoving(true);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId === event.pointerId)
            moveTo(event.clientX - drag.current.dx, event.clientY - drag.current.dy);
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          moveTo(event.clientX - drag.current.dx, event.clientY - drag.current.dy);
          finishMove();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={finishMove}
        onLostPointerCapture={finishMove}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          const step = event.shiftKey ? 40 : 10;
          const next = moveTo(
            position.x +
              (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
            position.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
          );
          onMove?.(next.x, next.y);
        }}
      >
        <div>
          <strong>{report ? 'Informações da regressão' : 'Regressão'}</strong>
          <small>
            {report ? report.sourceLabel : source?.legend || `S${source?.id}`} · mínimos quadrados
          </small>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar regressão">
          <Icon name="close" size={16} />
        </button>
      </header>
      {report ? (
        <>
          {report.method === 'custom' ? (
            <FormulaPreview formula={report.equation} />
          ) : (
            <p className="regression-equation">{report.equation}</p>
          )}
          {report.custom && (
            <p>
              {report.iterations} iterações · tolerância {report.custom.tolerance ?? 1e-8}
              <br />
              Expressão interpretada: <code>{report.custom.normalizedExpression}</code>
            </p>
          )}
          <p>
            {regressionMethods[report.method]} · {report.algorithm}
          </p>
          <table>
            <thead>
              <tr>
                <th>Parâmetro</th>
                <th>Estimativa</th>
                <th>Erro padrão</th>
                {report.custom && <th>Restrição</th>}
              </tr>
            </thead>
            <tbody>
              {report.parameters.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{number(p.value)}</td>
                  <td>
                    {p.standardError === null && report.custom ? '—' : number(p.standardError)}
                  </td>
                  {report.custom && (
                    <td>
                      {report.custom.parameters[p.name]?.fixed
                        ? 'Fixo'
                        : `${report.custom.parameters[p.name]?.min ?? '−∞'} a ${report.custom.parameters[p.name]?.max ?? '∞'}`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="regression-stats">
            {Object.entries({
              Pontos: report.count,
              'Graus de liberdade': report.degreesOfFreedom,
              'R² (Y original)': report.rSquared,
              'R² ajustado (Y original)': report.adjustedRSquared,
              'SSE (Y original)': report.sse,
              'RMSE (Y original)': report.rmse,
              'Erro padrão residual (Y)': report.residualStandardError,
              [`SSE objetivo (${report.objectiveScale})`]: report.objectiveSse,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{number(value)}</dd>
              </div>
            ))}
          </dl>
          <p>
            Origem S{report.sourceSetId} · curva S{report.curveSetId}
            {report.residualSetId !== undefined ? ` · resíduos S${report.residualSetId}` : ''}
            <br />
            Intervalo ajustado: {report.fitRange.map(number).join(' a ')}
          </p>
          <p>
            Resultado salvo no momento do ajuste. Alterar a origem ou a curva não recalcula estas
            informações. Erros padrão: aproximação local, na escala do objetivo.
          </p>
          {report.warnings.map((w, i) => (
            <p key={i} className="regression-note">
              {w}
            </p>
          ))}
          {onDelete && (
            <button className="button" onClick={onDelete}>
              Excluir informações
            </button>
          )}
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            const data = new FormData(event.currentTarget);
            const optional = (key: string) =>
              String(data.get(key) ?? '').trim() ? Number(data.get(key)) : undefined;
            try {
              onFit({
                method,
                custom:
                  method === 'custom'
                    ? {
                        formula,
                        tolerance: optional('tolerance'),
                        maxIterations: optional('maxIterations'),
                        parameters: Object.fromEntries(
                          (customExpression.compiled?.parameters ?? []).map((name) => [
                            name,
                            {
                              initial: Number(data.get(`initial:${name}`)),
                              min: optional(`min:${name}`),
                              max: optional(`max:${name}`),
                              fixed: data.get(`fixed:${name}`) === 'on',
                            },
                          ]),
                        ),
                      }
                    : undefined,
                degree: optional('degree'),
                fitMin: optional('fitMin'),
                fitMax: optional('fitMax'),
                sampling: data.get('sampling') as 'source' | 'uniform',
                curveMin: optional('curveMin'),
                curveMax: optional('curveMax'),
                samples: optional('samples'),
                residuals: data.get('residuals') === 'on',
                initial:
                  nonlinear && String(data.get('initial') ?? '').trim()
                    ? String(data.get('initial'))
                        .split(/[;\s]+/)
                        .map(Number)
                    : undefined,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Modelo
            <select
              name="method"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as RegressionMethod);
                setError('');
              }}
            >
              {Object.entries(regressionMethods).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {method === 'custom' && (
            <>
              <label>
                Fórmula (Grace ou LaTeX)
                <textarea
                  name="formula"
                  value={formula}
                  onChange={(e) => {
                    setFormula(e.target.value);
                    setError('');
                  }}
                  rows={3}
                  spellCheck={false}
                />
              </label>
              <small>
                Ex.: y = a0*cos(a1*x+a2) ou {String.raw`$y=a_0\exp(-\frac{x}{a_1})+a_2$`}. Use a0…a9
                ou letras gregas, como \alpha e \tau.
              </small>
              <details>
                <summary>Funções e LaTeX aceitos</summary>
                <p>
                  sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, asinh, acosh, atanh,
                  exp, ln, log, log10, log2, sqrt, sqr, abs, pow, sgn, minof e maxof. ln e log são
                  naturais. Constantes: pi e e.
                </p>
                <p>{String.raw`LaTeX: \frac, \sqrt, \exp, \sin, \cos, \ln, \log_{10}, \cdot, \times, \left, \right, índices a_0 e potências x^{2}.`}</p>
                <p>
                  Parâmetros gregos: alpha, beta, gamma, delta, epsilon, theta, lambda, mu, nu,
                  sigma, tau, phi e omega (também com índice de 0 a 9). Outras funções e comandos
                  produzem uma mensagem de erro.
                </p>
              </details>
              {customExpression.compiled ? (
                <>
                  <div
                    className="regression-formula-preview"
                    aria-label="Prévia da fórmula"
                    dangerouslySetInnerHTML={{ __html: customExpression.compiled.mathml }}
                  />
                  <p className="regression-note">
                    Interpretada: <code>{customExpression.compiled.normalized}</code>
                  </p>
                  <fieldset>
                    <legend>Parâmetros do ajuste</legend>
                    <div className="custom-parameter-heading">
                      <span>Parâmetro / inicial</span>
                      <span>Mínimo</span>
                      <span>Máximo</span>
                    </div>
                    {customExpression.compiled.parameters.map((name) => (
                      <div key={name} className="custom-parameter-row">
                        <label>
                          {name}
                          <input
                            name={`initial:${name}`}
                            aria-label={`Inicial de ${name}`}
                            type="number"
                            step="any"
                            defaultValue="1"
                            required
                          />
                        </label>
                        <label>
                          <span className="sr-only">Mínimo de {name}</span>
                          <input
                            name={`min:${name}`}
                            aria-label={`Mínimo de ${name}`}
                            type="number"
                            step="any"
                            placeholder="−∞"
                          />
                        </label>
                        <label>
                          <span className="sr-only">Máximo de {name}</span>
                          <input
                            name={`max:${name}`}
                            aria-label={`Máximo de ${name}`}
                            type="number"
                            step="any"
                            placeholder="∞"
                          />
                        </label>
                        <label className="regression-checkbox custom-parameter-fixed">
                          <input name={`fixed:${name}`} type="checkbox" />
                          Fixar {name}
                        </label>
                      </div>
                    ))}
                  </fieldset>
                </>
              ) : (
                <p role="alert" className="regression-error">
                  {customExpression.error}
                </p>
              )}
              <div className="regression-grid">
                <label>
                  Tolerância
                  <input
                    name="tolerance"
                    type="number"
                    step="any"
                    min="1e-12"
                    max="0.01"
                    defaultValue="1e-8"
                    required
                  />
                </label>
                <label>
                  Máximo de iterações
                  <input
                    name="maxIterations"
                    type="number"
                    step="1"
                    min="1"
                    max="1000"
                    defaultValue="250"
                    required
                  />
                </label>
              </div>
            </>
          )}
          {method === 'polynomial' && (
            <label>
              Grau (1–10)
              <input name="degree" type="number" min="1" max="10" defaultValue="2" required />
            </label>
          )}
          <p>
            {method === 'custom'
              ? 'Levenberg–Marquardt com valores iniciais, parâmetros fixos e limites opcionais.'
              : nonlinear
                ? 'Levenberg–Marquardt. Largura positiva; base e amplitude livres.'
                : 'QR com centralização e escala de X. Potência e exponencial ajustam ln(Y); inversa ajusta 1/Y.'}{' '}
            Ajuste não ponderado; DX e DY não são usados como pesos.
          </p>
          {nonlinear && (
            <label>
              Iniciais: base; amplitude; centro; largura
              <input name="initial" placeholder="Automático (ou 0; 1; 0; 1)" />
              <small>
                {method === 'gaussian' ? 'Largura = σ' : 'Largura = γ (meia largura à meia altura)'}
              </small>
            </label>
          )}
          <fieldset>
            <legend>Dados usados no ajuste</legend>
            <div className="regression-grid">
              <label>
                X mínimo
                <input name="fitMin" type="number" step="any" placeholder="Toda a série" />
              </label>
              <label>
                X máximo
                <input name="fitMax" type="number" step="any" placeholder="Toda a série" />
              </label>
            </div>
          </fieldset>
          <label>
            Curva gerada
            <select name="sampling" defaultValue="uniform">
              <option value="uniform">Função em malha uniforme</option>
              <option value="source">Valores ajustados nos X da origem</option>
            </select>
          </label>
          <div className="regression-grid">
            <label>
              Início da curva
              <input name="curveMin" type="number" step="any" placeholder="Mínimo ajustado" />
            </label>
            <label>
              Fim da curva
              <input name="curveMax" type="number" step="any" placeholder="Máximo ajustado" />
            </label>
          </div>
          <label>
            Pontos na malha
            <input name="samples" type="number" min="2" max="10000" defaultValue="300" required />
          </label>
          <label className="regression-checkbox">
            <input name="residuals" type="checkbox" />
            Criar também série de resíduos (Y − ajuste)
          </label>
          {error && (
            <p role="alert" className="regression-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={method === 'custom' && !customExpression.compiled}
          >
            Ajustar e criar curva
          </button>
        </form>
      )}
    </div>,
    document.body,
  );
}

function FormulaPreview({ formula }: { formula: string }) {
  const compiled = useMemo(() => {
    try {
      return compileExpression(formula);
    } catch {
      return undefined;
    }
  }, [formula]);
  return (
    <>
      {compiled && (
        <div
          className="regression-formula-preview"
          aria-label="Fórmula ajustada"
          dangerouslySetInnerHTML={{ __html: compiled.mathml }}
        />
      )}
      <p className="regression-equation">
        <code>{formula}</code>
      </p>
    </>
  );
}
