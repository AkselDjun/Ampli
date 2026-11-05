import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { fitCols, railCells } from '../../ui/railfit';
import { PanelPane } from '../../ui/Side';
import { PanelMode } from '../../ui/PanelMode';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Device } from '../../core/types';

const dev = (kind: Device['kind'], mod: number, zone?: string): Device => ({ kind, mod, label: '', sub: '', title: '', ...(zone ? { zone } : {}) });

describe('rail fitting', () => {
  it('keeps the real row when it fits and splits it evenly when it does not', () => {
    expect(fitCols(18, 0, 28, 3)).toBe(18);
    expect(fitCols(18, 600, 28, 3)).toBe(18);
    expect(fitCols(18, 276, 28, 3)).toBe(9);
    expect(fitCols(18, 200, 28, 3)).toBe(6);
    expect(fitCols(12, 125, 28, 3)).toBe(4);
    expect(fitCols(12, 10, 28, 3)).toBe(1);
  });
  it('packs tightly in a compact view and keeps RCD blocks together on a real row', () => {
    const devs = [dev('in', 2), dev('uzo', 2, 'A'), dev('mcb', 1, 'A'), dev('mcb', 1, 'A'), dev('mcb', 1, 'A')];
    const real = railCells(devs, 6, 6, 12);
    expect(real.gapBefore).toEqual([0, 4, 0, 0, 0]);
    expect(real.free).toBe(1);
    const compact = railCells(devs, 3, 6, 12);
    expect(compact.gapBefore).toEqual([0, 1, 0, 0, 0]);
    expect(compact.free).toBe(4);
    expect(railCells([], 6, 6, 12)).toEqual({ gapBefore: [], free: 12 });
  });
});

describe('rail in a narrow container', () => {
  const RO = globalThis.ResizeObserver;
  afterEach(() => {
    globalThis.ResizeObserver = RO;
    vi.restoreAllMocks();
  });
  it('wraps the board to the available width without horizontal scroll', () => {
    const cbs: (() => void)[] = [];
    globalThis.ResizeObserver = class {
      constructor(cb: () => void) { cbs.push(cb); }
      observe() { return undefined; }
      disconnect() { return undefined; }
    } as unknown as typeof ResizeObserver;
    const w = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(290);
    const ls = Array.from({ length: 14 }, (_, i) => mkLine('Группа ' + i, 'light', 5, null, null, [['x', 100, 1]]));
    const p = { ...newProject({ cfg: { ...defaultCfg(), prot: 'rcbo' }, lines: ls, sample: false }, 'Тест'), lines: ls };
    const a = calcAll(p.lines, p.cfg);
    const { unmount } = render(<PanelPane a={a} />);
    const rail = document.querySelector('.rail') as HTMLElement;
    expect(rail.dataset.rc).toBe('9');
    expect(rail.style.getPropertyValue('--rc')).toBe(rail.dataset.rc);
    w.mockReturnValue(900);
    act(() => cbs.forEach(cb => cb()));
    expect((document.querySelector('.rail') as HTMLElement).dataset.rc).toBe('18');
    unmount();
    w.mockReturnValue(290);
    render(<PanelMode open onClose={() => undefined} a={a} dispatch={vi.fn()} />);
    expect((document.querySelector('.pmb-rail') as HTMLElement).dataset.rc).toBe('6');
    expect(document.querySelectorAll('button.pmb-dev').length).toBe(14);
  });
});
