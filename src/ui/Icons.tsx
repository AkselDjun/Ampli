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
export const IconMeter = make(0, (
  <>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <path d="M8.5 5.5h7v3.5h-7zM9.5 15.5a2.5 2.5 0 1 1 5 0M12 15.5l1.5-1.8" />
    <circle cx="9.5" cy="19" r=".6" />
    <circle cx="14.5" cy="19" r=".6" />
  </>
));
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
export const IconBulb = make(0, (
  <>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </>
));
export const IconSocket = make(0, (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="9" cy="12" r="1.2" />
    <circle cx="15" cy="12" r="1.2" />
  </>
));
export const IconRooms = make(0, (
  <>
    <path d="M3 4h18v16H3z" />
    <path d="M12 4v7H3M12 15v5M16 11h5" />
  </>
));
export const IconWire = make(0, (
  <>
    <path d="M3 17h4c3 0 3-10 6-10s3 10 6 10h2" />
    <path d="M3 14v6M21 14v6" />
  </>
));
export const IconPrint = make(0, (
  <>
    <path d="M7 9V4h10v5" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v6H7z" />
  </>
));
export const IconLan = make(0, (
  <>
    <rect x="5" y="5" width="14" height="12" rx="1.5" />
    <path d="M9 17v3h6v-3M9 9v3M12 9v3M15 9v3" />
  </>
));
export const IconHeat = make(0, (
  <>
    <path d="M4 19h16" />
    <path d="M8 15c-1.5-1.7 1.5-3.3 0-5s1.5-3.3 0-5M12 15c-1.5-1.7 1.5-3.3 0-5s1.5-3.3 0-5M16 15c-1.5-1.7 1.5-3.3 0-5s1.5-3.3 0-5" />
  </>
));
