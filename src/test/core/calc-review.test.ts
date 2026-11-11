import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { appCos, calcAll, calcLine, cfgN, demand } from '../../core/calc';
import { defaultCfg, mkLine, sample } from '../../core/templates';
import { normProject } from '../../core/project';
import { assumptions } from '../../core/assumptions';
import { cableName } from '../../core/protection';
import { whyRows } from '../../core/why';
import { checksOf, inputBySelectivity } from '../../ui/Checks';
import type { Cfg, Line } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), prot: 'rcbo', ...o });
const one = (name: string, w: number, type: Line['type'] = 'power', len = 10): Line => mkLine(name, type, len, [[name, w, 1]]);

describe('RCD setting and leakage have no jump at 32 A', () => {
  it('keeps 30 mA and a continuous leakage estimate around 32 A', () => {
    const c = cfgN(cfg());
    const a = calcLine(one('Духовой шкаф', 7300), c);
    const b = calcLine(one('Духовой шкаф', 7400), c);
    expect([a.ma, b.ma]).toEqual([30, 30]);
    expect(b.leakEst - a.leakEst).toBeLessThan(0.5);
  });
  it('never changes the RCD setting when power grows by one percent', () => {
    fc.assert(fc.property(fc.integer({ min: 100, max: 14000 }), fc.boolean(), (w, wet) => {
      const c = cfgN(cfg());
      const l = { ...one('Прибор', w), wet };
      const r1 = calcLine(l, c);
      const r2 = calcLine({ ...l, apps: [{ ...l.apps[0], w: Math.round(w * 1.01) }] }, c);
      if (r1.empty || r2.empty || !r1.In || !r2.In) return;
      expect(r2.ma).toBe(r1.ma);
      expect(r2.leakEst / r1.leakEst).toBeLessThan(1.1);
    }));
  });
});

describe('breaker margin and practical minimum', () => {
  it('puts washing machines, dishwashers and water heaters on at least 16 A', () => {
    const c = cfgN(cfg());
    ['Стиральная машина', 'Посудомоечная машина', 'Водонагреватель', 'Сушильная машина'].forEach(n => {
      const r = calcLine(one(n, 1500), c);
      expect(r.In).toBe(16);
      expect(r.tips.join(' ')).toContain('Автомат не меньше 16 А');
    });
    expect(calcLine(one('Тёплый пол', 450), c).In).toBe(10);
  });
  it('shows the breaker load and warns above 90 %', () => {
    const c = cfgN(cfg());
    const r = calcLine(one('Варочная панель', 7200), c);
    expect(r.In).toBe(32);
    expect(r.load).toBeCloseTo(7200 / 230 / 32, 6);
    expect(r.tips.join(' ')).toContain('Автомат загружен на 98 %');
    expect(calcLine(one('Чайник', 1000, 'socket'), c).tips.join(' ')).not.toContain('загружен');
  });
  it('applies the margin from the network settings', () => {
    const r = calcLine(one('Духовой шкаф', 3500), cfgN(cfg({ margin: 1.2 })));
    expect(r.In).toBe(20);
    expect(r.load).toBeLessThan(0.9);
    expect(cfgN(cfg({ margin: 9 })).margin).toBe(1.5);
    expect(cfgN(cfg({ margin: 0.2 })).margin).toBe(1);
    expect(cfgN(cfg({ margin: 'x' })).margin).toBe(1);
  });
  it('falls back to the plain current when the margin passes 63 A', () => {
    const r = calcLine(one('Котёл', 13000), cfgN(cfg({ margin: 1.5 })));
    expect(r.In).toBe(63);
  });
  it('describes the margin in assumptions and the why block', () => {
    const c = cfgN(cfg({ margin: 1.2 }));
    const as = assumptions(c).find(x => x.name === 'Номинал группового автомата');
    expect(as?.value).toContain('× 1,2');
    expect(as?.basis).toBe('user');
    expect(assumptions(cfgN(cfg())).find(x => x.name === 'Номинал группового автомата')?.basis).toBe('practice');
    const l = one('Духовой шкаф', 3500);
    const w = whyRows(l, calcLine(l, c), c).find(x => x.title === 'Автомат');
    expect(w?.note).toContain('× запас 1,2');
    expect(w?.note).toContain('Загрузка автомата');
  });
});

describe('cos φ and appliances that do not run together', () => {
  it('uses 0,8 for compressors and pumps unless set on the appliance', () => {
    expect(appCos({ id: 'a', name: 'Кондиционер', w: 1000, n: 1 })).toBe(0.8);
    expect(appCos({ id: 'a', name: 'Насос', w: 1000, n: 1 })).toBe(0.8);
    expect(appCos({ id: 'a', name: 'Чайник', w: 1000, n: 1 })).toBe(1);
    expect(appCos({ id: 'a', name: 'Кондиционер', w: 1000, n: 1, cos: '0,95' })).toBe(0.95);
    expect(appCos({ id: 'a', name: 'Чайник', w: 1000, n: 1, cos: 5 })).toBe(1);
  });
  it('raises the current by cos φ and explains it', () => {
    const c = cfgN(cfg());
    const l = one('Кондиционер', 2000);
    const r = calcLine(l, c);
    expect(r.pd).toBe(2000);
    expect(r.cos).toBeCloseTo(0.8, 6);
    expect(r.I).toBeCloseTo(2000 / 0.8 / 230, 6);
    const w = whyRows(l, r, c).find(x => x.title === 'Ток');
    expect(w?.formula).toContain('/ 0,8');
    expect(w?.note).toContain('cos φ группы 0,8');
  });
  it('counts only the largest of the appliances marked as not simultaneous', () => {
    const l = mkLine('Кухня', 'socket', 10, [['Чайник', 2200, 1], ['Тостер', 900, 1], ['Холодильник', 150, 1]]);
    const marked = { ...l, apps: l.apps.map((a, i) => (i < 2 ? { ...a, alt: true } : a)) };
    expect(demand(marked.apps).w).toBe(2350);
    const c = cfgN(cfg());
    const r = calcLine(marked, c);
    expect(r.pInst).toBe(3250);
    expect(r.pd).toBe(2350);
    expect(r.I).toBeCloseTo(2350 / 230, 6);
    expect(whyRows(marked, r, c)[0].note).toContain('не одновременно');
    expect(demand([]).w).toBe(0);
  });
});

