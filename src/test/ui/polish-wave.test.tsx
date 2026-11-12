import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Line } from '../../core/types';
import { currentToast } from '../../ui/toast';
import { click, dlg, toastText } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const boot = (ls: Line[], name = 'Тест') => {
  const p = newProject({ cfg: defaultCfg(), lines: ls, sample: false }, name);
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
};

const openProjects = () => {
  fireEvent.click(screen.getAllByRole('button', { name: /Проекты/ })[0]);
  return dlg('Проекты');
};

afterEach(() => {
  vi.useRealTimers();
});

describe('projects window', () => {
  it('shows the list of projects before the details of the current one', () => {
    boot([mkLine('Свет', 'light', 10, [['Люстра', 100, 1]])]);
    render(<App />);
    const d = openProjects();
    const all = d.querySelector('.pj-list') as HTMLElement;
    const meta = d.querySelector('.meta-grid') as HTMLElement;
    expect(all.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('can undo starting from scratch and loading the sample', () => {
    boot([mkLine('Свет', 'light', 10, [['Люстра', 100, 1]]), mkLine('Розетки', 'socket', 10, [['Чайник', 2000, 1]])], 'Квартира Иванова');
    render(<App />);
    let d = openProjects();
    click(d, 'Начать с нуля');
    click(d, 'Нажмите ещё раз');
    expect(stored().list[0].lines.every((l: Line) => l.apps.every(ap => !Number(ap.w)))).toBe(true);
    expect(toastText()).toContain('Проект очищен');
    act(() => currentToast()?.run?.());
    expect(stored().list[0].lines.map((l: Line) => l.name)).toEqual(['Свет', 'Розетки']);
    expect(stored().list[0].name).toBe('Квартира Иванова');
    d = openProjects();
    click(d, 'Загрузить пример');
    click(d, 'Нажмите ещё раз');
    expect(toastText()).toContain('Загружен пример');
    act(() => currentToast()?.run?.());
    expect(stored().list[0].lines.map((l: Line) => l.name)).toEqual(['Свет', 'Розетки']);
  });
});

describe('empty project', () => {
  it('does not offer to print an empty report or size an empty board', () => {
    boot([]);
    render(<App />);
    expect(document.body.textContent).not.toContain('Приборов на 0 мод.');
    expect(document.body.textContent).toContain('Щиток соберётся');
    fireEvent.click(screen.getAllByRole('button', { name: /^Отчёт/ })[0]);
    const d = dlg('Отчёт и спецификация');
    expect(d.querySelector('.rep-empty')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Печать / PDF' })).toBeDisabled();
  });
});

describe('comparison of variants', () => {
  it('summarizes what changes on top and mutes unchanged rows', () => {
    boot([mkLine('Свет', 'light', 10, [['Люстра', 100, 1]]), mkLine('Плита', 'power', 5, [['Электроплита', 7000, 1]])]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Итого по квартире/ }));
    click(document.querySelector('.tot-pop') as HTMLElement, 'Сравнить варианты');
    const d = dlg('Сравнение вариантов');
    const sum = d.querySelector('.cmp-sum') as HTMLElement;
    expect(sum.textContent).toContain('Отметьте ниже');
    fireEvent.click(screen.getByRole('checkbox', { name: /Г2 Плита/ }));
    expect(sum.textContent).toContain('→');
    expect(sum.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(d.querySelectorAll('tr.cmp-same').length).toBeGreaterThan(0);
    expect(sum.compareDocumentPosition(d.querySelector('.ck') as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('words and captions', () => {
  it('calls power groups «Силовая» and uses one word per status', async () => {
    const { TYPES, STATUS } = await import('../../core/norms');
    expect(TYPES.power.label).toBe('Силовая');
    expect(STATUS).toEqual({ ok: 'Норма', warn: 'Совет', bad: 'Нарушение' });
  });

  it('shows the measurement legend above the board', () => {
    boot([mkLine('Свет', 'light', 10, [['Люстра', 100, 1]])]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Замеры на щитке' }));
    const d = dlg('Приёмка');
    const legend = d.querySelector('.pmb-top') as HTMLElement;
    const board = d.querySelector('.pmb-box') as HTMLElement;
    expect(legend.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names an unsized input breaker instead of a dash when there is a load', async () => {
    const { calcAll } = await import('../../core/calc');
    const { inOf } = await import('../../core/protection');
    const heavy = calcAll(Array.from({ length: 6 }, (_, i) => mkLine('П' + i, 'power', 5, [['Плита', 9000, 1]])), { ...defaultCfg(), ko: 1 });
    expect(heavy.inIn).toBeNull();
    expect(inOf(heavy)).toBe('не подобран, см. замечания');
    expect(inOf(calcAll([], defaultCfg()))).toBe('—');
  });
});
