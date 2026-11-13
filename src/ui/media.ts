import { useSyncExternalStore } from 'react';

export const BP = {
  tablet: '(max-width:760px)',
  aboveTablet: '(min-width:761px)',
  desktop: '(min-width:1000px)'
} as const;

export type Breakpoint = typeof BP[keyof typeof BP];

const hasMedia = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export const mediaMatches = (q: string): boolean => hasMedia() && window.matchMedia(q).matches;

const subscribers = new Map<string, (cb: () => void) => () => void>();

const subscribe = (q: string): ((cb: () => void) => () => void) => {
  let fn = subscribers.get(q);
  if (!fn) {
    fn = (cb: () => void) => {
      if (!hasMedia()) return () => undefined;
      const m = window.matchMedia(q);
      m.addEventListener?.('change', cb);
      return () => m.removeEventListener?.('change', cb);
    };
    subscribers.set(q, fn);
  }
  return fn;
};

export function useMedia(q: string, fallback = false): boolean {
  return useSyncExternalStore(subscribe(q), () => (hasMedia() ? window.matchMedia(q).matches : fallback), () => fallback);
}
