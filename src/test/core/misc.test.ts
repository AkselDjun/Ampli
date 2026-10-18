import { describe, expect, it } from 'vitest';
import { CHECK_ITEMS, progress } from '../../core/checklist';
import { ADDONS, compareRows, variantCalc } from '../../core/compare';
import { NB, dfmt, fmt, fs, plural, pn, round2 } from '../../core/format';
import { cableName, poles, protFull, protName } from '../../core/protection';
import { hasMeasurements, protocolRows, VERDICT } from '../../core/protocol';
import { parseApps } from '../../core/quick';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { defaultCfg, mkLine, sample } from '../../core/templates';
import { nid, pid } from '../../core/ids';
import { CLIMITS, STATUS, TYPE_KEYS, TYPES } from '../../core/norms';
import type { Calc, Cfg, Line, LineResult, Project } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), ...o });
const proj = (lines: Line[], o: Partial<Cfg> = {}): Project => ({
  id: 'p', name: 'n', address: '', client: '', author: '', created: 1, updated: 1, sample: false, cfg: cfg(o), lines
});

describe('format', () => {
  it('parses numbers', () => {
    expect(pn('2,5', 0)).toBe(2.5);
    expect(pn('abc', 7)).toBe(7);
    expect(pn(undefined, 3)).toBe(3);
    expect(pn(null, 3)).toBe(3);
    expect(pn(4, 0)).toBe(4);
    expect(pn('Infinity', 1)).toBe(1);
  });
  it('formats numbers with russian locale', () => {
    expect(fmt(1.25, 1).replace(/\s/g, ' ')).toBe('1,3');
    expect(fmt(1234.5, 0).replace(/\s/g, '')).toBe('1235');
    expect(fmt(2)).toBe('2,0');
  });
  it('formats section strings', () => {
    expect(fs(2.5)).toBe('2,5');
    expect(fs('1.5')).toBe('1,5');
    expect(fs(4)).toBe('4');
  });
  it('rounds to 2 decimals', () => {
    expect(round2(1.005 + 0.001)).toBe(1.01);
    expect(round2(3)).toBe(3);
  });
  it('picks plural forms', () => {
    const f: [string, string, string] = ['группа', 'группы', 'групп'];
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 100, 111, 0, -1, -2].map(n => plural(n, f))).toEqual([
      'группа', 'группы', 'группы', 'групп', 'групп', 'групп', 'групп', 'группа', 'группы', 'групп', 'групп', 'групп', 'групп', 'группа', 'группы'
    ]);
  });
  it('formats dates and exposes nbsp', () => {
    expect(dfmt(new Date(2024, 0, 15).getTime())).toBe('15.01.2024');
    expect(NB).toHaveLength(1);
  });
});

describe('ids and norms', () => {
  it('generates unique ids', () => {
    expect(nid()).not.toBe(nid());
    expect(nid()).toMatch(/^i\d+$/);
    expect(pid()).toMatch(/^p/);
    expect(pid()).not.toBe(pid());
  });
  it('exposes consistent tables', () => {
    expect(TYPE_KEYS).toEqual(['light', 'socket', 'power']);
    expect(TYPES.light.curve).toBe('B');
    expect(STATUS.ok).toBe('Норма');
    expect(CLIMITS.zs).toEqual([0.05, 2]);
  });
});

describe('checklist', () => {
  it('counts done items', () => {
    expect(progress(undefined)).toEqual({ done: 0, total: CHECK_ITEMS.length });
    expect(progress({ marks: true, pe: true, zs: false, nope: true }).done).toBe(2);
    expect(CHECK_ITEMS.length).toBe(10);
    expect(new Set(CHECK_ITEMS.map(i => i.id)).size).toBe(10);
  });
});

describe('protection names', () => {
  const base = { rcd: true, three: false, curve: 'C', In: 16, ma: 30, S: 2.5 } as LineResult;
  it('builds poles', () => {
    expect(poles(base)).toBe('1P+N');
    expect(poles({ ...base, rcd: false })).toBe('1P');
    expect(poles({ ...base, three: true })).toBe('4P');
    expect(poles({ ...base, three: true, rcd: false })).toBe('3P');
  });
  it('builds names', () => {
    expect(protFull(base)).toBe('Дифавтомат 1P+N C16 30 мА');
    expect(protFull({ ...base, rcd: false })).toBe('Автомат 1P C16');
    expect(protName(base)).toBe('Дифавтомат C16 · 30 мА');
    expect(protName({ ...base, rcd: false })).toBe('Автомат C16');
    expect(cableName(base)).toBe('ВВГнг(А)-LS 3×2,5');
    expect(cableName({ ...base, three: true, S: 4 })).toBe('ВВГнг(А)-LS 5×4');
  });
});

