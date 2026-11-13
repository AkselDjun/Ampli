import { APP_SHEET } from './types';
import type { AppSheet, SheetId } from './types';

const SLUG: Partial<Record<AppSheet, string>> = {
  [APP_SHEET.REPORT]: 'report',
  [APP_SHEET.WORK]: 'work',
  [APP_SHEET.SHOP]: 'shop'
};

const TABS: Partial<Record<AppSheet, readonly string[]>> = {
  [APP_SHEET.REPORT]: ['groups', 'scheme', 'estimate', 'notes'],
  [APP_SHEET.WORK]: ['check', 'meas', 'docs']
};

export interface SheetLink {
  sheet: AppSheet;
  tab?: string;
}

export function readSheetHash(hash: string): SheetLink | null {
  const m = /^#([a-z]+)(?:\/([a-z]+))?$/.exec(hash);
  if (!m) return null;
  const sheet = (Object.keys(SLUG) as AppSheet[]).find(k => SLUG[k] === m[1]);
  if (!sheet) return null;
  const tab = m[2] && TABS[sheet]?.includes(m[2]) ? m[2] : undefined;
  return tab ? { sheet, tab } : { sheet };
}

export function sheetHash(sheet: SheetId, tab?: string): string {
  const slug = sheet ? SLUG[sheet] : undefined;
  if (!sheet || !slug) return '';
  return '#' + slug + (tab && TABS[sheet]?.includes(tab) ? '/' + tab : '');
}

export const isSheetHash = (hash: string): boolean => readSheetHash(hash) !== null;
