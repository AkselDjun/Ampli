import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { LISTBY_KEY } from '../../ui/prefs';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Line } from '../../core/types';
import { byLabel, change, click, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const heads = () => Array.from(document.querySelectorAll('.rows .zone-h')).map(h => h.querySelector('b')?.textContent);
const toggle = () => screen.getByRole('button', { name: 'По помещениям' });

describe('group list by rooms', () => {
  it('groups rows under rooms by default with totals and remembers the choice', () => {
    localStorage.removeItem(LISTBY_KEY);
    render(<App />);
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(heads()).toEqual(['Комнаты', 'Кухня', 'Ванная']);
    const first = document.querySelector('.rows .zone-h small')?.textContent;
    expect(first).toMatch(/^4 группы · \d+,\d\s?кВт$/);
    const nos = Array.from(document.querySelectorAll('.rows .row .no')).map(n => n.textContent);
    expect(nos).toEqual(['Г1', 'Г3', 'Г4', 'Г14', 'Г2', 'Г5', 'Г6', 'Г7', 'Г8', 'Г9', 'Г10', 'Г11', 'Г12', 'Г13']);
    fireEvent.click(toggle());
    expect(heads()).toEqual([]);
    expect(localStorage.getItem(LISTBY_KEY)).toBe('no');
    fireEvent.click(toggle());
    expect(localStorage.getItem(LISTBY_KEY)).toBe('room');
    expect(heads()).toEqual(['Комнаты', 'Кухня', 'Ванная']);
  });

  it('puts groups without a room last and edits the room outside RCD mode', () => {
    wide(true);
    const ls: Line[] = [mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), { ...mkLine('Чайник', 'socket', 5, [['Чайник', 2000, 1]]), zone: 'Кухня' }];
    const p = newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    localStorage.setItem(LISTBY_KEY, 'room');
    render(<App />);
    expect(heads()).toEqual(['Кухня', 'Без помещения']);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[1]);
    click(ed, /Дополнительно/);
    change(byLabel(ed, 'Помещение группы'), 'Гостиная');
    expect(stored().list[0].lines[0].zone).toBe('Гостиная');
    expect(heads()).toEqual(['Гостиная', 'Кухня']);
    expect(ed.querySelector('.fold-in .muted')?.textContent).toContain('Гостиная');
    expect(ed.textContent).toContain('Подпись группы на щитке, бирках и в паспорте.');
    expect(ed.textContent).not.toContain('Где находится');
  });

  it('hides the switch for a single group', () => {
    const p = newProject({ cfg: defaultCfg(), lines: [mkLine('Свет', 'light', 5, [['Лампа', 100, 1]])], sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(screen.queryByRole('button', { name: 'По помещениям' })).toBeNull();
  });

  it('works when storage throws', () => {
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(k => { if (k === LISTBY_KEY) throw new Error('x'); return null; });
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(k => { if (k === LISTBY_KEY) throw new Error('x'); });
    render(<App />);
    expect(heads().length).toBeGreaterThan(0);
    fireEvent.click(toggle());
    expect(heads()).toEqual([]);
    get.mockRestore();
    set.mockRestore();
  });

  it('folds a room like an accordion and opens it again when its group is selected', () => {
    wide(true);
    const ls: Line[] = [
      { ...mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), zone: 'Комнаты' },
      { ...mkLine('Перегруз', 'power', 10, [['Первый', 10000, 1], ['Второй', 10000, 1]]), zone: 'Кухня' },
      { ...mkLine('Чайник', 'socket', 5, [['Чайник', 2000, 1]]), zone: 'Кухня' }
    ];
    const p = newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    localStorage.setItem(LISTBY_KEY, 'room');
    render(<App />);
    const head = screen.getByRole('button', { name: /^Кухня/ });
    expect(head).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(head.getAttribute('aria-controls') as string) as HTMLElement;
    expect(body.querySelectorAll('.row').length).toBe(2);
    expect(head.querySelector('.flag.bad')).not.toBeNull();
    expect(head.querySelector('.zone-brk')).toBeNull();
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(body.hidden).toBe(true);
    expect(Array.from(head.querySelectorAll('.zone-brk i')).map(i => i.textContent)).toEqual(['C16']);
    expect(head.querySelector('.zone-brk i.rcd')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Комнаты/ }));
    expect(screen.getByRole('button', { name: /^Комнаты/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /^Проверки по нормам/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть группу Г2' }));
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Комнаты/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
  });
});
