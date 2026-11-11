import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { App } from '../../ui/App';
import { DrawingA3 } from '../../ui/DrawingA3';
import { Sheet } from '../../ui/common';
import { useBackClose } from '../../ui/back';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { exportTables, toCsv } from '../../core/export';
import { emptyLib, libReducer, normLib } from '../../store/lib';
import { cur, init, reducer } from '../../store/reducer';
import type { Line } from '../../core/types';
import { dlg, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const tick = () => act(() => new Promise(r => setTimeout(r, 10)));

describe('back button', () => {
  it('closes the top sheet and leaves the history clean after closing by hand', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const Two = () => {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <>
          <Sheet open={a} onClose={() => setA(false)} title="Первый"><p>1</p></Sheet>
          <Sheet open={b} onClose={() => setB(false)} title="Второй"><p>2</p></Sheet>
        </>
      );
    };
    render(<Two />);
    expect(push).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.queryByText('2')?.closest('[hidden]')).toBeTruthy();
    await tick();
    expect(push).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Закрыть' })[0]);
    await tick();
    expect(back).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await tick();
    expect(push).toHaveBeenCalledTimes(2);
    push.mockRestore();
    back.mockRestore();
  });

  it('returns from the group card to the list on a phone', async () => {
    wide(false);
    vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    expect(document.getElementById('app')?.getAttribute('data-view')).toBe('edit');
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(document.getElementById('app')?.getAttribute('data-view')).toBe('groups');
    await tick();
    vi.restoreAllMocks();
  });

  it('keeps a layer hook inactive while closed', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const Off = () => { useBackClose(false, () => undefined); return null; };
    render(<Off />);
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });
});

describe('undo and redo buttons', () => {
  it('are gone from the phone card bar', () => {
    wide(false);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    const bar = document.querySelector('.ab-edit') as HTMLElement;
    expect(bar.querySelector('[aria-label="Отменить"]')).toBeNull();
    expect(bar.querySelector('[aria-label="Вернуть"]')).toBeNull();
  });
});

describe('bathroom RCD', () => {
  const lines = (): Line[] => [
    { ...mkLine('Розетка', 'socket', 5, [['Фен', 1500, 1]]), zone: 'Ванная', wet: true },
    { ...mkLine('Водонагреватель', 'power', 5, [['Бойлер', 2000, 1]]), zone: 'Ванная' },
    { ...mkLine('Стиральная', 'power', 5, [['Стиралка', 2200, 1]]), zone: 'Ванная' }
  ];
  it('puts only wet groups on a separate 10 mA RCD', () => {
    const a = calcAll(lines(), { ...defaultCfg(), prot: 'rcd' });
    expect(a.uzos.map(u => [u.zone, u.ma, u.groups.length])).toEqual([['Ванная (10 мА)', 10, 1], ['Ванная', 30, 2]]);
    expect(a.rows[0].r.ma).toBe(10);
    expect(a.rows[1].r.ma).toBe(30);
    expect(a.devs.filter(d => d.kind === 'mcb').map(d => d.zone)).toEqual(['Ванная (10 мА)', 'Ванная', 'Ванная']);
    const allWet = calcAll(lines().map(l => ({ ...l, wet: true })), { ...defaultCfg(), prot: 'rcd' });
    expect(allWet.uzos.map(u => [u.zone, u.ma])).toEqual([['Ванная · 1', 10], ['Ванная · 2', 10]]);
  });

  it('keeps 30 mA on socket groups above 32 A', () => {
    const big = mkLine('Розетки', 'socket', 5, [['Печь', 9000, 1]]);
    const r = calcAll([big], { ...defaultCfg(), prot: 'rcbo' }).rows[0].r;
    expect(r.ma).toBe(30);
    const pow = mkLine('Плита', 'power', 5, [['Плита', 9000, 1]]);
    expect(calcAll([pow], { ...defaultCfg(), prot: 'rcbo' }).rows[0].r.ma).toBe(30);
    expect(calcAll([big, { ...big, id: 'b2' }], { ...defaultCfg(), prot: 'rcd' }).uzos[0].ma).toBe(30);
  });
});

