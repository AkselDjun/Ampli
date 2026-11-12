import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { dlg, isOpen, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const body = (title: string) => dlg(title).querySelector('.sheet-body') as HTMLElement;
const nav = () => within(screen.getByRole('navigation', { name: 'Разделы' }));

describe('sheet scroll', () => {
  it('opens at the top after being scrolled and closed', () => {
    render(<App />);
    fireEvent.click(nav().getByRole('button', { name: /Отчёт/ }));
    body('Отчёт и спецификация').scrollTop = 300;
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(nav().getByRole('button', { name: /Отчёт/ }));
    expect(body('Отчёт и спецификация').scrollTop).toBe(0);
  });

  it('returns to the top when switching tabs', () => {
    render(<App />);
    fireEvent.click(nav().getByRole('button', { name: /Отчёт/ }));
    body('Отчёт и спецификация').scrollTop = 250;
    fireEvent.click(screen.getByRole('tab', { name: 'Смета' }));
    expect(body('Отчёт и спецификация').scrollTop).toBe(0);
    body('Отчёт и спецификация').scrollTop = 250;
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Смета' }), { key: 'ArrowRight' });
    expect(body('Отчёт и спецификация').scrollTop).toBe(0);
  });
});

describe('back arrow between sheets', () => {
  it('goes back from a nested sheet and has no arrow on the first one', () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelector('.col-list .netfold') as HTMLElement);
    expect(dlg('Параметры сети').querySelector('.sheet-back')).toBeNull();
    fireEvent.click(dlg('Параметры сети').querySelector('.net-old') as HTMLElement);
    expect(isOpen('Старая проводка')).toBe(true);
    expect(isOpen('Параметры сети')).toBe(false);
    const back = within(dlg('Старая проводка')).getByRole('button', { name: 'Назад: Параметры сети' });
    fireEvent.click(back);
    expect(isOpen('Параметры сети')).toBe(true);
    expect(isOpen('Старая проводка')).toBe(false);
    expect(dlg('Параметры сети').querySelector('.sheet-back')).toBeNull();
  });

  it('keeps measurements inside the acceptance sheet without a second window', () => {
    render(<App />);
    fireEvent.click(nav().getByRole('button', { name: /Приёмка/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Замеры/ }));
    expect(dlg('Монтаж и приёмка').querySelector('.pmb-box')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ввести на щитке' })).toBeNull();
    fireEvent.click(within(dlg('Монтаж и приёмка')).getByRole('button', { name: 'Закрыть' }));
    expect(isOpen('Монтаж и приёмка')).toBe(false);
    fireEvent.click(nav().getByRole('button', { name: /Щиток/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Замеры на щитке' }));
    expect(isOpen('Монтаж и приёмка')).toBe(true);
    expect(screen.getByRole('tab', { name: /^Замеры/ })).toHaveAttribute('aria-selected', 'true');
    expect(dlg('Монтаж и приёмка').querySelector('.sheet-back')).toBeNull();
  });

  it('opens compare from totals and chains projects to my data', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Итого по квартире/ }));
    fireEvent.click(within(document.querySelector('.tot-pop') as HTMLElement).getByRole('button', { name: 'Сравнить варианты' }));
    expect(isOpen('Сравнение вариантов')).toBe(true);
    expect(dlg('Сравнение вариантов').querySelector('.sheet-back')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelector('.projbar') as HTMLElement);
    fireEvent.click(screen.getByRole('tab', { name: /Обмен|Перенос|Поделиться/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть мои данные' }));
    expect(within(dlg('Мои данные')).getByRole('button', { name: 'Назад: Проекты' })).toBeTruthy();
  });
});
