import { useState } from 'react';
import { rasterSize, type RasterOptions } from '../../core/export/raster';
export type FigureFormat = 'svg' | 'png' | 'eps' | 'pdf';
export function ExportSettings({
  page,
  disabled,
  onExport,
}: {
  page: readonly number[];
  disabled: boolean;
  onExport: (format: FigureFormat, options: RasterOptions) => void;
}) {
  const [format, setFormat] = useState<FigureFormat>('png');
  const [preset, setPreset] = useState('300');
  const [custom, setCustom] = useState('300');
  const dpi = Number(preset === 'custom' ? custom : preset);
  let size,
    error = '';
  if (format === 'png') {
    try {
      size = rasterSize(page, dpi);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  return (
    <section className="export-settings" aria-label="Configurações de exportação">
      <label className="form-field">
        Tipo de arquivo
        <select
          aria-label="Tipo de arquivo"
          value={format}
          onChange={(e) => setFormat(e.target.value as FigureFormat)}
        >
          <option value="png">PNG · imagem rasterizada</option>
          <option value="pdf">PDF · vetorial</option>
          <option value="svg">SVG · vetorial</option>
          <option value="eps">EPS · vetorial</option>
        </select>
      </label>
      {format === 'png' ? (
        <>
          <label className="form-field">
            Resolução (DPI)
            <select
              aria-label="Resolução (DPI)"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {[72, 96, 150, 300, 600, 1200].map((v) => (
                <option key={v} value={v}>
                  {v} DPI
                </option>
              ))}
              <option value="custom">Personalizada…</option>
            </select>
          </label>
          {preset === 'custom' && (
            <label className="form-field">
              DPI personalizado
              <input
                aria-label="DPI personalizado"
                type="number"
                min="1"
                step="any"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
          )}
          {size && (
            <p className="field-hint" role="status">
              {size.width.toLocaleString('pt-BR')} × {size.height.toLocaleString('pt-BR')} pixels ·{' '}
              {dpi} DPI
            </p>
          )}
          <p className="field-hint">
            O DPI usa o tamanho físico da imagem e fica gravado no arquivo PNG.
          </p>
        </>
      ) : (
        <p className="field-hint">
          Formato vetorial: linhas e textos mantêm a definição em qualquer tamanho. Não utiliza DPI.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary export-submit"
        disabled={disabled || !!error}
        onClick={() => onExport(format, format === 'png' ? { dpi } : {})}
      >
        Exportar {format.toUpperCase()}
      </button>
    </section>
  );
}
