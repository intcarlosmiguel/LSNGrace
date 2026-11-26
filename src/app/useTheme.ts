import { useLayoutEffect, useState } from 'react';
import palettes from '../../cores-temas-lsntex.json';
export const themePalettes = [
  ...palettes.temas,
  {
    ...palettes.temas[0],
    id: 'classic-green',
    tema: 'Clássico verde',
    escuro: { ...palettes.temas[0].escuro, ...palettes.variante_classico_verde.escuro },
    claro: { ...palettes.temas[0].claro, ...palettes.variante_classico_verde.claro },
  },
];
function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    stored('lsngrace.theme', 'dark') === 'light' ? 'light' : 'dark',
  );
  const [palette, setPalette] = useState(() => {
    const id = stored('lsngrace.palette', 'classic');
    return themePalettes.some((p) => p.id === id) ? id : 'classic';
  });
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.palette = palette;
    root.style.colorScheme = theme;
    const colors = themePalettes.find((p) => p.id === palette)![
      theme === 'dark' ? 'escuro' : 'claro'
    ];
    for (const [key, value] of Object.entries(colors)) root.style.setProperty(`--${key}`, value);
    const aliases = {
      header: colors.panel,
      canvas: colors.bg,
      hover: colors.raised,
      selected: colors.selection,
      input: colors.editor,
    };
    for (const [key, value] of Object.entries(aliases)) root.style.setProperty(`--${key}`, value);
    try {
      localStorage.setItem('lsngrace.theme', theme);
      localStorage.setItem('lsngrace.palette', palette);
    } catch {
      /* Themes also work without storage. */
    }
  }, [theme, palette]);
  return {
    theme,
    palette,
    setPalette,
    toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
  };
}
