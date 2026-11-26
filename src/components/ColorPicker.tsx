import { useEffect, useState } from 'react';
import type { Scene } from '../core/scene/types';
import { hexColor } from '../core/style/colors';
const names = [
  'Branco',
  'Preto',
  'Vermelho',
  'Verde',
  'Azul',
  'Amarelo',
  'Marrom',
  'Cinza',
  'Violeta',
  'Ciano',
  'Magenta',
  'Laranja',
  'Índigo',
  'Bordô',
  'Turquesa',
  'Verde escuro',
];
export function ColorPicker({
  label,
  scene,
  value,
  onChange,
}: {
  label: string;
  scene: Scene;
  value: number;
  onChange: (value: number | string) => void;
}) {
  const selected = scene.colors.find((c) => c.id === value);
  const hex = selected ? hexColor(selected.rgb) : '#000000';
  const [custom, setCustom] = useState(value > 15),
    [draft, setDraft] = useState(hex);
  useEffect(() => {
    setDraft(hex);
    if (value > 15) setCustom(true);
  }, [hex, value]);
  const commit = (text: string) => {
    setDraft(text);
    if (/^#[\da-f]{6}$/i.test(text)) onChange(text);
  };
  return (
    <div className="color-picker" role="group" aria-label={label}>
      <span className="color-label">{label}</span>
      <div className="color-swatches">
        {scene.colors
          .filter((c) => c.id < 16)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className="color-swatch"
              aria-label={`${label}: ${names[c.id] || c.name}`}
              aria-pressed={value === c.id}
              title={`${names[c.id] || c.name} · ${hexColor(c.rgb)}`}
              onClick={() => {
                setCustom(false);
                onChange(c.id);
              }}
              style={{ backgroundColor: hexColor(c.rgb) }}
            >
              <span>{value === c.id ? '✓' : ''}</span>
            </button>
          ))}
      </div>
      <button
        type="button"
        className="custom-color-toggle"
        aria-expanded={custom}
        onClick={() => setCustom(!custom)}
      >
        <span className="custom-color-chip" style={{ background: hex }} />
        Personalizado…<span>{hex}</span>
      </button>
      {custom && (
        <div className="custom-color-fields">
          <input
            type="color"
            aria-label={`${label}: escolher cor personalizada`}
            value={hex}
            onChange={(e) => commit(e.target.value)}
          />
          <input
            type="text"
            aria-label={`${label}: hexadecimal`}
            value={draft}
            maxLength={7}
            spellCheck={false}
            aria-invalid={!/^#[\da-f]{6}$/i.test(draft)}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setDraft(hex)}
          />
        </div>
      )}
    </div>
  );
}
