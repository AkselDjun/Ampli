import { describe, expect, it, vi } from 'vitest';
import { APP_SHEET } from '../../app/types';
import { parentSheetNav, SHEET_TITLE, sheetForTourScene } from '../../app/navigation';
import { TOUR_SCENE } from '../../features/onboarding/model';

describe('typed app navigation', () => {
  it('defines a title for every registered sheet', () => {
    expect(Object.keys(SHEET_TITLE).sort()).toEqual(Object.values(APP_SHEET).sort());
  });

  it('maps onboarding scenes to the real sheets they demonstrate', () => {
    expect(sheetForTourScene(TOUR_SCENE.NETWORK)).toBe(APP_SHEET.NETWORK);
    expect(sheetForTourScene(TOUR_SCENE.ROOMS)).toBe(APP_SHEET.ROOMS);
    expect(sheetForTourScene(TOUR_SCENE.PANEL)).toBe(APP_SHEET.WORK);
    expect(sheetForTourScene(TOUR_SCENE.WORK)).toBe(APP_SHEET.WORK);
    expect(sheetForTourScene(TOUR_SCENE.REPORT)).toBe(APP_SHEET.REPORT);
    expect(sheetForTourScene(TOUR_SCENE.ESTIMATE)).toBe(APP_SHEET.REPORT);
    expect(sheetForTourScene(TOUR_SCENE.PROJECTS)).toBe(APP_SHEET.PROJECTS);
    expect(sheetForTourScene(TOUR_SCENE.HOME)).toBeNull();
    expect(sheetForTourScene(TOUR_SCENE.EDITOR)).toBeNull();
    expect(sheetForTourScene(TOUR_SCENE.WIRING)).toBeNull();
  });

  it('exposes parent navigation only for nested sheets', () => {
    const pop = vi.fn();
    expect(parentSheetNav([APP_SHEET.PROJECTS], pop)).toEqual({ back: undefined, to: undefined });

    const nav = parentSheetNav([APP_SHEET.PROJECTS, APP_SHEET.LIBRARY], pop);
    expect(nav.to).toBe(SHEET_TITLE[APP_SHEET.PROJECTS]);
    nav.back?.();
    expect(pop).toHaveBeenCalledOnce();
  });
});
