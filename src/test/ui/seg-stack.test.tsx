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
    expect(segStacks(['Свет', 'Розетки', 'Мощный'])).toBe(false);
    expect(segStacks(['Квартира', 'Частный дом'])).toBe(false);
    expect(segStacks(['Нет', 'На розетки', 'На все группы'])).toBe(false);
    expect(segStacks(['Электрическая', 'Газовая'])).toBe(false);
    expect(segStacks(['Подобрать', 'Бетон, кирпич', 'Гипсокартон', 'Накладные IP54'])).toBe(false);
  });

  it('shows long options as a radio list and short ones as a segment', () => {
    const { container, rerender } = render(<Seg name="a" value="" items={[['', 'Нет'], ['p', 'Приоритетная'], ['s', 'Отключается']]} onChange={vi.fn()} />);
    expect(container.querySelector('.rlist')).toHaveAttribute('data-stack');
    expect(container.querySelector('.seg')).toBeNull();
    rerender(<Seg name="a" value="l" items={[['l', 'Свет'], ['s', 'Розетки']]} onChange={vi.fn()} />);
    expect(container.querySelector('.seg')).not.toHaveAttribute('data-stack');
    expect(container.querySelector('.rlist')).toBeNull();
  });
});
