import type { Calc, Line, Project } from './types';
import { calcAll } from './calc';
import { mkLine } from './templates';

export interface Addon {
  id: string;
  title: string;
  make: () => Line;
}

export const ADDONS: Addon[] = [
  { id: 'ac', title: 'Кондиционер 1,2 кВт', make: () => mkLine('Кондиционер', 'power', 15, 1, 0.85, [['Кондиционер', 1200, 1]]) },
  { id: 'stove', title: 'Электроплита 7 кВт', make: () => mkLine('Электроплита', 'power', 12, 0.8, 1, [['Электроплита', 7000, 1]]) },
  { id: 'boiler', title: 'Водонагреватель 2 кВт', make: () => mkLine('Бойлер', 'power', 9, 1, 1, [['Водонагреватель', 2000, 1]]) },
  { id: 'floor', title: 'Тёплый пол 0,8 кВт', make: () => mkLine('Тёплый пол', 'power', 12, 1, 1, [['Тёплый пол', 800, 1]]) },
  { id: 'dish', title: 'Посудомоечная машина 2 кВт', make: () => mkLine('Посудомоечная машина', 'power', 10, 1, 0.95, [['Посудомоечная машина', 2000, 1]]) }
];

export function variantCalc(p: Project, excluded: string[], addons: string[]): Calc {
  const lines = p.lines.filter(l => !excluded.includes(l.id)).concat(ADDONS.filter(a => addons.includes(a.id)).map(a => a.make()));
  return calcAll(lines, p.cfg);
}

export interface CompareRow {
  label: string;
  now: string;
  alt: string;
  worse: boolean | null;
}

const kw = (w: number): string => (w / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' кВт';

export function compareRows(now: Calc, alt: Calc): CompareRow[] {
  const inName = (c: Calc): string => (c.inIn ? (c.c.supply === 3 ? '4P' : '2P') + ' C' + c.inIn : '—');
  const need3 = (c: Calc): string => (c.hint3 ? 'нужен трёхфазный' : (c.c.supply === 3 ? 'трёхфазный' : 'однофазный'));
  return [
    { label: 'Расчётная мощность', now: kw(now.P), alt: kw(alt.P), worse: alt.P > now.P ? true : (alt.P < now.P ? false : null) },
    { label: 'Ток ввода', now: Math.round(now.Itot) + ' А', alt: Math.round(alt.Itot) + ' А', worse: alt.Itot > now.Itot ? true : (alt.Itot < now.Itot ? false : null) },
    { label: 'Вводной автомат', now: inName(now), alt: inName(alt), worse: (alt.inIn ?? 0) > (now.inIn ?? 0) ? true : ((alt.inIn ?? 0) < (now.inIn ?? 0) ? false : null) },
    { label: 'Ввод', now: need3(now), alt: need3(alt), worse: alt.hint3 && !now.hint3 ? true : (!alt.hint3 && now.hint3 ? false : null) },
    { label: 'Щиток', now: now.size + ' мод.', alt: alt.size + ' мод.', worse: alt.size > now.size ? true : (alt.size < now.size ? false : null) },
    { label: 'Групп с замечаниями', now: String(now.issues), alt: String(alt.issues), worse: alt.issues > now.issues ? true : (alt.issues < now.issues ? false : null) },
    { label: 'Загрузка выделенной мощности', now: Math.round(now.P / (now.c.alloc * 10)) + ' %', alt: Math.round(alt.P / (alt.c.alloc * 10)) + ' %', worse: alt.P > now.P ? true : (alt.P < now.P ? false : null) }
  ];
}
