import { describe, expect, it } from 'vitest';
import { cur, init, normProject, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { newProject, sampleProject } from '../../core/project';
import { blank, defaultCfg, mkLine, sample } from '../../core/templates';
import { makeRoom, ROOM_PRESETS } from '../../core/rooms';
import type { Line, Project, Room } from '../../core/types';

const mk = (supply = 1): State => {
  const p = sampleProject();
  p.cfg = { ...p.cfg, supply };
  return init({ cur: p.id, list: [p] });
};
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);
const lines = (s: State): Line[] => cur(s).lines;
const selLine = (s: State): Line => lines(s).find(l => l.id === s.sel) as Line;

describe('init and selection', () => {
  it('selects the first line', () => {
    const s = mk();
    expect(s.sel).toBe(lines(s)[0].id);
  });
  it('selects null for an empty project', () => {
    const p = newProject({ ...blank(), lines: [] }, 'e');
    expect(init({ cur: p.id, list: [p] }).sel).toBeNull();
  });
  it('select sets sel', () => {
    const s = mk();
    expect(reducer(s, { t: 'select', id: 'zz' }).sel).toBe('zz');
  });
  it('re-exports normProject', () => {
    expect(normProject(null)).toBeNull();
  });
});

describe('lines', () => {
  it('adds a line of a given type and selects it', () => {
    const s = run(mk(), { t: 'addLine', type: 'power' });
    expect(lines(s)).toHaveLength(8);
    expect(selLine(s).name).toBe('Мощный прибор');
    expect(selLine(s).apps).toEqual([]);
    expect(cur(s).sample).toBe(false);
  });
  it('balances phases when adding on three phase', () => {
    const s = run(mk(3), { t: 'addLine', type: 'socket' });
    const phases = new Set(lines(s).map(l => l.phase));
    expect(phases.size).toBeGreaterThan(1);
  });
  it('deletes the selected line and picks a neighbour', () => {
    let s = mk();
    const n = lines(s).length;
    s = run(s, { t: 'select', id: lines(s)[2].id }, { t: 'delLine' });
    expect(lines(s)).toHaveLength(n - 1);
    expect(s.sel).toBe(lines(s)[2].id);
    s = run(s, { t: 'select', id: lines(s)[lines(s).length - 1].id }, { t: 'delLine' });
    expect(s.sel).toBe(lines(s)[lines(s).length - 1].id);
  });
  it('deleting the last line leaves null selection', () => {
    let s = run(mk(), ...Array.from({ length: 7 }, () => ({ t: 'delLine' }) as Action));
    expect(lines(s)).toHaveLength(0);
    expect(s.sel).toBeNull();
    expect(reducer(s, { t: 'delLine' })).toBe(s);
    s = run(s, { t: 'dupLine' });
    expect(lines(s)).toHaveLength(0);
  });
  it('duplicates a line next to the original without measurements', () => {
    let s = mk();
    s = run(s, { t: 'lineMeas', field: 'zs', value: '0.4' });
    const src = selLine(s);
    s = run(s, { t: 'dupLine' });
    expect(lines(s)[1].name).toBe(src.name + ' (копия)');
    expect(lines(s)[1].meas).toBeUndefined();
    expect(lines(s)[1].id).not.toBe(src.id);
    expect(lines(s)[1].apps[0].id).not.toBe(src.apps[0].id);
    expect(s.sel).toBe(lines(s)[1].id);
  });
  it('duplicates unnamed lines and balances on three phase', () => {
    let s = mk(3);
    s = run(s, { t: 'lineField', field: 'name', value: '' }, { t: 'dupLine' });
    expect(lines(s)[1].name).toBe('Без названия (копия)');
  });
  it('edits line fields', () => {
    let s = mk();
    s = run(s, { t: 'lineField', field: 'name', value: 'N' }, { t: 'lineField', field: 'len', value: '33' }, { t: 'lineField', field: 'kc', value: 0.5 }, { t: 'lineField', field: 'cos', value: '0.9' });
    expect(selLine(s)).toMatchObject({ name: 'N', len: '33', kc: 0.5, cos: '0.9' });
  });
  it('changes line type resetting defaults and phase', () => {
    let s = run(mk(3), { t: 'linePhase', phase: '3' }, { t: 'lineType', type: 'socket' });
    expect(selLine(s)).toMatchObject({ type: 'socket', kc: 0.7, cos: 0.95, phase: 'L1' });
    expect(selLine(s).name).toBe('Освещение'.replace('Освещение', 'Розетки'));
    s = run(s, { t: 'lineField', field: 'name', value: 'Custom' }, { t: 'lineType', type: 'power' }, { t: 'linePhase', phase: '3' }, { t: 'lineType', type: 'power' });
    expect(selLine(s)).toMatchObject({ name: 'Custom', phase: '3', type: 'power' });
  });
  it('sets phase, wet and measurements', () => {
    let s = run(mk(), { t: 'linePhase', phase: 'L2' }, { t: 'lineWet', wet: true }, { t: 'lineMeas', field: 'zs', value: '1' }, { t: 'lineMeas', field: 'ins', value: '2' }, { t: 'lineMeas', field: 'leak', value: '3' });
    expect(selLine(s)).toMatchObject({ phase: 'L2', wet: true, meas: { zs: '1', ins: '2', leak: '3' } });
    s = run(s, { t: 'select', id: 'missing' }, { t: 'lineField', field: 'name', value: 'zzz' });
    expect(lines(s).some(l => l.name === 'zzz')).toBe(false);
  });
  it('balances explicitly', () => {
    const s = run(mk(3), { t: 'balance' });
    expect(new Set(lines(s).map(l => l.phase)).size).toBeGreaterThan(1);
  });
});

