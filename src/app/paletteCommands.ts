import type { Dispatch } from 'react';
import type { Calc, LineType, Project } from '../core/types';
import { TYPES } from '../core/norms';
import type { Action } from '../store/reducer';
import type { Cmd } from '../ui/Palette';
import type { PrintMode } from '../ui/WorkSheet';
import { setTheme } from '../ui/theme';
import { toastOk } from '../ui/toast';
import { APP_SHEET } from './types';
import type { AppSheet, SheetId } from './types';

export interface PaletteDeps {
  p: Project;
  a: Calc;
  dispatch: Dispatch<Action>;
  setSheet: (sheet: SheetId) => void;
  openSheet: (sheet: AppSheet, tab?: string) => void;
  pick: (id: string) => void;
  addGroup: (type: LineType) => void;
  doPrint: (mode?: PrintMode | PrintMode[]) => void;
}

export function paletteCommands({ p, a, dispatch, setSheet, openSheet, pick, addGroup, doPrint }: PaletteDeps): Cmd[] {
  return [
    ...p.lines.map((l, i) => ({ id: 'g' + l.id, group: 'Группы', label: 'Г' + (i + 1) + ' ' + (l.name || 'Без названия'), hint: l.zone?.trim() || TYPES[l.type].short, words: 'группа', late: true, run: () => { setSheet(null); pick(l.id); } })),
    { id: 'add-l', group: 'Добавить', label: 'Добавить группу освещения', words: 'свет новая', run: () => addGroup('light') },
    { id: 'add-s', group: 'Добавить', label: 'Добавить розеточную группу', words: 'розетки новая', run: () => addGroup('socket') },
    { id: 'add-p', group: 'Добавить', label: 'Добавить мощный прибор', words: 'плита бойлер новая группа', run: () => addGroup('power') },
    { id: 'rooms', group: 'Добавить', label: 'Собрать группы из комнат', words: 'комнаты', run: () => setSheet(APP_SHEET.ROOMS) },
    { id: 'floor', group: 'Добавить', label: 'Тёплый пол', words: 'нагревательный мат кабель плёнка терморегулятор обогрев', run: () => setSheet(APP_SHEET.FLOOR) },
    { id: 'weak', group: 'Добавить', label: 'Слаботочка: интернет, ТВ, камеры', words: 'utp rj45 lan телевидение домофон коаксиальный роутер коммутатор', run: () => setSheet(APP_SHEET.WEAK) },
    { id: 'rep', group: 'Документы', label: 'Отчёт и спецификация', words: 'отчет', run: () => openSheet(APP_SHEET.REPORT, 'groups') },
    { id: 'est', group: 'Документы', label: 'Смета: работы и материалы', words: 'цены стоимость клиент', run: () => openSheet(APP_SHEET.REPORT, 'estimate') },
    { id: 'scheme', group: 'Документы', label: 'Однолинейная схема', words: 'схема', run: () => openSheet(APP_SHEET.REPORT, 'scheme') },
    { id: 'print', group: 'Документы', label: 'Печать отчёта в PDF', words: 'pdf распечатать', run: () => doPrint('report') },
    { id: 'shop', group: 'Документы', label: 'Где купить', words: 'магазин прайс закупка', run: () => setSheet(APP_SHEET.SHOP) },
    { id: 'cmp', group: 'Документы', label: 'Сравнить варианты', words: 'что если', run: () => setSheet(APP_SHEET.COMPARE) },
    { id: 'work', group: 'Монтаж', label: 'Приёмка', words: 'монтаж чек-лист протокол паспорт', run: () => setSheet(APP_SHEET.WORK) },
    { id: 'panel', group: 'Монтаж', label: 'Замеры на щитке', words: 'режим на щитке протокол петля изоляция узо', run: () => openSheet(APP_SHEET.WORK, 'meas') },
    { id: 'proto', group: 'Монтаж', label: 'Печать протокола замеров', words: 'pdf', run: () => doPrint('proto') },
    { id: 'pass', group: 'Монтаж', label: 'Печать паспорта для владельца', words: 'pdf', run: () => doPrint('passport') },
    { id: 'hidden', group: 'Монтаж', label: 'Печать акта скрытых работ', words: 'pdf освидетельствование штробы', run: () => doPrint('hidden') },
    { id: 'accept', group: 'Монтаж', label: 'Печать акта приёмки работ', words: 'pdf сдача гарантия', run: () => doPrint('accept') },
    { id: 'a3', group: 'Документы', label: 'Печать схемы A3 по ГОСТ', words: 'pdf чертёж однолинейная штамп', run: () => doPrint('a3') },
    { id: 'net', group: 'Проект', label: 'Параметры сети', words: 'фазы ввод мощность прокладка', run: () => setSheet(APP_SHEET.NETWORK) },
    { id: 'old', group: 'Проект', label: 'Старая проводка', words: 'алюминий обследование заземление зануление pe tn-c', run: () => setSheet(APP_SHEET.OLD_WIRING) },
    { id: 'proj', group: 'Проект', label: 'Проекты', words: 'открыть новый файл ссылка', run: () => setSheet(APP_SHEET.PROJECTS) },
    { id: 'lib', group: 'Проект', label: 'Мои данные', words: 'реквизиты шаблоны цены логотип тема оформление', run: () => setSheet(APP_SHEET.LIBRARY) },
    { id: 'th-dark', group: 'Вид', label: 'Тёмная тема', words: 'тема оформление ночь', run: () => setTheme('dark') },
    { id: 'th-light', group: 'Вид', label: 'Светлая тема', words: 'тема оформление день', run: () => setTheme('light') },
    { id: 'th-auto', group: 'Вид', label: 'Тема: авто', words: 'тема оформление как в системе', run: () => setTheme('auto') },
    ...(a.phases ? [{ id: 'bal', group: 'Проект', label: 'Выровнять нагрузку по фазам', words: 'фазы', run: () => { dispatch({ t: 'balance' }); toastOk('Фазы выровнены'); } }] : [])
  ];
}
