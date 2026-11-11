import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { BOOT_KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { scalePhoto, PHOTO_MAX_BYTES } from '../../ui/photoScale';
import { scaleLogo, LOGO_MAX_BYTES } from '../../ui/logo';
import { MAX_FILE } from '../../core/pricelist';
import { click, dlg, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const obj = { x: 1 };
const big = (size: number, type: string, name = 'f') => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

afterEach(() => localStorage.clear());

describe('hostile saved project', () => {
  it('opens a stored project with absurd numbers and objects without hanging or showing infinity', () => {
    const p = JSON.parse(JSON.stringify(sampleProject()));
    p.cfg.alloc = 1e308;
    p.proto = { date: obj, device: obj, by: obj };
    p.rooms = [{ name: obj, apps: [{ name: obj, w: obj, n: 1e9, tag: 'p' }] }];
    for (const l of p.lines) {
      l.len = 1e308;
      l.phase = obj;
      for (const a of l.apps) Object.assign(a, { w: 1e308, n: '1e400' });
    }
    localStorage.setItem(BOOT_KEY, JSON.stringify({ schema: 1, cur: p.id, order: [p.id], project: p }));
    const t = performance.now();
    render(<App />);
    expect(performance.now() - t).toBeLessThan(20000);
    const k = document.querySelector('.kpis')?.textContent ?? '';
    expect(k).toContain('кВт');
    expect(k).not.toContain('∞');
    expect(document.querySelector('.crash')).toBeNull();
  });
});

describe('oversized uploads', () => {
  it('refuses a photo file over the limit before decoding', async () => {
    await expect(scalePhoto(big(PHOTO_MAX_BYTES + 1, 'image/jpeg'))).rejects.toThrow('too large');
  });
  it('refuses a logo file over the limit before reading', async () => {
    await expect(scaleLogo(big(LOGO_MAX_BYTES + 1, 'image/png'))).rejects.toThrow('too large');
  });
  it('refuses a price list over the limit without reading it', async () => {
    render(<App />);
    click(document.querySelector('nav.tabs') as HTMLElement, /Отчёт/);
    fireEvent.click(within(dlg('Отчёт и спецификация')).getByRole('tab', { name: 'Смета' }));
    click(dlg('Отчёт и спецификация'), 'Где купить');
    const d = dlg('Где купить');
    const f = big(MAX_FILE + 1, 'text/csv', 'opt.csv');
    const read = vi.fn(() => Promise.resolve(new ArrayBuffer(0)));
    Object.defineProperty(f, 'arrayBuffer', { value: read });
    const input = d.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [f], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(toastText()).toMatch(/больше 5 МБ/));
    expect(read).not.toHaveBeenCalled();
  });
});
