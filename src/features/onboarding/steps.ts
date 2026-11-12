import { TOUR_CHAPTER, TOUR_SCENE } from './model';
import type { OnboardingChapter, OnboardingStep } from './model';

export const ONBOARDING_CHAPTERS: readonly OnboardingChapter[] = [
  { id: TOUR_CHAPTER.DESIGN, title: 'Расчёт', text: 'Группы, ввод, частный дом и выделенная мощность' },
  { id: TOUR_CHAPTER.BUILD, title: 'Монтаж', text: 'Щиток, карта скрытой проводки и приёмка' },
  { id: TOUR_CHAPTER.HANDOVER, title: 'Документы', text: 'Схема, смета в трёх вариантах и обмен' }
];

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'summary',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.HOME,
    icon: 'summary',
    title: 'Главное всегда на виду',
    text: 'Табло показывает мощность объекта, ток, вводной автомат и проверку по нормам. Зелёный цвет значит, что всё в порядке.',
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
    text: 'Сверху карточки результат и замечания, ниже длина, помещение и приборы. Ток, сечение, автомат и УЗО пересчитываются сразу.',
    tip: 'Редкие поля в «Дополнительно», формулы в «Как посчитано».',
    fresh: true,
    targets: ['#editor .ed-res', '[aria-label="Редактор группы"]']
  },
  {
    id: 'network',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.NETWORK,
    icon: 'network',
    title: 'Квартира или частный дом',
    text: 'Выберите объект и число фаз по техническим условиям. Для дома Ampli добавит ввод СИП, разделение PEN, повторное заземление и УЗИП.',
    fresh: true,
    targets: ['[data-tour-view="network"] [data-tour="object"]', '[data-tour-view="network"]']
  },
  {
    id: 'fit',
    chapter: TOUR_CHAPTER.DESIGN,
    scene: TOUR_SCENE.NETWORK,
    icon: 'fit',
    title: 'Уложиться в выделенную мощность',
    text: 'Если расчётная мощность больше выделенной, Ampli предложит выход: реле приоритета нагрузки, три фазы или увеличение мощности.',
    tip: 'Советы появятся под этим полем, как только мощности не хватит.',
    fresh: true,
    targets: ['[data-tour-view="network"] .pfit', '[data-tour-view="network"] [data-tour="alloc"]', '[data-tour-view="network"]']
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
    targets: ['[data-tour-view="work"] .pmb-dev.sel', '[data-tour-view="work"] .pmb-box', '[data-tour-view="work"]'],
    compactTargets: ['[data-tour-view="work"] .pmb-dev.sel', '[data-tour-view="work"] .pmb-box']
  },
  {
    id: 'wiring',
    chapter: TOUR_CHAPTER.BUILD,
    scene: TOUR_SCENE.WIRING,
    icon: 'wiring',
    title: 'Карта скрытой проводки',
    text: 'Сфотографируйте стену до штукатурки с отметкой «Стена» и отметьте трассы кабелей прямо на фото. Владелец получит карту в PDF.',
    tip: 'Так через год никто не попадёт сверлом в кабель.',
    fresh: true,
    targets: ['#editor .meas', '[aria-label="Редактор группы"]']
  },
  {
    id: 'work',
    chapter: TOUR_CHAPTER.BUILD,
    scene: TOUR_SCENE.WORK,
    icon: 'work',
    title: 'Чек-лист монтажа и приёмка',
    text: 'Отмечайте сделанное по шагам, чтобы ничего не пропустить. Во вкладках замеры на щитке с протоколом, паспорт щитка и акты.',
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
    id: 'tiers',
    chapter: TOUR_CHAPTER.HANDOVER,
    scene: TOUR_SCENE.ESTIMATE,
    icon: 'tiers',
    title: 'Смета в трёх вариантах',
    text: 'Базовый вариант — проект как есть, Надёжный и Максимум только добавляют защиту. Клиент откроет ссылку и выберет сам.',
    tip: 'Включите варианты галочкой и задайте наценку для каждого.',
    fresh: true,
    targets: ['[data-tour-view="report"] .tier-set', '[data-tour-view="report"]']
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
