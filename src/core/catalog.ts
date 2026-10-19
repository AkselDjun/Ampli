import { PRESETS } from './norms';

export type Tag = 'l' | 's' | 'p';

export interface CatItem {
  key: string;
  name: string;
  w: number;
  tags: string;
  mine: string | null;
}

export interface Usage {
  n: number;
  at: number;
}

export const USAGE_LIMIT = 200;

export const normName = (s: string): string => s.toLowerCase().replace(/ё/g, 'е').trim();

export function catalog(mine: { id: string; name: string; w: number; tag: Tag }[]): CatItem[] {
  const base: CatItem[] = PRESETS.map(p => ({ key: normName(p[0]) + '|' + p[1], name: p[0], w: p[1], tags: p[2], mine: null }));
  const own: CatItem[] = mine.map(m => ({ key: normName(m.name) + '|' + m.w, name: m.name, w: m.w, tags: m.tag, mine: m.id }));
  return [...base, ...own];
}

const score = (u: Usage | undefined): number => (u ? u.n * 1e13 + u.at : 0);

export function byUsage(items: CatItem[], usage: Record<string, Usage>): CatItem[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => score(usage[normName(b.it.name)]) - score(usage[normName(a.it.name)]) || a.i - b.i)
    .map(x => x.it);
}

export function topUsed(items: CatItem[], usage: Record<string, Usage>, tag: string, limit = 6): CatItem[] {
  const seen = new Set<string>();
  return byUsage(items, usage)
    .filter(it => it.tags.includes(tag) && usage[normName(it.name)])
    .filter(it => (seen.has(normName(it.name)) ? false : (seen.add(normName(it.name)), true)))
    .slice(0, limit);
}

export function searchCatalog(items: CatItem[], query: string, usage: Record<string, Usage>, tag: string, limit = 8): CatItem[] {
  const q = normName(query);
  if (!q) return [];
  const hit = items.filter(it => normName(it.name).includes(q));
  const ranked = byUsage(hit, usage);
  const starts = (it: CatItem) => (normName(it.name).startsWith(q) ? 0 : 1);
  const here = (it: CatItem) => (it.tags.includes(tag) ? 0 : 1);
  return ranked
    .map((it, i) => ({ it, i }))
    .sort((a, b) => starts(a.it) - starts(b.it) || here(a.it) - here(b.it) || a.i - b.i)
    .map(x => x.it)
    .slice(0, limit);
}
