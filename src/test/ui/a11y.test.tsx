import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../../ui/App';
import { AddMenu } from '../../ui/AddMenu';
import { Sheet } from '../../ui/common';
import { KEY } from '../../store/storage';
import { byLabel, change, click, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const ed = () => document.querySelector('.col-edit') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const visible = () => {
  const orig = HTMLElement.prototype.getClientRects;
  HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
  return () => { HTMLElement.prototype.getClientRects = orig; };
};

afterEach(() => vi.useRealTimers());

describe('dialog focus trap', () => {
  it('keeps Tab inside the open sheet', () => {
    const undo = visible();
    render(<Sheet open onClose={() => undefined} title="Окно"><button type="button">Первая</button><label><input type="radio" name="r" defaultChecked />А</label><label><input type="radio" name="r" />Б</label><button type="button">Последняя</button><div hidden><button type="button">Скрытая</button></div></Sheet>);
    const panel = document.querySelector('.sheet-panel') as HTMLElement;
    const close = screen.getByRole('button', { name: 'Закрыть' });
    const lastBtn = screen.getByRole('button', { name: 'Последняя' });
    lastBtn.focus();
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
    screen.getByRole('button', { name: 'Первая' }).focus();
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Первая' }));
    fireEvent.keyDown(panel, { key: 'Enter' });
    undo();
  });

  it('does nothing without focusable content', () => {
    render(<Sheet open onClose={() => undefined} title="Пусто"><p>x</p></Sheet>);
    const panel = document.querySelector('.sheet-panel') as HTMLElement;
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(panel).toBeTruthy();
  });
});

describe('menu keyboard', () => {
  it('moves through the add menu with arrows and returns focus on Escape', () => {
    const onAdd = vi.fn();
    render(<AddMenu onAdd={onAdd} onRooms={() => undefined} />);
    const trigger = screen.getByRole('button', { name: '+ Добавить группу' });
    fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'x' });
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getAllByRole('menuitem')[2]);
    expect(onAdd).toHaveBeenCalledWith('power');
    expect(document.activeElement).toBe(trigger);
  });

  it('labels the group actions menu', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[0]);
    click(ed(), /Ещё действия/);
    expect(screen.getByRole('menu', { name: 'Действия с группой' })).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Вставить список текстом');
  });
});

describe('reorder without dragging', () => {
  it('moves the group earlier and later from the actions menu', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[1]);
    const names = () => stored().list[0].lines.map((l: { name: string }) => l.name);
    const second = names()[1];
    click(ed(), /Ещё действия/);
    click(ed(), 'Переставить раньше, на место Г1');
    expect(names()[0]).toBe(second);
    click(ed(), /Ещё действия/);
    expect(ed().textContent).not.toContain('Переставить раньше');
    click(ed(), 'Переставить позже, на место Г2');
    expect(names()[1]).toBe(second);
    fireEvent.click(rows()[rows().length - 1]);
    click(ed(), /Ещё действия/);
    expect(ed().textContent).not.toContain('Переставить позже');
  });
});

describe('screen reader feedback in the editor', () => {
  it('has a heading and announces recalculation after a pause, not on group switch', () => {
    vi.useFakeTimers();
    wide(true);
    render(<App />);
    fireEvent.click(rows()[3]);
    expect(ed().querySelector('h2.vh')?.textContent).toBe('Группа Г4 Плита и духовка');
    const say = () => ed().querySelector('.ed-say')?.textContent;
    expect(say()).toBe('');
    change(byLabel(ed(), 'Мощность, Вт'), '9000');
    expect(say()).toBe('');
    act(() => { vi.advanceTimersByTime(800); });
    expect(say()).toMatch(/^Г4: ток \d+,\d А, автомат C\d+, кабель [\d,]+ мм², потеря [\d,]+ %, (норма|проверьте|не подходит)$/);
    change(byLabel(ed(), 'Мощность, Вт'), '90000');
    act(() => { vi.advanceTimersByTime(800); });
    expect(say()).toBe('Г4: подбор невозможен');
    fireEvent.click(rows()[0]);
    expect(say()).toBe('');
  });

  it('reads the values of the sticky strip', () => {
    let cb: (e: unknown[]) => void = () => undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(f: typeof cb) { cb = f; }
      observe() { return undefined; }
      disconnect() { return undefined; }
    });
    wide(true);
    render(<App />);
    fireEvent.click(rows()[3]);
    act(() => cb([{ isIntersecting: false, boundingClientRect: { top: -200 }, rootBounds: { top: 56 } }]));
    expect(document.querySelector('.ed-mini')?.getAttribute('aria-label')).toMatch(/^Г4: ток .* автомат C32, .*, норма\. Показать расчёт$/);
    vi.unstubAllGlobals();
  });
});