describe('appliances', () => {
  it('adds, edits and deletes apps', () => {
    let s = mk();
    const n = selLine(s).apps.length;
    s = run(s, { t: 'addApp' });
    const added = selLine(s).apps[n];
    expect(added).toMatchObject({ name: '', w: '', n: 1 });
    s = run(s, { t: 'appField', id: added.id, field: 'name', value: 'Фен' }, { t: 'appField', id: added.id, field: 'w', value: 1800 }, { t: 'appField', id: added.id, field: 'n', value: '2' });
    expect(selLine(s).apps[n]).toMatchObject({ name: 'Фен', w: 1800, n: '2' });
    expect(selLine(s).apps[0].name).not.toBe('Фен');
    s = run(s, { t: 'delApp', id: added.id });
    expect(selLine(s).apps).toHaveLength(n);
  });
  it('adds preset apps and merges duplicates', () => {
    let s = mk();
    s = run(s, { t: 'addApp', name: 'Фен', w: 1800 });
    const l = selLine(s);
    expect(l.apps[l.apps.length - 1]).toMatchObject({ name: 'Фен', w: 1800, n: 1 });
    s = run(s, { t: 'addApp', name: 'Фен', w: 1800 });
    expect(selLine(s).apps[selLine(s).apps.length - 1].n).toBe(2);
    s = run(s, { t: 'addApp', name: 'Другой' });
    expect(selLine(s).apps[selLine(s).apps.length - 1]).toMatchObject({ name: 'Другой', w: '', n: 1 });
  });
  it('adds many apps', () => {
    const s = run(mk(), { t: 'addApps', apps: [{ name: 'a', w: 10, n: 2 }, { name: 'b', w: 20, n: 1 }] });
    const l = selLine(s);
    expect(l.apps.slice(-2).map(a => [a.name, a.w, a.n])).toEqual([['a', 10, 2], ['b', 20, 1]]);
  });
});

describe('config', () => {
  it('sets cfg values, numeric for supply and drop', () => {
    let s = run(mk(), { t: 'cfg', field: 'method', value: 'open' }, { t: 'cfg', field: 'drop', value: '4' }, { t: 'cfg', field: 'ko', value: '0,8' });
    expect(cur(s).cfg).toMatchObject({ method: 'open', drop: 4, ko: '0,8' });
    s = run(s, { t: 'cfg', field: 'supply', value: '3' });
    expect(cur(s).cfg.supply).toBe(3);
    expect(new Set(lines(s).map(l => l.phase)).size).toBeGreaterThan(1);
    s = run(s, { t: 'cfg', field: 'supply', value: 1 });
    expect(cur(s).cfg.supply).toBe(1);
  });
  it('steps values within limits', () => {
    let s = run(mk(), { t: 'cfgStep', field: 'alloc', d: 5 });
    expect(cur(s).cfg.alloc).toBe(20);
    s = run(s, { t: 'cfgStep', field: 'alloc', d: 1000 });
    expect(cur(s).cfg.alloc).toBe(500);
    s = run(s, { t: 'cfgStep', field: 'alloc', d: -1000 });
    expect(cur(s).cfg.alloc).toBe(1);
    s = run(s, { t: 'cfgStep', field: 'ko', d: 0.05 });
    expect(cur(s).cfg.ko).toBe(0.8);
    s = run(s, { t: 'cfgStep', field: 'ko', d: 5 });
    expect(cur(s).cfg.ko).toBe(1);
    s = run(s, { t: 'cfg', field: 'zs', value: 'abc' }, { t: 'cfgStep', field: 'zs', d: -1 });
    expect(cur(s).cfg.zs).toBe(0.05);
    s = run(s, { t: 'cfgStep', field: 'feeder', d: -1 });
    expect(cur(s).cfg.feeder).toBe(0);
    s = run(s, { t: 'cfgStep', field: 'k', d: -1 });
    expect(cur(s).cfg.k).toBe(0.5);
  });
});

