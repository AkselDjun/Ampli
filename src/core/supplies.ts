import type { Calc, SpecItem } from './types';
import { fs } from './format';

export const JUMPER_M = 0.5;
export const FERRULE_SPARE = 1.2;

export function jumperS(inIn: number | null): number {
  if (!inIn || inIn <= 25) return 4;
  if (inIn <= 40) return 6;
  if (inIn <= 63) return 10;
  return 16;
}

export function tubeD(cores: number, s: number): number {
  if (cores <= 3) {
    if (s <= 1.5) return 16;
    if (s <= 4) return 20;
    if (s <= 10) return 25;
    return 32;
  }
  if (s <= 1.5) return 20;
  if (s <= 4) return 25;
  return 32;
}

export function ductSize(cores: number, s: number): string {
  if (cores <= 3 && s <= 2.5) return '16×16';
  if ((cores <= 3 && s <= 6) || s <= 2.5) return '25×16';
  return '40×25';
}

const add = (m: Map<string, number>, k: string, v: number): void => {
  m.set(k, (m.get(k) ?? 0) + v);
};

export function supplySpec(a: Calc): SpecItem[] {
  const c = a.c;
  const rows = a.rows.filter(x => !x.r.empty && x.r.In && x.r.S);
  if (!rows.length) return [];
  const items: SpecItem[] = [];
  const under = new Set<number>();
  a.uzos.forEach(u => u.groups.forEach(g => under.add(g)));
  const direct = rows.filter(x => !under.has(a.rows.indexOf(x)));
  const combs = new Map<string, string[]>();
  a.uzos.forEach(u => {
    if (u.groups.length < 2) return;
    const k = 'Шина соединительная (гребёнка) ' + (u.groups.some(g => a.rows[g]?.r.three) ? '3P' : '1P');
    combs.set(k, [...(combs.get(k) ?? []), 'под УЗО ' + u.zone]);
  });
  if (direct.length >= 2) {
    const rcbo = direct.some(x => x.r.rcbo);
    const poles = c.supply === 3 ? (rcbo ? '4P' : '3P') : (rcbo ? '2P' : '1P');
    const k = 'Шина соединительная (гребёнка) ' + poles;
    combs.set(k, [...(combs.get(k) ?? []), 'питание групп от вводного автомата']);
  }
  combs.forEach((where, name) => items.push({ name, qty: where.length + ' шт', note: where.join('; ') + '; отрезать по числу аппаратов', n: where.length, unit: 'шт' }));
  const feeds = a.uzos.length + (direct.length ? 1 : 0) + (c.vr && a.inIn ? 1 : 0) + (c.spd && a.inIn ? 1 : 0);
  const ph = c.supply === 3 ? 3 : 1;
  const nL = feeds * ph;
  const nN = a.uzos.length * 2 + (feeds - a.uzos.length);
  const js = jumperS(a.inIn);
  const wire = (color: string, cnt: number, note: string): void => {
    const m = Math.max(1, Math.ceil(cnt * JUMPER_M));
    items.push({ name: 'Провод ПуГВ (ПВ3) ' + fs(js) + ' мм² ' + color, qty: m + ' м', note, n: m, unit: 'м' });
  };
  wire('коричневый', nL, 'перемычки фазы от вводного автомата');
  wire('синий', nN, a.uzos.length ? 'перемычки N к УЗО и от УЗО на их шины' : 'перемычки N');
  wire('жёлто-зелёный', 2, 'PE от ввода на шину PE');
  const fer = new Map<string, number>();
  rows.forEach(x => add(fer, String(x.r.S), x.r.three ? 5 : 3));
  add(fer, String(js), (nL + nN + 2) * 2);
  [...fer.entries()].map(([s, n]) => [Number(s), n] as const).sort((p, q) => p[0] - q[0]).forEach(([s, n]) => {
    const k = Math.ceil(n * FERRULE_SPARE);
    items.push({ name: 'Наконечник НШВИ ' + fs(s) + ' мм²', qty: k + ' шт', note: 'на жилы в щитке, запас 20 %; продаются упаковками', n: k, unit: 'шт' });
  });
  const tube = new Map<string, number>();
  rows.forEach(x => {
    const cores = x.r.three ? 5 : 3;
    const s = x.r.S as number;
    const k = c.method === 'open' ? 'Короб пластиковый ' + ductSize(cores, s) + ' мм' : 'Труба гофрированная ПВХ ' + tubeD(cores, s) + ' мм';
    add(tube, k, x.r.cable);
  });
  tube.forEach((m, name) => {
    const len = Math.ceil(m * 1.1);
    if (len > 0) items.push({ name, qty: len + ' м', note: (c.method === 'open' ? 'открытая прокладка' : 'скрытая прокладка, по одному кабелю в трубе') + '; запас 10 %', n: len, unit: 'м' });
  });
  return items;
}
