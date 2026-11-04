import { describe, it, expect } from 'vitest';
import { FIXTURES, KZ, LIGHT_KINDS, OWN_FX, fixtureName, lightAppName, lightCalc, newLightRoom, normLight, utilization } from '../../core/light';
import type { LightRoom } from '../../core/light';

const room = (o: Partial<LightRoom> = {}): LightRoom => ({ ...newLightRoom('living'), a: 5, b: 4, h: 2.7, ...o });

describe('lighting norms', () => {
  it('uses the recommended illuminance of the Ministry of Health standard', () => {
    expect(LIGHT_KINDS.living.lux).toBe(150);
    expect(LIGHT_KINDS.kitchen.lux).toBe(150);
    expect(LIGHT_KINDS.kids.lux).toBe(200);
    expect(LIGHT_KINDS.hall.lux).toBe(50);
    expect(LIGHT_KINDS.bath.lux).toBe(50);
    expect(LIGHT_KINDS.study.practice).toBe(true);
    expect(LIGHT_KINDS.living.practice).toBeUndefined();
  });
});

describe('utilization factor', () => {
  it('interpolates by room index and clamps at the ends', () => {
    expect(utilization(0)).toBe(0.4);
    expect(utilization(0.3)).toBe(0.4);
    expect(utilization(1)).toBe(0.58);
    expect(utilization(0.9)).toBe(0.55);
    expect(utilization(9)).toBe(0.83);
  });
});

describe('lightCalc', () => {
  it('counts fixtures by the lumen method and reaches the norm', () => {
    const r = lightCalc(room());
    expect(r.ok).toBe(true);
    expect(r.area).toBe(20);
    expect(r.index).toBeCloseTo(20 / (2.7 * 9), 5);
    expect(r.n).toBe(Math.ceil((150 * 20 * KZ) / (900 * r.eta)));
    expect(r.lux).toBeGreaterThanOrEqual(150);
    expect(r.watts).toBe(r.n * 10);
    expect(r.density).toBeCloseTo(r.watts / 20, 5);
    expect(r.fxName).toBe('Точечный светильник LED 10 Вт');
  });

  it('needs fewer fixtures in a hall than in a kids room of the same size', () => {
    expect(lightCalc(room({ kind: 'hall' })).n).toBeLessThan(lightCalc(room({ kind: 'kids' })).n);
  });

  it('needs at least one fixture and waits for sizes', () => {
    expect(lightCalc(room({ kind: 'store', a: 1, b: 1, lm: 5000 })).n).toBe(1);
    const w = lightCalc(room({ a: '' }));
    expect(w.ok).toBe(false);
    expect(w.n).toBe(0);
    expect(w.lux).toBe(0);
    expect(w.density).toBe(0);
    expect(lightCalc(room({ lm: 0 })).ok).toBe(false);
  });

  it('names own fixtures and app lines', () => {
    expect(fixtureName(room({ fx: OWN_FX, w: 12.5 }))).toBe('Светильник 12,5 Вт');
    expect(fixtureName(room({ fx: OWN_FX, w: '' }))).toBe('Светильник');
    expect(lightAppName(room({ name: 'Зал' }))).toBe('Точечный светильник LED 10 Вт (Зал)');
    expect(lightAppName(room({ name: ' ', kind: 'kids' }))).toBe('Точечный светильник LED 10 Вт (Детская)');
  });
});

describe('newLightRoom and normLight', () => {
  it('picks a fixture by room kind', () => {
    expect(newLightRoom('bed').fx).toBe('spot10');
    expect(newLightRoom('bath').fx).toBe('spot7');
    expect(newLightRoom('hall', 'Холл').name).toBe('Холл');
  });

  it('cleans stored rooms', () => {
    expect(normLight(null)).toEqual([]);
    const out = normLight([
      { name: 'Зал', kind: 'living', a: 5, b: '4', h: 2.6, fx: 'panel36', w: 1, lm: 1 },
      { kind: 'bad', fx: 'nope', w: 15, lm: 1200, a: {} },
      null,
      'x'
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'Зал', kind: 'living', a: '5', b: '4', h: '2.6', fx: 'panel36', w: 36, lm: 3600 });
    expect(out[1]).toMatchObject({ name: 'Гостиная', kind: 'living', a: '', h: 2.7, fx: OWN_FX, w: '15', lm: '1200' });
    expect(FIXTURES.length).toBeGreaterThan(3);
  });
});
