import { useState } from 'react';
import { NumberField } from './Fields';
import {
  displayNumber,
  fontFromDisplay,
  fontToDisplay,
  sameSize,
  type FontUnit,
  type LengthUnit,
} from '../core/geometry/units';
export function UnitSelect({
  label,
  value,
  onChange,
  font = false,
}: {
  label: string;
  value: FontUnit;
  onChange: (unit: FontUnit) => void;
  font?: boolean;
}) {
  return (
    <label className="size-unit">
      <span>Unidade</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as FontUnit)}
      >
        {(['pt', 'px', 'cm', 'mm', 'in', '%'] as LengthUnit[]).map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
        {font && <option value="grace">Grace (×)</option>}
      </select>
    </label>
  );
}
export function FontSizeField({
  label,
  value,
  page,
  onChange,
}: {
  label: string;
  value: number;
  page: [number, number];
  onChange: (value: number) => boolean;
}) {
  const [unit, setUnit] = useState<FontUnit>('pt');
  return (
    <div className="font-size-field">
      <div className="size-input-row">
        <NumberField
          label={label}
          value={displayNumber(fontToDisplay(value, unit, page))}
          min={0}
          step="any"
          onChange={(n) => {
            const size = fontFromDisplay(n, unit, page);
            return Number.isFinite(size) && (sameSize(size, value) || onChange(size));
          }}
        />
        <UnitSelect label={`Unidade: ${label}`} value={unit} onChange={setUnit} font />
      </div>
      {unit === '%' && <p className="field-hint">100% corresponde ao tamanho padrão do Grace.</p>}
    </div>
  );
}
