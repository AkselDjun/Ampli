import { describe, expect, it } from 'vitest';
import { rcdTripMs } from '../../core/norms';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { protocolRows } from '../../core/protocol';
import { assumptions } from '../../core/assumptions';
import { whyRows } from '../../core/why';
import { CHECK_ITEMS } from '../../core/checklist';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Line } from '../../core/types';

const c = cfgN(defaultCfg());
const withMeas = (l: Line, rcd: string | number): Line => ({ ...l, meas: { rcd } });

describe('RCD trip time limits from ТКП 339-2022 amendment 1', () => {
  it('follows tables 4.4.47 and 4.4.48 at the rated residual current', () => {
    expect(rcdTripMs(6)).toBe(5000);
    expect(rcdTripMs(10)).toBe(5000);
    expect(rcdTripMs(30)).toBe(500);
    expect(rcdTripMs(100)).toBe(2000);
  });
  it('accepts a fast RCD and rejects a slow one', () => {
    const base = mkLine('Розетки', 'socket', 10, 1, 1, [['Чайник', 2000, 1]]);
    const none = calcLine(base, c);
    expect(none.rcdMeas).toBeNull();
    expect(none.rcdLim).toBe(500);
    const ok = calcLine(withMeas(base, '25'), c);
    expect(ok.rcdMeas).toBe(25);
    expect(ok.status).toBe('ok');
    const bad = calcLine(withMeas(base, 650), c);
    expect(bad.status).toBe('bad');
    expect(bad.notes.join(' ')).toContain('табл. 4.4.48');
  });
  it('uses table 4.4.47 for RCDs above 30 mA', () => {
    const big = mkLine('Плита', 'power', 10, 1, 1, [['Плита', 9000, 1]]);
    const r = calcLine(withMeas(big, 2500), c);
    expect(r.ma).toBe(100);
    expect(r.rcdLim).toBe(2000);
    expect(r.notes.join(' ')).toContain('табл. 4.4.47');
  });
  it('puts trip time into the protocol verdict', () => {
    const l = mkLine('Свет', 'light', 10, 1, 1, [['Люстра', 100, 1]]);
    const ok = protocolRows(calcAll([withMeas(l, 30)], defaultCfg()))[0];
    expect(ok.rcdT).toBe(30);
    expect(ok.rcdLim).toBe(500);
    expect(ok.verdict).toBe('ok');
    expect(protocolRows(calcAll([withMeas(l, 900)], defaultCfg()))[0].verdict).toBe('bad');
    expect(protocolRows(calcAll([l], defaultCfg()))[0].rcdT).toBeNull();
  });
});

describe('norm references after amendment 1', () => {
  it('cites the amended ТКП 339 for RCDs and no longer cites amendment 2 or section 8', () => {
    const text = JSON.stringify(assumptions(c));
    expect(text).toContain('ТКП 339-2022 с изм. № 1, п. 4.3.18.5');
    expect(text).toContain('табл. 4.4.47, 4.4.48');
    expect(text).not.toContain('изм. 2');
    expect(text).not.toContain('табл. 8.1');
  });
  it('explains why each group type gets an RCD', () => {
    const light = mkLine('Свет', 'light', 10, 1, 1, [['Люстра', 100, 1]]);
    const power = mkLine('Бойлер', 'power', 10, 1, 1, [['Бойлер', 2000, 1]]);
    const note = (l: Line) => (whyRows(l, calcLine(l, c), c).find(w => w.title === 'Автомат')?.note ?? '');
    expect(note(light)).toContain('п. 4.3.18.5');
    expect(note(power)).toContain('по практике');
  });
  it('gives trip-time limits and bonding sizes in the checklist', () => {
    expect(CHECK_ITEMS.find(i => i.id === 'rcdtime')?.hint).toContain('0,5 с');
    expect(CHECK_ITEMS.find(i => i.id === 'pe')?.hint).toContain('6 мм²');
  });
});
