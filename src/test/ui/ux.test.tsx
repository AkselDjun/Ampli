import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { Checks, checksOf } from '../../ui/Checks';
import { Sheet } from '../../ui/common';
import { PACK_DEFAULT, PACK_KEY, loadPack } from '../../ui/pack';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Cfg, Line } from '../../core/types';
import { byLabel, change, click, dlg, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const ed = () => document.querySelector('.col-edit') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
const calc = (ls: Line[], cfg: Partial<Cfg> = {}) => calcAll(ls, { ...defaultCfg(), ...cfg });
const boot = (ls: Line[]) => {
  const p = newProject({ cfg: defaultCfg(), lines: ls, sample: false }, 'Тест');
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('actionable checks', () => {
  it('switches to three phases from the check', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Проверки по нормам/ }));
    click(document.getElementById('chk-pop') as HTMLElement, 'Включить 3 фазы');
    expect(stored().list[0].cfg.supply).toBe(3);
    expect(document.getElementById('chk-pop')).toBeNull();
  });

  it('offers a single phase for a small load and opens groups', () => {
    const ls = [mkLine('Длинная', 'power', 400, 1, 1, [['Печь', 3500, 1]]), mkLine('Без длины', 'light', 0, 1, 1, [['Лампа', 100, 1]]), mkLine('Перегруз', 'power', 10, 1, 1, [['Первый', 10000, 1], ['Второй', 10000, 1]])];
    const a = calc(ls, { supply: 3 });
    const list = checksOf(a);
    expect(checksOf(calc([ls[1]], { supply: 3 })).find(x => x.fix === 'phase1')).toBeTruthy();
    expect(list.find(x => x.t.startsWith('Короткое замыкание: автомат'))?.groups).toEqual([ls[0].id]);
    expect(list.find(x => x.t.startsWith('Замечания в'))?.groups).toContain(ls[2].id);
    const onGroup = vi.fn();
    const onFix = vi.fn();
    const { unmount } = render(<Checks a={a} onGroup={onGroup} onFix={onFix} />);
    fireEvent.click(screen.getByRole('button', { name: /^Проверки по нормам/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Открыть группу Г1' })[0]);
    expect(onGroup).toHaveBeenCalledWith(ls[0].id);
    unmount();
    render(<Checks a={calc([ls[1]], { supply: 3 })} onGroup={onGroup} onFix={onFix} />);
    fireEvent.click(screen.getByRole('button', { name: /^Проверки по нормам/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Перейти на 1 фазу' }));
    expect(onFix).toHaveBeenCalledWith('phase1');
    const kzNo = checksOf(calc([ls[1]]));
    expect(kzNo.find(x => x.t.startsWith('Короткое замыкание не проверено'))?.groups).toEqual([ls[1].id]);
  });

  it('opens a group from the check in the app', () => {
    wide(true);
    const ls = [mkLine('Свет', 'light', 5, 1, 1, [['Лампа', 100, 1]]), mkLine('Перегруз', 'power', 10, 1, 1, [['Первый', 10000, 1], ['Второй', 10000, 1]])];
    boot(ls);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Проверки по нормам/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть группу Г2' }));
    expect(stored().list[0].lines.length).toBe(2);
    expect((ed().querySelector('.ed-name') as HTMLInputElement).value).toBe('Перегруз');
  });
});

describe('editor', () => {
  it('shows a sticky result strip when the result scrolls away and flashes changes', () => {
    let cb: (e: { isIntersecting: boolean; boundingClientRect: { top: number }; rootBounds: { top: number } }[]) => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(f: typeof cb) { cb = f; }
      observe() { return undefined; }
      disconnect() { disconnect(); }
    });
    const into = vi.fn();
    Element.prototype.scrollIntoView = into;
    wide(true);
    render(<App />);
    fireEvent.click(rows()[3]);
    expect(ed().querySelector('.ed-mini')).toBeNull();
    act(() => cb([{ isIntersecting: false, boundingClientRect: { top: -200 }, rootBounds: { top: 56 } }]));
    const mini = ed().querySelector('.ed-mini') as HTMLElement;
    expect(mini.textContent).toMatch(/А.*C32.*мм².*ΔU/);
    fireEvent.click(mini);
    expect(into).toHaveBeenCalled();
    expect(ed().querySelector('.ed-res .flash')).toBeNull();
    change(byLabel(ed(), 'Мощность, Вт'), '9000');
    expect(ed().querySelectorAll('.ed-res .flash').length).toBeGreaterThan(0);
    act(() => cb([{ isIntersecting: true, boundingClientRect: { top: 100 }, rootBounds: { top: 56 } }]));
    expect(ed().querySelector('.ed-mini')).toBeNull();
    fireEvent.click(rows()[0]);
    expect(disconnect).toHaveBeenCalled();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('moves with Enter from name to power and adds the next appliance', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[0]);
    const names = () => Array.from(ed().querySelectorAll<HTMLInputElement>('.a-name'));
    const pows = () => Array.from(ed().querySelectorAll<HTMLInputElement>('[aria-label="Мощность, Вт"]'));
    const n0 = names().length;
    fireEvent.keyDown(names()[0], { key: 'Enter' });
    expect(document.activeElement).toBe(pows()[0]);
    fireEvent.keyDown(pows()[0], { key: 'Enter' });
    expect(document.activeElement).toBe(pows()[1]);
    fireEvent.keyDown(pows()[0], { key: 'a' });
    fireEvent.keyDown(names()[0], { key: 'a' });
    fireEvent.keyDown(pows()[n0 - 1], { key: 'Enter' });
    expect(names().length).toBe(n0 + 1);
    expect(document.activeElement).toBe(names()[n0]);
  });

  it('shows branch lengths on demand and keeps them when filled', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[0]);
    const brs = () => ed().querySelectorAll<HTMLInputElement>('[aria-label="Отвод от коробки, м"]');
    expect(brs().length).toBe(0);
    expect(ed().querySelector('.apps.no-br')).not.toBeNull();
    click(ed(), /Ещё действия/);
    expect(ed().querySelector('[role="menu"]')).not.toBeNull();
    click(ed(), 'Указать отводы к точкам');
    expect(ed().querySelector('[role="menu"]')).toBeNull();
    expect(brs().length).toBeGreaterThan(0);
    click(ed(), /Ещё действия/);
    click(ed(), 'Скрыть отводы к точкам');
    expect(brs().length).toBe(0);
    click(ed(), /Ещё действия/);
    click(ed(), 'Указать отводы к точкам');
    change(brs()[0], '3');
    fireEvent.click(rows()[1]);
    expect(brs().length).toBe(0);
    fireEvent.click(rows()[0]);
    expect(brs().length).toBeGreaterThan(0);
    click(ed(), /Ещё действия/);
    expect(within(ed().querySelector('[role="menu"]') as HTMLElement).queryByText(/отводы к точкам/)).toBeNull();
  });
});

