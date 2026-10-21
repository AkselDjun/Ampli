import type { Calc, LineType } from './types';
import { pn } from './format';

export type WorkKey = 'panel' | 'module' | 'chase' | 'cable' | 'socket' | 'switch' | 'light' | 'power';

export interface WorkDef {
  key: WorkKey;
  name: string;
  unit: string;
  hint: string;
}

export const WORKS: WorkDef[] = [
  { key: 'panel', name: 'Установка корпуса щитка', unit: 'шт', hint: 'один щиток на проект' },
  { key: 'module', name: 'Сборка щитка', unit: 'мод.', hint: 'по числу модулей аппаратов' },
  { key: 'chase', name: 'Штроба', unit: 'м', hint: 'при скрытой прокладке равна длине кабеля' },
  { key: 'cable', name: 'Прокладка кабеля', unit: 'м', hint: 'длины групп с запасом 10 %' },
  { key: 'socket', name: 'Установка розетки', unit: 'точка', hint: 'по приборам розеточных групп' },
  { key: 'switch', name: 'Установка выключателя', unit: 'точка', hint: 'укажите вручную' },
  { key: 'light', name: 'Подключение светильника', unit: 'точка', hint: 'по приборам групп освещения' },
  { key: 'power', name: 'Подключение мощного прибора', unit: 'шт', hint: 'плита, бойлер, кондиционер' }
];

export const WORK_KEYS: WorkKey[] = WORKS.map(w => w.key);

export const isWorkKey = (k: unknown): k is WorkKey => typeof k === 'string' && (WORK_KEYS as string[]).includes(k);

export type WorkQty = Partial<Record<WorkKey, number>>;
export type WorkPrices = Partial<Record<WorkKey, number>>;

export function normWork(o: unknown): WorkQty {
  const out: WorkQty = {};
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const n = pn(v, NaN);
    if (isWorkKey(k) && isFinite(n) && n >= 0) out[k] = Math.round(n * 100) / 100;
  }
  return out;
}

export function autoQty(a: Calc): Record<WorkKey, number> {
  const groups = a.rows.filter(x => !x.r.empty && x.r.In);
  const cable = Math.ceil(groups.reduce((s, x) => s + x.r.len, 0) * 1.1);
  const points = (t: LineType): number =>
    a.rows
      .filter(x => x.l.type === t)
      .reduce((s, x) => s + x.l.apps.filter(ap => pn(ap.w, 0) > 0).reduce((q, ap) => q + Math.max(1, Math.round(pn(ap.n, 1))), 0), 0);
  return {
    panel: groups.length ? 1 : 0,
    module: groups.length ? a.modSum : 0,
    chase: a.c.method === 'wall' ? cable : 0,
    cable,
    socket: points('socket'),
    switch: 0,
    light: points('light'),
    power: points('power')
  };
}

export interface WorkRow {
  def: WorkDef;
  qty: number;
  auto: number;
  manual: boolean;
  price: number | null;
  sum: number | null;
}

export interface LaborEstimate {
  rows: WorkRow[];
  total: number;
  priced: boolean;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

export function laborEstimate(a: Calc, qty: WorkQty | undefined, prices: WorkPrices): LaborEstimate {
  const auto = autoQty(a);
  let total = 0;
  const rows = WORKS.map(def => {
    const manual = qty?.[def.key] !== undefined;
    const q = manual ? (qty?.[def.key] as number) : auto[def.key];
    const price = prices[def.key] ?? null;
    const sum = price !== null && q > 0 ? r2(price * q) : null;
    if (sum !== null) total += sum;
    return { def, qty: q, auto: auto[def.key], manual, price, sum };
  });
  return { rows, total: r2(total), priced: rows.some(r => r.price !== null) };
}

export const grandTotal = (materials: number, works: number): number => r2(materials + works);
