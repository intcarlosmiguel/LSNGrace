import { useEffect, useState } from 'react';

/** Tracks Ctrl/Cmd even when the pointer stays on the same series. */
export function useRegressionModifier() {
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    const update = (event: KeyboardEvent | PointerEvent) =>
      setPressed(event.ctrlKey || event.metaKey);
    const reset = () => setPressed(false);
    const visibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('pointermove', update, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('pointermove', update);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return pressed;
}
