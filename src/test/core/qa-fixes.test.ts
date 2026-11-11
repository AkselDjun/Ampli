import { describe, expect, it } from 'vitest';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { whyRows } from '../../core/why';
import { assumptions } from '../../core/assumptions';
import { dropText } from '../../core/report';
import { buildSpec } from '../../core/spec';
import { parseApps } from '../../core/quick';
import { normProject, newProject } from '../../core/project';
import { laborTable, sheetXml } from '../../core/export';
import { unitQty } from '../../core/labor';
import { weakCalc } from '../../core/weak';
import { ymd } from '../../core/format';
import { assemble } from '../../core/rooms';
import { checksOf } from '../../ui/Checks';
import type { Cfg, Line, Room } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), prot: 'rcbo', ...o });
const power = (w: number, o: Partial<Line> = {}): Line => ({ ...mkLine('Мощный', 'power', 10, [['Прибор', w, 1]]), ...o });

describe('input breaker and allocated power checks', () => {
  it('reports a missing input breaker above 100 A', () => {
    const a = calcAll([power(20000), power(14000)], cfg({ ko: 0.75, alloc: 40 }));
    expect(a.inIn).toBeNull();
    const c = checksOf(a).find(x => x.t.startsWith('Вводной автомат не подобран'));
    expect(c).toMatchObject({ k: 'bad', fix: 'phase3' });
    const a3 = calcAll([{ ...power(60000), phase: '3' }, { ...power(60000), phase: '3' }], cfg({ supply: 3, ko: 1, alloc: 200 }));
    expect(checksOf(a3).find(x => x.t.startsWith('Вводной автомат не подобран'))?.fix).toBe('net');
  });

  it('reports power above the allocation and an input breaker above its current', () => {
    const over = checksOf(calcAll([power(7000)], cfg({ alloc: 5, ko: 0.75 })));
    expect(over.find(x => x.t.startsWith('Расчётная мощность'))?.k).toBe('bad');
    const big = checksOf(calcAll([power(14000)], cfg({ alloc: 15, ko: 1 })));
    expect(big.find(x => x.t.includes('больше тока выделенной мощности'))?.k).toBe('warn');
    expect(checksOf(calcAll([power(2000)], cfg())).some(x => x.t.includes('выделенной'))).toBe(false);
  });

  it('keeps three-phase supply for three-phase appliances', () => {
    const a = calcAll([{ ...power(9000), phase: '3' }], cfg({ supply: 3, ko: 0.75 }));
    const list = checksOf(a);
    expect(list.some(x => x.fix === 'phase1')).toBe(false);
    expect(list.find(x => x.t.startsWith('Трёхфазный ввод нужен'))?.k).toBe('ok');
  });
});

describe('why explanations', () => {
  it('shows the measured loop in the short-circuit formula', () => {
    const l = { ...mkLine('Розетки', 'socket', 10, [['Чайник', 1500, 1]]), meas: { zs: '2' } };
    const c = cfgN(cfg());
    const kz = whyRows(l, calcLine(l, c), c).find(x => x.title === 'Короткое замыкание');
    expect(kz?.formula).toBe('Iк = 230 / 2,00 (замер петли) = 115 А');
    expect(kz?.note).toContain('расчётный был бы');
  });

  it('names short circuit as the reason for a larger cable', () => {
    const l = mkLine('Розетки', 'socket', 60, [['Чайник', 1500, 1]]);
    const c = cfgN(cfg({ zs: 0.8 }));
    const r = calcLine(l, c);
    const cable = whyRows(l, r, c).find(x => x.title === 'Кабель');
    expect(cable?.note).toContain('чтобы автомат отключил короткое замыкание');
    expect(r.notes.some(n => n.includes('не заходит в клеммы'))).toBe(true);
    const drop = mkLine('Розетки', 'socket', 90, [['Чайник', 3000, 1]]);
    const c2 = cfgN(cfg({ zs: 0.05 }));
    expect(whyRows(drop, calcLine(drop, c2), c2).find(x => x.title === 'Кабель')?.note).toContain('потеря напряжения не превысила');
  });
});

