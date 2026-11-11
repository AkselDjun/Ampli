import { describe, expect, it } from 'vitest';
import { ROOM_TEXT_MAX, parseRooms } from '../../core/roomtext';
import { assemble } from '../../core/rooms';

const msg = `Здравствуйте! Вот что будет:
Кухня: плита 7 кВт, духовка 3,5 кВт, посудомоечная машина, чайник 2200
Ванная: водонагреватель, стиральная машина; Спальня: люстра 180, телевизор 150
- Коридор: светильники 60 x3`;

describe('rooms from a client message', () => {
  it('splits rooms and appliances', () => {
    const r = parseRooms(msg);
    expect(r.rooms.map(x => x.name)).toEqual(['Кухня', 'Ванная', 'Спальня', 'Коридор']);
    const k = r.rooms[0];
    expect(k.kitchen).toBe(true);
    expect(k.apps.map(a => [a.name, a.w, a.tag])).toEqual([['Плита', 7000, 'p'], ['Духовка', 3500, 'p'], ['Посудомоечная машина', 2000, 's'], ['Чайник', 2200, 's']]);
    expect(r.rooms[1].apps.map(a => a.tag)).toEqual(['p', 's']);
    expect(r.rooms[2].apps[0].tag).toBe('l');
    expect(r.rooms[3].apps[0]).toMatchObject({ name: 'Светильники', w: 60, n: 3, tag: 'l' });
    expect(r.skipped).toEqual(['Здравствуйте! Вот что будет']);
    expect(assemble(r.rooms).length).toBeGreaterThan(3);
  });

  it('puts a list without rooms into one room and counts LED strip by length', () => {
    const r = parseRooms('чайник 2200, лента 14 вт/м 5 м', 'Гостиная');
    expect(r.rooms).toHaveLength(1);
    expect(r.rooms[0].name).toBe('Гостиная');
    expect(r.rooms[0].apps.map(a => [a.w, a.tag])).toEqual([[2200, 's'], [70, 'l']]);
  });

  it('drops empty rooms and stops at the room limit', () => {
    const e = parseRooms('Балкон:\nКухня: чайник 2200');
    expect(e.rooms.map(r => r.name)).toEqual(['Кухня']);
    expect(e.skipped).toEqual(['Балкон']);
    const many = Array.from({ length: ROOM_TEXT_MAX + 2 }, (_, i) => 'Комната ' + 'абвгдежзийклмнопр'[i] + ': чайник 2200').join('\n');
    const r = parseRooms(many);
    expect(r.rooms).toHaveLength(ROOM_TEXT_MAX);
    expect(r.skipped).toHaveLength(2);
    expect(parseRooms('').rooms).toEqual([]);
  });
});
