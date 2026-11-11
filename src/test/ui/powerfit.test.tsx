import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PowerFitBlock } from '../../ui/PowerFit';
import { defaultCfg, mkLine } from '../../core/templates';
import { newProject } from '../../core/project';
import { cur, init, reducer } from '../../store/reducer';
import type { Line, Project } from '../../core/types';

const stove = (o: Partial<Line> = {}): Line => ({ ...mkLine('Плита', 'power', 8, [['Электроплита', 7000, 1]]), ...o });
const boiler = (o: Partial<Line> = {}): Line => ({ ...mkLine('Бойлер', 'power', 6, [['Водонагреватель', 2000, 1]]), ...o });
const proj = (lines: Line[], alloc = 6): Project => newProject({ sample: false, cfg: { ...defaultCfg(), alloc }, lines }, 'Дом');

describe('Power fit block', () => {
  it('is hidden when the load fits and nothing is marked', () => {
    const { container } = render(<PowerFitBlock p={proj([boiler()], 15)} dispatch={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('applies the priority relay and a new allocation', () => {
    const p = proj([stove(), boiler()]);
    const dispatch = vi.fn();
    render(<PowerFitBlock p={p} dispatch={dispatch} />);
    expect(screen.getByText('Уложиться в выделенную мощность')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Применить' })[0]);
    expect(dispatch).toHaveBeenCalledWith({ t: 'prio', set: { [p.lines[0].id]: 'p', [p.lines[1].id]: 's' } });
    const ask = screen.getByRole('button', { name: /^Указать/ });
    fireEvent.click(ask);
    expect(dispatch).toHaveBeenLastCalledWith({ t: 'cfg', field: 'alloc', value: expect.any(Number) });
  });

  it('shows the current relay and removes it', () => {
    const p = proj([stove({ prio: 'p' }), boiler({ prio: 's' })], 15);
    const dispatch = vi.fn();
    render(<PowerFitBlock p={p} dispatch={dispatch} />);
    expect(screen.getByText(/приоритет у «Плита»; отключаются «Бойлер»/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Убрать реле приоритета' }));
    expect(dispatch).toHaveBeenCalledWith({ t: 'prio', set: { [p.lines[0].id]: '', [p.lines[1].id]: '' } });
  });
});

describe('Priority marks in the store', () => {
  it('sets and clears marks by line id', () => {
    const p = proj([stove(), boiler()]);
    let s = init({ list: [p], cur: p.id });
    s = reducer(s, { t: 'prio', set: { [p.lines[0].id]: 'p', [p.lines[1].id]: 's' } });
    expect(cur(s).lines.map(l => l.prio)).toEqual(['p', 's']);
    s = reducer(s, { t: 'prio', set: { [p.lines[1].id]: '' } });
    expect(cur(s).lines.map(l => l.prio)).toEqual(['p', undefined]);
    expect('prio' in cur(s).lines[1]).toBe(false);
  });
});

describe('Power fit block with an EV charger', () => {
  it('limits the charging current first', () => {
    const p = proj([stove(), mkLine('Зарядка', 'power', 20, [['Зарядка электромобиля', 7400, 1]])], 9);
    const dispatch = vi.fn();
    render(<PowerFitBlock p={p} dispatch={dispatch} />);
    expect(screen.getByText('Ограничить ток зарядки')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Применить' })[0]);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ t: 'appPower', line: p.lines[1].id, app: p.lines[1].apps[0].id }));
  });
});
