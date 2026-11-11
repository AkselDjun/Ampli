import { describe, expect, it } from 'vitest';
import { MAT_WPM, defaultWpm, floorAppName, floorArea, floorCalc, floorSpec, floorSummary, newFloorRoom, normFloor } from '../../core/floor';
import type { FloorRoom } from '../../core/floor';
import { calcAll } from '../../core/calc';
import { buildSpec } from '../../core/spec';
import { autoQty } from '../../core/labor';
import { defaultCfg, mkLine } from '../../core/templates';

const room = (o: Partial<FloorRoom> = {}): FloorRoom => ({ ...newFloorRoom('kitchen'), area: 4, ...o });

describe('floor heating defaults', () => {
  it('picks the system and power by room', () => {
    expect(newFloorRoom('bath')).toMatchObject({ sys: 'mat', wpm: 150, name: 'Ванная' });
    expect(newFloorRoom('room')).toMatchObject({ sys: 'film', wpm: 150 });
    expect(newFloorRoom('loggia')).toMatchObject({ sys: 'cable', wpm: 180 });
    expect(defaultWpm('loggia', 'film')).toBe(220);
    expect(defaultWpm('kitchen', 'cable')).toBe(130);
    expect(defaultWpm('room', 'mat')).toBe(MAT_WPM);
  });
});

describe('floorCalc', () => {
  it('takes the nearest smaller mat', () => {
    const r = floorCalc(room({ sys: 'mat', area: 3.4 }));
    expect([r.product, r.size, r.watts]).toEqual(['Нагревательный мат 150 Вт/м²', '3 м²', 450]);
    expect(r.notes[0].text).toContain('резать нельзя');
    expect(floorCalc(room({ sys: 'mat', area: 3 })).notes[0].text).toContain('УЗО');
    const tiny = floorCalc(room({ sys: 'mat', area: 0.2 }));
    expect(tiny.ok).toBe(false);
    expect(tiny.notes[0].k).toBe('bad');
  });

  it('picks a cable section and checks the laying step', () => {
    const r = floorCalc(room({ sys: 'cable', area: 4, wpm: 130 }));
    expect(r.watts).toBe(500);
    expect(r.len).toBe(28);
    expect(r.step).toBe(14.3);
    expect(r.size).toBe('500 Вт, 28 м');
    expect(r.notes[0]).toMatchObject({ k: 'ok', text: 'Шаг укладки 14,3 см.' });
    expect(floorCalc(room({ sys: 'cable', area: 0.3, wpm: 150 })).notes[0].text).toContain('меньше 7 см');
    const fit = floorCalc(room({ sys: 'cable', area: 2.2, wpm: 120 }));
    expect([fit.watts, fit.step]).toEqual([300, 12.9]);
    const big = floorCalc(room({ sys: 'cable', area: 30, wpm: 120 }));
    expect(big.parts).toHaveLength(2);
    expect(big.size.replace(/\s/g, ' ')).toBe('2 × 1 800 Вт, 2 × 100 м');
    expect(big.notes[0].text).toContain('нужно 2 секции');
    expect(floorCalc(room({ sys: 'cable', area: 6, wpm: 60 })).notes[0].text).toContain('больше 15 см');
    expect(floorCalc(room({ sys: 'cable', area: 0.5, wpm: 50 })).watts).toBe(150);
  });

  it('counts film strips and keeps the standard power', () => {
    const r = floorCalc(room({ sys: 'film', area: 10, wpm: 150 }));
    expect([r.product, r.size, r.watts]).toEqual(['Инфракрасная плёнка 150 Вт/м², ширина 0,5 м', '20 м', 1500]);
    expect(floorCalc(room({ sys: 'film', area: 1, wpm: 200 })).watts).toBe(220);
    expect(floorCalc(room({ sys: 'film', area: 1, wpm: 170 })).watts).toBe(150);
    expect(r.notes.some(n => n.text.includes('под мебелью'))).toBe(true);
  });

  it('warns about the thermostat limit and the bathroom', () => {
    const hot = floorCalc(room({ sys: 'film', area: 20, wpm: 220 }));
    expect(hot.notes.find(n => n.k === 'warn' && n.text.includes('контактор'))).toBeTruthy();
    expect(hot.contactor).toBe(25);
    expect(floorSpec([room({ sys: 'film', area: 20, wpm: 220 })]).some(i => i.name === 'Контактор модульный 2P 25 А')).toBe(true);
    const mats = floorCalc(room({ sys: 'mat', area: 25 }));
    expect(mats.parts).toEqual([15, 10]);
    expect(mats.size).toBe('15 м² + 10 м²');
    expect(mats.notes[0].text).toContain('нужно 2 мата');
    expect(floorSpec([room({ sys: 'mat', area: 30.5 })]).filter(i => i.name.startsWith('Нагревательный мат')).map(i => [i.name, i.n])).toEqual([['Нагревательный мат 150 Вт/м² 15 м²', 2], ['Нагревательный мат 150 Вт/м² 0,5 м²', 1]]);
    const bath = floorCalc(room({ use: 'bath', sys: 'mat', area: 3 }));
    expect(bath.notes.find(n => n.ref.includes('ГОСТ 30331.11'))?.k).toBe('warn');
    expect(floorCalc(room({ use: 'bath', sys: 'film', area: 3 })).notes.some(n => n.k === 'bad' && n.text.includes('Плёнку в ванной'))).toBe(true);
    const none = floorCalc(room({ area: '' }));
    expect(none.ok).toBe(false);
    expect(none.notes).toEqual([]);
    expect(none.wpm).toBe(0);
  });

  it('names the appliance', () => {
    expect(floorAppName(room({ name: 'Кухня' }))).toBe('Тёплый пол (Кухня)');
    expect(floorAppName(room({ name: ' ', use: 'loggia' }))).toBe('Тёплый пол (Лоджия)');
  });
});

