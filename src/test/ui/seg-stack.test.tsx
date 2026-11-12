import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Seg, segStacks } from '../../ui/common';

describe('segmented control on narrow phones', () => {
  it('stacks options whose words do not fit side by side', () => {
    expect(segStacks(['Нет', 'Приоритетная', 'Отключается'])).toBe(true);
    expect(segStacks(['Обычные', 'Вне помещения или особо опасные'])).toBe(true);
    expect(segStacks(['ВВГнг(А)-LS', 'ВВГнг(А)-FRLS', 'NYM'])).toBe(true);
    expect(segStacks(['Дифавтомат на группу', 'УЗО на помещение + автоматы'])).toBe(true);
  });

  it('keeps short options in one row', () => {
    expect(segStacks(['Свет', 'Розетки', 'Силовая'])).toBe(false);
    expect(segStacks(['Квартира', 'Частный дом'])).toBe(false);
    expect(segStacks(['Нет', 'На розетки', 'На все группы'])).toBe(false);
    expect(segStacks(['Электрическая', 'Газовая'])).toBe(false);
    expect(segStacks(['Подобрать', 'Бетон, кирпич', 'Гипсокартон', 'Накладные IP54'])).toBe(false);
  });

  it('turns long or many options into a list of radio buttons', () => {
    const { container, rerender } = render(<Seg name="a" value="" items={[['', 'Нет'], ['p', 'Приоритетная'], ['s', 'Отключается']]} onChange={vi.fn()} />);
    expect(container.querySelector('.radios[role="radiogroup"]')).not.toBeNull();
    expect(container.querySelector('.seg')).toBeNull();
    rerender(<Seg name="a" value="b" items={[['a', 'Подобрать'], ['b', 'Бетон, кирпич'], ['c', 'Гипсокартон'], ['d', 'Накладные IP54']]} onChange={vi.fn()} />);
    expect(container.querySelector('.radios')).not.toBeNull();
    rerender(<Seg name="a" value="1" items={[['1', 'L1'], ['2', 'L2'], ['3', 'L3'], ['x', '3Ф']]} onChange={vi.fn()} />);
    expect(container.querySelector('.seg')).not.toBeNull();
    rerender(<Seg name="a" value="l" items={[['l', 'Свет'], ['s', 'Розетки']]} onChange={vi.fn()} />);
    expect(container.querySelector('.seg')).not.toBeNull();
    expect(container.querySelector('.radios')).toBeNull();
  });
});
