import { describe, expect, it } from 'vitest';
import { appPower, canSplit, fixFor, maxLenFor, splitApps } from '../../core/fixes';
import { calcLine, cfgN } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import type { App, Cfg, Line, LineType, Num } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}) => cfgN({ ...defaultCfg(), ...o });
const ap = (id: string, w: Num, n: Num, name = id): App => ({ id, name, w, n });
const line = (type: LineType, len: Num, apps: App[], o: Partial<Line> = {}): Line => ({
  ...mkLine('Линия', type, 10, 1, 1, []),
  type,
  len,
  apps,
  ...o
});
const fix = (l: Line, c = cfg()) => fixFor(l, calcLine(l, c), c);

describe('appPower and canSplit', () => {
  it('multiplies and clamps negatives and junk', () => {
    expect(appPower({ w: 100, n: 3 })).toBe(300);
    expect(appPower({ w: '1,5', n: '2' })).toBe(3);
    expect(appPower({ w: -5, n: 2 })).toBe(0);
    expect(appPower({ w: 5, n: -2 })).toBe(0);
    expect(appPower({ w: 'x', n: 2 })).toBe(0);
  });
  it('allows split for two live apps or one app with n>=2', () => {
    expect(canSplit(line('power', 5, [ap('a', 100, 1), ap('b', 100, 1)]))).toBe(true);
    expect(canSplit(line('power', 5, [ap('a', 100, 2)]))).toBe(true);
    expect(canSplit(line('power', 5, [ap('a', 100, 1)]))).toBe(false);
    expect(canSplit(line('power', 5, [ap('a', 100, 1), ap('b', 0, 1)]))).toBe(false);
    expect(canSplit(line('power', 5, []))).toBe(false);
  });
});

describe('maxLenFor', () => {
  it('finds a shorter working length', () => {
    const l = line('power', 400, [ap('a', 3500, 1)]);
    const c = cfg();
    expect(calcLine(l, c).status).toBe('bad');
    const L = maxLenFor(l, c) as number;
    expect(L).toBeGreaterThan(0);
    expect(L).toBeLessThan(400);
    const ok = calcLine({ ...l, len: L }, c);
    expect(ok.status).not.toBe('bad');
    expect(calcLine({ ...l, len: L + 1 }, c).status).toBe('bad');
  });
  it('returns null when no shorter length helps or the length is tiny', () => {
    const c = cfg({ zs: 2 });
    expect(maxLenFor(line('power', 50, [ap('a', 3500, 1)]), c)).toBeNull();
    expect(maxLenFor(line('power', 1, [ap('a', 3500, 1)]), c)).toBeNull();
    expect(maxLenFor(line('power', 0, [ap('a', 3500, 1)]), c)).toBeNull();
  });
});