describe('assumptions and report text', () => {
  it('follows the minimum section mode, the feeder drop and the RCD rule', () => {
    const safe = assumptions(cfgN(cfg()));
    expect(safe.find(x => x.name === 'Наименьшее сечение жилы')?.basis).toBe('practice');
    const norm = assumptions(cfgN(cfg({ minS: 'norm', feeder: 1 })));
    expect(norm.find(x => x.name === 'Наименьшее сечение жилы')?.value).toBe('1,5 мм² для всех групп');
    expect(norm.find(x => x.name === 'Допустимая потеря напряжения')?.value).toBe('2,0 % свет, 4,0 % прочие');
    expect(assumptions(cfgN({ ...cfg(), prot: 'rcd' })).find(x => x.name === 'УЗО')?.value).not.toContain('не больше вводного');
    expect(dropText(0, 1)).toBe('2 % освещение, 4 % прочие (СН 4.04.01-2019, п. 9.14, за вычетом 1,0 % до щитка)');
    expect(dropText(0)).toBe('3 % освещение, 5 % прочие (СН 4.04.01-2019, п. 9.14)');
  });

  it('declines modules and units', () => {
    expect(buildSpec(calcAll([power(2000)], cfg()))[0].name).toMatch(/^Щиток на \d+ (модуль|модуля|модулей)$/);
    expect(buildSpec(calcAll([power(2000)], cfg()))[0].name).toBe('Щиток на 12 модулей');
    expect(unitQty(22, 'точка')).toBe('22 точки');
    expect(unitQty(21, 'точка')).toBe('21 точка');
    expect(unitQty(2.5, 'точка')).toBe('2,5 точки');
    expect(unitQty(5, 'м')).toBe('5 м');
  });
});

describe('weak current limits', () => {
  it('warns when one switch or splitter is not enough', () => {
    const c = weakCalc({ ont: true, pts: [{ id: 'a', room: '', kind: 'lan', n: 60, len: 10 }, { id: 'b', room: '', kind: 'tv', n: 9, len: 10 }] });
    expect(c.notes.some(n => n.text.includes('нужны два'))).toBe(true);
    expect(c.notes.some(n => n.text.includes('усилитель и два делителя'))).toBe(true);
  });
});

describe('quick list of appliances', () => {
  it('reads LED strip power per metre and length', () => {
    expect(parseApps('LED-лента 14,4 Вт 5 м, лента 9,6 вт/м 3,5 м').apps).toEqual([
      { name: 'LED-лента', w: 14.4, n: 1, tag: 'l', m: 5 },
      { name: 'Лента', w: 9.6, n: 1, tag: 's', m: 3.5 }
    ]);
  });
});

describe('project normalisation', () => {
  it('rejects broken config and coerces strange fields', () => {
    expect(normProject({ cfg: 'x', lines: [] })).toBeNull();
    expect(normProject({ cfg: [], lines: [] })).toBeNull();
    expect(normProject({ cfg: {}, lines: [{ type: 7, apps: [] }] })).toBeNull();
    const p = normProject({ cfg: {}, lines: [{ type: 'light', name: { x: 1 }, apps: [{ name: { y: 1 }, w: { z: 1 }, n: 2, m: 3, br: 'a' }, null] }] });
    expect(p?.lines[0].name).toBe('');
    expect(p?.lines[0].apps).toHaveLength(1);
    expect(p?.lines[0].apps[0]).toMatchObject({ name: '', w: '', n: 2, m: 3, br: 'a' });
  });

  it('merges room names that differ only in case', () => {
    const p = normProject({ cfg: {}, lines: [{ ...mkLine('А', 'light', 5, []), zone: 'Детская' }, { ...mkLine('Б', 'socket', 5, []), zone: 'детская ' }] });
    expect(p?.lines.map(l => l.zone)).toEqual(['Детская', 'Детская']);
  });
});

describe('Excel total of works', () => {
  it('sums only materials and works', () => {
    const p = newProject({ sample: false, cfg: cfg(), lines: [power(2000)] }, 'Т');
    const a = calcAll(p.lines, p.cfg);
    const t = laborTable(a, {}, { power: 50, panel: 100 }) as NonNullable<ReturnType<typeof laborTable>>;
    const xml = sheetXml(t);
    const n = t.rows.length;
    expect(xml).toContain('<f>SUM(F' + n + ':F' + (n + 1) + ')</f>');
  });
});

describe('dates and rooms', () => {
  it('formats ISO dates without time zones', () => {
    expect(ymd('2026-11-03')).toBe('03.11.2026');
    expect(ymd('x')).toBe('x');
  });

  it('puts lights of several rooms into a common zone', () => {
    const r = (name: string): Room => ({ id: name, name, kitchen: false, apps: [{ id: name + 'l', name: 'Люстра', w: 100, n: 1, tag: 'l' }] });
    const lines = assemble([r('Спальня'), r('Детская')]);
    expect(lines[0].zone).toBe('Комнаты');
    expect(assemble([r('Спальня')])[0].zone).toBe('Спальня');
  });
});
