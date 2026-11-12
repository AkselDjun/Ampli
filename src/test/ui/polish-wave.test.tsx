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
    expect(stored().list[0].lines.every(l => l.apps.every(a => !Number(a.w)))).toBe(true);
    expect(toastText()).toContain('Проект очищен');
    act(() => currentToast()?.run?.());
    expect(stored().list[0].lines.map(l => l.name)).toEqual(['Свет', 'Розетки']);
    expect(stored().list[0].name).toBe('Квартира Иванова');
    d = openProjects();
    click(d, 'Загрузить пример');
    click(d, 'Нажмите ещё раз');
    expect(toastText()).toContain('Загружен пример');
    act(() => currentToast()?.run?.());
    expect(stored().list[0].lines.map(l => l.name)).toEqual(['Свет', 'Розетки']);
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
