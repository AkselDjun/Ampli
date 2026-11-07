import { useCallback, useMemo, useState } from 'react';
import type { AppSheet, SheetId, SheetNav } from './types';
import { parentSheetNav } from './navigation';

export interface SheetStack {
  sheet: SheetId;
  nav: SheetNav;
  setSheet: (sheet: SheetId) => void;
  pushSheet: (sheet: AppSheet) => void;
}

export function useSheetStack(): SheetStack {
  const [stack, setStack] = useState<AppSheet[]>([]);
  const sheet = stack.length ? stack[stack.length - 1] : null;
  const setSheet = useCallback((id: SheetId) => setStack(id ? [id] : []), []);
  const pushSheet = useCallback((id: AppSheet) => setStack(current => [...current.filter(x => x !== id), id]), []);
  const pop = useCallback(() => setStack(current => current.slice(0, -1)), []);
  const nav = useMemo(() => parentSheetNav(stack, pop), [stack, pop]);
  return { sheet, nav, setSheet, pushSheet };
}
