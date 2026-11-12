import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { DataTable, MoneyInput } from '../../ui/kit';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { click, dlg } from './util';

vi.setConfig({ testTimeout: 60000 });

const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const seed = () => {
  const p = sampleProject();
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
};

describe('data tables', () => {
  it('wraps a table in a focusable named region with head, body and foot', () => {
    render(
      <DataTable label="Проба" className="x" head={<th>Позиция</th>} foot={<tr><td>Итого</td></tr>}>
        <tr><td className="c-t">Кабель</td></tr>
      </DataTable>
    );
    const r = screen.getByRole('region', { name: 'Проба' });
    expect(r).toHaveAttribute('tabindex', '0');
    const t = r.querySelector('table') as HTMLElement;
    expect(t.className).toBe('dt x');
    expect(t.querySelector('thead th')?.textContent).toBe('Позиция');
    expect(t.querySelector('tfoot td')?.textContent).toBe('Итого');
  });

  it('shows the currency next to a price field without reading it twice', () => {
    render(<MoneyInput aria-label="Цена: кабель" value="" onChange={() => undefined} />);
    const inp = screen.getByRole('textbox', { name: 'Цена: кабель' });
    expect(inp).toHaveAttribute('inputmode', 'decimal');
    expect(inp.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(inp.nextElementSibling?.textContent).toBe('BYN');
  });

  it('keeps the norm quiet in the group table and colours only problems', () => {
    seed();
    render(<App />);
    click(nav(), /Отчёт/);
    const d = dlg('Отчёт и спецификация');
    const t = within(d).getByRole('region', { name: 'Таблица групп' });
    expect(t.querySelectorAll('.st-ok').length).toBeGreaterThan(0);
    expect(t.querySelectorAll('.pill.ok').length).toBe(0);
  });

  it('puts the note under the item name and the materials total in the table foot', () => {
    seed();
    render(<App />);
    click(nav(), /Отчёт/);
    const d = dlg('Отчёт и спецификация');
    fireEvent.click(within(d).getByRole('tab', { name: 'Смета' }));
    const t = within(d).getByRole('region', { name: 'Спецификация' });
    expect(t.querySelectorAll('thead th').length).toBe(4);
    expect(t.querySelector('tbody .c-t .dt-note')).toBeTruthy();
    expect(t.querySelector('tfoot')?.textContent).toContain('цены не заданы');
    fireEvent.change(t.querySelector('.price-in') as HTMLInputElement, { target: { value: '10' } });
    expect(t.querySelector('tfoot')?.textContent).toMatch(/\d+,\d{2} BYN/);
  });

  it('shows the comparison above the choices and dims what does not change', () => {
    seed();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Итого по квартире/ }));
    click(document.querySelector('.tot-pop') as HTMLElement, 'Сравнить варианты');
    const d = dlg('Сравнение вариантов');
    const res = within(d).getByRole('region', { name: 'Итог сравнения' });
    expect(res.compareDocumentPosition(within(d).getByText('Убрать из расчёта')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(res.querySelectorAll('tbody tr.diff').length).toBe(0);
    fireEvent.click(within(d).getAllByRole('checkbox')[6]);
    expect(res.querySelectorAll('tbody tr.diff').length).toBeGreaterThan(0);
    expect(res.querySelectorAll('tbody tr.same').length).toBeGreaterThan(0);
    expect(res.textContent).toMatch(/лучше|хуже/);
  });
});