describe('fixFor', () => {
  it('is null for empty and fine lines', () => {
    expect(fix(line('light', 10, []))).toBeNull();
    expect(fix(line('light', 10, [ap('a', 100, 1)]))).toBeNull();
  });
  it('overload without a breaker: split when possible', () => {
    const big = line('power', 10, [ap('a', 10000, 1), ap('b', 10000, 1)]);
    expect(calcLine(big, cfg()).In).toBeNull();
    const f = fix(big);
    expect(f?.act).toEqual({ k: 'half' });
    expect(f?.label).toBe('Разделить');
    expect(f?.text).toContain('разделите её на две');
  });
  it('overload without a breaker: reduce power when not splittable', () => {
    const f = fix(line('power', 10, [ap('a', 30000, 1)]));
    expect(f?.act).toBeNull();
    expect(f?.label).toBeNull();
    expect(f?.text).toContain('уменьшите мощность');
  });
  it('measured insulation below the norm', () => {
    const f = fix(line('light', 10, [ap('a', 100, 1)], { meas: { ins: '0,3' } }));
    expect(f?.text).toContain('Изоляция ниже нормы');
    expect(f?.act).toBeNull();
  });
  it('measured loop too large', () => {
    const f = fix(line('light', 10, [ap('a', 100, 1)], { meas: { zs: 5 } }));
    expect(f?.text).toContain('петля велика');
    expect(f?.act).toBeNull();
  });
  it('measured leakage too large', () => {
    const f = fix(line('light', 10, [ap('a', 100, 1)], { meas: { leak: 20 } }));
    expect(f?.text).toContain('Утечка больше трети');
    expect(f?.act).toBeNull();
  });
  it('measured leakage within the limit gives no fix', () => {
    expect(fix(line('light', 10, [ap('a', 100, 1)], { meas: { leak: 2, ins: 100, zs: 0.2 } }))).toBeNull();
  });
  it('bad line shortens using maxLenFor', () => {
    const l = line('power', 400, [ap('a', 3500, 1)]);
    const f = fix(l);
    const L = maxLenFor(l, cfg()) as number;
    expect(f?.act).toEqual({ k: 'len', len: L });
    expect(f?.label).toBe('Сократить до ' + L + ' м');
    expect(f?.text).toBe('Сократите линию до ' + L + ' м.');
  });
  it('bad line with no workable length splits when possible', () => {
    const c = cfg({ zs: 2 });
    const l = line('power', 50, [ap('a', 3500, 1), ap('b', 100, 1)]);
    const f = fix(l, c);
    expect(f?.act).toEqual({ k: 'half' });
    expect(f?.text).toContain('слишком длинная');
  });
  it('bad line with no workable length and no split', () => {
    const c = cfg({ zs: 2 });
    const f = fix(line('power', 50, [ap('a', 3500, 1)]), c);
    expect(f?.act).toBeNull();
    expect(f?.text).toContain('уменьшите длину или мощность');
  });
  it('heavy socket line moves the biggest appliance out', () => {
    const l = line('socket', 10, [ap('a', 1000, 1, 'Чайник'), ap('b', 3500, 1, 'Духовка')]);
    const r = calcLine(l, cfg());
    expect(r.In).toBeGreaterThan(16);
    expect(r.status).not.toBe('bad');
    const f = fixFor(l, r, cfg());
    expect(f?.act).toEqual({ k: 'largest' });
    expect(f?.label).toBe('Вынести');
    expect(f?.text).toBe('Вынесите «Духовка» в отдельную линию.');
  });
  it('uses a fallback name for an unnamed appliance', () => {
    const l = line('socket', 10, [ap('a', 1000, 1, ''), ap('b', 3500, 1, '')]);
    expect(fix(l)?.text).toBe('Вынесите «прибор» в отдельную линию.');
  });
  it('heavy socket line that cannot be split has no fix', () => {
    const l = line('socket', 10, [ap('a', 4600, 1)]);
    const r = calcLine(l, cfg());
    expect(r.In).toBeGreaterThan(16);
    expect(fixFor(l, r, cfg())).toBeNull();
  });
});

describe('splitApps', () => {
  it('returns null for no live appliances in any mode', () => {
    const l = line('power', 5, [ap('a', 0, 1)]);
    expect(splitApps(l, 'largest')).toBeNull();
    expect(splitApps(l, 'half')).toBeNull();
    expect(splitApps(line('power', 5, []), 'half')).toBeNull();
  });
  it('largest needs two live appliances', () => {
    expect(splitApps(line('power', 5, [ap('a', 100, 3), ap('z', 0, 1)]), 'largest')).toBeNull();
  });
  it('largest moves the biggest and keeps dead ones', () => {
    const r = splitApps(line('power', 5, [ap('a', 100, 1), ap('z', 0, 1), ap('b', 500, 1)]), 'largest');
    expect(r?.move.map(x => x.id)).toEqual(['b']);
    expect(r?.keep.map(x => x.id)).toEqual(['a', 'z']);
  });
  it('half splits the count of a single appliance', () => {
    const r = splitApps(line('power', 5, [ap('a', 100, 5), ap('z', 0, 1)]), 'half');
    expect(r?.keep.map(x => [x.id, x.n])).toEqual([['a', 3], ['z', 1]]);
    expect(r?.move.map(x => [x.id, x.n])).toEqual([['a', 2]]);
  });
  it('half with a fractional count floors it first', () => {
    const r = splitApps(line('power', 5, [ap('a', 100, '4,9')]), 'half');
    expect(r?.keep[0].n).toBe(2);
    expect(r?.move[0].n).toBe(2);
  });
  it('half returns null for a single appliance with n below 2', () => {
    expect(splitApps(line('power', 5, [ap('a', 100, 1)]), 'half')).toBeNull();
    expect(splitApps(line('power', 5, [ap('a', 100, 1.5)]), 'half')).toBeNull();
  });
  it('half balances several appliances and keeps dead ones on the line', () => {
    const l = line('power', 5, [ap('a', 1000, 1), ap('d', 0, 1), ap('b', 900, 1), ap('c', 200, 1), ap('e', 100, 1)]);
    const r = splitApps(l, 'half');
    const sum = (xs: App[]) => xs.reduce((s, x) => s + appPower(x), 0);
    expect(r?.keep.map(x => x.id)).toEqual(['a', 'e', 'd']);
    expect(r?.move.map(x => x.id)).toEqual(['b', 'c']);
    expect(sum(r?.keep ?? [])).toBe(1100);
    expect(sum(r?.move ?? [])).toBe(1100);
  });
});
