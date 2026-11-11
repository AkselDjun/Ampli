import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { click, dlg, isOpen } from './util';

vi.setConfig({ testTimeout: 60000 });

afterEach(() => localStorage.clear());

describe('estimate without prices', () => {
  it('explains the empty total and leads to the price lists until a price is entered', () => {
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    click(document.querySelector('nav.tabs') as HTMLElement, /Отчёт/);
    const rep = dlg('Отчёт и спецификация');
    fireEvent.click(within(rep).getByRole('tab', { name: 'Смета' }));
    const hint = () => rep.querySelector('.est-hint');
    expect(hint()?.textContent).toContain('Цены пока не заданы');
    const price = rep.querySelector('input.price-in') as HTMLInputElement;
    fireEvent.change(price, { target: { value: '12' } });
    expect(hint()).toBeNull();
    fireEvent.change(price, { target: { value: '' } });
    click(hint() as HTMLElement, 'загрузите прайс магазина');
    expect(isOpen('Где купить')).toBe(true);
  });
});
