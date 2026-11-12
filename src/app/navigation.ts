import { APP_SHEET } from './types';
import type { AppSheet, SheetNav } from './types';
import { TOUR_SCENE } from '../features/onboarding/model';
import type { TourScene } from '../features/onboarding/model';

export const SHEET_TITLE: Readonly<Record<AppSheet, string>> = {
  [APP_SHEET.NETWORK]: 'Параметры сети',
  [APP_SHEET.PROJECTS]: 'Проекты',
  [APP_SHEET.REPORT]: 'Отчёт и спецификация',
  [APP_SHEET.WORK]: 'Монтаж и приёмка',
  [APP_SHEET.LIBRARY]: 'Мои данные',
  [APP_SHEET.COMPARE]: 'Сравнение',
  [APP_SHEET.ROOMS]: 'Комнаты',
  [APP_SHEET.SHOP]: 'Где купить',
  [APP_SHEET.OLD_WIRING]: 'Старая проводка',
  [APP_SHEET.FLOOR]: 'Тёплый пол',
  [APP_SHEET.WEAK]: 'Слаботочка'
};

const TOUR_SHEET: Partial<Record<TourScene, AppSheet>> = {
  [TOUR_SCENE.NETWORK]: APP_SHEET.NETWORK,
  [TOUR_SCENE.ROOMS]: APP_SHEET.ROOMS,
  [TOUR_SCENE.PANEL]: APP_SHEET.WORK,
  [TOUR_SCENE.WORK]: APP_SHEET.WORK,
  [TOUR_SCENE.REPORT]: APP_SHEET.REPORT,
  [TOUR_SCENE.ESTIMATE]: APP_SHEET.REPORT,
  [TOUR_SCENE.PROJECTS]: APP_SHEET.PROJECTS
};

export const sheetForTourScene = (scene: TourScene): AppSheet | null => TOUR_SHEET[scene] ?? null;

export const parentSheetNav = (stack: readonly AppSheet[], pop: () => void): SheetNav => ({
  back: stack.length > 1 ? pop : undefined,
  to: stack.length > 1 ? SHEET_TITLE[stack[stack.length - 2]] : undefined
});
