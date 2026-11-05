import { describe, expect, it } from 'vitest';
import { cur, init, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { newProject, normProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { packProject, unpackProject } from '../../core/share';

const mk = (supply = 1): State => {
  const p = newProject({ sample: false, cfg: { ...defaultCfg(), supply }, lines: [mkLine('Свет', 'light', 10, 1, 1, [['', 0, 1]]), mkLine('Розетки', 'socket', 10, 1, 1, [['Чайник', 2000, 1]])] }, 'Т');
  return init({ cur: p.id, list: [p] });
};
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);

describe('floor heating actions', () => {
  it('adds, edits and removes rooms', () => {
    let s = run(mk(), { t: 'floorAdd', use: 'bath' }, { t: 'floorAdd', use: 'room' });
    const [b, r] = cur(s).floor ?? [];
    expect(b).toMatchObject({ name: 'Ванная', use: 'bath', sys: 'mat', wpm: 150 });
    expect(r).toMatchObject({ name: 'Комната', sys: 'film', wpm: 150 });
    s = run(s,
      { t: 'floorSet', id: b.id, field: 'area', value: '3.5' },
      { t: 'floorSet', id: b.id, field: 'name', value: 'В'.repeat(60) },
      { t: 'floorSet', id: b.id, field: 'wpm', value: '200' }
    );
    let x = (cur(s).floor ?? [])[0];
    expect(x).toMatchObject({ area: '3.5', wpm: 150 });
    expect(x.name).toHaveLength(40);
    s = run(s, { t: 'floorSet', id: b.id, field: 'sys', value: 'cable' }, { t: 'floorSet', id: b.id, field: 'wpm', value: '170' });
    x = (cur(s).floor ?? [])[0];
    expect(x).toMatchObject({ sys: 'cable', wpm: '170' });
    s = run(s, { t: 'floorSet', id: b.id, field: 'use', value: 'loggia' });
    expect((cur(s).floor ?? [])[0].wpm).toBe(180);
    s = run(s, { t: 'floorDel', id: b.id });
    expect(cur(s).floor).toHaveLength(1);
    s = run(s, { t: 'floorDel', id: r.id });
    expect('floor' in cur(s)).toBe(false);
  });

  it('writes the heating into a new wet group and updates it on repeat', () => {
    let s = run(mk(3), { t: 'floorAdd', use: 'bath' });
    const id = (cur(s).floor ?? [])[0].id;
    expect(run(s, { t: 'floorApply', id, line: 'new' })).toBe(s);
    s = run(s, { t: 'floorSet', id, field: 'area', value: '3' }, { t: 'floorApply', id, line: 'new' });
    const nl = cur(s).lines[2];
    expect(nl).toMatchObject({ name: 'Тёплый пол: Ванная', type: 'power', zone: 'Ванная', wet: true });
    expect(nl.apps[0]).toMatchObject({ name: 'Тёплый пол (Ванная)', w: 450, n: 1 });
    s = run(s, { t: 'floorSet', id, field: 'area', value: '4' }, { t: 'floorApply', id, line: nl.id });
    expect(cur(s).lines[2].apps).toHaveLength(1);
    expect(cur(s).lines[2].apps[0].w).toBe(600);
    s = run(s, { t: 'floorApply', id, line: cur(s).lines[0].id });
    expect(cur(s).lines[0].apps.map(a => a.name)).toEqual(['Тёплый пол (Ванная)']);
    expect(run(s, { t: 'floorApply', id: 'none', line: 'new' })).toBe(s);
    let k = run(mk(), { t: 'floorAdd', use: 'kitchen' });
    const kid = (cur(k).floor ?? [])[0].id;
    k = run(k, { t: 'floorSet', id: kid, field: 'name', value: ' ' }, { t: 'floorSet', id: kid, field: 'area', value: '2' }, { t: 'floorApply', id: kid, line: 'new' });
    expect(cur(k).lines[2]).toMatchObject({ name: 'Тёплый пол: помещение', zone: undefined });
    expect('wet' in cur(k).lines[2]).toBe(false);
  });
});

describe('weak current actions', () => {
  it('adds, edits and removes points', () => {
    let s = run(mk(), { t: 'weakAdd', kind: 'lan', room: 'Зал' }, { t: 'weakAdd', kind: 'tv' });
    const [a, b] = cur(s).weak?.pts ?? [];
    expect(a).toMatchObject({ kind: 'lan', room: 'Зал', n: 1, len: '' });
    expect(b.room).toBe('');
    s = run(s,
      { t: 'weakSet', id: a.id, field: 'room', value: 'Р'.repeat(50) },
      { t: 'weakSet', id: a.id, field: 'len', value: '123456789' },
      { t: 'weakSet', id: a.id, field: 'kind', value: 'cam' },
      { t: 'weakOnt', on: false }
    );
    const w = cur(s).weak;
    expect(w?.pts[0].room).toHaveLength(40);
    expect(w?.pts[0]).toMatchObject({ len: '500', kind: 'cam' });
    expect(w?.ont).toBe(false);
    s = run(s, { t: 'weakDel', id: a.id });
    expect(cur(s).weak?.pts).toHaveLength(1);
    s = run(s, { t: 'weakDel', id: b.id });
    expect('weak' in cur(s)).toBe(false);
    expect(cur(run(s, { t: 'weakSet', id: a.id, field: 'n', value: '2' })).weak).toBeUndefined();
    expect(cur(run(s, { t: 'weakDel', id: a.id })).weak).toBeUndefined();
    expect(cur(run(s, { t: 'weakOnt', on: true })).weak).toEqual({ pts: [], ont: true });
  });
});

describe('storage and sharing', () => {
  it('keeps rooms and points through normalisation and links', () => {
    let s = run(mk(), { t: 'floorAdd', use: 'kitchen' }, { t: 'weakAdd', kind: 'tv', room: 'Детская' });
    const id = (cur(s).floor ?? [])[0].id;
    s = run(s, { t: 'floorSet', id, field: 'area', value: '3' });
    const p = cur(s);
    const back = normProject(JSON.parse(JSON.stringify(p)), true);
    expect(back?.floor?.[0]).toMatchObject({ use: 'kitchen', area: '3' });
    expect(back?.weak?.pts[0]).toMatchObject({ kind: 'tv', room: 'Детская' });
    const shared = unpackProject(packProject(p));
    expect(shared?.floor?.[0].use).toBe('kitchen');
    expect(shared?.weak?.pts[0].room).toBe('Детская');
    const bare = normProject({ ...p, floor: [], weak: { pts: [] } });
    expect(bare && 'floor' in bare).toBe(false);
    expect(bare && 'weak' in bare).toBe(false);
    const plain = unpackProject(packProject({ ...p, floor: undefined, weak: undefined }));
    expect(plain?.weak).toBeUndefined();
  });
});
