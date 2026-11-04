import { describe, expect, it } from 'vitest';
import { calcAll } from '../../core/calc';
import { assumptions } from '../../core/assumptions';
import { cfgN } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { HEAT_RX } from '../../core/norms';

const row = (apps: [string, number, number][], type: 'power' | 'socket' = 'power') => calcAll([mkLine('Г', type, 8, 1, 1, apps)], defaultCfg()).rows[0].r;

describe('water heaters and heating (СН 4.04.01-2019, п. 14.4)', () => {
  it('recognises stationary heating appliances but not portable heaters', () => {
    expect(['Водонагреватель', 'Бойлер 80 л', 'Электрокотёл', 'Теплый пол', 'Конвектор', 'Полотенцесушитель', 'Проточный нагреватель'].every(n => HEAT_RX.test(n))).toBe(true);
    expect(['Обогреватель', 'Чайник', 'Стиральная машина'].some(n => HEAT_RX.test(n))).toBe(false);
  });

  it('notes the plug-free connection from 07.12.2026 without a warning for a separate line', () => {
    const r = row([['Водонагреватель', 2000, 1]]);
    expect(r.status).toBe('ok');
    expect(r.notes).toEqual([]);
    expect(r.tips).toEqual(['С 07.12.2026 по изменению № 2 к СН 4.04.01-2019 (п. 14.4) водонагреватели и приборы отопления любой мощности подключают неразъёмно, без вилки и розетки.']);
  });

  it('requires a plug-free connection now for devices above 5 kW', () => {
    const r = row([['Электрокотёл', 6000, 1]]);
    expect(r.notes.join(' ')).toMatch(/^Прибор мощнее 5 кВт: подключение неразъёмное, без вилки и розетки \(СН 4\.04\.01-2019, п\. 14\.4\)\. С 07\.12\.2026/);
    expect(row([['Тёплый пол', 3000, 2]]).tips.join(' ')).not.toContain('мощнее 5 кВт');
    expect(row([['Тёплый пол', 3000, 2]]).notes).toEqual([]);
  });

  it('warns when a heater shares the line with other appliances', () => {
    const r = row([['Водонагреватель', 2000, 1], ['Стиральная машина', 2200, 1]]);
    expect(r.status).toBe('warn');
    expect(r.notes).toContain('Водонагреватель и приборы отопления подключают отдельной линией от квартирного щитка, без других приборов (СН 4.04.01-2019, п. 14.4).');
    expect(row([['Чайник', 2000, 1]], 'socket').notes.join(' ')).not.toContain('14.4');
    expect(row([['Водонагреватель', 0, 1], ['Чайник', 2000, 1]], 'socket').notes.join(' ')).not.toContain('14.4');
  });

  it('lists the rule in the assumptions', () => {
    const a = assumptions(cfgN(defaultCfg())).find(x => x.name === 'Водонагреватель и отопление');
    expect(a?.source).toContain('17.09.2026 № 75');
    expect(a?.source).toContain('мощнее 5 кВт');
  });
});
