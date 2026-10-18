import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tip } from '../../ui/common';

describe('Tip', () => {
  it('toggles on click and exposes the text as tooltip', () => {
    const { container } = render(<Tip>Пояснение</Tip>);
    const b = screen.getByRole('button', { name: 'Подсказка' });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.tip')).toHaveClass('on');
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Пояснение');
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on outside pointer down and keeps open on inside', () => {
    render(<div><Tip>Текст</Tip><span>вне</span></div>);
    const b = screen.getByRole('button', { name: 'Подсказка' });
    fireEvent.click(b);
    fireEvent.pointerDown(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(screen.getByText('вне'));
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape without reaching other listeners', () => {
    render(<Tip label="Справка">Текст</Tip>);
    const b = screen.getByRole('button', { name: 'Справка' });
    fireEvent.click(b);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(b).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });
});
