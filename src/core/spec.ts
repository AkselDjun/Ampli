import type { Calc, SpecItem } from './types';
import { fmt } from './format';
import { cableName, inCableName, protFull, uzoName } from './protection';
import { BOX_NAME } from './norms';

export function buildSpec(a: Calc): SpecItem[] {
  const c = a.c;
  const items: SpecItem[] = [];
  items.push({ name: 'Щиток на ' + a.size + ' модулей', qty: '1 шт', note: 'с запасом 20 % свободных модулей', n: 1, unit: 'шт' });
  if (a.inIn) items.push({ name: 'Вводной автомат ' + (c.supply === 3 ? '4P' : '2P') + ' C' + a.inIn, qty: '1 шт', note: 'ток линии ввода ' + fmt(a.Itot, 0) + ' А', n: 1, unit: 'шт' });
  const dev = new Map<string, { name: string; n: number; g: string[] }>();
  a.uzos.forEach(u => {
    const k = uzoName(u);
    if (!dev.has(k)) dev.set(k, { name: k, n: 0, g: [] });
    const d = dev.get(k)!;
    d.n++;
    d.g.push(u.zone);
  });
  const cab = new Map<string, { name: string; m: number; g: string[] }>();
  a.rows.forEach((x, idx) => {
    const r = x.r;
    if (r.empty || !r.In) return;
    const k = protFull(r);
    if (!dev.has(k)) dev.set(k, { name: k, n: 0, g: [] });
    const d = dev.get(k)!;
    d.n++;
    d.g.push('Г' + (idx + 1));
    const ck = cableName(r);
    if (!cab.has(ck)) cab.set(ck, { name: ck, m: 0, g: [] });
    const cc = cab.get(ck)!;
    cc.m += r.cable;
    cc.g.push('Г' + (idx + 1));
  });
  dev.forEach(d => items.push({ name: d.name, qty: d.n + ' шт', note: d.g.join(', '), n: d.n, unit: 'шт' }));
  if (a.inS) items.push({ name: inCableName(c, a.inS), qty: 'по месту', note: 'кабель ввода в щиток', n: null, unit: 'м' });
  cab.forEach(cc => items.push({ name: cc.name, qty: cc.m > 0 ? Math.ceil(cc.m * 1.1) + ' м' : 'длина не задана', note: cc.g.join(', ') + (cc.m > 0 ? '; запас 10 %' : ''), n: cc.m > 0 ? Math.ceil(cc.m * 1.1) : null, unit: 'м' }));
  const nN = Math.max(1, a.uzos.length);
  items.push({ name: 'Шина N (нулевая)', qty: nN + ' шт', note: a.uzos.length ? 'своя на каждое УЗО: ' + a.uzos.map(u => u.zone).join(', ') : '', n: nN, unit: 'шт' });
  items.push({ name: 'Шина PE (заземления)', qty: '1 шт', note: '', n: 1, unit: 'шт' });
  if (a.boxes > 0) items.push({ name: 'Коробка распределительная ' + BOX_NAME[c.box], qty: a.boxes + ' шт', note: 'по одной на группу с отводами', n: a.boxes, unit: 'шт' });
  return items;
}

export function estimate(items: SpecItem[], prices: Record<string, number>): { rows: { item: SpecItem; price: number | null; sum: number | null }[]; total: number; missing: number } {
  let total = 0;
  let missing = 0;
  const rows = items.map(item => {
    const price = prices[item.name] ?? null;
    const sum = price !== null && item.n !== null ? Math.round(price * item.n * 100) / 100 : null;
    if (sum !== null) total += sum;
    else missing++;
    return { item, price, sum };
  });
  return { rows, total: Math.round(total * 100) / 100, missing };
}
