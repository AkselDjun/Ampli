import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { stored } from '../stored';

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

  it('выбранные группы переносятся в помещение, копируются и удаляются', async () => {
    const p = seed();
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(bar()).getByRole('button', { name: 'Выбрать' }));
    const bulk = () => screen.getByRole('toolbar', { name: 'Действия с выбранными группами' });
    expect(bulk()).toHaveTextContent('Выбрано: 0');
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
    await user.click(rows()[0]);
    await user.click(rows()[1]);
    expect(rows()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(bulk()).toHaveTextContent('Выбрано: 2');
    const picked = [rows()[0], rows()[1]].map(r => r.querySelector('.row-name')?.textContent);

    await user.click(within(bulk()).getByRole('button', { name: 'Перенести в помещение' }));
    await user.click(screen.getByRole('menuitem', { name: 'Кухня' }));
    expect(screen.queryByRole('toolbar', { name: 'Действия с выбранными группами' })).toBeNull();
    const lines = stored().list[0].lines;
    for (const nm of picked) expect(lines.find((l: { name: string }) => l.name === nm)?.zone).toBe('Кухня');

    await user.click(within(bar()).getByRole('button', { name: 'Выбрать' }));
    await user.click(rows()[0]);
    await user.click(within(bulk()).getByRole('button', { name: 'Копировать выбранные' }));
    expect(rows()).toHaveLength(p.lines.length + 1);

    await user.click(within(bar()).getByRole('button', { name: 'Выбрать' }));
    await user.click(rows()[0]);
    await user.click(rows()[1]);
    const del = within(bulk()).getByRole('button', { name: 'Удалить' });
    await user.click(del);
    expect(del).toHaveTextContent('Удалить 2?');
    await user.click(del);
    expect(rows()).toHaveLength(p.lines.length - 1);
  });

  it('Escape и «Готово» выходят из выбора, не меняя проект', async () => {
    const p = seed();
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(bar()).getByRole('button', { name: 'Выбрать' }));
    const first = document.querySelector<HTMLElement>('.rows .row') as HTMLElement;
    await user.click(first);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('toolbar', { name: 'Действия с выбранными группами' })).toBeNull();
    expect(first).not.toHaveAttribute('aria-pressed');
    await user.click(within(bar()).getByRole('button', { name: 'Выбрать' }));
    await user.click(within(screen.getByRole('toolbar', { name: 'Действия с выбранными группами' })).getByRole('button', { name: 'Готово' }));
    expect(screen.queryByRole('toolbar', { name: 'Действия с выбранными группами' })).toBeNull();
    expect(stored().list[0].lines).toHaveLength(p.lines.length);
  });
});
