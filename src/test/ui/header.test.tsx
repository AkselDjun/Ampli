import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Totals } from '../../ui/Totals';
import { calcAll } from '../../core/calc';
import { sample } from '../../core/templates';

describe('header totals on narrow phones', () => {
  it('marks the input breaker figure so it can step aside on the narrowest screens', () => {
    const p = sample();
    render(<Totals a={calcAll(p.lines, p.cfg, p)} onNet={() => undefined} />);
    const kin = document.querySelector('button.kpis .kp-in') as HTMLElement;
    expect(kin.textContent).toMatch(/^ВводC\d+$/);
    expect(document.querySelectorAll('button.kpis > div').length).toBe(3);
  });
});
