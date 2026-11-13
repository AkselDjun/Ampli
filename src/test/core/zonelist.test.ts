import { describe, it, expect } from 'vitest';
import { roomGroups, NO_ZONE } from '../../core/zonelist';
import { mkLine } from '../../core/templates';
import type { Line } from '../../core/types';

const at = (zone?: string): Line => ({ ...mkLine('Г', 'socket', 5, []), zone });

describe('roomGroups', () => {
  it('keeps a flat list when no group has a room', () => {
    expect(roomGroups([at(), at(' '), at()])).toEqual([{ zone: null, items: [0, 1, 2] }]);
  });

  it('keeps a flat list when every group is in the same room', () => {
    expect(roomGroups([at('Кухня'), at('Кухня')])).toEqual([{ zone: null, items: [0, 1] }]);
  });

  it('groups by first appearance and puts groups without a room last', () => {
    expect(roomGroups([at(), at('Кухня'), at('Ванная'), at('Кухня')])).toEqual([
      { zone: 'Кухня', items: [1, 3] },
      { zone: 'Ванная', items: [2] },
      { zone: NO_ZONE, items: [0] }
    ]);
  });

  it('treats rooms that differ only by case and spaces as one room', () => {
    expect(roomGroups([at('Кухня'), at('ванная'), at(' кухня '), at('Ванная')])).toEqual([
      { zone: 'Кухня', items: [0, 2] },
      { zone: 'ванная', items: [1, 3] }
    ]);
  });

  it('returns nothing for an empty project', () => {
    expect(roomGroups([])).toEqual([]);
  });
});
