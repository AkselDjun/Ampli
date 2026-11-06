import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../../ui/App';
import { PrintDoc } from '../../ui/PrintDoc';
import { calcAll } from '../../core/calc';
import { sampleProject } from '../../core/project';
import { OLD_EMPTY } from '../../core/oldwire';
import { click, dlg } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const pick = (name: string, value: string) => fireEvent.click(document.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement);

describe('old wiring survey', () => {
  it('opens from the network sheet, gives a verdict and shows it in the project box', () => {
    vi.useFakeTimers();
    render(<App />);
    click(document.querySelector('.col-list') as HTMLElement, 'Параметры сети');
    const net = dlg('Параметры сети');
    expect(net.querySelector('.net-old')?.textContent).toContain('что оставить и что заменить');
    fireEvent.click(net.querySelector('.net-old') as HTMLElement);
    const d = dlg('Старая проводка');
    expect(d.textContent).toContain('Не обследована');
    expect(screen.queryByRole('button', { name: 'Печать заключения' })).toBeNull();
    pick('ow-metal', 'al');
    pick('ow-sec', '2.5');
    pick('ow-pe', 'no');
    fireEvent.change(screen.getByLabelText('Наименьшая изоляция, МОм'), { target: { value: '0.9' } });
    fireEvent.change(screen.getByLabelText('Возраст проводки, лет'), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('Изоляция крошится или трескается'));
    expect(stored().list[0].old).toEqual({ ...OLD_EMPTY, metal: 'al', sec: 2.5, pe: 'no', ins: '0.9', age: '12', signs: ['crumble'] });
    expect(d.querySelector('.ow-head .pill')?.textContent).toBe('Заменить');
    expect(d.querySelector('.ow-head .muted')?.textContent).toMatch(/^\d+ замечани[ея]?, \d+ услови[ея]$/);
    expect(d.querySelectorAll('.ow-gr .bad').length).toBeGreaterThan(0);
    expect(d.querySelector('.ow-pr')?.textContent).toBe('практика');
    fireEvent.click(screen.getByLabelText('Изоляция крошится или трескается'));
    expect(stored().list[0].old.signs).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Печать заключения' }));
    expect(document.querySelector('.printdoc.act h1')?.textContent).toBe('Заключение по состоянию электропроводки');
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    const row = screen.getByRole('button', { name: /^Старая проводка ?: Заменить$/ });
    fireEvent.click(row);
    const d2 = dlg('Старая проводка');
    fireEvent.click(screen.getByRole('button', { name: 'Очистить ответы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Нажмите ещё раз' }));
    expect(stored().list[0].old).toBeUndefined();
    expect(d2.textContent).toContain('Не обследована');
    vi.useRealTimers();
  });

  it('opens from the command palette', () => {
    render(<App />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const box = document.querySelector('dialog.pal input') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'алюминий' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(dlg('Старая проводка')).toBeTruthy();
  });

  it('prints the conclusion with answers and groups', () => {
    const p = { ...sampleProject(), old: { ...OLD_EMPTY, metal: 'cu' as const, sec: 1.5, pe: 'yes' as const, net: 'tncs' as const, panel: 'old' as const, age: '35', signs: ['heat' as const] } };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="old" />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).toContain('медь');
    expect(t).toContain('1,5 мм²');
    expect(t).toContain('старые автоматы');
    expect(t).toContain('35 лет');
    expect(t).toContain('потемнение, оплавление');
    expect(t).toContain('не установлено');
    expect(t).toContain('по практике монтажа');
    expect(t).toContain('проложить новую');
    expect(t).toContain('Вывод: заменить');
  });

  it('prints an empty conclusion', () => {
    const p = { ...sampleProject(), name: '' };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="old" />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).toContain('Вывод: не обследована');
    expect(t).not.toContain('Группы проекта');
  });
});