describe('protocol', () => {
  const rows = (lines: Line[]) => protocolRows(calcAll(lines, cfg()));
  it('skips empty and overloaded lines', () => {
    const a = calcAll([mkLine('e', 'socket', 5, null, null, []), mkLine('big', 'power', 5, null, null, [['a', 30000, 1]])], cfg());
    expect(protocolRows(a)).toEqual([]);
    expect(hasMeasurements(a)).toBe(false);
  });
  it('marks unmeasured lines', () => {
    const r = rows([mkLine('', 'socket', 5, null, null, [['a', 1000, 1]])]);
    expect(r[0].verdict).toBe('none');
    expect(r[0].name).toBe('Без названия');
    expect(r[0].no).toBe('Г1');
    expect(r[0].prot).toBe('C16 · 30 мА');
    expect([r[0].zs, r[0].ik, r[0].leak, r[0].ins]).toEqual([null, null, null, null]);
  });
  it('judges measurements', () => {
    const mk = (meas: Line['meas']): Line => ({ ...mkLine('a', 'socket', 5, null, null, [['a', 1000, 1]]), meas });
    expect(rows([mk({ zs: 0.5 })])[0]).toMatchObject({ verdict: 'ok', zs: 0.5 });
    expect(rows([mk({ zs: 0.5 })])[0].ik).toBeCloseTo(460, 6);
    expect(rows([mk({ zs: 9 })])[0].verdict).toBe('bad');
    expect(rows([mk({ leak: 11 })])[0].verdict).toBe('bad');
    expect(rows([mk({ leak: 1 })])[0].verdict).toBe('ok');
    expect(rows([mk({ ins: 0.1 })])[0].verdict).toBe('bad');
    expect(rows([mk({ ins: 10 })])[0].verdict).toBe('ok');
    const a = calcAll([mk({ ins: 10 })], cfg());
    expect(hasMeasurements(a)).toBe(true);
    expect(VERDICT.bad).toBe('Не соответствует');
  });
  it('omits rcd suffix for lines without rcd', () => {
    const a = calcAll([mkLine('a', 'socket', 5, null, null, [['a', 1000, 1]])], cfg());
    const r = a.rows[0].r;
    const fake = { ...a, rows: [{ l: a.rows[0].l, r: { ...r, rcd: false } }] } as Calc;
    expect(protocolRows(fake)[0].prot).toBe('C16');
  });
});

describe('parseApps', () => {
  it('parses decimal comma with unit and multiplier', () => {
    const r = parseApps('утюг 2,2 кВт x2');
    expect(r.skipped).toEqual([]);
    expect(r.apps).toEqual([{ name: 'Утюг', w: 2200, n: 2, tag: 's' }]);
  });
  it('splits by comma, semicolon and newline', () => {
    const r = parseApps('чайник 2200, духовка 2500\nлампа 40 вт; плита 7 kw');
    expect(r.apps.map(a => [a.name, a.w, a.n])).toEqual([['Чайник', 2200, 1], ['Духовка', 2500, 1], ['Лампа', 40, 1], ['Плита', 7000, 1]]);
  });
  it('uses presets when only name is given', () => {
    const r = parseApps('Чайник\nварочная  панель\nсветильник x3');
    expect(r.apps).toEqual([
      { name: 'Чайник', w: 2200, n: 1, tag: 's' },
      { name: 'Варочная панель', w: 4500, n: 1, tag: 'p' },
      { name: 'Светильник', w: 60, n: 3, tag: 'l' }
    ]);
  });
  it('recognizes count forms', () => {
    expect(parseApps('лампа 10 вт 5 шт').apps[0]).toMatchObject({ w: 10, n: 5 });
    expect(parseApps('лампа 10 вт 3 штуки').apps[0].n).toBe(3);
    expect(parseApps('лампа 10 вт ×4').apps[0].n).toBe(4);
    expect(parseApps('лампа 10 вт *2').apps[0].n).toBe(2);
    expect(parseApps('лампа 10 вт x0').apps[0].n).toBe(1);
    expect(parseApps('2 шт лампа 10 вт').apps[0]).toMatchObject({ name: 'Лампа', n: 2 });
  });
  it('keeps preset tag for known names with explicit power', () => {
    expect(parseApps('Чайник 1800').apps[0]).toEqual({ name: 'Чайник', w: 1800, n: 1, tag: 's' });
    expect(parseApps('духовой шкаф 3 квт').apps[0].tag).toBe('p');
  });
  it('cleans separators around names', () => {
    expect(parseApps('- 500 вт').skipped).toEqual(['- 500 вт']);
    expect(parseApps('лампа - 500 вт').apps[0].name).toBe('Лампа');
    expect(parseApps('500 вт — лампа').apps[0].name).toBe('Лампа');
    expect(parseApps('лампа — 500').apps[0].name).toBe('Лампа');
  });
  it('skips garbage', () => {
    const r = parseApps('???\nабракадабра\n\n  \n0 вт\nлампа 0');
    expect(r.apps).toEqual([]);
    expect(r.skipped).toEqual(['???', 'абракадабра', '0 вт', 'лампа 0']);
    expect(parseApps('')).toEqual({ apps: [], skipped: [] });
  });
  it('does not treat unit-like words as units', () => {
    expect(parseApps('2200 вттест').skipped.length + parseApps('2200 вттест').apps.length).toBe(1);
  });
});

