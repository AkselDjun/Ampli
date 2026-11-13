import type { Line } from './types';

export const NO_ZONE = 'Без помещения';

export interface ZoneGroup {
  zone: string | null;
  items: number[];
}

export function roomGroups(lines: Line[]): ZoneGroup[] {
  if (!lines.length) return [];
  const groups: (ZoneGroup & { key: string })[] = [];
  lines.forEach((l, i) => {
    const name = (l.zone ?? '').trim() || NO_ZONE;
    const key = name.toLowerCase();
    const g = groups.find(y => y.key === key);
    if (g) g.items.push(i);
    else groups.push({ key, zone: name, items: [i] });
  });
  if (groups.length < 2) return [{ zone: null, items: lines.map((_, i) => i) }];
  const none = NO_ZONE.toLowerCase();
  return [...groups.filter(g => g.key !== none), ...groups.filter(g => g.key === none)].map(({ zone, items }) => ({ zone, items }));
}
