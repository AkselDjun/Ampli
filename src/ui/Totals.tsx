import type { Calc } from '../core/types';
import { fmt } from '../core/format';

export interface AllocState {
  pct: number;
  k: 'ok' | 'warn' | 'bad';
  text: string;
}

export function allocState(a: Calc): AllocState {
  const alloc = a.c.alloc * 1000;
  const pct = alloc > 0 ? a.P / alloc * 100 : 0;
  if (a.P <= 0) return { pct: 0, k: 'ok', text: 'Нет нагрузки' };
  if (pct > 100) return { pct, k: 'bad', text: 'Превышение на ' + fmt((a.P - alloc) / 1000, 1) + ' кВт' };
  if (pct >= 90) return { pct, k: 'warn', text: 'На пределе' };
  return { pct, k: 'ok', text: 'Норма' };
}