describe('floor specification and summary', () => {
  it('lists products, thermostats, conduit and underlay', () => {
    const items = floorSpec([room({ sys: 'mat', area: 3, name: '' , use: 'bath'}), room({ sys: 'film', area: 10 }), room({ area: '' })]);
    expect(items.map(i => i.name)).toEqual([
      'Нагревательный мат 150 Вт/м² 3 м²',
      'Инфракрасная плёнка 150 Вт/м², ширина 0,5 м',
      'Терморегулятор с датчиком температуры пола, 16 А',
      'Гофротрубка 16 мм для датчика пола',
      'Теплоотражающая подложка под плёнку'
    ]);
    expect(items[0].note).toBe('Ванная, 450 Вт');
    expect(items[1]).toMatchObject({ qty: '20 м', n: 20 });
    expect(items[2].n).toBe(2);
    expect(items[4].n).toBe(10);
    expect(floorSpec([room({ sys: 'cable' })]).map(i => i.name)).not.toContain('Теплоотражающая подложка под плёнку');
    expect(floorSpec([])).toEqual([]);
  });

  it('summarises and sums the area', () => {
    expect(floorSummary(undefined)).toBe('');
    expect(floorSummary([room({ sys: 'mat', area: 3 }), room({ area: '' })])).toBe('1 помещение, 450 Вт');
    expect(floorArea([room({ sys: 'mat', area: 3 }), room({ area: '' })])).toBe(3);
    expect(floorArea(undefined)).toBe(0);
  });

  it('cleans stored rooms', () => {
    expect(normFloor('x')).toEqual([]);
    const out = normFloor([{ name: 'Санузел', use: 'bath', sys: 'mat', area: 3, wpm: 300 }, { use: 'x', sys: 'cable', area: {}, wpm: 140 }, { sys: 'film' }, null]);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ name: 'Санузел', use: 'bath', sys: 'mat', area: '3', wpm: 150 });
    expect(out[1]).toMatchObject({ name: 'Ванная', use: 'bath', sys: 'cable', area: '', wpm: '140' });
    expect(out[2]).toMatchObject({ sys: 'film', wpm: 150 });
  });
});

describe('floor heating in the calculation', () => {
  it('adds products to the specification and area to the works', () => {
    const lines = [mkLine('Свет', 'light', 10, [['Лампа', 100, 1]])];
    const a = calcAll(lines, defaultCfg(), { floor: [room({ sys: 'mat', area: 3 }), room({ area: '' })] });
    expect(a.floor).toHaveLength(1);
    expect(buildSpec(a).some(i => i.name.startsWith('Нагревательный мат'))).toBe(true);
    expect(autoQty(a).floor).toBe(3);
    const b = calcAll(lines, defaultCfg(), { floor: [room({ area: '' })] });
    expect(b.floor).toBeUndefined();
    expect(autoQty(b).floor).toBe(0);
  });
});
