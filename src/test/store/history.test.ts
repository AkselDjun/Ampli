import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hreducer, initH } from '../../store/history';
import type { HAction, HState } from '../../store/history';
import { cur, init } from '../../store/reducer';
import { sampleProject } from '../../core/project';

const start = (): HState => {
  const p = sampleProject();
  return initH(init({ cur: p.id, list: [p] }));
};
const run = (h: HState, ...as: HAction[]): HState => as.reduce(hreducer, h);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 0, 1, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('history', () => {
  it('starts empty', () => {
    const h = start();
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(h.key).toBe('');
  });
  it('ignores undo and redo with empty stacks', () => {
    const h = start();
    expect(hreducer(h, { t: 'undo' })).toBe(h);
    expect(hreducer(h, { t: 'redo' })).toBe(h);
  });
  it('returns the same state for no-op actions', () => {
    const h = start();
    const h2 = hreducer(h, { t: 'unknown' } as never);
    expect(h2).toBe(h);
  });
  it('does not record selection changes', () => {
    const h = start();
    const h2 = hreducer(h, { t: 'select', id: h.now.list[0].lines[1].id });
    expect(h2.past).toEqual([]);
    expect(h2.now.sel).toBe(h.now.list[0].lines[1].id);
    expect(h2.key).toBe(h.key);
  });
  it('records, undoes and redoes', () => {
    let h = start();
    const before = cur(h.now).name;
    h = run(h, { t: 'meta', field: 'name', value: 'A' });
    expect(h.past).toHaveLength(1);
    h = hreducer(h, { t: 'undo' });
    expect(cur(h.now).name).toBe(before);
    expect(h.future).toHaveLength(1);
    expect(h.key).toBe('');
    h = hreducer(h, { t: 'redo' });
    expect(cur(h.now).name).toBe('A');
    expect(h.past).toHaveLength(1);
    expect(h.future).toHaveLength(0);
  });
  it('clears redo on new action', () => {
    let h = run(start(), { t: 'meta', field: 'name', value: 'A' });
    h = hreducer(h, { t: 'undo' });
    h = hreducer(h, { t: 'meta', field: 'name', value: 'B' });
    expect(h.future).toEqual([]);
  });
  it('merges same-key edits within the window', () => {
    let h = start();
    h = run(h, { t: 'meta', field: 'name', value: 'A' });
    vi.advanceTimersByTime(500);
    h = hreducer(h, { t: 'meta', field: 'name', value: 'AB' });
    expect(h.past).toHaveLength(1);
    vi.advanceTimersByTime(500);
    h = hreducer(h, { t: 'meta', field: 'name', value: 'ABC' });
    expect(h.past).toHaveLength(1);
  });
  it('does not merge after the window or with a different key', () => {
    let h = start();
    h = run(h, { t: 'meta', field: 'name', value: 'A' });
    vi.advanceTimersByTime(2000);
    h = hreducer(h, { t: 'meta', field: 'name', value: 'AB' });
    expect(h.past).toHaveLength(2);
    h = hreducer(h, { t: 'meta', field: 'address', value: 'x' });
    expect(h.past).toHaveLength(3);
  });
  it('distinguishes keys by id', () => {
    let h = start();
    const l = cur(h.now).lines;
    h = run(h, { t: 'select', id: l[0].id }, { t: 'appField', id: l[0].apps[0].id, field: 'w', value: '1' });
    h = hreducer(h, { t: 'appField', id: l[0].apps[1].id, field: 'w', value: '1' });
    expect(h.past).toHaveLength(2);
  });
  it('does not merge right after undo', () => {
    let h = run(start(), { t: 'meta', field: 'name', value: 'A' });
    h = hreducer(h, { t: 'undo' });
    h = hreducer(h, { t: 'meta', field: 'name', value: 'B' });
    expect(h.past).toHaveLength(1);
    expect(h.past[0]).not.toBe(undefined);
  });
  it('limits past to 60 entries', () => {
    let h = start();
    for (let i = 0; i < 70; i++) {
      vi.advanceTimersByTime(5000);
      h = hreducer(h, { t: 'meta', field: 'name', value: 'n' + i });
    }
    expect(h.past).toHaveLength(60);
    for (let i = 0; i < 60; i++) h = hreducer(h, { t: 'undo' });
    expect(h.past).toHaveLength(0);
    expect(cur(h.now).name).toBe('n9');
  });
  it('only snapshots the list: cfg edits do not touch selection', () => {
    let h = start();
    const sel = h.now.sel;
    h = run(h, { t: 'cfg', field: 'method', value: 'open' });
    expect(h.now.sel).toBe(sel);
  });
  it('restores selection falling back to first line or null', () => {
    let h = start();
    const firstLine = cur(h.now).lines[0].id;
    h = run(h, { t: 'select', id: cur(h.now).lines[3].id }, { t: 'delLine' });
    expect(h.now.sel).not.toBe(firstLine);
    h = hreducer(h, { t: 'undo' });
    expect(cur(h.now).lines).toHaveLength(7);
    h = hreducer(h, { t: 'redo' });
    expect(cur(h.now).lines).toHaveLength(6);
    expect(cur(h.now).lines.some(l => l.id === h.now.sel)).toBe(true);
    let e = start();
    e = run(e, ...Array.from({ length: 7 }, () => ({ t: 'delLine' }) as HAction));
    expect(e.now.sel).toBeNull();
    const undone = hreducer(e, { t: 'undo' });
    expect(undone.now.sel).toBe(cur(undone.now).lines[0].id);
    const redone = run(undone, { t: 'redo' });
    expect(redone.now.sel).toBeNull();
  });
  it('restores project selection when the current project disappeared', () => {
    let h = start();
    h = run(h, { t: 'addProject', content: { sample: false, cfg: cur(h.now).cfg, lines: [] }, name: 'Второй' });
    expect(h.now.list).toHaveLength(2);
    h = hreducer(h, { t: 'undo' });
    expect(h.now.list).toHaveLength(1);
    expect(h.now.cur).toBe(h.now.list[0].id);
    const broken: HState = { ...h, past: [{ list: h.now.list, cur: 'gone', sel: null }] };
    const r = hreducer(broken, { t: 'undo' });
    expect(r.now.cur).toBe(r.now.list[0].id);
  });
});
