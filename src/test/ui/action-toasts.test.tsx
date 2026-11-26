import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../ui/App';
import { click, dlg, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const nav = (): HTMLElement => screen.getByRole('navigation', { name: 'Разделы' });

describe('feedback for actions without a visible result', () => {
  it('names the project that was opened from the list', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Проекты$/ }));
    click(dlg('Проекты'), /Новый проект/);
    const menu = document.querySelector('[role="menu"]') ?? dlg('Проекты');
    click(menu, /Пустой/);
    fireEvent.click(screen.getByRole('button', { name: /^Проекты$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Пример: двухкомнатная/ }));
    expect(toastText()).toBe('Открыт проект: Пример: двухкомнатная квартира');
  });

  it('keeps checklist hints in tips and shows progress in the meter', () => {
    render(<App />);
    click(nav(), /Приёмка/);
    const d = dlg('Приёмка');
    const tips = d.querySelectorAll('.ck small');
    expect(tips.length).toBe(d.querySelectorAll('.ck input').length);
    expect(tips[0].textContent).toContain('Подписаны автоматы');
    fireEvent.click(d.querySelectorAll<HTMLInputElement>('.ck input')[0]);
    expect(d.querySelector('.wk-prog .meter')?.getAttribute('aria-label')).toBe('Выполнено 1 из ' + tips.length);
  });

  it('confirms deleting a saved template', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Проекты$/ }));
    const pj = dlg('Проекты');
    click(pj, /Обмен и данные/);
    click(pj, 'Сохранить как шаблон');
    click(pj, 'Открыть мои данные');
    const lib = dlg('Мои данные');
    click(lib, 'Шаблоны и цены');
    const row = lib.querySelector('.lib-r') as HTMLElement;
    click(row, 'Удалить');
    click(row, 'Точно?');
    expect(toastText()).toBe('Шаблон удалён: Пример: двухкомнатная квартира');
    expect(lib.querySelector('.lib-r')).toBeNull();
  });
});
