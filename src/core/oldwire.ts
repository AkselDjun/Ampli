import type { Calc, OldSign, OldWiring } from './types';
import { STD } from './norms';
import { fmt, fs, plural, pn } from './format';

export type OldKey = Exclude<keyof OldWiring, 'signs'>;

export const OLD_SIGNS: [OldSign, string][] = [
  ['heat', 'Потемнение, оплавление у розеток и в коробках'],
  ['crumble', 'Изоляция крошится или трескается'],
  ['twist', 'Скрутки меди с алюминием'],
  ['trip', 'Пробки или автоматы срабатывают без причины']
];

export const OLD_EMPTY: OldWiring = { metal: '', sec: 0, pe: '', net: '', panel: '', ins: '', age: '', signs: [] };

const pick = <T extends string>(v: unknown, ok: readonly T[]): T | '' => (ok as readonly unknown[]).includes(v) ? (v as T) : '';

export function normOld(o: unknown): OldWiring {
  const x = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const sec = pn(x.sec, 0);
  const num = (v: unknown, max: number): string => {
    const n = pn(v, NaN);
    return isFinite(n) && n >= 0 && n <= max ? String(v).trim().slice(0, 8) : '';
  };
  return {
    metal: pick(x.metal, ['cu', 'al'] as const),
    sec: [1.5, 2.5, 4, 6].includes(sec) ? sec : 0,
    pe: pick(x.pe, ['yes', 'no', 'jumper'] as const),
    net: pick(x.net, ['tncs', 'tnc'] as const),
    panel: pick(x.panel, ['fuse', 'old', 'mod'] as const),
    ins: num(x.ins, 10000),
    age: num(x.age, 120),
    signs: Array.isArray(x.signs) ? OLD_SIGNS.map(s => s[0]).filter(k => (x.signs as unknown[]).includes(k)) : []
  };
}

export const oldStarted = (o: OldWiring | undefined): boolean => !!o && (!!o.metal || !!o.pe || !!o.net || !!o.panel || !!o.sec || o.ins !== '' || o.age !== '' || o.signs.length > 0);

const CU: Record<number, number> = { 1.5: 18, 2.5: 25, 4: 32, 6: 40 };
const AL: Record<number, number> = { 2.5: 19, 4: 25, 6: 31 };

export const oldAmp = (metal: 'cu' | 'al', sec: number): number => (metal === 'cu' ? CU[sec] : AL[sec]) ?? 0;
export const oldMaxBreaker = (metal: 'cu' | 'al', sec: number): number => STD.filter(i => i <= oldAmp(metal, sec)).pop() ?? 0;

export type Lvl = 'ok' | 'warn' | 'bad';

export interface Finding {
  id: string;
  k: Lvl;
  title: string;
  text: string;
  ref: string;
  practice?: boolean;
}

export interface GroupFit {
  no: string;
  name: string;
  In: number;
  need: number;
  fit: boolean;
}

export interface OldVerdict {
  status: Lvl | 'none';
  label: string;
  findings: Finding[];
  groups: GroupFit[];
}

export const OLD_LABEL: Record<Lvl | 'none', string> = { none: 'Не обследована', ok: 'Можно оставить', warn: 'Оставить с условиями', bad: 'Заменить' };

export function oldGroups(o: OldWiring, a: Calc): GroupFit[] {
  if (!o.metal || !o.sec) return [];
  const max = oldMaxBreaker(o.metal, o.sec);
  return a.rows
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => !x.r.empty && x.r.In)
    .map(({ x, i }) => ({ no: 'Г' + (i + 1), name: x.l.name || 'Без названия', In: x.r.In as number, need: x.r.S as number, fit: max > 0 && (x.r.In as number) <= max && (o.metal === 'al' || o.sec >= (x.r.S as number)) }));
}

