import { describe, expect, it } from 'vitest';
import { APP_KEYS, CFG_KEYS, FLOOR_KEYS, LINE_KEYS, MEAS_KEYS, PHOTO_KEYS, PROJECT_KEYS, ROOM_APP_KEYS, ROOM_KEYS, WEAK_PT_KEYS, fullProject } from './full';
import { calc } from './docs';

const missing = (keys: Record<string, 1>, items: object[]): string[] =>
  Object.keys(keys).filter(k => !items.some(x => (x as Record<string, unknown>)[k] !== undefined));

describe('full project fixture', () => {
  const p = fullProject();

  it('fills every field of the project model', () => {
    expect(missing(PROJECT_KEYS, [p])).toEqual([]);
    expect(missing(CFG_KEYS, [p.cfg])).toEqual([]);
    expect(missing(LINE_KEYS, p.lines)).toEqual([]);
    expect(missing(APP_KEYS, p.lines.flatMap(l => l.apps))).toEqual([]);
    expect(missing(MEAS_KEYS, p.lines.flatMap(l => (l.meas ? [l.meas] : [])))).toEqual([]);
    expect(missing(PHOTO_KEYS, p.photos ?? [])).toEqual([]);
    expect(missing(ROOM_KEYS, p.rooms ?? [])).toEqual([]);
    expect(missing(ROOM_APP_KEYS, (p.rooms ?? []).flatMap(r => r.apps))).toEqual([]);
    expect(missing(FLOOR_KEYS, p.floor ?? [])).toEqual([]);
    expect(missing(WEAK_PT_KEYS, p.weak?.pts ?? [])).toEqual([]);
  });

  it('uses every optional branch of the calculation', () => {
    const a = calc(p);
    expect(a.c).toMatchObject({ supply: 3, house: true, spd: true, vr: true, afdd: 'sock', rcdMode: true, grpCable: 'nym', inCable: 'frls' });
    expect(a.prio?.p.length).toBeGreaterThan(0);
    expect(a.prio?.s.length).toBeGreaterThan(0);
    expect(a.house).toBeTruthy();
    expect(a.weak?.points).toBeGreaterThan(0);
    expect(a.floor?.length).toBe(2);
    expect(a.uzos.length).toBeGreaterThan(1);
    expect(a.rows.some(x => x.r.three)).toBe(true);
    expect(a.rows.some(x => x.r.zsMeas !== null)).toBe(true);
    expect(a.rows.some(x => x.l.out)).toBe(true);
  });
});
