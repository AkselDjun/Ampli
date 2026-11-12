import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  TOUR_CHAPTER,
  TOUR_MODE,
  TOUR_SCENE,
  chapterProgress,
  chapterStart,
  chapterSteps,
  clampStep,
  minutesFor,
  stepsFor,
  targetsFor
} from '../../features/onboarding/model';
import type { OnboardingStep } from '../../features/onboarding/model';
import { ONBOARDING_CHAPTERS, ONBOARDING_STEPS } from '../../features/onboarding/steps';
import { sheetForTourScene } from '../../app/navigation';
import { APP_SHEET } from '../../app/types';

const ALL = ONBOARDING_STEPS;
const FRESH = stepsFor(ALL, TOUR_MODE.FRESH);
const chapterIndex = (id: string) => ONBOARDING_CHAPTERS.findIndex(c => c.id === id);
const byId = (id: string): OnboardingStep => {
  const s = ALL.find(x => x.id === id);
  if (!s) throw new Error('missing step ' + id);
  return s;
};
const SHEET_VIEW: Record<string, string> = {
  [APP_SHEET.NETWORK]: 'network',
  [APP_SHEET.ROOMS]: 'rooms',
  [APP_SHEET.WORK]: 'work',
  [APP_SHEET.REPORT]: 'report',
  [APP_SHEET.PROJECTS]: 'projects'
};
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/[.!?](\s|$)/).filter(x => x && x.trim()).length;

describe('onboarding content', () => {
  it('keeps a short tour that fits in a couple of minutes', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(6);
    expect(ALL.length).toBeLessThanOrEqual(12);
    expect(minutesFor(ALL.length)).toBeLessThanOrEqual(2);
    for (const c of ONBOARDING_CHAPTERS) expect(chapterSteps(ALL, c.id), c.id).toBeLessThanOrEqual(6);
  });

  it('uses unique step ids and unique titles', () => {
    expect(new Set(ALL.map(s => s.id)).size).toBe(ALL.length);
    expect(new Set(ALL.map(s => s.title)).size).toBe(ALL.length);
  });

  it.each(ALL.map(s => [s.id, s] as const))('keeps step %s easy to read', (_, s) => {
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
    for (const s of ALL) {
      expect(s.targets.length, s.id).toBeGreaterThan(0);
      for (const sel of [...s.targets, ...(s.compactTargets ?? [])]) expect(() => document.querySelector(sel), sel).not.toThrow();
    }
  });

  it('opens a real application view for every scene', () => {
    for (const s of ALL) {
      const sheet = sheetForTourScene(s.scene);
      const inPlace = s.scene === TOUR_SCENE.HOME || s.scene === TOUR_SCENE.EDITOR || s.scene === TOUR_SCENE.WIRING;
      expect(inPlace || sheet !== null, s.id).toBe(true);
      if (sheet) expect(s.targets.some(t => t.includes(`[data-tour-view="${SHEET_VIEW[sheet]}"]`)), s.id).toBe(true);
      else expect(s.targets.some(t => t.includes('[data-tour-view')), s.id).toBe(false);
    }
  });

  it('ends every step on a fallback that is always on screen', () => {
    for (const s of ALL) {
      const last = s.targets[s.targets.length - 1];
      if (s.scene === TOUR_SCENE.HOME) continue;
      expect(/^\[(data-tour-view|aria-label)="[^"]+"\]$/.test(last), s.id + ': ' + last).toBe(true);
    }
  });

  it('keeps chapters in order and without gaps', () => {
    const order = ALL.map(s => chapterIndex(s.chapter));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const c of ONBOARDING_CHAPTERS) {
      expect(chapterSteps(ALL, c.id), c.id).toBeGreaterThan(0);
      const start = chapterStart(ALL, c.id);
      expect(ALL[start].chapter).toBe(c.id);
      if (start > 0) expect(ALL[start - 1].chapter).not.toBe(c.id);
    }
    expect(ONBOARDING_CHAPTERS.map(c => c.id)).toEqual(Object.values(TOUR_CHAPTER));
    expect(ONBOARDING_CHAPTERS.reduce((n, c) => n + chapterSteps(ALL, c.id), 0)).toBe(ALL.length);
  });

  it('starts the tour with the summary and ends with projects', () => {
    expect(ALL[0].id).toBe('summary');
    expect(ALL[ALL.length - 1].id).toBe('projects');
  });
});

