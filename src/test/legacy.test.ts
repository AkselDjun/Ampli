import { describe, expect, it } from 'vitest';
import { calcAll, balanceLines } from '../core/calc';
import { sample, tplLines } from '../core/templates';
import { buildSpec } from '../core/spec';

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
import { sampleProject } from '../core/project';

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

import { calcLine, cfgN, shortCircuit, calcAll as calcAll2 } from '../core/calc';
import { mkLine, defaultCfg } from '../core/templates';

describe('norm checks', () => {
  const cfg = cfgN(defaultCfg());
  it('uses 10 mA RCD for wet rooms', () => {
    const l = { ...mkLine('Ванная', 'socket', 10, null, null, [['Фен', 1800, 1]]), wet: true };
    expect(calcLine(l, cfg).ma).toBe(10);
  });
  it('grows the section when the short-circuit current is too low', () => {
    const l = mkLine('Длинная', 'socket', 60, null, null, [['Чайник', 2200, 1]]);
    const r = calcLine(l, cfg);
    expect(r.ik).toBeGreaterThanOrEqual(r.ikNeed);
    expect(r.S as number).toBeGreaterThan(2.5);
  });
  it('flags a line that cannot trip even at 35 mm2', () => {
    const l = mkLine('Очень длинная', 'power', 500, null, null, [['Плита', 7000, 1]]);
    const r = calcLine(l, cfg);
    expect(r.status).toBe('bad');
  });
  it('lowers the short-circuit current with a weaker source', () => {
    expect(shortCircuit(2.5, 20, 1)).toBeLessThan(shortCircuit(2.5, 20, 0.2));
  });
  it('keeps the input two steps above the largest group', () => {
    const lines = [mkLine('Свет', 'light', 10, null, null, [['Лампа', 60, 1]])];
    const a = calcAll2(lines, defaultCfg());
    expect(a.inStep).toBeGreaterThanOrEqual(2);
  });
  it('suggests a three-phase input above 12 kW', () => {
    const lines = [mkLine('Мощная', 'power', 5, 1, 1, [['Печь', 9000, 1], ['Бойлер', 5000, 1]])];
    const a = calcAll2(lines, { ...defaultCfg(), ko: 1 });
    expect(a.hint3).toBe(true);
    const b = calcAll2(lines, { ...defaultCfg(), ko: 1, supply: 3 });
    expect(b.hint3).toBe(false);
  });
});

import { hreducer, initH } from '../store/history';

describe('history', () => {
  const start = () => {
    const pr = sampleProject();
    return initH(init({ list: [pr], cur: pr.id }));
  };
  it('undoes and redoes edits and merges fast typing', () => {
    let h = start();
    h = hreducer(h, { t: 'lineField', field: 'len', value: 30 });
    h = hreducer(h, { t: 'lineField', field: 'len', value: 31 });
    expect(h.past.length).toBe(1);
    h = hreducer(h, { t: 'addLine', type: 'light' });
    expect(h.past.length).toBe(2);
    h = hreducer(h, { t: 'undo' });
    expect(cur(h.now).lines.length).toBe(7);
    h = hreducer(h, { t: 'undo' });
    expect(cur(h.now).lines[0].len).toBe(22);
    h = hreducer(h, { t: 'redo' });
    expect(cur(h.now).lines[0].len).toBe(31);
  });
  it('restores a deleted project', () => {
    let h = start();
    const id = h.now.cur;
    h = hreducer(h, { t: 'delProject', id });
    expect(h.now.cur).not.toBe(id);
    h = hreducer(h, { t: 'undo' });
    expect(h.now.cur).toBe(id);
  });
  it('does not record selection changes', () => {
    let h = start();
    h = hreducer(h, { t: 'select', id: cur(h.now).lines[1].id });
    expect(h.past.length).toBe(0);
  });
});

describe('voltage drop limits', () => {
  const l = mkLine('Свет', 'light', 20, null, null, [['Лампа', 100, 1]]);
  it('subtracts the riser drop from the limit', () => {
    const a = calcLine(l, cfgN(defaultCfg()));
    const b = calcLine(l, cfgN({ ...defaultCfg(), feeder: 1 }));
    expect(a.limit).toBe(3);
    expect(b.limit).toBe(2);
  });
  it('caps the limit at 4 percent when chosen', () => {
    const p = mkLine('Печь', 'power', 20, null, null, [['Печь', 3000, 1]]);
    expect(calcLine(p, cfgN(defaultCfg())).limit).toBe(5);
    expect(calcLine(p, cfgN({ ...defaultCfg(), drop: 4 })).limit).toBe(4);
  });
});
