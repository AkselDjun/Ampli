import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';

vi.setConfig({ testTimeout: 60000 });

const seed = () => {
  const p = sampleProject();
  p.lines = p.lines.map((l, i) => (i === 1 || i === 4 ? { ...l, len: 95 } : l));
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
  return p;
};

const names = () => Array.from(document.querySelectorAll('.rows .row .row-name')).map(x => x.textContent);
const bar = () => screen.getByRole('toolbar', { name: 'Отбор и порядок групп' });

describe('отбор, порядок и выбор групп', () => {
  it('чип статуса показывает только такие группы и снимается повторным нажатием', async () => {
    const p = seed();
    const user = userEvent.setup();
    render(<App />);
    const all = names().length;
    expect(all).toBe(p.lines.length);
    const chip = within(bar()).getByRole('button', { name: /^Советы/ });
    const n = Number(chip.querySelector('b')?.textContent);
    expect(n).toBeGreaterThan(0);
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(names()).toHaveLength(n);
    expect(document.querySelectorAll('.rows .row .st.warn').length).toBeGreaterThanOrEqual(n);
    await user.click(chip);
    expect(names()).toHaveLength(all);
  });

  it('без замечаний чипов нет', () => {
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(within(bar()).queryByRole('group', { name: 'Показать только' })).toBeNull();
  });

  it('порядок по току ставит самую нагруженную группу первой в помещении', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);
    const before = names();
    await user.click(within(bar()).getByRole('button', { name: /^Порядок групп/ }));
    await user.click(screen.getByRole('menuitem', { name: 'По току' }));
    expect(within(bar()).getByRole('button', { name: 'Порядок групп: по току' })).toBeInTheDocument();
    const zone = document.querySelectorAll('.zone-b')[1];
    const cur = Array.from(zone.querySelectorAll('.row-sub span:nth-child(3)')).map(x => parseFloat((x.textContent ?? '').replace(',', '.')));
    expect(cur).toEqual([...cur].sort((a, b) => b - a));
    expect(names()).not.toEqual(before);
    expect([...names()].sort()).toEqual([...before].sort());
  });

  it('в панели списка нет режима выбора нескольких групп', () => {
    seed();
    render(<App />);
    expect(within(bar()).queryByRole('button', { name: 'Выбрать' })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Действия с выбранными группами' })).toBeNull();
  });
});
