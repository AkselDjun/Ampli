import { describe, expect, it } from 'vitest';
import { balanceLines, calcAll, calcLine, cfgN, loopOhm, pack, shortCircuit } from '../../core/calc';
import { defaultCfg, mkLine, sample } from '../../core/templates';
import type { Cfg, Device, Line } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), ...o });
const run = (l: Line, o: Partial<Cfg> = {}) => calcLine(l, cfgN(cfg(o)));
const pw = (w: number, len = 10, type: 'light' | 'socket' | 'power' = 'power', extra: Partial<Line> = {}): Line => ({
  ...mkLine('x', type, len, null, null, [['a', w, 1]]),
  ...extra
});

describe('cfgN', () => {
  it('normalizes defaults', () => {
    expect(cfgN(cfg())).toEqual({ supply: 1, method: 'wall', drop: 0, ko: 0.75, k: 0.9, alloc: 15, safe: true, zs: 0.3, feeder: 0 });
  });
  it('accepts three phase, open method and norm minS', () => {
    const c = cfgN(cfg({ supply: '3', method: 'open', minS: 'norm' }));
    expect([c.supply, c.method, c.safe]).toEqual([3, 'open', false]);
  });
  it('clamps values and falls back on garbage', () => {
    const c = cfgN(cfg({ drop: -5, ko: 5, k: 0.1, alloc: 0, zs: 0, feeder: 9 }));
    expect([c.drop, c.ko, c.k, c.alloc, c.zs, c.feeder]).toEqual([0, 1, 0.5, 0.5, 0.05, 3]);
    const g = cfgN(cfg({ drop: 'abc', ko: 'abc', k: '', alloc: 'x', zs: 'x', feeder: 'x', supply: 'z', method: 'q' }));
    expect([g.drop, g.ko, g.k, g.alloc, g.zs, g.feeder, g.supply, g.method]).toEqual([0, 0.75, 0.9, 15, 0.3, 0, 1, 'wall']);
    expect(cfgN(cfg({ ko: 0.1, zs: 9, k: 3 })).ko).toBe(0.3);
    expect(cfgN(cfg({ zs: 9 })).zs).toBe(2);
    expect(cfgN(cfg({ k: 3 })).k).toBe(1);
  });
  it('accepts decimal comma', () => {
    expect(cfgN(cfg({ ko: '0,6' })).ko).toBe(0.6);
  });
});

describe('loop and short circuit', () => {
  it('computes loop resistance with PE cap', () => {
    expect(loopOhm(2.5, 10)).toBeCloseTo(0.0225 * 1.5 * 10 * (2 / 2.5), 6);
    expect(loopOhm(25, 10)).toBeCloseTo(0.0225 * 1.5 * 10 * (1 / 25 + 1 / 16), 6);
  });
  it('computes short circuit current', () => {
    expect(shortCircuit(2.5, 0, 0.3)).toBeCloseTo(230 / 0.3, 6);
    expect(shortCircuit(2.5, 10, 0.3)).toBeCloseTo(230 / (0.3 + loopOhm(2.5, 10)), 6);
  });
});

describe('calcLine basics', () => {
  it('flags empty lines', () => {
    const r = run(mkLine('e', 'socket', 10, null, null, []));
    expect(r.empty).toBe(true);
    expect([r.I, r.pd, r.In, r.S]).toEqual([0, 0, null, null]);
    expect(r.status).toBe('ok');
  });
  it('treats negative and garbage power as zero', () => {
    const l = mkLine('e', 'socket', 10, null, null, [['a', -5, 1], ['b', 100, -2]]);
    l.apps.push({ id: 'z', name: 'z', w: 'abc', n: 'x' });
    expect(run(l).empty).toBe(true);
  });
  it('picks breaker, section, rcd for a plain socket line', () => {
    const r = run(pw(2000, 10, 'socket'));
    expect([r.In, r.S, r.curve, r.rcd, r.ma, r.mod, r.status]).toEqual([16, 2.5, 'C', true, 30, 2, 'ok']);
    expect(r.pInst).toBe(2000);
    expect(r.pd).toBeCloseTo(1400, 6);
    expect(r.ikNeed).toBe(160);
    expect(r.leakLim).toBeCloseTo(10, 6);
    expect(r.leakEst).toBeCloseTo(0.1, 6);
    expect(r.ikSrc).toBe('calc');
  });
  it('uses light limits and curve B', () => {
    const r = run(pw(100, 10, 'light'));
    expect([r.In, r.S, r.curve, r.limit, r.ikNeed]).toEqual([10, 1.5, 'B', 3, 50]);
  });
  it('rises the voltage drop limit above 100 m and subtracts feeder', () => {
    expect(run(pw(100, 200, 'light')).limit).toBeCloseTo(3.5, 6);
    expect(run(pw(100, 500, 'light')).limit).toBeCloseTo(3.5, 6);
    expect(run(pw(100, 10, 'light'), { feeder: 1 }).limit).toBeCloseTo(2, 6);
    expect(run(pw(100, 10, 'light'), { feeder: 3 }).limit).toBe(0.5);
    expect(run(pw(100, 10, 'light'), { drop: 2 }).limit).toBe(2);
    expect(run(pw(100, 10, 'light'), { drop: 10 }).limit).toBe(3);
  });
  it('uses 100 mA rcd above 32 A and 10 mA for wet rooms', () => {
    expect(run(pw(8000, 5)).ma).toBe(100);
    expect(run(pw(8000, 5, 'power', { wet: true })).ma).toBe(10);
    expect(run(pw(8000, 5, 'power', { wet: true })).leakLim).toBeCloseTo(10 / 3, 6);
  });
  it('clamps kc and cos', () => {
    const r = run(pw(1000, 10, 'power', { kc: 0, cos: 0 }));
    expect([r.kc, r.cos]).toEqual([0.05, 0.3]);
    const r2 = run(pw(1000, 10, 'power', { kc: 5, cos: 5 }));
    expect([r2.kc, r2.cos]).toEqual([1, 1]);
    const r3 = run(pw(1000, 10, 'socket', { kc: 'x', cos: 'y' }));
    expect([r3.kc, r3.cos]).toEqual([0.7, 0.95]);
    expect(run(pw(1000, 'bad' as unknown as number)).len).toBe(0);
  });
});

