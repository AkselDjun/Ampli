import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { IZ, LONG_MIN_IN, LONG_RX, SECTIONS, STD, STD_IN, TYPES, RCD_STD } from '../../core/norms';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Cfg, Line, LineType } from '../../core/types';

const app = fc.record({
  name: fc.constantFrom('Светильник', 'Чайник', 'Стиральная машина', 'Водонагреватель', 'Электроплита', 'Компьютер', 'Кондиционер'),
  w: fc.integer({ min: 0, max: 9000 }),
  n: fc.integer({ min: 1, max: 12 }),
  br: fc.integer({ min: 0, max: 20 })
});

const line = fc.record({
  type: fc.constantFrom<LineType>('light', 'socket', 'power'),
  len: fc.integer({ min: 0, max: 150 }),
  apps: fc.array(app, { minLength: 0, maxLength: 5 }),
  phase: fc.constantFrom('L1', 'L2', 'L3', '3'),
  wet: fc.boolean(),
  zone: fc.constantFrom('', 'Кухня', 'Ванная', 'Комнаты')
}).map(o => {
  const l = mkLine('Г', o.type, o.len, o.apps.map(a => [a.name, a.w, a.n] as [string, number, number]));
  return { ...l, phase: o.phase, wet: o.wet, zone: o.zone, apps: l.apps.map((a, i) => ({ ...a, br: o.apps[i].br })) } as Line;
});

const cfg = fc.record({
  supply: fc.constantFrom(1, 3),
  method: fc.constantFrom('wall', 'open'),
  prot: fc.constantFrom('rcd', 'rcbo'),
  zs: fc.constantFrom(0.1, 0.3, 0.6),
  ko: fc.constantFrom(0.6, 0.75, 1)
}).map(o => ({ ...defaultCfg(), ...o }) as Cfg);

const runs = { numRuns: 400 };

describe('calculation properties on random groups', () => {
  it('never returns NaN or infinity', () => {
    fc.assert(fc.property(line, cfg, (l, c) => {
      const r = calcLine(l, cfgN(c));
      for (const v of [r.I, r.pInst, r.drop, r.ik, r.len, r.cable]) expect(Number.isFinite(v)).toBe(true);
    }), runs);
  });

  it('picks the smallest standard breaker that covers the current and the type minimum', () => {
    fc.assert(fc.property(line, cfg, (l, c) => {
      const r = calcLine(l, cfgN(c));
      if (r.empty || r.In === null) return;
      const long = l.type === 'power' && l.apps.some(a => Number(a.w) > 0 && LONG_RX.test(a.name)) ? LONG_MIN_IN : 0;
      const need = Math.max(r.I, TYPES[l.type].minIn, long);
      expect(r.In).toBeGreaterThanOrEqual(need);
      expect(STD.filter(x => x >= need)[0]).toBe(r.In);
    }), runs);
  });

  it('never puts a breaker above the cable ampacity and keeps the minimum section', () => {
    fc.assert(fc.property(line, cfg, (l, c) => {
      const n = cfgN(c);
      const r = calcLine(l, n);
      if (r.empty || r.In === null || r.S === null) return;
      const k = SECTIONS.indexOf(r.S);
      expect(IZ[n.method][r.three ? 3 : 1][k] * n.k).toBeGreaterThanOrEqual(r.In);
      expect(r.S).toBeGreaterThanOrEqual(TYPES[l.type].minS);
    }), runs);
  });

  it('flags a group as not suitable whenever voltage drop or short circuit current fails', () => {
    fc.assert(fc.property(line, cfg, (l, c) => {
      const r = calcLine(l, cfgN(c));
      if (r.empty || r.In === null) return;
      if (r.drop > r.limit + 1e-9) expect(r.status).toBe('bad');
      if (r.len > 0 && r.ik < r.ikNeed) expect(r.status).toBe('bad');
    }), runs);
  });

  it('a longer line never gets a thinner cable or a smaller voltage drop', () => {
    fc.assert(fc.property(line, cfg, fc.integer({ min: 1, max: 60 }), (l, c, extra) => {
      const n = cfgN(c);
      const a = calcLine(l, n);
      const b = calcLine({ ...l, len: Number(l.len) + extra }, n);
      if (a.empty || a.S === null || b.S === null) return;
      expect(b.S).toBeGreaterThanOrEqual(a.S);
      if (a.S === b.S) expect(b.drop).toBeGreaterThanOrEqual(a.drop);
    }), runs);
  });

  it('a group without load is empty and gets no breaker', () => {
    fc.assert(fc.property(line, cfg, (l, c) => {
      const r = calcLine({ ...l, apps: l.apps.map(a => ({ ...a, w: 0 })), sockets: 0 }, cfgN(c));
      expect(r.empty).toBe(true);
      expect(r.In).toBeNull();
    }), runs);
  });
});

describe('calculation properties on random apartments', () => {
  const flat = fc.array(line, { minLength: 1, maxLength: 12 });

  it('input breaker covers the design current and stays above every group breaker', () => {
    fc.assert(fc.property(flat, cfg, (ls, c) => {
      const a = calcAll(ls, c);
      if (a.inIn === null) return;
      expect(STD_IN).toContain(a.inIn);
      expect(a.inIn).toBeGreaterThanOrEqual(a.Itot - 1e-9);
      for (const x of a.rows) if (x.r.In) expect(a.inIn).toBeGreaterThan(x.r.In);
    }), runs);
  });

  it('every RCD is a standard rating not below the largest breaker behind it', () => {
    fc.assert(fc.property(flat, cfg, (ls, c) => {
      const a = calcAll(ls, c);
      for (const u of a.uzos) {
        expect(RCD_STD).toContain(u.In);
        const maxIn = Math.max(...u.groups.map(i => a.rows[i].r.In as number));
        expect(u.In).toBeGreaterThanOrEqual(Math.min(maxIn, RCD_STD[RCD_STD.length - 1]));
        for (const i of u.groups) expect(a.rows[i].r.uzo).not.toBeNull();
      }
    }), runs);
  });

  it('design power never exceeds installed power', () => {
    fc.assert(fc.property(flat, cfg, (ls, c) => {
      const a = calcAll(ls, c);
      expect(a.P).toBeLessThanOrEqual(a.sumInst + 1e-9);
    }), runs);
  });
});
