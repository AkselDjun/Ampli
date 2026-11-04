import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTS, actDate, actsOf, actsSummary, cableRuns, hiddenMaterials, hiddenWorks, normActs, ruDate, warrantyText } from '../../core/acts';
import { calcAll } from '../../core/calc';
import { newProject, normProject, sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { cur, init, reducer } from '../../store/reducer';
import type { Cfg, Line } from '../../core/types';

const lines = (): Line[] => [
  mkLine('Свет', 'light', 10, null, null, [['Люстра', 200, 2]]),
  mkLine('Розетки', 'socket', 12.4, null, null, [['ТВ', 1500, 1]]),
  mkLine('Кухня', 'socket', 8, null, null, [['Чайник', 2000, 1]]),
  mkLine('Пусто', 'socket', 5, null, null, [])
];
const calc = (ls: Line[], cfg: Partial<Cfg> = {}) => calcAll(ls, { ...defaultCfg(), ...cfg });

describe('acts data', () => {
  it('normalises dates and warranty', () => {
    expect(normActs(null)).toEqual(DEFAULT_ACTS);
    expect(normActs({ start: '2026-10-01', end: '1.10.2026', warranty: '36' })).toEqual({ start: '2026-10-01', end: '', warranty: 36 });
    expect(normActs({ warranty: '' }).warranty).toBe(0);
    expect(normActs({ warranty: 'abc' }).warranty).toBe(0);
    expect(normActs({ warranty: 500 }).warranty).toBe(120);
    expect(normActs({ warranty: -3 }).warranty).toBe(0);
    expect(normActs({ warranty: 6.6 }).warranty).toBe(7);
    expect(actsOf(undefined)).toBe(DEFAULT_ACTS);
  });

  it('formats dates', () => {
    expect(ruDate('2026-10-30')).toBe('30.10.2026');
    expect(ruDate('')).toBe('');
    expect(actDate({ start: '', end: '2026-10-30', warranty: 0 })).toBe('30.10.2026');
    expect(actDate(undefined, new Date(2026, 0, 2).getTime())).toBe(new Date(2026, 0, 2).toLocaleDateString('ru-RU'));
  });

  it('declines months', () => {
    expect([1, 2, 5, 11, 12, 21, 24, 112].map(warrantyText)).toEqual(['1 месяц', '2 месяца', '5 месяцев', '11 месяцев', '12 месяцев', '21 месяц', '24 месяца', '112 месяцев']);
  });

  it('summarises dates and warranty', () => {
    expect(actsSummary(undefined)).toBe('гарантия 12 месяцев');
    expect(actsSummary({ start: '2026-10-01', end: '', warranty: 0 })).toBe('01.10.2026 – …');
    expect(actsSummary({ start: '', end: '2026-10-05', warranty: 24 })).toBe('… – 05.10.2026, гарантия 24 месяца');
  });

  it('is kept by the project and edited by the reducer', () => {
    const p = sampleProject();
    expect(p.acts).toBeUndefined();
    expect(normProject({ ...p, acts: { start: '2026-01-02', warranty: 3 } })?.acts).toEqual({ start: '2026-01-02', end: '', warranty: 3 });
    let s = init({ cur: p.id, list: [p] });
    s = reducer(s, { t: 'acts', field: 'end', value: '2026-02-03' });
    s = reducer(s, { t: 'acts', field: 'warranty', value: '18' });
    expect(cur(s).acts).toEqual({ start: '', end: '2026-02-03', warranty: 18 });
  });
});

describe('hidden works', () => {
  it('groups cables by brand with lengths and group numbers', () => {
    const a = calc(lines());
    const runs = cableRuns(a);
    expect(runs.map(r => r.groups)).toEqual([['Г1'], ['Г2', 'Г3']]);
    expect(runs[1].m).toBe(Math.ceil(a.rows[1].r.cable + a.rows[2].r.cable));
    const w = hiddenWorks(a);
    expect(w[0]).toMatch(/^прокладка кабеля ВВГнг\(А\)-LS 3×1,5 в штробах, \d+ м \(Г1\)$/);
    expect(w.some(x => x.includes('монтажных коробок') && x.endsWith('4 шт'))).toBe(true);
    expect(hiddenMaterials(a)[0]).toMatch(/^кабель ВВГнг\(А\)-LS 3×1,5, \d+ м$/);
  });

  it('describes open wiring, distribution boxes and missing lengths', () => {
    const ls = lines();
    ls[0].apps[0].br = 2;
    ls[1].len = 0;
    const a = calc(ls, { method: 'open' });
    const w = hiddenWorks(a);
    expect(w[0]).toContain('по основанию');
    expect(w.some(x => x.startsWith('установка распределительных коробок'))).toBe(true);
    expect(hiddenMaterials(a).some(x => x.startsWith('коробки распределительные'))).toBe(true);
  });

  it('is empty without groups', () => {
    const a = calc([]);
    expect(hiddenWorks(a)).toEqual([]);
    expect(hiddenMaterials(a)).toEqual([]);
    expect(newProject({ cfg: defaultCfg(), lines: [], sample: false }, 'x').acts).toBeUndefined();
  });
});
