import type { Calc, CfgN, Line, Row, SpecItem } from './types';
import { fmt, fs, pn } from './format';

export const SIP_S = [16, 25, 35, 50];
export const SIP_IZ = [100, 130, 160, 195];
export const SIP_RHO = 0.0328;
export const SIP_DROP_MAX = 2;
export const SIP_LEN_DEF = 20;
export const RZ_MAX = 30;
export const ZS_RURAL = 0.5;
export const GROUND_RODS = 3;
export const GROUND_ROD_M = 3;
export const GROUND_STEP_M = 3;
export const BOILER_RX = /котёл|котел|котла/i;

export interface Sip {
  S: number | null;
  cores: number;
  len: number;
  drop: number;
  name: string;
}

export interface House {
  sip: Sip;
  rz: number | null;
  rods: number;
  strip: number;
  outdoor: string[];
  boilers: string[];
  shared: string[];
}

const sipDrop = (c: CfgN, I: number, len: number, S: number): number =>
  c.supply === 3 ? Math.sqrt(3) * I * SIP_RHO * len / S / 400 * 100 : 2 * I * SIP_RHO * len / S / 230 * 100;

export function pickSip(c: CfgN, I: number, inIn: number | null, len: number): Sip {
  const cores = c.supply === 3 ? 4 : 2;
  const need = Math.max(inIn ?? 0, I);
  const i = SIP_S.findIndex((S, k) => SIP_IZ[k] >= need && sipDrop(c, I, len, S) <= SIP_DROP_MAX);
  const k = i >= 0 ? i : SIP_IZ.findIndex(z => z >= need);
  const S = k >= 0 ? SIP_S[k] : null;
  return { S, cores, len, drop: S ? sipDrop(c, I, len, S) : 0, name: S ? 'СИП-4 ' + cores + '×' + S : 'СИП-4 ' + cores + '×?' };
}

export const isOutdoor = (l: Line): boolean => !!l.out;
export const isBoiler = (l: Line): boolean => l.apps.some(a => BOILER_RX.test(a.name)) || BOILER_RX.test(l.name);

const noOf = (rows: Row[], x: Row): string => 'Г' + (rows.indexOf(x) + 1);

export function houseCalc(c: CfgN, rows: Row[], Itot: number, inIn: number | null): House {
  const live = rows.filter(x => !x.r.empty);
  const boilerRows = live.filter(x => isBoiler(x.l));
  return {
    sip: pickSip(c, Itot, inIn, c.sip),
    rz: c.rz,
    rods: GROUND_RODS,
    strip: (GROUND_RODS - 1) * GROUND_STEP_M,
    outdoor: live.filter(x => isOutdoor(x.l)).map(x => noOf(rows, x)),
    boilers: boilerRows.map(x => noOf(rows, x)),
    shared: boilerRows.filter(x => x.l.apps.filter(a => pn(a.w, 0) > 0).length > 1).map(x => noOf(rows, x))
  };
}

export function houseTips(l: Line, tips: string[]): void {
  if (isOutdoor(l)) tips.push('На улице: кабель в земле прокладывают в трубе ПНД на глубине не менее 0,7 м, под проездами не менее 1 м; розетки и светильники со степенью защиты не ниже IP44, розетки с крышкой.');
  if (isBoiler(l)) tips.push('Котёл: отдельная группа от щитка. Автоматике газового котла и циркуляционному насосу нужен стабилизатор или ИБП, электрокотлу свыше 6 кВт трёхфазный ввод.');
}

export interface HouseCheck {
  k: 'ok' | 'warn' | 'bad';
  t: string;
  fix?: 'net';
  groups?: string[];
}

