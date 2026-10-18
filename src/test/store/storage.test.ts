import { describe, expect, it, vi } from 'vitest';
import { KEY, OLDKEY, loadStore, saveStore } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';

const legacy = { cfg: defaultCfg(), lines: [mkLine('a', 'socket', 5, null, null, [['x', 100, 1]])], sample: false };

describe('loadStore', () => {
  it('returns the sample project when storage is empty', () => {
    const s = loadStore();
    expect(s.list).toHaveLength(1);
    expect(s.list[0].sample).toBe(true);
    expect(s.cur).toBe(s.list[0].id);
  });
  it('round trips through saveStore', () => {
    const p = sampleProject();
    saveStore({ list: [p], cur: p.id });
    const s = loadStore();
    expect(s.cur).toBe(p.id);
    expect(s.list[0].id).toBe(p.id);
    expect(s.list[0].name).toBe(p.name);
  });
  it('falls back to the first project when cur is unknown', () => {
    const a = sampleProject();
    const b = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: 'nope', list: [a, b] }));
    const s = loadStore();
    expect(s.cur).toBe(a.id);
    expect(s.list.map(x => x.id)).toEqual([a.id, b.id]);
  });
  it('keeps the stored current project', () => {
    const a = sampleProject();
    const b = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: b.id, list: [a, b] }));
    expect(loadStore().cur).toBe(b.id);
  });
  it('drops corrupt projects but keeps valid ones', () => {
    const a = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: a.id, list: [null, 5, { cfg: {} }, a] }));
    const s = loadStore();
    expect(s.list).toHaveLength(1);
    expect(s.list[0].id).toBe(a.id);
  });
  it('migrates from the old key', () => {
    localStorage.setItem(OLDKEY, JSON.stringify(legacy));
    const s = loadStore();
    expect(s.list).toHaveLength(1);
    expect(s.list[0].name).toBe('Моя квартира');
    expect(s.list[0].lines).toHaveLength(1);
    expect(s.cur).toBe(s.list[0].id);
    expect(OLDKEY).toBe('raschet-shchitka-v3');
  });
  it('migrates when the new store has no valid projects', () => {
    localStorage.setItem(KEY, JSON.stringify({ cur: 'x', list: [null] }));
    localStorage.setItem(OLDKEY, JSON.stringify(legacy));
    expect(loadStore().list[0].name).toBe('Моя квартира');
  });
  it('migrates when the new store has no list', () => {
    localStorage.setItem(KEY, JSON.stringify({ cur: 'x' }));
    localStorage.setItem(OLDKEY, JSON.stringify(legacy));
    expect(loadStore().list[0].name).toBe('Моя квартира');
    localStorage.setItem(KEY, 'null');
    expect(loadStore().list[0].name).toBe('Моя квартира');
  });
  it('falls back to sample on invalid old data', () => {
    localStorage.setItem(OLDKEY, JSON.stringify({ foo: 1 }));
    expect(loadStore().list[0].sample).toBe(true);
  });
  it('falls back to sample on corrupt JSON', () => {
    localStorage.setItem(KEY, '{broken');
    expect(loadStore().list[0].sample).toBe(true);
    localStorage.clear();
    localStorage.setItem(OLDKEY, '{broken');
    expect(loadStore().list[0].sample).toBe(true);
  });
  it('falls back to sample when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadStore().list[0].sample).toBe(true);
  });
});

describe('saveStore', () => {
  it('writes json under the key', () => {
    const p = sampleProject();
    saveStore({ list: [p], cur: p.id });
    expect(JSON.parse(localStorage.getItem(KEY) as string).cur).toBe(p.id);
  });
  it('swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const p = sampleProject();
    expect(() => saveStore({ list: [p], cur: p.id })).not.toThrow();
  });
});
