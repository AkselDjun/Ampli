import type { Num, SpecItem } from './types';
import { nid } from './ids';
import { fmt, fs, plural, pn } from './format';

export type FloorSys = 'mat' | 'cable' | 'film';
export type FloorUse = 'bath' | 'kitchen' | 'room' | 'loggia';

export interface FloorRoom {
  id: string;
  name: string;
  use: FloorUse;
  sys: FloorSys;
  area: Num;
  wpm: Num;
}

export const FLOOR_USES: Record<FloorUse, { label: string; wpm: number; name: string }> = {
  bath: { label: 'Ванная, санузел', wpm: 150, name: 'Ванная' },
  kitchen: { label: 'Кухня, прихожая', wpm: 130, name: 'Кухня' },
  room: { label: 'Жилая комната', wpm: 120, name: 'Комната' },
  loggia: { label: 'Утеплённая лоджия', wpm: 180, name: 'Лоджия' }
};

export const FLOOR_SYS: Record<FloorSys, { label: string; hint: string }> = {
  mat: { label: 'Мат под плитку', hint: 'в клей под плитку, 150 Вт/м²' },
  cable: { label: 'Кабель в стяжку', hint: 'в стяжку 3–5 см' },
  film: { label: 'Плёнка под ламинат', hint: 'инфракрасная плёнка под ламинат или линолеум' }
};

export const USE_KEYS = Object.keys(FLOOR_USES) as FloorUse[];
export const SYS_KEYS = Object.keys(FLOOR_SYS) as FloorSys[];
export const MAT_WPM = 150;
export const CABLE_WPM_M = 18;
export const FILM_WPM = [150, 220];
export const THERMO_A = 16;
export const MATS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 15];
export const CABLES = [150, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500, 1800, 2000, 2500, 3000];
export const UZO_REF = 'СН 4.04.01-2019 п.16.3.3';
export const BATH_REF = 'ГОСТ 30331.11 п.701.55';
export const CONTACTORS = [25, 40, 63];

const isUse = (v: unknown): v is FloorUse => typeof v === 'string' && v in FLOOR_USES;
const isSys = (v: unknown): v is FloorSys => typeof v === 'string' && v in FLOOR_SYS;

export const defaultWpm = (use: FloorUse, sys: FloorSys): number => (sys === 'mat' ? MAT_WPM : sys === 'film' ? (FLOOR_USES[use].wpm > 150 ? 220 : 150) : FLOOR_USES[use].wpm);

export function newFloorRoom(use: FloorUse = 'bath', name?: string): FloorRoom {
  const sys: FloorSys = use === 'room' ? 'film' : use === 'loggia' ? 'cable' : 'mat';
  return { id: nid(), name: name ?? FLOOR_USES[use].name, use, sys, area: '', wpm: defaultWpm(use, sys) };
}

export function normFloor(o: unknown): FloorRoom[] {
  if (!Array.isArray(o)) return [];
  return o
    .filter(r => r && typeof r === 'object')
    .slice(0, 20)
    .map(r => {
      const x = r as Record<string, unknown>;
      const use = isUse(x.use) ? x.use : 'bath';
      const sys = isSys(x.sys) ? x.sys : 'mat';
      const num = (v: unknown, d: Num): Num => (typeof v === 'number' || typeof v === 'string' ? String(v).slice(0, 8) : d);
      return { id: nid(), name: String(x.name ?? FLOOR_USES[use].name).slice(0, 40), use, sys, area: num(x.area, ''), wpm: sys === 'mat' ? MAT_WPM : num(x.wpm, defaultWpm(use, sys)) };
    });
}

export interface FloorNote {
  k: 'ok' | 'warn' | 'bad';
  text: string;
  ref: string;
}

export interface FloorResult {
  ok: boolean;
  area: number;
  wpm: number;
  watts: number;
  amps: number;
  product: string;
  size: string;
  len: number;
  step: number;
  parts: number[];
  contactor: number;
  notes: FloorNote[];
}

const down = (list: number[], v: number): number => {
  let best = 0;
  list.forEach(x => { if (x <= v + 1e-9) best = x; });
  return best;
};

