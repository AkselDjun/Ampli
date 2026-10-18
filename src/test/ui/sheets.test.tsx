import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { LIB_KEY } from '../../store/lib';
import { btn, byLabel, change, click, dlg, isOpen, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const list = () => document.querySelector('.col-list') as HTMLElement;
const open = (title: string) => {
  if (title === 'Проекты') click(list(), 'Проекты');
  else if (title === 'Параметры сети') click(list(), 'Параметры сети');
  else if (title === 'Комнаты') click(list(), 'Из комнат');
  else click(document.querySelector('nav.tabs') as HTMLElement, title === 'Монтаж и приёмка' ? /Приёмка/ : /Отчёт/);
  return dlg(title);
};
const stored = () => JSON.parse(localStorage.getItem(KEY) as string);

describe('NetSheet', () => {
  it('changes every config field via segments and steppers', () => {
    wide(true);
    render(<App />);
    const d = open('Параметры сети');
    const seg = (n: string, v: string) => fireEvent.click(d.querySelector('input[name="' + n + '"][value="' + v + '"]') as HTMLElement);
    seg('sup', '3');
    expect(stored().list[0].cfg.supply).toBe(3);
    seg('sup', '1');
    seg('met', 'open');
    seg('drop', '4');
    seg('drop', '0');
    seg('mins', 'norm');
    seg('mins', 'safe');
    for (const l of ['Потеря напряжения от ВРУ до щитка квартиры, %', 'Сопротивление петли фаза-нуль питающей сети, Ом', 'Выделенная мощность, кВт', 'Коэффициент одновременности', 'Поправка на нагрев и группировку']) {
      const inp = byLabel(d, l);
      const row = inp.parentElement as HTMLElement;
      const before = inp.value;
      fireEvent.click(row.querySelectorAll('button')[1]);
      fireEvent.click(row.querySelectorAll('button')[0]);
      change(inp, '0.9');
      expect(inp.value).not.toBe('');
      expect(before).not.toBeUndefined();
    }
    expect(stored().list[0].cfg.method).toBe('open');
  });

  it('loads sample and blank with armed buttons and closes the sheet', () => {
    wide(true);
    render(<App />);
    let d = open('Параметры сети');
    click(d, 'Начать с нуля');
    click(d, 'Нажмите ещё раз');
    expect(isOpen('Параметры сети')).toBe(false);
    expect(document.querySelectorAll('.rows .row').length).toBe(1);
    d = open('Параметры сети');
    click(d, 'Загрузить пример');
    click(d, 'Нажмите ещё раз');
    expect(document.querySelectorAll('.rows .row').length).toBeGreaterThan(3);
  });

  it('armed button disarms after 3 seconds', () => {
    vi.useFakeTimers();
    wide(true);
    render(<App />);
    const d = open('Параметры сети');
    click(d, 'Начать с нуля');
    expect(btn(d, 'Нажмите ещё раз')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(btn(d, 'Начать с нуля')).toBeTruthy();
  });
});

describe('ProjectsSheet', () => {
  it('edits metadata', () => {
    render(<App />);
    const d = open('Проекты');
    change(d.querySelector('#mName') as HTMLElement, 'Дом');
    change(d.querySelector('#mAddr') as HTMLElement, 'Минск');
    change(d.querySelector('#mClient') as HTMLElement, 'Иванов');
    change(d.querySelector('#mAuthor') as HTMLElement, 'Петров');
    const p = stored().list[0];
    expect([p.name, p.address, p.client, p.author]).toEqual(['Дом', 'Минск', 'Иванов', 'Петров']);
  });

  it('creates projects from templates, blank, own templates; stove toggle', () => {
    vi.useFakeTimers();
    render(<App />);
    const d = open('Проекты');
    click(d, '+ Новый проект');
    fireEvent.click(d.querySelector('input[name="stove"][value="gas"]') as HTMLElement);
    fireEvent.click(d.querySelector('input[name="stove"][value="elec"]') as HTMLElement);
    const tpls = Array.from(d.querySelectorAll<HTMLElement>('.tpl-b'));
    expect(tpls.length).toBeGreaterThan(2);
    fireEvent.click(tpls[0]);
    act(() => { vi.advanceTimersByTime(10); });
    expect(stored().list.length).toBe(2);
    click(d, '+ Новый проект');
    fireEvent.click(tpls[tpls.length - 1]);
    expect(stored().list.length).toBe(3);
    expect(stored().list[2].name).toContain('Проект 3');
    click(d, 'Сохранить как шаблон');
    expect(JSON.parse(localStorage.getItem(LIB_KEY) as string).templates.length).toBe(1);
    click(d, '+ Новый проект');
    const mine = d.querySelectorAll<HTMLElement>('.tpl-grid')[1].querySelector('.tpl-b') as HTMLElement;
    fireEvent.click(mine);
    expect(stored().list.length).toBe(4);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(d.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('opens, duplicates and deletes projects', () => {
    render(<App />);
    let d = open('Проекты');
    click(d, '+ Новый проект');
    fireEvent.click(d.querySelector('.tpl-b') as HTMLElement);
    click(d, 'Копия');
    expect(stored().list.length).toBe(3);
    const opens = d.querySelectorAll<HTMLElement>('.pj-open');
    fireEvent.click(opens[0]);
    expect(isOpen('Проекты')).toBe(false);
    expect(stored().cur).toBe(stored().list[0].id);
    d = open('Проекты');
    const del = d.querySelectorAll<HTMLElement>('.pj .btn.danger')[2];
    fireEvent.click(del);
    fireEvent.click(del);
    expect(stored().list.length).toBe(2);
  });

  it('exports to file', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    (URL as unknown as Record<string, unknown>).createObjectURL = create;
    (URL as unknown as Record<string, unknown>).revokeObjectURL = revoke;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<App />);
    const d = open('Проекты');
    click(d, 'Сохранить в файл');
    expect(create).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(d.querySelector('[role="status"]')?.textContent).toBe('Файл сохранён');
    act(() => { vi.advanceTimersByTime(2100); });
    expect(revoke).toHaveBeenCalled();
  });

  it('reports export failure', () => {
    (URL as unknown as Record<string, unknown>).createObjectURL = () => { throw new Error('no'); };
    render(<App />);
    const d = open('Проекты');
    click(d, 'Сохранить в файл');
    expect(d.querySelector('[role="status"]')?.textContent).toContain('Не удалось сохранить');
  });

  const importFile = async (d: HTMLElement, text: string, type = 'application/json') => {
    const input = d.querySelector('input[type="file"]') as HTMLInputElement;
    const f = new File([text], 'p.json', { type });
    fireEvent.change(input, { target: { files: [f] } });
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
  };

  it('imports projects from a file in all shapes and handles bad input', async () => {
    render(<App />);
    const d = open('Проекты');
    const clickInput = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    click(d, 'Открыть из файла');
    expect(clickInput).toHaveBeenCalled();
    const status = () => d.querySelector('[role="status"]')?.textContent;
    const proj = { name: 'Имп', lines: [], cfg: {} };
    await importFile(d, JSON.stringify(proj));
    expect(status()).toContain('Добавлено проектов: 1');
    await importFile(d, JSON.stringify([proj, proj]));
    expect(status()).toContain('Добавлено проектов: 2');
    await importFile(d, JSON.stringify({ list: [proj] }));
    expect(status()).toContain('Добавлено проектов: 1');
    await importFile(d, '{bad');
    expect(status()).toContain('не похож');
    await importFile(d, JSON.stringify(5));
    expect(status()).toContain('нет проекта');
    fireEvent.change(d.querySelector('input[type="file"]') as HTMLElement, { target: { files: [] } });
    expect(stored().list.length).toBeGreaterThan(3);
  });

  it('reports a file read error', () => {
    class BadReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result = '';
      readAsText() { this.onerror?.(); }
    }
    vi.stubGlobal('FileReader', BadReader);
    render(<App />);
    const d = open('Проекты');
    fireEvent.change(d.querySelector('input[type="file"]') as HTMLElement, { target: { files: [new File(['x'], 'a.json')] } });
    expect(d.querySelector('[role="status"]')?.textContent).toContain('Не удалось прочитать');
    vi.unstubAllGlobals();
  });
});

describe('ReportSheet', () => {
  it('renders groups, spec, schematic; edits prices; copies report', async () => {
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    wide(true);
    render(<App />);
    const d = open('Отчёт и спецификация');
    expect(d.querySelectorAll('tbody tr').length).toBeGreaterThan(5);
    expect(d.querySelector('svg.schem')).toBeTruthy();
    const price = d.querySelector('.price-in') as HTMLInputElement;
    change(price, '12.5');
    expect(JSON.parse(localStorage.getItem(LIB_KEY) as string).prices).toBeTruthy();
    expect(d.textContent).toContain('цена или количество не заданы');
    change(price, '');
    click(d, 'Скопировать отчёт');
    await act(async () => { await Promise.resolve(); });
    expect(write).toHaveBeenCalled();
    expect(d.querySelector('[role="status"]')?.textContent).toBe('Отчёт скопирован');
  });

  it('falls back to a selectable textarea when clipboard fails and clears status', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('x')) }, configurable: true });
    render(<App />);
    const d = open('Отчёт и спецификация');
    click(d, 'Скопировать отчёт');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(d.querySelector('textarea')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4100); });
    expect(d.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('shows empty groups, three-phase columns and unfit rows', () => {
    render(<App />);
    let d = open('Параметры сети');
    click(d, 'Начать с нуля');
    click(d, 'Нажмите ещё раз');
    d = open('Параметры сети');
    fireEvent.click(d.querySelector('input[name="sup"][value="3"]') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    d = open('Отчёт и спецификация');
    expect(d.textContent).toContain('нет приборов');
    expect(d.textContent).toContain('Фаза');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[0]);
    fireEvent.click(btn(document.querySelector('.col-edit') as HTMLElement, '+ Свой прибор'));
    change(byLabel(document.querySelector('.col-edit') as HTMLElement, 'Мощность, Вт'), '90000');
    d = open('Отчёт и спецификация');
    expect(d.textContent).toContain('—');
  });
});
