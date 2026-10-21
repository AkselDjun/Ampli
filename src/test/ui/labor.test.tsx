import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { EstimateView, approveText } from '../../ui/EstimateView';
import { KEY } from '../../store/storage';
import { LIB_KEY } from '../../store/lib';
import { sampleProject } from '../../core/project';
import { packEstimate, packProject } from '../../core/share';
import type { EstimateShare } from '../../core/share';
import { byLabel, change, click, dlg, toastText, wide } from './util';

vi.mock('../../ui/download', () => ({ download: vi.fn() }));

const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const lib = () => JSON.parse(localStorage.getItem(LIB_KEY) as string);
const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const openEstimate = () => {
  click(nav(), /Отчёт/);
  const d = dlg('Отчёт и спецификация');
  fireEvent.click(within(d).getByRole('tab', { name: 'Смета', hidden: true }));
  return d;
};
const share = (o: Partial<EstimateShare> = {}): EstimateShare => ({
  p: sampleProject(),
  prices: { 'Шина N (нулевая)': 9 },
  labor: { socket: 12, switch: 8 },
  company: 'ИП Иванов',
  contacts: '+375 29 000-00-00',
  at: 1760000000000,
  ...o
});
const setClip = (impl: () => Promise<void>) => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(impl) }, configurable: true });
  return (navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> }).writeText;
};

afterEach(() => {
  window.location.hash = '';
  delete (navigator as { share?: unknown }).share;
});

describe('Labour estimate in the report', () => {
  it('saves prices to the library, quantities to the project and sums both', () => {
    wide(false);
    render(<App />);
    const d = openEstimate();
    expect(d.textContent).toContain('Работы');
    expect(d.querySelector('.tot-all dd')?.textContent).toBe('0,00 BYN');
    const qty = byLabel(d, 'Количество: Установка выключателя');
    expect(qty.placeholder).toBe('0');
    change(qty, '5');
    change(byLabel(d, 'Цена: Установка выключателя'), '10');
    expect(lib().labor.switch).toBe(10);
    expect(stored().list[0].work).toEqual({ switch: 5 });
    const row = byLabel(d, 'Цена: Установка выключателя').closest('tr') as HTMLElement;
    expect(row.querySelector('td[data-label="Сумма, BYN"]')?.textContent).toBe('50,00');
    change(byLabel(d, 'Цена: Шина N (нулевая)'), '7');
    expect(d.querySelector('.tot-all dd')?.textContent).toBe('57,00 BYN');
    change(qty, '');
    expect(stored().list[0].work).toEqual({});
  });

  it('copies a client link with the estimate snapshot', async () => {
    localStorage.setItem(LIB_KEY, JSON.stringify({ prices: { 'Шина N (нулевая)': 7, 'Чужая позиция': 1 }, labor: { socket: 12 }, brand: { company: 'ИП Петров', contacts: '+375' } }));
    const write = setClip(() => Promise.resolve());
    render(<App />);
    const d = openEstimate();
    await act(async () => { click(d, /Ссылка для клиента/); });
    const url = write.mock.calls[0][0] as string;
    expect(url).toContain('#e=v1.');
    window.location.hash = url.slice(url.indexOf('#'));
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    const v = document.querySelector('.est-view') as HTMLElement;
    expect(v.textContent).toContain('ИП Петров');
    expect(v.textContent).not.toContain('Чужая позиция');
    click(v, 'Открыть Ampli');
    expect(document.querySelector('.est-view')).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('prints works and the grand total in the PDF report', () => {
    localStorage.setItem(LIB_KEY, JSON.stringify({ prices: { 'Шина N (нулевая)': 7 }, labor: { socket: 12 } }));
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<App />);
    const d = openEstimate();
    click(d, /Печать/);
    const doc = document.querySelector('.printdoc') as HTMLElement;
    expect(doc.textContent).toContain('Установка розетки');
    expect(doc.textContent).toContain('Итого: работы и материалы');
    print.mockRestore();
  });
});

describe('Client estimate page', () => {
  it('opens from an estimate link with totals and only priced works', () => {
    window.location.hash = '#e=' + packEstimate(share());
    render(<App />);
    const v = document.querySelector('.est-view') as HTMLElement;
    expect(v.querySelector('h1')?.textContent).toContain('Смета: Пример');
    expect(v.textContent).toContain('+375 29 000-00-00');
    expect(v.textContent).toContain('Установка розетки');
    expect(v.textContent).not.toContain('Установка выключателя');
    expect(v.textContent).toContain('Цены на');
    expect(document.querySelector('.col-edit')).toBeNull();
  });

  it('approves through the share sheet, the clipboard or a selectable text', async () => {
    const data = share({ company: '', contacts: '', at: 0, labor: {} });
    const { unmount } = render(<EstimateView data={data} onClose={() => undefined} />);
    const v = () => document.querySelector('.est-view') as HTMLElement;
    expect(v().querySelector('.ev-brand')).toBeNull();
    expect(v().textContent).not.toContain('Цены на');
    const sh = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: sh, configurable: true });
    await act(async () => { click(v(), 'Согласовать'); });
    expect(sh).toHaveBeenCalledTimes(1);
    expect((sh.mock.calls[0] as unknown as [{ text: string }])[0].text).toContain('Согласую смету «Пример');
    Object.defineProperty(navigator, 'share', { value: vi.fn(() => Promise.reject(new Error('cancel'))), configurable: true });
    const write = setClip(() => Promise.resolve());
    await act(async () => { click(v(), 'Согласовать'); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(toastText()).toContain('Отправьте его мастеру');
    delete (navigator as { share?: unknown }).share;
    setClip(() => Promise.reject(new Error('no')));
    await act(async () => { click(v(), 'Согласовать'); });
    const ta = v().querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toContain('Согласую смету');
    expect(document.activeElement).toBe(ta);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    click(v(), 'Сохранить в PDF');
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
    unmount();
  });

  it('builds the approval text with the address and totals', () => {
    const p = sampleProject();
    p.address = 'ул. Тестовая, 1';
    const t = approveText(share({ p }), 100, 50.5, 'https://a.by/#e=x');
    expect(t).toBe('Согласую смету «' + p.name + '», ул. Тестовая, 1 на 150,50 BYN (работы 50,50, материалы 100,00). https://a.by/#e=x');
    expect(approveText(share({ p: { ...p, name: '', address: '' } }), 0, 0, 'u')).toContain('«Без названия» на 0,00 BYN');
  });

  it('ignores a broken estimate link', () => {
    window.location.hash = '#e=broken';
    render(<App />);
    expect(document.querySelector('.est-view')).toBeNull();
    window.location.hash = '#e=' + packProject(sampleProject());
  });
});
