import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hreducer, initH } from '../../store/history';
import type { HAction, HState } from '../../store/history';
import { cur, init, numIn, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { SAMPLE_NAME, newProject, sampleProject } from '../../core/project';
import { blank, defaultCfg, mkLine } from '../../core/templates';
import { emptyLib, libReducer, normLib } from '../../store/lib';
import { saveStore } from '../../store/storage';
import { saveLib } from '../../store/lib';

const start = (): HState => {
  const p = sampleProject();
  return initH(init({ cur: p.id, list: [p] }));
};
const one = (): State => {
  const p = sampleProject();
  return init({ cur: p.id, list: [p] });
};
const runH = (h: HState, ...as: HAction[]): HState => as.reduce(hreducer, h);
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 0, 1, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('history version and merging', () => {
  it('does not merge edits of different groups', () => {
    let h = start();
    const ids = cur(h.now).lines.map(l => l.id);
    h = runH(h, { t: 'lineField', field: 'name', value: 'AAA' });
    expect(h.ver).toBe(1);
    h = runH(h, { t: 'select', id: ids[2] }, { t: 'lineField', field: 'name', value: 'BBB' });
    expect(h.ver).toBe(2);
    h = runH(h, { t: 'undo' });
    expect(cur(h.now).lines[0].name).toBe('AAA');
    expect(cur(h.now).lines[2].name).not.toBe('BBB');
    expect(h.ver).toBe(3);
    h = runH(h, { t: 'redo' });
    expect(h.ver).toBe(4);
  });

  it('merges quick typing in the same group without a new version', () => {
    let h = start();
    h = runH(h, { t: 'lineField', field: 'name', value: 'A' }, { t: 'lineField', field: 'name', value: 'AB' });
    expect(h.ver).toBe(1);
    expect(h.past).toHaveLength(1);
  });
});

describe('numeric input cleaning', () => {
  it('keeps one separator, drops signs and letters, caps the value', () => {
    expect(numIn('2,5', 500)).toBe('2,5');
    expect(numIn('-10', 500)).toBe('10');
    expect(numIn('1.2.3', 500)).toBe('1.2');
    expect(numIn('abc', 500)).toBe('');
    expect(numIn('100000', 500)).toBe('500');
    expect(numIn(-3, 500)).toBe(0);
    expect(numIn(900, 500)).toBe(500);
    expect(numIn(Number.NaN, 500)).toBe(0);
    expect(numIn(null, 5)).toBeNull();
  });

  it('applies limits to group, appliance, measurement, floor and weak fields', () => {
    let s = one();
    const app = cur(s).lines[0].apps[0].id;
    s = run(s,
      { t: 'lineField', field: 'len', value: '100000' },
      { t: 'lineField', field: 'name', value: '-Имя 1' },
      { t: 'appField', id: app, field: 'w', value: '-500' },
      { t: 'appField', id: app, field: 'n', value: '150' },
      { t: 'lineMeas', field: 'ins', value: '-3' }
    );
    const l = cur(s).lines[0];
    expect(l.len).toBe('500');
    expect(l.name).toBe('-Имя 1');
    expect(l.apps[0]).toMatchObject({ w: '500', n: '150' });
    expect(l.meas?.ins).toBe('3');
    s = run(s, { t: 'lineMeasAt', id: l.id, field: 'leak', value: '0,4' });
    expect(cur(s).lines[0].meas?.leak).toBe('0,4');
    s = run(s, { t: 'floorAdd', use: 'room' });
    const f = (cur(s).floor ?? [])[0].id;
    s = run(s, { t: 'floorSet', id: f, field: 'area', value: '1000000000' }, { t: 'floorSet', id: f, field: 'wpm', value: '9999' });
    expect((cur(s).floor ?? [])[0]).toMatchObject({ area: '200', wpm: '400' });
    s = run(s, { t: 'weakAdd', kind: 'lan' });
    const w = cur(s).weak?.pts[0].id as string;
    s = run(s, { t: 'weakSet', id: w, field: 'n', value: '-3' });
    expect(cur(s).weak?.pts[0].n).toBe('3');
  });
});

describe('rooms of groups', () => {
  it('reuses the spelling of an existing room typed in another case', () => {
    let s = one();
    const p = cur(s);
    s = run(s, { t: 'select', id: p.lines[1].id }, { t: 'lineField', field: 'zone', value: 'комнаты' });
    expect(cur(s).lines[1].zone).toBe('Комнаты');
    s = run(s, { t: 'lineField', field: 'zone', value: 'Комнаты ' });
    expect(cur(s).lines[1].zone).toBe('Комнаты ');
    s = run(s, { t: 'lineField', field: 'zone', value: 'Новая' });
    expect(cur(s).lines[1].zone).toBe('Новая');
  });

  it('gives added rooms unique names', () => {
    let s = one();
    const room = { id: 'r', name: 'Гостиная', kitchen: false, apps: [] };
    s = run(s, { t: 'roomAdd', room }, { t: 'roomAdd', room: { ...room, id: 'q' } });
    expect((cur(s).rooms ?? []).map(r => r.name)).toEqual(['Гостиная', 'Гостиная 2']);
  });

  it('adds LED strips from the quick list with their length', () => {
    let s = one();
    s = run(s, { t: 'addApps', apps: [{ name: 'LED-лента', w: 14.4, n: 1, m: 5 }] });
    const apps = cur(s).lines[0].apps;
    expect(apps[apps.length - 1]).toMatchObject({ name: 'LED-лента', w: 14.4, m: 5 });
  });
});

describe('projects', () => {
  it('renames the sample when starting from scratch', () => {
    let s = one();
    expect(cur(s).name).toBe(SAMPLE_NAME);
    s = run(s, { t: 'replace', content: blank() });
    expect(cur(s).name).toBe('Новый проект');
    s = run(s, { t: 'meta', field: 'name', value: 'Квартира' }, { t: 'replace', content: blank() });
    expect(cur(s).name).toBe('Квартира');
  });

  it('gives unique names to copies and imports and opens the neighbour after delete', () => {
    const a = newProject(blank(), 'А');
    const b = newProject(blank(), 'Б');
    const c = newProject(blank(), 'В');
    let s = init({ cur: b.id, list: [a, b, c] });
    s = run(s, { t: 'dupProject', id: a.id }, { t: 'dupProject', id: a.id });
    expect(s.list.map(x => x.name)).toEqual(['А', 'А (копия) 2', 'А (копия)', 'Б', 'В']);
    s = run(s, { t: 'importProjects', projects: [newProject(blank(), 'Б'), newProject(blank(), 'Б')] });
    expect(s.list.slice(-2).map(x => x.name)).toEqual(['Б 2', 'Б 3']);
    let d = init({ cur: b.id, list: [a, b, c] });
    d = run(d, { t: 'delProject', id: b.id });
    expect(cur(d).id).toBe(c.id);
    d = run(d, { t: 'delProject', id: c.id });
    expect(cur(d).id).toBe(a.id);
  });

  it('moves groups inside their room only', () => {
    const p = sampleProject();
    let s = init({ cur: p.id, list: [p] });
    const ids = cur(s).lines.map(l => l.id);
    s = run(s, { t: 'moveLine', id: ids[0], to: ids[13] });
    const after = cur(s).lines.map(l => l.id);
    expect(after[1]).toBe(ids[1]);
    expect(after[13]).toBe(ids[0]);
    expect(after[0]).toBe(ids[2]);
  });
});

describe('library', () => {
  it('drops broken templates, caps prices and names saved templates uniquely', () => {
    const lib = normLib({ templates: [{ name: 'Ок', cfg: defaultCfg(), lines: [mkLine('Свет', 'light', 5, 1, 1, [])] }, { name: 'Плохой', cfg: defaultCfg(), lines: [{ type: 'zzz', apps: [] }] }] });
    expect(lib.templates.map(t => t.name)).toEqual(['Ок']);
    let l = libReducer(emptyLib(), { t: 'addTpl', name: 'Мой', cfg: defaultCfg(), lines: [] });
    l = libReducer(l, { t: 'addTpl', name: 'Мой', cfg: defaultCfg(), lines: [] });
    expect(l.templates.map(t => t.name)).toEqual(['Мой', 'Мой 2']);
    l = libReducer(l, { t: 'price', name: 'X', value: '99999999999' });
    expect(l.prices.X).toBe(1000000);
    l = libReducer(l, { t: 'labor', key: 'panel', value: '99999999' });
    expect(l.labor.panel).toBe(100000);
  });
});

describe('saving reports failures', () => {
  it('returns false when storage is full', () => {
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveStore({ cur: 'x', list: [] })).toBe(false);
    expect(saveLib(emptyLib())).toBe(false);
    set.mockRestore();
    expect(saveStore({ cur: 'x', list: [] })).toBe(true);
    expect(saveLib(emptyLib())).toBe(true);
  });
});
