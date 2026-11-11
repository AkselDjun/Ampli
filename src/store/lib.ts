import { normFloor } from '../core/floor';
import type { FloorRoom } from '../core/floor';
import { normWeak, weakStarted } from '../core/weak';
import type { Weak } from '../core/weak';
import { normProject, uniqName } from '../core/project';
import type { Cfg, Line } from '../core/types';
import { pn } from '../core/format';
import { nid } from '../core/ids';
import { USAGE_LIMIT, normName } from '../core/catalog';
import type { Usage } from '../core/catalog';
import { isWorkKey } from '../core/labor';
import type { WorkKey, WorkPrices } from '../core/labor';
import { TIER_MARKUP_MAX, normMarkup } from '../core/links';
import type { Markup } from '../core/links';

export const LIB_KEY = 'ampli-lib-v1';

export interface UserTpl {
  id: string;
  name: string;
  cfg: Cfg;
  lines: Line[];
  floor?: FloorRoom[];
  weak?: Weak;
}

export interface Brand {
  company: string;
  contacts: string;
  signer: string;
  logo: string;
}

export interface Lib {
  templates: UserTpl[];
  prices: Record<string, number>;
  brand: Brand;
  usage: Record<string, Usage>;
  labor: WorkPrices;
  tiers: { on: boolean; markup: Markup };
}

export const emptyBrand = (): Brand => ({ company: '', contacts: '', signer: '', logo: '' });
export const emptyLib = (): Lib => ({ templates: [], prices: {}, brand: emptyBrand(), usage: {}, labor: {}, tiers: { on: false, markup: [0, 0, 0] } });

export function normLib(o: unknown): Lib {
  const lib = emptyLib();
  if (!o || typeof o !== 'object') return lib;
  const x = o as Partial<Record<keyof Lib, unknown>>;
  if (Array.isArray(x.templates)) {
    lib.templates = x.templates
      .filter((t): t is UserTpl => !!t && typeof (t as UserTpl).name === 'string' && Array.isArray((t as UserTpl).lines) && !!(t as UserTpl).cfg)
      .filter(t => !!normProject({ cfg: t.cfg, lines: t.lines }))
      .map(t => ({ id: String(t.id || nid()), name: t.name.slice(0, 60), cfg: t.cfg, lines: t.lines, ...(normFloor(t.floor).length ? { floor: normFloor(t.floor) } : {}), ...(weakStarted(normWeak(t.weak)) ? { weak: normWeak(t.weak) } : {}) }));
  }
  if (x.prices && typeof x.prices === 'object') {
    for (const [k, v] of Object.entries(x.prices as Record<string, unknown>)) {
      const n = pn(v, NaN);
      if (isFinite(n) && n >= 0) lib.prices[k] = n;
    }
  }
  if (x.labor && typeof x.labor === 'object') {
    for (const [k, v] of Object.entries(x.labor as Record<string, unknown>)) {
      const n = pn(v, NaN);
      if (isWorkKey(k) && isFinite(n) && n >= 0) lib.labor[k] = n;
    }
  }
  if (x.usage && typeof x.usage === 'object') {
    for (const [k, v] of Object.entries(x.usage as Record<string, unknown>)) {
      const u = v as Partial<Usage> | null;
      const n = Number(u?.n);
      if (u && n > 0 && isFinite(n)) lib.usage[k] = { n: Math.floor(n), at: Number(u.at) || 0 };
    }
  }
  if (x.tiers && typeof x.tiers === 'object') {
    const t = x.tiers as { on?: unknown; markup?: unknown };
    lib.tiers = { on: t.on === true, markup: normMarkup(t.markup) ?? [0, 0, 0] };
  }
  if (x.brand && typeof x.brand === 'object') {
    const b = x.brand as Partial<Brand>;
    lib.brand = {
      company: String(b.company ?? '').slice(0, 80),
      contacts: String(b.contacts ?? '').slice(0, 160),
      signer: String(b.signer ?? '').slice(0, 80),
      logo: typeof b.logo === 'string' && b.logo.startsWith('data:image/') ? b.logo : ''
    };
  }
  return lib;
}

