import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { blank } from '../core/templates';
import { uniqName } from '../core/project';
import type { Line } from '../core/types';
import type { Action } from '../store/reducer';
import { toast, toastOk } from '../ui/toast';
import { useStable } from '../ui/hold';
import { BP, mediaMatches } from '../ui/media';
import type { TourFinish } from '../ui/Onboarding';
import { chapterHintPending, freshPending, markChapterHint, markFreshSeen, markSampleHint, onboardingPending, sampleHintPending } from '../features/onboarding/storage';
import { TOUR_CHAPTER, TOUR_MODE, TOUR_SCENE } from '../features/onboarding/model';
import type { TourChapter, TourMode, TourScene } from '../features/onboarding/model';
import { sheetForTourScene } from './navigation';
import { APP_SHEET, APP_VIEW } from './types';
import type { AppSheet, AppView, SheetId, SheetNav } from './types';

export const FRESH_TEXT = 'В Ampli новое: частный дом, укладка в мощность, карта проводки и смета в трёх вариантах.';
export const SAMPLE_TEXT = 'Это пример двухкомнатной квартиры. Нажмите на группу, чтобы изменить её.';

const SCENE_TAB: Partial<Record<TourScene, string>> = {
  [TOUR_SCENE.REPORT]: 'groups',
  [TOUR_SCENE.ESTIMATE]: 'estimate',
  [TOUR_SCENE.PANEL]: 'meas',
  [TOUR_SCENE.WORK]: 'check'
};

export interface TourDeps {
  atStart: boolean;
  quiet: boolean;
  sheet: SheetId;
  nav: SheetNav;
  busy: boolean;
  lines: Line[];
  names: string[];
  sample: boolean;
  dispatch: Dispatch<Action>;
  setSheet: (sheet: SheetId) => void;
  openSheet: (sheet: AppSheet, tab?: string) => void;
  setView: (view: AppView) => void;
  closePalette: () => void;
  onBlank: () => void;
}

export interface TourApi {
  tourOpen: boolean;
  tourChapter: TourChapter | undefined;
  tourMode: TourMode;
  sheetNav: SheetNav;
  startTour: () => void;
  onTourScene: (scene: TourScene) => void;
  closeTour: () => void;
  finishTour: (choice: TourFinish) => void;
}

export function useTour(d: TourDeps): TourApi {
  const { atStart, quiet, sheet, nav, busy, lines, names, sample, dispatch, setSheet, openSheet, setView, closePalette, onBlank } = d;
  const [tourOpen, setTourOpen] = useState(atStart);
  const [tourChapter, setTourChapter] = useState<TourChapter | undefined>(undefined);
  const [tourMode, setTourMode] = useState<TourMode>(TOUR_MODE.FULL);
  const [freshAsk, setFreshAsk] = useState(() => !atStart && !quiet && freshPending());
  const freshDone = useRef(false);
  const [hintCh, setHintCh] = useState<TourChapter | null>(null);

  const firstLine = lines[0]?.id;
  const onTourScene = useCallback((scene: TourScene) => {
    closePalette();
    if (scene === TOUR_SCENE.HOME) {
      setSheet(null);
      setView(APP_VIEW.GROUPS);
    } else if (scene === TOUR_SCENE.EDITOR || scene === TOUR_SCENE.WIRING) {
      setSheet(null);
      if (firstLine) dispatch({ t: 'select', id: firstLine });
      setView(mediaMatches(BP.desktop) ? APP_VIEW.GROUPS : APP_VIEW.EDITOR);
    } else {
      setView(APP_VIEW.GROUPS);
      const target = sheetForTourScene(scene);
      if (target) openSheet(target, SCENE_TAB[scene]);
      else setSheet(null);
    }
  }, [firstLine, closePalette, dispatch, openSheet, setSheet, setView]);

  useEffect(() => {
    if (!freshAsk || freshDone.current || busy) return;
    const t = window.setTimeout(() => {
      freshDone.current = true;
      markFreshSeen();
      setFreshAsk(false);
      toast(FRESH_TEXT, { label: 'Показать', run: () => { setSheet(null); setTourMode(TOUR_MODE.FRESH); setTourOpen(true); } });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [freshAsk, busy, setSheet]);

  useEffect(() => {
    const ch = sheet === APP_SHEET.WORK ? TOUR_CHAPTER.BUILD : (sheet === APP_SHEET.REPORT ? TOUR_CHAPTER.HANDOVER : null);
    if (!ch || tourOpen || onboardingPending() || !chapterHintPending(ch)) return;
    const t = window.setTimeout(() => {
      markChapterHint(ch);
      setHintCh(ch);
    }, 0);
    return () => window.clearTimeout(t);
  }, [sheet, tourOpen]);

  const sampleOpen = sample && !tourOpen;
  useEffect(() => {
    if (!sampleOpen || freshAsk || !sampleHintPending() || !mediaMatches(BP.tablet)) return;
    const t = window.setTimeout(() => {
      markSampleHint();
      toast(SAMPLE_TEXT, { label: 'Начать с нуля', run: onBlank });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [sampleOpen, freshAsk, onBlank]);

  const hintOn = hintCh !== null && ((hintCh === TOUR_CHAPTER.BUILD && sheet === APP_SHEET.WORK) || (hintCh === TOUR_CHAPTER.HANDOVER && sheet === APP_SHEET.REPORT));
  const sheetNav = useMemo(() => (hintOn && hintCh ? {
    ...nav,
    hint: {
      text: hintCh === TOUR_CHAPTER.BUILD ? 'Покажем щиток, проводку и чек-лист за минуту.' : 'Покажем схему и смету за минуту.',
      label: 'Показать',
      run: () => { setHintCh(null); setTourChapter(hintCh); setTourOpen(true); },
      close: () => setHintCh(null)
    }
  } : nav), [hintOn, hintCh, nav]);

  const closeTour = useCallback(() => {
    setTourChapter(undefined);
    setTourMode(TOUR_MODE.FULL);
    setTourOpen(false);
    setSheet(null);
    setView(APP_VIEW.GROUPS);
  }, [setSheet, setView]);

  const finishTour = useStable((choice: TourFinish) => {
    if (choice !== 'create') return;
    const name = uniqName(names, 'Мой объект');
    dispatch({ t: 'addProject', content: blank(), name });
    setSheet(APP_SHEET.ROOMS);
    toastOk('Создан проект: ' + name);
  });

  const startTour = useCallback(() => {
    setSheet(null);
    setTourOpen(true);
  }, [setSheet]);

  return { tourOpen, tourChapter, tourMode, sheetNav, startTour, onTourScene, closeTour, finishTour };
}
