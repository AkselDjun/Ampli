import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChecksBox, HomeSum, SumBox, issuesOf } from '../../ui/Overview';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';

const calc = (w: number, alloc = 15) => calcAll([mkLine('Плита', 'power', 5, [['x', w, 1]]), mkLine('Розетки', 'socket', 90, [['Обогреватель', 3000, 1]])], { ...defaultCfg(), alloc });

describe('overview boxes', () => {
  it('sums up the project and opens the network settings from the allocation meter', () => {
    const onNet = vi.fn();
    render(<SumBox a={calc(3500)} onNet={onNet} />);
    expect(screen.getByRole('heading', { name: 'Итоги' })).toBeInTheDocument();
    expect(document.querySelector('.kvs')?.textContent).toContain('Вводной автомат');
    fireEvent.click(screen.getByRole('button', { name: /Изменить выделенную мощность/ }));
    expect(onNet).toHaveBeenCalledTimes(1);
  });

  it('lists violations before tips and opens the group of an issue', () => {
    const a = calc(3500);
    const list = issuesOf(a);
    expect(list.length).toBeGreaterThan(0);
    expect(list.findIndex(x => x.k === 'warn')).toBeGreaterThanOrEqual(list.filter(x => x.k === 'bad').length);
    const onGroup = vi.fn();
    render(<ChecksBox a={a} onGroup={onGroup} onFix={vi.fn()} />);
    const t = document.querySelector('button.iss-t') as HTMLElement;
    expect(t.textContent).toMatch(/^Группа 0\d · /);
    fireEvent.click(t);
    expect(onGroup).toHaveBeenCalled();
  });

  it('says when there is nothing to fix', () => {
    render(<ChecksBox a={calcAll([], defaultCfg())} onGroup={vi.fn()} onFix={vi.fn()} />);
    expect(screen.getByText('Нарушений и советов нет.')).toBeInTheDocument();
  });

  it('steps through issues on the phone summary', () => {
    const a = calc(3500);
    const n = issuesOf(a).length;
    render(<HomeSum a={a} onNet={vi.fn()} onGroup={vi.fn()} onFix={vi.fn()} />);
    expect(document.querySelector('.hs-ik')?.textContent).toContain('1 из ' + n);
    if (n > 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Следующее замечание' }));
      expect(document.querySelector('.hs-ik')?.textContent).toContain('2 из ' + n);
    }
  });
});

describe('selected device on the panel tab', () => {
  it('asks to pick a device until a group is selected', async () => {
    const { PanelSel } = await import('../../ui/Side');
    const a = calc(3500);
    render(<PanelSel a={a} sel={null} onOpen={vi.fn()} />);
    expect(document.querySelector('.pp-hint')?.textContent).toMatch(/^Выберите аппарат на рейке/);
  });

  it('shows the breaker, cable, load and phase of the selected group and opens it', async () => {
    const { PanelSel } = await import('../../ui/Side');
    const ls = [mkLine('Плита', 'power', 5, [['x', 7000, 1]]), mkLine('', 'socket', 10, [['Чайник', 2000, 1]])];
    ls[0].phase = 'L2';
    const a = calcAll(ls, { ...defaultCfg(), supply: 3, alloc: 15 });
    const onOpen = vi.fn();
    const { unmount } = render(<PanelSel a={a} sel={ls[0].id} onOpen={onOpen} />);
    const box = document.querySelector('.pp-dev') as HTMLElement;
    expect(box.querySelector('.no')?.textContent).toBe('01');
    expect(box.querySelector('h2')?.textContent).toBe('Плита');
    const kv = Array.from(box.querySelectorAll('.kv dt')).map(d => d.textContent);
    expect(kv).toEqual(expect.arrayContaining(['Автомат', 'Кабель', 'Ток', 'Загрузка', 'Фаза']));
    expect(box.querySelector('.kv dd.warn')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть группу' }));
    expect(onOpen).toHaveBeenCalledWith(ls[0].id);
    unmount();
    render(<PanelSel a={a} sel={ls[1].id} onOpen={onOpen} />);
    expect(document.querySelector('.pp-dev h2')?.textContent).toBe('Без названия');
    expect(document.querySelector('.pp-dev .kv dd.warn')).toBeNull();
  });
});