describe('three phase and method', () => {
  it('computes three phase current and modules', () => {
    const r = run(pw(9000, 10, 'power', { phase: '3', cos: 1 }), { supply: 3 });
    expect(r.three).toBe(true);
    expect(r.I).toBeCloseTo(9000 / (Math.sqrt(3) * 400), 6);
    expect(r.mod).toBe(4);
    expect(r.In).toBe(16);
  });
  it('ignores phase 3 on single phase supply and non-power types', () => {
    expect(run(pw(9000, 10, 'power', { phase: '3' })).three).toBe(false);
    expect(run(pw(2000, 10, 'socket', { phase: '3' }), { supply: 3 }).three).toBe(false);
  });
  it('open method allows smaller section', () => {
    expect(run(pw(5000, 5), { method: 'wall' }).S).toBe(4);
    expect(run(pw(5000, 5), { method: 'open' }).S).toBe(2.5);
  });
  it('minS norm allows 1.5 mm2 for sockets', () => {
    expect(run(pw(500, 5, 'socket')).S).toBe(2.5);
    const r = run(pw(500, 5, 'socket'), { minS: 'norm' });
    expect(r.S).toBe(1.5);
    expect(r.In).toBe(16);
  });
  it('cannot fit a cable when derating is too strong', () => {
    const r = run(pw(35000, 5, 'power', { phase: '3', cos: 1 }), { supply: 3, k: 0.5 });
    expect(r.status).toBe('bad');
    expect(r.In).toBeNull();
    expect(r.S).toBeNull();
    expect(r.notes[0]).toContain('35');
  });
  it('rejects currents above 63 A', () => {
    const r = run(pw(20000, 5));
    expect(r.In).toBeNull();
    expect(r.status).toBe('bad');
    expect(r.notes[0]).toContain('63');
  });
});

describe('voltage drop', () => {
  it('upsizes cable for voltage drop and warns', () => {
    const r = run(pw(3000, 60, 'light', { kc: 1, cos: 1 }));
    expect(r.S).toBeGreaterThan(1.5);
    expect(r.status).toBe('warn');
    expect(r.notes.some(n => n.includes('падения напряжения'))).toBe(true);
    expect(r.drop).toBeLessThanOrEqual(r.limit);
  });
  it('upsizes three phase on drop', () => {
    const r = run(pw(20000, 120, 'power', { phase: '3', cos: 1 }), { supply: 3 });
    expect(r.three).toBe(true);
    expect(r.S).toBeGreaterThan(2.5);
  });
  it('is bad when even 35 mm2 drops too much', () => {
    const r = run(pw(8000, 2000, 'power', { cos: 1 }), { zs: 0.05 });
    expect(r.S).toBe(35);
    expect(r.status).toBe('bad');
    expect(r.notes.some(n => n.includes('35 мм²'))).toBe(true);
  });
});

