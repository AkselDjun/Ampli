import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_LISTS, PL_KEY, addList, loadLists, saveLists } from '../../store/pricelists';

beforeEach(() => localStorage.clear());

describe('price list store', () => {
  it('starts empty and survives broken storage', () => {
    expect(loadLists()).toEqual([]);
    localStorage.setItem(PL_KEY, 'не json');
    expect(loadLists()).toEqual([]);
    localStorage.setItem(PL_KEY, '{"a":1}');
    expect(loadLists()).toEqual([]);
  });
  it('adds a list on top, replaces one with the same name and caps the count', () => {
    let l = addList([], 'А', [{ name: 'x', price: 1, src: '' }]);
    l = addList(l, 'Б', [{ name: 'y', price: 2, src: '' }]);
    expect(l.map(x => x.name)).toEqual(['Б', 'А']);
    l = addList(l, 'А', [{ name: 'z', price: 3, src: '' }]);
    expect(l.map(x => x.name)).toEqual(['А', 'Б']);
    expect(l[0].offers[0]).toEqual({ name: 'z', price: 3, src: 'А' });
    for (let i = 0; i < 10; i++) l = addList(l, 'N' + i, []);
    expect(l).toHaveLength(MAX_LISTS);
  });
  it('round-trips and drops malformed entries', () => {
    const l = addList([], 'А', [{ name: 'x', price: 1.5, src: '' }]);
    expect(saveLists(l)).toBe(true);
    expect(loadLists()[0].offers).toEqual([{ name: 'x', price: 1.5, src: 'А' }]);
    localStorage.setItem(PL_KEY, JSON.stringify([
      { id: 'a', name: 'ok', at: 1, offers: [{ name: 'a', price: 2 }, { name: 'b', price: -1 }, { name: 3, price: 1 }, null] },
      { id: 5, name: 'bad', offers: [] },
      null
    ]));
    const r = loadLists();
    expect(r).toHaveLength(1);
    expect(r[0].offers).toEqual([{ name: 'a', price: 2, src: 'ok' }]);
  });
  it('reports a failed save', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveLists([])).toBe(false);
    spy.mockRestore();
  });
});
