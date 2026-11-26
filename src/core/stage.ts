export interface StageAct {
  label: string;
  sheet: 'report' | 'work';
  tab: string;
}

export interface Stage {
  name: string;
  sub: string;
  next: string;
  act?: StageAct;
}

export const STAGES: readonly Stage[] = [
  {
    name: 'Расчёт',
    sub: 'Группы, щиток, проверки',
    next: 'Уберите нарушения и отправьте смету заказчику',
    act: { label: 'Открыть смету', sheet: 'report', tab: 'estimate' }
  },
  {
    name: 'Смета отправлена',
    sub: 'Ждём ответа заказчика',
    next: 'Когда заказчик согласует смету, распечатайте лист сборки и начинайте монтаж',
    act: { label: 'Лист сборки', sheet: 'report', tab: 'assembly' }
  },
  {
    name: 'Монтаж',
    sub: 'Сборка щитка и прокладка',
    next: 'Пройдите чек-лист и внесите замеры по каждой группе',
    act: { label: 'Открыть замеры', sheet: 'work', tab: 'meas' }
  },
  {
    name: 'Приёмка',
    sub: 'Замеры, акты, паспорт',
    next: 'Подпишите акты с заказчиком и передайте паспорт щитка',
    act: { label: 'Документы', sheet: 'work', tab: 'docs' }
  },
  {
    name: 'Сдан',
    sub: 'Документы у владельца',
    next: 'Объект сдан. Протокол, акты и паспорт лежат в «Приёмке»'
  }
];

export const SENT_STAGE = 1;

export function normStage(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const n = Math.min(STAGES.length - 1, Math.floor(v));
  return n > 0 ? n : undefined;
}

export const stageOf = (p: { stage?: number }): number => normStage(p.stage) ?? 0;