describe('templates keep floor heating and weak current', () => {
  it('saves and restores them', () => {
    const floor = [{ id: 'f', name: 'Ванная', use: 'bath' as const, sys: 'mat' as const, area: 3, wpm: 150 }];
    const weak = { ont: true, pts: [{ id: 'w', room: 'Зал', kind: 'lan' as const, n: 2, len: 10 }] };
    let l = libReducer(emptyLib(), { t: 'addTpl', name: 'С полом', cfg: defaultCfg(), lines: [mkLine('Свет', 'light', 5, [])], floor, weak });
    l = libReducer(l, { t: 'addTpl', name: 'Без', cfg: defaultCfg(), lines: [] });
    expect(l.templates[0].floor?.[0].area).toBe('3');
    expect(l.templates[0].weak?.pts[0].room).toBe('Зал');
    expect('floor' in l.templates[1]).toBe(false);
    const back = normLib(JSON.parse(JSON.stringify(l)));
    expect(back.templates[0].floor).toHaveLength(1);
    expect(back.templates[0].weak?.pts).toHaveLength(1);
    const t = back.templates[0];
    const p = newProject(defaultCfgProject(), 'x');
    let s = init({ cur: p.id, list: [p] });
    s = reducer(s, { t: 'addProject', content: { sample: false, cfg: t.cfg, lines: t.lines, floor: t.floor, weak: t.weak }, name: t.name });
    expect(cur(s).floor).toHaveLength(1);
    expect(cur(s).weak?.pts).toHaveLength(1);
  });
});

const defaultCfgProject = () => ({ sample: false, cfg: defaultCfg(), lines: [] as Line[] });

describe('CSV export', () => {
  it('contains materials, works and their totals', () => {
    const p = newProject({ sample: false, cfg: defaultCfg(), lines: [mkLine('Плита', 'power', 5, [['Плита', 5000, 1]])] }, 'Т');
    const csv = toCsv(...exportTables(calcAll(p.lines, p.cfg), {}, { panel: 100 }));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Работы');
    expect(csv.split('\r\n').filter(x => x === '').length).toBeGreaterThan(1);
  });
});

describe('A3 drawing with many groups', () => {
  it('splits the groups over several sheets with sheet numbers', () => {
    const many = Array.from({ length: 26 }, (_, i) => mkLine('Г' + i, 'socket', 5, [['Прибор', 500, 1]]));
    const p = newProject({ sample: false, cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: many }, 'Т');
    const { container } = render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    const svgs = container.querySelectorAll('svg.a3');
    expect(svgs).toHaveLength(2);
    expect(svgs[0].textContent).toContain('QF0');
    expect(svgs[0].textContent).toContain('Итого по щитку');
    expect(svgs[1].textContent).toContain('Продолжение, начало на листе 1');
    expect(svgs[1].textContent).not.toContain('Итого по щитку');
    expect(svgs[1].textContent).toContain('QFD21');
    expect(svgs[1].textContent).toContain('QFD26');
  });

  it('keeps a single sheet for a small board and an empty project', () => {
    const p = newProject({ sample: false, cfg: { ...defaultCfg(), prot: 'rcd', vr: 'on', spd: 'on' }, lines: [{ ...mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), zone: 'Зал' }] }, 'Т');
    const { container, unmount } = render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    expect(container.querySelectorAll('svg.a3')).toHaveLength(1);
    expect(container.textContent).toContain('KV1');
    unmount();
    const e = newProject({ sample: false, cfg: defaultCfg(), lines: [] }, 'Т');
    const r2 = render(<DrawingA3 p={e} a={calcAll(e.lines, e.cfg)} company="" />);
    expect(r2.container.querySelectorAll('svg.a3')).toHaveLength(1);
  });

  it('opens the drawing preview in the report', () => {
    wide(true);
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Отчёт/ })[0]);
    expect(dlg('Отчёт и спецификация').querySelectorAll('svg.a3').length).toBeGreaterThan(0);
  });
});
