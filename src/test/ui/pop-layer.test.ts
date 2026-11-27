import { describe, expect, it } from 'vitest';
import { popPosition } from '../../ui/menu';

const view = { w: 390, h: 844 };
const size = { w: 300, h: 260 };
const at = (left: number, top: number, w = 40, h = 40) => ({ left, top, right: left + w, bottom: top + h });

describe('menu placement', () => {
  it('opens below the trigger when there is room', () => {
    const p = popPosition(at(20, 100), size, view);
    expect(p).toMatchObject({ up: false, top: 146, left: 20 });
  });

  it('flips above when the menu does not fit below', () => {
    const p = popPosition(at(20, 700), size, view);
    expect(p.up).toBe(true);
    expect(p.top + Math.min(size.h, p.maxHeight)).toBeLessThanOrEqual(700);
  });

  it('opens down from a top tab bar even when asked to open up', () => {
    const p = popPosition(at(300, 60, 90, 48), size, { w: 1366, h: 860 }, { up: true });
    expect(p.up).toBe(false);
    expect(p.top).toBeGreaterThanOrEqual(108);
  });

  it('opens up from a bottom tab bar', () => {
    const p = popPosition(at(300, 790, 90, 54), size, view, { up: true });
    expect(p.up).toBe(true);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });

  it('keeps an end-aligned menu inside the screen when the trigger is near the left edge', () => {
    const p = popPosition(at(16, 300), size, { w: 320, h: 640 }, { end: true });
    expect(p.left).toBe(8);
    expect(p.left + size.w).toBeLessThanOrEqual(320 - 8);
  });

  it('keeps a start-aligned menu inside the screen when the trigger is near the right edge', () => {
    const p = popPosition(at(340, 20), size, view);
    expect(p.left + size.w).toBeLessThanOrEqual(view.w - 8);
  });

  it('limits the height to the space left on a short landscape screen', () => {
    const p = popPosition(at(400, 150), { w: 300, h: 435 }, { w: 844, h: 390 });
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(390 - 8 + 1);
  });
});
