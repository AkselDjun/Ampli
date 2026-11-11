import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EDGE, GAP, NARROW, SPOT_PAD, needsScroll, placeCard, spotBox } from '../../features/onboarding/placement';
import type { Box, CardPlace, Size } from '../../features/onboarding/placement';

const desk: Size = { width: 1366, height: 860 };
const phone: Size = { width: 412, height: 839 };
const card: Size = { width: 360, height: 260 };

const cardBox = (p: CardPlace, c: Size): Box => ({ left: p.left ?? 0, top: p.top ?? 0, width: c.width, height: c.height });
const overlap = (a: Box, b: Box) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

describe('spotlight box', () => {
  it('pads the target and keeps it on screen', () => {
    expect(spotBox({ left: 100, top: 100, width: 50, height: 20 }, desk)).toEqual({ left: 100 - SPOT_PAD, top: 100 - SPOT_PAD, width: 50 + SPOT_PAD * 2, height: 20 + SPOT_PAD * 2 });
    const edge = spotBox({ left: -40, top: -10, width: 2000, height: 2000 }, desk);
    expect(edge).toEqual({ left: 4, top: 4, width: desk.width - 8, height: desk.height - 8 });
  });

  it('hides the spotlight when there is nothing to show', () => {
    expect(spotBox(null, desk)).toBeNull();
    expect(spotBox({ left: 10, top: 10, width: 0, height: 20 }, desk)).toBeNull();
    expect(spotBox({ left: 10, top: 10, width: 20, height: 0 }, desk)).toBeNull();
    expect(spotBox({ left: 5000, top: 10, width: 20, height: 20 }, desk)).toBeNull();
  });
});

describe('card placement', () => {
  it('centres the card without a target', () => {
    expect(placeCard(null, desk, card)).toEqual({ mode: 'center' });
    expect(placeCard(null, phone, card)).toEqual({ mode: 'center' });
  });

  it('docks the card on phones away from the target', () => {
    expect(placeCard({ left: 16, top: 60, width: 380, height: 80 }, phone, card)).toEqual({ mode: 'dock-bottom' });
    expect(placeCard({ left: 16, top: 700, width: 380, height: 80 }, phone, card)).toEqual({ mode: 'dock-top' });
    expect(placeCard({ left: 16, top: 100, width: 380, height: 700 }, phone, card).mode).toBe('dock-top');
    expect(placeCard({ left: 16, top: 0, width: 380, height: 700 }, { width: NARROW - 1, height: 760 }, card).mode).toBe('dock-bottom');
  });

  it('puts the card under a target in the header', () => {
    const p = placeCard({ left: 520, top: 4, width: 350, height: 52 }, desk, card);
    expect(p.mode).toBe('float');
    expect(p.side).toBe('bottom');
    expect(p.top).toBe(56 + GAP);
    expect(p.arrow).toBeCloseTo(695 - (p.left ?? 0));
  });

  it('puts the card above a target near the bottom', () => {
    const p = placeCard({ left: 520, top: 760, width: 200, height: 60 }, desk, card);
    expect(p.side).toBe('top');
    expect((p.top ?? 0) + card.height).toBe(760 - GAP);
  });

  it('puts the card beside a tall target', () => {
    const right = placeCard({ left: 24, top: 80, width: 340, height: 740 }, desk, card);
    expect(right.side).toBe('right');
    expect(right.left).toBe(24 + 340 + GAP);
    const left = placeCard({ left: 980, top: 80, width: 360, height: 740 }, desk, card);
    expect(left.side).toBe('left');
    expect((left.left ?? 0) + card.width).toBe(980 - GAP);
  });

  it('docks the card when a target fills the screen', () => {
    expect(placeCard({ left: 10, top: 10, width: 1340, height: 840 }, desk, card).mode).toMatch(/^dock-/);
  });

  it('keeps floating cards inside the viewport and off the target', () => {
    const view = fc.record({ width: fc.integer({ min: NARROW, max: 2560 }), height: fc.integer({ min: 480, max: 1440 }) });
    fc.assert(fc.property(view, fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 4, max: 100 }), fc.integer({ min: 4, max: 100 }), (v, x, y, w, h) => {
      const t: Box = { left: v.width * x / 100, top: v.height * y / 100, width: v.width * w / 100, height: v.height * h / 100 };
      const p = placeCard(t, v, card);
      if (p.mode !== 'float') return;
      const b = cardBox(p, card);
      expect(b.left).toBeGreaterThanOrEqual(EDGE - 0.001);
      expect(b.top).toBeGreaterThanOrEqual(EDGE - 0.001);
      expect(b.left + b.width).toBeLessThanOrEqual(v.width - EDGE + 0.001);
      expect(b.top + b.height).toBeLessThanOrEqual(v.height - EDGE + 0.001);
      expect(overlap(b, t)).toBe(false);
      const span = p.side === 'left' || p.side === 'right' ? card.height : card.width;
      expect(p.arrow).toBeGreaterThanOrEqual(24);
      expect(p.arrow).toBeLessThanOrEqual(span - 24);
    }), { numRuns: 300 });
  });
});

describe('scrolling to the target', () => {
  it('scrolls when the target is outside the visible area', () => {
    expect(needsScroll({ left: 0, top: -20, width: 100, height: 40 }, desk, card, 0)).toBe(true);
    expect(needsScroll({ left: 0, top: 900, width: 100, height: 40 }, desk, card, 0)).toBe(true);
    expect(needsScroll({ left: 0, top: 30, width: 100, height: 40 }, desk, card, 56)).toBe(true);
    expect(needsScroll({ left: 0, top: 300, width: 100, height: 40 }, desk, card, 56)).toBe(false);
  });

  it('scrolls a big target up on desktop to make room for the card below it', () => {
    expect(needsScroll({ left: 255, top: 139, width: 856, height: 478 }, desk, card, 0)).toBe(true);
    expect(needsScroll({ left: 255, top: 10, width: 856, height: 478 }, desk, card, 0)).toBe(false);
    expect(needsScroll({ left: 10, top: 20, width: 1340, height: 820 }, desk, card, 0)).toBe(false);
  });

  it('scrolls on phones when the docked card would cover the target', () => {
    expect(needsScroll({ left: 0, top: 600, width: 380, height: 60 }, phone, card, 56)).toBe(true);
    expect(needsScroll({ left: 0, top: 100, width: 380, height: 60 }, phone, card, 56)).toBe(false);
    expect(needsScroll({ left: 0, top: 60, width: 380, height: 700 }, phone, card, 56)).toBe(false);
  });
});