export function loadLib(): Lib {
  try {
    const r = localStorage.getItem(LIB_KEY);
    return r ? normLib(JSON.parse(r)) : emptyLib();
  } catch (e) {
    void e;
    return emptyLib();
  }
}

export function saveLib(l: Lib): boolean {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(l));
    return true;
  } catch (e) {
    void e;
    return false;
  }
}

export type LibAction =
  | { t: 'addTpl'; name: string; cfg: Cfg; lines: Line[]; floor?: FloorRoom[]; weak?: Weak }
  | { t: 'delTpl'; id: string }
  | { t: 'price'; name: string; value: string }
  | { t: 'clearPrices' }
  | { t: 'labor'; key: WorkKey; value: string }
  | { t: 'use'; name: string; at?: number }
  | { t: 'clearUsage' }
  | { t: 'brand'; field: 'company' | 'contacts' | 'signer'; value: string }
  | { t: 'logo'; value: string }
  | { t: 'tiersOn'; on: boolean }
  | { t: 'tierMarkup'; i: 0 | 1 | 2; value: string };

export function libReducer(l: Lib, a: LibAction): Lib {
  switch (a.t) {
    case 'addTpl': {
      const name = uniqName(l.templates.map(t => t.name), a.name.trim() || 'Мой шаблон');
      const copy: UserTpl = { id: nid() + Date.now().toString(36), name: name.slice(0, 60), cfg: { ...a.cfg }, lines: JSON.parse(JSON.stringify(a.lines)), ...(a.floor?.length ? { floor: normFloor(a.floor) } : {}), ...(weakStarted(a.weak) ? { weak: normWeak(a.weak) } : {}) };
      return { ...l, templates: [...l.templates, copy] };
    }
    case 'delTpl':
      return { ...l, templates: l.templates.filter(x => x.id !== a.id) };
    case 'price': {
      const prices = { ...l.prices };
      const n = pn(a.value, NaN);
      if (isFinite(n) && n >= 0) prices[a.name] = Math.min(n, 1000000);
      else delete prices[a.name];
      return { ...l, prices };
    }
    case 'clearPrices':
      return { ...l, prices: {} };
    case 'labor': {
      const labor = { ...l.labor };
      const v = a.value.trim();
      const n = pn(v, NaN);
      if (v === '' || !isFinite(n) || n < 0) delete labor[a.key];
      else labor[a.key] = Math.min(n, 100000);
      return { ...l, labor };
    }
    case 'use': {
      const k = normName(a.name);
      if (!k) return l;
      const usage = { ...l.usage, [k]: { n: (l.usage[k]?.n ?? 0) + 1, at: a.at ?? Date.now() } };
      const keys = Object.keys(usage);
      if (keys.length > USAGE_LIMIT) {
        keys.sort((p, q) => usage[p].at - usage[q].at).slice(0, keys.length - USAGE_LIMIT).forEach(d => { delete usage[d]; });
      }
      return { ...l, usage };
    }
    case 'clearUsage':
      return { ...l, usage: {} };
    case 'brand':
      return { ...l, brand: { ...l.brand, [a.field]: a.value } };
    case 'logo':
      return { ...l, brand: { ...l.brand, logo: a.value } };
    case 'tiersOn':
      return { ...l, tiers: { ...l.tiers, on: a.on } };
    case 'tierMarkup': {
      const n = pn(a.value.trim(), 0);
      const markup: Markup = [...l.tiers.markup];
      markup[a.i] = isFinite(n) ? Math.min(TIER_MARKUP_MAX, Math.max(0, Math.round(n))) : 0;
      return { ...l, tiers: { ...l.tiers, markup } };
    }
    default:
      return l;
  }
}
