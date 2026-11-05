import type { JSX } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { App } from '../../ui/App';
import { PrintDoc } from '../../ui/PrintDoc';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import { normLib } from '../../store/lib';
import { LibContext } from '../../store/LibContext';
import type { Cfg, Line, Project } from '../../core/types';

vi.setConfig({ testTimeout: 60000 });

const lines = (): Line[] => [
  mkLine('Свет', 'light', 10, null, null, [['Люстра', 200, 2]]),
  mkLine('Розетки', 'socket', 12, null, null, [['ТВ', 1500, 1]])
];
const proj = (cfg: Partial<Cfg> = {}, o: Partial<Project> = {}): Project => ({ ...newProject({ cfg: { ...defaultCfg(), ...cfg }, lines: lines(), sample: false }, 'Тест'), ...o });
const doc = () => (document.querySelector('.printdoc.act') as HTMLElement).textContent ?? '';
const withLib = (o: unknown, el: JSX.Element) => <LibContext.Provider value={{ lib: normLib(o), dispatch: () => undefined }}>{el}</LibContext.Provider>;
const stored = () => JSON.parse(localStorage.getItem(KEY) as string);

describe('hidden works act', () => {
  it('lists cables, materials, dates and the next works', () => {
    const p = proj({}, { client: 'Сидоров С.С.', author: 'Петров П.П.', address: 'ул. Мира, 5-12', acts: { start: '2026-10-01', end: '2026-10-09', warranty: 12 } });
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="hidden" />);
    const t = doc();
    expect(t).toContain('Акт освидетельствования скрытых работ');
    expect(t).toContain('ул. Мира, 5-12');
    expect(t).toContain('09.10.2026');
    expect(t).toContain('начала работ 01.10.2026');
    expect(t).toMatch(/прокладка кабеля ВВГнг\(А\)-LS 3×1,5 в штробах/);
    expect(t).toMatch(/кабель ВВГнг\(А\)-LS 3×2,5, \d+ м/);
    expect(t).toContain('заделке штроб');
    expect(t).toContain('Сидоров С.С.');
    expect(t).toContain('Петров П.П.');
    expect(t).toContain('СН 1.03.04-2020');
  });

  it('uses blanks without data and mentions open wiring', () => {
    const p = proj({ method: 'open' }, { name: '', lines: [] });
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="hidden" />);
    const t = doc();
    expect(t).toContain('групповые линии не заданы');
    expect(t).toContain('«___» ________ 20__ г.');
    expect(t).toContain('кабель-каналов');
  });

  it('takes the executor from my data', () => {
    const p = proj();
    render(withLib({ brand: { company: 'ООО Ток', contacts: '', signer: 'Иванов И.И.' } }, <PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="hidden" />));
    expect(doc()).toContain('ООО Ток, Иванов И.И.');
  });
});

describe('acceptance act', () => {
  it('lists works without prices and the warranty', () => {
    const p = proj({}, { client: 'Сидоров С.С.', acts: { start: '', end: '2026-10-09', warranty: 24 } });
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="accept" />);
    const t = doc();
    expect(t).toContain('Акт сдачи-приёмки выполненных работ');
    expect(t).toContain('Установка розетки');
    expect(t).toContain('24 месяца');
    expect(t).toContain('… – 09.10.2026');
    expect(t).not.toContain('BYN');
  });

  it('sums works and materials with prices', () => {
    const p = proj({}, { address: 'ул. Мира, 5-12', acts: { start: '2026-10-01', end: '', warranty: 0 } });
    render(withLib({ prices: { 'Шина PE (заземления)': 10 }, labor: { socket: 12 }, brand: { company: 'ООО Ток', contacts: '', signer: 'Иванов И.И.' } }, <PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="accept" />));
    const t = doc();
    expect(t).toContain('в лице Иванов И.И.');
    expect(t).toContain('по адресу: ул. Мира, 5-12');
    expect(t).toContain('Материалы по спецификации');
    expect(t).toMatch(/на сумму 22,00 BYN/);
    expect(t).not.toContain('Гарантийный срок');
  });

  it('prices works only', () => {
    const p = proj();
    render(withLib({ labor: { socket: 12 } }, <PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="accept" />));
    const t = doc();
    expect(t).toMatch(/на сумму 12,00 BYN/);
    expect(t).not.toContain('Материалы по спецификации');
  });
});

describe('acts in the documents tab', () => {
  it('stores dates and warranty and prints both acts', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Приёмка/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Документы' }));
    expect(screen.getByText('Сроки и гарантия для актов: гарантия 12 месяцев')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Начало работ'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Окончание работ'), { target: { value: '2026-10-09' } });
    fireEvent.change(screen.getByLabelText('Гарантия, мес.'), { target: { value: '' } });
    expect(stored().list[0].acts).toEqual({ start: '2026-10-01', end: '2026-10-09', warranty: 0 });
    expect(screen.getByText('Сроки и гарантия для актов: 01.10.2026 – 09.10.2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Акт скрытых работ' }));
    expect(doc()).toContain('Акт освидетельствования');
    fireEvent.click(screen.getByRole('button', { name: 'Акт приёмки' }));
    expect(doc()).toContain('Акт сдачи-приёмки');
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