describe('onboarding progress', () => {
  it('clamps any step index into the tour', () => {
    expect(clampStep(ALL, -5)).toBe(0);
    expect(clampStep(ALL, 0)).toBe(0);
    expect(clampStep(ALL, 2.7)).toBe(2);
    expect(clampStep(ALL, 999)).toBe(ALL.length - 1);
    expect(clampStep(ALL, Number.NaN)).toBe(0);
    expect(clampStep(ALL, Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampStep([], 3)).toBe(0);
    expect(clampStep(FRESH, 999)).toBe(FRESH.length - 1);
  });

  it('fills chapters one after another', () => {
    const first = chapterProgress(ONBOARDING_CHAPTERS, ALL, 0);
    expect(first.map(c => c.done)).toEqual([1, 0, 0]);
    expect(first.map(c => c.current)).toEqual([true, false, false]);
    const last = chapterProgress(ONBOARDING_CHAPTERS, ALL, ALL.length - 1);
    expect(last.every(c => c.done === c.total)).toBe(true);
    expect(last[last.length - 1].current).toBe(true);
    const build = chapterProgress(ONBOARDING_CHAPTERS, ALL, chapterStart(ALL, TOUR_CHAPTER.BUILD));
    expect(build[0].done).toBe(build[0].total);
    expect(build[1].done).toBe(1);
    expect(build[2].done).toBe(0);
  });

  it('never reports more progress than steps taken', () => {
    fc.assert(fc.property(fc.integer({ min: -20, max: 40 }), fc.boolean(), (i, fresh) => {
      const list = fresh ? FRESH : ALL;
      const p = chapterProgress(ONBOARDING_CHAPTERS, list, i);
      const done = p.reduce((n, c) => n + c.done, 0);
      expect(done).toBe(clampStep(list, i) + 1);
      expect(p.reduce((n, c) => n + c.total, 0)).toBe(list.length);
      expect(p.filter(c => c.current)).toHaveLength(1);
      for (const c of p) expect(c.done).toBeLessThanOrEqual(c.total);
    }));
  });

  it('estimates at least one minute', () => {
    expect(minutesFor(0)).toBe(1);
    expect(minutesFor(1)).toBe(1);
    expect(minutesFor(10)).toBe(2);
    expect(minutesFor(12)).toBe(2);
  });

  it('uses compact targets only on small screens and only when they exist', () => {
    const panel = byId('panel');
    const summary = byId('summary');
    expect(targetsFor(panel, true)).toBe(panel.compactTargets);
    expect(targetsFor(panel, false)).toBe(panel.targets);
    expect(targetsFor(summary, true)).toBe(summary.targets);
  });
});

describe('what is new in the tour', () => {
  it('covers every feature added after the first tour', () => {
    expect(FRESH.map(s => s.id)).toEqual(['editor', 'network', 'fit', 'wiring', 'tiers']);
    expect(minutesFor(FRESH.length)).toBe(1);
  });

  it('keeps the full tour unchanged in the full mode', () => {
    expect(stepsFor(ALL, TOUR_MODE.FULL)).toBe(ALL);
  });

  it('shows only chapters that have new steps', () => {
    const p = chapterProgress(ONBOARDING_CHAPTERS, FRESH, 0);
    expect(p.map(c => c.id)).toEqual([TOUR_CHAPTER.DESIGN, TOUR_CHAPTER.BUILD, TOUR_CHAPTER.HANDOVER]);
    expect(p.map(c => c.total)).toEqual([3, 1, 1]);
    expect(chapterProgress(ONBOARDING_CHAPTERS, [byId('wiring')], 0).map(c => c.id)).toEqual([TOUR_CHAPTER.BUILD]);
    expect(chapterProgress(ONBOARDING_CHAPTERS, [], 0)).toEqual([]);
  });

  it('explains the private house, power limit, wiring map and estimate tiers', () => {
    expect(byId('network').text).toMatch(/дом/);
    expect(byId('network').text).toMatch(/PEN/);
    expect(byId('fit').text).toMatch(/реле приоритета/);
    expect(byId('fit').targets[0]).toContain('.pfit');
    expect(byId('wiring').text).toMatch(/«Стена»/);
    expect(byId('wiring').scene).toBe(TOUR_SCENE.WIRING);
    expect(byId('tiers').text).toMatch(/Базовый.*Надёжный.*Максимум/);
    expect(byId('tiers').scene).toBe(TOUR_SCENE.ESTIMATE);
  });

  it('keeps the new steps in the chapters where the features live', () => {
    expect(chapterIndex(byId('fit').chapter)).toBe(chapterIndex(TOUR_CHAPTER.DESIGN));
    expect(chapterIndex(byId('wiring').chapter)).toBe(chapterIndex(TOUR_CHAPTER.BUILD));
    expect(chapterIndex(byId('tiers').chapter)).toBe(chapterIndex(TOUR_CHAPTER.HANDOVER));
    expect(ALL.indexOf(byId('fit'))).toBe(ALL.indexOf(byId('network')) + 1);
    expect(ALL.indexOf(byId('tiers'))).toBe(ALL.indexOf(byId('report')) + 1);
  });
});
