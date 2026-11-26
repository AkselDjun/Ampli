import { vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { currentToast } from '../../ui/toast';

const fits = (q: string, v: boolean): boolean => {
  const w = v ? 1440 : 390;
  const conds = [...q.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
  if (!conds.length) return v;
  return conds.every(m => (m[1] === 'min' ? w >= Number(m[2]) : w <= Number(m[2])));
};

export const wide = (v: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: fits(q, v),
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
};

export const dlg = (title: string): HTMLElement => {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
  const d = all.find(x => x.querySelector('h2')?.textContent === title);
  if (!d) throw new Error('no dialog ' + title);
  return d;
};

export const isOpen = (title: string): boolean => {
  const d = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(x => x.querySelector('h2')?.textContent === title);
  return !!d && !(d.parentElement as HTMLElement).hidden;
};

export const btn = (root: ParentNode, text: string | RegExp): HTMLElement => {
  const all = Array.from(root.querySelectorAll<HTMLElement>('button'));
  const b = all.find(x => {
    const t = (x.getAttribute('aria-label') ?? '') + '|' + (x.textContent ?? '');
    return typeof text === 'string' ? (x.textContent === text || x.getAttribute('aria-label') === text || (x.textContent ?? '').startsWith(text + ': ')) : text.test(t);
  });
  if (!b) throw new Error('no button ' + String(text));
  return b;
};

export const click = (root: ParentNode, text: string | RegExp) => fireEvent.click(btn(root, text));

export const byLabel = (root: ParentNode, label: string): HTMLInputElement => {
  const el = root.querySelector<HTMLInputElement>('[aria-label="' + label + '"]');
  if (!el) throw new Error('no label ' + label);
  return el;
};

export const change = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

export const toastText = (): string => currentToast()?.text ?? '';

export const rowNo = (n: number): HTMLElement => {
  const r = Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.querySelector('.no')?.textContent?.startsWith('Группа ' + String(n).padStart(2, '0') + ','));
  if (!r) throw new Error('no row ' + n);
  return r;
};

export const openCompare = async () => {
  const { screen } = await import('@testing-library/react');
  fireEvent.click(screen.getByRole('button', { name: 'Инструменты' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Сравнение вариантов/ }));
};

export const openMeas = () => {
  const nav = document.querySelector('nav.tabs') as HTMLElement;
  fireEvent.click(Array.from(nav.querySelectorAll<HTMLElement>('button')).find(b => /Приёмка/.test(b.textContent ?? '')) as HTMLElement);
  const tab = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(t => /^Замеры/.test(t.textContent ?? '')) as HTMLElement;
  fireEvent.click(tab);
};
