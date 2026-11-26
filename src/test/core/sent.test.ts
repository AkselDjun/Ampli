import { describe, expect, it } from 'vitest';
import { changedIds, lineChanges, normSent, removedSince, snapshot } from '../../core/sent';
import type { Row } from '../../core/types';

const row = (id: string, name: string, zone: string | undefined, pd: number, In: number, S: number, len: number, curve = 'C'): Row => ({
  l: { id, name, zone, len } as Row['l'],
  r: { pd, In, S, curve } as Row['r']
});

const rows = [row('a', 'Плита', 'Кухня', 7000, 32, 6, 8), row('b', 'Розетки', 'Кухня', 2000, 16, 2.5, 18)];

describe('снимок отправленной сметы', () => {
  it('запоминает то, что видел заказчик', () => {
    expect(snapshot(rows, 100)).toEqual({
      at: 100,
      lines: [
        { id: 'a', name: 'Плита', zone: 'Кухня', pd: 7000, In: 32, curve: 'C', S: 6, len: 8 },
        { id: 'b', name: 'Розетки', zone: 'Кухня', pd: 2000, In: 16, curve: 'C', S: 2.5, len: 18 }
      ]
    });
  });

  it('без изменений нечего показывать', () => {
    const s = snapshot(rows, 1);
    expect(lineChanges(s.lines[0], rows[0])).toEqual([]);
    expect(changedIds(s, rows).size).toBe(0);
  });

  it('называет каждое изменение словами', () => {
    const s = snapshot(rows, 1);
    const now = row('b', 'Розетки', 'Гостиная', 3500, 25, 4, 22, 'B');
    expect(lineChanges(s.lines[1], now)).toEqual([
      'Автомат C16 → B25',
      'Сечение 2,5 → 4 мм²',
      'Длина 18 → 22 м',
      'Мощность 2000 → 3500 Вт',
      'Помещение Кухня → Гостиная'
    ]);
  });

  it('новая группа помечается как добавленная', () => {
    expect(lineChanges(undefined, row('c', 'Свет', '', 300, 10, 1.5, 12))).toEqual(['Группа добавлена после отправки']);
  });

  it('видит изменённые и удалённые группы', () => {
    const s = snapshot(rows, 1);
    const now = [row('a', 'Плита', 'Кухня', 7000, 40, 10, 8), row('c', 'Свет', '', 300, 10, 1.5, 12)];
    expect([...changedIds(s, now)].sort()).toEqual(['a', 'c']);
    expect(removedSince(s, now)).toEqual(['Розетки']);
  });

  it('без снимка изменений нет', () => {
    expect(changedIds(undefined, rows).size).toBe(0);
    expect(removedSince(undefined, rows)).toEqual([]);
  });

  it('чистит снимок из файла', () => {
    expect(normSent(null)).toBeUndefined();
    expect(normSent({ at: 5, lines: 'x' })).toBeUndefined();
    const s = normSent({ at: 5, lines: [{ id: 'a', name: 'x'.repeat(200), zone: 3, pd: 'q', In: null, curve: 'C', S: 2.5, len: 10 }, 7] });
    expect(s?.lines).toHaveLength(1);
    expect(s?.lines[0].name).toHaveLength(80);
    expect(s?.lines[0]).toMatchObject({ id: 'a', zone: '', pd: 0, In: null, curve: 'C', S: 2.5, len: 10 });
  });
});
