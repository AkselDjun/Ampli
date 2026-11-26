import type { Row } from './types';
import { roomGroups } from './zonelist';
import type { ZoneGroup } from './zonelist';

export type ListFilter = 'bad' | 'warn' | 'chg' | 'note';
export type ListSort = 'no' | 'p' | 'i' | 'du';

export interface ListMarks {
  chg: ReadonlySet<string>;
  note: ReadonlySet<string>;
}

const NONE: ListMarks = { chg: new Set(), note: new Set() };

const isStatus = (x: Row, s: 'bad' | 'warn'): boolean => !x.r.empty && x.r.status === s;

const keep = (x: Row, f: ListFilter, m: ListMarks): boolean => {
  if (f === 'chg') return m.chg.has(x.l.id);
  if (f === 'note') return m.note.has(x.l.id);
  return isStatus(x, f);
};

const KEY: Record<Exclude<ListSort, 'no'>, (x: Row) => number> = {
  p: x => x.r.pd,
  i: x => x.r.I,
  du: x => x.r.drop
};

export function listView(rows: readonly Row[], filter: ListFilter | null, sort: ListSort, marks: ListMarks = NONE): ZoneGroup[] {
  const key = sort === 'no' ? null : KEY[sort];
  return roomGroups(rows.map(x => x.l))
    .map(g => {
      const items = filter ? g.items.filter(i => keep(rows[i], filter, marks)) : [...g.items];
      if (key) items.sort((a, b) => key(rows[b]) - key(rows[a]) || a - b);
      return { zone: g.zone, items };
    })
    .filter(g => g.items.length);
}

export const listCounts = (rows: readonly Row[]): { bad: number; warn: number } => ({
  bad: rows.filter(x => isStatus(x, 'bad')).length,
  warn: rows.filter(x => isStatus(x, 'warn')).length
});
