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

  it('explains fields in visible text on the group card', () => {
    wide(false);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    expect(screen.getAllByText('От коробки').length).toBeGreaterThan(0);
    expect(screen.getByText('Группы одного помещения ставятся под одно УЗО.')).toBeTruthy();
  });
});
