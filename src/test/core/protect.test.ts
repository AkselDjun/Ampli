import { describe, expect, it } from 'vitest';
import { calcAll, vrRating } from '../../core/calc';
import { buildSpec } from '../../core/spec';
import { protFull, protName, uzoName } from '../../core/protection';
import { parseAttrs, matches } from '../../core/shop';
import { assumptions } from '../../core/assumptions';
import { cfgN } from '../../core/calc';
import { whyRows } from '../../core/why';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Cfg, Line } from '../../core/types';

const ls = (): Line[] => [
  { ...mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]), zone: 'Комнаты' },
  { ...mkLine('Стиралка', 'power', 8, [['Стиральная машина', 2200, 1]]), zone: 'Ванная' },
  { ...mkLine('Кухня', 'socket', 8, [['Чайник', 2000, 1], ['Посудомоечная машина', 1800, 1]]), zone: 'Кухня' }
];
const calc = (cfg: Partial<Cfg> = {}) => calcAll(ls(), { ...defaultCfg(), prot: 'rcbo', ...cfg });

describe('RCD type A', () => {
  it('marks groups with electronics and names the device', () => {
    const a = calc();
    expect(a.rows.map(x => x.r.rcdA)).toEqual([false, true, true]);
    expect(protFull(a.rows[1].r)).toBe('Дифавтомат 1P+N C16 30 мА тип A');
    expect(protName(a.rows[1].r)).toBe('Дифавтомат C16 · 30 мА · тип A');
    expect(protFull(a.rows[0].r)).not.toContain('тип');
    expect(a.rows[2].r.tips).toContain('УЗО типа A: посудомоечная машина даёт пульсирующий ток утечки, на который УЗО типа AC может не сработать.');
    expect(whyRows(a.rows[1].l, a.rows[1].r, a.c).find(w => w.title === 'Автомат')?.formula).toContain('тип A');
    expect(whyRows(a.rows[0].l, a.rows[0].r, a.c).find(w => w.title === 'Автомат')?.note).not.toContain('Тип A');
  });

  it('makes the room RCD type A when any group needs it', () => {
    const a = calc({ prot: 'rcd' });
    const bath = a.uzos.find(u => u.zone === 'Ванная');
    expect(bath?.typeA).toBe(true);
    expect(a.uzos.find(u => u.zone === 'Комнаты')?.typeA).toBe(false);
    expect(uzoName(bath!)).toMatch(/ 30 мА тип A$/);
  });

  it('uses the plural form for several appliances', () => {
    const a = calcAll([mkLine('Кухня', 'power', 8, [['Посудомоечная машина', 1800, 1], ['Варочная панель', 3000, 1], ['Варочная панель', 3000, 1]])], defaultCfg());
    expect(a.rows[0].r.tips[0]).toBe('УЗО типа A: посудомоечная машина, варочная панель дают пульсирующий ток утечки, на который УЗО типа AC может не сработать.');
  });

  it('does not mark an empty or unprotected group', () => {
    const a = calcAll([mkLine('Пусто', 'power', 5, [['Стиральная машина', 0, 1]])], defaultCfg());
    expect(a.rows[0].r.tips).toEqual([]);
  });

  it('matches type A offers only to type A needs in the shop', () => {
    const want = parseAttrs('Дифавтомат 1P+N C16 30 мА тип A');
    expect(want.typeA).toBe(true);
    expect(matches(want, parseAttrs('АВДТ 1P+N C16 30мА типа АС'))).toBe(false);
    expect(matches(want, parseAttrs('Дифавтомат C16 30 мА тип А 1P+N'))).toBe(true);
    expect(parseAttrs('Дифавтомат C16 30 мА типа AC').typeA).toBeUndefined();
    expect(matches(parseAttrs('Дифавтомат 1P+N C16 30 мА'), parseAttrs('Дифавтомат C16 30 мА тип А 1P+N'))).toBe(true);
  });
});

describe('voltage relay and surge protection', () => {
  it('is off by default', () => {
    const a = calc();
    expect(a.devs.some(d => d.kind === 'vr' || d.kind === 'spd')).toBe(false);
    expect(buildSpec(a).some(i => /Реле|УЗИП/.test(i.name))).toBe(false);
  });

  it('adds modules and specification items on one phase', () => {
    const base = calc();
    const a = calc({ vr: 'on', spd: 'on' });
    expect(a.devs.map(d => d.kind).slice(0, 3)).toEqual(['in', 'vr', 'spd']);
    expect(a.modSum).toBe(base.modSum + 4);
    const spec = buildSpec(a).map(i => i.name + ' | ' + i.qty);
    expect(spec).toContain('Реле контроля напряжения ' + vrRating(a.inIn as number) + ' А | 1 шт');
    expect(spec).toContain('УЗИП тип 2 1P+N | 1 шт');
    const names = assumptions(cfgN({ ...defaultCfg(), vr: 'on', spd: 'on' })).map(x => x.name);
    expect(names).toContain('Реле контроля напряжения');
    expect(names).toContain('УЗИП');
  });

  it('uses three relays and a 3P+N device on three phases', () => {
    const a = calc({ supply: 3, vr: 'on', spd: 'on' } as Partial<Cfg>);
    expect(a.devs.find(d => d.kind === 'vr')?.mod).toBe(6);
    expect(a.devs.find(d => d.kind === 'spd')?.mod).toBe(4);
    const spec = buildSpec(a).map(i => i.name + ' | ' + i.qty + ' | ' + i.note);
    expect(spec.some(s => s.startsWith('Реле контроля напряжения') && s.includes('3 шт') && s.includes('по одному на фазу'))).toBe(true);
    expect(spec.some(s => s.startsWith('УЗИП тип 2 3P+N'))).toBe(true);
  });

  it('picks the relay rating and falls back to a contactor above 63 A', () => {
    expect([vrRating(32), vrRating(40), vrRating(63), vrRating(80)]).toEqual([40, 40, 63, null]);
    const heavy = calcAll(Array.from({ length: 3 }, (_, i) => mkLine('П' + i, 'power', 5, [['Плита', 7000, 1]])), { ...defaultCfg(), vr: 'on', ko: 1 });
    expect(heavy.inIn).toBeGreaterThan(63);
    expect(heavy.devs.find(d => d.kind === 'vr')?.title).toContain('через контактор');
    expect(buildSpec(heavy).find(i => i.name.startsWith('Реле'))?.name).toBe('Реле контроля напряжения 63 А с контактором');
  });
});
