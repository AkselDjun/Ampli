import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PanelPane } from '../../ui/Side';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { cur, init, reducer } from '../../store/reducer';
import { sampleProject } from '../../core/project';
import type { Line } from '../../core/types';

const lines = (): Line[] => [
  mkLine('Свет', 'light', 10, 1, 1, [['Лампа', 100, 1]]),
  mkLine('Розетки', 'socket', 10, 1, 1, [['Чайник', 1500, 1]]),
  mkLine('Плита', 'power', 10, 1, 1, [['Плита', 5000, 1]])
];

const mods = () => Array.from(document.querySelectorAll<HTMLButtonElement>('button.dev'));

describe('Board', () => {
  it('renders interactive modules with status, phase and line ids', () => {
    const ls = lines();
    const a = calcAll(ls, { ...defaultCfg(), supply: 3 });
    render(<PanelPane a={a} onPick={() => undefined} onMove={() => undefined} />);
    expect(mods()).toHaveLength(3);
    expect(document.querySelector('.dev-in')).not.toBeNull();
    expect(mods()[0].className).toMatch(/st-(ok|warn|bad)/);
    expect(mods().every(m => m.getAttribute('data-ph'))).toBe(true);
    expect(a.devs.filter(d => d.lid).map(d => d.lid)).toEqual(ls.map(l => l.id));
  });
  it('picks a group on click', () => {
    const ls = lines();
    const a = calcAll(ls, defaultCfg());
    const onPick = vi.fn();
    render(<PanelPane a={a} onPick={onPick} />);
    fireEvent.click(mods()[1]);
    expect(onPick).toHaveBeenCalledWith(ls[1].id);
    expect(mods()[0].draggable).toBe(false);
  });
  it('moves a group by drag and drop', () => {
    const ls = lines();
    const a = calcAll(ls, defaultCfg());
    const onMove = vi.fn();
    render(<PanelPane a={a} onMove={onMove} />);
    const m = mods();
    const dt = { effectAllowed: '', setData: () => undefined };
    fireEvent.dragStart(m[0], { dataTransfer: dt });
    expect(mods()[0].className).toContain('drag');
    fireEvent.dragOver(m[2], { dataTransfer: dt });
    expect(mods()[2].className).toContain('over');
    fireEvent.drop(m[2], { dataTransfer: dt });
    expect(onMove).toHaveBeenCalledWith(ls[0].id, ls[2].id);
    expect(mods()[0].className).not.toContain('drag');
    fireEvent.dragStart(m[1], { dataTransfer: dt });
    fireEvent.drop(m[1], { dataTransfer: dt });
    fireEvent.dragEnd(m[1]);
    expect(onMove).toHaveBeenCalledTimes(1);
    fireEvent.dragOver(m[1], { dataTransfer: dt });
    expect(mods()[1].className).not.toContain('over');
  });
  it('moves a group with Alt and arrows', () => {
    const ls = lines();
    const a = calcAll(ls, defaultCfg());
    const onMove = vi.fn();
    render(<PanelPane a={a} onMove={onMove} />);
    const m = mods();
    fireEvent.keyDown(m[1], { key: 'ArrowRight' });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.keyDown(m[1], { key: 'ArrowRight', altKey: true });
    expect(onMove).toHaveBeenLastCalledWith(ls[1].id, ls[2].id);
    fireEvent.keyDown(m[1], { key: 'ArrowLeft', altKey: true });
    expect(onMove).toHaveBeenLastCalledWith(ls[1].id, ls[0].id);
    fireEvent.keyDown(m[0], { key: 'ArrowLeft', altKey: true });
    fireEvent.keyDown(m[2], { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(m[1], { key: 'x', altKey: true });
    expect(onMove).toHaveBeenCalledTimes(2);
    const off = render(<PanelPane a={a} />);
    fireEvent.keyDown(off.container.querySelector('button.dev') as Element, { key: 'ArrowRight', altKey: true });
    expect(onMove).toHaveBeenCalledTimes(2);
  });
});

describe('moveLine', () => {
  const start = () => {
    const p = sampleProject();
    return init({ cur: p.id, list: [p] });
  };
  it('moves a line to the position of another one', () => {
    const s = start();
    const ids = cur(s).lines.map(l => l.id);
    const n = reducer(s, { t: 'moveLine', id: ids[0], to: ids[2] });
    expect(cur(n).lines.map(l => l.id)).toEqual([ids[1], ids[2], ids[0], ...ids.slice(3)]);
    const back = reducer(n, { t: 'moveLine', id: ids[0], to: ids[1] });
    expect(cur(back).lines[0].id).toBe(ids[0]);
  });
  it('ignores unknown ids and moves onto itself', () => {
    const s = start();
    const ids = cur(s).lines.map(l => l.id);
    expect(reducer(s, { t: 'moveLine', id: 'x', to: ids[1] })).toBe(s);
    expect(reducer(s, { t: 'moveLine', id: ids[0], to: 'x' })).toBe(s);
    expect(reducer(s, { t: 'moveLine', id: ids[1], to: ids[1] })).toBe(s);
  });
});
