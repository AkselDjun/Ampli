import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { calcAll } from '../../core/calc';
import { snapshot } from '../../core/sent';
import type { Project } from '../../core/types';
import { stored } from '../stored';
import { wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const seed = (f: (p: Project) => Project = p => p) => {
  const p = f({ ...sampleProject(), sample: false, name: 'Квартира' });
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
  return p;
};

const bar = () => screen.getByRole('group', { name: 'Этап проекта' });
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
const filters = () => screen.getByRole('toolbar', { name: 'Отбор и порядок групп' });

describe('этап проекта', () => {
  it('показывает следующий шаг и при отправке сметы запоминает её', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);
    expect(bar()).toHaveTextContent('Уберите нарушения и отправьте смету заказчику');
    expect(within(bar()).getByRole('button', { name: 'Открыть смету' })).toBeInTheDocument();
    await user.click(within(bar()).getByRole('button', { name: 'Этап: Расчёт. Сменить этап' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map(x => x.querySelector('.dd-l')?.textContent)).toEqual(['Расчёт', 'Смета отправлена', 'Монтаж', 'Приёмка', 'Сдан']);
    expect(items[0]).toHaveAttribute('aria-current', 'true');
    await user.click(items[1]);
    const p = stored().list[0];
    expect(p.stage).toBe(1);
    expect(p.sent.lines).toHaveLength(p.lines.length);
    expect(within(bar()).getByRole('button', { name: 'Лист сборки' })).toBeInTheDocument();
  });

  it('у примера этапа нет', () => {
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(screen.queryByRole('group', { name: 'Этап проекта' })).toBeNull();
  });

  it('группы, изменённые после отправки, видны в списке и в карточке', async () => {
    wide(true);
    seed(p => {
      const sent = snapshot(calcAll(p.lines, p.cfg).rows, Date.now());
      sent.lines[2] = { ...sent.lines[2], len: sent.lines[2].len + 7 };
      return { ...p, stage: 2, sent };
    });
    const user = userEvent.setup();
    render(<App />);
    const name = stored().list[0].lines[2].name;
    const chip = within(filters()).getByRole('button', { name: /^Изменено/ });
    expect(chip.querySelector('b')).toHaveTextContent('1');
    expect(rows().filter(r => r.querySelector('.row-mk.chg')).map(r => r.querySelector('.row-name')?.textContent)).toEqual([name]);
    await user.click(chip);
    expect(rows()).toHaveLength(1);
    await user.click(rows()[0]);
    expect(screen.getByRole('note')).toHaveTextContent(/Изменено после отправки сметы.*Длина/);
    wide(false);
  });
});

describe('заметки к группе', () => {
  it('добавляются в карточке, видны в списке и отмечаются', async () => {
    wide(true);
    seed();
    const user = userEvent.setup();
    render(<App />);
    await user.click(rows()[0]);
    const ed = screen.getByRole('region', { name: 'Редактор группы' });
    await user.click(within(ed).getByRole('button', { name: /^Заметки/ }));
    await user.type(within(ed).getByRole('textbox', { name: 'Новая заметка' }), 'Перенести розетку к окну{Enter}');
    expect(within(ed).getByRole('checkbox', { name: 'Перенести розетку к окну' })).not.toBeChecked();
    expect(stored().list[0].lines[0].notes[0].t).toBe('Перенести розетку к окну');
    expect(rows()[0].querySelector('.row-mk.note')).toHaveTextContent('1');
    expect(within(filters()).getByRole('button', { name: /^Заметки/ })).toBeInTheDocument();
    await user.click(within(ed).getByRole('checkbox', { name: 'Перенести розетку к окну' }));
    expect(rows()[0].querySelector('.row-mk.note')).toBeNull();
    await user.click(within(ed).getByRole('button', { name: /^Удалить заметку/ }));
    expect(stored().list[0].lines[0].notes).toBeUndefined();
    wide(false);
  });
});
