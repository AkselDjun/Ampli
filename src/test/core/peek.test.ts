import { describe, expect, it } from 'vitest';
import { peekOf } from '../../core/peek';
import type { Row } from '../../core/types';

const row = (apps: [string, number, number][], r: Partial<Row['r']> = {}): Row => ({
  l: { id: 'a', name: 'Розетки: кухня', zone: 'Кухня', len: 18, apps: apps.map(([name, w, n], i) => ({ id: String(i), name, w, n })) } as unknown as Row['l'],
  r: { empty: false, curve: 'C', In: 16, S: 2.5, I: 12.4, pd: 2850, drop: 1.84, limit: 5, rcd: true, rcbo: false, ma: 30, zone: 'Кухня', ...r } as Row['r']
});

describe('карточка группы при наведении', () => {
  it('собирает защиту, кабель, потерю и загрузку', () => {
    const p = peekOf(row([['Чайник', 2200, 1]]));
    expect(p.facts).toEqual([
      ['Защита', 'C16 · УЗО «Кухня» 30 мА'],
      ['Кабель', '2,5 мм² · 18 м'],
      ['Потеря', '1,8 % из 5,0 %'],
      ['Загрузка', '78 %']
    ]);
  });

  it('показывает пять приборов и считает остальные', () => {
    const apps: [string, number, number][] = Array.from({ length: 7 }, (_, i) => ['Прибор ' + i, 100, i === 0 ? 2 : 1]);
    const p = peekOf(row(apps));
    expect(p.apps).toHaveLength(5);
    expect(p.apps[0]).toBe('Прибор 0 × 2');
    expect(p.more).toBe(2);
  });

  it('дифавтомат и неподобранный автомат', () => {
    expect(peekOf(row([], { rcbo: true })).facts[0][1]).toBe('C16 · дифавтомат 30 мА');
    expect(peekOf(row([], { In: null, rcd: false })).facts[0][1]).toBe('не подобран');
  });

  it('без приборов показывает только кабель', () => {
    const p = peekOf(row([], { empty: true }));
    expect(p.facts).toEqual([['Кабель', '2,5 мм² · 18 м']]);
    expect(p.apps).toEqual([]);
  });
});
