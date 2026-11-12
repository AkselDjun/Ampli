import { describe, expect, it } from 'vitest';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Cfg } from '../../core/types';

const one = cfgN(defaultCfg());
const three = cfgN({ ...defaultCfg(), supply: 3 } as Cfg);

describe('reference groups checked by hand against ТКП 339-2022, СН 4.04.01-2019 and ПУЭ табл. 1.3.4', () => {
  it('lighting 10 × 60 W on 25 m: B10, 1,5 mm², ΔU 0,85 %, Iкз 196 А', () => {
    const r = calcLine(mkLine('Свет', 'light', 25, [['Светильник', 60, 10]]), one);
    expect(r.pInst).toBe(600);
    expect(r.I).toBeCloseTo(2.6087, 3);
    expect(r.curve + r.In).toBe('B10');
    expect(r.S).toBe(1.5);
    expect(r.limit).toBe(3);
    expect(r.drop).toBeCloseTo(0.8507, 3);
    expect(r.ikNeed).toBe(50);
    expect(r.ik).toBeCloseTo(195.74, 1);
    expect(r.status).toBe('ok');
  });

  it('kitchen sockets 3 550 W on 15 m: C16, 2,5 mm², ΔU 1,81 %, Iкз 374 А', () => {
    const r = calcLine(mkLine('Кухня', 'socket', 15, [['Чайник', 2200, 1], ['Микроволновая печь', 1200, 1], ['Холодильник', 150, 1]]), one);
    expect(r.I).toBeCloseTo(15.4348, 3);
    expect(r.curve + r.In).toBe('C16');
    expect(r.S).toBe(2.5);
    expect(r.limit).toBe(5);
    expect(r.drop).toBeCloseTo(1.8119, 3);
    expect(r.ikNeed).toBe(160);
    expect(r.ik).toBeCloseTo(373.98, 1);
    expect(r.status).toBe('ok');
  });

  it('long lighting line 1 500 W on 60 m: section grows 1,5 → 4 mm² to keep ΔU within 3 %', () => {
    const r = calcLine(mkLine('Коридор', 'light', 60, [['Люстра', 1500, 1]]), one);
    expect(r.In).toBe(10);
    expect(r.S).toBe(4);
    expect(r.drop).toBeCloseTo(1.9140, 3);
    expect(r.ik).toBeCloseTo(211.49, 1);
    expect(r.status).toBe('warn');
    expect(r.notes[0]).toContain('с 1,5 до 4 мм²');
  });

  it('socket line on 70 m: section grows to 4 mm² so C16 trips within 0,4 s', () => {
    const r = calcLine(mkLine('Балкон', 'socket', 70, [['Компьютер', 500, 1]]), one);
    expect(r.drop).toBeCloseTo(0.7443, 3);
    expect(r.S).toBe(4);
    expect(r.ik).toBeCloseTo(188.72, 1);
    expect(r.ik).toBeGreaterThanOrEqual(r.ikNeed);
    expect(r.status).toBe('warn');
    expect(r.notes.join(' ')).toContain('до 4 мм²');
  });

  it('socket line on 100 m: section grows to 6 mm² so C16 trips within 0,4 s', () => {
    const r = calcLine(mkLine('Гараж', 'socket', 100, [['Компьютер', 500, 1]]), one);
    expect(r.drop).toBeCloseTo(0.7089, 3);
    expect(r.S).toBe(6);
    expect(r.ik).toBeCloseTo(195.74, 1);
    expect(r.ik).toBeGreaterThanOrEqual(r.ikNeed);
    expect(r.status).toBe('warn');
    expect(r.notes.join(' ')).toContain('до 6 мм²');
    expect(r.notes.join(' ')).toContain('кривой B');
  });

  it('three-phase cooker 7 kW on 10 m: C16 3P, 2,5 mm², ΔU 0,39 %, Iкз 451 А, RCD type A', () => {
    const l = { ...mkLine('Плита', 'power', 10, [['Электроплита', 7000, 1]]), phase: '3' as const };
    const r = calcLine(l, three);
    expect(r.three).toBe(true);
    expect(r.I).toBeCloseTo(10.1036, 3);
    expect(r.curve + r.In).toBe('C16');
    expect(r.S).toBe(2.5);
    expect(r.drop).toBeCloseTo(0.39375, 4);
    expect(r.ik).toBeCloseTo(450.98, 1);
    expect(r.rcdA).toBe(true);
    expect(r.mod).toBe(3);
    expect(r.status).toBe('ok');
  });

  it('water heater shares a line with a kettle: separate line required by СН 4.04.01-2019 п. 14.4', () => {
    const r = calcLine(mkLine('Ванная', 'power', 12, [['Водонагреватель', 2000, 1], ['Чайник', 2200, 1]]), one);
    expect(r.status).toBe('warn');
    expect(r.notes.join(' ')).toContain('п. 14.4');
  });
});

describe('reference apartment checked by hand', () => {
  const lines = [
    mkLine('Свет', 'light', 25, [['Светильник', 60, 10]]),
    mkLine('Кухня', 'socket', 15, [['Чайник', 2200, 1], ['Микроволновая печь', 1200, 1], ['Холодильник', 150, 1]]),
    mkLine('Бойлер', 'power', 12, [['Водонагреватель', 2000, 1]])
  ];
  const a = calcAll(lines, defaultCfg());

  it('design power and current with Ко 0,75', () => {
    expect(a.sumInst).toBe(6150);
    expect(a.P).toBeCloseTo(4612.5, 6);
    expect(a.Itot).toBeCloseTo(20.0544, 3);
  });

  it('input breaker is two steps above the largest group for selectivity: C25 on 4 mm²', () => {
    expect(a.inIn).toBe(25);
    expect(a.inS).toBe(4);
    expect(a.hint3).toBe(false);
  });

  it('one 30 mA RCD limited by the input breaker: 25 А', () => {
    expect(a.uzos).toHaveLength(1);
    expect(a.uzos[0].sumIn).toBe(42);
    expect(a.uzos[0].In).toBe(25);
    expect(a.uzos[0].ma).toBe(30);
  });

  it('board of 12 modules with 20 % reserve', () => {
    expect(a.devs.map(d => d.label)).toEqual(['C25', '25А', 'B10', 'C16', 'C16']);
    expect(a.modSum).toBe(7);
    expect(a.size).toBe(12);
    expect(a.issues).toBe(0);
  });
});
