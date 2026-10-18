export interface CheckItem {
  id: string;
  title: string;
  hint: string;
}

export const CHECK_ITEMS: CheckItem[] = [
  { id: 'marks', title: 'Маркировка групп', hint: 'Подписаны автоматы в щитке и кабели с обеих сторон.' },
  { id: 'terminals', title: 'Затяжка клемм', hint: 'Все зажимы подтянуты моментом по паспорту аппаратов.' },
  { id: 'pe', title: 'Цепь PE и уравнивание потенциалов', hint: 'Проверена непрерывность защитных проводников (ТКП 339-2022, п. 4.3.5.3).' },
  { id: 'zs', title: 'Замер петли фаза-нуль', hint: 'Измерен ток однофазного замыкания или сопротивление петли (ТКП 339-2022, п. 4.4.28.5).' },
  { id: 'ins', title: 'Замер сопротивления изоляции', hint: 'Не менее 0,5 МОм по ТКП 339-2022, п. 4.4.29.2.' },
  { id: 'rcdtest', title: 'Проверка УЗО кнопкой «Тест»', hint: 'Каждое УЗО и дифавтомат отключается по кнопке.' },
  { id: 'rcdtime', title: 'Ток и время срабатывания УЗО', hint: 'Измерено прибором, время не более нормативного.' },
  { id: 'leak', title: 'Токи утечки групп', hint: 'Не более трети уставки УЗО (СН 4.04.01-2019, п. 16.3.7).' },
  { id: 'phases', title: 'Распределение по фазам', hint: 'Нагрузка по фазам близка к расчётной (для трёхфазного ввода).' },
  { id: 'docs', title: 'Схема и протокол переданы заказчику', hint: 'Распечатаны схема щитка и протокол замеров.' }
];

export function progress(checks: Record<string, boolean> | undefined): { done: number; total: number } {
  const c = checks ?? {};
  return { done: CHECK_ITEMS.filter(i => c[i.id]).length, total: CHECK_ITEMS.length };
}
