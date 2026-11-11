import { describe, expect, it } from 'vitest';
import { calcAll } from '../../core/calc';
import { buildSpec } from '../../core/spec';
import { ductSize, jumperS, supplySpec, tubeD } from '../../core/supplies';
import { defaultCfg, mkLine } from '../../core/templates';
import { bestOffers, matches, parseAttrs, shopQuery } from '../../core/shop';
import type { Cfg, SpecItem } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), ...o });
const sock = (name: string, len = 10) => mkLine(name, 'socket', len, [['x', 1000, 1]]);
const light = (name: string, len = 8) => mkLine(name, 'light', len, [['x', 100, 1]]);
const names = (items: SpecItem[]) => items.map(i => i.name);
const item = (items: SpecItem[], name: string) => items.find(i => i.name === name)!;

describe('panel and route supplies', () => {
  it('picks jumper section by input breaker', () => {
    expect([null, 25, 32, 40, 50, 63, 80].map(v => jumperS(v))).toEqual([4, 4, 6, 6, 10, 10, 16]);
  });
  it('picks tube diameter and duct size by cable', () => {
    expect([tubeD(3, 1.5), tubeD(3, 2.5), tubeD(3, 4), tubeD(3, 6), tubeD(3, 10), tubeD(3, 16)]).toEqual([16, 20, 20, 25, 25, 32]);
    expect([tubeD(5, 1.5), tubeD(5, 2.5), tubeD(5, 4), tubeD(5, 6)]).toEqual([20, 25, 25, 32]);
    expect([ductSize(3, 1.5), ductSize(3, 2.5), ductSize(3, 4), ductSize(3, 6), ductSize(5, 2.5), ductSize(5, 4), ductSize(3, 10)]).toEqual(['16×16', '16×16', '25×16', '25×16', '25×16', '40×25', '40×25']);
  });
  it('gives nothing without working groups', () => {
    expect(supplySpec(calcAll([], defaultCfg()))).toEqual([]);
    expect(supplySpec(calcAll([mkLine('e', 'light', 5, [])], defaultCfg()))).toEqual([]);
  });
  it('adds combs under each RCD with two or more breakers, jumpers, ferrules and tube', () => {
    const lines = [sock('a'), sock('b'), light('c')].map(l => ({ ...l, zone: 'Кухня' }));
    const a = calcAll(lines, cfg({ prot: 'rcd' }));
    const s = supplySpec(a);
    const comb = item(s, 'Шина соединительная (гребёнка) 1P');
    expect(comb.n).toBe(a.uzos.filter(u => u.groups.length >= 2).length);
    expect(comb.note).toContain('под УЗО');
    expect(names(s).filter(n => n.startsWith('Провод ПуГВ'))).toHaveLength(3);
    expect(s.some(i => i.name.startsWith('Наконечник НШВИ'))).toBe(true);
    const tubes = s.filter(i => i.name.startsWith('Труба гофрированная'));
    expect(tubes.length).toBeGreaterThan(0);
    expect(tubes.every(t => t.unit === 'м' && (t.n ?? 0) > 0)).toBe(true);
    expect(tubes[0].note).toContain('скрытая');
  });
  it('feeds rcbo groups straight from the input with a 2P comb and counts relays and SPD', () => {
    const a = calcAll([sock('a'), sock('b'), light('c')], cfg({ prot: 'rcbo', vr: 'on', spd: 'on' }));
    const s = supplySpec(a);
    const comb = item(s, 'Шина соединительная (гребёнка) 2P');
    expect(comb.note).toContain('вводного');
    const brown = s.find(i => i.name.includes('коричневый'))!;
    expect(brown.n).toBe(Math.ceil(3 * 0.5));
    expect(s.find(i => i.name.includes('синий'))!.note).toBe('перемычки N');
  });
  it('uses 3P and 4P combs and five ferrules per three phase group', () => {
    const three = mkLine('p', 'power', 10, [['x', 9000, 1]], '3');
    const a = calcAll([three, { ...sock('a'), phase: 'L2' }, { ...sock('b'), phase: 'L3' }], cfg({ supply: 3, prot: 'rcbo' }));
    const s = supplySpec(a);
    expect(s.some(i => i.name === 'Шина соединительная (гребёнка) 4P')).toBe(true);
    const under = supplySpec(calcAll([{ ...three, zone: 'Кухня' }, { ...sock('a'), zone: 'Кухня' }], cfg({ supply: 3, prot: 'rcd' })));
    expect(under.some(i => i.name === 'Шина соединительная (гребёнка) 3P')).toBe(true);
  });
  it('uses plastic duct for open wiring and skips tube for zero length', () => {
    const s = supplySpec(calcAll([sock('a', 12)], cfg({ method: 'open' })));
    const duct = s.find(i => i.name.startsWith('Короб пластиковый'))!;
    expect(duct.name).toBe('Короб пластиковый 16×16 мм');
    expect(duct.note).toContain('открытая');
    expect(s.some(i => i.name.startsWith('Труба'))).toBe(false);
    const z = supplySpec(calcAll([sock('a', 0)], defaultCfg()));
    expect(z.some(i => i.name.startsWith('Труба'))).toBe(false);
  });
  it('goes into the spec before floor heating and low current items', () => {
    const spec = buildSpec(calcAll([sock('a'), sock('b')], defaultCfg()));
    const pe = spec.findIndex(i => i.name === 'Шина PE (заземления)');
    const fer = spec.findIndex(i => i.name.startsWith('Наконечник НШВИ'));
    expect(fer).toBeGreaterThan(pe);
  });
});

