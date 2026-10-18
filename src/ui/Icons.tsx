import type { ReactNode } from 'react';

const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const make = (w: number, d: ReactNode, sw = 1.8) =>
  function Icon({ className }: { className?: string }) {
    return (
      <svg className={className} viewBox="0 0 24 24" width={w || undefined} height={w || undefined} strokeWidth={sw} {...base}>
        {d}
      </svg>
    );
  };

export const IconBack = make(24, <path d="m15 5-7 7 7 7" />, 2);
export const IconChev = make(0, <path d="m9 6 6 6-6 6" />, 2);
export const IconDown = make(0, <path d="m6 9 6 6 6-6" />, 2);
export const IconNet = make(0, (
  <>
    <path d="M4 8h9M19 8h1M4 16h1M11 16h9" />
    <circle cx="16" cy="8" r="2.5" />
    <circle cx="8" cy="16" r="2.5" />
  </>
));
export const IconDoc = make(0, (
  <>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </>
));
export const IconFolder = make(0, <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const IconCheck = make(0, (
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>
));
export const IconInfo = make(0, (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </>
));
export const IconList = make(0, <path d="M4 6h16M4 12h16M4 18h16" />);
export const IconBolt = make(0, <path d="M13 2 5 13h6l-1 9 8-11h-6z" />);
export const IconPanel = make(0, (
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </>
));

export function Brand() {
  return (
    <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
      <defs>
        <pattern id="pe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="#2E9B4E" />
          <rect x="3" width="3" height="6" fill="#E7C71B" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="30" height="6" rx="3" fill="#8B5A2B" />
      <rect x="0" y="8" width="30" height="6" rx="3" fill="#1F6FD6" />
      <rect x="0" y="16" width="30" height="6" rx="3" fill="url(#pe)" />
    </svg>
  );
}
