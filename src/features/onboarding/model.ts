export const TOUR_SCENE = {
  HOME: 'home',
  NETWORK: 'network',
  EDITOR: 'editor',
  WIRING: 'wiring',
  ROOMS: 'rooms',
  PANEL: 'panel',
  WORK: 'work',
  REPORT: 'report',
  ESTIMATE: 'estimate',
  PROJECTS: 'projects'
} as const;

export type TourScene = typeof TOUR_SCENE[keyof typeof TOUR_SCENE];

export const TOUR_CHAPTER = {
  DESIGN: 'design',
  BUILD: 'build',
  HANDOVER: 'handover'
} as const;

export type TourChapter = typeof TOUR_CHAPTER[keyof typeof TOUR_CHAPTER];

export const TOUR_MODE = {
  FULL: 'full',
  FRESH: 'fresh'
} as const;

export type TourMode = typeof TOUR_MODE[keyof typeof TOUR_MODE];

export type TourIcon = 'summary' | 'group' | 'editor' | 'network' | 'fit' | 'rooms' | 'panel' | 'wiring' | 'work' | 'report' | 'tiers' | 'projects';

export interface OnboardingChapter {
  id: TourChapter;
  title: string;
  text: string;
}

export interface OnboardingStep {
  id: string;
  chapter: TourChapter;
  scene: TourScene;
  icon: TourIcon;
  title: string;
  text: string;
  tip?: string;
  fresh?: boolean;
  targets: readonly string[];
  compactTargets?: readonly string[];
}

export const targetsFor = (step: OnboardingStep, compact: boolean): readonly string[] => (compact && step.compactTargets ? step.compactTargets : step.targets);

export const stepsFor = (steps: readonly OnboardingStep[], mode: TourMode): readonly OnboardingStep[] => (mode === TOUR_MODE.FRESH ? steps.filter(s => s.fresh) : steps);

export const clampStep = (steps: readonly OnboardingStep[], i: number): number => Math.min(Math.max(0, Math.trunc(Number.isFinite(i) ? i : 0)), Math.max(0, steps.length - 1));

export const chapterStart = (steps: readonly OnboardingStep[], chapter: TourChapter): number => steps.findIndex(s => s.chapter === chapter);

export const chapterSteps = (steps: readonly OnboardingStep[], chapter: TourChapter): number => steps.filter(s => s.chapter === chapter).length;

export interface ChapterProgress {
  id: TourChapter;
  title: string;
  done: number;
  total: number;
  current: boolean;
}

export function chapterProgress(chapters: readonly OnboardingChapter[], steps: readonly OnboardingStep[], step: number): ChapterProgress[] {
  if (!steps.length) return [];
  const at = clampStep(steps, step);
  const cur = steps[at].chapter;
  return chapters
    .map(c => {
      const start = chapterStart(steps, c.id);
      const total = chapterSteps(steps, c.id);
      const done = Math.min(total, Math.max(0, at - start + 1));
      return { id: c.id, title: c.title, done, total, current: c.id === cur };
    })
    .filter(c => c.total > 0);
}

export const minutesFor = (steps: number): number => Math.max(1, Math.round(steps * 12 / 60));
