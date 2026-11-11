import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { TRACE_GRID, TRACE_MAX, TRACE_PTS_MAX, addPoint, dropPoint, normTraces, snapPoint, tracePath, tracedCount, wallCaption, wallPhotos } from '../../core/traces';
import { normPhotos, PHOTO_TAG_LABEL } from '../../core/photos';
import { sampleProject } from '../../core/project';
import { cur, init, reducer } from '../../store/reducer';
import type { Photo } from '../../core/types';

const wall = (o: Partial<Photo> = {}): Photo => ({ id: 'w', tag: 'wall', line: 'l1', note: '', at: 1, ...o });

describe('Trace geometry', () => {
  it('snaps every segment to horizontal or vertical', () => {
    expect(snapPoint(null, 120.4, 330.6, true)).toEqual([120, 331]);
    expect(snapPoint([100, 100], 400, 130, true)).toEqual([400, 100]);
    expect(snapPoint([100, 100], 130, 400, true)).toEqual([100, 400]);
    expect(snapPoint([100, 100], 400, 130, false)).toEqual([400, 130]);
    expect(snapPoint(null, -50, 2000, true)).toEqual([0, TRACE_GRID]);
  });

  it('keeps snapped paths made of straight segments', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.double({ min: -100, max: 1100, noNaN: true }), fc.double({ min: -100, max: 1100, noNaN: true })), { maxLength: 30 }), clicks => {
        let t = { pts: [] as number[], note: '' };
        clicks.forEach(([x, y]) => { t = addPoint(t, x, y, true); });
        for (let i = 2; i + 1 < t.pts.length; i += 2) {
          const dx = t.pts[i] - t.pts[i - 2];
          const dy = t.pts[i + 1] - t.pts[i - 1];
          expect(dx === 0 || dy === 0).toBe(true);
          expect(dx !== 0 || dy !== 0).toBe(true);
        }
        t.pts.forEach(v => expect(v >= 0 && v <= TRACE_GRID).toBe(true));
      }),
      { numRuns: 60 }
    );
  });

  it('limits points, drops the last one and builds an SVG path', () => {
    let t = { pts: [] as number[], note: '' };
    for (let i = 0; i < TRACE_PTS_MAX + 5; i++) t = addPoint(t, i % 2 ? i * 10 : 0, i % 2 ? 0 : i * 10, false);
    expect(t.pts.length).toBe(TRACE_PTS_MAX * 2);
    expect(dropPoint({ pts: [1, 2, 3, 4], note: '' }).pts).toEqual([1, 2]);
    expect(dropPoint({ pts: [], note: '' }).pts).toEqual([]);
    expect(tracePath({ pts: [10, 20, 30, 20, 30, 90], note: '' })).toBe('M10 20 L30 20 L30 90');
  });
});

describe('Trace storage', () => {
  it('normalises traces and drops broken ones', () => {
    const many = Array.from({ length: TRACE_MAX + 3 }, () => ({ pts: [0, 0, 10, 0], note: 'x' }));
    expect(normTraces(many)).toHaveLength(TRACE_MAX);
    expect(normTraces([{ pts: [5, 'a', 1500, -3, 7] , note: 'n'.repeat(300) }])).toEqual([{ pts: [5, 1000, 0, 7], note: 'n'.repeat(120) }]);
    expect(normTraces([{ pts: [1] }, null, { note: 'x' }])).toEqual([]);
    expect(normTraces('x')).toEqual([]);
  });

  it('keeps traces only on wall photos', () => {
    const tr = [{ pts: [0, 0, 100, 0], note: '15 см от потолка' }];
    expect(normPhotos([wall({ traces: tr })])[0].traces).toEqual(tr);
    expect(normPhotos([wall({ tag: 'before', traces: tr })])[0].traces).toBeUndefined();
    expect(normPhotos([wall({ traces: [] })])[0]).not.toHaveProperty('traces');
    expect(PHOTO_TAG_LABEL.wall).toBe('Стена');
  });

  it('saves and clears traces through the reducer', () => {
    const p = sampleProject();
    p.photos = [wall({ line: p.lines[0].id })];
    let s = init({ list: [p], cur: p.id });
    s = reducer(s, { t: 'photoTraces', id: 'w', traces: [{ pts: [0, 0, 0, 500], note: 'над дверью' }, { pts: [1, 1], note: 'короткая' }] });
    expect(cur(s).photos?.[0].traces).toEqual([{ pts: [0, 0, 0, 500], note: 'над дверью' }, { pts: [1, 1], note: 'короткая' }]);
    s = reducer(s, { t: 'photoTraces', id: 'w', traces: [] });
    expect(cur(s).photos?.[0]).not.toHaveProperty('traces');
  });

  it('counts wall photos and traces and names the group', () => {
    const p = sampleProject();
    const photos = [wall({ line: p.lines[1].id, note: 'кухня', traces: [{ pts: [0, 0, 5, 0], note: '' }, { pts: [0, 0, 0, 5], note: '' }] }), wall({ id: 'b', tag: 'before' })];
    expect(wallPhotos(photos)).toHaveLength(1);
    expect(tracedCount(photos)).toBe(2);
    expect(tracedCount(undefined)).toBe(0);
    expect(wallCaption(photos[0], p.lines)).toBe('Г2 ' + p.lines[1].name + ' · кухня');
    expect(wallCaption(wall({ line: 'gone' }), p.lines)).toBe('Группа удалена');
  });
});
