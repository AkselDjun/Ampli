import { describe, expect, it, vi } from 'vitest';
import { BOOT_KEY, KEY, OLDKEY, changes, clearProjects, dropLegacy, loadBoot, loadStore, mergeLists, readProjects, resetProjectDb, saveBoot, saveStore, writeProjects } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';

const legacy = { cfg: defaultCfg(), lines: [mkLine('a', 'socket', 5, [['x', 100, 1]])], sample: false };

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
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
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
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const p = sampleProject();
    expect(() => saveStore({ list: [p], cur: p.id })).not.toThrow();
  });
});

describe('boot record', () => {
  it('starts from the boot record with the stored order', () => {
    const a = sampleProject();
    const b = sampleProject();
    saveBoot(b, [a.id, b.id]);
    const s = loadBoot();
    expect(s.source).toBe('boot');
    expect(s.cur).toBe(b.id);
    expect(s.list.map(x => x.id)).toEqual([b.id]);
    expect(s.order).toEqual([a.id, b.id]);
  });
  it('adds the current project to an order that misses it', () => {
    const a = sampleProject();
    localStorage.setItem(BOOT_KEY, JSON.stringify({ cur: a.id, order: 'x', project: a }));
    expect(loadBoot().order).toEqual([a.id]);
  });
  it('prefers the full legacy store over the boot record', () => {
    const a = sampleProject();
    const b = sampleProject();
    saveBoot(a, [a.id]);
    localStorage.setItem(KEY, JSON.stringify({ cur: b.id, list: [a, b] }));
    const s = loadBoot();
    expect(s.source).toBe('legacy');
    expect(s.order).toEqual([a.id, b.id]);
  });
  it('uses the oldest key only without a boot record', () => {
    const a = sampleProject();
    saveBoot(a, [a.id]);
    localStorage.setItem(OLDKEY, JSON.stringify(legacy));
    expect(loadBoot().source).toBe('boot');
    localStorage.removeItem(BOOT_KEY);
    expect(loadBoot().source).toBe('legacy');
  });
  it('starts empty on a broken boot record', () => {
    localStorage.setItem(BOOT_KEY, '{broken');
    expect(loadBoot().source).toBe('empty');
    localStorage.setItem(BOOT_KEY, JSON.stringify({ cur: 'x', project: { cfg: 1 } }));
    expect(loadBoot().source).toBe('empty');
  });
  it('reports a failed boot write', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const p = sampleProject();
    expect(saveBoot(p, [p.id])).toBe(false);
  });
});

describe('project database', () => {
  it('writes, reads, deletes and clears projects', async () => {
    const a = sampleProject();
    const b = sampleProject();
    await writeProjects([a, b], []);
    expect((await readProjects()).map(x => x.id).sort()).toEqual([a.id, b.id].sort());
    await writeProjects([], [a.id]);
    expect((await readProjects()).map(x => x.id)).toEqual([b.id]);
    await writeProjects([a], [], true);
    expect((await readProjects()).map(x => x.id)).toEqual([a.id]);
    await writeProjects([], []);
    await clearProjects();
    expect(await readProjects()).toEqual([]);
  });
  it('drops records that are not projects', async () => {
    const a = sampleProject();
    await writeProjects([a, { ...a, id: 'bad', cfg: null } as unknown as typeof a], []);
    expect((await readProjects()).map(x => x.id)).toEqual([a.id]);
  });
  it('rejects without IndexedDB', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    resetProjectDb();
    await expect(readProjects()).rejects.toThrow();
    await expect(writeProjects([sampleProject()], [])).rejects.toThrow();
  });
  it('removes the legacy keys', () => {
    localStorage.setItem(KEY, '{}');
    localStorage.setItem(OLDKEY, '{}');
    dropLegacy();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(OLDKEY)).toBeNull();
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => dropLegacy()).not.toThrow();
  });
});

describe('list helpers', () => {
  it('merges memory over stored projects in the stored order', () => {
    const a = sampleProject();
    const b = sampleProject();
    const c = sampleProject();
    const a2 = { ...a, name: 'Новое имя' };
    const out = mergeLists([c, a2], [a, b], [b.id, a.id]);
    expect(out.map(x => x.id)).toEqual([b.id, a.id, c.id]);
    expect(out[1].name).toBe('Новое имя');
  });
  it('finds changed and removed projects by reference', () => {
    const a = sampleProject();
    const b = sampleProject();
    const c = sampleProject();
    const b2 = { ...b };
    expect(changes([a, b], [a, b2, c])).toEqual({ put: [b2, c], del: [] });
    expect(changes([a, b], [b])).toEqual({ put: [], del: [a.id] });
  });
});
