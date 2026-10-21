import { describe, expect, it } from 'vitest';
import { WORKS, autoQty, grandTotal, isWorkKey, laborEstimate, normWork } from '../../core/labor';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { normProject, sampleProject } from '../../core/project';
import { ESTIMATE_PREFIX, estimateUrl, packEstimate, packProject, readEstimateHash, unpackEstimate, unpackProject } from '../../core/share';
import { exportTables, laborTable } from '../../core/export';
import { emptyLib, libReducer, normLib } from '../../store/lib';
import { cur, init, reducer } from '../../store/reducer';

const lines = () => [
  mkLine('Свет', 'light', 20, 1, 1, [['Люстра', 100, 2], ['Бра', 40, 1]]),
  mkLine('Розетки', 'socket', 15, 1, 1, [['Чайник', 2000, 1], ['Пусто', 0, 3]]),
  mkLine('Плита', 'power', 8, 1, 1, [['Плита', 6000, 1]])
];

describe('labour quantities', () => {
  it('derives quantities from the project', () => {
    const a = calcAll(lines(), defaultCfg());
    const q = autoQty(a);
    expect(q.panel).toBe(1);
    expect(q.module).toBe(a.modSum);
    expect(q.cable).toBe(Math.ceil(43 * 1.1));
    expect(q.chase).toBe(q.cable);
    expect(q.light).toBe(3);
    expect(q.socket).toBe(1);
    expect(q.power).toBe(1);
    expect(q.switch).toBe(0);
    expect(autoQty(calcAll(lines(), { ...defaultCfg(), method: 'open' })).chase).toBe(0);
    const empty = autoQty(calcAll([], defaultCfg()));
    expect(empty.panel).toBe(0);
    expect(empty.module).toBe(0);
  });
  it('prices manual and automatic quantities', () => {
    const a = calcAll(lines(), defaultCfg());
    const none = laborEstimate(a, undefined, {});
    expect(none.priced).toBe(false);
    expect(none.total).toBe(0);
    const le = laborEstimate(a, { switch: 4, light: 0 }, { switch: 10, light: 15, socket: 12.5 });
    const row = (k: string) => le.rows.find(r => r.def.key === k)!;
    expect(row('switch')).toMatchObject({ qty: 4, manual: true, sum: 40 });
    expect(row('light')).toMatchObject({ qty: 0, auto: 3, sum: null });
    expect(row('socket').sum).toBe(12.5);
    expect(le.total).toBe(52.5);
    expect(le.priced).toBe(true);
    expect(grandTotal(100.1, 52.5)).toBe(152.6);
    expect(WORKS).toHaveLength(8);
  });
  it('normalises stored quantities', () => {
    expect(normWork(null)).toEqual({});
    expect(normWork({ switch: '3,5', bad: 2, cable: -1, light: 'x' })).toEqual({ switch: 3.5 });
    expect(isWorkKey('module')).toBe(true);
    expect(isWorkKey(5)).toBe(false);
  });
});

describe('labour storage', () => {
  it('keeps labour prices in the library', () => {
    let l = libReducer(emptyLib(), { t: 'labor', key: 'socket', value: '12,5' });
    expect(l.labor.socket).toBe(12.5);
    l = libReducer(l, { t: 'labor', key: 'socket', value: '' });
    expect(l.labor.socket).toBeUndefined();
    l = libReducer(l, { t: 'labor', key: 'switch', value: '-3' });
    expect(l.labor.switch).toBeUndefined();
    expect(normLib({ labor: { socket: 10, nope: 5, light: -1, cable: 'abc' } }).labor).toEqual({ socket: 10 });
  });
  it('keeps manual quantities in the project and its links', () => {
    const p = sampleProject();
    let s = init({ cur: p.id, list: [p] });
    s = reducer(s, { t: 'workQty', key: 'switch', value: '6' });
    expect(cur(s).work).toEqual({ switch: 6 });
    s = reducer(s, { t: 'workQty', key: 'cable', value: 'abc' });
    expect(cur(s).work).toEqual({ switch: 6 });
    const back = unpackProject(packProject(cur(s)));
    expect(back?.work).toEqual({ switch: 6 });
    s = reducer(s, { t: 'workQty', key: 'switch', value: '' });
    expect(cur(s).work).toEqual({});
    expect(normProject({ ...cur(s), work: {} })?.work).toBeUndefined();
  });
});

describe('estimate link', () => {
  const data = () => ({ p: sampleProject(), prices: { 'Шина N (нулевая)': 9 }, labor: { socket: 12 }, company: 'ИП Иванов', contacts: '+375 29 000', at: 1760000000000 });
  it('packs prices, labour and contacts and reads them back', () => {
    const e = unpackEstimate(packEstimate(data()));
    expect(e?.prices).toEqual({ 'Шина N (нулевая)': 9 });
    expect(e?.labor).toEqual({ socket: 12 });
    expect(e?.company).toBe('ИП Иванов');
    expect(e?.at).toBe(1760000000000);
    expect(e?.p.lines.length).toBe(sampleProject().lines.length);
    const url = estimateUrl(data(), 'https://x.by/app/#p=old');
    expect(url.startsWith('https://x.by/app/' + ESTIMATE_PREFIX + 'v1.')).toBe(true);
    expect(readEstimateHash('#e=abc')).toBe('abc');
    expect(readEstimateHash('#e=')).toBeNull();
    expect(readEstimateHash('#o=abc')).toBeNull();
  });
  it('rejects broken links and cleans odd values', () => {
    expect(unpackEstimate('garbage')).toBeNull();
    expect(unpackEstimate('v1.@@@')).toBeNull();
    expect(unpackEstimate(packProject(sampleProject()))).toBeNull();
    const odd = unpackEstimate(packEstimate({ ...data(), prices: { a: -1, b: 'x', c: 3 } as never, company: undefined as never, contacts: undefined as never, at: undefined as never }));
    expect(odd?.prices).toEqual({ c: 3 });
    expect(odd?.company).toBe('');
    expect(odd?.at).toBe(0);
    const noPrices = unpackEstimate(packEstimate({ ...data(), prices: null as never }));
    expect(noPrices?.prices).toEqual({});
  });
});

describe('labour export', () => {
  it('adds a labour sheet only when labour prices exist', () => {
    const a = calcAll(lines(), defaultCfg());
    expect(laborTable(a, {}, {})).toBeNull();
    expect(exportTables(a, {}).map(t => t.name)).toEqual(['Смета', 'Группы']);
    const t = laborTable(a, { 'Шина N (нулевая)': 10 }, { socket: 20 }, { switch: 2 })!;
    expect(t.rows.find(r => r[1] === 'Установка розетки')?.[5]).toBe(20);
    expect(t.rows.find(r => r[1] === 'Материалы')?.[5]).toBe(10);
    expect(t.total?.value).toBe(30);
    expect(exportTables(a, {}, { socket: 20 }).map(x => x.name)).toEqual(['Смета', 'Работы', 'Группы']);
  });
});
