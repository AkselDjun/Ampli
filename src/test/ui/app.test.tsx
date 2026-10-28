import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { click, dlg, isOpen, wide, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const rowsOf = () => document.querySelectorAll('.rows .row');

describe('App', () => {
  it('renders the sample project with kpis and persists to storage', () => {
    render(<App />);
    expect(rowsOf().length).toBeGreaterThan(3);
    expect(document.querySelector('.kpis')?.textContent).toContain('кВт');
    expect(JSON.parse(localStorage.getItem(KEY) as string).list.length).toBe(1);
    expect(screen.getByText(/Пример двухкомнатной/)).toBeInTheDocument();
  });

  it('adds, duplicates and deletes groups on a narrow screen', async () => {
    wide(false);
    const user = userEvent.setup();
    render(<App />);
    const n0 = rowsOf().length;
    await user.click(screen.getByRole('button', { name: '+ Добавить группу' }));
    await user.click(screen.getByRole('menuitem', { name: 'Освещение' }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
    expect(rowsOf().length).toBe(n0 + 1);
    await user.click(screen.getByRole('button', { name: 'Открыть' }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'edit');
    await user.click(screen.getByRole('button', { name: 'Копировать группу' }));
    expect(rowsOf().length).toBe(n0 + 2);
    expect(document.querySelector('.ab-title')?.textContent).toContain('копия');
    const del = screen.getByRole('button', { name: 'Удалить группу' });
    await user.click(del);
    expect(del).toHaveTextContent('Нажмите ещё раз, чтобы удалить');
    await user.click(del);
    expect(rowsOf().length).toBe(n0 + 1);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
  });

  it('back and Готово buttons return to groups and restore scroll', () => {
    vi.useFakeTimers();
    wide(false);
    render(<App />);
    fireEvent.click(rowsOf()[0]);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'edit');
    fireEvent.click(screen.getByRole('button', { name: 'Назад к группам' }));
    act(() => { vi.advanceTimersByTime(10); });
    expect(window.scrollTo).toHaveBeenCalled();
    fireEvent.click(rowsOf()[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
  });

  it('on a wide screen selecting does not switch view and deleting stays', async () => {
    wide(true);
    const user = userEvent.setup();
    render(<App />);
    await user.click(rowsOf()[1]);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
    const del = screen.getByRole('button', { name: 'Удалить группу' });
    await user.click(del);
    await user.click(del);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
  });

  it('mobile tabs switch views', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    await user.click(within(nav).getByRole('button', { name: /Итоги/ }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'sum');
    await user.click(within(nav).getByRole('button', { name: /Щиток/ }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'panel');
    await user.click(within(nav).getByRole('button', { name: /Группы/ }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
  });

  it('undo and redo via buttons and Ctrl+Z shortcuts', async () => {
    wide(true);
    const user = userEvent.setup();
    render(<App />);
    const n0 = rowsOf().length;
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '+ Добавить группу' }));
    await user.click(screen.getByRole('menuitem', { name: 'Розетки' }));
    expect(rowsOf().length).toBe(n0 + 1);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(rowsOf().length).toBe(n0);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(rowsOf().length).toBe(n0 + 1);
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(rowsOf().length).toBe(n0);
    await user.click(screen.getByRole('button', { name: 'Вернуть' }));
    expect(rowsOf().length).toBe(n0 + 1);
    await user.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(rowsOf().length).toBe(n0);
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'z' });
    expect(rowsOf().length).toBe(n0);
    const inp = screen.getByRole('textbox', { name: 'Название группы' });
    fireEvent.keyDown(inp, { key: 'z', ctrlKey: true });
    expect(rowsOf().length).toBe(n0);
  });

  it('start from scratch clears the sample and shows empty state', async () => {
    const user = userEvent.setup();
    render(<App />);
    const b = screen.getByRole('button', { name: 'Начать с нуля' });
    await user.click(b);
    await user.click(screen.getByRole('button', { name: 'Нажмите ещё раз' }));
    expect(screen.queryByText(/Пример двухкомнатной/)).toBeNull();
    expect(rowsOf().length).toBe(1);
    expect(document.querySelector('.row-sub')?.textContent).toContain('нет приборов');
  });

  it('opens and closes all sheets from the bar and tabs', () => {
    render(<App />);
    const bar = document.querySelector('.ab-main') as HTMLElement;
    const nav = document.querySelector('nav.tabs') as HTMLElement;
    click(document.querySelector('.col-list') as HTMLElement, 'Параметры сети');
    expect(isOpen('Параметры сети')).toBe(true);
    void bar;
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isOpen('Параметры сети')).toBe(false);
    click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
    expect(isOpen('Проекты')).toBe(true);
    click(dlg('Проекты'), 'Мои данные');
    expect(isOpen('Мои данные')).toBe(true);
    click(dlg('Мои данные'), 'Закрыть');
    click(document.querySelector('.col-list') as HTMLElement, '+ Добавить группу');
    click(document.querySelector('.col-list') as HTMLElement, 'Из комнат');
    expect(isOpen('Комнаты')).toBe(true);
    fireEvent.click(dlg('Комнаты').parentElement as HTMLElement);
    expect(isOpen('Комнаты')).toBe(false);
    click(nav, /Отчёт/);
    click(dlg('Отчёт и спецификация'), 'Сравнить варианты');
    expect(isOpen('Сравнение вариантов')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    click(nav, /Приёмка/);
    expect(isOpen('Монтаж и приёмка')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    click(bar, /Приёмка/);
    fireEvent.keyDown(document, { key: 'Escape' });
    click(bar, /Отчёт/);
    fireEvent.keyDown(document, { key: 'Escape' });
    click(document.querySelector('.col-list') as HTMLElement, 'Параметры сети');
    expect(isOpen('Параметры сети')).toBe(true);
  });

  it('prints in each mode with a delayed window.print and restores the title', () => {
    vi.useFakeTimers();
    document.title = 'orig';
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    fireEvent.click(within(nav).getByRole('button', { name: /Отчёт/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Печать / PDF' }));
    expect(document.title).toContain('Ampli');
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('orig');
    fireEvent.click(within(nav).getByRole('button', { name: /Приёмка/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Документы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Печать протокола' }));
    expect(document.querySelector('.printdoc h1')?.textContent).toBe('Протокол замеров');
    fireEvent.click(screen.getByRole('button', { name: 'Наклейки щитка' }));
    expect(document.querySelector('.printdoc h1')?.textContent).toBe('Наклейки для щитка');
    fireEvent.click(screen.getByRole('button', { name: 'Бирки кабелей' }));
    expect(document.querySelector('.printdoc h1')?.textContent).toBe('Бирки кабелей');
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(4);
  });

  it('survives window.print throwing and an unnamed project title', () => {
    vi.useFakeTimers();
    (window.print as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('x'); });
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Отчёт/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Печать / PDF' }));
    expect(() => act(() => { vi.advanceTimersByTime(60); })).not.toThrow();
  });

  it('switching project resets the view', () => {
    render(<App />);
    click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
    const d = dlg('Проекты');
    click(d, '+ Новый проект');
    click(d, /Студия/);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
    expect(toastText()).toContain('Создан проект');
  });

  it('balance button on three phases', () => {
    render(<App />);
    click(document.querySelector('.col-list') as HTMLElement, 'Параметры сети');
    fireEvent.click(dlg('Параметры сети').querySelector('input[name="sup"][value="3"]') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    const fold = document.querySelector('.c-phase .fold-h') as HTMLElement;
    if (fold.getAttribute('aria-expanded') !== 'true') fireEvent.click(fold);
    click(document, 'Выровнять');
    expect(screen.getByText('Нагрузка по фазам')).toBeInTheDocument();
  });
});