describe('metadata, checks, protocol', () => {
  it('updates meta, checks and proto', () => {
    let s = run(mk(), { t: 'meta', field: 'name', value: 'N' }, { t: 'meta', field: 'address', value: 'A' }, { t: 'meta', field: 'client', value: 'C' }, { t: 'meta', field: 'author', value: 'U' });
    expect(cur(s)).toMatchObject({ name: 'N', address: 'A', client: 'C', author: 'U' });
    s = run(s, { t: 'check', id: 'marks', on: true }, { t: 'check', id: 'pe', on: true }, { t: 'check', id: 'marks', on: false });
    expect(cur(s).checks).toEqual({ marks: false, pe: true });
    s = run(s, { t: 'proto', field: 'date', value: 'D' }, { t: 'proto', field: 'by', value: 'B' });
    expect(cur(s).proto).toEqual({ date: 'D', device: '', by: 'B' });
  });
  it('handles projects without checks and proto', () => {
    const s = mk();
    const p = cur(s);
    delete p.checks;
    delete p.proto;
    const s2 = run(s, { t: 'check', id: 'a', on: true }, { t: 'proto', field: 'device', value: 'x' });
    expect(cur(s2).checks).toEqual({ a: true });
    expect(cur(s2).proto).toEqual({ date: '', device: 'x', by: '' });
  });
});

describe('rooms', () => {
  it('adds, renames and deletes rooms', () => {
    const r = makeRoom(ROOM_PRESETS[1]);
    let s = run(mk(), { t: 'roomAdd', room: r });
    expect(cur(s).rooms).toHaveLength(1);
    s = run(s, { t: 'roomName', id: r.id, value: 'Зал' }, { t: 'roomName', id: 'zz', value: 'no' });
    expect(cur(s).rooms![0].name).toBe('Зал');
    s = run(s, { t: 'roomDel', id: r.id });
    expect(cur(s).rooms).toEqual([]);
  });
  it('works when rooms are undefined', () => {
    const s = mk();
    delete cur(s).rooms;
    for (const a of [
      { t: 'roomDel', id: 'x' },
      { t: 'roomName', id: 'x', value: 'v' },
      { t: 'roomAppAdd', rid: 'x', app: { id: 'a', name: 'a', w: 1, n: 1, tag: 's' } },
      { t: 'roomAppField', rid: 'x', aid: 'a', field: 'w', value: '2' },
      { t: 'roomAppDel', rid: 'x', aid: 'a' }
    ] as Action[]) {
      expect(cur(reducer(s, a)).rooms).toEqual([]);
    }
  });
  it('manages room appliances', () => {
    const r: Room = { id: 'r1', name: 'R', apps: [] };
    const other: Room = { id: 'r2', name: 'R2', apps: [{ id: 'o', name: 'o', w: 1, n: 1, tag: 's' }] };
    let s = run(mk(), { t: 'roomAdd', room: r }, { t: 'roomAdd', room: other });
    s = run(s, { t: 'roomAppAdd', rid: 'r1', app: { id: 'a1', name: 'x', w: 100, n: 1, tag: 's' } }, { t: 'roomAppAdd', rid: 'r1', app: { id: 'a2', name: 'y', w: 200, n: 1, tag: 'l' } });
    expect(cur(s).rooms![0].apps).toHaveLength(2);
    expect(cur(s).rooms![1].apps).toHaveLength(1);
    s = run(s, { t: 'roomAppField', rid: 'r1', aid: 'a1', field: 'w', value: '500' }, { t: 'roomAppField', rid: 'r1', aid: 'a1', field: 'tag', value: 'p' });
    expect(cur(s).rooms![0].apps[0]).toMatchObject({ w: '500', tag: 'p' });
    expect(cur(s).rooms![0].apps[1].w).toBe(200);
    s = run(s, { t: 'roomAppDel', rid: 'r1', aid: 'a1' });
    expect(cur(s).rooms![0].apps.map(a => a.id)).toEqual(['a2']);
    expect(cur(s).rooms![1].apps).toHaveLength(1);
  });
  it('assembles lines from rooms', () => {
    const base = mk();
    expect(reducer(base, { t: 'assemble' })).toBe(base);
    const r = makeRoom(ROOM_PRESETS[0]);
    const s = run(base, { t: 'roomAdd', room: r }, { t: 'assemble' });
    expect(lines(s).length).toBeGreaterThan(2);
    expect(s.sel).toBe(lines(s)[0].id);
    const noRooms = mk();
    delete cur(noRooms).rooms;
    expect(reducer(noRooms, { t: 'assemble' })).toBe(noRooms);
  });
});

