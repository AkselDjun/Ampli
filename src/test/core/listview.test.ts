import { describe, expect, it } from 'vitest';
import { listCounts, listView } from '../../core/listview';
import type { Row } from '../../core/types';

const row = (id: string, zone: string, status: 'ok' | 'warn' | 'bad', pd: number, I: number, drop: number, empty = false): Row => ({
  l: { id, zone } as Row['l'],
  r: { status, pd, I, drop, empty } as Row['r']
});

const rows = [
  row('a', 'Кухня', 'ok', 3400, 14.8, 2.8),
  row('b', 'Кухня', 'bad', 7000, 30.4, 5.2),
  row('c', 'Ванная', 'warn', 2200, 9.6, 2.4),
  row('d', 'Кухня', 'warn', 2100, 9.1, 2.0),
  row('e', 'Ванная', 'bad', 0, 0, 0, true)
];

const ids = (v: ReturnType<typeof listView>) => v.map(g => [g.zone, g.items.map(i => rows[i].l.id)]);

describe('listView', () => {
  it('без фильтра и сортировки повторяет группировку по помещениям', () => {
    expect(ids(listView(rows, null, 'no'))).toEqual([['Кухня', ['a', 'b', 'd']], ['Ванная', ['c', 'e']]]);
  });

  it('фильтр оставляет группы нужного статуса и убирает пустые помещения', () => {
    expect(ids(listView(rows, 'bad', 'no'))).toEqual([['Кухня', ['b']]]);
    expect(ids(listView(rows, 'warn', 'no'))).toEqual([['Кухня', ['d']], ['Ванная', ['c']]]);
  });

  it('группа без приборов не считается нарушением', () => {
    expect(listCounts(rows)).toEqual({ bad: 1, warn: 2 });
  });

  it('сортирует внутри помещения по убыванию', () => {
    expect(ids(listView(rows, null, 'i'))).toEqual([['Кухня', ['b', 'a', 'd']], ['Ванная', ['c', 'e']]]);
    expect(ids(listView(rows, null, 'p'))).toEqual([['Кухня', ['b', 'a', 'd']], ['Ванная', ['c', 'e']]]);
    expect(ids(listView(rows, null, 'du'))).toEqual([['Кухня', ['b', 'a', 'd']], ['Ванная', ['c', 'e']]]);
  });

  it('при одинаковом значении сохраняет порядок номеров', () => {
    const same = [row('x', '', 'ok', 100, 1, 1), row('y', '', 'ok', 100, 1, 1)];
    expect(listView(same, null, 'p')[0].items).toEqual([0, 1]);
  });

  it('фильтр по набору id для изменённых и заметок', () => {
    expect(ids(listView(rows, 'chg', 'no', { chg: new Set(['c', 'a']), note: new Set() }))).toEqual([['Кухня', ['a']], ['Ванная', ['c']]]);
    expect(ids(listView(rows, 'note', 'no', { chg: new Set(), note: new Set(['d']) }))).toEqual([['Кухня', ['d']]]);
  });

  it('один список без помещений остаётся одной группой', () => {
    const flat = [row('x', '', 'bad', 1, 1, 1), row('y', '', 'ok', 2, 2, 2)];
    expect(listView(flat, null, 'i')).toEqual([{ zone: null, items: [1, 0] }]);
    expect(listView(flat, 'warn', 'no')).toEqual([]);
  });
});
