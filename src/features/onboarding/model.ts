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

export interface OnboardingStep {
  scene: TourScene;
  title: string;
  text: string;
  targets?: readonly string[];
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    scene: TOUR_SCENE.HOME,
    title: 'Познакомимся с Ampli',
    text: 'Покажем весь путь на реальном интерфейсе: от параметров сети и групп до щитка, приёмки, документов и обмена проектом.'
  },
  {
    scene: TOUR_SCENE.NETWORK,
    title: 'Сеть и специальные системы',
    text: 'В этом окне задаются ввод, выделенная мощность, фазы, защита и способ прокладки. От этих параметров зависит расчёт всех линий. Отсюда же открываются старая проводка, тёплый пол и слаботочные системы.',
    targets: ['[data-tour-view="network"]']
  },
  {
    scene: TOUR_SCENE.EDITOR,
    title: 'Подробности каждой линии',
    text: 'В карточке группы задаются приборы, кабель, длина, помещение и условия монтажа. Ampli сразу пересчитывает ток, сечение, автомат, УЗО и падение напряжения.',
    targets: ['[aria-label="Редактор группы"]']
  },
  {
    scene: TOUR_SCENE.ROOMS,
    title: 'Комнаты и быстрый старт',
    text: 'Опишите помещения и основные приборы — Ampli соберёт типовые линии автоматически. После создания любую группу можно настроить вручную.',
    targets: ['[data-tour-view="rooms"]']
  },
  {
    scene: TOUR_SCENE.PANEL,
    title: 'Сборка щитка и замеры',
    text: 'Режим щитка показывает аппараты по рядам и модулям. Здесь проверяют компоновку, меняют порядок и заносят фактические измерения по каждой линии.',
    targets: ['[data-tour-view="panel"]']
  },
  {
    scene: TOUR_SCENE.WORK,
    title: 'Монтаж и приёмка',
    text: 'Чек-лист помогает пройти монтаж без пропусков. Во вкладках собраны замеры, протокол, паспорт щитка и акты для сдачи объекта.',
    targets: ['[data-tour-view="work"]']
  },
  {
    scene: TOUR_SCENE.REPORT,
    title: 'Схема, материалы и смета',
    text: 'Отчёт объединяет расчёт групп, однолинейную схему, спецификацию и смету. Цены можно уточнить, а готовые документы распечатать или сохранить в PDF.',
    targets: ['[data-tour-view="report"]']
  },
  {
    scene: TOUR_SCENE.PROJECTS,
    title: 'Проекты и обмен данными',
    text: 'Создавайте варианты, сохраняйте резервные копии, переносите проекты файлами и отправляйте ссылки. Обучение всегда можно запустить снова кнопкой «?».',
    targets: ['[data-tour-view="projects"]']
  }
] as const;
