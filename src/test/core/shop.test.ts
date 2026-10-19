import { describe, expect, it } from 'vitest';
import { bestOffers, matches, norm, parseAttrs, searchUrl, shopQuery, SHOPS } from '../../core/shop';
import { buildSpec } from '../../core/spec';
import { calcAll } from '../../core/calc';
import { sampleProject } from '../../core/project';
import type { SpecItem } from '../../core/types';

const it_ = (name: string, n: number | null = 1, unit = 'шт'): SpecItem => ({ name, qty: '', note: '', n, unit });

describe('parseAttrs', () => {
  it('reads breakers with Latin and Cyrillic letters', () => {
    expect(parseAttrs('Автомат 1P C16')).toMatchObject({ kind: 'breaker', poles: '1', curve: 'C', amp: 16 });
    expect(parseAttrs('Автомат ВА47-29 1P С16 ABB')).toMatchObject({ kind: 'breaker', poles: '1', curve: 'C', amp: 16 });
    expect(parseAttrs('Выключатель автоматический 2P В25')).toMatchObject({ kind: 'breaker', poles: '2', curve: 'B', amp: 25 });
    expect(parseAttrs('Вводной автомат 2P C63')).toMatchObject({ kind: 'breaker', amp: 63, poles: '2' });
  });
  it('reads residual-current breakers and the leakage current', () => {
    expect(parseAttrs('Дифавтомат 1P+N C16 30 мА')).toMatchObject({ kind: 'rcbo', amp: 16, ma: 30 });
    expect(parseAttrs('АВДТ 1P+N C25 30mA')).toMatchObject({ kind: 'rcbo', amp: 25, ma: 30 });
  });
  it('reads cable, board and bus bars', () => {
    expect(parseAttrs('ВВГнг(А)-LS 3×2,5')).toMatchObject({ kind: 'cable', cores: 3, sect: 2.5 });
    expect(parseAttrs('Кабель ВВГ-Пнг(А)-LS 5х10')).toMatchObject({ kind: 'cable', cores: 5, sect: 10 });
    expect(parseAttrs('Щиток на 24 модуля')).toMatchObject({ kind: 'board', modules: 24 });
    expect(parseAttrs('Шина N (нулевая)')).toMatchObject({ kind: 'bus', bus: 'n' });
    expect(parseAttrs('Шина PE (заземления)')).toMatchObject({ kind: 'bus', bus: 'pe' });
  });
  it('returns other for unknown names', () => {
    expect(parseAttrs('Розетка двойная').kind).toBe('other');
    expect(parseAttrs('УЗО 2P 40A 30mA').kind).toBe('other');
  });
  it('normalises text', () => {
    expect(norm('  ЁлкА  3×2,5 ')).toBe('елка 3x2,5');
  });
});

describe('matches and bestOffers', () => {
  const offers = [
    { name: 'Автомат ABB 1P C16', price: 9.5, src: 'A' },
    { name: 'Автомат ВА47 1P С16 EKF', price: 6.2, src: 'B' },
    { name: 'Автомат ВА47 2P С16 EKF', price: 12, src: 'B' },
    { name: 'Автомат 1P C20', price: 5, src: 'B' },
    { name: 'Дифавтомат 1P+N C16 30 мА', price: 40, src: 'A' },
    { name: 'Дифавтомат 1P+N C16 10 мА', price: 45, src: 'A' },
    { name: 'ВВГнг(А)-LS 3х2,5', price: 2.1, src: 'A' },
    { name: 'ВВГнг(А)-LS 3х1,5', price: 1.3, src: 'A' },
    { name: 'Щиток ЩРВ-П-24 модуля', price: 30, src: 'A' },
    { name: 'Щиток 12 модулей', price: 15, src: 'A' },
    { name: 'Шина N на DIN-рейку нулевая', price: 3, src: 'A' },
    { name: 'Автомат C16 без полюсов', price: 4, src: 'A' },
    { name: 'Цена 0', price: 0, src: 'A' }
  ];
  it('picks the matching positions sorted by price', () => {
    const r = bestOffers(it_('Автомат 1P C16'), offers);
    expect(r.map(o => o.price)).toEqual([4, 6.2, 9.5]);
  });
  it('requires the same current and pole count and ignores zero prices', () => {
    const r = bestOffers(it_('Автомат 1P C16'), offers);
    expect(r.some(o => o.name.includes('2P'))).toBe(false);
    expect(r.some(o => o.name.includes('C20'))).toBe(false);
    expect(bestOffers(it_('Автомат 1P C16'), [{ name: 'Автомат 1P C16', price: 0, src: 'x' }])).toEqual([]);
  });
  it('matches residual-current ratings only when both sides state them', () => {
    const r = bestOffers(it_('Дифавтомат 1P+N C16 30 мА'), offers);
    expect(r.map(o => o.price)).toEqual([40]);
  });
  it('matches cable by cores and section and a board by at least the needed modules', () => {
    expect(bestOffers(it_('ВВГнг(А)-LS 3×2,5', 10, 'м'), offers).map(o => o.price)).toEqual([2.1]);
    expect(bestOffers(it_('Щиток на 24 модуля'), offers).map(o => o.price)).toEqual([30]);
    expect(bestOffers(it_('Шина N (нулевая)'), offers).map(o => o.price)).toEqual([3]);
    expect(bestOffers(it_('Шина PE (заземления)'), offers)).toEqual([]);
  });
  it('never matches unknown kinds or different kinds', () => {
    expect(matches(parseAttrs('Розетка'), parseAttrs('Розетка'))).toBe(false);
    expect(matches(parseAttrs('Автомат 1P C16'), parseAttrs('Дифавтомат 1P+N C16 30 мА'))).toBe(false);
  });
  it('rejects a different curve when both state it', () => {
    expect(matches(parseAttrs('Автомат 1P C16'), parseAttrs('Автомат 1P B16'))).toBe(false);
  });
});

describe('shopQuery and searchUrl', () => {
  it('builds a readable query for every kind', () => {
    expect(shopQuery(it_('Автомат 1P C16'))).toBe('Автоматический выключатель 1P C16');
    expect(shopQuery(it_('Дифавтомат 1P+N C16 30 мА'))).toBe('Дифавтомат 1P C16 30 мА');
    expect(shopQuery(it_('Дифавтомат 2P C25'))).toBe('Дифавтомат 2P C25');
    expect(shopQuery(it_('ВВГнг(А)-LS 3×2,5'))).toBe('ВВГнг-LS 3х2,5');
    expect(shopQuery(it_('Щиток на 24 модуля'))).toBe('Щиток встраиваемый 24 модулей');
    expect(shopQuery(it_('Шина N (нулевая)'))).toContain('Шина N');
    expect(shopQuery(it_('Шина PE (заземления)'))).toContain('Шина PE');
    expect(shopQuery(it_('Что-то ещё'))).toBe('Что-то ещё');
  });
  it('limits the search to a shop or searches everywhere', () => {
    const u = searchUrl('Автомат C16', SHOPS[0]);
    expect(u).toContain('https://www.google.com/search?q=');
    expect(decodeURIComponent(u)).toContain('site:' + SHOPS[0].site);
    expect(decodeURIComponent(searchUrl('Автомат C16'))).toContain('купить Беларусь');
  });
  it('understands every line of the sample spec', () => {
    const p = sampleProject();
    const spec = buildSpec(calcAll(p.lines, p.cfg));
    spec.forEach(s => {
      expect(parseAttrs(s.name).kind).not.toBe('other');
      expect(shopQuery(s).length).toBeGreaterThan(5);
    });
  });
});
