import type { Calc, Line, Project } from '../core/types';

export const APP_VIEW = {
  GROUPS: 'groups',
  EDITOR: 'edit',
  PANEL: 'panel'
} as const;

export type AppView = typeof APP_VIEW[keyof typeof APP_VIEW];

export const APP_SHEET = {
  NETWORK: 'net',
  PROJECTS: 'proj',
  REPORT: 'rep',
  WORK: 'work',
  LIBRARY: 'lib',
  COMPARE: 'cmp',
  ROOMS: 'rooms',
  SHOP: 'shop',
  OLD_WIRING: 'old',
  FLOOR: 'floor',
  WEAK: 'weak'
} as const;

export type AppSheet = typeof APP_SHEET[keyof typeof APP_SHEET];
export type SheetId = AppSheet | null;
export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';
export type HeaderCheckFix = 'phase3' | 'phase1' | 'net';

export interface SheetHint {
  text: string;
  label: string;
  run: () => void;
  close: () => void;
}

export interface SheetNav {
  shown?: () => void;
  back?: () => void;
  to?: string;
  hint?: SheetHint;
}

export interface NavActions {
  project: (id: string) => void;
  newProject: () => void;
  projects: () => void;
  share: () => void;
  library: () => void;
  tour: () => void;
  keys: () => void;
  rooms: () => void;
  oldWiring: () => void;
  compare: () => void;
  floor: () => void;
  weak: () => void;
  shop: () => void;
}

export interface AppHeaderProps {
  list: readonly Project[];
  cur: string;
  nav: NavActions;
  selected: Line | null;
  selectedIndex: number;
  saveStatus: SaveStatus;
  calc: Calc;
  onBack: () => void;
  onNetwork: () => void;
  onGroup: (id: string) => void;
  onCheckFix: (fix: HeaderCheckFix) => void;
  onPanel: () => void;
  onWork: () => void;
  onReport: () => void;
  onCompare: () => void;
}

export interface AppTabsProps {
  nav: NavActions;
  calc: Calc;
  view: AppView;
  onGroups: () => void;
  onPanel: () => void;
  onWork: () => void;
  onReport: () => void;
}

export type ProjStart = 'main' | 'share' | 'new';