export function floorCalc(r: FloorRoom): FloorResult {
  const area = Math.max(0, pn(r.area, 0));
  const wpmIn = r.sys === 'mat' ? MAT_WPM : Math.max(0, pn(r.wpm, 0));
  const notes: FloorNote[] = [];
  let watts = 0;
  let product = '';
  let size = '';
  let len = 0;
  let step = 0;
  let parts: number[] = [];
  if (area > 0 && wpmIn > 0) {
    if (r.sys === 'mat') {
      let rest = area;
      while (rest >= MATS[0] - 1e-9 && parts.length < 4) {
        const m = down(MATS, rest);
        parts.push(m);
        rest = Math.round((rest - m) * 100) / 100;
      }
      const m = parts.reduce((s, x) => s + x, 0);
      watts = m * MAT_WPM;
      product = 'Нагревательный мат ' + MAT_WPM + ' Вт/м²';
      size = parts.map(x => fs(x) + ' м²').join(' + ');
      if (!m) notes.push({ k: 'bad', text: 'Площадь меньше самого маленького мата ' + fs(MATS[0]) + ' м².', ref: '' });
      else {
        if (parts.length > 1) notes.push({ k: 'ok', text: 'Площадь больше самого большого мата, нужно ' + parts.length + ' ' + plural(parts.length, ['мат', 'мата', 'матов']) + ', подключаются параллельно к одному терморегулятору.', ref: 'практика' });
        if (m < area - 0.25) notes.push({ k: 'ok', text: 'Маты на ' + fs(m) + ' м² из ' + fs(area) + ' м² свободного пола: нагревательную жилу резать нельзя, берётся ближайший меньший размер.', ref: 'практика' });
      }
    } else if (r.sys === 'cable') {
      const target = area * wpmIn;
      const max = CABLES[CABLES.length - 1];
      const k = Math.max(1, Math.ceil((target * 1.1) / max));
      const stepOf = (p: number): number => (area / (k * Math.round(p / CABLE_WPM_M))) * 100;
      const fit = CABLES.filter(p => stepOf(p) >= 7 && stepOf(p) <= 15 && Math.abs(k * p - target) <= target * 0.35);
      const p = fit.length ? fit.reduce((b, x) => (Math.abs(k * x - target) < Math.abs(k * b - target) ? x : b)) : down(CABLES, (target * 1.1) / k) || CABLES[0];
      const one = Math.round(p / CABLE_WPM_M);
      parts = Array(k).fill(p);
      watts = k * p;
      len = k * one;
      step = len > 0 ? Math.round((area / len) * 1000) / 10 : 0;
      product = 'Нагревательный кабель ' + CABLE_WPM_M + ' Вт/м';
      size = k > 1 ? k + ' × ' + fmt(p, 0) + ' Вт, ' + k + ' × ' + one + ' м' : fmt(p, 0) + ' Вт, ' + one + ' м';
      if (k > 1) notes.push({ k: 'ok', text: 'Мощность больше самой большой секции ' + fmt(max, 0) + ' Вт, нужно ' + k + ' ' + plural(k, ['секция', 'секции', 'секций']) + '.', ref: 'практика' });
      if (step < 7) notes.push({ k: 'warn', text: 'Шаг укладки ' + fmt(step, 1) + ' см, меньше 7 см: кабель будет перегреваться. Возьмите секцию меньше.', ref: 'практика' });
      else if (step > 15) notes.push({ k: 'warn', text: 'Шаг укладки ' + fmt(step, 1) + ' см, больше 15 см: пол прогреется полосами. Возьмите секцию больше.', ref: 'практика' });
      else notes.push({ k: 'ok', text: 'Шаг укладки ' + fmt(step, 1) + ' см.', ref: 'практика' });
    } else {
      const wpm = FILM_WPM.includes(wpmIn) ? wpmIn : wpmIn > 185 ? 220 : 150;
      watts = Math.round(area * wpm);
      len = Math.ceil(area / 0.5 * 10) / 10;
      product = 'Инфракрасная плёнка ' + wpm + ' Вт/м², ширина 0,5 м';
      size = fs(len) + ' м';
    }
  }
  const ok = watts > 0;
  const amps = watts / 230;
  const contactor = amps > THERMO_A ? CONTACTORS.find(x => x >= amps * 1.1) ?? CONTACTORS[CONTACTORS.length - 1] : 0;
  if (ok) {
    notes.push({ k: 'ok', text: 'Защита УЗО обязательна, она уже есть у всех групп щитка.', ref: UZO_REF });
    notes.push(amps > THERMO_A ? { k: 'warn', text: 'Ток ' + fmt(amps, 1) + ' А больше ' + THERMO_A + ' А терморегулятора: подключайте через контактор или разделите на два регулятора.', ref: 'паспорт терморегулятора' } : { k: 'ok', text: 'Терморегулятор с датчиком пола на ' + THERMO_A + ' А, ток ' + fmt(amps, 1) + ' А.', ref: 'паспорт терморегулятора' });
    if (r.use === 'bath') notes.push({ k: r.sys === 'film' ? 'bad' : 'warn', text: r.sys === 'film' ? 'Плёнку в ванной не применяют, нужен мат или кабель с экраном.' : 'В полу ванной только кабель или мат с металлическим экраном, экран присоединяется к PE.', ref: BATH_REF });
    if (r.sys === 'film' && r.use !== 'bath') notes.push({ k: 'ok', text: 'Плёнку под мебелью без ножек не укладывают, площадь считайте только свободную.', ref: 'практика' });
  }
  return { ok, area, wpm: area > 0 && ok ? watts / area : 0, watts, amps, product, size, len, step, parts, contactor, notes };
}

