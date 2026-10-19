export type Theme = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'ampli-theme';
export const THEME_ORDER: Theme[] = ['auto', 'light', 'dark'];
export const THEME_LABEL: Record<Theme, string> = { auto: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' };

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch (e) {
    void e;
    return 'auto';
  }
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (e) {
    void e;
  }
}

export function nextTheme(t: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
}
