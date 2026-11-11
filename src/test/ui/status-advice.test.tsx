import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../ui/App';
import { calcAll } from '../../core/calc';
import { sampleProject } from '../../core/project';
import { checksOf, checksState } from '../../ui/Checks';
import { wide } from './util';

describe('advice without violations', () => {
  it('lists groups with advice as information that does not count as a remark', () => {
    const p = sampleProject();
    const a = calcAll(p.lines, p.cfg);
    const list = checksOf(a);
    const info = list.find(x => x.k === 'info');
    expect(info?.t).toMatch(/^Советы в групп/);
    expect(info?.groups?.length).toBeGreaterThan(0);
    const st = checksState(list);
    expect(st.n).toBe(list.filter(x => x.k === 'warn' || x.k === 'bad').length);
  });

  it('shows the advice count under the result on the group card', () => {
    wide(false);
    render(<App />);
    const row = Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.textContent?.includes('Варочная'));
    fireEvent.click(row as HTMLElement);
    expect(screen.getByText(/^\d+ совет\S*, не нарушения норм$/)).toBeTruthy();
  });
});
