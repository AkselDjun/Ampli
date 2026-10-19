import { describe, expect, it } from 'vitest';
import { cur, init, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { defaultCfg, mkLine } from '../../core/templates';
import { newProject } from '../../core/project';
import type { Line } from '../../core/types';

const stateWith = (lines: Line[], supply = 1): State => {
  const p = newProject({ cfg: { ...defaultCfg(), supply }, lines, sample: false }, 'T');
  return init({ cur: p.id, list: [p] });
};
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);

describe('splitLine', () => {
  it('largest moves the biggest appliance into a new power line after the source', () => {
    const l = mkLine('Розетки', 'socket', 12, null, null, [['Чайник', 2000, 1], ['Духовка', 3500, 1], ['Лампа', 40, 1]]);
    const tail = mkLine('Хвост', 'light', 5, null, null, [['x', 10, 1]]);
    const s0 = stateWith([l, tail]);
    const [src0, tail0] = cur(s0).lines;
    const s = run(s0, { t: 'splitLine', mode: 'largest' });
    const lines = cur(s).lines;
    expect(lines).toHaveLength(3);
    expect(lines[0].apps.map(a => a.name)).toEqual(['Чайник', 'Лампа']);
    expect(lines[1].name).toBe('Духовка');
    expect(lines[1].type).toBe('power');
    expect(lines[1].len).toBe(12);
    expect(lines[1].apps[0].id).not.toBe(src0.apps[1].id);
    expect(lines[2].id).toBe(tail0.id);
    expect(s.sel).toBe(src0.id);
    expect(cur(s).sample).toBe(false);
  });
  it('largest falls back to a default name for an unnamed appliance and copies wet', () => {
    const l = mkLine('Розетки', 'socket', 12, null, null, [['', 3500, 1], ['b', 100, 1]]);
    l.wet = true;
    const s = run(stateWith([l]), { t: 'splitLine', mode: 'largest' });
    expect(cur(s).lines[1].name).toBe('Мощный прибор');
    expect(cur(s).lines[1].wet).toBe(true);
  });
  it('half balances appliances into a second line named with (2)', () => {
    const l = mkLine('Кухня', 'socket', 8, null, null, [['a', 1000, 1], ['b', 900, 1], ['c', 200, 1]]);
    const s = run(stateWith([l]), { t: 'splitLine', mode: 'half' });
    const lines = cur(s).lines;
    expect(lines.map(x => x.name)).toEqual(['Кухня', 'Кухня (2)']);
    expect(lines[1].type).toBe('socket');
    expect(lines[0].apps.map(a => a.name)).toEqual(['a']);
    expect(lines[1].apps.map(a => a.name)).toEqual(['b', 'c']);
  });
  it('half uses a default name for an unnamed line and splits one appliance count', () => {
    const l = mkLine('', 'power', 8, null, null, [['Лампа', 100, 5]]);
    const s = run(stateWith([l]), { t: 'splitLine', mode: 'half' });
    const lines = cur(s).lines;
    expect(lines[1].name).toBe('Без названия (2)');
    expect(lines[0].apps[0].n).toBe(3);
    expect(lines[1].apps[0].n).toBe(2);
  });
  it('is a no-op without a selection', () => {
    const l = mkLine('A', 'socket', 8, null, null, [['a', 1000, 1], ['b', 900, 1]]);
    const s0 = { ...stateWith([l]), sel: null };
    expect(reducer(s0, { t: 'splitLine', mode: 'half' })).toBe(s0);
  });
  it('is a no-op when nothing can be moved', () => {
    const l = mkLine('A', 'socket', 8, null, null, [['a', 1000, 1]]);
    const s0 = stateWith([l]);
    expect(reducer(s0, { t: 'splitLine', mode: 'half' })).toBe(s0);
    expect(reducer(s0, { t: 'splitLine', mode: 'largest' })).toBe(s0);
  });
  it('rebalances phases on a three-phase supply', () => {
    const l = mkLine('A', 'socket', 8, null, null, [['a', 1000, 1], ['b', 900, 1]], 'L1');
    const s = run(stateWith([l], 3), { t: 'splitLine', mode: 'half' });
    const phases = cur(s).lines.map(x => x.phase);
    expect(new Set(phases).size).toBe(2);
  });
  it('keeps phases untouched on a single-phase supply', () => {
    const l = mkLine('A', 'socket', 8, null, null, [['a', 1000, 1], ['b', 900, 1]], 'L2');
    const s = run(stateWith([l], 1), { t: 'splitLine', mode: 'half' });
    expect(cur(s).lines.map(x => x.phase)).toEqual(['L2', 'L2']);
  });
});
