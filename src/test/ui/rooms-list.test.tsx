import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Line } from '../../core/types';
import { byLabel, change, click, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const heads = () => Array.from(document.querySelectorAll('.rows .zone-h')).map(h => h.querySelector('b')?.textContent);

describe('group list by rooms', () => {
  it('always groups rows under rooms with totals and has no switch', () => {
    render(<App />);
    expect(heads()).toEqual(['Комнаты', 'Кухня', 'Ванная']);
    expect(document.querySelector('.rows .zone-h .cnt')?.textContent).toBe('4 группы');
    expect(document.querySelector('.rows .zone-h .zone-m')?.textContent).toMatch(/^УЗО \d+\s?А · 30\s?мА · тип A$/);
    expect(document.querySelector('.rows .zone-h .zone-kw')?.textContent).toMatch(/^\d+,\d\s?кВт$/);
    const nos = Array.from(document.querySelectorAll('.rows .row .no')).map(n => /\d\d/.exec(n.textContent ?? '')?.[0]);
    expect(nos).toEqual(['01', '03', '04', '14', '02', '05', '06', '07', '08', '09', '10', '11', '12', '13']);
    expect(screen.queryByRole('button', { name: 'По помещениям' })).toBeNull();
  });

  it('puts groups without a room last and edits the room outside RCD mode', () => {
    wide(true);
    const ls: Line[] = [mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), { ...mkLine('Чайник', 'socket', 5, [['Чайник', 2000, 1]]), zone: 'Кухня' }];
    const p = newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
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

  it('keeps a flat list until groups are in different rooms', () => {
    const ls: Line[] = [mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), mkLine('Чайник', 'socket', 5, [['Чайник', 2000, 1]])];
    const p = newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(heads()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Номера по порядку' })).toBeNull();
  });

  it('joins rooms written in different case under one heading', () => {
    const ls: Line[] = [
      { ...mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), zone: 'Кухня' },
      { ...mkLine('Ванна', 'socket', 5, [['Фен', 1800, 1]]), zone: 'Ванная' },
      { ...mkLine('Чайник', 'socket', 5, [['Чайник', 2000, 1]]), zone: ' кухня ' }
    ];
    const p = newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(heads()).toEqual(['Кухня', 'Ванная']);
    expect(document.querySelector('.rows .zone-h .cnt')?.textContent).toMatch(/^2 группы/);
  });

  it('folds a room like an accordion and opens it again when its group is selected', async () => {
    wide(true);
    const ls: Line[] = [
      { ...mkLine('Свет', 'light', 5, [['Лампа', 100, 1]]), zone: 'Комнаты' },
      { ...mkLine('Перегруз', 'power', 10, [['Первый', 10000, 1], ['Второй', 10000, 1]]), zone: 'Кухня' },
      { ...mkLine('Чайник', 'socket', 5, [['Чайник', 2000, 1]]), zone: 'Кухня' }
    ];
    const p = newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Т');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    const zh = (t: string) => Array.from(document.querySelectorAll<HTMLElement>('.zone-h button')).find(b => b.querySelector('b')?.textContent === t) as HTMLElement;
    const head = zh('Кухня');
    expect(head).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(head.getAttribute('aria-controls') as string) as HTMLElement;
    expect(body.querySelectorAll('.row').length).toBe(2);
    expect(head.textContent).toContain('Нарушение');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(body.hidden).toBe(true);
    fireEvent.click(zh('Комнаты'));
    expect(zh('Комнаты')).toHaveAttribute('aria-expanded', 'false');
    await screen.findByRole('heading', { name: 'Проверки' });
    fireEvent.click(Array.from(document.querySelectorAll<HTMLElement>('.ov-chk button.iss-t')).find(b => b.textContent === 'Группа 02 · Перегруз') as HTMLElement);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(zh('Комнаты')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
  });
});
