import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { LIB_KEY } from '../../store/lib';
import { PL_KEY } from '../../store/pricelists';
import { sampleProject } from '../../core/project';
import { click, dlg, isOpen, wide, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const lib = () => JSON.parse(localStorage.getItem(LIB_KEY) as string);
const csv = (text: string, name = 'opt.csv') => {
  const f = new File([text], name, { type: 'text/csv' });
  Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.resolve(new TextEncoder().encode(text).buffer) });
  return f;
};
const openShop = () => {
  click(nav(), /Отчёт/);
  click(dlg('Отчёт и спецификация'), 'Где купить');
  return dlg('Где купить');
};
const upload = async (d: HTMLElement, f: File) => {
  const input = d.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  fireEvent.change(input);
};

afterEach(() => localStorage.clear());

describe('Where to buy', () => {
  it('opens from the report and lists every spec item with search links', () => {
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    const d = openShop();
    expect(isOpen('Где купить')).toBe(true);
    const items = d.querySelectorAll('.shop-i');
    expect(items.length).toBeGreaterThan(5);
    const links = Array.from(items[1].querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map(a => a.textContent)).toEqual(['Onliner', '21vek', 'shop.by', 'Везде']);
    links.forEach(a => {
      expect(a.href).toContain('google.com/search');
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    });
    expect(d.querySelector('.shop-offer')).toBeNull();
    expect(d.querySelector('.shop-foot')).toBeNull();
  });

  it('loads a price list, finds the cheapest match and applies the prices to the estimate', async () => {
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    const d = openShop();
    const first = Array.from(d.querySelectorAll('.shop-i b')).map(b => b.textContent as string);
    const breaker = first.find(n => /^Дифавтомат 1P\+N C10/.test(n) || /^Автомат 1P C10/.test(n)) as string;
    expect(breaker).toBeTruthy();
    const rows = ['Наименование;Цена', 'Автомат ВА47 1P C10;5,5', 'Автомат ВА47 1P C10 дорогой;9', 'Дифавтомат 1P+N C10 30 мА;21', 'Дифавтомат 1P+N C10 30 мА EKF;19,5', 'Шина N на DIN-рейку;3'].join('\n');
    await upload(d, csv(rows));
    await waitFor(() => expect(d.querySelector('.pl-list')).toBeTruthy());
    expect(d.querySelector('.pl-list')?.textContent).toContain('opt');
    expect(JSON.parse(localStorage.getItem(PL_KEY) as string)).toHaveLength(1);
    expect(toastText()).toMatch(/Загружено позиций: 5/);
    const foot = d.querySelector('.shop-foot') as HTMLElement;
    expect(foot.textContent).toMatch(/Найдено цен/);
    const select = d.querySelector('select[aria-label^="Вариант для"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.options[0].textContent).toContain('19,5');
    fireEvent.change(select, { target: { value: '1' } });
    expect(select.options[select.selectedIndex].textContent).toContain('21');
    click(d, 'Подставить в смету');
    expect(toastText()).toMatch(/Цены подставлены в смету/);
    expect(Object.keys(lib().prices).length).toBeGreaterThan(0);
    expect(Object.values(lib().prices as Record<string, number>)).toContain(3);
  });

  it('says so when the file has no prices and when nothing in the lists matches', async () => {
    render(<App />);
    const d = openShop();
    await upload(d, csv('просто;текст\nещё;строка'));
    await waitFor(() => expect(toastText()).toMatch(/нет колонок/));
    await upload(d, csv('Наименование;Цена\nРозетка;5'));
    await waitFor(() => expect(d.querySelector('.shop-foot')).toBeTruthy());
    expect(d.querySelectorAll('.shop-offer .muted')[0].textContent).toMatch(/не найдено/);
    expect(within(d).getByRole('button', { name: 'Подставить в смету' })).toBeDisabled();
  });

  it('removes a price list and keeps working without it', async () => {
    render(<App />);
    const d = openShop();
    await upload(d, csv('Наименование;Цена\nШина N;3', 'шины.csv'));
    await waitFor(() => expect(d.querySelector('.pl-list')).toBeTruthy());
    click(d, 'Удалить прайс шины');
    expect(d.querySelector('.pl-list')).toBeNull();
    expect(d.querySelector('.shop-foot')).toBeNull();
    expect(JSON.parse(localStorage.getItem(PL_KEY) as string)).toEqual([]);
  });

  it('reports an unreadable file and a full browser storage', async () => {
    render(<App />);
    const d = openShop();
    const bad = new File(['x'], 'a.csv');
    Object.defineProperty(bad, 'arrayBuffer', { value: () => Promise.reject(new Error('x')) });
    await upload(d, bad);
    await waitFor(() => expect(toastText()).toMatch(/Не удалось прочитать/));
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await upload(d, csv('Наименование;Цена\nШина N;3'));
    await waitFor(() => expect(toastText()).toMatch(/не поместился/));
    spy.mockRestore();
    fireEvent.change(d.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [] } });
  });

  it('is closed by default and the button lives in the report', () => {
    wide(false);
    render(<App />);
    expect(isOpen('Где купить')).toBe(false);
    expect(within(dlg('Отчёт и спецификация')).getByRole('button', { name: 'Где купить', hidden: true })).toBeTruthy();
  });
});
