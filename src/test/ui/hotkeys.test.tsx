import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { isOpen, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
const selName = () => document.querySelector('.rows .row.sel .row-name')?.textContent;

describe('горячие клавиши', () => {
  it('J и K ходят по группам в порядке списка', async () => {
    wide(true);
    const user = userEvent.setup();
    render(<App />);
    await user.click(document.querySelector('.col-list h2') as HTMLElement);
    const order = rows().map(r => r.querySelector('.row-name')?.textContent);
    const at = order.indexOf(selName());
    await user.keyboard('j');
    expect(selName()).toBe(order[at + 1]);
    await user.keyboard('j');
    expect(selName()).toBe(order[at + 2]);
    await user.keyboard('k');
    expect(selName()).toBe(order[at + 1]);
    await new Promise(r => requestAnimationFrame(r));
    expect(document.activeElement).toBe(rows()[at + 1]);
    wide(false);
  });

  it('в поле ввода буквы печатаются, а не переключают группы', async () => {
    wide(true);
    const user = userEvent.setup();
    render(<App />);
    await user.click(rows()[2]);
    const before = selName();
    const name = screen.getByRole('textbox', { name: 'Название группы' });
    await user.clear(name);
    await user.type(name, 'jk');
    expect(name).toHaveValue('jk');
    expect(selName()).toBe('jk');
    expect(before).not.toBe('jk');
    wide(false);
  });

  it('? открывает справку', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(document.querySelector('.col-list h2') as HTMLElement);
    await user.keyboard('?');
    expect(isOpen('Горячие клавиши')).toBe(true);
    expect(screen.getByText('Следующая группа')).toBeInTheDocument();
    expect(screen.queryByText('Выбрать несколько групп')).toBeNull();
  });

  it('справка открывается из шестерёнки', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Настройки и обучение' }));
    await user.click(screen.getByRole('menuitem', { name: /^Горячие клавиши/ }));
    expect(isOpen('Горячие клавиши')).toBe(true);
  });
});
