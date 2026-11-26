import { useEffect, useId, useRef, useState } from 'react';
import { withEditGroup } from '../state/editGroup';
import { stepNumber } from './numberStep';
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 'any',
}: {
  label: string;
  value: number;
  onChange: (v: number) => boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  const [draft, setDraft] = useState(String(value)),
    [invalid, setInvalid] = useState(false);
  const id = useId(),
    focus = useRef(false),
    session = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ value, onChange, min, max });
  latest.current = { value, onChange, min, max };
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!focus.current) setDraft(String(value));
    setInvalid(false);
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const apply = (text: string) => {
    const n = Number(text),
      p = latest.current;
    if (
      !text.trim() ||
      !Number.isFinite(n) ||
      (p.min !== undefined && n < p.min) ||
      (p.max !== undefined && n > p.max)
    )
      return false;
    return n === p.value || withEditGroup(`${id}:${session.current}`, () => p.onChange(n));
  };
  const flush = () => {
    clearTimeout(timer.current);
    const ok = apply(draftRef.current);
    setInvalid(!ok);
    return ok;
  };
  const adjust = (direction: -1 | 1) => {
    clearTimeout(timer.current);
    const current = Number(draftRef.current);
    const next = stepNumber(
      draftRef.current.trim() && Number.isFinite(current) ? current : latest.current.value,
      direction,
      step,
      min,
      max,
    );
    if (!focus.current) session.current++;
    const text = String(next);
    if (apply(text)) {
      draftRef.current = text;
      setDraft(text);
      setInvalid(false);
    } else setInvalid(true);
  };
  const current = draft.trim() && Number.isFinite(Number(draft)) ? Number(draft) : value;
  return (
    <div className="number-field">
      <label htmlFor={id}>{label}</label>
      <div className="number-stepper">
        <button
          type="button"
          className="number-step"
          aria-label={`Diminuir: ${label}`}
          title={`Diminuir: ${label}`}
          disabled={min !== undefined && current <= min}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => adjust(-1)}
        >
          −
        </button>
        <input
          id={id}
          aria-label={label}
          aria-invalid={invalid}
          type="number"
          step={step}
          min={min}
          max={max}
          value={draft}
          onFocus={() => {
            focus.current = true;
            session.current++;
          }}
          onChange={(e) => {
            const text = e.target.value;
            draftRef.current = text;
            setDraft(text);
            setInvalid(false);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setInvalid(!apply(text)), 180);
          }}
          onBlur={() => {
            focus.current = false;
            if (!flush()) setDraft(String(latest.current.value));
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              adjust(e.key === 'ArrowUp' ? 1 : -1);
            }
            if (e.key === 'Enter') flush();
            if (e.key === 'Escape') {
              clearTimeout(timer.current);
              draftRef.current = String(latest.current.value);
              setDraft(draftRef.current);
              setInvalid(false);
            }
          }}
        />
        <button
          type="button"
          className="number-step"
          aria-label={`Aumentar: ${label}`}
          title={`Aumentar: ${label}`}
          disabled={max !== undefined && current >= max}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => adjust(1)}
        >
          +
        </button>
      </div>
      {invalid && <small className="number-error">Informe um valor válido.</small>}
    </div>
  );
}