export function houseChecks(a: Calc): HouseCheck[] {
  const h = a.house;
  if (!h) return [];
  const c = a.c;
  const out: HouseCheck[] = [];
  const ids = (nos: string[]): string[] => nos.map(n => a.rows[Number(n.slice(1)) - 1].l.id);
  if (a.inIn) {
    if (!h.sip.S) out.push({ k: 'bad', t: 'Ввод СИП не подобран: ток ввода ' + fmt(a.Itot, 0) + ' А больше допустимого для СИП-4 ' + SIP_S[SIP_S.length - 1] + ' мм². Нужен кабельный ввод по проекту.', fix: 'net' });
    else if (h.sip.len <= 0) out.push({ k: 'warn', t: 'Длина ввода СИП от опоры не задана: сечение ' + h.sip.name + ' выбрано только по току.', fix: 'net' });
    else out.push({ k: h.sip.drop > SIP_DROP_MAX ? 'warn' : 'ok', t: 'Ввод от опоры ' + h.sip.name + ' мм², ' + fs(h.sip.len) + ' м: потеря напряжения ' + fmt(h.sip.drop, 1) + ' %' + (h.sip.drop > SIP_DROP_MAX ? ', больше ' + SIP_DROP_MAX + ' %. Сократите ввод или согласуйте сечение с энергоснабжающей организацией.' : '. Ответвление от ВЛИ к дому не меньше 16 мм² по алюминию.'), ...(h.sip.drop > SIP_DROP_MAX ? { fix: 'net' as const } : {}) });
  }
  out.push({ k: 'ok', t: 'Система TN-C-S: PEN разделяется на PE и N в щите на вводе в дом, точка разделения присоединяется к повторному заземлению. После разделения N и PE не соединять (ТКП 339-2022).' });
  if (h.rz === null) out.push({ k: 'warn', t: 'Сопротивление повторного заземления не измерено. Контур из ' + h.rods + ' электродов по ' + GROUND_ROD_M + ' м обычно даёт до ' + RZ_MAX + ' Ом, но грунт бывает разный: внесите замер.', fix: 'net' });
  else if (h.rz > RZ_MAX) out.push({ k: 'bad', t: 'Повторное заземление ' + fs(h.rz) + ' Ом больше ' + RZ_MAX + ' Ом. Добавьте электроды или глубинный заземлитель и повторите замер.', fix: 'net' });
  else out.push({ k: 'ok', t: 'Повторное заземление ' + fs(h.rz) + ' Ом, не больше ' + RZ_MAX + ' Ом.' });
  if (!c.spd) out.push({ k: 'warn', t: 'Воздушный ввод без УЗИП. При грозе импульс приходит по линии: поставьте УЗИП тип 1+2 на вводе.', fix: 'net' });
  else out.push({ k: 'ok', t: 'УЗИП тип 1+2 на воздушном вводе защищает от грозовых импульсов с линии.' });
  if (c.zs < ZS_RURAL) out.push({ k: 'warn', t: 'Петля сети ' + fmt(c.zs, 2) + ' Ом взята как для городского дома. У частного дома на ВЛ петля обычно 0,6–1,2 Ом: измерьте на вводе, иначе проверка отключения КЗ будет оптимистичной.', fix: 'net' });
  const outRows = a.rows.filter(x => !x.r.empty && isOutdoor(x.l));
  const bare = outRows.filter(x => !x.r.rcd);
  if (bare.length) out.push({ k: 'bad', t: 'Уличные группы без УЗО: ' + bare.map(x => noOf(a.rows, x)).join(', ') + '. Розетки и освещение на улице защищают УЗО 30 мА.', groups: bare.map(x => x.l.id) });
  else if (outRows.length) out.push({ k: 'ok', t: 'Уличные группы ' + h.outdoor.join(', ') + ' защищены УЗО ' + Math.max(...outRows.map(x => x.r.ma)) + ' мА.' });
  if (h.shared.length) out.push({ k: 'warn', t: 'Котёл на общей группе с другими приборами: ' + h.shared.join(', ') + '. Выделите котлу отдельную группу, чтобы отключение соседнего прибора не оставило дом без отопления.', groups: ids(h.shared) });
  return out;
}

export function houseSpec(a: Calc): SpecItem[] {
  const h = a.house;
  if (!h) return [];
  const items: SpecItem[] = [];
  const sipM = h.sip.len > 0 ? Math.ceil(h.sip.len * 1.05) : null;
  items.push({ name: h.sip.name + (h.sip.S ? ' мм²' : ''), qty: sipM ? sipM + ' м' : 'по месту', note: 'ввод от опоры; запас 5 % на провис', n: sipM, unit: 'м' });
  items.push({ name: 'Зажим анкерный для СИП', qty: '2 шт', note: 'на опоре и на стене дома', n: 2, unit: 'шт' });
  items.push({ name: 'Зажим прокалывающий для СИП', qty: h.sip.cores + ' шт', note: 'ответвление от ВЛИ, по одному на жилу', n: h.sip.cores, unit: 'шт' });
  items.push({ name: 'Перемычка разделения PEN на шинах PE и N', qty: '1 шт', note: 'в щите на вводе в дом', n: 1, unit: 'шт' });
  items.push({ name: 'Главная заземляющая шина (ГЗШ)', qty: '1 шт', note: 'к ней контур, PE щитка и металлические трубы', n: 1, unit: 'шт' });
  items.push({ name: 'Электрод заземления, уголок 50×50×5, ' + GROUND_ROD_M + ' м', qty: h.rods + ' шт', note: 'шаг ' + GROUND_STEP_M + ' м, верх на глубине 0,5–0,7 м', n: h.rods, unit: 'шт' });
  items.push({ name: 'Полоса стальная оцинкованная 40×4', qty: h.strip + ' м + до дома', note: 'связь электродов и ввод к ГЗШ', n: null, unit: 'м' });
  return items;
}
