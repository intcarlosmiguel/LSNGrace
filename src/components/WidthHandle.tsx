import { useRef, useState } from 'react';

export function WidthHandle({
  label,
  value,
  min,
  max,
  initial,
  onChange,
  column = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  initial: number;
  onChange: (value: number) => void;
  column?: boolean;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const [active, setActive] = useState(false);
  const update = (width: number) => onChange(Math.round(Math.max(min, Math.min(max, width))));
  const end = () => {
    drag.current = null;
    setActive(false);
  };
  return (
    <div
      className={`width-handle ${column ? 'column-width-handle' : ''} ${active ? 'is-resizing' : ''}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} pixels`}
      title="Arraste para ajustar a largura. Use ← e →; duplo clique para restaurar."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        drag.current = { pointerId: event.pointerId, x: event.clientX, width: value };
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId === event.pointerId)
          update(drag.current.width + event.clientX - drag.current.x);
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        update(drag.current.width + event.clientX - drag.current.x);
        end();
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={end}
      onPointerCancel={end}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        update(initial);
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        update(
          event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : value + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 40 : 10),
        );
      }}
    >
      <span />
    </div>
  );
}
