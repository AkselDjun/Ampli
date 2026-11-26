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
