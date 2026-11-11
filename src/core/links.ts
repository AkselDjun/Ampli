import type { Project } from './types';
import type { WorkPrices } from './labor';

export const SHARE_PREFIX = '#p=';
export const OWNER_PREFIX = '#o=';
export const ESTIMATE_PREFIX = '#e=';

export const TIER_MARKUP_MAX = 300;

export type Markup = [number, number, number];

export function normMarkup(o: unknown): Markup | null {
  if (!Array.isArray(o) || o.length !== 3) return null;
  const out = o.map(v => (typeof v === 'number' && isFinite(v) ? Math.min(TIER_MARKUP_MAX, Math.max(0, Math.round(v))) : NaN));
  return out.some(v => isNaN(v)) ? null : (out as Markup);
}

export interface EstimateShare {
  p: Project;
  prices: Record<string, number>;
  labor: WorkPrices;
  company: string;
  contacts: string;
  at: number;
  tiers?: Markup;
}

const readHash = (hash: string, prefix: string): string | null => {
  if (!hash.startsWith(prefix)) return null;
  const v = hash.slice(prefix.length);
  return v.length > 0 ? v : null;
};

export const readShareHash = (hash: string): string | null => readHash(hash, SHARE_PREFIX);
export const readOwnerHash = (hash: string): string | null => readHash(hash, OWNER_PREFIX);
export const readEstimateHash = (hash: string): string | null => readHash(hash, ESTIMATE_PREFIX);

export const hasLink = (hash: string): boolean => readShareHash(hash) !== null || readOwnerHash(hash) !== null || readEstimateHash(hash) !== null;
