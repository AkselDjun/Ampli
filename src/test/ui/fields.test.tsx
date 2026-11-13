import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddChips, ChoiceField, Empty, StepField } from '../../ui/fields';

describe('ChoiceField', () => {
  it('names the radio group by its visible label and shows the note', () => {
    const on = vi.fn();
    render(<ChoiceField<string> name="t" label="Тип группы" value="a" items={[['a', 'Свет'], ['b', 'Розетки']]} onChange={on} note="Подсказка под полем" />);
    expect(screen.getByRole('radiogroup', { name: 'Тип группы' })).toBeTruthy();
    expect(screen.getByText('Подсказка под полем')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Розетки' }));
    expect(on).toHaveBeenCalledWith('b');
  });

  it('puts the hint button next to the label', () => {
    render(<ChoiceField<string> name="t" label="Объект" tip="Текст" tipLabel="О режиме" value="a" items={[['a', 'Квартира'], ['b', 'Дом']]} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'О режиме' }).closest('.lbl-row')).not.toBeNull();
  });
});

describe('StepField', () => {
  it('links the error to the input', () => {
    render(<StepField label="Длина, м" aria="Длина линии, м" value="-1" d={1} onChange={() => undefined} onStep={() => undefined} err={{ msg: 'Не меньше 0', hard: true }} />);
    const input = screen.getByRole('textbox', { name: 'Длина линии, м' });
    const id = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(id)?.textContent).toBe('Не меньше 0');
  });

  it('steps by the given amount', () => {
    const step = vi.fn();
    render(<StepField label="Длина, м" aria="Длина линии, м" value="5" d={5} onChange={() => undefined} onStep={step} />);
    fireEvent.click(screen.getByRole('button', { name: 'Больше' }));
    expect(step).toHaveBeenCalledWith(5);
  });
});

describe('Empty and AddChips', () => {
  it('shows an action under the empty text', () => {
    render(<Empty action={<button type="button">Добавить</button>}>Пусто</Empty>);
    expect(screen.getByText('Пусто').closest('.empty')?.querySelector('.empty-a button')).not.toBeNull();
  });

  it('groups add buttons under one name', () => {
    const add = vi.fn();
    render(<AddChips label="Добавить точку" items={[['tv', 'ТВ'], ['net', 'Интернет']]} onAdd={add} />);
    const g = screen.getByRole('group', { name: 'Добавить точку' });
    fireEvent.click(g.querySelector('button:last-child') as HTMLElement);
    expect(add).toHaveBeenCalledWith('net');
  });
});
