import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { App } from '../../ui/App';
import { DrawingA3, drawCode, wrap } from '../../ui/DrawingA3';
import { PrintDoc } from '../../ui/PrintDoc';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Cfg, Line, Project } from '../../core/types';

vi.setConfig({ testTimeout: 60000 });

const zl = (l: Line, zone: string, o: Partial<Line> = {}): Line => ({ ...l, zone, ...o });
const lines = (): Line[] => [
  zl(mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]), 'Комнаты'),
  zl(mkLine('Розетки', 'socket', 10, [['ТВ', 1500, 1]]), 'Комнаты'),
  zl(mkLine('Стиралка', 'power', 8, [['Стиральная машина', 2200, 1]]), 'Ванная', { wet: true }),
  zl(mkLine('', 'socket', 5, [['Чайник', 2000, 1]]), 'Кухня')
];
const proj = (ls: Line[], cfg: Partial<Cfg> = {}, o: Partial<Project> = {}): Project => ({ ...newProject({ cfg: { ...defaultCfg(), ...cfg }, lines: ls, sample: false }, 'Тест'), lines: ls, ...o });
const texts = () => Array.from(document.querySelectorAll('svg.a3 text')).map(e => e.textContent);

describe('A3 drawing helpers', () => {
  it('builds the drawing code from the date', () => {
    expect(drawCode(new Date(2026, 0, 5).getTime())).toBe('ЭМ-20260105');
  });

  it('wraps words and cuts with an ellipsis', () => {
    expect(wrap('Розетки кухня рабочая зона', 12, 3)).toEqual(['Розетки', 'кухня', 'рабочая зона']);
    expect(wrap('Розетки кухня рабочая зона', 12, 2)).toEqual(['Розетки', 'кухня…']);
    expect(wrap('Сверхдлинноеслово', 5, 2)).toEqual(['Сверхдлинноеслово']);
    expect(wrap('   ', 5)).toEqual([]);
  });
});

describe('A3 drawing', () => {
  it('draws breakers, table and title block in rcbo mode', () => {
    const p = proj(lines(), { prot: 'rcbo' }, { author: 'Иванов И.И.', address: 'ул. Ленина, 1-15' });
    render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="ЭлектроМонтаж" />);
    const t = texts();
    expect(t).toContain('QFD1');
    expect(t).toContain('Дифф. ток, мА');
    expect(t).toContain('ул. Ленина, 1-15');
    expect(t).toContain('Иванов И.И.');
    expect(t).toContain('ЭлектроМонтаж');
    expect(t).toContain('Без названия');
    expect(t).not.toContain('Фаза');
    expect(t.some(x => /^ЭМ-\d{8}$/.test(x ?? ''))).toBe(true);
    expect(document.querySelectorAll('svg.a3 ellipse').length).toBeGreaterThan(0);
  });

  it('draws RCD zones with sub-buses', () => {
    const p = proj(lines(), { prot: 'rcd' });
    const a = calcAll(p.lines, p.cfg);
    render(<DrawingA3 p={p} a={a} company="" />);
    const t = texts();
    expect(t).toContain('QD1');
    expect(t).toContain('QF1');
    expect(t.some(x => /^QD1 \/ \d+$/.test(x ?? ''))).toBe(true);
    expect(t.join(' ')).toContain('у каждого УЗО своя шина N');
  });

  it('shows phases for three-phase supply and falls back to the project name', () => {
    const p = proj(lines(), { supply: 3, prot: 'none' } as Partial<Cfg>, { address: '' });
    render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    const t = texts();
    expect(t).toContain('Фаза');
    expect(t).toContain('Тест');
    expect(t.join(' ')).toContain('400/230');
  });

  it('renders an empty project without groups', () => {
    const p = proj([], {}, { name: '', address: '' });
    render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    expect(texts()).toContain('Квартира');
  });

  it('is printed as a separate A3 page', () => {
    const p = proj(lines());
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="a3" />);
    expect(document.querySelector('.printdoc.a3doc svg.a3')).not.toBeNull();
  });

  it('prints from the scheme tab of the report', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Отчёт/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Схема' }));
    expect(screen.getByText('Лист А3 со штампом')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Печать А3 по ГОСТ' }));
    expect(document.querySelector('.printdoc.a3doc')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('adds the plug-free connection note for water heaters', () => {
    const p = proj([...lines(), mkLine('Бойлер', 'power', 9, [['Водонагреватель', 2000, 1]])]);
    render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    expect(texts().join(' ')).toContain('5. Водонагреватели и приборы отопления (Г5) подключить отдельными линиями');
  });

  it('has no heater note without heaters', () => {
    const p = proj(lines());
    render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    expect(texts().join(' ')).not.toContain('Водонагреватели');
  });
});

