import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { haptic } from '../../ui/haptic';
import { Sheet, ArmButton } from '../../ui/common';
import { PanelPane } from '../../ui/Side';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';

vi.setConfig({ testTimeout: 60000 });

const coarse = (v: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: v && q.includes('coarse'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia;
};

afterEach(() => {
  delete (navigator as { vibrate?: unknown }).vibrate;
});

describe('haptics', () => {
  it('vibrates only on touch screens and survives errors', () => {
    const vib = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true });
    coarse(false);
    haptic();
    expect(vib).not.toHaveBeenCalled();
    coarse(true);
    haptic(20);
    expect(vib).toHaveBeenCalledWith(20);
    Object.defineProperty(navigator, 'vibrate', { value: () => { throw new Error('x'); }, configurable: true });
    expect(() => haptic()).not.toThrow();
  });

  it('confirms an armed action with a vibration', () => {
    const vib = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true });
    coarse(true);
    const run = vi.fn();
    render(<ArmButton label="Удалить" onRun={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(vib).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Нажмите ещё раз' }));
    expect(run).toHaveBeenCalled();
    expect(vib).toHaveBeenCalledWith(20);
  });
});

describe('sheet height', () => {
  it('fits content without tabs and keeps full height with tabs', () => {
    const { unmount } = render(<Sheet open onClose={() => undefined} title="Без вкладок"><p>x</p></Sheet>);
    expect(document.querySelector('.sheet-panel')).toHaveClass('fit');
    unmount();
    render(<Sheet open onClose={() => undefined} title="С вкладками" bar={<div />}><p>x</p></Sheet>);
    expect(document.querySelector('.sheet-panel')).not.toHaveClass('fit');
  });
});

describe('board colours by group type', () => {
  it('marks modules with the group type and lists the types in the legend', () => {
    const a = calcAll([mkLine('Свет', 'light', 5, 1, 1, [['Лампа', 100, 1]]), mkLine('Плита', 'power', 5, 1, 1, [['Плита', 5000, 1]])], { ...defaultCfg(), prot: 'rcbo' });
    render(<PanelPane a={a} />);
    const types = Array.from(document.querySelectorAll('.rail button.dev')).map(d => d.getAttribute('data-t'));
    expect(types).toEqual(['light', 'power']);
    const legend = Array.from(document.querySelectorAll('.legend > span:not(.tip)')).map(s => s.textContent);
    expect(legend).toEqual(['Ввод', 'Свет', 'Силовая', 'Резерв']);
  });
});
