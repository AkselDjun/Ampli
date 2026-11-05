import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Field, IconButton, buttonClass } from '../../ui/kit';
import { ArmButton } from '../../ui/common';

describe('kit', () => {
  it('builds button classes from variant and size', () => {
    expect(buttonClass()).toBe('btn');
    expect(buttonClass('primary', 'sm', 'add-b')).toBe('btn primary sm add-b');
    render(<Button variant="danger" onClick={vi.fn()}>Удалить</Button>);
    const b = screen.getByRole('button', { name: 'Удалить' });
    expect(b).toHaveClass('btn', 'danger');
    expect(b).toHaveAttribute('type', 'button');
  });

  it('labels icon buttons and shows the tip only when given', () => {
    render(<><IconButton label="Удалить фото" tip="Удалить фото">x</IconButton><IconButton label="Закрыть" className="pal-x">y</IconButton></>);
    const a = screen.getByRole('button', { name: 'Удалить фото' });
    expect(a).toHaveClass('icon-btn');
    expect(a).toHaveAttribute('data-tip', 'Удалить фото');
    const b = screen.getByRole('button', { name: 'Закрыть' });
    expect(b).toHaveClass('icon-btn', 'pal-x');
    expect(b).not.toHaveAttribute('data-tip');
  });

  it('ties the label to the control and shows a hint', () => {
    const { container } = render(<Field id="x1" label="Длина, м" hint="до щитка" wide className="len-f"><input id="x1" /></Field>);
    expect(screen.getByLabelText('Длина, м')).toBe(container.querySelector('#x1'));
    expect(container.firstElementChild).toHaveClass('f', 'wide', 'len-f');
    expect(container.querySelector('small')?.textContent).toBe('до щитка');
  });

  it('renders an armed action as a link or a button', () => {
    render(<><ArmButton link className="js-blank" label="С нуля" onRun={vi.fn()} /><ArmButton link label="Сброс" onRun={vi.fn()} /><ArmButton variant="ghost" size="sm" label="Пример" onRun={vi.fn()} /></>);
    expect(screen.getByRole('button', { name: 'С нуля' }).className).toBe('link js-blank');
    expect(screen.getByRole('button', { name: 'Сброс' }).className).toBe('link');
    expect(screen.getByRole('button', { name: 'Пример' }).className).toBe('btn ghost sm');
  });
});