export const floorAppName = (r: FloorRoom): string => 'Тёплый пол (' + (r.name.trim() || FLOOR_USES[r.use].name) + ')';

export function floorSpec(rooms: FloorRoom[]): SpecItem[] {
  const items: SpecItem[] = [];
  const res = rooms.map(r => ({ r, x: floorCalc(r) })).filter(o => o.x.ok);
  res.forEach(({ r, x }) => {
    const where = r.name.trim() || FLOOR_USES[r.use].name;
    if (r.sys === 'film') items.push({ name: x.product, qty: fs(x.len) + ' м', note: where + ', ' + fmt(x.watts, 0) + ' Вт', n: x.len, unit: 'м' });
    else {
      const by = new Map<number, number>();
      x.parts.forEach(v => by.set(v, (by.get(v) ?? 0) + 1));
      by.forEach((n, v) => items.push({ name: x.product + ' ' + (r.sys === 'mat' ? fs(v) + ' м²' : fmt(v, 0) + ' Вт, ' + Math.round(v / CABLE_WPM_M) + ' м'), qty: n + ' шт', note: where + ', ' + fmt(x.watts, 0) + ' Вт', n, unit: 'шт' }));
    }
    if (x.contactor) items.push({ name: 'Контактор модульный 2P ' + x.contactor + ' А', qty: '1 шт', note: where + ': ток ' + fmt(x.amps, 1) + ' А больше ' + THERMO_A + ' А терморегулятора', n: 1, unit: 'шт' });
  });
  if (res.length) {
    items.push({ name: 'Терморегулятор с датчиком температуры пола, ' + THERMO_A + ' А', qty: res.length + ' шт', note: 'по одному на помещение', n: res.length, unit: 'шт' });
    items.push({ name: 'Гофротрубка 16 мм для датчика пола', qty: res.length * 2 + ' м', note: 'по 2 м на датчик', n: res.length * 2, unit: 'м' });
    const film = res.filter(o => o.r.sys === 'film');
    if (film.length) {
      const m2 = Math.ceil(film.reduce((s, o) => s + o.x.area, 0));
      items.push({ name: 'Теплоотражающая подложка под плёнку', qty: m2 + ' м²', note: 'под всю площадь плёнки', n: m2, unit: 'м²' });
    }
  }
  return items;
}

export const floorArea = (rooms: FloorRoom[] | undefined): number => (rooms ?? []).reduce((s, r) => { const x = floorCalc(r); return s + (x.ok ? x.area : 0); }, 0);

export const floorSummary = (rooms: FloorRoom[] | undefined): string => {
  const ok = (rooms ?? []).map(floorCalc).filter(x => x.ok);
  return ok.length ? ok.length + ' ' + plural(ok.length, ['помещение', 'помещения', 'помещений']) + ', ' + fmt(ok.reduce((s, x) => s + x.watts, 0), 0) + ' Вт' : '';
};