describe('short circuit checks', () => {
  it('upsizes cable for KZ', () => {
    const r = run(pw(500, 70, 'power', { cos: 1 }), { zs: 0.5 });
    expect(r.notes.some(n => n.includes('короткое замыкание'))).toBe(true);
    expect(r.status).toBe('warn');
    expect(r.ik).toBeGreaterThanOrEqual(r.ikNeed);
  });
  it('flags a line that cannot be protected', () => {
    const r = run(pw(500, 400, 'power', { cos: 1 }), { zs: 2 });
    expect(r.status).toBe('bad');
    expect(r.ik).toBeLessThan(r.ikNeed);
    expect(r.notes.some(n => n.includes('Сократите линию'))).toBe(true);
  });
  it('skips KZ without length', () => {
    const r = run(pw(500, 0, 'power'));
    expect(r.ik).toBe(0);
    expect(r.status).toBe('warn');
    expect(r.notes.some(n => n.includes('Укажите длину'))).toBe(true);
  });
  it('overrides loop with measurement', () => {
    const ok = run(pw(2000, 10, 'socket', { meas: { zs: '0,5' } }));
    expect(ok.ikSrc).toBe('meas');
    expect(ok.zsMeas).toBe(0.5);
    expect(ok.ik).toBeCloseTo(460, 6);
    expect(ok.status).toBe('ok');
    const bad = run(pw(2000, 10, 'socket', { meas: { zs: 5 } }));
    expect(bad.status).toBe('bad');
    expect(bad.notes.some(n => n.includes('По замеру петли'))).toBe(true);
    const noLen = run(pw(2000, 0, 'socket', { meas: { zs: 5 } }));
    expect(noLen.status).toBe('bad');
    expect(run(pw(2000, 10, 'socket', { meas: { zs: 'abc' } })).ikSrc).toBe('calc');
  });
});

describe('leakage and insulation', () => {
  it('flags measured leakage above a third of rcd', () => {
    const r = run(pw(2000, 10, 'socket', { meas: { leak: 12 } }));
    expect(r.leakMeas).toBe(12);
    expect(r.status).toBe('bad');
    expect(r.notes.some(n => n.includes('Ток утечки'))).toBe(true);
  });
  it('accepts measured leakage below limit and skips estimate', () => {
    const r = run(pw(2000, 2000, 'socket', { meas: { leak: 1 } }), { zs: 0.05 });
    expect(r.leakMeas).toBe(1);
    expect(r.notes.some(n => n.includes('Утечка самой линии'))).toBe(false);
  });
  it('warns on estimated leakage', () => {
    const r = run(pw(2000, 400, 'socket', { wet: true }));
    expect(r.leakEst).toBeCloseTo(4, 6);
    expect(r.notes.some(n => n.includes('Утечка самой линии'))).toBe(true);
    expect(['warn', 'bad']).toContain(r.status);
  });
  it('keeps bad status on estimated leakage', () => {
    const r = run(pw(2000, 400, 'socket', { wet: true }), { zs: 2 });
    expect(r.status).toBe('bad');
  });
  it('checks insulation', () => {
    const low = run(pw(2000, 10, 'socket', { meas: { ins: 0.2 } }));
    expect([low.insMeas, low.status]).toEqual([0.2, 'bad']);
    const ok = run(pw(2000, 10, 'socket', { meas: { ins: '500' } }));
    expect([ok.insMeas, ok.status]).toEqual([500, 'ok']);
  });
});

describe('socket limits', () => {
  it('warns on large socket group', () => {
    const r = run(pw(8000, 10, 'socket'));
    expect(r.In).toBe(32);
    expect(r.status).toBe('warn');
    expect(r.notes.some(n => n.includes('розеточной'))).toBe(true);
  });
  it('keeps bad over warn for socket and zero length', () => {
    const r = run(pw(8000, 0, 'socket', { meas: { ins: 0.1 } }));
    expect(r.status).toBe('bad');
  });
});

describe('pack', () => {
  const d = (mod: number): Device => ({ kind: 'mcb', mod, label: '', sub: '', title: '' });
  it('wraps rows', () => {
    expect(pack([], 12)).toBe(0);
    expect(pack([d(2), d(2)], 12)).toBe(4);
    expect(pack([d(8), d(8)], 12)).toBe(20);
    expect(pack([d(4), d(4), d(4), d(4)], 12)).toBe(16);
  });
});

