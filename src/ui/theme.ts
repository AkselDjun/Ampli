import { useSyncExternalStore } from 'react';

export type Theme = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'ampli-theme';
export const THEME_LABEL: Record<Theme, string> = { auto: 'Как в системе', light: 'Светлая', dark: 'Тёмная' };

const BAR: Record<'light' | 'dark', string> = { light: '#FFFFFF', dark: '#15202A' };
const subs = new Set<() => void>();

const valid = (v: unknown): v is Theme => v === 'auto' || v === 'light' || v === 'dark';

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return valid(v) ? v : 'auto';
  } catch (e) {
    void e;
    return 'auto';
  }
}

let cur: Theme = readTheme();

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
    const own = (m.media || '').includes('dark') ? 'dark' : 'light';
    m.content = BAR[t === 'auto' ? own : t];
  });
}

export function setTheme(t: Theme): void {
  cur = t;
  try {
    if (t === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch (e) {
    void e;
  }
  applyTheme(t);
  subs.forEach(f => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore(subscribe, () => cur, () => cur);
  return [t, setTheme];
}

export function initTheme(): void {
  cur = readTheme();
  applyTheme(cur);
}