describe('compare', () => {
  const base = proj(sample().lines);
  it('has addon factories', () => {
    expect(ADDONS.length).toBe(5);
    ADDONS.forEach(a => {
      const l = a.make();
      expect(l.type).toBe('power');
      expect(l.apps.length).toBe(1);
    });
  });
  it('excludes lines and adds addons', () => {
    const ids = base.lines.map(l => l.id);
    const c0 = variantCalc(base, [], []);
    expect(c0.rows.length).toBe(base.lines.length);
    const c1 = variantCalc(base, [ids[0]], ['ac', 'stove', 'nope']);
    expect(c1.rows.length).toBe(base.lines.length + 1);
    expect(c1.P).toBeGreaterThan(0);
  });
  it('compares equal calcs as neutral', () => {
    const a = variantCalc(base, [], []);
    const rows = compareRows(a, a);
    expect(rows.length).toBe(7);
    expect(rows.every(r => r.worse === null)).toBe(true);
    expect(rows[0].now).toMatch(/кВт$/);
    expect(rows[2].now).toBe('2P C63');
    expect(rows[3].now).toBe('однофазный');
    expect(rows[6].now).toMatch(/ %$/);
  });
  it('marks worse and better', () => {
    const now = variantCalc(base, [], []);
    const alt = variantCalc(base, [], ['stove', 'ac', 'boiler', 'floor', 'dish']);
    const worse = compareRows(now, alt);
    expect(worse[0].worse).toBe(true);
    expect(worse[1].worse).toBe(true);
    expect(worse[3].alt).toBe('нужен трёхфазный');
    expect(worse[3].worse).toBe(true);
    expect(worse[6].worse).toBe(true);
    const better = compareRows(alt, now);
    expect(better[0].worse).toBe(false);
    expect(better[1].worse).toBe(false);
    expect(better[2].worse).toBe(false);
    expect(better[3].worse).toBe(false);
    expect(better[6].worse).toBe(false);
  });
  it('compares size, issues and three phase', () => {
    const empty = variantCalc({ ...base, cfg: cfg({ supply: 3 }) }, base.lines.map(l => l.id), []);
    const full = variantCalc({ ...base, cfg: cfg({ supply: 3 }) }, [], []);
    const r = compareRows(empty, full);
    expect(r[2].now).toBe('—');
    expect(r[2].alt).toBe('4P C63');
    expect(r[2].worse).toBe(true);
    expect(r[3].now).toBe('трёхфазный');
    expect(r[4].worse).toBe(true);
    const bad = variantCalc(proj([mkLine('x', 'socket', 0, null, null, [['a', 100, 1]])]), [], []);
    const rr = compareRows(full, bad);
    expect(rr[5].worse).toBe(true);
    expect(compareRows(bad, full)[5].worse).toBe(false);
    expect(rr[4].worse).toBe(false);
  });
  it('line calc in cfgN is used for sanity', () => {
    expect(calcLine(base.lines[0], cfgN(base.cfg)).In).toBe(10);
  });
});