describe('calcAll', () => {
  it('handles no lines', () => {
    const a = calcAll([], cfg());
    expect([a.inIn, a.inS, a.Itot, a.P, a.devs.length, a.size, a.fits, a.placed, a.imb, a.inStep, a.issues]).toEqual([null, null, 0, 0, 0, 12, true, 0, 0, 0, 0]);
    expect(a.phases).toBeNull();
  });
  it('handles only empty lines', () => {
    const a = calcAll([mkLine('e', 'socket', 10, null, null, [])], cfg());
    expect(a.inIn).toBeNull();
    expect(a.devs).toEqual([]);
    expect(a.issues).toBe(0);
  });
  it('computes the sample apartment', () => {
    const s = sample();
    const a = calcAll(s.lines, s.cfg);
    expect(a.inIn).toBe(63);
    expect(a.devs[0].kind).toBe('in');
    expect(a.devs[0].mod).toBe(2);
    expect(a.devs[1].sub).toBe('Г1 30мА');
    expect(a.inStep).toBeGreaterThan(0);
    expect(a.hint3).toBe(false);
    expect(a.fits).toBe(true);
  });
  it('computes three phase totals, imbalance and fallback phase', () => {
    const lines = [
      pw(9000, 10, 'power', { phase: '3', cos: 1 }),
      pw(2000, 10, 'socket', { phase: 'L2' }),
      pw(1000, 10, 'socket', { phase: 'L3' }),
      pw(1000, 10, 'socket', { phase: '3' }),
      pw(500, 10, 'socket', { phase: 'bad' as unknown as 'L1' })
    ];
    const a = calcAll(lines, cfg({ supply: 3 }));
    expect(a.phases).not.toBeNull();
    expect(a.devs[0].mod).toBe(4);
    expect(a.Itot).toBe(Math.max(a.phases!.L1, a.phases!.L2, a.phases!.L3));
    expect(a.imb).toBeGreaterThan(0);
    expect(a.phases!.L2).toBeGreaterThan(a.phases!.L3);
    const mods = a.devs.map(d => d.mod);
    expect(mods).toContain(4);
    expect(mods).toContain(2);
  });
  it('gives zero imbalance when three phase has no load', () => {
    const a = calcAll([], cfg({ supply: 3 }));
    expect(a.imb).toBe(0);
    expect(a.phases).toEqual({ L1: 0, L2: 0, L3: 0 });
  });
  it('shows 12 kW single input hint', () => {
    const lines = [pw(7000, 10), pw(7000, 10), pw(7000, 10)];
    const a = calcAll(lines, cfg({ ko: 1 }));
    expect(a.P).toBeGreaterThan(12000);
    expect(a.hint3).toBe(true);
    expect(calcAll(lines, cfg({ ko: 1, supply: 3 })).hint3).toBe(false);
  });
  it('gives null input breaker for overload', () => {
    const lines = Array.from({ length: 12 }, () => pw(12000, 10, 'power', { cos: 1 }));
    const a = calcAll(lines, cfg({ ko: 1 }));
    expect(a.inIn).toBeNull();
    expect(a.inS).toBeNull();
    expect(a.devs.some(d => d.kind === 'in')).toBe(false);
    expect(a.inStep).toBe(0);
  });
  it('gives null input cable when derating is strong', () => {
    const a = calcAll([pw(12000, 10, 'power', { cos: 1 })], cfg({ k: 0.5 }));
    expect(a.inIn).toBe(100);
    expect(a.inS).toBeNull();
  });
  it('skips lines without breaker in devices and counts issues', () => {
    const a = calcAll([pw(20000, 10), pw(1000, 10, 'socket')], cfg());
    expect(a.rows[0].r.In).toBeNull();
    expect(a.devs.filter(d => d.kind !== 'in').length).toBe(1);
    expect(a.issues).toBe(1);
    expect(a.inIn).not.toBeNull();
  });
  it('produces mcb for lines without rcd and size overflow', () => {
    const lines = Array.from({ length: 40 }, () => pw(2000, 10, 'socket'));
    const a = calcAll(lines, cfg({ ko: 0.3 }));
    expect(a.fits).toBe(false);
    expect(a.size).toBe(72);
    expect(a.placed).toBeGreaterThan(0);
    expect(a.modSum).toBeGreaterThan(72);
  });
  it('selects bigger enclosure sizes', () => {
    const lines = Array.from({ length: 9 }, () => pw(2000, 10, 'socket'));
    const a = calcAll(lines, cfg());
    expect(a.size).toBeGreaterThan(12);
    expect(a.fits).toBe(true);
  });
});

describe('balanceLines', () => {
  it('spreads lines over phases, keeps three phase lines', () => {
    const lines = [
      pw(3000, 10, 'socket'),
      pw(2000, 10, 'socket'),
      pw(1000, 10, 'socket'),
      pw(9000, 10, 'power', { phase: '3', cos: 1 })
    ];
    const out = balanceLines(lines, cfg({ supply: 3 }));
    expect(out[3]).toBe(lines[3]);
    expect(new Set(out.slice(0, 3).map(l => l.phase)).size).toBe(3);
  });
  it('treats lines as single phase when supply is single', () => {
    const lines = [pw(3000, 10), pw(2000, 10)];
    const out = balanceLines(lines, cfg());
    expect(out.length).toBe(2);
    expect(out[0].phase).not.toBe(out[1].phase);
  });
  it('handles empty input', () => {
    expect(balanceLines([], cfg())).toEqual([]);
  });
});
