import type { CfgN, Line, LineResult } from './types';
import { calcLine } from './calc';
import { pn } from './format';

export type FixAct = { k: 'len'; len: number } | { k: 'largest' } | { k: 'half' };

export interface Fix {
  text: string;
  label: string | null;
  act: FixAct | null;
}

export function appPower(a: { w: number | string; n: number | string }): number {
  return Math.max(0, pn(a.w, 0)) * Math.max(0, pn(a.n, 0));
}

export function canSplit(l: Line): boolean {
  const live = l.apps.filter(a => appPower(a) > 0);
  return live.length >= 2 || (live.length === 1 && pn(live[0].n, 0) >= 2);
}

export function maxLenFor(l: Line, c: CfgN): number | null {
  const len = Math.max(0, pn(l.len, 0));
  for (let L = Math.floor(len) - 1; L >= 1; L--) {
    const r = calcLine({ ...l, len: L }, c);
    if (r.status !== 'bad' && r.In) return L;
  }
  return null;
}

export function fixFor(l: Line, r: LineResult, c: CfgN): Fix | null {
  if (r.empty) return null;
  if (r.In === null) {
    if (canSplit(l)) return { text: 'Нагрузка слишком велика для одной группы: разделите её на две.', label: 'Разделить', act: { k: 'half' } };
    return { text: 'Нагрузка слишком велика для одной группы: уменьшите мощность прибора.', label: null, act: null };
  }
  if (r.insMeas !== null && r.insMeas < 0.5) {
    return { text: 'Изоляция ниже нормы: найдите повреждённый участок и повторите замер.', label: null, act: null };
  }
  if (r.zsMeas !== null && r.ik < r.ikNeed) {
    return { text: 'По замеру петля велика: проверьте контакты и затяжку клемм, при необходимости сократите линию.', label: null, act: null };
  }
  if (r.leakMeas !== null && r.leakMeas > r.leakLim) {
    return { text: 'Утечка больше трети уставки УЗО: отключайте приборы по одному и найдите источник.', label: null, act: null };
  }
  if (r.status === 'bad') {
    const L = maxLenFor(l, c);
    if (L !== null) return { text: 'Сократите линию до ' + L + ' м.', label: 'Сократить до ' + L + ' м', act: { k: 'len', len: L } };
    if (canSplit(l)) return { text: 'Линия слишком длинная для такой нагрузки: разделите её на две.', label: 'Разделить', act: { k: 'half' } };
    return { text: 'Линия слишком длинная для этой нагрузки: уменьшите длину или мощность.', label: null, act: null };
  }
  if (l.type === 'socket' && r.In > 16 && canSplit(l)) {
    const big = [...l.apps].sort((x, y) => appPower(y) - appPower(x))[0];
    return { text: 'Вынесите «' + (big.name || 'прибор') + '» в отдельную линию.', label: 'Вынести', act: { k: 'largest' } };
  }
  return null;
}

export function splitApps(l: Line, mode: 'largest' | 'half'): { keep: Line['apps']; move: Line['apps'] } | null {
  const live = l.apps.filter(a => appPower(a) > 0);
  if (!live.length) return null;
  if (mode === 'largest') {
    if (live.length < 2) return null;
    const big = [...live].sort((x, y) => appPower(y) - appPower(x))[0];
    return { keep: l.apps.filter(a => a.id !== big.id), move: [big] };
  }
  if (live.length === 1) {
    const one = live[0];
    const n = Math.floor(pn(one.n, 0));
    if (n < 2) return null;
    const keepN = Math.ceil(n / 2);
    return {
      keep: l.apps.map(a => (a.id === one.id ? { ...a, n: keepN } : a)),
      move: [{ ...one, n: n - keepN }]
    };
  }
  const sorted = [...live].sort((x, y) => appPower(y) - appPower(x));
  const keep: Line['apps'] = [];
  const move: Line['apps'] = [];
  let pk = 0;
  let pm = 0;
  sorted.forEach(a => {
    if (pk <= pm) {
      keep.push(a);
      pk += appPower(a);
    } else {
      move.push(a);
      pm += appPower(a);
    }
  });
  const dead = l.apps.filter(a => appPower(a) <= 0);
  return { keep: [...keep, ...dead], move };
}
