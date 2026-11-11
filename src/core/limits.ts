import { pn } from './format';
import { CLIMITS } from './norms';

export const LINE_MAX: Record<string, number> = { len: 500, sockets: 99, perSocket: 10000 };
export const APP_MAX: Record<string, number> = { w: 100000, n: 999, m: 100, br: 200, cos: 1 };
export const MEAS_MAX = 100000;
export const MAX_LINES = 500;
export const MAX_APPS = 200;
export const MAX_ROOMS = 100;
export const MAX_CHECKS = 500;
export const MAX_PROJECTS = 500;
export const ROOM_SPLIT_MAX = 20;

export function numIn<T>(v: T, max: number): T | string | number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
  if (typeof v !== 'string') return v;
  const t = v.replace(/[^\d.,]/g, '').replace(/^([^.,]*[.,][^.,]*)[.,].*$/, '$1');
  const x = pn(t, NaN);
  return Number.isFinite(x) && x > max ? String(max) : t;
}

export function numField(v: unknown, max: number, d: number | string = ''): number | string {
  if (typeof v === 'number' || typeof v === 'string') return numIn(typeof v === 'string' ? v.slice(0, 12) : v, max) as number | string;
  return d;
}

export interface Bound {
  min: number;
  max: number;
  u: string;
  why: string;
  int?: boolean;
  pos?: boolean;
  low?: string;
}

export interface FieldErr {
  msg: string;
  hard: boolean;
}

export const BOUNDS = {
  len: { min: 0, pos: true, max: 300, u: 'м', low: 'без длины не посчитать потерю напряжения и петлю фаза-нуль', why: 'групповая линия такой длины в квартире и доме не встречается, проверьте, что длина в метрах' },
  sockets: { min: 0, int: true, max: 30, u: 'шт', why: 'столько розеток на одну группу не ставят, разделите её на несколько групп' },
  perSocket: { min: 0, max: 3680, u: 'Вт', why: 'розетка на 16 А при 230 В выдерживает не больше 3680 Вт' },
  w: { min: 0, max: 30000, u: 'Вт', why: 'бытовой прибор такой мощности не встречается, проверьте, что мощность в ваттах, а не в милливаттах' },
  wpm: { min: 0, max: 40, u: 'Вт/м', why: 'метр бытовой светодиодной ленты потребляет меньше, проверьте, что указан метр, а не вся лента' },
  m: { min: 0, pos: true, max: 100, u: 'м', low: 'укажите длину ленты', why: 'столько ленты от одной группы не подключают' },
  n: { min: 1, int: true, max: 999, u: 'шт', low: 'чтобы убрать прибор, удалите строку', why: 'столько одинаковых приборов на одной группе не бывает' },
  br: { min: 0, max: 50, u: 'м', why: 'отвод от коробки такой длины не встречается, возможно, это длина всей линии' },
  cos: { min: 0.3, max: 1, u: '', low: 'у бытовых приборов cos φ не ниже 0,3, иначе расчёт возьмёт значение по умолчанию', why: 'cos φ не бывает больше 1' },
  zs: { min: 0, pos: true, max: 20, u: 'Ом', low: 'нулевой петли не бывает, проверьте подключение прибора', why: 'такая петля в жилой проводке означает обрыв или ошибку замера, повторите замер' },
  ins: { min: 0, max: 10000, u: 'МОм', why: 'проверьте единицы, сопротивление изоляции вносится в мегаомах' },
  leak: { min: 0, max: 100, u: 'мА', why: 'при такой утечке отключится любое УЗО на 30 и 100 мА, проверьте единицы' },
  rcd: { min: 0, pos: true, max: 1000, u: 'мс', low: 'УЗО не отключается мгновенно, проверьте замер', why: 'УЗО с таким временем считается несработавшим, проверьте тестер и УЗО' },
  alloc: { min: 1, max: 100, u: 'кВт', why: 'квартире и частному дому столько не выделяют, проверьте, что мощность в киловаттах' },
  sip: { min: 0, max: 100, u: 'м', why: 'ответвление от опоры такой длины не делают, ставят дополнительную опору' },
  area: { min: 0, pos: true, max: 200, u: 'м²', low: 'укажите свободную площадь пола', why: 'тёплый пол такой площади делят на несколько помещений' },
  floorWpm: { min: 0, pos: true, max: 250, u: 'Вт/м²', low: 'укажите мощность на квадратный метр', why: 'тёплый пол такой мощности не применяют, обычно 120–220 Вт/м²' },
  wkN: { min: 1, int: true, max: 99, u: 'шт', why: 'столько розеток в одной точке не бывает' },
  price: { min: 0, max: 100000, u: 'р.', why: 'проверьте запятую' },
  rate: { min: 0, max: 10000, u: 'р.', why: 'проверьте запятую' }
} satisfies Record<string, Bound>;

export type BoundKey = keyof typeof BOUNDS;

const num = (x: number): string => {
  const t = String(Math.round(x * 100) / 100).replace('.', ',');
  return Math.abs(x) >= 10000 ? t.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : t;
};

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

export const asLabel = (label: string, e: FieldErr): FieldErr => ({ ...e, msg: label + ': ' + e.msg.charAt(0).toLowerCase() + e.msg.slice(1) });

export function rangeErr(v: unknown, b: Bound): FieldErr | null {
  const t = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  const x = pn(t, NaN);
  const u = b.u ? ' ' + b.u : '';
  if (!Number.isFinite(x) || !/\d/.test(t)) return { msg: 'Введите число', hard: false };
  if (x > b.max) return { msg: 'Не больше ' + num(b.max) + u + '. ' + cap(b.why), hard: true };
  if (b.int && !Number.isInteger(x)) return { msg: 'Только целое число', hard: true };
  if (x < b.min || (b.pos && x <= 0)) return { msg: (b.pos ? 'Больше ' : 'Не меньше ') + num(b.min) + u + (b.low ? '. ' + cap(b.low) : ''), hard: false };
  return null;
}

export const fieldErr = (k: BoundKey, v: unknown): FieldErr | null => rangeErr(v, BOUNDS[k]);

const CFG_U: Record<string, string> = { zs: 'Ом', rz: 'Ом', feeder: '%' };

export function cfgErr(k: string, v: unknown): FieldErr | null {
  if (k === 'alloc' || k === 'sip') return fieldErr(k, v);
  const lim = CLIMITS[k];
  if (!lim) return null;
  const u = CFG_U[k] ?? '';
  const why = 'расчёт принимает значения от ' + num(lim[0]) + ' до ' + num(lim[1]) + (u ? ' ' + u : '');
  return rangeErr(v, { min: lim[0], max: lim[1], u, why, low: why });
}
