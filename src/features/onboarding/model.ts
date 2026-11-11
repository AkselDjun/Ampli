export const TOUR_SCENE = {
  HOME: 'home',
  NETWORK: 'network',
  EDITOR: 'editor',
  ROOMS: 'rooms',
  PANEL: 'panel',
  WORK: 'work',
  REPORT: 'report',
  PROJECTS: 'projects'
} as const;

export type TourScene = typeof TOUR_SCENE[keyof typeof TOUR_SCENE];

export const TOUR_CHAPTER = {
  DESIGN: 'design',
  BUILD: 'build',
  HANDOVER: 'handover'
} as const;

export type TourChapter = typeof TOUR_CHAPTER[keyof typeof TOUR_CHAPTER];

export type TourIcon = 'summary' | 'group' | 'editor' | 'network' | 'rooms' | 'panel' | 'work' | 'report' | 'projects';

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
  targets: readonly string[];
  compactTargets?: readonly string[];
}

export const ONBOARDING_CHAPTERS: readonly OnboardingChapter[] = [
  { id: TOUR_CHAPTER.DESIGN, title: 'Расчёт', text: 'Группы, приборы, ввод и проверка по нормам' },
  { id: TOUR_CHAPTER.BUILD, title: 'Монтаж', text: 'Щиток, замеры и чек-лист приёмки' },
  { id: TOUR_CHAPTER.HANDOVER, title: 'Документы', text: 'Схема, смета, акты и обмен проектом' }
];

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'summary',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.HOME,
    icon: 'summary',
    title: 'Главное всегда на виду',
    text: 'Табло показывает мощность квартиры, ток, вводной автомат и проверку по нормам. Зелёный цвет значит, что всё в порядке.',
    tip: 'Нажмите на табло, чтобы увидеть расшифровку.',
    targets: ['[data-tour="summary"]']
  },
  {
    id: 'group',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.HOME,
    icon: 'group',
    title: 'Группа — это одна линия от щитка',
    text: 'Свет, розетки или мощный прибор. Справа автомат, который Ampli подобрал для этой линии. Восклицательный знак подскажет, где есть нарушение.',
    tip: 'Смахните группу влево или вправо, чтобы удалить или скопировать.',
    targets: ['[data-tour="group"]', '.rows .row-wrap']
  },
  {
    id: 'editor',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.EDITOR,
    icon: 'editor',
    title: 'Впишите приборы — остальное посчитает Ampli',
    text: 'Укажите мощность и длину кабеля. Ток, сечение, автомат и УЗО пересчитываются сразу, без кнопки «Рассчитать».',
    tip: 'Кнопка «Как посчитано» покажет формулы и пункты норм.',
    targets: ['#editor .ed-res', '[aria-label="Редактор группы"]']
  },
  {
    id: 'network',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.NETWORK,
    icon: 'network',
    title: 'Параметры ввода',
    text: 'Одна или три фазы, выделенная мощность и способ защиты. Возьмите их из технических условий: от них зависит расчёт всех линий.',
    targets: ['[data-tour-view="network"] .sheet-body > .f', '[data-tour-view="network"]']
  },
  {
    id: 'rooms',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.ROOMS,
    icon: 'rooms',
    title: 'Быстрый старт по комнатам',
    text: 'Отметьте комнаты и крупные приборы, и Ampli сам соберёт типовые группы. Потом любую из них можно поправить.',
    targets: ['[data-tour-view="rooms"] .chips', '[data-tour-view="rooms"]']
  },
  {
    id: 'panel',
    chapter: TOUR_CHAPTER.BUILD,
    scene: TOUR_SCENE.PANEL,
    icon: 'panel',
    title: 'Щиток как настоящий',
    text: 'Аппараты стоят по рядам, как на DIN-рейке. Нажмите на автомат, чтобы записать замеры по его линии.',
    targets: ['[data-tour-view="panel"] .pmb-box', '[data-tour-view="panel"]'],
    compactTargets: ['[data-tour-view="panel"] .pmb-dev.sel', '[data-tour-view="panel"] .pmb-box']
  },
  {
    id: 'work',
    chapter: TOUR_CHAPTER.BUILD,
    scene: TOUR_SCENE.WORK,
    icon: 'work',
    title: 'Чек-лист монтажа и приёмка',
    text: 'Отмечайте сделанное по шагам, чтобы ничего не пропустить. Во вкладках протокол замеров, паспорт щитка и акты.',
    targets: ['[data-tour-view="work"] .tabbar', '[data-tour-view="work"]']
  },
  {
    id: 'report',
    chapter: TOUR_CHAPTER.HANDOVER,
    scene: TOUR_SCENE.REPORT,
    icon: 'report',
    title: 'Схема, материалы и смета',
    text: 'Однолинейная схема, спецификация и смета собираются сами. Распечатайте их или сохраните в PDF для заказчика.',
    targets: ['[data-tour-view="report"] .tabbar', '[data-tour-view="report"]']
  },
  {
    id: 'projects',
    chapter: TOUR_CHAPTER.HANDOVER,
    scene: TOUR_SCENE.PROJECTS,
    icon: 'projects',
    title: 'Проекты и резервные копии',
    text: 'Ведите несколько объектов, отправляйте проект ссылкой или файлом. Данные хранятся только на этом устройстве.',
    tip: 'Раз в неделю сохраняйте резервную копию в файл.',
    targets: ['[data-tour-view="projects"] .tabbar', '[data-tour-view="projects"]']
  }
];

export const targetsFor = (step: OnboardingStep, compact: boolean): readonly string[] => (compact && step.compactTargets ? step.compactTargets : step.targets);

export const stepCount = (): number => ONBOARDING_STEPS.length;

export const clampStep = (i: number): number => Math.min(Math.max(0, Math.trunc(Number.isFinite(i) ? i : 0)), ONBOARDING_STEPS.length - 1);

export const chapterStart = (chapter: TourChapter): number => ONBOARDING_STEPS.findIndex(s => s.chapter === chapter);

export const chapterSteps = (chapter: TourChapter): number => ONBOARDING_STEPS.filter(s => s.chapter === chapter).length;

export const chapterIndex = (chapter: TourChapter): number => ONBOARDING_CHAPTERS.findIndex(c => c.id === chapter);

export interface ChapterProgress {
  id: TourChapter;
  title: string;
  done: number;
  total: number;
  current: boolean;
}

export function chapterProgress(step: number): ChapterProgress[] {
  const at = clampStep(step);
  const cur = ONBOARDING_STEPS[at].chapter;
  return ONBOARDING_CHAPTERS.map(c => {
    const start = chapterStart(c.id);
    const total = chapterSteps(c.id);
    const done = Math.min(total, Math.max(0, at - start + 1));
    return { id: c.id, title: c.title, done, total, current: c.id === cur };
  });
}

export const minutesFor = (steps: number): number => Math.max(1, Math.round(steps * 12 / 60));
