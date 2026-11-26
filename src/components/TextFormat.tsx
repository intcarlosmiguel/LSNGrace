import type { Scene, TextStyle } from '../core/scene/types';
import { ColorPicker } from './ColorPicker';
import { FontSizeField } from './SizeFields';
export type TextUpdate = Partial<Pick<TextStyle, 'font' | 'size'>> & { color?: number | string };
export function TextFormat({
  label,
  scene,
  value,
  onChange,
  withSize = true,
}: {
  label: string;
  scene: Scene;
  value: Pick<TextStyle, 'font' | 'size' | 'color'>;
  onChange: (value: TextUpdate) => boolean;
  withSize?: boolean;
}) {
  return (
    <div className="text-format-fields">
      {withSize && (
        <FontSizeField
          page={scene.page.size}
          label={`Tamanho: ${label}`}
          value={value.size}
          onChange={(size) => onChange({ size })}
        />
      )}
      <label className="form-field">
        Fonte
        <select
          aria-label={`Fonte: ${label}`}
          value={value.font}
          onChange={(e) => onChange({ font: Number(e.target.value) })}
        >
          {scene.fonts.map((font) => (
            <option value={font.id} key={font.id}>
              {font.name}
            </option>
          ))}
        </select>
      </label>
      <ColorPicker
        label={`Cor: ${label}`}
        scene={scene}
        value={value.color}
        onChange={(color) => onChange({ color })}
      />
    </div>
  );
}
