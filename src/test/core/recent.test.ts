import { describe, expect, it } from 'vitest';
import { initials, recentProjects, whenLabel } from '../../core/recent';

const day = 86400000;
const now = new Date(2026, 10, 26, 15, 0).getTime();

describe('whenLabel', () => {
  it('называет сегодняшнюю и вчерашнюю правку словами', () => {
    expect(whenLabel(now - 3600000, now)).toBe('сегодня');
    expect(whenLabel(new Date(2026, 10, 26, 0, 5).getTime(), now)).toBe('сегодня');
    expect(whenLabel(new Date(2026, 10, 25, 23, 50).getTime(), now)).toBe('вчера');
  });

  it('старшую правку показывает датой', () => {
    expect(whenLabel(now - 3 * day, now)).toBe('23.11');
    expect(whenLabel(new Date(2025, 11, 31).getTime(), now)).toBe('31.12.2025');
  });

  it('правку из будущего считает сегодняшней', () => {
    expect(whenLabel(now + day, now)).toBe('сегодня');
  });
});

describe('recentProjects', () => {
  const list = [
    { id: 'a', updated: 10 },
    { id: 'b', updated: 30 },
    { id: 'c', updated: 20 },
    { id: 'd', updated: 5 }
  ];

  it('ставит текущий проект первым, остальные по последней правке', () => {
    expect(recentProjects(list, 'd', 3).map(x => x.id)).toEqual(['d', 'b', 'c']);
  });

  it('не теряет проекты, если их меньше предела', () => {
    expect(recentProjects(list.slice(0, 2), 'a', 5).map(x => x.id)).toEqual(['a', 'b']);
  });

  it('без текущего проекта просто сортирует', () => {
    expect(recentProjects(list, 'x', 2).map(x => x.id)).toEqual(['b', 'c']);
  });
});

describe('initials', () => {
  it('берёт первые буквы двух слов', () => {
    expect(initials('Квартира Петровых')).toBe('КП');
    expect(initials('дом в Колодищах')).toBe('ДК');
  });

  it('у одного слова берёт две буквы, у пустого названия знак проекта', () => {
    expect(initials('Офис')).toBe('ОФ');
    expect(initials('  ')).toBe('П');
    expect(initials('Пример: двухкомнатная квартира')).toBe('ПД');
  });
});
