import { describe, expect, it } from 'vitest';
import { APP_MAX, BOUNDS, LINE_MAX, MEAS_MAX, asLabel, cfgErr, fieldErr, rangeErr } from '../../core/limits';
import { CLIMITS, PRESETS } from '../../core/norms';
import { TPL_LIST, contentFor, sample } from '../../core/templates';
import type { Content } from '../../core/types';

describe('field bounds', () => {
  it('stay inside the hard caps used when importing and typing', () => {
    expect(BOUNDS.len.max).toBeLessThanOrEqual(LINE_MAX.len);
    expect(BOUNDS.sockets.max).toBeLessThanOrEqual(LINE_MAX.sockets);
    expect(BOUNDS.perSocket.max).toBeLessThanOrEqual(LINE_MAX.perSocket);
    for (const k of ['w', 'n', 'm', 'br', 'cos'] as const) expect(BOUNDS[k].max).toBeLessThanOrEqual(APP_MAX[k]);
    expect(BOUNDS.wpm.max).toBeLessThanOrEqual(APP_MAX.w);
    for (const k of ['zs', 'ins', 'leak', 'rcd'] as const) expect(BOUNDS[k].max).toBeLessThanOrEqual(MEAS_MAX);
    expect(BOUNDS.alloc.max).toBeLessThanOrEqual(CLIMITS.alloc[1]);
    expect(BOUNDS.alloc.min).toBeGreaterThanOrEqual(CLIMITS.alloc[0]);
    expect(BOUNDS.sip.max).toBeLessThanOrEqual(CLIMITS.sip[1]);
    expect(BOUNDS.area.max).toBeLessThanOrEqual(200);
    expect(BOUNDS.floorWpm.max).toBeLessThanOrEqual(400);
    expect(BOUNDS.wkN.max).toBeLessThanOrEqual(99);
    expect(BOUNDS.price.max).toBeLessThanOrEqual(1000000);
    expect(BOUNDS.rate.max).toBeLessThanOrEqual(100000);
  });

  it('follow the norms where a norm sets the limit', () => {
    expect(BOUNDS.perSocket.max).toBe(16 * 230);
    expect(BOUNDS.cos).toMatchObject({ min: 0.3, max: 1 });
  });

  it('skip empty fields and accept real values', () => {
    expect(fieldErr('w', '')).toBeNull();
    expect(fieldErr('w', undefined)).toBeNull();
    expect(fieldErr('w', 2000)).toBeNull();
    expect(fieldErr('len', '12,5')).toBeNull();
    expect(fieldErr('cos', '0,8')).toBeNull();
    expect(fieldErr('n', 3)).toBeNull();
  });

  it('reject values above the bound with a reason', () => {
    expect(fieldErr('perSocket', 4000)).toEqual({ msg: 'Не больше 3680 Вт. Розетка на 16 А при 230 В выдерживает не больше 3680 Вт', hard: true });
    expect(fieldErr('w', '50000')?.msg).toBe('Не больше 30 000 Вт. Бытовой прибор такой мощности не встречается, проверьте, что мощность в ваттах, а не в милливаттах');
    expect(fieldErr('len', 450)?.msg).toMatch(/^Не больше 300 м\. /);
    expect(fieldErr('leak', 250)?.hard).toBe(true);
    expect(fieldErr('zs', 25)?.msg).toMatch(/обрыв/);
    expect(fieldErr('alloc', 150)?.msg).toMatch(/^Не больше 100 кВт/);
  });

  it('reject fractions where only whole numbers make sense', () => {
    expect(fieldErr('n', '2,5')).toEqual({ msg: 'Только целое число', hard: true });
    expect(fieldErr('sockets', 1.5)?.msg).toBe('Только целое число');
    expect(fieldErr('wkN', '1.2')?.msg).toBe('Только целое число');
  });

  it('mark too small values as soft so they hide while typing', () => {
    expect(fieldErr('len', 0)).toEqual({ msg: 'Больше 0 м. Без длины не посчитать потерю напряжения и петлю фаза-нуль', hard: false });
    expect(fieldErr('n', '0')).toEqual({ msg: 'Не меньше 1 шт. Чтобы убрать прибор, удалите строку', hard: false });
    expect(fieldErr('cos', '0,1')?.msg).toMatch(/^Не меньше 0,3\. /);
    expect(fieldErr('rcd', 0)?.hard).toBe(false);
    expect(fieldErr('w', ',')).toEqual({ msg: 'Введите число', hard: false });
  });

  it('checks network parameters against the calculation limits', () => {
    expect(cfgErr('zs', '3')?.msg).toBe('Не больше 2 Ом. Расчёт принимает значения от 0,05 до 2 Ом');
    expect(cfgErr('ko', '0,1')?.msg).toBe('Не меньше 0,3. Расчёт принимает значения от 0,3 до 1');
    expect(cfgErr('feeder', 5)?.msg).toMatch(/до 3 %$/);
    expect(cfgErr('margin', 1.2)).toBeNull();
    expect(cfgErr('rz', '')).toBeNull();
    expect(cfgErr('sip', 150)?.msg).toMatch(/дополнительную опору/);
    expect(cfgErr('obj', 'house')).toBeNull();
  });

  it('prefixes a field name for messages shown under a row', () => {
    const e = rangeErr(5, { min: 0, max: 1, u: 'м', why: 'слишком много' });
    expect(e && asLabel('Длина', e)).toEqual({ msg: 'Длина: не больше 1 м. Слишком много', hard: true });
  });

  it('accept every built-in template and preset', () => {
    const all: Content[] = [sample(), ...TPL_LIST.flatMap(t => [contentFor(t.key, true), contentFor(t.key, false)])];
    const bad: string[] = [];
    for (const c of all) {
      for (const l of c.lines) {
        for (const [k, v] of [['len', l.len], ['sockets', l.sockets], ['perSocket', l.perSocket]] as const) if (fieldErr(k, v)) bad.push(l.name + ' ' + k);
        for (const a of l.apps) {
          if (fieldErr(a.m !== undefined ? 'wpm' : 'w', a.w) || fieldErr('n', a.n) || fieldErr('br', a.br) || fieldErr('cos', a.cos) || (a.m !== undefined && fieldErr('m', a.m))) bad.push(l.name + ': ' + a.name);
        }
      }
      for (const k of Object.keys(CLIMITS)) if (cfgErr(k, c.cfg[k as keyof typeof c.cfg])) bad.push('cfg ' + k);
    }
    for (const [name, w] of PRESETS) if (fieldErr('w', w)) bad.push(name);
    expect(bad).toEqual([]);
  });
});