describe('shop understands supplies', () => {
  it('parses supply names', () => {
    expect(parseAttrs('Шина соединительная (гребёнка) 2P')).toMatchObject({ kind: 'comb', poles: '2' });
    expect(parseAttrs('Гребенка 1P 12 модулей')).toMatchObject({ kind: 'comb', poles: '1' });
    expect(parseAttrs('Шина соединительная PIN 1P 63А')).toMatchObject({ kind: 'comb', poles: '1' });
    expect(parseAttrs('Наконечник НШВИ 2,5 мм²')).toMatchObject({ kind: 'ferrule', sect: 2.5 });
    expect(parseAttrs('Провод ПуГВ (ПВ3) 6 мм² синий')).toMatchObject({ kind: 'wire', sect: 6 });
    expect(parseAttrs('Труба гофрированная ПВХ 20 мм')).toMatchObject({ kind: 'tube', size: '20' });
    expect(parseAttrs('Короб пластиковый 25×16 мм')).toMatchObject({ kind: 'duct', size: '25x16' });
    expect(parseAttrs('Кабель-канал 16х16')).toMatchObject({ kind: 'duct', size: '16x16' });
    expect(parseAttrs('Наконечник').sect).toBe(0);
    expect(parseAttrs('Провод').sect).toBe(0);
    expect(parseAttrs('Гофра').size).toBeUndefined();
    expect(parseAttrs('Короб').size).toBeUndefined();
    expect(parseAttrs('Шина соединительная').poles).toBe('');
  });
  it('matches offers by poles, section and size', () => {
    expect(matches(parseAttrs('Шина соединительная (гребёнка) 1P'), parseAttrs('Шина соединительная PIN 1P'))).toBe(true);
    expect(matches(parseAttrs('Шина соединительная (гребёнка) 1P'), parseAttrs('Шина соединительная 3P'))).toBe(false);
    expect(matches(parseAttrs('Шина соединительная'), parseAttrs('Шина соединительная 3P'))).toBe(true);
    expect(matches(parseAttrs('Наконечник НШВИ 2,5 мм²'), parseAttrs('Наконечник НШВИ 2.5 мм (100 шт)'))).toBe(true);
    expect(matches(parseAttrs('Наконечник НШВИ 2,5 мм²'), parseAttrs('Наконечник НШВИ'))).toBe(false);
    expect(matches(parseAttrs('Провод ПуГВ (ПВ3) 6 мм² синий'), parseAttrs('Провод ПВ-3 6 мм синий'))).toBe(true);
    expect(matches(parseAttrs('Труба гофрированная ПВХ 20 мм'), parseAttrs('Гофра ПВХ 20 мм с зондом'))).toBe(true);
    expect(matches(parseAttrs('Труба гофрированная ПВХ 20 мм'), parseAttrs('Гофра ПВХ'))).toBe(false);
    expect(matches(parseAttrs('Короб пластиковый 16×16 мм'), parseAttrs('Кабель-канал 16x16'))).toBe(true);
    const offers = bestOffers({ name: 'Наконечник НШВИ 1,5 мм²', qty: '', note: '', n: 1, unit: 'шт' }, [
      { name: 'Наконечник НШВИ 1,5 мм', price: 3, src: 'a' },
      { name: 'Наконечник НШВИ 2,5 мм', price: 2, src: 'a' }
    ]);
    expect(offers.map(o => o.price)).toEqual([3]);
  });
  it('builds shop queries', () => {
    const q = (name: string) => shopQuery({ name, qty: '', note: '', n: 1, unit: 'шт' });
    expect(q('Шина соединительная (гребёнка) 3P')).toBe('Шина соединительная гребёнка 3P');
    expect(q('Наконечник НШВИ 1,5 мм²')).toBe('Наконечник НШВИ 1,5 мм²');
    expect(q('Провод ПуГВ (ПВ3) 10 мм² коричневый')).toBe('Провод ПуГВ 10 мм²');
    expect(q('Труба гофрированная ПВХ 25 мм')).toBe('Труба гофрированная ПВХ 25 мм');
    expect(q('Короб пластиковый 40×25 мм')).toBe('Кабель-канал 40×25 мм');
    expect(q('Короб пластиковый')).toBe('Кабель-канал');
    expect(q('Гофра ПВХ')).toBe('Труба гофрированная ПВХ');
  });
});
