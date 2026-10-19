import type { Offer } from '../core/shop';

export const PL_KEY = 'ampli-pl-v1';
export const MAX_LISTS = 5;

export interface PriceList {
  id: string;
  name: string;
  at: number;
  offers: Offer[];
}

export function loadLists(): PriceList[] {
  try {
    const raw = localStorage.getItem(PL_KEY);
    if (!raw) return [];
    const o = JSON.parse(raw);
    if (!Array.isArray(o)) return [];
    return o
      .filter(x => x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.offers))
      .slice(0, MAX_LISTS)
      .map(x => ({
        id: x.id,
        name: String(x.name).slice(0, 60),
        at: Number(x.at) || 0,
        offers: (x.offers as Offer[])
          .filter(f => f && typeof f.name === 'string' && typeof f.price === 'number' && f.price > 0)
          .map(f => ({ name: f.name, price: f.price, src: String(x.name).slice(0, 60) }))
      }));
  } catch (e) {
    void e;
    return [];
  }
}

export function saveLists(lists: PriceList[]): boolean {
  try {
    localStorage.setItem(PL_KEY, JSON.stringify(lists));
    return true;
  } catch (e) {
    void e;
    return false;
  }
}

export function addList(lists: PriceList[], name: string, offers: Offer[]): PriceList[] {
  const rest = lists.filter(l => l.name !== name);
  const next: PriceList = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, at: Date.now(), offers: offers.map(o => ({ ...o, src: name })) };
  return [next, ...rest].slice(0, MAX_LISTS);
}
