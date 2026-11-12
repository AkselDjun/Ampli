import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { AddMenu } from '../../ui/AddMenu';
import { markSampleHint, sampleHintPending } from '../../features/onboarding/storage';
import { currentToast } from '../../ui/toast';
import { toastText } from './util';

const phone = () => {
  window.matchMedia = ((q: string) => ({
    matches: q === '(max-width:760px)',
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
};

const rows = () => document.querySelectorAll('.rows .row').length;

describe('add menu extras', () => {
  it('opens floor heating and low voltage from the add menu', () => {
    const floor = vi.fn();
    const weak = vi.fn();
    render(<AddMenu fab onAdd={vi.fn()} onRooms={vi.fn()} onFloor={floor} onWeak={weak} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
    const menu = screen.getByRole('menu', { name: 'Добавить в проект' });
    expect(within(menu).getByRole('separator')).toBeTruthy();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Тёплый пол' }));
    expect(floor).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Слаботочка' }));
    expect(weak).toHaveBeenCalledTimes(1);
  });

  it('leaves the extras out when there is nothing to open', () => {
    render(<AddMenu onAdd={vi.fn()} onRooms={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Добавить группу' }));
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Тёплый пол' })).toBeNull();
  });
});

describe('sample hint on the phone', () => {
  it('remembers that the hint was shown', () => {
    expect(sampleHintPending()).toBe(true);
    markSampleHint();
    expect(sampleHintPending()).toBe(false);
  });

  it('shows the sample hint once and lets the user undo starting from scratch', () => {
    vi.useFakeTimers();
    phone();
    render(<App />);
    const before = rows();
    expect(before).toBeGreaterThan(0);
    act(() => { vi.advanceTimersByTime(1300); });
    expect(toastText()).toContain('пример двухкомнатной квартиры');
    expect(currentToast()?.label).toBe('Начать с нуля');
    expect(sampleHintPending()).toBe(false);
    act(() => currentToast()?.run?.());
    expect(rows()).toBe(0);
    expect(toastText()).toBe('Проект очищен');
    expect(currentToast()?.label).toBe('Отменить');
    act(() => currentToast()?.run?.());
    expect(rows()).toBe(before);
  });

  it('stays quiet on wide screens and after the first time', () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);
    act(() => { vi.advanceTimersByTime(1300); });
    expect(toastText()).not.toContain('пример двухкомнатной квартиры');
    unmount();
    phone();
    markSampleHint();
    render(<App />);
    act(() => { vi.advanceTimersByTime(1300); });
    expect(toastText()).not.toContain('пример двухкомнатной квартиры');
  });
});
