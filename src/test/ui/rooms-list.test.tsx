import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { LISTBY_KEY } from '../../ui/prefs';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Line } from '../../core/types';
import { byLabel, change, click, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const heads = () => Array.from(document.querySelectorAll('.rows .zone-h')).map(h => h.querySelector('b')?.textContent);
const toggle = () => screen.getByRole('button', { name: 'По помещениям' });

describe('group list by rooms', () => {
  it('groups rows under rooms with totals and remembers the choice', () => {
    render(<App />);
    expect(heads()).toEqual([]);
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(heads()).toEqual(['Комнаты', 'Кухня', 'Ванная']);
    const first = document.querySelector('.rows .zone-h small')?.textContent;
    expect(first).toMatch(/^3 группы · \d+,\d\s?кВт$/);
    const nos = Array.from(document.querySelectorAll('.rows .row .no')).map(n => n.textContent);
    expect(nos).toEqual(['Г1', 'Г2', 'Г7', 'Г3', 'Г4', 'Г5', 'Г6']);
    expect(localStorage.getItem(LISTBY_KEY)).toBe('room');
    fireEvent.click(toggle());
    expect(heads()).toEqual([]);
    expect(localStorage.getItem(LISTBY_KEY)).toBe('no');
  });

  it('puts groups without a room last and edits the room outside RCD mode', () => {
    wide(true);
    const ls: Line[] = [mkLine('Свет', 'light', 5, 1, 1, [['Лампа', 100, 1]]), { ...mkLine('Чайник', 'socket', 5, 1, 1, [['Чайник', 2000, 1]]), zone: 'Кухня' }];
    const p = newProject({ cfg: defaultCfg(), lines: ls, sample: false }, 'Т');
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
  });

  it('hides the switch for a single group', () => {
    const p = newProject({ cfg: defaultCfg(), lines: [mkLine('Свет', 'light', 5, 1, 1, [['Лампа', 100, 1]])], sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(screen.queryByRole('button', { name: 'По помещениям' })).toBeNull();
  });

  it('works when storage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(k => { if (k === LISTBY_KEY) throw new Error('x'); return null; });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(k => { if (k === LISTBY_KEY) throw new Error('x'); });
    render(<App />);
    fireEvent.click(toggle());
    expect(heads().length).toBeGreaterThan(0);
    get.mockRestore();
    set.mockRestore();
  });
});
