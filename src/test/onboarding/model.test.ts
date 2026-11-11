import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ONBOARDING_CHAPTERS,
  ONBOARDING_STEPS,
  TOUR_CHAPTER,
  TOUR_SCENE,
  chapterIndex,
  chapterProgress,
  chapterStart,
  chapterSteps,
  clampStep,
  minutesFor,
  stepCount,
  targetsFor
} from '../../features/onboarding/model';
import { sheetForTourScene } from '../../app/navigation';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/[.!?](\s|$)/).filter(x => x && x.trim()).length;

describe('onboarding content', () => {
  it('keeps a short tour that fits in a couple of minutes', () => {
    expect(stepCount()).toBe(ONBOARDING_STEPS.length);
    expect(stepCount()).toBeGreaterThanOrEqual(6);
    expect(stepCount()).toBeLessThanOrEqual(10);
    expect(minutesFor(stepCount())).toBeLessThanOrEqual(2);
  });

  it('uses unique step ids and unique titles', () => {
    expect(new Set(ONBOARDING_STEPS.map(s => s.id)).size).toBe(ONBOARDING_STEPS.length);
    expect(new Set(ONBOARDING_STEPS.map(s => s.title)).size).toBe(ONBOARDING_STEPS.length);
  });

  it.each(ONBOARDING_STEPS.map(s => [s.id, s] as const))('keeps step %s easy to read', (_, s) => {
    expect(s.title.length).toBeLessThanOrEqual(48);
    expect(s.text.length).toBeLessThanOrEqual(160);
    expect(words(s.text)).toBeLessThanOrEqual(24);
    expect(sentences(s.text)).toBeLessThanOrEqual(3);
    if (s.tip) expect(s.tip.length).toBeLessThanOrEqual(80);
    expect(s.text).not.toMatch(/\s{2,}/);
    expect(s.text.trim()).toBe(s.text);
    expect(s.text).toMatch(/[.!]$/);
  });

  it('points every step at a real element and a fallback', () => {
    for (const s of ONBOARDING_STEPS) {
      expect(s.targets.length, s.id).toBeGreaterThan(0);
      for (const sel of [...s.targets, ...(s.compactTargets ?? [])]) expect(() => document.querySelector(sel), sel).not.toThrow();
    }
  });

  it('opens a real application view for every scene', () => {
    for (const s of ONBOARDING_STEPS) {
      const inPlace = s.scene === TOUR_SCENE.HOME || s.scene === TOUR_SCENE.EDITOR;
      expect(inPlace || sheetForTourScene(s.scene) !== null, s.id).toBe(true);
      if (!inPlace) expect(s.targets.some(t => t.includes(`[data-tour-view="${s.scene}"]`)), s.id).toBe(true);
    }
  });

  it('keeps chapters in order and without gaps', () => {
    const order = ONBOARDING_STEPS.map(s => chapterIndex(s.chapter));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const c of ONBOARDING_CHAPTERS) {
      expect(chapterSteps(c.id), c.id).toBeGreaterThan(0);
      const start = chapterStart(c.id);
      expect(ONBOARDING_STEPS[start].chapter).toBe(c.id);
      if (start > 0) expect(ONBOARDING_STEPS[start - 1].chapter).not.toBe(c.id);
    }
    expect(ONBOARDING_CHAPTERS.map(c => c.id)).toEqual(Object.values(TOUR_CHAPTER));
    expect(ONBOARDING_CHAPTERS.reduce((n, c) => n + chapterSteps(c.id), 0)).toBe(ONBOARDING_STEPS.length);
  });

  it('starts the tour with the summary and ends with projects', () => {
    expect(ONBOARDING_STEPS[0].id).toBe('summary');
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id).toBe('projects');
  });
});

describe('onboarding progress', () => {
  it('clamps any step index into the tour', () => {
    expect(clampStep(-5)).toBe(0);
    expect(clampStep(0)).toBe(0);
    expect(clampStep(2.7)).toBe(2);
    expect(clampStep(999)).toBe(ONBOARDING_STEPS.length - 1);
    expect(clampStep(Number.NaN)).toBe(0);
    expect(clampStep(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('fills chapters one after another', () => {
    const first = chapterProgress(0);
    expect(first.map(c => c.done)).toEqual([1, 0, 0]);
    expect(first.map(c => c.current)).toEqual([true, false, false]);
    const last = chapterProgress(ONBOARDING_STEPS.length - 1);
    expect(last.every(c => c.done === c.total)).toBe(true);
    expect(last[last.length - 1].current).toBe(true);
    const build = chapterProgress(chapterStart(TOUR_CHAPTER.BUILD));
    expect(build[0].done).toBe(build[0].total);
    expect(build[1].done).toBe(1);
    expect(build[2].done).toBe(0);
  });

  it('never reports more progress than steps taken', () => {
    fc.assert(fc.property(fc.integer({ min: -20, max: 40 }), i => {
      const p = chapterProgress(i);
      const done = p.reduce((n, c) => n + c.done, 0);
      expect(done).toBe(clampStep(i) + 1);
      expect(p.filter(c => c.current)).toHaveLength(1);
      for (const c of p) expect(c.done).toBeLessThanOrEqual(c.total);
    }));
  });

  it('estimates at least one minute', () => {
    expect(minutesFor(0)).toBe(1);
    expect(minutesFor(1)).toBe(1);
    expect(minutesFor(10)).toBe(2);
  });

  it('uses compact targets only on small screens and only when they exist', () => {
    const panel = ONBOARDING_STEPS.find(s => s.id === 'panel');
    const summary = ONBOARDING_STEPS.find(s => s.id === 'summary');
    if (!panel || !summary) throw new Error('missing steps');
    expect(targetsFor(panel, true)).toBe(panel.compactTargets);
    expect(targetsFor(panel, false)).toBe(panel.targets);
    expect(targetsFor(summary, true)).toBe(summary.targets);
  });
});