describe('10 mA RCD per room is split above 40 A', () => {
  it('splits the bathroom of the sample apartment into two RCDs', () => {
    const s = sample();
    const a = calcAll(s.lines, s.cfg);
    const bath = a.uzos.filter(u => u.ma === 10);
    expect(bath.map(u => u.zone)).toEqual(['Ванная · 1', 'Ванная · 2']);
    expect(bath.every(u => u.sumIn <= 40 && u.In <= 40)).toBe(true);
    expect(a.devs.filter(d => d.kind === 'uzo')).toHaveLength(4);
  });
  it('keeps one RCD when the sum fits', () => {
    const ls = [{ ...one('Розетка', 1500, 'socket'), zone: 'Ванная', wet: true }, { ...one('Свет', 100, 'light'), zone: 'Ванная', wet: true }];
    const a = calcAll(ls, cfg({ prot: 'rcd' }));
    expect(a.uzos.map(u => [u.zone, u.ma])).toEqual([['Ванная', 10]]);
  });
});

describe('cable brand of the groups', () => {
  it('uses the chosen brand in names and assumptions', () => {
    const c = cfgN(cfg({ grpCable: 'nym' }));
    const r = calcLine(one('Чайник', 2000, 'socket'), c);
    expect(cableName(r)).toBe('NYM 3×2,5');
    expect(assumptions(c).find(x => x.name === 'Кабель групп')?.value).toBe('NYM');
    expect(cfgN(cfg({ grpCable: 'frls' })).grpCable).toBe('frls');
    expect(cfgN(cfg({ grpCable: 'x' })).grpCable).toBe('vvg');
    expect(cableName({ ...r, cab: '' })).toBe('ВВГнг(А)-LS 3×2,5');
  });
});

describe('input breaker raised by selectivity', () => {
  const big = [one('Электроплита', 8000), one('Свет', 300, 'light')];
  it('offers to split the largest group or use three phases', () => {
    const a = calcAll(big, cfg({ alloc: 10 }));
    expect(a.inIn).toBe(63);
    const sel = inputBySelectivity(a);
    expect(sel?.top).toBe(40);
    expect(sel?.next).toBe(50);
    const ch = checksOf(a).find(x => x.t.startsWith('Вводной автомат C63 задан селективностью'));
    expect(ch?.t).toContain('например варочную панель и духовой шкаф отдельно');
    expect(ch?.t).toContain('или питайте прибор от трёх фаз');
    expect(ch?.fix).toBe('phase3');
    expect(ch?.groups).toEqual([a.rows[0].l.id]);
  });
  it('keeps the plain warning when the load itself needs the input', () => {
    const a = calcAll([one('Бойлер', 3000), one('Обогреватель', 3000), one('Сауна', 3000), one('Духовка', 3000)], cfg({ alloc: 13, ko: 1 }));
    expect(inputBySelectivity(a)).toBeNull();
    expect(checksOf(a).some(x => x.t.includes('больше тока выделенной мощности') && x.t.includes('уменьшите нагрузку'))).toBe(true);
  });
  it('gives no example for other appliances and suggests network settings on three phases', () => {
    const a = calcAll([one('Сауна', 8000), one('Свет', 300, 'light')], cfg({ alloc: 10, supply: 3 }));
    const ch = checksOf(a).find(x => x.t.includes('задан селективностью'));
    expect(ch?.t).not.toContain('например');
    expect(ch?.fix).toBe('net');
  });
  it('returns null without an input breaker', () => {
    expect(inputBySelectivity(calcAll([], cfg()))).toBeNull();
  });
});

describe('stored projects', () => {
  it('drops legacy group factors and keeps appliance cos and simultaneity', () => {
    const p = normProject({
      name: 'x',
      cfg: defaultCfg(),
      lines: [{ id: 'L', name: 'x', type: 'socket', phase: 'L1', len: 1, kc: 0.7, cos: 0.95, apps: [{ id: 'A', name: 'a', w: 1, n: 1, cos: 0.9, alt: true }, { id: 'B', name: 'b', w: 1, n: 1, cos: '', alt: 'yes' }] }]
    });
    const l = p?.lines[0] as Line & { kc?: unknown };
    expect('kc' in l).toBe(false);
    expect('cos' in l).toBe(false);
    expect([l.apps[0].cos, l.apps[0].alt]).toEqual([0.9, true]);
    expect([l.apps[1].cos, l.apps[1].alt]).toEqual([undefined, undefined]);
  });
});
