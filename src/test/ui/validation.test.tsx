import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { App } from '../../ui/App';
import { byLabel, change, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const ed = () => document.querySelector('.col-edit') as HTMLElement;

const boot = () => {
  wide(true);
  render(<App />);
  fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[0]);
};

const errOf = (el: HTMLElement): string => {
  const id = el.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent ?? '' : '';
};

describe('field validation in the group editor', () => {
  it('flags an unreal appliance power and clears it after a fix', () => {
    boot();
    const w = ed().querySelectorAll<HTMLInputElement>('input[aria-label="Мощность, Вт"]')[0];
    change(w, '50000');
    expect(w.getAttribute('aria-invalid')).toBe('true');
    expect(w.dataset.err).toBe('hard');
    expect(errOf(w)).toMatch(/^Мощность: не больше 30 000 Вт\./);
    change(w, '2000');
    expect(w.hasAttribute('aria-invalid')).toBe(false);
    expect(ed().querySelector('.f-err')).toBeNull();
  });

  it('explains a line length that is too long or zero', () => {
    boot();
    const len = byLabel(ed(), 'Длина линии, м');
    change(len, '450');
    expect(errOf(len)).toMatch(/^Не больше 300 м\./);
    change(len, '0');
    expect(errOf(len)).toMatch(/^Больше 0 м\./);
    expect(len.dataset.err).toBe('soft');
  });

  it('asks for a whole number of appliances', () => {
    boot();
    const n = ed().querySelectorAll<HTMLInputElement>('input[aria-label="Количество"]')[0];
    change(n, '1,5');
    expect(errOf(n)).toBe('Количество: только целое число');
  });

  it('checks measurements against real instrument ranges', () => {
    boot();
    const leak = byLabel(ed(), 'Замер тока утечки, мА');
    change(leak, '300');
    expect(errOf(leak)).toMatch(/^Не больше 100 мА\./);
  });
});
