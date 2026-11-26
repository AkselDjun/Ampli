import type { Row } from './types';
import { fmt, fs, pn } from './format';

export const PEEK_APPS = 5;

export interface Peek {
  facts: [string, string][];
  apps: string[];
  more: number;
}

export function peekOf(x: Row): Peek {
  const { l, r } = x;
  const cable = (r.S ? fs(r.S) + ' мм²' : 'сечение не подобрано') + ' · ' + fs(pn(l.len, 0)) + ' м';
  if (r.empty) return { facts: [['Кабель', cable]], apps: [], more: 0 };
  const prot = r.In ? r.curve + r.In + (r.rcbo ? ' · дифавтомат ' + r.ma + ' мА' : r.rcd ? ' · УЗО «' + r.zone + '» ' + r.ma + ' мА' : '') : 'не подобран';
  const facts: [string, string][] = [
    ['Защита', prot],
    ['Кабель', cable],
    ['Потеря', fmt(r.drop, 1) + ' % из ' + fmt(r.limit, 1) + ' %']
  ];
  if (r.In) facts.push(['Загрузка', Math.round(r.I / r.In * 100) + ' %']);
  const apps = l.apps.slice(0, PEEK_APPS).map(a => (a.name || 'Без названия') + (pn(a.n, 1) > 1 ? ' × ' + pn(a.n, 1) : ''));
  return { facts, apps, more: Math.max(0, l.apps.length - PEEK_APPS) };
}
