/**
 * Small line icons in the style of an editor's codicons, drawn on a 16×16
 * grid with the current text colour. Decorative: the control next to or
 * around an icon always carries the accessible name.
 */
const PATHS = {
  checks: 'M2.5 3.5h7M2.5 8h5M2.5 12.5h4M10 11l1.8 1.8L15 9.5',
  outline: 'M2.5 3h11M5 6.5h8.5M5 10h8.5M7.5 13.5h6M2.5 3v7.5h2.5M2.5 6.5H5',
  notation: 'M12.5 3.5h-8l4.5 4.5-4.5 4.5h8',
  learn: 'M2 3.5c2-.8 4-.8 6 .6v9c-2-1.4-4-1.4-6-.6zM14 3.5c-2-.8-4-.8-6 .6v9c2-1.4 4-1.4 6-.6z',
  log: 'M2 3h12v10H2zM4.5 6.5 6.5 8l-2 1.5M8 10h3.5',
  settings:
    'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
  chevron: 'M6 4l4 4-4 4',
  bulb: 'M6 12h4M6.5 14h3M8 2a4 4 0 0 0-2.5 7.1c.6.5 1 1.2 1 1.9h3c0-.7.4-1.4 1-1.9A4 4 0 0 0 8 2z',
  goto: 'M3 8h9M8.5 4.5 12 8l-3.5 3.5',
  book: 'M3.5 2.5h8a1 1 0 0 1 1 1v10h-8a1 1 0 0 1-1-1zM3.5 12.5a1 1 0 0 1 1-1h8',
  sparkle: 'M8 1.5 9.3 6.7 14.5 8 9.3 9.3 8 14.5 6.7 9.3 1.5 8 6.7 6.7z',
  send: 'M2 8 14 2.5 10.5 14 8 9.5zM8 9.5l6-7',
  close: 'M4 4l8 8M12 4l-8 8',
  hide: 'M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4zM8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2.5 13.5l11-11',
  error: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6',
  warning: 'M8 2 14.5 13.5h-13zM8 6.5v3.2M8 11.5v.3',
  info: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 7.2v4M8 4.8v.3',
  file: 'M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3',
  check: 'M3 8.5 6.5 12 13 4.5',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9',
  upload: 'M8 11V2.5M4.8 5.7 8 2.5l3.2 3.2M2.5 11v2.5h11V11',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
