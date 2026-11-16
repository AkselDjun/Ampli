import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../ui/App';
import { wide } from './util';

const exposed = (el: HTMLElement): boolean => {
  if (el.closest('[aria-hidden="true"]')) return true;
  if (el.getAttribute('aria-label')?.trim()) return true;
  if (el.textContent?.trim()) return true;
  const id = el.getAttribute('aria-labelledby');
  return !!id && !!document.getElementById(id)?.textContent?.trim();
};

describe('hover hints', () => {
  it('never carry text that touch screens would miss', () => {
    wide(false);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    const bare = Array.from(document.querySelectorAll<HTMLElement>('[data-tip]')).filter(el => !exposed(el));
    expect(bare.map(el => el.outerHTML.slice(0, 120))).toEqual([]);
  });

  it('explains fields on the group card in text or a tap-to-open tip', () => {
    wide(false);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    expect(screen.getAllByText('От коробки').length).toBeGreaterThan(0);
    expect(screen.getByText(/ставятся под одно УЗО/).closest('.tip')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Зачем указывать помещение' })).toBeTruthy();
  });
});
