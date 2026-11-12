import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../ui/App';
import { THEME_KEY, initTheme, readTheme, setTheme } from '../../ui/theme';
import { click, dlg } from './util';

vi.setConfig({ testTimeout: 60000 });

const root = () => document.documentElement;
const metas = () => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  for (const [media, content] of [['(prefers-color-scheme: light)', '#FFFFFF'], ['(prefers-color-scheme: dark)', '#15202A']]) {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.media = media;
    m.content = content;
    document.head.append(m);
  }
  return [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(m => m.content);
};
const bar = () => [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(m => m.content);

afterEach(() => {
  act(() => setTheme('auto'));
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('forces a theme, remembers it and returns to the system one', () => {
    metas();
    setTheme('dark');
    expect(root().dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(bar()).toEqual(['#15202A', '#15202A']);
    setTheme('light');
    expect(root().dataset.theme).toBe('light');
    expect(bar()).toEqual(['#FFFFFF', '#FFFFFF']);
    setTheme('auto');
    expect(root().dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(bar()).toEqual(['#FFFFFF', '#15202A']);
  });

  it('restores the saved theme on start and ignores unknown values', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    initTheme();
    expect(root().dataset.theme).toBe('dark');
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(readTheme()).toBe('auto');
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readTheme()).toBe('auto');
    expect(() => setTheme('dark')).not.toThrow();
    expect(root().dataset.theme).toBe('dark');
  });

  it('switches the theme from my data and from quick actions', () => {
    render(<App />);
    click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
    click(dlg('Проекты'), 'Открыть мои данные');
    const d = dlg('Мои данные');
    fireEvent.click(screen.getByRole('tab', { name: 'Оформление' }));
    const dark = screen.getByRole('radio', { name: 'Тёмная' });
    fireEvent.click(dark);
    expect(root().dataset.theme).toBe('dark');
    expect(dark).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Авто' }));
    expect(root().dataset.theme).toBeUndefined();
    expect(d.textContent).toContain('Тема оформления');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox', { name: 'Найти действие или группу' });
    fireEvent.change(input, { target: { value: 'Светлая тема' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(root().dataset.theme).toBe('light');
  });
});
