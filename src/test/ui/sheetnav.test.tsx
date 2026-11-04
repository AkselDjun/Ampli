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

  it('closes the whole chain with the cross and starts fresh next time', () => {
    render(<App />);
    fireEvent.click(nav().getByRole('button', { name: /Приёмка/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Замеры' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ввести на щитке' }));
    expect(isOpen('На щитке')).toBe(true);
    expect(within(dlg('На щитке')).getByRole('button', { name: 'Назад: Монтаж и приёмка' })).toBeTruthy();
    fireEvent.click(within(dlg('На щитке')).getByRole('button', { name: 'Закрыть' }));
    expect(isOpen('На щитке')).toBe(false);
    expect(isOpen('Монтаж и приёмка')).toBe(false);
    fireEvent.click(nav().getByRole('button', { name: /Щиток/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Режим на щитке' }));
    expect(dlg('На щитке').querySelector('.sheet-back')).toBeNull();
  });

  it('chains report to compare and projects to my data', () => {
    render(<App />);
    fireEvent.click(nav().getByRole('button', { name: /Отчёт/ }));
    fireEvent.click(within(dlg('Отчёт и спецификация')).getByRole('button', { name: /Сравнить варианты/ }));
    const cmp = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(d => !(d.parentElement as HTMLElement).hidden) as HTMLElement;
    fireEvent.click(within(cmp).getByRole('button', { name: 'Назад: Отчёт и спецификация' }));
    expect(isOpen('Отчёт и спецификация')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelector('.projbar') as HTMLElement);
    fireEvent.click(screen.getByRole('tab', { name: /Обмен|Перенос|Поделиться/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть мои данные' }));
    expect(within(dlg('Мои данные')).getByRole('button', { name: 'Назад: Проекты' })).toBeTruthy();
  });
});
