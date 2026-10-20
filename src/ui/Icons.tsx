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
export const IconDownload = make(0, <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />);
export const IconShare = make(0, (
  <>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="17" cy="6" r="2.5" />
    <circle cx="17" cy="18" r="2.5" />
    <path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6" />
  </>
));
export const IconCamera = make(0, (
  <>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </>
));
export const IconSearch = make(0, (
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </>
));
export const IconTrash = make(0, <path d="M5 7h14M10 7V5h4v2m-8 0 1 12h8l1-12" />);
export const IconCopy = make(0, (
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
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
export const IconDone = make(0, <path d="m5 12.5 4.5 4.5L19 7.5" />, 2.2);
export const IconAlert = make(0, (
  <>
    <path d="M12 4 2.5 20h19z" />
    <path d="M12 10v4M12 17v.01" />
  </>
));
export const IconClose = make(0, <path d="M6 6l12 12M18 6 6 18" />, 2);
