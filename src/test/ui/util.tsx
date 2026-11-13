import { vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { currentToast } from '../../ui/toast';

export const wide = (v: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: v,
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
  const r = Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.querySelector('.no')?.textContent === 'Г' + n);
  if (!r) throw new Error('no row Г' + n);
  return r;
};
