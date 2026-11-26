import { describe, expect, it } from 'vitest';
import { NOTE_MAX, NOTES_MAX, normNotes, openNotes } from '../../core/notes';

describe('заметки к группе', () => {
  it('оставляет только заметки с текстом и обрезает длинные', () => {
    const n = normNotes([{ id: 'a', t: '  проверить коробку ', at: 5 }, { id: 'b', t: '   ', at: 1 }, 3, { id: 'c', t: 'x'.repeat(900), at: 2, done: true }]);
    expect(n).toHaveLength(2);
    expect(n[0]).toEqual({ id: 'a', t: 'проверить коробку', at: 5 });
    expect(n[1].t).toHaveLength(NOTE_MAX);
    expect(n[1].done).toBe(true);
  });

  it('не больше предела и без мусора', () => {
    expect(normNotes('x')).toEqual([]);
    expect(normNotes(Array.from({ length: 80 }, (_, i) => ({ id: String(i), t: 'a', at: i })))).toHaveLength(NOTES_MAX);
  });

  it('считает открытые заметки', () => {
    expect(openNotes(undefined)).toBe(0);
    expect(openNotes([{ id: 'a', t: 'x', at: 1 }, { id: 'b', t: 'y', at: 1, done: true }])).toBe(1);
  });
});
