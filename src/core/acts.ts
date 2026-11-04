import type { Acts, Calc } from './types';
import { cableName } from './protection';
import { fmt, plural, pn } from './format';
import { BOX_NAME } from './norms';
import { autoQty } from './labor';

export const DEFAULT_ACTS: Acts = { start: '', end: '', warranty: 12 };

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function normActs(o: unknown): Acts {
  const x = (o && typeof o === 'object' ? o : {}) as Partial<Record<keyof Acts, unknown>>;
  const w = x.warranty === undefined ? DEFAULT_ACTS.warranty : pn(x.warranty, 0);
  return {
    start: isDate(x.start) ? x.start : '',
    end: isDate(x.end) ? x.end : '',
    warranty: Math.min(120, Math.max(0, Math.round(isFinite(w) ? w : 0)))
  };
}

export const actsOf = (acts: Acts | undefined): Acts => acts ?? DEFAULT_ACTS;

export const ruDate = (iso: string): string => (isDate(iso) ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '');

export function actDate(acts: Acts | undefined, now = Date.now()): string {
  const x = actsOf(acts);
  if (x.end) return ruDate(x.end);
  return new Date(now).toLocaleDateString('ru-RU');
}

export interface CableRun {
  name: string;
  m: number;
  groups: string[];
}

export function cableRuns(a: Calc): CableRun[] {
  const map = new Map<string, CableRun>();
  a.rows.forEach((x, i) => {
    if (x.r.empty || !x.r.In) return;
    const k = cableName(x.r);
    const run = map.get(k) ?? { name: k, m: 0, groups: [] };
    run.m += x.r.cable;
    run.groups.push('Г' + (i + 1));
    map.set(k, run);
  });
  return Array.from(map.values()).map(r => ({ ...r, m: Math.ceil(r.m) }));
}

export function hiddenWorks(a: Calc): string[] {
  const runs = cableRuns(a);
  const wall = a.c.method === 'wall';
  const q = autoQty(a);
  const out = runs.map(r => 'прокладка кабеля ' + r.name + (wall ? ' в штробах' : ' по основанию') + (r.m > 0 ? ', ' + fmt(r.m, 0) + ' м' : '') + ' (' + r.groups.join(', ') + ')');
  const points = q.socket + q.light + q.switch;
  if (points > 0) out.push('установка монтажных коробок под розетки, выключатели и выводы светильников, ' + points + ' шт');
  if (a.boxes > 0) out.push('установка распределительных коробок ' + BOX_NAME[a.c.box] + ', ' + a.boxes + ' шт, соединения в коробках');
  return out;
}

export function hiddenMaterials(a: Calc): string[] {
  const out = cableRuns(a).map(r => 'кабель ' + r.name + (r.m > 0 ? ', ' + fmt(r.m, 0) + ' м' : ''));
  if (a.boxes > 0) out.push('коробки распределительные ' + BOX_NAME[a.c.box] + ', ' + a.boxes + ' шт');
  return out;
}

export const warrantyText = (months: number): string => months + ' ' + plural(months, ['месяц', 'месяца', 'месяцев']);

export const actsSummary = (acts: Acts | undefined): string => {
  const x = actsOf(acts);
  const parts = [x.start || x.end ? [ruDate(x.start) || '…', ruDate(x.end) || '…'].join(' – ') : '', x.warranty ? 'гарантия ' + warrantyText(x.warranty) : ''].filter(Boolean);
  return parts.join(', ');
};


