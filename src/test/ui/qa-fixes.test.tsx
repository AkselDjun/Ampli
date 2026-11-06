import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { Boundary } from '../../ui/Boundary';
import { Sheet, Stepper } from '../../ui/common';
import { PanelPane } from '../../ui/Side';
import { calcAll } from '../../core/calc';
import { newProject, sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY, resetProjectDb } from '../../store/storage';
import { currentToast } from '../../ui/toast';
import { btn, byLabel, change, click, dlg, toastText, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const ed = () => document.querySelector('.col-edit') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));

describe('toasts without undo', () => {
  it('report a removed group and appliance with no undo offer', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[4]);
    const n = stored().list[0].lines.length;
    click(ed(), 'Удалить группу');
    click(ed(), 'Нажмите ещё раз, чтобы удалить');
    expect(toastText()).toBe('Группа удалена');
    expect(currentToast()?.run).toBeUndefined();
    expect(stored().list[0].lines.length).toBe(n - 1);
    fireEvent.click(rows()[0]);
    const before = stored().list[0].lines[0].apps.length;
    fireEvent.click(within(ed()).getAllByRole('button', { name: 'Удалить прибор' })[0]);
    expect(toastText()).toMatch(/^Прибор удалён: /);
    expect(currentToast()?.run).toBeUndefined();
    expect(stored().list[0].lines[0].apps.length).toBe(before - 1);
  });
});

