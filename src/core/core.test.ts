import { describe, expect, it } from 'vitest';
import { calcAll, balanceLines } from './calc';
import { sample, tplLines } from './templates';
import { buildSpec } from './spec';

describe('sample apartment', () => {
  const s = sample();
  const a = calcAll(s.lines, s.cfg);
  it('picks breakers and cables', () => {
    expect(a.rows.map(x => [x.r.In, x.r.S])).toEqual([[10, 1.5], [16, 2.5], [16, 2.5], [25, 4], [16, 2.5], [10, 2.5], [10, 2.5]]);
    expect([a.inIn, a.inS, a.size]).toEqual([63, 10, 24]);
    expect(a.rows.every(x => x.r.In !== null && x.r.S !== null)).toBe(true);
  });
  it('limits voltage drop by type', () => {
    expect(a.rows[0].r.limit).toBe(3);
    expect(a.rows[1].r.limit).toBe(5);
  });
  it('builds a spec with an input breaker', () => {
    const items = buildSpec(a);
    expect(items.some(i => i.name.startsWith('Вводной автомат'))).toBe(true);
  });
  it('balances phases without losing lines', () => {
    const cfg = { ...s.cfg, supply: 3 };
    const b = balanceLines(s.lines, cfg);
    expect(b.length).toBe(s.lines.length);
    const c3 = calcAll(b, cfg);
    expect(c3.phases).not.toBeNull();
  });
  it('templates respect electric stove flag', () => {
    expect(tplLines('k1', false).some(l => l.name === 'Плита и духовка')).toBe(false);
    expect(tplLines('k1', true).some(l => l.name === 'Плита и духовка')).toBe(true);
  });
});

import { init, reducer, cur } from '../store/reducer';
import { sampleProject } from './project';

describe('reducer', () => {
  const base = () => {
    const pr = sampleProject();
    return init({ list: [pr], cur: pr.id });
  };
  it('edits a line field and clears the sample flag', () => {
    const s0 = base();
    const s1 = reducer(s0, { t: 'lineField', field: 'len', value: 40 });
    expect(cur(s1).sample).toBe(false);
    expect(cur(s1).lines[0].len).toBe(40);
    expect(cur(s0).lines[0].len).toBe(22);
  });
  it('adds and deletes lines', () => {
    const s1 = reducer(base(), { t: 'addLine', type: 'power' });
    expect(cur(s1).lines.length).toBe(8);
    const s2 = reducer(s1, { t: 'delLine' });
    expect(cur(s2).lines.length).toBe(7);
  });
  it('keeps one project after deleting the last', () => {
    const s0 = base();
    const s1 = reducer(s0, { t: 'delProject', id: s0.cur });
    expect(s1.list.length).toBe(1);
    expect(s1.cur).toBe(s1.list[0].id);
  });
});
