import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { stored } from '../stored';
import { byLabel, change, click, dlg } from './util';

describe('Rooms from a client message', () => {
  it('adds rooms from pasted text and keeps what it could not read', () => {
    render(<App />);
    const lst = document.querySelector('.col-list') as HTMLElement;
    click(lst, 'Добавить группу');
    click(lst, 'Из комнат');
    const d = dlg('Комнаты');
    click(d, 'Из сообщения клиента');
    expect(within(d).queryByRole('button', { name: /Диктовать/ })).toBeNull();
    const ta = byLabel(d, 'Комнаты и приборы текстом');
    change(ta, 'Кухня: плита 7 кВт, чайник 2200\nВанная: бойлер 2 кВт\nнепонятно');
    click(d, 'Добавить комнаты');
    expect(within(d).getByRole('status').textContent).toContain('Добавлено: 2 комнаты, 3 прибора');
    expect(within(d).getByRole('status').textContent).toContain('непонятно');
    expect(byLabel(d, 'Комнаты и приборы текстом').value).toBe('непонятно');
    expect(stored().list[0].rooms?.map((r: { name: string }) => r.name)).toEqual(['Кухня', 'Ванная']);
    change(byLabel(d, 'Комнаты и приборы текстом'), 'ничего');
    click(d, 'Добавить комнаты');
    expect(within(d).getByRole('status').textContent).toContain('Ничего не добавлено');
    click(d, 'Скрыть ввод текстом');
    expect(d.querySelector('textarea')).toBeNull();
  });
});