describe('numbers with a comma', () => {
  it('keeps the decimal comma in group length', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[0]);
    const len = byLabel(ed(), 'Длина линии, м');
    expect(len.type).toBe('text');
    change(len, '2,5');
    expect(stored().list[0].lines[0].len).toBe('2,5');
  });

  it('clamps a stepper value on blur', () => {
    const onChange = vi.fn();
    render(<Stepper value="600" d={1} min={0} max={500} label="Длина" onChange={onChange} onStep={() => undefined} />);
    fireEvent.blur(screen.getByLabelText('Длина'));
    expect(onChange).toHaveBeenCalledWith('500');
    onChange.mockClear();
    render(<Stepper value="" d={1} min={0} max={500} label="Пусто" onChange={onChange} onStep={() => undefined} />);
    fireEvent.blur(screen.getByLabelText('Пусто'));
    render(<Stepper value="12" d={1} label="Без границ" onChange={onChange} onStep={() => undefined} />);
    fireEvent.blur(screen.getByLabelText('Без границ'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('measurements of zero', () => {
  it('treats zero insulation as a failed measurement', () => {
    const p = sampleProject();
    const lines = p.lines.map((l, i) => (i === 0 ? { ...l, meas: { ins: '0', leak: '0' } } : l));
    const a = calcAll(lines, p.cfg);
    expect(a.rows[0].r.insMeas).toBe(0);
    expect(a.rows[0].r.leakMeas).toBe(0);
    expect(a.rows[0].r.status).toBe('bad');
  });
});

describe('crash screen', () => {
  it('shows recovery actions instead of a blank page', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Bad = () => { throw new Error('x'); };
    render(<Boundary><Bad /></Boundary>);
    expect(screen.getByRole('alert').textContent).toContain('Что-то пошло не так');
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    localStorage.setItem(KEY, '{"cur":"a"}');
    localStorage.setItem('ampli-lib-v1', 'not json');
    fireEvent.click(screen.getByRole('button', { name: 'Скачать резервную копию' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    create.mockRestore();
    err.mockRestore();
  });
});

describe('storage and links', () => {
  it('warns once when changes cannot be saved', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    resetProjectDb();
    render(<App />);
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.click(document.querySelector('.col-list .row') as HTMLElement);
    change(byLabel(document, 'Название группы'), 'А');
    await waitFor(() => expect(toastText()).toContain('закончилось место'));
    set.mockRestore();
  });

  it('keeps saving the current project when the browser has no IndexedDB', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    resetProjectDb();
    render(<App />);
    fireEvent.click(document.querySelector('.col-list .row') as HTMLElement);
    change(byLabel(document, 'Название группы'), 'Без базы');
    await waitFor(() => expect(stored().list[0].lines[0].name).toBe('Без базы'));
    expect(toastText()).not.toContain('закончилось место');
  });

  it('reports a broken shared link and clears it', () => {
    window.location.hash = '#p=v1.garbage';
    render(<App />);
    expect(toastText()).toContain('Ссылка повреждена');
    expect(window.location.hash).toBe('');
  });
});

describe('stacked sheets', () => {
  it('closes only the top sheet on Escape', () => {
    const a = vi.fn();
    const b = vi.fn();
    render(<><Sheet open onClose={a} title="Нижний"><p>1</p></Sheet><Sheet open onClose={b} title="Верхний"><p>2</p></Sheet></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });
});

describe('keyboard on the list and the board', () => {
  it('keeps focus on the next row after Delete', async () => {
    wide(true);
    render(<App />);
    const second = rows()[1].querySelector('.row-name')?.textContent;
    rows()[0].focus();
    expect(document.activeElement).toBe(rows()[0]);
    fireEvent.keyDown(rows()[0], { key: 'Delete' });
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect((document.activeElement as HTMLElement).querySelector('.row-name')?.textContent).toBe(second);
  });

  it('keeps focus on a module after moving it with Alt and an arrow', async () => {
    const p = newProject({ sample: false, cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: [mkLine('А', 'light', 5, 1, 1, [['x', 100, 1]]), mkLine('Б', 'light', 5, 1, 1, [['x', 100, 1]])] }, 'Т');
    const onMove = vi.fn();
    render(<PanelPane a={calcAll(p.lines, p.cfg)} onMove={onMove} />);
    const mod = document.querySelector('.rail [data-lid="' + p.lines[0].id + '"]') as HTMLElement;
    mod.focus();
    fireEvent.keyDown(mod, { key: 'ArrowRight', altKey: true });
    expect(onMove).toHaveBeenCalledWith(p.lines[0].id, p.lines[1].id);
    await act(() => new Promise(r => requestAnimationFrame(() => r(undefined))));
    expect(document.activeElement).toBe(mod);
  });
});

describe('documents', () => {
  it('blocks printing an empty project and warns about failed measurements in the acceptance act', () => {
    const empty = newProject({ sample: false, cfg: defaultCfg(), lines: [] }, 'Пусто');
    localStorage.setItem(KEY, JSON.stringify({ cur: empty.id, list: [empty] }));
    const { unmount } = render(<App />);
    click(document.querySelector('nav.tabs') as HTMLElement, /Приёмка/);
    const d = dlg('Монтаж и приёмка');
    fireEvent.click(within(d).getByRole('tab', { name: 'Документы', hidden: true }));
    expect((btn(d, /\|Печать комплекта/) as HTMLButtonElement).disabled).toBe(true);
    expect(d.textContent).toContain('В проекте нет групп');
    unmount();
    const p = sampleProject();
    const bad = { ...p, lines: p.lines.map((l, i) => (i === 0 ? { ...l, meas: { ins: '0' } } : l)) };
    localStorage.setItem(KEY, JSON.stringify({ cur: bad.id, list: [bad] }));
    render(<App />);
    click(document.querySelector('nav.tabs') as HTMLElement, /Приёмка/);
    const d2 = dlg('Монтаж и приёмка');
    fireEvent.click(within(d2).getByRole('tab', { name: 'Документы', hidden: true }));
    expect(d2.textContent).toContain('в протоколе 1 группа не соответствует');
  });
});

describe('weak current points', () => {
  it('fixes a zero count on blur and removes a point', () => {
    render(<App />);
    fireEvent.click(within(document.querySelector('.proj-box') as HTMLElement).getByRole('button', { name: /^Слаботочка/ }));
    const d = dlg('Слаботочка');
    click(d, '+ Интернет');
    const row = d.querySelector('.wk-row[role="listitem"]') as HTMLElement;
    const n = byLabel(row, 'Количество');
    change(n, '0');
    fireEvent.blur(n);
    expect(stored().list[0].weak.pts[0].n).toBe('1');
    click(row, 'Удалить точку');
    expect(toastText()).toContain('Точка удалена');
    expect(currentToast()?.run).toBeUndefined();
    expect(stored().list[0].weak?.pts ?? []).toHaveLength(0);
  });
});
