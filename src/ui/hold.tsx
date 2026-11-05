import { Suspense, memo, useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export const Hold = memo(
  function Hold({ open, eager = false, children }: { open: boolean; eager?: boolean; children: ReactNode }) {
    const [seen, setSeen] = useState(open || eager);
    if (open && !seen) setSeen(true);
    return seen || open ? <Suspense fallback={null}>{children}</Suspense> : null;
  },
  (a, b) => !a.open && !b.open
);

export function useStable<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...a: A) => ref.current(...a), []);
}

export function same<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof T)[];
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    const x = a[k];
    const y = b[k];
    if (x === y) continue;
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, i) => v === y[i])) continue;
    return false;
  }
  return true;
}
