import { describe, expect, it } from 'vitest';
import { IZ, SECTIONS, TRIP_MULT, KZ_TIME } from '../../core/norms';
import { assumptions, BASIS_LABEL } from '../../core/assumptions';
import { cfgN, loopOhm, shortCircuit, calcLine } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';

const PUE_134_COPPER = {
  sections: [1.5, 2.5, 4, 6, 10, 16, 25, 35],
  open: [23, 30, 41, 50, 80, 100, 140, 170],
  twoInPipe: [19, 27, 38, 46, 70, 85, 115, 135],
  threeInPipe: [17, 25, 35, 42, 60, 80, 100, 125]
};

describe('ampacity table equals ПУЭ 1.3.4 for copper', () => {
  it('sections', () => expect(SECTIONS).toEqual(PUE_134_COPPER.sections));
  it('open laying', () => {
    expect(IZ.open[1]).toEqual(PUE_134_COPPER.open);
    expect(IZ.open[3]).toEqual(PUE_134_COPPER.open);
  });
  it('wires in a pipe', () => {
    expect(IZ.wall[1]).toEqual(PUE_134_COPPER.twoInPipe);
    expect(IZ.wall[3]).toEqual(PUE_134_COPPER.threeInPipe);
  });
});

describe('protection constants', () => {
  it('trip multiples and disconnection time', () => {
    expect(TRIP_MULT).toEqual({ B: 5, C: 10 });
    expect(KZ_TIME).toBe(0.4);
  });
  it('loop resistance grows with length and shrinks with section', () => {
    expect(loopOhm(2.5, 40)).toBeGreaterThan(loopOhm(2.5, 20));
    expect(loopOhm(4, 20)).toBeLessThan(loopOhm(2.5, 20));
  });
  it('short circuit current by Ohm law', () => {
    const z = 0.3 + loopOhm(2.5, 30);
    expect(shortCircuit(2.5, 30, 0.3)).toBeCloseTo(230 / z, 6);
  });
});

describe('hand-checked line results', () => {
  const c = cfgN(defaultCfg());
  it('2200 W kettle line of 20 m: 10 A, B/C16, 2.5 mm²', () => {
    const l = mkLine('Розетки', 'socket', 20, null, null, [['Чайник', 2200, 1]]);
    const r = calcLine(l, c);
    expect(r.I).toBeCloseTo(2200 * 0.7 / (230 * 0.95), 6);
    expect(r.In).toBe(16);
    expect(r.S).toBe(2.5);
    const du = 2 * 0.0225 * 20 * r.I * 0.95 / (2.5 * 230) * 100;
    expect(r.drop).toBeCloseTo(du, 6);
  });
  it('7 kW power line of 15 m: C32 and 4 mm² since 38 A × 0.9 = 34.2 A', () => {
    const l = mkLine('Плита', 'power', 15, null, null, [['Плита', 7000, 1]]);
    const r = calcLine(l, c);
    expect(r.I).toBeCloseTo(7000 / 230, 6);
    expect(r.In).toBe(32);
    expect(r.S).toBe(4);
  });
});

describe('assumptions list', () => {
  const list = assumptions(cfgN(defaultCfg()));
  it('every entry has name, value, source and a known basis', () => {
    list.forEach(a => {
      expect(a.name).toBeTruthy();
      expect(a.value).toBeTruthy();
      expect(a.source).toBeTruthy();
      expect(BASIS_LABEL[a.basis]).toBeTruthy();
    });
  });
  it('marks practice items honestly', () => {
    expect(list.filter(a => a.basis === 'practice').length).toBeGreaterThanOrEqual(3);
  });
  it('reflects configuration', () => {
    const open = assumptions(cfgN({ ...defaultCfg(), method: 'open', zs: 0.5 }));
    expect(open.find(a => a.name === 'Прокладка')?.value).toBe('открытая');
    expect(open.find(a => a.name === 'Петля фаза-нуль питающей сети')?.value).toContain('0,50');
  });
});