describe('replace and projects', () => {
  it('replaces content and keeps sample flag from content', () => {
    let s = run(mk(), { t: 'replace', content: { sample: true, cfg: defaultCfg(), lines: [mkLine('only', 'light', 1, null, null, [])] } });
    expect(lines(s)).toHaveLength(1);
    expect(cur(s).sample).toBe(true);
    expect(s.sel).toBe(lines(s)[0].id);
    s = run(s, { t: 'replace', content: blank() });
    expect(cur(s).sample).toBe(false);
    s = run(s, { t: 'replace', content: { sample: false, cfg: defaultCfg(), lines: [] } });
    expect(s.sel).toBeNull();
  });
  it('opens projects', () => {
    const a = sampleProject();
    const b = sampleProject();
    const s0 = init({ cur: a.id, list: [a, b] });
    const s = run(s0, { t: 'openProject', id: b.id });
    expect(s.cur).toBe(b.id);
    expect(s.sel).toBe(b.lines[0].id);
    expect(reducer(s, { t: 'openProject', id: 'no' })).toBe(s);
  });
  it('adds projects with unique names', () => {
    let s = run(mk(), { t: 'addProject', content: sample(), name: 'Пример: двухкомнатная квартира' });
    expect(s.list).toHaveLength(2);
    expect(s.list[1].name).toBe('Пример: двухкомнатная квартира 2');
    expect(s.cur).toBe(s.list[1].id);
    expect(s.sel).toBe(cur(s).lines[0].id);
    s = run(s, { t: 'addProject', content: { ...blank(), lines: [] }, name: 'Пустой' });
    expect(s.sel).toBeNull();
  });
  it('duplicates projects after the source', () => {
    const a = sampleProject();
    const b = sampleProject();
    b.name = '';
    const s0 = init({ cur: a.id, list: [a, b] });
    let s = run(s0, { t: 'dupProject', id: a.id });
    expect(s.list.map(p => p.name)[1]).toBe(a.name + ' (копия)');
    expect(s.list[1].sample).toBe(false);
    expect(s.cur).toBe(s.list[1].id);
    expect(s.list).toHaveLength(3);
    s = run(s, { t: 'dupProject', id: b.id });
    expect(s.list[3].name).toBe('Без названия (копия)');
    expect(reducer(s, { t: 'dupProject', id: 'no' })).toBe(s);
  });
  it('deletes projects', () => {
    const a = sampleProject();
    const b = sampleProject();
    const c = sampleProject();
    const s0 = init({ cur: a.id, list: [a, b, c] });
    const keep = run(s0, { t: 'delProject', id: b.id });
    expect(keep.list.map(p => p.id)).toEqual([a.id, c.id]);
    expect(keep.cur).toBe(a.id);
    expect(keep.sel).toBe(s0.sel);
    const moved = run(s0, { t: 'delProject', id: a.id });
    expect(moved.cur).toBe(b.id);
    expect(moved.sel).toBe(b.lines[0].id);
    const none = run(init({ cur: a.id, list: [a] }), { t: 'delProject', id: a.id });
    expect(none.list).toHaveLength(1);
    expect(none.list[0].name).toBe('Новый проект');
    expect(none.cur).toBe(none.list[0].id);
    expect(run(s0, { t: 'delProject', id: 'unknown' }).list).toHaveLength(3);
  });
  it('imports projects', () => {
    const s0 = mk();
    expect(reducer(s0, { t: 'importProjects', projects: [] })).toBe(s0);
    const x = sampleProject();
    const y: Project = { ...sampleProject(), lines: [] };
    const s = run(s0, { t: 'importProjects', projects: [x, y] });
    expect(s.list).toHaveLength(3);
    expect(s.cur).toBe(y.id);
    expect(s.sel).toBeNull();
  });
  it('ignores unknown actions', () => {
    const s = mk();
    expect(reducer(s, { t: 'nope' } as never)).toBe(s);
  });
});
