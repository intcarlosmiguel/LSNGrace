export type IconName =
  | 'text'
  | 'pointAdd'
  | 'pointDelete'
  | 'copy'
  | 'paste'
  | 'image'
  | 'inset'
  | 'warning'
  | 'menu'
  | 'settings'
  | 'minus'
  | 'collapse'
  | 'expand'
  | 'dots'
  | 'home'
  | 'moon'
  | 'sun'
  | 'cursor'
  | 'hand'
  | 'move'
  | 'zoom'
  | 'plus'
  | 'file'
  | 'upload'
  | 'download'
  | 'undo'
  | 'redo'
  | 'chart'
  | 'data'
  | 'eye'
  | 'eyeOff'
  | 'close'
  | 'fit'
  | 'trash'
  | 'edit'
  | 'check'
  | 'chevron';
const paths: Record<IconName, string> = {
  text: 'M4 5V3h16v2M12 3v18M8 21h8',
  pointAdd: 'M9 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 3v10m-5-5h10M10 21l4-5 7 4',
  pointDelete: 'M9 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-9 8 8m0-8-8 8M10 21l4-5 7 4',
  copy: 'M8 8h12v13H8ZM16 8V3H3v13h5',
  paste: 'M8 5H4v16h16V5h-4M8 3h8v5H8ZM8 12h8m-8 4h8',
  image: 'M3 4h18v16H3ZM3 15l5-5 5 6 3-4 5 5M16 8h.01',
  inset: 'M3 4h18v16H3ZM12 7h6v6h-6Z',
  warning: 'M12 3 2 21h20ZM12 9v5m0 3v.1',
  menu: 'M4 6h16M4 12h16M4 18h16',
  settings: 'M4 6h6m4 0h6M4 12h10m4 0h2M4 18h2m4 0h10M10 3v6m4 0v6M6 15v6',
  minus: 'M5 12h14',
  collapse: 'm14 5-7 7 7 7m5-14-7 7 7 7',
  expand: 'm5 5 7 7-7 7m5-14 7 7-7 7',
  dots: 'M5 12h.1M12 12h.1M19 12h.1',
  home: 'm3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10',
  moon: 'M20 15a8 8 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  cursor: 'm5 3 3 18 4-7 7-4Z',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v7-9a1.5 1.5 0 0 1 3 0v9-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7h-1c-2.5 0-4-1-5.5-3L3 13a1.6 1.6 0 0 1 2.5-2L8 14',
  move: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  zoom: 'M15 10a5 5 0 1 1-10 0 5 5 0 0 1 10 0m-1 4 7 7M7 10h6m-3-3v6',
  plus: 'M12 5v14M5 12h14',
  file: 'M14 2H6a2 2 0 0 0-2 2v16h16V8Z M14 2v6h6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  download: 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
  undo: 'M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5',
  redo: 'M20 10H10a6 6 0 0 0 0 12m10-12-5-5m5 5-5 5',
  chart: 'M4 3v17h17M7 15l4-6 4 3 5-8',
  data: 'M3 4h18v16H3ZM3 9h18M3 14h18M9 4v16',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:
    'M3 3l18 18M9 5a12 12 0 0 1 13 7 18 18 0 0 1-3 4M6 6a20 20 0 0 0-4 6s4 7 10 7a12 12 0 0 0 4-1',
  close: 'm6 6 12 12M6 18 18 6',
  fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  edit: 'm4 16 12-12 4 4L8 20H4Zm9-9 4 4',
  check: 'm5 12 4 4L19 6',
  chevron: 'm9 5 7 7-7 7',
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
