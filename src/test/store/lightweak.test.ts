import { describe, expect, it } from 'vitest';
import { cur, init, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { newProject, normProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { packProject, unpackProject } from '../../core/share';
import { lightCalc } from '../../core/light';

const mk = (supply = 1): State => {
  const p = newProject({ sample: false, cfg: { ...defaultCfg(), supply }, lines: [mkLine('Свет', 'light', 10, 1, 1, [['', 0, 1]]), mkLine('Розетки', 'socket', 10, 1, 1, [['Чайник', 2000, 1]])] }, 'Т');
  return init({ cur: p.id, list: [p] });
};
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);

describe('lighting actions', () => {
  it('adds, edits and removes rooms', () => {
    let s = run(mk(), { t: 'lightAdd', kind: 'kitchen' }, { t: 'lightAdd', kind: 'bath', name: 'Санузел' });
    const [k, b] = cur(s).light ?? [];
    expect(k.name).toBe('Кухня');
    expect(b.name).toBe('Санузел');
    s = run(s,
      { t: 'lightSet', id: k.id, field: 'a', value: '4' },
      { t: 'lightSet', id: k.id, field: 'name', value: 'К'.repeat(60) },
      { t: 'lightSet', id: k.id, field: 'fx', value: 'panel36' }
    );
    let r = (cur(s).light ?? [])[0];
    expect(r).toMatchObject({ a: '4', fx: 'panel36', w: 36, lm: 3600 });
    expect(r.name).toHaveLength(40);
    s = run(s, { t: 'lightSet', id: k.id, field: 'lm', value: '3000' });
    r = (cur(s).light ?? [])[0];
    expect(r).toMatchObject({ fx: 'own', lm: '3000', w: 36 });
    s = run(s, { t: 'lightSet', id: k.id, field: 'fx', value: 'own' });
    expect((cur(s).light ?? [])[0]).toMatchObject({ fx: 'own', lm: '3000' });
    s = run(s, { t: 'lightDel', id: k.id });
    expect(cur(s).light).toHaveLength(1);
    s = run(s, { t: 'lightDel', id: b.id });
    expect('light' in cur(s)).toBe(false);
  });

  it('writes the fixtures into a group and updates them on repeat', () => {
    let s = run(mk(), { t: 'lightAdd', kind: 'living', name: 'Зал' });
    const id = (cur(s).light ?? [])[0].id;
    const line = cur(s).lines[0].id;
    expect(run(s, { t: 'lightApply', id, line })).toBe(s);
    s = run(s, { t: 'lightSet', id, field: 'a', value: '5' }, { t: 'lightSet', id, field: 'b', value: '4' }, { t: 'lightApply', id, line });
    const n = lightCalc((cur(s).light ?? [])[0]).n;
    let apps = cur(s).lines[0].apps;
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ name: 'Точечный светильник LED 10 Вт (Зал)', w: 10, n });
    s = run(s, { t: 'lightSet', id, field: 'a', value: '8' }, { t: 'lightApply', id, line });
    apps = cur(s).lines[0].apps;
    expect(apps).toHaveLength(1);
    expect(apps[0].n).toBeGreaterThan(n);
    expect(cur(s).lines[1].apps).toHaveLength(1);
    expect(run(s, { t: 'lightApply', id: 'none', line })).toBe(s);
  });

  it('creates a new lighting group in the room and balances phases', () => {
    let s = run(mk(3), { t: 'lightAdd', kind: 'hall' });
    const id = (cur(s).light ?? [])[0].id;
    s = run(s, { t: 'lightSet', id, field: 'a', value: '3' }, { t: 'lightSet', id, field: 'b', value: '2' }, { t: 'lightApply', id, line: 'new' });
    const nl = cur(s).lines[2];
    expect(nl).toMatchObject({ name: 'Освещение: Прихожая', type: 'light', zone: 'Прихожая' });
    expect(nl.apps[0].name).toBe('Точечный светильник LED 7 Вт (Прихожая)');
    s = run(mk(), { t: 'lightAdd', kind: 'hall', name: ' ' });
    const id2 = (cur(s).light ?? [])[0].id;
    s = run(s, { t: 'lightSet', id: id2, field: 'a', value: '3' }, { t: 'lightSet', id: id2, field: 'b', value: '2' }, { t: 'lightApply', id: id2, line: 'new' });
    expect(cur(s).lines[2]).toMatchObject({ name: 'Освещение: помещение', zone: undefined });
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
    expect(w?.pts[0]).toMatchObject({ len: '12345678', kind: 'cam' });
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
    let s = run(mk(), { t: 'lightAdd', kind: 'kids' }, { t: 'weakAdd', kind: 'tv', room: 'Детская' });
    const id = (cur(s).light ?? [])[0].id;
    s = run(s, { t: 'lightSet', id, field: 'a', value: '3' });
    const p = cur(s);
    const back = normProject(JSON.parse(JSON.stringify(p)), true);
    expect(back?.light?.[0]).toMatchObject({ kind: 'kids', a: '3' });
    expect(back?.weak?.pts[0]).toMatchObject({ kind: 'tv', room: 'Детская' });
    const shared = unpackProject(packProject(p));
    expect(shared?.light?.[0].kind).toBe('kids');
    expect(shared?.weak?.pts[0].room).toBe('Детская');
    const bare = normProject({ ...p, light: [], weak: { pts: [] } });
    expect(bare && 'light' in bare).toBe(false);
    expect(bare && 'weak' in bare).toBe(false);
    const plain = unpackProject(packProject({ ...p, light: undefined, weak: undefined }));
    expect(plain?.weak).toBeUndefined();
  });
});
