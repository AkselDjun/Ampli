import { describe, expect, it } from 'vitest';
import { spokenToText } from '../../core/spoken';
import { parseApps } from '../../core/quick';
import { parseRooms } from '../../core/roomtext';

describe('spoken numbers', () => {
  it('turns number words into digits', () => {
    expect(spokenToText('чайник две тысячи двести ватт')).toBe('чайник 2200 Вт');
    expect(spokenToText('духовка три с половиной киловатта')).toBe('духовка 3,5 кВт');
    expect(spokenToText('полтора киловатта')).toBe('1,5 кВт');
    expect(spokenToText('тысяча ватт')).toBe('1000 Вт');
    expect(spokenToText('семь запятая пять киловатт')).toBe('7,5 кВт');
    expect(spokenToText('кабель два запятая двадцать пять')).toBe('кабель 2,25');
    expect(spokenToText('лампы шестьдесят ватт пять штук')).toBe('лампы 60 Вт, 5 шт');
    expect(spokenToText('лента пять метров')).toBe('лента 5 м');
    expect(spokenToText('сто двадцать три')).toBe('123');
    expect(spokenToText('с половиной')).toBe('с половиной');
    expect(spokenToText('пять запятая')).toBe('5 запятая');
  });

  it('separates appliances after units so the list parses', () => {
    const t = spokenToText('плита семь киловатт духовка три с половиной киловатта чайник две тысячи двести ватт');
    expect(t).toBe('плита 7 кВт, духовка 3,5 кВт, чайник 2200 Вт');
    expect(parseApps(t).apps.map(a => [a.name, a.w])).toEqual([['Плита', 7000], ['Духовка', 3500], ['Чайник', 2200]]);
  });

  it('marks rooms when dictating rooms', () => {
    const t = spokenToText('кухня плита семь киловатт ванная бойлер два киловатта', true);
    expect(t).toBe('кухня: плита 7 кВт; ванная: бойлер 2 кВт');
    expect(parseRooms(t).rooms.map(r => r.name)).toEqual(['Кухня', 'Ванная']);
    expect(spokenToText('кухня: чайник', true)).toBe('кухня: чайник');
    expect(spokenToText('кухня плита', false)).toBe('кухня плита');
  });
});