describe('board and list highlight', () => {
  it('marks the selected breaker and highlights on hover both ways', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[2]);
    const sel = document.querySelector('.rail button.dev.sel') as HTMLElement;
    expect(sel.getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('.bd-r.sel')).not.toBeNull();
    fireEvent.mouseEnter(rows()[1]);
    expect(rows()[1]).toHaveClass('hot');
    expect(document.querySelectorAll('.rail button.dev.hot').length).toBe(1);
    expect(document.querySelectorAll('.bd-r.hot').length).toBe(1);
    fireEvent.mouseLeave(rows()[1]);
    expect(document.querySelector('.hot')).toBeNull();
    const devs = document.querySelectorAll<HTMLElement>('.rail button.dev');
    fireEvent.mouseEnter(devs[0]);
    expect(rows()[0]).toHaveClass('hot');
    fireEvent.mouseLeave(devs[0]);
    fireEvent.mouseEnter(document.querySelectorAll<HTMLElement>('button.bd-b')[1]);
    expect(rows()[1]).toHaveClass('hot');
    fireEvent.mouseLeave(document.querySelectorAll<HTMLElement>('button.bd-b')[1]);
    expect(rows()[1]).not.toHaveClass('hot');
  });
});

describe('document package', () => {
  const openDocs = () => {
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Приёмка/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Документы' }));
    return screen.getByRole('list', { name: 'Документы комплекта' });
  };

  it('prints the chosen documents as one job and remembers the choice', () => {
    vi.useFakeTimers();
    render(<App />);
    const list = openDocs();
    const boxes = within(list).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.filter(b => b.checked).length).toBe(PACK_DEFAULT.length);
    fireEvent.click(boxes[3]);
    expect(JSON.parse(localStorage.getItem(PACK_KEY) as string)).toContain('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Печать комплекта · 6' }));
    expect(document.querySelectorAll('.printdoc').length).toBe(6);
    expect(document.querySelector('.printdoc.a3doc')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
    boxes.forEach(b => { if (b.checked) fireEvent.click(b); });
    expect((screen.getByRole('button', { name: 'Печать комплекта' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Печать схемы А3' }));
    expect(document.querySelectorAll('.printdoc').length).toBe(1);
  });

  it('lists the old wiring conclusion once surveyed and survives bad storage', () => {
    localStorage.setItem(PACK_KEY, '{bad');
    expect(loadPack()).toEqual(PACK_DEFAULT);
    localStorage.setItem(PACK_KEY, JSON.stringify(['old', 'zz', 'report']));
    expect(loadPack()).toEqual(['report', 'old']);
    const p = newProject({ cfg: defaultCfg(), lines: [mkLine('Свет', 'light', 5, 1, 1, [['Лампа', 100, 1]])], sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [{ ...p, old: { metal: 'al' } }] }));
    render(<App />);
    const list = openDocs();
    expect(within(list).getByText('Заключение по старой проводке')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Печать комплекта · 2' })).toBeTruthy();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    fireEvent.click(within(list).getAllByRole('checkbox')[1]);
    expect(screen.getByRole('button', { name: 'Печать комплекта · 3' })).toBeTruthy();
    set.mockRestore();
  });
});

describe('mobile touches', () => {
  it('hides the add button while scrolling down', () => {
    wide(false);
    render(<App />);
    const fab = document.querySelector('.addmenu.fab') as HTMLElement;
    const scroll = (y: number) => act(() => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    scroll(200);
    expect(fab).toHaveClass('hide');
    scroll(203);
    expect(fab).toHaveClass('hide');
    scroll(100);
    expect(fab).not.toHaveClass('hide');
    scroll(0);
  });

  it('closes a sheet with a swipe down on its header', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Тест"><p>x</p></Sheet>);
    const head = document.querySelector('.sheet-head') as HTMLElement;
    const panel = document.querySelector('.sheet-panel') as HTMLElement;
    fireEvent.touchStart(head, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(head, { touches: [{ clientY: 150 }] });
    expect(panel.style.transform).toBe('translateY(50px)');
    fireEvent.touchEnd(head);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.touchMove(head, { touches: [{ clientY: 300 }] });
    fireEvent.touchStart(head, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(head, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(head);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dlg('Тест')).toBeTruthy();
  });
});
