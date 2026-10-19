import { describe, expect, it } from 'vitest';
import { cur, init, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { emptyLib, libReducer, normLib } from '../../store/lib';
import { USAGE_LIMIT } from '../../core/catalog';
import { PHOTO_LIMIT } from '../../core/photos';
import { sampleProject } from '../../core/project';
import type { Photo } from '../../core/types';

const mk = (): State => {
  const p = sampleProject();
  return init({ cur: p.id, list: [p] });
};
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);
const ph = (id: string, line = 'l0'): Photo => ({ id, tag: 'before', line, note: '', at: 1 });

describe('photo actions', () => {
  it('adds, notes and deletes photos', () => {
    let s = run(mk(), { t: 'photoAdd', photo: ph('a') }, { t: 'photoAdd', photo: ph('b') });
    expect(cur(s).photos?.map(x => x.id)).toEqual(['a', 'b']);
    s = run(s, { t: 'photoNote', id: 'a', value: 'z'.repeat(300) });
    expect(cur(s).photos?.[0].note).toHaveLength(120);
    expect(cur(s).photos?.[1].note).toBe('');
    s = run(s, { t: 'photoDel', id: 'a' });
    expect(cur(s).photos?.map(x => x.id)).toEqual(['b']);
  });
  it('works when photos are undefined', () => {
    const s0 = mk();
    const p = cur(s0);
    delete p.photos;
    expect(cur(run(s0, { t: 'photoDel', id: 'q' })).photos).toEqual([]);
    expect(cur(run(s0, { t: 'photoNote', id: 'q', value: 'x' })).photos).toEqual([]);
    expect(cur(run(s0, { t: 'photoAdd', photo: ph('a') })).photos).toHaveLength(1);
  });
  it('ignores adds past the limit', () => {
    let s = mk();
    for (let i = 0; i < PHOTO_LIMIT + 3; i++) s = run(s, { t: 'photoAdd', photo: ph('p' + i) });
    expect(cur(s).photos).toHaveLength(PHOTO_LIMIT);
    expect(run(s, { t: 'photoAdd', photo: ph('more') })).toBe(s);
  });
  it('deleting a line removes only its photos', () => {
    const s0 = mk();
    const [l1, l2] = cur(s0).lines;
    let s = run(s0, { t: 'photoAdd', photo: ph('x', l1.id) }, { t: 'photoAdd', photo: ph('y', l2.id) }, { t: 'photoAdd', photo: ph('z', 'other') }, { t: 'select', id: l1.id }, { t: 'delLine' });
    expect(cur(s).photos?.map(x => x.id)).toEqual(['y', 'z']);
    const p = cur(s);
    delete p.photos;
    s = run(s, { t: 'delLine' });
    expect(cur(s).photos).toEqual([]);
  });
  it('lineMeasAt sets measurements on a specific line', () => {
    const s0 = mk();
    const [l1, l2] = cur(s0).lines;
    let s = run(s0, { t: 'lineMeasAt', id: l2.id, field: 'zs', value: '0.5' });
    expect(cur(s).lines[1].meas).toEqual({ zs: '0.5' });
    expect(cur(s).lines[0].meas).toEqual(l1.meas);
    s = run(s, { t: 'lineMeasAt', id: l2.id, field: 'ins', value: '3' });
    expect(cur(s).lines[1].meas).toEqual({ zs: '0.5', ins: '3' });
    expect(s.sel).toBe(s0.sel);
    s = run(s, { t: 'lineMeasAt', id: 'none', field: 'leak', value: '1' });
    expect(cur(s).lines[1].meas).toEqual({ zs: '0.5', ins: '3' });
  });
});

describe('lib usage', () => {
  it('normLib parses usage', () => {
    const l = normLib({
      usage: {
        a: { n: 2.9, at: 5 },
        b: { n: 0, at: 1 },
        c: { n: -1, at: 1 },
        d: null,
        e: { n: 'x' },
        f: { n: Infinity, at: 1 },
        g: { n: 1, at: 'bad' },
        h: 'str'
      }
    });
    expect(l.usage).toEqual({ a: { n: 2, at: 5 }, g: { n: 1, at: 0 } });
    expect(normLib({ usage: 5 }).usage).toEqual({});
  });
  it('use increments and normalizes names', () => {
    let l = libReducer(emptyLib(), { t: 'use', name: ' Ёлка ', at: 10 });
    expect(l.usage).toEqual({ 'елка': { n: 1, at: 10 } });
    l = libReducer(l, { t: 'use', name: 'ЕЛКА', at: 20 });
    expect(l.usage['елка']).toEqual({ n: 2, at: 20 });
    const before = Date.now();
    l = libReducer(l, { t: 'use', name: 'other' });
    expect(l.usage.other.at).toBeGreaterThanOrEqual(before);
    expect(libReducer(l, { t: 'use', name: '   ' })).toBe(l);
  });
  it('evicts the oldest entries beyond the limit', () => {
    let l = emptyLib();
    for (let i = 0; i < USAGE_LIMIT + 5; i++) l = libReducer(l, { t: 'use', name: 'n' + i, at: i + 1 });
    const keys = Object.keys(l.usage);
    expect(keys).toHaveLength(USAGE_LIMIT);
    expect(l.usage.n0).toBeUndefined();
    expect(l.usage.n4).toBeUndefined();
    expect(l.usage.n5).toBeDefined();
    expect(l.usage['n' + (USAGE_LIMIT + 4)]).toBeDefined();
  });
  it('clearUsage empties usage', () => {
    const l = libReducer(libReducer(emptyLib(), { t: 'use', name: 'a' }), { t: 'clearUsage' });
    expect(l.usage).toEqual({});
  });
});