export function oldVerdict(o: OldWiring | undefined, a: Calc): OldVerdict {
  const w = o ?? OLD_EMPTY;
  const f: Finding[] = [];
  if (!oldStarted(w)) return { status: 'none', label: OLD_LABEL.none, findings: [], groups: [] };
  if (w.pe === 'jumper') {
    f.push({ id: 'jumper', k: 'bad', title: 'Перемычка N и PE в розетках', text: 'Защитный контакт розетки соединён с нулём. При обрыве нуля на корпусе прибора появится фазное напряжение, а УЗО с такой перемычкой работать не будет. Перемычки убрать.', ref: 'ТКП 339-2022, п. 4.3.15.2; СН 4.04.01-2019, п. 16.3.11' });
  }
  if (w.pe === 'no' || w.pe === 'jumper') {
    f.push({ id: 'nope', k: 'warn', title: 'Двухпроводная сеть без PE', text: 'Для действующего жилого фонда с двухпроводными группами без PE установка УЗО обязательна. До замены проводки: УЗО 30 мА на группы, ноль в зоне УЗО не соединять с PE и заземлёнными частями. При ремонте группы заменить на трёхжильные.', ref: 'СН 4.04.01-2019, п. 16.3.3, п. 16.3.11' });
  }
  if (w.pe === 'yes') f.push({ id: 'pe', k: 'ok', title: 'Есть отдельный PE', text: 'Группы трёхпроводные, N и PE разделены.', ref: 'ТКП 339-2022, п. 4.3.15.5' });
  if (w.net === 'tnc') {
    f.push({ id: 'tnc', k: 'warn', title: 'В этажном щите PEN (TN-C)', text: 'Отдельного PE в стояке нет. В существующей установке шину PE квартирного щитка присоединяют к PEN до УЗО, после разделения N и PE не объединяют. Реконструкцию стояка с переходом на TN-C-S согласуйте с обслуживающей организацией.', ref: 'ТКП 339-2022, п. 4.3.5.5, п. 4.3.15.5' });
  }
  if (w.net === 'tncs') f.push({ id: 'tncs', k: 'ok', title: 'В этажном щите есть PE (TN-C-S)', text: 'Шину PE квартирного щитка подключают к PE этажного щита.', ref: 'ТКП 339-2022, п. 4.3.15.5' });
  if (w.metal === 'al') {
    const small = w.sec > 0 && w.sec < 2.5;
    f.push({ id: 'al', k: small ? 'bad' : 'warn', title: small ? 'Алюминий сечением меньше 2,5 мм²' : 'Алюминиевые жилы', text: small ? 'Минимальное сечение алюминиевой жилы стационарной проводки 2,5 мм². Линии заменить на медь.' : 'Алюминий допускается от 2,5 мм², но зажимы автоматов, розеток и клемм должны быть рассчитаны на алюминий. Обычные модульные аппараты рассчитаны на медь: подключайте через переходные клеммы с пастой.', ref: 'ГОСТ 30331.15-2001, табл. 52J и примечание 1' });
  }
  if (w.metal && w.sec) {
    const max = oldMaxBreaker(w.metal, w.sec);
    f.push({ id: 'amp', k: 'ok', title: 'Допустимый ток ' + (w.metal === 'al' ? 'алюминия' : 'меди') + ' ' + fs(w.sec) + ' мм²', text: 'Скрытая прокладка двухжильным проводом: до ' + oldAmp(w.metal, w.sec) + ' А, автомат не больше ' + max + ' А.', ref: 'ПУЭ, табл. ' + (w.metal === 'al' ? '1.3.5' : '1.3.4') });
  }
  const ins = w.ins === '' ? null : pn(w.ins, 0);
  if (ins === null) f.push({ id: 'ins', k: 'warn', title: 'Изоляция не измерена', text: 'Измерьте сопротивление изоляции каждой линии мегаомметром на 1000 В между каждым проводом и землёй и между проводами при отключённых приборах.', ref: 'ТКП 339-2022, п. 4.4.26.1, табл. 4.4.46' });
  else if (ins < 0.5) f.push({ id: 'ins', k: 'bad', title: 'Изоляция ' + fmt(ins, 2) + ' МОм', text: 'Меньше 0,5 МОм: линию нельзя оставлять в работе, найти повреждение или заменить.', ref: 'ТКП 339-2022, п. 4.4.26.1, табл. 4.4.46' });
  else f.push({ id: 'ins', k: 'ok', title: 'Изоляция ' + fmt(ins, 2) + ' МОм', text: 'Не меньше 0,5 МОм.', ref: 'ТКП 339-2022, п. 4.4.26.1, табл. 4.4.46' });
  if (w.signs.length) {
    const names = OLD_SIGNS.filter(s => w.signs.includes(s[0])).map(s => s[1].toLowerCase());
    f.push({ id: 'signs', k: 'bad', title: 'Признаки перегрева и износа', text: names.join('; ').replace(/^./, ch => ch.toUpperCase()) + '. Такие участки и соединения заменяют, скрутки меди с алюминием переделывают через переходные клеммы.', ref: '', practice: true });
  }
  const age = w.age === '' ? null : pn(w.age, 0);
  if (age !== null && age >= (w.metal === 'al' ? 25 : 30)) {
    f.push({ id: 'age', k: 'warn', title: 'Проводке ' + fmt(age, 0) + ' ' + plural(Math.round(age), ['год', 'года', 'лет']), text: 'Норма срока службы не задаёт. При таком возрасте изоляция обычно теряет эластичность, решение принимайте по замеру изоляции и осмотру.', ref: '', practice: true });
  }
  if (w.panel === 'fuse') f.push({ id: 'panel', k: 'bad', title: 'Щиток с пробками', text: 'Защиту групп и УЗО на пробках не выполнить. Щиток заменить на модульный по расчёту.', ref: 'СН 4.04.01-2019, п. 16.3.3' });
  if (w.panel === 'old') f.push({ id: 'panel', k: 'warn', title: 'Старые автоматы без УЗО', text: 'Добавить УЗО или заменить на модульный щиток по расчёту, аппараты подобрать по сечению старых линий.', ref: 'СН 4.04.01-2019, п. 16.3.3' });
  if (w.panel === 'mod') f.push({ id: 'panel', k: 'ok', title: 'Модульный щиток', text: 'Корпус можно использовать, если хватает модулей.', ref: '', practice: true });
  const groups = oldGroups(w, a);
  const bad = groups.filter(g => !g.fit);
  if (bad.length) {
    f.push({ id: 'groups', k: 'bad', title: bad.length + ' ' + plural(bad.length, ['группа не подходит', 'группы не подходят', 'групп не подходят']) + ' для старой линии', text: 'Расчётный автомат или сечение больше, чем выдержит старая проводка: ' + bad.map(g => g.no).join(', ') + '. Эти линии проложить заново.', ref: 'ПУЭ, табл. ' + (w.metal === 'al' ? '1.3.5' : '1.3.4') });
  }
  const status: Lvl = f.some(x => x.k === 'bad') ? 'bad' : (f.some(x => x.k === 'warn') ? 'warn' : 'ok');
  return { status, label: OLD_LABEL[status], findings: f, groups };
}
