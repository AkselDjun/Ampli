import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { PrintDoc } from '../../ui/PrintDoc';
import { AssemblyView } from '../../ui/AssemblyView';
import { calcAll } from '../../core/calc';
import { assembly } from '../../core/assembly';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';

const proj = () => ({ ...newProject({ ...sample(), sample: false }, 'Квартира'), address: 'Минск, ул. Короля, 3' });

describe('assembly tab of the report', () => {
  it('shows rails, combs, buses, jumpers and group connections of the sample', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Отчёт/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Сборка' }));
    const panel = screen.getByRole('tabpanel', { name: 'Сборка' });
    expect(within(panel).getByRole('list', { name: 'Аппараты ряда 1' })).toBeTruthy();
    expect(panel.textContent).toContain('Гребёнка 1P');
    const buses = within(panel).getByRole('region', { name: 'Шины N и PE' });
    expect(buses.textContent).toContain('Шина N ввода');
    expect(buses.textContent).toContain('Шина PE');
    expect(within(panel).getByRole('region', { name: 'Перемычки в щитке' }).textContent).toContain('коричневый');
    const conn = within(panel).getByRole('region', { name: 'Подключение кабелей групп' });
    expect(within(conn).getAllByRole('row').length).toBeGreaterThan(5);
    expect(panel.textContent).toContain('Важно при сборке');
    expect(window.location.hash).toBe('#report/assembly');
  });

  it('prints the assembly sheet from the footer', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Отчёт/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Сборка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Печать листа сборки' }));
    const doc = document.querySelector('.printdoc') as HTMLElement;
    expect(doc.querySelector('h1')?.textContent).toBe('Сборка щитка');
    act(() => { vi.advanceTimersByTime(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('prints the address, the version stamp and every group', () => {
    const p = proj();
    const a = calcAll(p.lines, p.cfg);
    render(<PrintDoc p={p} a={a} mode="assembly" />);
    const doc = document.querySelector('.printdoc') as HTMLElement;
    expect(doc.textContent).toContain('Минск, ул. Короля, 3');
    expect(doc.querySelector('.pd-foot')?.textContent).toContain('Ampli');
    assembly(a).lines.forEach(l => expect(doc.textContent).toContain(l.g + l.name));
  });

  it('explains what to do in an empty project', () => {
    render(<AssemblyView a={calcAll([], sample().cfg)} />);
    expect(screen.getByText(/Добавьте группу с приборами/)).toBeTruthy();
  });

  it('names wire colours in words, not by colour alone', () => {
    const p = proj();
    render(<AssemblyView a={calcAll(p.lines, p.cfg)} />);
    const sw = document.querySelector('.asm-sw') as HTMLElement;
    expect(sw.getAttribute('aria-hidden')).toBe('true');
    expect((sw.parentElement as HTMLElement).textContent).toMatch(/коричневый|синий/);
  });
});
