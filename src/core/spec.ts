import type { Calc, SpecItem } from './types';
import { fmt, fs } from './format';
import { cableName, protFull } from './protection';

export function buildSpec(a: Calc): SpecItem[] {
  const c = a.c;
  const items: SpecItem[] = [];
  items.push({ name: 'Щиток на ' + a.size + ' модулей', qty: '1 шт', note: 'с запасом 20 % свободных модулей' });
  if (a.inIn) items.push({ name: 'Вводной автомат ' + (c.supply === 3 ? '4P' : '2P') + ' C' + a.inIn, qty: '1 шт', note: 'ток линии ввода ' + fmt(a.Itot, 0) + ' А' });
  const dev = new Map<string, { name: string; n: number; g: string[] }>();
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
    cc.m += r.len;
    cc.g.push('Г' + (idx + 1));
  });
  dev.forEach(d => items.push({ name: d.name, qty: d.n + ' шт', note: d.g.join(', ') }));
  if (a.inS) items.push({ name: 'ВВГнг(А)-LS ' + (c.supply === 3 ? 5 : 3) + '×' + fs(a.inS), qty: 'по месту', note: 'кабель ввода в щиток' });
  cab.forEach(cc => items.push({ name: cc.name, qty: cc.m > 0 ? Math.ceil(cc.m * 1.1) + ' м' : 'длина не задана', note: cc.g.join(', ') + (cc.m > 0 ? '; запас 10 %' : '') }));
  items.push({ name: 'Шина N (нулевая)', qty: '1 шт', note: '' });
  items.push({ name: 'Шина PE (заземления)', qty: '1 шт', note: '' });
  return items;
}
